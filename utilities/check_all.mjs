#!/usr/bin/env node
// Runs every check in this directory and prints one table.
//
//   node utilities/check_all.mjs
//   node utilities/check_all.mjs --quick     (skip the slow ones)
//   node utilities/check_all.mjs viewer      (one page: viewer | browser | mobile)
//
// There are fifteen harnesses across three pages, each with its own argument
// list, spread across three handoff documents. Nobody runs all of them by hand
// every time, and it showed: two coverage gaps in decoder_snapshot.mjs went
// unnoticed because a change was verified with the two checks that seemed
// relevant rather than with everything.
//
// This also does the setup. The forks have to be extracted from the .hqx files
// before most checks can run, and that is the step most likely to be forgotten.

import {execFileSync, execSync} from 'node:child_process';
import {existsSync, mkdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TMP = process.env.TMPDIR ? resolve(process.env.TMPDIR) : '/tmp';
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const only = args.find(a => !a.startsWith('--'));

const DATA = `${TMP}/Cythera Data.data`;
const DATA_RSRC = `${TMP}/Cythera Data.rsrc`;
const APP_RSRC = `${TMP}/Cythera.rsrc`;

// ---- finding the inputs ----------------------------------------------------
// These used to be fixed paths under sources/, a scratch directory that is not
// in the repository, so every fresh checkout had to be told to symlink res/
// into it before anything could run -- and a run that skipped that step
// reported most of its checks as "skip", which reads like a clean result. The
// copies in reference/ are the same files under slightly different names,
// so look there first and keep sources/ working for anyone who already has it.
//
// reference/ is NOT in the repository -- it is the game, and the game is
// not ours to publish. A fresh checkout has to be given a copy of Cythera
// before any of this runs; without one, the checks that need it skip.
function firstExisting(...paths) {
  for (const p of paths) if (p && existsSync(resolve(ROOT, p))) return p;
  return paths[paths.length - 1];   // report the conventional name when nothing is there
}

// The three reference checkouts are identified by a file INSIDE them, not by
// the directory being there, and the difference is not pedantry: `git clone`
// without --recurse-submodules leaves delvmod/ present and empty, a
// directory test picks it, and the two checks that read it fail with
// `ENOENT ... delvmod/delv/archive.py` -- which reads like a regression in
// the viewer and is not one. (That is exactly what a Claude Code session
// sees, since the web sessions clone each repository flat and the forks
// arrive as siblings rather than as a submodule.) Probing the marker walks
// past the empty directory to the checkout that actually has the file, and
// when there is none it returns the marker's own path, so the row skips and
// names the file it wanted instead of running and blowing up.
//
// Every candidate is resolved against ROOT rather than the invoking
// directory, because process.chdir(ROOT) happens further down: a run started
// from anywhere but the repository root used to resolve these against one
// directory and then use them from another.
function firstHolding(marker, ...paths) {
  for (const p of paths) if (p && existsSync(resolve(ROOT, p, marker))) return p;
  return `${paths[paths.length - 1]}/${marker}`;
}

const HQX = firstExisting('reference/game/Cythera Data.hqx',
  'reference/Cythera Data.hqx', 'sources/Cythera Data.hqx');
const APP_HQX = firstExisting('reference/game/Cythera.hqx',
  'reference/Cythera.hqx', 'sources/Cythera.hqx');
// The 1.0.4 installer as Bryce Schroeder serves it (www.bryce.pw/Cythera.bin),
// a MacBinary of the Installer VISE application: what index.html now
// fetches by default, and what vise_check.mjs opens.
// The last candidate is where fetch_game.mjs caches the archive it downloads,
// so a checkout without the game runs this check too rather than skipping it:
// vise_check.mjs takes a .sit as readily as a .bin, since sniffViseInstaller
// opens both. It resolves to that path whether or not the file is there yet --
// `want` is tested after the setup step has had its chance to create it.
const VISE_BIN = firstExisting('reference/game/installers/Cythera.bin',
  'reference/original_installers/Cythera.bin', 'reference/Cythera.bin',
  `${TMP}/Cythera installers (archive.org).sit`);
// archive.org's four-in-one StuffIt archive of the installers, the page's
// first default; the UI smoke drives the version switch with it and falls
// back to the .bin when it is not there.
const VISE_ALL = firstExisting('reference/game/installers/Cythera installers (archive.org).sit',
  'reference/original_installers/Cythera installers (archive.org).sit', VISE_BIN);
const APP_DATA = `${TMP}/Cythera.data`;
/* A real installed Cythera folder, as a StuffIt archive: the one input here
   with nested folders in it, and so the only one that exercises the folder
   walk in js/mac-stuffit.js. Optional, like everything under reference/. */
const INSTALLED_SIT = 'reference/game/installed-folders/Cythera Installed Folder with Preferences & License.sit';

// delvmod is the reference implementation this project's knowledge of the
// archive came from, and two checks read its Python to catch the copies here
// drifting from it. It is a submodule at delvmod, so a checkout that
// ran `git submodule update --init` has it; a clone of the fork kept beside
// this repository is found too, $DELVMOD overrides for one kept anywhere
// else, and the old sources/ location still works.
const DELV = firstHolding('delv/archive.py', process.env.DELVMOD, 'delvmod',
  'sources/github_delvmod/code', '../delvmod');
// benletchford/systemless, whose HFS reader is what the disk-image writer is
// round-tripped through. Like infinite-mac it is a checkout kept beside this
// one rather than in it; $SYSTEMLESS overrides. Without it hfs_check still
// runs its structural half, which is most of it.
const SYSLESS = firstHolding('src/disk_image/hfs.rs', process.env.SYSTEMLESS, 'systemless', '../systemless');
// The community's add-ons. Not required: without them addons_check.mjs still
// scores the heuristic against the shipped archive, which is the half that
// matters most.
const ADDONS = firstExisting('reference/community/addons', 'reference/user_addons');
// A Cythera saved game, for the smoke test's saved-game section. It is the
// one complete player file in the add-ons, and addons_check.mjs unpacks it
// here on its run, which comes first in the list; without unar, or without
// the add-ons, the section notes the absence and the rest of the smoke test
// runs as before.
const SAVE = `${TMP}/cythera_addons/606_CheaterSavedGame/I.M.Cheater`;
const GFX_REF = `${TMP}/gfx_ref.json`;
const EXPORTS = `${TMP}/check_all_exports`;

process.chdir(ROOT);

function say(s) { process.stdout.write(s + '\n'); }

// ---- setup -----------------------------------------------------------------
// The local copies first: extracting a .hqx that is already on disk costs a
// second and needs no network. When one is not there, fall back to fetching
// the installer from archive.org and reading it with the page's own two
// tiers -- see utilities/fetch_game.mjs for why, and for what that does and
// does not prove. $NO_FETCH skips the fallback for anyone who wants the old
// behaviour of skipping instead.
async function ensureForks() {
  const need = [[HQX, DATA], [APP_HQX, APP_RSRC]];
  let missing = false;
  for (const [src, out] of need) {
    if (existsSync(out)) continue;
    if (!existsSync(src)) { missing = true; continue; }
    say(`  extracting ${src} …`);
    execFileSync('python3', ['utilities/binhex_decode.py', src, TMP], {stdio: 'ignore'});
  }
  if (!missing) return;
  if (process.env.NO_FETCH) {
    say('  ! the game is not in reference/ and $NO_FETCH is set; some checks will be skipped');
    return;
  }
  say('  ! the game is not in reference/ — fetching it instead');
  const {fetchGame} = await import('./fetch_game.mjs');
  if (!await fetchGame(TMP, say))
    say('  ! could not get the game; some checks will be skipped');
}

function ensureGraphicsRef() {
  if (existsSync(GFX_REF) || !existsSync(DELV) || !existsSync(DATA)) return;
  say('  building the delvmod graphics reference …');
  try {
    const json = execFileSync('python3', ['utilities/delv_graphics_ref.py', DELV, DATA],
      {maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore']});
    execSync(`cat > "${GFX_REF}"`, {input: json});
  } catch (e) {
    say('  ! could not build it: ' + (e.message || '').split('\n')[0]);
  }
}

// ---- the checks ------------------------------------------------------------
// `want` lists the files that must exist for a check to be meaningful; if one
// is missing the check is skipped and said to be skipped, rather than failing
// in a way that looks like a real problem.
const CHECKS = [
  {page: 'viewer', name: 'static', cmd: ['utilities/verify_viewer.mjs', 'index.html']},
  {page: 'viewer', name: 'decoder snapshot', want: [DATA],
   cmd: ['utilities/decoder_snapshot.mjs', 'index.html', DATA], grep: /SNAPSHOT \w+/},
  // Synthetic on purpose: none of Cythera's twenty-one PICTs uses the
  // uncompressed 1-bit opcodes, so no snapshot over the game's resources can
  // notice this path breaking. The viewer opens any resource fork, not only
  // this game's.
  {page: 'viewer', name: 'PICT BitsRect',
   cmd: ['utilities/pict_bits_check.mjs', 'index.html'],
   grep: /\d+ synthetic pictures/},
  {page: 'viewer', name: 'delvmod tables', want: [DATA, DELV],
   cmd: ['utilities/delv_crosscheck.mjs', 'index.html', DELV, DATA]},
  {page: 'viewer', name: 'delvmod graphics', want: [DATA, GFX_REF],
   cmd: ['utilities/delv_graphics_check.mjs', 'index.html', DATA, GFX_REF],
   grep: /identical pixels : \d+/},
  // The writer's oracle needs only delvmod -- its synthetic archives are
  // built on the fly -- so unlike the read checks it runs on a checkout
  // without the game. DATA is passed anyway: when the game is there the
  // check also proves the real archive re-serializes byte-identically.
  {page: 'viewer', name: 'delvmod write', want: [DELV],
   cmd: ['utilities/delv_write_check.mjs', 'index.html', DELV, DATA],
   grep: /all comparisons passed/},
  // ddasm's Disassembler RUN against dvmDisassemble, decode event by decode
  // event, over every script in the archive -- the walk check that
  // delv_crosscheck's table comparison never was. It spawns its own Python
  // reference (delv_dasm_ref.py), so delvmod and the archive are all it needs.
  {page: 'viewer', name: 'delvmod disassembly', want: [DATA, DELV],
   cmd: ['utilities/delv_dasm_check.mjs', 'index.html', DELV, DATA],
   grep: /\d+ functions compared[^\n]*/},
  // The conversation extractor against the community's verified dialogue
  // collection (cytheraguides.com, gathered in play). The oracle directory
  // is gitignored -- when it is absent the harness still runs its
  // structural half against the archive and passes on that alone.
  {page: 'viewer', name: 'dialogue vs guides', want: [DATA],
   cmd: ['utilities/dialogue_check.mjs', 'index.html', DATA],
   grep: /\d+ characters, [\d,]+ topics.*/},
  {page: 'viewer', name: 'archive loading', want: [HQX, DATA, DATA_RSRC, APP_HQX],
   cmd: ['utilities/loader_test.mjs', 'index.html', HQX, DATA, DATA_RSRC, APP_HQX, VISE_BIN]},
  // The installer: js/mac-vise.js against the catalog's own CRC for every
  // file, and against the BinHex copies for the two files the suite knows.
  {page: 'viewer', name: 'installer', want: [VISE_BIN],
   cmd: ['utilities/vise_check.mjs', VISE_BIN, DATA, DATA_RSRC, APP_DATA, APP_RSRC, INSTALLED_SIT],
   grep: /\d+ files, \d+ extracted, \d+ CRC mismatches/},
  // The heuristic half of smartDecrypt, scored against the tables that
  // normally answer for it, plus the community's add-ons -- the only Cythera
  // archives here that nobody in this project made.
  {page: 'viewer', name: 'addons + heuristic', want: [DATA],
   cmd: ['utilities/addons_check.mjs', 'index.html', DATA, ADDONS],
   grep: /heuristic [\d.]+% vs the tables \([^)]*\)/},
  /* The undither, scored against a known original. It needs no archive: the
     sources are synthetic and the forward process is the page's own
     ditherizer, so this is the one check here that measures a decoder against
     the thing it is trying to recover rather than against another decoder or
     against yesterday's output. */
  {page: 'viewer', name: 'undither vs truth',
   cmd: ['utilities/undither_check.mjs', 'index.html'],
   grep: /measured is [\d.]+% better overall for [\d.]+% at edges/},
  /* The Mechanics sheet's probabilities: the closed-form models in
     js/delv-mechanics.js against a Monte Carlo simulation of the same rules
     in utilities/mech_ref.mjs, written from the sheet's prose rather than
     from the models. Every other number on that sheet is read off the
     archive and has delvmod or the disassembly behind it; the odds had
     nothing at all, and a closed form draws a plausible curve whatever it
     computes. It needs no archive, no delvmod and no network, so unlike
     almost everything here it never skips. */
  /* The resource-fork WRITER against the two forks Apple's own Resource
     Manager wrote in 1999 and this repository happens to hold: read each,
     hand it straight back, require the bytes identical. No specification was
     trusted for it -- four orders and five as-found fields were each found by
     failing this. The synthetic half needs no game and never skips. */
  {page: 'viewer', name: 'resource fork write',
   cmd: ['utilities/resfork_write_check.mjs', 'index.html', DATA_RSRC, APP_RSRC],
   grep: /\d+ shipped fork\(s\) rewritten byte for byte[^\n]*/},
  {page: 'viewer', name: 'rule models',
   cmd: ['utilities/mech_check.mjs', 'js/delv-mechanics.js'],
   grep: /\d+ comparisons agree[^\n]*/},
  {page: 'viewer', name: 'ui smoke', want: [DATA], slow: true,
   cmd: ['utilities/viewer_smoke.mjs', 'index.html', DATA, '', VISE_ALL, SAVE],
   grep: /\d+ galleries, [\d,]+ tiles/},
  {page: 'viewer', name: 'zip export', want: [DATA], slow: true,
   cmd: ['utilities/export_test.mjs', 'index.html', DATA, EXPORTS], zips: EXPORTS},

  // The classic-Mac resource decoders used to be a page of their own
  // (resource_fork_browser.html) with three checks against it. The page is
  // gone -- it was more general-purpose than this repository -- and the
  // decoders are js/mac-rsrc-types.js, read by index.html. The snapshot
  // moved with them and its hash did not change, which is what says nothing
  // was lost on the way; the two UI checks it had are now the fork sections
  // of viewer_smoke.mjs.
  {page: 'viewer', name: 'resource snapshot', want: [APP_RSRC, DATA_RSRC],
   cmd: ['utilities/rsrc_snapshot.mjs', 'index.html', APP_RSRC, DATA_RSRC],
   grep: /SNAPSHOT \w+/},

  // The HFS disk-image writer index.html exports with. Structural on its
  // own; with a systemless checkout beside this one it also round-trips every
  // volume through that project's reader. Slow only the first time, when it
  // has to build the reader's example binary.
  {page: 'viewer', name: 'disk image', slow: true,
   cmd: ['utilities/hfs_check.mjs', 'index.html', SYSLESS],
   grep: /\d+ volumes, \d+ structural checks[^\n]*/},

];

// ---- run -------------------------------------------------------------------
say(`\n  Cythera checks — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
await ensureForks();
if (!only || only === 'viewer') ensureGraphicsRef();
mkdirSync(EXPORTS, {recursive: true});

const rows = [];
let failed = 0, skipped = 0;
for (const check of CHECKS) {
  if (only && check.page !== only) continue;
  if (quick && check.slow) { rows.push([check.page, check.name, 'skip', '--quick']); skipped++; continue; }
  const missing = (check.want || []).filter(p => !existsSync(p));
  if (missing.length) {
    rows.push([check.page, check.name, 'skip', 'needs ' + missing.map(m => m.replace(TMP + '/', '')).join(', ')]);
    skipped++;
    continue;
  }
  const t0 = Date.now();
  let out = '', ok = true;
  try {
    out = execFileSync('node', check.cmd, {maxBuffer: 64 << 20, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  } catch (e) {
    ok = false;
    out = (e.stdout || '') + (e.stderr || '');
  }
  // A hand-written zip is exactly the sort of thing that looks fine and
  // unpacks to nothing, so the archives get validated rather than trusted.
  if (ok && check.zips) {
    try { execSync(`for z in "${check.zips}"/*.zip; do unzip -t "$z" > /dev/null || exit 1; done`, {stdio: 'ignore'}); }
    catch (e) { ok = false; out += '\nunzip -t rejected an archive'; }
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  let note = '';
  if (check.grep) { const m = check.grep.exec(out); if (m) note = m[0].trim(); }
  if (!ok) {
    failed++;
    const lines = out.trim().split('\n').filter(l => /FAIL|Error|error/.test(l));
    note = (lines[0] || out.trim().split('\n').pop() || 'failed').slice(0, 96);
  }
  rows.push([check.page, check.name, ok ? 'ok' : 'FAIL', `${note}${note ? '  ' : ''}(${secs}s)`]);
}

const w0 = Math.max(...rows.map(r => r[0].length));
const w1 = Math.max(...rows.map(r => r[1].length));
say('');
for (const [page, name, status, note] of rows) {
  const mark = status === 'ok' ? '  ok  ' : status === 'skip' ? ' skip ' : ' FAIL ';
  say(`  ${page.padEnd(w0)}  ${name.padEnd(w1)}  ${mark}  ${note}`);
}

const ran = rows.length - skipped;
say(`\n  ${ran} checks run, ${failed} failed, ${skipped} skipped`);
if (failed) say('  Re-run a failing one on its own to see its full output.');
process.exit(failed ? 1 : 0);
