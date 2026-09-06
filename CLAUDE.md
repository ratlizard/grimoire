# CLAUDE.md

Guidance for AI assistants working in this repository.

**If `NEXT-SESSION.md` exists one level up, in the workspace directory this
repository is checked out into, read it in full before doing anything else.**
It is the handoff, and it covers all six repositories: untracked, in no
repository, kept only on the machine the work happens on. A global SessionStart
hook (`~/.claude/hooks/print-handoff.sh`) prints it when the session starts in
that directory; if there is no `=== HANDOFF:` block in context and the file
exists, read it yourself. A fresh clone has none, and that is expected.

## What this is

**Grimoire** is a GitHub Pages static site of tools for reading, and in a
narrow way editing, the data of *Cythera* (Ambrosia Software, 1999) and of
classic Mac OS files generally. Published at
<https://ratlizard.github.io/grimoire/>. The whole of it is `index.html`,
`canvas.html`, `js/` and `utilities/`.

### The repositories

The work is split across six, checked out flat beside each other. A session
that clones one gets none of the rest, so paths across them are never assumed.
**You are in `grimoire`.** Every other repository is read from here, never
written to:

| | |
|---|---|
| **`ratlizard/grimoire`** | **public, GitHub Pages. This one.** |
| `ratlizard/alchemy` | public. Two superseded attempts at running the game: `port/`, the retired native PowerPC port, and `mobile/`, the emulator shell that used to be `mobile.html` here. Where this file says the port decodes a format differently, the detail is there. |
| `ratlizard/cythera-workbench` | private. The Python tools that analyse the executable, and the notes and handoffs of the systemless work. Nothing here depends on it. |
| `ratlizard/systemless` | public fork of benletchford/systemless, where running the game happens. Its HFS reader is what the disk-image writer here is round-tripped through, and its WebAssembly build is the intended future of "play" on this site. |
| `ratlizard/delvmod` | public fork of Bryce Schroeder's reference implementation of the Delver formats — the correctness oracle for Cythera's own (see **delvmod is the correctness oracle**). It is the submodule. |
| `e-z-g/cythera-reference` | private. The game, its documentation, the community's writing and the cited Apple documentation. Expected here as `reference/`, gitignored; the snapshot and oracle checks need it. |

**The site has no build step.** No `package.json`, no lockfile, no
`requirements.txt`, no `.github/workflows`. `.nojekyll` at the root disables
Jekyll processing, so every file is served exactly as committed.

**The viewer is `index.html`**, so the site is reached at `/grimoire` rather
than `/grimoire/explorer.html`. It was `explorer.html` until September 2026;
that name is still a file, and is now a five-line redirect that carries the
hash over — a saved link is usually a link to one resource (`#c=135&r=8801`)
rather than to the page, and breaking those to tidy a URL would be a poor
trade. Every other page is still reached by its own filename.

**Pushing to `main` deploys the site.** Whatever lands in `main` is live within
a minute or two. There is no staging environment and nothing catches a broken
page for you — run the checks below before pushing.

**Nobody is named here.** The maintainer is "the maintainer" in every file and
every commit; commits are authored `e-z-g <e-z-g@users.noreply.github.com>`.
Do not write a name, an email address or a home-directory path into the tree.
The one exception is the handle **EgadZoundsGadzooks**, which the maintainer
asked on 5 September 2026 to be credited under on the Tools tab; it is a
handle, not a name, and it appears there and nowhere else.

**The site has a version**, `GRIMOIRE_VERSION` in `index.html`, shown at the
top of the page as "Grimoire v1.0.0". It began at 1.0.0 on 5 September 2026,
two days after the site went public. Bump it by hand in the commit that
changes what a visitor sees: the middle number for a feature, the last for a
fix. The smoke test requires the line to be there.

## Working beside the forks

Two other repositories are read while working here and neither is ever
written to. **delvmod** is the correctness oracle for Cythera's own formats;
**systemless** is where running the game moved, and its HFS reader is what the
disk-image writer is round-tripped through. Both are forks under `ratlizard/`. They are inputs: a fix to
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
| `../delvmod`, `../systemless` | plain sibling clones — what a Claude Code web session has, since those clone each repository flat into one directory |

`$DELVMOD` and `$SYSTEMLESS` override for a copy kept
anywhere else. Every candidate is resolved against the repository root, so the
suite gives the same answer from `grimoire/` and from the directory above it —
which it did not before August 2026, and a session whose working directory is
the parent of all four checkouts is the ordinary case now.

Three things about that arrangement are worth knowing before reading a skip as
a failure:

- **systemless's `examples/hfs_dump` is on the `cythera-detailed` branch**,
  not on `master`. `hfs_check.mjs` needs it for the round trip through that
  project's HFS reader, so a checkout sitting on the default branch has the
  reader (`src/disk_image/hfs.rs`) and no way to call it. The check names the
  missing file and still runs its structural half, which is most of it.
- **The game is in none of them, and the suite now feeds itself anyway.**
  `reference/` is gitignored, so a session that was handed only the
  repositories has no Cythera in it. `utilities/fetch_game.mjs` pulls the
  28 MB installer from archive.org's `/cors/` path into `$TMPDIR` and builds
  the four fork files out of it, so a checkout with no `reference/` runs
  **14 ok, 0 failed, 2 skipped** (measured 4 September, with the delvmod and
  systemless siblings beside it) — both snapshots among the ones that run,
  which is the whole point: a skip reads like a clean result, so before this a
  cloud or web session could not see a decoder regression at all. The two that
  still skip want files rather than bytes: `archive loading` wants the `.hqx`
  pair and `installer` wants the `.sit`. Without the network the fetch is
  reported and is not fatal, and the archive-backed checks skip as they did
  before.
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
index.html               Delver archive + resource fork viewer (Grimoire itself)
canvas.html                 colour-cycling paint studio
js/                         classic scripts, two tiers (see below)
utilities/                  the site's Node + Python harnesses and converters
res/                        the four game-derived files the pages fetch at run time
reference/                  gitignored: the game, and what a person or a model reads while working
delvmod/                    submodule, the correctness oracle (see below)
```

**`res/` and `reference/` are different kinds of thing.** `res/` is the four
game-derived files a page fetches at run time — the Argos font, the dialogue
frame, the plank tile — and `NOTICE` lists them. Since 5 September 2026 the
font is also read out of the open file itself (`installGameFont`), so the
copy in `res/` is the fallback for the moments before a file is open. Everything else that is
Cythera's — the game, its data, the installers, the community add-ons — lives
in `reference/`, which is gitignored: none of it is ours to publish, so supply
your own copy of the game and put it there (a symlink to a copy kept elsewhere
is fine). Nothing in the repository will fetch it for you, and that is
deliberate. `reference/` is also what you read while working: the scraped
forums and guides, the game's own documentation, Apple's Inside Macintosh
volumes. Nothing in `reference/` is fetched by a page, and nothing should
start being.

It is `e-z-g/cythera-reference`, private; a symlink to a checkout of it under
the name `reference` is the usual arrangement.

```
reference/  (gitignored — supplied by you)
    game/
        Cythera Data.hqx, Cythera.hqx  the game, both forks, BinHex
        installers/                    the 1.0.x installers, the archive.org copies
        installed-folders/             the .sit folders systemless launches from
        combat-ai/, manuals/           the shipped .ai scripts; Ambrosia's PDFs
    community/
        dialogue/Dialogue/             the verified dialogue, the oracle below
        guides-site/, fandom-wiki/, delver-homepage/, forum-writing/
        addons/, editors/              player-made add-ons; ACE
    apple-documentation/               the cited Inside Macintosh and technical notes
    saves/, screenshots/
