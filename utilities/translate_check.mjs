#!/usr/bin/env node
// Does the Spanish table (js/delv-es.js) make a Cythera Data that still
// works as a conversation?
//
//   node utilities/translate_check.mjs index.html "$TMPDIR/Cythera Data.data" "$TMPDIR/Cythera Data.rsrc"
//
// WHY. js/delv-translate.js replaces every piece of script text and adds
// Spanish stems to every keyword list, and the splice checks its own
// arithmetic (every jump read back where it should be). What it cannot see is
// whether the game still answers. A highlighted word is a question the
// player asks by clicking it: the program sends the word's letters, and the
// character's keyword lists are tried in order, the first whose keyword
// begins the word answering. A translated "@lazo" answers only if some list
// carries "lazo" or a stem of it, and answers the right topic only if no
// earlier list carries a stem the word also begins with. Neither shows in a
// build; both show in play as a character saying "I don't know about that".
//
// WHAT IT HOLDS.
//   1. The table covers the file: every piece of text has an entry and no
//      entry matches nothing (a stale hash is a sentence that changed under
//      it, or a typo in one).
//   2. Every script resource of the translated file disassembles as its
//      English one does, and its keyword lists are the ones the table asked
//      for, in the same order.
//   3. Every highlighted word, clicked, reaches the same answer in Spanish
//      as the English word at the same place does: the character's own
//      topic chains first, then its groups in the order its catch-all calls
//      them, as convJumpWord in the page resolves one. A highlight is taken
//      from the pieces joined where they touch, since a word can be built of
//      two ("@hero" + "ine").
//   4. No highlighted Spanish word runs into an accent: the program's "@"
//      scan takes A to Z and a to z only, so the highlight would stop there
//      and the click would say a word cut short.
//
// THE MATCH is the interpreter's: a keyword is copied to the next comma and
// compared with the start of what was said (GRIMOIRE-NOTES, "A keyword that
// needs a space typed first"), both in lower case. The page's convKwMatches
// also matches the other way round, for the four-letter stubs; that would
// hide exactly the shadowing this looks for, so it is not used here.
//
// WHAT IT CANNOT SEE. Which chain is live when a word is clicked inside a
// follow-up question: a highlight is resolved against the resource's
// top-level chains (those no response holds) and, when it sits inside a
// response that asks a follow-up, that follow-up's chain as well. Words the
// player types are not checked; nothing lists them.
//
// THE NEGATIVE CONTROL. With the Spanish stems left out of every keyword
// list, the highlighted Spanish words must stop reaching their answers:
// the check resolves them again against the English lists and requires
// that most fail. A resolver that found everything, or nothing, would not
// pass both.

import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
import {pageContext} from './patch_build.mjs';

const [htmlPath = 'index.html', dataPath, rsrcPath] = process.argv.slice(2);
const skip = why => { console.log(`  skip  ${why}`); process.exit(0); };
if (!dataPath || !existsSync(dataPath)) skip('no Cythera Data to translate');
if (!rsrcPath || !existsSync(rsrcPath)) skip("no Cythera Data resource fork");

const {sandbox, ctx} = pageContext(htmlPath, dataPath);
sandbox.__r = new Uint8Array(readFileSync(rsrcPath));
new vm.Script(readFileSync(new URL('../js/delv-es.js', import.meta.url), 'utf8'), {filename: 'js/delv-es.js'}).runInContext(ctx);

