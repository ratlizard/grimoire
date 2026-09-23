# CLAUDE.md

Guidance for AI assistants working in this repository: the constraints,
the layout, the checks and the conventions. The reasoning behind each
feature, by version, is `cythera-workbench/doc/GRIMOIRE-NOTES.md`. Read this
whole; read that by entry. **Both it and the handoff live in the private
workbench** since 14 September 2026, tracked, because this repository is
public and serves every file it commits while they carry routine names,
addresses and disassembly. This file is tracked since 19 September 2026: it
names routines and addresses too, but so do the checks beside it, and
untracked it had no history and was absent from every front, which is where
the work happens.

## What this is

**Grimoire** is a GitHub Pages static site of tools for reading, and in a
narrow way editing, the data of *Cythera* (Ambrosia Software, 1999) and of
classic Mac OS files generally. Published at
<https://ratlizard.github.io/grimoire/>. The whole of it is `index.html`,
`canvas.html`, `js/` and `utilities/`.

### The repositories

The work is split across seven, checked out flat beside each other. A session
that clones one gets none of the rest, so paths across them are never assumed.
**You are in `grimoire`.** Every other repository is read from here, never
written to:

| | |
|---|---|
| **`ratlizard/grimoire`** | **public, GitHub Pages. This one.** |
| `ratlizard/alchemy` | public. Dormant, not archived: nothing in it deploys and neither attempt is being worked on, but both may be resumed. `port/` is the native PowerPC port and still builds and passes its smoke invariants; `mobile/` is the emulator shell that used to be `mobile.html` here. Where this file says the port decodes a format differently, the detail is there. |
| `ratlizard/cythera-workbench` | private. The Python tools that analyse the executable, and the notes and handoffs of the systemless work. Nothing here depends on it. |
| `ratlizard/wolflizard` | public fork of benletchford/systemless, where running the game happens. Its HFS reader is what the disk-image writer here is round-tripped through, and its WebAssembly build is what `ratlizard.github.io` runs. |
| `ratlizard/ratlizard.github.io` | public, GitHub Pages. The browser player — the game running on the fork's WebAssembly build, at the bare `https://ratlizard.github.io/`. It was `alchemy/web/` until 8 September 2026, and it is where "play" lives now rather than here. |
| `ratlizard/delvmod` | public fork of Bryce Schroeder's reference implementation of the Delver formats — the correctness oracle for Cythera's own (see **delvmod is the correctness oracle**). It is the submodule. |

The game clock, the healing, the talk balloon, what a command spends and the
enemy table are read out of the application's PowerPC code by the page itself
(`js/mac-ppc.js`, `pefLoad`, the Mechanics sheet's `exe*` readers), each
linked to the instruction that holds it. Other findings quoted here as read
"out of the executable" — the cheat-key table, the save format — were traced
from Cythera's own binary with disassembly tooling kept outside this
repository. What those traces established is written down here, at the point
it is used; the tooling is not needed to read, run or check anything in this
tree.

`reference/` is the directory you put your own copy of the game into. It is
gitignored and supplied by you; the snapshot and oracle checks read it, and
fall back to fetching the installer when it is absent.

**The site has no build step.** No `package.json`, no lockfile, no
`requirements.txt`, no `.github/workflows`. `.nojekyll` at the root disables
Jekyll processing, so every file is served exactly as committed.

**The viewer is `index.html`**, so the site is reached at `/grimoire`. It
was `explorer.html` until September 2026, and a redirect under the old name
carried deep links over until 9 September, when it was removed: the site
had been measured to have no readers, and nothing but the retired
`alchemy/mobile/` pages linked to the old name. Every other page is reached
by its own filename.

**Pushing to `main` deploys the site.** Whatever lands in `main` is live within
a minute or two. There is no staging environment and nothing catches a broken
page for you — run the checks below before pushing.

**`cythera-workbench/doc/GRIMOIRE-NEXT.md` is this repository's handoff** —
decisions, open questions and what was learned, read in full by a session
working here and edited only by one. It never carries a tip, a version or a
count: the suite prints its own figures and the workspace's `tools/status.sh`
derives the rest. It sat here as an ignored `NEXT.md` until 14 September 2026;
see the workbench's `CLAUDE.md` for why it moved.

**GitHub Pages gives no logs and no analytics, and the site carries no
tracking.** Measured 8 September 2026 rather than assumed, and the numbers
are re-checkable at any time:

| signal | how to read it | 8 Sep 2026 |
|---|---|---|
| archive.org item `cythera-installers` | somebody got past the gate and pressed *Download and open* — the page tries this item first | **17 downloads, ever** (public since Mar 2024) |
| archive.org item `tucows_205568_Cythera` | the fallback item, mostly pre-dating us | 354 since 2004 |
| `gh api repos/ratlizard/grimoire/traffic/views` | views of the **repository page on github.com**, not of the site; 14-day window, needs push access | 13 views, **1 unique** |
| stars / forks / watchers | — | 0 / 0 / 0 |

The archive.org count is the usable one, and it is a floor: a remembered copy
in IndexedDB, `?src=`, and a dropped file all bypass the download, our own
`utilities/fetch_game.mjs` inflates it, and the item belongs to a third-party
uploader so there is no per-day page to reach. The repo's *clones* figure
(433, 114 unique in the same fortnight) is mirrors and crawlers, not readers —
one human viewed the page in that window.

**Two conclusions were drawn from that and both are standing decisions.**
Nobody is using the site yet, which is the footing the maintainer's
*push without asking* rule rests on; re-check the installer count before
assuming it still holds. And the site stays on GitHub Pages: Netlify's
analytics is paid, Cloudflare's free tier is a beacon script you could add
here without moving, and moving would change the URL, which the deep-link
design (`#c=135&r=8801`) exists to protect. If page views are ever wanted, a cookieless script tag is the whole
of the change and it does not cross the no-build-step line.

The maintainer asked on 5 September 2026 to be credited under the handle
**EgadZoundsGadzooks**; it is a handle, not a name, and it appears in the
page's footer credits and nowhere else (it was on the Tools tab until
8 September, when the two credit lists became one).

