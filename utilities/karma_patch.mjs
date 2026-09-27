#!/usr/bin/env node
/* A builder, not a check: killing a townsperson costs karma, as one Magpie
   patch of its own, "Cythera Karma Fix". (27 September 2026, at the
   maintainer's word: a separate patch rather than a stage of the combined
   build, since what a kill should be worth is a design call and not a slip
   anyone can point to.)

   Usage: node utilities/karma_patch.mjs index.html "<Cythera Data.data>" <out dir>

   THE SHIPPED RULE. The kill helper (0xE8D) adds [+1, +4, -10, 0] to karma,
   indexed by the victim's alignment (neutral 0, evil 1, good 2, feral 3, the
   combat AI's own names for them, STR# 9301), when the hero lands the blow.
   Every one of the game's named people but the hero, Aeneas and Eudoxus is
   neutral, so killing a townsperson raised karma by one (doc/bugs.md,
   *Killing NPCs raises karma*).

   THE CHANGE. A neutral victim costs one karma instead, unless it is an
   animal or a spirit: the bird (89), the goat (90), the chicken (228), the
   ghost (289), the fire spirit (290) and the sylph (292), the six neutral
   units in 0xF008 that are not people, which keep the shipped +1. One is
   the size of the game's one other karma loss for a deed, "Your deeds stain
   your soul" in the hero's script. Evil, good and feral are unchanged.

   WHY BY TYPE AND NOT BY NUMBER. The first idea was the named characters
   only, the character records below 256 (a created creature takes one from
   256 up). The script cannot ask that: the victim arrives as a reference,
   a class tag in the top bits over the number, and the interpreter's
   bitwise_and (TInterp::DoExpr's case for 0x56) masks two plain numbers
   only, taking another path for a tagged word. The victim's type it can
   read, as the helper already reads its square. So a hatched guard costs
   karma too, being a person, and a hatched chicken does not.

   Touches the kill helper alone, which no stage of combined_patch.mjs
   changes, so it can be installed beside "Cythera All Fixes". */
import {buildPatch} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: karma_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }

const NOT_PEOPLE = ['byte 0x59', 'byte 0x5A', 'short 0x00E4', 'short 0x0121', 'short 0x0122', 'short 0x0124'];
const edits = [{
  what: 'a neutral person killed costs karma', resid: 0xE8D, at: 0x00C9, to: 0x00D4,
  expect: { 0x00A5: 'if_not', 0x00A6: 'global CurrentCharacter', 0x00A8: 'word Character.Hero', 0x00B1: 'set_local 0x05',
            0x00C9: 'set_global Karma', 0x00CB: 'global Karma', 0x00CD: 'local Var05', 0x00CE: 'local Var00',
            0x00CF: 'get_field alignment', 0x00D1: 'index', 0x00D2: 'add', 0x00D3: 'end', 0x00D4: 'return' },
  code: ['if_not', 'local Var00', 'get_field alignment (0x35)', 'byte 0x00', 'eq']
    .concat(NOT_PEOPLE.map(t => ['arg Arg00', 'get_field obj_type (0x4)', t, 'ne', 'and']).flat(), [
    'then -> table',
    'set_global Karma (0xC)', 'global Karma (0xC)', 'byte 0x01', 'sub', 'end',
    'branch done',
    'table:',
    'set_global Karma (0xC)', 'global Karma (0xC)', 'local Var05', 'local Var00', 'get_field alignment (0x35)', 'index', 'add', 'end',
    'done:']).join('\n'),
}];
const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Karma Fix',
  description: 'Killing a townsperson costs one karma instead of adding one, built with Grimoire. Animals and spirits, evil and feral creatures are unchanged.',
  edits });
process.exit(ok ? 0 : 1);
