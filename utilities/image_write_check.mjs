#!/usr/bin/env node
// Do pictReplacePixels and rsrcReplaceImage write resources that draw the pixels they were given?
//
//   node utilities/image_write_check.mjs index.html "$TMPDIR/Cythera Data.rsrc" "$TMPDIR/Cythera.rsrc"
//
// An image in a resource fork is replaced from its page by a PNG (Replace
// with a PNG), and rsrcReplaceImage in js/mac-rsrc-types.js packs the PNG's
// pixels in the same form as the resource it replaces. The decoder is the
// only reader of the result here, so the check is a round trip through the
// page's decoders (exportArtifacts, which draws an icl8 through its ICN#'s
// mask as the page does), over every image resource of the two forks: the
// twenty-one PICTs in their three forms (8-bit indexed, 16-bit packed by
// the word, 32-bit packed by the plane), and the program's ICN#, ics#,
// icl4, icl8, ics4, ics8, CURS, crsr, cicn and ppat.
//
//   - every image decoded, written back with the pixels it already had and
//     decoded again draws the same pixels; for every type but PICT the bytes
//     are the same too, and an indexed PICT has the same index in every
//     place, which is what the writer's rule of giving an unchanged pixel its
//     old bits is for: one colour is at two indices in the game's table;
//   - a block painted in a dark colour no table has comes back as the
//     nearest colour of the table, or black in a black-and-white image,
//     exact in a direct PICT, where it was shown, and the pixels around it
//     are unchanged;
//   - in the types that have a mask (ICN#, ics#, CURS, crsr, cicn), the
//     block painted opaque is shown whole, and the block made transparent is
//     hidden, its black-and-white bits cleared;
//   - an image of another size throws.
//
// Negative control: one byte of a written picture's rows is changed and the
// comparison must notice, so a comparison that always passes cannot pass here.
// What it cannot see: whether the game or the Finder draws the result. The
// decoders and the writers were written by the same hand, so a misreading of
// a format shared by both would pass; systemless (src/trap/pict.rs) draws
// the pictures independently, and the game and the Finder in an emulator
// are the real test.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { makeSandbox } from './dom_stub.mjs';
import { pageSource } from './page_scripts.mjs';

const [htmlPath = 'index.html', ...forks] = process.argv.slice(2);
const have = forks.filter(p => p && existsSync(p));
if (!have.length) { console.log('image write: skipped, no resource fork given'); process.exit(0); }
let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };

const { sandbox } = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), { filename: htmlPath }).runInContext(ctx);
const G = n => vm.runInContext(n, ctx);
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
const MASKED = new Set(['ICN#', 'ics#', 'CURS', 'crsr', 'cicn']);
const PAINT = [13, 90, 160];                       // dark, and in no table here

