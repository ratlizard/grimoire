/* mac-stuffit.js -- read the table of contents of a StuffIt archive, take out
   the files that were stored, and decompress the one method that matters.
   =========================================================================

   Cythera's installer is mirrored as a StuffIt archive -- archive.org's
   `cythera.sit` and old.mac.gdn's `Cythera_Installer.sit` are StuffIt 5,
   Ambrosia's own `Cythera_1.0.4_Installer.sit` is the classic `SIT!`
   format -- and in every one of them the file that matters, the installer
   application's 6.8 MB data fork, is STORED: method 0, no compression at
   all. That is also true of the 28 MB four-in-one bundle the page's own
   gate downloads: all four installers' data forks in it are stored, and
   only their resource forks are compressed, which the page has no use for.
   So reading the catalog and handing back stored forks was enough for a
   long time, and this file did no more than that.

   **It decompresses method 13 as well since 15 September 2026**, because
   the patches section needs it. Every add-on the community released is
   inside a StuffIt archive, and the one Magpie patch that exists is a
   method-13 fork inside `614_MagpiePumpkinPatch.sit.hqx` -- so the page
   could list that archive and not open what was in it, and using the
   section meant unpacking the .sit on a desktop first. See the method 13
   section at the foot of this file for what it is and where it came from.
   It also opens Pandora's Box, and the STANDALONE `Cythera_1.0.1` and
   `1.0.2` installer archives, whose forks are method 13 where the bundle's
   are stored -- which is worth stating plainly, because an earlier version
   of this comment named those two versions in a way that read as though
   the page had never been able to reach them. It always could, through the
   bundle.

   Method 15 (Arsenic) is still not implemented and is the one left: the
   3D Cursors add-on, the I.M.Cheater saved game, and every resource fork
   in the bundle are Arsenic. It is documented in The Unarchiver's XADMaster
   and in benletchford/stuffit-rs if a page ever needs it.

   WHERE THE FORMAT CAME FROM

   Copied, as CLAUDE.md's licensing note allows for infrastructure with no
   oracle role: the two header layouts are those in `stuffit-rs` 0.1.5
   (Ben Letchford, MIT OR Apache-2.0), which in turn cites The Unarchiver's
   `XADStuffItParser.m` and `XADStuffIt5Parser.m`. Checked against the six
   archives above by `utilities/vise_check.mjs`: fork lengths as listed by
   `lsar`, and the stored data fork byte-identical to the one inside
   Bryce Schroeder's Cythera.bin.

   LOAD ORDER: after mac-bytes.js (u16be, u32be, fourcc, decodeMacRoman).
   A classic script, like the rest of js/: no import, no export, globals. */

const SIT5_SIGNATURE = 'StuffIt (c)199';        // the 80-byte banner starts so
const SIT_METHOD_NAMES = {
  0: 'stored', 1: 'RLE', 2: 'LZW', 3: 'Huffman', 5: 'LZAH', 6: 'fixed Huffman',
  8: 'MW', 13: 'LZ+Huffman', 14: 'Installer', 15: 'Arsenic'
};

function looksLikeStuffIt(bytes) {
  if (!bytes || bytes.length < 96) return false;
  if (fourcc(bytes, 0) === 'SIT!' && fourcc(bytes, 10) === 'rLau') return true;
  return latin1(bytes.subarray(0, SIT5_SIGNATURE.length)) === SIT5_SIGNATURE && bytes[82] === 5;
}

/* The catalog, with nothing decompressed. Returns
 *
 *   { format, entries: [{ path, name, isFolder, type, creator, finderFlags,
 *                         dataLen, dataPackedLen, dataMethod, dataOffset,
 *                         rsrcLen, rsrcPackedLen, rsrcMethod, rsrcOffset }] }
 *
 * where dataOffset / rsrcOffset are where each fork's bytes sit in the
 * archive, stored or not. */
function parseStuffItArchive(bytes) {
  if (!looksLikeStuffIt(bytes)) throw new Error('not a StuffIt archive');
  return fourcc(bytes, 0) === 'SIT!' ? parseStuffItClassic(bytes) : parseStuffIt5(bytes);
}

/* ---- SIT! (StuffIt 1.5.1 through 4) ------------------------------------
 * A 22-byte archive header, then 112-byte entry headers each followed by
 * that entry's resource fork bytes and then its data fork bytes. Folders
 * are entries whose method byte is 0x20 (start) or 0x21 (end). */