**The site has a version**, `GRIMOIRE_VERSION` in `index.html`, shown at the
top of the page as "Grimoire v1.0.0". It began at 1.0.0 on 5 September 2026,
two days after the site went public. Bump it by hand in the commit that
changes what a visitor sees: the middle number for a feature, the last for a
fix. It was checked by nothing until 14 September 2026 — no utility in
`utilities/` so much as mentioned `GRIMOIRE_VERSION` — so it was easy to
forget, and it was forgotten: the five section moves of 13 September shipped
while the page still said 1.66.0. **`utilities/version_check.mjs` is what
reads it now**: it compares this tree against `origin/main` and fails if any
of `index.html`, `canvas.html`, `js/` or `res/` differs while the number does
not, or if the number goes backwards. It judges nothing else — feature against
fix is still the author's call — and it skips, saying so, outside a git
checkout or without a baseline ref, which is what a session handed the files
without their history has. Its own first run reported a skip when it should
have failed, because `git show <ref>:index.html` returns 1.4 MB and Node's
default pipe buffer is 1 MB; the `maxBuffer` and the failure-rather-than-skip
in that file are both from that hour.

## Working beside the forks

Two other repositories are read while working here and neither is ever
written to. **delvmod** is the correctness oracle for Cythera's own formats;
**wolflizard** — the fork of benletchford/systemless, and the checkout is
`wolflizard/` since 8 September 2026 — is where running the game moved, and
its HFS reader is what the disk-image writer is round-tripped through. Both are forks under `ratlizard/`. They are inputs: a fix to
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
| `../delvmod`, `../wolflizard` | plain sibling clones — what a Claude Code web session has, since those clone each repository flat into one directory |

`$DELVMOD` and `$SYSTEMLESS` override for a copy kept
anywhere else. Every candidate is resolved against the repository root, so the
suite gives the same answer from `grimoire/` and from the directory above it —
which it did not before August 2026, and a session whose working directory is
the parent of all seven checkouts is the ordinary case now.

Three things about that arrangement are worth knowing before reading a skip as
a failure:

- **wolflizard's `examples/hfs_dump` is on the `cythera-detailed` branch**,
  not on `master`. `hfs_check.mjs` needs it for the round trip through that
  project's HFS reader, so a checkout sitting on the default branch has the
  reader (`src/disk_image/hfs.rs`) and no way to call it. The check names the
  missing file and still runs its structural half, which is most of it.
- **The game is in none of them, and the suite now feeds itself anyway.**
  `reference/` is gitignored, so a session that was handed only the
  repositories has no Cythera in it. `utilities/fetch_game.mjs` pulls the
  28 MB installer from archive.org's `/cors/` path into `$TMPDIR` and builds
  the four fork files out of it, so a checkout with no `reference/` runs
  everything but two checks (measured 4 September as **16 ok, 0 failed,
  2 skipped**, with the delvmod and wolflizard siblings beside it and 18
  checks in the suite; the suite has grown since, and the clean-run figure it
  prints at the end is the one to subtract two from) — both snapshots among
  the ones that run,
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
js/                         classic scripts, three tiers (see below)
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

`js/` has three tiers, and the difference matters when deciding where something
belongs.

**Generic classic-Mac formats** — nothing here knows Cythera exists, and that
is worth keeping true even though only one page loads them now. `index.html`
loads all twelve, in this order, before the two tiers below:

| File | Purpose |
|---|---|
| `js/mac-bytes.js` | big-endian readers, Mac Roman, CRC-32, `safeFileName`. **First** — everything else needs it. |
| `js/mac-containers.js` | BinHex 4.0 (`.hqx`), MacBinary, AppleSingle/Double unwrapping → `{kind, name, type, creator, data, rsrc}` |
| `js/mac-resfork.js` | `openResourceFork(bytes)` → a fork object (not globals, so two forks can be open at once), and since 6 September 2026 `writeResourceFork(resources)` / `resourceForkSpec(fork)` the other way — both of the game's forks re-serialize byte for byte |
| `js/mac-media.js` | decoded pixels/samples → WAV and hand-written indexed PNG (colour-type 3 + PLTE/tRNS, so the CLUT survives byte for byte) |
| `js/mac-rsrc-types.js` | decoders for what is *inside* a fork: PICT, snd, NFNT, clut, cicn, crsr, ICN#, STR#, vers, DITL, MENU, cfrg, 68K CODE… |
| `js/mac-export.js` | store-only ZIP writer + browser download helpers |
| `js/mac-hfs.js` | `writeHfsImage()` — a classic HFS volume with both forks, for the emulator to mount |
| `js/mac-stuffit.js` | `parseStuffItArchive()` / `stuffItFork()` — the catalog of a StuffIt 5 or classic `SIT!` archive and any fork in it that is stored or compressed with method 13 or 15, Arsenic (`sit13Decompress`, `arsenicDecompress`, both ported from stuffit-rs); any other method is refused by name |
| `js/mac-vise.js` | `parseViseArchive()` / `viseExtract()` — an Installer VISE 3 archive (Cythera's installer), every file with both forks; its own raw DEFLATE inflater. `sniffViseInstaller` finds one bare, in a container, or stored in a StuffIt archive |
| `js/mac-zip.js` | `parseZipArchive()` / `zipFork()` — a zip archive's entries, stored or deflated (through `inflateRaw` above) and held to their CRC-32, each joined to the AppleDouble a Mac zips beside it, so an entry carries its resource fork and Finder type and creator. Encrypted entries, Zip64 and other methods are refused by name. Not vendored by the player, whose page defines an async `inflateRaw` of its own |
| `js/mac-pef.js` | `parsePEF()` — a PowerPC application's data fork: the container's sections, the loader's imported libraries and symbols, its exports; `pefTracebacks()` walks the code section's traceback tables for every routine's offset, length and name; `pefDemangle()` reads CodeWarrior's cfront-style mangling back as far as it goes; `pefLoad()` lays the program out as the loader would (the pattern-initialised data section expanded, the relocations, the TOC) and `pefPointerAt()` says what a relocated word points at. Held to the workbench's independently recovered routine list, and the loader to what a correct load of this program must give, by `pef_check.mjs` |
| `js/mac-ppc.js` | `ppcDecode(word)` — a PowerPC instruction: mnemonic, operands in LLVM's spelling, and the fields a reader tests. The 32-bit instructions a classic Mac compiler emits; null for the rest. Held to LLVM's disassembler word for word by `ppc_check.mjs` |

**Cythera's own formats** — loaded after those twelve, by `index.html`:

| File | Purpose |
|---|---|
| `js/delv-archive.js` | master index, `getResourceBytes`, `smartDecrypt`, the record parsers (maps, prop lists, character records, schedules, string tables) and the writers that invert them |
| `js/delv-graphics.js` | `PALETTE`, `decompressDCG`, `decodeResource`, the undither filter |
| `js/delv-script.js` | the Delver VM: `dvmWord`, the opcode table, the symbol tables, `dvmDisassemble`, `dvmRender` |
| `js/delv-mechanics.js` | the *rules* as models — the dice game enumerated, the combat margin convolved, the lock and casting odds, the clock's healing and a night's sleep. Numbers to numbers, no DOM and no archive; the figures that draw them are in the page. Cross-checked by `utilities/mech_check.mjs` |

**The page's own furniture** — loaded last, because it is the only tier that
knows the document exists. Added 13 September 2026, when the maintainer asked
why everything was being dumped into `index.html`:

| File | Purpose |
|---|---|
| `js/delv-sheets.js` | `mechSectionEl()` — one section of a rules sheet as a `<details>`, buildable from any renderer; the string builders the sections are written with (`mechTable`, `mechNum`, `mechStat`, `mechSrc`); `MECH_GROUPS`, which says how the Mechanics sheet is arranged; the five sections that left it for the sheet they describe (`spellsMechSection`, `skillsMechSection`, `balloonsMechSection`, `libraryMechSection`, `talkMechSection`) with `mechCardAboveGallery` to seat one above a gallery's tiles; and `MECH_MOVED` with `tabLink`/`cardLink`/`ruleLink`, which is how a link reaches a section that is no longer on Mechanics. Reads no archive: it turns figures already read into a card |
| `js/delv-mapview.js` | What the zone view draws over itself and the controls that choose it: `MAP_PATH_WHO`, `setMapPathWho`, `refreshPathPicker`, and `drawSchedulePath()` — one character's day drawn into whichever context `drawMapMarks` is filling, so it works on the mark layer, the detail lens and the PNG export alike. Reads no archive itself; the readers it calls (`loadSchedules`, `findPath`, `buildPropBlockers`) stay in the page |

The line in **Where new code goes** below is about the DOM, and it is there to
keep the decoders checkable against delvmod — not to keep the page one file.
A builder that arranges what a reader has already read is not a decoder, and
`index.html` was some 24,000 lines with every sheet inside it until
16 September 2026, when the inline script was cut into the fourteen
`js/page-*.js` files below, at its own section banners and nowhere else.
`index.html` is now the CSS, the markup, the script tags, and one short
inline script holding `GRIMOIRE_VERSION` and the brand line (the version
check reads the constant from the page; the brand line runs at load and
needs the files before it).

**The page's own script**, in fourteen files loaded in this order after
`js/delv-mapview.js`. Same scope, same rules: classic scripts, one global
scope, so a name declared in any of them is reachable from all, and the order
only decides what has run when a statement runs at load time. Where a
function lives is where it was in the one file; move one only with a reason.

| File | Purpose |
|---|---|
| `js/page-labels.js` | names and labels for resources, `decodeSound`, the undither switch |
| `js/page-props.js` | prop types, item classes, the aspect rule, the prop word |
| `js/page-fork.js` | the resource fork's sheets: the game's font, the Seldane strikes, the dialogue box, the rest of the fork |
| `js/page-archive.js` | opening an archive, `resetDerivedCaches`, remembering the archive, deep links, back |
| `js/page-map.js` | the map renderer: terrain, faux props, roofs, `drawLighting`, exits, sitting, the square you clicked |
| `js/page-inspector.js` | the map viewport, clicking the map, containers, the world map's towns and country |
| `js/page-atlas.js` | the atlas |
| `js/page-tabs.js` | cross-references, the script view, concept search, the linked view, the tab tree |
| `js/page-data.js` | the Data sheets: zone backdrops, the executable's keys and preferences record, cheats, saved game, installer, combat AI, changes |
| `js/page-rules.js` | the rule readers (`diceGame`, `combatRules`, `exeClockRules` and the rest) that the Mechanics, Skills, Spells and Barks sheets state |
| `js/page-mechanics.js` | the Mechanics figures, the patches and compare tools, `renderMechanicsSheet` |
| `js/page-views.js` | the executable's sheet, Tools, parts and uses, monsters, the text and conversation views, editing |
| `js/page-export.js` | the preferences file, the disk image, the zip, MIDI, GIF and PNG |
| `js/page-galleries.js` | bulk export, gallery arrangement, the sprite zoom, text editing, the ditherizer, locks, lazy tiles, the keyboard, the boot |

The harnesses did not change for this: `utilities/page_scripts.mjs` collects
every `<script>` in document order, which is also why they cannot see a
load-order fault -- they run the scripts as one string, where a function
hoists across the whole. A load-order check is a real browser: headless
Chrome on `index.html` with `--enable-logging=stderr`, reading the console
and the brand line.

**The delv-* tier takes the archive as an argument.** Since 18 September
2026 `openDelverArchive(bytes)` in `js/delv-archive.js` returns the open
archive as an object, `{ bytes, index, derived }`, and every reader in the
tier takes it first: `getResourceBytes(arc, resid)`, `decodeResource(arc,
...)`, `dvmRender(arc, ...)`, `getTileAttributes(arc)`. The tables the tier
builds from an archive live on it, under `derivedTable(arc, key, build)`, and
go when it does; the page's open file is `ARCHIVE` in `js/page-archive.js`,
assigned by `parseArchiveBytes` and nowhere else, and a harness opens
whichever archive it is checking (`__bind` in the epilogues). The one thing
the tier still holds as state is the disassembler's symbol table,
`dvmSetResourceSymbols`, handed to it by whoever opens an archive, because
`dvmDisassemble` runs deep inside renders that carry no archive. Before that
day the two were `fileBytes` and `masterIndexGlobal`, ambient globals of the
tier that `resetDerivedCaches()` had to know every memo of by name. The
page's own tables followed on 19 September 2026: `DERIVED.SCHEDULES` and
forty-odd others, and the map's Maps declared as `derivedMap('name')`, live
on the archive's `derived` too (the two helpers are at the top of
`js/page-labels.js`, the first page file, since the Maps are declared at
load). What `resetDerivedCaches()` still clears is state, not tables: where
the visitor stands, what they edited, which fork is shown. A new table the
page derives from the file goes on `DERIVED`, never on `window`.

