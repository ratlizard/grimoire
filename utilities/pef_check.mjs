#!/usr/bin/env node
// js/mac-pef.js over the application's data fork: the PEF container and the
// routines its code section names for itself.
//
//   node utilities/pef_check.mjs js/mac-pef.js "$TMPDIR/Cythera.data" [cythera_symbols.txt]
//
// Structural on its own: the container parses, the loader's counts agree
// with the tables it names, every imported symbol has a name from the
// string table, the routines come out in address order without overlap,
// and a handful of routines the sheets cite by name are found. With the
// workbench's cythera_symbols.txt beside it -- a list of the same routines
// recovered independently, with a Python reader, from the same traceback
// tables -- every line of that list must be found here at the same offset,
// with the same length and the same mangled name, which is the oracle half.
// That list writes each address four bytes past the entry (a `bl` lands
// four bytes before it, as the workbench's notes say), and the comparison
// allows for exactly that and nothing else. Prints a hash of the routine
// list so a change to the walk is visible.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { createHash } from 'node:crypto';

const [jsPath, dataPath, symPath] = process.argv.slice(2);
if (!jsPath || !dataPath) { console.error('usage: pef_check.mjs <js/mac-pef.js> <Cythera.data> [cythera_symbols.txt]'); process.exit(2); }
if (!existsSync(dataPath)) { console.log('SKIP: no application data fork at ' + dataPath); process.exit(3); }
const ctx = vm.createContext({});
new vm.Script(readFileSync(jsPath, 'utf8') + '\n;this.parsePEF = parsePEF; this.pefTracebacks = pefTracebacks; this.pefDemangle = pefDemangle;').runInContext(ctx);
const bytes = new Uint8Array(readFileSync(dataPath));
let failed = 0;
const fail = m => { failed++; console.log('FAIL ' + m); };

const pef = ctx.parsePEF(bytes);
if (!pef) { fail('not a PEF container'); process.exit(1); }
const ld = pef.loader;
if (!ld) fail('no loader section');
else {
  const counted = ld.libraries.reduce((n, L) => n + L.importedSymbolCount, 0);
  if (counted !== ld.symbols.length) fail(`libraries account for ${counted} symbols, the table has ${ld.symbols.length}`);
  if (ld.symbols.some(y => !y.name)) fail('an imported symbol has no name');
  if (ld.libraries.some(L => !L.name)) fail('an imported library has no name');
  if (ld.exports.length !== ld.exportedSymbolCount) fail(`exports: ${ld.exports.length} read of ${ld.exportedSymbolCount}`);
}
const rs = ctx.pefTracebacks(pef, bytes);
if (rs.length < 100) fail('only ' + rs.length + ' routines found');
for (let i = 1; i < rs.length; i++) if (rs[i].offset < rs[i - 1].offset + rs[i - 1].length) { fail(`routines overlap at ${rs[i].offset.toString(16)}`); break; }
for (const want of ['TGameViewer::DoTicks(', 'TBark::SetBark(', 'TMapWindow::KeyRoutine(', 'TCachedSegFiles::SaveEncryptedSegment('])
  if (!rs.some(r => r.name.startsWith(want))) fail('routine not found: ' + want);
// The demangler on shapes the file has.
const dm = ctx.pefDemangle;
for (const [m, want] of [['SetFont__9TApWidgetFss', 'TApWidget::SetFont(short, short)'], ['__ct__5TBarkFv', 'TBark::TBark()'], ['__dt__5TBarkFv', 'TBark::~TBark()'], ['main', 'main'], ['Foo__FPCcRi', 'Foo(const char*, int&)']])
  if (dm(m) !== want) fail(`demangle ${m}: ${dm(m)}`);

let oracle = 'no symbol list given';
if (symPath && existsSync(symPath)) {
  const ref = readFileSync(symPath, 'utf8').split('\n').map(l => /^0x([0-9A-Fa-f]+)\s+(\d+)\s+\d+\s+(\S+)/.exec(l)).filter(Boolean)
    .map(m => ({ addr: parseInt(m[1], 16), bytes: +m[2], mangled: m[3] }));
  const mine = new Map(rs.map(r => [r.offset + 4, r]));
  let missing = 0, wrong = 0;
  for (const r of ref) { const t = mine.get(r.addr); if (!t) missing++; else if (t.length !== r.bytes || t.mangled !== r.mangled) wrong++; }
  if (!ref.length) fail('the symbol list is empty');
  if (missing || wrong) { fail(`against the workbench's list: ${missing} missing, ${wrong} differ, of ${ref.length}`); oracle = `${missing} of the workbench's ${ref.length} routines missing and ${wrong} differ`; }
  else oracle = `all ${ref.length} of the workbench's routines found at the same offset, length and name; ${rs.length - ref.length} more here`;
} else if (symPath) oracle = 'symbol list not found at ' + symPath;

const hash = createHash('sha256').update(rs.map(r => r.offset + ' ' + r.length + ' ' + r.mangled).join('\n')).digest('hex').slice(0, 12);
console.log(`${pef.sections.length} sections, ${ld ? ld.libraries.length : 0} libraries, ${ld ? ld.symbols.length : 0} imports, ${rs.length} routines named; ${oracle}; ROUTINES ${hash}`);
if (failed) { console.log(`FAIL — ${failed} problem(s)`); process.exit(1); }
console.log('pef: clean');
