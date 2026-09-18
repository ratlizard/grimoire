/* Prop types, item classes, the aspect rule and the prop word.

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
   last of these. File 2 of 14. */

// --- Prop types ------------------------------------------------------------
// Every prop type's base tile is in 0xF000 and its name is 0xF004's name for
// that tile. This table was the wiki's "List of Prop-Tile Associations", 395
// names, embedded when the archive was thought to carry none; 393 of them are
// the file's own name for the prop type's base tile, letter for letter, and
// were removed on 11 September 2026, since a copy of the file's words is a
// thing an edited archive contradicts without a sign. The two left are the
// two the file does not say: "obols", where 0xF004 has "obol", and the wiki
// scrape's "[LandKing](LandKing) Amulet" [sic], where it has "LandKing
// Amulet". The file names no prop type the table did not, so taking the
// file's name first changed no classification (propTypeName).
const PROP_TYPE_NAMES = {130:"obols",244:"[LandKing](LandKing) Amulet"};

// Which prop types are inhabited: any type used by a record in the character
// table is somebody rather than something. Read from 0xF009, not guessed from
// the names -- "goat" and "harpy" are creatures, but so is "king", and no
// keyword list gets that right.
window.LIVING_PROPTYPES = null;
function livingPropTypes() {
  if (window.LIVING_PROPTYPES) return window.LIVING_PROPTYPES;
  const set = new Set();
  try {
    for (const c of loadCharacterTable()) if (c && c.proptype) set.add(c.proptype);
  } catch (e) {}
  return (window.LIVING_PROPTYPES = set);
}

// A prop type's name for deciding what it is: the two entries above where
// they differ from the file, the file's name for its base tile otherwise.
// isWallProp, classifyProp, the lockable and exit tests and the container
// pictures all key off this, so it answers without the names switch.
let _propFileNames = { src: null, byPt: new Map() };
function propTypeName(pt) {
  if (PROP_TYPE_NAMES[pt]) return PROP_TYPE_NAMES[pt];
  try {
    const src = loadTerrainNames();
    if (_propFileNames.src !== src) _propFileNames = { src, byPt: new Map() };
    if (!_propFileNames.byPt.has(pt)) { const b = getPropTileList()[pt]; _propFileNames.byPt.set(pt, (b && terrainNameFor(b)) || null); }
    return _propFileNames.byPt.get(pt);
  } catch (e) { return null; }
}

/* ---------------------------------------------------------------------------
   Names this tool supplies
   ---------------------------------------------------------------------------
   PROP_TYPE_NAMES above is the delvmod wiki's prop-type list. It is a good
   list and it is not in the archive, which already put the resource-label
   tables behind a switch ("Names this tool supplies", off by default) -- but
   the prop-type names escaped that switch and went on printing, flagged with
   a dagger that had no legend anywhere on the page because #labelLegend is
   hidden. So the dagger marked something as a guess without ever saying what
   kind of guess, which is the worst of both.

   They are behind the same switch now, and where they do print they carry a
   readable tag rather than a footnote mark. Classification is unaffected:
   isWallProp, classifyProp and the container-picture table all still read
   propTypeName directly, because deciding what a prop IS from its name is not
   the same act as showing that name to a reader.
--------------------------------------------------------------------------- */
function propTypeNameShown(pt) {
  return window.SHOW_BUILTIN_LABELS ? PROP_TYPE_NAMES[pt] || null : null;
}
// Every prop type's shown name, for the search: the tile's own name from
// 0xF004 first, the built-in list only behind the switch.
function propNameTable() {
  const t = getPropTileList(), out = {};
  for (let pt = 1; pt < t.length && pt < 1024; pt++) { const n = propDisplayName(pt); if (n) out[pt] = n; }
  return out;
}
// The best name for a prop type: the archive's own name for its base tile
// (0xF004) first, the wiki's list second and only when it is switched on.
function propDisplayName(pt, base) {
  const b = (base === undefined || base === null) ? (getPropTileList()[pt] || 0) : base;
  return (b && terrainNameFor(b)) || propTypeNameShown(pt) || null;
}
const WIKI_TAG = '<span class="guessTag" title="Name from the delvmod wiki\u2019s prop-type list, ' +
  'not from the archive. Switch these off under \u201cSettings\u201d.">wiki</span>';
// Name plus provenance, as HTML, for a gallery caption. The name itself is
// wrapped so that sorting and filtering read the name and not the tag beside
// it -- cellSortKeys prefers .lblText where there is one.
function propNameHTML(pt, base) {
  const b = (base === undefined || base === null) ? (getPropTileList()[pt] || 0) : base;
  const own = b && terrainNameFor(b);
  // Data-supplied names are monospace -- see .dataname in the stylesheet.
  if (own) return '<span class="lblText dataname">' + svEsc(own) + '</span>';
  const wiki = propTypeNameShown(pt);
  if (wiki) return '<span class="lblText">' + svEsc(wiki) + '</span>' + WIKI_TAG;
  const hidden = PROP_TYPE_NAMES[pt] || null;
  return '<span class="lblText" style="color:#8c8980">unnamed</span>' +
    (hidden ? '<span class="nameOffTag" title="The wiki calls this \u201c' + svEsc(hidden) +
      '\u201d. Switch tool-supplied names on under \u201cSettings\u201d to show it.">name hidden</span>' : '');
}
function itemNameHTML(pt, base) { return propNameHTML(pt, base); }

// Which of a prop's frames are still the SAME THING. A prop's frame block is
// bounded by the end of its 16-tile sheet, and that bound is too generous for
// small props: prop type 0x141 is the crystal ball at tile 0x883, but its
// block runs to 0x88F, which takes in the four paintings at 0x88C-0x88F. The
// gallery picked its representative frame by looking for span bits, found them
// on the 2x1 painting at 0x88D, and drew a painting captioned "crystal ball".
// 0xF004 names tiles in runs and settles it: 0x883-0x886 are "crystal ball"
// and 0x887 starts "boards". Frames outside the base tile's run are still
// listed (aspects do run past a run boundary -- the rope is aspect 3 of
// "post"), they are just not what the prop is shown AS, and the detail view
// now names each one from the archive.
let _propBaseTiles = null;
function propBaseTileSet() {
  if (_propBaseTiles) return _propBaseTiles;
  const set = new Set();
  try { for (const t of getPropTileList()) if (t) set.add(t); } catch (e) {}
  return (_propBaseTiles = set);
}
function framesSharingName(base, present) {
  const own = terrainNameFor(base);
  // A frame that is the base tile of another prop type is that type's, not
  // this one's: the rolled map (0x265, type 378) has the flat map (0x267,
  // type 273) two tiles on, both called "map", and the Items gallery used
  // to show one map turning into the other. Found 6 September 2026; the
  // same rule keeps a doorway from cycling into an archway and a sword
  // into the next sword.
  const bases = propBaseTileSet();
  const mine = present.filter(f => !f || !bases.has(base + f));
  if (!own) return mine;
  const same = mine.filter(f => terrainNameFor(base + f) === own);
  return same.length ? same : mine;
}

// The same frames, cut into runs by the name 0xF004 gives each one. Prop type
// 0x141 comes back as [{crystal ball, 0-3}, {boards, 4}, {staff, 5-8},
// {painting, 9-12}] -- which is what the sheet really holds, against the flat
// "13 frames of crystal ball" the galleries used to print.
function frameRuns(base, present) {
  const runs = [];
  for (const f of present) {
    const nm = terrainNameFor(base + f) || null;
    const last = runs[runs.length - 1];
    if (last && last.name === nm) last.frames.push(f);
    else runs.push({ name: nm, frames: [f] });
  }
  return runs;
}

/* Frames that share a name can still be different things: 0x883-0x886 are four
   crystal balls and the archive calls all four "crystal ball", but they are
   cobalt, green, magenta and lavender, and a gallery that prints the name four
   times has thrown away the only thing that tells them apart. The palette is
   fixed and indexed, so the dominant colour of a frame is a fact about it, not
   a guess -- this averages the SATURATED pixels (the greys and the black
   outline are shared by every frame and say nothing) and names the hue. */
const HUE_WORDS = [[15,'red'],[45,'orange'],[70,'yellow'],[160,'green'],[200,'cyan'],
                   [258,'blue'],[320,'purple'],[345,'pink'],[361,'red']];
const _frameColourCache = new Map();
function frameColourWord(tileId) {
  if (_frameColourCache.has(tileId)) return _frameColourCache.get(tileId);
  let word = null;
  try {
    const img = resolveTileImage(tileId);
    if (img) {
      let sx = 0, sy = 0, n = 0, lum = 0, ink = 0;
      for (let i = 0; i < img.length; i++) {
        const v = img[i];
        if (!v) continue;
        const [r, g, b] = PAL_RGB[v];
        ink++;
        lum += (r + g + b) / 3;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        if (max < 24 || (max - min) / max < 0.28) continue;   // grey, or too dark to read
        let h;
        const d = max - min;
        if (max === r) h = 60 * (((g - b) / d) % 6);
        else if (max === g) h = 60 * ((b - r) / d + 2);
        else h = 60 * ((r - g) / d + 4);
        if (h < 0) h += 360;
        const rad = h * Math.PI / 180;
        sx += Math.cos(rad); sy += Math.sin(rad); n++;
      }
      if (n >= Math.max(6, ink * 0.04)) {
        let h = Math.atan2(sy, sx) * 180 / Math.PI;
        if (h < 0) h += 360;
        for (const [lim, w] of HUE_WORDS) if (h < lim) { word = w; break; }
      } else if (ink) {
        const mean = lum / ink;
        word = mean < 70 ? 'dark' : mean > 185 ? 'pale' : 'grey';
      }
    }
  } catch (e) {}
  _frameColourCache.set(tileId, word);
  return word;
}

// Colour words are only worth printing where they distinguish, and what
// distinguishes one frame of a run from another is the colour the OTHERS do
// not have: the four crystal balls share an identical grey stand and black
// outline and differ only in the glass. So the palette indices common to every
// frame in the run are dropped first, and each frame is then named by what is
// left. Returns a map frame -> word, or null when the run has nothing to tell
// apart.
function distinguishingColours(base, frames) {
  if (!frames || frames.length < 2) return null;
  const hists = frames.map(f => {
    const h = new Map();
    const img = resolveTileImage(base + f);
    if (img) for (const v of img) if (v) h.set(v, (h.get(v) || 0) + 1);
    return h;
  });
  if (hists.some(h => !h.size)) return null;
  const shared = new Set();
  for (const idx of hists[0].keys()) if (hists.every(h => h.has(idx))) shared.add(idx);
  const out = new Map();
  const seen = new Set();
  for (let i = 0; i < frames.length; i++) {
    let best = 0, bestN = 0;
    for (const [idx, n] of hists[i]) if (!shared.has(idx) && n > bestN) { best = idx; bestN = n; }
    const w = best ? colourWordFor(PAL_RGB[best]) : frameColourWord(base + frames[i]);
    out.set(frames[i], w);
    seen.add(w);
  }
  return seen.size > 1 ? out : null;
}

// Name one palette entry. Lightness first, because "pale green" and "dark
// green" are the difference between a jade and a bottle.
function colourWordFor(rgb) {
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  const lum = (r + g + b) / 3;
  if (!max || d / max < 0.22) return lum < 60 ? 'black' : lum > 200 ? 'white' : 'grey';
  let h;
  if (max === r) h = 60 * (((g - b) / d) % 6);
  else if (max === g) h = 60 * ((b - r) / d + 2);
  else h = 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  let word = 'red';
  for (const [lim, w] of HUE_WORDS) if (h < lim) { word = w; break; }
  const sat = d / max;
  if (lum < 70) return 'dark ' + word;
  if (lum > 195 && sat < 0.55) return 'pale ' + word;
  // A washed-out hue and a pure one read as different colours even when the
  // hue wheel puts them in the same slice -- crystal ball 3 is a lavender
  // grey and crystal ball 0 is pure cobalt, and both are nominally "blue".
  if (sat < 0.45) return 'muted ' + word;
  return word;
}

