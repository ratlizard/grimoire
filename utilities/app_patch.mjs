#!/usr/bin/env node
/* A builder, not a check: Cythera's application with the fixes of
   js/delv-appfixes.js applied, as the Patches section writes it.

   Usage:
     node utilities/app_patch.mjs <Cythera> <out dir> [--only id,id] [--without id,id]
     node utilities/app_patch.mjs <Cythera.data> <Cythera.rsrc> <out dir> [...]
     node utilities/app_patch.mjs --list

   <Cythera> is the application wrapped in BinHex, MacBinary or AppleSingle,
   which carry both forks; or give the two forks as two files. Writes, in
   <out dir>, `Cythera.bin` (MacBinary II, both forks, with the original's
   type and creator: what an emulator or the fork takes) and the two forks
   apart as `Cythera.data` and `Cythera.rsrc`, and prints what each fix
   changed. What it writes is the game's program with our words in it, and
   belongs in no repository.

   Every fix is applied unless --only or --without says otherwise; the
   applier refuses a program that is not 1.0.4's, or one patched already,
   and says which fix found what. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const args = process.argv.slice(2);
const flag = name => { const i = args.indexOf(name); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v.split(',').map(s => s.trim()).filter(Boolean); };
const listOnly = args.includes('--list');
const only = flag('--only'), without = flag('--without');

const ctx = vm.createContext({ TextDecoder, TextEncoder });
for (const f of ['js/mac-bytes.js', 'js/mac-containers.js', 'js/mac-resfork.js', 'js/mac-pef.js', 'js/mac-ppc.js', 'js/mac-ppc-asm.js', 'js/delv-appfixes.js', 'js/delv-apppatch.js'])
  new vm.Script(readFileSync(new URL('../' + f, import.meta.url), 'utf8'), { filename: f }).runInContext(ctx);
const FIXES = vm.runInContext('APP_FIXES', ctx);
if (listOnly) { for (const f of FIXES) console.log(f.id.padEnd(20), f.kind.padEnd(5), f.title); process.exit(0); }

let data, rsrc, type = 'APPL', creator = 'Delv', outDir;
if (args.length === 3) {
  data = new Uint8Array(readFileSync(args[0])); rsrc = new Uint8Array(readFileSync(args[1])); outDir = args[2];
} else if (args.length === 2) {
  const c = ctx.sniffMacContainer(new Uint8Array(readFileSync(args[0])));
  if (!c) { console.error(args[0] + ' is not BinHex, MacBinary or AppleSingle; give the data fork and the resource fork as two files'); process.exit(2); }
  data = c.data; rsrc = c.rsrc; type = c.type || type; creator = c.creator || creator; outDir = args[1];
} else { console.error('usage: app_patch.mjs <Cythera> <out dir> [--only id,id] [--without id,id], or <data> <rsrc> <out dir>, or --list'); process.exit(2); }

for (const id of [...(only || []), ...(without || [])]) if (!FIXES.some(f => f.id === id)) { console.error('no fix is called ' + id + ' (--list names them)'); process.exit(2); }
const chosen = FIXES.filter(f => (!only || only.includes(f.id)) && !(without || []).includes(f.id));
let r;
try { r = ctx.applyAppFixes({ data, rsrc }, chosen); } catch (e) { console.error(e.message); process.exit(1); }

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'Cythera.data'), r.data);
writeFileSync(join(outDir, 'Cythera.rsrc'), r.rsrc);
writeFileSync(join(outDir, 'Cythera.bin'), ctx.writeMacBinary({ name: 'Cythera', type, creator, data: r.data, rsrc: r.rsrc }));
for (const a of r.applied) {
  const bits = [];
  const sites = a.words.filter(w => w.was !== null).length;
  if (sites) bits.push(sites + (sites === 1 ? ' word' : ' words') + ' changed');
  if (a.caveWords) bits.push(a.caveWords + ' words of new code at 0x' + a.caveAt.toString(16).toUpperCase());
  if (a.text) bits.push(a.text.length + ' string' + (a.text.length === 1 ? '' : 's'));
  if (a.resources) bits.push(a.resources.join(', '));
  console.log(a.id.padEnd(20), bits.join('; '));
}
console.log(chosen.length + ' fixes; the code grown by ' + r.grownBy + ' bytes; written to ' + outDir);
