#!/usr/bin/env node
/* Does js/delv-asm.js write what the disassembler reads? (24 September 2026)

   Three measurements over every script resource in the archive, and a
   control for the one that could pass while broken.

   1. The round trip. Every instruction of every function, as its listing
      text (the mnemonic and the operand exactly as dvmDisassemble prints
      them, a note and all), assembled on its own, must give back the bytes
      it was read from. A data block's bytes are not in the listing, so its
      line is written with them as hex. This is the oracle for the encoder:
      the archive is the whole corpus Ambrosia's compiler produced.

   2. A splice of nothing leaves a resource as it was.

   3. The relinker, measured from outside itself. Each resource with a
      header (one that is a single function from offset 0 has nowhere
      neutral to pad) is rebuilt
      with four bytes of padding in front of its first object (shiftAt, so
      everything after moves), and the rebuilt resource is disassembled
      afresh: it must have the same objects four bytes on, the same
      instructions in each, and every target a jump, a case, a subroutine
      call, a response or a near word prints, and every `here:` pointer,
      four more than before. This compares the disassembler's own text,
      not the relinker's list of sites, so a kind of site the relinker does
      not know about shows up here as a target that did not move.

   The control (--control, and run every time as well): the relinker's site
   finder is made to forget one kind of site, `then`, and measurement 3 must
   then fail. dvmRelink checks its own work by finding the sites again, and
   with the same blind spot on both sides that self-check passes -- which is
   exactly why measurement 3 does not use it.

   What this cannot see: whether an edited script does what its author meant.
   That is the game's to say; the fixes built with it were run in the fork. */

import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const args = process.argv.slice(2);
const [htmlPath = 'index.html', dataPath] = args.filter(a => !a.startsWith('--'));
if (!dataPath || !existsSync(dataPath)) {
  console.log(`  (no archive at ${dataPath || '<none given>'}; this check needs one)`);
  process.exit(0);
}
const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);
sandbox.__a = new Uint8Array(readFileSync(dataPath));

