// smoke_views.mjs -- one part of the UI smoke: the lazy gallery, the fork
// galleries and the Mac resources, the game font, the editor's zone names,
// the roofs, walls and marks, the frame runs, the gallery filter, the map
// landing and the deep links. These followed the galleries loop in the one
// file until 18 September 2026 and were most of that part's time, so they
// run on their own from a fresh boot (smoke_boot.mjs). Run alone with
//   node utilities/viewer_smoke.mjs index.html "$TMPDIR/Cythera Data.data" "" <installers .sit> <saved game> views
import { htmlPath, dataPath, onlyCat, visePath, savePath, html, js, archive, rsrcPath, rsrcFork, missingIds,
         El, REGISTRY, catSel, optionSource, CATEGORY_VALUES, body, documentStub, rafQueue, drainRaf, sandbox,
         ctx, peek, fail, t0, status, A, readFileSync, existsSync, tally } from './smoke_boot.mjs';


// The detail views that are not resource-backed.
for (const [name, call] of [
  ['character detail', () => ctx.showCharacterDetail(1)],
  ['prop detail',      () => { const t = ctx.getPropTileList(); ctx.showPropTypeDetail(Object.keys(t).map(Number).find(k => t[k])); }],
  ['monster detail',   () => ctx.showMonsterDetail(22)],
  ['composite detail', () => ctx.showCompositeDetail(0x1000, ctx.loadCompositionTable()[0])],
  ['search',           () => { REGISTRY.get('searchBox').value = 'locked'; ctx.runSearch(); }],
  ['xref report',      () => ctx.xrefReport(0x8801)],
]) {
  try { call(); } catch (e) { fail(name, e); }
}