function parseStuffItClassic(bytes) {
  const total = Math.min(u32be(bytes, 6), bytes.length);
  const entries = [];
  const path = [];
  let at = 22;
  while (at + 112 <= total) {
    const h = bytes.subarray(at, at + 112);
    const rsrcMethodByte = h[0], dataMethodByte = h[1];
    const nameLen = Math.min(h[2], 31);
    const name = decodeMacRoman(h.subarray(3, 3 + nameLen));
    at += 112;
    if (dataMethodByte === 0x20 || rsrcMethodByte === 0x20) { path.push(name); continue; }
    if (dataMethodByte === 0x21 || rsrcMethodByte === 0x21) { path.pop(); continue; }
    const rsrcLen = u32be(h, 84), dataLen = u32be(h, 88);
    const rsrcPackedLen = u32be(h, 92), dataPackedLen = u32be(h, 96);
    entries.push({
      path: path.concat([name]).join('/'), name, isFolder: false,
      type: fourcc(h, 66), creator: fourcc(h, 70), finderFlags: u16be(h, 74),
      rsrcLen, rsrcPackedLen, rsrcMethod: rsrcMethodByte & 0x0F, rsrcOffset: at,
      dataLen, dataPackedLen, dataMethod: dataMethodByte & 0x0F, dataOffset: at + rsrcPackedLen,
      encrypted: !!((dataMethodByte | rsrcMethodByte) & 0x10)
    });
    at += rsrcPackedLen + dataPackedLen;
  }
  return { format: 'StuffIt (classic)', entries };
}

/* ---- StuffIt 5 -----------------------------------------------------------
 * An 80-byte banner, a small header, and a linked list of entries whose
 * offsets are XORed with 0xA5A5A5A5 unless the archive says otherwise. The
 * entry header is 48 bytes plus the name, an optional comment, then a
 * metadata block carrying the Finder identity and, when bit 0 of its first
 * word is set, the resource fork's lengths. The forks follow: resource fork
 * first, then data fork. */
function parseStuffIt5(bytes) {
  const flags = bytes[83];
  const plain = !!(flags & 0x10);
  const off = v => (plain ? v : (v ^ 0xA5A5A5A5)) >>> 0;
  let at = off(u32be(bytes, 88));
  let remaining = u16be(bytes, 92);
  const entries = [];
  const dirs = new Map();
  /* Where to carry on after each folder ends. A folder's header gives the
     offset of its first child, and the walk jumps there -- so without
     somewhere to put the folder's OWN next-entry pointer, the walk descends
     into the first folder it meets and never comes back up. That is not
     hypothetical: `Cythera Installed Folder with Preferences & License.sit`
     listed 12 entries of 51, everything in it stopping at the end of the
     first folder, and the six single-file archives this page was written
     against have no nested folders at all so nothing noticed for a year.
     One stack entry per open folder, popped by the folder's end marker. */
  const resume = [];
  while (remaining > 0 && at + 48 <= bytes.length) {
    const start = at;
    if (u32be(bytes, at) !== 0xA5A5A5A5) throw new Error('StuffIt 5 entry marker missing at 0x' + at.toString(16));
    const version = bytes[at + 4];
    const headerSize = u16be(bytes, at + 6);
    const eflags = bytes[at + 9];
    const nextOff = u32be(bytes, at + 22);
    const dirOff = off(u32be(bytes, at + 26));
    const nameLen = u16be(bytes, at + 30);
    const dataLen = u32be(bytes, at + 34), dataPackedLen = u32be(bytes, at + 38);
    const isFolder = !!(eflags & 0x40);
    const dataMethod = isFolder ? 0 : bytes[at + 46];
    const childCount = isFolder ? u16be(bytes, at + 46) : 0;
    at += 48;
    const name = decodeMacRoman(bytes.subarray(at, at + nameLen));
    at += nameLen;
    if (isFolder && nameLen === 0) {            // end-of-folder marker
      // The stack first, the marker's own pointer as a fallback, and never a
      // jump to zero: a folder with nothing after it at its level has a null
      // next-entry pointer, and following it would land on the header at
      // offset 0 and throw on the marker check.
      const back = resume.length ? resume.pop() : 0;
      const to = back || nextOff;
      if (to) { at = to; continue; }
      break;
    }
    if (at < start + headerSize) {              // a comment
      const commentLen = u16be(bytes, at);
      at += 4 + commentLen;
    }
    const meta = u16be(bytes, at);
    const type = fourcc(bytes, at + 4), creator = fourcc(bytes, at + 8);
    const finderFlags = u16be(bytes, at + 12);
    at += 14 + (version === 1 ? 22 : 18);
    let rsrcLen = 0, rsrcPackedLen = 0, rsrcMethod = 0;
    const hasRsrc = !isFolder && !!(meta & 1);
    if (hasRsrc) {
      rsrcLen = u32be(bytes, at); rsrcPackedLen = u32be(bytes, at + 4);
      rsrcMethod = bytes[at + 12];
      const passLen = bytes[at + 13];
      at += 14;
      if ((eflags & 0x20) && passLen) at += passLen;
    }
    const parent = dirs.get(dirOff) || '';
    const path = parent ? parent + '/' + name : name;
    if (isFolder) {
      dirs.set(start, path);
      entries.push({ path, name, isFolder: true, type, creator, finderFlags,
                     dataLen: 0, dataPackedLen: 0, dataMethod: 0, dataOffset: 0,
                     rsrcLen: 0, rsrcPackedLen: 0, rsrcMethod: 0, rsrcOffset: 0 });
      remaining += childCount;
      if (dataLen && dataLen !== 0xFFFFFFFF) { resume.push(nextOff); at = dataLen; }   // first child
    } else {
      entries.push({ path, name, isFolder: false, type, creator, finderFlags,
                     rsrcLen, rsrcPackedLen, rsrcMethod, rsrcOffset: at,
                     dataLen, dataPackedLen, dataMethod, dataOffset: at + rsrcPackedLen,
                     encrypted: !!(eflags & 0x20) });
      at += rsrcPackedLen + dataPackedLen;
    }
    remaining--;
  }
  return { format: 'StuffIt 5', entries };
}

