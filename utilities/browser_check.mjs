#!/usr/bin/env node
/* browser_check.mjs -- the page in a real browser, which no other harness
 * here is.
 *
 *   node utilities/browser_check.mjs index.html canvas.html ["reference/game/Cythera Data.hqx"]
 *
 * Every other check runs the page's scripts inside node:vm against a
 * hand-written DOM, and they run the scripts as ONE string, in which a
 * function hoists across the whole. So a load-order fault -- a top-level
 * statement in an earlier <script src> reading something a later file
 * declares -- passes every one of them and throws in a browser. Until
 * 18 September 2026 the only load-order check was a person running headless
 * Chrome by hand after a split; this is that, in the suite. The stub also
 * cannot see a stylesheet, a real canvas, or an exception a browser raises
 * that the stub does not, which is why the holistic review's findings were
 * all in what is drawn or said.
 *
 * What it does: serves the repository over HTTP on a loopback port (a
 * file:// page cannot fetch its own archive; served, it can), opens each
 * page in headless Chrome, listens to its console and its exceptions, waits
 * for the thing the page is meant to do, and requires:
 *
 *   - no console error and no uncaught exception on index.html's load, and
 *     the brand line drawn by the last script to run, which is what a
 *     load-order fault stops;
 *   - the archive, when the game is in reference/, opened through the page's
 *     own ?src= path over HTTP: the title line says so, the world is up, and
 *     the quiet failures that arrived on the way are counted -- each is a
 *     `quietly:` console warning, since the page is loaded with ?loud=1
 *     (quiet() in js/mac-bytes.js);
 *   - canvas.html loads with no console error, which is the only check that
 *     page has ever had in the suite.
 *
 * HOW CHROME IS DRIVEN. Over its DevTools protocol on a pipe
 * (--remote-debugging-pipe: JSON messages on fds 3 and 4, NUL-terminated),
 * with no library: create a target, attach, enable Runtime, Log and Page,
 * navigate, poll an expression until it is true or the deadline passes,
 * read the DOM, close the browser. The first version used --dump-dom with
 * a virtual-time budget and hung for two minutes on every page, whatever
 * the page did -- the process wrote the DOM and did not exit -- so the
 * browser is closed from here and killed if it will not go.
 *
 * Chrome is found through $CHROME, then the PATH, then the Mac's
 * Applications folder; without one the check skips and says so, which
 * check_all.mjs also arranges by listing the binary under `want`. */

import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync, mkdtempSync, mkdirSync, rmSync, createReadStream, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const [indexPage = 'index.html', canvasPage = 'canvas.html', archive] = process.argv.slice(2);

export function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { const p = execFileSync('sh', ['-c', `command -v ${name}`], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); if (p) return p; } catch (e) { /* not on the path */ }
  }
  for (const p of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
                   '/Applications/Chromium.app/Contents/MacOS/Chromium',
                   `${process.env.HOME}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`])
    if (existsSync(p)) return p;
  return null;
}

const CHROME = findChrome();
if (!CHROME) { console.log('  skip: no Chrome or Chromium found ($CHROME, the PATH, /Applications)'); process.exit(0); }

// ---- a static server over the repository ----------------------------------
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css',
               '.png': 'image/png', '.json': 'application/json', '.wasm': 'application/wasm'};
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url || '/').split('?')[0]);
  const file = resolve(ROOT, '.' + path);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  let st; try { st = statSync(file); } catch (e) { res.writeHead(404); res.end(); return; }
  if (!st.isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Content-Length': st.size});
  createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

// ---- the browser, over the pipe ---------------------------------------------
class Browser {
  constructor() {
    this.profile = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'grimoire-chrome-'));
    this.proc = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
      '--disable-extensions', '--disable-background-networking', '--disable-sync', '--remote-debugging-pipe',
      `--user-data-dir=${this.profile}`, 'about:blank'],
      {stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe']});
    this.next = 1; this.waiting = new Map(); this.listeners = [];
    let buf = '';
    this.proc.stdio[4].setEncoding('utf8');
    this.proc.stdio[4].on('data', chunk => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\0')) >= 0) {
        const msg = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
        if (msg.id && this.waiting.has(msg.id)) { const {res, rej} = this.waiting.get(msg.id); this.waiting.delete(msg.id); msg.error ? rej(new Error(msg.error.message)) : res(msg.result); }
        else if (msg.method) for (const l of this.listeners) l(msg);
      }
    });
    this.exited = new Promise(r => this.proc.on('exit', r));
  }
  // Every call has a deadline. Under the suite, with four processes at
  // full tilt, one run of this check sat ten minutes on a call Chrome never
  // answered (19 September 2026); a hang is a failure here, not a wait.
  send(method, params = {}, sessionId) {
    const id = this.next++;
    const p = new Promise((res, rej) => {
      const t = setTimeout(() => { this.waiting.delete(id); rej(new Error(method + ' was not answered in 30 s')); }, 30000);
      this.waiting.set(id, {res: v => { clearTimeout(t); res(v); }, rej: e => { clearTimeout(t); rej(e); }});
    });
    this.proc.stdio[3].write(JSON.stringify({id, method, params, sessionId}) + '\0');
    return p;
  }
  on(fn) { this.listeners.push(fn); }
  async close() {
    try { await Promise.race([this.send('Browser.close'), new Promise(r => setTimeout(r, 3000))]); } catch (e) { /* closing anyway */ }
    const gone = await Promise.race([this.exited.then(() => true), new Promise(r => setTimeout(() => r(false), 3000))]);
    if (!gone) try { this.proc.kill('SIGKILL'); } catch (e) { /* already gone */ }
    try { rmSync(this.profile, {recursive: true, force: true}); } catch (e) { /* a temp dir */ }
  }
}

