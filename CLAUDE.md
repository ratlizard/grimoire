# CLAUDE.md

Guidance for AI assistants working in this repository: **what every change
needs, to be read whole.** `REFERENCE.md` beside it holds the rest -- the
account behind each rule, the file-by-file and check-by-check tables, the
measurements and the history -- and is read by section; its contents, and what
each section answers, close this file, and `../tools/find.sh <words>` from the
workspace searches it with every other guide and log. The reasoning behind
each feature, by version, is `cythera-workbench/doc/GRIMOIRE-NOTES.md`, and
the handoff is `cythera-workbench/doc/GRIMOIRE-NEXT.md`: both live in the
private workbench, because this repository is public and serves every file it
commits while they name routines and print disassembly. This file is tracked
since 19 September 2026 and names routines too, as the checks beside it do.

## What this is

**Grimoire** is a GitHub Pages site of tools for reading, and in a narrow way
editing, the data of *Cythera* (Ambrosia Software, 1999) and of classic Mac OS
files generally, at <https://ratlizard.github.io/grimoire/>. The whole of it is
`index.html` (the viewer, so the site is reached at `/grimoire`),
`canvas.html`, `js/` and `utilities/`. **There is no build step**: no
`package.json`, no lockfile, no workflow; `.nojekyll` serves every file as
committed.

**Pushing to `main` deploys the site**, live within a minute or two, with no
staging: run the checks below before pushing. The maintainer's rule is to push
without asking while nobody uses the site; that rests on archive.org's download
count for the installer item staying where it was (`REFERENCE.md`, *What this
is, in full*, has the figures and how to re-check them). Re-check it before
assuming it still holds.

**The version** is `GRIMOIRE_VERSION` in `index.html`, shown at the top of the
page. Bump it in the commit that changes what a visitor sees: the middle
number for a feature, the last for a fix. `utilities/version_check.mjs` fails
if `index.html`, `canvas.html`, `js/` or `res/` differ from `origin/main` while
the number does not. The maintainer is credited as **EgadZoundsGadzooks**, a
handle, in the page's footer and nowhere else.

The repositories beside this one are read from here and never written to:
`ratlizard/delvmod` (the submodule, the oracle for the Delver formats),
`ratlizard/wolflizard` (the systemless fork, whose HFS reader the disk-image
writer is round-tripped through), `ratlizard/ratlizard.github.io` (the browser
player, where "play" lives), `ratlizard/cythera-workbench` (private: the
analysis tools and the handoffs) and `ratlizard/alchemy` (dormant). The game
clock, the healing, the talk balloon and the enemy table are read out of the
application's PowerPC code by the page itself (`js/mac-ppc.js`, `pefLoad`, the
`exe*` readers). `reference/` is where you put your own copy of the game;
it is gitignored.

## Working beside the forks

delvmod and wolflizard are inputs: a fix to one belongs in that repository,
never as an edit made from here, because a decoder edited to agree with this
one has stopped being an oracle. The suite finds each by a file inside it
(`firstHolding` in `utilities/check_all.mjs`): the `delvmod/` submodule or a
sibling `../delvmod`, `../wolflizard`; `$DELVMOD` and `$SYSTEMLESS` override.
wolflizard's `examples/hfs_dump` is on its `cythera-detailed` branch. With no
game in `reference/`, `utilities/fetch_game.mjs` fetches the installer from
archive.org into `$TMPDIR`, so the suite still runs; a skip reads like a clean
result, so a check that skips for a missing input is worth noticing.
`.claude/settings.json` denies `Edit` on the siblings. `REFERENCE.md`, *Working
beside the forks, in full*, has the rest.

## Layout

```
index.html               Delver archive + resource fork viewer (Grimoire itself)
canvas.html                 colour-cycling paint studio
js/                         classic scripts, three tiers (see below)
utilities/                  the site's Node + Python harnesses and converters
res/                        the page's typefaces and their licences
reference/                  gitignored: the game, and what a person or a model reads while working
delvmod/                    submodule, the correctness oracle (see below)
```

