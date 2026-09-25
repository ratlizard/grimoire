// smoke_saves.mjs -- one part of the UI smoke: a saved game opened through adoptArchive and what a visitor sees of it, then the archive reopened.
// Cut out of viewer_smoke.mjs on 18 September 2026 at a point where the open
// file changes, so it runs from a fresh boot (smoke_boot.mjs) as its own
// process. Run alone with
//   node utilities/viewer_smoke.mjs index.html "$TMPDIR/Cythera Data.data" "" <installers .sit> <saved game> saves
// and with the other parts by naming them; with none named the runner drives
// all six in this process, in order.
import { htmlPath, dataPath, onlyCat, visePath, savePath, html, js, archive, rsrcPath, rsrcFork, missingIds,
         El, REGISTRY, catSel, optionSource, CATEGORY_VALUES, body, documentStub, rafQueue, drainRaf, sandbox,
         ctx, peek, fail, t0, status, A, readFileSync, existsSync, tally } from './smoke_boot.mjs';

if (savePath && !onlyCat) {
  if (!existsSync(savePath)) console.log('  (no saved game at ' + savePath + '; the saved-game section is skipped)');
  else try {
    const save = new Uint8Array(readFileSync(savePath));
    const name = savePath.replace(/^.*\//, '');
    // Dropped while the World tab is up, which is where a visit starts: the
    // page carries the current view across a swap through the hash, and a
    // world link names nothing in a file with no world, so this is the case
    // the landing rule has to win.
    ctx.location.hash = '#c=WORLD';
    if (!ctx.adoptArchive(save, name, {})) throw new Error(peek('lastArchiveError'));
    const st = REGISTRY.get('sourceStatus').textContent;
    const m = /a saved game \(“([^”]+)”\)/.exec(st);
    if (!m) fail('saved game', 'the status does not call it a saved game: ' + st.slice(0, 100));
    const savedAs = m ? m[1] : '';
    if (REGISTRY.get('categorySelect').value !== 'SAVEGAME')
      fail('saved game', 'did not land on the Saved Game sheet: ' + REGISTRY.get('categorySelect').value);
    const populated = peek('ARCHIVE.index').filter(x => x[0]).length;
    ctx.showCategory('DATAFORK');
    // The body rows are nodes; the head row is innerHTML, which this stub
    // does not parse into nodes, so the count is the body alone.
    const rows = (function count(el) { return (el.tagName === 'TR' ? 1 : 0) + (el.children || []).reduce((n, c) => n + count(c), 0); })(REGISTRY.get('sheetGrid'));
    if (rows !== populated) fail('saved game', `the Data Fork sheet lists ${rows} subindexes for a file with ${populated}`);
    const f = ctx.ARCHIVE_FINDER;
    if (!f || f.type !== 'DelP' || f.creator !== 'Delv' || f.name !== savedAs)
      fail('saved game', 'the Finder identity for exports is ' + JSON.stringify(f) + ', expected DelP under “' + savedAs + '”');
    ctx.showCategory('WORLD');
    const bar = REGISTRY.get('atlasBar');
    if (!bar || !/no world map/.test(bar.innerHTML)) fail('saved game', 'the World tab does not say there is no world map');
    let bad = 0;
    for (const v of CATEGORY_VALUES) { try { if (!ctx.showCategory(v)) bad++; } catch (e) { bad++; if (bad <= 2) fail('saved game gallery ' + v, e); } }
    if (bad) fail('saved game', bad + ' galleries failed');
    ctx.showCategory('128');
    const lists = (ctx.CUR_RESIDS || []).map(r => r[0]);
    let records = 0;
    if (!lists.length || !ctx.openResource(lists[0])) fail('saved game', 'the prop list of the zone the player stands in did not open');
    else records = ctx.parseDelverPropList(ctx.smartDecrypt(ctx.getResourceBytes(A(), lists[0]), lists[0]).data).length;
    if (!records) fail('saved game', 'the prop list parsed to no records');
    console.log(`  saved game: “${savedAs}” opened, ${populated} subindexes listed, ` +
                `zone prop list 0x${(lists[0] || 0).toString(16).toUpperCase()} with ${records} records, exports as DelP`);

    /* The Saved Game sheet, and the edit that is the whole point of it. Judged
       by what the REBUILT archive holds rather than by what the form returned:
       every commit re-serializes the table, rebuilds the archive and re-enters
       parseArchiveBytes, so a changed field is only changed if it comes back
       out of the rebuilt file. The names are the borrowed ones -- this run
       opened Cythera Data first, which is also how a visitor gets here -- so
       the sheet has to say so. */
    ctx.showCategory('SAVEGAME');
    const sheet = REGISTRY.get('sheetGrid').innerHTML || '';
    const heroBefore = ctx.loadCharacterTable()[1];
    if (!heroBefore) fail('saved game sheet', 'no character record 1');
    else {
      const where = ctx.zoneDisplayName(heroBefore.zone);
      if (!sheet.includes(where)) fail('saved game sheet', 'the head does not say where the player is: ' + where);
      if (!ctx.namesAreBorrowed() || !/come from the scenario opened earlier/.test(sheet))
        fail('saved game sheet', 'the borrowed names are not admitted');
      if (!sheet.includes('0xF307')) fail('saved game sheet', 'the parts table does not list the persistent store');
      // I.M.Cheater is the community's cheated save and its hero carries 255
      // training points; if that stops being true the file is not the one.
      if (heroBefore.training !== 255)
        fail('saved game sheet', 'I.M.Cheater\u2019s hero has ' + heroBefore.training + ' training points, expected 255');
      const wasMagic = heroBefore.magic, wasMax = heroBefore.magicMax;
      ctx.applyCharacterRecordEdit(1, { level: 7, health: 99, healthMax: 99, zone: heroBefore.zone });
      const heroAfter = ctx.loadCharacterTable()[1];
      if (heroAfter.level !== 7 || heroAfter.health !== 99 || heroAfter.healthMax !== 99)
        fail('saved game sheet', 'the edit did not reach the rebuilt archive: ' + JSON.stringify(heroAfter));
      else if (heroAfter.magic !== wasMagic || heroAfter.magicMax !== wasMax ||
               heroAfter.training !== 255 || heroAfter.nutrition !== heroBefore.nutrition)
        fail('saved game sheet', 'the edit moved a field it was not given');
      else if (REGISTRY.get('categorySelect').value !== 'SAVEGAME')
        fail('saved game sheet', 'the rebuild left the sheet: ' + REGISTRY.get('categorySelect').value);
      else if (!(ctx.EDITED_RESIDS || new Set()).has(0xF009))
        fail('saved game sheet', '0xF009 is not on the session\u2019s dirty list');
      else {
        ctx.healCharacterRecord(1);
        const well = ctx.loadCharacterTable()[1];
        if (well.health !== well.healthMax || well.nutrition !== 24)
          fail('saved game sheet', 'Make them well left ' + well.health + '/' + well.healthMax + ', food ' + well.nutrition);
        else console.log('  saved game sheet: the player placed and named, 255 training points read back, ' +
                         'a three-field edit through the rebuild, and a full stomach');
      }
    }
    /* The rest of a save's forms (25 September 2026). The words come from
       the scenario this run opened first, kept as the save replaced it; the
       quest flags are read back through saveQuestState, which the map's day
       also reads, so a writer that put a flag in the wrong bit would come back
       as a different flag here. I.M.Cheater sets quest flag 0 and holds To Do
       slot 0, line 0. */
    try {
      const w = ctx.SCENARIO_SAVE_WORDS;
      if (!w || !w.rooms.length || !w.todo.pairs.length || !Object.keys(w.flags.reads).length)
        fail('save forms', 'the scenario\u2019s words were not kept when the save replaced it');
      ctx.renderSaveSheet();
      const sh = REGISTRY.get('sheetGrid').innerHTML || '';
      for (const t of ['Quest values and flags', 'Rooms entered', 'The To Do list', 'Cure Alaric'])
        if (!sh.includes(t)) fail('save forms', 'the sheet does not show ' + t);
      if (!/id="qf-0" checked/.test(sh)) fail('save forms', 'quest flag 0 is not shown set');
      const qs = () => ctx.saveQuestState(ctx.delverArchiveSpec(peek('ARCHIVE.bytes')));
      ctx.writeQuestState({ 5: 3 }, { 0: false, 77: true, 200: true });
      const q = qs(), set = q.flags.map((f, i) => f ? i : -1).filter(i => i >= 0).join(',');
      if (set !== '77,200' || q.values[5] !== 3) fail('save forms', 'the quest block came back as flags ' + set + ', value 5 ' + q.values[5]);
      ctx.writeRoomsEntered({ 2: true });
      if (!(ctx.saveSegment(0xF00E)[5] & 1)) fail('save forms', 'room 2 is not entered after the edit');
      ctx.addTodoLine(10, 114, w.todo.textResid); ctx.setTodoStruck(0, true);
      const td = ctx.todoEntries(), e10 = td.find(e => e.slot === 10), e0 = td.find(e => e.slot === 0);
      if (!e10 || e10.ref !== 0x3072021A || e10.struck || !e0 || !e0.struck)
        fail('save forms', 'the To Do list came back as ' + JSON.stringify(td));
      ctx.renderSaveSheet();
      if (!/Ask Thuria about Iron Mine/.test(REGISTRY.get('sheetGrid').innerHTML || '')) fail('save forms', 'line 114 is not shown by its text');
      const hero = ctx.loadCharacterTable()[1], rid = 0x8100 | hero.zone;
      const n0 = ctx.parseDelverPropList(ctx.smartDecrypt(ctx.getResourceBytes(A(), rid), rid).data).length;
      ctx.giveToCharacter(1, { proptype: 66, aspect: 0, d3: 0x300, flags: 0x10 });
      const recs = ctx.parseDelverPropList(ctx.smartDecrypt(ctx.getResourceBytes(A(), rid), rid).data), last = recs[recs.length - 1];
      if (recs.length !== n0 + 1 || last.carriedBy !== 1 || last.flags !== 0x10 || last.proptype !== 66 || last.d3 !== 0x300)
        fail('save forms', 'the thing given came back as ' + JSON.stringify(last));
      else console.log('  save forms: the scenario\u2019s words kept, quest flags 77 and 200 and value 5 through the Char block, room 2 entered, ' +
                       'To Do line 114 in slot 10 shown by its text, and prop type 66 given to the hero');
    } catch (e) { fail('save forms', e); }
    /* A record's form names all 32 bytes (25 September 2026): five groups,
       32 flags, the two bytes nothing reads said to be so, and bytes the
       parser carries no field for written through the raw path and read
       back from the rebuilt table. */
    try {
      {
        const f = ctx.charEditHTML(1);
        for (const g of ['Where', 'Looks', 'Stats', 'Behaviour', 'Flags'])
          if (!f.includes('charGroupHead">' + g)) fail('record form', 'no ' + g + ' group');
        const boxes = (f.match(/id="ce-1-flag\d+"/g) || []).length;
        if (boxes !== 32) fail('record form', boxes + ' flag boxes, not 32');
        if (!/move countdown/.test(f) || !/byte 31/.test(f) || /party byte|state byte/.test(f)) fail('record form', 'the relabelled bytes are not as written');
      }
      const before = ctx.loadCharacterTable()[1];
      ctx.applyCharacterRecordEdit(1, { state: before.state | 0x80 }, { 22: 136, 25: 2, 31: 7 });
      const after = ctx.loadCharacterTable()[1];
      if (after.raw[22] !== 136 || after.raw[25] !== 2 || after.raw[31] !== 7 || !(after.raw[8] & 0x80) || after.body !== before.body)
        fail('record form', 'raw bytes did not come back from the rebuilt table: ' + Array.from(after.raw).join(','));
      else if (!ctx.charFlagOn(after, 7) || ctx.charFlagOn(after, 6) !== !!(before.raw[8] & 0x40))
        fail('record form', 'flag 7 is not bit 7 of byte 8');
      else console.log('  record form: five groups, 32 flags, bytes 22, 25 and 31 and flag 7 written and read back');
    } catch (e) { fail('record form', e); }
    // Back to the game archive, and the identity goes back with it. With no
    // hash to carry a view across, the landing is the default one.
    ctx.location.hash = '';
    ctx.parseArchiveBytes(archive, 'Cythera Data (after the saved game)', { via: 'data fork', rsrc: rsrcFork });
    if (ctx.ARCHIVE_FINDER.type !== 'DelS') fail('saved game', 'Cythera Data reopened as ' + JSON.stringify(ctx.ARCHIVE_FINDER));
    if (REGISTRY.get('categorySelect').value !== 'WORLD') fail('saved game', 'Cythera Data did not land back on the world');
  } catch (e) { fail('saved game', e); }
}

