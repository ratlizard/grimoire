#!/usr/bin/env node
/* backstage_check.mjs -- the Behind the Scenes fixes (DATA_RSRC_FIXES in
   js/delv-datafixes.js) against the shipped resource fork of Cythera Data.

     node utilities/backstage_check.mjs index.html "$TMPDIR/Cythera Data.rsrc"

   Each fix is applied, the corrected file is written as the section's
   download writes it (MacBinary, both forks) and read back through the
   page's own container reader, and then: every string a fix names says
   what the fix says it now says; every other resource is byte for byte
   the shipped one; and the fix applied a second time is refused, which is
   the negative control -- an applier that matched nothing, or matched
   loosely, would either change nothing or let the second run through.
   Cythera's fork, so with none this skips. */
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { pageSource } from './page_scripts.mjs';
import { makeSandbox } from './dom_stub.mjs';

const [htmlPath, forkPath] = process.argv.slice(2);
if (!htmlPath) { console.error('usage: backstage_check.mjs <page.html> <fork.rsrc>'); process.exit(2); }
if (!forkPath || !existsSync(forkPath)) { console.log('no resource fork to read — skipped'); process.exit(0); }
const { sandbox } = makeSandbox();
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), { filename: htmlPath }).runInContext(ctx);
const run = c => vm.runInContext(c, ctx);
sandbox.__rsrc = new Uint8Array(readFileSync(forkPath));
let failures = 0;
const fail = m => { failures++; console.log('  FAIL ' + m); };
const fixes = run('DATA_RSRC_FIXES.map(f => ({ id: f.id, rsrc: f.rsrc }))');
let edits = 0;
for (const f of fixes) {
  let r;
  try { r = run(`applyDataRsrcFixes(__rsrc, [${JSON.stringify(f.id)}])`); } catch (e) { fail(f.id + ': ' + e.message); continue; }
  sandbox.__fixed = r.rsrc;
  // Written and read back as the download is.
  const back = run(`(() => { const mb = writeMacBinary({ name: 'Cythera Data', type: 'DelS', creator: 'Delv', data: new Uint8Array(4), rsrc: __fixed }); return sniffMacContainer(mb).rsrc; })()`);
  sandbox.__back = back;
  for (const e of f.rsrc) {
    edits++;
    const got = run(`(() => { const s = resourceForkSpec(openResourceFork(__back)).resources.find(x => x.type === ${JSON.stringify(e.type)} && x.id === ${e.id}); return s ? decodeMacRoman(appStrList(s.data)[${e.index - 1}]) : null; })()`);
    if (got !== e.now) fail(`${f.id}: ${e.type} ${e.id} string ${e.index} reads "${got}", wanted "${e.now}"`);
  }
  const touched = new Set(f.rsrc.map(e => e.type + ' ' + e.id));
  const same = run(`(() => { const a = resourceForkSpec(openResourceFork(__rsrc)).resources, b = resourceForkSpec(openResourceFork(__back)).resources; const t = new Set(${JSON.stringify([...touched])});
    if (a.length !== b.length) return 'resource count ' + a.length + ' became ' + b.length;
    for (const x of a) { if (t.has(x.type + ' ' + x.id)) continue; const y = b.find(z => z.type === x.type && z.id === x.id); if (!y) return x.type + ' ' + x.id + ' is gone'; if (y.data.length !== x.data.length || y.data.some((v, i) => v !== x.data[i])) return x.type + ' ' + x.id + ' changed'; }
    return ''; })()`);
  if (same) fail(f.id + ': ' + same);
  let refused = false;
  try { run(`applyDataRsrcFixes(__fixed, [${JSON.stringify(f.id)}])`); } catch (e) { refused = true; }
  if (!refused) fail(f.id + ': applied a second time and not refused');
}
console.log(failures ? `\nFAIL — ${failures} problem(s)` : `${fixes.length} fix, ${edits} strings, written and read back; everything else unchanged; a second run refused`);
process.exit(failures ? 1 : 0);
