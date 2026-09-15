#!/usr/bin/env node
// What Ambrosia changed in Cythera Data between the four releases.
//
//   node utilities/releases_check.mjs [index.html] [installers dir]
//
// WHY THIS IS A CHECK AND NOT A NOTE. Until 15 September 2026 nobody could
// compare two releases here: the 1.0.1 and 1.0.2 installer archives compress
// their forks with StuffIt method 13, which the page did not decompress. They
// all open now, so `Cythera Data` can be taken out of each and run through
// `describeDelverDiff`, and the answer is a finding rather than a property of
// the code. A finding written only into prose goes stale silently; written
// here it is re-derived on every run, and a change to what the decoder thinks
// "the same resource" means moves these numbers without moving any snapshot.
//
// THE ONE WORTH KNOWING is the last row: `Cythera Data` is byte for byte
// identical in 1.0.3 and 1.0.4. Whatever the 1.0.4 release fixed, it fixed in
// the application and not in the data.
//
// PLAINTEXT, NOT STORED BYTES, and it has to be. The archives are laid out
// differently between builds and the cipher is keyed by resource id, so
// comparing what is stored would report most of the file as changed in every
// pair. `delverArchiveSpec` hands back plaintext with the encryption verdict
// beside it, which is what makes the comparison mean anything.
//
// THE NEGATIVE CONTROL is at the end: a comparison that answered "identical"
// to everything would pass the 1.0.3/1.0.4 row, which is the row that matters
// most, so the 1.0.1/1.0.2 row is required to differ and one resource is bent
// to prove the comparison sees a single changed byte.

import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', dir = 'reference/game/installers'] = process.argv.slice(2);
let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);
const skip = why => { console.log(`  skip  ${why}`); process.exit(0); };

const combined = join(dir, 'Cythera installers (archive.org).sit');
if (!existsSync(combined)) skip('the four-in-one installer archive is not here');

const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);
sandbox.__sit = new Uint8Array(readFileSync(combined));

const out = ev(`(() => {
  const specs = {};
  for (const v of ['1.0.1', '1.0.2', '1.0.3', '1.0.4']) {
    const r = sniffViseInstaller(__sit, 'Cythera ' + v + ' Installer');
    if (!r) { specs[v] = null; continue; }
    const e = r.archive.entries.find(x => x.type === 'DelS');
    specs[v] = e ? delverArchiveSpec(viseExtract(r.archive, e).data) : null;
  }
  globalThis.__specs = specs;
  const rows = [];
  for (const [x, y] of [['1.0.1','1.0.2'], ['1.0.2','1.0.3'], ['1.0.3','1.0.4']]) {
    if (!specs[x] || !specs[y]) { rows.push({pair: x + ' to ' + y, missing: true}); continue; }
    const d = describeDelverDiff(specs[x], specs[y]);
    rows.push({pair: x + ' to ' + y, changed: d.changed.length, added: d.added.length,
               removed: d.removed.length, count: d.aCount, identical: d.identical,
               // The subindexes a reader would want named, biggest first.
               where: d.groups.slice(0, 3).map(g => (CATEGORY_NAMES[g.subn] || ('subindex ' + g.subn)) +
                       ' ' + (g.changed + g.added + g.removed)).join(', '),
               addedIds: d.added.map(a => '0x' + a.resid.toString(16))});
  }
  return rows;
})()`);

// Each row's figures, pinned. A release that is re-mirrored or a decoder that
// changes what counts as the same resource moves one of these.
const WANT = {
  '1.0.1 to 1.0.2': {changed: 246, added: 1, removed: 0, count: 1557},
  '1.0.2 to 1.0.3': {changed: 125, added: 0, removed: 0, count: 1558},
  '1.0.3 to 1.0.4': {changed: 0, added: 0, removed: 0, count: 1558},
};
for (const row of out) {
  if (row.missing) { fail(row.pair, 'one of the two releases is not in the archive'); continue; }
  const w = WANT[row.pair];
  const got = `${row.changed} changed, ${row.added} added, ${row.removed} removed, of ${row.count}`;
  const want = `${w.changed} changed, ${w.added} added, ${w.removed} removed, of ${w.count}`;
  if (got !== want) fail(row.pair, got + ' against ' + want);
  else ok(row.pair, got + (row.where ? '  (' + row.where + ')' : ''));
}
// 0xEB8 is the spell-hit script the Spells sheet cites, and 1.0.1 does not
// have it. Named here because "one resource was added" is a figure and "the
// game gained this script" is the fact.
const first = out.find(r => r.pair === '1.0.1 to 1.0.2');
if (first && !first.missing) {
  if (first.addedIds.length !== 1 || first.addedIds[0] !== '0xeb8')
    fail('what 1.0.2 added', 'expected only 0xeb8, got ' + first.addedIds.join(' '));
  else ok('1.0.2 added one resource', '0xEB8, which the Spells sheet reads a hit from');
}
const last = out.find(r => r.pair === '1.0.3 to 1.0.4');
if (last && !last.missing) {
  if (!last.identical) fail('1.0.3 and 1.0.4', 'the data file differs between them');
  else ok('the data file is unchanged between 1.0.3 and 1.0.4', 'so 1.0.4 changed the application only');
}

