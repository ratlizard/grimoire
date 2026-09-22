#!/usr/bin/env node
// Does recovering a script's structure preserve its control flow?
//
//   node utilities/structure_check.mjs index.html "$TMPDIR/Cythera Data.data"
//   node utilities/structure_check.mjs index.html "$TMPDIR/..." --control
//
// WHY, and this is a different kind of why from the other checks here. The
// folded listing is safe by construction: every line is a local reorganisation
// of ops that are in the bytes, and utilities/fold_check.mjs proves the tree
// re-expands. Structure recovery has no such floor. It rewrites nothing and
// invents nothing, and it can still be COMPLETELY WRONG in the only way that
// matters -- the nesting can say one thing while the jumps say another, and
// every individual statement will look perfectly correct while it does. A
// reader believes braces.
//
// So the invariant is the control-flow graph, which the flat listing fixes and
// no recovery may alter:
//
//   a conditional reaches its target and the statement after it,
//   a `branch` reaches its target and nothing else,
//   a `switch` reaches every case and the statement after it,
//   a `return` or `exit` reaches nothing,
//   anything else reaches the statement after it.
//
// That edge set is derived twice -- once from the statements in address order
// (dvmFlatEdges) and once from the recovered NESTING (dvmStructureEdges), where
// an `if (C) { A }` means the condition reaches A's first statement and the
// statement after the block, and a `while` sends its body's end back to its
// condition. The two must be identical, for every function in the archive. Equal
// sets mean the recovery moved the braces and did nothing else.
//
// WITH ONE CORRECTION, which this check found rather than being written with.
// An if-else's `goto Lend` at the end of its then-branch, and a loop's
// `goto Lhead` at the end of its body, are ABSORBED: they exist only to reach a
// place the braces now say, and they are not rendered. So the recovered graph is
// legitimately one node shorter for each, and demanding raw equality failed 363
// functions for a reason that was correct behaviour. A jump with exactly one
// outgoing edge can be contracted out of a graph without changing what reaches
// what, so the flat graph is contracted at those nodes before the comparison --
// and only at those, which the recovery reports. Contracting a node the recovery
// did NOT absorb would hide a real difference, which is why the set is taken
// from the recovery rather than inferred from the shape.
//
// AND EDGE EQUALITY IS NOT ENOUGH, which the control proved rather than
// argued. With the recovery's own region test disabled it claimed 4,577 blocks
// where it should claim 4,012, and the edge sets still matched every one --
// because a statement inside a block that jumps out of it is an edge that is
// still there and still emitted, so the graph is preserved while the braces
// lie. The missing property is that a block is a region with ONE way in and one
// way out, and it is re-derived here from the tree and the flat edges rather
// than by asking the recovery, which would make the check a mirror.
//
// AND EVERY STATEMENT MUST STILL BE THERE, exactly once, save the absorbed
// jumps. The edge check alone would not notice a statement dropped from a block
// whose ends happen to line up, and a dropped statement is a silently wrong
// program.
//
// WHAT IT CANNOT SEE. Whether a recovered `while` is the loop a person would
// have written, or whether `do { } while` would read better than `loop` with an
// `if` in it: those are the same graph, and this check is about the graph. It
// also says nothing about a function left full of gotos -- refusing to recover
// is always allowed, and the count of those is reported rather than bounded, so
// a change that quietly stops recovering anything shows up as a number moving
// and not as a failure. The pinned floor below is what makes that visible.
//
// NEGATIVE CONTROL. `--control` replaces dvmRegionClosed with one that says yes
// to every region. The recovery then claims 4,577 blocks where it should claim
// 4,012, and 486 of them are left for somewhere that is neither their
// continuation nor a break, so the run fails. A recovery that cannot be caught
// overreaching is not one to trust, and that is this check's whole reason for
// existing.
//
// THE ENTRY ASSERTION HAS NO CONTROL, and saying so is better than implying it
// has. Removing only the entry half of the region test was tried and changes
// nothing at all: the same 4,012 blocks, every assertion still passing. On this
// archive every region the recovery would wrongly claim is caught by its exits
// first, so the entry half of the test is not load-bearing here and the
// assertion that mirrors it never fires. Both are kept -- single entry is the
// property that makes a block a block, and a hand-edited archive is entitled to
// violate it where Ambrosia's compiler never did -- but nothing here
// demonstrates the entry assertion working, and a later session should not read
// its `ok` as evidence that it would.

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
  ev('dvmRegionClosed = function () { return true; };');
  console.log('  (control: every region declared closed, so the recovery overreaches)');
}
// How much of the archive comes out structured. Not a target and not a ceiling:
// a pinned floor, so that a change which quietly stops recovering anything is a
// failure rather than a number nobody read. Set just under the measurement.
// Measured at 376 of the 589 functions that have any jump in them, with 213
// partly recovered. The floor sits just under, and it is a floor and not a
// target: recovering less is allowed by design -- refusing is always safe -- but
// recovering a lot less means a pattern stopped matching, which is worth a
// failure rather than a number nobody reads.
const WHOLE_FLOOR = 370;

