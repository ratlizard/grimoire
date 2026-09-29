#!/usr/bin/env node
/* A builder, not a check: Cythera Data in Spanish, both forks.

   Usage: node utilities/translate_build.mjs index.html "<Cythera Data.data>" "<Cythera Data.rsrc>" <out dir> [--missing] [--program <Cythera.data> <Cythera.rsrc>]

   Runs js/delv-translate.js with the table js/delv-es.js inside the page's
   own sandbox, as utilities/patch_build.mjs does for the fixes, and writes
   into <out dir>: "Cythera Data.bin" (MacBinary, both forks, type DelS
   creator Delv), the two forks as "Cythera Data.data" and "Cythera
   Data.rsrc", and "Cythera Data/" as a file of this Mac with its resource
   fork and Finder type set, which is what the workbench's
   tools/infinite-mac-disk/rebuild.sh --add takes to put it on a disk image.
   It prints a line per resource changed and what the table did not reach,
   by resource; --missing prints every piece left in English by its hash,
   which is the list a translator works down. --program also writes the
   program in Spanish (translateProgram) from its two forks, as "Cythera" beside
   the data file in the same three forms, and gives the data file's names their
   articles, which the translated program leaves to them; --fixes id,id
   applies those program fixes (js/delv-appfixes.js) in the same pass. What it writes is the
   game's data changed and belongs in no repository. (29 September 2026.) */
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {pageContext} from './patch_build.mjs';

export function translateData({htmlPath = 'index.html', dataPath, rsrcPath, table = 'js/delv-es.js', programData = null, programRsrc = null, fixes = []}) {
  const {sandbox, ctx} = pageContext(htmlPath, dataPath);
  sandbox.__r = new Uint8Array(readFileSync(rsrcPath));
  sandbox.__pd = programData ? new Uint8Array(readFileSync(programData)) : null;
  sandbox.__pr = programRsrc ? new Uint8Array(readFileSync(programRsrc)) : null;
  sandbox.__fx = fixes;
  for (const f of ['js/mac-geneva.js', table]) new vm.Script(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), {filename: f}).runInContext(ctx);
  return vm.runInContext(`(() => {
    const r = translateCytheraData(__a, __r, DELV_TRANSLATION_ES, { articles: !!__pd });
    const bin = writeMacBinary({ name: 'Cythera Data', type: 'DelS', creator: 'Delv', data: r.data, rsrc: r.rsrc });
    let program = null;
    if (__pd) {
      const p = translateProgram(__pd, __pr, DELV_TRANSLATION_ES, __fx.map(id => { const f = APP_FIXES.find(x => x.id === id); if (!f) throw new Error('no program fix ' + id); return f; }));
      program = { data: Array.from(p.data), rsrc: Array.from(p.rsrc), bin: Array.from(writeMacBinary({ name: 'Cythera', type: 'APPL', creator: 'Delv', data: p.data, rsrc: p.rsrc })),
                  log: p.log, done: p.report.done, missing: p.report.missing };
    }
    return { data: Array.from(r.data), rsrc: Array.from(r.rsrc), bin: Array.from(bin), log: r.log, program,
             report: { done: r.report.done, keys: r.report.keys, missing: r.report.missing, unused: r.report.unused } };
  })()`, ctx);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const argv = process.argv.slice(2), pi = argv.indexOf('--program');
  const programData = pi >= 0 ? argv[pi + 1] : null, programRsrc = pi >= 0 ? argv[pi + 2] : null;
  const fi = argv.indexOf('--fixes'), fixes = fi >= 0 ? argv[fi + 1].split(',') : [];
  const args = argv.filter((a, i) => !a.startsWith('--') && !(pi >= 0 && (i === pi + 1 || i === pi + 2)) && !(fi >= 0 && i === fi + 1));
  const [htmlPath = 'index.html', dataPath, rsrcPath, outDir] = args;
  if (!dataPath || !rsrcPath || !outDir) { console.error('usage: translate_build.mjs index.html <Cythera Data.data> <Cythera Data.rsrc> <out dir> [--missing] [--program <Cythera.data> <Cythera.rsrc> [--fixes id,id]]'); process.exit(2); }
  const out = translateData({htmlPath, dataPath, rsrcPath, programData, programRsrc, fixes});
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
  if (out.program) {
    writeFileSync(outDir + '/Cythera.bin', Buffer.from(out.program.bin));
    writeFileSync(outDir + '/Cythera.data', Buffer.from(out.program.data));
    writeFileSync(outDir + '/Cythera.rsrc', Buffer.from(out.program.rsrc));
    if (process.platform === 'darwin') {
      const f = outDir + '/Cythera';
      writeFileSync(f, Buffer.from(out.program.data));
      writeFileSync(f + '/..namedfork/rsrc', Buffer.from(out.program.rsrc));
      execFileSync('xattr', ['-wx', 'com.apple.FinderInfo', '4150504C44656C762100' + '0'.repeat(44), f]);
    }
  }
  for (const l of out.log) console.log('  ' + l);
  if (out.program) { for (const l of out.program.log) console.log('  ' + l); console.log(`  the program: ${out.program.done} pieces, ${out.program.missing.length} left in English`); }
  const r = out.report, byRes = new Map();
  for (const m of r.missing) byRes.set(m.resid, (byRes.get(m.resid) || 0) + 1);
  console.log(`  translated ${r.done} pieces and ${r.keys} keyword lists; ${r.missing.length} pieces left in English in ${byRes.size} resources; ${r.unused.length} entries of the table matched nothing`);
  for (const u of r.unused) console.log('  unused: ' + (typeof u.resid === 'number' ? '0x' + u.resid.toString(16).toUpperCase() : u.resid) + ' ' + u.hash);
  if (process.argv.includes('--missing')) for (const m of r.missing) console.log('  missing: ' + (typeof m.resid === 'number' ? '0x' + m.resid.toString(16).toUpperCase().padStart(4, '0') : m.resid) + ' ' + m.hash + ' ' + m.kind);
}
