#!/usr/bin/env node
// Is the folded script view a faithful reorganisation of the disassembly?
//
//   node utilities/fold_check.mjs index.html "$TMPDIR/Cythera Data.data"
//
// WHY. js/delv-fold.js renders a Delver VM script as something closer to
// source: the expression tree folded into calls and infix operators. Doing that
// needs one fact the raw listing never has to know -- how many values each
// postfix op consumes -- and that fact is written down nowhere. delvmod's ddasm
// emits postfix, so it never needs arity; its rdasm is a flat assembler and
// carries none; the wiki's RDASM Opcodes page gives the semantics in prose
// ("The usual arithmetic operation", "length of object on top of stack") and
// never a number. DVM_POPS is therefore read off those descriptions, and a
// misreading would not look like an error -- it would look like a plausible
// line of source saying the wrong thing, which is the worst failure available
// here. So it is measured rather than trusted.
//
// THREE ASSERTIONS, and they fail differently:
//
// 1. NOTHING UNDERFLOWS. An op that consumes two values with only one before
//    it means DVM_POPS is too greedy for that op. Every such place is marked
//    in the folded text and counted here; the count must be nil.
//
// 2. A SINGLE-VALUE FRAME HOLDS EXACTLY ONE VALUE. `return`, `print`, `if`,
//    an assignment's right-hand side -- each opens a frame that is one
//    expression by definition, so a frame of that kind left holding two values
//    means DVM_POPS is too timid somewhere inside it. An argument list is
//    deliberately several values and is excluded by which op opened it, not by
//    how it came out.
//
// 3. RE-EXPANDING GIVES BACK THE SAME OPS. The tree is walked back out to a
//    flat op sequence and compared with dvmDisassemble's own, op for op,
//    including the closing 0x40s and their branch targets. Equal means the tree
//    lost nothing and invented nothing. This is the half that (1) and (2)
//    cannot see: an arity table can be perfectly balanced and still have
//    attached a value to the wrong parent.
//
// WHAT IT CANNOT SEE. That the rendering is the right ENGLISH for an op --
// whether `0x60` is better read as `has` or as `hasField` is taste, and nothing
// here judges it. And it cannot see a wrong arity that happens to balance: if
// two ops were both wrong by one in opposite directions inside the same frame,
// (1) and (2) would pass and only (3) would notice, which is why (3) is here.
//
// NEGATIVE CONTROL. `--control` corrupts DVM_POPS inside the sandbox (get_field
// made to consume two values instead of one) and requires the run to fail. A
// check of a table that cannot fail when the table is wrong is not a check.

import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const args = process.argv.slice(2);
const control = args.includes('--control');
const [htmlPath = 'index.html', dataPath] = args.filter(a => !a.startsWith('--'));

let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);

if (!dataPath || !existsSync(dataPath)) {
  console.log(`  (no archive at ${dataPath || '<none given>'}; this check needs one)`);
  process.exit(0);
}

const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);
sandbox.__a = new Uint8Array(readFileSync(dataPath));

if (control) {
  // get_field consumes the one value before it. Told to consume two, every
  // frame holding a field access either underflows or comes out short.
  ev('DVM_POPS[0x62] = 2;');
  console.log('  (control: get_field made to consume two values)');
}

/* Which frames are one expression rather than an argument list, per op and per
   group. The four call forms open one frame holding as many values as the
   callee takes, so they are excluded; everything below opens one frame per
   value it needs.

   `call_index` is the one that is both, and the check found it rather than
   being told: it was listed here as single and failed on 0xC43 and 0x3021 with
   three and four values left. The wiki's opcode table is unambiguous --
   `9C rr rr (i...) 40 (p...) 40`, "Calls a resource r+i with parameters p" --
   so its first frame is one index expression and its second is the parameters.
   Listed as a group count: how many of the op's leading frames are single. */
const SINGLE = {
  'return': 1, 'print': 1, 'if': 1, 'if_not': 1, 'switch': 1,
  'set_local': 1, 'set_global': 1, 'set_field': 2, 'set_index': 3,
  'write_near_word': 1, 'write_far_word': 1, 'ai_state': 1, 'gui_close': 1,
  'call_index': 1,
};

