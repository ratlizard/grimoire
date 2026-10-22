#!/usr/bin/env node
// Does pictReplacePixels write a PICT that draws the pixels it was given?
//
//   node utilities/pict_write_check.mjs index.html "$TMPDIR/Cythera Data.rsrc" "$TMPDIR/Cythera.rsrc"
//
// A picture in a resource fork is replaced from the PICT's page by a PNG
// (Replace with a PNG), and pictReplacePixels in js/mac-rsrc-types.js packs
// the PNG's pixels in the same form as the picture it replaces. The decoder
// is the only reader of the result here, so the check is a round trip
// through it, run over all twenty-one PICTs of the two forks, which between
// them have the three forms the writer writes: 8-bit indexed (0x0098,
// 0x0099), 16-bit direct packed by the word (PICT 129) and 32-bit direct
// packed by the plane (133 to 138).
//
//   - every picture decoded, written back with the pixels it already had and
//     decoded again draws the same pixels, and an indexed picture has the
//     same index in every place, which is what the writer's rule of giving
//     an unchanged pixel its old index is for: one colour is at two indices
//     in the game's table;
//   - a block painted in a colour no table has comes back exact in a direct
//     picture and as the nearest colour of the table in an indexed one, and
//     the pixels around it are unchanged;
//   - an image of another size throws.
//
// Negative control: one byte of a written picture's rows is changed and the
// comparison must notice, so a comparison that always passes cannot pass here.
// What it cannot see: whether the game draws the result. The decoder and the
// writer were written by the same hand, so a misreading of the format shared
// by both would pass; systemless (src/trap/pict.rs) draws the pictures
// independently and the game in an emulator is the real test.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { makeSandbox } from './dom_stub.mjs';
import { pageSource } from './page_scripts.mjs';

const [htmlPath = 'index.html', ...forks] = process.argv.slice(2);
const have = forks.filter(p => p && existsSync(p));
if (!have.length) { console.log('pict write: skipped, no resource fork given'); process.exit(0); }
let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };

const { sandbox } = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), { filename: htmlPath }).runInContext(ctx);
const G = n => vm.runInContext(n, ctx);
const decode = d => { const r = G('decodePict')(d); return { W: r.width, H: r.height, px: r.canvas._px.data }; };
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

let pictures = 0, indexed = 0, direct = 0, edits = 0;
for (const path of have) {
  const fork = G('openResourceFork')(new Uint8Array(readFileSync(path)));
  for (const e of fork.resourcesByType.PICT || []) {
    const name = path.split('/').pop() + ' PICT ' + e.id;
    const data = fork.dataOf('PICT', e);
    let was, L;
    try { was = decode(data); L = G('pictImageLayout')(data); } catch (err) { fail(name, 'does not decode: ' + err.message); continue; }
    pictures++;
    if (L.kind === 'indexed') indexed++; else direct++;
    // The same pixels written back.
    let back;
    try { back = G('pictReplacePixels')(data, was.px, was.W, was.H); } catch (err) { fail(name, 'not written: ' + err.message); continue; }
    const now = decode(back);
    if (!same(was.px, now.px)) { fail(name, 'the same pixels written back draw differently'); continue; }
    if (L.kind === 'indexed') {
      const L2 = G('pictImageLayout')(back);
      if (!L.rows.every((r, y) => same(r, L2.rows[y]))) fail(name, 'an unchanged pixel changed index');
    }
    if ((back[0] << 8 | back[1]) !== (back.length & 0xffff)) fail(name, 'picSize is not the low word of the length');
    // A block painted in, at the middle.
    const px = new Uint8ClampedArray(was.px), W = was.W, H = was.H;
    const x0 = Math.floor(W / 2) - 2, y0 = Math.floor(H / 2) - 2, paint = [13, 201, 77];
    const inBlock = (x, y) => x >= x0 && x < x0 + 4 && y >= y0 && y < y0 + 4;
    for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) px.set(paint, (y * W + x) * 4);
    const ed = decode(G('pictReplacePixels')(data, px, W, H)).px;
    let want = paint;
    if (L.kind === 'indexed') {
      let bd = Infinity;
      for (const c of L.palette) if (c) { const d = (c[0] - paint[0]) ** 2 + (c[1] - paint[1]) ** 2 + (c[2] - paint[2]) ** 2; if (d < bd) { bd = d; want = c; } }
    } else if (L.pm.pixelSize === 16) want = paint.map(v => Math.round(Math.round(v * 31 / 255) * 255 / 31));
    let bad = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const o = (y * W + x) * 4, exp = inBlock(x, y) ? want : [was.px[o], was.px[o + 1], was.px[o + 2]];
      if (ed[o] !== exp[0] || ed[o + 1] !== exp[1] || ed[o + 2] !== exp[2]) bad++;
    }
    if (bad) fail(name, bad + ' pixels wrong after a block was painted in');
    else edits++;
    // Another size must throw.
    let threw = false;
    try { G('pictReplacePixels')(data, px, W + 1, H); } catch (err) { threw = true; }
    if (!threw) fail(name, 'an image of another size was accepted');
    // The negative control, on the first picture: a changed byte in the rows.
    if (pictures === 1) {
      const L2 = G('pictImageLayout')(back), broken = new Uint8Array(back);
      broken[L2.rowsAt + 3] ^= 0x55;
      let caught = true;
      try { caught = !same(decode(broken).px, was.px); } catch (err) { caught = true; }
      if (!caught) fail('negative control', 'a changed byte in the rows went unnoticed');
    }
  }
}
if (!pictures) fail('pict write', 'no PICT in ' + have.join(', '));
if (failures) { console.error(`pict write: ${failures} failure(s)`); process.exit(1); }
console.log(`pict write: ${pictures} pictures (${indexed} indexed, ${direct} direct) written back pixel for pixel, ${edits} with a painted block, another size rejected, the negative control caught`);
