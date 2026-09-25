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
// NEGATIVE CONTROLS, one per assertion that has one, each named on the command
// line and each required to fail the assertion it was written for -- not merely
// to fail something:
//
//   --control (or --control=region) replaces dvmRegionClosed with one that says
//     yes to every region. The recovery then claims 4,577 blocks where it should
//     claim 4,012, and 486 of them are left for somewhere that is neither their
//     continuation nor a break (22 September 2026; with the merged conditions of
//     later the same day, 4,365 where it should claim 3,803, and 483). A recovery that
//     cannot be caught overreaching is not one to trust, and that is this
//     check's whole reason for existing.
//   --control=merge merges any two conditionals in a row, whatever they jump
//     to: 161 functions lose an edge, and 218 merged conditions go somewhere
//     their text does not say.
//   --control=or joins a merged condition's parts with the wrong operator; all
//     152 fail their truth table, and the edge check passes, which is why the
//     truth table exists.
//   --control=exits prints every `break` as `continue` and every `continue` as
//     `break`; 306 of the 307 are caught. The one that is not is in 0x1879,
//     whose conversation is seven `loop`s nested one inside the next: there the
//     inner loop's exit and its first statement are the same statement, so
//     `break` and `continue` go to one place and either word is true.
//   --control=for names the loop variable of every `for` one slot along; all
//     152 are caught.
//   --control=labels prints no label at all; 803 gotos name a missing one.
//
//   --control=entry drops the entry half of the region test (nothing outside
//     may jump into a region's middle). The archive does not notice: the same
//     blocks, every assertion passing, because on Ambrosia's output every
//     region the recovery would wrongly claim is caught by its exits first. The
//     synthetic function below is what catches it: one block claimed, entered
//     in its middle, and the entry assertion fails.
//   --control=guard drops the merge's guard (a second test nothing else jumps
//     to). Again the archive does not notice, since no pair in it fails the
//     guard; the other synthetic function merges a pair whose second test is a
//     jump target, and the edge check reports a jump into the middle of a
//     condition.
//
// TWO SYNTHETIC FUNCTIONS, since 24 September 2026, because two of the
// assertions had no control on this archive and saying so was all that could
// be done. The entry half of the region test and the merge's guard both exist
// for what a hand-edited archive can do and Ambrosia's compiler never did, so
// no function in the shipped file exercises either: removing the entry half was
// tried and changed nothing at all (the same 4,012 blocks, every assertion
// passing), and the entry assertion had fired only under --control=merge, from
// a broken merge rather than from the test it mirrors. The remedy is the first
// input here that is not the archive: two functions written in the listing's
// own words, assembled by dvmAssemble (js/delv-asm.js, held to the archive by
// asm_check.mjs), given a function header and measured exactly as a resource
// is -- the same statements, the same recovery, the same text read back. One
// has a jump from outside into the middle of what would be an if-block; the
// other has a pair of tests whose second test is itself a jump target. The
// normal run asserts the recovery REFUSES both (no block built for the first,
// nothing merged in the second), and the two controls above assert that without
// the test in question it accepts them and the assertion sees it. They count
// towards no floor.

