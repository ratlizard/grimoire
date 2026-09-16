#!/usr/bin/env node
// Does the zip reader hand back exactly what was zipped?
//
//   node utilities/zip_check.mjs [index.html] [reference dir]
//
// WHY. js/mac-zip.js reads a container and inflates what is in it, and both
// halves fail quietly: a central directory read one field along gives a
// plausible catalog, and an inflater that is wrong in one block type gives
// output of the right length. So every entry is compared byte for byte with
// what went in, and the zips come from programs that are not this reader.
//
// FOUR SOURCES, NONE OF THEM THE READER.
//
// 1. Node's zlib, which is the reference DEFLATE implementation, compresses
//    payloads chosen to reach every block type -- stored, fixed and dynamic
//    Huffman, matches at distance 1 and near the edge of the window -- at
//    several levels and every strategy. This file writes the container around
//    them, so it runs on any machine and tests the inflater hardest.
// 2. The same container, written with the things a real zip does and a
//    reader can trip on: a data descriptor, a local extra field that differs
//    from the directory's, a comment after the end record, a UTF-8 name with
//    and without its flag, a Mac Roman name, and AppleDouble entries both
//    under __MACOSX/ and beside the file.
// 3. Info-ZIP's `zip` and Apple's `ditto`, when this machine has them: two
//    other programs' containers, and ditto's __MACOSX/ AppleDouble carrying a
//    resource fork and a Finder type and creator set on a real file. ditto
//    also writes UTF-8 names without setting the flag, which is why the
//    reader does not rely on it.
// 4. The add-on that is a zip, Rocky the Flying Chicken, through
//    extractDelverArchive -- the path a dropped file takes -- held to what
//    `unar` extracts from it, both saves, both forks.
//
// THE NEGATIVE CONTROLS. A byte flipped in a deflated entry must be refused,
// not handed back; so must an encrypted entry, a method this page does not
// decompress (named), and a zip with its end record cut off. And the two
// formats the page names instead of opening -- StuffIt X and Compact Pro --
// must be named, when the add-ons are here to be named.

import {readFileSync, writeFileSync, mkdirSync, rmSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import zlib from 'node:zlib';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', refDir = 'reference'] = process.argv.slice(2);
let failures = 0, entriesChecked = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);
const skip = (what, why) => console.log(`  skip ${what}: ${why}`);

const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);
for (const name of ['looksLikeZip', 'parseZipArchive', 'zipFork', 'extractDelverArchive'])
  if (ev(`typeof ${name}`) !== 'function') { console.error(`FAIL the page: ${name} is not defined`); process.exit(1); }

const TMP = join(process.env.TMPDIR || '/tmp', 'grimoire_zip_check');
rmSync(TMP, {recursive: true, force: true});
mkdirSync(TMP, {recursive: true});

const same = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
const firstDiff = (a, b) => { const n = Math.min(a.length, b.length); for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i; return n; };

