/* The atlas: the world as one continuous picture, and what the archive locates.

   One of the fourteen js/page-*.js files that were index.html's inline
   script until 16 September 2026, cut at its own section banners and
   nowhere else, so every function is where it was in the one file. This
   tier knows the page's furniture: js/mac-*.js know nothing of Cythera,
   js/delv-*.js know the formats but not the page, and these know both.
   They are classic scripts, never modules, because the page has to work
   from a file:// origin, and they share one global scope, so a name
   declared in any of them is reachable from all. The order only decides
   what has run when a statement runs at load time; the one such statement
   that needed a later file, the brand line, stayed in the page after the
   last of these. File 7 of 14. */

/* ===========================================================================
   The Atlas: the world as one continuous picture
   ===========================================================================
   The World tab's second renderer, and the one this file is moving to. It
   exists because the first one borrowed the map panel -- a thing built, quite
   correctly, around one map at a time -- and then spent 425 lines persuading
   it to behave like a continuous world: a cross-fade, a landing calculation,
   a stack, a hold, four thresholds to cross and two to come back, a second
   copy of the world drawn behind each town, and three separate
   implementations of "keep this layer registered with the map while it
   moves". Every display bug reported against the World tab was in that layer
   rather than in the feature, which is the sign the compensation had outgrown
   the thing it was compensating for.

   What replaces it is a scene rather than a sequence of views.

   ONE COORDINATE SYSTEM. Everything is placed in world squares -- the 256x256
   grid of map 0x8001 -- and the view is three numbers: `x`, `y` and `Z`,
   where a world square is Z screen pixels and world square w lands at
   `x + w*Z`. Every node, every label, every hit test goes through that and
   nothing else.

   A TREE OF PLACED MAPS. The world is the root. Each gateway places its
   destination as a child, scaled by gatewayTransform so its built part covers
   the pictogram the world map draws there. Cademia is not somewhere you go;
   it is a node that becomes large as you approach it.

   REDRAW, DO NOT SLIDE. The whole scene is a couple of dozen drawImage calls,
   so every frame is painted fresh. There is nothing to keep registered, which
   is why the entire class of bug that produced "the labels slide when I pan"
   and "the country splits off to the left" cannot occur here: those were
   layers painted once in screen space and transformed to catch up. Nothing
   here is painted once.

   NO CROSSING. There is no moment when one map is exchanged for another, so
   there is nothing to fade, nothing to land, nothing to hold, and nothing to
   pop off a stack. Zooming in makes a town bigger; zooming out makes it
   smaller. Which place you are "in" is not state -- it is read off the view
   by whichever node fills it.

   What it deliberately does NOT do is the map panel's job. Walls, roofs,
   marks, walk-the-day, lighting, the PNG export and the prop editor stay in
   Entities > Regions, which is untouched; a square here offers to open its
   map there. This renderer navigates and identifies. That is the seam, and
   keeping it is what makes this a few hundred lines instead of a second copy
   of the panel.
=========================================================================== */

// The old renderer is still here and still works; this switches between them
// so the two can be compared on a real device, which is where every bug in
// this feature has been found. Once the atlas has earned it, the other one
// and its 425 lines of compensation go.
window.ATLAS = (() => {
  try { const v = localStorage.getItem('cythera.atlas'); if (v !== null) return v === '1'; } catch (e) { quiet(e); }
  return true;
})();

/* How many world squares a node's built part covers, and where.

   One function, and that is the point: the miniature's size, the country's
   scale and the landing view were three separate expressions of this same
   transform, two of them disagreed, and the disagreement was the jump on
   entering a town. There is one answer now and everything asks it.

   `s` is world squares per node square; `ox, oy` place node square (0,0) in
   world coordinates. A node point p is therefore at world `ox + p*s`. */
const atlasTransforms = new Map();
function gatewayTransform(gw) {
  if (atlasTransforms.has(gw.port)) return atlasTransforms.get(gw.port);
  let t = null;
  const e = mapRenderFor(gw.destResid, true);
  if (e && e.result) {
    const b = contentBox(gw.destResid) ||
              { x0: 0, y0: 0, x1: e.result.width - 1, y1: e.result.height - 1 };
    const s = 1 / gatewayRatio(gw);
    // The built part's middle sits on the pictogram's middle.
    const pcx = (b.x0 + b.x1 + 1) / 2, pcy = (b.y0 + b.y1 + 1) / 2;
    t = { s,
          ox: (gw.x0 + gw.x1 + 1) / 2 - pcx * s,
          oy: (gw.y0 + gw.y1 + 1) / 2 - pcy * s,
          w: e.result.width, h: e.result.height, ts: e.result.tileSize };
  }
  atlasTransforms.set(gw.port, t);
  return t;
}

/* What a map leads to: the props on it that travel somewhere else.

   propTravelsTo is the same join the world map uses; off the world map it
   reads only the types that are portals anywhere -- a cave, a stair, a
   trapdoor, an arch -- so a `large city` prop standing as a building inside
   Cademia is not mistaken for a way out of it.

   Every one of them, and that is deliberate. This used to keep one mouth per
   destination, on the reasoning that two stairs to the same cellar are one
   place below rather than two -- which is true of the place and false of the
   ground you are standing on. It hid 59 of the archive's 111 passages,
   including three of Pnyx's four stairs, and there is no way to tell from
   the drawing that a ring stands for more than the square it is on. Four
   rings side by side leading to the same map is what the file says, so it is
   what is drawn (the maintainer, 8 September 2026).

   The 44 passages whose zoneport lands on the map they are already on are
   kept for the same reason: they are ways through, the two ends are usually
   nowhere near each other, and Pnyx's five are what raised this. All 44 are
   on maps below ground -- the Iron Mine's ladders, the Volcano's holes, the
   Sewers, Pnyx upstairs -- so the surface filter in atlasMouths never meets
   one. Taking one moves within the map rather than down a level:
   atlasCrossWithin. */
function mapDescents(resid) {
  const out = [];
  try {
    const raw = getResourceBytes(ARCHIVE, resid + 0x100);
    if (!raw) return out;
    for (const r of parseDelverPropList(smartDecrypt(raw, resid + 0x100).data)) {
      if (!r.onMap || r.flags === 0xFF || (r.flags & 0x58)) continue;
      if (r.flags === 0x42 || r.flags === 0x44) continue;
      const dest = propTravelsTo(r, resid);
      if (!dest || !refExists(dest.resid)) continue;
      out.push({ dest, x: r.x, y: r.y,
                 name: zoneNameFor(dest.resid) || dest.name,
                 kind: (propDisplayName(r.proptype) || 'way down').toLowerCase() });
    }
  } catch (e) { quiet(e); }
  return out;
}

/* ---------------------------------------------------------------------------
   What the archive locates, and what it does not
   ---------------------------------------------------------------------------
   A map header's four edge fields say where walking off each side puts you.
   Where one of them lands on the world map, the archive is making a spatial
   statement -- *this map is contiguous with the world at that square* -- and
   that is what makes it placeable. 23 of the 42 maps say it: every town,
   farm, vineyard, ruin and stronghold, the Sitia bridge, and a couple whose
   names are misleading (the Underground under Catamarca and Pnyx upstairs
   both have edges to the world).

   The other 17 say nothing of the kind. Land King Hall, the Sewers, the Iron
   Mine, the Volcano, the Tomb, the Caves, Below Cademia, the Dungeon, the
   Cove: what the archive gives for each is a doorway, not an extent. A stair
   says where you go in, not where the place reaches, and the Sewers do not
   lie under any particular nine squares of Cademia.

   So the atlas places what the archive locates and no more. The rest is
   reached through it rather than drawn in it -- see atlasDescend. An earlier
   version put all 37 into the scene at an invented scale, and the invented
   part was visible: it is the difference between a map and a graph, and
   drawing a graph as a map is a claim the file does not support.
--------------------------------------------------------------------------- */
const locatedCache = new Map();
function mapWorldAnchor(resid) {
  if (locatedCache.has(resid)) return locatedCache.get(resid);
  let anchor = null;
  try {
    const raw = getResourceBytes(ARCHIVE, resid);
    if (raw) {
      let { data, wasDecrypted } = smartDecrypt(raw, resid);
      let m = parseDelverMap(data);
      if (!m) { const alt = wasDecrypted ? raw : decryptResource(raw, resid); m = parseDelverMap(alt); }
      if (m) {
        for (const idx of [m.exitZoneportNorth, m.exitZoneportEast,
                           m.exitZoneportSouth, m.exitZoneportWest]) {
          if (!idx) continue;
          const z = zoneportInfo(idx);
          if (z && z.resid === WORLD_MAP_RESID) { anchor = { x: z.x, y: z.y }; break; }
        }
      }
    }
  } catch (e) { quiet(e); }
  locatedCache.set(resid, anchor);
  return anchor;
}
function mapIsLocated(resid) { return !!mapWorldAnchor(resid); }

/* Located is not the same as on the surface, and the difference was
   visible: Scylla Temple, whose edge exit does land on the world, was drawn
   spread over the ground beside its cave mouth, and the Sitia bridge, which
   nothing on the world map draws, was placed at the square its edge names
   and looked off-centre because that square is not its middle.

   Three things the archive says decide it, and a map must say all three
   to be drawn on the world. Its edge leads to the world (located). Its
   entry script sets a landscape strip rather than one of the engine's own
   backdrops -- a horizon is what the player sees from an outdoor place,
   and the Temple's script sets -16, a backdrop, which is the file saying
   "inside". And the world map draws it, with a pictogram that is a place
   rather than a way in: a town, a ruin, a farm; not a cave mouth or a hole,
   which the world draws where something is entered, not where it lies.

   Everything else is reached through a mouth, the bridge included: a ring
   on the square the archive does give, and a step. That is what the
   maintainer asked for on 5 September 2026 -- treat it like a tunnel rather
   than mask the data -- and it is the file's own reading. 17 maps make the
   surface; 6 that are located do not: the Temple, Harpy Abyss, the bridge,
   Pnyx upstairs, Tavara without its fortress, and the underground under
   Catamarca. The mouths are named from the editor's list where it has a
   name (editorZoneName), since the scripts call Tavara without its
   fortress "Cythera" and the Harpy Abyss "Mountains". */
// A mineshaft is not here: the Mining Camp is an outdoor camp around one,
// with a horizon in its script, and the shaft is how the world draws it.
// Land King Hall is drawn by an arch, and it is an interior by the file's
// other two tests as well: its entry script sets a backdrop (-1), and its
// header's exits do not land on the world. So it is a mouth, named from
// its own script "Land King Hall", and its hall is entered through it.
const ENTRANCE_PICTOGRAMS = /cave|hole|stair|trapdoor|door|arch|ladder/;
const surfaceCache = new Map();
function mapIsSurface(resid) {
  if (surfaceCache.has(resid)) return surfaceCache.get(resid);
  let on = false;
  try {
    if (mapIsLocated(resid)) {
      const gw = worldGateways().find(g => g.destResid === resid);
      const land = zoneLandscapeArg(resid & 0xFF);
      on = !!gw && !ENTRANCE_PICTOGRAMS.test(gw.kind) && (land === null || land === undefined || land >= 0);
    }
  } catch (e) { on = false; }
  surfaceCache.set(resid, on);
  return on;
}

/* The surface: the world, and the maps the archive puts on it.

   A gateway's pictogram gives both a position and an extent, and those are
   preferred. A located map with no pictogram -- the bridge, Pnyx upstairs --
   is placed at the world square its own edge exit names, at the measured
   median scale, because the archive has said where it is even though nothing
   on the world map draws it. */
function surfaceScene() {
  if (DERIVED.ATLAS_SCENE) return DERIVED.ATLAS_SCENE;
  const nodes = [];
  const world = mapRenderFor(WORLD_MAP_RESID, true);
  if (!world || !world.result) return null;
  const root = { resid: WORLD_MAP_RESID, gw: null, s: 1, ox: 0, oy: 0,
                 w: world.result.width, h: world.result.height,
                 ts: world.result.tileSize, name: 'Cythera', depth: 0, key: 'w' };
  nodes.push(root);
  const placed = new Set([WORLD_MAP_RESID]);
  for (const gw of worldGateways()) {
    if (!mapIsSurface(gw.destResid) || placed.has(gw.destResid)) continue;
    const t = gatewayTransform(gw);
    if (!t) continue;
    placed.add(gw.destResid);
    nodes.push({ resid: gw.destResid, gw, s: t.s, ox: t.ox, oy: t.oy,
                 w: t.w, h: t.h, ts: t.ts, name: atlasMapName(gw.destResid) || gw.name, depth: 1,
                 key: 'g' + gw.port });
  }
  // A located map with no pictogram used to be placed here at the square
  // its edge names, at the median scale. It is a mouth now (atlasMouths):
  // the square is the file's, the extent was ours.
  nodes.sort((a, b) => a.depth - b.depth);
  return (DERIVED.ATLAS_SCENE = { root, nodes, surface: true });
}

/* A place the archive does not locate, shown on its own.

   One node, at its own scale, filling the view -- because there is no honest
   answer to where it sits and the right thing is not to imply one. How you
   got here is written in the strip rather than drawn on the ground. */
const belowScenes = new Map();
function belowScene(resid) {
  if (belowScenes.has(resid)) return belowScenes.get(resid);
  const e = mapRenderFor(resid, true);
  let sc = null;
  if (e && e.result) {
    const root = { resid, gw: null, s: 1, ox: 0, oy: 0,
                   w: e.result.width, h: e.result.height, ts: e.result.tileSize,
                   name: atlasMapName(resid),
                   depth: 0, key: 'b' + resid };
    sc = { root, nodes: [root], surface: false };
  }
  belowScenes.set(resid, sc);
  return sc;
}

