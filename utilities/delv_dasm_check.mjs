#!/usr/bin/env node
// Does the viewer's disassembler walk the bytecode the way delvmod's does?
//
//   node utilities/delv_dasm_check.mjs index.html delvmod "$TMPDIR/Cythera Data.data"
//
// delv_crosscheck.mjs proves the two OPCODE TABLES identical -- mnemonics,
// operand widths, expectation counts, all eight symbol tables. What it never
// proved is the code that walks them: ddasm's Disassembler had never been RUN
// against dvmDisassemble in js/delv-script.js, so the expectation stack, the
// code/text mode switching, the subroutine handling and the operand bytes
// actually consumed were guarded only by the decoder snapshot -- which proves
// a walk unchanged, never right. This closes that hole the same way
// delv_graphics_check.mjs closed it for decompressDCG.
//
// The comparison is over canonical decode events, not rendered text (the two
// sides format differently on purpose). utilities/delv_dasm_ref.py runs
// delvmod's real Disassembler over every script resource and flattens each
// function into [offset, opcode] / ["t", offset] events; this harness runs
// the page's real dvmExtents + dvmDisassemble over the same decrypted bytes
// and produces the same shape. Two walks that consume the same bytes agree
// event for event; a walk that desyncs by one operand byte diverges
// immediately. See the header of delv_dasm_ref.py for the event grammar and
// the ddasm bookkeeping it normalises.
//
// KNOWN DIVERGENCES are pinned below, not discovered as mystery failures.
// Bryce Schroeder recorded that his disassembler handled all of Cythera's
// script code with exactly six exceptions -- two broken resources and four
// whose nested subroutines defeat a linear reading (the Strange Device
// object class, and the character classes for Tros, Palaestra and Pheres,
// whose lecture dialogue is implemented unusually; forum compendium,
// "DELVER SCRIPTING - NESTED SUBROUTINES"). Those plus the structural
// classes listed at KNOWN below are expected to disagree; everything else
// must match exactly, and the check fails when a pinned divergence starts
// PASSING too, so the list cannot rot.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import vm from 'node:vm';
import { makeSandbox } from './dom_stub.mjs';
import { pageSource } from './page_scripts.mjs';

const [htmlPath = 'index.html', delvPath = 'delvmod', dataPath] =
  process.argv.slice(2);
const verbose = process.env.DASM_VERBOSE === '1';

let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };

// ---- the delvmod side ------------------------------------------------------
const refJson = execFileSync('python3',
  ['utilities/delv_dasm_ref.py', delvPath, dataPath],
  { maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'ignore'], encoding: 'utf8' });
const ref = JSON.parse(refJson);

// ---- the viewer side -------------------------------------------------------
const { sandbox } = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), { filename: htmlPath }).runInContext(ctx);
sandbox.__archive = new Uint8Array(readFileSync(dataPath));
vm.runInContext('parseArchiveBytes(__archive, {name:"Cythera Data"})', ctx);

// Mirrors dvmRender's traversal exactly -- extents, the prose-head shortcut,
// then dvmDisassemble -- because dvmRender is what the page shows and
// dvmDisassemble is the walk under test. A function whose head reads as
// prose is rendered as a string and never disassembled; it is reported as
// {prose:1} and checked more loosely below.
vm.runInContext(`function __dasmEvents(resid) {
  let raw; try { raw = getResourceBytes(resid); } catch (e) { return { missing: true }; }
  if (!raw || raw.length < 4) return { empty: true };
  const b = smartDecrypt(raw, resid).data;
  const objs = dvmExtents(b, resid);
  const functions = {}, others = {};
  for (const [st, en, kind] of objs) {
    const seg = b.subarray(st, Math.min(en, b.length));
    if (!seg.length) continue;
    if (kind !== 'function') { others[st] = kind; continue; }
    const body = seg.subarray(3);
    let z = -1;
    for (let i = 0; i < body.length; i++) if (body[i] === 0) { z = i; break; }
    const head = z > 0 ? body.subarray(0, z) : body;
    if (body.length && body[0] < 0x80 && dvmIsProse(head)) { functions[st] = { prose: 1 }; continue; }
    const r = dvmDisassemble(seg, 3);
    functions[st] = r.ops.map(op => op[2] === 'string(implicit)'
      ? ['t', st + op[0]] : [st + op[0], b[st + op[0]]]);
  }
  return { functions, others };
}`, ctx);
const jsEvents = resid =>
  vm.runInContext(`JSON.parse(JSON.stringify(__dasmEvents(${resid})))`, ctx);