// ---- and the applications ---------------------------------------------------
/* The data file answers what the scenario changed; this answers what the
   PROGRAM changed, which for 1.0.4 is the whole of the release, since its
   data file is identical to 1.0.3's.
 *
 * The routine names come from the traceback tables the compiler emitted, so
 * they are Glenn Andreas's own names for his routines, and they make the last
 * release legible in a way no byte count does: 1.0.4 added `MyFindSymbol`,
 * `IsAntiAliasedTextEnabled` and `SetAntiAliasedTextEnabled`. That is the
 * classic look-up-a-symbol-at-runtime idiom plus the thing it looks up, so
 * the final release of Cythera was about anti-aliased text.
 *
 * Pinned by NAME rather than by count. A count would survive a change that
 * swapped which routines differ, and the names are the finding. */
const apps = ev(`(() => {
  const app = v => { const r = sniffViseInstaller(__sit, 'Cythera ' + v + ' Installer');
    if (!r) return null;
    const e = r.archive.entries.find(x => x.type === 'APPL');
    if (!e) return null;
    const g = viseExtract(r.archive, e);
    return {data: g.data, rsrc: g.rsrc}; };
  const out = {};
  for (const [x, y] of [['1.0.1','1.0.2'], ['1.0.2','1.0.3'], ['1.0.3','1.0.4']]) {
    const A = app(x), B = app(y);
    if (!A || !B) { out[x + ' to ' + y] = null; continue; }
    const d = describeApplicationDiff(A, B);
    out[x + ' to ' + y] = {
      added: d.routines ? d.routines.added.map(r => r.name).sort() : null,
      gone: d.routines ? d.routines.gone.map(r => r.name).sort() : null,
      resized: d.routines ? d.routines.resized.length : null,
      resizedNames: d.routines ? d.routines.resized.map(r => r.name).sort() : null,
      moved: d.routines ? d.routines.moved : null,
      aCount: d.routines ? d.routines.aCount : null,
      forkChanged: d.fork ? d.fork.changed.length : null,
      forkTypes: d.fork ? [...new Set(d.fork.changed.map(c => c.type))].sort().join(' ') : null
    };
  }
  return out;
})()`);
const lastApp = apps['1.0.3 to 1.0.4'];
if (!lastApp) console.log('  skip  the applications could not be taken out of the installers');
else {
  const wantAdded = ['IsAntiAliasedTextEnabled', 'MyFindSymbol', 'SetAntiAliasedTextEnabled'];
  if (lastApp.added.join(', ') !== wantAdded.join(', '))
    fail('what 1.0.4 added to the program', lastApp.added.join(', ') + ' against ' + wantAdded.join(', '));
  else ok('1.0.4 added three routines', lastApp.added.join(', '));
  if (lastApp.gone.length) fail('1.0.4 removed nothing', 'it removed ' + lastApp.gone.join(', '));
  const wantResized = ['TAudio::SetSoundVolume(short, unsigned char)', 'TConvMode::Perform()', 'TDelverApp::RunStart()'];
  if (lastApp.resizedNames.join(', ') !== wantResized.join(', '))
    fail('what 1.0.4 recompiled', lastApp.resizedNames.join(', '));
  else ok('and recompiled three', lastApp.resizedNames.length + ': RunStart, SetSoundVolume, Perform');
  ok('its resource fork', lastApp.forkChanged + ' changed, of types ' + lastApp.forkTypes);
  // The suppression is the point of the routine report, so it is asserted:
  // moved-only has to dwarf the meaningful count, or the report is listing
  // relocation noise as though it were change.
  if (!(lastApp.moved > lastApp.added.length + lastApp.resized))
    fail('moved-only is the noise', `${lastApp.moved} moved against ${lastApp.added.length + lastApp.resized} meaningful`);
  else ok('moved-only is counted and not listed', lastApp.moved + ' moved, ' + (lastApp.added.length + lastApp.resized) + ' meaningful');
}
const firstApp = apps['1.0.1 to 1.0.2'];
if (firstApp && firstApp.added) ok('1.0.1 to 1.0.2 in the program',
  `${firstApp.added.length} added, ${firstApp.gone.length} gone, ${firstApp.resized} recompiled, of ${firstApp.aCount}`);

