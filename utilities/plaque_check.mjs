#!/usr/bin/env node
// Do the start screen's buttons lose their carved words cleanly, and take new ones where the old ones were?
//
//   node utilities/plaque_check.mjs index.html "$TMPDIR/Cythera Data.rsrc"
//
// js/delv-plaques.js lifts the words Ambrosia carved off the start screen's
// buttons (PICT 139 to 145, and the six on the screen itself, PICT 132) and
// cuts new ones in. Drawing a new word needs a font and a real canvas, which
// browser_check.mjs has; everything else is pixels to pixels and is held
// here, against the shipped pictures:
//
//   - START_PLAQUES's places: each of 139 to 144 matches PICT 132 best at
//     the place the table gives, searched six pixels either way (the
//     pictures are the other lighting, so best, not equal);
//   - a word is found on all twelve buttons, the six alone and the six on the
//     screen, and the boxes are as wide as the words are long: Quit, About,
//     Onward, New Game, Open Game, Preferences, narrowest first;
//   - lifted, the box is no more than two levels darker than the stone
//     beside it in the same rows, and no more than seven lighter: the
//     buttons are lit in a U whose dip is under the word, which the lift's
//     lighting runs over (plaqueLighting has why), so the fill reads up to
//     six levels light beside a short word, and never dark. The first
//     version of the lift drew the speckle from a trimmed set, and its stone
//     came out twelve levels darker than the button's; the negative control
//     darkens a lift by that much and must be caught;
//   - lifted, the box has no more dark pixels (32 levels under the
//     lighting) than that stone;
//   - every pixel outside the box is as it was, and a lift with the same
//     seed gives the same bytes;
//   - plaqueCarve reaches a pixel past the cover and no further, darkens
//     the stroke, lights and shades its two ends the way round the
//     measured cut has them in each lighting, and leaves the stone alone
//     for an empty cover.
//
// What it cannot see: whether a carved word reads well, which is a person's
// call (the maintainer judged two rounds illegible on 22 October 2026), or
// how the game draws the result, for which the disk image is run in an
// emulator.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { makeSandbox } from './dom_stub.mjs';
import { pageSource } from './page_scripts.mjs';

const [htmlPath = 'index.html', forkPath] = process.argv.slice(2);
if (!forkPath || !existsSync(forkPath)) { console.log('plaques: skipped, no resource fork given'); process.exit(0); }
let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };

const { sandbox } = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath) + '\n;globalThis.__peek = n => eval(n);', { filename: htmlPath }).runInContext(ctx);
const peek = n => vm.runInContext('__peek(' + JSON.stringify(n) + ')', ctx);
const G = n => vm.runInContext(n, ctx);
const P = peek('START_PLAQUES'), { W, H } = P;
const fork = G('openResourceFork')(new Uint8Array(readFileSync(forkPath)));
const picture = id => {
  const e = (fork.resourcesByType.PICT || []).find(x => x.id === id);
  if (!e) throw new Error('PICT ' + id + ' is not in the fork');
  const a = G('exportArtifacts')(fork, 'PICT', e, fork.dataOf('PICT', e)).find(x => x.canvas);
  return { W: a.canvas.width, H: a.canvas.height, px: new Uint8ClampedArray(a.canvas._px.data) };
};
const lum = peek('plaqueLum');
const crop = (rgba, PW, x, y) => G('plaqueCrop')(rgba, PW, x, y, W, H);

// The places.
const board = picture(P.board);
for (const b of P.buttons.filter(b => !b.greyed)) {
  const p = picture(b.id);
  let best = null;
  for (let dy = -6; dy <= 6; dy++) for (let dx = -6; dx <= 6; dx++) {
    let d = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = ((b.y + dy + y) * board.W + b.x + dx + x) * 4, j = (y * W + x) * 4;
      d += Math.abs(board.px[i] - p.px[j]) + Math.abs(board.px[i + 1] - p.px[j + 1]) + Math.abs(board.px[i + 2] - p.px[j + 2]);
    }
    if (!best || d < best.d) best = { d, dx, dy };
  }
  if (best.dx || best.dy) fail('places', 'PICT ' + b.id + ' matches the board best at ' + (b.x + best.dx) + ', ' + (b.y + best.dy) + ', not ' + b.x + ', ' + b.y);
}

