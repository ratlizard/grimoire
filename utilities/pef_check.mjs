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
//
// THE LOADER'S HALF (pefLoad, since September 2026, when the Mechanics sheet
// began reading figures out of the code and needed the data section and the
// TOC as the loader lays them out). There is no second implementation to
// hold it to -- the workbench's relocation simulator reads one instruction's
// fields the other way round -- so it is held to what a correct loader must
// produce in this particular program:
//
//   - the pattern-initialised data section expands to exactly its unpacked
//     size, consuming exactly its packed size, and the relocations run to
//     their end with nothing left unexplained;
//   - the TOC, the second word of main's transition vector, is inside the
//     data section;
//   - every cross-TOC glue stub (lwz r12,d(r2) ... bctr) names an import
//     through its TOC slot, which is only true if the imports were counted
//     into the right slots;
//   - every transition vector -- a relocated code pointer followed by the
//     TOC -- lands on the entry of a routine the traceback tables name or
//     outside every named routine (on the few without tables), never in
//     the middle of one, and most land on named entries.
//
// The last is tested twice, the second time with the code pointers read
// four bytes early, and that reading must break the rule: without that the
// rule could be one no layout fails.
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

// ---- the loader --------------------------------------------------------------
const lx = vm.createContext({});
new vm.Script(readFileSync(jsPath, 'utf8')).runInContext(lx);
const img = lx.pefLoad(bytes);
let loaderNote = '';
if (!img) fail('pefLoad refused the container');
else {
  const u32 = (b, o) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
  const ci = img.pef.sections.findIndex(x => x.kind === 0), di = img.pef.sections.findIndex(x => x.kind === 2);
  const codeB = ci >= 0 ? img.contents[ci].bytes : null, dataB = di >= 0 ? img.contents[di] : null;
  if (!codeB || !dataB) fail('no code section or no pattern-initialised data section');
  else {
    const ds = img.pef.sections[di];
    if (dataB.problem || dataB.produced !== ds.unpackedSize || dataB.consumed !== ds.packedSize)
      fail(`the data section expanded to ${dataB.produced} of ${ds.unpackedSize} bytes from ${dataB.consumed} of ${ds.packedSize}` + (dataB.problem ? ': ' + dataB.problem : ''));
    if (img.relocs.problems.length) fail('relocations: ' + img.relocs.problems.slice(0, 3).join('; '));
    if (!img.toc || img.toc.section !== di || img.toc.offset >= ds.totalSize) fail('the TOC is not in the data section: ' + JSON.stringify(img.toc));
    else {
      const toc = img.toc.offset;
      let glue = 0, named = 0;
      for (let a = 0; a + 24 <= codeB.length; a += 4) {
        const w = u32(codeB, a);
        if (((w & 0xFFFF0000) >>> 0) !== 0x81820000 || u32(codeB, a + 20) !== 0x4E800420) continue;
        glue++;
        const d = (w & 0x8000) ? (w & 0xFFFF) - 0x10000 : (w & 0xFFFF);
        const p = lx.pefPointerAt(img, di, toc + d);
        if (p && p.name) named++;
      }
      if (!glue || named !== glue) fail(`glue: ${named} of ${glue} stubs name an import`);
      const starts = new Set(rs.map(r => r.offset));
      const inside = a => { let lo = 0, hi = rs.length - 1; while (lo <= hi) { const m = (lo + hi) >> 1; if (rs[m].offset > a) hi = m - 1; else if (rs[m].offset + rs[m].length <= a) lo = m + 1; else return rs[m]; } return null; };
      const map = img.relocs.bySection.get(di);
      const vectors = early => {
        let n = 0, entry = 0, loose = 0, astray = [];
        for (const [o, t] of map) {
          if (t.section !== ci) continue;
          const next = map.get(o + 4);
          if (!next || next.section !== di || u32(dataB.bytes, o + 4) !== toc) continue;
          n++;
          const at = u32(dataB.bytes, early ? o - 4 : o);
          if (starts.has(at)) entry++;
          else if (at % 4 === 0 && at < codeB.length && !inside(at)) loose++;
          else astray.push(at);
        }
        return { n, entry, loose, astray };
      };
      const v = vectors(false), control = vectors(true);
      if (!v.n || v.astray.length || v.entry * 2 < v.n)
        fail(`transition vectors: ${v.entry} on named entries, ${v.loose} outside named routines, ${v.astray.length} astray of ${v.n}` + (v.astray.length ? ', e.g. 0x' + v.astray[0].toString(16) : ''));
      else if (!control.astray.length) fail('the negative control: code pointers read four bytes early still all land on entries');
      else loaderNote = `; the loader: data section expanded exactly, TOC at 0x${toc.toString(16)}, ${named} glue stubs named, ${v.entry} of ${v.n} transition vectors on named entries and ${v.loose} on unnamed code, none astray (${control.astray.length} astray read four bytes early)`;
    }
  }
}

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
console.log(`${pef.sections.length} sections, ${ld ? ld.libraries.length : 0} libraries, ${ld ? ld.symbols.length : 0} imports, ${rs.length} routines named; ${oracle}${loaderNote}; ROUTINES ${hash}`);
if (failed) { console.log(`FAIL — ${failed} problem(s)`); process.exit(1); }
console.log('pef: clean');
