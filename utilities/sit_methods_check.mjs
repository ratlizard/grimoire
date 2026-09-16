#!/usr/bin/env node
// Do the two decompressors produce exactly what StuffIt put in?
//
//   node utilities/sit_methods_check.mjs [index.html] [reference dir]
//
// WHY. Methods 13 (LZ77 + Huffman) and 15 (Arsenic) are the two compressions
// this page implements, and both are ports rather than originals:
// `Sit13Decoder` and `SitArsenicDecoder` in stuffit-rs 0.1.8, which carry The
// Unarchiver's tables. A port is exactly the kind of code that looks right
// and is wrong in one branch nothing common exercises -- a bit order, an
// off-by-one in a run length, a table transcribed short -- and the failure
// mode is not a crash. It is a file that decompresses to the right LENGTH and
// the wrong bytes, which every length check in this tree would pass.
//
// Was sit13_check.mjs until Arsenic landed on 16 September 2026.
//
// THE ORACLE IS `unar`, which is The Unarchiver's own command line tool and
// therefore the implementation ours descends from. Every method-13 and
// method-15 fork in the reference corpus is decompressed both ways and
// compared byte for byte. Without `unar` the oracle half skips and the
// snapshot half still runs.
//
// AND ONE ORACLE THAT IS NOT UNAR. The 1.0.4 installer's resource fork is in
// the corpus twice: Arsenic-compressed inside archive.org's four-in-one
// bundle, and stored in the MacBinary copy of the installer that came from
// somewhere else entirely. Those two have no implementation in common, so
// agreeing is evidence of a different kind from agreeing with the code this
// one was ported from.
//
// THE SNAPSHOT is what survives a machine with no unar and no game: the
// Pumpkin Patch's own compressed fork is small enough to carry here as a
// literal, so the check always has at least one stream to decompress and one
// answer to hold it to.
//
// THE NEGATIVE CONTROL is the part that makes any of it mean something. A
// decompressor that returned the right number of zero bytes would pass a
// length check; one that ignored its input would pass a "does not throw"
// check. So a byte of a real stream is flipped and the result must change,
// and the all-zero and unchanged-input answers are ruled out explicitly.

import {readFileSync, readdirSync, statSync, mkdirSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', refDir = 'reference'] = process.argv.slice(2);
let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);

const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);

const fnv = b => { let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h.toString(16).padStart(8, '0'); };

// ---- the corpus ------------------------------------------------------------
const dirs = [join(refDir, 'community', 'addons'), join(refDir, 'game', 'installers')];
const files = [];
for (const d of dirs) { try { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isFile()) files.push(p); } } catch { /* absent */ } }

let haveUnar = true;
try { execFileSync('which', ['unar'], {stdio: 'ignore'}); } catch { haveUnar = false; }
const OUT = join(process.env.TMPDIR || '/tmp', 'cythera_sit13_oracle');

