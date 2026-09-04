#!/usr/bin/env node
// Does the PICT decoder draw BitsRect and BitsRgn?
//
//   node utilities/pict_bits_check.mjs index.html
//
// 0x0090 and 0x0091 are the uncompressed 1-bit bitmap opcodes. The decoder
// walked past them for alignment and drew only the first PACKED image opcode
// it found, so a picture whose artwork is a plain BitsRect came out blank
// while systemless (src/trap/pict.rs, parse_bits_rect) and alchemy/port
// (src/mac/pict.cpp) both rendered it.
//
// This check is synthetic on purpose. Not one of the twenty-one PICTs in
// Cythera and Cythera Data uses these opcodes -- they are all 0x0098, 0x0099
// or 0x009B -- so no snapshot over the game's own resources can prove the
// path works or notice if it breaks. The viewer opens any Mac resource fork
// dropped on it, not only Cythera's, which is why the opcodes are worth
// supporting at all.
//
// The header is identical to the 1-bit BitMap form of 0x0098: rowBytes,
// bounds, srcRect, dstRect, mode. The only difference is that the rows are
// stored unpacked, which is what this builds.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { makeSandbox } from './dom_stub.mjs';
import { pageSource } from './page_scripts.mjs';

const [htmlPath = 'index.html'] = process.argv.slice(2);
let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };

const { sandbox } = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), { filename: htmlPath }).runInContext(ctx);

// A version-2 picture holding one uncompressed 1-bit bitmap: 16x8, rowBytes
// 2, one set bit per row stepping two pixels right each time. Set bit =
// black, so the expected image is a diagonal.
const W = 16, H = 8, ROW = 2;
function build(opcode) {
  const body = [];
  const u16 = v => { body.push((v >> 8) & 0xff, v & 0xff); };
  u16(0x0011); u16(0x02FF);                     // version 2
  u16(opcode);
  u16(ROW);
  u16(0); u16(0); u16(H); u16(W);               // bounds
  u16(0); u16(0); u16(H); u16(W);               // srcRect
  u16(0); u16(0); u16(H); u16(W);               // dstRect
  u16(0);                                       // mode
  if (opcode === 0x0091) { u16(2); }            // an empty region: just its size
  for (let y = 0; y < H; y++) u16(0x8000 >>> (y * 2));
  u16(0x00FF);                                  // end of picture
  const head = [];
  const h16 = v => { head.push((v >> 8) & 0xff, v & 0xff); };
  h16(body.length + 10); h16(0); h16(0); h16(H); h16(W);
  return new Uint8Array([...head, ...body]);
}

for (const [opcode, label] of [[0x0090, 'BitsRect'], [0x0091, 'BitsRgn']]) {
  sandbox.__pict = build(opcode);
  let got;
  try {
    got = vm.runInContext(`(() => {
      const found = findPictImageOpcode(__pict);
      if (!found) return { err: 'no image opcode found' };
      const r = decodePictPackBits(__pict, found);
      const px = r.canvas.getContext('2d').getImageData(0, 0, r.width, r.height).data;
      const dark = [];
      for (let y = 0; y < r.height; y++) {
        const row = [];
        for (let x = 0; x < r.width; x++) row.push(px[(y * r.width + x) * 4] < 128 ? 1 : 0);
        dark.push(row);
      }
      return { op: found.op, width: r.width, height: r.height, pixelSize: r.pixelSize, dark };
    })()`, ctx);
  } catch (e) {
    fail(label, `decoding threw: ${e.message}`);
    continue;
  }
  if (got.err) { fail(label, got.err); continue; }
  if (got.op !== opcode) fail(label, `walked to 0x${got.op.toString(16)} instead of 0x${opcode.toString(16)}`);
  if (got.width !== W || got.height !== H) fail(label, `got ${got.width}x${got.height}, wanted ${W}x${H}`);
  if (got.pixelSize !== 1) fail(label, `pixelSize ${got.pixelSize}, wanted 1`);
  // Exactly one black pixel per row, marching two to the right each row.
  for (let y = 0; y < H; y++) {
    const on = (got.dark[y] || []).reduce((a, v, x) => v ? a.concat(x) : a, []);
    if (on.length !== 1 || on[0] !== y * 2)
      fail(label, `row ${y} has black at [${on}], wanted [${y * 2}] -- a set bit must be black and rows must not be packed`);
  }
}

if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
console.log('BitsRect and BitsRgn decoded, 2 synthetic pictures');