```

## The hard constraint: classic scripts, `file://`-safe

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
is worth keeping true even though only one page loads them now. `index.html`
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

**Cythera's own formats** — loaded after those nine, by `index.html`:

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

`canvas.html` does **not** use `js/` — it is self-contained with a single
inline script.

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

## Checks

`utilities/` holds the site's test suite. Everything runs on plain Node 18+
(`.mjs`, no dependencies) or Python 3. Run from the repository root:

```sh
node utilities/check_all.mjs            # everything, one table, ~75s
node utilities/check_all.mjs --quick    # skip the slow browser-ish smokes
node utilities/check_all.mjs viewer     # the one page there is
```

`check_all.mjs` is the entry point: it does the setup (extracting data and
resource forks from `reference/game/Cythera Data.hqx` and `.../Cythera.hqx`
into `$TMPDIR`,
and building the delvmod graphics reference), runs the individual
harnesses, validates exported ZIPs with `unzip -t`, and prints a single
pass/skip/fail table. Use `$TMPDIR` for scratch, never `/tmp` directly.

### Data setup

The game data needs nothing: `check_all.mjs` finds its inputs itself. It
reads the archives straight out of `reference/` when you have put a copy of
the game there, and when you have not it falls back to
`utilities/fetch_game.mjs`, which downloads the 28 MB installer from
archive.org's `cythera-installers` item — the page's own first default,
through the `/cors/` path — and builds the four fork files out of it in
`$TMPDIR`, cached, so a second run costs nothing. That is a **convenience,
not an oracle**: the bytes are the same game, so it gives no independent
evidence about any decoder, and `vise_check.mjs` is what actually proves the
installer path against the CRCs the catalog carries. Two further inputs come
from outside the repository.

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

- **systemless** — a checkout of `ratlizard/systemless`, used by `hfs_check.mjs`
  for the disk-image round trip. Found at `systemless` or `../systemless`, or
  through `$SYSTEMLESS`; without it the structural half of that check still
  runs. It builds `examples/hfs_dump` on first use, which takes about a minute
  and then stays built — the check is marked slow for that reason and
  `--quick` skips it.

A check whose inputs are genuinely missing is reported as **skip**, not fail.
A clean run is **16 ok, 0 failed, 0 skipped**. Anything else is a
regression. Without the game in `reference/` most checks skip, and `delvmod
write` and `disk image` are the two checks with an oracle still running — its synthetic archives are built on the fly. `dialogue vs
guides` has a second, optional input of its own — the community's dialogue
collection at `reference/community/dialogue/Dialogue` (the ZIP
from cytheraguides.com, unpacked) — and runs its structural half without it.

Two of the checks print a hash rather than a verdict, so a deliberate change can
be told from an accident. As of this writing:

| Check | Hash |
|---|---|
| `viewer / decoder snapshot` | `SNAPSHOT e417960b5595f5f9` |
| `viewer / resource snapshot` | `SNAPSHOT 3850dee3cd55` |

If one of those moves and you did not intend it, you changed what a decoder
outputs. If one of them *doesn't* move after you changed a decoder, the snapshot
is probably not covering it — that has happened twice, and each time the fix was
to add a line to the snapshot rather than to trust the green result.

### How the harnesses work

