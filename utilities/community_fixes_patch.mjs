#!/usr/bin/env node
/* A builder, not a check: the bugs the community reported that Bryce
   Schroeder's patch does not touch, whose cause and intended behaviour are
   both clear from the files, as one Magpie patch. (24 September 2026, at
   the maintainer's word.) The causes are in the workbench's doc/bugs.md
   under the entry named for each; the bugs the handoff lists as needing a
   decision first are left out.

   Usage: node utilities/community_fixes_patch.mjs index.html "<Cythera Data.data>" <out dir>

   Each edit is written in the raw listing's own words and checked against
   the instructions it expects before it is put in (patch_build.mjs).

   Scripts:
    1. Sword, Axe and Mace training (0xE87). The melee resolver adds the
       weapon's skill twice, and both reads take the skill off the shield
       loop's leftover variable; each now reads it off the weapon (Arg02).
    2. Hadrian asks after Hector (0x1804): his "son" topic tested his own
       alive bit; it tests Hector's. And "Indeed I am." was drawn as the
       hero's: the string is split and Hadrian named between the halves.
    3. Aethon told to leave (0x1861): "Maybe it is time for me to catch some
       rats for myself..." is followed by LeaveParty, as Hector's is.
    4. Alaric forgets 201 (0x1802): the "hist" topic's test of his flag 2
       was the wrong way round; a `not` turns it.
    5. Awakening's blank conversation (0x1A13): the sleeper and the hero
       are named as speakers before the sleeper's Talk, as the game's own
       Talk command names them.
    6. Niobe's answers drawn as Helen's (0x1859): Niobe is named again
       after Helen's interruption.
    7. Lindus nags for ever (0x1850): the training route that hands over
       the grimoire now sets quest flag 1 and strikes the To Do line, as
       accepting at the first meeting does.
    8. Keywords typed with a space (0x1828, 0x1829, 0x182A, 0x1818, 0x080F):
       "inn, pari" and its kind lose the space after the comma.
    9. Sabinate's mushroom every time (0x1878): his flag 4 is set when the
       mushroom is given.
   10. The rolling pin vanishing (0x10A3): the dough is deleted, not the pin.
   11. The wine urn's empty pitcher (0xE0D): the pitcher's Data1 is set to
       3, as the water helper sets 1 and the milk helper 2. The pitcher
       (0x10A0) reads 0 to 3 as empty, water, milk and wine, in its Examine
       and Use tables and in its UseOn, which pours wine through this
       helper only at 3. This edit set 1 until 27 September 2026, which
       filled the pitcher with water.
   12. "You can't stuff the carcass!" on every check (0x10D2): the refusal
       no longer prints.
   13. A thrown weapon lost on a hit (0x3042): flags 0x10 with an inventory
       square and PutInside, as Bryce's Fetch fix places a thing, in place
       of flags 9. The least certain edit here: it follows Fetch's pattern
       and was not tried in play.
   14. Eteocles's "kesh" (0x1838): the test reads quest flag 4 (Guild
       membership), as his other five tests do, not quest value 4.
   Data:
   15. Pelagon back in the kesh lab (0xF00B): his schedule's flag-0 pair
       (off every map) is moved in front of its quest-value pair.
   16. Only Philinus's panpipes work (0x8108): the two placed sets get
       Data1 1, the set that can play PHJMD.
   17. Sacas's kesh on Eudoxus (0x8104): the five vials in the Abandoned
       Farmhouse coffer get Data1 2, the value his line waits for.
   18. The magic arrow drawn as a stack (0x8103, and two Cademia stacks in
       0x8108): the count moves from Data1 to Data2.
   19. Kilts inside kilts (0x810D): the four kilts inside record 676 go
       into the dresser, record 673.
   20. The spent staff's light (0xF002): tile 0x88B's light level goes to 0.
   Added 27 September 2026:
   21. The Pelagon ending's black screen (0x180D): SpecialView(3) is the
       program's GammaFadeOut and SpecialView(4) its GammaFadeIn
       (cbScreenFX's switch), and the other three endings fade out, show
       the first slide, then fade back in; this one never fades in, so
       its four slides are clicked through at black. SpecialView(4) goes
       after the first slide, where Alaric's endings have it; a jump to
       the loop after it still lands on the loop.
   Added 28 September 2026:
   22. The strange device left open across a zone change (0x1175). A
       scripted window's buttons call back with the owner the window had
       when each was made: the widget constructor copies the window's
       owner number into its own word at 4, and TWidget::RenumberParent
       is an empty routine. Moving the party between zones gives every
       carried thing a new number (ShuffleUpPartyInventory, then the two
       moves in LoadLevelProps), and RenumberProp moves the window's
       owner with it but not the buttons' copies, so each click after
       it worked the storage of whatever thing now held the old number
       and changed nothing. The routine the three buttons share now
       checks that it was handed a strange device with its window open
       (HasWindow, which is the program's ShowWindow) and otherwise
       walks the party's things for the one that is, as Divide Food
       walks them; if there is none it does nothing. Four more locals
       for the two loops.
   23. The dead turning into other things (0xF008). A creature's unit is
       ObjToMonst of its map record's prop type, read once, when the
       creature is made (the TActiveMonster constructors and HatchEgg),
       and ObjToMonst answers null for a type with no record here; nothing
       checks. Two types a creature is made in have none: 264, "person
       sleeping", which the default EveryTurn (0x3020) gives a sleeper in
       bed, so anyone made while asleep -- a zone entered or a game loaded
       at night -- is made without a unit; and 229, the Odemia night guard
       (its class has member 55, so HatchEgg makes a creature of it). Die
       takes the corpse's type and aspect from the unit's word at 14, so
       such a death made a thing of whatever type the word at address 14
       held, with Data1 the dead one's number: the same wrong thing all
       session, a portal now and then, which is every report on the board.
       Its stats, flags and alignment came from low memory the same way.
       Two records go in the table's free slots, 50 and 51: 264 as a copy
       of the man's (a man's corpse, a person's flags) and 229 as a copy of
       the guard's. No class script sits at 0x1932 or 0x1933, which a
       unit's index would name.
   24. People gone from the zone after a sleep (the sleep helper, 0xE93).
       A night is PassTime(1024) an hour, and DoTicks schedules an hour
       passed in more than 100 ticks as instant: RepositionChar then leaves
       anyone not yet hatched whose new post is out of sight hidden (255)
       rather than an egg (66), which is what the draw loop hatches; one
       already hatched is moved to the post. (This said on first writing
       that the creature was taken off the map as well; the call that
       would do it sits behind a test its branch has already failed and
       never runs.) They came back only when a later
       hour, schedule while awake, or a new visit to the zone put them
       there. The helper now runs Reschedule (0xE0, ScheduleTime for the
       current hour, not instant) when the night ends, and when an owner
       kicks the hero out of bed, so the hidden are placed as eggs and
       hatch as the party comes near: the pass the next waking hour would
       have run, run at once.
   Added 28 September 2026, from the compendium's entries the bug list had
   not taken in:
   25. Rune of Warding says nothing (0x10F5). The spell (0x1A16) makes the
       rune with New(33, x, y, 0, 245, CurrentCharacter, 0), and cbcreateprop
       stores the sixth argument's low byte as Data1, so a rune's Data1 is
       its caster's character number: 1 for the hero, 6 for Hector. The
       rune's UseOn, which what steps on it runs (the default StepOn,
       0x301F), prints "Something has triggered one of your runes of
       warding." only when Data1 is 32, which is Ake, so no rune the party
       casts ever says it; the rune is deleted in silence, and the spell's
       own description is "signals the caster when something steps on it".
       No map places a rune and no shipped AI script casts one, so every
       rune is the party's, and the test goes: the line always prints.
   26. The Mining Camp's sign cannot be read (0x8118). A sign's Examine
       (0x10C3) shows entry Data1 of 0x0218 and nothing when Data1 is 0;
       the camp's sign, record 14, has Data1 0 and Data2 15, and entry 15 is
       "Iron Mines". It is the only sign of the 27 with anything in Data2;
       the number moves to Data1. */
