#!/usr/bin/env node
// Does smartDecrypt's heuristic still get the right answer when the tables
// that normally answer for it are taken away? And do third-party archives
// open at all?
//
//   node utilities/addons_check.mjs index.html "$TMPDIR/Cythera Data.data" \
//        [reference/community/addons] [unpack dir]
//
// WHY. js/delv-archive.js decides whether a resource is encrypted from three
// tables -- DELV_ENCRYPTED_SUBN, DELV_CLEAR_SUBN, DELV_CLEAR_RESID -- and
// falls back to a heuristic (all-zero detection, then container structure,
// then printable-ratio-minus-entropy) for anything they do not cover. The
// tables cover the shipped archive completely, so in normal use the fallback
// never runs, and nothing exercised it. The comment above smartDecrypt records
// what guessing wrong cost the first time; none of that was under a check.
//
// TWO ORACLES, and the first is the real one:
//
// 1. THE TABLES ARE A LABELLED CORPUS. Every resource the tables cover has a
//    known answer. Clearing the tables inside the sandbox forces the same
//    smartDecrypt through its fallback, and its verdict can be compared with
//    the answer the tables would have given. That is a direct measurement of
//    the heuristic against ground truth, over thousands of resources, and it
//    is the only one available -- delvmod documents the same tables rather
//    than deriving them.
//
// 2. THIRD-PARTY ARCHIVES OPEN AND ROUND-TRIP. The add-ons are the only
//    Cythera archives here that nobody in this project made. Each must be
//    recognised by describeDelverArchive -- the page's own gate, which
//    refused all seven until September 2026 because it counted subindexes
//    and a saved game has six -- and must survive delverArchiveSpec ->
//    writeDelverArchive with every resource intact. The same walk is the
//    negative corpus: every file in the add-ons that is NOT an archive (the
//    patcher applications, a TEXT file, JPEGs, an .rtf) must be refused, or
//    the gate has been loosened into accepting junk.
//
//    Note what that does NOT prove. The cipher is an XOR keystream, so it is
//    an involution: a resource wrongly judged encrypted is decrypted on read
//    and re-encrypted on write, and comes back byte-identical anyway. The
//    round trip proves the container, the master index and the writer on
//    unfamiliar input. It says nothing about the verdicts. Only oracle 1 does.
//
// The add-ons are .sit, .sitx, .sea, .zip and .hqx, which need `unar`; without
// it this check does oracle 1 alone and says so. That is still the half that
// tests the heuristic.

import {readFileSync, existsSync, readdirSync, statSync, mkdirSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', dataPath,
       addonDir = 'reference/community/addons',
       unpackDir = join(process.env.TMPDIR || '/tmp', 'cythera_addons')] = process.argv.slice(2);

let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);

const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);

// ---- oracle 1: the heuristic against the tables -----------------------------
// The verdicts with the tables in place, then the verdicts with them emptied.
// Both come from the same smartDecrypt, so this measures the shipped code
// rather than a copy of its reasoning.
function verdicts(bytes, withTables) {
  sandbox.__a = bytes;
  return ev(`(() => {
    const saved = [[...DELV_CLEAR_RESID], [...DELV_CLEAR_SUBN], [...DELV_ENCRYPTED_SUBN]];
    if (!${withTables}) { DELV_CLEAR_RESID.clear(); DELV_CLEAR_SUBN.clear(); DELV_ENCRYPTED_SUBN.clear(); }
    const out = [];
    try {
      const mi = delverMasterIndexExtent(__a);
      if (mi) for (let subn = 0; subn < mi.count; subn++) {
        const p0 = mi.first + subn * 8;
        const subOff = u32be(__a, p0), subLen = u32be(__a, p0 + 4);
        if (!subOff || subOff + subLen > __a.length) continue;
        const nmax = Math.min(256, Math.floor(subLen / 8));
        for (let n = 0; n < nmax; n++) {
          const p = subOff + n * 8;
          const roff = u32be(__a, p), rlen = u32be(__a, p + 4);
          if (!roff || !rlen || roff + rlen > __a.length) continue;
          const resid = (subn + 1) * 0x100 + n;
          const d = smartDecrypt(__a.slice(roff, roff + rlen), resid);
          out.push([resid, !!d.wasDecrypted, !!d.known, d.allZero ? 'zero' :
                    d.byStructure ? 'structure' : d.exempt ? 'exempt' : 'score']);
        }
      }
    } finally {
      for (const v of saved[0]) DELV_CLEAR_RESID.add(v);
      for (const v of saved[1]) DELV_CLEAR_SUBN.add(v);
      for (const v of saved[2]) DELV_ENCRYPTED_SUBN.add(v);
    }
    return out;
  })()`);
}

