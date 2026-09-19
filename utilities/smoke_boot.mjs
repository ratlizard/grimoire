// smoke_boot.mjs -- what every part of the UI smoke starts from: the page
// loaded into a small DOM, the archive fed through parseArchiveBytes, and
// the helpers the parts drive it with. viewer_smoke.mjs is the runner; the
// parts are smoke_galleries.mjs, smoke_atlas.mjs, smoke_rules.mjs,
// smoke_edits.mjs, smoke_saves.mjs and smoke_installer.mjs, cut out of the
// one 4,100-line file on 18 September 2026 at the points where the open file
// changes, so each can run as its own process and the six run at once.
//
// Importing this module does the boot: it reads the arguments, builds the
// DOM, runs the page's scripts and opens the archive, once per process. A
// part imports it and drives on; the runner imports it and then the parts.
//
// This is a stand-in, not a browser. It is deliberately strict where that
// catches real mistakes (unknown getElementById targets are recorded,
// appendChild(undefined) throws) and lax where the browser's behaviour does
// not change the outcome (layout, painting, fonts). browser_check.mjs is
// the page in a real browser.
//
// The DOM below is a stand-in, not a browser. It is deliberately strict where
// that catches real mistakes (unknown getElementById targets are recorded,
// appendChild(undefined) throws) and lax where the browser's behaviour does
// not change the outcome (layout, painting, fonts).

import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import {pageSource, describeScripts} from './page_scripts.mjs';
import {makeCanvasContext} from './dom_stub.mjs';

const [htmlPath, dataPath, onlyCat, visePath, savePath] = process.argv.slice(2);
export const PARTS = process.argv.slice(7);
if (!htmlPath || !dataPath) {
  console.error('usage: viewer_smoke.mjs <viewer.html> <Cythera Data.data> [category] [Cythera.bin] [a saved game] [part ...]');
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
    // A node that already has a parent MOVES, as in a browser. Without this
    // applyGalleryArrangement, which re-appends the gallery's own cells to
    // put them in order, left the grid holding every cell twice per pass --
    // four copies after a category walk -- and every tile count and every
    // heading count read from the grid was inflated by it.
    if (c.parentNode && c.parentNode.children) {
      const i = c.parentNode.children.indexOf(c);
      if (i >= 0) c.parentNode.children.splice(i, 1);
    }
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
export const tally = { failures: 0 };
const fail = (what, e) => { tally.failures++; console.log('  FAIL ' + what + ' — ' + (e && e.message ? e.message : e)); };

console.log(`  markup ids seeded: ${REGISTRY.size}, categories: ${CATEGORY_VALUES.length}`);

const t0 = Date.now();
try {
  ctx.parseArchiveBytes(archive, 'Cythera Data (smoke test)', { via: 'data fork', rsrc: rsrcFork });
} catch (e) { fail('parseArchiveBytes', e); process.exit(1); }
const status = REGISTRY.get('sourceStatus').textContent;
console.log(`  parseArchiveBytes: ${Date.now() - t0} ms — status "${status.slice(0, 80)}"`);
if (!/Loaded:/.test(status)) fail('status line', 'did not report a load: ' + status);
if (!ctx.__peek('ARCHIVE.index').filter(m => m[0]).length) fail('master index', 'no subindexes');
// The open archive, read afresh each time: parseArchiveBytes replaces the
// object, and every reload and edit below goes through it.
const A = () => ctx.__peek('ARCHIVE');

/* The end of a run, whichever parts it drove: the deferred frame callbacks
   run, what fell back quietly is printed (not pinned: the stub throws where
   a browser would not, and the list is for reading), and the verdict. */
export function finish(parts) {
  while (rafQueue.length) { const cb = rafQueue.shift(); try { cb(0); } catch (e) { fail('rAF callback', e); } }
  const qf = peek('QUIET_FAILURES');
  console.log(`  quiet failures over the drive: ${qf.size} distinct`);
  for (const [m, v] of [...qf].sort((a, b) => b[1].count - a[1].count).slice(0, 12)) console.log(`    ${v.count}x ${m.slice(0, 110)}${v.where ? '  <- ' + v.where.replace(/^\s*at /, '').slice(-70) : ''}`);
  if (missingIds.size) console.log('  ids looked up but not in the markup: ' + [...missingIds].join(', '));
  if (ctx.__alerts.length) console.log('  alert() calls: ' + ctx.__alerts.length);
  const which = parts.length ? parts.join(', ') : 'all parts';
  console.log(tally.failures ? `\nFAIL — ${tally.failures} problem(s) (${which})` : `\nviewer smoke (${which}): clean in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  process.exit(tally.failures ? 1 : 0);
}

export { htmlPath, dataPath, onlyCat, visePath, savePath, html, js, archive, rsrcPath, rsrcFork, missingIds,
         El, REGISTRY, catSel, optionSource, CATEGORY_VALUES, body, documentStub, rafQueue, drainRaf, sandbox,
         ctx, peek, fail, t0, status, A, readFileSync, existsSync };

