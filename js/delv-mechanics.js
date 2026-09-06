/* delv-mechanics.js — Cythera's rules as models: the arithmetic of the game,
   worked out exactly rather than described.

   WHAT THIS IS. The Mechanics sheet reads Cythera's rules off the archive's
   own scripts and states them in prose: the dice game pays this, a blow lands
   when that, a lock opens when the other. Prose is where a rule can be read;
   it is not where a rule can be *seen*. "Reflex plus a roll of 0 to 29, less
   the defender's reflex plus a roll of 0 to 29" tells a reader nothing about
   how often a blow lands against an even opponent, and the answer -- a shade
   under half, with a long tail either way -- is the interesting part. Every
   function here turns one of those sentences into numbers a picture can be
   drawn from.

   WHY IT IS A FILE OF ITS OWN, AND WHY IT HOLDS NO MARKUP. The rule in
   CLAUDE.md is that the line is the DOM: bytes to bytes goes in js/, bytes to
   something on screen stays in the page. These are numbers to numbers, so they
   are here; the figures that draw them are in index.html beside the sheet that
   shows them, because a chart is presentation and its class names are the
   page's. Nothing in this file touches the document, reads the open archive,
   or knows what a resource is. It is handed plain numbers -- usually numbers
   the page has just read out of a script -- and hands back plain numbers.

   That is also what makes it checkable, which is the whole point. A closed
   form is exactly the kind of code that is wrong quietly: it produces a
   plausible curve whatever it computes, and no snapshot will ever complain.
   So `utilities/mech_ref.mjs` implements the same rules the obvious slow way
   -- roll the dice a few hundred thousand times and count -- written from the
   prose rather than from this file, and `utilities/mech_check.mjs` requires
   the two to agree. That is the same arrangement delvmod gives the archive
   decoders and the port gives the classic-Mac ones: two implementations, one
   set of rules, neither derived from the other.

   THE ROLL CONVENTION, SETTLED IN THE EXECUTABLE. `Random(a, b)` yields
   a .. b-1 -- `b - a` equally likely values, the top one short of b. That is
   not inferred from the scripts: `cbrnd` in the PowerPC binary is
   `a + (rand mod (b - a))`, returning a unchanged when a >= b. Four things in
   the archive agree with it, the plainest being the 31 places a script writes
   `Random(0, len(array))` and uses the result as an index into that array.
   So the combat routines' operand of 30 is a roll of 0 to 29, the lock
   helper's 19 is a roll of 0 to 18, and a script that wanted an inclusive top
   wrote the `+ 1` itself -- as the resolver does for the shield's block and
   for the damage. Every roll below follows that reading, and where a script
   adds its own 1 this file adds it in the same place.

   Distributions are `Map`s from an integer outcome to its probability. They
   are small -- a few dozen entries -- so nothing here is clever about them,
   and every combination is done by honest convolution rather than by an
   identity that would need proving. */

/* ---- distributions ------------------------------------------------------
   Enough of a kit to add two rolls together and ask what came out. A Map
   rather than an array because the outcomes are signed and sparse: a combat
   margin runs from about -60 to +60 and none of the code below wants to
   think about where zero sits in an array. */

// The uniform roll `lo` to `hi`, both ends included.
function mechUniformDist(lo, hi) {
  const d = new Map(), n = hi - lo + 1;
  for (let v = lo; v <= hi; v++) d.set(v, 1 / n);
  return d;
}
// The distribution of the sum of two independent things.
function mechConvolve(a, b) {
  const out = new Map();
  for (const [x, px] of a) for (const [y, py] of b) out.set(x + y, (out.get(x + y) || 0) + px * py);
  return out;
}
function mechShiftDist(d, k) { const o = new Map(); for (const [v, p] of d) o.set(v + k, p); return o; }
function mechNegateDist(d) { const o = new Map(); for (const [v, p] of d) o.set(-v, p); return o; }
function mechDistMean(d) { let s = 0; for (const [v, p] of d) s += v * p; return s; }
// The weight a distribution puts on the outcomes a predicate accepts.
function mechDistWeight(d, pred) { let s = 0; for (const [v, p] of d) if (pred(v)) s += p; return s; }
// Sorted [value, probability] pairs, which is what a chart wants.
function mechDistPairs(d) { return [...d.entries()].sort((a, b) => a[0] - b[0]); }

