#!/usr/bin/env node
// Runs explorer.html's own undither() over a captured screen frame.
//
//   node utilities/undither_frame.mjs <in.rgba> <W> <H> <out.rgba> [key=value ...]
//
// This is a tool, not a check: check_all.mjs does not run it and it asserts
// nothing. It exists because the question "what would this filter do to a real
// Cythera screen" had been argued about from the source and never once looked
// at, and because the answer turned out to contradict the argument -- the
// prediction was that hard 1-bit text would be smeared a third of the way to
// the background, and it is not touched at all, while the damage is in the
// map's diagonal linework, which nobody had thought about.
//
// Raw RGBA in and raw RGBA out, because there is no PNG decoder here and this
// tree does not take dependencies; PIL does the conversion on either side:
//
//   python3 -c "from PIL import Image; im=Image.open('f.png').convert('RGBA'); \
//               open('f.rgba','wb').write(im.tobytes()); print(im.size)"
//   node utilities/undither_frame.mjs f.rgba 800 600 out.rgba
//   python3 -c "from PIL import Image; \
//               Image.frombytes('RGBA',(800,600),open('out.rgba','rb').read()).save('out.png')"
//
// The filter is reached through pageSource() rather than by reading the HTML as
// text, for the reason mobile_undither_check.mjs records: it moved into
// js/delv-graphics.js once already and a check that read the file stopped
// finding it.
import {readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname, join} from 'node:path';
import vm from 'node:vm';
import {pageSource} from './page_scripts.mjs';
import {makeSandbox} from './dom_stub.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [inPath, Wr, Hr, outPath, ...overrides] = process.argv.slice(2);
if (!outPath) {
  console.error('usage: undither_frame.mjs <in.rgba> <W> <H> <out.rgba> [key=value ...]');
  process.exit(2);
}
const W = Number(Wr), H = Number(Hr);

const {sandbox} = makeSandbox();
const ctx = vm.createContext(sandbox);
vm.runInContext(pageSource(join(ROOT, 'explorer.html')), ctx, {filename: 'explorer.html'});

// Top-level const/let are not properties of a vm global; a function declaration
// is. UD is a const, so it has to come back through an eval in that scope.
const peek = name => vm.runInContext(`(typeof ${name} !== 'undefined') ? ${name} : undefined`, ctx);
const UD = peek('UD');
if (!UD) { console.error('no UD in explorer.html'); process.exit(2); }

const p = Object.assign({}, UD);
for (const kv of overrides) {
  const [k, v] = kv.split('=');
  p[k] = v === 'true' ? true : v === 'false' ? false : isNaN(Number(v)) ? v : Number(v);
}

// protectCutout must be off on a composited screen frame. It treats alpha 0 as
// a cut-out and locks it, and unditherIndexed builds that alpha from the
// transparent palette index -- but on a whole screen index 0 is real white, not
// void, so leaving this on punches holes through every white pixel on screen.
p.protectCutout = false;

const raw = readFileSync(inPath);
if (raw.length !== W * H * 4) {
  console.error(`${inPath} is ${raw.length} bytes, expected ${W * H * 4} for ${W}x${H} RGBA`);
  process.exit(2);
}
// Buffers made out here are not the vm's ArrayBuffer, and the filter builds and
// indexes typed arrays of its own, so hand it one constructed inside the context.
const rgba = vm.runInContext(`new Uint8ClampedArray(${W * H * 4})`, ctx);
rgba.set(raw);
const locked = vm.runInContext(`new Uint8Array(${W * H})`, ctx);

const t0 = Date.now();
const res = vm.runInContext('undither', ctx)(rgba, W, H, p, locked, null);
const ms = Date.now() - t0;
writeFileSync(outPath, Buffer.from(res.out.buffer, res.out.byteOffset, res.out.length));
console.log(`undither ${W}x${H}: ${ms} ms, ${(res.pct * 100).toFixed(1)}% of pixels changed, ` +
            `out ${res.outW}x${res.outH}`);
