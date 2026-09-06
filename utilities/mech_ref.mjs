#!/usr/bin/env node
// The dice, rolled. An independent reference for Cythera's rule mechanics.
//
//   node utilities/mech_ref.mjs
//
// js/delv-mechanics.js works these rules out in closed form -- a probability
// per outcome, an expectation per game, arrived at with algebra. This file
// works out the same numbers the stupid way: it rolls the dice a few hundred
// thousand times and counts what happened. Nothing here is clever, and that is
// the entire point.
//
// WHY A SECOND IMPLEMENTATION. The site's habit is written down in CLAUDE.md
// under "delvmod is the correctness oracle": a snapshot proves a decoder
// UNCHANGED, never RIGHT, and a formula that has been wrong since the day it
// was written passes its snapshot forever. The Delver formats have delvmod for
// that; the mac-* tier has the retired port and systemless. The rules read off
// the game's scripts have had nothing at all. A closed form for "how often does
// a level 6 fighter with a bronze sword get parried" cannot be checked against
// the game without playing it ten thousand times, and it cannot be checked
// against itself. It can be checked against a simulation of the same rule
// written from the rule, which is what this is: the arithmetic here is a
// transcription of what the script does, the arithmetic there is a derivation
// from it, and they agree only if the derivation is right.
//
// WHAT IT DELIBERATELY DOES NOT DO. No memoised distributions, no convolution,
// no "the sum of two uniforms is a triangle so we can skip the inner loop", no
// early exit when the answer is already decided, no caching of a result across
// calls. Every one of those would be a small step towards being the thing it is
// checking, and the day one of them has a bug it will have the SAME bug as the
// closed form and the check will pass. It also does not model anything the
// scripts do not state: no criticals, no armour or resistance on the way out,
// no per-frame timing.
//
// It takes an RNG as a parameter and ships a seeded one, so a run is
// reproducible and a disagreement can be re-run to the same trial. Zero
// dependencies, stock Node, as everything in utilities/ is.
//
// THE ROLL CONVENTION, which every number here depends on, and which is now
// settled in the executable rather than inferred. `cbrnd` in the PowerPC binary
// computes a + (rand mod (b - a)) and returns a unchanged when a >= b, so
// Random(a, b) yields a .. b-1: exactly b - a values, inclusive of a and
// exclusive of b. The archive corroborates it twice over -- 31 sites use
// Random(0, len(array)) directly as an index into that array, which is only
// safe if the top is exclusive, and every script that wants an INCLUSIVE top
// writes the + 1 itself. Two of the rolls below are exactly that idiom.
//
// This file therefore has one primitive, randint(rng, a, b), and one shorthand,
// rnd(rng, n) = randint(rng, 0, n), spelled with the script's own operand. A
// "roll of 0 to 29" is written rnd(rng, 30), because 30 is what the bytecode
// says. There is no separate reading for computed operands: a shield's block
// and a caster's Casting figure go in exactly as a literal would, and where an
// inclusive top is wanted the + 1 is visible in the expression because it is
// visible in the script.
//
// An earlier version of this file read computed operands as inclusive and said
// so as an open ambiguity. It was wrong, by a point, everywhere it applied.
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Randomness
// ---------------------------------------------------------------------------

// mulberry32: a 32-bit PRNG small enough to read in one sitting and good enough
// for counting outcomes. Deterministic from its seed, which is the requirement
// -- a Monte Carlo oracle that cannot be re-run to the same numbers is an
// oracle you cannot argue with. Not cryptographic and does not need to be.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The game's Random(a, b), as cbrnd implements it: a up to b - 1, inclusive of
// a and exclusive of b, and a itself when the range is empty or inverted.
export function randint(rng, a, b) {
  if (a >= b) return a;
  return a + Math.floor(rng() * (b - a));
}

// Random(0, n), which is the form nearly every call site uses. n is the
// script's own operand, so rnd(rng, 30) is "a roll of 0 to 29" and
// rnd(rng, 1) is always 0 -- a fact rule 4 turns on.
export function rnd(rng, n) {
  return randint(rng, 0, n);
}