// FOUR MORE, added on 22 September 2026 with the three things the listing
// learned to print that day, and each of them a claim a reader takes on trust.
//
//   A MERGED CONDITION MEANS WHAT ITS PARTS DID. `if_not A -> L; if_not B -> L`
//   is printed `if (A && B)`, and the edge check cannot tell `&&` from `||`: both
//   leave the same node for the same two places. So every merged condition is
//   run both ways for every truth assignment of its parts -- once through the
//   flat statements, a part jumping when it is an `if` and its value is true or
//   an `if_not` and it is false, and once by evaluating the text the listing
//   prints with each part named c0, c1 ... -- and the two must agree on where
//   control goes, for the falling-through spelling (`if (...) {`) and the jumping
//   one (`goto`, `} while`) alike. The parts have to be consecutive statements
//   of the flat listing too, which is what makes "not jumping means the next
//   part" true.
//
//   A `break` OR `continue` GOES WHERE THE BRACES SAY. The listing is read back
//   as a reader reads it -- nested blocks from its braces, the offset in each
//   gutter -- by parseStructured below, which knows nothing of the recovery.
//   Each `break` is held to the statement that follows its innermost loop and
//   each `continue` to where that loop goes round (a `while`'s test, a `for`'s
//   step, a `do`'s closing test, a `loop`'s first statement), and the flat
//   statement at its offset must jump exactly there. A jump the recovery
//   absorbed is followed to where it goes, since it is not printed.
//
//   A `for` LINE IS THE ITERATOR PROTOCOL. The statement at the `for` line's
//   offset must be `set_local` of the printed variable from the printed syscall
//   called with a state word and 0; the next flat statement an `if` on the same
//   syscall with the same word and 1, jumping to whatever follows the loop; the
//   statement at the closing brace's offset the same `set_local` from the same
//   call with 2; and the statement after that a jump back to the test. Read off
//   the ops, not off the text the fold made of them.
//
//   EVERY LABEL A GOTO NAMES IS PRINTED. Until 22 September 2026 a label was
//   printed only before a plain statement, so 94 gotos into the head of an if
//   or a while named a label that appeared nowhere, and nothing here read the
//   text to see it. A target that is not the start of any statement -- it falls
//   inside a run of text the disassembler read as one string -- has no line to
//   put a label on; those are counted and reported, not failed, since they are
//   the disassembler's question and not the recovery's. Since 25 September
//   2026 the fold tier splits such a run at the target (dvmSplitTextAtTargets,
//   which is what dvmDisassembleFolded adds to the disassembly), so the count
//   is zero on the archive; the report stays for a hand-edited one.
//
// THE MERGE'S GUARD is exercised by the second synthetic function above and by
// --control=guard, since 24 September 2026; on the archive alone nothing ever
// jumps to a second test, so removing the guard changed nothing there.
//
// A JUMP TO A RETURN IS THAT RETURN, since 24 September 2026 (dvmEndJumps):
// a `branch` the first pass left as a goto whose target is a `return` or an
// `exit` is folded into an end statement carrying the target's text, and the
// pass runs again with the regions it kept open now closed. The recovery says
// which (`ended`, the jump's offset to its target's), and for each the flat
// statement at the jump's offset must be a jump to exactly that target and the
// flat statement there an end whose op is `return` or `exit` -- read off the
// ops, not off anything the recovery says -- and the printed line at the
// jump's offset must be the target's own printed text. The edge `jump>target`
// is contracted out of the flat graph for the comparison, an end having no
// successor; that is the one edge a folded statement had. --control=ended folds
// a jump onto a statement that is not a return, and must fail this.

import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const args = process.argv.slice(2);
const controlArg = args.find(a => a.startsWith('--control'));
const control = controlArg ? (controlArg.split('=')[1] || 'region') : null;
const [htmlPath = 'index.html', dataPath] = args.filter(a => !a.startsWith('--'));

let failures = 0;
const failed = new Set();
const fail = (what, why, key) => { failures++; if (key) failed.add(key); console.error(`FAIL ${what}: ${why}`); };
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

