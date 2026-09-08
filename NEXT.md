# grimoire — handoff

The handoff for this repository alone. Sessions working on grimoire read it;
sessions on other fronts do not. It carries decisions, open questions and what
was learned — never a tip, a version or a count, which `tools/status.sh` in the
workspace derives and the suite prints. Split out of the workspace handoff on
8 September 2026; the standing rules are in the workspace `NEXT-SESSION.md`.

## Where things stood on 8 September 2026

### `grimoire` — tip `60e5f2b` (`The snapshot table and the no-reference figure had gone stale again`, v1.26.0), pushed, deployed


Suite **20 ok, 0 failed, 0 skipped** (full run at `a601018`, 8 September
evening; it grew from 16 as the other session added checks, and the 20th is
`patch_check.mjs`, which covers `mergeDelverPatch` — the Magpie merge the
browser player calls, `87fdf34`; see the `ratlizard.github.io` section).
`check_all.mjs` now prints the figure this line should carry, so it stops
going stale (`feddbf5`). The `disk image` check reports **4 volumes
round-tripped through systemless**, which is the line to look at after the
fork's checkout moves: it falls back to a structural-only half **without
failing** if it cannot find the fork, so a green run does not by itself mean
that check ran whole. Snapshots
`e417960b5595f5f9` (decoder), unchanged, and `1b6259f21831` (resource),
which moved with the nine new fork decoders below — it was `3850dee3cd55`
before them, and the `4d4c7cf6e1b1` this brief carried was already stale.
**Pushing `main` deploys the site**, and the maintainer said on 5 September
that pushing needs no confirmation while nobody is using the site — **which
was measured on 8 September and still holds**: 17 lifetime downloads of the
archive.org item the page reaches for first, and one unique visitor on the
repo page in a fortnight. The method and the caveats are in
`grimoire/CLAUDE.md` under *GitHub Pages gives no logs and no analytics*;
re-check the installer count before assuming the rule still applies.

- **A Cythera saved game opens** (`dddadf1`) — item 3 of the 4 September
  list, closed. `describeDelverArchive` counted populated subindexes and
  wanted eight; a save has six, a patch two. The gate is structural now: a
  title, and a master index whose every entry — and every entry of every
  subindex it names — is empty or inside the file, no threshold. Tested
  against everything on disk: the eight Delver archives pass, every other
  file is refused. A save is named as one from the pstring at `0x20`
  (delvmod's `player_name`; equal to the file name in all six saves in the
  add-ons), exports as `DelP` under that name, and lands on Data › Data Fork
  because it has no world map; the World tab says why. Nothing draws the
  save *over* the scenario — that needs two archives open at once, which the
  delv-\* files cannot do. `addons_check.mjs` now fails in both directions
  (a refused archive, or no refused non-archive), `loader_test.mjs` proves
  the rule on the real file, and `viewer_smoke.mjs` has a `saved game`
  section over `I.M.Cheater`. Written up in `grimoire/CLAUDE.md` under
  *Conventions › the patches* and *Per-page notes › index.html*.
- **A remembered installer kept losing its resource fork** (`5bea6f2`). The
  maintainer saw Data › Data Fork say "no resource fork came with it" on the
  live site. First visit had the fork, every return visit did not: the
  cached record stores `rsrc: null` (the installer carries its own) and
  `adoptArchive` merged the record over what the unwrap had found, so the
  null won. The unwrap's result now wins; `loader_test.mjs` drives the
  return visit. Nothing had ever driven the remembered-copy path before.
- **Two PICT decoder bugs** (`b202dce`), found by rendering every picture
  the forks hold: a device colour table (`ctFlags` high bit) read by its
  value fields, so three 8-bit pictures were one flat colour; and 16-bit
  `packType` 3 unpacked by bytes where the runs count words. Both other
  implementations already had both right. The resource snapshot moved to
  `3850dee3cd55` for exactly those four pictures; `CLAUDE.md` records it.
- **The resource forks, read by kind** (`3c9b535`). `RSRC_KINDS` says what
  each of the 452 resources in the two forks is and where it is shown; the
  fork galleries group by it; `FORK_VIEWS` is the same renderer filtered,
  which is all the new tabs are: Graphics › **Screens**, Text › **Fonts**,
  Cythera (App) › **Interface**, plus **Strings** under Labels and
  **Application sounds** under SFX. Five joins: the editor's zone list
  (`STR#` 135, one ahead of its index) names the seventeen maps the scripts
  only describe and stands beside the label; the default keywords on
  Dialogue; the combat AI vocabulary on Rules (unfaded once the app fork is
  here); the paper doll and ten slots on Items; Finder icons on the
  installer rows from the bundle. **The page's face now comes out of the
  open file**: `sfntToTrueType` adds the `OS/2` table OTS wants and
  `installGameFont` registers it as `ArgosGame`, ahead of the `res/` copy.
  Tab icons re-chosen by eye (World is the map now); no repeats but the
  fork pairs. Written up in `grimoire/CLAUDE.md` › *Per-page notes ›
  index.html*, three new bullets. The smoke stub now moves a re-appended
  node: every tile count it had ever printed was four times the truth, and
  the walk is three times faster.
