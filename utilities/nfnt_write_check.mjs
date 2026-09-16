#!/usr/bin/env node
/* The bitmap-font writer, against the two fonts Ambrosia shipped.

   `writeResourceFork` got its evidence from the strongest thing available --
   the forks Apple's own Resource Manager wrote in 1999, handed back byte for
   byte. A font inside one of those forks is the same kind of claim one level
   down: `nfntSpec` reads every field of an NFNT, `writeNFNT` puts it back, and
   the shipped bytes must return exactly. Nothing else here can say the format
   is understood rather than merely drawn -- `decodeNFNT` walks past both of
   the tables that follow the bit image, so a reader that renders a strike
   correctly can still be wrong about everything after it.

   It was wrong about exactly that on the first run: the location table has
   nGlyphs + 1 entries and the offset/width table has nGlyphs, and reading both
   the same way made every font two bytes too long. That is the bug this check
   exists to keep fixed.

   The negative control is the point, not a flourish. Flip one bit of the bit
   image and the output must move; without that, a writer that returned its own
   input would pass every assertion above.

     node utilities/nfnt_write_check.mjs index.html "$TMPDIR/Cythera Data.rsrc"

   The fonts are Cythera's, so with no fork to read this skips rather than
   failing -- there is no synthetic half, because a made-up font would only
   prove the writer agrees with the reader. */

import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { pageSource } from './page_scripts.mjs';
import { makeSandbox } from './dom_stub.mjs';

const [htmlPath, forkPath] = process.argv.slice(2);
if (!htmlPath) {
  console.error('usage: nfnt_write_check.mjs <page.html> <fork.rsrc>');
  process.exit(2);
}
if (!forkPath || !existsSync(forkPath)) {
  console.log('no resource fork to read — skipped');
  process.exit(0);
}

const { sandbox: G } = makeSandbox();
const ctx = vm.createContext(G);
new vm.Script(pageSource(htmlPath), { filename: htmlPath }).runInContext(ctx);

const fork = G.openResourceFork(new Uint8Array(readFileSync(forkPath)));
const fonts = (fork.resourcesByType && fork.resourcesByType['NFNT']) || [];
if (!fonts.length) {
  console.log('the fork carries no NFNT — skipped');
  process.exit(0);
}

let failed = 0, identical = 0;
for (const e of fonts) {
  const data = fork.dataOf('NFNT', e);
  let spec;
  try { spec = G.nfntSpec(data); }
  catch (err) { console.error(`NFNT ${e.id}: could not be read — ${err.message}`); failed++; continue; }

  const back = G.writeNFNT(spec);
  let where = -1;
  if (back.length !== data.length) where = -2;
  else for (let i = 0; i < data.length; i++) if (data[i] !== back[i]) { where = i; break; }

  if (where === -1) {
    identical++;
    console.log(`NFNT ${e.id}: ${data.length} bytes back byte for byte ` +
                `(${spec.nGlyphs} glyphs, ${spec.fRectWidth}x${spec.fRectHeight} cell, ` +
                `strike ${spec.strikeBytes} bytes, offset/width table at ${spec.owOff})`);
  } else if (where === -2) {
    console.error(`NFNT ${e.id}: came back ${back.length} bytes against ${data.length}`);
    failed++;
  } else {
    console.error(`NFNT ${e.id}: differs at 0x${where.toString(16)}`);
    failed++;
  }

  // The control. One bit of the bit image, and the output has to notice.
  const bent = G.nfntSpec(data);
  bent.strike = bent.strike.slice();
  bent.strike[0] ^= 1;
  const moved = G.writeNFNT(bent).some((b, i) => b !== data[i]);
  if (!moved) {
    console.error(`NFNT ${e.id}: a flipped bit in the bit image did not move the output — ` +
                  `the writer is not writing the strike`);
    failed++;
  }
}

console.log(`${identical} of ${fonts.length} shipped fonts written back byte for byte, ` +
            `each with its negative control`);

/* THE OTHER DIRECTION: the strike as a TrueType font.

   `nfntToTrueType` claims that the font it writes draws the strike's own
   pixels. Nothing in Node rasterises a TrueType, so the claim is checked the
   only way it can be from here -- by reading the outlines back out of the
   `glyf` table this file just wrote and filling them the way a rasteriser
   would: scanline, non-zero winding, sampled at the centre of each pixel of
   the strike's own grid. Every pixel of every glyph must come out as the bit
   image has it.

   That fill is deliberately general rather than a rectangle reader. The
   writer emits axis-aligned rectangles, all wound the same way, and relies on
   non-zero winding to union them; a check that looked for rectangles would
   pass a font whose contours were wound against each other, which is the one
   mistake that would empty every overlap. Filling by winding number is the
   thing that would catch it.

   The controls are the same two as above: a flipped bit in the strike has to
   change the pixels the font draws, and the fill has to disagree when it does.

   The rasteriser itself was checked once by hand, outside this file: both
   fonts drawn by FreeType at their own cell heights matched the strike pixel
   for pixel, 48 glyphs, no exceptions. This check keeps the outlines right;
   it cannot keep FreeType right. */