/* Each control, what it does to the page, and the assertion it must fail. */
const CONTROLS = {
  region: {mustFail: 'exit', say: 'every region declared closed, so the recovery overreaches',
    code: 'dvmRegionClosed = function () { return true; };'},
  merge: {mustFail: 'edges', say: 'any two conditionals in a row merged, whatever they jump to',
    code: `dvmMergeConditions = function (stmts) {
      const list = [], merged = new Map();
      for (let i = 0; i < stmts.length; i++) {
        const s = stmts[i], b = stmts[i + 1];
        if (s.kind === 'cond' && b && b.kind === 'cond' && s.negated === b.negated) {
          i++; merged.set(b.abs, s.abs);
          list.push({abs: s.abs, node: s.node, kind: 'cond', targets: [s.targets[0]], negated: s.negated, parts: [s, b]});
        } else list.push(s);
      }
      return {list, merged};
    };`},
  or: {mustFail: 'truth', say: 'a merged condition joined with the wrong operator',
    code: `(() => { const was = dvmCondJoined;
      dvmCondJoined = function (s, ctx) { const t = was(s, ctx);
        return s.parts ? t.split(' && ').join(' #OR# ').split(' || ').join(' && ').split(' #OR# ').join(' || ') : t; }; })();`},
  exits: {mustFail: 'exits', say: 'break printed as continue and continue as break',
    code: `(() => { const was = dvmLoopExits;
      dvmLoopExits = function (tree, ctx) { const r = was(tree, ctx);
        for (const [k, v] of r.exits) r.exits.set(k, v === 'break' ? 'continue' : 'break'); return r; }; })();`},
  for: {mustFail: 'for', say: 'every for loop names its variable one slot along',
    code: `(() => { const was = dvmForEach;
      dvmForEach = function (p, w, ctx) { const f = was(p, w, ctx);
        if (f) f.variable = 'Var' + (parseInt(f.variable.slice(3), 16) + 1).toString(16).toUpperCase().padStart(2, '0');
        return f; }; })();`},
  labels: {mustFail: 'labels', say: 'no label printed', code: 'dvmRemainingLabels = function () { return new Set(); };'},
  entry: {mustFail: 'entry', say: 'the region test no longer refuses a region something jumps into the middle of',
    code: `dvmRegionClosed = function (stmts, index, lo, hi, allowed) {
      if (hi <= lo) return false;
      const ok = new Set(allowed);
      for (let k = lo; k < hi; k++) for (const t of stmts[k].targets) {
        if (ok.has(t)) continue;
        const j = index.get(t);
        if (j === undefined || j < lo || j >= hi) return false;
      }
      return true;
    };`},
  ended: {mustFail: 'ended', say: 'a jump to a plain statement folded as if it were a jump to a return',
    code: `(() => { const was = dvmEndJumps;
      dvmEndJumps = function (stmts, index, left) {
        const out = was(stmts, index, left);
        for (const i of left) { const s = stmts[i]; const j = s.kind === 'jump' && s.targets.length === 1 ? index.get(s.targets[0]) : undefined;
          if (j !== undefined && stmts[j].kind === 'plain' && !stmts[j].parts) { out.push(i); break; } }
        return out; }; })();`},
  guard: {mustFail: 'edges', say: 'a pair of tests merged although something jumps to the second',
    code: `dvmMergeConditions = function (stmts) {
      const list = [], merged = new Map();
      for (let i = 0; i < stmts.length; i++) {
        const s = stmts[i], parts = [s];
        while (s.kind === 'cond' && s.targets.length === 1 && i + 1 < stmts.length) {
          const b = stmts[i + 1];
          if (b.kind !== 'cond' || b.targets.length !== 1 || b.targets[0] !== s.targets[0] || b.negated !== s.negated) break;
          parts.push(b); i++;
        }
        if (parts.length === 1) { list.push(s); continue; }
        for (const p of parts.slice(1)) merged.set(p.abs, s.abs);
        list.push({abs: s.abs, node: s.node, kind: 'cond', targets: [s.targets[0]], negated: s.negated, parts});
      }
      return {list, merged};
    };`},
};
if (control) {
  if (!CONTROLS[control]) { console.error(`no control called ${control}; there are ${Object.keys(CONTROLS).join(', ')}`); process.exit(2); }
  ev(CONTROLS[control].code);
  console.log(`  (control: ${CONTROLS[control].say})`);
}

// How much of the archive comes out structured. Not a target and not a ceiling:
// a pinned floor, so that a change which quietly stops recovering anything is a
// failure rather than a number nobody read. Set just under the measurement.
// Measured at 376 of the 589 functions that have any jump in them on
// 22 September 2026, and at 420 later that day once a jump out of a loop or round
// it was printed as `break` or `continue`. Recovering less is allowed by design
// -- refusing is always safe -- but recovering a lot less means a pattern
// stopped matching, which is worth a failure rather than a number nobody reads.
// The same goes for the two printings added that day: 152 for-each loops and
// 152 merged conditions (from 212 pairs of tests; some conditions are three).
// Raised to 480 on 24 September 2026, when folding jumps to a return took
// the archive from 431 whole functions to 490 and the gotos left from 917
// to 455; and to 540 on 25 September, when splitting a text run at the
// jump that lands in it (dvmSplitTextAtTargets) took it to 554 and 193.
const WHOLE_FLOOR = 540;
const FOR_FLOOR = 150;
const MERGE_FLOOR = 150;

/* The structured listing as a reader takes it: blocks nested by their braces,
   and the offset in each gutter. Deliberately knows nothing of the recovery --
   it is the text and only the text -- so that what it concludes about a
   `break` or a `for` is a reading of what is printed. Evaluated in the page's
   scope by its source, being a plain function. */
