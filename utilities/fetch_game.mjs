#!/usr/bin/env node
// Get the game's forks without a copy of the game on disk, so a checkout with
// no reference/ can still run the whole suite.
//
//   node utilities/fetch_game.mjs [outdir]        # default: $TMPDIR
//
// Writes the same four files ensureForks() produces from the .hqx archives --
// "Cythera Data.data", "Cythera Data.rsrc", "Cythera.data", "Cythera.rsrc" --
// and does nothing when they are already there.
//
// WHY THIS EXISTS. reference/ is not in the repository and never will be, so
// a fresh clone reported four of thirteen checks as "skip", including both
// snapshot checks. A skip reads like a clean result, which means a cloud or
// web session could not see a decoder regression at all. Everything needed to
// avoid that was already here: index.html has fetched its own input from
// archive.org since the installer session, and js/mac-vise.js and
// js/mac-stuffit.js open it. This runs the same chain under Node.
//
// WHERE IT FETCHES FROM. archive.org's `cythera-installers` item, through the
// `/cors/` path -- 28 MB, one StuffIt 5 archive holding the 1.0.1, 1.0.2,
// 1.0.3 and 1.0.4 installers with every data fork stored. It is the page's own
// first default, and `/cors/` is the path that sends the CORS header (checked
// with curl on 2 September 2026: `/download/`, www.bryce.pw and old.mac.gdn all
// send none). Node does not enforce CORS, but using a different URL here than
// the page uses would mean the check no longer covers what visitors get.
//
// The download is cached in outdir, so a second run costs nothing. A failure
// to reach the network is reported and is not fatal: the caller falls back to
// skipping, which is what a checkout without the game did before.
//
// This is a convenience, not an oracle. It gives no independent evidence about
// the decoders -- the bytes are the same game -- and vise_check.mjs is what
// actually proves the installer path, against the CRCs the catalog carries.

import {readFileSync, writeFileSync, existsSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const URL_SIT = 'https://archive.org/cors/cythera-installers/Cythera%20installers.sit';
const SIT_NAME = 'Cythera installers (archive.org).sit';

// The two files the rest of the suite reads, by their path inside the
// installer's catalog, and the base name each is written out under.
const WANTED = [
  ['Cythera 1.0.4 ƒ/Cythera Data', 'Cythera Data'],
  ['Cythera 1.0.4 ƒ/Cythera',      'Cythera'],
];

export async function fetchGame(outDir, say = () => {}) {
  const done = () => WANTED.every(([, base]) =>
    existsSync(join(outDir, base + '.data')) && existsSync(join(outDir, base + '.rsrc')));
  if (done()) return true;

  // The archive itself, cached beside the forks it produces.
  const sitPath = join(outDir, SIT_NAME);
  let sit;
  if (existsSync(sitPath)) {
    sit = new Uint8Array(readFileSync(sitPath));
  } else {
    say(`  fetching the installer from archive.org (28 MB) …`);
    let res;
    try {
      res = await fetch(URL_SIT, {redirect: 'follow'});
    } catch (e) {
      say(`  ! could not reach archive.org: ${e.message}`);
      return false;
    }
    if (!res.ok) { say(`  ! archive.org answered ${res.status} ${res.statusText}`); return false; }
    sit = new Uint8Array(await res.arrayBuffer());
    writeFileSync(sitPath, sit);
  }

  // The same two tiers index.html uses, in the same order: StuffIt to find
  // the installer, VISE to read it. sniffViseInstaller does both and picks the
  // newest release when the archive holds several, which this one does.
  const ctx = vm.createContext({TextDecoder, TextEncoder, console});
  for (const f of ['js/mac-bytes.js', 'js/mac-containers.js', 'js/mac-stuffit.js', 'js/mac-vise.js'])
    new vm.Script(readFileSync(join(ROOT, f), 'utf8'), {filename: f}).runInContext(ctx);

  let found;
  try { found = ctx.sniffViseInstaller(sit); }
  catch (e) { say(`  ! the archive did not open as an installer: ${e.message}`); return false; }
  if (!found) { say('  ! the archive did not open as an installer'); return false; }

  const byPath = new Map(found.archive.entries.map(e => [e.path, e]));
  for (const [inArchive, base] of WANTED) {
    const entry = byPath.get(inArchive);
    if (!entry) { say(`  ! ${inArchive} is not in the archive`); return false; }
    let r;
    try { r = ctx.viseExtract(found.archive, entry); }
    catch (e) { say(`  ! could not extract ${inArchive}: ${e.message}`); return false; }
    // The catalog's own CRC-32 covers data fork then resource fork. A file
    // that fails it is corrupt, and writing it would turn a bad download into
    // what looks like a decoder regression two checks later.
    if (!r.crcOk) { say(`  ! ${inArchive} failed the catalog's CRC`); return false; }
    writeFileSync(join(outDir, base + '.data'), Buffer.from(r.data));
    writeFileSync(join(outDir, base + '.rsrc'), Buffer.from(r.rsrc));
  }
  say(`  extracted ${found.picked} from the archive`);
  return true;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = process.argv[2] || process.env.TMPDIR || '/tmp';
  const ok = await fetchGame(resolve(out), s => console.log(s));
  process.exit(ok ? 0 : 1);
}