/* One fork of one entry: stored, or decompressed if the method is one this
 * file implements. `which` is 'data' or 'rsrc'. Throws, naming the method,
 * for anything else -- which is still most of them, method 15 (Arsenic)
 * above all, and the message is what tells a user which file to extract by
 * hand.
 *
 * Was `stuffItStoredFork` until method 13 landed. Renamed rather than kept
 * beside a second entry point, because two classic scripts share one global
 * scope and a name here can only mean one thing. */
function stuffItFork(bytes, entry, which) {
  const len = which === 'data' ? entry.dataLen : entry.rsrcLen;
  if (!len) return new Uint8Array(0);
  const method = which === 'data' ? entry.dataMethod : entry.rsrcMethod;
  const packedLen = which === 'data' ? entry.dataPackedLen : entry.rsrcPackedLen;
  const offset = which === 'data' ? entry.dataOffset : entry.rsrcOffset;
  if (entry.encrypted) throw new Error('"' + entry.name + '" is encrypted');
  if (offset + packedLen > bytes.length) throw new Error('"' + entry.name + '" runs past the end of the archive');
  if (method === 0) {
    // A stored fork's packed length IS its length. When it is not, the entry
    // says stored and is not, and handing back the first `len` bytes would
    // quietly produce a wrong file rather than an error.
    if (packedLen !== len)
      throw new Error('"' + entry.name + '" ' + which + ' fork says it is stored but is ' +
                      packedLen + ' bytes for a length of ' + len);
    return bytes.subarray(offset, offset + len);
  }
  if (method === 13) {
    const out = sit13Decompress(bytes.subarray(offset, offset + packedLen), len);
    if (out.length !== len)
      throw new Error('"' + entry.name + '" ' + which + ' fork decompressed to ' + out.length +
                      ' bytes where the catalog says ' + len);
    return out;
  }
  throw new Error('"' + entry.name + '" ' + which + ' fork is compressed with StuffIt method ' + method +
                  ' (' + (SIT_METHOD_NAMES[method] || 'unknown') + '), which this page does not decompress');
}

/* ---- StuffIt method 13, LZ77 + Huffman ------------------------------------

   WHY THIS IS HERE. Everything the Cythera community ever released is inside
   a StuffIt archive, and the one Magpie patch that exists -- the file the
   page's patches section is for -- is method 13 inside
   `614_MagpiePumpkinPatch.sit.hqx`. Without this, using that section meant
   unpacking the .sit on a desktop with `unar` first, which is not a thing a
   phone can do, so the feature's front door was shut to exactly the person
   most likely to want it. Method 13 also opens Pandora's Box and the 1.0.1
   and 1.0.2 installers, whose forks are both method 13.

   WHERE IT CAME FROM. Ported, near line for line, from `Sit13Decoder` in
   `stuffit-rs` 0.1.8 (Ben Letchford, MIT OR Apache-2.0) -- the same source
   this file's header layouts came from, and it in turn carries the tables
   from The Unarchiver's `XADStuffIt13Handle.m` (LGPL), which is where the
   comments in that crate point. CLAUDE.md's licensing note allows this for
   infrastructure with no oracle role, with attribution in the header, and
   this is the case it describes: there is no second implementation of
   StuffIt here to check against, and writing a bit-exact decompressor from
   a prose description is not a thing to do when a correct one is readable.

   WHY NOT WEBASSEMBLY, which would have been wholesale rather than a port:
   the crate compiles to wasm perfectly well, and the site could not load it.
   There is no build step here and adding one is a standing no; and `js/`
   has to keep working from `file://`, where fetching a .wasm fails the same
   CORS check that rules out module scripts. Inlining a wasm blob as base64
   would clear the second objection and not the first, and would put a
   binary nobody can rebuild into a repository whose whole design is that
   every file is served exactly as committed. So: a port, unmodified in
   structure, with the tables copied verbatim.

   WHAT IT IS. An LZ77 window with three Huffman codes over it: `first` for
   the literal or match token when the last thing emitted was a literal,
   `second` for the same when the last thing was a match, and `offset` for
   the bit length of the match distance. The first nibble of the stream says
   which set of codes to use -- 0 for codes written into the stream ahead of
   the data, 1 to 5 for one of five built-in sets -- and our own files use
   0, 1 and 2. */