import {buildPatch} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: community_fixes_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }

const keyword = (what, resid, at, kw, target) => ({ what, resid, at, replaceOp: true,
  expect: { [at]: 'conversation_response' }, code: `conversation_response "${kw}" -> ${target}` });
const talk = (who, slot) => `sys TalkParticipant\n${who}\nbyte 0x0${slot}\nend`;

const edits = [
  { what: 'weapon skill, damage', resid: 0xE87, at: 0x0096, replaceOp: true, expect: { 0x0096: 'local Var02', 0x0097: 'class_member 0x2A03' }, code: 'arg Arg02' },
  { what: 'weapon skill, margin', resid: 0xE87, at: 0x0088, replaceOp: true, expect: { 0x0088: 'local Var02', 0x0089: 'class_member 0x2A03' }, code: 'arg Arg02' },
  { what: '"Indeed I am." is Hadrian’s', resid: 0x1804, at: 0x02A9, to: 0x02E0,
    expect: { 0x02A9: 'string(implicit) "\\"Yes, you should be quite proud.\\"*\\"Indeed I am.\\""', 0x02D9: 'sys TalkParticipant', 0x02E0: 'branch' },
    code: `string(implicit) "\\"Yes, you should be quite proud.\\"*"\n${talk('short 0x0004', 0)}\nstring(implicit) "\\"Indeed I am.\\""` },
  { what: 'Hadrian tests Hector', resid: 0x1804, at: 0x0299, replaceOp: true, expect: { 0x0299: 'word Character.Hadrian', 0x029F: 'if_not' }, code: 'word Character.Hector' },
  { what: 'Aethon leaves', resid: 0x1861, at: 0x0765, replaceOp: true, expect: { 0x072B: 'string(implicit) "\\"Maybe it is time', 0x0765: 'branch' },
    code: 'sys LeaveParty\narg Arg00\nend\nreturn\nbyte 0x00\nend' },
  { what: 'Alaric remembers 201', resid: 0x1802, at: 0x1F3B, expect: { 0x1F34: 'call_resource 0xF02', 0x1F3B: 'then' }, code: 'not' },
  { what: 'Awakening names its speakers', resid: 0x1A13, at: 0x00D7, expect: { 0x00D5: 'sys OpenConversation', 0x00D7: 'method Talk' },
    code: `${talk('arg Arg01', 0)}\n${talk('global PlayerCharacter (0x5)', 2)}` },
  { what: 'Niobe speaks for herself', resid: 0x1859, at: 0x013F, expect: { 0x0127: 'string(implicit) "man with your nonsense', 0x013F: 'exit' }, code: talk('arg Arg00', 0) },
  { what: 'Lindus’s training route', resid: 0x1850, at: 0x05C9, expect: { 0x05C6: 'then', 0x05C9: 'string(implicit) "*\\"The most prized possession' },
    code: 'sys SetStateFlag\nbyte 0x01\nword True\nend\nsys CompleteQuest\nbyte 0x02\nend' },
  keyword('Apis’s name', 0x182A, 0x0596, 'inn,apis', '0x0628'),
  keyword('Parium’s name', 0x1828, 0x03A0, 'inn,pari', '0x0442'),
  keyword('Crito’s name', 0x1829, 0x05F3, 'inn,crit', '0x0695'),
  keyword('Eurybates’s name', 0x1818, 0x009E, 'name,eury', '0x00C6'),
  keyword('the Seldane’s "corruption"', 0x080F, 0x00C6, 'crol,corr', '0x0140'),
  { what: 'Sabinate remembers the mushroom', resid: 0x1878, at: 0x0966, expect: { 0x0966: 'sys Create', 0x096A: 'short 0x010F' },
    code: 'call_resource SetCharacterFlag (0xF00)\narg Arg00\nbyte 0x04\nend' },
  { what: 'the rolling pin', resid: 0x10A3, at: 0x0162, replaceOp: true, expect: { 0x0131: 'string(implicit) "You end up kneading', 0x0161: 'sys Delete', 0x0162: 'arg Arg00' }, code: 'arg Arg01' },
  { what: 'the wine urn', resid: 0xE0D, at: 0x0061, expect: { 0x003C: 'string(implicit) "The pitcher is now filled with wine', 0x0061: 'return' },
    code: 'set_field data1 (0x6)\narg Arg00\nend\nbyte 0x03\nend' },
  { what: 'the carcass', resid: 0x10D2, at: 0x0049, to: 0x0066, expect: { 0x0049: 'string(implicit) "You can\'t stuff the carcass', 0x0066: 'return' }, code: '' },
  { what: 'a thrown weapon, placed', resid: 0x3042, at: 0x0158, expect: { 0x0150: 'set_field container', 0x0158: 'branch' },
    code: 'set_field x (0x1)\nlocal Var03\nend\nbyte 0x00\nend\nset_field y (0x2)\nlocal Var03\nend\nbyte 0x01\nend\nmethod PutInside (0x10)\nlocal Var03\nend' },
  { what: 'a thrown weapon, carried', resid: 0x3042, at: 0x014D, replaceOp: true, expect: { 0x0149: 'set_field flags', 0x014D: 'byte 0x09' }, code: 'byte 0x10' },
  { what: 'the Pelagon ending fades in', resid: 0x180D, at: 0x011B, shiftAt: true,
    expect: { 0x0109: 'sys SpecialView', 0x010A: 'byte 0x03', 0x010F: 'sys Slideshow', 0x011A: 'end', 0x011B: 'set_local 0x00' },
    code: 'sys SpecialView\nbyte 0x04\nend' },
  { what: 'Eteocles’s "kesh"', resid: 0x1838, at: 0x01ED, replaceOp: true, expect: { 0x01E4: 'conversation_response "kesh"', 0x01ED: 'sys GetState', 0x01EE: 'byte 0x04' }, code: 'sys GetStateFlag' },
  // The type is tested before HasWindow, since HasWindow brings a found
  // window to the front and an open sack's should stay where it is.
  { what: 'the strange device finds itself', resid: 0x1175, at: 0x00C1,
    expect: { 0x00C1: 'set_local 0x00', 0x00C3: 'arg Arg00', 0x00C4: 'get_field storage', 0x00C6: 'word 256' },
    code: [
      'if_not', 'arg Arg00', 'get_field obj_type (0x4)', 'short 0x0175', 'eq', 'then -> search',
      'if', 'sys HasWindow', 'arg Arg00', 'end', 'then -> found',
      'search:',
      'set_local 0x05', 'sys PartyIterator', 'word &Var5', 'byte 0x00', 'word True', 'end', 'end',
      'party:',
      'if', 'sys PartyIterator', 'word &Var5', 'byte 0x01', 'end', 'then -> lost',
      'set_local 0x07', 'sys RecursiveContainerIterator', 'word &Var7', 'byte 0x00', 'local Var05', 'end', 'end',
      'thing:',
      'if', 'sys RecursiveContainerIterator', 'word &Var7', 'byte 0x01', 'end', 'then -> nextparty',
      'if_not', 'local Var07', 'get_field obj_type (0x4)', 'short 0x0175', 'eq', 'then -> nextthing',
      'if_not', 'sys HasWindow', 'local Var07', 'end', 'then -> nextthing',
      'set_local 0x30', 'local Var07', 'end',
      'branch found',
      'nextthing:',
      'set_local 0x07', 'sys RecursiveContainerIterator', 'word &Var7', 'byte 0x02', 'end', 'end',
      'branch thing',
      'nextparty:',
      'set_local 0x05', 'sys PartyIterator', 'word &Var5', 'byte 0x02', 'end', 'end',
      'branch party',
      'lost:',
      'return', 'byte 0x00', 'end',
      'found:'].join('\n') },
  // The loop's exit lands on the first, and nothing jumps to the second.
  { what: 'the sleepers rescheduled after a night', resid: 0xE93, at: 0x0160,
    expect: { 0x0151: 'set_local 0x03', 0x015D: 'branch', 0x0160: 'if_not', 0x0161: 'arg Arg03' },
    code: 'sys UnknownE0\nend' },
  { what: 'the sleepers rescheduled after a waking', resid: 0xE93, at: 0x013A,
    expect: { 0x0113: 'string(implicit) "You get kicked out of bed', 0x013A: 'sys SpecialView', 0x013B: 'byte 0x04' },
    code: 'sys UnknownE0\nend' },
  { what: 'the rune of warding signals', resid: 0x10F5, at: 0x0017, to: 0x0022,
    expect: { 0x0017: 'if_not', 0x0019: 'get_field data1', 0x001B: 'short 0x0020', 0x001E: 'eq', 0x001F: 'then',
              0x0022: 'string(implicit) "Something has triggered one of your runes of warding' },
    code: '' },
];

