/* delv-apppatch.js -- the fixes of js/delv-appfixes.js, applied to the program.

   applyAppFixes({ data, rsrc }, fixes) -> { data, rsrc, applied, grownBy, caveAt }

   `data` and `rsrc` are the application's two forks; `fixes` is a list of
   entries from APP_FIXES (any subset, in any order). The answer is the two
   forks patched, and for each fix what it changed. Anything that does not
   match what a fix expects throws, naming the fix and the place, and
   nothing is returned: a patch applied in part is a program nobody has
   read.

   WHAT IT DOES, in order:

   1. Holds the data fork to APP_FIXES_TARGET: a PEF container whose code
      section begins and ends where 1.0.4's does and whose data section
      follows it at once. That is the layout step 4 grows; a program laid
      out otherwise is refused rather than grown by a rule written for
      another.
   2. Places the caves. Every chosen fix's cave, one after another, from
      the end of the code section, each label at its word. A branch in a
      site to `@cave` or a label reaches its own fix's cave, never
      another's.
   3. Writes each site's words, after checking every word the site
      replaces is the word the fix says is there now. Two fixes that change
      one word are refused together.
   4. Grows the code section by the caves' length rounded up to 16 (the
      sections' alignment) and moves everything after it by that much: the
      data section's container offset in the section header, the code
      section's three sizes, and, since the second fragment in the fork
      moves too, the offsets and lengths `cfrg 0` gives each fragment in
      the data fork. The loader's relocations, imports, exports and entry
      point are all relative to their sections and do not move. The
      traceback tables between routines would have held the code instead,
      at the price of the names every tool here reads from them; nothing
      at run time reads them, but the tools do.
   5. Rewrites the text: each `data` edit where the string sits, written in
      place at its own length or shorter, the rest NUL. Cythera's strings
      are in the code section, after the routines, where CodeWarrior put
      its constant data, so they neither move nor pass through the data
      section's packing; one in the data section's packed stream would be
      stored literally too, and the check holds the unpacked section to
      exactly the letters changed either way.
   6. Rewrites the resources: a string in a STR#, or a whole resource, and
      the cfrg of step 4, through writeResourceFork.

   Nothing here knows which fixes exist: that is js/delv-appfixes.js. The
   assembler is js/mac-ppc-asm.js; the reader of what comes out,
   js/mac-pef.js and js/mac-ppc.js. */

function appPatchError(fix, why) { return new Error((fix ? fix.id + ': ' : '') + why); }

// Every routine's code address by its mangled name, a name two routines
// share left out so that `@name` can never mean the wrong one.
function appRoutineAddresses(pef, data) {
  const byName = new Map(), twice = new Set();
  for (const r of pefTracebacks(pef, data)) {
    if (byName.has(r.mangled)) twice.add(r.mangled);
    byName.set(r.mangled, r.offset);
  }
  for (const n of twice) byName.delete(n);
  return byName;
}

// The strings of a STR#, and the resource written back from them.
function appStrList(bytes) {
  const n = (bytes[0] << 8) | bytes[1], out = [];
  let p = 2;
  for (let i = 0; i < n; i++) { const len = bytes[p]; out.push(bytes.slice(p + 1, p + 1 + len)); p += 1 + len; }
  return out;
}
function appStrListBytes(list) {
  const total = 2 + list.reduce((s, b) => s + 1 + b.length, 0);
  const out = new Uint8Array(total);
  out[0] = list.length >> 8; out[1] = list.length & 0xFF;
  let p = 2;
  for (const b of list) { if (b.length > 255) throw new Error('a string of ' + b.length + ' bytes will not fit a STR#'); out[p] = b.length; out.set(b, p + 1); p += 1 + b.length; }
  return out;
}
function appFindBytes(hay, needle) {
  const at = [];
  outer: for (let i = 0; i + needle.length <= hay.length; i++) {
    for (let k = 0; k < needle.length; k++) if (hay[i + k] !== needle[k]) continue outer;
    at.push(i);
  }
  return at;
}