No harness in `utilities/` drives a browser: they run the page's real
JavaScript inside a `node:vm` against a hand-written DOM stub, so the suite
stays dependency-free and runs anywhere Node does. The Playwright drivers that
once did live with the retired mobile shell in `ratlizard/alchemy`.

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
  in it. Its `world tab` section drives the World tab end to end: the gateway
  index and Cademia's footprint, the gazetteer, the ring drawn without the
  world map changing, the cross-fade landing on Cademia (run to its end
  through `finishWorldFade` rather than waited on), the scenery placed on
  Cademia's own icon, out-by-zooming-out and back-in-by-zooming-in, the seven
  sealed destinations refusing to open to a zoom, the `#c=WORLD&z=8008` round
  trip with the browser's back button not walking in again, the miniatures
  (built, sized to cover the pictogram, absent for sealed places, and rendered
  on their own canvas rather than the panel's), the roofs arriving on and
  lifting on approach with the checkbox outranking both, the level ladder
  sharpening rather than magnifying, a 60×25 pan sliding the overlay by
  exactly that, the opt-in preload turning on and freeing back to the ordinary
  cache, Cademia's miniature landing within about half a square of its own
  4-square pictogram and the crossing putting the real map exactly on that
  miniature, the hover card naming the right person and staying quiet over
  bare ground, world › Cademia › Sewers coming back up one level at a time,
  the scenery being carried through a zoom rather than left behind, the lens
  engaging at 1.6× where the old absolute rule would not have,
  the surround plate being sharper than the base it replaces and centred on
  its own gateway, and — by counting `renderMapVisual` calls rather than
  timing anything — that a crossing costs **one** map render and a return or a
  revisit none; and, since 5 September 2026, that five pans in a frame are
  one paint at the frame, that a magnified node's native art is rasterised
  once and blitted after, that the square card names the person, stays
  quiet over bare ground for a passing pointer and gives the ground to a
  held finger, and that full screen pins and unpins the panel where the
  browser offers no element full screen. Its `saved game` section opens a Cythera player file through
  `adoptArchive` — the path that refused every one of them until
  September 2026 — and checks what a visitor sees (see the per-page notes).
  Its fork section checks the grouped gallery has its headings, that a
  TrueType with `OS/2` came out of the fork's `sfnt`, that the editor's
  zone list is aligned to the map numbers, and that the two-fork views draw
  from the data file's fork alone when the application's is absent; the
  installer section then requires every fork-backed view to draw, the
  Rules tab to carry the AI vocabulary, and the bundle to give the application, the data file and a saved game an
  icon and a TEXT file none. Its DOM stub moves a re-appended node rather
  than copying it, as of 5 September 2026: `applyGalleryArrangement`
  re-appends the gallery's cells to order them, and every tile count the
  stub reported before was four times the truth.
- `loader_test.mjs` — the orchestration around the decoders: BinHex/MacBinary/
  AppleSingle unwrapping, archive validation, the refusal messages, deep-link
  parsing, and `loadDefaultArchive` driven to total failure. Every other harness
  hands bytes straight to the parser, so without this the code a visitor
  actually triggers was never executed. With the installer present it also
  drives the default path: the installer dropped, the installer served at the
  default URL, and an installer with no archive in it refused by name.
- `vise_check.mjs` — `js/mac-vise.js` over the real installer
  (`reference/game/installers/Cythera.bin`): every file's two forks
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
  at their own root. And, when `reference/community/dialogue/`
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
  `index.html` exports with. Structural on its own (the MDB, the bitmap and
  both B-trees read back and audited against the arithmetic that produced
  them); with a systemless checkout beside this one it also round-trips every
  volume through **that project's HFS reader**, comparing paths, Finder types
  and both forks byte for byte. `$SYSTEMLESS` overrides the location, and
  without it the structural half still runs. It is not an oracle in delvmod's
  sense and its header says why — the writer was written *from* systemless's
  reader — so the check that matters most is the one no harness can do, which
  is that a real Mac OS mounts the volume. That was done by hand in the
  emulator and what it settled is written down in `js/mac-hfs.js`.
- Python converters: `binhex_decode.py`, `resource_fork_parser.py`,
  `quickdraw_pict_decoder.py`, `pictscan.py`, `qtma2midi.py`, `midi2wav.py`,
  `delv_graphics_ref.py`.

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
  written, with nothing executed. gets it from **`utilities/delv_compat.py`**, installed from outside
  so nothing in the checkout is ever modified. Import it and `import delv.archive`
  works.
- **The submodule is `ratlizard/delvmod`, not upstream** — a fork that already
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
NFNT in JavaScript, and **the mac-\* tier has no oracle**: delvmod covers
Cythera's Delver formats and says nothing about classic-Mac ones, so
`rsrc_snapshot.mjs` is all that guards them — and a snapshot proves a decoder
*unchanged*, never *right*. The second opinion is the retired native port in
the private repository, whose C++ decoders were validated the hard way, by the
original binary running against them, and systemless, which renders the same
formats in Rust. Three differences are known and recorded there rather than
here. The one that was a bug on this side — **PICT `0x0090`/`0x0091`**,
uncompressed BitsRect/BitsRgn, which `js/mac-rsrc-types.js` parsed only to
stay aligned and then walked past — is **fixed**: a picture whose artwork is a
plain BitsRect drew nothing here while the port and systemless both rendered
it. The layout was taken from `systemless/src/trap/pict.rs` and the port's
`src/mac/pict.cpp` rather than inferred from the data, and
`utilities/pict_bits_check.mjs` guards it with synthetic pictures, because
**not one of the twenty-one PICTs in Cythera and Cythera Data reaches those
opcodes** — they are all `0x0098`, `0x0099` or `0x009B` — so neither snapshot
can prove the path works or notice it breaking. Two more were found on
5 September 2026 by looking at every PICT the forks hold: a device colour
table (`ctFlags` high bit set) was read by its `value` fields, which are all
zero in that kind, so three 8-bit pictures came out as one colour; and a
16-bit picture packed with `packType` 3 was unpacked by bytes where the runs
count words. Both other implementations already had both right, so these
were this side's alone; the resource snapshot moved from `4d4c7cf6e1b1` to
`3850dee3cd55` for exactly those four pictures.

**The HFS writer is the exception that proves the rule, and it is labelled as
one.** `js/mac-hfs.js` was written *from* systemless's `src/disk_image/hfs.rs`
— every MDB offset, every catalog record shape, the B-tree node descriptor and
header record — which the licensing note below explicitly allows, HFS being
infrastructure this tree lacked entirely. So it cannot cross-check systemless
and `utilities/hfs_check.mjs` does not claim to: the round trip through that
reader catches an offset written one field along, and the thing it cannot
catch was settled by mounting the volumes in a real Mac OS. `js/mac-vise.js`
and `js/mac-stuffit.js` are the same case, ported from systemless and from
Ben Letchford's stuffit-rs, and each says so in its header.

The *Delver archive* has a JavaScript writer, `writeDelverArchive` in
`js/delv-archive.js`, proven byte-identical to delvmod's `Archive.to_file` by
`delv_write_check.mjs` — over synthetic archives and over the real one, all
1,558 resources. `index.html`'s Edit Bytes path is its first caller; see the
per-page notes.

**If you change a decoder here, say in the commit message whether the other
implementations have the same bug.** No suite will tell you.

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

### `index.html`

- The Delver-format half of it lives in `js/delv-archive.js`,
  `js/delv-graphics.js` and `js/delv-script.js`; the page holds the UI, the
  rendering, and the ~7,700 lines that need a document. See **Where new code
  goes** above before adding to either side.
- **The World tab is the atlas: the world as one scene.** One coordinate
  system (world squares), a view of three numbers, a tree of maps placed in it
  by `gatewayTransform`, and a full redraw every frame — the whole scene is a
  couple of dozen `drawImage` calls, so there is no reason to be clever.
  It replaced a renderer that borrowed the map panel — a thing correctly built
  around one map at a time — and then spent **425 lines** persuading it to
  behave like a continuous world: a cross-fade, a landing calculation, a
  stack, a hold, four thresholds in and two out, a second copy of the world
  drawn behind each town, and three separate implementations of "keep this
  layer registered with the map while it moves". *Every* display bug reported
  against the World tab was in that layer rather than in the feature. Deleting
  it took **1,515 lines out for 84 in**, and what went with it is structural:
  there is no crossing, so nothing to fade, land, hold or pop; nothing is
  painted once in screen space, so nothing has to be slid to catch up; the
  world is simply the parent node, so there is no surround; and *which place
  am I in* is read off the view rather than stored where it can disagree with
  what is drawn.
- **It places what the archive locates, and nothing else.** A map header's
  four edge fields say where walking off each side puts you; where one lands
  on the world map, the archive is making a spatial statement — *this map is
  contiguous with the world at that square* — and 23 of the 42 say it. But
  located is not on the surface, and since 5 September 2026 a map is drawn
  on the world only when the archive says **three** things about it
  (`mapIsSurface`): its edge leads to the world; its entry script sets a
  landscape strip rather than one of the engine's own backdrops, which is
  the file saying *outdoors* — Scylla Temple's script sets −16, a backdrop,
  and it was being drawn spread beside its cave mouth; and the world map
  draws it with a pictogram that is a place (a town, a ruin, a farm, the
  Mining Camp's shaft) rather than a way in (a cave, a hole). **17 make the
  surface.** Six that are located do not — the Temple, Harpy Abyss, the
  Sitia bridge, Pnyx upstairs, Tavara without its fortress, the underground
  under Catamarca — and the 19 that are not located say nothing of the
  kind: what the file gives for each is a **doorway, not an extent**. All
  25 are reached through a **mouth** (`atlasMouths`, `atlasDescend`): a
  ring on the square the archive does give — a portal prop's, or for the
  four the world draws nothing for, the square their own edge names — and a
  *step* rather than a zoom, after which that map is shown on its own with
  the strip describing the **connection** rather than asserting a
  position. The bridge was placed at its edge square before and looked
  off-centre, because that square is not its middle; the maintainer's rule
  was *treat it like a tunnel rather than mask the data*. Mouths are named
  from the editor's list, since the scripts call Tavara without its
  fortress "Cythera". An earlier version placed 37 maps at an invented
  scale and the invented part was visible. `ATLAS_BELOW` is a stack, and is
  the only state in the renderer.
- **Roofs fade where they used to cut.** A town at a distance is roofs and
  close up they are in the way. They used to vanish at the step from the
  miniature to the render, 448 screen pixels across, which the maintainer
  found the right distance and the wrong manner; `atlasRoofT` fades them
  from 360 to 540 px across, and a town drawn from its render or its own
  art gets its roofed miniature laid over at what is left. **The unbuilt
  margin of a region fades in as the roofs fade out** (`drawWithMargin`):
  the miniature is cropped to the built part, so the margin used to appear
  all at once at the step to the render; now the built part is always
  drawn whole and the margin at what the roofs have given up. The zoom row
  under the map wraps and has the bar's dark ground, since its buttons ran
  off the right of a phone and its words sat on the planks.
- **It paints once a frame, and cheaply, because a phone could not keep
  up.** An iPhone 15 juddered: a finger reports its position up to 120
  times a second and every report painted the whole scene at two device
  pixels per CSS pixel, with the magnified node's native art rasterised
  square by square and everybody's position on it worked out from the
  schedules, all before the next report was read. Four things fixed it,
  none of them a change to what is drawn: a move changes the three view
  numbers and asks for a paint (`schedulePaintAtlas`), so many moves in a
  frame are one paint at the frame; while a finger is down the canvas is
  one device pixel per CSS pixel (`atlasView.touching`) and is painted
  sharp the moment it lifts; the native-art window is rasterised once into
  a canvas of its own six squares wider than the screen needs and blitted
  until the view leaves it (`atlasDetailWindow`), rebuilt on the palette
  frame only when the window holds a square that animates; and the people
  on a node are worked out once per node and hour (`atlasFolk`). The
  seven-frames-a-second palette cycle waits while a finger is down and
  while the tab is hidden. The smoke test counts: five pans in a frame are
  one paint, and a repaint at the same view rasterises nothing.
- **Full screen** (`atlasToggleFull`). The panel is asked to go full screen
  where the browser allows an element to — desktop browsers, Chrome on
  Android — and is pinned over the page (`body.atlasFull`) where it does
  not, which on an iPhone is every browser: they allow it for video only,
  so the address bar stays, and that is as full as the OS permits. Either
  way the zoom row and the inspector stay under the viewport and the
  canvas resizes through the check `paintAtlas` already makes. Escape
  leaves the pinned mode as it does the real one. The panel's `display` in
  that mode is `!important`, because `renderAtlasView` shows the panel
  with an inline `display:block` and inline beats the sheet: the first
  version formed no column, the viewport's auto height was nothing, and
  full screen on an iPhone was a zoom row and an inspector with no map.
- **Full screen is the map alone, v1.11.0** (6 September 2026): in full
  screen the zoom row, the inspector, the strip and the tuning rows are
  hidden by CSS and one overlay in the corner (`#atlasFullOverlay`)
  says where the middle of the view is — `atlasCurrentPlaceName`: below
  ground the place you came into, on the surface the deepest drawn
  place under the middle, else Cythera — with a Leave button and, below
  ground, a ↰ back up. `paintAtlas` refreshes it. **Names are the game's
  own**: `atlasMapName(resid)` is the entry script's name, and only where
  that name is shared by more than one map ("Ruins", "Caves",
  "Stronghold", "Vineyard", "Underground", "Mountains") the editor's
  more specific name follows it, "Ruins · Headwater Ruins"; the mouth into
  Land King Hall says "Land King Hall", not the editor's "LKH". Land King
  Hall stays a mouth, by the file's own reading: its entry script sets a
  backdrop (−1) and its header's exits do not land on the world, and the
  arch is an entrance pictogram. **Mouths open sooner**: `descendAt` (20
  px per square of the mouth's map) replaces the old "92 % of the maximum
  zoom" rule, which on a town inside the world was a long pinch past the
  point where the ring was plainly the target and inside Land King Hall,
  whose squares are the world's, was never reached; `descendRadius` is
  0.2. An exit to the world is never a mouth. The smoke test pins the
  name, the hall's hole opening at 24 px a square, and the overlay's
  text; the atlas section of the smoke runs without the fork (the
  deep-link check re-opens the data fork alone), so the editor's suffix
  is asserted only when the fork is there.
- **A zoom is judged when it ends, and the fall is drawn, v1.12.0**
  (6 September 2026, after the maintainer found v1.11.0 "way too
  sensitive" and unable to leave a tunnel — it re-entered at once). A
  gesture is a pinch or drag from first finger to last (`atlasGestureBegin`
  / `atlasGestureEnd` on the pointer events), or a run of wheel clicks or
  slider moves until a 180 ms pause (`atlasGestureTouch`). Only at its end,
  and only in the direction it went: a net zoom-in asks `atlasCheckDescend`,
  a net zoom-out `atlasCheckAscend`, a pan asks nothing. `atlasZoomAround`
  no longer checks. A mouth opens when its square fills `descendFill` (a
  tenth) of the shorter side and sits within `descendRadius` of the middle.
  **The fall** (`atlasFallInto`): the view zooms onto the hole, drawing it
  to the middle, until its square covers the screen; then `atlasDescend(m,
  node, arriveZ)` opens the place below from a sixtieth of its final zoom,
  centred on the arrival square, to half the px-per-square the hole's map
  had — the stack entry keeps `fromResid`, `arrive` and the view left.
  **The rise** (`atlasRiseOut`, also the bar's ↰ and the overlay's): the
  place shrinks to nothing around the arrival square, then the map above
  opens out from the blank middle of the hole to half the zoom it was
  entered at, so the hole is there, smaller, and only another zoom-in
  means it. `atlasAnimateTo` runs the frames (`animMs`, 550; 0 is a cut,
  and the smoke sets 0 since the stub queues frames and never runs them);
  input is ignored mid-animation. **Names from outside the game's text are
  on by default now** (`SHOW_BUILTIN_LABELS` true; the archive-menu
  checkbox "Names from outside the game’s own text"), and on the World
  map `atlasMapName` never doubles a name: with the option on a shared
  script name is replaced by the editor's ("Headwater Ruins"), off it
  stands as the game gives it, twice. The smoke pins the fall to half
  zoom, the rise to half zoom, a pan staying put, and a second zoom-in
  re-opening.
- **Press and hold is the hover on a touch screen**, on the atlas and on
  the map panel alike. There is no pointer resting over anything on a
  phone, so a finger that stays put for a third of a second asks what a
  resting mouse asks, and the card follows the finger until it lifts;
  sliding first is a pan, a tap is still a tap, and the hold neither pans
  nor opens the inspector. **The card says what is on the square, not only
  who** (`squareCard`, shared by both panels so they agree): the person
  and what they are doing, what is placed there, and — only for a held
  finger, which has asked — the ground; a passing mouse stays quiet over
  bare ground, since a card over every blade of grass is noise. **A person
  is shown by their portrait**, on the card and on both inspectors'
  cards (`characterFace`: `0x8800 + index − 1`, the dossier's join, kept as
  a canvas and a data URL), and by the sprite only where there is none: the
  sprite names a class, the face names the person.
- **Sizing is measured, not chosen.** `contentBox` is the built part of a map
  (Cademia's map is 128 squares and its town is 107); `worldSquareRatio`
  measures how many region squares one world square stands for from the
  gateways whose pictogram covers more than one square; `gatewayRatio` prefers
  a place's **own** icon where it has one, and requires **both axes** — a
  block of props placed two or four squares each way is a decision, a cave
  mouth drawn 1×2 is just the shape of a picture of a cave mouth, and reading
  the latter as a size gave the same Underground three different sizes.
- **What is outside the map is the folder it lies on**, not sea. Filling it
  with the world's own border water asserts that the sea goes on, which is the
  same class of claim as putting an underground on the world: the file says
  what is inside the 256×256 grid and nothing about what is outside it.
- **It has its own container, and that is the fix for a seam that produced
  every regression this tab has had.** `#atlasPanel` is a sibling of
  `#tabSheet` inside the folder, with its own viewport, canvas, strip,
  inspector and hover card. The atlas borrowed the map panel for three
  versions and each time the borrowing broke Entities › Regions: first
  `CUR_MAP`, then the panel's own elements (maps drew into a hidden wrapper),
  then the body class that unframed the sheet. Guards were added each time,
  which is patching a pattern. **The whole handover is now two elements**: the
  sheet steps aside, the panel appears, and nothing is shared but which of the
  two is showing. Being a sibling of the sheet is also what puts the folder
  behind the map — the sheet is the game's dialogue box, and a map of the
  world is not a line of dialogue. The smoke test takes a snapshot of Regions
  *before the atlas has ever run* (a baseline taken later compares two
  post-atlas states and cannot fail) and requires it back bit for bit.
- **TEMPORARY: `window.ATLAS_TUNE` and the tuning strip.** Six numbers decide
  how the atlas behaves and not one can be settled without looking at a real
  screen, so while they are being chosen they live in an object the strip can
  move rather than as constants. `ATLAS_TUNE_ROWS` drives the UI and the smoke
  test checks every knob it offers is one the renderer reads — a slider that
  changes nothing returns an answer about the wrong thing. **When the values
  are settled, delete the strip and put them back as consts**, each with a
  comment saying why, like every other decision in this file.
- **Navigation is a tree of folder tabs, three deep, and the split at the top
  is the point.** `TAB_TREE` (in the page, beside `navIconCanvas`) is
  World / Entities / Components / Data: what the game assembles, what the archive
  stores to assemble it from, and the files themselves. Every leaf names the
  galleries it holds by the hidden `#categorySelect`'s own values, which stays
  the single source of truth for what is open — `pickCategory` sets it,
  `syncTabsTo` draws the rows and the chip row for whichever leaf holds it,
  and `showCategory` is only the "is it a category?" check in front. A leaf
  with several galleries shows them as chips. `wip: true` fades a tab whose
  join is not traced yet (the PEF; and the Combat AI pair until the
  installer has brought the files, when `syncInstallerTabs` unfades
  them); a faded tab still opens. The top row's three
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
- **A link to a related thing is a relation chip** (`relChip`; `svChip`,
  `partChip` and `characterChip` build one). It reads icon, name, kind, id:
  the icon is the game tile of the tab the target lives under, drawn once
  per tile into a data URL, so a chip to a portrait wears the mirror and a
  chip to a map wears the town, and a reader knows where a click lands
  before making it; a person wears their own sprite. The name leads, what
  it is (`RESOURCE_KIND`) sits under it, and the hex id is a quiet
  monospace tail. They replaced monospace chips that led with the hex
  (`.sv-chip`, which the action chips still use). Restyled 5 September
  2026 at the maintainer's request; whether it reads right on a real
  screen is his to say.
- **Mechanics is rules read out of the scripts on the spot**
  (`renderMechanicsSheet`), since 5 September 2026, and not a table. Two
  so far. **The dice game** (`diceGame`): one function in the inn's shared
  dialogue `0x812`, offered by the three innkeepers; the rules are read
  from it — a match with the innkeeper's first die wins 2 oboloi, a white
  die outside the two black ones wins the distance to the nearer, inside
  loses an obol, a win of 1 is a push; Gambling gives the white die a one
  in six chance of being set to the first black one; the script pays one
  less than it announces and takes one on a loss — enumerated over all
  216 throws (96 win, 50 push, 70 lose; +0.306 obols a game for the
  player, +0.421 with the skill; the house loses), and the innkeeper's own
  explanation from the same script is quoted beside the rules. **The talk
  balloons** (`buildBarkCatalogue`): every `set_field talk_balloon` in
  every script with the string that follows it, and every call of the two
  tavern helpers `0xC84`/`0xC85` with the lists they pick from — a list is
  a `data` block, 0x45, a length, an array header 0x90 and a count, then
  4-byte entries whose last two bytes are the offset of a C string in the
  resource, which is how the words come out exact — who says it where the
  script is theirs, "anyone" where it is shared. 43 sites, 57 distinct
  lines in the shipped archive. **The words are Text › Barks**
  (`renderBarksSheet`, the maintainer's call on 5 September: the lines are
  text the game speaks, a component; Mechanics keeps the rule and points
  there), and a person's own lines are a *Says* row on their dossier
  (`characterSays`). The engine's side — `TBark`, a 128×32 rounded balloon
  with a tail, the text anti-aliased in the game's own style — is traced
  in `cythera-workbench/doc/talk-balloons.md`. The smoke test requires six
  named lines, Hot Kabobs on the Barks tab with its speaker, Yum on
  Alaric's dossier, and the 96/50/70 enumeration. Three more the same
  day, each read on the spot. **Weapons and armour** (`gearTable`): every
  item class with a combat key 0x2A–0x2F, its weight and its parameters as
  stored; armour's one number is points of protection (the wiki's), the
  weapon fields are not published anywhere, and the one thing the data
  shows is said — the first melee number orders the weapons as their
  damage would (mystic spear 35, sword 30, axe 22, sword 20, mace 15).
  **What each skill is consulted for** (`skillConsultations`): every
  `GetSkill` with a constant skill, by skill, with the scripts that ask —
  Gambling by the dice game, Cooking by the stove scripts, Persuasion by
  three merchants — and a count of the helpers that test whichever skill
  they are handed; skill n's name is its own script `0x1A00 + n`.
  **Karma** (`karmaRules`): every write — a literal step, the helpers
  `0xF11` down and `0xF12` up, the assignment to 55 at creation in the
  hero's script, and the kill table in `0xE8D`, four 28-bit words read as
  signed and indexed by the victim's alignment: +1, +4, −10, 0 — with the
  nearest line the script prints as the occasion, and every read as a
  threshold: the four Seldane priests refuse below 40. The smoke test pins
  the axe's 22, Gambling's asker, the 55 and the kill table. And three
  more, later the same day. **Experience and levels**
  (`experienceRules`): one helper takes every award (`0xE8B`) — added,
  capped at 65,535, the level rising when it passes 100 × 2^(level − 1) —
  and `0xE86` recomputes full health as body + reflex ÷ 2 + level plus
  Defence × 5 × reflex ÷ 15 (the skill, else a class figure from `0xE95`)
  and magic as mind + Mana likewise; the damage helper `0xEB8` pays the
  attacker the damage dealt up to the victim's level above theirs plus
  one; `0xE8E` splits a shared award across the party; and every `GainExp`
  with a constant is a row, 34 of them, with the nearest printed line as
  the occasion. **Food and potions** (`foodRules`, `effectSummary`): a
  potion's aspect picks its effect — the class `0x101F` calls `0xA00 +
  aspect` and its own text names the eight, which line up with the eight
  effect scripts, each read for what it sets, clears or applies
  (Sustenance sets nutrition to 24, Healing adds 10 plus a roll of 1 to
  10, Antidote clears poison, Smith's Friend is fire protection for 100
  plus 10 times a roll); a food's Use adds to nutrition, a constant or,
  for the general foodstuff class, a value per variant from a data block
  of words, the variant named by its tile (flatbread 6, meat pie 16,
  steak 20). **Status effects** (`statusRules`): every `StatusEffect` by
  flag — the disassembler's `DVM_FLAG_NAMES` — with the duration the call
  gives, computed where a roll is in it, and every `ClearFlag` as a cure;
  12 statuses, sleep for 4,096 from Soporiferousness, cleared by Free
  Motion among others. The smoke test pins the cap and the doubling, a
  100-point award, Antidote and Healing, the foodstuff variants, and
  sleep's 4,096 with a cure for poison. And the last three from the
  scripts, the same evening, on one shared reader: **`dvmDataValue`**
  reads a `data` block as JavaScript — an array header 0x90 and a count,
  then 4-byte entries that are a pointer (0x98, a byte, a 16-bit offset in
  the same resource) to a C string or another array, or a 28-bit number —
  and `dvmCallSites` finds every call of a helper with the ops around it,
  so a reader of shops, trainers or barks is a few lines over the same
  shapes. **Locks** (`lockRules`): `PickLock` `0xE43` — a key fits when
  the lock's number is the key's plus the number given; a pick succeeds
  when reflex plus a roll of 0 to 19 is at least 20 plus another roll of
  0 to 19 plus 5 for every 20 of the lock's difficulty, and breaks
  otherwise; the lockpick item (`0x1109`) refuses without the Lock Picking
  skill; the difficulty is the placed lock's own `data1`, and the classes'
  lock parameter (key 0x34: chest 15, oak door 10, stone door 255) is
  shown as stored. **Shops** (`shopRules`): every call of `0xEA5` — a
  title, a goods list of [prop word, name, price, count] records, and four
  bargaining figures of the vendor's own — 23 shops from Atreus's gems to
  Eteocles's bomb at 200; the helper bargains from the listed price and
  the Haggling skill takes a further roll of 0 to 5 off the vendor's
  figure, which its code says. **Training** (`trainingRules`): every call
  of `0xEB1` — pupil, the teacher's name, a skill as a constant or a menu
  of [name, skill] pairs built just before, and whether to mastery — 10
  teachers; a lesson costs one training point (`0xEAF`), a character is
  made with 4 (`0x1801`), gains 6 less the difficulty level with each
  level (`0xE86`), and a skill is mastered at level 15. The smoke test
  pins the chest's 15 and the lock formula, Milcom's sword at 45 with the
  haggling roll, and Thersites teaching axe and mace with the points rule.
  Three of the four I had put down to the executable turned out to be
  scripts, read the same evening. **Combat** (`combatRules`): `0xE88`
  (a blow) and `0xE89` (a missile) make the attacker's margin — reflex,
  or body for a monster flagged so, plus the weapon's skill (Barehand
  with none, Missile for a launcher), plus a roll of 0 to 29, less the
  defender's reflex plus a roll of 0 to 29, plus Attack less Defence
  (`0xE84`, class figures where the skill is absent) — and `0xE87`
  resolves it: every shield blocks a roll of 0 to its block plus the
  Shield skill and a margin under that is parried; enchantment and skill
  go on the margin and skill on the damage; a margin of nothing or less
  misses; a hit does a roll of 0 to the damage figure plus the
  enchantment, named by thresholds 3, 6, 9, 12, 16, 20, 25, 35 (the words
  are read off the script). Following those routines named the weapon
  fields, and `ITEM_FIELD_INFO` and `gearTable` now say what each is:
  melee [damage, reach, type, skill, miss sound, hit sound, effect],
  thrown [damage, range, effect, sound], ranged [ammunition class, range,
  sounds], ammunition [class, damage, type], shield [block, skill];
  reach from the AI's weapon choice `0x3042`, which squares it against
  the distance, the ammunition class and range from the bow scripts
  `0x903`–`0x988`. **Spells** (`spellRules`): every spell script casts
  through `CastSpell` `0xEA1` with its level and cost, so the table of 49
  is read off the calls (Directed Nexus 1 for 1, Fireball 5 for 20, Charm
  6 for 18); the helper says the rule — a cost above the caster's magic
  fails outright, the cast costs 10 plus twice the level in time, and the
  casting fails when two rolls of 0 to the caster's Casting figure
  (`0xE85`) together fall short of a roll of 0 to the level. **Hunger**
  (`hungerNotes`): no script lowers nutrition, so the fall is the
  engine's; the scripts read it — the idle script complains below 4, the
  fountain and Nutrient add up to 100. The smoke test pins the axe's
  damage and skill, the spear's reach, the bow's class and range, the
  0-to-29 rolls with the parry and the eight blow words, Fireball at level
  5 for 20 with the failure rule, and that nothing lowers nutrition.
  **A balloon stays up four seconds**, read from the executable the same
  night: `TBark::SetBark` returns `TickCount()` plus 240 and
  `TActiveMonster::ShowBarks`, each frame, removes a bark whose expiry the
  tick count has reached (the trace is in
  `cythera-workbench/doc/talk-balloons.md`; neither routine is reached by
  a direct `bl`, so a scan for callers finds none — read `ShowBarks`).
  **The hunger rate and the clock, v1.9.0**, read from the executable the
  same night (workbench `doc/game-clock.md`): the clock counts 1/4096 of
  an hour, a step is one unit, and `TGameViewer::DoTicks` takes one off
  nutrition (byte 27 of the character record, script field 40) every
  hour; while nutrition is above 0 it also adds one health and one magic
  at a period by level (hour, half hour, 20 min, quarter hour, 12 min),
  and every six minutes takes one health from the poisoned (death at 1)
  and gives one to the regenerating. The Hunger section became "Hunger
  and healing" and a "The clock, poison and time" section replaced the
  "Not in the scripts" one, so nothing on the sheet is put down to the
  executable unread any more. Finding it needed the field jump tables
  from the data section, which the workbench simulator expanded wrongly
  until that night (opcodes 3 and 4); it is fixed, and `r2 = 0x808000` is
  now confirmed by the entry vector too. The smoke test pins "one off
  every game hour" and "4096 is one hour".
  **Spell effects and sleeping, v1.10.0** (`spellEffects`, `sleepRules`).
  Every damage call in a spell script (`0xEB8`: victim, amount, type,
  source) and every write to health is read off the script; the amount
  is a stack expression evaluated by `dvmAmountExpr` (constants,
  `Random(a,b)` rolls, `add`; `amountWords` says "25 + a roll of 0 to
  10"), the type is named from its bits by `damageTypeName` (0x03 edged,
  0x04 blunt, 0x08 fire, 0x20 electric, 0xC0 magical), and the victim is
  "the target", "every enemy", "everything in the effect", or — when the
  lines before the call compare the victim's square with the target's —
  "the one on the target square", which is Fireball: it hurts only the
  character it is aimed at, no splash, against its own description. The
  Spells table has a fourth column, "does". A heal's expression starts
  from the current health, so the evaluator is seeded with a zero.
  **Sleeping** is its own section: the bed class `0x100E` picks a
  quality (4 in room 2, the player's own bed; an inn's from a far-word
  table the payment fills), the helper `0xE93` passes the night a quarter
  hour at a time and then adds what the engine healed times quality/2,
  so quality 4 is three times the engine's rate; the 2012 web-board bed
  measurements (12, 10, 42, 30, 35 an hour) reproduce exactly (workbench
  `doc/game-clock.md`, "Sleep"). The smoke test pins Fireball 25 + 0–10
  fire at the target square, Death Strike 200, Lesser Healing 5 + 1–5,
  Tremor's two rolls to every enemy, and the bed's quality 4.
  **The inn qualities, v1.10.1**: a far word is (resource, offset), and
  `0x0301 0x0012` is the array `[2, 3, 1, 1]` in the global-store script
  `0x301`, indexed by the slot the innkeeper's dialogue writes to
  `0x0301 0x0016` when the room is paid for (Parium 2, Crito 1, Apis 3),
  so Crito's Titan's Head in Odemia is quality 3 (× 2.5, the 2012
  figure), the Green Goat and the Two-Tailed Rat quality 1 (× 1.5). The
  Sleeping section carries a bed table; the smoke test pins Crito at 3
  and three inns.
  **Why Tremor "does nothing", v1.10.2** (workbench
  `doc/tremor-and-enemies.md`): the Spells rules now say that damage
  without the magic bit is nothing to a monster flagged 0x0100 (the list
  is computed from `parseMonsterStats`: king, seldane, ghost, demon,
  lich), that a damage call prints nothing, and that "every enemy" is
  the executable's enemy iterator — every character on the loaded map
  whose alignment the 4×4 table at `r2 + 852` calls hostile, on screen
  or not. The smoke test requires the lich in that list. The balloon
  trace's "turn stamp" was wrong: the global is the interpreter's None.
  **Flag 12 is regeneration, v1.10.3**: `DVM_FLAG_NAMES` in
  `js/delv-script.js` gained it from the executable (`AddAbility` maps
  flag 12 to status bit 4; the cheat key option-r toggles it), the one
  entry in that table not from the community's list; the clock section
  names flags 9 and 12. The cheat keys are all read now (workbench
  `doc/cythera_keys.md`, "Cheat keys"): the code `©gra` works only when
  bit 0 of byte 3 of the four-byte "UI Prefs" record is set, which
  nothing in the game sets, so a shipped copy cannot enter cheat mode
  without the preferences file being edited.
  **The sheet's layout, v1.8.0**: one `add(id, title, icon, from, lede,
  rules, html, chips)` per section, in that order — a game tile or a nav
  icon, the title, chips to the scripts it was read from (`mechFrom`), a
  one-line lede, the rule as a `ruleList` of short items with the numbers
  in bold, then the table (`mechTable`: zebra rows, `th.num`/`td.num`
  right-aligned with tabular figures; a `#` prefix on a heading marks the
  column numeric) or a stat strip (`mechStat` pills), then a `partsStrip`
  of chips. A `mechToc` strip of `navChip`s at the top scrolls to each
  section through `mechGo(id)` — `scrollIntoView`, not an anchor, since
  the hash is the deep link. The smoke test requires the four seconds,
  fourteen `mechGo` chips and fourteen `mechSec` elements, counted while
  the sheet is showing (the grid is re-used by the next check).
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
  2 September 2026), and a browser on `ratlizard.github.io` or `file://`
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
  and which **Send that disk to the retired mobile shell** hands over directly, through a
  `handoff` store in the page's own IndexedDB, so the bytes never go near the
  file system. `buildEditedDiskImage` is split out from
  `downloadEditedDiskImage` for that reason: two callers, provably one disk.
  The window is opened *before* the write, because a pop-up blocker only
  trusts a window opened synchronously in the click that asked for it.
  `writeHfsImage` in `js/mac-hfs.js` builds a `.dsk` holding the edited
  archive with both its forks and its Finder type, a Read Me, and an
  AppleScript called **Install and Play** — `buildInstallScript`, written as
  a `TEXT` file with creator `ToyS`, which is what makes the Finder open it
  in Script Editor. Dragging the disk onto `the retired mobile shell`'s emulator mounts
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
- **`lensActive` engages on MAGNIFICATION, not on an absolute screen size,
  and the difference is a phone.** It used to be `screen px per tile >= 16`,
  which is a number for one budget rather than a rule: the base tile size is
  chosen to fit a per-device canvas budget, so the 256×256 world map comes
  back at TS=8 on a desktop — where 16 px a tile is exactly 2× and the old
  test was right — and at **TS=4 on iOS**, where 16 px a tile is 4×. A phone
  therefore spent the whole range from 4 to 16 px a tile looking at four real
  pixels stretched over each one with no lens in sight, which is what the
  world map looked like there. `mapView.scale >= 1.5` is the same intent
  stated as what it always meant, and it is right at every budget — on a map
  whose base is already TS=20 it correctly waits far longer than the old rule
  did, rather than painting a sharper copy of something already sharp.
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
- **A pointer resting on a square says what is there** (`updateMapHover`,
  `#mapHover`, `squareCard`). The map has known who is standing where since
  the schedules were read, and the only way to ask was to click a square; on
  a map with sixty people that is sixty clicks to find one. A mouse gets it
  by resting; a finger gets it by pressing and holding (see the World tab
  notes above — the same gesture on both panels), since a `pointermove` on
  a touch screen is a drag and a tap already opens the inspector. The
  square is matched the way the inspector matches it, by the record's own
  coordinate rather than where the sprite is drawn, or the card would name
  a different person from the one the click is about to open. The
  words are markup and the sprite is appended after them with `order:-1`;
  built the other way round the card's own `innerHTML` said nothing, which no
  harness could then check.
- **`resetDerivedCaches()` is the one place archive-keyed memoisation is
  cleared. Add to it whenever you memoise anything.** The list used to be
  inline and had drifted by nine caches, so a second archive was drawn with the
  first one's sprites and populated with the first one's people. A sentinel test
  fails if a new cache is added and forgotten.
- `stopAllViewActivity()` is the matching rule for anything a view starts:
  intervals, animation frames, audio, the shared `IntersectionObserver`.
- **A saved game opens, and is called one.** A Cythera player file (`DelP`)
  is a Delver archive with the same header and six subindexes: the party's
  records (`0xF009`), the prop list of the zone the player stands in
  (`0x81xx`), one portrait, three combat-AI resources, and two subindexes the
  scenario never has (`0x82xx`, `0xF3xx`), which delvmod's tables say nothing
  about and are left to `smartDecrypt`'s heuristic. The pstring at `0x20` —
  delvmod's `player_name`, empty in the scenario — is the name the game was
  saved under, and in all six saves in the add-ons it equals the file name;
  the status line and the title say "saved game" with it. Such a file
  **lands on Data › Data Fork** rather than the world: it has no world map,
  the atlas over it would be a zoom slider over nothing, and the sheet lists
  what it does hold with a chip to where each part is shown. The World tab
  says why when opened anyway (`renderAtlasBar`). A bare save gets the
  Finder identity `DelP` under its own name (`ARCHIVE_FINDER`), derived on
  every bare open rather than only the first, so a save dropped after
  Cythera Data is not exported as "Cythera Data" and the reverse does not
  hold either. Nothing draws the save *over* the scenario — that needs two
  archives open at once, which the delv-\* files cannot do (see **The
  delv-\* files are not a library**). The `saved game` section of
  `viewer_smoke.mjs` drives all of this over `I.M.Cheater`, which
  `addons_check.mjs` unpacks first.
- **No drag and drop on a touch screen.** The page-wide drop target is not
  installed on a device with no fine pointer, and a drag that starts in
  either map viewport is refused: on an iPhone a finger held on the map
  started a native drag of the canvas, which is the gesture press-and-hold
  needed. The viewports also switch off the long-press callout and text
  selection.
- **The Tools tab carries the credits**: the maintainer's handle and the
  community work the site leans on. The list was drawn up on 5 September
  2026 from what `reference/` holds and is the maintainer's to edit.
- **It wants a container, never a bare data fork, and that is deliberate.**
  The installer, a `.hqx` or a MacBinary all carry the *resource* fork, which
  a bare data fork cannot. Editor Stamps & Brushes had been in the page for a
  while and never worked for a visitor who did not hand-drop a `.hqx`. Do not
  "optimise" this back to the data fork.
- It reads both forks. The data fork is the game archive. The resource fork's
  Delver-only types (`eSTM` stamps, `eBRS` brushes) are drawn with the game's
  own tiles under **Editor Stamps & Brushes**; everything else in it — PICT,
  NFNT, clut, STR#, sfnt — is an ordinary Mac resource and is read under
  **Resource Fork** with `js/mac-rsrc-types.js`. A second gallery of the same
  shape browses the *application's* fork — 339 resources across 52 types —
  taken from the installer when the game came in that way, and otherwise
  fetched from `reference/game/Cythera.hqx` on request.
- **The forks are read by kind, and each kind has a place in the tree.**
  `RSRC_KINDS` (beside `CATEGORY_NAMES`) names the four-letter types that
  make up each kind, says in a sentence what they are — written after
  looking at every one of the 452 resources on 5 September 2026 — and says
  where the kind is shown. Both fork galleries group by it, and
  `FORK_VIEWS` is the same renderer (`renderMacRsrcSheet`) filtered to one
  or two kinds from one fork or both: that is all a Screens or Fonts or
  Cursors tab is, so no kind needed a second decoder. The places: Graphics ›
  **Screens** (the title screen, the main menu with its plank labels and
  torch frames, the DELVER stone, the paper doll, the Ambrosia logos); Text ›
  **Fonts** (Argos A Nouveau as `sfnt`, the Seldane script as two `NFNT`
  strikes, the `TxSt` styles that assign a face to each kind of text); Text
  › Labels › **Strings** (every `STR#` in both forks); Audio › SFX ›
  **Application sounds**; and Cythera (App) › **Interface** (menus, dialogs
  and windows, cursors, icons). Beyond the galleries, four joins (a fifth,
  the paper doll with the ten equipment slots at the head of Items, was
  taken out the same day at the maintainer's request; the picture is under
  Screens and the slots under Strings): the
  editor's zone list (`STR#` 135, `loadEditorZoneNames`) names every map by
  number, one ahead of its list index, and stands beside a map's label
  wherever the script's name is the generic one — "Tomb" is "Tyrant's Tomb"
  in the editor's list — with the file's spellings kept; the four default
  conversation keywords (`STR#` 128) are stated on the Dialogue gallery; the
  combat AI vocabulary (`STR#` 9300–9308, with the strategies and the
  buttons) is drawn on Data › Combat AI › Rules out of the application's
  fork, which is why that tab is no longer faded once the fork is here from
  anywhere; and the Finder icon for
  each of the installer's files comes out of the bundle (`finderIconFor`:
  `BNDL` → `FREF` → `ICN#`), so a TEXT file gets none rather than a wrong
  one. **The page's own face is the file's.** `installGameFont` takes
  `sfnt` 7289 out of the fork, `sfntToTrueType` in `js/mac-rsrc-types.js`
  adds the `OS/2` table a browser's sanitiser insists on (the resource has
  twelve tables and not that one), and the result is registered as
  `ArgosGame`, named first in every font stack with the `res/` copy behind
  it. Two decoder bugs came out of looking at every picture — a device
  colour table read by its value fields, and 16-bit `packType` 3 unpacked
  by bytes — and are recorded under **Two implementations, one format**.
  The tab icons were chosen by looking at a sheet of candidates and
  checked for repeats: World is the rolled map, Regions a small town,
  Functions a lever with the fighter, the key and the distiller's flasks
  under it, Fonts a written scroll, Screens a fresco, Interface the strange
  device, Barks a bell; only the two fork pairs share a tile, on purpose.
