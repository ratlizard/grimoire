#!/usr/bin/env node
/* artpack_check.mjs -- the art pack's reader and matcher (js/delv-artpack.js).
 *
 *   node utilities/artpack_check.mjs index.html <pack zip> <Cythera Data data fork>
 *
 * Make a Scenario can take every picture from a zip of 32 by 32 PNGs the
 * visitor supplies, matched to the game's names. Three things can be wrong
 * with nothing on the page saying so: a PNG decoded to the wrong pixels, a
 * name sent to the wrong file, and a tile left as the drawing the pack was
 * meant to replace.
 *
 * THE DECODER has no second implementation in stock Node, so it is held
 * two ways. A PNG written here with node:zlib, in each colour type the
 * decoder reads and interlaced, must come back as the pixels it was made
 * from; and every picture of the pack is decoded and the lot hashed, the
 * hash pinned below. That hash was reached on 8 October 2026 with all
 * 6,029 pictures compared one by one with Pillow's decode of the same
 * files, none differing; it proves the decoder unchanged, and the day's
 * comparison is what says it was right. Before interlace was read, 73 of
 * the pack's pictures (the doors among them) would not decode and their
 * tiles were quietly left as blobs, which is the fault this file is for.
 *
 * THE MATCHER: a handful of names whose file is not in doubt, one name the
 * pack cannot answer, which must take a stand-in and say so, and the same
 * stand-in twice.
 *
 * THE BUILD: a scenario made with the pack must give every tile sheet
 * back at its size, the hero a picture that is neither the old one nor the
 * stick man, and no tile the pack was asked for left to the drawing.
 *
 * Skips when the pack or the scenario is not on the disk. */
import {readFileSync, existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {deflateSync, crc32} from 'node:zlib';
import vm from 'node:vm';
import {pageSource} from './page_scripts.mjs';
import {makeSandbox} from './dom_stub.mjs';

const [htmlPath, packPath, dataPath] = process.argv.slice(2);
for (const [what, p] of [['the art pack', packPath], ['the scenario', dataPath]])
  if (!p || !existsSync(p)) { console.log(`  skip: ${what} is not at ${p}`); process.exit(0); }
const PACK_PIXELS = '1dc09d1bb1956dcc';   // the header says how it was reached
let failures = 0;
const fail = m => { failures++; console.log('  FAIL ' + m); };
const {sandbox} = makeSandbox();
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath) + '\n;window.__peek = n => eval(n);', {filename: htmlPath}).runInContext(ctx);

// ---- PNGs made here -------------------------------------------------------
const chunk = (t, d) => { const b = Buffer.alloc(12 + d.length); b.writeUInt32BE(d.length, 0); b.write(t, 4); d.copy(b, 8); b.writeUInt32BE(crc32(b.subarray(4, 8 + d.length)), 8 + d.length); return b; };
function png(W, H, type, depth, rows, extra, lace) {
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = depth; ih[9] = type; ih[12] = lace ? 1 : 0;
  return new Uint8Array(Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), ...(extra || []), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]));
}
const W = 5, H = 3, want = new Uint8Array(W * H * 4);
for (let i = 0; i < W * H; i++) want.set([i * 16 & 255, 255 - i * 9, i * 5 & 255, i % 4 ? 255 : 0], i * 4);
const row = (y, per) => Buffer.from([0, ...Array.from({length: W}, (_, x) => per(y * W + x)).flat()]);
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const made = {
  'RGBA': [png(W, H, 6, 8, Array.from({length: H}, (_, y) => row(y, i => Array.from(want.subarray(i * 4, i * 4 + 4))))), want],
  'RGB': [png(W, H, 2, 8, Array.from({length: H}, (_, y) => row(y, i => Array.from(want.subarray(i * 4, i * 4 + 3))))), want.map((v, i) => i % 4 === 3 ? 255 : v)],
  'palette with tRNS': [png(W, H, 3, 8, Array.from({length: H}, (_, y) => row(y, i => [i])),
    [chunk('PLTE', Buffer.from(Array.from({length: W * H}, (_, i) => Array.from(want.subarray(i * 4, i * 4 + 3))).flat())), chunk('tRNS', Buffer.from(Array.from({length: W * H}, (_, i) => want[i * 4 + 3])))]), want],
  'grey with alpha': [png(W, H, 4, 8, Array.from({length: H}, (_, y) => row(y, i => [want[i * 4], want[i * 4 + 3]]))), want.map((v, i) => i % 4 === 3 ? v : want[i - i % 4])]
};
// Interlaced: the same RGBA picture as Adam7's seven passes.
{
  const rows = [];
  for (const [x0, y0, dx, dy] of [[0, 0, 8, 8], [4, 0, 8, 8], [0, 4, 4, 8], [2, 0, 4, 4], [0, 2, 2, 4], [1, 0, 2, 2], [0, 1, 1, 2]])
    for (let y = y0; y < H; y += dy) { const px = []; for (let x = x0; x < W; x += dx) px.push(...want.subarray((y * W + x) * 4, (y * W + x) * 4 + 4)); if (px.length) rows.push(Buffer.from([0, ...px])); }
  made['interlaced RGBA'] = [png(W, H, 6, 8, rows, null, true), want];
}
for (const [name, [bytes, pixels]] of Object.entries(made)) {
  try { const d = ctx.pngDecode(bytes); if (d.W !== W || d.H !== H || !same(Array.from(d.rgba), Array.from(pixels))) fail(`a ${name} PNG made here came back as other pixels`); }
  catch (e) { fail(`a ${name} PNG made here did not decode: ${e.message}`); }
}
// The control: a byte in the middle of the compressed stream changed must
// not come back the same (the last four are zlib's own checksum, which the
// decoder does not read, and changing one of those proved nothing).
{ const b = made.RGBA[0].slice(); b[49] ^= 0x55; let ok = false; try { ok = same(Array.from(ctx.pngDecode(b).rgba), Array.from(want)); } catch (e) { ok = false; } if (ok) fail('a damaged PNG decoded to the right pixels, so the comparison cannot fail'); }

