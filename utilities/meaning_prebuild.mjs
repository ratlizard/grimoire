#!/usr/bin/env node
/* meaning_prebuild.mjs -- makes js/meaning-prebuilt.js, the embeddings of
 * search by meaning for the default file, so a visitor's first search by
 * meaning on that file skips the reading of every piece (some minutes on a
 * desktop, more on a phone).
 *
 *   node utilities/meaning_prebuild.mjs
 *
 * The page does the work, in headless Chrome, so the numbers are the ones a
 * visitor's browser makes: the same library and model from the same CDN,
 * the same pieces (meaningPieces over the plain search's pages), the same
 * worker. Nothing is installed here. The page opens with no ?src=, so it
 * opens the default chain (LOCAL_ARCHIVE_CANDIDATES, then archive.org), the
 * file a visitor first sees, and the opened line is printed so the run
 * states which file it read. With window.MEANING_NO_PREBUILT set, the page
 * reads every piece afresh instead of reusing the file being remade.
 *
 * What is written is each piece's 64-bit text hash (meaningHash), its
 * numbers cut to 8 bits and its scale, never the text. The maintainer
 * agreed on 28 October 2026 to publish numbers made from the game's text,
 * not the text. A run lasts about an hour on this Mac, the plain search's
 * reading of every tab and then some 6,800 pieces through the model. Run it again when many pages' words have changed. A stale file
 * costs only speed, since a piece with no match goes to the model.
 *
 * Chrome is driven over its DevTools pipe as browser_check.mjs drives it,
 * with no library. Its profile is made under $TMPDIR and removed at the
 * end of the run. */

import {spawn, execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {existsSync, mkdtempSync, rmSync, createReadStream, statSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, extname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'js', 'meaning-prebuilt.js');

function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { const p = execFileSync('sh', ['-c', `command -v ${name}`], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); if (p) return p; } catch (e) { /* not on the path */ }
  }
  for (const p of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'])
    if (existsSync(p)) return p;
  return null;
}
const CHROME = findChrome();
if (!CHROME) { console.log('no Chrome or Chromium found ($CHROME, the PATH, /Applications)'); process.exit(1); }

const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png'};
const server = createServer((req, res) => {
  const f = resolve(ROOT, '.' + decodeURIComponent(req.url.split('?')[0]));
  let st;
  try { st = statSync(f); } catch (e) { res.writeHead(404); res.end(); return; }
  if (!f.startsWith(ROOT) || !st.isFile()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, {'Content-Type': TYPES[extname(f)] || 'application/octet-stream'});
  createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/`;

const profile = mkdtempSync(join(process.env.TMPDIR || tmpdir(), 'meaning-prebuild-'));
const proc = spawn(CHROME, ['--headless=new', '--no-first-run', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'],
  {stdio: ['ignore', 'ignore', 'ignore', 'pipe', 'pipe']});
let next = 1, buf = '';
const waiting = new Map();
proc.stdio[4].setEncoding('utf8');
proc.stdio[4].on('data', c => {
  buf += c;
  let i;
  while ((i = buf.indexOf('\0')) >= 0) {
    const m = JSON.parse(buf.slice(0, i)); buf = buf.slice(i + 1);
    if (m.id && waiting.has(m.id)) { const w = waiting.get(m.id); waiting.delete(m.id); m.error ? w.rej(new Error(m.error.message)) : w.res(m.result); }
  }
});
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const id = next++;
  waiting.set(id, {res, rej});
  proc.stdio[3].write(JSON.stringify({id, method, params, sessionId}) + '\0');
});
const finish = code => {
  try { proc.kill(); } catch (e) { /* already gone */ }
  server.close();
  try { rmSync(profile, {recursive: true, force: true}); } catch (e) { console.log('the profile is left at ' + profile); }
  process.exit(code);
};
const {targetId} = await send('Target.createTarget', {url: 'about:blank'});
const {sessionId} = await send('Target.attachToTarget', {targetId, flatten: true});
const ev = async e => {
  const r = await send('Runtime.evaluate', {expression: e, returnByValue: true, awaitPromise: true}, sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
  return r.result && r.result.value;
};
const wait = async (expr, seconds, say) => {
  const t0 = Date.now();
  let shown = 0;
  while (Date.now() - t0 < seconds * 1000) {
    if (await ev(expr).catch(() => false)) return true;
    if (say && Date.now() - shown > 30000) { shown = Date.now(); console.log('  ' + await ev(say).catch(e => e.message)); }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
};

await send('Runtime.enable', {}, sessionId);
await send('Page.navigate', {url: base + 'index.html?cache=skip'}, sessionId);
if (!await wait('/^Title: /.test(document.getElementById("output").textContent)', 600)) { console.log('the default file did not open'); finish(1); }
const opened = await ev('DERIVED.OPENED_LINE');
console.log(opened);
await ev('window.MEANING_NO_PREBUILT = true; openSearch(); 1');
if (!await wait('!!(DERIVED.SITE_SEARCH && DERIVED.SITE_SEARCH.done)', 1800, 'document.getElementById("searchResults").textContent')) { console.log('the plain search did not finish reading'); finish(1); }
await ev('setSearchMeaning(true); 1');
if (!await wait('!!(_meaning.done || _meaning.error)', 3600, 'document.getElementById("searchResults").textContent')) { console.log('the reading by meaning did not finish'); finish(1); }
const got = await ev(`(() => {
  if (_meaning.error) return { error: String(_meaning.error) };
  const n = _meaning.pieces.length, D = MEANING_DIM, q = new Array(n * D), scales = new Array(n);
  let ids = '';
  for (let k = 0; k < n; k++) {
    ids += meaningHash(_meaning.pieces[k].text);
    let m = 0;
    for (let d = 0; d < D; d++) m = Math.max(m, Math.abs(_meaning.vecs[k * D + d]));
    const s = m ? m / 127 : 1;
    scales[k] = s;
    for (let d = 0; d < D; d++) q[k * D + d] = Math.round(_meaning.vecs[k * D + d] / s);
  }
  return { n, ids, q, scales, model: MEANING_MODEL, chunk: MEANING_CHUNK, dim: D, version: GRIMOIRE_VERSION };
})()`);
if (got.error) { console.log('the model failed, ' + got.error); finish(1); }
const unique = new Set(got.ids.match(/.{16}/g)).size;
const vecs = Buffer.from(Int8Array.from(got.q).buffer).toString('base64');
const scales = Buffer.from(Float32Array.from(got.scales).buffer).toString('base64');
writeFileSync(OUT,
  `/* The embeddings of search by meaning for the default file, made by\n` +
  `   utilities/meaning_prebuild.mjs from grimoire ${got.version}, ${got.n} pieces of\n` +
  `   "${opened.replace(/\*\//g, '')}".\n` +
  `   Each piece's text hash, its numbers cut to 8 bits and its scale, and no text.\n` +
  `   js/page-search.js loads it when search by meaning is turned on. */\n` +
  `window.MEANING_PREBUILT = ${JSON.stringify({model: got.model, chunk: got.chunk, dim: got.dim, ids: got.ids, scales, vecs})};\n`);
console.log(`${got.n} pieces (${unique} distinct texts) written to js/meaning-prebuilt.js, ${statSync(OUT).size} bytes`);
finish(0);