**`res/` and `reference/` are different kinds of thing.** `res/` is the
page's own typefaces and their licences, which `NOTICE` lists; nothing of the
game's has been in it since 17 September 2026, and the game's font is read
out of the open file (`installGameFont`). What of the game's the repository
does carry, `canvas.html`'s pictures and the color table, `NOTICE` lists
under *What of the game's is here*. Everything else that is
Cythera's — the game, its data, the installers, the community add-ons — lives
in `reference/`, which is gitignored: none of it is ours to publish, so supply
your own copy of the game and put it there (a symlink to a copy kept elsewhere
is fine). Nothing in the repository will fetch it for you, and that is
deliberate. `reference/` is also what you read while working: the scraped
forums and guides, the game's own documentation, Apple's Inside Macintosh
volumes. Nothing in `reference/` is fetched by a page, and nothing should
start being.

```
reference/  (gitignored — supplied by you)
    game/
        Cythera Data.hqx, Cythera.hqx  the game, both forks, BinHex
        installers/                    the 1.0.x installers, the archive.org copies
        installed-folders/             the .sit folders systemless launches from
        combat-ai/, manuals/           the shipped .ai scripts; Ambrosia's PDFs
    community/
        guides-site/                   the Cythera Guides pages; dialogue/Dialogue/ is the verified dialogue, the oracle below
        fandom-wiki/, delver-homepage/, forum-writing/
        addons/, editors/              player-made add-ons; ACE
    apple-documentation/               the cited Inside Macintosh and technical notes
    saves/, screenshots/
```

## The hard constraint: classic scripts, `file://`-safe

**This is not a style preference.** `js/*.js` are classic scripts -- no
`type="module"`, no `import`, no `export` -- declared at top level and shared as
globals, because these pages have to work when copied to a USB stick and
double-clicked, and a module script is fetched with CORS, which fails from an
opaque `file://` origin. Never add `type="module"`; keep the `<script src>`
order matching the dependency order; `utilities/verify_viewer.mjs` and
`utilities/page_scripts.mjs` fail on a module script.

`js/` has three tiers: **generic classic-Mac formats** (`mac-*.js`, which know
nothing of Cythera, the PowerPC decoder and assembler among them;
`mac-bytes.js` first), **Cythera's own formats** (`delv-*.js`: the archive,
graphics, the Delver VM, the assembler, the rule models, the game's fixes and
the program's, each with the code that writes them in), and **the page's own furniture** (`delv-sheets.js`,
`delv-mapview.js`, then the fourteen `page-*.js` files in their load order).
`REFERENCE.md`, *The classic scripts and the js/ files, tier by tier*, has a
line for every file. Two rules from it that every change meets:

- **The delv-* tier takes the archive as an argument**: `openDelverArchive(bytes)`
  returns it and every reader takes it first (`getResourceBytes(arc, resid)`).
  The page's open file is `ARCHIVE`, assigned by `parseArchiveBytes` alone. A
  table the page derives from the file goes on `DERIVED`, never on `window`.
- **One global scope, so a name means one thing.** A function declared in two
  scripts silently takes the later one; check for a collision before moving a
  declaration, and `verify_viewer.mjs` fails on a name declared twice or
  resolving nowhere.

### Where new code goes

The line is **the DOM**, not the subject matter. Code that turns bytes into
other bytes goes in `js/`; code that turns bytes into something on screen stays
in the page. `decompressDCG` returns a `Uint8Array` and `undither` returns RGBA,
so both are checkable against delvmod and against a snapshot; `drawToCanvas`
and `renderMapVisual` are not, and stay where they are. A decoder that needs a
canvas cannot be compared with a Python one, which is the whole reason the
oracle works.

**An extraction must not move a snapshot hash.** That is what makes it an
extraction. Move code in one commit and prove the hash is unchanged; fix the
bug in the next. Do both at once and the hash moves for two reasons and tells
you nothing — which throws away the only evidence available that ~2,000 lines
landed intact.

## Running things locally

The pages open fine from `file://`. For a server:

```sh
python3 -m http.server 8000
```

## Checks

```sh
node utilities/check_all.mjs            # everything, one table, about 90 seconds
node utilities/check_all.mjs --quick    # skip the slow browser-ish smokes
CHECK_JOBS=1 node utilities/check_all.mjs   # one check at a time
```

