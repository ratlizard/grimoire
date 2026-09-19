#!/usr/bin/env node
/* fuzz_check.mjs -- does every decoder stop on bad input?
 *
 *   node utilities/fuzz_check.mjs index.html "$TMPDIR/Cythera Data.data" "$TMPDIR/Cythera Data.rsrc" \
 *        "reference/game/Cythera Data.hqx" reference/game/installers/Cythera.bin \
 *        "reference/game/installers/Cythera installers (archive.org).sit" reference/community/addons/616_Rocky_the_Flying_Chicken.zip
 *   node utilities/fuzz_check.mjs ... --case data:17        (one case, in this process, for a debugger)
 *
 * The site's purpose is opening files, including community add-ons nobody
 * here made, and every oracle in the suite runs over well-formed ones. This
 * one corrupts them. Each real input -- the data fork, the resource fork,
 * the BinHex, the MacBinary installer, the StuffIt bundle, the zip add-on --
 * is damaged a fixed number of ways from a fixed seed (bytes flipped, a
 * length field maxed, a range zeroed, the file cut short) and handed to the
 * page's own entry point for it: extractDelverArchive, the route a dropped
 * file takes, then the decoders behind it. A decoder may return or throw;
 * what it may not do is fail to stop, or take the process down. A hang on a
 * phone is the failure that would follow, and it is the one the other
 * checks cannot see, since a harness that hangs reports nothing.
 *
 * So each case runs in a worker thread under a deadline. A case that
 * overruns is a hang: the worker is killed, the case named with its seed so
 * `--case kind:seed` reproduces it, and a fresh worker takes the rest. A
 * worker that dies (an allocation the mutated length asked for, past the
 * heap limit set on it) is a crash, named the same way. The negative control
 * is a case that loops on purpose: the check fails if it is not reported as
 * a hang, which is the harness proving it can fail. Seeds are fixed, so a
 * run is the same run every time and a failure can be reproduced. */

import {readFileSync, existsSync} from 'node:fs';
import {Worker, isMainThread, parentPort, workerData} from 'node:worker_threads';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const CASES_PER_INPUT = 48;
const DEADLINE_MS = 8000;
const WORKERS = 4;

// ---- the corruptions, from a seed ------------------------------------------
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function mutate(bytes, seed) {
  const r = rng(seed), out = bytes.slice();
  const n = out.length; if (!n) return {bytes: out, how: 'empty'};
  const how = ['flip', 'max', 'zero', 'cut', 'flip', 'max'][Math.floor(r() * 6)];
  const at = Math.floor(r() * n);
  if (how === 'flip') { const k = 1 + Math.floor(r() * 8); for (let i = 0; i < k; i++) { const p = Math.floor(r() * n); out[p] ^= 1 + Math.floor(r() * 255); } return {bytes: out, how: `${k} bytes flipped`}; }
  if (how === 'max') { const p = at & ~3; for (let i = 0; i < 4 && p + i < n; i++) out[p + i] = 0xFF; return {bytes: out, how: `a word maxed at 0x${p.toString(16)}`}; }
  if (how === 'zero') { const k = 16 + Math.floor(r() * 240); out.fill(0, at, Math.min(n, at + k)); return {bytes: out, how: `${k} bytes zeroed at 0x${at.toString(16)}`}; }
  const len = Math.max(0, Math.floor(r() * n)); return {bytes: out.slice(0, len), how: `cut to ${len} bytes`};
}

