#!/usr/bin/env node
// Does the Compact Pro reader hand back what is in the archive?
//
//   node utilities/cpt_check.mjs [index.html] [reference dir]
//
// WHY. js/mac-compactpro.js is a port of The Unarchiver's XADMaster, and
// `unar` is the same code, so holding the port to `unar` shows it faithful,
// not the format understood. What does not come from that code is the
// archive's word: the catalog's CRC-32, which looksLikeCompactPro checks
// it against, and the CRC-32 of a file with one fork, which cptFork checks.
//
// 1. Every fork of the Cythera Makeover kit (608_Cythera_Makeover.sea, the
//    one add-on that is Compact Pro: a self-extractor, its archive in the
//    data fork of a MacBinary copy) byte for byte against what `unar`
//    extracts, resource forks from the AppleDouble `unar -k visible` writes.
// 2. extractDelverArchive reads it, and reports that it has no Cythera Data or
//    saved game.
//
// THE NEGATIVE CONTROLS. A byte changed in a compressed fork must be rejected
// (its CRC-32), not handed back; a byte changed in the catalog must leave
// the archive unrecognised.

import {readFileSync, existsSync, mkdtempSync, rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', refDir = 'reference'] = process.argv.slice(2);
let failures = 0, forks = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);
const skip = (what, why) => console.log(`  skip ${what}: ${why}`);
const same = (a, b) => a.length === b.length && Buffer.compare(Buffer.from(a), Buffer.from(b)) === 0;

const {sandbox} = makeSandbox();
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);
for (const name of ['looksLikeCompactPro', 'parseCompactProArchive', 'cptFork', 'extractDelverArchive'])
  if (ev(`typeof ${name}`) !== 'function') fail('the page', `${name} is not defined`);

const kit = join(refDir, 'community', 'addons', '608_Cythera_Makeover.sea');
let haveUnar = true;
try { execFileSync('which', ['unar'], {stdio: 'ignore'}); } catch (e) { haveUnar = false; }
const appleDoubleRsrc = b => {
  if (b.length < 26 || b.readUInt32BE(0) !== 0x00051607) return null;
  for (let i = 0, n = b.readUInt16BE(24); i < n; i++) {
    const e = 26 + i * 12;
    if (b.readUInt32BE(e) === 2) return b.subarray(b.readUInt32BE(e + 4), b.readUInt32BE(e + 4) + b.readUInt32BE(e + 8));
  }
  return null;
};

if (!existsSync(kit)) skip('the Makeover kit', 'the add-ons are not here');
else {
  sandbox.__z = new Uint8Array(readFileSync(kit));
  ev(`__c = sniffMacContainer(__z).data`);
  if (!ev(`looksLikeCompactPro(__c)`)) fail('the Makeover kit', 'its data fork is not recognised as Compact Pro');
  // ---- 1. every fork against unar ------------------------------------------
  else if (!haveUnar) skip('the Makeover kit', 'no unar (brew install unar)');
  else {
    const tmp = mkdtempSync(join(tmpdir(), 'cpt-check-'));
    try {
      execFileSync('unar', ['-q', '-f', '-k', 'visible', '-o', tmp, kit], {stdio: 'ignore'});
      const entries = ev(`parseCompactProArchive(__c).entries.filter(e => !e.isFolder).map(e => ({ path: e.path, data: e.dataLen, rsrc: e.rsrcLen }))`);
      for (const e of entries) {
        for (const which of ['data', 'rsrc']) {
          if (!e[which]) continue;
          sandbox.__p = e.path;
          const actual = ev(`(() => { try { return parseCompactProArchive(__c).entries.find(x => x.path === __p).read('${which}'); } catch (er) { return er.message; } })()`);
          if (typeof actual === 'string') { fail(`${e.path} ${which}`, actual); continue; }
          const f = join(tmp, e.path);
          const expected = which === 'data' ? (existsSync(f) ? readFileSync(f) : null) : (existsSync(f + '.rsrc') ? appleDoubleRsrc(readFileSync(f + '.rsrc')) : null);
          if (!expected) { fail(`${e.path} ${which}`, 'unar did not extract it'); continue; }
          if (!same(actual, expected)) fail(`${e.path} ${which}`, `${actual.length} bytes, not what unar extracts (${expected.length})`);
          else forks++;
        }
      }
      if (forks) ok('the Makeover kit', `${forks} fork(s) of ${entries.length} file(s) byte identical to unar`);
    } finally { rmSync(tmp, {recursive: true, force: true}); }
  }
  // ---- 2. through extractDelverArchive -------------------------------------
  const msg = ev(`(() => { try { extractDelverArchive(__z); return 'opened'; } catch (e) { return e.message; } })()`);
  if (!/a Compact Pro self-extracting archive with no Cythera Data or saved game in it/.test(msg)) fail('extractDelverArchive', msg);
  else ok('extractDelverArchive', 'reads the kit and reports that it has no Cythera Data or saved game');
  // ---- the negative controls -----------------------------------------------
  const where = ev(`(() => { const e = parseCompactProArchive(__c).entries.find(x => !x.isFolder && x.rsrcLen > 10000 && !x.dataLen); return e ? [e.path, e.offset] : null; })()`);
  if (!where) fail('a byte changed in a fork', 'the kit has no large file with only a resource fork to change');
  else {
    sandbox.__p = where[0];
    ev(`__b = __c.slice(); __b[${where[1] + 500}] ^= 0x10`);
    const changed = ev(`(() => { try { parseCompactProArchive(__b).entries.find(x => x.path === __p).read('rsrc'); return 'handed back'; } catch (e) { return e.message; } })()`);
    if (changed === 'handed back') fail('a byte changed in a fork', 'the fork was handed back');
    else ok('a byte changed in a fork', 'rejected: ' + changed);
  }
  const catalog = ev(`(() => { const b = __c.slice(); const at = u32be(b, 4); b[at + 9] ^= 0x01; return looksLikeCompactPro(b); })()`);
  if (catalog) fail('a byte changed in the catalog', 'still recognised');
  else ok('a byte changed in the catalog', 'not recognised: the catalog fails its CRC-32');
}

console.log(`\n  ${forks} Compact Pro fork(s) read back byte identical`);
if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1); }