// The item browser reads a class script per prop type and joins it to the prop
// lists; "the gallery rendered" says nothing about whether it found anything.
try {
  ctx.showCategory('ITEMS');
  const list = ctx.inventoryItemList ? ctx.inventoryItemList() : null;
  if (!list || !list.length) fail('items', 'no inventory items found');
  else {
    const weighed = list.filter(i => i.weight !== null).length;
    const placed = list.filter(i => i.instances > 0).length;
    if (!weighed) fail('items', 'not one item carries a weight — is parseItemClass finding the table?');
    else if (!placed) fail('items', 'no item is placed anywhere — is buildItemIndex reading the prop lists?');
    else console.log(`  items: ${list.length} classes, ${weighed} with a weight, ${placed} placed in the world`);
    // The containment reading is what makes "placed" mean anything.
    const held = list.reduce((a, i) => a + ((ctx.buildItemIndex()[i.pt] || {}).carried || 0), 0);
    if (!held) fail('items', 'nothing is carried by anyone — the prop location word is being read as coordinates again');
    else console.log(`  items: ${held} carried by characters`);
    // The aspect rule, v1.31.0: art no class owns is read off the file --
    // named, drawn, no class's base, no class's state, in no prop list --
    // and the flail is the one the maintainer found by hand (mace at
    // aspect 8, spear at aspect 2, tile 0x208). A mace's own page says so
    // with the cheat's word for it.
    const orphans = ctx.orphanItemArt();
    const flail = orphans.find(o => o.name === 'flail');
    // The cells are set as text, so the walk reads textContent as well.
    const ihtml = (function all(el) { return (el.innerHTML || '') + (el.textContent || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
    const mace = list.find(i => i.name === 'mace');
    if (!flail || flail.tile !== 0x208 || !flail.reach.some(r => r.pt === 94 && r.aspect === 8 && r.word === 0x205E) || !flail.reach.some(r => r.pt === 100 && r.aspect === 2))
      fail('items', 'the flail is not read as art no class owns, reached by mace 8 and spear 2: ' + JSON.stringify(flail));
    // The swing is the class's own list, read off its script: the mace plays
    // three tiles of its own, the spear its own tile three times, and the
    // rolling pin, with no list, the outcome routine's default pair.
    else if (JSON.stringify((ctx.weaponSwingFrames(94) || {}).tiles) !== '[2211,2212,2213]' || !(ctx.weaponSwingFrames(94) || {}).own)
      fail('items', 'the mace’s swing is not read as its own 0x8A3-0x8A5: ' + JSON.stringify(ctx.weaponSwingFrames(94)));
    else if (JSON.stringify((ctx.weaponSwingFrames(100) || {}).tiles) !== '[518,518,518]')
      fail('items', 'the spear’s swing is not its own tile three times: ' + JSON.stringify(ctx.weaponSwingFrames(100)));
    else if (JSON.stringify((ctx.weaponSwingFrames(163) || {}).tiles) !== '[436,437]' || (ctx.weaponSwingFrames(163) || {}).own !== false)
      fail('items', 'the rolling pin does not fall back to the outcome routine’s default: ' + JSON.stringify(ctx.weaponSwingFrames(163)));
    else if (orphans.some(o => o.name === 'bread' || o.name === 'lit torch' || o.name === 'closed shutters'))
      fail('items', 'a placed variant or a scripted state is listed as an orphan: ' + orphans.map(o => o.name).join(', '));
    else if (!/Art no class owns/.test(ihtml) || !/flail/.test(ihtml) || !/in no prop list/.test(ihtml))
      fail('items', 'the Items sheet does not list the art no class owns: ' + REGISTRY.get('output').textContent);
    else {
      ctx.showItemDetail(mace ? mace.pt : 94);
      const dhtml = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
      if (!/0x205E/.test(dhtml) || !/flail/.test(dhtml) || !/prop type in the low ten bits/.test(dhtml)) fail('items', 'the mace’s page does not state the aspect rule with the flail and its word');
      else console.log(`  items: ${orphans.length} pictures no class owns, the flail among them at mace 8 / spear 2; the mace’s page says 0x205E`);
      // The prop record block, v1.33.0: the rail's 32 slots, the readout at an
      // aspect, the other classes that reach the tile with the aspect each
      // needs, and the two bytes' meaning -- Data1 read off the outcome
      // routine as the enchantment, the sword classes' Examine lines found
      // by their test, and the one placed sword that carries one.
      const walk = el => (el.innerHTML || '') + (el.textContent || '') + (el.children || []).map(walk).join('');
      const pw = ctx.propWordRules();
      const st = ctx.__peek('DERIVED.PROP_WORD');
      if (!st || st.pt !== 94 || st.slots.length !== 32) fail('items', 'the prop record block did not mount on the mace’s page with 32 slots: ' + JSON.stringify(st && [st.pt, st.slots && st.slots.length]));
      else {
        ctx.propWordSet(8);
        let html = walk(REGISTRY.get('sheetGrid'));
        const spearAt2 = /propWordOpen\(100,2\)/.test(html) && /at 2, 0x0864/.test(html);
        if (!/0x205E/.test(html) || !/8 × 1,024 \+ 94/.test(html) || !/shows tile 0x0208, <b[^>]*>flail<\/b>/.test(html) || !/damage 15, reach 1, Mace, 18 grains/.test(html))
          fail('items', 'the mace at aspect 8 does not read out as 0x205E, the flail, with the mace’s own numbers');
        else if (!spearAt2) fail('items', 'the spear is not listed as reaching the flail tile at aspect 2 (0x0864)');
        else if (!(pw.ench && pw.ench.guarded && pw.ench.added && pw.ench.magic)) fail('items', 'the enchantment was not read off the outcome routine: ' + JSON.stringify(pw.ench));
        else if (pw.examines.length !== 3 || !pw.examines.every(e => e.above2 === 'It has an extremely sharp edge.' && e.above0 === 'It is very sharp.') || !pw.examines.some(e => e.pt === 95))
          fail('items', 'the Examine lines were not found on the dagger and the two swords: ' + JSON.stringify(pw.examines));
        else if (!pw.placed.some(r => r.resid === 0x811A && r.pt === 281 && r.d1 === 7) || pw.placed.length !== 1 || pw.ammo.length !== 5)
          fail('items', 'the placed enchantment is not the one sword (Data1 7) with five arrows the resolver ignores: ' + JSON.stringify([pw.placed, pw.ammo.length]));
        else if (pw.readers.length < 70 || !pw.readers.some(r => r.pt === 0x0A && r.ops.includes('get data1')) || !pw.readers.some(r => r.pt === 0x48 && r.ops.includes('get data3')) || !pw.readers.some(r => r.pt === 0x142 && r.ops.includes('set data1')) || !pw.zoneReaders.includes(0x48))
          fail('items', 'the class readers were not found (the stone door, the stairs to ChangeZone, the bomb writing): ' + pw.readers.length);
        else {
          ctx.propWordData(1, '7');
          html = walk(REGISTRY.get('sheetGrid'));
          if (!/Data1 is the enchantment/.test(html) || !/counts as magical/.test(html) || !/then Data1 <b[^>]*>7<\/b> in decimal/.test(html))
            fail('items', 'the mace at Data1 7 does not say the byte is its enchantment and what the cheat asks for');
          else {
            ctx.showItemDetail(95); ctx.propWordData(1, '3');
            html = walk(REGISTRY.get('sheetGrid'));
            if (!/Examine says “It has an extremely sharp edge\.”/.test(html)) fail('items', 'the dagger at Data1 3 does not quote its Examine line');
            else if (!/never reads its aspect<\/b>: at any aspect it is the same dagger in every number/.test(html)) fail('items', 'the dagger’s page does not say its class never reads the aspect');
            else if ((function () { ctx.renderItemSheet(); const h = walk(REGISTRY.get('sheetGrid')); return !/Weapons &amp; armour<\/span><span class="groupNote">The class script has a combat member: Melee Weapon, Thrown Weapon, Armor Value, Ammunition, Ranged Weapon, Shield\./.test(h) || !/Containers<\/span><span class="groupNote">The class script answers Is Container or has Lockable\./.test(h) || !/Carried goods<\/span><span class="groupNote">The rest of what the file treats as an item/.test(h); })()) fail('items', 'the Items dividers do not say what puts an item under each');
            else if ((function () { ctx.showItemDetail(213); ctx.propWordSet(1); const h = walk(REGISTRY.get('sheetGrid')); return !/reads its aspect<\/b> \(2 places\)/.test(h) || !/Eaten, it feeds <b[^>]*>\+8<\/b> and says “Yetch!”/.test(h); })()) fail('items', 'the mushroom steak at aspect 1 does not say its class reads the aspect and what the dried jellyfish feeds and says');
            else if ((function () { ctx.showItemDetail(0x1F); ctx.propWordSet(4); const h = walk(REGISTRY.get('sheetGrid')); return !/Drunk, it is the <b[^>]*>Antidote Potion<\/b>: clears Poisoned/.test(h); })()) fail('items', 'the potion at aspect 4 does not name the Antidote');
            else console.log(`  items: the word block reads the mace at 8 as 0x205E the flail, the spear reaches it at 2; Data1 is the enchantment (${pw.scripts} scripts read the bytes, ${pw.readers.length} classes), one placed sword carries 7`);
          }
        }
      }
    }
  }
} catch (e) { fail('items', e); }

// Galleries decode lazily now, so "the cells exist" is no longer evidence that
// anything was decoded. Check the tally the gallery itself reports.
try {
  ctx.showCategory('141');
  const line = REGISTRY.get('output').textContent;
  const m = /Gallery: (\d+) decoded, (\d+) errors/.exec(line);
  if (!m) fail('lazy gallery', 'no decode tally in: ' + line.slice(0, 90));
  else if (Number(m[1]) === 0) fail('lazy gallery', 'no tile was decoded — is the observer firing? ' + line.slice(0, 90));
  else if (/still off screen/.test(line)) fail('lazy gallery', 'tiles left undecoded: ' + line.slice(0, 90));
  else console.log(`  lazy gallery: ${m[1]} tiles decoded, ${m[2]} errors, none left pending`);
} catch (e) { fail('lazy gallery', e); }

// The resource fork: the other half of the Cythera Data file. Its Delver-only
// types need this viewer's tile system to mean anything, which is why they are
// here rather than in resource_fork_browser.html.
if (!rsrcFork) {
  console.log('  resource fork: not extracted beside the data fork — skipped');
} else try {
  const fork = ctx.CYTHERA_RSRC;
  if (!fork) fail('resource fork', 'was passed in but never opened');
  else {
    const inv = ctx.rsrcInventory();
    const list = ctx.rsrcPatternList();
    if (!list.length) fail('resource fork', 'no stamps or brushes found');
    else {
      // Every tile of every stamp should resolve to real artwork and have a
      // name in F004 -- that is the check that the format is read right, and it
      // is what distinguishes a decoded stamp from 64 plausible numbers.
      let tiles = 0, drawn = 0, named = 0;
      for (const it of list) {
        for (const t of it.pat.tiles) {
          tiles++;
          const img = ctx.resolveTileImage(t);
          if (img && img.length) drawn++;
          if (ctx.terrainNameFor(t)) named++;
        }
      }
      if (drawn !== tiles) fail('resource fork', `${tiles - drawn} of ${tiles} stamp/brush tiles resolve to no artwork`);
      else if (named !== tiles) fail('resource fork', `${tiles - named} of ${tiles} tiles have no terrain name`);
      else console.log(`  resource fork: ${fork.total()} resources, ${list.length} stamps and brushes, ` +
                       `all ${tiles} tiles resolve and are named`);
      // The gallery, and a detail view reachable by URL.
      ctx.showCategory('RSRC');
      const galleryText = REGISTRY.get('output').textContent || '';
      if (!/Resource fork: /.test(galleryText)) fail('resource fork', 'gallery said: ' + galleryText.slice(0, 80));
      const stamp = list.find(i => i.type === 'eSTM');
      ctx.location.hash = `#c=RSRC&d=rsrc:eSTM:${stamp.entry.id}`;
      if (!ctx.applyDeepLink()) fail('resource fork', 'the deep link to a stamp was not applied');
      else if (!ctx.DETAIL_VIEW || ctx.DETAIL_VIEW.id !== 'eSTM:' + stamp.entry.id)
        fail('resource fork', 'deep link landed on ' + JSON.stringify(ctx.DETAIL_VIEW));
      else console.log(`  resource fork: #c=RSRC&d=rsrc:eSTM:${stamp.entry.id} reopens that stamp`);
      ctx.location.hash = '';

      // The rest of the fork -- the ordinary Mac types, decoded by
      // js/mac-rsrc-types.js. A gallery that quietly decodes nothing looks
      // exactly like one that works, so count what came back rather than
      // trusting that the view rendered.
      let drawable = 0, textual = 0, undecoded = 0;
      for (const it of ctx.macRsrcList(fork)) {
        const arts = ctx.rsrcArtifacts(fork, it.type, it.entry);
        if (arts.some(a => a.canvas && a.canvas.width)) drawable++;
        else if (arts.some(a => a.text)) textual++;
        else undecoded++;
      }
      if (!drawable || !textual)
        fail('mac resources', `${drawable} drawable, ${textual} textual — a decoder set this empty is broken`);
      else console.log(`  mac resources: ${drawable} drawn, ${textual} read as text, ` +
                       `${undecoded} with no decoder for their type`);
      ctx.showCategory('MACRSRC');
      const macText = REGISTRY.get('output').textContent || '';
      if (!/resource fork: /.test(macText)) fail('mac resources', 'gallery said: ' + macText.slice(0, 80));
      // Grouped by kind: a heading per kind that has members, in the
      // table's order, and every type in the fork accounted for.
      const heads = (REGISTRY.get('sheetGrid').children || []).filter(c => c.className === 'propHead').map(c => c.textContent);
      if (heads.length < 5) fail('mac resources', 'the fork gallery is not grouped by kind: ' + heads.join(' / '));
      else console.log('  mac resources: grouped as ' + heads.map(h => h.split(' (')[0]).join(', '));
      // The page's own face, from the file: sfntToTrueType has run on the
      // fork's sfnt and produced a font with the table a browser insists on.
      const ttf = ctx.GAME_FONT_TTF;
      if (!ttf || !ttf.length) fail('game font', 'no TrueType was made from the fork: ' + ctx.GAME_FONT_STATE);
      else {
        const n = (ttf[4] << 8) | ttf[5]; const tags = [];
        for (let i = 0; i < n; i++) { const p = 12 + i * 16; tags.push(String.fromCharCode(ttf[p], ttf[p + 1], ttf[p + 2], ttf[p + 3])); }
        const sorted = tags.every((t, i) => !i || tags[i - 1] < t);
        // And a Unicode cmap subtable: the resource has only a Mac Roman one,
        // and a browser given that alone drew ASCII and lost the rest.
        const ci = tags.indexOf('cmap');
        const cp = ci >= 0 ? ((ttf[12 + ci*16 + 8] << 24) | (ttf[12 + ci*16 + 9] << 16) | (ttf[12 + ci*16 + 10] << 8) | ttf[12 + ci*16 + 11]) >>> 0 : -1;
        let unicode = false;
        if (cp >= 0) { const nsub = (ttf[cp + 2] << 8) | ttf[cp + 3]; for (let i = 0; i < nsub; i++) if (((ttf[cp + 4 + i*8] << 8) | ttf[cp + 5 + i*8]) === 3) unicode = true; }
        if (!tags.includes('OS/2') || !tags.includes('glyf') || !sorted || !unicode) fail('game font', 'tables ' + tags.join(' ') + (unicode ? '' : ', no Unicode cmap'));
        else console.log(`  game font: ${ttf.length} bytes, ${n} tables in order, OS/2 and a Unicode cmap added`);
      }
      // The editor's zone list, out of STR# 135, names the maps the scripts
      // only describe -- and by the map number, not the list index.
      const ez = ctx.loadEditorZoneNames();
      if (ez[3] !== 'LKH' || !/Tomb/.test(ez[25] || '') || ez[1] !== 'World')
        fail('editor zone names', 'misaligned: 1=' + ez[1] + ' 3=' + ez[3] + ' 25=' + ez[25]);
      else console.log(`  editor zone names: ${Object.keys(ez).length} maps named; 0x8019 is “${ez[25]}” beside the script's “${ctx.zoneNameFor(0x8019)}”`);
      // The two-fork views draw from this fork alone when the application's
      // is not here, and say so rather than drawing nothing.
      for (const v of ['SCREENS', 'FONTS', 'STRINGS']) {
        ctx.showCategory(v);
        const cells = (REGISTRY.get('sheetGrid').children || []).filter(c => c.className === 'cell').length;
        const txt = REGISTRY.get('output').textContent || '';
        if (!cells || !/Cythera Data/.test(txt)) fail('fork view ' + v, cells + ' cells; said: ' + txt.slice(0, 90));
      }
      const pict = ctx.macRsrcList(fork).find(i => i.type === 'PICT');
      ctx.location.hash = `#c=MACRSRC&d=macrsrc:PICT:${pict.entry.id}`;
      if (!ctx.applyDeepLink()) fail('mac resources', 'the deep link to a PICT was not applied');
      else if (!ctx.DETAIL_VIEW || ctx.DETAIL_VIEW.id !== 'PICT:' + pict.entry.id)
        fail('mac resources', 'deep link landed on ' + JSON.stringify(ctx.DETAIL_VIEW));
      else console.log(`  mac resources: #c=MACRSRC&d=macrsrc:PICT:${pict.entry.id} reopens that picture`);
      ctx.location.hash = '';
    }
  }
} catch (e) { fail('resource fork', e); }

// Roofs: a toggle that draws nothing is indistinguishable from a toggle that
// works, so check the tile count the layer reports rather than that it ran.
try {
  ctx.showCategory('127');
  let roofed = 0, tiles = 0;
  for (const [resid] of (ctx.CUR_RESIDS || [])) {
    ctx.openResource(resid);
    const cm = ctx.CUR_MAP;
    if (!cm || !cm.roofSections || !cm.roofSections.length) continue;
    roofed++;
    ctx.toggleRoofs(true);
    tiles += cm.roofTilesDrawn || 0;
    if (!cm.roofTilesDrawn) fail('roofs', `0x${resid.toString(16).toUpperCase()} has ` +
      `${cm.roofSections.length} roof sections but drew no tiles`);
    ctx.toggleRoofs(false);
    if (cm.roofTilesDrawn) fail('roofs',
      `0x${resid.toString(16).toUpperCase()} still drew ${cm.roofTilesDrawn} roof tiles with the toggle off`);
  }
  if (!roofed) fail('roofs', 'no map reported any roof sections');
  else console.log(`  roofs: ${roofed} roofed maps, ${tiles} tiles drawn with the toggle on`);
} catch (e) { fail('roofs', e); }

// Walls off has to actually take walls away. On most indoor maps they are
// prop-list records; on Land King Hall every one of them is a faux prop drawn
// by the terrain tile, which is why the toggle used to do nothing there.
try {
  ctx.showCategory('127');
  let checked = 0, noop = [];
  for (const [resid] of (ctx.CUR_RESIDS || [])) {
    ctx.openResource(resid);
    const cm = ctx.CUR_MAP;
    if (!cm) continue;
    const before = cm.propCount;
    ctx.toggleWalls(false);
    const hidden = cm.wallsHidden || 0;
    ctx.toggleWalls(true);
    if (cm.wallsHidden) fail('walls', `0x${resid.toString(16).toUpperCase()} still hid ` +
      `${cm.wallsHidden} squares with the toggle back on`);
    checked++;
    if (!hidden) noop.push('0x' + resid.toString(16).toUpperCase());
  }
  console.log(`  walls: ${checked} maps, ${noop.length} with nothing to hide` +
    (noop.length ? ` (${noop.slice(0, 6).join(', ')}${noop.length > 6 ? '…' : ''})` : ''));
  // Land King Hall specifically: the map the bug was reported against.
  ctx.openResource(0x8003);
  ctx.toggleWalls(false);
  if (!(ctx.CUR_MAP && ctx.CUR_MAP.wallsHidden))
    fail('walls', 'Land King Hall hid no wall squares');
  ctx.toggleWalls(true);
} catch (e) { fail('walls', e); }

// Map marks: rings sit on the record's own square, exits include the open
// edges the map header declares, and a rope square is found where there is one.
try {
  ctx.showCategory('127');
  ctx.openResource(0x8002);                       // Odemia: all four edges open
  const edges = ctx.mapExitEdges(0x8002, ctx.CUR_MAP.m);
  if (edges.length !== 4) fail('map marks', `Odemia reported ${edges.length} open edges, expected 4`);
  if (edges.some(e => !e.cells.length)) fail('map marks', 'an open edge marked no squares');
  if (ctx.mapExitSquares(0x8000).length > 32)
    fail('map marks', 'zoneport padding is still being read as exits on 0x8000');
  const ropes = ctx.ropeSquares(0x8008);          // Cademia
  if (ropes.size !== 2) fail('map marks', `Cademia reported ${ropes.size} rope squares, expected 2`);
  for (const kind of ['doors', 'secret', 'chest', 'exits']) ctx.toggleMapMarks(kind, true);
  for (const [resid] of (ctx.CUR_RESIDS || []).slice(0, 12)) ctx.openResource(resid);
  const legend = REGISTRY.get('markLegend').innerHTML;
  if (!/hidden ways/.test(legend)) fail('map marks', 'the legend never mentioned hidden ways');
  for (const kind of ['doors', 'secret', 'chest', 'exits']) ctx.toggleMapMarks(kind, false);
  console.log('  map marks: edges, zoneports, ropes and the legend all reported');
} catch (e) { fail('map marks', e); }

// The selected square has to be visible, not just described, and leaving a map
// and coming back has to land where you left off rather than re-fitting.
try {
  ctx.showCategory('127');
  ctx.openResource(0x8003);
  drainRaf();
  ctx.inspectMapSquare(41, 12);
  if (!ctx.MAP_SEL || ctx.MAP_SEL.tx !== 41) fail('map selection', 'clicking a square set no selection');
  const remembered = ctx.MAP_VIEW_MEMORY[0x8003];
  if (!remembered) fail('map selection', 'opening a map remembered no view for it');
  const zoomed = { ...remembered, scale: remembered.scale * 2 };
  ctx.MAP_VIEW_MEMORY[0x8003] = zoomed;
  ctx.openResource(0x8008); drainRaf();           // go somewhere else
  ctx.openResource(0x8003); drainRaf();           // and back
  if (!ctx.MAP_SEL_MEMORY[0x8003] || ctx.MAP_SEL_MEMORY[0x8003].tx !== 41)
    fail('map selection', 'switching maps threw away the remembered selection');
  if (!ctx.MAP_VIEW_MEMORY[0x8003]) fail('map selection', 'the remembered view was lost');
  else if (Math.abs(ctx.MAP_VIEW_MEMORY[0x8003].scale - zoomed.scale) > 1e-6)
    fail('map selection', 'coming back to a map re-fitted it instead of restoring the zoom');
  ctx.inspectMapSquare(41, 12);
  ctx.clearMapInspector();
  if (ctx.MAP_SEL) fail('map selection', 'closing the inspector left the selection behind');
  if (ctx.MAP_SEL_MEMORY[0x8003]) fail('map selection', 'closing the inspector did not forget the square');
  console.log('  map selection: set, remembered across a map switch, and cleared on close');
} catch (e) { fail('map selection', e); }

// A frame block ends at the next prop type's base tile in the sheet (the
// prop-tile table's own boundary, since 20 September 2026), not at the
// sheet's end: prop 0x141 is four crystal balls, and the board, the staves
// and the paintings after them on the sheet are other prop types' frames.
// Until then the block ran to the sheet's end and this pinned the four runs
// by name; the gecko's page showed the sylph's frames that way.
try {
  const base = ctx.getPropTileList()[0x141];
  const info = ctx.spriteFrameInfo(0, 0x141);
  if (info.slots !== 4) fail('frame runs', `0x141 claimed ${info.slots} slots, not the four to the next prop type's base`);
  const runs = ctx.frameRuns(base, info.present);
  const names = runs.map(r => r.name).join('/');
  if (names !== 'crystal ball')
    fail('frame runs', `0x141 came out as ${names}`);
  const own = ctx.framesSharingName(base, ctx.spriteFrameInfo(0, 0x141).present);
  if (own.length !== 4) fail('frame runs', `0x141 claimed ${own.length} frames of its own`);
  const cols = ctx.distinguishingColours(base, own);
  if (!cols || new Set([...cols.values()]).size < 3)
    fail('frame runs', 'the four crystal balls were not told apart by colour');
  console.log(`  frame runs: 0x141 -> ${names}; balls are ${[...cols.values()].join(', ')}`);
} catch (e) { fail('frame runs', e); }

// A filter box on every gallery, filtering by what the cells actually say.
try {
  for (const cat of ['135', '141', 'ITEMS', 'CHARACTERS']) {
    ctx.showCategory(cat);
    const grid = REGISTRY.get('sheetGrid');
    const all = (grid.children || []).filter(c => c.className && c.className.includes('cell')).length;
    if (!all) continue;
    ctx.setPropFilter('zzzznothing');
    const after = (REGISTRY.get('sheetGrid').children || [])
      .filter(c => c.className && c.className.includes('cell') && c.style.display !== 'none').length;
    if (after) fail('gallery filter', `${cat}: ${after} cells survived a nonsense filter`);
    ctx.setPropFilter('');
    const back = (REGISTRY.get('sheetGrid').children || [])
      .filter(c => c.className && c.className.includes('cell') && c.style.display !== 'none').length;
    if (!back) fail('gallery filter', `${cat}: clearing the filter brought nothing back`);
  }
  console.log('  gallery filter: every gallery filters and unfilters');
} catch (e) { fail('gallery filter', e); }

// The map inspector: every square a prop was drawn on must name that prop.
try {
  ctx.showCategory('127');
  const maps = (ctx.CUR_RESIDS || []).slice(0, 8);
  let mapsWithProps = 0, probes = 0, named = 0, withPeople = 0;
  for (const [resid] of maps) {
    ctx.openResource(resid);
    const cm = ctx.CUR_MAP;
    if (!cm || !cm.props || !cm.props.length) continue;
    mapsWithProps++;
    for (const p of cm.props.slice(0, 20)) {
      const [tx, ty] = p.cells[0];
      ctx.inspectMapSquare(tx, ty);
      const html = REGISTRY.get('mapInspect').innerHTML;
      probes++;
      if (html.includes('record ' + p.rec.index)) named++;
      if (html.includes('Dossier')) withPeople++;
    }
  }
  // v1.45.0: a link that names a coordinate lands on it -- centred, ringed,
  // and zoomed to a legible square -- once the map has settled, whichever
  // path opened it. The stub queues animation frames without running them,
  // so the opener's stamp never arrives here and the landing takes the
  // fallback wait, which is the case a map opened by another path is in.
  {
    ctx.showSquareOnMap(0x8001, 10, 12);
    await new Promise(r => setTimeout(r, 1500));
    const sel = ctx.__peek('window.MAP_SEL'), cm = ctx.__peek('window.CUR_MAP');
    const sc = ctx.__peek('mapView.scale');
    if (!cm || cm.resid !== 0x8001 || !sel || sel.tx !== 10 || sel.ty !== 12 || sc * cm.TS < 20)
      fail('map landing', 'showSquareOnMap did not land on (10,12) of 0x8001 at a legible zoom: ' + JSON.stringify([cm && cm.resid, sel, sc, cm && cm.TS]));
    else console.log(`  map landing: 0x8001 (10,12) ringed at ${Math.round(sc * cm.TS)} px a square`);
  }
  // v1.48.0: a grid on the Zones tab, drawn on the mark layer.
  // The mark layer is drawn for the landing's ring whatever the grid says,
  // so the check counts the grid's own line starts: a square edge per row
  // and column when it is on, none of them when it is off.
  {
    const cm = ctx.__peek('window.CUR_MAP');
    const count = on => {
      ctx.toggleMapMarks('grid', on);
      const mc = ctx.document.getElementById('markLayer');
      if (!mc) return -1;
      const c = mc.getContext('2d'); let n = 0; const orig = c.moveTo; c.moveTo = function () { n++; };
      ctx.drawMapMarks(); c.moveTo = orig; return n;
    };
    const off = count(false), on = count(true), want = Math.round(cm.width / cm.TS) + Math.round(cm.height / cm.TS) + 2;
    ctx.toggleMapMarks('grid', false);
    if (on - off < want) fail('map grid', 'the grid did not draw a line per square edge: ' + JSON.stringify({ off, on, want }));
    else console.log('  map grid: ' + (on - off) + ' line starts over ' + Math.round(cm.width / cm.TS) + 'x' + Math.round(cm.height / cm.TS) + ' squares, none with it off');
  }
  if (!mapsWithProps) fail('map inspector', 'no map reported any props');
  else if (named !== probes) fail('map inspector', `${probes - named} of ${probes} squares did not name their prop`);
  else console.log(`  map inspector: ${probes} prop squares on ${mapsWithProps} maps, all named`);

  // Characters stand where their schedule puts them, which is not where the
  // prop list puts anything, so they need their own probe.
  let peopleProbes = 0, peopleNamed = 0, peopleFaced = 0;
  for (const [resid] of maps) {
    ctx.openResource(resid);
    const cm = ctx.CUR_MAP;
    if (!cm) continue;
    const people = ctx.charactersOnLevel(cm.level, 12);
    for (const c of people.slice(0, 8)) {
      ctx.inspectMapSquare(Math.round(c.x), Math.round(c.y));
      const html = REGISTRY.get('mapInspect').innerHTML;
      peopleProbes++;
      if (html.includes('Dossier') && html.includes('showCharacterDetail(' + c.index + ')')) peopleNamed++;
      if (html.includes('class="inspFace"')) peopleFaced++;
    }
  }
  if (!peopleProbes) fail('map inspector', 'no scheduled characters found on any of the first maps');
  else if (peopleNamed !== peopleProbes) fail('map inspector', `${peopleProbes - peopleNamed} of ${peopleProbes} inhabited squares did not link the character`);
  else if (!peopleFaced) fail('map inspector', 'no inhabited square showed the character’s portrait');
  else console.log(`  map inspector: ${peopleProbes} inhabited squares, all linked to their dossier, ${peopleFaced} with a portrait`);
  // A square outside everything must say so rather than throw.
  ctx.inspectMapSquare(0, 0);
  ctx.clearMapInspector();
} catch (e) { fail('map inspector', e); }

// Deep links round-trip: a URL must reopen exactly what it named.
try {
  ctx.showCategory('135');
  ctx.openResource(0x8801);
  const link = ctx.currentSelectedResid();
  if (link !== 0x8801) fail('deep link', 'selected resid came back as ' + link);

  ctx.showCategory('144');                       // somewhere else entirely
  ctx.location.hash = '#c=135&r=8801';
  if (!ctx.applyDeepLink()) fail('deep link', '#c=135&r=8801 was not applied');
  else if (ctx.currentSelectedResid() !== 0x8801) fail('deep link', 'landed on 0x' + (ctx.currentSelectedResid() || 0).toString(16));

  ctx.location.hash = '#9101';                   // bare id, category unstated
  if (!ctx.applyDeepLink()) fail('deep link', 'bare #9101 was not applied');
  else if (ctx.currentSelectedResid() !== 0x9101) fail('deep link', 'bare id landed on 0x' + (ctx.currentSelectedResid() || 0).toString(16));

  ctx.location.hash = '#c=CHARACTERS&d=char:3';  // a dossier
  if (!ctx.applyDeepLink()) fail('deep link', 'dossier link was not applied');
  else {
    const d = ctx.DETAIL_VIEW;
    if (!d || d.kind !== 'char' || d.id !== 3) fail('deep link', 'dossier state is ' + JSON.stringify(d));
  }
  // Arriving on a link: the archive load itself must honour the hash the page
  // was opened with, not the default category it renders on the way in.
  ctx.location.hash = '#c=144&r=9103';
  ctx.parseArchiveBytes(archive, 'Cythera Data (arrived on a link)', { via: 'data fork' });
  if (ctx.currentSelectedResid() !== 0x9103)
    fail('deep link', 'opening with #c=144&r=9103 landed on 0x' + (ctx.currentSelectedResid() || 0).toString(16));
  ctx.location.hash = '';
} catch (e) { fail('deep link', e); }

/* The listing toggle: is it where the listing is, and does each state change
 * the text?
 *
 * This exists because the maintainer opened the site after the three-state
 * toggle shipped and could not find it, and NOTHING in the suite could say
 * whether it was there. `css_check` had proved its classes were styled,
 * `verify_viewer` that `setScriptFold` was a declared function, and the fold and
 * structure checks that both renderers were right over the whole archive -- and
 * not one of them touched the row of buttons that reaches them. A feature whose
 * every part is checked and whose way in is not is a feature nobody can use.
 *
 * It was there, and it was in the wrong place: a row inside the script view
 * panel, which sits ABOVE the Decoded / Strings / Hex tab bar while the listing
 * it controls is below it. So this asserts WHERE as well as whether -- the row
 * has to be `#listingSwitch`, which is the element between the tab bar and the
 * pane, beside the `Show as` switch that was already there. Checking only that
 * the buttons exist somewhere is what let the first version ship unfindable.
 *
 * And each state must produce DIFFERENT text from the other two, which is the
 * clause with teeth: three buttons that all render the raw listing pass
 * everything else here.
 */
try {
  ctx.showCategory('0');                         // Global Symbols & Scripts
  const first = (ctx.CUR_RESIDS || [])[0];
  if (!first) fail('listing toggle', 'no resource in a script category to open');
  else {
    /* Hide it first and require opening a script to reveal it. The markup says
       `display:none` but the DOM stub does not parse an inline style attribute,
       so a fresh element reads as `''` and a test for `'none'` can never fire --
       which it did not: deleting the line in paintDecodedPane that shows the
       switch failed nothing at all. Setting the sentinel makes the assertion
       about what the page DOES rather than about what it started as. */
    const sw = ctx.document.getElementById('listingSwitch');
    if (!sw) fail('listing toggle', 'there is no #listingSwitch in the markup');
    else {
      // Structured is what a first visit opens on (23 September 2026).
      if (ctx.SCRIPT_FOLD !== 'structured') fail('listing toggle', 'the listing a visit opens on is ' + ctx.SCRIPT_FOLD + ', not structured');
      sw.style.display = 'none';
      ctx.openResource(first[0]);
      if (sw.style.display === 'none')
        fail('listing toggle', 'opening a script does not reveal the listing switch');
      // Folded left the row the same day; its renderer stays under Structured.
      for (const id of ['listStructured', 'listRaw', 'listHex'])
        if (!ctx.document.getElementById(id)) fail('listing toggle', 'no #' + id + ' button');

      const texts = {};
      for (const mode of [false, 'structured']) {
        ctx.setScriptFold(mode);
        texts[String(mode)] = ((ctx.LAST_DECODED && ctx.LAST_DECODED.text) || '');
        const want = mode === false ? 'listRaw' : 'listStructured';
        for (const id of ['listRaw', 'listStructured']) {
          const b = ctx.document.getElementById(id);
          const on = b && b.className && /\bactive\b/.test(b.className);
          if ((id === want) !== !!on)
            fail('listing toggle', id + ' active is ' + !!on + ' with ' + String(mode) + ' in hand');
        }
      }
      ctx.setScriptFold(false);
      const [raw, structured] = [texts['false'], texts['structured']];
      if (!raw.trim() || !structured.trim()) fail('listing toggle', 'a listing came out empty');
      if (raw === structured) fail('listing toggle', 'the structured listing is identical to the raw one');

      /* And it must be out of sight for a resource that is not a script, or it
         is a control over nothing. Effective visibility, not its own `display`:
         a tile sheet hides the whole `#textPreview` around it, which is how the
         `Show as` switch beside it has always gone away, and asserting the inner
         element's own style reported a fault that was not one. */
      ctx.showCategory('141');
      const tile = (ctx.CUR_RESIDS || [])[0];
      if (tile) {
        ctx.openResource(tile[0]);
        const s2 = ctx.document.getElementById('listingSwitch');
        const host = ctx.document.getElementById('textPreview');
        const hidden = (s2 && s2.style.display === 'none') || (host && host.style.display === 'none');
        if (!hidden) fail('listing toggle', 'the listing switch is still on screen for a tile sheet');
      }
    }
  }
} catch (e) { fail('listing toggle', e); }

/* A script's page, as the Functions tab shows it (22 September 2026). Four
 * things, each of which shipped broken with every other check green:
 *
 *   - Leaving the World for a numbered gallery gives the panel back. The
 *     category change drew the gallery without passing setMode, which is
 *     where the atlas used to be put away, so the tab lit and the world stayed
 *     on screen. The sentinel is set here because the stub reads no stylesheet
 *     and no inline style attribute: without it `display` is '' whatever the
 *     page does, and the assertion could not fail.
 *   - Under Functions a script opens on its code, under Text on its words,
 *     and a script's only control is the one row above whichever is showing.
 *     Nearly every script subindex can hold dialogue, and every one of them
 *     opened on its strings with the code behind a button and three rows of
 *     switches standing over no pane.
 *   - A line ringed from a figure is ringed in the folded listing too. The
 *     ring read only the raw gutter, and the listing chosen is remembered.
 *   - The folded listings link the resources they call. They spell a call
 *     `0x904(...)` or `CastSpell(...)`, which the raw listing's patterns never
 *     matched, so the Linked switch did nothing in two of its three states.
 */
try {
  const ap = ctx.document.getElementById('atlasPanel');
  ap.style.display = 'block';
  ctx.showCategory('8');
  if (ap.style.display !== 'none') fail('script page', 'opening a gallery from the World leaves the world on screen');

  const shown = id => ctx.document.getElementById(id).style.display !== 'none';
  ctx.setScriptFold(false);
  ctx.showCategory('25');                        // Functions > Actions, the skills and spells
  ctx.openResource(0x1A13);                      // Awaken, which has words of its own
  if (!shown('textContent') || shown('dlgWrap'))
    fail('script page', 'a script under Functions does not open on its code');
  if (shown('viewTabs')) fail('script page', 'a script shows the Decoded / Strings / Hex bar beside its own row');
  if (!ctx.document.getElementById('dlgWrap').innerHTML) fail('script page', 'Awaken has no Text to switch to');
  ctx.setScriptPane('text');
  if (shown('textContent') || !shown('dlgWrap')) fail('script page', 'the Text button does not show the words');
  ctx.jumpToResource(0x180B);                    // Naxos, under Text > Dialogue
  if (!shown('dlgWrap') || shown('textContent'))
    fail('script page', 'a conversation under Text does not open on its words');
  const head = ctx.document.getElementById('scriptView');
  if (!/0x1(80B|A13)/i.test(head.innerHTML) || head.style.display === 'none')
    fail('script page', 'the script head is not built and shown');

  ctx.setScriptFold('structured');
  ctx.jumpToScriptAt(0x987, 0x34);
  // The line itself, not only a ring: with the absolute gutter unread, the ring
  // falls back to the function's header line and is still a ring.
  const ringed = /class="listingHit">([^\n]*)/.exec(ctx.document.getElementById('textContent').innerHTML);
  if (!ringed || !/^    0034  /.test(ringed[1]))
    fail('script page', 'the folded listing rings ' + (ringed ? '"' + ringed[1].slice(0, 40) + '"' : 'nothing') + ', not the line at 0x34');
  ctx.setScriptFold('structured');
  const pane = ctx.document.getElementById('textContent').innerHTML;
  if (!/<a class="reflink"[^>]*jumpToResource\(2308\)[^>]*>0x904<\/a>/.test(pane))
    fail('script page', 'the structured listing does not link its call to 0x904');
  ctx.jumpToResource(0x1A13);
  if (!/>CastSpell<\/a>/.test(ctx.document.getElementById('textContent').innerHTML))
    fail('script page', 'the structured listing does not link a named call (CastSpell)');
  /* The view holds from one script to the next until changed (23 September
     2026), and separately where scripts are read for their words: Hex chosen
     among the Functions carries to the next AI action and not to a
     conversation, which opens on its words. */
  ctx.jumpToResource(0x180B);
  ctx.setScriptPane('text');       // a choice made under Text, which Structured above changed
  ctx.jumpToResource(0x987);
  ctx.setScriptPane('hex');
  ctx.navigateResource(1);
  if (!shown('paneHex') || shown('textContent')) fail('script page', 'Hex chosen on one script is not kept for the next');
  ctx.jumpToResource(0x180B);
  if (!shown('dlgWrap')) fail('script page', 'Hex chosen under Functions carried to a conversation under Text');
  ctx.jumpToResource(0x987);
  if (!shown('paneHex')) fail('script page', 'going to Text and back lost the view chosen under Functions');
  ctx.setScriptFold('structured');
  // Its usage rows ("Rules on", "Referenced by") and what it names are below
  // the code, and not in the panel above it as well.
  ctx.jumpToResource(0x987);
  const refs = ctx.document.getElementById('scriptRefs');
  if (!refs || !/Rules on/.test(refs.innerHTML) || !/Names/.test(refs.innerHTML) || refs.style.display === 'none')
    fail('script page', 'what the script belongs to and names is not below the code');
  if (/Rules on/.test(ctx.document.getElementById('artUsage').innerHTML))
    fail('script page', 'a script\'s usage rows are drawn above the code as well');
  /* A reference lands on its line (23 September 2026): Referenced by opens
     the referring script ringed where it makes the reference, a label in the
     listing rings its statement, and a search hit rings the line it matched. */
  const hitLine = () => { const m = /class="listingHit">([^\n]*)/.exec(ctx.document.getElementById('textContent').innerHTML); return m ? m[1] : ''; };
  ctx.jumpToResource(0x904);
  const refJs = /jumpToScriptAt\(2439,(\d+)\)/.exec(ctx.document.getElementById('scriptRefs').innerHTML);
  if (!refJs) fail('script page', 'Referenced by 0x987 on 0x904 does not open the line that makes the call');
  else {
    ctx.jumpToScriptAt(0x987, +refJs[1]);
    if (!/0x904/.test(hitLine())) fail('script page', 'Referenced by rings "' + hitLine().slice(0, 50) + '", not the call to 0x904');
  }
  /* 0x987's loop reads as a for-each since 22 September 2026: its goto to the
     iterator's step is a continue, its goto out of the loop a break, and the
     step's offset is on the closing brace, so a ring on it lands there and not
     on the break before it. */
  const t987 = ctx.document.getElementById('textContent').innerHTML;
  if (!/\n    001A  for Var01 in Worn\(Arg01\) \{\n/.test(t987) ||
      !/\n    0034      if \(!\(Arg01 has MeleeWeapon\)\) (<a [^>]*>)?continue(<\/a>)?\n/.test(t987) || !/\n    003F      (<a [^>]*>)?break(<\/a>)?\n/.test(t987))
    fail('script page', '0x987 does not read as a for loop with a continue and a break');
  // Each is a link to where it goes: the continue to the step's brace, the
  // break to the statement after the loop.
  if (!/ringListingAt\(66\)[^>]*>continue</.test(t987) || !/ringListingAt\(81\)[^>]*>break</.test(t987))
    fail('script page', 'the continue and break in 0x987 are not links to 0x42 and 0x51');
  ctx.ringListingAt(0x51);
  if (!/^    0051  if/.test(hitLine())) fail('script page', 'following the break in 0x987 rings "' + hitLine().slice(0, 50) + '"');
  ctx.ringListingAt(0x42);
  if (!/^    0042  \}/.test(hitLine())) fail('script page', 'a ring on the step of 0x987 lands on "' + hitLine().slice(0, 50) + '", not the closing brace');
  /* A number the file or the page can name is named in a comment at the end of
     its line: a sound, with a link to it; a To Do line, read in the array
     AddQuest points into (Ake, 0x1820, has slot 10 show line 114, which is
     the scenario's own slip); a status flag. And a negative byte is printed as the
     negative number it is, as the raw listing's note says. */
  ctx.jumpToResource(0x1A00);
  const t1A00 = ctx.document.getElementById('textContent').innerHTML;
  if (!/PlaySound\(48, [^\n]*\/\/ sound 48[^\n]*jumpToResource\(37168\)/.test(t1A00))
    fail('script page', 'the sound in 0x1A00 is not named in a comment with a link to 0x9130');
  // The wiki's label for 0x9130 and the board's name for status flag 9 are
  // tables typed into the page, and must not reach these comments.
  // A zoneport by the title its zone's entry script sets, a prop type by the
  // file's name for its base tile (0xF004).
  ctx.jumpToResource(0x1001);
  if (!/teleport\(13, 141, 0\)   \/\/ zoneport 141: Cythera/.test(ctx.document.getElementById('textContent').innerHTML))
    fail('script page', 'the zoneport 0x1001 changes to is not named from the file');
  ctx.jumpToResource(0xD09);
  if (!/addinv\(Arg00, 130, [^\n]*\/\/ prop type 130: obol/.test(ctx.document.getElementById('textContent').innerHTML))
    fail('script page', 'the prop type 0xD09 creates is not named from the file');
  ctx.setBuiltinLabels(true);
  for (const rid of [0x1A00, 0xA04]) {
    ctx.jumpToResource(rid);
    const t = ctx.document.getElementById('textContent').innerHTML;
    if (/\/\/[^\n]*(poison|Directed Nexus)/.test(t)) fail('script page', 'a hand-typed name reached a comment in 0x' + rid.toString(16));
  }
  ctx.jumpToResource(0x1820);
  if (!/AddToDo\(10, [^\n]*\/\/ To Do 10: (&quot;|")Ask Thuria about Iron Mine/.test(ctx.document.getElementById('textContent').innerHTML))
    fail('script page', 'the To Do line Ake (0x1820) adds is not named');
  /* A member read is named (`class_member 0x3400` is Lockable's first word),
     a resource that is one function is headed with the name its callers use,
     and not linked to itself, and a helper the raw listing leaves as an id is
     called by its id, as a link: 0x98C calls 0xF13. The page's own name for
     that helper (IsMet) was written by hand, and these listings name nothing
     the game's files do not (the maintainer's rule of 22 September 2026). */
  ctx.jumpToResource(0xE49);
  if (!/Arg00\.Lockable\[0\] \* 5/.test(ctx.document.getElementById('textContent').innerHTML))
    fail('script page', 'the door helper 0xE49 does not read its class member as Lockable[0]');
  ctx.jumpToResource(0x987);
  if (!/\nfunction 0x987\(Arg00, Arg01, Arg02\) \{/.test(ctx.document.getElementById('textContent').innerHTML))
    fail('script page', '0x987 is not headed function 0x987(...), the name its callers use');
  ctx.jumpToResource(0x98C);
  if (!/jumpToResource\(3859\)[^>]*>0xF13</.test(ctx.document.getElementById('textContent').innerHTML))
    fail('script page', '0x98C does not call 0xF13 by its id, as a link');
  ctx.jumpToResource(0x1403);
  if (!/SetAmbientLight\(-128\)/.test(ctx.document.getElementById('textContent').innerHTML))
    fail('script page', 'a negative byte in 0x1403 is not printed as a negative number');
  /* A goto that is left is a link to its label, and the label is printed even
     where it heads an if: 0x812's L0488 was one of 94 printed nowhere. */
  ctx.jumpToResource(0x812);
  const t812 = ctx.document.getElementById('textContent').innerHTML;
  if (!/ringListingAt\(1160\)[^>]*>L0488</.test(t812)) fail('script page', 'goto L0488 in 0x812 is not a link to its label');
  if (!/\n  L0488:\n    0488          if \(/.test(t812)) fail('script page', 'the label L0488 over an if in 0x812 is not printed');
  ctx.ringListingAt(0x488);
  if (!/^    0488  /.test(hitLine())) fail('script page', 'following L0488 rings "' + hitLine().slice(0, 50) + '"');
  // Searched by delvmod's name, found and ringed by the program's.
  REGISTRY.get('searchBox').value = 'EquipmentIterator';
  ctx.runSearch();
  await new Promise(r => setTimeout(r, 300));     // runSearch draws on a timer
  const sres = /onclick="jumpToScriptAt\((\d+),(\d+)\)"[^>]*>([^<]*Worn)/.exec(REGISTRY.get('searchResults') ? REGISTRY.get('searchResults').innerHTML : '');
  if (sres) {
    ctx.jumpToScriptAt(+sres[1], +sres[2]);
    if (!/Worn/.test(hitLine())) fail('script page', 'a search hit rings "' + hitLine().slice(0, 50) + '", not its line');
  } else fail('script page', 'a search hit for EquipmentIterator is not a link to its line');

  /* A gallery read for its code is a list of rows: name, id, and what the
     code calls. The row keeps .lbl and .resid, which the filter reads. */
  ctx.showCategory('8');
  const grid = ctx.document.getElementById('sheetGrid');
  const rows = grid.children.filter ? grid.children.filter(c => /scriptRow/.test(c.className)) : [];
  if (!/scriptList/.test(grid.className) || rows.length < 19)
    fail('script page', 'the combat AI tests and actions are not a list of rows (' + rows.length + ')');
  else if (!/\bWorn\b/.test(rows.map(r => r.textContent || (r.innerHTML || '')).join(' ') + grid.innerHTML))
    fail('script page', 'a row does not say what its code calls');
  ctx.showCategory('23');
  if (/scriptList/.test(ctx.document.getElementById('sheetGrid').className))
    fail('script page', 'the conversations under Text lost their tiles for the list');
  console.log('  script page: the World gives the panel back, code first under Functions and words under Text, the view kept from one script to the next, rings and links in the structured listing, what names it below the code, the gallery a list');
} catch (e) { fail('script page', e); }

/* Landscape strips and who sets them, 22 September 2026. SetLandscapeImage
   negates a negative argument into a strip with no sky (cbSetZonePic), so
   the strips named only by a negative number -- 1 for Land King Hall, 12,
   13, 15 -- are used, and the old reading, which matched the signed number,
   called them unused. The control is strip 17, which nothing sets. */
try {
  const set = n => ctx.landscapeZones(0x8400 + n);
  const lkh = set(1);
  if (!lkh.length || lkh.some(s => s.sky) || !/Land King Hall/.test(ctx.landscapeSetterName(lkh[0].resid)))
    fail('landscapes', 'strip 1 is not set by Land King Hall with no sky: ' + JSON.stringify(lkh));
  else if (![12, 13, 15].every(n => set(n).length) || set(17).length)
    fail('landscapes', 'strips 12, 13 and 15 should be set and 17 not: ' + [12, 13, 15, 17].map(n => n + '=' + set(n).length).join(' '));
  else if (!(set(9).some(s => s.sky) && set(9).some(s => !s.sky)))
    fail('landscapes', 'strip 9 is set both over the sky and without it, and was not read so');
  else console.log('  landscapes: strip 1 is Land King Hall with no sky, 12, 13 and 15 are set, 17 by nothing, 9 both ways');
} catch (e) { fail('landscapes', e); }

/* The engine's draw passes, 22 September 2026 (enginePass). In Land King
   Hall the carpet runner at (42,18) is record 737 and the archway it runs
   under is 709, so list order drew the carpet over the arch; the carpet is
   flat (pass 0) and the arch tall (pass 5). On the world the arch into the
   hall at (163,20) stands on a mountain whose faux prop was drawn after
   every record; the mountain is flat too. Both fail under the old order. */
try {
  const props = ctx.renderMapUncached(0x8003).result.props;
  const at = (x, y, pt) => props.findIndex(d => d.rec.x === x && d.rec.y === y && d.rec.proptype === pt);
  const rug = at(42, 18, 0x0F), arch = at(43, 18, 0x08);
  const fx = ctx.getFauxProps(), tl = ctx.getPropTileList();
  const wm = ctx.renderMapUncached(0x8001).result;
  const mt = fx.get(ctx.mapTileAt(wm.m, 163, 20));
  const archRec = wm.props.find(d => d.rec.x === 163 && d.rec.y === 20);
  if (rug < 0 || arch < 0 || rug > arch) fail('draw passes', `the carpet at (42,18) is drawn at ${rug}, the archway at ${arch}: the carpet must go first`);
  else if (!mt || !archRec || !(ctx.enginePass(tl[mt.proptype] + mt.aspect, 0, false) < archRec.pass))
    fail('draw passes', 'the mountain under the arch at (163,20) is not in an earlier pass than the arch');
  else console.log('  draw passes: Land King Hall\'s carpet goes under its arch, the world\'s mountain under the arch into the hall');
} catch (e) { fail('draw passes', e); }

/* Square by square, and last first, 23 September 2026 (propPieceList,
   renderMapVisual). TViewer::Render tests each square of a prop against its
   own tile's pass and walks its list from the end. Cademia's pool at
   (61,58), record 49, and the pillar at (62,57), record 1923, both have
   their corners in pass 1; the pillar's other three squares are tall. So
   the pillar's corner goes before the pool's (the later record first), and
   its top after the whole pool, which is how the game shows it (the
   maintainer). The page drew the pillar whole in its corner's pass until
   then, and records first first; each of those fails one half of this. */
try {
  const ops = ctx.renderMapUncached(0x8008).result.drawOps;
  const at = (i, x, y) => ops.findIndex(op => op.d.i !== undefined && op.d.rec.index === i && op.x === x && op.y === y);
  const pillarFoot = at(1923, 62, 57), pillarTop = at(1923, 61, 57), pool = at(49, 61, 58), poolLast = ops.map(op => op.d.rec.index).lastIndexOf(49);
  if ([pillarFoot, pillarTop, pool].some(v => v < 0)) fail('draw order', 'Cademia\'s pool or pillar is not drawn: ' + [pillarFoot, pillarTop, pool]);
  else if (!(pillarFoot < pool)) fail('draw order', `the pillar's corner is drawn at ${pillarFoot}, after the pool's at ${pool}: within a pass the later record goes first`);
  else if (!(pillarTop > poolLast)) fail('draw order', `the pillar's top at (61,57) is drawn at ${pillarTop}, before the pool is finished at ${poolLast}`);
  else console.log('  draw order: Cademia\'s pillar top over its pool, a square at a time, and within a pass the later record first');
} catch (e) { fail('draw order', e); }

/* The game's tile animation, 0xF001 (23 September 2026, tileAnimTable). The
   fountain in Cademia at (48,30) is tile 0x386, which the table runs through
   0x386..0x389 a phase a frame. It stands on a floor that does not cycle, so
   only the table makes its square one the animation repaints (Land King
   Hall's fountains stand in water and cannot show that); drawn at phase 2 it
   is 0x388. The control is the same draw with no phase, which a gallery
   makes: the tile's own art. */
try {
  const tab = ctx.tileAnimTable(), f = tab.get(0x386);
  const r = ctx.renderMapUncached(0x8008).result;
  const drawn = [];
  const realGet = ctx.getTileCanvas;
  ctx.getTileCanvas = function (t) { drawn.push(t); return realGet.apply(this, arguments); };
  const cv = ctx.document.createElement('canvas'); const g = cv.getContext('2d');
  ctx.drawTileAt(g, 0x386, 0, 0, true, 32, 2); ctx.drawTileAt(g, 0x386, 0, 0, true, 32, 0);
  ctx.getTileCanvas = realGet;
  if (tab.size !== 8 || !f || f.first !== 0x386 || f.count !== 4 || f.div !== 1) fail('tile animation', '0xF001 read as ' + JSON.stringify([...tab]));
  else if (!r.animCells.some(([x, y]) => x === 48 && y === 30)) fail('tile animation', 'the fountain square at (48,30) is not repainted');
  else if (!r.animReplay.some(b => b[0] === 0x386)) fail('tile animation', 'the fountain is not replayed over its floor');
  else if (drawn[0] !== 0x388 || drawn[1] !== 0x386) fail('tile animation', 'the fountain at phase 2 and with no phase drew ' + drawn.map(t => t.toString(16)));
  else console.log('  tile animation: 0xF001 animates ' + tab.size + ' tiles; Cademia\'s fountain repaints its square and shows 0x388 at phase 2');
} catch (e) { fail('tile animation', e); }

/* Barks on the map (drawBarks). Twelve characters have lines in their own
   conversation scripts; a vendor standing on a square gets a balloon with
   the cry its script gives it, and somebody with no lines gets none. The
   switch is one setting for the Zones view and the World tab alike. */
try {
  const by = ctx.barksByCharacter();
  const said = [];
  const g = ctx.document.createElement('canvas').getContext('2d');
  const realFill = g.fillText;
  g.fillText = function (t) { said.push(t); return realFill.apply(this, arguments); };
  const vendor = [...by.entries()].find(([, ls]) => ls.length === 1);   // one line, so no rotation to allow for
  const silent = [...Array(200).keys()].find(i => !by.has(i));
  ctx.drawBarks(g, [{ index: vendor[0], x: 5, y: 5 }], 32, 0, 0);
  const one = said.slice(); said.length = 0;
  ctx.drawBarks(g, [{ index: silent, x: 5, y: 5 }], 32, 0, 0);
  const none = said.slice();
  ctx.toggleBarks(false);
  const off = ['chkBarks', 'atlasChkBarks'].every(id => REGISTRY.get(id) && !REGISTRY.get(id).checked) && !peek('window.SHOW_BARKS');
  ctx.toggleBarks(true);
  if (by.size < 10) fail('barks', 'only ' + by.size + ' characters have lines of their own');
  else if (one.join(' ') !== vendor[1][0]) fail('barks', ctx.characterName(vendor[0]) + ' said ' + JSON.stringify(one) + ', not ' + vendor[1][0]);
  else if (none.length) fail('barks', 'character ' + silent + ', who has no lines, said ' + JSON.stringify(none));
  else if (!off) fail('barks', 'the Zones and World switches did not turn off together');
  else console.log('  barks: ' + by.size + ' characters speak their own lines; ' + ctx.characterName(vendor[0]) + ' says "' + one[0] + '", character ' + silent + ' nothing');
} catch (e) { fail('barks', e); }

/* The letter a key wears (itemLetter). The class's member 40 bit 0x04 says
   it can wear one, and byte 6 of the record which: 'A' plus the byte. The
   keys in the scenario wear letters and each key ring label says its own;
   a record of a class without the bit wears none, whatever its byte 6. */
try {
  const { keys } = ctx.buildKeyLockIndex();
  const lettered = keys.filter(k => ctx.itemLetter(k.rec));
  const k = lettered[0];
  const n = k ? (k.rec.d3 >> 8) & 0xFF : 0;
  const plain = Object.assign({}, k ? k.rec : {}, { proptype: 1 });
  if (!ctx.classWearsLetter(66)) fail('key letters', 'the key class does not carry member 40 bit 0x04');
  else if (lettered.length < keys.length / 2) fail('key letters', 'only ' + lettered.length + ' of ' + keys.length + ' keys wear a letter');
  else if (ctx.itemLetter(k.rec) !== String.fromCharCode(65 + n)) fail('key letters', 'a key with byte 6 = ' + n + ' wears ' + ctx.itemLetter(k.rec));
  else if (!ctx.keyLabel(k).includes(' ' + ctx.itemLetter(k.rec) + ' ')) fail('key letters', 'the key ring says ' + ctx.keyLabel(k));
  else if (ctx.classWearsLetter(1) || ctx.itemLetter(plain)) fail('key letters', 'prop type 1 wears a letter');
  else console.log('  key letters: ' + lettered.length + ' of ' + keys.length + ' keys wear one, ' +
                   [...new Set(lettered.map(x => ctx.itemLetter(x.rec)))].sort().join(''));
} catch (e) { fail('key letters', e); }

/* The Read view (dvmReadRender, readViewHtml): a script's functions as
   sentences in the script page's own pane, and the listings back when
   Structured is chosen. Awaken (0x1A13) clears flag 22 on its target and
   prints that it is awoken; both must be said. */
try {
  ctx.jumpToResource(0x1A13);
  ctx.setScriptPane('read');
  const read = REGISTRY.get('textContent').innerHTML;
  const on = REGISTRY.get('listRead') && REGISTRY.get('listRead').classList.contains('active');
  ctx.setScriptFold('structured');
  const back = REGISTRY.get('textContent').innerHTML;
  if (!on || !/readList/.test(read)) fail('read view', 'the Read view did not show on a script');
  else if (!/Remove ability the target, 22/i.test(read) || !/is awoken/.test(read)) fail('read view', 'Awaken\'s UseOn is not said: ' + read.replace(/<[^>]+>/g, ' ').slice(0, 200));
  // A method's first argument is the thing it belongs to, said "it"; a
  // behaviour the game's own Look text names is said with that word; and
  // each function heads with what it does.
  else if (!/UseOn\(it, the target\)/.test(read) || !/145 \(sleeping\)/.test(read) || !/readSum">Cast spell FX, play sound, remove ability/i.test(read))
    fail('read view', 'Awaken is not read with "it", the behaviour\'s word or its summary: ' + read.replace(/<[^>]+>/g, ' ').slice(0, 300));
  else if (/readList/.test(back) || !/function UseOn/.test(back)) fail('read view', 'Structured did not bring the listing back');
  else console.log('  read view: Awaken said in sentences, "it" for what the method belongs to, 145 as sleeping by the game\'s own Look text, a summary at its head; Structured brings the listing back');
} catch (e) { fail('read view', e); }
/* A conversation read in full: Aethon's Talk says each answer under the
   prompt as the player types it and as the game stores it, and the test
   inside an answer as a clause; a UseOn's second argument is the target. */
try {
  ctx.jumpToResource(0x1861);
  ctx.setScriptPane('read');
  const h = REGISTRY.get('textContent').innerHTML;
  ctx.jumpToResource(0x1045);
  ctx.setScriptPane('read');
  const f = REGISTRY.get('textContent').innerHTML;
  ctx.setScriptFold('structured');
  if (!/When asked about DEMODOCUS \(demo\):/.test(h) || !/partyjoin 97/i.test(h)) fail('read view', 'Aethon\'s conversation is not read in full: ' + h.replace(/<[^>]+>/g, ' ').slice(0, 300));
  // Helpers read through (0xF02, SetCharacterFlag), a character by its
  // number named from the table, and a state's setters beside its test.
  else if (!/Halos \(62\)\u2019s bit flags has bit 3: \([^)]*0xF02\)/.test(h) || !/Set bit 7 of its bit flags \(SetCharacterFlag\)/.test(h) ||
           !/to 2 by Berossus\u2019 conversation/.test(h) || !/bit 3 of Halos\u2019 bit flags is set by Halos\u2019 conversation, asked about [A-Z]/.test(h))
    fail('read view', 'Aethon\'s helpers, Halos or state 3 are not read through: ' + h.replace(/<[^>]+>/g, ' ').slice(0, 400));
  else if (!/UseOn\(it, the target\)/.test(f) || !/the target as character/.test(f)) fail('read view', 'a UseOn\'s second argument is not the target');
  else console.log('  read view: Aethon\'s conversation read in full under its prompts, and a UseOn\'s second argument is the target');
} catch (e) { fail('read view', e); }

/* Walking, as the engine does it, 23 September 2026 (buildPropBlockers,
   findPath, keepApart). Cademia's portcullis at (52,35) is flagged 0x80 --
   raised -- so the engine neither draws it nor stops at it; the page did
   both, and Naxos could not reach the hall behind it. The control is the
   same leg with the 0x80 record counted: it does not arrive. */
try {
  const e = ctx.renderMapUncached(0x8008), m = e.result.m, W = m.width;
  ctx.CUR_MAP = { resid: 0x8008, level: 8, m };
  peek('DERIVED').PROP_BLOCK = null;
  const bl = ctx.buildPropBlockers(0x8008, m);
  const sc = ctx.loadSchedules();
  let legs = 0, crossed = 0, reached = 0;
  sc.forEach((s, ci) => {
    const real = (s || []).filter(x => x.mode !== 0);
    for (let k = 0; k < real.length; k++) {
      const a = real[k], b = real[(k + 1) % real.length];
      if (a.level !== 8 || b.level !== 8) continue;
      legs++;
      const p = ctx.findPath(m, a.x, a.y, b.x, b.y, ctx.keysCarriedBy(ci));
      if (p.reached) reached++;
      for (let j = 1; j < p.length - 1; j++) if (bl.has(p[j][1] * W + p[j][0])) crossed++;
    }
  });
  const port = e.result.props.some(d => d.rec.x === 52 && d.rec.y === 35 && d.rec.flags === 0x80);
  const naxos = ctx.findPath(m, 29, 45, 51, 24, null);
  // The control: the portcullis's square blocked as the old rule had it.
  bl.add(35 * W + 52); peek('pathCache').clear();
  const shut = ctx.findPath(m, 29, 45, 51, 24, null);
  bl.delete(35 * W + 52); peek('pathCache').clear();
  const two = [{ walking: false, x: 5, y: 5 }, { walking: true, x: 5, y: 5, pi: 2, dir: 1, base: 0, path: [[3, 5], [4, 5], [5, 5]] }];
  ctx.keepApart(two);
  if (crossed) fail('walking', crossed + ' squares of Cademia\'s routes are blocked ones');
  else if (reached < legs * 0.9) fail('walking', 'only ' + reached + ' of ' + legs + ' of Cademia\'s legs arrive');
  else if (port) fail('walking', 'the raised portcullis at (52,35) is drawn');
  else if (!naxos.reached || shut.reached) fail('walking', 'Naxos\'s way to the hall does not turn on the portcullis: open ' + naxos.reached + ', shut ' + shut.reached);
  else if (two[1].x !== 4) fail('walking', 'a walker stepped onto a square somebody stands on');
  else console.log('  walking: ' + reached + ' of ' + legs + ' of Cademia\'s legs arrive, none through a blocked square; the raised portcullis is not drawn and not in the way; a walker waits behind someone standing');
} catch (e) { fail('walking', e); }

/* Hidden ways, 23 September 2026 (mapEggWays, ravineWayAt). A secret or
   tight passage travels by the egg drawn under it, which the ways out of a
   map never read: Catamarca's secret passage to the Underground was nowhere
   on the World tab or the square's panel. The Harpy Abyss's cracks lead to
   the rock outcropping the rope is tied to. The control is a crack's square
   off the ravine, which leads nowhere. */
try {
  const cat = [...Array(0x30).keys()].map(l => 0x8000 + l).find(r => ctx.refExists(r) && ctx.zoneNameFor(r) === 'Catamarca');
  const ways = cat ? ctx.mapDescents(cat) : [];
  const secret = ways.find(d => d.egg && d.kind === 'secret passage');
  const rv = ctx.ravineWayAt(0x8029, 20, 13), off = ctx.ravineWayAt(0x8029, 5, 5);
  if (!secret || ctx.zoneNameFor(secret.dest.resid) !== 'Underground') fail('hidden ways', 'Catamarca\'s secret passage is not a way to the Underground: ' + JSON.stringify(ways.map(w => w.kind)));
  else if (!rv || rv.kind !== 'rock outcropping' || !/Caves/.test(rv.name) || off) fail('hidden ways', 'the Harpy Abyss\'s crack does not lead to the outcropping: ' + JSON.stringify([rv, off]));
  else console.log('  hidden ways: Catamarca\'s secret passage leads to the ' + ctx.zoneNameFor(secret.dest.resid) + ', and the abyss\'s cracks to the rock outcropping and the ' + rv.name);
} catch (e) { fail('hidden ways', e); }

/* What characters carry, 23 September 2026 (carriedByCharacter): Deiphobus
   (14) carries a mace, a cloak, a leather helmet, a cuirass and a round
   shield in the shipped file, and his dossier says so. Alaric carries
   nothing, which is the control. */
try {
  const names = ctx.carriedByCharacter(14).map(it => ctx.propDisplayName(it.pt, ctx.getPropTileList()[it.pt] + it.aspect));
  ctx.showCharacterDetail(14);
  const html = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  if (!names.includes('mace') || !names.includes('round shield')) fail('carries', 'Deiphobus does not carry his mace and shield: ' + JSON.stringify(names));
  else if (!/Carries/.test(html) || !/mace/.test(html)) fail('carries', 'his dossier does not say what he carries');
  else if (ctx.carriedByCharacter(2).length) fail('carries', 'Alaric carries something');
  else console.log('  carries: Deiphobus\'s dossier lists ' + names.join(', ') + '; Alaric carries nothing');
} catch (e) { fail('carries', e); }
