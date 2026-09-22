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
// falls back to a heuristic (all-zero detection, then the DELV_SHAPES bank of
// payload-shape tests, then a comparison of byte entropy) for anything they do
// not cover. The
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
                    d.byStructure ? d.shape : d.exempt ? 'exempt' :
                    d.constantKeystream ? 'constant key' : 'entropy']);
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
  let known = 0, agree = 0;
  // One row per path the fallback took: the two all-zero certainties, each
  // shape in DELV_SHAPES that decided anything, and the entropy comparison.
  // The names come from the code rather than being listed here, so a shape
  // added to the bank appears in this table without the check being edited.
  const byWay = {};
  const wrong = [];
  for (const [resid, wasDec, isKnown] of truth) {
    if (!isKnown) continue;
    const g = byId.get(resid);
    if (!g) continue;
    known++;
    const w = byWay[g[3]] || (byWay[g[3]] = {n: 0, agree: 0, ids: []});
    w.n++; w.ids.push(resid);
    if (g[1] === wasDec) { agree++; w.agree++; } else wrong.push(resid);
  }
  const pct = known ? (100 * agree / known) : 0;
  const paths = Object.keys(byWay).sort((a, b) => byWay[b].n - byWay[a].n);
  console.log(`  ${label}: ${agree}/${known} agree (${pct.toFixed(1)}%)`);
  console.log(`      by path: ` + paths.map(k => `${k} ${byWay[k].agree}/${byWay[k].n}`).join(', '));
  return {known, agree, pct, wrong, byWay,
          structure: paths.filter(k => k !== 'zero' && k !== 'entropy')
            .filter(k => k !== 'constant key')
            .reduce((a, k) => ({n: a.n + byWay[k].n, agree: a.agree + byWay[k].agree}), {n: 0, agree: 0}),
          entropy: byWay.entropy || {n: 0, agree: 0, ids: []}};
}

// ---- the shipped archive ----------------------------------------------------
let shipped = null;
if (dataPath && existsSync(dataPath)) {
  shipped = scoreHeuristic('shipped archive', new Uint8Array(readFileSync(dataPath)));
  if (!shipped) fail('the shipped archive', 'no resources enumerated');
} else {
  console.log('  (no shipped archive given; the labelled-corpus half is skipped)');
}

// The recorded floor. It is not a target, it is a baseline: what matters is
// that the agreement does not get WORSE, because a change to a shape test, to
// the container test or to the entropy comparison that drops this number has
// made modded archives read worse, silently, and nothing else would say so.
//
// No figure is written into this comment, because every one that was went
// stale: the breakdown is printed on every run and that printed line is the
// record. The floor sits a little under the measured agreement, which is why
// it is a round number and not the measurement.
//
// It was 62.0 for a fallback that scored 63.3%, where the shape bank did not
// exist and everything that was not a script fell to a printable-ratio score
// that noise beat by construction. Its replacement reached 99.9%, and then the
// symbol-table shape and the constant-keystream rule took the last resource,
// so there is no margin left to give: the fallback and the tables now agree
// completely, and anything less than that is a regression by definition.
const FLOOR = 100.0;
/* And two assertions the floor does NOT make, which is the whole reason they
   are here. Disabling the image test outright and re-running took the
   agreement from 1,557 of 1,558 to 1,556: the entropy comparison catches the
   graphics too, well enough that the floor above cannot see a shape test die.
   A percentage of the total is the wrong instrument for the bank.

   So: every verdict the bank reaches must be RIGHT -- there is no floor on
   that one, because a shape test firing on the wrong candidate is a defect and
   not a degradation, and it was measured at nil over the whole archive and its
   decrypted twins. And the bank must go on deciding about as much as it does
   today, which is what catches a test that has stopped firing at all.

   All three were held to a deliberate break before being trusted: disabling
   the image test fails the reach assertion, disabling the smallest test in the
   bank fails it too, inverting the image test so that it fires on the noise
   fails the verdict assertion with 379 wrong, and inverting the entropy
   comparison fails the floor at 95.4%. One control turned out not to
   be one -- a shape test rewritten to accept ANYTHING fires on both candidates,
   which the `rawOk === decOk` rule discards, so it reads exactly like a test
   that was deleted. A false positive only shows when a test prefers the wrong
   candidate, which is what the second assertion is about. */