- **Not yet done, and the shape of it.** The `sfnt` could go the other
  way — another TrueType put in its place would change the face the game
  itself draws, since the styles name the family and not the file — but
  that needs a resource-fork *writer*, and `js/mac-resfork.js` only reads.
  The `Lite` tables (25 of them, a side length then that many squared bytes
  of falloff) are the game's own light cones, and the map's lighting layer
  still draws its own gradients. The Seldane strikes decode; nothing yet
  sets Seldane text in them. `MSta`, `FILT`, `LINF`, `DATA` and `PORT` are
  listed and unread.

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
`utilities/check_all.mjs`, `utilities/dom_stub.mjs` and
`utilities/loader_test.mjs`. When you make a non-obvious choice, write
down why, in that voice. Do not strip these comments.

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

**`reference/community/addons/` needs `unar` to open.** Twelve player-made addons —
patches, a saved game, mods — every one a StuffIt archive (`.sit`, `.sitx`,
`.sea`) that `7z` cannot read and macOS ships no extractor for. `brew install
unar`, then `unar` on the file (decode the `.hqx` wrapper with
`utilities/binhex_decode.py` first where there is one). Two are worth knowing
about:

- **`606_CheaterSavedGame`** unpacks to `I.M.Cheater`, the only complete
  Cythera player file in the repository: type `DelP`, a 332 KB Delver Archive
  in the data fork, and a resource fork with the `PICT` save preview. delvmod
  reads it. `unar` preserves the resource fork, reachable at
  `<file>/..namedfork/rsrc`.
