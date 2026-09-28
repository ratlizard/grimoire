#!/usr/bin/env node
// js/delv-apppatch.js and js/mac-ppc-asm.js, over the application.
//
//   node utilities/app_patch_check.mjs <Cythera.data> <Cythera.rsrc> [llvm-mc]
//
// WHY. The application patch writes machine code into a program nobody can
// step through here, so every word it writes has to be shown to be the word
// meant before anyone runs it. Four things are held:
//
// 1. THE ASSEMBLER against the decoder, over the code section. Every word
//    js/mac-ppc.js reads is printed as it prints it and handed to
//    ppcAssemble at its own address, and must come back as the same word.
//    The decoder is itself held to LLVM word for word (ppc_check.mjs), so a
//    word that survives the round trip is written as LLVM would read it.
//    Inside a routine's body (entry to traceback table, by pefTracebacks)
//    the only words allowed to be refused are floating point, which no fix
//    needs; outside the bodies are the traceback tables and the jump
//    tables' data, which decode by accident and may be refused, never
//    miswritten.
//
// 2. EVERY LINE OF EVERY FIX against LLVM's assembler, when llvm-mc is
//    there: the line, its target turned into LLVM's `.+n`, assembled by
//    llvm-mc, must give the word written, all 32 bits for an instruction
//    and every bit but the displacement for a branch, whose displacement
//    LLVM leaves to a fixup. The displacement is then held separately: the
//    decoder's reading of the word written must reach the address the line
//    names. So a fix line is checked by a second assembler, not only by
//    this one's own inverse.
//
// 3. THE PROGRAM PATCHED, every fix at once and each fix alone: the PEF
//    container still parses; the code section is the old one grown, word
//    for word the same outside the sites and the caves; the data section
//    unpacks to the old one but for the letters the text fixes change; the
//    loader and its relocations are untouched; every routine the traceback
//    walk found is found again where it was; the second fragment (the
//    Control Strip library) sits where cfrg 0 now says, unchanged, and
//    parses; the resource fork differs in the resources the fixes name and
//    cfrg 0, and nowhere else.
//
// 4. THE REFUSALS. A program patched already, a site whose word is not the
//    one a fix expects, and two fixes that change one word must each
//    refuse, naming the fix. Each is a negative control too: a check of
//    `was` that could not fail would pass a patch of the wrong program.
//
// NEGATIVE CONTROLS for 1: the same round trip with every word assembled
// four bytes from where it sits must change exactly the relative branches,
// and with every `lwz`'s first register moved by one must change exactly
// the `lwz` words. A comparison that cannot see those would pass anything.
import { readFileSync, existsSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const [dataPath, rsrcPath, llvmMc] = process.argv.slice(2);
if (!dataPath || !rsrcPath) { console.error('usage: app_patch_check.mjs <Cythera.data> <Cythera.rsrc> [llvm-mc]'); process.exit(2); }
if (!existsSync(dataPath) || !existsSync(rsrcPath)) { console.log('SKIP: no application forks at ' + dataPath); process.exit(3); }

const ctx = vm.createContext({ TextDecoder, TextEncoder });
for (const f of ['js/mac-bytes.js', 'js/mac-containers.js', 'js/mac-resfork.js', 'js/mac-pef.js', 'js/mac-ppc.js', 'js/mac-ppc-asm.js', 'js/delv-appfixes.js', 'js/delv-apppatch.js'])
  new vm.Script(readFileSync(f, 'utf8'), { filename: f }).runInContext(ctx);
const FIXES = vm.runInContext('APP_FIXES', ctx);
const data = new Uint8Array(readFileSync(dataPath)), rsrc = new Uint8Array(readFileSync(rsrcPath));
let failed = 0;
const fail = m => { failed++; console.log('FAIL ' + m); };
const hex = w => (w >>> 0).toString(16).toUpperCase().padStart(8, '0');
const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

// ---- 1. the assembler against the decoder ----------------------------------
const pef = ctx.parsePEF(data);
const code = pef.sections.find(s => s.kind === 0);
const routines = ctx.pefTracebacks(pef, data);
const inBody = new Uint8Array(code.totalSize >>> 2);
for (const r of routines) for (let a = r.offset; a < r.tableOffset; a += 4) inBody[a >>> 2] = 1;
const isFloat = mn => /^(f|lf|stf)/.test(mn);
function roundTrip(shift, mutate) {
  const out = { read: 0, written: 0, differ: 0, bodyRefused: new Map(), outsideRefused: 0, rel: 0, lwz: 0, firstDiffer: null };
  for (let a = 0; a < code.totalSize; a += 4) {
    const w = u32(data, code.containerOffset + a), d = ctx.ppcDecode(w);
    if (!d) continue;
    out.read++;
    let text = ctx.ppcTextAt(w, a);
    if (mutate) text = mutate(text);
    let x;
    try { x = ctx.ppcAssemble(text, a + shift); }
    catch (e) { if (inBody[a >>> 2]) out.bodyRefused.set(d.mn, (out.bodyRefused.get(d.mn) || 0) + 1); else out.outsideRefused++; continue; }
    out.written++;
    if (d.branch && !d.indirect && !d.aa && typeof d.disp === 'number') out.rel++;
    if (d.mn === 'lwz') out.lwz++;
    if (x !== w) { out.differ++; if (!out.firstDiffer) out.firstDiffer = hex(a) + ' ' + text + ' ' + hex(w) + ' -> ' + hex(x); }
  }
  return out;
}
const rt = roundTrip(0, null);
if (rt.differ) fail(rt.differ + ' words written differently from how they read, first ' + rt.firstDiffer);
const notFloat = [...rt.bodyRefused].filter(([mn]) => !isFloat(mn));
if (notFloat.length) fail('refused inside a routine: ' + notFloat.map(([m, n]) => m + ' ' + n).join(', '));
const floats = [...rt.bodyRefused].reduce((s, [, n]) => s + n, 0);
// The controls.
const moved = roundTrip(4, null);
if (moved.differ !== moved.rel) fail('assembled four bytes along, ' + moved.differ + ' words changed where ' + moved.rel + ' relative branches should');
const lwzShift = roundTrip(0, t => t.replace(/^lwz (\d+),/, (m, r) => 'lwz ' + ((+r + 1) % 32) + ','));
if (lwzShift.differ !== lwzShift.lwz) fail('with lwz\'s register moved, ' + lwzShift.differ + ' words changed where ' + lwzShift.lwz + ' lwz should');

// ---- 3. the program patched ---------------------------------------------------
function holdPatched(fixes, label) {
  let r;
  try { r = ctx.applyAppFixes({ data, rsrc }, fixes); } catch (e) { fail(label + ': ' + e.message); return null; }
  const p2 = ctx.parsePEF(r.data);
  if (!p2) { fail(label + ': the patched data fork is not a PEF container'); return r; }
  const c2 = p2.sections.find(s => s.kind === 0);
  if (c2.totalSize !== code.totalSize + r.grownBy || c2.packedSize !== code.packedSize + r.grownBy) fail(label + ': the code section is ' + c2.totalSize + ' bytes');
  if (r.grownBy % 16 || r.grownBy < r.caveBytes) fail(label + ': grown by ' + r.grownBy + ' for ' + r.caveBytes + ' bytes of caves');
  // The code outside the sites and caves is the old code.
  const touched = new Set();
  for (const a of r.applied) for (const w of a.words) touched.add(w.at);
  // A text fix inside the code section (the string constants CodeWarrior
  // put after the routines) touches the words its letters are in.
  const codeLo = code.containerOffset, codeHi = codeLo + code.totalSize;
  let codeLetters = 0, dataLetters = 0;
  for (const f of fixes) for (const e of f.data || []) {
    const was = ctx.encodeMacRoman(e.was), now = ctx.encodeMacRoman(e.now);
    for (let k = 0; k < was.length; k++) {
      if (was[k] === (k < now.length ? now[k] : 0)) continue;
      if (e.at + k >= codeLo && e.at + k < codeHi) { codeLetters++; touched.add((e.at + k - codeLo) & ~3); } else dataLetters++;
    }
  }
  let codeChanged = 0;
  for (let k = codeLo; k < codeHi; k++) if (data[k] !== r.data[k]) codeChanged++;
  const siteBytes = r.applied.reduce((s, a) => s + a.words.filter(w => w.was !== null).reduce((t, w) => t + [0, 8, 16, 24].filter(b => ((w.was >>> b) & 0xFF) !== ((w.now >>> b) & 0xFF)).length, 0), 0);
  if (codeChanged !== siteBytes + codeLetters) fail(label + ': ' + codeChanged + ' bytes of the code changed where the sites change ' + siteBytes + ' and the text ' + codeLetters);
  for (let a = 0; a < code.totalSize; a += 4) {
    const was = u32(data, code.containerOffset + a), now = u32(r.data, c2.containerOffset + a);
    if (!touched.has(a) && was !== now) { fail(label + ': the word at ' + hex(a) + ' changed and no fix names it'); break; }
  }
  for (let a = code.totalSize + r.caveBytes; a < c2.totalSize; a += 4)
    if (u32(r.data, c2.containerOffset + a)) { fail(label + ': the padding after the caves is not zero'); break; }
  for (const a of r.applied) for (const w of a.words)
    if (u32(r.data, c2.containerOffset + w.at) !== w.now) fail(label + ': ' + a.id + ' reports ' + hex(w.now) + ' at ' + hex(w.at) + ' and the file has another');
  // The data section: the same bytes unpacked, but for the letters changed.
  const i1 = ctx.pefLoad(data), i2 = ctx.pefLoad(r.data);
  const di = pef.sections.findIndex(s => s.kind === 2);
  const d1 = i1.contents[di].bytes, d2 = i2.contents[di].bytes;
  if (i2.contents[di].problem || d1.length !== d2.length) fail(label + ': the data section does not unpack as it did');
  let changed = 0;
  for (let k = 0; k < d1.length; k++) if (d1[k] !== d2[k]) changed++;
  if (changed !== dataLetters) fail(label + ': ' + changed + ' bytes of the unpacked data section changed where the text fixes change ' + dataLetters);
  // The loader and its relocations.
  const ld1 = pef.sections.find(s => s.kind === 4), ld2 = p2.sections.find(s => s.kind === 4);
  if (!same(data.subarray(ld1.containerOffset, ld1.containerOffset + ld1.packedSize), r.data.subarray(ld2.containerOffset, ld2.containerOffset + ld2.packedSize)))
    fail(label + ': the loader section changed');
  for (const [sec, m] of i1.relocs.bySection) {
    const m2 = i2.relocs.bySection.get(sec);
    if (!m2 || m2.size !== m.size) { fail(label + ': the relocations of section ' + sec + ' differ'); continue; }
    for (const [off, t] of m) { const t2 = m2.get(off); if (!t2 || JSON.stringify(t2) !== JSON.stringify(t)) { fail(label + ': the relocation at ' + sec + ':' + off + ' differs'); break; } }
  }
  const r2 = ctx.pefTracebacks(p2, r.data);
  if (r2.length !== routines.length || r2.some((x, i) => x.offset !== routines[i].offset || x.mangled !== routines[i].mangled))
    fail(label + ': the traceback walk finds ' + r2.length + ' routines where it found ' + routines.length);
  // The resource fork and the fragments it places.
  const f1 = ctx.openResourceFork(rsrc), f2 = ctx.openResourceFork(r.rsrc);
  const named = new Set(['cfrg 0']);
  for (const f of fixes) for (const e of f.rsrc || []) named.add(e.type + ' ' + e.id);
  for (const t of f1.typeList) for (const e of f1.resourcesByType[t.type]) {
    const e2 = (f2.resourcesByType[t.type] || []).find(x => x.id === e.id);
    if (!e2) { fail(label + ': ' + t.type + ' ' + e.id + ' is gone'); continue; }
    const differs = !same(f1.dataOf(t.type, e), f2.dataOf(t.type, e2));
    if (differs && !named.has(t.type + ' ' + e.id)) fail(label + ': ' + t.type + ' ' + e.id + ' changed and no fix names it');
  }
  const cf = f2.dataOf('cfrg', f2.resourcesByType.cfrg.find(e => e.id === 0)), cf1 = f1.dataOf('cfrg', f1.resourcesByType.cfrg.find(e => e.id === 0));
  let p = 0x20, q = 0x20;
  for (let i = 0; i < u32(cf, 0x1C); i++) {
    const off = u32(cf, p + 0x18), len = u32(cf, p + 0x1C), off1 = u32(cf1, q + 0x18), len1 = u32(cf1, q + 0x1C);
    const frag = r.data.subarray(off, off + len), frag1 = data.subarray(off1, off1 + len1);
    if (!ctx.parsePEF(frag)) fail(label + ': cfrg 0 member ' + i + ' does not point at a PEF container');
    if (off1 >= code.containerOffset + code.totalSize && !same(frag, frag1)) fail(label + ': the fragment cfrg 0 member ' + i + ' names changed');
    if (off1 < code.containerOffset + code.totalSize && len !== len1 + r.grownBy) fail(label + ': the program\'s length in cfrg 0 did not grow with it');
    p += (cf[p + 0x28] << 8) | cf[p + 0x29]; q += (cf1[q + 0x28] << 8) | cf1[q + 0x29];
  }
  return r;
}
const all = holdPatched(FIXES, 'every fix');
for (const f of FIXES) holdPatched([f], f.id);

// ---- 2. each line against LLVM ------------------------------------------------
let llvmLines = 0, llvmNote = 'no llvm-mc';
if (all && llvmMc && existsSync(llvmMc)) {
  const lines = [];
  for (const a of all.applied) for (const w of a.words) {
    const t = w.text.replace(/;.*$/, '').trim();
    const d = ctx.ppcDecode(w.now);
    const m = /^(\S+)\s+(.*?)\s*@(\S+)$/.exec(t);
    const target = d && d.branch && !d.indirect && !d.aa ? ((w.at + d.disp) >>> 0) : null;
    let llvm = t;
    if (m) {
      // The target the line names, found the way the applier found it.
      const name = m[3];
      const fix = FIXES.find(f => f.id === a.id);
      let want = /^0x/i.test(name) ? parseInt(name, 16) : null;
      if (want === null) {
        const lab = new Map(); let at = all.applied.find(x => x.id === a.id).caveAt;
        for (const raw of fix.cave || []) { const s = raw.replace(/;.*$/, '').trim(); if (!s) continue; const L = /^(\w+):$/.exec(s); if (L) lab.set(L[1], at); else at += 4; }
        if (all.applied.find(x => x.id === a.id).caveAt !== null) lab.set('cave', all.applied.find(x => x.id === a.id).caveAt);
        want = lab.has(name) ? lab.get(name) : ctx.appRoutineAddresses(pef, data).get(name);
      }
      if (target !== want) fail(a.id + ': "' + t + '" at ' + hex(w.at) + ' reaches ' + (target === null ? 'nothing' : hex(target)) + ', not ' + (want === undefined ? name : hex(want)));
      llvm = m[1] + ' ' + (m[2] ? m[2] + ' ' : '') + '.+' + (((want >>> 0) - w.at) | 0);
    }
    lines.push({ fix: a.id, at: w.at, word: w.now, text: t, llvm, branch: !!m });
  }
  const dir = mkdtempSync(join(tmpdir(), 'app-patch-'));
  const src = join(dir, 'in.s');
  writeFileSync(src, lines.map(l => l.llvm).join('\n') + '\n');
  const run = spawnSync(llvmMc, ['--triple=powerpc', '--show-encoding', src], { encoding: 'utf8', maxBuffer: 64 << 20 });
  rmSync(dir, { recursive: true, force: true });
  const enc = (run.stdout || '').split('\n').filter(l => /# encoding: \[/.test(l)).map(l => /\[(.*)\]/.exec(l)[1].split(','));
  if (enc.length !== lines.length) fail('llvm-mc read ' + enc.length + ' lines of ' + lines.length + (run.stderr ? ': ' + run.stderr.split('\n')[0] : ''));
  const maskOf = e => {
    let mask = 0, value = 0;
    e.forEach((b, k) => {
      const shift = 24 - 8 * k;
      b = b.trim();
      if (/^0x[0-9a-f]+$/i.test(b)) { mask |= 0xFF << shift; value |= parseInt(b, 16) << shift; }
      else if (/^0b[01A]+$/.test(b)) {
        const bits = b.slice(2);
        for (let j = 0; j < 8; j++) { const c = bits[j]; if (c !== 'A') { mask |= 1 << (shift + 7 - j); if (c === '1') value |= 1 << (shift + 7 - j); } }
      }
    });
    return { mask: mask >>> 0, value: value >>> 0 };
  };
  if (enc.length === lines.length) lines.forEach((l, i) => {
    const { mask, value } = maskOf(enc[i]);
    if (!l.branch && mask !== 0xFFFFFFFF) fail(l.fix + ': llvm-mc left part of "' + l.text + '" to a fixup');
    if (((l.word & mask) >>> 0) !== value) fail(l.fix + ': "' + l.text + '" at ' + hex(l.at) + ' is ' + hex(l.word) + ', llvm-mc writes ' + enc[i].join(','));
    llvmLines++;
  });
  // The control: each word against the next line's encoding must disagree
  // wherever the two words differ outside a branch's displacement, or the
  // comparison could not see a wrong one.
  let eligible = 0, caught = 0;
  if (enc.length === lines.length) for (let i = 0; i + 1 < lines.length; i++) {
    const { mask, value } = maskOf(enc[i + 1]);
    if ((((lines[i].word ^ lines[i + 1].word) & mask) >>> 0) === 0) continue;   // alike but for a displacement
    eligible++;
    if (((lines[i].word & mask) >>> 0) !== value) caught++;
  }
  if (caught !== eligible) fail('compared a line out of step, llvm-mc disagreed ' + caught + ' times in ' + eligible);
  llvmNote = llvmLines + ' fix lines agree with llvm-mc (out of step, ' + caught + ' of ' + eligible + ' disagree)';
}

// ---- 4. the refusals ----------------------------------------------------------------
const refuses = (label, fn, want) => {
  try { fn(); fail(label + ' was not refused'); }
  catch (e) { if (want && !want.test(e.message)) fail(label + ' was refused for another reason: ' + e.message); }
};
if (all) refuses('a program patched already', () => ctx.applyAppFixes({ data: all.data, rsrc: all.rsrc }, FIXES), /code section/);
const withSite = FIXES.find(f => (f.sites || []).length);
const bent = Uint8Array.from(data);
bent[code.containerOffset + withSite.sites[0].at + 3] ^= 1;
refuses('a site whose word is not the expected one', () => ctx.applyAppFixes({ data: bent, rsrc }, [withSite]), new RegExp('^' + withSite.id + ': expected'));
refuses('two fixes that change one word', () => ctx.applyAppFixes({ data, rsrc }, [withSite, Object.assign({}, withSite, { id: 'twin' })]), /twin: changes the word/);
refuses('a fix chosen twice', () => ctx.applyAppFixes({ data, rsrc }, [withSite, withSite]), /chosen twice/);

const hooks = FIXES.filter(f => f.kind === 'hook').map(f => f.method);
console.log(`${rt.written.toLocaleString()} of ${rt.read.toLocaleString()} code words written back the same (${floats} floating-point words inside routines, and ${rt.outsideRefused} outside, not written); ` +
  `${FIXES.length} fixes applied together and alone${all ? ', the code grown by ' + all.grownBy + ' bytes' : ''}; ${llvmNote}; hooks on methods ${hooks.join(', ')}; ` +
  `controls: ${moved.differ} branches moved, ${lwzShift.differ} lwz changed, four refusals`);
if (failed) { console.log(failed + ' failure(s)'); process.exit(1); }
