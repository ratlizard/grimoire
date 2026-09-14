#!/usr/bin/env node
/* Is a function reached at all?

   On 14 September 2026 a feature shipped that did not run. `lightCone` was
   written, documented and reported as landed, and `drawLighting` was never
   changed to call it, so the reader sat in the page unreachable while the old
   gradient kept drawing. Every one of the twenty-four checks passed, and
   rightly: `verify_viewer` asks whether every name the JS *calls* is declared
   somewhere, which is the opposite question. Nothing asked whether a
   declaration is ever reached.

   This does. It collects every top-level `function` the page declares and
   every mention of a name anywhere that could reach it, and reports the
   declarations that are mentioned nowhere else.

   Where a reference can legitimately come from, and all four count:

     - the page's own scripts, index.html's inline block and js/*.js
     - an inline HTML handler, onclick="foo()"
     - another harness in utilities/, which reaches a page function through the
       vm sandbox as `G.foo(...)`. nfntSpec and writeNFNT have no caller in the
       page at all and are not dead: nfnt_write_check.mjs is their caller.
     - a name assigned out, `window.foo = foo`

   Two deliberate choices about how it counts, both erring the same way.

   A reference is matched WITHOUT excluding a leading dot, so `G.foo` and
   `obj.foo` both count. That makes the check blind to a dead function whose
   name happens to match a property used elsewhere -- `decodeLite` would be
   reached by any `x.decodeLite`. The alternative, insisting on a bare
   identifier, cannot see the sandbox calls that are most of utilities/, and
   would report a dozen live functions as dead on every run. A check that cries
   wolf is turned off, so this errs towards silence, and it still catches the
   case it was written for: a name that appears literally nowhere else.

   A function's own body is cut out before its name is counted, so a recursive
   function that nothing else calls is still reported.

     node utilities/reach_check.mjs index.html

   ALLOWED below is the list of declarations that are reached by nothing and
   are meant to be, each with a reason. It cannot rot: an entry that becomes
   reached fails the check, the same way delv_dasm_check's pinned divergences
   do, so the list has to be maintained rather than accumulating.

   The negative control runs on every invocation, because a reachability check
   that has quietly stopped finding anything looks exactly like a clean tree. */

import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { collectPageScripts, stripJsText, stripComments } from './page_scripts.mjs';

const htmlPath = process.argv[2] || 'index.html';

/* Declarations that nothing reaches, on purpose. An entry that STOPS being
   unreached is a failure: either it found a caller, in which case take it out
   of this list, or the name changed and the entry is stale. */
/* The first run found twenty-two, and none of them is this check misfiring:
   each appears exactly once in the whole repository, which is its own
   declaration, and canvas.html mentions none of them. Four appear twice, the
   second being a call to themselves from inside themselves, which is why the
   body is cut out before counting.

   They are listed rather than deleted because deleting twenty-two functions is
   a separate decision from adding a check, and some are likely to be the
   remains of features the notes record as removed -- the World tab's preload
   (`prefetchZone`, `buildNearThumbs`, `worldThumb`, `thumbRect`), the
   animation checkboxes that became one radio setting (`toggleMapAnim`,
   `togglePaletteAnim`), the reworked ditherizer (`unditherPreset`,
   `setUnditherPreset`, `toggleUnditherPreview`) -- while others may be a
   feature that was never wired, which is the case this check exists for.
   Triage is a handoff item; this list is the baseline that stops a
   twenty-third appearing unnoticed.

   It cannot rot in either direction: an entry that gains a caller fails, and
   so does one whose function no longer exists. */
const REASON = 'unreached on 14 September 2026, the run that added this check; ' +
               'kept as a baseline, awaiting a decision to wire or delete';
const ALLOWED = new Map([
  'decodableBadge', 'scaleCanvas',                        // js/mac-rsrc-types.js
  // makeDelverPropRecord and delverPropsAtSquare were here until the browser
  // player was added to the corpus, which reaches both. The list said so
  // itself rather than being noticed by hand, which is the whole point of an
  // allowlist that fails when an entry stops being unreached.
  'dvmLooksLikeText',                                     // js/delv-script.js
  'mechLevelForExp',                                      // js/delv-mechanics.js
  'toggleUnditherPreview', 'unditherPreset', 'setUnditherPreset', 'ditherReplacePortrait',
  'togglePaletteAnim', 'toggleMapAnim',
  'worldThumb', 'thumbRect', 'buildNearThumbs', 'prefetchZone', 'zoneMapCanvas',
  'propFrameFill', 'activeScheduleEntry', 'amountRange',
  'buildResourcePatch', 'encodeResourcePatch',
].map(n => [n, REASON]));

