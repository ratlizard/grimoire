#!/usr/bin/env node
// Checks writeHfsImage -- the HFS disk-image writer explorer.html exports
// with -- two ways.
//
//   node utilities/hfs_check.mjs explorer.html [systemless-checkout]
//
// FIRST, STRUCTURALLY, AND THAT HALF ALWAYS RUNS. The master directory block,
// the volume bitmap and the two B-trees are all read back and audited against
// the arithmetic that produced them: does the allocation area fit inside the
// image, is every allocated block marked in the bitmap and no other, does the
// catalog's node count match its length, does every leaf record's key sort
// after the one before it, does the leaf chain reach every leaf, does every
// index record point at a node that exists and carry that node's first key.
//
// SECOND, BY ROUND TRIP, WHEN A systemless CHECKOUT IS THERE. `cargo run
// --example hfs_dump` in benletchford/systemless reads a disk image with an
// implementation written from the other side, and this compares what comes
// back -- every path, Finder type, creator, and both forks byte for byte --
// against what went in.
//
// The round trip is not an oracle in the sense delvmod is, and the header of
// js/mac-hfs.js says why: the writer was written FROM systemless's reader, so
// they share whatever that got wrong, and CLAUDE.md's rule is that a decoder
// ported from a project cannot cross-check it. What it does catch is the class
// of mistake that is actually likely here -- an offset written one field along,
// a fork placed at a block it does not own, a catalog that parses but omits a
// file -- and it catches it without a browser or an emulator.
//
// The check neither of these can be is "does a real Mac mount it", and that
// one was done by hand, in the emulator the retired mobile shell embedded. What it settled is
// recorded in js/mac-hfs.js: the index-record layout, which cost three volumes,
// and the desktop-file alert, which cost rather more and turned out not to be
// this writer's doing.

import {existsSync, mkdtempSync, writeFileSync, rmSync, readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {collectPageScripts} from './page_scripts.mjs';

const [pagePath = 'explorer.html', systemlessPath] = process.argv.slice(2);
if (!existsSync(pagePath)) { console.error('missing: ' + pagePath); process.exit(2); }

let failures = 0, passed = 0, roundTripped = 0;
// Every case runs the same twenty-odd assertions, so printing them all buries
// the one that matters. Failures are printed as they happen; passes are
// counted and summarised per volume.
const fail = (what, detail) => { failures++; console.log('  FAIL ' + what + (detail ? ' — ' + detail : '')); };
const ok = () => { passed++; };
const check = (cond, what, detail) => cond ? ok() : fail(what, detail);

// ---- the writer, as the page loads it --------------------------------------
// Only the two files the writer needs, not the whole page: this has no DOM to
// run in and wants none. That the page actually loads them is verify_viewer's
// job -- its check 4b fails on a name the JS calls and nothing declares, and
// downloadEditedDiskImage calls writeHfsImage.
const {sources} = collectPageScripts(pagePath);
const needed = ['js/mac-bytes.js', 'js/mac-hfs.js'];
for (const src of needed) {
  if (!sources.some(s => s.name === src)) {
    console.error(`${pagePath} does not load ${src}`);
    process.exit(2);
  }
}
const sandbox = {console, TextDecoder, TextEncoder, Date, Math, Uint8Array, Error,
                 String, Number, Set, Map, Array, JSON, isNaN, parseInt};
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const src of needed) {
  const s = sources.find(x => x.name === src);
  vm.runInContext(s.code, sandbox, {filename: src});
}
const peek = vm.runInContext('(n) => eval(n)', sandbox);
const writeHfsImage = peek('writeHfsImage');

// ---- an independent-enough reader for the structural half ------------------
const SECTOR = 512, NODE = 512;
const u16 = (b, i) => (b[i] << 8) | b[i + 1];
const u32 = (b, i) => ((b[i] * 0x1000000) + (b[i + 1] << 16) + (b[i + 2] << 8) + b[i + 3]) >>> 0;
const pstr = (b, i) => Array.from(b.subarray(i + 1, i + 1 + b[i]))
  .map(c => String.fromCharCode(c)).join('');