// ---------------------------------------------------------------------------
// 1. The inn dice game
// ---------------------------------------------------------------------------
//
// Three dice, six faces each, modelled 0..5 -- the faces are never printed, only
// compared and subtracted, so the offset does not matter and 0-based keeps the
// arithmetic honest. a is the innkeeper's first die, b is your white die, c is
// the innkeeper's second: yours between theirs is the shape of the game.
//
// The announced payout, straight off the script:
//   a === b                     -> 2
//   a < c   and b < a           -> a - b      (outside, below)
//   a < c   and b > c           -> b - c      (outside, above)
//   a < c   otherwise           -> 0          (inside, or level with an end)
//   a >= c  and b < c           -> c - b
//   a >= c  and b > a           -> b - a
//   a >= c  otherwise           -> 0
//
// What you actually take home is one less than announced, that one being your
// stake, and a losing throw costs you one obol. So net = payout - 1 on a paying
// throw and -1 on a non-paying one, which makes an announced 1 a push. The
// innkeeper's own explanation in the script describes the same game in words.
//
// Gambling, when the player has it, gives the white die a one in six chance of
// being SET to the innkeeper's first die -- which, since a === b then pays 2,
// is a one in six chance of turning a throw into a winner. The script only
// reaches that branch when a !== b (there is nothing to fix when they already
// match), and the replacement happens before the payout is worked out.
//
// AMBIGUITY: the order of the draws. Nothing observable depends on it -- three
// independent uniforms are three independent uniforms -- but it matters for
// reproducing a given trial from a seed, so it is fixed here as a, b, c, then
// the skill's one-in-six. The alternative (drawing the skill's roll before the
// dice, or only when it is needed) gives the same distribution and different
// individual trials.
//
// This model is the one the archaeology pass left alone, and it has an
// independent confirmation of its own: enumerated over all 216 throws it gives
// 96 wins, 50 pushes and 70 losses and +0.306 obols a game, +0.421 with
// Gambling, which are the figures the page's own enumeration prints.
export function refDice({ gambling = false } = {}, trials = 200000, rng = mulberry32(1)) {
  let wins = 0, pushes = 0, losses = 0, total = 0;
  const dist = Object.create(null);

  for (let i = 0; i < trials; i++) {
    const a = rnd(rng, 6);
    let b = rnd(rng, 6);
    const c = rnd(rng, 6);

    if (gambling && a !== b && rnd(rng, 6) === 0) b = a;

    let payout;
    if (a === b) payout = 2;
    else if (a < c) payout = b < a ? a - b : b > c ? b - c : 0;
    else payout = b < c ? c - b : b > a ? b - a : 0;

    const net = payout === 0 ? -1 : payout - 1;

    if (net > 0) wins++;
    else if (net === 0) pushes++;
    else losses++;
    total += net;

    const key = String(net);
    dist[key] = (dist[key] || 0) + 1;
  }

  for (const key of Object.keys(dist)) dist[key] /= trials;
  return {
    wins: wins / trials,
    pushes: pushes / trials,
    losses: losses / trials,
    mean: total / trials,
    dist,
  };
}

// ---------------------------------------------------------------------------
// 2. Combat: one exchange
// ---------------------------------------------------------------------------
//
// The blow words, by the size of the hit. Read off the script's own thresholds:
// under 3, under 6, under 9, under 12, under 16, under 20, under 25, under 35,
// and everything from 35 up. The word names the RAW ROLL -- the points as
// rolled, before any resistance is taken off -- which is why a character can be
// "ground to dust" by a blow that a resistance then blunts.
const BLOW_WORDS = [
  [3, 'grazed'],
  [6, 'hit'],
  [9, 'hit hard'],
  [12, 'very hard'],
  [16, 'extremely hard'],
  [20, 'crushed'],
  [25, 'smashed'],
  [35, 'ground to dust'],
  [Infinity, 'shredded'],
];

export function blowWord(points) {
  for (const [under, word] of BLOW_WORDS) if (points < under) return word;
  return 'shredded';
}

