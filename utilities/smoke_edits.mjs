// smoke_edits.mjs -- one part of the UI smoke: a second archive dropping the first's tables, the reloads, the edit path, schedules, components and their owners, the hero and the combat AI, sounds and windows, the tile view, the patches section applied, the hero's colours, compare, ditherize.
// Cut out of viewer_smoke.mjs on 18 September 2026 at a point where the open
// file changes, so it runs from a fresh boot (smoke_boot.mjs) as its own
// process. Run alone with
//   node utilities/viewer_smoke.mjs index.html "$TMPDIR/Cythera Data.data" "" <installers .sit> <saved game> edits
// and with the other parts by naming them; with none named the runner drives
// all six in this process, in order.
import { htmlPath, dataPath, onlyCat, visePath, savePath, html, js, archive, rsrcPath, rsrcFork, missingIds,
         El, REGISTRY, catSel, optionSource, CATEGORY_VALUES, body, documentStub, rafQueue, drainRaf, sandbox,
         ctx, peek, fail, t0, status, A, readFileSync, existsSync, tally } from './smoke_boot.mjs';

// Opening a second archive must not leave the first one's derived tables
// behind. Sentinels survive only if something is not being reset.
try {
  // Two kinds since 19 September 2026: the tables, which live on the archive
  // object (DERIVED) and go with it, and the state resetDerivedCaches still
  // clears by name. Both are marked and neither may survive a reload.
  const tables = ['SCHEDULES', 'CHAR_TABLE', 'LIVING_PROPTYPES', '_CHAR_PROPTYPES',
                  'TERRAIN_NAMES', 'ZONE_NAMES', 'ZONEPORTS', 'STORE_SYMBOLS',
                  'XREF_INDEX', 'SCRIPT_TEXT', 'MONSTER_STATS', 'CONV_CACHE', 'PATCH_BASE_SPEC'];
  const state = ['EDITED_RESIDS', 'PATCH_REPORT', 'COMPARE_REPORT', 'COMPARE_APP', 'APP_RSRC_RAW'];
  const marked = tables.concat(state);
  for (const k of tables) peek('DERIVED')[k] = '__stale__';
  for (const k of state) ctx[k] = '__stale__';
  peek('tileCanvasCache').set(-1, '__stale__');
  A().derived.set('__stale__', 1);
  const staleArc = A();
  peek('spriteCountCache').set(-1, '__stale__');
  peek('pathCache').set('__stale__', 1);
  peek('_tileImageCache')['-1'] = '__stale__';
  ctx.parseArchiveBytes(archive, 'Cythera Data (reloaded)', { via: 'data fork' });
  const survivors = tables.filter(k => peek('DERIVED')[k] === '__stale__').concat(state.filter(k => ctx[k] === '__stale__'));
  for (const [name, present] of [
    ['tileCanvasCache', peek('tileCanvasCache').has(-1)],
    ['the archive object', A() === staleArc || A().derived.has('__stale__')],
    ['spriteCountCache', peek('spriteCountCache').has(-1)],
    ['pathCache', peek('pathCache').has('__stale__')],
    ['_tileImageCache', '-1' in peek('_tileImageCache')],
  ]) if (present) survivors.push(name);
  if (survivors.length) fail('archive swap', 'stale after reload: ' + survivors.join(', '));
  else console.log(`  archive swap: all ${marked.length + 4} derived caches were dropped`);
} catch (e) { fail('archive swap', e); }

/* The Mechanics sheet is grouped, 13 September 2026 (the maintainer's
   order). Two things can rot here without anyone noticing.

   A group naming a section that no longer exists drops silently: the
   assembly skips what it cannot find, so a renamed id would quietly empty a
   group rather than fail. And a new section nobody places lands under Other,
   which is deliberate -- better there than vanished -- but Other is meant to
   be a holding pen, not a habit.

   The ids are also the link targets: the mechLink call sites and the ids in
   SKILL_RULES name sections directly and mechGo resolves `mech-<id>`, so
   grouping must never rename one. That is what the last check here is for.

   A section that LEAVES the sheet has to leave this list with it. `spells`
   went to the Spells sheet on 13 September 2026 and is reached by tabLink
   and cardLink now, not by mechLink, so it is no longer named here. */
/* A group became a TAB on 14 September 2026, so this pin has to prove the
   gating as well as the grouping.

   REGISTRY cannot do that on its own: it is one Map for the whole run and
   never clears, so once the first tab has been drawn every section looks
   present forever, whichever tab is open. Existence is still checked through
   it -- that catches a renamed id -- but which tab a section lands on is
   judged from the freshly walked markup of that tab, by a section title the
   group owns against one belonging to another group. */