/* Open a page, wait until `until` (an expression evaluated in the page) is
   true or the deadline passes, and return the DOM and what the console and
   the exception stream said. Each page is a fresh browser, so nothing is
   remembered between loads or from a previous run. */
async function load(url, until, deadlineMs, opts = {}) {
  const b = new Browser();
  const console_ = [];
  // The whole load under one deadline as well, whatever stalls inside it.
  let killer;
  const overall = new Promise((_, rej) => { killer = setTimeout(() => rej(new Error('the load did not finish in ' + Math.round((deadlineMs + 60000) / 1000) + ' s')), deadlineMs + 60000); });
  try {
    return await Promise.race([overall, drive()]);
  } catch (e) {
    return {dom: '', console: console_.concat([{level: 'exception', text: e.message, where: 'browser_check'}]), met: false, ms: 0};
  } finally { clearTimeout(killer); await b.close(); }
  async function drive() {
    const {targetId} = await b.send('Target.createTarget', {url: 'about:blank'});
    const {sessionId} = await b.send('Target.attachToTarget', {targetId, flatten: true});
    const s = (m, p) => b.send(m, p, sessionId);
    b.on(msg => {
      if (msg.sessionId !== sessionId) return;
      if (msg.method === 'Runtime.consoleAPICalled')
        console_.push({level: msg.params.type, text: msg.params.args.map(a => a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' ')});
      else if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params.exceptionDetails;
        console_.push({level: 'exception', text: (d.exception && d.exception.description) || d.text, where: (d.url || '') + ':' + (d.lineNumber + 1)});
      } else if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error')
        console_.push({level: 'error', text: msg.params.entry.text + (msg.params.entry.url ? ' ' + msg.params.entry.url.replace(base, '') : '')});
    });
    await s('Runtime.enable'); await s('Log.enable'); await s('Page.enable');
    if (opts.device) {
      await s('Emulation.setDeviceMetricsOverride', {width: opts.device.width, height: opts.device.height, deviceScaleFactor: opts.device.scale || 2, mobile: true});
      await s('Emulation.setTouchEmulationEnabled', {enabled: true, maxTouchPoints: 5});
    }
    await s('Page.navigate', {url});
    const t0 = Date.now();
    let met = false;
    while (Date.now() - t0 < deadlineMs) {
      try { const r = await s('Runtime.evaluate', {expression: until, returnByValue: true}); if (r.result && r.result.value) { met = true; break; } } catch (e) { /* not ready */ }
      await new Promise(r => setTimeout(r, 200));
    }
    const dom = await s('Runtime.evaluate', {expression: 'document.documentElement.outerHTML', returnByValue: true});
    // A hook to drive the page further and take screenshots once it is up:
    // evaluate(expr) runs in the page and returns the value, shot(path)
    // writes a PNG of the viewport.
    let more = null;
    if (opts.then && met) more = await opts.then({
      evaluate: async expr => { const r = await s('Runtime.evaluate', {expression: expr, returnByValue: true, awaitPromise: true}); return r.result ? r.result.value : undefined; },
      shot: async path => { const r = await s('Page.captureScreenshot', {format: 'png'}); writeFileSync(path, Buffer.from(r.data, 'base64')); return path; },
    });
    return {dom: (dom.result && dom.result.value) || '', console: console_, met, ms: Date.now() - t0, more};
  }
}

// And the process itself: nothing here may outlive ten minutes.
const watchdog = setTimeout(() => { console.log('\nFAIL — the browser check did not finish in ten minutes'); process.exit(1); }, 600000);

