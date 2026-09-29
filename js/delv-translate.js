/* delv-translate.js -- Cythera Data in another language.

   translateCytheraData(data, rsrc, T) -> { data, rsrc, log, report }

   `data` and `rsrc` are Cythera Data's two forks as shipped; `T` is a
   translation table (js/delv-es.js is the Spanish one, loaded only when it is
   asked for). The answer is both forks with the text replaced, a line for
   each resource changed, and a report of what the table did and did not
   reach. Begun 29 September 2026 at the maintainer's word, "a full Spanish
   localization option for Cythera, starting with Cythera Data".

   WHY BOTH FORKS. A Magpie patch carries data-fork resources and nothing
   else (GRIMOIRE-NOTES, "A Magpie patch reaches the data fork"), and three
   things a translation needs are in the resource fork: the conversation
   font, `sfnt` 7289 Argos A Nouveau, which has no accented letters; the
   conversation window's buttons, STR# 128 ("Bye", "Name", "Job", "Where
   Is..."); and the text styles, TxSt, which say the message pane is Geneva
   10. So this writes the whole file, and the Patches section hands it out
   as a MacBinary or a disk image, as it does the program with its fixes.

   WHY CONTROL CODES. Script text is seven-bit: a byte of 0x80 up is an
   opcode wherever the interpreter reads text, so "á" cannot be its Mac Roman
   byte. The text drawer passes a control byte to QuickDraw, and QuickDraw's
   TrueType scaler draws it by the font's cmap, so the patched Argos carries
   the accented letters at codes 0x01 to 0x13 (less the tab, the line feed
   and the return). That was proved on Mac OS 8.5 in Infinite Mac on 24 and
   25 September 2026 with the opening of the game; the proof images and
   scripts are beside the other images in cythera-reference
   (`cythera_infinitemac_es-opening*.dsk`, `spanish-opening*-proof.mjs`,
   `mkfont-es3-proof.py`), and GRIMOIRE-NOTES has the account under
   `grimoire/fixable-bugs-1adxav`. What the proofs settled and this keeps:
   a highlighted word ends at its first accent (the application's "@" scan
   takes A to Z and a to z only), so a highlighted word is written without
   one until the program's highlighter is patched; a byte of 0x80 up in a
   keyword list is fatal, not merely unmatched (the list is read by the same
   seven-bit scanner, and every entry after the byte is misread), so no
   keyword carries one; and a typed accent can only be met by a stem cut
   before it.

   WHAT A TABLE IS KEYED BY. Each piece of text by its resource and a hash of
   its English bytes, never by the English itself, so that the table, which
   is public in this repository, holds no text of the game's: the builder
   reads the English out of the visitor's own file, hashes it, and looks the
   hash up. A piece the table does not know is left in English and reported,
   which is also what happens to a release whose text differs from the one
   the table was written against. Two pieces with the same English in one
   resource take one translation; `text['*']` holds what is the same in
   every resource ("Farewell.", "Cancel").

   WHAT A PIECE IS. The runs `dvmTextSites` finds, which is every place a
   script keeps text: a direct run of text in code (delvmod's direct mode,
   dvmImplicitString), a NUL-terminated string operand, a prompt, a string in
   a `data` block or a serialized array, and a string object. A run is cut
   wherever an offset in the resource lands inside it, because the compiler
   shares the tails of strings ("A text run split where a jump lands in it",
   v1.183.0): the jump lands on the tail, so the tail is its own piece, and
   its translation has to read after either head.

   THE SPLICE. Every piece of a resource is replaced at once
   (dataPatchReplaceMany): the resource's offsets are read once, every place
   is spliced, each offset moves by the places before what it points at, a
   `data` block's size word takes the change inside it, and the result is
   read back and compared, as js/delv-datapatch.js does for one text edit.
   One edit at a time through that applier would read every site of a
   resource twice per piece, which for five thousand pieces is most of a
   minute; this is two reads per resource. */

/* ---- where the text is ---------------------------------------------------- */