const report = ev(`(() => {
  const arc = openDelverArchive(__a);
  const out = {resources: 0, functions: 0, frames: 0, single: 0,
               under: [], unbalanced: [], mismatched: [], named: 0, labels: 0};
  const mi = arc.index;
  for (let subn = 0; subn < 256; subn++) {
    const e = mi[subn];
    if (!e || !e[0]) continue;
    for (let n = 0; n < 256; n++) {
      const resid = (subn + 1) * 0x100 + n;
      let raw = null;
      try { raw = getResourceBytes(arc, resid); } catch (err) { continue; }
      if (!raw || !raw.length) continue;
      const b = smartDecrypt(raw, resid).data;
      let objs = [];
      try { objs = dvmExtents(b, resid); } catch (err) { continue; }
      if (!objs.length) continue;
      let sawFn = false;
      const slots = dvmSlotNames(b, resid);
      out.named += slots.size;
      for (const [st, en, kind] of objs) {
        if (kind !== 'function') continue;
        const seg = b.subarray(st, Math.min(en, b.length));
        if (seg.length < 4) continue;
        const ph = dvmProseHead(seg.subarray(3));
        if (ph && ph.bare) continue;
        let r = null;
        try { r = dvmDisassembleFolded(seg, st); } catch (err) { continue; }
        if (!r || !r.ops.length) continue;
        if (r.bad) continue;                 // a desynced walk is not the fold's to explain
        sawFn = true; out.functions++;
        const where = '0x' + resid.toString(16).toUpperCase() + '+0x' + st.toString(16).toUpperCase();

        const forest = dvmForest(r.ops);

        // (1) and (2): walk every frame and reduce it.
        const SINGLE = ${JSON.stringify(SINGLE)};
        const walk = nodes => {
          for (const node of nodes) {
            for (let gi = 0; gi < node.groups.length; gi++) {
              const f = node.groups[gi];
              out.frames++;
              let st2 = null;
              try { st2 = dvmReduceFrame(f, {label: t => String(t)}); } catch (err) { st2 = ['<threw>']; }
              if (st2.some(v => /\\/\\*under\\*\\//.test(String(v))))
                out.under.push(where + ' in ' + node.mn);
              if (gi < (SINGLE[node.mn] || 0)) {
                out.single++;
                if (st2.length !== 1)
                  out.unbalanced.push(where + ' ' + node.mn + ' group ' + gi + ' left ' + st2.length);
              }
              walk(f);
            }
          }
        };
        walk(forest);

        // (3): re-expand and compare op for op.
        const back = dvmExpandForest(forest);
        if (back.length !== r.ops.length) {
          out.mismatched.push(where + ': ' + back.length + ' ops back, ' + r.ops.length + ' in');
        } else {
          for (let i = 0; i < back.length; i++) {
            const a = r.ops[i], c = back[i];
            if (a[0] !== c[0] || a[1] !== c[1] || a[2] !== c[2] || a[3] !== c[3]) {
              out.mismatched.push(where + ' op ' + i + ': ' + JSON.stringify([a[0], a[2], a[3]]) +
                                  ' became ' + JSON.stringify([c[0], c[2], c[3]]));
              break;
            }
          }
        }
        // the labels the fold can put down, which the raw listing cannot
        try {
          for (const t of dvmBranchTargets(r.ops)) if (t >= st && t < en) out.labels++;
        } catch (err) { /* nothing */ }
      }
      if (sawFn) out.resources++;
    }
  }
  return out;
})()`);

const r = report;
const cap = (list, n) => list.slice(0, n).join('; ') + (list.length > n ? ` (+${list.length - n} more)` : '');

if (!r.functions) fail('the fold', 'no function was folded, so nothing was measured');

if (!r.under.length)
  ok('no expression underflows', `${r.frames} frames over ${r.functions} functions in ${r.resources} resources`);
else
  fail('an op consumes more values than are there',
       `${r.under.length} place(s), so DVM_POPS is too greedy for one of them: ${cap(r.under, 5)}`);

if (!r.unbalanced.length)
  ok('every single-expression frame holds exactly one value', `${r.single} such frames`);
else
  fail('a single-expression frame did not reduce to one value',
       `${r.unbalanced.length} place(s), so DVM_POPS is too timid for something inside them: ${cap(r.unbalanced, 5)}`);

if (!r.mismatched.length)
  ok('re-expanding every tree gives back the same ops', `${r.functions} functions, op for op`);
else
  fail('the tree does not expand back to the disassembly',
       `${r.mismatched.length}: ${cap(r.mismatched, 3)}`);

ok('the dispatch table names what the raw listing calls obj_XXXX',
   `${r.named} slots named, ${r.labels} branch targets labelled`);

if (control) {
  if (failures) { console.log(`\nok — the control failed the check, as it must (${failures})`); process.exit(0); }
  console.error('\nFAIL — the control passed, so this check cannot see a wrong arity');
  process.exit(1);
}
console.log(failures ? `\nFAIL — ${failures} check(s) failed`
  : `\nfolded ${r.functions} functions in ${r.resources} resources: ${r.frames} frames, ` +
    `${r.single} single-expression, all balanced and all expanding back`);
process.exit(failures ? 1 : 0);