/* Where you are: the surface, or somewhere reached through it.

   A stack, because the underworld is a graph and going two mouths deep is an
   ordinary thing to do. It is state, but it is the only state in this
   renderer -- and it is honest state, because "which unlocated map am I
   looking at" genuinely is not derivable from a position on the world. */
DERIVED.ATLAS_BELOW = [];
function atlasBelowTop() {
  const st = DERIVED.ATLAS_BELOW;
  return (st && st.length) ? st[st.length - 1] : null;
}
function atlasScene() {
  const b = atlasBelowTop();
  return b ? belowScene(b.resid) : surfaceScene();
}

/* What the atlas calls a map: the name the game shows the player, read off
   the map's entry script (zoneNameFor), and only where that name is shared
   by more than one map in the archive -- two "Ruins", two "Caves" -- the
   editor's more specific name after it, so "Caves · Harpy Cave". The
   editor's list is the file's too, but it is not what the player sees:
   its "LKH" is the game's "Land King Hall". */
let atlasNameCounts = null;
function atlasMapName(resid) {
  const own = zoneNameFor(resid) || null;
  if (!own) return editorZoneName(resid) || labelFor(resid) || ('0x' + resid.toString(16));
  if (!atlasNameCounts) {
    atlasNameCounts = new Map();
    for (let n = 0; n < 0x100; n++) {
      const r = 0x8000 | n;
      let nm = null;
      try { if (refExists(r)) nm = zoneNameFor(r); } catch (e) { quiet(e); }
      if (nm) atlasNameCounts.set(nm, (atlasNameCounts.get(nm) || 0) + 1);
    }
  }
  // A shared name is never doubled up. With the outside names on (the
  // default) the editor's one stands in for it; off, the game's own stands,
  // twice on the map if that is what the game says.
  if ((atlasNameCounts.get(own) || 0) > 1 && window.SHOW_BUILTIN_LABELS) {
    const ez = editorZoneName(resid);
    if (ez && ez.toLowerCase() !== own.toLowerCase()) return ez;
    const lb = labelFor(resid);
    if (lb && lb.toLowerCase() !== own.toLowerCase()) return lb;
  }
  return own;
}

/* The mouths on a node: the ways from it into somewhere the archive does not
   locate. Drawn as a ring and a name where the node is big enough to see
   them, and that is the whole of the affordance -- a mouth is a connection,
   so it gets a mark rather than a place. */
function atlasMouths(node) {
  if (node._mouths) return node._mouths;
  // On the surface a place's exits to the world are the edge of the place,
  // not rings. Below ground every way out is a ring: down into somewhere
  // deeper, or up -- to the world, to a surface place, or back to the map
  // you came through -- and the ring says which.
  const onSurface = !!(DERIVED.ATLAS_SCENE && DERIVED.ATLAS_SCENE.nodes.includes(node));
  const from = atlasBelowTop();
  const out = mapDescents(node.resid)
    .filter(d => onSurface ? (!mapIsSurface(d.dest.resid) && d.dest.resid !== WORLD_MAP_RESID) : true)
    .map(d => Object.assign({}, d, {
      // A ring that lands on the map you are already standing on is named by
      // the square it lands on: repeating the map's own name beside every one
      // of them says nothing, and the square is the fact the file gives.
      name: d.dest.resid === node.resid ? (d.dest.x + ', ' + d.dest.y)
                                        : (atlasMapName(d.dest.resid) || d.name),
      within: d.dest.resid === node.resid,
      up: !onSurface && d.dest.resid !== node.resid &&
          (d.dest.resid === WORLD_MAP_RESID || mapIsSurface(d.dest.resid) || (from && d.dest.resid === from.fromResid))
    }));
  // On the world, the maps whose edge leads here but which the world draws
  // nothing for -- the bridge, Pnyx upstairs -- are mouths at that square:
  // the one thing the file says about where they are.
  // This branch renders every below-ground map with a world anchor, to find
  // the square a ring should land on, and the answer is memoised on the node
  // with nothing anywhere to invalidate it. So it is all or nothing: built
  // while the view is moving it would cache a SHORT list of rings for the
  // rest of the session. While busy, hand back what is already built and
  // remember nothing.
  if (node.resid === WORLD_MAP_RESID && atlasInMotion()) return node._mouths || [];
  if (node.resid === WORLD_MAP_RESID) {
    const have = new Set(out.map(d => d.dest.resid));
    // A map some surface place already leads down into -- the springs under
    // Catamarca, the upstairs of Pnyx -- is that place's ring, not a ring
    // out on the world at the square its own edge happens to name.
    try {
      const sc = DERIVED.ATLAS_SCENE;
      if (sc) for (const n of sc.nodes) if (n.depth) for (const d of mapDescents(n.resid)) have.add(d.dest.resid);
    } catch (e) { quiet(e); }
    for (let n = 0; n < 0x100; n++) {
      const resid = 0x8000 | n;
      if (resid === WORLD_MAP_RESID || have.has(resid) || !refExists(resid)) continue;
      if (mapIsSurface(resid)) continue;
      const a = mapWorldAnchor(resid);
      if (!a) continue;
      const e = mapRenderFor(resid, true);
      if (!e || !e.result) continue;
      out.push({ x: a.x, y: a.y,
                 dest: { resid, x: Math.floor(e.result.width / 2), y: Math.floor(e.result.height / 2) },
                 name: atlasMapName(resid),
                 kind: 'map’s edge' });
    }
  }
  // A ring is named for where it goes and nothing further. It used to add
  // the ways on from there -- "Harpy Abyss, then Harpy Cave" (19 September
  // 2026) -- which read as two places at one hole, and on 22 September the
  // maintainer asked for the place alone.
  for (const m of out) m.label = m.name;
  return (node._mouths = out);
}

// Where a node lands on screen
// Where a node lands on screen, in pixels, at the current view.
function atlasRect(node, view) {
  return { x: view.x + node.ox * view.Z, y: view.y + node.oy * view.Z,
           w: node.w * node.s * view.Z, h: node.h * node.s * view.Z };
}

// Screen pixels per square of this node's own map -- what decides the
// resolution it is worth drawing at, and whether it is worth drawing at all.
function atlasNodePpt(node, view) { return node.s * view.Z; }

/* The view. Three numbers, and every other position on screen is derived. */
const atlasView = { x: 0, y: 0, Z: 2, dragging: false, lastX: 0, lastY: 0, touching: false };

// The whole world in the panel, which is where a visit starts: the island
// rather than the square map it sits in, so the sea round it is cropped
// (atlasLandBounds). A map below ground is fitted whole.
function atlasFit() {
  const vp = document.getElementById('atlasViewport');
  const sc = atlasScene();
  if (!vp || !sc || vp.clientWidth < 40) return;
  const vw = vp.clientWidth, vh = vp.clientHeight;
  const b = (sc.surface && atlasLandBounds()) || { x0: 0, y0: 0, x1: sc.root.w, y1: sc.root.h };
  const bw = b.x1 - b.x0, bh = b.y1 - b.y0;
  atlasView.Z = Math.min(vw / bw, vh / bh);
  atlasView.x = (vw - bw * atlasView.Z) / 2 - b.x0 * atlasView.Z;
  atlasView.y = (vh - bh * atlasView.Z) / 2 - b.y0 * atlasView.Z;
}
/* The island's extent on the world map, in squares, with a margin of sea.
   The sea is whatever the map's outermost ring is drawn with, and the land
   every square drawn with anything else; the world is 256 squares a side
   and the island a narrow thing in the middle of it, so fitting the square
   put two thirds of a phone's picture in water (the maintainer, 22
   September 2026: the world did not use the height of the screen). Null
   when the ring is not all one kind of thing or nothing else is found. */
function atlasLandBounds() {
  if (DERIVED.ATLAS_LAND !== undefined) return DERIVED.ATLAS_LAND;
  let out = null;
  try {
    const m = mapRenderFor(WORLD_MAP_RESID, true).result.m;
    const W = m.width, H = m.height, sea = new Set();
    for (let x = 0; x < W; x++) { sea.add(mapTileAt(m, x, 0)); sea.add(mapTileAt(m, x, H - 1)); }
    for (let y = 0; y < H; y++) { sea.add(mapTileAt(m, 0, y)); sea.add(mapTileAt(m, W - 1, y)); }
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (sea.has(mapTileAt(m, x, y))) continue;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const pad = 4;
    if (x1 >= 0 && sea.size <= 8) out = { x0: Math.max(0, x0 - pad), y0: Math.max(0, y0 - pad), x1: Math.min(W, x1 + 1 + pad), y1: Math.min(H, y1 + 1 + pad) };
  } catch (e) { quiet(e); }
  return (DERIVED.ATLAS_LAND = out);
}

/* The most a node is worth magnifying: its own art is 32 pixels a square, so
   past twice that there is nothing further in the file to show. The zoom
   stops where the deepest thing under the middle of the view runs out. */
function atlasMaxZ() {
  const sc = atlasScene();
  if (!sc) return 64;
  const cap = window.ATLAS_TUNE.maxPpt;
  let best = cap;                                 // the world itself
  for (const n of sc.nodes) if (n.depth) best = Math.max(best, cap / n.s);
  return best;
}

/* Draw the scene.

   Every frame, from scratch, in one pass. A node is drawn from the smallest
   picture that is at least as big as it needs to be -- the two thumbnail
   levels, then its whole render, then its own art a window at a time -- and
   fades in over the pictogram it stands on as it becomes large enough to read.
   That fade is the only threshold left in the renderer. */
/* The numbers that decide how the atlas behaves.

   TEMPORARY in this form: they are constants in spirit and are written here
   as defaults, but every one of them is a "does this feel right on a real
   screen" question, so while they are being settled they live in an object
   were moved on a real screen before they were settled. */
