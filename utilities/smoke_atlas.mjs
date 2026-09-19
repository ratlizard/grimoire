// smoke_atlas.mjs -- one part of the UI smoke: the arrival on a link, the conversation and detail views, the atlas and the world tab end to end, the gate, the brand line, the square card, skills and spells, the GIF and dither tools, the animation modes.
// Cut out of viewer_smoke.mjs on 18 September 2026 at a point where the open
// file changes, so it runs from a fresh boot (smoke_boot.mjs) as its own
// process. Run alone with
//   node utilities/viewer_smoke.mjs index.html "$TMPDIR/Cythera Data.data" "" <installers .sit> <saved game> atlas
// and with the other parts by naming them; with none named the runner drives
// all six in this process, in order.
import { htmlPath, dataPath, onlyCat, visePath, savePath, html, js, archive, rsrcPath, rsrcFork, missingIds,
         El, REGISTRY, catSel, optionSource, CATEGORY_VALUES, body, documentStub, rafQueue, drainRaf, sandbox,
         ctx, peek, fail, t0, status, A, readFileSync, existsSync, tally } from './smoke_boot.mjs';


// "Where is this art used?" — the reverse index has to agree with the forward
// one: every sheet it claims a map uses must really appear in that map.
try {
  const t = Date.now();
  const idx = ctx.buildTileSheetUsage();
  const sheets = Object.keys(idx).map(Number).sort((a, b) => a - b);
  const withMaps = sheets.filter(s => idx[s].maps.length);
  const withProps = sheets.filter(s => idx[s].props.length);
  console.log(`  art usage: ${sheets.length} sheets referenced (${withMaps.length} by maps, ` +
              `${withProps.length} by prop types) in ${Date.now() - t} ms`);
  const mapsCovered = new Set();
  for (const s2 of withMaps) for (const r of idx[s2].maps) mapsCovered.add(r);
  // subindex 127 declares 256 slots; only some are populated, and the gallery
  // knows which -- that is the number every map should be accounted for in.
  ctx.showCategory('127');
  const realMaps = (ctx.CUR_RESIDS || []).length;
  console.log(`  art usage: ${mapsCovered.size} of ${realMaps} maps contributed tiles`);
  if (!withMaps.length || !withProps.length) fail('art usage', 'index is empty');
  if (mapsCovered.size < realMaps)
    fail('art usage', `${realMaps - mapsCovered.size} maps contributed nothing — the decrypt fallback is probably failing`);

  // Cross-check one claim the hard way: re-read the map and look for the sheet.
  const sheet = withMaps[0], mapResid = idx[sheet].maps[0];
  const raw = ctx.getResourceBytes(A(), mapResid);
  let data = ctx.smartDecrypt(raw, mapResid).data;
  let m = ctx.parseDelverMap(data);
  if (!m) { const alt = ctx.decryptResource(raw, mapResid); const m2 = ctx.parseDelverMap(alt); if (m2) { data = alt; m = m2; } }
  let found = false;
  for (let i = 0; m && i < m.width * m.height && !found; i++) {
    const o = m.mapDataOffset + i * 2;
    const tile = (data[o] << 8) | data[o + 1];
    if (tile && tile < 0x1000 && peek('sheetResidForTile')(tile) === sheet) found = true;
  }
  if (!found) fail('art usage', `claims map 0x${mapResid.toString(16)} draws sheet 0x${sheet.toString(16)}, but no tile in it does`);

  // And the rendered panel names something.
  ctx.showCategory('141');
  ctx.openResource(sheet);
  const panel = REGISTRY.get('artUsage').innerHTML;
  if (!/Maps|Prop types|Composite/.test(panel)) fail('art usage', 'panel said: ' + panel.slice(0, 80));
} catch (e) { fail('art usage', e); }

// The conversation view: a dialogue resource must render structured topic
// cards (not the flat string list), with the inheritance chain as chips and
// @keywords as live links -- and the generic-prompt archetypes must render
// too. This is the only check that would notice the conversation pane
// rendering nothing while the extractor stays green.
try {
  ctx.jumpToResource(0x180B);                     // Naxos, the canonical case
  const wrap = REGISTRY.get('dlgWrap');
  const cards = (wrap.innerHTML.match(/convCard/g) || []).length;
  const chips = (wrap.innerHTML.match(/convKw/g) || []).length;
  if (cards < 10) fail('conversation', `Naxos rendered ${cards} topic cards, expected 12`);
  if (chips < 10) fail('conversation', 'keyword chips missing');
  if (!/House Comana/.test(wrap.innerHTML)) fail('conversation', 'inheritance chain chips missing');
  if (!/convLink/.test(wrap.innerHTML)) fail('conversation', '@keyword links missing');
  ctx.jumpToResource(0x801);                      // the Human archetype
  if (!/Generic <b>Human<\/b>/.test(REGISTRY.get('dlgWrap').innerHTML))
    fail('conversation', 'the Human generic-prompt page did not render as a conversation');
  const found = ctx.convFindEntry(ctx.conversationFor(0x801).entries, 'Alaric');
  if (!found) fail('conversation', 'four-letter prefix lookup found nothing for "Alaric"');
  console.log('  conversation: Naxos renders ' + cards + ' topics; generic prompts and prefix lookup work');
} catch (e) { fail('conversation', e); }

