#!/usr/bin/env node
// A tune written, and a MIDI file made into one.
//
//   node utilities/midi_import_check.mjs [index.html] <Cythera Data.data>
//
// WHY. js/mac-qtmusic.js writes QTMA tunes (qtmaWrite) and makes a MIDI file
// into one (midiToQtma). Nothing reads a tune but QuickTime and this page's
// own parser, so a writer that is wrong in a field the parser does not look
// at would pass any check that only parses its output back. The shipped
// tunes are the oracle instead: each was written by Apple's own tools.
//
// WHAT IT HOLDS, over the eleven tunes 0x9000 to 0x900A:
//   header   the sample description and tune header, rebuilt by qtmaWrite
//            from what qtmaHeaderParts read out of the tune and from the
//            tune's own notes, is the shipped header byte for byte. That
//            covers the description's layout, the general events' framing,
//            the MIDI channel event, the used-notes bitmap (worked out from
//            the notes, so its bit order is tested against Apple's) and the
//            note request.
//   events   the rebuilt tune parses to the notes and controllers the
//            shipped one parses to, in order.
//   midi     the tune exported as MIDI (qtmaToMidi) and made back into a
//            tune (midiToQtma) has every note beginning at its time, key
//            and velocity and every end where it fell, on a part asking for
//            the same instrument, and each controller's settings from the
//            part's first note on, each value within what MIDI's seven bits
//            can carry.
//
// NEGATIVE CONTROLS. One note's key changed in the MIDI file must fail the
// midi comparison; one bit of a rebuilt header must fail the header one.
//
// WHAT IT CANNOT SEE: whether QuickTime plays what is written. The header
// match is the nearest thing here; the test that counts is the game playing
// an imported tune.

import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const args = process.argv.slice(2);
const htmlPath = args.length > 1 ? args[0] : 'index.html', dataPath = args[args.length - 1];
if (!dataPath || !existsSync(dataPath)) { console.log('  skip everything: no Cythera Data given'); process.exit(0); }
const {sandbox} = makeSandbox();
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);
ctx.DATA = new Uint8Array(readFileSync(dataPath));
ev('ARC = openDelverArchive(DATA)');

let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const noteKey = e => [e.t, e.pitch, e.vol, e.dur].join(',');
let tunes = 0, notes = 0, ctls = 0, worst = 0, controlsOk = true;

