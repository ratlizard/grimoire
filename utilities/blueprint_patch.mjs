#!/usr/bin/env node
// Build a Magpie patch that repaints the game as a blueprint: every picture is
// flattened into patches of flat colour, and in the world the colour says what
// the thing IS rather than what it looks like.
//
//   node utilities/blueprint_patch.mjs index.html "$TMPDIR/Cythera Data.data" \
//        "out/Blueprint Patch" [--preview out/blueprint.png]
//
//   ground  blue      walls  red      units  pink
//   things  brown     gettable items  green
//
//   portraits, skill icons and interface art: any colour at all, because there
//   is nothing there to classify -- a face is not a wall or an item, and the
//   point of repainting them is to see the shapes the art is built from.
//
// WHAT THIS IS FOR. `ramp_patch.mjs` beside this one re-indexes tiles onto the
// engine's cycling ramps so the world animates; this borrows its shape -- read
// the graphics, remap, re-encode, write a patch, check the encoder and the
// merge -- and changes what the remap means. There the mapping was luminance
// onto a ramp, and every tile got the same treatment. Here each picture is
// first broken into contiguous areas of similar colour, and each area is
// filled with one random colour: from the band its TILE belongs to in the
// world, from the whole palette everywhere else. So a chair is a few flat
// brown shapes, a guard is a few flat pink ones, a wall is red, and a portrait
// is a stained-glass window of itself.
//
// TWO THINGS SURVIVE UNPAINTED, and both are backgrounds rather than subjects:
// palette index 0, Delver's transparent slot, which every sprite and every
// composed-terrain piece is cut out with; and any index that is pure black,
// which is what the portraits and the interface art sit on. Repainting those
// would turn every cut-out into a solid rectangle and every portrait into a
// coloured square, which is the opposite of being able to read the shapes.
//
// WHERE EACH CATEGORY COMES FROM. None of this is guessed from the art or from
// names; every one is a reading of the archive, and the counts are printed so
// a wrong reading shows up as an absurd total.
//
//   ground  Every tile id in every map's terrain layer and roof blocks, with
//           composite ids (0x1000 and up) expanded to the sixteen leaves they
//           are assembled from. This is ramp_patch's `background` set exactly.
//
//   walls   Tile attribute 0xF002 with BOTH 0x004 and 0x200 set. That pair is
//           the engine's own room-divider test -- `TGameViewer` walks every
//           square, `andi. 0x204`, and sets a bit in the wall bitmap that
//           MakeZone flood-fills to find the room you are in. Over the shipped
//           archive it is 189 tiles and every one of them is a wall or a door,
//           which is why this is the wall test and a name match is not.
//           NOTE it is not walkability: Land King Hall's interior walls are
//           props standing on passable floor, and they are caught here as
//           props, by their own attribute entry.
//
//   units   Prop types used by a record in the character table 0xF009, via
//           grimoire's `livingPropTypes()`. Read from the table rather than
//           from names because "goat" and "harpy" are creatures but so is
//           "king", and no keyword list gets that right.
//
//   items   Prop types that have an item class (resource 0x1000 + proptype),
//           which is what makes a thing inventory rather than scenery, plus
//           any prop type seen with the prop-list "okay to take" flag 0x01 on
//           a real placement. The union, because the class table is the
//           definition and the placements are the evidence.
//
//   things  Every other tile a prop draws with -- furniture, doors' frames,
//           trees, signs -- and, at the end, any tile that is in no set at
//           all. Art the game never places has to be painted something, and
//           "a thing" is the honest answer for it.
//
// A tile can qualify for several. The order is units, items, walls, ground,
// things: a wall beats the ground it stands on because seeing the walls is the
// point, and the ground beats a loose prop tile for ramp_patch's reason --
// ground is the bigger surface and a sprite that matches it is the cheaper
// mistake.
//
// THE BANDS come out of the palette rather than being written down. Each
// category names a hue, and the band is the palette indices closest to it that
// carry enough saturation, sorted by luminance. That keeps the patch working
// if the palette is ever read differently, and it is why the band sizes are
// printed: a band of two would make a category unreadable and is worth seeing.
//
// THE FOUR KINDS OF PICTURE are encoded differently and each has to go back
// the way it came, which is the part most likely to ship broken:
//
//   141  tile sheets    32x512, DCG, no header
//   135  portraits      64x64, DCG, no header
//   137  skill icons    32x16, raw pixels -- no compression at all
//   142  interface art  a 4-byte header giving the size, then DCG. The decoder
//        decompresses to a LOGICAL size and crops; this paints and re-encodes
//        the logical buffer, so the padding columns a cropped picture carries
//        are still there when the game reads it back.
//
// WHAT IS CHECKED HERE. Every re-encoded resource is decoded again from the
// bytes that go into the patch and compared pixel for pixel. Every category
// must have a band and tiles in it. Segmentation must leave no pixel
// unassigned. Index 0 and pure black must come back exactly where they went
// in. And the finished patch is merged into the base archive with the page's
// own mergeDelverPatch, which must replace the resources named and no others.
// None of that is a substitute for looking at it: --preview writes a contact
// sheet of before and after, and the five bands along the bottom.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import { pageSource } from './page_scripts.mjs';
import { makeSandbox } from './dom_stub.mjs';

