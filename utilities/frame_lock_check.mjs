#!/usr/bin/env node
/* The undither must not average a portrait's frame.
 *
 * Every Cythera portrait is a face inside a frame. The face is continuous
 * tone dithered into 256 colours -- the thing the filter exists to undo. The
 * frame is pixel art, and where it alternates two colours it means to: the
 * vintner's portrait (0x8811) has grape clusters drawn as a checkerboard of
 * two magentas, and the filter turned them into two flat blobs. Nothing local
 * distinguishes the two cases, so js/delv-graphics.js takes its evidence from
 * the archive: a frame is drawn once and reused across the portraits that
 * share it, a face never is.
 *
 * This check holds that rule from both ends, because a lock that is too eager
 * is as wrong as no lock at all and neither shows up in a snapshot:
 *
 *   the frame is held EXACTLY -- every locked pixel comes back byte for byte,
 *   and the grapes in particular are still two colours rather than one;
 *
 *   the face is NOT locked -- the dithered interior must still be reduced, or
 *   the filter has quietly stopped working on the half it is for.
 *
 * It also pins the corpus rule itself: a portrait compared against an empty
 * corpus must lock nothing, since with no evidence the old behaviour is the
 * right answer.
 *
 *   node utilities/frame_lock_check.mjs index.html "$TMPDIR/Cythera Data.data"
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { pageSource } from './page_scripts.mjs';
import { makeSandbox } from './dom_stub.mjs';

const [htmlPath, dataPath] = process.argv.slice(2);
if (!htmlPath || !dataPath) {
  console.log('  skip: needs <viewer.html> <Cythera Data.data>');
  process.exit(0);
}
let archive;
try { archive = new Uint8Array(readFileSync(dataPath)); }
catch (e) { console.log('  skip: no archive at ' + dataPath); process.exit(0); }

const { sandbox } = makeSandbox();
const ctx = vm.createContext(sandbox);
const EXPORT = ['PAL_RGB', 'UD_PRESETS'];
const epilogue = '\n;' + EXPORT.map(n => `try{window.__${n}=${n}}catch(e){}`).join('') +
  '\n;window.__bind=(a,m)=>{fileBytes=a;masterIndexGlobal=m;};' +
  '\n;window.__locked=(img,p,rgba,w,h)=>buildLockedMask(img,p,rgba,w,h);' +
  '\n;window.__undither=(a,w,h,p,l)=>undither(a,w,h,p,l,null);' +
  '\n;window.__shared=(img,w,h)=>sharedArtMask(img,w,h);' +
  '\n;window.__resetShared=()=>resetSharedArt();\n';
try {
  new vm.Script(pageSource(htmlPath) + epilogue, { filename: htmlPath }).runInContext(ctx);
} catch (e) { console.error('FATAL: script body threw while loading: ' + e.message); process.exit(1); }

const rd = o => ((archive[o] * 0x1000000) + (archive[o+1] << 16) + (archive[o+2] << 8) + archive[o+3]) >>> 0;
const mi = []; for (let i = 0; i < 256; i++) mi.push([rd(0x88 + i*8), rd(0x88 + i*8 + 4)]);
ctx.__bind(archive, mi);
const PAL = ctx.__PAL_RGB, PRE = ctx.__UD_PRESETS;

let failures = 0;
const fail = m => { console.log('  FAIL ' + m); failures++; };

function portrait(resid) {
  const d = ctx.decodeResource(ctx.getResourceBytes(resid), 135, resid);
  const { W, H, image } = d;
  const rgba = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const c = PAL[image[i]] || [0,0,0];
    rgba[i*4]=c[0]; rgba[i*4+1]=c[1]; rgba[i*4+2]=c[2]; rgba[i*4+3] = image[i] === 0 ? 0 : 255;
  }
  return { W, H, image, rgba };
}

/* The vintner, whose grapes are the case this was written for, and two others
   whose frames are shared with a different group. */
