#!/usr/bin/env node
// Build a Magpie patch that re-indexes every tile in the game onto the
// engine's own cycling ramps, so the whole world animates.
//
//   node utilities/ramp_patch.mjs index.html "$TMPDIR/Cythera Data.data" \
//        "out/Ramp Patch" [--preview out/preview.png]
//
// WHAT THIS IS FOR. Palette animation in Cythera is a software remap over the
// map viewer's buffer: the engine builds eight translation tables once and
// pushes every pixel of the finished frame through the table for the current
// phase, rotating indices 0xE0-0xFB within five ramps and leaving every other
// index alone. The ranges are compiled into the executable, so a patch cannot
// move them -- but a patch CAN decide what lands in them, because the art is
// data. Re-index a tile onto a ramp and it animates; that is the whole trick,
// and it is the one palette effect the add-on format can reach.
//
// The ramps are all monotone in luminance, which is why a grayscale mapping
// works at all:
//
//   fire  E0-E7  8 steps  luma  75..204     water  E8-EF  8 steps  luma 38..156
//   magic F0-F3  4 steps  luma  98..156     earth  F4-F7  4 steps  luma 79..126
//   nature F8-FB 4 steps  luma 109..134
//
// Levels rotate WITHIN a ramp, so a luminance-mapped tile does not shimmer --
// it solarises. At phase 4 of 8 the darkest pixels are the brightest, and the
// image turns inside out and back roughly once a second. The 4-step ramps
// complete two turns per cycle and so pulse at twice the rate.
//
// FOREGROUND AND BACKGROUND ARE DECIDED BY USE, NOT BY THE ART. The obvious
// test -- a cut-out tile is a sprite, an opaque one is ground -- does not
// survive contact with the archive: 2,210 of the 2,544 tiles carry the
// transparent index, because composed terrain is assembled from transparent
// 8x8 pieces just as sprites are. So the background set is built from what the
// maps are actually paved with: every tile id in every map's terrain layer,
// every tile id in its roof blocks, and, for a composite id (0x1000 and up),
// the leaf tiles its sixteen segments come from. Everything else in subindex
// 141 -- props, furniture, items, monsters, the characters -- is foreground.
// A tile used both ways is background, because the ground is the bigger
// surface and a sprite that matches it is the cheaper mistake.
//
// THE ENCODER IS LITERAL-ONLY, which is grimoire's standing trade (see
// encodeDCGLiterals): every re-encoded sheet is bigger than the one it
// replaces. That is why the patch is megabytes rather than the Pumpkin
// Patch's 57 KB. Nothing in the game minds; a smaller file would want
// delvmod's compressor, which writes the run opcodes this one does not.
//
// WHAT IS CHECKED HERE. Every sheet is decoded again from the bytes that go
// into the patch and compared pixel for pixel with the remap that produced
// them -- an encoder that dropped a row would otherwise ship as a patch. The
// finished patch is then merged into the base archive with the page's own
// mergeDelverPatch, and the merge must replace exactly the resources named
// and read back as what the patch holds. Neither check is a substitute for
// looking at it: --preview writes a contact sheet at four phases for that.

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
const fgName = flag('--foreground') || 'fire';
const bgName = flag('--background') || 'water';
const [htmlPath = 'index.html', dataPath, outPath] = args;

const RAMPS = {
  fire:   { start: 0xE0, len: 8 },
  water:  { start: 0xE8, len: 8 },
  magic:  { start: 0xF0, len: 4 },
  earth:  { start: 0xF4, len: 4 },
  nature: { start: 0xF8, len: 4 },
};
if (!dataPath || !outPath) {
  console.error('usage: ramp_patch.mjs <index.html> <Cythera Data.data> <out patch> [--preview p.png]' +
                ' [--foreground ' + Object.keys(RAMPS).join('|') + '] [--background ...]');
  process.exit(2);
}
for (const [what, name] of [['foreground', fgName], ['background', bgName]])
  if (!RAMPS[name]) { console.error(`no ${what} ramp called ${JSON.stringify(name)}`); process.exit(2); }