// ---- a zip writer for the fixtures ----------------------------------------
// Deliberately not the page's buildZip: the reader should meet a container it
// did not write. Each file: {name (Buffer), data, method, deflated?, flags,
// localExtra?, centralExtra?, descriptor?}.
function crc32(buf) { return zlib.crc32 ? zlib.crc32(buf) >>> 0 : ev('crc32')(new Uint8Array(buf)); }
function writeZip(files, comment = Buffer.alloc(0)) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const f of files) {
    const payload = f.method === 8 ? f.deflated : f.data;
    const crc = crc32(f.data);
    const le = f.localExtra || Buffer.alloc(0), ce = f.centralExtra || Buffer.alloc(0);
    const flags = (f.flags || 0) | (f.descriptor ? 0x8 : 0);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(flags, 6);
    lh.writeUInt16LE(f.method, 8);
    // With a data descriptor the local header's CRC and sizes are zero, and
    // only the directory and the descriptor carry them.
    lh.writeUInt32LE(f.descriptor ? 0 : crc, 14);
    lh.writeUInt32LE(f.descriptor ? 0 : payload.length, 18);
    lh.writeUInt32LE(f.descriptor ? 0 : f.data.length, 22);
    lh.writeUInt16LE(f.name.length, 26); lh.writeUInt16LE(le.length, 28);
    const parts = [lh, f.name, le, payload];
    if (f.descriptor) {
      const dd = Buffer.alloc(16);
      dd.writeUInt32LE(0x08074b50, 0); dd.writeUInt32LE(crc, 4);
      dd.writeUInt32LE(payload.length, 8); dd.writeUInt32LE(f.data.length, 12);
      parts.push(dd);
    }
    const local = Buffer.concat(parts);
    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0); cd.writeUInt16LE(20, 4); cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(flags, 8); cd.writeUInt16LE(f.method, 10);
    cd.writeUInt32LE(crc, 16); cd.writeUInt32LE(payload.length, 20); cd.writeUInt32LE(f.data.length, 24);
    cd.writeUInt16LE(f.name.length, 28); cd.writeUInt16LE(ce.length, 30);
    cd.writeUInt32LE(offset, 42);
    centrals.push(Buffer.concat([cd, f.name, ce]));
    locals.push(local);
    offset += local.length;
  }
  const cdBuf = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cdBuf.length, 12); end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(comment.length, 20);
  return Buffer.concat([...locals, cdBuf, end, comment]);
}
const stored = (name, data, extra = {}) => ({name: Buffer.from(name), data, method: 0, ...extra});
const deflated = (name, data, opts = {}, extra = {}) =>
  ({name: Buffer.from(name), data, method: 8, deflated: zlib.deflateRawSync(data, opts), ...extra});

// Read a whole zip through the page: [{path, data, rsrc, type, creator}], or
// {error} when the reader refuses it.
function readAll(zipBytes) {
  sandbox.__z = new Uint8Array(zipBytes);
  return ev(`(() => {
    try {
      if (!looksLikeZip(__z)) return {error: 'not recognised as a zip'};
      const arc = parseZipArchive(__z);
      return arc.entries.filter(e => !e.isFolder).map(e => ({path: e.path, data: zipFork(__z, e, 'data'),
        rsrc: zipFork(__z, e, 'rsrc'), type: e.type, creator: e.creator}));
    } catch (err) { return {error: err.message}; }
  })()`);
}
function expectFiles(label, zipBytes, want) {
  const got = readAll(zipBytes);
  if (got.error) { fail(label, 'refused: ' + got.error); return false; }
  const paths = got.map(g => g.path).sort(), wantPaths = want.map(w => w.path).sort();
  if (JSON.stringify(paths) !== JSON.stringify(wantPaths)) {
    fail(label, `entries ${JSON.stringify(paths)} where ${JSON.stringify(wantPaths)} were zipped`); return false;
  }
  let good = true;
  for (const w of want) {
    const g = got.find(x => x.path === w.path);
    entriesChecked++;
    if (!same(g.data, w.data)) { fail(label, `"${w.path}" data fork differs at byte ${firstDiff(g.data, w.data)} (${g.data.length} against ${w.data.length})`); good = false; }
    if (w.rsrc && !same(g.rsrc, w.rsrc)) { fail(label, `"${w.path}" resource fork is ${g.rsrc.length} bytes, not the ${w.rsrc.length} zipped`); good = false; }
    if (w.type !== undefined && (g.type !== w.type || g.creator !== w.creator)) { fail(label, `"${w.path}" is ${g.type}/${g.creator}, not ${w.type}/${w.creator}`); good = false; }
  }
  return good;
}

