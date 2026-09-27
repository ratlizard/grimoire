#!/usr/bin/env node
/* A builder, not a check, and not a fix: the Wine Contract finished by a
   fight with the grapes of Glaucus's vineyard, as one Magpie patch of its
   own, "Cythera Sour Grapes". (27 September 2026, the maintainer: a
   ridiculous way to complete the wine contract, with the gremlin construct
   doing it; then more than printed text, a dialogue and a fight, and no
   gremlin in the words.) The shipped task cannot be finished -- Ambrosia
   called it a red herring (the board, topic 87) -- and the fix patches
   leave it so. This replaces wine_gremlin_patch.mjs, which only printed.

   Usage: node utilities/sour_grapes_patch.mjs index.html "<Cythera Data.data>" <out dir>

   WHAT HAPPENS. Walk into Glaucus's vineyard (zone 18) with Apis's contract
   open (her character flag 5): a conversation window, Glaucus's portrait
   and the hero's, says the grapes have been thinking since his must went
   sour and do not want to be wine; six grapes rise around the party and
   fight. Killing the last one opens the conversation again, Glaucus signs
   for nine hundred and forty barrels of sour must, the To Do line is struck
   (CompleteQuest(17)), Apis's flag 5 is cleared and her flag 2 set, the one
   her own "Hungry for that meal I promised?" waits on.

   HOW, ALL OF IT THE ENGINE'S OWN ROUTES:
   - Gremlin 17 (0x1F11) is the trigger. Its Enter runs on a zone change,
     after the zone's things are loaded when the change is in play
     (TGameViewer::GoToLocation loads the level, then calls ChangeZone,
     which runs the zone's Enter and TGremlin::OnEnter), and after the party
     is rebuilt on a load (TDelverApp::BeginPlay). It switches itself off
     before anything else, so it acts once.
   - The grapes are characters 140 to 145, free records in the scenario's
     0xF009 (130 to 188 are all zero), laid out after the game's two hostile
     named characters, Aeneas and Eudoxus: the ooze's body (prop type 115,
     the lavender blob, which has no part in the plot), feral (byte 25, 3:
     an enemy to the party and neither to Glaucus, by the enemy table),
     zone 18, not alive. Setting a character's x and y writes its record
     (SetField, fields 1 and 2), and setting status_flags with the alive bit
     on a character that has no creature in the world makes the engine
     hatch one at the record's square (SetField, field 20, calls
     TActiveMonster::HatchEgg), which is how Resurrection brings someone
     back. The gremlin does that for the six, around the hero.
   - Each grape has a character script (0x188C to 0x1891): Talk answers
     "Glurp.", and OnDeath counts the other five still alive (the alive bit
     of each, the dying one's own not yet cleared, CharEntry::DeathRites
     clears it after) and, when none is, plays the ending; then it hands on
     to the default OnDeath (0x301D), so a grape dies as an ooze does.
   - The grapes are the game's own: tile 0x249, named "grapes" in the
     tile-name table, aspect 3 of the food type the page shows as
     flatbread (the maintainer, who saw them on Glaucus's table). The
     bird's four frames take them where the food tile has them, every other
     frame a pixel higher; each grape's portrait (0x888B to 0x8890) is them
     at their own size on white, with no frame. (Portrait 206, taken first,
     is a flowering bush; the cluster in the vintner's portrait frame came
     next, before the food was found.)
   A save carries its own character table, so a game begun before the patch
   has no grapes; then Glaucus signs without a fight. A save made before it
   also keeps gremlin 17 off until the save sheet switches it on.

   Everything is added but 0xF009, which no other patch here changes. The
   words are ours, not the game's, and seven-bit like every script's. */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: sour_grapes_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const NAME = 'Cythera Sour Grapes';
