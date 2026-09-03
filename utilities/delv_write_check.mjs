#!/usr/bin/env node
// Compares the viewer's Delver archive WRITER against delvmod's, byte for
// byte.
//
//   node utilities/delv_write_check.mjs explorer.html delvmod \
//        ["$TMPDIR/Cythera Data.data"]
//
// writeDelverArchive in js/delv-archive.js is a port of delvmod's
// Archive.to_file(). Like every port in this repository it gets an oracle
// from day one: utilities/delv_write_ref.py builds synthetic archives with
// delvmod and hands back both the logical content and delvmod's bytes, and
// this harness fails if the viewer's writer differs on any byte. Three
// checks per case, in increasing strength:
//
//   1. spec -> writeDelverArchive     against delvmod's bytes for that spec
//   2. bytes -> delverArchiveSpec     the parse recovers the same resources
//                                     and the same encryption verdicts
//   3. bytes -> spec -> bytes         the full round trip is the identity
//
// With the real "Cythera Data" available (third argument, extracted by
// check_all.mjs), delvmod re-serializes the actual game archive and the
// viewer must reproduce that output too -- 1,558 resources, every subindex,
// every encryption verdict. That part is skipped, not failed, when the game
// is not present.

import {readFileSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {pageSource} from './page_scripts.mjs';
import {makeSandbox} from './dom_stub.mjs';

const [htmlPath = 'explorer.html', delvDir = 'delvmod', dataPath] = process.argv.slice(2);
if (!existsSync(delvDir)) {
  console.error('missing: ' + delvDir);
  process.exit(2);
}

// ---- the reference ---------------------------------------------------------
const refScript = new URL('./delv_write_ref.py', import.meta.url).pathname;
const args = [refScript, delvDir];
const haveReal = dataPath && existsSync(dataPath);
if (haveReal) args.push(dataPath);
const REF = JSON.parse(execFileSync('python3', args,
  {maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore']}).toString());

// ---- the viewer ------------------------------------------------------------
const {sandbox} = makeSandbox();
// The helpers below use the host's Buffer for base64; a page never would.
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath) + `
;window.__writeFromSpec = (json) => {
  const spec = JSON.parse(json);
  spec.resources = spec.resources.map(r => ({
    resid: r.resid,
    data: Uint8Array.from(r.data.match(/../g) || [], h => parseInt(h, 16)),
    encrypted: r.encrypted,
  }));
  return Buffer.from(writeDelverArchive(spec)).toString('base64');
};
window.__propListIdentity = (b64) => {
  const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
  return Buffer.from(writeDelverPropList(parseDelverPropList(bytes))).toString('base64');
};
window.__propListIdentityFor = (archiveB64, resid) => {
  const arch = new Uint8Array(Buffer.from(archiveB64, 'base64'));
  const spec = delverArchiveSpec(arch);
  const res = spec.resources.find(r => r.resid === resid);
  if (!res) return { ok: false, count: 0, detail: 'missing' };
  const records = parseDelverPropList(res.data);
  const back = writeDelverPropList(records);
  const same = back.length === res.data.length &&
    back.every((b, i) => b === res.data[i]);
  return { ok: same, count: records.length,
           detail: same ? '' : (res.data.length + 'B in, ' + back.length + 'B out') };
};
window.__dcgEncode = (b64) => {
  const pixels = new Uint8Array(Buffer.from(b64, 'base64'));
  return Buffer.from(encodeDCGLiterals(pixels)).toString('base64');
};
window.__dcgDecodeJs = (b64, w, h) => {
  const enc = new Uint8Array(Buffer.from(b64, 'base64'));
  return Buffer.from(decompressDCG(enc, w, h)).toString('base64');
};
window.__ditherProbe = (w, h) => {
  // A deterministic full-colour gradient, dithered; hashed by the caller so
  // an accidental change to the ditherer is visible.
  const rgba = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = (y * w + x) * 4;
    rgba[p] = Math.round(255 * x / (w - 1));
    rgba[p + 1] = Math.round(255 * y / (h - 1));
    rgba[p + 2] = 128; rgba[p + 3] = 255;
  }
  return Buffer.from(ditherToCytheraPalette(rgba, w, h, {})).toString('base64');
};
window.__roundTrip = (b64) => {
  const bytes = new Uint8Array(Buffer.from(b64, 'base64'));
  const spec = delverArchiveSpec(bytes);
  if (!spec) return null;
  return {
    out: Buffer.from(writeDelverArchive(spec)).toString('base64'),
    resources: spec.resources.map(r => ({
      resid: r.resid, len: r.data.length, encrypted: r.encrypted,
    })),
  };
};`, {filename: htmlPath}).runInContext(ctx);

// Buffer inside the vm is the host's own (node shares it), but keep all
// comparisons on base64 strings anyway so nothing depends on realm identity.
let failures = 0;
const fail = (msg) => { failures++; console.error('FAIL  ' + msg); };
const ok = (msg) => console.log('  ok  ' + msg);

for (const c of REF.cases) {
  const want = c.bytes;

  const got = ctx.__writeFromSpec(JSON.stringify(c.spec));
  if (got !== want) {
    const a = Buffer.from(got, 'base64'), b = Buffer.from(want, 'base64');
    let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
    fail(`${c.name}: spec->write differs from delvmod at byte 0x${i.toString(16)} ` +
         `(js ${a.length}B, delvmod ${b.length}B)`);
  } else ok(`${c.name}: spec -> writeDelverArchive matches delvmod (${Buffer.from(want, 'base64').length}B)`);

  const rt = ctx.__roundTrip(want);
  if (!rt) { fail(`${c.name}: delverArchiveSpec refused delvmod's own output`); continue; }

  // The parse must see what was put in: same resource ids, same verdicts.
  // Zero-length resources are dropped by delvmod's writer, so they are
  // rightly absent here.
  const expect = c.spec.resources.filter(r => r.data.length > 0)
    .map(r => ({resid: r.resid, len: r.data.length / 2, encrypted: r.encrypted}));
  const gotRes = JSON.stringify(rt.resources);
  const wantRes = JSON.stringify(expect);
  if (gotRes !== wantRes) fail(`${c.name}: parsed spec disagrees\n  js:   ${gotRes}\n  want: ${wantRes}`);
  else ok(`${c.name}: parse recovers ${expect.length} resources with matching verdicts`);

  if (rt.out !== want) fail(`${c.name}: round trip is not the identity`);
  else ok(`${c.name}: bytes -> spec -> bytes is the identity`);
}

// ---- the prop-list writer --------------------------------------------------
// writeDelverPropList claims parse -> write is the identity. Prove it on a
// synthetic record with every field loaded, then over EVERY prop list in the
// real archive when it is present -- 14,485 records across the shipped maps,
// including the carried/contained records whose location word is a holder
// link rather than coordinates.
{
  const synth = Buffer.from(
    '01' + '0abcde' + '8c05' + '1234' + '5678' + '9abcdef01234' +   // record 0
    'ff' + '000120' + '0000' + '0000' + '0000' + '000000000000',    // deleted
    'hex').toString('base64');
  const out = ctx.__propListIdentity(synth);
  if (out !== synth) fail('prop list: synthetic round trip is not the identity');
  else ok('prop list: synthetic parse -> write is the identity');
}
// ---- the DCG literal encoder ----------------------------------------------
// encodeDCGLiterals claims any indexed image it emits decodes back exactly, in
// BOTH implementations of the format. Prove it on the dithered gradient the
// viewer's ditherizer produces -- which also pins the ditherer itself: the
// probe is deterministic, so its pixels changing means the tool changed.
{
  const pixels = ctx.__ditherProbe(64, 64);
  const enc = ctx.__dcgEncode(pixels);
  const jsBack = ctx.__dcgDecodeJs(enc, 64, 64);
  if (jsBack !== pixels) fail('dcg encode: decompressDCG does not invert the literal encoder');
  else ok('dcg encode: decompressDCG inverts the literal encoder (64x64 dithered probe)');
  try {
    const pyBack = execFileSync('python3',
      [refScript, delvDir, 'decode', enc],
      {maxBuffer: 16 << 20, stdio: ['ignore', 'pipe', 'ignore']}).toString().trim();
    if (pyBack !== pixels) fail('dcg encode: delvmod decodes the literal encoding differently');
    else ok('dcg encode: delvmod\'s DelvImage decodes it to the same pixels');
  } catch (e) { fail('dcg encode: delvmod decode run failed: ' + e.message); }
}

if (REF.real) {
  const res = ctx.__roundTrip(REF.real.bytes).resources
    .map(r => r.resid).filter(r => (r >> 8) === 0x81);
  let bad = 0, records = 0;
  for (const resid of res) {
    const r = ctx.__propListIdentityFor(REF.real.bytes, resid);
    if (!r.ok) { bad++; fail(`prop list 0x${resid.toString(16)}: rewrite differs (${r.detail})`); }
    records += r.count;
  }
  if (!bad) ok(`prop list: all ${res.length} real prop lists (${records} records) rewrite byte-identical`);
}

if (REF.real) {
  const rt = ctx.__roundTrip(REF.real.bytes);
  if (!rt) fail('real archive: delverArchiveSpec refused it');
  else if (rt.out !== REF.real.bytes) {
    const a = Buffer.from(rt.out, 'base64'), b = Buffer.from(REF.real.bytes, 'base64');
    let i = 0; while (i < Math.min(a.length, b.length) && a[i] === b[i]) i++;
    fail(`real archive: viewer's rewrite differs from delvmod's at byte 0x${i.toString(16)} ` +
         `(js ${a.length}B, delvmod ${b.length}B)`);
  } else ok(`real archive: ${rt.resources.length} resources re-serialized identically to delvmod`);
} else {
  console.log('  --  real-archive comparison skipped (no Cythera Data supplied)');
}

if (failures) { console.error(failures + ' failure(s)'); process.exit(1); }
console.log('delv_write_check: all comparisons passed');