- **The World tab on a phone** (`5359694`), asked for after an iPhone 15
  juddered: one paint per frame (`schedulePaintAtlas`), one device pixel
  per CSS pixel while a finger is down, the magnified node's native art
  rasterised once into a window and blitted (`atlasDetailWindow`), the
  people on a node once per hour (`atlasFolk`). Full screen
  (`atlasToggleFull`): the real thing where the browser allows an element
  to, the panel pinned over the page where it does not (every browser on
  an iPhone). Press and hold is the hover on touch, on both panels, and
  the card says what is on the square, not only who (`squareCard`).
- **Relation chips** (the commit after): icon of the target's tab, name,
  kind, quiet hex, replacing the monospace hex-first chips. All three are
  written up in `grimoire/CLAUDE.md` › *Per-page notes › index.html*.
- **v1.0.0** (`74dd60d`), after the maintainer's iPhone round: no drag and
  drop on a touch screen (it fought press-and-hold); roofs fade over
  360–540 px where they cut at 448; **the surface rule** — a map is on the
  world only if its edge leads there, its script sets a horizon (the Temple
  sets −16), and the world draws it as a place, not a cave or hole
  (`mapIsSurface`); 17 make it, six located maps are mouths instead, the
  bridge among them at the square its edge names, named from the editor's
  list; the zoom row wraps on a dark ground (Full screen was off the right
  edge); `GRIMOIRE_VERSION` shown at the top; credits on Tools under the
  handle **EgadZoundsGadzooks**, the one name the tree carries, by request.
- **v1.0.1** (`4c1802a`): the region's unbuilt margin fades in as the roofs
  fade out (`drawWithMargin`); full screen on iPhone showed no map because
  the panel's inline `display:block` beat the flex column (`!important`
  now); the list view squashed pictures (canvas width/height freed, box
  bounded); the paper doll left the Items gallery by request.
- **v1.1.0** (`fc9b41b`): a selected or hovered character is shown by their
  portrait (`characterFace`), on the cards and both inspectors; the atlas
  inspector names whoever stands on the square.
- **v1.2.0** (`3aa7784`): Mechanics is a real sheet — the dice game read from
  `0x812` and enumerated (96/50/70, +0.306 obols a game for the player),
  and the talk balloons catalogued from every script (43 sites, 57 lines)
  with the list blocks decoded by their string pointers. The engine side
  is `cythera-workbench/doc/talk-balloons.md` (`TBark`; the TOC base
  `r2 = 0x808000` and the loader-order import mapping are the method).
- **v1.3.0** (`4a6b4c4`): Barks are Text › Barks, with a *Says* row on the
  dossier; Mechanics keeps the rule and the dice game.
- **v1.4.0** (`dcf4a3b`): Mechanics also reads weapons and armour
  (`gearTable`, fields as stored, armour points established), what each
  skill is asked about (`skillConsultations`, 12 skills by name) and karma
  (`karmaRules`: starts 55, kill table +1/+4/−10/0 by alignment, the
  priests refuse below 40). Next on the list, all script-derivable:
  experience and levels (24 `GainExp` sites, the level helpers `0xE86`,
  `0xE8B`), food and potions (8 effect scripts), status effects (19
  `StatusEffect` calls), lockpicking (`PickLock` `0xE43`), shop prices and
  training (vendor dialogues). Engine-only: spell costs, combat rolls,
  hunger rate, bark timing.
- **v1.5.0** (`5b8f733`): Mechanics also reads experience and levels
  (`experienceRules`: cap 65,535, level up past 100·2^(level−1), health and
  magic recomputed, 34 fixed awards), food and potions (`foodRules`: the
  eight potions by aspect, foods by nutrition, the foodstuff class per
  variant) and status effects (`statusRules`: 12 statuses, applied and
  cleared). Left on the list: lockpicking (`0xE43`), shop prices, training.