let failures = 0;
const fail = (what, why) => { failures++; console.log(`  FAIL ${what} — ${why}`); };
const text = html => html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
// The browser asks for a favicon the site does not ship, and its 404 is
// the one error every load logs; it is not the page's doing and is left out.
const errors = c => c.filter(l => (l.level === 'error' || l.level === 'exception') && !/favicon\.ico/.test(l.text));
const describe = l => (l.where ? l.where + ' ' : '') + l.text.split('\n')[0].slice(0, 160);
const quietOnes = c => c.filter(l => l.level === 'warning' && /^quietly:/.test(l.text));

// ---- 1. index.html loads, and the last script ran ------------------------
// A fresh load ends one of two ways, both right: the gate, when the page
// would have to go to the network for a file, or the installer opened, when
// a copy is served beside the page (LOCAL_ARCHIVE_CANDIDATES) -- which it is
// on a checkout with the game in reference/, so here the first load is the
// whole installer path over HTTP, VISE extraction and all.
{
  const r = await load(base + indexPage + '?cache=skip&loud=1',
    'document.querySelector("#brand .brandVer") !== null && ((document.getElementById("landingGate") || {style: {}}).style.display === "flex" || /^(Title: |Archive error)/.test(document.getElementById("output").textContent) || document.getElementById("sourceStatus").classList.contains("failed"))', 90000);
  const errs = errors(r.console);
  const title = text((/id="output"[^>]*>([\s\S]*?)<\/pre>/.exec(r.dom) || ['', ''])[1]).trim();
  const gate = /id="landingGate" style="display: flex;/.test(r.dom);
  if (errs.length) fail('index.html', 'console errors on load: ' + errs.map(describe).join(' | '));
  else if (!r.met) fail('index.html', 'neither the gate nor a file came up in 90 s: output says "' + title.slice(0, 100) + '"');
  else if (!gate && !/^Title: /.test(title)) fail('index.html', 'the load ended without the gate and without a file: ' + title.slice(0, 120));
  else console.log(`  index.html: loads clean in a browser in ${r.ms} ms, the brand line is drawn and ${gate ? 'the gate stands' : 'the installer beside the page opened (' + title.slice(0, 50) + ')'}; ${quietOnes(r.console).length} quiet failures`);
}

// ---- 2. the archive opens over HTTP --------------------------------------
/* With the archive open, the Seldane rasteriser against a face whose answer
   is known: each strike written as a TrueType by the panel's own export
   (nfntToTrueType, one pixel to 64 units), loaded as a FontFace, and drawn
   back into the strike by rebuildStrike. A faithful rasteriser gives the
   strike back: the same metrics, location table, offset/width table and
   every bit inside the glyph columns. Not the same bytes: both shipped
   strikes carry some sixty lit bits in the row padding past their last
   glyph, which nothing reads and a rewrite writes as zero. This is the only
   harness with real fonts, which is why it is here. Added 26 September 2026,
   when it was the control that showed the rasteriser drew every letter two
   thirds of its height and a column to the left; the control below, the
   sizing it replaced, must fail, or the check could not tell. */