These came out of three different pages for three different reasons. The
mac-bytes/containers/media/export four existed twice, once each in the viewer
and in a resource-fork browser that has since been retired, and the copies had
drifted — each carried a fix the other lacked, and the Mac Roman table existed
three times across two files. `mac-rsrc-types.js` *was* that browser: the page
was more general-purpose than this repository, so its decoders came here and
the page went. The delv-* three had no duplication at all; they came out
because a 9,881-line inline script cannot be read, and because the checks had
nothing to point at. The cost of all of it is the same and is honest: **this is
a folder now, not a file you can email.** Re-inlining the twelve would be
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
declaration between files. `verify_viewer.mjs` catches both a name that
resolves nowhere (check 4b) and, since 18 September 2026, a top-level
function declared in two scripts (check 4c): its first run found `encodeGIF`
declared in `js/mac-rsrc-types.js` and again in `js/page-export.js`, the
later one winning and the earlier dead since the 16th.

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
node utilities/check_all.mjs            # everything, one table, about 80 seconds, four checks at a time
node utilities/check_all.mjs --quick    # skip the slow browser-ish smokes
node utilities/check_all.mjs viewer     # the one page there is
CHECK_JOBS=1 node utilities/check_all.mjs   # one check at a time, as before 18 September 2026
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

