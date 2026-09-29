#!/usr/bin/env node
/* A builder, not a check: the six fixes of Bryce Schroeder's unofficial
   bugfix patch, rebuilt with the page's own code writer, as one Magpie patch,
   "Cythera Bugfix Patch". (24 September 2026, at the maintainer's word.) The
   fixes are the stage "bugfix" of js/delv-datafixes.js, where each one's
   reasoning is, since 28 September 2026: Fetch, fishing, Aethon's lock
   picking and Ask About, Darius and Sardis's chair, Paris's and Diomede's
   names.

   Usage: node utilities/bugfix_patch.mjs index.html "<Cythera Data.data>" <out dir>

   Writes "Cythera Bugfix Patch" (the bare patch) and "Cythera Bugfix
   Patch.bin" (the same in a MacBinary typed DelP/Delp, as the page's export
   makes it), plus the patched "Cythera Data.data" beside them for the fork.
   What it writes is the game's data changed and belongs in no repository,
   the same as ramp_patch.mjs's. */
import {buildFixes} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: bugfix_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const ok = buildFixes({ htmlPath, dataPath, outDir, name: 'Cythera Bugfix Patch', stages: ['bugfix'],
  description: 'Bryce Schroeder\u2019s unofficial bugfixes, rebuilt with Grimoire: Fetch, fishing, Aethon\u2019s lock picking and Ask About, Darius and Sardis\u2019s chair, Paris and Diomede\u2019s names.' });
process.exit(ok ? 0 : 1);
