/* The machinery bugfix_patch.mjs uses to turn a list of edits into one
   Magpie patch, lifted out so that the two builders written on 24 September
   2026 -- community_fixes_patch.mjs and found_fixes_patch.mjs -- share it
   rather than carry three copies of the same sixty lines. Nothing here is
   new: the page's own assembler and relinker (dvmAssemble, dvmRelink in
   js/delv-asm.js), the archive writer, writeDelverPatch with type 3 and
   the MacBinary wrapper, all run inside the page's vm sandbox exactly as
   the first builder ran them.

   buildPatch({ htmlPath, dataPath, outDir, name, description, edits,
                dataEdits })
     edits: [{ what, resid, at, to?, expect: {offset: 'listing text'},
               code }]  -- code in the raw listing's own words; `to`
             omitted means insert at `at`, otherwise replace at..to. The
             offsets are the resource's as it stands when the edit is
             applied, so edits to one resource are applied in the order
             given: put the higher offsets first, or keep the earlier
             edits the same length.
     textEdits: [{ what, resid, find, replace, count?, mid? }] -- every
             occurrence of the text `find` in the resource (count says how
             many there must be; omitted means at least one) is replaced by
             `replace`, right to left, each through dvmRelink with the new
             bytes, so the offsets past it move; and where the text sits
             inside a `data` block (the direction lists, the shop's lines,
             a rumour) the block's size word is corrected by the difference,
             which the relinker does not know to do. Text is bytes below
             0x80 wherever it is -- an implicit string, a NUL-terminated
             string operand, an array entry, a data block -- so this is the
             same edit for all of them.
     dataEdits: [{ what, resid, fn }] -- fn is the SOURCE of a function
             (b) => string, run inside the sandbox on the decrypted bytes
             (a copy); it edits b in place and returns a log line, or
             throws when the bytes are not what it expects.
   Writes "<name>" (the bare patch), "<name>.bin" (MacBinary, DelP) and
   the patched "Cythera Data.data" into outDir, and exits 1 when the patch
   merged back onto the shipped file does not give the patched file byte
   for byte. What it writes is the game's data changed and belongs in no
   repository. */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

