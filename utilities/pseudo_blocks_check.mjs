#!/usr/bin/env node
// Do a routine's pseudo-code blocks (exePseudoBlocks in js/page-views.js)
// match what its jumps do?
//
//   node utilities/pseudo_blocks_check.mjs index.html "$TMPDIR/Cythera.data"
//   node utilities/pseudo_blocks_check.mjs index.html "$TMPDIR/Cythera.data" --controls
//
// WHY. The blocks are printed by the scripts' recovery (dvmRecoverStructure),
// which utilities/structure_check.mjs compares with the scripts' jumps. The
// routines are a second input with shapes the scripts never had: a test
// that jumps past the next test to the block's first line (`if (A || B)`),
// a loop whose test is at its end with a jump to it from before the loop, a
// switch through a table, a return that tests a condition. A wrong block
// reads as well as a right one, and every statement inside it still reads
// correctly while the braces say something different from the jumps.
//
// So everything is read again from the instructions, and the printed lines
// are read back the way a reader reads them. Nothing below reads the
// statement list exePseudoBlocks builds. It reads exePseudo's lines (each
// line's address) and the recovery's report of what it folded.
//
//   (1) FLOW. Each jump instruction (not a call) has one line at its address
//       with a `flow`, of the kind its instruction is: a conditional `bc` a
//       test to its target, a `b` in the routine a jump, a `b` out of it, a
//       `blr` or a `bctr` with no table an end, a `bctr` through a table a
//       switch to the table's cases. A conditional return is a plain line.
//       No other line has a flow.
//   (2) EDGES. The places each statement can go to, from the instructions:
//       a place is the first line written at or after the address. The same
//       set is read off the blocks (dvmStructureEdges), after the folds the
//       recovery reports are contracted out of the first: a run of tests
//       joined into one condition, a jump the braces absorb, a jump to a
//       return printed as the return. The two must be equal.
//   (3) REGIONS. Every block has one way in, its first statement, and is
//       left only for its continuation or an enclosing loop's (dvmBlocksOf
//       against the edges of (2)). Edge equality alone does not show this:
//       structure_check.mjs found that a recovery claiming too much leaves
//       every edge in place.
//   (4) STATEMENTS. Every statement is in the tree once, but the absorbed
//       jumps.
//   (5) OPERATORS. Each test's comparison is the one its branch makes: `bt`
//       on the LT bit jumps on `<`, `bf` on it on `>=`, and so on, read from
//       the instruction's mnemonic and bit. Its opposite swaps the operator
//       and nothing else.
//   (6) JOINED TESTS. Each run of tests joined into one condition is run
//       for every truth value of its parts, once through the parts' jumps
//       (each to E or to T, in order) and once by evaluating the condition
//       exeJoinTests writes, with the parts named c0, c1 ... The two must
//       match, toward E and toward T.
//   (7) SENSE, read back from the printed lines. A condition printed over a
//       block (`if (X) {`, `while (X) {`) must be the one for the place the
//       block's first statement is; `} while (X)` the one for the loop's
//       first statement; `if (X) goto L`, `break` or `continue` the one for
//       the jump.
//   (8) EXITS. A `break` goes to the statement after its innermost loop, and
//       a `continue` to where that loop goes round, read from the printed
//       nesting: a `while`'s test, a `do`'s closing test, a `loop`'s first
//       statement. A `break` inside a `switch (x) {` block with no loop
//       nearer goes to the statement after the block.
//   (9) LABELS. Every goto's label is printed, before the statement the
//       jump lands on.
//   (10) RETURNS. A jump printed as a return is a `b` to a place whose line
//       is an end, and prints that line.
//   (11) SWITCHES. A tree of compares printed as one switch (exePseudoBlocks'
//       `trees`, 10 November 2026) is run here from its instructions alone:
//       from the root's compare, each cmpwi or cmplwi sets its field from
//       the value, a copy (mr) puts the value in another register too, and
//       each branch whose line is in the tree follows its field. The run
//       ends at the first instruction outside that, and the place is the
//       first line at or after where that straight run began. Every value
//       at which a compare in the tree can change its answer is run, and
//       the case labels printed at each place must be those values, in the
//       page's form ("49 to 56", "default" for the place with most values).
//       The tree's edges in (2) are the root's edges to those places, and
//       its other tests and jumps count as folded into the root in (4).
//
// THE CONTROLS, with --controls, each in a fresh page and each required to
// fail the assertion named for it:
//   region  every region taken as closed, so the recovery claims too much;
//   join    a joined condition's `||` and `&&` swapped;
//   sense   every block's condition printed in the jump's sense;
//   exits   every `break` printed as `continue` and every `continue` as `break`;
//   labels  no label printed;
//   flow    a jump inside the routine read as an end;
//   switches  every case label printed one value higher;
//   breaks  every `break` out of a switch block printed as `continue`.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { pageSource } from './page_scripts.mjs';
import { makeSandbox } from './dom_stub.mjs';