- **v1.6.0** (`8505f1f`): the list is done — locks (`lockRules`), 23 shops
  (`shopRules`) and 10 teachers (`trainingRules`), on a shared reader
  for script data blocks (`dvmDataValue`, `dvmCallSites`). Mechanics now
  has ten sections read on the spot. What is left is not in the scripts:
  spell costs, combat rolls, hunger rate, bark timing — the executable's,
  reachable the way the balloon rendering was (workbench
  `doc/talk-balloons.md`).
- **v1.7.0** (`916a102`): three of those four were scripts after all —
  combat (`combatRules`: `0xE88`/`0xE89`/`0xE87`, d30 rolls, parry,
  the blow words), which also **named the weapon fields** (melee = damage,
  reach, type, skill, sounds, effect; `ITEM_FIELD_INFO` and `gearTable`
  updated), spells (`spellRules`: 49, level and cost off each `CastSpell`,
  the failure rule from `0xEA1`), and hunger (`hungerNotes`: nothing in
  the scripts lowers nutrition). Thirteen sections now. Only the hunger
  rate and the balloon's lifetime remain in the executable.
- **v1.8.0** (`423d3b7`): **the Mechanics sheet restyled** — a section per
  rule (tile, title, chips to the scripts it was read from, a one-line
  lede, the rule as short items with the numbers in bold, then a zebra
  table with numeric columns right-aligned or a strip of stat pills), a
  contents strip of chips at the top that scrolls to each section
  (`mechGo`, no hash change). And **the balloon lifetime is read from the
  executable: four seconds** — `TBark::SetBark` returns `TickCount()`
  plus 240, `TActiveMonster::ShowBarks` removes a bark whose expiry the
  tick count has reached (workbench `doc/talk-balloons.md`, "How long it
  stays"; neither routine is reached by a direct `bl`, so a scan for
  callers found none). **Only the hunger rate remains in the
  executable**: no symbol is named for it and the tick routines
  (`TGameSys::HeartBeat`, `TGameViewer::DoTicks`, `TActiveMonster::DoTick`,
  `cbpasstime`) showed no decrement in the time given; a whole-code
  disassembly with `pefdisasm.py` (twelve minutes) produced nothing —
  disassemble a routine at a time.
- **v1.9.0** (`edf0dbf`): **the hunger rate is read** — nutrition is byte
  27 of the character record and `TGameViewer::DoTicks` takes one off
  every game hour; the clock counts 1/4096 of an hour, a step is one
  unit; a fed character heals one health and one magic at a period by
  level; poison takes one health every six minutes, death at 1. The
  sheet's Hunger section became "Hunger and healing", a "The clock,
  poison and time" section replaced "Not in the scripts", and status
  durations are now in time. The trace, with **the patch points for
  changing the rate** (one-instruction writes in the PEF code section,
  file offset `0x3470 + address` of the application's data fork; the
  period table itself is pattern-packed and cannot be patched in place),
  is workbench `doc/game-clock.md`. Two tool facts: **the workbench's
  `pefreloc_sim.py` expanded the pattern data wrongly** (opcodes 3 and 4;
  its data section was garbage past the import slots) and is fixed, the
  entry vector now validates and confirms `r2 = 0x808000`; and a
  `bl` lands 4 bytes before the symbol-table address of its target, so
  scan for `target - 4`. A page-side executable patcher ("Tweaks": open
  the application, check the four bytes, write, export) is a feature
  candidate; the 68K `CODE` copy would need its own addresses.