const propRec = (b, i) => b.subarray(i * 16, i * 16 + 16);
const dataEdits = [
  { what: 'Pelagon’s schedule', resid: 0xF00B, fn: (b) => {
      const u16 = (b, o) => (b[o] << 8) | b[o + 1];
      let p = 512; for (let i = 0; i < 13; i++) p += 8 * u16(b, i * 2);
      if (u16(b, 26) !== 5) throw new Error('Pelagon has ' + u16(b, 26) + ' segments, not 5');
      const seg = k => Array.from(b.subarray(p + 8 * k, p + 8 * k + 8));
      const s = [0, 1, 2, 3, 4].map(seg);
      if (!(s[0][2] === 0x83 && s[0][3] === 3 && s[1][2] === 1 && s[2][2] === 0x40 && s[2][3] === 13 && s[2][4] === 255 && s[3][2] === 1)) throw new Error('Pelagon’s segments are not the shape expected');
      const order = [2, 3, 0, 1, 4];
      order.forEach((k, j) => b.set(s[k], p + 8 * j));
      return 'his flag-0 pair now comes before his quest-value pair';
  } },
  { what: 'the placed panpipes', resid: 0x8108, fn: (b) => {
      let n = 0;
      for (const i of [402, 498]) { const r = b.subarray(i * 16, i * 16 + 16); if (((r[4] << 8 | r[5]) & 0x3FF) !== 153 || r[6] !== 0) throw new Error('record ' + i + ' is not a panpipes with Data1 0'); r[6] = 1; n++; }
      return n + ' sets given Data1 1';
  } },
  { what: 'the Cademia arrow stacks', resid: 0x8108, fn: (b) => {
      const want = { 1155: 30, 1174: 20 }; let n = 0;
      for (const [i, c] of Object.entries(want)) { const r = b.subarray(i * 16, i * 16 + 16); if (((r[4] << 8 | r[5]) & 0x3FF) !== 102 || r[6] !== c || r[7] !== 0) throw new Error('record ' + i + ' is not an arrow with ' + c + ' in Data1'); r[6] = 0; r[7] = c; n++; }
      return n + ' stacks’ counts moved to Data2';
  } },
  { what: 'Eudoxus’s kesh', resid: 0x8104, fn: (b) => {
      let n = 0;
      for (let i = 34; i <= 38; i++) { const r = b.subarray(i * 16, i * 16 + 16); if (((r[4] << 8 | r[5]) & 0x3FF) !== 298 || r[6] !== 0 || (r[0] & 0x08) === 0) throw new Error('record ' + i + ' is not a contained liquid with Data1 0'); r[6] = 2; n++; }
      return n + ' vials given Data1 2';
  } },
  { what: 'the Land King Hall magic arrow', resid: 0x8103, fn: (b) => {
      const r = b.subarray(632 * 16, 632 * 16 + 16);
      if (((r[4] << 8 | r[5]) & 0x3FF) !== 101 || r[6] !== 7 || r[7] !== 0) throw new Error('record 632 is not the magic arrow with 7 in Data1');
      r[6] = 0; r[7] = 7; return 'record 632’s count moved to Data2';
  } },
  { what: 'the kilts', resid: 0x810D, fn: (b) => {
      let n = 0;
      for (let i = 677; i <= 680; i++) { const r = b.subarray(i * 16, i * 16 + 16); const raw = (r[1] << 16) | (r[2] << 8) | r[3]; if (((r[4] << 8 | r[5]) & 0x3FF) !== 284 || r[0] !== 8 || (raw & 0xFFFF) !== 932) throw new Error('record ' + i + ' is not a kilt inside record 676'); r[2] = (929 >> 8) & 0xFF; r[3] = 929 & 0xFF; n++; }
      return n + ' kilts moved into record 673';
  } },
  { what: 'the spent staff’s tile', resid: 0xF002, fn: (b) => {
      const o = 0x88B * 4; if ((b[o + 3] & 3) !== 1) throw new Error('tile 0x88B has light level ' + (b[o + 3] & 3) + ', not 1');
      b[o + 3] &= ~3; return 'tile 0x88B’s light level 1 cleared';
  } },
  // The header of 0x00BE, the buttons' routine; its third byte is the
  // count of locals, and the loops above use locals 5 to 8.
  { what: 'the strange device’s locals', resid: 0x1175, fn: (b) => {
      if (b[0xC0] !== 5) throw new Error('0x00BE has ' + b[0xC0] + ' locals, not 5');
      b[0xC0] = 9; return 'locals 5 to 9';
  } },
  { what: 'units for the sleeping and the night guard', resid: 0xF008, fn: (b) => {
      const key = i => (b[i * 16 + 12] << 8) | b[i * 16 + 13];
      const word = (i, o) => (b[i * 16 + o] << 8) | b[i * 16 + o + 1];
      let n = 0; while (n < 128 && key(n)) n++;
      if (n !== 50) throw new Error('0xF008 has ' + n + ' units, not 50');
      const at = t => { for (let i = 0; i < n; i++) if (key(i) === t) return i; return -1; };
      if (at(264) >= 0 || at(229) >= 0) throw new Error('264 or 229 already has a unit');
      const man = at(48), guard = at(46);
      if (man < 0 || word(man, 14) !== 0x104E) throw new Error('the man’s unit is not where it was read');
      if (guard < 0 || word(guard, 14) !== 0x004E) throw new Error('the guard’s unit is not where it was read');
      for (let i = n * 16; i < (n + 2) * 16; i++) if (b[i]) throw new Error('slots ' + n + ' and ' + (n + 1) + ' are not empty');
      b.copyWithin(n * 16, man * 16, man * 16 + 16); b[n * 16 + 12] = 264 >> 8; b[n * 16 + 13] = 264 & 0xFF;
      b.copyWithin((n + 1) * 16, guard * 16, guard * 16 + 16); b[(n + 1) * 16 + 12] = 0; b[(n + 1) * 16 + 13] = 229;
      return 'units ' + n + ' (264, as the man) and ' + (n + 1) + ' (229, as the guard)';
  } },
  { what: 'the Mining Camp’s sign', resid: 0x8118, fn: (b) => {
      const r = b.subarray(14 * 16, 14 * 16 + 16);
      if (((r[4] << 8 | r[5]) & 0x3FF) !== 195 || r[6] !== 0 || r[7] !== 15) throw new Error('record 14 is not a sign with 15 in Data2');
      r[6] = 15; r[7] = 0; return 'record 14’s text number moved to Data1';
  } },
];

const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Community Fixes',
  description: '26 fixes for reported bugs: training, Hadrian, Aethon, Alaric, Awakening, Niobe, Lindus, keywords, Sabinate, rolling pin, wine urn, carcass, throwing, Eteocles, Pelagon, panpipes, kesh, arrows, kilts, staff, strange device, corpses, sleep, runes, sign.',
  edits, dataEdits });
process.exit(ok ? 0 : 1);