try {
  const groups = peek('MECH_GROUPS') || [];
  const walk = () => (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  ctx.showCategory('MECHANICS');
  const html = walk();
  const named = [];
  for (const g of groups) for (const id of (g.ids || [])) named.push(id);
  const dupes = named.filter((id, i) => named.indexOf(id) !== i);
  // One title each tab must show, and one it must not. Titles rather than
  // ids, because a section's id is a property the stub keeps in REGISTRY and
  // never writes into the markup.
  const MARK = {
    MECH_PROGRESS: 'Experience and levels', MECH_STATUS: 'Status effects', MECH_INTERACT: 'Locks and lockpicks',
    MECH_PUZZLES: 'The riddles', MECH_COMBAT: 'Damage to things', MECH_ECONOMY: 'The dice game',
    HACKERY: 'Loose ends',
  };
  const strayTab = [];
  for (const g of groups) {
    if (!MARK[g.value]) continue;
    ctx.showCategory(g.value);
    const h = walk();
    if (h.indexOf(MARK[g.value]) < 0) strayTab.push(g.title + ' does not show ' + MARK[g.value]);
    for (const o of groups) {
      if (o === g || !MARK[o.value]) continue;
      if (h.indexOf(MARK[o.value]) >= 0) strayTab.push(g.title + ' also shows ' + o.title + '’s ' + MARK[o.value]);
    }
  }
  // The three sections that write a file are on Tools since 22 September
  // 2026, and on no Mechanics tab.
  ctx.showCategory('TOOLS');
  const tools = walk();
  for (const t of ['The community’s patches', 'A sprite or a portrait of your own, as a patch', 'Two files against each other']) {
    if (tools.indexOf(t) < 0) strayTab.push('Tools does not show ' + t);
    ctx.showCategory('HACKERY');
    if (walk().indexOf(t) >= 0) strayTab.push('Hackery still shows ' + t);
  }
  // foldCard sets sec.id as a PROPERTY, which the stub's `set id` records in
  // REGISTRY; it never appears as an attribute in innerHTML. Grepping the
  // serialised markup for it reported all twenty-five sections missing, which
  // is the shape of a broken test rather than a broken sheet.
  const missing = named.filter(id => !REGISTRY.has('mech-' + id));
  // A section the sheet builds that no group claims. It lands on Hackery so
  // it cannot vanish, but that is a net, not a place to leave things.
  // Spelled with the window. prefix deliberately: the page assigns it as
  // window.MECH_UNPLACED, and a bare name that failed to resolve would read
  // as an empty list, which is indistinguishable from a clean result.
  const unplaced = (peek('window.MECH_UNPLACED') || []).slice();
  /* Each tab's value must index to a leaf of the tab tree.

     showCategory renders through the <select> whatever the tree says, so a
     value the tree does not claim still draws its sheet perfectly well -- with
     the tab row blank, because syncTabsTo finds no leaf and highlights
     nothing. Every other check here reads rendered markup and would see that
     as a clean pass, which is why the tree is asked directly. MECHANICS is
     deliberately absent from the tree and so is not among these. */
  const leafFor = peek('TAB_LEAF_FOR');
  const noLeaf = groups.filter(g => !(leafFor && leafFor.get && leafFor.get(g.value))).map(g => g.value);
  if (!groups.length) fail('mechanics groups', 'MECH_GROUPS is not reachable, so the sheet is ungrouped');
  else if (dupes.length) fail('mechanics groups', 'a section is in two groups: ' + dupes.join(', '));
  else if (missing.length) fail('mechanics groups', 'a group names a section the sheet does not build: ' + missing.join(', '));
  else if (!/Hackery/.test(html)) fail('mechanics groups', 'the whole sheet does not show the group headings');
  else if (noLeaf.length) fail('mechanics groups', 'a tab value is on no leaf of the tab tree, so its tab row is blank: ' + noLeaf.join(', '));
  else if (strayTab.length) fail('mechanics groups', 'a tab does not hold its own group: ' + strayTab.join('; '));
  else if (unplaced.length) fail('mechanics groups', 'a section is in no group and fell through to Hackery: ' + unplaced.join(', '));
  // Every link target must still be a section, and must route to a real tab.
  else {
    const targets = ['damage', 'status', 'target', 'shops', 'combat', 'training'];
    const lost = targets.filter(t => !REGISTRY.has('mech-' + t));
    const unrouted = targets.filter(t => !groups.some(g => (g.ids || []).indexOf(t) >= 0));
    if (lost.length) fail('mechanics groups', 'a mechLink target is no longer a section: ' + lost.join(', '));
    else if (unrouted.length) fail('mechanics groups', 'a mechLink target is on no tab, so its link opens the wrong one: ' + unrouted.join(', '));
    else console.log(`  mechanics groups: ${groups.length} tabs over ${named.length} sections, each tab holding only its own, ${targets.length} link targets routed`);
  }
} catch (e) { fail('mechanics groups', e); }

/* The sections that left the Mechanics sheet, 13 September 2026.

   A move is only real when the card is on its new sheet AND gone from the
   old one. A builder still called from both would look perfectly right on
   either sheet examined alone, which is the failure this pin exists for.

   Two guards, because the absence half is the easy one to make vacuous.
   showCategory returns false and leaves the previous sheet standing when the
   tab is not there, so an unopened tab would silently compare the wrong
   HTML twice; and if the Mechanics sheet throws, the walk returns '' and
   every "no longer on Mechanics" test passes against an empty string. The
   tab returns are checked, and Hackery -- a group heading that stayed -- has
   to be present before any absence is believed.

   REGISTRY is no use here: it is one Map for the whole run and never clears,
   so a card it has seen once looks present on every sheet rendered after.
   The library and talk cards are pinned in their own blocks above, where the
   readers they need are already built. */
try {
  const walkGrid = () => (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  const opened = [];
  const go = v => { opened.push([v, ctx.showCategory(v)]); return walkGrid(); };
  const mech = go('MECHANICS'), skills = go('SKILLS'), spells = go('SPELLS'), barks = go('BARKS');
  const refused = opened.filter(([, r]) => r === false).map(([v]) => v);
  // The lede of each card, distinctive enough not to match the sheet it now
  // sits on: the Spells sheet says "spells" in every other line, so that one
  // is pinned on a phrase only the card uses.
  const moved = [
    ['skills', 'What each skill is asked about', skills, 'the Skills sheet'],
    ['spells', 'read off the spell’s own call', spells, 'the Spells sheet'],
    ['balloons', 'Talk balloons', barks, 'the Barks sheet'],
  ];
  const gone = moved.filter(([, title, html]) => !html.includes(title));
  const lingering = moved.filter(([, title]) => mech.includes(title));
  if (refused.length) fail('section moves', 'a tab would not open, so the sheets compared are not the ones named: ' + refused.join(', '));
  else if (!/Hackery/.test(mech)) fail('section moves', 'the Mechanics sheet did not render, so the absence checks prove nothing');
  else if (gone.length) fail('section moves', 'a card is missing from its new home: ' + gone.map(m => m[0] + ' (' + m[3] + ')').join(', '));
  else if (lingering.length) fail('section moves', 'a card is still on the Mechanics sheet, so the move is half done: ' + lingering.map(m => m[0]).join(', '));
  else console.log(`  section moves: ${moved.length} cards on their new sheets and off the Mechanics sheet`);
} catch (e) { fail('section moves', e); }

/* Reloading keeps the tab you were on, 12 September 2026. Reported from a
   phone: a reload lands on the World tab whatever tab was open.

   Every tab change writes the hash (syncDeepLink), and the open path captures
   `arrivedOn = parseDeepLink()` before anything can overwrite it, then calls
   showCategory(landOn) -- 'WORLD' whenever the file has a world map -- and
   only afterwards applyDeepLink(backTo). applyDeepLink does NOT re-read the
   hash when it is handed a q, so the captured value should survive. If it
   does not, this is where it shows.

   This has to run in THIS harness and not a lighter one: showCategory refuses
   any value that is not among categorySelect's options, and only the stub
   here parses the real markup into them. A lighter sandbox reports every
   category as lost, which looks exactly like the bug and is not. */
try {
  const was = ctx.location.hash;
  const landings = [];
  /* A link made before the Mechanics split names the whole sheet, which no
     tab stands for; it must land on the first group, whose tab the tree has a
     leaf for, or the tab row comes up blank. */
  const firstGroup = (peek('MECH_GROUPS') || [])[0];
  for (const [hash, want] of [['135', '135'], ['MECH_COMBAT', 'MECH_COMBAT'],
                              ['MECHANICS', firstGroup && firstGroup.value], ['ITEMS', 'ITEMS']]) {
    ctx.location.hash = '#c=' + hash;
    ctx.parseArchiveBytes(archive, 'Cythera Data (reloaded on ' + hash + ')', { via: 'data fork' });
    landings.push([hash, want, REGISTRY.get('categorySelect').value]);
  }
  ctx.location.hash = '';
  ctx.parseArchiveBytes(archive, 'Cythera Data (reloaded with no hash)', { via: 'data fork' });
  const bare = REGISTRY.get('categorySelect').value;
  ctx.location.hash = was;
  const lost = landings.filter(([, want, got]) => !want || got !== want);
  // The control: with no hash the world IS the right answer, so a run where
  // everything lands on WORLD proves nothing unless this one does too.
  if (bare !== 'WORLD') fail('reload keeps the tab', 'with no hash it landed on ' + bare + ', not the world, so this check is not exercising the open path');
  else if (lost.length) fail('reload keeps the tab', 'a reload lost the tab: ' + lost.map(([h, w, g]) => '#c=' + h + ' -> ' + g + ', not ' + w).join(', '));
  else if (!(peek('TAB_LEAF_FOR') && peek('TAB_LEAF_FOR').get(firstGroup.value))) fail('reload keeps the tab', 'the tab an old Mechanics link lands on has no leaf, so its tab row is blank');
  else console.log(`  reload keeps the tab: ${landings.map(([h, w]) => h === w ? h : h + ' as ' + w).join(', ')} each came back, and no hash lands on ${bare}`);
} catch (e) { fail('reload keeps the tab', e); }

// The edit path: change one plaintext byte of an encrypted resource, let
// applyResourceEdit rebuild the whole archive through writeDelverArchive,
// and confirm the rebuilt file serves the edit back -- decrypted -- while
// everything else survives. This is the only check that drives editing, so
// anything new that writes belongs in it.
try {
  // Any resource of subindex 1 (known_encrypted) proves re-encryption.
  const specBefore = peek('delverArchiveSpec')(peek('ARCHIVE.bytes'));
  const countBefore = specBefore.resources.length;
  const resid = specBefore.resources.find(r => (r.resid >> 8) === 2).resid;
  const before = ctx.smartDecrypt(ctx.getResourceBytes(A(), resid), resid).data;
  const edited = Uint8Array.from(before);
  edited[0] = edited[0] ^ 0xFF;
  if (!ctx.applyResourceEdit(resid, edited)) throw new Error('applyResourceEdit returned false');
  const raw = ctx.getResourceBytes(A(), resid);
  const after = ctx.smartDecrypt(raw, resid).data;
  if (Buffer.from(after).toString('hex') !== Buffer.from(edited).toString('hex'))
    fail('edit path', 'rebuilt archive does not serve the edited bytes back');
  else if (Buffer.from(raw).toString('hex') === Buffer.from(edited).toString('hex'))
    fail('edit path', 'edited bytes were stored plaintext in an encrypted subindex');
  else if (!ctx.EDITED_RESIDS || !ctx.EDITED_RESIDS.has(resid))
    fail('edit path', 'the dirty list did not survive the rebuild');
  else {
    const countAfter = peek('delverArchiveSpec')(peek('ARCHIVE.bytes')).resources.length;
    if (countAfter !== countBefore) fail('edit path', `resource count moved: ${countBefore} -> ${countAfter}`);
    else console.log(`  edit path: 0x${resid.toString(16).toUpperCase()} edited, re-encrypted, and served back from a ${peek('ARCHIVE.bytes').length}-byte rebuild`);
  }
} catch (e) { fail('edit path', e); }

// Structured prop editing: move one prop record one square east through
// applyPropRecordEdit and confirm the rebuilt archive serves the list back
// with exactly that field changed -- same record count, neighbours
// byte-identical.
try {
  const propResid = peek('delverArchiveSpec')(peek('ARCHIVE.bytes')).resources
    .map(r => r.resid).find(r => (r >> 8) === 0x81);
  const parse = () => ctx.parseDelverPropList(
    ctx.smartDecrypt(ctx.getResourceBytes(A(), propResid), propResid).data);
  const before = parse();
  const idx = before.findIndex(r => r.onMap);
  const want = { x: before[idx].x + 1 };
  if (!ctx.applyPropRecordEdit(propResid, idx, want)) throw new Error('applyPropRecordEdit returned false');
  const after = parse();
  if (after.length !== before.length) fail('prop edit', `record count moved: ${before.length} -> ${after.length}`);
  else if (after[idx].x !== want.x || after[idx].y !== before[idx].y)
    fail('prop edit', `record ${idx} came back at ${after[idx].x},${after[idx].y}`);
  else {
    const other = (idx + 1) % before.length;
    const same = JSON.stringify(after[other]) === JSON.stringify(before[other]);
    if (!same) fail('prop edit', `record ${other} changed although only ${idx} was edited`);
    else console.log(`  prop edit: record ${idx} of 0x${propResid.toString(16).toUpperCase()} moved one square east through a full rebuild`);
  }
} catch (e) { fail('prop edit', e); }

// Schedules, v1.40.0: everybody's day as a card each, a post a row, the
// square a link into the zone.
try {
  ctx.showCategory('SCHEDULES');
  const sh = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  const cards = (function count(el) { return (/^sched-\d+$/.test(el.id || '') ? 1 : 0) + (el.children || []).map(count).reduce((a, b) => a + b, 0); })(REGISTRY.get('sheetGrid'));
  const links = (sh.match(/atlasOpenSquare\(/g) || []).length;
  // A schedule is a program (24 September 2026): Pelagon's reads, in the
  // file's order, the grotto if quest value 3 is 3, a stop, off every map
  // if he has flag 0, a stop, then Kosha. Stripped of markup and taken from
  // his card alone.
  const find = (el, id) => el.id === id ? el : (el.children || []).reduce((f, c) => f || find(c, id), null);
  const pc = find(REGISTRY.get('sheetGrid'), 'sched-13');
  const pel = (pc ? (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(pc) : '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (cards < 100 || links < 500 || !/Alaric/.test(sh)) fail('schedules', `the sheet shows ${cards} characters and ${links} posts`);
  else if (!/if quest value 3 is 3[\s\S]*stop if one above was taken[\s\S]*off every map if Pelagon has flag 0/.test(pel))
    fail('schedules', 'Pelagon\u2019s schedule is not read as a program: ' + pel.slice(0, 300));
  // And the map walks the day a new game starts with (scheduleDay): quest
  // value 3 is 0 and Pelagon's flag 0 is clear, so his day is Kosha alone.
  else if (JSON.stringify(ctx.scheduleDay(13).filter(e => e.mode).map(e => [e.level, e.x, e.y])) !== '[[13,39,35]]')
    fail('schedules', 'Pelagon\u2019s day at the start of a game is not Kosha (39, 35): ' + JSON.stringify(ctx.scheduleDay(13).map(e => [e.cond, e.level, e.x, e.y])));
  // A block head (a segment placed nowhere) guards the posts up to its
  // stop: Philinus's opens with one that holds at the start, so his day is
  // the Odemia block, seven posts; read segment by segment it came out empty.
  else if (ctx.scheduleDay(50).filter(e => e.mode && e.level === 2).length !== 7)
    fail('schedules', 'Philinus\u2019s block is not walked: ' + JSON.stringify(ctx.scheduleDay(50).map(e => [e.cond, e.level, e.x, e.y])));
  else console.log(`  schedules: ${cards} characters, ${links} posts, each a link into its zone; conditions read, Pelagon's in order, his day at the start Kosha alone, Philinus's block walked`);
} catch (e) { fail('schedules', e); }



/* Componentisation, 13 September 2026. The maintainer's rule: tapping a thing
   takes you one step rightward, and there is always an intermediate step on
   Components rather than a jump from Scenario straight to Data.

   What this pins, none of which any other check would notice:
     - a character's name is a component, the string table 0x0201 that
       derivedCharacterName reads;
     - their schedule is reached through the Schedules SHEET under Components,
       not the raw 0xF00B table under Data, which is the jump the rule forbids;
     - that chip actually opens their card, rather than merely existing;
     - a skill and a spell chip at the icon they wear -- unreachable before,
       because subindex 137 was a gallery no tab claimed at all.

   The absence half carries as much weight as the presence half. A Name label
   chip that appeared while the Schedule chip still pointed at 0xF00B would
   satisfy a presence-only test and miss the whole point of the change, so the
   old destination is asserted GONE. And the card open is awaited rather than
   assumed: the sheet is built by the category switch and the card does not
   exist until it has run, which is why openSchedule defers by a tick. */
try {
  const leafFor = peek('TAB_LEAF_FOR');
  const walk = el => (el.innerHTML || '') + (el.children || []).map(walk).join('');
  ctx.showCharacterDetail(2);                        // Alaric, who keeps a day
  const dossier = walk(REGISTRY.get('sheetGrid'));
  ctx.showCategory('SKILLS');
  const skhtml = walk(REGISTRY.get('sheetGrid'));
  ctx.showCategory('SPELLS');
  const sphtml = walk(REGISTRY.get('sheetGrid'));
  ctx.openSchedule(2);
  await new Promise(r => setTimeout(r, 150));
  const card = ctx.document.getElementById('sched-2');
  const iconChips = h => (h.match(/class="relMain">Icon</g) || []).length;

  if (!leafFor || !leafFor.has('137'))
    fail('components', 'subindex 137, the icons a skill and a spell wear, is a gallery no tab claims');
  else if (!/Name label/.test(dossier) || !/jumpToResource\(513\)/.test(dossier))
    fail('components', 'the dossier does not chip the name at its string table 0x0201');
  else if (!/openSchedule\(2\)/.test(dossier))
    fail('components', 'the dossier does not reach the schedule through the Schedules sheet');
  else if (/jumpToResource\(61451\)/.test(dossier))
    fail('components', 'the dossier still jumps straight at 0xF00B under Data, the step the rule forbids');
  else if (!card || !card.open || ctx.CUR_SUBN !== 'SCHEDULES')
    fail('components', 'openSchedule did not open that character’s own card on the Schedules sheet');
  else if (!iconChips(skhtml)) fail('components', 'no skill chips at the icon it wears');
  else if (!iconChips(sphtml)) fail('components', 'no spell chips at the icon it wears');
  else console.log(`  components: the dossier names its parts and reaches its schedule through Components; ${iconChips(skhtml)} skills and ${iconChips(sphtml)} spells chip at their icon`);
} catch (e) { fail('components', e); }

/* A component names what it belongs to, 16 September 2026. The other half of
   the rule above: a page under Components that links nowhere is a tap that
   goes nowhere, and a walk over every one of them found most class scripts,
   every skill icon, every landscape and nearly every room script in that
   state. ownerRows gives each the reverse of the chip that reaches it.

   What this pins:
     - EVERY class script -- items and objects (0x10xx, 0x11xx), monsters
       (0x19xx), skills and spells (0x1Axx) -- carries an owner row, counted
       over the whole family rather than sampled, so a family that loses its
       join fails whole;
     - the joins land where the numbering says: 0x1910 on monster record 16,
       the gator; icon 0x8A05 on class 0x1A05; room 1 on Land King Hall at
       (19,24), which is save-format.md's published egg, read from a saved
       game and not from this code; effect 0xA03 on the potion at aspect 3;
     - a tap arrives: openClassCard opens the card itself, not only the sheet.

   The negative half: a landscape no script sets (0x8411) and a room no zone
   places (0x1C5F) must say so and link nothing. A join that matched loosely
   -- every zone for every landscape -- would pass every presence test here. */
try {
  // A script's owner rows are under its code (#scriptRefs) since 23 September
  // 2026; every other resource's are in the panel above it.
  const usage = r => { ctx.jumpToResource(r); drainRaf();
    return (REGISTRY.get('artUsage')._html || '') + (REGISTRY.get('scriptRefs')._html || REGISTRY.get('scriptRefs').innerHTML || ''); };
  const owned = subn => {
    let n = 0, missing = [];
    for (let i = 0; i < 256; i++) {
      const r = ((subn + 1) << 8) | i;
      if (!ctx.refExists(r)) continue;
      n++;
      if (!ctx.ownerRows(r, subn).length) missing.push('0x' + r.toString(16).toUpperCase());
    }
    return { n, missing };
  };
  const fam = [15, 16, 24, 25].map(s => [s, owned(s)]);
  const short = fam.find(([, o]) => !o.n || o.missing.length);
  const gator = usage(0x1910), icon = usage(0x8A05), room = usage(0x1B01), fx = usage(0xA03);
  const bare = usage(0x8411), lkhStrip = usage(0x8401), lost = usage(0x1C5F);
  if (short)
    fail('component owners', `subindex ${short[0]}: ${short[1].n} class scripts, ${short[1].missing.length} with no owner row (${short[1].missing.slice(0, 5).join(' ')})`);
  else if (!/openUnit\(16\)/.test(gator)) fail('component owners', '0x1910 does not name monster record 16 as its owner');
  else if (!new RegExp('openClassCard\\(' + 0x1A05 + '\\)').test(icon)) fail('component owners', 'icon 0x8A05 does not name class 0x1A05');
  else if (!new RegExp('showSquareOnMap\\(' + 0x8003 + ',19,24\\)').test(room)) fail('component owners', 'room 1 does not land on Land King Hall at (19,24)');
  else if (!/openItem\(31,3\)/.test(fx)) fail('component owners', 'effect 0xA03 does not name the potion at aspect 3');
  else if (!/No script sets this landscape/.test(bare) || /jumpToScriptAt\(/.test(bare))
    fail('component owners', 'landscape 0x8411, which no script sets, links a script or does not say so');
  // Strip 1 is set by Land King Hall's entry script as -1: the strip with
  // no sky (cbSetZonePic negates it). Until 22 September 2026 this pin held
  // it up as the landscape nothing sets.
  else if (!new RegExp('jumpToScriptAt\\(' + 0x1403 + ',').test(lkhStrip) || !/no sky/.test(lkhStrip))
    fail('component owners', 'landscape 0x8401 does not name Land King Hall’s entry script, with no sky');
  else if (!/No zone places this room/.test(lost) || /showSquareOnMap/.test(lost))
    fail('component owners', 'room 0x1C5F, which no egg places, links a square or does not say so');
  else {
    ctx.openClassCard(0x1A05);
    await new Promise(r => setTimeout(r, 150));
    const card = ctx.document.getElementById('spell-1a05') || ctx.document.getElementById('skill-1a05');
    if (!card || !card.open) fail('component owners', 'openClassCard did not open the card for 0x1A05');
    else console.log(`  component owners: ${fam.map(([s, o]) => o.n + ' in ' + s).join(', ')} all name their owner; room 1 lands on Land King Hall (19,24); the unused landscape and room link nothing`);
  }
} catch (e) { fail('component owners', e); }

/* Two joins the maintainer asked for on 16 September 2026. The hero's dossier
   carries the four lists character creation offers (0x203 to 0x206), and each
   list names the hero back; the Combat AI section on Mechanics reaches the
   compiled scripts (subindex 3) and the scenario's tests and actions (8)
   before the .ai text under Data, and both of those galleries' pages lead
   back to it. The negative half: another character's dossier must not carry
   the class lists, and a writing that is not one of them must not name the
   hero -- a join keyed on subindex 1 alone would pass everything else. */
try {
  const walk = el => (el.innerHTML || '') + (el.children || []).map(walk).join('');
  // A script's owner rows are under its code (#scriptRefs) since 23 September
  // 2026; every other resource's are in the panel above it.
  const usage = r => { ctx.jumpToResource(r); drainRaf();
    return (REGISTRY.get('artUsage')._html || '') + (REGISTRY.get('scriptRefs')._html || REGISTRY.get('scriptRefs').innerHTML || ''); };
  ctx.showCharacterDetail(1); drainRaf();
  const hero = walk(REGISTRY.get('sheetGrid'));
  ctx.showCharacterDetail(2); drainRaf();
  const other = walk(REGISTRY.get('sheetGrid'));
  const classText = [0x203, 0x204, 0x205, 0x206];
  const offered = usage(0x204), writing = usage(0x21C), ai = usage(0x410), hook = usage(0x902);
  ctx.showCategory('MECH_COMBAT'); drainRaf();
  const combat = walk(REGISTRY.get('sheetGrid'));
  const missing = classText.filter(r => !hero.includes('jumpToResource(' + r + ')'));
  if (missing.length) fail('hero and combat AI', 'the hero does not chip ' + missing.map(r => '0x' + r.toString(16)).join(', '));
  else if (classText.some(r => other.includes('jumpToResource(' + r + ')'))) fail('hero and combat AI', 'a character other than the hero carries the class lists');
  else if (!/Offered to/.test(offered) || !/openCharacter\(1\)/.test(offered)) fail('hero and combat AI', '0x204 does not name the hero');
  else if (/Offered to/.test(writing)) fail('hero and combat AI', '0x21C, which is not a class list, names the hero');
  else if (![ai, hook].every(h => /Rules on/.test(h) && /mechGo\('combatai'\)/.test(h))) fail('hero and combat AI', 'a combat script or a test does not lead to the Combat AI section');
  else if (!["showCategory('3')", "showCategory('8')", "showCategory('AIRULES')"].every(js => combat.includes('onclick="' + js + '"')))
    fail('hero and combat AI', 'the Combat AI section does not reach the compiled scripts, the tests and actions, and the .ai files');
  else console.log('  hero and combat AI: the hero carries the four class lists and they name the hero; the Combat AI section and its scripts lead to each other');
} catch (e) { fail('hero and combat AI', e); }

/* Who plays a sound and what a window shows, 16 September 2026. Both were
   joins the page did not have: a sound page said "no script names this sound"
   for 27 of the 46, and a container's window was matched by the prop's name.
   Each route the application has is pinned by one sound that only it reaches,
   so a route that stops being followed fails by name:
     - a constant in PlaySoundSync (delvmod's UnknownD4): 0x910A, the portcullis;
     - a task queued to a helper that plays its argument: 0x9131, the smith;
     - a weapon's class word: 0x9110 on the mace;
     - a thrown thing's flight, ShootEffect's eighth operand: 0x910F, the pin;
     - a creature's list, by index: 0x9117 on the gator;
     - the default list built in 0x3041: 0x9116;
     - a prop's own sound, where it stands: 0x9102, the fountain;
     - an egg: 0x9106 on the shore.
   The sounds nothing plays are pinned by name, both ways: one that gains a
   player fails, and so does a sound the list does not expect to be silent.
   Windows: the chest and the coffer share a picture through the helper, the
   wanted poster comes from a placed poster's Data2, and the lute opens the
   pipes as the shipped script does -- so the lute's own picture, which
   nothing opens, must carry no window row. */
try {
  // A script's owner rows are under its code (#scriptRefs) since 23 September
  // 2026; every other resource's are in the panel above it.
  const usage = r => { ctx.jumpToResource(r); drainRaf();
    return (REGISTRY.get('artUsage')._html || '') + (REGISTRY.get('scriptRefs')._html || REGISTRY.get('scriptRefs').innerHTML || ''); };
  const SILENT = [0x911E, 0x911F, 0x9120, 0x9122, 0x912B];
  const silent = [];
  for (let n = 0; n < 256; n++) {
    const r = 0x9100 + n;
    if (!ctx.refExists(r)) continue;
    if (ctx.soundUsageRows(r, 144).some(([, , note]) => /^Nothing plays this sound/.test(note))) silent.push(r);
  }
  const hex = r => '0x' + r.toString(16).toUpperCase();
  const routes = [
    [0x910A, /jumpToResource\(4135\)/, 'PlaySoundSync in 0x1027'],
    [0x9131, /jumpToResource\(3206\)/, 'the task 0xC86 queues'],
    [0x9110, /openItem\(94\)/, 'the mace’s class'],
    [0x910F, /openItem\(163\)/, 'the rolling pin’s flight'],
    [0x9117, /openUnit\(16\)/, 'the gator’s list'],
    [0x9116, /jumpToResource\(12353\)/, 'the default list in 0x3041'],
    [0x9102, /Sound of[\s\S]*fountain/, 'the fountain'],
    [0x9106, /Heard in[\s\S]*showSquareOnMap/, 'an egg']];
  const missed = routes.filter(([r, re]) => !re.test(usage(r)));
  const chest = usage(0x8F0A), poster = usage(0x8F1A), pipes = usage(0x8F12), lute = usage(0x8F15);
  if (silent.join() !== SILENT.join()) fail('sounds and windows', 'silent sounds are ' + silent.map(hex).join(' ') + ', expected ' + SILENT.map(hex).join(' '));
  else if (missed.length) fail('sounds and windows', missed.map(([r, , what]) => hex(r) + ' does not name ' + what).join('; '));
  else if (!/Window of/.test(chest) || !/openItem\(141\)/.test(chest) || !/openItem\(142\)/.test(chest)) fail('sounds and windows', '0x8F0A is not the window of the chest and the coffer');
  else if (!/Window of[\s\S]*poster/.test(poster)) fail('sounds and windows', '0x8F1A is not the window of the poster that carries it');
  else if (!/Window of[\s\S]*lute[\s\S]*panpipes/.test(pipes)) fail('sounds and windows', '0x8F12 is not the window of the lute and the panpipes, as the scripts have it');
  else if (/Window of/.test(lute)) fail('sounds and windows', '0x8F15, which no script opens, has a window row');
  else console.log(`  sounds and windows: every route names its sound, ${SILENT.length} sounds nothing plays, and the windows are the scripts’ own`);
} catch (e) { fail('sounds and windows', e); }

/* Each one placed, 16 September 2026, after the maintainer asked what the red
   book was against the blue one. An item page lists its props by aspect and
   Data1 when they come in more than one, with what the class reads the number
   as and a chip that opens each square. Pinned on the book, whose colour is
   only its aspect and whose Data1 is the passage: the Sapphire Book of Power
   is a blue book on its own square below Cademia, and Alaric's Government is
   one red open book in three desks. The negative half: eggs are records whose
   prop-type field is an argument, and three carry 26, the book's -- one sits
   at (57,13) in Cademia -- so no chip may open that square; and a class whose
   placed props are all alike (the club) carries no list at all. */
try {
  const walk = el => (el.innerHTML || '') + (el.children || []).map(walk).join('');
  ctx.showItemDetail(0x1A); drainRaf();
  const book = walk(REGISTRY.get('sheetGrid'));
  const govt = /Alaric’s Government|Alaric's Government/.exec(book);
  const govtRow = govt ? book.slice(govt.index, book.indexOf('</tr>', govt.index)) : '';
  const club = Object.keys(ctx.getPropTileList()).map(Number).find(p => ctx.propDisplayName(p) === 'club');
  if (!/Each one/.test(book)) fail('each one', 'the book page has no list of each one placed');
  else if (!/Sapphire Book of Power[\s\S]{0,600}showSquareOnMap\(32796,13,38\)/.test(book)) fail('each one', 'the Sapphire Book of Power does not open its square below Cademia');
  else if ((govtRow.match(/showSquareOnMap\(/g) || []).length !== 3 || !/in a desk/.test(govtRow)) fail('each one', 'Alaric’s Government is not three desks: ' + (govtRow.match(/showSquareOnMap\(/g) || []).length);
  else if (/showSquareOnMap\(32776,57,13\)/.test(book)) fail('each one', 'an egg carrying 26 was listed as a book, at Cademia (57,13)');
  else if (club === undefined || ctx.itemEachOneHTML(club)) fail('each one', 'the club, whose placed props are all alike, carries a list');
  else console.log('  each one: the book lists each passage where it lies, eggs left out, and a class of alike props lists nothing');
} catch (e) { fail('each one', e); }

/* A tap on a tile of a sheet opens that tile on its own, and nowhere else.

   The gesture used to do two different things: a tile that was a prop type's
   own frame left the sheet for that prop type's page, and any other tile
   opened the sprite zoom. It always opens the zoom since 20 September 2026
   (the maintainer), and the zoom is what carries the way on -- the classes
   the tile draws, each a chip. Pinned on the weapon sheet, where the old
   rule was worked out: the spear's own tile 0x206 names the spear as the
   class it is the base of, and the hatchet 0x207, which no class owns,
   still offers the spear at aspect 1 and its sheet and says so. */
try {
  const walk = el => (el.innerHTML || '') + (el.children || []).map(walk).join('');
  ctx.showSpriteZoom(0x206, 'spear'); drainRaf();
  const spearView = walk(REGISTRY.get('spriteZoom'));
  const spear = ctx.inventoryItemList().find(e => e.name === 'spear');
  ctx.showSpriteZoom(0x207, 'hatchet'); drainRaf();
  const view = walk(REGISTRY.get('spriteZoom'));
  if (!spear) fail('tile view', 'the spear is not in the item list');
  else if (!new RegExp('openItem\\(' + spear.pt + '\\)').test(spearView)) fail('tile view', 'the spear’s own tile does not name the spear as the class it is the base of');
  else if (!/openItem\((\d+),1\)/.test(view) || +/openItem\((\d+),1\)/.exec(view)[1] !== spear.pt) fail('tile view', 'the hatchet’s view does not offer the spear at aspect 1');
  else if (!new RegExp('jumpToResource\\(' + 0x8E20 + '\\)').test(view) || !/No class owns this picture/.test(view)) fail('tile view', 'the hatchet’s view does not name its sheet or say no class owns it');
  else {
    ctx.openItem(spear.pt, 1); drainRaf();
    const pw = peek('DERIVED.PROP_WORD');
    if (ctx.CUR_SUBN !== 'ITEMS' || !pw || pw.aspect !== 1 || pw.pt !== spear.pt) fail('tile view', 'the spear chip does not open the spear at aspect 1');
    else console.log('  tile view: a tile opens on its own, and the classes it draws are the way on');
  }
} catch (e) { fail('tile view', e); }

/* The patches section under Hackery, end to end, against a patch made here.

   WHY A SYNTHETIC PATCH AND NOT THE REAL ONE. The Pumpkin Patch arrives as a
   .hqx wrapping a .sit whose forks use StuffIt method 13, which the page
   reads the catalog of but cannot decompress, so the real file needs `unar`
   on the machine. utilities/patch_check.mjs does use it, and skips without
   it; this pin must not skip, because what it guards is the part patch_check
   never touches -- the DOM. So the patch is built out of the archive that is
   already open: take two real tile sheets, redraw a few tiles of each, give
   it a descriptor with its own UUID and description, and write it with the
   writer that is already proven against delvmod.

   That makes the expected numbers the harness's own rather than the file's,
   which is the honest trade: this pin proves the section draws what the
   reader found, and patch_check proves the reader finds the right thing in a
   real patch. Neither alone is enough.

   The negative control is the last line: with no patch open the report host
   must be empty, so a section that drew its pairs unconditionally would fail
   here rather than look right. */
try {
  ctx.showCategory('TOOLS');
  const walk = () => (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  const before = walk();
  if (before.indexOf('records no patches applied to it') < 0)
    fail('patches', 'the section does not say the shipped archive records no patches');
  if (!REGISTRY.has('patchFile')) fail('patches', 'no file control on the section');

  // Two sheets of the open archive, with a handful of tiles redrawn. Working
  // in decoded pixels and re-encoding is what makes the change real: a patch
  // that only differed in its compression would replace bytes and redraw
  // nothing, and the tile comparison is what this is about.
  const base = ctx.delverArchiveSpec(archive);
  const victims = [0x8E04, 0x8E34];
  const WANT = { 0x8E04: [1, 5, 9], 0x8E34: [0, 2] };
  const spec = { scenarioTitle: base.scenarioTitle, playerName: '',
                 formatMajor: base.formatMajor, formatMinor: base.formatMinor, resources: [] };
  let wantTiles = 0;
  for (const resid of victims) {
    const src = base.resources.find(r => r.resid === resid);
    if (!src) { fail('patches', 'the archive has no ' + resid.toString(16)); throw new Error('no sheet'); }
    const dec = ctx.decodeResource(A(), src.data, 141, resid);
    const img = dec.image.slice();
    for (const t of WANT[resid]) {
      for (let y = t * 32; y < (t + 1) * 32; y++)
        for (let x = 0; x < dec.W; x++) img[y * dec.W + x] = ((x + y) & 1) ? 3 : 250;
      wantTiles++;
    }
    // A sheet resource is a bare DCG stream of the 32-wide column, which is
    // what decodeResource gives back, so the encoder the ditherizer uses for
    // a sheet reduces to this once the grid has been folded. Nothing has to
    // be reshaped because nothing was reshaped on the way in.
    spec.resources.push({ resid, data: ctx.encodeDCGLiterals(img), encrypted: !!src.encrypted });
  }
  // The descriptor, laid out as Magpie writes one. The self-offset field has
  // to name where the resource lands, and where it lands is decided by the
  // writer, so it is written once, read back, and written again.
  const mkDesc = (selfOffset) => {
    const d = new Uint8Array(568);
    for (let i = 0; i < 16; i++) d[8 + i] = (i * 17 + 5) & 0xFF;
    d[24] = 0x02; d[25] = 0x38;            // +24: its own length, 568
    d[26] = 0;                             // +26: the one code the binary names
    d[28] = (selfOffset >>> 24) & 0xFF; d[29] = (selfOffset >>> 16) & 0xFF;
    d[30] = (selfOffset >>> 8) & 0xFF;   d[31] = selfOffset & 0xFF;
    const text = 'A patch made by the smoke test, redrawing five tiles.';
    d[0x138] = text.length;
    for (let i = 0; i < text.length; i++) d[0x139 + i] = text.charCodeAt(i);
    return d;
  };
  spec.resources.push({ resid: 0xFFFF, data: mkDesc(0), encrypted: false });
  const once = ctx.delverArchiveSpec(ctx.writeDelverArchive(spec));
  const landed = once.resources.find(r => r.resid === 0xFFFF).fileOffset;
  spec.resources[spec.resources.length - 1].data = mkDesc(landed);
  const patchBytes = ctx.writeDelverArchive(spec);

  if (!ctx.patchesOpenBytes(patchBytes, 'Smoke Patch')) fail('patches', 'the patch was refused');
  const rep = peek('window.PATCH_REPORT');
  const after = walk();
  const countTag = (el, tag) => (el.tagName === tag ? 1 : 0) +
    (el.children || []).reduce((n, c) => n + countTag(c, tag), 0);
  const canvases = (REGISTRY.get('patchReport') ? countTag(REGISTRY.get('patchReport'), 'CANVAS') : 0);
  if (!rep) fail('patches', 'no report after opening a patch');
  else if (!rep.usable) fail('patches', 'a patch built from this archive was judged unusable: ' + rep.reasons.join('; '));
  else if (rep.willReplace !== victims.length) fail('patches', `would replace ${rep.willReplace}, expected ${victims.length}`);
  else if (rep.isInstalled) fail('patches', 'a patch this file never listed reads as installed');
  else if (after.indexOf('A patch made by the smoke test') < 0) fail('patches', 'the description is not shown');
  else if (after.indexOf(rep.descriptor.uuidText) < 0) fail('patches', 'the UUID is not shown');
  else if (after.indexOf('Bug Fix') < 0) fail('patches', 'type code 0 is not named Bug Fix');
  else if (canvases !== wantTiles * 2) fail('patches', `${canvases} tile canvases, expected ${wantTiles * 2} (a pair for each of ${wantTiles})`);
  else {
    /* Applying it. The patch was made here from the archive that is open, so
       merging it must put those five redrawn tiles into the archive itself --
       which is the whole point of the button: seeing what a patch does
       without playing to wherever the art is.

       What is asserted is that the OPEN FILE changed, not that the merge
       returned something: patchesApply goes through parseArchiveBytes, and a
       version of it that merged correctly and forgot to re-enter would look
       identical from the outside. */
    // PRISTINE_BYTES, not ARCHIVE.bytes: the two differ already by this point,
    // because a rebuild lays the archive out shorter than Ambrosia's and
    // earlier blocks in this file have edited. Comparing the wrong one made
    // this pin fail on its first run against correct code.
    const before = peek('window.PRISTINE_BYTES').length;
    const sheetBefore = JSON.stringify(Array.from(
      ctx.decodeResource(A(), ctx.getResourceBytes(A(), 0x8E04), 141, 0x8E04).image.slice(0, 4096)));
    if (!ctx.patchesApply()) fail('patches', 'the patch would not apply');
    else {
      const sheetAfter = JSON.stringify(Array.from(
        ctx.decodeResource(A(), ctx.getResourceBytes(A(), 0x8E04), 141, 0x8E04).image.slice(0, 4096)));
      if (sheetBefore === sheetAfter)
        fail('patches', 'applying the patch left the open archive unchanged');
      else if (!peek('window.EDITED_RESIDS').size)
        fail('patches', 'the applied resources are not marked as changed');
      else if (peek('window.PRISTINE_BYTES').length !== before)
        fail('patches', 'applying a patch moved the file as it arrived, which the comparison needs kept');
      else console.log('  patches apply: the open archive carries the patch, and the file as it arrived is kept');
    }
    ctx.patchesForget();
    const host = REGISTRY.get('patchReport');
    if (host && countTag(host, 'CANVAS'))
      fail('patches', 'the tile pairs survive after the patch is forgotten');
    else console.log(`  patches: a made patch reads back with its description, its UUID and ${wantTiles} redrawn tiles as ${canvases} canvases, and forgetting it empties the report`);
  }
} catch (e) { fail('patches', e); }

/* A sprite of your own, end to end: the part table against the shipped art,
   a recolour that moves only what was chosen, a worn body, colour by colour
   on a monster that shares its sheet, and the patches all of it writes, read
   back through the patches section and applied.

   THE PART TABLE IS A JUDGEMENT, SO WHAT IS PINNED IS ITS COVERAGE. Nothing
   in the file says which pixel is hair; what can be required is that every
   pixel of both shipped sheets is either transparent, the outline, or given
   to a part, and that every part has pixels. A release or a mod that redraws
   the sheet would fail the first half here before it recoloured a guess.

   The negative control comes first: with nothing chosen the frames must come
   back byte for byte and no patch must be offered, so a section that always
   wrote something would fail rather than look right. */
try {
  ctx.showCategory('TOOLS');
  const countTag = (el, tag) => (el.tagName === tag ? 1 : 0) +
    (el.children || []).reduce((n, c) => n + countTag(c, tag), 0);
  const host = REGISTRY.get('heroSprite');
  if (!host) throw new Error('no host for the section');
  peek(`window.HERO_SPRITE_STATE = { which: 'heroine', choices: {} }`);
  ctx.renderHeroSprite();
  const cover = peek(`HERO_SPRITES.map(d => {
    const fixed = new Set([0xFF, 0x1D, 0x1E].concat(d.fixed || []));
    const f = heroFigure(d.key);
    if (!f || !f.labels) return { key: d.key, missing: true };
    let loose = 0; const per = d.parts.map(() => 0);
    for (let i = 0; i < f.image.length; i++) {
      const v = f.image[i], l = f.labels[i];
      if (l >= 0) per[l]++;
      else if (v && !fixed.has(v)) loose++;
    }
    return { key: d.key, sheet: f.sheet, loose, unknown: f.unknown, empty: d.parts.filter((p, i) => !per[i]).map(p => p.key),
             others: f.others.length, shades: f.shades.parts.length };
  })`);
  for (const c of cover) {
    if (c.missing) fail('hero colours', `no sheet for the ${c.key}`);
    else if (c.loose || c.unknown) fail('hero colours', `the ${c.key}'s sheet has ${c.loose} pixels in no part`);
    else if (c.empty.length) fail('hero colours', `the ${c.key} has no pixels for ${c.empty.join(', ')}`);
    else if (c.others) fail('hero colours', `the ${c.key}'s sheet is shared with ${c.others} other sprite class(es)`);
  }
  const sheet = cover[1] && cover[1].sheet;
  const plainCanvases = countTag(host, 'CANVAS');
  const plainInputs = countTag(host, 'INPUT');
  const wantInputs = 5 + cover[1].shades;
  const wantCanvases = 2 + cover[1].shades + 32;
  if (peek('heroSpritePatch()') !== null) fail('hero colours', 'a patch is offered with nothing chosen');
  else if (plainInputs !== wantInputs) fail('hero colours', `${plainInputs} inputs with nothing chosen, expected a colour for each of five parts and ${cover[1].shades} shades and no description`);
  else if (plainCanvases !== wantCanvases) fail('hero colours', `${plainCanvases} canvases, expected 2 figures, ${cover[1].shades} shade rows and 16 pairs`);
  else if (!REGISTRY.get('heroBody') || !REGISTRY.get('heroOther')) fail('hero colours', 'no body or sprite list');

  // Blond hair and a blue top on the heroine.
  ctx.heroSpriteChoose('hair', 'blond', '#d8b050');
  ctx.heroSpriteChoose('shirt', 'blue', '#2448a8');
  const moved = peek(`(() => {
    const f = heroFigure('heroine'), r = heroRecoloured(f);
    const hair = f.def.parts.findIndex(p => p.key === 'hair'), top = f.def.parts.findIndex(p => p.key === 'shirt');
    let stray = 0, bad = 0, n = 0;
    for (let i = 0; i < r.image.length; i++) {
      if (r.image[i] === f.image[i]) continue;
      n++;
      if (f.labels[i] !== hair && f.labels[i] !== top) stray++;
      if (r.image[i] === 0 || r.image[i] >= 0xE0) bad++;
    }
    return { n, stray, bad, reported: r.moved };
  })()`);
  if (!moved.n) fail('hero colours', 'choosing two colours moved no pixel');
  else if (moved.stray) fail('hero colours', `${moved.stray} pixels outside the hair and the top changed`);
  else if (moved.bad) fail('hero colours', `${moved.bad} pixels landed on transparency or a cycling ramp`);
  else if (moved.n !== moved.reported) fail('hero colours', 'the count on the page is not the count of pixels that moved');

  const w = peek('heroSpritePatch()');
  if (!w) fail('hero colours', 'no patch with two colours chosen');
  else if (w.resids.length !== 1 || w.resids[0] !== sheet) fail('hero colours', 'the patch carries ' + w.resids.map(i => '0x' + i.toString(16)).join(' '));
  else if (!w.checkValueValid) fail('hero colours', 'the patch check value does not verify');
  else if (!/heroine, hair blond, top blue/.test(w.description || '')) fail('hero colours', 'the description is ' + JSON.stringify(w.description));
  else if (!ctx.heroSpriteShowPatch()) fail('hero colours', 'the patches section refused the patch');
  else if (!peek('window.PATCH_REPORT') || !peek('window.PATCH_REPORT.usable') || peek('window.PATCH_REPORT.willReplace') !== 1)
    fail('hero colours', 'the patches section did not read it as a usable one-resource patch');
  else {
    const pristine = peek('window.PRISTINE_BYTES').length;
    if (!ctx.heroSpriteApply()) fail('hero colours', 'the patch would not apply');
    else {
      const got = peek(`(() => { const d = decodeResource(ARCHIVE, getResourceBytes(ARCHIVE, ${sheet}), 141, ${sheet}); return Array.from(d.image); })()`);
      const want = peek(`Array.from(heroRecoloured(heroFigure('heroine')).image)`);
      if (got.length !== want.length || got.some((v, i) => v !== want[i]))
        fail('hero colours', 'the open file does not carry the recoloured sheet');
      else if (peek('window.PRISTINE_BYTES').length !== pristine) fail('hero colours', 'applying moved the file as it arrived');
      else if (peek(`heroFigure('heroine').unknown`)) fail('hero colours', 'after applying, the section reads the recoloured sheet instead of the shipped one');
      else console.log(`  hero colours: both sheets fully labelled (${cover.map(c => c.key + ' 0x' + c.sheet.toString(16)).join(', ')}), nothing chosen writes nothing, ${moved.n} pixels of hair and top recoloured off the ramps, and the one-resource patch verifies and applies`);
    }
  }
  ctx.patchesForget();

  /* A portrait, the same way (24 September 2026): Alaric's, 0x8801, found
     in the list the file gives, its families found over the one 64 by 64
     frame with the portrait thresholds, the largest turned yellow, and the
     patch one resource that decodes to the recoloured face. What is pinned
     is the mechanism, not the family count, which is the art's. */
  try {
    peek(`window.HERO_SPRITE_STATE = { which: 'pr8801', choices: {} }`);
    ctx.renderHeroSprite();
    const pf = peek(`(() => { const f = heroFigure('pr8801'); return f && { name: f.name, W: f.W, H: f.H, wearer: f.wearer, shades: f.shades.parts.map(p => p.key), n: heroPortraits().length }; })()`);
    if (!pf) fail('portrait colours', 'no figure for 0x8801');
    else if (pf.W !== 64 || pf.H !== 64 || pf.n < 100) fail('portrait colours', 'the portrait is ' + pf.W + 'x' + pf.H + ' among ' + pf.n);
    else if (!pf.wearer || pf.wearer.i !== 2 || !/Alaric/.test(pf.wearer.name || '')) fail('portrait colours', 'the wearer is ' + JSON.stringify(pf.wearer));
    else if (pf.shades.length < 3) fail('portrait colours', 'only ' + pf.shades.length + ' families on a face');
    else if (!REGISTRY.get('heroPortrait')) fail('portrait colours', 'no portrait list');
    else if (peek('heroSpritePatch()') !== null) fail('portrait colours', 'a patch is offered with nothing chosen');
    else {
      ctx.heroSpriteShade(pf.shades[0], 'yellow', '#e8c020');
      const pr = peek(`(() => { const f = heroFigure('pr8801'), r = heroRecoloured(f), w = heroSpritePatch();
        if (!w) return null;
        let stray = 0, bad = 0, n = 0;
        for (let i = 0; i < r.image.length; i++) { if (r.image[i] === f.image[i]) continue; n++; if (f.shadeLabels[i] !== 0) stray++; if (r.image[i] === 0 || r.image[i] >= 0xE0) bad++; }
        const rr = delverArchiveSpec(w.bytes).resources.find(x => x.resid === 0x8801);
        const dec = decodeResource(ARCHIVE, rr.data, 135, 0x8801);
        return { n, stray, bad, moved: r.moved, resids: w.resids, valid: w.checkValueValid, desc: w.description, name: w.name,
                 same: dec.W === 64 && dec.H === 64 && dec.image.every((v, i) => v === r.image[i]) }; })()`);
      if (!pr) fail('portrait colours', 'no patch with a colour chosen');
      else if (!pr.n || pr.stray || pr.bad) fail('portrait colours', pr.n + ' pixels moved, ' + pr.stray + ' outside the family, ' + pr.bad + ' onto transparency or a cycling ramp');
      else if (pr.n !== pr.moved) fail('portrait colours', 'the count on the page is not the count of pixels that moved');
      else if (pr.resids.length !== 1 || pr.resids[0] !== 0x8801 || !pr.valid) fail('portrait colours', 'the patch carries ' + pr.resids.map(i => '0x' + i.toString(16)).join(' ') + (pr.valid ? '' : ' and does not verify'));
      else if (!/^The portrait of Alaric, 1 colour changed$/.test(pr.desc) || pr.name !== 'Alaric Portrait Colours') fail('portrait colours', 'named ' + JSON.stringify([pr.desc, pr.name]));
      else if (!pr.same) fail('portrait colours', 'the patch does not decode to the recoloured face');
      else {
        const host = REGISTRY.get('heroSprite');
        const canvases = countTag(host, 'CANVAS');
        if (canvases !== 2 + pf.shades.length + 2) fail('portrait colours', canvases + ' canvases, expected 2 figures, ' + pf.shades.length + ' family rows and one pair');
        else console.log(`  portrait colours: ${pf.n} portraits listed; Alaric's has ${pf.shades.length} families, the largest turned yellow moves ${pr.n} pixels and writes one verifying resource`);
      }
    }
  } catch (e) { fail('portrait colours', e); }
  ctx.patchesForget();

  /* Bodies. The list is read, so what is pinned is the rule: the people and
     the four- and eight-frame monsters are in, a sixteen-frame monster, a
     sprite of several tiles and a still one are out. Then the demon, worn:
     its facing 1, second stride, must be the hero's facing 1, right foot. */
  const bodies = peek(`heroBodies(32).map(k => k.pt)`);
  const byName = n => peek(`(heroSpriteClasses().find(k => k.name === ${JSON.stringify(n)}) || {}).pt`);
  const demon = byName('demon'), golem = byName('golem'), gator = byName('gator'), titan = byName('titan'), noble = byName('nobleman'), corpse = byName('corpse');
  if (!demon || !golem || !noble) fail('hero bodies', 'the demon, the golem or the nobleman is not among the sprite classes');
  else if (!bodies.includes(demon) || !bodies.includes(noble) || !bodies.includes(33))
    fail('hero bodies', 'the demon, the nobleman or the heroine cannot be worn');
  else if ([gator, titan, corpse, 32].some(p => p && bodies.includes(p)))
    fail('hero bodies', 'a sixteen-frame monster, the titan, the corpse or the hero himself is offered as a body');
  else {
    peek(`window.HERO_SPRITE_STATE = { which: 'hero', choices: {} }`);
    ctx.heroSpriteBody(String(demon));
    const worn = peek(`(() => {
      const f = heroFigure('hero'), d = heroSpriteClasses().find(k => k.pt === ${demon});
      const src = heroSheetImage(d.sheet);
      let same = true;
      for (let i = 0; i < 1024; i++) if (f.image[(1 * 4 + 2) * 1024 + i] !== src[(d.start + 1 * 2 + 1) * 1024 + i]) same = false;
      return { body: f.body && f.body.pt, labels: !!f.labels, same, shades: f.shades.parts.map(p => p.key) };
    })()`);
    if (worn.body !== demon) fail('hero bodies', 'the demon was not worn');
    else if (worn.labels) fail('hero bodies', 'the part table was applied to a body it was not made for');
    else if (!worn.same) fail('hero bodies', "the hero's facing 1, right foot is not the demon's facing 1, second stride");
    else {
      // Every family the demon's art has, to yellow: a yellow demon hero.
      for (const k of worn.shades) peek(`heroState('hero').shades[${JSON.stringify(k)}] = { name: 'yellow', hex: '#e8c020' }`);
      ctx.renderHeroSprite();
      const wp = peek('heroSpritePatch()');
      if (!wp || wp.resids.length !== 1 || wp.resids[0] !== cover[0].sheet || !wp.checkValueValid)
        fail('hero bodies', 'the worn body did not write a verifying patch of the hero\'s sheet alone');
      else if (!/hero, as the demon, \d+ colours? changed/.test(wp.description)) fail('hero bodies', 'the description is ' + JSON.stringify(wp.description));
      else console.log(`  hero bodies: ${bodies.length} bodies offered, the gator, the titan and the corpse not; the demon worn stride for facing, turned yellow in ${worn.shades.length} families, and written as one resource`);
    }
  }

  /* Colour by colour on a monster that shares its sheet: the demon's frames
     change and the golem's, the other half of the sheet, come back as they
     were. */
  if (demon && golem) {
    peek(`window.HERO_SPRITE_STATE = { which: 'pt${demon}', choices: {} }`);
    ctx.renderHeroSprite();
    const top = peek(`heroFigure('pt${demon}').shades.parts[0].key`);
    ctx.heroSpriteShade(top, 'yellow', '#e8c020');
    const res = peek(`(() => {
      const f = heroFigure('pt${demon}'), w = heroSpritePatch();
      if (!w) return null;
      const spec = delverArchiveSpec(w.bytes);
      const r = spec.resources.find(x => x.resid === f.sheet);
      const img = decodeResource(ARCHIVE, r.data, 141, f.sheet).image;
      const g = heroSpriteClasses().find(k => k.pt === ${golem});
      let golemMoved = 0, demonMoved = 0;
      for (let i = 0; i < img.length; i++) {
        const t = Math.floor(i / 1024);
        if (img[i] === f.sheetImage[i]) continue;
        if (t >= g.start && t < g.start + g.frames) golemMoved++;
        if (t >= f.start && t < f.start + f.frames) demonMoved++;
      }
      return { sheet: f.sheet, resids: w.resids, valid: w.checkValueValid, golemMoved, demonMoved, sameSheet: g.sheet === f.sheet };
    })()`);
    if (!res) fail('shade colours', 'no patch after changing the demon\'s main colour');
    else if (!res.sameSheet) fail('shade colours', 'the golem is no longer on the demon\'s sheet, so this pin proves nothing');
    else if (res.resids.length !== 1 || res.resids[0] !== res.sheet || !res.valid) fail('shade colours', 'the patch is not one verifying resource');
    else if (!res.demonMoved) fail('shade colours', 'the demon did not change');
    else if (res.golemMoved) fail('shade colours', `${res.golemMoved} pixels of the golem changed with the demon`);
    else console.log(`  shade colours: the demon's main family recoloured, ${res.demonMoved} pixels, and the golem beside it on 0x${res.sheet.toString(16)} untouched`);
  }
  /* The fool's motley is red and yellow in one palette row, checkerboarded,
     which is the case that split him into one lump and a scatter when the
     groups were palette rows. His red and his yellow must be two groups, and
     neither may hold the other's shades. */
  const fool = byName('fool');
  if (fool) {
    const fg = peek(`heroFigure('pt${fool}').shades.parts.map(p => p.sure)`);
    const red = fg.find(g => g.includes(0x27)), yellow = fg.find(g => g.includes(0x35));
    if (!red || !yellow) fail('shade colours', "the fool's red or yellow is in no group");
    else if (red === yellow || red.some(i => yellow.includes(i))) fail('shade colours', "the fool's red and yellow are one group");
    // 0x23 is a yellow in row 0x20, the red row; grouped by palette row it
    // sat with the red, which is exactly the fault. It must be with 0x35.
    else if (!yellow.includes(0x23)) fail('shade colours', "the fool's 0x23 is not with his yellow, so the groups are palette rows again");
    else console.log(`  shade colours: the fool in ${fg.length} groups, his red and his yellow apart`);
  }
  peek(`window.HERO_SPRITE_STATE = { which: 'hero', choices: {} }`);
  ctx.patchesForget();
} catch (e) { fail('hero colours', e); }

/* A save against the scenario, the readable half (25 September 2026): the
   shipped save compared with the open file lists the character records
   that differ field by field and the zone lists record by record. */
try {
  if (!savePath || !existsSync(savePath)) console.log('  (no saved game; the save comparison is skipped)');
  else {
    ctx.showCategory('TOOLS');
    if (!ctx.compareOpenBytes(new Uint8Array(readFileSync(savePath)), 'I.M.Cheater')) fail('save comparison', 'the save was refused');
    else {
      const h = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('compareReport'));
      const rep = peek('window.COMPARE_REPORT');
      if (!/Characters<\/div>/.test(h) || !/openCharacter\(1\)|showCharacterDetail\(1\)/.test(h)) fail('save comparison', 'the hero’s record is not listed against the scenario’s');
      else if (!/<td>health<\/td>|<td>square<\/td>|<td>xp<\/td>/.test(h)) fail('save comparison', 'no named field of a character is listed');
      else if (!/Zones<\/div>/.test(h) || !/only in I\.M\.Cheater|only in/.test(h)) fail('save comparison', 'no zone list is compared record by record');
      else {
        // And the map's Save mark draws the save's records over a zone the
        // save has a list for, and says so in the legend.
        const zone = rep.changed.map(c => c.resid).find(r => r >= 0x8100 && r <= 0x81FF);
        if (!peek('window.SAVE_BESIDE') || zone === undefined) fail('save comparison', 'the save is not held beside the file, or it changes no zone list');
        else {
          ctx.showCategory('127');
          ctx.openResource(0x8000 + (zone & 0xFF));
          ctx.toggleMapMarks('save', true);
          const legend = REGISTRY.get('markLegend').innerHTML;
          ctx.toggleMapMarks('save', false);
          if (!/save: I\.M\.Cheater/.test(legend) || !/placed|gone|moved|changed where it stands|characters? here/.test(legend)) fail('save comparison', 'the Save mark’s legend does not describe the save over the zone: ' + legend.replace(/<[^>]+>/g, '').slice(0, 160));
          else console.log(`  save comparison: I.M.Cheater against the scenario, ${rep.changed.length} resources differ; the character records and the zone lists are read as records, and the Save mark draws zone ${zone & 0xFF}: ${legend.replace(/<[^>]+>/g, '').replace(/^.*save: /, '').slice(0, 90)}`);
        }
      }
    }
    ctx.compareForget();
  }
} catch (e) { fail('save comparison', e); }

/* The comparison section, and the patch it writes, end to end through the DOM.

   The engine is proven in patch_check; what this pins is the part that only
   exists in the page. It compares the open archive against a copy of itself
   with three resources changed -- built here rather than loaded, so the pin
   needs no second file and cannot skip -- and requires the section to name
   what changed, group it, draw the tile pairs, and offer the export. Then it
   presses the export and checks that a patch really came out.

   The download is caught rather than performed: the stub records the last
   blob handed to downloadBlob, which is how export_test works too. */
try {
  ctx.showCategory('TOOLS');
  const walk = () => (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  if (!REGISTRY.has('compareFile')) fail('compare', 'no file control on the comparison section');
  const countTag = (el, tag) => (el.tagName === tag ? 1 : 0) +
    (el.children || []).reduce((n, c) => n + countTag(c, tag), 0);

  /* A second archive with three resources changed, one of them a tile sheet
     so the picture path runs.

     BUILT FROM THE FILE AS IT STANDS, not from the bytes this harness opened.
     Earlier blocks in this file edit the archive -- 0x201 through the edit
     path, a prop record, a dithered portrait -- so a copy made from the
     original would differ by those as well, and the count would drift every
     time a block above this one was added. That is what it did on the first
     run: five changed where three were asked for. */
  const ids = [0x8E04, 0x1801, 0x021A];
  const otherBytes = peek(`(() => {
    const spec = delverArchiveSpec(ARCHIVE.bytes);
    for (const id of [${ids.join(', ')}]) {
      const r = spec.resources.find(x => x.resid === id);
      if (!r) throw new Error('the archive has no 0x' + id.toString(16));
      r.data = r.data.slice();
      if (id === 0x8E04) {
        const dec = decodeResource(ARCHIVE, r.data, 141, id);
        const img = dec.image.slice();
        for (const t of [2, 7]) for (let y = t * 32; y < (t + 1) * 32; y++)
          for (let x = 0; x < dec.W; x++) img[y * dec.W + x] = ((x ^ y) & 1) ? 5 : 248;
        r.data = encodeDCGLiterals(img);
      } else { r.data[0] ^= 0xFF; }
    }
    return writeDelverArchive(spec);
  })()`);

  if (!ctx.compareOpenBytes(otherBytes, 'a made copy')) fail('compare', 'the comparison was refused');
  const rep = peek('window.COMPARE_REPORT');
  const html = walk();
  const host = REGISTRY.get('compareReport');
  const canvases = host ? countTag(host, 'CANVAS') : 0;
  if (!rep) fail('compare', 'no report after comparing');
  else if (rep.changed.length !== ids.length)
    fail('compare', `${rep.changed.length} changed, expected ${ids.length}`);
  else if (rep.identical) fail('compare', 'two different archives read as identical');
  else if (rep.unchanged !== rep.aCount - ids.length)
    fail('compare', `${rep.unchanged} unchanged against ${rep.aCount - ids.length} expected`);
  else if (html.indexOf('Skill &amp; Spell Descriptions') < 0 && html.indexOf('Tile Graphics') < 0)
    fail('compare', 'the groups are not named by category');
  else if (!canvases) fail('compare', 'no tile pairs drawn for the changed sheet');
  else if (!REGISTRY.has('patchDesc')) fail('compare', 'no description field on the export');
  else {
    /* The export. Catching the download rather than performing it, and then
       reading the patch back through the reader, so this asserts a real patch
       came out rather than that a button did not throw. */
    // downloadBlob takes the bytes outright, so catching it is synchronous
    // where catching dlBlob's Blob would need an await the smoke does not do.
    // Put back afterwards, so nothing later in this file is left with a stub.
    peek('window.__realDl = downloadBlob; window.__dl = null; downloadBlob = (b, n) => { window.__dl = {bytes: b, name: n}; }; 1');
    REGISTRY.get('patchDesc').value = 'Written by the smoke test.';
    ctx.compareExportPatch();
    const dl = peek('window.__dl');
    peek('downloadBlob = window.__realDl; 1');
    if (!dl) fail('compare', 'the export produced no file');
    else {
      const back = ctx.delverArchiveSpec(dl.bytes);
      const d = back && ctx.delverPatchDescriptor(back);
      const carried = back ? back.resources.filter(r => r.resid !== 0xFFFF).map(r => r.resid).sort((a, b) => a - b) : [];
      if (!d) fail('compare', 'the exported patch has no descriptor');
      else if (d.description !== 'Written by the smoke test.')
        fail('compare', 'the exported patch does not carry the description: ' + JSON.stringify(d.description));
      else if (carried.join(',') !== ids.slice().sort((a, b) => a - b).join(','))
        fail('compare', 'the exported patch carries ' + carried.map(i => '0x' + i.toString(16)).join(' '));
      else if (!d.selfOffsetAgrees) fail('compare', 'the exported descriptor does not name where it landed');
      /* Type 0 is Bug Fix, the one value Magpie's binary tests outright, in
         the branch that raises "Bug fixes are always installed, and can not
         be removed". Exporting as 0 made patches nobody could uninstall, and
         it shipped that way until the export was driven for real. This is
         what stops it coming back. */
      else if (d.typeCode === 0) fail('compare', 'the export writes type 0, which Magpie refuses to uninstall');
      else if (!d.checkValueValid) fail('compare', 'the exported check value does not verify');
      else {
        /* The application half. There is no application open in this
           harness -- it opens the data file alone -- so what is asserted is
           that the section says nothing about the program rather than
           inventing something, and that describeApplicationDiff itself works
           when handed two builds. The second half is where the real figures
           are pinned, in releases_check. */
        if (peek('window.COMPARE_APP'))
          fail('compare', 'an application comparison appeared with no application open');
        const appSelf = peek(`(() => {
          const d = describeApplicationDiff({data: __NOPE, rsrc: null}, {data: __NOPE, rsrc: null});
          return d ? {routines: !!d.routines, fork: !!d.fork} : null;
        })()`.replace(/__NOPE/g, 'null'));
        if (!appSelf || appSelf.routines || appSelf.fork)
          fail('compare', 'describeApplicationDiff invents a comparison from nothing');

        ctx.compareForget();
        const h2 = REGISTRY.get('compareReport');
        if (h2 && countTag(h2, 'CANVAS')) fail('compare', 'the pairs survive after the comparison is forgotten');
        else console.log(`  compare: ${rep.changed.length} changed of ${rep.aCount} across ${rep.groups.length} categories, ${canvases} tile canvases, and an export of ${carried.length} resources reads back with its description`);
      }
    }
  }
} catch (e) { fail('compare', e); }

// The ditherizer's data path: dither a synthetic image to the palette,
// DCG-encode it, write it into a real portrait slot through the full
// rebuild, and confirm the rebuilt archive decodes it back pixel for pixel.
try {
  const rgba = new Uint8Array(64 * 64 * 4);
  for (let i = 0; i < 64 * 64; i++) {
    rgba[i * 4] = (i * 7) & 0xFF; rgba[i * 4 + 1] = (i * 13) & 0xFF;
    rgba[i * 4 + 2] = 96; rgba[i * 4 + 3] = i < 64 ? 0 : 255;   // first row transparent
  }
  const indexed = ctx.ditherToCytheraPalette(rgba, 64, 64, {});
  if (indexed.slice(0, 64).some(v => v !== 0)) throw new Error('transparent pixels not on slot 0');
  for (let i = 64; i < indexed.length; i++) {
    if (indexed[i] === 0) throw new Error('opaque pixel landed on the transparent slot');
    if (indexed[i] >= 0xE0 && indexed[i] <= 0xFB) throw new Error('opaque pixel landed on an animated ramp');
  }
  const resid = 0x8805;
  if (!ctx.applyResourceEdit(resid, ctx.encodeDCGLiterals(indexed)))
    throw new Error('applyResourceEdit refused the portrait');
  const back = ctx.decompressDCG(
    ctx.smartDecrypt(ctx.getResourceBytes(A(), resid), resid).data, 64, 64);
  if (Buffer.from(back).toString('hex') !== Buffer.from(indexed).toString('hex'))
    fail('ditherize', 'rebuilt archive does not decode the dithered portrait back');
  else console.log('  ditherize: a dithered 64x64 portrait wrote into 0x8805 and decoded back exactly');
  // v1.37.0: the other kinds' writers are the decoder backwards. An icon is
  // raw indices, a landscape a DCG strip, a sheet the grid folded back into
  // its column, and a sized graphic a header over a padded DCG buffer; each
  // is written and decoded again, and every index has to come back.
  const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  const mk = (W, H) => { const o = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) o[i] = (i * 7 + (i >> 5)) % 251 + 1; return o; };
  for (const [kind, W, H, subn] of [['icon', 32, 16, 137], ['landscape', 288, 32, 131], ['sheet', 128, 128, 141], ['free', 61, 37, 142]]) {
    const src = mk(W, H);
    const bytes = ctx.encodeGraphicResource(kind, W, H, src);
    let dec = ctx.decodeResource(A(), bytes, subn, undefined);
    if (kind === 'sheet') dec = ctx.reshapeTileSheetGrid(dec.W, dec.H, dec.image);
    if (!(dec.W === W && dec.H === H && same(dec.image, src))) { fail('ditherize', kind + ' did not decode back: ' + dec.W + 'x' + dec.H); break; }
  }
} catch (e) { fail('ditherize', e); }

/* Change code (24 September 2026): the script page's code editor, driven the
   way a visitor drives it. Paris's name topic gets the four instructions
   every other character's has; the preview marks them, an offset that is not
   where an instruction starts is refused, and Apply goes through the same
   rebuild as Edit bytes, so the resource is among the edits the comparison
   section exports. The rebuilt script is read back: the new call is there,
   and the topic's resume point moved past it. */
try {
  ctx.jumpToResource(0x1857);
  ctx.startCodeEdit();
  REGISTRY.get('editCodeAt').value = '0x013E';
  REGISTRY.get('editCodeText').value = 'call_resource SetCharacterFlag (0xF00)\narg Arg00\nbyte 0x07\nend';
  ctx.previewCodeEdit();
  const refused = REGISTRY.get('editCodePreview').textContent;
  REGISTRY.get('editCodeAt').value = '0x013D';
  ctx.previewCodeEdit();
  const preview = REGISTRY.get('editCodePreview').textContent;
  ctx.applyCodeEdit();
  const b = ctx.smartDecrypt(ctx.getResourceBytes(A(), 0x1857), 0x1857).data;
  const fn = ctx.dvmExtents(b, 0x1857).find(([st, en, k]) => k === 'function' && 0x13D >= st && 0x13D < en);
  const ops = fn ? ctx.dvmDisassemble(b.subarray(fn[0], fn[1]), 3).ops.map(o => [fn[0] + o[0], o[2], o[3]]) : [];
  const at = ops.find(o => o[0] === 0x13D), resp = ops.find(o => o[1] === 'conversation_response' && /^"name"/.test(o[2]));
  if (!/not where an instruction starts/.test(refused)) fail('change code', 'an offset inside an instruction was not refused: ' + refused.slice(0, 120));
  else if (!/\+7 bytes/.test(preview) || !/\+ 013D  call_resource/.test(preview)) fail('change code', 'the preview does not mark the new code: ' + preview.slice(0, 200));
  else if (!peek('window.EDITED_RESIDS').has(0x1857)) fail('change code', 'the edit did not go through the rebuild');
  else if (!at || at[1] !== 'call_resource' || !resp || !/-> 0x0147$/.test(resp[2])) fail('change code', 'Paris\u2019s rebuilt name topic does not read back: ' + JSON.stringify([at, resp]));
  else console.log('  change code: Paris\u2019s name topic took four instructions at 0x013D through the editor, previewed, refused mid-instruction, rebuilt, and read back with its resume point moved');
} catch (e) { fail('change code', e); }

// A saved game. The page refused every Cythera player file until September
// 2026 -- describeDelverArchive wanted eight populated subindexes and a save
// has six -- so nothing had ever driven the page over one. Opened through
// adoptArchive, the path a dropped file takes, which is the path that refused
// it. What is checked is what a visitor sees: the status calls it a saved
// game under its own name; the landing is the Data Fork sheet, listing every
// subindex the file holds, rather than an atlas with no world in it; the
// World tab says why; every gallery draws or says why not without throwing;
// the prop list of the zone the player stands in opens and parses; and the
// identity the exports carry is 'DelP'. Cythera Data is reopened at the end
// so the sections after this one see the archive they expect.