const SUBJECTS = [0x8811, 0x8812, 0x8805];
for (const resid of SUBJECTS) {
  const p = portrait(resid);
  const mask = ctx.__shared(p.image, p.W, p.H);
  if (!mask) { fail(`${resid.toString(16)}: no shared art found at all`); continue; }
  const n = mask.reduce((a, b) => a + b, 0);
  const pct = (100 * n / (p.W * p.H)).toFixed(1);
  // A frame is a border: a fair fraction of the picture, and nowhere near all
  // of it. Both ends of this have been wrong during development.
  if (n < 300) fail(`${resid.toString(16)}: only ${n} pixels locked — the frame is not being found`);
  if (n > 2400) fail(`${resid.toString(16)}: ${n} pixels locked — the face is being locked too`);

  const locked = ctx.__locked(p.image, PRE.original, p.rgba, p.W, p.H);
  const r = ctx.__undither(p.rgba, p.W, p.H, PRE.original, locked);
  const out = new Uint8ClampedArray(r.out);
  if (r.outW !== p.W || r.outH !== p.H) { fail(`${resid.toString(16)}: not native size back`); continue; }

  let moved = 0, changedFace = 0, faceN = 0;
  for (let i = 0; i < p.W * p.H; i++) {
    if (p.rgba[i*4+3] === 0) continue;
    const same = out[i*4] === p.rgba[i*4] && out[i*4+1] === p.rgba[i*4+1] && out[i*4+2] === p.rgba[i*4+2];
    if (mask[i]) { if (!same) moved++; }
    else { faceN++; if (!same) changedFace++; }
  }
  if (moved) fail(`${resid.toString(16)}: ${moved} locked pixels came back changed`);
  // ...and the other half of the claim: the picture is still being undithered.
  if (!(changedFace > faceN * 0.5))
    fail(`${resid.toString(16)}: only ${changedFace}/${faceN} unlocked pixels moved — the filter has stopped working`);
  console.log(`  ${resid.toString(16)}: ${n} frame pixels held (${pct}%), ${changedFace}/${faceN} of the rest reduced`);
}

/* The grapes, stated as pixels rather than as a count of colours -- which was
   the first thing tried here and is backwards: averaging a two-colour
   checkerboard into a gradient RAISES the colour count. What matters is that
   the cluster comes back as the artist drew it. */
{
  const p = portrait(0x8811);
  const locked = ctx.__locked(p.image, PRE.original, p.rgba, p.W, p.H);
  const r = ctx.__undither(p.rgba, p.W, p.H, PRE.original, locked);
  const out = new Uint8ClampedArray(r.out);
  // The cluster is named by its own colours rather than by a rectangle: the
  // four magentas of palette indices 146, 152, 156 and 159, which in the
  // top-left corner of this portrait are grapes and nothing else.
  const GRAPE = new Set([146, 152, 156, 159]);
  let held = 0, moved = 0;
  for (let y = 4; y < 24; y++) for (let x = 0; x < 13; x++) {   // the left cluster
    const i = y * p.W + x;
    if (!GRAPE.has(p.image[i])) continue;
    const same = out[i*4] === p.rgba[i*4] && out[i*4+1] === p.rgba[i*4+1] && out[i*4+2] === p.rgba[i*4+2];
    if (same) held++; else moved++;
  }
  // 55 of the 82 come back exactly as drawn with the lock on and 9 without,
  // which is the whole of the fix in one number. It is not 82: a few pixels
  // where the cluster meets the hood are next to art that is genuinely this
  // portrait's own, and those are smoothed as they always were.
  if (!(held >= 50))
    fail(`the vintner's grapes: only ${held} of ${held + moved} pixels came back as drawn — they are being averaged away`);
  else console.log(`  the vintner's grapes: ${held}/${held + moved} pixels exactly as drawn`);
}

/* No corpus, no evidence, no lock. This is what a harness that hands bytes
   straight to the decoders gets, and it must be the filter as it always was. */
{
  const p = portrait(0x8811);
  ctx.__bind(archive, []);          // an archive with no portrait subindex
  ctx.__resetShared();
  const m = ctx.__shared(p.image, p.W, p.H);
  if (m) fail('a portrait with no corpus behind it still locked something');
  else console.log('  with no corpus: nothing locked, as before');
  ctx.__bind(archive, mi); ctx.__resetShared();
}

console.log(failures ? `\nFAIL — ${failures} problem(s)` : '\nframe lock: clean');
process.exit(failures ? 1 : 0);