/* ---- the inn dice game --------------------------------------------------
   Three dice: the innkeeper's first (a), yours (b), the innkeeper's second
   (c), each one to six -- 0 to 5 here, since only the differences matter.
   The payout is the announced figure; the script pays one less than it
   announces, that one being the stake it already took, and takes one more on
   a loss, so the net is `payout - 1` and a payout of nothing is -1. A payout
   of 1 is therefore a push: you get your stake back and the game goes again.

   This is the same arithmetic `diceGame()` in the page enumerates for the
   headline figures; it is restated here because the simulator plays single
   games and the exact enumeration below has to agree with it throw for
   throw, and because the page's version returns only the totals. */
function mechDicePayout(a, b, c) {
  if (a === b) return 2;
  if (a < c) { if (b < a) return a - b; if (b > c) return b - c; return 0; }
  if (b < c) return c - b;
  if (b > a) return b - a;
  return 0;
}
function mechDiceNet(payout) { return payout === 0 ? -1 : payout - 1; }

// One game, played. `gambling` gives your die the skill's one-in-six chance
// of being set to the innkeeper's first when the two differed, which is what
// the script does; `roll` is a function returning a face 0..5 so the caller
// owns the randomness and a test can replay a game.
function mechDicePlay(roll, opts) {
  const gambling = !!(opts && opts.gambling);
  const a = roll(), thrown = roll(), c = roll();
  let b = thrown, helped = false;
  if (gambling && a !== thrown && roll() === 0) { b = a; helped = true; }
  const payout = mechDicePayout(a, b, c);
  return { a, b, c, thrown, helped, payout, net: mechDiceNet(payout) };
}

/* Every throw there is, weighted. With the skill the one-in-six branch is
   enumerated too rather than sampled, so the exact answer stays exact: each
   (a, b, c) with a != b contributes five sixths of itself and one sixth of
   the same throw with your die set to a.

   `cells` is the whole game as one picture: for each of the 36 (a, c) pairs,
   the net obols for each of your six faces. 216 numbers, which is the entire
   game -- there is nothing else to know about it -- and it fits on a phone. */
function mechDiceExact(opts) {
  const gambling = !!(opts && opts.gambling);
  const dist = new Map();
  const put = (net, w) => dist.set(net, (dist.get(net) || 0) + w);
  const cells = [];
  for (let a = 0; a < 6; a++) for (let c = 0; c < 6; c++) {
    const row = [];
    for (let b = 0; b < 6; b++) {
      const plain = mechDiceNet(mechDicePayout(a, b, c));
      row.push(plain);
      const w = 1 / 216;
      if (gambling && a !== b) { put(plain, w * 5 / 6); put(mechDiceNet(mechDicePayout(a, a, c)), w / 6); }
      else put(plain, w);
    }
    cells.push({ a, c, row });
  }
  return {
    dist, cells,
    mean: mechDistMean(dist),
    wins: mechDistWeight(dist, v => v > 0),
    pushes: mechDistWeight(dist, v => v === 0),
    losses: mechDistWeight(dist, v => v < 0)
  };
}

// A run of games, for the simulator. Returns the tally and the running mean
// after each game, which is what the convergence line is drawn from; the
// samples are thinned to `track` points so a hundred thousand games is still
// a few hundred numbers.
function mechDiceRun(roll, games, opts) {
  const track = (opts && opts.track) || 240;
  const tally = { games: 0, wins: 0, pushes: 0, losses: 0, net: 0, dist: new Map(), curve: [] };
  const every = Math.max(1, Math.floor(games / track));
  for (let i = 0; i < games; i++) {
    const g = mechDicePlay(roll, opts);
    tally.games++;
    tally.net += g.net;
    if (g.net > 0) tally.wins++; else if (g.net === 0) tally.pushes++; else tally.losses++;
    tally.dist.set(g.net, (tally.dist.get(g.net) || 0) + 1);
    if (i % every === 0 || i === games - 1) tally.curve.push([tally.games, tally.net / tally.games]);
  }
  tally.mean = tally.games ? tally.net / tally.games : 0;
  return tally;
}

