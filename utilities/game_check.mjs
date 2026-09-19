#!/usr/bin/env node
/* game_check.mjs -- does the game accept what the site writes?
 *
 *   node utilities/game_check.mjs index.html <kit dir> <systemless binary> <registered licence data fork>
 *
 * Every writer here is proven byte for byte against delvmod, and delvmod
 * is not the game. This is the game: the fork of systemless runs Cythera
 * headless and deterministically, and the playthrough kit beside the
 * workspace (playthrough-2026-09-08/, in no repository) holds saved games
 * it reached by play. A save the site edits is seeded as the player file,
 * the game is driven to open it and save it again -- the title screen
 * clicked away, Open Game pressed, the file dialog answered by
 * SYSTEMLESS_STANDARD_GET_FILE, Cmd-S -- and the file the game wrote is
 * read back. The edit has to be there: the hero one square north of where
 * the seed left him, with more training points. The control is the same
 * run on the unedited seed, which has to read back the seed's own square,
 * so a run that never loaded the file cannot pass either way.
 *
 * The kit's own recipe used the fork's instruction-budget mode, which the
 * fork now calls a legacy diagnostic and in which the Open Game click no
 * longer lands; this drives it in tick mode (--max-ticks with
 * --tick-input-script, sixty ticks a second), which is what the fork now
 * documents. The kit's pristine store carries the unregistered licence,
 * whose notice would swallow the click, so the registered one is put in
 * the scratch copy of the store first. Everything runs in $TMPDIR; the kit
 * is read and never written. Skips when the kit, the binary or the licence
 * is not on the disk, which a checkout without the workspace beside it is. */

import {readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {pageSource} from './page_scripts.mjs';
import {makeSandbox} from './dom_stub.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const [htmlPath, kitArg, binArg, licenceArg] = process.argv.slice(2);
const KIT = resolve(ROOT, kitArg || '../playthrough-2026-09-08');
const BIN = resolve(ROOT, binArg || '../m68k-patched/systemless');
const LICENCE = resolve(ROOT, licenceArg || 'reference/game/installed-folders/Cythera License (registered).data');
for (const [what, p] of [['the playthrough kit', join(KIT, 'work/pristine/.systemless')], ['the fork binary', BIN], ['the registered licence', LICENCE], ['the seed save', join(KIT, 'saves/cp2-omens-test/data.fork')]])
  if (!existsSync(p)) { console.log(`  skip: ${what} is not at ${p}`); process.exit(0); }

const SEED = join(KIT, 'saves/cp2-omens-test');
const PLAY = join(process.env.TMPDIR || tmpdir(), 'grimoire_game_check');
const STORE = join(PLAY, 'game/.systemless/saves/Cythera Installed Folder/Cythera 1.0.4 %C6%92/Bellerophon');
const SCRIPT = join(PLAY, 'open-save.txt');
let failures = 0;
const fail = m => { failures++; console.log('  FAIL ' + m); };

// ---- the scratch store: the kit's, with the registered licence --------------
rmSync(PLAY, {recursive: true, force: true});
mkdirSync(PLAY, {recursive: true});
cpSync(join(KIT, 'work/game'), join(PLAY, 'game'), {recursive: true});
cpSync(join(KIT, 'work/pristine'), join(PLAY, 'pristine'), {recursive: true});
writeFileSync(join(PLAY, 'pristine/.systemless/saves/Cythera Installed Folder/System Folder/Preferences/Cythera License/data.fork'), readFileSync(LICENCE));
// The title screen clicked away at tick 400 (it is up by then), Open Game at
// 800 (the menu is up by then), Cmd-S at 1500 with the game well into the
// zone, and the run ends at 1800 so the save has time to finish.
writeFileSync(SCRIPT, '400 click 320 330\n800 click 320 330\n1500 keydown 55 0\n1502 press 1 115\n1504 keyup 55 0\n');

// ---- the page, to edit the seed with its own writer -------------------------
const {sandbox} = makeSandbox();
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath) + '\n;window.__peek = n => eval(n);', {filename: htmlPath}).runInContext(ctx);
const peek = n => ctx.__peek(n);
const seedBytes = new Uint8Array(readFileSync(join(SEED, 'data.fork')));
ctx.parseArchiveBytes(seedBytes, 'cp2-omens-test', {via: 'data fork'});
const hero = () => ctx.parseDelverCharacterRecords(ctx.smartDecrypt(ctx.getResourceBytes(peek('ARCHIVE'), 0xF009), 0xF009).data)[1];
const before = hero();
if (!before || before.x !== 29 || before.y !== 27 || before.zone !== 40)
  fail(`the seed is not the one this was written for: hero at zone ${before && before.zone} (${before && before.x}, ${before && before.y}), expected zone 40 (29, 27)`);
