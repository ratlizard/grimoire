#!/usr/bin/env node
/* A builder, not a check: "Cythera Community Fixes", the bugs the
   community reported that Bryce Schroeder's patch does not touch, whose
   cause and intended behaviour are both clear from the files, as one Magpie
   patch. (24 September 2026, at the maintainer's word; more on the 27th and
   28th.) The fixes are the stage "community" of js/delv-datafixes.js, where
   each one's reasoning is, since 28 September 2026.

   Usage: node utilities/community_fixes_patch.mjs index.html "<Cythera Data.data>" <out dir> */
import {buildFixes} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: community_fixes_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const ok = buildFixes({ htmlPath, dataPath, outDir, name: 'Cythera Community Fixes', stages: ['community'],
  description: '26 fixes for reported bugs: training, Hadrian, Aethon, Alaric, Awakening, Niobe, Lindus, keywords, Sabinate, rolling pin, wine urn, carcass, throwing, Eteocles, Pelagon, panpipes, kesh, arrows, kilts, staff, strange device, corpses, sleep, runes, sign.' });
process.exit(ok ? 0 : 1);
