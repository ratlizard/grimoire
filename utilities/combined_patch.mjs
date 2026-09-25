#!/usr/bin/env node
/* A builder, not a check: the four fix patches of 24 September 2026 as one
   Magpie patch. (25 September 2026.)

   A Magpie patch carries whole resources, so two patches that touch one
   script cannot both apply: the second replaces the first's copy of it.
   Apis, the Cademia group and a dozen more scripts are in two or three of
   community_fixes_patch.mjs, found_fixes_patch.mjs, text_fixes_patch.mjs
   and community_text_patch.mjs. This runs them as stages, each on the
   previous one's patched data file, in the order below, and writes one
   patch holding every resource that differs from the shipped file.

   Usage: node utilities/combined_patch.mjs index.html "<Cythera Data.data>" <collection dir> <out dir>

   THE ORDER IS THE POINT. The two code stages go first, on the shipped
   file, because their edits are anchored to offsets and say what they
   expect to find there; every stage checks those expectations, so a stage
   that found its script moved would stop the build rather than write
   something wrong. The two text stages go last because they find their
   words rather than their offsets. The community's typo list comes after
   this project's text fixes: where both fix one sentence, the text stage's
   wording stands and the list reports the place as fixed already or not
   found (three places when this was written: "take the road" in Kosha,
   "quaters" in Pnyx, "kind looking" in Bryaxis's description, each read
   corrected in the result).

   WHAT IS CHECKED. The combined patch merged onto the shipped file must
   give the last stage's file byte for byte. And each stage is also run
   alone on the shipped file: a resource only one stage changes must come
   out of the chain exactly as that stage makes it alone. The resources
   more than one stage changes are listed by name, since there the result
   is the stages' edits together and no single stage's output is the
   reference. Those are not compared, and they need not be for the code
   edits: a code stage checks what it expects at every offset it edits, on
   the file it is given, and the text stages after it change words and move
   offsets without touching an instruction. What a shared resource can lose
   is a text fix another stage made first, and the three known are above. Bryce Schroeder's six (bugfix_patch.mjs) are not a stage:
   they stay a patch of their own, and the run says which resources the
   two patches share, since those two cannot be applied together either.

   `--control` leaves the found fixes out of the chain and in the
   comparison, and must fail: the run then names Ake's To Do line, sleep,
   eating and the rest as changed alone and not in the chain.

   Writes "<name>", "<name>.bin" and the patched "Cythera Data.data" into
   the out dir, and the stages' own outputs under "<out dir>/stages". What
   it writes is the game's data changed and belongs in no repository. */