// ---- what each input goes through -------------------------------------------
// Everything a dropped file of that kind meets in the page, in order; the
// result is thrown away. `g` is the vm's global.
const DRIVES = {
  data(g, b) {
    const found = g.extractDelverArchive(b, {});
    const arc = g.openDelverArchive(found && found.bytes ? found.bytes : b);
    if (!arc) return 'no archive';
    let n = 0;
    for (const resid of [0x8001, 0x8101, 0x8E00, 0x8801, 0x1801, 0x1000, 0xF002, 0xF009, 0x0201]) {
      const raw = g.getResourceBytes(arc, resid); if (!raw) continue; n++;
      const d = g.smartDecrypt(raw, resid).data;
      const subn = (resid >> 8) - 1;
      try { if (subn === 141 || subn === 135) g.decodeResource(arc, raw, subn, resid); } catch (e) { /* refused */ }
      try { if (resid === 0x8001) g.parseDelverMap(d); } catch (e) { /* refused */ }
      try { if (resid === 0x8101) g.parseDelverPropList(d); } catch (e) { /* refused */ }
      try { if (subn === 0x17 || subn === 0x0F) g.dvmRender(arc, d, resid); } catch (e) { /* refused */ }
      try { if (resid === 0xF009) g.parseDelverCharacterRecords(d); } catch (e) { /* refused */ }
    }
    try { g.delverArchiveSpec(arc.bytes); } catch (e) { /* refused */ }
    return n + ' resources';
  },
  rsrc(g, b) {
    // The same decoder per type that rsrc_snapshot.mjs hashes.
    const D = {'STR#': 'decodeSTRList', 'STR ': 'decodeSTR', TEXT: 'decodeTEXT', vers: 'decodeVers', DITL: 'decodeDITL', MENU: 'decodeMENU',
               WIND: 'decodeWIND', ALRT: 'decodeALRT', DLOG: 'decodeDLOG', MBAR: 'decodeMBAR', FREF: 'decodeFREF', BNDL: 'decodeBNDL',
               SIZE: 'decodeSIZE', TMPL: 'decodeTMPL', 'PAT ': 'decodePAT', 'PAT#': 'decodePATList', ppat: 'decodePpat', clut: 'decodeClut',
               cicn: 'decodeCicn', CURS: 'decodeCURS', crsr: 'decodeCrsr', acur: 'decodeAcur', ICON: 'decodeICON', SICN: 'decodeSICN',
               PICT: 'decodePict', 'snd ': 'decodeSnd', NFNT: 'decodeNFNT', FONT: 'decodeNFNT', cfrg: 'decodeCfrg', CODE: 'decodeCODE'};
    const f = g.openResourceFork(b); let n = 0;
    for (const r of (f.resources || []).slice(0, 300)) {
      try {
        const fn = D[r.type];
        if (fn && typeof g[fn] === 'function') g[fn](r.data);
        else if (r.type === 'ICN#' || r.type === 'ics#') g.decode1bitIcon(r.data, r.type === 'ICN#' ? 32 : 16);
        else if (/^ic[ls][48]$/.test(r.type)) g.drawIndexedIcon(r.data, r.type[2] === 'l' ? 32 : 16, +r.type[3], +r.type[3] === 4 ? g.MAC_4BIT_PAL : g.MAC_8BIT_PAL);
        n++;
      } catch (e) { /* refused */ }
    }
    return n + ' of ' + (f.resources || []).length + ' resources';
  },
  hqx(g, b) { const r = g.extractDelverArchive(b, {}); return r ? 'opened' : 'refused'; },
  bin(g, b) { const r = g.extractDelverArchive(b, {}); return r ? 'opened' : 'refused'; },
  sit(g, b) { const a = g.parseStuffItArchive(b); let n = 0; for (const e of (a.entries || []).slice(0, 12)) { try { g.stuffItFork(b, e, 'data'); n++; } catch (e2) { /* refused */ } } return n + ' forks'; },
  zip(g, b) { const a = g.parseZipArchive(b); let n = 0; for (const e of (a.entries || []).slice(0, 12)) { try { g.zipFork(b, e, 'data'); n++; } catch (e2) { /* refused */ } } return n + ' entries'; },
};