function parseStructured(text) {
  const funcs = [];
  let cur = null, stack = null;
  const open = (node, key) => { stack[stack.length - 1].push(node); node[key] = []; stack.push(node[key]); stack[stack.length - 1].owner = node; };
  for (const raw of String(text).split('\n')) {
    if (/^function /.test(raw)) { cur = {body: [], labels: new Set(), uses: []}; stack = [cur.body]; funcs.push(cur); continue; }
    if (!cur) continue;
    if (raw === '}') { cur = null; continue; }
    const lab = /^  L([0-9A-F]{4}):$/.exec(raw);
    if (lab) { cur.labels.add(parseInt(lab[1], 16)); continue; }
    const g = /^    ([0-9A-F]{4}| {4})\s*(\S.*)$/.exec(raw);
    if (!g) continue;
    // The comment a line may end in (dvmFoldNote) is not code.
    const at = g[1].trim() ? parseInt(g[1], 16) : null, t = g[2].split('   // ')[0];
    for (const m of t.matchAll(/\bL([0-9A-F]{4})\b/g)) cur.uses.push({at, to: parseInt(m[1], 16)});
    let m;
    if (t === '}') { stack.pop().owner.closeAt = at; continue; }
    if (t === '} else {') { const owner = stack.pop().owner; owner.els = []; stack.push(owner.els); owner.els.owner = owner; continue; }
    if (/^\} while \(.*\)$/.test(t)) { stack.pop().owner.closeAt = at; continue; }
    if ((m = /^for (\w+) in (\w+)\((.*)\) \{$/.exec(t))) { open({type: 'for', at, variable: m[1], name: m[2]}, 'body'); continue; }
    if (/^while \(.*\) \{$/.test(t)) { open({type: 'while', at}, 'body'); continue; }
    if (/^if \(.*\) \{$/.test(t)) { open({type: 'if', at}, 'then'); continue; }
    if (t === 'do {') { open({type: 'do', at: null}, 'body'); continue; }
    if (t === 'loop {') { open({type: 'loop', at: null}, 'body'); continue; }
    const w = /(?:^|\) )(break|continue)$/.exec(t);
    stack[stack.length - 1].push({type: 'stmt', at, text: t, word: w ? w[1] : null});
  }
  // Where control goes when each node is done, and where each loop goes round.
  const first = n => (n.type === 'do' || n.type === 'loop') ? (n.body.length ? first(n.body[0]) : null) : n.at;
  const walk = (list, cont, loop) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      n.after = (i + 1 < list.length) ? first(list[i + 1]) : cont;
      n.loop = loop;
      if (n.type === 'if') { walk(n.then, n.after, loop); if (n.els) walk(n.els, n.after, loop); }
      else if (n.type !== 'stmt') {
        n.round = n.type === 'while' ? n.at : (n.type === 'for' || n.type === 'do') ? n.closeAt
                : (n.body.length ? first(n.body[0]) : null);
        walk(n.body, n.round, n);
      }
    }
  };
  for (const f of funcs) walk(f.body, null, null);
  return funcs;
}
ev(parseStructured.toString());

/* The two synthetic functions, in the raw listing's own words with local
   labels. Each is the one shape its assertion exists for and the shipped
   archive never has. `entry`: the `branch Mid` at the end jumps into the
   middle of the range the first `if_not` would make a block of, so the block
   may not be built. `guard`: `branch Second` jumps to the second of two tests
   that go to the same place, so the two may not be merged. Assembled and
   given the three-byte function header (0x81, arguments, locals) a class
   script's function carries, at offset 0 of a resource of its own. */
const SYNTHETIC = {
  entry: `
    if_not
      local Var00
    then -> ThenEnd
    set_local 0x01
      byte 0x01
    end
    Mid:
    set_local 0x01
      byte 0x02
    end
    ThenEnd:
    if_not
      local Var01
    then -> Done
    branch Mid
    Done:
    return`,
  guard: `
    if_not
      local Var00
    then -> L
    Second:
    if_not
      local Var01
    then -> L
    set_local 0x02
      byte 0x01
    end
    L:
    set_local 0x02
      byte 0x02
    end
    if_not
      local Var02
    then -> Done
    branch Second
    Done:
    return`,
};

