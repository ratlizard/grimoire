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
   11. The wine urn's empty pitcher (0xE0D): the pitcher's Data1 is set, as
       the water helper sets it.
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
   20. The spent staff's light (0xF002): tile 0x88B's light level goes to 0. */
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
    code: 'set_field data1 (0x6)\narg Arg00\nend\nbyte 0x01\nend' },
  { what: 'the carcass', resid: 0x10D2, at: 0x0049, to: 0x0066, expect: { 0x0049: 'string(implicit) "You can\'t stuff the carcass', 0x0066: 'return' }, code: '' },
  { what: 'a thrown weapon, placed', resid: 0x3042, at: 0x0158, expect: { 0x0150: 'set_field container', 0x0158: 'branch' },
    code: 'set_field x (0x1)\nlocal Var03\nend\nbyte 0x00\nend\nset_field y (0x2)\nlocal Var03\nend\nbyte 0x01\nend\nmethod PutInside (0x10)\nlocal Var03\nend' },
  { what: 'a thrown weapon, carried', resid: 0x3042, at: 0x014D, replaceOp: true, expect: { 0x0149: 'set_field flags', 0x014D: 'byte 0x09' }, code: 'byte 0x10' },
  { what: 'Eteocles’s "kesh"', resid: 0x1838, at: 0x01ED, replaceOp: true, expect: { 0x01E4: 'conversation_response "kesh"', 0x01ED: 'sys GetState', 0x01EE: 'byte 0x04' }, code: 'sys GetStateFlag' },
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
];

const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Community Fixes',
  description: 'Twenty fixes for bugs the Cythera community reported, built with Grimoire: weapon training, Hadrian, Aethon, Alaric, Awakening, Niobe, Lindus, five keywords, Sabinate, the rolling pin, the wine urn, the carcass, thrown weapons, Eteocles, Pelagon, the panpipes, the kesh vials, the arrow stacks, the kilts, the staff.',
  edits, dataEdits });
process.exit(ok ? 0 : 1);