function applyAppFixes(app, fixes, opts) {
  opts = opts || {};
  const T = opts.target || APP_FIXES_TARGET;
  const data = app && app.data, rsrc = app && app.rsrc;
  if (!data) throw appPatchError(null, 'no data fork: the fixes are to the PowerPC program, which is in the data fork');
  const pef = parsePEF(data);
  if (!pef) throw appPatchError(null, 'the data fork is not a PEF container');
  const code = pef.sections.find(s => s.kind === 0);
  const after = pef.sections.filter(s => s.kind !== 0 && s.containerOffset >= (code ? code.containerOffset : 0) && s.packedSize > 0);
  if (!code || code.containerOffset !== T.codeOffset || code.totalSize !== T.codeSize || code.packedSize !== T.codeSize)
    throw appPatchError(null, 'this is not ' + T.name + ': its code section is not the one the fixes were read from' +
      (code && code.totalSize !== T.codeSize ? ' (it is ' + code.totalSize + ' bytes, and a patched copy is larger)' : ''));
  const codeEnd = code.containerOffset + code.totalSize;
  if (codeEnd !== T.dataOffset || !after.some(s => s.containerOffset === codeEnd))
    throw appPatchError(null, 'the data section does not follow the code section, so the code cannot be grown in place');

  const ids = new Set();
  for (const f of fixes) { if (ids.has(f.id)) throw appPatchError(f, 'chosen twice'); ids.add(f.id); }
  const routines = appRoutineAddresses(pef, data);
  const word = a => pefU32(data, code.containerOffset + a);

  // 2. The caves, laid out and labelled.
  let caveAt = code.totalSize;
  const plan = fixes.map(f => {
    const labels = new Map(), lines = [];
    const start = caveAt;
    let a = start;
    for (const raw of f.cave || []) {
      const t = String(raw).replace(/;.*$/, '').trim();
      if (!t) continue;
      const m = /^([A-Za-z_][\w]*):$/.exec(t);
      if (m) { if (labels.has(m[1])) throw appPatchError(f, 'the label ' + m[1] + ' twice'); labels.set(m[1], a); continue; }
      lines.push({ at: a, text: raw }); a += 4;
    }
    if (lines.length) labels.set('cave', start);
    caveAt = a;
    return { fix: f, labels, lines, start, end: a };
  });
  const caveBytes = caveAt - code.totalSize;
  const grow = Math.ceil(caveBytes / 16) * 16;

  const resolverFor = p => name => {
    if (p.labels.has(name)) return p.labels.get(name);
    if (routines.has(name)) return routines.get(name);
    return undefined;
  };
  const written = new Map();          // code address -> the fix that wrote it
  const newCode = new Uint8Array(code.totalSize + grow);
  newCode.set(data.subarray(code.containerOffset, codeEnd));
  const put = (a, w) => { newCode[a] = w >>> 24; newCode[a + 1] = (w >>> 16) & 0xFF; newCode[a + 2] = (w >>> 8) & 0xFF; newCode[a + 3] = w & 0xFF; };
  const applied = [];

  // 3. The sites, checked and written; then the caves.
  for (const p of plan) {
    const f = p.fix, resolve = resolverFor(p), words = [];
    for (const s of f.sites || []) {
      if (!Array.isArray(s.was) || !Array.isArray(s.asm) || s.was.length !== s.asm.length)
        throw appPatchError(f, 'the site at 0x' + s.at.toString(16) + ' gives ' + (s.was || []).length + ' words and ' + (s.asm || []).length + ' lines');
      if (s.at < 0 || s.at + 4 * s.was.length > code.totalSize || (s.at & 3)) throw appPatchError(f, 'the site at 0x' + s.at.toString(16) + ' is not in the code');
      s.was.forEach((w, i) => {
        const a = s.at + 4 * i, now = word(a);
        if (now !== (w >>> 0)) throw appPatchError(f, 'expected ' + w.toString(16).toUpperCase().padStart(8, '0') + ' at 0x' + a.toString(16).toUpperCase() +
          ', found ' + now.toString(16).toUpperCase().padStart(8, '0') + ': not ' + T.name + ', or patched already');
        if (written.has(a)) throw appPatchError(f, 'changes the word at 0x' + a.toString(16).toUpperCase() + ', which ' + written.get(a) + ' changes too');
        written.set(a, f.id);
        let nw;
        try { nw = ppcAssemble(s.asm[i], a, resolve); } catch (e) { throw appPatchError(f, e.message); }
        put(a, nw);
        words.push({ at: a, was: now, now: nw, text: s.asm[i] });
      });
    }
    for (const l of p.lines) {
      let nw;
      try { nw = ppcAssemble(l.text, l.at, resolve); } catch (e) { throw appPatchError(f, e.message); }
      put(l.at, nw);
      words.push({ at: l.at, was: null, now: nw, text: l.text });
    }
    applied.push({ id: f.id, words, caveAt: p.lines.length ? p.start : null, caveWords: p.lines.length });
  }

  // 4. The data fork, grown.
  const out = new Uint8Array(data.length + grow);
  out.set(data.subarray(0, code.containerOffset));
  out.set(newCode, code.containerOffset);
  out.set(data.subarray(codeEnd), codeEnd + grow);
  const w32 = (b, o, v) => { b[o] = v >>> 24; b[o + 1] = (v >>> 16) & 0xFF; b[o + 2] = (v >>> 8) & 0xFF; b[o + 3] = v & 0xFF; };
  for (const s of pef.sections) {
    const h = 40 + s.index * 28;
    if (s === code) { w32(out, h + 8, s.totalSize + grow); w32(out, h + 12, s.unpackedSize + grow); w32(out, h + 16, s.packedSize + grow); }
    else if (s.containerOffset >= codeEnd && (s.packedSize > 0 || s.totalSize > 0)) w32(out, h + 20, s.containerOffset + grow);
  }
  const moved = o => (o >= codeEnd ? o + grow : o);

  // 5. The text in the data fork.
  for (const f of fixes) for (const d of f.data || []) {
    const was = encodeMacRoman(d.was), now = encodeMacRoman(d.now);
    if (now.length > was.length) throw appPatchError(f, '"' + d.now + '" is longer than "' + d.was + '", and a string in the data section cannot grow');
    for (let i = 0; i < was.length; i++)
      if (data[d.at + i] !== was[i]) throw appPatchError(f, 'expected "' + d.was + '" at 0x' + d.at.toString(16).toUpperCase() + ' of the data fork');
    const at = moved(d.at);
    for (let i = 0; i < was.length; i++) out[at + i] = i < now.length ? now[i] : 0;
    const a = applied.find(x => x.id === f.id);
    (a.text = a.text || []).push({ at: d.at, was: d.was, now: d.now });
  }

  // 6. The resources, and the cfrg that says where the fragments are.
  let rsrcOut = rsrc || null;
  const rsrcEdits = fixes.filter(f => (f.rsrc || []).length);
  if (rsrc && (grow || rsrcEdits.length)) {
    const fork = openResourceFork(rsrc), spec = resourceForkSpec(fork);
    const find = (f, type, id) => {
      const r = spec.resources.find(r => r.type === type && r.id === id);
      if (!r) throw appPatchError(f, 'no ' + type + ' ' + id + ' in the resource fork');
      return r;
    };
    const touched = new Map();
    for (const f of rsrcEdits) for (const e of f.rsrc) {
      const r = find(f, e.type, e.id), key = e.type + ' ' + e.id + (e.index ? ' #' + e.index : '');
      if (touched.has(key)) throw appPatchError(f, 'changes ' + key + ', which ' + touched.get(key) + ' changes too');
      touched.set(key, f.id);
      if (e.type === 'STR#' && e.index) {
        const list = appStrList(r.data);
        const s = list[e.index - 1];
        if (!s) throw appPatchError(f, 'STR# ' + e.id + ' has no string ' + e.index);
        const at = appFindBytes(s, encodeMacRoman(e.was));
        if (at.length !== 1) throw appPatchError(f, '"' + e.was + '" is in STR# ' + e.id + ' #' + e.index + ' ' + at.length + ' times, not once');
        const was = encodeMacRoman(e.was), now = encodeMacRoman(e.now);
        const next = new Uint8Array(s.length - was.length + now.length);
        next.set(s.subarray(0, at[0])); next.set(now, at[0]); next.set(s.subarray(at[0] + was.length), at[0] + now.length);
        list[e.index - 1] = next;
        r.data = appStrListBytes(list);
      } else {
        const was = Uint8Array.from(e.was);
        if (r.data.length !== was.length || was.some((b, i) => r.data[i] !== b))
          throw appPatchError(f, e.type + ' ' + e.id + ' is not what the fix expects');
        r.data = Uint8Array.from(e.now);
      }
      const a = applied.find(x => x.id === f.id);
      (a.resources = a.resources || []).push(key);
    }
    if (grow) {
      const r = spec.resources.find(r => r.type === 'cfrg' && r.id === 0);
      if (!r) throw appPatchError(null, 'no cfrg 0, so nothing says where the program is in the data fork');
      const c = Uint8Array.from(r.data), count = pefU32(c, 0x1C);
      let p = 0x20;
      for (let i = 0; i < count; i++) {
        const where = c[p + 0x17], off = pefU32(c, p + 0x18), len = pefU32(c, p + 0x1C), size = pefU16(c, p + 0x28);
        if (where === 1) {                                         // in the data fork
          if (off >= codeEnd) w32(c, p + 0x18, off + grow);
          else if (len === 0 || off + len > codeEnd) { if (len) w32(c, p + 0x1C, len + grow); }
        }
        if (size < 0x2B) throw appPatchError(null, 'cfrg 0 member ' + i + ' is ' + size + ' bytes');
        p += size;
      }
      r.data = c;
    }
    rsrcOut = writeResourceFork(spec);
    openResourceFork(rsrcOut);                                     // it must read back
  } else if (grow && !rsrc) throw appPatchError(null, 'no resource fork, so its cfrg cannot be moved with the code');

  return { data: out, rsrc: rsrcOut, applied, grownBy: grow, caveAt: code.totalSize, caveBytes };
}