/* ---- combat -------------------------------------------------------------
   The margin is one number made of six terms and two rolls:

       attacker's reflex + the weapon's skill + roll(0..29)
     - defender's reflex - roll(0..29)
     + the attacker's Attack - the defender's Defence
     + the weapon's enchantment

   so its distribution is a constant plus the difference of two uniform rolls,
   which is the triangle every gambler knows.

   The resolver tests it in this order, read off `0xE87` in the shipped
   archive: **a margin of nothing or less misses**, and only a margin that
   survived that is offered to the shield -- each shielding item the defender
   wears rolls `Random(0, block + 1 + Shield)`, the rolls are summed, and a
   margin under the total is parried. The order matters to every share this
   returns: a blow that would have missed cannot be parried, so the parry
   share is drawn entirely out of the hits and the miss share is exactly the
   weight the margin puts at zero and below.

   A hit does **1 + Random(0, the damage figure) + the enchantment** -- one to
   the figure, not zero to it, and the weapon's skill widens the figure before
   the roll rather than being added to the result. The blow is named by
   thresholds the page reads off the resolver rather than by anything
   hardcoded here, and it is named from the raw roll: resistance is applied
   afterwards, so "crushed" can still come to nothing.

   `words` is that list, `[{below, word}, ...]` from `combatRules()`, with
   `last` the name for a blow above the largest threshold. Passing them in
   rather than writing them down keeps the picture a reading of the open
   archive, like everything else on the sheet. */
const MECH_BLOW_WORDS = [{ below: 3, word: 'grazed' }, { below: 6, word: 'hit' }, { below: 9, word: 'hit hard' },
  { below: 12, word: 'very hard' }, { below: 16, word: 'extremely hard' }, { below: 20, word: 'crushed' },
  { below: 25, word: 'smashed' }, { below: 35, word: 'ground to dust' }];

function mechCombatExact(p, words, last) {
  const roll = () => mechUniformDist(0, 29);
  const k = (p.attackerReflex || 0) + (p.weaponSkill || 0) - (p.defenderReflex || 0)
          + (p.attackSkill || 0) - (p.defenceSkill || 0) + (p.enchant || 0);
  const margin = mechShiftDist(mechConvolve(roll(), mechNegateDist(roll())), k);

  // The shield. A block figure of null is no shield at all, which is not the
  // same as a block of 0: with a shield of 0 the roll is always 0 and only a
  // margin below zero is parried, which the miss test would have caught
  // anyway. B is inclusive here -- see the roll convention in the header.
  const B = (p.shieldBlock === null || p.shieldBlock === undefined) ? null : (p.shieldBlock || 0) + (p.shieldSkill || 0);
  const parryAt = m => B === null ? 0 : Math.min(1, Math.max(0, (B - m) / (B + 1)));

  let parry = 0, miss = 0, hit = 0;
  for (const [m, pm] of margin) {
    if (m <= 0) { miss += pm; continue; }     // the miss test is first
    const pp = pm * parryAt(m);
    parry += pp;
    hit += pm - pp;
  }

  // The damage, given a hit: one to the figure, plus the enchantment, with
  // the skill widening the figure. Whether the skill reaches it at all is a
  // separate question the script does not answer -- see the note beside the
  // combat figure in index.html -- so it is a parameter rather than a fact.
  const dmgRoll = mechShiftDist(mechUniformDist(1, Math.max(1, (p.damage || 0) + (p.weaponSkill || 0))), (p.enchant || 0));
  const ws = (words && words.length ? words : MECH_BLOW_WORDS).slice().sort((a, b) => a.below - b.below);
  const named = ws.map(w => ({ word: w.word, below: w.below, p: 0 }));
  named.push({ word: last || 'shredded', below: null, p: 0 });
  for (const [v, pv] of dmgRoll) {
    let i = ws.findIndex(w => v < w.below);
    if (i < 0) i = named.length - 1;
    named[i].p += pv * hit;
  }

  return { margin, miss, parry, hit, damage: dmgRoll, meanDamage: mechDistMean(dmgRoll), words: named, constant: k };
}