// ---- the release notes, checked against the bytes --------------------------
/* Glenn Andreas shipped a change history with each release
   (`Cythera 1.0.4 Notes.text`). On 15 September 2026 every claim in it was
   read against the diffs, and this is what that pass established, pinned so
   it cannot quietly stop being true.
 *
 * WHAT IS ASSERTED IS THE JOIN, not the prose: for each documented claim, the
 * resource or routine that carries it must still be one that changed in that
 * release. If a decoder change or a re-mirrored installer moves what changed,
 * the join breaks here rather than in a paragraph nobody re-reads.
 *
 * Three findings are pinned in their own right because they are the ones that
 * would be re-derived from scratch otherwise: 1.0.4 is null guards and nothing
 * else; the five TInterp routines are a compiler artifact and NOT an
 * undocumented interpreter change; and a combat-AI debugger was added in 1.0.2
 * and ships in the retail 1.0.4.
 *
 * 1.0.1's notes cannot be checked at all -- they describe changes from 1.0.0
 * and no 1.0.0 exists on this disk. That is stated rather than left as a gap. */
const eq = (what, got, expect) => {
  if (String(got) !== String(expect)) fail(what, `expected ${JSON.stringify(expect)}, got ${JSON.stringify(got)}`);
  else ok(what, String(got));
};