// ---- the corpus ------------------------------------------------------------
// Everything that could mention a page function, kept as named pieces so a
// report can say where a name was found rather than only that it was.
function buildCorpus(htmlPath) {
  const collected = collectPageScripts(htmlPath);
  const pieces = [];
  /* Two views of each page script, and they answer different questions.

     `decl` has strings and comments stripped, because a `function foo` inside
     a string or a comment is not a declaration.

     `code` keeps the strings, because a reference can legitimately live in
     one: this page builds markup in JS, so `onclick="undoStrikeSwap()"` is a
     string and nothing else reaches that function. Counting references over
     the stripped text reported 48 live functions as dead on the first run. */
  for (const s of collected.sources) {
    if (s.external || !s.code) continue;
    pieces.push({ name: s.name, code: stripComments(s.code), decl: stripJsText(s.code),
                  page: true, product: true });
  }
  // The markup, with the script bodies taken out so nothing is counted twice.
  // Inline handlers live here and nowhere else.
  pieces.push({
    name: htmlPath + ' (markup)',
    code: collected.html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' '),
    product: true,
  });
  /* The browser player, when it is checked out beside this repository.

     It is not a test and it is not this page: it is a second product that
     VENDORS four of grimoire's files verbatim (`www/delv/`, see the README
     there) and calls into them. `mergeDelverPatch` has no caller in this page
     and is not dead -- `www/index.html` applies a Magpie patch with it, which
     is how the player loads an add-on. Reported as harness-only, it reads as
     dead code, and deleting it would break the player silently, since nothing
     in this repository would notice.

     So its references count as a real consumer's, not a test's. Found the way
     delvmod and wolflizard are found -- $PLAYER, then a sibling checkout --
     and when it is absent the run SAYS so, because the verdict for those
     functions quietly changes without it. */
  const playerDirs = [];
  for (const cand of [process.env.PLAYER,
                      join(dirname(resolve(htmlPath)), '..', 'ratlizard.github.io', 'www'),
                      join(dirname(resolve(htmlPath)), '..', '..', 'ratlizard.github.io', 'www')]) {
    if (!cand) continue;
    try { readdirSync(cand); playerDirs.push(cand); break; } catch { /* not there */ }
  }
  for (const pdir of playerDirs) {
    const walk = (d, depth) => {
      let entries = [];
      try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = join(d, e.name);
        if (e.isDirectory()) { if (depth > 0) walk(p, depth - 1); continue; }
        if (!/\.(mjs|js|html)$/.test(e.name)) continue;
        try {
          pieces.push({ name: 'player/' + e.name, product: true, player: true,
                        code: stripComments(readFileSync(p, 'utf8')) });
        } catch { /* unreadable */ }
      }
    };
    walk(pdir, 2);
  }
  // Every other harness. This file is skipped deliberately: a name written
  // into ALLOWED above would otherwise count as a reference to itself and
  // every allowed entry would report as reached.
  const dir = dirname(resolve(htmlPath, '..')) === '' ? 'utilities' : join(dirname(resolve(htmlPath)), 'utilities');
  let names = [];
  try { names = readdirSync(dir); } catch { names = []; }
  for (const f of names) {
    if (!f.endsWith('.mjs') || f === 'reach_check.mjs') continue;
    try {
      // Strings kept here too: a harness reaches into the page's sandbox by
      // name, `peek('mergeDelverPatch')`, as often as it calls `G.foo()`.
      pieces.push({ name: 'utilities/' + f, harness: true,
                    code: stripComments(readFileSync(join(dir, f), 'utf8')) });
    } catch { /* unreadable is not this check's business */ }
  }
  return { collected, pieces };
}

// Where a function's own text begins and ends, so its name inside itself does
// not count as somebody reaching it. Brace matching on already-stripped source,
// so a brace in a comment or a string cannot throw the count off.
function ownSpan(code, name) {
  const m = new RegExp(`(^|[^\\w$.])function\\s+${name}\\s*\\(`, 'm').exec(code);
  if (!m) return null;
  const start = m.index;
  const open = code.indexOf('{', m.index + m[0].length);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++;
    else if (code[i] === '}') { depth--; if (!depth) return [start, i + 1]; }
  }
  return [start, code.length];
}

