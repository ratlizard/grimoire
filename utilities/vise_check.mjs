#!/usr/bin/env node
// Opens the Cythera installer with js/mac-vise.js and checks every file in
// it: the catalog reads whole, each fork inflates to the length the catalog
// declares, the CRC the catalog carries for each file verifies, and the two
// files the rest of the suite already knows -- Cythera Data and Cythera --
// come out identical to their BinHex copies. Then the StuffIt archives
// beside it (js/mac-stuffit.js): the mirrors must give back the same
// installer, and the compressed ones must be refused by method name.
//
//   node utilities/vise_check.mjs reference/original_installers/Cythera.bin \
//        "$TMPDIR/Cythera Data.data" "$TMPDIR/Cythera Data.rsrc" \
//        "$TMPDIR/Cythera.data" "$TMPDIR/Cythera.rsrc"
//
// The forks are optional; without them the CRC is the only oracle, which is
// most of the check. The resource forks are compared outside bytes 16..255,
// the Resource Manager's own scratch area at the head of every fork: the
// installer's copy and the BinHex copy differ only there (in what look like
// leftover file names), and the resource map and every resource are the
// same bytes.

import {readFileSync, existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';

const [binPath, dataPath, dataRsrcPath, appDataPath, appRsrcPath] = process.argv.slice(2);
if (!binPath) {
  console.error('usage: vise_check.mjs <Cythera.bin> [Cythera Data.data] [Cythera Data.rsrc] [Cythera.data] [Cythera.rsrc]');
  process.exit(2);
}

const ctx = vm.createContext({ TextDecoder, TextEncoder, console });
for (const f of ['js/mac-bytes.js', 'js/mac-containers.js', 'js/mac-stuffit.js', 'js/mac-vise.js'])
  new vm.Script(readFileSync(f, 'utf8'), { filename: f }).runInContext(ctx);

let failures = 0;
const h = b => createHash('sha256').update(Buffer.from(b)).digest('hex').slice(0, 16);
function check(name, cond, detail) {
  console.log((cond ? '  ok   ' : '  FAIL ') + name + (detail ? '  — ' + detail : ''));
  if (!cond) failures++;
}
const maybe = p => (p && existsSync(p)) ? new Uint8Array(readFileSync(p)) : null;

const bin = new Uint8Array(readFileSync(binPath));
const t0 = Date.now();
const found = ctx.sniffViseInstaller(bin);
check('the file is recognised as an installer', !!found, found ? found.archive.versionName : 'not recognised');
if (!found) process.exit(1);
const { container, archive } = found;
check('it arrived as MacBinary of an APPL/VIS3 file',
      !!container && container.kind === 'MacBinary' && container.type === 'APPL' && container.creator === 'VIS3',
      container ? `${container.kind} "${container.name}" ${container.type}/${container.creator}` : 'bare');
check('53 catalog entries (48 files, 5 directories)',
      archive.entries.length === 48 && archive.dirs.length === 5,
      `${archive.entries.length} files, ${archive.dirs.length} directories`);

// The tree, by directory ID rather than by the depth field vise.rs reads.
const paths = new Set(archive.entries.map(e => e.path));
for (const p of ['Cythera 1.0.4 ƒ/Cythera Data', 'Cythera 1.0.4 ƒ/Cythera',
                 'Cythera 1.0.4 ƒ/CombatAI/Defend.ai',
                 'Cythera 1.0.4 ƒ/Documentation ƒ/Cythera License.text',
                 'Cythera 1.0.4 ƒ/Screenshots ƒ/Pnyx screenshot.pict',
                 'Cythera 1.0.4 ƒ/Web Site urls ƒ/Cythera Web Site (NS)',
                 'InputSprocketLib'])
  check('path ' + p, paths.has(p));

// Every file: both forks, declared lengths, CRC.
let extracted = 0, crcBad = 0, grouped = 0, bytesOut = 0;
const byPath = new Map();
for (const e of archive.entries) {
  let r;
  try { r = ctx.viseExtract(archive, e); }
  catch (err) { check('extract ' + e.path, false, err.message); continue; }
  extracted++;
  bytesOut += r.data.length + r.rsrc.length;
  if (e.grouped) grouped++;
  if (r.data.length !== e.dataLen || r.rsrc.length !== e.rsrcLen)
    check('lengths of ' + e.path, false, `${r.data.length}/${r.rsrc.length} vs ${e.dataLen}/${e.rsrcLen}`);
  if (!r.crcOk) { crcBad++; check('CRC of ' + e.path, false, 'mismatch'); }
  byPath.set(e.path, r);
}
const ms = Date.now() - t0;
check('every file extracted', extracted === archive.entries.length, `${extracted} of ${archive.entries.length}`);
check('every CRC verifies', crcBad === 0, `${crcBad} mismatches`);
check('the grouped files (the Combat AI folder) came from one shared stream', grouped === 9, `${grouped} grouped`);
console.log(`  (${archive.entries.length} files, ${(bytesOut / 1048576).toFixed(1)} MB out, in ${ms} ms)`);

// The five streams standard DEFLATE refuses: a STORED block on a word boundary.
const lk = byPath.get('Cythera 1.0.4 ƒ/Screenshots ƒ/Land King Hall screenshot.pict');
check('a word-aligned STORED stream inflates', !!lk && lk.data.length === 164900 && lk.crcOk);
const ns = byPath.get('Cythera 1.0.4 ƒ/Web Site urls ƒ/Cythera Web Site (NS)');
check('the smallest file reads as its URL',
      !!ns && ctx.decodeMacRoman(ns.data) === 'http://www.delver.com/\r',
      ns ? JSON.stringify(ctx.decodeMacRoman(ns.data)) : 'missing');

// Against the BinHex copies.
function rsrcSame(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && !(i >= 16 && i < 256)) return false;
  return true;
}
const cd = byPath.get('Cythera 1.0.4 ƒ/Cythera Data');
const refData = maybe(dataPath), refDataRsrc = maybe(dataRsrcPath);
if (refData) check('Cythera Data: data fork identical to the .hqx copy', !!cd && h(cd.data) === h(refData), cd ? h(cd.data) : 'missing');
if (refDataRsrc) check('Cythera Data: resource fork identical outside the reserved header', !!cd && rsrcSame(cd.rsrc, refDataRsrc));
const app = byPath.get('Cythera 1.0.4 ƒ/Cythera');
const refApp = maybe(appDataPath), refAppRsrc = maybe(appRsrcPath);
if (refApp) check('Cythera: data fork identical to the .hqx copy', !!app && h(app.data) === h(refApp));
if (refAppRsrc) check('Cythera: resource fork identical outside the reserved header', !!app && rsrcSame(app.rsrc, refAppRsrc));

