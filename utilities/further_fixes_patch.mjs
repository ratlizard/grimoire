#!/usr/bin/env node
/* A builder, not a check: the bugs the handoff held back until the
   maintainer said what was meant, as one Magpie patch, "Cythera Further
   Fixes". (27 September 2026, at the maintainer's word, for the patch he
   means to share.) Each cause is in the workbench's doc/bugs.md under the
   entry named for it; what settled the intent is said beside each edit
   below, and where the files themselves settle it that is the reason given.

   Usage: node utilities/further_fixes_patch.mjs index.html "<Cythera Data.data>" <out dir>

   EVERY PLACE IS FOUND, NOT GIVEN. The other code stages name their edits by
   offset in the shipped file, which holds only while they run first or on
   resources nobody else touches. Several of these share a script with an
   earlier stage (Crito, Apis and Parium with the community's keywords,
   Demodocus with the found fixes, Paris with Bryce's six), so this stage
   reads the file it is given, finds each place by the run of instructions
   around it, and hands patch_build.mjs the offsets it finds there. It runs
   the same alone on the shipped file and in combined_patch.mjs's chain, and
   a place that is not there exactly once stops the build.

   Scripts, the intent read from the files:
    1. The Books of Wisdom (0x1851): the task is struck at ten books, not
       five. The eleventh To Do line, the one AddQuest shows at ten, reads
       "All ten of the Sapphire Books of Wisdom have been retrieved".
    2. Timon on the Seldane (0x184A): "we've met them" tests his own
       character flag 1 where it tested quest flag 2, which nothing sets.
       Sabinate sets Timon's flag 1 on meeting him ("It is a living
       Seldane!"), and Timon's own talk with Larisa reads it for "meeting a
       real Seldane".
    3. Timon fretting about Larisa (the room, 0x1C2D): the second branch
       tests his flag 3 and set flag 2, so he fretted on every entry; it
       sets flag 3.
    4. Halos's "stop by my office" (0x183E's helper): `behaviour != 144 and
       behaviour == 138` is redundant as written, and the line fits only
       away from the office; the second test is `!=`.
    5. Thoas's "Please come again" (0x1844): the local it waits on is set
       once his shop has been opened.
    6. Paris and Parium (the family group, 0x0805): "pari" took Parium's
       answer first, so Paris's could not be given; Parium's is keyed
       "pariu".
    7. Thuria's mine task (0x1814): "You've heard first hand" is said only
       once she has given the task, so hearing Amphidamas first no longer
       shuts it out; her report greeting already has a line for that order.
    8. The Comana brothers (Kosha Grotto, 0x1417): the one-time signal that
       kills them and puts Pelagon in Magpie's figure waits for quest value
       3 to be 3, the visit on which Pelagon says "House Comana is no more".
   Lines that run on or flash past (grimoire's answersThatRunOn and
   linesReplacedAtOnce, which find every one):
    9. A return after the mage group's "history" (0x0808) and the House
       Atussa group's "atus" (0x0807), and a branch to the end after each of
       the wishing fountain's four wishes (0x1036), so "Your wish is found
       elsewhere..." no longer follows each.
   10. Antenor (0x1824) and Pheres (0x184E): a "no" that got its own answer
       and then the answer to an earlier question's "no" gets only its own.
   11. The bartenders (0x0812): a hero with no oboloi is refused and no
       longer asked "Do you need instructions?" straight after.
   12. A click after the line the next one replaced before it could be read:
       Ennomus, the bartenders, Ake, Parium, Crito (three), Apis (three),
       Paris, Niobe (two), Borus and Sabinate. A `*` after the closing
       quote, as the game's own lines wait ("Yes, I was a bit puzzled."*).
   Keywords (the words a highlight offers):
   13. Demodocus's "Would you like to @hear it?" leads to his song, keyed
       "song,meti", whose "meti" the question itself takes first; it is
       keyed "song,hear".
   14. Glaucus's "North Shore @Vineyard" and the family group's answer are
       keyed "viny", which "vineyard" can never match; "vine".
   The maintainer's choices:
   15. The Directed Nexus scroll (0x104B): the scroll's Use deleted the spell
       it cast and itself by number after the spell had moved the party to
       Land King Hall, where those numbers name two of the hall's things. It
       notes the zone and the spell first; if the zone or the spell's own
       record is not what it was, it deletes nothing by number and takes one
       scroll of that spell from whoever carries it (RemoveItem, as Selinus
       takes a book). Directed Nexus is the one spell that changes zone.
   16. Detect Traps (0x1A04) and Deactivate Trap (0x1AF2) look inside each
       thing they pass, one level, with the ContainerIterator the bash
       helper (0x0E49) uses to spring a container's trap: all five poison
       traps and both blast traps in the game are inside crates and chests.
       Detect Traps also finds an armed fine wire, as Deactivate Trap and
       Detect Secrets already do.
   17. Magpie's west standing frame (tile 0x72D, sheet 0x8E72): every other
       west frame of his is the north frame transposed, to the pixel, and
       this one is the transposed north sitting frame; it becomes the
       transposed north standing frame, so he no longer drops into his seat
       whenever he stops walking left.

   Left as shipped, at the maintainer's word or by the files: the Wine
   Contract (Ambrosia called it a red herring), Magpie's flag 1 (it guards
   the half disk), the sixth password, thread and cloth, the stairs, the
   last save's gender, and "Beserker", which the text stage fixes. The
   karma for a kill is karma_patch.mjs, a patch of its own. */
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {buildPatch} from './patch_build.mjs';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: further_fixes_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }

