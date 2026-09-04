#!/usr/bin/env node
// Drives index.html's user interface in Node, because Chrome
// cannot start under this machine's sandbox (ProcessSingleton binds a unix
// socket and bind() returns EPERM -- see utilities/browser_smoke.mjs).
//
//   python3 utilities/binhex_decode.py "reference/game/Cythera Data.hqx" "$TMPDIR"
//   node utilities/viewer_smoke.mjs index.html "$TMPDIR/Cythera Data.data"
//
// decoder_snapshot.mjs proves the decoders still produce the same bytes. This
// proves the page around them still works: it feeds the archive through the
// real entry point (parseArchiveBytes), then opens every category, renders
// every gallery, and opens every resource in it -- so a missing element id, a
// renamed function or a branch that throws surfaces as a failure line instead
// of a blank pane someone finds later.
//
// The DOM below is a stand-in, not a browser. It is deliberately strict where
// that catches real mistakes (unknown getElementById targets are recorded,
// appendChild(undefined) throws) and lax where the browser's behaviour does
// not change the outcome (layout, painting, fonts).

import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import {pageSource, describeScripts} from './page_scripts.mjs';
import {makeCanvasContext} from './dom_stub.mjs';

const [htmlPath, dataPath, onlyCat, visePath] = process.argv.slice(2);
if (!htmlPath || !dataPath) {
  console.error('usage: viewer_smoke.mjs <viewer.html> <Cythera Data.data> [category] [Cythera.bin]');
  process.exit(2);
}
const html = readFileSync(htmlPath, 'utf8');
const js = pageSource(htmlPath);
const archive = new Uint8Array(readFileSync(dataPath));
// The resource fork, if it was extracted beside the data fork. The viewer gets
// this from the container it opened; here it is passed in the same way
// adoptArchive would, so the resource-fork gallery is exercised too.
const rsrcPath = dataPath.replace(/\.data$/, '.rsrc');
let rsrcFork = null;
try { rsrcFork = new Uint8Array(readFileSync(rsrcPath)); } catch (e) { rsrcFork = null; }

// ---- a small DOM -----------------------------------------------------------
const missingIds = new Set();
let nodeCount = 0;

// The 2D context is shared with dom_stub.mjs so the two stubs cannot drift.
const makeCtx = makeCanvasContext;