const run = forget => ev(`(() => {
  const arc = openDelverArchive(__a);
  const realSites = dvmOffsetSites;
  if (${JSON.stringify(forget)}) dvmOffsetSites = (b, r) => realSites(b, r).filter(s => s.kind !== ${JSON.stringify(forget)});
  const out = { resources: 0, functions: 0, ops: 0, roundTripBad: [], relinked: 0, moved: 0, relinkBad: [], identityBad: [], headless: 0 };
  const hex = a => Array.from(a, x => x.toString(16).padStart(2, '0')).join('');
  // The text of one op as the listing prints it.
  const lineOf = (op, seg) => {
    const mn = op[2], arg = op[3];
    if (mn === 'local' || mn === 'arg') return mn + ' ' + arg;
    if (mn === 'end') return 'end';
    if (mn === 'data') { const sz = (seg[op[0] + 1] << 8) | seg[op[0] + 2]; return 'data ' + hex(seg.subarray(op[0] + 3, op[0] + 3 + sz)); }
    return arg === '' ? mn : mn + ' ' + arg;
  };
  // Targets and pointers as the listing prints them, for measurement 3.
  const TARGETS = /^(then|branch|call_subroutine|cases|conversation_response|load_near_word|write_near_word)$/;
  const shifted = (text, from, by) => text.replace(/(here:|-> |, |\\( |^(?:branch|call_subroutine|load_near_word|write_near_word) )0x([0-9A-F]{4})\\b/g, (m, pre, h) => {
    const v = parseInt(h, 16); return pre + '0x' + (v >= from ? v + by : v).toString(16).toUpperCase().padStart(4, '0');
  });
  // A data block's bytes, with any four at any alignment that make a pointer
  // into this resource moved -- read off the bytes, not off the block's
  // structure, which is what the relinker reads.
  const shiftedData = (text, resid, from, by) => {
    const h = text.slice(5), d = h.match(/../g).map(x => parseInt(x, 16));
    for (let i = 0; i + 4 <= d.length; i++) {
      if ((d[i] & 0x80) && (((d[i] & 0x7F) << 8) | d[i + 1]) === resid) {
        const v = (d[i + 2] << 8) | d[i + 3];
        if (v >= from) { d[i + 2] = ((v + by) >> 8) & 0xFF; d[i + 3] = (v + by) & 0xFF; }
        i += 3;
      }
    }
    return 'data ' + d.map(x => x.toString(16).padStart(2, '0')).join('');
  };
  try {
    for (let subn = 0; subn < 256; subn++) {
      if (!arc.index[subn] || !arc.index[subn][0]) continue;
      for (let n = 0; n < 256; n++) {
        const resid = (subn + 1) * 0x100 + n;
        let raw = null;
        try { raw = getResourceBytes(arc, resid); } catch (err) { continue; }
        if (!raw || !raw.length) continue;
        const b = smartDecrypt(raw, resid).data;
        let objs = [];
        try { objs = dvmExtents(b, resid); } catch (err) { continue; }
        if (!objs.some(o => o[2] === 'function')) continue;
        out.resources++;
        dvmContextResid = resid;
        const listing = [];
        for (const [st, en, kind] of objs) {
          if (kind !== 'function') continue;
          const seg = b.subarray(st, Math.min(en, b.length));
          if (seg.length < 4) continue;
          let r; try { r = dvmDisassemble(seg, 3); } catch (err) { continue; }
          out.functions++;
          const ops = r.ops;
          for (let i = 0; i < ops.length; i++) {
            const op = ops[i];
            if (op[2] === '??') continue;
            const end = i + 1 < ops.length ? ops[i + 1][0] : seg.length;
            const want = seg.subarray(op[0], end);
            const text = lineOf(op, seg);
            listing.push({ at: st + op[0], mn: op[2], text });
            out.ops++;
            let got;
            try {
              const a = dvmAssemble(text, resid);
              got = a.bytes.slice();
              for (const s of a.sites) { got[s.at] = (s.value >> 8) & 0xFF; got[s.at + 1] = s.value & 0xFF; }
            } catch (err) { got = null; if (out.roundTripBad.length < 12) out.roundTripBad.push(resid.toString(16) + '@' + (st + op[0]).toString(16) + ' ' + text.slice(0, 60) + ': ' + err.message); continue; }
            if (hex(got) !== hex(want) && out.roundTripBad.length < 12) out.roundTripBad.push(resid.toString(16) + '@' + (st + op[0]).toString(16) + ' ' + text.slice(0, 60) + ': ' + hex(got) + ' for ' + hex(want));
          }
        }
        // 2: a splice of nothing.
        try {
          const same = dvmRelink(b, resid, objs[0][0], 0, new Uint8Array(0)).bytes;
          if (hex(same) !== hex(b)) out.identityBad.push(resid.toString(16));
        } catch (err) { out.identityBad.push(resid.toString(16) + ' ' + err.message); }
        // 3: four bytes in front of the first object, read back from outside.
        // A resource that is one function from offset 0 has no header and no
        // neutral place to put them; counted, and left to measurements 1-2.
        if (objs[0][0] === 0) { out.headless++; continue; }
        const at = objs[0][0];
        let nb;
        try { const rl = dvmRelink(b, resid, at, 0, new Uint8Array(4), { shiftAt: true }); nb = rl.bytes; out.moved += rl.moved; }
        catch (err) { if (!${JSON.stringify(forget)}) out.relinkBad.push(resid.toString(16) + ' relink: ' + err.message); continue; }
        out.relinked++;
        const nobjs = dvmExtents(nb, resid);
        const was = objs.map(o => (o[0] + 4) + ':' + o[2]).join(), now = nobjs.map(o => o[0] + ':' + o[2]).join();
        if (was !== now) { out.relinkBad.push(resid.toString(16) + ' objects ' + was.slice(0, 60) + ' became ' + now.slice(0, 60)); continue; }
        const again = [];
        for (const [st, en, kind] of nobjs) {
          if (kind !== 'function') continue;
          const seg = nb.subarray(st, Math.min(en, nb.length));
          if (seg.length < 4) continue;
          let r; try { r = dvmDisassemble(seg, 3); } catch (err) { continue; }
          for (const op of r.ops) if (op[2] !== '??') again.push({ at: st + op[0], mn: op[2], text: lineOf(op, seg) });
        }
        if (again.length !== listing.length) { out.relinkBad.push(resid.toString(16) + ' ' + listing.length + ' ops became ' + again.length); continue; }
        for (let i = 0; i < listing.length; i++) {
          const o = listing[i], q = again[i];
          const expect = o.mn === 'data' ? shiftedData(o.text, resid, at, 4) : (TARGETS.test(o.mn) || /here:/.test(o.text)) ? shifted(o.text, at, 4) : o.text;
          if (q.at !== o.at + 4 || q.mn !== o.mn || q.text !== expect) {
            out.relinkBad.push(resid.toString(16) + '@' + o.at.toString(16) + ' ' + expect.slice(0, 50) + ' read back as ' + q.text.slice(0, 50));
            break;
          }
        }
      }
    }
  } finally { dvmOffsetSites = realSites; dvmContextResid = null; }
  return out;
})()`);

const r = run(null);
let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
if (r.resources < 800 || r.ops < 50000 || r.relinked < 400) fail('coverage', `${r.resources} resources and ${r.ops} instructions read`);
if (r.roundTripBad.length) fail('round trip', r.roundTripBad.join('\n    '));
if (r.identityBad.length) fail('splice of nothing', r.identityBad.slice(0, 8).join(', '));
if (r.relinkBad.length) fail('relink', r.relinkBad.slice(0, 8).join('\n    '));
if (!r.moved) fail('relink', 'nothing moved, so the shift measured nothing');
// The control: forgetting `then` must be seen from outside.
const c = run('then');
if (!c.relinkBad.length) fail('control', 'the relinker was made to forget every `then` and measurement 3 still passed');
if (!failures) console.log(`script writing: ${r.ops} instructions in ${r.functions} functions of ${r.resources} resources assemble back to their bytes; all ${r.relinked} with a header relink four bytes on, ${r.moved} offsets moved and read back (${r.headless} are one function from offset 0); the control is caught (${c.relinkBad.length} resources)`);
process.exit(failures ? 1 : 0);
