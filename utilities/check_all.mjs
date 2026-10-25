#!/usr/bin/env node
// Runs every check in this directory and prints one table.
//
//   node utilities/check_all.mjs
//   node utilities/check_all.mjs --quick     (skip the slow ones)
//   node utilities/check_all.mjs viewer      (one page: viewer | browser | mobile)
//   node utilities/check_all.mjs 'in the game'   (one check by its name, its whole output after the table)
//   CHECK_JOBS=1 node utilities/check_all.mjs   (one at a time, as it ran until 18 September 2026)
//
// The checks run several at a time, up to CHECK_JOBS of them (four unless
// set otherwise: each is a Node process holding the whole page, and this
// is an 8 GB machine). Every check is a separate process writing to a separate
// temp directory, so the only order that matters is written down as `after`
// on the checks that read what another one unpacks; the table is printed in
// the list's order whatever order they finished in.
//
// There are fifteen harnesses across three pages, each with a separate argument
// list, spread across three handoff documents. Nobody runs all of them by hand
// every time, and it showed: two coverage gaps in decoder_snapshot.mjs went
// unnoticed because a change was verified with the two checks that seemed
// relevant rather than with everything.
//
// This also does the setup. The forks have to be extracted from the .hqx files
// before most checks can run, and that is the step most likely to be forgotten.