class El {
  constructor(tag) {
    nodeCount++;
    this.tagName = String(tag).toUpperCase();
    this.style = new Proxy({ cssText: '' }, { set(t, k, v) { t[k] = v; return true; } });
    this.children = [];
    this.childNodes = this.children;
    this.parentNode = null;
    this.attributes = {};
    this.dataset = {};
    this._text = '';
    this._html = '';
    this._id = '';
    this._classes = new Set();
    this.value = '';
    this.checked = false;
    this.disabled = false;
    this.tabIndex = -1;
    this.title = '';
    this.href = ''; this.download = ''; this.rel = ''; this.src = '';
    this.width = 0; this.height = 0; this._px = null;
    this.paused = true;
    this.files = [];
    this.options = [];
    this.selectedIndex = -1;
    // className and classList are ONE set of classes, as they are in a
    // browser. They used to be two: `cell.className = 'cell propCell'` left
    // classList empty, so anything that asked classList.contains('cell') --
    // which is how the gallery finds its own cells for sorting and filtering
    // -- saw nothing at all and silently did nothing.
    this.classList = {
      add: (...c) => c.forEach(x => x && this._classes.add(x)),
      remove: (...c) => c.forEach(x => this._classes.delete(x)),
      contains: c => this._classes.has(c),
      toggle: (c, on) => { if (on === undefined) on = !this._classes.has(c);
                           if (on) this._classes.add(c); else this._classes.delete(c); },
    };
  }
  get className() { return [...this._classes].join(' '); }
  set className(v) {
    this._classes = new Set(String(v === null || v === undefined ? '' : v).split(/\s+/).filter(Boolean));
  }
  replaceChild(next, old) {
    const i = this.children.indexOf(old);
    if (i < 0) return this.appendChild(next);
    next.parentNode = this; this.children[i] = next; old.parentNode = null; return old;
  }
  get id() { return this._id; }
  set id(v) { this._id = v; if (v) REGISTRY.set(v, this); }
  set textContent(v) { this._text = v === null || v === undefined ? '' : String(v); this.children.length = 0; }
  get textContent() {
    if (this.children.length) return this._text + this.children.map(c => c.textContent).join(' ');
    return this._text;
  }
  set innerHTML(v) {
    this._html = String(v === null || v === undefined ? '' : v);
    this.children.length = 0;
    if (this.tagName === 'SELECT') this.options.length = 0;
  }
  get innerHTML() { return this._html; }
  appendChild(c) {
    if (!c || !(c instanceof El)) throw new TypeError('appendChild called with ' + c);
    c.parentNode = this;
    this.children.push(c);
    if (this.tagName === 'SELECT' && c.tagName === 'OPTION') this.options.push(c);
    return c;
  }
  append(...cs) { for (const c of cs) if (c instanceof El) this.appendChild(c); }
  insertBefore(c, ref) {
    const i = ref ? this.children.indexOf(ref) : -1;
    if (i < 0) return this.appendChild(c);
    c.parentNode = this; this.children.splice(i, 0, c); return c;
  }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  replaceChildren(...cs) { this.children.length = 0; this.append(...cs); }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === 'id') this.id = String(v);
    if (k === 'class') this.className = String(v);
  }
  getAttribute(k) { return k === 'class' ? this.className : (k in this.attributes ? this.attributes[k] : null); }
  hasAttribute(k) { return k === 'class' ? !!this.className : k in this.attributes; }
  removeAttribute(k) { delete this.attributes[k]; }
  addEventListener() {} removeEventListener() {}
  focus() {} blur() {} scrollIntoView() {}
  click() { if (typeof this.onclick === 'function') this.onclick({ shiftKey: false, preventDefault() {} }); }
  closest() { return null; }
  getContext(kind) { return kind === '2d' ? (this._ctx || (this._ctx = makeCtx(this))) : null; }
  toDataURL() { return 'data:image/png;base64,'; }
  toBlob(cb) { setTimeout(() => cb(new Blob([new Uint8Array(8)])), 0); }
  getBoundingClientRect() { return { left: 0, top: 0, right: 300, bottom: 300, width: 300, height: 300 }; }
  // A laid-out box. Without these the map viewport measured 0x0, so
  // fitMapToView bailed into its retry loop and the pan/zoom code was never
  // reached by any check here.
  get clientWidth() { return 300; }
  get clientHeight() { return 300; }
  get offsetWidth() { return 300; }
  get offsetHeight() { return 300; }
  get scrollWidth() { return 300; }
  get scrollHeight() { return 300; }
  play() { this.paused = false; } pause() { this.paused = true; }
  _walk(out) { for (const c of this.children) { out.push(c); c._walk(out); } return out; }
  _matches(sel) {
    sel = sel.trim();
    if (sel.startsWith('.')) return this._classes.has(sel.slice(1));
    if (sel.startsWith('#')) return this._id === sel.slice(1);
    if (sel.startsWith('[')) { const k = sel.slice(1, -1).split('=')[0]; return this.hasAttribute(k); }
    return this.tagName === sel.toUpperCase();
  }
  querySelectorAll(sel) {
    // Only the shapes this file uses: "tag", ".class", "#id .class".
    const parts = String(sel).split(/\s+/).filter(Boolean);
    const last = parts[parts.length - 1];
    let scope = [this];
    if (parts.length > 1 && parts[0].startsWith('#')) {
      const root = REGISTRY.get(parts[0].slice(1));
      scope = root ? [root] : [];
    }
    const out = [];
    for (const s of scope) for (const n of s._walk([])) if (n._matches(last)) out.push(n);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

const REGISTRY = new Map();
// Seed every id that exists in the static markup, so an id the JS looks up but
// the markup never declares is reported rather than silently invented.
for (const m of html.matchAll(/\bid="([^"]+)"/g)) REGISTRY.set(m[1], new El('div'));
// The categories live in static markup as <option>s; the nav bar is built from
// them, so they have to be present for anything to be navigable.
const catSel = REGISTRY.get('categorySelect');
catSel.tagName = 'SELECT';
const optionSource = html.slice(html.indexOf('<select id="categorySelect"'), html.indexOf('</select>'));
const CATEGORY_VALUES = [];
for (const m of optionSource.matchAll(/<option value="([^"]+)"[^>]*>([\s\S]*?)<\/option>/g)) {
  const o = new El('option');
  o.value = m[1];
  o.textContent = m[2].replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').trim();
  catSel.appendChild(o);
  CATEGORY_VALUES.push(m[1]);
}
catSel.value = CATEGORY_VALUES[0];
for (const tag of ['canvas', 'audio', 'input', 'select']) void tag;
REGISTRY.get('canvas').tagName = 'CANVAS';
REGISTRY.get('waveform').tagName = 'CANVAS';
REGISTRY.get('audioPlayer').tagName = 'AUDIO';
REGISTRY.get('residSelect').tagName = 'SELECT';
REGISTRY.get('categorySelect').tagName = 'SELECT';

