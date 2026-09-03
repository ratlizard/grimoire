# CLAUDE.md

Guidance for AI assistants working in this repository.

**After a compaction or resume: read `NEXT-SESSION.md` in full before doing
anything else.** The compaction summary is not a substitute for it. A global
SessionStart hook (`~/.claude/hooks/print-handoff.sh`) prints it
automatically; if there is no `=== HANDOFF:` block in context, read the file.
**If the session is about running the game under systemless** (the fork, `port/`,
`tools/`), also read `port/doc/SYSTEMLESS-NEXT.md` in full — that is the handoff
for that front; `NEXT-SESSION.md` is the site's.

## What this is

Two programs that read the same 1999 Macintosh game from opposite ends, plus
the shared material both of them need.

**The site** — a GitHub Pages static site of tools for reading, and eventually
editing, the data of *Cythera* (Ambrosia Software, 1999) and of classic Mac OS
files generally. Published at <https://e-z-g.github.io/cythera/>. This is
`explorer.html`, `mobile.html`, `canvas.html`, `js/` and `utilities/`.

**The port** — `port/`, a native arm64 port of the same game for modern macOS,
built without its source: it loads the original PowerPC executable, interprets
it, and reimplements the Mac OS Toolbox underneath. C++20, CMake and SDL2. It
reaches Cythera's start screen and is not yet playable. `port/README.md` is its
front door and `port/POWERPC-NOTES.md` its working state.

They are worth keeping in one repository because each is a check on the other.
The site decodes PICT, NFNT and resource forks in JavaScript; the port decodes
the same formats in C++ and has them validated the hard way, by the original
binary running against them. See **Two implementations, one format** below.

### Current direction — read this before starting work on `port/`

**As of August 2026 the plan changed.** `benletchford/systemless` is an
independent, ROM-free high-level runtime that does what `port/` set out to do,
for both 68K and PowerPC, and is further along. Active work on running the
game moved to the fork `e-z-g/systemless`, branch `cythera-detailed`, checked
out beside this repository; `SYSTEMLESS.md` is the record of that work and
`port/doc/SYSTEMLESS-NEXT.md` its handoff. This repository's contribution is
its Cythera and Delver knowledge — the delvmod cross-checks, the format work in
`explorer.html`, the forum compendium, the disassembly tools in `tools/` — fed
into systemless.

**`port/` is retired as a development target** and stays as a reference
implementation: it serves every Toolbox call on the load-a-saved-game path
against the PowerPC calling convention, which is the nearest worked answer for
the 72 `InterfaceLib` imports systemless's PowerPC loader lacks. It still builds
and passes its ten smoke invariants. Do not delete it, and do not resume feature
work in it without deciding, in writing, why systemless is no longer the better
host.

**systemless runs Cythera's 68K slice; `port/` and `port/POWERPC-NOTES.md`
describe the PowerPC one.** Addresses and findings from the PowerPC slice must
be re-derived from the `CODE` resources before being asserted about systemless.
`SYSTEMLESS.md` § "Which slice runs" has the detail and the one-line PowerPC
check.

### Rules are per-tree

**The constraints below are not uniform across this repository, and assuming
they are will send you in the wrong direction.** The site has a hard technical
constraint about how its JavaScript may be written (see **The hard constraint**)
and genuinely has no build step. The port is an ordinary compiled C++ project
with a CMake build, and that is fine.

An older version of this file said *"do not add tooling"* as a blanket rule for
the whole repository. That was written when the repository was only the site.
It is retired: add what a tree actually needs. What survives is narrower and
still binding — **the published pages must keep working from `file://`**,
which is a fact about browsers rather than a preference, and `utilities/` and
`tools/` stay dependency-free Node and Python because nothing has needed more.

**The site has no build step.** No `package.json`, no lockfile, no
`requirements.txt`, no `.github/workflows`. `.nojekyll` at the root disables
Jekyll processing, so every file is served exactly as committed. There is no
`index.html` either — each page is reached by its own filename, and the links
that point here are absolute.

**Pushing to `main` deploys the site.** Whatever lands in `main` is live within
a minute or two. There is no staging environment and nothing catches a broken
page for you — run the checks below before pushing. Nothing deploys the port;
it is built and run locally.

## Working beside the forks

Three other repositories are read while working here and none of them is ever
written to. **delvmod** is the correctness oracle for Cythera's own formats;
**systemless** is where running the game moved, and its HFS reader is what the
disk-image writer is round-tripped through; **infinite-mac** is the emulator
`mobile.html` embeds, and `mobile_api_check.mjs` reads the embed contract out
of its source. All three are forks under `e-z-g/`. They are inputs: a fix to
one of them belongs in that repository, on a branch there, and never as an
edit made from inside this tree — a decoder that has been edited to agree with
this one has stopped being an oracle, which is the whole of what
**delvmod is the correctness oracle** below is protecting.

They are found by looking for a file *inside* a candidate rather than for the
directory (`firstHolding` in `utilities/check_all.mjs`), so two layouts work
with no configuration at all:

| where | how it gets there |
|---|---|
| `delvmod/` | the submodule, for a checkout that ran `git submodule update --init` |
| `../delvmod`, `../systemless`, `../infinite-mac` | plain sibling clones — what a Claude Code web session has, since those clone each repository flat into one directory |

`$DELVMOD`, `$SYSTEMLESS` and `$INFINITE_MAC` override for a copy kept
anywhere else. Every candidate is resolved against the repository root, so the
suite gives the same answer from `cythera/` and from the directory above it —
which it did not before August 2026, and a session whose working directory is
the parent of all four checkouts is the ordinary case now.

Three things about that arrangement are worth knowing before reading a skip as
a failure:

- **systemless's `examples/hfs_dump` is on the `cythera-detailed` branch**,
  not on `master`. `hfs_check.mjs` needs it for the round trip through that
  project's HFS reader, so a checkout sitting on the default branch has the
  reader (`src/disk_image/hfs.rs`) and no way to call it. The check names the
  missing file and still runs its structural half, which is most of it.
- **The game is in none of them.** `reference/` is gitignored, so a session
  that was handed only the repositories has no Cythera in it and every check
  with an archive behind it skips. **9 ok, 0 failed, 9 skipped is the clean
  run there** — `delvmod write` and `disk image` are the two that still have
  an oracle, because both build what they compare on the fly. The decoder
  snapshots and the delvmod read checks are the ones lost, so a change to a
  decoder is not believed until it has been run somewhere `reference/` is
  populated.
- **Nothing in the three is on this repository's branch.** They are checked
  out at whatever their own work needs; do not push to them from here, and do
  not read a divergence between them and this tree as something to reconcile
  by editing them.

`.claude/settings.json` says the same thing to Claude Code in the one form it
reads: the three siblings are `additionalDirectories`, so reading them needs
no permission prompt, and each is denied to `Edit`, so the read-only half is
enforced rather than only written down here. Those paths are relative to this
repository, which is also where the file is read from — a session whose
project root is the directory *above* this one loads neither, and then this
section is the only thing saying so. JSON carries no comments, which is why
the reasoning is here and the file is four lines.

## Layout

```
explorer.html               Delver archive + resource fork viewer
mobile.html                 Cythera in an infinite-mac emulator iframe
canvas.html                 colour-cycling paint studio
coi-serviceworker.js        the two headers GitHub Pages cannot send (mobile.html only)
js/                         classic scripts, two tiers (see below)
utilities/                  the site's Node + Python harnesses and converters
utilities/browser/          the Playwright drivers, outside the suite (see its README)
res/                        the four game-derived files the pages fetch at run time
MOBILE.md                   mobile.html: what was measured, and what must not be undone
SYSTEMLESS.md               Cythera under systemless: what is known, what the fork changes
NEXT-SESSION.md             the site's handoff, untracked (gitignored, local); port/doc/SYSTEMLESS-NEXT.md is systemless's
port/                       the native macOS port: C++20, CMake, SDL2 (reference implementation)
tools/                      the port's Python analysis tools (PEF, forks, cold map, A5 map)
workspace/CLAUDE.md         the workspace-root CLAUDE.md, symlinked from ~/e-z-g-cythera
reference/                  gitignored: the game, and what a person or a model reads while working
delvmod/                    submodule, the correctness oracle (see below)
```