// The floor is within the SMALLEST shape's count of the measurement, not a
// round number under it, and that is the point: a bank of seven tests where
// one contributes eleven resources cannot be guarded by a loose figure. At
// 1,400 -- a comfortable margin below -- disabling the sound test (46
// resources) or the map test (44) left the count above the floor and the
// agreement inside it, because an `asnd` body is mostly 0x00 and 0xFF bytes
// and the entropy comparison covers for it, so a dead test was invisible to
// all three assertions. The smallest test in the bank is now the symbol table
// at two resources, so the floor sits two under the measurement. The shipped
// archive is a fixed file, so this count moves only when the code does, which
// is exactly when it should be read.
const SHAPE_FLOOR = 1470;
if (shipped) {
  if (shipped.pct >= FLOOR)
    ok(`the heuristic agrees with the tables on at least ${FLOOR}% of the shipped archive`,
       `${shipped.pct.toFixed(1)}%, ${shipped.wrong.length} disagreements`);
  else
    fail('the heuristic against the tables',
         `${shipped.pct.toFixed(1)}% agreement, below the recorded ${FLOOR}% floor; ` +
         `first disagreements: ${shipped.wrong.slice(0, 8).map(r => '0x' + r.toString(16).padStart(4, '0')).join(', ')}`);
  if (shipped.structure.agree === shipped.structure.n)
    ok('every verdict the shape bank reached is the one the tables give',
       `${shipped.structure.n} of ${shipped.known} resources decided by shape`);
  else
    fail('the shape bank',
         `${shipped.structure.n - shipped.structure.agree} of ${shipped.structure.n} shape verdicts ` +
         `disagree with the tables, so a test is firing on the wrong candidate`);
  /* And the one invariant that guards the constant-keystream rule, which
     nothing else does: disabling that rule outright failed no assertion,
     because the symbol-table shape happens to catch the one resource it was
     written for. The invariant is structural rather than statistical -- for a
     resource id whose keystream is a single repeated byte the two candidates
     are one histogram relabelled, so the entropy comparison is blind to them
     by construction, and a verdict reached that way is luck whether or not it
     is right. No such resource may be decided by entropy. */
  const constKeystream = resid => {
    let key = (resid ^ (resid >> 8)) & 0xFFFF;
    const m = ((resid & 0x3F) << 2) + 1, b = resid >> 6;
    key = (key * m + b) & 0xFFFF;
    const first = key & 0xFF;
    key = (key * m + b) & 0xFFFF;
    return (key & 0xFF) === first;
  };
  const blind = (shipped.entropy.ids || []).filter(constKeystream);
  if (blind.length === 0)
    ok('no resource with a constant keystream was decided by byte entropy',
       `${(shipped.entropy.ids || []).length} decided by entropy, none of them blind`);
  else
    fail('the constant-keystream rule',
         `${blind.length} resource(s) whose keystream is one repeated byte were decided by ` +
         `the entropy comparison, which cannot see the difference: ` +
         blind.slice(0, 8).map(r => '0x' + r.toString(16).padStart(4, '0')).join(', '));
  if (shipped.structure.n >= SHAPE_FLOOR)
    ok(`the shape bank still decides at least ${SHAPE_FLOOR} of the shipped archive`,
       `${shipped.structure.n}`);
  else
    fail('the shape bank\'s reach',
         `it decided ${shipped.structure.n} resources, under the recorded ${SHAPE_FLOOR}; ` +
         `a test has stopped firing, and the entropy comparison is covering for it`);
}

// ---- oracle 2: the add-ons --------------------------------------------------
function hasFiles(dir) {
  for (const e of readdirSync(dir)) { const p = join(dir, e); const st = statSync(p); if (st.isFile() || (st.isDirectory() && hasFiles(p))) return true; }
  return false;
}
function unpackAddons() {
  if (!existsSync(addonDir)) { console.log(`  (${addonDir} is not here; the add-on half is skipped)`); return []; }
  try { execFileSync('unar', ['-v'], {stdio: 'ignore'}); }
  catch { console.log('  (unar is not installed; the add-on half is skipped)'); return []; }
  mkdirSync(unpackDir, {recursive: true});
  for (const f of readdirSync(addonDir)) {
    if (!/\.(sit|sitx|sea|zip|hqx)$/i.test(f)) continue;
    const out = join(unpackDir, f.replace(/\..*$/, ''));
    // An unpacked add-on is kept between runs, but a directory with no file
    // in it is not one. macOS purges what has sat untouched in $TMPDIR for a
    // few days and leaves the directories, and on 11 September 2026 every
    // add-on here was found that way: the check skipped them all as already
    // unpacked, the saved game was gone from the UI smoke, and every row
    // still read ok until this looked inside.
    if (existsSync(out) && hasFiles(out)) continue;
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
    `${shipped ? ' (by shape ' + shipped.structure.agree + '/' + shipped.structure.n +
      ', by entropy ' + shipped.entropy.agree + '/' + shipped.entropy.n + ')' : ''}` +
    `, ${archives} third-party archives, ${roundTripped} kept every resource`);
process.exit(failures ? 1 : 0);