const RESIDS = [0x1851, 0x184A, 0x1C2D, 0x183E, 0x1844, 0x0805, 0x1866, 0x186D, 0x1814, 0x1417,
                0x0808, 0x0807, 0x1036, 0x1824, 0x184E, 0x0812, 0x104B, 0x1A04, 0x1AF2, 0x1878];

// Every instruction of every function in each resource, at its offset in
// the resource, read the way patch_build.mjs's own check reads them.
function readListings() {
  const {sandbox} = makeSandbox();
  sandbox.Buffer = Buffer;
  const ctx = vm.createContext(sandbox);
  new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
  sandbox.__a = new Uint8Array(readFileSync(dataPath));
  sandbox.__r = RESIDS;
  return JSON.parse(vm.runInContext(`JSON.stringify((() => {
    const arc = openDelverArchive(__a);
    dvmSetResourceSymbols(loadResourceSymbolsFrom(arc));
    const out = {};
    for (const resid of __r) {
      const b = smartDecrypt(getResourceBytes(arc, resid), resid).data;
      const ops = [], fns = [];
      for (const [st, en, k] of dvmExtents(b, resid)) {
        if (k !== 'function') continue;
        dvmContextResid = resid;
        fns.push({ st, en, locals: b[st + 2] });
        for (const op of dvmDisassemble(b.subarray(st, en), 3).ops) ops.push({ at: st + op[0], text: op[2] + (op[3] ? ' ' + op[3] : '') });
      }
      out[resid] = { ops, fns };
    }
    return out;
  })())`, ctx));
}
const L = readListings();
const hex = v => '0x' + v.toString(16).toUpperCase();