const body = new El('body');
const documentStub = {
  getElementById(id) {
    // An id nobody has created yet gets null, as a browser would give: the
    // page's own create-if-absent branches (ensureDetailLens, the map layers,
    // the inspector boxes) have to run for the element to carry the id, the
    // inline style and the tag the page gives it. This used to hand back a
    // placeholder div instead, which meant the lens under test was a bare
    // div that had never been through ensureDetailLens -- so its cssText was
    // empty and the max-width check failed on a page that was right.
    if (!REGISTRY.has(id)) { missingIds.add(id); return null; }
    return REGISTRY.get(id);
  },
  createElement: t => new El(t),
  createElementNS: (ns, t) => new El(t),
  createDocumentFragment: () => new El('fragment'),
  createTextNode: t => { const e = new El('#text'); e.textContent = t; return e; },
  querySelector: s => body.querySelector(s),
  querySelectorAll: s => body.querySelectorAll(s),
  addEventListener() {}, removeEventListener() {},
  body, head: new El('head'), documentElement: new El('html'),
  fonts: { add() {} },
};

const rafQueue = [];
// Run whatever is waiting on the next frame. Some of the page's work is
// deferred to rAF (fitting a map to the viewport, restoring a remembered
// view), so a check that never drains this queue is checking half the code.
function drainRaf() {
  let n = 0;
  while (rafQueue.length && n++ < 200) { const cb = rafQueue.shift(); try { cb(0); } catch (e) { fail('rAF callback', e); } }
}
const sandbox = {
  document: documentStub, console,
  TextDecoder, TextEncoder, Uint8Array, Int8Array, Int16Array, Uint16Array, Uint32Array,
  Int32Array, Float32Array, Float64Array, Uint8ClampedArray, ArrayBuffer, DataView,
  Math, JSON, Map, Set, WeakMap, Date, Object, Array, String, Number, Boolean, Symbol,
  Error, TypeError, RangeError, RegExp, Promise, isNaN, isFinite, parseInt, parseFloat,
  Infinity, NaN, undefined, URLSearchParams, Intl,
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval() {},
  requestAnimationFrame: cb => { rafQueue.push(cb); return rafQueue.length; },
  cancelAnimationFrame() {},
  fetch: () => Promise.reject(new Error('offline')),
  Blob: globalThis.Blob,
  URL: { createObjectURL: () => 'blob:stub', revokeObjectURL() {} },
  CompressionStream: globalThis.CompressionStream, Response: globalThis.Response,
  matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  indexedDB: undefined,
  location: { hash: '', href: 'file:///viewer.html', search: '', reload() {} },
  // replaceState with a '#…' url really does rewrite location.hash in a
  // browser. Stubbing it as a no-op hid a bug where the page overwrote the
  // link it was opened on before reading it.
  history: {
    replaceState(s, t, url) { if (typeof url === 'string' && url.startsWith('#')) sandbox.location.hash = url; },
    pushState(s, t, url) { this.replaceState(s, t, url); },
  },
  navigator: { userAgent: 'node' },
  performance: { now: () => 0 },
  addEventListener() {}, removeEventListener() {},
  scrollTo() {}, scrollY: 0, innerWidth: 1200, innerHeight: 900,
  alert(msg) { sandbox.__alerts.push(String(msg)); },
  MutationObserver: class { observe() {} disconnect() {} },
  // Fires immediately, as though everything were on screen. The galleries
  // decode their tiles lazily now, so a no-op observer would leave this test
  // counting cells that were created but never decoded -- it would still say
  // "clean" while exercising none of the decoders.
  IntersectionObserver: class {
    constructor(cb) { this.cb = cb; }
    observe(el) { this.cb([{isIntersecting: true, target: el}], this); }
    unobserve() {} disconnect() {}
  },
  getComputedStyle: () => ({ gridTemplateColumns: '96px 96px 96px 96px' }),
  __alerts: [],
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;
const ctx = vm.createContext(sandbox);
try {
  new vm.Script(js + '\n;window.__peek = function(n){ return eval(n); };\n', { filename: htmlPath })
    .runInContext(ctx);
} catch (e) {
  console.error('FATAL: script body threw while loading: ' + e.message);
  process.exit(1);
}
const peek = n => ctx.__peek(n);

// ---- drive it --------------------------------------------------------------
let failures = 0;
const fail = (what, e) => { failures++; console.log('  FAIL ' + what + ' — ' + (e && e.message ? e.message : e)); };

console.log(`  markup ids seeded: ${REGISTRY.size}, categories: ${CATEGORY_VALUES.length}`);

const t0 = Date.now();
try {
  ctx.parseArchiveBytes(archive, 'Cythera Data (smoke test)', { via: 'data fork', rsrc: rsrcFork });
} catch (e) { fail('parseArchiveBytes', e); process.exit(1); }
const status = REGISTRY.get('sourceStatus').textContent;
console.log(`  parseArchiveBytes: ${Date.now() - t0} ms — status "${status.slice(0, 80)}"`);
if (!/Loaded:/.test(status)) fail('status line', 'did not report a load: ' + status);
if (!ctx.__peek('masterIndexGlobal').filter(m => m[0]).length) fail('master index', 'no subindexes');

const wanted = onlyCat ? [onlyCat] : CATEGORY_VALUES;
let galleries = 0, opened = 0, cellsSeen = 0;
for (const v of wanted) {
  const grid = REGISTRY.get('sheetGrid');
  try {
    if (!ctx.showCategory(v)) { fail('showCategory ' + v, 'refused'); continue; }
  } catch (e) { fail('showCategory ' + v, e); continue; }
  galleries++;
  const cells = grid.querySelectorAll('.cell').length + grid.children.length;
  cellsSeen += cells;
  const resids = ctx.CUR_RESIDS || [];
  const out = REGISTRY.get('output').textContent;
  if (!out) fail('gallery ' + v, 'no status text');
  if (!cells) console.log(`  note: category ${v} drew no tiles (${out.slice(0, 60)})`);

  // Open every resource this category lists.
  let localFail = 0;
  for (const entry of resids) {
    try {
      if (!ctx.openResource(entry[0])) { localFail++; continue; }
      opened++;
    } catch (e) {
      localFail++;
      if (localFail <= 2) fail(`open 0x${entry[0].toString(16).toUpperCase()} in ${v}`, e);
    }
  }
  if (localFail > 2) fail(`category ${v}`, `${localFail} resources failed to open`);
  // Back to the gallery, which is also what Esc does.
  try { ctx.returnToSheet(); } catch (e) { fail('returnToSheet from ' + v, e); }
  console.log(`  ${String(v).padEnd(11)} ${String(resids.length).padStart(4)} resources  ${String(cells).padStart(4)} tiles  ${localFail ? localFail + ' FAILED' : 'ok'}`);
}

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
      if (html.includes('record #' + p.rec.index)) named++;
      if (html.includes('Dossier')) withPeople++;
    }
  }
  if (!mapsWithProps) fail('map inspector', 'no map reported any props');
  else if (named !== probes) fail('map inspector', `${probes - named} of ${probes} squares did not name their prop`);
  else console.log(`  map inspector: ${probes} prop squares on ${mapsWithProps} maps, all named`);

  // Characters stand where their schedule puts them, which is not where the
  // prop list puts anything, so they need their own probe.
  let peopleProbes = 0, peopleNamed = 0;
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
    }
  }
  if (!peopleProbes) fail('map inspector', 'no scheduled characters found on any of the first maps');
  else if (peopleNamed !== peopleProbes) fail('map inspector', `${peopleProbes - peopleNamed} of ${peopleProbes} inhabited squares did not link the character`);
  else console.log(`  map inspector: ${peopleProbes} inhabited squares, all linked to their dossier`);
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
  const raw = ctx.getResourceBytes(mapResid);
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
  const watch = peek('ATLAS_HIDDEN').concat(['mapViewport', 'mapStage']);
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
  const vpA = REGISTRY.get('mapViewport');
  if (!sc) fail('atlas', 'no scene was built');
  else if (sc.nodes.some(n => n.depth && !ctx.mapIsLocated(n.resid)))
    /* The scene places what the archive locates and no more. A map's edge
       exit landing on the world is a spatial statement -- this map is
       contiguous with the world at that square -- and it is the only one the
       file makes. A stair or a cave mouth says where you go in, not where the
       place reaches, so drawing the Sewers under nine squares of Cademia was
       a claim the archive does not support. */
    fail('atlas', 'the scene places a map the archive does not locate: ' +
                  sc.nodes.filter(n => n.depth && !ctx.mapIsLocated(n.resid))
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

    /* Everything the archive locates IS in the scene -- the rule cuts both
       ways, and a scene missing the bridge or Pnyx upstairs would be as wrong
       as one containing the Sewers. Those two have no pictogram on the world
       map at all; they are placed at the world square their own edge exit
       names, which is the same statement in the other direction. */
    let located = 0;
    for (let n = 0; n < 0x100; n++) {
      const rid = 0x8000 | n;
      if (rid === 0x8001 || !ctx.refExists(rid) || !ctx.mapIsLocated(rid)) continue;
      located++;
      if (!sc.nodes.some(q => q.resid === rid))
        fail('atlas', `0x${rid.toString(16)} is located by the archive and missing from the scene`);
    }
    if (new Set(sc.nodes.map(n => n.key)).size !== sc.nodes.length)
      fail('atlas', 'two nodes share a key');
    else console.log('  atlas: ' + sc.nodes.length + ' nodes — the world and all ' + located +
                     ' maps the archive locates, and nothing it does not');

    /* The 17 it does not locate are reached through a mouth: a ring on the
       square the archive gives, and a step rather than a zoom, because a
       doorway is what the file says and a position is not. */
    {
      const cadN = sc.nodes.find(n => n.resid === 0x8008);
      const mouths = peek('atlasMouths')(cadN);
      if (!mouths.length) fail('atlas', 'Cademia has no way down');
      else if (mouths.some(m => ctx.mapIsLocated(m.dest.resid)))
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

    /* The furniture out of the way for the atlas -- and Entities > Regions
       left EXACTLY as it was.

       The two share one panel, and the first attempt at putting it back
       restored by setting `display:''` across the list, which is not the same
       thing: half of those elements are hidden and shown by other code for
       its own reasons, so blanket-clearing them turned the World tab's strip
       on inside Regions. What this compares is a snapshot of Regions taken
       before the atlas ever ran against the same view after it, which is the
       requirement stated directly rather than a guess at which of them ought
       to be hidden. */
    {
      ctx.ATLAS_BELOW = [];
      ctx.showCategory('WORLD');               // the atlas has the panel
      const hidden = peek('ATLAS_HIDDEN')
        .filter(id => { const e = ctx.document.getElementById(id);
                        return e && e.style.display !== 'none'; });
      if (hidden.length)
        fail('atlas', 'the panel left its furniture on screen: ' + hidden.join(', '));
      else if ((ctx.document.getElementById('mapViewport') || { style: {} }).style.height !== '80vh')
        fail('atlas', 'the map did not take the room the furniture was using');
      else {
        ctx.jumpToResource(0x8002);            // and gives it back
        const after = snapRegions();
        const diff = after.filter((v, i) => v !== regionsBefore[i]);
        if (diff.length)
          fail('atlas', 'the atlas left residue in Regions: ' +
                        diff.map((v, i) => regionsBefore[after.indexOf(v)] + ' -> ' + v).join(', '));
        else if (ctx.document.body.classList.contains('atlasFull'))
          // The frameless sheet is the World tab's, and only its.
          fail('atlas', 'Regions is still wearing the atlas\'s frameless sheet');
        else if ((ctx.document.getElementById('mapCanvasWrap') || { style: {} }).style.display === 'none')
          /* The one that shipped: renderAtlasView hid the panel's own canvas
             wrapper and nothing put it back, so every map opened in Entities >
             Regions after a visit to the World tab drew into a hidden box.
             Named separately from the snapshot above because it is the
             specific failure, and a broad comparison is easy to render
             vacuous by taking its baseline a moment too late. */
          fail('atlas', 'Regions maps draw into a hidden wrapper after the atlas has had the panel');
        else console.log('  atlas: the panel is stripped for the atlas and Regions gets it ' +
                         'back exactly as it was');
      }
      ctx.showCategory('WORLD');
    }

    // Painting must not throw, and must reach the canvas.
    peek('paintAtlas')();
    const cvA = REGISTRY.get('atlasCanvas');
    if (!cvA || !cvA.width) fail('atlas', 'the scene painted nothing');
    else console.log('  atlas: the scene paints into one ' + cvA.width + 'x' + cvA.height +
                     ' canvas, redrawn rather than slid');
  }
} catch (e) { fail('atlas', e); }