const args = process.argv.slice(2);
const flag = name => {
  const i = args.indexOf(name);
  if (i < 0) return null;
  const v = args[i + 1];
  args.splice(i, 2);
  return v;
};
const previewPath = flag('--preview');
// AREAS ARE FOUND ON THE UNDITHERED PICTURE, not on the stored pixels. This
// art is dithered pixel by pixel: in the grass tile of 0x8E00 the greens are a
// ramp of five, 0x6B..0x6F, each step 21 to 24 apart in RGB and the two ends 93
// apart, and 21% of the tile is pure black laid in as shading. Segmenting that
// directly has no good setting -- at a tolerance of 40 fewer than half of
// neighbouring pairs join and the result is coloured static, at 120 96% join
// and the tile becomes one blob. Both were tried before this.
//
// So each picture goes through grimoire's own undither first, which is the
// settled tone reconstruction this repository already carries and checks, and
// the areas are grown over the continuous tone it returns. The pixels that are
// WRITTEN are still palette indices, and what is preserved is still decided by
// the stored index: the undither is used to decide where the areas are and
// nothing else.
//
// STEP is how far one pixel-to-neighbour step may go, SPAN how far an area may
// drift from where it started, so a long smooth gradient cannot walk across a
// whole picture. Both are set off the art. On the undithered grass tile the
// median distance between neighbouring pixels is 23 and the 90th percentile is
// 70, so a step under the median joins almost nothing -- at 18 that tile breaks
// into 298 areas of about three pixels, which is the coloured static this
// looked like before -- and a step over the 90th swallows real edges. 45 sits
// between them and gives that tile about 25 flat patches. SPAN has to be loose
// or it caps the same tile at 86 areas whatever STEP is: 160 lets an area
// follow a surface without crossing into the next thing.
const STEP = Number(flag('--step') || 45);
const SPAN = Number(flag('--span') || 160);
const NO_UNDITHER = args.includes('--raw') && (args.splice(args.indexOf('--raw'), 1), true);
const SEED = Number(flag('--seed') || 0x0D0E1F);
const [htmlPath = 'index.html', dataPath, outPath] = args;

if (!dataPath || !outPath) {
  console.error('usage: node utilities/blueprint_patch.mjs <index.html> <Cythera Data> <out> [--preview p.png]');
  process.exit(2);
}

// Hue 310 for the units and not 330, which is where this was first written.
// 330 is exactly half way between red at 0 and the palette's magenta ramp at
// 300, the hue gaps tied at 30, and the tie broke toward red -- so the units
// came out the same dark reds as the walls and the two categories could not be
// told apart. The palette's pinks are the 0x90..0x9B ramp, (255,219,255) down
// to (158,0,158), and 310 reaches them without argument.
const CATEGORIES = [
  { key: 'wall',   label: 'walls',          hue: 0,   minSat: 0.30, maxVal: 1.00, minVal: 0.15 },
  { key: 'unit',   label: 'units',          hue: 310, minSat: 0.10, maxVal: 1.00, minVal: 0.45 },
  { key: 'item',   label: 'gettable items', hue: 120, minSat: 0.18, maxVal: 1.00, minVal: 0.12 },
  { key: 'ground', label: 'ground',         hue: 225, minSat: 0.15, maxVal: 1.00, minVal: 0.10 },
  { key: 'thing',  label: 'thing',          hue: 25,  minSat: 0.20, maxVal: 0.78, minVal: 0.10 },
];
// No colour may serve two categories, and no category may reach more than this
// far round the wheel to fill itself. Both exist because of the failure above:
// a band that quietly scrapes a neighbour's colours looks plausible in a
// contact sheet and makes the whole patch useless for the one thing it is for.
const MAX_HUE_GAP = 45;
const MIN_BAND = 6;

// ---- the page, and the archive ---------------------------------------------
const archive = new Uint8Array(readFileSync(dataPath));
const { sandbox } = makeSandbox();
const ctx = vm.createContext(sandbox);
const EXPORT_CONSTS = ['PAL_RGB', 'DELV_PATCH_EXPORT_TYPE', 'DELV_PATCH_CREATOR'];
const epilogue = '\n;' + EXPORT_CONSTS.map(n => `try{window.__${n}=${n}}catch(e){}`).join('') +
  '\n;window.__bind = (a, m) => { fileBytes = a; masterIndexGlobal = m; };\n';
try {
  new vm.Script(pageSource(htmlPath) + epilogue, { filename: htmlPath }).runInContext(ctx);
} catch (e) {
  console.error('FATAL: the page threw while loading: ' + e.message);
  process.exit(1);
}
for (const n of EXPORT_CONSTS) if (ctx['__' + n] !== undefined) ctx[n] = ctx['__' + n];
const g = ctx;