- **The patches** are modded archives, which are the case `smartDecrypt`'s
  heuristic fallback exists for. `utilities/addons_check.mjs` is the check that
  opens them, and it also does the thing worth more: it clears the three
  tables inside the sandbox and re-runs the real `smartDecrypt` over the
  shipped archive, so the tables become a labelled corpus of 1,558 resources
  and the fallback can be scored against them.

  **It scores 62.5%**, and the breakdown says where: the structure test
  (`dvmPlausibleContainer`, `dvmNamedScript`) gets 840 of 920 right, and the
  printable-ratio-minus-entropy score gets **130 of 635** — worse than
  deciding at random. A modded archive is read substantially wrong today, and
  widening the structure test at the score test's expense is what would fix
  it. The check's floor is set at the measured number so a change that makes
  it worse fails rather than passing quietly.

  Seven of the add-ons are Delver archives, and all seven survive
  `delverArchiveSpec` → `writeDelverArchive` with every resource intact. They
  do **not** come back byte-identical, and should not be expected to: byte
  identity holds for the shipped archive because the writer's layout matches
  Ambrosia's, and it is a property of that file rather than of the format.

  **All seven open, since 4 September 2026.** `describeDelverArchive` used
  to require eight populated subindexes, which was a count standing in for a
  check: right for the game archive (34) and wrong for a saved game (six)
  and for a patch (two), so `index.html` refused every Cythera player file,
  `I.M.Cheater` included. The gate is structural now — a title, and a master
  index whose every entry, and every entry of every subindex it names, is
  either empty or inside the file — with no threshold; the comment above the
  function says why the count seemed necessary. `addons_check.mjs` fails if a
  file with a title and an index pair is refused, and it counts the files in
  the add-ons that are *not* archives and fails if none is refused, so the
  gate is tested in both directions on every run. `loader_test.mjs` proves
  the rule on the real file: one populated subindex is enough, one stray
  entry is too many. What the page does with a saved game once it is in is
  under **`index.html`** in the per-page notes.

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
- Empty `catch` blocks are common and mostly deliberate — "this optional decode
  failed, fall back" — but none of them say so on screen. 52 in index.html.