const ATLAS_TUNE_DEFAULTS = {
  nodeFadeFrom: 8,       // px across: a place begins to replace its pictogram
  nodeFadeTo: 90,        // px across: and has fully replaced it
  mouthAt: 7,            // px per square before a place's mouths are ringed
  animMs: 1000,          // ms: the fall into a mouth, and the rise out of it
  peopleAt: 6,           // px per square before the inhabitants are drawn
  maxPpt: 64             // px per square: the most magnification worth having
};
// Settled by the maintainer on a real screen, 9 September 2026 (8, 90, 7,
// 1000, 6, 64), and the strip that moved them is gone. They stay in one
// object because the smoke test moves nodeFadeFrom to prove the fade.
window.ATLAS_TUNE = Object.assign({}, ATLAS_TUNE_DEFAULTS);
function paintAtlas() {
  const vp = document.getElementById('atlasViewport');
  const cv = ensureAtlasCanvas();
  const sc = atlasScene();
  if (!vp || !cv || !sc) return;
  const vw = vp.clientWidth, vh = vp.clientHeight;
  if (vw < 40 || vh < 40) return;
  // Two device pixels per CSS pixel at rest, one while a finger is down: a
  // phone's screen is three, and painting the scene four times over per
  // frame is what it could not keep up with. The moment the finger lifts
  // the scene is painted sharp again (setupAtlasInteraction).
  const dpr = atlasView.touching ? 1 : Math.min((typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1, 2);
  if (cv.width !== Math.round(vw * dpr) || cv.height !== Math.round(vh * dpr)) {
    cv.width = Math.round(vw * dpr); cv.height = Math.round(vh * dpr);
    cv.style.width = vw + 'px'; cv.style.height = vh + 'px';
  }
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  paintAtlasGround(ctx, vw, vh);

  const drawn = [];
  for (const node of sc.nodes) {
    const r = atlasRect(node, atlasView);
    if (r.x + r.w < -40 || r.y + r.h < -40 || r.x > vw + 40 || r.y > vh + 40) continue;
    const ppt = atlasNodePpt(node, atlasView);
    // Below a couple of pixels a square there is nothing to see and the
    // pictogram the parent draws is the better picture.
    if (node.depth && r.w < window.ATLAS_TUNE.nodeFadeFrom) continue;
    const alpha = !node.depth ? 1
      : Math.max(0, Math.min(1, (r.w - window.ATLAS_TUNE.nodeFadeFrom) /
                (window.ATLAS_TUNE.nodeFadeTo - window.ATLAS_TUNE.nodeFadeFrom)));
    if (drawAtlasNode(ctx, node, r, ppt, alpha, vw, vh)) {
      ctx.globalAlpha = alpha;
      atlasPeople(ctx, node, r, ppt);
      ctx.globalAlpha = 1;
      drawn.push({ node, r });
    }
  }
  const mouths = atlasPaintMouths(ctx, drawn, vw, vh);
  atlasPaintTowns(ctx, drawn, vw, vh);
  atlasPaintSelection(ctx, drawn);
  atlasLabels(ctx, drawn, vw, vh);
  window.ATLAS_DRAWN = drawn;
  window.ATLAS_MOUTHS = mouths;
  if (atlasIsFull()) atlasUpdateFullOverlay(drawn);
}

/* One node, at the best resolution it has.

   The ladder is the same one the old renderer used and it is kept: two
   thumbnail levels, then the whole render, then -- when even that is being
   magnified -- the node's own art painted a window at a time through the map
   panel's own region painter. That last step is what the detail lens was, with
   the difference that it is drawn straight into the scene rather than being a
   second canvas kept in step with a first. */
function drawAtlasNode(ctx, node, r, ppt, alpha, vw, vh) {
  ctx.globalAlpha = alpha;
  ctx.imageSmoothingEnabled = true;
  let ok = false;
  // Native art, when the node is being magnified past its own render.
  if (ppt > node.ts * 1.2) ok = paintAtlasDetail(ctx, node, r, vw, vh);
  // The roofs come off as the node grows: a town at a distance is roofs,
  // and close up they are the thing in the way. They used to vanish at the
  // step from the miniature to the render, at 448 screen pixels across,
  // which the maintainer found the right distance and the wrong manner; so
  // they fade over a band centred on it (atlasRoofT), and a town drawn from
  // its render or its own art gets its roofed miniature laid over at what
  // is left of them.
  const roofT = atlasRoofT(r.w);
  let viaTown = false;
  if (!ok) {
    // A town under 448 px across is drawn from its miniature and its render
    // is not asked for. It used to be: mapRenderFor was called for every
    // node on screen before the miniature was looked at, and the cache
    // holds four maps, so with the whole island in view every frame
    // rendered a dozen towns and threw them away again. That was the
    // judder below 5 px a square, the first thing a visitor sees (the
    // maintainer, 9 September 2026). A town with no miniature yet is
    // left to the world's own pictogram until the builder makes one.
    const thumb = node.gw && worldThumbs.get(thumbKey(node.resid, THUMB_LEVELS[0], true));
    if (r.w < 448 && thumb) {
      ok = drawTown(ctx, node.gw, atlasCropRect(node, r), alpha, roofT);
      viaTown = true;
    } else if (r.w >= 448 || !node.gw) {
      // The same judder, one zoom band up (the maintainer, 12 September 2026).
      // The 448 guard above stopped every node on screen being rendered while
      // the island was in view, but this branch still asked for a full render
      // per node per frame once nodes grew past it, and the cache keeps two
      // on iOS and four elsewhere. Three big towns in view at an intermediate
      // zoom therefore evicted each other every frame and re-rendered every
      // frame. So while the view is moving take a render only if it is
      // already cached, and otherwise draw the miniature: setTouching(false)
      // and the animation's own done() both repaint, so the sharp version
      // arrives the instant the gesture ends, which is the contract the
      // device-pixel-ratio drop above already relies on.
      const e = mapRenderIfCheap(node.resid);
      if (e && e.result) { drawRenderWithMargin(ctx, node, r, e.result.canvas, alpha, roofT); ok = true; }
      else if (thumb) { ok = drawTown(ctx, node.gw, atlasCropRect(node, r), alpha, roofT); viaTown = true; }
    }
  }
  if (ok && !viaTown && node.gw && roofT > 0.02) {
    const roofed = worldThumbs.get(thumbKey(node.resid, THUMB_LEVELS[1], true)) ||
                   worldThumbs.get(thumbKey(node.resid, THUMB_LEVELS[0], true));
    if (roofed) {
      const cr = atlasCropRect(node, r);
      ctx.globalAlpha = alpha * roofT;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(roofed.canvas, cr.x, cr.y, cr.w, cr.h);
    }
  }
  ctx.globalAlpha = 1;
  return ok;
}
// How much roof is left at a width on screen: all of it up to 360 px across,
// none from 540, and a straight fade between -- the band sits on the 448 px
// step where they used to cut.
function atlasRoofT(w) { return Math.max(0, Math.min(1, (540 - w) / (540 - 360))); }

/* The outer part of a region fades in as the roofs fade out.

   A town's map is bigger than the town: Cademia's is 128 squares and the
   built part 107, and the rest is the unbuilt margin of the grid. The
   miniature is cropped to the built part, so at the step to the render the
   margin used to appear all at once around a town that had just lost its
   roofs. Now the built part is always drawn whole and the margin at what
   the roofs have given up -- the same band, run the other way -- so the
   two changes are one change: the place resolves and its ground with it.
   Both the render and the native-art window go through this. */
function drawWithMargin(ctx, node, r, alpha, roofT, draw) {
  // The world itself has no built part and no roofs: it is drawn whole.
  // Clipping it to its prop box cut the top forty rows and the bottom
  // twenty of the island at the zoomed-out view, which the sea fill made
  // visible on 6 September 2026.
  const b = node.depth ? contentBox(node.resid) : null;
  if (!b || roofT <= 0.02) { ctx.globalAlpha = alpha; draw(); return; }
  const per = r.w / node.w;
  if (roofT < 0.98) { ctx.globalAlpha = alpha * (1 - roofT); draw(); }
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x + b.x0 * per, r.y + b.y0 * per, (b.x1 - b.x0 + 1) * per, (b.y1 - b.y0 + 1) * per);
  ctx.clip();
  ctx.globalAlpha = alpha;
  draw();
  ctx.restore();
}
/* A render at every halving, built once and kept beside it. Drawing the
   world's 2,048 px render at 700 px across is a fresh downscale of four
   million pixels every frame, and Chrome does that in software; it was the
   judder below 5 px a square (the maintainer, 9 September 2026). From the
   level nearest above the size on screen the scale is under two and the
   draw is cheap. Keyed on the canvas itself, so a re-render starts over. */
const _atlasMips = new WeakMap();
function atlasMip(canvas, targetW) {
  if (!canvas || !canvas.width || targetW >= canvas.width / 2) return canvas;
  let levels = _atlasMips.get(canvas);
  if (!levels) { levels = [canvas]; _atlasMips.set(canvas, levels); }
  let cur = levels[levels.length - 1];
  while (cur.width / 2 >= targetW && cur.width > 64) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(cur.width / 2)); c.height = Math.max(1, Math.round(cur.height / 2));
    const g = c.getContext('2d');
    if (!g) break;
    g.imageSmoothingEnabled = true;
    g.drawImage(cur, 0, 0, c.width, c.height);
    levels.push(c); cur = c;
  }
  let best = levels[0];
  for (const l of levels) if (l.width >= targetW) best = l;
  return best;
}
function drawRenderWithMargin(ctx, node, r, canvas, alpha, roofT) {
  const src = atlasMip(canvas, r.w);
  drawWithMargin(ctx, node, r, alpha, roofT, () => ctx.drawImage(src, r.x, r.y, r.w, r.h));
}

// Where a node's cropped thumbnail sits, given where the whole node sits.
function atlasCropRect(node, r) {
  const th = worldThumbs.get(thumbKey(node.resid, THUMB_LEVELS[0], true));
  if (!th) return r;
  const per = r.w / node.w;                 // screen px per node square
  return { x: r.x + th.x0 * per, y: r.y + th.y0 * per,
           w: (th.x1 - th.x0 + 1) * per, h: (th.y1 - th.y0 + 1) * per };
}

/* The node's own art, for the part of it on screen.

   paintMapBaseRegion draws at `square * TS`, so the context is put into the
   node's own pixel space first and the region asked for is whatever the
   viewport covers. This is the detail lens's job without the detail lens:
   there is no second canvas, no margin to budget, nothing to slide, and no
   settle to wait for -- it is simply what this node looks like this frame. */
function paintAtlasDetail(ctx, node, r, vw, vh) {
  // Magnified native art is the nicest thing on the tab and the dearest; a
  // moving view falls back to the node's own render or its miniature.
  const e = mapRenderIfCheap(node.resid);
  if (!e || !e.result || !e.result.m) return false;
  const TS = 32;
  const per = r.w / node.w;                 // screen px per node square
  const x0 = Math.max(0, Math.floor((0 - r.x) / per) - 1);
  const y0 = Math.max(0, Math.floor((0 - r.y) / per) - 1);
  const x1 = Math.min(node.w - 1, Math.ceil((vw - r.x) / per) + 1);
  const y1 = Math.min(node.h - 1, Math.ceil((vh - r.y) / per) + 1);
  if (x1 < x0 || y1 < y0) return false;
  // The window the cache would keep, at the art's 32 px a square. Past the
  // cache's size there is no window, and there used to be a fallback that
  // painted every square on screen on every frame instead -- which on a
  // 1,200 px viewport is the world between 10 and 20 px a square, some
  // fifteen thousand squares a frame, and the judder the maintainer felt
  // below 20 (9 September 2026). Now the node's render is drawn scaled
  // instead: softer for that band, and one drawImage.
  {
    const M = 6, TS = 32;
    const need = (Math.min(node.w - 1, x1 + M) - Math.max(0, x0 - M) + 1) * TS *
                 (Math.min(node.h - 1, y1 + M) - Math.max(0, y0 - M) + 1) * TS;
    if (need > 6000000) return false;
  }
  const src = { m: e.result.m, mapData: e.mapData, props: e.result.props,
                allProps: e.result.allProps, backdrop: e.result.backdrop, backdropFrame: 0,
                TS: e.result.tileSize };
  const win = atlasDetailWindow(node, src, x0, y0, x1, y1, mapAnimFrame || 8);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  const alpha = ctx.globalAlpha;
  if (win) {
    // One scaled blit of the cached window; the cache handles the frame,
    // drawWithMargin the fade of the unbuilt part.
    drawWithMargin(ctx, node, r, alpha, atlasRoofT(r.w), () =>
      ctx.drawImage(win.canvas, r.x + win.x0 * per, r.y + win.y0 * per,
                    (win.x1 - win.x0 + 1) * per, (win.y1 - win.y0 + 1) * per));
  } else {
    drawWithMargin(ctx, node, r, alpha, atlasRoofT(r.w), () => {
      ctx.save();
      ctx.translate(r.x, r.y);
      ctx.scale(per / TS, per / TS);
      paintMapBaseRegion(ctx, TS, x0, y0, x1, y1, src, mapAnimFrame || 8);
      ctx.restore();
    });
  }
  ctx.restore();
  return true;
}

/* The window of native art a magnified node shows, kept between frames.

   paintMapBaseRegion draws a square at a time -- the terrain, the faux
   props, the placed props -- and doing that for every square on screen on
   every frame of a pan was most of what a phone was asked to do. The window
   is now rasterised once at the art's own 32px into a canvas of its own,
   six squares wider than the screen needs on every side, and a frame that
   stays inside it is one drawImage. It is rebuilt when the view leaves it,
   when walls are toggled, and -- only if the window holds a square that
   animates -- when the palette frame advances: the seven-frames-a-second
   cycle repainted every square before, and a window with no water or fire
   in it now costs the animation nothing. Four windows are kept, which is
   more nodes than are ever magnified at once. */
const atlasDetailWindows = new Map();
function atlasDetailWindow(node, src, x0, y0, x1, y1, frame) {
  const M = 6, TS = 32;
  const walls = !!window.MAP_WALLS;
  let w = atlasDetailWindows.get(node.resid);
  const fits = w && w.walls === walls && w.x0 <= x0 && w.y0 <= y0 && w.x1 >= x1 && w.y1 >= y1;
  if (fits && (w.frame === frame || !w.animated)) {
    atlasDetailWindows.delete(node.resid); atlasDetailWindows.set(node.resid, w);   // most recent last
    return w;
  }
  const cx0 = fits ? w.x0 : Math.max(0, x0 - M), cy0 = fits ? w.y0 : Math.max(0, y0 - M);
  const cx1 = fits ? w.x1 : Math.min(node.w - 1, x1 + M), cy1 = fits ? w.y1 : Math.min(node.h - 1, y1 + M);
  const pw = (cx1 - cx0 + 1) * TS, ph = (cy1 - cy0 + 1) * TS;
  if (pw * ph > 6000000) return null;         // a window this size is drawn straight
  const cv = (w && w.canvas) || document.createElement('canvas');
  if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; }
  const g = cv.getContext('2d');
  if (!g) return null;
  g.setTransform(1, 0, 0, 1, -cx0 * TS, -cy0 * TS);
  g.imageSmoothingEnabled = false;
  paintMapBaseRegion(g, TS, cx0, cy0, cx1, cy1, src, frame);
  let animated = false;
  if (!fits) {
    const m = src.m, md = src.mapData;
    for (let y = cy0; y <= cy1 && !animated; y++)
      for (let x = cx0; x <= cx1; x++)
        if (tileIsAnimated(u16be(md, m.mapDataOffset + (x + y * m.width) * 2))) { animated = true; break; }
  } else animated = w.animated;
  w = { x0: cx0, y0: cy0, x1: cx1, y1: cy1, frame, walls, animated, canvas: cv };
  atlasDetailWindows.delete(node.resid);
  atlasDetailWindows.set(node.resid, w);
  while (atlasDetailWindows.size > 4) atlasDetailWindows.delete(atlasDetailWindows.keys().next().value);
  return w;
}

/* The people, on whichever node they are standing on.

   charactersOnLevel reads the schedules for one level and is written against
   window.CUR_MAP -- it asks it for the map, so that walking positions can
   follow a road and sitters can find their chair. The atlas has no current
   map, so it lends it one node at a time: the node's own render stands in
   while its people are worked out, and is put back afterwards. That is a
   borrow rather than a design, and it is the one place the atlas leans on the
   panel's assumptions instead of replacing them.

   Only worth doing when a square is big enough to hold a person: below that
   they are smaller than the sprite's own outline and the node is a picture of
   a town rather than a place with anybody in it. */
// Where everyone on a node is at this hour: worked out from the schedules
// once per node and hour rather than once per frame, since a pan does not
// move the clock. Dropped with the other derived tables.
const atlasFolkCache = new Map();
function atlasFolk(node) {
  const hour = window.MAP_WALK ? window.MAP_TIME : window.MAP_HOUR;
  const key = node.resid + '@' + hour;
  if (atlasFolkCache.has(key)) return atlasFolkCache.get(key);
  // Safe to give up while the view moves because this returns before the
  // cache is written: an empty list is not remembered, so the people are
  // back the moment the gesture ends.
  const e = mapRenderIfCheap(node.resid);
  if (!e || !e.result) return [];
  const keep = window.CUR_MAP;
  let folk = [];
  try {
    window.CUR_MAP = { resid: node.resid, level: node.resid & 0xFF, m: e.result.m,
                       mapData: e.mapData, TS: e.result.tileSize,
                       tilesW: node.w, tilesH: node.h };
    folk = charactersOnLevel(node.resid & 0xFF, hour);
  } catch (err) { folk = []; } finally { window.CUR_MAP = keep; }
  if (atlasFolkCache.size > 64) atlasFolkCache.clear();
  atlasFolkCache.set(key, folk);
  return folk;
}
function atlasPeople(ctx, node, r, ppt) {
  if (ppt < window.ATLAS_TUNE.peopleAt) return;
  const e = mapRenderIfCheap(node.resid);
  if (!e || !e.result) return;
  const per = r.w / node.w;
  const folk = atlasFolk(node);
  if (!folk.length) return;
  const tiles = getPropTileList();
  const scale = per / 32;
  // A sprite is pixel art and is blitted as such: the node painter leaves
  // smoothing on for its scaled renders, and a person drawn through it was
  // a blur at every zoom (the maintainer, 9 September 2026).
  ctx.imageSmoothingEnabled = false;
  for (const c of folk) {
    const x = c.x * per, y = c.y * per;
    if (r.x + x < -per || r.y + y < -per) continue;
    const base = tiles[c.proptype];
    if (base === undefined) continue;
    const [pox, poy] = propOffsetFor(c.proptype, c.aspect, 0);
    drawTileAt(ctx, base + c.aspect, r.x + x - pox * scale, r.y + y - poy * scale,
               true, per, 0, c.rotated);
  }
  ctx.imageSmoothingEnabled = true;
}

