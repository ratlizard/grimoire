/* The Data sheets: the zone backdrops, the executable's keys and preferences record, cheats, the saved game, the installer, the combat AI, changes.

   One of the fourteen js/page-*.js files that were index.html's inline
   script until 16 September 2026, cut at its own section banners and
   nowhere else, so every function is where it was in the one file. This
   tier knows the page's furniture: js/mac-*.js know nothing of Cythera,
   js/delv-*.js know the formats but not the page, and these know both.
   They are classic scripts, never modules, because the page has to work
   from a file:// origin, and they share one global scope, so a name
   declared in any of them is reachable from all. The order only decides
   what has run when a statement runs at load time; the one such statement
   that needed a later file, the brand line, stayed in the page after the
   last of these. File 9 of 14. */

/* ---- The backdrop behind a zone -----------------------------------------------
   Every zone's entry script calls SetLandscapeImage once, with a literal.
   Zero and up is a landscape strip (0x84xx); the negative numbers are the
   engine's own backdrops, and -1 -- Land King Hall, and only Land King Hall
   in the shipped archive -- is the wavy space drawn behind the ethereal
   void, whose tiles are three-quarters transparent. That backdrop is the
   pair 0x8F50/0x8F51, 144x144 each and the only two general graphics in
   that range, alternating. The other negatives (-9, -12, -13, -15, -16) have
   no image in the archive at all, so they are taken to be solid colours the
   engine keeps, and nothing is drawn for them. This is a reading of the
   scripts plus the one image pair that fits, not a documented rule. */
function zoneLandscapeArg(level) {
  if (!DERIVED.ZONE_BACKDROPS) DERIVED.ZONE_BACKDROPS = Object.create(null);
  if (level in DERIVED.ZONE_BACKDROPS) return DERIVED.ZONE_BACKDROPS[level];
  let found = null;
  try {
    const resid = 0x1400 + level;
    const raw = getResourceBytes(ARCHIVE, resid);
    const data = raw && raw.length ? smartDecrypt(raw, resid).data : null;
    const disc = data ? dvmDiscover(data, resid) : null;
    if (disc && disc.tableOffset !== null) {
      const offs = Object.keys(disc.kinds).map(Number).sort((x, y) => x - y);
      for (const off of offs) {
        if (found !== null || disc.kinds[off] !== 'function') continue;
        let end = data.length;
        for (const o2 of offs) if (o2 > off && o2 < end) end = o2;
        let ops;
        try { ops = dvmDisassemble(data.slice(off, end), 3).ops; } catch (e) { continue; }
        for (let k = 0; k < ops.length; k++) {
          if (String(ops[k][2]) !== 'sys SetLandscapeImage') continue;
          const nx = ops[k + 1];
          if (!nx) break;
          const v = String(nx[3]);
          if (nx[2] === 'byte') found = parseInt(v, 16);
          else if (/^-?\d+$/.test(v)) found = parseInt(v, 10);
          break;
        }
      }
    }
  } catch (e) { quiet(e); }
  return (DERIVED.ZONE_BACKDROPS[level] = found);
}
// The zones whose entry script sets landscape strip `resid` (0x8400 + n).
function landscapeZones(resid) {
  const n = resid - 0x8400, out = [];
  for (let level = 0; level < 256; level++) {
    if (!refExists(0x8000 + level)) continue;
    if (zoneLandscapeArg(level) === n) out.push(zoneNameFor(0x8000 + level) || ('0x' + (0x8000 + level).toString(16).toUpperCase()));
  }
  return out;
}
function zoneBackdrop(level) {
  return zoneLandscapeArg(level) === -1 && refExists(0x8F50) && refExists(0x8F51) ? [0x8F50, 0x8F51] : null;
}
const _backdropCanvases = derivedMap('_backdropCanvases');
function backdropPattern(ctx, resid, TS) {
  try {
    let c = _backdropCanvases.get(resid);
    if (!c) {
      const d = decodeResource(ARCHIVE, getResourceBytes(ARCHIVE, resid), 142, resid);
      c = document.createElement('canvas');
      // Index 0 is the transparent slot, and in the game the void behind it
      // is black; drawn opaque it came out as white with black waves.
      drawToCanvas(c, d.W, d.H, d.image, 0);
      _backdropCanvases.set(resid, c);
    }
    const pat = ctx.createPattern(c, 'repeat');
    const M = window.DOMMatrix;
    if (pat && pat.setTransform && TS !== 32 && typeof M === 'function') pat.setTransform(new M().scale(TS / 32));
    return pat;
  } catch (e) { return null; }
}
const _tileClearCache = derivedMap('_tileClearCache');
function tileHasTransparency(t) {
  if (_tileClearCache.has(t)) return _tileClearCache.get(t);
  let clear = false;
  try { const img = resolveTileImage(t); if (img) for (const v of img) if (!v) { clear = true; break; } } catch (e) { quiet(e); }
  _tileClearCache.set(t, clear);
  return clear;
}

/* ---- Data > Cythera Data > Data Fork ------------------------------------
   The file as it is: one row per subindex the master index points at, with
   the count and the bytes behind it and, for each one this page shows
   somewhere, the tab it shows it under. This is the map from the archive's
   own structure to the tree above it, and it is the view to start from when
   a subindex is not where you expected. */
/* THE KEYS, off the program. TMapWindow::KeyRoutine(short) is the map
   window's key handler, and what the Cheats sheet says about a key is read
   out of it here rather than kept in a table:

   - THE ROLLING WORD. The key's low byte is shifted into a global word
     (`clrlwi 0, key, 24` then `rlwimi 0, word, 8, 0, 23`), and the word is
     tested against constants as an `addis`/`cmplwi` pair, the compiler's way
     of comparing 32 bits: the constant is the `cmplwi` operand less the
     `addis` operand shifted up 16. The first such test is the cheat code,
     the others the CD words.
   - THE GATE. After the code's test the routine takes the address of a
     global record (`addi r, 2, d`), loads one byte of it and tests one bit;
     then it flips a byte (`lbz`, `cntlzw`, `srwi 5`, `stb`, a logical not)
     and prints one of two strings. The flipped byte's base register is the
     cheat flag the gated cases test first.
   - THE SWITCH. The key is sign-extended and searched by a binary tree of
     `cmpwi` and `bt`/`bf` on the less-than and equal bits. Rather than
     trusting the tree's shape, every key from -128 to 511 is run through it
     by an interpreter of those instructions; the address most keys reach is
     the default and every other address a case, with the keys that reach it
     and the compare that sent each there.
   - A CASE is the instructions from its address to the next case's: whether
     it begins by testing the cheat flag, the strings it loads through the
     TOC, the routines it calls with the constants loaded into r3 to r10
     just before, the bytes it flips, and whether it runs on into the next
     case without a branch.

   Every figure is { v, exe }, so the sheet links it to its instruction. */
