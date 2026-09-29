#!/usr/bin/env node
/* A builder, not a check: Peirithous, Judge Sacas's majordomo, alive, as one
   Magpie patch of its own, "Cythera Peirithous Fix". (28 September 2026, at
   the maintainer's word: a separate patch, since it puts a person into the
   game that no release has shown.) The fix is `peirithous` in
   js/delv-datafixes.js, where its reasoning is. It touches 0xF009 alone,
   which no stage of combined_patch.mjs changes, so it installs beside
   "Cythera All Fixes".

   Usage: node utilities/peirithous_patch.mjs index.html "<Cythera Data.data>" <out dir> */
import {buildFixes} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: peirithous_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const ok = buildFixes({ htmlPath, dataPath, outDir, name: 'Cythera Peirithous Fix', ids: ['peirithous'],
  description: 'Peirithous, Judge Sacas’s majordomo in Odemia, starts the game alive and keeps his daily round, built with Grimoire. The shipped scenario has him dead from the start. New games only.' });
process.exit(ok ? 0 : 1);