**`utilities/` and `tools/` are both Python-and-friends directories at the root,
and the split is by owner, not by subject.** `utilities/` is the site's: the
harnesses `check_all.mjs` runs, plus the converters they grew out of. `tools/`
came in with the port and analyses the *executable* — PEF containers, PowerPC
opcode censuses, resource fork inventories, framebuffer dumps. A few of them
overlap in subject with `utilities/` and that is expected. Exactly two files
are shared across the boundary, one in each direction, and both deliberately:
`tools/delv_compat.py` (the site's delvmod harnesses import it) and
`utilities/binhex_decode.py` (the port's `run.sh` and `smoke.sh` call it to
extract the forks). That is the pattern for sharing: name a specific file and
let both owners call it, rather than merging the trees. The three directories
have been considered for merging and left apart on purpose — `js/` is what
the pages execute at run time, `utilities/` is the site's harness, `tools/`
is the port's analysis kit; the subject overlap (three fork parsers, say) is
each owner keeping a small dependency-free tool of its own, which is cheaper
than the coupling a shared library would create between two trees whose
suites do not run each other.

**`res/` and `reference/` are different kinds of thing.** `res/` is the four
game-derived files a page fetches at run time — the Argos font, the dialogue
frame, the plank tile — and `NOTICE` lists them. Everything else that is
Cythera's — the game, its data, the installers, the community add-ons — lives
in `reference/`, which is gitignored: none of it is ours to publish, so supply
your own copy of the game and put it there. Nothing in the repository will
fetch it for you, and that is deliberate. `reference/` is also what you read
while working: the scraped forums and guides, the game's own documentation,
Apple's under `reference/apple_official_documentation/`. Retired experiments
are in `deprecated/` at the root. Nothing in `reference/` is fetched by a page,
and nothing should start being.

**`reference/apple_official_documentation/` is the port's structure oracle**,
and it earns that name the same way delvmod does for the archive formats. Every
Mac OS record the port builds — `ListRec`, `DialogRecord`, `ControlRecord`,
`WindowRecord` — is defined there, and guessing at one is how a field ends up
in the wrong place and stays wrong silently. `MacintoshToolboxEssentials.pdf`
covers the Window, Control, Dialog and Menu Managers; `MoreMacintoshToolbox.pdf`
has the List Manager and the Resource Manager; `Inside Macintosh (additional)/`
has the rest of the 1990s set. Look for each chapter's **assembly-language
summary**, which prints byte offsets directly instead of leaving you to add up
Pascal field widths. There are no PDF tools installed; `pypdf` in a scratchpad
venv is enough to search and extract text.

It has already paid for itself once: the port had `contrlVis` set to 1 where
Inside Macintosh says 255, which every "visible?" test comparing against zero
would accept and every one comparing against 255 would silently reject.

```
reference/  (gitignored — supplied by you)
        Cythera Data.hqx, Cythera.hqx   the game, both forks, BinHex
        Cythera Installed Folder.sit    what systemless needs
        cythera_symbols.txt             the PowerPC slice's 1,877 function names
        CombatAI/, user_addons/, original_installers/   as shipped/installed
        cythera_forums/, www_cytheraguides_com/, delver_homepage_archive/
        official_documentation/, apple_official_documentation/, apple_official_qtma_code/
```

## The hard constraint: classic scripts, `file://`-safe

**This governs the site only — `js/` and the three HTML pages. It does not
apply to `port/`, which is compiled C++ and has nothing to do with browsers.**

**This is not a style preference.** `js/*.js` are classic scripts — no
`type="module"`, no `import`, no `export`. Everything is declared at top level
and shared as globals. The reason: these pages have to keep working when copied
to a USB stick and double-clicked, and a module script is fetched with CORS,
which fails from an opaque `file://` origin.

Consequences you must respect:

- Never add `type="module"` to a `<script>` tag in these pages.
- Declare at top level; let things be globals.
- Keep the `<script src>` order in the HTML matching the dependency order.
- `utilities/verify_viewer.mjs` and `utilities/page_scripts.mjs` **fail** if a
  module script appears — that check is the enforcement mechanism.

`js/` has two tiers, and the difference matters when deciding where something
belongs.

**Generic classic-Mac formats** — nothing here knows Cythera exists, and that
is worth keeping true even though only one page loads them now. `explorer.html`
loads all nine, in this order, before its own inline script:

| File | Purpose |
|---|---|
| `js/mac-bytes.js` | big-endian readers, Mac Roman, CRC-32, `safeFileName`. **First** — everything else needs it. |
| `js/mac-containers.js` | BinHex 4.0 (`.hqx`), MacBinary, AppleSingle/Double unwrapping → `{kind, name, type, creator, data, rsrc}` |
| `js/mac-resfork.js` | `openResourceFork(bytes)` → a fork object (not globals, so two forks can be open at once) |
| `js/mac-media.js` | decoded pixels/samples → WAV and hand-written indexed PNG (colour-type 3 + PLTE/tRNS, so the CLUT survives byte for byte) |
| `js/mac-rsrc-types.js` | decoders for what is *inside* a fork: PICT, snd, NFNT, clut, cicn, crsr, ICN#, STR#, vers, DITL, MENU, cfrg, 68K CODE… |
| `js/mac-export.js` | store-only ZIP writer + browser download helpers |
| `js/mac-hfs.js` | `writeHfsImage()` — a classic HFS volume with both forks, for the emulator to mount |
| `js/mac-stuffit.js` | `parseStuffItArchive()` / `stuffItStoredFork()` — the catalog of a StuffIt 5 or classic `SIT!` archive and its *stored* entries; not a decompressor, and says which method a compressed fork would need |
| `js/mac-vise.js` | `parseViseArchive()` / `viseExtract()` — an Installer VISE 3 archive (Cythera's installer), every file with both forks; its own raw DEFLATE inflater. `sniffViseInstaller` finds one bare, in a container, or stored in a StuffIt archive |

**Cythera's own formats** — loaded after those nine, by `explorer.html`:

| File | Purpose |
|---|---|
| `js/delv-archive.js` | master index, `getResourceBytes`, `smartDecrypt`, and the record parsers (maps, prop lists, schedules, string tables) |
| `js/delv-graphics.js` | `PALETTE`, `decompressDCG`, `decodeResource`, the undither filter |
| `js/delv-script.js` | the Delver VM: `dvmWord`, the opcode table, the symbol tables, `dvmDisassemble`, `dvmRender` |

**The delv-* files are not a library, and saying so out loud matters.**
`getResourceBytes` reads the open archive out of `fileBytes` and
`masterIndexGlobal` as ambient globals; the tables they memoise are still
dropped by `resetDerivedCaches()` in the page. A classic script shares one
global scope with the document, so the split changed none of that. It buys
readability, and it gives the delvmod cross-checks a file to name instead of
"the page". Threading the archive through as a parameter is a separate and much
larger job — do not start it by accident, and do not hand these three files to
another page expecting them to work.

These came out of three different pages for three different reasons. The
mac-bytes/containers/media/export four existed twice, once each in the viewer
and in a resource-fork browser that has since been retired, and the copies had
drifted — each carried a fix the other lacked, and the Mac Roman table existed
three times across two files. `mac-rsrc-types.js` *was* that browser: the page
was more general-purpose than this repository, so its decoders came here and
the page went. The delv-* three had no duplication at all; they came out
because a 9,881-line inline script cannot be read, and because the checks had
nothing to point at. The cost of all of it is the same and is honest: **this is
a folder now, not a file you can email.** Re-inlining the ten would be
mechanical and no harness would notice.

`mobile.html` and `canvas.html` do **not** use `js/` — each is self-contained
with a single inline script.

**Two classic scripts share one global scope, so a name can only mean one
thing.** When the resource browser's decoders came into `js/`, two of its
functions collided with names the explorer already had — `samplesToWav`, whose
arguments are in the opposite order in each, and `hexDump`, which lays bytes
out differently in `js/delv-archive.js`. A function declaration is a global
binding, so the later file simply wins and nothing says so. They are
`pcmToWavBlob` and `rsrcHexDump` now. Check for a collision before moving a
declaration between files; `verify_viewer.mjs` catches a name that resolves
nowhere, not one that resolves twice.

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

The port builds and runs from its own directory. It needs CMake and SDL2
(`brew install cmake sdl2`); `run.sh` extracts the forks it needs out of
`reference/` on first use and leaves them in `port/build/extract/`.

```sh
cd port && ./run.sh         # extract, build, run
cd port && ./smoke.sh       # build and check ten invariants, about a minute
```

## Checks

There are two suites, one per tree, and they share nothing but the archives in
`reference/`. `node utilities/check_all.mjs` covers the site; `port/smoke.sh` covers
the port, by building it and running the real game headless. Neither knows
about the other, and a change to one tree does not need the other's suite run
— except when you touch a decoder that both trees implement, which is the case
**Two implementations, one format** is about.

`utilities/` holds the site's test suite. Everything runs on plain Node 18+
(`.mjs`, no dependencies) or Python 3. Run from the repository root:

```sh
node utilities/check_all.mjs            # everything, one table, ~75s
node utilities/check_all.mjs --quick    # skip the slow browser-ish smokes
node utilities/check_all.mjs viewer     # one page: viewer | browser | mobile
```

`check_all.mjs` is the entry point: it does the setup (extracting data and
resource forks from `reference/Cythera Data.hqx` and `.../Cythera.hqx`
into `$TMPDIR`,
and building the delvmod graphics reference), runs the individual
harnesses, validates exported ZIPs with `unzip -t`, and prints a single
pass/skip/fail table. Use `$TMPDIR` for scratch, never `/tmp` directly.

### Data setup

The game data needs nothing: `check_all.mjs` finds its inputs itself, reading
the archives straight out of `reference/`, which you have to put there. Two further inputs come from
outside the repository.

- **delvmod** — the reference implementation, used by `delv_crosscheck.mjs` and
  `delv_graphics_check.mjs`. It is a **submodule**, so a fresh checkout needs
  one command:

  ```sh
  git submodule update --init delvmod
  ```

  It is not the only place looked at, and it used to be the only one that
  counted: an uninitialised submodule leaves `delvmod` as an empty directory,
  `check_all.mjs` decided an input was present by testing whether its path
  existed, and the delvmod checks then did not skip, they **failed** with
  `ENOENT … delvmod/delv/archive.py` — which reads like a regression in the
  viewer and is not one. Each of the three checkouts is now found by a file
  inside it rather than by its directory (`firstHolding`), so an empty
  submodule is walked past to a sibling clone at `../delvmod`. Set `$DELVMOD`
  to point at a working copy kept anywhere else.

- **infinite-mac** — a checkout of `mihaip/infinite-mac`, used by
  `mobile_api_check.mjs`. Large, and **gitignored** on purpose, so this check
  skips by default. Put it at `infinite-mac`, beside the repo as
  `../infinite-mac`, or point `$INFINITE_MAC` at it.

- **systemless** — a checkout of `e-z-g/systemless`, used by `hfs_check.mjs`
  for the disk-image round trip. Found at `systemless` or `../systemless`, or
  through `$SYSTEMLESS`; without it the structural half of that check still
  runs. It builds `examples/hfs_dump` on first use, which takes about a minute
  and then stays built — the check is marked slow for that reason and
  `--quick` skips it.

A check whose inputs are genuinely missing is reported as **skip**, not fail.
A clean run is **18 ok, 0 failed, 1 skipped** — the skip being infinite-mac
(with a checkout beside the repo it runs too, for 19 ok and no skips).
Anything else is a regression. Without the game in `reference/` the count
drops to 9 ok / 10 skipped, and `delvmod write` and `disk image` are the two
checks with an oracle still running — its synthetic archives are built on the fly. `dialogue vs
guides` has a second, optional input of its own — the community's dialogue
collection at `reference/www_cytheraguides_com/dialogue/Dialogue` (the ZIP
from cytheraguides.com, unpacked) — and runs its structural half without it.

Two of the checks print a hash rather than a verdict, so a deliberate change can
be told from an accident. As of this writing:

| Check | Hash |
|---|---|
| `viewer / decoder snapshot` | `SNAPSHOT e417960b5595f5f9` |
| `viewer / resource snapshot` | `SNAPSHOT 4d4c7cf6e1b1` |

If one of those moves and you did not intend it, you changed what a decoder
outputs. If one of them *doesn't* move after you changed a decoder, the snapshot
is probably not covering it — that has happened twice, and each time the fix was
to add a line to the snapshot rather than to trust the green result.

### How the harnesses work

No harness in `utilities/` drives a browser: they run the page's real
JavaScript inside a `node:vm` against a hand-written DOM stub, so the suite
stays dependency-free and runs anywhere Node does. The drivers that do use a
browser are walled off in `utilities/browser/` — see **Driving the real pages in
a browser** below.

- `page_scripts.mjs` — collects the scripts a page actually runs, in document
  order (inline plus `<script src>`), and throws on a module script. Use
  `pageSource(path)` / `describeScripts(path)` rather than re-inventing a
  regex; a harness that only reads the inline block silently tests the page with
  its decoders missing.
- `dom_stub.mjs` — the minimal DOM the non-UI harnesses evaluate a page in, and
  the one 2D canvas implementation. Five harnesses each carried their own copy
  of this; when the viewer gained its animated footer, which asks for a context
  while the script body is still loading, three of them broke at once and two
  more were skipping and so did not show it. Import `makeSandbox()` rather than
  pasting a sixth copy. There used to be a second sandbox, `rsrc_sandbox.mjs`,
  for the retired resource browser; it is gone, and `rsrc_snapshot.mjs` and
  `export_test.mjs` both build on `makeSandbox()` like everything else. Two
  comments still name it (`dom_stub.mjs:59`, `rsrc_snapshot.mjs:102`) and both
  are describing history, not a file to go and open.
- `verify_viewer.mjs` — static integrity: JS syntax, inline handlers naming
  functions that exist, `getElementById` targets present in the markup, and
  (check 4b) any name the JS calls that nothing in the page declares. That last
  one exists because `setStatus()` was called seven times and defined nowhere
  for an entire session: it is only ever called from JS, never from markup, so
  a check that looked at inline handlers alone was blind to it while thirteen
  other checks stayed green.
- `*_snapshot.mjs` — hash the decoder output so a refactor that changes bytes is
  visible. `decoder_snapshot.mjs` covers Cythera's own formats;
  `rsrc_snapshot.mjs` covers the classic-Mac ones in `js/mac-rsrc-types.js`,
  over both of the game's resource forks.
- `viewer_smoke.mjs` — drives the actual UI (open every category, render every
  gallery, open every resource, both fork galleries) through a fuller DOM stub,
  which shares its canvas with `dom_stub.mjs`. This is the only check that
  would notice a gallery rendering nothing, so anything new that draws belongs
  in it.
- `loader_test.mjs` — the orchestration around the decoders: BinHex/MacBinary/
  AppleSingle unwrapping, archive validation, the refusal messages, deep-link
  parsing, and `loadDefaultArchive` driven to total failure. Every other harness
  hands bytes straight to the parser, so without this the code a visitor
  actually triggers was never executed. With the installer present it also
  drives the default path: the installer dropped, the installer served at the
  default URL, and an installer with no archive in it refused by name.
- `vise_check.mjs` — `js/mac-vise.js` over the real installer
  (`reference/original_installers/Cythera.bin`): every file's two forks
  inflate to the lengths the catalog declares and match the CRC-32 the
  catalog carries for each — the format's own checksum, which is what makes
  this a check rather than a snapshot — and Cythera Data and Cythera come
  out identical to their BinHex copies (the resource forks outside the
  Resource Manager's 240 reserved header bytes, which is where the two
  copies of the game differ and nowhere else). Then `js/mac-stuffit.js` over
  whichever of the six `.sit` files are beside it — Ambrosia's four
  installers and the two mirrors — the stored ones yielding the same
  installer as the `.bin`, the compressed ones refused by method name.
- `delv_crosscheck.mjs` / `delv_graphics_check.mjs` /
  `delv_dasm_check.mjs` (+ `delv_dasm_ref.py`) — see below.
- `delv_write_check.mjs` (+ `delv_write_ref.py`) — `writeDelverArchive`
  against delvmod's `Archive.to_file`, byte for byte, over synthetic archives
  delvmod builds on each run (and over the real archive when it is present).
  This is the writer getting the same oracle `decompressDCG` has, from day
  one rather than after the fact.

  **Read what it claims about the real archive carefully**, because it is
  easy to read as more.  `real archive: 1558 resources re-serialized
  identically to delvmod` means the writer and delvmod agree — not that the
  rebuild reproduces the shipped file. It does not: `bytes → spec → bytes` on
  the real `Cythera Data` comes back 12,542 bytes shorter, with all 1,558
  resources present and every resource's plaintext identical. The difference
  is entirely slack between resources (84,358 bytes of it in the shipped
  file, 71,816 in the rebuild); the header, the master index length and the
  payload are unchanged. Cythera accepts the rebuild — verified by installing
  one in the emulator and reaching the start screen — so this is a fact to
  know rather than a bug, and the same is true of a rebuild with a dialogue
  resource edited.
- `dialogue_check.mjs` — `dvmConversation` (the conversation extractor in
  `js/delv-script.js`) against two things. Structurally, against the archive:
  109 of the 121 characters must yield topics, Naxos's inheritance chain must
  be exactly House Comana → Cademia → Human, and the Seldane chains must end
  at their own root. And, when `reference/www_cytheraguides_com/dialogue/`
  holds the unpacked collection from cytheraguides.com, against the
  community's verified in-play transcription: extracted response text must be
  findable in it (362/385 as of this writing) and each character's
  reachable-group set must match the affiliations comment at the top of their
  file (83/84 — the one divergence is Protesilaus's Student group, in code
  the extractor does not reach). That collection was gathered by
  BreadWorldMercy453 by asking every character every word — it is independent
  of this repository's decoding in exactly the way delvmod is, which is what
  makes it an oracle rather than a fixture.
- `hfs_check.mjs` — `writeHfsImage` in `js/mac-hfs.js`, the disk-image writer
  `explorer.html` exports with. Structural on its own (the MDB, the bitmap and
  both B-trees read back and audited against the arithmetic that produced
  them); with a systemless checkout beside this one it also round-trips every
  volume through **that project's HFS reader**, comparing paths, Finder types
  and both forks byte for byte. `$SYSTEMLESS` overrides the location, and
  without it the structural half still runs. It is not an oracle in delvmod's
  sense and its header says why — the writer was written *from* systemless's
  reader — so the check that matters most is the one no harness can do, which
  is that a real Mac OS mounts the volume. That was done by hand in the
  emulator and what it settled is written down in `js/mac-hfs.js`.
- `mobile_install_check.mjs` — the one-tap mod install, which is a contract
  between two pages that cannot see each other: `explorer.html` writes the
  disk's name and the script's onto the image, `mobile.html` types them at the
  emulated Finder. It compares both, checks the typed prefixes actually select
  what they are meant to (and could not select the other), pins the order of
  the keystrokes, asserts nothing in the sequence aims at a pixel, and builds
  a disk through the page's own code to confirm the script is on it as
  `TEXT`/`ToyS`.
- `mobile_handoff_check.mjs` — the second contract between the two pages: the
  disk explorer.html hands to mobile.html through IndexedDB. Four names have to
  agree (database, version, store, key) and a browser says nothing when they
  stop agreeing — the read returns undefined and the card never appears. It
  also pins the three things that went wrong or nearly did: the handoff must
  not travel on `?disk=`, which mobile.html has read as the *system disk to
  boot* since long before this existed; the handoff and the remembered archive
  must be different stores, because one is deleted on collection and the other
  is meant to outlive the visit; and every `createObjectStore` in the version-2
  upgrade must be guarded by a `contains()` test, or a visitor still on
  version 1 gets a `ConstraintError` that takes their remembered archive with
  it.
- `mobile_input_check.mjs`, `mobile_undither_check.mjs`, `mobile_api_check.mjs`
  — cover `mobile.html`'s pointer/keyboard handling, its dedither path, and its
  use of infinite-mac's documented embed API. The undither check reads `UD`,
  `LINE_REACH` and `detect()` back out of the viewer through `pageSource()`; it
  used to read the HTML file as text and stopped finding them the moment the
  filter moved into `js/delv-graphics.js`.
- Python converters: `binhex_decode.py`, `resource_fork_parser.py`,
  `quickdraw_pict_decoder.py`, `pictscan.py`, `qtma2midi.py`, `midi2wav.py`,
  `delv_graphics_ref.py`.

### Driving the real pages in a browser

`check_all.mjs` does not do this and must not learn to — the suite stays
dependency-free Node. The end-to-end proof in `MOBILE.md` was obtained by
driving both pages in a real headless Chromium, and the drivers are kept in
**`utilities/browser/`**, needing Playwright and a Chromium.
`utilities/browser/README.md` is their front door: how to run them, the path
through the game click by click, and every obstacle met, each of which cost
twenty minutes to an hour and none of which is guessable. Read it before
driving a page. Those drivers were written in a cloud sandbox with no GPU and
no network from the browser; the mirror and the SwiftShader flag exist for that
environment, and a local Mac with Playwright's Chromium installed does not need
the mirror.

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

`delvmod` is an independent implementation of the Cythera archive
format by the people who reverse-engineered it. `js/delv-archive.js` and
`js/delv-script.js` carry copies of tables that delvmod worked out first, and a
copy drifts silently — nothing in a
browser complains that a syscall is labelled with the wrong name or that a
resource is being displayed as raw ciphertext. So two harnesses read delvmod's
Python on every run and compare:

- `delv_crosscheck.mjs` — the encryption lists, the 59-opcode table with its
  operand counts, all eight disassembler symbol tables, the prop-record
  containment rules, and the decrypt verdict for every resource.
- `delv_graphics_check.mjs` (+ `delv_graphics_ref.py`) — `decompressDCG`
  against delvmod's decoder, pixel for pixel, over every image, plus a census
  of which opcodes the archive actually reaches. `decoder_snapshot.mjs` only
  proves the decoder is *unchanged*; a decoder that has been wrong since the day
  it was written passes that check forever.

**The disassembler is checked too, since August 2026.**
`delv_dasm_check.mjs` (+ `delv_dasm_ref.py`) runs delvmod's
`ddasm.Disassembler` against `dvmDisassemble` in `js/delv-script.js` over
every script resource in the archive — not the rendered text, which differs
by design, but the canonical decode events: which offsets each walk treated
as instruction starts and where each read direct text. `delv_crosscheck.mjs`
still compares the opcode *tables* as written; this compares the code that
walks them, which is the hole `delv_graphics_check.mjs` closed for
`decompressDCG`. Its known-divergence list is pinned per resource and
per cause in the harness, and an entry that stops diverging fails the check,
so the list cannot rot. Two of the pinned classes are viewer bugs the
harness found on its first run (the text-entry rule and the prose-head
misfire — see the harness header), left visible there so the fix is its own
commit.

  A caution that paid for itself three times while building it: the six
  resources Bryce Schroeder recorded as defeating ddasm (the compendium,
  "DELVER SCRIPTING - NESTED SUBROUTINES") do **not** show up as event
  divergences — his trouble was subroutine *extents* for reassembly, and
  both walks consume those bytes identically. What did show up on the first
  run was harness bugs, per "check the harness before believing its
  failure" below: ddasm clobbers `Opcode.offset` with the operand of
  `write_far_word`/`read_far_word`, so the reference observes the true
  offset from outside rather than trusting the attribute.

**This is the closest thing here to a correctness oracle, and it is worth
keeping green.** It has earned its keep: the viewer used to *guess* which
resources were encrypted, scoring printable-ASCII ratio minus entropy, and
disagreed with delvmod's `known_encrypted` / `known_clear` on 18 of 1,558
resources — always by leaving an encrypted resource undecrypted and showing
noise. `smartDecrypt` now consults those tables first and falls back to the
heuristic only for subindexes the tables say nothing about, which is what a
modded archive would present.

Two things to know before extending it:

- **delvmod's Python does not run under Python 3.11+ unmodified**
  (`inspect.getargspec` is gone, and `rdasm.py` imports `parsley`).
  `delv_crosscheck.mjs` therefore *parses* its source rather than importing it,
  which has a second virtue worth keeping: it compares the tables as literally
  written, with nothing executed. `delv_graphics_ref.py` does need the library
  running, and gets it from **`tools/delv_compat.py`**, installed from outside
  so nothing in the checkout is ever modified. That file is the one thing
  `utilities/` and `tools/` share; it arrived with the port, which had solved
  the same problem independently, and the two copies were folded together
  rather than left to drift. Import it and `import delv.archive` works.
- **The submodule is `e-z-g/delvmod`, not upstream** — a fork that already
  carries the `getargspec` fix internally, so only the parsley stub in
  `delv_compat.py` is doing real work here; the getargspec half is kept for
  an unpatched checkout reached through `$DELVMOD`. Fixes to delvmod belong in
  that fork, not in the submodule working tree: patching the oracle in place
  makes it stop being one, and the change is invisible to everyone else.
- **Check the harness before believing its failure.** Every disagreement these
  two have ever reported on a first run turned out to be the harness's own bug:
  reading delvmod's commented-out table entries as live ones, comparing a padded
  decompression buffer against a cropped one, and reading `class OpIfNot(OpIf)`
  without following the inheritance that supplies its operand count.

## Two implementations, one format

`js/mac-resfork.js` and `js/mac-rsrc-types.js` decode resource forks, PICT and
NFNT in JavaScript. `port/src/resfork.cpp`, `port/src/mac/pict.cpp` and
`port/src/mac/font_mgr.cpp` decode the same three formats in C++. They were
written separately, and the port's were validated in the least forgiving way
available: the original binary runs against them and its own artwork either
appears or does not.

**This matters because the mac-* tier has no oracle otherwise.** delvmod covers
Cythera's Delver formats and says nothing at all about classic-Mac ones, so
`rsrc_snapshot.mjs` is all that guards them — and a snapshot proves a decoder
*unchanged*, never *right*. The port is the second opinion that tier never had.

Three differences are known and none is resolved. They are recorded here and in
`port/POWERPC-NOTES.md` so that neither side rediscovers them. On the first,
systemless has since cast the deciding vote — its `src/trap/pict.rs` renders
`0x0090`/`0x0091` as the port does, so the JavaScript is the outlier and the
fix has two references (see `SYSTEMLESS.md` § What each tree can lend the
other):

- **PICT `0x0090`/`0x0091`** (uncompressed BitsRect/BitsRgn) are rendered by
  `port/src/mac/pict.cpp` and skipped by `js/mac-rsrc-types.js`, which walks
  past them to stay aligned and draws only the first *packed* image opcode it
  finds. A picture made of several `CopyBits` is complete in the port and
  partial in the browser.
- **PICT `0x8200`/`0x8201`** (QuickTime-compressed) are the reverse: handled in
  JavaScript, thrown on by the port. None of the 21 pictures the port has
  verified against uses one.
- **NFNT metrics.** The port parses the offset/width table; the JavaScript
  reads `owTLoc` into its result and never uses it, so the gallery shows glyph
  images with no advance width or bearing. The two traps are written down in
  `port/README.md` — the table has one fewer entry than the location table, and
  `owTLoc` is a word offset from its own field carrying a bearing relative to
  `kernMax`.

**The HFS writer is the exception that proves the rule, and it is labelled as
one.** `js/mac-hfs.js` was written *from* systemless's `src/disk_image/hfs.rs`
— every MDB offset, every catalog record shape, the B-tree node descriptor and
header record — which the licensing note below explicitly allows, HFS being
infrastructure this tree lacked entirely. So it cannot cross-check systemless
and `utilities/hfs_check.mjs` does not claim to: the round trip through that
reader catches an offset written one field along, and the thing it cannot
catch was settled by mounting the volumes in a real Mac OS. One piece of the
format the reader could not settle at all, because it walks the catalog's leaf
chain and never opens an index node: an index record's four-byte node pointer
sits at `align_even(1 + keyLengthByte)`, exactly where a leaf record's data
sits. That is worth carrying back to systemless if its reader ever grows a
writer.

Going the other way, `port/src/resfork.cpp` is the only resource fork *writer*
in the repository, round-tripped through its own reader by
`port/tests/resfork_test.cpp` — and the site's stated direction is reading "and
eventually editing". The *Delver archive* now has a JavaScript writer too:
`writeDelverArchive` in `js/delv-archive.js`, proven byte-identical to
delvmod's `Archive.to_file` by `delv_write_check.mjs` — over synthetic
archives and over the real one, all 1,558 resources. `explorer.html`'s Edit
Bytes path is its first caller; see the per-page notes.

**If you change a decoder on one side, say in the commit message whether the
other side has the same bug.** Neither suite will tell you.

## Things that look wrong and are not

Read the comment above a constant before correcting it.

- **The palette.** `PALETTE` in `js/delv-graphics.js` differs from the game's own
  `clut` 256 at exactly two entries — index 0 (`ffffff` vs `fcfcfc`) and index
  247 (`b56d45` vs `b46c44`). Both are absorbed: `scale6to8` is
  `round((v >> 2) * 255 / 63)`, and the `>> 2` discards exactly those bits, so
  the rendered pixels are identical. Do not "fix" it.
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

### `explorer.html`

- The Delver-format half of it lives in `js/delv-archive.js`,
  `js/delv-graphics.js` and `js/delv-script.js`; the page holds the UI, the
  rendering, and the ~7,700 lines that need a document. See **Where new code
  goes** above before adding to either side.
- **Navigation is a tree of folder tabs, three deep, and the split at the top
  is the point.** `TAB_TREE` (in the page, beside `navIconCanvas`) is
  Entities / Components / Data: what the game assembles, what the archive
  stores to assemble it from, and the files themselves. Every leaf names the
  galleries it holds by the hidden `#categorySelect`'s own values, which stays
  the single source of truth for what is open — `pickCategory` sets it,
  `syncTabsTo` draws the rows and the chip row for whichever leaf holds it,
  and `showCategory` is only the "is it a category?" check in front. A leaf
  with several galleries shows them as chips. `wip: true` fades a tab whose
  join is not traced yet (the PEF; Mechanics, a placeholder until the rules
  are derived from the code rather than listed from the tables; and the
  Combat AI pair until the installer has brought the files, when
  `syncInstallerTabs` unfades them); a faded tab still opens. The top row's three
  folders carry a `tileOpen` frame, drawn when selected. A fourth top-level
  tab, Tools, is the page's own switches and its sister pages
  (`renderToolsSheet`): the undither switch lives there and nowhere else —
  every gallery keeps only a *preview the other way*, `UNDITHER_PREVIEW`,
  which `onCategoryChangeImpl` clears — so read `unditherOn()`, never
  `window.UNDITHER`, when deciding whether to reconstruct. The Data tab's own views are `<option>`s too (`DATAFORK`,
  `CHANGES`, `APPRSRC`, and three placeholders in `PLACEHOLDER_TABS`), so the
  deep links and `viewer_smoke.mjs` treat them like any other category. The
  two Resource Fork tabs are one gallery with `RSRC_SOURCE` set by the
  category. Icons are game tiles chosen by looking at them, not by name; the
  two fork pairs share the half disk, 0x237 left and 0x238 right. The look
  is the game's own layering: `body::before` is now only the 4/8px border of
  `Dialogue_Background.png`, and each `.tabSheet` is that box again — the
  same border, the same one-pixel checkerboard of rgb(31,0,183) over nothing
  — drawn over the 0x8F00 planks. Text on the sheet needs its shadow.
- **The joins between the two halves are resource-id rules, and they are
  written down once, in the `Parts and uses` section beside the tree.** A
  character's dossier carries a *Made of* row (`characterParts`): dialogue
  `0x1800+i`, portrait `0x8800+i-1`, the sprite sheet `0x8E00+(tile>>4)`, the
  class script `0x1000+proptype`, the record table `0xF009`, the schedules
  `0xF00B`. A map carries its prop list and the entry and region scripts that
  share its number (`mapParts`: all 42 `0x14xx` and the three `0x15xx` match a
  map index). The reverse sits in `#artUsage` on every single view
  (`updateUsagePanel` → `renderUsage`): *Worn by* on a portrait, *Spoken by*
  on a dialogue, *Runs for* on a zone script, *Played by* on a sound, and
  *Referenced by* from the xref index on anything. `buildSoundUsage` is the
  one new index: it walks only the functions `dvmDiscover` finds, exactly as
  `buildXrefIndex` does, because data blocks decoded as code yield thousands
  of bogus `PlaySound` opcodes. 74 of the 82 `PlaySound` calls in the shipped
  archive name their sound as a literal (sound *n* is `0x9100+n`, music *n*
  is `0x9000+n`); 18 of the 46 sounds are named by some script, and the
  panel says so when one is not. That join is why Audio is no longer faded.
  Note the portrait rule: the map inspector's chip was `0x8800+i` for a while
  and opened the next character's face. A tile on a sheet is a join too:
  `tileSheetClick` maps the click back through the sheet's shape and opens
  the prop type whose block holds the tile (`propTypeForTile`); a
  container's page names the 0x8Fxx window it opens as, by name, from the
  short `CONTAINER_WINDOWS` table.
- **The backdrop behind a zone is read from its entry script.** Every
  `0x14xx` script calls `SetLandscapeImage` once with a literal: zero and
  up is a landscape strip, the negatives are the engine's own backdrops, and
  `-1` — Land King Hall alone — is the wavy space behind the ethereal void,
  the pair `0x8F50`/`0x8F51` alternating (`zoneBackdrop`, `backdropPattern`).
  The void tiles are three-quarters transparent, so they are drawn over the
  pattern and remembered in `backdropCells`, and the animation loop swaps
  the frame under them every eight palette frames. The other negatives
  have no image in the archive and draw nothing. A doorway is not a door:
  `classifyProp` rings only names ending in "door", gates and portcullises.
  The search looks at names before scripts (`namedThingsMatching`), the
  Tombstone slab `0x8EFF` is listed with the sized images it is one of, and
  every view — galleries included — is a history entry, so the browser's
  back and forward and the crumb walk one sequence (`goViewBack` goes
  through `history.back()`).
- Four ways in, in order: an IndexedDB copy of whatever last worked, a relative
  path beside the HTML (`reference/...`), the remote copies of the
  **installer** in `REMOTE_ARCHIVE_URLS` — archive.org's `cythera-installers`
  item first, one StuffIt archive holding the 1.0.1 through 1.0.4 installers
  side by side, then archive.org's single 1.0.4, then Bryce Schroeder's
  `Cythera.bin`, all through paths that send a CORS header where one exists —
  or a file picked or dropped anywhere on the page. `?src=<url>` overrides everything;
  `?cache=skip` bypasses the remembered copy. IndexedDB is refused on some
  `file://` origins, so every cache call degrades to a no-op.
- **The installer is the preferred input, and the page is built to take it.**
  The installer is an Installer VISE application whose data fork is an
  `SVCT` archive holding all 48 files the game shipped with, both forks
  each. It arrives as `Cythera.bin` (a MacBinary of it) or as a `.sit` — the
  mirrors and Ambrosia's own `Cythera_1.0.4_Installer.sit` are StuffIt
  archives that *store* that data fork uncompressed, so `js/mac-stuffit.js`
  needs no decompressor to hand it over (the 1.0.1 and 1.0.2 installers
  compress it, and are refused by method name). `extractDelverArchive` (in
  `js/delv-archive.js`) recognises either through `sniffViseInstaller`,
  takes the one `DelS` file out of it as the archive, and hands the rest
  back. A file holding several installers opens at the newest, and Data ›
  Installer shows a chip per version: `switchInstaller` re-opens the bytes
  already in hand at another one, through the same `adoptArchive`, so every
  archive-keyed cache resets as for any other open and the remembered copy
  keeps the choice (`pick`). Each release's Cythera Data is a different
  archive — a diff between versions is the obvious next thing to build on
  this, and nothing does it yet; `adoptArchive` keeps that as
  `window.INSTALLER`, opens the application's resource fork straight out of
  it (so Cythera (App) › Resource Fork needs no second fetch), calls the
  archive by its own name so exports stay "Cythera Data (edited)", and
  remembers the installer itself rather than the forks so a return visit gets
  every file back. Data › Installer (`renderInstallerSheet`) lists them all
  with a reader for the text files and a `.bin` for any of them; the Combat
  AI tabs, placeholders before, show the `.ai` scripts and the AI Scripting
  Document (`renderCombatAISheet`) and stop being faded (`syncInstallerTabs`).
  A bare `Cythera Data` still opens exactly as before — the installer route
  produces the identical bytes, which `vise_check.mjs` proves — and gets the
  placeholders. The release that is open is named three times over: a badge
  on the Installer tab (`installerVersion()`), the Data file button
  ("Cythera 1.0.4"), and the head of the Installer sheet. Installer stands
  first under Data with the DELVER stone (tile 0x80F) for its icon; the
  folder's `last: 'cytheradata'` is what makes Data still open on Cythera
  Data the first time.
- **Desktop is a scale, not a second layout.** The page was sized on a
  phone. The `@media (min-width: 900px)` block at the end of the stylesheet
  widens the shell to 1280px and brings the type, the tab icons, the chips
  and the gallery cells up to desktop sizes; it changes nothing about the
  look, and the phone sizes above it are untouched. The design canvas's
  desktop boards (Main, Resource, Search) are round 1 and superseded by the
  tab tree, so there is no separate desktop mockup to implement — this block
  is the desktop UI.
- **CORS decides which remote copy works, and it is why archive.org is
  first.** Its `/download/` path, old.mac.gdn and `www.bryce.pw` all serve
  the installer without an `Access-Control-Allow-Origin` header (checked
  2 September 2026), and a browser on `e-z-g.github.io` or `file://`
  discards such a response. archive.org's `/cors/` path serves the same
  bytes *with* the header, so that is the default. Bryce's URL is kept
  second, for the day his server sends the header and as the file to
  download by hand; the failure text names both.
- Deep links are `#c=<category>&r=<hex>`, plus `&d=char:3` / `prop:` /
  `monster:`, plus a bare `#8801`. `setMode` and `onCategoryChange` are thin
  wrappers over `…Impl` functions that call `syncDeepLink()`, because both have
  several early returns and wrapping beats sprinkling.
- **Editing exists, narrowly and deliberately.** Edit Bytes on any open
  resource takes hex for the plaintext, then `applyResourceEdit` rebuilds the
  ENTIRE archive through `writeDelverArchive` and re-enters
  `parseArchiveBytes` as if the rebuilt file had just been opened — so every
  cache resets, every view redraws from the edited bytes, and what is on
  screen is provably what the Changes tab produces. There is no
  patched-in-place `fileBytes`, and there must not be: a second edited-but-
  unserialized state is exactly the drift this design exists to prevent.
  Edits are memory-only (the IndexedDB copy is not updated, so reload
  restores the original); the routes out live under Data › Cythera Data ›
  Changes (`renderChangesSheet`), grouped by where the file is going, the
  typed patch first on a phone; they are the bare data fork (which
  delvmod, mag.py and this page all read), a MacBinary `.bin` carrying
  both forks under the file's own Finder identity — `writeMacBinary` in
  `js/mac-containers.js`, the one container the site can produce as well as
  open, checked structurally and round-trip by `loader_test.mjs` — and an
  HFS **disk image**, which is the one of the three the emulator will take —
  and which **Send that disk to mobile.html** hands over directly, through a
  `handoff` store in the page's own IndexedDB, so the bytes never go near the
  file system. `buildEditedDiskImage` is split out from
  `downloadEditedDiskImage` for that reason: two callers, provably one disk.
  The window is opened *before* the write, because a pop-up blocker only
  trusts a window opened synchronously in the click that asked for it.
  `writeHfsImage` in `js/mac-hfs.js` builds a `.dsk` holding the edited
  archive with both its forks and its Finder type, a Read Me, and an
  AppleScript called **Install and Play** — `buildInstallScript`, written as
  a `TEXT` file with creator `ToyS`, which is what makes the Finder open it
  in Script Editor. Dragging the disk onto `mobile.html`'s emulator mounts
  it as "Cythera Export"; that page's **Install** button then does the rest
  without a pointer (see its notes). The script finds the folder holding a
  Cythera application on any mounted disk rather than naming it, so it works
  whatever the game disk is called and whatever version folder the game sits
  in. The `.bin` is the right file for a real Mac and the
  wrong one for the emulator, where it would land in Downloads still
  wrapped and need StuffIt Expander before the game could see it.
  **Both exports refuse to be quiet about a missing resource fork**, because
  a Delver scenario without one installs perfectly and then will not open:
  measured in the emulator against the real 1.0.4 `Cythera Data`, the same
  5,608,688-byte data fork starts the game with its 1,247,331-byte resource
  fork beside it and dies with `Sorry - there has been a fatal error:Unable
  to open RT` without it. Nothing in that message points back at this page,
  so `missingForkWarning` says it at export time instead. The fork goes
  missing whenever the archive arrived without one — a bare `.data` dropped
  or picked, a `?src=` aimed at one, or a remembered copy saved from either
  — which is the same reason the page fetches the `.hqx` rather than the
  data fork. `EDITED_RESIDS` is the session's dirty
  list: cleared by `resetDerivedCaches()` like everything archive-keyed,
  carried across an edit's own rebuild by hand. The edit-path and prop-edit
  sections of `viewer_smoke.mjs` are the checks that drive all of this.
  One structured editor exists on top of the raw-hex one: the map
  inspector's Edit chip edits a single prop record field-by-field, through
  `writeDelverPropList` — proven the exact inverse of `parseDelverPropList`
  over every record in the shipped archive by `delv_write_check.mjs` — so a
  moved prop visibly moves on the map. That parse-edit-write-rebuild shape
  is the pattern for the next structured editor (schedules and tile names
  already have both a parser and, in delvmod, a serializer to crosscheck).
  The Portraits gallery carries the ditherizer — the undither run backwards:
  any image in, Cythera-palette checkerboard art out
  (`ditherToCytheraPalette`), optionally written straight into a portrait
  resource via `encodeDCGLiterals`, a literal-opcode DCG encoder that
  `delv_write_check.mjs` proves both `decompressDCG` and delvmod's
  `DelvImage` decode back exactly. The same check pins the ditherer's own
  output on a fixed gradient, so a tuning change is visible.
- **Dialogue resources render as conversations, not string lists.** A
  `0x18xx` or `0x08xx` resource with topics gets the conversation view:
  keyword pills, responses with their in-place edit links, condition and
  side-effect badges, follow-ups nested, and the inheritance chain as chips
  — all extracted by `dvmConversation` in `js/delv-script.js` from the
  script's own `conversation_response` chain (the long comment above it
  explains the encoding; the four-letter prefix rule and the multiple
  inheritance the community established from outside are simply visible in
  it). `@word` in a response is the game marking a blue keyword; clicking
  resolves it the way the engine would — this character first, then the
  groups in chain order. Subindex 8 is the generic-prompt archetypes, named
  in `DIALOGUE_GROUP_NAMES` (names are empirical — the resources are
  anonymous; `dialogue_check.mjs` re-verifies them against the community's
  collection). The twelve one-liner characters, and anything whose nested
  subroutines defeat the disassembler, fall back to the flat string list.
