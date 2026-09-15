#!/usr/bin/env node
// Does mergeDelverPatch apply a Magpie patch, and only the patch?
//
//   node utilities/patch_check.mjs index.html "$TMPDIR/Cythera Data.data" \
//        [reference/community/addons] [unpack dir]
//
// WHY. A Magpie patch is the one add-on system Cythera has, and applying one
// re-serializes the whole 5.6 MB archive. Two things could go wrong quietly.
// The merge could touch a resource the patch never named -- 1,558 resources go
// through the writer and only twelve are meant to move -- and the
// re-serialization could differ from what the format's reference writer
// produces, which is the property delv_write_check.mjs holds
// writeDelverArchive to against delvmod. Neither would look like a failure:
// the game would boot and something would be subtly wrong somewhere in it.
//
// THE ORACLE IS THE UNPATCHED RE-SERIALIZATION. writeDelverArchive is not
// byte-identical to Ambrosia's shipped layout and is not meant to be -- the
// shipped file is 5,608,688 bytes and the writer's 5,596,146, because the
// writer lays resources out as delvmod does. So the comparison that means
// something is not merged-against-shipped; it is
//
//     writeDelverArchive(delverArchiveSpec(base))   the base, re-written
//     mergeDelverPatch(base, patch).bytes           the same, patched
//
// Every resource the patch does not name must come back byte for byte between
// those two, and every resource it does name must read back as what the patch
// holds. That isolates the merge from the writer, and the writer already has
// its own oracle in delv_write_check.mjs.
//
// THE NEGATIVE CONTROL. A check that cannot fail proves nothing. Merging a
// patch whose replacement bytes have been changed must move the merged
// archive's hash, and re-reading resource 0x8E04 must give back the changed
// bytes rather than the original. Both directions are asserted here.
//
// The patch arrives as .hqx wrapping a .sit whose data fork is compressed
// with StuffIt method 13. The page decompresses that itself since 15
// September 2026, so this check no longer shells out to `unar` and no longer
// skips on a machine that lacks it -- and getting the patch out through
// extractDelverArchive is now part of what is being tested, which is the
// route a visitor's dropped file actually takes.

import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', dataPath,
       addonDir = 'reference/community/addons'] = process.argv.slice(2);

let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);
const skip = why => { console.log(`  skip  ${why}`); process.exit(0); };

if (!dataPath || !existsSync(dataPath)) skip('no Cythera Data to patch');
const hqx = join(addonDir, '614_MagpiePumpkinPatch.sit.hqx');
if (!existsSync(hqx)) skip('the Magpie Pumpkin Patch is not in the add-ons');

const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);

// ---- the page opens the .hqx the way a dropped file is opened --------------
// BinHex around StuffIt around the patch, and extractDelverArchive walks all
// three. The listing is asserted as well as the extraction, because it is
// what names the file inside and a wrong one would still extract something.
sandbox.__hqx = new Uint8Array(readFileSync(hqx));
const listed = ev(`(() => {
  globalThis.__sit = binhexSplitForks(binhexDecode(__hqx)).data;
  return parseStuffItArchive(__sit).entries.map(e => e.path);
})()`);
if (!listed.includes('Patches/Pumpkin Patch'))
  fail('StuffIt listing', 'no "Patches/Pumpkin Patch" in ' + JSON.stringify(listed));
else ok('the .sit lists the patch', listed.length + ' entries');

const opened = ev(`(() => {
  const g = extractDelverArchive(__hqx);
  globalThis.__patch = g.bytes;
  return {via: g.via, name: g.forks && g.forks.name, len: g.bytes.length};
})()`);
if (opened.name !== 'Pumpkin Patch')
  fail('the patch opens from its .hqx', 'opened "' + opened.name + '" instead');
else ok('the patch opens straight from its .sit.hqx', `${opened.via}, ${opened.len.toLocaleString()} bytes, no unar`);

sandbox.__base = new Uint8Array(readFileSync(dataPath));

// ---- the merge -------------------------------------------------------------
const r = ev(`(() => {
  const m = mergeDelverPatch(__base, __patch);
  globalThis.__merged = m.bytes;
  return {replaced: m.replaced, skipped: m.skipped, disagreed: m.disagreed,
          title: m.title, len: m.bytes.length};
})()`);
ok('the patch applies', `${r.replaced.length} resource(s) replaced, ${r.skipped.length} skipped, ${r.disagreed.length} refused on an encryption disagreement`);
if (r.replaced.length !== 12) fail('replaced count', `expected 12, got ${r.replaced.length}`);
if (r.skipped.length !== 1 || r.skipped[0] !== 0xFFFF)
  fail('skipped set', `expected only 0xFFFF, got ${r.skipped.map(i => '0x' + i.toString(16))}`);
