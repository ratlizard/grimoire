# Contributing

This is a small project with one maintainer, and most of what arrives will be
a bug report rather than a patch. Both are welcome. What follows is mostly
about saving you work that would be rejected for a reason you could not have
guessed from the outside.

## Reporting something

**Open an issue.** If you found it while playing with the page, the three
things that make a report actionable are the URL from the address bar (it
carries the deep link — `#c=135&r=8801` names the exact resource you were
looking at), which file you had open, and which browser. A screenshot of a
picture that decoded wrongly is worth more than a description of it.

If the page refused your file outright, say what the file is and where it came
from. The loader distinguishes several kinds of refusal and each has its own
message; quoting the message tells me which path you were on.

## Before you write code

**There is no build step, and adding one is the change most likely to be
turned down.** No `package.json`, no bundler, no formatter config, no
transpile step. `utilities/` runs on stock Node 18+ and Python 3 with nothing
installed. This is not a style preference — it is what lets the site be copied
to a USB stick and opened by double-clicking.

**`js/*.js` are classic scripts.** No `type="module"`, no `import`, no
`export`. Everything is declared at top level and shared as globals, because a
module script is fetched with CORS and that fails from a `file://` origin.
`utilities/verify_viewer.mjs` fails the build if a module script appears.
Related: two classic scripts share one global scope, so check that a name you
are adding does not already mean something else.

**Run the checks.** From the repository root:

```sh
node utilities/check_all.mjs
```

A clean run is `0 failed`. Checks whose inputs are missing report **skip**,
which is not a failure — most of them want a copy of the game in `reference/`,
and without one the suite fetches the installer itself and runs what it can.

Two checks print a hash instead of a verdict, so a deliberate change can be
told from an accident. **If a snapshot hash moves and you did not intend it,
you changed what a decoder outputs.** If it does *not* move after you changed
a decoder, the snapshot probably is not covering your change, and the fix is
to add a line to the snapshot rather than to trust the green result.

## The rule that is easy to break by accident

[`delvmod`](https://github.com/BryceSchroeder/delvmod) is Bryce Schroeder's
independent implementation of Cythera's formats, by the person who reverse-
engineered them, and it is the correctness oracle here: two
harnesses read its Python on every run and compare. **Editing it to agree with
this repository destroys the only evidence available that this repository is
right.** So:

- Never edit `delvmod/` from inside this tree. A fix to delvmod belongs in
  delvmod, on a branch there.
- A decoder ported *from* delvmod or systemless cannot cross-check its
  original. Copy freely where there is no oracle role — HFS, StuffIt,
  Installer VISE, infrastructure this tree lacks — and say in the file's
  header which of the two a new file is. Keep writing decoders independently
  where a cross-check exists or is wanted.

The same care applies to `systemless`: read it, port from it with attribution,
do not push to it from here.

## House style

**Comments explain why, at length.** The distinguishing habit of this codebase
is long header comments recording the reasoning, the bug that motivated the
design, and what was tried and rejected. See `js/mac-bytes.js`,
`utilities/check_all.mjs` and `utilities/dom_stub.mjs` for the register. Do
not strip these comments; when you make a non-obvious choice, add to them.

**Commit messages are prose**, not conventional-commits — a sentence
describing the change from the user's side, no `feat:`/`fix:` prefixes and no
scope tags:

> `Ring the square, not the sprite; and read the sheet a name at a time`
> `On a phone the canvas comes first and never leaves the screen`

**If you change a decoder, say in the commit message whether the other
implementations have the same bug.** The same three formats are decoded in C++
in `ratlizard/alchemy` and in Rust in systemless, and no suite here will tell
you when they disagree.

**UI text is plain.** Say what the thing is or does, once. No dates or
development history in the interface. Text derived from game data — the
game's own strings, names and figures — is left exactly as the file has it.

## The game

**Cythera is not in this repository and never will be.** Do not add it, or any
part of it, or anything derived from a copy of it beyond the four files
already in `res/`. `NOTICE` says what the licence covers and what it does not.
Supply your own copy in `reference/`, which is gitignored.

## Licence

GPL-3.0-or-later. By contributing you agree your work is licensed under it.