`check_all.mjs` does the setup (the forks extracted into `$TMPDIR`, the
delvmod graphics reference built), runs every harness and prints one table and
the sentence a clean run should match; paste that rather than counting. A
missing input is a **skip**, not a failure. Use `$TMPDIR` for scratch, never
`/tmp`.

- **An expected value lives beside its check in `check_all.mjs`**, and a
  mismatch fails. If you change what a decoder outputs, move the value in the
  same commit. If a snapshot does not move after a decoder change, the
  snapshot is probably not covering it: add a line to it rather than trusting
  the green.
- **Every harness's header comment carries its reasoning** -- the bug that
  motivated it, what it cannot see, its negative control -- and is where to
  read before changing one. `page_scripts.mjs` collects a page's scripts
  (use `pageSource(path)`), `dom_stub.mjs` is the one DOM and canvas stub
  (`makeSandbox()`), `smoke_boot.mjs` boots the page for the smoke's parts.
- **What the rule models' check proves.** `mech_check.mjs` holds
  `js/delv-mechanics.js` to `mech_ref.mjs`, a Monte Carlo written from the
  same prose, so the two can be wrong together: both left out the attacker's
  body roll until 28 September 2026. The check against the game is the
  workbench's `tools/combat-check/`, which counts blows in the fork, and it
  covers combat only.
- `REFERENCE.md`, *The checks*, has the table of what each check holds, the
  data setup and the patch builders in `utilities/`.

### Traps inside the `node:vm` harnesses

Already paid for; do not rediscover them.

- Top-level `const`/`let` are **not** properties of a vm global. Reach them
  through `peek(name)`, an `eval` defined inside that scope. Function
  *declarations* are fine.
- `window` must **be** the sandbox object itself. The pages assign
  `window.previewResource` and elsewhere call bare `previewResource`; two
  distinct objects silently diverge.
- Buffers made inside the vm come from the vm's own `ArrayBuffer`, so
  `instanceof ArrayBuffer` is false on the Node side. Duck-type. Getting this
  wrong produced zero-byte WAVs that looked like successes.
- A stubbed `IntersectionObserver` must actually fire. The galleries decode
  lazily; a no-op observer means the UI smoke test reports "clean" having
  decoded nothing.
- `history.replaceState` must rewrite `location.hash`, as it does in a browser.
  Stubbing it as a no-op hid a real deep-link bug.
- **A fake clock must not start at zero**, and this cost two debugging sessions
  in one afternoon. `mobile_input_check.mjs` drives `pumpButtons`, which
  compares `Date.now()` against `lastButtonAt`, initialised to `0`; from a
  clock at 0 every transition looks like it arrived before the gap expired, so
  the outbox deferred for ever and the check hung with no output. Starting the
  clock at a real timestamp fixed that and immediately broke the other half:
  `asTheMacSeesIt` counted sync windows from zero, so a 2026 timestamp meant
  billions of empty windows. Anchor derived time to the first message's own
  timestamp, and start the clock where a browser's would be.

## delvmod is the correctness oracle

`delvmod` is an independent implementation of the Delver formats, and
`js/delv-archive.js` and `js/delv-script.js` carry tables it worked out first.
`delv_crosscheck.mjs` parses its Python on every run (the encryption lists,
the opcode table, the symbol tables, the decrypt verdicts),
`delv_graphics_check.mjs` compares `decompressDCG` pixel for pixel and
`delv_dasm_check.mjs` compares the disassembler's decode events; keep them
green. **Never patch the oracle**: the submodule is `ratlizard/delvmod`, fixes
go to that fork, and `utilities/delv_compat.py` makes it import on a modern
Python from outside. **Check the harness before believing its failure**: every
first-run disagreement these have reported was the harness's own bug.
`REFERENCE.md`, *delvmod is the correctness oracle, in full*.

## Two implementations, one format

The mac-* tier has no oracle: a snapshot proves a decoder unchanged, never
right. Its second opinions are the retired port in `ratlizard/alchemy` and
systemless, which decode the same formats independently. The HFS writer,
Installer VISE and StuffIt were ported from systemless and stuffit-rs and so
cannot cross-check them. **If you change a decoder, say in the commit message
whether the other implementations have the same bug.** `REFERENCE.md`, *Two
implementations, one format, in full*, has the known differences.

