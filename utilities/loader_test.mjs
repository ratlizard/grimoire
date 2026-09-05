#!/usr/bin/env node
// Exercises the viewer's archive-opening path: the BinHex 4.0 decoder, the
// MacBinary / AppleSingle / AppleDouble unwrappers, the "is this actually a
// Delver archive" test, and the messages produced when it is not.
//
//   python3 utilities/binhex_decode.py "reference/game/Cythera Data.hqx" "$TMPDIR"
//   node utilities/loader_test.mjs index.html \
//        "reference/game/Cythera Data.hqx" "$TMPDIR/Cythera Data.data" \
//        "$TMPDIR/Cythera Data.rsrc" "reference/game/Cythera.hqx" \
//        reference/game/installers/Cythera.bin
//
// The last argument, the installer, is optional; with it the check also
// drives the path the page takes by default now -- the whole game arriving
// as one MacBinary of the Installer VISE application -- through
// extractDelverArchive, ingestArchiveFile and loadDefaultArchive.
//
// The forks written by binhex_decode.py are the reference: the JS decoder has
// to reproduce them byte for byte, which is the whole point of porting it.

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {pageSource} from './page_scripts.mjs';
import {makeSandbox} from './dom_stub.mjs';
import { createHash } from 'node:crypto';

const [htmlPath, hqxPath, dataPath, rsrcPath, appHqxPath, visePath] = process.argv.slice(2);
import { existsSync } from 'node:fs';
if (!htmlPath || !hqxPath || !dataPath) {
  console.error('usage: loader_test.mjs <viewer.html> <Cythera Data.hqx> <Cythera Data.data> [<.rsrc>] [<Cythera.hqx>]');
  process.exit(2);
}

const html = readFileSync(htmlPath, 'utf8');
const js = pageSource(htmlPath);

// ---- minimal DOM so the top-level script body can be evaluated -------------
// The stub lives in dom_stub.mjs; see the header there for why it has a canvas.
// Ids are memoised here: this check sets a value on an element and expects the
// page to read the same element back.
const {sandbox} = makeSandbox();
const ctx = vm.createContext(sandbox);
// Top-level const/let are not properties of the vm global; reach them through
// an eval defined inside that scope.
const epilogue = '\n;window.__peek = function(n){ return eval(n); };\n';
try {
  new vm.Script(js + epilogue, { filename: htmlPath }).runInContext(ctx);
} catch (e) {
  console.error('FATAL: script body threw while loading: ' + e.message);
  process.exit(1);
}
const peek = n => ctx.__peek(n);

let failures = 0;
const h = b => createHash('sha256').update(Buffer.from(b)).digest('hex').slice(0, 16);
function check(name, cond, detail) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) failures++;
}

// ---- 1. BinHex, against the Python reference forks -------------------------
const hqx = new Uint8Array(readFileSync(hqxPath));
const refData = new Uint8Array(readFileSync(dataPath));
const refRsrc = rsrcPath ? new Uint8Array(readFileSync(rsrcPath)) : null;

check('looksLikeBinHex accepts the .hqx', peek('looksLikeBinHex')(hqx));
check('looksLikeBinHex rejects a decoded fork', !peek('looksLikeBinHex')(refData));

const t0 = Date.now();
const forks = peek('binhexSplitForks')(peek('binhexDecode')(hqx));
const ms = Date.now() - t0;
check('name/type/creator', forks.name === 'Cythera Data' && forks.type === 'DelS' && forks.creator === 'Delv',
      `${forks.name} / ${forks.type} / ${forks.creator}`);
check('data fork length', forks.data.length === refData.length, `${forks.data.length} vs ${refData.length}`);
check('data fork bytes', h(forks.data) === h(refData), h(forks.data));
if (refRsrc) {
  check('rsrc fork length', forks.rsrc.length === refRsrc.length, `${forks.rsrc.length} vs ${refRsrc.length}`);
  check('rsrc fork bytes', h(forks.rsrc) === h(refRsrc), h(forks.rsrc));
}
console.log(`  (decoded ${(hqx.length/1048576).toFixed(1)} MB of BinHex in ${ms} ms)`);