const notes = ev(`(() => {
  const inst = v => sniffViseInstaller(__sit, 'Cythera ' + v + ' Installer');
  const fileOf = (v, pred) => { const r = inst(v); if (!r) return null;
    const e = r.archive.entries.find(pred); if (!e) return null;
    const g = viseExtract(r.archive, e); return {data: g.data, rsrc: g.rsrc, name: e.name}; };
  const appOf = v => fileOf(v, x => x.type === 'APPL');
  const datOf = v => fileOf(v, x => x.type === 'DelS');
  const spec = v => { const d = datOf(v); return d ? delverArchiveSpec(d.data) : null; };

  // every file in an installer, keyed by path with the version folder stripped
  const filesOf = v => { const r = inst(v); const m = new Map();
    for (const e of r.archive.entries) { let g; try { g = viseExtract(r.archive, e); } catch (err) { continue; }
      m.set(e.path.replace(/^Cythera 1\\.0\\.\\d+ ƒ\\//, ''), g); } return m; };
  const same = (a, b) => !!a && !!b && a.length === b.length && a.every((v, i) => v === b[i]);
  const fileDiff = (x, y) => { const A = filesOf(x), B = filesOf(y);
    const changed = [], added = [], gone = [];
    for (const [p, v] of A) { const o = B.get(p); if (!o) { gone.push(p); continue; }
      if (!same(v.data, o.data) || !same(v.rsrc, o.rsrc)) changed.push(p); }
    for (const p of B.keys()) if (!A.has(p)) added.push(p);
    return {changed, added, gone, count: A.size}; };

  const routines = (x, y) => describeApplicationDiff(appOf(x), appOf(y)).routines;
  const changedIds = (x, y) => new Set(describeDelverDiff(spec(x), spec(y)).changed.map(c => c.resid));

  const out = {};

  /* Who really calls a routine, resolved from the branch displacement rather
     than guessed from what changed nearby. */
  const codeOf = data => { const pef = parsePEF(data); const c = pef.sections.find(s => s.kind === 0);
    return {img: data.subarray(c.containerOffset, c.containerOffset + c.totalSize), rs: pefTracebacks(pef, data)}; };
  const callersOf = (data, rx) => { const C = codeOf(data);
    const t = C.rs.find(r => rx.test(r.name)); if (!t) return [];
    const owner = off => { const r = C.rs.find(x => off >= x.offset && off < x.offset + x.length); return r ? r.name : null; };
    const hits = new Set();
    for (let a = 0; a + 4 <= C.img.length; a += 4) {
      const w = ((C.img[a] << 24) | (C.img[a + 1] << 16) | (C.img[a + 2] << 8) | C.img[a + 3]) >>> 0;
      const d = ppcDecode(w); if (!d || d.mn !== 'bl') continue;
      let disp = w & 0x03FFFFFC; if (disp & 0x02000000) disp -= 0x04000000;
      if (a + disp === t.offset) { const o = owner(a); if (o) hits.add(o); } }
    return [...hits].sort(); };
  out.clearNeedsCallers = callersOf(appOf('1.0.3').data, /TDroppableWindow::ClearNeeds/);
  // Nothing heap-related changed in 1.0.3; all of it is 1.0.2's.
  out.heap23 = describeApplicationDiff(appOf('1.0.2'), appOf('1.0.3')).routines
    .resized.filter(r => /^THeap::/.test(r.name)).map(r => r.name);
  out.heap12 = describeApplicationDiff(appOf('1.0.1'), appOf('1.0.2')).routines
    .resized.filter(r => /^THeap::/.test(r.name)).map(r => r.name).sort();
  out.heap12added = describeApplicationDiff(appOf('1.0.1'), appOf('1.0.2')).routines
    .added.filter(r => /^THeap::/.test(r.name)).map(r => r.name).sort();
  out.strangeDeviceChanged = !!(() => { const g = (S, id) => S.resources.find(x => x.resid === id);
    const a = g(spec('1.0.2'), 0x1175), b = g(spec('1.0.3'), 0x1175);
    if (!a || !b) return false;
    return !(a.data.length === b.data.length && a.data.every((v, i) => v === b.data[i])); })();

  // --- the file-level shape of each release ---
  out.files = {};
  for (const [x, y] of [['1.0.1','1.0.2'], ['1.0.2','1.0.3'], ['1.0.3','1.0.4']]) {
    const d = fileDiff(x, y);
    out.files[x + '->' + y] = {changed: d.changed.length, of: d.count, added: d.added, gone: d.gone,
      inputSprocket: d.changed.filter(p => /InputSprocket/.test(p)).length,
      // Every release swaps its own notes file in and the previous one out,
      // which is churn rather than content and would otherwise sit in the
      // added/gone lists forever.
      addedReal: d.added.filter(p => !/Notes\.text$/.test(p)),
      defendAi: d.changed.includes('CombatAI/Defend.ai')};
  }
  const f12 = filesOf('1.0.1'), f22 = filesOf('1.0.2');
  out.defendAiBytes = [f12.get('CombatAI/Defend.ai').data.length, f22.get('CombatAI/Defend.ai').data.length];

  // --- 1.0.4: null guards and nothing else ---
  const r34 = routines('1.0.3', '1.0.4');
  out.r34 = r34.resized.map(r => ({name: r.name,
    up: (r.added || []).map(a => a.n + ' ' + a.op).sort().join(' '),
    down: (r.removed || []).map(a => a.n + ' ' + a.op).sort().join(' ')}));

  // --- 1.0.3: which routines changed, and which are the compiler's ---
  const r23 = routines('1.0.2', '1.0.3');
  out.r23 = {};
  for (const r of r23.resized) out.r23[r.name] = {compilerOnly: !!r.compilerOnly,
    up: (r.added || []).map(a => a.n + ' ' + a.op).sort().join(' ')};
  out.r23added = r23.added.map(r => r.name).sort();

  // --- the debugger that shipped ---
  const nameSet = v => { const a = appOf(v); return new Set(pefTracebacks(parsePEF(a.data), a.data).map(r => r.name)); };
  const n1 = nameSet('1.0.1'), n4 = nameSet('1.0.4');
  const dbg = [...n4].filter(n => /^TAIDebug::|Decompile(Line|Object)/.test(n));
  out.debugger = {inRetail: dbg.length, inFirst: dbg.filter(n => n1.has(n)).length};

  // --- the byte-level fixes ---
  const A2 = spec('1.0.2'), A3 = spec('1.0.3');
  const get = (S, id) => S.resources.find(r => r.resid === id).data;
  out.rogue = [u16be(get(A2, 0x0501), 270), u16be(get(A3, 0x0501), 270)];
  const ms = (S) => { const d = get(S, 0xF008); const p = 43 * 16;
    return {flags: u16be(d, p + 10), corpse: u16be(d, p + 14) & 0x03FF}; };
  out.harpy = [ms(A2), ms(A3)];
  const props = (S) => { const l = parseDelverPropList(get(S, 0x8108));
    return [l[588], l[589]].map(r => ({flags: r.flags, takeable: !!r.takeable})); };
  out.treasure = [props(A2), props(A3)];

  // --- SIZE, the one claim checkable to the bit ---
  const sizeOf = v => { const a = appOf(v);
    const r = resourceForkSpec(openResourceFork(a.rsrc)).resources.find(x => x.type === 'SIZE');
    return r ? ((r.data[0] << 8) | r.data[1]) : null; };
  out.size = ['1.0.1','1.0.2','1.0.3','1.0.4'].map(sizeOf);

  // --- which named resources carry which claim ---
  const c12 = changedIds('1.0.1', '1.0.2'), c23 = changedIds('1.0.2', '1.0.3');
  out.carriers = {
    '1.0.2 Halos shop': c12.has(0x183e), '1.0.2 Alaric training': c12.has(0x1802),
    '1.0.2 spell damage (0xEB8 added)': !spec('1.0.1').resources.some(r => r.resid === 0x0EB8)
                                        && spec('1.0.2').resources.some(r => r.resid === 0x0EB8),
    '1.0.2 combat targeting': c12.has(0x0413) && c12.has(0x0434),
    '1.0.3 Aethon missiles': c23.has(0x1861), '1.0.3 Prusa Sapphire Book': c23.has(0x184b),
    '1.0.3 Seldane Sapphire Book (Unhayt)': c23.has(0x187a),
    '1.0.3 Tavara shimmer (map)': c23.has(0x8024),
    '1.0.3 Seldane device shadow': c23.has(0x8f34),
    '1.0.3 Replicate': c23.has(0x1a2b),
    '1.0.3 detect spells': c23.has(0x1a03) && c23.has(0x1a04) && c23.has(0x1af3),
  };
  return out;
})()`);

