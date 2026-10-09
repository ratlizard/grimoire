#!/usr/bin/env node
/* A builder, not a check: "Cythera Found Fixes", the bugs this project
   found in the scripts and tables itself, whose cause and intended behaviour
   are both clear, as one Magpie patch. (24 September 2026, at the
   maintainer's word.) The fixes are the stage "found" of
   js/delv-datafixes.js, where each one's reasoning is, since 28 September
   2026: Ake's To Do line, sleep's magic bonus, the bartenders' rumours,
   the Gate Guard's speaker, Demodocus's and Sabinate's keywords,
   water into a full pitcher, and a pitcher dipped in the wine urn.

   Usage: node utilities/found_fixes_patch.mjs index.html "<Cythera Data.data>" <out dir> */
import {buildFixes} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: found_fixes_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const ok = buildFixes({ htmlPath, dataPath, outDir, name: 'Cythera Found Fixes', stages: ['found'],
  description: 'Ten fixes for bugs found by reading Cythera’s files with Grimoire: Ake’s To Do line, sleep’s magic bonus, the bartenders’ rumours, the Gate Guard’s speaker, two keywords, water into a full pitcher, a pitcher dipped in wine.' });
process.exit(ok ? 0 : 1);
