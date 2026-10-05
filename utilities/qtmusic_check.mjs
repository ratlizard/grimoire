#!/usr/bin/env node
// QuickTime 3's instruments, taken out of its Windows installer, and a tune
// played through them.
//
//   node utilities/qtmusic_check.mjs [index.html] <QUICKTIM.EXE> [Cythera Data.data]
//
// WHY. "Play with QuickTime's Instruments" rests on three readers nothing
// else in the suite touches -- a self-extracting zip read from its local
// header, InstallShield 3's data.z, and PKWARE DCL's implode
// (js/mac-installshield.js) -- and on the instrument reader and synth in
// js/mac-qtmusic.js. The first three fail quietly in the way decompressors
// do: data.z has no checksum of its own, so an explode that is wrong by a
// bit gives a file of the right length.
//
// THE ORACLE for the unpacking is a different implementation: every one of
// the 21 files, exploded by the Python `dclimplode` package (pklib's
// decoder, not this one), hashed by name and content, is pinned below as
// ALL_FILES. Its .qtx's 235 instruments were also matched byte for byte
// against the Mac QuickTime 4.0 copy on the Mac OS 9.0 disk image when the
// reader was written (cythera-workbench/doc/GRIMOIRE-NOTES.md, under
// `grimoire/qt-instruments-v56peg`), so the Windows road reaches the Mac set.
//
// THE SYNTH has no oracle here: what it should sound like is a recording of
// the game, and the comparison with the soundtrack's "(Classic)" tracks
// (the same entry in the notes) needs numpy, which the suite does not
// install. So this holds what it can: every instrument reads, every sample
// any key range names is found, every part of every tune gets an
// instrument, and the theme's render is pinned by hash in check_all.mjs, so
// a change to the synthesis moves a number someone has to record.
//
// NEGATIVE CONTROLS. A DCL stream cut short must throw, and so must one
// that asks for coded literals, which this reader refuses by name; a
// byte changed inside the instruments' packed stream must change ALL_FILES,
// which shows the hash is over what the explode produced and not over the
// table of sizes.

import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', exePath, dataPath] = process.argv.slice(2);
const ALL_FILES = '4b026e689f27c286';
let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);

if (!exePath || !existsSync(exePath)) { console.log('  skip everything: no QUICKTIM.EXE given'); process.exit(0); }

const {sandbox} = makeSandbox();
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);
ctx.EXE = new Uint8Array(readFileSync(exePath));

// The unpacking, file by file.
const sha = b => createHash('sha256').update(b).digest();
const allFiles = dz => {
  const h = createHash('sha256');
  for (const e of ev('parseInstallShield3')(dz).entries) {
    h.update(Buffer.from(e.path, 'latin1')); h.update(Buffer.from([0]));
    h.update(sha(ev('installShield3File')(dz, e)));
  }
  return h.digest('hex').slice(0, 16);
};
const dataZ = ev('qtInstallerDataZ(EXE)');
const entries = ev('parseInstallShield3')(dataZ).entries;
const got = allFiles(dataZ);
if (got !== ALL_FILES) fail('unpacking', `the 21 files hash to ${got}, dclimplode's to ${ALL_FILES}`);
else ok('unpacking', `${entries.length} files exploded as dclimplode explodes them`);

// The controls.
const qtx = entries.find(e => /QuickTimeMusicalInstruments\.qtx$/.test(e.path));
const packed = dataZ.subarray(qtx.offset, qtx.offset + qtx.packedLen);
const throws = (what, fn, want) => {
  try { fn(); fail(what, 'did not throw'); }
  catch (e) { if (want && !want.test(e.message)) fail(what, 'threw "' + e.message + '"'); }
};
throws('a stream cut short', () => ev('dclExplode')(packed.subarray(0, packed.length >> 1), qtx.len), /ran out of input/);
const coded = packed.slice(0, 64); coded[0] = 1;
throws('coded literals', () => ev('dclExplode')(coded, 100), /coded literals/);
const flipped = dataZ.slice();
flipped[qtx.offset + (qtx.packedLen >> 1)] ^= 0x10;
let flippedHash = null;
try { flippedHash = allFiles(flipped); } catch (e) { flippedHash = 'threw'; }
if (flippedHash === ALL_FILES) fail('a changed byte', 'the hash did not move');
const controls = failures === 0;

// The instruments.
const lib = ev('qtInstrumentsFromFile(EXE)');
let ranges = 0;
for (const id of lib.ids) {
  try {
    const inst = lib.get(id);
    ranges += inst.regions.length;
    for (const r of inst.regions)
      if (!r.pcm.length) fail(`instrument ${id}`, `key range ${r.low}-${r.high} has no sample`);
  } catch (e) { fail(`instrument ${id}`, e.message); }
}
if (lib.ids.length !== 235) fail('instruments', `${lib.ids.length}, where QuickTime 3 has 235`);
if (ranges !== 1544) fail('key ranges', `${ranges}, where QuickTime 3 has 1544`);

// The tunes.
let tuneNote = 'no game, so no tune played';
if (dataPath && existsSync(dataPath)) {
  ctx.DATA = new Uint8Array(readFileSync(dataPath));
  ev('ARC = openDelverArchive(DATA)');
  const missing = [];
  for (let r = 0x9000; r <= 0x900A; r++) {
    ctx.R = r;
    const tones = ev('qtmaToMidi(getResourceBytes(ARC, R)).tones');
    for (const p in tones) if (!ev('qtToneInstrument')(lib, tones[p])) missing.push(r.toString(16) + ' part ' + p);
  }
  if (missing.length) fail('parts', 'no instrument for ' + missing.join(', '));
  ctx.LIB = lib;
  const wav = ev('(() => { const i = qtmaToMidi(getResourceBytes(ARC, 0x9000)); return qtmaWav(qtmaRender(i.events, i.tones, LIB)); })()');
  tuneNote = `every part of 11 tunes has an instrument; the theme ${((wav.length - 44) / 4 / 44100).toFixed(1)} s, TUNE ${sha(wav).toString('hex').slice(0, 12)}`;
}

if (failures) process.exit(1);
console.log(`QuickTime 3: ${entries.length} files unpacked${controls ? ', the controls refused' : ''}; ` +
  `${lib.ids.length} instruments, ${ranges} key ranges, every sample found; ${tuneNote}`);
