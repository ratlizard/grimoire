#!/usr/bin/env node
// js/mac-ppc.js against LLVM's PowerPC disassembler, word for word.
//
//   node utilities/ppc_check.mjs js/mac-ppc.js js/mac-pef.js <llvm-mc> [Cythera.data]
//
// WHY. The Mechanics sheet reads the game's clock, its healing, the talk
// balloon and the enemy table out of the application's PowerPC code, so a
// decoder that misreads a field puts a wrong number on the page with a link
// that seems to vouch for it. The decoder was written from the architecture's
// field layouts; LLVM's (`llvm-mc --disassemble --triple=powerpc`) was
// written from LLVM's own instruction tables, by other people, for other
// reasons. Two readings that agree on every word are evidence; one reading
// checked against itself is not.
//
// WHAT IS COMPARED. Three sets of words, each handed to both:
//
//   - every word of the application's code section, when the data fork is
//     given -- about 210,000, the only words the site reads in earnest;
//   - every branch-field combination (BO x BI x AA x LK over bc, bclr and
//     bcctr, and the BH field), every special-purpose register both ways and
//     every trap condition: the spellings with the most aliases, swept whole
//     rather than sampled, because the code section uses a handful of them;
//   - 300,000 words from a fixed-seed generator, half anything at all and
//     half aimed at the opcodes the decoder reads, so the fields' edges and
//     the reserved bits are reached.
//
// THE RULE, and it is three-sided on purpose. A word both read must read the
// same, mnemonic and operands (whitespace aside). A word LLVM refuses must be
// refused here. A word LLVM reads and this does not is allowed and counted
// by mnemonic: the decoder reads the 32-bit instructions a classic Mac
// application's compiler emits, and LLVM knows every PowerPC there has been
// (64-bit, vector, VSX, decimal floating point, the embedded cores), so the
// count is the size of what is deliberately unread. Then, over the code
// section, every word of every routine's body -- from its entry to its
// traceback table, by pefTracebacks -- must be read, so "unread" can never
// mean an instruction of the program.
//
// HOW LLVM'S OUTPUT IS LINED UP. llvm-mc prints one line per word it reads
// and, for a word it cannot, a warning on stderr naming the input line. The
// two together must account for every input line exactly, or the check
// fails before comparing anything: a misaligned comparison reports nonsense
// in both directions.
//
// NEGATIVE CONTROL. The comparison is run a second time through a decoder
// that spells one common instruction wrongly (addi as addic), and must then
// report exactly as many differences as there are addi words among those
// both read. A comparison that cannot see a wrong spelling would pass
// anything.
import { readFileSync, writeFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import vm from 'node:vm';

const [ppcPath, pefPath, llvmMc, dataPath] = process.argv.slice(2);
if (!ppcPath || !pefPath || !llvmMc) { console.error('usage: ppc_check.mjs <js/mac-ppc.js> <js/mac-pef.js> <llvm-mc> [Cythera.data]'); process.exit(2); }
if (!existsSync(llvmMc)) { console.log('SKIP: no llvm-mc at ' + llvmMc); process.exit(3); }

const ctx = vm.createContext({});
new vm.Script(readFileSync(pefPath, 'utf8') + '\n' + readFileSync(ppcPath, 'utf8')).runInContext(ctx);
let failed = 0;
const fail = m => { failed++; console.log('FAIL ' + m); };
const norm = s => s.replace(/\s+/g, ' ').trim();

// ---- the word sets ---------------------------------------------------------
const sets = [];
let code = null, routines = [];
if (dataPath && existsSync(dataPath)) {
  const bytes = new Uint8Array(readFileSync(dataPath));
  const img = ctx.pefLoad(bytes);
  const ci = img ? img.pef.sections.findIndex(s => s.kind === 0) : -1;
  if (ci < 0) fail('no code section in ' + dataPath);
  else {
    code = img.contents[ci].bytes;
    routines = ctx.pefTracebacks(img.pef, bytes);
    const words = [];
    for (let a = 0; a + 4 <= code.length; a += 4) words.push(((code[a] << 24) | (code[a + 1] << 16) | (code[a + 2] << 8) | code[a + 3]) >>> 0);
    sets.push({ name: 'code section', words });
  }
}
{
  const words = [];
  for (let bo = 0; bo < 32; bo++) for (const bi of [0, 2, 31]) for (const lk of [0, 1]) {
    for (const aa of [0, 1]) for (const bd of [8, 0xFFF8, 0x7FFC, 0x8000]) words.push(((16 << 26) | (bo << 21) | (bi << 16) | bd | (aa << 1) | lk) >>> 0);
    for (const xo of [16, 528]) for (let bh = 0; bh < 8; bh++) words.push(((19 << 26) | (bo << 21) | (bi << 16) | (bh << 11) | (xo << 1) | lk) >>> 0);
  }
  for (let spr = 0; spr < 1024; spr++) for (const xo of [339, 467]) words.push(((31 << 26) | (4 << 21) | ((((spr & 31) << 5) | (spr >> 5)) << 11) | (xo << 1)) >>> 0);
  for (let to = 0; to < 32; to++) {
    words.push(((3 << 26) | (to << 21) | (3 << 16) | 5) >>> 0);
    for (const [a, b] of [[3, 4], [0, 0], [3, 0]]) words.push(((31 << 26) | (to << 21) | (a << 16) | (b << 11) | (4 << 1)) >>> 0);
  }
  sets.push({ name: 'fields swept', words });
}
{
  // xorshift32, so the words are the same on every run and every machine.
  let x = 0x1999ACE5;
  const next = () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
  const ops = [3, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 34, 35, 36, 37, 38, 39,
               40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 59, 63];
  const xos = [0, 4, 8, 10, 11, 12, 14, 15, 16, 18, 19, 20, 21, 23, 24, 25, 26, 28, 32, 33, 40, 50, 55, 60, 72, 75, 87, 104, 119, 124, 129,
               136, 138, 144, 151, 183, 193, 200, 202, 215, 225, 232, 234, 235, 247, 257, 264, 266, 279, 284, 289, 311, 316, 339, 343, 375,
               407, 412, 417, 439, 444, 449, 459, 467, 491, 528, 535, 536, 567, 583, 599, 631, 663, 695, 727, 759, 792, 824, 922, 954];
  const words = [];
  for (let i = 0; i < 150000; i++) words.push(next());
  for (let i = 0; i < 150000; i++) {
    const op = ops[next() % ops.length];
    let w = ((op << 26) | (next() & 0x03FFFFFF)) >>> 0;
    if ((op === 19 || op === 31 || op === 59 || op === 63) && next() % 10 < 7) {
      if (next() % 10 < 3) w = (w & ~0x3E0) >>> 0;
      w = ((w & ~(0x3FF << 1)) | (xos[next() % xos.length] << 1)) >>> 0;
      if (next() & 1) w = (w & ~1) >>> 0;
    }
    words.push(w);
  }
  sets.push({ name: 'generated', words });
}

// ---- LLVM's reading, lined up ----------------------------------------------
const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'ppc-check-'));
const hex = w => [24, 16, 8, 0].map(s => '0x' + ((w >>> s) & 255).toString(16).padStart(2, '0')).join(' ');
function llvmRead(words, name) {
  const file = join(dir, name.replace(/\W+/g, '-') + '.txt');
  writeFileSync(file, words.map(hex).join('\n') + '\n');
  const run = spawnSync(llvmMc, ['--disassemble', '--triple=powerpc', file], { maxBuffer: 1 << 30, encoding: 'utf8' });
  const out = run.stdout || '', err = run.stderr || '';
  const refused = new Set([...err.matchAll(/:(\d+):\d+: warning: invalid instruction encoding/g)].map(m => +m[1] - 1));
  const lines = out.split('\n').filter(l => l.trim().length);
  if (lines.length + refused.size !== words.length) return null;
  let k = 0;
  return words.map((w, i) => refused.has(i) ? null : norm(lines[k++]));
}

