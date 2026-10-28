#!/usr/bin/env node
// The merge rule for the version line, so that sessions landing at the same
// time do not stop each other on it.
//
//   git config merge.grimoire-version.driver "node utilities/version_merge.mjs %O %A %B"
//   (index.html merge=grimoire-version, in .gitattributes)
//
// Every commit that changes what a visitor sees bumps GRIMOIRE_VERSION in
// index.html. Two fronts that start from the same version conflict on that
// one line when the second lands, and two that bump the same way merge cleanly
// to a version that two commits share. version_check.mjs then fails the second,
// because the number has to exceed the deployed one. On 28 October 2026 the
// sessions landing together each changed the number by hand and landed again.
//
// The rule applies the bump the commit made to the version already on main. If
// the commit moved the middle number, main's middle number moves and the last
// number goes to zero. If it moved only the last number, main's last number
// goes up by one. A commit that left the number alone leaves main's number as
// it is. Any conflict that is more than the version line stays a conflict with
// its markers, and the exit status reports it, as git expects of a merge
// driver. The version line is the only thing this changes, and
// version_merge_check.mjs runs it on a scratch repository, with the
// conflicting and the same-bump cases among them.
//
// git passes the three versions of the file as base (%O), ours (%A, which the
// driver overwrites with the result) and theirs (%B). In a rebase, ours is the
// branch being rebased onto and theirs is the commit being replayed.

import {spawnSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';

const VERSION = /(GRIMOIRE_VERSION\s*=\s*')(\d+)\.(\d+)\.(\d+)(')/;

export function parseVersion(text) {
  const m = VERSION.exec(text);
  return m ? [Number(m[2]), Number(m[3]), Number(m[4])] : null;
}

// The version a replayed commit has on top of main's, or null when the
// commit did not change the number.
export function bumped(base, ours, theirs) {
  if (!base || !ours || !theirs) return null;
  if (theirs.join('.') === base.join('.')) return null;
  return theirs[1] !== base[1] || theirs[0] !== base[0]
    ? [ours[0], ours[1] + 1, 0]
    : [ours[0], ours[1], ours[2] + 1];
}

// Merges the three files and returns the text and the number of conflicts left.
export function mergeFiles(basePath, oursPath, theirsPath) {
  const run = spawnSync('git', ['merge-file', '-p', '-L', 'ours', '-L', 'base', '-L', 'theirs', oursPath, basePath, theirsPath],
    {encoding: 'utf8', maxBuffer: 1 << 28});
  if (run.status === null || run.status < 0 || run.status > 127) throw new Error('git merge-file failed: ' + run.stderr);
  let unresolved = 0;
  // A conflict whose two sides are each the version line alone is main's.
  let text = run.stdout.replace(/<<<<<<< ours\n([\s\S]*?)=======\n([\s\S]*?)>>>>>>> theirs\n/g, (hunk, mine, theirs) => {
    const only = side => side.split('\n').filter(l => l.length).length === 1 && VERSION.test(side);
    if (only(mine) && only(theirs)) return mine;
    unresolved++;
    return hunk;
  });
  const next = bumped(parseVersion(readFileSync(basePath, 'utf8')), parseVersion(readFileSync(oursPath, 'utf8')),
    parseVersion(readFileSync(theirsPath, 'utf8')));
  if (next && !unresolved) text = text.replace(VERSION, (m, a, x, y, z, b) => `${a}${next.join('.')}${b}`);
  return {text, unresolved};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [base, ours, theirs] = process.argv.slice(2);
  const {text, unresolved} = mergeFiles(base, ours, theirs);
  writeFileSync(ours, text);
  process.exit(unresolved ? 1 : 0);
}
