#!/usr/bin/env node
// The closed-form rule models in js/delv-mechanics.js against the Monte Carlo
// ones in utilities/mech_ref.mjs -- two implementations of Cythera's rules,
// neither derived from the other, required to agree.
//
//     node utilities/mech_check.mjs js/delv-mechanics.js
//
// WHY THIS EXISTS. Every other number the Mechanics sheet shows is read off
// the archive, so delvmod and the disassembly checks stand behind it. The
// probabilities are different: nothing in the file says how often a blow
// lands, and a closed form that computes the wrong thing draws a perfectly
// plausible curve. Left alone it would be the one part of the sheet with no
// evidence behind it at all.
//
// So the rules are implemented twice. js/delv-mechanics.js convolves
// distributions and reads answers off them; mech_ref.mjs rolls dice a few
// hundred thousand times and counts, written from the sheet's prose without
// reading the other file. An algebra slip moves one and not the other. This
// is the same arrangement delvmod gives decompressDCG and the port gives the
// classic-Mac decoders, built the only way it could be here -- there is no
// third-party implementation of Cythera's combat maths to borrow.
//
// It is worth being clear about what agreement proves and what it does not.
// It proves the two agree about the rule as the sheet states it; it says
// nothing about whether the sheet reads the bytecode rightly, which is the
// disassembler's job and the archaeology's. Where the prose is ambiguous both
// implementations take the same documented reading, each with a comment
// naming the alternative -- that is a shared assumption, not a shared check,
// and it is written down on both sides so nobody mistakes one for the other.
//
// The exceptions are the fixed numbers, and they are the strongest thing
// here: the dice enumerate to 96 wins, 50 pushes and 70 losses of 216, and
// five bed measurements a player posted to Ambrosia's web board in March 2012
// -- 12, 42, 30, 10 and 35 health an hour -- come out of the model exactly.
// Those came from outside this project entirely, which is what an oracle is.
//
// No inputs beyond the two files: no archive, no network, no delvmod. It runs
// on a bare checkout in under a second.

import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import * as ref from './mech_ref.mjs';

const modelPath = process.argv[2] || 'js/delv-mechanics.js';

// js/delv-mechanics.js is a classic script -- no exports, everything a
// top-level declaration -- so it is evaluated in a bare context and its
// function declarations are read off the context's global. `const` at top
// level would not be reachable this way (the trap CLAUDE.md records), which
// is why every name that side means to share is a function.
const ctx = createContext({ Math, Map, Set, Array, Object, Number, JSON, console });
runInContext(readFileSync(modelPath, 'utf8'), ctx, { filename: modelPath });

const TRIALS = 200000;
let failed = 0, compared = 0;
const fail = (what, why) => { failed++; console.error(`  FAIL ${what}: ${why}`); };

// The tolerance a sampled probability deserves: four standard errors at the
// worst case p = 1/2, floored so a rare outcome is not held to an impossible
// standard. A real disagreement between the two implementations is a whole
// percent or more -- an off-by-one in a roll's range, a term dropped from a
// sum -- so this is loose enough never to flake and tight enough to catch
// anything that is actually wrong.
const TOL = Math.max(0.004, 4 / Math.sqrt(TRIALS));
function near(what, exact, sampled, tol) {
  compared++;
  const t = tol === undefined ? TOL : tol;
  if (!(Math.abs(exact - sampled) <= t))
    fail(what, `closed form ${exact.toFixed(5)}, sampled ${sampled.toFixed(5)}, apart by ${Math.abs(exact - sampled).toFixed(5)} > ${t}`);
}
function exactly(what, got, want) {
  compared++;
  if (got !== want) fail(what, `${JSON.stringify(got)} is not ${JSON.stringify(want)}`);
}

// ---- 1. the dice game ------------------------------------------------------
for (const gambling of [false, true]) {
  const label = gambling ? 'dice with Gambling' : 'dice';
  const x = ctx.mechDiceExact({ gambling });
  const r = ref.refDice({ gambling }, TRIALS, ref.mulberry32(11));
  near(`${label}: wins`, x.wins, r.wins);
  near(`${label}: pushes`, x.pushes, r.pushes);
  near(`${label}: losses`, x.losses, r.losses);
  near(`${label}: obols a game`, x.mean, r.mean, 0.02);
  // The distribution outcome by outcome, not only the three totals: a payout
  // rule wrong in one branch can still give the right win rate.
  for (const [net, p] of x.dist) near(`${label}: net ${net}`, p, (r.dist[String(net)] || 0));
  const total = [...x.dist.values()].reduce((a, b) => a + b, 0);
  near(`${label}: the distribution sums to one`, total, 1, 1e-9);
}
// The one figure that came from outside: the page's own enumeration, which
// CLAUDE.md records and the smoke test pins.
const plain = ctx.mechDiceExact({});
exactly('dice: 96 wins of 216', Math.round(plain.wins * 216), 96);
exactly('dice: 50 pushes of 216', Math.round(plain.pushes * 216), 50);
exactly('dice: 70 losses of 216', Math.round(plain.losses * 216), 70);
exactly('dice: 216 cells in the matrix', ctx.mechDiceExact({}).cells.reduce((n, c) => n + c.row.length, 0), 216);

