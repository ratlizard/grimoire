/* The Mechanics sheet: its figures, the patches and compare tools, and the sheet itself.

   One of the fourteen js/page-*.js files that were index.html's inline
   script until 16 September 2026, cut at its own section banners and
   nowhere else, so every function is where it was in the one file. This
   tier knows the page's furniture: js/mac-*.js know nothing of Cythera,
   js/delv-*.js know the formats but not the page, and these know both.
   They are classic scripts, never modules, because the page has to work
   from a file:// origin, and they share one global scope, so a name
   declared in any of them is reachable from all. The order only decides
   what has run when a statement runs at load time; the one such statement
   that needed a later file, the brand line, stayed in the page after the
   last of these. File 11 of 14. */

/* ---- the pictures on the Mechanics sheet ---------------------------------
   The sheet states each rule in prose and then, since 6 September 2026, draws
   it. The reason is the dice game: "your die outside the two black ones wins
   the distance to the nearer" is exact, complete, and tells nobody whether
   the game is worth playing. The 216 throws drawn as 216 coloured cells
   answer that at a glance, and every other rule here had the same gap between
   being stated and being understood -- how often a blow lands, what a shield
   is worth, why a lock of difficulty 19 is a lock of difficulty 0, how much
   of a spell's failure is the caster and how much the spell.

   Two rules govern what is drawn. **Nothing is invented**: every number in
   every figure is either read out of the open archive by the functions above,
   or computed from those numbers by js/delv-mechanics.js, which is checked
   against an independent simulation by utilities/mech_check.mjs. And **a
   figure must say something the table does not**; where it would only repeat
   a column, there is no figure. Weapons get bars because the ordering is the
   point, shops get a price distribution because the range is the point, and
   the skill table gets none.

   The chart builders are here rather than in js/ because they emit markup and
   the class names are the page's; the arithmetic they draw is in js/ because
   it is numbers and can be checked. That is the same line as everywhere else
   in this repository, drawn in the same place. */

const MECH_INK = {
  gold: 'rgb(249,248,111)', ink: '#d3c9a6', dim: '#7d745a',
  hit: '#9ec254', miss: '#8a7f63', parry: '#6ba8bf',
  win: '#9ec254', push: '#6e6952', lose: '#c0684f',
  cool: '#6ba8bf', warm: '#c0684f', leaf: '#9ec254', violet: '#b08fd0'
};
// Series colours, chosen by eye against the planks: the page's own gold
// first, then three that stay apart from it and from each other on a dark
// ground. Not the game's CLUT -- that palette is Cythera's artwork and
// reading a chart is not looking at the game.
const MECH_SERIES = [MECH_INK.gold, MECH_INK.cool, MECH_INK.warm, MECH_INK.leaf, MECH_INK.violet];

function mechFig(title, body, caption) {
  return '<figure class="mechFig">' + (title ? '<div class="mechFigTitle">' + svEsc(title) + '</div>' : '') +
    body + (caption ? '<figcaption>' + caption + '</figcaption>' : '') + '</figure>';
}
// Horizontal bars: a label, a track, a figure. `rows` are {label, value,
// colour, text, html}; the value sets the width and `text` overrides what is
// printed at the end of it.
function mechBars(rows, opts) {
  opts = opts || {};
  const max = opts.max || rows.reduce((m, r) => Math.max(m, Math.abs(r.value) || 0), 0) || 1;
  return '<div class="mechBars">' + rows.map(r =>
    '<span class="bLabel" title="' + svEsc(r.title || r.label) + '">' + (r.html || svEsc(r.label)) + '</span>' +
    '<span class="bTrack"><span class="bFill" style="left:0;width:' + (100 * Math.min(1, Math.abs(r.value || 0) / max)).toFixed(2) +
      '%;background:' + (r.colour || opts.colour || MECH_INK.gold) + '"></span></span>' +
    '<span class="bVal">' + svEsc(r.text !== undefined ? r.text : String(r.value)) + '</span>').join('') + '</div>';
}
// One bar cut into shares, with a key under it. The shares are drawn in the
// order given and the key prints each as a percentage.
function mechStackBar(parts) {
  const total = parts.reduce((s, p) => s + Math.max(0, p.value), 0) || 1;
  return '<div class="mechStack">' + parts.map(p =>
      '<i style="width:' + (100 * Math.max(0, p.value) / total).toFixed(3) + '%;background:' + p.colour + '" title="' + svEsc(p.label) + '"></i>').join('') + '</div>' +
    '<div class="mechKeys">' + parts.map(p =>
      '<span><i style="background:' + p.colour + '"></i>' + svEsc(p.label) + ' <b>' + (100 * p.value / total).toFixed(1) + '%</b></span>').join('') + '</div>';
}
// Columns, for a distribution. A bin may carry a second value, drawn as a
// dashed rule across the column: that is how a sampled result is laid over
// the exact one without a second chart.
function mechColumns(bins, opts) {
  opts = opts || {};
  const max = opts.max || bins.reduce((m, b) => Math.max(m, b.value, b.mark === undefined ? 0 : b.mark), 0) || 1;
  return '<div class="mechCols" style="height:' + (opts.height || 96) + 'px">' + bins.map(b =>
      '<span class="cCol" title="' + svEsc(b.title || (b.label + ': ' + b.value)) + '">' +
      (b.mark === undefined ? '' : '<i class="cMark" style="bottom:' + (100 * b.mark / max).toFixed(2) + '%"></i>') +
      '<i class="cFill" style="height:' + (100 * b.value / max).toFixed(2) + '%;background:' + (b.colour || opts.colour || MECH_INK.gold) + '"></i></span>').join('') +
    '</div><div class="mechColLabels">' + bins.map(b => '<span>' + svEsc(b.label) + '</span>').join('') + '</div>';
}
/* A plot: the curves in an SVG stretched to the box, everything with words on
   it in HTML around and over it. `x` and `y` are {min, max, ticks, log};
   `series` are {points, colour, name, dash}; `marks` are {x, y, label, dot}
   placed over the plot in page coordinates. */
function mechPlot(spec) {
  const X = spec.x, Y = spec.y;
  const fx = X.log ? Math.log10 : (v => v), fy = Y.log ? Math.log10 : (v => v);
  const x0 = fx(X.min), x1 = fx(X.max), y0 = fy(Y.min), y1 = fy(Y.max);
  const sx = v => 100 * (fx(v) - x0) / ((x1 - x0) || 1);
  const sy = v => 100 - 100 * (fy(v) - y0) / ((y1 - y0) || 1);
  const grid = (Y.ticks || []).map(t => '<line x1="0" x2="100" y1="' + sy(t.v).toFixed(3) + '" y2="' + sy(t.v).toFixed(3) +
    '" stroke="rgba(155,136,80,.2)" stroke-width="1" vector-effect="non-scaling-stroke"/>').join('');
  const lines = (spec.series || []).map(s => {
    const pts = s.points.map(p => sx(p[0]).toFixed(3) + ',' + sy(p[1]).toFixed(3)).join(' ');
    return '<polyline points="' + pts + '" fill="none" stroke="' + (s.colour || MECH_INK.gold) + '" stroke-width="' + (s.width || 1.6) + '"' +
      (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + ' stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>';
  }).join('');
  // A label at the very edge of the plot would be cut off, so a mark can say
  // which side of its point to sit on, and can be nudged down the page to get
  // out of the way of the one before it.
  const marks = (spec.marks || []).map(m => '<span class="pMark' + (m.side ? ' ' + m.side : '') + '" style="left:' + sx(m.x).toFixed(2) + '%;top:' + sy(m.y).toFixed(2) + '%' +
    (m.dy ? ';margin-top:' + m.dy + 'px' : '') + (m.colour ? ';color:' + m.colour : '') + '">' +
    (m.dot ? '<i class="pDot" style="background:' + (m.colour || MECH_INK.gold) + '"></i>' : '') +
    (m.label ? '<b>' + svEsc(m.label) + '</b>' : '') + '</span>').join('');
  const named = (spec.series || []).filter(s => s.name);
  return '<div class="mechPlot">' +
    '<div class="pY">' + (Y.ticks || []).map(t => '<span style="top:' + sy(t.v).toFixed(2) + '%">' + svEsc(t.label) + '</span>').join('') + '</div>' +
    '<div class="pArea" style="height:' + (spec.height || 150) + 'px"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
      grid + lines + '</svg>' + marks + '</div>' +
    '<div class="pX">' + (X.ticks || []).map(t => '<span style="left:' + sx(t.v).toFixed(2) + '%">' + svEsc(t.label) + '</span>').join('') + '</div>' +
    '</div>' + (named.length ? '<div class="mechKeys">' + named.map(s =>
      '<span><i style="background:' + (s.colour || MECH_INK.gold) + '"></i>' + svEsc(s.name) + '</span>').join('') + '</div>' : '');
}
// A number line, for the things that are one number on a scale rather than a
// distribution: what a lesson costs, how long a status lasts, where karma
// starts. Labels alternate above and below so two close marks do not collide.
function mechNumberLine(spec) {
  const f = spec.log ? Math.log10 : (v => v);
  const a = f(spec.min), b = f(spec.max);
  const at = v => 100 * (f(Math.max(spec.min, Math.min(spec.max, v))) - a) / ((b - a) || 1);
  return '<div class="mechLine">' +
    '<div class="lRule"></div>' +
    (spec.bands || []).map(bd => '<div class="lBand" style="left:' + at(bd.from).toFixed(2) + '%;width:' +
      Math.max(0.4, at(bd.to) - at(bd.from)).toFixed(2) + '%;background:' + bd.colour + '" title="' + svEsc(bd.label || '') + '"></div>').join('') +
    (spec.marks || []).map((m, i) => '<div class="lTick" style="left:' + at(m.v).toFixed(2) + '%' + (m.colour ? ';background:' + m.colour : '') + '"></div>' +
      '<div class="lLab ' + (m.above || (i % 2 === 0 && !m.below) ? 'above' : 'below') + '" style="left:' + at(m.v).toFixed(2) + '%' +
      (m.colour ? ';color:' + m.colour : '') + '">' + svEsc(m.label) + '</div>').join('') +
    '</div>';
}

/* THE DICE GAME, ALL 216 THROWS AT ONCE. Six rows for the innkeeper's first
   die, six columns for the second, and inside each cell the six faces your
   own die could show, left to right. Red is a lost obol, grey a push, green
   a win and the brighter the more. Nothing is sampled and nothing is
   rounded: this is the whole game, and what it shows is that the winning
   cells are the ones where the innkeeper's two dice are close together --
   which is why the house loses. */
function mechNetColour(n) {
  return n < 0 ? '#8c4034' : n === 0 ? '#4a4636' : ['#5d7a3a', '#79a044', '#a3c455', '#cfe86b'][Math.min(3, n - 1)];
}
// A die, drawn: the face as pips on a rounded square. See the note by
// .mechDiceFaces for why these are not the Unicode die characters.
const MECH_PIPS = [[[1, 1]], [[0, 0], [2, 2]], [[0, 0], [1, 1], [2, 2]],
  [[0, 0], [2, 0], [0, 2], [2, 2]], [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]]];
function mechDieFace(n, size, ink) {
  const s = size || 14, face = ink || '#efeade';
  return '<svg width="' + s + '" height="' + s + '" viewBox="0 0 12 12" role="img" aria-label="a die showing ' + (n + 1) + '">' +
    '<rect x="0.5" y="0.5" width="11" height="11" rx="2.5" fill="' + face + '" stroke="rgba(0,0,0,.55)"/>' +
    MECH_PIPS[n].map(q => '<circle cx="' + (3 + q[0] * 3) + '" cy="' + (3 + q[1] * 3) + '" r="1.15" fill="#2a2419"/>').join('') + '</svg>';
}
function mechDiceMatrix(cells) {
  const name = n => 'a ' + (n + 1);
  // The faces are whatever the script rolls; past six there are no pips
  // to draw, so a number stands in.
  const face = n => n < 6 ? mechDieFace(n, 13) : '<b>' + (n + 1) + '</b>';
  const as = [...new Set(cells.map(x => x.a))].sort((x, y) => x - y), cs = [...new Set(cells.map(x => x.c))].sort((x, y) => x - y);
  let h = '<div class="mechDice" style="grid-template-columns:auto repeat(' + cs.length + ', 1fr)"><span class="dSide"></span>' +
    cs.map(c => '<span class="dHead">' + face(c) + '</span>').join('');
  for (const a of as) {
    h += '<span class="dSide">' + face(a) + '</span>';
    for (const c of cs) {
      const cell = cells.find(x => x.a === a && x.c === c);
      h += '<span class="dCell">' + cell.row.map((n, b) =>
        '<i style="background:' + mechNetColour(n) + '" title="' + name(a) + ' and ' + name(c) + ' against your ' + (b + 1) + ': ' +
        (n > 0 ? '+' + n : n) + ' obol' + (Math.abs(n) === 1 ? '' : 's') + '"></i>').join('') + '</span>';
    }
  }
  return h + '</div>';
}

/* WHAT TO EDIT. Every number the game is played with is one byte of the
   inn's script, and diceGame() has their offsets; this lays them out with
   three edits worked through, each figure computed by mechDiceExact over
   the edited numbers rather than guessed. Edit Bytes on 0x812 takes the
   hex; Changes exports the archive that plays it. */
function mechDiceBytes(dice) {
  if (!dice || !dice.bytes || !dice.bytes.length) return '';
  const hex4 = n => '0x' + n.toString(16).toUpperCase().padStart(4, '0');
  const mean = o => { const v = mechDiceExact(Object.assign({}, dice.opts, o)).mean; return (v >= 0 ? '+' : '') + v.toFixed(3); };
  const pay = dice.bytes.find(b => /match pays/.test(b.what));
  const gate = dice.bytes.find(b => /Gambling skill/.test(b.what));
  const fix = dice.bytes.find(b => /roll matched/.test(b.what));
  const rows = dice.bytes.map(b => '<tr><td>' + svEsc(b.what) + '</td>' + srcCell(b.val, hex4(b.at)) + '<td class="num">' + svEsc(String(b.now)) + '</td></tr>').join('');
  const tries = [];
  if (pay) tries.push('Write <b>00</b> at ' + hex4(pay.at) + ' and a match pays nothing: <b>' + mean({ matchPay: 0 }) + '</b> an obol a game without the skill, <b>' + mean({ matchPay: 0, gambling: true }) + '</b> with it.');
  if (pay) tries.push('Write <b>7F</b> there and a match pays 127: <b>' + mean({ matchPay: 127 }) + '</b> a game.');
  if (fix && fix.next !== null && gate && gate.next !== null && !dice.skillAlways)
    tries.push('Write <b>' + hex4(fix.next).slice(2) + '</b> at ' + hex4(fix.at) + ' and the skill’s fix-up runs whatever it rolled, so every game with Gambling is a match: <b>' + mean({ skillAlways: true, gambling: true }) + '</b> a game. Write <b>' + hex4(gate.next).slice(2) + '</b> at ' + hex4(gate.at) + ' as well and no skill is needed.');
  return '<div class="mechSub">What to edit</div>' +
    '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><thead><tr><th>byte</th><th class="num">at, in 0x812</th><th class="num">now</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p class="mechLede">A two-byte entry is a branch target, the offset of the instruction the test jumps to when it fails; the offset of the instruction after it turns the test into a fall-through. A one-byte entry is a number as the script uses it, a range of 0 to one less for a die.</p>' +
    (tries.length ? '<ul class="ruleList">' + tries.map(t => '<li>' + t + '</li>').join('') + '</ul>' : '');
}

/* THE SIMULATOR. The exact enumeration says the player wins about three
   tenths of an obol a game; the simulator is there because that sentence
   persuades nobody who has just lost four in a row, and because watching the
   running average wander and then settle is the only honest way to show what
   an edge that small feels like. It plays the script's own arithmetic --
   mechDicePlay in js/delv-mechanics.js, the same function the exact
   enumeration is built from -- so the two cannot drift apart. */
let DICE_SIM = { gambling: false, tally: null, last: null };
function diceSimRoll(n) { return Math.floor(Math.random() * n); }
function diceSimSet(on) { DICE_SIM = { gambling: !!on, tally: null, last: null }; diceSimRefresh(); }
function diceSimReset() { DICE_SIM.tally = null; DICE_SIM.last = null; diceSimRefresh(); }
function diceSimPlay(n) {
  const opts = Object.assign({ gambling: DICE_SIM.gambling, track: 240 }, diceOpts());
  if (n === 1) {
    DICE_SIM.last = mechDicePlay(diceSimRoll, opts);
    if (!DICE_SIM.tally) DICE_SIM.tally = { games: 0, wins: 0, pushes: 0, losses: 0, net: 0, dist: new Map(), curve: [], mean: 0 };
    const t = DICE_SIM.tally, g = DICE_SIM.last;
    t.games++; t.net += g.net;
    if (g.net > 0) t.wins++; else if (g.net === 0) t.pushes++; else t.losses++;
    t.dist.set(g.net, (t.dist.get(g.net) || 0) + 1);
    t.mean = t.net / t.games;
    t.curve.push([t.games, t.mean]);
    if (t.curve.length > 240) t.curve = t.curve.filter((p, i) => i % 2 === 0 || i === t.curve.length - 1);
  } else {
    const run = mechDiceRun(diceSimRoll, n, opts);
    const t = DICE_SIM.tally;
    if (!t) DICE_SIM.tally = run;
    else {
      // Adding a run to what is already there: the curve is re-based so the
      // line stays one continuous history rather than starting again.
      const base = t.games;
      t.games += run.games; t.net += run.net; t.wins += run.wins; t.pushes += run.pushes; t.losses += run.losses;
      for (const [k, v] of run.dist) t.dist.set(k, (t.dist.get(k) || 0) + v);
      t.mean = t.net / t.games;
      t.curve = t.curve.concat(run.curve.map(p => [base + p[0], p[1]]));
      if (t.curve.length > 480) t.curve = t.curve.filter((p, i) => i % 2 === 0 || i === t.curve.length - 1);
    }
    DICE_SIM.last = null;
  }
  diceSimRefresh();
}
function diceSimRefresh() { const el = document.getElementById('diceSim'); if (el) el.innerHTML = diceSimHtml(); }
function diceSimHtml() {
  const exact = mechDiceExact(Object.assign({ gambling: DICE_SIM.gambling }, diceOpts()));
  const t = DICE_SIM.tally;
  const nets = [...new Set([-1, 0, 1, 2, 3, 4].concat([...exact.dist.keys()]))].sort((a, b) => a - b);
  const bins = nets.map(n => ({
    label: n > 0 ? '+' + n : String(n),
    value: 100 * (exact.dist.get(n) || 0),
    mark: t ? 100 * ((t.dist.get(n) || 0) / t.games) : undefined,
    colour: mechNetColour(n),
    title: (n > 0 ? '+' + n : n) + ' obols: ' + (100 * (exact.dist.get(n) || 0)).toFixed(1) + '% of throws' + (t ? ', ' + (100 * (t.dist.get(n) || 0) / t.games).toFixed(1) + '% played' : '')
  }));
  let out = '';
  if (DICE_SIM.last) {
    const g = DICE_SIM.last;
    out += '<div class="mechDiceFaces">' + mechDieFace(g.a, 34, '#3b362b') + mechDieFace(g.b, 34) + mechDieFace(g.c, 34, '#3b362b') + '</div>' +
      '<div class="mechVerdict">' + (g.helped ? '<b>Gambling</b> set your die to the innkeeper’s first. ' : '') +
      (g.net > 0 ? 'You win <b>' + g.net + '</b> obol' + (g.net === 1 ? '' : 's') + '.' : g.net === 0 ? 'A push: your stake back.' : 'You lose <b>an obol</b>.') + '</div>';
  }
  out += mechFig('Where the obols go, exactly and as played',
    mechColumns(bins, { height: 84 }) +
    '<div class="mechKeys"><span><i style="background:' + MECH_INK.dim + '"></i>the columns are the exact chance of each result</span>' +
    (t ? '<span><i style="background:' + MECH_INK.gold + '"></i>the dashed rule is what your ' + t.games.toLocaleString() + ' games did</span>' : '') + '</div>',
    t ? 'After <b>' + t.games.toLocaleString() + '</b> games you are <b>' + (t.net > 0 ? '+' : '') + t.net.toLocaleString() +
        '</b> obols, <b>' + (t.mean >= 0 ? '+' : '') + t.mean.toFixed(3) + '</b> a game against the exact <b>' +
        (exact.mean >= 0 ? '+' : '') + exact.mean.toFixed(3) + '</b>.'
      : 'Nothing played yet. The exact figure is <b>' + (exact.mean >= 0 ? '+' : '') + exact.mean.toFixed(3) + '</b> obols a game.');
  if (t && t.curve.length > 2) {
    const ys = t.curve.map(p => p[1]);
    const lo = Math.min(-0.6, Math.min.apply(null, ys)), hi = Math.max(0.9, Math.max.apply(null, ys));
    out += mechFig('The running average, game by game', mechPlot({
      height: 110,
      x: { min: 1, max: t.games, ticks: [{ v: 1, label: '1' }, { v: t.games, label: t.games.toLocaleString() }] },
      // The zero tick is dropped when the exact figure sits almost on top of
      // it, which at three tenths of an obol on a range of one and a half it
      // very nearly does: two labels a few pixels apart read as one smudged
      // number and neither can be trusted.
      y: { min: lo, max: hi, ticks: [{ v: hi, label: hi.toFixed(1) }, { v: exact.mean, label: exact.mean.toFixed(2) }]
        .concat(Math.abs(exact.mean) / (hi - lo) > 0.09 ? [{ v: 0, label: '0' }] : [])
        .concat([{ v: lo, label: lo.toFixed(1) }]) },
      series: [
        { points: [[1, exact.mean], [t.games, exact.mean]], colour: 'rgba(249,248,111,.45)', dash: '3 3', name: 'the exact figure' },
        { points: t.curve, colour: MECH_INK.cool, name: 'your games so far' }
      ]
    }), 'An edge of three tenths of an obol takes hundreds of games to show through the noise.');
  }
  return out;
}

/* COMBAT, WITH THE NUMBERS TURNED UP AND DOWN. The rule is six terms and two
   rolls, and no amount of restating it says what a shield is worth or how
   much of a fight is the weapon. So the terms are controls and the picture
   answers: the share of blows that miss, are parried and land; the margin's
   own distribution, which is the triangle two rolls always make, with the
   parry eating into it from the left; and how often each of the game's eight
   words for a blow would be printed.

   The weapon list is the archive's own -- gearTable(), the same rows the
   table under this shows -- so a modded archive tunes the sliders to its own
   weapons. It is rebuilt on every render of the sheet rather than memoised
   for the session, and cleared with everything else archive-keyed. */
function mechWeapons() {
  if (!window.MECH_WEAPONS) {
    try {
      window.MECH_WEAPONS = gearTable().filter(g => g.damage !== null && g.damage !== undefined && g.damage > 0)
        .sort((a, b) => b.damage - a.damage);
    } catch (e) { window.MECH_WEAPONS = []; }
  }
  return window.MECH_WEAPONS;
}
function mechShields() {
  try { return gearTable().filter(g => g.block !== null && g.block !== undefined).sort((a, b) => b.block - a.block); }
  catch (e) { return []; }
}
function combatSimParams() {
  const el = id => document.getElementById(id);
  const val = (id, dflt) => { const e = el(id); return e && e.value !== undefined && e.value !== '' ? Number(e.value) : dflt; };
  const ws = mechWeapons();
  const pt = val('cbWeapon', ws.length ? ws[0].pt : 0);
  const weapon = ws.find(w => w.pt === pt) || ws[0] || { name: 'a bare hand', damage: 3, skill: 'Barehand' };
  const shields = mechShields();
  const shieldOn = (() => { const e = el('cbShield'); return e ? !!e.checked : true; })();
  const shield = shields.length ? shields[0] : null;
  return {
    weapon, shield: shieldOn ? shield : null,
    attackerReflex: val('cbAtkRef', 20), defenderReflex: val('cbDefRef', 20),
    weaponSkill: val('cbSkill', 8), attackSkill: val('cbAtk', 4), defenceSkill: val('cbDef', 4),
    enchant: 0
  };
}
// `cb` is combatRules(): the rolls, the damage's added constant and the
// blow words, all read off the routines.
function combatSimHtml(p, cb) {
  const model = {
    // As shipped the resolver's weapon-skill term adds nothing to an armed
    // blow (combatRules().skillOffLoop), and every weapon here is armed.
    attackerReflex: p.attackerReflex, defenderReflex: p.defenderReflex, weaponSkill: cb.skillOffLoop ? 0 : p.weaponSkill,
    attackSkill: p.attackSkill, defenceSkill: p.defenceSkill, enchant: p.enchant || 0,
    damage: p.weapon.damage, shieldBlock: p.shield ? p.shield.block : null, shieldSkill: p.shield ? p.weaponSkill : 0,
    roll: cb.roll.v, rollDefender: cb.rollDefender.v, dmgAdd: cb.dmgAdd.v
  };
  const words = cb.words, top = words.length ? Math.max.apply(null, words.map(w => w.below)) : null;
  const x = mechCombatExact(model, words, cb.last ? cb.last.word : '');
  const pairs = mechDistPairs(x.margin);
  const lo = pairs[0][0], hi = pairs[pairs.length - 1][0], peak = Math.max.apply(null, pairs.map(q => q[1]));
  // The bar and the number beside it are the same quantity -- the share of
  // ALL exchanges, not of the hits. They were not, for one afternoon, and a
  // bar twice the length of its own label is the sort of thing a reader
  // notices before the author does.
  const blows = x.words.filter(w => w.p > 0.0005).map((w, i) => ({
    label: w.word, value: 100 * w.p, text: (100 * w.p).toFixed(1) + '%',
    colour: MECH_SERIES[i % MECH_SERIES.length], title: w.word + (w.below ? ', under ' + w.below + ' points' : top !== null ? ', ' + top + ' points or more' : '')
  }));
  return mechFig('One exchange: ' + p.weapon.name + (p.shield ? ' against a ' + p.shield.name : ', unshielded'),
    mechStackBar([
      { label: 'lands', value: x.hit, colour: MECH_INK.hit },
      { label: 'parried', value: x.parry, colour: MECH_INK.parry },
      { label: 'misses', value: x.miss, colour: MECH_INK.miss }
    ]),
    'A blow that lands does <b>' + x.meanDamage.toFixed(1) + '</b> points on average, so an exchange is worth <b>' +
    (x.meanDamage * x.hit).toFixed(1) + '</b>.' + (p.shield ? ' The resolver tests the miss before the parry, so every parry here is a blow the shield took out of the hits.' : '') +
    (cb.skillOffLoop ? ' The weapon’s skill adds nothing to it, as shipped, so the skill moves only the shield’s roll.' : '')) +
  mechFig('The margin, and where it is spent', mechPlot({
    height: 130,
    x: { min: lo, max: hi, ticks: [{ v: lo, label: String(lo) }, { v: 0, label: '0' }, { v: hi, label: '+' + hi }] },
    y: { min: 0, max: peak * 1.08, ticks: [{ v: peak, label: (100 * peak).toFixed(1) + '%' }, { v: 0, label: '0' }] },
    series: [{ points: pairs, colour: MECH_INK.gold, name: 'the margin' }],
    marks: [{ x: 0, y: peak * 1.02, label: 'nothing or less misses' }]
  }), 'Two rolls of 0 to ' + (cb.roll.v - 1) + (cb.rollDefender.v !== cb.roll.v ? ' and 0 to ' + (cb.rollDefender.v - 1) : '') + ' make a triangle; the six other terms only slide it. Here it is centred on <b>' +
    (x.constant > 0 ? '+' : '') + x.constant + '</b>.') +
  (blows.length ? mechFig('What the game would print', mechBars(blows),
    'Of the blows that land, as a share of all exchanges. The words are read off the resolver, and each names the <b>raw roll</b>. The defender’s resistance is taken afterwards, so a blow that ground you to dust can still come to nothing.') : '');
}
function combatSimUpdate() {
  const el = document.getElementById('combatOut');
  if (!el) return;
  let cb = null;
  try { cb = combatRules(); } catch (e) { cb = null; }
  if (!cb || !cb.roll || !cb.rollDefender || !cb.dmgAdd) return;
  el.innerHTML = combatSimHtml(combatSimParams(), cb);
  for (const id of ['cbSkill', 'cbAtkRef', 'cbDefRef']) {
    const out = document.getElementById(id + 'V'), src = document.getElementById(id);
    if (out && src) out.textContent = src.value;
  }
}
function combatSimControls() {
  const ws = mechWeapons(), sh = mechShields();
  const slider = (id, label, min, max, v) => '<label>' + svEsc(label) +
    ' <input type="range" id="' + id + '" min="' + min + '" max="' + max + '" value="' + v + '" oninput="combatSimUpdate()"><b id="' + id + 'V">' + v + '</b></label>';
  return '<div class="mechCtl">' +
    (ws.length ? '<label>weapon <select id="cbWeapon" onchange="combatSimUpdate()">' +
      ws.map(w => '<option value="' + w.pt + '">' + svEsc(w.name) + ' (' + w.damage + ')</option>').join('') + '</select></label>' : '') +
    slider('cbSkill', 'your skill', 0, 15, 8) +
    slider('cbAtkRef', 'your reflex', 5, 40, 20) +
    slider('cbDefRef', 'their reflex', 5, 40, 20) +
    (sh.length ? '<label><input type="checkbox" id="cbShield" checked onchange="combatSimUpdate()"> they carry a ' + svEsc(sh[0].name) + '</label>' : '') +
    '</div>';
}