const report = ev(`(() => {
  const arc = openDelverArchive(__a);
  const counters = () => ({functions: 0, withJumps: 0, whole: 0, partial: 0,
               offEnd: 0, gotosLeft: 0, blocks: 0, merged: 0, fors: 0, breaks: 0, continues: 0,
               intoText: 0, truthRows: 0, ended: 0});
  const out = Object.assign(counters(), {
               edgeBad: [], stmtBad: [], entryBad: [], exitBad: [], mergeBad: [],
               truthBad: [], exitWordBad: [], forBad: [], labelBad: [], endedBad: [],
               synthetic: {}});
  const hex = v => '0x' + v.toString(16).toUpperCase();
  const bare = n => dvmBareOperand(n.arg);
  // One resource's functions, measured: the counters go to stats (the
  // archive's, or a synthetic function's own) and the failures to out.
  const measure = (b, resid, stats, label) => {
      let objs = [];
      try { objs = dvmExtents(b, resid); } catch (err) { return; }
      // Per resource, for the text: every walked statement by its offset, the
      // one after it in the flat listing, and the jumps the recovery absorbed.
      const flatAt = new Map(), nextOf = new Map(), absorbedTo = new Map(), endedTo = new Map();
      let walked = 0;
      for (const [st, en, kind] of objs) {
        if (kind !== 'function') continue;
        const seg = b.subarray(st, Math.min(en, b.length));
        if (seg.length < 4) continue;
        const ph = dvmProseHead(seg.subarray(3));
        if (ph && ph.bare) continue;
        let r = null;
        try { r = dvmDisassembleFolded(seg, st); } catch (err) { continue; }
        if (!r || !r.ops.length || r.bad) continue;
        const where = label + '+' + hex(st);

        const stmts = dvmStatementList(dvmForest(r.ops), st);
        if (!stmts.length) continue;
        walked++;
        stats.functions++;
        for (let i = 0; i < stmts.length; i++) {
          flatAt.set(stmts[i].abs, stmts[i]);
          if (i + 1 < stmts.length) nextOf.set(stmts[i].abs, stmts[i + 1].abs);
        }
        const flat = dvmFlatEdges(stmts);
        stats.offEnd += flat.offEnd;
        const rec = dvmRecoverStructure(stmts);
        for (const a of rec.absorbed) absorbedTo.set(a, flatAt.get(a).targets[0]);
        if (rec.ended) for (const [a, t] of rec.ended) endedTo.set(a, t);
        const loops = dvmLoopExits(rec.tree, {label: t => t});
        stats.gotosLeft += rec.gotos - loops.exits.size;
        stats.blocks += rec.structured;
        const hasJumps = stmts.some(s => s.targets.length);
        if (hasJumps) {
          stats.withJumps++;
          if (rec.gotos - loops.exits.size) stats.partial++; else stats.whole++;
        }

        // (0) the jumps folded into the return they go to: each must be a
        //     jump, in the flat list, to exactly the statement the recovery
        //     names, and that statement a return or an exit by its op. Its
        //     one edge is then contracted out, an end having no successor.
        let want = flat.edges;
        if (rec.ended && rec.ended.size) {
          const next = new Set(want);
          for (const [from, to] of rec.ended) {
            const j = flatAt.get(from), t = flatAt.get(to);
            // The jump's own target, followed through any jumps folded
            // before it (a goto to a goto to the return), must reach the
            // return the recovery names.
            let x = j && j.kind === 'jump' && j.targets.length === 1 ? j.targets[0] : null, hops = 0;
            while (x !== null && x !== to && rec.ended.has(x) && hops++ < 8) x = rec.ended.get(x);
            if (x !== to)
              out.endedBad.push(where + ': ' + hex(from) + ' is printed as a return but is not a jump to ' + hex(to));
            else if (!t || t.kind !== 'end' || (t.node.mn !== 'return' && t.node.mn !== 'exit'))
              out.endedBad.push(where + ': ' + hex(from) + ' is printed as the statement at ' + hex(to) + ', which is ' + (t ? t.node.mn : 'no statement'));
            else { next.delete(from + '>' + j.targets[0]); stats.ended++; }
          }
          want = next;
        }
        // (1) the edge sets. First the merged tests: a part folded into the
        //     condition before it is not a node of the recovered graph, so its
        //     edges become the condition's. The only edge allowed INTO a part
        //     is the fallthrough from the part before it -- anything else would
        //     be a jump into the middle of one condition.
        if (rec.merged.size) {
          const next = new Set();
          for (const k of want) {
            const [from, to] = k.split('>').map(Number);
            const head = rec.merged.has(from) ? rec.merged.get(from) : from;
            if (rec.merged.has(to)) {
              if (rec.merged.get(to) !== head || nextOf.get(from) !== to)
                out.mergeBad.push(where + ': ' + hex(from) + ' jumps into the middle of the condition at ' + hex(rec.merged.get(to)));
              continue;
            }
            next.add(head + '>' + to);
          }
          want = next;
        }
        //     Then the absorbed jumps, contracted out of the flat graph.
        //     Iterated to a fixed point because a goto can reach a goto.
        const got = dvmStructureEdges(rec.tree, null);
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
              out.entryBad.push(where + ' ' + blk.kind + ' block at ' + hex(head) +
                ': ' + hex(from) + ' jumps into its middle at ' + hex(to));
              break;
            }
            if (inside.has(from) && !inside.has(to) && blk.exits.indexOf(to) < 0) {
              out.exitBad.push(where + ' ' + blk.kind + ' block at ' + hex(head) +
                ': ' + hex(from) + ' leaves it for ' + hex(to) +
                ' rather than ' + blk.exits.map(e => e === null ? 'the end' : hex(e)).join(' or '));
              break;
            }
          }
        }

        // (3) every statement exactly once, a merged test counting each part
        const seen = [];
        const partsOf = s => s.parts ? s.parts.map(p => p.abs) : [s.abs];
        const conds = [];
        const walk = list => {
          for (const nd of list) {
            if (nd.kind === 'stmt') { seen.push(...partsOf(nd.stmt)); if (nd.stmt.parts) conds.push(nd.stmt); }
            for (const k of ['then', 'els', 'body']) if (nd[k]) walk(nd[k]);
            if (nd.cond) { seen.push(...partsOf(nd.cond)); if (nd.cond.parts) conds.push(nd.cond); }
          }
        };
        walk(rec.tree);
        const a = stmts.filter(s => !rec.absorbed.has(s.abs))
                       .map(s => s.abs).sort((x, y) => x - y).join(',');
        const c = seen.slice().sort((x, y) => x - y).join(',');
        if (a !== c) out.stmtBad.push(where + ': ' + stmts.length + ' statements in, ' + seen.length + ' out');

        // (4) each merged condition, every truth assignment, flat against printed
        for (const m of conds) {
          stats.merged++;
          const ps = m.parts, T = m.targets[0];
          for (let k = 0; k + 1 < ps.length; k++)
            if (nextOf.get(ps[k].abs) !== ps[k + 1].abs) out.truthBad.push(where + ' ' + hex(m.abs) + ': its parts are not consecutive');
          const names = ps.map((p, k) => 'c' + k);
          const lctx = {label: t => t, leaf: p => names[ps.indexOf(p)]};
          const fallText = dvmCondFallthrough(m, lctx), takenText = dvmCondTaken(m, lctx);
          let fall, taken;
          try { fall = Function(...names, 'return !!(' + fallText + ')'); taken = Function(...names, 'return !!(' + takenText + ')'); }
          catch (err) { out.truthBad.push(where + ' ' + hex(m.abs) + ': ' + fallText + ' does not parse'); continue; }
          for (let v = 0; v < (1 << ps.length); v++) {
            const vals = names.map((x, k) => !!(v & (1 << k)));
            let where2 = 'fall';
            for (let k = 0; k < ps.length; k++) {
              const jumps = ps[k].node.mn === 'if' ? vals[k] : !vals[k];
              if (jumps) { where2 = ps[k].targets[0] === T ? 'jump' : 'elsewhere'; break; }
            }
            stats.truthRows++;
            if (where2 === 'elsewhere' || fall(...vals) !== (where2 === 'fall') || taken(...vals) !== (where2 === 'jump')) {
              out.truthBad.push(where + ' ' + hex(m.abs) + ': with ' + names.map((x, k) => x + '=' + vals[k]).join(' ') +
                ' the listing goes to ' + where2 + ' but it prints (' + fallText + ')');
              break;
            }
          }
        }
      }
      if (!walked) return;

      // The text, read back as a reader reads it.
      const text = dvmStructureRender(arc, b, resid);
      const through = t => { let k = 0; while (absorbedTo.has(t) && k++ < 8) t = absorbedTo.get(t); return t; };
      const at4 = v => v === null || v === undefined ? 'the end' : hex(v);
      // (8) a jump folded into its return prints the return's own text: the
      //     line at the jump's offset reads as the line at the target's.
      if (endedTo.size) {
        const lineAt = new Map();
        for (const raw of text.split('\\n')) { const g = /^    ([0-9A-F]{4})\\s*(\\S.*)$/.exec(raw); if (g) lineAt.set(parseInt(g[1], 16), g[2].split('   // ')[0].trim()); }
        for (const [a, t] of endedTo) {
          const la = lineAt.get(a), lt = lineAt.get(t);
          if (la === undefined || lt === undefined || la !== lt)
            out.endedBad.push(label + ' ' + at4(a) + ' prints ' + JSON.stringify(la) + ' for the return at ' + at4(t) + ', which prints ' + JSON.stringify(lt));
        }
      }
      for (const f of parseStructured(text)) {
        const visit = list => {
          for (const n of list) {
            // (5) a break or continue goes where its innermost loop says
            if (n.type === 'stmt' && n.word && flatAt.has(n.at)) {
              stats[n.word === 'break' ? 'breaks' : 'continues']++;
              const s = flatAt.get(n.at);
              const want2 = !n.loop ? undefined : n.word === 'break' ? n.loop.after : n.loop.round;
              const to = s.targets.length === 1 ? through(s.targets[0]) : null;
              if (!n.loop || want2 === null || to !== want2)
                out.exitWordBad.push(label + ' ' + at4(n.at) + ': ' + n.word + (n.loop ? ' in the ' + n.loop.type + ' at ' + at4(n.loop.at) + ' reads as ' + at4(want2) : ' outside any loop') +
                  ', the listing jumps to ' + at4(to));
            }
            // (6) a for line is the iterator protocol
            if (n.type === 'for' && flatAt.has(n.at)) {
              stats.fors++;
              const bad = why => out.forBad.push(label + ' for at ' + at4(n.at) + ': ' + why);
              const start = flatAt.get(n.at), test = flatAt.get(nextOf.get(n.at)), step = flatAt.get(n.closeAt),
                    back = step && flatAt.get(nextOf.get(step.abs));
              const call = (s, mn) => {
                if (!s || s.node.mn !== mn) return null;
                const g = s.node.groups[0] || [];
                if (g.length !== 1 || g[0].mn !== 'sys ' + n.name) return null;
                return (g[0].groups[0] || []).map(x => x.mn + ' ' + bare(x));
              };
              const slotName = s => 'Var' + parseInt(bare(s.node), 16).toString(16).toUpperCase().padStart(2, '0');
              const a0 = call(start, 'set_local'), a1 = call(test, 'if'), a2 = call(step, 'set_local');
              if (!a0 || !a1 || !a2) bad('the start, test or step is not ' + n.name + ' called as the listing says');
              else if (!/^word /.test(a0[0]) || a0[1] !== 'byte 0x00') bad('the start is not ' + n.name + '(state, 0, ...)');
              else if (a1.join() !== [a0[0], 'byte 0x01'].join()) bad('the test is not ' + n.name + '(the same state, 1)');
              else if (a2.join() !== [a0[0], 'byte 0x02'].join()) bad('the step is not ' + n.name + '(the same state, 2)');
              else if (slotName(start) !== n.variable || slotName(step) !== n.variable)
                bad('the loop variable is printed ' + n.variable + ' and set in ' + slotName(start) + ' and ' + slotName(step));
              else if (through(test.targets[0]) !== n.after) bad('the test leaves for ' + at4(through(test.targets[0])) + ', not ' + at4(n.after));
              else if (!back || back.kind !== 'jump' || back.targets[0] !== test.abs) bad('the step is not followed by a jump back to the test');
            }
            for (const k of ['then', 'els', 'body']) if (n[k]) visit(n[k]);
          }
        };
        visit(f.body);
        // (7) every label a goto names is printed
        for (const u of f.uses) {
          if (f.labels.has(u.to)) continue;
          if (!flatAt.has(u.to)) { stats.intoText++; continue; }
          out.labelBad.push(label + ' ' + at4(u.at) + ' names L' + u.to.toString(16).toUpperCase().padStart(4, '0') + ', which is not printed');
        }
      }
  };
  for (let subn = 0; subn < 256; subn++) {
    const e = arc.index[subn];
    if (!e || !e[0]) continue;
    for (let n = 0; n < 256; n++) {
      const resid = (subn + 1) * 0x100 + n;
      let raw = null;
      try { raw = getResourceBytes(arc, resid); } catch (err) { continue; }
      if (!raw || !raw.length) continue;
      measure(smartDecrypt(raw, resid).data, resid, out, hex(resid));
    }
  }
  // The synthetic functions, each as a one-function resource of its own,
  // under a resource id the archive does not use so nothing here reads as
  // the archive's. A site the assembler writes counts from the text's own
  // start; the three header bytes move each by three.
  const SYN = ${JSON.stringify(SYNTHETIC)};
  for (const [name, text] of Object.entries(SYN)) {
    const resid = 0x0FFF;
    const asm = dvmAssemble(text, resid);
    const b = new Uint8Array(asm.bytes.length + 3);
    b[0] = 0x81; b[1] = 0; b[2] = 3;
    b.set(asm.bytes, 3);
    for (const site of asm.sites) dvmWriteSite(b, {at: site.at + 3, size: 2}, site.value + 3);
    const stats = counters();
    measure(b, resid, stats, 'synthetic ' + name);
    out.synthetic[name] = stats;
  }
  return out;
})()`);

