#!/usr/bin/env node
/* A builder, not a check: the typos the community marked in its own
   dialogue collection, as one Magpie patch, "Cythera Community Text Fixes".
   (24 September 2026, at the maintainer's word.)

   Usage: node utilities/community_text_patch.mjs index.html "<Cythera Data.data>" <collection dir> <out dir>
          node utilities/community_text_patch.mjs --write-js index.html <collection dir>

   The collection (cytheraguides.com's dialogue set, collected in play by
   BreadWorldMercy453 and reformatted by Wizard; in the reference under
   community/guides-site/dialogue/Dialogue) marks each typo as
   <original,fix>. This reads every pair out of every file, with the two
   words before it and the two after in the game's own wording (every other
   pair on the line put back to its original, the collection's own notation
   taken out), and hands them to dataFixCommunityTypoEdits in
   js/delv-datafixes.js, which finds each in the game's text and says why
   some are left; that is the stage "community-text", and its reasoning is
   there since 28 September 2026.

   --write-js writes what it read into js/delv-datafixes.js as
   DATA_FIX_COMMUNITY_TYPOS, between its two markers, which is how the page
   has the list without the collection; utilities/data_fix_check.mjs fails
   when the two part. The files are read in name order, so the list is the
   same on every machine. */
import {readdirSync, readFileSync, writeFileSync, statSync} from 'node:fs';
import {join, dirname} from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {buildFixes, everyFix, pageContext} from './patch_build.mjs';

// Every pair in the collection: [file, original, fix, two words before, two after].
export function readCollection(collDir) {
  const files = [];
  (function walk(d) { for (const f of readdirSync(d).sort()) { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith('.txt')) files.push(p); } })(collDir);
  const PAIR = /<([^<>]{1,60}),([^<>]{1,60})>/g;
  const out = [];
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
        out.push([f.split('/').pop().replace(/\.txt$/, ''), p.orig, p.fix, before.join(' '), after.join(' ')]);
      }
    }
  }
  return out;
}

const BEGIN = '// @@COMMUNITY-TYPOS-BEGIN', END = '// @@COMMUNITY-TYPOS-END';
export function typosAsJs(typos) {
  return BEGIN + '\nconst DATA_FIX_COMMUNITY_TYPOS = [\n' + typos.map(t => '  ' + JSON.stringify(t) + ',').join('\n') + '\n];\n' + END;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (process.argv[2] === '--write-js') {
    const [htmlPath = 'index.html', collDir] = process.argv.slice(3);
    if (!collDir) { console.error('usage: community_text_patch.mjs --write-js index.html <collection dir>'); process.exit(2); }
    const typos = readCollection(collDir);
    const js = join(dirname(htmlPath), 'js/delv-datafixes.js');
    const src = readFileSync(js, 'utf8');
    const a = src.indexOf(BEGIN), b = src.indexOf(END);
    if (a < 0 || b < a) { console.error('the markers are not in ' + js); process.exit(1); }
    writeFileSync(js, src.slice(0, a) + typosAsJs(typos) + src.slice(b + END.length));
    console.log('  ' + typos.length + ' pairs written into ' + js);
    process.exit(0);
  }
  const [htmlPath = 'index.html', dataPath, collDir, outDir] = process.argv.slice(2);
  if (!dataPath || !collDir || !outDir) { console.error('usage: community_text_patch.mjs index.html <Cythera Data.data> <collection dir> <out dir>'); process.exit(2); }
  const typos = readCollection(collDir);
  // What the search makes of them on this file, said before the build.
  const {ctx} = pageContext(htmlPath, dataPath);
  const r = JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const s = dataPatchSession(__a);
    const r = dataFixCommunityTypoEdits(dataPatchTexts(s), ${JSON.stringify(typos)}, 'us');
    return { occurrences: r.occurrences, skipped: r.skipped.length, slips: r.slips, unmatched: r.unmatched, edits: r.textEdits.length };
  })())`, ctx));
  console.log(`  ${r.occurrences} marked places in the collection, ${r.skipped} left on purpose, ${r.slips.length} the collection's own slips (the game has the fix already), ${r.edits} edits, ${r.unmatched.length} not found`);
  for (const u of r.slips) console.log('  collection slip: ' + u.before.join(' ') + ' <' + u.orig + ',' + u.fix + '> ' + u.after.join(' ') + '  [' + u.file + '.txt]');
  for (const u of r.unmatched) console.log('  not found: ' + u.before.join(' ') + ' <' + u.orig + ',' + u.fix + '> ' + u.after.join(' ') + '  [' + u.file + '.txt]');
  const ok = buildFixes({ htmlPath, dataPath, outDir, name: 'Cythera Community Text Fixes',
    description: 'The typos the Cythera community marked in its dialogue collection (cytheraguides.com, BreadWorldMercy453 and Wizard), put into the game’s text with Grimoire.',
    ids: everyFix(htmlPath, 'us'), stages: ['community-text'], communityTypos: typos });
  process.exit(ok ? 0 : 1);
}