// Opening a second archive must not leave the first one's derived tables
// behind. Sentinels survive only if something is not being reset.
try {
  const marked = ['SCHEDULES', 'CHAR_TABLE', 'LIVING_PROPTYPES', '_CHAR_PROPTYPES',
                  'TERRAIN_NAMES', 'ZONE_NAMES', 'ZONEPORTS', 'STORE_SYMBOLS',
                  'XREF_INDEX', 'SCRIPT_TEXT', 'MONSTER_STATS', 'RESOURCE_SYMBOLS',
                  'EDITED_RESIDS', 'CONV_CACHE'];
  for (const k of marked) ctx[k] = '__stale__';
  peek('tileCanvasCache').set(-1, '__stale__');
  ctx._dvmStrMemo.set(-1, '__stale__');
  peek('spriteCountCache').set(-1, '__stale__');
  peek('pathCache').set('__stale__', 1);
  peek('_tileImageCache')['-1'] = '__stale__';
  ctx.parseArchiveBytes(archive, 'Cythera Data (reloaded)', { via: 'data fork' });
  const survivors = marked.filter(k => ctx[k] === '__stale__');
  for (const [name, present] of [
    ['tileCanvasCache', peek('tileCanvasCache').has(-1)],
    ['_dvmStrMemo', ctx._dvmStrMemo.has(-1)],
    ['spriteCountCache', peek('spriteCountCache').has(-1)],
    ['pathCache', peek('pathCache').has('__stale__')],
    ['_tileImageCache', '-1' in peek('_tileImageCache')],
  ]) if (present) survivors.push(name);
  if (survivors.length) fail('archive swap', 'stale after reload: ' + survivors.join(', '));
  else console.log(`  archive swap: all ${marked.length + 4} derived caches were dropped`);
} catch (e) { fail('archive swap', e); }