const readU32 = o => ((archive[o] * 0x1000000) + (archive[o+1] << 16) + (archive[o+2] << 8) + archive[o+3]) >>> 0;
const masterIndex = [];
for (let i = 0; i < 256; i++) masterIndex.push([readU32(0x88 + i * 8), readU32(0x88 + i * 8 + 4)]);
g.fileBytes = archive; g.masterIndexGlobal = masterIndex; g.__bind(archive, masterIndex);

const spec = g.delverArchiveSpec(archive);
const byId = new Map(spec.resources.map(r => [r.resid, r]));

// ---- who is what ------------------------------------------------------------
const leaf = (resid, tileInSheet) => ((resid & 0xFF) << 4) | (tileInSheet & 0x0F);
const composition = g.getCompositionTableCached();
const attrs = g.getTileAttributes();

function eachLeaf(id, fn) {
  if (!id) return;                       // 0 is "nothing here", not a tile
  if (id >= 0x1000) {
    const entry = composition[id - 0x1000];
    if (!entry) return;
    for (let n = 0; n < 16; n++) {
      const part = entry[n];
      if (part) fn(leaf(part.resid, part.tileInSheet));
    }
    return;
  }
  fn(id);
}

const ground = new Set(), wall = new Set(), unit = new Set(), item = new Set(), thing = new Set();
let mapCount = 0, roofTiles = 0, propRecords = 0, takeableRecords = 0;

for (const r of spec.resources) {
  if ((r.resid & 0xFF00) !== 0x8000) continue;         // subindex 127: the maps
  let m = null;
  try { m = g.parseDelverMap(r.data); } catch (e) { m = null; }
  if (!m) continue;
  mapCount++;
  const d = r.data;
  for (let i = 0; i < m.width * m.height; i++) {
    const o = m.mapDataOffset + i * 2;
    if (o + 1 < d.length) eachLeaf((d[o] << 8) | d[o + 1], t => ground.add(t));
  }
  for (let o = m.roofDataOffset; o + 1 < m.mapDataOffset && o + 1 < d.length; o += 2) {
    const t = (d[o] << 8) | d[o + 1];
    if (t) { eachLeaf(t, x => ground.add(x)); roofTiles++; }
  }
}

let wallEntries = 0, wallComposites = 0;
for (let id = 0; id < attrs.length; id++) {
  if ((attrs[id] & 0x204) !== 0x204) continue;
  wallEntries++;
  if (id >= 0x1000) wallComposites++;
  eachLeaf(id, t => wall.add(t));
}

const propTiles = g.getPropTileList();
const living = g.livingPropTypes();
const takeableTypes = new Set();
for (const r of spec.resources) {
  if ((r.resid & 0xFF00) !== 0x8100) continue;         // subindex 128: prop lists
  let recs = null;
  try { recs = g.parseDelverPropList(r.data); } catch (e) { recs = null; }
  if (!recs) continue;
  for (const rec of recs) {
    if (rec.flags === 0xFF) continue;                  // deleted
    propRecords++;
    if (rec.takeable) { takeableRecords++; takeableTypes.add(rec.proptype); }
  }
}

// Every tile a prop type can draw: its base, and the frames after it that no
// other prop type claims as its own base. That is grimoire's own rule for
// which frames belong to a type, and it stops a long run of aspects from
// swallowing the type that starts in the middle of it.
const propBases = new Set();
for (let pt = 0; pt < propTiles.length; pt++) if (propTiles[pt]) propBases.add(propTiles[pt]);
function tilesOfPropType(pt) {
  const base = propTiles[pt];
  if (!base) return [];
  const out = [base];
  for (let n = 1; n < 32; n++) {
    const t = base + n;
    if (propBases.has(t)) break;                       // the next type starts here
    if (t >= 0x1000) break;
    out.push(t);
  }
  return out;
}

let itemTypes = 0, unitTypes = 0, otherTypes = 0;
for (let pt = 0; pt < propTiles.length; pt++) {
  if (!propTiles[pt]) continue;
  let isItem = takeableTypes.has(pt);
  if (!isItem) { try { isItem = !!g.parseItemClass(pt); } catch (e) { isItem = false; } }
  const isUnit = living.has(pt);
  const target = isUnit ? unit : isItem ? item : thing;
  if (isUnit) unitTypes++; else if (isItem) itemTypes++; else otherTypes++;
  for (const t of tilesOfPropType(pt)) target.add(t);
}

const ORDER = [['unit', unit], ['item', item], ['wall', wall], ['ground', ground], ['thing', thing]];
function categoryOf(id) {
  for (const [key, set] of ORDER) if (set.has(id)) return key;
  return 'thing';                                      // art the game never places
}

// ---- the palette, the bands, and what is left alone --------------------------
const PAL = g.PAL_RGB;
const luma = c => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
function hsv([r, g_, b]) {
  const mx = Math.max(r, g_, b), mn = Math.min(r, g_, b), d = mx - mn;
  let h = 0;
  if (d) {
    if (mx === r) h = ((g_ - b) / d) % 6;
    else if (mx === g_) h = (b - r) / d + 2;
    else h = (r - g_) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: mx ? d / mx : 0, v: mx / 255 };
}
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };

// Index 0 is the transparent slot and is never painted, anywhere.
//
// Pure black is two different things depending on where it is. In the
// portraits and the interface art it is the ground the picture sits on, and
// painting it turns a portrait into a coloured rectangle. In the tiles it is
// SHADING, laid in pixel by pixel: 21% of the grass tile of 0x8E00 is index
// 0xFF. Preserving it there does not keep a background, it shatters every
// surface into islands three pixels across and the world comes out as static
// -- which is what the first run of this looked like. So black is held in the
// pictures that have a background and painted over in the tiles, and
// --black-in-tiles puts it back for a look.
const BLACK_IN_TILES = args.includes('--black-in-tiles') &&
  (args.splice(args.indexOf('--black-in-tiles'), 1), true);
const KEEP = new Uint8Array(256);          // in pictures with a background
const KEEP_TILE = new Uint8Array(256);     // in tile sheets
KEEP[0] = 1; KEEP_TILE[0] = 1;
let blackIndices = 0;
for (let i = 0; i < 256; i++) {
  const c = PAL[i];
  if (c && c[0] === 0 && c[1] === 0 && c[2] === 0) {
    KEEP[i] = 1; blackIndices++;
    if (BLACK_IN_TILES) KEEP_TILE[i] = 1;
  }
}

const BANDS = {};
const claimed = new Uint8Array(256);
for (const cat of CATEGORIES) {
  const scored = [];
  for (let i = 1; i < 256; i++) {
    const c = PAL[i]; if (!c || KEEP[i] || claimed[i]) continue;
    const { h, s, v } = hsv(c);
    if (s < cat.minSat || v < cat.minVal || v > cat.maxVal) continue;
    const gap = hueGap(h, cat.hue);
    if (gap > MAX_HUE_GAP) continue;
    scored.push({ i, gap, l: luma(c) });
  }
  scored.sort((a, b) => a.gap - b.gap);
  const band = scored.slice(0, 24);
  for (const x of band) claimed[x.i] = 1;
  BANDS[cat.key] = band.sort((a, b) => a.l - b.l).map(x => x.i);
}
for (const cat of CATEGORIES) {
  if (BANDS[cat.key].length < MIN_BAND) {
    console.error(`FAIL band: ${cat.label} found only ${BANDS[cat.key].length} palette entries ` +
                  `within ${MAX_HUE_GAP} degrees of hue ${cat.hue}, and needs ${MIN_BAND}`);
    process.exit(1);
  }
}
{ // and no two of them may share a colour
  const owner = new Map();
  for (const cat of CATEGORIES) for (const i of BANDS[cat.key]) {
    if (owner.has(i)) {
      console.error(`FAIL band: index ${i.toString(16)} is in both ${owner.get(i)} and ${cat.label}`);
      process.exit(1);
    }
    owner.set(i, cat.label);
  }
}
// Everything that is a colour rather than a background: the band for the
// pictures that have no category.
const ANY = [];
for (let i = 1; i < 256; i++) if (PAL[i] && !KEEP[i]) ANY.push(i);
if (ANY.length < 16) {
  console.error(`FAIL palette: only ${ANY.length} paintable colours`);
  process.exit(1);
}

// ---- segment and fill --------------------------------------------------------
// A small deterministic PRNG so the same archive always makes the same patch:
// a patch that differed between two runs could not be told apart from one that
// had been edited.
function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 0x100000000; };
}
const dist2 = (a, b) => {
  const dr = a[0] - b[0], dg = a[1] - b[1], db = a[2] - b[2];
  return dr * dr + dg * dg + db * db;
};
const STEP2 = STEP * STEP, SPAN2 = SPAN * SPAN;

// The undithered tone for one resource, as flat RGB triples indexed the same
// way the pixels are. Returns null when the filter hands back a different
// shape than it was given, which would put every area in the wrong place.
let unditherFailures = 0;
function toneOf(image, W, H) {
  if (NO_UNDITHER) return null;
  const N = W * H;
  const rgba = new Uint8ClampedArray(N * 4);
  for (let i = 0; i < N; i++) {
    const c = PAL[image[i]] || [0, 0, 0];
    if (image[i] === 0) continue;                      // the cutout has no tone
    rgba[i*4] = c[0]; rgba[i*4+1] = c[1]; rgba[i*4+2] = c[2]; rgba[i*4+3] = 255;
  }
  let r = null;
  try {
    const opt = g.activeUD();
    r = g.undither(rgba, W, H, opt, g.buildLockedMask(image, opt, rgba, W, H), null);
  } catch (e) { r = null; }
  if (!r || r.outW !== W || r.outH !== H) { unditherFailures++; return null; }
  return r.out;
}