if (r.disagreed.length) fail('encryption verdicts', `${r.disagreed.length} disagreed`);

// ---- only what the patch names moved --------------------------------------
const cmp = ev(`(() => {
  const plain = writeDelverArchive(delverArchiveSpec(__base));
  const A = delverArchiveSpec(plain), B = delverArchiveSpec(__merged);
  const P = new Map(delverArchiveSpec(__patch).resources.map(r => [r.resid, r.data]));
  const a = new Map(A.resources.map(r => [r.resid, r.data]));
  const b = new Map(B.resources.map(r => [r.resid, r.data]));
  const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
  let moved = [], missing = [], wrong = [], extra = [];
  for (const [id, av] of a) {
    const bv = b.get(id);
    if (!bv) { missing.push(id); continue; }
    if (!same(av, bv)) moved.push(id);
  }
  for (const id of b.keys()) if (!a.has(id)) extra.push(id);
  for (const id of moved) { const pv = P.get(id); if (!pv || !same(b.get(id), pv)) wrong.push(id); }
  return {moved, missing, wrong, extra, aCount: a.size, bCount: b.size, plainLen: plain.length};
})()`);
if (cmp.missing.length) fail('resources lost', cmp.missing.length + ' resource(s) gone from the merged archive');
if (cmp.extra.length) fail('resources added', cmp.extra.map(i => '0x' + i.toString(16)).join(' '));
const movedSet = cmp.moved.map(i => i).sort((x, y) => x - y).join(',');
const wantSet = r.replaced.slice().sort((x, y) => x - y).join(',');
if (movedSet !== wantSet)
  fail('only the patch moved', `changed ${cmp.moved.map(i => '0x' + i.toString(16)).join(' ')}, patch names ${r.replaced.map(i => '0x' + i.toString(16)).join(' ')}`);
else ok('only the patch\'s resources changed', `${cmp.moved.length} of ${cmp.aCount}, the other ${cmp.aCount - cmp.moved.length} byte for byte`);
if (cmp.wrong.length) fail('replacement bytes', cmp.wrong.length + ' changed resource(s) do not equal the patch');
else ok('each replacement reads back as the patch holds it', cmp.moved.length + ' resource(s)');

// ---- the negative control --------------------------------------------------
const neg = ev(`(() => {
  const hash = b => { let h = 0x811c9dc5; for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 0x01000193) >>> 0; } return h; };
  const before = hash(__merged);
  const spoiled = delverArchiveSpec(__patch);
  const victim = spoiled.resources.find(r => r.resid === 0x8E04);
  victim.data = victim.data.slice(); victim.data[0] ^= 0xFF; victim.data[1] ^= 0xFF;
  const spoiledBytes = writeDelverArchive(spoiled);
  const m2 = mergeDelverPatch(__base, spoiledBytes);
  const readBack = delverArchiveSpec(m2.bytes).resources.find(r => r.resid === 0x8E04).data;
  return {moved: hash(m2.bytes) !== before, carries: readBack[0] === victim.data[0] && readBack[1] === victim.data[1]};
})()`);
if (!neg.moved) fail('negative control', 'changing the patch did not change the merged archive');
else if (!neg.carries) fail('negative control', 'the changed bytes did not reach the merged archive');
else ok('the check can fail', 'a two-byte change to the patch moves the merged archive and reads back');

// ---- refusals --------------------------------------------------------------
const refusals = ev(`(() => {
  const out = [];
  const tryIt = (label, fn) => { try { fn(); out.push([label, null]); } catch (e) { out.push([label, e.message]); } };
  tryIt('a saved game', () => {
    const s = delverArchiveSpec(__patch); s.playerName = 'I.M.Cheater';
    mergeDelverPatch(__base, writeDelverArchive(s));
  });
  tryIt('another scenario', () => {
    const s = delverArchiveSpec(__patch); s.scenarioTitle = 'Some Other Delver Game';
    mergeDelverPatch(__base, writeDelverArchive(s));
  });
  tryIt('not an archive', () => mergeDelverPatch(__base, new Uint8Array(4096)));
  return out;
})()`);
for (const [label, msg] of refusals) {
  if (!msg) fail('refuses ' + label, 'it was accepted');
  else ok('refuses ' + label, msg.length > 72 ? msg.slice(0, 69) + '…' : msg);
}