function exeKeyRoutine() {
  const r = exeRoutineNamed('TMapWindow::KeyRoutine');
  const ops = exeOpsOf(r), img = appImage();
  if (!r || !ops.length || !img || !img.toc) return null;
  const index = a => { const k = (a - r.offset) / 4; return k >= 0 && k < ops.length && k === Math.floor(k) ? k : -1; };
  const string = o => {
    const d = o && o.d; if (!d || d.mn !== 'lwz' || d.ra !== 2) return null;
    const p = pefPointerAt(img, img.toc.section, img.toc.offset + d.d);
    const t = p && p.section !== undefined ? exeStringAt(p) : null;
    return t === null ? null : { v: t, exe: o.at };
  };
  const wordAt = i => {
    const a = ops[i] && ops[i].d, b = ops[i + 1] && ops[i + 1].d;
    return a && b && a.mn === 'addis' && b.mn === 'cmplwi' && b.ra === a.rd ? ((b.imm - (a.imm * 65536)) >>> 0) : null;
  };
  const out = { routine: r, gate: null, words: [], cases: [], volume: [], defaultAt: null, keyReg: null };
  const roll = exeFind(ops, 0, ops.length, d => d.mn === 'rlwimi' && d.sh === 8 && d.mb === 0 && d.me === 23);
  if (roll < 0) return null;
  out.shift = exeVal(ops[roll], ops[roll].d.sh);
  for (let i = roll; i + 1 < ops.length; i++) {
    const w = wordAt(i); if (w === null) continue;
    out.words.push({ v: decodeMacRoman(new Uint8Array([w >>> 24, (w >>> 16) & 255, (w >>> 8) & 255, w & 255])), word: w, exe: ops[i + 1].at, i });
  }
  if (!out.words.length) return null;
  // The gate: the record, its byte and bit, the flag flipped, the two lines.
  {
    const g = out.words[0], i = g.i + 2;
    const rec = exeFind(ops, i, 4, d => d.mn === 'addi' && d.ra === 2);
    const byte = rec >= 0 ? exeFind(ops, rec + 1, 2, d => d.mn === 'lbz' && d.ra === ops[rec].d.rd) : -1;
    const bit = byte >= 0 ? exeFind(ops, byte + 1, 2, d => /^(rlwinm|clrlwi)\.$/.test(d.mn) && d.mb === d.me && d.rs === ops[byte].d.rt) : -1;
    const flip = exeFind(ops, i, 16, d => d.mn === 'cntlzw');
    const load = flip >= 0 ? exeFindBack(ops, flip, 3, d => d.mn === 'lbz' && d.d === 0) : -1;
    const lines = [];
    for (let k = flip; k >= 0 && k < flip + 16 && lines.length < 2; k++) { const t = string(ops[k]); if (t) lines.push(t); }
    out.gate = {
      word: g, recordTocD: rec >= 0 ? ops[rec].d.imm : null,
      byte: byte >= 0 ? exeVal(ops[byte], ops[byte].d.d) : null,
      bit: bit >= 0 ? exeVal(ops[bit], ((31 - ops[bit].d.me) - ops[bit].d.sh + 32) % 32) : null,
      flagReg: load >= 0 ? ops[load].d.ra : null, flip: flip >= 0 ? exeVal(ops[flip], null) : null,
      on: lines[0] || null, off: lines[1] || null
    };
  }
  // The CD words: each with the key code that does the same, and the call.
  for (const w of out.words.slice(1)) {
    const alt = exeFind(ops, w.i + 2, 4, d => d.mn === 'cmpwi');
    const call = exeFind(ops, w.i + 2, 12, d => d.mn === 'bl');
    w.key = alt >= 0 ? exeVal(ops[alt], ops[alt].d.imm) : null;
    w.call = call >= 0 ? exeVal(ops[call], exeTargetName(ops[call].to)) : null;
  }
  // The switch.
  let root = -1;
  for (let k = 0; k + 3 < ops.length && root < 0; k++) {
    const d = ops[k].d, c = ops[k + 1].d, t = ops[k + 2].d, f = ops[k + 3].d;
    if (d && d.mn === 'extsh' && c && c.mn === 'cmpwi' && c.ra === d.ra && t && t.mn === 'bt' && t.bi === 2 && f && f.mn === 'bf' && f.bi === 0) root = k;
  }
  if (root < 0) return out;
  const reg = ops[root].d.ra;
  out.keyReg = ops[root].d.rs;
  const walk = key => {
    let i = root + 1, cr = 0, last = -1;
    for (let steps = 0; steps < 64 && i >= 0; steps++) {
      const d = ops[i].d;
      if (d && d.mn === 'cmpwi' && d.ra === reg) { cr = key < d.imm ? 8 : key > d.imm ? 4 : 2; last = i; i++; continue; }
      if (d && (d.mn === 'bt' || d.mn === 'bf') && d.bi <= 2) { const set = (cr & [8, 4, 2][d.bi]) !== 0; i = (d.mn === 'bt' ? set : !set) ? index(ops[i].at + d.disp) : i + 1; continue; }
      if (d && d.mn === 'b' && !d.aa) { i = index(ops[i].at + d.disp); continue; }
      return { i, last };
    }
    return null;
  };
  const reach = new Map();
  for (let key = -128; key < 512; key++) {
    const w = walk(key); if (!w) continue;
    if (!reach.has(w.i)) reach.set(w.i, { i: w.i, keys: [] });
    reach.get(w.i).keys.push({ v: key, exe: w.last >= 0 ? ops[w.last].at : null });
  }
  const groups = [...reach.values()].sort((a, b) => b.keys.length - a.keys.length);
  if (!groups.length) return out;
  out.defaultAt = ops[groups[0].i].at;
  const starts = groups.map(g => g.i).sort((a, b) => a - b);
  for (const g of groups.slice(1).sort((a, b) => a.keys[0].v - b.keys[0].v)) {
    const next = starts.find(k => k > g.i);
    const end = next === undefined ? ops.length : next;
    const body = ops.slice(g.i, end);
    const d0 = body[0] && body[0].d, d1 = body[1] && body[1].d, d2 = body[2] && body[2].d;
    const calls = [];
    body.forEach((o, k) => {
      if (o.mn !== 'bl' || o.to === null) return;
      const args = {};
      for (let j = k - 1; j >= Math.max(0, k - 8); j--) {
        const d = body[j].d; if (!d) continue;
        if (d.mn === 'bl') break;
        if (d.mn === 'li' && d.rd >= 3 && d.rd <= 10 && !(d.rd in args)) args[d.rd] = exeVal(body[j], d.imm);
      }
      calls.push({ v: exeTargetName(o.to).replace(/\(.*$/, ''), exe: o.at, args });
    });
    const tail = body[body.length - 1].d;
    out.cases.push({
      at: ops[g.i].at, keys: g.keys, ops: body,
      gated: d0 && d0.mn === 'lbz' && d0.ra === out.gate.flagReg && d0.d === 0 && d1 && d1.mn === 'cmplwi' && d1.imm === 0 && d2 && d2.mn === 'bt' ? exeVal(body[0], true) : null,
      strings: body.map(string).filter(Boolean), calls,
      flips: body.filter(o => o.mn === 'cntlzw').map(o => exeVal(o, null)),
      fallsInto: tail && tail.mn !== 'b' && tail.mn !== 'blr' && next !== undefined ? ops[next].at : null
    });
  }
  // The volume keys, tested before the switch: the step each adds and the
  // bound it is held to.
  for (let k = 0; k < root; k++) {
    const d = ops[k].d;
    if (!d || d.mn !== 'cmpwi' || !ops[k - 1] || !ops[k - 1].d || ops[k - 1].d.mn !== 'extsh' || ops[k - 1].d.rs !== out.keyReg) continue;
    const step = exeFind(ops, k + 1, 14, e => e.mn === 'addi' && e.ra === e.rd && e.ra !== 1 && e.ra !== 2 && (e.imm === 10 || e.imm === -10 || Math.abs(e.imm) < 64) && e.imm !== 0);
    if (step < 0 || ops[step].at - ops[k].at > 60) continue;
    const bound = exeFind(ops, step + 1, 6, e => e.mn === 'cmpwi');
    out.volume.push({ key: exeVal(ops[k], d.imm), step: exeVal(ops[step], ops[step].d.imm), bound: bound >= 0 ? exeVal(ops[bound], ops[bound].d.imm) : null });
  }
  return out;
}

/* The wall bitmap's test, off TGameViewer::MakeBitMap: the tile word masked
   to an index into the attribute table (`rlwinm r, tile, 2, mb, me`, the
   index shifted up two for the word table), then the attributes `andi.`-ed
   with a mask and compared with the same mask. */
function exeWallMask() {
  const ops = exeOpsNamed('TGameViewer::MakeBitMap');
  const t = exeFind(ops, 0, ops.length, d => d.mn === 'andi.' && d.imm);
  if (t < 0 || !ops[t + 1] || !ops[t + 1].d || ops[t + 1].d.mn !== 'cmpwi' || ops[t + 1].d.imm !== ops[t].d.imm) return null;
  const ix = exeFindBack(ops, t, 4, d => d.mn === 'rlwinm' && d.sh === 2);
  const tiles = ix >= 0 ? ((1 << (ops[ix].d.me - ops[ix].d.mb + 1)) - 1) : null;
  return tiles ? { mask: exeVal(ops[t], ops[t].d.imm), tiles: exeVal(ops[ix], tiles) } : null;
}
// Every C string a routine loads through the TOC, in order.
function exeStringsOf(name) {
  const img = appImage(); if (!img || !img.toc) return [];
  return exeOpsNamed(name).map(o => {
    const d = o.d; if (!d || d.mn !== 'lwz' || d.ra !== 2) return null;
    const p = pefPointerAt(img, img.toc.section, img.toc.offset + d.d);
    const t = p && p.section !== undefined ? exeStringAt(p) : null;
    return t === null ? null : { v: t, exe: o.at };
  }).filter(Boolean);
}

/* THE PREFERENCES RECORD, every use of it in the program. The record is the
   global the key routine's gate tests (its TOC displacement is read there),
   and every routine that takes its address (`addi r, 2, d`) is scanned for
   what it does with it:

   - a READ is a `lbz` of one of its bytes followed, within a few
     instructions and on the same register, by an extraction of some of the
     byte's bits -- a rotate-and-mask (`rlwinm`, `clrlwi`, `srwi`) or an
     `andi.` -- which says which bits the routine wants;
   - a WRITE is a `stb` into it preceded by an `rlwimi` (bits inserted, with
     the value when it was loaded by `li` just before, or "toggled" when it
     came out of a `cntlzw`) or an `ori`;
   - what CHOOSES a write is the compare tree it sits under (exeCaseValues:
     a menu item, a dialog item, a slider's position), and the routine's own
     menu or dialog (the constant it hands GetMenuHandle or GetNewDialog,
     and the item it hands GetDialogItem), so the page can name the item out
     of the application's MENU and DITL resources;
   - a Pascal string loaded after reads that initialise a control is that
     control's LABEL, for every read since the previous label.

   A byte loaded and not masked is not counted, so a field is only named by
   a routine that tests it. The scan runs once per program and is kept. */
function exePrefsAccess() {
  const pef = appPef(), img = appImage();
  if (!pef || !img || !img.toc || !pef.routines) return null;
  if (pef.prefsAccess !== undefined) return pef.prefsAccess;
  const keys = exeKeyRoutine();
  const recD = keys && keys.gate ? keys.gate.recordTocD : null;
  if (recD === null) return (pef.prefsAccess = null);
  const range = d => {
    if (d.mn === 'andi.') { const m = d.imm & 0xFF; if (!m) return null; const lo = 31 - Math.clz32(m & -m), hi = 31 - Math.clz32(m); return ((1 << (hi + 1)) - (1 << lo)) === m ? [lo, hi] : null; }
    if (!/^(rlwinm|clrlwi|rotlwi|srwi)\.?$/.test(d.mn) || d.mb === undefined || d.mb > d.me) return null;
    const lo = ((31 - d.me) - d.sh + 32) % 32, hi = ((31 - d.mb) - d.sh + 32) % 32;
    return lo <= hi && hi < 8 ? [lo, hi] : null;
  };
  const out = { recordTocD: recD, reads: [], writes: [], passes: [] };
  const lo16 = recD & 0xFFFF;
  for (const r of pef.routines) {
    // A cheap look before decoding: an addi from r2 whose low half is the
    // record's displacement.
    let seen = false;
    for (let a = r.offset; a + 4 <= r.offset + r.length && !seen; a += 4)
      if ((img.code[a] >> 2) === 14 && ((img.code[a + 1] & 31) === 2) && ((img.code[a + 2] << 8) | img.code[a + 3]) === lo16) seen = true;
    if (!seen) continue;
    const ops = exeOpsOf(r);
    const holds = new Set();
    const reads = [], labels = [];
    // The routine's own menu, dialog and dialog items, by the calls' constants.
    const callArg = (name, reg) => ops.map((o, k) => exeCalls(o, name) ? exeArgOf(ops, k, reg) : null).filter(Boolean);
    const menu = callArg('GetMenuHandle', 3)[0] || null, dialog = callArg('GetNewDialog', 3)[0] || null, items = callArg('GetDialogItem', 4);
    ops.forEach((o, i) => {
      const d = o.d; if (!d) return;
      const lab = exePascalAt(o); if (lab) labels.push({ i, lab });
      if (d.mn === 'addi' && d.ra === 2 && d.imm === recD) { holds.add(d.rd); return; }
      if (d.mn === 'lbz' && holds.has(d.ra)) {
        for (let j = i + 1; j < Math.min(ops.length, i + 9); j++) {
          const e = ops[j].d; if (!e) continue;
          const f = e.rs === d.rt ? range(e) : null;
          if (f) { reads.push({ i, routine: r, byte: exeVal(o, d.d), bits: exeVal(ops[j], f), label: null }); break; }
          if ((e.rd === d.rt || e.rt === d.rt) && e.mn !== 'rlwimi') break;
        }
      }
      if (d.mn === 'stb' && holds.has(d.ra)) {
        for (let j = i - 1; j >= Math.max(0, i - 6); j--) {
          const e = ops[j].d; if (!e) continue;
          if ((e.mn === 'rlwimi' || e.mn === 'ori') && e.ra === d.rt) {
            let f = null, value = null;
            if (e.mn === 'ori') { f = range({ mn: 'andi.', imm: e.imm }); value = f ? exeVal(ops[j], (1 << (f[1] - f[0] + 1)) - 1) : null; }
            else {
              f = e.mb <= e.me && 31 - e.mb < 8 ? [31 - e.me, 31 - e.mb] : null;
              for (let k = j - 1; k >= Math.max(0, j - 8); k--) {
                const g = ops[k].d; if (!g) continue;
                if (g.mn === 'li' && g.rd === e.rs) { value = exeVal(ops[k], g.imm); break; }
                if (g.mn === 'cntlzw' && g.ra === e.rs) { value = exeVal(ops[k], 'toggled'); break; }
                if (g.rd === e.rs || g.rt === e.rs || (g.ra === e.rs && g.rs !== undefined)) break;
              }
            }
            if (!f) break;
            out.writes.push({ routine: r, byte: exeVal(o, d.d), bits: exeVal(ops[j], f), value, chosen: exeCaseValues(ops, i, 0, 300), menu, dialog, items });
            break;
          }
        }
      }
      if (d.mn === 'addi' && d.imm === 0 && holds.has(d.ra)) out.passes.push({ routine: r, exe: o.at });
      const dest = d.rd !== undefined ? d.rd : d.mn.startsWith('l') && d.rt !== undefined ? d.rt : undefined;
      if (dest !== undefined && holds.has(dest) && !(d.mn === 'addi' && d.ra === 2)) holds.delete(dest);
    });
    // Each label names the reads since the one before it, in a routine that
    // builds several controls that way (a dialog), and nowhere else.
    let prev = -1;
    const named = [];
    for (const { i, lab } of labels) { const got = reads.filter(x => x.i < i && x.i > prev && !x.label && i - x.i < 40); if (got.length) named.push({ lab, got }); prev = i; }
    if (new Set(named.map(n => n.got[0].byte.v + ':' + n.got[0].bits.v.join())).size >= 3) for (const n of named) for (const x of n.got) x.label = n.lab;
    out.reads.push(...reads);
  }
  return (pef.prefsAccess = out);
}

/* The record as fields: every run of bits some routine reads or writes, with
   who reads it, who writes it and what chooses each write, named from the
   application's own MENU, DLOG and DITL resources where a menu or a dialog
   chooses it and from the preferences dialog's labels where a control
   does. */
function exePrefFields() {
  const acc = exePrefsAccess(); if (!acc) return null;
  const fork = window.APP_RSRC;
  const res = (t, id) => { try { const e = fork && (fork.resourcesByType[t] || []).find(x => x.id === id); return e ? fork.dataOf(t, e) : null; } catch (e) { return null; } };
  const rows = new Map();
  const row = (byte, f) => { const k = byte + ':' + f[0] + ':' + f[1]; if (!rows.has(k)) rows.set(k, { byte, lo: f[0], hi: f[1], readers: [], writers: [] }); return rows.get(k); };
  for (const x of acc.reads) row(x.byte.v, x.bits.v).readers.push(x);
  for (const w of acc.writes) {
    const f = w.bits.v, r = row(w.byte.v, f);
    // The control this bit belongs to in a dialog that reads it with a label.
    const lab = acc.reads.find(x => x.label && x.byte.v === w.byte.v && x.bits.v[0] <= f[0] && x.bits.v[1] >= f[1]);
    let item = null;
    if (w.menu && w.chosen) {
      const m = res('MENU', w.menu.v), texts = m ? menuItemTexts(m) : [];
      item = { menu: w.menu, title: m ? pstr(m, 14).s : null, values: w.chosen.values, texts: w.chosen.values.map(v => texts[v - 1]).filter(Boolean), exe: w.chosen.exe };
    } else if (w.dialog) {
      const dl = res('DLOG', w.dialog.v), ditlId = dl && dl.length >= 20 ? ((dl[18] << 8) | dl[19]) : w.dialog.v;
      const texts = ditlItemTexts(res('DITL', ditlId));
      const values = w.value === null ? w.items.map(x => x.v) : w.chosen ? w.chosen.values : [];
      item = { dialog: w.dialog, ditl: ditlId, values, texts: values.map(v => texts[v - 1]).filter(Boolean), exe: w.value === null && w.items[0] ? w.items[0].exe : w.chosen ? w.chosen.exe : null };
    }
    r.writers.push(Object.assign({}, w, { label: lab ? lab.label : null, item }));
  }
  return [...rows.values()].sort((a, b) => a.byte - b.byte || b.hi - a.hi);
}

/* What the game stores when there are no preferences: TDelverApp::PostInitMac
   writes the whole record once for each processor class, each word loaded
   from the data section (`addi r, 2, d`, `lwz 0, 0(r)`, `stw 0, 0(record)`),
   and the compare tree above each write, over the answer Gestalt gave less
   one, says which processors get it. The selectors are the `lis`/`addi`
   pairs handed to Gestalt. */
function exePrefDefaults() {
  const acc = exePrefsAccess(); if (!acc) return null;
  const r = exeRoutineNamed('TDelverApp::PostInitMac'); const ops = exeOpsOf(r); if (!ops.length) return null;
  let rec = -1;
  for (let k = 0; k < ops.length && rec < 0; k++) if (ops[k].d && ops[k].d.mn === 'addi' && ops[k].d.ra === 2 && ops[k].d.imm === acc.recordTocD) rec = ops[k].d.rd;
  const out = { selectors: [], words: [] };
  ops.forEach((o, k) => {
    if (exeCalls(o, 'Gestalt')) {
      const hi = exeFindBack(ops, k, 6, d => d.mn === 'lis' && d.rd === 3), lo = hi >= 0 ? exeFind(ops, hi + 1, 3, d => d.mn === 'addi' && d.ra === 3) : -1;
      if (hi >= 0 && lo >= 0) { const w = ((ops[hi].d.imm * 65536) + ops[lo].d.imm) >>> 0; out.selectors.push({ v: String.fromCharCode(w >>> 24, (w >>> 16) & 255, (w >>> 8) & 255, w & 255), exe: ops[hi].at }); }
    }
    const d = o.d;
    if (d && d.mn === 'stw' && d.ra === rec && d.d === 0) {
      const load = exeFindBack(ops, k - 1, 5, e => e.mn === 'lwz' && e.rt === d.rt && e.d === 0);
      const src = load >= 0 ? exeFindBack(ops, load, 5, e => e.mn === 'addi' && e.ra === 2 && e.rd === ops[load].d.ra) : -1;
      // CodeWarrior may copy through the stack first: follow one hop.
      let base = src;
      if (base < 0 && load >= 0) {
        const stack = exeFindBack(ops, load, 4, e => e.mn === 'stw' && e.ra === 1);
        const l2 = stack >= 0 ? exeFindBack(ops, stack, 4, e => e.mn === 'lwz' && e.rt === ops[stack].d.rt && e.ra !== 1) : -1;
        base = l2 >= 0 ? exeFindBack(ops, l2, 4, e => e.mn === 'addi' && e.ra === 2 && e.rd === ops[l2].d.ra) : -1;
      }
      if (base < 0) return;
      const words = exeDataWords(exeTocOffset(ops[base].d.imm), 1);
      if (!words) return;
      out.words.push({ v: words[0] >>> 0, exe: ops[base].at, chosen: exeCaseValues(ops, k, -1, 300) });
    }
  });
  return out.words.length ? out : null;
}

/* The startup wait: main tests the gate's bit and, when it is set, spins on
   TickCount until the tick count it started at plus a constant. */
function exeStartupWait(gate) {
  const ops = exeOpsNamed('main'); if (!ops.length || !gate || !gate.byte || !gate.bit) return null;
  const acc = exePrefsAccess();
  const read = acc && acc.reads.find(x => x.routine.name === 'main' && x.byte.v === gate.byte.v && x.bits.v[0] === gate.bit.v);
  if (!read) return null;
  const k = ops.findIndex(o => o.at === read.bits.exe);
  const tick = ops.findIndex((o, j) => j > k && exeCalls(o, 'TickCount'));
  const add = tick >= 0 ? exeFind(ops, tick + 1, 4, d => d.mn === 'addi' && d.ra === 3) : -1;
  return add >= 0 ? { read, ticks: exeVal(ops[add], ops[add].d.imm) } : null;
}

/* The preferences file's keys: every call of TPrefs's store and fetch
   routines, the key it passes in r4 (a Pascal string through the TOC, or a
   register loaded from one earlier) and, for SavePrefs and LoadPrefs, the
   length in r6. */
function exePrefKeys() {
  const kinds = { SavePrefs: 'write', SetFile: 'write', SetOrdinal: 'write', LoadPrefs: 'read', GetFile: 'read', GetOrdinal: 'read' };
  const out = new Map();
  for (const [name, dir] of Object.entries(kinds)) {
    for (const c of exeCallersOf('TPrefs::' + name)) {
      const ops = c.ops;
      let key = null, len = null;
      for (let j = c.i - 1; j >= Math.max(0, c.i - 12) && !key; j--) {
        const d = ops[j].d; if (!d) continue;
        if (d.mn === 'lwz' && d.rt === 4 && d.ra === 2) key = exePascalAt(ops[j]);
        else if ((d.mn === 'addi' || d.mn === 'mr') && d.rd === 4 && d.imm === 0 || (d.mn === 'mr' && d.ra === 4)) {
          const from = d.mn === 'mr' ? d.rs : d.ra;
          for (let k = j - 1; k >= 0 && !key; k--) { const e = ops[k].d; if (e && e.mn === 'lwz' && e.rt === from && e.ra === 2) key = exePascalAt(ops[k]); }
        }
      }
      if (name === 'SavePrefs' || name === 'LoadPrefs') len = exeArgOf(ops, c.i, 6);
      if (!key) continue;
      if (!out.has(key.v)) out.set(key.v, { key, kind: name.replace(/^(Save|Load)Prefs$/, 'Prefs').replace(/^(Set|Get)/, ''), len: null, writers: [], readers: [] });
      const e = out.get(key.v);
      if (len && !e.len) e.len = len;
      e[dir === 'write' ? 'writers' : 'readers'].push({ routine: c.routine, exe: ops[c.i].at });
    }
  }
  return [...out.values()];
}

/* A COMPARE TREE, run for a value. A switch compiles to compares of one
   register against constants and branches on the less-than and equal bits,
   sometimes a chain (load, test, branch to the next load and test, body),
   sometimes a binary tree; either way which body a value reaches is what
   running the compares says. exeCaseValues finds the tree the instruction
   at `i` sits under -- the nearest compare before it, the compares,
   branches and reloads of the same register above that, and then back
   along the chain while an earlier identical test branches to this one's
   load -- runs every value from `lo` to `hi` through it, and answers the
   values that arrive at the body holding `i`, with the tested compare's
   address, and `all` when every value arrives (nothing chooses it). An
   instruction the compiler put between a compare and its branch that sets
   no flags is stepped over. */
function exeCaseValues(ops, i, lo, hi) {
  const at0 = ops.length ? ops[0].at : 0;
  const index = a => { const k = (a - at0) / 4; return k >= 0 && k < ops.length && k === Math.floor(k) ? k : -1; };
  let c = -1;
  for (let k = i - 1; k >= Math.max(0, i - 40) && c < 0; k--) { const d = ops[k].d; if (d && (d.mn === 'cmpwi' || d.mn === 'cmplwi')) c = k; }
  if (c < 0) return null;
  const reg = ops[c].d.ra;
  const isCmp = d => d && (d.mn === 'cmpwi' || d.mn === 'cmplwi') && d.ra === reg;
  const isBranch = d => d && (d.mn === 'bt' || d.mn === 'bf' || (d.mn === 'b' && !d.aa));
  const quietOp = (k) => { const d = ops[k] && ops[k].d, n = ops[k + 1] && ops[k + 1].d; return d && n && (n.mn === 'bt' || n.mn === 'bf') && !/\.$|^cmp|^b/.test(d.mn); };
  let root = c;
  while (root > 0 && (isCmp(ops[root - 1].d) || isBranch(ops[root - 1].d) || quietOp(root - 1))) root--;
  let load = root > 0 && ops[root - 1].d && (ops[root - 1].d.ra === reg || ops[root - 1].d.rt === reg || ops[root - 1].d.rd === reg) ? root - 1 : -1;
  // Back along a chain: an earlier identical load and test whose branch
  // lands on this load.
  for (let guard = 0; load >= 0 && guard < 64; guard++) {
    const word = ops[load].d.word, target = ops[load].at;
    let found = -1;
    for (let k = load - 1; k >= Math.max(0, load - 160) && found < 0; k--) {
      if (!ops[k].d || ops[k].d.word !== word) continue;
      for (let j = k + 1; j < Math.min(ops.length, k + 8); j++) {
        const d = ops[j].d;
        if (d && (d.mn === 'bt' || d.mn === 'bf') && ops[j].at + d.disp === target) { found = k; break; }
        if (d && (d.mn === 'bl' || d.mn === 'blr' || (d.mn === 'b' && !d.aa))) break;
      }
    }
    if (found < 0) break;
    load = found;
  }
  const loadWord = load >= 0 ? ops[load].d.word : null;
  const run = v => {
    let k = load >= 0 ? load : root, cr = 0;
    for (let steps = 0; steps < 128 && k >= 0; steps++) {
      const d = ops[k].d;
      if (d && d.word === loadWord) { k++; continue; }
      if (isCmp(d)) {
        const x = d.mn === 'cmplwi' ? v >>> 0 : v, y = d.mn === 'cmplwi' ? d.imm >>> 0 : d.imm;
        cr = x < y ? 8 : x > y ? 4 : 2; k++; continue;
      }
      if (d && (d.mn === 'bt' || d.mn === 'bf') && d.bi <= 2) { const set = (cr & [8, 4, 2][d.bi]) !== 0; k = (d.mn === 'bt' ? set : !set) ? index(ops[k].at + d.disp) : k + 1; continue; }
      if (d && d.mn === 'b' && !d.aa) { k = index(ops[k].at + d.disp); continue; }
      if (quietOp(k)) { k++; continue; }
      return k;
    }
    return -1;
  };
  const arrive = new Map();
  for (let v = lo; v <= hi; v++) { const t = run(v); if (t < 0) continue; if (!arrive.has(t)) arrive.set(t, []); arrive.get(t).push(v); }
  let best = -1;
  for (const t of arrive.keys()) if (t <= i && t > best) best = t;
  if (best < 0) return null;
  // A branch between the body's start and `i` that leaves the body means
  // `i` is not in it.
  for (let k = best; k < i; k++) { const d = ops[k].d; if (d && (d.mn === 'blr' || (d.mn === 'b' && !d.aa && index(ops[k].at + d.disp) > i))) return null; }
  const values = arrive.get(best);
  return { values, all: values.length === hi - lo + 1, exe: ops[c].at, root: ops[load >= 0 ? load : root].at };
}

// The constant a call is handed in r3 (or `reg`), loaded just before it.
function exeArgOf(ops, callIndex, reg) {
  for (let j = callIndex - 1; j >= Math.max(0, callIndex - 8); j--) {
    const d = ops[j].d; if (!d) continue;
    if (d.mn === 'bl') return null;
    if (d.mn === 'li' && d.rd === (reg || 3)) return exeVal(ops[j], d.imm);
  }
  return null;
}
// A Pascal string a TOC slot points at, or null.
function exePascalAt(op) {
  const img = appImage(), d = op && op.d;
  if (!img || !d || d.mn !== 'lwz' || d.ra !== 2) return null;
  const p = pefPointerAt(img, img.toc.section, img.toc.offset + d.d);
  if (!p || p.section === undefined) return null;
  const b = img.contents[p.section] && img.contents[p.section].bytes; if (!b) return null;
  const n = b[p.offset]; if (!n || p.offset + n >= b.length) return null;
  for (let k = 1; k <= n; k++) if (b[p.offset + k] < 0x20) return null;
  return { v: decodeMacRoman(b.subarray(p.offset + 1, p.offset + 1 + n)), exe: op.at };
}

/* ---- Data > Cythera (App) > Cheats ---------------------------------------
   Cythera has a cheat mode, and until 5 September 2026 nobody could reach it.
   The Cutting Room Floor lists a "potential cheat mode" and stops there; this
   is why it stayed potential, and what is behind it.

   EVERYTHING ABOUT THE KEYS IS READ OUT OF THE PROGRAM as the sheet opens:
   exeKeyRoutine walks TMapWindow::KeyRoutine for the gate, the cases and the
   CD words, exePrefFields scans the whole program for the preferences
   record, exePrefDefaults and exeStartupWait read what the game stores and
   waits on. What is typed here is only what the program cannot say: the
   title of each key, a sentence around the figures, and which option-key a
   Mac Roman character is on a US keyboard. Until 11 September 2026 the
   tables themselves were typed from a trace made outside the page; reading
   them corrected three things: the speed limiter is $C2 (option-l), which
   the typed table gave as $C1; the frame-rate cap is a four-bit field that
   the Preferences menu sets to 4, 6 or 8, not two bits; and byte 1's bits 4
   and 5 are written, by the startup dialog that offers to switch to 256
   colours, where the typed table called them written by nothing.

   The gate is why this page can offer the mode at all: `writeResourceFork`
   arrived in v1.18.0 and the Tools tab writes a `Cythera Preferences` file
   with that bit set. Verified once in systemless on 5 September 2026, the
   code typed, "Cheat mode activated." printed, and option-shift-/ answering
   with the player's position in hex.

   `myprintf` writes to the status window and `mygetnum` reads a number typed
   there, in the base the call is handed. */
// The option layer of a US keyboard, by Mac Roman code: which keys make the
// characters the key routine tests. Layout knowledge, not the program's.
const US_OPTION_KEYS = { 0xA9: 'option-g', 0xC6: 'option-j', 0xEF: 'option-shift-j', 0xA7: 'option-s', 0xB9: 'option-p',
  0xC0: 'option-shift-/', 0xFF: 'option-shift-t', 0xA0: 'option-t', 0xC3: 'option-v', 0xBD: 'option-z', 0xB5: 'option-m',
  0xB7: 'option-w', 0xFA: 'option-h', 0xFE: 'option-shift-x', 0xA8: 'option-r', 0xC5: 'option-x', 0xCA: 'option-space',
  0xC2: 'option-l', 0xC1: 'option-1' };
// What each case is, by the key that reaches it: a title, and a sentence
// built from what the case was read to do (`x`, the helpers in
// renderCheatsSheet). A key the program does not have is not listed.
const CHEAT_KEY_WORDS = {
  0xC6: ['Jump', x => 'Prints ' + x.q(0) + ' with the player’s level and square, asks ' + x.prompts(1).join(', ') + ' ' + x.base() + ', then calls ' + x.call('GoToLocation') + ': teleport anywhere in the game.'],
  0xEF: ['Take teleporter', x => 'Asks ' + x.q(0) + ' ' + x.base() + ', then calls ' + x.call('TeleportTo') + '(' + x.arg('TeleportTo', 4) + ', the number, ' + x.arg('TeleportTo', 6) + ').'],
  0xA7: ['Create a prop', x => 'Asks ' + x.asks() + '; ' + x.call('NewProp') + ' makes it, the owner is set to character ' + x.ori() + ' and ' + x.call('Invalidate') + ' redraws the inventory, so the object lands in the hero’s pack. ' +
    'The number is the record’s word, the prop type in the low ten bits and an aspect in the five above: 0x0064 is a spear, 0x0864 the same prop type at aspect 2, wearing the picture two tiles along and named for it. ' +
    'The picture in the pack and the name are the aspect’s; the swing in a fight is the class’s own animation, whatever the aspect. Each item’s page under Entities › Items says what it wears.'],
  0xB9: ['What prop is this?', x => 'Asks ' + x.q(0) + ' ' + x.base() + ' and prints the record as ' + x.q(1) + ' and ' + x.q(2) + ': class and state bytes, position, Data1, Data2.' +
    (x.fallsInto ? ' Then runs on into ' + x.fallsInto + '’s case with no branch between them, a missing break in the game’s own switch.' : '')],
  0xC0: ['Where am I?', x => 'Prints the player’s x and y as ' + x.q(0) + '.'],
  0xFF: ['What time is it?', x => 'Prints ' + x.q(0) + ', the clock word and the day.'],
  0xA0: ['Pass the time', x => 'Calls ' + x.call('DoTicks') + ' with ' + x.arg('DoTicks', 4) + ' clock units' + x.clockWords('DoTicks', 4) + ', then ' + x.call('DrawRoutine') + '.'],
  0x3C: ['Darken', x => x.call('DarkenLight') + ': the level’s ambient light, a step darker.'],
  0x3E: ['Brighten', x => x.call('BrightenLight') + ': the level’s ambient light, a step brighter.'],
  0xC3: ['Magic map', x => x.call('MakeZone') + ' then ' + x.call('MagicMap') + ' around the player, shown until ' + x.call('Button') + ' says the mouse button is down.'],
  0xBD: ['Show the room you are in', x => 'The zone bitmap, drawn with ' + x.call('CopyBits') + ' over the window and offset to the player until the button is pressed. MakeZone(x, y) copies the wall bitmap below and flood-fills it from the player’s square, so what is left clear is the connected open area, which is what InZone answers and what the magic map is built on.'],
  0xB5: ['Show the walls', x => 'The other bitmap, drawn the same way, and the one the flood fill runs against: ' + x.walls()],
  0xB7: ['Walk through anything', x => 'Flips a byte of the game viewer (' + x.flip() + ') that TGameSys::CanMove and TryMove test first, so nothing blocks.'],
  0xFA: ['Nobody is anybody’s enemy', x => x.peace()],
  0xFE: ['See in the dark', x => 'Toggles flag ' + x.flag() + ' on the player, ' + x.call('RemoveAbility') + ' when it is set and ' + x.call('AddAbility') + ' when it is not.'],
  0xA8: ['Regenerate', x => 'Toggles flag ' + x.flag() + ' on the player' + x.statusBit() + ', the six-minute regeneration Omen’s ring grants.'],
  0xC5: ['Swamp protection (broken)', x => x.broken()],
  0xCA: ['Turn-based movement', x => 'Flips a byte (' + x.flip() + ') and prints ' + x.q(1) + ' or ' + x.q(0) + '.'],
  0xC2: ['Speed limiter', x => x.call('SLEnable') + ' or ' + x.call('SLDisable') + ', by a byte it flips (' + x.flip() + ').'],
  0x31: ['A party member’s window', x => 'Opens the character window of a party member, counting from 0 at the key less ' + x.less() + ': ' + x.call('FindInventory') + ' brings an open one forward, and a new ' + x.call('TCharacterWindow') + ' opens one.'],
  0x5A: ['Z stats', x => x.call('PrintZStats') + ' prints ' + x.zstats() + '.'],
  0x100: ['Macros', x => 'Codes the keyboard makes no character for; ' + x.call('PerformMacro') + ' is handed the code less ' + x.less() + '.']
};

/* The menu bars the application ships, off its own fork: TApp::ChangeMenuBar
   builds the bar from MBAR n (deleted) and MBAR n + 1 (inserted), so the
   menus a player can reach are the ids those two resources list. Every MENU
   the fork defines that neither names is unreachable; on the shipped copy
   that is Edit, Audio and Preferences, and add-on 612 is the seven-byte
   patch that appends them to MBAR 128. Null without the application's fork. */
function shippedMenuBars() {
  const fork = window.APP_RSRC;
  if (!fork) return null;
  const titles = new Map();
  for (const e of (fork.resourcesByType['MENU'] || [])) {
    try { const d = fork.dataOf('MENU', e); titles.set(u16be(d, 0), pstr(d, 14).s); } catch (err) { quiet(err); }
  }
  const bars = [];
  const listed = new Set();
  for (const e of (fork.resourcesByType['MBAR'] || [])) {
    let d; try { d = fork.dataOf('MBAR', e); } catch (err) { continue; }
    const ids = [];
    for (let i = 0, p = 2; i < u16be(d, 0) && p + 2 <= d.length; i++, p += 2) ids.push(u16be(d, p));
    ids.forEach(id => listed.add(id));
    bars.push({ id: e.id, menus: ids.map(id => ({ id, title: titles.get(id) || null })) });
  }
  const unlisted = [...titles].filter(([id]) => !listed.has(id)).map(([id, title]) => ({ id, title })).sort((a, b) => a.id - b.id);
  return { bars, unlisted };
}

/* The numbers the jump and teleporter keys ask for, read off the archive. A
   level is the low byte of a map resource id, so the table is every 0x80xx
   the file holds; a teleporter is an index into 0xF00C, the zoneport table
   loadZoneports already reads for the World tab, and the last index with a
   destination in it is the last number that goes anywhere. Above it every
   entry is map 0 at (0,0), which is where the community found BF and above
   landing (web board topic 1830). */
function cheatLevels() {
  const out = [];
  for (let n = 0; n < 0x100; n++) {
    const resid = 0x8000 + n;
    if (!refExists(resid)) continue;
    const script = zoneNameFor(resid), editor = editorZoneName(resid);
    out.push({ n, resid, name: script || editor || labelFor(resid) || ('0x' + resid.toString(16).toUpperCase()), editor, script });
  }
  return out;
}
function cheatTeleporters() {
  const z = loadZoneports();
  let last = 0;
  for (let i = 1; i < z.length; i++) if (z[i].map !== 0x8000 || z[i].x || z[i].y) last = i;
  const byMap = new Map();
  for (let i = 1; i <= last; i++) {
    const t = z[i];
    if (!byMap.has(t.map)) byMap.set(t.map, []);
    byMap.get(t.map).push({ n: i, x: t.x, y: t.y });
  }
  return { last, total: z.length, byMap };
}

/* LEVEL 0 IS THE NOTHING MAP, and its grid is a heap snapshot. The map has a
   header (32 by 32, no roof, no exits) and no prop list; every one of its
   tile words has a zero high byte, so the grid is 1,024 bytes of memory
   widened to words. Those bytes are allocator blocks laid end to end, each
   opening with a 16-byte header: a pointer 0x02C6xxxx, a tag 0xAB0000nn, the
   block's size (0x20 to 0x50), a back-pointer. The size field is the
   distance to the next header, and that is the test: add it to a header's
   position and you land on the next header, 18 times of 19 on the shipped
   file, where the same test on a real map finds no header at all (the
   workbench's own control, matching on each map's commonest byte pair,
   scored 0 of 101, 0 of 110, 0 of 219 and 0 of 49). Two tests that look
   decisive and are not, so they are not tried again: every word below 256
   is true of six real maps too, and adjacent-tile agreement is 39% here
   against 40% and 41% on real maps. The reading is the workbench's
   (doc/cheats.md); this computes it off whatever file is open. */
function nothingMapHeap(resid) {
  const m = getResourceBytes(ARCHIVE, resid);
  if (!m || m.length < 48) return null;
  const words = [];
  for (let i = 32; i + 1 < m.length; i += 2) words.push((m[i] << 8) | m[i + 1]);
  const high = words.filter(w => w > 255).length;
  const b = words.map(w => w & 255);
  const heads = [];
  for (let p = 0; p + 12 <= b.length; p++)
    if (b[p] === 0x02 && b[p + 1] === 0xC6 && b[p + 4] === 0xAB && b[p + 5] === 0 && b[p + 6] === 0 &&
        b[p + 8] === 0 && b[p + 9] === 0 && b[p + 10] === 0) heads.push(p);
  let hits = 0;
  for (const p of heads) if (heads.includes(p + b[p + 11])) hits++;
  return { words: words.length, high, heads: heads.length, hits, w: u16be(m, 0), h: u16be(m, 2) };
}

/* Every prop class some character record wears, named from the archive. This
   is the trick the community did with Pandora's Box, search the running
   game for the short 32, change it, and be a chicken, turned into a field:
   the Saved Game sheet edits `sprite class` on any record, and these are the
   numbers that mean somebody. BreadWorldMercy453's 1999 list was gathered by
   trying values; this one is read off 0xF009, so it cannot drift. */
function cheatSpriteClasses() {
  const seen = new Map();
  const add = (pt, kind) => {
    if (!pt || seen.has(pt)) return;
    let nm = null;
    try { nm = propDisplayName(pt); } catch (e) { quiet(e); }
    if (nm) seen.set(pt, { pt, name: nm, kind });
  };
  // The people first, then the monsters: 0xF009 says which classes a named
  // character wears, 0xF008 which ones a monster does.
  try { for (const pt of [...characterProptypes()].sort((a, b) => a - b)) add(pt, 'person'); } catch (e) { quiet(e); }
  try { for (const m of parseMonsterStats()) if (!m.blank) add(m.proptype, 'monster'); } catch (e) { quiet(e); }
  return [...seen.values()].sort((a, b) => a.pt - b.pt);
}

function renderCheatsSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const key = k => k ? '<kbd class="cheatKey">' + svEsc(k) + '</kbd>' : '';
  const kr = appImage() ? exeKeyRoutine() : null;
  const noApp = 'Open the game from its installer, under Settings, and the application’s code is read here.';
  let h = '<h3 class="cheatH">Cheat mode</h3>' +
    '<div class="mechLede">Cythera has one, and no shipped copy can reach it. The keys, the gate and the preferences record on this page ' +
    'are read out of the application’s own code, <code>TMapWindow::KeyRoutine</code> and every routine that touches the record, ' +
    'rather than collected from players, which is how the things below are known that no amount of playing would show.' +
    (kr ? '' : ' ' + noApp) + '</div>' +
    (kr ? '<div class="partsStrip"><span class="partsTitle">In the executable</span>' + pefChip('TMapWindow::KeyRoutine') + '</div>' : '');

  // The helpers a key's sentence is built with, over one case.
  const chars = w => [...w].map(ch => { const b = encodeMacRoman(ch)[0]; return US_OPTION_KEYS[b] || ch; });
  const comboOf = (k, last) => k < 256 ? (US_OPTION_KEYS[k] || (last && last !== k ? decodeMacRoman(new Uint8Array([k])) + ' to ' + decodeMacRoman(new Uint8Array([last])) : decodeMacRoman(new Uint8Array([k])))) : 'codes ' + k + (last && last !== k ? ' to ' + last : '');
  const caseAt = at => kr && kr.cases.find(c => c.at === at);
  const facts = c => {
    const strip = t => t.v.replace(/^\n+|\n+$/g, '');
    const q = i => c.strings[i] ? '“' + srcNum(c.strings[i], strip(c.strings[i])) + '”' : '';
    const callOf = name => c.calls.find(x => x.v === name || x.v.endsWith('::' + name));
    const bases = c.calls.filter(x => /mygetnum$/.test(x.v)).map(x => x.args[4]).filter(Boolean);
    const baseWord = b => srcNum(b, b.v === 16 ? 'in hex' : b.v === 10 ? 'in decimal' : 'in base ' + b.v);
    const opFact = (test, v) => { const o = c.ops.find(x => x.d && test(x.d)); return o ? exeVal(o, v(o.d)) : null; };
    const enemy = exeEnemyTable();
    const x = {
      q, call: name => { const k = callOf(name); return k ? srcNum(k, name) : svEsc(name); },
      arg: (name, reg) => { const k = callOf(name); return k && k.args[reg] ? srcNum(k.args[reg]) : '?'; },
      prompts: from => c.strings.slice(from).map((t, i) => ({ t, i: i + from })).filter(o => !/^[\n]*%[-#0-9.]*[a-z][\n]*$/.test(o.t.v)).map(o => q(o.i)),
      base: () => bases[0] ? baseWord(bases[0]) : '',
      bases: () => bases.map(baseWord).join(', '),
      // Each prompt with the base of the number read after it.
      asks: () => { const ps = c.strings.map((t, i) => ({ t, i })).filter(o => !/^[\n]*%[-#0-9.]*[a-z][\n]*$/.test(o.t.v)); const parts = ps.map((o, k) => q(o.i) + (bases[k] ? ' ' + baseWord(bases[k]) : '')); return parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts.join(''); },
      ori: () => { const f = opFact(d => d.mn === 'ori' && d.imm > 0, d => d.imm); return f ? srcNum(f) : '?'; },
      less: () => { const f = opFact(d => d.mn === 'addi' && d.ra === kr.keyReg && d.imm < 0, d => -d.imm); return f ? srcNum(f) : '?'; },
      flip: () => c.flips[0] ? srcNum(c.flips[0], 'here') : '',
      flag: () => { const k = callOf('AddAbility'); const f = k && k.args[4]; return f ? srcNum(f) + (DVM_FLAG_NAMES[f.v] ? ' (' + svEsc(DVM_FLAG_NAMES[f.v]) + ')' : '') : '?'; },
      statusBit: () => {
        const k = callOf('AddAbility'), f = k && k.args[4]; if (!f) return '';
        const m = exeAbilityMap().find(r => r.word && r.below.v > f.v && r.sub.v <= f.v);
        return m ? ', which ' + srcNum(m.sub, 'AddAbility') + ' keeps as bit ' + (f.v - m.sub.v) + ' of the status word' : '';
      },
      clockWords: (name, reg) => { const k = callOf(name), clk = exeClockRules(); return k && k.args[reg] && clk && clk.unitsPerHour ? ', ' + exeClockWords(k.args[reg].v, clk.unitsPerHour.v) : ''; },
      fallsInto: c.fallsInto && caseAt(c.fallsInto) ? comboOf(caseAt(c.fallsInto).keys[0].v) : null,
      walls: () => {
        const w = exeWallMask(); if (!w) return 'MakeBitMap walks every square of the level and sets a bit for each wall.';
        const attrs = getTileAttributes(ARCHIVE), names = new Set(); let n = 0;
        for (let t = 0; t <= w.tiles.v && t < attrs.length; t++) if ((attrs[t] & w.mask.v) === w.mask.v) { n++; const nm = terrainNameFor(t); if (nm) names.add(nm); }
        return srcNum(w.mask, 'MakeBitMap') + ' walks every square of the level and sets a bit where the terrain tile’s attributes carry every bit of ' + srcNum(w.mask, '0x' + w.mask.v.toString(16).toUpperCase().padStart(4, '0')) + '. ' +
          'In this file that is ' + n + ' tiles, ' + [...names].map(svEsc).join(', ') + ', so it is the level’s static skeleton, one bit a square.';
      },
      peace: () => {
        if (!enemy || !enemy.peace || !enemy.peaceKey) return 'Flips a byte the enemy test reads first.';
        const callers = exeCallersOf('TActiveMonster::GetEnemyStatus');
        const zero = callers.filter(k => { const n = exeFind(k.ops, k.i + 1, 3, d => d.mn === 'cmpwi' && d.ra === 3); return n >= 0 && k.ops[n].d.imm === 0; });
        const names = [...new Map(zero.map(k => [k.routine.name, k])).values()].map(k => srcNum(exeVal(k.ops[k.i], null), k.routine.name.replace(/\(.*$/, '').replace(/^.*::/, '')));
        return 'Flips the byte (' + srcNum(enemy.peaceKey, 'here') + ') that TActiveMonster::GetEnemyStatus tests first; with it set the routine answers ' + srcNum(enemy.peace) + ' for every pair without consulting its ' + srcNum(enemy.table, enemy.side + '×' + enemy.side) + ' table. ' +
          zero.length + ' of its ' + callers.length + ' calls compare the answer with 0, the enemy, among them ' + names.join(', ') + ', so it makes peace, not war: monsters stop finding targets and an “every enemy” spell finds nobody.';
      },
      peaceShort: () => {
        if (!enemy || !enemy.peace) return '';
        const callers = exeCallersOf('TActiveMonster::GetEnemyStatus');
        const zero = callers.filter(k => { const n = exeFind(k.ops, k.i + 1, 3, d => d.mn === 'cmpwi' && d.ra === 3); return n >= 0 && k.ops[n].d.imm === 0; });
        return 'With its byte set GetEnemyStatus answers ' + srcNum(enemy.peace) + ' for every pair, and ' + zero.length + ' of its ' + callers.length + ' calls take 0 as the enemy, so the cheat empties the enemy list rather than filling it.';
      },
      brokenShort: () => {
        const k = callOf('AddAbility'), who = k && k.args[3], test = opFact(d => d.mn === 'lbz' && d.d > 0, d => d.d);
        return 'It tests byte ' + (test ? srcNum(test) : '?') + ' of character ' + (who ? srcNum(who) : '?') + '’s record rather than the player’s, so it protects no one.';
      },
      broken: () => {
        const k = callOf('AddAbility'), f = k && k.args[4], who = k && k.args[3];
        const test = opFact(d => d.mn === 'lbz' && d.d > 0, d => d.d);
        return 'Means to toggle flag ' + (f ? srcNum(f) + (DVM_FLAG_NAMES[f.v] ? ', ' + svEsc(DVM_FLAG_NAMES[f.v]) : '') : '?') + '. It tests byte ' + (test ? srcNum(test) : '?') + ' of the first character record and hands ' + x.call('AddAbility') + ' character ' + (who ? srcNum(who) : '?') + ', rather than the player, so it toggles a flag on nobody and does nothing.';
      },
      zstats: () => { const z = exeStringsOf('PrintZStats'); return z.length ? z.map(t => '“' + srcNum(t, t.v.replace(/\n+$/, '')) + '”').join(', ') : 'the build’s statistics'; }
    };
    return x;
  };
  const caseRow = c => {
    const k0 = c.keys[0].v, words = CHEAT_KEY_WORDS[k0];
    if (!words) return '';
    const glyph = k0 < 256 && US_OPTION_KEYS[k0] ? decodeMacRoman(new Uint8Array([k0])) : '';
    const last = c.keys[c.keys.length - 1].v;
    const code = k0 < 256 ? srcNum(c.keys[0], '$' + k0.toString(16).toUpperCase().padStart(2, '0') + (c.keys.length > 1 ? ' to $' + last.toString(16).toUpperCase().padStart(2, '0') : '')) : srcNum(c.keys[0], '$' + k0.toString(16).toUpperCase() + ' to $' + last.toString(16).toUpperCase());
    let does = '';
    try { does = words[1](facts(c)); } catch (e) { does = ''; }
    return '<tr><td class="cheatCombo">' + key(comboOf(k0, last)) + (glyph ? ' <span class="cheatGlyph">' + svEsc(glyph) + '</span>' : '') + '<span class="cheatCode">' + code + '</span></td>' +
      '<td><b>' + svEsc(words[0]) + '</b><div class="cheatDoes">' + does + '</div></td></tr>';
  };
  const acc = kr ? exePrefsAccess() : null;
  const fields = kr ? exePrefFields() : null;
  const defaults = kr ? exePrefDefaults() : null;
  const prefKeys = kr ? exePrefKeys() : [];
  const g = kr && kr.gate;

  if (g && g.byte && g.bit) {
    const recKey = prefKeys.find(e => e.kind === 'Prefs' && e.writers.some(w => acc && acc.passes.some(p2 => p2.routine === w.routine)));
    const gateRow = fields && fields.find(f => f.byte === g.byte.v && f.lo <= g.bit.v && f.hi >= g.bit.v);
    const setters = gateRow ? gateRow.writers : [];
    const others = gateRow ? [...new Map(gateRow.readers.filter(r2 => r2.routine !== kr.routine).map(r2 => [r2.routine.name, r2])).values()] : [];
    const wait = exeStartupWait(g);
    const distinct = defaults ? [...new Set(defaults.words.map(w => w.v))] : [];
    const clear = distinct.every(v => !((v >>> (24 - 8 * g.byte.v)) & (1 << g.bit.v)));
    const letters = chars(g.word.v);
    h += '<div class="mechSec"><h4 class="cheatH4">The gate</h4><ul class="ruleList">' +
      '<li>The map window shifts each key’s low byte into a word, ' + srcNum(kr.shift) + ' bits at a time, so the word holds the last four. When it is ' +
      '<b>' + srcNum(g.word, g.word.v) + '</b> (' + letters.map(t => '<b>' + svEsc(t) + '</b>').join(', then ') + ' on a US layout), <i>and</i> ' +
      '<b>bit ' + srcNum(g.bit) + ' of byte ' + srcNum(g.byte) + '</b> of the ' + (recKey && recKey.len ? srcNum(recKey.len) + '-byte “' + srcNum(recKey.key, recKey.key.v) + '”' : 'preferences') + ' record is set, the cheat flag flips (' + srcNum(g.flip, 'here') + ') and the ' +
      'status window prints ' + (g.on ? '“' + srcNum(g.on, g.on.v.replace(/\n+$/, '')) + '”' : 'that it is on') + '.</li>' +
      (setters.length ? '<li>The bit is written by ' + setters.map(w => srcNum(w.bits, w.routine.name.replace(/\(.*$/, ''))).join(', ') + '.</li>'
        : '<li><b>Nothing in the game sets that bit.</b> No routine in the program writes it' + (defaults ? ', and ' + (clear ? 'the ' + distinct.length + ' records the game stores by processor at first run all have it clear' : 'a record the game stores at first run has it set') : '') + '. So on a shipped copy you can type the code for ever and nothing happens.</li>') +
      (others.length ? '<li>The bit has ' + (others.length === 1 ? 'one other reader' : others.length + ' other readers') + ': ' + others.map(r2 => srcNum(r2.bits, r2.routine.name.replace(/\(.*$/, ''))).join(', ') +
        (wait ? ', which spins on TickCount for ' + srcNum(wait.ticks) + ' ticks, ' + (wait.ticks.v / 60) + ' seconds, at startup when it is set' : '') + '.</li>' : '') +
      '<li>The letters of the code arm targeting modes as they go, so the tab reads ATTACK afterwards until you press <b>M</b>.</li></ul>' +
      '<div class="cheatNote">This page can write the preferences file with that bit set, ' +
      actionChip('Tools › Cythera Preferences', "showCategory('TOOLS')") +
      ', as a MacBinary for a real Mac or a small disk image for an emulator.</div></div>';
  }

  // The record, the file's keys, and the menu bars off the application's fork.
  if (fields) {
    const name = r2 => r2.name.replace(/\(.*$/, '');
    const bitsText = f => f.lo === f.hi ? String(f.lo) : f.lo + ' to ' + f.hi;
    const quoted = t => '“' + svEsc(t) + '”';
    const setBy = f => {
      const by = new Map();
      for (const w of f.writers) { if (!by.has(w.routine.name)) by.set(w.routine.name, []); by.get(w.routine.name).push(w); }
      return [...by.values()].map(ws => {
        const w0 = ws[0], menus = [], dialog = [], labels = new Map(), plain = [];
        for (const w of ws) {
          const val = w.value ? (w.value.v === 'toggled' ? 'toggles it' : 'sets ' + srcNum(w.value)) : '';
          if (w.item && w.item.texts.length && w.item.title) menus.push(w.item.texts.map(quoted).join(', ') + (val ? ' ' + val : ''));
          else if (w.item && w.item.texts.length) dialog.push(w.item.texts.map(quoted).join(', ') + (val ? ' ' + val : ''));
          else if (w.label) { if (!labels.has(w.label.v)) labels.set(w.label.v, []); if (w.chosen && !w.chosen.all && val) labels.get(w.label.v).push('at ' + w.chosen.values.join(', ') + ' ' + val); }
          else if (val) plain.push(val + (w.chosen && !w.chosen.all ? '' : ' before it asks'));
        }
        const parts = [];
        if (plain.length) parts.push(plain.join('; '));
        if (menus.length) parts.push('menu “' + svEsc(ws.find(w => w.item && w.item.title).item.title) + '”, ' + menus.join('; '));
        if (dialog.length) parts.push(dialog.join('; '));
        for (const [lab, how] of labels) parts.push('the dialog’s ' + quoted(lab) + (how.length ? ', ' + how.join('; ') : ''));
        return srcNum(w0.bits, name(w0.routine)) + (parts.length ? ': ' + parts.join('; ') : '');
      }).join('<br>');
    };
    const readBy = f => [...new Map(f.readers.map(r2 => [r2.routine.name, r2])).values()].map(r2 => srcNum(r2.bits, name(r2.routine).replace(/^.*::/, ''))).join(', ');
    const rec = prefKeys.find(e => e.kind === 'Prefs' && e.writers.some(w => acc.passes.some(p2 => p2.routine === w.routine)));
    const bytes = rec && rec.len ? rec.len.v : 4;
    const unused = []; for (let b = 0; b < bytes; b++) if (!fields.some(f => f.byte === b)) unused.push(b);
    const hex8 = v => (v >>> 0).toString(16).toUpperCase().padStart(8, '0');
    const ranges = vals => { const out2 = []; let a = null, b = null; for (const v of vals) { if (a === null) { a = b = v; } else if (v === b + 1) b = v; else { out2.push([a, b]); a = b = v; } } if (a !== null) out2.push([a, b]); return out2.map(([x0, x1]) => x0 === x1 ? String(x0) : x0 + ' to ' + x1).join(', '); };
    h += '<div class="mechSec"><h4 class="cheatH4">The preferences record</h4>' +
      '<div class="cheatNote">' + (rec ? srcNum(rec.len || rec.key, bytes + ' bytes') + ', stored under “' + srcNum(rec.key, rec.key.v) + '”. ' : '') +
      'Every field some routine reads or writes, found by scanning the whole program for the record’s address' + (unused.length ? '; byte' + (unused.length > 1 ? 's ' : ' ') + unused.join(' and ') + ' nothing touches' : '') + '. ' +
      'A menu or dialog item is named as the application’s own MENU or DITL resource names it.</div>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><thead><tr><th class="num">byte</th><th class="num">bits</th><th>set by</th><th>read by</th></tr></thead><tbody>' +
      fields.map(f => '<tr><td class="num">' + f.byte + '</td><td class="num">' + bitsText(f) + '</td><td>' + (f.writers.length ? setBy(f) : 'nothing') + '</td><td>' + readBy(f) + '</td></tr>').join('') +
      '</tbody></table></div>' +
      (defaults ? '<div class="cheatNote">When nothing is stored, TDelverApp::PostInitMac asks Gestalt for ' + defaults.selectors.map(t => '‘' + srcNum(t, t.v) + '’').join(', then ') +
        ' and stores, by the answer less one, ' + [...new Map(defaults.words.map(w => [w.v, w])).values()].map(w => {
          const vals = [].concat(...defaults.words.filter(x => x.v === w.v).map(x => x.chosen && !x.chosen.all ? x.chosen.values : [])).sort((a2, b2) => a2 - b2);
          const top = vals.length && vals[vals.length - 1] === 300 ? vals.filter(v => v < 300) : vals;
          let text = ranges(top.filter(v => v >= 0 || !vals.includes(300)));
          if (vals.includes(300)) text = text.replace(/(\d+) to 299$/, '$1 and above');
          return '<b>' + srcNum(w, hex8(w.v)) + '</b>' + (text ? ' at ' + text : '');
        }).join(', ') + '.</div>' : '') +
      '<div class="cheatNote">The file, Cythera Preferences in the System Folder’s Preferences folder, is a keyed store: each key is a ‘Pref’ resource of that name.</div>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><thead><tr><th>key</th><th>holds</th><th>written by</th><th>read by</th></tr></thead><tbody>' +
      prefKeys.map(e => '<tr><td><b>' + srcNum(e.key, e.key.v) + '</b></td><td>' + (e.kind === 'Prefs' ? (e.len ? srcNum(e.len) + ' bytes' : 'bytes') : e.kind === 'File' ? 'a file' : 'a number') + '</td><td>' +
        ([...new Map(e.writers.map(w => [w.routine.name, w])).values()].map(w => srcNum(exeVal({ at: w.exe }, null), name(w.routine))).join(', ') || 'nothing') + '</td><td>' +
        ([...new Map(e.readers.map(w => [w.routine.name, w])).values()].map(w => srcNum(exeVal({ at: w.exe }, null), name(w.routine))).join(', ') || 'nothing') + '</td></tr>').join('') +
      '</tbody></table></div>';
    const bars = shippedMenuBars();
    if (bars && bars.bars.length) {
      const menuName = m => (m.title ? svEsc(m.title) : 'MENU ' + m.id);
      h += '<div class="cheatNote">The menu bar is built from the application’s MBAR resources, ' +
        bars.bars.map(b => 'MBAR ' + b.id + ' (' + b.menus.map(menuName).join(', ') + ')').join(' and ') +
        (bars.unlisted.length
          ? ', so ' + bars.unlisted.map(menuName).join(', ') + (bars.unlisted.length > 1 ? ' are' : ' is') + ' defined in the fork with working handlers and in no bar. ' +
            'That is why the frame-rate cap has no control and why the Preferences menu is as unreachable as the gate. ' +
            'Add-on 612, the Cythera menu patch, is seven bytes appended to MBAR 128 that list the three; 613 takes them out again.'
          : ' and every menu the fork defines is in one of them.') + '</div>';
    }
    h += '</div>';
  }

  if (kr && kr.cases.length) {
    const gated = kr.cases.filter(c => c.gated), open = kr.cases.filter(c => !c.gated);
    const cd = kr.words.slice(1), vol = kr.volume;
    h += '<div class="mechSec"><h4 class="cheatH4">With the cheat flag on</h4>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><tbody>' + gated.map(caseRow).join('') +
      '</tbody></table></div></div>';
    h += '<div class="mechSec"><h4 class="cheatH4">In the same routine, and not gated at all</h4>' +
      '<div class="cheatNote">These work in any copy of the game, cheat mode or not.</div>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><tbody>' + open.map(caseRow).join('') +
      (vol.length >= 2 ? '<tr><td class="cheatCombo">' + key(vol.map(v => decodeMacRoman(new Uint8Array([v.key.v]))).join(' ')) + '<span class="cheatCode">' + vol.map(v => srcNum(v.key, '$' + v.key.v.toString(16).toUpperCase())).join(' ') + '</span></td>' +
        '<td><b>CD volume</b><div class="cheatDoes">' + vol.map(v => (v.step.v < 0 ? 'down' : 'up') + ' by ' + srcNum(v.step, Math.abs(v.step.v)) + (v.bound ? ' and held at ' + srcNum(v.bound) : '')).join('; ') + '.</div></td></tr>' : '') +
      (cd.length ? '<tr><td class="cheatCombo">' + key(cd.map(w => w.v).join(' ')) + '</td>' +
        '<td><b>CD transport</b><div class="cheatDoes">The same rolling word as the cheat code, matched against ' + cd.map(w => '“' + srcNum(w, w.v) + '”').join(', ') + ' when a CD is present, each also answered by a key code (' + cd.filter(w => w.key).map(w => srcNum(w.key)).join(', ') + '). ' +
        'The routines they call have no names in the traceback tables, so the words are certain and the verbs are the obvious reading.</div></td></tr>' : '') +
      '</tbody></table></div></div>';
  }

  // The numbers the keys ask for, off the file.
  const levels = cheatLevels();
  if (levels.length) {
    h += '<div class="mechSec"><h4 class="cheatH4">Levels, for option-j</h4>' +
      '<div class="cheatNote">The level is the map’s number, asked in hex; X and Y are squares. ' +
      'The name is the map’s own script string, with the editor’s name beside it where the two differ.</div>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><thead><tr><th class="num">hex</th><th class="num">dec</th><th>map</th></tr></thead><tbody>' +
      levels.map(l => '<tr><td class="num">' + l.n.toString(16).toUpperCase().padStart(2, '0') + '</td><td class="num">' + l.n + '</td><td>' +
        (l.n === 0 ? svLink(svEsc(l.name), 'jumpToResource(' + l.resid + ')') + ' <span class="cheatDoes">the nothing map, below</span>'
                   : svLink(svEsc(l.name), 'jumpToResource(' + l.resid + ')') + svEsc(editorNameSuffix(l.resid, l.name))) +
        '</td></tr>').join('') +
      '</tbody></table></div></div>';
  }
  const tp = cheatTeleporters();
  if (tp.last) {
    const mapOrder = [...tp.byMap.keys()].sort((a, b) => a - b);
    const mapName = resid => { const l = levels.find(x => x.resid === resid); return l ? l.name : (labelFor(resid) || ('0x' + resid.toString(16).toUpperCase())); };
    h += '<div class="mechSec"><h4 class="cheatH4">Teleporters, for option-shift-j</h4>' +
      '<div class="cheatNote">' + tp.last + ' destinations, numbered 1 to ' + tp.last + ' in decimal, each one square of one map: ' +
      'the zoneport table, four bytes an entry, the map then the square. The table has ' + tp.total + ' entries and every one above ' + tp.last +
      ' is map 0 at (0,0), the nothing map, which is where players found ' + (tp.last + 1).toString(16).toUpperCase() + ' and above landing. ' +
      'Each number opens the map on its square. ' +
      'The community’s own list, posted to the web board in 2007 (topic 1830) and packaged in add-on 620 as Zone list.rtf, names the same map for every entry once three names are translated: ' +
      'Timon Ruins is Headwater Ruins, Swamp Ruins is Seldane Maayti Ruins, Crypts is Pnyx Upstairs. The two copies are one list.</div>' +
      '<div class="tableScroll"><table class="forkTable cheatTable"><thead><tr><th class="num">level</th><th>map</th><th class="num">no.</th><th>teleporter, and the square it reaches</th></tr></thead><tbody>' +
      mapOrder.map(resid => {
        const list = tp.byMap.get(resid);
        return '<tr><td class="num">' + (resid & 0xFF).toString(16).toUpperCase().padStart(2, '0') + '</td><td>' + svEsc(mapName(resid)) + '</td><td class="num">' + list.length + '</td><td>' +
          list.map(t => svLink(String(t.n), 'atlasOpenSquare(' + resid + ',' + t.x + ',' + t.y + ')', t.x + ',' + t.y)).join(' ') + '</td></tr>';
      }).join('') +
      '</tbody></table></div></div>';
  }
  let heap = null;
  try { heap = refExists(0x8000) ? nothingMapHeap(0x8000) : null; } catch (e) { heap = null; }
  if (heap) {
    h += '<div class="mechSec"><h4 class="cheatH4">Level 0, the nothing map</h4><ul class="ruleList">' +
      '<li>Map 0 has a header, ' + heap.w + ' by ' + heap.h + ', no roof and no exits, and ' + (refExists(0x8100) ? 'a prop list' : 'no prop list') +
      '; the editor’s list has no name for it, and the map window’s caption reads Untitled there. Every other table keyed by zone starts at 1.</li>' +
      '<li><b>Its grid is not tiles.</b> ' + (heap.high ? heap.high + ' of its ' + heap.words + ' words have a high byte' : 'Every one of its ' + heap.words + ' words has a zero high byte') +
      ', so the grid is that many bytes of memory widened to words. The low bytes hold <b>' + heap.heads + '</b> allocator headers, a pointer, a tag, a size and a back-pointer, ' +
      'and adding a header’s size to its position lands on the next header <b>' + heap.hits + ' times of ' + heap.heads + '</b>. The same test on a real map finds no header. ' +
      'So the map was made and its header written while its tile buffer was never filled, and the file carries what those bytes last held.</li>' +
      '<li>Players reached it long before any of this: web board topic 1570 (2004) has two arriving by accident, from a bed in Cademia and from beneath Pnyx, ' +
      'and topic 1830 reports a figure with a guard’s sprite standing there called Nothing, Omen if killed twice. ' +
      'That figure is character record 0, one byte 01 and thirty-one zeros in the shipped table, the record option-x writes to. ' +
      actionChip('Saved Game', "showCategory('SAVEGAME')") + '</li></ul></div>';
  }

  const sprites = cheatSpriteClasses();
  if (sprites.length) {
    h += '<div class="mechSec"><h4 class="cheatH4">Be somebody else</h4>' +
      '<div class="cheatNote">The oldest Cythera cheat is Pandora’s Box: search the running game for ' +
      'the number <b>32</b>, the hero’s sprite class, and write another one over it. ' +
      'The Saved Game sheet does it in the file instead, the <b>sprite class</b> field on any ' +
      'record, and these are the ' + sprites.length + ' classes somebody in the shipped ' +
      'archive actually wears, the people out of 0xF009, the monsters out of 0xF008, rather than ' +
      'found by trying values. ' +
      actionChip('Saved Game', "showCategory('SAVEGAME')") + '</div>' +
      '<div class="cheatSprites">' + sprites.map(s =>
        '<span class="cheatSprite' + (s.kind === 'monster' ? ' isMonster' : '') + '"><b>' + s.pt +
        '</b> ' + svEsc(s.name) + '</span>').join('') +
      '</div></div>';
  }

  h += '<div class="mechSec"><h4 class="cheatH4">Cheats that need no cheat mode</h4>' +
    '<div class="cheatNote">What this page can change and hand back as a file the game will open. ' +
    'Each rebuilds the whole archive and shows the result, which is what the export carries.' +
    '</div><ul class="ruleList">' +
    '<li><b>The party’s records.</b> Where they stand, how strong, how well fed, how many training ' +
    'points: 32 bytes each. ' + actionChip('Saved Game', "showCategory('SAVEGAME')") + '</li>' +
    '<li><b>Any resource, as hex</b>, through Edit Bytes on the resource itself.</li>' +
    '<li><b>Where the edits come out.</b> ' + actionChip('Changes', "showCategory('CHANGES')") + '</li></ul></div>';

  if (kr && kr.cases.length) {
    const find = k => kr.cases.find(c => c.keys.some(x => x.v === k));
    const cx = find(0xC5), cp = find(0xB9), cl = find(0xC2), c1 = kr.cases.find(c => c.keys.some(x => x.v === 0xC1));
    const items = [];
    if (cx) items.push('<li><b>option-x is broken.</b> ' + facts(cx).brokenShort() + '</li>');
    if (cp && cp.fallsInto && caseAt(cp.fallsInto)) items.push('<li><b>option-p falls through</b> into ' + comboOf(caseAt(cp.fallsInto).keys[0].v) + '’s case (' + srcNum(exeVal({ at: cp.fallsInto }, null), 'here') + '), so asking what a prop is also runs that toggle. A missing branch in the game’s own switch.</li>');
    const fh = find(0xFA);
    if (fh) items.push('<li><b>option-h empties the enemy list.</b> ' + facts(fh).peaceShort() + '</li>');
    if (cl && !c1) items.push('<li><b>The speed limiter is option-l.</b> The switch sends $C2 to it (' + srcNum(cl.keys[0], 'the compare') + ') and $C1, option-1, to the default.</li>');
    if (items.length) h += '<div class="mechSec"><h4 class="cheatH4">Things read from the code</h4><ul class="ruleList">' + items.join('') + '</ul>' +
      '<div class="cheatNote">Where a key’s <i>effect</i> is described rather than its instructions, it is an inference from what the byte it changes is used for.</div></div>';
  }

  grid.innerHTML = '<div class="changesView">' + h + '</div>';
  out.textContent = (kr ? 'Cheat mode: ' + kr.cases.filter(c => c.gated).length + ' keys behind the gate, ' + kr.cases.filter(c => !c.gated).length + ' in the same routine without it' : 'Cheat mode') +
    (levels.length ? ', ' + levels.length + ' levels' : '') + (tp.last ? ' and ' + tp.last + ' teleporters' : '') + '.';
}

/* ---- Data > Saved Game ----------------------------------------------------
   A Cythera player file read as what it is, and edited a field at a time.

   The page has opened saves since September 2026 and then had almost nothing
   to say about one: a `DelP` file landed on the Data Fork sheet, which listed
   its six subindexes and left the reader to open a 16 KB hex dump. Everything
   a player would want to change is in one of those subindexes -- 0xF009, the
   character records -- and the format of that table has been public on
   delvmod's wiki for years. This sheet is that table with the names on it.

   IT IS THE SAME EDIT SEAM AS EVERYTHING ELSE. Apply re-parses 0xF009,
   changes the fields the form names, re-serializes the whole table with
   `writeDelverCharacterRecords` -- proven the exact inverse of its parser
   over both real tables by `delv_write_check.mjs` -- and hands the bytes to
   `applyResourceEdit`, which rebuilds the archive and re-enters
   `parseArchiveBytes`. So what the sheet shows after an edit is read back out
   of the rebuilt file, and Data > Cythera Data > Changes is where the edited
   save leaves the page: a MacBinary for a real Mac, a disk image for the
   emulator, or the bare data fork.

   IT ALSO OPENS ON `Cythera Data`, where the same table is where everybody
   STARTS rather than where they are. That is not a courtesy: it is how the
   sheet is testable without a saved game in the checkout, and the difference
   between the two files -- Alaric at 9,600 experience in both, the hero's
   health 0 in the scenario and 25 in a played game -- is the clearest
   statement of what a save actually is.

   THE NAMES ARE BORROWED AND THE SHEET SAYS SO. A save holds no 0x0201, so
   without the scenario opened earlier in the session every row would read
   "Character 12"; see the comment above SCENARIO_NAMES for why carrying two
   string tables is not the same as holding two archives open. */
window.SAVE_EDIT_OPEN = null;   // the record whose form is unfolded, kept across a rebuild
window.SAVE_SHOW_ALL = false;   // slots that are marked but hold nobody

/* The parts of a player file, and what each is, traced through the
   executable rather than guessed: every one of these is written by a named
   routine in Cythera's own save path (`TDelverApp::SaveToFile` and what it
   calls), which is also where the comment above DELV_PLAYER_CLEAR_SUBN gets
   its rule that none of them is encrypted. Only the ones the open file
   actually has are listed. */
function savedGameParts() {
  const out = [];
  const add = (rid, what) => { if (refExists(rid)) out.push({ rid, what }); };
  add(0xF009, 'the character records, everybody’s position, stats and condition (SaveGlobals)');
  add(0xF00E, 'one 16-bit word per room, 1,024 rooms; bit 0 is set once a room has been entered and its description shown (SaveGlobals)');
  const hero = loadCharacterTable()[1];
  if (hero && hero.zone) {
    add(0x8100 | hero.zone, 'the props of the zone the player stands in, from record 256 up (SaveLevelProps)');
    add(0x8200 | hero.zone, 'that zone’s map memory: width ÷ 8, rounded up, × height bytes, one bit a square (SaveLevelProps)');
  }
  add(0xF306, 'the first 256 prop records, the characters as they stand on that zone (SaveLevelProps)');
  add(0x8800, 'the player’s own portrait, written when the character was made (CreatePlayer)');
  add(0x0400, 'the live game, five tagged chunks: the quest values and flags, the active monsters with their queued activities, the spell effects in flight, the open windows, and the 256 gremlin frames (SaveToFile)');
  add(0x0401, 'the To Do list (SaveToDo)');
  add(0x0404, 'the twenty macro slots; 0xFF is unassigned (SaveMacros)');
  add(0xF307, 'the script system’s persistent heap, 256 KB: 8-byte block headers carrying a reference number and a kind, one free block when empty (THeap::Save)');
  add(0xF308, '4,096 16-bit words indexed by a prop’s storage reference, each the heap reference of that prop’s frame (THeap::Save)');
  for (let n = 0; n < 256; n++) add(0xE000 | n, 'a page of the journal, 8 KB; entries are a length, a day byte, a kind, a speaker and the text (TJournalSegment::Flush)');
  return out;
}

function renderSaveSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const recs = loadCharacterTable();
  if (!recs.length) {
    grid.innerHTML = '<div class="changesView"><p>This file has no 0xF009 character table, ' +
      'so there is nothing here to read. A Cythera player file always has one; so does ' +
      'Cythera Data.</p></div>';
    out.textContent = 'No character records in this file.';
    return;
  }
  const isSave = (window.ARCHIVE_FINDER || {}).type === 'DelP';
  const hero = recs[1];
  // Built as one markup string into the grid rather than into a detached
  // node: ids inside innerHTML only become findable once the element they are
  // set on is in the document, and the edit form is found by id.
  let h = '';

  // Who and where.
  const face = characterFace(1);
  h += '<div class="saveHead">' +
    (face ? '<img class="saveFace" src="' + face.url + '" alt="">' : '') +
    '<div><h3>' + svEsc(isSave ? ((window.ARCHIVE_FINDER.name || 'A saved game')) : 'Cythera Data’s own character table') + '</h3>' +
    '<div class="mechLede">' +
    (isSave
      ? 'A Cythera player file: the state of the world as the game left it. ' +
        (hero && hero.zone
          ? svEsc(characterName(1)) + ' stands in ' + svEsc(zoneDisplayName(hero.zone)) +
            ' at (' + hero.x + ', ' + hero.y + '), ' + hero.health + ' of ' + hero.healthMax + ' health.'
          : 'The hero’s record names no zone.')
      : 'Where everybody starts, before a game has been played: the same 32-byte records a ' +
        'saved game carries.') +
    '</div></div></div>';

  if (namesAreBorrowed())
    h += '<div class="saveNote">The names here come from the scenario opened earlier this ' +
      'session rather than from this file. A saved game holds no name table, and a character index ' +
      'means the same person in every Cythera file.</div>';

  // What the file holds.
  const parts = savedGameParts();
  if (parts.length) {
    h += '<h4 class="saveH4">What this file holds</h4><div class="tableScroll"><table class="forkTable">' +
      '<thead><tr><th>resource</th><th>what it is</th><th>bytes</th></tr></thead><tbody>' +
      parts.map(p => {
        let n = 0; try { n = (getResourceBytes(ARCHIVE, p.rid) || []).length; } catch (e) { quiet(e); }
        return '<tr><td class="num">0x' + p.rid.toString(16).toUpperCase().padStart(4, '0') + '</td>' +
          '<td>' + svEsc(p.what) + '</td><td class="num">' + fmtBytes(n) + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }

  // Everybody.
  const inUse = recs.filter(delverCharacterInUse);
  const marked = recs.filter(r => !delverCharacterInUse(r) && (r.zone || r.raw.some(b => b))).length;
  const shown = window.SAVE_SHOW_ALL ? recs.filter(r => r.zone || r.raw.some(b => b)) : inUse;
  h += '<h4 class="saveH4">The records</h4>' +
    '<div class="saveNote">' + inUse.length + ' of the 512 slots hold somebody' +
    (marked ? ', and ' + marked + ' more are marked with a zone and nothing else' : '') +
    '; slot 0 is the figure called Nothing on the nothing map, and the record option-x writes to. ' + actionChip('Cheats', "showCategory('CHEATS')") + ' ' +
    actionChip(window.SAVE_SHOW_ALL ? 'Only the ones in use' : 'Show every marked slot',
               'toggleSaveShowAll()') + '</div>';
  h += '<div class="tableScroll"><table class="forkTable"><thead><tr>' +
    '<th class="num">no.</th><th>who</th><th>where</th><th class="num">lv</th><th class="num">xp</th>' +
    '<th class="num">health</th><th class="num">magic</th>' +
    '<th class="num">food</th><th class="num">train</th><th></th></tr></thead><tbody>';
  for (const r of shown) {
    const i = r.index;
    h += '<tr' + (i === 1 ? ' class="saveHero"' : '') + '>' +
      '<td class="num">' + i + '</td>' +
      '<td class="who">' + svEsc(i ? characterName(i) : 'slot 0, not a character') + '</td>' +
      '<td>' + svEsc(r.zone ? zoneDisplayName(r.zone) + ' (' + r.x + ', ' + r.y + ')' : 'nowhere') + '</td>' +
      '<td class="num">' + r.level + '</td><td class="num">' + r.xp + '</td>' +
      '<td class="num">' + r.health + '/' + r.healthMax + '</td>' +
      '<td class="num">' + r.magic + '/' + r.magicMax + '</td>' +
      '<td class="num">' + r.nutrition + '</td><td class="num">' + r.training + '</td>' +
      '<td>' + actionChip('Edit', 'toggleCharEdit(' + i + ')') + '</td></tr>' +
      '<tr class="saveEditRow"><td colspan="10"><div class="propEdit" id="charEdit-' + i + '" style="display:none"></div></td></tr>';
  }
  h += '</tbody></table></div>';
  h += '<div class="saveNote">Every field above is a byte or two of the record, and the ' +
    'eleven bytes this project has not identified are shown with it when a row is opened. ' +
    'Editing rebuilds the whole archive in memory; nothing on disk changes, and ' +
    actionChip('Changes', "showCategory('CHANGES')") + ' is where an edited file leaves the page.</div>';
  grid.innerHTML = '<div class="changesView">' + h + '</div>';
  out.textContent = (isSave ? 'Saved game' : 'Character records') + ': ' +
    inUse.length + ' of 512 slots in use' + (hero && hero.zone ? ', the player in ' + zoneDisplayName(hero.zone) : '') + '.';
  // An edit's rebuild redraws this sheet; put the reader back at the row they
  // were working in rather than folding it away under them.
  if (window.SAVE_EDIT_OPEN != null) {
    const keep = window.SAVE_EDIT_OPEN;
    window.SAVE_EDIT_OPEN = null;
    toggleCharEdit(keep);
  }
}

function toggleSaveShowAll() { window.SAVE_SHOW_ALL = !window.SAVE_SHOW_ALL; renderSaveSheet(); }

/* One record's form. The fields this project can name are inputs; the eleven
   bytes it cannot are shown as hex and are not editable here -- Edit Bytes on
   the resource itself is the tool for those, and pretending a slider knows
   what byte 22 means would be worse than saying it does not. */
const SAVE_FIELDS = [
  ['zone', 'zone', 10, 0xFF, 'the low byte of the map’s resource id'],
  ['x', 'x', 10, 0xFFF, ''], ['y', 'y', 10, 0xFFF, ''],
  ['proptype', 'sprite class', 10, 0x3FF, 'which prop class draws them, 32 is the hero, 33 the heroine'],
  ['aspect', 'aspect', 10, 0x3F, 'the frame within that class'],
  ['body', 'body', 10, 0xFF, ''], ['reflex', 'reflex', 10, 0xFF, ''], ['mind', 'mind', 10, 0xFF, ''],
  ['level', 'level', 10, 0xFF, ''], ['xp', 'experience', 10, 0xFFFF, () => { const r = experienceRules().rule; return r && r.cap ? 'the experience script caps it at ' + r.cap.v.toLocaleString('en-US') : ''; }],
  ['health', 'health', 10, 0xFF, ''], ['healthMax', 'full health', 10, 0xFF, ''],
  ['magic', 'magic', 10, 0xFF, ''], ['magicMax', 'full magic', 10, 0xFF, ''],
  ['nutrition', 'food', 10, 0xFF, () => {
    const clk = appImage() ? exeClockRules() : null, full = fullStomach();
    return [clk && clk.model ? clk.fall.v + ' comes off each time the clock passes ' + exeClockWords(clk.table.v[clk.model.hungerIndex], clk.unitsPerHour.v) : '',
            full ? 'the ' + full.potion + ' sets it to ' + full.v : ''].filter(Boolean).join('; ');
  }],
  ['training', 'training points', 10, 0xFF, () => { const t = trainingRules().points; return t && t.perLessonVal && t.masteryVal ? 'a lesson costs ' + t.perLessonVal.v + ', a mastery ' + t.masteryVal.v : ''; }],
  ['party', 'party byte', 16, 0xFF, '0 before Hector joins and 5 after'],
  ['state', 'state byte', 16, 0xFF, 'C0/D0/80 on the placed; movement and orientation'],
];
function toggleCharEdit(index) {
  const host = document.getElementById('charEdit-' + index);
  if (!host) return;
  if (host.style.display !== 'none') {
    host.style.display = 'none'; host.innerHTML = '';
    if (window.SAVE_EDIT_OPEN === index) window.SAVE_EDIT_OPEN = null;
    return;
  }
  const rec = loadCharacterTable()[index];
  if (!rec) return;
  const noteOf = note => { if (typeof note !== 'function') return note || ''; try { return note() || ''; } catch (e) { return ''; } };
  const fld = ([key, label, base, max, note]) =>
    '<label title="' + svEsc(noteOf(note)) + '">' + svEsc(label) + ' ' +
    (base === 16 ? '0x' : '') +
    '<input id="ce-' + index + '-' + key + '" value="' +
    (base === 16 ? rec[key].toString(16).toUpperCase().padStart(2, '0') : rec[key]) +
    '" size="' + (max > 0xFF ? 5 : 4) + '" spellcheck="false"></label>';
  host.innerHTML = SAVE_FIELDS.map(fld).join('') +
    '<button class="sv-chip" onclick="applyCharEditForm(' + index + ')">Apply</button>' +
    (index === 1 ? actionChip('Make them well', 'healCharacterRecord(1)',
                              fullStomach() ? 'health, magic and a full stomach' : 'health and magic') : '') +
    '<div class="inspDim">The 32 bytes as stored: <code>' +
    Array.from(rec.raw).map(b => b.toString(16).padStart(2, '0')).join(' ') +
    '</code><br>Bytes 6 and 7, 20 to 26 and 29 to 31 are not identified and are carried through ' +
    'an edit unchanged; 20 and 21 are a second appearance word that is usually, but not ' +
    'always, the one at 4 and 5. Apply rebuilds the whole archive.</div>';
  host.style.display = '';
  window.SAVE_EDIT_OPEN = index;
}

function applyCharEditForm(index) {
  const fields = {};
  for (const [key, label, base, max] of SAVE_FIELDS) {
    const el = document.getElementById('ce-' + index + '-' + key);
    if (!el) return;
    const v = parseInt(el.value, base);
    if (!Number.isInteger(v) || v < 0 || v > max) {
      setStatus('Bad value for ' + label + ', nothing changed.', true); return;
    }
    fields[key] = v;
  }
  applyCharacterRecordEdit(index, fields);
}

// Health, magic and a full stomach: the one convenience offered, because it
// is the three fields anybody opening a save is here to change. Health and
// magic have a maximum the record states; a full stomach is what the potion
// that sets nutrition sets it to, read off its script (fullStomach), and
// left alone when no script says.
function healCharacterRecord(index) {
  const rec = loadCharacterTable()[index];
  if (!rec) return;
  const full = fullStomach();
  applyCharacterRecordEdit(index, Object.assign({ health: rec.healthMax, magic: rec.magicMax }, full ? { nutrition: full.v } : {}));
}
/* What a full stomach is: the value the potion that sets nutrition sets it
   to (foodRules, off the potion scripts). A saved game carries no scripts,
   so the scenario's, read when it was opened, is kept and borrowed, the way
   the character names are. */
window.SCENARIO_FULL_STOMACH = null;
function fullStomach() {
  let found = null;
  try {
    for (const p of foodRules().potions) { const e = (p.effects || []).find(x => x.field === 'nutrition'); if (e) { found = { v: e.set, potion: p.name, src: e.src }; break; } }
  } catch (e) { found = null; }
  if (found) window.SCENARIO_FULL_STOMACH = found;
  return found || window.SCENARIO_FULL_STOMACH;
}

function applyCharacterRecordEdit(index, fields) {
  const raw = getResourceBytes(ARCHIVE, 0xF009);
  if (!raw) { setStatus('This file has no character table.', true); return false; }
  const records = parseDelverCharacterRecords(smartDecrypt(raw, 0xF009).data);
  if (!records[index]) return false;
  Object.assign(records[index], fields);
  const ok = applyResourceEdit(0xF009, writeDelverCharacterRecords(records));
  if (ok) setStatus('Record ' + index + ' (' + characterName(index) + ') rewritten.');
  return ok;
}

function renderDataForkSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const r = new BinReader(ARCHIVE.bytes);
  const rows = [];
  let total = 0, totalBytes = 0;
  for (let subn = 0; subn < 256; subn++) {
    const [off, len] = ARCHIVE.index[subn] || [0, 0];
    if (!off) continue;
    r.seek(off);
    let count = 0, bytes = 0;
    for (let n = 0; n < Math.floor(len / 8); n++) {
      const roff = r.u32(), rlen = r.u32();
      if (roff) { count++; bytes += rlen; }
    }
    rows.push({ subn, count, bytes });
    total += count;
    totalBytes += bytes;
  }
  const table = document.createElement('table');
  table.className = 'forkTable';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th>subindex</th><th>ids</th><th class="num">resources</th>' +
    '<th class="num">bytes</th><th>named</th><th>shown under</th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  for (const row of rows) {
    const tr = document.createElement('tr');
    const v = String(row.subn);
    const leaf = TAB_LEAF_FOR.get(v);
    const idTd = '<td class="num">' + row.subn + '</td>' +
      '<td class="num">0x' + ((row.subn + 1) << 8).toString(16).toUpperCase().padStart(4, '0') + 'xx</td>';
    tr.innerHTML = idTd +
      '<td class="num">' + row.count + '</td><td class="num">' + fmtBytes(row.bytes) + '</td>' +
      '<td>' + svEsc(CATEGORY_NAMES[row.subn] || '') + '</td>' +
      '<td>' + (leaf ? '<button class="navChip" onclick="showCategory(\'' + v + '\')">' +
                       svEsc(tabTrail(leaf)) + '</button>' : '') + '</td>';
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  // Six columns do not fit a phone; the table scrolls sideways inside its
  // own box rather than pushing the sheet off the right edge.
  const scroll = document.createElement('div');
  scroll.className = 'tableScroll';
  scroll.appendChild(table);
  grid.appendChild(scroll);
  const rsrc = window.CYTHERA_RSRC_RAW;
  out.textContent = (window.ARCHIVE_SOURCE_NAME || 'The data fork') + ': ' + fmtBytes(ARCHIVE.bytes.length) +
    ', ' + rows.length + ' subindexes, ' + total + ' resources (' + fmtBytes(totalBytes) + ' of payload)' +
    (rsrc && rsrc.length ? '; a resource fork of ' + fmtBytes(rsrc.length) + ' beside it'
                         : '; no resource fork came with it') + '.';
}

/* ---- Data > Installer -----------------------------------------------------
   Every file the installer carries, as the Finder would list them: path,
   type and creator, both fork sizes. Each row can be read (the text files,
   inline) or taken away as a MacBinary carrying both forks under its own
   name -- the form a real Mac wants, and the one the page already writes
   for an edited archive. The two files the rest of the page is built on are
   marked; opening them again from here is pointless and not offered.

   The bytes come out of the installer on demand, through viseExtract, and
   are not kept: the installer itself is what the page remembers (see
   adoptArchive), and a decoded stream is cached on it for the session. */
function installerTextOf(entry) {
  const got = viseExtract(window.INSTALLER.archive, entry);
  return decodeMacRoman(got.data);
}
function installerIsText(entry) {
  return entry.dataLen > 0 && (entry.type === 'TEXT' || entry.type === 'URL ' || entry.type === 'LINK');
}
function downloadInstallerFile(index) {
  const inst = window.INSTALLER;
  if (!inst) return;
  const entry = inst.archive.entries[index];
  if (!entry) return;
  const got = viseExtract(inst.archive, entry);
  if (!got.crcOk) setStatus('Warning: the installer’s checksum for ' + entry.name + ' does not match what came out.', true);
  downloadBlob(writeMacBinary({ name: entry.name, type: entry.type, creator: entry.creator, data: got.data, rsrc: got.rsrc }),
               safeFileName(entry.name) + '.bin');
}
function showInstallerText(index) {
  const inst = window.INSTALLER;
  const entry = inst && inst.archive.entries[index];
  const grid = document.getElementById('sheetGrid');
  if (!entry || !grid) return;
  let pre = document.getElementById('installerText');
  if (!pre) {
    pre = document.createElement('pre');
    pre.id = 'installerText';
    pre.className = 'installerText';
    grid.appendChild(pre);
  }
  let text;
  try { text = installerTextOf(entry); }
  catch (e) { text = 'Could not read ' + entry.name + ': ' + e.message; }
  pre.textContent = entry.path + '\n' + '─'.repeat(Math.min(entry.path.length, 60)) + '\n' + text.replace(/\r\n?/g, '\n');
  pre.scrollIntoView({ block: 'nearest' });
}
// A file holding several installers (archive.org's "Cythera installers.sit"
// has all four releases) is re-opened at another one from the bytes already
// in hand. Everything archive-keyed resets through parseArchiveBytes as for
// any other open, and the remembered copy learns the choice.
function switchInstaller(name) {
  const inst = window.INSTALLER;
  if (!inst || !inst.raw || name === inst.picked) return;
  setStatus('Opening ' + name + '…');
  if (!adoptArchive(inst.raw, inst.sourceName, { pick: name, store: true, url: inst.url || undefined }))
    setStatus('Could not open ' + name + ': ' + lastArchiveError, true);
  else showCategory('INSTALLER');
}
/* The icon the Finder shows for a file of this type, from the owning
   application's bundle: a BNDL maps local ids to FREF and ICN# resources, each
   FREF names a file type and a local icon id, and the icon families (icl8,
   icl4, ICN#) share the ICN# id. Cythera's bundle has four: the application
   (APPL), the data file (DelS), a saved game (DelP) and the scratch file
   (Temp). A Magpie patch is a DelP too and is told apart by its creator, so
   the bundle has no icon of its own for one. Anything else gets no icon rather
   than a wrong one. */
function bundleIconMap(fork, cacheKey) {
  const cache = DERIVED._BUNDLE_ICONS || (DERIVED._BUNDLE_ICONS = {});
  if (cache[cacheKey]) return cache[cacheKey];
  const map = {};
  try {
    const bndl = (fork.resourcesByType['BNDL'] || [])[0];
    const b = bndl ? fork.dataOf('BNDL', bndl) : null;
    const arrays = {};
    if (b) {
      let p = 6; const n = u16be(b, p) + 1; p += 2;
      for (let i = 0; i < n; i++) {
        const t = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]); p += 4;
        const cnt = u16be(b, p) + 1; p += 2;
        arrays[t] = {};
        for (let k = 0; k < cnt; k++) { arrays[t][u16be(b, p)] = u16be(b, p + 2); p += 4; }
      }
    }
    for (const [local, frefId] of Object.entries(arrays['FREF'] || {})) {
      const fe = (fork.resourcesByType['FREF'] || []).find(e => e.id === frefId);
      if (!fe) continue;
      const d = fork.dataOf('FREF', fe);
      const ftype = String.fromCharCode(d[0], d[1], d[2], d[3]);
      const iconLocal = u16be(d, 4);
      const iconId = (arrays['ICN#'] || {})[iconLocal];
      if (iconId !== undefined) map[ftype] = iconId;
    }
  } catch (e) { quiet(e); }
  cache[cacheKey] = map;
  return map;
}
function iconFromFork(fork, id) {
  for (const t of ['icl8', 'icl4', 'ICN#']) {
    const e = (fork.resourcesByType[t] || []).find(x => x.id === id);
    if (!e) continue;
    const pic = rsrcArtifacts(fork, t, e).find(a => a.canvas && a.canvas.width);
    if (pic) return pic.canvas;
  }
  return null;
}
function finderIconFor(type) {
  const fork = window.APP_RSRC;
  if (!fork) return null;
  const id = bundleIconMap(fork, 'app')[type];
  return id === undefined ? null : iconFromFork(fork, id);
}

/* Two icons that are not the game's, and are not in the game's fork either.

   The installer is a Macintosh file like any other and carries two kinds of
   icon the tab row can use. Its own application icon is in the fork it
   arrived in, through a VIS3 bundle with the same shape as Cythera's; that is
   the VISE mark, and it belongs on the Installer tab, which had been wearing
   a game tile because "the installer is a container rather than a Delver file
   type, so there is no icon of its own to take" -- true of the Delver bundle,
   and the installer has a bundle of its own.

   The other kind is a folder's custom icon, which on a classic Mac is an
   invisible file called `Icon\r` inside the folder, holding an icon family at
   id -16455. The installer's catalog carries five of them -- the game folder,
   CombatAI, Documentation, Screenshots and Web Site urls -- and CombatAI's is
   a folder with an axe across it, drawn for those files and no others.

   Both are null until a file is open, like every other icon from a fork, so
   each tab keeps the game tile named beside it as the fallback. */
function installerIcon(which) {
  const inst = window.INSTALLER;
  if (!inst) return null;
  const cache = DERIVED._INSTALLER_ICONS || (DERIVED._INSTALLER_ICONS = {});
  if (which in cache) return cache[which];
  let art = null;
  try {
    if (which === 'vise') {
      const raw = inst.container && inst.container.rsrc;
      if (raw && raw.length) {
        const fork = openResourceFork(raw);
        const id = bundleIconMap(fork, 'vise')['APPL'];
        if (id !== undefined) art = iconFromFork(fork, id);
      }
    } else {
      // The folder's own icon file, by the path the catalog gives it. The
      // name ends in a carriage return, which is what makes it invisible.
      // Matched on the tail of the path, not the whole of it: the top folder
      // is named for the release ("Cythera 1.0.4 \u0192"), and all four
      // releases open here.
      const tail = '/' + which + '/Icon\r';
      const e = inst.archive.entries.find(x => x.path.slice(-tail.length) === tail);
      if (e) {
        const got = viseExtract(inst.archive, e);
        if (got.rsrc && got.rsrc.length) art = iconFromFork(openResourceFork(got.rsrc), -16455);
      }
    }
  } catch (e) { art = null; }
  cache[which] = art;
  return art;
}

function renderInstallerSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const inst = window.INSTALLER;
  if (!inst) {
    out.textContent = 'The archive did not come in through the installer, so there is nothing else here.' + NO_INSTALLER_HINT;
    return;
  }
  const arc = inst.archive;
  const head = document.createElement('div');
  head.className = 'installerOpen';
  head.innerHTML = '<span class="propHead" style="margin-top:0">Open now</span>' +
    '<span class="installerOpenName">' + svEsc((inst.container && inst.container.name) || inst.sourceName) + '</span>' +
    (inst.container && inst.container.name && inst.container.name !== inst.sourceName
      ? '<span class="amNote">from ' + svEsc(inst.sourceName) + '</span>' : '');
  grid.appendChild(head);
  {
    const v = installerVersion();
    const line = document.createElement('div');
    line.className = 'amNote';
    line.style.cssText = 'grid-column:1/-1;text-align:left;margin:0 0 6px';
    line.textContent = (v ? 'Cythera ' + v + ' is the release this page reads. ' : '') +
      (inst.installers && inst.installers.length > 1 ? 'The file also holds ' + inst.installers.filter(it => it.name !== inst.picked).map(it => it.name.replace(/ Installer$/, '')).join(', ') + '; pick one below to read it instead.' : 'It is the only release in this file.');
    grid.appendChild(line);
  }
  if (inst.installers && inst.installers.length > 1) {
    const row = document.createElement('div');
    row.className = 'sv-chips installerVersions';
    const label = document.createElement('span');
    label.className = 'amNote';
    label.textContent = 'This file holds ' + inst.installers.length + ' releases, the open one is marked:';
    row.appendChild(label);
    for (const it of inst.installers) {
      const b = document.createElement('button');
      b.className = 'navChip' + (it.name === inst.picked ? ' active' : '');
      b.textContent = it.name.replace(/ Installer$/, '');
      b.title = it.path + ', ' + fmtBytes(it.dataLen);
      b.onclick = () => switchInstaller(it.name);
      row.appendChild(b);
    }
    grid.appendChild(row);
  }
  const table = document.createElement('table');
  table.className = 'forkTable';
  const thead = document.createElement('thead');
  thead.innerHTML = '<tr><th></th><th>file</th><th>type</th><th>creator</th>' +
    '<th class="num">data fork</th><th class="num">resource fork</th><th></th></tr>';
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  let total = 0;
  for (const e of arc.entries) {
    total += e.dataLen + e.rsrcLen;
    const tr = document.createElement('tr');
    const isArchive = e === inst.entry;
    const isApp = e.type === 'APPL' && e.creator === 'Delv';
    const role = isArchive ? ' <span class="amNote">, the archive this page is showing</span>'
               : isApp ? ' <span class="amNote">, its resource fork is Cythera (App) › Resource Fork</span>' : '';
    const acts = [];
    if (installerIsText(e)) acts.push('<button class="navChip" onclick="showInstallerText(' + e.index + ')">Read</button>');
    acts.push('<button class="navChip" onclick="downloadInstallerFile(' + e.index + ')">.bin</button>');
    // The Finder's icon for the file's type, out of the application's
    // bundle (finderIconFor); an <img> so the row is one string.
    const ic = finderIconFor(e.type);
    tr.innerHTML = '<td class="icon">' + (ic ? '<img src="' + ic.toDataURL('image/png') + '" alt="" width="32" height="32">' : '') + '</td>' +
      '<td>' + svEsc(e.path).replace(/\r/g, '¬') + role + '</td>' +
      '<td class="num">' + svEsc(e.type.replace(/\0/g, '·')) + '</td><td class="num">' + svEsc(e.creator.replace(/\0/g, '·')) + '</td>' +
      '<td class="num">' + (e.dataLen ? fmtBytes(e.dataLen) : '') + '</td>' +
      '<td class="num">' + (e.rsrcLen ? fmtBytes(e.rsrcLen) : '') + '</td>' +
      '<td>' + acts.join(' ') + '</td>';
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  const scroll = document.createElement('div');
  scroll.className = 'tableScroll';
  scroll.appendChild(table);
  grid.appendChild(scroll);
  const c = inst.container;
  out.textContent = (c && c.name ? '“' + c.name + '”' : inst.sourceName) +
    (c && c.name && c.name !== inst.sourceName ? ' from ' + inst.sourceName : '') + ', ' + arc.versionName +
    ', ' + arc.entries.length + ' files in ' + arc.dirs.length + ' folders, ' + fmtBytes(total) +
    ' once unpacked' + (c ? ', from a ' + c.kind + ' file (' + fmtBytes(arc.bytes.length) + ' of it the archive)' : '') +
    '. A .bin here is the file itself with both forks, the form to hand a real Mac' +
    (inst.crcOk ? '' : '. The installer’s own checksum for the archive did NOT match, treat the data with suspicion') + '.';
}

/* ---- Data > Combat AI > Scripts / Rules ----------------------------------
   The nine .ai files and the AI Scripting Document that came with the
   installer, shown as they are: they are plain text, a few hundred bytes
   each, and the point of them is to be read beside subindex 3, the compiled
   form the engine actually runs. */
function renderCombatAISheet(which) {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  // The words the combat AI is written in are string lists in the
  // application's resource fork -- the objects, groups, tests, actions and
  // modifiers the .ai files and the compiled scripts both use -- so the
  // Rules tab draws them first, from the fork, and the document after, from
  // the installer, and has the tables even when the installer is not here.
  if (which === 'AIRULES') {
    const app = window.APP_RSRC;
    const lists = [[9300, 'Objects'], [9301, 'Groups'], [9304, 'Tests'], [9305, 'Actions'], [9303, 'Modifiers'],
                   [9307, 'Scenario AI tests'], [9308, 'Scenario AI actions'], [9320, 'Health states'],
                   [9321, 'Object flags'], [502, 'Strategies'], [500, 'Combat buttons']];
    const rows = [];
    for (const [id, what] of lists) {
      const l = forkStringList(app, id);
      if (l && l.length) rows.push('<tr><th>' + svEsc(what) + ' <span class="amNote">STR# ' + id + '</span></th><td>' +
        l.map(svEsc).join(', ') + '</td></tr>');
    }
    const box = document.createElement('div');
    box.style.cssText = 'grid-column:1/-1';
    // Which of the words are the executable's and which are this archive's:
    // the Tests and Actions lists are native, and the Scenario lists are
    // Delver scripts, one resource per word, in the order the lists give.
    const tests = [], actions = [];
    for (let i = 0; i < 6; i++) if (refExists(0x901 + i)) tests.push(svChip(0x901 + i));
    for (let i = 0; i < 13; i++) if (refExists(0x981 + i)) actions.push(svChip(0x981 + i));
    const split = (tests.length || actions.length)
      ? '<div class="changesNote" style="margin-left:0">The Tests list and the two Actions are the executable’s own. ' +
        'The Scenario lists are scripts in this archive, one a word, in the order given' +
        (tests.length ? ': the tests ' + tests.join(' ') : '') + (actions.length ? (tests.length ? ', the actions ' : ': the actions ') + actions.join(' ') : '') +
        '. CastSpell calls HasSpell first and casts nothing a character does not know. ' +
        'A file written to the AI Scripting Document is compiled into one of 31 user slots, numbers 176 to 206, from a companion’s character window: ' +
        'its Strategy tab, the popup at the bottom left, Edit User Strategies…, then Import. The same dialog’s Debug button marks a slot, and a companion running a marked slot opens the game’s own AI debugger, ' +
        'a listing with Step, Go and Clear Debug, on every evaluation. The Debug(#) action only prints its number.</div>'
      : '';
    box.innerHTML = '<div class="propHead">The vocabulary, from the application’s resource fork' +
      (rows.length ? '' : (app ? ', none of the lists is in this fork' :
        (window.APP_RSRC_STATE === 'loading' ? ', loading the application…' :
         ', ' + (window.APP_RSRC_STATE || 'the application’s fork is not loaded')))) + '</div>' +
      (rows.length ? '<div class="tableScroll"><table class="vocabTable">' + rows.join('') + '</table></div>' : '') + split;
    grid.appendChild(box);
  }
  const arc = window.INSTALLER ? window.INSTALLER.archive : null;
  const want = which === 'AIRULES'
    ? e => /AI Scripting Document/i.test(e.name)
    : e => /\.ai$/i.test(e.name);
  const files = arc ? arc.entries.filter(e => e.type === 'TEXT' && want(e)) : [];
  for (const e of files) {
    const pre = document.createElement('pre');
    pre.className = 'installerText';
    let text;
    try { text = installerTextOf(e); } catch (err) { text = 'Could not read: ' + err.message; }
    pre.textContent = e.name + '\n' + '─'.repeat(Math.min(e.name.length, 60)) + '\n' + text.replace(/\r\n?/g, '\n');
    grid.appendChild(pre);
  }
  out.textContent = files.length
    ? (which === 'AIRULES'
        ? 'The words the scripts are written in, from the application’s resource fork; then the AI Scripting Document, from the installer’s CombatAI folder: the rules the .ai scripts are written against.'
        : files.length + ' Combat AI scripts from the installer’s CombatAI folder. The compiled form the engine runs is subindex 3, under Components › Functions › Actors.')
    : (which === 'AIRULES' && !arc)
      ? 'The words the scripts are written in, from the application’s resource fork. The AI Scripting Document itself ships beside the game, not inside it.' + NO_INSTALLER_HINT
      : 'The installer has no ' + (which === 'AIRULES' ? 'AI Scripting Document' : '.ai scripts') + ' in it.';
}

/* ---- Data > Cythera Data > Changes --------------------------------------
   What was edited this session, and the ways it leaves the page, grouped by
   where the file is going rather than by format. Edits live in memory only
   (see applyResourceEdit); this is the one place they are listed.

   The typed patch leads on a phone because it is the only route that works
   there unassisted -- no picker, no drag, no disk -- and it is offered only
   while every edit keeps its resource the same length, which is
   buildResourcePatch's own rule. On a computer the file routes lead. The
   missing-resource-fork warning the exports already raise is printed here
   under the file routes, since a disk without the fork installs perfectly and
   then will not open. */
function renderChangesSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const box = document.createElement('div');
  box.className = 'changesView';
  const edited = Array.from(window.EDITED_RESIDS || []).sort((a, b) => a - b);
  const head = document.createElement('div');
  head.className = 'changesHead';
  if (!edited.length) {
    head.textContent = 'Nothing changed yet.';
    const p = document.createElement('div');
    p.className = 'changesNote';
    p.style.margin = '0';
    p.textContent = 'Open any resource, in any tab, and press Edit bytes; on a map, the ' +
      'inspector’s Edit chip changes one prop record. Edits live in memory only, ' +
      'a reload restores the file, and this tab is where they leave the page.';
    box.appendChild(head);
    box.appendChild(p);
    grid.appendChild(box);
    out.textContent = 'No edits this session.';
    return;
  }
  head.textContent = edited.length + ' resource' + (edited.length === 1 ? '' : 's') +
    ' changed this session · in memory only';
  box.appendChild(head);
  let before = null;
  try {
    before = new Map(delverArchiveSpec(window.PRISTINE_BYTES).resources.map(x => [x.resid, x.data.length]));
  } catch (e) { quiet(e); }
  for (const resid of edited) {
    const row = document.createElement('div');
    row.className = 'changesRow';
    const b = document.createElement('button');
    b.className = 'navChip';
    b.textContent = '0x' + resid.toString(16).toUpperCase();
    b.onclick = () => jumpToResource(resid);
    row.appendChild(b);
    const raw = getResourceBytes(ARCHIVE, resid);
    const was = before && before.has(resid) ? before.get(resid) : null;
    const lbl = labelFor(resid);
    const t = document.createElement('span');
    t.textContent = (lbl ? lbl + ' · ' : '') +
      (!raw ? 'removed'
       : was === null ? raw.length + ' bytes'
       : was === raw.length ? raw.length + ' bytes, same length'
       : was + ' bytes, now ' + raw.length);
    row.appendChild(t);
    box.appendChild(row);
  }
  const groups = [
    { title: 'to an emulator', routes: [
        { label: 'Download the disk image', fn: () => downloadEditedDiskImage(),
          note: '.dsk, mounts in an emulated Mac and carries its own installer; infinitemac.org takes it by drag and drop' },
        { label: 'Download the zip', fn: () => downloadEditedForkZip(),
          note: '.zip, both forks in the layout Basilisk II and infinitemac.org unpack, about half the size of the disk' } ] },
    { title: 'to a real Mac, or another tool', routes: [
        { label: 'Download as MacBinary', fn: () => downloadEditedMacBinary(),
          note: '.bin, both forks under the file’s own Finder identity; the emulator would need StuffIt Expander for it' },
        { label: 'Download the data fork', fn: () => downloadEditedArchive(),
          note: '.data, bare; delvmod and this page read it, the game needs the fork beside it' } ] }
  ];
  for (const g of groups) {
    const sec = document.createElement('div');
    sec.className = 'changesGroup';
    const tt = document.createElement('div');
    tt.className = 'changesGroupTitle';
    tt.textContent = g.title;
    sec.appendChild(tt);
    for (const route of g.routes) {
      const b = document.createElement('button');
      b.className = 'secondary';
      b.textContent = route.label;
      b.disabled = !!route.off;
      b.onclick = route.fn;
      sec.appendChild(b);
      const n = document.createElement('div');
      n.className = 'changesNote';
      n.textContent = route.note;
      sec.appendChild(n);
    }
    box.appendChild(sec);
  }
  const warn = missingForkWarning(window.CYTHERA_RSRC_RAW || new Uint8Array(0));
  if (warn) {
    const w = document.createElement('div');
    w.className = 'changesWarn';
    w.textContent = warn;
    box.appendChild(w);
  }
  grid.appendChild(box);
  out.textContent = edited.length + ' edited resource' + (edited.length === 1 ? '' : 's') +
    '; the archive on screen is the rebuilt one every route below writes.';
}