const wantTraining = (before.training + 100) & 0xFF;
// The hero stands in two places in a save: character record 1 in 0xF009,
// and prop record 1 in 0xF306, the characters' prop list, which the game
// places him from. Edited in the character record alone he loaded where the
// prop record said and was saved back there, which is how this check first
// failed (19 September 2026); applyCharacterRecordEdit moves the prop record
// with the square since, and this drives that one path, as the form does.
const heroProp = () => ctx.parseDelverPropList(ctx.smartDecrypt(ctx.getResourceBytes(peek('ARCHIVE'), 0xF306), 0xF306).data)[1];
const propBefore = heroProp();
if (!propBefore || propBefore.x !== 29 || propBefore.y !== 27) fail(`the hero's prop record is not at (29, 27): ${JSON.stringify(propBefore && {x: propBefore.x, y: propBefore.y})}`);
if (!ctx.applyCharacterRecordEdit(1, {y: 26, training: wantTraining})) fail('the page refused the character record edit');
const edited = peek('ARCHIVE.bytes');
const after = hero(), propAfter = heroProp();
if (after.y !== 26 || after.training !== wantTraining || propAfter.y !== 26) fail('the edits did not reach the rebuilt file: ' + JSON.stringify({after, propAfter}));

// ---- one run: seed the store, drive the game, read the file it wrote --------
function run(label, dataFork) {
  rmSync(join(PLAY, 'game/.systemless'), {recursive: true, force: true});
  cpSync(join(PLAY, 'pristine/.systemless'), join(PLAY, 'game/.systemless'), {recursive: true});
  rmSync(STORE, {recursive: true, force: true}); mkdirSync(STORE, {recursive: true});
  writeFileSync(join(STORE, 'data.fork'), dataFork);
  writeFileSync(join(STORE, 'resource.fork'), readFileSync(join(SEED, 'resource.fork')));
  const meta = JSON.parse(readFileSync(join(SEED, 'metadata.json'), 'utf8')); meta.path = 'Cythera 1.0.4 ƒ/Bellerophon';
  writeFileSync(join(STORE, 'metadata.json'), JSON.stringify(meta, null, 2));
  const shots = join(PLAY, 'shots', label); mkdirSync(shots, {recursive: true});
  // The fork writes its account to stderr, so both streams are the log.
  const r0 = spawnSync(BIN, ['--headless', '--max-ticks', '1800', '--tick-input-script', SCRIPT, join(PLAY, 'game/Cythera Installed Folder.sit')],
    {encoding: 'utf8', maxBuffer: 64 << 20, timeout: 180000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'],
     env: {...process.env, SYSTEMLESS_HEADLESS_SCREENSHOT_DIR: shots, SYSTEMLESS_HEADLESS_SCREENSHOT_EVERY: '0', SYSTEMLESS_STANDARD_GET_FILE: 'Cythera 1.0.4 \u0192/Bellerophon'}});
  const log = (r0.stdout || '') + (r0.stderr || '');
  if (r0.error || r0.signal) fail(`${label}: the fork did not finish: ` + (r0.error ? r0.error.message : 'killed by ' + r0.signal));
  writeFileSync(join(PLAY, label + '.log'), log);
  const opened = /FSpOpenDF\("Bellerophon"/.test(log), completed = /complete frontend_ticks=1800/.test(log);
  const written = new Uint8Array(readFileSync(join(STORE, 'data.fork')));
  const same = written.length === dataFork.length && written.every((b, i) => b === dataFork[i]);
  let read = null;
  try { const arc = ctx.openDelverArchive(written); read = ctx.parseDelverCharacterRecords(ctx.smartDecrypt(ctx.getResourceBytes(arc, 0xF009), 0xF009).data)[1]; } catch (e) { fail(`${label}: the file the game wrote does not parse: ` + e.message); }
  return {opened, completed, same, read, log: join(PLAY, label + '.log')};
}

const control = run('control', seedBytes);
const trial = run('edited', edited);
for (const [label, r] of [['control', control], ['edited', trial]]) {
  if (!r.completed) fail(`${label}: the run did not complete its 1800 ticks (${r.log})`);
  if (!r.opened) fail(`${label}: the game never opened the player file (${r.log})`);
  if (r.same) fail(`${label}: the game did not rewrite the file, so nothing was saved (${r.log})`);
}
if (control.read && (control.read.x !== 29 || control.read.y !== 27 || control.read.training !== before.training))
  fail(`control: the unedited seed came back changed: (${control.read.x}, ${control.read.y}), training ${control.read.training}`);
if (trial.read && (trial.read.x !== 29 || trial.read.y !== 26 || trial.read.training !== wantTraining))
  fail(`edited: the game did not keep the edit: (${trial.read.x}, ${trial.read.y}), training ${trial.read.training}; wanted (29, 26), training ${wantTraining}`);
if (!failures) console.log(`  the game loaded the edited save and saved it back: hero at (${trial.read.x}, ${trial.read.y}) with ${trial.read.training} training points, from (${before.x}, ${before.y}) and ${before.training}; the unedited seed came back as itself`);
console.log(failures ? `\nFAIL — ${failures} problem(s)` : `\ngame: the game accepts a save the page edited; hero moved to (${trial.read.x}, ${trial.read.y}), training ${before.training} to ${trial.read.training}, and the control kept (${control.read.x}, ${control.read.y})`);
process.exit(failures ? 1 : 0);