- **The map view budgets its canvases, and the detail lens is what makes
  that painless.** The base terrain canvas and the character/roof/mark/
  lighting layers are each full-map bitmaps; on iOS (every browser there is
  WebKit) five of those at 6 MP was ~120 MB of backing store and the tab
  died — which presented as "maps crash Chrome on iOS". The budget is
  2.2 MP per layer there (6 MP elsewhere), layers deflate to zero-size when
  their toggle is off, and `paintDetailLens` re-renders just the visible
  window at the native 32px tile size into one viewport-sized canvas
  whenever the map is zoomed in past the base's resolution — so the
  256×256 world map, whose base has never been better than TS=8 anywhere,
  now shows full-detail art on every platform. The lens reuses the layer
  painters (each takes an optional `(ctx, TS)`), repaints debounced off
  `applyMapTransform`, and is the `detail lens` section of
  `viewer_smoke.mjs`. Lighting gets a scratch canvas in lens mode: its
  destination-out light circles would otherwise erase the map itself.
- **`resetDerivedCaches()` is the one place archive-keyed memoisation is
  cleared. Add to it whenever you memoise anything.** The list used to be
  inline and had drifted by nine caches, so a second archive was drawn with the
  first one's sprites and populated with the first one's people. A sentinel test
  fails if a new cache is added and forgotten.