// Draw a prop's sprite, assembling the extra squares when the tile attributes
// say it spans more than one. Returns the canvas, or null if there is nothing.
function drawPropSprite(tileId, px) {
  const pieces = multiTilePieces(tileId, false) || [];
  let minX = 0, minY = 0, maxX = 0, maxY = 0;
  for (const p of pieces) {
    minX = Math.min(minX, p.dx); minY = Math.min(minY, p.dy);
    maxX = Math.max(maxX, p.dx); maxY = Math.max(maxY, p.dy);
  }
  const cols = maxX - minX + 1, rows = maxY - minY + 1;
  const c = document.createElement('canvas');
  c.width = cols * 32; c.height = rows * 32;
  const ctx = c.getContext('2d');
  const put = (tile, dx, dy) => {
    const tmp = document.createElement('canvas');
    try { drawTileToCanvas(tmp, tile, 32); } catch (e) { return; }
    ctx.drawImage(tmp, (dx - minX) * 32, (dy - minY) * 32);
  };
  for (const p of pieces) put(p.tile, p.dx, p.dy);
  put(tileId, 0, 0);
  c.style.width = (cols * px) + 'px';
  c.style.height = (rows * px) + 'px';
  c.style.imageRendering = 'pixelated';
  return { canvas: c, cols, rows, multi: pieces.length > 0 };
}

function propFrameFill(tile) {
  try {
    const img = resolveTileImage(tile);
    if (!img) return 0;
    let n = 0; for (let i = 0; i < img.length; i++) if (img[i]) n++;
    return n;
  } catch (e) { return 0; }
}

/* Filtering a gallery.
   The three synthesised galleries -- props, items, fork resources -- build
   their cells from tables and re-render to filter. Every OTHER gallery is a
   list of resources whose cells are already in the DOM with their name and id
   printed on them, so those filter by hiding cells, which is instant and needs
   no per-gallery code. That is what makes "a search bar on every gallery"
   one function rather than a dozen. */
window.PROP_FILTER = '';
const REBUILDING_GALLERIES = new Set(['PROPS', 'ITEMS', 'RSRC', 'MACRSRC', 'BARKS', ...Object.keys(FORK_VIEWS)]);
function setPropFilter(v) {
  window.PROP_FILTER = v;
  if (window.CUR_SUBN === 'ITEMS') renderItemSheet();
  else if (window.CUR_SUBN === 'RSRC') renderRsrcSheet();
  else if (window.CUR_SUBN === 'MACRSRC') renderMacRsrcSheet();
  else if (window.CUR_SUBN === 'PROPS') renderPropTypeSheet();
  else applyGalleryArrangement();
}
// Category changed: the old query would silently hide the new gallery.
function clearPropFilter() {
  window.PROP_FILTER = '';
  const el = document.getElementById('propFilter');
  if (el) el.value = '';
}

function renderPropTypeSheet() {
  stopSpriteAnimations();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  const tiles = getPropTileList();
  const living = livingPropTypes();
  const q = (window.PROP_FILTER || '').trim().toLowerCase();

  const entries = [];
  for (let pt = 1; pt < tiles.length && pt < 1024; pt++) {
    const base = tiles[pt];
    if (!base) continue;
    const name = propDisplayName(pt);
    const info = spriteFrameInfo(0, pt);
    if (!info.count) continue;
    const own = terrainNameFor(base);
    if (q && !(name || '').toLowerCase().includes(q) && !(own || '').toLowerCase().includes(q) &&
        !('0x' + pt.toString(16)).includes(q)) continue;
    entries.push({ pt, base, name, info, alive: living.has(pt) });
  }
  // Creatures and people first, then everything else; alphabetical inside each
  // so a named thing is findable, with the unnamed tail last.
  entries.sort((a, b) => (b.alive - a.alive) ||
    ((a.name ? 0 : 1) - (b.name ? 0 : 1)) ||
    (a.name || '').localeCompare(b.name || '') || a.pt - b.pt);

  let heading = null;
  for (const e of entries) {
    const want = e.alive ? 'Creatures & people' : 'Objects & scenery';
    if (want !== heading) {
      heading = want;
      const h = document.createElement('div');
      h.className = 'propHead';
      h.textContent = heading;
      grid.appendChild(h);
    }
    const cell = document.createElement('div');
    cell.className = 'cell propCell';
    const wrap = document.createElement('div');
    wrap.className = 'cellimgwrap';
    // A multi-square prop's span bits live on its ANCHOR tile -- the last
    // square, not the first -- so drawing frame 0 shows one quarter of a tree.
    // Pick the first frame that actually carries span bits, and fall back to
    // frame 0 for everything single-square.
    const attrs = getTileAttributes(ARCHIVE);
    const own = framesSharingName(e.base, e.info.present);
    let rep = own[0] || 0;
    for (const f of own) {
      if ((attrs[e.base + f] || 0) & 0xC0) { rep = f; break; }
    }
    const spr = drawPropSprite(e.base + rep, 34);
    if (spr) wrap.appendChild(spr.canvas);
    cell.appendChild(wrap);
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    // The archive's own name for the base tile, where it has one, in
    // preference to the wiki's prop-type list.
    const own0 = terrainNameFor(e.base);
    lbl.innerHTML = propNameHTML(e.pt, e.base);
    if (!own0) lbl.classList.add('nolabel');
    cell.appendChild(lbl);
    const sub = document.createElement('div');
    sub.className = 'resid';
    const bits = ['0x' + e.pt.toString(16).toUpperCase()];
    bits.push(e.info.count + (e.info.count === 1 ? ' frame' : ' frames'));
    if (spr && spr.multi) bits.push(spr.cols + '\u00d7' + spr.rows);
    sub.textContent = bits.join(' \u00b7 ');
    cell.appendChild(sub);
    cell.onclick = () => showPropTypeDetail(e.pt);
    grid.appendChild(cell);
  }
  out.textContent = entries.length + ' prop types with artwork' +
    (q ? ' matching \u201c' + q + '\u201d' : '') + '.';
}

function showPropTypeDetail(pt) {
  stopSpriteAnimations();
  markDetailView('prop', pt);
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = 'block';
  grid.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'secondary';
  back.textContent = 'All creatures & props';
  back.onclick = renderPropTypeSheet;
  grid.appendChild(back);

  const base = getPropTileList()[pt] || 0;
  const info = spriteFrameInfo(0, pt);
  const panel = document.createElement('div');
  panel.style.cssText = 'width:100%;max-width:560px;margin:12px auto;text-align:left';
  const head = document.createElement('div');
  const sheetResid = 0x8E00 + (base >> 4);
  const scriptResid = 0x1000 + pt;
  head.innerHTML = '<div style="font-size:1.1875rem;color:var(--gold)">' +
    propNameHTML(pt, base) +
    ' <span style="font-size:0.75rem;color:#b5b2a8">proptype 0x' + pt.toString(16).toUpperCase() + '</span></div>' +
    '<div style="font-size:0.8125rem;color:#fff;margin:4px 0 10px">Sheet ' + residLink(sheetResid) +
      ', base tile 0x' + base.toString(16).toUpperCase() +
      (info.rows > 1 ? ' \u00b7 ' + info.rows + ' facings' : '') +
      ' \u00b7 ' + (refExists(scriptResid)
        ? 'script ' + residLink(scriptResid)
        : 'script would be resource 0x' + scriptResid.toString(16).toUpperCase() + ' (not present)') +
      '</div>';
  panel.appendChild(head);
  {
    const wins = containerWindowsFor(pt);
    if (wins.length) {
      const strip = document.createElement('div');
      strip.innerHTML = partsStrip('Opens as', wins.map(w => partChip('Window', w)));
      panel.appendChild(strip);
    }
  }

  // Frames, in the runs 0xF004 cuts them into. Prop type 0x141's sheet block
  // runs to the end of its 16-tile sheet, so it takes in a board, four staves
  // and four paintings after the four crystal balls -- and the gallery used to
  // print all thirteen as one undifferentiated strip of "crystal ball".
  const ownName = terrainNameFor(base);
  for (const run of frameRuns(base, info.present)) {
    const own = run.name && run.name === ownName;
    // Only this prop's own frames. The neighbouring runs on the same sheet
    // used to be listed too ("boards -- a neighbour on this sheet, not this
    // prop"), which told a reader about the sheet, not the prop; the sheet
    // itself is one click away for anyone who wants its neighbourhood.
    if (!own) continue;
    const runHead = document.createElement('div');
    runHead.style.cssText = 'font-size:0.6875rem;letter-spacing:0;margin:8px 0 3px;' +
      'color:' + (own ? '#cfc4a0' : '#8a8064');
    runHead.textContent = (run.name || 'unnamed in 0xF004') + ' \u00b7 frame' +
      (run.frames.length === 1 ? ' ' + run.frames[0] : 's ' + run.frames[0] + ' to ' + run.frames[run.frames.length-1]) +
      (own ? '' : ', a neighbour on this sheet, not this prop');
    panel.appendChild(runHead);
    // A frame saves as a GIF from its own view, beside the PNG; the button
    // that saved a run as an animated GIF went on 16 September 2026 (the
    // maintainer).
    const colours = null;   // the colour words ("cobalt", "pale") were removed by request
    const sheet = document.createElement('div');
    sheet.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:4px';
    // A 2x2 beast -- the titan -- is four tiles a facing, and the tile
    // attributes (0xC0 on the bottom-right corner) say which three others
    // belong to it. drawPropSprite assembles the corner; the three pieces
    // are not shown again on their own.
    const pieceOf = new Set();
    for (const f of run.frames) {
      const pcs = multiTilePieces(base + f, false);
      if (pcs) for (const pc of pcs) pieceOf.add(pc.tile - base);
    }
    for (const f of run.frames) {
      if (pieceOf.has(f)) continue;
      const cellw = document.createElement('div');
      cellw.style.cssText = 'width:52px;text-align:center';
      const holder = document.createElement('div');
      holder.style.cssText = 'width:52px;height:52px;display:flex;align-items:center;justify-content:center;background:#1c1913;border:1px solid #33302a;overflow:hidden';
      const spr = drawPropSprite(base + f, 24);
      if (spr) holder.appendChild(spr.canvas);
      const col = colours && colours.get(f);
      holder.title = 'frame ' + f + ' \u00b7 tile 0x' + (base + f).toString(16).toUpperCase() +
                     (run.name ? ' \u00b7 ' + run.name : '') + (col ? ' \u00b7 ' + col : '') +
                     ', click to enlarge';
      holder.style.cursor = 'zoom-in';
      holder.onclick = () => showSpriteZoom(base + f, run.name || '');
      if (!own) holder.style.opacity = '.5';
      cellw.appendChild(holder);
      const cap = document.createElement('div');
      cap.style.cssText = 'font-size:0.625rem;color:#b5b2a8;line-height:1.3;margin-top:2px';
      cap.textContent = col ? (f + ' \u00b7 ' + col) : String(f);
      cellw.appendChild(cap);
      sheet.appendChild(cellw);
    }
    panel.appendChild(sheet);
  }

  // Who wears this sprite.
  const users = [];
  try {
    const chars = loadCharacterTable();
    for (let i = 1; i < chars.length; i++) if (chars[i].proptype === pt) users.push(i);
  } catch (e) {}
  if (users.length) {
    const u = document.createElement('div');
    u.style.cssText = 'font-size:0.8125rem;line-height:1.8';
    u.innerHTML = '<b style="color:#b5b2a8">Characters using this sprite</b><br>' +
      users.slice(0, 40).map(i =>
        '<button class="sv-chip" onclick="showCharacterDetail(' + i + ')">' +
        svEsc(characterName(i)) + '</button>').join(' ') +
      (users.length > 40 ? ' <span style="color:#8c8980">+' + (users.length - 40) + ' more</span>' : '');
    panel.appendChild(u);
  }
  {
    const each = itemEachOneHTML(pt);
    if (each) { const d = document.createElement('div'); d.innerHTML = each; panel.appendChild(d); }
  }
  grid.appendChild(panel);
  out.textContent = (propDisplayName(pt, base) || 'prop type 0x' + pt.toString(16).toUpperCase()) +
    (info.rows > 1 ? ', ' + info.rows + ' facings' : '');
}