## Things that look wrong and are not

Read the comment above a constant before correcting it.

- **The palette.** `PALETTE` in `js/delv-graphics.js` differs from the game's own
  `clut` 256 at exactly two entries — index 0 (`ffffff` vs `fcfcfc`) and index
  247 (`b56d45` vs `b46c44`). Both are absorbed: `scale6to8` is
  `round((v >> 2) * 255 / 63)`, and the `>> 2` discards exactly those bits, so
  the rendered pixels are identical. Do not "fix" it.
- **The palette is not injective, so there is no reverse map.** 28 of its 256
  entries share a colour with another entry — `fcfcfc` is 0x0F and 0x10,
  `545454` is 0x08 and 0x1A, `540000` is 0x2F and 0x3F, and so on. Building a
  colour→index table to compare a rendered PNG against a decoder's indices
  therefore reports differences that are not there: the two agree on every
  pixel and disagree on which of two equal slots produced it. Compare indices
  against indices, or pixels against pixels, never one against the other.
  `canvasToIndexed` builds such a table on purpose (`_palLookup`, counted down
  from 255 so the lowest index above 0 wins a shared colour), and it is for
  taking a painted canvas back to indices, not for checking a decode.
- **`PALETTE` and `MAC_4BIT_PAL`/`MAC_8BIT_PAL` in `js/mac-rsrc-types.js` are
  not duplication.** Those are Apple's standard tables; this is Cythera's own
  CLUT. Sharing them would be a mistake, and the two-tier `js/` says which is
  which: Apple's are in the mac-* tier, Cythera's is in `delv-graphics.js`.
  Check that two things are the same thing before sharing them.
- **Subindex 255 of the shipped archive is nonsense** (`off=0xA07F5000
  cnt=0xFFFF0000`) and is bounds-checked away at parse time. All 34 real
  subindexes still validate.
- **Indexed-colour PNGs are written by hand** rather than through
  `canvas.toBlob()`, because `toBlob` drops the palette and adds an iCCP profile
  that colour-manages pixels which are already exactly right.

## Per-page notes

- **`index.html`**: the reasoning is in `cythera-workbench/doc/GRIMOIRE-NOTES.md`,
  an entry per feature or version, newest last. Read the entry for the area
  you touch before changing it, and write the entry for a change there, not
  here.
- **`canvas.html`** is self-contained (it does not use `js/`): one page, three
  columns, no paragraphs, a hover `title` for what a control does. Before
  pushing a change to how it looks, drive it in a browser and read the
  screenshots at desktop and phone sizes. `REFERENCE.md`, *Per-page notes, in
  full*.

## Licensing

`LICENSE` is GPL-3.0-or-later and covers the work here. `NOTICE` says what
the licence does not cover, and that list is the one to keep accurate:
Cythera itself, the few pieces of it that are here, the typefaces in `res/`,
and `delvmod/`, which is GPLv3 and referenced as a submodule.

GPL matches the two projects this repository exchanges code with — delvmod
(GPLv3) and systemless (GPL-3.0-or-later) — so code can flow in both
directions. Porting from either is allowed: keep the original's copyright
notice, and say in the file's header comment and the commit message what
was ported and from where. Contributing *to* systemless is GPL to GPL, with
one thing to know before opening a pull request there: its `LICENSING.md`
adds a CLA that lets its author also ship contributions in
commercially-licensed builds — your code stays GPL in the public repo
regardless.

The constraint is methodological, not legal:
**a decoder ported from delvmod or systemless cannot cross-check its
original.** The harnesses in `utilities/` are oracles only because the two
implementations were written independently — port a decoder and its check
becomes a mirror. So copy freely where there is no oracle role (the rdasm
assembler, StuffIt, HFS, Installer VISE — infrastructure this tree lacks
entirely), and keep writing decoders independently where a cross-check
exists or is wanted, saying which of the two a new file is in its header.

## Conventions

**Comments explain *why*, at length.** This codebase's distinguishing habit is
long header comments recording the reasoning, the bug that motivated the design,
and what was tried and rejected — see `js/mac-bytes.js`,
`utilities/check_all.mjs`, `utilities/dom_stub.mjs` and
`utilities/loader_test.mjs`. When you make a non-obvious choice, write
down why, in that voice. Do not strip these comments.