/* ---- the descriptor, and what the page says about a patch it has not applied
   Added 15 September 2026 with the Hackery section. The merge above proves
   what a patch DOES; this proves what it SAYS, which is the half a reader
   sees first and the half that was read out of Magpie's PowerPC code rather
   than out of a sample. Each figure below was written down from the
   disassembly before this file was ever opened, so the assertions are a
   second, independent source agreeing with the first -- except the
   description's offset, where they disagree and the file wins.

   The 55 changed tiles are the figure worth pinning hardest: nothing in this
   project derived it from the pixels until now. It was counted by hand off
   the patch's own advertising and has stood in the notes since; decoding both
   sides and comparing them tile by tile reaches the same number. */
const desc = ev(`(() => {
  const B = delverArchiveSpec(__base), P = delverArchiveSpec(__patch);
  const rep = describeDelverPatch(B, P), d = rep.descriptor;
  let tiles = 0, sheets = 0;
  for (const r of rep.resources) {
    if (!r.inBase || r.identical || r.subn !== 141) continue;
    const a = decodeResource(r.baseData, 141, r.resid), b = decodeResource(r.patchData, 141, r.resid);
    if (a.W !== b.W || a.H !== b.H) continue;
    let n = 0;
    for (let t = 0; t < a.H / 32; t++) {
      let diff = false;
      for (let y = t*32; y < (t+1)*32 && !diff; y++)
        for (let x = 0; x < a.W; x++) if (a.image[y*a.W+x] !== b.image[y*b.W+x]) { diff = true; break; }
      if (diff) n++;
    }
    sheets++; tiles += n;
  }
  return {uuid: d && d.uuidText, len: d && d.statedLength, lenOk: d && d.lengthAgrees,
          type: d && d.typeCode, named: !!(d && d.typeName), selfOk: d && d.selfOffsetAgrees,
          text: d && d.description, check: d && d.checkValue,
          checkValid: d && d.checkValueValid,
          format: rep.format, baseFormat: rep.baseFormat, usable: rep.usable, reasons: rep.reasons,
          installedInBase: rep.installedIds.length, isInstalled: rep.isInstalled,
          willReplace: rep.willReplace, notInBase: rep.notInBase.length,
          disagreed: rep.disagreed.length, unchanged: rep.unchanged.length,
          sheets, tiles,
          baseDescriptor: !!delverPatchDescriptor(B)};
})()`);
const want = (what, got, expect) => {
  if (String(got) !== String(expect)) fail(what, `expected ${JSON.stringify(expect)}, got ${JSON.stringify(got)}`);
  else ok(what, String(got));
};
want('the descriptor UUID', desc.uuid, '00b21e58-a47f-11d4-8a4a-000502c9f8b7');
want('the descriptor check value', desc.check, 'c49ba9810778a4b9');
// Recovered out of Magpie's PowerPC code on 15 September 2026. The page
// computes the same digest now, so the real patch's own value has to verify:
// this is the assertion that says the routine was read correctly, and it is
// held to the only sample that exists.
want('and the real patch\'s check value verifies', desc.checkValid, true);
want('the descriptor states its own length', desc.len, 568);
want('the length is the one Magpie takes', desc.lenOk, true);
want('the descriptor names the offset it sits at', desc.selfOk, true);
want('the type and trust code', desc.type, 3);
// 3 is the Pumpkin Patch's code and the binary names only 0 (Bug Fix), so a
// reader that starts naming 3 has started guessing. This is what says so.
want('code 3 is not given a name', desc.named, false);
want('the description', desc.text,
     'Harvest time, and the leaves change - something strange is happening in Cythera...');
want('the patch\'s format', desc.format, '2.0');
want('the game\'s format', desc.baseFormat, '2.0');
want('Magpie\'s three tests pass', desc.usable, true);
if (desc.reasons.length) fail('no reason to refuse it', desc.reasons.join('; '));
// The shipped archive carries neither resource, which is what makes "this
// file lists no patches" the honest thing for the page to say about it.
want('the shipped archive lists no applied patches', desc.installedInBase, 0);
want('the shipped archive has no descriptor of its own', desc.baseDescriptor, false);
want('so this patch does not read as installed', desc.isInstalled, false);
want('resources it would replace', desc.willReplace, 12);
want('resources it names that are not in the game', desc.notInBase, 0);
want('resources refused on an encryption disagreement', desc.disagreed, 0);
want('resources already identical', desc.unchanged, 0);
want('tile sheets it redraws', desc.sheets, 12);
want('tiles it redraws', desc.tiles, 55);

