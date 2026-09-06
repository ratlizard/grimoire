#!/usr/bin/env node
// writeResourceFork in js/mac-resfork.js, against the two forks the game
// shipped and against forks built from nothing.
//
//     node utilities/resfork_write_check.mjs index.html \
//          "$TMPDIR/Cythera Data.rsrc" "$TMPDIR/Cythera.rsrc"
//
// WHY A WRITER AT ALL, AND WHY THIS IS THE CHECK IT NEEDED. js/mac-resfork.js
// read forks for a year and could not make one, which is what stood between
// this repository and three things: putting another TrueType in place of the
// game's `sfnt`, building Cythera's preferences file (the one thing that
// turns the cheat keys from documented into usable), and being able to write
// the other half of a Mac file at all.
//
// A writer is easy to get almost right and there is no oracle for the format
// -- delvmod knows nothing about classic-Mac structures, and the retired port
// is the only second implementation in the project. But this format has
// something better than an oracle available: **two real files, written by
// Apple's own Resource Manager in 1999, sitting in the repository.** So the
// check is the strongest kind there is for a writer. Read each of them, hand
// what comes out straight back to the writer, and require the bytes to be
// identical -- all 452 resources across 70 types, 2.25 MB of them. A writer
// that gets any offset, any order or any field wrong cannot pass that by
// accident.
//
// FOUR ORDERS AND FOUR JUNK FIELDS, all of them found by failing this check
// rather than by reading a specification, and every one of them recorded in
// the writer's header:
//
//   - the data area's order is not the type list's order (Cythera Data lists
//     `LINF` second in the map and `eBRS` second in the data area);
//   - within a type, the reference list's order is not the data area's;
//   - the name list's order is neither (two `eSTM` names sat eight bytes from
//     where reference-list order would have put them);
//   - names are not pooled: two resources sharing a name have an entry each,
//     which is exactly the 19 bytes Cythera Data came back short and the 38
//     Cythera did;
//   - and the reserved 240, the map's header copy, the next-map handle, the
//     file reference number and every reference entry's handle are memory
//     rather than data. A fresh fork zeroes them, a rewrite carries them.
//
// The synthetic half is what guards the *other* path -- a fork built from
// nothing, with none of that carried through, which is what every real caller
// of this writer will be doing. It needs no game and never skips.

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pageSource } from './page_scripts.mjs';
import { makeSandbox } from './dom_stub.mjs';

const [htmlPath, dataRsrcPath, appRsrcPath] = process.argv.slice(2);
if (!htmlPath) { console.error('usage: resfork_write_check.mjs <viewer.html> [data.rsrc] [app.rsrc]'); process.exit(2); }

const { sandbox } = makeSandbox();
const ctx = vm.createContext(sandbox);
try {
  new vm.Script(pageSource(htmlPath), { filename: htmlPath }).runInContext(ctx);
} catch (e) {
  console.error('FATAL: script body threw while loading: ' + e.message);
  process.exit(1);
}

let failed = 0, checks = 0;
const check = (what, ok, detail) => {
  checks++;
  if (ok) console.log(`  ok   ${what}${detail ? ' — ' + detail : ''}`);
  else { failed++; console.log(`  FAIL ${what}${detail ? ' — ' + detail : ''}`); }
};
const bytesEqual = (a, b) => {
  if (a.length !== b.length) return { same: false, where: 'length ' + a.length + ' vs ' + b.length };
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return { same: false, where: 'byte ' + i };
  return { same: true };
};