function nodeRecords(tree, number) {
  const at = number * NODE;
  const node = tree.subarray(at, at + NODE);
  const count = u16(node, 10);
  const recs = [];
  for (let i = 0; i < count; i++) {
    const start = u16(node, NODE - (i + 1) * 2);
    const end = u16(node, NODE - (i + 2) * 2);
    if (start < 14 || end > NODE || end < start) return null;
    recs.push(node.subarray(start, end));
  }
  return {kind: node[8], height: node[9], fLink: u32(node, 0), bLink: u32(node, 4), recs};
}

function catalogKey(rec) {
  const keyLen = rec[0];
  const nameLen = rec[6];
  return {
    keyLen, parent: u32(rec, 2),
    name: Array.from(rec.subarray(7, 7 + nameLen)).map(c => String.fromCharCode(c)).join(''),
    dataAt: (1 + keyLen + 1) & ~1,
  };
}

function audit(label, image, expected) {
  const say = (cond, what, detail) => check(cond, `${label}: ${what}`, detail);
  const mdb = image.subarray(1024, 1024 + 162);
  say(u16(mdb, 0) === 0x4244, 'HFS signature');
  const alBlkSize = u32(mdb, 20), blockCount = u16(mdb, 18), alBlSt = u16(mdb, 28);
  const freeBks = u16(mdb, 34), bitmapStart = u16(mdb, 14);
  say(alBlkSize % SECTOR === 0 && alBlkSize > 0, 'allocation block size', alBlkSize + ' bytes');
  say(bitmapStart === 3, 'volume bitmap starts at sector 3');
  const areaEnd = alBlSt * SECTOR + blockCount * alBlkSize;
  say(areaEnd + 2 * SECTOR <= image.length,
      'allocation area fits, with room for the alternate MDB',
      `${areaEnd} + 1024 <= ${image.length}`);
  say(pstr(mdb, 36) === expected.volumeName, 'volume name', pstr(mdb, 36));

  // The alternate MDB at the end must be the same block.
  const alt = image.subarray(image.length - 2 * SECTOR, image.length - 2 * SECTOR + 162);
  say(alt.every((b, i) => b === mdb[i]), 'alternate MDB matches the real one');

  const blockAt = n => alBlSt * SECTOR + n * alBlkSize;
  const catStart = u16(mdb, 150), catBlocks = u16(mdb, 152), catSize = u32(mdb, 146);
  const extStart = u16(mdb, 134), extBlocks = u16(mdb, 136), extSize = u32(mdb, 130);
  const catalog = image.subarray(blockAt(catStart), blockAt(catStart) + catSize);
  say(catSize % NODE === 0 && catSize > 0, 'catalog is a whole number of nodes', catSize + ' bytes');
  say(Math.ceil(catSize / alBlkSize) === catBlocks, 'catalog extent covers the catalog file');
  say(Math.ceil(extSize / alBlkSize) === extBlocks, 'extents extent covers the extents file');

  // Every allocated block marked once, and nothing else marked.
  const used = new Set();
  const claim = (from, blocks, who) => {
    for (let i = 0; i < blocks; i++) {
      if (used.has(from + i)) { fail(`${label}: block ${from + i} claimed twice`, who); return; }
      used.add(from + i);
    }
  };
  claim(extStart, extBlocks, 'extents file');
  claim(catStart, catBlocks, 'catalog file');

  // Walk the catalog: leaves via the chain, index nodes checked against them.
  const header = nodeRecords(catalog, 0);
  say(header && header.kind === 1, 'catalog node 0 is a header node');
  const h = catalog.subarray(14, 14 + 106);
  const nodeSize = u16(h, 18), nodeCount = u32(h, 22), freeNodes = u32(h, 26);
  const depth = u16(h, 0), root = u32(h, 2), nRecs = u32(h, 6);
  const firstLeaf = u32(h, 10), lastLeaf = u32(h, 14);
  say(nodeSize === NODE, 'catalog node size is 512', String(nodeSize));
  say(nodeCount === catSize / NODE, 'bthNNodes matches the file length',
      `${nodeCount} nodes, ${catSize / NODE} in the file`);
  say(u16(h, 20) === 37, 'catalog key length is 37');

  const leafKeys = [], leafNumbers = [];
  const files = new Map(), dirs = new Map();
  let seen = 0;
  for (let n = firstLeaf; n !== 0 && seen < nodeCount + 1; seen++) {
    const node = nodeRecords(catalog, n);
    if (!node) { fail(`${label}: leaf ${n} has a broken offset table`); break; }
    if (node.kind !== 0xFF) { fail(`${label}: node ${n} is in the leaf chain but is not a leaf`); break; }
    if (node.height !== 1) fail(`${label}: leaf ${n} has ndNHeight ${node.height}, expected 1`);
    leafNumbers.push(n);
    for (const rec of node.recs) {
      const key = catalogKey(rec);
      leafKeys.push(key);
      const data = rec.subarray(key.dataAt);
      if (data[0] === 1) dirs.set(u32(data, 6), key.name);
      else if (data[0] === 2) {
        files.set(key.name, {
          type: Array.from(data.subarray(4, 8)).map(c => String.fromCharCode(c)).join(''),
          dataLen: u32(data, 26), dataStart: u16(data, 74), dataBlocks: u16(data, 76),
          rsrcLen: u32(data, 36), rsrcStart: u16(data, 86), rsrcBlocks: u16(data, 88),
        });
      }
    }
    n = node.fLink;
  }
  say(leafNumbers.length > 0 && leafNumbers[leafNumbers.length - 1] === lastLeaf,
      'the leaf chain ends at bthLNode', leafNumbers.join('->'));
  say(leafKeys.length === nRecs, 'bthNRecs matches the records found',
      `${nRecs} declared, ${leafKeys.length} walked`);

  let sorted = true;
  for (let i = 1; i < leafKeys.length; i++) {
    const a = leafKeys[i - 1], b = leafKeys[i];
    const cmp = a.parent !== b.parent ? a.parent - b.parent
      : (a.name.toUpperCase() < b.name.toUpperCase() ? -1
        : a.name.toUpperCase() > b.name.toUpperCase() ? 1 : 0);
    if (cmp >= 0) { sorted = false; fail(`${label}: keys out of order`, `${a.parent}/${a.name} then ${b.parent}/${b.name}`); break; }
  }
  if (sorted) ok();

  // Index nodes: every pointer must reach a node that exists, and the key on
  // the pointer must be that node's first key. This is the part a real Mac
  // exercises and systemless's reader never does.
  const leafFirstKey = new Map();
  for (const n of leafNumbers) {
    const node = nodeRecords(catalog, n);
    if (node && node.recs.length) leafFirstKey.set(n, catalogKey(node.recs[0]));
  }
  let indexNodes = 0, indexRecords = 0, indexOk = true;
  for (let n = 1; n < nodeCount; n++) {
    const node = nodeRecords(catalog, n);
    // A spare node is all zeroes, and zero is also ndIndexNode -- so an index
    // node is one that is kind 0 AND says it holds records above the leaves.
    if (!node || node.kind !== 0 || node.recs.length === 0 || node.height < 2) continue;
    indexNodes++;
    for (const rec of node.recs) {
      indexRecords++;
      const key = catalogKey(rec);
      const child = u32(rec, key.dataAt);
      if (rec.length !== key.dataAt + 4) {
        indexOk = false;
        fail(`${label}: index record is ${rec.length} bytes, expected ${key.dataAt + 4}`);
        break;
      }
      if (child === 0 || child >= nodeCount) {
        indexOk = false; fail(`${label}: index record points at node ${child}`); break;
      }
      const target = leafFirstKey.get(child);
      const below = nodeRecords(catalog, child);
      const targetKey = target || (below && below.recs.length ? catalogKey(below.recs[0]) : null);
      if (!targetKey || targetKey.parent !== key.parent || targetKey.name !== key.name) {
        indexOk = false;
        fail(`${label}: index key ${key.parent}/${key.name} does not match node ${child}`);
        break;
      }
    }
  }
  if (indexOk) ok();
  say(depth === (indexNodes ? 2 : 1) || depth >= 1, 'bthDepth is set', String(depth));
  say(root >= 1 && root < nodeCount, 'bthRoot is a node in the file', String(root));
  say(freeNodes > 0, 'the catalog keeps spare nodes', freeNodes + ' free');

  // Forks: claim their blocks, and read the bytes back out of the image.
  for (const [name, f] of files) {
    if (f.dataBlocks) claim(f.dataStart, f.dataBlocks, name + ' data fork');
    if (f.rsrcBlocks) claim(f.rsrcStart, f.rsrcBlocks, name + ' resource fork');
  }
  const bitmap = image.subarray(3 * SECTOR);
  let bitmapOk = true;
  for (let i = 0; i < blockCount; i++) {
    const set = (bitmap[i >> 3] & (0x80 >> (i & 7))) !== 0;
    if (set !== used.has(i)) {
      bitmapOk = false;
      fail(`${label}: bitmap disagrees at block ${i}`, set ? 'marked but unclaimed' : 'claimed but unmarked');
      break;
    }
  }
  if (bitmapOk) ok();
  say(freeBks === blockCount - used.size, 'drFreeBks matches the bitmap',
      `${freeBks} vs ${blockCount - used.size}`);

  // What went in must be readable at the extents the catalog gives.
  let forksOk = true;
  for (const want of expected.files) {
    const got = files.get(want.name);
    if (!got) { forksOk = false; fail(`${label}: ${want.name} is not in the catalog`); continue; }
    if (got.type !== want.type) { forksOk = false; fail(`${label}: ${want.name} type ${got.type}`); }
    for (const [fork, len, start] of [['data', got.dataLen, got.dataStart],
                                      ['rsrc', got.rsrcLen, got.rsrcStart]]) {
      const source = fork === 'data' ? want.data : (want.rsrc || new Uint8Array(0));
      if (len !== source.length) {
        forksOk = false; fail(`${label}: ${want.name} ${fork} length ${len}, expected ${source.length}`); continue;
      }
      if (!len) continue;
      const at = blockAt(start);
      for (let i = 0; i < source.length; i++) {
        if (image[at + i] !== source[i]) {
          forksOk = false;
          fail(`${label}: ${want.name} ${fork} differs at byte ${i}`);
          break;
        }
      }
    }
  }
  if (forksOk) ok();
  say(dirs.size === 1 + expected.dirCount, 'directory records',
      `${dirs.size - 1} folder(s) plus the root`);
  console.log(`  ok   ${label} — ${(image.length / 1024).toFixed(0)}K volume, ` +
    `${files.size} file(s), ${dirs.size - 1} folder(s), ${nodeCount} catalog nodes ` +
    `(${leafNumbers.length} leaf, ${indexNodes} index)`);
  return {catalog, files};
}