/* --- Inventory items -------------------------------------------------------
   An item is a prop type that also has a class script, and the wiki's
   prop-type list gives the rule for finding it: "Scripts for an object are
   located in 0x1000 + proptype". The Object page calls that class Item and
   assigns it resources 0x10xx-0x13xx.

   Every such resource ends in a dispatch `table`: per the wiki's Table page
   that is A0 <count> followed by 6-byte entries of {4-byte value, 2-byte key},
   where a value must be a dref (0x8000_0000 | resid<<16 | offset) or the atom
   None (0x5000FFFF), which is indistinguishable from having no entry at all.
   The same page explains why an item's weight is an array holding one integer:
   table values cannot be bare scalars, so scalars are wrapped.

   That gives the split this inspector is built on. An entry whose dref lands
   on an array (0x9n) is static data -- weight, armour value, equipment slot;
   one that lands on a function (0x81) is behaviour. The keys are the same
   numbering as DVM_SYM.method, which is what makes reading them safe rather
   than speculative: the wiki independently documents key 0x0024 as Weight and
   method 36 is Weight, and the values agree with the game (a sword weighs 34
   grains, a cuirass 24 and gives 3 points of armour).

   Of the 268 item classes in the shipped archive, 123 carry a weight. Where a
   key has no published meaning the panel says so instead of guessing.
--------------------------------------------------------------------------- */

// Labels come from DVM_SYM.method so the two can never drift apart; only the
// units and the notes are stated here, and only where the wiki or the archive
// actually establishes them.
const ITEM_FIELD_INFO = {
  0x24: { scalar:true, unit:'grains', gloss:'Carry weight. System.WeightCapacity measures a container against the sum of these.' },
  0x26: { scalar:true, gloss:'Equipment slot this occupies when worn or wielded.' },
  0x27: { scalar:true, hex:true, gloss:'Bit flags. The individual bits are not documented.' },
  0x28: { scalar:true, gloss:'How many fit in one inventory slot.' },
  // The combat fields were decoded on 5 September 2026 by following the
  // routines that read them: the attack resolver 0xE87 (type, skill, the
  // two sounds, the hit effect), the AI's weapon choice 0x3042 (reach,
  // squared against the distance), the bow scripts 0x903-0x988
  // (ammunition class and range) and the weapon describer 0xEB2 (damage).
  0x2A: { gloss:'Melee: damage, reach in squares, damage type, the skill it is swung with, the miss sound, the hit sound, and the hit effect (a reference into this resource).' },
  0x2B: { gloss:'Thrown: damage, range, the effect, the sound.' },
  0x2C: { scalar:true, gloss:'Points of protection this armour contributes.' },
  0x2D: { gloss:'Ammunition: the class a launcher must match, damage, damage type.' },
  0x2E: { gloss:'Ranged: the ammunition class it fires, range in squares, then sounds.' },
  0x2F: { gloss:'Shield: how much it blocks, and the skill (Shield) added to the block.' },
  0x30: { scalar:true, gloss:'Reagent number, used by alchemy.' },
  0x32: { gloss:'Light this item casts.' },
  0x34: { gloss:'Lock parameters -- what a key or a lockpick is tested against.' },
  0x3B: { gloss:'Sounds. A prop plays the first where it stands; a creature’s are the ones its fights play.' },
  0x3C: { scalar:true, unit:'obols', gloss:'Money value. Only the coin itself carries one; shop prices are computed in script.' }
};
// Keys that mark an item as gear rather than goods, used only for grouping.
const ITEM_COMBAT_KEYS = [0x2A, 0x2B, 0x2C, 0x2D, 0x2E, 0x2F];

function itemFieldLabel(key) {
  const m = DVM_SYM.method[String(key)];
  return m ? prettyLabel(m) : ('Key 0x' + key.toString(16).toUpperCase().padStart(4, '0'));
}

/* Any class's table, not only an item's: a monster class at 0x19xx is laid
   out the same way, and the sound reader wants both. `bytes` is kept so a
   word that points at another array in the same class can be followed. */
window.ITEM_CLASSES = null;
function parseItemClass(pt) { return parseClassTable(0x1000 + pt); }
function parseClassTable(resid) {
  const cache = window.ITEM_CLASSES || (window.ITEM_CLASSES = {});
  if (resid in cache) return cache[resid];
  let b = null;
  try { const raw = getResourceBytes(ARCHIVE, resid); if (raw) b = smartDecrypt(raw, resid).data; } catch (e) {}
  if (!b || b.length < 8) return (cache[resid] = null);
  let disc = null;
  try { disc = dvmDiscover(b, resid); } catch (e) {}
  const toff = disc ? disc.tableOffset : null;
  if (toff === null || toff + 2 > b.length || (b[toff] & 0xF0) !== 0xA0) return (cache[resid] = null);
  const count = u16be(b, toff) & 0x0FFF;
  const cls = { resid, size: b.length, bytes: b, data: [], code: [], text: [], empty: 0, unknown: 0 };
  for (let i = 0, p = toff + 2; i < count && p + 6 <= b.length; i++, p += 6) {
    const val = u32be(b, p);
    const key = u16be(b, p+4);
    // The Table page: a None entry is the same as no entry, and dead keys
    // propagated by copy-and-paste are common. Neither is worth showing.
    if (val === 0x5000FFFF) { cls.empty++; continue; }
    if (!(val & 0x80000000) || ((val & 0x7FFF0000) >>> 16) !== resid) { cls.unknown++; continue; }
    const off = val & 0xFFFF;
    if (off >= b.length) { cls.unknown++; continue; }
    const kind = (disc.kinds && disc.kinds[off]) || 'data';
    if (kind === 'array') {
      const words = dvmArrayWords(b, off);
      if (words) cls.data.push({ key, off, words });
    } else if (kind === 'function') {
      cls.code.push({ key, off });
    } else {
      const s = itemStringAt(b, off);
      if (s) cls.text.push({ key, off, text: s });
    }
  }
  cls.data.sort((a, b2) => a.key - b2.key);
  cls.code.sort((a, b2) => a.key - b2.key);
  return (cache[resid] = cls);
}
// Word `word` of a class's field `key`, as a number; with `slot`, that word
// is a pointer to an array in the same class and the slot-th entry is read.
function classFieldNumber(cls, key, word, slot) {
  const f = cls && cls.data.find(x => x.key === key);
  let w = f ? f.words[word] : undefined;
  if (w === undefined) return null;
  if (slot !== undefined) {
    if (!(w & 0x80000000) || ((w >>> 16) & 0x7FFF) !== cls.resid) return null;
    const arr = dvmArrayWords(cls.bytes, w & 0xFFFF);
    w = arr ? arr[slot] : undefined;
    if (w === undefined) return null;
  }
  return (w & 0xF0000000) === 0 ? w : null;
}

function itemFieldValue(f) {
  const info = ITEM_FIELD_INFO[f.key] || {};
  if (info.scalar && f.words.length === 1 && (f.words[0] & 0xF0000000) === 0) {
    const n = f.words[0] & 0x0FFFFFFF;
    if (info.hex) return '0x' + n.toString(16).toUpperCase() + ' (' + n + ')';
    return n + (info.unit ? ' ' + info.unit : '');
  }
  return f.words.map(dvmWord).join(', ');
}

function itemWeight(pt) {
  const cls = parseItemClass(pt);
  if (!cls) return null;
  for (const f of cls.data) {
    if (f.key === 0x24 && f.words.length === 1 && (f.words[0] & 0xF0000000) === 0)
      return f.words[0] & 0x0FFFFFFF;
  }
  return null;
}

/* Where the items actually are. The prop lists are the shipped scenario's
   inventories: 990 of the 14,485 prop records in this archive are not on the
   floor but inside something, and reading their location word as containment
   (see parseDelverPropList) turns them into "Larisa's dresser holds four keys"
   and "Deiphobus carries a mace, a cuirass and a round shield". */
window.ITEM_INDEX = null;
function buildItemIndex() {
  if (window.ITEM_INDEX) return window.ITEM_INDEX;
  const byType = {};
  const get = pt => byType[pt] || (byType[pt] = {
    total: 0, loose: 0, contained: 0, carried: 0, equipped: 0, takeable: 0,
    zones: {}, inside: [], held: []
  });
  const count = subindexCount(ARCHIVE, 128);
  const chars = characterProptypes();
  // Which (class, aspect) pairs the file actually places, for the aspect
  // rule on the Items sheet: an egg (flags 0x42, 0x44) is a scripted
  // trigger whose class and aspect bytes are not an appearance, so it is
  // not counted as wearing anything.
  const worn = new Map();
  for (let n = 0; n < count; n++) {
    const resid = 0x8100 + n;
    let recs = null;
    try {
      const raw = getResourceBytes(ARCHIVE, resid);
      if (raw) recs = parseDelverPropList(smartDecrypt(raw, resid).data);
    } catch (e) {}
    if (!recs) continue;
    for (const r of recs) {
      if (r.flags === 0xFF || !r.proptype) continue;
      if (r.flags !== 0x42 && r.flags !== 0x44) { const k = (r.proptype << 5) | r.aspect; worn.set(k, (worn.get(k) || 0) + 1); }
      // flags 0x09 is ambiguous -- it is both "in a container, takeable" and
      // the flags nine of Land King Hall's guards stand around with. A prop
      // whose type is somebody is never inventory, same test the map renderer
      // uses.
      const isPerson = chars.has(r.proptype);
      const e = get(r.proptype);
      e.total++;
      if (r.takeable) e.takeable++;
      e.zones[resid] = (e.zones[resid] || 0) + 1;
      if (r.carriedBy !== null && !isPerson) {
        if (r.equipped) e.equipped++; else e.carried++;
        if (e.held.length < 80) e.held.push({ resid, character: r.carriedBy, equipped: r.equipped });
      } else if (r.container !== null && !isPerson &&
                 r.container >= 0 && r.container < recs.length) {
        e.contained++;
        if (e.inside.length < 80)
          e.inside.push({ resid, index: r.container, hostType: recs[r.container].proptype });
      } else e.loose++;
    }
  }
  window.ITEM_WORN = worn;
  return (window.ITEM_INDEX = byType);
}

/* THE ASPECT RULE, and the art no class owns.

   A prop record's identity word is (aspect << 10) | class -- ten bits of
   class, five of aspect (parseDelverPropList) -- and the same word is what
   the create-a-prop cheat asks for. The aspect adds onto the class's base
   tile in 0xF000, and the prop is then named by that tile's name in 0xF004
   (delvmod prop.py: get_tile(aspect), then the tile's name). What else an
   aspect changes is the class script's affair: the general foodstuff class
   reads a nutrition per variant, the weapon classes read nothing per aspect
   at all, so a mace at aspect 8 is a mace's damage, reach, type and skill
   wearing whatever picture sits eight tiles along.

   Which is how two orphan pictures were found (the maintainer, 8 September
   2026, from another session): tiles named in 0xF004, drawn on the weapon
   sheet, the base tile of no class and shared by name with no class's
   frames, placed nowhere in any of the 40 prop lists, built by no script.
   "hatchet" and "flail". The list is computed rather than typed so a
   modded archive gets its own, and it is stated where it is read: a tile
   is an orphan when it has a name, that name is not the name of any
   class's base tile (framesSharingName's own test for "this class's
   frame"), it is not itself a base, it has pixels, and nothing in any prop
   list wears it -- a picture the file places at some class's aspect is a
   variant that class uses (bread and cheese under the foodstuff class, a
   kilt under tunic), not an orphan. An item reaches one when it lies above
   the item's base on the item's own 16-tile sheet: the aspect field can
   count past the sheet's edge, but what it lands on there is another
   sheet's art, reached by arithmetic and not by design. And a class whose
   own script writes its aspect (`set_field aspect`: the torch when lit,
   the bomb, the shutters, the brazier, 36 classes) owns the pictures above
   it on its sheet as states, so those are not orphans either. What is
   left in the shipped file is hatchet and flail on the weapon sheet, two
   dried foods, a plow, a broken axe, a broken bow, and four petroglyph
   tiles the two traps reach. "Placed" means by a prop record; whether a
   map's own tile layer draws any of them is not asked here. */