function analyse(pieces) {
  // Declared: top-level function declarations in the page's own scripts.
  const declared = new Map();          // name -> piece it is declared in
  for (const p of pieces) {
    if (!p.page) continue;
    for (const m of (p.decl || p.code).matchAll(/^\s*(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm))
      if (!declared.has(m[1])) declared.set(m[1], p);
  }
  const unreached = [], harnessOnly = [];
  for (const [name, home] of declared) {
    const pat = new RegExp(`(?<![\\w$])${name}(?![\\w$])`, 'g');
    let hits = 0, product = 0;
    for (const p of pieces) {
      const n = (p.code.match(pat) || []).length;
      hits += n;
      if (p.product) product += n;
    }
    /* Its own text does not count as somebody reaching it, so the declaration
       and the body are measured separately and taken off. The brace matching
       runs on the stripped view, where a `{` inside a string or a comment
       cannot end the body early; the count it yields is subtracted from the
       total taken over the view that keeps strings. A self-reference written
       inside a string in its own body would be over-subtracted, which would
       report a live function as dead -- nothing in this tree does that, and a
       false alarm is the failure direction that gets noticed. */
    const declSrc = home.decl || home.code;
    const span = ownSpan(declSrc, name);
    if (span) {
      const self = (declSrc.slice(span[0], span[1]).match(pat) || []).length;
      hits -= self;
      if (home.product) product -= self;
    }
    if (hits <= 0) unreached.push({ name, where: home.name });
    /* Reached, but only by a test. `xrefReport` is the case that made this its
       own category: the handoff has recorded for weeks that nothing in the
       page calls it, and this check did not flag it, because
       viewer_smoke.mjs mentions it once and that counted as reached. A
       function whose only caller is a harness is not reached by anything a
       visitor does.

       It is reported rather than failed, because the class is not uniformly
       wrong: `nfntSpec` and `writeNFNT` are writers whose caller is their own
       check by design, and that is the arrangement, not a defect. Telling the
       two apart needs a person, so the check says which functions are in the
       class and leaves the judgement. */
    else if (product <= 0) harnessOnly.push({ name, where: home.name });
  }
  return { declared, unreached, harnessOnly };
}

// ---- the negative control --------------------------------------------------
// A dead function must be found and a live one must not, on input this file
// makes up, every run.
{
  const control = [
    { name: 'page.js', page: true, product: true, code:
      'function __deadControl(a){ return a; }\n' +
      'function __liveControl(b){ return b; }\n' +
      'function __recursiveDeadControl(n){ return n ? __recursiveDeadControl(n-1) : 0; }\n' +
      'function __user(){ return __liveControl(1); }\n' },
    { name: 'other.mjs', harness: true, code: 'G.__user();\n' },
  ];
  const { unreached, harnessOnly } = analyse(control);
  const got = new Set(unreached.map(u => u.name));
  const only = new Set(harnessOnly.map(u => u.name));
  const want = ['__deadControl', '__recursiveDeadControl'];
  const mustNot = ['__liveControl', '__user'];
  const bad = want.filter(n => !got.has(n)).map(n => n + ' was not reported')
    .concat(mustNot.filter(n => got.has(n)).map(n => n + ' was reported and is reached'))
    // The harness-only class has to be found, or xrefReport slips through again.
    .concat(only.has('__user') ? [] : ['__user was not reported as reached only by a harness'])
    .concat(only.has('__liveControl') ? ['__liveControl is reached in the page and was called harness-only'] : []);
  if (bad.length) {
    console.error('reach: the negative control is broken — ' + bad.join('; '));
    process.exit(1);
  }
}

// ---- the real run ----------------------------------------------------------
let pieces;
try { ({ pieces } = buildCorpus(htmlPath)); }
catch (e) { console.error('reach: ' + e.message); process.exit(2); }

const { declared, unreached, harnessOnly } = analyse(pieces);
const unexpected = unreached.filter(u => !ALLOWED.has(u.name));
const allowedButReached = [...ALLOWED.keys()].filter(n => declared.has(n) && !unreached.some(u => u.name === n));
const allowedButGone = [...ALLOWED.keys()].filter(n => !declared.has(n));

console.log(`${declared.size} functions declared, ${unreached.length} reached from nowhere` +
            (ALLOWED.size ? `, ${ALLOWED.size} allowed` : '') +
            `, ${harnessOnly.length} reached only by a harness`);
for (const u of harnessOnly)
  console.log(`  note: ${u.name}() in ${u.where} is reached only from utilities/, ` +
              `so nothing a visitor does reaches it`);

for (const u of unexpected)
  console.error(`  ${u.name}() is declared in ${u.where} and nothing reaches it`);
for (const n of allowedButReached)
  console.error(`  ${n}() is in the allowed list but something reaches it now — take it out of the list`);
for (const n of allowedButGone)
  console.error(`  ${n}() is in the allowed list and is not declared anywhere — the entry is stale`);

if (unexpected.length || allowedButReached.length || allowedButGone.length) {
  console.error('A function nothing reaches is either dead code to delete or a feature that was ' +
                'never wired up. The second is why this check exists.');
  process.exit(1);
}