// ---- the pack -------------------------------------------------------------
const pack = ctx.readArtPack(new Uint8Array(readFileSync(packPath)));
const hash = createHash('sha256');
let undecoded = 0, odd = 0;
for (const f of pack.files) {
  try { const d = ctx.pngDecode(ctx.zipFork(pack.zip, f.entry, 'data')); if (d.W !== 32 || d.H !== 32) odd++; hash.update(f.path).update(Buffer.from(d.rgba)); }
  catch (e) { undecoded++; }
}
const pixels = hash.digest('hex').slice(0, 16);
if (undecoded) fail(`${undecoded} of the pack's ${pack.files.length} pictures did not decode`);
if (process.env.ARTPACK_PIXELS !== 'print' && pixels !== PACK_PIXELS) fail(`the pack's pixels hash to ${pixels}, not the ${PACK_PIXELS} the header's comparison with Pillow reached`);

// ---- the matcher ----------------------------------------------------------
const pick = (kind, name, n) => { const c = ctx.artPackChoose(pack, kind, name, n || 0); return c ? {path: c.file.path.replace(/^[^/]*\//, '').replace(/\.png$/, ''), matched: c.matched} : null; };
for (const [kind, name, re] of [['person', 'ruffian', /^monster\/orc/], ['beast', 'wolflizard', /^monster\/animals\/(hound|wolf)$/], ['thing', 'oak door', /^dungeon\/doors\//], ['thing', 'dagger', /^item\/weapon\/.*dagger/], ['floor', 'grass', /^dungeon\/floor\/grass/], ['wall', 'brick wall', /^dungeon\/wall\/brick/]]) {
  const c = pick(kind, name);
  if (!c || !c.matched || !re.test(c.path)) fail(`"${name}" was sent to ${c && c.path}`);
}
const lost = pick('thing', 'zzyzx'), again = pick('thing', 'zzyzx');
if (!lost || lost.matched || !/^item\//.test(lost.path) || lost.path !== again.path) fail('a name the pack cannot answer did not take one stand-in from the items and keep it: ' + JSON.stringify([lost, again]));

// ---- the build ------------------------------------------------------------
ctx.parseArchiveBytes(new Uint8Array(readFileSync(dataPath)), 'Cythera Data', {via: 'data fork'});
const ask = {name: 'Crawl Field', width: 24, height: 20, x: 10, y: 12, badArt: true};
const drawn = ctx.delverArchiveSpec(new Uint8Array(ctx.newScenarioBytes(ask)));
const report = {};
const fromPack = ctx.redrawDelverArt(new Uint8Array(ctx.newScenarioBytes(Object.assign({}, ask, {badArt: false}))), ctx.scenarioFigureTiles(), ctx.scenarioPackArt(pack, report));
const packed = ctx.delverArchiveSpec(fromPack.bytes), parc = ctx.openDelverArchive(fromPack.bytes);
const before = ctx.delverArchiveSpec(new Uint8Array(readFileSync(dataPath)));
const of = (sp, rid) => (sp.resources.find(r => r.resid === rid) || {}).data;
const fig = ctx.scenarioFigureTiles(), heroTile = +Object.keys(fig).find(t => fig[t].kind === 'hero'), sheet = 0x8E00 + (heroTile >> 4);
const tileOf = (sp, arc) => ctx.decodeResource(arc, of(sp, sheet), 141, sheet).image.slice((heroTile & 15) * 1024, (heroTile & 15) * 1024 + 1024);
const hOld = tileOf(before, ctx.openDelverArchive(new Uint8Array(readFileSync(dataPath)))), hDrawn = tileOf(drawn, ctx.openDelverArchive(ctx.writeDelverArchive(drawn))), hPack = tileOf(packed, parc);
let sheets = 0, sized = 0;
for (const r of packed.resources) if ((r.resid >> 8) === 0x8E) { sheets++; try { const d = ctx.decodeResource(parc, r.data, 141, r.resid); if (d.image.length === d.W * d.H) sized++; } catch (e) { /* counted as unsized */ } }
const matched = (report.matched || new Set()).size, stood = (report['stood in'] || new Set()).size;
if (same(Array.from(hPack), Array.from(hOld)) || same(Array.from(hPack), Array.from(hDrawn)) || new Set(hPack).size < 6) fail('the hero’s tile is the old picture or the stick man, not the pack’s');
if (!sheets || sized !== sheets) fail(`${sheets - sized} of ${sheets} tile sheets did not come back at their size`);
if (!matched || matched < stood) fail(`the pack answered ${matched} names and stood in for ${stood}`);
if (process.env.ARTPACK_PIXELS === 'print') console.log('  pixels ' + pixels);
console.log(failures ? `\nFAIL — ${failures} problem(s)` : `\nart pack: ${pack.files.length} pictures decoded, PIXELS ${pixels}; five kinds of PNG made here read back and a damaged one caught; ${matched} of the game's names answered by the pack and ${stood} given stand-ins; ${sheets} tile sheets rebuilt`);
process.exit(failures ? 1 : 0);