const counts = {};
let images = 0, painted = 0, pictures = 0;
for (const path of have) {
  const fork = G('openResourceFork')(new Uint8Array(readFileSync(path)));
  // A resource drawn as the page draws it, with `data` in its place.
  const drawWith = (type, entry, data) => {
    const was = fork.dataOf;
    fork.dataOf = (t, e) => (t === type && e === entry) ? data : was.call(fork, t, e);
    try { const a = G('exportArtifacts')(fork, type, entry, data).find(x => x.canvas); return a && { W: a.canvas.width, H: a.canvas.height, px: a.canvas._px.data }; }
    finally { fork.dataOf = was; }
  };
  for (const type of Object.keys(fork.resourcesByType)) {
    if (!G('rsrcImageWritable')(type)) continue;
    for (const e of fork.resourcesByType[type]) {
      const name = path.split('/').pop() + ' ' + type + ' ' + e.id;
      const data = fork.dataOf(type, e);
      let was;
      try { was = drawWith(type, e, data); } catch (err) { fail(name, 'does not decode: ' + err.message); continue; }
      if (!was) { fail(name, 'is not drawn'); continue; }
      images++; counts[type] = (counts[type] || 0) + 1;
      const write = px => G('rsrcReplaceImage')(type, data, px, was.W, was.H);
      // The same pixels written back.
      let back;
      try { back = write(was.px); } catch (err) { fail(name, 'not written: ' + err.message); continue; }
      if (!same(was.px, drawWith(type, e, back).px)) { fail(name, 'the same pixels written back draw differently'); continue; }
      if (type !== 'PICT' && !same(back, data)) fail(name, 'the same pixels written back are different bytes');
      if (type === 'PICT') {
        pictures++;
        const L = G('pictImageLayout')(data);
        if (L.kind === 'indexed') { const L2 = G('pictImageLayout')(back); if (!L.rows.every((r, y) => same(r, L2.rows[y]))) fail(name, 'an unchanged pixel changed index'); }
        if ((back[0] << 8 | back[1]) !== (back.length & 0xffff)) fail(name, 'picSize is not the low word of the length');
      }
      // A block painted in, at the middle, the alpha left as it was.
      const W = was.W, H = was.H, bw = Math.min(4, W), bh = Math.min(4, H);
      const x0 = Math.floor((W - bw) / 2), y0 = Math.floor((H - bh) / 2);
      const inBlock = (x, y) => x >= x0 && x < x0 + bw && y >= y0 && y < y0 + bh;
      const paint = (alpha) => { const px = new Uint8ClampedArray(was.px); for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++) { px.set(PAINT, (y * W + x) * 4); if (alpha !== undefined) px[(y * W + x) * 4 + 3] = alpha; } return px; };
      // What the paint becomes: the nearest colour of the table the page drew
      // the resource from, black in a black-and-white image, near-exact direct.
      let want = PAINT;
      if (type === 'PICT') {
        const L = G('pictImageLayout')(data);
        if (L.kind === 'indexed') want = nearest(L.palette, PAINT);
        else if (L.pm.pixelSize === 16) want = PAINT.map(v => Math.round(Math.round(v * 31 / 255) * 255 / 31));
      } else {
        const P = G('rsrcImagePlanes')(type, data);
        want = P.px ? nearest(P.px.pal, PAINT) : [0, 0, 0];
      }
      const check = (label, px, inside) => {
        const now = drawWith(type, e, write(px)).px;
        let bad = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const o = (y * W + x) * 4, exp = inBlock(x, y) ? inside(o) : [was.px[o], was.px[o + 1], was.px[o + 2], was.px[o + 3]];
          if (now[o + 3] !== exp[3] || (exp[3] && (now[o] !== exp[0] || now[o + 1] !== exp[1] || now[o + 2] !== exp[2]))) bad++;
        }
        if (bad) fail(name, bad + ' pixels wrong after ' + label);
        return !bad;
      };
      // Where the pixel was shown the paint lands; where it was hidden it stays hidden.
      let ok = check('a block was painted in', paint(), o => was.px[o + 3] ? [...want, 255] : [was.px[o], was.px[o + 1], was.px[o + 2], 0]);
      if (MASKED.has(type)) {
        ok = check('a block was painted opaque', paint(255), () => [...want, 255]) && ok;
        ok = check('a block was made transparent', paint(0), () => [0, 0, 0, 0]) && ok;
        const P = G('rsrcImagePlanes')(type, data), hid = write(paint(0));
        // Only where the pixel was shown: a hidden pixel with its bit set is
        // a cursor's inverted pixel (crsr 175 has some), and is left as it was.
        let set = false;
        if (P.ink) for (let y = y0; y < y0 + bh; y++) for (let x = x0; x < x0 + bw; x++)
          if (was.px[(y * W + x) * 4 + 3] && x < (P.ink.W || W) && y < (P.ink.H || H) && (hid[P.ink.off + y * P.ink.rb + (x >> 3)] >> (7 - (x & 7))) & 1) set = true;
        if (set) { fail(name, 'a black-and-white bit is set under a pixel made transparent'); ok = false; }
      }
      if (ok) painted++;
      // Another size must throw.
      let threw = false;
      try { G('rsrcReplaceImage')(type, data, was.px, W + 1, H); } catch (err) { threw = true; }
      if (!threw) fail(name, 'an image of another size was accepted');
      // The negative control, on the first picture: a changed byte in the rows.
      if (type === 'PICT' && pictures === 1) {
        const L2 = G('pictImageLayout')(back), broken = new Uint8Array(back);
        broken[L2.rowsAt + 3] ^= 0x55;
        let caught = true;
        try { caught = !same(drawWith(type, e, broken).px, was.px); } catch (err) { caught = true; }
        if (!caught) fail('negative control', 'a changed byte in the rows went unnoticed');
      }
    }
  }
}
function nearest(pal, c) {
  let best = null, bd = Infinity;
  for (const p of pal) if (p) { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2; if (d < bd) { bd = d; best = p; } }
  return best;
}
if (!images) fail('image write', 'no image resource in ' + have.join(', '));
if (failures) { console.error(`image write: ${failures} failure(s)`); process.exit(1); }
const list = Object.entries(counts).map(([t, n]) => n + ' ' + t).join(', ');
console.log(`image write: ${images} images (${list}) written back pixel for pixel, ${painted} with painted blocks, another size rejected, the negative control caught`);
