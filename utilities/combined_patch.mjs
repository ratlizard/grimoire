#!/usr/bin/env node
/* A builder, not a check: every fix patch this project builds, as one
   Magpie patch, "Cythera All Fixes": the four of 24 September 2026, Bryce
   Schroeder's six, the two map fixes of 26 September, and the further fixes
   of 27 September. (25 September 2026; Bryce's six joined the same day at the
   maintainer's word, "all in one".) The karma, resurrection and Peirithous
   fixes are kept out at his word, each a patch of its own.

   Usage: node utilities/combined_patch.mjs index.html "<Cythera Data.data>" <collection dir> <out dir>

   A Magpie patch carries whole resources, so two patches that touch one
   script cannot both apply: the second replaces the first's copy of it.
   The fixes are applied as stages instead, each on the file the one before
   left, in DATA_FIX_STAGES's order; js/delv-datafixes.js says why the order
   is the point. Until 28 September 2026 this ran each builder as a process
   and wrote the file out between stages; it applies the stages in one
   session now (applyDataFixes), and the file it writes was compared byte
   for byte with the one the chain of processes wrote.

   WHAT IS CHECKED. The combined patch merged onto the shipped file must
   give the chained file byte for byte. And each stage is also applied alone
   to the shipped file: a resource only one stage changes must come out of
   the chain exactly as that stage makes it alone. The resources more than
   one stage changes are listed by name, since there the result is the
   stages' edits together and no single stage's output is the reference.
   Those are not compared, and they need not be for the code edits: a code
   edit checks what it expects at every offset it edits, on the file it is
   given, and the text stages after it change words and move offsets without
   touching an instruction. What a shared resource can lose is a text fix
   another stage made first, and the three known are in js/delv-datafixes.js.

   `--control` leaves the found fixes out of the chain and in the
   comparison, and must fail: the run then names Ake's To Do line, sleep,
   eating and the rest as changed alone and not in the chain.

   Writes "<name>", "<name>.bin" and the patched "Cythera Data.data" into
   the out dir. What it writes is the game's data changed and belongs in no
   repository. */
import {writeFileSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import {pageContext, everyFix} from './patch_build.mjs';
import {readCollection} from './community_text_patch.mjs';

const CONTROL = process.argv.includes('--control');
const [htmlPath = 'index.html', dataPath, collDir, outDir] = process.argv.slice(2).filter(a => a !== '--control');
if (!dataPath || !collDir || !outDir) { console.error('usage: combined_patch.mjs index.html <Cythera Data.data> <collection dir> <out dir>'); process.exit(2); }
const NAME = 'Cythera All Fixes';
// A patch's description is a Pascal string of 255 bytes at most, which
// writeDelverPatch cuts without a word, so a longer one stops the build.
const DESCRIPTION = 'Every fix in one: Cythera Found Fixes, Cythera Community Fixes, Bryce Schroeder’s unofficial bugfixes, Cythera Further Fixes, Cythera Text Fixes, Cythera Community Text Fixes and Cythera Map Fixes, built in that order and checked against each alone.';
if (DESCRIPTION.length > 255) throw new Error('the description is ' + DESCRIPTION.length + ' characters, and a patch holds 255');

const {ctx} = pageContext(htmlPath, dataPath);
const ids = everyFix(htmlPath, 'us').filter(id => !['karma', 'resurrection', 'peirithous'].includes(id));
const res = vm.runInContext(`(() => {
  const ids = ${JSON.stringify(ids)}, typos = ${JSON.stringify(readCollection(collDir))};
  const stages = DATA_FIX_STAGES.filter(st => st !== 'apart' && st !== 'cost');
  const chainStages = ${JSON.stringify(CONTROL)} ? stages.filter(st => st !== 'found') : stages;
  const opts = st => ({ stages: st, communityTypos: typos });
  const chain = applyDataFixes(__a, ids, opts(chainStages));
  const alone = stages.map(st => applyDataFixes(__a, ids, opts([st])));
  const data = (done, id) => done.spec.resources.find(r => r.resid === id).data;
  const eq = (a, b) => a && b && a.length === b.length && a.every((x, i) => x === b[i]);
  const shared = [], wrong = [];
  for (const id of chain.changed) {
    const who = alone.map((a, i) => a.changed.includes(id) ? i : -1).filter(i => i >= 0);
    if (who.length > 1) shared.push({ id, who });
    else if (who.length === 1 && !eq(data(chain, id), data(alone[who[0]], id))) wrong.push(id);
    else if (!who.length) wrong.push(id);
  }
  const missing = [];
  alone.forEach((a, i) => { for (const id of a.changed) if (!chain.changed.includes(id)) missing.push({ id, stage: i }); });
  const patched = writeDelverArchive(chain.spec);
  const w = writeDelverPatch(chain.spec, chain.changed, { description: ${JSON.stringify(DESCRIPTION)}, typeCode: DELV_PATCH_EXPORT_TYPE });
  const bin = writeMacBinary({ name: ${JSON.stringify(NAME)}, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
  const merged = mergeDelverPatch(__a, w.bytes);
  const same = !!(merged && merged.bytes && eq(merged.bytes, patched));
  // The page's name for a resource where it has one without a file open
  // (a character's script does; a spell's needs the tables the page derives
  // on opening a file, and throws for want of them).
  const named = id => { try { return typeof labelFor === 'function' ? labelFor(id) : ''; } catch (e) { return ''; } };
  const label = id => '0x' + id.toString(16).toUpperCase() + (named(id) ? ' ' + named(id) : '');
  return { patch: Array.from(w.bytes), bin: Array.from(bin), patched: Array.from(patched), count: chain.changed.length, same, stages,
           shared: shared.map(s => label(s.id) + ' (' + s.who.map(i => stages[i]).join(', ') + ')'), wrong: wrong.map(label),
           missing: missing.map(m => label(m.id) + ' of stage ' + stages[m.stage]),
           perStage: alone.map((a, i) => stages[i] + ': ' + a.changed.length + ' resources') };
})()`, ctx);
mkdirSync(outDir, {recursive: true});
writeFileSync(join(outDir, NAME), Buffer.from(res.patch));
writeFileSync(join(outDir, NAME + '.bin'), Buffer.from(res.bin));
writeFileSync(join(outDir, 'Cythera Data.data'), Buffer.from(res.patched));
for (const l of res.perStage) console.log('  ' + l);
console.log(`  ${NAME}: ${res.count} resources, ${res.patch.length} bytes; merged onto the shipped file it ${res.same ? 'gives the chained file byte for byte' : 'does NOT give the chained file'}`);
console.log(`  changed by more than one stage (${res.shared.length}): ` + res.shared.join('; '));
if (res.wrong.length) console.log('  NOT as its one stage makes it alone: ' + res.wrong.join(', '));
if (res.missing.length) console.log('  changed by a stage alone and not in the chain: ' + res.missing.join(', '));
process.exit(res.same && !res.wrong.length && !res.missing.length ? 0 : 1);
