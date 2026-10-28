#!/usr/bin/env node
// Tests version_merge.mjs by rebasing real commits with it.
//
//   node utilities/version_merge_check.mjs
//
// Each case is a scratch git repository (under $TMPDIR) with main and a front
// that start from the same commit, both changing GRIMOIRE_VERSION in index.html
// and something else in the file, and then `git rebase main` on the front with
// the driver registered. A case passes when the rebase finishes without a
// conflict and the version is main's with the bump the front made added to it,
// and when both sides' other changes are in the file. One case is a conflict
// that is not the version line, which has to stop the rebase.
//
// The negative control is the same first case with no driver registered. It has
// to end on the version main already had, which is the fault the driver
// removes. A check that passed without the driver would show nothing, so a
// control that stays green is a failure here.

import {execFileSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const DRIVER = resolve(dirname(fileURLToPath(import.meta.url)), 'version_merge.mjs');
const ENV = {...process.env, GIT_AUTHOR_NAME: 'check', GIT_AUTHOR_EMAIL: 'check@example.invalid',
  GIT_COMMITTER_NAME: 'check', GIT_COMMITTER_EMAIL: 'check@example.invalid', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null'};
const root = mkdtempSync(join(process.env.TMPDIR || '.', 'version-merge-'));

const lines = version => ['<title>page</title>', `const GRIMOIRE_VERSION = '${version}';`, ...Array.from({length: 40}, (_, i) => `line ${i}`), '</html>'];
const file = text => text.join('\n') + '\n';

function git(dir, ...args) { return execFileSync('git', args, {cwd: dir, env: ENV, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}); }
function tryGit(dir, ...args) { try { return {ok: true, out: git(dir, ...args)}; } catch (e) { return {ok: false, out: String(e.stderr || e.stdout || e)}; } }

// A repository on branch main at `baseVersion`. It registers the driver when
// `driver` is true.
function repository(name, baseVersion, driver) {
  const dir = join(root, name);
  execFileSync('mkdir', ['-p', dir]);
  git(dir, 'init', '-q', '-b', 'main');
  writeFileSync(join(dir, 'index.html'), file(lines(baseVersion)));
  writeFileSync(join(dir, '.gitattributes'), 'index.html merge=grimoire-version\n');
  if (driver) git(dir, 'config', 'merge.grimoire-version.driver', `node "${DRIVER}" %O %A %B`);
  git(dir, 'add', '.'); git(dir, 'commit', '-q', '-m', 'base');
  return dir;
}
function change(dir, edit, message) {
  const path = join(dir, 'index.html');
  writeFileSync(path, edit(readFileSync(path, 'utf8')));
  git(dir, 'commit', '-q', '-am', message);
}
const setVersion = version => text => text.replace(/GRIMOIRE_VERSION = '[\d.]+'/, `GRIMOIRE_VERSION = '${version}'`);
const setLine = (index, value) => text => text.replace(`line ${index}\n`, `${value}\n`);
const both = (...edits) => text => edits.reduce((t, e) => e(t), text);
const versionOf = dir => /GRIMOIRE_VERSION = '([\d.]+)'/.exec(readFileSync(join(dir, 'index.html'), 'utf8'))[1];
const has = (dir, text) => readFileSync(join(dir, 'index.html'), 'utf8').includes(text);

let cases = 0;
const failures = [];
function expect(name, actual, expected) {
  cases++;
  if (actual !== expected) failures.push(`${name}: the version is ${actual}, expected ${expected}`);
}
function expectTrue(name, ok) { cases++; if (!ok) failures.push(name); }

function scenario(name, baseVersion, mainEdits, frontEdits, driver = true) {
  const dir = repository(name, baseVersion, driver);
  git(dir, 'checkout', '-q', '-b', 'front');
  frontEdits.forEach(([edit, message]) => change(dir, edit, message));
  git(dir, 'checkout', '-q', 'main');
  mainEdits.forEach(([edit, message]) => change(dir, edit, message));
  git(dir, 'checkout', '-q', 'front');
  return {dir, rebase: tryGit(dir, 'rebase', 'main')};
}

// Both fronts bump the last number, to the same number. They merge with no
// text conflict, and the number has to move on past main's.
{
  const s = scenario('same-bump', '1.344.0',
    [[both(setVersion('1.344.1'), setLine(3, 'main change')), 'main']],
    [[both(setVersion('1.344.1'), setLine(30, 'front change')), 'front']]);
  expectTrue('same bump: the rebase did not finish', s.rebase.ok);
  expect('same bump', versionOf(s.dir), '1.344.2');
  expectTrue('same bump: the main change is missing', has(s.dir, 'main change'));
  expectTrue('same bump: the front change is missing', has(s.dir, 'front change'));
}
// The negative control: with no driver the same case ends on main's number.
{
  const s = scenario('control', '1.344.0',
    [[both(setVersion('1.344.1'), setLine(3, 'main change')), 'main']],
    [[both(setVersion('1.344.1'), setLine(30, 'front change')), 'front']], false);
  expect('control without the driver', versionOf(s.dir), '1.344.1');
}
// Main moved the middle number and the front the last. The conflict is the
// version line, and the bump the front made goes on main's number.
{
  const s = scenario('minor-then-patch', '1.344.0',
    [[both(setVersion('1.345.0'), setLine(3, 'main change')), 'main']],
    [[both(setVersion('1.344.1'), setLine(30, 'front change')), 'front']]);
  expectTrue('minor then patch: the rebase did not finish', s.rebase.ok);
  expect('minor then patch', versionOf(s.dir), '1.345.1');
}
// The front moved the middle number, to the number main already has.
{
  const s = scenario('both-minor', '1.344.0',
    [[both(setVersion('1.345.0'), setLine(3, 'main change')), 'main']],
    [[both(setVersion('1.345.0'), setLine(30, 'front change')), 'front']]);
  expectTrue('both minor: the rebase did not finish', s.rebase.ok);
  expect('both minor', versionOf(s.dir), '1.346.0');
}
// The front left the number alone. Main's stays.
{
  const s = scenario('no-bump', '1.344.0',
    [[both(setVersion('1.344.3'), setLine(3, 'main change')), 'main']],
    [[setLine(30, 'front change'), 'front']]);
  expectTrue('no bump: the rebase did not finish', s.rebase.ok);
  expect('no bump', versionOf(s.dir), '1.344.3');
  expectTrue('no bump: the front change is missing', has(s.dir, 'front change'));
}
// Two commits on the front, each moving the last number, on a main that moved twice.
{
  const s = scenario('two-commits', '1.344.0',
    [[both(setVersion('1.344.1'), setLine(3, 'main one')), 'main one'], [both(setVersion('1.344.2'), setLine(4, 'main two')), 'main two']],
    [[both(setVersion('1.344.1'), setLine(30, 'front one')), 'front one'], [both(setVersion('1.344.2'), setLine(31, 'front two')), 'front two']]);
  expectTrue('two commits: the rebase did not finish', s.rebase.ok);
  expect('two commits', versionOf(s.dir), '1.344.4');
  expectTrue('two commits: a change is missing', ['main one', 'main two', 'front one', 'front two'].every(t => has(s.dir, t)));
}
// A conflict that is not the version line stops the rebase, markers and all.
{
  const s = scenario('real-conflict', '1.344.0',
    [[both(setVersion('1.344.1'), setLine(10, 'main wording')), 'main']],
    [[both(setVersion('1.344.1'), setLine(10, 'front wording')), 'front']]);
  expectTrue('real conflict: the rebase finished', !s.rebase.ok);
  expectTrue('real conflict: the file has no markers', has(s.dir, '<<<<<<<') && has(s.dir, '>>>>>>>'));
}

rmSync(root, {recursive: true, force: true});
if (failures.length) {
  console.log(`version merge FAIL, ${failures.length} of ${cases} checks failed`);
  for (const f of failures) console.log('  ' + f);
  process.exit(1);
}
console.log(`version merge ok, ${cases} checks in 7 cases, and the control without the driver ends on main's number`);