const report = ev(`(() => {
  const arc = openDelverArchive(__a);
  const out = {functions: 0, withJumps: 0, whole: 0, partial: 0,
               edgeBad: [], stmtBad: [], entryBad: [], exitBad: [],
               offEnd: 0, gotosLeft: 0, blocks: 0};
  for (let subn = 0; subn < 256; subn++) {
    const e = arc.index[subn];
    if (!e || !e[0]) continue;
    for (let n = 0; n < 256; n++) {
      const resid = (subn + 1) * 0x100 + n;
      let raw = null;
      try { raw = getResourceBytes(arc, resid); } catch (err) { continue; }
      if (!raw || !raw.length) continue;
      const b = smartDecrypt(raw, resid).data;
      let objs = [];
      try { objs = dvmExtents(b, resid); } catch (err) { continue; }
      for (const [st, en, kind] of objs) {
        if (kind !== 'function') continue;
        const seg = b.subarray(st, Math.min(en, b.length));
        if (seg.length < 4) continue;
        const ph = dvmProseHead(seg.subarray(3));
        if (ph && ph.bare) continue;
        let r = null;
        try { r = dvmDisassemble(seg, 3); } catch (err) { continue; }
        if (!r || !r.ops.length || r.bad) continue;
        const where = '0x' + resid.toString(16).toUpperCase() + '+0x' + st.toString(16).toUpperCase();

        const stmts = dvmStatementList(dvmForest(r.ops), st);
        if (!stmts.length) continue;
        out.functions++;
        const flat = dvmFlatEdges(stmts);
        out.offEnd += flat.offEnd;
        const rec = dvmRecoverStructure(stmts);
        out.gotosLeft += rec.gotos;
        out.blocks += rec.structured;
        const hasJumps = stmts.some(s => s.targets.length);
        if (hasJumps) {
          out.withJumps++;
          if (rec.gotos) out.partial++; else out.whole++;
        }

        // (1) the edge sets, with the absorbed jumps contracted out of the flat
        //     one. Iterated to a fixed point because a goto can reach a goto.
        const got = dvmStructureEdges(rec.tree, null);
        let want = flat.edges;
        if (rec.absorbed.size) {
          const succ = new Map();
          for (const st2 of stmts) if (rec.absorbed.has(st2.abs)) succ.set(st2.abs, st2.targets[0]);
          for (let pass = 0; pass < 8; pass++) {
            let moved = false;
            const next = new Set();
            for (const k of want) {
              const [from, to] = k.split('>').map(Number);
              if (rec.absorbed.has(from)) { moved = true; continue; }   // drop its own edge
              if (rec.absorbed.has(to)) { next.add(from + '>' + succ.get(to)); moved = true; continue; }
              next.add(k);
            }
            want = next;
            if (!moved) break;
          }
        }
        let diff = null;
        for (const k of want) if (!got.has(k)) { diff = 'lost ' + k; break; }
        if (!diff) for (const k of got) if (!want.has(k)) { diff = 'invented ' + k; break; }
        if (diff) out.edgeBad.push(where + ': ' + diff + ' (' + want.size + ' edges in, ' + got.size + ' out)');

        // (2) every block is a region with ONE way in and one way out.
        //     Edge equality alone does not say this, and the control proved it:
        //     with dvmRegionClosed disabled the recovery claimed 4,577 blocks
        //     instead of 4,012 and the edge sets still matched, because a
        //     statement inside a block jumping out of it is an edge that is
        //     still present and still emitted. The braces were lying and the
        //     graph could not tell. So the property is re-derived here from the
        //     tree and the flat edges, and NOT by calling the recovery's own
        //     test, which is the only way a check of it means anything.
        for (const blk of dvmBlocksOf(rec.tree, null)) {
          if (!blk.body.length) continue;
          const inside = new Set();
          (function collect(list) {
            for (const nd of list) {
              if (nd.kind === 'stmt') inside.add(nd.stmt.abs);
              if (nd.cond) inside.add(nd.cond.abs);
              for (const k of ['then', 'els', 'body']) if (nd[k]) collect(nd[k]);
            }
          })(blk.body);
          const head = dvmFirstAbs(blk.body[0]);
          /* Against the CONTRACTED edge set, not the raw one: an edge to an
             absorbed jump points at a node that is no longer in the tree, and
             reading those as escapes reported 2,113 blocks that were all fine. */
          for (const k of want) {
            const [from, to] = k.split('>').map(Number);
            if (inside.has(to) && !inside.has(from) && to !== head) {
              out.entryBad.push(where + ' ' + blk.kind + ' block at 0x' + head.toString(16).toUpperCase() +
                ': 0x' + from.toString(16).toUpperCase() + ' jumps into its middle at 0x' + to.toString(16).toUpperCase());
              break;
            }
            if (inside.has(from) && !inside.has(to) && blk.exits.indexOf(to) < 0) {
              out.exitBad.push(where + ' ' + blk.kind + ' block at 0x' + head.toString(16).toUpperCase() +
                ': 0x' + from.toString(16).toUpperCase() + ' leaves it for 0x' + to.toString(16).toUpperCase() +
                ' rather than ' + blk.exits.map(e => e === null ? 'the end' : '0x' + e.toString(16).toUpperCase()).join(' or '));
              break;
            }
          }
        }

        // (3) every statement exactly once
        const seen = [];
        const walk = list => {
          for (const nd of list) {
            if (nd.kind === 'stmt') seen.push(nd.stmt.abs);
            for (const k of ['then', 'els', 'body']) if (nd[k]) walk(nd[k]);
            if (nd.cond) seen.push(nd.cond.abs);
          }
        };
        walk(rec.tree);
        const a = stmts.filter(s => !rec.absorbed.has(s.abs))
                       .map(s => s.abs).sort((x, y) => x - y).join(',');
        const c = seen.slice().sort((x, y) => x - y).join(',');
        if (a !== c) out.stmtBad.push(where + ': ' + stmts.length + ' statements in, ' + seen.length + ' out');
      }
    }
  }
  return out;
})()`);