/* Bits, low bit first, which is the order method 13 reads in.

   The Rust keeps a 64-bit accumulator. JavaScript's bitwise operators are
   32-bit, so this keeps at most 24 bits buffered and refills before each
   read: the widest single read the format asks for is 15 bits, so 24 is
   always enough and the accumulator never reaches bit 32.

   Running out of input is not an error here. The Rust would underflow its
   bit count; this returns the zeros past the end and lets the caller stop,
   which it does -- decompress ends on the output length, and a truncated
   stream shows up as a short result that stuffItFork rejects by length. */
function sit13Bits(data) {
  let pos = 0, buf = 0, n = 0;
  const fill = () => {
    while (n <= 24 && pos < data.length) { buf = (buf | (data[pos++] << n)) >>> 0; n += 8; }
  };
  return {
    bits(k) {
      if (!k) return 0;
      fill();
      const v = buf & ((1 << k) - 1);
      if (n < k) { buf = 0; n = 0; } else { buf = buf >>> k; n -= k; }
      return v;
    },
    bit() { return this.bits(1); }
  };
}

/* A Huffman tree as a flat array of [zero, one] pairs. EMPTY is -1, and a
   leaf is a node whose two slots hold the same symbol -- which is how the
   Rust spells it, and it works because child indices start at 1 (the root is
   0 and is nobody's child), so a symbol can never be mistaken for a link. */
const SIT13_EMPTY = -1;
function sit13TreeFromLengths(lengths, numSymbols) {
  const tree = [[SIT13_EMPTY, SIT13_EMPTY]];
  let code = 0;
  for (let length = 1; length <= 32; length++) {
    for (let i = 0; i < numSymbols; i++) {
      if (lengths[i] !== length) continue;
      let node = 0;
      // The code's bits go in most significant first, though the stream is
      // read least significant first. Both are the Rust's, and swapping
      // either produces a tree that decodes plausible garbage.
      for (let bitPos = length - 1; bitPos >= 0; bitPos--) {
        const bit = (code >>> bitPos) & 1;
        if (tree[node][bit] === SIT13_EMPTY) { tree[node][bit] = tree.length; tree.push([SIT13_EMPTY, SIT13_EMPTY]); }
        node = tree[node][bit];
      }
      tree[node][0] = i; tree[node][1] = i;
      code++;
    }
    code <<= 1;
  }
  return tree;
}
// The metacode's codes are given outright rather than by length, and its bits
// go in least significant first. The asymmetry with the function above is the
// format's, not a slip.
function sit13TreeFromCodes(codes, lengths, numSymbols) {
  const tree = [[SIT13_EMPTY, SIT13_EMPTY]];
  for (let i = 0; i < numSymbols; i++) {
    const length = lengths[i];
    if (length <= 0) continue;
    let node = 0;
    for (let bitPos = 0; bitPos < length; bitPos++) {
      const bit = (codes[i] >>> bitPos) & 1;
      if (tree[node][bit] === SIT13_EMPTY) { tree[node][bit] = tree.length; tree.push([SIT13_EMPTY, SIT13_EMPTY]); }
      node = tree[node][bit];
    }
    tree[node][0] = i; tree[node][1] = i;
  }
  return tree;
}
function sit13Decode(tree, br) {
  let node = 0;
  for (;;) {
    if (tree[node][0] === tree[node][1]) return tree[node][0];
    const next = tree[node][br.bit()];
    if (next === SIT13_EMPTY) return -1;
    node = next;
  }
}

/* One code table written into the stream, as a run-length coding of its own
   symbol lengths through the metacode. Verbatim from the Rust, including the
   trailing write after the switch, which is what makes most branches advance
   two entries rather than one. */