/* The ways through, marked where they are.

   A mouth is a connection rather than a place, so it gets a ring on the
   square it is on and its name beside it -- not a picture of what is behind
   it, which would be putting an unlocated map on located ground. Only where
   the node is big enough for the ring to mean a square.

   One colour for every ring since 9 September 2026 (the maintainer): a
   way up, down or across is a way, and the name beside it says where. */
/* The width of a label, measured once per name per face.

   measureText is not free and the names do not change: at mid zoom this pass
   was measuring two dozen of them on every frame of a pan. The key carries
   the font as well as the name, because canvasFace reads FACE_STACK_NOW and
   the reader can change the face -- a cache on the name alone would keep the
   old face's widths and mis-size every box behind every label. */
const _atlasTextW = new Map();
function atlasTextWidth(ctx, s) {
  const key = ctx.font + ' ' + s;
  let w = _atlasTextW.get(key);
  if (w === undefined) {
    w = Math.round(ctx.measureText(s).width);
    if (_atlasTextW.size > 512) _atlasTextW.clear();
    _atlasTextW.set(key, w);
  }
  return w;
}

function atlasPaintMouths(ctx, drawn, vw, vh) {
  const out = [];
  // Canvas text is not reached by the sheet's rem scale, so these sizes and
  // the boxes behind them are held level with it by hand.
  ctx.font = canvasFace(14);
  ctx.textAlign = 'left';
  // Every passage is ringed now, so rings stand side by side and their
  // labels would lie on top of each other. The ring is the thing -- it is
  // what is tapped -- so a label whose box is already taken is dropped and
  // the ring still drawn, the way the place names handle a collision.
  const labelled = [];
  /* One path for every ring on a node, not one stroke each -- the same fix
     the eggs below got on 12 September 2026, and for the same reason. The
     mouths were left out of it then, which is why the tab was still jerky at
     mid zoom: measured on 13 September at 12 px a world square, this pass was
     121 of the frame's 125 canvas operations, some two dozen visible passages
     each doing beginPath, arc, stroke and a measureText of its own. A stroke
     is the call that rasterises, so two dozen of them a frame is the cost.

     radius, width and colour are the same for every ring on a node -- they
     come from `per` -- so the state is set once outside the loop, and an arc
     is preceded by a moveTo to its own start or the path joins it to the one
     before with a straight line (the note in the egg loop). The labels want
     the ring already stroked under them, so they are collected here and drawn
     in a second pass after the stroke. */
  const labelQueue = [];
  for (const { node, r } of drawn) {
    const per = r.w / node.w;
    if (per < window.ATLAS_TUNE.mouthAt) continue;
    const rad = Math.max(5, per * 0.7);
    // Collected before anything is drawn, so a node whose rings are all off
    // screen costs no path and no stroke at all. Stroking unconditionally
    // per node put an empty stroke into every frame -- the world-tab pin
    // went from 13 rings in one stroke to 13 in two the moment this loop
    // was batched, which is the batching paying a toll instead of saving.
    const rings = [];
    for (const m of atlasMouths(node)) {
      const x = r.x + (m.x + 0.5) * per, y = r.y + (m.y + 0.5) * per;
      if (x < -60 || y < -20 || x > vw + 60 || y > vh + 20) continue;
      rings.push({ x, y });
      labelQueue.push({ m, x, y, rad });
      out.push({ m, node, x, y, per, rad: Math.max(rad, 11) });
    }
    if (!rings.length) continue;
    ctx.save();
    ctx.strokeStyle = 'rgba(196,164,100,.85)';
    ctx.lineWidth = Math.max(1.5, per / 12);
    ctx.beginPath();
    for (const { x, y } of rings) {
      ctx.moveTo(x + rad, y);
      ctx.arc(x, y, rad, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
  }
  for (const { m, x, y, rad } of labelQueue) {
    const text = m.label || m.name;
    const tw = atlasTextWidth(ctx, text);
    const box = { x0: x + rad + 3, y0: y - 9, x1: x + rad + 11 + tw, y1: y + 9 };
    if (labelled.some(q => box.x0 < q.x1 && box.x1 > q.x0 && box.y0 < q.y1 && box.y1 > q.y0)) continue;
    labelled.push(box);
    ctx.fillStyle = 'rgba(8,7,5,.78)';
    ctx.fillRect(box.x0, box.y0, tw + 8, 18);
    ctx.fillStyle = '#e8dfc0';
    ctx.fillText(text, x + rad + 7, y + 4);
  }
  // The eggs: records with flags 0x42, which delvmod names EGG and which
  // are scripted triggers rather than props -- the disturbed sand on the
  // island in the lake near Kosha is one (the way down to Omen's test, by
  // the community's walkthroughs). A faint dotted ring at close zoom. The
  // file does not say what an egg does; its aspect is the kind, and what
  // each kind does is the application's -- see EGG_KIND_NAMES.
  for (const { node, r } of drawn) {
    const per = r.w / node.w;
    if (per < 12) continue;
    if (!node._eggs) {
      // Flags 0x42 is EGG and 0x44 is ROOF (delvmod delv/level.py), and the
      // two were taken together here until 11 September 2026, which ringed
      // the archive's 298 roof placements as triggers. The "prop type" bits
      // are the egg's argument, so they are not tested.
      try { const e = mapRenderFor(node.resid, true); node._eggs = ((e && e.result && e.result.allProps) || []).filter(p => p.flags === 0x42); }
      catch (e) { node._eggs = []; }
    }
    /* One path for every egg on this node, not one dashed stroke each.
       Measured on 12 September 2026 after a report that the World tab was
       still jerky at mid zoom: a single frame was 786 canvas operations and
       781 of them were here. 123 visible eggs each did save, setLineDash,
       beginPath, arc, stroke, restore, and a dashed stroke is among the
       slowest things a canvas does -- so a pan issued 123 of them a frame.
       Zoomed out the whole pass is gated off by `per`, which is exactly why
       it was smooth there and not here. The state is set once now and
       everything strokes together, which is the same picture for a fraction
       of the work and knows nothing about which kinds are on the map.

       An arc begins at angle zero, so each ring needs a moveTo to its own
       start or the path joins it to the one before with a straight line.
       rect() opens its own subpath and needs no such thing. */
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(220,220,255,.55)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (const g of node._eggs) {
      const x = r.x + (g.x + 0.5) * per, y = r.y + (g.y + 0.5) * per;
      if (x < -20 || y < -20 || x > vw + 20 || y > vh + 20) continue;
      // Rooms are NOT drawn here. A kind-8 egg covers a rectangle, and the
      // world map is a picture of an island: a score of room outlines tiling
      // a town is clutter at this scale, and the maintainer asked for them on
      // the zone view instead, where one map fills the screen and they can be
      // turned on and off (MAP_MARKS.rooms, drawMapMarks). The World tab keeps
      // the triggers that act on their own square.
      if (g.aspect === 8) continue;
      const rad = per * 0.45;
      ctx.moveTo(x + rad, y);
      ctx.arc(x, y, rad, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.textAlign = 'center';
  return out;
}

// The dotted ring is an egg: a prop record with flags 0x42, which delvmod
// names EGG, a scripted trigger on a square rather than a thing on it. The
// card says which kind it is and what the kind's argument means, so the room
// eggs read as rooms and the zoneports as ways out.
function atlasEggAt(node, tx, ty, linked) {
  if (!node._eggs) {
    // Flags 0x44 is ROOF, not an egg; see the note in the draw loop above.
    // The whole prop list is kept beside them: what a hatching egg holds is
    // not in the egg's own record but in the records that name it as their
    // container, the way a chest holds what it holds.
    try {
      const e = mapRenderFor(node.resid, true);
      node._allProps = (e && e.result && e.result.allProps) || [];
      node._eggs = node._allProps.filter(p => p.flags === 0x42);
    } catch (e) { node._eggs = []; node._allProps = []; }
  }
  // An egg on the square answers first, whatever its kind. Failing that, a
  // room is a rectangle rather than a square (eggRect), so a square inside
  // one is in that room even though nothing is on it -- which is most of a
  // room: the archive's room rectangles cover 6,094 squares between them.
  // Where two rooms overlap, and 39 squares do, the lowest-indexed egg wins,
  // because the application's draw loop walks the list backwards and stores
  // CurrentRoom on every match, so the first entry is what is left standing.
  const g = node._eggs.find(g => g.x === tx && g.y === ty);
  if (g) return 'a scripted trigger (an egg): ' + eggDetail(g, node._allProps, linked);
  const room = node._eggs.filter(e => e.aspect === 8 && eggCovers(e, tx, ty))
                         .sort((a, b) => a.index - b.index)[0];
  if (!room) return '';
  return 'inside a room: ' + eggDetail(room, node._allProps, linked);
}
/* The picked square, ringed the way Zones rings its selection (white over a
   dark edge, corner ticks when small), on whichever drawn node it belongs
   to. atlasInspect sets ATLAS_SEL; a second tap on the square clears it. */
function atlasPaintSelection(ctx, drawn) {
  const sel = window.ATLAS_SEL;
  if (!sel) return;
  const d = drawn.find(x => x.node.resid === sel.resid);
  if (!d) return;
  const per = d.r.w / d.node.w;
  if (per < 2) return;
  const x = d.r.x + sel.tx * per, y = d.r.y + sel.ty * per;
  ctx.save();
  ctx.lineWidth = Math.max(2, per / 10); ctx.strokeStyle = 'rgba(0,0,0,.75)';
  ctx.strokeRect(x + 1, y + 1, per - 2, per - 2);
  ctx.lineWidth = Math.max(1, per / 16); ctx.strokeStyle = '#ffffff';
  ctx.strokeRect(x + 1, y + 1, per - 2, per - 2);
  const t = Math.max(3, per * 0.34);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 2, y + t); ctx.lineTo(x - 2, y - 2); ctx.lineTo(x + t, y - 2);
  ctx.moveTo(x + per + 2 - t, y - 2); ctx.lineTo(x + per + 2, y - 2); ctx.lineTo(x + per + 2, y + t);
  ctx.moveTo(x - 2, y + per + 2 - t); ctx.lineTo(x - 2, y + per + 2); ctx.lineTo(x + t, y + per + 2);
  ctx.moveTo(x + per + 2 - t, y + per + 2); ctx.lineTo(x + per + 2, y + per + 2); ctx.lineTo(x + per + 2, y + per + 2 - t);
  ctx.stroke();
  ctx.restore();
}
/* A ring round every town still wearing its roofs: a tap on one goes in
   (atlasZoomIntoTown), and the ring says so the way the mouths' rings do. */
function atlasPaintTowns(ctx, drawn, vw, vh) {
  if (atlasBelowTop()) return;
  for (const { node, r } of drawn) {
    if (!node.depth || r.w >= 540) continue;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, rad = Math.hypot(r.w, r.h) / 2 + 4;
    if (cx + rad < 0 || cy + rad < 0 || cx - rad > vw || cy - rad > vh) continue;
    ctx.strokeStyle = 'rgba(196,164,100,.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.stroke();
  }
}

/* The names.

   Drawn last, over everything, biggest node first so a collision drops the
   smaller place; a node too small to have been drawn at all is not named. */
function atlasLabels(ctx, drawn, vw, vh) {
  ctx.font = canvasFace(15);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const placed = [];
  const named = drawn.filter(d => d.node.depth).sort((a, b) => b.r.w - a.r.w);
  for (const { node, r } of named) {
    const tw = Math.round(ctx.measureText(node.name).width) + 10;
    const cx = Math.round(r.x + r.w / 2);
    const ty = Math.round(r.y + r.h + 16);
    if (cx < -tw || cx > vw + tw || ty < 0 || ty > vh) continue;
    const box = { x0: cx - tw / 2, y0: ty - 13, x1: cx + tw / 2, y1: ty + 5 };
    if (placed.some(q => box.x0 < q.x1 && box.x1 > q.x0 && box.y0 < q.y1 && box.y1 > q.y0)) continue;
    placed.push(box);
    ctx.fillStyle = 'rgba(8,7,5,.7)';
    ctx.fillRect(box.x0, box.y0, tw, 18);
    ctx.fillStyle = node.sealed ? '#c9bb92' : '#e8dfc0';
    ctx.fillText(node.name, cx, ty);
  }
}

/* The palette animation, which in the atlas costs nothing to arrange.

   The panel had to repaint animated squares into the base canvas and then
   again into the detail lens, because the two are separate pictures kept in
   step. The atlas redraws the whole scene every frame regardless, so the
   animation is simply a frame counter and a repaint -- there is nothing to
   keep in step with anything.

   Seven frames a second, the rate the palette has always cycled at, and only
   while the tab is the one on screen. */
let atlasAnimTimer = null;
function startAtlasAnimation() {
  stopAtlasAnimation();
  atlasAnimTimer = setInterval(() => {
    if (!window.ATLAS || window.CUR_SUBN !== 'WORLD') return;
    if (!window.MAP_ANIM || atlasView.touching) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    mapAnimFrame = (mapAnimFrame + 1) % 8;
    schedulePaintAtlas();
  }, 140);
  if (atlasAnimTimer && typeof atlasAnimTimer.unref === 'function') atlasAnimTimer.unref();
}
function stopAtlasAnimation() {
  if (atlasAnimTimer) { clearInterval(atlasAnimTimer); atlasAnimTimer = null; }
}

/* What is outside the map: the folder it is lying on.

   The first version of this filled it with the world's own border water --
   Cythera is an island and 434 squares of its border are tile 0x8 -- and it
   was a worse idea than it sounds. Painting sea beyond the edge of the map
   asserts that the sea goes on, which is the same class of claim as putting
   an underground on the world: the file says what is inside the 256x256 grid
   and nothing whatever about what is outside it. The manila of the folder
   says the honest thing, which is that the map stops here.

   So the canvas is simply cleared, and what shows through is the sheet the
   World tab is drawn on. */
/* The ground under everything: black below ground, and on the surface the
   sea. The world map is a rectangle and Cythera is an island in it, so
   outside the rectangle the view is filled with the world's own water tile,
   laid on the world's grid at the current zoom, and the map's edge stops
   being an edge. The tile is whichever tile is commonest along the world's
   border, read off the rendered map, so it is the file's sea and not ours. */
let atlasWaterCache = null;
/* The colour of the sea, as one number: the average of the sea ring just
   inside the world map's black frame. Plain rather than a tile, so that
   what is outside the map is not mistaken for map. */
function atlasWaterTile() {
  if (atlasWaterCache !== null) return atlasWaterCache || null;
  atlasWaterCache = false;
  try {
    const e = mapRenderFor(WORLD_MAP_RESID, true);
    const cv = e && e.result && e.result.canvas;
    const ts = e && e.result && e.result.tileSize;
    if (!cv || !ts || !cv.getContext) return null;
    const g = cv.getContext('2d');
    const W = e.result.width, H = e.result.height;
    // The ring of squares just inside the black frame is open sea all the
    // way round; its average colour, over every non-black pixel, is the sea.
    let r = 0, gg = 0, b = 0, n = 0;
    const take = (x, y) => {
      const d = g.getImageData(x * ts, y * ts, ts, ts).data;
      for (let i = 0; i < d.length; i += 4) { if (d[i] + d[i + 1] + d[i + 2] < 24) continue; r += d[i]; gg += d[i + 1]; b += d[i + 2]; n++; }
    };
    for (let k = 2; k <= 6; k++) {
      for (let x = k; x < W - k; x += 2) { take(x, k); take(x, H - 1 - k); }
      for (let y = k; y < H - k; y += 2) { take(k, y); take(W - 1 - k, y); }
    }
    if (!n) return null;
    atlasWaterCache = { ts, rgb: [Math.round(r / n), Math.round(gg / n), Math.round(b / n)] };
  } catch (e) { atlasWaterCache = false; }
  return atlasWaterCache || null;
}
function paintAtlasGround(ctx, vw, vh) {
  ctx.fillStyle = '#000';
  const sc = atlasScene();
  const w = sc && sc.surface ? atlasWaterTile() : null;
  if (w) ctx.fillStyle = 'rgb(' + w.rgb.join(',') + ')';
  ctx.fillRect(0, 0, vw, vh);
}

function hideAtlasHover() {
  const el = document.getElementById('atlasHover');
  if (el) { el.style.display = 'none'; atlasHoverKey = ''; }
}

/* Opening the tab on the atlas.

   Two elements, and they are the whole of the handover: the sheet steps aside
   and the atlas panel takes its place in the folder. Nothing belonging to the
   map panel is touched, so there is nothing to give back -- which is the
   point. Sharing that panel produced every regression the World tab has had:
   first CUR_MAP, then the panel's own elements, then the class that unframed
   the sheet. */
function renderAtlasView() {
  stopAllViewActivity();
  try { document.body.classList.add('worldTab'); } catch (e) { quiet(e); }
  const sheet = document.getElementById('tabSheet');
  if (sheet) sheet.style.display = 'none';
  const panel = document.getElementById('atlasPanel');
  if (panel) panel.style.display = 'block';
  window.CUR_MAP = null;
  ensureAtlasCanvas();
  setupAtlasInteraction();
  renderAtlasBar();
  // The selection bar under the zoom row says so until a square is picked.
  const insp = document.getElementById('atlasInspect');
  if (insp && !insp.innerHTML) { insp.innerHTML = '<span class="inspDim">Nothing selected. Tap a square to see what is on it.</span>'; insp.style.display = 'block'; }
  const start = () => {
    const vp = document.getElementById('atlasViewport');
    if (!vp || vp.clientWidth < 40) { setTimeout(start, 50); return; }
    atlasFit();
    atlasSyncZoomLabel();
    paintAtlas();
    buildWorldThumbs();
    startAtlasAnimation();
  };
  start();
}

function atlasFitAndPaint() { atlasFit(); atlasSyncZoomLabel(); paintAtlas(); }

/* The map the whole screen.

   Where the browser lets an element go full screen (desktop browsers,
   Chrome on Android) the panel is asked to; where it does not -- Safari and
   every other browser on an iPhone allow it only for video -- the panel is
   pinned over the page instead (body.atlasFull), which is as full as the OS
   permits there: the address bar stays. Either way the panel keeps its
   zoom row and inspector under the viewport, and paints at the new size
   through the same resize check paintAtlas already makes. Escape leaves
   the pinned mode, as it does the real one. */
function atlasIsFull() {
  return !!(document.fullscreenElement || document.webkitFullscreenElement) ||
         document.body.classList.contains('atlasFull');
}
function atlasToggleFull() {
  const panel = document.getElementById('atlasPanel');
  if (!panel) return;
  if (atlasIsFull()) {
    try {
      if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
    } catch (e) { quiet(e); }
    document.body.classList.remove('atlasFull');
  } else {
    const req = panel.requestFullscreen || panel.webkitRequestFullscreen;
    let asked = false;
    if (req) {
      try {
        const p = req.call(panel);
        asked = true;
        if (p && typeof p.catch === 'function') p.catch(() => { document.body.classList.add('atlasFull'); atlasAfterFullChange(); });
      } catch (e) { asked = false; }
    }
    if (!asked) document.body.classList.add('atlasFull');
  }
  atlasAfterFullChange();                  // the pinned mode is immediate
  setTimeout(atlasAfterFullChange, 60);    // the real one arrives on its own event
}
function atlasAfterFullChange() {
  const b = document.getElementById('atlasFullBtn');
  const full = atlasIsFull();
  if (b) b.textContent = full ? 'Full screen off' : 'Full screen';
  const ov = document.getElementById('atlasFullOverlay');
  if (ov) ov.style.display = full ? 'flex' : 'none';
  if (full) atlasUpdateFullOverlay(window.ATLAS_DRAWN || []);
  if (window.CUR_SUBN === 'WORLD') schedulePaintAtlas();
}
/* The overlay's one line: where the middle of the screen is. Below ground it
   is the place you came into; on the surface it is the deepest place drawn
   under the middle of the view, else the island. */
function atlasCurrentPlaceName(drawn) {
  const b = atlasBelowTop();
  if (b) return b.name;
  const vp = document.getElementById('atlasViewport');
  if (!vp) return 'Cythera';
  const cx = vp.clientWidth / 2, cy = vp.clientHeight / 2;
  let best = null;
  for (const { node, r } of drawn || []) {
    if (!node.depth) continue;
    if (cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h && (!best || node.depth > best.node.depth)) best = { node, r };
  }
  return best ? best.node.name : 'Cythera';
}
function atlasUpdateFullOverlay(drawn) {
  const w = document.getElementById('atlasFullWhere'), up = document.getElementById('atlasFullUp');
  if (!w) return;
  const b = atlasBelowTop();
  w.textContent = atlasCurrentPlaceName(drawn);
  if (up) { up.style.display = b ? '' : 'none'; up.title = b ? 'Back up to ' + b.fromName : ''; }
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('fullscreenchange', atlasAfterFullChange);
  document.addEventListener('webkitfullscreenchange', atlasAfterFullChange);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('atlasFull')) atlasToggleFull();
  });
}

function ensureAtlasCanvas() {
  const vp = document.getElementById('atlasViewport');
  if (!vp) return null;
  let cv = document.getElementById('atlasCanvas');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.id = 'atlasCanvas';
    cv.style.cssText = 'position:absolute; top:0; left:0; z-index:2; ' +
                       'max-width:none; max-height:none;';
    vp.appendChild(cv);
  }
  // renderMapResource hides it when Regions takes the panel back.
  cv.style.display = '';
  return cv;
}