// ---- 2. combat -------------------------------------------------------------
const FIGHTS = [
  { name: 'an even match, no shield', p: { attackerReflex: 20, defenderReflex: 20, weaponSkill: 10, attackSkill: 0, defenceSkill: 0, shieldBlock: null, shieldSkill: 0, damage: 30, enchant: 0 } },
  { name: 'an even match behind a shield', p: { attackerReflex: 20, defenderReflex: 20, weaponSkill: 10, attackSkill: 0, defenceSkill: 0, shieldBlock: 20, shieldSkill: 0, damage: 30, enchant: 0 } },
  { name: 'outmatched', p: { attackerReflex: 8, defenderReflex: 30, weaponSkill: 0, attackSkill: 0, defenceSkill: 8, shieldBlock: 10, shieldSkill: 4, damage: 15, enchant: 0 } },
  { name: 'a hero with an enchanted blade', p: { attackerReflex: 30, defenderReflex: 14, weaponSkill: 12, attackSkill: 6, defenceSkill: 2, shieldBlock: null, shieldSkill: 0, damage: 30, enchant: 5 } }
];
let seed = 21;
for (const f of FIGHTS) {
  const x = ctx.mechCombatExact(f.p);
  const r = ref.refCombat(f.p, TRIALS, ref.mulberry32(seed++));
  near(`combat (${f.name}): miss`, x.miss, r.miss);
  near(`combat (${f.name}): parry`, x.parry, r.parry);
  near(`combat (${f.name}): hit`, x.hit, r.hit);
  near(`combat (${f.name}): miss + parry + hit`, x.miss + x.parry + x.hit, 1, 1e-9);
  // The mean damage the reference reports is over the hits alone; the model's
  // damage distribution is the same conditional, so they compare directly --
  // but only where the sampling actually landed some blows. In the outmatched
  // fight almost nothing gets through, so the reference's mean is over a
  // handful of hits or none at all, and comparing it would be comparing
  // against noise rather than against an implementation.
  if (r.hit > 0.02) near(`combat (${f.name}): mean damage`, x.meanDamage, r.meanDamage, 0.4);
  for (const w of x.words) near(`combat (${f.name}): ${w.word}`, w.p, r.words[w.word] || 0);
  const named = x.words.reduce((s, w) => s + w.p, 0);
  near(`combat (${f.name}): the blow words account for every hit`, named, x.hit, 1e-9);
}

// ---- 3. locks --------------------------------------------------------------
for (const reflex of [10, 20, 30]) for (const difficulty of [0, 10, 15, 40, 60, 255]) {
  const x = ctx.mechLockChance(reflex, difficulty);
  const r = ref.refLock({ reflex, difficulty }, TRIALS, ref.mulberry32(seed++));
  near(`lock (reflex ${reflex}, difficulty ${difficulty})`, x, r.open);
}
// The staircase, and which way it rounds. The difficulty term is
// (data1 + 19) / 20 * 5, so it steps UP at 1 rather than at 20: only a
// difficulty of nothing is free, and 1 through 20 are one lock. That is the
// whole point of drawing the curve and is exactly what a rewrite would lose.
exactly('lock: 1 and 20 are the same lock', ctx.mechLockChance(20, 1), ctx.mechLockChance(20, 20));
if (!(ctx.mechLockChance(20, 1) < ctx.mechLockChance(20, 0))) fail('lock: a difficulty of 1 already costs five', 'it does not');
compared++;
if (!(ctx.mechLockChance(20, 21) < ctx.mechLockChance(20, 20))) fail('lock: 21 is harder than 20', 'it is not');
compared++;

// ---- 4. casting ------------------------------------------------------------
for (const casting of [0, 2, 5, 10, 20]) for (const level of [1, 5, 8]) {
  const x = ctx.mechCastFailure(casting, level);
  const r = ref.refCast({ casting, level }, TRIALS, ref.mulberry32(seed++));
  near(`cast (Casting ${casting}, level ${level})`, x, r);
}