window.ORPHAN_ART = null;
function orphanItemArt() {
  if (window.ORPHAN_ART) return window.ORPHAN_ART;
  const tiles = getPropTileList();
  const bases = propBaseTileSet();
  const baseNames = new Set();
  for (let pt = 0; pt < tiles.length; pt++) { const nm = tiles[pt] ? terrainNameFor(tiles[pt]) : ''; if (nm) baseNames.add(nm); }
  const out = new Map();
  const worn = (buildItemIndex(), window.ITEM_WORN || new Map());
  // Every (class, aspect) the file places, by the tile it lands on, over
  // all classes and not only the items; and the tiles a class owns as its
  // states because its script writes its aspect.
  const placedAt = new Map(), states = new Set();
  const scripts = buildScriptTextIndex();
  for (let pt = 1; pt < tiles.length; pt++) {
    const base = tiles[pt];
    if (!base) continue;
    const sc = scripts.find(x => x.resid === 0x1000 + pt);
    const sets = !!(sc && /set_field aspect\b/.test(sc.text));
    for (let n = 1; n < 32 && ((base + n) >> 4) === (base >> 4); n++) {
      const t = base + n;
      placedAt.set(t, (placedAt.get(t) || 0) + (worn.get((pt << 5) | n) || 0));
      if (sets) states.add(t);
    }
  }
  for (const e of inventoryItemList()) {
    const base = tiles[e.pt];
    if (!base) continue;
    for (let n = 1; n < 32 && ((base + n) >> 4) === (base >> 4); n++) {
      const t = base + n;
      if (bases.has(t) || states.has(t) || placedAt.get(t)) continue;
      const nm = terrainNameFor(t);
      if (!nm || baseNames.has(nm)) continue;
      let drawn = false;
      try { const img = resolveTileImage(t); drawn = !!(img && img.some(v => v)); } catch (err) { drawn = false; }
      if (!drawn) continue;
      const o = out.get(t) || out.set(t, { tile: t, name: nm, reach: [] }).get(t);
      o.reach.push({ pt: e.pt, aspect: n, word: (n << 10) | e.pt });
    }
  }
  return (window.ORPHAN_ART = [...out.values()].sort((a, b) => a.tile - b.tile));
}
// The orphans one item can wear, by aspect.
function orphanArtReachable(pt) {
  return orphanItemArt().map(o => { const r = o.reach.find(x => x.pt === pt); return r ? Object.assign({}, o, { aspect: r.aspect, word: r.word }) : null; }).filter(Boolean);
}

/* WHICH CLASSES READ THEIR ASPECT. The aspect changes the picture and the
   name for every class; whether it changes anything else is decided by
   whether the class's own script ever reads the field. A weapon's numbers
   are constants in its class script, so a spear at aspect 1 is named
   hatchet and is a spear in every number; the general foodstuff class
   indexes a nutrition table and a table of lines by the aspect, so a
   mushroom steak at aspect 1 is a dried jellyfish that feeds less and says
   something else when eaten. Read off the listings: `get_field aspect` is
   a read, `set_field aspect` a write (a state the class puts itself in,
   the torch lit, the door open). The prop record block on an item's page
   and the Mechanics section say which case a class is in. */
window.ASPECT_READERS = null;
function aspectReaders() {
  if (window.ASPECT_READERS) return window.ASPECT_READERS;
  const out = new Map();
  for (const e of buildScriptTextIndex()) {
    if (e.subn !== 15) continue;
    const reads = (e.text.match(/get_field aspect\b/g) || []).length, writes = (e.text.match(/set_field aspect\b/g) || []).length;
    out.set(e.resid - 0x1000, { reads, writes });
  }
  return (window.ASPECT_READERS = out);
}
// What using this item at this aspect does, where the class reads the
// aspect for it: a food's nutrition and line, a potion's effect.
function aspectUseAt(pt, a) {
  let fd = null;
  try { fd = foodRules(); } catch (e) { return null; }
  const food = fd.foods.find(f => f.pt === pt && f.variants);
  if (food) { const v = food.variants[a]; return v ? { kind: 'food', plus: v.plus, says: v.says !== undefined ? v.says : food.says } : { kind: 'food', beyond: true, count: food.variants.length }; }
  if (pt === 0x1F && fd.potions.length) { const p = fd.potions[a]; return p ? { kind: 'potion', name: p.name, does: p.does, says: p.says, resid: p.resid } : { kind: 'potion', beyond: true, count: fd.potions.length }; }
  return null;
}

/* THE TWO DATA BYTES, and the enchantment (v1.33.0).

   Beside its word a prop record carries two bytes the scripts' field table
   calls data1 and data2 (fields 6 and 7; field 8, data3, is both read as
   one 16-bit value). They have no fixed meaning: each class script reads
   them for its own purpose -- a door its lock, a passage its destination,
   a candle its countdown -- and the weapons' purpose is not in the weapon
   classes at all but in the attack resolver 0xE87, which reads Data1 off a
   weapon that is both a MeleeWeapon (0x2A) and Equipment (0x26), adds it to
   the blow after the damage roll (Random(0, damage) + 1 + Data1) and sets
   0x80, a magic bit, on the damage type when it is not zero. An arrow's
   Data1 is not read there: the guard is on MeleeWeapon, and the missile
   routine 0xE89 reads no data field, so the arrows placed with a Data1 of
   20 and 30 hit for what their class says. Three classes -- the dagger and
   the two swords -- say so in Examine, testing Data1 above 2 and above 0
   for two lines of the game's own text; they are found by that test rather
   than named. The Mechanics sheet's combat section had said "plus the
   enchantment" since v1.7.0 without ever saying the enchantment was this
   byte. Each pattern below is a shape in the listing, so an archive whose
   resolver has been edited shows what it has. Read by the item page's word
   block and the Mechanics section of the same name. */
window.PROP_WORD_RULES = null;
function propWordRules() {
  if (window.PROP_WORD_RULES) return window.PROP_WORD_RULES;
  const idx = buildScriptTextIndex();
  const strip = t => t.replace(/^\s*[0-9A-F]{4}\s+/gm, '');
  const resolve = idx.find(e => e.resid === 0xE87);
  let ench = null;
  if (resolve) {
    const t = strip(resolve.text);
    ench = {
      guarded: /has_member MeleeWeapon \(0x2A\)[\s\S]{0,40}has_member Equipment \(0x26\)[\s\S]{0,10}and[\s\S]{0,60}get_field data1 \(0x6\)/.test(t),
      added: /sys Random[\s\S]{0,60}byte 0x01[\s\S]{0,10}add[\s\S]{0,10}local Var05[\s\S]{0,10}add/.test(t),
      magic: /if_not[\s\S]{0,10}local Var05[\s\S]{0,60}word 128[\s\S]{0,10}bitwise_or/.test(t)
    };
  }
  // Which class scripts read or write the bytes; which hand Data3 to
  // ChangeZone; and which report Data1 in Examine, with the two lines.
  const readers = [], examines = [], zoneReaders = [];
  let scripts = 0;
  for (const e of idx) {
    if (/(get|set)_field data[123] /.test(e.text)) scripts++;
    if (e.resid < 0x1000 || e.resid >= 0x1400) continue;
    const ops = new Set();
    for (const m of e.text.matchAll(/(get|set)_field (data[123]) /g)) ops.add(m[1] + ' ' + m[2]);
    if (!ops.size) continue;
    readers.push({ pt: e.resid - 0x1000, resid: e.resid, ops: [...ops].sort() });
    const t = strip(e.text);
    if (/sys ChangeZone[\s\S]{0,80}get_field data3 \(0x8\)/.test(t)) zoneReaders.push(e.resid - 0x1000);
    const m = /get_field data1 \(0x6\)\s+byte (0x[0-9A-F]+)\s+gt[\s\S]{0,40}string\(implicit\) "([^"]+)"[\s\S]{0,80}string\(implicit\) "([^"]+)"/.exec(t);
    if (m) {
      // The two tests the lines hang on, `data1 > n` nearest before the
      // first line and the one before that, with their lines.
      const eo = dvmOpsOf(e), hiText = m[2].replace(/\\n$/, '');
      const si = eo.findIndex(o => dvmOpString(o) === hiText);
      const ts = [];
      for (let j = si - 1; si > 0 && j >= 0 && ts.length < 2; j--) { const g = dvmSeq(eo, j, [/^get_field data1/, DVM_NUM, /^gt$/]); if (g) ts.push(g); }
      examines.push({ pt: e.resid - 0x1000, above2: hiText, above0: m[3].replace(/\\n$/, ''),
                      hiVal: ts[0] ? dvmVal(e.resid, ts[0][1]) : null, loVal: ts[1] ? dvmVal(e.resid, ts[1][1]) : null });
    }
  }
  // Every placed record whose Data1 the resolver would add -- a class with
  // both members, not an egg, not deleted -- and the ammunition carrying a
  // Data1 the resolver does not read.
  const melee = new Set(), ammoCls = new Set();
  for (let pt = 1; pt < 512; pt++) {
    const cls = parseItemClass(pt); if (!cls) continue;
    const has = k => cls.data.some(f => f.key === k);
    if (has(0x2A) && has(0x26)) melee.add(pt);
    if (has(0x2D)) ammoCls.add(pt);
  }
  const placed = [], ammo = [];
  const count = subindexCount(ARCHIVE, 128);
  for (let n = 0; n < count; n++) {
    const resid = 0x8100 + n; let recs = null;
    try { const raw = getResourceBytes(ARCHIVE, resid); if (raw) recs = parseDelverPropList(smartDecrypt(raw, resid).data); } catch (e) {}
    if (!recs) continue;
    for (const r of recs) {
      if (r.flags === 0xFF || r.flags === 0x42 || r.flags === 0x44 || !r.d1) continue;
      if (melee.has(r.proptype)) placed.push({ resid, index: r.index, pt: r.proptype, aspect: r.aspect, d1: r.d1, carriedBy: r.carriedBy });
      else if (ammoCls.has(r.proptype)) ammo.push({ resid, index: r.index, pt: r.proptype, d1: r.d1 });
    }
  }
  // The Examine that reports Data1 is the weapons': the shape (two nested
  // tests of Data1, a line each) also turns up on classes whose Data1 is
  // something else, the amulet's charge and the unguent's fill, and the
  // sentence it feeds is about the enchantment. It was told apart by the
  // number in the inner test, `byte 0x02`, until 11 September 2026.
  const weaponExamines = examines.filter(x => melee.has(x.pt) && x.hiVal && x.loVal);
  return (window.PROP_WORD_RULES = { ench, readers, examines: weaponExamines, zoneReaders, scripts, placed, ammo, melee });
}
// The ops of one reader in words: "reads Data1, Data3, writes Data1".
function propWordOps(ops) {
  const nm = o => o.slice(4).replace('data', 'Data');
  const r = ops.filter(o => /^get/.test(o)).map(nm), w = ops.filter(o => /^set/.test(o)).map(nm);
  return [r.length ? 'reads ' + r.join(', ') : '', w.length ? 'writes ' + w.join(', ') : ''].filter(Boolean).join(', ');
}

/* THE WORD BLOCK ON AN ITEM'S PAGE (v1.33.0). One state, window.PROP_WORD:
   the item, an aspect, Data1 and Data2. The rail of 32 slots is built once
   with the tile each aspect lands on drawn in it; the bits, the readout and
   the meaning line re-render when the aspect or a byte changes. The two
   inputs are built once too and are never re-rendered, so typing into one
   does not lose the caret. Brought in from a standalone page the maintainer
   made on 9 September 2026, which had the weapon list typed in; here
   everything comes off the open file. */