// ---- the page, loaded the way every other harness here loads it ------------
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

// Plaintext for every resource, which is also what the patch writer wants: the
// cipher is keyed by resource id, so an edit made here re-encrypts wherever
// the resource lands in the merged file.
const spec = g.delverArchiveSpec(archive);
const byId = new Map(spec.resources.map(r => [r.resid, r]));
const plain = id => { const r = byId.get(id); return r ? r.data : null; };

// ---- what the maps are paved with ------------------------------------------
const leaf = (resid, tileInSheet) => ((resid & 0xFF) << 4) | (tileInSheet & 0x0F);
const background = new Set();
let compositeIds = 0, mapCount = 0, roofTiles = 0;
const composition = g.getCompositionTableCached();

function addTile(id) {
  if (!id) return;                       // 0 is "nothing here", not a tile
  if (id >= 0x1000) {
    const entry = composition[id - 0x1000];
    if (!entry) return;
    compositeIds++;
    for (let n = 0; n < 16; n++) {
      const part = entry[n];
      if (part) background.add(leaf(part.resid, part.tileInSheet));
    }
    return;
  }
  background.add(id);
}

for (const r of spec.resources) {
  if ((r.resid & 0xFF00) !== 0x8000) continue;         // subindex 127: the maps
  let m = null;
  try { m = g.parseDelverMap(r.data); } catch (e) { m = null; }
  if (!m) continue;
  mapCount++;
  const d = r.data;
  for (let i = 0; i < m.width * m.height; i++) {
    const o = m.mapDataOffset + i * 2;
    if (o + 1 < d.length) addTile((d[o] << 8) | d[o + 1]);
  }
  // Roof blocks: 8x8 tile ids each, filling the region between the header and
  // the terrain layer. Every word there is a tile id or 0, so the whole region
  // reads without knowing which blocks a prop list points at.
  for (let o = m.roofDataOffset; o + 1 < m.mapDataOffset && o + 1 < d.length; o += 2) {
    const t = (d[o] << 8) | d[o + 1];
    if (t) { addTile(t); roofTiles++; }
  }
}

// ---- the mapping ------------------------------------------------------------
const PAL = g.PAL_RGB;
const luma = i => {
  const c = PAL[i] || [0, 0, 0];
  return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
};

// Tile sheets, decoded once. 0x8EFF is a sized picture rather than a strip of
// sixteen tiles and is left alone -- it is not something Render draws as a
// tile, and re-encoding it would only make the patch bigger.
const SHEETS = [];
for (const r of spec.resources) {
  if ((r.resid & 0xFF00) !== 0x8E00) continue;         // subindex 141
  if (g.tileSheetIsSized(r.resid, r.data)) { SHEETS.push({ resid: r.resid, skip: 'sized picture' }); continue; }
  let d = null;
  try { d = g.decodeResource(r.data, 141, r.resid); } catch (e) { d = null; }
  if (!d || d.W !== 32 || d.H !== 512) { SHEETS.push({ resid: r.resid, skip: d ? `${d.W}x${d.H}` : 'undecodable' }); continue; }
  SHEETS.push({ resid: r.resid, W: d.W, H: d.H, image: Uint8Array.from(d.image) });
}

// The luminance window to stretch across a ramp, taken from the art itself so
// that ink which never reaches pure black or pure white still uses every step.
// Global rather than per tile: a per-tile stretch would give two neighbouring
// grass squares different contrast and the seams would show.
const hist = new Float64Array(256);
for (const s of SHEETS) {
  if (s.skip) continue;
  for (let i = 0; i < s.image.length; i++) { const v = s.image[i]; if (v !== 0) hist[v]++; }
}
let total = 0;
for (let i = 0; i < 256; i++) total += hist[i];
const byLuma = [...Array(256).keys()].filter(i => hist[i] > 0).sort((a, b) => luma(a) - luma(b));
const pick = frac => {
  let seen = 0;
  for (const i of byLuma) { seen += hist[i]; if (seen >= total * frac) return luma(i); }
  return luma(byLuma[byLuma.length - 1] || 255);
};
const lo = pick(0.01), hi = pick(0.99);
const span = Math.max(1, hi - lo);