// The edit path: change one plaintext byte of an encrypted resource, let
// applyResourceEdit rebuild the whole archive through writeDelverArchive,
// and confirm the rebuilt file serves the edit back -- decrypted -- while
// everything else survives. This is the only check that drives editing, so
// anything new that writes belongs in it.
try {
  // Any resource of subindex 1 (known_encrypted) proves re-encryption.
  const specBefore = peek('delverArchiveSpec')(peek('fileBytes'));
  const countBefore = specBefore.resources.length;
  const resid = specBefore.resources.find(r => (r.resid >> 8) === 2).resid;
  const before = ctx.smartDecrypt(ctx.getResourceBytes(resid), resid).data;
  const edited = Uint8Array.from(before);
  edited[0] = edited[0] ^ 0xFF;
  if (!ctx.applyResourceEdit(resid, edited)) throw new Error('applyResourceEdit returned false');
  const raw = ctx.getResourceBytes(resid);
  const after = ctx.smartDecrypt(raw, resid).data;
  if (Buffer.from(after).toString('hex') !== Buffer.from(edited).toString('hex'))
    fail('edit path', 'rebuilt archive does not serve the edited bytes back');
  else if (Buffer.from(raw).toString('hex') === Buffer.from(edited).toString('hex'))
    fail('edit path', 'edited bytes were stored plaintext in an encrypted subindex');
  else if (!ctx.EDITED_RESIDS || !ctx.EDITED_RESIDS.has(resid))
    fail('edit path', 'the dirty list did not survive the rebuild');
  else {
    const countAfter = peek('delverArchiveSpec')(peek('fileBytes')).resources.length;
    if (countAfter !== countBefore) fail('edit path', `resource count moved: ${countBefore} -> ${countAfter}`);
    else console.log(`  edit path: 0x${resid.toString(16).toUpperCase()} edited, re-encrypted, and served back from a ${peek('fileBytes').length}-byte rebuild`);
  }
} catch (e) { fail('edit path', e); }

