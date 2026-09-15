#!/usr/bin/env node
// Is the oracle the checks run against actually current?
//
//   node utilities/oracle_check.mjs <path to delvmod>
//
// WHY. delvmod is this project's correctness oracle for Cythera's formats,
// and it is a fork we push fixes to. A fix to the oracle is worth nothing if
// the copy the suite compares against is older than it.
//
// THAT HAPPENED. On 14 September 2026 the fork's colormap was fixed -- the
// palette cycle was written as an addition where the engine subtracts, so a
// ramp ran upwards and water and lava ran backwards. grimoire's submodule
// pointer was not moved with it. `check_all.mjs` prefers the submodule over a
// sibling checkout, so for a day the copy the checks used had the bug while
// the copy beside it on the same disk had the fix, and every run was green:
// delv_graphics_check compares decoded indices, and the cycle is a
// display-time transform it never reaches. An oracle can be wrong in exactly
// the places its consumer does not look, which is the argument for checking
// its version rather than trusting a green row.
//
// WHAT IT COMPARES. The checked-out commit against `origin/master` AS LAST
// FETCHED -- this runs no network. So it catches a pointer left behind, which
// is the failure that happened, and cannot catch a fork that has moved since
// the last fetch. It says which it did.
//
// A DELIBERATE PIN IS POSSIBLE and this would nag about it. If one is ever
// wanted, the honest thing is to record why here rather than to delete the
// check, because the next person to see a stale oracle will assume an
// accident, as happened the first time.

import {existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve} from 'node:path';

const dir = process.argv[2] || 'delvmod';
const skip = why => { console.log(`  skip  ${why}`); process.exit(0); };
if (!existsSync(resolve(dir, 'delv', 'archive.py'))) skip(`no delvmod at ${dir}`);

const git = (...a) => execFileSync('git', ['-C', dir, ...a], {encoding: 'utf8'}).trim();
let head, ref, refName = 'origin/master';
try { head = git('rev-parse', 'HEAD'); } catch (e) { skip(`${dir} is not a git checkout`); }
try { ref = git('rev-parse', refName); }
catch (e) { try { refName = 'master'; ref = git('rev-parse', refName); } catch (e2) { skip(`${dir} has no ${refName} to compare against`); } }

if (head === ref) {
  console.log(`  ok   the oracle is ${refName} — ${head.slice(0, 7)}`);
  process.exit(0);
}
let behind = false;
try { execFileSync('git', ['-C', dir, 'merge-base', '--is-ancestor', head, ref], {stdio: 'ignore'}); behind = true; }
catch (e) { behind = false; }
if (!behind) {
  // Ahead of, or diverged from, the fork. Not the failure this exists for:
  // work in progress on the oracle is normal and is not a stale pointer.
  console.log(`  ok   the oracle is not behind ${refName} — ${head.slice(0, 7)}`);
  process.exit(0);
}
let missed = '';
try { missed = git('log', '--oneline', `${head}..${ref}`).split('\n').filter(Boolean).slice(0, 4).join('; '); } catch (e) {}
const n = missed ? missed.split(';').length : '?';
console.error(`FAIL the oracle is behind ${refName}: ${dir} is at ${head.slice(0, 7)} and ${refName} is ` +
  `${ref.slice(0, 7)}, ${n} commit(s) ahead — ${missed}. The checks are comparing against an older oracle ` +
  `than the fork carries; move the pointer, or record here why it is pinned.`);
process.exit(1);
