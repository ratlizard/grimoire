#!/usr/bin/env node
/* A builder, not a check: the typos the community marked in its own
   dialogue collection, as one Magpie patch. (24 September 2026, at the
   maintainer's word.)

   Usage: node utilities/community_text_patch.mjs index.html "<Cythera Data.data>" <collection dir> <out dir>

   The collection (cytheraguides.com's dialogue set, collected in play by
   BreadWorldMercy453 and reformatted by Wizard; in the reference under
   community/guides-site/dialogue/Dialogue) marks each typo as
   <original,fix>. This reads every pair out of every file, takes the words
   around it, resolves the line to the game's own wording (every other pair
   on the line put back to its original), and looks for those words in the
   game's text with the collection's markup allowed between them -- the
   game's strings carry quotes, the click marks (*) and the @ of a
   highlighted word where the collection does not. A pair found once, or the
   same number of times as the game holds the phrase, is an edit; one found
   nowhere is tried with fewer words around it, then with the misspelt word
   alone when the game holds it exactly once; what is still not found is
   reported and left. So the edits are the collection's, not typed in here.

   Left out on purpose (LEAVE below): the seven originals that are the
   collection's own slips and not the game's (bugs.md, *The community's
   list, checked*); "travelling", a spelling and not a typo; "Two-Taled Rat",
   which the maintainer confirms is the inn's name; "Ariethous", which the
   name table spells that way and is undecided; and the pairs the text
   patch (text_fixes_patch.mjs) already applies, so that the two do not
   both claim a change. */
import {readdirSync, readFileSync, statSync} from 'node:fs';
import {join} from 'node:path';
import {buildPatch, resourceTexts} from './patch_build.mjs';

const [htmlPath = 'index.html', dataPath, collDir, outDir] = process.argv.slice(2);
if (!dataPath || !collDir || !outDir) { console.error('usage: community_text_patch.mjs index.html <Cythera Data.data> <collection dir> <out dir>'); process.exit(2); }

const LEAVE = new Set(['travelling', '@travelling', 'Two-Taled', 'Ariethous',
  // applied by text_fixes_patch.mjs
  'Halso', 'Opheltuis', 'Jhaixus', 'Atusa', 'Eigth', 'knowlege', 'enscription', 'embarassed',
  'Catamarca', 'east', 'northwest', 'eastern', 'Your']);
// One place the text patch already changes, under a word other places need.
const LEAVE_IN = new Set(['Its|Emesa', 'Its|Generic Land King Hall', "He's|Generic Iron Mine", "He's|Eurybates"]);
// Where the collection's fix is itself wrong: "Perhaps I'm not strong
// enough" is the device, so "it's", not the collection's "its".
const OVERRIDE = { "I'm|its": "it's", 'endevour|endeavour': 'endeavor' };   // the game's text is American (the Hintbook: "traveling", "Terrorization")