import {execFile, execFileSync, execSync} from 'node:child_process';
import {existsSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import {availableParallelism} from 'node:os';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const TMP = process.env.TMPDIR ? resolve(process.env.TMPDIR) : '/tmp';
const args = process.argv.slice(2);
const quick = args.includes('--quick');
const only = args.find(a => !a.startsWith('--'));
const JOBS = Math.max(1, parseInt(process.env.CHECK_JOBS, 10) || Math.min(4, availableParallelism()));

const DATA = `${TMP}/Cythera Data.data`;
const DATA_RSRC = `${TMP}/Cythera Data.rsrc`;
const APP_RSRC = `${TMP}/Cythera.rsrc`;

// ---- finding the inputs ----------------------------------------------------
// These were once fixed paths under sources/, a scratch directory that is not
// in the repository, so every fresh checkout had to symlink res/ by hand
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
// sit as siblings rather than as a submodule.) Probing the marker walks
// past the empty directory to the checkout that actually has the file, and
// when there is none it returns the marker's path, so the row skips and
// gives the file it needed instead of running and blowing up.
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
// With neither .hqx the forks come from the installer, through fetch_game.mjs:
// a different copy of the same game, which one pinned value distinguishes
// (`expectFetched` below).
const FETCHED_FORKS = !existsSync(resolve(ROOT, HQX)) && !existsSync(resolve(ROOT, APP_HQX));
// The 1.0.4 installer as Bryce Schroeder serves it (www.bryce.pw/Cythera.bin),
// a MacBinary of the Installer VISE application: what index.html now
// fetches by default, and what vise_check.mjs opens.
// The last candidate is where fetch_game.mjs caches the archive it downloads,
// so a checkout without the game runs this check too rather than skipping it:
// vise_check.mjs accepts a .sit as readily as a .bin, since sniffViseInstaller
// opens both. It resolves to that path whether or not the file is there yet --
// `requiredInputs` is tested after the setup step has had its chance to create it.
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
const PEF_SYMBOLS = firstHolding('cythera_symbols.txt', process.env.WORKBENCH, '../cythera-workbench', 'cythera-workbench') + '/cythera_symbols.txt';
// The reader was src/disk_image/hfs.rs until upstream's refactor of
// 27 September 2026 moved it under src/systems/macintosh/. This line looked
// for the old path alone, so from the fork's next rebase until 13 October the
// suite found no checkout, hfs_check ran its structural half and printed "0
// round-tripped", and the row read ok: it had no expected line to miss. Both
// paths are looked for now, and the round trip is a separate row with an
// expected line, skipped by name when the fork's example is not there.
const HFS_READER = ['src/systems/macintosh/disk_image/hfs.rs', 'src/disk_image/hfs.rs'];
const SYSLESS = [process.env.SYSTEMLESS, 'wolflizard', '../wolflizard', 'systemless', '../systemless']
  .find(p => p && HFS_READER.some(m => existsSync(resolve(ROOT, p, m)))) || '../systemless';
// LLVM's PowerPC disassembler, which ppc_check.mjs checks js/mac-ppc.js against.
// Nothing here installs it: Homebrew's llvm formula has it, as does a Linux
// distribution's llvm package, and $LLVM_MC overrides. Without it that one
// check skips and states it.
function findLlvmMc() {
  if (process.env.LLVM_MC) return process.env.LLVM_MC;
  try { const p = execSync('command -v llvm-mc', {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); if (p) return p; } catch (e) { /* not on the path */ }
  for (const base of ['/opt/homebrew/opt', '/usr/local/opt', '/usr/lib']) {
    let names = [];
    try { names = readdirSync(base).filter(n => /^llvm(@\d+|-\d+)?$/.test(n)).sort().reverse(); } catch (e) { /* no such directory */ }
    for (const n of names) if (existsSync(`${base}/${n}/bin/llvm-mc`)) return `${base}/${n}/bin/llvm-mc`;
  }
  return 'llvm-mc';
}
const LLVM_MC = findLlvmMc();
// resource_dasm, the second decoder that dasm_check.mjs compares
// js/mac-rsrc-types.js with: $RESOURCE_DASM, the PATH, then the workspace's
// copy of the project's macOS release (DISK.md), one level up from a main
// checkout and three from a front. Nothing here installs it, and without it
// both rows skip and state it.
function findResourceDasm() {
  if (process.env.RESOURCE_DASM) return process.env.RESOURCE_DASM;
  try { const p = execSync('command -v resource_dasm', {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); if (p) return p; } catch (e) { /* not on the path */ }
  return firstExisting('../resource_dasm-bin/release-macos/resource_dasm',
    '../../../resource_dasm-bin/release-macos/resource_dasm');
}
const RESOURCE_DASM = findResourceDasm();
// A Chrome or Chromium, for browser_check.mjs: the one check that runs the
// page in a browser rather than in node:vm. $CHROME, the PATH, then the
// Mac's Applications folder; without one that row skips and states it.
function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  for (const name of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try { const p = execSync(`command -v ${name}`, {encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore']}).trim(); if (p) return p; } catch (e) { /* not on the path */ }
  }
  for (const p of ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium'])
    if (existsSync(p)) return p;
  return 'google-chrome';
}
const CHROME = findChrome();
// The community's add-ons. Not required: without them addons_check.mjs still
// scores the heuristic against the shipped archive, which is the half that
// matters most.
const ADDONS = firstExisting('reference/community/addons', 'reference/user_addons');
// The community's dialogue collection, which the game fixes' typo list was
// read out of; gitignored, and data_fix_check.mjs compares the two only
// when it is here.
const COLLECTION = 'reference/community/guides-site/dialogue/Dialogue';
// A Cythera saved game, for the smoke test's saved-game section. It is the
// one complete player file in the add-ons, and addons_check.mjs unpacks it
// here on its run, which the three checks that read it wait for (`after`);
// without unar, or without the add-ons, the section notes the absence and
// the rest of the smoke test runs unchanged.
const SAVE = `${TMP}/cythera_addons/606_CheaterSavedGame/I.M.Cheater`;
const GFX_REF = `${TMP}/gfx_ref.json`;
// QuickTime 3's Windows installer, which contains the instruments the tunes
// were played through: archive.org's copy, through /cors/ like the page
// fetches it, 7 MB once and cached here (ensureQuickTime).
const QT_EXE = `${TMP}/QUICKTIM.EXE`;
const QT_URL = 'https://archive.org/cors/apple-quicktime-3/apple-quicktime-3.iso/QUICKTIM.EXE';
const ART_PACK = `${TMP}/dungeon-crawl-tiles.zip`;
const ART_PACK_URL = 'https://opengameart.org/sites/default/files/Dungeon%20Crawl%20Stone%20Soup%20Full_0.zip';
// The game itself, for game_check.mjs: the playthrough kit beside the
// workspace (saves reached by play, in no repository), the fork's binary
// built against the patched m68k crate (the stock crate halts a new game;
// `m68k-patched/README.md` in the workspace), and the registered licence,
// without which the shareware notice swallows the first click. A front's
// `..` is the front, so the workspace is one more level up. Without any of
// the three the row skips and states it.
const KIT = firstHolding('work/pristine/.systemless', process.env.PLAYKIT, '../playthrough-2026-09-08', '../../../playthrough-2026-09-08');
const GAME_BIN = firstExisting(process.env.SYSTEMLESS_BIN, '../m68k-patched/systemless', '../../../m68k-patched/systemless');
const LICENSE = firstExisting('reference/game/installed-folders/Cythera License (registered).data',
  '../cythera-reference/game/installed-folders/Cythera License (registered).data');
const EXPORTS = `${TMP}/check_all_exports`;

process.chdir(ROOT);

function writeLine(s) { process.stdout.write(s + '\n'); }

// ---- setup -----------------------------------------------------------------
// The local copies first: extracting a .hqx that is already on disk costs a
// second and needs no network. When one is not there, fall back to fetching
// the installer from archive.org and reading it with the page's two
// tiers -- see utilities/fetch_game.mjs for why, and for what that does and
// does not prove. $NO_FETCH skips the fallback for anyone who wants the old
// behaviour of skipping instead.
async function ensureForks() {
  const extractions = [[HQX, DATA], [APP_HQX, APP_RSRC]];
  let missing = false;
  for (const [src, out] of extractions) {
    if (existsSync(out)) continue;
    if (!existsSync(src)) { missing = true; continue; }
    writeLine(`  extracting ${src} …`);
    execFileSync('python3', ['utilities/binhex_decode.py', src, TMP], {stdio: 'ignore'});
  }
  if (!missing) return;
  if (process.env.NO_FETCH) {
    writeLine('  ! the game is not in reference/ and $NO_FETCH is set; some checks will be skipped');
    return;
  }
  writeLine('  ! the game is not in reference/ — fetching it instead');
  const {fetchGame} = await import('./fetch_game.mjs');
  if (!await fetchGame(TMP, writeLine))
    writeLine('  ! could not get the game; some checks will be skipped');
}

// The Dungeon Crawl Stone Soup tiles, CC0, for artpack_check.mjs: the pack
// Make a Scenario's art pack choice is written for, 6 MB once and cached.
async function ensureArtPack() {
  if (existsSync(ART_PACK) || process.env.NO_FETCH) return;
  writeLine('  fetching the Dungeon Crawl tiles from opengameart.org …');
  try {
    const res = await fetch(ART_PACK_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    writeFileSync(ART_PACK, new Uint8Array(await res.arrayBuffer()));
  } catch (e) { writeLine('  ! could not: ' + e.message + '; the art pack check will be skipped'); }
}

async function ensureQuickTime() {
  if (existsSync(QT_EXE) || process.env.NO_FETCH) return;
  writeLine('  fetching QuickTime 3 from archive.org for its instruments …');
  try {
    const res = await fetch(QT_URL);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    writeFileSync(QT_EXE, new Uint8Array(await res.arrayBuffer()));
  } catch (e) { writeLine('  ! could not: ' + e.message + '; the QuickTime check will be skipped'); }
}

function ensureGraphicsRef() {
  if (existsSync(GFX_REF) || !existsSync(DELV) || !existsSync(DATA)) return;
  writeLine('  building the delvmod graphics reference …');
  try {
    const json = execFileSync('python3', ['utilities/delv_graphics_ref.py', DELV, DATA],
      {maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'ignore']});
    execSync(`cat > "${GFX_REF}"`, {input: json});
  } catch (e) {
    writeLine('  ! could not build it: ' + (e.message || '').split('\n')[0]);
  }
}

// ---- the checks ------------------------------------------------------------
// `requiredInputs` has the files that must exist for a check to be meaningful; if one
// is missing the check is skipped and reported as skipped, rather than failing
// in a way that looks like a real problem.
const CHECKS = [
  {page: 'viewer', name: 'static', cmd: ['utilities/verify_viewer.mjs', 'index.html']},
  /* js/mac-*.js against ratlizard/mac-files, which they are copies of: beside
     this checkout, at ~/e-z-g-cythera/mac-files, or where MAC_FILES points. */
  {page: 'viewer', name: 'copies', cmd: ['utilities/copies_check.mjs'],
   grep: /\d+ mac-\* files, \d+ identical/},
  /* Is every function the page declares reached by anything? `static` tests the
     opposite question -- whether every name the JS calls is declared -- and a
     feature shipped on 14 September 2026 that did not run, because its reader
     was written and never called. Every check passed. This one would not have.
     It has a baseline of the twenty-two already unreached, which cannot
     rot, and a negative control on every run. */
  {page: 'viewer', name: 'unreached code',
   cmd: ['utilities/reach_check.mjs', 'index.html'],
   grep: /\d+ functions declared[^\n]*/},
  /* Is every class the page puts on an element styled? Deleting the old
     World renderer took the atlas panel's stylesheet with it and nothing
     here noticed: markup intact, ids resolved, functions declared. Pinned
     baseline of the hooks nothing styles, in reach_check's manner. */
  {page: 'viewer', name: 'stylesheet',
   cmd: ['utilities/css_check.mjs', 'index.html'],
   grep: /css: [^\n]*/},
  {page: 'viewer', name: 'decoder snapshot', requiredInputs: [DATA],
   cmd: ['utilities/decoder_snapshot.mjs', 'index.html', DATA], grep: /SNAPSHOT \w+/,
   expect: 'SNAPSHOT 8843a9f3d2aeb2be'},
  // Synthetic on purpose: none of Cythera's twenty-one PICTs uses the
  // uncompressed 1-bit opcodes, so no snapshot over the game's resources can
  // notice this path breaking. The viewer opens any resource fork, not only
  // this game's.
  {page: 'viewer', name: 'PICT BitsRect',
   cmd: ['utilities/pict_bits_check.mjs', 'index.html'],
   grep: /\d+ synthetic pictures/},
  // Replace with a PNG writes an image back in the form it had; a round
  // trip through the decoders over every image resource of both forks.
  {page: 'viewer', name: 'image write', requiredInputs: [DATA_RSRC, APP_RSRC],
   cmd: ['utilities/image_write_check.mjs', 'index.html', DATA_RSRC, APP_RSRC],
   grep: /image write: 139 images/},
  // The start screen's buttons: their carved words lifted off clean, against
  // the shipped pictures; the new words are drawn in browser_check.mjs.
  {page: 'viewer', name: 'start buttons', requiredInputs: [DATA_RSRC],
   cmd: ['utilities/plaque_check.mjs', 'index.html', DATA_RSRC],
   grep: /plaques: 12 buttons lifted clean[^\n]*/},
  /* Is the oracle current? delvmod is a fork this project pushes fixes to,
     and a fix to it is worth nothing if the copy the suite compares against
     is older. Placed before the delvmod checks so that a stale oracle is read
     as the reason they agreed, rather than as a reassurance. */
  {page: 'viewer', name: 'oracle currency', requiredInputs: [DELV],
   cmd: ['utilities/oracle_check.mjs', DELV],
   grep: /the oracle is[^\n]*/},
  {page: 'viewer', name: 'delvmod tables', requiredInputs: [DATA, DELV],
   cmd: ['utilities/delv_crosscheck.mjs', 'index.html', DELV, DATA]},
  {page: 'viewer', name: 'delvmod graphics', requiredInputs: [DATA, GFX_REF],
   cmd: ['utilities/delv_graphics_check.mjs', 'index.html', DATA, GFX_REF],
   grep: /identical pixels : \d+/},
  // The writer's oracle needs only delvmod -- its synthetic archives are
  // built on the fly -- so unlike the read checks it runs on a checkout
  // without the game. DATA is passed anyway: when the game is there the
  // check also proves the real archive re-serializes byte-identically.
  {page: 'viewer', name: 'delvmod write', requiredInputs: [DELV], after: ['addons + heuristic'],
   cmd: ['utilities/delv_write_check.mjs', 'index.html', DELV, DATA, SAVE],
   grep: /all comparisons passed/},
  // ddasm's Disassembler RUN against dvmDisassemble, decode event by decode
  // event, over every script in the archive -- the walk check that
  // delv_crosscheck's table comparison never was. It spawns a separate Python
  // reference (delv_dasm_ref.py), so delvmod and the archive are all it needs.
  {page: 'viewer', name: 'delvmod disassembly', requiredInputs: [DATA, DELV],
   cmd: ['utilities/delv_dasm_check.mjs', 'index.html', DELV, DATA],
   grep: /\d+ functions compared[^\n]*/},
  // The conversation extractor against the community's verified dialogue
  // collection (cytheraguides.com, gathered in play). The oracle directory
  // is gitignored -- when it is absent the harness still runs its
  // structural half against the archive and passes on that alone.
  {page: 'viewer', name: 'dialogue vs guides', requiredInputs: [DATA],
   cmd: ['utilities/dialogue_check.mjs', 'index.html', DATA],
   grep: /\d+ characters, [\d,]+ topics.*/},
  {page: 'viewer', name: 'archive loading', requiredInputs: [HQX, DATA, DATA_RSRC, APP_HQX],
   cmd: ['utilities/loader_test.mjs', 'index.html', HQX, DATA, DATA_RSRC, APP_HQX, VISE_BIN]},
  // The installer: js/mac-vise.js against the catalog's CRC for every
  // file, and against the BinHex copies for the two files the suite has.
  {page: 'viewer', name: 'installer', requiredInputs: [VISE_BIN],
   cmd: ['utilities/vise_check.mjs', VISE_BIN, DATA, DATA_RSRC, APP_DATA, APP_RSRC, INSTALLED_SIT],
   grep: /\d+ files, \d+ extracted, \d+ CRC mismatches/},
  // The heuristic half of smartDecrypt, scored against the tables that
  // normally answer for it, plus the community's add-ons -- the only Cythera
  // archives here that nobody in this project made.
  /* Is the folded script view a faithful reorganisation of the disassembly?
     It rests on an arity table that is written down in no source anywhere --
     not delvmod, not the wiki -- so the check measures it three ways and has
     a separate control. See the harness header. */
  /* Can the page write what it reads? js/delv-asm.js assembles one
     instruction a line and relinks a resource around a splice; the check
     assembles every instruction in the archive back to its bytes, relinks
     every resource with a header four bytes on and reads it back from
     outside, and makes the relinker drop one kind of target to prove the
     reading back can fail. See the harness header. */
  {page: 'viewer', name: 'script writing',
   cmd: ['utilities/asm_check.mjs', 'index.html', DATA],
   requiredInputs: [DATA],
   grep: /script writing: [^\n]*/},
  {page: 'viewer', name: 'folded listing',
   cmd: ['utilities/fold_check.mjs', 'index.html', DATA],
   requiredInputs: [DATA],
   grep: /folded \d+ functions[^\n]*/},
  /* And does turning those jumps into blocks preserve the control flow? A
     different kind of risk from the fold's: a misread jump renders a wrong
     program that looks right, which no assertion about statements can catch.
     See the harness header for the eleven assertions and the nine
     controls, each named for the assertion it must fail; two of the
     assertions are exercised by synthetic functions, the archive having
     no shape that reaches them. */
  {page: 'viewer', name: 'recovered structure',
   cmd: ['utilities/structure_check.mjs', 'index.html', DATA],
   requiredInputs: [DATA],
   grep: /structured \d+ of \d+[^\n]*/},
  /* And does the Read view say everything the recovered tree does? Every
     call, every test and every string of every function, held to the
     function's ops; three controls in the harness header. */
  {page: 'viewer', name: 'code read aloud',
   cmd: ['utilities/read_check.mjs', 'index.html', DATA],
   requiredInputs: [DATA],
   grep: /read \d+ functions[^\n]*/},
  {page: 'viewer', name: 'addons + heuristic', requiredInputs: [DATA],
   cmd: ['utilities/addons_check.mjs', 'index.html', DATA, ADDONS],
   grep: /heuristic [\d.]+% vs the tables \([^)]*\)/},
  /* Applying a Magpie patch -- the one add-on system Cythera has. The merge
     re-serializes the whole 5.6 MB archive, so what this asserts is that
     nothing moved except the resources the patch names; the writer itself has
     a separate oracle in delv_write_check.mjs. It once skipped without `unar`,
     which extracted the patch out of its StuffIt archive; the page does that
     itself since method 13 landed, so getting the patch out of the .hqx is
     part of what this proves now. */
  {page: 'viewer', name: 'magpie patch', requiredInputs: [DATA], after: ['addons + heuristic'],
   cmd: ['utilities/patch_check.mjs', 'index.html', DATA, ADDONS],
   grep: /\d+ of [\d,]+ resources replaced, [\d,]+ bytes out(?:; \d+ tiles of \d+ redrawn across \d+ sheets)?/},
  /* The game's fixes (js/delv-datafixes.js, js/delv-datapatch.js), which the
     Patches section offers one by one: every fix alone, the text with each
     option and each spelling, every fix together in both spellings, a fix
     applied twice rejected by name, and the community's typo list against
     the collection it was read out of, when the collection is here. The
     patched file with every fix is pinned: a change to any fix moves it, and
     the value moves in the same commit. `--full` adds each fix left out,
     about a minute, and is run when a fix is added. */
  {page: 'viewer', name: 'game fixes', requiredInputs: [DATA],
   cmd: ['utilities/data_fix_check.mjs', 'index.html', DATA, COLLECTION],
   grep: /every fix: [^\n]*/, expect: 'every fix: 345 resources changed, patched file caf8a4e6f71824bb'},
  /* Cythera Data in Spanish (js/delv-translate.js with the table
     js/delv-es.js), both forks: the table covers every piece and has no
     stale entry, every script still disassembles, the keyword lists are the
     ones the table requested, and every highlighted word, clicked, reaches
     the answer its English word did; Argos's family widths have the added
     letters, the Geneva strikes measure as Geneva does; and the program in
     Spanish: every load of its strings reaching the Spanish, its resources'
     shapes, and the names' articles. The two forks'
     hash is pinned, so a
     change to the table or the applier moves it, and the value moves in the
     same commit. */
  {page: 'viewer', name: 'spanish', requiredInputs: [DATA, DATA_RSRC, APP_DATA, APP_RSRC],
   cmd: ['utilities/translate_check.mjs', 'index.html', DATA, DATA_RSRC, APP_DATA, APP_RSRC],
   grep: /\d+ of \d+ highlighted words answer as in English[^\n]*/,
   expect: '509 of 513 highlighted words answer as in English; 0 pieces untranslated; SPANISH 2ca82cf4; the program 232 loads in Spanish',
   expectFetched: '509 of 513 highlighted words answer as in English; 0 pieces untranslated; SPANISH a0a34b80; the program 232 loads in Spanish'},
  /* The two StuffIt compressions this page decompresses, 13 and 15, against
     The Unarchiver's `unar` -- which is the implementation both are ports
     of, so this is a decoder held to its source rather than to a snapshot.
     Every method-13 and method-15 fork in the reference corpus goes both ways
     and has to come back byte for byte, and the 1.0.4 installer's resource
     fork is compared against the MacBinary copy as well, which shares no code
     with either. Without `unar` the lengths and the snapshot are still
     checked; without the corpus it skips. */
  {page: 'viewer', name: 'stuffit 13 and 15', requiredInputs: [ADDONS],
   cmd: ['utilities/sit_methods_check.mjs', 'index.html', 'reference'],
   grep: /\d+ of \d+ compressed fork\(s\) in \d+ archive\(s\)[^\n]*/},
  /* StuffIt X (js/mac-stuffitx.js), a port of The Unarchiver's: every fork
     of the three add-ons that are StuffIt X against `unar`, which is its
     source, so the archive's CRC-32s are what is independent; the
     English dictionary against the CRC-32 and count XADMaster states; the
     three saved games opened through extractDelverArchive; and a byte
     changed and a method not read, rejected. Without `unar` or the add-ons
     the archive parts skip. */
  {page: 'viewer', name: 'stuffit x',
   cmd: ['utilities/sitx_check.mjs', 'index.html', 'reference'],
   grep: /\d+ StuffIt X fork\(s\) read back byte identical/},
  /* Compact Pro (js/mac-compactpro.js), a port of The Unarchiver's: every
     fork of the Cythera Makeover kit, the one add-on that is Compact Pro,
     against `unar`, and the archive's CRC-32s; extractDelverArchive
     reading it; a byte changed in a fork and in the catalog, rejected.
     Without `unar` or the add-on the archive parts skip. */
  {page: 'viewer', name: 'compact pro',
   cmd: ['utilities/cpt_check.mjs', 'index.html', 'reference'],
   grep: /\d+ Compact Pro fork\(s\) read back byte identical/},
  /* The zip reader, which needs nothing: zlib is in Node and the container
     is written by the check itself. Info-ZIP, ditto, unar and the add-on each
     add a comparison when they are here and are skipped by name when absent. */
  {page: 'viewer', name: 'zip archives',
   cmd: ['utilities/zip_check.mjs', 'index.html', 'reference'],
   grep: /\d+ zip entries read back byte identical/},
  /* What Ambrosia changed between the four releases, which is only askable
     since all four installers open. A finding rather than a property, so it
     is pinned: 1.0.3 and 1.0.4 have the same data file byte for byte, and a
     decoder change that altered what counts as the same resource would move
     these numbers without moving any snapshot. */
  {page: 'viewer', name: 'between releases', requiredInputs: [VISE_ALL],
   cmd: ['utilities/releases_check.mjs', 'index.html', VISE_ALL ? dirname(VISE_ALL) : 'reference/game/installers'],
   grep: /[^\n]*resources changed/},
  /* The undither, scored against a known original. It needs no archive: the
     sources are synthetic and the forward process is the page's
     ditherizer, so this is the one check here that measures a decoder against
     the thing it is trying to recover rather than against another decoder or
     against yesterday's output. */
  {page: 'viewer', name: 'undither vs truth',
   cmd: ['utilities/undither_check.mjs', 'index.html'],
   grep: /measured is [\d.]+% better overall for [\d.]+% at edges/},
  /* ...and the half that check cannot see. Its sources are synthetic and
     entirely dithered, so it shows nothing about a picture that is dither in
     one part and pixel art in another -- which is every portrait in the game.
     This one checks the frame exactly and requires the face inside it to still
     be reduced, from the real archive, because the evidence for which is
     which is the corpus itself. */
  {page: 'viewer', name: 'portrait frame lock', requiredInputs: [DATA],
   cmd: ['utilities/frame_lock_check.mjs', 'index.html', DATA],
   grep: /the vintner's grapes: \d+\/\d+ pixels exactly as drawn/},
  /* The Mechanics sheet's probabilities: the closed-form models in
     js/delv-mechanics.js against a Monte Carlo simulation of the same rules
     in utilities/mech_ref.mjs, written from the sheet's prose rather than
     from the models. Every other number on that sheet is read off the
     archive and has delvmod or the disassembly behind it; the odds had
     nothing at all, and a closed form draws a plausible curve whatever it
     computes. It needs no archive, no delvmod and no network, so unlike
     almost everything here it never skips. */
  /* The resource-fork WRITER against the two forks Apple's Resource
     Manager wrote in 1999 and this repository happens to hold: read each,
     hand it straight back, require the bytes identical. No specification was
     trusted for it -- four orders and five as-found fields were each found by
     failing this. The synthetic half needs no game and never skips. */
  {page: 'viewer', name: 'resource fork write',
   cmd: ['utilities/resfork_write_check.mjs', 'index.html', DATA_RSRC, APP_RSRC, APP_DATA],
   grep: /\d+ shipped fork\(s\) rewritten byte for byte[^\n]*/},
  /* js/mac-pef.js over the application's data fork. Structural alone; with
     the workbench's cythera_symbols.txt beside the repository (a sibling
     checkout, or $WORKBENCH) it is held to that independently recovered
     routine list, address for address. */
  {page: 'viewer', name: 'executable', requiredInputs: [APP_DATA],
   cmd: ['utilities/pef_check.mjs', 'js/mac-pef.js', APP_DATA, PEF_SYMBOLS],
   grep: /\d+ routines named[^\n]*/},
  /* js/mac-ppc.js against LLVM's PowerPC disassembler, word for word: the
     application's code section when it is there, every branch-field
     combination, and 300,000 generated words. A word read differently, or
     read here when LLVM rejects it, fails; one LLVM alone reads is counted. */
  {page: 'viewer', name: 'powerpc decoder', requiredInputs: [LLVM_MC],
   cmd: ['utilities/ppc_check.mjs', 'js/mac-ppc.js', 'js/mac-pef.js', LLVM_MC, APP_DATA],
   grep: /[\d,]+ words read the same[^;]*/},
  /* The application patch (js/delv-apppatch.js, js/delv-appfixes.js) and the
     assembler it writes with (js/mac-ppc-asm.js): every code word the
     decoder reads written back the same, every line of every fix against
     llvm-mc when it is there, the program patched with every fix and with
     each alone and held to the old one outside what the fixes name, the
     68K half (js/delv-app68k.js) held byte for byte to what the workbench
     builds, and the rejections. Without llvm-mc the lines are held to the
     decoder alone. */
  {page: 'viewer', name: 'application patch', requiredInputs: [APP_DATA, APP_RSRC],
   cmd: ['utilities/app_patch_check.mjs', APP_DATA, APP_RSRC, LLVM_MC],
   grep: /[\d,]+ of [\d,]+ code words written back the same/},
  {page: 'viewer', name: 'rule models',
   cmd: ['utilities/mech_check.mjs', 'js/delv-mechanics.js'],
   grep: /\d+ comparisons agree[^\n]*/},
  /* The version number against what is deployed. Nothing read GRIMOIRE_VERSION
     until 14 September 2026, so a missed bump failed nothing and one was
     missed. It skips outside a git checkout or without a baseline ref, and
     has a separate negative control over every verdict. */
  {page: 'viewer', name: 'version',
   cmd: ['utilities/version_check.mjs', 'index.html'],
   grep: /version [\d.]+[^\n]*/},
  /* The page in a real browser, over HTTP on a loopback port: index.html
     loads with no console error and the last script ran (a load-order fault
     is what stops it, and the node:vm harnesses run the scripts as one
     string, so none of them can see one); the archive opens through the
     page's ?src= path and the world comes up; canvas.html loads clean,
     which is that page's only check. Quiet failures are counted from the
     console (?loud=1). Skips without a Chrome. */
  {page: 'viewer', name: 'browser', requiredInputs: [CHROME],
   cmd: ['utilities/browser_check.mjs', 'index.html', 'canvas.html', HQX],
   grep: /browser: [^\n]*/},
  /* The UI smoke, in eight rows that each start from a fresh boot and run
     at once (viewer_smoke.mjs with no part named is the whole drive in one
     process). The galleries loop is halved across two rows, since it is
     most of the drive's time. */
  ...['galleries-a', 'galleries-b', 'views', 'atlas', 'rules', 'edits', 'saves', 'installer'].map(part => ({
    page: 'viewer', name: 'smoke ' + part, requiredInputs: [DATA], slow: true, after: ['addons + heuristic'],
    cmd: ['utilities/viewer_smoke.mjs', 'index.html', DATA, '', VISE_ALL, SAVE, part],
    grep: part.startsWith('galleries') ? /\d+ galleries, [\d,]+ tiles[^\n]*/ : /clean in [\d.]+ s/})),
  /* Where the Scenario tab's links lead (link_census.mjs): every page of it
     and every character, unit, item and prop type page, each link followed.
     Fails on one that goes from a Scenario page straight to the data file's
     bytes, skipping the component they belong to, and on a component page
     it lands on with no link on down to the bytes -- the maintainer's
     Scenario, Components, Data. Before 16 October 2026 a dossier's Record
     chip and a unit's Stats table chip did the first, 253 links, and every
     script, picture and sound page the second; those runs are the controls.
     About a minute. */
  {page: 'viewer', name: 'scenario links', requiredInputs: [DATA], slow: true,
   cmd: ['utilities/link_census.mjs', 'index.html', DATA],
   grep: /scenario links: [^\n]*/},
  /* Bad input: every real input corrupted a fixed number of ways from a
     fixed seed and handed to the page's entry point, each case in a
     worker under a deadline. A decoder may return or throw; it may not
     fail to stop or take the process down. Has a control that loops on
     purpose and must be reported as a hang. */
  {page: 'viewer', name: 'bad input', requiredInputs: [DATA], slow: true,
   cmd: ['utilities/fuzz_check.mjs', 'index.html', DATA, DATA_RSRC, HQX, VISE_BIN, VISE_ALL,
         firstExisting('reference/community/addons/616_Rocky_the_Flying_Chicken.zip')],
   grep: /fuzz: [^\n]*/},
  /* The game accepts what the site writes: a save edited through the page's
     own writer is seeded as the player file, the fork runs Cythera headless
     to open it and save it again, and the file the game wrote must have
     the edit; the unedited seed is the control. The one oracle the writers
     had lacked -- delvmod is not the game. About forty seconds. */
  {page: 'viewer', name: 'in the game', requiredInputs: [KIT, GAME_BIN, LICENSE], slow: true, alone: true,
   cmd: ['utilities/game_check.mjs', 'index.html', KIT, GAME_BIN, LICENSE, DATA, APP_DATA, APP_RSRC],
   grep: /game: [^\n]*/},
  {page: 'viewer', name: 'zip export', requiredInputs: [DATA], slow: true,
   cmd: ['utilities/export_test.mjs', 'index.html', DATA, EXPORTS], zips: EXPORTS},

  // The classic-Mac resource decoders were once a separate page
  // (resource_fork_browser.html) with three checks against it. The page is
  // gone -- it was more general-purpose than this repository -- and the
  // decoders are js/mac-rsrc-types.js, read by index.html. The snapshot
  // moved with them and its hash did not change, which is what shows nothing
  // was lost on the way; the two UI checks it had are now the fork sections
  // of viewer_smoke.mjs.
  /* The bitmap-font writer against the two strikes Ambrosia shipped. The
     reader walks past the two tables that follow the bit image, so rendering a
     font correctly proves nothing about them; writing the shipped bytes back
     exactly does. Then the other direction, nfntToTrueType: the outlines it
     writes are read back out of the glyf table and filled by winding number
     over the strike's pixel grid, and every pixel must match. Has a
     negative control per font in each direction. */
  {page: 'viewer', name: 'bitmap font write', requiredInputs: [DATA_RSRC],
   cmd: ['utilities/nfnt_write_check.mjs', 'index.html', DATA_RSRC],
   grep: /\d+ of \d+ strikes written as TrueType[^\n]*/},
  // Patches > Behind the Scenes: each fix written into the fork, read back
  // from MacBinary, everything else unchanged, a second run rejected.
  {page: 'viewer', name: 'behind the scenes', requiredInputs: [DATA_RSRC],
   cmd: ['utilities/backstage_check.mjs', 'index.html', DATA_RSRC],
   grep: /\d+ fix, \d+ strings, written and read back[^\n]*/},
  /* QuickTime 3's instruments out of its Windows installer (a zip around
     InstallShield 3 around PKWARE DCL), held to another implementation's
     explode, and a tune played through them. TUNE moves with any change to
     the synthesis: record it here when the change is meant. */
  /* Make a Scenario's art pack: its PNG decoder, its matcher from the game's
     names to the pack's files, and a scenario built with it. */
  {page: 'viewer', name: 'art pack', requiredInputs: [ART_PACK, DATA],
   cmd: ['utilities/artpack_check.mjs', 'index.html', ART_PACK, DATA],
   grep: /art pack: [^\n]*/},
  {page: 'viewer', name: 'quicktime instruments', requiredInputs: [QT_EXE, DATA],
   cmd: ['utilities/qtmusic_check.mjs', 'index.html', QT_EXE, DATA],
   grep: /QuickTime 3: [^\n]*/,
   expect: 'QuickTime 3: 21 files unpacked, the controls refused; 235 instruments, 1544 key ranges, every sample found; every part of 11 tunes has an instrument; the theme 98.1 s, TUNE f04b2a97a124'},
  /* A tune written and a MIDI file made into one (qtmaWrite, midiToQtma),
     held to the shipped tunes: their headers rebuilt byte for byte, and
     each back from its MIDI file. The harness's header has the rest. */
  {page: 'viewer', name: 'midi import', requiredInputs: [DATA],
   cmd: ['utilities/midi_import_check.mjs', 'index.html', DATA],
   grep: /midi import: [^\n]*/,
   expect: 'midi import: 11 shipped headers rebuilt byte for byte; 13401 notes and 7835 controllers back from MIDI where they were (a controller\'s value within 89 of 65536); the controls caught'},
  {page: 'viewer', name: 'resource snapshot', requiredInputs: [APP_RSRC, DATA_RSRC],
   cmd: ['utilities/rsrc_snapshot.mjs', 'index.html', APP_RSRC, DATA_RSRC],
   grep: /SNAPSHOT \w+/, expect: 'SNAPSHOT 8e52be1105b5'},   // 25 October 2026: mctb read as menu color entries (ea7b0c7651d2, its line alone moved), then MAC_4BIT_PAL as high bytes (icl4's line alone, ics4 using none of the five entries)
  /* The same decoders held to resource_dasm, a second implementation, on
     every picture, icon, cursor, pattern, color table, font, sound and string
     of both forks; the snapshot above proves them unchanged, and this row
     tests whether they are right. The two known differences are in the
     harness's header, with the program at fault. The control row changes one
     resource of each kind on grimoire's side and fails unless each is caught. */
  {page: 'viewer', name: 'resource_dasm', requiredInputs: [RESOURCE_DASM, APP_RSRC, DATA_RSRC],
   cmd: ['utilities/dasm_check.mjs', 'index.html', RESOURCE_DASM, `${TMP}/dasm_check`, APP_RSRC, DATA_RSRC],
   grep: /resource_dasm: \d+ resources[^\n]*/,
   expect: 'resource_dasm: 199 resources compared, 197 match, 2 known differences, 0 other differences, 1420 channels one step apart'},
  {page: 'viewer', name: 'resource_dasm control', requiredInputs: [RESOURCE_DASM, APP_RSRC, DATA_RSRC],
   cmd: ['utilities/dasm_check.mjs', '--control', 'index.html', RESOURCE_DASM, `${TMP}/dasm_check`, APP_RSRC, DATA_RSRC],
   grep: /resource_dasm control: [^\n]*/, expect: 'resource_dasm control: every change caught'},   // the Mac readers' text in plain US English, 22 October 2026: the text of DATA, FOND, LINF, styl, TILE and TxSt moved, no pixels; then CODE's text lost its dash (the old hash came back with the two dashes put back alone)

  // The HFS disk-image writer index.html exports with: structural here, and
  // in the row after it every volume round-tripped through systemless's
  // reader, which needs the fork's checkout beside this one and is slow only
  // the first time, when it has to build the reader's example binary. Two
  // rows so that a missing or unfound fork is a skip the table names; as one
  // row without an expected line it read ok with nothing round-tripped.
  {page: 'viewer', name: 'disk image',
   cmd: ['utilities/hfs_check.mjs', 'index.html'],
   grep: /\d+ volumes, \d+ structural checks/,
   expect: '5 volumes, 131 structural checks'},
  {page: 'viewer', name: 'disk image in the fork', slow: true,
   requiredInputs: [resolve(ROOT, SYSLESS, 'examples/hfs_dump.rs')],
   cmd: ['utilities/hfs_check.mjs', 'index.html', SYSLESS],
   grep: /\d+ volumes, \d+ structural checks[^\n]*/,
   expect: '5 volumes, 135 structural checks, 4 round-tripped through systemless'},

];

// ---- run -------------------------------------------------------------------
writeLine(`\n  Cythera checks — ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`);
await ensureForks();
/* The argument is a page or one check. One check by name was added on
   16 October 2026: "re-run a failing one on its own" was the advice under
   every failure, and the only way to take it was to copy the check's argument
   list out of this file by hand, which the game check's eight arguments made
   a chore. Named alone, the check's whole output is printed under the table,
   since the row shows one line of it. */
const byName = only && CHECKS.some(c => c.name === only);
const chosen = check => !only || (byName ? check.name === only : check.page === only);
// A name that matches nothing once ran nothing and print "A clean run is
// 0 ok", which reads as a pass.
if (!CHECKS.some(chosen)) {
  writeLine(`  No page or check is called "${only}". Pages: ${[...new Set(CHECKS.map(c => c.page))].join(', ')}.`);
  process.exit(1);
}
if (CHECKS.some(c => chosen(c) && c.page === 'viewer')) { ensureGraphicsRef(); await ensureQuickTime(); await ensureArtPack(); }
mkdirSync(EXPORTS, {recursive: true});

const rows = new Array(CHECKS.length);
const outputs = new Array(CHECKS.length);
let failed = 0, skipped = 0;

// What one check's run settles: the row, and whether it counts as failed.
// Written for one process at a time and unchanged by running several: each
// check is a separate child process, and nothing here is shared between them
// but the table.
function judge(check, ok, out, secs) {
  let note = '';
  if (check.grep) { const m = check.grep.exec(out); if (m) note = m[0].trim(); }
  /* A SNAPSHOT THAT MOVES MUST MOVE ITS RECORDED VALUE WITH IT.
   *
   * The two snapshot checks report a hash rather than a verdict, so that a
   * deliberate change to what a decoder outputs can be distinguished from an accident.
   * That only works if somebody reads the number, and on 15 September 2026
   * nobody did: the signed-byte fix to the zone lighting moved the decoder
   * snapshot, the value went unrecorded, and the stale one then read as
   * evidence of an accident to the next session that looked. Five fronts
   * landed in between without noticing.
   *
   * So the expected value lives HERE, in the file that settles pass and fail,
   * and a mismatch is a failure. Moving a decoder now costs one line in the
   * same commit, which is the point: the record cannot drift from the code
   * because the suite will not go green until they match.
   *
   * It is deliberately NOT read out of `grimoire/CLAUDE.md`, which is where
   * the values were once written down. Until 19 September 2026 that file
   * was untracked and absent from every front -- and a front is where all
   * the work happens, which would have made the guard skip in the one place
   * it is needed. The guide points at this line instead. */
  /* The installer's copy of the game, which fetch_game.mjs reads when
     reference/ has no .hqx, has the same data forks as reference/'s copy and
     different resource forks (the .hqx files came from an installed copy).
     A check whose pinned value covers the resource forks whole, as the Spanish
     translation's hash does, has a second value for that copy. */
  const expected = (FETCHED_FORKS && check.expectFetched) || check.expect;
  if (ok && expected && note !== expected) {
    ok = false;
    /* The row truncates a note at 96 characters, and the half worth reading is
       what to do about it, so the name is left out -- the row already has
       it -- and both hashes and the instruction fit. */
    const actual = (note || '(nothing)').replace(/^SNAPSHOT /, ''), expectedSnapshot = expected.replace(/^SNAPSHOT /, '');
    out += `\nFAIL: the output is ${actual} and the check expects ${expectedSnapshot}; if deliberate, move it in check_all.mjs`;
  }
  if (!ok) {
    failed++;
    const lines = out.trim().split('\n').filter(l => /FAIL|Error|error/.test(l));
    note = (lines[0] || out.trim().split('\n').pop() || 'failed').slice(0, 96);
  }
  return [check.page, check.name, ok ? 'ok' : 'FAIL', `${note}${note ? '  ' : ''}(${secs}s)`];
}

// One check, in a child process, to a row.
function runCheck(check, i) {
  const t0 = Date.now();
  return new Promise(res => {
    // Fifteen minutes is a hang, not a slow check: the browser check sat
    // ten minutes on an unanswered call once and the suite sat with it.
    execFile('node', check.cmd, {maxBuffer: 64 << 20, encoding: 'utf8', timeout: 900000, killSignal: 'SIGKILL'}, (err, stdout, stderr) => {
      let ok = !err, out = ok ? stdout : (stdout || '') + (stderr || '') + (err && err.killed ? '\nFAIL: killed after fifteen minutes' : '');
      // A hand-written zip is exactly the sort of thing that looks fine and
      // unpacks to nothing, so the archives get validated rather than trusted.
      if (ok && check.zips) {
        try { execSync(`for z in "${check.zips}"/*.zip; do unzip -t "$z" > /dev/null || exit 1; done`, {stdio: 'ignore'}); }
        catch (e) { ok = false; out += '\nunzip -t rejected an archive'; }
      }
      outputs[i] = out;
      res(judge(check, ok, out, ((Date.now() - t0) / 1000).toFixed(1)));
    });
  });
}

// The pool: up to JOBS checks at once, taken in the list's order, a check
// waiting for the ones it names in `after` to be done (finished, failed or
// skipped alike). Rows land at the check's index, so the table reads in
// the list's order whatever order the processes finished in; one line per
// finish shows which are still running when the table is a while coming.
//
// A check marked `alone` starts only when nothing else is running, and
// nothing else starts while it runs. The game check is the one: it runs the
// fork headless with a time limit on each launch, and on 15 October 2026,
// four at a time on this 8 GB machine with its swap nearly full, a launch
// passed its limit and the check failed after 942 seconds; alone, the same
// commit passed in 73. It costs the suite about that minute of wall clock,
// which is cheaper than a red row nobody can trust.
const done = new Set();
const pending = [];
for (let i = 0; i < CHECKS.length; i++) {
  const check = CHECKS[i];
  if (!chosen(check)) { rows[i] = null; done.add(check.name); continue; }
  if (quick && check.slow) { rows[i] = [check.page, check.name, 'skip', '--quick']; skipped++; done.add(check.name); continue; }
  const missing = (check.requiredInputs || []).filter(p => !existsSync(p));
  if (missing.length) {
    rows[i] = [check.page, check.name, 'skip', 'needs ' + missing.map(m => m.replace(TMP + '/', '')).join(', ')];
    skipped++; done.add(check.name);
    continue;
  }
  pending.push(i);
}
const started = Date.now();
await new Promise(resolve => {
  let running = 0, aloneRunning = false;
  const pump = () => {
    if (!pending.length && !running) return resolve();
    for (let k = 0; k < pending.length && running < JOBS && !aloneRunning; k++) {
      const i = pending[k], check = CHECKS[i];
      if ((check.after || []).some(n => !done.has(n))) continue;
      if (check.alone && running) break;   // wait for the others to finish, and start nothing past it meanwhile
      pending.splice(k, 1); k--; running++;
      if (check.alone) aloneRunning = true;
      runCheck(check, i).then(row => {
        if (check.alone) aloneRunning = false;
        rows[i] = row; done.add(check.name); running--;
        writeLine(`  ${row[2] === 'ok' ? 'ok  ' : 'FAIL'}  ${check.name}  ${row[3].match(/\([\d.]+s\)$/)[0]}`);
        pump();
      });
    }
  };
  pump();
});
const wall = ((Date.now() - started) / 1000).toFixed(1);
for (let i = rows.length - 1; i >= 0; i--) if (rows[i] === null) rows.splice(i, 1);

const w0 = Math.max(...rows.map(r => r[0].length));
const w1 = Math.max(...rows.map(r => r[1].length));
writeLine('');
for (const [page, name, status, note] of rows) {
  const mark = status === 'ok' ? '  ok  ' : status === 'skip' ? ' skip ' : ' FAIL ';
  writeLine(`  ${page.padEnd(w0)}  ${name.padEnd(w1)}  ${mark}  ${note}`);
}

const ran = rows.length - skipped;
writeLine(`\n  ${ran} checks run, ${failed} failed, ${skipped} skipped, ${wall}s wall clock with ${JOBS} at a time`);
// CLAUDE.md used to state the clean-run figure in prose, and it went stale
// four times -- each time on the day a check was added, silently, while the
// file still read as authoritative. The fifth time, on 8 September 2026, the
// instruction in the handoff was to stop correcting the prose and have the
// suite say the sentence instead. This is that sentence: paste it in when it
// changes, rather than counting the checks by hand.
if (!failed && !skipped && !only)
  writeLine(`  A clean run is ${ran} ok, 0 failed, 0 skipped.`);
if (byName) {
  const i = CHECKS.findIndex(c => c.name === only);
  if (outputs[i] != null) writeLine('\n' + outputs[i].trimEnd());
} else if (failed) {
  writeLine('  Re-run a failing one alone to see its full output:');
  for (const r of rows) if (r[2] === 'FAIL') writeLine(`    node utilities/check_all.mjs '${r[1]}'`);
}
process.exit(failed ? 1 : 0);