// Every place a script resource keeps text, and every keyword list.
// text: [{ at, len, text, kind, fn, split }], `text` the bytes as a string
// (every byte below 0x80, since script text is seven-bit, and kept with any
// NUL inside it); keys: [{ at, len, words, fn }].
function dvmTextSites(b, resid) {
  const out = [], keys = [];
  const { tableOffset } = dvmDiscover(b, resid);
  if (tableOffset === null) return { text: out, keys };
  dvmContextResid = resid;
  const targets = new Set();
  for (const s of dvmOffsetSites(b, resid)) targets.add(s.value);
  const push = (at, len, kind, fn) => {
    if (len <= 0) return;
    const cuts = [...targets].filter(t => t > at && t < at + len).sort((x, y) => x - y);
    let from = at;
    for (const t of cuts.concat([at + len])) {
      out.push({ at: from, len: t - from, kind, fn, text: String.fromCharCode.apply(null, b.subarray(from, t)), split: cuts.length > 0 });
      from = t;
    }
  };
  // A data block, or a serialized array with what follows it, is containers
  // and NUL-terminated strings laid end to end (dvmContainerSites); a
  // container's tag is 0x9n or 0xAn, which no text byte can be.
  const blockStrings = (p, end, fn) => {
    while (p < end) {
      const tag = b[p] & 0xF0;
      if ((tag === 0x90 || tag === 0xA0) && p + 2 <= end) {
        const n = u16be(b, p) & 0x0FFF, stride = tag === 0xA0 ? 6 : 4;
        p = p + 2 + n * stride;
        continue;
      }
      let z = p; while (z < end && b[z] !== 0) z++;
      push(p, z - p, 'block', fn);
      p = z + 1;
    }
  };
  for (const [st, en, kind] of dvmExtents(b, resid)) {
    if (kind === 'array' || kind === 'table') { blockStrings(st, en, st); continue; }
    if (kind !== 'function') {
      let z = st; while (z < en && b[z] !== 0) z++;
      push(st, z - st, 'object', st);
      continue;
    }
    let r;
    try { r = dvmDisassemble(b.subarray(st, en), 3); } catch (e) { quiet(e, 'text sites of 0x' + resid.toString(16)); continue; }
    for (const op of r.ops) {
      const a = st + op[0], mn = op[2];
      if (mn === 'string(implicit)') push(a, JSON.parse(op[3]).length, 'implicit', st);
      else if (mn === 'string' || mn === 'conversation_prompt') {
        let z = a + 1; while (z < b.length && b[z] !== 0) z++;
        push(a + 1, z - a - 1, mn === 'string' ? 'operand' : 'prompt', st);
      } else if (mn === 'conversation_response') {
        let z = a + 1; while (z < b.length && b[z] !== 0) z++;
        keys.push({ at: a + 1, len: z - a - 1, words: String.fromCharCode.apply(null, b.subarray(a + 1, z)), fn: st });
      } else if (mn === 'data') blockStrings(a + 3, Math.min(a + 3 + u16be(b, a + 1), b.length), st);
    }
  }
  return { text: out, keys };
}

// A piece worth a translation: two letters in a row. What is left is
// punctuation and spacing ('"*', '  '), which stays as it is.
function translateWants(text) { return /[A-Za-z]{2}/.test(text); }

/* ---- keys ------------------------------------------------------------------ */

// FNV-1a over the bytes, as eight hex digits.
function translateHash(text) {
  let h = 0x811C9DC5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i) & 0xFF; h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}
// A resource's own entry first, then what is the same everywhere.
function translateLookup(T, section, resid, hash) {
  const sec = T[section];
  if (!sec) return undefined;
  const own = sec[resid.toString(16).toUpperCase().padStart(4, '0')];
  if (own && own[hash] !== undefined) return own[hash];
  return sec['*'] ? sec['*'][hash] : undefined;
}

/* ---- the encoding ---------------------------------------------------------- */