window.PROP_WORD = null;
function propWordHex(n, w) { return '0x' + n.toString(16).toUpperCase().padStart(w || 4, '0'); }
function propWordMount(pt, host) {
  const st = window.PROP_WORD = { pt, aspect: 0, d1: 0, d2: 0, host, slots: [] };
  const base = getPropTileList()[pt] || 0;
  host.className = 'sv-block';
  host.innerHTML = '';
  const h4 = document.createElement('h4'); h4.textContent = 'Prop record'; host.appendChild(h4);
  const read = document.createElement('div'); read.className = 'pwReadout'; host.appendChild(read); st.read = read;
  const sub = document.createElement('div'); sub.className = 'mechSub'; sub.textContent = 'Aspect: the tile each lands on, counted forward from the class’s own'; host.appendChild(sub);
  const rail = document.createElement('div'); rail.className = 'pwRail';
  for (let n = 0; n < 32; n++) {
    const b = document.createElement('button'); b.type = 'button';
    // A slot on a new 16-tile sheet is set off a little: from there the
    // aspect lands on another sheet's art.
    b.className = 'pwSlot' + (n === 0 ? ' pwHome pwOn' : '') + (n && ((base + n) >> 4) !== ((base + n - 1) >> 4) ? ' pwEdge' : '');
    b.onclick = () => propWordSet(n);
    const nm = terrainNameFor(base + n) || '';
    b.title = 'aspect ' + n + ' · tile ' + propWordHex(base + n) + (nm ? ' · ' + nm : '');
    const num = document.createElement('span'); num.className = 'pwN'; num.textContent = String(n); b.appendChild(num);
    const art = document.createElement('div'); art.className = 'pwArt';
    try { const spr = drawPropSprite(base + n, 20); if (spr) art.appendChild(spr.canvas); } catch (e) {}
    b.appendChild(art);
    const t = document.createElement('span'); t.className = 'pwT'; t.textContent = nm || 'unnamed'; b.appendChild(t);
    rail.appendChild(b); st.slots.push(b);
  }
  host.appendChild(rail);
  const sub2 = document.createElement('div'); sub2.className = 'mechSub'; sub2.textContent = 'Data1 and Data2'; host.appendChild(sub2);
  const data = document.createElement('div'); data.className = 'pwData';
  for (const k of [1, 2]) {
    const lab = document.createElement('label'); lab.textContent = 'Data' + k + ' ';
    const inp = document.createElement('input'); inp.type = 'number'; inp.min = '0'; inp.max = '255'; inp.value = '0';
    inp.oninput = () => propWordData(k, inp.value);
    lab.appendChild(inp); data.appendChild(lab);
  }
  host.appendChild(data);
  const meaning = document.createElement('div'); meaning.className = 'sv-note'; meaning.style.marginTop = '0'; host.appendChild(meaning); st.meaning = meaning;
  propWordRender();
}
function propWordSet(n) {
  const st = window.PROP_WORD; if (!st) return;
  st.aspect = Math.max(0, Math.min(31, n | 0));
  st.slots.forEach((b, i) => { b.className = b.className.replace(/ pwOn/g, '') + (i === st.aspect ? ' pwOn' : ''); });
  propWordRender();
}
function propWordData(k, v) {
  const st = window.PROP_WORD; if (!st) return;
  st['d' + k] = Math.max(0, Math.min(255, parseInt(v, 10) || 0));
  propWordRender();
}
/* THE SWING. What a weapon draws when it strikes is not its own tile at all:
   the outcome routine 0xE87 hands the HitWithTile syscall (cbAttackFX, which
   calls TGameViewer::ShowAttack) a list of tiles to play between the two
   squares, and the list is field 6 of the class's melee entry (key 0x2A),
   a dref into the class's own script where a five-word array sits: 0, three
   tiles, 0. A class whose field is None (rolling pin, cleaver, pick,
   gauntlets, staff in the shipped file) gets the routine's own inline
   default, two tiles, found here by its shape (the 0x45 data opcode, 22
   bytes, a 0x90 array of five) rather than by offset. Read on 9 September
   2026; the mace's list is 0x8A3-0x8A5 and the spear's is its own tile
   three times, which is why a mace at aspect 8 wears the flail in the pack
   and still swings as a mace. */
function dvmWordArrayAt(d, off) {
  if (!d || off < 0 || off + 2 > d.length || d[off] !== 0x90) return null;
  const n = d[off + 1], words = [];
  for (let k = 0; k < n; k++) { const q = off + 2 + 4 * k; if (q + 4 > d.length) return null; words.push(u32be(d, q)); }
  return words;
}
function weaponSwingFrames(pt) {
  let cls = null;
  try { cls = parseItemClass(pt); } catch (e) { cls = null; }
  const e = cls && cls.data.find(x => x.key === 0x2A);
  if (!e) return null;
  const w = (e.words[6] || 0) >>> 0;
  const read = resid => { try { const raw = getResourceBytes(ARCHIVE, resid); return raw ? smartDecrypt(raw, resid).data : null; } catch (err) { return null; } };
  if (w >= 0x80000000) {
    const resid = (w & 0x7FFF0000) >>> 16, off = w & 0xFFFF;
    const words = dvmWordArrayAt(read(resid), off);
    if (!words) return null;
    return { own: true, resid, off, tiles: words.filter(t => t > 0 && t <= 0xFFFF) };
  }
  // No list of its own: the outcome routine's default.
  const d = read(0xE87);
  if (!d) return null;
  for (let i = 0; i + 5 <= d.length; i++) {
    if (d[i] === 0x45 && d[i + 1] === 0x00 && d[i + 2] === 0x16 && d[i + 3] === 0x90 && d[i + 4] === 0x05) {
      const words = dvmWordArrayAt(d, i + 3);
      if (words) return { own: false, resid: 0xE87, off: i + 3, tiles: words.filter(t => t > 0 && t <= 0xFFFF) };
    }
  }
  return null;
}
function swingFramesHTML(pt) {
  let sw = null;
  try { sw = weaponSwingFrames(pt); } catch (e) { sw = null; }
  if (!sw || !sw.tiles.length) return '';
  const tiles = sw.tiles.map(t => { let u = ''; try { u = relIconURL({ tile: t }); } catch (e) { u = ''; }
    return (u ? '<img class="brandTile" src="' + u + '" alt="" width="20" height="20"> ' : '') + propWordHex(t); }).join(', ');
  const where = svLink(sw.own ? 'its class script' : 'the outcome routine’s default', 'jumpToResource(' + sw.resid + ')', propWordHex(sw.resid) + ' at ' + propWordHex(sw.off));
  return ' The swing in a fight is ' + (sw.own ? 'a list of tiles in ' : 'not the weapon’s own: it has no list, so it plays ') + where + ': ' + tiles + '.';
}

// Another class's page, at the aspect that shows the same tile.
function propWordOpen(pt, aspect) { showItemDetail(pt); propWordSet(aspect); }
// Whether this class makes anything of its aspect beyond the picture and
// the name, from its own script (aspectReaders).
function propWordAspectSentence(pt) {
  const w = s => '<b style="color:#fff">' + s + '</b>';
  const own = svEsc(propDisplayName(pt) || 'this item');
  let ar = null;
  try { ar = aspectReaders().get(pt) || null; } catch (e) { ar = null; }
  if (!ar) return 'This prop type has no class script, so the aspect is the picture and the name and nothing else.';
  if (ar.reads) return w('This class’s script reads its aspect') + ' (' + ar.reads + (ar.reads === 1 ? ' place' : ' places') + '): what a ' + own + ' does depends on it, not only how it looks.' + (ar.writes ? ' It also writes it, as a state.' : '');
  if (ar.writes) return 'This class’s script ' + w('writes its aspect') + ' as a state of its own and never reads it: the pictures above the base are what it turns into.';
  return w('This class’s script never reads its aspect') + ': at any aspect it is the same ' + own + ' in every number, under another picture and name.';
}
// What using the item at this aspect does, for the classes that read the
// aspect at use: a food's nutrition and the line said, a potion's effect.
function propWordUseSentence(pt, a) {
  const w = s => '<b style="color:#fff">' + s + '</b>';
  const u = aspectUseAt(pt, a);
  if (!u) return '';
  if (u.kind === 'food') return u.beyond ? ' The class reads a nutrition for ' + u.count + ' variants; past them, what it feeds is whatever the table is followed by.'
    : ' Eaten, it feeds ' + w('+' + u.plus) + (u.says ? ' and says “' + svEsc(u.says) + '”' : '') + '.';
  if (u.kind === 'potion') return u.beyond ? ' The class calls one of ' + u.count + ' effect scripts by the aspect; past them there is none.'
    : ' Drunk, it is the ' + w(svEsc(u.name)) + (u.does.length ? ': ' + svEsc(u.does.join('; ')) : '') + (u.says ? ', “' + svEsc(u.says) + '”' : '') + '.';
  return '';
}
function propWordRender() {
  const st = window.PROP_WORD; if (!st || !st.read) return;
  const pt = st.pt, a = st.aspect, tiles = getPropTileList(), base = tiles[pt] || 0, tile = base + a, word = (a << 10) | pt;
  const w = s => '<b style="color:#fff">' + s + '</b>';
  const name = terrainNameFor(tile) || '', own = terrainNameFor(base) || propDisplayName(pt) || '';
  const bits = word.toString(2).padStart(16, '0');
  let h = '<div class="sv-note" style="margin:0 0 8px">A prop record names what it is with one 16-bit word: <b>the prop type in the low ten bits, an aspect in the five above</b>. This item’s prop type is ' + w(pt) + ', so at aspect 0 the word is ' + w(propWordHex(pt)) + '; a step of aspect adds 1,024. ' +
    'Aspect <i>n</i> draws the base tile + <i>n</i> and takes that tile’s name. ' + propWordAspectSentence(pt) + (swingFramesHTML(pt) || (gearTable().some(r => r.pt === pt && r.melee) ? ' The swing in a fight is the class’s own animation, whatever the aspect.' : ''));
  let wear = [];
  try { wear = orphanArtReachable(pt); } catch (e) { wear = []; }
  if (wear.length) h += ' At ' + wear.map(x => 'aspect ' + w(x.aspect) + ' it is a ' + w(svEsc(x.name)) + ' (tile ' + propWordHex(x.tile) + ', the word ' + propWordHex(x.word) + ')').join(', ') +
    ' with this class’s own numbers, a picture no class owns and nothing in the file wears.';
  h += '</div><div class="pwBits">';
  for (let i = 0; i < 16; i++) {
    if (i === 1 || i === 6) h += '<span class="pwGap"></span>';
    h += '<span class="pwBit ' + (i === 0 ? 'pwSpare' : i < 6 ? 'pwAsp' : 'pwCls') + (bits[i] === '1' ? ' on' : '') + '">' + bits[i] + '</span>';
  }
  h += '</div><div class="pwKeys"><span style="width:var(--pwb)"></span><span class="pwGap"></span><span style="width:calc(5 * var(--pwb) + 8px)">aspect, 5 bits</span><span class="pwGap"></span><span>class, 10 bits</span></div>';
  h += '<div class="pwRead"><b>' + propWordHex(word) + '</b><span>' + word.toLocaleString('en-US') + '</span><span>' + a + ' × 1,024 + ' + pt + '</span></div>';
  // What is shown, and what is kept.
  let g = null;
  try { g = gearTable().find(r => r.pt === pt) || null; } catch (e) { g = null; }
  const kept = [];
  if (g) {
    if (g.melee && g.damage !== null) kept.push('damage ' + g.damage);
    if (g.thrown) kept.push('thrown damage ' + g.thrown[0] + ', range ' + g.thrown[1]);
    if (g.reach !== null && g.reach !== undefined) kept.push((g.ranged ? 'range ' : 'reach ') + g.reach);
    if (g.skill) kept.push(g.skill);
    if (g.protection !== null && g.protection !== undefined) kept.push('protection ' + g.protection);
    if (g.block !== null && g.block !== undefined) kept.push('blocks ' + g.block);
  }
  const wt = itemWeight(pt);
  if (wt !== null) kept.push(wt + ' grains');
  h += '<div class="sv-note" style="margin:0 0 4px">' + (a === 0
    ? 'Aspect 0 is the prop type’s base tile, ' + w(svEsc(own || 'unnamed')) + ' (' + propWordHex(base) + ').'
    : 'Aspect ' + a + ' shows tile ' + propWordHex(tile) + ', ' + w(svEsc(name || 'unnamed')) + ', and takes that name. It is still prop type ' + pt + ', class ' + propWordHex(0x1000 + pt) + (kept.length ? ': ' + kept.join(', ') : '') + '.') + propWordUseSentence(pt, a) + '</div>';
  // The other classes whose aspect can land on this tile, and at what.
  let others = [];
  try { others = inventoryItemList().filter(e => e.pt !== pt && (tiles[e.pt] || 0) && (tiles[e.pt] || 0) <= tile && tile < (tiles[e.pt] || 0) + 32)
    .map(e => ({ pt: e.pt, aspect: tile - (tiles[e.pt] || 0), name: e.name })).sort((x, y) => x.aspect - y.aspect); } catch (e) { others = []; }
  h += '<div class="mechSub">Other prop types that reach this tile</div>';
  h += '<div class="sv-note" style="margin-top:0">' + (others.length ? others.map(o => svLink(o.name, 'propWordOpen(' + o.pt + ',' + o.aspect + ')', 'at ' + o.aspect + ', ' + propWordHex((o.aspect << 10) | o.pt))).join(', ')
    : 'No other item’s base tile is within 31 below this one.') + '</div>';
  st.read.innerHTML = h;
  // The meaning of the two bytes for this class.
  let rules = null;
  try { rules = propWordRules(); } catch (e) { rules = null; }
  let m = '';
  if (rules) {
    const reader = rules.readers.find(r => r.pt === pt), ex = rules.examines.find(e => e.pt === pt);
    if (rules.melee.has(pt) && rules.ench && rules.ench.guarded && rules.ench.added) {
      m = 'Data1 is the enchantment: ' + svLink('the outcome routine', 'jumpToResource(0xE87)', '0xE87') + ' reads it off the weapon and adds it to the damage of every blow' + (rules.ench.magic ? ', and a blow with any enchantment counts as magical' : '') + '.';
      if (ex && ex.hiVal && ex.loVal) m += st.d1 > ex.hiVal.v ? ' Examine says “' + svEsc(ex.above2) + '”' : st.d1 > ex.loVal.v ? ' Examine says “' + svEsc(ex.above0) + '”' : ' Examine reports it once it is above ' + srcNum(ex.loVal) + '.';
      if (reader) m += ' The class script also ' + propWordOps(reader.ops) + '.';
    } else if (reader) m = 'The class script ' + propWordOps(reader.ops) + (reader.ops.some(o => /data3/.test(o)) ? ' (Data3 is both bytes as one value)' : '') + '. What they mean is this class’s own.';
    else m = 'No script on this class reads either byte.';
  }
  m += ' The create-a-prop cheat asks for ' + w(propWordHex(word)) + ', then Data1 ' + w(st.d1) + ' in decimal, then Data2 ' + w(propWordHex(st.d2, 2)) + ' in hex.';
  st.meaning.innerHTML = m;
}