let regionTotal = 0, pixelsFilled = 0, pixelsKept = 0;
// Grow 4-connected areas of similar colour out of every pixel that is neither
// transparent nor black, and give each area one colour from the band. A
// diagonal touch is a corner rather than a shared edge, and joining on it runs
// two areas together through a single pixel, so it is four-connected.
function paintImage(src, tone, off, W, H, dst, band, seedFor, keep) {
  // `src` decides what is background and what colour a pixel counts as when
  // there is no tone; `tone` decides where the areas are.
  const colourAt = tone
    ? q => [tone[(off + q) * 4], tone[(off + q) * 4 + 1], tone[(off + q) * 4 + 2]]
    : q => PAL[src[off + q]] || [0, 0, 0];
  const rand = rng(seedFor);
  const n = W * H;
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  let regions = 0;
  for (let p = 0; p < n; p++) {
    const v = src[off + p];
    if (keep[v]) { dst[off + p] = v; pixelsKept++; seen[p] = 1; continue; }
    if (seen[p]) continue;
    const seedCol = colourAt(p);
    const fill = band[Math.min(band.length - 1, Math.floor(rand() * band.length))];
    regions++;
    let top = 0;
    stack[top++] = p; seen[p] = 1;
    while (top) {
      const q = stack[--top];
      dst[off + q] = fill; pixelsFilled++;
      const here = colourAt(q);
      const x = q % W, y = (q / W) | 0;
      if (x > 0) push(q - 1, here);
      if (x < W - 1) push(q + 1, here);
      if (y > 0) push(q - W, here);
      if (y < H - 1) push(q + W, here);
    }
    function push(m, here) {
      if (seen[m]) return;
      const w = src[off + m];
      if (keep[w]) return;
      const col = colourAt(m);
      if (dist2(col, here) > STEP2) return;            // too far in one step
      if (dist2(col, seedCol) > SPAN2) return;         // drifted too far overall
      seen[m] = 1; stack[top++] = m;
    }
  }
  regionTotal += regions;
  return regions;
}

// ---- the resources -----------------------------------------------------------
// Each kind goes back the way it came. `logical` is what the encoder must be
// handed: for 142 that is the padded buffer the decoder decompresses before it
// crops, because the game will crop it again.
// The page's own bit reader, not a second one written here: it masks and
// truncates in ways a naive MSB loop does not, and the header it reads is the
// difference between a picture coming back the right shape and not at all.
const bits = (bytes, count, start) => g.bitsOf(bytes, count, start);

const KINDS = [
  { sub: 141, mask: 0x8E00, what: 'tile sheets' },
  { sub: 135, mask: 0x8800, what: 'portraits' },
  { sub: 137, mask: 0x8A00, what: 'skill icons' },
  { sub: 142, mask: 0x8F00, what: 'interface art' },
];

const counts = { unit: 0, item: 0, wall: 0, ground: 0, thing: 0 };
const kindCounts = {};
const PAINTED = [];
let changed = [], grew = 0, wasBytes = 0, nowBytes = 0, skipped = [], identical = 0;