import {readFileSync, writeFileSync, mkdirSync, rmSync, existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONTROL = process.argv.includes('--control');
const [htmlPath = 'index.html', dataPath, collDir, outDir] = process.argv.slice(2).filter(a => a !== '--control');
if (!dataPath || !collDir || !outDir) { console.error('usage: combined_patch.mjs index.html <Cythera Data.data> <collection dir> <out dir>'); process.exit(2); }
const NAME = 'Cythera Combined Fixes';
const STAGES = [
  { name: 'found', script: 'found_fixes_patch.mjs' },
  { name: 'community', script: 'community_fixes_patch.mjs' },
  { name: 'text', script: 'text_fixes_patch.mjs' },
  { name: 'community-text', script: 'community_text_patch.mjs', coll: true },
];
const stagesDir = join(outDir, 'stages');
rmSync(stagesDir, {recursive: true, force: true});
mkdirSync(stagesDir, {recursive: true});
const run = (st, input, out) => {
  const args = [join(HERE, st.script), htmlPath, input].concat(st.coll ? [collDir] : [], [out]);
  const r = spawnSync(process.execPath, args, {encoding: 'utf8', maxBuffer: 64 << 20});
  if (r.status !== 0) { console.error((r.stdout || '') + (r.stderr || '')); throw new Error(st.name + ' stopped (' + out + ')'); }
  const last = (r.stdout || '').trim().split('\n').pop();
  return {out, last};
};
let input = resolve(dataPath);
const chained = [], alone = [];
for (const st of STAGES) {
  if (!(CONTROL && st.name === 'found')) {
    const c = run(st, input, join(stagesDir, 'chain-' + st.name));
    chained.push(c); input = join(c.out, 'Cythera Data.data');
    console.log('  ' + st.name + ': ' + c.last.trim());
  }
  alone.push(run(st, resolve(dataPath), join(stagesDir, 'alone-' + st.name)));
}

const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
sandbox.__files = { shipped: new Uint8Array(readFileSync(dataPath)), final: new Uint8Array(readFileSync(input)),
                    alone: alone.map(a => new Uint8Array(readFileSync(join(a.out, 'Cythera Data.data')))) };
const bugfixPath = join(outDir, '..', 'bugfix', 'Cythera Data.data');
sandbox.__files.bugfix = existsSync(bugfixPath) ? new Uint8Array(readFileSync(bugfixPath)) : null;
const res = vm.runInContext(`(() => {
  const spec = b => delverArchiveSpec(b);
  const plainOf = (s, arcBytes) => { const arc = openDelverArchive(arcBytes); const m = new Map(); for (const r of s.resources) m.set(r.resid, smartDecrypt(getResourceBytes(arc, r.resid), r.resid).data); return m; };
  const eq = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
  const ship = plainOf(spec(__files.shipped), __files.shipped);
  const fin = plainOf(spec(__files.final), __files.final);
  const changedFrom = m => [...m.keys()].filter(id => !eq(m.get(id), ship.get(id)));
  const changed = changedFrom(fin);
  const byStage = __files.alone.map(b => plainOf(spec(b), b));
  const touched = byStage.map(m => new Set(changedFrom(m)));
  const shared = [], wrong = [];
  for (const id of changed) {
    const who = touched.map((s, i) => s.has(id) ? i : -1).filter(i => i >= 0);
    if (who.length > 1) shared.push({ id, who });
    else if (who.length === 1 && !eq(fin.get(id), byStage[who[0]].get(id))) wrong.push(id);
    else if (!who.length) wrong.push(id);
  }
  const missing = [];
  touched.forEach((s, i) => { for (const id of s) if (!changed.includes(id)) missing.push({ id, stage: i }); });
  const finalSpec = spec(__files.final);
  const w = writeDelverPatch(finalSpec, changed, { description: ${JSON.stringify('The four fix patches in one: Cythera Community Fixes, Cythera Found Fixes, Cythera Text Fixes and Cythera Community Text Fixes, built in that order of stages and checked against each alone.')}, typeCode: DELV_PATCH_EXPORT_TYPE });
  const bin = writeMacBinary({ name: ${JSON.stringify(NAME)}, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
  const merged = mergeDelverPatch(__files.shipped, w.bytes);
  const same = !!(merged && merged.bytes && eq(merged.bytes, __files.final));
  let withBugfix = null;
  if (__files.bugfix) { const bf = plainOf(spec(__files.bugfix), __files.bugfix); withBugfix = changedFrom(bf).filter(id => changed.includes(id)); }
  const label = id => '0x' + id.toString(16).toUpperCase() + ((typeof labelFor === 'function' && labelFor(id)) ? ' ' + labelFor(id) : '');
  return { patch: Array.from(w.bytes), bin: Array.from(bin), count: changed.length, same,
           shared: shared.map(s => label(s.id) + ' (' + s.who.join('+') + ')'), wrong: wrong.map(label), missing: missing.map(m => label(m.id) + ' of stage ' + m.stage),
           withBugfix: withBugfix && withBugfix.map(label) };
})()`, ctx);
writeFileSync(join(outDir, NAME), Buffer.from(res.patch));
writeFileSync(join(outDir, NAME + '.bin'), Buffer.from(res.bin));
writeFileSync(join(outDir, 'Cythera Data.data'), readFileSync(input));
const names = STAGES.map(s => s.name);
console.log(`  ${NAME}: ${res.count} resources, ${res.patch.length} bytes; merged onto the shipped file it ${res.same ? 'gives the last stage’s file byte for byte' : 'does NOT give the last stage’s file'}`);
console.log(`  changed by more than one stage (${res.shared.length}): ` + res.shared.map(s => s.replace(/\((\d(?:\+\d)*)\)/, (m, g) => '(' + g.split('+').map(i => names[+i]).join(', ') + ')')).join('; '));
if (res.wrong.length) console.log('  NOT as its one stage makes it alone: ' + res.wrong.join(', '));
if (res.missing.length) console.log('  changed by a stage alone and not in the chain: ' + res.missing.join(', '));
if (res.withBugfix) console.log(`  shared with Bryce’s six (patches/bugfix), so the two cannot be applied together: ${res.withBugfix.length ? res.withBugfix.join(', ') : 'none'}`);
process.exit(res.same && !res.wrong.length && !res.missing.length ? 0 : 1);