// A prop type counts as an item if the archive treats it as one: it has a
// weight in its class, or instances of it are carried, contained or marked
// takeable. Nothing here is a hand-written list of item names.
function isInventoryItem(pt) {
  if (livingPropTypes().has(pt)) return false;
  if (itemWeight(pt) !== null) return true;
  const e = buildItemIndex()[pt];
  return !!(e && (e.carried || e.equipped || e.contained || e.takeable));
}

function itemGroup(pt) {
  const cls = parseItemClass(pt);
  if (cls && ITEM_COMBAT_KEYS.some(k => cls.data.some(f => f.key === k))) return 'Weapons & armour';
  const e = buildItemIndex()[pt];
  if (e && e.contained && cls && cls.code.some(f => f.key === 0x17)) return 'Containers';
  if (cls && cls.data.some(f => f.key === 0x34)) return 'Containers';
  return 'Carried goods';
}

window.ITEM_LIST = null;
function inventoryItemList() {
  if (window.ITEM_LIST) return window.ITEM_LIST;
  const tiles = getPropTileList();
  const list = [];
  for (let pt = 1; pt < tiles.length && pt < 1024; pt++) {
    if (!tiles[pt]) continue;
    let ok = false;
    try { ok = isInventoryItem(pt); } catch (e) {}
    if (!ok) continue;
    const e = buildItemIndex()[pt] || null;
    list.push({
      pt, name: propDisplayName(pt), weight: itemWeight(pt), group: itemGroup(pt),
      instances: e ? e.total : 0, cls: parseItemClass(pt)
    });
  }
  return (window.ITEM_LIST = list);
}

const ITEM_GROUP_ORDER = ['Weapons & armour', 'Containers', 'Carried goods'];
// What puts an item under each divider, said under it: the rule is the
// class script's members (itemGroup), named here from the file's own symbol
// table, and the item test is isInventoryItem's.
function itemGroupNote(group) {
  const nm = k => itemFieldLabel(k);
  if (group === 'Weapons & armour') return 'The class script has a combat member: ' + ITEM_COMBAT_KEYS.map(nm).join(', ') + '.';
  if (group === 'Containers') return 'The class script has ' + nm(0x34) + ', or answers ' + nm(0x17) + ' and a prop list puts something inside one.';
  return 'The rest of what the file treats as an item: a class with a weight, or a prop that a prop list has carried, inside a container or marked takeable, and no combat member.';
}

function renderItemSheet() {
  stopSpriteAnimations();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  const entries = inventoryItemList().filter(e =>
    !q || (e.name || '').toLowerCase().includes(q) || ('0x' + e.pt.toString(16)).includes(q) ||
    (terrainNameFor(getPropTileList()[e.pt] || 0) || '').toLowerCase().includes(q));
  entries.sort((a, b) =>
    (ITEM_GROUP_ORDER.indexOf(a.group) - ITEM_GROUP_ORDER.indexOf(b.group)) ||
    ((a.name ? 0 : 1) - (b.name ? 0 : 1)) ||
    (a.name || '').localeCompare(b.name || '') || a.pt - b.pt);

  let heading = null;
  for (const e of entries) {
    if (e.group !== heading) {
      heading = e.group;
      const h = document.createElement('div');
      h.className = 'propHead';
      h.innerHTML = '<span class="groupTitle">' + svEsc(heading) + '</span><span class="groupNote">' + svEsc(itemGroupNote(heading)) + '</span>';
      grid.appendChild(h);
    }
    const cell = document.createElement('div');
    cell.className = 'cell propCell itemCell';
    const wrap = document.createElement('div');
    wrap.className = 'cellimgwrap';
    const base = getPropTileList()[e.pt] || 0;
    const info = spriteFrameInfo(0, e.pt);
    // The item's OWN frames, not the whole tail of its sheet. A frame block is
    // bounded by the sheet, not by the thing, so full helmet's block runs on
    // into the grimoire beside it -- which is how the grimoire came to be
    // listed as the second frame of a helmet.
    const own = framesSharingName(base, info.present);
    const spr = drawPropSprite(base + (own[0] || 0), 34);
    if (spr) wrap.appendChild(spr.canvas);
    // An item with several frames shows them all, in turn: one jittered
    // timer per multi-frame cell, on the same registry the character
    // gallery's walkers use, so navigation stops every one of them.
    if (spr && own.length > 1 && window.SPRITE_ANIM) {
      let fi = 0;
      spriteTimers.push(setInterval(() => {
        if (!spr.canvas.isConnected) return;
        fi = (fi + 1) % own.length;
        const next = drawPropSprite(base + own[fi], 34);
        if (next) spr.canvas.replaceWith(next.canvas), spr.canvas = next.canvas;
      }, 800 + (e.pt % 7) * 60));
    }
    cell.appendChild(wrap);
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.innerHTML = itemNameHTML(e.pt, base);
    cell.appendChild(lbl);
    const sub = document.createElement('div');
    sub.className = 'resid';
    const bits = [];
    if (e.weight !== null) bits.push(e.weight + 'gr');
    if (e.instances) bits.push(e.instances + '\u00d7');
    bits.push('0x' + e.pt.toString(16).toUpperCase());
    sub.textContent = bits.join(' \u00b7 ');
    cell.appendChild(sub);
    cell.onclick = () => showItemDetail(e.pt);
    grid.appendChild(cell);
  }
  // Art no class owns: named, drawn, the base of nothing, worn by nothing
  // the file places. Reached by an item's aspect, which is how the
  // create-a-prop cheat gets a flail.
  let orphans = [];
  try { orphans = orphanItemArt().filter(o => !q || o.name.toLowerCase().includes(q)); } catch (e) { orphans = []; }
  if (orphans.length) {
    const h = document.createElement('div');
    h.className = 'propHead';
    h.innerHTML = '<span class="groupTitle">Art no class owns</span><span class="groupNote">Named in 0xF004 and drawn, the base tile of no class, no class’s own state, and in no prop list. An item wears one at the aspect shown, with the class’s own numbers under that picture and that name.</span>';
    grid.appendChild(h);
    for (const o of orphans) {
      const cell = document.createElement('div');
      cell.className = 'cell propCell itemCell orphanCell';
      const wrap = document.createElement('div');
      wrap.className = 'cellimgwrap';
      const spr = drawPropSprite(o.tile, 34);
      if (spr) wrap.appendChild(spr.canvas);
      cell.appendChild(wrap);
      const lbl = document.createElement('div');
      lbl.className = 'lbl';
      lbl.textContent = o.name;
      cell.appendChild(lbl);
      const sub = document.createElement('div');
      sub.className = 'resid';
      sub.textContent = '0x' + o.tile.toString(16).toUpperCase() + ' \u00b7 ' +
        o.reach.map(r => (terrainNameFor(getPropTileList()[r.pt] || 0) || ('0x' + r.pt.toString(16))) + ' ' + r.aspect).join(', ') +
        ' \u00b7 in no prop list';
      cell.appendChild(sub);
      cell.onclick = () => showSpriteZoom(o.tile, o.name);
      grid.appendChild(cell);
    }
  }
  const withWeight = entries.filter(e => e.weight !== null).length;
  out.textContent = entries.length + ' items' +
    (q ? ' matching \u201c' + q + '\u201d' : '') + ', ' + withWeight + ' with a weight in their class script' +
    (orphans.length ? '; ' + orphans.length + ' picture' + (orphans.length === 1 ? '' : 's') + ' no class owns' : '') + '.';
}

/* Each one placed, and what tells them apart.

   The zone chips on an item's page say where a class's props are and how
   many, which is all there is to say about a torch. It is not enough for a
   class whose props differ: a book's aspect is only its colour and its Data1
   is which book it is, a key's Data1 is the lock it fits, a potion's aspect
   is which potion. The maintainer asked what the red book was against the
   blue one (16 September 2026), and the page could not say where either was.

   So when a class's placed props come in more than one aspect and Data1,
   each pair is a row: its picture, its numbers, and what the class reads the
   number as where libraryRules has read that (the first line of the passage
   it opens); then a chip for every prop, opening its square. A prop inside a
   container is placed at the container's square, followed up the chain, and
   one carried names who carries it. Eggs and roofs (flags 0x40) are records
   whose prop-type field is an argument, not a prop, and are left out, as the
   library leaves them out. */
window.ITEM_PLACES = null;
function itemPlaces(pt) {
  if (!window.ITEM_PLACES) {
    const all = new Map();
    for (let z = 0; z < 0x100; z++) {
      if (!refExists(0x8100 + z)) continue;
      let list;
      try { list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data); } catch (e) { continue; }
      for (const r of list) {
        if (r.flags === 0xFF || (r.flags & 0x40)) continue;
        const p = { zone: z, aspect: r.aspect, d1: r.d1, d2: r.d2, host: null };
        let top = r;
        for (let k = 0; k < 8 && top && top.container !== null; k++) {
          const h = list[top.container];
          if (p.host === null && h) p.host = h.proptype;
          top = h;
        }
        if (top && top.onMap) { p.x = top.x; p.y = top.y; }
        else if (top && top.carriedBy !== null) p.carriedBy = top.carriedBy;
        if (!all.has(r.proptype)) all.set(r.proptype, []);
        all.get(r.proptype).push(p);
      }
    }
    window.ITEM_PLACES = all;
  }
  return window.ITEM_PLACES.get(pt) || [];
}

// What a class reads its Data1 and Data2 as, where it opens a passage by them.
function itemDataMeaning(pt) {
  const out = {};
  let lib = null;
  try { lib = libraryRules(); } catch (e) { lib = null; }
  for (const d of lib || []) for (const r of d.readers) {
    if (r.pt !== pt) continue;
    const m = out[r.field] || (out[r.field] = new Map());
    for (const e of d.entries) if (!m.has(e.index)) m.set(e.index, String(e.str).split('\n')[0].trim());
  }
  return out;
}