- `stopAllViewActivity()` is the matching rule for anything a view starts:
  intervals, animation frames, audio, the shared `IntersectionObserver`.
- **It wants a container, never a bare data fork, and that is deliberate.**
  The installer, a `.hqx` or a MacBinary all carry the *resource* fork, which
  a bare data fork cannot. Editor Stamps & Brushes had been in the page for a
  while and never worked for a visitor who did not hand-drop a `.hqx`. Do not
  "optimise" this back to the data fork.
- It reads both forks. The data fork is the game archive. The resource fork's
  Delver-only types (`eSTM` stamps, `eBRS` brushes) are drawn with the game's
  own tiles under **Editor Stamps & Brushes**; everything else in it — PICT,
  NFNT, clut, STR#, sfnt — is an ordinary Mac resource and is read under
  **Resource Fork (all types)** with `js/mac-rsrc-types.js`. That gallery also
  browses the *application's* fork — 339 resources across 52 types, the icons,
  dialogs, menus, sounds and cursors — taken from the installer when the game
  came in that way, and otherwise fetched from `reference/Cythera.hqx` on request.

### `mobile.html`

A touch shell around an [infinitemac.org](https://infinitemac.org) embed. Almost
everything it does is defined by a project that lives somewhere else, which is
why `mobile_api_check.mjs` extracts the contract from four of infinite-mac's
source files and checks every message the page actually posts against it. Run
against an early version it reported ten failures. What that bought, and what
must not be undone:

- The URL parameter is **`paused`**, not `pause`. Misspelled, the emulator boots
  and runs behind the TAP TO START overlay.
- **There is no volume or mute in the embed API** — it is pause/unpause, mouse,
  key and `load_disk`, and nothing else.
- **Messages sent before `emulator_loaded` are lost**, so they are held and
  flushed when the emulator reports in.
- Every key goes through `pressKey`/`releaseKey` over a `heldKeys` set, and
  everything is released on `pointercancel`, on pause, on mode change and when
  the page is hidden. A stuck `Numpad8` in Cythera is a character who walks away
  on their own.
- The gesture recogniser's tests are a table, ordered longest-shape-first,
  because loosest-first made three of the seven gestures unreachable. The help
  panel's legend is generated from that same table, so a gesture cannot be
  documented but unrecognised.
- `postMessage` is targeted at `EMBED_ORIGIN`, and inbound messages are checked
  for it.

**`reference/Cythera.hqx` and `Cythera Data.hqx` cannot be handed to the
emulator by this page.** `emulator_load_disk` takes a URL that infinitemac.org's
own Cloudflare worker fetches server-side in ranges, so a `blob:` URL, a
`file://` path and a private address are all equally unreachable from there;
and infinite-mac's client-side upload is reached by dropping onto *its*
document, which is a cross-origin iframe this page cannot synthesise a drop
into. Dropping the file on the emulator is the supported path, the page steps
its overlay aside for the duration of a drag so that can work, and the help
panel explains it. Do not spend an afternoon rediscovering this. What the
viewer's `.dsk` export changes is only what is *worth* dropping: a disk image
mounts as a disk, where a `.hqx` lands in Downloads still wrapped.

**Everything measured about this page beyond the contract above is in
`MOBILE.md`, and it is read before touching `mobile.html`, not after:** how a
patch travels as keystrokes and why bytes go as hex, the typing speed limit,
file mode and the `screenSize` parameter, the zip layout Basilisk II's ExtFS
takes, where the emulator's speed went (cross-origin isolation, measured at
thirty times), the pointer-free installer, the four failure messages the Mac
gives when the export chain is broken, and the end-to-end run that read an
edit back off the emulated screen. Re-run that chain by hand after touching
the archive writer, the disk-image writer, the installer script or the
encryption; no harness covers all four at once.