const METHODS = new Set([13, 15]);
let forks = 0, matched = 0, archives = 0;
const byMethod = new Map();
const misses = [];
for (const p of files) {
  sandbox.__raw = new Uint8Array(readFileSync(p));
  const listed = ev(`(() => { let bb = __raw;
    try { if (/^\\(This file must be converted/.test(String.fromCharCode(...bb.slice(0, 30)))) bb = binhexSplitForks(binhexDecode(bb)).data; } catch (e) {}
    if (!looksLikeStuffIt(bb)) return null;
    globalThis.__sit = bb;
    return parseStuffItArchive(bb).entries.filter(e => !e.isFolder)
      .map(e => ({name: e.name, dm: e.dataMethod, rm: e.rsrcMethod, dl: e.dataLen, rl: e.rsrcLen})); })()`);
  if (!listed || !listed.some(e => (METHODS.has(e.dm) && e.dl) || (METHODS.has(e.rm) && e.rl))) continue;
  archives++;

  let dest = null;
  if (haveUnar) {
    dest = join(OUT, p.split('/').pop().replace(/[^A-Za-z0-9._-]/g, '_'));
    if (!existsSync(dest)) {
      mkdirSync(dest, {recursive: true});
      try { execFileSync('unar', ['-q', '-f', '-o', dest, p], {stdio: 'ignore'}); } catch { dest = null; }
    }
  }
  const findFile = name => {
    if (!dest) return null;
    const hits = [];
    const walk = d => { for (const f of readdirSync(d, {withFileTypes: true})) { const q = join(d, f.name); if (f.isDirectory()) walk(q); else if (f.name === name) hits.push(q); } };
    try { walk(dest); } catch { /* nothing */ }
    return hits[0] || null;
  };

  for (const e of listed) {
    for (const [which, method, len] of [['data', e.dm, e.dl], ['rsrc', e.rm, e.rl]]) {
      if (!METHODS.has(method) || !len) continue;
      forks++;
      byMethod.set(method, (byMethod.get(method) || 0) + 1);
      sandbox.__name = e.name; sandbox.__which = which;
      let got;
      try { got = Uint8Array.from(ev(`Array.from(stuffItFork(__sit, parseStuffItArchive(__sit).entries.find(x => x.name === __name), __which))`)); }
      catch (err) { misses.push(`${e.name} ${which}: ${err.message}`); continue; }
      if (got.length !== len) { misses.push(`${e.name} ${which}: ${got.length} bytes for a stated ${len}`); continue; }
      const f = findFile(e.name);
      if (!f) continue;                       // no oracle for this one
      let truth;
      try { truth = new Uint8Array(readFileSync(which === 'data' ? f : f + '/..namedfork/rsrc')); }
      catch { continue; }
      if (truth.length === got.length && truth.every((v, i) => v === got[i])) matched++;
      else misses.push(`${e.name} ${which}: differs from unar (${fnv(got)} against ${fnv(truth)})`);
    }
  }
}
for (const m of misses) fail('compressed forks', m);
const spread = [...byMethod.entries()].sort((a, b) => a[0] - b[0]).map(([m, n]) => `${n} of method ${m}`).join(', ');
if (!forks) console.log('  skip  no compressed forks this page reads in ' + refDir);
else if (!haveUnar) ok('every compressed fork decompresses to its stated length', `${forks} fork(s) in ${archives} archive(s) (${spread}); unar is not installed, so nothing was compared against it`);
else if (matched) ok('every compressed fork is byte identical to unar', `${matched} of ${forks} fork(s) across ${archives} archive(s) (${spread})`);

// ---- the negative control --------------------------------------------------
// A stream the page can always reach: the Pumpkin Patch's, when the corpus is
// there. Without it there is nothing to bend, and the control says so rather
// than passing quietly.
const patchFile = join(refDir, 'community', 'addons', '614_MagpiePumpkinPatch.sit.hqx');
if (!existsSync(patchFile)) console.log('  skip  the negative control needs the Magpie Pumpkin Patch');
else {
  sandbox.__raw = new Uint8Array(readFileSync(patchFile));
  const neg = ev(`(() => {
    const bb = binhexSplitForks(binhexDecode(__raw)).data;
    const arc = parseStuffItArchive(bb);
    const e = arc.entries.find(x => x.name === 'Pumpkin Patch');
    const good = stuffItFork(bb, e, 'data');
    const hash = b => { let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
    // Flip one byte a little way into the compressed stream, past the header
    // and the code tables, so what changes is the data rather than the shape.
    const bent = bb.slice();
    bent[e.dataOffset + 400] ^= 0x55;
    let bentOut = null, threw = '';
    try { bentOut = stuffItFork(bent, parseStuffItArchive(bent).entries.find(x => x.name === 'Pumpkin Patch'), 'data'); }
    catch (err) { threw = err.message; }
    return {
      goodHash: hash(good), goodLen: good.length,
      allZero: good.every(v => v === 0),
      echoesInput: good.length === e.dataPackedLen,
      bentDiffers: threw ? true : hash(bentOut) !== hash(good),
      bentThrew: !!threw
    };
  })()`);
  if (neg.allZero) fail('negative control', 'the decompressed fork is all zeroes');
  else if (neg.echoesInput) fail('negative control', 'the output is the length of the input, so nothing was decompressed');
  else if (!neg.bentDiffers) fail('negative control', 'flipping a byte of the compressed stream changed nothing');
  else ok('the check can fail', 'a flipped byte ' + (neg.bentThrew ? 'is refused' : 'changes the output') + ', and the output is neither zeroes nor the input');
  // The snapshot. Deliberate changes to the decompressor move it; accidents
  // move it too, which is the point.
  const SNAPSHOT = '9e0a8844';
  const live = neg.goodHash.toString(16).padStart(8, '0');
  if (live !== SNAPSHOT) fail('snapshot', `the Pumpkin Patch now decompresses to ${live}, not ${SNAPSHOT}`);
  else ok('the Pumpkin Patch decompresses to the same bytes as ever', `SNAPSHOT ${live}, ${neg.goodLen.toLocaleString()} bytes`);
}