// ---- the worker: the page once, then cases as they come --------------------
if (!isMainThread) {
  const {js, htmlPath, inputs} = workerData;
  const {makeSandbox} = await import('./dom_stub.mjs');
  const {sandbox} = makeSandbox();
  const g = vm.createContext(sandbox);
  new vm.Script(js, {filename: htmlPath}).runInContext(g);
  parentPort.on('message', c => {
    if (c.kind === 'control-hang') { for (;;) { /* on purpose */ } }
    if (c.kind === 'control-throw') { parentPort.postMessage({id: c.id, threw: 'on purpose'}); return; }
    const {bytes, how} = mutate(inputs[c.kind], c.seed);
    const t0 = Date.now();
    try { const r = DRIVES[c.kind](g, bytes); parentPort.postMessage({id: c.id, how, ms: Date.now() - t0, returned: String(r)}); }
    catch (e) { parentPort.postMessage({id: c.id, how, ms: Date.now() - t0, threw: (e && e.message || String(e)).slice(0, 120)}); }
  });
  parentPort.postMessage({ready: true});
} else {
  const args = process.argv.slice(2);
  const one = args.includes('--case') ? args[args.indexOf('--case') + 1] : null;
  const [htmlPath, dataPath, rsrcPath, hqxPath, binPath, sitPath, zipPath] = args.filter(a => !a.startsWith('--') && a !== one);
  const {pageSource} = await import('./page_scripts.mjs');
  const js = pageSource(htmlPath);
  const inputs = {};
  for (const [kind, p] of [['data', dataPath], ['rsrc', rsrcPath], ['hqx', hqxPath], ['bin', binPath], ['sit', sitPath], ['zip', zipPath]])
    if (p && existsSync(p)) inputs[kind] = new Uint8Array(readFileSync(p));
  const kinds = Object.keys(inputs);
  if (!kinds.length) { console.log('  skip: no inputs found'); process.exit(0); }

  if (one) {
    // One case in this process, uncaught, for a debugger.
    const [kind, seed] = one.split(':');
    const {makeSandbox} = await import('./dom_stub.mjs');
    const g = vm.createContext(makeSandbox().sandbox);
    new vm.Script(js, {filename: htmlPath}).runInContext(g);
    const {bytes, how} = mutate(inputs[kind], +seed);
    console.log(`  ${kind} seed ${seed}: ${how}`);
    console.log('  ' + DRIVES[kind](g, bytes));
    process.exit(0);
  }

  const cases = [{id: 0, kind: 'control-hang'}, {id: 1, kind: 'control-throw'}];
  for (const kind of kinds) for (let s = 1; s <= CASES_PER_INPUT; s++) cases.push({id: cases.length, kind, seed: s * 7919 + kind.length});
  const results = new Map();
  let hangs = 0, crashes = 0, threw = 0, returned = 0, controlHangSeen = false, controlThrowSeen = false;
  const pending = cases.slice();

  async function runWorker() {
    let w = null, current = null, timer = null;
    const spawn = () => new Promise(res => {
      w = new Worker(fileURLToPath(import.meta.url), {workerData: {js, htmlPath, inputs}, resourceLimits: {maxOldGenerationSizeMb: 1024}});
      w.once('message', m => { if (m.ready) res(); });
      w.on('error', () => {});
    });
    await spawn();
    while (pending.length) {
      const c = pending.shift(); current = c;
      const verdict = await new Promise(res => {
        timer = setTimeout(() => res({hang: true}), DEADLINE_MS);
        const onMsg = m => { if (m.id === c.id) { clearTimeout(timer); w.off('exit', onExit); res(m); } };
        const onExit = code => { clearTimeout(timer); res({crashed: 'the worker exited with ' + code}); };
        w.once('message', onMsg); w.once('exit', onExit);
        w.postMessage(c);
      });
      results.set(c.id, verdict);
      if (verdict.hang || verdict.crashed) { try { await w.terminate(); } catch (e) { /* gone */ } if (pending.length) await spawn(); }
    }
    try { await w.terminate(); } catch (e) { /* gone */ }
  }
  await Promise.all(Array.from({length: Math.min(WORKERS, cases.length)}, runWorker));

  let failures = 0;
  const fail = m => { failures++; console.log('  FAIL ' + m); };
  for (const c of cases) {
    const v = results.get(c.id) || {crashed: 'no verdict'};
    if (c.kind === 'control-hang') { controlHangSeen = !!v.hang; continue; }
    if (c.kind === 'control-throw') { controlThrowSeen = !!v.threw; continue; }
    if (v.hang) { hangs++; fail(`${c.kind} seed ${c.seed} did not stop in ${DEADLINE_MS / 1000} s; reproduce with --case ${c.kind}:${c.seed}`); }
    else if (v.crashed) { crashes++; fail(`${c.kind} seed ${c.seed} (${v.how || '?'}) took the worker down: ${v.crashed}; reproduce with --case ${c.kind}:${c.seed}`); }
    else if (v.threw) threw++; else returned++;
  }
  if (!controlHangSeen) fail('the negative control, a case that loops on purpose, was not reported as a hang; the deadline does not work');
  if (!controlThrowSeen) fail('the negative control that throws on purpose was not seen to throw');
  const n = cases.length - 2;
  console.log(`  ${n} cases over ${kinds.length} inputs (${kinds.join(', ')}): ${returned} returned, ${threw} threw, ${hangs} hung, ${crashes} crashed; the control hang was ${controlHangSeen ? 'caught' : 'MISSED'}`);
  console.log(failures ? `\nFAIL — ${failures} problem(s)` : `\nfuzz: ${n} corrupted inputs, every decoder stopped; ${threw} refused, ${returned} returned`);
  process.exit(failures ? 1 : 0);
}
