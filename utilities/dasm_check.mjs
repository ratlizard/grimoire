#!/usr/bin/env node
// The classic-Mac resource decoders in js/mac-rsrc-types.js held to
// resource_dasm, resource by resource.
//
//   node utilities/dasm_check.mjs index.html <resource_dasm> <out-dir> <fork.rsrc>...
//   node utilities/dasm_check.mjs --control index.html <resource_dasm> <out-dir> <fork.rsrc>...
//
// Why this exists. In grimoire's guide the mac-* tier has no oracle: a
// snapshot (rsrc_snapshot.mjs) proves a decoder unchanged, never right, and the
// two second opinions the guide names, the retired port and systemless, read
// only some of these formats. resource_dasm (fuzziqersoftware, MIT,
// https://github.com/fuzziqersoftware/resource_dasm) is a C++ decoder of
// nearly every classic resource type, written with no knowledge of this one.
// Where the two match on a resource of the game's, both are likely right; where
// they differ, one of them is wrong in a way worth reading. It is not built
// here: the check runs the project's macOS release, and skips when the
// program is not found, as the unar checks do. The workspace has it at
// ~/e-z-g-cythera/resource_dasm-bin/ (DISK.md).
//
// What is compared is what the page exports, not what a decoder returns:
// exportArtifacts() is the one function behind the fork gallery's downloads,
// so a mask or a palette the page applies is applied here too. The first draft
// called the icon decoders directly, without the mask the page passes, and
// reported 230 transparency differences that a visitor never sees.
//
// Per kind:
//   pictures, icons, cursors and patterns: resource_dasm's BMP against the
//     page's canvas, pixel by pixel. A color channel one step out of 255 is
//     counted apart and allowed: resource_dasm turns QuickDraw's 16-bit
//     channels into 8 bits by dividing by 257 and dropping the remainder
//     (RGBColor::as8), and the page's value is the high byte, as QuickDraw's
//     is on a direct-color screen; 0x8000 is 127 to one and 128 to the other.
//     A transparent pixel's color is not compared.
//   4-bit icons (icl4, ics4): the two programs have different 16-color
//     tables. The page's is Apple's, entry for entry: it is the clut with
//     seed 4 in the Mac II, IIx, IIfx and Power Macintosh 6100 to G3 ROMs in
//     infinite-mac/src/Data/, read on 25 October 2026. resource_dasm's
//     (DEFAULT_ICON_COLOR_TABLE_4BIT) is a rounder approximation of it, 996633
//     for 90713A. So each pixel is turned back into its index in the table of
//     the program that drew it, and the indices are compared.
//   color tables: each entry against resource_dasm's .act, within one step.
//   bitmap fonts: each glyph's image against resource_dasm's glyph BMP, pixel
//     by pixel, a dark opaque pixel counted as ink and any other as paper.
//   sounds: the WAV's format and its sample bytes.
//   strings (STR#, STR , TEXT): the text, with resource_dasm's line ends
//     turned back into the Mac's carriage returns.
//
// What it cannot see: a type resource_dasm writes only as raw bytes (.bin) or
// as a text listing of its design (DITL, MENU, CODE and the rest) is not
// compared, and a resource neither program decodes is counted as "neither"
// and passes.
//
// The negative control (--control) changes one thing on grimoire's side of
// the first resource of each kind, a pixel, an entry, an ink bit, a sample
// byte or a character, and fails unless every changed resource is reported.

import { readFileSync, readdirSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, join } from 'node:path';
import vm from 'node:vm';
import { pageSource } from './page_scripts.mjs';
import { makeSandbox } from './dom_stub.mjs';

const args = process.argv.slice(2);
const CONTROL = args[0] === '--control';
if (CONTROL) args.shift();
const [htmlPath, dasm, outRoot, ...forkPaths] = args;
if (!htmlPath || !dasm || !outRoot || !forkPaths.length) {
  console.error('usage: dasm_check.mjs [--control] <page.html> <resource_dasm> <out-dir> <fork.rsrc>...');
  process.exit(2);
}
if (!existsSync(dasm)) { console.log(`resource_dasm: skipped, ${dasm} not found`); process.exit(0); }

