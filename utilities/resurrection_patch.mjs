#!/usr/bin/env node
/* A builder, not a check: the Resurrection spell brings the person back
   where the corpse lay, with their sacks still packed, and a companion back
   into the party, as one Magpie patch of its own, "Cythera Resurrection
   Fix". (27 September 2026, at the maintainer's word: a separate patch,
   since where a raised person should stand is a design call the files do
   not make.)

   Usage: node utilities/resurrection_patch.mjs index.html "<Cythera Data.data>" <out dir>

   THE SHIPPED SPELL (0x1A2F's UseOn; the workbench's doc/bugs.md,
   *Resurrected characters vanish or reappear at home*, has the reading).
   On a corpse whose Data1 names a character it sets the alive bit, a
   quarter of full health plus one, gives the character every record inside
   the corpse at any depth with flags 16, and deletes the corpse. Death
   (TActiveMonster::Die) had taken them out of the party and hidden their
   map record (flags 255), and the spell undoes neither, so a raised person
   is nowhere until the next hour's schedule (ScheduleOne, RepositionChar)
   puts them back at their post. And since death put only what they held
   directly into the corpse, a sack went in with its contents inside it,
   and the walk to any depth brings the sack back empty and its contents
   loose.

   THE CHANGE, three parts, all in the spell's UseOn:
   1. The corpse is walked one level (ContainerIterator for
      RecursiveContainerIterator), so a sack comes back with what is in it.
   2. The person's map record, the prop of their own number, is put on the
      corpse's square with flags 66, and their character record's square set
      to match. 66 is the state RepositionChar leaves a character in when it
      puts them at a post nobody is watching: the draw loop
      (TGameViewer::DrawRoutine) hands any character below 256 whose record
      is 66 and near the party straight to TActiveMonster::HatchEgg, which
      makes their creature there. Setting a record's square or flags resets
      the neighbourhood (THood::ForceReset), so it is found on the next
      draw. The corpse's square is read with `x` and `y`, which for a thing
      inside another give its holder's square, so a corpse carried in a
      pack raises its person beside whoever carries it.
   3. A person who can join the party -- the six JoinParty is ever called
      for: Hector 6, Meleager 34, Ariadne 53, Timon 74, Aethon 97, Dryas 98
      -- and whose behaviour when they died was a party one, 1 to 13, is put
      back in it with JoinParty, whose RebuildParty hatches them at once.
      Death does not touch the behaviour byte (neither Die nor
      CharEntry::DeathRites writes it), and with no creature on the map the
      `behavior` field reads it straight from the record. The party writes 1
      (following) and 2 (leading) when it rebuilds, the Attack-target and
      Regroup commands 13, 1 and 2, and the combat AI's tasks others below
      14; leaving the party writes 143, being told to wait 112, and the
      schedules use 0, 12, 15, 16 and 134 to 150. So a companion dismissed or
      told to wait before they died is not taken back in, and one killed in
      the party is. The one overlap: Dryas has a post at behaviour 12, so
      Dryas killed while standing at it would rejoin. JoinParty refuses a
      ninth member; then the person stands where the corpse lay, out of the
      party, until the hour takes them home.

   Not changed: the Land King Amulet used on a corpse (0x10F4), which runs
   the same code, and the hero's own return to Land King Hall when the
   amulet is worn at death (0x1801), both left as shipped at the
   maintainer's word. The spell's resource is in no stage of
   combined_patch.mjs and in neither the karma patch nor Sour Grapes, so
   this installs beside "Cythera All Fixes". Not played. */
import {buildPatch} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: resurrection_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }

// Hector, Meleager, Ariadne, Timon, Aethon, Dryas.
const JOINERS = [0x06, 0x22, 0x35, 0x4A, 0x61, 0x62];
const isJoiner = JOINERS.map((c, k) => ['arg Arg01', 'get_field data1 (0x6)', 'byte 0x' + c.toString(16).toUpperCase().padStart(2, '0'), 'eq'].concat(k ? ['or'] : [])).flat();
const setField = (field, target, value) => ['set_field ' + field, target, 'end'].concat(value, ['end']);

const edits = [{
  what: 'the raised stand where the corpse lay, sacks packed, companions back in the party',
  resid: 0x1A2F, at: 0x0112, to: 0x014B,
  expect: { 0x0112: 'set_local 0x01', 0x0114: 'sys RecursiveContainerIterator', 0x011C: 'arg Arg01',
            0x012C: 'set_field container', 0x0132: 'set_field flags', 0x0136: 'byte 0x10',
            0x0145: 'branch', 0x0148: 'sys Delete', 0x0149: 'arg Arg01', 0x014B: 'branch' },
  code: [
    // 1: one level of the corpse.
    'set_local 0x01', 'sys ContainerIterator', 'word &Var1', 'byte 0x00', 'arg Arg01', 'end', 'end',
    'next:',
    'if', 'sys ContainerIterator', 'word &Var1', 'byte 0x01', 'end', 'then -> packed',
    ...setField('container (0xB)', 'local Var01', ['local Var00']),
    ...setField('flags (0x0)', 'local Var01', ['byte 0x10']),
    'set_local 0x01', 'sys ContainerIterator', 'word &Var1', 'byte 0x02', 'end', 'end',
    'branch next',
    'packed:',
    // 2: the map record on the corpse's square, waiting to be drawn.
    'set_local 0x04', 'local Var00', 'cast Prop (0x0)', 'end',
    ...setField('x (0x1)', 'local Var04', ['arg Arg01', 'get_field x (0x1)']),
    ...setField('y (0x2)', 'local Var04', ['arg Arg01', 'get_field y (0x2)']),
    ...setField('flags (0x0)', 'local Var04', ['byte 0x42']),
    ...setField('x (0x1)', 'local Var00', ['arg Arg01', 'get_field x (0x1)']),
    ...setField('y (0x2)', 'local Var00', ['arg Arg01', 'get_field y (0x2)']),
    // 3: a companion who died in the party rejoins it.
    'if_not', ...isJoiner,
    'local Var00', 'get_field behavior (0x15)', 'byte 0x01', 'ge', 'and',
    'local Var00', 'get_field behavior (0x15)', 'byte 0x0D', 'le', 'and',
    'then -> gone',
    'sys JoinParty', 'local Var00', 'end',
    'gone:',
    'sys Delete', 'arg Arg01', 'end',
  ].join('\n'),
}];

// The map record wants a fifth local; a function's locals are the third
// byte of its header, and UseOn's header is at 0xA0.
const dataEdits = [{ what: 'UseOn has a fifth local', resid: 0x1A2F, fn: (b) => {
  if (b[0xA2] !== 4) throw new Error('UseOn has ' + b[0xA2] + ' locals, not 4');
  b[0xA2] = 5; return 'locals 4 to 5';
} }];

const DESCRIPTION = 'Resurrection brings the person back where the corpse lay, with their bags still packed, and a companion who died in the party back into it, built with Grimoire. The Land King Amulet is unchanged.';
if (DESCRIPTION.length > 255) throw new Error('the description is ' + DESCRIPTION.length + ' characters, and a patch holds 255');
const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Resurrection Fix', description: DESCRIPTION, edits, dataEdits });
process.exit(ok ? 0 : 1);