// ---- the comparison --------------------------------------------------------
function compare(words, theirs, decode) {
  const r = { same: 0, refusedBoth: 0, differ: [], ours: [], theirsOnly: new Map() };
  words.forEach((w, i) => {
    const d = decode(w), mine = d ? norm(d.text) : null, L = theirs[i];
    if (mine === null && L === null) r.refusedBoth++;
    else if (L === null) r.ours.push(w);
    else if (mine === null) { const m = L.split(' ')[0]; r.theirsOnly.set(m, (r.theirsOnly.get(m) || 0) + 1); }
    else if (mine === L) r.same++;
    else r.differ.push([w, L, mine]);
  });
  return r;
}
const w8 = w => w.toString(16).padStart(8, '0');
let compared = 0, llvmAlone = new Map(), bodyWords = 0, control = '';
for (const set of sets) {
  const theirs = llvmRead(set.words, set.name);
  if (!theirs) { fail(set.name + ': llvm-mc’s output does not account for every word'); continue; }
  const r = compare(set.words, theirs, ctx.ppcDecode);
  compared += r.same;
  for (const [m, n] of r.theirsOnly) llvmAlone.set(m, (llvmAlone.get(m) || 0) + n);
  if (r.differ.length) fail(`${set.name}: ${r.differ.length} word(s) read differently, e.g. ` + r.differ.slice(0, 4).map(([w, L, J]) => `${w8(w)} LLVM "${L}" here "${J}"`).join('; '));
  if (r.ours.length) fail(`${set.name}: ${r.ours.length} word(s) LLVM refuses read here, e.g. ` + r.ours.slice(0, 4).map(w => w8(w) + ' "' + ctx.ppcDecode(w).text + '"').join('; '));
  if (set.name === 'code section') {
    // Every word of every routine's body is an instruction, and is read.
    let unread = [];
    for (const rt of routines) for (let a = rt.offset; a < rt.offset + rt.length; a += 4) { bodyWords++; if (!ctx.ppcDecode(set.words[a / 4])) unread.push(rt.name + '+0x' + (a - rt.offset).toString(16)); }
    if (unread.length) fail(`${unread.length} word(s) inside routines not read, e.g. ${unread.slice(0, 4).join(', ')}`);
    // The negative control, on the words the site reads.
    const wrong = w => { const d = ctx.ppcDecode(w); return d && d.mn === 'addi' ? Object.assign({}, d, { text: d.text.replace(/^addi/, 'addic') }) : d; };
    const addi = set.words.filter((w, i) => theirs[i] !== null && (ctx.ppcDecode(w) || {}).mn === 'addi').length;
    const c = compare(set.words, theirs, wrong);
    if (!addi || c.differ.length !== addi) fail(`the negative control: addi misspelt ${addi} times, ${c.differ.length} difference(s) reported`);
    else control = `; misspelling addi is caught ${addi.toLocaleString()} times out of ${addi.toLocaleString()}`;
  }
}
rmSync(dir, { recursive: true, force: true });

const alone = [...llvmAlone.values()].reduce((a, b) => a + b, 0);
const top = [...llvmAlone.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([m, n]) => m + ' ' + n).join(', ');
console.log(`${compared.toLocaleString()} words read the same by LLVM and here, none differently; ${alone.toLocaleString()} read by LLVM alone (${top}, ...)` +
  (code ? `; all ${bodyWords.toLocaleString()} words of ${routines.length.toLocaleString()} routines read` : '; no code section given') + control);
if (failed) { console.log(`FAIL — ${failed} problem(s)`); process.exit(1); }
console.log('ppc: clean');