/* What is under a point on screen: the deepest node covering it, and the
   square of that node's own map.

   Deepest wins, which is the whole of "which place am I in" -- there is no
   state to consult, and no way for it to be out of step with what is drawn. */
function atlasAt(px, py) {
  const sc = atlasScene();
  if (!sc) return null;
  let best = null;
  for (const node of sc.nodes) {
    const r = atlasRect(node, atlasView);
    if (px < r.x || py < r.y || px > r.x + r.w || py > r.y + r.h) continue;
    if (node.depth && r.w < window.ATLAS_TUNE.nodeFadeFrom) continue;
    if (!best || node.depth >= best.node.depth) {
      const per = r.w / node.w;
      best = { node, r, tx: Math.floor((px - r.x) / per), ty: Math.floor((py - r.y) / per) };
    }
  }
  return best;
}

/* Through a mouth, and back out again.

   Going down is a step rather than a zoom, and that is the honest shape of
   it: the archive gives a doorway, so what happens when you take it is that
   you are somewhere else, not that you are closer to where you were. Coming
   back restores the view you left, so the surface is where you put it down.

   Zooming out of an unlocated map also comes back, because that is the one
   gesture worth having in both directions and it costs a line. */
function atlasDescend(m, node, arriveZ) {
  const b = atlasBelowTop();
  DERIVED.ATLAS_BELOW.push({
    resid: m.dest.resid,
    name: m.name,
    fromName: node.name, fromResid: node.resid, kind: m.kind,
    at: { x: m.x, y: m.y },
    arrive: { x: m.dest.x, y: m.dest.y },
    view: { x: atlasView.x, y: atlasView.y, Z: atlasView.Z },
    wasBelow: !!b
  });
  const sc = atlasScene();
  const vp = document.getElementById('atlasViewport');
  if (sc && vp && vp.clientWidth > 40) {
    // Arrive on the square the zoneport puts you on: at half the zoom you
    // fell in at, or, taken by a tap, at a zoom that shows the room around
    // it rather than the whole map -- you came through a door.
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const fit = Math.min(vw / sc.root.w, vh / sc.root.h);
    const zEnd = Math.max(fit * 0.6, Math.min(atlasMaxZ(), arriveZ || sc.root.ts * 0.75));
    const ax = m.dest.x + 0.5, ay = m.dest.y + 0.5;
    // From a dot: the whole map four pixels across, its arrival square on
    // the middle of the screen, and it stays on that square as it grows.
    const zDot = Math.min(zEnd / 60, 4 / Math.max(sc.root.w, sc.root.h));
    atlasView.Z = zDot; atlasView.x = vw / 2 - ax * zDot; atlasView.y = vh / 2 - ay * zDot;
    const sx = atlasView.x, sy = atlasView.y;
    renderAtlasBar();
    const ms = arriveZ ? window.ATLAS_TUNE.animMs : 0;
    if (ms) atlasFadeTo(1);
    atlasAnimateTo(e => { atlasZoomOnto(ax, ay, zDot, zEnd, e, vw, vh, sx, sy); if (ms) atlasFadeTo(1 - e); }, ms, () => { atlasFadeTo(0); atlasSyncZoomLabel(); paintAtlas(); }, 'out');
    return;
  }
  atlasSyncZoomLabel();
  renderAtlasBar();
  paintAtlas();
}

function atlasAscend() {
  const prev = DERIVED.ATLAS_BELOW.pop();
  if (!prev) return;
  if (prev.view) { atlasView.x = prev.view.x; atlasView.y = prev.view.y; atlasView.Z = prev.view.Z; }
  atlasSyncZoomLabel();
  renderAtlasBar();
  paintAtlas();
}

/* Moving about in it.

   Pan and zoom act on the three numbers and the scene is redrawn. There is no
   transform to compose, no layer to keep in step and no settle to wait for,
   which is why this is fifteen lines where the panel's equivalent is a
   hundred and fifty. */
/* Gestures.

   A pinch or a drag is one gesture from the first finger down to the last
   finger up; a run of wheel clicks, or of slider moves, is one gesture until
   a pause. For a day a zoom that ended on a hole went through it; that was
   too eager even judged at the end, so now a gesture only moves the view,
   and a ring is taken by tapping it. The bookkeeping stays because it costs
   nothing and a later idea may want it. */
const atlasGesture = { active: false, z0: null, timer: null };
// The last moment the reader moved the world. A background render (a
// miniature, a kept place, the map beside a ring) waits until the world has
// been still for a little, so it never lands in the middle of a pan.
let atlasBusyUntil = 0;
function atlasMarkBusy() { atlasBusyUntil = Date.now() + 500; }
function atlasIsBusy() { return !!(atlasView.touching || window._atlasAnimating || Date.now() < atlasBusyUntil); }
/* Moving *now*, which is a different question from the one above and must
   stay one. atlasIsBusy carries a 500 ms tail after a gesture so that
   background work never lands in the middle of a pan; that is right for
   deciding when to start work and wrong for deciding what to draw, because
   it would leave the map coarse for half a second after it had already come
   to rest -- which is exactly when the sharp paint is wanted. Told apart
   after the first attempt at the judder fix used atlasIsBusy for both and
   the smoke reported the world's rings and Odemia's people missing: the
   checks pan and zoom, which marks busy, and then assert inside that
   window. */