- **systemless** — a checkout of `ratlizard/wolflizard`, used by `hfs_check.mjs`
  for the disk-image round trip. Found at `wolflizard` or `../wolflizard`, and
  then at `systemless` or `../systemless` — the fork was renamed on 8 September
  2026 and a checkout made before that is still the directory `systemless/`,
  which `check_all.mjs` still accepts. Or
  through `$SYSTEMLESS`; without it the structural half of that check still
  runs. It builds `examples/hfs_dump` on first use, which takes about a minute
  and then stays built — the check is marked slow for that reason and
  `--quick` skips it.

A check whose inputs are genuinely missing is reported as **skip**, not fail.
A clean run is **29 ok, 0 failed, 0 skipped**. Anything else is a
regression. **This number has gone stale five times**, always on the day a
check was added and always silently, so `check_all.mjs` now prints the
sentence this paragraph should carry: paste it in rather than counting by
hand. Without the game in `reference/` most checks skip, and `delvmod
write` and `disk image` are the two checks with an oracle still running — its synthetic archives are built on the fly. `dialogue vs
guides` has a second, optional input of its own — the community's dialogue
collection at `reference/community/guides-site/dialogue/Dialogue` (the ZIP
from cytheraguides.com, unpacked) — and runs its structural half without it.

Two of the checks report a hash rather than a figure, so that a deliberate
change to what a decoder outputs can be told from an accident: `viewer /
decoder snapshot` and `viewer / resource snapshot`.

**The expected value lives in `utilities/check_all.mjs`, beside the check, and
a mismatch is a failure.** It used to be written down here instead, and on
15 September 2026 that went exactly as you would expect: the signed-byte fix
to the zone lighting (v1.79.0) moved the decoder snapshot, the table here was
not updated, and the stale value then read as evidence of an accident to the
next session that looked. Five fronts landed in between without anyone
noticing the number had moved.

So the value is not repeated here, and this paragraph is the whole of what
this guide says about it. **If you change what a decoder outputs, move the
expected value in `check_all.mjs` in the same commit** -- the suite will not go
green until the code and the record agree, which is the property the old table
could not have.

Deliberately not read out of this file, which until 19 September 2026 was
untracked and absent from every front: a guard that read it would have
skipped in the one place all the work happens, and a value beside the check
that uses it is the arrangement that cannot drift.

If a snapshot *doesn't* move after you changed a decoder, the snapshot is
probably not covering it -- that has happened twice, and each time the fix was
to add a line to the snapshot rather than to trust the green result.

### How the harnesses work

All but one harness in `utilities/` run the page's real JavaScript inside a
`node:vm` against a hand-written DOM stub, so the suite stays dependency-free
and runs anywhere Node does; `browser_check.mjs` is the one that drives a
real browser. Three files are the shared machinery, and the rest are the
checks in the table. **Each harness's header comment carries its own
reasoning** -- the bug that motivated it, what it cannot see, its negative
control -- and that is where to read before changing one. The list this
section carried until 18 September 2026, a paragraph per harness, is in
`cythera-workbench/doc/GRIMOIRE-NOTES.md` under *The harness list, as the
guide carried it*.

- `page_scripts.mjs` -- collects the scripts a page actually runs, in
  document order, and throws on a module script; use `pageSource(path)`
  rather than a regex of your own, since a harness that reads only the
  inline block tests the page with its decoders missing. Also the two text
  strippers, `stripJsText` (what the code *does*) and `stripComments` (what
  the file *mentions*).