/* The rest of the sheet's figures, one function each, all of the same shape:
   they are handed what the reader functions above have already read out of
   the archive and return markup. None of them reads a resource itself. */

// Weapons ordered by what they do, which the table's row order cannot show
// as quickly, with the armour and the shields beside them on their own
// scales -- three different quantities, so three groups rather than one.
// The classes that read their aspect, counted off the listings, for the
// Mechanics prop record section (aspectReaders).
function mechAspectReaders() {
  const ar = aspectReaders();
  const w = s => '<b>' + s + '</b>';
  const nm = pt => svLink(svEsc(propDisplayName(pt) || ('prop 0x' + pt.toString(16).toUpperCase())), 'showItemDetail(' + pt + ')');
  const reads = [...ar].filter(([, v]) => v.reads).map(([pt]) => pt), writesOnly = [...ar].filter(([, v]) => !v.reads && v.writes).map(([pt]) => pt);
  if (!ar.size) return 'no item class script is in this archive.';
  let gearRead = [];
  try { gearRead = gearTable().filter(r => (ar.get(r.pt) || {}).reads).map(r => r.pt); } catch (e) { gearRead = []; }
  return w(reads.length + ' of ' + ar.size) + ' item class scripts read it (' + reads.map(nm).join(', ') + ')' +
    (writesOnly.length ? ', ' + writesOnly.length + ' more only write it, as a state of their own' : '') +
    ', and the rest never read it, so at another aspect they are the same item in every number under another picture and name. ' +
    (gearRead.length ? 'Of the weapons and armour, ' + gearRead.map(nm).join(', ') + ' read' + (gearRead.length === 1 ? 's' : '') + ' it.' : 'No weapon or piece of armour reads it.');
}
// One pair from the file that shows the two cases side by side: a weapon
// at an aspect that is a picture no class owns, and a food at an aspect
// its class reads a variant for. Empty when the archive lacks either.
function mechAspectContrast() {
  const w = s => '<b>' + s + '</b>';
  let weapon = null, food = null;
  try {
    const gear = new Set(gearTable().filter(r => r.melee).map(r => r.pt)), ar = aspectReaders();
    for (const o of orphanItemArt()) for (const r of o.reach) if (gear.has(r.pt) && !(ar.get(r.pt) || {}).reads && (!weapon || r.aspect < weapon.aspect)) weapon = { pt: r.pt, aspect: r.aspect, word: r.word, name: o.name };
    const g = weapon ? gearTable().find(r => r.pt === weapon.pt) : null;
    if (weapon && g) weapon.numbers = [g.damage !== null ? 'damage ' + g.damage : '', g.thrown ? 'thrown ' + g.thrown[0] + ' up to ' + g.thrown[1] + ' squares' : '', g.skill || ''].filter(Boolean).join(', ');
    const fs = foodRules().foods.filter(f => f.variants && f.variants.length > 1 && f.variants[1].name && f.variants[1].name !== f.variants[0].name);
    const f = fs.find(f => f.saysPer) || fs[0];
    if (f) food = { pt: f.pt, name: f.name, v0: f.variants[0], v1: f.variants[1], word: (1 << 10) | f.pt };
  } catch (e) { return ''; }
  if (!weapon || !food) return '';
  const own = propDisplayName(weapon.pt) || 'weapon';
  return 'So ' + w(propWordHex(weapon.word)) + ', ' + svLink(svEsc(own), 'propWordOpen(' + weapon.pt + ',' + weapon.aspect + ')') + ' at aspect ' + weapon.aspect + ', is a ' + w(svEsc(weapon.name)) + ' in picture and name and a ' + svEsc(own) + ' in every number' + (weapon.numbers ? ' (' + svEsc(weapon.numbers) + ')' : '') +
    ', while ' + w(propWordHex(food.word)) + ', ' + svLink(svEsc(food.name), 'propWordOpen(' + food.pt + ',1)') + ' at aspect 1, is a ' + w(svEsc(food.v1.name)) + ' that feeds +' + food.v1.plus + (food.v1.says ? ' and says “' + svEsc(food.v1.says) + '”' : '') +
    ', against +' + food.v0.plus + (food.v0.says && food.v0.says !== food.v1.says ? ' and “' + svEsc(food.v0.says) + '”' : '') + ' at aspect 0, because that class reads the aspect and the ' + svEsc(own) + '’s does not.';
}
function mechGearFigure(gear) {
  const hue = {};
  const skills = [...new Set(gear.map(g => g.skill).filter(Boolean))];
  skills.forEach((s, i) => { hue[s] = MECH_SERIES[i % MECH_SERIES.length]; });
  const arms = gear.filter(g => g.damage).sort((a, b) => b.damage - a.damage)
    .map(g => ({ label: g.name, value: g.damage, colour: hue[g.skill] || MECH_INK.dim, text: String(g.damage), title: g.name + ', ' + (g.skill || 'no skill') }));
  const armour = gear.filter(g => g.protection).sort((a, b) => b.protection - a.protection)
    .map(g => ({ label: g.name, value: g.protection, colour: MECH_INK.cool, text: String(g.protection) }));
  const shields = gear.filter(g => g.block).sort((a, b) => b.block - a.block)
    .map(g => ({ label: g.name, value: g.block, colour: MECH_INK.parry, text: String(g.block) }));
  if (!arms.length) return '';
  // Whether the resolver's skill term works, off the same reading as the
  // Combat section (combatRules().skillOffLoop): as shipped it does not.
  let offLoop = null;
  try { const cr = combatRules(); offLoop = cr && cr.skillOffLoop; } catch (e) { offLoop = null; }
  return mechFig(offLoop ? 'Damage, the most a blow can do' : 'Damage, the most a blow can do before the skill',
    mechBars(arms) + '<div class="mechKeys">' + skills.map(s => '<span><i style="background:' + hue[s] + '"></i>' + svEsc(s) + '</span>').join('') + '</div>',
    offLoop
      ? 'The resolver rolls <b>1 to this figure</b> and adds the enchantment. It is written to widen the figure by the weapon’s skill first, and as shipped that adds ' + srcNum(offLoop[1] || offLoop[0], 'nothing') + '. Colour is the skill the weapon would be swung with.'
      : 'The resolver rolls <b>1 to this figure</b> and adds the enchantment; the weapon’s skill widens the figure before the roll rather than being added after it. Colour is the skill the weapon is swung with.') +
    (armour.length ? mechFig('Armour, in points of protection', mechBars(armour)) : '') +
    (shields.length ? mechFig('Shields, the roll they block', mechBars(shields),
      'A blow that would have landed is parried when the margin is under a roll of <b>0 to this plus the Shield skill</b>, summed over every shielding thing worn. A shield is worth more against a weak attacker than a strong one, and never saves a blow that was going to miss.') : '');
}

// The casting rule is two rolls against one, which is not a shape anybody
// reads off the sentence: the first few points of Casting are worth more
// than the next ten, and a level-8 spell is a coin toss for a middling
// caster. One curve per level, over the whole range of the figure.
function mechSpellFigures(sp) {
  if (!sp.spells.length) return '';
  const levels = [...new Set(sp.spells.map(s => s.level))].sort((a, b) => a - b);
  const shown = levels.filter((l, i) => levels.length <= 5 || i === 0 || i === levels.length - 1 || i % Math.ceil(levels.length / 4) === 0);
  const series = shown.map((l, i) => ({
    name: 'level ' + l, colour: MECH_SERIES[i % MECH_SERIES.length],
    points: Array.from({ length: 26 }, (_, c) => [c, 100 * mechCastFailure(c, l)])
  }));
  const cost = sp.spells.map(s => ({ x: s.level, y: s.cost }));
  const maxCost = Math.max.apply(null, cost.map(c => c.y));
  return mechFig('How often a cast fails, by the caster’s Casting figure', mechPlot({
    height: 150, series,
    x: { min: 0, max: 25, ticks: [{ v: 0, label: '0' }, { v: 5, label: '5' }, { v: 10, label: '10' }, { v: 15, label: '15' }, { v: 20, label: '20' }, { v: 25, label: '25' }] },
    y: { min: 0, max: 100, ticks: [{ v: 100, label: '100%' }, { v: 50, label: '50%' }, { v: 25, label: '25%' }, { v: 0, label: '0' }] }
  }), 'Two rolls under the caster’s Casting figure against one under the level. A <b>level 1 spell never fails</b>, its roll being <i>Random(0, 1)</i>, which is always nothing. The magic points are spent either way, which is what makes a high-level spell expensive twice over.') +
  mechFig('What each spell costs, against its level', mechPlot({
    height: 120,
    x: { min: 0, max: Math.max.apply(null, levels) + 1, ticks: levels.map(l => ({ v: l, label: String(l) })) },
    y: { min: 0, max: maxCost * 1.1, ticks: [{ v: maxCost, label: String(maxCost) }, { v: Math.round(maxCost / 2), label: String(Math.round(maxCost / 2)) }, { v: 0, label: '0' }] },
    series: [],
    marks: cost.map(c => ({ x: c.x, y: c.y, dot: true, colour: 'rgba(107,168,191,.85)' }))
  }), '<b>' + sp.spells.length + '</b> spells. The cost rises with the level but not by any rule the scripts state, each spell names its own.');
}

// The levels double, so the only honest axis is a logarithmic one, and drawn
// that way the cap becomes visible: experience stops at 65,535 and the
// twelfth threshold is 102,400, so the eleventh level is the last one.
function mechExperienceFigure(rule) {
  if (!rule || !rule.base || !rule.cap) return '';
  const base = rule.base.v, cap = rule.cap.v;
  const levels = Array.from({ length: 12 }, (_, i) => i + 1);
  // The level passing threshold(n) reaches is n + 1; the first threshold
  // above the cap is the one that cannot be passed.
  let stuck = 1;
  while (stuck < 40 && mechLevelThreshold(stuck, base) <= cap) stuck++;
  const n = v => v.toLocaleString('en-US');
  const ord = k => ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth'][k - 1] || ('level ' + k);
  return mechFig('What each level costs', mechPlot({
    height: 140,
    x: { min: 1, max: 12, ticks: [2, 4, 6, 8, 10, 12].map(l => ({ v: l, label: String(l) })) },
    y: { log: true, min: base, max: Math.max(cap, mechLevelThreshold(12, base)) * 2, ticks: [{ v: base, label: n(base) }, { v: base * 10, label: n(base * 10) }, { v: base * 100, label: n(base * 100) }, { v: base * 1000, label: n(base * 1000) }] },
    series: [
      { points: levels.map(l => [l, mechLevelThreshold(l, base)]), colour: MECH_INK.gold, name: 'the threshold to pass' },
      { points: [[1, cap], [12, cap]], colour: MECH_INK.warm, dash: '3 3', name: 'the cap, ' + n(cap) }
    ],
    marks: stuck <= 12 ? [{ x: stuck, y: mechLevelThreshold(stuck, base), dot: true, colour: MECH_INK.warm }] : []
  }), 'Each level costs as much as every level before it put together. The ' + ord(stuck) + ' is the last: it comes past ' + n(mechLevelThreshold(stuck - 1, base)) + ' and the next needs <b>' + n(mechLevelThreshold(stuck, base)) + '</b>, which experience cannot reach.');
}

// Karma is a line from nothing to a hundred with the player put on it at 55,
// and the only two things that move it far are killing the wrong thing and
// the helpers. The kill table is four numbers and reads as a picture.
function mechKarmaFigure(km) {
  if (!km.writes.length) return '';
  const start = km.writes.find(w => w.set !== undefined);
  const thresholds = km.reads.map(r => ({ n: parseInt(String(r.test).replace(/\D+/g, ''), 10), test: r.test }))
    .filter(t => !isNaN(t.n)).filter((t, i, a) => a.findIndex(x => x.n === t.n) === i);
  const marks = thresholds.map(t => ({ v: t.n, label: String(t.n), below: true, colour: MECH_INK.warm }));
  if (start) marks.push({ v: start.set, label: 'you start at ' + start.set, above: true });
  const kills = (km.byAlignment || []).map((v, i) => ({
    label: 'alignment ' + i, value: Math.abs(v), text: (v > 0 ? '+' : '') + v,
    colour: v > 0 ? MECH_INK.leaf : v < 0 ? MECH_INK.lose : MECH_INK.dim
  }));
  return mechFig('The scale, and where you stand on it',
    mechNumberLine({ min: 0, max: 100, marks, bands: thresholds.map(t => ({ from: 0, to: t.n, colour: 'rgba(192,104,79,.3)', label: t.test })) }),
    (function () {
      const low = km.reads.filter(r => r.below);
      if (!low.length) return '';
      const n = Math.max.apply(null, low.map(r => r.n)), who = low.filter(r => r.n === n).map(r => labelFor(r.resid) || ('0x' + r.resid.toString(16).toUpperCase()));
      return who.slice(0, -1).join(', ') + (who.length > 1 ? ' and ' : '') + who[who.length - 1] + ' refuse' + (who.length === 1 ? 's' : '') + ' below <b>' + srcNum(low.find(r => r.n === n).val, n) + '</b>.';
    })()) +
    (kills.length ? mechFig('What a kill is worth, by the victim’s alignment', mechBars(kills),
      srcNum(km.byAlignmentSrc, km.byAlignment.length + ' numbers') + ' in the kill helper’s own data block, read as signed. Nothing in the file names the alignments.') : '');
}

// Nutrition falls one an hour, so a food's figure is also the hours it buys.
// Saying that in the caption is the whole point of the figure.
function mechFoodFigure(fd, belly) {
  const rows = [];
  for (const f of fd.foods) {
    if (f.variants) for (const v of f.variants) { if (v.plus) rows.push({ label: v.name || (f.name + ' ' + v.aspect), value: v.plus }); }
    else if (f.plus) rows.push({ label: f.name, value: f.plus });
  }
  if (!rows.length) return '';
  rows.sort((a, b) => b.value - a.value);
  return mechFig('What a meal is worth, in nutrition and so in hours',
    mechBars(rows.map(r => ({ label: r.label, value: r.value, text: r.value + ' h', colour: MECH_INK.leaf })), belly ? { max: belly } : {}),
    belly ? 'Against a belly of <b>' + belly + '</b> that falls by one an hour. The bars are drawn on that scale, so the whole row is about ' + Math.round(belly / 24) + ' days of walking.' : 'Nutrition falls by one an hour.');
}

// A duration is a number of 4096ths of an hour, which is unreadable as
// stored. Drawn against the hour it is obvious which of these is a spell you
// walk away from and which lasts a moment.
function mechStatusFigure(st, unit) {
  const rows = [];
  for (const [name, list] of st.applies) {
    const durs = list.map(a => a.duration).filter(d => d !== null && d !== undefined);
    if (!durs.length) continue;
    rows.push({ label: name, value: Math.max.apply(null, durs) });
  }
  if (!rows.length) return '';
  rows.sort((a, b) => b.value - a.value);
  return mechFig(unit ? 'How long a status lasts, against the game hour' : 'How long a status lasts, in clock units',
    mechBars(rows.map(r => ({ label: r.label, value: r.value, colour: MECH_INK.violet,
      text: !unit ? String(r.value) : r.value >= unit ? (r.value / unit).toFixed(r.value % unit ? 1 : 0) + ' h' : Math.round(60 * r.value / unit) + ' min' })), { max: Math.max(unit || 0, rows[0].value) }),
    'The longest duration each status is given anywhere in the archive; a call with a roll in it is left out, since it has no one number.' + (unit ? ' <b>' + unit + '</b> units is an hour, by the application’s clock.' : ''));
}

// The clock's own arithmetic, over four days: the belly empties in a hundred
// hours and everything else follows from whether it is empty.
function mechHungerFigure(belly, clock) {
  if (belly === null || belly === undefined || !clock) return '';
  const hours = 120;
  const fed = mechHungerRun({ hours, level: 6, nutrition: belly, health: 20, fullHealth: 100, clock });
  const ring = mechHungerRun({ hours, level: 6, nutrition: belly, health: 20, fullHealth: 100, regenerating: true, clock });
  const empty = belly * mechPeriodMinutes(clock, clock.hungerIndex) / 60;
  const pt = r => r.series.map(s => [s.hour, s.health]);
  return mechFig('Five days without a meal, at level 6', mechPlot({
    height: 150,
    x: { min: 0, max: hours, ticks: [0, 24, 48, 72, 96, 120].map(h => ({ v: h, label: h ? h / 24 + 'd' : '0' })) },
    y: { min: 0, max: 100, ticks: [{ v: 100, label: '100' }, { v: 50, label: '50' }, { v: 0, label: '0' }] },
    series: [
      { points: fed.series.map(s => [s.hour, s.nutrition]), colour: MECH_INK.warm, name: 'nutrition' },
      { points: pt(fed), colour: MECH_INK.gold, name: 'health, healing' },
      { points: pt(ring), colour: MECH_INK.cool, name: 'health, with Omen’s ring' }
    ],
    marks: empty <= hours ? [{ x: empty, y: 8, label: 'the belly is empty', colour: MECH_INK.warm }] : []
  }), 'Health rises <b>' + mechHealRate(6, clock) + '</b> times an hour at this level and stops dead when nutrition reaches zero; the ring’s <b>' + mechRegenRate(clock) + '</b> an hour does not care. Starving costs nothing but the healing, the tick routine takes no health for it.');
}

// The staircase. A lock's difficulty is divided by twenty before it is used,
// so it moves in five steps and a difficulty of 19 is a difficulty of 0 --
// which no reading of the formula makes as plain as the picture does.
function mechLockFigure(lk) {
  if (!lk.rule || !lk.rule.formula || !lk.rule.lk) return '';
  const rules = lk.rule.lk;
  const xs = Array.from({ length: 52 }, (_, i) => i * 5);
  const series = [10, 20, 30].map((reflex, i) => ({
    name: 'reflex ' + reflex, colour: MECH_SERIES[i],
    points: xs.map(d => [d, 100 * mechLockChance(reflex, d, rules)])
  }));
  // One dot per distinct difficulty rather than one per class: eight of the
  // classes carry 15, and eight labels on one point is a smudge. The names
  // are joined, the labels alternate down the page so two nearby dots do not
  // collide, and a dot near the right edge hangs its label to the left.
  const byDiff = new Map();
  for (const c of (lk.classes || [])) {
    const d = c.words && c.words[0];
    if (d === undefined || d === null || d > 255) continue;
    if (!byDiff.has(d)) byDiff.set(d, []);
    byDiff.get(d).push(c.name);
  }
  const marks = [...byDiff.entries()].sort((a, b) => a[0] - b[0]).map(([d, names], i) => ({
    x: d, y: 100 * mechLockChance(20, d, rules), dot: true, colour: MECH_INK.ink,
    label: names.slice(0, 3).join(', ') + (names.length > 3 ? ' …' : '') + ' (' + d + ')',
    dy: 11 + (i % 2) * 13, side: d > 190 ? 'right' : 'left'
  }));
  return mechFig('The chance a pick opens it, by the lock’s difficulty', mechPlot({
    height: 150, series, marks,
    x: { min: 0, max: 255, ticks: [0, 60, 120, 180, 255].map(v => ({ v, label: String(v) })) },
    y: { min: 0, max: 100, ticks: [{ v: 100, label: '100%' }, { v: 50, label: '50%' }, { v: 0, label: '0' }] }
  }), (rules.addend === rules.per - 1
      ? rules.step + ' points are added for <b>every ' + rules.per + ' of difficulty, rounded up</b>, so the curve is a staircase: a lock of 1 is already a lock of ' + rules.per + ', and only a difficulty of nothing is free.'
      : rules.step + ' points are added for every ' + rules.per + ' of difficulty after adding ' + rules.addend + ', so the curve is a staircase.') +
    ' The dots are the classes’ own parameters at reflex 20; the difficulty a placed lock actually uses is its own <b>data1</b>. Every failure breaks the pick.');
}

// What a shop asks. The interesting thing is the range -- three orders of
// magnitude between a loaf and the bomb -- so the axis is logarithmic and
// the dearest few are named.
function mechShopFigure(sh) {
  const goods = [];
  for (const s of sh.shops) for (const g of s.goods) if (g.price > 0) goods.push({ name: g.name, price: g.price, who: s.who });
  if (goods.length < 4) return '';
  const buckets = [[1, 2], [3, 5], [6, 10], [11, 25], [26, 50], [51, 100], [101, 250], [251, 1000], [1001, 1e9]];
  const bins = buckets.map(b => ({
    label: b[0] >= 1000 ? '1k' : String(b[0]), value: goods.filter(g => g.price >= b[0] && g.price <= b[1]).length,
    colour: MECH_INK.gold, title: b[0] + ' to ' + b[1] + ' obols: ' + goods.filter(g => g.price >= b[0] && g.price <= b[1]).length + ' items'
  }));
  const dear = goods.slice().sort((a, b) => b.price - a.price).slice(0, 8)
    .map(g => ({ label: g.name, value: g.price, text: g.price + ' ob', colour: MECH_INK.warm }));
  return mechFig('What the shops ask, ' + goods.length + ' items in all', mechColumns(bins, { height: 80 }),
    'By price in obols, each column the items from that figure up to the next. Most of what is for sale is small change.') +
    mechFig('The dearest things on any counter', mechBars(dear),
      'Before bargaining: the vendor’s own four figures move the price' + (sh.haggling ? ', and <b>Haggling</b> takes a further roll of 0 to ' + srcNum(sh.haggling, sh.haggling.v - 1) + ' off it' : '') + '.');
}

// A lesson costs a point, a level earns a few, and mastery is fifteen
// lessons. Drawn against the levels, the question the sheet's numbers pose
// -- can you master anything? -- has a visible answer.
function mechTrainingFigure(tr) {
  if (!tr.points.perLevel || tr.points.atStart === null || tr.points.mastery === null) return '';
  const levels = Array.from({ length: 11 }, (_, i) => i + 1);
  const series = [1, 2, 3, 4].map((difficulty, i) => ({
    name: 'difficulty ' + difficulty, colour: MECH_SERIES[i],
    points: levels.map(l => [l, tr.points.atStart + (l - 1) * Math.max(0, tr.points.perLevel.v - difficulty)])
  }));
  const mastery = tr.points.mastery;
  return mechFig('Training points earned, against what mastery costs', mechPlot({
    height: 140, series,
    x: { min: 1, max: 11, ticks: levels.filter(l => l % 2).map(l => ({ v: l, label: String(l) })) },
    y: { min: 0, max: 60, ticks: [{ v: 60, label: '60' }, { v: 30, label: '30' }, { v: mastery, label: String(mastery) }, { v: 0, label: '0' }] },
    marks: [{ x: 6, y: mastery + 3, label: 'one skill mastered', colour: MECH_INK.ink }]
  }), 'A character is made with <b>' + srcNum(tr.points.atStartVal) + '</b> and gains <b>' + srcNum(tr.points.perLevel) + ' less the difficulty level</b> with each level; a lesson costs ' + srcNum(tr.points.perLessonVal) + ' and a skill is mastered at <b>' + srcNum(tr.points.masteryVal) + '</b>. At difficulty 4 a career to level 11 earns ' + (tr.points.atStart + 10 * Math.max(0, tr.points.perLevel.v - 4)) + ' points, ' + ((tr.points.atStart + 10 * Math.max(0, tr.points.perLevel.v - 4)) / mastery).toFixed(1) + ' skills’ worth.');
}

// The balloon itself, at the size the engine draws it, because the sheet
// says 128 by 32 and a rounded box with a tail and that is a picture rather
// than a fact. The geometry is from a trace of TBark in the executable.
function mechBalloonFigure(barks, bark) {
  if (!bark || !bark.ticks || !bark.width || !bark.height) return '';
  const W = bark.width.v, H = bark.height.v, secs = bark.ticks.v / 60;
  // A catalogue entry carries `words`, a list; the balloon shows one short line.
  const first = b => (b && b.words && b.words.length) ? b.words[0] : '';
  const line = (barks && barks.length ? first(barks.find(b => first(b) && first(b).length < 16) || barks[0]) : '');
  return mechFig('The balloon, at the size the application draws it',
    '<svg class="mechBalloon" width="' + (W * 2) + '" height="' + ((H + 6) * 2) + '" viewBox="0 0 ' + W + ' ' + (H + 6) + '" style="max-width:100%;height:auto" role="img" aria-label="a talk balloon">' +
    '<rect x="0.5" y="0.5" width="' + (W - 1) + '" height="' + (H - 1) + '" rx="8" ry="8" fill="#efeade" stroke="#2a2419" stroke-width="1"/>' +
    '<path d="M' + (W / 2 - 8) + ' ' + (H - 0.5) + ' L' + (W / 2 - 4) + ' ' + (H + 5.5) + ' L' + (W / 2 + 4) + ' ' + (H - 0.5) + ' Z" fill="#efeade" stroke="#2a2419" stroke-width="1"/>' +
    '<text x="' + (W / 2) + '" y="' + (H * 0.62) + '" text-anchor="middle" font-size="11" fill="#2a2419" font-family="Georgia,serif">' + svEsc(String(line).slice(0, 22)) + '</text>' +
    '</svg>' +
    mechNumberLine({ min: 0, max: Math.ceil(secs * 1.5), marks: [{ v: 0, label: 'said', above: true }, { v: secs, label: 'gone, ' + bark.ticks.v + ' ticks', below: true }],
      bands: [{ from: 0, to: secs, colour: 'rgba(249,248,111,.28)', label: secs + ' seconds' }] }),
    srcNum(bark.width) + ' by ' + srcNum(bark.height) + ' with a tail, and the tick count plus <b>' + srcNum(bark.ticks) + '</b> for how long it stays, both read out of the application.');
}

// The bed table as a chart, with the 2012 measurements laid over it. This is
// the only figure on the sheet whose numbers can be checked against
// somebody's actual play, so the measurements are drawn as marks rather than
// mentioned in the caption.
function mechSleepFigure(sl, clock) {
  if (!sl || !sl.div || !clock) return '';
  const div = sl.div.v;
  const level = 6;
  const rows = [];
  if (sl.own !== null) rows.push({ name: 'your own bed', quality: sl.own });
  // The innkeeper by name, the way the table under this names them: a
  // character record has no name field, the name is the page's own lookup.
  for (const inn of sl.inns) if (inn.quality !== null) {
    let who = 'character ' + inn.who;
    try { who = characterName(inn.who) || who; } catch (e) {}
    rows.push({ name: who + '’s inn', quality: inn.quality });
  }
  rows.push({ name: 'the bare ground', quality: 0 });
  if (rows.length < 2) return '';
  const bars = rows.map(r => ({
    label: r.name, value: mechBedRate(level, r.quality, { div, clock }), colour: r.quality >= 4 ? MECH_INK.gold : r.quality ? MECH_INK.cool : MECH_INK.dim,
    text: mechBedRate(level, r.quality, { div, clock }) + ' /h', title: r.name + ', quality ' + r.quality
  }));
  const withRing = rows.map(r => ({
    label: r.name, value: mechBedRate(level, r.quality, { regenerating: true, div, clock }), colour: MECH_INK.violet,
    text: mechBedRate(level, r.quality, { regenerating: true, div, clock }) + ' /h'
  }));
  return mechFig('Health an hour asleep, at level 6',
    mechBars(bars, { max: Math.max.apply(null, withRing.map(w => w.value)) }) +
    '<div class="mechSub">and the same with Omen’s ring</div>' +
    mechBars(withRing, { max: Math.max.apply(null, withRing.map(w => w.value)) }),
    'The tick routine heals ' + mechHealRate(level, clock) + ' an hour at this level and the bed multiplies it by <b>1 + quality/' + div + '</b>. A player measured <b>12</b>, <b>10</b>, <b>42</b>, <b>30</b> and <b>35</b> an hour in these beds in March 2012 and every one of them is on this chart, which is as close to an experiment as this sheet gets.');
}

