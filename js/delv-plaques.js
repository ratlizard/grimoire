/* The start screen's buttons, carved again.

   The six words on the start screen's stone buttons (Onward, New Game, Open
   Game, Preferences, About, Quit) are not text. They are carved into
   pictures in Cythera Data's resource fork: PICT 132 is the whole screen,
   the six buttons on it with their words; PICT 139 to 144 are the six
   buttons alone, in the other lighting, which the program draws over 132 in
   the places START_PLAQUES gives; PICT 145 is Onward greyed. So swapping the
   game's font (swapGameFont) changes every word the game draws and leaves
   these alone. The maintainer's request of 22 October 2026 was for the font
   chosen in Grimoire to be carved into them in place of Ambrosia's
   lettering. The words appear nowhere in either file as text (the program's
   CNTL 129 to 131 are an older start dialog's "Onward!", "Load Player" and
   "New Player"), which is why they are in the table below.

   This file turns pixels into pixels and needs no canvas: plaqueLift lifts
   the carving off a button and plaqueCarve cuts a new word in, given the
   word's coverage, which the page draws in the chosen font (plaqueCover in
   js/page-fork.js, the only part that needs a browser).

   How the carving comes off. No two buttons share a speckle, so no button
   can lend another its blank stone, and a median across the six is no use
   either. The stone is fine speckle over smooth lighting, so the lighting
   is fitted, a straight line across each row through the stone of that row
   and two either side (plaqueLighting), and the speckle is the difference.
   Where the word was, the stone is the lighting plus speckle drawn at
   random from the same button's stone outside the word. Two first tries
   were wrong in ways worth not repeating: a polynomial over the whole
   plaque, carried from the margins into the middle, ran dark at the top of
   the word and light at the bottom; and trimming the speckle to small
   differences before drawing from it made the new stone twelve levels
   darker than the old, because the speckle leans bright and the trim cut
   the bright flecks. utilities/plaque_check.mjs fails if the fill's
   lightness strays from the stone around it.

   Where the word was is found by its shadows: pixels well below the
   lighting, in rows 7 to 23 only, since the four rivets sit in rows 4 and 5
   and 25 and 26, taken as the run of columns around the middle.

   How a word is cut. The shipped lettering is Argos A Nouveau, its
   ascenders some 13 pixels tall and its letters a pixel further apart than
   the face sets them, which is where plaqueCover puts a new word. Read
   pixel by pixel against the lighting, each shipped stroke is dark on its
   upper-left side and light on its lower-right, but copying those values
   made the new words illegible: two rounds on 22 October 2026 went first
   too faint, at Ambrosia's stroke width, and then, thickened and with both
   edges strengthened, too contrasty, the bright edge breaking every letter
   up. The maintainer's reading of the buttons is the one used: the words
   are a subtle darkening of the stone. So the stroke is thickened when it
   is drawn (plaqueCover's `weight`, 1.5 pixels unless the visitor picks
   another), the stone under it is darkened to half its lightness with its
   speckle left in (`depth`), its upper-left edge is a fifth darker again,
   and there is no highlight. */

const START_PLAQUES = {
  board: 132,
  W: 151, H: 31,
  // Each button's picture, the word carved in it, and where the program
  // draws it over the board: the top left of the picture in PICT 132, where
  // 139 to 144 sit over the board's buttons to the pixel (plaque_check.mjs
  // finds each there). 145, Onward greyed, is Onward's button.
  buttons: [
    { id: 139, word: 'Onward', x: 167, y: 102 },
    { id: 140, word: 'New Game', x: 167, y: 179 },
    { id: 141, word: 'Open Game', x: 167, y: 255 },
    { id: 142, word: 'Preferences', x: 431, y: 102 },
    { id: 143, word: 'About', x: 431, y: 179 },
    { id: 144, word: 'Quit', x: 431, y: 255 },
    { id: 145, word: 'Onward', x: 167, y: 102, greyed: true }
  ],
  // The stone, a long hexagon inside the bronze frame; the same in all seven.
  outline: [[20, 1], [131, 1], [147, 15], [131, 29], [20, 29], [4, 15]],
  rows: [7, 23],       // where a word can be; the rivets are above and below
  room: 110,           // the straight part of the stone, which a word must fit
  // Where a word goes on a button the search found none on.
  ink: { x0: 40, y0: 9, x1: 110, y1: 21 }
};

