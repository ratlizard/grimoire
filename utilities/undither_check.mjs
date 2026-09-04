#!/usr/bin/env node
/* Score the undither against ground truth it can be held to.
 *
 * The filter has never had one. It was tuned by eye and by a
 * cleaning-versus-detail-loss ratio over six portraits, which measures how
 * much dither came out and how much sharpness went with it -- both real
 * quantities, neither of them "is this the picture the artist drew". Nothing
 * could measure that, because the continuous-tone original is not in the
 * archive and never was.
 *
 * But this repository carries the forward process. ditherToCytheraPalette is
 * the deliberate inverse of the undither, and it takes any image into the
 * Cythera palette as a (pi,pi) checkerboard between two ramps. So a source
 * image put through it has a KNOWN original, and the undither can be scored
 * against the thing it is trying to recover rather than against a proxy.
 *
 * The sources are synthetic and are chosen to be the cases that matter rather
 * than to be pretty: smooth ramps, where dither appears and where the filter
 * must remove it; fine linework, where it must not; and a grey-to-warm hue
 * sweep, because the artwork's dither is a checkerboard in WHICH RAMP a pixel
 * comes from -- greys interleaved with warm browns, close in lightness and far
 * in hue -- which a luminance-only view cannot see at all.
 *
 * What this cannot do is prove a preset is right for the real artwork. The
 * forward process here is one dither; Ambrosia's was another, and this
 * measures recovery from the one we have. Read it as evidence about the
 * filter's behaviour, not as a verdict on the archive.
 *
 *   node utilities/undither_check.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pageSource } from './page_scripts.mjs';
import { makeSandbox } from './dom_stub.mjs';

const html = process.argv[2] || 'index.html';
const { sandbox } = makeSandbox();
const ctx = vm.createContext(sandbox);
const EXPORT = ['PAL_RGB', 'UD', 'UD_PRESETS'];
const epilogue = '\n;' + EXPORT.map(n => `try{window.__${n}=${n}}catch(e){}`).join('') +
  '\n;window.__undither=(a,w,h,p,l)=>undither(a,w,h,p,l,null);' +
  '\n;window.__dither=(a,w,h,o)=>ditherToCytheraPalette(a,w,h,o);' +
  '\n;window.__locked=(img,p,rgba,w,h)=>buildLockedMask(img,p,rgba,w,h);\n';
try {
  new vm.Script(pageSource(html) + epilogue, { filename: html }).runInContext(ctx);
} catch (e) {
  console.error('FATAL: script body threw while loading: ' + e.message);
  process.exit(1);
}
const PAL = ctx.__PAL_RGB, UD = ctx.__UD;

/* ---- the sources -------------------------------------------------------- */
function source(kind, W, H) {
  const a = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    let r, g, b;
    if (kind === 'ramp') {                       // smooth shading: dither's home
      const t = x / (W - 1), u = y / (H - 1);
      r = 40 + 180 * t; g = 40 + 150 * t * (1 - u * 0.4); b = 50 + 120 * (1 - t);
    } else if (kind === 'hue') {                 // grey to warm brown, equal lightness
      const t = x / (W - 1);
      const L = 120 + 40 * Math.sin(y / H * Math.PI);
      r = L + 45 * t; g = L; b = L - 40 * t;
    } else if (kind === 'lines') {               // detail that must survive
      const on = ((x % 7) < 2) || ((y % 11) < 1) || (Math.abs(x - y) % 13 < 1);
      r = on ? 30 : 200; g = on ? 40 : 190; b = on ? 60 : 170;
    } else {                                     // a lit sphere: both at once
      const cx = W / 2, cy = H / 2, rad = Math.min(W, H) * 0.42;
      const dx = (x - cx) / rad, dy = (y - cy) / rad, d2 = dx * dx + dy * dy;
      if (d2 > 1) { r = 25; g = 22; b = 30; }
      else {
        const nz = Math.sqrt(1 - d2);
        const lit = Math.max(0, 0.35 + 0.75 * ((-dx * 0.5) + (-dy * 0.6) + nz * 0.6));
        r = 30 + 190 * lit; g = 25 + 160 * lit * 0.95; b = 20 + 120 * lit * 0.8;
      }
    }
    a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255;
  }
  return a;
}

/* ---- scoring ------------------------------------------------------------
   Overall RMSE, and split by where the error falls: a filter can win overall
   by smoothing everything, and that shows as a good flat score and a bad edge
   one. Both are reported so a trade is visible rather than averaged away. */
function score(orig, got, W, H) {
  let flat = 0, nf = 0, edge = 0, ne = 0, all = 0;
  const lum = (a, i) => 0.299 * a[i] + 0.587 * a[i + 1] + 0.114 * a[i + 2];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4;
    const gx = Math.abs(lum(orig, i + 4) - lum(orig, i - 4));
    const gy = Math.abs(lum(orig, i + W * 4) - lum(orig, i - W * 4));
    let e = 0;
    for (let c = 0; c < 3; c++) { const d = got[i + c] - orig[i + c]; e += d * d; }
    e /= 3;
    all += e;
    if (gx + gy > 24) { edge += e; ne++; } else { flat += e; nf++; }
  }
  const n = (W - 2) * (H - 2);
  return { all: Math.sqrt(all / n), flat: Math.sqrt(flat / Math.max(1, nf)),
           edge: Math.sqrt(edge / Math.max(1, ne)) };
}

