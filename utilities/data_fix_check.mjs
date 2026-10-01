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
// 5. THE PLACES THE TEXT'S LIST LINKS TO (29 September 2026): with each
//    spelling and every option, every place dataFixTextChanges gives a row
//    must hold the row's words in the shipped file, which is what the link
//    opens. A place the text changed twice (a British stem inside a word a
//    fix put there) is counted and named, and must be one this says why.
// 6. (Ye olde spelling leaving what is typed, until 1 October 2026, when the
//    option was taken off the page.)
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
vm.runInContext(`__build = (ids, skip) => {
  try {
    const done = applyDataFixes(__a, ids, { skip: new Set(skip || []) });
    const patched = writeDelverArchive(done.spec);
    const w = writeDelverPatch(done.spec, done.changed, { description: 'check', typeCode: DELV_PATCH_EXPORT_TYPE });
    const merged = mergeDelverPatch(__a, w.bytes);
    const same = !!(merged && merged.bytes && merged.bytes.length === patched.length && merged.bytes.every((x, i) => x === patched[i]));
    return { ok: true, changed: done.changed.length, same, patched };
  } catch (e) { return { ok: false, why: e.message }; }
}`, ctx);
const build = (ids, skip) => sandbox.__build(ids, skip);
const FIXES = JSON.parse(vm.runInContext('JSON.stringify(DATA_FIXES.map(f => ({ id: f.id, parent: f.parent || null, choice: f.choice || null, title: f.title })))', ctx));
const top = FIXES.filter(f => !f.parent);
// The text's options: since 1 October 2026 every one is half of a choice
// (the spelling, and four that go one way or the other). `options` is the
// first of each pair but the spelling, the way they went before; `others`
// the second.
const pairs = {};
for (const f of FIXES) if (f.parent === 'text' && f.choice && f.choice !== 'spelling') (pairs[f.choice] = pairs[f.choice] || []).push(f.id);
const options = Object.values(pairs).map(p => p[0]), others = Object.values(pairs).map(p => p[1]);
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
const SPELLINGS = FIXES.filter(f => f.choice === 'spelling').map(f => f.id);
const textRuns = [['text'], ...options.concat(others).map(o => ['text', o]), ...SPELLINGS.map(sp => ['text', sp]), ...SPELLINGS.map(sp => ['text', sp, ...options]), ...SPELLINGS.map(sp => ['text', sp, ...others])];
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
for (const sp of SPELLINGS.map(id => id.replace('spelling-', ''))) {
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

// ---- 5. the places the text's list links to --------------------------------
{
  const r = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const arc = openDelverArchive(__a), shipped = {};
    const bytes = id => shipped[id] || (shipped[id] = smartDecrypt(getResourceBytes(arc, id), id).data);
    const out = [];
    for (const sp of [null].concat(${JSON.stringify(SPELLINGS)})) for (const opts of [${JSON.stringify(options)}, ${JSON.stringify(others)}]) {
      const rows = dataFixTextChanges(__a, (sp ? [sp] : []).concat(opts));
      let places = 0, unmapped = 0, touched = 0; const off = [];
      for (const row of rows) for (const loc of row.at) {
        places++;
        if (loc.at === null) { unmapped++; continue; }
        const b = bytes(loc.resid);
        let ok = true; for (let k = 0; k < row.find.length; k++) if (b[loc.at + k] !== row.find.charCodeAt(k)) { ok = false; break; }
        // A place inside words an earlier edit wrote holds what that edit
        // replaced, and says so; any other place must hold its own words.
        if (loc.touched) { touched++; continue; }
        if (!ok) { let was = ''; for (let k = 0; k < row.find.length + 6; k++) was += String.fromCharCode(b[loc.at + k] || 32); off.push(row.part + ' "' + row.find + '" at 0x' + loc.resid.toString(16) + '+' + loc.at.toString(16) + ' reads "' + was + '"'); }
      }
      out.push({ sp, rows: rows.length, places, unmapped, touched, off });
    }
    return out;
  })())`, ctx));
  for (const x of r) {
    if (x.unmapped) fail('text list, ' + (x.sp || 'as shipped') + ': ' + x.unmapped + ' places with no offset');
    if (x.off.length) fail('text list, ' + (x.sp || 'as shipped') + ': ' + x.off.length + ' places do not hold their words: ' + x.off.slice(0, 4).join('; '));
  }
  console.log('  text list: ' + r.map(x => (x.sp || 'as shipped') + ' ' + x.rows + ' rows, ' + x.places + ' places (' + x.touched + ' inside words a fix wrote)').join('; ') + '; every other place holds its words in the shipped file');
}

// ---- 7. a row of the text's changes left out ------------------------------
{
  const r = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const has = (done, id, t) => { const d = done.spec.resources.find(x => x.resid === id).data; let s = ''; for (let i = 0; i < d.length; i++) s += String.fromCharCode(d[i]); return s.indexOf(t) >= 0; };
    const ids = ['text', 'text-hyphens'];
    const rows = dataFixTextChanges(__a, ['text-hyphens']);
    const kind = rows.find(x => x.find === 'kind looking'), wearly = rows.find(x => x.find === 'wearly looking');
    const all = applyDataFixes(__a, ids);
    const less = applyDataFixes(__a, ids, { skip: new Set([kind.key]) });
    // Leaving out "wearly" leaves the hyphen nothing to find in Helen's line.
    const dep = applyDataFixes(__a, ids, { skip: new Set([wearly.key]) });
    return { control: has(all, 0x184C, 'kind looking'), kept: has(less, 0x184C, 'kind looking'), other: has(less, 0x184C, 'kind-looking') || has(less, 0x1830, 'dour-faced'),
             wearly: has(dep, 0x1858, 'wearly looking'), weary: has(dep, 0x1858, 'weary-looking') };
  })())`, ctx));
  if (r.control) fail('control: "kind looking" is still there with nothing left out');
  else if (!r.kept) fail('a row left out was made anyway: "kind looking" is hyphenated');
  else if (!r.other) fail('leaving out one row left out the others');
  else if (!r.wearly || r.weary) fail('with "wearly" left out, Helen\u2019s line was changed after all');
  else console.log('  rows left out: "kind looking" left as the game has it and the other hyphens made; "wearly" left out takes the hyphen after it along, and the build goes on');
}

// ---- 6. (ye olde spelling leaving what is typed; the option was taken off
// the page on 1 October 2026, and its check with it) ---------------------------

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