/* THE NEGATIVE CONTROL FOR THE READING, separate from the merge's. Each of
   these changes one field of the descriptor and requires the reader to notice.
   Without them every assertion above would still pass against a reader that
   returned constants. */
const dneg = ev(`(() => {
  const B = delverArchiveSpec(__base);
  const bend = (fn) => {
    const P = delverArchiveSpec(__patch);
    const d = P.resources.find(r => r.resid === 0xFFFF);
    d.data = d.data.slice(); fn(d.data, P);
    return describeDelverPatch(B, P);
  };
  return {
    uuidMoves:   bend(d => { d[8] ^= 0xFF; }).descriptor.uuidText !== '00b21e58-a47f-11d4-8a4a-000502c9f8b7',
    lengthSeen:  bend(d => { d[24] = 0x02; d[25] = 0x39; }).usable === false,
    offsetSeen:  bend(d => { d[31] ^= 0xFF; }).usable === false,
    textMoves:   bend(d => { d[0x139] = 0x5A; }).descriptor.description[0] === 'Z',
    majorSeen:   (() => { const P = delverArchiveSpec(__patch); P.formatMajor = 3;
                          return describeDelverPatch(B, P).usable === false; })(),
    minorSeen:   (() => { const P = delverArchiveSpec(__patch); P.formatMinor = 1;
                          return describeDelverPatch(B, P).usable === false; })(),
    minorOkDown: (() => { const P = delverArchiveSpec(__patch); const C = delverArchiveSpec(__base);
                          C.formatMinor = 4;
                          return describeDelverPatch(C, P).usable === true; })(),
    installedSeen: (() => {
      const C = delverArchiveSpec(__base), P = delverArchiveSpec(__patch);
      const d = P.resources.find(r => r.resid === 0xFFFF);
      C.resources.push({resid: 0xFFFE, data: d.data.slice(8, 24), encrypted: false});
      const r = describeDelverPatch(C, P);
      return r.isInstalled === true && r.installedIds.length === 1;
    })()
  };
})()`);
for (const [what, got] of Object.entries(dneg)) {
  if (!got) fail('the reading can fail: ' + what, 'a bent descriptor was read as if it were sound');
}
if (Object.values(dneg).every(Boolean))
  ok('the reading can fail', Object.keys(dneg).length + ' bent descriptors, each noticed');

/* ---- the other direction: a diff, and a patch written out of it -----------
   Everything above reads a patch somebody else made. This writes one, and the
   property that matters is that the two directions compose: take an archive,
   change some resources, diff it against the original, write a patch out of
   the difference, apply that patch to the ORIGINAL, and every resource must
   come back exactly as the edited archive had it. That is the whole contract,
   and it fails if the diff misses a resource, if the writer drops one, if the
   descriptor lands somewhere the self-offset does not name, or if the merge
   refuses one for an encryption disagreement.

   The negative controls are at the end and there are four, because a round
   trip is unusually easy to pass by accident: a diff that reported everything
   would still round-trip, and so would a patch that carried the whole
   archive. */