// Structured prop editing: move one prop record one square east through
// applyPropRecordEdit and confirm the rebuilt archive serves the list back
// with exactly that field changed -- same record count, neighbours
// byte-identical.
try {
  const propResid = peek('delverArchiveSpec')(peek('fileBytes')).resources
    .map(r => r.resid).find(r => (r >> 8) === 0x81);
  const parse = () => ctx.parseDelverPropList(
    ctx.smartDecrypt(ctx.getResourceBytes(propResid), propResid).data);
  const before = parse();
  const idx = before.findIndex(r => r.onMap);
  const want = { x: before[idx].x + 1 };
  if (!ctx.applyPropRecordEdit(propResid, idx, want)) throw new Error('applyPropRecordEdit returned false');
  const after = parse();
  if (after.length !== before.length) fail('prop edit', `record count moved: ${before.length} -> ${after.length}`);
  else if (after[idx].x !== want.x || after[idx].y !== before[idx].y)
    fail('prop edit', `record ${idx} came back at ${after[idx].x},${after[idx].y}`);
  else {
    const other = (idx + 1) % before.length;
    const same = JSON.stringify(after[other]) === JSON.stringify(before[other]);
    if (!same) fail('prop edit', `record ${other} changed although only ${idx} was edited`);
    else console.log(`  prop edit: record ${idx} of 0x${propResid.toString(16).toUpperCase()} moved one square east through a full rebuild`);
  }
} catch (e) { fail('prop edit', e); }