const r = report;
const cap = (l, n) => l.slice(0, n).join('; ') + (l.length > n ? ` (+${l.length - n} more)` : '');

if (!r.functions) fail('the recovery', 'no function was walked, so nothing was measured');

if (!r.edgeBad.length && !r.mergeBad.length)
  ok('the recovered nesting has exactly the control flow the listing has',
     `${r.functions} functions, ${r.blocks} blocks built, ${r.merged} merged conditions`);
else
  fail('the recovery changed the control-flow graph',
       `${r.edgeBad.length + r.mergeBad.length} function(s): ${cap(r.mergeBad.concat(r.edgeBad), 3)}`, 'edges');

if (!r.entryBad.length)
  ok('every block has one way in, and it is the block\'s first statement');
else
  fail('a block is entered in the middle',
       `${r.entryBad.length}, so the braces claim a region the jumps contradict: ${cap(r.entryBad, 3)}`, 'entry');

if (!r.exitBad.length)
  ok('every block leaves only for its continuation, or out of its loop');
else
  fail('a block is left for somewhere other than its continuation',
       `${r.exitBad.length}: ${cap(r.exitBad, 3)}`, 'exit');

if (!r.stmtBad.length)
  ok('every statement appears exactly once in the recovered tree');
else
  fail('the recovery lost or duplicated statements', `${r.stmtBad.length}: ${cap(r.stmtBad, 3)}`, 'stmts');