const { sandbox: G } = makeSandbox();
const ctx = vm.createContext(G);
new vm.Script(pageSource(htmlPath) + '\n;window.__peek = n => eval(n);\n',
              { filename: htmlPath }).runInContext(ctx);
const peek = n => ctx.__peek(n);
const MAC_4BIT_PAL = peek('MAC_4BIT_PAL');
const COLOR_TABLE_TYPES = peek('COLOR_TABLE_TYPES');

// resource_dasm's 16 colors, from src/QuickDrawDefaultColorTables.cc.
const DASM_4BIT = ['ffffff', 'ffff00', 'ff6600', 'dd0000', 'ff0099', '330099', '0000dd', '0099ff',
                   '00bb00', '006600', '663300', '996633', 'cccccc', '888888', '444444', '000000'];

// A BMP as resource_dasm writes it: 24-bit plain or 32-bit with bit fields,
// bottom-up unless the height is negative. Returns RGBA.
function readBmp(path) {
  const b = readFileSync(path);
  const off = b.readUInt32LE(10), hs = b.readUInt32LE(14);
  const w = b.readInt32LE(18), hRaw = b.readInt32LE(22), bpp = b.readUInt16LE(28);
  const h = Math.abs(hRaw), topDown = hRaw < 0;
  let masks = null;
  if (b.readUInt32LE(30) === 3) masks = [0, 1, 2, 3].map(i => b.readUInt32LE((hs >= 56 ? 54 : 14 + hs) + i * 4));
  const stride = Math.ceil(w * bpp / 32) * 4;
  const px = new Uint8Array(w * h * 4);
  const chan = (v, m) => { if (!m) return 255; let s = 0; while (!((m >>> s) & 1)) s++; return ((v & m) >>> s) & 255; };
  for (let y = 0; y < h; y++) {
    const row = off + (topDown ? y : h - 1 - y) * stride;
    for (let x = 0; x < w; x++) {
      const o = (y * w + x) * 4;
      if (bpp === 24) { px[o] = b[row + x * 3 + 2]; px[o + 1] = b[row + x * 3 + 1]; px[o + 2] = b[row + x * 3]; px[o + 3] = 255; }
      else if (bpp === 32) {
        const v = b.readUInt32LE(row + x * 4);
        if (masks) for (let c = 0; c < 4; c++) px[o + c] = chan(v, masks[c]);
        else { px[o] = (v >>> 16) & 255; px[o + 1] = (v >>> 8) & 255; px[o + 2] = v & 255; px[o + 3] = 255; }
      } else throw new Error(`${bpp}-bit BMP`);
    }
  }
  return { w, h, px };
}

