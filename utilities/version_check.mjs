#!/usr/bin/env node
/* The version, held against what is actually deployed.

   `GRIMOIRE_VERSION` in index.html is bumped by hand in the commit that
   changes what a visitor sees. Nothing read it -- no utility in this directory
   so much as mentioned the name -- so a missed bump failed nothing, and one
   was missed: the five section moves of 13 September 2026 shipped while the
   page still said 1.66.0. Every other figure in this project that lived only
   in prose went stale the same way, and the answer each time was to have a
   check print it rather than to correct the prose again.

   What a check CAN know, without knowing what the author intended: whether
   this tree would deploy a page different from the one on origin/main while
   claiming the same version number. That is the whole rule, and it is
   decidable -- if any file a visitor receives differs from the deployed copy,
   the number must differ too, and must be the greater of the two.

   Three things it deliberately does not do:

   - It does not judge a feature against a fix. Middle number or last is the
     author's call and no rule here could tell them apart.
   - It does not read the commit message, and it does not care how many
     commits are on the branch. A front lands as one batch; the unit that
     matters is this tree against the deployed one.
   - It does not fail outside a git checkout, or without a baseline ref to
     compare against. A session handed these files without their history has
     nothing to measure and says so; a skip reads honestly where a pass
     invented from no evidence does not.

   Only four paths count as visitor-facing: index.html, canvas.html, js/ and
   res/. utilities/ is this directory, and a check changing does not change
   what anybody is served.

     node utilities/version_check.mjs index.html [baseline-ref]

   The comparison is a pure function of (changed files, this version, that
   version), which is what lets the negative control below exercise every
   verdict on made-up input rather than needing a doctored checkout. It runs on
   every invocation: a check that cannot fail is worth nothing, and this file
   exists because of a rule that had nothing enforcing it. */

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';

const htmlPath = process.argv[2] || 'index.html';
const refArg = process.argv[3] || '';

if (!existsSync(htmlPath)) {
  console.error('version: no such file: ' + htmlPath);
  process.exit(2);
}

/* ---- the rule, as a function of what can be observed --------------------- */

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;

function cmpVersion(a, b) {
  const ma = SEMVER.exec(a), mb = SEMVER.exec(b);
  if (!ma || !mb) return null;
  for (let i = 1; i <= 3; i++) {
    const d = (+ma[i]) - (+mb[i]);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

// changed: the visitor-facing paths that differ from the baseline.
// here/base: the version this tree claims and the one the baseline claims.
function decide(changed, here, base) {
  if (!SEMVER.test(here)) return { ok: false, why: 'the version is not major.minor.patch: ' + here };
  if (!changed.length) return { ok: true, why: 'nothing a visitor receives has changed' };
  if (here === base) return { ok: false,
    why: changed.length + ' visitor-facing file' + (changed.length === 1 ? '' : 's') +
         ' changed and the version is still ' + here + ': ' + changed.join(', ') };
  const c = cmpVersion(here, base);
  if (c === null) return { ok: false, why: 'cannot compare ' + here + ' with ' + base };
  if (c < 0) return { ok: false, why: 'the version went backwards, ' + base + ' to ' + here };
  return { ok: true, why: base + ' to ' + here + ' over ' + changed.length + ' file' + (changed.length === 1 ? '' : 's') };
}

/* ---- the negative control ------------------------------------------------
   Every verdict, on input this file makes up, so the decision cannot quietly
   stop deciding. The case that matters is the third: it is the exact shape of
   the bug this check was written for. */
{
  const control = [
    ['a clean tree passes',            decide([], '1.0.0', '1.0.0').ok === true],
    ['a real bump passes',             decide(['index.html'], '1.1.0', '1.0.0').ok === true],
    ['a missed bump fails',            decide(['index.html'], '1.0.0', '1.0.0').ok === false],
    ['going backwards fails',          decide(['index.html'], '0.9.0', '1.0.0').ok === false],
    ['a malformed version fails',      decide(['index.html'], '1.0', '1.0.0').ok === false],
    ['a bump with no change passes',   decide([], '1.1.0', '1.0.0').ok === true],
  ];
  const bad = control.filter(([, passed]) => !passed);
  if (bad.length) {
    console.error('version: the negative control is broken — ' + bad.map(([n]) => n).join('; '));
    process.exit(1);
  }
}

/* ---- what this tree says ------------------------------------------------- */

const html = readFileSync(htmlPath, 'utf8');
const decls = [...html.matchAll(/const\s+GRIMOIRE_VERSION\s*=\s*'([^']*)'/g)];
if (decls.length !== 1) {
  console.error('version: expected one GRIMOIRE_VERSION declaration, found ' + decls.length);
  process.exit(1);
}
const here = decls[0][1];
// It has to reach the page as well as exist. The name is declared once and
// read once, in the brand element; a declaration nothing renders would satisfy
// every other line of this check and show the visitor nothing.
const uses = (html.match(/GRIMOIRE_VERSION/g) || []).length;
if (uses < 2) {
  console.error('version: GRIMOIRE_VERSION is declared and never rendered');
  process.exit(1);
}

/* ---- what is deployed ---------------------------------------------------- */

const root = (() => {
  try {
    return execFileSync('git', ['-C', dirname(resolve(htmlPath)), 'rev-parse', '--show-toplevel'],
                        { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch { return null; }
})();

if (!root) {
  console.log('version ' + here + ', no git checkout to compare against — skipped');
  process.exit(0);
}

// maxBuffer, and it is not a detail: `git show <ref>:index.html` returns 1.4 MB
// and Node's default pipe buffer is 1 MB, so the very first run of this check
// threw, was caught below, and reported itself as "could not read origin/main
// -- skipped". A check written to catch a silent miss had a silent miss of its
// own within an hour of being written. Hence the size here, and hence the
// failure below being a failure rather than a skip.
const git = (...args) =>
  execFileSync('git', ['-C', root, ...args],
               { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 << 20 });

const ref = (() => {
  for (const r of [refArg, 'origin/main', 'main'].filter(Boolean)) {
    try { git('rev-parse', '--verify', '--quiet', r); return r; } catch { /* not here */ }
  }
  return null;
})();

if (!ref) {
  console.log('version ' + here + ', no baseline ref (origin/main or main) — skipped');
  process.exit(0);
}

const PATHS = ['index.html', 'canvas.html', 'js', 'res'];
let changed = [];
let base = '';
try {
  changed = git('diff', '--name-only', ref, '--', ...PATHS).split('\n').filter(Boolean);
  const baseHtml = git('show', ref + ':index.html');
  const m = /const\s+GRIMOIRE_VERSION\s*=\s*'([^']*)'/.exec(baseHtml);
  base = m ? m[1] : '';
} catch (e) {
  // Not a skip. The ref exists -- rev-parse just verified it -- so anything
  // failing here is this check breaking, and a broken check that reports a
  // skip is indistinguishable from a clean tree, which is the whole failure
  // this file was written to stop.
  console.error('version: ' + ref + ' exists but could not be read: ' +
                (e.message || '').split('\n')[0]);
  process.exit(1);
}

if (!base) {
  console.log('version ' + here + ', ' + ref + ' carries no version to compare — skipped');
  process.exit(0);
}

const verdict = decide(changed, here, base);
console.log('version ' + here + ' against ' + ref + ' at ' + base + ': ' + verdict.why);
if (!verdict.ok) {
  console.error('The version is bumped by hand in the commit that changes what a visitor sees:');
  console.error('the middle number for a feature, the last for a fix.');
  process.exit(1);
}