// The stone: a pixel is in it when its centre is inside the outline.
function plaqueStone(W, H) {
  const P = START_PLAQUES.outline, m = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const px = x + 0.5, py = y + 0.5;
    let inside = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if ((yi > py) !== (yj > py) && px < (xj - xi) * (py - yi) / (yj - yi) + xi) inside = !inside;
    }
    if (inside) m[y * W + x] = 1;
  }
  return m;
}
function plaqueErode(m, W, H, n) {
  let a = m;
  for (let k = 0; k < n; k++) {
    const b = new Uint8Array(W * H);
    for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      b[i] = a[i] & a[i - 1] & a[i + 1] & a[i - W] & a[i + W];
    }
    a = b;
  }
  return a;
}
const plaqueLum = (r, g, b) => 0.299 * r + 0.587 * g + 0.114 * b;
/* The lighting, three numbers a pixel: for each row, a straight line across
   it fitted by least squares through the `use` pixels of that row and the
   two either side. A row with too few is given the nearest row's line.

   The buttons are lit in a U, some ten levels lighter at the ends than in
   the middle, and the middle is under the word, where no stone can be
   measured. A line runs over the dip, so the fill under a short word comes
   out up to six levels lighter than the stone beside it (plaque_check.mjs
   allows that and no more). Two ways round it were worse to look at: a
   parabola across each row bent too far where only the ends of a long
   word's rows are stone, fifteen levels out under Preferences; and a row
   term plus a column term, the columns measured above and below the word,
   took them from the bevel along the stone's edge, which is lit otherwise,
   and gave the fill a colour cast and visible edges. */
