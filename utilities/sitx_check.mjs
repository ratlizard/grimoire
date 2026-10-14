#!/usr/bin/env node
// Does the StuffIt X reader hand back what is in the archive?
//
//   node utilities/sitx_check.mjs [index.html] [reference dir] [more .sitx files or folders...]
//
// WHY. js/mac-stuffitx.js is a port, of The Unarchiver's XADMaster, and the
// only other implementation there is is `unar`, the same code. So holding
// the port to `unar` shows it faithful, not the format understood: a bug
// the two share would pass. What does not come from that code is the
// archive's own word -- every data element carries the CRC-32 of what it
// holds, which the reader checks as it decompresses -- and the dictionary's,
// whose CRC-32 and word count XADMaster states. So this checks three things:
//
// 1. Every fork of every archive given, by the page's own extractor, byte
//    for byte against what `unar` extracts (resource forks through
//    ..namedfork/rsrc), and each stream against its stored CRC-32 (the
//    reader throws when one differs). The three add-ons that are StuffIt X,
//    Teleporter, Tree and Zone, are the corpus here; more archives can be
//    named on the command line -- StarGrimoire's EV Nova plug-ins are where
//    Cyanide and the English preprocessing were first held to `unar`.
// 2. The English dictionary, js/mac-stuffitx-english.js: a CRC-32 of
//    0xFB1DCFD5 over its 881,863 bytes and 100,366 words, as XADMaster's
//    StuffItXEnglishHandle.m states.
// 3. extractDelverArchive opens the three saved games, each as `unar`
//    extracts it, data and resource fork.
// 4. StuffIt X's Deflate, which none of the add-ons uses: RFC 1951 with the
//    count of distance codes in six bits, not five (XADMaster's
//    XADStuffItXDeflateVariant). A stream Node's zlib writes, its count
//    widened by a bit, must inflate to what zlib was given with six bits
//    and must not with five. StarGrimoire holds a real one to `unar`.
//
// THE NEGATIVE CONTROLS. A byte changed in a compressed stream must be
// refused (the CRC-32, or the decoder itself), not handed back; a
// dictionary a word short must be refused; and an archive whose
// compression this page does not read must say which.

import {readFileSync, existsSync, mkdtempSync, rmSync, readdirSync, statSync} from 'node:fs';
import {join, basename} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', refDir = 'reference', ...more] = process.argv.slice(2);
let failures = 0, forksChecked = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);
const skip = (what, why) => console.log(`  skip ${what}: ${why}`);

const {sandbox} = makeSandbox();
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);
for (const name of ['looksLikeStuffItX', 'parseStuffItXArchive', 'stuffItXFork', 'extractDelverArchive'])
  if (ev(`typeof ${name}`) !== 'function') { console.error(`FAIL the page: ${name} is not defined`); process.exit(1); }
const english = readFileSync(new URL('../js/mac-stuffitx-english.js', import.meta.url), 'utf8');
const crcOf = bytes => { sandbox.__b = bytes; return ev('crc32(__b)'); };

// ---- 2. the dictionary, before it is loaded into the page ----------------
{
  const sb = vm.createContext({});
  new vm.Script(english + '\n;globalThis.__w = STUFFITX_ENGLISH_WORDS;').runInContext(sb);
  const words = sb.__w, bytes = Uint8Array.from(words, c => c.charCodeAt(0));
  const crc = crcOf(bytes), count = words.split('\n').length - 1;
  if (crc !== 0xFB1DCFD5 || bytes.length !== 881863 || count !== 100366)
    fail('the English dictionary', `CRC-32 ${crc.toString(16)}, ${bytes.length} bytes, ${count} words`);
  else ok('the English dictionary', '881,863 bytes, CRC-32 fb1dcfd5, 100,366 words, as XADMaster states');
  // a dictionary a word short must not be taken
  const short = vm.createContext(sandbox);
  void short;
  ev(`SITX_ENGLISH_TABLE = null;`);
  sandbox.STUFFITX_ENGLISH_WORDS = words.split('\n').slice(1).join('\n');
  const msg = ev(`(() => { try { sitxEnglishTable(); return 'taken'; } catch (e) { return e.message; } })()`);
  if (!/not the one StuffIt uses/.test(msg)) fail('a dictionary a word short', msg);
  else ok('a dictionary a word short', 'refused');
  ev(`SITX_ENGLISH_TABLE = null;`);
  new vm.Script(english).runInContext(ctx);
}