const rt = ev(`(() => {
  const base = delverArchiveSpec(__base);
  const edited = delverArchiveSpec(__base);
  // Three resources of three different kinds: a tile sheet, a dialogue and a
  // text array, so the writer is not only ever asked for one shape.
  const ids = [0x8E04, 0x1801, 0x021A];
  for (const id of ids) {
    const r = edited.resources.find(x => x.resid === id);
    r.data = r.data.slice(); r.data[0] ^= 0xFF; r.data[r.data.length - 1] ^= 0x0F;
  }
  const diff = describeDelverDiff(base, edited);
  const w = writeDelverPatch(edited, diff.changed.map(c => c.resid),
                             {description: 'Three resources, for the round trip.', typeCode: 0});
  const rep = describeDelverPatch(base, delverArchiveSpec(w.bytes));
  const merged = mergeDelverPatch(__base, w.bytes);
  const back = delverArchiveSpec(merged.bytes);
  const same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
  const wrong = [];
  for (const r of edited.resources) {
    const g = back.resources.find(x => x.resid === r.resid);
    if (!g || !same(g.data, r.data)) wrong.push('0x' + r.resid.toString(16));
  }
  // The second write must not move anything: the descriptor is a fixed 568
  // bytes, so correcting its self-offset cannot change any layout.
  const twice = writeDelverPatch(edited, diff.changed.map(c => c.resid),
                                 {description: 'Three resources, for the round trip.', typeCode: 0, uuid: w.uuid});
  return {
    changed: diff.changed.length, added: diff.added.length, removed: diff.removed.length,
    unchanged: diff.unchanged, aCount: diff.aCount,
    identicalFlag: describeDelverDiff(base, base).identical,
    patchLen: w.bytes.length, descOffset: w.descriptorOffset,
    checkValueWritten: w.checkValueWritten, checkValueValid: w.checkValueValid,
    descBack: rep.descriptor && rep.descriptor.description,
    typeBack: rep.descriptor && rep.descriptor.typeName,
    selfOk: rep.descriptor && rep.descriptor.selfOffsetAgrees,
    lenOk: rep.descriptor && rep.descriptor.lengthAgrees,
    usable: rep.usable, willReplace: rep.willReplace,
    applied: merged.replaced.length, skipped: merged.skipped,
    everyResourceBack: !wrong.length, wrong,
    deterministic: twice.bytes.length === w.bytes.length
  };
})()`);
want('the diff finds exactly what changed', rt.changed, 3);
want('and calls nothing else changed', rt.unchanged, rt.aCount - 3);
want('nothing added', rt.added, 0);
want('nothing removed', rt.removed, 0);
want('an archive against itself is identical', rt.identicalFlag, true);
want('the written patch carries the description', rt.descBack, 'Three resources, for the round trip.');
want('type 0 reads back as Bug Fix', rt.typeBack, 'Bug Fix');
want('the descriptor names the offset it landed at', rt.selfOk, true);
want('the descriptor is the length Magpie takes', rt.lenOk, true);
want('the written patch is usable against the archive', rt.usable, true);
want('it would replace three resources', rt.willReplace, 3);
want('it applies three', rt.applied, 3);
// The check value is the one field this project cannot produce, and writing
// zeroes rather than a guess is a decision. This is what keeps it a decision.
want('a written patch carries a check value', rt.checkValueWritten, true);
want('and its own check value verifies', rt.checkValueValid, true);
want('every resource comes back as the edited archive had it', rt.everyResourceBack, true);
want('writing it twice gives the same size', rt.deterministic, true);
if (rt.skipped.length !== 1 || rt.skipped[0] !== 0xFFFF)
  fail('the merge skips only the descriptor', 'skipped ' + rt.skipped.map(i => '0x' + i.toString(16)).join(' '));
else ok('the merge skips only the descriptor', '0xffff');

const rtneg = ev(`(() => {
  const base = delverArchiveSpec(__base);
  const edited = delverArchiveSpec(__base);
  const r = edited.resources.find(x => x.resid === 0x8E04);
  r.data = r.data.slice(); r.data[0] ^= 0xFF;
  const out = {};
  // A diff that reported everything would still round-trip, so the count is
  // held to one rather than to "more than none".
  out.onlyOne = describeDelverDiff(base, edited).changed.length === 1;
  // A patch must carry only what it was asked for, not the whole archive.
  const w = writeDelverPatch(edited, [0x8E04], {});
  const carried = delverArchiveSpec(w.bytes).resources.filter(x => x.resid !== 0xFFFF);
  out.carriesOnlyWhatItWasAsked = carried.length === 1 && carried[0].resid === 0x8E04;
  // And what it carries must be the EDITED bytes, not the originals.
  const orig = base.resources.find(x => x.resid === 0x8E04).data;
  out.carriesTheNewBytes = carried[0].data[0] === (orig[0] ^ 0xFF);
  // Refusing the empty case rather than writing a patch that does nothing.
  try { writeDelverPatch(edited, [], {}); out.refusesNothing = false; }
  catch (e) { out.refusesNothing = true; }
  // Refusing an id the archive does not have, rather than writing a hole.
  try { writeDelverPatch(edited, [0x0999], {}); out.refusesUnknown = false; }
  catch (e) { out.refusesUnknown = true; }
  return out;
})()`);
for (const [what, got] of Object.entries(rtneg))
  if (!got) fail('the writer can fail: ' + what, 'it did not');
if (Object.values(rtneg).every(Boolean))
  ok('the writer can fail', Object.keys(rtneg).length + ' ways it must refuse or narrow, each held');

