#!/usr/bin/env node
/* A builder, not a check, and not a fix: Tlepolemus's old panpipes sold at
   last, as one Magpie patch of its own, "Cythera Pipes of the Deep". (3
   October 2026, the maintainer: two versions for Tlepolemus, the offer cut
   as a fix, and the sale as "some outlandish version like the sour grapes
   scenario".) In the shipped game he offers the set ("are you interested
   in buying an old set?"), a yes gets "Stop by some evening and I'll see if
   I can find them.", and nothing ever sells them: his "I hope you enjoyed
   them - I wasn't getting any use out of them." waits on his character flag
   0, which nothing sets (bugs.md, *Tlepolemus never sells his old
   panpipes*). He also swears the sea monster stories are true ("Why do you
   think I fish from shore?"), which is what this builds on.

   Usage: node utilities/deep_pipes_patch.mjs index.html "<Cythera Data.data>" <out dir>

   WHAT HAPPENS. Ask Tlepolemus about pan pipes and say yes. Before 18:00
   he says what he always said. From 18:00 he has them, for fifteen oboloi,
   with a warning; the set is the panpipes with Data1 2, so they play the
   notes of every set but Philinus's, and his flag 0 is set, so his own
   "I hope you enjoyed them" answers after. Play them (Use) in Odemia, his
   town and his harbour, and four tentacles come up through the ground
   around the party and fight; play them anywhere else and a line says
   something in Odemia's harbour heard. Killing the last tentacle closes it
   with a line. Played again with none left, they come again.

   HOW, ALL OF IT THE ENGINE'S OWN ROUTES, as Sour Grapes:
   - Tlepolemus (0x1837): the yes answer's line is replaced by a test of the
     hour and the purse, the sale (0xD05 takes the money, `Create` the set,
     SetCharacterFlag his flag 0), and the old line when it is not evening.
   - The panpipes (0x1099): Use, after its test for an open window, tests
     Data1 2 first; in zone 2 it hatches the tentacles and returns without
     opening the instrument, elsewhere it prints and plays on.
   - The tentacles are characters 146 to 149, free records in 0xF009 (Sour
     Grapes takes 140 to 145), the tentacle's body (prop type 205, a unit of
     the game's own, hatched from eggs on the world map), feral (byte 25,
     3), zone 2, not alive. Setting a record's square and then status_flags
     with the alive bit hatches a creature there (SetField, field 20, calls
     TActiveMonster::HatchEgg), which is how Sour Grapes raises its grapes.
     Their figures are set lower than the unit's, since a hero who buys
     pipes from a fisherman is seldom ready for a sea monster. A tentacle
     does not walk, so they rise on the party's four diagonals.
   - Each tentacle has a character script (0x1892 to 0x1895): Talk answers
     "Blub.", and OnDeath counts the others still alive and, when none is,
     prints the closing line; then it hands on to the default OnDeath
     (0x301D). Each has a portrait (0x8891 to 0x8894), the tentacle's first
     frame on white, as the grapes have theirs.
   A save carries its own character table, so a game begun before the patch
   has no tentacles; then the pipes play and nothing comes.

   Changed: Tlepolemus 0x1837, the panpipes 0x1099 and the character table
   0xF009, which Sour Grapes also changes (its own six records): built on a
   Cythera Data that has Sour Grapes merged in, this keeps them. The words
   are ours, not the game's, and seven-bit like every script's. */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: deep_pipes_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const NAME = 'Cythera Pipes of the Deep';
const TLEPOLEMUS = 0x1837, PIPES = 0x1099, ODEMIA = 2, TENTACLE = 205, PRICE = 15, EVENING = 18, SET = 2;
// The behaviour a hatched creature is given (byte 22): 8, as Sour Grapes'.
const ATTACK = 8;
const TENTACLES = [146, 147, 148, 149];
// On the four diagonals: a tentacle does not walk (run of 3 October 2026:
// raised two squares off, they swayed where they stood for twenty turns), so
// they rise next to the party, and the four straight squares are left free
// to walk away by.
const AROUND = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

