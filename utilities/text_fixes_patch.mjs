#!/usr/bin/env node
/* A builder, not a check: the misspellings and slips in Cythera's text that
   the pass of 24 September 2026 found beyond the community's proofreading
   (workbench doc/bugs.md, *The text: misspellings, slips and facts that
   disagree*), as one Magpie patch, after the maintainer's review of the
   list. Each is a find-and-replace on the resource's bytes through
   patch_build.mjs's text edits, which move the offsets past the change and
   correct a data block's size where the text sits inside one.

   Usage: node utilities/text_fixes_patch.mjs index.html "<Cythera Data.data>" <out dir>

   What is deliberately NOT here: the community's own 161 dialogue typos
   (a patch of their own, from their collection), "Beserk" and "celstial"
   and the rest of the application's strings (a Magpie patch cannot reach
   them), "Ariethous"/"Areithous" (the name table and the dialogue disagree
   and which is meant is not settled), and "Two-Taled Rat", which the
   maintainer confirms is the inn's name: the three "Two Tailed" in the
   Cademia directions are the slip and are fixed the other way. */
import {buildPatch} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: text_fixes_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }

const T = (what, resid, find, replace, count) => ({ what, resid, find, replace, ...(count !== undefined ? { count } : {}) });
const textEdits = [
  // dialogue
  T('Helen, "Yery"', 0x1858, 'Yery well', 'Very well', 1),
  T('Helen, "daugther"', 0x1858, 'daugther', 'daughter', 1),
  T('Alaric, "discoved"', 0x1802, 'discoved', 'discovered', 1),
  T('Meleager, "disrepest"', 0x1822, 'disrepest', 'disrespect', 1),
  T('Apis, "oportunity"', 0x182A, 'oportunity', 'opportunity', 1),
  T('Charax, "elimating"', 0x184F, 'elimating', 'eliminating', 1),
  T('Charax, "possbilities"', 0x184F, 'possbilities', 'possibilities', 1),
  T('Jhiaxus, "leige"', 0x1879, 'leige', 'liege', 1),
  T('Ignae, "streches"', 0x187D, 'streches', 'stretches', 1),
  T('Ascalon, "to to"', 0x1834, 'talk to to the', 'talk to the', 1),
  T('Sardis, "Attusa" and "Attusan"', 0x181F, 'Attusa', 'Atussa', 3),
  T('Thersites, "enscription"', 0x1865, 'enscription', 'inscription', 1),
  T('Thersites, "embarassed"', 0x1865, 'embarassed', 'embarrassed', 1),
  T('Berossus, "Halso"', 0x1848, 'Halso', 'Halos', 1),
  T('Anisa, "Atusa"', 0x184D, 'Founder Atusa', 'Founder Atussa', 1),
  T('Magpie, "Jhaixus"', 0x1803, 'Jhaixus', 'Jhiaxus', 1),
  T('Ignae, "Jhaixus"', 0x187D, 'Jhaixus', 'Jhiaxus', 3),
  T('Lindus, "Eigth"', 0x1850, 'Eigth', 'Eighth', 1),
  ...[0x0204, 0x1803, 0x184D, 0x1853, 0x1869, 0x186D, 0x1878].map(r => T('"knowlege"', r, 'knowlege', 'knowledge')),
  // skills and spells
  ...[0x1AC0, 0x1AC1, 0x1AC2, 0x1AC3].map(r => T('training, "techinques"', r, 'techinques', 'techniques')),
  T('Death Strike, "grevious"', 0x1A06, 'grevious', 'grievous', 1),
  T('Mass Terrorisation, "shreaks"', 0x1A26, 'shreaks', 'shrieks', 1),
  T('the spell "Acertainment"', 0x1A07, 'Acertainment', 'Ascertainment', 1),
  // items and rooms
  T('the grimoire, "correspondances"', 0x104C, 'correspondances', 'correspondences', 1),
  T('a room, "cinammon"', 0x1BD6, 'cinammon', 'cinnamon', 1),
  T('a room, "libary"', 0x1BB0, 'libary', 'library', 1),
  T('a room, "the the forge"', 0x1B3A, 'the the forge', 'the forge', 1),
  T('the shop, "Its nothing special"', 0x0EA5, '- Its nothing special.', "- It's nothing special.", 1),
  T('the onlooker, "your doing"', 0x0D06, 'What do you think your doing?', "What do you think you're doing?", 1),
  T('the fountain, "obolio"', 0x1036, 'obolio', 'oboloi', 1),
  // books
  T('"City of Mistery"', 0x021D, 'City of Mistery', 'City of Mystery', 1),
  T('"diverisified"', 0x021D, 'diverisified', 'diversified', 1),
  T('"percieve"', 0x021D, 'percieve', 'perceive', 1),
  T('"wreack"', 0x021D, 'wreack', 'wreak', 1),
  T('"live live"', 0x021D, 'live live', 'live', 1),
  T('"A expedition"', 0x021D, 'A expedition', 'An expedition', 1),
  T('"it wasn\'t 174"', 0x021D, "it wasn't 174 when", "it wasn't until 174 when", 1),
  T('"Alaric, Landking"', 0x021B, 'Alaric, Landking', 'Alaric, LandKing', 1),
  // the To Do lines
  T('To Do, "has be kidnapped"', 0x021A, 'has be kidnapped', 'has been kidnapped', 1),
  T('To Do, "suggest taking"', 0x021A, 'Metopes suggest taking', 'Metopes suggests taking', 1),
  T('To Do, "nees"', 0x021A, 'nees some', 'needs some', 1),
  T('To Do, "possible has"', 0x021A, 'which possible has', 'which possibly has', 1),
  T('To Do, four books', 0x021A, 'Four of the ten Sapphire Books of Wisdom remains scattered somewhere in Cythera at large.  Find it and return it', 'Four of the ten Sapphire Books of Wisdom remain scattered somewhere in Cythera at large.  Find them and return them', 1),
  T('To Do, three books', 0x021A, 'Three of the ten Sapphire Books of Wisdom remains scattered somewhere in Cythera at large.  Find them and return it', 'Three of the ten Sapphire Books of Wisdom remain scattered somewhere in Cythera at large.  Find them and return them', 1),
  T('To Do, two books', 0x021A, 'Two of the ten Sapphire Books of Wisdom remains scattered somewhere in Cythera at large.  Find them and return it', 'Two of the ten Sapphire Books of Wisdom remain scattered somewhere in Cythera at large.  Find them and return them', 1),
  T('To Do, "sharpens"', 0x021A, 'the sharpens of weapons', 'the sharpness of weapons', 1),
  T('To Do, "for research the"', 0x021A, 'In return for research the', 'In return for researching the', 1),
  T('To Do, "enscription"', 0x021A, 'enscription', 'inscription', 1),
  T('To Do, "embarassed"', 0x021A, 'embarassed', 'embarrassed', 1),
  T('To Do, "Berosus"', 0x021A, 'Judge Berosus', 'Judge Berossus', 1),
  T('To Do, "shading dealing"', 0x021A, 'the shading dealing of', 'the shady dealings of', 1),
  T('To Do, "Matro"', 0x021A, 'Matro Thuria', 'Matron Thuria', 1),
  T('To Do, "too her"', 0x021A, 'take it too her', 'take it to her', 1),
  // notes, signs, the character sheet
  T('the letter, "Berrosus"', 0x0219, '--Berrosus', '--Berossus', 1),
  T('Tavara’s note, "once chance"', 0x0219, 'but once chance', 'but one chance', 1),
  T('the sign "Eight Degree Hall"', 0x0218, 'Eight Degree Hall', 'Eighth Degree Hall', 1),
  T('archetypes, "A explorer"', 0x0204, 'A explorer', 'An explorer', 1),
  T('archetypes, "Beserker"', 0x0203, 'Beserker', 'Berserker', 1),
  // the opening and endings
  T('opening, "a might oak"', 0x0240, 'a might oak', 'a mighty oak', 1),
  T('ending, "momemt"', 0x0242, 'momemt', 'moment', 1),
  T('ending, "don\'t not know"', 0x0242, "You don't not know", 'You do not know', 1),
  T('ending, "beginning crying"', 0x0242, 'beginning crying', 'begins crying', 1),
  T('ending, "flys away"', 0x0243, 'flys away', 'flies away', 1),
  // the "Where Is" answers and the general group
  T('Land King Hall, "quaters"', 0x0809, 'quaters', 'quarters', 1),
  T('Land King Hall, "Its the first city"', 0x0809, "Its the first city", "It's the first city", 1),
  T('Odemia, "Milcon"', 0x080A, 'Milcon', 'Milcom', 1),
  T('Catamarca, the hall’s bearing', 0x080B, 'LandKing Hall north east through', 'LandKing Hall lies north west through', 1),
  T('Catamarca, the town to the north', 0x080B, 'Catamarca lies north up the coast', 'Odemia lies north up the coast', 1),
  T('Pnyx, "Selinus has quaters are"', 0x080C, 'Selinus has quaters are ', "Selinus' quarters are ", 1),
  T('Pnyx, "quaters"', 0x080C, 'quaters', 'quarters', 2),
  T('Pnyx, the hall without a verb', 0x080C, 'The secondary lecture hall downstairs, northeast', 'The secondary lecture hall is downstairs, northeast', 1),
  T('Pnyx, the road to the hall', 0x080C, 'northwest, past Odemia', 'northeast, past Odemia', 1),
  T('Pnyx, the road to Odemia', 0x080C, 'then northwest along the road', 'then northeast along the road', 1),
  T('Kosha, "Odemia north of"', 0x080D, 'Odemia north of Catamarca', 'Odemia lies north of Catamarca', 1),
  T('Kosha, "Catamarca northeast of here"', 0x080D, 'Catamarca northeast of here', 'Catamarca lies northeast of here', 1),
  T('Kosha, "take the road ... is the safest"', 0x080D, 'take the road west from Cademia is the safest', 'the road west from Cademia is the safest', 1),
  T('Cademia, "Your standing"', 0x080E, 'Your standing in them.', "You're standing in them.", 1),
  T('Cademia, "Two Tailed Rat"', 0x080E, 'Two Tailed Rat', 'Two-Taled Rat', 3),
  T('Cademia, "Opheltuis"', 0x080E, 'Opheltuis', 'Opheltius', 1),
  T('the mine, "He\'s quarters"', 0x0811, "He's quarters are", 'His quarters are', 1),
  T('the general group, Pnyx’s coast', 0x0801, 'on the eastern coast of Cythera', 'on the western coast of Cythera', 1),
  // tab bytes
  { ...T('Tavara’s tabs', 0x1CC3, '\t', '', 10), mid: true },
  { ...T('a rumour’s tab', 0x0813, '\t', '', 1), mid: true },
];

const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Text Fixes',
  description: 'Misspellings and slips in Cythera’s text, found by reading every string with Grimoire and reviewed by the maintainer: dialogue, spell and training text, books, the To Do lines, signs and notes, the opening and endings, the Where Is answers, and the tab bytes.',
  edits: [], dataEdits: [], textEdits });
process.exit(ok ? 0 : 1);