// The accented letters at the control codes the patched Argos carries them
// at: the proofs' map, unchanged, since that is the one seen on a screen.
const TRANSLATE_CODES = { 'á': 0x01, 'é': 0x02, 'í': 0x03, 'ó': 0x04, 'ú': 0x05, 'ñ': 0x06, 'ü': 0x07, '¿': 0x08,
  '¡': 0x0B, 'Á': 0x0C, 'É': 0x0E, 'Í': 0x0F, 'Ó': 0x10, 'Ú': 0x11, 'Ñ': 0x12, 'Ü': 0x13 };
// A translation's text as script bytes: seven-bit, the accents at their codes.
function translateEncode(s) {
  let out = '';
  for (const c of s) {
    const v = c.charCodeAt(0);
    if (v < 0x80) out += c;
    else if (TRANSLATE_CODES[c] !== undefined) out += String.fromCharCode(TRANSLATE_CODES[c]);
    else throw new Error('the translation has a character the game cannot draw: ' + JSON.stringify(c) + ' in ' + JSON.stringify(s.slice(0, 60)));
  }
  return out;
}

/* ---- keyword lists --------------------------------------------------------- */

// A keyword list with its translation's stems added after its own. The
// interpreter copies each keyword to the next comma and compares it with the
// start of what was said ("A keyword that needs a space typed first",
// v1.101.0), so a stem is a prefix: "nomb" answers "nombre". The English
// stays, so nothing that answered before stops answering; the stems for a
// word come from the resource's own entry, then from what is the same
// everywhere. `*` (the fallback answer) takes nothing.
function translateKeywordList(words, T, resid) {
  if (words === '*') return null;
  const have = words.split(','), add = [];
  const R = T.keys && T.keys[resid.toString(16).toUpperCase().padStart(4, '0')];
  const G = T.keys && T.keys['*'];
  for (const w of have) {
    const k = w.trim();
    const s = (R && R[k] !== undefined) ? R[k] : (G && G[k] !== undefined ? G[k] : '');
    for (const stem of String(s).split(',')) if (stem && have.indexOf(stem) < 0 && add.indexOf(stem) < 0) add.push(stem);
  }
  if (!add.length) return null;
  // A stem may carry a lower-case accent, as its control code: what a click
  // on a button or a highlighted word says is the script's own text, codes
  // and all, so "d\x04nd" answers a button labelled "Dónde" where "dond"
  // would not. It never carries a byte of 0x80 up, which is fatal in a list.
  const enc = add.map(stem => translateEncode(stem));
  for (const stem of enc) if (!/^[a-z \x01-\x07]+$/.test(stem)) throw new Error('a keyword stem may hold lower-case letters, their accents and spaces only, not ' + JSON.stringify(stem));
  return words + ',' + enc.join(',');
}

/* ---- one script resource --------------------------------------------------- */

// The places a translation changes in one resource, each { at, len, bytes },
// and what it found on the way in `report`.
function translatePlaces(b, resid, T, report) {
  const { text, keys } = dvmTextSites(b, resid);
  const places = [];
  const seen = new Set();
  for (const u of text) {
    // A prompt is never text to translate: mygetch shows the program's own
    // two buttons for "yn" and hands back 'y' or 'n' for the keyword lists
    // after it to match, and any other prompt a button per letter, so the
    // letters are what the script tests (TConversation::mygetch).
    if (u.kind === 'prompt' || !translateWants(u.text)) continue;
    const h = translateHash(u.text);
    const es = translateLookup(T, 'text', resid, h);
    if (es === undefined || es === null) { report.missing.push({ resid, at: u.at, hash: h, kind: u.kind, len: u.len }); continue; }
    report.done++;
    seen.add(h);
    // '=' is a piece that is the same in the translation, a name alone
    // ("Pnyx", "Kosha") most often: said, so that it is not reported missing.
    if (es === '=') continue;
    const enc = translateEncode(es);
    // A NUL inside a piece is part of how the script reads it (a zone's name
    // ends with one where it is read as a C string); a translation keeps
    // every one, and at the end if the English ends with one.
    const nuls = t => (t.match(/\0/g) || []).length;
    if (nuls(enc) !== nuls(u.text) || (u.text.endsWith('\0') !== enc.endsWith('\0')))
      throw new Error('0x' + resid.toString(16) + ' ' + h + ': the translation must keep the English NULs where they are');
    if (enc !== u.text) places.push({ at: u.at, len: u.len, bytes: enc });
  }
  const own = T.text && T.text[resid.toString(16).toUpperCase().padStart(4, '0')];
  if (own) for (const h of Object.keys(own)) if (!seen.has(h)) report.unused.push({ resid, hash: h });
  for (const k of keys) {
    const n = translateKeywordList(k.words, T, resid);
    if (n) { places.push({ at: k.at, len: k.len, bytes: n }); report.keys++; }
  }
  return places;
}