const say = s => { if (!/^[\x20-\x7E\n]+$/.test(s) || /\s\/\//.test(s)) throw new Error('a line the listing cannot carry: ' + s); return 'string(implicit) ' + JSON.stringify(s); };

// Tlepolemus's yes: the hour, then the purse, then the sale.
const sale = [
  'if_not', 'global CurrentHour (0x0)', 'byte ' + EVENING, 'ge', 'then -> notyet',
  'if_not', 'call_resource CountMoneyInParty (0xD04)', 'end', 'byte ' + PRICE, 'ge', 'then -> poor',
  say('"Evening, is it?  Then here they are - found \'em at the bottom of the tackle box."*'),
  say('"Fifteen oboloi.  And a word of advice: don\'t play them near the water."*"Or on land.  Or at all, really."'),
  'call_resource 0xD05', 'byte ' + PRICE, 'end',
  'sys Create', 'short 0x0001', 'short 0x0099','byte ' + SET, 'end',
  'call_resource SetCharacterFlag (0xF00)', 'arg Arg00', 'byte 0x00', 'end',
  'branch out',
  'poor:',
  say('"Fifteen oboloi, friend.  Fish don\'t pay for themselves."'),
  'branch out',
  'notyet:',
  say('"Stop by some evening and I\'ll see if I can find them."'),
  'out:'].join('\n');

// The panpipes' Use, before the instrument opens: the old set only.
const play = [
  'if_not', 'arg Arg00', 'get_field data1 (0x6)', 'byte ' + SET, 'eq', 'then -> instrument',
  'if_not', 'global CurrentZone (0x10)', 'short ' + ODEMIA, 'eq', 'then -> faraway',
  ...TENTACLES.flatMap(g => ['if_not', 'word Character.' + g, 'get_field status_flags (0x14)', 'byte 1', 'bitwise_and', 'then -> free' + g,
    say('You play the old pipes.  The tentacles sway along, delighted.\n'), 'return', 'byte 0', 'end', 'free' + g + ':']),
  say('You play the old pipes.  The tune is lovely.  The harbour goes very still.\n'),
  ...TENTACLES.flatMap((g, k) => {
    const slot = 'word 0x' + g.toString(16).padStart(4, '0') + '@Type.Prop', me = 'word Character.' + g;
    const heroAt = (f, d) => ['global PlayerCharacter (0x5)', 'cast Character (0x40)', 'get_field ' + f, 'byte ' + d, 'add'];
    return [
      'set_field flags (0x0)', slot, 'end', 'byte 4', 'end',
      'set_field aspect_and_proptype (0x5)', slot, 'end', 'short ' + TENTACLE, 'end',
      'set_field x (0x1)', slot, 'end', ...heroAt('x (0x1)', AROUND[k][0]), 'end',
      'set_field y (0x2)', slot, 'end', ...heroAt('y (0x2)', AROUND[k][1]), 'end',
      'set_field x (0x1)', me, 'end', ...heroAt('x (0x1)', AROUND[k][0]), 'end',
      'set_field y (0x2)', me, 'end', ...heroAt('y (0x2)', AROUND[k][1]), 'end',
      'set_field full_health (0x1D)', me, 'end', 'byte 12', 'end',
      'set_field health (0x1C)', me, 'end', 'byte 12', 'end',
      'set_field behavior (0x15)', me, 'end', 'byte ' + ATTACK, 'end',
      'set_field status_flags (0x14)', me, 'end', 'byte 1', 'end'];
  }),
  say('Four tentacles burst up through the cobbles, swaying in time.  Tlepolemus was right about the sea monsters.\n'),
  'return', 'byte 0', 'end',
  'faraway:',
  say('You play the old pipes.  Far away, in Odemia\'s harbour, something wet perks up.\n'),
  'instrument:'].join('\n');

const tentacleTalk = ['subroutine 0x0100', say('"Blub."*The tentacle sways, hoping for an encore.'), 'return', 'byte 0', 'end'].join('\n');
const tentacleDeath = ['subroutine 0x0201',
  'set_local 0x00', 'byte 0', 'end',
  ...TENTACLES.flatMap(g => [
    'if_not', 'word Character.' + g, 'arg Arg00', 'ne', 'word Character.' + g, 'get_field status_flags (0x14)', 'byte 1', 'bitwise_and', 'and', 'then -> skip' + g,
    'set_local 0x00', 'local Var00', 'byte 1', 'add', 'end', 'skip' + g + ':']),
  'if_not', 'local Var00', 'byte 0', 'eq', 'then -> dies',
  say('The last tentacle sinks back into the cobbles, sulking.  You understand now why Tlepolemus fishes from shore.\n'),
  'dies:',
  'call_resource 0x301D', 'arg Arg00', 'arg Arg01', 'end',
  'return', 'byte 0', 'end'].join('\n');

const {sandbox} = makeSandbox(); sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
sandbox.__base = new Uint8Array(readFileSync(dataPath));
sandbox.__src = { sale, play, tentacleTalk, tentacleDeath };
const out = vm.runInContext(`(() => {
  const s = dataPatchSession(__base);
  ARCHIVE = s.arc;   // the page's tile readers read the open file
  // The two scripts, each found by its instructions, as a further fix is.
  const yes = dataPatchPlace(s, 'Tlepolemus\\'s yes', ${TLEPOLEMUS}, ['conversation_response "y" ->', 'string(implicit) "\\\\"Stop by some evening']);
  const use = dataPatchPlace(s, 'the panpipes\\' Use', ${PIPES}, ['then ->', 'return', 'byte 0x00', 'end', 'set_local 0x00', 'gui Create (0x4)']);
  applyDataEdits(s, { edits: [
    { what: 'Tlepolemus sells the set', resid: ${TLEPOLEMUS}, at: yes.at(1), replaceOp: true, expect: yes.expect, code: __src.sale },
    { what: 'the old set calls the tentacles', resid: ${PIPES}, at: use.at(4), expect: use.expect, code: __src.play },
  ] });
  const done = finishDataPatch(s), spec = done.spec, changed = done.changed.slice(), added = [];
  const add = (resid, data, encrypted) => {
    if (spec.resources.some(r => r.resid === resid)) throw new Error('this Cythera Data already has 0x' + resid.toString(16));
    spec.resources.push({ resid, data, encrypted }); added.push(resid);
  };
  const T = ${JSON.stringify(TENTACLES)};
  // The tentacles' records: the tentacle's body, feral, in Odemia, not alive.
  { const t = spec.resources.find(r => r.resid === 0xF009);
    const table = smartDecrypt(getResourceBytes(s.arc, 0xF009), 0xF009).data.slice();
    for (const g of T) {
      const r = table.subarray(g * 32, g * 32 + 32);
      if (r.some(b => b)) throw new Error('character record ' + g + ' is in use');
      r.set([${ODEMIA}, 0, 0, 0, 0x00, ${TENTACLE}, 0, 0, 0, 6, 8, 1, 0, 100, 12, 12, 0, 0, 0, 2, 0x00, ${TENTACLE}, ${ATTACK}, 0, 0, 3, 0, 0, 0, 2, 3, 0]);
    }
    t.data = table; changed.push(0xF009); }
  // The tentacle's face: its first frame at its own size on white.
  const face = (() => {
    const img = resolveTileImage(getPropTileList()[${TENTACLE}]);
    if (!img) throw new Error('the tentacle does not decode');
    const px = []; for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (img[y * 32 + x]) px.push([x, y, img[y * 32 + x]]);
    if (px.length < 20) throw new Error('the tentacle tile is nearly empty');
    const x0 = Math.min(...px.map(p => p[0])), y0 = Math.min(...px.map(p => p[1]));
    const w = Math.max(...px.map(p => p[0])) - x0 + 1, h = Math.max(...px.map(p => p[1])) - y0 + 1;
    const o = new Uint8Array(4096), ox = Math.round((64 - w) / 2), oy = Math.round((64 - h) / 2);
    for (const [x, y, v] of px) o[(oy + y - y0) * 64 + ox + x - x0] = v;
    const bytes = encodeDCGLiterals(o), back = decompressDCG(bytes, 64, 64);
    for (let i = 0; i < 4096; i++) if (back[i] !== o[i]) throw new Error('the tentacle portrait does not decode back');
    return bytes;
  })();
  for (const g of T) {
    const resid = 0x1800 + g;
    add(resid, dvmWriteClass(resid, [{ key: 12, text: __src.tentacleTalk }, { key: 29, text: __src.tentacleDeath }]).bytes, true);
    add(0x87FF + g, face, false);
  }
  const ids = [...new Set(changed)].concat(added);
  const w = writeDelverPatch(spec, ids, { description: ${JSON.stringify('Tlepolemus sells his old panpipes at last, of an evening. Not a fix: a joke, built with Grimoire. Four new characters; a new game has them.')}, typeCode: DELV_PATCH_EXPORT_TYPE });
  const bin = writeMacBinary({ name: ${JSON.stringify(NAME)}, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
  const m = mergeDelverPatch(__base, w.bytes);
  const marc = openDelverArchive(m.bytes);
  dvmSetResourceSymbols(loadResourceSymbolsFrom(marc));
  const back = [${TLEPOLEMUS}, ${PIPES}].map(id => dvmStructureRender(marc, smartDecrypt(getResourceBytes(marc, id), id).data, id, {})).join('\\n\\n');
  const same = ids.every(id => { const r = spec.resources.find(x => x.resid === id); const got = smartDecrypt(getResourceBytes(marc, id), id).data; return got.length === r.data.length && got.every((v, i) => v === r.data[i]); });
  return { patch: w.bytes, bin, merged: m.bytes, added: m.added, replaced: m.replaced, same, back, log: done.log };
})()`, ctx);
const hex = a => Array.from(a, i => '0x' + i.toString(16).toUpperCase()).join(' ') || 'none';
console.log(out.log.join('\n'));
console.log(out.back);
console.log(`merge: added ${hex(out.added)}; replaced ${hex(out.replaced)}; read back as written: ${out.same}`);
if (out.replaced.length !== 3 || out.added.length !== 8 || !out.same) process.exit(1);
mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + '/' + NAME, Buffer.from(out.patch));
writeFileSync(outDir + '/' + NAME + '.bin', Buffer.from(out.bin));
writeFileSync(outDir + '/Cythera Data.data', Buffer.from(out.merged));
console.log(`wrote ${NAME} (${out.patch.length} bytes), ${NAME}.bin and Cythera Data.data to ${outDir}`);