// One exchange.
//
//   margin = attackerReflex + weaponSkill + Random(0, 30)
//          - (defenderReflex + Random(0, 30))
//          + attackSkill - defenceSkill + enchant
//
// Two separate rolls of 0 to 29, one for each side, drawn attacker first.
//
// THE ORDER OF THE TESTS, which was the open ambiguity here and is now settled
// by reading 0xE87: it rolls the shields, THEN tests the margin against zero,
// THEN -- only for a margin that survived -- tests it against the shields.
//
//   margin <= 0          -> missed
//   margin < blockTotal  -> parried
//   otherwise            -> hit
//
// The earlier version of this file had the parry first, which let a blow that
// would have missed anyway be scored as parried. It cannot be now: the parry
// share comes entirely out of what would otherwise have been hits, and the miss
// rate against a shielded defender is exactly the miss rate against a bare one.
// The block is still ROLLED first, because the script rolls it first and this
// file keeps its draw order, which also makes the RNG consumption per trial the
// same whatever the outcome.
//
// THE SHIELD ROLL is one of the two places the script writes the + 1 itself:
// every equipped item with a Shield member contributes Random(0, block + 1 +
// shieldSkill), i.e. 0 to block + shieldSkill inclusive, and the contributions
// are SUMMED across items. One shield is the case worth having; with none the
// total is 0, and since the parry test is only reached by a margin already
// above 0, the branch cannot fire.
//
// THE DAMAGE is the other: 1 + Random(0, damageFigure) + enchantment, uniform
// on 1 to damageFigure and never zero. The weapon skill was the second open
// question here -- addend on the result, or widening of the bound -- and it is
// the bound: the skill is added into the damage figure before the roll, so a
// skilled fighter's blows spread further rather than all landing harder. The
// enchantment is a flat addend on the damage and also goes on the margin.
export function refCombat(params, trials = 200000, rng = mulberry32(2)) {
  const {
    attackerReflex = 0,
    defenderReflex = 0,
    weaponSkill = 0,
    attackSkill = 0,
    defenceSkill = 0,
    shieldBlock = null,
    shieldSkill = 0,
    damage = 0,
    enchant = 0,
  } = params || {};

  let miss = 0, parry = 0, hit = 0, damageTotal = 0;
  const words = Object.create(null);
  for (const [, word] of BLOW_WORDS) words[word] = 0;

  for (let i = 0; i < trials; i++) {
    const margin =
      attackerReflex + weaponSkill + rnd(rng, 30) -
      (defenderReflex + rnd(rng, 30)) +
      attackSkill - defenceSkill + enchant;

    // Rolled before either test, as the script rolls it. A defender with no
    // shield contributes nothing and consumes no roll.
    const blockTotal = shieldBlock === null ? 0 : rnd(rng, shieldBlock + 1 + shieldSkill);

    if (margin <= 0) { miss++; continue; }
    if (margin < blockTotal) { parry++; continue; }

    const points = rnd(rng, damage + weaponSkill) + 1 + enchant;
    hit++;
    damageTotal += points;
    words[blowWord(points)]++;
  }

  // Every word is reported, including the ones that never came up, so a caller
  // comparing two implementations gets the same key set from both and a zero
  // reads as "never happened" rather than as "not modelled".
  for (const key of Object.keys(words)) words[key] /= trials;

  return {
    miss: miss / trials,
    parry: parry / trials,
    hit: hit / trials,
    meanDamage: hit ? damageTotal / hit : 0,
    words,
  };
}

// ---------------------------------------------------------------------------
// 3. Lock picking
// ---------------------------------------------------------------------------
//
// A pick opens the lock when
//
//   reflex + Random(0, 19)  >=  20 + Random(0, 19) + (data1 + 19) / 20 * 5
//
// and BREAKS otherwise -- there is no third outcome, no retry, which is why the
// two fractions sum to 1 and why a lockpick is a consumable.
//
// Both rolls take the operand 19, so they are 0 to 18, not 0 to 19: nineteen
// values each, and the earlier version of this file had twenty. The difficulty
// term is integer division of difficulty + 19, which is ceil(difficulty / 20)
// and not floor -- so a lock of difficulty 1 already costs the full five points
// and only a difficulty of 0 costs nothing. That is the opposite of the reading
// taken here before, and it makes every lock in the game harder: the chest at
// 15 and the oak door at 10 both sit in the first step rather than under it,
// and the stone doors at 255 cost 65, which no reflex reaches -- those doors
// want the key.
//
// The player's own roll is drawn first. Nothing observable depends on that.
export function refLock({ reflex = 0, difficulty = 0 } = {}, trials = 200000, rng = mulberry32(3)) {
  let open = 0;
  for (let i = 0; i < trials; i++) {
    const mine = reflex + rnd(rng, 19);
    const theirs = 20 + rnd(rng, 19) + 5 * Math.ceil(difficulty / 20);
    if (mine >= theirs) open++;
  }
  return { open: open / trials, breaks: (trials - open) / trials };
}