- `dom_stub.mjs` -- the minimal DOM and the one 2D canvas implementation;
  import `makeSandbox()` rather than pasting a copy, which five harnesses
  once did and three broke at once. Its `fillRect` writes real pixels (the
  colour-table swatches are read back) a row at a time through a 32-bit
  view; as a byte loop it was 70% of a four-minute smoke.
- `verify_viewer.mjs` -- static integrity, and the check that runs first.
- `smoke_boot.mjs` -- what every part of the UI smoke starts from: the page
  in the small DOM, the archive opened, the helpers. Importing it boots.

| check | file | holds |
|---|---|---|
| static | `verify_viewer.mjs` | syntax; inline handlers and JS calls name a declared function; ids looked up exist; no function declared in two scripts |
| stylesheet | `css_check.mjs` | every class the page assigns has a rule; the hooks that have none are pinned |
| unreached code | `reach_check.mjs` | every declared function is reached by the page, a handler or the player; the unreached are pinned by name |
| decoder snapshot | `decoder_snapshot.mjs` | a hash of Cythera's decoders' output, expected value in `check_all.mjs` |
| PICT BitsRect | `pict_bits_check.mjs` | the uncompressed PICT opcodes, synthetic, which no game resource reaches |
| oracle currency | `oracle_check.mjs` | the delvmod submodule is at the fork's master |
| delvmod tables | `delv_crosscheck.mjs` | the encryption lists, opcode table, symbol tables and decrypt verdicts, parsed out of delvmod's Python |
| delvmod graphics | `delv_graphics_check.mjs` + `delv_graphics_ref.py` | `decompressDCG` pixel for pixel against delvmod |
| delvmod write | `delv_write_check.mjs` + `delv_write_ref.py` | `writeDelverArchive` byte for byte against `Archive.to_file`; the record writers against their parsers |
| delvmod disassembly | `delv_dasm_check.mjs` + `delv_dasm_ref.py` | `dvmDisassemble`'s decode events against ddasm over every script, divergences pinned |
| dialogue vs guides | `dialogue_check.mjs` | `dvmConversation` against the archive's structure and the community's transcription |
| archive loading | `loader_test.mjs` | unwrapping, validation, refusals, deep links and the default path |
| installer | `vise_check.mjs` | `js/mac-vise.js` against the catalog's own CRCs and the BinHex copies; StuffIt folders |
| addons + heuristic | `addons_check.mjs` | every add-on opens; the decrypt heuristic scored against the tables |
| magpie patch | `patch_check.mjs` | `mergeDelverPatch` replaces only what the patch names |
| stuffit 13 and 15 | `sit_methods_check.mjs` | both decompressors against `unar` and against each other |
| zip archives | `zip_check.mjs` | `js/mac-zip.js` against zlib, its own container, `zip`, `ditto` and `unar` |
| between releases | `releases_check.mjs` | what changed between the four releases, pinned, and the change history read against it |
| undither vs truth | `undither_check.mjs` | the undither against a known original, synthetic |
| portrait frame lock | `frame_lock_check.mjs` | the frame held byte for byte and the face still reduced, over the real archive |
| resource fork write | `resfork_write_check.mjs` | `writeResourceFork` against the two forks Apple's Resource Manager wrote |
| executable | `pef_check.mjs` | `js/mac-pef.js` against the workbench's routine list; the loader |
| powerpc decoder | `ppc_check.mjs` | `js/mac-ppc.js` against `llvm-mc`, word for word |
| rule models | `mech_check.mjs` + `mech_ref.mjs` | the closed forms against a Monte Carlo written from the prose |
| version | `version_check.mjs` | the number moved when what a visitor receives moved |
| browser | `browser_check.mjs` | the page in headless Chrome: loads clean, the archive opens over HTTP, `canvas.html` loads; then seven views at 390 px with touch emulated, none wider than the phone, tap targets under 24 px counted, and a screenshot of each in `$TMPDIR/grimoire_shots/` to look at instead of the phone |
| smoke, eight rows | `viewer_smoke.mjs` + `smoke_*.mjs` | every category, gallery and resource driven through the stub, and the sections the parts pin: `galleries` (the loop; the maps alone as `galleries-a`, the rest as `galleries-b`), `views`, `atlas`, `rules`, `edits`, `saves`, `installer`, each from a fresh boot (`smoke_boot.mjs`) as its own process; a run with no part named is the whole drive in one process. A new section goes in the part whose open file it needs: the bare archive, the save or the installer |
| bad input | `fuzz_check.mjs` | every real input corrupted from a fixed seed and handed to its entry point, each case in a worker under a deadline: a decoder may refuse, never hang or crash; a control that loops on purpose must be caught |
| in the game | `game_check.mjs` | a save edited through the page's own writer is seeded as the player file, the fork runs Cythera headless to open it and save it again, and the file the game wrote must carry the edit; the unedited seed is the control. Needs the playthrough kit, the patched fork binary and the registered licence beside the workspace, and skips without them |
| zip export | `export_test.mjs` | the exported zips unpack |
| bitmap font write | `nfnt_write_check.mjs` | the strikes written back byte for byte and as TrueType |
| resource snapshot | `rsrc_snapshot.mjs` | a hash of the classic-Mac decoders over both forks |
| disk image | `hfs_check.mjs` | `writeHfsImage` structurally, and through systemless's reader |