// The one run of instructions in `resid` whose texts begin as `seq` does.
// Returns the offsets of each and an `expect` for patch_build to check again.
function place(what, resid, seq) {
  const ops = L[resid].ops, hits = [];
  for (let i = 0; i + seq.length <= ops.length; i++) if (seq.every((s, k) => ops[i + k].text.startsWith(s))) hits.push(i);
  if (hits.length !== 1) throw new Error(what + ': the instructions looked for are in ' + hex(resid) + ' ' + hits.length + ' times, not once');
  const i = hits[0], expect = {};
  seq.forEach((s, k) => { expect[ops[i + k].at] = s; });
  return { at: k => ops[i + k].at, text: k => ops[i + k].text, expect };
}
const target = t => parseInt(/-> (0x[0-9A-F]+)$/i.exec(t)[1], 16);
const edits = [];
const replaceOp = (what, resid, seq, k, code) => { const p = place(what, resid, seq); edits.push({ what, resid, at: p.at(k), replaceOp: true, expect: p.expect, code }); };
const insert = (what, resid, seq, k, code, shiftAt) => { const p = place(what, resid, seq); edits.push({ what, resid, at: p.at(k), expect: p.expect, code, ...(shiftAt ? { shiftAt: true } : {}) }); };
const rekey = (what, resid, from, to, after) => {
  const p = place(what, resid, ['conversation_response "' + from + '" ->'].concat(after || []));
  edits.push({ what, resid, at: p.at(0), replaceOp: true, expect: p.expect, code: p.text(0).replace('"' + from + '"', '"' + to + '"') });
};

// 1 to 8
replaceOp('the Books of Wisdom struck at ten', 0x1851,
  ['if_not', 'sys GetState', 'byte 0x05', 'end', 'byte 0x05', 'eq', 'then ->', 'sys CompleteQuest', 'byte 0x12'], 4, 'byte 0x0A');
{ const what = 'Timon has met the Seldane', p = place(what, 0x184A,
    ['if_not', 'sys GetStateFlag', 'byte 0x02', 'end', 'then ->', 'string(implicit) "\\"Of course you all know that']);
  edits.push({ what, resid: 0x184A, at: p.at(1), to: p.at(4), expect: p.expect, code: 'call_resource 0xF02\narg Arg00\nbyte 0x01\nend' }); }
replaceOp('Timon frets once', 0x1C2D, ['call_resource SetCharacterFlag', 'short 0x004A', 'byte 0x02', 'end', 'return'], 2, 'byte 0x03');
replaceOp('Halos away from his office', 0x183E,
  ['arg Arg00', 'get_field behavior', 'word 144', 'ne', 'arg Arg00', 'get_field behavior', 'word 138', 'eq', 'and', 'sys GetSkill'], 7, 'ne');
insert('Thoas after his shop', 0x1844, ['conversation_response "buy" ->', 'set_field 0x27'], 1, 'set_local 0x00\nword True\nend');
rekey('Parium keyed apart from Paris', 0x0805, 'pari', 'pariu', ['string(implicit) "\\"My cousin Parium']);
insert('Thuria gives the mine task', 0x1814,
  ['conversation_response "rumo" ->', 'if_not', 'call_resource 0xF02', 'short 0x0017', 'byte 0x01', 'end', 'then ->'], 6,
  'call_resource 0xF02\narg Arg00\nbyte 0x01\nend\nand');
insert('the Comana brothers’ signal', 0x1417,
  ['if_not', 'sys GetStateFlag', 'byte 0x0F', 'end', 'not', 'then ->', 'sys SetStateFlag', 'byte 0x0F'], 5,
  'sys GetState\nbyte 0x03\nend\nbyte 0x03\neq\nand');

