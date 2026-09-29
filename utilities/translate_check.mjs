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
//   5. Argos's family width table gives each added letter its base letter's
//      width, where the shipped table gives none; and the Geneva strikes
//      (js/mac-geneva.js) measure as Geneva does at 9 and 10 points and draw
//      the Geneva 9 font's own letters, where the font's own widths are not
//      Geneva 10's (the control).
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

const [htmlPath = 'index.html', dataPath, rsrcPath, appDataPath, appRsrcPath] = process.argv.slice(2);
const skip = why => { console.log(`  skip  ${why}`); process.exit(0); };
if (!dataPath || !existsSync(dataPath)) skip('no Cythera Data to translate');
if (!rsrcPath || !existsSync(rsrcPath)) skip("no Cythera Data resource fork");

const {sandbox, ctx} = pageContext(htmlPath, dataPath);
sandbox.__r = new Uint8Array(readFileSync(rsrcPath));
for (const f of ['js/mac-geneva.js', 'js/delv-es.js']) new vm.Script(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), {filename: f}).runInContext(ctx);

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

  // The family widths: Argos's FOND gives each added letter the width of
  // the letter it is made from (the glyphs keep their base's advance), and
  // the shipped FOND has none at those codes, which is the control: that is
  // the table that measured every accent as nothing and ran lines past the
  // conversation box.
  const widthsOf = rs => {
    const sp = resourceForkSpec(openResourceFork(rs)), fo = sp.resources.find(x => x.type === 'FOND' && x.id === 1046);
    if (!fo) return null;
    const d = fo.data, w = u32be(d, 16), first = u16be(d, 4);
    return c => u16be(d, w + 4 + (c - first) * 2);
  };
  const BASE = { 'á': 'a', 'é': 'e', 'í': 'i', 'ó': 'o', 'ú': 'u', 'ñ': 'n', 'ü': 'u', '¿': '?', '¡': '!', 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N', 'Ü': 'U' };
  const wEn = widthsOf(__r), wEs = widthsOf(r.rsrc);
  const widthFails = [];
  let widthControl = 0;
  for (const [ch, base] of Object.entries(BASE)) {
    const want = wEn(base.charCodeAt(0));
    for (const code of [TRANSLATE_CODES[ch], TRANSLATE_MACROMAN[ch]]) {
      if (wEs(code) !== want) widthFails.push(ch + ' at ' + code + ' is ' + wEs(code) + ', ' + base + ' is ' + want);
      if (wEn(code) !== want) widthControl++;
    }
  }

  // The Geneva strikes: each measures as Geneva does at its size (the
  // printable ASCII advances GENEVA_METRICS gives, an accented letter its
  // plain letter's, the frame ten above and two below with the leading),
  // and draws Geneva 9's own letters, its pixels moved and never changed.
  // The control is the font's own widths, which are not Geneva 10's, so a
  // strike that kept them would fail here.
  const S = T.strikes, outSpec = resourceForkSpec(openResourceFork(r.rsrc));
  const strikeFails = [];
  const ttf = geneva9Bytes(), outl = sfntGlyphOutlines(ttf), gmap = sfntMacRomanGlyphs(ttf), unit = outl.upem / 16;
  const key = px => { if (!px.length) return ''; const x0 = Math.min(...px.map(q => q[0])); return px.map(([x, y]) => (x - x0) + ',' + y).sort().join(' '); };
  const drawn = (f, c) => {
    const px = [], row = f.rowWords * 2, g = c - f.firstChar, off = (f.ow[g] >> 8) + f.kernMax;
    for (let y = 0; y < f.fRectHeight; y++) for (let x = f.loc[g]; x < f.loc[g + 1]; x++)
      if ((f.strike[y * row + (x >> 3)] >> (7 - (x & 7))) & 1) px.push([off + x - f.loc[g], f.ascent - 1 - y]);
    return px;
  };
  let strikeControl = 0, strikeGlyphs = 0;
  for (const size of Object.keys(S.nfnt).map(Number)) {
    const res = outSpec.resources.find(x => x.type === 'NFNT' && x.id === S.nfnt[size]);
    if (!res) { strikeFails.push('no NFNT ' + S.nfnt[size]); continue; }
    const f = nfntSpec(res.data), M = GENEVA_METRICS[size];
    if (f.ascent !== M.ascent || f.descent !== M.descent || f.leading !== M.leading || f.fRectHeight !== M.ascent + M.descent)
      strikeFails.push(size + ' pt: the frame is ' + [f.ascent, f.descent, f.leading, f.fRectHeight].join('/'));
    for (let c = 0x20; c < 0x7F; c++) {
      const adv = f.ow[c - f.firstChar] & 0xFF, own = Math.round(outl.glyphs[gmap[c]].adv / unit);
      if (adv !== M.adv[c - 0x20]) strikeFails.push(size + ' pt ' + JSON.stringify(String.fromCharCode(c)) + ' is ' + adv + ' wide, Geneva ' + M.adv[c - 0x20]);
      if (own !== M.adv[c - 0x20]) strikeControl++;
      if (key(drawn(f, c)) !== key(sfntPixels(outl.glyphs[gmap[c]], unit))) strikeFails.push(size + ' pt ' + JSON.stringify(String.fromCharCode(c)) + " is not the font's own letter");
      strikeGlyphs++;
    }
    for (const [ch, base] of Object.entries(BASE)) for (const code of [TRANSLATE_CODES[ch], TRANSLATE_MACROMAN[ch]]) {
      const adv = f.ow[code - f.firstChar] & 0xFF, want = M.adv[base.charCodeAt(0) - 0x20];
      if (adv !== want) strikeFails.push(size + ' pt ' + ch + ' at ' + code + ' is ' + adv + ' wide, ' + base + ' is ' + want);
    }
  }
  for (const id of S.styles) {
    const t = outSpec.resources.find(x => x.type === 'TxSt' && x.id === id);
    if (!t || decodeMacRoman(t.data.subarray(3, 3 + t.data[2])) !== S.name) strikeFails.push('TxSt ' + id + ' is not in ' + S.name);
  }

  const hash = (() => { let h = 0x811C9DC5; for (const part of [r.data, r.rsrc]) for (const c of part) { h ^= c; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); })();
  return { ms, fails, notes, words, reached, control, disasm, hash, fontNote, widthFails, widthControl, strikeFails, strikeControl, strikeGlyphs,
           done: r.report.done, keys: r.report.keys, missing: r.report.missing.length, unused: r.report.unused.map(u => (typeof u.resid === 'number' ? hex(u.resid) : u.resid) + ' ' + u.hash) };
})()`, ctx);

// THE PROGRAM, when its forks are given: translateProgram's result held to
// what it is for. (6) Nothing the table has not decided is left: a string
// the program pools, or a piece of a menu, dialog, window, string list or
// TEXT. (7) Every load of every pooled string reaches the text it should:
// followed through the branch a moved string's load became and the
// addis/addi (or addic) after it, to the string there, which is the
// Spanish, or the English where the table keeps it, or the piece of a
// string whose tail is pointed at; the control is the English program, in
// which no load reaches the Spanish. (8) The resources keep their shape:
// each menu its items and their command keys, each dialog its items and
// their kinds, each dialog's keys as many groups, each string list its
// count, each TEXT its style runs, ending where the text does. (9) With
// the program translated the names carry their articles: every name
// record's singular begins with the article its tiles' class and its
// gender call for, and no plural carries the no-break space; the control
// is the data file written alone, whose names have none.
let prog = null;
if (appDataPath && existsSync(appDataPath) && appRsrcPath && existsSync(appRsrcPath)) {
  sandbox.__pd = new Uint8Array(readFileSync(appDataPath));
  sandbox.__pr = new Uint8Array(readFileSync(appRsrcPath));
  prog = vm.runInContext(`(() => {
    const T = DELV_TRANSLATION_ES, P = T.program;
    const p = translateProgram(__pd, __pr, T);
    const bin = x => { let s = ''; for (const c of x) s += String.fromCharCode(c); return s; };
    const fails = [];
    // (7) the loads
    const a = pefLoad(__pd), b = pefLoad(p.data), ca = a.contents[0].bytes, cb = b.contents[0].bytes, toc = a.toc.offset;
    const readAt = (code, at, pascal) => pascal ? code.subarray(at + 1, at + 1 + code[at]) : (() => { let e = at; while (code[e]) e++; return code.subarray(at, e); })();
    const follow = (img, code, site) => {
      let w = pefU32(code, site), extra = 0;
      if ((w & 0xFC000000) === 0x48000000) {
        const t = site + (((w & 0x03FFFFFC) << 6) >> 6);
        w = pefU32(code, t);
        for (let k = t + 4; ; k += 4) { const x = pefU32(code, k), op = x >>> 26; if (op === 15) extra += ((x << 16) >> 16) << 16; else if (op === 14 || op === 12) extra += (x << 16) >> 16; else break; }
      }
      if ((w >>> 26) !== 32 || ((w >>> 16) & 31) !== 2) return null;
      const q = pefPointerAt(img, img.toc.section, toc + ((w << 16) >> 16));
      return q ? q.offset + extra : null;
    };
    const pooled = appPooledStrings(__pd);
    const want = new Map();       // code address -> { text, pascal }
    for (const q of pooled) {
      const en = bin(q.bytes), sec = q.pascal ? P.P : P.C, got = sec && sec[translateHash(en)];
      const pieces = got === undefined || got === '=' ? null : (Array.isArray(got) ? got : [got]);
      if (!pieces) { if (!want.has(q.at)) want.set(q.at, { text: en, pascal: q.pascal, es: false }); continue; }
      const offs = [0].concat(q.inner);
      pieces.forEach((x, k) => want.set(q.at + offs[k], { text: bin(encodeMacRoman(pieces.slice(k).join(''))), pascal: q.pascal, es: true }));
    }
    let loads = 0, spanish = 0, control = 0;
    for (let site = 0; site + 4 <= ca.length; site += 4) {
      const w = pefU32(ca, site);
      if ((w >>> 26) !== 32 || ((w >>> 16) & 31) !== 2) continue;
      const q = pefPointerAt(a, a.toc.section, toc + ((w << 16) >> 16));
      if (!q || !want.has(q.offset)) continue;
      const wnt = want.get(q.offset); loads++;
      const to = follow(b, cb, site), s = to === null ? null : bin(readAt(cb, to, wnt.pascal));
      if (s !== wnt.text) fails.push('the load at 0x' + site.toString(16) + ' reaches ' + JSON.stringify(s) + ', not ' + JSON.stringify(wnt.text));
      else if (wnt.es) spanish++;
      if (wnt.es && bin(readAt(ca, q.offset, wnt.pascal)) === wnt.text) control++;
    }
    // (8) the resources' shapes
    const specA = resourceForkSpec(openResourceFork(__pr)), specB = resourceForkSpec(openResourceFork(p.rsrc));
    const res = (spec, t, id) => spec.resources.find(r => r.type === t && r.id === id);
    const menuShape = d => { const out = []; let o = 14; o += 1 + d[o]; while (o < d.length && d[o]) { o += 1 + d[o]; out.push(d[o + 1]); o += 4; } return out.join(','); };
    const ditlShape = d => { const n = u16be(d, 0) + 1, out = []; let o = 2; for (let k = 0; k < n; k++) { const L = d[o + 13]; out.push(d[o + 12]); o += 14 + L + (L & 1); } return out.join(','); };
    let shapes = 0;
    for (const ra of specA.resources) {
      const rb = res(specB, ra.type, ra.id); if (!rb) { fails.push(ra.type + ' ' + ra.id + ' is gone'); continue; }
      let x = null, y = null;
      if (ra.type === 'MENU') { x = menuShape(ra.data); y = menuShape(rb.data); }
      else if (ra.type === 'DITL') { x = ditlShape(ra.data); y = ditlShape(rb.data); }
      else if (ra.type === 'STR#') { x = u16be(ra.data, 0); y = u16be(rb.data, 0); }
      else if (ra.type === 'DLOG') { const g = d => (bin(d.subarray(21, 21 + d[20])).match(/;/g) || []).length; x = g(ra.data); y = g(rb.data); }
      else if (ra.type === 'styl') { const t = res(specB, 'TEXT', ra.id), n = u16be(rb.data, 0); x = u16be(ra.data, 0); y = n; if (t && n && pefU32(rb.data, 2 + 20 * (n - 1)) >= t.data.length) fails.push('styl ' + ra.id + ': its last run starts past its text'); }
      else continue;
      shapes++;
      if (x !== y) fails.push(ra.type + ' ' + ra.id + ' was ' + JSON.stringify(x) + ' and is ' + JSON.stringify(y));
    }
    // (9) the articles
    const art = translateCytheraData(__a, __r, T, { articles: true }), bare = translateCytheraData(__a, __r, T);
    const names = d => { const b = dataPatchSession(d).bytesOf(0xF004), out = []; let i = 0, prev = -1; while (i + 3 <= b.length) { const id = u16be(b, i); let e = i + 2; while (e < b.length && b[e]) e++; if (id < prev) break; out.push({ id, name: String.fromCharCode.apply(null, b.subarray(i + 2, e)) }); prev = id; i = e + 1; } return out; };
    const attrs = dataPatchSession(__a).bytesOf(0xF002), cls = t => (u32be(attrs, t * 4) >>> 22) & 3;
    const nb = String.fromCharCode(TRANSLATE_NBSP);
    let withArt = 0, prev = -1;
    const enNames = new Map(names(__a).map(r => [r.id, r.name]));
    const enFor = id => { let best = null; for (const [k, v] of enNames) if (k >= id && (best === null || k < best)) best = k; return enNames.get(best); };
    for (const r of names(art.data)) {
      const one = translateSingPlur(r.name, true), more = translateSingPlur(r.name, false);
      if (more.includes(nb)) fails.push('the plural of tile ' + r.id + ' carries the no-break space');
      const g = T.tileGenders[translateHash(enFor(r.id))], c = cls(r.id) === 2 ? 1 : cls(r.id);
      if (!g || !c) { if (one.includes(nb)) fails.push('tile ' + r.id + ' has an article English does not give it'); prev = r.id; continue; }
      const a2 = TRANSLATE_ARTICLES[c][g] + nb;
      if (!one.startsWith(a2)) fails.push('tile ' + r.id + ' says ' + JSON.stringify(one) + ', not ' + JSON.stringify(a2) + '...');
      else withArt++;
      prev = r.id;
    }
    const bareArt = names(bare.data).filter(r => r.name.includes(nb)).length;
    return { fails, loads, spanish, control, shapes, withArt, bareArt, done: p.report.done, missing: p.report.missing.map(m => m.resid + ' ' + m.hash), moved: p.log.join(' ') };
  })()`, ctx);
}

let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);

if (got.missing) fail('coverage', `${got.missing} pieces have no entry (utilities/translate_build.mjs --missing lists them)`);
else ok('coverage', `${got.done} pieces and ${got.keys} keyword lists, built in ${got.ms} ms`);
if (got.unused.length) fail('stale entries', got.unused.join(', '));
else ok('stale entries', 'none');
ok('disassembly', `${got.disasm} script resources`);
ok('face', got.fontNote);
if (got.widthFails.length) fail('family widths', got.widthFails.join('; '));
else if (got.widthControl !== 32) fail('family widths', 'the shipped FOND already has the width at ' + (32 - got.widthControl) + ' of the 32 codes, so the control proves nothing');
else ok('family widths', 'the 16 letters at their 32 codes take their base letter\'s width; the shipped table has none of them');
if (got.strikeFails.length) fail('Geneva strikes', got.strikeFails.slice(0, 12).join('; '));
else if (!got.strikeControl) fail('Geneva strikes', "the font's own widths are already Geneva's, so the control proves nothing");
else ok('Geneva strikes', `${got.strikeGlyphs} ASCII glyphs at Geneva's widths and frame, each the font's own letter, the accents at their letters' widths; the font's own widths differ at ${got.strikeControl}`);
for (const f of got.fails) fail('conversation', f);
for (const n of got.notes) console.log('  note ' + n);
if (!got.fails.length) ok('highlights', `${got.reached} of ${got.words} highlighted words reach the English word's answer`);
// Most highlighted words are not their English spelling, so without the
// stems they must mostly miss.
if (got.control < got.words / 2) fail('negative control', `only ${got.control} of ${got.words} highlighted words stop reaching their answer without the Spanish stems`);
else ok('negative control', `${got.control} of ${got.words} miss without the Spanish stems`);

if (prog) {
  if (prog.missing.length) fail('program coverage', prog.missing.length + ' pieces of the program have no entry: ' + prog.missing.slice(0, 8).join(', '));
  else ok('program coverage', prog.done + ' pieces of the program decided');
  for (const f of prog.fails.slice(0, 20)) fail('program', f);
  if (!prog.fails.length) ok('program', `${prog.loads} loads of its strings followed, ${prog.spanish} reaching the Spanish; ${prog.shapes} resources keep their shape; ${prog.withArt} names carry their article`);
  if (prog.control) fail('program control', prog.control + ' loads reach the Spanish in the English program');
  else if (!prog.spanish) fail('program control', 'no load reaches the Spanish, so the control proves nothing');
  else ok('program control', 'no load reaches the Spanish in the English program');
  if (prog.bareArt) fail('articles control', prog.bareArt + ' names carry an article in the data file written alone');
  else ok('articles control', 'the data file written alone has no article in a name');
}
console.log(`\n  ${got.reached} of ${got.words} highlighted words answer as in English; ${got.missing} pieces untranslated; SPANISH ${got.hash}` + (prog ? `; the program ${prog.spanish} loads in Spanish` : ''));
process.exit(failures ? 1 : 0);