function sit13ParseCode(br, numCodes, metatree) {
  const lengths = new Array(numCodes).fill(0);
  let length = 0, i = 0;
  while (i < numCodes) {
    const val = sit13Decode(metatree, br);
    if (val < 0) throw new Error('StuffIt method 13: the code table is malformed');
    if (val === 31) length = -1;
    else if (val === 32) length += 1;
    else if (val === 33) length -= 1;
    else if (val === 34) { if (br.bit()) { lengths[i] = length; i++; } }
    else if (val === 35) { let c = br.bits(3) + 2;  while (c > 0 && i < numCodes) { lengths[i++] = length; c--; } }
    else if (val === 36) { let c = br.bits(6) + 10; while (c > 0 && i < numCodes) { lengths[i++] = length; c--; } }
    else length = val + 1;
    if (i < numCodes) { lengths[i] = length; i++; }
  }
  return sit13TreeFromLengths(lengths, numCodes);
}

/* `packed` is one fork's compressed bytes, `outLen` the length the catalog
   says it should come back as. Returns what it managed; the caller checks
   the length, so a stream that stops early is an error there rather than a
   silently short file here. */
function sit13Decompress(packed, outLen) {
  const out = new Uint8Array(outLen);
  let n = 0;
  if (!outLen) return out;
  const br = sit13Bits(packed);

  const first = br.bits(8);
  const code = first >> 4;
  let firstTree, secondTree, offsetTree;
  if (code === 0) {
    const meta = sit13TreeFromCodes(SIT13_META_CODES, SIT13_META_LENGTHS, 37);
    firstTree = sit13ParseCode(br, 321, meta);
    // Bit 3 says the second code is the first one over again, which is how a
    // stream avoids writing 321 lengths twice.
    secondTree = (first & 0x08) ? firstTree : sit13ParseCode(br, 321, meta);
    offsetTree = sit13ParseCode(br, (first & 0x07) + 10, meta);
  } else if (code < 6) {
    const idx = code - 1;
    firstTree  = sit13TreeFromLengths(SIT13_FIRST[idx], 321);
    secondTree = sit13TreeFromLengths(SIT13_SECOND[idx], 321);
    offsetTree = sit13TreeFromLengths(SIT13_OFFSET[idx], SIT13_OFFSET[idx].length);
  } else {
    throw new Error('StuffIt method 13: code ' + code + ' is not one of the six the format has');
  }

  let cur = firstTree;
  while (n < outLen) {
    const val = sit13Decode(cur, br);
    if (val < 0) break;
    if (val < 256) { out[n++] = val; cur = firstTree; continue; }
    if (val >= 320) break;
    // A match. The code to read the NEXT token with changes here and stays
    // changed until a literal puts it back, which is the whole of what the
    // two tables are for.
    cur = secondTree;
    let length = val - 256 + 3;
    if (val === 318) length = br.bits(10) + 65;
    else if (val === 319) length = br.bits(15) + 65;
    const bitLen = sit13Decode(offsetTree, br);
    if (bitLen < 0) break;
    const offset = bitLen === 0 ? 1 : bitLen === 1 ? 2
                 : (1 << (bitLen - 1)) + br.bits(bitLen - 1) + 1;
    if (offset > n) break;
    for (let k = 0; k < length && n < outLen; k++) { out[n] = out[n - offset]; n++; }
  }
  return n === outLen ? out : out.subarray(0, n);
}
const SIT13_META_CODES = [1496,88,64,192,0,120,43,20,12,28,27,11,16,32,56,24,216,3032,384,1664,896,3968,1920,1152,128,640,984,4056,2008,2520,472,4,1,2,7,3,8];
const SIT13_META_LENGTHS = [11,8,8,8,8,7,6,5,5,5,5,6,5,6,7,7,9,12,10,11,11,12,12,11,11,11,12,12,12,12,12,5,2,2,3,4,5];
const SIT13_FIRST = [[4,5,7,8,8,9,9,9,9,7,9,9,9,8,9,9,9,9,9,9,9,9,9,10,9,9,10,10,9,10,9,9,5,9,9,9,9,10,9,9,9,9,9,9,9,9,7,9,9,8,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,8,9,9,8,8,9,9,9,9,9,9,9,7,8,9,7,9,9,7,7,9,9,9,9,10,9,10,10,10,9,9,9,5,9,8,7,5,9,8,8,7,9,9,8,8,5,5,7,10,5,8,5,8,9,9,9,9,9,10,9,9,10,9,9,10,10,10,10,10,10,10,9,10,10,10,10,10,10,10,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,9,10,10,10,10,10,10,10,9,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,9,10,10,10,10,10,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,9,10,10,10,10,10,10,10,10,10,10,10,9,9,10,10,9,10,10,10,10,10,10,10,9,10,10,10,9,10,9,5,6,5,5,8,9,9,9,9,9,9,10,10,10,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,9,10,9,9,9,10,9,10,9,10,9,10,9,10,10,10,9,10,9,10,10,9,9,9,6,9,9,10,9,5],[4,7,7,8,7,8,8,8,8,7,8,7,8,7,9,8,8,8,9,9,9,9,10,10,9,10,10,10,10,10,9,9,5,9,8,9,9,11,10,9,8,9,9,9,8,9,7,8,8,8,9,9,9,9,9,10,9,9,9,10,9,9,10,9,8,8,7,7,7,8,8,9,8,8,9,9,8,8,7,8,7,10,8,7,7,9,9,9,9,10,10,11,11,11,10,9,8,6,8,7,7,5,7,7,7,6,9,8,6,7,6,6,7,9,6,6,6,7,8,8,8,8,9,10,9,10,9,9,8,9,10,10,9,10,10,9,9,10,10,10,10,10,10,10,9,10,10,11,10,10,10,10,10,10,10,11,10,11,10,10,9,11,10,10,10,10,10,10,9,9,10,11,10,11,10,11,10,12,10,11,10,12,11,12,10,12,10,11,10,11,11,11,9,10,11,11,11,12,12,10,10,10,11,11,10,11,10,10,9,11,10,11,10,11,11,11,10,11,11,12,11,11,10,10,10,11,10,10,11,11,12,10,10,11,11,12,11,11,10,11,9,12,10,11,11,11,10,11,10,11,10,11,9,10,9,7,3,5,6,6,7,7,8,8,8,9,9,9,11,10,10,10,12,13,11,12,12,11,13,12,12,11,12,12,13,12,14,13,14,13,15,13,14,15,15,14,13,15,15,14,15,14,15,15,14,15,13,13,14,15,15,14,14,16,16,15,15,15,12,15,10],[6,6,6,6,6,9,8,8,4,9,8,9,8,9,9,9,8,9,9,10,8,10,10,10,9,10,10,10,9,10,10,9,9,9,8,10,9,10,9,10,9,10,9,10,9,9,8,9,8,9,9,9,10,10,10,10,9,9,9,10,9,10,9,9,7,8,8,9,8,9,9,9,8,9,9,10,9,9,8,9,8,9,8,8,8,9,9,9,9,9,10,10,10,10,10,9,8,8,9,8,9,7,8,8,9,8,10,10,8,9,8,8,8,10,8,8,8,8,9,9,9,9,10,10,10,10,10,9,7,9,9,10,10,10,10,10,9,10,10,10,10,10,10,9,9,10,10,10,10,10,10,10,10,9,10,10,10,10,10,10,9,10,10,10,10,10,10,10,9,9,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,9,10,10,10,10,9,8,9,10,10,10,10,10,10,10,10,10,10,9,10,10,10,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,9,9,10,10,10,10,10,10,9,10,10,10,10,10,10,9,9,9,10,10,10,10,10,10,9,9,10,9,9,8,9,8,9,4,6,6,6,7,8,8,9,9,10,10,10,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,7,10,10,10,7,10,10,7,7,7,7,7,6,7,10,7,7,10,7,7,7,6,7,6,6,7,7,6,6,9,6,9,10,6,10],[2,6,6,7,7,8,7,8,7,8,8,9,8,9,9,9,8,8,9,9,9,10,10,9,8,10,9,10,9,10,9,9,6,9,8,9,9,10,9,9,9,10,9,9,9,9,8,8,8,8,8,9,9,9,9,9,9,9,9,9,9,10,10,9,7,7,8,8,8,8,9,9,7,8,9,10,8,8,7,8,8,10,8,8,8,9,8,9,9,10,9,11,10,11,9,9,8,7,9,8,8,6,8,8,8,7,10,9,7,8,7,7,8,10,7,7,7,8,9,9,9,9,10,11,9,11,10,9,7,9,10,10,10,11,11,10,10,11,10,10,10,11,11,10,9,10,10,11,10,11,10,11,10,10,10,11,10,11,10,10,9,10,10,11,10,11,10,11,9,10,10,10,10,11,10,11,10,11,10,11,11,11,10,12,10,11,10,11,10,11,11,10,8,10,10,11,10,11,11,11,10,11,10,11,10,11,11,11,9,10,11,11,10,11,11,11,10,11,11,11,10,10,10,10,10,11,10,10,11,11,10,10,9,11,10,10,11,11,10,10,10,11,10,10,10,10,10,10,9,11,10,10,8,10,8,6,5,6,6,7,7,8,8,8,9,10,11,10,10,11,11,12,12,10,11,12,12,12,12,13,13,13,13,13,12,13,13,15,14,12,14,15,16,12,12,13,15,14,16,15,17,18,15,17,16,15,15,15,15,13,13,10,14,12,13,17,17,18,10,17,4],[7,9,9,9,9,9,9,9,9,8,9,9,9,7,9,9,9,9,9,9,9,9,9,10,9,10,9,10,9,10,9,9,5,9,7,9,9,9,9,9,7,7,7,9,7,7,8,7,8,8,7,7,9,9,9,9,7,7,7,9,9,9,9,9,9,7,9,7,7,7,7,9,9,7,9,9,7,7,7,7,7,9,7,8,7,9,9,9,9,9,9,9,9,9,9,9,9,7,8,7,7,7,8,8,6,7,9,7,7,8,7,5,6,9,5,7,5,6,7,7,9,8,9,9,9,9,9,9,9,9,10,9,10,10,10,9,9,10,10,10,10,10,10,10,9,10,10,10,10,10,10,10,10,10,10,10,9,10,10,10,9,10,10,10,9,9,10,9,9,9,9,10,10,10,10,10,10,10,10,10,10,10,9,10,10,10,10,10,10,10,10,10,9,10,10,10,9,10,10,10,9,9,9,10,10,10,10,10,9,10,9,10,10,9,10,10,9,10,10,10,10,10,10,10,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,9,10,10,10,10,10,10,10,9,10,9,10,9,10,10,9,5,6,8,8,7,7,7,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10,9,10,10,5,10,8,9,8,9]];
const SIT13_SECOND = [[4,5,6,6,7,7,6,7,7,7,6,8,7,8,8,8,8,9,6,9,8,9,8,9,9,9,8,10,5,9,7,9,6,9,8,10,9,10,8,8,9,9,7,9,8,9,8,9,8,8,6,9,9,8,8,9,9,10,8,9,9,10,8,10,8,8,8,8,8,9,7,10,6,9,9,11,7,8,8,9,8,10,7,8,6,9,10,9,9,10,8,11,9,11,9,10,9,8,9,8,8,8,8,10,9,9,10,10,8,9,8,8,8,11,9,8,8,9,9,10,8,11,10,10,8,10,9,10,8,9,9,11,9,11,9,10,10,11,10,12,9,12,10,11,10,11,9,10,10,11,10,11,10,11,10,11,10,10,10,9,9,9,8,7,6,8,11,11,9,12,10,12,9,11,11,11,10,12,11,11,10,12,10,11,10,10,10,11,10,11,11,11,9,12,10,12,11,12,10,11,10,12,11,12,11,12,11,12,10,12,11,12,11,11,10,12,10,11,10,12,10,12,10,12,10,11,11,11,10,11,11,11,10,12,11,12,10,10,11,11,9,12,11,12,10,11,10,12,10,11,10,12,10,11,10,7,5,4,6,6,7,7,7,8,8,7,7,6,8,6,7,7,9,8,9,9,10,11,11,11,12,11,10,11,12,11,12,11,12,12,12,12,11,12,12,11,12,11,12,11,13,11,12,10,13,10,14,14,13,14,15,14,16,15,15,18,18,18,9,18,8],[5,6,6,6,6,7,7,7,7,7,7,8,7,8,7,7,7,8,8,8,8,9,8,9,8,9,9,9,7,9,8,8,6,9,8,9,8,9,8,9,8,9,8,9,8,9,8,8,8,8,8,9,8,9,8,9,9,10,8,10,8,9,9,8,8,8,7,8,8,9,8,9,7,9,8,10,8,9,8,9,8,9,8,8,8,9,9,9,9,10,9,11,9,10,9,10,8,8,8,9,8,8,8,9,9,8,9,10,8,9,8,8,8,11,8,7,8,9,9,9,9,10,9,10,9,10,9,8,8,9,9,10,9,10,9,10,8,10,9,10,9,11,10,11,9,11,10,10,10,11,9,11,9,10,9,11,9,11,10,10,9,10,9,9,8,10,9,11,9,9,9,11,10,11,9,11,9,11,9,11,10,11,10,11,10,11,9,10,10,11,10,10,8,10,9,10,10,11,9,11,9,10,10,11,9,10,10,9,9,10,9,10,9,10,9,10,9,11,9,11,10,10,9,10,9,11,9,11,9,11,9,10,9,11,9,11,9,11,9,10,8,11,9,10,9,10,9,10,8,10,8,9,8,9,8,7,4,4,5,6,6,6,7,7,7,7,8,8,8,7,8,8,9,9,10,10,10,10,10,10,11,11,10,10,12,11,11,12,12,11,12,12,11,12,12,12,12,12,12,11,12,11,13,12,13,12,13,14,14,14,15,13,14,13,14,18,18,17,7,16,9],[5,6,6,6,6,7,7,7,6,8,7,8,7,9,8,8,7,7,8,9,9,9,9,10,8,9,9,10,8,10,9,8,6,10,8,10,8,10,9,9,9,9,9,10,9,9,8,9,8,9,8,9,9,10,9,10,9,9,8,10,9,11,10,8,8,8,8,9,7,9,9,10,8,9,8,11,9,10,9,10,8,9,9,9,9,8,9,9,10,10,10,12,10,11,10,10,8,9,9,9,8,9,8,8,10,9,10,11,8,10,9,9,8,12,8,9,9,9,9,8,9,10,9,12,10,10,10,8,7,11,10,9,10,11,9,11,7,11,10,12,10,12,10,11,9,11,9,12,10,12,10,12,10,9,11,12,10,12,10,11,9,10,9,10,9,11,11,12,9,10,8,12,11,12,9,12,10,12,10,13,10,12,10,12,10,12,10,9,10,12,10,9,8,11,10,12,10,12,10,12,10,11,10,12,8,12,10,11,10,10,10,12,9,11,10,12,10,12,11,12,10,9,10,12,9,10,10,12,10,11,10,11,10,12,8,12,9,12,8,12,8,11,10,11,10,11,9,10,8,10,9,9,8,9,8,7,4,3,5,5,6,5,6,6,7,7,8,8,8,7,7,7,9,8,9,9,11,9,11,9,8,9,9,11,12,11,12,12,13,13,12,13,14,13,14,13,14,13,13,13,12,13,13,12,13,13,14,14,13,13,14,14,14,14,15,18,17,18,8,16,10],[4,5,6,6,6,6,7,7,6,7,7,9,6,8,8,7,7,8,8,8,6,9,8,8,7,9,8,9,8,9,8,9,6,9,8,9,8,10,9,9,8,10,8,10,8,9,8,9,8,8,7,9,9,9,9,9,8,10,9,10,9,10,9,8,7,8,9,9,8,9,9,9,7,10,9,10,9,9,8,9,8,9,8,8,8,9,9,10,9,9,8,11,9,11,10,10,8,8,10,8,8,9,9,9,10,9,10,11,9,9,9,9,8,9,8,8,8,10,10,9,9,8,10,11,10,11,11,9,8,9,10,11,9,10,11,11,9,12,10,10,10,12,11,11,9,11,11,12,9,11,9,10,10,10,10,12,9,11,10,11,9,11,11,11,10,11,11,12,9,10,10,12,11,11,10,11,9,11,10,11,10,11,9,11,11,9,8,11,10,11,11,10,7,12,11,11,11,11,11,12,10,12,11,13,11,10,12,11,10,11,10,11,10,11,10,11,10,12,11,11,10,11,10,10,10,11,10,12,11,12,10,11,9,11,10,11,10,11,10,12,9,11,11,11,9,11,10,10,9,11,10,10,9,10,9,7,4,5,5,5,6,6,7,6,8,7,8,9,9,7,8,8,10,9,10,10,12,10,11,11,11,11,10,11,12,11,11,11,11,11,13,12,11,12,13,12,12,12,13,11,9,12,13,7,13,11,13,11,10,11,13,15,15,12,14,15,15,15,6,15,5],[8,10,11,11,11,12,11,11,12,6,11,12,10,5,12,12,12,12,12,12,12,13,13,14,13,13,12,13,12,13,12,15,4,10,7,9,11,11,10,9,6,7,8,9,6,7,6,7,8,7,7,8,8,8,8,8,8,9,8,7,10,9,10,10,11,7,8,6,7,8,8,9,8,7,10,10,8,7,8,8,7,10,7,6,7,9,9,8,11,11,11,10,11,11,11,8,11,6,7,6,6,6,6,8,7,6,10,9,6,7,6,6,7,10,6,5,6,7,7,7,10,8,11,9,13,7,14,16,12,14,14,15,15,16,16,14,15,15,15,15,15,15,15,15,14,15,13,14,14,16,15,17,14,17,15,17,12,14,13,16,12,17,13,17,14,13,13,14,14,12,13,15,15,14,15,17,14,17,15,14,15,16,12,16,15,14,15,16,15,16,17,17,15,15,17,17,13,14,15,15,13,12,16,16,17,14,15,16,15,15,13,13,15,13,16,17,15,17,17,17,16,17,14,17,14,16,15,17,15,15,14,17,15,17,15,16,15,15,16,16,14,17,17,15,15,16,15,17,15,14,16,16,16,16,16,12,4,4,5,5,6,6,6,7,7,7,8,8,8,8,9,9,9,9,9,10,10,10,11,10,11,11,11,11,11,12,12,12,13,13,12,13,12,14,14,12,13,13,13,13,14,12,13,13,14,14,14,13,14,14,15,15,13,15,13,17,17,17,9,17,7]];
const SIT13_OFFSET = [[5,6,3,3,3,3,3,3,3,4,6],[5,6,4,4,3,3,3,3,3,4,4,4,6],[6,7,4,4,3,3,3,3,3,4,4,4,5,7],[3,6,5,4,2,3,3,3,4,4,6],[6,7,7,6,4,3,2,2,3,3,6]];