const r = report;
const cap = (l, n) => l.slice(0, n).join('; ') + (l.length > n ? ` (+${l.length - n} more)` : '');

if (!r.functions) fail('the recovery', 'no function was walked, so nothing was measured');

if (!r.edgeBad.length)
  ok('the recovered nesting has exactly the control flow the listing has',
     `${r.functions} functions, ${r.blocks} blocks built`);
else
  fail('the recovery changed the control-flow graph',
       `${r.edgeBad.length} function(s): ${cap(r.edgeBad, 3)}`);

if (!r.entryBad.length)
  ok('every block has one way in, and it is the block\'s first statement');
else
  fail('a block is entered in the middle',
       `${r.entryBad.length}, so the braces claim a region the jumps contradict: ${cap(r.entryBad, 3)}`);

if (!r.exitBad.length)
  ok('every block leaves only for its continuation, or out of its loop');
else
  fail('a block is left for somewhere other than its continuation',
       `${r.exitBad.length}: ${cap(r.exitBad, 3)}`);

if (!r.stmtBad.length)
  ok('every statement appears exactly once in the recovered tree');
else
  fail('the recovery lost or duplicated statements', `${r.stmtBad.length}: ${cap(r.stmtBad, 3)}`);

if (r.whole >= WHOLE_FLOOR)
  ok(`at least ${WHOLE_FLOOR} functions with jumps come out with none left`,
     `${r.whole} whole, ${r.partial} with jumps left over, ${r.gotosLeft} gotos remaining`);
else
  fail('the recovery stopped recovering',
       `${r.whole} functions fully structured, under the recorded ${WHOLE_FLOOR}; ` +
       `${r.partial} partial, ${r.gotosLeft} gotos left`);

if (r.offEnd) console.log(`  note: ${r.offEnd} statement(s) fall off the end of a function with nowhere to go`);

if (control) {
  if (failures) { console.log(`\nok — the control failed the check, as it must (${failures})`); process.exit(0); }
  console.error('\nFAIL — the control passed, so this check cannot see the recovery overreach');
  process.exit(1);
}
console.log(failures ? `\nFAIL — ${failures} check(s) failed`
  : `\nstructured ${r.whole} of ${r.withJumps} functions with jumps, ${r.blocks} blocks, ` +
    `${r.gotosLeft} gotos left, control flow identical in all ${r.functions}`);
process.exit(failures ? 1 : 0);
