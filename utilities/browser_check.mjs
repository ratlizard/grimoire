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
import {existsSync, mkdtempSync, rmSync, createReadStream, statSync} from 'node:fs';
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
  send(method, params = {}, sessionId) {
    const id = this.next++;
    const p = new Promise((res, rej) => this.waiting.set(id, {res, rej}));
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
async function load(url, until, deadlineMs) {
  const b = new Browser();
  const console_ = [];
  try {
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
    await s('Page.navigate', {url});
    const t0 = Date.now();
    let met = false;
    while (Date.now() - t0 < deadlineMs) {
      try { const r = await s('Runtime.evaluate', {expression: until, returnByValue: true}); if (r.result && r.result.value) { met = true; break; } } catch (e) { /* not ready */ }
      await new Promise(r => setTimeout(r, 200));
    }
    const dom = await s('Runtime.evaluate', {expression: 'document.documentElement.outerHTML', returnByValue: true});
    return {dom: (dom.result && dom.result.value) || '', console: console_, met, ms: Date.now() - t0};
  } finally { await b.close(); }
}

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
let opened = 'no archive given';
if (archive && existsSync(resolve(ROOT, archive))) {
  const r = await load(base + indexPage + '?cache=skip&loud=1&src=' + encodeURIComponent(archive),
    '/^(Title: |Archive error)/.test(document.getElementById("output").textContent) || document.getElementById("sourceStatus").classList.contains("failed")', 90000);
  const errs = errors(r.console), quiet = quietOnes(r.console);
  const title = text((/id="output"[^>]*>([\s\S]*?)<\/pre>/.exec(r.dom) || ['', ''])[1]).trim();
  const status = text((/id="sourceStatus"[^>]*>([\s\S]*?)<\/(?:pre|div|span)>/.exec(r.dom) || ['', ''])[1]).trim();
  if (errs.length) fail('archive over http', 'console errors: ' + errs.map(describe).join(' | '));
  else if (!/^Title: /.test(title)) fail('archive over http', 'the page did not open the archive' + (r.met ? '' : ' in 90 s') + ': output says "' + title.slice(0, 100) + '"; status: ' + status.slice(0, 160));
  else if (!/id="atlasPanel" style="display: (block|flex|grid)/.test(r.dom))
    fail('archive over http', 'the world did not come up after the archive opened: ' + (r.dom.match(/id="atlasPanel"[^>]*/) || ['no atlas panel'])[0]);
  else {
    opened = `the archive opens over http in ${r.ms} ms (${title.slice(0, 60)}), ${quiet.length} quiet failures on the way`;
    console.log('  ' + opened);
    for (const l of quiet.slice(0, 8)) console.log('    ' + l.text.slice(0, 140));
  }
} else console.log('  ' + (archive ? 'no archive at ' + archive : 'no archive given') + ', so the open-over-http half is not run');

// ---- 3. canvas.html -----------------------------------------------------------
if (canvasPage && existsSync(resolve(ROOT, canvasPage))) {
  const r = await load(base + canvasPage, 'document.readyState === "complete" && document.querySelector("canvas") !== null', 20000);
  const errs = errors(r.console);
  if (errs.length) fail('canvas.html', 'console errors on load: ' + errs.map(describe).join(' | '));
  else if (!r.met) fail('canvas.html', 'no canvas element came up in 20 s');
  else console.log(`  canvas.html: loads clean in a browser in ${r.ms} ms`);
}

server.close();
console.log(failures ? `\nFAIL — ${failures} problem(s)` : `\nbrowser: index.html and canvas.html load clean; ${opened}`);
process.exit(failures ? 1 : 0);