for (const kind of KINDS) {
  kindCounts[kind.what] = 0;
  for (const r of spec.resources) {
    if ((r.resid & 0xFF00) !== kind.mask) continue;
    let sub = kind.sub;
    // 0x8EFF is a sized picture filed among the tile sheets: it is not
    // something Render draws as a tile, and it decodes as interface art.
    if (sub === 141 && g.tileSheetIsSized(r.resid, r.data)) sub = 142;

    let W, H, image, header = null, logW = 0, logH = 0;
    if (sub === 137) {                                  // raw pixels, canonical size
      W = 32; H = 16;
      if (r.data.length < W * H) { skipped.push(`0x${r.resid.toString(16)}: ${r.data.length} B`); continue; }
      image = Uint8Array.from(r.data.subarray(0, W * H));
    } else if (sub === 142) {                           // 4-byte header, then DCG
      if (r.data.length < 8) { skipped.push(`0x${r.resid.toString(16)}: ${r.data.length} B`); continue; }
      header = r.data.subarray(0, 4);
      let W2 = bits(header, 14, 0) << 2;
      const f1 = bits(header, 2, 14);
      let H2 = bits(header, 15, 16) << 1;
      const f2 = bits(header, 1, 31);
      logW = W2 + (f1 ? 4 : 0); logH = H2 + f2;
      if (logW < 1 || logH < 1 || logW > 4096 || logH > 4096) { skipped.push(`0x${r.resid.toString(16)}: ${logW}x${logH}`); continue; }
      let full = null;
      try { full = g.decompressDCG(r.data.subarray(4), logW, logH); } catch (e) { full = null; }
      if (!full || full.length < logW * logH) { skipped.push(`0x${r.resid.toString(16)}: undecompressible`); continue; }
      W = logW; H = logH; image = Uint8Array.from(full.subarray(0, logW * logH));
    } else {                                            // 141 and 135: DCG, canonical
      let d = null;
      try { d = g.decodeResource(r.data, sub, r.resid); } catch (e) { d = null; }
      const want = sub === 141 ? [32, 512] : [64, 64];
      if (!d || d.W !== want[0] || d.H !== want[1]) { skipped.push(`0x${r.resid.toString(16)}: ${d ? d.W + 'x' + d.H : 'undecodable'}`); continue; }
      W = d.W; H = d.H; image = Uint8Array.from(d.image);
    }

    // Once per resource: a tile sheet is undithered as the whole column it is
    // stored as, not sixteen times.
    const tone = toneOf(image, W, H);
    const out = new Uint8Array(image.length);
    if (sub === 141 && kind.sub === 141) {
      // Sixteen tiles in a column, each judged on its own id.
      for (let t = 0; t < 16; t++) {
        const id = ((r.resid & 0xFF) << 4) | t;
        const key = categoryOf(id);
        counts[key]++;
        paintImage(image, tone, t * 32 * 32, 32, 32, out, BANDS[key], (SEED ^ (id * 2654435761)) >>> 0, KEEP_TILE);
      }
    } else {
      paintImage(image, tone, 0, W, H, out, ANY, (SEED ^ (r.resid * 40503 + sub)) >>> 0, KEEP);
    }

    // Back the way it came, and read again from the bytes that go in the patch.
    let encoded, check;
    if (sub === 137) {
      encoded = out;
      check = { W, H, image: out };
    } else if (sub === 142) {
      encoded = new Uint8Array(4 + 0);
      const body = g.encodeDCGLiterals(out);
      encoded = new Uint8Array(4 + body.length);
      encoded.set(header, 0); encoded.set(body, 4);
      let back = null;
      try { back = g.decompressDCG(encoded.subarray(4), logW, logH); } catch (e) { back = null; }
      check = back ? { W: logW, H: logH, image: back } : null;
    } else {
      encoded = g.encodeDCGLiterals(out);
      let back = null;
      try { back = g.decodeResource(encoded, sub, r.resid); } catch (e) { back = null; }
      check = back;
    }
    if (!check || check.W !== W || check.H !== H) {
      console.error(`FAIL 0x${r.resid.toString(16)}: re-read as ${check ? check.W + 'x' + check.H : 'nothing'}, not ${W}x${H}`);
      process.exit(1);
    }
    for (let i = 0; i < out.length; i++) if (check.image[i] !== out[i]) {
      console.error(`FAIL 0x${r.resid.toString(16)}: pixel ${i} came back ${check.image[i]}, not ${out[i]}`);
      process.exit(1);
    }
    const keptHere = (sub === 141 && kind.sub === 141) ? KEEP_TILE : KEEP;
    for (let i = 0; i < out.length; i++) if (keptHere[image[i]] && out[i] !== image[i]) {
      console.error(`FAIL 0x${r.resid.toString(16)}: a background pixel at ${i} was painted ${out[i]}`);
      process.exit(1);
    }
    // Every painted pixel must be a colour from the band its own tile was
    // judged into. Without this the only thing standing between a wrong band
    // and a shipped patch is noticing the colour by eye in a contact sheet,
    // and a category shifted by one reads as plausible.
    if (sub === 141 && kind.sub === 141) {
      for (let t = 0; t < 16; t++) {
        const id = ((r.resid & 0xFF) << 4) | t;
        const allowed = new Set(BANDS[categoryOf(id)]);
        for (let i = t * 1024; i < (t + 1) * 1024; i++) {
          if (keptHere[image[i]] && out[i] === image[i]) continue;
          if (!allowed.has(out[i])) {
            console.error(`FAIL 0x${r.resid.toString(16)} tile ${t}: ${categoryOf(id)} tile painted ` +
                          `index ${out[i].toString(16)}, which is not in its band`);
            process.exit(1);
          }
        }
      }
    } else {
      const allowed = new Set(ANY);
      for (let i = 0; i < out.length; i++) {
        if (keptHere[image[i]] && out[i] === image[i]) continue;
        if (!allowed.has(out[i])) {
          console.error(`FAIL 0x${r.resid.toString(16)}: painted index ${out[i].toString(16)} is not a paintable colour`);
          process.exit(1);
        }
      }
    }

    // An all-background picture paints to exactly what it was -- every skill
    // icon that is blank does -- and a patch that claims to replace a resource
    // with its own bytes is a patch with nothing in it. Leave those out.
    if (encoded.length === r.data.length && encoded.every((v, i) => v === r.data[i])) { identical++; continue; }
    wasBytes += r.data.length; nowBytes += encoded.length;
    if (encoded.length > r.data.length) grew++;
    byId.get(r.resid).data = encoded;
    PAINTED.push({ resid: r.resid, sub, W, H, before: image, after: out, kind: kind.what });
    changed.push(r.resid);
    kindCounts[kind.what]++;
  }
}

if (!changed.length) { console.error('FAIL: nothing was repainted'); process.exit(1); }

const tileCount = Object.values(counts).reduce((a, b) => a + b, 0);
console.log(`maps read ${mapCount}, roof tiles ${roofTiles.toLocaleString()}, prop records ${propRecords.toLocaleString()} ` +
            `(${takeableRecords.toLocaleString()} takeable)`);
