#!/usr/bin/env node
/* A builder, not a check: the misspellings and slips in Cythera's text that
   the pass of 24 September 2026 found beyond the community's proofreading
   (workbench doc/bugs.md, *The text: misspellings, slips and facts that
   disagree*), as one Magpie patch, "Cythera Text Fixes", after the
   maintainer's review of the list. The list is DATA_FIX_TEXT in
   js/delv-datafixes.js since 28 September 2026, where each entry's reasoning
   is, and this writes the stages "text" and "spelling" with every option of
   the text's chosen: "Two-Taled", "Land King", "Areithous" and the hyphens,
   which the Patches section offers apart.

   Usage: node utilities/text_fixes_patch.mjs [--uk] index.html "<Cythera Data.data>" <out dir>

   --uk writes "Cythera Text Fixes (UK English)", the same fixes with the
   game's American spellings made British throughout (24 September 2026, at
   the maintainer's word); otherwise the British forms go American as the
   Hintbook has them.

   What is deliberately NOT here: the community's own dialogue typos (a patch
   of their own, community_text_patch.mjs), and "Beserk" and "celstial" and
   the rest of the application's strings (a Magpie patch cannot reach them).

   textFixEdits() is the list itself, for the builders that write the text
   fixes with something of their own after them (hall_lines.mjs's casts, the
   Strine opening). */
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {buildFixes, everyFix, pageContext} from './patch_build.mjs';

export const T = (what, resid, find, replace, count) => ({ what, resid, find, replace, ...(count !== undefined ? { count } : {}) });
// The text stage's edits with every option chosen, and the spelling named.
export function textFixEdits({ uk = false, htmlPath = 'index.html' } = {}) {
  const {ctx} = pageContext(htmlPath);
  const ids = everyFix(htmlPath, uk ? 'uk' : 'us');
  return JSON.parse(vm.runInContext(`JSON.stringify((() => { const c = dataFixesChosen(${JSON.stringify(ids)}); return dataFixTextEdits(c).concat(dataFixSpellingEdits(c)); })())`, ctx));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const uk = process.argv.includes('--uk');
  const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2).filter(a => a !== '--uk');
  if (!dataPath || !outDir) { console.error('usage: text_fixes_patch.mjs [--uk] index.html <Cythera Data.data> <out dir>'); process.exit(2); }
  const ok = buildFixes({ htmlPath, dataPath, outDir, name: uk ? 'Cythera Text Fixes (UK English)' : 'Cythera Text Fixes',
    description: 'Misspellings and typos in Cythera’s text, found with Grimoire and reviewed by the maintainer: dialogue, spells, training, books, To Do lines, signs, notes, opening and endings, Where Is answers, tab bytes' + (uk ? '; spelling made British throughout.' : '.'),
    ids: everyFix(htmlPath, uk ? 'uk' : 'us'), stages: ['text', 'spelling'] });
  process.exit(ok ? 0 : 1);
}