/* ---- the control, for Arsenic too -----------------------------------------
   The control above bends a method-13 stream. Arsenic is arithmetic-coded, so
   a bent byte there does not merely change a symbol -- it desynchronises the
   coder from that point on, and the interesting question is whether anything
   notices rather than whether the bytes move. A decoder that swallowed a bad
   stream and returned the right length would be the failure worth catching. */
const CURSORS = join(refDir, 'community', 'addons', '605_3DCursors.sit.hqx');
if (!existsSync(CURSORS)) console.log('  skip  the Arsenic control needs the 3D Cursors add-on');
else {
  sandbox.__raw = new Uint8Array(readFileSync(CURSORS));
  const neg = ev(`(() => {
    const bb = binhexSplitForks(binhexDecode(__raw)).data;
    const arc = parseStuffItArchive(bb);
    const e = arc.entries.find(x => !x.isFolder && x.rsrcMethod === 15 && x.rsrcLen);
    if (!e) return {why: 'no Arsenic fork in the add-on'};
    const good = stuffItFork(bb, e, 'rsrc');
    const hash = b => { let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
    const bent = bb.slice();
    bent[e.rsrcOffset + 64] ^= 0x55;
    let out = null, threw = '';
    try { out = stuffItFork(bent, parseStuffItArchive(bent).entries.find(x => x.name === e.name), 'rsrc'); }
    catch (err) { threw = err.message; }
    return {name: e.name, len: good.length, allZero: good.every(v => v === 0),
            differs: threw ? true : hash(out) !== hash(good), threw: !!threw};
  })()`);
  if (neg.why) console.log('  skip  ' + neg.why);
  else if (neg.allZero) fail('Arsenic control', 'the decompressed fork is all zeroes');
  else if (!neg.differs) fail('Arsenic control', 'flipping a byte of an Arsenic stream changed nothing');
  else ok('an Arsenic stream cannot be bent unnoticed',
          `${neg.name}, ${neg.len.toLocaleString()} bytes; a flipped byte ` + (neg.threw ? 'is refused' : 'changes the output'));
}

/* ---- the oracle that is not unar ------------------------------------------
   The 1.0.4 installer's resource fork is in the corpus twice and the two
   copies share no code: Arsenic inside archive.org's bundle, and stored
   inside a MacBinary that came from elsewhere. If the Arsenic decoder were
   wrong in a way The Unarchiver is also wrong in, unar would agree with it
   and this would not. */
const BUNDLE = join(refDir, 'game', 'installers', 'Cythera installers (archive.org).sit');
const MACBIN = join(refDir, 'game', 'installers', 'Cythera.bin');
if (!existsSync(BUNDLE) || !existsSync(MACBIN))
  console.log('  skip  the second oracle needs both the bundle and the MacBinary installer');
else {
  sandbox.__bundle = new Uint8Array(readFileSync(BUNDLE));
  sandbox.__macbin = new Uint8Array(readFileSync(MACBIN));
  const r = ev(`(() => {
    const arc = parseStuffItArchive(__bundle);
    const e = arc.entries.find(x => /1\\.0\\.4/.test(x.name) && x.rsrcLen);
    if (!e) return {why: 'the bundle has no 1.0.4 entry with a resource fork'};
    const mine = stuffItFork(__bundle, e, 'rsrc');
    const mb = sniffMacContainer(__macbin);
    if (!mb || !mb.rsrc || !mb.rsrc.length) return {why: 'the MacBinary copy carries no resource fork'};
    let at = -1;
    const n = Math.max(mine.length, mb.rsrc.length);
    for (let i = 0; i < n; i++) if (mine[i] !== mb.rsrc[i]) { at = i; break; }
    return {method: e.rsrcMethod, len: mine.length, other: mb.rsrc.length, at};
  })()`);
  if (r.why) console.log('  skip  ' + r.why);
  else if (r.at >= 0 || r.len !== r.other)
    fail('the second oracle', `the Arsenic fork is ${r.len} bytes against the MacBinary copy's ${r.other}` +
         (r.at >= 0 ? `, differing at 0x${r.at.toString(16)}` : ''));
  else ok('the Arsenic fork matches a copy with no code in common',
          `${r.len.toLocaleString()} bytes, method ${r.method} out of the bundle against stored in the MacBinary installer`);
}

console.log(failures ? `\n${failures} failure(s)`
  : `\n  ${matched || forks} of ${forks} compressed fork(s) in ${archives} archive(s)${haveUnar ? ' byte identical to unar' : ' at their stated length'}`);
process.exit(failures ? 1 : 0);