console.log(`prop types: ${unitTypes} living, ${itemTypes} inventory, ${otherTypes} other`);
// Both numbers, because they differ and the difference is the reading: the
// disassembly note counts ATTRIBUTE ENTRIES, and a composite entry is one
// entry standing for the sixteen leaves it is assembled from.
console.log(`walls: ${wallEntries} attribute entries with 0x204 (${wallComposites} of them composite), ` +
            `${wall.size} distinct leaf tiles once expanded`);
for (const cat of CATEGORIES)
  console.log(`  ${cat.label.padEnd(15)} ${String(counts[cat.key]).padStart(5)} tiles   band ${String(BANDS[cat.key].length).padStart(2)} colours` +
              `  [${BANDS[cat.key].slice(0, 8).map(i => i.toString(16).padStart(2, '0')).join(' ')}${BANDS[cat.key].length > 8 ? ' …' : ''}]`);
console.log(`left alone: index 0 everywhere, and ${blackIndices} pure-black ${blackIndices === 1 ? 'index' : 'indices'} ` +
            `in the portraits, icons and interface art${BLACK_IN_TILES ? ' and in the tiles' : ' but painted over in the tiles'}; ` +
            `${ANY.length} colours for everything with no category`);
console.log(`repainted: ` + KINDS.map(k => `${kindCounts[k.what]} ${k.what}`).join(', ') +
            (identical ? `, ${identical} left out as unchanged (all background)` : '') +
            (skipped.length ? `, skipped ${skipped.length} (${skipped.slice(0, 4).join('; ')}${skipped.length > 4 ? '; …' : ''})` : ''));
console.log(`areas found ${regionTotal.toLocaleString()}, pixels painted ${pixelsFilled.toLocaleString()}, ` +
            `left as background ${pixelsKept.toLocaleString()} (step ${STEP}, span ${SPAN}` +
            (NO_UNDITHER ? ', undither off' : `, undithered${unditherFailures ? `, ${unditherFailures} fell back to raw` : ''}`) + ')');
console.log(`art was ${wasBytes.toLocaleString()} B, now ${nowBytes.toLocaleString()} B in ${grew} bigger resources`);

// ---- the patch ---------------------------------------------------------------
const written = g.writeDelverPatch(spec, changed, {
  description: 'Blueprint: ground blue, walls red, units pink, things brown, items green',
  typeCode: g.DELV_PATCH_EXPORT_TYPE,
});
const patch = written.bytes;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(patch));
const macbin = g.writeMacBinary({ name: outPath.split('/').pop(), type: 'DelP',
                                  creator: g.DELV_PATCH_CREATOR, data: patch });
writeFileSync(outPath + '.bin', Buffer.from(macbin));
console.log(`wrote ${outPath}  ${patch.length.toLocaleString()} bytes, uuid ${written.uuidText}, type ${written.typeCode}, ` +
            (written.checkValueValid ? `check value ${written.checkValue} verifies` : 'CHECK VALUE DOES NOT VERIFY'));
console.log(`wrote ${outPath}.bin  ${macbin.length.toLocaleString()} bytes, MacBinary typed DelP/${g.DELV_PATCH_CREATOR}`);

// ---- does it apply, and only where it says? ----------------------------------
g.__patch = patch; g.__base = archive;
const merged = vm.runInContext(`(() => {
  const m = mergeDelverPatch(__base, __patch);
  globalThis.__merged = m.bytes;
  return { replaced: m.replaced.length, skipped: m.skipped.length, disagreed: m.disagreed.length };
})()`, ctx);
if (merged.replaced !== changed.length || merged.disagreed)
  console.error(`FAIL merge: ${merged.replaced} replaced, ${merged.disagreed} refused, expected ${changed.length} and 0`);
else console.log(`merge: ${merged.replaced} resources replaced, ${merged.skipped} skipped, 0 refused`);

const mergedSpec = vm.runInContext('delverArchiveSpec(__merged)', ctx);
const mergedById = new Map(mergedSpec.resources.map(r => [r.resid, r.data]));
const changedSet = new Set(changed);
// For a resource the patch names, the merged file must hold exactly the bytes
// the patch carries; for every other, exactly the bytes that were there. The
// weaker test -- "a patched resource must have CHANGED" -- calls a picture
// that legitimately paints to itself a failure, which is how this read at
// first and why the identical ones are left out above rather than excused.
let wrong = 0, untouched = 0;
for (const r of g.delverArchiveSpec(archive).resources) {
  const after = mergedById.get(r.resid);
  const want = changedSet.has(r.resid) ? byId.get(r.resid).data : r.data;
  const same = after && after.length === want.length && want.every((v, i) => after[i] === v);
  if (!same) wrong++;
  else if (!changedSet.has(r.resid)) untouched++;
}
if (wrong) console.error(`FAIL merge scope: ${wrong} resource(s) on the wrong side of the change`);
else console.log(`merge scope: ${untouched.toLocaleString()} resources byte-identical, ${changed.length} replaced`);