The undither filter is **the viewer's**, ported to three GPU passes because the
JS implementation costs 5.8 s for a 640×480 frame. `mobile_undither_check.mjs`
reads the constants back out of `explorer.html` and fails on drift —
two copies of one filter is exactly the arrangement where a tuning change lands
in one of them only.

## Licensing

`LICENSE` is GPL-3.0-or-later and covers the work here (it was MIT until
August 2026; the sole author relicensed, and `NOTICE` records the history).
`NOTICE` also says what the licence does not cover, and that list is the one
to keep accurate: Cythera itself (not in this repository at all — see
`reference/`), the four game-derived files in `res/`, and `delvmod/`,
which is GPLv3 and referenced as a submodule.

GPL was chosen to match the two projects this repository actually exchanges
code with — delvmod (GPLv3) and systemless (GPL-3.0-or-later) — so code can
now flow in both directions. Porting from either is allowed: keep the
original's copyright notice, and say in the file's header comment and the
commit message what was ported and from where. Contributing *to* systemless
is as easy as it ever was (GPL to GPL), with one thing to know before
opening a pull request there: its `LICENSING.md` adds a CLA that lets its
author also ship contributions in commercially-licensed builds — your code
stays GPL in the public repo regardless.

The constraint that survives the relicensing is methodological, not legal:
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
`utilities/check_all.mjs`, `utilities/dom_stub.mjs`,
`utilities/mobile_input_check.mjs`, and on the port's side `port/src/pef.cpp`
and the format notes at the end of `port/README.md`. It is one habit across
both trees, and the C++ holds to it as firmly as the JavaScript. When you make
a non-obvious choice, write down why, in that voice. Do not strip these
comments.

