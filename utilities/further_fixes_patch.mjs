#!/usr/bin/env node
/* A builder, not a check: the bugs the handoff held back until the
   maintainer said what was meant, as one Magpie patch, "Cythera Further
   Fixes". (27 September 2026, at the maintainer's word, for the patch he
   means to share.) The fixes are the stage "further" of
   js/delv-datafixes.js, where each one's reasoning is, since 28 September
   2026, and where it says why every place in this stage is found in the file
   rather than given. The karma for a kill is karma_patch.mjs, a patch of its
   own.

   Usage: node utilities/further_fixes_patch.mjs index.html "<Cythera Data.data>" <out dir> */
import {buildFixes} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: further_fixes_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
// A patch's description is a Pascal string, 255 bytes at most, and
// writeDelverPatch cuts a longer one there without a word: this one ran to
// 400 and the patch said it stopping at "Glaucus’s". buildFixes stops the
// build on a long one instead.
const ok = buildFixes({ htmlPath, dataPath, outDir, name: 'Cythera Further Fixes', stages: ['further'],
  description: 'Fixes whose intent the files or the maintainer settled, built with Grimoire: the Books of Wisdom, Timon, Halos, Thoas, Paris, Thuria, the Comana brothers, lines that run on, Demodocus, Glaucus, the Nexus scroll, traps, Magpie walking west, Divide Food.' });
process.exit(ok ? 0 : 1);