// ---------------------------------------------------------------------------
// 4. Casting a spell
// ---------------------------------------------------------------------------
//
// The cast FAILS when two rolls against the caster's Casting figure together
// fall short of one roll against the spell's level:
//
//   Random(0, casting) + Random(0, casting) < Random(0, level)   ->   fizzle
//
// Both operands are computed values -- the Casting figure out of 0xE85, the
// level off the CastSpell call -- and they go in exactly as a literal would,
// exclusive, per the convention note in the header. This was the site where the
// inclusive reading was most tempting and it is settled against: cbrnd is
// exclusive and nothing here adds a + 1.
//
// The consequence is worth stating because it is a fact about the game and not
// about this file: A LEVEL 1 SPELL CAN NEVER FAIL. Random(0, 1) is always 0,
// the right-hand side is 0, and nothing is less than 0. Directed Nexus at level
// 1 for 1 magic point is therefore certain for any caster, however unskilled --
// which the inclusive reading would have got wrong, giving it a fizzle rate.
// The self-test asserts it.
//
// Note also that a Casting figure of 0 is not certain failure: both left rolls
// are 0, and the level roll is 0 one time in `level`.
export function refCast({ casting = 0, level = 0 } = {}, trials = 200000, rng = mulberry32(4)) {
  let fail = 0;
  for (let i = 0; i < trials; i++) {
    const mine = rnd(rng, casting) + rnd(rng, casting);
    if (mine < rnd(rng, level)) fail++;
  }
  return fail / trials;
}

// ---------------------------------------------------------------------------
// 5. Hunger and healing over a stretch of hours
// ---------------------------------------------------------------------------
//
// No randomness at all in this one, so it is a straight simulation rather than
// a sample and `trials` does not appear in the signature. It is here because it
// is the same kind of thing -- a rule stated as a rate, which the closed form
// turns into a multiplication and which this file gets by letting the clock run.
// The archaeology pass that corrected four rules above left this one standing
// as written.
//
// THE GRANULARITY, and the argument for it. The game clock counts 1/4096 of an
// hour and a step is one unit, so the obvious thing is to tick in those units.
// It is the wrong thing: 4096 is 2^12 and has no factor of 3 or 5, so twenty
// minutes is 1365 and a third units and six minutes is 409.6, and a simulation
// in clock units would have to invent a rounding for two of the five periods
// that the rules do not give. Minutes divide all of them exactly -- 60, 30, 20,
// 15, 12 for the healing periods and 6 for regeneration and poison -- so the
// loop runs a minute at a time and every period boundary lands where the rule
// says it does. (The engine itself does the comparison in clock units; whatever
// rounding it uses there is not visible in any figure the scripts state, and
// this file does not guess at it.)
//
// The rules, in the order they are applied within a minute:
//   - Every whole game hour, nutrition falls by 1, floored at 0.
//   - While nutrition is above 0, health rises by 1 at a period set by the
//     level: every hour at 1, every half hour at 2-3, every 20 minutes at 4-5,
//     every quarter hour at 6-7, every 12 minutes from 8 up. At nutrition 0,
//     nothing. (Magic rises on the same schedule; it is not modelled here
//     because no figure anyone has measured depends on it, and adding it would
//     be modelling something the check has nothing to check against.)
//   - A regenerating character -- Omen's ring, flag 12 -- gains 1 every six
//     minutes whether fed or not.
//   - A poisoned character loses 1 every six minutes.
//   - Nothing rises past fullHealth.
//
// AMBIGUITY: nutrition first or healing first on the hour, when the two
// coincide. Taken here in the order the rules are written -- the hour's
// nutrition is spent, and only then is the healing tick tested against what is
// left. The alternative gives one extra point of health in the hour that empties
// the belly and is otherwise identical. One point, once per stretch, and only
// for a character who runs out of food during it. Confirmed as written.
//
// AMBIGUITY: regeneration before poison, again the order the rules are written.
// For a character who is both, the two cancel and the order is invisible --
// except at 1 health, where going first spares them. The alternative kills them.
// Confirmed as written.
//
// AMBIGUITY: death. "Dies when the next point would take them below 1" is read
// as: at 1 health a poison tick kills, and the run stops there with health left
// at 1 and died set. The alternative is to report health 0. Nothing downstream
// reads the number after death, so this is a reporting choice, not a rule one.
export function healPeriodMinutes(level) {
  if (level >= 8) return 12;
  if (level >= 6) return 15;
  if (level >= 4) return 20;
  if (level >= 2) return 30;
  return 60;
}