function atlasInMotion() { return !!(atlasView.touching || window._atlasAnimating); }
// A slice of background work: now if the world is still, else a little later.
function atlasWhenStill(fn, ms) {
  const run = () => { if (atlasIsBusy()) { setTimeout(run, 250); return; } fn(); };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(run, { timeout: ms || 2000 });
  else setTimeout(run, 120);
}
function atlasGestureBegin() {
  atlasMarkBusy();
  if (atlasGesture.active) return;
  atlasGesture.active = true; atlasGesture.z0 = atlasView.Z;
}
function atlasGestureEnd() {
  if (!atlasGesture.active) return;
  atlasGesture.active = false;
  atlasGesture.z0 = null;
  // A zoom goes nowhere by itself, since 6 September 2026: the maintainer
  // found that even judged at the end, a zoom that fell through a hole
  // fell through holes he was only looking at. A ring is taken by a tap.
}
// A wheel click or a slider move: part of a gesture that ends with a pause.
function atlasGestureTouch() {
  atlasMarkBusy();
  atlasGestureBegin();
  if (atlasGesture.timer) clearTimeout(atlasGesture.timer);
  atlasGesture.timer = setTimeout(() => { atlasGesture.timer = null; atlasGestureEnd(); }, 180);
}

/* The fall into a mouth, and the rise out of it.

   Going down: the view zooms onto the hole, drawing it to the middle as it
   grows, until its black square fills the screen; then the place below opens
   from nothing, centred on the square you arrive on, and settles at half the
   magnification the hole's map had when you went in. Coming up: the place
   shrinks to nothing around the square you arrived on, and the map above
   opens out from the blank middle of the hole, settling at half the
   magnification you went in at -- so the hole is there, and smaller, and a
   zoom in would have to mean it again. animMs of nought is a cut, which is
   also what a browser without animation frames gets. */
