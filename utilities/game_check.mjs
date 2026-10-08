#!/usr/bin/env node
/* game_check.mjs -- does the game accept what the site writes?
 *
 *   node utilities/game_check.mjs index.html <kit dir> <systemless binary> <registered licence data fork>
 *        [<Cythera Data data fork> [<Cythera data fork> <Cythera resource fork>]]
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
 * is read and never written. The script is timed for the 68K slice, which
 * the kit's saves and drive scripts all use; the fork's binary prefers the
 * PowerPC slice since 3 October 2026, so the run asks for the 68K one with
 * SYSTEMLESS_PREFER_POWERPC=0. Skips when the kit, the binary or the licence
 * is not on the disk, which a checkout without the workspace beside it is. */

import {readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, cpSync, statSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {crc32} from 'node:zlib';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {pageSource} from './page_scripts.mjs';
import {makeSandbox} from './dom_stub.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const [htmlPath, kitArg, binArg, licenceArg, scenarioArg, appDataArg, appRsrcArg] = process.argv.slice(2);
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
/* The rest of the save's forms ride in the same run (25 September 2026): a
   quest value and a quest flag no script touches in this state, a room
   switch, a thing given to the hero and a To Do line. The game loads each
   into its own globals and writes them back from there on the save, so
   each has to come back; the control must come back without them. What this
   cannot prove is that a To Do line other than 0 DRAWS as its text: the
   game echoes the entry whatever it points at. */
if (!ctx.writeQuestState({5: 3}, {77: true})) fail('the page refused the quest state edit');
if (!ctx.writeRoomsEntered({4: true})) fail('the page refused the rooms edit');
if (!ctx.giveToCharacter(1, {proptype: 66, aspect: 0, d3: 0x300, flags: 0x10})) fail('the page refused to give the hero a thing');
if (!ctx.addTodoLine(10, 114, 0x021A)) fail('the page refused the To Do line');
const edited = peek('ARCHIVE.bytes');
const after = hero(), propAfter = heroProp();
if (after.y !== 26 || after.training !== wantTraining || propAfter.y !== 26) fail('the edits did not reach the rebuilt file: ' + JSON.stringify({after, propAfter}));

// ---- one run: seed the store, drive the game, read the file it wrote --------
function run(label, dataFork, made) {
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
     env: {...process.env, SYSTEMLESS_HEADLESS_SCREENSHOT_DIR: shots, SYSTEMLESS_HEADLESS_SCREENSHOT_EVERY: '0', SYSTEMLESS_PREFER_POWERPC: '0', SYSTEMLESS_STANDARD_GET_FILE: 'Cythera 1.0.4 \u0192/Bellerophon'}});
  const log = (r0.stdout || '') + (r0.stderr || '');
  if (r0.error || r0.signal) fail(`${label}: the fork did not finish: ` + (r0.error ? r0.error.message : 'killed by ' + r0.signal));
  writeFileSync(join(PLAY, label + '.log'), log);
  const opened = /FSpOpenDF\("Bellerophon"/.test(log), completed = /complete frontend_ticks=1800/.test(log);
  const written = new Uint8Array(readFileSync(join(STORE, 'data.fork')));
  const same = written.length === dataFork.length && written.every((b, i) => b === dataFork[i]);
  let read = null, rest = null;
  try {
    const arc = ctx.openDelverArchive(written);
    read = ctx.parseDelverCharacterRecords(ctx.smartDecrypt(ctx.getResourceBytes(arc, 0xF009), 0xF009).data)[1];
    if (made) return {opened, completed, same, read, rest, written, log: join(PLAY, label + '.log')};   // a made save has no zone 40 to read a gift from
    const seg = rid => ctx.smartDecrypt(ctx.getResourceBytes(arc, rid), rid).data;
    const q = ctx.saveQuestState(ctx.delverArchiveSpec(written)), rooms = seg(0xF00E), todo = seg(0x0401);
    const given = ctx.parseDelverPropList(seg(0x8128)).filter(r => r.flags === 0x10 && r.carriedBy === 1 && r.proptype === 66 && r.d3 === 0x300).length;
    rest = {value5: q.values[5], flag77: q.flags[77], room4: rooms[9] & 1, given, todo10: Array.from(todo.subarray(84, 88)).map(b => b.toString(16).padStart(2, '0')).join('')};
  } catch (e) { fail(`${label}: the file the game wrote does not parse: ` + e.message); }
  return {opened, completed, same, read, rest, log: join(PLAY, label + '.log')};
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
const WANT = {value5: 3, flag77: true, room4: 1, given: 1, todo10: '3072021a'};
if (control.rest && (control.rest.value5 || control.rest.flag77 || control.rest.room4 || control.rest.given || control.rest.todo10 !== '5000ffff'))
  fail('control: the unedited seed came back with a quest value, flag, room, gift or To Do line it never had: ' + JSON.stringify(control.rest));
if (trial.rest && JSON.stringify(trial.rest) !== JSON.stringify(WANT))
  fail('edited: the game did not keep the quest value, flag, room, gift and To Do line: ' + JSON.stringify(trial.rest) + ', wanted ' + JSON.stringify(WANT));
if (!failures) console.log('  and it kept quest value 5 at 3, flag 77, room 4 entered, the thing given and To Do line 114 in slot 10; the control has none of them');
if (!failures) console.log(`  the game loaded the edited save and saved it back: hero at (${trial.read.x}, ${trial.read.y}) with ${trial.read.training} training points, from (${before.x}, ${before.y}) and ${before.training}; the unedited seed came back as itself`);
/* A save the page MADE, from the scenario alone (7 October 2026;
   buildNewGameSave, js/delv-archive.js). The edited run above starts from
   a file the game wrote, so it cannot say whether the game takes a file it
   never wrote a byte of. This one is built with no save open, with stats
   no new game has, and has to come back from the game's own save with the
   hero where the scenario stands him and those stats intact. The control
   is the edited run's: the same store and script, which came back with a
   different hero, so a run that loaded some other file cannot pass. Skips
   with a line when the scenario's data fork was not handed over. */
let madeLine = '';
if (scenarioArg && existsSync(scenarioArg)) {
  /* And the second half (8 October 2026): another zone than the hero's own,
     at the square the page offers there, the first of the characters who
     can join standing with him, the first named state that sets anything,
     two in the afternoon on day 3. The resource fork is opened beside the
     data, since the named states are in it. What must come back from the
     game's own save: the place; the companion still in the party, in the
     zone, following; the state's quest value; the day. */
  const rsrcPath = scenarioArg.replace(/\.data$/, '.rsrc');
  ctx.parseArchiveBytes(new Uint8Array(readFileSync(scenarioArg)), 'Cythera Data', existsSync(rsrcPath) ? {via: 'data fork', rsrc: new Uint8Array(readFileSync(rsrcPath))} : {via: 'data fork'});
  const md = ctx.saveMakerDefaults(), elsewhere = md.zones.find(z => z.zone !== md.zone && z.zone > 1), friend = md.companions[0], story = md.stories.find(t => Object.keys(t.values).length);
  // And an archetype's skills, the same day: the last of the nine, whose
  // row has skills at level 0 as well as one above it. The game must
  // write them back as the hero's, a record apiece.
  const arch = md.archetypes ? md.archetypes.list[md.archetypes.list.length - 1] : null;
  const made = ctx.newGameSaveBytes({name: 'Bellerophon', sprite: 0, body: 21, reflex: 14, mind: 9, level: 3, archetype: arch ? arch.index : '',
    zone: elsewhere.zone, party: friend ? [friend.index] : [], story: story ? story.name : '', hour: 14, day: 3, welcomed: true});
  /* The king's welcome against the game's own (the same day). The kit has a
     save taken at a new game and one taken after the king's first
     conversation, a Fighter's. A save made here as a Fighter with the king
     having spoken must agree with the second wherever the first differs
     from it by his doing: the quest flags, the To Do list's first slot,
     his own flags, and the hero's skills and the amulet at the end of the
     hall's list. No run: two files compared. */
  const cp1Path = join(KIT, 'saves/cp1-intro-done/data.fork');
  if (existsSync(cp1Path) && md.welcome && md.archetypes) {
    const real = ctx.delverArchiveSpec(new Uint8Array(readFileSync(cp1Path)));
    const mine = ctx.delverArchiveSpec(new Uint8Array(ctx.newGameSaveBytes({name: 'Bellerophon', archetype: md.archetypes.list.find(a => a.skills.length === 2).index, welcomed: true})));
    const seg = (sp, id) => sp.resources.find(r => r.resid === id).data, hex = b => Buffer.from(b).toString('hex');
    const qa = ctx.saveQuestState(real), qb = ctx.saveQuestState(mine);
    const held = sp => ctx.parseDelverPropList(seg(sp, 0x8100 + md.zone)).filter(r => (r.flags === 0x1C || r.flags === 0x10) && r.x === 0 && r.y === 1 && r.proptype > 190).map(r => [r.flags, r.proptype, r.aspect, r.d3].join(':')).join(' ');
    if (qa.flags.join() !== qb.flags.join() || qa.values.join() !== qb.values.join()) fail('welcome: the quest values and flags are not those of the kit’s save after the king');
    else if (hex(seg(real, 0x0401).subarray(0, 8)) !== hex(seg(mine, 0x0401).subarray(0, 8))) fail('welcome: To Do slot 0 is ' + hex(seg(mine, 0x0401).subarray(0, 8)) + ', the kit’s ' + hex(seg(real, 0x0401).subarray(0, 8)));
    else if ((qa.chars[md.welcome.who].state & 0x80) !== (qb.chars[md.welcome.who].state & 0x80) || !(qb.chars[md.welcome.who].state & 0x80)) fail('welcome: the king’s own flag is not set as in the kit’s save');
    else if (held(real) !== held(mine) || !held(mine)) fail('welcome: the hero holds ' + held(mine) + ', and in the kit’s save ' + held(real));
    else console.log('  a Fighter made with the king having spoken agrees with the kit’s save after his welcome: the flags, To Do slot 0, his flag, and ' + held(mine).split(' ').length + ' things held');
  } else console.log('  the king’s welcome was not compared: the kit’s save after it, or the reading, is missing');
  /* The characters' prop list against a real new game's (the same day): the
     kit's save taken at a new game, its list against the rule run on its own
     character table (a made save's table is the scenario's, which the game
     has not yet placed, so the two tables are not to be compared). Two may differ, and only by having no square in the real
     one: the two characters the hour's schedule keeps off the map, which
     the game works out again on load. Any other difference is the rule's. */
  const cp0Path = join(KIT, 'saves/cp0-newgame/data.fork');
  if (existsSync(cp0Path)) {
    const cp0 = ctx.delverArchiveSpec(new Uint8Array(readFileSync(cp0Path))), table = cp0.resources.find(r => r.resid === 0xF009).data;
    const real = cp0.resources.find(r => r.resid === 0xF306).data, mine = ctx.delverCharacterPropList(table, table[32]);
    const odd = [];
    for (let i = 0; i < 256; i++) { const a = real.subarray(i * 16, i * 16 + 16), b = mine.subarray(i * 16, i * 16 + 16); if (a.some((v, k) => v !== b[k])) odd.push({i, bare: a[0] === b[0] && a.subarray(1).every(v => !v)}); }
    if (real.length !== mine.length || odd.length > 2 || odd.some(o => !o.bare)) fail('list: the characters’ prop list differs from a real new game’s other than in a scheduled character’s square: ' + JSON.stringify(odd.slice(0, 8)));
    else console.log('  the rule for the characters’ prop list gives a real new game’s from its own table, but for the square of characters ' + odd.map(o => o.i).join(' and ') + ', whom the hour keeps off the map');
  }
  if (!made) fail('made: the page could not make a save from the scenario');
  else {
    const want = ctx.parseDelverCharacterRecords(ctx.delverArchiveSpec(made).resources.find(r => r.resid === 0xF009).data)[1];
    const r = run('made', new Uint8Array(made), true);
    const got = r.read, keys = ['zone', 'x', 'y', 'proptype', 'body', 'reflex', 'mind', 'level', 'health', 'healthMax', 'training'];
    if (!r.completed || !r.opened || r.same) fail(`made: the game did not open, run and save the made file (${r.log})`);
    else if (!got || keys.some(k => got[k] !== want[k])) fail('made: the hero came back changed: ' + JSON.stringify(keys.map(k => [k, want[k], got && got[k]]).filter(t => t[1] !== t[2])));
    else if (want.body !== 21 || want.level !== 3 || !want.health) fail('made: the file was not made with the stats asked for: ' + JSON.stringify(want));
    else {
      const back = ctx.delverArchiveSpec(r.written), q = ctx.saveQuestState(back), pal = friend ? q.chars[friend.index] : null, ch = back.resources.find(x => x.resid === 0x0400).data;
      const [sn, sv] = story ? Object.entries(story.values)[0] : [];
      if (got.zone !== elsewhere.zone) fail(`made: the hero is in zone ${got.zone}, not ${elsewhere.zone}`);
      else if (friend && (!pal || !(pal.state & 0x40) || pal.zone !== got.zone || pal.raw[22] !== 1)) fail('made: the companion is not in the party, in the zone and following: ' + JSON.stringify(pal && {state: pal.state, zone: pal.zone, behaviour: pal.raw[22]}));
      else if (story && q.values[+sn] !== sv) fail(`made: quest value ${sn} is ${q.values[+sn]}, not the ${sv} of ${story.name}`);
      else if (md.welcome && !q.flags[md.welcome.flag.v]) fail('made: the game did not keep the quest flag of the king’s welcome');
      else if (((ch[84] << 8) | ch[85]) !== 3) fail('made: the day is not 3: ' + ((ch[84] << 8) | ch[85]));
      else if (arch && (() => { const list = ctx.parseDelverPropList(back.resources.find(x => x.resid === 0x8100 + got.zone).data);
        return !arch.skills.every(k => list.some(p => p.flags === md.archetypes.flags.v && p.x === 0 && p.y === 1 && p.proptype === k.type && p.aspect === (k.level | md.archetypes.bit.v))); })())
        fail('made: the game did not write back the ' + arch.name + '’s skills as the hero’s');
      else madeLine = `; and a save made from the scenario alone, hero in zone ${got.zone} at (${got.x}, ${got.y}) with body ${got.body}, level ${got.level}, health ${got.health}` + (friend ? `, character ${friend.index} with him` : '') + (story ? `, in the state ${story.name}` : '') + ', on day 3' + (arch ? `, a ${arch.name} with ${arch.skills.length} skills` : '');
    }
    if (madeLine) console.log('  the game loaded' + madeLine.slice(5) + ', and saved it back');
  }
} else console.log('  the made save was not tried: no scenario data fork was handed over');
/* A scenario the page MADE (8 October 2026; newScenarioBytes, Data ›
   Patches, Make a Scenario): the open scenario with its world emptied to
   one zone. Nothing above starts a new game, and a new game is the only
   thing a scenario is for, so this one does: the game arrives as a zip of
   two MacBinary files, the application and the made Cythera Data (the fork
   takes both forks of each from one; a store entry named Cythera Data was
   tried first and the PowerPC slice read the archive's file regardless),
   New Game is pressed, the player named and the archetype accepted, the
   hero walked east twice and south once, and the game saved.

   It runs on the PowerPC slice, where the workbench's new-game script was
   timed (tools/drive-scripts/powerpc/newgame.ticks.txt), and stops that
   script after the archetype dialog: the made scenario has no opening to
   page through. The zone is made 24 by 20 with the hero at (10, 12), which
   no zone of the shipped file is, so the save says which scenario the game
   read: the hero three steps from (10, 12), and the zone's map memory, a
   bit a square, 3 bytes by 20. The control is run by hand, since it costs
   another forty seconds: GAME_CHECK_SHIPPED_SCENARIO=1 puts the shipped
   file through the same run, where the script leaves the game in its
   slideshow, the file the Create Player dialog made stays empty, and this
   fails. Skips with a line when the scenario or the application was not
   handed over. */
let scenLine = '';
if (scenarioArg && existsSync(scenarioArg) && appDataArg && existsSync(appDataArg) && appRsrcArg && existsSync(appRsrcArg) && existsSync(scenarioArg.replace(/\.data$/, '.rsrc'))) {
  const W = 24, H = 20, X = 10, Y = 12;
  ctx.parseArchiveBytes(new Uint8Array(readFileSync(scenarioArg)), 'Cythera Data', {via: 'data fork'});
  let made = null;
  // With a battle and the redrawn art (the same day): the first two kinds of
  // creature on different sides, four each, north of the hero, and every
  // picture drawn afresh. The save must hold more in the zone's list than the
  // sixteen records written, which is the creatures hatched and what they
  // dropped; the pictures are only shown to load, since nothing of them
  // reaches a save.
  const kinds = ctx.scenarioCreatureChoices(), ka = kinds.find(k => k.name === 'ruffian') || kinds[0], kb = kinds.find(k => k.alignment !== ka.alignment && k.name === 'wolflizard') || kinds.find(k => k.alignment !== ka.alignment);
  try { made = ctx.newScenarioBytes({name: 'Empty Field', width: W, height: H, x: X, y: Y, armyA: ka.type, armyB: kb.type, armyCount: 4, badArt: true}); } catch (e) { fail('scenario: the page could not make one: ' + e.message); }
  if (made && process.env.GAME_CHECK_SHIPPED_SCENARIO === '1') made = readFileSync(scenarioArg);
  if (made) {
    const mspec = ctx.delverArchiveSpec(new Uint8Array(made)), zone = ctx.parseDelverCharacterRecords(mspec.resources.find(r => r.resid === 0xF009).data)[1].zone;
    const mb = (name, type, data, rsrc) => ctx.writeMacBinary({name, type, creator: 'Delv', data, rsrc});
    const rd = p => new Uint8Array(readFileSync(p));
    // A stored zip of the two, written here: the page's buildZip answers a
    // Blob, which this side of the vm cannot read synchronously.
    const entries = [
      ['Cythera 1.0.4 \u0192/Cythera', mb('Cythera', 'APPL', rd(appDataArg), rd(appRsrcArg))],
      ['Cythera 1.0.4 \u0192/Cythera Data', mb('Cythera Data', 'DelS', new Uint8Array(made), rd(scenarioArg.replace(/\.data$/, '.rsrc')))]];
    const parts = [], central = [];
    let at = 0;
    for (const [n, bytes] of entries) {
      const name = Buffer.from(n, 'utf8'), data = Buffer.from(bytes), crc = crc32(data);
      const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt32LE(crc, 14); h.writeUInt32LE(data.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(name.length, 26);
      const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt32LE(crc, 16); c.writeUInt32LE(data.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(at, 42);
      parts.push(h, name, data); central.push(c, name); at += 30 + name.length + data.length;
    }
    const dir = Buffer.concat(central), eocd = Buffer.alloc(22);
    eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(entries.length, 8); eocd.writeUInt16LE(entries.length, 10); eocd.writeUInt32LE(dir.length, 12); eocd.writeUInt32LE(at, 16);
    const zip = Buffer.concat([...parts, dir, eocd]);
    const SCEN = join(PLAY, 'scenario');
    mkdirSync(SCEN, {recursive: true});
    cpSync(join(PLAY, 'pristine/.systemless'), join(SCEN, '.systemless'), {recursive: true});
    writeFileSync(join(SCEN, 'Cythera Installed Folder.zip'), zip);
    // New Game at 950, "NewGame01" typed over the name and Return, OK in the
    // archetype dialog at 1450; then right, right, down, and Cmd-S.
    const NEWGAME = join(PLAY, 'new-game.txt');
    writeFileSync(NEWGAME, '1 mousemove 300 320\n950 click 255 310\n' +
      [[45, 78], [14, 101], [13, 119], [5, 71], [0, 97], [46, 109], [14, 101], [29, 48], [18, 49], [36, 13]].map(([k, c], i) => `${1100 + i * 10} press ${k} ${c}\n`).join('') +
      '1450 click 475 494\n1700 press 124 29\n1800 press 124 29\n1900 press 125 31\n2100 keydown 55 0\n2102 press 1 115\n2104 keyup 55 0\n');
    const r0 = spawnSync(BIN, ['--headless', '--max-ticks', '2500', '--tick-input-script', NEWGAME, join(SCEN, 'Cythera Installed Folder.zip')],
      {encoding: 'utf8', maxBuffer: 64 << 20, timeout: 300000, killSignal: 'SIGKILL', stdio: ['ignore', 'pipe', 'pipe'],
       env: {...process.env, SYSTEMLESS_HEADLESS_SCREENSHOT_DIR: join(PLAY, 'shots', 'scenario'), SYSTEMLESS_HEADLESS_SCREENSHOT_EVERY: '0', SYSTEMLESS_PREFER_POWERPC: '1'}});
    const slog = join(PLAY, 'scenario.log');
    writeFileSync(slog, (r0.stdout || '') + (r0.stderr || ''));
    const saved = join(SCEN, '.systemless/saves/Cythera Installed Folder/Cythera 1.0.4 %C6%92/NewGame01/data.fork');
    if (r0.error || r0.signal) fail('scenario: the fork did not finish: ' + (r0.error ? r0.error.message : 'killed by ' + r0.signal));
    else if (!existsSync(saved)) fail(`scenario: the game wrote no save, so no new game was reached (${slog})`);
    else try {
      const sspec = ctx.delverArchiveSpec(new Uint8Array(readFileSync(saved)));
      const seg = rid => (sspec.resources.find(r => r.resid === rid) || {}).data;
      const h = seg(0xF009) ? ctx.parseDelverCharacterRecords(seg(0xF009))[1] : null, seen = seg(0x8200 + zone);
      if (!seg(0xF009)) fail(`scenario: the save the game wrote holds no game, so no new game was reached (${slog})`);
      else if (!h || h.zone !== zone || h.x !== X + 2 || h.y !== Y + 1) fail(`scenario: the hero is not three steps from (${X}, ${Y}) in zone ${zone}: ` + JSON.stringify(h && {zone: h.zone, x: h.x, y: h.y}));
      else if (!seen || seen.length !== Math.ceil(W / 8) * H) fail(`scenario: the zone's map memory is ${seen && seen.length} bytes, not the ${Math.ceil(W / 8) * H} of a ${W} by ${H} zone`);
      else if (!h.health || h.level !== 1) fail('scenario: the creation script did not set the hero up: ' + JSON.stringify({health: h.health, level: h.level}));
      else if (ctx.parseDelverPropList(seg(0x8100 + zone)).length <= 16) fail('scenario: nothing hatched: the zone’s list is the sixteen records written');
      else scenLine = `; and a new game on a scenario made here, one zone ${W} by ${H} with its pictures redrawn, ${ka.name} and ${kb.name} hatched beside the hero, who walked from (${X}, ${Y}) to (${h.x}, ${h.y})`;
      if (scenLine) console.log('  the game started a new game' + scenLine.slice(16) + ', and saved it');
    } catch (e) { fail('scenario: the save the game wrote does not parse: ' + e.message); }
  }
} else console.log('  the made scenario was not tried: the scenario or the application was not handed over');
console.log(failures ? `\nFAIL — ${failures} problem(s)` : `\ngame: the game accepts a save the page edited; hero moved to (${trial.read.x}, ${trial.read.y}), training ${before.training} to ${trial.read.training}, and the control kept (${control.read.x}, ${control.read.y})`);
process.exit(failures ? 1 : 0);
