#!/usr/bin/env node
/* A builder, not a check: Peirithous, Judge Sacas's majordomo, alive, as one
   Magpie patch of its own, "Cythera Peirithous Fix". (28 September 2026, at
   the maintainer's word: a separate patch, since it puts a person into the
   game that no release has shown.)

   Usage: node utilities/peirithous_patch.mjs index.html "<Cythera Data.data>" <out dir>

   THE SHIPPED STATE. Character 96 is Peirithous: a record in Odemia with a
   man's look, stats and his bed for a square, a full day in the schedules
   (0xF00B: up at seven, about the house and town, in bed at nine), his own
   conversation (0x1860, "I am the majordomo of Judge Sacas."), a line in
   Sacas's (0x1846), a portrait (0x885F), and the hintbook's "Peirithous,
   servant" in Odemia. His Alive bit is clear: bit 0 of the record's status
   word, byte 7 (the character record's bytes 6 and 7 are field 20,
   status_flags, whose bit 0 is Alive). ScheduleTime schedules the living
   only, so he is never placed, and in a save his map record lies empty at
   (0,0) of whatever zone the party is in, which is the body the board calls
   "Nothing" (the workbench's doc/bugs.md, the "Nothing" entry: a Look there
   in the fork opened a window named Nothing wearing his portrait). Of the
   scenario's placed characters only he and the empty character 0 start
   without the bit; the unused slots have it set. Every release from 1.0.1 is
   the same.

   THE CHANGE. The one bit, set. A saved game carries its own character
   table, so this reaches new games only.

   Touches 0xF009 alone, which no stage of combined_patch.mjs changes, so it
   installs beside "Cythera All Fixes". */
import {buildPatch} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: peirithous_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }

const dataEdits = [
  { what: 'Peirithous alive', resid: 0xF009, fn: (b) => {
      const p = 96 * 32;
      // Zone 2 (Odemia), a man (prop type 82) at aspect 9, the status word 0.
      const zone = b[p], look = (b[p + 4] << 8) | b[p + 5];
      if (zone !== 2 || (look & 0x3FF) !== 82 || (look >> 10) !== 9 || b[p + 6] !== 0 || b[p + 7] !== 0)
        throw new Error('record 96 is not the dead Peirithous in Odemia this was written against');
      b[p + 7] |= 1;
      return 'record 96, byte 7: the Alive bit set';
  } },
];
const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Peirithous Fix',
  description: 'Peirithous, Judge Sacas’s majordomo in Odemia, starts the game alive and keeps his daily round, built with Grimoire. The shipped scenario has him dead from the start. New games only.',
  dataEdits });
process.exit(ok ? 0 : 1);
