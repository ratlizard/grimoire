// smoke_installer.mjs -- one part of the UI smoke: the installer opened through adoptArchive: its views, the executable, the program's figures and keys, the hero portrait, preferences, the dialogue box, the vocabulary, icons, the installer text and its versions.
// Cut out of viewer_smoke.mjs on 18 September 2026 at a point where the open
// file changes, so it runs from a fresh boot (smoke_boot.mjs) as its own
// process. Run alone with
//   node utilities/viewer_smoke.mjs index.html "$TMPDIR/Cythera Data.data" "" <installers .sit> <saved game> installer
// and with the other parts by naming them; with none named the runner drives
// all six in this process, in order.
import { htmlPath, dataPath, onlyCat, visePath, savePath, html, js, archive, rsrcPath, rsrcFork, missingIds,
         El, REGISTRY, catSel, optionSource, CATEGORY_VALUES, body, documentStub, rafQueue, drainRaf, sandbox,
         ctx, peek, fail, t0, status, A, readFileSync, existsSync, tally } from './smoke_boot.mjs';

// The installer. The page's default input is the whole game as one file,
// and three views exist only when it arrived that way: Data › Installer, and
// the two Combat AI tabs, which were placeholders before. Opened through
// adoptArchive -- the path a dropped file takes -- so that the application's
// fork gallery is also drawn here from the installer, without the fetch the
// bare-archive run above cannot make.
if (visePath && existsSync(visePath) && !onlyCat) {
  try {
    const bin = new Uint8Array(readFileSync(visePath));
    if (!ctx.adoptArchive(bin, 'Cythera.bin', {})) throw new Error(peek('lastArchiveError'));
    if (!ctx.INSTALLER) throw new Error('INSTALLER not set after adopting the installer');
    const drawn = {};
    for (const v of ['INSTALLER', 'AISCRIPTS', 'AIRULES', 'APPRSRC', 'APPPEF', 'APPSND', 'SCREENS', 'FONTS', 'STRINGS']) {
      if (!ctx.showCategory(v)) { fail('installer view ' + v, 'refused'); continue; }
      const grid = REGISTRY.get('sheetGrid');
      const n = (grid.children || []).length;
      drawn[v] = n;
      if (!n) fail('installer view ' + v, 'drew nothing: ' + REGISTRY.get('output').textContent.slice(0, 80));
    }
    // The application's data fork is read, v1.32.0: the PEF's libraries
    // and the routines its traceback tables name, with the sheets' citations
    // as chips into it.
    ctx.showCategory('APPPEF');
    const pefhtml = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
    const pef = ctx.appPef();
    if (!pef || !pef.routines || pef.routines.length < 1800 || !pef.loader || pef.loader.libraries.length !== 10)
      fail('executable', 'the PEF was not read: ' + JSON.stringify(pef && [pef.sections.length, pef.loader && pef.loader.libraries.length, pef.routines && pef.routines.length]));
    else if (!/InterfaceLib/.test(pefhtml) || !/TGameViewer::DoTicks/.test(pefhtml) || !/traceback/.test(pefhtml))
      fail('executable', 'the Data Fork sheet does not list the libraries and the routines');
    else if (peek('TAB_BY_ID').get('apppef').wip) fail('executable', 'the Data Fork tab is still faded with the application open');
    else {
      ctx.openPefRoutine('TMapWindow::KeyRoutine');
      const one = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
      if (!/0x437B8/.test(one) || !/KeyRoutine\(short\)/.test(one)) fail('executable', 'a routine chip does not land on the routine: ' + one.slice(0, 200));
      else console.log(`  executable: ${pef.routines.length} routines named, ${pef.loader.symbols.length} imports from ${pef.loader.libraries.length} libraries; KeyRoutine at 0x437B8`);
    }
    /* The program's figures on the Mechanics sheet, v1.51.0: the clock,
       hunger, healing, poison, the talk balloon, what a command spends and
       who is whose enemy, each read out of the application's code with the
       address of the instruction that holds it. The figures are the shipped
       program's. Two negative controls: a link followed rings the line with
       the number in it and the next address rings a line without it, and
       the hour's shift changed in a copy of the application moves the
       sheet's hour, which a typed figure would not. */
    try {
      const all = el => (el.innerHTML || '') + (el.children || []).map(all).join('');
      const clk = ctx.exeClockRules(), m = clk && clk.model, bark = ctx.exeBarkRules(), costs = ctx.exeActionCosts(), et = ctx.exeEnemyTable();
      const cost = n => { const c = costs.find(x => x.routine.name.startsWith('TGameSys::' + n + '(')); return c && c.cost ? c.cost.v : null; };
      const inRoutine = (val, name) => { const r = val && ctx.exeRoutineAt(val.exe); return !!(r && r.name.startsWith(name + '(')); };
      ctx.showCategory('MECHANICS');
      const mh = all(REGISTRY.get('sheetGrid'));
      // The balloon's figures went to the Barks sheet with its card on 13
      // September 2026. They are the same figures off the same code, so they
      // are still required -- just read from where they now are.
      ctx.showCategory('BARKS');
      const bh = all(REGISTRY.get('sheetGrid'));
      const ringOf = at => { ctx.jumpToExeAt(at); const h = /<span id="listingHit" class="listingHit">([^\n]*)<\/span>/.exec(all(REGISTRY.get('sheetGrid'))); return h ? h[1] : null; };
      if (!m || JSON.stringify(m) !== JSON.stringify({ unitsPerHour: 4096, periods: [4096, 2048, 1365, 1024, 819, 409, 16], levelShift: 1, levelCap: 4, hungerIndex: 0, poisonIndex: 5, fall: 1, deathAt: 1, poisonStep: 1, regenStep: 1 }))
        fail('program figures', 'the clock was misread: ' + JSON.stringify(m));
      else if (!inRoutine(clk.hourShift, 'TGameViewer::DoTicks') || !inRoutine(clk.fall, 'TGameViewer::DoTicks') || !clk.day || clk.day.v !== 98304 || clk.nutritionByte.v !== 27 || clk.levelByte.v !== 19 || clk.healthBytes.map(b => b.v).join() !== '14,15' || clk.magicBytes.map(b => b.v).join() !== '16,17' || clk.statusWord.v !== 6)
        fail('program figures', 'the tick routine’s bytes or the day were misread: ' + JSON.stringify([clk.day, clk.nutritionByte, clk.levelByte, clk.healthBytes, clk.magicBytes, clk.statusWord]));
      else if ([clk.poisonBit, clk.regenBit].map(b => (ctx.exeFlagOfStatusBit(b, clk.statusWord.v) || {}).v).join() !== '9,12')
        fail('program figures', 'the status bits are not flags 9 and 12 by TSpellFX::AddAbility: ' + JSON.stringify(ctx.exeAbilityMap()));
      else if (!bark || bark.ticks.v !== 240 || bark.width.v !== 128 || bark.height.v !== 32 || !inRoutine(bark.ticks, 'TBark::SetBark'))
        fail('program figures', 'the balloon was misread: ' + JSON.stringify(bark));
      else if (cost('MoveCommand') !== 1 || cost('LookCommand') !== 2 || cost('TakeCommand') !== 4 || costs.length < 15)
        fail('program figures', 'the command costs were misread: ' + JSON.stringify(costs.map(c => [c.routine.name, c.cost && c.cost.v])));
      else if (!et || JSON.stringify(et.table.v) !== '[2,2,2,2,2,1,0,0,2,0,1,0,2,0,0,2]' || et.alignmentByte.v !== 25 || !et.enemy || et.enemy.v !== 0 || !et.peace || et.peace.v !== 1)
        fail('program figures', 'the enemy table was misread: ' + JSON.stringify(et));
      // Which character stat each unit byte becomes, off the constructor: the
      // order the wiki doubted, byte 0 body, 1 reflex, 2 mind, 5 health.
      else if ((sc => !sc || [[0, 9, 'body'], [1, 10, 'reflex'], [2, 11, 'mind'], [5, 14, 'health']].some(([b, to, nm]) => !sc[b] || sc[b].to.v !== to || sc[b].name !== nm || !inRoutine(sc[b].to, 'TActiveMonster::TActiveMonster')))(ctx.exeMonsterStatCopy()))
        fail('program figures', 'the unit stat copy was misread: ' + JSON.stringify(ctx.exeMonsterStatCopy()));
      // The hours a hatching egg keeps: day from 6 to 18, off HatchEgg's two
      // clock constants over the clock's units an hour.
      else if ((h => !h || h.dawn.v !== 6 || h.dusk.v !== 18 || !inRoutine(h.dawn, 'TActiveMonster::HatchEgg'))(ctx.exeHatchHours()))
        fail('program figures', 'the hatching hours were misread: ' + JSON.stringify(ctx.exeHatchHours()));
      // The alignment's names: the AI's groups by the value each compares.
      else if ((a => !a || ['neutral', 'evil', 'good', 'feral'].some((n, v) => !a.byValue[v] || a.byValue[v].name !== n || !inRoutine(a.byValue[v].at, 'SCombatAIEntry::CalculateObject')))(ctx.exeAlignmentNames()))
        fail('program figures', 'the alignments were misnamed: ' + JSON.stringify(ctx.exeAlignmentNames()));
      // The five 2012 bed measurements, with the program's clock.
      else if ([[4, {}, 12], [4, { regenerating: true }, 42], [4, { fed: false, regenerating: true }, 30], [3, {}, 10], [3, { regenerating: true }, 35]]
        .some(([q, o, want]) => ctx.mechBedRate(6, q, Object.assign({ fed: true, div: ctx.sleepRules().div.v, clock: m }, o)) !== want))
        fail('program figures', 'the bed rates on the program’s clock do not reproduce the 2012 measurements');
      else if (/the application’s figures are read here/.test(mh) || !new RegExp('jumpToExeAt\\(' + clk.hourShift.exe + '\\)').test(mh) || !/flag <button[^>]*>9<\/button>, poison/.test(mh) || !/every <button[^>]*>30 minutes<\/button> at levels 2 and 3/.test(mh))
        fail('program figures', 'the Mechanics sheet does not state the program’s figures as links');
      else if (!/<b>4 seconds<\/b>/.test(bh) || !new RegExp('jumpToExeAt\\(' + bark.ticks.exe + '\\)').test(bh))
        fail('program figures', 'the Barks sheet does not state the balloon’s figures as links');
      else {
        const hit = ringOf(bark.ticks.exe), miss = ringOf(bark.ticks.exe + 4);
        if (!hit || !/addi 3, 3, 240/.test(hit) || !miss || /240/.test(miss)) fail('program figures', 'following the balloon’s link does not ring its instruction: ' + JSON.stringify([hit, miss]));
        else {
          const app = ctx.APP_DATA, img = ctx.appImage();
          const at = img.pef.sections[img.codeIndex].containerOffset + clk.hourShift.exe;
          const copy = app.slice();
          const w = ((copy[at] << 24) | (copy[at + 1] << 16) | (copy[at + 2] << 8) | copy[at + 3]) >>> 0;
          const moved = ((w & ~(0x1F << 11)) | (11 << 11)) >>> 0;
          copy[at] = moved >>> 24; copy[at + 1] = (moved >>> 16) & 255; copy[at + 2] = (moved >>> 8) & 255; copy[at + 3] = moved & 255;
          ctx.APP_DATA = copy; ctx.APP_PEF = null;
          ctx.showCategory('MECHANICS');
          const changed = all(REGISTRY.get('sheetGrid'));
          const hour = (ctx.exeClockRules().unitsPerHour || {}).v;
          ctx.APP_DATA = app; ctx.APP_PEF = null;
          if (hour !== 2048 || !/1\/<button[^>]*>2048<\/button> of an hour/.test(changed)) fail('program figures', 'the hour did not follow a changed shift in the program: ' + hour);
          else console.log(`  program figures: the clock, ${costs.length} command costs, the balloon and the enemy table read off the code; the balloon's link rings "${hit.replace(/<[^>]*>/g, '').trim().slice(0, 40)}", and a shift of 11 makes the hour ${hour} units`);
        }
      }
    } catch (e) { fail('program figures', e); }
    /* What a signal reaches, 12 September 2026. These figures are the
       APPLICATION's, so they are pinned here and not in the puzzles block.
       signalRules() returns null until the application is adopted, and the
       first version of these pins sat up there guarded by `sg &&`, which
       meant every one of them was skipped and the suite went green having
       tested nothing. Here the application is open, so the reader MUST
       return something: a null is a failure, not a skip.

       The 256 threshold is the figure that matters to the scenario. Every
       signal in it is below the threshold (34 and 35 for the bells, 129 and
       131 for the music locks, 201 to 211 in the Hall of Truth), which is
       why props answer a signal at all; if it were ever read as a smaller
       number the sheet would quietly stop explaining any of those puzzles. */
    try {
      const sg = ctx.signalRules();
      if (!sg) fail('program signals', 'the dispatcher was not read even with the application open');
      else if (!/TGameSys::SendSignal/.test(sg.name)) fail('program signals', 'the wrong routine was read: ' + sg.name);
      else if (!sg.method || sg.method.v !== 21) fail('program signals', 'the message is not method 21, GetMessage: ' + JSON.stringify(sg.method));
      else if (!sg.under || sg.under.v !== 256) fail('program signals', 'the threshold below which things are visited was misread: ' + JSON.stringify(sg.under));
      else if (!sg.slots || sg.slots.v !== 512) fail('program signals', 'the character slot count was misread: ' + JSON.stringify(sg.slots));
      else if (!sg.mask || sg.mask.v !== 0x5D) fail('program signals', 'the flags mask was misread: ' + JSON.stringify(sg.mask));
      else if (sg.sends < 3) fail('program signals', 'only ' + sg.sends + ' dispatches, so the walk through the routine is wrong');
      else if (!sg.gremlin || !/OnSignal/.test(sg.gremlin.name)) fail('program signals', 'the tail call was not found: ' + JSON.stringify(sg.gremlin));
      else if (typeof sg.method.exe !== 'number' || typeof sg.under.exe !== 'number')
        fail('program signals', 'a figure carries no address, so it cannot link to the instruction holding it');
      else console.log(`  program signals: GetMessage to the zone and the room, then things below ${sg.under.v} by Data1, then ${sg.slots.v} character slots, then ${sg.gremlin.name}; ${sg.sends} dispatches`);
    } catch (e) { fail('program signals', e); }
    /* The hero's portrait off the program, v1.111.0: the slot arithmetic in
       TCreatePlayerDialog::GetPortrait and the two ids in CreatePlayer, and
       the hero's page stating them as links with the file's twelve choices,
       each an image that opens its resource. The application is open here,
       so a null is a failure. */
    try {
      const pc = ctx.exePortraitChoice();
      const inRoutine = (val, name) => { const r = val && ctx.exeRoutineAt(val.exe); return !!(r && r.name.startsWith(name + '(')); };
      if (!pc || pc.perRow.v !== 6 || pc.first.v !== 240 || pc.base.v !== 0x87FF || pc.writes.v !== 0x8800)
        fail('hero portrait', 'the portrait choice was misread: ' + JSON.stringify(pc));
      else if (!inRoutine(pc.first, 'TCreatePlayerDialog::GetPortrait') || !inRoutine(pc.writes, 'CreatePlayer'))
        fail('hero portrait', 'a figure is not in the routine that holds it: ' + JSON.stringify(pc));
      else {
        ctx.showCharacterDetail(1);
        const grid = REGISTRY.get('sheetGrid');
        const html = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(grid);
        const titles = []; (function w(el) { if (el.title) titles.push(el.title); (el.children || []).forEach(w); })(grid);
        const opens = titles.filter(t => /^portrait 0x88[0-9A-F]{2}, tap to open$/.test(t));
        if (!new RegExp('jumpToExeAt\\(' + pc.writes.exe + '\\)').test(html) || !/12 here, 0x88EF to 0x88FA, 6 of them one face/.test(html))
          fail('hero portrait', 'the hero’s page does not state the program’s figures as links: ' + html.replace(/<[^>]+>/g, '').slice(0, 300));
        else if (opens.length !== 13 || !opens.includes('portrait 0x8800, tap to open') || !opens.includes('portrait 0x88F0, tap to open'))
          fail('hero portrait', 'the portraits do not open their resources: ' + JSON.stringify(opens));
        else console.log(`  hero portrait: slot ${pc.first.v} + ${pc.perRow.v} a row past ${pc.base.v.toString(16)}, written as ${pc.writes.v.toString(16)}; ${opens.length - 1} choices on the hero’s page, each opening its resource`);
      }
    } catch (e) { fail('hero portrait', e); }
    /* The Cheats sheet off the program, v1.52.0: the gate, every case of the
       key routine's switch, the preferences record scanned out of the whole
       program, what the game stores and the file's keys. The figures pinned
       are the shipped program's; three of them corrected the typed table
       this replaced (option-l, the four-bit frame-rate field, byte 1's
       startup-dialog bits). Negative control: the cheat code's compare
       changed in a copy of the program changes the code the sheet prints. */
    try {
      const all = el => (el.innerHTML || '') + (el.children || []).map(all).join('');
      const kr = ctx.exeKeyRoutine(), fields = ctx.exePrefFields(), defaults = ctx.exePrefDefaults(), keys = ctx.exePrefKeys();
      ctx.showCategory('CHEATS');
      const html = all(REGISTRY.get('sheetGrid'));
      const rows = (html.match(/<td class="cheatCombo">/g) || []).length;
      const caseOf = k => kr.cases.find(c => c.keys.some(x => x.v === k));
      const field = (b, lo, hi) => fields.find(f => f.byte === b && f.lo === lo && f.hi === hi);
      const inRoutine = (exe, name) => { const r = ctx.exeRoutineAt(exe); return !!(r && r.name.startsWith(name + '(')); };
      if (!kr || !kr.gate || kr.gate.word.v !== '©gra' || kr.gate.byte.v !== 3 || kr.gate.bit.v !== 0 || !/^Cheat mode activated/.test(kr.gate.on.v))
        fail('program keys', 'the gate was misread: ' + JSON.stringify(kr && kr.gate));
      else if (kr.cases.filter(c => c.gated).length !== 17 || kr.cases.filter(c => !c.gated).length !== 5 || !caseOf(0xC2) || caseOf(0xC1) || !caseOf(0xB9).fallsInto || caseOf(0xB9).fallsInto !== caseOf(0xA8).at)
        fail('program keys', 'the switch was misread: ' + kr.cases.map(c => c.keys[0].v.toString(16) + (c.gated ? 'g' : '')).join(' '));
      else if (kr.words.slice(1).map(w => w.v).join() !== 'play,stop,paus,next,prev,ejec' || kr.volume.map(v => v.step.v + '/' + (v.bound && v.bound.v)).join() !== '-10/0,10/255')
        fail('program keys', 'the CD words or the volume were misread: ' + JSON.stringify([kr.words.map(w => w.v), kr.volume]));
      else if (!field(0, 2, 5) || field(0, 2, 5).writers.map(w => w.value.v).join() !== '4,6,8' || !field(1, 5, 5) || !field(1, 5, 5).writers.some(w => w.item && w.item.texts[0] === 'Switch to 256 Colors') || !field(1, 4, 4) || field(3, 0, 0).writers.length)
        fail('program keys', 'the preferences record was misread: ' + JSON.stringify(fields.map(f => [f.byte, f.lo, f.hi, f.writers.length, f.readers.length])));
      else if (!defaults || [...new Set(defaults.words.map(w => w.v.toString(16)))].join() !== '18800000,99800000,dbc80000' || defaults.selectors.map(t => t.v).join() !== 'cput,proc')
        fail('program keys', 'the stored defaults were misread: ' + JSON.stringify(defaults));
      else if (keys.map(e => e.key.v).sort().join() !== 'Ambient,Backdrop,CurPlayer,CurScen,Map Window Loc,Music,UI Prefs,Volume')
        fail('program keys', 'the file’s keys were misread: ' + keys.map(e => e.key.v).join());
      else if (rows !== kr.cases.length + 2 || !/option-l/.test(html) || !/broken/.test(html) || /Everyone is hostile/.test(html) || !/enemy/.test(html) || !/0x0864/.test(html) || !/low ten bits/.test(html) || !/class’s own animation/.test(html) || !/Motion Filters/.test(html) || !/Map Window Loc/.test(html) || !/DBC80000/.test(html) || !/2 to 5/.test(html) || !/Don't Ask Again/.test(html))
        fail('program keys', `the Cheats sheet does not state what was read: ${rows} key rows for ${kr.cases.length} cases`);
      else if (!new RegExp('jumpToExeAt\\(' + kr.gate.word.exe + '\\)').test(html) || !inRoutine(kr.gate.word.exe, 'TMapWindow::KeyRoutine') || !new RegExp('jumpToExeAt\\(' + caseOf(0xA0).calls.find(c => /DoTicks/.test(c.v)).args[4].exe + '\\)').test(html))
        fail('program keys', 'the gate’s code or option-t’s 1024 is not a link to its instruction');
      else {
        // The control: the code's compare in a copy of the program.
        const app = ctx.APP_DATA, img = ctx.appImage();
        const at = img.pef.sections[img.codeIndex].containerOffset + kr.gate.word.exe;
        const copy = app.slice();
        copy[at + 3] = (copy[at + 3] + 1) & 255;         // cmplwi 0, 0x7261 -> 0x7262: ©grb
        ctx.APP_DATA = copy; ctx.APP_PEF = null;
        ctx.showCategory('CHEATS');
        const changed = all(REGISTRY.get('sheetGrid'));
        ctx.APP_DATA = app; ctx.APP_PEF = null;
        if (!/©grb/.test(changed) || /©gra/.test(changed.replace(/type ©gra/g, ''))) fail('program keys', 'the sheet did not follow a changed code in the program');
        else console.log(`  program keys: the ©gra gate at byte ${kr.gate.byte.v} bit ${kr.gate.bit.v}, ${kr.cases.length} cases (${kr.cases.filter(c => c.gated).length} gated), ${fields.length} fields of the record, ${keys.length} keys of the file; a changed compare prints ©grb`);
      }
    } catch (e) { fail('program keys', e); }
    // The Tools tab's preferences file, from the program's layout of the
    // record: the switches wear the game's own labels, and the bytes are the
    // ones the file was put in front of the game with.
    try {
      ctx.showCategory('TOOLS');
      const tools = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
      const switches = ['prefSmooth', 'prefCheats', 'prefLiveDrag', 'prefManualContainers', 'prefMotionFilters', 'prefWalkAround', 'prefZoomRects'];
      const missing = switches.filter(id => !new RegExp(`id="${id}"`).test(tools));
      const rec = o => [...ctx.cytheraPrefsRecord(o)];
      const bitsWrong = rec({ liveDrag: true })[0] !== 0x19 || rec({ manualContainers: true })[0] !== 0x58 ||
        rec({ motionFilters: true })[1] !== 0x88 || rec({ walkAround: true })[1] !== 0xC0 || rec({ zoomRects: false })[1] !== 0x00 ||
        rec({ smooth: true, cheats: true }).join() !== [0x9A, 0x80, 0, 1].join();
      if (missing.length) fail('preferences', 'switches missing from the Tools tab: ' + missing.join(', '));
      else if (!/Manually Place Containers/.test(tools) || !/Smoother Movement/.test(tools)) fail('preferences', 'the switches do not wear the game’s own labels');
      else if (bitsWrong) fail('preferences', 'a switch does not land on the bit the program writes for it: ' + JSON.stringify(ctx.cytheraPrefsLayout()));
      else if (/never been tried|untried/.test(tools)) fail('preferences', 'the section still calls the file untried');
      else if (!/replaces any settings already stored/.test(tools)) fail('preferences', 'the section no longer says the file replaces the stored settings');
      else if (!/©gra/.test(tools)) fail('preferences', 'the section does not name the code');
      else if (ctx.buildCytheraPreferences({ cheats: true }).length < 280) fail('preferences', 'the fork came out too small to be one');
      else console.log(`  preferences: ${switches.length} switches on the Tools tab with the game's labels, each bit where the program writes it, ${ctx.buildCytheraPreferences({ smooth: true, cheats: true }).length}-byte fork`);
    } catch (e) { fail('preferences', e); }
    // The dialogue box, drawn now the application is here. The frame is a
    // PNG encoded asynchronously, so it is waited for rather than timed.
    for (let waited = 0; waited < 3000 && !((ctx.__peek('window.DIALOGUE_BOX') || {}).frame); waited += 50) await new Promise(r => setTimeout(r, 50));
    {
      const box = ctx.__peek('window.DIALOGUE_BOX');
      const css = (box && box.css) || '', rd = box && box.read;
      if (!rd || rd.tile.v !== 0x19D || rd.top.v !== 4 || rd.side.v !== 8 || !rd.clut || rd.clut.v !== 256 || !rd.offset || rd.offset.v !== 18) fail('dialogue box', 'the box’s constants were misread from the program: ' + JSON.stringify(rd));
      else if (!box.blue || box.blue.join(',') !== '0,0,168' || !/--boxBlue:rgba\(0,0,168,\.5\)/.test(css)) fail('dialogue box', 'the blue was not read from the clut the program names: ' + JSON.stringify(box) + ' ' + css.slice(0, 80));
      else if (!box.frame || !/border-image-source:url\(data:image\/png;base64,iVBOR/.test(css) || !/border-image-slice:4 8/.test(css)) fail('dialogue box', 'the frame was not built from the tile and bands the program names: ' + css.slice(0, 120));
      else console.log('  dialogue box: blue ' + box.blue.join(',') + ' from clut ' + rd.clut.v + ' at byte ' + rd.offset.v + ', frame from tile 0x' + rd.tile.v.toString(16).toUpperCase() + ' sliced ' + rd.top.v + ' ' + rd.side.v + ', all read off the program');
    }
    ctx.showCategory('AIRULES');
    const rows = (REGISTRY.get('sheetGrid').children || []);
    // The Rules tab has the vocabulary out of the application's fork.
    ctx.showCategory('AIRULES');
    const vocab = REGISTRY.get('sheetGrid').children.find(c => /vocabTable/.test(c.innerHTML || ''));
    if (!vocab || !/HasSpell|IsSpecies/.test(vocab.innerHTML)) fail('combat vocabulary', 'the Rules tab did not draw the AI string lists');
    // And says which words are scripts, with a chip to the first test and
    // the first action, and how a file gets in and is debugged.
    else if (!/Edit User Strategies/.test(vocab.innerHTML) || !/0x0?901/i.test(vocab.innerHTML) || !/0x0?981/i.test(vocab.innerHTML))
      fail('combat vocabulary', 'the Rules tab does not say which words are scripts, or does not link them');
    // The same lists name the scripted tests and actions, in order: with the
    // application's fork open 0x906 is the sixth test and 0x981 the first
    // action, and the class rule from the executable puts 0x1E20 among the
    // rooms and 0x19xx among the monsters. The helper names are the static
    // table, fork or no fork.
    {
      const n906 = ctx.dvmResourceName(0x906), n981 = ctx.dvmResourceName(0x981), nF00 = ctx.dvmResourceName(0xF00);
      const c1E = ctx.dvmClassName(0x1E20), c19 = ctx.dvmClassName(0x1901), c98 = ctx.dvmClassName(0x981);
      if (!/OutOfAmmo/.test(n906) || !/CastSpell/.test(n981) || !/SetCharacterFlag/.test(nF00) || c1E !== 'Room' || c19 !== 'Monster' || c98 !== 'AIAction')
        fail('script names', JSON.stringify({ n906, n981, nF00, c1E, c19, c98 }));
      else console.log(`  script names: 0x906 is ${n906}, 0x981 is ${n981} off the application's lists; 0x1E20 is a Room and 0x1901 a Monster by the executable's rule`);
      const lbl = ctx.labelForUnnormalized(0x98D);
      if (!/SetProtecting/.test(lbl)) fail('script names', 'the gallery label for 0x98D is ' + JSON.stringify(lbl));
    }
    // A Finder icon on the installer's rows for the four bundled types.
    const icons = { APPL: ctx.finderIconFor('APPL'), DelS: ctx.finderIconFor('DelS'), DelP: ctx.finderIconFor('DelP'), TEXT: ctx.finderIconFor('TEXT') };
    if (!icons.APPL || !icons.DelS || !icons.DelP) fail('finder icons', 'bundle gave ' + JSON.stringify(Object.fromEntries(Object.entries(icons).map(([k, v]) => [k, !!v]))));
    else if (icons.TEXT) fail('finder icons', 'a TEXT file got an icon the bundle does not give it');
    else console.log('  finder icons: application, data file and saved game drawn from the bundle; TEXT has none');
    /* The Data tabs wearing the icons of the files themselves, 14 September
       2026. This is the half that needs the application open, and it can only
       run here: navIconFromFork answers null without window.APP_RSRC, which
       adoptArchive above is what sets. The bare-archive run earlier in this
       file has no application at all, which is the fallback case -- every one
       of these nodes keeps a tile beside its file icon for exactly that, and
       the tabs draw there without any of this.

       The two cursors are required to differ, and it is worth being exact
       about what that proves. rsrcArtifacts memoises per type:id, so two
       distinct ids always yield two distinct canvas objects: comparing them
       by identity catches both forks NAMING THE SAME ID -- the easy mistake,
       since both cursors are 16x16 and 2-bit -- and nothing more. Two
       different ids that happened to draw the same picture would pass. */
    {
      const byId = peek('TAB_BY_ID');
      const node = id => (byId && byId.get ? byId.get(id) : null);
      const art = id => { const n = node(id); return n ? ctx.navIconFromFork({ tile: n.tile, finder: n.finder, crsr: n.crsr, installed: n.installed }) : null; };
      // Combat AI comes out of the installer rather than the game: the custom
      // icon of the folder, which on a classic Mac is an invisible Icon file
      // inside it, at -16455.
      const want = ['cytheradata', 'cythera', 'savegame', 'apppef', 'apprsrc', 'combatai'];
      /* The VISE mark is in the installer's own resource fork, and whether
         that fork is in hand depends on the container it arrived in. A
         MacBinary carries it; archive.org's four-in-one StuffIt compressed it
         with method 15 (Arsenic), which this page does not decompress, so
         through the page's own default source there is no mark to draw and
         the tab keeps its tile. Both outcomes are correct; which one is
         asserted follows what the caller passed, as in vise_check.mjs. */
      const viseFork = ctx.INSTALLER && ctx.INSTALLER.container && ctx.INSTALLER.container.rsrc;
      const haveVise = !!(viseFork && viseFork.length);
      if (haveVise) want.push('installer');
      const drawn = {};
      for (const id of want) { const a = art(id); drawn[id] = !!(a && a.width); }
      const lacking = want.filter(id => !drawn[id]);
      // The two that name no file icon at all, so they must fall through to
      // the tile: the Combat AI scripts and the rules they are written
      // against are TEXT files, which no bundle here claims.
      const plain = ['aiscripts', 'airules'].concat(haveVise ? [] : ['installer']).filter(id => art(id));
      const c257 = art('apppef'), c259 = art('apprsrc');
      const sameCursor = c257 && c259 && c257 === c259;
      if (!byId || !byId.get) fail('data tab icons', 'TAB_BY_ID is not reachable, so the tabs cannot be read');
      else if (lacking.length) fail('data tab icons', 'a Data tab draws no icon from the open application: ' + lacking.join(', '));
      else if (plain.length) fail('data tab icons', 'a tab that names no file icon got one anyway: ' + plain.join(', '));
      else if (sameCursor) fail('data tab icons', 'both application forks resolved to the same cursor, so one of the two ids is wrong');
      else console.log('  data tab icons: ' + want.length + ' Data tabs drawn from the file itself (' +
        node('apppef').crsr + ' and ' + node('apprsrc').crsr + ' for the application’s two forks, the CombatAI folder' +
        (haveVise ? ' and the VISE mark' : '') + ' out of the installer), the two TEXT tabs' +
        (haveVise ? '' : ' and the installer, whose fork this container compressed with Arsenic,') + ' on their tiles');
    }
    // Read the licence through the button the table offers, then take a file away.
    ctx.showCategory('INSTALLER');
    const arc = ctx.INSTALLER.archive;
    const lic = arc.entries.find(e => /License/.test(e.name));
    ctx.showInstallerText(lic.index);
    const pre = REGISTRY.get('installerText');
    if (!pre || !/Cythera/.test(pre.textContent)) fail('installer text', 'the licence did not render');
    const saved = ctx.__downloads ? ctx.__downloads.length : -1;
    ctx.downloadInstallerFile(arc.entries.find(e => /Notes/.test(e.name)).index);
    const tabs = ['combatai', 'aiscripts', 'airules'].map(id => peek('TAB_BY_ID').get(id).wip);
    if (tabs.some(Boolean)) fail('installer tabs', 'the Combat AI tabs are still faded with the files present');
    // The open release is named on the tab, on the Data file button and at
    // the head of the sheet; Installer stands first under Data, and Data
    // still opens on Cythera Data.
    ctx.showCategory('INSTALLER');
    const badge = REGISTRY.get('installerVersionBadge');
    const btn = REGISTRY.get('archiveMenuBtn');
    if (!badge || !/^\d+(\.\d+)+$/.test(badge.textContent)) fail('installer version', 'no version badge on the Installer tab');
    if (!btn || btn.textContent !== 'Settings') fail('installer version', 'the Settings button is not named so: ' + (btn && btn.textContent));
    const opened = (REGISTRY.get('sheetGrid').children || []).find(c => c.className && /installerOpen/.test(c.className));
    if (!opened) fail('installer version', 'the sheet does not say which installer is open');
    const dataNode = peek('TAB_BY_ID').get('data');
    if (dataNode.children[0].id !== 'installer') fail('installer tab', 'Installer is not first under Data');
    // A folder reopens where it was left (here: the Installer tab, just
    // visited), and its declared starting point is Cythera Data, not the
    // first child -- that is what `last:` in the tree is for.
    ctx.showCategory('135');
    ctx.selectTab('data');
    if (REGISTRY.get('categorySelect').value !== 'INSTALLER') fail('installer tab', 'Data did not reopen where it was left: ' + REGISTRY.get('categorySelect').value);
    if (!/id: 'data',[^\n]*last: 'cytheradata'/.test(js)) fail('installer tab', 'the Data folder no longer declares Cythera Data as where it opens first');
    // A file with several versions: the chips are drawn and one of them
    // opens another release through the whole load path.
    if (ctx.INSTALLER.installers.length > 1) {
      ctx.showCategory('INSTALLER');
      const chips = (REGISTRY.get('sheetGrid').children || []).filter(c => c.className && /installerVersions/.test(c.className));
      if (!chips.length) fail('installer versions', 'no version row drawn for a file with ' + ctx.INSTALLER.installers.length + ' installers');
      const before = peek('ARCHIVE.bytes').length;
      ctx.switchInstaller('Cythera 1.0.1 Installer');
      const after = peek('ARCHIVE.bytes').length;
      if (ctx.INSTALLER.picked !== 'Cythera 1.0.1 Installer' || after === before)
        fail('installer versions', `switch to 1.0.1 left ${ctx.INSTALLER.picked} open (${before} -> ${after} bytes)`);
      else console.log(`  installer versions: ${ctx.INSTALLER.installers.length} in the file; 1.0.1 opened, ${before} -> ${after} bytes, status "${REGISTRY.get('sourceStatus').textContent.slice(0, 70)}"`);
      // Every gallery again, on the oldest release.
      let bad = 0;
      for (const v of CATEGORY_VALUES) { try { if (!ctx.showCategory(v)) bad++; } catch (e) { bad++; if (bad <= 2) fail('1.0.1 gallery ' + v, e); } }
      if (bad) fail('installer versions', bad + ' galleries failed on 1.0.1');
    }
    console.log(`  installer: ${arc.entries.length} files; views drew ${Object.entries(drawn).map(([k, n]) => k + '=' + n).join(' ')}; licence read; a .bin offered${saved >= 0 ? ' (' + (ctx.__downloads.length - saved) + ' download)' : ''}`);
  } catch (e) { fail('installer', e); }
}