export function buildPatch({htmlPath = 'index.html', dataPath, outDir, name, description, edits = [], dataEdits = [], textEdits = []}) {
  const {sandbox} = makeSandbox();
  sandbox.Buffer = Buffer;
  const ctx = vm.createContext(sandbox);
  new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
  sandbox.__a = new Uint8Array(readFileSync(dataPath));
  const out = vm.runInContext(`(() => {
    const EDITS = ${JSON.stringify(edits)};
    const DATA = ${JSON.stringify(dataEdits.map(d => ({what: d.what, resid: d.resid, src: d.fn.toString()})))};
    const TEXT = ${JSON.stringify(textEdits)};
    const arc = openDelverArchive(__a);
    dvmSetResourceSymbols(loadResourceSymbolsFrom(arc));
    const spec = delverArchiveSpec(__a);
    const plain = new Map();
    const bytesOf = resid => plain.get(resid) || smartDecrypt(getResourceBytes(arc, resid), resid).data;
    const opAt = (b, resid, at) => {
      const fn = dvmExtents(b, resid).find(([st, en, k]) => k === 'function' && at >= st && at < en);
      if (!fn) return null;
      dvmContextResid = resid;
      const ops = dvmDisassemble(b.subarray(fn[0], fn[1]), 3).ops;
      const i = ops.findIndex(o => fn[0] + o[0] === at);
      if (i < 0) return null;
      const op = ops[i];
      return { text: op[2] + (op[3] ? ' ' + op[3] : ''), next: i + 1 < ops.length ? fn[0] + ops[i + 1][0] : fn[1] };
    };
    const log = [];
    for (const e of EDITS) {
      const b = bytesOf(e.resid);
      for (const [at, want] of Object.entries(e.expect || {})) {
        const got = opAt(b, e.resid, +at);
        if (!got || !got.text.startsWith(want)) throw new Error(e.what + ': at 0x' + (+at).toString(16) + ' the listing says ' + (got && got.text) + ', not ' + want);
      }
      let to = e.to;
      if (e.replaceOp) { const g = opAt(b, e.resid, e.at); if (!g) throw new Error(e.what + ': no instruction at 0x' + e.at.toString(16)); to = g.next; }
      const asm = dvmAssemble(e.code, e.resid);
      const rl = dvmRelink(b, e.resid, e.at, to === undefined ? 0 : to - e.at, asm);
      plain.set(e.resid, rl.bytes);
      log.push(e.what + ': 0x' + e.resid.toString(16).toUpperCase() + ', ' + (rl.delta >= 0 ? '+' : '') + rl.delta + ' bytes, ' + rl.moved + ' offsets moved');
    }
    const dataBlocks = (b, resid) => {
      const out = [];
      for (const [st, en, kind] of dvmExtents(b, resid)) {
        if (kind !== 'function') continue;
        dvmContextResid = resid;
        let r; try { r = dvmDisassemble(b.subarray(st, en), 3); } catch (e) { continue; }
        for (const op of r.ops) if (op[2] === 'data') { const a = st + op[0]; out.push({ a, size: (b[a + 1] << 8) | b[a + 2] }); }
      }
      return out;
    };
    const toBytes = s => Uint8Array.from(s, c => { const v = c.charCodeAt(0); if (v >= 0x80) throw new Error('text edit has a byte above 0x7F: ' + s); return v; });
    const findAll = (b, needle) => { const out = []; for (let i = 0; i + needle.length <= b.length; i++) { let k = 0; while (k < needle.length && b[i + k] === needle[k]) k++; if (k === needle.length) out.push(i); } return out; };
    for (const e of TEXT) {
      let b = bytesOf(e.resid);
      const needle = toBytes(e.find), repl = toBytes(e.replace);
      // 'mid': only in the middle of a sentence, a space before and a
      // lower-case letter after, which keeps an operand byte that happens
      // to equal the text (a tab is 9, and 0x813 has three of those between
      // bytes that print as '@' and a digit) out.
      const lower = v => v >= 0x61 && v <= 0x7A;
      const hits = findAll(b, needle).filter(i => !e.mid || (i > 0 && b[i - 1] === 0x20 && i + needle.length < b.length && lower(b[i + needle.length])));
      if (e.count !== undefined ? hits.length !== e.count : hits.length < 1) throw new Error(e.what + ': "' + e.find + '" found ' + hits.length + ' times in 0x' + e.resid.toString(16) + (e.count !== undefined ? ', not ' + e.count : ''));
      const blocks = dataBlocks(b, e.resid);
      let moved = 0;
      for (const off of hits.reverse()) {
        // dvmRelink's splice and check, with one step it cannot take put
        // between them: a data block's size word corrected before the
        // result is read back, since the block is read by that size and a
        // stale one throws every site after it off.
        const delta = repl.length - needle.length, cutEnd = off + needle.length;
        const sites = dvmOffsetSites(b, e.resid);
        const out = new Uint8Array(b.length + delta);
        out.set(b.subarray(0, off), 0); out.set(repl, off); out.set(b.subarray(cutEnd), off + repl.length);
        if (delta) for (const blk of blocks) if (off >= blk.a + 3 && off < blk.a + 3 + blk.size) { blk.size += delta; out[blk.a + 1] = (blk.size >> 8) & 0xFF; out[blk.a + 2] = blk.size & 0xFF; }
        const expect = new Map();
        for (const s of sites) {
          const p = s.at < off ? s.at : s.at >= cutEnd ? s.at + delta : null;
          if (p === null) continue;
          const v = s.value <= off ? s.value : s.value < cutEnd ? null : s.value + delta;
          if (v === null) throw new Error(e.what + ': 0x' + s.value.toString(16) + ', which a ' + s.kind + ' points at, is inside the text replaced');
          if (v !== s.value) { dvmWriteSite(out, { at: p, size: s.size }, v); moved++; }
          expect.set(p, v);
        }
        const again = dvmOffsetSites(out, e.resid);
        const bad = again.filter(s => expect.has(s.at) && expect.get(s.at) !== s.value);
        const lost = [...expect.keys()].filter(q => !again.some(s => s.at === q));
        if (bad.length || lost.length) throw new Error(e.what + ' at 0x' + off.toString(16) + ' in 0x' + e.resid.toString(16) + ': the resource does not read back, ' + bad.length + ' offsets wrong, ' + lost.length + ' no longer found');
        b = out;
      }
      plain.set(e.resid, b);
      log.push(e.what + ': 0x' + e.resid.toString(16).toUpperCase() + ', ' + hits.length + ' place' + (hits.length === 1 ? '' : 's') + ', ' + moved + ' offsets moved');
    }
    for (const d of DATA) {
      const b = bytesOf(d.resid).slice();
      const fn = (0, eval)('(' + d.src + ')');
      const line = fn(b);
      plain.set(d.resid, b);
      log.push(d.what + ': 0x' + d.resid.toString(16).toUpperCase() + ', ' + line);
    }
    for (const [resid, data] of plain) { const r = spec.resources.find(x => x.resid === resid); r.data = data; }
    const patched = writeDelverArchive(spec);
    const w = writeDelverPatch(spec, [...plain.keys()], { description: ${JSON.stringify(description)}, typeCode: DELV_PATCH_EXPORT_TYPE });
    const bin = writeMacBinary({ name: ${JSON.stringify(name)}, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
    const merged = mergeDelverPatch(__a, w.bytes);
    const same = merged && merged.bytes && merged.bytes.length === patched.length && merged.bytes.every((x, i) => x === patched[i]);
    return { log, patch: Array.from(w.bytes), bin: Array.from(bin), patched: Array.from(patched), resids: w.resids, same: !!same, mergeInfo: merged ? Object.keys(merged).join(',') : null };
  })()`, ctx);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outDir + '/' + name, Buffer.from(out.patch));
  writeFileSync(outDir + '/' + name + '.bin', Buffer.from(out.bin));
  writeFileSync(outDir + '/Cythera Data.data', Buffer.from(out.patched));
  for (const l of out.log) console.log('  ' + l);
  console.log(`  patch: ${out.resids.length} resources, ${out.patch.length} bytes; merged onto the shipped file it ${out.same ? 'gives the patched file byte for byte' : 'does NOT give the patched file (' + out.mergeInfo + ')'}`);
  return out.same;
}