// The shape of each release as files, which is what makes 1.0.4 "the app only"
// and 1.0.3 "much more than the notes say" statements of fact.
eq('1.0.1 to 1.0.2 changes 6 files', notes.files['1.0.1->1.0.2'].changed, 6);
eq('1.0.2 to 1.0.3 changes 18 files', notes.files['1.0.2->1.0.3'].changed, 18);
eq('1.0.3 to 1.0.4 changes 3 files', notes.files['1.0.3->1.0.4'].changed, 3);
/* The largest undocumented change in the whole history. 1.0.3's notes list
   seventeen fixes and none of them is this: sixteen InputSprocket files and a
   new USB HID module. */
eq('1.0.3 rebuilds the InputSprocket drivers', notes.files['1.0.2->1.0.3'].inputSprocket, 15);
eq('and adds a USB HID module', notes.files['1.0.2->1.0.3'].addedReal.join(','), 'USBHIDUniversalModule');
eq('1.0.2 touches no InputSprocket file', notes.files['1.0.1->1.0.2'].inputSprocket, 0);
// "The Defend.ai has been made more intelligent" -- the one claim that is a
// whole file and can be checked by its size.
eq('1.0.2 rewrites Defend.ai', notes.files['1.0.1->1.0.2'].defendAi, true);
eq('and it grows', notes.defendAiBytes.join(' -> '), '584 -> 712');