const levelOf = index => {
  const t = (luma(index) - lo) / span;
  return t <= 0 ? 0 : t >= 1 ? 1 : t;
};

function remapTable(ramp) {
  // 0 is Delver's transparent slot and must survive untouched: every sprite
  // and every composed-terrain piece is cut out with it.
  const tab = new Uint8Array(256);
  for (let i = 1; i < 256; i++) {
    const step = Math.min(ramp.len - 1, Math.round(levelOf(i) * (ramp.len - 1)));
    tab[i] = ramp.start + step;
  }
  return tab;
}
const FG = remapTable(RAMPS[fgName]), BG = remapTable(RAMPS[bgName]);

// ---- remap, re-encode, and check the encoder as we go ----------------------
let fgTiles = 0, bgTiles = 0, changed = [], grew = 0, wasBytes = 0, nowBytes = 0;
for (const s of SHEETS) {
  if (s.skip) continue;
  const out = new Uint8Array(s.image.length);
  for (let t = 0; t < 16; t++) {
    const id = ((s.resid & 0xFF) << 4) | t;
    const tab = background.has(id) ? BG : FG;
    if (tab === BG) bgTiles++; else fgTiles++;
    for (let y = 0; y < 32; y++) {
      const row = (t * 32 + y) * 32;
      for (let x = 0; x < 32; x++) out[row + x] = tab[s.image[row + x]];
    }
  }
  const encoded = g.encodeDCGLiterals(out);
  // The encoder is the part most likely to be wrong in a way nothing else
  // would notice, so the bytes that go in the patch are decoded again here.
  const back = g.decodeResource(encoded, 141, s.resid);
  if (!back || back.W !== 32 || back.H !== 512) {
    console.error(`FAIL 0x${s.resid.toString(16)}: re-decoded as ${back ? back.W + 'x' + back.H : 'nothing'}`);
    process.exit(1);
  }
  for (let i = 0; i < out.length; i++) if (back.image[i] !== out[i]) {
    console.error(`FAIL 0x${s.resid.toString(16)}: pixel ${i} came back ${back.image[i]}, not ${out[i]}`);
    process.exit(1);
  }
  const res = byId.get(s.resid);
  wasBytes += res.data.length; nowBytes += encoded.length;
  if (encoded.length > res.data.length) grew++;
  res.data = encoded;
  s.remapped = out;
  changed.push(s.resid);
}

console.log(`maps read: ${mapCount}, roof tiles ${roofTiles.toLocaleString()}, composite ids expanded ${compositeIds.toLocaleString()}`);
console.log(`background tiles ${bgTiles}, foreground tiles ${fgTiles}  (${bgName} / ${fgName})`);
console.log(`luminance window ${lo.toFixed(1)}..${hi.toFixed(1)} of 0..255, stretched across each ramp`);
console.log(`sheets rewritten ${changed.length}, skipped ${SHEETS.filter(s => s.skip).length}` +
            SHEETS.filter(s => s.skip).map(s => ` (0x${s.resid.toString(16)}: ${s.skip})`).join(''));
console.log(`art was ${wasBytes.toLocaleString()} B, now ${nowBytes.toLocaleString()} B in ${grew} bigger resources`);

// ---- the patch --------------------------------------------------------------
const written = g.writeDelverPatch(spec, changed, {
  description: `Everything cycles: ${bgName} terrain, ${fgName} props and characters`,
  typeCode: g.DELV_PATCH_EXPORT_TYPE,
});
const patch = written.bytes;
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, Buffer.from(patch));
// Two shapes of the same patch, as the page's own export offers: the bare data
// fork for the browser player and for a shared folder, and a MacBinary typed
// DelP with Magpie's creator, which is what makes a real Mac see a patch
// rather than somebody's saved game.
const macbin = g.writeMacBinary({ name: outPath.split('/').pop(), type: 'DelP',
                                  creator: g.DELV_PATCH_CREATOR, data: patch });