// The clock, on one line and logarithmic, because the numbers it deals in
// run from one unit to four thousand and a linear axis would show a step and
// nothing else.
function mechClockFigure(sp, clk, costs) {
  if (!clk || !clk.model) return '';
  const unit = clk.unitsPerHour.v, m = clk.model;
  const cost = name => { const c = (costs || []).find(x => x.cost && x.routine.name.startsWith('TGameSys::' + name + '(')); return c ? c.cost.v : null; };
  const step = cost('MoveCommand'), take = cost('TakeCommand');
  const spell = sp && sp.rule && sp.rule.timing ? sp.rule.timeBase.v + 5 * sp.rule.timeMult.v : null;
  const marks = [
    ...(step ? [{ v: step, label: 'a step', above: true }] : []),
    ...(take ? [{ v: take, label: 'taking', below: true }] : []),
    ...(spell ? [{ v: spell, label: 'a level 5 spell', above: true }] : []),
    { v: m.periods[m.poisonIndex], label: exeClockWords(m.periods[m.poisonIndex], unit) + ': poison, the ring', below: true },
    ...(clk.quarterShift ? [{ v: 1 << clk.quarterShift.v, label: exeClockWords(1 << clk.quarterShift.v, unit) + ': the light', above: true }] : []),
    { v: unit, label: 'an hour: hunger, the schedules', below: true }
  ];
  const most = Math.max.apply(null, (costs || []).filter(c => c.cost).map(c => c.cost.v).concat([spell || 1]));
  return mechFig('Everything the clock counts, in units of a ' + unit + 'th of an hour',
    mechNumberLine({ min: 1, max: unit, log: true, marks,
      bands: [{ from: 1, to: most, colour: 'rgba(249,248,111,.22)', label: 'what an action costs' }] }),
    step ? 'A step is <b>' + step + '</b> unit' + (step === 1 ? '' : 's') + ', so an hour of game time is ' + Math.round(unit / step).toLocaleString() + ' steps and a night’s sleep is passed rather than walked.' : '');
}

// How much of the archive's own code asks about each skill: the table names
// the scripts, this says which skills the game actually leans on.
function mechSkillsFigure(sk) {
  const rows = [];
  for (const [id, resids] of sk.by) {
    let name = 'skill 0x' + id.toString(16).toUpperCase();
    try { if (refExists(0x1A00 + id)) name = selfNameFor(0x1A00 + id) || name; } catch (e) {}
    rows.push({ label: name, value: resids.size, text: String(resids.size) });
  }
  if (rows.length < 2) return '';
  rows.sort((a, b) => b.value - a.value);
  return mechFig('How many scripts ask about each skill', mechBars(rows, { colour: MECH_INK.cool }),
    'Only the questions that name a skill outright' + (sk.generic ? '; <b>' + sk.generic + '</b> more are in helpers that test whichever skill they are handed' : '') + '.');
}

/* ---- the community's patches, read against the open file -------------------
   Cythera's one add-on system is Magpie, and a Magpie patch is a Delver
   Archive holding only the resources it replaces. `mergeDelverPatch` has
   applied one since the browser player needed it; what was missing here is
   the part that comes first, which is saying what a patch IS before anyone
   decides to trust it. So this section reads a patch and shows what it would
   do to the file that is open: its description and its author, whether this
   file already carries it, and every resource it replaces with the shipped
   one drawn beside it.

   VERIFIED HERE MEANS "THIS IS WHAT IT DOES", NOT "WE VOUCH FOR IT". The page
   has no way to know whether a patch is safe and does not pretend to. What it
   can do is decode both sides with the readers it already has and put them
   next to each other, which is the only claim it makes.

   NOTHING IS WRITTEN. The report is built out of `describeDelverPatch`,
   which reads offsets and lengths and reaches Magpie's own verdicts; merging
   is a separate act, offered by the report's Apply button (patchesApply,
   below) and done in memory like every other edit here.

   THE TWO ARCHIVES PROBLEM DOES NOT ARISE, and it is worth saying why, since
   it is what blocks a save comparison. That needs `getResourceBytes`, which
   reads the open archive out of `fileBytes` as an ambient global. Nothing
   here does: `delverArchiveSpec` takes bytes and `decodeResource` takes a
   resource's bytes, so a patch's tile sheet decodes without the open file
   ever being displaced. */

/* The open archive as a writer spec, which is what the patch readers compare
   against. 12 ms over the shipped file and 1,558 resources, so this is a
   cache for tidiness rather than for speed; resetDerivedCaches drops it with
   everything else keyed to the file that is open. */
function patchBaseSpec() {
  if (!window.PATCH_BASE_SPEC && typeof fileBytes !== 'undefined' && fileBytes)
    window.PATCH_BASE_SPEC = delverArchiveSpec(fileBytes);
  return window.PATCH_BASE_SPEC;
}

/* A patch's bytes, however they got here. Split from the file control below
   so the whole path -- unwrap, parse, compare, draw -- can be driven from a
   harness with a patch built in memory, which is the only way any of this is
   checkable: the one real patch on this disk arrives inside a StuffIt archive
   the page cannot decompress, so a check that needed the real file would skip
   on most machines and prove nothing. */
function patchesOpenBytes(bytes, name) {
  const note = document.getElementById('patchNote');
  const say = (msg, bad) => { if (note) { note.textContent = msg; note.className = bad ? 'mechSub patchBad' : 'mechSub'; } };
  const base = patchBaseSpec();
  if (!base) { say('No game file is open to read a patch against.', true); return false; }
  let got;
  try { got = extractDelverArchive(bytes); }
  catch (e) { say('That file could not be opened: ' + e.message, true); return false; }
  const patch = delverArchiveSpec(got.bytes);
  if (!patch) { say('That file is not a Delver Archive, so it is not a Magpie patch.', true); return false; }
  const report = describeDelverPatch(base, patch);
  report.fileName = name || '';
  report.via = got.via;
  window.PATCH_REPORT = report;
  // The archive's own bytes, not the wrapper's: mergeDelverPatch wants the
  // Delver archive, and what was dropped may have been a .hqx round a .sit.
  window.PATCH_BYTES = got.bytes;
  say('');
  renderPatchReport();
  return true;
}

/* A patch file chosen in the section. It arrives the way any file here does,
   so it can be a .hqx or a MacBinary wrapper as easily as a bare data fork,
   and extractDelverArchive is what already knows the order to try them in. */
function patchesOpenFile(file) {
  if (!file) return;
  file.arrayBuffer().then(buf => patchesOpenBytes(new Uint8Array(buf), file.name)).catch(e => {
    const note = document.getElementById('patchNote');
    if (note) { note.textContent = 'That file could not be read: ' + e.message; note.className = 'mechSub patchBad'; }
  });
}

function patchesForget() {
  window.PATCH_REPORT = null;
  window.PATCH_BYTES = null;
  renderPatchReport();
}

/* ---- applying a patch to the open file -------------------------------------
   The patches section described a patch and would not apply one, deliberately:
   until the descriptor's check value could be reproduced, a patch read or
   written here was a thing this page understood and Magpie did not, and
   offering to merge one invited a file nobody else would take.

   That held until 15 September 2026, when Magpie under Mac OS 9 installed a
   patch grimoire wrote. The remaining reason not to apply was gone, and
   the reason to apply had been there all along: the only way to see what a
   patch does was to install it and play to wherever the changed art is. The
   Pumpkin Patch redraws foliage and blades across twelve sheets, which is a
   long walk.

   IT IS THE EDIT PATH, NOT A NEW ONE. mergeDelverPatch produces the merged
   bytes and parseArchiveBytes re-enters with `via: 'edit'`, exactly as editing
   a resource does, so every derived table drops and every view -- the tile
   galleries, the map, the atlas -- redraws from the patched archive.
   PRISTINE_BYTES is left alone by that path, which is what lets the comparison
   section then show precisely what the patch changed.

   NOTHING IS WRITTEN. The merge is in memory, like every other edit here. */
function patchesApply() {
  const rep = window.PATCH_REPORT, bytes = window.PATCH_BYTES;
  const note = document.getElementById('patchNote');
  const say = (m, bad) => { if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; } };
  if (!rep || !bytes) { say('No patch is open.', true); return false; }
  if (typeof fileBytes === 'undefined' || !fileBytes) { say('No game file is open.', true); return false; }
  let merged;
  try { merged = mergeDelverPatch(fileBytes, bytes); }
  catch (e) { say('That patch could not be applied: ' + e.message, true); return false; }
  const dirty = new Set(window.EDITED_RESIDS);
  for (const id of merged.replaced) dirty.add(id);
  parseArchiveBytes(merged.bytes, window.ARCHIVE_SOURCE_NAME || 'archive',
                    { rsrc: window.CYTHERA_RSRC_RAW, via: 'edit' });
  window.EDITED_RESIDS = dirty;
  if (typeof refreshChangesBadge === 'function') refreshChangesBadge();
  const what = (rep.descriptor && rep.descriptor.description) || rep.fileName || 'that patch';
  setStatus(merged.replaced.length + ' resource(s) replaced by ' + what +
    '. The patch is applied to the copy in this browser only, and the galleries and maps show it now. ' +
    'Data \u203a Cythera Data \u203a Changes is where it leaves the page.');
  return true;
}

/* One 32x32 tile out of a decoded sheet, as a canvas at 2x. A sheet is one
   tile wide and as many tiles tall as it holds, so a tile is a horizontal
   band of it and nothing has to be reshaped to cut one out. */
function patchTileCanvas(dec, t, subn) {
  const c = document.createElement('canvas');
  const img = new Uint8Array(32 * 32);
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
    const gy = t * 32 + y;
    img[y * 32 + x] = (gy < dec.H && x < dec.W) ? (dec.image[gy * dec.W + x] || 0) : 0;
  }
  drawToCanvas(c, 32, 32, img, transparentIndexFor(subn));
  c.className = 'patchTile';
  return c;
}

/* Which tiles of a sheet the patch redraws. Null when the two sides do not
   decode to the same shape, which is a patch doing something this comparison
   cannot describe rather than a patch that is wrong. */
function patchSheetDiff(r) {
  let a, b;
  try { a = decodeResource(r.baseData, r.subn, r.resid); b = decodeResource(r.patchData, r.subn, r.resid); }
  catch (e) { return null; }
  if (!a || !b || a.W !== b.W || a.H !== b.H) return null;
  const tiles = Math.floor(a.H / 32);
  if (a.W !== 32 || tiles < 1) return null;
  const changed = [];
  for (let t = 0; t < tiles; t++) {
    let diff = false;
    for (let y = t * 32; y < (t + 1) * 32 && !diff; y++)
      for (let x = 0; x < a.W; x++) if (a.image[y * a.W + x] !== b.image[y * b.W + x]) { diff = true; break; }
    if (diff) changed.push(t);
  }
  return { base: a, patch: b, tiles, changed };
}

/* The report as elements rather than as a string, because the tile
   comparison is canvases and a canvas cannot be built out of innerHTML. */
function renderPatchReport() {
  const host = document.getElementById('patchReport');
  if (!host) return;
  host.innerHTML = '';
  const rep = window.PATCH_REPORT;
  if (!rep) return;
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html !== undefined) d.innerHTML = html; return d; };
  const d = rep.descriptor;
  const who = d && DELV_PATCH_AUTHORS[d.uuidText];

  host.appendChild(el('div', 'partsTitle', 'What this patch says it is'));
  const facts = [];
  facts.push('<tr><td>file</td><td>' + svEsc(rep.fileName || '') +
             (rep.via && rep.via !== 'data fork' ? '<span class="mechSub"> read from its ' + svEsc(rep.via) + '</span>' : '') + '</td></tr>');
  if (who) facts.push('<tr><td>made by</td><td><b>' + svEsc(who.name) + '</b>' +
             (who.title ? '<span class="mechSub"> ' + svEsc(who.title) + '</span>' : '') + '</td></tr>');
  if (d && d.description) facts.push('<tr><td>description</td><td>' + svEsc(d.description) + '</td></tr>');
  if (d) {
    facts.push('<tr><td>identity</td><td class="patchMono">' + svEsc(d.uuidText) + '</td></tr>');
    facts.push('<tr><td>check value</td><td><span class="patchMono">' + svEsc(d.checkValue) + '</span>' +
      (d.checkValueValid ? '<span class="mechSub"> verifies, so the descriptor is intact</span>'
                         : '<span class="patchBad"> does not verify, and Magpie would mark this patch unusable</span>') + '</td></tr>');
    facts.push('<tr><td>type</td><td>' + (d.typeLabel ? '<b>' + svEsc(d.typeLabel) + '</b>' : 'code ' + d.typeCode) +
      (d.typeOverwritten ? '<span class="mechSub"> Magpie draws no label for this code, and it is what the digest check writes over a descriptor that fails</span>'
       : d.typeLabel ? '<span class="mechSub"> as Magpie\u2019s own list would say it</span>'
       : '<span class="mechSub"> a code Magpie draws no label for</span>') + '</td></tr>');
  }
  facts.push('<tr><td>scenario</td><td>' + svEsc(rep.scenarioTitle || '') + '</td></tr>');
  facts.push('<tr><td>format</td><td>' + svEsc(rep.format) +
    (rep.format === rep.baseFormat ? '' : '<span class="mechSub"> and this file is ' + svEsc(rep.baseFormat) + '</span>') + '</td></tr>');
  host.appendChild(el('div', '', mechTable(['', ''], facts, 'patchFacts')));
  if (!d) host.appendChild(el('p', 'mechSub',
    'This archive carries no descriptor, so Magpie would not have listed it. It can still be read as a set of resources.'));
  if (who) host.appendChild(el('p', 'mechSub', 'The name is not in the file. It is carried here from ' + svEsc(who.source) + '.'));

  host.appendChild(el('div', 'partsTitle', 'Against the file that is open'));
  const verdicts = [];
  verdicts.push(rep.isInstalled
    ? 'This file <b>already lists this patch</b> as applied.'
    : rep.installedIds.length
      ? 'This file lists <b>' + rep.installedIds.length + '</b> applied patch' + (rep.installedIds.length === 1 ? '' : 'es') + ', and this is not one of them.'
      : 'This file lists no applied patches.');
  if (rep.usable) verdicts.push('Magpie’s own three tests pass: the scenario matches, the format is compatible, and the descriptor was written for this file.');
  else for (const r of rep.reasons) verdicts.push('Magpie would refuse it: ' + svEsc(r) + '.');
  if (rep.notInBase.length) verdicts.push('<b>' + rep.notInBase.length + '</b> resource' + (rep.notInBase.length === 1 ? '' : 's') +
    ' the patch carries are not in this file and would be left out rather than added.');
  if (rep.disagreed.length) verdicts.push('<b>' + rep.disagreed.length + '</b> would be refused because the two sides disagree about whether the resource is encrypted.');
  if (rep.unchanged.length) verdicts.push('<b>' + rep.unchanged.length + '</b> are already byte for byte what this file holds.');
  host.appendChild(el('ul', 'ruleList', verdicts.map(v => '<li>' + v + '</li>').join('')));

  const rows = rep.resources.map(r => '<tr>' +
    '<td>' + (r.inBase ? svChip(r.resid, labelFor(r.resid) || '') : '<span class="patchMono">' + propWordHex(r.resid) + '</span>') + '</td>' +
    mechNum(r.baseLength === null ? '' : r.baseLength) + mechNum(r.patchLength) +
    '<td class="mechSub">' + (!r.inBase ? 'not in this file' : !r.encryptionAgrees ? 'encryption verdicts disagree' :
      r.identical ? 'identical' : 'replaced') + '</td></tr>');
  host.appendChild(el('div', 'partsTitle', 'The resources it names'));
  host.appendChild(el('div', '', mechTable(['resource', '#in this file', '#in the patch', ''], rows)));

  /* The part worth the whole section: the tiles themselves, shipped above
     patched. Only the tiles that differ are drawn. A sheet holds sixteen and
     the Pumpkin Patch redraws two or three of most of them, so drawing all
     192 would bury the answer in tiles nobody touched. */
  const sheets = rep.resources.filter(r => r.inBase && !r.identical && r.subn === 141)
    .map(r => ({ r, diff: patchSheetDiff(r) })).filter(x => x.diff && x.diff.changed.length);
  if (sheets.length) {
    const total = sheets.reduce((n, x) => n + x.diff.changed.length, 0);
    const of = sheets.reduce((n, x) => n + x.diff.tiles, 0);
    host.appendChild(el('div', 'partsTitle', 'What it redraws: ' + total + ' tiles of ' + of));
    host.appendChild(el('p', 'mechSub', 'The shipped tile on the left of each pair, the patch’s on the right.'));
    for (const { r, diff } of sheets) {
      const head = el('div', 'patchSheetHead');
      head.innerHTML = svChip(r.resid, labelFor(r.resid) || '') +
        '<span class="mechSub">' + diff.changed.length + ' of ' + diff.tiles + '</span>';
      host.appendChild(head);
      const strip = el('div', 'patchStrip');
      for (const t of diff.changed) {
        const pair = el('div', 'patchPair');
        pair.appendChild(patchTileCanvas(diff.base, t, r.subn));
        pair.appendChild(patchTileCanvas(diff.patch, t, r.subn));
        pair.appendChild(el('span', 'patchTileNo', String(t)));
        strip.appendChild(pair);
      }
      host.appendChild(strip);
    }
  }
  /* Applying is offered only when the merge would do something, and the lines
     above the button say what will move rather than leaving it to be found. */
  if (rep.usable && rep.willReplace) {
    host.appendChild(el('div', 'partsTitle', 'Apply it'));
    host.appendChild(el('ul', 'ruleList',
      '<li>Replaces <b>' + rep.willReplace + '</b> resource' + (rep.willReplace === 1 ? '' : 's') +
      ' in the copy of the file in this browser. <b>Nothing is written to disk.</b></li>' +
      '<li>Every view redraws from the patched archive, so the tiles above appear in the galleries and on the maps.</li>' +
      '<li>The file as it arrived is kept, so <b>Two files against each other</b> can then show exactly what changed.</li>'));
    const bar = el('div', 'mechStats');
    const b = document.createElement('button');
    b.className = 'secondary';
    b.style.cssText = 'width:auto;margin:0;padding:6px 12px';
    b.textContent = 'Apply to the open file';
    b.onclick = function () { if (patchesApply()) renderPatchReport(); };
    bar.appendChild(b);
    host.appendChild(bar);
  }
  host.appendChild(el('div', '', svLink('Forget this patch', 'patchesForget()')));
}

/* ---- a patch of your own: the hero's colours -------------------------------
   The patches section reads a patch; this one makes one, out of a handful of
   choices rather than out of edits. It is the smallest patch worth having --
   one resource, the hero's or the heroine's sprite sheet -- and so the
   plainest demonstration of the whole route: choose, look, apply it to the
   copy in this browser, or take it away as a file Magpie installs.

   The recolouring is in js/delv-graphics.js (HERO_SPRITES, heroPartMap,
   heroRemapTables, heroRecolour), which turns indices into indices and knows
   nothing of the page. What is here is the choosing and the drawing.

   ALWAYS FROM THE FILE AS IT ARRIVED. The part table names this release's
   indices, so a sheet already recoloured would label nothing and a second
   recolour would compound the first. So the art is taken from PRISTINE_BYTES
   when the open file has one, which applying a patch leaves alone, and the
   choices are re-applied to the shipped art every time rather than to
   whatever the last apply left in the archive.

   The sheet and the name are read, not typed: a prop type's base tile says
   which sheet it is drawn from (0x8E00 + tile >> 4, the rule characterParts
   states), and the section also says whether anything else in the file
   points into that sheet, which is what "changes nothing else" rests on. */
const HERO_SWATCHES = {
  hair: [['black', '#1a1410'], ['dark brown', '#3e2614'], ['brown', '#6b4221'], ['auburn', '#8a3418'],
         ['red', '#c4461c'], ['ginger', '#d8722a'], ['blond', '#d8b050'], ['flaxen', '#e8d8a0'],
         ['grey', '#8c8c8c'], ['white', '#ececec'], ['blue', '#2850c0'], ['green', '#2f8a3a'], ['violet', '#7a38a8']],
  skin: [['pale', '#f4d4bc'], ['fair', '#e6b48c'], ['tan', '#c98c5c'], ['brown', '#a0643a'],
         ['dark brown', '#74462a'], ['deep brown', '#4a2c1a'], ['green', '#6a9a50'], ['blue', '#6a8ac8']],
  clothes: [['black', '#1c1c1c'], ['white', '#e8e8e8'], ['grey', '#808080'], ['red', '#a01c1c'],
            ['orange', '#c86420'], ['yellow', '#d8b030'], ['green', '#2c7a30'], ['teal', '#1f7070'],
            ['blue', '#2448a8'], ['navy', '#20284a'], ['purple', '#6a2c8a'], ['brown', '#6a4424'], ['tan', '#b89868']],
};
function heroSwatchesFor(key) { return HERO_SWATCHES[key] || HERO_SWATCHES.clothes; }
function heroHexRgb(h) { return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); }

// The choices survive a redraw of the sheet, and are kept per figure, so
// going from the hero to the heroine and back finds the hero as he was left.
window.HERO_SPRITE_STATE = window.HERO_SPRITE_STATE || { which: 'hero', choices: { hero: {}, heroine: {} } };

/* The file the art is taken from, as a writer spec, cached against the bytes
   object so a different file is noticed without a reset hook. */
function heroSourceSpec() {
  const bytes = window.PRISTINE_BYTES || (typeof fileBytes !== 'undefined' ? fileBytes : null);
  if (!bytes) return null;
  const c = window.HERO_SOURCE_SPEC;
  if (c && c.bytes === bytes) return c.spec;
  let spec = null;
  try { spec = delverArchiveSpec(bytes); } catch (e) { spec = null; }
  window.HERO_SOURCE_SPEC = { bytes, spec };
  return spec;
}

/* One figure, read: its sheet, its name, the shipped frames, the part map,
   and what else in the file shares the sheet. Null when the open file has no
   such prop type or no such sheet, which is what a saved game gives. */
function heroFigure(key) {
  const def = HERO_SPRITES.find(d => d.key === key);
  if (!def) return null;
  let tile;
  try { tile = getPropTileList()[def.proptype]; } catch (e) { tile = undefined; }
  if (tile === undefined || tile === null) return null;
  const sheet = 0x8E00 + (tile >> 4);
  const spec = heroSourceSpec();
  const res = spec && spec.resources.find(r => r.resid === sheet);
  if (!res) return null;
  let dec = null;
  try { dec = decodeResource(res.data, 141, sheet); } catch (e) { dec = null; }
  if (!dec || dec.W !== 32 || dec.H < 32) return null;
  const image = Uint8Array.from(dec.image);
  const labels = heroPartMap(image, dec.W, dec.H, def);
  const others = [];
  try {
    const tl = getPropTileList();
    for (let pt = 0; pt < tl.length; pt++)
      if (pt !== def.proptype && tl[pt] !== undefined && tl[pt] !== null && (0x8E00 + (tl[pt] >> 4)) === sheet) others.push(pt);
  } catch (e) {}
  let name = key;
  try { name = propTypeName(def.proptype) || key; } catch (e) {}
  return { def, key, name, sheet, base: tile, W: dec.W, H: dec.H, image, labels, others, unknown: labels.unknown };
}

// The figure recoloured as chosen: the frames, and how many pixels moved.
function heroRecoloured(fig) {
  const chosen = window.HERO_SPRITE_STATE.choices[fig.key] || {};
  const choices = {};
  for (const k of Object.keys(chosen)) if (chosen[k]) choices[k] = heroHexRgb(chosen[k].hex);
  const tables = heroRemapTables(fig.image, fig.labels, fig.def, choices);
  const image = heroRecolour(fig.image, fig.labels, tables);
  let moved = 0;
  for (let i = 0; i < image.length; i++) if (image[i] !== fig.image[i]) moved++;
  return { image, moved };
}

// What the patch will call itself, which is what Magpie lists it by.
function heroDescription(fig) {
  const chosen = window.HERO_SPRITE_STATE.choices[fig.key] || {};
  const bits = fig.def.parts.filter(p => chosen[p.key]).map(p => p.label + ' ' + chosen[p.key].name);
  return 'The ' + fig.name + (bits.length ? ', ' + bits.join(', ') : ', as shipped');
}

/* The patch, written from the open file's spec with the one sheet replaced.
   The open file rather than the source, because the descriptor has to be
   written for the file it will be applied to; the art comes from the source.
   Null with a note when there is nothing to write. */
function heroSpritePatch() {
  const fig = heroFigure(window.HERO_SPRITE_STATE.which);
  const base = patchBaseSpec();
  if (!fig || !base) return null;
  const rec = heroRecoloured(fig);
  if (!rec.moved) return null;
  const data = encodeDCGLiterals(rec.image);
  const res = base.resources.find(r => r.resid === fig.sheet);
  if (!res) return null;
  const spec = Object.assign({}, base, {
    resources: base.resources.map(r => r.resid === fig.sheet ? Object.assign({}, r, { data }) : r) });
  const d = document.getElementById('heroDesc');
  const w = writeDelverPatch(spec, [fig.sheet],
    { description: (d && d.value) || heroDescription(fig), typeCode: DELV_PATCH_EXPORT_TYPE });
  w.name = safeFileName(fig.name.charAt(0).toUpperCase() + fig.name.slice(1) + ' Colours');
  return w;
}

function heroSay(m, bad) {
  const note = document.getElementById('heroNote');
  if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; }
}

/* Apply goes through the patches section rather than beside it: the patch is
   handed to its reader and then to its Apply, which is the edit path every
   other change here takes. The report does not outlive that -- re-entering
   the archive drops it with every other derived table -- so "Read it as a
   patch" is the button for seeing what the patch is. */
function heroSpriteApply() {
  let w;
  try { w = heroSpritePatch(); } catch (e) { heroSay('The patch could not be written: ' + e.message, true); return false; }
  if (!w) { heroSay('Nothing is chosen, so there is nothing to apply.', true); return false; }
  if (!patchesOpenBytes(w.bytes, w.name)) { heroSay('The patch was not accepted.', true); return false; }
  const ok = patchesApply();
  if (ok) { renderPatchReport(); heroSay('Applied to the copy of the file in this browser. Data \u203a Cythera Data \u203a Changes is where it leaves the page.'); }
  return ok;
}

function heroSpriteShowPatch() {
  let w;
  try { w = heroSpritePatch(); } catch (e) { heroSay('The patch could not be written: ' + e.message, true); return false; }
  if (!w) { heroSay('Nothing is chosen, so there is nothing to read.', true); return false; }
  const ok = patchesOpenBytes(w.bytes, w.name);
  const host = document.getElementById('patchReport');
  if (ok && host && host.scrollIntoView) host.scrollIntoView({ behavior: 'smooth', block: 'start' });
  return ok;
}