// Every pair, with the words around it in the game's own wording.
const files = [];
(function walk(d) { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.txt')) files.push(p); } })(collDir);
const PAIR = /<([^<>]{1,60}),([^<>]{1,60})>/g;
const occurrences = [];   // { orig, fix, before: [words], after: [words], file }
for (const f of files) {
  for (const rawLine of readFileSync(f, 'latin1').split(/\r?\n/)) {
    if (!rawLine.includes('<')) continue;
    // Resolve every pair to its original, remembering where each sits.
    let line = '', pairs = [];
    let last = 0, m;
    PAIR.lastIndex = 0;
    while ((m = PAIR.exec(rawLine))) { line += rawLine.slice(last, m.index); pairs.push({ at: line.length, orig: m[1], fix: m[2] }); line += m[1]; last = m.index + m[0].length; }
    line += rawLine.slice(last);
    // Strip the collection's own notation: triggers, notes, actions, the
    // speaker label, so only words the game also has remain.
    const clean = s => s.replace(/\{[^}]*\}/g, ' ').replace(/%[^%]*%/g, ' ').replace(/#/g, ' ').replace(/[\[\]]/g, ' ');
    for (const p of pairs) {
      const before = clean(line.slice(0, p.at)).replace(/^\s*[A-Za-z]+:\s*/, '').trim().split(/\s+/).filter(Boolean).slice(-2);
      const after = clean(line.slice(p.at + p.orig.length)).trim().split(/\s+/).filter(Boolean).slice(0, 2);
      occurrences.push({ orig: p.orig, fix: p.fix, before, after, file: f.split('/').pop() });
    }
  }
}

// The game's text, and the search.
const texts = resourceTexts({ htmlPath, dataPath });
const SEP = '[ \\t\\n"*@]*', GAP = '[ \\t\\n"*@]+';   // between words; inside a phrase at least one
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = w => esc(w.replace(/^@/, ''));
const pattern = (before, orig, after) => new RegExp(
  (before.length ? before.map(word).join(SEP) + SEP : '') + '(' + orig.trim().split(/\s+/).map(word).join(GAP) + ')' + (after.length ? SEP + after.map(word).join(SEP) : ''), 'g');
const findAll = re => { const hits = []; for (const [resid, s] of Object.entries(texts)) { re.lastIndex = 0; let m; while ((m = re.exec(s))) { hits.push({ resid: +resid, find: m[0], orig: m[1], index: m.index }); if (!m[0].length) re.lastIndex++; } } return hits; };

const hitsByResid = new Map();   // resid -> [{ index, find, orig, fix, what }]
const unmatched = [], skipped = [], collectionSlips = [];
const seen = new Set();
for (const o of occurrences) {
  if (LEAVE.has(o.orig) || LEAVE.has(o.orig.replace(/^@/, '')) || LEAVE_IN.has(o.orig + '|' + o.file.replace(/\.txt$/, ''))) { skipped.push(o); continue; }
  if (OVERRIDE[o.orig + '|' + o.fix]) o.fix = OVERRIDE[o.orig + '|' + o.fix];
  const key = [o.before.join(' '), o.orig, o.after.join(' ')].join('|');
  if (seen.has(key)) continue;         // the same line in another branch of the same conversation
  seen.add(key);
  // With the words around it, the original first; failing that, the
  // corrected wording in the same place, which means the "original" is the
  // collection's own slip in transcribing and not the game's ("Sealed it
  // within", "quite interesting", "neutralize it"); then fewer words.
  let hits = [], slip = false;
  for (const n of [2, 1, 0]) {
    const b = n ? o.before.slice(-n) : [], a = o.after.slice(0, n);
    hits = findAll(pattern(b, o.orig, a));
    if (n === 0 && hits.length !== 1) hits = [];
    if (hits.length) break;
    if (n && findAll(pattern(b, o.fix, a)).length) { slip = true; break; }
  }
  if (slip) { collectionSlips.push(o); continue; }
  if (!hits.length) { unmatched.push(o); continue; }
  for (const h of hits) {
    const list = hitsByResid.get(h.resid) || [];
    // The words around it found the place; the edit is the word alone,
    // since the game splits its text at jump targets and a wider span can
    // cross one.
    const index = h.index + h.find.lastIndexOf(h.orig);
    if (list.some(x => x.index === index && x.find === h.orig)) continue;   // the same place, marked twice
    list.push({ index, find: h.orig, orig: h.orig, fix: o.fix.replace(/^@/, ''), what: o.orig + ' \u2192 ' + o.fix + ' (' + o.file.replace(/\.txt$/, '') + ')' });
    hitsByResid.set(h.resid, list);
  }
}
// Each hit is anchored to where it was found. Two hits whose text overlaps
// (a typo beside another, "Execellent.  I'm am looking") become one edit
// over the span of both, each misspelt word replaced at its own place.
const textEdits = [];
for (const [resid, list] of hitsByResid) {
  list.sort((a, b) => a.index - b.index);
  let i = 0;
  while (i < list.length) {
    let j = i, end = list[i].index + list[i].find.length;
    while (j + 1 < list.length && list[j + 1].index < end) { j++; end = Math.max(end, list[j].index + list[j].find.length); }
    const start = list[i].index, group = list.slice(i, j + 1);
    const text = texts[resid].slice(start, end);
    // Replace from the right so earlier positions stay true.
    const words = group.map(h => ({ at: h.index - start + h.find.lastIndexOf(h.orig), orig: h.orig, fix: h.fix })).sort((a, b) => b.at - a.at);
    let out = text;
    for (const w of words) out = out.slice(0, w.at) + w.fix + out.slice(w.at + w.orig.length);
    textEdits.push({ what: group.map(h => h.what).join(' + '), resid: +resid, at: start, find: text, replace: out, count: 1 });
    i = j + 1;
  }
}
console.log(`  ${occurrences.length} marked places in the collection, ${skipped.length} left on purpose, ${collectionSlips.length} the collection's own slips (the game has the fix already), ${textEdits.length} edits, ${unmatched.length} not found`);
for (const u of collectionSlips) console.log('  collection slip: ' + u.before.join(' ') + ' <' + u.orig + ',' + u.fix + '> ' + u.after.join(' ') + '  [' + u.file + ']');
for (const u of unmatched) console.log('  not found: ' + u.before.join(' ') + ' <' + u.orig + ',' + u.fix + '> ' + u.after.join(' ') + '  [' + u.file + ']');

const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Community Text Fixes',
  description: 'The typos the Cythera community marked in its dialogue collection (cytheraguides.com, BreadWorldMercy453 and Wizard), put into the game’s text with Grimoire.',
  edits: [], dataEdits: [], textEdits });
process.exit(ok ? 0 : 1);
