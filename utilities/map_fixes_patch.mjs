#!/usr/bin/env node
/* A builder, not a check: the two faults in the scenario's maps that the
   board reported and this project confirmed, as one Magpie patch.
   (26 September 2026, the Citadel's at the maintainer's choice.) The
   readings are in the workbench's doc/bugs.md.

   Usage: node utilities/map_fixes_patch.mjs index.html "<Cythera Data.data>" <out dir>

   1. The first Stronghold's kitchen (map 0x801F): the metal door at
      (22,18) stands on tile 145, "wall", which blocks, so opening it shows
      a wall and the step is refused; the seven squares behind it are
      reached by nothing else. The square takes the floor tile of the door
      beside it at (20,18), 210.
   2. The shore under the Citadel (map 0x8006, Catamarca): the passage
      from the Underground lands on (25,54), in a pocket of shore closed at
      both ends by a bush beside water, and the way back, the secret
      passage and its egg at (25,53), stands on embankment tile 100, which
      blocks, so the party cannot step onto it. Of the game's three secret
      passages it is the only one on a blocking tile, and every embankment
      tile blocks, so the square takes the grass of its neighbour to the
      north at (25,52), 52. That reads as a notch in the embankment. It
      opens no other way: (25,52) holds a tree, which blocks, so the notch
      leads only onto the passage.

   A map square is two bytes, and writeDelverMapTiles changes those and
   nothing else in the resource. Each edit reads the square and its
   neighbour first and stops the build if either is not the tile the
   reading found. */
import {buildPatch} from './patch_build.mjs';
const [htmlPath = 'index.html', dataPath, outDir] = process.argv.slice(2);
if (!dataPath || !outDir) { console.error('usage: map_fixes_patch.mjs index.html <Cythera Data.data> <out dir>'); process.exit(2); }

// The source of each fn runs inside the page's sandbox, where the map
// reader and writer are globals.
const dataEdits = [
  { what: 'the Stronghold’s kitchen door', resid: 0x801F, fn: (b) => {
      const m = parseDelverMap(b); m.raw = b;
      const at = (x, y) => u16be(b, m.mapDataOffset + (x + y * m.width) * 2);
      if (at(22, 18) !== 145 || at(20, 18) !== 210) throw new Error('(22,18) is ' + at(22, 18) + ' and (20,18) is ' + at(20, 18) + ', not 145 and 210');
      b.set(writeDelverMapTiles(b, m, [{ x: 22, y: 18, tile: 210 }])); return '(22,18) given floor tile 210';
  } },
  { what: 'the passage under the Citadel', resid: 0x8006, fn: (b) => {
      const m = parseDelverMap(b); m.raw = b;
      const at = (x, y) => u16be(b, m.mapDataOffset + (x + y * m.width) * 2);
      if (at(25, 53) !== 100 || at(25, 52) !== 52) throw new Error('(25,53) is ' + at(25, 53) + ' and (25,52) is ' + at(25, 52) + ', not 100 and 52');
      b.set(writeDelverMapTiles(b, m, [{ x: 25, y: 53, tile: 52 }])); return '(25,53) given grass tile 52';
  } },
];

const ok = buildPatch({ htmlPath, dataPath, outDir, name: 'Cythera Map Fixes',
  description: 'Two fixes to Cythera’s maps, built with Grimoire: the first Stronghold’s kitchen door opens onto floor, and the secret passage under the Citadel can be stepped on from the shore.',
  edits: [], dataEdits });
process.exit(ok ? 0 : 1);