// The lifts.
const lift = (rgba, seed) => G('plaqueLift')(rgba, W, H, seed);
const stats = (rgba, light, inBox, stone) => {
  let n = 0, l = 0, dark = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!stone[i] || !inBox(x, y)) continue;
    n++; l += lum(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    if (lum(rgba[i * 4] - light[i * 3], rgba[i * 4 + 1] - light[i * 3 + 1], rgba[i * 4 + 2] - light[i * 3 + 2]) < -32) dark++;
  }
  return { light: l / n, dark: dark / n };
};
const inner = G('plaqueErode')(G('plaqueStone')(W, H), W, H, 3);
// How light a lifted box is against the stone beside it: a lift passes when
// it is between two levels darker and seven lighter, and its box has no
// more dark pixels than the stone does, with two pixels of slack per
// hundred.
function judge(name, before, L) {
  const k = L.ink;
  const box = (x, y) => x >= k.x0 - 2 && x <= k.x1 + 2 && y >= k.y0 - 2 && y <= k.y1 + 2;
  const fill = stats(L.rgba, L.light, (x, y) => box(x, y), inner);
  // The stone beside the box, in its rows: twelve columns either side.
  const beside = (x, y) => !box(x, y) && y >= k.y0 - 2 && y <= k.y1 + 2 && x >= k.x0 - 14 && x <= k.x1 + 14;
  const rest = stats(before, L.light, beside, inner);
  const why = [];
  if (fill.light - rest.light > 7 || fill.light - rest.light < -2) why.push('the lifted box is ' + fill.light.toFixed(1) + ' light against the stone’s ' + rest.light.toFixed(1));
  if (fill.dark > rest.dark + 0.02) why.push((fill.dark * 100).toFixed(1) + '% of the lifted box is dark against the stone’s ' + (rest.dark * 100).toFixed(1) + '%');
  return why;
}
const lifts = [];
for (const b of P.buttons.filter(b => !b.greyed)) {
  for (const [where, px] of [['PICT ' + b.id, picture(b.id).px], ['PICT ' + P.board + ' at ' + b.word, crop(board.px, board.W, b.x, b.y)]]) {
    const L = lift(px, b.id);
    if (!L.ink) { fail(where, 'no word was found on it'); continue; }
    lifts.push({ where, word: b.word, px, L });
    const why = judge(where, px, L);
    if (why.length) fail(where, why.join('; '));
    const k = L.ink, box = (x, y) => x >= k.x0 - 2 && x <= k.x1 + 2 && y >= k.y0 - 2 && y <= k.y1 + 2;
    let moved = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (!box(x, y)) for (let c = 0; c < 4; c++) if (L.rgba[(y * W + x) * 4 + c] !== px[(y * W + x) * 4 + c]) { moved++; break; }
    if (moved) fail(where, moved + ' pixels outside the word’s box changed');
    const again = lift(px, b.id).rgba;
    if (!again.every((v, i) => v === L.rgba[i])) fail(where, 'a second lift with the same seed differs');
  }
}
// Box widths in the order the words' lengths give, on the buttons alone.
const order = ['Quit', 'About', 'Onward', 'New Game', 'Open Game', 'Preferences'];
const alone = order.map(w => lifts.find(l => l.word === w && /^PICT 1[34]\d$/.test(l.where)));
if (alone.every(Boolean)) {
  const widths = alone.map(l => l.L.ink.x1 - l.L.ink.x0);
  if (widths.some((w, i) => i && w < widths[i - 1])) fail('word boxes', 'not as wide as the words are long: ' + order.map((w, i) => w + ' ' + widths[i]).join(', '));
}
// The negative control: a lift darkened twelve levels in its box must fail.
if (lifts.length) {
  const { px, L, where } = lifts[0], k = L.ink, dark = new Uint8ClampedArray(L.rgba);
  for (let y = k.y0 - 2; y <= k.y1 + 2; y++) for (let x = k.x0 - 2; x <= k.x1 + 2; x++) for (let c = 0; c < 3; c++) dark[(y * W + x) * 4 + c] -= 12;
  if (!judge(where, px, Object.assign({}, L, { rgba: dark })).length) fail('negative control', 'a lift twelve levels too dark passed');
}

// The cut: a bar of cover across the middle of a lifted button, in each
// lighting. The cut's parts reach a pixel past the cover (across and down
// compare a pixel's two neighbours) and no further; the bar's inside is
// darkened by the stroke's weight; its left end is lighter than its right
// when the across weight is negative, as it is for the buttons on PICT 132,
// and darker when it is positive, as for the lit pictures (Onward's cut, as
// the workbench's tools/plaques/ measured it), which is what holds the port
// of the cut from Python to its sign; and an empty cover changes nothing.
if (lifts.length) {
  const L = lifts[0].L, cover = new Float32Array(W * H), cutOf = peek('START_PLAQUES').cut;
  for (let y = 12; y < 18; y++) for (let x = 50; x < 100; x++) cover[y * W + x] = 1;
  const near = (x, y) => x >= 49 && x <= 100 && y >= 11 && y <= 18;
  const light = (px, x, y) => { const i = (y * W + x) * 4; return lum(px[i], px[i + 1], px[i + 2]); };
  const mean = (px, x0, x1, y0, y1) => { let s = 0, n = 0; for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { s += light(px, x, y); n++; } return s / n; };
  for (const lighting of ['board', 'lit']) {
    const cut = G('plaqueCarve')(L, cover, W, H, lighting), wts = cutOf[lighting].weights;
    let outside = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
      if (!near(x, y) && light(cut, x, y) !== light(L.rgba, x, y)) outside++;
    if (outside) fail('carve ' + lighting, outside + ' pixels more than a pixel from the cover changed');
    const inside = mean(cut, 52, 97, 13, 16) / mean(L.rgba, 52, 97, 13, 16);
    if (inside > 1 + wts[0] / 2) fail('carve ' + lighting, 'the bar\u2019s inside keeps ' + inside.toFixed(2) + ' of its lightness, against a stroke weight of ' + wts[0]);
    const left = mean(cut, 50, 50, 13, 16) - mean(L.rgba, 50, 50, 13, 16), right = mean(cut, 99, 99, 13, 16) - mean(L.rgba, 99, 99, 13, 16);
    if (Math.sign(right - left) !== Math.sign(wts[1])) fail('carve ' + lighting, 'the bar\u2019s left end moved ' + left.toFixed(1) + ' and its right ' + right.toFixed(1) + ', against an across weight of ' + wts[1]);
    const none = G('plaqueCarve')(L, new Float32Array(W * H), W, H, lighting);
    if (!none.every((v, i) => v === L.rgba[i])) fail('carve ' + lighting, 'an empty cover changed the stone');
  }
}

if (failures) { console.error(`plaques: ${failures} failures`); process.exit(1); }
console.log(`plaques: ${lifts.length} buttons lifted clean, the six in their places, and the negative control caught`);
