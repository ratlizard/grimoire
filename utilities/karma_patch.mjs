#!/usr/bin/env node
/* A builder, not a check: killing a townsperson costs karma, as one Magpie
   patch of its own, "Cythera Karma Fix". (27 September 2026, at the
   maintainer's word: a separate patch rather than a stage of the combined
   build, since what a kill should be worth is a design call and not a slip
   anyone can point to.) The fix is `karma` in js/delv-datafixes.js, where
   its reasoning is, since 28 September 2026. It touches the kill helper
   alone, which no stage of combined_patch.mjs changes, so it can be
   installed beside "Cythera All Fixes".

   Usage: node utilities/karma_patch.mjs index.html "<Cythera Data.data>" <out dir> */
import {buildFixes} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: karma_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const ok = buildFixes({ htmlPath, dataPath, outDir, name: 'Cythera Karma Fix', ids: ['karma'],
  description: 'Killing a townsperson costs one karma instead of adding one, built with Grimoire. Animals and spirits, evil and feral creatures are unchanged.' });
process.exit(ok ? 0 : 1);
