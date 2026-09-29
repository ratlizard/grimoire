#!/usr/bin/env node
/* A builder, not a check: the two faults in the scenario's maps that the
   board reported and this project confirmed, as one Magpie patch, "Cythera
   Map Fixes". (26 September 2026, the Citadel's at the maintainer's choice.)
   The fixes are the stage "map" of js/delv-datafixes.js, where each one's
   reasoning is, since 28 September 2026: the first Stronghold's kitchen door,
   and the passage under the Citadel.

   Usage: node utilities/map_fixes_patch.mjs index.html "<Cythera Data.data>" <out dir> */
import {buildFixes} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: map_fixes_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const ok = buildFixes({ htmlPath, dataPath, outDir, name: 'Cythera Map Fixes', stages: ['map'],
  description: 'Two fixes to Cythera’s maps, built with Grimoire: the first Stronghold’s kitchen door opens onto floor, and the secret passage under the Citadel can be stepped on from the shore.' });
process.exit(ok ? 0 : 1);