**Commit messages are prose, not conventional-commits.** They read like a
sentence describing the change from the user's side:

> `Ring the square, not the sprite; and read the sheet a name at a time`
> `On a phone the canvas comes first and never leaves the screen`
> `Two kinds of back, and a list view for the galleries`

Match that register. No `feat:` / `fix:` prefixes, no scope tags.

**Add tooling only where the tree already has some.** The site has no build
step and does not want one: no `package.json`, no bundler, no formatter config,
no transpile step, and `utilities/` runs on stock Node and Python with nothing
installed. Write it by hand, as everything there does. The port is a CMake
project and already depends on SDL2 — adding to it is ordinary work, and its
one standing rule is that `smoke.sh` must stay at ten passes and zero compiler
warnings.

**`reference/user_addons/` needs `unar` to open.** Twelve player-made addons —
patches, a saved game, mods — every one a StuffIt archive (`.sit`, `.sitx`,
`.sea`) that `7z` cannot read and macOS ships no extractor for. `brew install
unar`, then `unar` on the file (decode the `.hqx` wrapper with
`utilities/binhex_decode.py` first where there is one). Two are worth knowing
about:

- **`606_CheaterSavedGame`** unpacks to `I.M.Cheater`, the only complete
  Cythera player file in the repository: type `DelP`, a 332 KB Delver Archive
  in the data fork, and a resource fork with the `PICT` save preview. delvmod
  reads it, and so does the port — it is what `port/POWERPC-NOTES.md` §1b is about,
  and it takes the port deeper into the game than creating a character does.
  `unar` preserves the resource fork, reachable at
  `<file>/..namedfork/rsrc`.
