#!/usr/bin/env node
/* A builder, not a check: the six fixes of Bryce Schroeder's unofficial
   bugfix patch, rebuilt with the page's own code writer, as one Magpie patch.
   (24 September 2026, at the maintainer's word.)

   Usage: node utilities/bugfix_patch.mjs index.html "<Cythera Data.data>" <out dir>

   Writes "Cythera Bugfix Patch" (the bare patch) and "Cythera Bugfix
   Patch.bin" (the same in a MacBinary typed DelP/Delp, as the page's export
   makes it), plus the patched "Cythera Data.data" beside them for the fork.
   What it writes is the game's data changed and belongs in no repository,
   the same as ramp_patch.mjs's.

   Each edit is written in the raw listing's own words and put in through the
   same two functions the script page's "Change code" uses (dvmAssemble,
   dvmRelink in js/delv-asm.js), then the patch through writeDelverPatch with
   type 3, as the comparison section's export does. Every edit first checks
   the instructions it expects at its offsets, so a different archive is
   refused rather than patched blind. The causes are in the workbench's
   doc/bugs.md under *Fixed in Bryce Schroeder's unofficial patch*:

   1. Fetch (0x1A28). Bryce's patched UseOn, from his published source
      (delvmod's wiki, "1A28 Patched", GPL, Bryce Schroeder 2016), put into
      the listing's words: an item already carried "won't come free", one
      not lying loose is "too large and heavy", one with no Weight cannot be
      retrieved, one too heavy for the caster falls at their feet, and
      anything else is carried -- flags 0x10, an inventory square, PutInside
      -- where the shipped spell set flags 9 and lost it.
   2. Fishing (0x1091). His source's one change: the map word the pole reads
      carries the automap's seen bit, which it masks off (word 0x7FFF,
      bitwise_and) before testing for deep water.
   3. Aethon's lock picking (0x0C4E, 0x0C4F, 0x0C50). Not his fix -- his
      source was never published and he called PickLock directly -- but the
      cause read since: the task scripts cast their item argument into a
      local and then send the method to the argument, a bare number, which
      the interpreter ignores. Each sends it to the local.
   4. Aethon's "Ask About" (0x1861). His GetMessage answers skills only; the
      block Hector's has for a thing asked about is put in front of it,
      without Hector's weapon remarks: open the talk, both portraits, the
      AskAbout helper (0xEB6), and "Looks like ..." when it has nothing.
   5. Darius and Sardis's chair (0xF00B). Sardis's two posts at the Green
      Goat's table, (22,16), are moved to the chair on the table's other
      side, (23,15), which no schedule uses.
   6. Paris's and Diomede's names (0x1857, 0x182E). Their "name" topics set
      their own character flag 7, as every other character's does, so the
      scripts that test it use their names. */

import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: bugfix_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
sandbox.__a = new Uint8Array(readFileSync(dataPath));