/* ---- the splice ------------------------------------------------------------ */

// Every place in one resource at once. dvmRelink's arithmetic, over many
// places: a site past a place moves by the change in length of every place
// that ends at or before what it points at, so a jump to the start of a
// piece stays at the start of its translation; a site pointing inside a
// piece replaced is refused, since there is nowhere in the translation for
// it to go; a `data` block's size word takes the change of every place
// inside it. The resource is read back and every site compared with where
// it should be, and anything that does not come out exact throws.
function dataPatchReplaceMany(s, resid, places, what) {
  const b = s.bytesOf(resid);
  dvmContextResid = resid;
  const asc = places.slice().sort((x, y) => x.at - y.at);
  for (let k = 1; k < asc.length; k++) if (asc[k].at < asc[k - 1].at + asc[k - 1].len) throw new Error(what + ': two places overlap in 0x' + resid.toString(16) + ' at 0x' + asc[k].at.toString(16));
  const extra = { blocks: [], keys: [] };
  const sites = dvmOffsetSites(b, resid, extra);
  let grow = 0;
  for (const p of asc) grow += p.bytes.length - p.len;
  const out = new Uint8Array(b.length + grow);
  let from = 0, to = 0;
  for (const p of asc) {
    out.set(b.subarray(from, p.at), to); to += p.at - from;
    for (let i = 0; i < p.bytes.length; i++) { const v = p.bytes.charCodeAt(i); if (v >= 0x80) throw new Error(what + ': a byte above 0x7F in 0x' + resid.toString(16)); out[to + i] = v; }
    to += p.bytes.length; from = p.at + p.len;
  }
  out.set(b.subarray(from), to);
  // How far a position moves: the change of every place that ends at or before it.
  const ends = asc.map(p => p.at + p.len), deltas = asc.map(p => p.bytes.length - p.len);
  const shift = pos => { let d = 0; for (let k = 0; k < asc.length && ends[k] <= pos; k++) d += deltas[k]; return d; };
  for (const blk of extra.blocks) {
    let d = 0;
    for (let k = 0; k < asc.length; k++) if (asc[k].at >= blk.a + 3 && asc[k].at < blk.a + 3 + blk.size) d += deltas[k];
    if (!d) continue;
    const size = blk.size + d, at = blk.a + shift(blk.a);
    if (size > 0xFFFF) throw new Error(what + ': a data block in 0x' + resid.toString(16) + ' would be ' + size + ' bytes');
    out[at + 1] = (size >> 8) & 0xFF; out[at + 2] = size & 0xFF;
  }
  const inside = v => asc.some(p => v > p.at && v < p.at + p.len);
  const expect = new Map();
  let moved = 0;
  for (const site of sites) {
    if (asc.some(p => site.at >= p.at && site.at < p.at + p.len)) continue;
    if (inside(site.value)) throw new Error(what + ': 0x' + site.value.toString(16) + ', which a ' + site.kind + ' in 0x' + resid.toString(16) + ' points at, is inside text replaced');
    const at = site.at + shift(site.at), v = site.value + shift(site.value);
    if (v !== site.value) { dvmWriteSite(out, { at, size: site.size }, v); moved++; }
    expect.set(at, v);
  }
  const again = dvmOffsetSites(out, resid);
  const bad = again.filter(site => expect.has(site.at) && expect.get(site.at) !== site.value);
  const lost = [...expect.keys()].filter(q => !again.some(site => site.at === q));
  if (bad.length || lost.length) throw new Error(what + ' in 0x' + resid.toString(16) + ': the resource does not read back, ' + bad.length + ' offsets wrong, ' + lost.length + ' no longer found');
  for (let k = asc.length - 1; k >= 0; k--) dataPatchSplice(s, resid, asc[k].at, asc[k].len, asc[k].bytes.length);
  s.plain.set(resid, out);
  s.log.push(what + ': 0x' + resid.toString(16).toUpperCase() + ', ' + asc.length + ' place' + (asc.length === 1 ? '' : 's') + ', ' + (grow >= 0 ? '+' : '') + grow + ' bytes, ' + moved + ' offsets moved');
  return out;
}