// ---- 1. every fork against unar --------------------------------------------
const haveUnar = (() => { try { execFileSync('unar', ['-v'], {stdio: 'ignore'}); return true; } catch (e) { return false; } })();
const addons = join(refDir, 'community', 'addons');
const corpus = [];
if (existsSync(addons)) for (const f of readdirSync(addons).sort()) if (/\.sitx$/i.test(f)) corpus.push(join(addons, f));
for (const m of more) {
  if (statSync(m).isDirectory()) { for (const f of readdirSync(m).sort()) if (/\.sitx$/i.test(f)) corpus.push(join(m, f)); }
  else corpus.push(m);
}
const TMP = mkdtempSync(join(tmpdir(), 'sitx-check-'));
const same = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;
const methods = new Set();
if (!corpus.length) skip('the archives', 'no .sitx here');
else if (!haveUnar) skip('the archives', 'no unar (brew install unar)');
else {
  let archives = 0;
  const unread = [];
  for (const file of corpus) {
    sandbox.__z = new Uint8Array(readFileSync(file));
    let entries;
    try { entries = JSON.parse(ev(`JSON.stringify(parseStuffItXArchive(__z).entries.map(e => ({ path: e.path, folder: e.isFolder, data: e.dataLen, rsrc: e.rsrcLen })))`)); }
    catch (e) { unread.push(`${basename(file)} (${e.message})`); continue; }
    const out = join(TMP, String(archives));
    try { execFileSync('unar', ['-q', '-f', '-D', '-o', out, file], {stdio: 'ignore'}); } catch (e) { /* what unar does extract is compared */ }
    for (const [i, e] of entries.entries()) {
      if (e.folder) continue;
      for (const which of ['data', 'rsrc']) {
        if (!e[which]) continue;
        let got;
        try { got = ev(`(() => { const a = parseStuffItXArchive(__z); return stuffItXFork(__z, a.entries[${i}], '${which}'); })()`); }
        catch (er) { fail(`${basename(file)}: ${e.path} ${which}`, er.message); continue; }
        const ref = join(out, e.path) + (which === 'rsrc' ? '/..namedfork/rsrc' : '');
        if (!existsSync(ref)) { fail(`${basename(file)}: ${e.path} ${which}`, 'unar did not extract it'); continue; }
        if (!same(got, readFileSync(ref))) fail(`${basename(file)}: ${e.path} ${which}`, `${got.length} bytes, not what unar extracts (${statSync(ref).size})`);
        else forksChecked++;
      }
    }
    for (const line of execFileSync('lsar', ['-L', file]).toString().split('\n')) { const m = /Compression type:\s*(.+)/.exec(line); if (m) methods.add(m[1].trim()); }
    archives++;
  }
  ok('the archives', `${forksChecked} fork(s) in ${archives} archive(s) byte identical to unar, each stream to its CRC-32; ${[...methods].sort().join(', ')}${unread.length ? '; not read: ' + unread.join('; ') : ''}`);
}

// ---- the negative controls -------------------------------------------------
const tele = join(addons, '618_Teleporter.sitx');
if (!existsSync(tele)) skip('a byte changed', 'the Teleporter add-on is not here');
else {
  const bytes = new Uint8Array(readFileSync(tele));
  sandbox.__z = bytes;
  const where = ev(`(() => { const a = parseStuffItXArchive(__z); const e = a.entries.find(x => x.dataLen > 100000); const el = e.sitx.elements.get(e.sitx.forks.data.stream); return el.dataoffset; })()`);
  const broken = bytes.slice();
  broken[where + 200] ^= 0x10;
  sandbox.__z = broken;
  const msg = ev(`(() => { try { const a = parseStuffItXArchive(__z); stuffItXFork(__z, a.entries.find(x => x.dataLen > 100000), 'data'); return 'handed back'; } catch (e) { return e.message; } })()`);
  if (msg === 'handed back') fail('a byte changed in a compressed stream', 'the fork was handed back');
  else ok('a byte changed in a compressed stream', 'refused: ' + msg);
  // a method this page does not read, named: the Teleporter's stream said to be Darkhorse
  sandbox.__z = bytes;
  const named = ev(`(() => { const a = parseStuffItXArchive(__z); const e = a.entries.find(x => x.dataLen > 100000); const el = e.sitx.elements.get(e.sitx.forks.data.stream); el.alglist[0] = 2; el.decoded = null; try { stuffItXFork(__z, e, 'data'); return 'handed back'; } catch (er) { return er.message; } })()`);
  if (!/Darkhorse/.test(named)) fail('a method not read', named);
  else ok('a method not read', named);
}