// The ditherizer's data path: dither a synthetic image to the palette,
// DCG-encode it, write it into a real portrait slot through the full
// rebuild, and confirm the rebuilt archive decodes it back pixel for pixel.
try {
  const rgba = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    rgba[i * 4] = (i * 7) & 0xFF; rgba[i * 4 + 1] = (i * 13) & 0xFF;
    rgba[i * 4 + 2] = 96; rgba[i * 4 + 3] = i < 64 ? 0 : 255;   // first row transparent
  }
  const indexed = ctx.ditherToCytheraPalette(rgba, 64, 64, {});
  if (indexed.slice(0, 64).some(v => v !== 0)) throw new Error('transparent pixels not on slot 0');
  for (let i = 64; i < indexed.length; i++) {
    if (indexed[i] === 0) throw new Error('opaque pixel landed on the transparent slot');
    if (indexed[i] >= 0xE0 && indexed[i] <= 0xFB) throw new Error('opaque pixel landed on an animated ramp');
  }
  const resid = 0x8805;
  if (!ctx.applyResourceEdit(resid, ctx.encodeDCGLiterals(indexed)))
    throw new Error('applyResourceEdit refused the portrait');
  const back = ctx.decompressDCG(
    ctx.smartDecrypt(ctx.getResourceBytes(resid), resid).data, 64, 64);
  if (Buffer.from(back).toString('hex') !== Buffer.from(indexed).toString('hex'))
    fail('ditherize', 'rebuilt archive does not decode the dithered portrait back');
  else console.log('  ditherize: a dithered 64x64 portrait wrote into 0x8805 and decoded back exactly');
} catch (e) { fail('ditherize', e); }