export function refHungerRun(params) {
  const {
    level = 1,
    hours = 1,
    nutrition: nutrition0 = 0,
    health: health0 = 1,
    fullHealth = Infinity,
    poisoned = false,
    regenerating = false,
  } = params || {};

  const period = healPeriodMinutes(level);
  // Fractional hours are allowed and rounded to the nearest minute, since the
  // loop's unit is the minute; a caller wanting quarter hours gets them exactly.
  const minutes = Math.round(hours * 60);

  let nutrition = nutrition0;
  let health = health0;
  let died = false;

  for (let m = 1; m <= minutes; m++) {
    if (m % 60 === 0 && nutrition > 0) nutrition -= 1;

    if (nutrition > 0 && m % period === 0 && health < fullHealth) health += 1;

    if (m % 6 === 0) {
      if (regenerating && health < fullHealth) health += 1;
      if (poisoned) {
        if (health - 1 < 1) { died = true; break; }
        health -= 1;
      }
    }
  }

  return { nutrition, health, died, gained: health - health0 };
}

// ---------------------------------------------------------------------------
// 6. Sleeping
// ---------------------------------------------------------------------------
//
// The night passes a quarter of an hour at a time, healing exactly as above;
// then, when the bed has a quality, the sleeper gets what they healed during
// the night TIMES quality/2 added on top, capped at fullHealth. A quality of 0
// -- the ground, or a bed the script gives nothing for -- is the engine's rate
// alone. Quality 4 is therefore three times the engine's rate, not four.
//
// The quarter-hour phrasing describes how the sleep helper advances the clock,
// not a coarser rule: the engine's own periodic update runs on every step the
// clock takes, so advancing fifteen minutes in one call still passes through
// every tick inside it and the result is identical to letting the clock run.
// That is why this simply calls the minute loop. THE ALTERNATIVE READING is
// that the periodic checks happen only AT the quarter-hour boundaries, which
// would change levels 4-5 alone (a 20-minute period against a 15-minute step
// coincides only on the hour, so a level 5 sleeper would heal 1 an hour instead
// of 3) and nothing else. The 2012 measurements below are all level 6-7 and
// cannot distinguish the two, so the reading is taken on the engine's shape
// rather than on evidence, and a measurement from a level 5 character would
// settle it.
//
// AMBIGUITY: the bonus is floored. Health is an integer field in the character
// record, and an odd quality against an odd night's healing gives a half point.
// Floor is the conservative reading; rounding is the alternative. None of the
// five figures below reaches a half point, so nothing known distinguishes them.
//
// AMBIGUITY: a sleeper who somehow healed a NEGATIVE amount would have that
// multiplied too, which is the literal reading of "what they healed times
// quality/2" and is implemented as such. It cannot arise from this signature
// (there is no poisoned parameter, and nothing else takes health away), so the
// alternative -- clamping the bonus at 0 -- is untestable and not taken.
//
// THE CROSS-CHECK THAT MATTERS. A player measured beds in March 2012 and got
// five numbers, which any implementation of this rule must reproduce exactly:
//
//   level 6-7, fed, quality 4                    12 health an hour
//   level 6-7, fed, quality 4, regenerating      42
//   level 6-7, starving, quality 4, regenerating 30
//   level 6-7, fed, quality 3                    10
//   level 6-7, fed, quality 3, regenerating      35
//
// They are the reason to trust the rule at all: the engine's own rate (4 an
// hour at that level, plus 10 for regeneration) multiplied by 1 + quality/2 is
// the only shape that gives all five. IF THIS FILE STOPS REPRODUCING THEM, THIS
// FILE IS WRONG -- they are measurements from the running game and the rule is
// the thing on trial, not them. Do not adjust the numbers to match a changed
// implementation; the check in main() exits non-zero for exactly this reason,
// and it is also how a correction to one of the other five rules announces
// itself if it has been misapplied to this one.
export function refSleep(params) {
  const {
    level = 1,
    hours = 1,
    quality = 0,
    nutrition = 0,
    regenerating = false,
    fullHealth = Infinity,
    health: health0 = 1,
  } = params || {};

  const night = refHungerRun({
    level, hours, nutrition, health: health0, fullHealth, regenerating,
    poisoned: false,
  });

  let health = night.health;
  if (quality !== 0) {
    const bonus = Math.floor(night.gained * quality / 2);
    health = Math.min(fullHealth, health + bonus);
  }

  return { health, gained: health - health0 };
}

