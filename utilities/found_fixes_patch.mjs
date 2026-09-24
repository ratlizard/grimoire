#!/usr/bin/env node
/* A builder, not a check: the bugs this project found in the scripts and
   tables itself, whose cause and intended behaviour are both clear, as one
   Magpie patch. (24 September 2026, at the maintainer's word.) The causes
   are in the workbench's doc/bugs.md; the misspellings found the same day
   are a patch of their own, after review, and the flags tested and never
   set wait on a decision about what was meant.

   Usage: node utilities/found_fixes_patch.mjs index.html "<Cythera Data.data>" <out dir>

   1. Ake's To Do line (0x1820): her Comana errand added line 114, "Ask
      Thuria about Iron Mine"; it adds 113, "Ask Halos about Comana", the
      line Propontis adds for the same errand.
   2. Sleep's magic bonus (0xE93): the guard and the cap both read full
      health where full magic is meant; both now read full magic.
   3. The bartenders' rumours (0x813): the choice between the town's own
      rumours and the general ones rolled Random(0, 1), which is always 0;
      it rolls Random(0, 2), so both are heard.
   4. Eating (0xE46): the nutrition's jitter, Random(0, 1) - Random(0, 1),
      was always 0; it rolls Random(0, 2) twice, so it is -1, 0 or 1.
   5. The Gate Guard's speaker (0x1864): one reply was given to character
      54, the Odemia Guard; it is given to himself. The two share a
      portrait, so nothing changes on screen, but the number is right.
   6. Keywords typed with a space (0x186D, 0x1878): Demodocus's "fish, tlep"
      and Sabinate's "form, shap" lose the space after the comma. */
import {buildPatch} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: found_fixes_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }

const keyword = (what, resid, at, kw, target) => ({ what, resid, at, replaceOp: true,
  expect: { [at]: 'conversation_response' }, code: `conversation_response "${kw}" -> ${target}` });
const edits = [
  { what: 'Ake’s To Do line', resid: 0x1820, at: 0x0109, replaceOp: true, expect: { 0x0101: 'sys AddQuest', 0x0102: 'byte 0x0A', 0x0109: 'byte 0x72' }, code: 'byte 0x71' },
  { what: 'sleep’s magic cap', resid: 0xE93, at: 0x0248, replaceOp: true, expect: { 0x0248: 'get_field full_health', 0x024E: 'set_field magic' }, code: 'get_field full_magic (0x1F)' },
  { what: 'sleep’s magic guard', resid: 0xE93, at: 0x0219, replaceOp: true, expect: { 0x0216: 'get_field magic', 0x0219: 'get_field full_health', 0x021B: 'lt' }, code: 'get_field full_magic (0x1F)' },
  { what: 'the bartenders’ rumours', resid: 0x813, at: 0x02AB, replaceOp: true, expect: { 0x02A8: 'sys Random', 0x02A9: 'byte 0x00', 0x02AB: 'byte 0x01' }, code: 'byte 0x02' },
  { what: 'eating, second roll', resid: 0xE46, at: 0x0040, replaceOp: true, expect: { 0x003D: 'sys Random', 0x0040: 'byte 0x01' }, code: 'byte 0x02' },
  { what: 'eating, first roll', resid: 0xE46, at: 0x0039, replaceOp: true, expect: { 0x0036: 'sys Random', 0x0039: 'byte 0x01' }, code: 'byte 0x02' },
  { what: 'the Gate Guard speaks', resid: 0x1864, at: 0x058D, replaceOp: true, expect: { 0x058C: 'sys TalkParticipant', 0x058D: 'short 0x0036', 0x0590: 'byte 0x00' }, code: 'arg Arg00' },
  keyword('Demodocus’s "tlep"', 0x186D, 0x155F, 'fish,tlep', '0x15E0'),
  keyword('Sabinate’s "shap"', 0x1878, 0x0975, 'form,shap', '0x0A11'),
];
const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Found Fixes',
  description: 'Nine fixes for bugs found by reading Cythera’s files with Grimoire: Ake’s To Do line, sleep’s magic bonus, the bartenders’ rumours, eating, the Gate Guard’s speaker, two keywords.',
  edits, dataEdits: [] });
process.exit(ok ? 0 : 1);
