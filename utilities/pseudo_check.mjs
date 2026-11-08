#!/usr/bin/env node
// A routine's pseudo-code (exePseudo in js/page-views.js) over the whole
// application: how many arguments each routine has (exeArgCount), held to
// the routines' demangled names, and what the pseudo-code prints.
//
//   node utilities/pseudo_check.mjs index.html "$TMPDIR/Cythera.data" [--control]
//
// WHY. Until 8 November 2026 a call in the pseudo-code was taken to read r3
// to r10 and was printed with the argument registers its block happened to
// set. So `TickCount()` could read `TickCount(arg1, arg2)`, and every
// register line before a call stayed in the listing whether a later
// instruction read it or no instruction did. exeArgCount works the number
// out from the code: the registers a routine reads before it sets them,
// with its callees' counts, all solved together.
//
// THE RULE. The traceback tables give no count (their fixedparms is 0 in
// every routine of this program), and no other part of the files has one.
// The names do, in part: `TViewer::SetStage(short, short)` has two
// arguments and `this`. Where a name lists only whole numbers, pointers and
// references, each of those is one register, so the count may be lower
// (an argument nothing reads, at the end of the list, does not count) and
// never higher than the list plus two: `this`, and one hidden argument the
// name does not show. A destructor has one (a flag for whether to free the
// object, 145 of them), and so does a routine that returns a struct by
// value (the address to write it to, as the tree's find and
// TApWindow::SelfWidget have), whose return type the name leaves out. A
// count above that is a fault of the liveness: a register taken as read
// that the routine sets first, or a callee counted high. Routines with a
// float, a struct passed by value, an enum or `...` in the list are left
// out, since their registers do not follow from the name.
//
// One routine over by reading is in ABOVE. CompileAIFile calls FSp_fopen,
// which calls the helper at 0xB3CA8, and that helper reads r7 on one path
// into its last block (the default of a run of compares) that never sets
// it. Nothing in the liveness rules that path out.
//
// THE CONTROL. With --control every import counts eight arguments, which is
// how a call into another library read before 8 November. The rule above
// must then fail, or it is a rule no count breaks.
//
// The figures are printed for the suite to pin: the routines checked, how
// many count exactly the list (a function) or the list plus one (a method),
// the lines of the pseudo-code over the whole program and the register lines
// among them, and the routines at eight, which are mostly the ones with
// eight arguments or more and the ones that take `...`.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { pageSource } from './page_scripts.mjs';
import { makeSandbox } from './dom_stub.mjs';

const args = process.argv.slice(2);
const control = args.includes('--control');
const [htmlPath = 'index.html', dataPath] = args.filter(a => !a.startsWith('--'));
if (!dataPath || !existsSync(dataPath)) { console.log('  skip  no application data fork at ' + dataPath); process.exit(0); }

const { sandbox } = makeSandbox();
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), { filename: htmlPath }).runInContext(ctx);
ctx.APP_DATA = new Uint8Array(readFileSync(dataPath));
const pef = ctx.appPef();
if (!pef || !pef.routines || !pef.routines.length) { console.log('FAIL the application has no routines'); process.exit(1); }
if (control) {
  const real = ctx.exeImportArgs();
  pef.importArgs = new Map([...real.keys()].map(k => [k, 8]));
}

let failures = 0;
const fail = m => { failures++; console.log('FAIL ' + m); };

// The argument list of a demangled name, split at its top-level commas.
const argList = name => {
  const open = name.indexOf('(');
  if (open < 0) return null;
  let depth = 0, cur = '';
  const out = [];
  for (let i = open + 1; i < name.length; i++) {
    const c = name[i];
    if (c === '(' || c === '<') depth++;
    if (c === ')' || c === '>') {
      if (depth === 0) { if (cur.trim()) out.push(cur.trim()); return out; }
      depth--;
    }
    if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  return null;
};
const ONE_REGISTER = /^(const )?((unsigned|signed) )?(char|short|int|long|bool)$|[*&]$/;

const ABOVE = new Set(['CompileAIFile(FSSpec&, short)']);
let checked = 0, asFunction = 0, asMethod = 0, hidden = 0, under = 0;
const over = [];
const hist = new Array(9).fill(0);
for (const r of pef.routines) {
  const n = ctx.exeArgCount(r);
  hist[n]++;
  const list = argList(r.name);
  if (!list || list.some(a => !ONE_REGISTER.test(a))) continue;
  checked++;
  if (n === list.length) asFunction++;
  else if (n === list.length + 1) asMethod++;
  else if (n === list.length + 2) hidden++;
  else if (n < list.length) under++;
  else if (!ABOVE.has(r.name)) over.push(r.name + ' counts ' + n);
}
if (over.length) fail(over.length + ' routines count more arguments than their names list with this and one hidden (' + over.slice(0, 5).join('; ') + ')');
else console.log(`  ok   no routine counts more arguments than its name lists, with this and one hidden  — ${checked} checked, ${asFunction} as many, ${asMethod} one more, ${hidden} two more, ${under} fewer`);

let lines = 0, registerLines = 0;
for (const r of pef.routines) for (const l of ctx.exePseudo(r).lines) { lines++; if (/^r\d+ = /.test(l.text) && !/^r3 = .*\(/.test(l.text)) registerLines++; }
console.log(`  ok   the pseudo-code  — ${lines} lines, ${registerLines} register lines, ${hist[8]} routines at eight arguments`);

/* One routine, read whole: TViewer::SetStage calls TickCount with nothing
   and the helper at 0xB46A0 with three arguments. */
const stage = ctx.exeRoutineNamed('TViewer::SetStage');
if (stage) {
  const text = ctx.exePseudo(stage).lines.map(l => l.text.replace('\u0001', l.to !== null ? ctx.exeTargetName(l.to) : '')).join('\n');
  if (ctx.exeArgCount(stage) !== 3) fail('TViewer::SetStage(short, short) counts ' + ctx.exeArgCount(stage) + ' arguments, not 3');
  if (!/^r3 = TickCount\(\)$/m.test(text)) fail('TViewer::SetStage calls TickCount with arguments');
  if (!/^r3 = 0xB46A0\([^,()]+, 0, 7688\)$/m.test(text)) fail('TViewer::SetStage calls 0xB46A0 with other than three arguments');
}

if (control) {
  // The control passes when the rule above catches the bent counts.
  console.log(over.length ? `PSEUDO control: ${over.length} routines over with every import at eight` : 'FAIL PSEUDO control: no routine over with every import at eight');
  process.exit(over.length ? 0 : 1);
}
console.log(failures ? `FAIL — ${failures} problem(s)` : `PSEUDO ${checked} checked, ${over.length} over, ${lines} lines, ${registerLines} register lines, ${hist[8]} at eight`);
process.exit(failures ? 1 : 0);