- **The patches** are modded archives, which are the case `smartDecrypt`'s
  heuristic fallback exists for and which nothing currently exercises.

**`deprecated/`** holds retired work (`documentation_to_pdf/`, a graphics tone
experiment). Read it for context; do not extend it.

## Gotchas

- Editing `*.html` here means editing files of 2k–10k lines. Use targeted
  `grep` + `sed -n` to locate a region rather than reading the whole file, and
  check `js/` first — a Delver format is more likely to be there now.
- **`explorer.html` fetches one thing from outside the repository: the
  installer.** It used to pull its default archive, font and dialogue
  background from `raw.githubusercontent.com/e-z-g/cythera/main/res/...`; the
  game left the repository, so those URLs would 404 and they are gone. The
  default is now archive.org's copy of the installer through its `/cors/`
  path, with Bryce Schroeder's `Cythera.bin` after it (blocked by CORS until
  his server sends the header — see the per-page notes), both tried after
  the relative paths under `reference/` and before giving up. The rest is
  the path that always worked: an IndexedDB copy of whatever last opened, a
  file dropped or picked anywhere on the page, or `?src=<url>`.
- The archives are `reference/Cythera Data.hqx` and `Cythera.hqx`, both BinHex,
  both carrying two forks. There is no bare data fork in the repository any
  more; `check_all.mjs` extracts one into `$TMPDIR` because the harnesses want
  bytes, not because anything ships one. A rename that only changes case will
  not reach git on a case-insensitive filesystem — this file stayed
  `Cythera Data.Hqx` in git for a while after someone had renamed it.
- `repomix_output.md`, `.DS_Store`, `sources/`, `__pycache__/` and
  `infinite-mac` are gitignored. So is `build/` — which catches `port/build/`,
  where the port's objects, its extracted forks and its run logs all live. That
  directory reaches tens of gigabytes if instruction traces are left in it
  (`--trace` writes gigabytes a minute); it is entirely regenerable, so delete
  it freely. A CMake cache also pins the absolute path it was configured at, so
  a build tree copied from elsewhere must have `CMakeCache.txt` and
  `CMakeFiles/` removed before it will configure.
- **`cythera_symbols.txt` lives in `reference/`**, gitignored with the game.
  `run.sh`, `smoke.sh` and `drive.sh` look for it there (and at the repository
  root) and pass `--symbols` only when it is present; `tools/opcensus.py` and
  `tools/pefdisasm.py` require it outright. It was produced once by walking
  the binary's traceback tables; `PefImage::symbolizeFromTracebacks` in
  `port/src/pef.cpp` is that walk, but records every symbol at `codeBase_`
  rather than the function's own address, so it will not regenerate the file
  as-is.
- Empty `catch` blocks are common and mostly deliberate — "this optional decode
  failed, fall back" — but none of them say so on screen. 52 in explorer.html.