/* ---- the name tables ------------------------------------------------------- */

// gCharNames, 0x0201: an array of 256 whose entries are the tag 0x9165 and
// the offset of a NUL-terminated name. The relinker does not follow the tag
// (GRIMOIRE-NOTES, the casts of the hall), so the table is laid out afresh,
// as utilities/hall_lines.mjs does for a cast.
function translateNameTable(b, T, report) {
  const n = u16be(b, 0) & 0x0FFF;
  if (n !== 256 || (b[0] & 0xF0) !== 0x90) throw new Error('the name table is not an array of 256');
  const tags = [], names = [];
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const q = 2 + 4 * i, tag = u16be(b, q), off = u16be(b, q + 2);
    if (tag !== 0x9165) throw new Error('name table entry ' + i + ' has tag 0x' + tag.toString(16) + ', not 0x9165');
    let e = off; while (e < b.length && b[e] !== 0) e++;
    const en = String.fromCharCode.apply(null, b.subarray(off, e));
    let s = en;
    // A name the table does not give stays as it is and is not reported:
    // nearly every name is a person's, and the rules keep those.
    if (translateWants(en)) {
      const es = translateLookup(T, 'names', 0x0201, translateHash(en));
      if (es !== undefined && es !== '=') { s = translateEncode(es); report.done++; if (s !== en) changed++; }
    }
    tags.push(tag); names.push(s);
  }
  if (!changed) return null;
  const head = [b[0], b[1]], strs = [];
  let off = 2 + 4 * n;
  for (let i = 0; i < n; i++) {
    head.push((tags[i] >> 8) & 0xFF, tags[i] & 0xFF, (off >> 8) & 0xFF, off & 0xFF);
    for (const c of names[i]) strs.push(c.charCodeAt(0));
    strs.push(0); off += names[i].length + 1;
  }
  if (off > 0xFFFF) throw new Error('the name table would be ' + off + ' bytes, past what a 16-bit offset reaches');
  return Uint8Array.from(head.concat(strs));
}

// The tile names, 0xF004: { u16 last tile of the run, NUL-terminated name
// code } records in file order, then a 0x7FFF catch-all and zero padding
// (loadTerrainNames). A name code may carry its plural after a backslash,
// "arrow\s", "obol\s/oi" (delverNameCode), and a translation writes its own
// in the same notation. Nothing points into the table, so it is written out
// again with the padding kept.
function translateTileNames(b, T, report) {
  const recs = [];
  let i = 0, prev = -1;
  while (i + 3 <= b.length) {
    const id = u16be(b, i);
    let e = i + 2; while (e < b.length && b[e] !== 0) e++;
    if (id < prev) break;
    recs.push({ id, name: String.fromCharCode.apply(null, b.subarray(i + 2, e)) });
    prev = id; i = e + 1;
  }
  const tail = b.subarray(i);
  let changed = 0;
  for (const r of recs) {
    if (!translateWants(r.name)) continue;
    const es = translateLookup(T, 'tiles', 0xF004, translateHash(r.name));
    if (es === undefined) { report.missing.push({ resid: 0xF004, at: r.id, hash: translateHash(r.name), kind: 'tile', len: r.name.length }); continue; }
    if (es === '=') { report.done++; continue; }
    const s = translateEncode(es);
    report.done++;
    if (s !== r.name) { r.name = s; changed++; }
  }
  if (!changed) return null;
  const out = [];
  for (const r of recs) { out.push((r.id >> 8) & 0xFF, r.id & 0xFF); for (const c of r.name) out.push(c.charCodeAt(0)); out.push(0); }
  for (const v of tail) out.push(v);
  return Uint8Array.from(out);
}

