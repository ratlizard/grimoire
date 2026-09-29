#!/usr/bin/env node
/* A builder, not a check: the Resurrection spell brings the person back
   where the corpse lay, with their sacks still packed, and a companion back
   into the party, as one Magpie patch of its own, "Cythera Resurrection
   Fix". (27 September 2026, at the maintainer's word: a separate patch,
   since where a raised person should stand is a design call the files do
   not make.) The fix is `resurrection` in js/delv-datafixes.js, where its
   reasoning is, since 28 September 2026. The spell's resource is in no stage
   of combined_patch.mjs and in neither the karma patch nor Sour Grapes, so
   this installs beside "Cythera All Fixes". Not played.

   Usage: node utilities/resurrection_patch.mjs index.html "<Cythera Data.data>" <out dir> */
import {buildFixes} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: resurrection_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const DESCRIPTION = 'Resurrection brings the person back where the corpse lay, with their bags still packed, and a companion who died in the party back into it, built with Grimoire. The Land King Amulet is unchanged.';
const ok = buildFixes({ htmlPath, dataPath, outDir, name: 'Cythera Resurrection Fix', ids: ['resurrection'], description: DESCRIPTION });
process.exit(ok ? 0 : 1);