for (let r = 0x9000; r <= 0x900A; r++) {
  ctx.R = r;
  const raw = ev('getResourceBytes(ARC, R)');
  if (!raw) { fail('0x' + r.toString(16), 'not in the file'); continue; }
  ctx.RAW = raw;
  const name = '0x' + r.toString(16).toUpperCase();
  const hp = ev('qtmaHeaderParts(RAW)');
  const src = ev('qtmaToMidi(RAW)');
  ctx.HP = hp; ctx.SRC = src;
  const rebuilt = ev('qtmaWrite(HP.parts, SRC.events, { flags: HP.flags })');
  if (!same([...rebuilt.subarray(0, hp.size)], [...raw.subarray(0, hp.size)])) {
    const at = [...rebuilt.subarray(0, hp.size)].findIndex((v, i) => v !== raw[i]);
    fail(name + ' header', 'differs from the shipped header at byte ' + at);
  }
  // The control: a header with one bit turned must not compare equal.
  const bent = rebuilt.slice(0, hp.size); bent[40] ^= 1;
  if (same([...bent], [...raw.subarray(0, hp.size)])) { controlsOk = false; fail(name + ' header control', 'a changed header still matched'); }
  ctx.REB = rebuilt;
  const back = ev('qtmaToMidi(REB)');
  const flat = es => es.map(e => e.k === 'note' ? 'n' + e.part + ':' + noteKey(e) : 'c' + e.part + ':' + e.t + ',' + e.ctl + ',' + e.val);
  if (!same(flat(back.events), flat(src.events))) fail(name + ' events', 'the rebuilt tune does not parse to the shipped tune\'s events');

  // Through MIDI and back.
  const made = ev('midiToQtma(SRC.midi, { like: RAW })');
  ctx.MADE = made.data;
  const got = ev('qtmaToMidi(MADE)');
  // A part is followed through the MIDI file by its channel, and must come
  // back asking for the same instrument: the kit, or the same General MIDI
  // number.
  const instOf = (tones, part) => { const t = tones[part]; return t ? (t.instrument >= 16384 ? 'kit' : 'gm' + t.gm) : '?'; };
  const chanOfGot = {};
  for (const p of made.parts) chanOfGot[p.part] = p.midiChannel;
  const label = (res, chanOf, part) => 'channel ' + (chanOf[part] + 1) + ' ' + instOf(res.tones, part);
  const byInst = (res, chanOf, k) => { const m = new Map(); for (const e of res.events) if (e.k === k) { const key = label(res, chanOf, e.part); if (!m.has(key)) m.set(key, []); m.get(key).push(e); } return m; };
  const a = byInst(src, src.chanOf, 'note'), b = byInst(got, chanOfGot, 'note');
  // A note is held to where it begins and how hard, and the ends to where
  // they fall. Two notes on one key that overlap cannot be told apart by
  // their ends in a MIDI file (a note-off names a key, not a note), so which
  // end goes with which beginning is not compared: the theme has one such
  // pair, key 69 at 35162 and 35340.
  for (const [inst, list] of a) {
    const begins = l => l.map(e => [e.t, e.pitch, Math.max(1, e.vol)].join(',')).sort();
    const ends = l => l.map(e => [e.t + Math.max(1, e.dur), e.pitch].join(',')).sort();
    const have = b.get(inst) || [];
    if (!same(begins(list), begins(have))) fail(name + ' midi', `${inst}: ${have.length} notes came back for ${list.length}, or not beginning where they did`);
    else if (!same(ends(list), ends(have))) fail(name + ' midi', `${inst}: the notes do not end where they did`);
    notes += list.length;
  }
  // Controllers: the same count of each on each instrument, values within
  // a step of what seven bits carry (a level's fraction is lost; pan and
  // the wheel are rounded twice).
  const ca = byInst(src, src.chanOf, 'ctl'), cb = byInst(got, chanOfGot, 'ctl');
  const signed = v => v >= 0x8000 ? v - 0x10000 : v;
  for (const [inst, list] of ca) {
    for (const ctl of new Set(list.map(e => e.ctl))) {
      // A part begins with its first note, so of a controller's settings
      // before that only the last is carried, and it arrives as the part
      // begins. The comparison is of the settings from the first note on,
      // and of that last one.
      const first = Math.min(...(a.get(inst) || [{ t: Infinity }]).map(e => e.t));
      // "Before" takes in the first note's own instant: the MIDI file puts a
      // controller ahead of a note at the same tick.
      const all = list.filter(e => e.ctl === ctl), early = all.filter(e => e.t <= first);
      const x = (early.length ? [early[early.length - 1]] : []).concat(all.filter(e => e.t > first));
      const y = (cb.get(inst) || []).filter(e => e.ctl === ctl);
      if (y.length !== x.length) { fail(name + ' midi', `${inst}: controller ${ctl} came back ${y.length} times for ${x.length}`); continue; }
      const ys = y;
      x.forEach((e, i) => { const d = Math.abs(signed(e.val) - signed(ys[i].val)); worst = Math.max(worst, d); if (d > 256) fail(name + ' midi', `${inst}: controller ${ctl} at ${e.t} came back ${ys[i].val} for ${e.val}`); });
      ctls += x.length;
    }
  }
  // The control: one key changed in the MIDI file.
  const bentMidi = src.midi.slice();
  const on = bentMidi.findIndex((v, i) => i > 30 && (v & 0xF0) === 0x90 && bentMidi[i + 2] > 0 && bentMidi[i + 1] < 120);
  bentMidi[on + 1] += 1;
  ctx.BENT = bentMidi;
  const bentGot = ev('qtmaToMidi(midiToQtma(BENT, { like: RAW }).data)');
  const keys = res => res.events.filter(e => e.k === 'note').map(noteKey).sort();
  if (same(keys(bentGot), keys(got))) { controlsOk = false; fail(name + ' midi control', 'a changed key came back unchanged'); }
  tunes++;
}

// What a refusal says.
const throws = (what, code, want) => { try { ev(code); fail(what, 'did not throw'); } catch (e) { if (!want.test(e.message)) fail(what, 'threw "' + e.message + '"'); } };
throws('not a MIDI file', 'midiRead(new Uint8Array(32))', /MThd/);
ctx.R = 0x9000;
throws('no tune to copy from', 'midiToQtma(qtmaToMidi(getResourceBytes(ARC, R)).midi, {})', /synthesizer/);

if (failures) process.exit(1);
console.log(`midi import: ${tunes} shipped headers rebuilt byte for byte; ${notes} notes and ${ctls} controllers back from MIDI where they were` +
  ` (a controller's value within ${worst} of 65536)${controlsOk ? '; the controls caught' : ''}`);