// 9 and 10
const RETURN_TRUE = 'return\nword True\nend';
insert('the mage group’s "history"', 0x0808, ['conversation_response "hist" ->', 'string(implicit)', 'conversation_response "anis" ->'], 2, RETURN_TRUE, true);
insert('the House Atussa group’s "atus"', 0x0807, ['conversation_response "atus" ->', 'string(implicit)', 'conversation_response "ake" ->'], 2, RETURN_TRUE, true);
{ // The fountain: four branches to where the catch-all answer ends, put in
  // from the last up, so each earlier one's target has moved by the three
  // bytes of every branch already put in ahead of it.
  const end = place('the fountain’s end', 0x1036, ['conversation_response "*" ->', 'string(implicit) "\\"Your wish is found elsewhere', 'sys FinishConversation']).at(2);
  const wishes = [['coff', 'tequ'], ['3,thre', 'coff'], ['pony', '3,thre']];
  const tequ = place('the fountain’s "tequ"', 0x1036, ['conversation_response "tequ" ->', 'string(implicit)', 'conversation_response "*" ->']);
  edits.push({ what: 'the fountain’s "tequ"', resid: 0x1036, at: tequ.at(2), expect: tequ.expect, code: 'branch ' + hex(end), shiftAt: true });
  wishes.forEach(([w, next], k) => {
    const p = place('the fountain’s "' + w + '"', 0x1036, ['conversation_response "' + w + '" ->', 'string(implicit)', 'conversation_response "' + next + '" ->']);
    edits.push({ what: 'the fountain’s "' + w + '"', resid: 0x1036, at: p.at(2), expect: p.expect, code: 'branch ' + hex(end + 3 * (k + 1)), shiftAt: true });
  });
}
for (const [what, resid, line] of [['Antenor’s "no"', 0x1824, '"\\"I understand - no many'], ['Pheres’s "no"', 0x184E, '"\\"In my studies']]) {
  // The branch goes where the second "no" answer's own test would have gone.
  const second = resid === 0x1824
    ? place(what, resid, ['conversation_response "n" ->', 'string(implicit) ' + line, 'conversation_response "n" ->'])
    : place(what, resid, ['sys AddQuest', 'byte 0x1D', 'word 0x021A[0]', 'byte 0x1D', 'add', 'end', 'conversation_response "n" ->']);
  const k = resid === 0x1824 ? 2 : 6;
  edits.push({ what, resid, at: second.at(k), expect: second.expect, code: 'branch ' + hex(target(second.text(k))), shiftAt: true });
}
{ // 11: the refusal and the offer shared one string, the offer's half
  // reached by a jump into its middle; a return between them.
  const what = 'the bartenders refuse credit', p = place(what, 0x0812,
    ['if_not', 'local Var00', 'byte 0x00', 'eq', 'then ->', 'string(implicit) "\\"I\'m sorry, but we don\'t give credit here']);
  edits.push({ what, resid: 0x0812, at: target(p.text(4)), expect: p.expect, code: 'return\nbyte 0x00\nend', shiftAt: true });
}

// 13 and 14
rekey('Demodocus’s song on "hear"', 0x186D, 'song,meti', 'song,hear');
rekey('Glaucus’s vineyard', 0x1866, 'viny', 'vine');
rekey('the family group’s vineyard', 0x0805, 'viny', 'vine');

// 15: the scroll's Use, from the cast to its return.
{ const what = 'the scroll deletes nothing it has left behind', p = place(what, 0x104B,
    ['set_local 0x01', 'method Use (0x9)', 'local Var00', 'end', 'end', 'sys Delete', 'local Var00', 'end',
     'if_not', 'local Var01', 'word None', 'eq', 'local Var01', 'byte 0x00', 'eq', 'or', 'then ->',
     'sys Delete', 'arg Arg00', 'end', 'return', 'local Var01']);
  edits.push({ what, resid: 0x104B, at: p.at(0), to: p.at(20), expect: p.expect, code: [
    'set_local 0x02', 'global CurrentZone (0x10)', 'end',
    'set_local 0x03', 'arg Arg00', 'get_field data1 (0x6)', 'end',
    'set_local 0x01', 'method Use (0x9)', 'local Var00', 'end', 'end',
    'if_not', 'global CurrentZone (0x10)', 'local Var02', 'eq', 'local Var00', 'get_field obj_type (0x4)', 'local Var03', 'eq', 'and', 'then -> moved',
    'sys Delete', 'local Var00', 'end',
    'if_not', 'local Var01', 'word None', 'eq', 'local Var01', 'byte 0x00', 'eq', 'or', 'then -> done',
    'sys Delete', 'arg Arg00', 'end',
    'branch done',
    'moved:',
    'set_local 0x02', 'sys WhoHasItem', 'short 0x004B', 'local Var03', 'end', 'end',
    'if_not', 'local Var02', 'byte 0x00', 'gt', 'then -> done',
    'sys RemoveItem', 'local Var02', 'short 0x004B', 'local Var03', 'byte 0x01', 'end',
    'done:'].join('\n') }); }