// ---- the contact sheet --------------------------------------------------------
if (previewPath) {
  const CELL = 64, PADX = 4, PADY = 4, BAND = 10;
  const shown = [];
  // A few tiles of each category, then a portrait and a piece of interface art.
  for (const cat of CATEGORIES) {
    let got = 0;
    for (const p of PAINTED) {
      if (p.sub !== 141 || p.W !== 32 || got >= 3) continue;
      for (let t = 0; t < 16 && got < 3; t++) {
        const id = ((p.resid & 0xFF) << 4) | t;
        if (categoryOf(id) !== cat.key) continue;
        // Only a cell with nothing in it at all is skipped. This used to
        // demand 500 opaque pixels of 1024, inherited from ramp_patch to keep
        // the sheet tidy, and a sprite is mostly cut-out -- so no character
        // tile ever qualified, the units column was missing from the sheet
        // entirely, and the units band being the same red as the walls
        // survived two rounds of looking straight at it. A contact sheet that
        // drops a category to look neater is worse than useless.
        let ink = 0;
        for (let i = 0; i < 32 * 32; i++) if (p.before[t * 32 * 32 + i] !== 0) ink++;
        if (!ink) continue;
        shown.push({ p, off: t * 32 * 32, w: 32, h: 32, key: cat.key, what: `${cat.label} 0x${p.resid.toString(16)}#${t}` });
        got++;
      }
    }
  }
  for (const want of [135, 142]) {
    let got = 0;
    for (const p of PAINTED) {
      if (p.sub !== want || got >= 3) continue;
      if (p.W > 128 || p.H > 128) continue;             // keep the sheet readable
      shown.push({ p, off: 0, w: p.W, h: p.H, key: null, what: `${want === 135 ? 'portrait' : 'interface'} 0x${p.resid.toString(16)}` });
      got++;
    }
  }
  const cols = shown.length;
  const KEY = 6;                                     // the column's own colour, above it
  const W = cols * (CELL + PADX) + PADX;
  const H = KEY + 2 + 2 * (CELL + PADY) + PADY + CATEGORIES.length * (BAND + 2) + PADY;
  const rgb = new Uint8Array(W * H * 3).fill(0x20);
  const put = (img, off, w, h, cx, cy) => {
    for (let y = 0; y < Math.min(h, CELL); y++) for (let x = 0; x < Math.min(w, CELL); x++) {
      const c = PAL[img[off + y * w + x]] || [0, 0, 0];
      const p = ((cy + y) * W + (cx + x)) * 3;
      rgb[p] = c[0]; rgb[p + 1] = c[1]; rgb[p + 2] = c[2];
    }
  };
  shown.forEach((it, col) => {
    const cx = PADX + col * (CELL + PADX);
    // The band this column was painted from, so a column and its colour cannot
    // be matched up wrongly by counting -- which is how the units band being
    // red went unnoticed for two rounds of looking at this sheet.
    const band = it.key ? BANDS[it.key] : ANY;
    for (let x = 0; x < CELL; x++) {
      const c = PAL[band[Math.min(band.length - 1, Math.floor(x / CELL * band.length))]] || [0, 0, 0];
      for (let y = 0; y < KEY; y++) { const o = ((y) * W + cx + x) * 3; rgb[o] = c[0]; rgb[o+1] = c[1]; rgb[o+2] = c[2]; }
    }
    put(it.p.before, it.off, it.w, it.h, cx, KEY + 2 + PADY);
    put(it.p.after, it.off, it.w, it.h, cx, KEY + 2 + PADY + CELL + PADY);
  });
  let by = KEY + 2 + 2 * (CELL + PADY) + PADY;
  for (const cat of CATEGORIES) {
    const band = BANDS[cat.key];
    for (let x = 0; x < W; x++) {
      const c = PAL[band[Math.min(band.length - 1, Math.floor(x / W * band.length))]] || [0, 0, 0];
      for (let y = 0; y < BAND; y++) {
        const p = ((by + y) * W + x) * 3;
        rgb[p] = c[0]; rgb[p + 1] = c[1]; rgb[p + 2] = c[2];
      }
    }
    by += BAND + 2;
  }
  const raw = new Uint8Array(H * (W * 3 + 1));
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; raw.set(rgb.subarray(y * W * 3, (y + 1) * W * 3), y * (W * 3 + 1) + 1); }
  const crcTable = [...Array(256).keys()].map(n => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = buf => { let c = 0xFFFFFFFF; for (const b of buf) c = crcTable[(c ^ b) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const chunk = (type, data) => {
    const t = Buffer.from(type, 'latin1'), body = Buffer.concat([t, Buffer.from(data)]);
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length - 4);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.from(raw))), chunk('IEND', Buffer.alloc(0)),
  ]);
  mkdirSync(dirname(previewPath), { recursive: true });
  writeFileSync(previewPath, png);
  console.log(`preview: ${previewPath}  ${W}x${H}, a band swatch over each column, original row, painted row, ` +
              `then the five bands: ${CATEGORIES.map(c => c.label).join(', ')}`);
  console.log('  columns: ' + shown.map(it => it.what).join(' | '));
}
