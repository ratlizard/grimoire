#!/usr/bin/env node
// Does the conversation extractor read out of the code what the community
// verified in play?
//
//   node utilities/dialogue_check.mjs explorer.html "$TMPDIR/Cythera Data.data" \
//        [reference/www_cytheraguides_com/dialogue/Dialogue]
//
// dvmConversation (js/delv-script.js) claims to turn a dialogue script's
// conversation_response chain into topics, responses and an inheritance
// chain. Two kinds of proof:
//
// STRUCTURAL, always run: the shipped archive must yield conversations for
// at least 100 of the 121 characters and at least 1,000 topics in total;
// Naxos's chain must be exactly House Comana -> Cademia -> Human (the
// community's canonical multiple-inheritance test case, forum t1654); most
// chains must end at the Human archetype 0x801 and the Seldane's at their
// own root 0x80F ("the Seldane have a differently-rooted tree").
//
// AGAINST THE ORACLE, when the collection is present: cytheraguides.com's
// dialogue set was collected IN PLAY, character by character, by
// BreadWorldMercy453, then proofread and verified -- it is independent of
// this repository's decoding in exactly the way delvmod is for the archive
// format, which makes it the one available ground truth for dialogue.
// Two comparisons:
//   * every character file opens with "% Name responds to generic A, B and
//     C prompts.%" -- those affiliations must match the call_resource chain
//     our extractor reads out of the character's "*" entry;
//   * for a sample of every character's extracted responses, the collection
//     must contain the same text (normalized: the oracle carries markup --
//     <typo,fix> pairs where the game's original is the first variant,
//     @keyword marks, #action# fences -- and we strip everything down to
//     lowercase alphanumerics before comparing).
//
// The oracle directory is gitignored (it is not ours to publish), so a
// checkout without it runs the structural half and says so -- that is a
// pass, not a skip, because the structural half alone still proves the
// extractor against the archive.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { makeSandbox } from './dom_stub.mjs';
import { pageSource } from './page_scripts.mjs';

const [htmlPath = 'explorer.html', dataPath, oracleDir =
  'reference/www_cytheraguides_com/dialogue/Dialogue'] = process.argv.slice(2);

let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };

const { sandbox } = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), { filename: htmlPath }).runInContext(ctx);
sandbox.__archive = new Uint8Array(readFileSync(dataPath));
vm.runInContext('parseArchiveBytes(__archive, {name:"Cythera Data"})', ctx);
const ev = code => vm.runInContext(code, ctx);

// ---- extract every conversation --------------------------------------------
const chars = ev(`(() => {
  const out = {};
  for (let n = 1; n < 0x100; n++) {
    const rid = 0x1800 | n;
    let raw; try { raw = getResourceBytes(rid); } catch (e) { continue; }
    if (!raw) continue;
    const c = dvmConversation(smartDecrypt(raw, rid).data, rid);
    if (!c) continue;
    const texts = [];
    const walk = list => { for (const e of list) { for (const t of e.text) texts.push(t.str); walk(e.sub); } };
    walk(c.entries);
    out[n] = { topics: c.entries.length, groups: c.groups, groupsAll: c.groupsAll, texts,
               name: (DVM_SYM.character[String(n)] || '').replace(/_/g, ' ') };
  }
  return out;
})()`);
const groupNames = ev('DIALOGUE_GROUP_NAMES');

const withTopics = Object.values(chars).filter(c => c.topics > 0);
const topics = withTopics.reduce((a, c) => a + c.topics, 0);
if (withTopics.length < 100) fail('coverage', `only ${withTopics.length} characters yielded topics`);
if (topics < 1000) fail('coverage', `only ${topics} topics in total`);

const naxos = chars[11];
if (!naxos || JSON.stringify(naxos.groups) !== JSON.stringify([0x804, 0x80E, 0x801]))
  fail('inheritance', 'Naxos chain is ' + JSON.stringify(naxos && naxos.groups) +
       ', expected House Comana -> Cademia -> Human');
const tails = withTopics.map(c => c.groups[c.groups.length - 1]).filter(g => g !== undefined);
if (tails.filter(t => t === 0x801).length < 80)
  fail('inheritance', 'fewer than 80 chains end at the Human archetype');
if (tails.filter(t => t === 0x80F).length < 3)
  fail('inheritance', 'the Seldane chains no longer end at their own root');