// ---- 1. the inflater against zlib -------------------------------------------
{
  let seed = 0x2545F491;
  const rand = n => { const b = Buffer.alloc(n); for (let i = 0; i < n; i++) { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; b[i] = seed & 0xFF; } return b; };
  const prose = Buffer.from('The Delver Archive is a master index of subindexes, each a list of resources. '.repeat(1400));
  // Random blocks repeated at distances up to the edge of the 32K window.
  const far = Buffer.concat([rand(20000), rand(12000), Buffer.alloc(0)]);
  const echoes = Buffer.concat([far, far.subarray(0, 12000), rand(3000), far.subarray(500, 9000)]);
  const payloads = [
    ['empty', Buffer.alloc(0)], ['one byte', Buffer.from([0x41])], ['prose', prose],
    ['noise', rand(70000)], ['zeroes', Buffer.alloc(200000)], ['echoes', echoes],
  ];
  const C = zlib.constants;
  const settings = [];
  for (const level of [0, 1, 6, 9]) settings.push({level});
  for (const strategy of [C.Z_FILTERED, C.Z_HUFFMAN_ONLY, C.Z_RLE, C.Z_FIXED]) settings.push({level: 6, strategy});
  let streams = 0, good = true;
  for (const [pname, data] of payloads) {
    const files = settings.map((s, i) => deflated(`${pname}/${i}`, data, s));
    streams += files.length;
    if (!expectFiles('zlib ' + pname, writeZip(files), files.map(f => ({path: f.name.toString(), data})))) good = false;
  }
  if (good) ok('the inflater against zlib', `${streams} streams over ${payloads.length} payloads, every level and strategy`);
}

// ---- 2. what real zips do to a reader ---------------------------------------
{
  const a = Buffer.from('a stored file'), b = Buffer.from('a deflated file, '.repeat(300));
  const extra = Buffer.from([0x55, 0x54, 0x05, 0x00, 0x01, 0x11, 0x22, 0x33, 0x44]);   // an extended timestamp
  const macRoman = Buffer.from([0x43, 0x61, 0x66, 0x8E]);                                // "Café" in Mac Roman
  const utf8 = Buffer.from('Café ƒ');
  // AppleDouble: magic, version, 16 filler, two entries (9 FinderInfo, 2 resource fork).
  const appleDouble = (type, creator, rsrc) => {
    const fi = Buffer.alloc(32); fi.write(type, 0, 'latin1'); fi.write(creator, 4, 'latin1');
    const head = Buffer.alloc(26 + 24);
    head.writeUInt32BE(0x00051607, 0); head.writeUInt32BE(0x00020000, 4); head.writeUInt16BE(2, 24);
    head.writeUInt32BE(9, 26); head.writeUInt32BE(50, 30); head.writeUInt32BE(32, 34);
    head.writeUInt32BE(2, 38); head.writeUInt32BE(82, 42); head.writeUInt32BE(rsrc.length, 46);
    return Buffer.concat([head, fi, rsrc]);
  };
  const rsrcA = Buffer.from('resource fork of the sequestered one'), rsrcB = Buffer.from('resource fork beside it');
  const zipBytes = writeZip([
    stored('plain', a, {localExtra: extra}),
    deflated('described', b, {}, {descriptor: true, centralExtra: extra}),
    {name: macRoman, data: a, method: 0},
    {name: utf8, data: b, method: 8, deflated: zlib.deflateRawSync(b), flags: 0x800},
    stored('unflagged ' + 'Café', a),
    stored('Folder/save', b),
    deflated('__MACOSX/Folder/._save', appleDouble('DelP', 'Delv', rsrcA)),
    stored('beside', a),
    stored('._beside', appleDouble('DelS', 'Delv', rsrcB)),
    stored('._notappledouble', Buffer.from('just a file with a dotted name')),
  ], Buffer.from('an archive comment after the end record'));
  if (expectFiles('container quirks', zipBytes, [
    {path: 'plain', data: a}, {path: 'described', data: b},
    {path: 'Café', data: a}, {path: 'Café ƒ', data: b}, {path: 'unflagged Café', data: a},
    {path: 'Folder/save', data: b, rsrc: rsrcA, type: 'DelP', creator: 'Delv'},
    {path: 'beside', data: a, rsrc: rsrcB, type: 'DelS', creator: 'Delv'},
    {path: '._notappledouble', data: Buffer.from('just a file with a dotted name')},
  ])) ok('the container', 'a data descriptor, differing extra fields, a trailing comment, three kinds of name, and AppleDouble in __MACOSX and beside the file');

  // The negative controls.
  const flip = Buffer.from(writeZip([deflated('x', b)]));
  flip[30 + 1 + 5] ^= 0x10;                        // inside the deflate stream
  const refusals = [
    ['a byte flipped in a deflated entry', flip, /CRC-32|inflate/],
    ['an encrypted entry', writeZip([stored('secret', a, {flags: 1})]), /encrypted/],
    ['a method this page does not decompress', (() => { const z = writeZip([stored('bz', a)]); z.writeUInt16LE(12, 8); z.writeUInt16LE(12, 30 + 2 + a.length + 10); return z; })(), /method 12 \(bzip2\)/],
    ['a zip with its end record cut off', writeZip([stored('cut', a)]).subarray(0, 50), /end-of-central-directory/],
  ];
  const missed = [];
  for (const [what, bytes, want] of refusals) {
    const got = readAll(bytes);
    if (!got.error) missed.push(what + ' was read');
    else if (!want.test(got.error)) missed.push(what + ' was refused for the wrong reason: ' + got.error);
  }
  if (missed.length) fail('the negative controls', missed.join('; '));
  else ok('the negative controls', refusals.map(r => r[0]).join(', ') + ': each refused, and for its own reason');
}