function scoreHeuristic(label, bytes) {
  const truth = verdicts(bytes, true);
  const guess = verdicts(bytes, false);
  if (!truth.length) return null;
  const byId = new Map(guess.map(g => [g[0], g]));
  let known = 0, agree = 0, ways = {zero: 0, structure: 0, score: 0};
  const byWay = {zero: {n: 0, agree: 0}, structure: {n: 0, agree: 0}, score: {n: 0, agree: 0}};
  const wrong = [];
  for (const [resid, wasDec, isKnown] of truth) {
    if (!isKnown) continue;
    const g = byId.get(resid);
    if (!g) continue;
    known++;
    ways[g[3]] = (ways[g[3]] || 0) + 1;
    const w = byWay[g[3]] || (byWay[g[3]] = {n: 0, agree: 0});
    w.n++;
    if (g[1] === wasDec) { agree++; w.agree++; } else wrong.push(resid);
  }
  const pct = known ? (100 * agree / known) : 0;
  console.log(`  ${label}: ${agree}/${known} agree (${pct.toFixed(1)}%)  ` +
    `[all-zero ${ways.zero}, structure ${ways.structure}, score ${ways.score}]`);
  console.log(`      by path: ` + ['zero','structure','score'].map(k =>
    `${k} ${byWay[k].agree}/${byWay[k].n}`).join(', '));
  return {known, agree, pct, wrong, byWay};
}

// ---- the shipped archive ----------------------------------------------------
let shipped = null;
if (dataPath && existsSync(dataPath)) {
  shipped = scoreHeuristic('shipped archive', new Uint8Array(readFileSync(dataPath)));
  if (!shipped) fail('the shipped archive', 'no resources enumerated');
} else {
  console.log('  (no shipped archive given; the labelled-corpus half is skipped)');
}

// The recorded floor, set from what the heuristic actually scores today:
// 62.5% over 1,558 labelled resources. It is not a target, it is a baseline.
// What matters is that it does not get WORSE -- a change to the scoring, the
// container test or the named-script test that drops this number has made
// modded archives read worse, silently, and nothing else would say so.
//
// The breakdown is the interesting part and is printed on every run. As of
// 3 September 2026: the structure test gets 840 of 920 right (91%), and the
// score test -- printable ratio minus entropy -- gets 130 of 635 (20%), which
// is worse than deciding at random. Anything that widens the structure test's
// reach at the score test's expense should move this number up a lot.
const FLOOR = 62.0;
if (shipped) {
  if (shipped.pct >= FLOOR)
    ok(`the heuristic agrees with the tables on at least ${FLOOR}% of the shipped archive`,
       `${shipped.pct.toFixed(1)}%, ${shipped.wrong.length} disagreements`);
  else
    fail('the heuristic against the tables',
         `${shipped.pct.toFixed(1)}% agreement, below the recorded ${FLOOR}% floor; ` +
         `first disagreements: ${shipped.wrong.slice(0, 8).map(r => '0x' + r.toString(16).padStart(4, '0')).join(', ')}`);
}

// ---- oracle 2: the add-ons --------------------------------------------------
function unpackAddons() {
  if (!existsSync(addonDir)) { console.log(`  (${addonDir} is not here; the add-on half is skipped)`); return []; }
  try { execFileSync('unar', ['-v'], {stdio: 'ignore'}); }
  catch { console.log('  (unar is not installed; the add-on half is skipped)'); return []; }
  mkdirSync(unpackDir, {recursive: true});
  for (const f of readdirSync(addonDir)) {
    if (!/\.(sit|sitx|sea|zip|hqx)$/i.test(f)) continue;
    const out = join(unpackDir, f.replace(/\..*$/, ''));
    if (existsSync(out)) continue;
    try { execFileSync('unar', ['-q', '-f', '-o', out, join(addonDir, f)], {stdio: 'ignore'}); }
    catch { /* a member that will not unpack is not this check's business */ }
  }
  const files = [];
  (function walk(d) {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      const st = statSync(p);
      if (st.isDirectory()) walk(p);
      else if (st.isFile() && st.size >= 0x888) files.push(p);
    }
  })(unpackDir);
  return files;
}