/* ---- the resource fork ----------------------------------------------------- */

// STR# as a list of strings, and back.
function translateReadStrList(d) {
  const n = u16be(d, 0), out = [];
  let p = 2;
  for (let i = 0; i < n; i++) { const L = d[p]; out.push(d.subarray(p + 1, p + 1 + L)); p += 1 + L; }
  return out;
}
function translateWriteStrList(list) {
  let len = 2; for (const s of list) len += 1 + s.length;
  const out = new Uint8Array(len);
  out[0] = (list.length >> 8) & 0xFF; out[1] = list.length & 0xFF;
  let p = 2;
  for (const s of list) { if (s.length > 255) throw new Error('a string in a STR# is longer than 255 bytes'); out[p] = s.length; out.set(s, p + 1); p += 1 + s.length; }
  return out;
}

// The data file's resource fork: its STR# strings by hash, as Mac Roman
// (a resource-fork string is not script text, so an accent is its own byte
// there); a TxSt given a new face or size; and the conversation face with
// the letters the translation needs (T.font says which, and how).
function translateResourceFork(rsrc, T, report, log) {
  const spec = resourceForkSpec(openResourceFork(rsrc));
  let changed = false;
  for (const r of spec.resources) {
    if (r.type === 'STR#') {
      const list = translateReadStrList(r.data);
      let n = 0;
      const next = list.map(bytes => {
        const en = decodeMacRoman(bytes);
        if (!translateWants(en)) return bytes;
        const es = translateLookup(T, 'strings', r.id, translateHash(en));
        if (es === undefined) { report.missing.push({ resid: 'STR# ' + r.id, hash: translateHash(en), kind: 'STR#', len: bytes.length }); return bytes; }
        report.done++;
        if (es === '=') return bytes;
        const out = encodeMacRoman(es);
        if (out.length !== bytes.length || out.some((v, i) => v !== bytes[i])) n++;
        return out;
      });
      if (n) { r.data = translateWriteStrList(next); changed = true; log.push('STR# ' + r.id + ': ' + n + ' of ' + list.length + ' strings'); }
    } else if (r.type === 'TxSt' && T.styles && T.styles[r.id]) {
      // Size (a byte), the style bits (a byte), the face's name (a Pascal
      // string): TMPL 128 in the same fork says so.
      const want = T.styles[r.id];
      const size = want.size !== undefined ? want.size : r.data[0], style = want.style !== undefined ? want.style : r.data[1];
      const name = encodeMacRoman(want.font !== undefined ? want.font : decodeMacRoman(r.data.subarray(3, 3 + r.data[2])));
      const out = new Uint8Array(3 + name.length);
      out[0] = size; out[1] = style; out[2] = name.length; out.set(name, 3);
      r.data = out; changed = true;
      log.push('TxSt ' + r.id + ' (' + (r.name || '') + '): ' + decodeMacRoman(name) + ' ' + size);
    } else if (r.type === 'sfnt' && T.font) {
      const got = T.font(r.data);
      r.data = got.bytes; changed = true;
      log.push('sfnt ' + r.id + ' (' + (r.name || '') + '): ' + got.added + ' glyphs added, ' + got.mapped + ' codes mapped');
    }
  }
  return changed ? writeResourceFork(spec) : rsrc;
}