// A WAV's format and its samples as numbers from -1 to 1. The page writes
// 8-bit unsigned or 16-bit signed PCM; resource_dasm writes 32-bit floats
// (format 3), each 8-bit sample u as (u - 128) / 128, so the two are compared
// as values, never as bytes.
function readWav(buf) {
  const b = Buffer.from(buf);
  let fmt = null, values = null;
  for (let p = 12; p + 8 <= b.length; ) {
    const id = b.toString('latin1', p, p + 4), len = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { tag: b.readUInt16LE(p + 8), channels: b.readUInt16LE(p + 10),
                               rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    if (id === 'data' && fmt) {
      const d = b.subarray(p + 8, p + 8 + len), n = Math.floor(len / (fmt.bits / 8));
      values = new Float64Array(n);
      for (let i = 0; i < n; i++) values[i] =
          fmt.tag === 3 ? d.readFloatLE(i * 4)
        : fmt.bits === 8 ? (d[i] - 128) / 128
        : d.readInt16LE(i * 2) / 32768;
    }
    p += 8 + len + (len & 1);
  }
  return { fmt, values };
}

// A resource_dasm file is <fork>_<type, trailing spaces dropped>_<id>, then
// the resource's name or a variant (_bitmap, _tiled, a cursor's hot spot, a
// glyph, a string's index), then the extension.
function dasmFiles(dir, prefix) {
  const by = new Map();
  for (const f of readdirSync(dir)) {
    if (!f.startsWith(prefix + '_')) continue;
    const m = /^(.{1,4}?)_(-?\d+)(.*)\.(\w+)$/.exec(f.slice(prefix.length + 1));
    if (!m) continue;
    const key = `${m[1]}#${m[2]}`;
    if (!by.has(key)) by.set(key, []);
    by.get(key).push({ file: join(dir, f), rest: m[3], ext: m[4] });
  }
  return by;
}

const IMAGE_TYPES = new Set(['PICT', 'cicn', 'crsr', 'CURS', 'ppat', 'PAT ', 'ICN#', 'ics#', 'ICON',
                             'icl4', 'icl8', 'ics4', 'ics8']);
const FOUR_BIT = new Set(['icl4', 'ics4']);
const kindOf = t => IMAGE_TYPES.has(t) ? 'image' : COLOR_TABLE_TYPES[t] ? 'clut'
  : (t === 'NFNT' || t === 'FONT') ? 'font' : t === 'snd ' ? 'sound'
  : (t === 'STR#' || t === 'STR ' || t === 'TEXT') ? 'text' : null;

const hex = (p, i) => [p[i], p[i + 1], p[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('');

// Each compare returns null for a match, or a sentence with where the two
// first part. `steps` counts the channels allowed one step.
function compareImage(type, ours, theirs, tally, mutate) {
  const op = new Uint8Array(ours._px.data);
  if (mutate) { op[0] ^= 0x80; op[3] = 255; }
  if (ours.width !== theirs.w || ours.height !== theirs.h) return `grimoire ${ours.width}x${ours.height}, resource_dasm ${theirs.w}x${theirs.h}`;
  const tp = theirs.px, n = op.length / 4;
  const ourIdx = FOUR_BIT.has(type) && new Map(MAC_4BIT_PAL.map((c, i) => [c.map(v => v.toString(16).padStart(2, '0')).join(''), i]));
  const theirIdx = FOUR_BIT.has(type) && new Map(DASM_4BIT.map((c, i) => [c, i]));
  let bad = 0, first = -1;
  for (let i = 0; i < op.length; i += 4) {
    const oa = op[i + 3] !== 0, ta = tp[i + 3] !== 0;
    let ok = oa === ta;
    if (ok && oa) {
      if (ourIdx) ok = ourIdx.has(hex(op, i)) && ourIdx.get(hex(op, i)) === theirIdx.get(hex(tp, i));
      else for (let c = 0; c < 3; c++) {
        const d = Math.abs(op[i + c] - tp[i + c]);
        if (d === 1) tally.steps++; else if (d) ok = false;
      }
    }
    if (!ok) { bad++; if (first < 0) first = i; }
  }
  if (!bad) return null;
  return `${bad} of ${n} pixels, the first at (${(first / 4) % ours.width},${Math.floor(first / 4 / ours.width)}) ` +
         `grimoire ${hex(op, first)} alpha ${op[first + 3]}, resource_dasm ${hex(tp, first)} alpha ${tp[first + 3]}`;
}

function compareClut(pal, act, tally, mutate) {
  const p = pal.map(c => c.slice());
  if (mutate) p[0][0] ^= 0x80;
  for (let i = 0; i < p.length; i++) for (let c = 0; c < 3; c++) {
    const d = Math.abs(p[i][c] - act[i * 3 + c]);
    if (d === 1) tally.steps++;
    else if (d) return `entry ${i} grimoire ${p[i].join(',')}, resource_dasm ${[...act.subarray(i * 3, i * 3 + 3)].join(',')}`;
  }
  return null;
}

const inkOf = (px, i) => px[i + 3] !== 0 && px[i] + px[i + 1] + px[i + 2] < 384;

// The page exports a glyph's bare image, its columns of the strike. resource_dasm
// draws the image at its offset inside the character's cell, so its BMP can be
// wider: glyph 41 of NFNT 25740 is 11 columns at offset 1, a 12-wide BMP. The
// glyph matches when, at some shift, every ink pixel of the page's image is ink
// in resource_dasm's and resource_dasm's has no other ink.
//
// resource_dasm's cell is the character's advance plus its offset, and the
// bitmap is copied into it whatever its width (decode_NFNT, ResourceFile.cc), so
// an image wider than the cell loses its right-hand columns: glyph 52, R, is 9
// columns with an advance of 8 in NFNT 25740 and 14 with 12 in 25746, and the
// columns cut off have the bowl's ink in them. Such a glyph is compared on the
// columns resource_dasm kept and reported as a known difference.
function compareGlyph(ours, theirs, mutate) {
  const op = new Uint8Array(ours._px.data);
  if (mutate) op.set(inkOf(op, 0) ? [255, 255, 255, 255] : [0, 0, 0, 255], 0);
  const w = ours.width, h = ours.height, cut = Math.max(0, w - theirs.w), kept = w - cut;
  if (h !== theirs.h) return `grimoire ${w}x${h}, resource_dasm ${theirs.w}x${theirs.h}`;
  let theirInk = 0;
  for (let i = 0; i < theirs.px.length; i += 4) if (inkOf(theirs.px, i)) theirInk++;
  for (let dx = 0; dx <= theirs.w - kept; dx++) {
    let ok = true, ink = 0;
    for (let y = 0; y < h && ok; y++) for (let x = 0; x < kept; x++) {
      const a = inkOf(op, (y * w + x) * 4), b = inkOf(theirs.px, (y * theirs.w + x + dx) * 4);
      if (a !== b) { ok = false; break; }
      if (a) ink++;
    }
    if (ok && ink === theirInk)
      return cut ? { known: `${w} columns wide, the last ${cut} cut off by resource_dasm` } : null;
  }
  return `no shift of the ${w}x${h} image matches resource_dasm's ${theirs.w}x${theirs.h}`;
}

// Differences read and explained, each with the program at fault. A known
// difference is printed and passes; one that stops appearing is reported, so
// a fix on either side is noticed and the entry removed.
const KNOWN_ALONE = {
  // An mctb is not a color table. Inside Macintosh: Macintosh Toolbox
  // Essentials, figures 3-40 and 3-41 (pages 3-156 and 3-157): a count, then
  // menu color entries of a menu id, an item number and four RGB colors, and
  // the game's has 30-byte entries, the two bytes after the colors being
  // MCEntry's mctReserved; the last has menu id -99. systemless reads it the
  // same way (compiled_menu_color_entries in its menu_manager.rs, 30-byte
  // records). COLOR_TABLE_TYPES lists it with the clut family, so the page
  // draws its bytes as color swatches. resource_dasm writes it raw. The fault
  // is grimoire's.
  'mctb': 'grimoire reads a menu color table as a color table, and resource_dasm writes it raw',
};

// resource_dasm writes a string's carriage returns as line feeds.
const theirText = f => readFileSync(f, 'utf8').replace(/\n/g, '\r');

let failures = 0, controlMissed = 0, compared = 0, matched = 0, knownCount = 0, steps = 0;
const notes = [], knownSeen = new Set();
for (const forkPath of forkPaths) {
  const name = basename(forkPath);
  const out = join(outRoot, name);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });
  execFileSync(dasm, ['--data-fork', forkPath, out], { stdio: 'ignore' });
  const files = dasmFiles(out, name);
  const fork = G.openResourceFork(new Uint8Array(readFileSync(forkPath)));
  const mutated = new Set();
  for (const type of Object.keys(fork.resourcesByType).sort()) {
    const kind = kindOf(type);
    if (!kind) continue;
    const tally = { same: 0, known: 0, differ: 0, onlyOurs: 0, onlyTheirs: 0, neither: 0, steps: 0 };
    for (const entry of fork.resourcesByType[type]) {
      const label = `${name} ${type.trimEnd()} ${entry.id}`;
      const data = fork.dataOf(type, entry);
      const mine = (files.get(`${type.trimEnd()}#${entry.id}`) || []);
      const mutate = CONTROL && !mutated.has(kind);
      let arts = [];
      try { arts = G.exportArtifacts(fork, type, entry, data); } catch (e) { arts = []; }
      let verdict;           // null for a match, a sentence for a difference, or 'onlyOurs', 'onlyTheirs', 'neither'
      if (kind === 'image') {
        const ours = (arts.find(a => a.canvas && !a.tag) || arts.find(a => a.canvas) || {}).canvas;
        const cand = mine.filter(c => c.ext === 'bmp' && !/_bitmap|_tiled/.test(c.rest))
                         .sort((a, b) => a.rest.length - b.rest.length)[0];
        verdict = !ours && !cand ? 'neither' : !cand ? 'onlyOurs' : !ours ? 'onlyTheirs'
          : compareImage(type, ours, readBmp(cand.file), tally, mutate);
      } else if (kind === 'clut') {
        let pal = null; try { pal = G.readColorTable(data, 0).palette; } catch (e) { pal = null; }
        const act = mine.find(c => c.ext === 'act');
        verdict = !pal && !act ? 'neither' : !act ? 'onlyOurs' : !pal ? 'onlyTheirs'
          : compareClut(pal, readFileSync(act.file), tally, mutate);
      } else if (kind === 'font') {
        const glyphs = arts.filter(a => a.canvas && /^char\d+$|^missing$/.test(a.tag || ''));
        const theirs = new Map(mine.filter(c => c.ext === 'bmp' && /^_glyph_/.test(c.rest))
                                   .map(c => [c.rest.slice(7), c.file]));
        if (!glyphs.length && !theirs.size) verdict = 'neither';
        else if (!theirs.size) verdict = 'onlyOurs';
        else if (!glyphs.length) verdict = 'onlyTheirs';
        else {
          verdict = null;
          const seen = new Set(), known = [];
          for (const [i, g] of glyphs.entries()) {
            const key = g.tag === 'missing' ? 'missing' : (+g.tag.slice(4)).toString(16).toUpperCase().padStart(2, '0');
            seen.add(key);
            if (!theirs.has(key)) { verdict = `glyph ${key} in grimoire alone`; break; }
            const d = compareGlyph(g.canvas, readBmp(theirs.get(key)), mutate && i === 0);
            if (d && d.known) known.push(`glyph ${key}, ${d.known}`);
            else if (d) { verdict = `glyph ${key}: ${d}`; break; }
          }
          // A character with an advance and no image (the tab, 09) is a blank
          // cell to resource_dasm and nothing to the page, which exports images.
          if (!verdict) for (const [k, f] of theirs) if (!seen.has(k)) {
            const t = readBmp(f);
            let ink = false; for (let i = 0; i < t.px.length && !ink; i += 4) ink = inkOf(t.px, i);
            if (ink) { verdict = `glyph ${k} in resource_dasm alone`; break; }
          }
          if (!verdict && known.length) verdict = { known: known.join('; ') };
        }
      } else if (kind === 'sound') {
        const art = arts.find(a => a.blob);
        const wav = mine.find(c => c.ext === 'wav');
        if (!art && !wav) verdict = 'neither';
        else if (!wav) verdict = 'onlyOurs';
        else if (!art) verdict = 'onlyTheirs';
        else {
          const o = readWav(await art.blob.arrayBuffer()), t = readWav(readFileSync(wav.file));
          if (mutate) o.values[0] = o.values[0] + 0.5;
          // The rate is a 16.16 fixed-point number in the resource: 22254.54 Hz
          // is 22255 to the page, which rounds, and 22254 to resource_dasm.
          if (o.fmt.channels !== t.fmt.channels || Math.abs(o.fmt.rate - t.fmt.rate) > 1)
            verdict = `grimoire ${o.fmt.channels} channels at ${o.fmt.rate} Hz, resource_dasm ${t.fmt.channels} at ${t.fmt.rate} Hz`;
          else {
            let i = 0; while (i < o.values.length && o.values[i] === t.values[i]) i++;
            verdict = i === o.values.length && i === t.values.length ? null
              : `grimoire ${o.values.length} samples, resource_dasm ${t.values.length}, the first unlike at ${i}`;
          }
        }
      } else {
        let strs = null;
        try { strs = type === 'STR#' ? G.decodeSTRList(data) : [type === 'STR ' ? G.decodeSTR(data) : G.decodeTEXT(data)]; }
        catch (e) { strs = null; }
        const txt = mine.filter(c => c.ext === 'txt');
        let theirs = null;
        // The file of a named list's string has the name before the index (STR#_9304_Tests_2).
        if (txt.length) theirs = type === 'STR#'
          ? txt.map(c => [+/_(\d+)$/.exec(c.rest)[1], c.file]).sort((a, b) => a[0] - b[0]).map(([, f]) => theirText(f))
          : [theirText(txt[0].file)];
        if (strs && mutate && strs.length) strs[0] = strs[0] + 'x';
        if (!strs && !theirs) verdict = 'neither';
        else if (!theirs) verdict = strs.every(s => !s) ? null : 'onlyOurs';
        else if (!strs) verdict = 'onlyTheirs';
        else if (strs.length !== theirs.length) verdict = `grimoire ${strs.length} strings, resource_dasm ${theirs.length}`;
        else {
          verdict = null;
          for (let i = 0; i < theirs.length; i++) if (strs[i] !== theirs[i]) {
            verdict = `string ${i} grimoire ${JSON.stringify(strs[i]).slice(0, 60)}, resource_dasm ${JSON.stringify(theirs[i]).slice(0, 60)}`; break;
          }
        }
      }
      if (verdict === 'onlyOurs' && KNOWN_ALONE[type]) { verdict = { known: KNOWN_ALONE[type] }; knownSeen.add(type); }
      const isKnown = verdict && typeof verdict === 'object';
      if (mutate && verdict !== 'neither' && verdict !== 'onlyOurs' && verdict !== 'onlyTheirs' && !isKnown) {
        mutated.add(kind);
        if (verdict === null) { controlMissed++; console.log(`  control not caught: ${label}`); }
        else console.log(`  control caught: ${label}: ${verdict}`);
        continue;
      }
      if (verdict === null) { tally.same++; continue; }
      if (verdict === 'neither') { tally.neither++; continue; }
      if (isKnown) { tally.known++; notes.push(`  ${label}: known, ${verdict.known}`); continue; }
      if (verdict === 'onlyOurs' || verdict === 'onlyTheirs') {
        tally[verdict]++; notes.push(`  ${label}: decoded by ${verdict === 'onlyOurs' ? 'grimoire' : 'resource_dasm'} alone`); continue;
      }
      tally.differ++; notes.push(`  ${label}: ${verdict}`);
    }
    compared += tally.same + tally.known + tally.differ + tally.onlyOurs + tally.onlyTheirs;
    matched += tally.same; knownCount += tally.known; steps += tally.steps;
    failures += tally.differ + tally.onlyOurs + tally.onlyTheirs;
    if (!CONTROL)
      console.log(`${name} ${type.trimEnd()}: ${tally.same} match, ${tally.known} known, ${tally.differ} differ, ` +
                  `${tally.onlyOurs} grimoire alone, ${tally.onlyTheirs} resource_dasm alone, ${tally.neither} neither` +
                  (tally.steps ? `, ${tally.steps} channels one step apart` : ''));
  }
}
if (CONTROL) {
  console.log(controlMissed ? `resource_dasm control: ${controlMissed} changes not caught` : 'resource_dasm control: every change caught');
  process.exit(controlMissed ? 1 : 0);
}
for (const t of Object.keys(KNOWN_ALONE)) if (!knownSeen.has(t)) {
  failures++; notes.push(`  the known difference for ${t} did not appear, so remove it from KNOWN_ALONE if it is fixed`);
}
for (const n of notes) console.log(n);
console.log(`resource_dasm: ${compared} resources compared, ${matched} match, ${knownCount} known differences, ` +
            `${compared - matched - knownCount} other differences, ${steps} channels one step apart`);
process.exit(failures ? 1 : 0);