function readGlyf(ttf) {
  const dv = new DataView(ttf.buffer, ttf.byteOffset, ttf.byteLength);
  const tables = {};
  const n = dv.getUint16(4);
  for (let i = 0; i < n; i++) {
    const p = 12 + i * 16;
    const tag = String.fromCharCode(ttf[p], ttf[p + 1], ttf[p + 2], ttf[p + 3]);
    tables[tag] = { off: dv.getUint32(p + 8), len: dv.getUint32(p + 12) };
  }
  for (const t of ['glyf', 'loca', 'head', 'hmtx', 'cmap', 'maxp', 'hhea', 'name', 'post', 'OS/2'])
    if (!tables[t]) throw new Error('the font has no ' + t + ' table');
  const numGlyphs = dv.getUint16(tables.maxp.off + 4);
  const long = dv.getInt16(tables.head.off + 50) === 1;
  const loca = [];
  for (let i = 0; i <= numGlyphs; i++)
    loca.push(long ? dv.getUint32(tables.loca.off + i * 4) : dv.getUint16(tables.loca.off + i * 2) * 2);
  const glyphs = [];
  for (let g = 0; g < numGlyphs; g++) {
    const start = tables.glyf.off + loca[g];
    if (loca[g + 1] === loca[g]) { glyphs.push([]); continue; }   // blank
    const nc = dv.getInt16(start);
    if (nc < 0) throw new Error('glyph ' + g + ' is composite, which this writer never makes');
    let p = start + 10;
    const ends = [];
    for (let i = 0; i < nc; i++) { ends.push(dv.getUint16(p)); p += 2; }
    p += 2 + dv.getUint16(p);                      // instructions, skipped
    const count = ends[nc - 1] + 1, flags = [];
    while (flags.length < count) {
      const f = ttf[p++]; flags.push(f);
      if (f & 8) { let r = ttf[p++]; while (r-- > 0) flags.push(f); }
    }
    const xs = [], ys = [];
    let v = 0;
    for (const f of flags) {
      if (f & 2) { const d = ttf[p++]; v += (f & 16) ? d : -d; }
      else if (!(f & 16)) { v += dv.getInt16(p); p += 2; }
      xs.push(v);
    }
    v = 0;
    for (const f of flags) {
      if (f & 4) { const d = ttf[p++]; v += (f & 32) ? d : -d; }
      else if (!(f & 32)) { v += dv.getInt16(p); p += 2; }
      ys.push(v);
    }
    const contours = [];
    let from = 0;
    for (const end of ends) {
      const pts = [];
      for (let i = from; i <= end; i++) pts.push([xs[i], ys[i]]);
      contours.push(pts); from = end + 1;
    }
    glyphs.push(contours);
  }
  return { tables, dv, numGlyphs, glyphs };
}

// Non-zero winding at a point, over every contour of one glyph.
function inside(contours, x, y) {
  let wn = 0;
  for (const pts of contours) {
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
      if (y0 <= y) {
        if (y1 > y && ((x1 - x0) * (y - y0) - (x - x0) * (y1 - y0)) > 0) wn++;
      } else if (y1 <= y && ((x1 - x0) * (y - y0) - (x - x0) * (y1 - y0)) < 0) wn--;
    }
  }
  return wn !== 0;
}