// ---- 5. hunger, healing and a night's sleep --------------------------------
// No rolls in either, so these must agree exactly rather than nearly.
const RUNS = [
  { name: 'fed', p: { level: 6, hours: 8, nutrition: 24, health: 40, fullHealth: 100 } },
  { name: 'starving', p: { level: 6, hours: 8, nutrition: 0, health: 40, fullHealth: 100 } },
  { name: 'level 1', p: { level: 1, hours: 24, nutrition: 100, health: 10, fullHealth: 100 } },
  { name: 'level 5', p: { level: 5, hours: 6, nutrition: 100, health: 10, fullHealth: 100 } },
  { name: 'poisoned', p: { level: 6, hours: 8, nutrition: 24, health: 40, fullHealth: 100, poisoned: true } },
  { name: 'poisoned and regenerating', p: { level: 6, hours: 8, nutrition: 24, health: 3, fullHealth: 100, poisoned: true, regenerating: true } },
  { name: 'regenerating', p: { level: 6, hours: 8, nutrition: 24, health: 40, fullHealth: 100, regenerating: true } },
  { name: 'four days unfed', p: { level: 8, hours: 96, nutrition: 100, health: 20, fullHealth: 200 } }
];
for (const run of RUNS) {
  const x = ctx.mechHungerRun(run.p), r = ref.refHungerRun(run.p);
  exactly(`hunger (${run.name}): nutrition`, x.nutrition, r.nutrition);
  exactly(`hunger (${run.name}): health`, x.health, r.health);
  exactly(`hunger (${run.name}): died`, !!x.died, !!r.died);
}
for (const q of [0, 1, 2, 3, 4]) for (const level of [1, 4, 6, 9]) {
  const p = { level, hours: 8, quality: q, nutrition: 100, health: 0, fullHealth: 1000 };
  exactly(`sleep (quality ${q}, level ${level})`, ctx.mechSleepGain(p).gained, ref.refSleep(p).gained);
}

// The March 2012 measurements, health an hour, from Ambrosia's web board.
// This is the only number on the sheet that was measured in play by somebody
// who had never seen any of this code.
const BEDS = [
  ['own bed, fed', { quality: 4 }, 12],
  ['own bed with the ring', { quality: 4, regenerating: true }, 42],
  ['own bed, starving, with the ring', { quality: 4, regenerating: true, nutrition: 0 }, 30],
  ['the Titan’s Head', { quality: 3 }, 10],
  ['the Titan’s Head with the ring', { quality: 3, regenerating: true }, 35]
];
for (const [name, opts, want] of BEDS) {
  const p = Object.assign({ level: 6, hours: 1, nutrition: 100, health: 0, fullHealth: 1000 }, opts);
  exactly(`the 2012 measurement, ${name}`, ctx.mechSleepGain(p).gained, want);
  exactly(`the 2012 measurement as a rate, ${name}`,
    ctx.mechBedRate(6, p.quality, { fed: p.nutrition !== 0, regenerating: !!p.regenerating }), want);
}

// ---- 6. the arithmetic with no roll in it ----------------------------------
exactly('levels: the threshold doubles', [1, 2, 3, 4, 5].map(l => ctx.mechLevelThreshold(l)).join(','), '100,200,400,800,1600');
// 100 x 2^10 is 102,400 and experience stops at 65,535, so the eleventh
// level is the last one the game can reach and the twelfth threshold is
// unreachable by construction. That is a fact about the rule worth pinning:
// it is the kind of thing a chart makes obvious and a table never does.
exactly('levels: the eleventh is the last reachable', ctx.mechLevelThreshold(10) < ctx.mechExpCap() && ctx.mechLevelThreshold(11) > ctx.mechExpCap(), true);
exactly('healing: the rate by level', [1, 2, 3, 4, 5, 6, 7, 8, 9].map(l => ctx.mechHealRate(l)).join(','), '1,2,2,3,3,4,4,5,5');
exactly('healing: the period by level', [1, 2, 4, 6, 8].map(l => ctx.mechHealPeriodMinutes(l)).join(','), '60,30,20,15,12');
exactly('healing: the reference agrees about the period', [1, 2, 4, 6, 8].map(l => ref.healPeriodMinutes(l)).join(','),
  [1, 2, 4, 6, 8].map(l => ctx.mechHealPeriodMinutes(l)).join(','));
exactly('the clock: 4096 units an hour', ctx.mechClockUnitsPerHour(), 4096);

if (failed) { console.error(`\n${failed} of ${compared} comparisons failed`); process.exit(1); }
console.log(`  ${compared} comparisons agree, ${TRIALS.toLocaleString('en-US')} trials each`);