function roundTrip(orig, W, H, params) {
  const idx = ctx.__dither(orig, W, H, { checker: 0.6 });
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const c = PAL[idx[i]] || [0, 0, 0];
    rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = 255;
  }
  const locked = ctx.__locked(idx, params, rgba, W, H);
  const r = ctx.__undither(rgba, W, H, params, locked);
  // The pipeline upscales and comes back; only a native-size result is
  // comparable with the source, and everything here produces one.
  if (r.outW !== W || r.outH !== H) return null;
  return { dithered: score(orig, rgba, W, H), undithered: score(orig, new Uint8ClampedArray(r.out), W, H) };
}

const KINDS = ['ramp', 'hue', 'lines', 'sphere'];
const W = 96, H = 96;
const sources = KINDS.map(k => [k, source(k, W, H)]);

function evaluate(params) {
  let all = 0, flat = 0, edge = 0, n = 0;
  for (const [, src] of sources) {
    const r = roundTrip(src, W, H, params);
    if (!r) return null;
    all += r.undithered.all; flat += r.undithered.flat; edge += r.undithered.edge; n++;
  }
  return { all: all / n, flat: flat / n, edge: edge / n };
}

console.log('  source                dithered RMSE   after the current filter');
let base = { all: 0, flat: 0, edge: 0 };
for (const [k, src] of sources) {
  const r = roundTrip(src, W, H, UD);
  if (!r) { console.log(`  ${k}: produced a non-native size`); continue; }
  base.all += r.undithered.all / sources.length;
  console.log(`  ${k.padEnd(20)} ${r.dithered.all.toFixed(2).padStart(8)}` +
    `        ${r.undithered.all.toFixed(2).padStart(6)}  (flat ${r.undithered.flat.toFixed(2)}, edge ${r.undithered.edge.toFixed(2)})`);
}

const cur = evaluate(UD);
console.log(`\n  current UD                     all ${cur.all.toFixed(3)}   flat ${cur.flat.toFixed(3)}   edge ${cur.edge.toFixed(3)}`);

/* ---- the two shipped presets, against each other ----------------------- */
const PRE = ctx.__UD_PRESETS;
let failures = 0;
const fail = m => { console.log('  FAIL ' + m); failures++; };
const orig = evaluate(PRE.original), meas = evaluate(PRE.measured);
console.log(`  as tuned by eye                all ${orig.all.toFixed(3)}   flat ${orig.flat.toFixed(3)}   edge ${orig.edge.toFixed(3)}`);
console.log(`  measured                       all ${meas.all.toFixed(3)}   flat ${meas.flat.toFixed(3)}   edge ${meas.edge.toFixed(3)}`);

// The measured preset has to earn its name on the measure it was named for.
if (!(meas.all < orig.all))
  fail(`the measured preset does not beat the original (${meas.all.toFixed(3)} vs ${orig.all.toFixed(3)})`);
// ...and must not buy it by throwing edges away, which is the trade the
// original was protecting and the reason both are offered.
else if (meas.edge > orig.edge * 1.10)
  fail(`the measured preset costs ${((meas.edge / orig.edge - 1) * 100).toFixed(0)}% at edges, over the 10% it is allowed`);
else console.log(`  measured is ${((1 - meas.all / orig.all) * 100).toFixed(1)}% better overall for ` +
                 `${((meas.edge / orig.edge - 1) * 100).toFixed(1)}% at edges`);

// Both must actually remove dither: a filter that returned its input would
// score well on edges and tell us nothing.
for (const [name, p] of Object.entries(PRE)) {
  let before = 0, after = 0;
  for (const [, src] of sources) {
    const r = roundTrip(src, W, H, p);
    before += r.dithered.all; after += r.undithered.all;
  }
  if (!(after < before * 0.75))
    fail(`${name} removed little of the dither (${before.toFixed(1)} -> ${after.toFixed(1)})`);
}

/* checkerNotch takes a `guide` and never reads it, so every pass after the
   first recomputes an identical result. That is why the measured preset uses
   one. If the smoother ever starts using its guide this stops being true, and
   this check is what says so. */
{
  const one = evaluate(Object.assign({}, PRE.original, { passes: 1 }));
  const three = evaluate(Object.assign({}, PRE.original, { passes: 3 }));
  if (Math.abs(one.all - three.all) > 1e-9)
    fail('passes now changes the result — the measured preset should stop using 1');
  else console.log('  passes is inert for the notch smoother (1 and 3 agree exactly)');
}

console.log(failures ? `\nFAIL — ${failures} problem(s)` : '\nundither: clean');
process.exit(failures ? 1 : 0);
