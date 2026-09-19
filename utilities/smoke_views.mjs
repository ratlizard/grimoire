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
      const st = ctx.__peek('window.PROP_WORD');
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
            else if ((function () { ctx.renderItemSheet(); const h = walk(REGISTRY.get('sheetGrid')); return !/Weapons &amp; armour<\/span><span class="groupNote">The class script has a combat member: Melee Weapon, Thrown Weapon, Armor Value, Ammunition, Ranged Weapon, Shield\./.test(h) || !/Containers<\/span><span class="groupNote">The class script has Lockable, or answers Is Container/.test(h) || !/Carried goods<\/span><span class="groupNote">The rest of what the file treats as an item/.test(h); })()) fail('items', 'the Items dividers do not say what puts an item under each');
            else if ((function () { ctx.showItemDetail(213); ctx.propWordSet(1); const h = walk(REGISTRY.get('sheetGrid')); return !/reads its aspect<\/b> \(2 places\)/.test(h) || !/Eaten, it feeds <b[^>]*>\+8<\/b> and says “Yetch!”/.test(h); })()) fail('items', 'the mushroom steak at aspect 1 does not say its class reads the aspect and what the dried jellyfish feeds and says');
            else if ((function () { ctx.showItemDetail(0x1F); ctx.propWordSet(4); const h = walk(REGISTRY.get('sheetGrid')); return !/Drunk, it is the <b[^>]*>Antidote Potion<\/b>: clears poison/.test(h); })()) fail('items', 'the potion at aspect 4 does not name the Antidote');
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

// A frame block ends where the 16-tile sheet does, not where the thing does.
// Prop 0x141 is four crystal balls followed by a board, four staves and four
// paintings, and the galleries must not call the lot "crystal ball".
try {
  const base = ctx.getPropTileList()[0x141];
  const runs = ctx.frameRuns(base, ctx.spriteFrameInfo(0, 0x141).present);
  const names = runs.map(r => r.name).join('/');
  if (names !== 'crystal ball/boards/staff/painting')
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