// ---- 3. Info-ZIP and ditto --------------------------------------------------
{
  const have = cmd => { try { execFileSync('which', [cmd], {stdio: 'ignore'}); return true; } catch (e) { return false; } };
  const src = join(TMP, 'src'), folder = join(src, 'Folder ƒ');
  mkdirSync(join(folder, 'inner'), {recursive: true});
  const noise = Buffer.from(Array.from({length: 40000}, (_, i) => (i * 2654435761 >>> 13) & 0xFF));
  const text = Buffer.from('Cythera: Fate of Alaric. '.repeat(2000));
  writeFileSync(join(folder, 'noise'), noise);
  writeFileSync(join(folder, 'inner', 'text.txt'), text);
  writeFileSync(join(folder, 'empty'), Buffer.alloc(0));
  writeFileSync(join(folder, 'Café save'), text.subarray(0, 9000));
  const base = [
    {path: 'Folder ƒ/noise', data: noise}, {path: 'Folder ƒ/inner/text.txt', data: text},
    {path: 'Folder ƒ/empty', data: Buffer.alloc(0)}, {path: 'Folder ƒ/Café save', data: text.subarray(0, 9000)},
  ];
  if (!have('zip')) skip('Info-ZIP', 'no zip on this machine');
  else {
    let good = true;
    for (const flag of ['-0', '-6', '-9']) {
      const out = join(TMP, `infozip${flag}.zip`);
      execFileSync('zip', ['-q', '-r', '-X', flag, out, 'Folder ƒ'], {cwd: src});
      if (!expectFiles('Info-ZIP ' + flag, readFileSync(out), base)) good = false;
    }
    if (good) ok('Info-ZIP', 'stored, level 6 and level 9, with folders, an empty file and a non-ASCII name');
  }
  if (!have('ditto') || !have('xattr')) skip('ditto', 'no ditto on this machine, so no __MACOSX from Apple');
  else {
    const rsrc = Buffer.from(Array.from({length: 3000}, (_, i) => (i * 31) & 0xFF));
    writeFileSync(join(folder, 'Café save', '..namedfork', 'rsrc'), rsrc);
    execFileSync('xattr', ['-wx', 'com.apple.FinderInfo', '44656C50 44656C76' + ' 0000'.repeat(12), join(folder, 'Café save')]);
    const out = join(TMP, 'ditto.zip');
    execFileSync('ditto', ['-c', '-k', '--sequesterRsrc', '--keepParent', folder, out]);
    const want = base.map(w => w.path === 'Folder ƒ/Café save' ? {...w, rsrc, type: 'DelP', creator: 'Delv'} : w);
    if (expectFiles('ditto', readFileSync(out), want))
      ok('ditto', 'the Finder’s own container, a resource fork and a Finder type out of __MACOSX, UTF-8 names without the flag');
  }
}