/* ---- the whole file -------------------------------------------------------- */

function translateCytheraData(data, rsrc, T) {
  const report = { done: 0, keys: 0, missing: [], unused: [] };
  const keepSyms = DVM_RESOURCE_SYMBOLS, keepCtx = dvmContextResid;
  try {
    const s = dataPatchSession(data);
    const what = 'the translation (' + (T.name || T.lang || '?') + ')';
    for (const resid of dataPatchScriptResids(s.spec)) {
      if (resid === 0x0101 || resid === 0x0201) continue;   // the scripts' symbols; the name table, below
      let b;
      try { b = s.bytesOf(resid); } catch (e) { quiet(e, 'translate 0x' + resid.toString(16)); continue; }
      const places = translatePlaces(b, resid, T, report);
      if (places.length) dataPatchReplaceMany(s, resid, places, what);
    }
    const nt = translateNameTable(s.bytesOf(0x0201), T, report);
    if (nt) { s.plain.set(0x0201, nt); s.relaid.add(0x0201); s.log.push(what + ': 0x0201, the name table laid out again'); }
    if (s.spec.resources.some(r => r.resid === 0xF004)) {
      const tn = translateTileNames(s.bytesOf(0xF004), T, report);
      if (tn) { s.plain.set(0xF004, tn); s.relaid.add(0xF004); s.log.push(what + ': 0xF004, the tile names written again'); }
    }
    const done = finishDataPatch(s);
    const log = done.log.slice();
    const outRsrc = rsrc && rsrc.length ? translateResourceFork(rsrc, T, report, log) : rsrc;
    return { data: writeDelverArchive(done.spec), rsrc: outRsrc, log, report, changed: done.changed };
  } finally {
    dvmSetResourceSymbols(keepSyms);
    dvmContextResid = keepCtx;
  }
}

/* ---- the letters Spanish needs, in Argos A Nouveau -------------------------- */

/* The acute on the ten vowels, the tilde on n and N, the diaeresis on u and
   U, and the inverted marks, each one flat outline made of the font's own
   letter and a mark drawn here, mapped at the control codes of
   TRANSLATE_CODES and at their Mac Roman bytes too (a resource-fork string,
   such as the conversation window's buttons, carries the real byte). The
   shapes and every proportion are mkfont-es3-proof.py's, the one seen on
   Mac OS 8.5: an acute of the straight quote scaled down was barely visible,
   so it is a drawn wedge; the i loses its dot, the contour that sits
   highest, before it takes the acute; ¿ and ¡ are ? and ! turned half a
   circle and sunk a fifth of an em. A mark is drawn clockwise, as TrueType
   wants an outer contour, though a mark that overlaps nothing fills either
   way. */
const TRANSLATE_MACROMAN = { 'á': 0x87, 'é': 0x8E, 'í': 0x92, 'ó': 0x97, 'ú': 0x9C, 'ñ': 0x96, 'ü': 0x9F, '¿': 0xC0,
  '¡': 0xC1, 'Á': 0xE7, 'É': 0x83, 'Í': 0xEA, 'Ó': 0xEE, 'Ú': 0xF2, 'Ñ': 0x84, 'Ü': 0x86 };
