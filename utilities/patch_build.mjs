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

export function buildPatch({htmlPath = 'index.html', dataPath, outDir, name, description, edits = [], dataEdits = []}) {
  const {sandbox} = makeSandbox();
  sandbox.Buffer = Buffer;
  const ctx = vm.createContext(sandbox);
  new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
  sandbox.__a = new Uint8Array(readFileSync(dataPath));
  const out = vm.runInContext(`(() => {
    const EDITS = ${JSON.stringify(edits)};
    const DATA = ${JSON.stringify(dataEdits.map(d => ({what: d.what, resid: d.resid, src: d.fn.toString()})))};
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