// ---- 4. the add-on, against unar --------------------------------------------
{
  const addon = join(refDir, 'community', 'addons', '616_Rocky_the_Flying_Chicken.zip');
  let haveUnar = true;
  try { execFileSync('unar', ['-v'], {stdio: 'ignore'}); } catch (e) { haveUnar = false; }
  if (!existsSync(addon)) skip('the add-on', 'no ' + addon);
  else {
    const bytes = readFileSync(addon);
    sandbox.__z = new Uint8Array(bytes);
    const opened = ev(`(() => { try { const x = extractDelverArchive(__z); return {via: x.via, name: x.forks.name, type: x.forks.type, creator: x.forks.creator, player: x.info.player, data: x.bytes, rsrc: x.forks.rsrc}; } catch (e) { return {error: e.message}; } })()`);
    if (opened.error) fail('the add-on', 'extractDelverArchive refused it: ' + opened.error);
    else if (opened.via !== 'zip archive' || opened.type !== 'DelP' || opened.creator !== 'Delv' || !opened.player)
      fail('the add-on', `opened as ${JSON.stringify({via: opened.via, name: opened.name, type: opened.type, creator: opened.creator, player: opened.player})}`);
    else if (!haveUnar) ok('the add-on', `"${opened.name}" opens as a saved game; unar is not installed, so not compared`);
    else {
      const out = join(TMP, 'unar');
      execFileSync('unar', ['-q', '-f', '-o', out, addon], {stdio: 'ignore'});
      const got = readAll(bytes).filter(g => g.path.startsWith('Rocky the Flying Chicken!/Rocky'));
      const want = got.map(g => {
        const f = join(out, g.path);
        return {path: g.path, data: readFileSync(f), rsrc: readFileSync(join(f, '..namedfork', 'rsrc')), type: 'DelP', creator: 'Delv'};
      });
      const openedOne = want.find(w => w.path.endsWith('/' + opened.name));
      if (want.length !== 2) fail('the add-on', `found ${want.length} saves in it, not two`);
      else if (!openedOne || !same(opened.data, openedOne.data) || !same(opened.rsrc, openedOne.rsrc))
        fail('the add-on', 'what extractDelverArchive handed back is not what unar extracts');
      else if (expectFiles('the add-on', bytes, [...want, ...readAll(bytes).filter(g => !want.some(w => w.path === g.path)).map(g => ({path: g.path, data: readFileSync(join(out, g.path))}))]))
        ok('the add-on', `both saves in ${addon.split('/').pop()}, data and resource fork, byte identical to unar, and "${opened.name}" opens as ${opened.player}`);
    }
  }

  const named = [
    ['618_Teleporter.sitx', /StuffIt X/],
    ['608_Cythera_Makeover.sea', /Compact Pro self-extracting/],
  ];
  const addons = join(refDir, 'community', 'addons');
  const present = named.filter(([f]) => existsSync(join(addons, f)));
  if (!present.length) skip('the formats named instead of opened', 'the add-ons are not here');
  else {
    const wrong = [];
    for (const [f, want] of present) {
      sandbox.__z = new Uint8Array(readFileSync(join(addons, f)));
      const msg = ev(`(() => { try { extractDelverArchive(__z); return 'opened'; } catch (e) { return e.message; } })()`);
      if (!want.test(msg) || /Cythera application/.test(msg)) wrong.push(f + ': ' + msg);
    }
    if (wrong.length) fail('the formats named instead of opened', wrong.join('; '));
    else ok('the formats named instead of opened', present.map(([f]) => f).join(' and '));
  }
}

rmSync(TMP, {recursive: true, force: true});
console.log(failures ? `\n${failures} failure(s)` : `\n  ${entriesChecked} zip entries read back byte identical`);
process.exit(failures ? 1 : 0);
