#!/usr/bin/env node
/* css_check.mjs -- is every class the page puts on an element styled by
 * something?
 *
 *   node utilities/css_check.mjs index.html
 *
 * The one kind of damage no other check can see. Deleting the old World
 * renderer, a cut running from one comment banner to the next took the
 * atlas panel's whole stylesheet with it, and the World tab showed a zoom
 * slider over nothing: the markup was intact, every id resolved, every
 * function was declared, and style is not script. That was the third such
 * sweep (the handoff, "what cost the most time"). This is the check that
 * would have failed: every class name the page assigns -- in the markup, in
 * markup built in JS strings, through className, classList and the el()
 * helper -- must have a rule in the page's <style> blocks, except the ones
 * pinned below, which are hooks the script reads and nothing styles.
 *
 * The pinned list is a baseline in reach_check's manner: an entry that
 * gains a rule fails, so does one no longer assigned anywhere, so the list
 * cannot rot. The other direction -- a rule whose class nothing assigns --
 * is reported and not failed, since a class can be assembled by
 * concatenation this reading does not follow, and dead style is a cost and
 * not a fault. */

import {readFileSync, readdirSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const page = process.argv[2] || 'index.html';
const html = readFileSync(resolve(ROOT, page), 'utf8');

// Classes the page assigns but nothing styles, as of 18 September 2026,
// each a hook the script reads or a name that was never styled. Pinned so
// a stylesheet that loses a rule fails and this list does not grow unseen.
const UNSTYLED = new Set([
  'f1',          // the second tab folder is `folder f1`; `folder` is styled and `f1` never was
  'lblText', 'eachOne', 'exeListing', 'pwReadout', 'orphanCell',   // named for reading, not for style
  'mechBody',    // the body of a rules card (mechSectionEl); nothing styles it by that name
  'tileFacts',   // the facts under a zoomed tile, styled inline where it is made
  'gated',       // on <body> while the gate stands; the script reads it
  'worldTab',    // on the World tab's button; the script reads it
]);

const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
const styled = new Set([...css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)].map(m => m[1]));

const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(m => readFileSync(resolve(ROOT, m[1]), 'utf8'));
const inline = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].map(m => m[1]);
const js = scripts.concat(inline).join('\n');
const markup = html.replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<script[\s\S]*?<\/script>/gi, '');

const used = new Map();
const add = (name, how) => { if (!/^-?[_a-zA-Z][\w-]*$/.test(name)) return; if (!used.has(name)) used.set(name, new Set()); used.get(name).add(how); };
for (const m of markup.matchAll(/\bclass\s*=\s*"([^"]*)"/g)) for (const c of m[1].split(/\s+/)) if (c) add(c, 'markup');
for (const m of js.matchAll(/class=\\?["']([^"'\\$]*)\\?["']/g)) for (const c of m[1].split(/\s+/)) if (c) add(c, 'a string of markup');
for (const m of js.matchAll(/className\s*=\s*['"]([^'"]*)['"]/g)) for (const c of m[1].split(/\s+/)) if (c) add(c, 'className');
for (const m of js.matchAll(/classList\.(?:add|toggle|remove|contains)\(\s*['"]([^'"]+)['"]/g)) add(m[1], 'classList');
for (const m of js.matchAll(/\bel\(\s*['"][a-z]+['"]\s*,\s*['"]([^'"]*)['"]/g)) for (const c of m[1].split(/\s+/)) if (c) add(c, 'el()');

let failures = 0;
const fail = m => { failures++; console.log('  FAIL ' + m); };
const unstyled = [...used].filter(([c]) => !styled.has(c)).map(([c]) => c);
for (const c of unstyled) if (!UNSTYLED.has(c))
  fail(`class "${c}" is put on an element (${[...used.get(c)].join(', ')}) and no rule styles it; if it is a hook, pin it in css_check.mjs`);
for (const c of UNSTYLED) {
  if (styled.has(c)) fail(`"${c}" is pinned as unstyled but a rule styles it now; take it off the list`);
  else if (!used.has(c)) fail(`"${c}" is pinned as unstyled but nothing assigns it any more; take it off the list`);
}
const unused = [...styled].filter(c => !used.has(c));
console.log(`  ${styled.size} classes styled, ${used.size} assigned; ${unstyled.length} assigned without a rule, all pinned`);
if (unused.length) console.log(`  note: ${unused.length} styled classes nothing assigns by name (concatenated, or dead): ${unused.join(' ')}`);
console.log(failures ? `\nFAIL — ${failures} problem(s)` : `\ncss: every assigned class is styled or pinned; ${styled.size} rules' classes, ${used.size} assigned`);
process.exit(failures ? 1 : 0);