// ---- known divergences -----------------------------------------------------
// Two classes, every member verified by hand before being pinned. A resource
// listed here must actually diverge; one that stops diverging fails the check
// so an entry cannot outlive its reason.
//
// This list used to be four classes and 154 resources: the harness's first
// run also caught three real viewer bugs -- the text-entry rule (delvmod's
// direct mode reads ANY byte < 0x80 as output text on an empty expectation
// stack, where dvmDisassemble demanded a printable run of 3+), the
// prose-head misfire (dvmIsProse counted opcode bytes >= 0x80 as prose, so
// every `return "text"` skill description rendered as a garbled string), and
// the switch case list (a switch's closing 0x40 carries a count and a label
// array, not an if's single target; 0x0E95 and 0x0E96 are the archive's only
// two switches and both walked into their own label arrays). All three are
// fixed in js/delv-script.js and 121 resources left this list. What remains:
//
//   recovery -- ddasm sweeps regions no reference points at and recovers
//     functions from them; the viewer discovers objects only by following
//     drefs, so an unreferenced function (0x1828 has one at offset 2) is
//     invisible to it. A viewer feature gap, not a desync.
//   decrypt -- delvmod's known_encrypted/known_clear say nothing about these
//     eighteen and its default leaves them as ciphertext it then fails to
//     parse; the viewer's entropy heuristic decrypts them and gets valid
//     bytecode that disassembles cleanly. These are the same 18 resources
//     CLAUDE.md records the old viewer heuristic disagreeing on -- here the
//     ORACLE is the short side.
const KNOWN_CLASSES = [
  ['recovery: ddasm finds an unreferenced function the viewer does not', [
    '1024', '1148', '1174', '1175', '180D', '1828', '1829', '182A', '182D',
    '182E', '183E', '1848', '1858']],
  ['decrypt: delvmod leaves it encrypted, the heuristic rightly does not', [
    '1402', '1406', '140A', '140E', '1412', '1416', '141A', '141E', '1422',
    '1426', '3004', '3006', '300A', '300C', '300E', '3010', '3014', '301C']],
];
const KNOWN = new Map();
for (const [why, list] of KNOWN_CLASSES)
  for (const r of list) KNOWN.set(r, why);

// ---- compare ---------------------------------------------------------------
let compared = 0, identical = 0, proseChecked = 0;
let onlyPy = 0, onlyJs = 0;
const divergent = [];

for (const [ridHex, pyRec] of Object.entries(ref)) {
  const resid = parseInt(ridHex, 16);
  const js = jsEvents(resid);
  if (!pyRec.ok) {
    // delvmod refused it (empty or truncated); the viewer must not have
    // conjured functions out of it either.
    if (js.functions && Object.keys(js.functions).length)
      divergent.push([ridHex, `delvmod errored (${pyRec.error}) but the viewer decoded functions`]);
    continue;
  }
  const pyF = pyRec.functions || {};
  const jsF = js.functions || {};
  const offsets = new Set([...Object.keys(pyF), ...Object.keys(jsF)]);
  let bad = null;
  for (const off of offsets) {
    const p = pyF[off], j = jsF[off];
    if (p === undefined) { onlyJs++; bad = bad || `function at ${off} only in the viewer`; continue; }
    if (j === undefined) { onlyPy++; bad = bad || `function at ${off} only in delvmod`; continue; }
    compared++;
    if (j.prose) {
      // The viewer showed this function as a string; delvmod must at least
      // have read direct text at the same place (body start = offset + 3).
      proseChecked++;
      const want = Number(off) + 3;
      if (!(p.length && p[0][0] === 't' && p[0][1] === want))
        bad = bad || `prose function at ${off}: delvmod did not read text at ${want}`;
      continue;
    }
    if (p.length !== j.length) {
      bad = bad || `function at ${off}: ${p.length} events vs ${j.length}`;
    } else {
      for (let i = 0; i < p.length; i++) {
        if (p[i][0] !== j[i][0] || p[i][1] !== j[i][1]) {
          bad = bad || `function at ${off}, event ${i}: ` +
            `py ${JSON.stringify(p[i])} vs js ${JSON.stringify(j[i])}` +
            (verbose ? ` (py ${JSON.stringify(p.slice(Math.max(0, i - 2), i + 4))}` +
                       ` js ${JSON.stringify(j.slice(Math.max(0, i - 2), i + 4))})` : '');
          break;
        }
      }
      if (!bad) identical++;
    }
  }
  if (bad) divergent.push([ridHex, bad]);
}

// ---- verdict ---------------------------------------------------------------
for (const [ridHex, why] of divergent) {
  const known = KNOWN.get(ridHex);
  if (known) { KNOWN.delete(ridHex); if (verbose) console.error(`known ${ridHex}: ${why} (${known})`); }
  else fail(ridHex, why);
}
for (const [ridHex, why] of KNOWN)
  fail(ridHex, `pinned as divergent (${why}) but now matches -- remove it from KNOWN`);

console.log(`${compared} functions compared across ${Object.keys(ref).length} resources: ` +
  `${identical} identical, ${proseChecked} prose-checked, ` +
  `${divergent.length} divergent (${divergent.length - failures} known), ` +
  `${onlyPy} only-delvmod, ${onlyJs} only-viewer`);
process.exit(failures ? 1 : 0);