const GREMLIN = 0x1F11, APIS = 42, GLAUCUS = 102, VINEYARD = 18, BIRD = 89;
// The behaviour a hatched creature is given from its egg's record (Data1 into
// byte 22): 8 is the commonest among the ones that attack -- ruffians, asps,
// skeletons, undead -- in the shipped eggs. At 0 the grapes stood still.
const ATTACK = 8;
const GRAPES = [140, 141, 142, 143, 144, 145];
const AROUND = [[-2, -1], [2, -1], [-2, 1], [2, 1], [0, -2], [0, 2]];

// A line the game prints: quoted text is the speaker's balloon, a * after it
// waits for a click, text outside quotes goes to the message line.
const say = s => { if (!/^[\x20-\x7E\n]+$/.test(s) || /\s\/\//.test(s)) throw new Error('a line the listing cannot carry: ' + s); return 'string(implicit) ' + JSON.stringify(s); };
const speaker = (who, slot) => ['sys TalkParticipant', 'short ' + who, 'byte ' + slot, 'end'];
const settle = [
  'sys CompleteQuest', 'byte 17', 'end',
  'call_resource 0xF01', 'short ' + APIS, 'byte 5', 'end',
  'call_resource SetCharacterFlag (0xF00)', 'short ' + APIS, 'byte 2', 'end',
  'call_resource GainExp (0xE8B)', 'global PlayerCharacter (0x5)', 'byte 30', 'end',
  say('The Wine Contract is settled. Apis, you suspect, owes you a meal.\n')];
const ending = ['sys OpenConversation', 'end', ...speaker(GLAUCUS, 0),
  say('"You did it!  My vineyard is sticky, but it\'s safe."*"Here - give me that contract."*'),
  say('Glaucus fills in every blank: nine hundred and forty barrels of sour must, for delivery to Apis.*'),
  say('"She\'ll love it."*"She won\'t love it."*"Tell her it\'s a vintage."*'),
  'sys FinishConversation', 'end', ...settle];

const gremlin = ['subroutine 0x0200',
  'if_not', 'arg Arg01', 'is_type Zone', 'then -> done',
  'if_not', 'global CurrentZone (0x10)', 'short ' + VINEYARD, 'eq', 'then -> done',
  'if_not', 'call_resource 0xF02', 'short ' + APIS, 'byte 5', 'end', 'then -> done',
  'set_field status_flags', 'arg Arg00', 'end', 'byte 1', 'end',
  'sys OpenConversation', 'end',
  ...speaker(1, 2),
  say('"Apis sent me with a wine contract.  How many barrels can you spare?"*'),
  ...speaker(GLAUCUS, 0),
  say('"Barrels?  Haven\'t you heard?  Every drop I had went sour overnight."*'),
  'if_not', 'word Character.' + GRAPES[0], 'get_field full_health (0x1D)', 'byte 0', 'gt', 'then -> nogrape',
  say('"And ever since, the grapes have been... thinking."*'),
  say('Out among the trellises, something goes squelch.*'),
  say('"Oh no.  Oh no.  They heard you say barrels."*"They do NOT want to be wine."*"Squash them before they get to the rest of the vines, and I\'ll sign anything you like!"*'),
  'sys FinishConversation', 'end',
  // Each grape: its prop slot (the working list's record of the same number,
  // where HatchEgg takes the creature's type from) made a placed prop of the
  // bird's type, flags 4 as a character standing in the zone has; its square
  // on both the slot and the record; then the alive bit, which hatches it.
  ...GRAPES.flatMap((g, k) => {
    const slot = 'word 0x' + g.toString(16).padStart(4, '0') + '@Type.Prop';
    const heroAt = (f, d) => ['global PlayerCharacter (0x5)', 'cast Character (0x40)', 'get_field ' + f, 'byte ' + d, 'add'];
    return [
      'set_field flags (0x0)', slot, 'end', 'byte 4', 'end',
      'set_field aspect_and_proptype (0x5)', slot, 'end', 'short ' + BIRD, 'end',
      'set_field x (0x1)', slot, 'end', ...heroAt('x (0x1)', AROUND[k][0]), 'end',
      'set_field y (0x2)', slot, 'end', ...heroAt('y (0x2)', AROUND[k][1]), 'end',
      'set_field x (0x1)', 'word Character.' + g, 'end', ...heroAt('x (0x1)', AROUND[k][0]), 'end',
      'set_field y (0x2)', 'word Character.' + g, 'end', ...heroAt('y (0x2)', AROUND[k][1]), 'end',
      'set_field behavior (0x15)', 'word Character.' + g, 'end', 'byte ' + ATTACK, 'end',
      'set_field status_flags (0x14)', 'word Character.' + g, 'end', 'byte 1', 'end'];
  }),
  say('Six grapes the size of sheep rise from the vines, dripping sour must.\n'),
  'branch done',
  'nogrape:',
  say('"...you know what?  Give me that."*'),
  say('Glaucus fills in every blank: nine hundred and forty barrels of sour must, for delivery to Apis.*'),
  say('"She\'ll love it."*"She won\'t love it."*'),
  'sys FinishConversation', 'end', ...settle,
  'done:', 'return', 'byte 0', 'end'].join('\n');

const grapeTalk = ['subroutine 0x0100', say('"Glurp."*"...we are not wine."'), 'return', 'byte 0', 'end'].join('\n');
const grapeDeath = ['subroutine 0x0201',
  'set_local 0x00', 'byte 0', 'end',
  ...GRAPES.flatMap(g => [
    'if_not', 'word Character.' + g, 'arg Arg00', 'ne', 'word Character.' + g, 'get_field status_flags (0x14)', 'byte 1', 'bitwise_and', 'and', 'then -> skip' + g,
    'set_local 0x00', 'local Var00', 'byte 1', 'add', 'end', 'skip' + g + ':']),
  'if_not', 'local Var00', 'byte 0', 'eq', 'then -> dies',
  ...ending,
  'dies:',
  'call_resource 0x301D', 'arg Arg00', 'arg Arg01', 'end',
  'return', 'byte 0', 'end'].join('\n');

const {sandbox} = makeSandbox(); sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
sandbox.__base = new Uint8Array(readFileSync(dataPath));
sandbox.__src = { gremlin, grapeTalk, grapeDeath };
const out = vm.runInContext(`(() => {
  const arc = openDelverArchive(__base), spec = delverArchiveSpec(__base);
  ARCHIVE = arc;   // the page's tile and name readers read the open file
  const birdBase = getPropTileList()[${BIRD}];
  if (!(birdBase > 0)) throw new Error('no base tile for the bird');
  const GRAPES = ${JSON.stringify(GRAPES)}, added = [];
  const add = (resid, data, encrypted) => {
    if (spec.resources.some(r => r.resid === resid)) throw new Error('this Cythera Data already has 0x' + resid.toString(16));
    spec.resources.push({ resid, data, encrypted }); added.push(resid);
  };
  // The grape itself: the game's own "grapes", a food drawn on tile 0x249
  // (aspect 3 of the type the page shows as flatbread, since a type is named
  // by its base tile), found by that name in the tile-name table, where it
  // is an entry of one tile. Its pixels at their own size and place.
  const cluster = (() => {
    const names = loadTerrainNames();
    const k = names.findIndex(([, nm]) => nm === 'grapes');
    if (k < 1 || names[k][0] - names[k - 1][0] !== 1) throw new Error('no single tile is named grapes');
    const tile = names[k][0], img = resolveTileImage(tile);
    if (!img) throw new Error('tile 0x' + tile.toString(16) + ' does not decode');
    const px = [];
    for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) if (img[y * 32 + x]) px.push([x, y, img[y * 32 + x]]);
    if (px.length < 20) throw new Error('the grapes tile is nearly empty');
    const x0 = Math.min(...px.map(p => p[0])), y0 = Math.min(...px.map(p => p[1]));
    return { tile, x0, y0, px: px.map(([x, y, v]) => [x - x0, y - y0, v]),
             w: Math.max(...px.map(p => p[0])) - x0 + 1, h: Math.max(...px.map(p => p[1])) - y0 + 1 };
  })();
  // The grapes' records, after Aeneas and Eudoxus: the bird's body (the one
  // unit nothing in the files places), feral, in the vineyard, not alive
  // until the trigger wakes them.
  const t = spec.resources.find(r => r.resid === 0xF009);
  const table = smartDecrypt(getResourceBytes(arc, 0xF009), 0xF009).data.slice();
  for (const g of GRAPES) {
    const r = table.subarray(g * 32, g * 32 + 32);
    if (r.some(b => b)) throw new Error('character record ' + g + ' is in use');
    r.set([${VINEYARD}, 0, 0, 0, 0x00, ${BIRD}, 0, 0, 0, 8, 7, 1, 0, 100, 18, 18, 0, 0, 0, 2, 0x00, ${BIRD}, ${ATTACK}, 0, 0, 3, 0, 0, 0, 2, 3, 0]);
  }
  t.data = table;
  const changed = [0xF009];
  // The bird's unit takes the grapes' stats and side too, in case the
  // creature is built from the unit's rather than the record's.
  { const u = spec.resources.find(r => r.resid === 0xF008), d = smartDecrypt(getResourceBytes(arc, 0xF008), 0xF008).data.slice();
    let k = -1; for (let i = 0; i < 128; i++) if (((d[i * 16 + 12] << 8) | d[i * 16 + 13]) === ${BIRD}) { if (k >= 0) throw new Error('two units are the bird'); k = i; }
    if (k < 0) throw new Error('no unit is the bird');
    d[k * 16] = 8; d[k * 16 + 1] = 7; d[k * 16 + 2] = 1; d[k * 16 + 5] = 18; d[k * 16 + 6] = 3;
    u.data = d; changed.push(0xF008); }
  // Its name: the tile-name table's entry that runs over the bird's tiles
  // and nothing else says "grape", with the game's own plural mark. That
  // entry also says how many tiles are the bird's: four, 0x508 to 0x50B.
  // The four after them are the chicken's, named so, and stay a chicken.
  let birdFrames = 0;
  { const r = spec.resources.find(x => x.resid === 0xF004), d = getResourceBytes(arc, 0xF004);
    if (r.encrypted) throw new Error('the tile names are stored encrypted, which this does not expect');
    const base = birdBase;
    let i = 0, prev = -1, done = false; const parts = [];
    while (i + 3 <= d.length) {
      const id = (d[i] << 8) | d[i + 1]; let end = i + 2; while (end < d.length && d[end] !== 0) end++;
      const nm = String.fromCharCode(...d.subarray(i + 2, end));
      if (!done && id >= base) {
        if (nm !== 'bird' || prev !== base - 1 || id > base + 15) throw new Error('the tiles of the bird are not named by one entry of their own: ' + nm);
        birdFrames = id - base + 1;
        parts.push(d.subarray(i, i + 2), Uint8Array.of(...[...'grape'].map(ch => ch.charCodeAt(0)), 92, 115), Uint8Array.of(0)); done = true;
      } else parts.push(d.subarray(i, end + 1));
      if (id < prev) { parts.push(d.subarray(end + 1)); break; }
      prev = id; i = end + 1;
    }
    if (!done) throw new Error('no entry names the bird');
    const n = parts.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    r.data = out; changed.push(0xF004); }
  // The bird's frames are the grapes where the food tile has them, every
  // other frame a pixel higher so a moving grape bobs.
  { const base = birdBase, sheet = 0x8E00 + (base >> 4), first = base & 15;
    if (!(birdFrames > 0) || first + birdFrames > 16) throw new Error('the bird does not sit in one sheet');
    const r = spec.resources.find(x => x.resid === sheet), col = decompressDCG(smartDecrypt(getResourceBytes(arc, sheet), sheet).data, 32, 512);
    for (let f = 0; f < birdFrames; f++) {
      const at = (first + f) * 1024; col.fill(0, at, at + 1024);
      const ox = cluster.x0, oy = Math.max(0, cluster.y0 - (f & 1));
      for (const [x, y, v] of cluster.px) col[at + (oy + y) * 32 + ox + x] = v;
    }
    const bytes = encodeDCGLiterals(col), back = decompressDCG(bytes, 32, 512);
    for (let i = 0; i < col.length; i++) if (back[i] !== col[i]) throw new Error('the sheet of the bird does not decode back');
    r.data = bytes; changed.push(sheet); }
  // The grape's face: the grapes at their own size in the middle of a white
  // field, no frame.
  const face = (() => {
    const out = new Uint8Array(4096).fill(0);
    const ox = Math.round((64 - cluster.w) / 2), oy = Math.round((64 - cluster.h) / 2);
    for (const [x, y, v] of cluster.px) out[(oy + y) * 64 + ox + x] = v;
    const bytes = encodeDCGLiterals(out), back = decompressDCG(bytes, 64, 64);
    for (let i = 0; i < 4096; i++) if (back[i] !== out[i]) throw new Error('the grape portrait does not decode back');
    return bytes;
  })();
  // Each grape's script and portrait.
  for (const g of GRAPES) {
    const resid = 0x1800 + g;
    add(resid, dvmWriteClass(resid, [{ key: 12, text: __src.grapeTalk }, { key: 29, text: __src.grapeDeath }]).bytes, true);
    add(0x87FF + g, face, false);
  }
  add(${GREMLIN}, dvmWriteClass(${GREMLIN}, [{ key: 20, text: __src.gremlin }]).bytes, true);
  const ids = changed.concat(added);
  const w = writeDelverPatch(spec, ids, { description: ${JSON.stringify('The Wine Contract can be finished at last, in Glaucus\'s vineyard, if you can stand the grapes. Not a fix: a joke, built with Grimoire. Six new characters and gremlin 17; a new game has them.')}, typeCode: DELV_PATCH_EXPORT_TYPE });
  const bin = writeMacBinary({ name: ${JSON.stringify(NAME)}, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
  const m = mergeDelverPatch(__base, w.bytes);
  const marc = openDelverArchive(m.bytes);
  dvmSetResourceSymbols(loadResourceSymbolsFrom(marc));
  const back = [${GREMLIN}, 0x1800 + GRAPES[0]].map(id => dvmStructureRender(marc, smartDecrypt(getResourceBytes(marc, id), id).data, id, {})).join('\\n\\n');
  const same = added.every(id => { const s = spec.resources.find(r => r.resid === id); const got = smartDecrypt(getResourceBytes(marc, id), id).data; return got.length === s.data.length && got.every((v, i) => v === s.data[i]); });
  const tableSame = changed.every(id => { const s = spec.resources.find(r => r.resid === id); const got = smartDecrypt(getResourceBytes(marc, id), id).data; return got.length === s.data.length && got.every((v, i) => v === s.data[i]); });
  return { patch: w.bytes, bin, merged: m.bytes, added: m.added, replaced: m.replaced, same, tableSame, back };
})()`, ctx);
const hex = a => Array.from(a, i => '0x' + i.toString(16).toUpperCase()).join(' ') || 'none';
console.log(out.back);
console.log(`merge: added ${hex(out.added)}; replaced ${hex(out.replaced)}; read back as written: ${out.same}; changed resources: ${out.tableSame}`);
if (out.replaced.length !== 4 || out.added.length !== 13 || !out.same || !out.tableSame) process.exit(1);
mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + '/' + NAME, Buffer.from(out.patch));
writeFileSync(outDir + '/' + NAME + '.bin', Buffer.from(out.bin));
writeFileSync(outDir + '/Cythera Data.data', Buffer.from(out.merged));
console.log(`wrote ${NAME} (${out.patch.length} bytes), ${NAME}.bin and Cythera Data.data to ${outDir}`);