`ramp_patch.mjs` is a **builder, not a check**: it writes a Magpie patch that
puts every tile on the engine's cycling ramps, leans on the page's writers
by name, and what it writes is game-derived and belongs in no repository.

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
noise. `smartDecrypt` now consults those tables first and falls back to a
bank of payload-shape tests, then to byte entropy, only for subindexes the
tables say nothing about, which is what a modded archive would present.

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
`ratlizard/alchemy`, whose C++ decoders were validated the hard way, by the
original binary running against them, and systemless, which renders the same
formats in Rust. Three differences are known and recorded there rather than
here. The one that was a bug on this side — **PICT `0x0090`/`0x0091`**,
uncompressed BitsRect/BitsRgn, which `js/mac-rsrc-types.js` parsed only to
stay aligned and then walked past — is **fixed**: a picture whose artwork is a
plain BitsRect drew nothing here while the port and systemless both rendered
it. The layout was taken from `wolflizard/src/trap/pict.rs` and the port's
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

`mergeDelverPatch` in the same file is the writer's second caller and the
reason the browser player can load an add-on: a **Magpie patch** is a Delver
Archive carrying the same scenario title as `Cythera Data` and only the
resources to replace, and the merge is by resource id and nothing else. It is
safe to move a resource to a new offset because the cipher is keyed by
resource id and indexed from the start of the resource, not by file position.
It refuses a patch for another scenario, refuses a saved game (`DelP` is the
type of both, and a non-empty player name at 0x20 is the difference), and
reports rather than adds an id the base archive does not have — the Pumpkin
Patch carries exactly one, `0xFFFF`, which is Magpie's own bookkeeping.
`patch_check.mjs` is its check.

**If you change a decoder here, say in the commit message whether the other
implementations have the same bug.** No suite will tell you.

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

### `index.html`

- The Delver-format half of it lives in `js/delv-archive.js`,
  `js/delv-graphics.js` and `js/delv-script.js`; the page holds the UI, the
  rendering, and the ~7,700 lines that need a document. See **Where new code
  goes** above before adding to either side.
- **The reasoning is in `cythera-workbench/doc/GRIMOIRE-NOTES.md`**, one entry per
  feature or version, newest last: what was built, why it is shaped as it
  is, what was tried and rejected, and what the smoke pins. Read the entry
  for the area being touched before changing it; write the entry for a
  change there, not here. This file holds only what applies to every
  change.

### `canvas.html`

- **One page, three columns, no paragraphs.** A toolbox of seven icons on
  the left, the picture, and one panel on the right holding the ink and
  the options of the tool in hand — its name and one line at the top, then
  only the fields it reads (`USES`). Everything a control does is a hover
  `title`; the long form is the "?" dialog and nowhere else. The previous
  layout (6 September 2026) had a tool picker dialog, a floating tip under a
  row of eight creatures, and a paragraph beside half the controls, and the
  maintainer called it a hot mess. On a phone the dock along the bottom is
  the ink row and the tool row, and the options open as a sheet over the
  picture (`body.sheet`), which is the arrangement that keeps the canvas
  the same size whatever is opened.
- **Two creatures, and they are the game's own sprites.** Giant Slug (prop
  type 208, sheet 0x8E58, eight frames as four facings of two) and Hydra
  Polyp (prop type 277, tile 0x7D4 on sheet 0x8E7D, four frames of the
  arms waving) travel as their indexed pixels, deflated and base64'd like
  the example scenes (`SLUG_Z`, `POLYP_Z`), and are drawn through the
  game's CLUT so a depth change never recolours the toolbox. Off, a
  creature is the outline of its silhouette in the muted ink; on, the
  sprite in colour, stepping through its frames on a beat of its own
  (`CREATURES`, `drawCreature`, `paintCreatures`). The six other creatures
  — ratlizard, chicken, crab, crystal ball, ghost, skeleton — are gone, and
  with them every branch they put in `lay()`, `dab()`, `divert()` and
  `frameMap()`. The pixels were extracted with the viewer's own decoders
  driven the way `decoder_snapshot.mjs` drives them; re-extract the same
  way if a frame is ever wrong.