// 16: one level inside each thing, in a pair of locals the function did not
// have (item, then the iterator's own slot), which the header is given below.
const TRAP_TEST = v => ['short 0x0160', 'short 0x0161', 'short 0x0163', 'short 0x00E6']
  .map((t, k) => ['local ' + v, 'get_field obj_type (0x4)', t, 'eq'].concat(k ? ['or'] : [])).flat();
const inside = (v, slot, body) => [
  'set_local ' + slot, 'sys ContainerIterator', 'word &' + v.replace('Var0', 'Var'), 'byte 0x00', 'local ' + ({ Var06: 'Var02', Var08: 'Var01' })[v], 'end', 'end',
  'test_' + v + ':',
  'if', 'sys ContainerIterator', 'word &' + v.replace('Var0', 'Var'), 'byte 0x01', 'end', 'then -> done_' + v,
  'if_not'].concat(TRAP_TEST(v), ['then -> next_' + v], body, [
  'next_' + v + ':',
  'set_local ' + slot, 'sys ContainerIterator', 'word &' + v.replace('Var0', 'Var'), 'byte 0x02', 'end', 'end',
  'branch test_' + v,
  'done_' + v + ':']).join('\n');
insert('Detect Traps finds an armed wire', 0x1A04,
  ['if_not', 'local Var02', 'get_field obj_type (0x4)', 'short 0x00E6', 'eq', 'then ->'], 5,
  'local Var02\nget_field obj_type (0x4)\nshort 0x0165\neq\nlocal Var02\nget_field flags (0x0)\nbyte 0x02\nbitwise_and\nand\nor');
insert('Detect Traps looks inside', 0x1A04,
  ['sys NearbyIterator', 'word &Var2', 'byte 0x01', 'end', 'then ->', 'set_local 0x05'], 5,
  inside('Var06', '0x06', ['sys MagicAuraEffect', 'local Var02', 'word 244', 'end',
    'if_not', 'global CurrentCharacter (0x9)', 'global PlayerCharacter (0x5)', 'eq', 'then -> next_Var06',
    'string(implicit) "You detect "', 'print', 'local Var06', 'end', 'string(implicit) "!\\n"',
    'set_local 0x01', 'word True', 'end']));
insert('Deactivate Trap looks inside', 0x1AF2,
  ['sys LocationIterator', 'word &Var1', 'byte 0x01', 'end', 'then ->', 'set_local 0x04'], 5,
  inside('Var08', '0x08', ['set_local 0x00', 'word True', 'end',
    'string(implicit) "^"', 'print', 'local Var08', 'end', 'string(implicit) " destroyed.\\n"',
    'sys Delete', 'local Var08', 'end']));

// Edits to one resource go from the highest offset down, so each one's
// offsets are still where they were found. The fountain's are already in
// that order and its targets counted for it.
edits.sort((a, b) => a.resid - b.resid || b.at - a.at);