// ---- the volumes to test ---------------------------------------------------
const enc = s => new Uint8Array(Array.from(s).map(c => c.charCodeAt(0) & 0xFF));
const ramp = n => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = (i * 37) & 0xFF; return b; };

const CASES = [
  {
    label: 'one file',
    volumeName: 'One File',
    dirCount: 0,
    entries: [{name: 'Read Me', type: 'TEXT', creator: 'ttxt', data: enc('hello\r'), rsrc: new Uint8Array(0)}],
  },
  {
    // The shape explorer.html exports: the archive with both forks, and a note.
    label: 'the export shape',
    volumeName: 'Cythera Export',
    dirCount: 0,
    entries: [
      {name: 'Cythera Data', type: 'DelS', creator: 'Delv', data: ramp(300000), rsrc: ramp(9000)},
      {name: 'Read Me', type: 'TEXT', creator: 'ttxt', data: enc('exported\r'), rsrc: new Uint8Array(0)},
    ],
  },
  {
    // Enough records to need more than one leaf, and therefore index nodes --
    // which is where the format actually got interesting.
    label: 'many files and a folder',
    volumeName: 'Many Files',
    dirCount: 1,
    entries: [
      ...Array.from({length: 14}, (_, i) => ({
        name: 'File ' + (i + 1), type: 'TEXT', creator: 'ttxt',
        data: enc('body of file ' + (i + 1) + '\r'), rsrc: i % 3 ? new Uint8Array(0) : ramp(700),
      })),
      {name: 'Extras', children: [
        {name: 'Addon', type: 'DelP', creator: 'Delv', data: enc('addon\r'), rsrc: new Uint8Array(0)},
      ]},
    ],
  },
  {
    // Empty forks, an empty folder, and names that need folding.
    label: 'edge cases',
    volumeName: 'Edges',
    dirCount: 1,
    entries: [
      {name: 'Empty', type: '????', creator: '????', data: new Uint8Array(0), rsrc: new Uint8Array(0)},
      {name: 'Rsrc Only', type: 'TEXT', creator: 'ttxt', data: new Uint8Array(0), rsrc: ramp(2000)},
      {name: 'Nothing In Here', children: []},
    ],
  },
];