// The installer. The page's default input is the whole game as one file,
// and three views exist only when it arrived that way: Data › Installer, and
// the two Combat AI tabs, which were placeholders before. Opened through
// adoptArchive -- the path a dropped file takes -- so that the application's
// fork gallery is also drawn here from the installer, without the fetch the
// bare-archive run above cannot make.
if (visePath && existsSync(visePath) && !onlyCat) {
  try {
    const bin = new Uint8Array(readFileSync(visePath));
    if (!ctx.adoptArchive(bin, 'Cythera.bin', {})) throw new Error(peek('lastArchiveError'));
    if (!ctx.INSTALLER) throw new Error('INSTALLER not set after adopting the installer');
    const drawn = {};
    for (const v of ['INSTALLER', 'AISCRIPTS', 'AIRULES', 'APPRSRC']) {
      if (!ctx.showCategory(v)) { fail('installer view ' + v, 'refused'); continue; }
      const grid = REGISTRY.get('sheetGrid');
      const n = (grid.children || []).length;
      drawn[v] = n;
      if (!n) fail('installer view ' + v, 'drew nothing: ' + REGISTRY.get('output').textContent.slice(0, 80));
    }
    const rows = (REGISTRY.get('sheetGrid').children || []);
    // Read the licence through the button the table offers, then take a file away.
    ctx.showCategory('INSTALLER');
    const arc = ctx.INSTALLER.archive;
    const lic = arc.entries.find(e => /License/.test(e.name));
    ctx.showInstallerText(lic.index);
    const pre = REGISTRY.get('installerText');
    if (!pre || !/Cythera/.test(pre.textContent)) fail('installer text', 'the licence did not render');
    const saved = ctx.__downloads ? ctx.__downloads.length : -1;
    ctx.downloadInstallerFile(arc.entries.find(e => /Notes/.test(e.name)).index);
    const tabs = ['combatai', 'aiscripts', 'airules'].map(id => peek('TAB_BY_ID').get(id).wip);
    if (tabs.some(Boolean)) fail('installer tabs', 'the Combat AI tabs are still faded with the files present');
    // The open release is named on the tab, on the Data file button and at
    // the head of the sheet; Installer stands first under Data, and Data
    // still opens on Cythera Data.
    ctx.showCategory('INSTALLER');
    const badge = REGISTRY.get('installerVersionBadge');
    const btn = REGISTRY.get('archiveMenuBtn');
    if (!badge || !/^\d+(\.\d+)+$/.test(badge.textContent)) fail('installer version', 'no version badge on the Installer tab');
    if (!btn || !/^Cythera \d/.test(btn.textContent)) fail('installer version', 'the Data file button does not name the release: ' + (btn && btn.textContent));
    const opened = (REGISTRY.get('sheetGrid').children || []).find(c => c.className && /installerOpen/.test(c.className));
    if (!opened) fail('installer version', 'the sheet does not say which installer is open');
    const dataNode = peek('TAB_BY_ID').get('data');
    if (dataNode.children[0].id !== 'installer') fail('installer tab', 'Installer is not first under Data');
    // A folder reopens where it was left (here: the Installer tab, just
    // visited), and its declared starting point is Cythera Data, not the
    // first child -- that is what `last:` in the tree is for.
    ctx.showCategory('135');
    ctx.selectTab('data');
    if (REGISTRY.get('categorySelect').value !== 'INSTALLER') fail('installer tab', 'Data did not reopen where it was left: ' + REGISTRY.get('categorySelect').value);
    if (!/id: 'data',[^\n]*last: 'cytheradata'/.test(js)) fail('installer tab', 'the Data folder no longer declares Cythera Data as where it opens first');
    // A file with several versions: the chips are drawn and one of them
    // opens another release through the whole load path.
    if (ctx.INSTALLER.installers.length > 1) {
      ctx.showCategory('INSTALLER');
      const chips = (REGISTRY.get('sheetGrid').children || []).filter(c => c.className && /installerVersions/.test(c.className));
      if (!chips.length) fail('installer versions', 'no version row drawn for a file with ' + ctx.INSTALLER.installers.length + ' installers');
      const before = peek('fileBytes').length;
      ctx.switchInstaller('Cythera 1.0.1 Installer');
      const after = peek('fileBytes').length;
      if (ctx.INSTALLER.picked !== 'Cythera 1.0.1 Installer' || after === before)
        fail('installer versions', `switch to 1.0.1 left ${ctx.INSTALLER.picked} open (${before} -> ${after} bytes)`);
      else console.log(`  installer versions: ${ctx.INSTALLER.installers.length} in the file; 1.0.1 opened, ${before} -> ${after} bytes, status "${REGISTRY.get('sourceStatus').textContent.slice(0, 70)}"`);
      // Every gallery again, on the oldest release.
      let bad = 0;
      for (const v of CATEGORY_VALUES) { try { if (!ctx.showCategory(v)) bad++; } catch (e) { bad++; if (bad <= 2) fail('1.0.1 gallery ' + v, e); } }
      if (bad) fail('installer versions', bad + ' galleries failed on 1.0.1');
    }
    console.log(`  installer: ${arc.entries.length} files; views drew ${Object.entries(drawn).map(([k, n]) => k + '=' + n).join(' ')}; licence read; a .bin offered${saved >= 0 ? ' (' + (ctx.__downloads.length - saved) + ' download)' : ''}`);
  } catch (e) { fail('installer', e); }
}

while (rafQueue.length) { const cb = rafQueue.shift(); try { cb(0); } catch (e) { fail('rAF callback', e); } }

console.log(`\n  ${galleries} galleries, ${cellsSeen} tiles, ${opened} resources opened in ${Date.now() - t0} ms`);
if (missingIds.size) console.log('  ids looked up but not in the markup: ' + [...missingIds].join(', '));
if (ctx.__alerts.length) console.log('  alert() calls: ' + ctx.__alerts.length);
console.log(failures ? `\nFAIL — ${failures} problem(s)` : '\nviewer smoke: clean');
process.exit(failures ? 1 : 0);