if (!r.truthBad.length)
  ok('every merged condition goes where its parts went, for every truth assignment',
     `${r.merged} conditions, ${r.truthRows} assignments`);
else
  fail('a merged condition says something its tests do not', `${r.truthBad.length}: ${cap(r.truthBad, 3)}`, 'truth');

if (!r.exitWordBad.length)
  ok('every break and continue goes where its innermost loop, read from the braces, says',
     `${r.breaks} break, ${r.continues} continue`);
else
  fail('a break or continue goes somewhere its loop does not', `${r.exitWordBad.length}: ${cap(r.exitWordBad, 3)}`, 'exits');

if (!r.forBad.length)
  ok('every for line is the iterator protocol over the variable it names', `${r.fors} loops`);
else
  fail('a for line is not the iterator protocol', `${r.forBad.length}: ${cap(r.forBad, 3)}`, 'for');

if (!r.endedBad.length)
  ok('every jump printed as a return is a jump to that return, by the ops, and prints its text', `${r.ended} folded`);
else
  fail('a jump was folded into a statement that is not the return it goes to', `${r.endedBad.length}: ${cap(r.endedBad, 3)}`, 'ended');

if (!r.labelBad.length)
  ok('every label a goto names is printed',
     r.intoText ? `${r.intoText} goto(s) aim inside text, where no statement starts, and have no line to label` : '');