/* ---- locks --------------------------------------------------------------
   A pick opens the lock when reflex + roll(0..18) is at least 20 + roll(0..18)
   + 5 for every 20 of the lock's difficulty, and breaks otherwise. Both rolls
   are the same size, so this is the triangle again: the chance is the weight
   the difference of two 0..18 rolls puts at or above one number.

   The difficulty term is written `(data1 + 19) / 20 * 5` in the helper, which
   is five per twenty **rounded up** rather than down: a lock of difficulty 1
   already costs the full five, and only a difficulty of 0 costs nothing. That
   is what makes the curve a staircase, and it is worth drawing because it
   says something no reading of the sentence does -- the chest's parameter of
   15 and a parameter of 20 are the same lock, and a hundred lock-picking
   difficulties in the archive collapse to a dozen distinct locks. */
function mechLockThreshold(difficulty) { return 20 + 5 * Math.ceil(Math.max(0, difficulty) / 20); }
function mechLockChance(reflex, difficulty) {
  const diff = mechConvolve(mechUniformDist(0, 18), mechNegateDist(mechUniformDist(0, 18)));
  return mechDistWeight(diff, d => reflex + d >= mechLockThreshold(difficulty));
}

/* ---- casting ------------------------------------------------------------
   The cast fails when two rolls of 0 to the caster's Casting figure together
   fall short of a roll of 0 to the spell's level -- both `Random` calls, so
   both stop one short of the figure named. Two consequences the curve shows
   and the sentence does not: a **level 1 spell can never fail**, because the
   level's roll is `Random(0, 1)` and is always 0; and the first few points of
   Casting are worth far more than the next ten. */
function mechCastFailure(casting, level) {
  const c = Math.max(0, casting | 0), l = Math.max(0, level | 0);
  const one = n => mechUniformDist(0, Math.max(0, n - 1));   // Random(0, n)
  const pair = mechConvolve(one(c), one(c));
  const lv = one(l);
  let fail = 0;
  for (const [s, ps] of pair) for (const [y, py] of lv) if (s < y) fail += ps * py;
  return fail;
}

/* ---- experience, levels and the figures that follow ---------------------
   The level rises when experience passes 100 x 2^(level-1), so the thresholds
   double: 100, 200, 400, 800, and a level costs as much as everything before
   it put together. Experience is capped at 65,535, which the chart's last
   step runs into -- there is a level nothing in the game can reach. */
function mechLevelThreshold(level) { return 100 * Math.pow(2, Math.max(1, level) - 1); }
function mechLevelForExp(exp) { let l = 1; while (exp > mechLevelThreshold(l) && l < 20) l++; return l; }
function mechExpCap() { return 65535; }
// Full health: body + reflex/2 + level, plus Defence x 5 x reflex / 15. The
// divisions are integer, which is why the figure steps rather than slopes.
function mechFullHealth(p) {
  const body = p.body || 0, reflex = p.reflex || 0, level = p.level || 1, defence = p.defence || 0;
  return body + Math.floor(reflex / 2) + level + Math.floor(defence * 5 * reflex / 15);
}
// Full magic the same way, with mind for body and Mana for Defence.
function mechFullMagic(p) {
  const mind = p.mind || 0, reflex = p.reflex || 0, level = p.level || 1, mana = p.mana || 0;
  return mind + Math.floor(reflex / 2) + level + Math.floor(mana * 5 * reflex / 15);
}

/* ---- the clock, hunger, healing and a night's sleep ---------------------
   The engine's side, from the executable rather than the scripts (the
   workbench's doc/game-clock.md is the trace). The clock counts 1/4096 of an
   hour. Every hour nutrition falls by one; while it is above zero health and
   magic each rise by one at a period set by the level, which is the same
   thing as a rate per hour:

       level 1        one an hour
       levels 2-3     two
       levels 4-5     three
       levels 6-7     four
       level 8 up     five

   and a regenerating character -- flag 12, what Omen's ring grants, and what
   the cheat key toggles -- gains one every six minutes, ten an hour, fed or
   not. A poisoned one loses one every six minutes and dies rather than
   falling below 1.

   These rates are why the 2012 bed measurements come out: they are the only
   arithmetic in the sleep rule that is not the script's own. */
