#!/usr/bin/env node
// js/delv-datafixes.js and js/delv-datapatch.js, over the shipped scenario.
//
//   node utilities/data_fix_check.mjs index.html <Cythera Data.data> [collection dir] [--full]
//
// WHY. The fixes were built from 24 to 28 September 2026 as a handful of
// fixed patches, each written and checked whole: the found fixes, the
// community's, Bryce's six, the further fixes, the text, the maps, and the
// three kept apart. Since 28 September 2026 the Patches section lets a
// visitor choose any of them, which is several thousand million
// combinations nobody built. What makes any subset safe is that every edit
// checks what it expects before it writes: an offset's instruction, a
// run of instructions found once, a word found so many times, a record's
// fields. So what has to be held is that no fix leans on another having run
// (or not run) in a way its own expectations do not catch. Four things:
//
// 1. EVERY FIX ALONE on the shipped file applies, and the patch written
//    from it, merged back onto the shipped file, gives the patched file byte
//    for byte. The text with no option, with each option, and with each
//    spelling, likewise.
// 2. EVERY FIX TOGETHER, in both spellings, applies and merges back. The
//    American one is the combined build's set plus the three kept apart,
//    and its patched file is pinned (the count of resources and a hash,
//    expected values in check_all.mjs): a change to any fix moves it, and
//    the value moves in the same commit, as a decoder snapshot's does.
// 3. EVERY FIX LEFT OUT of all of them (--full, about a minute): the rest
//    still apply. With 1 and 2 this covers a fix that needs another before
//    it, or breaks when another is absent; it does not cover three-way
//    dependencies, which nothing found suggests exist. The suite runs 1, 2
//    and 4; --full was run when the fixes became choosable, and is to run
//    whenever a fix is added.
// 4. THE COMMUNITY'S LIST, DATA_FIX_COMMUNITY_TYPOS, against the collection
//    it was read out of, when the collection is here: the same pairs, in the
//    same order. The page cannot read the collection, so the list is written
//    into js/delv-datafixes.js by community_text_patch.mjs --write-js, and a
//    list edited by hand, or a collection since changed, fails here.
//
// NEGATIVE CONTROLS. A fix applied to a file it has already been applied to
// must refuse, naming the fix: one of each kind (an edit at an offset, a
// place found, a record, a text) is tried twice. And a copy of the list
// with one pair's fix changed must fail 4. A refusal that could not happen
// would pass a patch of the wrong file.
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {pageContext} from './patch_build.mjs';
import {readCollection} from './community_text_patch.mjs';

const FULL = process.argv.includes('--full');
const [htmlPath = 'index.html', dataPath, collDir] = process.argv.slice(2).filter(a => a !== '--full');
if (!dataPath) { console.error('usage: data_fix_check.mjs index.html <Cythera Data.data> [collection dir] [--full]'); process.exit(2); }
if (!existsSync(dataPath)) { console.log('SKIP: no data fork at ' + dataPath); process.exit(3); }

const {ctx, sandbox} = pageContext(htmlPath, dataPath);
let failed = 0;
const fail = m => { failed++; console.log('FAIL ' + m); };

// A build of the fixes named, inside the page: whether it applied, the
// patched file's resources changed, and whether the patch merges back.
sandbox.__build = null;
vm.runInContext(`__build = (ids) => {
  try {
    const done = applyDataFixes(__a, ids);
    const patched = writeDelverArchive(done.spec);
    const w = writeDelverPatch(done.spec, done.changed, { description: 'check', typeCode: DELV_PATCH_EXPORT_TYPE });
    const merged = mergeDelverPatch(__a, w.bytes);
    const same = !!(merged && merged.bytes && merged.bytes.length === patched.length && merged.bytes.every((x, i) => x === patched[i]));
    return { ok: true, changed: done.changed.length, same, patched };
  } catch (e) { return { ok: false, why: e.message }; }
}`, ctx);
const build = ids => sandbox.__build(ids);
const FIXES = JSON.parse(vm.runInContext('JSON.stringify(DATA_FIXES.map(f => ({ id: f.id, parent: f.parent || null, choice: f.choice || null, title: f.title })))', ctx));
const top = FIXES.filter(f => !f.parent);
const options = FIXES.filter(f => f.parent === 'text' && !f.choice).map(f => f.id);
const every = spelling => FIXES.filter(f => f.choice !== 'spelling' || f.id === 'spelling-' + spelling).map(f => f.id);
const t0 = Date.now();