else
  fail('a goto names a label that is not printed', `${r.labelBad.length}: ${cap(r.labelBad, 3)}`, 'labels');

{
  const syn = r.synthetic, why = [];
  if (!syn.entry || syn.entry.functions !== 1) why.push('the entry function was not measured');
  else if (syn.entry.blocks !== 0) why.push(`the entry function came out with ${syn.entry.blocks} block(s), so a jump into a block's middle was accepted`);
  if (!syn.guard || syn.guard.functions !== 1) why.push('the guard function was not measured');
  else if (syn.guard.merged !== 0) why.push(`the guard function came out with ${syn.guard.merged} merged condition(s), so a jumped-to second test was merged`);
  if (!why.length)
    ok('the two synthetic functions are refused: no block for the jump into a middle, no merge over a jumped-to test',
       `${syn.entry.gotosLeft + syn.guard.gotosLeft} gotos left between them`);
  else
    fail('a synthetic function the recovery must refuse was accepted', why.join('; '), 'synthetic');
}

if (r.whole >= WHOLE_FLOOR && r.fors >= FOR_FLOOR && r.merged >= MERGE_FLOOR)
  ok(`at least ${WHOLE_FLOOR} functions with jumps come out with none left, ${FOR_FLOOR} for loops, ${MERGE_FLOOR} merged conditions`,
     `${r.whole} whole, ${r.partial} with jumps left over, ${r.gotosLeft} gotos remaining`);
else
  fail('the recovery stopped recovering',
       `${r.whole} functions fully structured (floor ${WHOLE_FLOOR}), ${r.fors} for loops (floor ${FOR_FLOOR}), ` +
       `${r.merged} merged conditions (floor ${MERGE_FLOOR}); ${r.partial} partial, ${r.gotosLeft} gotos left`, 'floor');

if (r.offEnd) console.log(`  note: ${r.offEnd} statement(s) fall off the end of a function with nowhere to go`);

if (control) {
  const want = CONTROLS[control].mustFail;
  if (failed.has(want)) { console.log(`\nok — the control failed the ${want} assertion, as it must (${failures} failure(s) in all)`); process.exit(0); }
  console.error(`\nFAIL — the control did not fail the ${want} assertion, so that assertion cannot see what it is for`);
  process.exit(1);
}
console.log(failures ? `\nFAIL — ${failures} check(s) failed`
  : `\nstructured ${r.whole} of ${r.withJumps} functions with jumps, ${r.blocks} blocks, ` +
    `${r.fors} for loops, ${r.merged} merged conditions, ${r.breaks + r.continues} break or continue, ${r.ended} jumps folded into their return, ` +
    `${r.gotosLeft} gotos left, control flow identical in all ${r.functions}`);
process.exit(failures ? 1 : 0);