// The StuffIt archives beside the .bin: Ambrosia's four installers and the
// two mirrors. Whichever are present are opened; the ones that store the
// installer's data fork (1.0.3, 1.0.4, both mirrors) must yield it, and the
// 1.0.4 copies must yield exactly the fork inside Cythera.bin. The two that
// compress it (1.0.1, 1.0.2 -- LZ+Huffman, method 13) must say so by name.
{
  const dir = dirname(binPath);
  const binData = container ? container.data : bin;
  const sits = ['Cythera_1.0.1_Installer.sit', 'Cythera_1.0.2_Installer.sit', 'Cythera_1.0.3_Installer.sit',
                'Cythera_1.0.4_Installer.sit', 'Cythera_Installer_archive.org.sit', 'Cythera_Installer_old.mac.gdn.sit'];
  let opened = 0;
  for (const name of sits) {
    const p = join(dir, name);
    if (!existsSync(p)) continue;
    const sit = new Uint8Array(readFileSync(p));
    check(name + ' is recognised as StuffIt', ctx.looksLikeStuffIt(sit));
    let r = null, err = null;
    try { r = ctx.sniffViseInstaller(sit); } catch (e) { err = e; }
    if (/1\.0\.[12]_/.test(name)) {
      check(name + ' is refused by method name', !!err && /method 13 \(LZ\+Huffman\)/.test(err.message), err ? err.message.slice(0, 100) : 'accepted');
      continue;
    }
    check(name + ' opens as an installer', !!r && !err, err ? err.message : (r ? `${r.container.kind}, ${r.archive.entries.length} files` : 'not recognised'));
    if (!r) continue;
    opened++;
    if (/1\.0\.3/.test(name)) {
      check(name + ' is the 1.0.3 installer', r.archive.dirs.some(d => /1\.0\.3/.test(d.path)), r.archive.dirs.map(d => d.path).join(', '));
    } else {
      check(name + ' holds the same installer as Cythera.bin', h(r.container.data) === h(binData), h(r.container.data));
    }
  }
  console.log(`  (${opened} StuffIt archives opened)`);

  // The four-in-one: every installer found, the newest chosen by default,
  // any other by name, and the 1.0.4 in it the same bytes as Cythera.bin.
  const combined = join(dir, 'Cythera installers (archive.org).sit');
  if (existsSync(combined)) {
    const sit = new Uint8Array(readFileSync(combined));
    const r = ctx.sniffViseInstaller(sit);
    check('the combined archive lists four installers',
          !!r && r.installers.length === 4 && r.installers.map(i => i.name.replace(/\D+/g, '')).join(' ') === '101 102 103 104',
          r ? r.installers.map(i => i.name).join(', ') : 'not recognised');
    check('the newest is chosen by default', !!r && r.picked === 'Cythera 1.0.4 Installer' && h(r.container.data) === h(binData), r ? r.picked : '');
    const r3 = ctx.sniffViseInstaller(sit, 'Cythera 1.0.3 Installer');
    check('another can be picked by name', !!r3 && r3.picked === 'Cythera 1.0.3 Installer' && r3.archive.dirs.some(d => /1\.0\.3/.test(d.path)),
          r3 ? r3.picked : '');
    // Every release extracts whole, every file's CRC verifying. The 1.0.2
    // and 1.0.3 installers are the ones with garbage in the grouped-offset
    // fields of every ungrouped record, so this is where the grouped flag
    // (record byte 8, bit 0x10) is proven rather than the offsets.
    for (const name of ['Cythera 1.0.1 Installer', 'Cythera 1.0.2 Installer', 'Cythera 1.0.3 Installer', 'Cythera 1.0.4 Installer']) {
      const rv = ctx.sniffViseInstaller(sit, name);
      let good = 0, total = 0, firstErr = '';
      if (rv) for (const e of rv.archive.entries) {
        total++;
        try { if (ctx.viseExtract(rv.archive, e).crcOk) good++; else if (!firstErr) firstErr = 'CRC mismatch on ' + e.path; }
        catch (err) { if (!firstErr) firstErr = e.path + ': ' + err.message; }
      }
      check(name + ' extracts whole, every CRC verifying', !!rv && good === total && total > 40, rv ? `${good} of ${total}${firstErr ? '; ' + firstErr : ''}` : 'not picked');
    }
  }
}

// Refusals.
function refuses(bytes) { try { ctx.sniffViseInstaller(bytes); return false; } catch (e) { return true; } }
check('junk is not an installer', ctx.sniffViseInstaller(new TextEncoder().encode('hello world, not SVCT')) === null);
check('a bare Cythera Data is not an installer', !refData || ctx.sniffViseInstaller(refData) === null);
// A MacBinary cut short is not a container at all (its fork lengths overrun),
// so it is "not an installer"; a bare SVCT fork cut short says why.
check('a truncated MacBinary is simply not recognised', ctx.sniffViseInstaller(bin.subarray(0, 4096)) === null);
check('a truncated SVCT fork is refused with a message', refuses(bin.subarray(128, 128 + 4096)));

console.log(failures ? `\nFAIL — ${failures} check(s) failed` : `\nAll installer checks passed: ${archive.entries.length} files, ${extracted} extracted, ${crcBad} CRC mismatches`);
process.exit(failures ? 1 : 0);