const built = [];
for (const c of CASES) {
  const image = writeHfsImage({volumeName: c.volumeName, entries: c.entries, created: new Date(0)});
  const flat = [];
  const walk = es => { for (const e of es) e.children ? walk(e.children) : flat.push(e); };
  walk(c.entries);
  audit(c.label, image, {volumeName: c.volumeName, files: flat, dirCount: c.dirCount});
  built.push({...c, image, flat});
}

// A name with a colon in it cannot be an HFS name, and a name outside ASCII
// cannot be ordered by the comparison this writer uses. Both are folded rather
// than rejected; check they still land somewhere sane.
{
  const image = writeHfsImage({volumeName: 'Folded', entries: [
    {name: 'a:béc', type: 'TEXT', creator: 'ttxt', data: enc('x')},
    {name: '', type: 'TEXT', creator: 'ttxt', data: enc('y')},
  ]});
  const {files} = audit('folded names', image, {
    volumeName: 'Folded', dirCount: 0,
    files: [{name: 'a_b_c', type: 'TEXT', data: enc('x')}, {name: 'Untitled', type: 'TEXT', data: enc('y')}],
  });
  check(files.has('a_b_c') && files.has('Untitled'), 'folded names', [...files.keys()].join(', '));
}

// ---- the round trip through systemless -------------------------------------
const SYSTEMLESS = systemlessPath && existsSync(systemlessPath) ? systemlessPath : null;
if (!SYSTEMLESS) {
  console.log('  skip round trip — no systemless checkout given');
} else if (!existsSync(join(SYSTEMLESS, 'examples/hfs_dump.rs'))) {
  // The reader itself (src/disk_image/hfs.rs) is in every systemless
  // checkout; the example that dumps a volume as JSON is not -- it is
  // carried on the fork's cythera-detailed branch, so a checkout sitting on
  // master has the reader and no way to call it. Say which file is missing
  // and where it lives, rather than letting `cargo build --example hfs_dump`
  // fail and reporting the oracle as a build error.
  console.log('  skip round trip — no examples/hfs_dump.rs in ' + SYSTEMLESS
    + " (it is on e-z-g/systemless's cythera-detailed branch)");
} else {
  const bin = join(SYSTEMLESS, 'target/debug/examples/hfs_dump');
  try {
    if (!existsSync(bin)) {
      console.log('  building systemless\'s hfs_dump example (once) …');
      execFileSync('cargo', ['build', '--example', 'hfs_dump', '--no-default-features'],
        {cwd: SYSTEMLESS, stdio: 'ignore'});
    }
  } catch (e) {
    console.log('  skip round trip — cargo build failed: ' + (e.message || '').split('\n')[0]);
  }
  if (existsSync(bin)) {
    const dir = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'hfs-'));
    try {
      for (const c of built) {
        const path = join(dir, c.volumeName.replace(/\W+/g, '_') + '.dsk');
        writeFileSync(path, c.image);
        let dump;
        try {
          dump = JSON.parse(execFileSync(bin, [path], {maxBuffer: 256 << 20}).toString());
        } catch (e) {
          fail(`${c.label}: systemless could not read the image`, (e.message || '').split('\n')[0]);
          continue;
        }
        const hex = b => Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
        let same = dump.volumeName === c.volumeName && dump.files.length === c.flat.length;
        if (same) {
          for (const f of dump.files) {
            const leaf = f.path.split('/').pop();
            const want = c.flat.find(e => e.name === leaf);
            if (!want) { same = false; break; }
            if (f.type !== want.type || f.creator !== want.creator) { same = false; break; }
            if (f.data !== hex(want.data) || f.rsrc !== hex(want.rsrc || new Uint8Array(0))) { same = false; break; }
          }
        }
        check(same, `${c.label}: systemless reads back what went in`,
              `${dump.files.length} file(s), volume "${dump.volumeName}"`);
        if (!same) continue;
        roundTripped++;
        console.log(`  ok   ${c.label}: systemless read back ${dump.files.length} ` +
          `file(s) and ${dump.dirs.length - 1} folder(s), forks byte for byte`);
      }
    } finally {
      rmSync(dir, {recursive: true, force: true});
    }
  }
}

console.log(`  ${built.length + 1} volumes, ${passed} structural checks, ` +
  `${roundTripped} round-tripped through systemless`);
console.log(failures ? `  => ${failures} FAILED` : '  => all checks passed');
process.exit(failures ? 1 : 0);