function plaqueLighting(rgba, use, W, H) {
  const out = new Float32Array(W * H * 3), fitted = new Array(H).fill(false);
  for (let y = 0; y < H; y++) {
    let n = 0, sx = 0, sxx = 0; const sv = [0, 0, 0], sxv = [0, 0, 0];
    for (let yy = Math.max(0, y - 2); yy <= Math.min(H - 1, y + 2); yy++)
      for (let x = 0; x < W; x++) {
        const i = yy * W + x;
        if (!use[i]) continue;
        n++; sx += x; sxx += x * x;
        for (let c = 0; c < 3; c++) { sv[c] += rgba[i * 4 + c]; sxv[c] += x * rgba[i * 4 + c]; }
      }
    const det = n * sxx - sx * sx;
    if (n < 8 || !det) continue;
    for (let c = 0; c < 3; c++) {
      const b = (n * sxv[c] - sx * sv[c]) / det, a = (sv[c] - b * sx) / n;
      for (let x = 0; x < W; x++) out[(y * W + x) * 3 + c] = a + b * x;
    }
    fitted[y] = true;
  }
  for (let y = 0; y < H; y++) {
    if (fitted[y]) continue;
    let d = 1, from = -1;
    while (from < 0 && d < H) { if (y - d >= 0 && fitted[y - d]) from = y - d; else if (y + d < H && fitted[y + d]) from = y + d; d++; }
    if (from >= 0) out.copyWithin(y * W * 3, from * W * 3, (from + 1) * W * 3);
  }
  return out;
}
// A small seeded generator, so a button carved twice comes out the same.
function plaqueRandom(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/* A button with its word lifted off: {rgba, light, stone, ink}, where `ink`
   is the box the old word's shadows filled ({x0, y0, x1, y1}, inclusive),
   or null when there was none, and then the button comes back as it was. */
function plaqueLift(rgba, W, H, seed) {
  const stone = plaqueStone(W, H), inner = plaqueErode(stone, W, H, 3);
  let light = plaqueLighting(rgba, inner, W, H);
  const res = i => plaqueLum(rgba[i * 4] - light[i * 3], rgba[i * 4 + 1] - light[i * 3 + 1], rgba[i * 4 + 2] - light[i * 3 + 2]);
  const [r0, r1] = START_PLAQUES.rows;
  const on = new Uint8Array(W);
  for (let y = r0; y <= r1; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (inner[i] && res(i) < -32) on[x] = 1; }
  // The run of columns around the middle, with gaps of up to twelve.
  const any = (a, b) => { for (let x = Math.max(0, a); x < Math.min(W, b); x++) if (on[x]) return true; return false; };
  let x0 = W >> 1, x1 = W >> 1;
  while (x0 > 0 && any(x0 - 12, x0)) x0--;
  while (x1 < W - 1 && any(x1 + 1, x1 + 13)) x1++;
  while (x0 < x1 && !on[x0]) x0++;
  while (x1 > x0 && !on[x1]) x1--;
  const out = new Uint8ClampedArray(rgba);
  if (!on[x0]) return { rgba: out, light, stone, ink: null };
  let y0 = -1, y1 = -1;
  for (let y = r0; y <= r1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * W + x;
    if (inner[i] && res(i) < -32) { if (y0 < 0) y0 = y; y1 = y; break; }
  }
  const ink = { x0, y0, x1, y1 };
  const inBox = (x, y) => x >= x0 - 2 && x <= x1 + 2 && y >= y0 - 2 && y <= y1 + 2;
  // The lighting again, from stone with no letters in it.
  const clean = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inner[y * W + x] && !inBox(x, y)) clean[y * W + x] = 1;
  light = plaqueLighting(rgba, clean, W, H);
  // The speckle, from that stone, the rivets left out.
  const pool = [];
  for (let i = 0; i < W * H; i++) if (clean[i]) {
    const d = [0, 1, 2].map(c => rgba[i * 4 + c] - light[i * 3 + c]);
    if (Math.abs(plaqueLum(d[0], d[1], d[2])) < 80) pool.push(d);
  }
  const edge = plaqueErode(stone, W, H, 2), rnd = plaqueRandom(seed || 1);
  if (pool.length) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!edge[i] || !inBox(x, y)) continue;
    const d = pool[Math.floor(rnd() * pool.length)];
    for (let c = 0; c < 3; c++) out[i * 4 + c] = light[i * 3 + c] + d[c];
  }
  return { rgba: out, light, stone, ink };
}
/* A word cut into a lifted button. `cover` is the word's coverage, W*H
   numbers from 0 to 1, drawn where the word should go; `depth` is the share
   of the stone's lightness left in the cut (0.5 unless given). */
function plaqueCarve(lifted, cover, W, H, depth) {
  const { rgba, stone } = lifted, out = new Uint8ClampedArray(rgba);
  const share = depth > 0 && depth < 1 ? depth : 0.5;
  const M = (x, y) => (x < 0 || y < 0 || x >= W || y >= H) ? 0 : cover[y * W + x] * stone[y * W + x];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = M(x, y);
    if (!m) continue;
    const i = y * W + x;
    const lip = Math.max(0, m - M(x - 1, y - 1));         // the stroke's upper-left edge
    const k = (1 - (1 - share) * m) * (1 - 0.2 * lip);
    for (let c = 0; c < 3; c++) out[i * 4 + c] = rgba[i * 4 + c] * k;
  }
  return out;
}
// A W by H piece of a picture `PW` wide, and one put back.
function plaqueCrop(rgba, PW, x, y, W, H) {
  const out = new Uint8ClampedArray(W * H * 4);
  for (let r = 0; r < H; r++) out.set(rgba.subarray(((y + r) * PW + x) * 4, ((y + r) * PW + x + W) * 4), r * W * 4);
  return out;
}
function plaquePaste(rgba, PW, piece, x, y, W, H) {
  for (let r = 0; r < H; r++) rgba.set(piece.subarray(r * W * 4, (r + 1) * W * 4), ((y + r) * PW + x) * 4);
}