writeFileSync(outPath + '.bin', Buffer.from(macbin));
console.log(`wrote ${outPath}  ${patch.length.toLocaleString()} bytes, uuid ${written.uuidText}, type ${written.typeCode}, ` +
            (written.checkValueValid ? `check value ${written.checkValue} verifies` : 'CHECK VALUE DOES NOT VERIFY'));
console.log(`wrote ${outPath}.bin  ${macbin.length.toLocaleString()} bytes, MacBinary typed DelP/${g.DELV_PATCH_CREATOR}`);

// ---- does it apply, and only where it says? --------------------------------
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
let wrong = 0, untouched = 0;
for (const r of g.delverArchiveSpec(archive).resources) {
  const after = mergedById.get(r.resid);
  const isOurs = changed.includes(r.resid);
  const same = after && after.length === r.data.length && r.data.every((v, i) => after[i] === v);
  if (isOurs) { if (same) wrong++; }            // a patched sheet that did not move
  else if (!same) wrong++;                      // a sheet nobody asked for that did
  else untouched++;
}
if (wrong) console.error(`FAIL merge scope: ${wrong} resource(s) on the wrong side of the change`);
else console.log(`merge scope: ${untouched.toLocaleString()} resources byte-identical, ${changed.length} replaced`);

// ---- the contact sheet ------------------------------------------------------
// Four phases down, a handful of tiles across, so the solarising is visible
// without loading anything. The cycle is the engine's: a pixel drawn as 0xE0
// shows 0xE7 at phase 1, so the ramp walks downwards as the phase rises.
if (previewPath) {
  const cycled = frame => {
    const pal = PAL.map(c => c.slice());
    for (const { start, len } of Object.values(RAMPS))
      for (let i = 0; i < len; i++) pal[start + i] = PAL[start + ((i - frame) % len + len) % len];
    return pal;
  };
  const shown = [];
  for (const s of SHEETS) {
    if (s.skip || !s.remapped) continue;
    for (let t = 0; t < 16; t++) {
      const id = ((s.resid & 0xFF) << 4) | t;
      const bg = background.has(id);
      if (shown.filter(x => x.bg === bg).length >= 5) continue;
      // Skip near-empty tiles: an all-transparent cell shows nothing.
      let ink = 0;
      for (let i = 0; i < 32 * 32; i++) if (s.image[(t * 32) * 32 + i] !== 0) ink++;
      if (ink < 700) continue;
      shown.push({ bg, resid: s.resid, t, before: s.image, after: s.remapped });
      break;
    }
    if (shown.filter(x => x.bg).length >= 5 && shown.filter(x => !x.bg).length >= 5) break;
  }
  shown.sort((a, b) => (a.bg === b.bg ? 0 : a.bg ? -1 : 1));
  const cols = shown.length, rows = 5;                 // original, then 4 phases
  const CELL = 32, PADX = 4, PADY = 4;
  const W = cols * (CELL + PADX) + PADX, H = rows * (CELL + PADY) + PADY;
  const rgb = new Uint8Array(W * H * 3).fill(0x20);
  const put = (img, palette, cx, cy) => {
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) {
      const v = img[y * 32 + x];
      const c = palette[v] || [0, 0, 0];
      const p = ((cy + y) * W + (cx + x)) * 3;
      rgb[p] = c[0]; rgb[p + 1] = c[1]; rgb[p + 2] = c[2];
    }
  };
  shown.forEach((s, col) => {
    const cx = PADX + col * (CELL + PADX);
    const tile = (src) => src.subarray(s.t * 32 * 32, (s.t + 1) * 32 * 32);
    put(tile(s.before), PAL, cx, PADY);
    for (let f = 0; f < 4; f++) put(tile(s.after), cycled(f * 2), cx, PADY + (f + 1) * (CELL + PADY));
  });
  // PNG, truecolour, filter 0 on every row.
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
  console.log(`preview: ${previewPath}  ${W}x${H}, ${shown.length} tiles, original row then phases 0, 2, 4, 6`);
}