// Each edit: the resource, where, how far to take out, what the listing must
// say at those places first, and the new instructions.
const EDITS = [
  { what: 'Fetch', resid: 0x1A28, at: 0x00B2, to: 0x00F3,
    expect: { 0x00B2: 'if_not', 0x00C7: 'byte 0x09', 0x00F3: 'return' },
    code: `
      if
      arg Arg01
      get_field flags (0x0)
      byte 0x10
      eq
      arg Arg01
      get_field flags (0x0)
      byte 0x08
      bitwise_and
      or
      then -> AlreadyInInventory
      if_not
      arg Arg01
      get_field flags (0x0)
      byte 0x00
      eq
      arg Arg01
      get_field flags (0x0)
      byte 0x01
      eq
      or
      then -> TooLargeAndHeavy
      if_not
      arg Arg01
      has_member Weight (0x24)
      then -> TooSticky
      if_not
      sys GetWeight
      arg Arg01
      get_field aspect_and_proptype (0x5)
      arg Arg01
      get_field quantity (0x9)
      end
      sys WeightCapacity
      global CurrentCharacter (0x9)
      end
      le
      then -> InventoryFull
      set_field flags (0x0)
      arg Arg01
      end
      byte 0x10
      end
      set_field x (0x1)
      arg Arg01
      end
      byte 0x00
      end
      set_field y (0x2)
      arg Arg01
      end
      byte 0x01
      end
      set_field container (0xB)
      arg Arg01
      end
      global CurrentCharacter (0x9)
      end
      method PutInside (0x10)
      arg Arg01
      end
      sys RefreshView
      byte 0x01
      end
      branch Success
      InventoryFull:
      string(implicit) "The item falls to your feet.\\n"
      set_field x (0x1)
      arg Arg01
      end
      global CurrentCharacter (0x9)
      get_field x (0x1)
      end
      set_field y (0x2)
      arg Arg01
      end
      global CurrentCharacter (0x9)
      get_field y (0x2)
      end
      branch Success
      TooLargeAndHeavy:
      string(implicit) "It is too large and heavy.\\n"
      branch 0x00F3
      TooSticky:
      string(implicit) "It doesn't seem possible to retrieve that.\\n"
      branch 0x00F3
      AlreadyInInventory:
      string(implicit) "It won't come free.\\n"
      branch 0x00F3
      Success:
      sys RefreshView
      byte 0x01
      end` },
  { what: 'fishing', resid: 0x1091, at: 0x00C7, expect: { 0x00C3: 'sys GetMapTile', 0x00C7: 'end' },
    code: `word 0x7FFF\nbitwise_and` },
  ...[[0x0C4E, 'Use'], [0x0C4F, 'UseOn'], [0x0C50, 'UseAt']].map(([resid, m]) => ({
    what: 'lock picking ' + m, resid, at: 0x000B, to: 0x000C,
    expect: { 0x0003: 'set_local 0x00', 0x0009: 'method', 0x000B: 'arg Arg01' },
    code: `local Var00` })),
  { what: 'Aethon asked about a thing', resid: 0x1861, at: 0x0078,
    expect: { 0x0078: 'if_not', 0x007A: 'is_type Skill' },
    code: `
      if_not
      arg Arg01
      is_type Prop (0x0)
      then -> NotAThing
      sys OpenConversation
      end
      sys TalkParticipant
      short 0x0001
      byte 0x02
      end
      sys TalkParticipant
      arg Arg00
      byte 0x00
      end
      if_not
      call_resource AskAbout (0xEB6)
      arg Arg00
      arg Arg01
      end
      not
      then -> Done
      string(implicit) "\\"Looks like "
      print
      arg Arg01
      end
      string(implicit) ".\\""
      Done:
      sys FinishConversation
      end
      return
      byte 0x00
      end
      NotAThing:` },
  { what: 'Paris keeps his name', resid: 0x1857, at: 0x013D,
    expect: { 0x0114: 'conversation_response "name"', 0x013D: 'branch' },
    code: `call_resource SetCharacterFlag (0xF00)\narg Arg00\nbyte 0x07\nend` },
  { what: 'Diomede keeps her name', resid: 0x182E, at: 0x0161,
    expect: { 0x013D: 'conversation_response "name"', 0x0161: 'branch' },
    code: `call_resource SetCharacterFlag (0xF00)\narg Arg00\nbyte 0x07\nend` },
];