// A function's locals are the third byte of its header.
const locals = (what, resid, containing, from, to) => {
  const f = L[resid].fns.find(f => containing >= f.st && containing < f.en);
  if (!f || f.locals !== from) throw new Error(what + ': the function has ' + (f && f.locals) + ' locals, not ' + from);
  return { what, resid, fn: (0, eval)(`(b) => { if (b[${f.st + 2}] !== ${from}) throw new Error('the header is not what was read'); b[${f.st + 2}] = ${to}; return 'locals ${from} to ${to}'; }`) };
};
const dataEdits = [
  locals('the scroll’s Use has two more locals', 0x104B, edits.find(e => e.resid === 0x104B).at, 2, 4),
  locals('Detect Traps has two more locals', 0x1A04, edits.find(e => e.resid === 0x1A04).at, 6, 8),
  locals('Deactivate Trap has two more locals', 0x1AF2, edits.find(e => e.resid === 0x1AF2).at, 8, 10),
  { what: 'Magpie’s west standing frame', resid: 0x8E72, fn: (b) => {
      const col = decompressDCG(b, 32, 512);
      const tile = t => col.slice(t * 1024, t * 1024 + 1024);
      const tr = a => { const o = new Uint8Array(1024); for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) o[y * 32 + x] = a[x * 32 + y]; return o; };
      const diff = (a, c) => { let n = 0; for (let i = 0; i < 1024; i++) if (a[i] !== c[i]) n++; return n; };
      if (diff(tr(tile(0)), tile(12)) || diff(tr(tile(3)), tile(15))) throw new Error('Magpie’s west frames are not his north frames transposed');
      if (diff(tr(tile(3)), tile(13)) > 2) throw new Error('Magpie’s west standing frame is not his sitting one');
      col.set(tr(tile(1)), 13 * 1024);
      const out = encodeDCGLiterals(col);
      const back = decompressDCG(out, 32, 512);
      for (let i = 0; i < col.length; i++) if (back[i] !== col[i]) throw new Error('the sheet does not decode back');
      return out;
  } },
];

// 12: a click after each line the next one replaced.
const click = (what, resid, line) => ({ what, resid, find: line, replace: line + '*', count: 1 });
const textEdits = [
  click('Ennomus', 0x1811, 'where da Tyrants used to live."'),
  click('the bartenders', 0x0812, 'let\'s get on with it then."'),
  click('Ake', 0x1820, 'after my husband goes to bed"'),
  click('Parium', 0x1828, 'Now what can I do for you?"'),
  click('Crito, a tab paid', 0x1829, 'Now what can I do for you?"'),
  click('Crito, "Don\'t forget!"', 0x1829, '"Don\'t forget!"'),
  click('Crito on Hebe', 0x1829, 'talk to Hebe about me?"'),
  click('Apis, "Don\'t forget!"', 0x182A, '"Don\'t forget!"'),
  click('Apis on the contract', 0x182A, 'go over it again?"'),
  click('Apis, keep working', 0x182A, 'if you get a chance."'),
  click('Paris', 0x1857, 'during business hours..."'),
  click('Niobe', 0x1859, 'not to talk to strangers."'),
  click('Helen to Niobe', 0x1859, '"It\'s OK, Niobe."'),
  click('Borus', 0x1867, 'if you ask me."'),
  // Said twice in his script, and replaced only in the greeting, where the
  // "In due time" line follows it; the answer's copy waits already.
  (() => { const line = 'the @troubles of Alaric."', p = place('Sabinate', 0x1878, ['call_resource 0xF01', 'short 0x0078', 'byte 0x01', 'end', 'string(implicit)']);
           const said = JSON.parse(p.text(4).slice('string(implicit) '.length));
           return { what: 'Sabinate', resid: 0x1878, at: p.at(4) + said.indexOf(line), find: line, replace: line + '*' }; })(),
];

const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Further Fixes',
  description: 'Fixes for bugs whose intended behaviour the files or the maintainer settled, built with Grimoire: the Books of Wisdom, Timon twice, Halos, Thoas, Paris, Thuria’s mine task, the Comana brothers, lines that run on or flash past, Demodocus’s song, Glaucus’s vineyard, the Directed Nexus scroll, traps in containers and fine wires, and Magpie walking west.',
  edits, dataEdits, textEdits });
process.exit(ok ? 0 : 1);