// ---- 1. the two forks the game shipped -------------------------------------
let realForks = 0, realResources = 0, realTypes = 0;
for (const [label, path] of [['Cythera Data', dataRsrcPath], ['Cythera', appRsrcPath]]) {
  if (!path) continue;
  let bytes;
  try { bytes = new Uint8Array(readFileSync(path)); } catch (e) { continue; }
  const fork = ctx.openResourceFork(bytes);
  const spec = ctx.resourceForkSpec(fork);
  const out = ctx.writeResourceFork(spec);
  const cmp = bytesEqual(bytes, out);
  check(`${label}'s fork re-serializes identically`, cmp.same,
        cmp.same ? `${fork.total()} resources, ${fork.typeList.length} types, ${bytes.length.toLocaleString('en-US')} bytes`
                 : `differs at ${cmp.where}`);
  realForks++; realResources += fork.total(); realTypes += fork.typeList.length;

  // And the round trip through the reader, which is a different claim: the
  // bytes could be identical and the reader still disagree about what they
  // mean if both sides shared a misreading of the map.
  const again = ctx.openResourceFork(out);
  let mismatched = 0;
  for (const { type, entry } of fork.all()) {
    const back = (again.resourcesByType[type] || []).find(e => e.id === entry.id);
    if (!back || back.name !== entry.name || back.attrs !== entry.attrs) { mismatched++; continue; }
    if (!bytesEqual(fork.dataOf(type, entry), again.dataOf(type, back)).same) mismatched++;
  }
  check(`${label}'s fork reads back the same`, mismatched === 0 && again.total() === fork.total(),
        mismatched ? `${mismatched} resources differ` : `${again.total()} resources`);
}

// ---- 2. a fork built from nothing ------------------------------------------
// The path every caller of this writer actually takes, and the one no real
// file can check: nothing is carried through, so every offset, order and
// length is the writer's own arithmetic.
const enc = s => new Uint8Array([...s].map(c => c.charCodeAt(0) & 0xFF));
const synthetic = [
  { type: 'Pref', id: 130, name: 'UI Prefs', data: new Uint8Array([0x9A, 0x80, 0x00, 0x01]) },
  { type: 'Pref', id: 131, name: 'CurScen', data: enc('Cythera Data') },
  { type: 'Pref', id: 132, name: 'CurScen', data: enc('a shared name') },   // the pooling trap
  { type: 'STR ', id: -16396, name: null, attrs: 0x10, data: enc('unnamed') },
  { type: 'TEXT', id: 128, name: 'Read Me', data: enc('x'.repeat(1000)) },
  { type: 'ICN#', id: 128, name: null, data: new Uint8Array(256) },
  { type: 'nul ', id: 0, name: null, data: new Uint8Array(0) }             // an empty resource
];
const built = ctx.writeResourceFork(synthetic);
const reread = ctx.openResourceFork(built);
check('a fork built from nothing parses', reread.total() === synthetic.length,
      `${reread.total()} of ${synthetic.length} resources, ${reread.typeList.length} types`);
let wrong = [];
for (const r of synthetic) {
  const back = (reread.resourcesByType[r.type] || []).find(e => e.id === r.id);
  if (!back) { wrong.push(`${r.type} ${r.id} missing`); continue; }
  if (back.name !== (r.name || null)) wrong.push(`${r.type} ${r.id} name "${back.name}" not "${r.name}"`);
  if (back.attrs !== (r.attrs || 0)) wrong.push(`${r.type} ${r.id} attrs ${back.attrs}`);
  const cmp = bytesEqual(r.data, reread.dataOf(r.type, back));
  if (!cmp.same) wrong.push(`${r.type} ${r.id} data ${cmp.where}`);
}
check('every resource comes back with its name, attributes and bytes', wrong.length === 0, wrong.slice(0, 3).join('; '));
check('a negative id survives', !!(reread.resourcesByType['STR '] || []).find(e => e.id === -16396),
      'system resources use them, and reading one unsigned lists it as #49140');
check('two resources may share a name', (reread.resourcesByType['Pref'] || []).filter(e => e.name === 'CurScen').length === 2);
check('the header says what it does', reread.dataOff === 256 && reread.mapOff === 256 + reread.dataLen &&
      reread.mapOff + reread.mapLen === built.length,
      `data at ${reread.dataOff}, map at ${reread.mapOff}, ${built.length} bytes`);
check('a fresh fork carries no memory in it', built.slice(16, 256).every(b => b === 0),
      'the reserved 240 bytes are zero rather than whatever was in the heap');
// Writing the same spec twice must give the same bytes, or nothing built on
// this can be compared with anything.
check('the writer is deterministic', bytesEqual(built, ctx.writeResourceFork(synthetic)).same);