**UI text is plain and says the thing once.** No dates or development
history in the interface, nothing shaped for effect, no asides in dashes,
and no text that adds nothing. Text derived from the game's data — its own
strings, names, descriptions and barks, and the figures read out of the
file — is reproduced exactly and is never rewritten for style. Set by the
maintainer on 7 September 2026; the pass that applied it is v1.24.1 in
`cythera-workbench/doc/GRIMOIRE-NOTES.md`. Comments are the opposite and stay
long, as below.

**A section opens by saying what it is for and what to do there, and
headings are in Title Case.** The maintainer's rule of 1 October 2026, set
by his own rewrite of Compare Patches: speak to the reader ("Open a patch
here to see what it changes"), and cut background on formats, on which
routine or table a figure was read from, and on how the page works, even
when it is true. A heading that names an action reads as one ("Make a
Gremlin", "Compare Two Files"). A short grey hint beside a control is
welcome; a long prelude is not. The pass that applied it is logged under
`grimoire/prose-pass-he47ij`.

**A colon does not join two sentences.** The maintainer's rule of
3 October 2026: "no released copy can switch on: its code works only..."
takes a semicolon or a full stop. A colon stays where it introduces a
list or names a field ("Melee: damage, reach..."). The pass that applied
it is in the log under that date.

**No em dashes anywhere on the site, and never a `#` in Argos.** The
maintainer's rule of 9 September 2026: an em dash in UI text becomes a
comma, a colon, a full stop or parentheses, whichever the sentence wants;
`#` is a special glyph in Argos A Nouveau, so a resource is "PICT 128" and
a count column is headed "no.". Both pages were swept on that day (v1.35.0)
and a new string must not bring either back. Comments are not the site and
may punctuate as they like.

**Text you read is white, text you can click is gold, and nothing is set in
capitals.** The game's own rule, and the maintainer's on 8 September 2026
(v1.30.0): `--gold` goes on what responds to a click — buttons, chips, the
crumb, the keyword pills — and on nothing else; headings, ids, prices, stat
figures and code panes are white; the quiet labels (`.partsTitle`,
`.skillKey`, `.mechSub`, the chips' second lines) are a pale near-white,
`#f0ede4` or `#dcd8cc`, never a mid grey: quiet by size, not by colour
(`REFERENCE.md`, *Per-page notes, in full*, has why).
Every `text-transform:uppercase` in the sheet went the same day — Argos in
capitals is hard to read — save the two-letter `.guessTag`, which is in a
system font. Keep to it when adding a rule: a new colour is one of white,
`--gold` or the two pale tones.

**A number read off a script is a link to its line, and the code keeps no
copy of the file.** The maintainer's rule of 11 September 2026 (v1.50.0): a
figure a sheet states from a script is read with the offset of the
instruction that holds it (`dvmOpsOf`, `dvmSeqFirst`, `dvmVal`, or
`dvmValAtLine` for a reader that walks lines) and printed with `srcNum`,
which opens the script ringed at that line (`jumpToScriptAt`). Never type
the number into the sentence behind a pattern that checks the script still
says it, and never give a reader or a model a default equal to the shipped
file's value: a figure that is not read drops its sentence. A built-in
name table keeps only what the file does not say; measure an entry against
the file before adding one.

A figure the application's code decides is held to the same rule (v1.51.0,
after the maintainer asked why nothing was read from the program): read out
of its PowerPC code with the address of the instruction (`exeOpsNamed`,
`exeFind`, `exeVal`), printed with `srcNum`, which then opens the routine
listed with that instruction ringed (`jumpToExeAt`); a reader matches the
shape of the instructions, never an address. With no application open the
section says where its figures come from and states none. **A count of things
links to the things** (the maintainer, 2 October 2026): `searchFor(q)` when
a search finds exactly them ("49 spells" is `call_resource CastSpell`),
`countLink(label, title, chips)` otherwise, checked in a browser to list as
many as it says. A count printed beside the list it counts (a table's
caption, a fold's gist) needs no link. A listing
line's offset counts from its object's start, not the resource's, which
`dvmOpsOf` corrects. The smoke's `file figures` block pins the scripts'
half and its `program figures` and `program keys` blocks the program's.

**Commit messages are prose, not conventional-commits.** They read like a
sentence describing the change from the user's side:

> `Ring the square, not the sprite; and read the sheet a name at a time`
> `On a phone the canvas comes first and never leaves the screen`
> `Two kinds of back, and a list view for the galleries`

Match that register. No `feat:` / `fix:` prefixes, no scope tags.

**Do not add tooling.** The site has no build step and does not want one: no
`package.json`, no bundler, no formatter config, no transpile step, and
`utilities/` runs on stock Node and Python with nothing installed. Write it by
hand, as everything there does.

The add-ons in `reference/community/addons/` are mostly opened by the page
itself; `unar` opens the rest. `REFERENCE.md`, *The add-ons, and what opens
them*, says which, and what `utilities/addons_check.mjs` proves with them.

## Gotchas

- Editing `*.html` here means editing files of 2k–10k lines. Use targeted
  `grep` + `sed -n` to locate a region rather than reading the whole file, and
  check `js/` first — a Delver format is more likely to be there now.
- **`index.html` fetches one thing from outside the repository: the
  installer.** It used to pull its default archive, font and dialogue
  background from the old repository on `raw.githubusercontent.com`; the
  game left the repository, so those URLs would 404 and they are gone. The
  default is now archive.org's copy of the installer through its `/cors/`
  path, with Bryce Schroeder's `Cythera.bin` after it (blocked by CORS until
  his server sends the header — see the per-page notes), both tried after
  the relative paths under `reference/` and before giving up. The rest is
  the path that always worked: an IndexedDB copy of whatever last opened, a
  file dropped or picked anywhere on the page, or `?src=<url>`.
- The archives are `reference/game/Cythera Data.hqx` and `Cythera.hqx`, both BinHex,
  both carrying two forks. There is no bare data fork in the repository any
  more; `check_all.mjs` extracts one into `$TMPDIR` because the harnesses want
  bytes, not because anything ships one. A rename that only changes case will
  not reach git on a case-insensitive filesystem — this file stayed
  `Cythera Data.Hqx` in git for a while after someone had renamed it.
- `repomix_output.md`, `.DS_Store`, `sources/`, `__pycache__/` and
  `infinite-mac` are gitignored.
- **A button cannot be coloured by its own background.** `index.html`'s
  button rule is `!important` on background, border, padding and box-shadow,
  so a swatch styled on the button draws nothing and a box-shadow ring never
  shows; the sprite section's swatches shipped invisible that way on
  17 September 2026 and no check noticed. Put the colour on an inner span,
  use `outline` for a ring, and take padding back with a selector that
  outranks `#sheetGrid button`.
- **There are no empty `catch` blocks.** Every optional decode that fails
  reports to `quiet(e)` in `js/mac-bytes.js`, which keeps each distinct
  failure with a count and the line it came from; the Tools sheet lists them
  under *Fell back quietly*, uncaught errors and unhandled rejections arrive
  there too from the listeners installed at boot and reach the status line,
  and `?loud=1` prints each to the console for the browser check. Write
  `catch (e) { quiet(e); }` for a fallback, with a second argument naming
  what was being tried when the message alone would not say. Until
  18 September 2026 there were 144 empty catches and a visitor got a quieter
  page and no reason.

## `REFERENCE.md`, by section

| section | read it when |
|---|---|
| What this is, in full | you want the site's reader figures, the push rule's footing, or the version check's history |
| Working beside the forks, in full | a delvmod or wolflizard check skips or fails, or the suite runs without the game |
| The classic scripts and the js/ files, tier by tier | you need to know which file holds what, or where a new function belongs |
| The checks: data setup, how the harnesses work, and the table | you need to know which check covers a behaviour, or add one |
| delvmod is the correctness oracle, in full | a delvmod check disagrees, or you extend one |
| Two implementations, one format, in full | you change a PICT, NFNT, resource-fork or HFS decoder |
| Per-page notes, in full | you change the canvas page's layout |
| The add-ons, and what opens them | an add-on will not open, or `addons_check.mjs` fails |