const out = vm.runInContext(`(() => {
  const EDITS = ${JSON.stringify(EDITS)};
  const arc = openDelverArchive(__a);
  dvmSetResourceSymbols(loadResourceSymbolsFrom(arc));
  const spec = delverArchiveSpec(__a);
  const plain = new Map();
  const text = (b, resid, at) => {
    const fn = dvmExtents(b, resid).find(([st, en, k]) => k === 'function' && at >= st && at < en);
    if (!fn) return null;
    dvmContextResid = resid;
    const op = dvmDisassemble(b.subarray(fn[0], fn[1]), 3).ops.find(o => fn[0] + o[0] === at);
    return op ? op[2] + (op[3] ? ' ' + op[3] : '') : null;
  };
  const log = [];
  for (const e of EDITS) {
    const b = plain.get(e.resid) || smartDecrypt(getResourceBytes(arc, e.resid), e.resid).data;
    for (const [at, want] of Object.entries(e.expect)) {
      const got = text(b, e.resid, +at);
      if (!got || !got.startsWith(want)) throw new Error(e.what + ': at 0x' + (+at).toString(16) + ' the listing says ' + got + ', not ' + want);
    }
    const asm = dvmAssemble(e.code, e.resid);
    const rl = dvmRelink(b, e.resid, e.at, e.to === undefined ? 0 : e.to - e.at, asm);
    plain.set(e.resid, rl.bytes);
    log.push(e.what + ': 0x' + e.resid.toString(16).toUpperCase() + ', ' + (rl.delta >= 0 ? '+' : '') + rl.delta + ' bytes, ' + rl.moved + ' offsets moved');
  }
  // The chair: two schedule posts, bytes 5 to 7 of each (x << 12 | y).
  {
    const b = smartDecrypt(getResourceBytes(arc, 0xF00B), 0xF00B).data.slice();
    const S = (() => { const t = []; let p = 512; for (let i = 0; i < 256; i++) { const len = u16be(b, i * 2); const segs = []; for (let k = 0; k < len; k++, p += 8) segs.push(p); t.push(segs); } return t; })();
    let moved = 0;
    for (const p of S[31]) {
      const xy = (b[p + 5] << 16) | (b[p + 6] << 8) | b[p + 7];
      if (b[p + 4] === 6 && (xy >> 12) === 22 && (xy & 0xFFF) === 16) { const v = (23 << 12) | 15; b[p + 5] = (v >> 16) & 0xFF; b[p + 6] = (v >> 8) & 0xFF; b[p + 7] = v & 0xFF; moved++; }
    }
    if (moved !== 2) throw new Error('the chair: expected two of Sardis\\u2019s posts at (22,16), found ' + moved);
    plain.set(0xF00B, b);
    log.push('the chair: 0xF00B, Sardis\\u2019s two posts at (22,16) moved to (23,15)');
  }
  for (const [resid, data] of plain) { const r = spec.resources.find(x => x.resid === resid); r.data = data; }
  const patched = writeDelverArchive(spec);
  const w = writeDelverPatch(spec, [...plain.keys()], { description: 'Bryce Schroeder\\u2019s unofficial bugfixes, rebuilt with Grimoire: Fetch, fishing, Aethon\\u2019s lock picking and Ask About, Darius and Sardis\\u2019s chair, Paris and Diomede\\u2019s names.', typeCode: DELV_PATCH_EXPORT_TYPE });
  const bin = writeMacBinary({ name: 'Cythera Bugfix Patch', type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
  // The patch merged back onto the shipped file must be the patched file.
  const merged = mergeDelverPatch(__a, w.bytes);
  const same = merged && merged.bytes && merged.bytes.length === patched.length && merged.bytes.every((x, i) => x === patched[i]);
  return { log, patch: Array.from(w.bytes), bin: Array.from(bin), patched: Array.from(patched), resids: w.resids, same: !!same, mergeInfo: merged ? Object.keys(merged).join(',') : null };
})()`, ctx);

mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + '/Cythera Bugfix Patch', Buffer.from(out.patch));
writeFileSync(outDir + '/Cythera Bugfix Patch.bin', Buffer.from(out.bin));
writeFileSync(outDir + '/Cythera Data.data', Buffer.from(out.patched));
for (const l of out.log) console.log('  ' + l);
console.log(`  patch: ${out.resids.length} resources, ${out.patch.length} bytes; merged onto the shipped file it ${out.same ? 'gives the patched file byte for byte' : 'does NOT give the patched file (' + out.mergeInfo + ')'}`);
process.exit(out.same ? 0 : 1);