// ---------------------------------------------------------------------------
// Self-test
// ---------------------------------------------------------------------------
//
// Runs the six models at parameters chosen to be recognisable rather than
// interesting, and checks the figures that are evidence rather than output: the
// dice enumeration, the five 2012 bed measurements, and the level 1 spell that
// cannot fail. check_all.mjs does not run this; it is here so that a change to
// the file announces itself.
function main() {
  const pct = x => (x * 100).toFixed(2).padStart(6) + '%';
  const num = (x, d = 3) => x.toFixed(d).padStart(8);
  let failures = 0;

  console.log('mech_ref -- rolling the dice, 200000 trials each\n');

  // 1. The dice game. The shipped archive's own enumeration over all 216
  // throws is 96 win / 50 push / 70 lose and +0.306 obols a game, +0.421 with
  // Gambling; the sample should land on those. This is a fixed seed, so the
  // comparison is deterministic and a tolerance of one part in a hundred is
  // slack, not luck.
  console.log('1. inn dice game');
  for (const gambling of [false, true]) {
    const d = refDice({ gambling }, 200000, mulberry32(1001));
    const label = gambling ? 'with Gambling ' : 'plain         ';
    const nets = Object.keys(d.dist).map(Number).sort((a, b) => a - b);
    console.log(`   ${label} win ${pct(d.wins)}  push ${pct(d.pushes)}  lose ${pct(d.losses)}` +
                `  mean ${num(d.mean)} obols`);
    console.log(`                 net ` + nets.map(n => `${n}:${(d.dist[String(n)] * 100).toFixed(1)}%`).join('  '));
    const want = gambling ? 0.4213 : 0.3056;
    if (Math.abs(d.mean - want) > 0.01) {
      console.error(`   FAIL mean ${d.mean} is not ${want}`);
      failures++;
    }
  }
  const exact = refDice({ gambling: false }, 200000, mulberry32(1001));
  for (const [what, got, want] of [['win', exact.wins, 96 / 216], ['push', exact.pushes, 50 / 216],
                                   ['lose', exact.losses, 70 / 216]]) {
    if (Math.abs(got - want) > 0.01) {
      console.error(`   FAIL ${what} ${got} is not ${want}`);
      failures++;
    }
  }

  // 2. Combat. A middling fighter with a sword (damage 30 per the gear table)
  // against a defender of the same reflex, once bare and once behind a shield.
  // With the miss test first, the two rows must show the SAME miss rate -- the
  // shield takes its share out of the hits alone -- and that is asserted, since
  // it is the whole difference the correction made.
  console.log('\n2. combat, one exchange (reflex 20 v 20, sword damage 30, skill 10)');
  const combatMiss = [];
  for (const shield of [null, 20]) {
    const c = refCombat({
      attackerReflex: 20, defenderReflex: 20, weaponSkill: 10,
      attackSkill: 5, defenceSkill: 5, shieldBlock: shield, shieldSkill: 5,
      damage: 30, enchant: 0,
    }, 200000, mulberry32(2002));
    combatMiss.push(c.miss);
    const label = shield === null ? 'no shield  ' : 'shield 20  ';
    console.log(`   ${label} miss ${pct(c.miss)}  parry ${pct(c.parry)}  hit ${pct(c.hit)}` +
                `  mean damage ${num(c.meanDamage, 2)}`);
    const top = Object.entries(c.words).filter(([, f]) => f > 0)
      .map(([w, f]) => `${w} ${(f * 100).toFixed(1)}%`).join(', ');
    console.log(`                ${top}`);
  }
  if (Math.abs(combatMiss[0] - combatMiss[1]) > 0.01) {
    console.error(`   FAIL a shield changed the miss rate: ${combatMiss[0]} v ${combatMiss[1]}`);
    failures++;
  }

  // 3. Locks. The difficulty term rounds up, so the chest (15) and the oak
  // door (10) cost the same five points as a lock of 20 would; only a lock of 0
  // is free.
  console.log('\n3. lock picking (reflex 20)');
  for (const difficulty of [0, 10, 15, 60, 255]) {
    const l = refLock({ reflex: 20, difficulty }, 200000, mulberry32(3003));
    console.log(`   difficulty ${String(difficulty).padStart(3)}   open ${pct(l.open)}   breaks ${pct(l.breaks)}`);
  }

  // 4. Casting. Fireball is level 5; Directed Nexus is level 1, and level 1 is
  // the assertion: Random(0, 1) is always 0, so no cast of it can fizzle at any
  // Casting figure, including 0.
  console.log('\n4. casting (fizzle rate)');
  for (const casting of [0, 2, 5, 10]) {
    const row = [1, 5, 8].map(level =>
      `level ${level}: ${pct(refCast({ casting, level }, 200000, mulberry32(4004)))}`);
    console.log(`   Casting ${String(casting).padStart(2)}   ` + row.join('   '));
  }
  for (const casting of [0, 1, 2, 5, 10, 30]) {
    const f = refCast({ casting, level: 1 }, 50000, mulberry32(4005));
    if (f !== 0) {
      console.error(`   FAIL a level 1 spell fizzled ${pct(f)} of the time at Casting ${casting}`);
      failures++;
    }
  }
  console.log('   level 1 never fizzles, at every Casting figure tried: ok');

  // 5. Hunger. Eight hours at level 6 on a full belly, and the same starving.
  console.log('\n5. hunger and healing, 8 hours at level 6 (full health 100)');
  for (const [what, p] of [
    ['fed        ', { level: 6, hours: 8, nutrition: 24, health: 40, fullHealth: 100 }],
    ['starving   ', { level: 6, hours: 8, nutrition: 0, health: 40, fullHealth: 100 }],
    ['poisoned   ', { level: 6, hours: 8, nutrition: 24, health: 40, fullHealth: 100, poisoned: true }],
    ['dying      ', { level: 6, hours: 8, nutrition: 0, health: 3, fullHealth: 100, poisoned: true }],
    ['regenerating', { level: 6, hours: 8, nutrition: 24, health: 40, fullHealth: 100, regenerating: true }],
  ]) {
    const h = refHungerRun(p);
    console.log(`   ${what}  nutrition ${String(h.nutrition).padStart(2)}  health ${String(h.health).padStart(3)}` +
                `  gained ${String(h.gained).padStart(4)}${h.died ? '  DIED' : ''}`);
  }

  // 6. Sleep, and the five figures from March 2012. One hour each, health well
  // under a full bar so the cap never bites.
  console.log('\n6. sleeping -- the 2012 bed measurements, health an hour');
  const beds = [
    ['level 6, fed, quality 4                   ', { level: 6, hours: 1, quality: 4, nutrition: 24, regenerating: false }, 12],
    ['level 6, fed, quality 4, regenerating     ', { level: 6, hours: 1, quality: 4, nutrition: 24, regenerating: true }, 42],
    ['level 6, starving, quality 4, regenerating', { level: 6, hours: 1, quality: 4, nutrition: 0, regenerating: true }, 30],
    ['level 6, fed, quality 3                   ', { level: 6, hours: 1, quality: 3, nutrition: 24, regenerating: false }, 10],
    ['level 6, fed, quality 3, regenerating     ', { level: 6, hours: 1, quality: 3, nutrition: 24, regenerating: true }, 35],
  ];
  for (const [what, p, want] of beds) {
    const s = refSleep(Object.assign({ health: 1, fullHealth: 1000 }, p));
    const ok = s.gained === want;
    console.log(`   ${what}  gained ${String(s.gained).padStart(3)}   want ${String(want).padStart(3)}   ${ok ? 'ok' : 'FAIL'}`);
    if (!ok) failures++;
  }

  // Level 7 must give the same figures as level 6 -- they share a healing
  // period -- and a quality of 0 must be the engine's rate alone. Both are
  // free to check and both would catch a period table off by one row.
  const seven = refSleep({ level: 7, hours: 1, quality: 4, nutrition: 24, health: 1, fullHealth: 1000 });
  if (seven.gained !== 12) { console.error(`   FAIL level 7 quality 4 gained ${seven.gained}, want 12`); failures++; }
  const bare = refSleep({ level: 6, hours: 1, quality: 0, nutrition: 24, health: 1, fullHealth: 1000 });
  if (bare.gained !== 4) { console.error(`   FAIL level 6 on the ground gained ${bare.gained}, want 4`); failures++; }

  console.log(failures ? `\n${failures} failed` : '\nall ok');
  return failures ? 1 : 0;
}

// Run only when executed directly, so an importing harness gets the functions
// and none of the output. pathToFileURL rather than a `file://` template: the
// template gets a path with a space in it wrong, and this tree has "Cythera
// Data" in half its paths.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main());
}
