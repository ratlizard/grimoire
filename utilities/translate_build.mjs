#!/usr/bin/env node
/* A builder, not a check: Cythera Data in Spanish, both forks.

   Usage: node utilities/translate_build.mjs index.html "<Cythera Data.data>" "<Cythera Data.rsrc>" <out dir> [--missing]

   Runs js/delv-translate.js with the table js/delv-es.js inside the page's
   own sandbox, as utilities/patch_build.mjs does for the fixes, and writes
   into <out dir>: "Cythera Data.bin" (MacBinary, both forks, type DelS
   creator Delv), the two forks as "Cythera Data.data" and "Cythera
   Data.rsrc", and "Cythera Data/" as a file of this Mac with its resource
   fork and Finder type set, which is what the workbench's
   tools/infinite-mac-disk/rebuild.sh --add takes to put it on a disk image.
   It prints a line per resource changed and what the table did not reach,
   by resource; --missing prints every piece left in English by its hash,
   which is the list a translator works down. What it writes is the game's data changed and belongs in
   no repository. (29 September 2026.) */
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {pageContext} from './patch_build.mjs';

export function translateData({htmlPath = 'index.html', dataPath, rsrcPath, table = 'js/delv-es.js'}) {
  const {sandbox, ctx} = pageContext(htmlPath, dataPath);
  sandbox.__r = new Uint8Array(readFileSync(rsrcPath));
  for (const f of ['js/mac-geneva.js', table]) new vm.Script(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), {filename: f}).runInContext(ctx);
  return vm.runInContext(`(() => {
    const r = translateCytheraData(__a, __r, DELV_TRANSLATION_ES);
    const bin = writeMacBinary({ name: 'Cythera Data', type: 'DelS', creator: 'Delv', data: r.data, rsrc: r.rsrc });
    return { data: Array.from(r.data), rsrc: Array.from(r.rsrc), bin: Array.from(bin), log: r.log,
             report: { done: r.report.done, keys: r.report.keys, missing: r.report.missing, unused: r.report.unused } };
  })()`, ctx);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2).filter(a => !a.startsWith('--'));
  const [htmlPath = 'index.html', dataPath, rsrcPath, outDir] = args;
  if (!dataPath || !rsrcPath || !outDir) { console.error('usage: translate_build.mjs index.html <Cythera Data.data> <Cythera Data.rsrc> <out dir> [--missing]'); process.exit(2); }
  const out = translateData({htmlPath, dataPath, rsrcPath});
  mkdirSync(outDir, {recursive: true});
  writeFileSync(outDir + '/Cythera Data.bin', Buffer.from(out.bin));
  writeFileSync(outDir + '/Cythera Data.data', Buffer.from(out.data));
  writeFileSync(outDir + '/Cythera Data.rsrc', Buffer.from(out.rsrc));
  // A file of this Mac, both forks and the Finder type, for rebuild.sh --add.
  if (process.platform === 'darwin') {
    const f = outDir + '/Cythera Data';
    writeFileSync(f, Buffer.from(out.data));
    writeFileSync(f + '/..namedfork/rsrc', Buffer.from(out.rsrc));
    execFileSync('xattr', ['-wx', 'com.apple.FinderInfo', '44656C5344656C76' + '0'.repeat(48), f]);
  }
  for (const l of out.log) console.log('  ' + l);
  const r = out.report, byRes = new Map();
  for (const m of r.missing) byRes.set(m.resid, (byRes.get(m.resid) || 0) + 1);
  console.log(`  translated ${r.done} pieces and ${r.keys} keyword lists; ${r.missing.length} pieces left in English in ${byRes.size} resources; ${r.unused.length} entries of the table matched nothing`);
  for (const u of r.unused) console.log('  unused: ' + (typeof u.resid === 'number' ? '0x' + u.resid.toString(16).toUpperCase() : u.resid) + ' ' + u.hash);
  if (process.argv.includes('--missing')) for (const m of r.missing) console.log('  missing: ' + (typeof m.resid === 'number' ? '0x' + m.resid.toString(16).toUpperCase().padStart(4, '0') : m.resid) + ' ' + m.hash + ' ' + m.kind);
}