// ---- 2. The 0x90 run-length cases, which real archives exercise rarely -----
// Hand-built vectors: a literal 0x90, a run, and a run at the very end.
function rleOnly(bytes) {
  // Re-encode as BinHex so the decoder's own front end is used end to end.
  const ALPHA = peek('HQX_ALPHA');
  let bits = '', out = ':';
  for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  while (bits.length % 6) bits += '0';
  for (let i = 0; i < bits.length; i += 6) out += ALPHA[parseInt(bits.slice(i, i + 6), 2)];
  return new TextEncoder().encode(out + ':');
}
const dec = peek('binhexDecode');
const cases = [
  [[0x41, 0x90, 0x00, 0x42], [0x41, 0x90, 0x42], 'literal 0x90'],
  [[0x41, 0x90, 0x04], [0x41, 0x41, 0x41, 0x41], 'run of 4'],
  [[0x01, 0x02, 0x90, 0x03, 0x04], [0x01, 0x02, 0x02, 0x02, 0x04], 'run mid-stream'],
];
for (const [enc, want, label] of cases) {
  const got = Array.from(dec(rleOnly(enc))).slice(0, want.length);
  check('RLE ' + label, JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
}

// ---- 3. Recognising the archive -------------------------------------------
const describe = peek('describeDelverArchive');
const d = describe(refData);
check('data fork is a Delver archive', d.ok && d.populated === 34, `${d.populated} subindexes, title "${d.title}"`);
check('title', d.title === 'Cythera: Fate of Alaric', d.title);
check('rsrc fork is rejected', refRsrc ? !describe(refRsrc).ok : true,
      refRsrc ? describe(refRsrc).reason : 'skipped');
check('raw BinHex ASCII is rejected', !describe(hqx).ok, describe(hqx).reason);
check('a short buffer is rejected', !describe(new Uint8Array(64)).ok);
check('the scenario carries no saved-game name', d.player === '', JSON.stringify(d.player));

// The test is structural, not a count -- see the comment above
// describeDelverArchive. One populated subindex is enough, and one stray
// entry is too many. Both are made from the real file so that the rest of
// the header is exactly what the game writes.
{
  const mi = peek('delverMasterIndexExtent')(refData);
  const populatedAt = [];
  for (let i = 0; i < mi.count; i++) {
    const p = mi.first + i * 8;
    if (refData[p] | refData[p + 1] | refData[p + 2] | refData[p + 3]) populatedAt.push(p);
  }
  const one = Uint8Array.from(refData);
  for (const p of populatedAt.slice(1)) one.fill(0, p, p + 8);
  const d1 = describe(one);
  check('one populated subindex is enough', d1.ok && d1.populated === 1, d1.ok ? d1.populated + ' subindex' : d1.reason);
  const stray = Uint8Array.from(refData);
  new DataView(stray.buffer).setUint32(populatedAt[1], stray.length);   // an offset past the end
  const d2 = describe(stray);
  check('a master index entry outside the file is rejected', !d2.ok && /master index entry/.test(d2.reason), d2.reason);
  const strayRes = Uint8Array.from(refData);
  const dv = new DataView(strayRes.buffer);
  const sub0 = dv.getUint32(populatedAt[0]);
  let slot = sub0;                                                        // the subindex's first resource
  while (!dv.getUint32(slot) && slot < sub0 + 2048) slot += 8;
  dv.setUint32(slot, strayRes.length);
  const d3 = describe(strayRes);
  check('a resource entry outside the file is rejected', !d3.ok && /outside the file/.test(d3.reason), d3.reason);
}

// ---- 4. extractDelverArchive: unwrapping and legible refusals --------------
const extract = peek('extractDelverArchive');
const viaRaw = extract(refData);
check('raw fork passes through', viaRaw.via === 'data fork' && viaRaw.bytes.length === refData.length);
const viaHqx = extract(hqx);
check('.hqx is unwrapped', viaHqx.via === 'BinHex 4.0 data fork' && h(viaHqx.bytes) === h(refData), viaHqx.via);

// MacBinary wrapper around the real fork.
function macbinary(name, type, creator, data) {
  const pad = n => (n + 127) & ~127;
  const out = new Uint8Array(128 + pad(data.length));
  out[1] = name.length;
  for (let i = 0; i < name.length; i++) out[2 + i] = name.charCodeAt(i);
  for (let i = 0; i < 4; i++) { out[65 + i] = type.charCodeAt(i); out[69 + i] = creator.charCodeAt(i); }
  const dv = new DataView(out.buffer);
  dv.setUint32(83, data.length);
  out.set(data, 128);
  return out;
}
const mb = extract(macbinary('Cythera Data', 'DelS', 'Delv', refData));
check('MacBinary is unwrapped', mb.via === 'MacBinary data fork' && h(mb.bytes) === h(refData), mb.via);

// AppleSingle wrapper.
function applesingle(data) {
  const out = new Uint8Array(26 + 12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, 0x00051600); dv.setUint32(4, 0x00020000);
  dv.setUint16(24, 1);
  dv.setUint32(26, 1); dv.setUint32(30, 38); dv.setUint32(34, data.length);
  out.set(data, 38);
  return out;
}
const as = extract(applesingle(refData));
check('AppleSingle is unwrapped', as.via === 'AppleSingle data fork' && h(as.bytes) === h(refData), as.via);

function refusal(bytes, label) {
  try { extract(bytes); return { threw: false, msg: '(accepted!)' }; }
  catch (e) { return { threw: true, msg: e.message }; }
}
const r1 = refusal(new TextEncoder().encode('<html>not an archive at all</html>'));
check('plain junk is refused', r1.threw && /Not a Delver archive/.test(r1.msg), r1.msg.slice(0, 90));
if (refRsrc) {
  const r2 = refusal(refRsrc);
  check('a bare resource fork is refused', r2.threw, r2.msg.slice(0, 90));
}
if (appHqxPath) {
  const appHqx = new Uint8Array(readFileSync(appHqxPath));
  const r3 = refusal(appHqx);
  check('the application .hqx is refused by name', r3.threw && /APPL|application/.test(r3.msg), r3.msg.slice(0, 140));
}

// ---- 5. Deep links ---------------------------------------------------------
const parseDeepLink = peek('parseDeepLink');
const trials = [
  ['#c=141&r=8D02', { c: '141', r: '8D02' }],
  ['#c=CHARACTERS', { c: 'CHARACTERS' }],
  ['#8D02', { r: '8D02' }],
  ['#0x8D02', { r: '8D02' }],
  ['', null],
];
for (const [hash, want] of trials) {
  ctx.location.hash = hash;
  const got = parseDeepLink();
  check('deep link ' + (hash || '(empty)'), JSON.stringify(got) === JSON.stringify(want), JSON.stringify(got));
}
ctx.location.hash = '';

// ---- 6. the load path itself -----------------------------------------------
// Every check above calls extractDelverArchive or parseArchiveBytes directly.
// Nothing ran loadDefaultArchive, and that is how setStatus() -- which only the
// loading and failure paths call -- could be deleted outright and leave every
// check passing while the page threw before it could load anything at all.
{
  // fetch rejects in this sandbox, so every candidate URL fails and the run has
  // to end in archiveLoadFailed. What matters is that it gets there without
  // throwing, and says what it tried.
  let threw = null;
  try { await peek('loadDefaultArchive')(); }
  catch (e) { threw = e; }
  check('loadDefaultArchive survives a total failure', !threw, threw ? threw.message : 'reported cleanly');

  const out = ctx.document.getElementById('output').textContent || '';
  check('it says what it tried', /Tried, in order/.test(out) && /Cythera Data/.test(out),
        out.split('\n')[0] || '(nothing)');
  const status = ctx.document.getElementById('sourceStatus').textContent || '';
  check('the status line was written', /No archive loaded/.test(status), status.slice(0, 60) || '(empty)');

  // ---- and the path that has to work: the default URL serves a .hqx --------
  // The page used to fetch the bare data fork. It now fetches the BinHex, so
  // the archive arrives wrapped and has to be unwrapped by the page rather
  // than by whoever committed the file -- and the resource fork, which a bare
  // data fork cannot carry, comes with it. That is what makes the stamps and
  // brushes decode on a first visit, so it is worth a check rather than an
  // assumption.
  const served = [];
  ctx.fetch = async (url) => {
    served.push(url);
    if (!/\.hqx$/i.test(url)) throw new Error('not here');
    return { ok: true, status: 200, headers: { get: () => String(hqx.length) },
             arrayBuffer: async () => hqx.buffer.slice(hqx.byteOffset, hqx.byteOffset + hqx.length),
             body: null };
  };
  peek('resetDerivedCaches')();
  let threw3 = null;
  try { await peek('loadDefaultArchive')(); }
  catch (e) { threw3 = e; }
  check('the default URL loads when it serves a .hqx', !threw3 && peek('fileBytes') !== null,
        threw3 ? threw3.message : `${served.length} candidate(s) tried`);
  check('the archive came out of the BinHex intact',
        peek('fileBytes') && h(peek('fileBytes')) === h(refData), h(peek('fileBytes') || []));
  const fork = ctx.window.CYTHERA_RSRC;
  check('and the resource fork came with it', !!(fork && fork.typeList && fork.typeList.length),
        fork && fork.typeList
          ? `${fork.typeList.length} types, ${fork.typeList.reduce((a, t) => a + t.count, 0)} resources`
          : 'none');

  // And the same for a file the user picks that turns out not to be an archive.
  let threw2 = null;
  try { await peek('ingestArchiveFile')({ name: 'junk.bin', size: 9, arrayBuffer: async () => new Uint8Array(9).buffer }); }
  catch (e) { threw2 = e; }
  check('a rejected file reports rather than throwing', !threw2, threw2 ? threw2.message : 'reported cleanly');
}

// ---- 6b. the installer -----------------------------------------------------
// The page's default input is the installer, so the whole path is driven
// here: the unwrap picks the archive out and says where it came from; a
// dropped installer opens the archive, keeps the installer and opens the
// application's fork out of it; the default URL serving the installer loads
// it; and what gets remembered is the installer itself, so a return visit
// gets every file back rather than the archive alone.
if (visePath) {
  const vise = new Uint8Array(readFileSync(visePath));
  const fromInstaller = extract(vise);
  check('the installer is unwrapped to the archive',
        /Installer VISE/.test(fromInstaller.via) && h(fromInstaller.bytes) === h(refData), fromInstaller.via);
  check('and the archive keeps its own Finder identity',
        fromInstaller.forks && fromInstaller.forks.name === 'Cythera Data' &&
        fromInstaller.forks.type === 'DelS' && fromInstaller.forks.creator === 'Delv',
        fromInstaller.forks ? `${fromInstaller.forks.name} ${fromInstaller.forks.type}/${fromInstaller.forks.creator}` : 'no forks');
  check('the resource fork came with it',
        fromInstaller.forks && fromInstaller.forks.rsrc && fromInstaller.forks.rsrc.length === (refRsrc ? refRsrc.length : fromInstaller.forks.rsrc.length),
        fromInstaller.forks ? String(fromInstaller.forks.rsrc.length) : 'none');
  check('the installer itself is handed back', !!fromInstaller.installer && fromInstaller.installer.archive.entries.length === 48,
        fromInstaller.installer ? `${fromInstaller.installer.archive.entries.length} files, CRC ${fromInstaller.installer.crcOk ? 'ok' : 'BAD'}` : 'missing');

  // Dropped on the page.
  let stored = null;
  ctx.indexedDB = undefined;
  const idbPut = peek('archiveCachePut');
  ctx.window.APP_RSRC = null;
  peek('resetDerivedCaches')();
  let threwI = null;
  try { await peek('ingestArchiveFile')({ name: 'Cythera.bin', size: vise.length, arrayBuffer: async () => vise.buffer.slice(vise.byteOffset, vise.byteOffset + vise.length) }); }
  catch (e) { threwI = e; }
  check('a dropped installer opens', !threwI && peek('fileBytes') && h(peek('fileBytes')) === h(refData), threwI ? threwI.message : 'opened');
  check('the archive is called by its own name, not the installer’s',
        ctx.window.ARCHIVE_SOURCE_NAME === 'Cythera Data', String(ctx.window.ARCHIVE_SOURCE_NAME));
  check('the installer is kept for the Data › Installer tab',
        !!ctx.window.INSTALLER && ctx.window.INSTALLER.archive.entries.length === 48 && ctx.window.INSTALLER.sourceName === 'Cythera.bin');
  const appFork = ctx.window.APP_RSRC;
  check('the application’s resource fork is open without a second fetch',
        !!(appFork && appFork.typeList && appFork.typeList.length > 40),
        appFork && appFork.typeList ? `${appFork.typeList.length} types` : 'not open: ' + (ctx.window.APP_RSRC_STATE || '(no reason recorded)'));
  const status = ctx.document.getElementById('sourceStatus').textContent || '';
  check('the status line says where it came from', /Installer VISE/.test(status) && /47 other files/.test(status), status.slice(0, 120));

  // Through the default URL: archive.org's four-in-one StuffIt archive, when
  // it is beside the .bin, else the .bin itself standing in for it.
  const sitPath = visePath.replace(/[^/]*$/, 'Cythera installers (archive.org).sit');
  const served = existsSync(sitPath) ? new Uint8Array(readFileSync(sitPath)) : vise;
  ctx.fetch = async (url) => {
    if (!/archive\.org\/cors\/cythera-installers\//i.test(url)) throw new Error('not here');
    return { ok: true, status: 200, headers: { get: () => String(served.length) },
             arrayBuffer: async () => served.buffer.slice(served.byteOffset, served.byteOffset + served.length), body: null };
  };
  ctx.window.INSTALLER = null;
  peek('resetDerivedCaches')();
  let threwU = null;
  try { await peek('loadDefaultArchive')(); }
  catch (e) { threwU = e; }
  check('the default URL loads when it serves the installer' + (served === vise ? ' (.bin standing in for the .sit)' : ' as StuffIt 5'),
        !threwU && peek('fileBytes') && h(peek('fileBytes')) === h(refData), threwU ? threwU.message : 'loaded');
  check('the default URL is archive.org’s CORS path', /^https:\/\/archive\.org\/cors\//.test(peek('DEFAULT_ARCHIVE_URL')), peek('DEFAULT_ARCHIVE_URL'));
  if (served !== vise) {
    const st = ctx.document.getElementById('sourceStatus').textContent || '';
    check('and the status line names the StuffIt archive and the versions', /StuffIt 5 archive/.test(st) && /4 versions/.test(st), st.slice(0, 160));
    check('the newest installer was opened', ctx.window.INSTALLER && ctx.window.INSTALLER.picked === 'Cythera 1.0.4 Installer',
          ctx.window.INSTALLER ? ctx.window.INSTALLER.picked : 'no installer');
    // Switch to 1.0.2 from the bytes in hand: a different archive, no fetch.
    // (1.0.2, not 1.0.3: the 1.0.4 patch changed only the application, and
    // 1.0.3's Cythera Data is the same bytes as 1.0.4's.)
    let fetched = 0;
    ctx.fetch = async () => { fetched++; throw new Error('should not fetch'); };
    peek('switchInstaller')('Cythera 1.0.2 Installer');
    check('switching version opens the other archive without a fetch',
          ctx.window.INSTALLER && ctx.window.INSTALLER.picked === 'Cythera 1.0.2 Installer' && h(peek('fileBytes')) !== h(refData) && fetched === 0,
          `${ctx.window.INSTALLER && ctx.window.INSTALLER.picked}, ${fetched} fetches; raw ${ctx.window.INSTALLER && ctx.window.INSTALLER.raw ? ctx.window.INSTALLER.raw.length : 'none'}; last error "${peek('lastArchiveError')}"; status "${(ctx.document.getElementById('sourceStatus').textContent || '').slice(-90)}"`);
    check('and the archive is still called Cythera Data', ctx.window.ARCHIVE_SOURCE_NAME === 'Cythera Data', String(ctx.window.ARCHIVE_SOURCE_NAME));
    peek('switchInstaller')('Cythera 1.0.4 Installer');
    check('and back again is byte-identical to the .hqx', h(peek('fileBytes')) === h(refData));
  }

  // An installer that is not Cythera's: the catalog reads, there is no
  // 'DelS' file, and the refusal says so.
  const notOurs = new Uint8Array(vise);
  {
    // Flip the archive entry's type in the MacBinary's data fork: 'DelS' -> 'XelS'.
    const dataStart = 128;
    const arc = fromInstaller.installer.archive;
    const cat = arc.catalogOffset;
    // find the FVCT record for the archive by scanning for 'DelS' followed by 'Delv' after the catalog
    let at = -1;
    for (let i = dataStart + cat; i < notOurs.length - 8; i++) {
      if (notOurs[i] === 0x44 && notOurs[i+1] === 0x65 && notOurs[i+2] === 0x6C && notOurs[i+3] === 0x53 &&
          notOurs[i+4] === 0x44 && notOurs[i+5] === 0x65 && notOurs[i+6] === 0x6C && notOurs[i+7] === 0x76) { at = i; break; }
    }
    if (at > 0) notOurs[at] = 0x58;
    const r = refusal(notOurs);
    check('an installer without the archive is refused by name', at > 0 && r.threw && /no Delver archive/.test(r.msg), r.msg.slice(0, 120));
  }
}

// ---- 6. writeMacBinary: the one container the page can produce -------------
// Round trip through the page's own unwrapper first, then check the header
// fields at their absolute offsets against the MacBinary II layout, computed
// here from the spec rather than by calling the writer's helpers -- so a
// writer that put a field in the wrong place fails even though it agrees
// with itself.
{
  const wrapped = peek('writeMacBinary')({
    name: 'Cythera Data', type: 'DelS', creator: 'Delv',
    data: refData, rsrc: refRsrc || new Uint8Array(0)
  });
  const back = peek('macBinaryForks')(wrapped);
  check('writeMacBinary round-trips through macBinaryForks', !!back, back ? back.kind : 'not recognised');
  if (back) {
    check('the data fork survives the wrap', h(back.data) === h(refData), h(back.data));
    if (refRsrc) check('the resource fork survives the wrap', h(back.rsrc) === h(refRsrc), h(back.rsrc));
    check('name, type and creator survive',
          back.name === 'Cythera Data' && back.type === 'DelS' && back.creator === 'Delv',
          `${back.name} '${back.type}'/'${back.creator}'`);
  }
  const u32 = o => ((wrapped[o] * 0x1000000) + (wrapped[o+1] << 16) + (wrapped[o+2] << 8) + wrapped[o+3]) >>> 0;
  check('fork lengths sit at 83 and 87',
        u32(83) === refData.length && u32(87) === (refRsrc ? refRsrc.length : 0),
        `${u32(83)} / ${u32(87)}`);
  check('MacBinary II version pair at 122/123', wrapped[122] === 129 && wrapped[123] === 129);
  let crc = 0;
  for (let i = 0; i < 124; i++) {
    crc ^= wrapped[i] << 8;
    for (let b = 0; b < 8; b++) crc = ((crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1) & 0xFFFF;
  }
  check('the CRC-16/XMODEM at 124 verifies', ((wrapped[124] << 8) | wrapped[125]) === crc,
        '0x' + crc.toString(16));
  check('forks are 128-byte aligned',
        wrapped.length === 128 + Math.ceil(refData.length / 128) * 128 +
          Math.ceil((refRsrc ? refRsrc.length : 0) / 128) * 128);
  // And the whole page accepts its own product as an arriving file.
  const found = peek('extractDelverArchive')(wrapped);
  check('extractDelverArchive opens the wrapped file', h(found.bytes) === h(refData),
        found.via);
}

console.log(failures ? `\nFAIL — ${failures} check(s) failed` : '\nAll loader checks passed');
process.exit(failures ? 1 : 0);