/* 1.0.4 IS NULL GUARDS AND NOTHING ELSE. Three routines, and every opcode
   added across all three is a move-and-test, a compare-with-zero or a branch.
   That is what makes the release's two-line changelog complete rather than
   partial: TAudio::SetSoundVolume and TConvMode::Perform are the same fix as
   the documented startup crash, applied at two more sites. */
{
  const GUARD = new Set(['mr.', 'bt', 'cmplwi', 'bf', 'cmpwi']);
  const strays = [];
  for (const r of notes.r34) {
    for (const piece of (r.up ? r.up.split(' ') : [])) {
      if (/^\d+$/.test(piece)) continue;
      if (!GUARD.has(piece)) strays.push(r.name + ': ' + piece);
    }
    if (r.down) strays.push(r.name + ' removes ' + r.down);
  }
  eq('1.0.4 recompiles three routines', notes.r34.length, 3);
  if (strays.length) fail('1.0.4 is null guards and nothing else', strays.join('; '));
  else ok('1.0.4 is null guards and nothing else', notes.r34.map(r => r.name.replace(/\(.*/, '') + ' [' + r.up + ']').join(', '));
}

/* THE TINTERP FAMILY IS THE COMPILER, NOT A CHANGE. Five routines grew four to
   eight bytes in 1.0.3 and were read here as an undocumented change to how
   scripts are invoked. Printed side by side the whole difference is a
   redundant `addi rX, rY, 0` -- a register copy -- so the census counts them
   as moves and this asserts the verdict. Without it the same wrong reading is
   one diff away from being made again. */
{
  const interp = Object.keys(notes.r23).filter(n => /^TInterp::/.test(n));
  eq('five TInterp routines changed in 1.0.3', interp.length, 5);
  const notCompiler = interp.filter(n => !notes.r23[n].compilerOnly);
  if (notCompiler.length) fail('and every one is the compiler', notCompiler.join(', '));
  else ok('and every one is the compiler', 'register copies only, not an interpreter change');
}

/* The 1.0.3 claims that land on a routine, each asserted by the shape of what
   the compiler emitted rather than by the byte count. */
{
  const has = (name, op) => notes.r23[name] && notes.r23[name].up.indexOf(op) >= 0;
  const claim = (what, cond, detail) => cond ? ok(what, detail) : fail(what, 'not found');
  claim('Preferences then Save: a flag written in the main event loop',
        has('TApp::MEL()', 'stb'), 'TApp::MEL gains li + stb');
  claim('buying more than one: a count test',
        has('PropItem::AllocateFrame()', 'cmpwi') && has('PropItem::AllocateFrame()', 'bf'),
        'PropItem::AllocateFrame gains cmpwi + bf');
  /* The best-evidenced claim in the whole history. A routine was ADDED and
     wired into exactly the paths the note describes: a new game, a restore,
     and a zone change. A "droppable window" with pending "needs" is the game
     waiting for you to pick a target, which is what "targets" and "modes"
     are. `notes.clearNeedsCallers` is resolved from the branch displacements,
     so it is who really calls it and not who looks like it might. */
  claim('clears targets and modes: ClearNeeds added and wired into both paths',
        notes.clearNeedsCallers.includes('TDelverApp::NewModel()') &&
        notes.clearNeedsCallers.includes('TDelverApp::RestoreModel()'),
        'called from ' + notes.clearNeedsCallers.join(', '));
  claim('the OK-to-take bit: a flag written when a thing is dropped',
        has('TGameSys::DropCommand(short, short, short)', 'stb'), 'DropCommand gains li + stb');
  /* The map is the evidence here, not the routine. TeleportTo does change,
     but resolving its calls showed the change is the ClearNeeds wiring above
     -- an indirect virtual call replaced by a direct one -- so reading it as
     the shimmer fix was this pass over-reaching, and the correction is kept
     rather than quietly dropped. */
  claim('Tavara shimmer: the map itself changed',
        notes.carriers['1.0.3 Tavara shimmer (map)'], 'map 0x8024 Tavara Fort');
  claim('and TeleportTo changed for ClearNeeds, not for the shimmer',
        notes.clearNeedsCallers.includes('TGameSys::TeleportTo(short, short, short)'),
        'the teleport path clears pending needs too');
  eq('1.0.3 adds one routine', notes.r23added.join(','), 'TDroppableWindow::ClearNeeds()');
}

/* A COMBAT-AI DEBUGGER SHIPS IN THE RETAIL GAME. Added in 1.0.2, never
   mentioned in any changelog, and still in 1.0.4: eight TAIDebug methods
   including Disassemble, plus the two SCombatAIEntry decompilers. Worth
   pinning because it is the most surprising thing in the whole history and
   because "is it still there in the shipped build" is the part that would be
   misremembered. */
eq('a combat-AI debugger is in the retail 1.0.4', notes.debugger.inRetail, 10);
eq('and none of it was in 1.0.1', notes.debugger.inFirst, 0);

/* The three fixes that can be read to the byte, each one a claim in the notes
   proved rather than corroborated. */
eq('the rogue archetype held the lockpick ITEM where the skill belonged',
   notes.rogue.join(' -> '), '265 -> 213');
eq('the harpy stopped leaving a corpse', notes.harpy.map(h => h.corpse).join(' -> '), '291 -> 0');
eq('and gained two flag bits', notes.harpy.map(h => '0x' + h.flags.toString(16)).join(' -> '), '0x42 -> 0x3042');
eq('the buried treasure became takeable',
   notes.treasure.map(p => p.map(r => r.takeable).join('/')).join(' -> '), 'false/false -> true/true');
/* The one claim checkable to the bit: "DisplayManagerAware bit set for 68K".
   Bit 0x0004 of the SIZE flags, set in 1.0.3 and in no release before it. */
eq('DisplayManagerAware is set in 1.0.3 and not before',
   notes.size.map(f => (f & 0x0004) ? 'set' : '-').join(' '), '- - set set');

/* THE ONE CLAIM WHOSE CHANGE IS IN THE PREVIOUS RELEASE.
 *
 * "Seldane object stops working, turning all white" is listed under 1.0.3.
 * The Seldane object is the **strange device** (prop type 0x175, the
 * Think-a-Dot), whose state lives in persistent storage slots 256 and 257 --
 * which is what the note's own parenthetical blames, "a corrupted persistance
 * storage heap in 1.0.x that was fixed in 1.0.2".
 *
 * Three things follow and all three are asserted: the device's own item class
 * did not change in 1.0.3; no THeap routine changed in 1.0.3; and every piece
 * of heap work -- two routines added and three recompiled -- is in 1.0.2. So
 * the line describes 1.0.2's fix and the residual cases it left, rather than a
 * change made in 1.0.3. It is the only entry in the whole history whose change
 * is not in the release that lists it. */
eq('the strange device class is untouched in 1.0.3', notes.strangeDeviceChanged, false);
eq('and no heap routine changed in 1.0.3', notes.heap23.length, 0);
eq('every heap change is 1.0.2 (recompiled)', notes.heap12.join(', '),
   'THeap::Allocate(long), THeap::Free(HeapHeader*), THeap::Load(TSegFile*)');
eq('and added there', notes.heap12added.join(', '),
   'THeap::PerformGC(), THeap::SimpleAllocate(long, long&)');

// Each documented claim still landing on the resource that carries it.
{
  const missing = Object.entries(notes.carriers).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) fail('every claim still lands on its resource', missing.join('; '));
  else ok('every claim still lands on its resource', Object.keys(notes.carriers).length + ' claims joined to what changed');
}