// ---- 4. StuffIt X's Deflate, a count of distance codes in six bits -----------
{
  const text = readFileSync(new URL(import.meta.url));
  const raw = zlib.deflateRawSync(text, {level: 9});
  const bit = i => (raw[i >> 3] >> (i & 7)) & 1;
  if (bit(0) !== 1 || bit(1) + 2 * bit(2) !== 2) fail('StuffIt X\'s Deflate', 'zlib did not write one dynamic block to widen');
  else {
    // the bits as they are, with a 0 after the five of the distance count (bits 8 to 12): its sixth, high bit
    const n = raw.length * 8, wide = new Uint8Array(raw.length + 1);
    for (let i = 0, o = 0; i < n; i++, o++) {
      if (i === 13) o++;
      wide[o >> 3] |= bit(i) << (o & 7);
    }
    sandbox.__w = wide; sandbox.__n = text.length;
    const six = ev(`(() => { try { return inflateRaw(__w, __n, 8, 6); } catch (e) { return e.message; } })()`);
    const five = ev(`(() => { try { return inflateRaw(__w, __n, 8, 5); } catch (e) { return e.message; } })()`);
    if (typeof six === 'string' || !same(six, text)) fail('StuffIt X\'s Deflate', 'six bits: ' + (typeof six === 'string' ? six : 'not what zlib was given'));
    else if (typeof five !== 'string' && same(five, text)) fail('StuffIt X\'s Deflate', 'read with five bits all the same: the width is not what is tested');
    else ok('StuffIt X\'s Deflate', `a zlib stream of ${text.length} bytes, its distance count widened to six bits, inflates with six and not with five`);
  }
}

// ---- 3. the saves, through extractDelverArchive ------------------------------
const saves = ['618_Teleporter.sitx', '619_Tree.sitx', '620_Zone.sitx'].map(f => join(addons, f)).filter(existsSync);
if (!saves.length) skip('the saved games', 'the add-ons are not here');
else if (!haveUnar) skip('the saved games', 'no unar');
else {
  const opened = [];
  for (const file of saves) {
    sandbox.__z = new Uint8Array(readFileSync(file));
    const got = ev(`(() => { try { const f = extractDelverArchive(__z); return { name: f.forks.name, path: f.via, data: f.bytes, rsrc: f.forks.rsrc, type: f.forks.type }; } catch (e) { return { error: e.message }; } })()`);
    if (got.error) { fail(basename(file), got.error); continue; }
    const out = join(TMP, 'save-' + basename(file));
    execFileSync('unar', ['-q', '-f', '-D', '-o', out, file], {stdio: 'ignore'});
    const find = d => { for (const f of readdirSync(d, {recursive: true})) if (basename(String(f)) === got.name && statSync(join(d, String(f))).isFile()) return join(d, String(f)); return null; };
    const ref = find(out);
    if (!ref) fail(basename(file), `unar has no ${got.name}`);
    else if (!same(got.data, readFileSync(ref)) || !same(got.rsrc, readFileSync(ref + '/..namedfork/rsrc'))) fail(basename(file), `${got.name} is not what unar extracts`);
    else opened.push(`${got.name} (${got.type})`);
  }
  if (opened.length === saves.length) ok('the saved games', `${opened.join(', ')}, through extractDelverArchive, data and resource fork as unar extracts them`);
}

rmSync(TMP, {recursive: true, force: true});
console.log(failures ? `\n${failures} failure(s)` : `\n  ${forksChecked} StuffIt X fork(s) read back byte identical`);
process.exit(failures ? 1 : 0);