const SELDANE_ROUND_TRIP = `(async () => { try {
  const fork = window.CYTHERA_RSRC; const strikes = seldaneStrikes() || [];
  const bits = (s, y, x) => (s.strike[y * s.rowWords * 2 + (x >> 3)] >> (7 - (x & 7))) & 1;
  const whole = (a, b) => {
    for (const k of ['firstChar', 'lastChar', 'widMax', 'kernMax', 'nDescent', 'fRectWidth', 'fRectHeight', 'ascent', 'descent', 'leading'])
      if (a[k] !== b[k]) return k + ' ' + b[k] + ' for ' + a[k];
    if (a.loc.join() !== b.loc.join()) return 'the location table';
    if (a.ow.join() !== b.ow.join()) return 'the offset/width table';
    const end = a.loc[a.nGlyphs];
    for (let y = 0; y < a.fRectHeight; y++) for (let x = 0; x < end; x++) if (bits(a, y, x) !== bits(b, y, x)) return 'the bit at (' + x + ', ' + y + ')';
    return '';
  };
  const out = [];
  for (const e of strikes) {
    const spec = nfntSpec(fork.dataOf('NFNT', e));
    const fam = 'RoundTrip' + e.id;
    const ttf = nfntToTrueType(spec, { family: fam });
    const bytes = ttf instanceof Uint8Array ? ttf : new Uint8Array(await ttf.arrayBuffer());
    const face = new FontFace(fam, bytes.slice().buffer); await face.load(); document.fonts.add(face);
    const why = whole(spec, nfntSpec(writeNFNT(rebuildStrike(spec, fam))));
    const keep = strikeFit; strikeFit = s => ({ px: s.fRectHeight - s.descent, base: s.ascent });
    let control; try { control = !whole(spec, nfntSpec(writeNFNT(rebuildStrike(spec, fam)))); } finally { strikeFit = keep; }
    let letters = 0; for (let i = 0; i < spec.nGlyphs - 1; i++) if (spec.loc[i + 1] > spec.loc[i]) letters++;
    out.push({ id: e.id, same: !why, why, control, letters });
  }
  return { strikes: out };
} catch (e) { return { error: e.message }; } })()`;
let opened = 'no archive given', seldane = 'not run';
if (archive && existsSync(resolve(ROOT, archive))) {
  const r = await load(base + indexPage + '?cache=skip&loud=1&src=' + encodeURIComponent(archive),
    '/^(Title: |Archive error)/.test(document.getElementById("output").textContent) || document.getElementById("sourceStatus").classList.contains("failed")', 90000,
    { then: ({evaluate}) => evaluate(SELDANE_ROUND_TRIP) });
  const errs = errors(r.console), quiet = quietOnes(r.console);
  const title = text((/id="output"[^>]*>([\s\S]*?)<\/pre>/.exec(r.dom) || ['', ''])[1]).trim();
  const status = text((/id="sourceStatus"[^>]*>([\s\S]*?)<\/(?:pre|div|span)>/.exec(r.dom) || ['', ''])[1]).trim();
  if (errs.length) fail('archive over http', 'console errors: ' + errs.map(describe).join(' | '));
  else if (!/^Title: /.test(title)) fail('archive over http', 'the page did not open the archive' + (r.met ? '' : ' in 90 s') + ': output says "' + title.slice(0, 100) + '"; status: ' + status.slice(0, 160));
  else if (!/id="atlasPanel" style="display: (block|flex|grid)/.test(r.dom))
    fail('archive over http', 'the world did not come up after the archive opened: ' + (r.dom.match(/id="atlasPanel"[^>]*/) || ['no atlas panel'])[0]);
  else if (!r.more || r.more.error) fail('seldane round trip', 'it did not run: ' + (r.more ? r.more.error : 'no result'));
  else if (!r.more.strikes.length) fail('seldane round trip', 'the fork has no NFNT to rewrite');
  else if (r.more.strikes.some(t => !t.same)) fail('seldane round trip', 'a strike rewritten from its own TrueType is not the strike: ' + r.more.strikes.map(t => t.id + ' ' + t.why).join('; '));
  else if (r.more.strikes.some(t => t.control)) fail('seldane round trip', 'the control, the sizing this replaced, gave a strike back too, so the check cannot tell');
  else {
    seldane = 'both Seldane strikes rewritten from their own TrueType come back whole (' + r.more.strikes.map(t => t.letters + ' letters').join(', ') + ') and the old sizing does not';
    console.log('  ' + seldane);
    opened = `the archive opens over http in ${r.ms} ms (${title.slice(0, 60)}), ${quiet.length} quiet failures on the way`;
    console.log('  ' + opened);
    for (const l of quiet.slice(0, 8)) console.log('    ' + l.text.slice(0, 140));
  }
} else console.log('  ' + (archive ? 'no archive at ' + archive : 'no archive given') + ', so the open-over-http half is not run');

// ---- 3. the page at phone width ---------------------------------------------
// The maintainer reviews every revision on an iPhone, and five handoff items
// are "unjudged on a screen". This is the part of that a check can do: the
// archive opened at 390 by 844 with touch emulated (an iPhone 14's points),
// then the views he keeps having to visit, each measured and photographed.
// Measured: the page must not be wider than the phone (a horizontal scroll
// is the layout fault a phone shows first), and no visible element may
// reach past its right edge; tap targets under 24 px tall are counted and
// reported, not failed, since the site's chips are small by design. The
// screenshots go to $TMPDIR/grimoire_shots/, one per view, to be looked at
// instead of the phone; they are evidence for a person, not a pin.
const SHOTS = join(process.env.TMPDIR || tmpdir(), 'grimoire_shots');
let phone = 'not run';
if (archive && existsSync(resolve(ROOT, archive))) {
  mkdirSync(SHOTS, {recursive: true});
  const VIEWS = [
    ['world', ''],
    ['hero', "showCategory('CHARACTERS'); showCharacterDetail(1)"],
    ['prop', "showCategory('PROPS'); showPropTypeDetail(76)"],
    ['mechanics', "showCategory('MECHANICS')"],
    ['skills', "showCategory('SKILLS')"],
    ['tools', "showCategory('TOOLS')"],
    ['dataFork', "showCategory('DATAFORK')"],
    // A script's page: the head, the one row of views and the code, which
    // scrolls sideways inside its pane rather than widening the page.
    ['script', "setScriptFold('structured'); jumpToResource(0x1A13)"],
    // A zone: the map, its toggles and the square panel (22 September 2026,
    // when the toggles moved up under the map).
    ['zone', "jumpToResource(0x8003); document.getElementById('charControls').scrollIntoView()"],
    // The dialogue tab, whose cards carry wide tables.
    ['dialogue', "showCategory('23'); document.querySelector('#sheetGrid details').open = true; document.querySelector('#sheetGrid details').scrollIntoView()"],
  ];
  const MEASURE = `(() => {
    const w = window.innerWidth, out = {innerWidth: w, scrollWidth: document.documentElement.scrollWidth, over: [], small: 0, buttons: 0};
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      // Inside something that scrolls sideways on purpose -- the tab strips,
      // a wide table in its wrapper -- an element past the edge is what the
      // scroll is for; it is only a fault when nothing between it and the
      // page scrolls.
      let scroller = false;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const o = getComputedStyle(a).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { scroller = true; break; } }
      if (r.right > w + 1 && cs.position !== 'fixed' && !scroller && out.over.length < 6)
        out.over.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : '') + ' right=' + Math.round(r.right));
      if ((el.tagName === 'BUTTON' || el.tagName === 'A') && r.height < 24) out.small++;
      if (el.tagName === 'BUTTON' || el.tagName === 'A') out.buttons++;
    }
    return out;
  })()`;
  // The installer beside the page when there is one, so the program's
  // figures are on the sheets photographed; the bare archive otherwise.
  const phoneUrl = base + indexPage + (existsSync(resolve(ROOT, 'reference/game/installers/Cythera.bin')) ? '?cache=skip&loud=1' : '?cache=skip&loud=1&src=' + encodeURIComponent(archive));
  const r = await load(phoneUrl,
    '/^(Title: |Archive error)/.test(document.getElementById("output").textContent) || document.getElementById("sourceStatus").classList.contains("failed")', 120000,
    {device: {width: 390, height: 844, scale: 2}, then: async page => {
      const views = [];
      for (const [name, drive] of VIEWS) {
        if (drive) { await page.evaluate(`(() => { try { ${drive}; } catch (e) { return String(e); } return 'ok'; })()`); }
        await page.evaluate('new Promise(r => setTimeout(r, 400))');
        const m = await page.evaluate(MEASURE);
        const path = await page.shot(join(SHOTS, name + '.png'));
        views.push({name, m, path});
      }
      return views;
    }});
  const errs = errors(r.console);
  if (errs.length) fail('phone', 'console errors at phone width: ' + errs.map(describe).join(' | '));
  else if (!r.met || !r.more) fail('phone', 'the archive did not open at phone width');
  else {
    const wide = r.more.filter(v => v.m.scrollWidth > v.m.innerWidth + 1 || v.m.over.length);
    for (const v of wide) fail('phone', `${v.name}: the page is ${v.m.scrollWidth} px wide on a ${v.m.innerWidth} px phone` + (v.m.over.length ? '; past the edge: ' + v.m.over.join(', ') : ''));
    const small = r.more.reduce((a, v) => a + v.m.small, 0), buttons = r.more.reduce((a, v) => a + v.m.buttons, 0);
    phone = `${r.more.length} views at 390 px, ${wide.length ? wide.length + ' wider than the phone' : 'none wider than the phone'}, ${small} of ${buttons} tap targets under 24 px; screenshots in ${SHOTS}`;
    console.log('  phone: ' + phone);
  }
}

// ---- 4. canvas.html -----------------------------------------------------------
if (canvasPage && existsSync(resolve(ROOT, canvasPage))) {
  const r = await load(base + canvasPage, 'document.readyState === "complete" && document.querySelector("canvas") !== null', 20000);
  const errs = errors(r.console);
  if (errs.length) fail('canvas.html', 'console errors on load: ' + errs.map(describe).join(' | '));
  else if (!r.met) fail('canvas.html', 'no canvas element came up in 20 s');
  else console.log(`  canvas.html: loads clean in a browser in ${r.ms} ms`);
}

clearTimeout(watchdog);
server.close();
console.log(failures ? `\nFAIL — ${failures} problem(s)` : `\nbrowser: index.html and canvas.html load clean; ${opened}; ${phone}`);
process.exit(failures ? 1 : 0);