const args = process.argv.slice(2);
const controls = args.includes('--controls');
const [htmlPath = 'index.html', dataPath] = args.filter(a => !a.startsWith('--'));
if (!dataPath || !existsSync(dataPath)) { console.log('  skip  no application data fork at ' + dataPath); process.exit(0); }
const appBytes = new Uint8Array(readFileSync(dataPath));
const ANY = Symbol('either way');
const source = pageSource(htmlPath);

const CONTROLS = {
  region: { mustFail: 'regions', code: 'dvmRegionClosed = function () { return true; };' },
  join: { mustFail: 'joined', code: `(() => { const was = exeJoinTests;
    exeJoinTests = function (toE, taken, fall, toward) { return was(toE, taken, fall, toward).split(' && ').join(' #OR# ').split(' || ').join(' && ').split(' #OR# ').join(' || '); }; })();` },
  sense: { mustFail: 'sense', patch: src => src.split("textOf(n.cond, 'fall') + ') {'").join("textOf(n.cond, 'taken') + ') {'") },
  exits: { mustFail: 'exits', code: `(() => { const was = dvmLoopExits;
    dvmLoopExits = function (tree, ctx) { const r = was(tree, ctx);
      for (const [k, v] of r.exits) r.exits.set(k, v === 'break' ? 'continue' : 'break'); return r; }; })();` },
  labels: { mustFail: 'labels', code: 'dvmRemainingLabels = function () { return new Set(); };' },
  flow: { mustFail: 'flow', patch: src => src.split("inside(o.to) ? { kind: 'jump' } : { kind: 'end' }").join("{ kind: 'end' }") },
  breaks: { mustFail: 'exits', patch: src => src.split("const SWITCH_BREAK = 'break';").join("const SWITCH_BREAK = 'continue';") },
  switches: { mustFail: 'switches', patch: src => src.split('u.lo === u.hi ? String(val(u.lo))').join('u.lo === u.hi ? String(val(u.lo) + 1)') },
};