function mechClockUnitsPerHour() { return 4096; }
// The period between two points of healing, in minutes. Stated as a period
// rather than a rate because that is what the tick routine tests, and because
// 4096 has no factor of three or five: twenty minutes is 1365 and a third
// clock units, so a loop over clock units would have to invent a rounding the
// rule does not give. Minutes divide 60, 30, 20, 15, 12 and 6 exactly, and
// the reference implementation steps in them for the same reason.
function mechHealPeriodMinutes(level) {
  const l = Math.max(1, level | 0);
  return l === 1 ? 60 : l <= 3 ? 30 : l <= 5 ? 20 : l <= 7 ? 15 : 12;
}
function mechHealRate(level) { return 60 / mechHealPeriodMinutes(level); }
function mechRegenRate() { return 10; }   // one every six minutes

/* A stretch of time, minute by minute, returning the hourly series a chart
   wants. A minute is the step because the four things that happen have
   periods of 60, 12 to 60, 6 and 6 minutes and no coarser step divides them
   all; an hourly step gets the totals right and the death wrong, which
   matters because the only interesting thing about poison is when it kills.

   The order within a minute is nutrition, then the level's healing, then
   regeneration, then poison. It is visible in exactly two places: the hour
   that empties the belly heals or does not, and a character on 1 health who
   is both poisoned and regenerating lives. Both readings are stated in
   utilities/mech_ref.mjs, which takes the same one. */
function mechHungerRun(p) {
  const hours = Math.max(0, p.hours || 0);
  const full = p.fullHealth === undefined ? 100 : p.fullHealth;
  const period = mechHealPeriodMinutes(p.level || 1);
  let nutrition = p.nutrition === undefined ? 100 : p.nutrition;
  let health = p.health === undefined ? full : p.health;
  const start = health;
  const series = [{ hour: 0, nutrition, health }];
  let died = false;
  for (let m = 1; m <= hours * 60 && !died; m++) {
    if (m % 60 === 0) nutrition = Math.max(0, nutrition - 1);
    if (nutrition > 0 && m % period === 0) health = Math.min(full, health + 1);
    if (p.regenerating && m % 6 === 0) health = Math.min(full, health + 1);
    if (p.poisoned && m % 6 === 0) { if (health - 1 < 1) died = true; else health -= 1; }
    if (m % 60 === 0) series.push({ hour: m / 60, nutrition, health });
  }
  return { series, nutrition, health, died, gained: health - start };
}

/* A night in a bed. The helper passes the night a quarter hour at a time and
   then, when the quality is not zero, adds what the sleeper healed during it
   times the quality over two -- so the total is the engine's healing times
   (1 + quality/2), and the player's own bed at quality 4 is three times the
   rate. The five figures a player measured in March 2012 are exactly this;
   utilities/mech_check.mjs requires them, which is the closest thing this
   rule has to an oracle and is worth more than any amount of re-reading. */
function mechSleepGain(p) {
  const run = mechHungerRun({ hours: p.hours || 8, level: p.level || 1, nutrition: p.nutrition,
    health: p.health, fullHealth: p.fullHealth, regenerating: p.regenerating, poisoned: p.poisoned });
  const engine = run.gained;
  const quality = p.quality || 0;
  const bonus = quality ? Math.floor(engine * quality / 2) : 0;
  const full = p.fullHealth === undefined ? 100 : p.fullHealth;
  const start = p.health === undefined ? full : p.health;
  const health = Math.min(full, start + engine + bonus);
  return { engine, bonus, gained: health - start, health, multiplier: quality ? 1 + quality / 2 : 1, died: run.died };
}
// The healing a bed of this quality gives per hour, which is what the bed
// table on the sheet is: the engine's rate for the level, plus the ring where
// it is worn, times the bed's multiplier.
function mechBedRate(level, quality, opts) {
  const fed = !opts || opts.fed !== false;
  const rate = (fed ? mechHealRate(level) : 0) + (opts && opts.regenerating ? mechRegenRate() : 0);
  return rate * (quality ? 1 + quality / 2 : 1);
}