const got = vm.runInContext(`(() => {
  const T = DELV_TRANSLATION_ES;
  const t0 = Date.now();
  const r = translateCytheraData(__a, __r, T);
  const ms = Date.now() - t0;
  const en = dataPatchSession(__a), es = dataPatchSession(r.data);
  const resids = dataPatchScriptResids(en.spec).filter(x => x !== 0x0101 && x !== 0x0201);
  const hex = x => '0x' + x.toString(16).toUpperCase().padStart(4, '0');
  const lower = s => s.replace(/[A-Z]/g, c => c.toLowerCase());

  // A resource's keyword lists in order, with where each goes when it does
  // not match; and the functions that disassemble.
  const listsOf = (b, resid) => {
    dvmContextResid = resid;
    const out = [], fns = [];
    let objs; try { objs = dvmExtents(b, resid); } catch (e) { return { out, fns: null }; }
    for (const [st, en, kind] of objs) {
      if (kind !== 'function') continue;
      let d; try { d = dvmDisassemble(b.subarray(st, en), 3); } catch (e) { fns.push(null); continue; }
      fns.push(st);
      for (const op of d.ops) if (op[2] === 'conversation_response') {
        const a = op[3], cut = a.lastIndexOf(' -> 0x');
        let kw = a.slice(0, cut); try { kw = JSON.parse(kw); } catch (e) { quiet(e); }
        out.push({ at: st + op[0], next: parseInt(a.slice(cut + 6), 16), list: kw });
      }
    }
    return { out, fns };
  };

  const fails = [], notes = [];
  const byRes = new Map();
  let disasm = 0;
  for (const resid of resids) {
    const bEn = en.bytesOf(resid), bEs = es.bytesOf(resid);
    const A = listsOf(bEn, resid), B = listsOf(bEs, resid);
    if (!A.fns) continue;
    if (!B.fns || B.fns.filter(x => x === null).length !== A.fns.filter(x => x === null).length) { fails.push(hex(resid) + ': does not disassemble as the English does'); continue; }
    disasm++;
    const rep = { done: 0, keys: 0, missing: [], unused: [] };
    const places = translatePlaces(bEn, resid, T, rep);
    const placeAt = new Map(places.map(p => [p.at, p.bytes]));
    if (A.out.length !== B.out.length) { fails.push(hex(resid) + ': ' + A.out.length + ' keyword lists in English, ' + B.out.length + ' translated'); continue; }
    const kwsAt = new Map();   // English offset of a list -> the words the table asked for
    A.out.forEach((q, i) => {
      const want = placeAt.has(q.at + 1) ? placeAt.get(q.at + 1) : q.list;
      if (B.out[i].list !== want) fails.push(hex(resid) + ': keyword list ' + i + ' is ' + JSON.stringify(B.out[i].list) + ', the table asked for ' + JSON.stringify(want));
      kwsAt.set(q.at, want);
    });
    // Chains: a list's "next" is the list tried after it. A head is a list no
    // other list leads to; a top-level head is one no response holds.
    const resp = A.out.map((q, i) => ({ at: q.at, next: q.next, en: q.list.split(','), es: kwsAt.get(q.at).split(','), ord: i }));
    const byAt = new Map(resp.map(q => [q.at, q]));
    const heads = resp.filter(q => !resp.some(p => p.next === q.at));
    const holder = at => { let best = null; for (const q of resp) if (q.next > q.at && at > q.at && at < q.next && (!best || q.at > best.at)) best = q; return best; };
    const chainFrom = h => { const c = [], seen = new Set(); for (let q = h; q && !seen.has(q.at); q = byAt.get(q.next)) { seen.add(q.at); c.push(q); } return c; };
    const top = heads.filter(h => !holder(h.at)).sort((x, y) => x.at - y.at).map(chainFrom);
    const inner = heads.filter(h => holder(h.at)).map(h => ({ in: holder(h.at), chain: chainFrom(h) }));
    let groups = [];
    try { const c = dvmConversation(bEn, resid); if (c) groups = c.groups; } catch (e) { quiet(e); }
    // The English text as it is and as the table has it, pieces joined where
    // they touch.
    const { text } = dvmTextSites(bEn, resid);
    const runs = [];
    for (const u of text) {
      if (u.kind === 'prompt') continue;
      const esText = placeAt.has(u.at) ? placeAt.get(u.at) : u.text;
      const last = runs[runs.length - 1];
      if (last && last.end === u.at) { last.en += u.text; last.es += esText; last.end = u.at + u.len; }
      else runs.push({ at: u.at, end: u.at + u.len, en: u.text, es: esText });
    }
    byRes.set(resid, { top, inner, groups, runs, holder });
  }

  // The first list along a chain whose keyword begins the word.
  const matchIn = (chain, word, side) => {
    // A one-letter keyword is the 'y' or 'n' of a question mygetch asks
    // with its own buttons; a click never means one.
    for (const q of chain) for (const k of q[side]) if (k.length > 1 && k !== '*' && word.startsWith(lower(k))) return q.ord;
    return null;
  };
  const resolve = (resid, word, at, side) => {
    const R = byRes.get(resid); if (!R) return null;
    const h = at !== null ? R.holder(at) : null;
    if (h) for (const c of R.inner) if (c.in === h) { const m = matchIn(c.chain, word, side); if (m !== null) return hex(resid) + '#' + m + ' (follow-up)'; }
    for (const c of R.top) { const m = matchIn(c, word, side); if (m !== null) return hex(resid) + '#' + m; }
    for (const g of R.groups) { const G = byRes.get(g); if (!G) continue; for (const c of G.top) { const m = matchIn(c, word, side); if (m !== null) return hex(g) + '#' + m; } }
    return null;
  };

  let words = 0, reached = 0, control = 0;
  const HL = /@([A-Za-z]+)/g;
  for (const [resid, R] of byRes) {
    if (!R.top.length && !R.groups.length) continue;
    for (const run of R.runs) {
      const a = [...run.en.matchAll(HL)], b = [...run.es.matchAll(HL)];
      if (run.es === run.en) continue;
      for (const m of b) { const after = run.es.charCodeAt(m.index + m[0].length); if (after >= 1 && after <= 0x13) fails.push(hex(resid) + ': the highlight "@' + m[1] + '" runs into an accent (' + JSON.stringify(run.es.slice(m.index, m.index + 30)) + ')'); }
      if (!a.length && !b.length) continue;
      if (a.length !== b.length) { fails.push(hex(resid) + ' at ' + hex(run.at) + ': ' + a.length + ' highlights in English, ' + b.length + ' translated (' + a.map(m => m[1]).join(' ') + ' / ' + b.map(m => m[1]).join(' ') + ')'); continue; }
      // Spanish may put a run's words in another order ("mina de hierro"
      // for "iron mine"), so the run's answers are compared as a set.
      const at = run.at + a[0].index;
      const wantAll = a.map(m => resolve(resid, lower(m[1]), at, 'en'));
      const gotAll = b.map(m => resolve(resid, lower(m[1]), at, 'es'));
      const key = xs => xs.map(x => x || 'nothing').sort().join(' ');
      words += a.length;
      // A highlight the English leaves unanswered (the vineyard's "viny" is
      // not how "Vineyard" begins) and the Spanish answers is said, not
      // failed: there is no English answer for it to differ from. So every
      // English answer must be among the Spanish ones, and what is left over
      // is where the English reached nothing.
      const left = gotAll.slice();
      const kept = wantAll.every(w => { if (w === null) return true; const i = left.indexOf(w); if (i < 0) return false; left.splice(i, 1); return true; });
      if (key(wantAll) === key(gotAll)) reached += a.length;
      else if (kept && left.filter(x => x !== null).length <= wantAll.filter(x => x === null).length) notes.push(hex(resid) + ': ' + b.map((m, i) => '"@' + m[1] + '" reaches ' + (gotAll[i] || 'nothing')).join(', ') + ', where ' + a.map((m, i) => '"@' + m[1] + '" reaches ' + (wantAll[i] || 'nothing')).join(', '));
      else fails.push(hex(resid) + ': ' + a.map((m, i) => '"@' + m[1] + '" reaches ' + (wantAll[i] || 'nothing')).join(', ') + '; ' + b.map((m, i) => '"@' + m[1] + '" reaches ' + (gotAll[i] || 'nothing')).join(', '));
      // The control: the Spanish words against the English lists alone.
      b.forEach((m, i) => { if (wantAll[i] !== null && resolve(resid, lower(m[1]), at, 'en') !== wantAll[i]) control++; });
    }
  }

  // The face: every code the text uses has a glyph that is not the English
  // face's missing-glyph box.
  let fontNote = '';
  try {
    const f = r.log.find(l => /^sfnt /.test(l)); fontNote = f || 'no sfnt changed';
  } catch (e) { quiet(e); }

  const hash = (() => { let h = 0x811C9DC5; for (const part of [r.data, r.rsrc]) for (const c of part) { h ^= c; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); })();
  return { ms, fails, notes, words, reached, control, disasm, hash, fontNote,
           done: r.report.done, keys: r.report.keys, missing: r.report.missing.length, unused: r.report.unused.map(u => (typeof u.resid === 'number' ? hex(u.resid) : u.resid) + ' ' + u.hash) };
})()`, ctx);

let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);

if (got.missing) fail('coverage', `${got.missing} pieces have no entry (utilities/translate_build.mjs --missing lists them)`);
else ok('coverage', `${got.done} pieces and ${got.keys} keyword lists, built in ${got.ms} ms`);
if (got.unused.length) fail('stale entries', got.unused.join(', '));
else ok('stale entries', 'none');
ok('disassembly', `${got.disasm} script resources`);
ok('face', got.fontNote);
for (const f of got.fails) fail('conversation', f);
for (const n of got.notes) console.log('  note ' + n);
if (!got.fails.length) ok('highlights', `${got.reached} of ${got.words} highlighted words reach the English word's answer`);
// Most highlighted words are not their English spelling, so without the
// stems they must mostly miss.
if (got.control < got.words / 2) fail('negative control', `only ${got.control} of ${got.words} highlighted words stop reaching their answer without the Spanish stems`);
else ok('negative control', `${got.control} of ${got.words} miss without the Spanish stems`);

console.log(`\n  ${got.reached} of ${got.words} highlighted words answer as in English; ${got.missing} pieces untranslated; SPANISH ${got.hash}`);
process.exit(failures ? 1 : 0);
