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
// The patch arrives as .hqx wrapping a .sit whose forks are compressed with
// StuffIt method 13, which js/mac-stuffit.js reads but does not decompress.
// `unar` does that extraction; without it this check skips.

import {readFileSync, writeFileSync, existsSync, mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', dataPath,
       addonDir = 'reference/community/addons',
       unpackDir = join(process.env.TMPDIR || '/tmp', 'cythera_patch_check')] = process.argv.slice(2);

let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);
const skip = why => { console.log(`  skip  ${why}`); process.exit(0); };

if (!dataPath || !existsSync(dataPath)) skip('no Cythera Data to patch');
const hqx = join(addonDir, '614_MagpiePumpkinPatch.sit.hqx');
if (!existsSync(hqx)) skip('the Magpie Pumpkin Patch is not in the add-ons');
try { execFileSync('which', ['unar'], {stdio: 'ignore'}); }
catch { skip('unar is not installed, so the patch cannot be extracted'); }

const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);

// ---- the page's own BinHex decoder gets the .sit out of the .hqx -----------
mkdirSync(unpackDir, {recursive: true});
sandbox.__hqx = new Uint8Array(readFileSync(hqx));
const sitBytes = Uint8Array.from(ev('Array.from(binhexSplitForks(binhexDecode(__hqx)).data)'));
const sitPath = join(unpackDir, 'pumpkin.sit');
writeFileSync(sitPath, sitBytes);

// The page can list the archive but not decompress method 13; the listing is
// still worth asserting, because it is what tells a user which file to extract.
sandbox.__sit = sitBytes;
const listed = ev('parseStuffItArchive(__sit).entries.map(e => e.path)');
if (!listed.includes('Patches/Pumpkin Patch'))
  fail('StuffIt listing', 'no "Patches/Pumpkin Patch" in ' + JSON.stringify(listed));
else ok('the .sit lists the patch', listed.length + ' entries');

execFileSync('unar', ['-q', '-f', '-o', unpackDir, sitPath], {stdio: 'ignore'});
const patchPath = join(unpackDir, 'pumpkin', 'Patches', 'Pumpkin Patch');
if (!existsSync(patchPath)) skip('unar did not produce Patches/Pumpkin Patch');

sandbox.__base = new Uint8Array(readFileSync(dataPath));
sandbox.__patch = new Uint8Array(readFileSync(patchPath));

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

console.log(failures ? `\n${failures} failure(s)`
  : `\n  patch: 12 of 1,558 resources replaced, ${r.len.toLocaleString()} bytes out; ` +
    `${desc.tiles} tiles of ${desc.sheets * 16} redrawn across ${desc.sheets} sheets`);
process.exit(failures ? 1 : 0);