- **Checked against the community's questions** (workbench
  `doc/game-clock.md`, "Sleep" and "Fireball"): the 2012 bed measurements
  on the web board (topics 1949/1951) are reproduced to the point — the
  bed script multiplies the engine's regeneration by 1 + quality/2
  (own bed 4, Titan's Head 3), Omen's ring is status bit 4 (one health
  per six minutes, no food needed), and the level-6-or-7 base of four an
  hour; Fireball hurts only the character on the target square, 25 + d10
  fire, no splash.
- **v1.10.0** (`c4c0f57`): both on the site — a "does" column on the Spells
  table (`spellEffects`: damage amount, type by bits, who it reaches;
  heals) and a Sleeping section (`sleepRules`). Sixteen sections. The inn
  quality table is read now.
- **v1.10.1** (`fff0316`): a far word is (resource, offset); `0x0301 0x0012`
  is the array `[2, 3, 1, 1]` in the global-store script `0x301`, indexed
  by the slot each innkeeper's dialogue writes when the room is paid for.
  The Titan's Head (Crito, Odemia) is quality 3, × 2.5 — the 2012 figure
  again — and the Green Goat and Two-Tailed Rat quality 1, × 1.5. The
  Sleeping section has a bed table.
- **v1.10.2** (`c336d43`): a Discord report that Tremor only shakes the
  screen, checked (workbench `doc/tremor-and-enemies.md`): it does 20 +
  2d10 blunt to every enemy the executable's iterator yields — every
  character on the loaded map whose alignment the 4×4 table at
  `r2 + 852` calls hostile, on screen or not — but prints nothing, and
  the default `ResistDamage` returns zero for any non-magical type
  against the five monsters flagged 0x0100 (king, seldane, ghost, demon,
  lich), which is what a level-8 spell gets cast at. The Spells rules
  say so. Also corrected: the balloon trace's "turn stamp" is the
  interpreter's None (`r2 - 30416`).
- **v1.10.3** (`2960eab`) and workbench `doc/cythera_keys.md` "Cheat keys":
  **all seventeen cheat keys are read** (jump to level/x/y, take
  teleporter n, create any prop into the hero's inventory, inspect a prop
  record, print position and clock, pass a quarter hour, darken/brighten,
  magic map, two debug bitmaps, walk through walls, everyone hostile,
  night vision, regeneration, and one that does nothing because it acts
  on character 0). **The cheat code `©gra` is dead on a shipped copy**:
  it is gated on bit 0 of byte 3 of the 4-byte "UI Prefs" record, which
  no UI writes and all three CPU-chosen defaults leave clear; editing the
  preferences file is the only way in — a page-side "enable cheat mode"
  tool would be one byte. Also: option-space toggles turn-based movement,
  the speed limiter key compares `$C1` (option-1, not option-l — try it),
  typing play/stop/paus/next/prev/ejec drives the CD, `{` `}` its volume.
  Flag 12 is regeneration (`DVM_FLAG_NAMES`), from `AddAbility`. The
  maintainer reviews every revision on an iPhone as it lands.
- **v1.11.0** (`c4f91db`), three World-tab asks of 6 September: full screen
  is the map alone with a corner overlay (place name, Leave, ↰ below
  ground); names come from the maps' own scripts (`atlasMapName`, the
  editor's name only after a shared one), so "Land King Hall" not "LKH";
  mouths open at 20 px a square (`descendAt`) rather than the last notch
  of zoom, which is what kept the hole in Land King Hall from ever
  opening. Land King Hall itself stays a mouth — the file calls it an
  interior (backdrop −1, no world anchor).
- **v1.12.0** (`411cab9`): v1.11.0's descend was "way too sensitive" and
  re-entered on the way out. Now a zoom is judged when the gesture ends
  (pinch/drag to last finger up; wheel or slider until a 180 ms pause),
  only in the direction it went; a mouth opens when its square fills a
  tenth of the screen, centred; the fall in and the rise out are drawn
  (`atlasFallInto`, `atlasRiseOut`, `animMs` 550), arriving at half the
  zoom each way. "Names from outside the game’s own text" is on by
  default and the world never doubles a name.
- **v1.12.1** (`37b8428`): the fall accelerates the whole way (t³) into a
  single art pixel of the hole; the World tab is black; the sea outside
  the island is the world's own border tile as a pattern. **Open question
  from the maintainer**: the landing downloads
  the installer from archive.org without asking and nothing tells a
  visitor the world can be pinched, tapped and held.
- **v1.13.0** (`7c4b3d1`): **the gate is built** — one screen before the
  network download (28 MB installer from archive.org, said plainly),
  with the map's gestures on it, "Download and open" and "I have the
  game’s files"; a remembered copy passes without it, `?src=` skips it.
  The fall fades to black over a second and the place below opens from a
  dot on its entry square.
- **v1.14.0** (`dbe627a`): a zoom goes nowhere by itself; rings are taken
  by a tap, from wherever the view is; below ground every exit is a ring
  (gold down, blue-with-arrow up, `atlasRiseVia`). The world is drawn
  whole (the prop-box clip was cutting the island's top and bottom rows
  when zoomed out) and the sea outside it is one plain colour, the
  average of the sea ring inside the frame — the stub canvas is grey, so
  whether that colour reads as sea is a browser question.
- **v1.15.0** (`30d6fee`): Entities › Skills is a card per skill
  (`skillCatalogue`, `dvmDescriptionOf` with the game's inline
  "[aptitude / ability]" kept), Spells its own tab of cards by level;
  an item's frames stop at another type's base tile (the two maps); the
  springs' and Pnyx upstairs' rings are inside their towns. **Open from
  the maintainer**: "what's on the inland sand island? there was
  something there before" — it is the egg (flags 0x42) at (138,176),
  the dig spot down to Omen's test by the community walkthroughs.
- **v1.16.0** (`17df99f`): one animation setting (all/graphics/tiles/off,
  radios in the data-file menu; a `<select>` there breaks the smoke's
  markup stub); eggs as dotted rings on the atlas from 12 px a square;
  GIF export (`encodeGIF`) on the single view, a prop's frame runs and
  the ditherizer; the map PNG on iOS streamed at 32 px a square
  (`downloadMapPNGStreamed`, no lighting layer); the ditherizer's frame
  modes (0x887E inset, 0x88A2, 0x88F2) and Seldane palette. **Not done
  from that batch**: "retexturize" as a name — the maintainer asked, the
  answer was to keep Unditherize.
- **7 September, four features and a sweep** (v1.22.0 to v1.24.0, on top of
  the other session's 1.21.2). **The game's font can be swapped**:
  `trueTypeToSfnt` gives a font made this century the Mac Roman character
  map the game looks glyphs up by (format 0, or format 6 when the glyphs
  it needs are above the first 256), `swapGameFont` puts it in sfnt 7289
  of the open fork, and the disk image export already carried that fork,
  so it plays. The page re-installs its own font from it, so the site
  changes to whatever you chose. **The search answers questions**: nine
  shapes (who teaches, who sells, what it costs, what it does, what cures,
  who says, what resists, where it is, who they are), each a filter over a
  table the page builds, no model. **A walk cycle saves as a GIF.** **The
  25 light cones are read**: one byte of side then side squared bytes of
  brightness — the join to the map's lighting layer is still not made,
  which is what is left of item 3c. A sweep opened all 1,034 detail views
  and found two throws, both fixed: a character id the file does not have,
  and an empty GIF. **v1.24.1 is a pass over the UI text** on the
  maintainer's instruction: no dates or development history in the
  interface, nothing shaped for effect, no asides in dashes, text cut
  where it added nothing — and **text derived from game data left exactly
  as the file has it**. The rule is in `grimoire/CLAUDE.md`; hold to it
  for new copy.
- **Nine resource types went from a byte count to something read, v1.25.0**
  (`5d1b073`). The occasion was a question about a tile sheet a community
  member posted to Discord in July: it is `TILE` 282 out of the *application's*
  resource fork, the only resource of its type in either fork, and the page
  listed it under Engine without drawing it. `decodeTileSheetResource` in
  `js/mac-rsrc-types.js` reaches across to `decompressDCG` and
  `reshapeTileSheetGrid`, and its indices come out identical to delvmod's
  `TileSheet.get_image()` byte for byte. **None of its art is in the game** —
  against the 2,376 distinct tiles in the archive's 160 sheets only its two
  black tiles match, so it is art the executable carries and the scenario
  never draws. Also read: `TxSt` across both forks (and `TxSt` 999 as four
  palette swatches, because `RMAP` 128 says that id is really a `TxCl`),
  `Page` (the Delver engine's own help, three of thirteen with text), `MSta`
  (64 bytes of state, shown as the difference from "Base"), `Audt`, `Pref`,
  `acur` in the fork gallery, and `DATA` 260 — the editor's tile palette, 69
  of whose 75 names match 0xF004 exactly. `CMNU` and `xmnu` were attempted
  and **not** shipped; both readings and why they failed are recorded in
  `js/mac-rsrc-types.js` and under *What the forks were still hiding,
  v1.25.0* in `grimoire/CLAUDE.md`. `FILT`, `LINF`, `PORT`, `MemU` and nine
  of the ten `DATA` resources are still unread. `rsrc_snapshot.mjs` now
  covers all nine plus `Lite`, which shipped in v1.24.0 with no cover at all;
  a negative control (reading the strip 33 wide) moves the hash, so the
  coverage is real.
- **Three asks of 8 September, all shipped as v1.26.0** (`2cddaee`).
  (1) **Type is on one knob.** Every `font-size` in `index.html` and
  `canvas.html` is `rem` now and the root percentage is the only place a size
  is decided — 109% on a phone, 125% from 900px up. It was px, and the
  desktop media block had to name a selector per size: it named about forty
  and the other two hundred stayed at phone size on a 27-inch screen. Gallery
  cell heights, the grid's minimum column and the atlas's two canvas fonts
  (which no stylesheet reaches) came up with it. **The two numbers are the
  dial** — if it is too much or too little, change them, not the rules.
  (2) **A tap raises the hover card** on a touch screen, in the map panel and
  on the World tab, and it stays until the next gesture; press and hold still
  follows the finger. `placeHoverCard` is one function for both panels and a
  touched card clears the point by 64px upwards, or goes to the foot of the
  panel. Three latent bugs came out with it: `pointerleave` fires the instant
  a touch lifts and was taking the card with it, the same-square fast path
  re-placed a hidden card and showed nothing, and `#mapHover` had no
  `pointer-events:none`.
  (3) **Every passage is ringed on the World tab**, not one per destination.
  The dedupe was hiding **59 of the archive's 111** — three of Pnyx's four
  stairs among them. The **44 whose zoneport lands on the map they are
  already on** are ringed too (all of them on maps below ground), named by
  the square they land on, and taking one moves within the map
  (`atlasCrossWithin`). The arrow inside a blue ring is gone, a colliding
  label is dropped while its ring stays, and a tap takes the nearest ring.
  **What the file does not mark, so neither does the page**: no `crack` and
  no `rope bridge` anywhere carries a zoneport — the Harpy Abyss's ravine is
  40 crack props with no destination, and the four `rope` records are loose
  items in Cademia and Kosha, twelve squares and more from any passage. Two
  concealed passages do travel and are ringed: `loose dirt` on the world at
  (158,172) into the Underground, and a `small hole` in the Sewers at (50,39)
  into Odemia.
- **Who is using the site: nobody yet, and now it is a number.** GitHub Pages
  serves static files and gives no logs and no analytics, and the repository's
  Insights → Traffic measures the **repo page on github.com**, not the site.
  Three indirect signals exist and all three were pulled on 8 September:
  `cythera-installers` on archive.org — the item the gate reaches for first —
  has **17 downloads, ever**, against 354 since 2004 on the `tucows_205568_Cythera`
  fallback; the repo saw 13 views from **1 unique** visitor in fourteen days,
  referred only by github.com; 0 stars, 0 forks, 0 watchers. The 433 clones /
  114 unique in the same window are mirrors and crawlers, not readers. The
  installer count is a floor — a remembered copy, `?src=` and a dropped file
  all bypass it, `utilities/fetch_game.mjs` inflates it, and the item is a
  third party's so there is no per-day stats page.
- **Hosting: stay on GitHub Pages, decided 8 September.** Netlify Analytics is
  paid (~$9/month per site); Cloudflare's free tier is a beacon script that
  could be added to the current host without moving anything; and moving
  changes the URL, which the deep-link design and `explorer.html`'s redirect
  both exist to protect. The one thing Pages genuinely cannot do is send
  response headers — **but that is answered too**: `coi-serviceworker.js`
  gives an origin `COOP`/`COEP` without a host that can set them, the retired
  `alchemy/mobile/` attempt already did it, and `alchemy/mobile/MOBILE.md`
  carries the measurement (56,233 instructions/ms with `SharedArrayBuffer`
  against 1,896 without). `require-corp`, not `credentialless`, because Safari
  does not implement the latter. Written up in `ratlizard.github.io/CLAUDE.md`
  under *How it deploys*, because that is where it would bite if the player
  ever wants threads. **One correction on the record**: it was said in
  conversation that `COEP: require-corp` would break the page's archive.org
  fetch. It would not — COEP blocks cross-origin *no-cors* subresources with
  no `Cross-Origin-Resource-Policy`, and archive.org's `/cors/` path is a
  CORS-mode fetch, which passes.
- **Pnyx, answered.** Two maps, `0x800C` and `0x800E`; both entry scripts
  name them "Pnyx" and only the editor's `STR#` 135 calls the second "Pnyx
  Upstairs". They **do** connect directly, four pairs of stairs:
  (34,16)↔(22,4), (47,31)↔(35,19), (31,47)↔(19,35), (28,52)↔(47,37). What
  connects nothing you can walk is the **five-flight stairwell inside
  `0x800E`** at (8–11, 46–49): five stairs in one corner landing at (21,5),
  (5,56), (9,20), (33,51) and (5,55) of the same map. Those five are what
  grimoire drew nothing for, and they are the rings v1.26.0 adds.
  **Zoneport 43 is an orphan**: it lands at `0x800E` (17,41) and nothing in
  the archive points at it, where 42 and 44–47 are exactly that stairwell's
  five — a sixth flight that was cut. (17,41) has no prop on it.
- **The gate says why it fetches the whole installer, and the credits are one
  list, v1.27.1** (8 September, evening). The maintainer had asked why the
  page took the installer from archive.org unasked; an earlier session's
  answer, kept only as a note, was that Ambrosia's licence requires the work
  to be passed on whole. The clause was found and quoted rather than
  recalled: `Cythera License.text` in the installed folder's `Documentation ƒ`
  (inside `reference/game/installed-folders/Cythera Installed Folder with
  Preferences & License.sit`; `unar` opens it) permits non-profit
  distribution "providing that the software is not modified in any way, and
  the complete works of the software are included in the distribution
  package". `NOTICE` quotes it under *Why it is the whole installer*, the gate
  carries one sentence, `CLAUDE.md` says so at the installer bullet, and the
  smoke pins the sentence (negative control run: a misspelt sentence fails).
  The two credit lists, Tools and footer, named different people; they are
  one list in the footer now, the maintainer's call, and Tools keeps only the
  font readout. **The `res/` fallback font stays**, also his call: the gate
  is shown before any file is open, so without it that first screen is
  Georgia. Both of the 5 September standing questions are closed.
- **The Saved Game sheet's line for `0xF00E` was wrong, v1.27.2** (8
  September, late). It said "field 20, status_flags: one 16-bit word per
  object, so poison and sleep survive a save". The segment is one halfword
  per **room**, 1,024 rooms, and bit 0 means the room has been entered once
  and its description shown; the executable's field accessors dispatch on
  object type, and field 20 is the character record's +6 for a Character
  and this array for a Room. The trace, with the playthrough data that
  raised it (two entries moving on the return to Land King Hall, rooms 2 and
  451), is workbench `doc/save-format.md` § *The mirror question, answered*.
  Nothing else on the sheet names the segment.
- **Careful: another session is pushing to grimoire through the day.**
  Three of the four commits above needed a rebase, one with a conflict
  (the version number, which both sessions bump). Fetch before starting
  and rebase before pushing. That session corrected two things of mine:
  `Random(a,b)` stops one short of `b` (so a roll printed as 0 to 10 is
  0 to 9), and **option-h makes peace rather than war** — it short-circuits
  the enemy test to "own side" for every pair.

- **The World tab is the atlas: the world as one scene.** The renderer that
  borrowed the map panel is deleted — **1,515 lines out for 84 in** — and with
  it the cross-fade, the landing calculation, the stack, the hold, the four
  thresholds and the three implementations of "keep this layer registered with
  the map while it moves". `#atlasPanel` is its own container, a sibling of
  `#tabSheet`; the handover is two elements. The reasoning is written up in
  `grimoire/CLAUDE.md` § *Per-page notes › index.html*.
- **TEMPORARY: `window.ATLAS_TUNE` and the tuning strip** (`86e5082`). Six
  numbers decide how the atlas behaves and not one can be settled without
  looking at a real screen. `ATLAS_TUNE_ROWS` drives the strip and the smoke
  test checks every knob offered is one the renderer reads. **When the values
  are settled, delete the strip and put them back as consts with a comment
  each.** See item 1.
- **PICT `0x0090`/`0x0091` is fixed** (`e3d1b87`) — item 2 of the 3 September
  list, closed. Uncompressed BitsRect/BitsRgn now draw, following
  `wolflizard/src/trap/pict.rs` and `alchemy/port/src/mac/pict.cpp`. Its check
  is synthetic and says why: not one of the twenty-one PICTs in the two game
  files uses those opcodes, so neither snapshot could prove the path works.
- **The undither has ground truth for the first time** (`def35da`).
  `ditherToCytheraPalette` is the forward process, so an image put through it
  has a known original. `utilities/undither_check.mjs` scores over four
  sources. Three findings: the settled settings come 34th of 36 tried (a
  *measured* preset is offered beside them rather than replacing them, because
  the truth here is recovery from *this* dither and Ambrosia's art was made by
  another); `passes` is **inert** — `checkerNotch` never reads its `guide`
  argument, so passes 2–4 cost three times the work for nothing; and the
  filter was tuned on the image class carrying the least dither (portraits
  3.4%, landscapes 8.2%, misc graphics 17.9%).
- **`dialogue_check.mjs` has a second oracle** (`ffa8120`): delvmod's
  conversation decoder, independent *code* where the community's collection is
  independent *data*. They agree on all 108 characters that have
  conversations. The floor is exact agreement, not a percentage.
- **Three stale figures and one stale paragraph in `grimoire/CLAUDE.md`,
  corrected in `fc89483`, `6861df2` and `2b89e83`** (item 6 has all four): a clean run is 16 checks and not 13, PICT `0x0090`/`0x0091` is
  no longer the known bug on this side, and a checkout with **no `reference/`
  runs 14 ok, 0 failed, 2 skipped** — measured, not reasoned — where the file
  still described the state before `fetch_game.mjs` fed the suite.

## What to do next

Item numbers are the ones the workspace handoff used up to 8 September 2026, kept so that references in the docs still resolve.

1. **Settle the six atlas numbers, then delete the strip.** This needs the
   maintainer at a real screen — the numbers are all "does this feel right",
   which is not answerable from here. Ask for the six, put them back as consts
   with a comment each, delete `ATLAS_TUNE`, `ATLAS_TUNE_ROWS` and the strip,
   and drop the smoke test's knob check with them.

2. **`smartDecrypt`'s heuristic fallback scores 63.3%.** The structure test
   (`dvmPlausibleContainer`, `dvmNamedScript`) gets 840 of 918; the
   printable-ratio-minus-entropy score gets **130 of 624**, worse than
   deciding at random. (It was 62.5% over 920 and 635 until 7 September, when
   the raw-all-zero certainty took a handful of resources out of the scored
   population; `addons_check.mjs` prints the live figure, so read it there
   rather than from this line; it printed 63.3% on 8 September evening.)
   Widen the structure test at the score test's expense.
   `utilities/addons_check.mjs` sets `FLOOR` at 62.0, just under the measured
   number, so a regression of more than a point fails and an improvement
   shows in the printed line.

3. ~~`describeDelverArchive` requires eight populated subindexes.~~ **Done**,
   `dddadf1`, see the `grimoire` block above. What is left is what a save
   could *show*: its prop list drawn over the scenario's map of that zone,
   its party records beside the scenario's, a diff between two saves. All of
   it needs two archives open at once, which `getResourceBytes` reading
   `fileBytes` as an ambient global rules out today — the "not a library"
   note in `grimoire/CLAUDE.md`. Do not start that by accident.

3b. ~~**The fork, the other way.**~~ **Done, 7 September, v1.22.0.**
   `trueTypeToSfnt` + `swapGameFont` put a chosen `.ttf` in `sfnt` 7289 and
   write the fork back; the panel is at the head of Fonts, the disk image
   carries it, and the page re-installs its own font from it. The Seldane
   `NFNT` is still not editable, which is the piece of this that remains.
   The original brief follows. The maintainer's idea: another TrueType
   put in `sfnt` 7289's place would change the face the game itself draws,
   since the `TxSt` styles name the family and the `FOND` carries it. What
   it needed was a resource-fork *writer* — `js/mac-resfork.js` only read
   then; it writes now, and the `resource fork write` check rewrites both
   shipped forks byte for byte — and a "replace this resource" action on a
   fork resource; the MacBinary and disk-image exports already carry the
   fork through unchanged. The same writer would let the Seldane `NFNT` be
   edited: that part is not started.

3c. **Three fork joins not made.** The 25 `Lite` tables **are read now**
   (7 September, v1.24.0): one byte of side, then that many squared bytes
   of brightness 0 to 32, drawn in the Engine kind of the application's
   fork gallery, sides 8 to 120. What is still missing is the join: the
   map's lighting layer draws its own gradients, and which cone a given
   light uses — presumably by its reach — has not been read. The Seldane strikes decode
   and nothing sets Seldane text in them. `MSta` (three named 64-byte
   records: "Base", "Plague Cured", "Olpheltius Murdered") and `DATA` 260 are
   read since v1.25.0; `FILT`, `LINF`, `PORT`, `MemU` and nine of the ten
   `DATA` resources are listed and unread. `Dialogue_Background.png` in
   `res/` (552×336) matches no resource in either fork at that size, so it
   cannot be derived the way the font now is.

6. ~~Two stale lines in `grimoire/CLAUDE.md`.~~ **Done**, `fc89483`,
   `6861df2` and `2b89e83`. It was four. A clean run is 16 checks and not 13.
   The PICT paragraph says `0x0090`/`0x0091` is fixed rather than outstanding.
   The no-`reference/` paragraph said 9 ok / 9 skipped, where the measured
   figure is **14 ok, 0 failed, 2 skipped** at the 16-check suite — it
   described the state before `fetch_game.mjs`; the suite is 20 checks now
   and the two skips are the same two, `archive loading` and `installer`. And *Data setup* read as though a copy of the game in
   `reference/` were required, where the suite has fetched the installer from
   archive.org since 3 September. What the four have in common is that
   **nothing checks a number written into prose**: each went stale silently on
   the day a check was added, and the file read as authoritative the whole
   time. If a fifth turns up, have `check_all.mjs` print the sentence this
   file should carry rather than correcting the prose again.

## What cost the most time here

- **A comment-anchored sweep takes more than it should.** Deleting the old
  World renderer, a cut running from one comment to the next took the atlas
  panel's entire stylesheet with it, and the World tab showed a zoom slider
  over nothing. Nothing caught it: the markup was intact, every id resolved,
  every function was declared, and style is not checkable the way script is.
  That is the third such sweep; the other two took a function and left orphaned
  comments, and `verify_viewer` caught both because they were script.
- A modal alert was written down as cosmetic on the first pass. It swallowed
  every keystroke the installer sent, and the installer got the blame.
- A synthetic tap with no dwell is not a click.

