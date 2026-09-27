#!/usr/bin/env node
/* A builder, not a check, and not a fix: the Wine Contract finished, badly,
   by a gremlin, as one Magpie patch of its own, "Cythera Wine Contract
   Gremlin". (27 September 2026, the maintainer: "some ridiculous and funny
   way to complete the wine contract, maybe with a gremlin directly
   involved", and then: the gremlin construct, not a gremlin in the words.)
   The shipped task cannot be finished -- Ambrosia called it a red herring
   (the board, topic 87) -- and the fix patches leave it so.

   Usage: node utilities/wine_gremlin_patch.mjs index.html "<Cythera Data.data>" <out dir>

   WHAT IT ADDS: gremlin 17, script 0x1F11 (17 for the To Do slot), and
   nothing else, so it installs beside every other patch here. Its Enter runs
   whenever a zone is entered, a save loading included (TGameViewer::
   ChangeZone; seen in play on the maintainer's phone, 27 September 2026).
   It acts when the zone is either vineyard (Glaucus's, zone 18, or Borus's,
   zone 20) and Apis's contract is open (her character flag 5, which she
   sets as she hands it over): it prints its scene, strikes the To Do line
   (CompleteQuest(17)), clears her flag 5 so she stops asking after it, sets
   her flag 2, the one her own "Hungry for that meal I promised?" waits on,
   gives the hero the experience her flour errand gives, and switches itself
   off (status_flags 1). Only the game's global state is touched: a
   zone-entry gremlin runs before the zone's things are in place, so what
   it did to the contract in the pack might not last (the workbench's
   save-format.md, "What a gremlin can react to and do, tried"). The
   contract stays in the pack, as the words say.

   Written as the page's gremlin maker writes one (gremlinListingFromForm in
   js/page-mechanics.js): the method's second argument is the zone, each
   test an if_not to the end, the class through dvmWriteClass, stored
   encrypted by its id as TInterp::Dispatch reads every class. A new game
   switches it on (TGremlin::ClearGremlins); a save made before it keeps it
   off until the save sheet's Gremlins table switches gremlin 17 on.

   The words are ours, not the game's, and seven-bit like every script's. */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: wine_gremlin_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }
const NAME = 'Cythera Wine Contract Gremlin', N = 17, RESID = 0x1F00 + N;
const APIS = 42, VINEYARDS = [18, 20];

const lines = [
  'As you step into the vineyard, something in your pack starts humming a drinking song.',
  'A gremlin in a thimble hat climbs out with Apis\'s wine contract and fills in every blank in purple ink: Gremlin Reserve, nine hundred and forty barrels, pressed this morning in your left boot.',
  'It stamps the contract with a grape, tucks it back into your pack, eats one grape from every vine in sight, and is gone.',
  'Somewhere in Cademia, Apis sits down very suddenly. The contract is settled, and she owes you a meal.',
];
for (const l of lines) if (!/^[\x20-\x7E]+$/.test(l) || /\s\/\//.test(l)) throw new Error('a line the listing cannot carry: ' + l);
const listing = ['subroutine 0x0200',
  'if_not', 'arg Arg01', 'is_type Zone', 'then -> done',
  'if_not', 'global CurrentZone (0x10)', 'short ' + VINEYARDS[0], 'eq', 'global CurrentZone (0x10)', 'short ' + VINEYARDS[1], 'eq', 'or', 'then -> done',
  'if_not', 'call_resource 0xF02', 'short ' + APIS, 'byte 5', 'end', 'then -> done',
  ...lines.map(l => 'string(implicit) ' + JSON.stringify(l + '\n')),
  'sys CompleteQuest', 'byte 17', 'end',
  'call_resource 0xF01', 'short ' + APIS, 'byte 5', 'end',
  'call_resource SetCharacterFlag (0xF00)', 'short ' + APIS, 'byte 2', 'end',
  'call_resource GainExp (0xE8B)', 'global PlayerCharacter (0x5)', 'byte 10', 'end',
  'set_field status_flags', 'arg Arg00', 'end', 'byte 1', 'end',
  'done:', 'return', 'byte 0', 'end'].join('\n');

const {sandbox} = makeSandbox(); sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
sandbox.__base = new Uint8Array(readFileSync(dataPath));
sandbox.__listing = listing;
const out = vm.runInContext(`(() => {
  const spec = delverArchiveSpec(__base);
  if (spec.resources.some(r => r.resid === ${RESID})) throw new Error('this Cythera Data already has gremlin ${N}');
  const cls = dvmWriteClass(${RESID}, [{ key: 20, text: __listing }]);
  spec.resources.push({ resid: ${RESID}, data: cls.bytes, encrypted: true });
  const w = writeDelverPatch(spec, [${RESID}], { description: ${JSON.stringify('The Wine Contract can be finished at last, by a gremlin, in either vineyard. Not a fix: a joke, built with Grimoire. Gremlin ' + N + '; a new game switches it on.')}, typeCode: DELV_PATCH_EXPORT_TYPE });
  const bin = writeMacBinary({ name: ${JSON.stringify(NAME)}, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
  const m = mergeDelverPatch(__base, w.bytes);
  const stored = getResourceBytes(openDelverArchive(m.bytes), ${RESID});
  const want = decryptResource(cls.bytes, ${RESID});
  const same = !!stored && stored.length === want.length && stored.every((v, i) => v === want[i]);
  dvmSetResourceSymbols(loadResourceSymbolsFrom(openDelverArchive(m.bytes)));
  const back = dvmStructureRender(openDelverArchive(m.bytes), cls.bytes, ${RESID}, {});
  return { patch: w.bytes, bin, merged: m.bytes, added: m.added, replaced: m.replaced, same, back };
})()`, ctx);
const hex = a => Array.from(a, i => '0x' + i.toString(16).toUpperCase()).join(' ') || 'none';
console.log(out.back);
console.log(`merge: added ${hex(out.added)}, replaced ${hex(out.replaced)}; stored as the game reads it: ${out.same}`);
if (out.added.length !== 1 || out.added[0] !== RESID || out.replaced.length || !out.same) process.exit(1);
mkdirSync(outDir, { recursive: true });
writeFileSync(outDir + '/' + NAME, Buffer.from(out.patch));
writeFileSync(outDir + '/' + NAME + '.bin', Buffer.from(out.bin));
writeFileSync(outDir + '/Cythera Data.data', Buffer.from(out.merged));
console.log(`wrote ${NAME} (${out.patch.length} bytes), ${NAME}.bin and Cythera Data.data to ${outDir}`);
