#!/usr/bin/env node
// Collects the JavaScript a page actually runs, in document order.
//
// The three pages here used to be one HTML file each with one inline <script>,
// and every harness found that script with the same regular expression. Now
// that the code shared between them lives in js/*.js, "the script" is several
// files, and a harness that only reads the inline block silently tests a page
// with its decoders missing -- which fails in a confusing way rather than an
// obvious one.
//
//   import {collectPageScripts, pageSource} from './page_scripts.mjs';
//   const code = pageSource('index.html');   // ready to eval
//
// It also enforces the constraint that makes the split safe in the first
// place: these must be CLASSIC scripts. A `type="module"` script is fetched
// with CORS, and a page opened from file:// has an opaque origin, so a module
// would not load at all when the page is double-clicked instead of served.
// Finding one here is an error, not a warning.

import {readFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';

const SCRIPT_TAG = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const ATTR = /(\w[\w-]*)\s*=\s*"([^"]*)"/g;

export function collectPageScripts(htmlPath) {
  const html = readFileSync(htmlPath, 'utf8');
  const base = dirname(htmlPath);
  const sources = [];
  for (const m of html.matchAll(SCRIPT_TAG)) {
    const attrs = {};
    for (const a of m[1].matchAll(ATTR)) attrs[a[1].toLowerCase()] = a[2];
    if ((attrs.type || '').toLowerCase() === 'module') {
      throw new Error(
        `${htmlPath} has a <script type="module">. These pages have to keep working from ` +
        `file://, where module scripts are blocked by CORS. Use a classic <script src> instead.`);
    }
    if (attrs.src) {
      if (/^[a-z]+:\/\//i.test(attrs.src)) { sources.push({name: attrs.src, code: '', external: true}); continue; }
      const p = resolve(base, attrs.src);
      sources.push({name: attrs.src, code: readFileSync(p, 'utf8'), path: p});
    } else if (m[2].trim()) {
      sources.push({name: htmlPath + ' (inline)', code: m[2], inline: true});
    }
  }
  return {html, sources};
}

// One string, in order, with each file separated so a syntax error in one
// cannot swallow the next.
export function pageSource(htmlPath) {
  return collectPageScripts(htmlPath).sources.map(s => s.code).join('\n;\n');
}

/* Comments and string literals, gone.

   Without this, prose inside a comment or a message string reads as code: the
   words in "That is a MacBinary file" become a call to MacBinary(). Quotes are
   replaced rather than deleted so nothing on either side of them joins up into
   a new identifier.

   This lived in verify_viewer.mjs until 14 September 2026 and moved here when
   a second harness needed it. It could not be imported from there: that file
   runs its checks at import time and calls process.exit, so importing it to
   borrow one function would have run the whole static check and killed the
   caller. Nothing else about it changed, and verify_viewer's output is
   identical across the move, which is the only thing that makes it an
   extraction rather than an edit. */
// Is this '/' the start of a regex literal rather than a division? Look at the
// last meaningful character emitted: after a value (identifier, number, closing
// bracket) a slash divides; after an operator, comma, or opening bracket it
// starts a pattern.
export function isRegexStart(emitted) {
  const m = /([^\s])\s*$/.exec(emitted);
  if (!m) return true;                       // start of input
  const prev = m[1];
  if (/[)\]}]/.test(prev)) return false;      // (a+b) / 2
  if (/[\w$]/.test(prev)) {
    // `return /x/` and `typeof /x/` are patterns; `count / 2` is division.
    return /\b(return|typeof|case|in|of|instanceof|new|delete|void|do|else|yield|await)\s*$/.test(emitted);
  }
  return true;
}

export function stripJsText(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; out += ' '; continue; }
    // A regex literal can contain quotes -- /[\\/:*?"<>|]/ has one -- and
    // without recognising it the scanner enters string mode there and swallows
    // everything up to the next quote, taking real declarations with it. That
    // is what made this check report jumpToResource() as undefined while it was
    // declared thirty lines away.
    if (c === '/' && isRegexStart(out)) {
      i++;
      let inClass = false;
      while (i < src.length) {
        const ch = src[i];
        if (ch === '\\') { i += 2; continue; }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) { i++; break; }
        else if (ch === '\n') break;      // not a regex after all; bail out
        i++;
      }
      out += ' ';
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c; i++;
      while (i < src.length && src[i] !== q) {
        // A template literal's ${...} is real code and has to survive.
        if (q === '`' && src[i] === '$' && src[i + 1] === '{') {
          let depth = 1; i += 2; const start = i;
          while (i < src.length && depth) {
            if (src[i] === '{') depth++;
            else if (src[i] === '}') depth--;
            if (depth) i++;
          }
          // Semicolons, not spaces: `${procID} ... ${(enable>>>0).toString(16)}`
          // emitted side by side reads as a call to procID().
          out += ';' + src.slice(start, i) + ';';
          i++;
          continue;
        }
        if (src[i] === '\\') i++;
        i++;
      }
      i++;
      out += '""';
      continue;
    }
    out += c; i++;
  }
  return out;
}

/* Comments gone, strings kept.

   The other half of the pair, and the distinction matters more than it looks.
   `stripJsText` answers "what does this code DO", so it throws strings away.
   Asking instead "what does this file MENTION" needs them: this page builds
   most of its markup in JS, so `onclick="undoStrikeSwap()"` lives inside a
   string literal and nowhere else, and a harness that reaches a page function
   by name does it as `peek('mergeDelverPatch')`. Strip strings and both look
   like dead code -- which is exactly what reach_check.mjs reported on its
   first run, for 48 functions, nearly all of them live.

   Comments still go, and that is the point of not simply using the raw source:
   a comment that happens to name a function would otherwise count as something
   reaching it, which would mask the very bug the check exists to find. */
export function stripComments(src) {
  let out = '', i = 0;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') { i += 2; while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) i++; i += 2; out += ' '; continue; }
    // A regex literal is copied through whole: its slashes must not be read as
    // the start of a comment, and `/[\\/]/` contains one that would be.
    if (c === '/' && isRegexStart(out)) {
      const start = i; i++;
      let inClass = false;
      while (i < src.length) {
        const ch = src[i];
        if (ch === '\\') { i += 2; continue; }
        if (ch === '[') inClass = true;
        else if (ch === ']') inClass = false;
        else if (ch === '/' && !inClass) { i++; break; }
        else if (ch === '\n') break;
        i++;
      }
      out += src.slice(start, i);
      continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const q = c, start = i; i++;
      while (i < src.length && src[i] !== q) { if (src[i] === '\\') i++; i++; }
      i++;
      out += src.slice(start, i);
      continue;
    }
    out += c; i++;
  }
  return out;
}

// A one-line description for a harness to print, so it is obvious when a page
// is being tested with a file missing.
export function describeScripts(htmlPath) {
  const {sources} = collectPageScripts(htmlPath);
  return sources
    .map(s => `${s.name.replace(/^.*\//, '')} ${Math.round(s.code.length / 1024)}k`)
    .join(', ');
}