// curve: 'in' accelerates all the way (the fall, which should still be
// gathering speed as the black closes over), 'out' starts fast and settles
// (a place opening from nothing).
function atlasAnimateTo(fn, ms, done, curve) {
  if (!ms || typeof requestAnimationFrame !== 'function' || window.ATLAS_NO_ANIM) {
    fn(1); paintAtlas(); if (done) done(); return;
  }
  window._atlasAnimating = true;
  const t0 = Date.now();
  const step = () => {
    const t = Math.min(1, (Date.now() - t0) / ms);
    const e = curve === 'in' ? t * t * t : curve === 'out' ? 1 - Math.pow(1 - t, 3) : (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
    fn(e); paintAtlas();
    if (t < 1) requestAnimationFrame(step);
    else { window._atlasAnimating = false; if (done) done(); }
  };
  requestAnimationFrame(step);
}
// Zoom the view from z0 to z1 while a scene point (hx,hy: px at Z=1) drifts
// from where it is to the middle of the screen.
function atlasFadeTo(op) {
  const f = document.getElementById('atlasFade');
  if (f) f.style.opacity = String(Math.max(0, Math.min(1, op)));
}
function atlasZoomOnto(hx, hy, z0, z1, e, vw, vh, x0, y0) {
  const z = z0 * Math.pow(z1 / z0, e);
  const cx0 = x0 + hx * z0, cy0 = y0 + hy * z0;
  const cx = cx0 + (vw / 2 - cx0) * e, cy = cy0 + (vh / 2 - cy0) * e;
  atlasView.Z = z; atlasView.x = cx - hx * z; atlasView.y = cy - hy * z;
}
/* Through a ring, from wherever the view is: down into a place, or up out
   of one to the map the ring names. Both are drawn as the fall and the rise. */
function atlasTakeMouth(m, node) {
  if (window._atlasAnimating) return;
  if (m.dest.resid === node.resid) atlasCrossWithin(m, node);
  else if (m.up) atlasRiseVia(m, node);
  else atlasFallInto(m, node);
}

/* A passage whose far end is on the same map.

   44 of the archive's 111 passages are these -- the Iron Mine's paired
   ladders, the Volcano's holes, Pnyx's five stairs -- and neither of the
   other two moves is right for one: there is no level to push onto the stack
   and none to pop off it. What happens is that you are somewhere else on the
   map you are already looking at, so the view goes in at the ring and comes
   out at the square the zoneport names, at the zoom it left. */
function atlasCrossWithin(m, node) {
  const vp = document.getElementById('atlasViewport');
  const z0 = atlasView.Z, x0 = atlasView.x, y0 = atlasView.y;
  const dx = node.ox + (m.dest.x + 0.5) * node.s, dy = node.oy + (m.dest.y + 0.5) * node.s;
  if (!vp || vp.clientWidth < 40) {
    atlasView.x = -dx * z0; atlasView.y = -dy * z0;
    atlasSyncZoomLabel(); paintAtlas(); return;
  }
  const vw = vp.clientWidth, vh = vp.clientHeight;
  const hx = node.ox + (m.x + 0.5) * node.s, hy = node.oy + (m.y + 0.5) * node.s;
  const z1 = Math.max(vw, vh) * 1.15 * (node.ts || 32) / node.s;
  atlasAnimateTo(e => { atlasZoomOnto(hx, hy, z0, z1, e, vw, vh, x0, y0); atlasFadeTo(e); },
    window.ATLAS_TUNE.animMs, () => {
      atlasView.Z = z1; atlasView.x = vw / 2 - dx * z1; atlasView.y = vh / 2 - dy * z1;
      const sx = atlasView.x, sy = atlasView.y;
      atlasAnimateTo(e => { atlasZoomOnto(dx, dy, z1, z0, e, vw, vh, sx, sy); atlasFadeTo(1 - e); },
        window.ATLAS_TUNE.animMs, () => { atlasFadeTo(0); atlasSyncZoomLabel(); paintAtlas(); }, 'out');
    }, 'in');
}
/* Up through a ring: the place shrinks to nothing around the ring's own
   square, then the map the ring leads to opens from the blank middle of the
   square you come out on. Back to the map you came through, the zoom is half
   what you went in at; to anywhere else, a zoom that shows the place. */
function atlasRiseVia(m, node) {
  const b = atlasBelowTop();
  const vp = document.getElementById('atlasViewport');
  if (!b || !vp || vp.clientWidth < 40) { atlasAscend(); return; }
  const vw = vp.clientWidth, vh = vp.clientHeight;
  const ax = m.x + 0.5, ay = m.y + 0.5;
  const z0 = atlasView.Z, x0 = atlasView.x, y0 = atlasView.y;
  const zDot = Math.min(z0 / 60, 4 / Math.max(node.w, node.h));
  atlasAnimateTo(e => { atlasZoomOnto(ax, ay, z0, zDot, e, vw, vh, x0, y0); atlasFadeTo(e); }, window.ATLAS_TUNE.animMs, () => {
    const dest = m.dest.resid;
    // Up to the surface: all the way out of the stack. Up to the map you
    // came through: one level.
    let prev = null;
    if (dest === WORLD_MAP_RESID || mapIsSurface(dest)) { while (DERIVED.ATLAS_BELOW.length) prev = DERIVED.ATLAS_BELOW.pop(); }
    else { prev = DERIVED.ATLAS_BELOW.pop(); while (DERIVED.ATLAS_BELOW.length && atlasBelowTop().resid !== dest) prev = DERIVED.ATLAS_BELOW.pop(); }
    renderAtlasBar();
    const sc = atlasScene();
    const dn = (sc && sc.nodes.find(n => n.resid === dest)) || (sc && sc.root);
    if (!sc || !dn) { atlasFadeTo(0); atlasSyncZoomLabel(); paintAtlas(); return; }
    const hx = dn.ox + (m.dest.x + 0.5) * dn.s, hy = dn.oy + (m.dest.y + 0.5) * dn.s;
    const zBig = Math.max(vw, vh) * 1.15 * (dn.ts || 32) / dn.s;
    const fit = Math.min(vw / sc.root.w, vh / sc.root.h);
    const back = prev && prev.fromResid === dest && prev.view;
    const zEnd = Math.max(fit * (atlasBelowTop() ? 0.6 : 0.9), back ? prev.view.Z / 2 : Math.min(atlasMaxZ(), 12 / dn.s));
    atlasView.Z = zBig; atlasView.x = vw / 2 - hx * zBig; atlasView.y = vh / 2 - hy * zBig;
    const sx = atlasView.x, sy = atlasView.y;
    atlasAnimateTo(e => { atlasZoomOnto(hx, hy, zBig, zEnd, e, vw, vh, sx, sy); atlasFadeTo(1 - e); }, window.ATLAS_TUNE.animMs, () => { atlasFadeTo(0); atlasSyncZoomLabel(); paintAtlas(); }, 'out');
  }, 'in');
}
function atlasFallInto(m, node) {
  const vp = document.getElementById('atlasViewport');
  if (!vp || vp.clientWidth < 40) { atlasDescend(m, node); return; }
  const vw = vp.clientWidth, vh = vp.clientHeight;
  const per0 = node.s * atlasView.Z;                  // px per square of the mouth's map now
  const z0 = atlasView.Z, x0 = atlasView.x, y0 = atlasView.y;
  // The middle pixel of the hole's sprite, and the zoom goes on until that
  // one pixel fills the screen: the fall ends on the black of the hole
  // itself, still gathering speed.
  const hx = node.ox + (m.x + 0.5) * node.s, hy = node.oy + (m.y + 0.5) * node.s;
  const z1 = Math.max(vw, vh) * 1.15 * (node.ts || 32) / node.s;
  atlasAnimateTo(e => { atlasZoomOnto(hx, hy, z0, z1, e, vw, vh, x0, y0); atlasFadeTo(e); }, window.ATLAS_TUNE.animMs, () => {
    atlasView.Z = z0; atlasView.x = x0; atlasView.y = y0;   // the view you left, for coming back
    atlasDescend(m, node, per0 / 2);
  }, 'in');
}
/* Into a town from a tap: the view closes on the town's middle until it is
   wide enough on screen for its roofs to be off (atlasRoofT: none left from
   540 px across), or as close as the art goes, whichever is nearer. No
   fade, since nothing is left behind; the zoom row and the slider follow. */
// The zone in its own panel, centred on the square and the square selected.
// The schedules and the atlas card call this name; it is showSquareOnMap.
function atlasOpenSquare(resid, tx, ty) { showSquareOnMap(resid, tx, ty); }
/* From a zone's page to the World tab, on that zone: a place on the surface
   is centred at the zoom its roofs come off at; a place below ground is
   entered through the mouth that leads to it; the world itself is fitted. */
function showZoneOnWorld() {
  const resid = currentResid;
  if (!resid) return;
  if (!showCategory('WORLD')) return;
  const go = tries => {
    const vp = document.getElementById('atlasViewport');
    if (!vp || vp.clientWidth < 40) { if (tries > 0) setTimeout(() => go(tries - 1), 60); return; }
    DERIVED.ATLAS_BELOW = [];
    const sc = atlasScene();
    if (!sc) return;
    const vw = vp.clientWidth, vh = vp.clientHeight;
    const node = sc.nodes.find(n => n.resid === resid);
    if (node && !node.depth) { atlasFit(); }
    else if (node) {
      const z = Math.min(atlasMaxZ(), Math.max(600, Math.min(vw, vh) * 0.95) / (node.w * node.s));
      atlasView.Z = z;
      atlasView.x = vw / 2 - (node.ox + node.w * node.s / 2) * z;
      atlasView.y = vh / 2 - (node.oy + node.h * node.s / 2) * z;
    } else {
      for (const n of sc.nodes) {
        const m = atlasMouths(n).find(x => x.dest && x.dest.resid === resid);
        if (m) { atlasDescend(m, n); return; }
      }
      atlasFit();
    }
    atlasSyncZoomLabel(); renderAtlasBar(); paintAtlas();
  };
  go(20);
}
function atlasZoomIntoTown(node) {
  const vp = document.getElementById('atlasViewport');
  if (!vp || vp.clientWidth < 40) return;
  const vw = vp.clientWidth, vh = vp.clientHeight;
  const z0 = atlasView.Z, x0 = atlasView.x, y0 = atlasView.y;
  const hx = node.ox + node.w * node.s / 2, hy = node.oy + node.h * node.s / 2;
  const want = Math.max(600, Math.min(vw, vh) * 0.95);
  const z1 = Math.min(atlasMaxZ(), want / (node.w * node.s));
  if (z1 <= z0 * 1.02) return;
  atlasAnimateTo(e => atlasZoomOnto(hx, hy, z0, z1, e, vw, vh, x0, y0), Math.round(window.ATLAS_TUNE.animMs * 0.7),
    () => { atlasSyncZoomLabel(); paintAtlas(); });
}
function atlasRiseOut() {
  const b = atlasBelowTop();
  const vp = document.getElementById('atlasViewport');
  if (!b || !vp || vp.clientWidth < 40) { atlasAscend(); return; }
  const vw = vp.clientWidth, vh = vp.clientHeight;
  const ax = (b.arrive ? b.arrive.x : 0) + 0.5, ay = (b.arrive ? b.arrive.y : 0) + 0.5;   // the below root is at s=1
  const z0 = atlasView.Z, x0 = atlasView.x, y0 = atlasView.y;
  const zDot = Math.min(z0 / 60, 4 / Math.max(atlasScene().root.w, atlasScene().root.h));
  atlasAnimateTo(e => { atlasZoomOnto(ax, ay, z0, zDot, e, vw, vh, x0, y0); atlasFadeTo(e); }, window.ATLAS_TUNE.animMs, () => {
    // shrunk to nothing; now the map above, from the blank middle of the hole
    const prev = DERIVED.ATLAS_BELOW.pop();
    renderAtlasBar();
    const sc = atlasScene();
    const node = (sc && sc.nodes.find(n => n.resid === prev.fromResid)) || (sc && sc.root);
    if (!sc || !node || !prev.view) { atlasFadeTo(0); if (prev.view) { atlasView.x = prev.view.x; atlasView.y = prev.view.y; atlasView.Z = prev.view.Z; } atlasSyncZoomLabel(); paintAtlas(); return; }
    const hx = node.ox + (prev.at.x + 0.5) * node.s, hy = node.oy + (prev.at.y + 0.5) * node.s;
    const zBig = Math.max(vw, vh) * 1.15 * (node.ts || 32) / node.s;   // one pixel of the hole fills the screen
    const fit = Math.min(vw / sc.root.w, vh / sc.root.h);
    const zEnd = Math.max(fit * (atlasBelowTop() ? 0.6 : 0.9), prev.view.Z / 2);
    atlasView.Z = zBig; atlasView.x = vw / 2 - hx * zBig; atlasView.y = vh / 2 - hy * zBig;
    const sx = atlasView.x, sy = atlasView.y;
    atlasAnimateTo(e => { atlasZoomOnto(hx, hy, zBig, zEnd, e, vw, vh, sx, sy); atlasFadeTo(1 - e); }, window.ATLAS_TUNE.animMs, () => { atlasFadeTo(0); atlasSyncZoomLabel(); paintAtlas(); }, 'out');
  }, 'in');
}

function atlasZoomAround(newZ, px, py) {
  atlasMarkBusy();
  if (window._atlasAnimating) return;
  const maxZ = atlasMaxZ();
  const sc = atlasScene();
  const vp = document.getElementById('atlasViewport');
  // The floor is the whole world in the panel: there is nothing further out.
  let minZ = 0.5;
  if (sc && vp && vp.clientWidth > 40) {
    const fit = Math.min(vp.clientWidth / sc.root.w, vp.clientHeight / sc.root.h);
    // Below ground there is a little further out to go, because going further
    // out is how you leave.
    minZ = fit * (atlasBelowTop() ? 0.6 : 0.9);
  }
  newZ = Math.max(minZ, Math.min(maxZ, newZ));
  const wx = (px - atlasView.x) / atlasView.Z, wy = (py - atlasView.y) / atlasView.Z;
  atlasView.Z = newZ;
  atlasView.x = px - wx * atlasView.Z;
  atlasView.y = py - wy * atlasView.Z;
  atlasSyncZoomLabel();
  schedulePaintAtlas();
}

function atlasPanBy(dx, dy) {
  atlasMarkBusy();
  if (window._atlasAnimating) return;
  atlasView.x += dx; atlasView.y += dy;
  schedulePaintAtlas();
}

/* One paint a frame, however many events ask for it.

   A finger moving across an iPhone reports its position sixty to a hundred
   and twenty times a second, and every report used to paint the whole scene
   before the next was read, so the drawing fell behind the finger and the
   map juddered. A move now changes the three view numbers and asks for a
   paint; the first ask in a frame schedules one and the rest are absorbed,
   so the scene is drawn once per frame at wherever the finger is by then.
   Every synchronous caller -- the checks, the fit, a thumbnail arriving --
   still calls paintAtlas itself. */
let atlasPaintPending = false;
function schedulePaintAtlas() {
  if (atlasPaintPending) return;
  atlasPaintPending = true;
  const go = () => { atlasPaintPending = false; if (window.CUR_SUBN === 'WORLD') paintAtlas(); };
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(go); else setTimeout(go, 16);
}

// The slider and its label speak in "screen pixels per world square", which
// is the only zoom number in this renderer that means anything.
/* The slider runs from the whole world in view to the closest zoom, and it
   is logarithmic: a step at the left end is the same factor as a step at
   the right. It was linear in pixels a square, which made its first
   millimetre a doubling and its last inch nothing (the maintainer, 9
   September 2026: it jumped too fast at the beginning). With the whole
   world its left end there is no Whole world button. */
function atlasFitZ() {
  const vp = document.getElementById('atlasViewport');
  const sc = atlasScene();
  if (!vp || !sc || vp.clientWidth < 40) return 1;
  return Math.min(vp.clientWidth / sc.root.w, vp.clientHeight / sc.root.h);
}
function atlasSyncZoomLabel() {
  const lab = document.getElementById('atlasZoomLabel');
  if (lab) lab.textContent = atlasView.Z.toFixed(1) + ' px/sq';
  const sl = document.getElementById('atlasZoomSlider');
  if (sl) {
    const lo = Math.max(1e-6, atlasFitZ()), hi = Math.max(lo * 1.0001, atlasMaxZ());
    sl.min = 0; sl.max = 1000;
    sl.value = Math.round(1000 * Math.max(0, Math.min(1, Math.log(atlasView.Z / lo) / Math.log(hi / lo))));
  }
}
function atlasZoomFromSlider() {
  const sl = document.getElementById('atlasZoomSlider');
  const vp = document.getElementById('atlasViewport');
  if (!sl || !vp) return;
  atlasGestureTouch();
  const lo = Math.max(1e-6, atlasFitZ()), hi = Math.max(lo * 1.0001, atlasMaxZ());
  atlasZoomAround(lo * Math.pow(hi / lo, (+sl.value) / 1000), vp.clientWidth / 2, vp.clientHeight / 2);
}

/* A click identifies what is under it, and offers the map panel for the rest.

   This renderer navigates and names; walls, roofs, marks, walk-the-day,
   lighting, the export and the prop editor are the panel's job and stay in
   Entities > Regions untouched. The card here says what is on the square and
   offers to open that map there. */
window.ATLAS_SEL = null;
function atlasInspect(px, py) {
  const host = document.getElementById('atlasInspect');
  const hit = atlasAt(px, py);
  if (!host) return;
  if (!hit) { window.ATLAS_SEL = null; host.innerHTML = '<span class="inspDim">Nothing here.</span>';
              host.style.display = 'block'; paintAtlas(); return; }
  const { node, tx, ty } = hit;
  // The same square again clears the pick, as a second tap does on Zones.
  const was = window.ATLAS_SEL;
  if (was && was.resid === node.resid && was.tx === tx && was.ty === ty) {
    window.ATLAS_SEL = null;
    host.innerHTML = '<span class="inspDim">Nothing selected. Tap a square to see what is on it.</span>';
    host.style.display = 'block'; paintAtlas(); return;
  }
  window.ATLAS_SEL = { resid: node.resid, tx, ty };
  paintAtlas();
  const e = mapRenderFor(node.resid, true);
  const parts = ['<div class="inspHead">' + svLink(node.name + ', square ' + tx + ', ' + ty, 'atlasOpenSquare(' + node.resid + ',' + tx + ',' + ty + ')') + '</div>'];
  if (e && e.result) {
    const tileId = e.result.m ? mapTileAt(e.result.m, tx, ty) : 0;
    const terrain = tileId ? (terrainNameFor(tileId) || compositeTileName(tileId)) : null;
    if (tileId) parts.push('<div class="inspCard"><b>' + svEsc(terrain || 'terrain') + '</b> ' +
      '<span class="inspDim">tile 0x' + tileId.toString(16).toUpperCase() + '</span>' +
      (refExists(0x8E00 + (tileId >> 4)) ? '<div class="inspActs">' + svLink('Open ' + (terrain || 'the tile') + ' in Tilesets', 'jumpToResource(' + (0x8E00 + (tileId >> 4)) + ')') + '</div>' : '') + '</div>');
    // The inspector can hold links, so this asks for them; eggDetail escapes
    // its own text. The hover card cannot (pointer-events:none) and takes
    // the plain form.
    const egg = atlasEggAt(node, tx, ty, true);
    if (egg) parts.push('<div class="inspCard"><b>egg</b> <span class="inspDim">' + egg + '</span></div>');
    const hits = (e.result.props || []).filter(p => p.cells.some(c => c[0] === tx && c[1] === ty));
    for (const p of hits.slice(0, 6)) {
      const pt = p.rec.proptype;
      const name = propDisplayName(pt) || ('prop 0x' + pt.toString(16));
      let says = '';
      try { says = propTextByData1(pt, p.rec.d1) || ''; } catch (err) { says = ''; }
      const item = (function () { try { return isInventoryItem(pt); } catch (err) { return false; } })();
      parts.push('<div class="inspCard"><b>' + svEsc(name) + '</b>' +
        (says ? ' <span class="inspDim">' + svEsc(says) + '</span>' : '') +
        '<div class="inspActs">' + svLink('Open ' + name + (says ? ' “' + says + '”' : '') + ' in ' + (item ? 'Items' : 'Tilesets'),
          "openVia('" + (item ? 'ITEMS' : 'PROPS') + "', () => " + (item ? 'showItemDetail(' : 'showPropTypeDetail(') + pt + '))') + '</div></div>');
    }
    // Whoever is standing here, with their face and the way to their page.
    for (const c of atlasFolk(node).filter(c => Math.round(c.x) === tx && Math.round(c.y) === ty)) {
      const face = characterFace(c.index);
      parts.push('<div class="inspCard person">' +
        (face && face.url ? '<img class="inspFace" src="' + face.url + '" alt="" width="64" height="64">' : '') +
        '<div><b>' + svEsc(c.name || ('Character ' + c.index)) + '</b> <span class="inspDim">' +
        svEsc(c.walking ? 'walking' : c.sitting ? 'sitting' : String(c.mode || 'here')) + '</span>' +
        '<div class="inspActs">' + svLink('Open ' + (c.name || ('Character ' + c.index)) + ' in Characters', 'openCharacter(' + c.index + ')') + '</div></div></div>');
    }
  }
  // Everything this renderer does not do lives one click away, where it
  // already worked and still does.
  parts.push('<div class="inspActs">' + svLink('Open ' + node.name + ' in Zones', 'jumpToResource(' + node.resid + ')') + '</div>');
  host.innerHTML = parts.join('');
  host.style.display = 'block';
}

/* What a sign says: the text a prop's Data1 picks. The sign classes' Examine
   hands a helper `word 0x0218[0] + Data1`, a far word into the string store
   0x0218 offset by the byte, so the sign at (105,103) on the world map
   with Data1 16 shows the sixteenth string there. Read off the class
   listing by that shape rather than typed per class, so any class that
   picks a text the same way -- the plaque, a poster -- gets its line, and
   a modded archive its own. The store is an array of drefs into itself
   (0x82, then the offset), which dvmDataValue leaves raw, hence the small
   reader beside it. */
const _propTextShape = new Map();
function propTextByData1(pt, d1) {
  if (!_propTextShape.has(pt)) {
    let shape = null;
    try {
      const e = buildScriptTextIndex().find(x => x.resid === 0x1000 + pt);
      const m = e && /word 0x([0-9A-F]{4})\[(\d+)\]\s+arg Arg00\s+get_field data1 \(0x6\)\s+add/.exec(e.text.replace(/^\s*[0-9A-F]{4}\s+/gm, ''));
      if (m) shape = { resid: parseInt(m[1], 16), base: parseInt(m[2], 10) };
    } catch (err) { shape = null; }
    _propTextShape.set(pt, shape);
  }
  const sh = _propTextShape.get(pt);
  if (!sh || !d1) return '';
  return dvmFarString(sh.resid, sh.base + d1) || '';
}
function dvmFarString(resid, k) {
  let d = null;
  try { const raw = getResourceBytes(ARCHIVE, resid); if (raw) d = smartDecrypt(raw, resid).data; } catch (err) { d = null; }
  if (!d || d[0] !== 0x90 || k < 0 || k >= d[1]) return '';
  const p = 2 + 4 * k;
  if (p + 4 > d.length || d[p] !== 0x82) return '';
  const off = u16be(d, p + 2);
  if (off >= d.length) return '';
  let e = off; while (e < d.length && d[e] !== 0 && d[e] < 0x80) e++;
  return decodeMacRoman(d.subarray(off, e)).trim();
}

// Pointer handling, kept apart from the panel's so neither has to know about
// the other. Wired once, on the same viewport.
function setupAtlasInteraction() {
  const vp = document.getElementById('atlasViewport');
  if (!vp || vp.dataset.atlasWired) return;
  vp.dataset.atlasWired = '1';
  const pts = new Map();
  // `moved` and `multi` belong to the gesture, first finger down to last
  // finger up, not to a pointer. Until 11 September 2026 every pointerdown
  // reset `moved`, the second finger's included, and a pinch added nothing
  // to it, so lifting out of a pinch read as a tap: the square under the
  // last finger was picked and its card raised. A gesture that ever had two
  // fingers on the glass is a pinch, however little either of them moved.
  let pinchDist = 0, pinchZ = 0, moved = 0, multi = false;
  // On a touch screen a tap raises the card and a press-and-hold keeps it
  // under the moving finger: there is no pointer resting over anything, so
  // both gestures ask the question a resting mouse asks. Sliding is a pan.
  // The hold neither pans nor opens the inspector; the tap does both.
  let holdTimer = null, peeking = false;
  const endHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
  const setTouching = on => {
    if (atlasView.touching === on) return;
    atlasView.touching = on;
    if (!on) schedulePaintAtlas();           // sharp again, the moment the finger lifts
  };
  const local = e => { const r = vp.getBoundingClientRect();
                       return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  vp.addEventListener('pointerdown', e => {
    if (!window.ATLAS || window.CUR_SUBN !== 'WORLD') return;
    if (!pts.size) { atlasGestureBegin(); moved = 0; multi = false; }
    pts.set(e.pointerId, local(e));
    if (pts.size > 1) multi = true;
    endHold(); peeking = false;
    if (e.pointerType !== 'mouse') {
      hideAtlasHover();          // a new gesture puts the last card away
      setTouching(true);
      if (pts.size === 1) {
        const cx = e.clientX, cy = e.clientY;
        holdTimer = setTimeout(() => {
          holdTimer = null;
          if (pts.size !== 1 || moved >= 6) return;
          peeking = true;
          atlasHover(cx, cy, true);
        }, 350);
      }
    }
    if (pts.size === 2) {
      endHold();
      const p = Array.from(pts.values());
      pinchDist = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      pinchZ = atlasView.Z;
    }
  });
  vp.addEventListener('pointermove', e => {
    if (!window.ATLAS || window.CUR_SUBN !== 'WORLD') return;
    if (e.pointerType === 'mouse' && !pts.size) { atlasHover(e.clientX, e.clientY); return; }
    const prev = pts.get(e.pointerId);
    if (!prev) return;
    const now = local(e);
    pts.set(e.pointerId, now);
    if (peeking) { atlasHover(e.clientX, e.clientY, true); return; }
    if (pts.size === 2) {
      const p = Array.from(pts.values());
      const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
      if (pinchDist > 0)
        atlasZoomAround(pinchZ * (d / pinchDist), (p[0].x + p[1].x) / 2, (p[0].y + p[1].y) / 2);
    } else {
      moved += Math.abs(now.x - prev.x) + Math.abs(now.y - prev.y);
      if (moved >= 6) endHold();
      atlasPanBy(now.x - prev.x, now.y - prev.y);
    }
  });
  const up = e => {
    if (!window.ATLAS || window.CUR_SUBN !== 'WORLD') return;
    const had = pts.has(e.pointerId);
    pts.delete(e.pointerId);
    if (pts.size < 2) pinchDist = 0;
    endHold();
    if (!pts.size) setTouching(false);
    // The card stays where the lift left it -- it is clear of the finger now
    // -- and the next gesture puts it away.
    if (peeking) { peeking = false; return; }
    if (had && moved < 6 && !multi) {
      const p = local(e);
      // A mouth first: it is a small target drawn over the ground, and a tap
      // on it means the way down rather than the square it sits on.
      // The nearest ring, not the first in the list: rings stand side by
      // side now, and the first one whose circle a tap falls inside is not
      // necessarily the one aimed at.
      let hit = null, hitD = Infinity;
      for (const q of (window.ATLAS_MOUTHS || [])) {
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d <= q.rad && d < hitD) { hit = q; hitD = d; }
      }
      if (hit) { atlasGesture.active = false; atlasTakeMouth(hit.m, hit.node); return; }
      // A town still wearing its roofs: a tap goes in until they come off,
      // the way a ring goes into a cave, without the fall to black.
      const town = atlasAt(p.x, p.y);
      if (town && town.node.depth && town.r.w < 540 && !atlasBelowTop()) { atlasGesture.active = false; atlasZoomIntoTown(town.node); return; }
      atlasInspect(p.x, p.y);
      // A tap is the hover on a touch screen -- see the map panel's
      // clearPointer for the reasoning; this is the same gesture.
      if (e.pointerType !== 'mouse') atlasHover(e.clientX, e.clientY, true);
    }
    if (!pts.size) atlasGestureEnd();
  };
  vp.addEventListener('pointerup', up);
  vp.addEventListener('pointercancel', e => { pts.delete(e.pointerId); endHold(); peeking = false; hideAtlasHover(); if (!pts.size) { setTouching(false); atlasGestureEnd(); } });
  // A touch pointer leaves the element the moment it lifts; only a mouse
  // leaving means the reader has stopped looking.
  vp.addEventListener('pointerleave', e => {
    if (window.ATLAS && (!e || e.pointerType === 'mouse')) hideAtlasHover();
  });
  vp.addEventListener('wheel', e => {
    if (!window.ATLAS || window.CUR_SUBN !== 'WORLD') return;
    e.preventDefault();
    const p = local(e);
    atlasGestureTouch();
    atlasZoomAround(atlasView.Z * (e.deltaY > 0 ? 0.9 : 1.1), p.x, p.y);
  }, { passive: false });
}

/* Who that is, under the pointer -- the same card the panel shows, fed from
   whichever node the pointer is over rather than from the open map. */
/* What is on a square, for the card: who is standing there, what is placed
   there, and what the ground is. Shared by the atlas and the map panel, so
   the two cards say the same thing about the same square.

   `asked` is the difference between a mouse passing over and a finger that
   tapped or held. A passing pointer stays quiet over bare ground -- a card
   over every blade of grass is noise -- and speaks only where there is
   somebody or something; a finger has asked, and gets the ground too. */
function squareCard(level, e, tx, ty, placeName, asked) {
  let people = [];
  try {
    const hour = window.MAP_WALK ? window.MAP_TIME : window.MAP_HOUR;
    people = charactersOnLevel(level, hour).filter(c => Math.round(c.x) === tx && Math.round(c.y) === ty);
  } catch (err) { people = []; }
  const props = (e && e.result && e.result.props ? e.result.props : [])
    .filter(p => p.cells.some(c => c[0] === tx && c[1] === ty))
    .map(p => propDisplayName(p.rec.proptype) || ('prop 0x' + p.rec.proptype.toString(16)));
  const tileId = e && e.result && e.result.m ? mapTileAt(e.result.m, tx, ty) : 0;
  const ground = tileId ? (terrainNameFor(tileId) || compositeTileName(tileId) || '') : '';
  if (!people.length && !props.length && !asked) return null;
  const c = people[0] || null;
  const what = c ? (c.walking ? 'walking'
    : c.sitting ? ('sitting, facing ' + ['north', 'east', 'south', 'west'][(c.aspect >> 2) & 3])
    : String(c.mode || 'here')) : '';
  const seen = new Set(); const shown = props.filter(n => !seen.has(n) && seen.add(n)).slice(0, 3);
  const lines = [];
  if (c) lines.push('<span class="hvName">' + svEsc(c.name || ('Character ' + c.index)) + '</span>' +
    '<span class="hvWhat">' + svEsc(what) + (people.length > 1 ? ', and ' + (people.length - 1) + ' more here' : '') + '</span>');
  if (shown.length) lines.push('<span class="' + (c ? 'hvWhat' : 'hvName') + '">' + svEsc(shown.join(', ')) +
    (props.length > shown.length ? ', and ' + (props.length - shown.length) + ' more' : '') + '</span>');
  if (asked && ground) lines.push('<span class="hvWhat">' + svEsc(ground) + '</span>');
  if (placeName) lines.push('<span class="hvWhere">' + svEsc(placeName) + ' &nbsp;·&nbsp; ' + tx + ', ' + ty + '</span>');
  return { html: '<div>' + lines.join('') + '</div>', person: c };
}

/* A character's face, for the card and the inspector: the portrait where
   there is one -- 0x8800 + index - 1, the same join the dossier makes -- and
   the sprite where there is not. A selected character used to be shown by
   the sprite alone, which names a class ("a man") where the face names the
   person. Decoded once per character and kept as a canvas and as a data
   URL, since the inspector's cards are strings. Dropped with the derived
   tables. */
const _faceCache = new Map();
function characterFace(i) {
  if (_faceCache.has(i)) return _faceCache.get(i);
  let out = null;
  try {
    const raw = getResourceBytes(ARCHIVE, 0x8800 + (i - 1));
    if (raw) {
      const dec = decodeResource(ARCHIVE, raw, 135);
      if (dec && dec.W) {
        const c = document.createElement('canvas');
        drawToCanvas(c, dec.W, dec.H, dec.image, 0);
        out = { canvas: c, url: '' };
        try { out.url = c.toDataURL('image/png'); } catch (e) { out.url = ''; }
      }
    }
  } catch (e) { out = null; }
  _faceCache.set(i, out);
  return out;
}
// The card's picture: the face, else the sprite.
function appendFaceOrSprite(el, c) {
  const face = c && c.index !== undefined ? characterFace(c.index) : null;
  const cv = document.createElement('canvas');
  if (face) {
    cv.width = face.canvas.width; cv.height = face.canvas.height;
    cv.getContext('2d').drawImage(face.canvas, 0, 0);
    cv.className = 'hvFace';
  } else {
    try { drawTileToCanvas(cv, getPropTileList()[c.proptype] + c.aspect, 32, c.rotated); } catch (e) { quiet(e); }
  }
  el.appendChild(cv);
}

let atlasHoverKey = '';
function atlasHover(clientX, clientY, asked) {
  const el = document.getElementById('atlasHover');
  const vp = document.getElementById('atlasViewport');
  if (!el || !vp) return;
  const r = vp.getBoundingClientRect();
  const px = clientX - r.left, py = clientY - r.top;
  const hit = atlasAt(px, py);
  if (!hit) { hideAtlasHover(); atlasHoverKey = ''; return; }
  const key = hit.node.resid + ':' + hit.tx + ',' + hit.ty + (asked ? '!' : '');
  if (key === atlasHoverKey && el.style.display !== 'none') { placeHoverCard(el, vp, px, py, asked); return; }
  atlasHoverKey = key;
  // A town still under its roofs is one thing under the pointer, not a
  // square of it: the card names it and says a tap goes in.
  if (hit.node.depth && hit.r.w < 540 && !atlasBelowTop()) {
    el.innerHTML = '<div><span class="hvName">' + svEsc(hit.node.name) + '</span><span class="hvWhat">tap to go in</span></div>';
    el.style.display = 'flex';
    placeHoverCard(el, vp, px, py, asked);
    return;
  }
  const e = mapRenderFor(hit.node.resid, true);
  const card = squareCard(hit.node.resid & 0xFF, e, hit.tx, hit.ty, hit.node.name, asked);
  // A tapped card can be tapped back, so it takes the LINKED form; one that
  // is merely following the pointer cannot be clicked and takes the plain
  // one. hvPinned is what turns pointer-events on.
  const egg = atlasEggAt(hit.node, hit.tx, hit.ty, !!asked);
  if (!card && !egg) { el.style.display = 'none'; return; }
  el.innerHTML = (card ? card.html : '<div></div>').replace(/<\/div>$/, (egg ? '<span class="hvWhat">' + egg + '</span>' : '') + '</div>');
  if (card && card.person) appendFaceOrSprite(el, card.person);
  el.classList.toggle('hvPinned', !!asked);
  el.style.display = 'flex';
  placeHoverCard(el, vp, px, py, asked);
}

function downloadMapPNG() {
  const canvas = document.getElementById('mapTerrainCanvas');
  const cm = window.CUR_MAP;
  if (!canvas || !cm) return;
  const name = currentResid ? ('cythera_map_0x' + currentResid.toString(16).toUpperCase() + '.png') : 'cythera_map.png';
  // The screen canvas is budgeted (TS=8 for the world map), and the file
  // used to be that same reduced bitmap. The file is rendered again at the
  // native 32px tile where the whole map fits in one canvas Chrome and
  // Safari will still encode (about 16.7 MP), and at 16px above that -- the
  // 256x256 world map, which at 32px would be 67 MP -- so that it is at
  // worst twice as sharp as the screen and never fails silently. iOS keeps
  // the screen size: it tears the tab down for canvases this large. Every
  // layer painter takes a context and a tile size, which is what the detail
  // lens needed too, so the flattening is the same code at another size.
  let out, ctx, TS = cm.TS;
  // Native first, even for the 256x256 world map (8192 square, 67 MP, which
  // desktop Chrome and Firefox encode); if the browser refuses the canvas
  // -- getContext comes back null, or the render throws -- try half that.
  // iOS keeps the screen size: it tears the tab down for canvases this size.
  let wantTS = IS_IOS_WEBKIT ? cm.TS : 32;
  // On iOS the full-size file is written a strip at a time instead (above):
  // no whole-map canvas, so no tab torn down, and the native 32 px a square.
  if (IS_IOS_WEBKIT && cm.TS < 32 && typeof CompressionStream !== 'undefined') {
    downloadMapPNGStreamed(cm, 32, name).catch(e => { setStatus('Could not write the full-size map (' + e.message + '); saving the screen size instead.', true); downloadMapPNG._fallback = true; downloadMapPNG(); });
    if (!downloadMapPNG._fallback) return;
    downloadMapPNG._fallback = false;
  }
  if (wantTS > cm.TS) {
    let full = null;
    for (const tryTS of [wantTS, 16]) {
      if (tryTS <= cm.TS) break;
      try {
        full = renderMapVisual(cm.resid, cm.mapData, { forceTS: tryTS });
        if (full && full.canvas && full.canvas.getContext('2d')) { wantTS = tryTS; break; }
      } catch (e) { quiet(e); }
      full = null;
    }
    if (full && full.canvas) {
      out = full.canvas; ctx = out.getContext('2d'); TS = wantTS;
      if (window.SHOW_ROOFS) drawRoofLayer(ctx, TS);
      drawCharacterLayer(ctx, TS);
      drawMapMarks(ctx, TS);
      if (window.SHOW_LIGHTING) drawLighting(ctx, TS);
    }
  }
  if (!out) {
    // Flatten exactly what's currently on screen -- terrain, the
    // door/character overlay, and the darkness/lighting layer if it's on --
    // rather than just the bare terrain canvas underneath everything else.
    out = document.createElement('canvas');
    out.width = canvas.width; out.height = canvas.height;
    ctx = out.getContext('2d');
    ctx.drawImage(canvas, 0, 0);
    const charLayer = document.getElementById('charLayer');
    if (charLayer && window.SHOW_CHARACTERS) ctx.drawImage(charLayer, 0, 0);
    const lightLayer = document.getElementById('lightLayer');
    if (lightLayer && window.SHOW_LIGHTING) ctx.drawImage(lightLayer, 0, 0);
  }
  // No palette indices to hand over: this is several layers composited with
  // alpha, and the lighting layer in particular produces colours that are not
  // in the CLUT at all. So it takes the RGBA path and gets its metadata
  // stripped rather than a PLTE.
  triggerPNGDownload(out, name);
}