function heroSpriteDownload(asMacBinary) {
  let w;
  try { w = heroSpritePatch(); } catch (e) { heroSay('The patch could not be written: ' + e.message, true); return null; }
  if (!w) { heroSay('Nothing is chosen, so there is nothing to write.', true); return null; }
  if (asMacBinary) {
    const bin = writeMacBinary({ name: w.name, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
    dlBlob(new Blob([bin], { type: 'application/macbinary' }), w.name + '.bin');
  } else downloadBlob(w.bytes, w.name);
  heroSay(w.bytes.length.toLocaleString() + ' bytes, one resource, identity ' + w.uuidText +
    (w.checkValueValid ? ', and the check value verifies.' : ', and the check value does not verify.'), !w.checkValueValid);
  return w;
}

function heroSpritePick(key) {
  window.HERO_SPRITE_STATE.which = key;
  renderHeroSprite();
}

function heroSpriteChoose(part, name, hex) {
  const st = window.HERO_SPRITE_STATE;
  const c = st.choices[st.which] || (st.choices[st.which] = {});
  c[part] = hex ? { name, hex } : null;
  renderHeroSprite();
}

function heroSpriteReset() {
  const st = window.HERO_SPRITE_STATE;
  st.choices[st.which] = {};
  renderHeroSprite();
}

/* The controls, the frames and the buttons, redrawn whole on every choice.
   Sixteen frames are 16 KB of pixels and the remap is a table lookup, so a
   redraw is well under a frame and nothing is worth keeping between them. */
function renderHeroSprite() {
  const host = document.getElementById('heroSprite');
  if (!host) return;
  host.innerHTML = '';
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html !== undefined) d.innerHTML = html; return d; };
  const st = window.HERO_SPRITE_STATE;
  const figs = HERO_SPRITES.map(d => heroFigure(d.key)).filter(Boolean);
  if (!figs.length) {
    host.appendChild(el('p', 'mechSub', 'This file has no hero sprite sheet to recolour.'));
    return;
  }
  let fig = figs.find(f => f.key === st.which);
  if (!fig) { fig = figs[0]; st.which = fig.key; }
  const chosen = st.choices[fig.key] || (st.choices[fig.key] = {});

  // Which figure: frame 0 of each, as the button.
  const pick = el('div', 'heroPicks');
  for (const f of figs) {
    const b = el('button', 'heroPick' + (f.key === fig.key ? ' on' : ''));
    b.type = 'button';
    b.title = f.name + ', prop type ' + f.def.proptype;
    b.appendChild(patchTileCanvas({ image: f.image, W: f.W, H: f.H }, 0, 141));
    b.appendChild(el('span', '', svEsc(f.name)));
    b.onclick = function () { heroSpritePick(f.key); };
    pick.appendChild(b);
  }
  host.appendChild(pick);

  // A row per part: as shipped, the swatches, and any colour at all.
  const rows = el('div', 'heroParts');
  for (const p of fig.def.parts) {
    const row = el('div', 'heroPart');
    row.appendChild(el('span', 'heroPartName', svEsc(p.label)));
    const sw = el('div', 'heroSwatches');
    const cur = chosen[p.key];
    const shipped = el('button', 'heroSwatch heroShipped' + (!cur ? ' on' : ''), 'as shipped');
    shipped.type = 'button';
    shipped.onclick = function () { heroSpriteChoose(p.key, null, null); };
    sw.appendChild(shipped);
    for (const [name, hex] of heroSwatchesFor(p.key)) {
      const b = el('button', 'heroSwatch' + (cur && cur.hex === hex ? ' on' : ''));
      b.type = 'button';
      b.title = name;
      b.setAttribute('aria-label', p.label + ' ' + name);
      b.style.background = hex;
      b.onclick = function () { heroSpriteChoose(p.key, name, hex); };
      sw.appendChild(b);
    }
    const any = document.createElement('input');
    any.type = 'color';
    any.className = 'heroAny';
    any.title = 'any colour';
    any.value = cur ? cur.hex : '#808080';
    any.onchange = function () { heroSpriteChoose(p.key, any.value, any.value); };
    sw.appendChild(any);
    row.appendChild(sw);
    rows.appendChild(row);
  }
  host.appendChild(rows);

  // The frames: shipped on the left of each pair, chosen on the right.
  const rec = heroRecoloured(fig);
  const frames = Math.floor(fig.H / 32);
  host.appendChild(el('div', 'partsTitle', 'The ' + svEsc(fig.name) + '’s ' + frames + ' frames, from sheet ' + propWordHex(fig.sheet)));
  const strip = el('div', 'patchStrip');
  for (let t = 0; t < frames; t++) {
    const pair = el('div', 'patchPair');
    pair.appendChild(patchTileCanvas({ image: fig.image, W: fig.W, H: fig.H }, t, 141));
    pair.appendChild(patchTileCanvas({ image: rec.image, W: fig.W, H: fig.H }, t, 141));
    pair.appendChild(el('span', 'patchTileNo', String(t)));
    strip.appendChild(pair);
  }
  host.appendChild(strip);
  const facts = [];
  facts.push(fig.others.length
    ? 'Prop type' + (fig.others.length === 1 ? ' ' : 's ') + fig.others.join(', ') + ' also ' + (fig.others.length === 1 ? 'draws' : 'draw') + ' from this sheet and would change with it.'
    : 'Nothing else in the file draws from this sheet, so the patch changes the ' + svEsc(fig.name) + ' and nothing else.');
  if (fig.unknown) facts.push('<b>' + fig.unknown + '</b> pixels use colours the part table does not know, so this sheet is not the shipped art and those pixels are left as they are.');
  facts.push(rec.moved ? '<b>' + rec.moved.toLocaleString() + '</b> pixels change.' : 'Nothing is chosen, so the frames are as shipped.');
  host.appendChild(el('ul', 'ruleList', facts.map(f => '<li>' + f + '</li>').join('')));

  if (!rec.moved) return;
  const desc = document.createElement('input');
  desc.type = 'text'; desc.id = 'heroDesc'; desc.className = 'heroDesc';
  desc.maxLength = 255;
  desc.value = heroDescription(fig);
  desc.setAttribute('aria-label', 'what the patch calls itself');
  host.appendChild(el('div', 'partsTitle', 'What the patch calls itself'));
  host.appendChild(desc);
  const bar = el('div', 'mechStats');
  const btn = (label, fn) => {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.style.cssText = 'width:auto;margin:0;padding:6px 12px';
    b.textContent = label;
    b.onclick = fn;
    bar.appendChild(b);
  };
  btn('Apply to the open file', heroSpriteApply);
  btn('Read it as a patch', heroSpriteShowPatch);
  btn('Download the patch', function () { heroSpriteDownload(false); });
  btn('Download for a Mac', function () { heroSpriteDownload(true); });
  btn('Start again', heroSpriteReset);
  host.appendChild(bar);
}

/* ---- two archives against each other, and a patch out of the difference ----
   The patches section reads a patch someone else made. This is the other two
   directions: comparing any two archives, and writing a patch out of what
   differs.

   WHAT IT COMPARES, and both are the same engine. *Your edits*, which is the
   file as it arrived (`PRISTINE_BYTES`) against the file as it stands -- the
   page can edit resources and had no way to show what you had changed, let
   alone hand it to anyone. And *another file*, which is how two releases of
   the game are compared: the four installers all open here, so 1.0.1 against
   1.0.4 is two files and a button.

   THE ORDER IS OLD, NEW. Added and removed are named from the first file's
   point of view, so "added" means the second has it and the first does not.

   ON EXPORTING A PATCH, AND THIS HAS TO BE SAID PLAINLY. What comes out is a
   real Delver archive shaped like a Magpie patch: grimoire reads it, the
   patches section describes it, `mergeDelverPatch` applies it, and the
   browser player loads it as an add-on. Until the check value was recovered
   out of Magpie's own code it would NOT have installed in Magpie under
   Mac OS 9, because the descriptor's first eight bytes are that value and
   Magpie marks a descriptor that fails the check unusable. It carries the
   real value now, and Magpie installed a patch written here on 15 September
   2026; the panel under the button says so. */
window.COMPARE_REPORT = null;

function compareSpecOf(bytes) { return bytes ? delverArchiveSpec(bytes) : null; }

/* The file as it arrived. parseArchiveBytes keeps it under PRISTINE_BYTES for
   exactly this reason -- a patch describes the file the player already has,
   and one edit rebuilds the whole archive. */
function compareEdits() {
  const note = document.getElementById('compareNote');
  const say = (m, bad) => { if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; } };
  const pristine = window.PRISTINE_BYTES;
  if (!pristine || typeof fileBytes === 'undefined' || !fileBytes) { say('No file is open.', true); return false; }
  if (pristine === fileBytes) { say('Nothing has been edited in this file yet.', true); return false; }
  const a = compareSpecOf(pristine), b = compareSpecOf(fileBytes);
  if (!a || !b) { say('That file could not be read as a Delver Archive.', true); return false; }
  window.COMPARE_REPORT = Object.assign(describeDelverDiff(a, b),
    { aName: 'as it arrived', bName: 'as it stands', bSpec: b, kind: 'edits' });
  say('');
  renderCompareReport();
  return true;
}

/* Another archive, opened the way any file here is opened, so an installer
   works as well as a bare data fork: extractDelverArchive walks BinHex,
   StuffIt and Installer VISE to find the Delver archive inside. That is what
   makes comparing two releases a matter of choosing two files. */
function compareOpenBytes(bytes, name) {
  const note = document.getElementById('compareNote');
  const say = (m, bad) => { if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; } };
  if (typeof fileBytes === 'undefined' || !fileBytes) { say('No file is open to compare against.', true); return false; }
  let got;
  try { got = extractDelverArchive(bytes); }
  catch (e) { say('That file could not be opened: ' + e.message, true); return false; }
  const other = compareSpecOf(got.bytes);
  if (!other) { say('That file is not a Delver Archive.', true); return false; }
  const mine = compareSpecOf(fileBytes);
  /* The file you opened is the OLDER side. Comparing a 1.0.1 installer
     against an open 1.0.4 should read as "what 1.0.4 changed", which is the
     way round a reader expects and the opposite of what naming the open file
     first would give. */
  window.COMPARE_REPORT = Object.assign(describeDelverDiff(other, mine),
    { aName: name || 'the other file', bName: window.ARCHIVE_SOURCE_NAME || 'the open file',
      bSpec: mine, kind: 'files', via: got.via });
  compareApplications(bytes, name);
  say('');
  renderCompareReport();
  return true;
}

/* The application half, when both sides have one. The page's own application
   arrives through the installer route (`loadApplicationFork`), so this is
   only offered when a file has been opened that way; without it the section
   compares the scenario data and says nothing about the program. */
function compareApplications(bytes, name) {
  window.COMPARE_APP = null;
  if (!window.APP_DATA) return;
  const other = findApplicationIn(bytes);
  if (!other) return;
  const mine = { data: window.APP_DATA, rsrc: window.APP_RSRC_RAW || null };
  const d = describeApplicationDiff(other, mine);
  if (!d || (!d.routines && !d.fork)) return;
  window.COMPARE_APP = Object.assign(d, { aName: other.name || name || 'the other application',
                                          bName: 'the open application', via: other.via });
}

function compareForget() { window.COMPARE_REPORT = null; window.COMPARE_APP = null; renderCompareReport(); }

/* An application inside whatever file was chosen, with both its forks.

   A Cythera installer holds the data file AND the application, so opening one
   can answer two questions at once: what the scenario data changed, and what
   the program changed. This finds the second. Everything it looks in is
   something the page already opens -- an Installer VISE archive, a StuffIt
   archive, or a plain MacBinary-ish wrapper -- and it returns null rather
   than throwing when there is no application, because most files have none
   and that is not an error. */
function findApplicationIn(bytes) {
  const pick = list => list.find(e => e.type === 'APPL') || null;
  try {
    const inst = sniffViseInstaller(bytes);
    if (inst) {
      const e = pick(inst.archive.entries);
      if (e) { const g = viseExtract(inst.archive, e);
               return { name: e.name, data: g.data, rsrc: g.rsrc, via: inst.archive.versionName + ' installer' }; }
    }
  } catch (e) { /* not an installer */ }
  const fromSit = buf => {
    if (typeof looksLikeStuffIt !== 'function' || !looksLikeStuffIt(buf)) return null;
    let arc; try { arc = parseStuffItArchive(buf); } catch (e) { return null; }
    const e = pick(arc.entries.filter(x => !x.isFolder));
    if (!e) return null;
    try { return { name: e.name, data: stuffItFork(buf, e, 'data'), rsrc: stuffItFork(buf, e, 'rsrc'), via: arc.format + ' archive' }; }
    catch (err) { return null; }
  };
  const bare = fromSit(bytes);
  if (bare) return bare;
  try {
    const forks = sniffMacContainer(bytes);
    if (forks) {
      if ((forks.type || '').trim() === 'APPL')
        return { name: forks.name, data: forks.data, rsrc: forks.rsrc, via: forks.kind };
      for (const which of ['data', 'rsrc']) {
        const inner = forks[which] && forks[which].length ? fromSit(forks[which]) : null;
        if (inner) { inner.via += ' in ' + forks.kind; return inner; }
      }
    }
  } catch (e) { /* not a container */ }
  return null;
}

/* A whole resource drawn, for the kinds the page can decode as one image.
   Subindex 141 is not here: a tile sheet is 32 by 512 and drawing two of them
   side by side says nothing, so those go to the per-tile comparison the
   patches section already has. */
const COMPARE_IMAGE_SUBN = new Set([135, 137, 131, 142]);
function compareImageCanvas(data, subn, resid) {
  let d;
  try { d = decodeResource(data, subn, resid); } catch (e) { return null; }
  if (!d || !d.W || !d.H) return null;
  const c = document.createElement('canvas');
  drawToCanvas(c, d.W, d.H, d.image, transparentIndexFor(subn));
  c.className = 'patchTile';
  // A portrait is 64 square and a landscape 288 by 32, so one fixed size
  // would squash something. The width is capped and the height follows.
  c.style.width = Math.min(128, d.W * 2) + 'px';
  c.style.height = 'auto';
  return c;
}

function renderCompareReport() {
  const host = document.getElementById('compareReport');
  if (!host) return;
  host.innerHTML = '';
  const rep = window.COMPARE_REPORT;
  if (!rep) return;
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html !== undefined) d.innerHTML = html; return d; };

  host.appendChild(el('div', 'partsTitle', svEsc(rep.aName) + ' against ' + svEsc(rep.bName)));
  if (rep.identical) {
    host.appendChild(el('p', 'mechLede', 'Every one of the ' + rep.aCount +
      ' resources is byte for byte the same. The two files hold the same scenario data.'));
    host.appendChild(el('div', '', svLink('Forget this comparison', 'compareForget()')));
    return;
  }
  const bits = [];
  if (rep.changed.length) bits.push('<b>' + rep.changed.length + '</b> changed');
  if (rep.added.length) bits.push('<b>' + rep.added.length + '</b> only in ' + svEsc(rep.bName));
  if (rep.removed.length) bits.push('<b>' + rep.removed.length + '</b> only in ' + svEsc(rep.aName));
  host.appendChild(el('p', 'mechLede', bits.join(', ') + ', and <b>' + rep.unchanged +
    '</b> identical, of ' + rep.aCount + '.'));
  if (rep.titleChanged) host.appendChild(el('p', 'mechSub', 'The two name different scenarios, so their resource ids may not mean the same things.'));
  if (rep.formatChanged) host.appendChild(el('p', 'mechSub', 'The two carry different format versions.'));
  if (rep.encryptionChanged.length) host.appendChild(el('p', 'mechSub',
    rep.encryptionChanged.length + ' resource(s) are stored encrypted in one and clear in the other. The comparison is of the plaintext either way.'));

  host.appendChild(el('div', 'partsTitle', 'Where the differences are'));
  host.appendChild(el('div', '', mechTable(['what', '#changed', '#added', '#removed'],
    rep.groups.map(g => '<tr><td>' + svEsc(CATEGORY_NAMES[g.subn] || ('subindex ' + g.subn)) +
      '<span class="mechSub"> ' + propWordHex((g.subn + 1) * 0x100) + ' to ' + propWordHex((g.subn + 1) * 0x100 + 255) + '</span></td>' +
      mechNum(g.changed || '') + mechNum(g.added || '') + mechNum(g.removed || '') + '</tr>'))));

  const rows = rep.changed.slice(0, 400).map(c => '<tr>' +
    '<td>' + svChip(c.resid, labelFor(c.resid) || '') + '</td>' +
    mechNum(c.aLength) + mechNum(c.bLength) +
    mechNum((c.bLength - c.aLength > 0 ? '+' : '') + (c.bLength - c.aLength)) + '</tr>');
  host.appendChild(el('div', 'partsTitle', 'What changed'));
  host.appendChild(el('div', '', mechTable(['resource', '#in ' + svEsc(rep.aName), '#in ' + svEsc(rep.bName), '#difference'], rows)));
  if (rep.changed.length > rows.length)
    host.appendChild(el('p', 'mechSub', 'The first ' + rows.length + ' of ' + rep.changed.length + '.'));
  if (rep.added.length) {
    host.appendChild(el('div', 'partsTitle', 'Only in ' + svEsc(rep.bName)));
    host.appendChild(el('div', '', mechTable(['resource', '#bytes'],
      rep.added.map(a => '<tr><td>' + svChip(a.resid, labelFor(a.resid) || '') + '</td>' + mechNum(a.b.data.length) + '</tr>'))));
  }
  if (rep.removed.length) {
    host.appendChild(el('div', 'partsTitle', 'Only in ' + svEsc(rep.aName)));
    host.appendChild(el('div', '', mechTable(['resource', '#bytes'],
      rep.removed.map(a => '<tr><td><span class="patchMono">' + propWordHex(a.resid) + '</span></td>' + mechNum(a.a.data.length) + '</tr>'))));
  }

  // The pictures, where there are any. Tile sheets tile by tile, everything
  // else the page can decode as a whole image side by side.
  const sheets = rep.changed.filter(c => c.subn === 141)
    .map(c => ({ c, diff: patchSheetDiff({ resid: c.resid, subn: 141, baseData: c.a.data, patchData: c.b.data }) }))
    .filter(x => x.diff && x.diff.changed.length);
  const pics = rep.changed.filter(c => COMPARE_IMAGE_SUBN.has(c.subn)).slice(0, 40);
  if (sheets.length || pics.length) {
    host.appendChild(el('div', 'partsTitle', 'What it looks like'));
    host.appendChild(el('p', 'mechSub', svEsc(rep.aName) + ' on the left of each pair, ' + svEsc(rep.bName) + ' on the right.'));
  }
  for (const { c, diff } of sheets) {
    const head = el('div', 'patchSheetHead');
    head.innerHTML = svChip(c.resid, labelFor(c.resid) || '') + '<span class="mechSub">' + diff.changed.length + ' of ' + diff.tiles + ' tiles</span>';
    host.appendChild(head);
    const strip = el('div', 'patchStrip');
    for (const t of diff.changed) {
      const pair = el('div', 'patchPair');
      pair.appendChild(patchTileCanvas(diff.base, t, 141));
      pair.appendChild(patchTileCanvas(diff.patch, t, 141));
      pair.appendChild(el('span', 'patchTileNo', String(t)));
      strip.appendChild(pair);
    }
    host.appendChild(strip);
  }
  if (pics.length) {
    const strip = el('div', 'patchStrip');
    for (const c of pics) {
      const before = compareImageCanvas(c.a.data, c.subn, c.resid);
      const after = compareImageCanvas(c.b.data, c.subn, c.resid);
      if (!before || !after) continue;
      const pair = el('div', 'patchPair');
      pair.appendChild(before); pair.appendChild(after);
      pair.appendChild(el('span', 'patchTileNo', propWordHex(c.resid)));
      strip.appendChild(pair);
    }
    if (strip.children.length) host.appendChild(strip);
  }

  /* The export. Only offered when the newer side is a file this page can take
     the resources OUT of, which is the open file -- a patch has to carry the
     bytes you want someone else to end up with, and for a comparison against
     a file you opened those live on the other side. */
  host.appendChild(el('div', 'partsTitle', 'Export the difference as a patch'));
  host.appendChild(el('ul', 'ruleList',
    '<li>A Delver archive holding only what differs, with a descriptor naming it. ' +
    'This page reads it, the patches section describes it, and the browser player loads it as an add-on.</li>' +
    '<li>It carries a <b>real check value</b>, the 64-bit digest Magpie verifies before it will list a patch at all. ' +
    'That was unreadable here until the routine was recovered out of Magpie\u2019s own code, and a patch written before then had zeroes in that field. ' +
    'Magpie under Mac OS 9 <b>installed</b> a patch written here on 15 September 2026, which is the only test that counts and is not one this page can run.</li>' +
    '<li>The resources come from <b>' + svEsc(rep.bName) + '</b>, which is the side a patch would make somebody else\u2019s file match.</li>' +
    /* Established by reading Magpie's imports: of 299 symbols it imports one
       Resource Manager call, GetResource, and none that writes -- no
       AddResource, ChangedResource, WriteResource or UpdateResFile, and no
       call that opens another file's resource fork at all. What it imports is
       the flat-file set, FSpOpenDF through FSWrite. So the format cannot carry
       a resource-fork change, and a swapped font is the case that would
       otherwise go missing without a word. */
    '<li>A patch carries the <b>data fork only</b>, which is the Delver archive. Magpie writes nothing else, ' +
    'so anything in the resource fork, the game\u2019s font among it, cannot travel in one.</li>' +
    '<li>The second button wraps the same bytes as <b>MacBinary</b>, typed <b>DelP</b> with Magpie\u2019s creator. ' +
    'A saved game is DelP too and the creator is the whole of the difference, so a Mac that decodes the wrapper ' +
    'shows the patch under Magpie\u2019s own icon rather than under Cythera\u2019s saved-game one. ' +
    'The bare file is the one to use where something copies a fork straight into a shared folder.</li>'));
  const form = el('div', 'mechStats');
  const desc = document.createElement('input');
  desc.type = 'text'; desc.id = 'patchDesc'; desc.placeholder = 'What this patch does';
  desc.setAttribute('maxlength', '255');
  form.appendChild(desc);
  const btn = document.createElement('button');
  btn.className = 'secondary';
  btn.style.cssText = 'width:auto;margin:0;padding:6px 12px';
  btn.textContent = 'Export ' + rep.changed.length + ' resource' + (rep.changed.length === 1 ? '' : 's') + ' as a patch';
  btn.onclick = () => compareExportPatch(false);
  form.appendChild(btn);
  const wrapped = document.createElement('button');
  wrapped.className = 'secondary';
  wrapped.style.cssText = 'width:auto;margin:0;padding:6px 12px';
  wrapped.textContent = 'and as MacBinary, typed for Magpie';
  wrapped.onclick = () => compareExportPatch(true);
  form.appendChild(wrapped);
  host.appendChild(form);
  /* Where to get the thing that installs it. A patch file is no use on its
     own: Magpie is what merges one into a copy of the game, it is Glenn
     Andreas's application rather than ours, and the only copy on the web is
     in the Cythera Guides add-ons archive. It cannot be fetched into this
     page even as a convenience -- that host serves plain HTTP with no TLS at
     all, so a browser on this page blocks it as mixed content before CORS is
     reached -- so a link out is the whole of what can honestly be offered. */
  host.appendChild(el('div', 'mechSub',
    'A patch is installed by <b>Magpie</b>, which is not here: ' +
    '<a href="http://www.cytheraguides.com/archives/ambrosia_addons/cythera/Miscellaneous/614_MagpiePumpkinPatch.sit.hqx" ' +
    'target="_blank" rel="noopener">Magpie and the Pumpkin Patch</a>, 167 KB of BinHex, from the Cythera Guides ' +
    'add-ons archive over plain HTTP. Drop that file on this page and the patch inside it opens here too.'));
  renderCompareApp(host, el);
  host.appendChild(el('div', '', svLink('Forget this comparison', 'compareForget()')));
}

/* The application comparison, under the data one. Routines that moved are
   counted and not listed: between two builds of the same program almost every
   routine has moved, and none of it means anything. */
function renderCompareApp(host, el) {
  const app = window.COMPARE_APP;
  if (!app) return;
  host.appendChild(el('div', 'partsTitle', 'And the application'));
  const r = app.routines;
  if (r) {
    host.appendChild(el('p', 'mechLede',
      '<b>' + r.meaningful + '</b> routine' + (r.meaningful === 1 ? '' : 's') + ' differ of ' + r.aCount +
      ': <b>' + r.added.length + '</b> added, <b>' + r.gone.length + '</b> gone, <b>' + r.resized.length +
      '</b> compiled to a different length' +
      (r.compilerOnly ? ', of which <b>' + r.compilerOnly + '</b> differ by nothing but register copies and are the code generator rather than a change' : '') +
      '. Another ' + r.moved + ' moved without changing, which is what happens to everything after the first difference.'));
    const rows = [];
    for (const x of r.added) rows.push('<tr><td>' + svEsc(x.name) + '</td><td class="mechSub">added</td>' + mechNum('') + mechNum(x.length) + mechNum('') + '<td></td></tr>');
    for (const x of r.gone) rows.push('<tr><td>' + svEsc(x.name) + '</td><td class="mechSub">gone</td>' + mechNum(x.length) + mechNum('') + mechNum('') + '<td></td></tr>');
    /* What the compiler emitted differently, not just how much. A routine
       whose census moves by nothing but register copies is the code generator
       rather than an edit, and saying so is the difference between reading a
       release correctly and inventing a change that is not there. */
    const census = x => {
      const bits = (x.added || []).map(a => '+' + a.n + ' ' + a.op)
        .concat((x.removed || []).map(a => '-' + a.n + ' ' + a.op));
      if (x.compilerOnly) return '<span class="mechSub">the compiler: ' + svEsc(bits.join(', ') || 'reordered') + '</span>';
      return bits.length ? '<span class="patchMono">' + svEsc(bits.join(' ')) + '</span>' : '';
    };
    for (const x of r.resized) rows.push('<tr><td>' + svEsc(x.name) + '</td><td class="mechSub">' +
      (x.compilerOnly ? 'recompiled' : 'changed') + '</td>' +
      mechNum(x.aLength) + mechNum(x.bLength) + mechNum((x.delta > 0 ? '+' : '') + x.delta) +
      '<td>' + census(x) + '</td></tr>');
    host.appendChild(el('div', '', mechTable(['routine', '', '#in ' + svEsc(app.aName), '#in ' + svEsc(app.bName), '#difference', 'what the compiler emitted'], rows)));
    if (!rows.length) host.appendChild(el('p', 'mechSub', 'Every routine is the same name and the same length in both.'));
  } else {
    host.appendChild(el('p', 'mechSub', 'Neither application names its routines, so only the resource forks could be compared.'));
  }
  const f = app.fork;
  if (f) {
    host.appendChild(el('div', 'partsTitle', 'Its resource fork'));
    const rows = f.changed.map(x => '<tr><td><span class="patchMono">' + svEsc(x.type) + ' ' + x.id + '</span>' +
      (x.name ? ' ' + svEsc(x.name) : '') + '</td>' + mechNum(x.aLength) + mechNum(x.bLength) + '</tr>')
      .concat(f.added.map(x => '<tr><td><span class="patchMono">' + svEsc(x.type) + ' ' + x.id + '</span><span class="mechSub"> added</span></td>' + mechNum('') + mechNum(x.length) + '</tr>'))
      .concat(f.removed.map(x => '<tr><td><span class="patchMono">' + svEsc(x.type) + ' ' + x.id + '</span><span class="mechSub"> gone</span></td>' + mechNum(x.length) + mechNum('') + '</tr>'));
    host.appendChild(el('p', 'mechLede', '<b>' + f.changed.length + '</b> changed, <b>' + f.added.length +
      '</b> added and <b>' + f.removed.length + '</b> gone, of ' + f.aCount + '.'));
    host.appendChild(el('div', '', mechTable(['resource', '#in ' + svEsc(app.aName), '#in ' + svEsc(app.bName)], rows)));
  }
}

/* MAGPIE'S SIGNATURE, WHICH IS WHAT TELLS A PATCH FROM A SAVED GAME. Both are
   type `DelP`: `I.M.Cheater`, `Tree`, `Zone` and `Rocky the Flying Chicken`
   are `DelP`/`Delv`, and the Pumpkin Patch is `DelP`/`Delp`. Cythera's bundle
   claims `DelP` and draws a saved game for it; Magpie's claims `DelP` too and
   draws its own patch icon, the framed tile with a corner cut away. So the
   creator is the whole of the difference, and a patch written with the game's
   creator would arrive on a Mac looking like somebody's saved game. */