// ---- 1. every fix alone ----------------------------------------------------
let alone = 0;
for (const f of top) {
  const r = build([f.id]);
  if (!r.ok) fail('alone: ' + f.id + ' did not apply: ' + r.why);
  else if (!r.same) fail('alone: ' + f.id + '’s patch does not merge back to the patched file');
  else if (!r.changed) fail('alone: ' + f.id + ' changed nothing');
  else alone++;
}
const textRuns = [['text'], ...options.map(o => ['text', o]), ['text', 'spelling-us'], ['text', 'spelling-uk'], ['text', 'spelling-us', ...options], ['text', 'spelling-uk', ...options]];
for (const ids of textRuns) {
  const r = build(ids);
  if (!r.ok) fail('text: ' + ids.join(' + ') + ' did not apply: ' + r.why);
  else if (!r.same) fail('text: ' + ids.join(' + ') + '’s patch does not merge back');
  else alone++;
}
// An option without its fix is nothing, and the first of two spellings wins.
{
  const chosen = ids => JSON.parse(vm.runInContext(`JSON.stringify([...dataFixesChosen(${JSON.stringify(ids)})])`, ctx));
  if (chosen(['text-land-king']).length) fail('an option chosen without the text counts');
  const both = chosen(['text', 'spelling-uk', 'spelling-us']);
  if (both.includes('spelling-us') === both.includes('spelling-uk')) fail('both spellings count, or neither');
}
console.log(`  alone: ${top.length} fixes and ${textRuns.length} runs of the text's options apply, each merging back to its patched file`);

// ---- 2. every fix together -------------------------------------------------
let pinned = null;
for (const sp of ['us', 'uk']) {
  const r = build(every(sp));
  if (!r.ok) { fail('every fix, ' + sp + ' spelling, did not apply: ' + r.why); continue; }
  if (!r.same) fail('every fix, ' + sp + ' spelling: the patch does not merge back');
  if (sp === 'us') pinned = { changed: r.changed, sha: createHash('sha256').update(Buffer.from(r.patched)).digest('hex').slice(0, 16) };
}
if (pinned) console.log(`  every fix: ${pinned.changed} resources changed, patched file ${pinned.sha}`);

// ---- 3. every fix left out -------------------------------------------------
if (FULL) {
  const all = every('us');
  let n = 0;
  for (const id of all) {
    const r = build(all.filter(x => x !== id));
    if (!r.ok) fail('without ' + id + ': ' + r.why); else n++;
  }
  console.log(`  each left out: ${n} of ${all.length} apply`);
}

// ---- the refusals ----------------------------------------------------------
{
  const twice = ids => vm.runInContext(`(() => {
    const once = writeDelverArchive(applyDataFixes(__a, ${JSON.stringify(ids)}).spec);
    try { applyDataFixes(once, ${JSON.stringify(ids)}); return null; } catch (e) { return e.message; }
  })()`, ctx);
  let refused = 0;
  for (const id of ['fetch', 'books-of-wisdom', 'panpipes', 'magpie-west', 'stronghold-door']) {
    const why = twice([id]);
    const f = FIXES.find(x => x.id === id);
    if (!why) fail('control: ' + id + ' applied twice without a word');
    else if (why.indexOf(f.title) !== 0) fail('control: ' + id + ' refused, but without naming the fix: ' + why);
    else refused++;
  }
  // The text's words, once fixed, are not there to fix again.
  const whyText = twice(['text']);
  if (!whyText) fail('control: the text applied twice without a word'); else refused++;
  console.log(`  refusals: ${refused} of 6 fixes applied to a file they had fixed already refuse, naming the fix`);
}

// ---- 4. the community's list against the collection ------------------------
if (collDir && existsSync(collDir)) {
  const read = readCollection(collDir);
  const baked = JSON.parse(vm.runInContext('JSON.stringify(DATA_FIX_COMMUNITY_TYPOS)', ctx));
  const same = (a, b) => a.length === b.length && a.every((t, i) => JSON.stringify(t) === JSON.stringify(b[i]));
  if (!same(read, baked)) fail('DATA_FIX_COMMUNITY_TYPOS is not what the collection holds: run community_text_patch.mjs --write-js');
  else console.log(`  community list: ${baked.length} pairs, as the collection has them`);
  // Control: one fix changed must be seen.
  const off = baked.map(t => t.slice()); off[0][2] += 'x';
  if (same(read, off)) fail('control: a changed pair passed the comparison');
} else console.log('  community list: the collection is not here, so it is not compared');

console.log(`  ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (failed) { console.log(`FAIL: ${failed}`); process.exit(1); }
console.log('OK');