// The detail lens: zoomed into the world map (whose base canvas is budgeted
// well below native tile size), the visible window must re-render at TS=32
// into a viewport-sized canvas. This is the only check that would notice the
// lens painting nothing -- or crashing in one of the layer painters it
// shares with the full-size layers.
try {
  ctx.jumpToResource(0x8001);
  // The stub's elements report a fixed 300x300 client size, which is a
  // perfectly good viewport for the lens.
  const mv = peek('mapView');
  mv.scale = 4; mv.x = -2000; mv.y = -2000;
  if (!peek('lensActive')()) fail('detail lens', 'not active at 4x on the world map');
  peek('paintDetailLens')();
  const lens = REGISTRY.get('mapDetailLens');
  if (!lens || !lens.width) fail('detail lens', 'lens canvas was not sized');
  else if (lens.style.display === 'none') fail('detail lens', 'painted but not shown');
  else console.log('  detail lens: world map window repainted at TS=32 into ' +
                   lens.width + 'x' + lens.height);
  // Geometry. The lens is painted with a margin on every side -- as much as
  // lensGeometry's device-pixel budget will pay for -- so its CSS box is
  // larger than the viewport and offset up-left by that margin. It shipped
  // squashed: #appShell's blanket max-width:100% reached it (the stylesheet's
  // exemption named #mapCanvasWrap, and the lens is a child of #mapViewport),
  // so the painted detail was compressed horizontally, drifting further left
  // the further right you looked, with the rightmost part of the viewport
  // showing bare base. Nothing in a DOM stub can resolve a percentage, so
  // what is checked is the two halves the page itself owns: that the box it
  // asks for is the box it painted, and that the inline max-width now
  // outranks any sheet rule.
  if (lens) {
    const vp = REGISTRY.get('mapViewport');
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const mx = -parseFloat(lens.style.left), my = -parseFloat(lens.style.top);
    if (!(mx > 0 && my > 0))
      fail('detail lens', `no painted margin: left=${lens.style.left} top=${lens.style.top}`);
    else if (lens.style.width !== (vw + 2 * mx) + 'px' || lens.style.height !== (vh + 2 * my) + 'px')
      fail('detail lens', `CSS box ${lens.style.width}x${lens.style.height} is not the ` +
                          `painted box ${vw + 2 * mx}x${vh + 2 * my}`);
    else if (!/max-width\s*:\s*none/.test(lens.style.cssText || ''))
      fail('detail lens', 'no inline max-width:none -- a stylesheet rule can squash the lens again');
    else if (!/transform-origin\s*:\s*0 0/.test(lens.style.cssText || ''))
      fail('detail lens', 'no transform-origin:0 0 -- slideLens scales about the wrong point');
    else console.log(`  detail lens: ${vw + 2 * mx}x${vh + 2 * my} box over a ${vw}x${vh} ` +
                     `viewport (margin ${Math.round(100 * mx / vw)}%), unclampable`);
  }
  // The base map and everything drawn over it must share one origin. The
  // terrain canvas alone used to carry a `10px auto` margin from when maps
  // rendered inline, and #mapCanvasWrap is absolutely positioned so the
  // margin could not collapse out of it -- which put the terrain 10px below
  // the layers, the hit test and the lens, times the zoom. At the zoom the
  // lens engages at, that is what made the sharp window look shifted against
  // the blurry base under it.
  {
    const margin = String((peek('CUR_MAP').canvas.style.margin) || '0');
    if (!/^0(px)?$/.test(margin.trim()))
      fail('detail lens', `terrain canvas carries margin "${margin}" -- it must share the ` +
                          'wrap origin with the overlay layers, the lens and mapSquareFromClient');
  }
  // Zooming must not throw the painted detail away. The lens is slid AND
  // scaled to stay registered until the repaint lands; hiding it (which is
  // what it used to do) is what made a pinch revert to the blurriest version
  // of the map and then jump when the sharp one came back.
  if (lens) {
    mv.scale = 8;
    peek('scheduleLensPaint')(0);                 // the repaint is a timer; inspect the slide now
    if (lens.style.display === 'none')
      fail('detail lens', 'a zoom hid the lens instead of scaling the painted pixels');
    else if (!/scale\(2\b/.test(lens.style.transform || ''))
      fail('detail lens', `zoom 4x -> 8x should slide at scale(2), got "${lens.style.transform}"`);
    else {
      const busy = REGISTRY.get('mapLensBusy');
      if (!busy || !busy.classList.contains('on'))
        fail('detail lens', 'nothing tells the reader a sharper view is on its way');
      else {
        peek('paintDetailLens')();
        if (lens.style.transform) fail('detail lens', 'repaint left a stale slide transform');
        else if (busy.classList.contains('on')) fail('detail lens', 'the badge outlived its repaint');
        else console.log('  detail lens: a zoom slides the painted pixels and says so, ' +
                         'then repaints clean');
      }
    }
  }
  mv.scale = 0.5;
  peek('scheduleLensPaint')(0);
} catch (e) { fail('detail lens', e); }

/* The atlas: the world as one scene rather than a sequence of views.

   What is worth checking is exactly what the old renderer needed 425 lines to
   arrange, and what it therefore must NOT need here: no crossing, no landing,
   no stack, no held gateway. A place is a node that got big, "which place am
   I in" is read off the view, and every position on screen comes from one
   transform -- so the checks are about that transform being the only one. */
try {
  /* Regions, as it is before the atlas has ever touched the panel. The two
     share one, and this snapshot is the requirement -- "Entities > Regions
     does not change" -- stated as something a machine can check. It has to be
     taken here, before the first showCategory('WORLD'): taken later it would
     be comparing two post-atlas states, which is a test that cannot fail. */
  const watch = ['mapLabel', 'mapParts', 'charControls', 'markLegend', 'mapSaveRow',
                 'singleControls', 'propFilterWrap', 'resourceNav', 'mapCanvasWrap',
                 'mapPreview', 'mapViewport', 'mapStage', 'mapInspect'];
  const snapRegions = () => watch.map(id => {
    // The stub answers with null for an id the markup does not carry; the
    // point here is the comparison, and an absent element compares equal.
    const el = ctx.document.getElementById(id) || { style: {} };
    return id + '=' + el.style.display + '/' + (el.style.height || '') +
           '/' + (el.style.padding || '');
  });
  ctx.ATLAS = true;
  ctx.jumpToResource(0x8002);
  const regionsBefore = snapRegions();

  ctx.showCategory('WORLD');
  const sc = peek('atlasScene')();
  const av = peek('atlasView');
  // v1.48.0: the two memory switches are gone, the selection bar says so
  // until a square is picked, the atlas bar's place name is not styled as a
  // link, and an egg is any record with flags 0x42 or 0x44 -- the one at
  // Hall of Truth (8,38) carries no argument and 18 more on that map do.
  {
    const all = (function walk(el) { return (el.innerHTML || '') + (el.textContent || '') + (el.children || []).map(walk).join(''); })(REGISTRY.get('atlasPanel') || { children: [] });
    const insp = ctx.document.getElementById('atlasInspect');
    if (/Full resolution|Keep every place/.test(all) || ctx.document.getElementById('atlasSettings') && !missingIds.has('atlasSettings')) fail('atlas', 'the memory switches are still offered');
    else if (!insp || !/Nothing selected/.test(insp.innerHTML || '')) fail('atlas', 'the selection bar does not say Nothing selected before a pick: ' + (insp && insp.innerHTML || '').slice(0, 60));
    else if (!/#atlasBar \.wbWhere \{ color:#fff/.test(html)) fail('atlas', 'the atlas bar’s place name is still gold');
    else if (!ctx.atlasEggAt({ resid: 0x8013 }, 8, 38) || !ctx.atlasEggAt({ resid: 0x8013 }, 27, 37) || ctx.atlasEggAt({ resid: 0x8013 }, 9, 38)) fail('atlas', 'the eggs at Hall of Truth (8,38) and (27,37) are not both read as eggs');
    else if (!/if \(card && card\.person\) appendFaceOrSprite/.test(js)) fail('atlas', 'the hover still reads card.person on a square with only an egg');
    else if (peek('applyNamesDefault')(true) !== undefined || peek('window.SHOW_BUILTIN_LABELS') !== false || (peek('applyNamesDefault')(false), peek('window.SHOW_BUILTIN_LABELS') !== true)) fail('names', 'the switch does not default off for a supplied file and on for a fetched one');
    else console.log('  atlas: no memory switches, the bar starts empty, eggs with an argument are eggs, the names default follows the source');
  }
  // v1.49.0: a link out of the World tab is one step -- the gallery the
  // category switch renders is not a history entry -- and the picked square
  // is ringed until it is tapped again.
  {
    const worldHash = peek('location.hash');
    const before = peek('window.VIEW_TRAIL').length;
    ctx.openVia('ITEMS', () => ctx.showItemDetail(151));
    const trail = peek('window.VIEW_TRAIL'), dv = peek('window.DETAIL_VIEW');
    if (peek('window.CUR_SUBN') !== 'ITEMS' || !dv || dv.kind !== 'item' || dv.id !== 151) fail('open via', 'Open cloth in Items from the World tab did not open the item: ' + JSON.stringify([peek('window.CUR_SUBN'), dv]));
    else if (!worldHash || trail[trail.length - 1] !== worldHash || trail.slice(before).some(h => /c=ITEMS(&|$)/.test(h))) fail('open via', 'the trail did not record the World page as the one step back: ' + JSON.stringify([worldHash, trail.slice(-3)]));
    else {
      ctx.showCategory('WORLD');
      const sc2 = peek('atlasScene')(), av2 = peek('atlasView');
      const cad = sc2.nodes.find(n => /cademia/i.test(n.name));
      peek('atlasFit')(); peek('atlasZoomAround')(av2.Z * 4, 200, 200);
      const rr = peek('atlasRect')(cad, av2);
      ctx.atlasInspect(rr.x + rr.w / 2, rr.y + rr.h / 2);
      const s1 = peek('window.ATLAS_SEL');
      ctx.atlasInspect(rr.x + rr.w / 2, rr.y + rr.h / 2);
      const s2 = peek('window.ATLAS_SEL'), insp = ctx.document.getElementById('atlasInspect');
      if (!s1 || s1.resid !== cad.resid || s2 !== null || !/Nothing selected/.test(insp.innerHTML || '')) fail('atlas pick', 'the picked square is not ringed and cleared by a second tap: ' + JSON.stringify([s1, s2]));
      else if (!/spoilers abound!!/.test(html)) fail('gate', 'the gate lacks the spoiler line');
      else console.log('  atlas: Open in Items from the World tab is one step back; a tap picks a square and a second clears it; the gate warns of spoilers');
    }
  }
  // 11 September 2026: lifting out of a pinch is not a tap. Every pointerdown
  // used to reset the movement count, the second finger's included, and a
  // pinch added nothing to it, so the lift picked the square under the last
  // finger. The stub's addEventListener records nothing, so the World tab's
  // own handlers are taken off a second wiring of the viewport and driven by
  // hand: a one-finger tap on open ground must pick (the positive control,
  // without which a handler that never picks would pass), a second must
  // clear, and a pinch whose fingers barely move must leave nothing picked.
  {
    ctx.showCategory('WORLD');
    const vp = ctx.document.getElementById('atlasViewport');
    const on = {};
    const saved = vp.addEventListener;
    vp.addEventListener = (type, fn) => { on[type] = fn; };
    delete vp.dataset.atlasWired;
    ctx.setupAtlasInteraction();
    vp.addEventListener = saved;
    const ev = (id, x, y) => ({ pointerId: id, pointerType: 'touch', clientX: x, clientY: y, preventDefault() {} });
    peek('atlasFit')();
    const av3 = peek('atlasView'), sc3 = peek('atlasScene')();
    const world = sc3.nodes.find(n => !n.depth);
    // Open ground: a square of the world that no town's rectangle covers.
    let spot = null;
    const wr = peek('atlasRect')(world, av3);
    for (let fy = 0.3; fy <= 0.7 && !spot; fy += 0.05) for (let fx = 0.3; fx <= 0.7 && !spot; fx += 0.05) {
      const x = wr.x + wr.w * fx, y = wr.y + wr.h * fy, hit = peek('atlasAt')(x, y);
      if (hit && !hit.node.depth && !(peek('window.ATLAS_MOUTHS') || []).some(q => Math.hypot(x - q.x, y - q.y) <= q.rad + 4)) spot = { x, y };
    }
    peek('window.ATLAS_SEL = null');
    const tap = (x, y) => { on.pointerdown(ev(1, x, y)); on.pointerup(ev(1, x, y)); return peek('window.ATLAS_SEL'); };
    const picked = spot && tap(spot.x, spot.y);
    const cleared = spot && tap(spot.x, spot.y);
    let afterPinch = 'not run';
    if (spot) {
      on.pointerdown(ev(1, spot.x, spot.y));
      on.pointerdown(ev(2, spot.x + 60, spot.y + 60));
      on.pointermove(ev(2, spot.x + 63, spot.y + 62));
      on.pointerup(ev(2, spot.x + 63, spot.y + 62));
      on.pointerup(ev(1, spot.x, spot.y));
      afterPinch = peek('window.ATLAS_SEL');
    }
    if (!on.pointerdown || !on.pointerup || !on.pointermove) fail('atlas pinch', 'the World tab wired no pointer handlers: ' + Object.keys(on).join(', '));
    else if (!spot) fail('atlas pinch', 'no open ground on the fitted world to tap');
    else if (!picked || cleared !== null) fail('atlas pinch', 'a one-finger tap did not pick and a second clear, so the pinch check proves nothing: ' + JSON.stringify([picked, cleared]));
    else if (afterPinch !== null) fail('atlas pinch', 'lifting out of a pinch picked a square: ' + JSON.stringify(afterPinch));
    else console.log('  atlas: a tap picks, a second clears, and lifting out of a pinch picks nothing');
  }
  const vpA = REGISTRY.get('mapViewport');
  if (!sc) fail('atlas', 'no scene was built');
  else if (sc.nodes.some(n => n.depth && !ctx.mapIsSurface(n.resid)))
    /* The scene places what the archive puts on the surface and no more: a
       map whose edge leads to the world, whose entry script sets a horizon
       rather than an indoor backdrop, and which the world map draws as a
       place rather than a way in (mapIsSurface). A stair or a cave mouth
       says where you go in, not where the place reaches, so drawing the
       Sewers under nine squares of Cademia, or the Temple beside its cave,
       was a claim the archive does not support. */
    fail('atlas', 'the scene places a map the archive does not put on the surface: ' +
                  sc.nodes.filter(n => n.depth && !ctx.mapIsSurface(n.resid))
                     .map(n => n.name).join(', '));
  else {
    const cad = sc.nodes.find(n => n.resid === 0x8008);
    const b = peek('contentBox')(0x8008);
    const gwC = ctx.worldGateways().find(g => g.destResid === 0x8008);
    /* One transform, and it is the same one the miniature and the country and
       the landing were three separate expressions of. Cademia's built part
       has to land on Cademia's pictogram: that is the whole claim, and in the
       old renderer it was made three times and two of them disagreed. */
    const cx = cad.ox + ((b.x0 + b.x1 + 1) / 2) * cad.s;
    const want = (gwC.x0 + gwC.x1 + 1) / 2;
    if (Math.abs(cx - want) > 0.01)
      fail('atlas', `Cademia's middle sits at world ${cx.toFixed(2)}, its icon at ${want}`);
    else if (Math.abs((b.x1 - b.x0 + 1) * cad.s - (gwC.x1 - gwC.x0 + 1)) > 1.2)
      fail('atlas', 'Cademia does not cover its own pictogram');
    else console.log('  atlas: ' + sc.nodes.length + ' nodes; Cademia sits on its icon ' +
                     'through one transform');

    // Fit, then zoom: the view is three numbers and a node's place on screen
    // follows from them. Nothing is "entered", so nothing can be out of step.
    peek('atlasFit')();
    const wide = peek('atlasRect')(cad, av);
    peek('atlasZoomAround')(av.Z * 4, vpA.clientWidth / 2, vpA.clientHeight / 2);
    const close = peek('atlasRect')(cad, av);
    if (!(close.w > wide.w * 3.5))
      fail('atlas', `zooming 4x grew Cademia from ${wide.w.toFixed(0)} to ${close.w.toFixed(0)}`);
    else console.log('  atlas: zoom is one number; Cademia goes ' + wide.w.toFixed(0) +
                     'px to ' + close.w.toFixed(0) + 'px with nothing entered');

    /* "Which place am I in" is read off the view rather than stored. Put
       Cademia's middle under a point and the deepest node covering it is
       Cademia -- no state, so no way for it to disagree with what is drawn. */
    const r = peek('atlasRect')(cad, av);
    const hit = peek('atlasAt')(r.x + r.w / 2, r.y + r.h / 2);
    if (!hit) fail('atlas', 'nothing was found under the middle of Cademia');
    else if (hit.node.resid !== 0x8008)
      fail('atlas', `the deepest node under Cademia is 0x${hit.node.resid.toString(16)}`);
    else if (hit.tx < 0 || hit.tx >= cad.w)
      fail('atlas', `the square under it is ${hit.tx},${hit.ty}, outside a ${cad.w}-square map`);
    else console.log('  atlas: what is under the pointer is derived, not stored — ' +
                     'square ' + hit.tx + ',' + hit.ty + ' of Cademia');

    // And zooming out again puts the world back under the same point, which
    // is the whole of "up a level" in this renderer.
    peek('atlasFit')();
    const out = peek('atlasAt')(vpA.clientWidth / 2, vpA.clientHeight / 2);
    if (!out || out.node.depth !== 0)
      fail('atlas', 'zooming out did not come back to the world');
    else console.log('  atlas: zooming out is the way back up — no stack, no held gateway');

    /* Everything on the surface IS in the scene -- the rule cuts both ways
       -- and what is located but not on the surface is a mouth somewhere on
       the surface: the Temple at its cave and the bridge at the square its
       own edge names, on the world; the springs under Catamarca and the
       upstairs of Pnyx as rings inside those towns, since 6 September 2026,
       not out on the world at the square their edge happens to name. */
    let surface = 0, edgeMouths = 0;
    const worldMouths = sc.nodes.flatMap(n => peek('atlasMouths')(n));
    for (let n = 0; n < 0x100; n++) {
      const rid = 0x8000 | n;
      if (rid === 0x8001 || !ctx.refExists(rid) || !ctx.mapIsLocated(rid)) continue;
      if (ctx.mapIsSurface(rid)) {
        surface++;
        if (!sc.nodes.some(q => q.resid === rid))
          fail('atlas', `0x${rid.toString(16)} is on the surface by the archive and missing from the scene`);
      } else {
        edgeMouths++;
        if (!worldMouths.some(m => m.dest.resid === rid))
          fail('atlas', `0x${rid.toString(16)} is located but not on the surface, and is not a mouth anywhere on the surface`);
      }
    }
    if (ctx.mapIsSurface(0x801A)) fail('atlas', 'the Temple is on the surface: its script sets an indoor backdrop');
    if (ctx.mapIsSurface(0x8026)) fail('atlas', 'the bridge is on the surface: the world draws nothing for it');
    if (!ctx.mapIsSurface(0x8008) || !ctx.mapIsSurface(0x8016)) fail('atlas', 'Cademia or the Flax Farm is off the surface');
    if (new Set(sc.nodes.map(n => n.key)).size !== sc.nodes.length)
      fail('atlas', 'two nodes share a key');
    else console.log('  atlas: ' + sc.nodes.length + ' nodes — the world and the ' + surface +
                     ' maps it puts on the surface; ' + edgeMouths + ' located maps are mouths instead, the Temple and the bridge among them');
    // The roofs fade over a band rather than cut at a step.
    const rt = peek('atlasRoofT');
    if (!(rt(200) === 1 && rt(700) === 0 && rt(450) > 0.3 && rt(450) < 0.7 && rt(400) > rt(500)))
      fail('atlas', 'the roof fade is not a band around the old step: ' + [200, 400, 450, 500, 700].map(w => rt(w).toFixed(2)).join(' '));
    else console.log('  atlas: roofs fade from 360 to 540 px across, centred on the old 448 px step');
    // The version, at the top.
    const brand = REGISTRY.get('brand');
    if (!brand || !/Grimoire/.test(brand.innerHTML) || !/v\d+\.\d+\.\d+/.test(brand.innerHTML))
      fail('brand', 'the page does not say its name and version at the top: ' + (brand && brand.innerHTML));
    else console.log('  brand: ' + brand.innerHTML.replace(/<[^>]+>/g, ''));

    /* The 17 it does not locate are reached through a mouth: a ring on the
       square the archive gives, and a step rather than a zoom, because a
       doorway is what the file says and a position is not. */
    {
      const cadN = sc.nodes.find(n => n.resid === 0x8008);
      const mouths = peek('atlasMouths')(cadN);
      if (!mouths.length) fail('atlas', 'Cademia has no way down');
      else if (mouths.some(m => ctx.mapIsSurface(m.dest.resid)))
        fail('atlas', 'a mouth leads somewhere already in the scene');
      else {
        const sewers = mouths.find(m => m.dest.resid === 0x8015);
        if (!sewers) fail('atlas', 'the Sewers are not a mouth in Cademia');
        else {
          ctx.atlasDescend(sewers, cadN);
          const bs = peek('atlasScene')();
          if (!bs || bs.root.resid !== 0x8015)
            fail('atlas', 'taking the mouth did not arrive in the Sewers');
          else if (bs.surface !== false)
            fail('atlas', 'an unlocated place was shown as part of the surface');
          else if (!ctx.ATLAS_BELOW.length)
            fail('atlas', 'nothing recorded how the Sewers were reached');
          else {
            // and back out again, to exactly where it was left
            const before = { x: ctx.ATLAS_BELOW[0].view.x, Z: ctx.ATLAS_BELOW[0].view.Z };
            ctx.atlasAscend();
            const now = peek('atlasView');
            if (peek('atlasScene')().root.resid !== 0x8001)
              fail('atlas', 'coming back up did not reach the surface');
            else if (Math.abs(now.Z - before.Z) > 0.001 || Math.abs(now.x - before.x) > 0.001)
              fail('atlas', 'coming back up did not restore the view it left');
            else console.log('  atlas: ' + mouths.length + ' ways down from Cademia; the Sewers ' +
                             'are a step through a mouth and back to the same view');
          }
        }
      }
      ctx.ATLAS_BELOW = [];
    }

    /* People are drawn on whichever node they stand on. charactersOnLevel is
       written against the open map, so the atlas lends it one -- and has to
       put it back, or the panel finds a map it never opened. */
    {
      const before = peek('CUR_MAP');
      const cadN = peek('atlasScene')().nodes.find(n => n.resid === 0x8002);   // Odemia
      let painted = 0;
      const spy = { globalAlpha: 1, imageSmoothingEnabled: false, drawImage() { painted++; } };
      peek('atlasPeople')(spy, cadN, { x: 0, y: 0, w: 2000, h: 2000 }, 40);
      if (!painted) fail('atlas', 'nobody was drawn on a populated node');
      else if (peek('CUR_MAP') !== before)
        fail('atlas', 'drawing people left the borrowed map behind');
      else console.log('  atlas: ' + painted + ' people drawn on Odemia, ' +
                       'and the borrowed CUR_MAP put back');
    }

    /* The panel needs its rules as much as its markup.

     A sweep that deleted an old full-bleed CSS block ran from one comment to
     the next and took the atlas panel's rules with it. Nothing failed: the
     markup was there, the script was there, every id resolved and the suite
     stayed green -- but #atlasViewport had no height, so the World tab
     collapsed to a zoom slider and an empty box. Style is not checkable the
     way script is, so the rules the panel cannot live without are checked the
     only way they can be: by looking for them. */
  {
    const need = [/#atlasViewport\s*\{[^}]*height\s*:/, /#atlasHover\s*\{[^}]*display\s*:\s*none/];
    if (need.some(re => !re.test(html)))
      fail('atlas', 'the atlas panel has lost its stylesheet rules — ' +
                    'a viewport with no height shows nothing');
    else console.log('  atlas: the panel keeps the rules it cannot live without');
  }

  /* The atlas has its own container, and that is the fix for the seam that
       produced every regression this tab has had -- CUR_MAP, then the panel's
       own elements, then the class that unframed the sheet. Sharing was the
       cause each time, so the check is that nothing is shared: a full pass
       through the atlas must leave Entities > Regions bit for bit as it was,
       and the baseline has to be taken before the atlas has ever run or it
       compares two post-atlas states and cannot fail. */
    {
      ctx.ATLAS_BELOW = [];
      ctx.showCategory('WORLD');
      const ap = ctx.document.getElementById('atlasPanel');
      const sheet = ctx.document.getElementById('tabSheet');
      if (!ap || ap.style.display !== 'block') fail('atlas', 'the atlas panel did not open');
      else if (!sheet || sheet.style.display !== 'none')
        fail('atlas', 'the sheet did not step aside for the atlas');
      else {
        ctx.jumpToResource(0x8002);
        const after = snapRegions();
        const diff = after.filter((v, i) => v !== regionsBefore[i]);
        if (diff.length)
          fail('atlas', 'the atlas left residue in Regions: ' + diff.join(', '));
        else if (ctx.document.getElementById('atlasPanel').style.display !== 'none')
          fail('atlas', 'the atlas panel outstayed the tab');
        else if (ctx.document.getElementById('tabSheet').style.display === 'none')
          fail('atlas', 'the sheet did not come back');
        else {
          /* The panel must be gone from EVERY other tab, not just the one
             checked above. It carries a zoom slider, and a stray zoom slider
             under a gallery of portraits is how this was reported. */
          const showing = [];
          for (const v of ['CHARACTERS', '135', 'TOOLS', 'DATAFORK', '127', '23']) {
            if (!ctx.showCategory(v)) continue;
            const ap2 = ctx.document.getElementById('atlasPanel');
            if (ap2 && ap2.style.display !== 'none') showing.push(v);
          }
          if (showing.length)
            fail('atlas', 'the atlas panel is showing under ' + showing.join(', '));
          else console.log('  atlas: its own panel — gone from every other tab, and Regions ' +
                           'comes back bit for bit');
          ctx.showCategory('WORLD');
        }
      }
      ctx.showCategory('WORLD');
    }

    /* TEMPORARY, with the tuning strip: every number the strip offers has to
       be one the renderer actually reads, or moving it does nothing and the
       answer that comes back is about the wrong thing. */
    {
      // The tuning strip is gone (v1.35.0); the numbers are consts, but
      // they still have to be the ones the renderer reads.
      {
        // and moving one has to change what is drawn. A town is drawn from
        // its miniature and from nothing else below 448 px (v1.37.1), so
        // the miniatures are built here first; the page builds them on idle.
        for (const gw of ctx.worldGateways().slice(0, 8)) { try { ctx.buildThumbsFor(gw, [peek('THUMB_LEVELS')[0]]); } catch (e) {} }
        const before = peek('atlasScene')().nodes.filter(n => n.depth).length;
        ctx.ATLAS_TUNE.nodeFadeFrom = 1;
        peek('paintAtlas')();
        const wide = (ctx.ATLAS_DRAWN || []).length;
        ctx.ATLAS_TUNE.nodeFadeFrom = 4000;
        peek('paintAtlas')();
        const none = (ctx.ATLAS_DRAWN || []).filter(d => d.node.depth).length;
        ctx.ATLAS_TUNE = Object.assign({}, peek('ATLAS_TUNE_DEFAULTS'));
        peek('paintAtlas')();
        if (!(wide > 1) || none !== 0)
          fail('atlas', `the tuning knob did not reach the renderer (${wide} then ${none})`);
        else console.log('  atlas: the fade threshold reaches the renderer');
      }
    }

    // Painting must not throw, and must reach the canvas.
    peek('paintAtlas')();
    const cvA = REGISTRY.get('atlasCanvas');
    if (!cvA || !cvA.width) fail('atlas', 'the scene painted nothing');
    else console.log('  atlas: the scene paints into one ' + cvA.width + 'x' + cvA.height +
                     ' canvas, redrawn rather than slid');

    // A pan asks for a paint rather than painting: many moves in one frame
    // are one paint, drawn when the frame comes.
    let paints = 0;
    const realPaint = ctx.paintAtlas;
    ctx.paintAtlas = function () { paints++; return realPaint.apply(this, arguments); };
    drainRaf(); paints = 0;
    for (let i = 0; i < 5; i++) peek('atlasPanBy')(1, 0);
    const before = paints;
    drainRaf();
    if (before !== 0 || paints !== 1) fail('atlas', `five pans painted ${before} times before the frame and ${paints} after`);
    else console.log('  atlas: five pans in a frame are one paint, at the frame');
    ctx.paintAtlas = realPaint;

    // Magnified past its own render, a node's native art is a cached window:
    // the second frame at the same view rasterises no square at all.
    const av2 = peek('atlasView');
    const cad2 = peek('atlasScene')().nodes.find(n => n.resid === 0x8008);
    peek('atlasFit')();
    for (let k = 0; k < 16 && peek('atlasNodePpt')(cad2, av2) <= cad2.ts * 1.2; k++) {
      const rc = peek('atlasRect')(cad2, av2);
      peek('atlasZoomAround')(av2.Z * 2, rc.x + rc.w / 2, rc.y + rc.h / 2);
    }
    drainRaf();
    if (peek('atlasNodePpt')(cad2, av2) > cad2.ts * 1.2) {
      let regions = 0;
      const realRegion = ctx.paintMapBaseRegion;
      ctx.paintMapBaseRegion = function () { regions++; return realRegion.apply(this, arguments); };
      peek('atlasDetailWindows').clear();      // the zoom's own frame built one already
      peek('paintAtlas')();
      const first = regions;
      peek('paintAtlas')();
      const second = regions - first;
      peek('atlasPanBy')(3, 2); drainRaf();
      const third = regions - first - second;
      ctx.paintMapBaseRegion = realRegion;
      if (!first || second || third) fail('atlas', `native art rasterised ${first}, then ${second}, then ${third} times after a small pan`);
      else console.log('  atlas: the native-art window is rasterised once and blitted after — ' +
                       peek('atlasDetailWindows').size + ' window(s) kept');
      // The people on the node are worked out once for the hour.
      const folkKeys = peek('atlasFolkCache').size;
      peek('paintAtlas')();
      if (peek('atlasFolkCache').size !== folkKeys) fail('atlas', 'a repaint recomputed the schedules');
    } else console.log('  note: could not magnify Cademia past its render in a 300px panel; window cache not exercised' +
                       ` (Z ${av2.Z.toFixed(2)}, s ${cad2.s}, ppt ${peek('atlasNodePpt')(cad2, av2).toFixed(1)}, ts ${cad2.ts}, maxZ ${peek('atlasMaxZ')().toFixed(1)}, below ${(ctx.ATLAS_BELOW || []).length})`);

    // The card over a square: who, what, and -- only when asked -- the ground.
    const ode = peek('atlasScene')().nodes.find(n => n.resid === 0x8002) || cad2;
    const eO = peek('mapRenderFor')(ode.resid, true);
    const folk = peek('atlasFolk')(ode);
    const someone = folk[0];
    const cardP = someone && ctx.squareCard(ode.resid & 0xFF, eO, Math.round(someone.x), Math.round(someone.y), ode.name, false);
    if (!cardP || !cardP.html.includes(ctx.svEsc(someone.name))) fail('square card', 'a square with somebody on it did not name them');
    else if (!ctx.characterFace(someone.index)) fail('square card', someone.name + ' has no face to show');
    let bare = null;
    for (let y = 0; y < ode.h && !bare; y++) for (let x = 0; x < ode.w; x++) {
      if (folk.some(c => Math.round(c.x) === x && Math.round(c.y) === y)) continue;
      if ((eO.result.props || []).some(p => p.cells.some(c => c[0] === x && c[1] === y))) continue;
      bare = { x, y }; break;
    }
    if (bare) {
      const quiet = ctx.squareCard(ode.resid & 0xFF, eO, bare.x, bare.y, ode.name, false);
      const asked = ctx.squareCard(ode.resid & 0xFF, eO, bare.x, bare.y, ode.name, true);
      if (quiet) fail('square card', 'a passing pointer got a card over bare ground');
      else if (!asked || !/hvWhat/.test(asked.html)) fail('square card', 'a held finger got no ground');
      else console.log('  square card: names ' + someone.name + '; quiet over bare ground; a held finger gets the ground');
    }
    const propSq = (eO.result.props || []).find(p => p.cells.length && !folk.some(c => Math.round(c.x) === p.cells[0][0] && Math.round(c.y) === p.cells[0][1]));
    if (propSq) {
      const cardQ = ctx.squareCard(ode.resid & 0xFF, eO, propSq.cells[0][0], propSq.cells[0][1], ode.name, false);
      if (!cardQ || !/hvName/.test(cardQ.html)) fail('square card', 'a square with a prop on it got no card');
    }

    // Full screen, in a browser with no element full screen: the panel is
    // pinned over the page and the button says how to leave.
    ctx.atlasToggleFull();
    const fullOn = ctx.document.body.classList.contains('atlasFull') && /Full screen off/.test(REGISTRY.get('atlasFullBtn').textContent);
    ctx.atlasToggleFull();
    const fullOff = !ctx.document.body.classList.contains('atlasFull') && !/off/.test(REGISTRY.get('atlasFullBtn').textContent);
    if (!fullOn || !fullOff) fail('atlas', 'full screen did not pin and unpin the panel');
    else console.log('  atlas: full screen pins the panel where the browser offers no better, and unpins');
    // The gate before a download: shown until answered, and the answer is
    // what the caller gets.
    {
      const pr = ctx.landingGate();
      const shown = REGISTRY.get('landingGate').style.display === 'flex';
      ctx.landingGateAnswer('own');
      const ans = await pr;
      const hidden = REGISTRY.get('landingGate').style.display === 'none';
      if (!shown || !hidden || ans !== 'own') fail('gate', 'the landing gate did not show, hide, or answer: ' + JSON.stringify([shown, hidden, ans]));
      else console.log('  gate: stands before the download, and answers with the button pressed');
      // The gate says why it is the whole installer and not the one file the
      // page reads: Ambrosia's licence allows the work to be passed on only
      // complete and unmodified (NOTICE quotes it). Read off the markup, since
      // the stub does not populate innerHTML from the page source.
      const gateSrc = html.slice(html.indexOf('id="landingGate"'), html.indexOf('id="atlasPanel"'));
      if (!/downloads its installer from archive\.org/.test(gateSrc) || !/28&nbsp;MB/.test(gateSrc) || !/read directly from the supplied file/.test(gateSrc)) fail('gate', 'the gate no longer says what is downloaded and what is read');
      else console.log('  gate: says what is downloaded, how big it is, and what is read from the file');
    }
    // The names are the game's own: the mouth into Land King Hall says so,
    // not the editor's "LKH"; and two "Ruins" are told apart by the
    // editor's name after the game's.
    {
      const sc2 = peek('surfaceScene')();
      const wm = peek('atlasMouths')(sc2.root);
      const lkh = wm.find(m => m.dest.resid === 0x8003);
      const names = sc2.nodes.map(n => n.name).concat(wm.map(m => m.name));
      if (!lkh || lkh.name !== 'Land King Hall' || names.some(n => /\bLKH\b/.test(n))) fail('atlas', 'the world still says LKH: ' + (lkh && lkh.name));
      // (This section runs without the fork -- the deep-link check above
      // re-opened the data fork alone -- so the editor's name is only
      // expected when the fork is there.)
      else if (!sc2.nodes.some(n => n.name === (peek('window.CYTHERA_RSRC') ? 'Headwater Ruins' : 'Ruins')) || names.some(n => / · /.test(n))) fail('atlas', 'a shared name is doubled up, or the editor’s does not stand in for it: ' + names.join(', '));
      else {
        // Through the arch into the hall, then zoomed onto the hole at
        // (50,5) at 24 px a square -- nowhere near the last notch of the
        // zoom -- goes down into the Underground. Full screen's overlay
        // names where you are.
        ctx.ATLAS_TUNE.animMs = 0;                 // the stub has no frames to animate in
        const vp2 = REGISTRY.get('atlasViewport');
        const vw = vp2.clientWidth || 300, vh = vp2.clientHeight || 300;
        const av = peek('atlasView');
        // A zoom onto the hole into the hall goes nowhere by itself
        av.Z = 40; av.x = vw / 2 - 163.5 * 40; av.y = vh / 2 - 20.5 * 40; ctx.paintAtlas();
        peek('atlasGesture').active = true; peek('atlasGesture').z0 = 20; ctx.atlasGestureEnd();
        const stayedUp = !peek('atlasBelowTop')();
        // A tap on its ring falls in from that view and arrives at half the zoom
        const q = (peek('ATLAS_MOUTHS') || []).find(q => q.m.dest.resid === 0x8003);
        if (q) ctx.atlasTakeMouth(q.m, q.node);
        const inHall = peek('atlasBelowTop')();
        const arrivedZ = av.Z;
        // In the hall the arch to the world is a blue ring; the hole down is gold
        av.Z = 24; av.x = vw / 2 - 50.5 * 24; av.y = vh / 2 - 5.5 * 24; ctx.paintAtlas();
        const hallRoot = peek('atlasScene')().root;
        const rings = peek('atlasMouths')(hallRoot).map(m => ({ m, node: hallRoot }));   // the arch is off screen at this view
        const hole = rings.find(q => q.m.dest.resid === 0x8009), arch = rings.find(q => q.m.dest.resid === 0x8001);
        if (hole) ctx.atlasTakeMouth(hole.m, hole.node);
        const top = peek('atlasBelowTop')();
        // and a tap on a blue ring rises to the map it names
        ctx.paintAtlas();
        const ugRoot = peek('atlasScene')().root;
        const upRing = peek('atlasMouths')(ugRoot).filter(m => m.up && m.dest.resid === 0x8003).map(m => ({ m, node: ugRoot }))[0];
        let rose = null;
        if (upRing) { ctx.atlasTakeMouth(upRing.m, upRing.node); rose = peek('atlasBelowTop')(); }
        if (!stayedUp) fail('atlas', 'a zoom onto the hole went through it by itself');
        else if (!q || !inHall || inHall.resid !== 0x8003) fail('atlas', 'tapping the ring into the hall did not go in: ' + (inHall && inHall.resid.toString(16)));
        else if (Math.abs(arrivedZ - 20) > 0.5) fail('atlas', 'did not arrive at half the zoom it fell in at: ' + arrivedZ);
        else if (!hole || !arch || !arch.m.up || hole.m.up) fail('atlas', 'the hall’s rings are not one gold down and one blue up: ' + JSON.stringify(rings.map(r => [r.m.name, !!r.m.up])));
        else if (!top || top.resid !== 0x8009) fail('atlas', 'tapping the hole did not go down: ' + (top && top.resid.toString(16)));
        else if (!upRing || !rose || rose.resid !== 0x8003) fail('atlas', 'tapping the blue ring did not rise to the hall: ' + (rose && rose.resid.toString(16)));
        // back down for the overlay check
        if (hole && rose && rose.resid === 0x8003) { const r2 = peek('atlasScene')().root; const h2 = peek('atlasMouths')(r2).find(m => m.dest.resid === 0x8009); if (h2) ctx.atlasTakeMouth(h2, r2); }
        const top2 = peek('atlasBelowTop')();
        if (!top2 || top2.resid !== 0x8009) fail('atlas', 'the hole did not open again on a second tap');
        ctx.atlasToggleFull();
        const where = REGISTRY.get('atlasFullWhere').textContent;
        ctx.atlasToggleFull();
        if (!top || top.resid !== 0x8009) fail('atlas', 'zooming onto the hole in Land King Hall did not go down: at ' + (top && top.resid.toString(16)) + ', mouths ' + holes.join(' '));
        else if (where !== 'Underground') fail('atlas', 'the full-screen overlay does not say where you are: ' + JSON.stringify(where));
        else console.log('  atlas: the world says Land King Hall, not LKH; a zoom goes nowhere, a tap on a gold ring falls in at half the zoom, a tap on a blue ring rises; full screen names the place');
        while (peek('atlasBelowTop')()) ctx.atlasAscend();
        ctx.atlasFitAndPaint();
      }
    }
    drainRaf();
  }
} catch (e) { fail('atlas', e); }