// ---- against the collection ------------------------------------------------
let oracleNote = 'oracle not present, structural checks only';
if (existsSync(oracleDir)) {
  const files = [];
  (function walk(dir) {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.txt')) files.push(p);
    }
  })(oracleDir);

  // The oracle's original-game text: <typo,fix> keeps the game's typo as the
  // first variant; @ marks a keyword; the rest of the markup is punctuation
  // the normalizer removes anyway. The typo pattern is bounded and refuses
  // newlines: the collection contains at least one unpaired '<', and an
  // unbounded match swallowed everything to the next '>' -- kilobytes of
  // corpus, several files away -- which surfaced as responses "missing" from
  // files that plainly contain them.
  const norm = s => s.toLowerCase()
    .replace(/<([^,<>\n]{0,60}),[^<>\n]{0,60}>/g, '$1')
    .replace(/[^a-z0-9]+/g, '');
  const corpus = norm(files.map(p => readFileSync(p, 'utf8')).join('\n'));

  // Response text: a sample from every character, long enough to be a real
  // sentence rather than a stock word. '*' separates alternate responses
  // inside one stored string, and the oracle records the alternates as
  // separate lines -- so split before sampling, or a needle spanning the
  // seam can never match.
  let tried = 0, hit = 0; const misses = [];
  for (const c of Object.values(chars)) {
    const parts = [];
    for (const t of c.texts) for (const p of t.split('*')) if (p.trim()) parts.push(p);
    for (const t of parts.slice(0, 6)) {
      const needle = norm(t).slice(0, 40);
      if (needle.length < 24) continue;
      tried++;
      if (corpus.includes(needle)) hit++;
      else if (misses.length < 5) misses.push(c.name + ': ' + t.slice(0, 50));
    }
  }
  if (tried < 300) fail('text', `only ${tried} response samples were comparable`);
  if (hit / tried < 0.9)
    fail('text', `${hit}/${tried} extracted responses found in the collection; first misses: ` +
         misses.join(' | '));

  // Affiliations: the header comment of each character file, against the
  // call_resource chain. Short names in the oracle, full names in the page.
  const short = { 'Comana': 'House Comana', 'Attis': 'House Attis', 'Dodona': 'House Dodona',
                  'Nicander': 'House Nicander', 'Strymon': 'House Strymon' };
  const byName = {};
  for (const c of Object.values(chars)) if (c.name) byName[c.name] = c;
  let compared = 0, agree = 0; const diffs = [];
  for (const p of files) {
    const head = readFileSync(p, 'utf8').split('\n')[0];
    const m = /^%\s*(.+?) responds to generic (.+?) prompts?\.\s*%/.exec(head);
    if (!m || m[2].includes('.')) continue;   // Demodocus's header is prose, not a list
    const c = byName[m[1]];
    if (!c || !c.topics) continue;
    const want = m[2].split(/,| and /).map(s => s.trim()).filter(Boolean)
      .map(s => short[s] || s).sort();
    // The oracle's "responds to generic X prompts" covers every generic set
    // the character can reach, catch-all or topic, so compare against
    // groupsAll. Two groups the oracle cannot list are ignored: House
    // Atussa, which has no prompts to observe in play, and the tavern-rumor
    // pool, which the oracle folds into the Bartender prompts.
    const got = (c.groupsAll || c.groups).map(g => groupNames[g] || ('0x' + g.toString(16)))
      .filter(n => n !== 'House Atussa' && n !== 'Tavern rumors').sort();
    compared++;
    if (JSON.stringify(want) === JSON.stringify(got)) agree++;
    else if (diffs.length < 5) diffs.push(`${m[1]}: oracle [${want}] vs code [${got}]`);
  }
  // Known divergence, one character: Protesilaus's Student-group call sits
  // in code the extractor does not reach, so the oracle lists Student and we
  // do not. 83/84 is therefore the expected score, not a degraded one.
  if (compared < 60) fail('affiliations', `only ${compared} characters could be compared`);
  if (agree / Math.max(compared, 1) < 0.85)
    fail('affiliations', `${agree}/${compared} chains agree; first differences: ` + diffs.join(' | '));
  oracleNote = `text ${hit}/${tried} found in the collection, affiliations ${agree}/${compared} agree`;
}

console.log(`${withTopics.length} characters, ${topics} topics; ${oracleNote}`);
if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('dialogue extraction verified');