/* ---- the check value discriminates, and the two steps that were missing ----
   A digest recovered from a disassembly is exactly the kind of thing that can
   be right for one sample and wrong in general, so this pins the two steps
   that had defeated the earlier attempt by REMOVING each one and requiring
   the answer to stop matching. Without these, a future tidy-up that dropped
   the length fold or the final complement would still pass every assertion
   above, because the one real patch would be the only thing tested and the
   code that produced its value would be the code under test.

   The length fold and the complement are asserted by reimplementing the
   digest here, deliberately, rather than by calling the page's own function
   with a flag: a check that shares the code it is checking proves nothing. */
const cv = ev(`(() => {
  const P = delverArchiveSpec(__patch);
  const d = P.resources.find(r => r.resid === 0xFFFF).data;
  const xor = (a, b) => ({hi: (a.hi ^ b.hi) >>> 0, lo: (a.lo ^ b.lo) >>> 0});
  const shl1 = c => ({hi: ((c.hi << 1) | (c.lo >>> 31)) >>> 0, lo: (c.lo << 1) >>> 0});
  const shl8 = c => ({hi: ((c.hi << 8) | (c.lo >>> 24)) >>> 0, lo: (c.lo << 8) >>> 0});
  const top = c => ((((c.lo >>> 24) | (c.hi << 8)) >>> 0) & 0xFF);
  const POLY = {hi: 0x04C11D37, lo: 0x04C11DB7};
  const basis = [POLY];
  for (let i = 1; i < 8; i++) { const p = basis[i-1], sh = shl1(p);
    basis.push((p.hi & 0x80000000) ? xor(sh, POLY) : sh); }
  const table = [];
  for (let b = 0; b < 256; b++) { let v = {hi:0, lo:0};
    for (let k = 0; k < 8; k++) if (b & (1 << k)) v = xor(v, basis[k]); table.push(v); }
  // opts: foldLength, complement -- each can be turned off to prove it matters
  const crc = (buf, len, opts) => {
    let c = {hi: 0, lo: 0};
    for (let i = 0; i < buf.length; i++) c = xor(shl8(c), table[(top(c) ^ buf[i]) & 0xFF]);
    if (opts.foldLength) for (let n = len; n > 0; n >>= 8) c = xor(shl8(c), table[(top(c) ^ n) & 0xFF]);
    return opts.complement ? {hi: (~c.hi) >>> 0, lo: (~c.lo) >>> 0} : c;
  };
  const hex = c => c.hi.toString(16).padStart(8,'0') + c.lo.toString(16).padStart(8,'0');
  const body = d.subarray(8, 568);
  const bent = d.slice(); bent[300] ^= 0x01;
  return {
    full:        hex(crc(body, 560, {foldLength: true,  complement: true})),
    noLength:    hex(crc(body, 560, {foldLength: false, complement: true})),
    noComplement:hex(crc(body, 560, {foldLength: true,  complement: false})),
    oneByteBent: hex(crc(bent.subarray(8, 568), 560, {foldLength: true, complement: true})),
    // And the page's own answer, which must be the same as the full one here.
    pageSays: Array.from(delverPatchCheckValue(d)).map(b => b.toString(16).padStart(2,'0')).join('')
  };
})()`);
const WANT = 'c49ba9810778a4b9';
want('an independent implementation reaches the same value', cv.full, WANT);
want('and the page agrees with it', cv.pageSays, WANT);
if (cv.noLength === WANT) fail('the length fold matters', 'dropping it changed nothing, so it is not being done');
else ok('dropping the length fold breaks it', cv.noLength.slice(0, 16));
if (cv.noComplement === WANT) fail('the final complement matters', 'dropping it changed nothing');
else ok('dropping the final complement breaks it', cv.noComplement.slice(0, 16));
if (cv.oneByteBent === WANT) fail('the digest discriminates', 'one flipped byte of the descriptor gave the same value');
else ok('one flipped byte of the descriptor changes it', cv.oneByteBent.slice(0, 16));

console.log(failures ? `\n${failures} failure(s)`
  : `\n  patch: 12 of 1,558 resources replaced, ${r.len.toLocaleString()} bytes out; ` +
    `${desc.tiles} tiles of ${desc.sheets * 16} redrawn across ${desc.sheets} sheets; ` +
    `a written patch round-trips ${rt.applied} of ${rt.changed}; check value recovered and verified`);
process.exit(failures ? 1 : 0);
