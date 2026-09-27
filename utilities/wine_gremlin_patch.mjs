#!/usr/bin/env node
/* A builder, not a check, and not a fix: the Wine Contract finished, badly,
   by a gremlin, as one Magpie patch of its own, "Cythera Wine Contract
   Gremlin". (27 September 2026, the maintainer: "some ridiculous and funny
   way to complete the wine contract, maybe with a gremlin directly
   involved".) The shipped task cannot be finished -- Ambrosia called it a
   red herring (the board, topic 87) -- and the fix patches leave it so.

   Usage: node utilities/wine_gremlin_patch.mjs index.html "<Cythera Data.data>" <out dir>

   WHERE IT HAPPENS. Apis (0x182A) asks "Any luck with that wine contract
   yet?" while her flag 5 is set, and a yes got only "it doesn't appear to be
   signed". Now a yes with the contract in the party (WhoHasItem(3206, 5):
   paper, aspect 3, the Data1 her own Create gives it) plays the gremlin's
   scene: the contract is taken (RemoveItem, as Halos takes the letter),
   the party is paid through the game's own money helper (0xD09, which drops
   what cannot be carried), the To Do line is struck (CompleteQuest(17)),
   and her flag 5 is cleared (0xF01, as her meal clears flag 2) so she stops
   asking. Without the contract she says what she always said. The gremlin
   is in the words only: no gremlin object runs, since whether a gremlin's
   Enter reaches a room entry is still unseen in play.

   BUILT ON "CYTHERA ALL FIXES". A Magpie patch carries whole resources, and
   Apis is in that patch three times over (a keyword, three clicks, a
   spelling), so this one is built on its merged file and its copy of Apis
   is that one's plus the scene. Installed after it, or alone, it loses
   nothing; installed before it, the scene is overwritten. The place is
   found by its instructions, so it builds on the shipped file too.

   The words are ours, not the game's, and seven-bit like every script's. */
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildPatch} from './patch_build.mjs';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: wine_gremlin_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }

// Apis's instructions at their offsets in the file given (as further_fixes_patch.mjs reads them).
const ops = (() => {
  const {sandbox} = makeSandbox(); sandbox.Buffer = Buffer;
  const ctx = vm.createContext(sandbox);
  new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
  sandbox.__a = new Uint8Array(readFileSync(dataPath));
  return JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const arc = openDelverArchive(__a); dvmSetResourceSymbols(loadResourceSymbolsFrom(arc));
    const b = smartDecrypt(getResourceBytes(arc, 0x182A), 0x182A).data, out = [];
    for (const [st, en, k] of dvmExtents(b, 0x182A)) { if (k !== 'function') continue; dvmContextResid = 0x182A;
      for (const op of dvmDisassemble(b.subarray(st, en), 3).ops) out.push({ at: st + op[0], text: op[2] + (op[3] ? ' ' + op[3] : '') }); }
    return out;
  })())`, ctx));
})();
const seq = ['string(implicit) "\\"Any luck with that wine contract yet?', 'conversation_prompt "yn"', 'conversation_response "y" ->',
             'string(implicit) "\\"Hm - it doesn\'t appear to be signed', 'conversation_response "n" ->'];
const hits = []; for (let i = 0; i + seq.length <= ops.length; i++) if (seq.every((s, k) => ops[i + k].text.startsWith(s))) hits.push(i);
if (hits.length !== 1) throw new Error('Apis’s contract question is in her script ' + hits.length + ' times, not once');
const i = hits[0], expect = {}; seq.forEach((s, k) => { expect[ops[i + k].at] = s; });
const unsigned = ops[i + 3].text.slice('string(implicit) '.length);

// A line the game prints: quoted text is the speaker's balloon, a * waits for
// a click, and text outside quotes goes to the message line.
const say = s => 'string(implicit) ' + JSON.stringify(s);
const scene = [
  'if_not', 'sys WhoHasItem', 'short 0x0C86', 'byte 0x05', 'end', 'then -> unsigned',
  'sys TalkParticipant', 'short 0x0001', 'byte 0x02', 'end',
  say('"As a matter of fact..."*'),
  'sys TalkParticipant', 'arg Arg00', 'byte 0x00', 'end',
  say('You unfold the contract. Before Apis can take it, something small and green wriggles out of your pack, snatches the paper and plants itself on the table.*'),
  say('It is a gremlin. It wears a thimble for a hat and an apron made from one of your socks. It dips a quill in something purple and fills in every blank with a flourish.*'),
  say('The gremlin squeaks that the vineyard is called Gremlin Reserve, that it holds nine hundred and forty barrels, and that the vintage was pressed this morning, in your left boot.*'),
  say('"Nine hundred and forty barrels?  At ten oboloi a barrel that\'s..."*"...no.  No.  Where would I even put it?"*'),
  say('The gremlin climbs onto her shoulder and whispers in her ear. Apis goes very pale.*'),
  say('"Fine.  FINE.  A hundred oboloi, the contract is settled, and you take that thing with you when you go."*'),
  'sys RemoveItem', 'sys WhoHasItem', 'short 0x0C86', 'byte 0x05', 'end', 'short 0x0C86', 'byte 0x05', 'byte 0x01', 'end',
  say('The gremlin bows, eats the contract, and vanishes down the back of your collar. You decide not to look in your left boot.'),
  'call_resource 0xD09', 'global PlayerCharacter (0x5)', 'byte 0x64', 'end',
  'call_resource GainExp (0xE8B)', 'global PlayerCharacter (0x5)', 'byte 0x1E', 'end',
  'sys CompleteQuest', 'byte 0x11', 'end',
  'call_resource 0xF01', 'arg Arg00', 'byte 0x05', 'end',
  'branch done',
  'unsigned:',
  'string(implicit) ' + unsigned,
  'done:'].join('\n');

const edits = [{ what: 'the gremlin settles the wine contract', resid: 0x182A, at: ops[i + 3].at, to: ops[i + 4].at, expect, code: scene }];
const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Wine Contract Gremlin',
  description: 'The Wine Contract can be finished at last, with the help of a gremlin you did not know you were carrying. Not a fix: a joke, built with Grimoire. Install after Cythera All Fixes.',
  edits });
process.exit(ok ? 0 : 1);