const DELV_PATCH_CREATOR = 'Delp';
function compareExportPatch(asMacBinary) {
  const rep = window.COMPARE_REPORT;
  const note = document.getElementById('compareNote');
  const say = (m, bad) => { if (note) { note.textContent = m; note.className = bad ? 'mechSub patchBad' : 'mechSub'; } };
  if (!rep) return;
  const d = document.getElementById('patchDesc');
  try {
    /* TYPE 3, NOT 0, AND THE DIFFERENCE MATTERS. The byte at descriptor +26
       carries Magpie's type, and 0 is Bug Fix -- the one value the binary
       tests outright, in the branch that raises "Bug fixes are always
       installed, and can not be removed". Exporting as 0 would have produced
       patches nobody could uninstall, which was the first thing driving the
       real export path showed. 3 is what the one real add-on patch carries,
       and is removable. It is used because that is what a working patch has,
       not because anything here knows what 3 is called. */
    const w = writeDelverPatch(rep.bSpec, rep.changed.map(c => c.resid),
      { description: (d && d.value) || '', typeCode: DELV_PATCH_EXPORT_TYPE });
    /* The file is named for the archive, not for the side of the comparison.
       `bName` is "as it stands" when you are exporting your own edits, and
       "as it stands Patch" is not a file name anyone wants. */
    const base = (rep.kind === 'edits' ? (window.ARCHIVE_SOURCE_NAME || 'Cythera Data') : rep.bName) || 'Cythera';
    const name = safeFileName(base.replace(/\.[A-Za-z0-9]{1,4}$/, '') + ' Patch');
    /* Two shapes of the same patch. The bare data fork is the file itself and
       is what a shared folder wants; the MacBinary is the same bytes with a
       Finder identity around them, so a Mac that decodes it gets a file typed
       DelP with Magpie's creator -- which is what makes it a patch rather
       than a saved game to the Finder, and what puts Magpie's own icon on it.
       A patch has no resource fork, so the wrapper carries none. */
    if (asMacBinary) {
      const bin = writeMacBinary({ name: name, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
      dlBlob(new Blob([bin], { type: 'application/macbinary' }), name + '.bin');
    } else {
      downloadBlob(w.bytes, name);
    }
    say(w.resids.length + ' resource(s) written, ' + w.bytes.length.toLocaleString() +
        ' bytes' + (asMacBinary ? ' in a MacBinary typed DelP/' + DELV_PATCH_CREATOR : '') +
        ', identity ' + w.uuidText +
        (w.checkValueValid ? ', check value ' + w.checkValue + ' and it verifies.' : ', and the check value does not verify.'));
  } catch (e) { say('That patch could not be written: ' + e.message, true); }
}

function renderMechanicsSheet(value) {
  stopAllViewActivity();
  // The figures' weapon list is derived, so it is dropped here and rebuilt
  // with the sheet rather than kept for the session; resetDerivedCaches()
  // drops it too, for the archive that is swapped while it is not showing.
  window.MECH_WEAPONS = null;
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const box = document.createElement('div');
  box.className = 'mechView';
  // Short names for the shared builders, so the sections read as they did
  // when these were closures here.
  const table = mechTable, num = mechNum, stat = mechStat;
  const sections = [];
  // One section: an icon, a title, where it was read from, a line saying what
  // it is, the rule as short items, and the table or strip under it.
  /* A section is built but NOT placed here: the grouping loop below appends
     the ones whose tab is showing. It used to append on the spot and the loop
     re-appended, which moved the node rather than copying it, so the only
     change is that a section whose tab is not open now stays unplaced instead
     of being built into the page and then moved out of it. */
  const add = (id, title, icon, from, lede, rules, html, chips) => {
    const sec = mechSectionEl(id, title, icon, from, lede, rules, html, chips);
    sections.push({ id, title, el: sec });
  };
  const src = mechSrc;
  const chipOf = i => loadCharacterTable()[i] ? characterChip(i) : '';
  // The application's clock, off TGameViewer::DoTicks, for every section
  // that counts time; null with no application open, and then no section
  // states a figure of it.
  const clk = appImage() ? exeClockRules() : null;
  const model = clk && clk.model;
  const perHour = clk && clk.unitsPerHour ? clk.unitsPerHour.v : null;
  // A period of the program's table, in words, as a link to the table.
  const period = i => clk && clk.table && clk.table.v[i] !== undefined ? srcNum(clk.table, exeClockWords(clk.table.v[i], perHour)) : '';
  const noApp = MECH_NO_APP;
  const propChip = (pt, name, sub) => '<button class="relChip" onclick="showPropTypeDetail(' + pt + ')"><span class="relText"><span class="relMain">' + svEsc(name) + '</span>' + (sub ? '<span class="relSub">' + svEsc(sub) + '</span>' : '') + '</span></button>';

  // ---- the dice game ----
  const dice = diceGame();
  add('dice', 'The dice game', null, src('the game', 0x812),
    dice ? 'Played at the inns: three dice, the innkeeper’s two black and your one white, ' +
             (dice.faces.every(f => f === dice.faces[0]) ? 'each showing one to ' + srcNum(dice.vals.faces[0])
               : 'showing one to ' + srcNum(dice.vals.faces[0]) + ', ' + srcNum(dice.vals.faces[1]) + ' and ' + srcNum(dice.vals.faces[2]) + ': the innkeeper’s first, yours, the innkeeper’s second') + '.'
         : 'The inn’s dialogue script (0x812) is not in this archive, or does not carry the game.',
    dice ? [
      'The innkeeper throws one die, you throw yours. <b>Match it and you win ' + srcNum(dice.vals.matchPay) + ' obol' + (dice.matchPay === 1 ? '' : 'oi') + '.</b>',
      'Otherwise the innkeeper throws the second. Yours <b>outside</b> the two black dice wins the distance to the nearer; <b>between</b> them, or on one, loses an obol.',
      'A win of 1 is a push and the game goes again.',
      'The script pays one obol less than it announces, the one being your stake, and takes one on a loss.',
      dice.skillAlways ? '<b>Gambling</b> sets your die to the innkeeper’s first whenever they differed.' + (dice.skillFree ? ' The script’s test for the skill has been edited out, so this happens without it.' : '')
        : dice.vals.skillFaces ? '<b>Gambling</b> gives your die a one in ' + srcNum(dice.vals.skillFaces) + ' chance of being set to the innkeeper’s first, when they differed.' + (dice.skillFree ? ' The script’s test for the skill has been edited out, so this happens without it.' : '')
        : ''
    ].filter(Boolean) : [],
    dice ? '<div class="mechStats">' + stat(dice.wins, 'win') + stat(dice.pushes, 'push') + stat(dice.losses, 'lose') + '<span class="mechStatNote">of ' + dice.total + ' throws</span>' +
           stat((dice.fair >= 0 ? '+' : '') + dice.fair.toFixed(3), 'obols a game, without the skill') + stat((dice.skilled >= 0 ? '+' : '') + dice.skilled.toFixed(3), 'with it') + '</div>' +
           (dice.explain ? '<blockquote class="mechQuote">' + svEsc(dice.explain.replace(/\*/g, ' ')) + '<footer>the innkeeper, in the same script</footer></blockquote>' : '') +
           mechFig('All ' + dice.total + ' throws: the innkeeper’s first die down the side, the second across, your own ' + dice.faces[1] + ' faces inside each cell',
             mechDiceMatrix(mechDiceExact(dice.opts).cells),
             'Red is the obol you lose, grey a push, green a win, brighter for a larger one. Every face of yours outside the two black dice pays.') +
           '<div class="mechCtl">' +
             '<button onclick="diceSimPlay(1)">Throw</button>' +
             '<button onclick="diceSimPlay(1000)">1,000 games</button>' +
             '<button onclick="diceSimPlay(100000)">100,000</button>' +
             '<label><input type="checkbox" onchange="diceSimSet(this.checked)"> with <b>Gambling</b></label>' +
             '<button onclick="diceSimReset()">Reset</button>' +
           '</div><div id="diceSim">' + diceSimHtml() + '</div>' + mechDiceBytes(dice) : '',
    dice ? '<span class="partsTitle">In the file</span>' + src('The game', 0x812) + src('The dice', 0x1148) + src('Gambling', 0x1ACF) + [40, 41, 42].map(chipOf).join('') : '');

  // ---- combat ----
  const cb = combatRules(), ar = attackRules();
  const rollFrom = (what) => ar && ar.scale ? 'a roll of 0 to ' + what + ' less ' + srcNum(ar.scale.subVal) + ' over ' + srcNum(ar.scale.divVal) : '';
  const rollTo = v => v ? srcNum(v, v.v - 1) : '';
  add('combat', 'Combat', null, src('the attack', 0x3042) + src('a blow', 0xE88) + src('a missile', 0xE89) + src('the outcome', 0xE87),
    cb ? 'Four routines: one chooses what is swung or thrown, one makes the attacker’s margin for a blow, one for a missile, and one turns the margin into a parry, a miss or a hit.'
       : 'The combat routines (0xE87 to 0xE89) are not in this archive.',
    cb ? [
      ar && ar.reach && ar.meleeFirst ? 'The attack picks the weapon first: the first thing wielded whose <b>reach</b> covers the distance swings' +
        (ar.range && ar.beyondAdjacent ? ', and only when nothing does, the target is not adjacent and it is in sight, does the first thing with a throw entry <b>fly</b>, as a missile' : '') + '.' +
        (ar.squared && ar.lessOne ? ' Reach and range are squared and set against the squared distance less ' + srcNum(ar.lessOneVal, 'one') + ', so reach 1 is the eight neighbours and reach 2 two squares in a line or a knight’s move.' : '') : '',
      'The margin is the attacker’s <b>reflex</b>' + (cb.roll ? ' <b>plus a roll of 0 to ' + rollTo(cb.roll) + '</b>' : '') +
        (cb.skillOffLoop
          ? (cb.barehand ? ', plus Barehand when nothing is wielded' : '') + (cb.missileSkill ? ' (Missile for a launcher)' : '')
          : ', plus the weapon’s skill' + (cb.barehand ? ' (Barehand with none' : '') + (cb.missileSkill ? ', Missile for a launcher)' : ')')) +
        ', <b>less the defender’s reflex' + (cb.rollDefender ? ' plus a roll of 0 to ' + rollTo(cb.rollDefender) : '') + '</b>, plus Attack less Defence. A monster flagged so uses body for reflex.',
      cb.skillOffLoop ? '<b>A weapon’s own skill adds nothing.</b> The resolver is written to add it to the margin and to the damage figure, but reads it off ' +
        srcNum(cb.skillOffLoop[0], 'what the shield loop leaves behind') + ' instead of off the weapon, and that is always nothing, so Sword, Axe and Mace change no armed blow.' : '',
      'The weapon’s enchantment' + (cb.skillOffLoop ? ' goes' : ' and skill go') + ' on the margin first. Then, <b>in this order</b>: a margin of nothing or less <b>misses</b>; ' +
        (cb.parry ? 'what is left is offered to the shields: each shielding thing the defender wears rolls <b>0 to its block plus the Shield skill</b>, the rolls are added up, and a margin under the total is <b>parried</b>' : 'what is left lands') +
        '. A blow that would have missed is never parried.',
      cb.dmgAdd ? 'A hit does <b>' + srcNum(cb.dmgAdd) + ' plus a roll under the damage figure, plus the enchantment</b>, so ' + cb.dmgAdd.v + ' to the figure' + (cb.dmgAdd.v === 1 ? ' rather than nothing to it' : ' less one, and more') + (cb.skillOffLoop ? '' : ', with the skill widening the figure before the roll') + '. The defender’s resistance takes the damage type afterwards, so the word the game prints can be bigger than what is felt.' : '',
      ar && ar.bodyRoll && ar.scale ? 'The damage figure of a blow is the weapon’s plus ' + rollFrom('body') + (ar.reflexRoll ? '; a throw’s is its throw entry’s plus ' + rollFrom('reflex') : '') + '.' : '',
      ar && ar.lodges && ar.drops ? (wrongCarryFlags().some(w => w.resid === 0x3042)
        ? 'A thrown weapon that <b>hits or is parried</b> is given the target as its container but flags of 9, not the carried flag, so it ends inside no one and is lost; one that misses lies on the target’s square. Nothing brings either back.'
        : 'A thrown weapon that <b>hits or is parried</b> goes into the target, carried, which is where it is when the target dies; one that misses lies on the target’s square. Nothing brings it back.') + (ar.ammoSpent ? ' A launcher spends one of its ammunition a shot.' : '') : '',
      cb.words.length ? 'The blow is named by its size: ' + cb.words.map(w => '<i>' + svEsc(w.word) + '</i> under ' + srcNum(w.val)).join(', ') + (cb.last ? ', and <i>' + svEsc(cb.last.word) + '</i> above.' : '.') : ''
    ].filter(Boolean) : [],
    cb && cb.roll && cb.rollDefender && cb.dmgAdd ? combatSimControls() + '<div id="combatOut">' + combatSimHtml(combatSimParams(), cb) + '</div>' : '', '');

  // ---- damage to things ----
  // Every class with a TakeDamage of its own, read off its script
  // (damageTakers), and the door and chest helpers they hand the blow to.
  {
    const dt = damageTakers();
    const rows = dt.rows, door = dt.door, chest = dt.chest;
    const nm = r => svLink(r.name, 'showItemDetail(' + r.pt + ')');
    const typed = rows.filter(r => r.types.length);
    const sig = r => r.types.map(t => t.mask.v + t.op + t.k.v).join(',');
    const oneTable = typed.length && typed.every(r => sig(r) === sig(typed[0]));
    // Which weapons each test catches (damageTypeCarriers): a type with
    // the bit that no earlier test took.
    const carriers = (steps, i) => damageTypeCarriers(t => !!(t & steps[i].mask.v) && !steps.slice(0, i).some(p => t & p.mask.v));
    const opWord = t => (t.op === 'mul' ? '× ' : '÷ ') + srcNum(t.k);
    const doors = rows.filter(r => r.rule === 'door'), chests = rows.filter(r => r.rule === 'chest');
    const listStrength = rs => rs.map(r => nm(r) + ' ' + srcNum(r.strength)).join(', ');
    const q = s => s ? ' (“' + svEsc(s) + '”)' : '';
    add('damage', 'Damage to things', null, src('a blow', 0xE87) + src('a door', 0xE49) + src('a chest', 0xE4A),
      rows.length ? 'A blow or a damaging spell hands its damage and its type to what it hits. A character takes it off health; ' + rows.length + ' kinds of thing take it by a rule of their own, each read off its own class script.'
                  : 'No item class in this archive takes damage by a rule of its own.',
      rows.length ? [
        oneTable ? typed.map(nm).join(', ') + ' change the damage by its type first, testing one bit after another: ' +
          typed[0].types.map((t, i, all) => 'a type with <b>' + srcNum(t.mask) + '</b> in it ' + opWord(t) + (carriers(all, i) ? ' <span class="inspDim">(' + svEsc(carriers(all, i)) + ')</span>' : '')).join(', else ') +
          '. The first bit that matches decides, and any other type, fire or electric, is left as it is.' : '',
        door && door.destroy && doors.length ? 'A locked door has a strength, its class’s lock figure: ' + listStrength(doors) + '. A blow above <b>' + srcNum(door.destroy.factor) + ' times the strength</b> destroys it' + q(door.saysDestroyed) + '.' +
          (door.opens ? ' Short of that, a blow above what is left of the strength ' + srcNum(door.opens, 'bashes it open') + q(door.saysOpened) : '') +
          (door.wear && door.step ? ', and one above what is left ÷ ' + srcNum(door.wear) + ' wears it down by ' + srcNum(door.step) + q(door.saysWorn) : '') + '.' +
          (door.magicOnlyDestroyed ? ' A magically locked door can only be destroyed.' : '') + ' Struck closed and unlocked, a door opens; struck open, nothing happens.' : '',
        chest && chest.destroy && chests.length ? 'A chest’s strength is given in its own class script: ' + listStrength(chests) + '. Whatever its state, a blow above <b>' + srcNum(chest.destroy.factor) + ' times the strength</b> destroys it' + (chest.spills ? ' and drops what it held' : '') + '.' +
          (chest.opens ? ' Locked, a blow above what is left ' + srcNum(chest.opens, 'opens it') + q(chest.saysOpened) : '') +
          (chest.wear && chest.step ? ', one above what is left ÷ ' + srcNum(chest.wear) + ' wears it down by ' + srcNum(chest.step) + q(chest.saysWorn) : '') +
          (chest.saysHeld ? ', and a smaller one says “' + svEsc(chest.saysHeld) + '”' + (/[.!?]$/.test(chest.saysHeld) ? '' : '.') : '.') +
          ' Magically locked, only destruction; closed and unlocked, it opens.' : '',
        (door && door.setsOff) || (chest && chest.setsOff) ? 'Before a door or a chest is judged, anything inside it flagged 2 is used on the current character and removed.' : '',
        'What is left of a strength is kept in the placed door’s or chest’s Data2, which is set to the full strength the first time it is struck.',
        (function () {
          const bl = blastRules();
          if (!bl || !bl.centre) return '';
          return 'A <b>bomb</b> is the one thing that damages a square rather than a target: when its fuse runs out it hands <b>' + srcNum(bl.centre) + '</b> to everything on its own square, <b>' + srcNum(bl.edge) + '</b> to the four beside it and <b>' + srcNum(bl.corner) + '</b> to the four corners, as ' + (bl.type ? damageTypeName(bl.type.v) + ' (type ' + srcNum(bl.type) + ')' : 'its own type') + '. A locked door whose strength is below a fifth of that goes down to one.';
        })()
      ].filter(Boolean) : [],
      rows.length ? table(['thing', 'when struck', 'says'], rows.map(r => '<tr><td>' + propChip(r.pt, r.name) + '</td><td>' + damageRowWords(r) + ' ' + srcNum({ resid: r.resid, at: r.at }, 'script') + '</td><td>' +
        (r.says.filter(s => s !== r.spills)[0] ? '“' + svEsc(r.says.filter(s => s !== r.spills)[0]) + '”' : '') + '</td></tr>')) : '', '');
  }

  // ---- weapons and armour ----
  const gear = gearTable();
  const kind = r => r.melee ? 0 : r.thrown ? 1 : r.ranged ? 2 : r.ammo ? 3 : r.armour ? 4 : 5;
  gear.sort((a, b) => kind(a) - kind(b) || ((b.damage || 0) - (a.damage || 0)) || ((b.protection || b.block || 0) - (a.protection || a.block || 0)) || a.name.localeCompare(b.name));
  add('gear', 'Weapons and armour', null, src('the classes', 0x1000),
    gear.length ? gear.length + ' item classes carry combat parameters.' : 'No item class in this archive carries combat parameters.',
    gear.length ? [
      '<b>Damage</b> is the most a blow can do before the skill is added; a blow that lands rolls 1 to it.',
      ar && ar.reach && ar.squared && ar.lessOne ? 'A weapon <b>reaches</b> a target when its reach squared is at least the squared distance less one: 1 is the eight neighbours, 2 two squares in a line or a knight’s move. A launcher’s <b>range</b> is the same column and the same test.'
        : '<b>Reach</b> is in squares, set against the distance before a swing. A launcher’s <b>range</b> is the same column.',
      gear.some(r => r.thrownDamage !== null) ? 'A weapon with a <b>thrown</b> figure flies at that damage over that <b>range</b> when nothing wielded reaches the target.' : '',
      'A launcher fires the <b>ammunition class</b> its arrows or stones carry.',
      'Armour gives <b>protection</b> in points; a shield <b>blocks</b> a roll of 0 to its figure plus the Shield skill.'
    ].filter(Boolean) : [],
    table(['item', '#weight', '#damage', '#reach', '#thrown', '#range', '#type', 'skill', '#ammo class', '#protection', '#block'],
      gear.map(r => {
        const cell = (v, s) => v === null || v === undefined ? '<td class="num"></td>' : srcCell(s, v);
        return '<tr><td>' + propChip(r.pt, r.name, ['melee', 'thrown', 'ranged', 'ammunition', 'armour', 'shield'][kind(r)]) + '</td>' +
          cell(r.weight, r.src.weight) + cell(r.damage, r.src.damage) + cell(r.reach, r.src.reach) + cell(r.thrownDamage, r.src.thrown) + cell(r.thrownRange, r.src.thrown) +
          cell(r.type, r.src.type) + '<td>' + svEsc(r.skill) + '</td>' + cell(r.ammoClass, r.src.ammoClass) + cell(r.protection, r.src.protection) + cell(r.block, r.src.block) + '</tr>';
      })) +
    mechGearFigure(gear), '');

  // ---- the prop word and the two data bytes ----
  // The icon is tile 0x208, the flail: the picture no class owns that the
  // create-a-prop cheat reaches with a mace at aspect 8, which is how the
  // word came to be looked at. In another archive it is whatever is there.
  const pw = propWordRules();
  const pwName = pt => propDisplayName(pt) || ('prop 0x' + pt.toString(16).toUpperCase());
  const pwBuild = gear.find(r => r.melee) || gear[0] || null;
  const pwEx = pw.examines.length ? pw.examines[0] : null;
  const pwByByte = k => ({ r: pw.readers.filter(x => x.ops.includes('get ' + k)), w: pw.readers.filter(x => x.ops.includes('set ' + k)) });
  add('propword', 'Prop records: type, aspect, Data1 and Data2', null, src('the outcome', 0xE87) + (pwEx ? src('Examine', 0x1000 + pwEx.pt) : ''),
    'A prop record names what it is with one 16-bit word, and carries two bytes beside it that each class script reads for its own purpose.',
    [
      'The word is <b>the prop type in the low ten bits and an aspect in the five above</b>, so a step of aspect is worth 1,024 and a step of type 1. The create-a-prop cheat asks for this word, then Data1 in decimal, then Data2 in hex.' +
        (pwBuild ? ' Build one on any item’s page, under Prop record: ' + svLink(pwBuild.name, 'showItemDetail(' + pwBuild.pt + ')') + '.' : ''),
      'Aspect <i>n</i> draws the prop type’s base tile + <i>n</i> and the prop <b>takes that tile’s name</b>. Whether it changes anything else is decided by the class script: ' + mechAspectReaders() + ' The pictures that leaves no class owning are at the foot of Items.',
      mechAspectContrast(),
      pw.ench && pw.ench.guarded && pw.ench.added ? '<b>Data1 on a weapon is its enchantment.</b> The outcome routine reads it off a weapon that is both a melee weapon and equipment and adds it to the damage of every blow' +
        (pw.ench.magic ? ', and <b>a blow with any enchantment counts as magical</b>, which is what gets past the monsters that resist non-magical weapons' : '') + '. An arrow’s Data1 is not read: the test is for a melee weapon.' : '',
      pwEx && pwEx.hiVal && pwEx.loVal ? 'Examine reports it on ' + pw.examines.map(e => pwName(e.pt)).join(', ') + ': “' + svEsc(pwEx.above2) + '” above ' + srcNum(pwEx.hiVal) + ', “' + svEsc(pwEx.above0) + '” above ' + srcNum(pwEx.loVal) + '.' : '',
      pw.zoneReaders.length ? '<b>Data3</b> is both bytes read as one value; ' + pw.zoneReaders.length + ' passage classes hand it to ChangeZone as the destination.' : '',
      pw.scripts ? '<b>' + pw.scripts + ' scripts</b> read or write the bytes, ' + pw.readers.length + ' of them class scripts. What a byte means is that class’s own.' : 'No script in this archive reads the bytes.'
    ].filter(Boolean),
    (pw.placed.length ? '<div class="mechSub">Placed with an enchantment</div>' +
      table(['item', 'where', '#aspect', '#Data1'], pw.placed.map(r => '<tr><td>' + svLink(pwName(r.pt), 'showItemDetail(' + r.pt + ')') + '</td><td>' +
        svLink(zoneNameFor(r.resid) || ('0x' + r.resid.toString(16).toUpperCase()), 'showItemOnMap(' + (r.resid - 0x100) + ',' + r.pt + ')') +
        (r.carriedBy !== null && loadCharacterTable()[r.carriedBy] ? ', carried by ' + svLink(characterName(r.carriedBy), 'showCharacterDetail(' + r.carriedBy + ')') : '') + '</td>' + num(r.aspect) + num(r.d1) + '</tr>'))
      : '<div class="mechSub">Placed with an enchantment</div><div class="sv-note" style="margin-top:0">No melee weapon in a prop list carries a Data1.</div>') +
    (pw.ammo.length ? '<div class="sv-note">' + pw.ammo.length + ' ammunition record' + (pw.ammo.length === 1 ? '' : 's') + ' carr' + (pw.ammo.length === 1 ? 'ies' : 'y') + ' a Data1 too, which the outcome routine does not read.</div>' : '') +
    '<div class="mechSub">Which class scripts read them</div>' +
    table(['byte', 'read by', 'written by'], ['data1', 'data2', 'data3'].map(k => { const b = pwByByte(k); return b.r.length || b.w.length
      ? '<tr><td>' + k.replace('data', 'Data') + '</td><td>' + b.r.map(x => svLink(pwName(x.pt), 'jumpToResource(' + x.resid + ')')).join(', ') + '</td><td>' + b.w.map(x => svLink(pwName(x.pt), 'jumpToResource(' + x.resid + ')')).join(', ') + '</td></tr>' : ''; })), '');

  // The spells are on the Spells sheet now (spellsMechSection in
  // js/delv-sheets.js), above the spells themselves.

  // ---- what a use can be aimed at ----
  {
    const tg = targetRules();
    const walk = appImage() ? exeWalkStub() : null;
    const byWord = new Map();
    for (const t of tg) { if (!byWord.has(t.word)) byWord.set(t.word, []); byWord.get(t.word).push(t); }
    const reach = tg.filter(t => t.word & 0x8000);
    const nameLink = t => srcNum(t.val, t.name);
    add('target', 'What a use can be aimed at', null, '',
      tg.length ? tg.length + ' scripts ask for a target: a spell after its casting call, an item when it is used. Each prints its question and returns a word, and the application tests that word against whatever is under the pointer before it accepts the click.'
                : 'No script in this archive asks for a target.',
      tg.length ? [
        'The bits are ' + TARGET_BIT_NAMES.map(([m, n]) => '<b>' + svEsc(n) + '</b> ' + propWordHex(m)).join(', ') + '. A word carrying more than one of the low bits takes any of them.',
        '<b>Within reach</b> is the character’s own square and the eight around it, the same test that decides whether a thing can be dragged, so ' + reach.length + ' of these ask for a neighbour.' +
          (walk ? ' A target further off would be walked to first, and in this program <b>the routine that would walk there does nothing and answers false</b> (' + srcNum(walk.at, walk.ops + ' instructions') + '), so the click is refused instead.' : ''),
        'Bit ' + propWordHex(8) + ' is a second character test whose flag is not named here; the things that ask for it are the ones you hand to a person.',
        'Nothing in this archive asks for ' + propWordHex(0x4000) + ', a target in a straight line.'
      ].filter(Boolean) : [],
      table(['#word', 'wants', 'asked for by'], [...byWord.entries()].sort((a, b) => (b[0] & 0x8000) - (a[0] & 0x8000) || a[0] - b[0]).map(([w, list]) =>
        '<tr><td class="num">' + propWordHex(w) + '</td><td>' + targetWordWords(w).map(svEsc).join(', ') + '</td><td>' +
        list.map(nameLink).join(', ') + '</td></tr>')),
      appImage() ? '<span class="partsTitle">In the executable</span>' + pefChip('TDroppableWindow::NeedsTarget') + pefChip('TDroppableWindow::CanSearch') + pefChip('TGameSys::WalkToLocation') : '');
  }

  // What each skill is asked about is on the Skills sheet now
  // (skillsMechSection in js/delv-sheets.js), beside the skills.

  // ---- experience and levels ----
  const xp = experienceRules();
  add('experience', 'Experience and levels', null, src('every award', 0xE8B) + src('a new level', 0xE86),
    xp.rule ? 'Every award goes through one helper, and a level is a threshold on the total.' : 'The experience helper (0xE8B) is not in this archive.',
    xp.rule ? [
      'Experience is added' + (xp.rule.cap ? ', <b>capped at ' + srcNum(xp.rule.cap, xp.rule.cap.v.toLocaleString('en-US')) + '</b>' : '') +
        (xp.rule.doubling && xp.rule.base ? ', and the level rises by one when it passes <b>' + srcNum(xp.rule.base) + ' × 2 to the power of the level less ' + srcNum(xp.rule.less, xp.rule.less ? xp.rule.less.v : '') + '</b>: above ' +
          [2, 3, 4, 5, 6].map(l => mechLevelThreshold(l - 1, xp.rule.base.v).toLocaleString('en-US') + (l === 2 ? ' for level 2' : l < 5 ? ' for ' + l : '')).join(', ') + ', doubling.' : '.'),
      xp.rule.healthReflexDiv && xp.rule.healthMul && xp.rule.healthDiv ? 'A new level recomputes full health as <b>body + reflex ÷ ' + srcNum(xp.rule.healthReflexDiv) + ' + level, plus Defence × ' + srcNum(xp.rule.healthMul) + ' × reflex ÷ ' + srcNum(xp.rule.healthDiv) + '</b>, taking Defence as the skill where the character has it and a class figure, with health scaled to match, and full magic as <b>mind + Mana</b> the same way.' : '',
      xp.rule.gapAdd ? 'Striking something earns the attacker the damage dealt, up to the victim’s level above theirs plus ' + srcNum(xp.rule.gapAdd) + (xp.rule.pastGap ? ', and ' + srcNum(xp.rule.pastGap) + ' for a blow bigger than the gap the other way' : '') + '.' : '',
      'A shared award is split across the party.'
    ].filter(Boolean) : [],
    (xp.rule ? mechExperienceFigure(xp.rule) : '') +
    (xp.awards.length ? '<div class="mechSub">The fixed awards, ' + xp.awards.length + ' of them</div>' + table(['#points', 'occasion', 'where'], xp.awards.map(a => '<tr>' + srcCell(a.val, a.amount) + '<td>' + svEsc(a.note) + '</td><td>' + svChip(a.resid) + '</td></tr>')) : ''), '');

  // ---- karma ----
  const km = karmaRules();
  const start = km.writes.find(w => w.set !== undefined);
  add('karma', 'Karma', null, src('a kill', 0xE8D),
    km.writes.length ? 'A number the scripts move, and test.' : 'No script in this archive moves karma.',
    km.writes.length ? [
      start ? 'It starts at <b>' + srcNum(start.val, start.set) + '</b> when a character is made.' : '',
      km.byAlignment ? 'Killing something moves it by the victim’s alignment, values 0 to ' + (km.byAlignment.length - 1) + ' in turn: <b>' + srcNum(km.byAlignmentSrc, km.byAlignment.map(v => (v > 0 ? '+' : '') + v).join(', ')) + '</b>. Nothing in the file names them.' : '',
      /* Who has which alignment, off the character table (byte 25 of each
         record, the byte the kill table indexes), so the sentence above can
         say what a kill of a townsperson does. The board recorded killing
         NPCs raising karma as a bug (topic 2023); this is why. No script
         writes the field, and the application writes it only when a
         character is made and when one joins the party. */
      km.byAlignment ? (() => {
        const by = new Map();
        loadCharacterTable().forEach((c, i) => {
          if (!c || !c.raw || c.raw.every(b => !b) || i === 0) return;
          if (!by.has(c.raw[25])) by.set(c.raw[25], []);
          by.get(c.raw[25]).push(i);
        });
        const zero = by.get(0) || [], delta0 = km.byAlignment[0];
        if (!zero.length || delta0 === undefined) return '';
        const others = [...by.keys()].filter(a => a !== 0).sort((a, b) => a - b)
          .map(a => by.get(a).map(i => chipOf(i) || svEsc(characterName(i))).join(' ') + ' ' + (by.get(a).length === 1 ? 'has' : 'have') + ' ' + a);
        return 'In the character table <b>' + zero.length + ' characters have alignment 0</b>, every townsperson among them' + (others.length ? ', while ' + others.join(' and ') : '') +
          ', and no script changes it, so <b>killing a townsperson ' + (delta0 > 0 ? 'raises karma by ' + delta0 : delta0 < 0 ? 'lowers karma by ' + (-delta0) : 'leaves karma alone') + '</b>.';
      })() : '',
      km.reads.length ? 'It is tested <b>' + km.reads.filter((r, i, a) => a.findIndex(x => x.test === r.test) === i).map(r => (r.below ? 'below ' : 'above ') + srcNum(r.val, r.n)).join('</b> and <b>') + '</b>.' : ''
    ].filter(Boolean) : [],
    mechKarmaFigure(km) +
    table(['#change', 'occasion', 'where'], km.writes.filter(w => w.set === undefined).map(w => '<tr>' + (w.change !== null && w.change !== undefined ? srcCell(w.val, (w.change > 0 ? '+' : '') + w.change) : num(w.why || '')) + '<td>' + svEsc(w.note || '') + '</td><td>' + svChip(w.resid) + '</td></tr>')
      .concat(km.reads.map(r => '<tr><td class="num">' + (r.below ? 'below ' : 'above ') + srcNum(r.val, r.n) + '</td><td>' + svEsc(r.note || '') + '</td><td>' + svChip(r.resid) + '</td></tr>'))), '');

  // ---- food and potions ----
  const fd = foodRules();
  add('potions', 'Potions', null, src('the potion', 0x101F),
    fd.potions.length ? 'A potion’s colour is its aspect, and the aspect picks one of eight effect scripts.' : 'No potion class in this archive.',
    [],
    (fd.potions.length ? table(['potion', 'does', 'effect'], fd.potions.map(p => '<tr><td>' + svEsc(p.name) + '</td><td>' + p.effects.map(x => srcNum(x.src, x.text)).join('; ') + (p.says ? ' <span class="inspDim">“' + svEsc(p.says) + '”</span>' : '') + '</td><td>' + svChip(p.resid) + '</td></tr>')) : ''), '');
  add('food', 'Food', null, '',
    fd.foods.length ? 'A food adds to nutrition when used. The general foodstuff classes read an amount per variant, and one of them a line per variant, by the aspect; a variant is the class at another aspect.' : 'No food in this archive.',
    [],
    (fd.foods.length ? table(['food', '#aspect', 'variant', '#nutrition', 'says'], fd.foods.flatMap(f => f.variants
      ? f.variants.map(v => '<tr><td>' + propChip(f.pt, f.name) + '</td>' + num(v.aspect) + '<td>' + svLink(svEsc(v.name || ('variant ' + v.aspect)), 'propWordOpen(' + f.pt + ',' + v.aspect + ')') + '</td>' + srcCell(v.src, '+' + v.plus) + '<td>' + (v.says ? '“' + svEsc(v.says) + '”' : '') + '</td></tr>')
      : ['<tr><td>' + propChip(f.pt, f.name) + '</td><td></td><td></td>' + (f.plus !== null ? srcCell(f.val, '+' + f.plus) : num('an amount the script works out')) + '<td></td></tr>'])) : '') +
    mechFoodFigure(fd, hungerNotes().ceiling), '');

  // ---- status effects ----
  const st = statusRules();
  const statusNames = new Set([...st.applies.keys(), ...st.cures.keys()]);
  add('status', 'Status effects', null, '',
    st.applies.size ? 'Every place a script puts a status on somebody, with the duration the call gives in clock units' + (perHour ? ' of ' + srcNum(clk.unitsPerHour) + ' to the game hour' : '') + ', and every place one is cleared, which is what a cure is.' : 'No script in this archive applies a status.',
    (function () {
      const rules = [];
      let cures = [], grants = [];
      try { cures = chanceCures(); } catch (e) { cures = []; }
      try { grants = grantRules(); } catch (e) { grants = []; }
      for (const c of cures) rules.push('<b>' + svEsc(c.name) + '</b> clears ' + svEsc(c.flag || 'a status') + ' only on a roll: ' + srcNum(c.is, 'one time in ' + (c.hi.v - c.lo.v)) + ', tested each time it is used, and what it heals is not a condition of it.');
      if (grants.length) rules.push('A worn thing can carry a status of its own: ' + grants.map(g => svLink(g.name, 'showItemDetail(' + g.pt + ')') + ' ' + srcNum(g.flag, g.flagName || ('flag ' + g.flag.v))).join(', ') + '.');
      return rules;
    })(),
    mechStatusFigure(st, perHour) + table(['status', 'applied by', 'cleared by'], [...statusNames].sort().map(nm => '<tr><td>' + svEsc(nm) + '</td><td>' +
      (st.applies.get(nm) || []).map(a => svChip(a.resid) + (a.duration !== null ? ' <span class="inspDim">for</span> ' + srcNum(a.durationVal, a.duration) : '')).join(' ') + '</td><td>' +
      [...(st.cures.get(nm) || [])].map(r => svChip(r)).join(' ') + '</td></tr>')) +
    (function () {
      let grants = [];
      try { grants = grantRules(); } catch (e) { grants = []; }
      return grants.length ? '<div class="mechSub">Worn or used, and the status it gives</div>' +
        table(['thing', 'status', 'given by', 'taken away by'], grants.map(g => '<tr><td>' + propChip(g.pt, g.name) + '</td><td>' + srcNum(g.flag, g.flagName || ('flag ' + g.flag.v)) + '</td><td>' + svEsc(g.method) + '</td><td>' + (g.clearedBy ? svEsc(g.clearedBy) : '<span class="inspDim">nothing in the class</span>') + '</td></tr>')) : '';
    })(), '');

  // ---- hunger, and healing with it ----
  // The fall and the healing are the application's, TGameViewer::DoTicks,
  // read by exeClockRules when the application is open; the scripts' side,
  // the complaint and the ceiling, off the archive.
  const hg = hungerNotes();
  add('hunger', 'Hunger and healing', null, '',
    'Nutrition is a byte on the character' + (clk && clk.nutritionByte ? ', byte ' + srcNum(clk.nutritionByte) + ' of its record' : '') + (hg.ceiling !== null ? ', 0 to ' + srcNum(hg.ceilingVal) : '') + '. No script lowers it: ' +
      (model ? 'the application’s tick routine takes <b>' + srcNum(clk.fall) + ' off</b> each time the clock passes ' + period(model.hungerIndex) + ', and the same routine heals a fed character.' : 'the application’s tick routine does, and heals a fed character. ' + noApp),
    [
      model ? 'Each time the clock passes ' + period(model.hungerIndex) + ', nutrition falls by ' + srcNum(clk.fall) + ' for every character on the map; the fall is not in the file, only the reads of it.' : '',
      (hg.complains !== null ? 'The idle script complains below <b>' + srcNum(hg.complainsVal) + '</b>.' : ''),
      (hg.ceiling !== null ? (function () {
        // An item class script is named for its prop type, a spell for itself.
        const names = hg.ceilingBy.map(r => svLink((r >= 0x1000 && r < 0x1200 ? propDisplayName(r - 0x1000) : labelFor(r)) || ('0x' + r.toString(16).toUpperCase()), 'jumpToResource(' + r + ')'));
        return names.slice(0, -1).join(', ') + (names.length > 1 ? ' and ' : '') + names[names.length - 1] + ' add only up to <b>' + srcNum(hg.ceilingVal) + '</b>; a food adds its own figure, listed above.';
      })() : ''),
      model && clk.healthBytes && clk.magicBytes ? 'While nutrition is above ' + srcNum(clk.fedGate, '0') + ', <b>health and magic each rise by 1</b> each time the clock passes a period chosen by the level, the level shifted right by ' + srcNum(clk.levelShift) + ' and capped at ' + srcNum(clk.levelCap) + ': ' +
        Array.from({ length: model.levelCap + 1 }, (_, i) => {
          const lo = i << model.levelShift, hi = ((i + 1) << model.levelShift) - 1;
          return 'every ' + period(i).replace(/^(<button[^>]*>)(an |a )?/, '$1') + (i === model.levelCap ? ' from level ' + lo + ' up' : lo === hi ? ' at level ' + lo : ' at levels ' + lo + ' and ' + hi);
        }).join(', ') + '. Health (byte ' + srcNum(clk.healthBytes[0]) + ') stops at full health (byte ' + srcNum(clk.healthBytes[1]) + '), magic (' + srcNum(clk.magicBytes[0]) + ') at full magic (' + srcNum(clk.magicBytes[1]) + ').' : '',
      model ? 'At 0 there is no healing. The tick routine takes no health for hunger.' : ''
    ].filter(Boolean),
    '<div class="mechStats">' + (hg.ceiling !== null ? '<span class="mechStat"><b>' + srcNum(hg.ceilingVal) + '</b> nutrition at most</span>' : '') +
      (model ? '<span class="mechStat"><b>' + srcNum(clk.fall) + '</b> each time ' + period(model.hungerIndex) + ' passes</span>' : '') +
      (model && hg.ceiling !== null ? stat('about ' + Math.round(hg.ceiling * mechPeriodMinutes(model, model.hungerIndex) / 60 / 24) + ' days', 'from full to empty') : '') + '</div>' +
    mechHungerFigure(hg.ceiling, model), model ? '<span class="partsTitle">In the executable</span>' + pefChip('TGameViewer::DoTicks') : '');

  // ---- locks ----
  const lk = lockRules();
  add('locks', 'Locks and lockpicks', null, src('a key or a pick', 0xE43) + src('the lockpick', 0x1109),
    lk.rule ? 'One helper tries a key or a pick against a lock.' : 'The lock helper (0xE43) is not in this archive.',
    lk.rule ? [
      lk.rule.keyFits ? 'A key fits when the lock’s number matches the key’s.' : '',
      lk.rule.formula ? (function () {
        const n = lk.rule.numbers, up = n.addend.v === n.per.v - 1;
        return 'A pick opens the lock when the picker’s <b>reflex plus a roll of 0 to ' + srcNum(n.pickRoll, n.pickRoll.v - 1) + '</b> is at least <b>' + srcNum(n.base) + ' plus another roll of 0 to ' + srcNum(n.lockRoll, n.lockRoll.v - 1) +
          ' plus ' + srcNum(n.step) + ' for every ' + srcNum(n.per) + ' of the lock’s difficulty' + (up ? ', rounded up' : ' after adding ' + srcNum(n.addend)) + '</b>' + (lk.rule.breaks ? ', and <b>breaks</b> otherwise.' : '.') +
          (up ? ' Rounded up, because the helper adds ' + srcNum(n.addend) + ' before it divides, so a difficulty of 1 costs the same ' + n.step.v + ' as a difficulty of ' + n.per.v + '.' : '');
      })() : '',
      lk.needsSkill ? 'The lockpick refuses to be used at all without the <b>Lock Picking</b> skill.' : '',
      (function () {
        // Whose reflex and whose skill: both scripts name the player
        // character rather than whoever holds the pick, which is what makes
        // a companion's picking depend on the player's own reflex.
        const strip = t => t.replace(/^\s*[0-9A-F]{4}\s+/gm, '');
        const h = dvmScriptEntry(0xE43), it = dvmScriptEntry(0x1109);
        const pcReflex = h && /global PlayerCharacter[\s\S]{0,120}get_field reflex/.test(strip(h.text));
        const pcSkill = it && /sys GetSkill\s+global PlayerCharacter/.test(strip(it.text));
        return pcReflex || pcSkill ? 'The reflex rolled is <b>the player character’s</b>' + (pcSkill ? ', and the lockpick asks the player character for the skill' : '') + ', whoever is holding the pick.' : '';
      })(),
      'The difficulty is the placed lock’s own. The classes carry a parameter of their own, shown as stored.'
    ].filter(Boolean) : [], mechLockFigure(lk),
    lk.classes.length ? '<span class="partsTitle">Lock parameter</span>' + lk.classes.map(c => propChip(c.pt, c.name) + ' ' + srcNum(c.src, c.words.join(' '))).join(' ') : '');

  // ---- shops ----
  const sh = shopRules();
  add('shops', 'Shops', null, src('the counter', 0xEA5),
    sh.shops.length ? sh.shops.length + ' shops, each one call of the same helper with what the vendor lists and at what price.' : 'No script in this archive opens a shop.',
    sh.shops.length ? ['The helper bargains from the listed price with four figures of the vendor’s, shown as stored.', sh.haggling ? 'The <b>Haggling</b> skill takes a further roll of 0 to ' + srcNum(sh.haggling, sh.haggling.v - 1) + ' off the vendor’s figure.' : ''].filter(Boolean) : [],
    mechShopFigure(sh) +
    table(['vendor', 'goods, at the listed price in obols', '#terms'], sh.shops.map(spn => '<tr><td>' + (spn.who !== null && loadCharacterTable()[spn.who] ? characterChip(spn.who) : svChip(spn.resid)) +
      (spn.title ? '<div class="inspDim">“' + svEsc(spn.title) + '”</div>' : '') + '</td><td>' +
      spn.goods.map(g => svEsc(g.name) + ' <span class="mechPrice">' + srcNum(g.src, g.price) + (g.count > 1 ? ' for ' + g.count : '') + '</span>').join(', ') + '</td>' + (spn.terms ? srcCell(spn.termsSrc, spn.terms.join(' ')) : num('')) + '</tr>')), '');

  // ---- training ----
  const tr = trainingRules();
  add('training', 'Training', null, src('a lesson', 0xEB1),
    tr.teachers.length ? tr.teachers.length + ' teachers, each one call of the same helper naming the skill.' : 'No script in this archive teaches a skill.',
    tr.teachers.length ? [
      'A lesson raises the skill one level' + (tr.points.perLesson !== null ? ' and costs <b>' + srcNum(tr.points.perLessonVal) + ' training point' + (tr.points.perLesson === 1 ? '' : 's') + '</b>' : '') + '.',
      (tr.points.atStart !== null ? 'A character is made with <b>' + srcNum(tr.points.atStartVal) + '</b>' : '') + (tr.points.perLevel ? (tr.points.atStart !== null ? ' and gains ' : 'A character gains ') + '<b>' + srcNum(tr.points.perLevel) + ' less the difficulty level</b> with each level' : '') + '.',
      tr.points.mastery !== null ? 'A skill is mastered at level <b>' + srcNum(tr.points.masteryVal) + '</b>; a teacher marked <i>to mastery</i> teaches past the first lessons.' : ''
    ].filter(Boolean) : [],
    mechTrainingFigure(tr) +
    table(['teacher', 'teaches'], tr.teachers.map(t => '<tr><td>' + (t.who !== null && loadCharacterTable()[t.who] ? characterChip(t.who) : svChip(t.resid)) + '</td><td>' +
      [...t.skills.entries()].sort((a, b) => a[0] - b[0]).map(([id, m]) => (refExists(0x1A00 + id) ? partChip(selfNameFor(0x1A00 + id) || ('skill 0x' + id.toString(16)), 0x1A00 + id) : 'skill 0x' + id.toString(16)) + (m ? ' <span class="inspDim">to mastery</span>' : '')).join(' ') + '</td></tr>')), '');

  // The talk balloons are on the Barks sheet now (balloonsMechSection
  // in js/delv-sheets.js), above the words themselves.

  // ---- sleep ----
  const sl = sleepRules();
  add('sleep', 'Sleeping', null, src('the bed', 0x100E) + src('the night', 0xE93),
    sl ? 'A bed picks a quality for the sleep and hands the hours to one helper, which passes the night and multiplies what the engine healed during it.' : 'The bed class (0x100E) or the sleep helper (0xE93) is not in this archive.',
    sl ? [
      sl.own !== null ? 'Your own bed in Land King Hall has quality <b>' + srcNum(sl.ownVal) + '</b>; an inn’s bed takes its innkeeper’s figure from a table in the global store (0x301), at the slot the innkeeper’s dialogue wrote when the room was paid for, and a bed nobody paid for is refused.' : '',
      sl.quarter && sl.hours ? 'The night passes <b>' + srcNum(sl.quarterVal) + ' clock units at a time</b>' + (perHour && sl.quarterVal.v * sl.hoursVal.v === perHour ? ', a ' + (sl.hoursVal.v === 4 ? 'quarter' : '1/' + sl.hoursVal.v) + ' of an hour' : '') + ', ' + srcNum(sl.hoursVal) + ' to the hour asked for' + (sl.owner ? ', and the bed’s owner turning up throws you out (“Hey! Out of my bed!”)' : '') + '.' : '',
      sl.half ? 'Then, when the quality is not 0' + (sl.soundly ? ' (“You sleep soundly”)' : '') + ', every party member gets <b>what they healed during the night times the quality over ' + srcNum(sl.div) + '</b> on top, for health and for magic, up to full.' + (sl.own !== null ? ' <b>Quality ' + sl.own + ' is ' + (1 + sl.own / sl.div.v) + ' times the engine’s rate.</b>' : '') : '',
      sl.toss ? 'Quality 0 is “You toss and turn” and the engine’s rate alone.' : '',
      'The engine’s rate is the one under Hunger and healing: a fed character’s level rate, plus the six-minute regeneration where a worn item grants it, and nothing at all for a hungry one.',
      sl.magicGuard || sl.magicCap ? 'The magic half reads <i>full health</i> where it means full magic: ' +
        [sl.magicGuard ? 'the bonus is given only while magic is under ' + srcNum(sl.magicGuard, 'full health') : '',
         sl.magicCap ? 'and a figure past full magic sets magic to ' + srcNum(sl.magicCap, 'full health') : ''].filter(Boolean).join(', ') +
        ', so a character whose full health is the larger can wake with more magic than full.' : ''
    ].filter(Boolean) : [],
    (sl ? mechSleepFigure(sl, model) : '') +
    (sl && sl.div && sl.inns.length ? table(['bed', 'where', '#quality', 'healing'], [(sl.own !== null ? '<tr><td>your own</td><td>Land King Hall</td>' + srcCell(sl.ownVal) + '<td>× ' + (1 + sl.own / sl.div.v) + '</td></tr>' : '')].concat(
      sl.inns.map(x => '<tr><td>' + (loadCharacterTable()[x.who] ? characterChip(x.who) : 'character ' + x.who) + '</td><td>' + svEsc((loadCharacterTable()[x.who] && zoneDisplayName(loadCharacterTable()[x.who].zone)) || '') + '</td>' + srcCell(x.qualitySrc, x.quality) + '<td>' + (x.quality !== null ? '× ' + (1 + x.quality / sl.div.v) : '') + '</td></tr>'))) : ''), '');

  // ---- the clock ----
  {
    const costs = appImage() ? exeActionCosts() : [];
    // What a cast spends in time, for the rule below. The spells card moved
    // to the Spells sheet on 13 September 2026 and took its `sp` with it,
    // but the clock still states the cost, so it reads the casting rule for
    // itself; spellRules walks the memoised script-text index.
    const sp = spellRules();
    // A routine's name in two halves, the method and its class; the
    // arguments only where the class has two of the method.
    const nameHalves = r => {
      const p = r.name.indexOf('('), base = p >= 0 ? r.name.slice(0, p) : r.name, cut = base.lastIndexOf('::');
      const method = cut >= 0 ? base.slice(cut + 2) : base;
      const twice = costs.filter(c => c.routine.name.startsWith(base + '(')).length > 1;
      return { method: method + (twice && p >= 0 ? r.name.slice(p) : ''), cls: cut >= 0 ? base.slice(0, cut) : '' };
    };
    const flagWords = (bit) => { const f = clk && clk.statusWord ? exeFlagOfStatusBit(bit, clk.statusWord.v) : null; return f ? ' (flag ' + srcNum(f) + (DVM_FLAG_NAMES[f.v] ? ', ' + svEsc(DVM_FLAG_NAMES[f.v]) + ' to the scripts' : '') + ')' : ''; };
    add('clock', 'The clock, poison and time', null, '',
      model ? 'The game keeps one clock, a word the application counts in units of <b>1/' + srcNum(clk.unitsPerHour) + ' of an hour</b>, the hour being the word shifted right by ' + srcNum(clk.hourShift) + '.' +
          (clk.day ? ' ' + srcNum(clk.day, clk.day.v / perHour) + ' hours make a day, when the word rolls over.' : '') + ' Every duration a script hands the engine is in these units.'
        : 'The game keeps one clock that every duration a script hands the engine is counted in. ' + noApp,
      model ? [
        'Its table of periods is ' + clk.table.v.map((u, i) => srcNum(clk.table, u) + ' <span class="inspDim">(' + exeClockWords(u, perHour) + ')</span>').join(', ') + '; each tick the routine counts how many of each the clock has passed.',
        clk.poisonBit && clk.regenBit && clk.deathAt && clk.statusWord ? 'Each time it passes ' + period(model.poisonIndex) + ', a character whose record word at ' + srcNum(clk.statusWord) + ' has bit ' + srcNum(clk.poisonBit) + ' set' + flagWords(clk.poisonBit) + ' loses ' + srcNum(clk.poisonStep) + ' health, and <b>dies</b> instead when health is ' + srcNum(clk.deathAt) + ' or less; one with bit ' + srcNum(clk.regenBit) + flagWords(clk.regenBit) + ' gains ' + srcNum(clk.regenStep) + '; one with both takes a coin toss (' + srcNum(clk.coinToss) + ') each time.' : '',
        clk.lighting && clk.schedules && clk.quarterShift ? 'The lighting is recomputed when the word shifted right by ' + srcNum(clk.quarterShift) + ' changes, every ' + exeClockWords(1 << clk.quarterShift.v, perHour) + ' (' + srcNum(clk.lighting, 'DayTimeChanged') + '), and the schedules when the hour changes (' + srcNum(clk.schedules, 'ScheduleTime') + ').' : '',
        sp.rule && sp.rule.timing ? 'A spell costs ' + srcNum(sp.rule.timeBase) + ' plus ' + srcNum(sp.rule.timeMult) + ' times its level, from the casting script. The monsters move while the player’s time is spent.' : ''
      ].filter(Boolean) : [],
      (costs.length ? '<div class="mechSub">What each command spends, the argument it hands TGameSys::HeartBeat</div>' +
        table(['#units', 'spent by'], costs.slice().sort((a, b) => (a.cost ? a.cost.v : 1e9) - (b.cost ? b.cost.v : 1e9)).map(c => '<tr>' + (c.cost ? srcCell(c.cost) : '<td class="num"><span class="inspDim">worked out</span></td>') + '<td>' + svLink(nameHalves(c.routine).method, 'jumpToExeAt(' + c.call.exe + ')') + ' <span class="inspDim">' + svEsc(nameHalves(c.routine).cls) + '</span></td></tr>')) : '') +
      mechClockFigure(sp, clk, costs), model ? '<span class="partsTitle">In the executable</span>' + pefChip('TGameViewer::DoTicks') + pefChip('TGameSys::HeartBeat') : '');
  }

  // ---- the ground ----
  {
    const tn = terrainRules();
    const swamp = tn && tn.swamp, lava = tn && tn.lava;
    const grantsOf = flag => { let g = []; try { g = grantRules().filter(x => x.flag && x.flag.v === flag); } catch (e) { g = []; } return g; };
    const wearers = flag => { const g = grantsOf(flag); return g.length ? g.map(x => svLink(x.name, 'showItemDetail(' + x.pt + ')')).join(', ') : ''; };
    add('ground', 'The ground: swamp and lava', null, src('the ground', 0x301F),
      tn ? 'One script runs for a character on a square that is not a plain floor, handed a code for what they are standing on. Two codes hurt; anything else is a prop, and the prop’s own Use On runs with the character standing on it, which is how a rune goes off.'
         : 'The ground script (0x301F) is not in this archive.',
      tn ? [
        swamp ? 'On <b>swamp</b> (codes ' + srcNum(swamp.from) + ' to ' + srcNum(swamp.to) + '), one step in ' + srcNum(swamp.chance ? swamp.chance.is : null, swamp.chance ? (swamp.chance.hi.v - swamp.chance.lo.v) : '') +
          ' brings “' + svEsc(swamp.says) + '”, ' + (swamp.poisonName ? svEsc(swamp.poisonName) : 'a status') + ' and ' + srcNum(swamp.damage) + ' damage of type ' + srcNum(swamp.type) + '.' +
          (swamp.flagName ? ' A character with <b>' + svEsc(swamp.flagName) + '</b> (' + srcNum(swamp.flag) + ') is not bitten' + (wearers(swamp.flag.v) ? ', which is what ' + wearers(swamp.flag.v) + ' give' : '') + ', and neither is a monster immune to it.' : '') : '',
        lava ? 'On <b>lava</b> (code ' + srcNum(lava.code) + '), every step brings “' + svEsc(lava.says) + '” and <b>' + srcNum(lava.plus, rollWords([lava.roll.lo.v, lava.roll.hi.v]).replace('a roll of ', '') + ' plus ' + lava.plus.v) + '</b> damage of type ' + srcNum(lava.type) + '.' +
          (lava.flagName ? ' A character with <b>' + svEsc(lava.flagName) + '</b> (' + srcNum(lava.flag) + ') takes none' + (wearers(lava.flag.v) ? ', which ' + wearers(lava.flag.v) + ' give' : '') + '.' : '') : '',
        'Both hand the damage straight to the thing’s TakeDamage, not through the resistance step a blow takes, so armour takes nothing off either.'
      ].filter(Boolean) : [], '', '');
  }

  // ---- light ----
  // The two halves of the lighting model, and the zone table read out of the
  // entry scripts rather than written here. The viewer-relative half is
  // stated but not tabulated: it has no value without a square to stand on,
  // and inspectMapSquare is where a square exists.
  {
    const rows = [];
    for (let n = 0; n < 256; n++) {
      const resid = 0x8000 + n;
      let ok = false; try { ok = refExists(resid); } catch (e) { ok = false; }
      if (!ok) continue;
      const lvl = zoneAmbientLevel(resid);
      if (lvl === null) continue;
      rows.push({ name: zoneNameFor(resid) || editorZoneName(resid) || ('zone ' + n), lvl,
                  night: ambientBase(lvl, 0), noon: ambientBase(lvl, 12) });
    }
    rows.sort((a, b) => a.night - b.night || a.lvl - b.lvl || a.name.localeCompare(b.name));
    const fixed = rows.filter(r => r.lvl < 0).length;
    const body = rows.map(r => '<tr><td>' + svEsc(r.name) + '</td><td class="num">' + r.lvl +
      '</td><td class="num">' + r.night + '</td><td class="num">' + r.noon + '</td></tr>').join('');
    if (rows.length) add('light', 'Light: the zone, and what is in view', null, '',
      'A zone sets one light value when you arrive and it is the base for the whole level, not for a square. A square left at 32 is not darkened at all; one at 0 is painted black; between them the screen is dithered down towards it.',
      [
        'The number is <b>signed</b>, and a negative one means the day and night clock is skipped: the place is that dark at every hour. ' + fixed + ' of the ' + rows.length + ' zones are written that way, and they are the interiors.',
        'The base is <b>min(32, v / 5)</b>, where v is the number’s magnitude, or the daylight level instead where the number is positive and the sun is higher.',
        'Anything bright <b>in view lifts the whole level</b>. The engine adds <b>2<sup>2L-b</sup></b> for every light source in the eleven-by-eleven window around the player (L is the source’s level, 1 to 3, and b is 0 within four tiles, 1 within eight and 2 beyond), and a third of that total becomes a floor under the zone’s own number. Eight level-3 sources close by are enough that nothing on screen is darkened, which is what standing in a lava field does; walk them out of view and the level goes back to dark.',
        'A light is <b>blocked by nothing</b>. Each lit square lays its own cone over whatever is beneath it and no wall is consulted; what looks like falloff is the cone’s own shading. A level-1 source’s pool is about 1¼ tiles across, a level-3 source’s about 2¾.',
        'The map’s lighting layer draws only the two things that are fixed to the map: this table, and each source’s cone. The part that depends on where you are standing is reported on a square when you select it.'
      ],
      '<table class="vocabTable barkTable mechTable"><thead><tr><th>zone</th><th>sets</th><th>base at night</th><th>base at noon</th></tr></thead><tbody>' +
      body + '</tbody></table>', '');
  }

  // ---- springs and fountains ----
  {
    const wt = springRules();
    const kindWords = k => {
      const bits = [];
      if (k.food) bits.push('nutrition ' + srcNum(k.food.plus, '+' + k.food.plus.v) + (k.food.below ? ' below ' + srcNum(k.food.below) : ''));
      if (k.heal) bits.push('health ' + srcNum(k.heal.lo, rollWords([k.heal.lo.v, k.heal.hi.v]).replace('a roll of ', '+')));
      if (k.hurt) bits.push(srcNum(k.hurt.plus, rollWords([k.hurt.lo.v, k.hurt.hi.v]).replace('a roll of ', '') + ' plus ' + k.hurt.plus.v) + ' damage');
      for (const s of k.sets) bits.push(srcNum(s.val, s.name || ('flag ' + s.val.v)));
      if (k.clears.length) bits.push('clears ' + k.clears.map(c => srcNum(c.val, c.name || ('flag ' + c.val.v))).join(', '));
      if (k.wish) bits.push('a wish' + (k.chance ? ', one drink in ' + srcNum(k.chance.is, k.chance.hi.v - k.chance.lo.v) : ''));
      return bits.join('; ');
    };
    const where = k => {
      const list = (wt && wt.placed.get(k)) || [];
      const byZone = new Map();
      for (const p of list) { const n = zoneNameFor(p.zone) || ('0x' + p.zone.toString(16).toUpperCase()); byZone.set(n, (byZone.get(n) || 0) + 1); }
      return [...byZone.entries()].map(([n, c]) => svEsc(n) + (c > 1 ? ' ×' + c : '')).join(', ');
    };
    add('springs', 'Springs and fountains', null, src('the water', 0x1036),
      wt ? 'One class is every fountain and spring in the game. The placed prop’s Data1 picks which water it is, and each kind says its own line.'
         : 'The fountain class (0x1036) is not in this archive.',
      wt ? [
        wt.gate && wt.setter ? 'One kind is not fixed: it asks the game’s state ' + srcNum(wt.gate.state) + ' and, while that is below ' + srcNum(wt.gate.below) + ', gives the brackish water and a chance of the poisonous one. ' +
          svLink(wt.setter.name, wt.setter.pt !== null ? 'showItemDetail(' + wt.setter.pt + ')' : 'jumpToResource(' + wt.setter.resid + ')') + ' sets that state to ' + srcNum(wt.setter.to) + ' when it is picked up, and from then on the same fountains are fresh, with a chance of the reviving one.' : '',
        'A drink acts on the character using it.'
      ].filter(Boolean) : [],
      wt ? table(['#Data1', 'says', 'does', 'where it is placed'], wt.kinds.map(k => '<tr>' + srcCell(k.val) + '<td>' + (k.says[0] ? '“' + svEsc(k.says[0].replace(/\*/g, ' ').slice(0, 70)) + '”' : '') + '</td><td>' + kindWords(k) + '</td><td>' + where(k.kind) + '</td></tr>')) : '', '');
  }

  // ---- the combat AI ----
  {
    const app = window.APP_RSRC;
    const lists = [[9304, 'Tests'], [9305, 'Actions'], [9303, 'Modifiers'], [9307, 'Scenario tests'], [9308, 'Scenario actions'], [9320, 'Health states'], [502, 'Strategies']];
    const rows = [];
    if (app) for (const [id, what] of lists) { const l = forkStringList(app, id); if (l && l.length) rows.push('<tr><td>' + svEsc(what) + '</td><td>' + l.map(svEsc).join(', ') + '</td></tr>'); }
    const tests = buildScriptTextIndex().filter(e => e.resid >= 0x901 && e.resid < 0x981).length, acts = buildScriptTextIndex().filter(e => e.resid >= 0x981 && e.resid < 0xA00).length;
    add('combatai', 'Combat AI', null, '',
      'A monster fights by a script written in a vocabulary the application carries as string lists: tests about the field, actions to take, and the strategies that pick between them. The scenario adds tests and actions of its own.',
      [
        (tests || acts) ? 'This archive adds <b>' + tests + ' tests</b> and <b>' + acts + ' actions</b> in 0x09xx, named one for one by the application’s lists.' : '',
        'The scripts themselves ship beside the game as .ai text files, and the rules they are written against as the AI Scripting Document; both are under Data › Combat AI when the installer is open.'
      ].filter(Boolean),
      rows.length ? table(['list', 'words'], rows) : '<div class="sv-note">' + (app ? 'None of the lists is in this fork.' : 'Open the game from its installer, under Settings, and the vocabulary is read out of the application.') + '</div>',
      /* Through Components first: the compiled scripts in subindex 3 and the
         scenario's tests and actions in 8 are what the engine runs, and the
         .ai text under Data is what they were compiled from. */
      '<span class="partsTitle">In the file</span>' +
        relChip({ js: "showCategory('3')", main: 'Combat scripts', sub: 'compiled', icon: relIconFor(0x400), title: trailForResid(0x400) }) +
        relChip({ js: "showCategory('8')", main: 'Tests and actions', sub: 'the scenario’s own', icon: relIconFor(0x900), title: trailForResid(0x900) }) +
        relChip({ js: "showCategory('AIRULES')", main: 'Combat AI', sub: 'the .ai files', icon: relIconURL({ tile: TAB_BY_ID.get('combatai').tile }), title: 'Data › Combat AI' }));
  }

  // ---- the To Do list ----
  {
    const td = todoRules();
    const nameOf = rid => labelFor(rid) || propWordHex(rid);
    const slots = new Map();
    const slot = v => { if (!slots.has(v)) slots.set(v, { adds: [], dones: [] }); return slots.get(v); };
    for (const a of td.adds) slot(a.slot.v).adds.push(a);
    for (const d of td.dones) slot(d.slot.v).dones.push(d);
    const elsewhere = td.adds.filter(a => !a.state && a.line.v !== a.slot.v);
    const counted = td.adds.filter(a => a.state);
    const never = [...slots.keys()].filter(s => slots.get(s).adds.length && !slots.get(s).dones.length).sort((a, b) => a - b);
    const rows = [...slots.keys()].sort((a, b) => a - b).map(s => {
      const g = slots.get(s);
      const line = td.lines ? (td.lines.get(s) || '') : '';
      const who = g.adds.map(a => srcNum(a.slot, nameOf(a.resid)) +
        (a.state ? ' <span class="mechSub">(counted)</span>' : a.line.v !== s ? ' <span class="mechSub">as ' + a.line.v + '</span>' : '')).join(', ');
      const off = g.dones.map(d => srcNum(d.slot, nameOf(d.resid))).join(', ');
      return '<tr>' + num(s) + '<td>' + svEsc(line) + '</td><td>' + who + '</td><td>' + (off || '<span class="mechSub">never</span>') + '</td></tr>';
    });
    add('todo', 'The To Do list', null, td.textResid !== null ? src('the lines', td.textResid) : '',
      td.adds.length ? 'The list in the To Do window. A character’s script appends a line and another strikes it off; the line is a slot number, and the game keeps 256 of them. They are not quests: these calls set none of the game’s state, and a line can be struck off before the thing it asks for is done, or never.'
                     : 'No script in this archive writes a To Do line.',
      td.adds.length ? [
        '<b>' + td.adds.length + ' lines are added</b> and <b>' + td.dones.length + ' struck off</b>, over <b>' + slots.size + ' slots</b>.',
        elsewhere.length ? '<b>' + elsewhere.length + ' of them show a different line</b> than their slot’s: the same errand named after whoever told you about it.' : '',
        counted.length ? 'One site builds its line from a quest value as it goes, which is how a line that counts what you have found is written: ' + counted.map(a => srcNum(a.state, nameOf(a.resid))).join(', ') + '.' : '',
        never.length ? '<b>' + never.length + (never.length === 1 ? ' line is' : ' lines are') + ' never struck off</b> by any script: ' + never.map(s => (td.lines && td.lines.get(s) ? '“' + svEsc(td.lines.get(s)) + '”' : 'slot ' + s)).join(', ') + '.' : ''
      ].filter(Boolean) : [],
      table(['#slot', 'line', 'added by', 'struck off by'], rows));
  }

  // ---- what an egg does ----
  {
    const eg = eggKinds();
    const rows = eg ? eg.kinds.map(k => {
      const nm = EGG_KIND_NAMES[k.kind];
      const args = [...k.args].sort((a, b) => a - b);
      return '<tr>' + num(k.kind) + '<td>' + svEsc(nm ? nm.what : 'not known here') + '</td>' +
        '<td>' + (nm && nm.arg ? svEsc(nm.arg) : '') + '</td>' + num(k.n) +
        '<td class="mechSub">' + svEsc(args.length > 6 ? args.slice(0, 6).join(', ') + ', …' : args.join(', ')) + '</td></tr>';
    }) : [];
    add('eggs', 'What an egg does', null, '',
      eg ? 'An egg is a record on a zone’s list with no picture and no place in the world: a trigger on a rectangle of squares. Its aspect is which kind of trigger, and the bits a thing would keep its type in are the kind’s argument. The file names neither, so the kinds are named here from the eleven the application dispatches through; the counts and the arguments are this archive’s.'
         : 'No zone list in this archive places an egg.',
      eg ? [
        '<b>' + eg.kinds.reduce((n, k) => n + k.n, 0) + ' eggs</b> across <b>' + eg.zones + ' zones</b>, of <b>' + eg.kinds.length + ' kinds</b>.',
        eg.rooms ? 'A room is a kind-8 egg, and its argument is the room number: <b>' + eg.rooms.named + ' of the ' + eg.rooms.total + '</b> rooms named that way have a script of their own at 0x1B00 plus the number.' : '',
        'A kind-3 egg is an <b>ambient sound</b>, and its argument names the sound: 0x9100 plus the number. They are placed by the ground they stand on rather than by anything that happens, which is why the draw loop passes over them and the audio side picks them up.',
        'A kind-0 egg holds what it hatches as contained records, and carries its own conditions: <b>Data2 plus one in a hundred</b> is the chance, and Data1 holds it to the day (0x10) or the night (0x20), or to once (0x01). <b>Bit 0x08 of Data1 is set on some of them and is not read here</b>: Odemia’s chicken eggs carry 0x18, its goat 0x0A, its guards 0x14 and 0x24, so it stands beside day, beside night and alone.',
        '<b>A kind-0 egg’s argument says nothing about what hatches.</b> The creature is the contained record, and the argument is the same value whatever that record is: every one of Odemia’s thirteen carries 0xE4, whether it holds a chicken, a goat or a guard. The column below lists the arguments each kind is placed with, which is the file’s own content and not a meaning.',
        'Records with flags 0x44 are roofs rather than eggs, and there are <b>' + eg.roofs + '</b> of them here.'
      ].filter(Boolean) : [],
      table(['#kind', 'what it does', 'argument', '#here', 'arguments used'], rows) +
      // Which creatures, and not only that there are some. The inspector has
      // said this for one egg at a time since the reading was new; this is
      // the whole archive's, so a reader can see what the island hatches
      // without hunting for a ring to hover over.
      ((eg && eg.hatch && eg.hatch.length)
        ? '<div class="partsTitle">What they hatch</div>' +
          table(['creature', '#eggs', '#zones'], eg.hatch.map(h =>
            '<tr><td>' + (refExists(0x1000 + h.proptype)
              ? partChip(propDisplayName(h.proptype) || ('prop ' + h.proptype), 0x1000 + h.proptype)
              : svEsc(propDisplayName(h.proptype) || ('prop ' + h.proptype))) + '</td>' +
            num(h.n) + num(h.zones.size) + '</tr>')) +
          (eg.emptyEggs ? '<div class="mechSub">' + eg.emptyEggs +
            ' hatching egg' + (eg.emptyEggs === 1 ? '' : 's') + ' in the archive hold no record at all, and the file says nothing about what they would hatch.</div>' : '')
        : ''),
      '<span class="partsTitle">On the map</span>' + svLink('World', "showCategory('WORLD')"));
  }

  // The game's own writing is on the Writings sheet now
  // (libraryMechSection in js/delv-sheets.js), above the arrays it
  // tabulates. Loose ends still reads both of these; both memoise.
  const libAll = libraryRules();
  const todoAll = todoRules();

  // ---- loose ends ----
  {
    const le = looseEnds();
    const td2 = todoAll;
    const lib2 = libAll;
    const slots = new Map();
    for (const a of td2.adds) { if (!slots.has(a.slot.v)) slots.set(a.slot.v, { adds: [], dones: [] }); slots.get(a.slot.v).adds.push(a); }
    for (const d of td2.dones) { if (!slots.has(d.slot.v)) slots.set(d.slot.v, { adds: [], dones: [] }); slots.get(d.slot.v).dones.push(d); }
    const never = [...slots.keys()].filter(s => slots.get(s).adds.length && !slots.get(s).dones.length).sort((a, b) => a - b);
    const wrongLine = td2.adds.filter(a => !a.state && a.line.v !== a.slot.v);
    const rows = [];
    /* Every row says where it came from the same way, through one cell.
       Half of them used to state a plain name instead, because the reader
       kept only the resource for those and srcNum needs an instruction to
       ring; so the sheet looked as though grey rows were a lesser kind of
       finding, when the difference was only in what the reader had bothered
       to record. looseEnds carries a site for everything now, and nothing
       here knows which row it is building: the name falls back from the
       site's own, to the resource's label, to its hex id. */
    /* One chip per SCRIPT, not per place. A script that writes the same value
       three times printed its own name three times, which is noise rather
       than provenance (the maintainer, 12 September 2026): the reader wants
       to know which script, and the count of places is a detail the first
       link can carry. */
    const where = sites => {
      const byRes = new Map();
      for (const s of (sites || [])) {
        if (!byRes.has(s.resid)) byRes.set(s.resid, []);
        byRes.get(s.resid).push(s);
      }
      return [...byRes.values()].map(list => {
        const s = list[0];
        const name = s.name || labelFor(s.resid) || propWordHex(s.resid);
        return srcNum(s, name) + (list.length > 1 ? ' <span class="mechSub">in ' + list.length + ' places</span>' : '');
      }).join(', ');
    };
    const sitesOf = m => m ? [...m.values()] : [];
    for (const s of never) rows.push('<tr><td>a To Do line nothing strikes off</td><td>' +
      (td2.lines && td2.lines.get(s) ? svEsc(td2.lines.get(s)) : 'slot ' + s) + '</td><td>' +
      where(slots.get(s).adds.map(a => a.slot)) + '</td></tr>');
    for (const u of le.unreachable) rows.push('<tr><td>a test nothing can satisfy</td><td>quest value ' + u.state +
      ' is only ever set to ' + (u.assigned.join(', ') || 'nothing') + ', and this asks whether it is ' + u.want.v + '</td><td>' +
      where([u.want]) + '</td></tr>');
    for (const a of wrongLine) rows.push('<tr><td>a line that shows another line’s words</td><td>slot ' + a.slot.v +
      (td2.lines && td2.lines.get(a.slot.v) ? ' (' + svEsc(td2.lines.get(a.slot.v)) + ')' : '') + ' shows line ' + a.line.v +
      (td2.lines && td2.lines.get(a.line.v) ? ' (' + svEsc(td2.lines.get(a.line.v)) + ')' : '') + '</td><td>' +
      where([a.line]) + '</td></tr>');
    /* Say what the finding MEANS, not only what it is. "quest value 9" is a
       fact about the file; that setting it changes nothing is the finding,
       and it is what a reader is here for. */
    for (const k of le.writtenNeverRead) rows.push('<tr><td>written and never read</td><td>Quest value ' + k +
      ' is set, and no script ever tests it, so setting it changes nothing.</td><td>' +
      where(sitesOf(le.writes.get(k))) + '</td></tr>');
    for (const k of le.readNeverWritten) rows.push('<tr><td>read and never written</td><td>Quest value ' + k +
      ' is tested, and no script ever sets it, so the test only ever sees nothing.</td><td>' +
      where(sitesOf(le.reads.get(k))) + '</td></tr>');
    /* Flags, which the reader has collected since the card was new and the
       card never showed. Only the one direction: a flag no script sets,
       whether by SetStateFlag or by queueing task 165, is a test that never
       passes, since nothing else in the application writes the array. The
       other direction is not shown, because the application READS flags on
       its own account (EvalCondition, for the conditional eggs), so a flag
       no script tests is not thereby unread. */
    for (const k of le.flagReadNeverWritten) rows.push('<tr><td>read and never written</td><td>Quest flag ' + k +
      ' is tested, and no script sets it, directly or through a queued task, so the test never passes.</td><td>' +
      where(sitesOf(le.flagReads.get(k))) + '</td></tr>');
    const lineText = n => (td2.lines && td2.lines.get(n) ? ' (' + svEsc(td2.lines.get(n)) + ')' : '');
    for (const x of le.exactStrikes) rows.push('<tr><td>a line struck off only at an exact count</td><td>slot ' + x.slot.v + lineText(x.slot.v) +
      ' is struck off only when quest value ' + x.state + ' is exactly ' + srcNum(x.n) +
      ', and the scripts count that value up, so a visit that carries it past ' + x.n.v + ' never strikes the line.</td><td>' +
      where([x.slot]) + '</td></tr>');
    /* One line shown for two different errands. A line that is not its own
       slot's is usually the informant's wording of that slot's errand, and
       that is deliberate; but a line's words can only describe one errand,
       so the same line under two slots is wrong under one of them. That is
       Ake: she sends the hero to Halos about House Comana, slot 10, and
       shows line 114, the wording Demodocus shows for the iron mine. */
    const bySharedLine = new Map();
    for (const a of wrongLine) {
      if (!bySharedLine.has(a.line.v)) bySharedLine.set(a.line.v, []);
      bySharedLine.get(a.line.v).push(a);
    }
    const twoErrands = [...bySharedLine.values()].filter(list => new Set(list.map(a => a.slot.v)).size > 1);
    // The resolver's weapon-skill term, read in combatRules (`cb` above).
    const skillOff = cb && cb.skillOffLoop;
    if (skillOff) rows.push('<tr><td>a term read off the wrong thing</td><td>The combat resolver adds the weapon’s skill to the margin and to the damage figure, but reads it off the local its shield loop leaves at nothing rather than off the weapon, so Sword, Axe and Mace add nothing to an armed blow.</td><td>' +
      where(skillOff) + '</td></tr>');
    // Four readers of 17 September 2026's fourth batch (page-rules.js).
    for (const d of goesDarkStillLit().filter(x => x.light > 0)) rows.push('<tr><td>a light that stays on</td><td>The ' + svEsc(propDisplayName(d.pt) || ('prop ' + d.pt)) +
      ' says “' + svEsc(d.said.trim()) + '” and moves to aspect ' + srcNum(d.aspect) + ', whose tile still gives light of level ' + d.light + ', so it goes on lighting.</td><td>' +
      svLink('tile 0x' + d.tile.toString(16).toUpperCase(), 'showPropTypeDetail(' + d.pt + ')') + '</td></tr>');
    for (const c of scheduleCollisions()) rows.push('<tr><td>two people scheduled into one place</td><td>' + (chipOf(c.a) || svEsc(characterName(c.a))) + ' and ' + (chipOf(c.b) || svEsc(characterName(c.b))) +
      ' are both scheduled to (' + c.x + ', ' + c.y + ') on map ' + c.level + ' in the same mode from ' + c.from + ':00 to ' + c.to + ':00.</td><td>' + svLink('the schedules', "showCategory('SCHEDULES')") + '</td></tr>');
    for (const n of nameNeverKept()) rows.push('<tr><td>a name told and not kept</td><td>' + (chipOf(n.who) || svEsc(characterName(n.who))) +
      ' answers “name” and never sets their own character flag 7, which every other name topic sets, so they go on being called by what they look like.</td><td>' + where([n]) + '</td></tr>');
    for (const a of askedOfNobody()) rows.push('<tr><td>answers written for someone never asked</td><td>' + a.items.length + ' item classes write an Ask About answer for ' + (chipOf(a.who) || svEsc(characterName(a.who))) +
      ', whose script never hands a question to the AskAbout helper, so none of them is ever given.</td><td>' + a.items.slice(0, 6).map(pt => svLink(svEsc(propDisplayName(pt) || ('prop ' + pt)), 'showItemDetail(' + pt + ')')).join(', ') + (a.items.length > 6 ? ' and ' + (a.items.length - 6) + ' more' : '') + '</td></tr>');
    for (const r of answersThatRunOn()) rows.push('<tr><td>an answer that runs on</td><td>The answer to “' + svEsc(r.list) + '” has no return after it, so ' +
      (r.then ? 'the answer to “' + svEsc(r.then.list) + '” further on is given for the same reply, at once, and the first is replaced before it can be read.'
        : 'the conversation goes on testing the next keywords, and when none matches the character’s “don’t understand” follows it.') + '</td><td>' + where([r]) + '</td></tr>');
    // The last part of a spoken line, after its last click, as the balloon shows it.
    const lastPart = t => svEsc(t.split('*').filter(x => x.trim()).pop() || t);
    for (const r of linesReplacedAtOnce()) rows.push('<tr><td>a line replaced before it can be read</td><td>' +
      (r.oneString ? lastPart(r.line) + ' and ' + lastPart(r.next) + ' are back to back in one string, with no * between them to wait for a click, so the first is replaced as soon as it is drawn.'
        : lastPart(r.line) + ' ends without a * to wait for a click, and the next line the script can come to, ' + lastPart(r.next) + (r.speaker ? ', said by someone the script has just named to speak,' : '') + ' replaces it as soon as it is drawn.') +
      '</td><td>' + where([r]) + '</td></tr>');
    for (const t of selfToldByGroup()) rows.push('<tr><td>a character told about by their own group</td><td>' + (chipOf(t.who) || svEsc(characterName(t.who))) +
      ' has no answer of their own for “' + svEsc(t.key) + '”, so the question falls to a dialogue group their script calls, which answers about them: ' + svEsc(t.said) + '</td><td>' + where([t]) + '</td></tr>');
    {
      const bySkill = new Map();
      for (const u of containedUnseen()) { if (!bySkill.has(u.resid)) bySkill.set(u.resid, []); bySkill.get(u.resid).push(u); }
      for (const list of bySkill.values()) rows.push('<tr><td>a search that passes over what is inside things</td><td>' + where([list[0]]) +
        ' looks only at things lying loose, and ' + list.map(u => 'all ' + u.inside + ' ' + svEsc(propDisplayName(u.pt) || ('prop ' + u.pt)) + (u.inside === 1 ? ' is' : 's are') +
          ' inside ' + u.hosts.map(h => svEsc(propDisplayName(h) || ('prop ' + h))).join(' or ')).join(', and ') + ', so it never finds one.</td><td>' + where([list[0]]) + '</td></tr>');
    }
    for (const w of stateNoSaveKeeps()) rows.push('<tr><td>a value no saved game keeps</td><td>' + where(w.writers) + ' write' + (w.writers.length === 1 ? 's' : '') +
      ' word 0x' + w.offset.toString(16).toUpperCase() + ' of resource 0x' + w.resource.toString(16).toUpperCase().padStart(4, '0') + ', and ' + w.readers.length + ' place' + (w.readers.length === 1 ? ' reads' : 's read') +
      ' it back. A saved game holds no script resource, so the word is whatever the last game to write it wrote, not the one loaded.</td><td>' + where(w.readers) + '</td></tr>');
    for (const d of deletedAcrossZoneChange()) {
      const item = svEsc(propDisplayName(d.pt) || ('prop ' + d.pt));
      rows.push('<tr><td>a delete after the zone has changed</td><td>Using a ' + item + ' of ' + where([{ resid: d.skill, at: d.skillAt }]) +
        ' casts a copy of the spell, which moves the party to another zone; then the ' + item + '’s Use deletes the copy and the ' + item + ' by number, and those numbers now name things in the new zone, so two of its things are destroyed and the ' + item + ' is kept. One lies in ' +
        d.zones.map(z => svEsc(labelFor(0x8000 + z) || ('zone ' + z))).join(' and ') + '.</td><td>' + where([d]) + '</td></tr>');
    }
    for (const h of highlightsUnanswered()) rows.push('<tr><td>a highlighted word nobody answers</td><td>“' + svEsc(h.word) + '” is highlighted to be asked in ' + where([h]) + ', and ' +
      (h.who.length === 1 ? (chipOf(h.who[0]) || svEsc(characterName(h.who[0]))) + ', who says it, has'
        : 'none of the ' + h.who.length + ' characters who can say it has') + ' an answer that matches it' +
      (h.who.length > 1 ? ': ' + h.who.slice(0, 8).map(n => chipOf(n) || svEsc(characterName(n))).join(', ') + (h.who.length > 8 ? ' and ' + (h.who.length - 8) + ' more' : '') : '') + '.</td><td>' + where([h]) + '</td></tr>');
    for (const r of refusalOnEveryCheck()) rows.push('<tr><td>a refusal said on every check</td><td>The ' + svEsc(propDisplayName(r.pt) || ('prop ' + r.pt)) +
      '’s answer to whether a thing can go inside it prints “' + svEsc(r.said.trim()) + '” before saying no, and the inventory window asks it each time it checks a drop, so the line repeats while a thing is dragged over it.</td><td>' + where([r]) + '</td></tr>');
    for (const l of leaveNeverLeaves()) rows.push('<tr><td>a companion who agrees to leave and stays</td><td>' + (chipOf(l.who) || svEsc(characterName(l.who))) +
      ' can join the party and answers “leave”, and nothing in the script ever takes them out of it.</td><td>' + where([l]) + '</td></tr>');
    for (const t of tileReadWithSeenBit()) rows.push('<tr><td>a map tile read with its seen bit</td><td>' + where([t]) + ' compares the map’s tile at a square with ' + t.compared.join(' and ') +
      ' and never masks it, and a square that has been drawn carries the automap’s bit 0x8000, so the comparison never holds for a square the player can see.</td><td>' + where([t]) + '</td></tr>');
    for (const w of wrongCarryFlags()) rows.push('<tr><td>a thing given to a character with the wrong flags</td><td>' + where([w]) + ' sets a thing’s flags to ' + srcNum({ v: 9, resid: w.resid, at: w.at }, '9') +
      ' and its container to ' + svEsc(w.into.replace(/ \(0x[0-9A-F]+\)$/i, '')) + '. A carried thing has flag 0x10; 9 is inside another prop, so the thing ends up inside no one and is lost.</td><td>' + where([w]) + '</td></tr>');
    for (const c of speechWithNoSpeaker()) rows.push('<tr><td>a conversation with no one to speak</td><td>' + where([c]) + ' opens a conversation and ' +
      (c.talk ? 'has the one it is used on talk' : 'has someone speak') + ' without naming a speaker. A conversation starts with none, and quoted words are drawn in the speaker’s place, so they are drawn above the window and not seen.</td><td>' + where([c]) + '</td></tr>');
    // Character sprite frames that repeat another pose (spriteRepeats).
    for (const r of spriteRepeats()) rows.push('<tr><td>a sprite frame that repeats another pose</td><td>The ' + svEsc(propDisplayName(r.pt) || ('prop ' + r.pt)) + '’s ' + r.aName + ' frame and its ' + r.bName + ' frame ' +
      (r.pixels ? 'differ by ' + r.pixels + ' pixel' + (r.pixels === 1 ? '' : 's') : 'are identical') + ', where a sheet’s poses are otherwise hundreds of pixels apart.</td><td>' +
      svLink('tile 0x' + r.a.toString(16).toUpperCase(), 'showPropTypeDetail(' + r.pt + ')') + '</td></tr>');
    // A character asking whether they themselves are alive.
    for (const a of le.selfAlive) rows.push('<tr><td>a character asking if they are alive</td><td>' + (chipOf(a.who) || svEsc(characterName(a.who))) +
      ' tests whether ' + svEsc(characterName(a.who)) + ' is alive, which is always so while they talk, so the branch for the other answer is never taken.</td><td>' + where([a]) + '</td></tr>');
    // A local tested for truth and only ever set false.
    for (const l of le.localOnlyFalse) rows.push('<tr><td>a test of something only ever false</td><td>A local is tested as true or false, and every assignment to it in its function is false, so the branch behind the true side is never taken.</td><td>' +
      where([l]) + '</td></tr>');
    // Answers an earlier answer in the same list takes first.
    for (const a of le.shadowed) rows.push('<tr><td>an answer an earlier one takes</td><td>“' + svEsc(a.list) +
      '” is answered earlier in the same list, and the first match wins, so this answer is never given.</td><td>' + where([a]) + '</td></tr>');
    // A quest value tested where the same-numbered flag is meant.
    for (const v of le.valueForFlag) rows.push('<tr><td>a value tested where the flag is meant</td><td>' + where([v]) + ' tests quest value ' + v.k +
      ' as true or false where its other tests use quest flag ' + v.k + '. Quest value ' + v.k + ' is given a start when it is 0 and is never set to 0, so the test always passes.</td><td>' +
      where([v]) + '</td></tr>');
    // Keywords behind a comma and a space, read in looseEnds.
    for (const k of le.spacedKeywords) rows.push('<tr><td>a keyword that needs a space typed first</td><td>“' + svEsc(k.list) + '”: ' +
      k.spaced.map(w => '“' + svEsc(w) + '”').join(' and ') + ' follow' + (k.spaced.length === 1 ? 's' : '') + ' a comma and a space, and the space is kept as part of the keyword, so only an answer typed with a leading space reaches it.</td><td>' +
      where([k]) + '</td></tr>');
    // A quest value only a thing that does not exist sets, read in looseEnds.
    for (const d of le.dataCaseNoThing) rows.push('<tr><td>a thing nobody has</td><td>' + svEsc(propDisplayName(d.pt) || ('prop ' + d.pt)) +
      ' sets quest value ' + d.state + ' when its Data1 is ' + srcNum(d.v) + ', and no ' + svEsc(propDisplayName(d.pt) || 'such thing') +
      ' anywhere has that Data1, so quest value ' + d.state + ' is never set. It is read by ' + where(d.readers) + '.</td><td>' + where([d.v]) + '</td></tr>');
    // Character flags tested and never set, read in looseEnds.
    for (const f of le.charFlagNeverSet) rows.push('<tr><td>a character flag tested and never set</td><td>Flag ' + f.bit + ' of ' +
      (chipOf(f.character) || svEsc(characterName(f.character) || ('character ' + f.character))) +
      ' is tested, and nothing sets it, by a call, a helper, a queued task or the character table, so the test never passes.</td><td>' +
      where(f.sites) + '</td></tr>');
    // The sleep helper's magic half, read in sleepRules.
    const slp = sleepRules();
    if (slp && slp.magicGuard && slp.magicCap) rows.push('<tr><td>a field read in place of another</td><td>The sleep bonus for magic is given while magic is under full health and, past full magic, sets magic to full health, so a character whose full health is the larger wakes with more magic than full.</td><td>' +
      where([slp.magicGuard, slp.magicCap]) + '</td></tr>');
    // The three "use a thing" task scripts, read in looseEnds (unusedCast).
    for (const u of le.unusedCast) rows.push('<tr><td>a task that does nothing</td><td>Task ' + u.task + ' converts its item to a prop and then sends ' + svEsc(u.method) +
      ' to the item unconverted. A queued task’s item arrives as a number, and the interpreter sends no method to a number, so the task never acts.' +
      (u.queuedBy.length ? ' Queued by ' + where(u.queuedBy) + '.' : ' Nothing queues it.') + '</td><td>' + where([u]) + '</td></tr>');
    for (const list of twoErrands) rows.push('<tr><td>one line shown for two errands</td><td>line ' + list[0].line.v + lineText(list[0].line.v) +
      ' is shown for ' + [...new Set(list.map(a => a.slot.v))].map(s => 'slot ' + s + lineText(s)).join(' and for ') +
      ', and its words can only describe one of them.</td><td>' +
      where(list.map(a => a.line)) + '</td></tr>');
    if (lib2) for (const d of lib2) for (const k of d.dangling)
      rows.push('<tr><td>a thing pointing at nothing</td><td>Data1 ' + k + ' of ' + propWordHex(d.resid) + ', which has no such passage</td><td>' +
        where(d.readers) + '</td></tr>');
    add('loose', 'Loose ends', null, '',
      rows.length ? 'Things the scenario’s own scripts get wrong, each read off the line that causes it. None of this is the page’s opinion: a line nothing strikes off is a line no script names in a CompleteQuest, and a test nothing can satisfy is a number no script ever assigns.'
                  : 'Nothing of this kind was found in this archive.',
      rows.length ? [
        never.length ? '<b>' + never.length + '</b> To Do lines are added and struck off by nothing.' : '',
        le.unreachable.length ? '<b>' + le.unreachable.length + '</b> comparison against a value that is never assigned, so the branch behind it is out of reach.' : '',
        wrongLine.length ? '<b>' + wrongLine.length + '</b> lines show a different line’s words, which is usually deliberate and names the informant instead of the errand.' : '',
        twoErrands.length ? '<b>' + twoErrands.length + '</b> of those ' + (twoErrands.length === 1 ? 'is' : 'are') + ' shown for two different errands, so one of the two names the wrong one.' : '',
        le.exactStrikes.length ? '<b>' + le.exactStrikes.length + '</b> ' + (le.exactStrikes.length === 1 ? 'line is' : 'lines are') + ' struck off only at an exact count, which a visit can step past.' : '',
        le.flagReadNeverWritten.length ? '<b>' + le.flagReadNeverWritten.length + '</b> quest ' + (le.flagReadNeverWritten.length === 1 ? 'flag is' : 'flags are') + ' tested and never set.' : '',
        skillOff ? 'The combat resolver reads the weapon’s skill off the wrong thing, so no armed blow gets it.' : '',
        le.spacedKeywords.length ? '<b>' + le.spacedKeywords.length + '</b> keyword ' + (le.spacedKeywords.length === 1 ? 'list has' : 'lists have') + ' a space after a comma, so the keyword after it needs a space typed first.' : '',
        le.charFlagNeverSet.length ? '<b>' + le.charFlagNeverSet.length + '</b> character ' + (le.charFlagNeverSet.length === 1 ? 'flag is' : 'flags are') + ' tested and never set, which leaves the lines behind them unsaid or said every time.' : '',
        le.unusedCast.length ? '<b>' + le.unusedCast.length + '</b> of the tasks a character can be given ' + (le.unusedCast.length === 1 ? 'does' : 'do') + ' nothing' + (le.unusedCast.some(u => u.queuedBy.some(q => q.resid === 0x1AD5)) ? ', and Lock Picking queues one of them, which is why a companion told to pick a lock never does.' : '.') : ''
      ].filter(Boolean) : [],
      table(['what', 'which', 'where'], rows));
  }

  // ---- the community's patches ----
  {
    const base = patchBaseSpec();
    const applied = base ? delverInstalledPatchIds(base) : [];
    const named = applied.map(u => DELV_PATCH_AUTHORS[u]).filter(Boolean);
    add('patches', 'The community’s patches', null, '',
      'Cythera has one add-on system, and it is not a plug-in folder: nothing in the game reads one. ' +
      'A Magpie patch is a Delver Archive carrying the same scenario header as this file and holding only the resources it replaces, ' +
      'and Magpie merged it into the file on disk. A patch opened here is read against the file that is open, and can be applied to the copy of it in this browser.',
      [
        'A patch is identified by a <b>UUID</b> and by nothing else. There is no name, no version and no order in what a game file records, which is why Magpie needs every patch file present to say what is installed.',
        'The game file keeps the list of what has been applied to it as resource ' + propWordHex(0xFFFE) + ', and a patch keeps its own description as ' + propWordHex(0xFFFF) + '. The shipped archive has neither.',
        'Magpie takes a patch when the scenario matches, the format major matches and the minor is at least the patch’s, and the descriptor names the offset it sits at.',
        'Nothing here is written to disk. The report says what a merge would change, and its Apply button merges the patch into the copy of the file in this browser and nothing else.',
      'A patch carries a <b>check value</b> over its descriptor, and this page computes the same one Magpie does, so it can say whether a patch is intact rather than only quoting the number.',
      'A patch reaches the <b>data fork only</b>. Magpie imports one Resource Manager call and it is a read, so nothing in the resource fork, the game\u2019s font among it, can be changed by a patch.'
      ],
      '<ul class="ruleList"><li>' +
        (!base ? 'No game file is open.'
          : applied.length
            ? 'This file records <b>' + applied.length + '</b> patch' + (applied.length === 1 ? '' : 'es') + ' applied to it' +
              (named.length ? ', among them ' + named.map(n => '<b>' + svEsc(n.title) + '</b>, ' + svEsc(n.name)).join(' and ') : '') +
              '.<div class="patchMono mechSub">' + applied.map(u => svEsc(u)).join('<br>') + '</div>'
            : 'This file records no patches applied to it, which is what an untouched copy of the game says.') +
      '</li></ul>');
    /* The three controls are built as ELEMENTS and appended, where every
       other section's body is a string of markup. The difference is not
       taste: an id that only ever exists inside an innerHTML string is
       invisible to the checks, which seed what they know from the static
       markup and report an id the page asks for and never declares. The file
       control, the note and the report are the whole of what this section
       does, so they are the last things that should be unreachable from a
       harness. */
    const sec = sections[sections.length - 1].el;
    const wrap = document.createElement('div');
    wrap.className = 'mechStats';
    const input = document.createElement('input');
    input.type = 'file'; input.id = 'patchFile'; input.accept = '*/*';
    wrap.appendChild(input);
    sec.appendChild(wrap);
    const note = document.createElement('div');
    note.className = 'mechSub'; note.id = 'patchNote';
    sec.appendChild(note);
    const report = document.createElement('div');
    report.id = 'patchReport';
    sec.appendChild(report);
  }

  // ---- the hero's colours, as a patch ----
  {
    add('herosprite', 'The hero’s colours, as a patch', null, '',
      'Choose the hero or the heroine and a colour for each part. The sprite sheet is recoloured from the shipped art ' +
      'and written as a Magpie patch that replaces that one resource.',
      [
        'Which pixel belongs to which part is decided by this page, not read from the file: the art has no such layer. A shade two parts share goes to the part it touches most.',
        'Each part keeps its own shading. The new colours are taken from the game’s palette, and never from the ranges the engine cycles, so the sprite does not shimmer.',
        'The portrait chosen when the hero is made is a different resource and is not changed.',
        'The patch is read by this page and by the browser player, and Magpie installs it on a Mac.'
      ], '');
    const sec = sections[sections.length - 1].el;
    const host = document.createElement('div');
    host.id = 'heroSprite';
    sec.appendChild(host);
    const note = document.createElement('div');
    note.className = 'mechSub'; note.id = 'heroNote';
    sec.appendChild(note);
  }

  // ---- comparing two archives ----
  {
    const edits = (window.EDITED_RESIDS && window.EDITED_RESIDS.size) || 0;
    add('compare', 'Two files against each other', null, '',
      'What differs between two Delver archives, resource by resource. Two releases of the game, ' +
      'a modded copy against a clean one, or this file against itself as it arrived before you edited it. ' +
      'The difference can be written out as a patch.',
      [
        'The four installers all open here, so comparing releases is a matter of choosing a file: the data in <b>1.0.3</b> and <b>1.0.4</b> is byte for byte the same, and everything Ambrosia changed after 1.0.1 is between those two.',
        'It compares the plaintext, not the stored bytes. A resource encrypted in one file and clear in the other has not changed, and a rebuild that re-encrypts everything is not a difference.',
        'The file you open is the older side, and the file already open here is the newer one, so what you read is what the open file changed.',
        'A patch written here is read by this page and by the browser player, and it carries the check value Magpie verifies: Magpie under Mac OS 9 installed one on 15 September 2026.'
      ],
      '<ul class="ruleList"><li>' +
        (edits ? 'You have changed <b>' + edits + '</b> resource' + (edits === 1 ? '' : 's') + ' in this file.'
               : 'Nothing has been edited in this file, so there is nothing to compare it with itself.') +
      '</li></ul>');
    const sec2 = sections[sections.length - 1].el;
    const bar = document.createElement('div');
    bar.className = 'mechStats';
    if (edits) {
      const b = document.createElement('button');
      b.className = 'secondary';
      b.style.cssText = 'width:auto;margin:0;padding:6px 12px';
      b.textContent = 'Show what I have changed';
      b.onclick = compareEdits;
      bar.appendChild(b);
    }
    const inp = document.createElement('input');
    inp.type = 'file'; inp.id = 'compareFile'; inp.accept = '*/*';
    bar.appendChild(inp);
    sec2.appendChild(bar);
    const n2 = document.createElement('div');
    n2.className = 'mechSub'; n2.id = 'compareNote';
    sec2.appendChild(n2);
    const r2 = document.createElement('div');
    r2.id = 'compareReport';
    sec2.appendChild(r2);
  }

  // ---- puzzles ----
  {
    const pz = puzzleRules();
    const bz = pz.braziers, bu = pz.buttons;
    // One accumulator per section now, where a single `html` held all five.
    let braziersHtml = '', buttonsHtml = '', riddlesHtml = '', tunesHtml = '', signalsHtml = '';
    if (bz) braziersHtml += '<ul class="ruleList">' +
      '<li>Each brazier keeps its place in the order in its own Data1, and the game keeps how far you have got in <b>quest value ' + srcNum(bz.state) + '</b>.</li>' +
      '<li>Lighting the one whose place is next advances the value; lighting any other puts it back to nothing.</li>' +
      (bz.last ? '<li>The last is number ' + srcNum(bz.last) + ', and lighting it in turn prints the line and flickers the screen.</li>' : '') +
      (bz.say ? '<li>' + svEsc(bz.say.replace(/\s+/g, ' ').trim()) + '</li>' : '') + '</ul>';
    // Which sides of a panel are lit. The aspect's low four bits are the
    // four sides, and the order is the file's: 8 right, 4 bottom, 2 left,
    // 1 top. Read off the records rather than stated here, in that the
    // numbers below are whatever the archive holds.
    const litSides = a => ['right', 'bottom', 'left', 'top']
      .filter((_, i) => a & (8 >> i)).join(', ') || 'none';
    const sq = r => r ? r.x + ', ' + r.y : '';
    if (bu) {
      if (bu.rooms && bu.rooms.length) buttonsHtml += '<div class="partsTitle">The pattern rooms</div>' +
        table(['#door', 'the two panels', 'lit to begin with', '#buttons', 'the door between them'],
          bu.rooms.map(rm => '<tr>' + num(rm.door) +
            '<td>' + rm.panels.map(p => sq(p)).join('  and  ') + '</td>' +
            '<td class="mechSub">' + rm.panels.map(p => litSides(p.aspect)).join('  |  ') + '</td>' +
            num(rm.buttons.length) + '<td>' + sq(rm.doorRec) + '</td></tr>'));
      const rows = bu.buttons.map((b, i) => '<tr>' + num(i + 1) + '<td>' + b.x + ', ' + b.y + '</td>' +
        '<td>' + sq(b.a.rec) + ' through table ' + b.a.table + '</td>' +
        '<td>' + sq(b.b.rec) + ' through table ' + b.b.table + '</td></tr>');
      buttonsHtml += '<div class="partsTitle">The buttons, and the two panels each one drives</div>' +
        table(['#no.', 'square', 'first panel', 'second panel'], rows);
      if (bu.arrays) buttonsHtml += '<div class="partsTitle">The tables they read through</div>' +
        table(['#table', 'aspect 0 to 15 becomes'], bu.arrays.map((a, i) =>
          '<tr>' + num(i) + '<td class="mechSub">' + a.join(', ') + (i === 0 && a.every((v, j) => v === j) ? '  (unchanged: this button moves nothing)' : '') + '</td></tr>'));
    }
    const ri = pz.riddles;
    if (ri && ri.buttons.length) {
      riddlesHtml += '<div class="partsTitle">The riddles, and the word each one takes</div>' +
        table(['#no.', 'what it says', 'the answer it takes', 'the door it opens'],
          ri.buttons.map(b => '<tr>' + num(b.which + 1) +
            '<td>' + (ri.text[b.which] ? svEsc(ri.text[b.which]).replace(/\n/g, '<br>') : '') + '</td>' +
            '<td>' + (ri.answers[b.which] ? ri.answers[b.which].split(',').map(w => '<b>' + svEsc(w) + '</b>').join(' or ') : '') + '</td>' +
            '<td>' + (b.door ? sq(b.door) : '') + '</td></tr>'));
      if (ri.lone.length) riddlesHtml += '<div class="partsTitle">The button on its own</div>' +
        table(['square', 'signals', 'the door it opens'], ri.lone.map(l =>
          '<tr><td>' + l.x + ', ' + l.y + '</td>' + num(l.signal) + '<td>' + (l.door ? sq(l.door) : '') + '</td></tr>'));
    }
    const tu = pz.tunes;
    if (tu && tu.bells) {
      const bl = tu.bells;
      tunesHtml += '<div class="partsTitle">The bells, and the orders they are rung in</div>' +
        '<ul class="ruleList"><li>Each bell keeps its number in its own Data1, and ringing one shifts it into a register: ' +
        'the register becomes itself times ' + srcNum(bl.base) + ' plus the number.</li>' +
        '<li>Only the last four rings are kept, so a wrong ring can be rung out rather than started again.</li></ul>' +
        (bl.bells.length ? table(['#bell', 'square'], bl.bells.map(b =>
          '<tr>' + num(b.number) + '<td>' + b.x + ', ' + b.y + '</td></tr>')) : '') +
        table(['rung in this order', '#signals'], bl.orders.map(o =>
          '<tr><td>' + o.rings.join(', ') + '</td>' + srcCell(o.signal) + '</tr>'));
    }
    if (tu && tu.instruments.length) {
      tunesHtml += '<div class="partsTitle">The music locks</div>' +
        '<ul class="ruleList"><li>A tune is a number, one note to each of its digits, and the instrument compares what has been played against a single value.</li>' +
        '<li>A note is a letter: the file keeps the numbers, and the letter is the one that far along the alphabet, which is why these read as the notes a player writes down.</li></ul>' +
        table(['instrument', 'can play', 'the tune it takes', '#signals', 'given by'],
          tu.instruments.map(it => '<tr><td>' + svChip(it.resid, it.what) + '</td>' +
            '<td class="mechSub">' + svEsc(it.lists.map(l => l.spelled).join('  and  ')) + '</td>' +
            '<td><b>' + svEsc(it.spelled) + '</b> ' + srcNum(it.tune, '(' + it.tune.v + ')') +
            (it.gate ? ' <span class="mechSub">only when its Data1 is ' + srcNum(it.gate) + '</span>' : '') + '</td>' +
            srcCell(it.signal) +
            '<td>' + (it.given.length ? it.given.map(c => svChip(c.resid, c.name || '')).join(' ') : '') + '</td></tr>'));
    }
    const sig = signalRules();
    signalsHtml += '<div class="partsTitle">What a signal reaches</div>' +
      (sig ? '<ul class="ruleList">' +
        '<li>A signal is sent to the zone and then to the room, as ' + srcNum(sig.method, 'GetMessage') + ', whatever its number.</li>' +
        '<li>A signal <b>below ' + srcNum(sig.under) + '</b> also goes to every thing on the level whose class listens and <b>whose Data1 is the signal</b>. That is how a button opens one door and not another.</li>' +
        (sig.mask ? '<li>A thing is passed over unless its flags, masked with ' + srcNum(sig.mask, '0x5D') + ', are nothing or one, which leaves out eggs, roofs and anything inside something else.</li>' : '') +
        '<li>Then every one of <b>' + srcNum(sig.slots) + '</b> character slots in that zone, and last a call to ' + svEsc(sig.gremlin ? sig.gremlin.name : 'the gremlin') + '.</li>' +
        '<li class="mechSub">Which classes listen is a table the application builds as it loads, so it is not in the file and is not stated here.</li>' +
        '</ul>'
        : '<div class="sv-note">Open the game from its installer, under Settings, and the order a signal travels in is read out of the application.</div>');
    /* One section per puzzle, the maintainer's ask of 14 September 2026.

       These were one card called Puzzles holding five headed blocks of a
       single string. The readings are untouched -- puzzleRules() still
       answers all of it in one go -- and only the placing changed: each
       block keeps the part of the string it always built, and takes the
       scripts it was actually read from as its own chips, where before one
       card carried every script between them.

       None of this is guesswork about what a puzzle wants: the sequences,
       the tables and the tunes are in the scripts, and the wiring is in the
       records placed on the map. What a signal opens is not in the archive,
       which is why the tunes name the signal and stop there. */
    if (bz) add('braziers', 'The braziers', null, src('the braziers', 0x113F),
      'A row of braziers lit in an order the file keeps, each one carrying its own place in that order.',
      [], braziersHtml);
    if (bu) add('buttons', 'The buttons and the pattern rooms', null, src('the buttons', 0x1104),
      'Five rooms, each a pair of lit panels and a door that opens when they match.',
      (bu && bu.arrays) ? ['A button is a lookup and nothing more: it takes a panel’s aspect, reads it through one of the <b>' + bu.arrays.length + ' tables</b>, and stores what comes back. There is no rotation and no arithmetic.'] : [],
      buttonsHtml);
    if (ri && ri.buttons.length) add('riddles', 'The riddles', null, src('the riddles', 0x1110),
      'Five riddles, each taking a word typed at it, read off the opcodes that compare it.',
      [], riddlesHtml);
    if (tu && (tu.bells || tu.instruments.length)) add('tunes', 'The bells and the music locks', null,
      (tu.bells ? src('the bells', 0x10C1) : '') +
      (tu.instruments.length ? tu.instruments.map(it => src(it.what, it.resid)).join('') : ''),
      'An order of notes held as one number, a digit to each note, compared against a single value.',
      [], tunesHtml);
    add('signals', 'What a signal reaches', null, '',
      sig ? 'What a button, a bell or an instrument actually sends, and everything the application offers it to, read out of the program rather than the archive.'
          : 'The order a signal travels in is the application’s, not the archive’s.',
      [], signalsHtml);
  }

  // Who answers as whom is on the Dialogue sheet now (talkMechSection
  // in js/delv-sheets.js), above the conversations themselves.

  // ---- what the scripts lean on ----
  {
    const ln = leanRules();
    const topRows = ln ? ln.ranked.slice(0, 14).map(r =>
      '<tr><td>' + svChip(r.rid, '') + '</td>' + num(r.refs) +
      '<td class="mechSub">' + (r.calls === r.refs ? 'every one a call'
        : r.calls ? r.calls + ' calls, the rest named in an operand'
        : 'named in an operand, never called') + '</td></tr>') : [];
    const deadRows = ln ? ln.ranges.map(g => {
      const named = g.dead.filter(d => d.name);
      return '<tr><td>' + svEsc(g.label) + '<span class="mechSub"> ' + svEsc(g.what) + '</span></td>' +
        num(g.dead.length) + num(g.total) + '<td>' +
        (named.length ? named.map(d => svChip(d.rid, d.name)).join(' ') : '') +
        (g.dead.length > named.length ? '<span class="mechSub">' + (named.length ? ' and ' : '') +
          (g.dead.length - named.length) + ' unnamed</span>' : '') + '</td></tr>';
    }) : [];
    const busiest = ln && ln.ranked.length ? ln.ranked[0] : null;
    add('leans', 'What calls what', null, '',
      ln ? 'Which resources the archive’s scripts reach for, and which of them nothing reaches. The index counts a call, a resource named in an operand, a table entry and a dref, so a text array can be referenced by two dozen scripts without being called once.'
         : 'No archive is open to read references out of.',
      ln ? [
        '<b>' + ln.referencing + ' resources</b> reference something and <b>' + ln.referenced + '</b> are referenced, over <b>' + ln.edges + ' references</b>: ' +
          Object.keys(ln.kinds).map(k => '<b>' + ln.kinds[k] + '</b> ' + svEsc(k === 'call' ? 'calls' : k === 'resource' ? 'named in an operand' : k)).join(', ') + '.',
        busiest ? 'The graph is lopsided: the busiest is ' + svChip(busiest.rid, labelFor(busiest.rid) || '') + ' at <b>' + busiest.refs + '</b>, and most resources are reached by nothing at all.' : '',
        'Being reached by nothing is usually structural rather than telling: an item class is reached by its prop type, a dialogue by its character index, a room script by its room number. The table below shows only the cut that means something, which is a resource nothing calls sitting among siblings that are called.',
        'Even there, the likeliest answer is that the application calls it by a hardcoded id. The combat AI hooks are invoked by the compiled .ai rules beside the game, and the character-creation tables are read by the dialog, so neither is dead.'
      ].filter(Boolean) : [],
      table(['resource', '#references', 'of which'], topRows) +
      (deadRows.length ? '<div class="partsTitle">No script in this archive calls these</div>' +
        table(['range', '#uncalled', '#in range', 'which'], deadRows) : ''));
  }

  /* The sections in groups, in the maintainer's order (13 September 2026).
     Alphabetical was the old rule and it put the dice game first and the
     clock between karma and locks, which reads as a list of thirty things
     rather than as a subject.

     A group is a plain headed block, NOT a <details>. MECH_OPEN reopens a
     section by its own element id when a number was followed out of it, and
     a section reopened inside a shut group would be restored invisibly.

     A section's id never changes here. The mechLink call sites and the ids
     in SKILL_RULES name sections directly, and mechGo resolves
     `mech-<id>`, so grouping wraps sections and renames nothing. A section
     this table does not mention still appears, under Other, rather than
     vanishing from the sheet because a name was forgotten. */
  /* One group, or all of them when no tab was named.

     `value` is the category the tab was opened with; MECHANICS itself passes
     nothing and still draws the whole sheet, which the smoke's pins read. A
     deep link made before the split names MECHANICS and opens the first tab
     instead (parseDeepLink). Every section is built either way -- they are read
     off the scripts and the reading is the cost, not the placing -- so a tab
     shows its own and leaves the rest unplaced. */
  const only = value ? MECH_GROUP_BY_VALUE[value] : null;
  const showing = only ? [only] : MECH_GROUPS;
  const seen = new Set();
  for (const { title, note, ids } of showing) {
    const mine = ids.map(id => sections.find(s => s.id === id)).filter(Boolean);
    if (!mine.length) continue;
    const h = document.createElement('div');
    h.className = 'propHead';
    h.innerHTML = '<span class="groupTitle">' + svEsc(title) + '</span>' +
                  (note ? '<span class="groupNote">' + svEsc(note) + '</span>' : '');
    box.appendChild(h);
    for (const sn of mine) {
      seen.add(sn.id);
      if (window.MECH_OPEN && window.MECH_OPEN.has(sn.el.id)) sn.el.open = true;
      box.appendChild(sn.el);
    }
  }
  /* A section no group names still has to be reachable rather than vanish.
     On the whole sheet it went under Other at the end; with a tab each there
     is no neutral tab to put it on, so it goes to the last one, Hackery,
     which is where unplaced machinery belongs anyway. The smoke requires
     this to be empty, so it is a net rather than a habit. */
  const lastGroup = MECH_GROUPS[MECH_GROUPS.length - 1];
  const orphans = sections.filter(s => !MECH_GROUPS.some(g => g.ids.indexOf(s.id) >= 0));
  // What the smoke reads to fail on an unplaced section, rather than having
  // to infer it from the markup of whichever tab happened to catch it.
  window.MECH_UNPLACED = orphans.map(s => s.id);
  const rest = (!only || only === lastGroup) ? orphans.filter(s => !seen.has(s.id)) : [];
  if (rest.length) {
    const h = document.createElement('div');
    h.className = 'propHead';
    h.innerHTML = '<span class="groupTitle">Other</span>' +
                  '<span class="groupNote">Read out of the scripts and not yet placed in a group.</span>';
    box.appendChild(h);
    for (const sn of rest.sort((a, b) => a.title.localeCompare(b.title))) {
      if (window.MECH_OPEN && window.MECH_OPEN.has(sn.el.id)) sn.el.open = true;
      box.appendChild(sn.el);
    }
  }
  // Open all and Close all, and nothing else over the sections: the
  // contents strip went on 9 September 2026.
  const all = document.createElement('div');
  all.className = 'foldAll';
  all.innerHTML = svLink('Open all', 'mechOpenAll(true)') + svLink('Close all', 'mechOpenAll(false)');
  box.insertBefore(all, box.firstChild);
  grid.appendChild(box);
  /* What this tab shows, not what was built. Every section is built whichever
     tab is open -- the reading is the cost, not the placing -- so
     sections.length would have every tab claiming all twenty-five while it
     displayed four. */
  out.textContent = (seen.size + rest.length) + ' rules read out of this archive’s scripts' +
    (only ? ', under ' + only.title : '') + '. Each says which script it came from.';
  /* The patches section's file control and its report, wired after the
     sections are in the document. A patch already open is drawn again rather
     than forgotten, so leaving Hackery and coming back finds it where it was;
     resetDerivedCaches is what drops it, when the archive under it changes. */
  const pf = document.getElementById('patchFile');
  if (pf) {
    // The verifier reads "async () =>" as a call to a function named async,
    // so the read is a promise inside patchesOpenFile rather than an await.
    pf.onchange = function () { patchesOpenFile(pf.files && pf.files[0]); };
    renderPatchReport();
  }
  const cf = document.getElementById('compareFile');
  if (cf) {
    cf.onchange = function () {
      const file = cf.files && cf.files[0];
      if (!file) return;
      file.arrayBuffer().then(buf => compareOpenBytes(new Uint8Array(buf), file.name)).catch(e => {
        const note = document.getElementById('compareNote');
        if (note) { note.textContent = 'That file could not be read: ' + e.message; note.className = 'mechSub patchBad'; }
      });
    };
    renderCompareReport();
  }
  // The hero's colours draw into their host once it is in the document.
  if (document.getElementById('heroSprite')) renderHeroSprite();
}
// The cards open when a number on the sheet was followed into its script,
// so that back from the script finds them open again and setMode's scroll
// memory lands on the same place; a card that was shut would put the page
// somewhere else. Kept for the session, and only a followed number sets it.
window.MECH_OPEN = new Set();
/* Only the sections on the tab that is showing can be judged, so this merges
   rather than replaces. Replacing was right while the sheet was one page of
   everything; with a tab each it would throw away every other tab's folds the
   moment one tab was left, and a number followed out of Combat would come
   back to a shut card because Puzzles had been opened in between. */
function mechKeepPlace() {
  const grid = document.getElementById('sheetGrid');
  const all = grid && grid.querySelectorAll ? grid.querySelectorAll('details.mechSec') : [];
  const keep = new Set(window.MECH_OPEN || []);
  for (const d of all) { if (d.open) keep.add(d.id); else keep.delete(d.id); }
  window.MECH_OPEN = keep;
}
// Open a Mechanics section and scroll it into view; a plain anchor would
// rewrite the hash, which is the page's deep link.
function mechGo(id) {
  const el = document.getElementById('mech-' + id);
  if (!el) return;
  el.open = true;
  if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
// Every card on the sheet that is showing, open or shut at once.
function mechOpenAll(open) {
  const grid = document.getElementById('sheetGrid');
  const all = grid && grid.querySelectorAll ? grid.querySelectorAll('details.mechSec') : [];
  for (const d of all) d.open = !!open;
}

function renderPlaceholderSheet(note) {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  document.getElementById('output').textContent = note;
}