const files = unpackAddons();
let archives = 0, roundTripped = 0, bytewise = 0, refused = 0;
const saves = [];
for (const p of files) {
  const bytes = new Uint8Array(readFileSync(p));
  sandbox.__a = bytes;
  const label = p.slice(unpackDir.length + 1);
  // The page's own gate decides. A file that has a title and a master index
  // pair but is still refused is the case this check exists to catch: it is
  // what every saved game looked like to the old count-based rule.
  const info = ev(`(() => {
    const d = describeDelverArchive(__a);
    if (d.ok) return {ok: true, title: d.title, player: d.player, populated: d.populated};
    return {ok: false, reason: d.reason, looksLikeOne: !!(d.title && delverMasterIndexExtent(__a))};
  })()`);
  if (!info.ok) {
    if (info.looksLikeOne) fail('recognising ' + label, info.reason);
    else refused++;                              // most files in an add-on are not archives
    continue;
  }
  archives++;
  if (info.player) saves.push(info.player);
  // Round trip. The assertion is that every resource survives -- same ids,
  // same plaintext -- NOT that the file comes back byte-identical.
  // delv_write_check.mjs proves byte-identity for the shipped archive, and it
  // holds there because the writer's layout happens to match Ambrosia's. It
  // does not hold for any of these: a player file (DelP) lays its resources
  // out differently, so a rewrite moves bytes without losing anything. Byte
  // identity is a property of the shipped file, not of the format, and
  // asserting it here would be asserting the wrong thing.
  let r = null, err = null;
  try {
    r = ev(`(() => {
      const spec = delverArchiveSpec(__a);
      if (!spec) return {ok: false, why: 'no master index'};
      const out = writeDelverArchive(spec);
      const back = delverArchiveSpec(out);
      if (!back) return {ok: false, why: 'what was written back has no master index'};
      if (back.resources.length !== spec.resources.length)
        return {ok: false, why: back.resources.length + ' resources back, ' + spec.resources.length + ' in'};
      for (let i = 0; i < spec.resources.length; i++) {
        const a = spec.resources[i], b = back.resources[i];
        if (a.resid !== b.resid) return {ok: false, why: 'resource ' + i + ' changed id'};
        if (a.data.length !== b.data.length) return {ok: false, why: '0x' + a.resid.toString(16) + ' changed length'};
        for (let j = 0; j < a.data.length; j++)
          if (a.data[j] !== b.data[j]) return {ok: false, why: '0x' + a.resid.toString(16) + ' changed at byte ' + j};
      }
      let identical = out.length === __a.length;
      if (identical) for (let i = 0; i < out.length; i++) if (out[i] !== __a[i]) { identical = false; break; }
      return {ok: true, n: spec.resources.length, identical};
    })()`);
  } catch (e) { err = e.message; }
  if (r && r.ok) { roundTripped++; if (r.identical) bytewise++; }
  else fail('round trip of ' + label, err || (r && r.why) || 'unknown');
  scoreHeuristic('  ' + (info.title || label), bytes);
}

if (files.length) {
  if (archives > 0) ok(`${archives} third-party archive(s) opened`, `${roundTripped} kept every resource through a rewrite, ${bytewise} byte-identical; ` +
     `${saves.length} saved game(s): ${saves.map(n => '“' + n + '”').join(', ')}`);
  else fail('the add-ons', `unpacked ${files.length} files and none was a Delver archive`);
  if (refused > 0) ok(`${refused} other file(s) in the add-ons refused`);
  else fail('the negative corpus', 'nothing in the add-ons was refused, so the gate was not tested against a non-archive');
}

console.log(failures
  ? `\nFAIL — ${failures} check(s) failed`
  : `\nheuristic ${shipped ? shipped.pct.toFixed(1) + '% vs the tables' : 'not measured'}` +
    `${shipped ? ' (structure ' + shipped.byWay.structure.agree + '/' + shipped.byWay.structure.n +
      ', score ' + shipped.byWay.score.agree + '/' + shipped.byWay.score.n + ')' : ''}` +
    `, ${archives} third-party archives, ${roundTripped} kept every resource`);
process.exit(failures ? 1 : 0);