function run(control) {
  const { sandbox } = makeSandbox();
  const ctx = vm.createContext(sandbox);
  const c = control ? CONTROLS[control] : null;
  new vm.Script(c && c.patch ? c.patch(source) : source, { filename: htmlPath }).runInContext(ctx);
  if (c && c.code) vm.runInContext(c.code, ctx);
  ctx.APP_DATA = appBytes;
  const pef = ctx.appPef();
  if (!pef || !pef.routines || !pef.routines.length) return { fatal: 'the application has no routines' };
  const bad = { flow: [], edges: [], regions: [], statements: [], operators: [], joined: [], sense: [], exits: [], labels: [], returns: [], switches: [] };
  const stats = { routines: 0, withJumps: 0, whole: 0, gotos: 0, blocks: 0, joined: 0, rotated: 0, switches: 0, cases: 0 };
  const OPS = ['<', '>', '==']; const NOT = { '<': '>=', '>': '<=', '==': '!=', '>=': '<', '<=': '>', '!=': '==' };
  // The comparison at the top level of a test's text, outside every bracket.
  const topOp = t => {
    let depth = 0;
    const found = [];
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (ch === '(' || ch === '[') depth++;
      else if (ch === ')' || ch === ']') depth--;
      else if (depth === 0) { const m = /^ (==|!=|<=|>=|<|>) /.exec(t.slice(i)); if (m) { found.push({ op: m[1], i }); i += m[0].length - 1; } }
    }
    return found.length === 1 ? found[0] : null;
  };
  for (const r of pef.routines) {
    stats.routines++;
    const where = r.name.slice(0, 60);
    const ops = ctx.exeOpsOf(r), L = ctx.exePseudo(r).lines, b = ctx.exePseudoBlocks(r), rec = b.rec;
    // ---- the statements and their places, from the lines and the instructions ----
    const keep = []; for (let k = 0; k < L.length; k++) if (L[k].text !== '\u0002') keep.push(k);
    const firstAt = a => { for (const k of keep) if (L[k].at >= a) return k; return null; };
    const nextOf = new Map(); keep.forEach((k, i) => nextOf.set(k, i + 1 < keep.length ? keep[i + 1] : null));
    const opAt = new Map(ops.map((o, i) => [o.at, i]));
    const inside = a => a !== null && a >= r.offset && a < r.offset + r.length;
    const succ = new Map(), kindOf = new Map();
    // (1) flow, and the places each statement goes to
    const flowLines = new Map();
    for (const k of keep) if (L[k].flow) { if (flowLines.has(L[k].at)) bad.flow.push(where + ': two lines with a flow at +0x' + (L[k].at - r.offset).toString(16)); flowLines.set(L[k].at, k); }
    for (const k of keep) {
      const l = L[k], nx = nextOf.get(k);
      succ.set(k, nx === null ? [] : [nx]); kindOf.set(k, 'plain');
      if (!l.flow) continue;
      const i = opAt.get(l.at), o = ops[i], d = o && o.d;
      if (!d || !d.branch || d.lk) { bad.flow.push(where + ': a flow on a line with no jump at +0x' + (l.at - r.offset).toString(16)); continue; }
      let want;
      if (d.indirect === 'lr') want = ctx.exeConditional(d) ? null : 'end';
      else if (d.indirect) want = ctx.exeSwitchTargets(r, ops, i) ? 'switch' : 'end';
      else if (ctx.exeConditional(d)) want = 'cond';
      else want = inside(o.to) ? 'jump' : 'end';
      if (want !== l.flow.kind) { bad.flow.push(where + ': +0x' + (l.at - r.offset).toString(16) + ' ' + o.text + ' has a flow of ' + l.flow.kind + ', not ' + want); continue; }
      kindOf.set(k, want);
      if (want === 'end') succ.set(k, []);
      else if (want === 'jump') succ.set(k, [firstAt(o.to)]);
      else if (want === 'cond') succ.set(k, [firstAt(o.to)].concat(nx === null ? [] : [nx]));
      else if (want === 'switch') succ.set(k, [...new Set(ctx.exeSwitchTargets(r, ops, i).map(firstAt))]);
    }
    for (let i = 0; i < ops.length; i++) {
      const d = ops[i].d;
      if (!d || !d.branch || d.lk) continue;
      if (d.indirect === 'lr' && ctx.exeConditional(d)) continue;
      if (!flowLines.has(ops[i].at)) bad.flow.push(where + ': no line has the jump at +0x' + (ops[i].at - r.offset).toString(16));
    }
    const hasJumps = keep.some(k => kindOf.get(k) !== 'plain' && kindOf.get(k) !== 'end');
    if (hasJumps) { stats.withJumps++; if (!b.gotos) stats.whole++; }
    stats.gotos += b.gotos; stats.blocks += rec.structured; stats.rotated += b.rotated.size / 2;
    let expected = new Set();
    for (const k of keep) for (const t of succ.get(k)) if (t !== null) expected.add(k + '>' + t);
    // ---- (11) switches, each tree run from its instructions ----
    const folded = new Set(), wantAll = new Map();
    for (const tr of b.trees || []) {
      stats.switches++;
      const M = new Set(tr.members), at0 = opAt.get(L[tr.root].at);
      // The straight run of instructions the root's branch ends: back to the
      // last branch, or to an instruction a jump lands on.
      const landed = new Set(); for (const o of ops) if (o.d && o.d.branch && !o.d.lk && o.to !== null && o.to !== undefined) landed.add(o.to);
      // The run starts at the compare the root's branch reads, the last
      // into its field, with the value in that compare's register and in
      // any register a copy in the same straight run joins to it.
      let start = at0;
      while (start > 0 && at0 - start < 8 && !(ops[start - 1].d && ops[start - 1].d.branch) && !landed.has(ops[start].at)) start--;
      let cmpAt = -1;
      for (let i = at0 - 1; i >= start; i--) { const d = ops[i].d; if (d && (d.mn === 'cmpwi' || d.mn === 'cmplwi') && d.crf === ops[at0].d.bi >> 2) { cmpAt = i; break; } }
      if (cmpAt < 0) { bad.switches.push(where + ': the tree at +0x' + (L[tr.root].at - r.offset).toString(16) + ' has no compare before its first branch'); continue; }
      const seed = new Set([ops[cmpAt].d.ra]);
      for (let i = start; i < at0; i++) { const d = ops[i].d; if (d && d.mn === 'mr' && (seed.has(d.rs) || seed.has(d.ra))) { seed.add(d.rs); seed.add(d.ra); } }
      start = cmpAt;
      const memberAt = a => { const k = flowLines.get(a); return k !== undefined && M.has(k); };
      const consts = new Set([0, 0x80000000]);
      const hiAt = Math.max(...tr.members.map(k => L[k].at));
      for (let i = start; i < ops.length && ops[i].at <= hiAt; i++) {
        const d = ops[i].d;
        if (d && (d.mn === 'cmpwi' || d.mn === 'cmplwi')) { consts.add(d.imm >>> 0); consts.add((d.imm + 1) >>> 0); }
      }
      const runFor = v => {
        let i = start, runStart = ops[start].at, regs = null, entered = false;
        const cr = [];
        for (let g = 0; g < 4096; g++) {
          const o = ops[i], d = o && o.d;
          if (!d) return null;
          if (d.mn === 'cmpwi' || d.mn === 'cmplwi') {
            if (regs === null) regs = new Set(seed);
            if (!regs.has(d.ra)) return firstAt(runStart);
            const a = d.mn === 'cmplwi' ? v >>> 0 : v | 0, c = d.mn === 'cmplwi' ? d.imm >>> 0 : d.imm | 0;
            cr[d.crf] = [a < c, a > c, a === c];
            i++; continue;
          }
          if (regs !== null && (d.mn === 'mr' || (d.mn === 'or' && d.rs === d.rb)) && regs.has(d.rs)) { regs.add(d.ra); i++; continue; }
          if (d.branch && !d.lk && regs !== null) {
            if (!memberAt(o.at)) return firstAt(runStart);
            entered = true;
            if (/^b[tf]$/.test(d.mn)) {
              const f = cr[d.bi >> 2];
              if (!f) return null;
              if (f[d.bi & 3] === (d.mn === 'bt')) { i = opAt.get(o.to); runStart = o.to; } else { i++; runStart = ops[i].at; }
            } else if (!d.conditional && !d.indirect) { i = opAt.get(o.to); runStart = o.to; }
            else return null;
            if (i === undefined) return null;
            continue;
          }
          // Before the root's branch, a store or the frame's set-up between
          // the compare and the branch is passed over unless it writes the
          // value's register.
          if (!entered) { const w = d.rd !== undefined ? d.rd : d.rt; if (w !== undefined && regs && regs.has(w)) return null; i++; continue; }
          return firstAt(runStart);
        }
        return null;
      };
      const P = [...consts].sort((x, y) => x - y), runs = [];
      let lost = false;
      for (let q = 0; q < P.length; q++) {
        const lo = P[q], hi = q + 1 < P.length ? P[q + 1] - 1 : 0xFFFFFFFF, end = runFor(lo);
        if (end === null) { lost = true; break; }
        if (runs.length && runs[runs.length - 1].end === end) runs[runs.length - 1].hi = hi; else runs.push({ lo, hi, end });
      }
      if (lost) { bad.switches.push(where + ': the tree at +0x' + (L[tr.root].at - r.offset).toString(16) + ' could not be run from its instructions'); continue; }
      const size = new Map(); for (const u of runs) size.set(u.end, (size.get(u.end) || 0) + (u.hi - u.lo + 1));
      const def = [...size.entries()].sort((x, y) => y[1] - x[1])[0][0];
      const val = v => tr.unsigned ? v >>> 0 : v | 0;
      const want = new Map();
      for (const u of runs.filter(u => u.end !== def).sort((x, y) => val(x.lo) - val(y.lo)))
        (want.get(u.end) || want.set(u.end, []).get(u.end)).push(u.lo === u.hi ? String(val(u.lo)) : val(u.lo) + ' to ' + val(u.hi));
      (want.get(def) || want.set(def, []).get(def)).push('default');
      for (const [k, cs] of want) { stats.cases++; wantAll.set(k, (wantAll.get(k) || []).concat(cs)); }
      /* Printed as a block whose exit is the default place (a switch with
         no default case), the place after the closing brace is where the
         switch goes on and its label has no `default`. The block is read
         from the printed lines: the switch line with an opening brace, its
         closing brace at the same depth, and the first statement that
         follows the brace. */
      const P0 = b.lines, open = P0.findIndex(l => l.at === L[tr.root].at && /^switch \(.*\) \{$/.test(l.text));
      if (open >= 0) {
        let close = open + 1;
        while (close < P0.length && !(P0[close].depth === P0[open].depth && P0[close].text === '}')) close++;
        const after = P0.slice(close + 1).find(l => l.at !== null && l.text !== '\u0002');
        if (after && firstAt(after.at) === def) { const cs = wantAll.get(def), d = cs.lastIndexOf('default'); if (d >= 0) cs.splice(d, 1); }
      }
      // (2) and (4): the tree is its root, which goes to the places.
      for (const e of [...expected]) { const [from, to] = e.split('>').map(Number); if (M.has(from)) expected.delete(e); else if (M.has(to) && to !== tr.root) bad.edges.push(where + ': a jump into the middle of the switch at ' + tr.root); }
      for (const k of want.keys()) expected.add(tr.root + '>' + k);
      for (const k of M) if (k !== tr.root) folded.add(k);
    }
    // The labels the reader sees, by the place each lands on: a jump
    // table's cases first, as the switch line through it gives them, then
    // each tree's in the order of the trees.
    if (wantAll.size) {
      const printed = new Map(), table = new Map();
      for (const l of b.lines) if (l.text === '\u0002' && l.cases) { const k = firstAt(l.at); printed.set(k, (printed.get(k) || []).concat(l.cases)); }
      for (const k of keep) { const f = L[k].flow; if (f && f.kind === 'switch') for (const [a, cs] of f.cases) { const t = firstAt(a); table.set(t, (table.get(t) || []).concat(cs.map(String))); } }
      for (const [k, cs] of wantAll) {
        const got = (printed.get(k) || []).join(', '), exp = (table.get(k) || []).concat(cs).join(', ');
        if (got !== exp) { bad.switches.push(where + ': the place +0x' + (L[k].at - r.offset).toString(16) + ' is printed case ' + (got || 'nothing') + ', and the instructions reach it for ' + exp); break; }
      }
    }
    // ---- (2) the folds contracted out, then the edges compared ----
    // A test joined into a condition, in any round of the join, counts as
    // the condition's first test. A jump between two tests of one condition
    // is inside it (the truth table of (6) reads those), and one from
    // anywhere else into a test past the first enters it halfway.
    const head = new Map();
    for (const [p, h] of b.joined) head.set(p, h);
    for (const [p, h] of rec.merged) head.set(p, h);
    const top = x => { for (let g = 0; head.has(x) && g < 64; g++) x = head.get(x); return x; };
    if (head.size) {
      const next = new Set();
      for (const e of expected) {
        const [from, to] = e.split('>').map(Number);
        const hf = top(from), ht = top(to);
        if (ht === hf && to !== hf) continue;
        if (head.has(to)) { bad.edges.push(where + ': a jump into the middle of the condition at ' + ht); continue; }
        next.add(hf + '>' + to);
      }
      expected = next;
    }
    if (rec.ended) for (const [from, to] of rec.ended) {
      const k = from, i = opAt.get(L[k].at), o = ops[i];
      let x = o && o.d && !o.d.indirect && !ctx.exeConditional(o.d) ? firstAt(o.to) : null, hops = 0;
      while (x !== null && x !== to && rec.ended.has(x) && hops++ < 8) x = rec.ended.get(x);
      if (x !== to || kindOf.get(to) !== 'end') bad.returns.push(where + ': +0x' + (L[k].at - r.offset).toString(16) + ' is printed as a return it does not jump to');
      else expected.delete(from + '>' + firstAt(o.to));
    }
    if (rec.absorbed.size) {
      const to1 = new Map(); for (const a of rec.absorbed) to1.set(a, succ.get(a)[0]);
      for (let pass = 0; pass < 8; pass++) {
        let moved = false; const next = new Set();
        for (const e of expected) {
          const [from, to] = e.split('>').map(Number);
          if (rec.absorbed.has(from)) { moved = true; continue; }
          if (rec.absorbed.has(to)) { next.add(from + '>' + to1.get(to)); moved = true; continue; }
          next.add(e);
        }
        expected = next; if (!moved) break;
      }
    }
    const actual = ctx.dvmStructureEdges(rec.tree, null);
    let diff = null;
    for (const e of expected) if (!actual.has(e)) { diff = 'lost ' + e; break; }
    if (!diff) for (const e of actual) if (!expected.has(e)) { diff = 'invented ' + e; break; }
    if (diff) bad.edges.push(where + ': ' + diff);
    // ---- (3) regions ----
    for (const blk of ctx.dvmBlocksOf(rec.tree, null)) {
      if (!blk.body.length) continue;
      const ins = new Set();
      (function collect(list) { for (const n of list) { if (n.kind === 'stmt') ins.add(n.stmt.abs); if (n.cond) ins.add(n.cond.abs); for (const q of ['then', 'els', 'body']) if (n[q]) collect(n[q]); } })(blk.body);
      const h = ctx.dvmFirstAbs(blk.body[0]);
      for (const e of expected) {
        const [from, to] = e.split('>').map(Number);
        if (ins.has(to) && !ins.has(from) && to !== h) { bad.regions.push(where + ': a jump into the middle of a ' + blk.kind + ' block'); break; }
        if (ins.has(from) && !ins.has(to) && blk.exits.indexOf(to) < 0) { bad.regions.push(where + ': a ' + blk.kind + ' block left for a third place'); break; }
      }
    }
    // ---- (4) statements ----
    const seen = [];
    (function walk(list) {
      for (const n of list) {
        const one = s => { if (s.joined) s.joined.forEach(one); else if (s.parts) s.parts.forEach(one); else seen.push(s.abs); };
        if (n.kind === 'stmt') one(n.stmt);
        if (n.cond) one(n.cond);
        for (const q of ['then', 'els', 'body']) if (n[q]) walk(n[q]);
      }
    })(rec.tree);
    const want4 = keep.filter(k => !rec.absorbed.has(k) && !folded.has(k)).join(','), got4 = seen.slice().sort((x, y) => x - y).join(',');
    if (want4 !== got4) bad.statements.push(where + ': ' + keep.length + ' statements in, ' + seen.length + ' out');
    // ---- (5) operators ----
    for (const k of keep) {
      const f = L[k].flow;
      if (!f || f.kind !== 'cond') continue;
      const d = ops[opAt.get(L[k].at)].d;
      if (!/^b[tf]$/.test(d.mn)) continue;
      const which = d.bi & 3, yes = d.mn === 'bt';
      const op = yes ? OPS[which] : NOT[OPS[which]];
      const t = topOp(f.taken.replace(/^earlier: /, '')), n = topOp(f.fall.replace(/^earlier: /, ''));
      if (!t || t.op !== op || !n || n.op !== NOT[op] || f.taken.replace(' ' + t.op + ' ', ' ' + n.op + ' ') !== f.fall)
        bad.operators.push(where + ': +0x' + (L[k].at - r.offset).toString(16) + ' ' + d.mn + ' bit ' + which + ' printed ' + f.taken + ' / ' + f.fall);
    }
    // ---- (6) joined tests ----
    // A joined condition's text through exeJoinTests, round by round, with
    // each single test as `leaf` gives it.
    const leavesOf = s => s.joined ? s.joined.flatMap(leavesOf) : [s];
    const textWith = (s, leaf, toward) => s.joined
      ? ctx.exeJoinTests(s.toE, s.joined.map(p => textWith(p, leaf, true)), s.joined.map(p => textWith(p, leaf, false)), toward)
      : leaf(s.abs, toward);
    for (const s of b.list) {
      if (!s.joined) continue;
      stats.joined++;
      const parts = leavesOf(s), n = parts.length;
      if (n > 12) continue;
      const E = s.targets[0], T = s.follow, index = new Map(parts.map((p, i) => [p.abs, i]));
      const name = parts.map((p, i) => 'c' + i);
      const leaf = (abs, toward) => (toward ? '' : '!') + name[index.get(abs)];
      const towardE = new Function(...name, 'return ' + textWith(s, leaf, true) + ';');
      const towardT = new Function(...name, 'return ' + textWith(s, leaf, false) + ';');
      for (let m = 0; m < (1 << n); m++) {
        const v = name.map((c, i) => !!(m >> i & 1));
        // Where the tests send control, one jump at a time, from the first.
        let at = parts[0].abs, g = 0;
        while (index.has(at) && g++ <= n) { const i = index.get(at); at = v[i] ? succ.get(at)[0] : nextOf.get(at); }
        if (at !== E && at !== T) { bad.joined.push(where + ': a joined test of ' + n + ' parts goes elsewhere for ' + v.map(x => x ? 1 : 0).join('')); break; }
        if (towardE(...v) !== (at === E) || towardT(...v) !== (at === T)) { bad.joined.push(where + ': a joined test of ' + n + ' parts is wrong for ' + v.map(x => x ? 1 : 0).join('')); break; }
      }
    }
    // ---- (7) to (10), the printed lines read back ----
    const P = b.lines;
    // The nesting the printed lines show: each opening line with its
    // children and its closing line.
    const root = { kids: [] }, stack = [root];
    for (let i = 0; i < P.length; i++) {
      const l = P[i], t = l.text;
      if (t === '\u0002') { stack[stack.length - 1].kids.push({ label: l, i }); continue; }
      if (t === '}' || t === '} else {' || /^\} while \(/.test(t)) {
        const open = stack.pop();
        open.close = l; open.closeIndex = i;
        if (t === '} else {') { const e = { kind: 'else', line: l, i, kids: [], parent: open.parent, of: open }; open.parent.kids.push(e); stack.push(e); }
        continue;
      }
      if (/\{$/.test(t)) {
        const kind = /^while /.test(t) ? 'while' : t === 'do {' ? 'do' : t === 'loop {' ? 'loop' : /^switch \(/.test(t) ? 'switch' : 'if';
        const node = { kind, line: l, i, kids: [], parent: stack[stack.length - 1] };
        stack[stack.length - 1].kids.push(node); stack.push(node);
        continue;
      }
      stack[stack.length - 1].kids.push({ stmt: l, i, parent: stack[stack.length - 1] });
    }
    // The address of the first statement a node reaches.
    const firstOf = n => {
      if (n.stmt) return n.stmt.at;
      if (n.label) return null;
      if (n.kind === 'if' || n.kind === 'while' || n.kind === 'switch') return n.line.at;
      for (const c of n.kids) { const a = firstOf(c); if (a !== null) return a; }
      return null;
    };
    const firstInside = n => { for (const c of n.kids) { const a = firstOf(c); if (a !== null) return a; } return null; };
    const isLoop = n => n.kind === 'while' || n.kind === 'do' || n.kind === 'loop';
    // Where control goes after a node, from the printed nesting.
    const contOf = n => {
      const sib = n.parent.kids;
      let j = sib.indexOf(n) + 1;
      // An if's else is not where its then-block goes.
      while (j < sib.length && sib[j].kind === 'else') j++;
      for (; j < sib.length; j++) { const a = firstOf(sib[j]); if (a !== null) return a; }
      const p = n.parent;
      if (p === root) return null;
      if (p.kind === 'while') return p.line.at;
      if (p.kind === 'do') return p.close.at;
      if (p.kind === 'loop') return firstOf(p);
      return contOf(p.kind === 'else' ? p.of : p);
    };
    const placeAt = a => { const k = firstAt(a); return k === null ? null : L[k].at; };
    const condAt = a => { const k = flowLines.get(a); return k === undefined ? null : k; };
    // The text a test has toward a place: one test's taken or fall, or a joined run's.
    const listAt = new Map(b.list.map(x => [x.abs, x]));
    const senseText = (k, toPlace) => {
      const s = listAt.get(k), f = L[k].flow;
      if (s && s.joined) {
        const E = L[s.targets[0]].at, T = L[s.follow].at;
        const leaf = (abs, toward) => toward ? L[abs].flow.taken : L[abs].flow.fall;
        if (toPlace === E) return textWith(s, leaf, true);
        if (toPlace === T) return textWith(s, leaf, false);
        return null;
      }
      // A place, and where it goes when it is a plain jump: a `while` with
      // its test at the end is entered by the jump to the test, which is
      // not printed, so its line has the test's address.
      const via = x => { const out = [L[x].at]; for (let g = 0; kindOf.get(x) === 'jump' && g < 8; g++) { x = succ.get(x)[0]; out.push(L[x].at); } return out; };
      const [t, nx] = succ.get(k);
      const toT = t !== undefined && t !== null && via(t).includes(toPlace), toN = nx !== undefined && nx !== null && via(nx).includes(toPlace);
      if (toT && !toN) return f.taken;
      if (toN && !toT) return f.fall;
      // A test both of whose ways go to one place (TViewer::Render has
      // one, an empty case) is true either way it is printed.
      if (toT && toN) return ANY;
      return null;
    };
    const printed = new Set(P.filter(l => l.text === '\u0002').map(l => l.at));
    (function check(n) {
      for (const c of n.kids || []) {
        if (c.kind === 'if' || c.kind === 'while') {
          const m = /^(?:if|while) \((.*)\) \{$/.exec(c.line.text), k = condAt(c.line.at);
          const into = firstInside(c);
          if (m && k !== null && into !== null) {
            const want = senseText(k, into);
            if (want !== ANY && want !== m[1]) bad.sense.push(where + ': +0x' + (c.line.at - r.offset).toString(16) + ' prints ' + m[1] + ' over a block that the jump reaches with ' + want);
          }
        }
        if (c.kind === 'do') {
          const m = /^\} while \((.*)\)$/.exec(c.close.text), k = condAt(c.close.at), into = firstOf(c);
          if (m && k !== null && ![ANY, m[1]].includes(senseText(k, into))) bad.sense.push(where + ': +0x' + (c.close.at - r.offset).toString(16) + ' repeats on ' + m[1]);
        }
        if (c.stmt) {
          const t = c.stmt.text, k = condAt(c.stmt.at);
          const m = /^if \((.*)\) (goto \u0001|break|continue)$/.exec(t) || (/^(goto \u0001|break|continue)$/.test(t) ? [t, null, t] : null);
          if (m && k !== null) {
            const word = m[2];
            let dest = null;
            if (word === 'goto \u0001') {
              dest = placeAt(c.stmt.to);
              if (!printed.has(c.stmt.to)) bad.labels.push(where + ': goto +0x' + (c.stmt.to - r.offset).toString(16) + ' has no label');
              else {
                const li = P.findIndex(l => l.text === '\u0002' && l.at === c.stmt.to);
                const after = P.slice(li + 1).find(l => l.at !== null && l.text !== '\u0002');
                if (!after || after.at !== dest) bad.labels.push(where + ': label +0x' + (c.stmt.to - r.offset).toString(16) + ' is not before the statement the jump lands on');
              }
            } else {
              // A `break` leaves the innermost loop or switch, and a
              // `continue` goes around the innermost loop (switch blocks,
              // 11 November 2026).
              let loop = c.parent;
              const stops = n => isLoop(n) || (word === 'break' && n.kind === 'switch');
              while (loop !== root && !stops(loop)) loop = loop.kind === 'else' ? loop.of.parent : loop.parent;
              if (loop === root) { bad.exits.push(where + ': ' + word + ' outside a loop'); continue; }
              dest = word === 'break' ? contOf(loop) : loop.kind === 'while' ? loop.line.at : loop.kind === 'do' ? loop.close.at : firstOf(loop);
              const s = succ.get(k), jumpsTo = s && s[0] !== undefined && s[0] !== null ? L[s[0]].at : null;
              if (jumpsTo !== dest) bad.exits.push(where + ': ' + word + ' at +0x' + (c.stmt.at - r.offset).toString(16) + ' goes to ' + (jumpsTo === null ? 'nothing' : '+0x' + (jumpsTo - r.offset).toString(16)) + ', not ' + (dest === null ? 'the end' : '+0x' + (dest - r.offset).toString(16)));
            }
            if (m[1] && dest !== null && ![ANY, m[1]].includes(senseText(k, dest))) bad.sense.push(where + ': +0x' + (c.stmt.at - r.offset).toString(16) + ' jumps on ' + m[1]);
          }
        }
        check(c);
      }
    })(root);
  }
  return { bad, stats };
}

let failures = 0;
if (controls) {
  for (const [name, c] of Object.entries(CONTROLS)) {
    const res = run(name);
    if (res.fatal) { console.log('FAIL ' + res.fatal); failures++; continue; }
    const n = res.bad[c.mustFail].length;
    if (n) console.log(`  ok   control ${name} fails ${c.mustFail}  — ${n} finding(s)`);
    else { console.log(`FAIL control ${name} does not fail ${c.mustFail}`); failures++; }
  }
  console.log(failures ? `FAIL BLOCKS controls: ${failures} passed that should fail` : `BLOCKS controls: all ${Object.keys(CONTROLS).length} fail their assertion`);
  process.exit(failures ? 1 : 0);
}
const res = run(null);
if (res.fatal) { console.log('FAIL ' + res.fatal); process.exit(1); }
for (const [what, list] of Object.entries(res.bad)) {
  if (list.length) { failures++; console.log(`FAIL ${what}: ${list.length} — ${list.slice(0, 3).join('; ')}`); }
  else console.log(`  ok   ${what}`);
}
const s = res.stats;
console.log(failures ? `FAIL — ${failures} assertion(s)` : `BLOCKS ${s.withJumps} routines with jumps, ${s.whole} with no goto left, ${s.gotos} gotos left, ${s.blocks} blocks, ${s.joined} joined tests, ${s.rotated} whiles with the test at the end, ${s.switches} trees of compares as switches with ${s.cases} places`);
process.exit(failures ? 1 : 0);
