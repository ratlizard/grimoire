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
   them), and "Two-Taled Rat", which the
   maintainer confirms is the inn's name: the three "Two Tailed" in the
   Cademia directions are the slip and are fixed the other way. */
import {buildPatch} from './patch_build.mjs';
import {fileURLToPath} from 'node:url';

export const T = (what, resid, find, replace, count) => ({ what, resid, find, replace, ...(count !== undefined ? { count } : {}) });
/* The edits, for either spelling. `uk` keeps the game's British forms and
   turns its American ones British instead (the "UK English" variant, 24
   September 2026, at the maintainer's word); otherwise the British forms go
   American as the Hintbook has them. Everything else is the same list. */
export function textFixEdits({ uk = false } = {}) {
  const AMERICAN = [
  // British spellings in a game whose text, and whose Hintbook ("traveling",
  // "Terrorization"), are otherwise American: changed to American, leaving
  // the quoted passages in the books ("many colours", "shall be burnt") as
  // their authors wrote them.
  T('"travelling"', 0x0801, 'travelling', 'traveling', 1),
  T('"travelling"', 0x1805, 'travelling', 'traveling', 1),
  T('"travelling"', 0x186D, 'travelling', 'traveling', 2),
  T('"traveller"', 0x021D, 'traveller', 'traveler'),
  T('"traveller"', 0x0813, 'traveller', 'traveler', 1),
  T('"judgement"', 0x021B, 'judgement', 'judgment'),
  T('"judgement"', 0x1801, 'judgement', 'judgment'),
  T('"judgement"', 0x1848, 'judgement', 'judgment', 1),
  T('"saviour"', 0x0240, 'saviour', 'savior', 1),
  T('"saviour"', 0x1864, 'saviour', 'savior', 1),
  T('"Terrorisation"', 0x1A0E, 'Terrorisation', 'Terrorization', 1),
  T('"Mass Terrorisation"', 0x1A26, 'Terrorisation', 'Terrorization', 1),
  T('"grey slime"', 0x021D, 'grey slime', 'gray slime', 1),
  ];
  // Both cases of a stem; a form that may not occur is allowed to match nothing.
  const both = (what, resid, stem, to) => [
    { ...T(what, resid, stem, to), optional: true },
    { ...T(what, resid, stem[0].toUpperCase() + stem.slice(1), to[0].toUpperCase() + to.slice(1)), optional: true } ];
  const UK_STEMS = [['centered', 'centred'], ['honor', 'honour'], ['rumor', 'rumour'], ['favor', 'favour'], ['color', 'colour'], ['savior', 'saviour'],
    ['gray', 'grey'], ['defense', 'defence'], ['offense', 'offence'], ['center', 'centre'], ['odor', 'odour'],
    ['artifact', 'artefact'], ['mommy', 'mummy'], ['recogniz', 'recognis'], ['organiz', 'organis'], ['specializ', 'specialis'],
    ['neutraliz', 'neutralis'], ['harmoniz', 'harmonis'], ['realiz', 'realis'], ['paralyz', 'paralys'], ['fiber', 'fibre'],
    ['plow', 'plough'], ['mold', 'mould'], ['sulfur', 'sulphur'], ['armor', 'armour']];
  const UK = [];
  for (const [s, to] of UK_STEMS) UK.push(...both('UK "' + s + '"', null, s, to));
  // Niobe's keywords answer "mom" and "momm"; with her "@mommy" now "@mummy" they follow it.
  UK.push(T('Niobe\u2019s keywords "mom,momm"', 0x1859, 'mom,momm', 'mum,mumm', 1));
  const meleager = uk ? T('Meleager, "use to travelling"', 0x1822, "I'm use to travelling", "I'm used to travelling", 1)
                      : T('Meleager, "use to travelling"', 0x1822, "I'm use to travelling", "I'm used to traveling", 1);
  return [...BASE, meleager, ...(uk ? UK : AMERICAN)];
}
const BASE = [
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
  T('"Alaric, Landking"', 0x021B, 'Alaric, Landking', 'Alaric, Land King', 1),
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
  // Areithous: the Hintbook spells him so, twice, as do his own "I'm called
  // Areithous", Laodice's three, the Kosha group and the community; the
  // name table, Atreus and one of Laodice's are the odd ones out (settled
  // 24 September 2026).
  T('the name table, "Ariethous"', 0x0201, 'Ariethous', 'Areithous', 1),
  T('Atreus, "Ariethous"', 0x1810, 'Ariethous', 'Areithous', 1),
  T('Laodice, "Ariethous"', 0x1813, 'Ariethous', 'Areithous', 1),
  // Meleager: a typo the collection mis-transcribed ("I am use to"), placed
  // by hand; the same edit takes its "travelling".
  // Compound modifiers before a noun, hyphenated as the game does elsewhere
  // ("rat-faced", "round-faced", "wide-eyed", "kind-hearted"): every "X
  // looking", "X faced" and "X eyed" it left open, 46 places.
  T('"strange looking"', 0x0219, 'strange looking', 'strange-looking', 1),
  T('"disgusting looking"', 0x021D, 'disgusting looking', 'disgusting-looking', 1),
  T('"serious looking"', 0x102E, 'serious looking', 'serious-looking', 1),
  T('"wicked looking"', 0x1119, 'wicked looking', 'wicked-looking', 1),
  T('"vacant eyed"', 0x1121, 'vacant eyed', 'vacant-eyed', 1),
  T('"strange looking"', 0x1174, 'strange looking', 'strange-looking', 1),
  T('"impressive looking"', 0x1176, 'impressive looking', 'impressive-looking', 1),
  T('"impressive looking"', 0x1177, 'impressive looking', 'impressive-looking', 1),
  T('"odd looking"', 0x1187, 'odd looking', 'odd-looking', 1),
  T('"strange looking"', 0x1801, 'strange looking', 'strange-looking', 1),
  T('"serious looking"', 0x1807, 'serious looking', 'serious-looking', 1),
  T('"serious looking"', 0x1808, 'serious looking', 'serious-looking', 1),
  T('"mean looking"', 0x180E, 'mean looking', 'mean-looking', 1),
  T('"serious looking"', 0x180F, 'serious looking', 'serious-looking', 1),
  T('"vain looking"', 0x1812, 'vain looking', 'vain-looking', 1),
  T('"stern looking"', 0x181E, 'stern looking', 'stern-looking', 1),
  T('"slight looking"', 0x181F, 'slight looking', 'slight-looking', 1),
  T('"confused looking"', 0x182D, 'confused looking', 'confused-looking', 1),
  T('"grandmotherly looking"', 0x182E, 'grandmotherly looking', 'grandmotherly-looking', 1),
  T('"dour faced"', 0x1830, 'dour faced', 'dour-faced', 1),
  T('"dour faced"', 0x1831, 'dour faced', 'dour-faced', 1),
  T('"ordinary looking"', 0x1833, 'ordinary looking', 'ordinary-looking', 1),
  T('"serious looking"', 0x1836, 'serious looking', 'serious-looking', 1),
  T('"hesitant looking"', 0x183A, 'hesitant looking', 'hesitant-looking', 1),
  T('"stoic looking"', 0x183B, 'stoic looking', 'stoic-looking', 1),
  T('"serious looking"', 0x183F, 'serious looking', 'serious-looking', 1),
  T('"friendly looking"', 0x1844, 'friendly looking', 'friendly-looking', 1),
  T('"funny looking"', 0x1845, 'funny looking', 'funny-looking', 2),
  T('"kind looking"', 0x184C, 'kind looking', 'kind-looking', 1),
  T('"peaceful looking"', 0x184E, 'peaceful looking', 'peaceful-looking', 1),
  T('"pinch faced"', 0x1852, 'pinch faced', 'pinch-faced', 1),
  T('"ordinary looking"', 0x1853, 'ordinary looking', 'ordinary-looking', 1),
  T('"serious looking"', 0x1854, 'serious looking', 'serious-looking', 1),
  T('"handsome looking"', 0x1857, 'handsome looking', 'handsome-looking', 1),
  T('"narrow eyed"', 0x185B, 'narrow eyed', 'narrow-eyed', 1),
  T('"dirty looking"', 0x185C, 'dirty looking', 'dirty-looking', 1),
  T('"dour faced"', 0x1860, 'dour faced', 'dour-faced', 1),
  T('"rat faced"', 0x1861, 'rat faced', 'rat-faced', 1),
  T('"broken looking"', 0x1866, 'broken looking', 'broken-looking', 1),
  T('"round faced"', 0x1868, 'round faced', 'round-faced', 1),
  T('"content looking"', 0x1869, 'content looking', 'content-looking', 1),
  T('"content looking"', 0x186A, 'content looking', 'content-looking', 1),
  T('"strange looking"', 0x1878, 'strange looking', 'strange-looking', 1),
  T('"bare looking"', 0x1B36, 'bare looking', 'bare-looking', 1),
  T('"sly looking,"', 0x1818, 'sly looking,', 'sly-looking,', 1),
  T('Helen, "wearly looking"', 0x1858, 'wearly looking', 'weary-looking', 1),
  // Two keywords that matched only the misspelling they answered: Sardis's
  // "attu" for House Atussa, Ignae's "jhai" for Jhiaxus. With the words
  // corrected above, the keywords follow them (the same length, so no
  // offset moves).
  T('Sardis\u2019s keyword "attu"', 0x181F, 'attu', 'atus', 1),
  T('Ignae\u2019s keyword "jhai"', 0x187D, 'jhai', 'jhia', 1),
  // "LandKing" to "Land King" (24 September 2026, at the maintainer's
  // word): the author's own unit table names Alaric's unit "Land King",
  // both manuals write it so 39 times and "LandKing" never, the zone is
  // titled "Land King Hall", and the dialogue itself says "the Land King's
  // side" beside its forty "LandKing"s. The keywords are "land" and
  // "king", which the two words still match.
  T('"LandKing"', 0x021A, 'LandKing', 'Land King'),
  T('"LandKing"', 0x021B, 'LandKing', 'Land King'),
  T('"LandKing"', 0x0242, 'LandKing', 'Land King'),
  T('"LandKing"', 0x0801, 'LandKing', 'Land King'),
  T('"LandKing"', 0x0804, 'LandKing', 'Land King'),
  T('"LandKing"', 0x0809, 'LandKing', 'Land King'),
  T('"LandKing"', 0x080A, 'LandKing', 'Land King'),
  T('"LandKing"', 0x080B, 'LandKing', 'Land King'),
  T('"LandKing"', 0x080C, 'LandKing', 'Land King'),
  T('"LandKing"', 0x080D, 'LandKing', 'Land King'),
  T('"LandKing"', 0x080E, 'LandKing', 'Land King'),
  T('"LandKing"', 0x0811, 'LandKing', 'Land King'),
  T('"LandKing"', 0x1801, 'LandKing', 'Land King'),
  T('"LandKing"', 0x1802, 'LandKing', 'Land King'),
  T('"LandKing"', 0x1803, 'LandKing', 'Land King'),
  T('"LandKing"', 0x1804, 'LandKing', 'Land King'),
  T('"LandKing"', 0x1807, 'LandKing', 'Land King'),
  T('"LandKing"', 0x180D, 'LandKing', 'Land King'),
  T('"LandKing"', 0x1846, 'LandKing', 'Land King'),
  T('"LandKing"', 0x1A00, 'LandKing', 'Land King'),
  // tab bytes
  { ...T('Tavara’s tabs', 0x1CC3, '\t', '', 10), mid: true },
  { ...T('a rumour’s tab', 0x0813, '\t', '', 1), mid: true },
];

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const uk = process.argv.includes('--uk');
  const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2).filter(a => a !== '--uk');
  if (!dataPath || !outDir) { console.error('usage: text_fixes_patch.mjs [--uk] index.html <Cythera Data.data> <out dir>'); process.exit(2); }
  const ok = buildPatch({ htmlPath, dataPath, outDir, name: uk ? 'Cythera Text Fixes (UK English)' : 'Cythera Text Fixes',
    description: 'Misspellings and slips in Cythera\u2019s text, found by reading every string with Grimoire and reviewed by the maintainer: dialogue, spell and training text, books, the To Do lines, signs and notes, the opening and endings, the Where Is answers, and the tab bytes' + (uk ? '; with the game\u2019s spelling made British throughout.' : '.'),
    edits: [], dataEdits: [], textEdits: textFixEdits({ uk }) });
  process.exit(ok ? 0 : 1);
}