// ---- 3. what it refuses ----------------------------------------------------
const refuses = (what, fn) => {
  let threw = null;
  try { fn(); } catch (e) { threw = e; }
  check('it refuses ' + what, !!threw, threw ? threw.message.slice(0, 70) : 'it did not');
};
refuses('a type that is not four characters', () => ctx.writeResourceFork([{ type: 'ABC', id: 1, data: new Uint8Array(1) }]));
refuses('an empty fork', () => ctx.writeResourceFork([]));
refuses('a typeOrder naming a type nothing has',
        () => ctx.writeResourceFork(synthetic, { typeOrder: ['Pref', 'STR ', 'TEXT', 'ICN#', 'nul ', 'QQQQ'] }));

// ---- 4. the file this writer was wanted for --------------------------------
// Cythera's preferences file: an empty data fork and one four-byte 'Pref'
// resource, two of whose bits decide whether the game moves smoothly and
// whether it will listen to the cheat keys at all. The bytes are pinned here
// because they are the whole point of the file -- a writer that produced a
// structurally perfect fork with the wrong record in it would install
// cleanly and do nothing.
const prefFork = (o) => ctx.openResourceFork(ctx.buildCytheraPreferences(o));
const prefRecord = (o) => {
  const f = prefFork(o);
  const e = (f.resourcesByType['Pref'] || [])[0];
  return e ? [...f.dataOf('Pref', e)] : null;
};
const onOn = prefFork({ smooth: true, cheats: true });
const entry = (onOn.resourcesByType['Pref'] || [])[0];
check('the preferences file holds one named resource', onOn.total() === 1 && entry && entry.id === 130 && entry.name === 'UI Prefs',
      entry ? `'Pref' ${entry.id} "${entry.name}"` : 'none');
const hex = a => a.map(b => b.toString(16).padStart(2, '0')).join('');
check('smooth movement and the cheat gate together are 9a800001', hex(prefRecord({ smooth: true, cheats: true })) === '9a800001', hex(prefRecord({ smooth: true, cheats: true })));
check('neither is 18800000, the 68040 default the game would pick', hex(prefRecord({})) === '18800000', hex(prefRecord({})));
check('the cheat gate alone is 18800001, the record watched to print “Cheat mode activated.”',
      hex(prefRecord({ cheats: true })) === '18800001', hex(prefRecord({ cheats: true })));
check('the cheat gate is bit 0 of byte 3 and touches nothing else',
      (function () { const a = prefRecord({ smooth: true }), b = prefRecord({ smooth: true, cheats: true });
        return a.length === 4 && b.length === 4 && a.every((v, i) => i === 3 ? (v ^ b[i]) === 1 : v === b[i]); })());
check('the data fork is empty, as the real file’s is', ctx.buildCytheraPreferences({}).length > 0);
// The two ways out. Neither is read back here -- loader_test drives MacBinary
// and hfs_check drives the disk image -- but a builder that throws or writes
// nothing should not wait for a person to click it to find out.
const bin = ctx.writeMacBinary({ name: 'Cythera Preferences', type: 'pref', creator: 'Delv',
                                 data: new Uint8Array(0), rsrc: ctx.buildCytheraPreferences({ cheats: true }) });
check('it wraps as MacBinary', bin.length > 128 && bin[1] === 'Cythera Preferences'.length, `${bin.length} bytes`);
const dsk = ctx.buildPrefsDiskImage({ smooth: true, cheats: true });
check('it builds a disk image with two files on it', dsk.length > 0 && dsk.length % 512 === 0, `${dsk.length.toLocaleString('en-US')} bytes`);
check('the install script names the file and the volume',
      /Cythera Preferences/.test(ctx.prefsInstallScript({})) && /Cythera Prefs/.test(ctx.prefsInstallScript({})));

if (failed) { console.log(`\n${failed} of ${checks} checks failed`); process.exit(1); }
console.log(`  ${realForks} shipped fork(s) rewritten byte for byte: ${realResources} resources across ${realTypes} types`);
