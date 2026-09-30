#!/usr/bin/env node
/* A builder, not a check: the Resurrection spell brings the person back
   where the corpse lay, with their sacks still packed, and a companion back
   into the party, as one Magpie patch of its own, "Cythera Resurrection
   Fix". (27 September 2026, at the maintainer's word: a separate patch,
   since where a raised person should stand is a design call the files do
   not make.) The fix is `resurrection` in js/delv-datafixes.js, where its
   reasoning is, since 28 September 2026. It carries `nobody-corpse` too (30
   September 2026, the maintainer's word: the guard in both), so a corpse
   that names nobody is left alone here as in "Cythera All Fixes". All
   Fixes changes the spell and the amulet now as well, and a Magpie patch
   carries whole resources, so as two patches the later installed wins
   both: this one after All Fixes keeps the resurrection and loses what All
   Fixes' text stages changed in those two scripts, and All Fixes after
   this one takes the resurrection away. Chosen together in the Patches
   section they apply to one file, since the resurrection fix finds its
   place after the guard. Not played.

   Usage: node utilities/resurrection_patch.mjs index.html "<Cythera Data.data>" <out dir> */
import {buildFixes} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: resurrection_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const DESCRIPTION = 'Resurrection brings the person back where the corpse lay, with their bags still packed, and a companion who died in the party back into it, built with Grimoire. A corpse of nobody is left alone.';
const ok = buildFixes({ htmlPath, dataPath, outDir, name: 'Cythera Resurrection Fix', ids: ['nobody-corpse', 'resurrection'], description: DESCRIPTION });
process.exit(ok ? 0 : 1);