- **`browser_check.mjs` loads it and requires no console error**, since
  18 September 2026, and that is the whole of what the suite asks of it.
  What was done for its layout, on 6 September 2026, was to drive it in
  Chromium through Playwright — every tool under both inks, both creatures
  on and off, the menus, the four dialogs, three themes, and screenshots at
  desktop, phone portrait and phone landscape — and read the screenshots.
  Do the same before pushing a change to how it looks.

## Licensing

`LICENSE` is GPL-3.0-or-later and covers the work here. `NOTICE` says what
the licence does not cover, and that list is the one to keep accurate:
Cythera itself (not in this repository at all), the four game-derived files
in `res/`, and `delvmod/`, which is GPLv3 and referenced as a submodule.

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
`.skillKey`, `.mechSub`, the chips' second lines) are a neutral grey,
`#b5b2a8` or `#8c8980`, so no label is gold-tinted enough to read as a link.
Every `text-transform:uppercase` in the sheet went the same day — Argos in
capitals is hard to read — save the two-letter `.guessTag`, which is in a
system font. Keep to it when adding a rule: a new colour is one of white,
`--gold` or the two greys.

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
section says where its figures come from and states none. A listing
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

**`reference/community/addons/` is mostly opened by the page, and the rest by
`unar`.** The player-made add-ons — patches, saved games, mods — are StuffIt
archives (`.sit`, `.sitx`, `.sea`) but for one `.zip`, and `7z` cannot read
StuffIt and macOS ships no extractor for it.

Since 15 September 2026 `js/mac-stuffit.js` decompresses **method 13** and
since 16 September **method 15, Arsenic**, which between them are every
`.sit` there: a dropped `614_MagpiePumpkinPatch.sit.hqx` opens the patch
inside it with no unpacking at all, and so do Pandora's Box, 3D Cursors,
`606_CheaterSavedGame` and the menu patch and its unpatcher, as well as every
fork of the installers and the four-in-one bundle. Since 16 September the
page reads zips too (`js/mac-zip.js`), which opens the Rocky the Flying
Chicken add-on. **The page does not open the rest**: three StuffIt X archives
(`.sitx`) and a Compact Pro self-extracting archive (`.sea`), both of which
it names when refusing. They were judged not worth porting on 16 September
2026 -- the `.sitx` files hold three saves, the `.sea` a desktop theme with
no game data -- so `unar` is how those are opened here:
`brew install unar`, then `unar` on the file (decode an `.hqx` wrapper with
`utilities/binhex_decode.py` first where there is one). Two are worth
knowing about:

- **`606_CheaterSavedGame`** unpacks to `I.M.Cheater`, the saved game the
  suite opens (`SAVE` in `check_all.mjs`): type `DelP`, a 332 KB Delver
  Archive in the data fork, and a resource fork with the `PICT` save preview.
  delvmod reads it. `unar` preserves the resource fork, reachable at
  `<file>/..namedfork/rsrc`. It is not the only complete player file here:
  `616_Rocky_the_Flying_Chicken.zip` holds two, and `618_Teleporter`,
  `619_Tree` and `620_Zone` one each, every one a Delver Archive with a
  player name and a resource fork of its own. The page opens the first of
  the zip's two; the three in `.sitx` files only `unar` gets out, and
  `addons_check.mjs` names all six when it runs.
- **The patches** are modded archives, which are the case `smartDecrypt`'s
  heuristic fallback exists for. `utilities/addons_check.mjs` is the check that
  opens them, and it also does the thing worth more: it clears the three
  tables inside the sandbox and re-runs the real `smartDecrypt` over the
  shipped archive, so the tables become a labelled corpus of 1,558 resources
  and the fallback can be scored against them.

  **It agrees with the tables to within a resource**, and the run prints the
  figure and the breakdown by path — read it there rather than from any line
  of prose. Until 22 September 2026 it scored a little under two thirds,
  because everything that was not a script container fell to a printable-ratio
  score that the cipher beat by construction: an XOR keystream's output is
  uniform, so it is 37% printable at 8 bits of entropy, which outscored every
  graphic, sound and table in the archive. The fallback asks what SHAPE the
  bytes are now — `DELV_SHAPES` in `js/delv-archive.js` — and falls through to
  comparing byte entropy, which is the one statistic the cipher cannot escape.

  **Three assertions, not one**, because a percentage of the whole archive
  cannot see a single shape test die: the entropy comparison is good enough to
  cover for one. So the check also asserts that every verdict the bank reaches
  is the one the tables give — no floor, since a test firing on the wrong
  candidate is a defect — and that the bank still decides about as much of the
  archive as it does today. All three were held to a deliberate break; the
  comment beside them says which break fails which, and which plausible-looking
  break turns out not to be a control at all.

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