function placeChip(p, n) {
  const map = 0x8000 + p.zone;
  const note = n > 1 ? '\u00d7' + n : '';
  // A carrier the character table has; one key in Land King Hall is held by
  // a number that is not a character (0xF02F), and says only that it is carried.
  if (p.carriedBy !== undefined) return loadCharacterTable()[p.carriedBy] ? characterChip(p.carriedBy)
    : relChip({ resid: map, main: zoneLabel(p.zone), sub: 'carried', note, title: trailForResid(map) });
  const inside = p.host !== null ? 'in a ' + (propDisplayName(p.host) || 'container') : '';
  if (p.x === undefined) return relChip({ resid: map, main: zoneLabel(p.zone), sub: inside, note, title: trailForResid(map) });
  return relChip({ js: 'showSquareOnMap(' + map + ',' + p.x + ',' + p.y + ')', main: zoneLabel(p.zone),
                   sub: (inside ? inside + ', ' : '') + 'at ' + p.x + ', ' + p.y, note,
                   icon: relIconFor(map), title: trailForResid(map) });
}

function itemEachOneHTML(pt) {
  const places = itemPlaces(pt);
  if (places.length < 2) return '';
  const meaning = itemDataMeaning(pt);
  const byD2 = !!meaning.d2;
  const groups = new Map();
  for (const p of places) {
    const k = p.aspect + '/' + p.d1 + (byD2 ? '/' + p.d2 : '');
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  if (groups.size < 2) return '';
  const base = getPropTileList()[pt] || 0;
  const all = [...groups.values()].sort((a, b) => a[0].d1 - b[0].d1 || a[0].d2 - b[0].d2 || a[0].aspect - b[0].aspect);
  // A look is named when its name says something: a potion by what the class
  // makes of it drunk, anything else by its tile's name where the aspects
  // placed do not all share one ("bread", "cheese"; not "book" six times).
  const tileNames = new Set(all.map(l => terrainNameFor(base + l[0].aspect) || ''));
  const lookName = a => {
    let u = null;
    try { u = aspectUseAt(pt, a); } catch (e) { u = null; }
    if (u && u.kind === 'potion' && !u.beyond && u.name) return u.name;
    return tileNames.size > 1 ? (terrainNameFor(base + a) || '') : '';
  };
  const rows = all.slice(0, 40).map(list => {
    const p = list[0];
    let icon = '';
    try { icon = relIconURL({ tile: base + p.aspect }); } catch (e) { icon = ''; }
    const said = (meaning.d1 && meaning.d1.get(p.d1)) || (byD2 && meaning.d2.get(p.d2)) || '';
    const head = (icon ? '<img class="relIcon" src="' + icon + '" alt="" width="16" height="16"> ' : '') +
      (lookName(p.aspect) ? svEsc(lookName(p.aspect)) + ', ' : '') +
      'aspect ' + p.aspect + ', Data1 ' + p.d1 + (byD2 ? ', Data2 ' + p.d2 : '') +
      (said ? '<br>“' + svEsc(said) + '”' : '');
    // Props on the same square, in the same container or with the same
    // carrier are one chip with a count.
    const spots = new Map();
    for (const q of list) {
      const k = [q.zone, q.x, q.y, q.host, q.carriedBy].join('/');
      if (!spots.has(k)) spots.set(k, { p: q, n: 0 });
      spots.get(k).n++;
    }
    const each = [...spots.values()];
    const chips = each.slice(0, 12).map(s2 => placeChip(s2.p, s2.n)).join('') +
      (each.length > 12 ? ' <span class="inspDim">and ' + (each.length - 12) + ' more places</span>' : '');
    return '<tr><td class="skillKey">' + head + '</td><td>' + chips + '</td></tr>';
  });
  return '<div class="eachOne" style="margin-top:10px"><b style="color:#b5b2a8;font-size:0.6875rem;letter-spacing:0">Each one</b>' +
    '<table class="vocabTable barkTable mechTable"><tbody>' + rows.join('') + '</tbody></table>' +
    (all.length > 40 ? '<div class="inspDim">and ' + (all.length - 40) + ' more kinds</div>' : '') + '</div>';
}

function showItemDetail(pt) {
  stopSpriteAnimations();
  markDetailView('item', pt);
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = 'block';
  grid.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'secondary';
  back.textContent = 'All items';
  back.onclick = renderItemSheet;
  grid.appendChild(back);

  const base = getPropTileList()[pt] || 0;
  const info = spriteFrameInfo(0, pt);
  const cls = parseItemClass(pt);
  const idx = buildItemIndex()[pt];
  const panel = document.createElement('div');
  panel.style.cssText = 'width:100%;max-width:620px;margin:12px auto;text-align:left';

  let h = '<div class="sv-head"><span class="sv-id">' +
    propNameHTML(pt, base) + '</span></div>' +
    '<div style="font-size:0.8125rem;color:#fff;margin:4px 0 10px">prop type 0x' +
    pt.toString(16).toUpperCase() + ' \u00b7 base tile 0x' + base.toString(16).toUpperCase() +
    (cls ? ' \u00b7 class ' + '0x' + cls.resid.toString(16).toUpperCase() + ', ' + cls.size + ' bytes'
         : ' \u00b7 no class script at 0x' + (0x1000 + pt).toString(16).toUpperCase()) + '</div>';
  {
    const chips = [];
    if (cls && refExists(cls.resid)) chips.push(partChip('Class script', cls.resid));
    if (refExists(0x8E00 + (base >> 4))) chips.push(partChip('Sprite sheet', 0x8E00 + (base >> 4)));
    chips.push(actionChip('Prop type', 'showPropTypeDetail(' + pt + ')', 'every frame'));
    for (const w of containerWindowsFor(pt)) chips.push(partChip('Opens as', w));
    for (const n of classSounds(0x1000 + pt)) chips.push(partChip('Sound', 0x9100 + n));
    h += partsStrip('Made of', chips);
  }
  panel.innerHTML = h;
  // Every section below the frames is a fold, shut by default, its summary
  // carrying one line of what is inside; the page had grown to seven
  // blocks on top of each other (the maintainer, 9 September 2026).
  const fold = (id, title, gist, inner) => {
    const sec = foldCard('item-' + id, 'itemFold', false);
    const head = document.createElement('summary');
    head.className = 'mechHead';
    head.innerHTML = '<span class="foldTitle">' + svEsc(title) + '</span>' + (gist ? '<span class="foldGist">' + svEsc(gist) + '</span>' : '');
    sec.appendChild(head);
    const body = document.createElement('div');
    if (typeof inner === 'string') body.innerHTML = inner; else if (inner) body.appendChild(inner);
    sec.appendChild(body);
    panel.appendChild(sec);
    return body;
  };

  // Only the frames the archive still calls by this item's name. Everything
  // after them belongs to whatever the sheet holds next, and is named as such
  // below rather than passed off as another view of this item.
  const runs = frameRuns(base, info.present);
  const ownFrames = framesSharingName(base, info.present);
  const ownColours = null;   // no colour words on frames, by request
  const sheet = document.createElement('div');
  sheet.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px';
  for (const f of ownFrames.slice(0, 16)) {
    const cellw = document.createElement('div');
    cellw.style.cssText = 'width:52px;text-align:center';
    const holder = document.createElement('div');
    holder.style.cssText = 'width:52px;height:52px;display:flex;align-items:center;justify-content:center;background:#1c1913;border:1px solid #33302a;overflow:hidden';
    const spr = drawPropSprite(base + f, 24);
    if (spr) holder.appendChild(spr.canvas);
    const col = ownColours && ownColours.get(f);
    holder.title = 'frame ' + f + ' \u00b7 tile 0x' + (base + f).toString(16).toUpperCase() +
                   (col ? ' \u00b7 ' + col : '');
    cellw.appendChild(holder);
    const cap = document.createElement('div');
    cap.style.cssText = 'font-size:0.625rem;color:#b5b2a8;line-height:1.3;margin-top:2px';
    cap.textContent = col ? (f + ' \u00b7 ' + col) : String(f);
    cellw.appendChild(cap);
    sheet.appendChild(cellw);
  }
  panel.appendChild(sheet);
  // The record's word, what an aspect does to it, and the two data bytes:
  // the block under "Prop record", built as elements because the rail draws
  // a tile in each slot.
  {
    const host = document.createElement('div');
    fold('word', 'Prop record', propWordHex(pt) + ' at aspect 0, Data1 and Data2', host);
    try { propWordMount(pt, host); } catch (e) { host.className = 'sv-note'; host.textContent = 'The prop record could not be read: ' + (e && e.message ? e.message : e); }
  }
  const strangers = runs.filter(r => r.name !== terrainNameFor(base));
  if (strangers.length) {
    const note = document.createElement('div');
    note.className = 'sv-note';
    note.style.cssText = 'font-size:0.75rem;color:#8c8980;margin:-4px 0 12px';
    // The scythe's block runs on into fourteen other things, so the list is
    // capped -- the point is that the block is not all one item, not to
    // enumerate a sheet.
    note.innerHTML = 'The rest of this sheet block is other things: ' +
      strangers.slice(0, 6).map(r => '<b style="color:#fff">' + svEsc(r.name || 'unnamed') + '</b> (frame' +
        (r.frames.length === 1 ? ' ' + r.frames[0] : 's ' + r.frames[0] + ' to ' + r.frames[r.frames.length-1]) + ')'
      ).join(', ') +
      (strangers.length > 6 ? ' and ' + (strangers.length - 6) + ' more' : '') +
      '. A frame block ends where the 16-tile sheet does, not where the item does; ' +
      'the names come from 0xF004.';
    panel.appendChild(note);
  }

  // Static data from the class table.
  if (cls && cls.data.length) {
    let rows = '';
    for (const f of cls.data) {
      const meta = ITEM_FIELD_INFO[f.key] || {};
      rows += '<tr><td style="padding:3px 10px 3px 0;color:#fff;white-space:nowrap">' +
        svEsc(itemFieldLabel(f.key)) +
        '<span style="color:#8c8980;font-size:0.6875rem"> 0x' + f.key.toString(16).toUpperCase().padStart(4,'0') + '</span></td>' +
        '<td style="padding:3px 0;font-family:ui-monospace,Menlo,Consolas,monospace">' +
        srcNum({ resid: cls.resid, at: f.off }, itemFieldValue(f)) + '</td></tr>' +
        (meta.gloss ? '<tr><td colspan="2" style="padding:0 0 6px;color:#8c8980;font-size:0.75rem">' +
          svEsc(meta.gloss) + '</td></tr>'
        : '<tr><td colspan="2" style="padding:0 0 6px;color:#8c8980;font-size:0.75rem">' +
          'No published meaning for this key.</td></tr>');
    }
    fold('data', 'Class data', cls.data.length + ' field' + (cls.data.length === 1 ? '' : 's'), '<table style="border-collapse:collapse;width:100%">' + rows + '</table>');
  } else if (cls) {
    fold('data', 'Class data', 'no data fields', '<div class="sv-note">This class carries only behaviour, no data fields.</div>');
  }

  // Behaviour: which methods have code behind them.
  if (cls && cls.code.length) {
    fold('code', 'Responds to', cls.code.map(f => itemFieldLabel(f.key)).join(', '),
      cls.code.map(f => '<button class="sv-chip" onclick="jumpToScriptAt(' + cls.resid + ',' + f.off + ')">' +
        svEsc(itemFieldLabel(f.key)) + '</button>').join(' ') +
      '<div class="sv-note" style="margin-top:6px">Each opens the class script 0x' +
      cls.resid.toString(16).toUpperCase() + ' at its method.</div>');
  }
  // What a blow does to it, where the class has a TakeDamage of its own.
  if (cls && cls.code.some(f => f.key === 0x41)) {
    let row = null;
    try { row = damageTakers().rows.find(r => r.pt === pt) || null; } catch (e) { row = null; }
    if (row) {
      const words = damageRowWords(row);
      const plain = words.replace(/<[^>]+>/g, '');
      fold('struck', 'When struck', plain.charAt(0).toUpperCase() + plain.slice(1),
        '<div style="color:#fff;font-size:0.8125rem;line-height:1.55">' + words.charAt(0).toUpperCase() + words.slice(1) + '.' +
        (row.says.filter(s => s !== row.spills)[0] ? ' It says “' + svEsc(row.says.filter(s => s !== row.spills)[0]) + '”.' : '') + '</div>' +
        '<div class="sv-note">' + mechLink('damage', 'Mechanics › Damage to things') + '</div>');
    }
  }
  // A status this thing gives whoever wears or uses it, and what takes it
  // away again, from its own methods (grantRules).
  {
    let grants = [];
    try { grants = grantRules().filter(g => g.pt === pt); } catch (e) { grants = []; }
    if (grants.length) {
      const names = grants.map(g => g.flagName || ('flag ' + g.flag.v));
      fold('grants', 'Status it gives', names.join(', '),
        '<div style="color:#fff;font-size:0.8125rem;line-height:1.55">' + grants.map(g =>
          'Its <b>' + svEsc(g.method) + '</b> sets ' + srcNum(g.flag, g.flagName || ('flag ' + g.flag.v)) + ' on the character' +
          (g.clearedBy ? ', and its ' + svEsc(g.clearedBy) + ' clears it again' : ', and nothing in the class clears it') + '.').join('<br>') + '</div>' +
        '<div class="sv-note">' + mechLink('status', 'Mechanics › Status effects') + '</div>');
    }
  }
  // What it asks for when it is used, and what the application requires of
  // that target (targetRules).
  if (cls) {
    let t = null;
    try { t = targetOf(cls.resid); } catch (e) { t = null; }
    if (t) {
      const words = targetWordWords(t.word);
      fold('aimed', 'Aimed at', words.join(', '),
        '<div style="color:#fff;font-size:0.8125rem;line-height:1.55">It asks “' + svEsc(t.prompt) + '” and answers ' + srcNum(t.val, propWordHex(t.word)) +
        ', which wants <b>' + words.map(svEsc).join(', ') + '</b>.' + ((t.word & 0x8000) ? ' Within reach is the user’s own square and the eight around it.' : '') + '</div>' +
        '<div class="sv-note">' + mechLink('target', 'Mechanics › What a use can be aimed at') + '</div>');
    }
  }
  // The one thing that damages a square rather than a target.
  {
    let bl = null;
    try { bl = blastRules(); } catch (e) { bl = null; }
    if (bl && bl.centre && bl.resid === (cls && cls.resid)) {
      fold('blast', 'When it goes off', bl.centre.v + ' on its own square, ' + (bl.edge ? bl.edge.v : '') + ' beside it',
        '<div style="color:#fff;font-size:0.8125rem;line-height:1.55">It hands ' + srcNum(bl.centre) + ' to everything on its own square, ' +
        srcNum(bl.edge) + ' to the four squares beside it and ' + srcNum(bl.corner) + ' to the four corners, as ' +
        (bl.type ? svEsc(damageTypeName(bl.type.v)) + ' (type ' + srcNum(bl.type) + ')' : 'its own type') + '.</div>' +
        '<div class="sv-note">' + mechLink('damage', 'Mechanics › Damage to things') + '</div>');
    }
  }

  if (cls && cls.text.length) {
    fold('text', 'Text in this class', '\u201c' + cls.text[0].text + '\u201d' + (cls.text.length > 1 ? ' and ' + (cls.text.length - 1) + ' more' : ''),
      cls.text.slice(0, 12).map(t =>
        '<div style="color:#fff;font-size:0.8125rem;margin-bottom:4px">\u201c' + svEsc(t.text) + '\u201d</div>'
      ).join(''));
  }

  // Where it is in the shipped scenario.
  if (idx && idx.total) {
    const facts = [];
    facts.push('<div><b>Total</b>' + idx.total + '</div>');
    if (idx.loose) facts.push('<div><b>On the ground</b>' + idx.loose + '</div>');
    if (idx.contained) facts.push('<div><b>In containers</b>' + idx.contained + '</div>');
    if (idx.carried) facts.push('<div><b>Carried</b>' + idx.carried + '</div>');
    if (idx.equipped) facts.push('<div><b>Equipped</b>' + idx.equipped + '</div>');
    // .sv-facts is a single-column grid by default, which turns four small
    // counts into four full-width slabs on a phone.
    let body = '<div class="sv-facts" style="grid-template-columns:repeat(auto-fit,minmax(118px,1fr))">' +
      facts.join('') + '</div>';

    const zoneIds = Object.keys(idx.zones).map(Number).sort((a, b) => idx.zones[b] - idx.zones[a]);
    body += '<div style="margin-top:8px">' + zoneIds.slice(0, 16).map(rid =>
      '<button class="sv-chip" onclick="showItemOnMap(' + (rid - 0x100) + ',' + pt + ')">' +
      svEsc(zoneNameFor(rid) || ('0x' + rid.toString(16).toUpperCase())) +
      ' <em>\u00d7' + idx.zones[rid] + '</em></button>').join(' ') +
      (zoneIds.length > 16 ? ' <span style="color:#8c8980">+' + (zoneIds.length - 16) + ' more</span>' : '') +
      '</div>';

    if (idx.held.length) {
      const byChar = {};
      for (const h of idx.held) {
        const k = h.character;
        byChar[k] = byChar[k] || { n: 0, equipped: 0 };
        byChar[k].n++; if (h.equipped) byChar[k].equipped++;
      }
      body += '<div style="margin-top:10px"><b style="color:#b5b2a8;font-size:0.6875rem;letter-spacing:0">Carried by</b><br>' +
        Object.keys(byChar).slice(0, 24).map(k =>
          '<button class="sv-chip" onclick="showCharacterDetail(' + k + ')">' +
          svEsc(characterName(+k)) + (byChar[k].equipped ? ' <em>equipped</em>' : '') +
          (byChar[k].n > 1 ? ' <em>\u00d7' + byChar[k].n + '</em>' : '') + '</button>').join(' ') +
        '</div>';
    }

    if (idx.inside.length) {
      const byHost = {};
      for (const h of idx.inside) {
        const k = h.hostType;
        byHost[k] = (byHost[k] || 0) + 1;
      }
      body += '<div style="margin-top:10px"><b style="color:#b5b2a8;font-size:0.6875rem;letter-spacing:0">Found inside</b><br>' +
        Object.keys(byHost).sort((a, b) => byHost[b] - byHost[a]).slice(0, 16).map(k =>
          '<button class="sv-chip" onclick="showItemDetail(' + k + ')">' +
          svEsc(propDisplayName(+k) || ('0x' + (+k).toString(16).toUpperCase())) +
          ' <em>\u00d7' + byHost[k] + '</em></button>').join(' ') +
        '</div>';
    }
    body += itemEachOneHTML(pt);
    fold('world', 'In the world', idx.total + ' placed' + (idx.carried + idx.equipped ? ', ' + (idx.carried + idx.equipped) + ' carried' : '') + (idx.contained ? ', ' + idx.contained + ' in containers' : ''), body);
  } else {
    fold('world', 'In the world', 'none placed', '<div class="sv-note">No instance of this item is placed in the shipped scenario, it is either created by a script or unused.</div>');
  }

  // The key is one prop type carrying eight different keys, told apart by
  // the lock id in their data byte -- so its detail page is the key ring.
  if (pt === KEY_PROPTYPE) {
    const { keys, locks } = buildKeyLockIndex();
    const lockedNoKey = new Set(locks.filter(l => !keys.some(k => k.id === l.id)).map(l => l.id)).size;
    fold('keys', 'The key ring', keys.length + ' keys', keys.map(k => {
        const ll = locksForKey(k.id);
        return '<div style="margin:7px 0">' + keyLocationChip(k) +
          ' <span class="inspDim">opens</span> ' +
          (ll.length ? ll.map(lockLocationChip).join(' ') : '<span class="inspDim">nothing found</span>') +
          '</div>';
      }).join('') +
      '<div class="sv-note">' + lockedNoKey + ' further lock ids have no matching key item, ' +
      'the lockpick, magic or a script opens those.</div>');
  }
  {
    const all = document.createElement('div');
    all.className = 'foldAll';
    all.innerHTML = svLink('Open all', 'mechOpenAll(true)') + svLink('Close all', 'mechOpenAll(false)');
    panel.appendChild(all);
  }

  grid.appendChild(panel);
  const w = itemWeight(pt);
  out.textContent = (propDisplayName(pt, base) || 'item 0x' + pt.toString(16).toUpperCase()) +
    (w !== null ? ', ' + w + ' grains' : '') +
    (idx && idx.total ? ', ' + idx.total + ' placed in the world' : '');
}

/* --- The resource fork ------------------------------------------------------
   "Cythera Data" is a Mac file with two forks. The game archive is the data
   fork, and everything else in this viewer reads that. The resource fork holds
   113 resources of 18 types, and it arrives here for free: a .hqx, MacBinary or
   AppleSingle container carries both forks, and binhexSplitForks already
   decoded the second one before extractDelverArchive threw it away.

   Most of it is ordinary Mac resources -- PICT, NFNT, clut, STR#, vers --
   which js/mac-rsrc-types.js decodes, and RSRC_KINDS (beside CATEGORY_NAMES)
   says what each kind is for and where on the site it is shown: the title
   and menu screens under Graphics, the fonts under Text, the string lists
   under Labels, the editor's zone list beside every map's name, the default
   conversation keywords on the Dialogue gallery,
   the Finder icons on the installer's rows, and the page's own face, which
   is the sfnt in this fork (installGameFont). What needs Cythera's tile
   system is the four types that are Delver's own:

     eSTM  16  editor stamps: an 8x8 patch of terrain the map editor could
               stamp down in one go, with names like "Forest Medium 1"
     eBRS  25  editor brushes: 16 tiles the editor joined up automatically to
               draw a river or a wall, named "Adobe Wall, Grass" and so on
     MSta   3  64 bytes each, named "Base", "Plague Cured" and "Olpheltius
               Murdered" -- the names are world events; the bytes are unread
     FILT   7  6,180 or 8,228 bytes each, unnamed; unread. What is measured:
               every one opens with a four-byte flag (0 or 1) and a pair of
               bytes that reads as a size in five of the seven (10x10, 14x14,
               4x4 twice, 16x80), and the body past a 36-byte head is exactly
               6,144 or 8,192 bytes. The values in it are few -- four distinct
               bytes in one, six in another -- and mostly 0, 1, 2, 0x21 and
               0xff, which is the shape of a per-square flag table rather than
               of artwork. The editor that wrote them is not shipped, so
               nothing here can be checked against anything; the shape is
               recorded and the meaning is not claimed

   Stamps and brushes are documented on the wiki's "Delver editor stamp" and
   "Delver editor brush" pages, and both are editor-only -- deleting them has no
   effect on the game. A stamp is u16 width, u16 height, then width*height tile
   ids; a brush is 16 tile ids and no header. Every one of the 64 tiles in every
   stamp resolves to real artwork here and has a name in F004, which is the
   check that the format is being read correctly.

   The brush layout is a guess and is labelled as one on screen: 16 tiles with
   "joining rules" looks like a 4-bit edge mask (which of the four neighbours
   match), and the first tile of every brush is the F004 entry "Nothing", which
   would be the isolated case. Nothing here depends on that being right -- the
   tiles are drawn in file order either way.
--------------------------------------------------------------------------- */
window.CYTHERA_RSRC = null;

// The two forks arrive together; this opens the second one. Failure is not
// interesting enough to report: a bare .rsrc-less archive is the normal case.
function openCytheraResourceFork(bytes) {
  window.CYTHERA_RSRC = null;
  if (!bytes || bytes.length < 286) return null;
  try { window.CYTHERA_RSRC = openResourceFork(bytes); } catch (e) { window.CYTHERA_RSRC = null; }
  return window.CYTHERA_RSRC;
}

/* The file's own face, made usable. Argos A Nouveau is sfnt 7289 in Cythera
   Data's resource fork (FOND 1046 names it); a browser loads a font from
   bytes through FontFace, once sfntToTrueType has given it the OS/2 table
   OTS requires. It is registered under its own family name, 'ArgosGame',
   which setFace() puts at the head of the stack when the reader is set to
   the game's face.

   Making it and using it are separate, and that is the point: this runs
   whenever a fork is open, so the game's font can be inspected, swapped and
   exported even while the page itself is set in something else. Failure is
   recorded, not reported, and the page stays in Chicago. */
window.GAME_FONT = null;
window.GAME_FONT_STATE = '';