function translateSpanishGlyphs(sfnt) {
  const { upem, glyphs } = sfntGlyphOutlines(sfnt);
  const cmap = sfntTablesOf(sfnt).cmap;
  let mac = -1;
  for (let i = 0; i < u16be(cmap, 2); i++) { const p = 4 + i * 8; if (u16be(cmap, p) === 1 && u16be(cmap, p + 2) === 0) mac = u32be(cmap, p + 4); }
  if (mac < 0) throw new Error('the conversation font has no Mac Roman cmap');
  const gidOf = ch => { const g = cmap[mac + 6 + ch.charCodeAt(0)]; if (!g || !glyphs[g] || !glyphs[g].contours.length) throw new Error('the conversation font has no ' + ch); return g; };
  const R = Math.round;
  const box = cs => { const p = [].concat(...cs); return [Math.min(...p.map(q => q.x)), Math.min(...p.map(q => q.y)), Math.max(...p.map(q => q.x)), Math.max(...p.map(q => q.y))]; };
  const poly = pts => pts.slice().reverse().map(([x, y]) => ({ x: R(x), y: R(y), on: true }));
  const move = (cs, dx, dy) => cs.map(c => c.map(q => ({ x: R(q.x + dx), y: R(q.y + dy), on: q.on })));
  const gap = upem * 0.05, thick = upem * 0.055;
  const wedge = (len, th) => { const dx = len * 0.55, dy = len; return [poly([[0, 0], [th, 0], [dx + th * 0.6, dy], [dx - th * 0.4, dy]])]; };
  const wave = (w, th, amp, N) => {
    N = N || 16;
    const top = [], bot = [];
    for (let i = 0; i <= N; i++) { top.push([i / N * w, amp * Math.sin(2 * Math.PI * i / N) + th / 2]); bot.push([i / N * w, amp * Math.sin(2 * Math.PI * i / N) - th / 2]); }
    // along the top to the right and back along the bottom is clockwise already
    return [top.concat(bot.reverse()).map(([x, y]) => ({ x: R(x), y: R(y), on: true }))];
  };
  const dots = (sep, r) => [0, sep].map(cx => { const p = []; for (let k = 0; k < 12; k++) p.push([cx + r * Math.cos(2 * Math.PI * k / 12), r * Math.sin(2 * Math.PI * k / 12)]); return poly(p); });
  const marks = {
    acute: wedge(upem * 0.17, upem * 0.075),
    tilde: wave(upem * 0.36, thick, upem * 0.035),
    tildecap: wave(upem * 0.46, thick, upem * 0.04),
    dieresis: dots(upem * 0.17, upem * 0.045),
  };
  const above = (baseCs, mark) => {
    const b = box(baseCs), m = box(mark);
    return baseCs.concat(move(mark, (b[0] + b[2]) / 2 - (m[0] + m[2]) / 2, b[3] + gap - m[1]));
  };
  const letter = ch => glyphs[gidOf(ch)];
  // The i without its dot: every contour but the one that reaches highest.
  const iCs = letter('i').contours.slice();
  const tops = iCs.map(c => Math.max(...c.map(q => q.y)));
  iCs.splice(tops.indexOf(Math.max(...tops)), 1);
  const made = {};
  for (const [ch, base] of [['á', 'a'], ['é', 'e'], ['ó', 'o'], ['ú', 'u'], ['Á', 'A'], ['É', 'E'], ['Í', 'I'], ['Ó', 'O'], ['Ú', 'U']])
    made[ch] = { contours: above(letter(base).contours, marks.acute), adv: letter(base).adv };
  made['í'] = { contours: above(iCs, marks.acute), adv: letter('i').adv };
  made['ñ'] = { contours: above(letter('n').contours, marks.tilde), adv: letter('n').adv };
  made['Ñ'] = { contours: above(letter('N').contours, marks.tildecap), adv: letter('N').adv };
  made['ü'] = { contours: above(letter('u').contours, marks.dieresis), adv: letter('u').adv };
  made['Ü'] = { contours: above(letter('U').contours, marks.dieresis), adv: letter('U').adv };
  for (const [ch, base] of [['¿', '?'], ['¡', '!']]) {
    const cs = letter(base).contours, b = box(cs);
    made[ch] = { contours: cs.map(c => c.map(q => ({ x: R(-q.x + b[0] + b[2]), y: R(-q.y + b[1] + b[3] - upem * 0.22), on: q.on }))), adv: letter(base).adv };
  }
  const order = Object.keys(TRANSLATE_CODES);
  const codes = {};
  order.forEach((ch, i) => { codes[TRANSLATE_CODES[ch]] = i; codes[TRANSLATE_MACROMAN[ch]] = i; });
  return sfntWithGlyphs(sfnt, order.map(ch => made[ch]), codes);
}