// ---- the negative control --------------------------------------------------
const neg = ev(`(() => {
  const a = __specs['1.0.3'], b = __specs['1.0.4'];
  if (!a || !b) return null;
  // One byte of one resource, which the comparison must see. Without this the
  // "unchanged between 1.0.3 and 1.0.4" result above is indistinguishable
  // from a comparison that always says identical.
  const bent = {scenarioTitle: b.scenarioTitle, playerName: b.playerName,
                formatMajor: b.formatMajor, formatMinor: b.formatMinor,
                resources: b.resources.map(r => ({...r}))};
  const victim = bent.resources.find(r => r.resid === 0x8E04);
  victim.data = victim.data.slice(); victim.data[17] ^= 0x01;
  const d = describeDelverDiff(a, bent);
  // And a resource taken away must read as removed, not as changed.
  const short = {...bent, resources: bent.resources.filter(r => r.resid !== 0x8E34)};
  const d2 = describeDelverDiff(a, short);
  return {oneByteSeen: d.changed.length === 1 && d.changed[0].resid === 0x8E04,
          removalSeen: d2.removed.some(r => r.resid === 0x8E34)};
})()`);
if (!neg) console.log('  skip  the negative control needs 1.0.3 and 1.0.4');
else if (!neg.oneByteSeen) fail('negative control', 'a single flipped byte was not reported as a change');
else if (!neg.removalSeen) fail('negative control', 'a removed resource was not reported as removed');
else ok('the comparison can fail', 'one flipped byte is seen, and a removed resource reads as removed');

const summary = out.filter(r => !r.missing).map(r => r.pair.replace(/1\.0\./g, '') + ': ' + r.changed).join(', ');
console.log(failures ? `\n${failures} failure(s)`
  : `\n  releases: ${summary} resources changed` +
    (lastApp ? `; 1.0.4 changed the program only, in ${lastApp.added.length + lastApp.resized} routines` : ''));
process.exit(failures ? 1 : 0);