// The strike's own pixels for one code, and the font's, side by side.
function pixelsDiffer(spec, font, code, glyphIndex) {
  const i = code - spec.firstChar;
  const rowBytes = spec.rowWords * 2;
  const bit = (x, y) => (spec.strike[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1;
  const x0 = spec.loc[i], w = spec.loc[i + 1] - spec.loc[i];
  const left = spec.kernMax + (spec.ow[i] >> 8);
  const contours = font.glyphs[glyphIndex];
  let wrong = 0;
  for (let y = 0; y < spec.fRectHeight; y++)
    for (let k = 0; k < w; k++) {
      const fx = (left + k) * 64 + 32, fy = (spec.ascent - y - 1) * 64 + 32;
      if (bit(x0 + k, y) !== (inside(contours, fx, fy) ? 1 : 0)) wrong++;
    }
  return wrong;
}

let ttfFailed = 0, ttfDone = 0;
for (const e of fonts) {
  const data = fork.dataOf('NFNT', e);
  const spec = G.nfntSpec(data);
  let ttf, font;
  try { ttf = G.nfntToTrueType(spec, { family: 'Strike ' + e.id }); font = readGlyf(ttf); }
  catch (err) { console.error(`NFNT ${e.id}: no TrueType — ${err.message}`); ttfFailed++; continue; }

  // Every table's checksum, and the whole font's, as the directory claims.
  const sum = b => { let s = 0; for (let i = 0; i < b.length; i += 4)
    s = (s + (((b[i] || 0) << 24) | ((b[i + 1] || 0) << 16) | ((b[i + 2] || 0) << 8) | (b[i + 3] || 0))) >>> 0;
    return s >>> 0; };
  const nTables = font.dv.getUint16(4);
  let badSum = 0;
  for (let i = 0; i < nTables; i++) {
    const p = 12 + i * 16;
    const tag = String.fromCharCode(ttf[p], ttf[p + 1], ttf[p + 2], ttf[p + 3]);
    const off = font.dv.getUint32(p + 8), len = font.dv.getUint32(p + 12);
    const claimed = font.dv.getUint32(p + 4);
    const bytes = ttf.slice(off, off + ((len + 3) & ~3));
    if (tag === 'head') { bytes[8] = bytes[9] = bytes[10] = bytes[11] = 0; }
    if (sum(bytes) !== claimed) badSum++;
  }
  if (badSum) { console.error(`NFNT ${e.id}: ${badSum} table checksums are wrong`); ttfFailed++; }

  // The cmap, read back: every code with a width is mapped, and nothing else.
  const cmapOff = font.tables.cmap.off;
  let uni = null;
  for (let i = 0; i < font.dv.getUint16(cmapOff + 2); i++) {
    const p = cmapOff + 4 + i * 8;
    if (font.dv.getUint16(p) === 3 && font.dv.getUint16(p + 2) === 1) uni = cmapOff + font.dv.getUint32(p + 4);
  }
  if (uni === null) { console.error(`NFNT ${e.id}: no (3,1) cmap`); ttfFailed++; continue; }
  const segX2 = font.dv.getUint16(uni + 6), segs = segX2 / 2;
  const lookup = cp => {
    for (let s = 0; s < segs; s++) {
      const end = font.dv.getUint16(uni + 14 + s * 2);
      const start = font.dv.getUint16(uni + 16 + segX2 + s * 2);
      const delta = font.dv.getUint16(uni + 16 + segX2 * 2 + s * 2);
      if (cp >= start && cp <= end) return cp === 0xFFFF ? 0 : (cp + delta) & 0xFFFF;
    }
    return 0;
  };

  let wrong = 0, drawn = 0, blank = 0, unmapped = 0, advBad = 0;
  for (let code = 0x20; code <= spec.lastChar; code++) {
    const i = code - spec.firstChar;
    if (spec.ow[i] === 0xFFFF) { if (lookup(code)) unmapped++; continue; }
    const g = lookup(code);
    if (!g) { unmapped++; continue; }
    if (font.dv.getUint16(font.tables.hmtx.off + g * 4) !== (spec.ow[i] & 0xFF) * 64) advBad++;
    if (spec.loc[i + 1] > spec.loc[i]) { drawn++; wrong += pixelsDiffer(spec, font, code, g); }
    else { blank++; if (font.glyphs[g].length) wrong++; }
  }
  if (unmapped) { console.error(`NFNT ${e.id}: ${unmapped} codes are mapped wrongly`); ttfFailed++; }
  if (advBad) { console.error(`NFNT ${e.id}: ${advBad} advance widths do not match the strike`); ttfFailed++; }
  if (wrong) { console.error(`NFNT ${e.id}: ${wrong} pixels of the TrueType differ from the strike`); ttfFailed++; }
  else {
    ttfDone++;
    console.log(`NFNT ${e.id}: ${ttf.length} bytes of TrueType, ${font.numGlyphs} glyphs ` +
                `(${drawn} drawn, ${blank} blank), em ${spec.ascent + spec.descent} px at 64 units the pixel, ` +
                `every pixel and every advance as the strike has them`);
  }

  // The control, and it tests the fill as much as the writer: bend one pixel
  // of the strike, and the same comparison must report exactly that pixel.
  const bent = G.nfntSpec(data);
  bent.strike = bent.strike.slice();
  const first = [...Array(spec.nGlyphs).keys()].find(k => spec.loc[k + 1] > spec.loc[k] && spec.firstChar + k >= 0x41);
  const bx = spec.loc[first];
  bent.strike[spec.ascent * spec.rowWords * 2 + (bx >> 3)] ^= (0x80 >> (bx & 7));
  const bentFont = readGlyf(G.nfntToTrueType(bent, { family: 'Strike ' + e.id }));
  const moved = pixelsDiffer(spec, bentFont, spec.firstChar + first, lookup(spec.firstChar + first));
  if (moved !== 1) {
    console.error(`NFNT ${e.id}: a flipped pixel changed ${moved} pixels of the font, not 1 — ` +
                  `the outlines are not the strike`);
    ttfFailed++;
  }
}
console.log(`${ttfDone} of ${fonts.length} strikes written as TrueType and filled back to their own pixels`);
process.exit(failed || ttfFailed ? 1 : 0);
