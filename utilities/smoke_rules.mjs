// smoke_rules.mjs -- one part of the UI smoke: the rules sheets: mechanics, damage, aim, cures and grants, the to-do and the eggs, the library, loose ends and puzzles, the face, the world tab's marks, zone landscapes, talk, the file figures, cheats and preferences.
// Cut out of viewer_smoke.mjs on 18 September 2026 at a point where the open
// file changes, so it runs from a fresh boot (smoke_boot.mjs) as its own
// process. Run alone with
//   node utilities/viewer_smoke.mjs index.html "$TMPDIR/Cythera Data.data" "" <installers .sit> <saved game> rules
// and with the other parts by naming them; with none named the runner drives
// all six in this process, in order.
import { htmlPath, dataPath, onlyCat, visePath, savePath, html, js, archive, rsrcPath, rsrcFork, missingIds,
         El, REGISTRY, catSel, optionSource, CATEGORY_VALUES, body, documentStub, rafQueue, drainRaf, sandbox,
         ctx, peek, fail, t0, status, A, readFileSync, existsSync, tally, withoutApp, readoptApp } from './smoke_boot.mjs';

// Mechanics: two rules read out of the scripts on the spot. The balloon
// catalogue must find the lines the trace found by hand, and the dice
// section must state the payout the script pays.
try {
  // The sheet as a visitor with no application sees it, which the checks
  // below on where its figures come from are written for.
  const html = withoutApp(() => { ctx.showCategory('MECHANICS'); return (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid')); });
  const dice = ctx.diceGame();
  const mechSecs = (function count(el) { return (el.className === 'mechSec' ? 1 : 0) + (el.children || []).map(count).reduce((a, b) => a + b, 0); })(REGISTRY.get('sheetGrid'));
  const mechFolds = (function count(el) { return ((el.tagName || '').toUpperCase() === 'DETAILS' && el.className === 'mechSec' ? 1 : 0) + (el.children || []).map(count).reduce((a, b) => a + b, 0); })(REGISTRY.get('sheetGrid'));
  // Skills and Spells: each one a card, read off its own script.
  ctx.showCategory('SKILLS');
  const skhtml = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  const skills = ctx.skillCatalogue();
  const sword = skills.find(x => x.name === 'Sword'), gambling = skills.find(x => x.name === 'Gambling'), attack = skills.find(x => x.name === 'Attack');
  if (!(sword && sword.teachers.some(t => t.who === 4) && sword.weapons.length && /\[aptitude \/ ability\] to use a sword/.test(sword.description))) fail('skills', 'Sword is not a unit: ' + JSON.stringify(sword && [sword.description, sword.teachers, sword.weapons.length]));
  else if (!(gambling && gambling.askedBy.includes(0x812) && gambling.lessons.length >= 2)) fail('skills', 'Gambling does not say the dice game asks about it, or has no lessons: ' + JSON.stringify(gambling && [gambling.askedBy, gambling.lessons]));
  else if (!(attack && /\[aptitude \/ training\]/.test(attack.description))) fail('skills', 'the inline alternative was not read: ' + (attack && attack.description));
  else if (!/openCharacter\(4\)/.test(skhtml) || !/Thievery/.test(skhtml) || !/Regroup/.test(skhtml)) fail('skills', 'the Skills sheet does not show the teacher chip, Thievery, or the commands');
  else {
    // Since v1.30.0 a card is a <details> with the game's own 32x16 icon
    // (subindex 137, icon n for class 0x1A00|n) in its summary where the
    // file has one -- twelve of the skills do, every spell does -- and a
    // teacher is cited by portrait, not sprite.
    // Counted by `skillCard`, not `mechSec`: since 13 September 2026 the
    // sheet also carries the moved "what each skill is asked about" card,
    // which is a bare mechSec, and counting those would make this the number
    // of skills plus one for as long as anything else is ever added here.
    const folds = (function count(el) { return ((el.tagName || '').toUpperCase() === 'DETAILS' && /\bskillCard\b/.test(el.className || '') ? 1 : 0) + (el.children || []).map(count).reduce((a, b) => a + b, 0); })(REGISTRY.get('sheetGrid'));
    const icons = (skhtml.match(/class="skillIcon"/g) || []).length;
    if (folds !== skills.filter(x => x.kind !== 'command').length || icons < 10 || !/relFace/.test(skhtml)) fail('skills', `not folding cards with icons and portraits: ${folds} of ${skills.length} fold, ${icons} icons, portrait ${/relFace/.test(skhtml)}`);
    else console.log(`  skills: ${skills.length} in the block, ${skills.filter(x => x.kind !== 'command').length} skills and ${skills.filter(x => x.kind === 'command').length} commands, each a folding card; ${icons} wear the game's icon`);
  }
  ctx.showCategory('SPELLS');
  const sphtml = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  if (!/Fireball/.test(sphtml) || !/25 \+ a random number from 0 to 9/.test(sphtml) || !/burst of flame/.test(sphtml) || !/Level 8/.test(sphtml)) fail('spells', 'the Spells sheet does not show Fireball with its damage and description by level');
  else if ((sphtml.match(/class="skillIcon"/g) || []).length < ctx.spellRules().spells.length) fail('spells', 'not every spell wears its icon: ' + (sphtml.match(/class="skillIcon"/g) || []).length);
  else console.log('  spells: each a folding card, by level, with its icon, damage and description');
  // GIF: a header, the right size, and a frame per palette when the picture cycles.
  {
    const gif = ctx.encodeGIF(4, 3, [{ indexed: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]), palette: ctx.__peek('PAL_RGB') }], { delayMs: 100, transparentIndex: 0 });
    const head = String.fromCharCode(...gif.slice(0, 6));
    const w = gif[6] | (gif[7] << 8), h = gif[8] | (gif[9] << 8);
    const gif2 = ctx.encodeGIF(2, 2, Array.from({ length: 8 }, (_, f) => ({ indexed: new Uint8Array([0xE0, 0xE1, 0xE2, 0xE3]), palette: ctx.cycledPalette(f) })), { delayMs: 140, transparentIndex: 0 });
    if (head !== 'GIF89a' || w !== 4 || h !== 3 || gif[gif.length - 1] !== 0x3B) fail('gif', 'the GIF header or trailer is wrong: ' + head + ' ' + w + 'x' + h);
    else if (!(gif2.length > gif.length && String.fromCharCode(...gif2.slice(0x30D, 0x30D + 3)) === '!\xff\x0b'.replace('\\xff', '\xff'))) fail('gif', 'an eight-frame GIF has no loop block after its global table: ' + gif2.length);
    else console.log('  gif: GIF89a, ' + gif.length + ' bytes for a 4x3, and a looping eight-frame one for a cycling picture');
  }
  // The puzzles added on 3 October 2026 (passwordRules, leverRules,
  // teleportMazes). Pinned: five passwords, each a whole word from Selinus
  // that its door's keyword begins, given after twice its number of books
  // and with one placed door; the levers' doors are only classes that answer
  // a signal (the control: a Cademia lever's Data1 equals three beds', which
  // must not be listed); and the mazes are the two zones whose kind-1 eggs
  // land in themselves, zone 40 also titled Omen's Test.
  try {
    const pw = ctx.passwordRules(), lv = ctx.leverRules(), mz = ctx.teleportMazes();
    const said = pw ? pw.words.filter(w => w.word) : [];
    const bed = lv && lv.levers.find(l => l.zone === 8 && l.x === 34 && l.y === 84);
    if (said.length !== 5 || said.some(w => !w.word.v.toLowerCase().startsWith(w.key) || w.doors.length !== 1 || !w.gate || w.gate.v !== w.n.v) || !pw.every || pw.every.v !== 2)
      fail('puzzles', 'the passwords are not five words, each with its door and gate: ' + JSON.stringify(said.map(w => [w.key, w.word && w.word.v, w.doors.length, w.gate && w.gate.v])));
    else if (!lv || lv.levers.length < 30 || !bed || bed.reach.length !== 1 || bed.reach.some(o => ctx.propDisplayName(o.pt) === 'bed'))
      fail('puzzles', 'the levers are not read, or a bed answers one: ' + JSON.stringify(bed && bed.reach));
    else if (mz.map(m => m.zone).join() !== '14,40' || !mz[1].titles.some(t => t.v === "Omen's Test"))
      fail('puzzles', 'the teleporting mazes are not Pnyx and Omen\u2019s Test: ' + JSON.stringify(mz.map(m => [m.zone, m.titles.map(t => t.v)])));
    else console.log('  puzzles: 5 passwords with their doors, ' + lv.levers.length + ' levers with no bed among what they open, mazes in ' + mz.map(m => m.zone).join(' and '));
  } catch (e) { fail('puzzles', e); }
  // The ditherizer's frames: a hole with a box inside the picture, and the
  // Seldane ramp. 0x887E's hole kept its braid to ring 9 by a rule of its
  // own until 3 October 2026; it is its family's frame now (Ignae, Omen and
  // Ur-Sylph compared), so the hole is one region and stays inside ring 7.
  // The ramp is the portraits' blues and cyans by lightness: a grey
  // gradient drawn on it must climb, never fall, from one end to the other.
  {
    const fm = ctx.ditherFrameMask(0x88A2);
    const fm2 = ctx.ditherFrameMask(0x887E);
    const tones = ctx.seldaneTones();
    const pal = ctx.__peek('PAL_RGB'), Y = i => 0.3 * pal[i][0] + 0.59 * pal[i][1] + 0.11 * pal[i][2];
    const Wg = 256, grad = new Uint8Array(Wg * 4);
    for (let x = 0; x < Wg; x++) { grad[x * 4] = grad[x * 4 + 1] = grad[x * 4 + 2] = x; grad[x * 4 + 3] = 255; }
    const flat = ctx.ditherToCytheraPalette(grad, Wg, 1, { checker: 0, tones });
    let falls = 0; for (let x = 1; x < Wg; x++) if (Y(flat[x]) < Y(flat[x - 1])) falls++;
    const used = new Set(flat).size;
    if (!(fm.box && fm.box.x0 > 2 && fm.box.y0 > 2 && fm.box.x1 < 62 && fm.box.y1 < 62 && fm.box.x1 - fm.box.x0 > 30)) fail('dither', 'the frame 0x88A2 has no sensible hole: ' + JSON.stringify(fm.box));
    else if (!(fm2.box && fm2.box.x0 >= 7 && fm2.box.y0 >= 7 && fm2.box.x1 <= 56 && fm2.box.y1 <= 56 && fm2.hole[32 * 64 + 32])) fail('dither', 'the hole of 0x887E cuts into the braid: ' + JSON.stringify(fm2.box));
    else if (!(tones.includes(3) && tones.includes(11) && tones.includes(255) && !tones.includes(0) && tones.length < 30)) fail('dither', 'the Seldane ramp is not the portraits’ blues and cyans with black: ' + JSON.stringify(tones));
    else if (falls || used !== tones.length) fail('dither', 'a grey gradient on the Seldane ramp does not climb through every step: ' + falls + ' falls, ' + used + ' of ' + tones.length + ' steps');
    else console.log('  dither: frame 0x88A2 holds a ' + (fm.box.x1 - fm.box.x0 + 1) + 'x' + (fm.box.y1 - fm.box.y0 + 1) + ' picture, 0x887E keeps its braid outside ring 7, the Seldane ramp is ' + tones.length + ' steps and a gradient climbs through all of them');
  }
  // The frames the portraits share (sharedPortraitFrames), as the ditherizer
  // offers them: the grape frame is exactly Ariethous's, Dares's and
  // Diomede's, the guards' is all nine, the white field of the fountain and
  // the door is no frame and not offered, nor are the three the list names
  // with a rule of their own; and a shared frame's hole takes the middle of
  // the picture with the frame, the portrait's own pixels, kept around it.
  // Not a box inset from the edge: the grape frame is open at its sides and
  // its hole runs to within a pixel of them.
  {
    const offered = ctx.ditherSharedFrames();
    const has = r => offered.find(f => f.members.includes(r));
    const grapes = has(0x8811), guards = has(0x8806);
    const fm = ctx.ditherFrameMask(0x8811);
    let kept = 0, frameN = 0;
    const own = ctx.decodeResource(ctx.__peek('ARCHIVE'), ctx.getResourceBytes(ctx.__peek('ARCHIVE'), 0x8811), 135, 0x8811).image;
    for (let i = 0; i < 4096; i++) if (!fm.hole[i]) { frameN++; if (fm.frame[i] === own[i]) kept++; }
    if (!grapes || grapes.members.join() !== [0x8811, 0x882C, 0x882D].join()) fail('frames', 'the grape frame is not exactly 0x8811, 0x882C and 0x882D: ' + JSON.stringify(grapes && grapes.members));
    else if (!guards || guards.members.length !== 9) fail('frames', 'the guards\u2019 frame is not all nine: ' + JSON.stringify(guards && guards.members));
    else if (has(0x88BC) || has(0x88A2) || has(0x88F2)) fail('frames', 'a white field or a frame with its own rule is offered as a shared frame');
    else if (!has(0x887E)) fail('frames', 'Ur-Sylph\u2019s family frame is not offered');
    else if (!(fm.box && fm.hole[32 * 64 + 32] && fm.box.x1 - fm.box.x0 > 30 && fm.box.y1 - fm.box.y0 > 30 && frameN >= 1500 && kept === frameN)) fail('frames', 'the grape frame\u2019s hole or frame is wrong: ' + JSON.stringify(fm.box) + ', ' + kept + ' of ' + frameN);
    else console.log('  frames: ' + offered.length + ' shared frames offered, the grapes\u2019 of three portraits and the guards\u2019 of nine, the white field left out; the grape frame keeps ' + frameN + ' pixels round a ' + (fm.box.x1 - fm.box.x0 + 1) + 'x' + (fm.box.y1 - fm.box.y0 + 1) + ' hole');
  }
  // A frame of items (itemFramePixels). The axe at the corners lands where
  // Meleager's frame has it, every pixel of the top two. The edges, with an
  // L four wide and three high between plain corners so that nothing
  // overlaps: the L as drawn at the top, the sides the top turned (the
  // whole frame is its own transpose), the bottom the top flipped and the
  // right side the left mirrored.
  {
    const A = ctx.__peek('ARCHIVE'), items = ctx.ditherItemTiles(), axe = items.find(t => t.name === 'axe');
    const mel = ctx.decodeResource(A, ctx.getResourceBytes(A, 0x8821), 135, 0x8821).image;
    const f = axe ? ctx.itemFramePixels(ctx.resolveTileImage(axe.tile), null, 64, 64) : new Uint8Array(4096);
    let top = 0, same = 0;
    for (let i = 0; i < 2048; i++) if (f[i]) { top++; if (f[i] === mel[i]) same++; }
    const tile = () => new Uint8Array(1024);
    const block = tile(), L = tile();
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) block[(10 + y) * 32 + 12 + x] = 5;
    for (const [x, y] of [[0, 0], [0, 1], [0, 2], [1, 2], [2, 2], [3, 2]]) L[(20 + y) * 32 + 7 + x] = 9;
    const g = ctx.itemFramePixels(block, L, 64, 64), at = (x, y) => g[y * 64 + x];
    let bad = 0;
    for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) {
      if (at(x, y) !== at(y, x)) bad++;
      if (x >= 8 && x < 56 && at(x, y) !== at(x, 63 - y)) bad++;
      if (y >= 8 && y < 56 && at(x, y) !== at(63 - x, y)) bad++;
    }
    const drawn = [at(8, 0), at(8, 1), at(8, 2), at(9, 2), at(11, 2), at(9, 0), at(9, 1)].join();
    if (!axe || top !== 206 || same !== top) fail('item frame', 'the axe corners are not where Meleager\u2019s frame has them: ' + same + ' of ' + top + ' pixels');
    else if (drawn !== '9,9,9,9,9,0,0' || bad) fail('item frame', 'the edges are not the item as drawn at the top, turned at the sides and mirrored opposite: ' + drawn + ', ' + bad + ' pixels off');
    else console.log('  item frame: ' + items.length + ' items to build a frame of; the axe corners are Meleager\u2019s to the pixel, and an edge is laid as drawn, turned and mirrored');
  }
  // One animation setting drives the three flags.
  {
    const before = ctx.ANIM_MODE;
    ctx.setAnimMode('tiles');
    const a = [ctx.PALETTE_ANIM, ctx.MAP_ANIM, ctx.SPRITE_ANIM];
    ctx.setAnimMode('graphics');
    const b = [ctx.PALETTE_ANIM, ctx.MAP_ANIM, ctx.SPRITE_ANIM];
    ctx.setAnimMode('off');
    const c = [ctx.PALETTE_ANIM, ctx.MAP_ANIM, ctx.SPRITE_ANIM];
    ctx.setAnimMode(before || 'all');
    if (JSON.stringify([a, b, c]) !== '[[true,false,false],[true,false,true],[false,false,false]]') fail('animation', 'the setting does not set the flags as documented: ' + JSON.stringify([a, b, c]));
    else console.log('  animation: one setting — tiles, graphics, off — sets the three flags');
  }
  // The font swap: a font from today, made fit for the game, into the fork.
  {
    const fs = await import('node:fs');
    // The deep-link check above re-opened the data fork alone; the swap needs
    // the resource fork, so the archive is opened once more with it.
    if (!peek('window.CYTHERA_RSRC') && rsrcFork) { ctx.parseArchiveBytes(archive, 'Cythera Data (for the font swap)', { via: 'data fork', rsrc: rsrcFork }); readoptApp(); }
    const paths = ['/System/Library/Fonts/Supplemental/Andale Mono.ttf', process.env.TMPDIR + '/Argos_from_fork.ttf'];
    let tried = 0;
    for (const path of paths) {
      let b; try { b = new Uint8Array(fs.readFileSync(path)); } catch (e) { continue; }
      tried++;
      const before = peek('window.CYTHERA_RSRC_RAW').length;
      const r = ctx.swapGameFont(b, path.replace(/^.*\//, ''));
      const fork = peek('window.CYTHERA_RSRC');
      const e = fork.resourcesByType['sfnt'].find(x => x.id === r.from);
      const back = fork.dataOf('sfnt', e);
      // it must read back as a font, and out again for a browser
      const tt = ctx.sfntToTrueType(back);
      // and it must carry a Mac Roman subtable, which is the whole point
      const c = (function () { const n = ((back[4] << 8) | back[5]); for (let i = 0; i < n; i++) { const p = 12 + i * 16; if (String.fromCharCode(back[p], back[p + 1], back[p + 2], back[p + 3]) === 'cmap') return back.subarray((back[p + 8] << 24 >>> 0) + (back[p + 9] << 16) + (back[p + 10] << 8) + back[p + 11]); } return null; })();
      const macSub = c && (function () { const n = (c[2] << 8) | c[3]; for (let i = 0; i < n; i++) { const p = 4 + i * 8; if (((c[p] << 8) | c[p + 1]) === 1) return true; } return false; })();
      if (!(r.mapped > 60 && back.length > 1000 && tt.length > 1000 && macSub)) fail('font swap', path + ': ' + JSON.stringify([r.mapped, back.length, tt.length, macSub]));
      else if (peek('window.CYTHERA_RSRC_RAW').length === before && b.length > 30000) fail('font swap', 'the fork did not change size');
      ctx.undoFontSwap();
      if (peek('window.CYTHERA_RSRC_RAW').length !== before) fail('font swap', 'undo did not put the original fork back');
    }
    let refused = '';
    try { ctx.trueTypeToSfnt(new Uint8Array([0x4F, 0x54, 0x54, 0x4F, 0, 1, 0, 0, 0, 0, 0, 0])); } catch (e) { refused = e.message; }
    if (!peek('window.CYTHERA_RSRC')) fail('font swap', 'no resource fork to swap a font into');
    else if (!/PostScript/.test(refused)) fail('font swap', 'an .otf was not refused with a reason: ' + refused);
    else if (!tried) console.log('  font swap: no test font on this machine, only the refusal checked');
    else console.log('  font swap: ' + tried + ' font(s) put in the fork and taken back out, each with a Mac Roman map');
  }
  // Questions, answered from the tables rather than by searching the text.
  {
    const ask = q => { let a = null; try { a = ctx.answerQuestion(q); } catch (e) { a = null; } return a ? String(a).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ') : null; };
    const want = [['who teaches axe', /Thersites/], ['what does fireball do', /burst of flame/],
                  ['what cures poison', /clears Poisoned/], ['who says Yum', /Alaric/],
                  ['what is a lich immune to', /non-magical/], ['who is Alaric', /Land King Hall/],
                  ['how much is a sword', /45/], ['what does haggling do', /haggle better/]];
    const bad = want.filter(([q, re]) => { const a = ask(q); return !a || !re.test(a); }).map(x => x[0]);
    const through = ['fire', 'who teaches basketry', 'what does xyzzy do'].filter(q => ask(q));
    if (bad.length) fail('ask', 'these questions were not answered from the file: ' + bad.join('; '));
    else if (through.length) fail('ask', 'these should have fallen through to the text search: ' + through.join('; '));
    else console.log('  ask: ' + want.length + ' question shapes answered off the tables, and a word search still falls through');
  }
  // A link can name what the file does not have, and a GIF needs a frame.
  {
    let threw = null;
    try { ctx.showCharacterDetail(999); } catch (e) { threw = e.message; }
    const said = /no character 999/i.test(REGISTRY.get('sheetGrid').textContent || '');
    let gifRefused = '';
    try { ctx.encodeGIF(2, 2, [], {}); } catch (e) { gifRefused = e.message; }
    if (threw) fail('guards', 'a character the file does not have threw: ' + threw);
    else if (!said) fail('guards', 'a character the file does not have said nothing');
    else if (!/at least one frame/.test(gifRefused)) fail('guards', 'an empty GIF was not refused: ' + gifRefused);
    else console.log('  guards: a link to a character that is not there says so, and an empty GIF is refused');
    ctx.showCharacterDetail(2);
  }
  // The engine's light cones, listed and unread until now.
  {
    const fs = await import('node:fs');
    let app = null;
    try { app = ctx.openResourceFork(new Uint8Array(fs.readFileSync(process.env.TMPDIR + '/Cythera.rsrc'))); } catch (e) {}
    const list = app && app.resourcesByType['Lite'];
    if (!list) console.log('  light cones: no application fork on this machine, not checked');
    else {
      const sides = [];
      let drawn = 0;
      for (const e of list) {
        const l = ctx.decodeLite(app.dataOf('Lite', e));
        if (l && l.canvas.width === l.side && l.canvas.height === l.side && l.max === 32 && l.centre === 32) { drawn++; sides.push(l.side); }
      }
      if (drawn !== list.length) fail('light cones', drawn + ' of ' + list.length + ' decoded');
      else if (Math.min(...sides) !== 8 || Math.max(...sides) !== 120) fail('light cones', 'the sides are not 8 to 120: ' + sides.join(','));
      else console.log('  light cones: all ' + drawn + ' decoded and drawn, sides ' + Math.min(...sides) + ' to ' + Math.max(...sides) + ', brightest 32 at the middle');
    }
  }
  ctx.showCategory('BARKS');
  const bhtml = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  if (!/Hot Kabobs!/.test(bhtml) || !/openCharacter\(2\)/.test(bhtml)) fail('barks', 'the Barks tab does not list the lines with their speakers');
  ctx.showCharacterDetail(2);
  const dossier = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  if (!/Says/.test(dossier) || !/Yum/.test(dossier)) fail('barks', 'Alaric’s dossier does not say “Yum”');
  const barks = ctx.buildBarkCatalogue();
  const words = new Set(barks.flatMap(b => b.words));
  const need = ['Yum', 'Spare an obol?', 'Zzzz...', 'More wine!', 'Hot Kabobs!', 'Poisoned!'];
  const missing = need.filter(w => !words.has(w));
  if (barks.length < 40 || missing.length) fail('mechanics', `${barks.length} balloon sites; missing ${missing.join(', ') || 'nothing'}`);
  else if (!dice || dice.wins !== 96 || dice.pushes !== 50 || dice.losses !== 70) fail('mechanics', 'the dice enumeration is not 96/50/70: ' + JSON.stringify(dice && [dice.wins, dice.pushes, dice.losses]));
  else if (!/win (?:<button[^>]*>)?2(?:<\/button>)? oboloi/.test(html) || !/216/.test(html)) fail('mechanics', 'the dice section does not state the rules');
  // The spells card moved to the Spells sheet on 13 September 2026; sphtml
  // is that sheet, captured above.
  else if (!/resist non-magical weapons: [^<]*lich/.test(sphtml)) fail('mechanics', 'the spells card does not name the monsters immune to non-magical damage')
  else if (!/Prop Records: Type, Aspect, Data1 and Data2/.test(html) || !/Data1 on a melee weapon is its enchantment/.test(html) || !/extremely sharp edge/.test(html) || !/Placed with an enchantment/.test(html) || !/pass it to ChangeZone/.test(html)) fail('mechanics', 'the prop word section is missing or does not say what it read')
  else if (mechSecs < 15) fail('mechanics', `the sections are missing: ${mechSecs} sections`);
  // No application in this run, so none of its figures: the clock, the
  // balloon and the enemy table say where they come from and state nothing.
  // The installer section below opens the application and requires them.
  else if (!/to read the program’s figures here/.test(html) || /jumpToExeAt\(/.test(html) || /4096 is one hour|four seconds|one off every game hour|128×32/.test(html)) fail('mechanics', 'with no application open the sheet states a figure of the program, or does not say where the figures come from');
  else if (mechFolds < mechSecs || (html.match(/mechOpenAll\(/g) || []).length < 2) fail('mechanics', `the sections do not fold: ${mechFolds} of ${mechSecs} are details, open/close all ${(html.match(/mechOpenAll\(/g) || []).length}`);
  // The dice game's numbers are read off 0x812 with their offsets, v1.31.0:
  // three dice of six, the skill's roll of six, a match paying 2 at 0x0506,
  // the two branch targets at 0x047C and 0x0492 -- read by hand off the
  // plaintext before the reader was written.
  else if (!(dice.faces.join() === '6,6,6' && dice.matchPay === 2 && dice.skillFaces === 6 && !dice.skillAlways && !dice.skillFree && dice.bytes.length === 7 &&
             dice.bytes.some(b => b.at === 0x0506 && b.now === 2) && dice.bytes.some(b => b.at === 0x0492 && b.target && b.next === 0x0494) && dice.bytes.some(b => b.at === 0x047C && b.target && b.next === 0x047E) && dice.bytes.some(b => b.at === 0x045E && b.now === 6)))
    fail('mechanics', 'the dice constants were not read off the script with their offsets: ' + JSON.stringify(dice && dice.bytes));
  else if (!/What to edit/.test(html) || !/0x0506/.test(html) || !/a match pays nothing/.test(html) || !/every game you play with the skill is a match/.test(html))
    fail('mechanics', 'the dice section does not say what to edit');
  else if (!ctx.gearTable().some(r => r.name === 'axe' && r.damage === 22 && r.skill === 'Axe') || !ctx.gearTable().some(r => r.name === 'spear' && r.reach === 2) || !ctx.gearTable().some(r => r.name === 'bow' && r.ammoClass === 1 && r.reach === 5)) fail('mechanics', 'the gear table does not name the axe’s damage and skill, the spear’s reach, or the bow’s ammunition and range');
  else if (!(ctx.combatRules() && ctx.combatRules().d30 && ctx.combatRules().parry && ctx.combatRules().words.length >= 8)) fail('mechanics', 'the combat rules were not read: ' + JSON.stringify(ctx.combatRules()));
  /* The weapon-skill term in 0xE87 reads the shield loop's local, which the
     loop always leaves at None, so it adds nothing (17 September 2026, traced
     through the interpreter). Both terms, the margin's and the damage's, and
     both at a `local` read: a reader that matched the intended `arg Arg02`
     would find none, and one that matched any EAC call would find the shield
     loop's own Shield-skill call as well and count three. */
  else if (!ctx.combatRules().skillOffLoop || ctx.combatRules().skillOffLoop.length !== 2 || ctx.combatRules().skillOffLoop.some(s => s.resid !== 0xE87)) fail('mechanics', 'the resolver reading the weapon skill off the shield loop was not found as two terms: ' + JSON.stringify(ctx.combatRules().skillOffLoop));
  // The attack routine (0x3042): every clause the sheet states is a pattern
  // over the listing, so each is required here, and the two throw figures
  // must come off the spear's own class rather than a typed table.
  else if (!(function () { const ar = ctx.attackRules(); return ar && ar.squared && ar.lessOne && ar.reach && ar.range && ar.launcher && ar.meleeFirst && ar.beyondAdjacent && ar.flies && ar.lodges && ar.drops && ar.bodyRoll && ar.reflexRoll && ar.scale && ar.scale.sub === 12 && ar.scale.div === 4 && ar.bodyAddVal && ar.bodyAddVal.v === 1 && ar.ammoSpent; })()) fail('mechanics', 'the attack routine was not read: ' + JSON.stringify(ctx.attackRules()));
  else if (!/knight’s move/.test(html) || !/hits or meets a parry/.test(html) || !/body less (?:<button[^>]*>)?12(?:<\/button>)? over (?:<button[^>]*>)?4(?:<\/button>)?/.test(html) || !/uses up one piece of ammunition per shot/.test(html)) fail('mechanics', 'the attack rules are not on the sheet');
  else if (!ctx.gearTable().some(r => r.name === 'spear' && r.reach === 2 && r.thrownDamage === 10 && r.thrownRange === 4) || !ctx.gearTable().some(r => r.name === 'mystic spear' && r.reach === 1 && r.thrownDamage === 25 && r.thrownRange === 8) || !ctx.gearTable().some(r => r.name === 'sword' && r.thrownDamage === null)) fail('mechanics', 'the throw figures were not read off the spear classes');
  else if (ctx.spellRules().spells.length < 35 || !ctx.spellRules().spells.some(x => /Fireball/.test(x.name) && x.level === 5 && x.cost === 20) || !(ctx.spellRules().rule && ctx.spellRules().rule.failure)) fail('mechanics', 'the spells were not read: ' + ctx.spellRules().spells.length);
  else if ((function () { const fx = ctx.spellEffects(); const sp = ctx.spellRules().spells; const by = n => fx.get((sp.find(x => x.name === n) || {}).resid); const fb = by('Fireball'), ds = by('Death Strike'), lh = by('Lesser Healing'), tr = by('Tremor'); return !(fb && fb.damage[0] && fb.damage[0].amount.base === 25 && fb.damage[0].amount.rolls[0][1] === 10 && fb.damage[0].type === 8 && /target square/.test(fb.damage[0].who)) || !(ds && ds.damage[0].amount.base === 200) || !(lh && lh.heals[0] && /health \+ 5 \+ a random number from 1 to 4/.test(lh.heals[0].text)) || !(tr && tr.damage[0].amount.rolls.length === 2 && tr.damage[0].who === 'every enemy'); })()) fail('mechanics', 'the spell effects were misread: ' + JSON.stringify([...ctx.spellEffects()].slice(0, 3)))
  else if (!(ctx.sleepRules() && ctx.sleepRules().own === 4 && ctx.sleepRules().half && ctx.sleepRules().quarter && ctx.sleepRules().inns.some(x => x.who === 41 && x.quality === 3) && ctx.sleepRules().inns.length === 3)) fail('mechanics', 'the sleep rule was misread: ' + JSON.stringify(ctx.sleepRules()))
  else if (ctx.hungerNotes().falls || ctx.hungerNotes().complains !== 4) fail('mechanics', 'hunger was misread: ' + JSON.stringify(ctx.hungerNotes()));
  else if (!(ctx.skillConsultations().by.get(0xCF) || new Set()).has(0x812)) fail('mechanics', 'Gambling is not listed as asked about by the dice game');
  else if (!ctx.karmaRules().writes.some(w => w.set === 55) || JSON.stringify(ctx.karmaRules().byAlignment) !== '[1,4,-10,0]') fail('mechanics', 'karma does not start at 55 or the kill table is not 1,4,-10,0: ' + JSON.stringify(ctx.karmaRules().byAlignment));
  else if (!(ctx.experienceRules().rule && ctx.experienceRules().rule.cap && ctx.experienceRules().rule.doubling) || !ctx.experienceRules().awards.some(a => a.amount === 100)) fail('mechanics', 'the experience rule or a 100-point award was not read');
  else if (!ctx.foodRules().potions.some(p => /Antidote/.test(p.name) && p.does.some(d => /clears Poisoned/.test(d))) || !ctx.foodRules().potions.some(p => /Healing/.test(p.name) && p.does.some(d => /health \+10/.test(d)))) fail('mechanics', 'the potions were not read: ' + JSON.stringify(ctx.foodRules().potions.map(p => [p.name, p.does])));
  else if (!ctx.foodRules().foods.some(f => f.variants && f.variants.length > 5)) fail('mechanics', 'the foodstuff class did not give a value per variant');
  // v1.43.0: which classes read their aspect, and the line a food says.
  // The mushroom steak class indexes a string table by the aspect (three
  // lines), the flatbread class says one line for every variant, and no
  // weapon class reads the field at all.
  else if ((function () { const ar = ctx.aspectReaders(); const reads = [...ar.values()].filter(v => v.reads).length; return !(ar.size > 150 && reads >= 20 && reads < 60 && (ar.get(213) || {}).reads && (ar.get(0x1F) || {}).reads && !(ar.get(100) || {}).reads && !(ar.get(94) || {}).reads && ctx.gearTable().every(r => !(ar.get(r.pt) || {}).reads)); })()) fail('mechanics', 'the aspect readers were not counted as expected: ' + JSON.stringify([...ctx.aspectReaders()].filter(([, v]) => v.reads).map(([pt]) => pt)));
  else if ((function () { const f = ctx.foodRules().foods.find(f => f.pt === 213), b = ctx.foodRules().foods.find(f => f.pt === 69); return !(f && f.saysPer && f.variants.length === 3 && f.variants[1].name === 'dried jellyfish' && f.variants[1].plus === 8 && f.variants[1].says === 'Yetch!' && f.variants[0].says === 'Not very good' && b && !b.saysPer && b.variants.every(v => v.says === 'Tasty')); })()) fail('mechanics', 'the foods’ lines were not read: ' + JSON.stringify(ctx.foodRules().foods.filter(f => f.variants).map(f => [f.pt, f.saysPer, f.variants.map(v => v.says)])));
  else if (!/of 180<\/b> item classes also read it/.test(html) || !/No weapon or piece of armor reads it/.test(html) || !/0x0464/.test(html) || !/dried jellyfish<\/b> that feeds <button[^>]*jumpToScriptAt[^>]*>\+8<\/button> and says <button[^>]*jumpToScriptAt[^>]*>“Yetch!”<\/button>/.test(html) || !/<button[^>]*>“Not very good”<\/button>/.test(html)) fail('mechanics', 'the prop record section does not say which classes read their aspect, or the spear and mushroom steak contrast is missing or its figures and lines are not links');
  else if (!(ctx.statusRules().applies.get('Sleep') || []).some(a => a.duration === 4096) || !(ctx.statusRules().cures.get('Poisoned') || new Set()).size) fail('mechanics', 'status effects were not read: sleep for 4096, poison cleared');
  else if (!(ctx.lockRules().rule && ctx.lockRules().rule.formula && ctx.lockRules().needsSkill) || !ctx.lockRules().classes.some(c => c.name === 'chest' && c.words[0] === 15)) fail('mechanics', 'the lock rule or the chest’s parameter was not read');
  else if (!ctx.shopRules().shops.some(sp => sp.who === 30 && sp.goods.some(g => g.name === 'Sword' && g.price === 45)) || !ctx.shopRules().haggling) fail('mechanics', 'Milcom’s sword at 45 or the haggling roll was not read');
  else if (!ctx.trainingRules().teachers.some(t => t.who === 101 && t.skills.has(0xC5) && t.skills.has(0xC6)) || ctx.trainingRules().points.atStart !== 4 || !ctx.trainingRules().points.perLevel) fail('mechanics', 'Thersites’ axe and mace or the training points were not read: ' + JSON.stringify(ctx.trainingRules().points));
  // The figures, and the models under them. Everything below this line was
  // added with the charts on 6 September 2026: a figure that silently draws
  // nothing looks exactly like a figure that is not there, and the sheet is
  // long enough that nobody would notice for a month.
  else if ((html.match(/class="dCell"/g) || []).length !== 36) fail('mechanics', `the dice matrix is not 36 cells: ${(html.match(/class="dCell"/g) || []).length}`);
  else if ((html.match(/class="mechFig"/g) || []).length < 12) fail('mechanics', `only ${(html.match(/class="mechFig"/g) || []).length} figures on the sheet`);
  else if (!/preserveAspectRatio="none"/.test(html) || !/<polyline/.test(html)) fail('mechanics', 'no plotted curve reached the sheet');
  else if (!/class="mechStack"/.test(html) || !/class="mechBars"/.test(html) || !/class="mechLine"/.test(html)) fail('mechanics', 'a stack, a bar group or a number line is missing');
  // The models agree with the page's own enumeration of the same game. Two
  // implementations of the dice payout, so a change to either shows here.
  // The model is handed what diceGame() read; it has no numbers of its own.
  else if (Math.round(ctx.mechDiceExact(dice.opts).wins * 216) !== 96 || Math.round(ctx.mechDiceExact(dice.opts).losses * 216) !== 70) fail('mechanics', 'the model does not enumerate 96/70: ' + JSON.stringify([ctx.mechDiceExact(dice.opts).wins * 216, ctx.mechDiceExact(dice.opts).losses * 216]));
  else if (Math.abs(ctx.mechDiceExact(dice.opts).mean - dice.fair) > 1e-9 || Math.abs(ctx.mechDiceExact(Object.assign({ gambling: true }, dice.opts)).mean - dice.skilled) > 1e-9) fail('mechanics', `the model and diceGame() disagree about the edge: ${ctx.mechDiceExact(dice.opts).mean} vs ${dice.fair}`);
  // The simulator plays the same arithmetic and tallies what it played.
  else if ((function () { ctx.diceSimReset(); ctx.diceSimPlay(500); const t = peek('DICE_SIM').tally; return !(t && t.games === 500 && t.wins + t.pushes + t.losses === 500); })()) fail('mechanics', 'the dice simulator did not play 500 games');
  else if (!/500 games/.test(ctx.diceSimHtml())) fail('mechanics', 'the simulator does not say what it played');
  // The staircase the lock figure exists to show, and which way it rounds:
  // the difficulty term is (data1 + 19) / 20 * 5, so 1 through 20 are one
  // lock and only a difficulty of nothing is free.
  else if ((function () { const lk = ctx.lockRules().rule.lk, c = (r, d) => ctx.mechLockChance(r, d, lk); return !(lk && c(20, 1) === c(20, 20) && c(20, 1) < c(20, 0) && c(20, 21) < c(20, 20)); })()) fail('mechanics', 'the lock chance is not a staircase rounding up in steps of twenty');
  // The combat figure over the archive's own weapons: the three outcomes
  // must account for every exchange and the blow words for every hit.
  else if ((function () {
    const p = ctx.combatSimParams(), cb = ctx.combatRules(), x = ctx.mechCombatExact({ attackerReflex: 20, defenderReflex: 20, weaponSkill: 8, attackSkill: 4, defenceSkill: 4, enchant: 0, damage: p.weapon.damage, shieldBlock: p.shield ? p.shield.block : null, shieldSkill: 8, roll: cb.roll.v, rollDefender: cb.rollDefender.v, dmgAdd: cb.dmgAdd.v }, cb.words, cb.last.word);
    return !(p.weapon && p.weapon.damage > 0 && Math.abs(x.miss + x.parry + x.hit - 1) < 1e-9 && Math.abs(x.words.reduce((s, w) => s + w.p, 0) - x.hit) < 1e-9);
  })()) fail('mechanics', 'the combat model does not account for every exchange: ' + JSON.stringify(ctx.combatSimParams().weapon));
  else if (!/lands/.test(ctx.combatSimHtml(ctx.combatSimParams(), ctx.combatRules())) || !/grazed|shredded/.test(ctx.combatSimHtml(ctx.combatSimParams(), ctx.combatRules()))) fail('mechanics', 'the combat figure names neither the outcome nor a blow');
  // The body roll the attack routine adds to the figure, as the figure works
  // it out from the three numbers it reads: a body of 25 is a roll of 0 to 3,
  // four values, and anything under 16 adds nothing. The figure says so for
  // its default body of 20, a roll of 0 to 2.
  else if ((function () { const ar = ctx.attackRules(); return !(ctx.combatBodyRoll(25, ar) === 4 && ctx.combatBodyRoll(15, ar) === 1 && ctx.combatBodyRoll(5, ar) <= 1 && ctx.combatBodyRoll(25, null) === 0); })()) fail('mechanics', 'the body roll is not worked out from 0xE90 and 0x3042');
  else if (!/A body of 20 adds a random number from 0 to 2 to the /.test(ctx.combatSimHtml(ctx.combatSimParams(), ctx.combatRules()))) fail('mechanics', 'the combat figure does not say what the body roll adds');
  // Body for reflex (0xE88), and the unit field it tests: the top half of
  // the flag word, which the program serves as field 51 by shifting the long
  // right sixteen and the low half as field 50 by clearing it. Each of the
  // top half's four bits is named where a script tests it, and only there:
  // 0xE88 and 0xE87 one each, the default ResistDamage two. The count is the
  // shipped file's (the fighter, the guard and most of the people), the
  // hero's unit not among them.
  else if (!(function () { const b = ctx.combatRules().bodyForReflex; return b && b.v === 1 && b.resid === 0xE88; })()) fail('mechanics', 'body for reflex was not read off 0xE88: ' + JSON.stringify(ctx.combatRules().bodyForReflex));
  else if (!(function () { const f = ctx.exeMonsterFields().fields, h = n => (f.find(x => x.field === n) || {}).half; return h(50) === 'low' && h(51) === 'high'; })()) fail('mechanics', 'the two halves of the unit flags were not read off GetField');
  else if (!(function () { const t = ctx.monsterTopFlagSites(), r = b => (t.get(b) || {}).resid; return r(1) === 0xE88 && r(2) === 0x3040 && r(4) === 0x3040 && r(8) === 0xE87 && t.size === 4; })()) fail('mechanics', 'the top half of the unit flags is not found tested where it is: ' + JSON.stringify([...ctx.monsterTopFlagSites()]));
  else if (ctx.unitsWithTopFlag(1).length !== 21 || !/use their <b>(?:<button[^>]*>)?body(?:<\/button>)?<\/b> instead of their reflex\./.test(html) ||
           !/use their <b>(?:<button[^>]*>)?body(?:<\/button>)?<\/b> instead of their reflex \((?:<button[^>]*>)?21(?:<\/button>)? of the \d+ units, not the hero’s\)/.test((function () { ctx.showCategory('MECHANICS'); return (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid')); })()))
    fail('mechanics', 'the combat section does not say who fights with the body, with the program open, and only then: ' + ctx.unitsWithTopFlag(1).length);
  else if (/unidentified/.test(ctx.monsterFlagsHTML(0x00014004)) || !/fights with its body/.test(ctx.monsterFlagsHTML(0x00014004))) fail('mechanics', 'the fighter\'s flags are not all named: ' + ctx.monsterFlagsHTML(0x00014004));
  else if (!/The margin starts from the body, 25,/.test(ctx.combatSimHtml(Object.assign({}, ctx.combatSimParams(), { body: 25, bodyForReflex: true }), ctx.combatRules()))) fail('mechanics', 'the combat figure does not start the margin from the body when asked');
  else if (withoutApp(() => ctx.monsterTopFlagSites().size !== 0 || ctx.recordFieldMap(0xF008).length !== 11 || /fights with its body/.test(ctx.monsterFlagsHTML(0x00014004)))) fail('mechanics', 'the top half of the unit flags is named with no program open');
  else if (ctx.recordFieldMap(0xF008).length !== 12 || !ctx.recordFieldMap(0xF008).some(r => r.off === 8 && r.width === 2 && r.field === 51) || !ctx.recordFieldMap(0xF008).some(r => r.off === 10 && r.width === 2 && r.field === 50)) fail('mechanics', 'the unit record does not split the flags into their two fields');
  else console.log(`  mechanics: ${barks.length} balloon sites catalogued, ${words.size} distinct lines; the dice game stated and enumerated; ${(html.match(/class="mechFig"/g) || []).length} figures drawn; ${ctx.gearTable().length} gear classes, ${ctx.skillConsultations().by.size} skills asked about, ${ctx.karmaRules().writes.length} karma writes, ${ctx.experienceRules().awards.length} fixed awards, ${ctx.foodRules().potions.length} potions and ${ctx.foodRules().foods.length} foods, ${ctx.statusRules().applies.size} statuses, ${ctx.shopRules().shops.length} shops, ${ctx.trainingRules().teachers.length} teachers, ${ctx.spellRules().spells.length} spells`);
} catch (e) { fail('mechanics', e); }

/* Damage to things, 11 September 2026: every class with a TakeDamage of its
   own read off its script, not the metal door's arithmetic stated as a rule.
   The figures are the shipped file's and each must arrive with the offset
   it was read at: the ring the link paints is checked to land on the line
   holding that number, and on nothing when the offset is one the listing
   does not reach (the negative control, without which a ring painted on
   the first line would pass). */
try {
  const dt = ctx.damageTakers();
  const row = pt => dt.rows.find(r => r.pt === pt) || {};
  const md = row(3), sd = row(10), ch = row(141), cf = row(142), cr = row(67), at = row(317);
  const tab = r => (r.types || []).map(t => t.mask.v + (t.op === 'mul' ? '*' : '/') + t.k.v).join(' ');
  ctx.showCategory('MECHANICS');
  const html = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  if (dt.rows.length < 19) fail('damage', `only ${dt.rows.length} classes take damage by a rule of their own`);
  else if (tab(md) !== '4*2 1/2 2/4' || md.rule !== 'door' || !md.strength || md.strength.v !== 15) fail('damage', 'the metal door was misread: ' + JSON.stringify([tab(md), md.rule, md.strength]));
  else if (!sd.data1Below || sd.data1Below.v !== 128 || sd.strength.v !== 255) fail('damage', 'the stone door’s Data1 guard or strength was misread: ' + JSON.stringify([sd.data1Below, sd.strength]));
  else if (ch.rule !== 'chest' || ch.strength.v !== 10 || cf.strength.v !== 8 || cr.rule !== 'data2' || !cr.data2Default || cr.data2Default.v !== 5) fail('damage', 'the chest, coffer or crate was misread: ' + JSON.stringify([ch.strength, cf.strength, cr.rule, cr.data2Default]));
  else if (!at.onlyType || at.onlyType.v !== 1026 || !at.xp || at.xpWhileBelow.v !== 10) fail('damage', 'the archery target was misread: ' + JSON.stringify([at.onlyType, at.xp, at.xpWhileBelow]));
  else if (!dt.door || dt.door.destroy.factor.v !== 5 || !dt.door.magicOnlyDestroyed || dt.chest.destroy.factor.v !== 3 || dt.door.wear.v !== 2 || dt.door.step.v !== 1) fail('damage', 'the door or chest helper was misread: ' + JSON.stringify([dt.door && dt.door.destroy, dt.chest && dt.chest.destroy]));
  else if ([/Damage to Things/, /The door is now bashed open!/, /It is slightly dented, but still intact\./, /a bare hand/].some(re => !re.test(html))) fail('damage', 'the Mechanics section does not state the door and chest rules in the file’s words: missing ' + [/Damage to Things/, /The door is now bashed open!/, /It is slightly dented, but still intact\./, /a bare hand/].filter(re => !re.test(html)).join(' '));
  else if (!new RegExp('jumpToScriptAt\\(' + 0xE49 + ',' + dt.door.destroy.factor.at + '\\)').test(html)) fail('damage', 'the door’s destroying factor is not a link to its line');
  else {
    // Follow the factor's link, as a click would, and read the ring: in the
    // raw listing it is the operand's own line, and in the structured one,
    // which a visit opens on since 23 September 2026, the statement holding it.
    const ringOf = () => /<span id="listingHit" class="listingHit">([^\n]*)<\/span>/.exec(REGISTRY.get('textContent').innerHTML || '');
    ctx.jumpToScriptAt(0xE49, dt.door.destroy.factor.at);
    const sring = ringOf();
    ctx.setScriptFold(false);
    ctx.jumpToScriptAt(0xE49, dt.door.destroy.factor.at);
    const ring = ringOf();
    const was = peek('window.LISTING_AT');
    ctx.setScriptFold('structured');
    ctx.jumpToResource(0xE49);
    peek('paintDecodedPane')();
    const cleared = !/listingHit/.test(REGISTRY.get('textContent').innerHTML || '');
    // An operand byte rings its instruction's line; an offset before the
    // first object rings nothing.
    const within = peek('listingLineFor')('function obj_0000(1 args, 0 locals) {\n  0003      byte 0x05\n  0005      end\n}', 0x0004);
    const before = peek('listingLineFor')('\nfunction obj_0010(1 args, 0 locals) {\n  0003      byte 0x05\n}', 0x0004);
    if (!ring || !/byte 0x05/.test(ring[1])) fail('damage', 'following the factor did not ring the line that holds it: ' + JSON.stringify(ring && ring[1]));
    else if (!sring || !/\* 5\)/.test(sring[1])) fail('damage', 'in the structured listing the factor rings ' + JSON.stringify(sring && sring[1]) + ', not its statement');
    else if (!was || was.resid !== 0xE49) fail('damage', 'the ring was not kept for the jump');
    else if (!cleared) fail('damage', 'a plain jump to the same script kept the ring');
    else if (within !== 1 || before !== -1) fail('damage', 'listingLineFor rings the wrong line: ' + JSON.stringify([within, before]));
    else console.log(`  damage: ${dt.rows.length} classes read off their own TakeDamage; the door rule (${dt.door.destroy.factor.v} times the strength) and the chest rule (${dt.chest.destroy.factor.v}) stated; a figure's link rings its line`);
  }
} catch (e) { fail('damage', e); }

/* What a use is aimed at, the ground and the water, 11 September 2026.
   Four readings a Discord conversation asked for, each of which the page
   states from the file: the word a script returns when it wants a target
   (and so which spells need a neighbour), what the swamp and lava do to
   whoever stands on them, what each fountain is, and the roll behind the
   unguent's cure. The trap they share is a pattern that stops matching and
   takes its sentence away with it, so the figures are checked against the
   readers and the sentences against the sheet. The unguent is named on
   purpose: its Examine returns 0 from the same shape as a prompt earlier in
   the resource, and taking the first match dropped the whole script. */
try {
  const tg = ctx.targetRules(), tn = ctx.terrainRules(), wt = ctx.springRules();
  const cures = ctx.chanceCures(), grants = ctx.grantRules(), bl = ctx.blastRules();
  ctx.showCategory('MECHANICS');
  const html = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  const reach = tg.filter(t => t.word & 0x8000);
  const spells = tg.filter(t => t.kind === 'spell');
  const link = t => new RegExp('jumpToScriptAt\\(' + t.resid + ',' + t.val.at + '\\)');
  const unguent = tg.find(t => t.resid === 0x118A);
  const mineral = wt && wt.kinds.find(k => k.clears.length >= 4);
  const swampChance = tn && tn.swamp && tn.swamp.chance ? tn.swamp.chance.hi.v - tn.swamp.chance.lo.v : null;
  if (tg.length < 40 || !spells.length) fail('aim', `only ${tg.length} scripts ask for a target, ${spells.length} of them spells`);
  else if (!unguent || unguent.word !== 8) fail('aim', 'the unguent’s prompt was not reached: a script whose Examine returns first is being dropped');
  else if (!reach.length || reach.length === tg.length) fail('aim', 'every target or none wants a neighbour: ' + reach.length + ' of ' + tg.length);
  else if (!link(unguent).test(html) || !link(reach[0]).test(html)) fail('aim', 'a target word is not a link to the line that holds it');
  else if (!/What a Use Can Be Aimed At/.test(html) || !/within reach/.test(html)) fail('aim', 'the Mechanics sheet does not state what a use is aimed at');
  else if (!tn || !tn.swamp || !tn.lava) fail('ground', 'the ground script was misread: ' + JSON.stringify([!!(tn && tn.swamp), !!(tn && tn.lava)]));
  else if (!tn.swamp.flag || tn.swamp.flag.v !== 31 || tn.swamp.flagName !== null || tn.lava.flagName !== 'Lava Proof') fail('ground', 'the flags that protect were misread: ' + JSON.stringify([tn.swamp.flagName, tn.lava.flagName]));
  else if (!new RegExp(String(swampChance)).test(html) || !/Ouch! Something bit me!/.test(html) || !/Ouch! That's hot!/.test(html)) fail('ground', 'the sheet does not state the swamp and the lava in the file’s words');
  else if (!wt || wt.kinds.length < 8 || !mineral) fail('water', 'the fountain kinds were misread: ' + JSON.stringify(wt && wt.kinds.length));
  else if (!wt.gate || !wt.setter || wt.setter.pt !== 0x25) fail('water', 'the state behind the changing water, or what sets it, was misread: ' + JSON.stringify([wt.gate && wt.gate.state.v, wt.setter && wt.setter.name]));
  else if (!/Springs and Fountains/.test(html) || !/heavy taste of/.test(html)) fail('water', 'the sheet does not state the fountains');
  else if (!cures.length || cures[0].hi.v - cures[0].lo.v < 2) fail('cures', 'no cure with a roll behind it was read');
  else if (!grants.some(g => g.pt === 0x135 && g.flagName === 'Lava Proof') || !grants.some(g => g.clearedBy)) fail('grants', 'the worn statuses were misread: ' + JSON.stringify(grants.map(g => g.name + '/' + g.flagName)));
  else if (!bl || !bl.centre || !bl.edge || bl.centre.v <= bl.edge.v) fail('blast', 'the bomb was misread: ' + JSON.stringify(bl && [bl.centre, bl.edge, bl.corner]));
  else console.log(`  aim and ground: ${tg.length} scripts ask for a target, ${reach.length} of them a neighbour; the swamp bites one step in ${swampChance} and lava does ${tn.lava.plus.v} to ${tn.lava.roll.hi.v - 1 + tn.lava.plus.v}; ${wt.kinds.length} kinds of water, ${mineral.clears.length} statuses cleared by the mineral spring; the unguent cures one time in ${cures[0].hi.v - cures[0].lo.v}; the bomb ${bl.centre.v}/${bl.edge.v}/${bl.corner.v}`);
} catch (e) { fail('aim', e); }

/* The To Do list and the eggs, 12 September 2026. Two readers whose whole
   point is that the names mislead. delvmod's AddQuest is cbAddToDo: it
   writes a line in the To Do window and sets none of the game's state, so
   the sheet must not call it a quest. An egg's aspect is a kind the file
   never names, and flags 0x44 is ROOF rather than EGG -- taking the two
   together ringed 298 roofs as triggers until this batch, so a kind above
   ten is the negative control for that returning. What is pinned besides:
   the join to the text array by its own index field rather than by array
   position, the lines that name the informant instead of the errand, and
   the single line composed from a quest value, which is the only way the
   ten counting lines are reached at all. */
try {
  const td = ctx.todoRules(), eg = ctx.eggKinds();
  ctx.showCategory('MECHANICS');
  const html = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  const slots = new Set(td.adds.map(a => a.slot.v)), done = new Set(td.dones.map(d => d.slot.v));
  const never = [...slots].filter(s => !done.has(s));
  const mism = td.adds.filter(a => !a.state && a.line.v !== a.slot.v);
  const counted = td.adds.filter(a => a.state);
  const first = td.adds[0];
  const link = first && new RegExp('jumpToScriptAt\\(' + first.resid + ',' + first.slot.at + '\\)');
  const rooms = eg && eg.rooms;
  if (!td.adds.length || !td.dones.length) fail('todo', `${td.adds.length} lines added, ${td.dones.length} struck off`);
  else if (!td.lines || !td.lines.size) fail('todo', 'the lines were not joined to the text array');
  else if (!td.lines.get(first.slot.v)) fail('todo', 'a slot has no line: the join is by array position rather than by the index field');
  else if (!mism.length) fail('todo', 'no line differs from its slot, so the alternates were missed');
  else if (counted.length !== 1) fail('todo', `${counted.length} lines are composed from a quest value, expected one`);
  else if (!never.length) fail('todo', 'every line is struck off somewhere, so the ones that never are were missed');
  else if (!/The To Do List/.test(html) || !link.test(html)) fail('todo', 'the sheet does not state the list with its lines as links to them');
  else if (/adds a quest|completes a quest/.test(html)) fail('todo', 'the sheet still calls a To Do line a quest');
  else if (!eg) fail('eggs', 'no egg was read off the zone lists');
  else if (eg.kinds.some(k => k.kind > 10)) fail('eggs', 'an egg kind above ten: roofs are being counted as eggs again');
  else if (!eg.roofs) fail('eggs', 'no roof was seen, so the flags 0x44 half of the census is not being reached');
  else if (!rooms || rooms.named < rooms.total * 0.9) fail('eggs', 'kind 8 is not the rooms: ' + JSON.stringify(rooms));
  else if (!/What an Egg Does/.test(html) || !/a room/.test(html)) fail('eggs', 'the sheet does not say what an egg does');
  else console.log(`  to do and eggs: ${td.adds.length} lines added and ${td.dones.length} struck off over ${slots.size} slots, ${mism.length} naming the informant and ${never.length} never struck off; ${eg.kinds.reduce((n, k) => n + k.n, 0)} eggs of ${eg.kinds.length} kinds in ${eg.zones} zones, ${rooms.named} of ${rooms.total} rooms with a script of their own, ${eg.roofs} roofs kept out`);
} catch (e) { fail('todo', e); }

/* Which creatures an egg hatches, 13 September 2026. The inspector has named
   them one egg at a time since the reading was new; the sheet said only that
   a kind-0 egg "holds what it hatches as contained records" and never which,
   so the archive's whole hatching census is on it now.

   The join is the thing that can go wrong quietly. containerContents matches
   records whose `container` equals the egg's `index`, and both are positions
   within ONE zone's prop list -- hand it the wrong list and it matches
   nothing, `eg.hatch` comes back empty, the table is omitted altogether and
   the section looks exactly as it did before. No error, no gap on screen.
   That is what this pins against, and the figure it is held to is a previous
   reading's, arrived at independently of this code: 327 held records across
   311 of the archive's 312 kind-0 eggs. A count is the control; "the table
   is present" would pass on an empty one. */
try {
  const eg = ctx.eggKinds();
  ctx.showCategory('MECHANICS');
  const html = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  const hatch = (eg && eg.hatch) || [];
  const held = hatch.reduce((n, h) => n + h.n, 0);
  const top = hatch[0];
  const name = top ? (ctx.propDisplayName(top.proptype) || '') : '';
  if (!hatch.length) fail('egg creatures', 'no creature joined to any egg: containerContents matched nothing and the table is silently absent');
  else if (held < 300) fail('egg creatures', held + ' held records across the hatching eggs, where the reading found 327');
  else if (hatch.length < 2) fail('egg creatures', 'every egg hatches the same one thing, which the archive does not');
  else if (!name) fail('egg creatures', 'the commonest hatched creature has no name: prop ' + top.proptype);
  else if (!/What they hatch/.test(html)) fail('egg creatures', 'the section does not carry the creature table');
  else if (!html.includes(name)) fail('egg creatures', 'the table does not name ' + name + ', its commonest creature');
  else console.log(`  egg creatures: ${hatch.length} kinds of creature over ${held} held records, commonest ${name} across ${top.zones.size} zones; ${eg.emptyEggs} egg(s) hold nothing`);
} catch (e) { fail('egg creatures', e); }

/* The library, the loose ends and the puzzles, 12 September 2026. The
   library's "written, never shown" list is the part that can be wrong in a
   way nobody would notice, and it was wrong twice while it counted only
   placed props: three Sapphire volumes are handed over by Itanos, Prusa and
   Unhayt, and the Wine Contract by Apis. So the check names those four and
   requires them NOT to be listed -- a reader that forgets `sys Create`
   fails here rather than quietly publishing four wrong claims. The puzzle
   half pins what the community independently reverse-engineered: seven
   tables of sixteen, the first of them the identity, and fourteen buttons.

   Two of the puzzle pins are there to catch a specific wrong reading rather
   than a missing feature. Array 5 is the table the board could not reduce to
   a rule and wrote down by playing; it is pinned literally, because array 0
   is the identity under any reading that finds the blob at all, so the
   identity test cannot tell a slipped offset from a correct one. And the
   riddles are NUL-terminated strings with no length byte: reading a length at
   the offset yields text that is long, plausible and missing its first
   character, which is how a wrong reader survives a glance. Both the whole
   string and the truncation are pinned. */
try {
  const lib = ctx.libraryRules(), le = ctx.looseEnds(), pz = ctx.puzzleRules();
  const walkGrid = () => (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  ctx.showCategory('MECHANICS');
  const html = walkGrid();
  /* The library card moved to the Writings gallery on 13 September 2026, so
     it is read from there rather than off the Mechanics sheet. Loose ends
     below is still on Mechanics, and `html` is a captured string by now, so
     rendering a second gallery here does not disturb it. REGISTRY cannot
     stand in for either: it is one Map for the whole run and never clears,
     so a card it has seen once looks present forever. */
  ctx.showCategory('1');
  const libHtml = walkGrid();
  const unshown = lib ? lib.reduce((a, d) => a.concat(d.unshown.map(e => String(e.str))), []) : [];
  const said = unshown.join(' ~~ ');
  const passages = lib ? lib.reduce((n, d) => n + d.entries.length, 0) : 0;
  const bu = pz && pz.buttons;
  const ri = pz && pz.riddles;
  const tu = pz && pz.tunes;
  const pan = tu && tu.instruments.find(i => i.what === 'panpipes');
  const lyre = tu && tu.instruments.find(i => i.what === 'lyre');
  if (!lib || lib.length < 4) fail('library', 'only ' + (lib ? lib.length : 0) + ' document arrays were wired up');
  else if (passages < 80) fail('library', 'only ' + passages + ' passages read');
  else if (!/Bestiary of Asilops/.test(lib.map(d => d.entries.map(e => e.str).join(' ')).join(' '))) fail('library', 'the bookshelf histories were not read');
  else if (!unshown.length) fail('library', 'nothing is unshown, so the second and third sources are over-counting');
  else if (/Sapphire Book of Mercy|Sapphire Book of Beauty|Sapphire Book of Foundation/.test(said)) fail('library', 'a script-given Sapphire volume is listed as never shown: sys Create is not being counted');
  else if (/Wine Contract/.test(said)) fail('library', 'the Wine Contract is listed as never shown, but Apis hands it over');
  else if (!/The Game’s Own Writing/.test(libHtml)) fail('library', 'the Writings gallery does not carry the library card');
  else if (/The Game’s Own Writing/.test(html)) fail('library', 'the library card is still on the Mechanics sheet, so the move is half done');
  /* The murder thread's `GetState(3) == 3` was this list's one entry until
     24 September 2026, when dvmDiscover began following call_subroutine:
     Berossus's 0x003A, which sets it, had been read as part of an array. So
     the list is empty, and the positive half is that his script now holds
     the write and the scene around it. */
  else if (le.unreachable.length) fail('loose', 'a comparison is listed as unsatisfiable: ' + JSON.stringify(le.unreachable.map(u => [u.state, u.want.v])));
  else if (!((ctx.buildScriptTextIndex().find(e => e.resid === 0x1848) || {}).text || '').match(/sys SetState\n\s+[0-9A-F]{4}\s+byte 0x03\n\s+[0-9A-F]{4}\s+byte 0x03\n/) ||
           !/Stentor claimed to have seen Pelagon/.test((ctx.buildScriptTextIndex().find(e => e.resid === 0x1848) || {}).text || ''))
    fail('loose', 'Berossus\u2019s subroutine 0x003A, with SetState 3, 3, is not in his listing');
  else if (!/Loose Ends/.test(html)) fail('loose', 'the sheet does not state the loose ends');
  /* Three kinds added 17 September 2026, each a bug the community or the
     workbench had on record and each read off its line. The flag pins carry
     their own control: flags 254 and 255 are set only by queueing task 165,
     so a reader that stopped counting tasks would list them as tested and
     never set, beside flag 2, which nothing sets at all. */
  else if (!le.exactStrikes.some(x => x.slot.v === 18 && x.n.v === 5)) fail('loose', 'the Books of Wisdom line, struck off only when the count is exactly five, was not found');
  else if (!le.flagReadNeverWritten.includes(2)) fail('loose', 'quest flag 2, which Timon tests and nothing sets, was not found');
  else if (le.flagReadNeverWritten.some(k => k === 254 || k === 255)) fail('loose', 'flags 254 and 255 read as never set: the writes through task 165 are not being counted');
  else if (!/one line shown for two errands/.test(html)) fail('loose', 'line 114, shown by Ake for the Comana errand and by Demodocus for the mine, was not reported');
  else if (!/a value read from the wrong thing/.test(html)) fail('loose', 'the combat resolver\'s weapon-skill term is not on the loose ends card');
  /* The three "use a thing" task scripts send their method to the raw
     argument past an unused cast. Exactly those three: the reader is kept to
     the task range, and a reader over every script also reports Awaken and
     two default methods, where the argument already is a prop. The join to
     Lock Picking is what ties the row to Aethon. */
  else if (!ctx.sleepRules() || !ctx.sleepRules().magicGuard || !ctx.sleepRules().magicCap || !/a value read in place of another/.test(html)) fail('loose', 'the sleep helper reading full health for magic, in its guard and its cap, was not found and stated');
  /* Character flags tested and never set: exactly the five the reading of
     17 September 2026 found. Two controls ride along. Ascalon's flag 5 is
     set only through the helper 0xC85 he calls, so a reader that lost the
     helper join would list it; and Sabinate's flag 4 must be listed, since a
     reader that could not follow task 167 through Crito's and Dares's
     customer arrays would make bit 4 wild and hide it. */
  else if (le.charFlagNeverSet.map(f => f.character + ':' + f.bit).join() !== '1:0,3:1,55:0,74:3,120:4') fail('loose', 'the character flags tested and never set are not the five expected: ' + JSON.stringify(le.charFlagNeverSet.map(f => f.character + ':' + f.bit)));
  else if (le.dataCaseNoThing.map(d => d.pt + ':' + d.v.v + ':' + d.state).join() !== '298:2:13') fail('loose', 'the kesh vial of Data1 2, which sets quest value 13 for Sacas and which nothing carries, was not the one finding: ' + JSON.stringify(le.dataCaseNoThing.map(d => d.pt + ':' + d.v.v + ':' + d.state)));
  else if (le.spacedKeywords.map(k => k.list).sort().join('|') !== 'crol, corr|fish, tlep|form, shap|inn, apis|inn, crit|inn, pari|name, eury') fail('loose', 'the seven keyword lists with a space after a comma were not found as seven: ' + JSON.stringify(le.spacedKeywords.map(k => k.list)));
  else if (le.valueForFlag.map(v => v.resid.toString(16) + ':' + v.k).join() !== '1838:4') fail('loose', 'Eteocles testing quest value 4 where his other tests use flag 4 was not the one finding (Philinus and Ascalon test value 3 legitimately): ' + JSON.stringify(le.valueForFlag.map(v => v.resid.toString(16) + ':' + v.k)));
  else if (le.shadowed.map(a => a.resid.toString(16) + ':' + a.list).sort().join('|') !== '805:pari|80e:brya') fail('loose', 'the shadowed answers are not the Paris and Bryaxis ones (a later answer keeping a keyword of its own must not be listed): ' + JSON.stringify(le.shadowed.map(a => a.resid.toString(16) + ':' + a.list)));
  else if (le.localOnlyFalse.map(l => l.resid.toString(16)).join() !== '1844') fail('loose', 'Thoas\'s farewell local, only ever set false, was not the one finding: ' + JSON.stringify(le.localOnlyFalse.map(l => l.resid.toString(16))));
  else if (le.selfAlive.map(a => a.who).join() !== '4') fail('loose', 'Hadrian testing whether Hadrian is alive, where Hector is meant, was not the one finding: ' + JSON.stringify(le.selfAlive.map(a => a.who)));
  else if (ctx.spriteRepeats().map(r => r.pt + ':' + r.aName + '/' + r.bName + ':' + r.pixels).join('|') !== '35:west standing/west sitting:1') fail('loose', 'the repeated sprite frames are not the fool\'s west standing alone (the fire spirit\'s sheet is four frames, and the two after it are a banner\'s): ' + JSON.stringify(ctx.spriteRepeats().map(r => r.pt + ':' + r.aName + '/' + r.bName + ':' + r.pixels)));
  /* The schedules read quest values: Meleager's and Demodocus's segments at
     the Bridge test quest value 9, which the Bridge's zone script sets, so
     it is neither written-and-never-read nor the only reader a script. */
  else if (le.writtenNeverRead.length || ![...(le.reads.get(9) || new Map()).values()].some(x => x.resid === 0xF00B)) fail('loose', 'quest value 9 was not found read by the schedules, or a value is still written and never read: ' + JSON.stringify(le.writtenNeverRead));
  /* The fourth batch. The staff's light has its own control in the same
     reader: the torch, the lamp and the candle say they have gone out and
     land on tiles of light 0, so a reader that looked at the wrong tile would
     turn one of them up. */
  else if (!ctx.goesDarkStillLit().some(d => d.pt === 0x157 && d.light > 0) || ctx.goesDarkStillLit().filter(d => d.light > 0).length !== 1 || ctx.goesDarkStillLit().filter(d => d.light === 0).length < 3) fail('loose', 'the spent staff that still lights was not the one light found staying on, beside the torch, lamp and candle going dark: ' + JSON.stringify(ctx.goesDarkStillLit().map(d => [d.pt, d.light])));
  else if (ctx.scheduleCollisions().map(c => c.a + '+' + c.b + '@' + c.from).join() !== '12+31@12,12+31@17') fail('loose', 'Darius and Sardis sharing a square in the Green Goat were not the one schedule collision: ' + JSON.stringify(ctx.scheduleCollisions()));
  else if (ctx.nameNeverKept().map(n => n.who).sort((a, b) => a - b).join() !== '46,87') fail('loose', 'Diomede and Paris, whose names are never kept, were not the two found (Pheres and Palaestra set theirs by number): ' + JSON.stringify(ctx.nameNeverKept().map(n => n.who)));
  else if (ctx.askedOfNobody().map(a => a.who + ':' + a.items.length).join() !== '97:15') fail('loose', 'Aethon\'s fifteen unheard Ask About answers were not the one finding: ' + JSON.stringify(ctx.askedOfNobody().map(a => a.who + ':' + a.items.length)));
  else if (ctx.tileReadWithSeenBit().map(t => t.resid.toString(16)).join() !== '1091') fail('loose', 'the fishing pole, the one script that reads the map and never masks the seen bit, was not found alone: ' + JSON.stringify(ctx.tileReadWithSeenBit()));
  else if (ctx.wrongCarryFlags().map(w => w.resid.toString(16)).sort().join() !== '1a28,3042') fail('loose', 'Fetch and the attack routine putting things into a character with flags 9 were not the two found (the shop\'s 24 must not be): ' + JSON.stringify(ctx.wrongCarryFlags()));
  else if (!/a map tile read with its seen bit/.test(html) || !/a thing given to a character with the wrong flags/.test(html)) fail('loose', 'the seen-bit or carry-flag row is missing from the card');
  /* Awaken opens a conversation and names no speaker. With the
     TalkParticipant test taken out the reader finds thirteen sites, so the
     one it finds is the test's doing. */
  else if (ctx.speechWithNoSpeaker().map(c => c.resid.toString(16) + ':' + c.talk).join() !== '1a13:true') fail('loose', 'the conversation with no speaker was not Awaken alone: ' + JSON.stringify(ctx.speechWithNoSpeaker()));
  else if (!/a conversation with no one to speak/.test(html)) fail('loose', 'the conversation-with-no-speaker row is missing from the card');
  /* Lines replaced before they can be read: the board's Crito, Borus,
     Niobe (two), Ake and bartender lines, and the rest the same walk finds. */
  else if (ctx.linesReplacedAtOnce().map(r => r.resid.toString(16) + '@' + r.at.toString(16)).sort().join() !== '1820@60e,1828@252,1829@375,1829@440,1829@463,182a@13f,182a@190,182a@f5,1857@52,1859@55,1859@9b,1867@251,1878@181,812@12,812@383') fail('loose', 'the lines replaced at once are not the fifteen known: ' + JSON.stringify(ctx.linesReplacedAtOnce().map(r => r.resid.toString(16) + '@' + r.at.toString(16))));
  else if (!/a line replaced before you can read it/.test(html)) fail('loose', 'the replaced-line row is missing from the card');
  /* The run-on answers. The reader's first form linked the chain through the
     object's start as well as the jump target, which is already a resource
     offset, and so walked no character's chain; the wishing fountain's four
     wishes, which the board lists among the lines that flash past, came in
     only when that was fixed. Magpie's two are inside his flag-1 block,
     which is unreachable anyway, and are stated as the file has them. */
  else if (ctx.answersThatRunOn().map(r => r.resid.toString(16) + ':' + r.list).sort().join('|') !== '1036:3,thre|1036:coff|1036:pony|1036:tequ|1803:baho|1803:jhia|1811:n|1824:n|184e:n|807:atus|808:hist') fail('loose', 'the answers without a return are not the fountain\'s four wishes, Magpie\'s two, Atussa\'s, the mages\' history, and Ennomus\'s, Antenor\'s and Pheres\'s second "n" (no other yes-or-no answer, and not Neoptolemus\'s "demo", may be listed): ' + JSON.stringify(ctx.answersThatRunOn().map(r => r.resid.toString(16) + ':' + r.list)));
  else if (ctx.leaveNeverLeaves().map(l => l.who).join() !== '97') fail('loose', 'Aethon, who agrees to leave and stays, was not the one companion found: ' + JSON.stringify(ctx.leaveNeverLeaves().map(l => l.who)));
  else if (!/an answer that runs on/.test(html) || !/a companion who agrees to leave and stays/.test(html)) fail('loose', 'the run-on answer or the companion who stays is not on the card');
  /* Characters answered about by their own group: without the test that the
     group's answer names them, Paris (told about Parium) comes in too. */
  else if (ctx.selfToldByGroup().map(t => t.who).join() !== '30,39,50,60,62,79,88,120') fail('loose', 'the characters whose group answers their own name are not Milcom, Eioneus, Philinus, Propontis, Halos, Charax, Helen and Sabinate: ' + JSON.stringify(ctx.selfToldByGroup().map(t => t.who)));
  /* The trap searches. Each asks for four types; the spike traps and the
     one of 0x163 lie loose, and with the placement tests taken out they come
     in as well. */
  else if (ctx.containedUnseen().map(u => u.resid.toString(16) + ':' + u.pt.toString(16)).join() !== '1a04:160,1a04:161,1af2:160,1af2:161,1af3:160,1af3:161') fail('loose', 'the searches that pass over contained things are not the three trap skills on poison and blast traps: ' + JSON.stringify(ctx.containedUnseen().map(u => u.resid.toString(16) + ':' + u.pt.toString(16))));
  else if (ctx.refusalOnEveryCheck().map(r => r.pt.toString(16) + ':' + r.said.trim()).join() !== "d2:You can't stuff the carcass!") fail('loose', 'the only container answer that prints is not the carcass\'s: ' + JSON.stringify(ctx.refusalOnEveryCheck()));
  else if (ctx.highlightsUnanswered().map(h => h.resid.toString(16) + '@' + h.at.toString(16) + ':' + h.word + ':' + h.who.length).sort().join() !== '1802@171a:join:1,1820@36c:Hebe:1,1866@ef:Vineyard:1,186d@126e:hear:1,801@424:Magisterium:66,813@19:join:7') fail('loose', 'the highlighted words nobody answers are not the six known: ' + JSON.stringify(ctx.highlightsUnanswered().map(h => h.resid.toString(16) + '@' + h.at.toString(16) + ':' + h.word + ':' + h.who.length)));
  else if (!/a highlighted word nobody answers/.test(html)) fail('loose', 'the highlighted-word row is missing from the card');
  else if (ctx.stateNoSaveKeeps().map(w => w.resource.toString(16) + ':' + w.offset.toString(16) + ':' + w.writers.map(x => x.resid.toString(16)).join('/')).join() !== '500:10:1801' || !/a value no saved game keeps/.test(html)) fail('loose', 'the word written before the game has a file is not the hero\'s gender alone (the inn room, written in play, is saved), or its row is missing: ' + JSON.stringify(ctx.stateNoSaveKeeps().map(w => [w.resource, w.offset, w.writers.length, w.readers.length])));
  else if (ctx.deletedAcrossZoneChange().map(d => d.pt.toString(16) + ':' + d.skill.toString(16) + ':' + d.zones.join('/')).join() !== '4b:1a00:3' || !/a delete after the zone has changed/.test(html)) fail('loose', 'the scroll deleting after Directed Nexus has moved the party is not the one found, or its row is missing: ' + JSON.stringify(ctx.deletedAcrossZoneChange()));
  else if (!/a character told about by their own group/.test(html) || !/a search that passes over what is inside things/.test(html) || !/a refusal said on every check/.test(html)) fail('loose', 'the own-group, contained-search or refusal row is missing from the card');
  else if (!/a light that stays on/.test(html) || !/two people scheduled into one place/.test(html) || !/a name told and not kept/.test(html) || !/answers written for someone never asked/.test(html)) fail('loose', 'a fourth-batch row is missing from the card');
  else if (!/a sprite frame that repeats another pose/.test(html)) fail('loose', 'the repeated sprite frames are not on the card');
  else if (!/a character asking if they are alive/.test(html)) fail('loose', 'the self-alive test is not on the card');
  else if (!/a check of something that is always false/.test(html)) fail('loose', 'the local only ever set false is not on the card');
  else if (!/an answer an earlier one takes/.test(html)) fail('loose', 'the shadowed answers are not on the card');
  else if (!/a value checked where the flag is meant/.test(html)) fail('loose', 'the value-for-flag slip is not on the card');
  else if (!/a keyword that needs a space typed first/.test(html)) fail('loose', 'the keywords that need a space are not on the card');
  else if (!/a thing nobody has/.test(html)) fail('loose', 'the kesh vial nobody has is not on the card');
  else if (!/a character flag checked and never set/.test(html)) fail('loose', 'the character flags tested and never set are not on the card');
  else if (!/killing a townsperson raises karma by/.test(html)) fail('karma', 'the karma section does not say what killing an alignment-0 townsperson does, off the character table');
  else if (le.unusedCast.map(u => u.task).sort((a, b) => a - b).join() !== '78,79,80') fail('loose', 'the use, use-on and use-at tasks were not found as exactly three: ' + JSON.stringify(le.unusedCast.map(u => u.task)));
  else if (!le.unusedCast.find(u => u.task === 79).queuedBy.some(s => s.resid === 0x1AD5)) fail('loose', 'task 79 is not joined to Lock Picking, which queues it for Aethon');
  else if (!bu || !bu.arrays || bu.arrays.length !== 7) fail('puzzles', 'the button tables were misread: ' + JSON.stringify(bu && bu.arrays && bu.arrays.length));
  else if (!bu.arrays.every(a => a.length === 16)) fail('puzzles', 'a button table is not sixteen entries');
  else if (!bu.arrays[0].every((v, i) => v === i)) fail('puzzles', 'the first table is not the identity, so the blob is being read at the wrong offset');
  else if (bu.buttons.length !== 14) fail('puzzles', bu.buttons.length + ' buttons, expected the fourteen in Maayti');
  // Array 5 is the one the board could not reduce to a rule, and Wizard and
  // Pallas Athene wrote it down from playing the game rather than from the
  // file: [0,9,6,15,6,15,0,6,9,0,15,9,15,6,9,0]. It is the only independent
  // check this reader has, so it is pinned literally. The identity test above
  // cannot carry it: array 0 is the identity in any reading that finds the
  // blob at all, whereas array 5 is wrong the moment the offset slips.
  else if (!bu.arrays[5] || bu.arrays[5].join(',') !== '0,9,6,15,6,15,0,6,9,0,15,9,15,6,9,0')
    fail('puzzles', 'array 5 is not the one the community recorded: ' + JSON.stringify(bu.arrays[5]));
  // The panel a button drives is its own record index plus the low nibble,
  // not its position in the filtered list. The two agree only if the buttons
  // start at record 0 with nothing between them; these are records 82 to 157
  // with the panels and doors interleaved, so the old arithmetic named panels
  // that do not exist. Every button must resolve to a real Strange Device.
  else if (bu.buttons.some(b => !b.a.rec || !b.b.rec || b.a.rec.proptype !== 0x106 || b.b.rec.proptype !== 0x106))
    fail('puzzles', 'a button names a panel that is missing or is not prop type 0x106');
  else if (!bu.rooms || bu.rooms.length !== 5) fail('puzzles', 'the pattern rooms did not come out five: ' + JSON.stringify(bu.rooms && bu.rooms.length));
  else if (!bu.rooms.every(r => r.panels.length === 2 && r.doorRec)) fail('puzzles', 'a room is not two panels and a door');
  else if (!ri || ri.text.length !== 5 || ri.answers.length !== 5) fail('puzzles', 'the riddles did not come out five with five answers');
  // The riddles are NUL-terminated strings reached through drefs, with no
  // length byte anywhere. Reading one at the offset gives " am always
  // hungry," -- the byte there is 'I', 73, which passes for a length, so the
  // text comes out long and almost right with its first character eaten.
  // That is the shape of mistake that once had this project claiming a
  // hundred dialogues held unrendered text, so both halves are pinned.
  else if (!/^I am always hungry,/.test(ri.text[0]) || !/red\.$/.test(ri.text[0]))
    fail('puzzles', 'the first riddle is not whole: ' + JSON.stringify(ri.text[0]));
  else if (/^ am always/.test(ri.text[0])) fail('puzzles', 'the riddle lost its first character: the length-byte reading is back');
  else if (ri.answers[0] !== 'fire' || !/,/.test(ri.answers[1]))
    fail('puzzles', 'the answers are not being read off the opcodes: ' + JSON.stringify(ri.answers));
  else if (!ri.buttons.every(b => b.door)) fail('puzzles', 'a riddle button opens no door');
  else if (!/Puzzles/.test(html)) fail('puzzles', 'the sheet does not state the puzzles');
  else if (!/The riddles/.test(html)) fail('puzzles', 'the sheet does not state the riddles');
  /* The tunes, 12 September 2026. All three locks encode an order as a
     base-16 number and compare it against one constant, so the pins are the
     two things that can slip: the constants, and the note-to-letter mapping.

     The mapping is derived, not stated by the file: a note is the letter that
     far along the alphabet. It is pinned by its result, because the panpipes'
     0xF79C3 must spell the PHJMD the board wrote down by playing and the
     lyre's 0xFC6 must spell PMG. A mapping off by one spells QIKNE and QNH,
     so this cannot pass by accident.

     The two sets of panpipes are the control on the note lists: they differ
     by one note (H against G), and only the one Philinus hands over can play
     the tune. If both lists come out the same the blobs are being read from
     the wrong offset and the distinction is invented. */
  else if (!tu || !tu.bells) fail('puzzles', 'the bells were not read');
  else if (!tu.bells.base || tu.bells.base.v !== 16) fail('puzzles', 'the bell register is not base sixteen: ' + JSON.stringify(tu.bells.base));
  else if (tu.bells.bells.length !== 4 || tu.bells.bells.map(b => b.number).join(',') !== '1,2,3,4')
    fail('puzzles', 'the bells are not numbered one to four ascending west to east: ' + JSON.stringify(tu.bells.bells));
  else if (tu.bells.orders.map(o => o.rings.join(',')).join(' | ') !== '3,2,4,1 | 1,2,4,3')
    fail('puzzles', 'the ringing orders are not the two recorded: ' + JSON.stringify(tu.bells.orders.map(o => o.rings.join(','))));
  else if (!pan || !lyre) fail('puzzles', 'an instrument was not read');
  else if (pan.spelled !== 'PHJMD' || lyre.spelled !== 'PMG')
    fail('puzzles', 'the tunes do not spell what the board recorded: ' + JSON.stringify([pan.spelled, lyre.spelled]));
  else if (!pan.gate || pan.gate.v !== 1) fail('puzzles', 'the panpipes Data1 gate is not being read: ' + JSON.stringify(pan.gate));
  else if (pan.lists.length !== 2 || pan.lists[0].spelled === pan.lists[1].spelled)
    fail('puzzles', 'the two sets of pipes are not being told apart: ' + JSON.stringify(pan.lists.map(l => l.spelled)));
  else if (!pan.given.some(c => /Philinus/.test(c.name || '') && c.data1 && c.data1.v === 1))
    fail('puzzles', 'Philinus is not found handing over a panpipes with Data1 one: ' + JSON.stringify(pan.given));
  else if (typeof pan.tune.at !== 'number' || typeof lyre.tune.at !== 'number')
    fail('puzzles', 'a tune is not read off a line of its script, so it cannot be linked');
  else if (!/The music locks/.test(html) || !/The bells/.test(html)) fail('puzzles', 'the sheet does not state the tunes');
  /* What a signal reaches is read out of the APPLICATION, and no application
     is open this early: signalRules() returns null here, so pinning its
     figures in this block would skip every assertion and pass for the wrong
     reason. They are pinned in the installer section instead, where the
     application has been adopted. Only the heading is checked here, because
     the card emits it in both states. */
  else if (!/What a signal reaches/.test(html)) fail('puzzles', 'the sheet does not state what a signal reaches');
  else console.log(`  library and puzzles: ${passages} passages in ${lib.length} arrays, ${unshown.length} shown by nothing and ${lib.reduce((n, d) => n + d.dangling.length, 0)} pointing at nothing; ${le.unreachable.length} test nothing can satisfy; ${bu.buttons.length} buttons through ${bu.arrays.length} tables of ${bu.arrays[0].length}, driving ${bu.rooms.length} rooms of two panels and a door; ${ri.text.length} riddles taking ${ri.answers.join(', ')}`);
} catch (e) { fail('library', e); }

/* The strange device (thinkADotRules, 24 September 2026). Its reading is
   pinned, and each press sequence the reader worked out is played back
   here through the tables it read: a sequence that does not end on its
   pattern means the rule or the search is wrong, whichever made it. */
try {
  const td = ctx.thinkADotRules();
  const replay = (ps) => { let st = td.start.slice(); for (const c of ps) { for (let p = c, n = 0; p !== null && p !== undefined && n < 16; n++) { st[p] ^= 1; p = st[p] ? td.lit.v[p] : td.dark.v[p]; } } return st.join(''); };
  ctx.showCategory('MECHANICS');
  const mh = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid')).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  if (!td) fail('strange device', 'the device was not read');
  else if (td.start.join('') !== '01011010' || td.lit.v.join() !== '5,3,4,5,6,,,' || td.dark.v.join() !== '3,4,7,6,7,,,')
    fail('strange device', 'the start or the tables were misread: ' + JSON.stringify([td.start, td.lit.v, td.dark.v]));
  else if (td.patterns.map(p => p.signal).join() !== '132,133,134' || !td.patterns.every(p => p.doors.length === 1))
    fail('strange device', 'the patterns, their signals or their doors were misread: ' + JSON.stringify(td.patterns.map(p => [p.v.join(''), p.signal, p.doors.length])));
  else if (!td.patterns.every(p => p.presses && replay(p.presses) === p.v.join('')))
    fail('strange device', 'a press sequence does not end on its pattern');
  else if (!/Every dot dark sends signal 133 , which opens the stone door in Caves/.test(mh))
    fail('strange device', 'the Mechanics sheet does not state it: ' + (/Eight dots[^]{0,300}/.exec(mh) || [''])[0]);
  else console.log('  strange device: start ' + td.start.join('') + ', three patterns, each a door and a shortest sequence that plays back true (' + td.patterns.map(p => p.presses.length).join(', ') + ' presses)');
} catch (e) { fail('strange device', e); }

/* The face, 12 September 2026. The page used to be set in Cythera's own
   typeface from the first paint, served out of res/, whether or not the
   reader had opened a copy of the game. It is Chicago Kare until a file is
   open now, the file's own face after that, and either can be chosen.

   Pinned here: the default with no file, that an open file makes the game's
   face the one in use, that every stack ends in a system sans (Chicago Kare
   carries ASCII and most of Mac Roman but not the crumb's angle quote, the
   middot, the en dash or several button icons, and those must fall through
   to what stood beside Chicago on a Mac rather than to a serif), and that
   no stack names the bundled Argos any more.

   canvasFace is checked against this stub on purpose: its getComputedStyle
   returns an object with no getPropertyValue, which is what an old browser
   does too, and a canvas label is drawn from a paint loop, so an unguarded
   read there takes the whole map down rather than one label. */
try {
  const stacks = peek('FACE_STACKS');
  const was = ctx.GAME_FONT;
  ctx.GAME_FONT = null;
  const bare = ctx.faceChoice();
  ctx.GAME_FONT = 'sfnt 7289';
  const withFile = ctx.faceChoice();
  ctx.GAME_FONT = was;
  const cf = ctx.canvasFace(14);
  const all = stacks ? Object.keys(stacks).map(k => stacks[k]) : [];
  if (!stacks || !stacks.game || !stacks.chicago || !stacks.system)
    fail('face', 'the stacks are missing: ' + JSON.stringify(stacks && Object.keys(stacks)));
  else if (!/ChicagoKare/.test(stacks.chicago)) fail('face', 'Chicago is not the face before a file: ' + stacks.chicago);
  else if (!/^'ArgosGame'/.test(stacks.game)) fail('face', 'the game stack does not lead with the file’s own face: ' + stacks.game);
  else if (/\bArgos\b/.test(stacks.chicago + ' ' + stacks.system))
    fail('face', 'the bundled Argos is back in a stack that should not have it');
  else if (!all.every(s => /sans-serif$/.test(s))) fail('face', 'a stack does not end in a system sans: ' + JSON.stringify(all));
  else if (bare !== 'chicago') fail('face', 'with no file the face is ' + bare + ', not Chicago');
  else if (withFile !== 'game') fail('face', 'with a file open the face is ' + withFile + ', not the game’s own');
  else if (!/^14px /.test(cf) || !/ChicagoKare/.test(cf))
    fail('face', 'canvasFace fell over where getComputedStyle has no getPropertyValue: ' + JSON.stringify(cf));
  else console.log(`  face: ${bare} with no file and ${withFile} with one, ${all.length} stacks each ending in a system sans, canvas ${JSON.stringify(cf.slice(0, 28))}`);
} catch (e) { fail('face', e); }

/* The World tab's three fixes, 12 September 2026, all reported from a phone.

   The one worth a real check is the judder. A node past the 448 pixel
   threshold used to ask for a full map render every node, every frame, and
   ZONE_CACHE_KEEP is two on iOS: three big towns at an intermediate zoom
   evicted each other and re-rendered continuously. Since 25 September 2026
   the tab never renders a zone in one piece at all: a paint at rest starts
   a render a slice at a time (atlasRenderStep), and a paint with a finger
   down starts nothing. So: clear the cache, paint with a finger down and
   require no render and no job; paint at rest and require no render in one
   piece but a job started; then run the frames and require the zone cached.

   renderMapUncached is what is counted, because a cache hit calls
   mapRenderFor too and only the miss is expensive. The control is the job
   at rest: without it the wrappers could be intercepting nothing. */
try {
  ctx.showCategory('WORLD');
  const av = peek('atlasView');
  const cache = peek('zoneMapCache');
  const real = ctx.renderMapUncached;
  let renders = 0;
  ctx.renderMapUncached = function () { renders++; return real.apply(this, arguments); };
  const vp = REGISTRY.get('atlasViewport');
  const vw = (vp && vp.clientWidth) || 390, vh = (vp && vp.clientHeight) || 700;
  // An intermediate zoom: big enough that nodes pass the render threshold.
  const place = () => { av.Z = 12; av.x = vw / 2 - 163.5 * 12; av.y = vh / 2 - 20.5 * 12; };
  drainRaf(); ctx.ATLAS_RENDER_JOB = null;
  cache.clear(); renders = 0; av.touching = true; place(); ctx.paintAtlas();
  const moving = renders + (ctx.ATLAS_RENDER_JOB ? 1 : 0);
  cache.clear(); renders = 0; av.touching = false; place(); ctx.paintAtlas();
  const job = ctx.ATLAS_RENDER_JOB, onePiece = renders;
  for (let i = 0; i < 400 && ctx.ATLAS_RENDER_JOB; i++) drainRaf();
  const atRest = job && cache.has(job.resid) ? 1 : 0;
  if (onePiece) fail('world tab', onePiece + ' map renders in one piece at rest: a paint should start a render a slice at a time instead');
  av.touching = false;
  ctx.renderMapUncached = real;

  /* The dashed rings are one path per node, not one stroke each. Measured
     12 September 2026, after a report that the tab was still jerky at mid
     zoom: one frame was 786 canvas operations and 781 of them were in
     atlasPaintMouths, because every visible egg did save, setLineDash,
     beginPath, arc, stroke, restore. A dashed stroke is among the slowest
     things a canvas does, so a pan issued over a hundred of them a frame.

     The assertion is a ratio rather than a number, so it holds for any
     archive: many rings, few strokes. The control is that rings are drawn
     at all -- a pass that drew nothing would satisfy every ratio here and
     the check would pass for ever having measured nothing. */
  const acv = ctx.ensureAtlasCanvas && ctx.ensureAtlasCanvas();
  const a2 = acv && acv.getContext && acv.getContext('2d');
  let arcs = 0, strokes = 0, dashes = 0, rects = 0;
  if (a2) {
    const rArc = a2.arc, rStroke = a2.stroke, rDash = a2.setLineDash, rRect = a2.rect;
    a2.arc = function () { arcs++; return rArc.apply(this, arguments); };
    a2.stroke = function () { strokes++; return rStroke.apply(this, arguments); };
    a2.setLineDash = function () { dashes++; return rDash.apply(this, arguments); };
    a2.rect = function () { rects++; return rRect.apply(this, arguments); };
    // Over the eggs, not over the corner the render check uses. This viewport
    // is 300x300, so at 12 px a square it sees about 25 squares of a 256
    // square map, and (163.5,20.5) has almost nothing near it: the first
    // version of this counted six rings, all of them mouths, and failed its
    // own control. (159,220) is the densest point on the world map at this
    // zoom, worth thirteen rings.
    av.Z = 12; av.x = vw / 2 - 159 * 12; av.y = vh / 2 - 220 * 12; av.touching = false;
    ctx.paintAtlas();
    a2.arc = rArc; a2.stroke = rStroke; a2.setLineDash = rDash; a2.rect = rRect;
  }


  // The hover card: a finger near the top of the map must put the card just
  // below it, not at the foot of the viewport, which is what it used to do.
  const el = { style: {}, offsetWidth: 150, offsetHeight: 40 };
  const fakeVp = { clientWidth: 390, clientHeight: 700 };
  ctx.placeHoverCard(el, fakeVp, 100, 30, true);
  const topNearFinger = parseInt(el.style.top, 10);
  ctx.placeHoverCard(el, fakeVp, 100, 400, true);
  const topAbove = parseInt(el.style.top, 10);

  /* An egg says what it names, and in the inspector it links to it: the
     creatures it hatches, the sound it plays, the room it is. The hover
     cards are pointer-events:none, so a link drawn in one could never be
     clicked and the plain form is what they get. Both are pinned, because
     escaping the linked form would silently print markup at a reader and
     forgetting to escape the plain one is an injection of the file's own
     text into the page. */
  const hatchLink = ctx.atlasEggAt({ resid: 0x8001 }, 137, 9, true);
  const hatch = ctx.atlasEggAt({ resid: 0x8001 }, 137, 9);
  const room = ctx.atlasEggAt({ resid: 0x8001 }, 187, 76);
  /* Three bits of a hatching egg, as TActiveMonster::HatchEgg reads them
     (eggDetail's header has the reading). The unicorn's egg at 138,176
     carries 0x01 with a chance of 1 in 100, and 0x01 makes it certain once
     it has hatched; the seedpod egg at 148,210 carries 0x04 and holds a
     thing, whose count 0x04 keeps; and Odemia's night guard at 10,14
     carries 0x04 too, but a guard is a creature and the bit is not read for
     one, so its card must not say so. The sea monster's eight tentacles are
     one record's count, which hatches whole. */
  /* How near: TViewer::SetStage lists an egg only within 15 squares of the
     party's square on both axes (exeEggReach). With the application open
     the card says the 15 and links it to the instruction; without it the
     card says "near" and states no figure. Each half fails on its own if
     the reader stops finding the number or starts guessing one. */
  const hatchBare = withoutApp(() => ctx.atlasEggAt({ resid: 0x8001 }, 137, 9));
  if (!/when the party comes within 15 squares of it,/.test(hatch))
    fail('world tab', 'the hatching egg does not give the reach read off SetStage: ' + JSON.stringify(hatch));
  else if (!/within <button[^>]*jumpToExeAt\(\d+\)[^>]*>15<\/button> squares/.test(hatchLink))
    fail('world tab', 'the inspector form of an egg does not link its reach to the instruction: ' + JSON.stringify(hatchLink));
  else if (!/when the party comes near it,/.test(hatchBare) || /\d+ squares/.test(hatchBare))
    fail('world tab', 'with no application open the hatching egg states a reach or does not say "near": ' + JSON.stringify(hatchBare));
  const unicorn = ctx.atlasEggAt({ resid: 0x8001 }, 138, 176);
  const seedpod = ctx.atlasEggAt({ resid: 0x8001 }, 148, 210);
  const nightGuard = ctx.atlasEggAt({ resid: 0x8002 }, 10, 14);
  if (!/on 1 visit in 100[^\n]*on every visit once it has hatched/.test(unicorn))
    fail('world tab', 'the unicorn egg does not say that bit 0x01 makes it certain once hatched: ' + JSON.stringify(unicorn));
  else if (!/without running out/.test(seedpod))
    fail('world tab', 'a thing egg with bit 0x04 does not say it keeps its count: ' + JSON.stringify(seedpod));
  else if (!/hatches guard/.test(nightGuard) || /running out/.test(nightGuard))
    fail('world tab', 'a creature egg with bit 0x04 says what the bit does for things only: ' + JSON.stringify(nightGuard));
  else if (!/tentacle ×8/.test(hatch))
    fail('world tab', 'the sea monster egg does not give the tentacles\' count: ' + JSON.stringify(hatch));
  // Kind 3 is an ambient sound, not "nothing": every one of the hundred
  // carrying sound 6 stands on water, and 0x9106 is named Waves / Seashore
  // Loop in the file. 151,13 is one of them.
  const surf = ctx.atlasEggAt({ resid: 0x8001 }, 151, 13);
  // Room 800, the way into the Tree of Life: egg (125,139) sized 3 by 5, so
  // x 124..126 and y 137..141. One square inside, the trigger itself, and one
  // outside the left edge as the control.
  const inRoom800 = ctx.atlasEggAt({ resid: 0x8001 }, 124, 137);
  const onRoom800 = ctx.atlasEggAt({ resid: 0x8001 }, 125, 139);
  const outRoom800 = ctx.atlasEggAt({ resid: 0x8001 }, 123, 137);

  if (atRest === 0) fail('world tab', 'a paint at rest did not start a render a slice at a time, or it never finished: ' + JSON.stringify(job && { resid: job.resid }));
  else if (moving !== 0) fail('world tab', 'a paint with a finger down rendered or started a render: the judder guard is not holding');
  else if (!(topNearFinger > 30 && topNearFinger < 200)) fail('world tab', 'a card by a finger near the top landed at ' + topNearFinger + ', not below the finger');
  else if (!(topAbove < 400)) fail('world tab', 'a card with room above it went below the finger: top ' + topAbove);
  else if (!/hatches sea monster and tentacle/.test(hatch)) fail('world tab', 'the hatching egg does not say what comes out: ' + JSON.stringify(hatch));
  else if (!/every visit|visits? in 100/.test(hatch)) fail('world tab', 'the hatching egg does not say how likely: ' + JSON.stringify(hatch));
  else if (!/when the party comes (within \d+ squares of it|near it), unless walls cut it off from the party/.test(hatch)) fail('world tab', 'the hatching egg does not say what sets it off: ' + JSON.stringify(hatch));
  else if (!/a room, room \d+/.test(room)) fail('world tab', 'the room egg stopped reading as a room: ' + JSON.stringify(room));
  else if (!/an ambient sound, [^\n]*sound 6/i.test(surf)) fail('world tab', 'a kind-3 egg is not naming its ambient sound: ' + JSON.stringify(surf));
  // A room is a rectangle, not the egg's square. Room 800 is the way into the
  // Tree of Life: its script 0x1E20 is one instruction, sys ChangeZone through
  // zoneport 146, and the egg at (125,139) sized 3 by 5 covers x 124..126,
  // y 137..141 of the world. Every one of those squares is in the room and
  // all but the trigger read as nothing before 12 September 2026.
  // The control is the square outside: (123,137) is one west of the left edge
  // and must stay empty, or the rectangle is being computed too wide and
  // every room on the map is overstated.
  else if (!/a room, room 800/.test(inRoom800)) fail('world tab', 'a square inside room 800 does not read as the room: ' + JSON.stringify(inRoom800));
  else if (!/a room, room 800/.test(onRoom800)) fail('world tab', 'room 800 stopped reading on its own trigger square: ' + JSON.stringify(onRoom800));
  else if (outRoom800 !== '') fail('world tab', 'a square outside room 800 reads as inside it: ' + JSON.stringify(outRoom800));
  // The invariant, not a population: however many rings a node draws, the dash
  // is set once and they are stroked together. A threshold on the ring count
  // would only encode this viewport's size, which is what the first version of
  // this pin got wrong.
  else if (!/showItemDetail\(/.test(hatchLink) || !/<button/.test(hatchLink))
    fail('world tab', 'the inspector form of an egg does not link what it hatches: ' + JSON.stringify(hatchLink));
  else if (/<button|<span/.test(hatch))
    fail('world tab', 'the hover form of an egg carries markup, which that card cannot click and should not print: ' + JSON.stringify(hatch));
  // Rooms are drawn on the zone view now, not on the world: a kind-8 egg
  // covers a rectangle, and a score of them tiling a town is clutter at the
  // scale the world map is drawn at. rect() is the call they used, and the
  // rings are arcs, so a rectangle on this path means they came back.
  else if (a2 && rects > 0) fail('world tab', rects + ' rectangles drawn on the world map: the room outlines are back on the atlas');
  else if (a2 && arcs < 1) fail('world tab', 'no rings drawn at the densest point of the world, so this measured nothing');
  else if (a2 && dashes > 1) fail('world tab', dashes + ' setLineDash calls for ' + arcs + ' rings: the dash is being set per egg again');
  /* Bounded, not merely fewer. `strokes < arcs` passed on the eggs alone --
     they contribute many arcs and one stroke -- which masked two dozen mouth
     rings each stroking for itself, and that was the tab still being jerky at
     mid zoom on 13 September 2026. Both passes batch per node now, so the
     strokes on this frame are a handful whatever the archive holds, while the
     rings are many. A ratio would drift back; a bound will not. */
  else if (a2 && arcs > 2 && strokes > 8) fail('world tab', strokes + ' strokes for ' + arcs + ' rings: a ring pass is stroking one at a time again');
  else console.log(`  world tab: ${moving} renders while moving and ${atRest} at rest; card at ${topNearFinger} by a finger at 30; ${arcs} rings in ${strokes} strokes and ${dashes} dashes, ${rects} rectangles; ${JSON.stringify(hatch.replace(/^[^:]*: /, ''))}`);
} catch (e) { fail('world tab', e); }

/* Rooms on the zone view, 12 September 2026. A kind-8 egg covers a rectangle,
   and those were drawn on the World tab when the reading was new. The
   maintainer asked for them here instead: the world is a picture of an island
   and a score of outlines tiling a town is clutter at that scale, while one
   zone fills the screen and the outline means something.

   It is a mark like the others, off until asked for. The check is that it
   draws nothing until it is turned on and something afterwards, on a map
   that has rooms -- Land King Hall has 23. Without the "before" half this
   would pass on a mark that drew unconditionally. */
try {
  const marks = peek('MAP_MARKS');
  const before = { ...marks };
  if (marks.rooms !== false) fail('rooms mark', 'the rooms mark is on by default: ' + JSON.stringify(marks));
  else {
    // '127' is the maps' own subindex, which is what the other map sections
    // in this file switch to. 'ZONES' is the tab's name on screen, not a
    // category key, and showCategory refuses it, so the map never opened and
    // this check reported no rooms on a map that has twenty-three.
    ctx.showCategory('127');
    ctx.openResource(0x8003); drainRaf();            // Land King Hall, 23 rooms
    const layer = () => ctx.document.getElementById('markLayer');
    let drew = 0;
    const mc = layer();
    const c2 = mc && mc.getContext && mc.getContext('2d');
    const real = c2 && c2.rect;
    if (c2 && real) c2.rect = function () { drew++; return real.apply(this, arguments); };
    ctx.drawMapMarks();
    const off = drew;
    ctx.toggleMapMarks('rooms', true);
    const on = drew - off;
    ctx.toggleMapMarks('rooms', false);
    if (c2 && real) c2.rect = real;
    Object.assign(marks, before);
    const rooms = ((ctx.CUR_MAP || {}).allProps || []).filter(r => r.flags === 0x42 && r.aspect === 8).length;
    if (!rooms) fail('rooms mark', 'the map opened for this check has no rooms, so it proves nothing');
    else if (off !== 0) fail('rooms mark', off + ' rectangles drawn with the mark off');
    else if (on < 1) fail('rooms mark', 'the mark drew nothing with ' + rooms + ' rooms on the map');
    else console.log(`  rooms mark: ${rooms} rooms on Land King Hall, ${off} rectangles off and ${on} on`);
  }
} catch (e) { fail('rooms mark', e); }

/* The Path mark: one character's day as a line, 13 September 2026, asked for
   as "the path of someone over time of day according to their schedule".

   Counted the way the rooms mark is, by wrapping a canvas primitive and
   comparing off against on. The path draws one arc per post and the routes
   between posts as a single stroked polyline, so arcs are the countable
   thing and the line does not inflate the count.

   Three guards, because each of them is a way this could pass while broken.
   The mark must be off by default. The map opened must actually post
   somebody, or "it drew something" proves nothing. And opening the map must
   have chosen that somebody by itself: MAP_MARKS persists across maps, so a
   picker left naming a character from another zone would draw a day that
   does not belong to the map under it. */
try {
  const marks = peek('MAP_MARKS');
  const before = { ...marks };
  if (marks.path !== false) fail('path mark', 'the path mark is on by default: ' + JSON.stringify(marks));
  else {
    ctx.showCategory('127');
    ctx.openResource(0x8003); drainRaf();            // Land King Hall
    const who = ctx.MAP_PATH_WHO;
    const cm = ctx.CUR_MAP || {};
    // The day the path draws is the one the game walks from a new game
    // (scheduleDay), not every post in the program.
    const posts = (who !== null && who !== undefined)
      ? ctx.scheduleDay(who).filter(e => e.mode !== 0 && e.level === cm.level).length : 0;
    const mc = ctx.document.getElementById('markLayer');
    const c2 = mc && mc.getContext && mc.getContext('2d');
    const realArc = c2 && c2.arc;
    let drew = 0;
    if (c2 && realArc) c2.arc = function () { drew++; return realArc.apply(this, arguments); };
    ctx.drawMapMarks();
    const off = drew;
    ctx.toggleMapMarks('path', true);
    const on = drew - off;
    ctx.toggleMapMarks('path', false);
    if (c2 && realArc) c2.arc = realArc;
    Object.assign(marks, before);
    if (who === null || who === undefined) fail('path mark', 'opening the map chose nobody to follow, so the picker never filled');
    else if (!posts) fail('path mark', 'the character the picker chose keeps no posts on this map, so this proves nothing');
    else if (off !== 0) fail('path mark', off + ' dots drawn with the mark off');
    else if (on < posts) fail('path mark', 'the mark drew ' + on + ' dots for ' + posts + ' posts');
    else console.log(`  path mark: ${ctx.characterName(who)}'s day on Land King Hall, ${posts} posts, ${off} dots off and ${on} on`);
  }
} catch (e) { fail('path mark', e); }

/* The day's legs are told apart, 13 September 2026. Reported from a phone:
   "her path is unclear ... maybe we could make it hue-based ... not have it
   double over itself".

   A day doubles back -- out and home is one corridor walked twice -- and two
   identical strokes on the same squares are one stroke to look at, so a
   single-coloured path said where she goes and never when. Each leg now
   takes a hue from the hour it sets out, and rides its own perpendicular
   rail so a way walked twice reads as two strands.

   Both halves are pinned because both are exactly what a later tidy-up
   flattens back into one stroke with nobody noticing: a single strokeStyle
   would still draw a plausible path, and dropping the rail would still draw
   a path -- just the unreadable one this replaced. The control is that the
   colours are DISTINCT, not merely present. */
try {
  const marks = peek('MAP_MARKS');
  const before = { ...marks };
  ctx.showCategory('127');
  ctx.openResource(0x8003); drainRaf();            // Land King Hall
  const cm = ctx.CUR_MAP || {};
  // Somebody who walks here: the most posts on this map in the day a new
  // game starts with (scheduleDay), so there are legs to colour.
  const onMap = i => ctx.scheduleDay(i).filter(e => e.mode !== 0 && e.level === cm.level).length;
  let who = null;
  for (let i = 0; i < ctx.loadSchedules().length; i++) if (who === null || onMap(i) > onMap(who)) who = i;
  ctx.setMapPathWho(who);
  const posts = who !== null ? onMap(who) : 0;
  const mc = ctx.document.getElementById('markLayer');
  const c2 = mc && mc.getContext && mc.getContext('2d');
  const styles = [];
  let strokes = 0;
  let realStroke = null;
  if (c2) {
    realStroke = c2.stroke;
    c2.stroke = function () { strokes++; styles.push(this.strokeStyle); return realStroke.apply(this, arguments); };
  }
  ctx.toggleMapMarks('path', true);
  if (c2 && realStroke) c2.stroke = realStroke;
  ctx.toggleMapMarks('path', false);
  Object.assign(marks, before);
  const hues = [...new Set(styles.filter(s => typeof s === 'string' && /^hsl\(/.test(s)))];
  if (!posts) fail('path colours', 'the picker chose nobody with posts here, so this proves nothing');
  else if (!c2) fail('path colours', 'no mark layer context, so no stroke could be counted');
  else if (!hues.length) fail('path colours', 'the path strokes carry no hsl colour: the legs are one colour again');
  else if (hues.length < 2) fail('path colours', 'every leg is the same hue, so the colour says nothing about the hour: ' + hues[0]);
  else console.log(`  path colours: ${hues.length} distinct hues over ${strokes} strokes for ${posts} posts, each leg on its own rail`);
} catch (e) { fail('path colours', e); }

/* A zone names its backdrop, and the page now says so (13 September 2026:
   "Zone should show the landscape image as well").

   The entry script's one SetLandscapeImage call has been read since the
   atlas was built -- zoneLandscapeArg -- and never shown. mapParts chips it
   now: a strip at 0x8400 + n where the argument is zero or above, and the
   engine's own backdrops, which have no resource to open, named rather than
   linked.

   The failure here is silent and is what this pins against. zoneLandscapeArg
   returns null where it finds no call, and a chip that is simply absent
   leaves a strip of three chips that looks entirely correct. So the check is
   a COUNT across the archive, against the figures measured when it was
   written: 28 zones name a strip, 14 use one of the engine's backdrops, and
   none lack the call. A presence test would pass on one chip. */
try {
  let strip = 0, engine = 0, none = 0;
  for (let lvl = 0; lvl < 0x100; lvl++) {
    if (!ctx.refExists(0x8000 + lvl)) continue;
    const land = ctx.zoneLandscapeArg(lvl);
    if (land === null) none++;
    else if (land >= 0) strip++;
    else engine++;
  }
  const chips = ctx.mapParts(0x8002, 0x8102).join('');       // Odemia, a strip at 0x8402
  const lkh = ctx.mapParts(0x8003, 0x8103).join('');          // Land King Hall, the void (-1)
  if (strip < 20) fail('zone landscape', strip + ' zones name a landscape strip, where 28 were read');
  if (none) fail('zone landscape', none + ' zones have no SetLandscapeImage call at all, where none did');
  else if (!engine) fail('zone landscape', 'no zone uses one of the engine’s own backdrops, where 14 did');
  else if (!/Landscape/.test(chips)) fail('zone landscape', 'Odemia’s parts do not chip its landscape');
  else if (!/jumpToResource\(33794\)/.test(chips)) fail('zone landscape', 'Odemia’s landscape chip does not open 0x8402');
  else if (!/Landscape/.test(lkh)) fail('zone landscape', 'Land King Hall, whose backdrop is the engine’s own, names no landscape');
  else console.log(`  zone landscape: ${strip} zones name a strip and ${engine} one of the engine’s own, all chipped in Made of`);
} catch (e) { fail('zone landscape', e); }

/* What shows through the ethereal void, 6 October 2026.

   The page tiled one of 0x8F50/0x8F51 as a pattern behind Land King Hall,
   swapped the two, and showed them under every tile with a transparent
   pixel. TViewer::Render says otherwise (zoneBackdrop, js/page-data.js):
   each is a picture an egg of kind 10 places, drawn before the ground and
   seen through the tiles whose attribute has 0x10000000. Pinned on the
   hall's twelve, on the two pictures, on a depth being negative, and on
   which tiles let them through: an ethereal void tile, and not Nothing,
   whose pixels are all transparent and which the old rule let through.
   Odemia, which has no such egg, is the control. */
try {
  const sw = ctx.zoneBackdrop(3) || [];
  const pics = [...new Set(sw.map(b => b.resid))].sort().join();
  if (sw.length !== 12) fail('void pictures', 'Land King Hall has ' + sw.length + ' pictures behind its void, where its list holds 12 eggs of kind 10');
  else if (pics !== [0x8F50, 0x8F51].join()) fail('void pictures', 'the hall’s pictures are ' + pics + ', not 0x8F50 and 0x8F51');
  else if (sw.some(b => !(b.depth < 0))) fail('void pictures', 'a picture behind the ground has a depth that is not negative');
  else if (ctx.zoneBackdrop(2)) fail('void pictures', 'Odemia, which has no egg of kind 10, was given pictures behind its ground');
  else if (!ctx.tileShowsBackdrop(0xFC)) fail('void pictures', 'the ethereal void tile 0xFC is not drawn masked');
  else if (ctx.tileShowsBackdrop(0)) fail('void pictures', 'Nothing, tile 0, is drawn masked, where the program copies it whole');
  else console.log('  void pictures: 12 behind Land King Hall, seen through the ethereal void alone');
} catch (e) { fail('void pictures', e); }

/* A route belongs to the map it was found through, 13 September 2026.

   findPath's cache key was the endpoints and the map's width. Two maps of
   equal width share that, so the second was handed the first's route --
   walked around walls it does not have -- and the cache is only dropped with
   the archive, not with the map. The key carries PROP_BLOCK's key now, which
   names the resource the blockers were built from.

   The control is the case that used to collide: the same map and the same
   endpoints under two different blocker sets must not be answered with the
   same array. On the old key they were the identical object, which is what
   makes this a real negative control rather than a restatement. */
try {
  ctx.showCategory('127');
  ctx.openResource(0x8003); drainRaf();
  const m = (ctx.CUR_MAP || {}).m;
  if (!m) fail('route cache', 'no map is open, so nothing can be routed');
  else {
    const keep = peek('DERIVED').PROP_BLOCK;
    peek('DERIVED').PROP_BLOCK = { key: 'mapA:' + m.width, set: new Set(), doors: new Map() };
    const a = ctx.findPath(m, 2, 2, 9, 9);
    peek('DERIVED').PROP_BLOCK = { key: 'mapB:' + m.width, set: new Set(), doors: new Map() };
    const b = ctx.findPath(m, 2, 2, 9, 9);
    peek('DERIVED').PROP_BLOCK = keep;
    if (!a || !b) fail('route cache', 'no route came back');
    else if (a === b) fail('route cache', 'two maps were handed the same cached route: the key has lost the map');
    else console.log(`  route cache: a route is keyed to the map it was found through, ${a.length} squares`);
  }
} catch (e) { fail('route cache', e); }

/* Who answers as whom, 12 September 2026. The thing that can go quietly wrong
   here is conflating the two relationships a conversation has with a group:
   INHERITANCE through the catch-all (dvmConversation's `groups`), and a call
   made from one topic (the extra in `groupsAll`). The first reader did the
   latter and inflated every count. Bartender is the proof they are apart: it
   is a real group with topics that NOBODY inherits, reached only by a call
   from three characters' topics.

   Naxos is the anchor because dialogue_check pins the same chain against the
   community's transcription, so this agrees with an oracle rather than with
   itself. And Protesilaus is pinned deliberately: the archive gives him
   Pnyx, Mage, Human while all nine of his classmates carry Student, and the
   Student group itself has a topic reading "Protesilaus is another student".
   If that ever stops being true, something real changed and a person should
   look, so it fails here rather than passing. */
try {
  const cv = ctx.convRules();
  const real = cv.groups.filter(g => g.kind === 'group');
  const topics = cv.chars.reduce((n, c) => n + c.topics, 0);
  const naxos = cv.chars.find(c => c.rid === 0x180B);
  const prot = cv.chars.find(c => c.rid === 0x186F);
  const thra = cv.chars.find(c => /Thrasymedes/i.test(c.name));
  const bartender = cv.groups.find(g => g.rid === 0x812);
  const notGroups = cv.groups.filter(g => g.kind !== 'group').map(g => g.rid);
  const walkGrid = () => (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  /* The chains card moved to the Dialogue gallery on 13 September 2026, so
     both sheets are walked: the gallery must carry it and Mechanics must no
     longer. Nothing else in this block reads the sheet -- the assertions
     above it are all about the reader -- so the capture moves wholesale. */
  ctx.showCategory('MECHANICS');
  const mechHtml = walkGrid();
  ctx.showCategory('23');
  const html = walkGrid();
  if (cv.chars.length < 100 || topics < 1200) fail('talk', `${cv.chars.length} characters and ${topics} topics`);
  else if (!naxos || JSON.stringify(naxos.chain) !== JSON.stringify([0x804, 0x80E, 0x801]))
    fail('talk', 'Naxos is ' + JSON.stringify(naxos && naxos.chain) + ', expected House Comana, Cademia, Human');
  else if (real.some(g => g.name)) fail('talk', 'a group carries a typed name, which went on 23 September 2026: ' + JSON.stringify(real.filter(g => g.name).map(g => g.rid)));
  else if (notGroups.indexOf(0x813) < 0 || notGroups.indexOf(0x816) < 0)
    fail('talk', 'the routines that are not groups are being counted as groups: ' + JSON.stringify(notGroups));
  else if (!bartender || bartender.inherited !== 0 || bartender.called < 1)
    fail('talk', 'inheritance and topic calls are being conflated: Bartender is ' + JSON.stringify(bartender && [bartender.inherited, bartender.called]));
  else if (!prot || prot.chain.indexOf(0x810) >= 0)
    fail('talk', 'Protesilaus now inherits Student; the archive did not give him it, so check what changed');
  else if (!thra || thra.chain.indexOf(0x810) < 0)
    fail('talk', 'Thrasymedes lost the Student group, so the chain reading is wrong');
  else if (!/Who Answers as Whom/.test(html)) fail('talk', 'the Dialogue gallery does not carry the chains card');
  else if (/Who Answers as Whom/.test(mechHtml)) fail('talk', 'the chains card is still on the Mechanics sheet, so the move is half done');
  else console.log(`  talk: ${cv.chars.length} characters, ${topics} topics, ${real.length} groups inherited; Human by ${(real.find(g => g.rid === 0x801) || {}).inherited}, Bartender by none but called by ${bartender.called}`);
} catch (e) { fail('talk', e); }

/* What the scripts lean on, 12 September 2026. Two things here can go wrong
   quietly and both are pinned.

   The first is losing the distinction between a call and a resource named in
   an operand. 0x021A, the To Do lines, is referenced by two dozen scripts and
   called by none: if it ever reports calls, the index has started counting
   operands as calls and every figure on the card is wrong.

   The second is the uncalled list growing to swallow the archive. Most of the
   archive is referenced by nothing and that is structural, not telling: item
   classes are reached by prop type, dialogue by character index, room scripts
   by room number. The card only shows a range whose siblings ARE referenced,
   so this requires the wholly-structural ranges to stay OUT of it. Without
   that control the card would quietly become a list of several hundred
   "uncalled" scripts, all of which run. */
try {
  const ln = ctx.leanRules();
  ctx.showCategory('MECHANICS');
  const html = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  const top = ln && ln.ranked[0];
  const quest = ln && ln.ranked.find(r => r.rid === 0x021A);
  const labels = ln ? ln.ranges.map(g => g.label) : [];
  const chars = ln && ln.ranges.find(g => g.label === '0xFxx');
  if (!ln || !ln.edges) fail('leans', 'no references were read out of the archive');
  else if (!ln.kinds.call || !ln.kinds.resource) fail('leans', 'the kinds of reference collapsed: ' + JSON.stringify(ln.kinds));
  else if (!top || top.refs < 50 || top.calls !== top.refs) fail('leans', 'the busiest resource reads as ' + JSON.stringify(top));
  else if (!quest || quest.calls !== 0) fail('leans', 'the To Do text array reports ' + (quest && quest.calls) + ' calls; operands are being counted as calls');
  // CurePoison was the session's name for 0xF06; the helpers carry no names
  // since 24 September 2026, so it is found by id.
  else if (!chars || !chars.dead.some(d => d.rid === 0xF06)) fail('leans', 'the character helpers nothing calls are missing from 0xFxx: ' + JSON.stringify(chars && chars.dead.map(d => d.rid)));
  else if (labels.indexOf('0x10xx') >= 0 || labels.indexOf('0x18xx') >= 0 || labels.indexOf('0x1Bxx') >= 0)
    fail('leans', 'a wholly structural range is being listed as uncalled: ' + JSON.stringify(labels));
  else if (!/What Calls What/.test(html)) fail('leans', 'the sheet does not state it');
  else console.log(`  leans: ${ln.edges} references (${ln.kinds.call} calls, ${ln.kinds.resource} operands), busiest reached by ${top.refs}; ${ln.ranges.length} ranges with something uncalled, ${chars.dead.length} of them in 0xFxx`);
} catch (e) { fail('leans', e); }

/* No copy of the file's numbers or names, 11 September 2026. The Mechanics
   figures are read with the line that holds each and printed as links to
   it, so a figure typed back into a sentence shows up here as a number
   with no link; the name tables keep only what the file does not say, so an
   entry copied back in shows up as one the file matches; and the rule
   models take the numbers they are handed, so a default restored in
   js/delv-mechanics.js shows up as a figure where there was no input. */
try {
  ctx.showCategory('MECHANICS');
  const html = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  /* A spell's cost is on the Spells sheet since 13 September 2026, so that
     one figure is looked for there rather than on Mechanics. `html` above is
     already a captured string, so rendering a second sheet here costs it
     nothing. */
  ctx.showCategory('SPELLS');
  const sphtml = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  const link = (resid, at) => new RegExp('jumpToScriptAt\\(' + resid + ',' + at + '\\)');
  const xp = ctx.experienceRules().rule, lk = ctx.lockRules().rule, sh = ctx.shopRules(), cb = ctx.combatRules(), sl = ctx.sleepRules(), tr = ctx.trainingRules().points;
  const unlinked = [
    ['the experience cap', xp && xp.cap && link(0xE8B, xp.cap.at)],
    ['the level base', xp && xp.base && link(0xE8B, xp.base.at)],
    ['the lock base', lk && lk.numbers && link(0xE43, lk.numbers.base.at)],
    ['the haggling roll', sh.haggling && link(0xEA5, sh.haggling.at)],
    ['the attacker’s roll', cb && cb.roll && link(0xE88, cb.roll.at)],
    ['a blow word threshold', cb && cb.words[0] && link(0xE87, cb.words[0].val.at)],
    ['the bed divisor', sl && sl.div && link(0xE93, sl.div.at)],
    ['mastery', tr.masteryVal && link(0xEAF, tr.masteryVal.at)],
    ['a spell’s cost', (function () { const f = ctx.spellRules().spells.find(x => x.name === 'Fireball'); return f && f.costVal && link(f.resid, f.costVal.at); })(), sphtml]
    // A third element says which sheet the figure is on; the rest are on
    // Mechanics, which stays the default.
  ].filter(([, re, where]) => !re || !re.test(where || html)).map(([what]) => what);
  // No typed names for prop types, portraits or zones since 23 September
  // 2026: the files' names are all there is.
  const names = peek('PROP_TYPE_NAMES') || {};
  const gone = ['CYTHERA_CHARACTERS', 'ZONES', 'RESOURCE_LABELS', 'TILE_SHEET_HINTS', 'DVM_FLAG_NAMES'].filter(n => peek('typeof ' + n) !== 'undefined');
  if (unlinked.length) fail('file figures', 'not a link to the line that holds it: ' + unlinked.join(', '));
  else if (!/Haggling<\/b> takes off a further random amount from 0 to (?:<button[^>]*>)?4(?:<\/button>)?/.test(html)) fail('file figures', 'the haggling roll is not 0 to 4, one short of its operand of 5');
  else if (/capped at <b>65,535/.test(html) || /plus a random number from 0 to 29<\/b>/.test(html)) fail('file figures', 'a figure is typed into its sentence rather than read');
  else if (Object.keys(names).length || gone.length) fail('names', 'typed name tables are back: ' + JSON.stringify({ props: Object.keys(names), tables: gone }));
  else if (!/^Tile Sheet 35: unlit torch, lit torch/.test(ctx.labelFor(0x8E23) || '') || ctx.labelFor(0x8F0A) !== 'General Graphic 10: chest, coffer')
    fail('names', 'a tile sheet or a picture is not named by the game\u2019s words: ' + JSON.stringify([ctx.labelFor(0x8E23), ctx.labelFor(0x8F0A)]));
  else if (ctx.propTypeName(3) !== 'metal door' || ctx.propTypeName(130) !== 'obol') fail('names', 'propTypeName does not take the file’s name: ' + JSON.stringify([ctx.propTypeName(3), ctx.propTypeName(130)]));
  else if (ctx.mechDiceOpts({}).matchPay !== undefined || ctx.mechDiceOpts({}).fa !== undefined || peek('typeof MECH_BLOW_WORDS') !== 'undefined' || peek('typeof mechExpCap') !== 'undefined') fail('file figures', 'the rule models still carry the shipped numbers as defaults');
  else console.log(`  file figures: no typed prop, portrait, zone, sound or flag names; the sheet's figures are links to their lines; the models have no defaults`);
} catch (e) { fail('file figures', e); }

/* The Cheats sheet. Its key tables and the preferences record are constants
   read out of the executable, so what is worth checking is that they reach
   the page whole and that the parts built from the ARCHIVE are really read
   off it rather than hardcoded: the sprite classes off 0xF009 and 0xF008
   (the hero's own class, 32, has to be in it: that is the number Pandora's
   Box searched for), the levels off the 0x80xx maps, the teleporters off
   0xF00C (146 reaches the Tree of Life at (12,14), the thread's headline
   mystery answered by its own list), and the nothing map's heap arithmetic
   off 0x8000 -- with the negative control the workbench ran, the same test
   on Land King Hall finding no header at all. */
try {
  const cheatsHtml = withoutApp(() => ctx.showCategory('CHEATS') ? (REGISTRY.get('sheetGrid').innerHTML || '') : null);
  if (cheatsHtml === null) fail('cheats', 'the Cheats tab refused to open');
  else {
    const html = cheatsHtml;
    const sprites = ctx.cheatSpriteClasses();
    const hero = sprites.find(s => s.pt === 32);
    const rows = (html.match(/<td class="cheatCombo">/g) || []).length;
    // No application in this run: the keys, the gate and the record are the
    // program's, so none of them is stated, and the sheet says where they
    // come from. The installer section requires them.
    if (!/to read the program’s code here/.test(html) || rows || /©gra|jumpToExeAt\(/.test(html))
      fail('cheats', `with no application open the sheet states the keys or the gate (${rows} key rows)`);
    else if (!hero || !/hero/i.test(hero.name))
      fail('cheats', 'class 32 is not in the sprite list as the hero: ' + JSON.stringify(hero));
    else if (sprites.length < 40 || !sprites.some(s => s.kind === 'monster'))
      fail('cheats', `only ${sprites.length} sprite classes, monsters ` +
           (sprites.some(s => s.kind === 'monster') ? 'present' : 'missing'));
    else {
      const levels = ctx.cheatLevels(), tp = ctx.cheatTeleporters();
      const maps = []; for (let n = 0; n < 0x100; n++) if (ctx.refExists(0x8000 + n)) maps.push(n);
      const t146 = ctx.zoneportInfo(146);
      const heap = ctx.nothingMapHeap(0x8000), control = ctx.nothingMapHeap(0x8003);
      const levelRows = (html.match(/<td class="num">[0-9A-F]{2}<\/td><td class="num">\d+<\/td>/g) || []).length;
      if (levels.length !== maps.length || levelRows !== maps.length)
        fail('cheats', `${levels.length} levels listed and ${levelRows} rows drawn for ${maps.length} maps`);
      else if (!levels[0] || levels[0].n !== 0 || !/nothing map/.test(html))
        fail('cheats', 'level 0 is not listed as the nothing map');
      else if (tp.last !== 190 || tp.total !== 1024 || !t146 || t146.resid !== 0x8027 || t146.x !== 12 || t146.y !== 14)
        fail('cheats', `teleporters: last ${tp.last} of ${tp.total}, 146 -> ${JSON.stringify(t146)}`);
      else if (!/atlasOpenSquare\(32807,12,14\)/.test(html))
        fail('cheats', 'teleporter 146 is not a link onto the Tree of Life at (12,14)');
      else if (!heap || heap.high !== 0 || heap.heads < 10 || heap.hits * 2 < heap.heads)
        fail('cheats', 'the nothing map’s heap arithmetic did not come out: ' + JSON.stringify(heap));
      else if (!control || control.heads !== 0)
        fail('cheats', 'the negative control failed: Land King Hall has allocator headers too: ' + JSON.stringify(control));
      // The page stopped printing the header counts in the prose pass of
      // 2 October 2026; the arithmetic is still held above, and the page
      // must still say what the grid is.
      else if (!/Its grid is not tiles<\/b> but leftover bytes of the program’s memory/.test(html))
        fail('cheats', 'the nothing map does not say its grid is leftover memory');
      else console.log(`  cheats: no application, so no keys stated; ` +
                       `${sprites.length} sprite classes read off the archive with 32 the hero, ` +
                       `${levels.length} levels, ${tp.last} teleporters, and the nothing map's ${heap.hits} of ${heap.heads} headers chained`);
    }
  }
} catch (e) { fail('cheats', e); }

/* The preferences file, on its own tab under Data (on Tools until
   27 September 2026, which must not carry it now), with NO application open -- which
   is the state a visitor who dropped the data file is in, and until v1.152.0
   was the state where this section offered nothing at all. It offers
   everything now: the four releases Ambrosia shipped give byte-for-byte the
   same layout, so PREF_SHIPPED stands in for a program that is not there,
   and smoke_installer holds that constant to every one of the four. What
   this checks is the half that one cannot: that the fallback reaches the
   visitor -- the switches render, the file builds, and the section says the
   numbers are the shipped ones rather than the open copy's. */
try {
  const grid = () => (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  const [tools, L, built, onTools, tab] = withoutApp(() => {
    ctx.showCategory('TOOLS');
    const was = grid();
    ctx.showCategory('PREFS');
    const t = grid();
    let b = null;
    try { b = ctx.buildCytheraPreferences({ cheats: true, Backdrop: -2 }); } catch (e) { b = null; }
    return [t, ctx.cytheraPrefsLayout(), b, /id="prefCheats"/.test(was), peek('TAB_LEAF_FOR').get('PREFS')];
  });
  const names = built ? ctx.openResourceFork(built).all().map(x => x.entry.name).join(',') : null;
  if (!L || L.from !== 'shipped') fail('preferences', 'with no application open the layout is not the shipped one: ' + (L && L.from));
  else if (!tab || tab.id !== 'prefs' || !tab.parent || tab.parent.id !== 'data' || tab.tile !== 0x1AC || tab.finder) fail('preferences', 'PREFS is not the Preferences tab under Data wearing tile 0x1AC');
  else if (onTools) fail('preferences', 'the Tools tab still carries the preferences file');
  else if (!/id="prefCheats"/.test(tools) || !/<select id="prefOrd_Backdrop"/.test(tools))
    fail('preferences', 'with no application open the Preferences tab does not offer the switches');
  else if (!/same in all four releases/.test(tools)) fail('preferences', 'the section does not say the numbers are the shipped releases\u2019');
  else if (names !== 'UI Prefs,Backdrop') fail('preferences', 'the file built with no application open is not the two-resource one: ' + names);
  else console.log(`  preferences: its own tab under Data and gone from Tools; no application, so the shipped layout -- ${L.controls.length + 2} switches, ${L.choices.length + L.ordinals.length} choosers, a ${built.length}-byte fork`);
} catch (e) { fail('preferences', e); }


/* A count that opens a list, 7 October 2026. A count in a sentence is a link
   to the things it counts (countLink, js/page-tabs.js), and the rule is that
   the list holds as many as the sentence says. Nothing held that: the chips
   are built beside the number, from the same array when the writer is
   careful and from a filter of it when not, and a list one short reads as
   well as a whole one. Every list's title opens "The N ...", so the title's
   own number is compared with the chips. A list grouped by something else
   ("by zone", "by character") has a chip a group and is passed over, which
   is what this cannot see: that a group's chips add up.

   Run last, since the lists are made as the sheets above are drawn. The
   control is the floor on how many were compared: a run that drew no sheet
   would compare none and pass. */
try {
  const lists = (ctx.COUNT_LISTS || []).filter(c => /^The \d/.test(c.title) && !/, by [a-z]+$/.test(c.title));
  const off = lists.filter(c => parseInt(c.title.slice(4).replace(/,/g, ''), 10) !== c.chips.length);
  if (lists.length < 20) fail('count lists', 'only ' + lists.length + ' counted lists were made, so the sheets that make them were not drawn');
  else if (off.length) fail('count lists', off.map(c => '"' + c.title + '" lists ' + c.chips.length).join('; '));
  else console.log(`  count lists: ${lists.length} counts each open a list of as many as they say`);
} catch (e) { fail('count lists', e); }

/* The License tab, 7 October 2026: a stub under Data beside Preferences.
   Three things are held. The tab is where the tabs say it is. The reader
   takes the name out of a file laid out as the two real ones are, made up
   here so the check needs nothing of the game's and carries no real code.
   And what the tab says of that file does not contain its code, which is
   the one thing the page must not print; the control is a file a byte
   short, which the reader must refuse where a loose one would read a name
   out of anything. */
try {
  const grid = () => (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  ctx.showCategory('LICENSE');
  const sheet = grid();
  const tab = peek('TAB_LEAF_FOR').get('LICENSE');
  const file = new Uint8Array(514);
  const put = (at, s) => { file[at] = s.length; for (let i = 0; i < s.length; i++) file[at + 1 + i] = s.charCodeAt(i); };
  put(0, 'A Made-Up Name'); put(256, 'ZZQQZZQQ'); file[513] = 1;
  const lic = ctx.cytheraLicenseRead(file), said = ctx.licenseSaidHTML(file);
  if (!tab || tab.id !== 'license' || !tab.parent || tab.parent.id !== 'data') fail('license', 'LICENSE is not the License tab under Data');
  else if (!/Make a License/.test(sheet) || !/macintoshrepository\.org/.test(sheet) || !/id="licenseFile"|licenseFile/.test(sheet + JSON.stringify([...REGISTRY.keys()]))) fail('license', 'the tab does not offer the picker and the link to Decoder Ring');
  else if (!lic || lic.name !== 'A Made-Up Name' || lic.hasCode !== true) fail('license', 'the reader did not take the name out of a made-up file: ' + JSON.stringify(lic));
  else if ('code' in lic || /ZZQQZZQQ/.test(JSON.stringify(lic) + said)) fail('license', 'the code reaches the page');
  else if (!/A Made-Up Name/.test(said)) fail('license', 'the tab does not say the name: ' + said);
  else if (ctx.cytheraLicenseRead(file.subarray(0, 513)) !== null) fail('license', 'a file a byte short was read as a license');
  else if (!/not a Cythera License file/.test(ctx.licenseSaidHTML(file.subarray(0, 513)))) fail('license', 'the tab does not refuse a file a byte short');
  else console.log(`  license: its own tab under Data; the name read from a made-up file and its code kept off the page; a file a byte short refused`);
} catch (e) { fail('license', e); }

/* Make a Save, 7 October 2026: a saved game built from the scenario open
   here (newGameSaveBytes, buildNewGameSave). That the game takes one is
   game_check.mjs's; this holds the half that needs no game. The creation
   script's figures are read, not typed, so each must come with its line;
   the file must read back as a save with the name given, the eleven
   resources a new game's has, and the hero with the stats asked for and
   the sprite of the branch chosen. The control is the other sprite: a
   builder that ignored the choice would give both files the same hero. */
try {
  const cr = ctx.heroCreationRules();
  const a = ctx.newGameSaveBytes({ name: 'NewGame01', sprite: 0, body: 21, reflex: 14, mind: 9, level: 3 });
  const b = ctx.newGameSaveBytes({ name: 'NewGame01', sprite: 1 });
  const info = a ? ctx.describeDelverArchive(new Uint8Array(a)) : null;
  const spec = a ? ctx.delverArchiveSpec(new Uint8Array(a)) : null;
  const heroOf = bytes => ctx.parseDelverCharacterRecords(ctx.delverArchiveSpec(new Uint8Array(bytes)).resources.find(r => r.resid === 0xF009).data)[1];
  const ha = a ? heroOf(a) : null, hb = b ? heroOf(b) : null;
  ctx.showCategory('SAVEGAME');
  const sheet = (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(REGISTRY.get('sheetGrid'));
  if (!cr || cr.sprites.length !== 2 || [cr.level, cr.training, cr.nutrition, cr.karma, cr.difficulty].some(v => !v || typeof v.at !== 'number')) fail('make a save', 'the creation script was not read with its lines: ' + JSON.stringify(cr));
  else if (!a || !b || !info || !info.ok || info.player !== 'NewGame01') fail('make a save', 'the file made does not read back as NewGame01’s save: ' + JSON.stringify(info));
  else if (spec.resources.length !== 11) fail('make a save', 'the file holds ' + spec.resources.length + ' resources, where a new game’s has eleven');
  else if (ha.body !== 21 || ha.reflex !== 14 || ha.mind !== 9 || ha.level !== 3 || !ha.health || ha.health !== ha.healthMax || ha.training !== cr.training.v) fail('make a save', 'the hero was not made as asked: ' + JSON.stringify(ha));
  else if (ha.proptype !== (cr.sprites[0].v & 0x3FF) || hb.proptype !== (cr.sprites[1].v & 0x3FF) || ha.proptype === hb.proptype) fail('make a save', 'the sprite chosen did not reach the hero: ' + ha.proptype + ' and ' + hb.proptype);
  else if (!/Make a Save/.test(sheet) || !/makeSaveFromForm/.test(sheet)) fail('make a save', 'the Saved Game tab does not offer the maker with a scenario open');
  else {
    console.log(`  make a save: the creation script read with its lines; a new game for NewGame01 in ${spec.resources.length} resources, body ${ha.body}, level ${ha.level}, health ${ha.health}; the two sprites give two heroes`);
    /* The second half, 8 October 2026: the place, the hour and day, a named
       state and a companion. The file must carry the list and map memory of
       the zone asked for and not the hero's own; the hero and the companion
       must stand in it on different squares, the companion with the hero's
       party bits, behaviour 1 and his alignment; the Char block must hold
       the state's value, the hour and the day. The control is the plain
       save above, which must have none of them, and a square off the map,
       which must be refused. Without the resource fork there are no named
       states, and that part says so. */
    const d = ctx.saveMakerDefaults(), z = d.zones.find(k => k.zone !== d.zone && k.zone > 1).zone, pal = d.companions[0], st = d.stories.find(t => Object.keys(t.values).length);
    const c = ctx.newGameSaveBytes({ name: 'NewGame01', zone: z, party: pal ? [pal.index] : [], story: st ? st.name : '', hour: 14, day: 3 });
    const cs = c ? ctx.delverArchiveSpec(new Uint8Array(c)) : null, has = (sp, id) => sp.resources.some(r => r.resid === id);
    const off = ctx.newGameSaveBytes({ name: 'NewGame01', zone: z, x: 9999, y: 0 });
    if (!cs || off !== null) fail('make a save', 'the page made no save in zone ' + z + ', or made one with the hero off the map');
    else {
      const recs = ctx.parseDelverCharacterRecords(cs.resources.find(r => r.resid === 0xF009).data), h = recs[1], p = pal ? recs[pal.index] : null;
      const ch = cs.resources.find(r => r.resid === 0x0400).data, plain = spec.resources.find(r => r.resid === 0x0400).data, plainRecs = ctx.parseDelverCharacterRecords(spec.resources.find(r => r.resid === 0xF009).data);
      const clock = ((ch[80] << 24) | (ch[81] << 16) | (ch[82] << 8) | ch[83]) >>> 0, day = (ch[84] << 8) | ch[85];
      const [sn, sv] = st ? Object.entries(st.values)[0] : [];
      if (!has(cs, 0x8100 + z) || !has(cs, 0x8200 + z) || has(cs, 0x8100 + d.zone) || h.zone !== z) fail('make a save', 'the save is not in zone ' + z + ' with that zone’s list and map memory');
      else if (!d.companions.length || !p || p.zone !== z || (p.x === h.x && p.y === h.y) || (p.state & h.state) !== h.state || p.raw[22] !== 1 || p.raw[25] !== h.raw[25] || (plainRecs[pal.index].state & 0x40)) fail('make a save', 'the companion is not beside the hero as a party member, or is one in the plain save too: ' + JSON.stringify(p && { zone: p.zone, x: p.x, y: p.y, state: p.state, behaviour: p.raw[22] }));
      else if (clock !== 14 * 0x1000 || day !== 3 || ((plain[84] << 8) | plain[85]) === 3) fail('make a save', 'the hour and the day asked for are not in the Char block: ' + JSON.stringify({ clock, day }));
      else if (st && (ch[16 + +sn] !== sv || plain[16 + +sn] === sv)) fail('make a save', 'the named state did not set its quest value, or the plain save has it too');
      else console.log(`  make a save, the second half: zone ${z} with its list; ${pal.name} beside the hero as a party member; two in the afternoon on day 3; ` + (st ? `"${st.name}" sets quest value ${sn} to ${sv}` : 'no resource fork here, so no named state was tried') + `; ${d.zones.length} places, ${d.companions.length} who can join, ${d.stories.length} named states; a square off the map refused`);
      /* The archetypes (archetypeRules), the same day. The game says what
         each is twice: the table the scripts read, and two tables of text
         the creation dialog shows, 0x0205 ("Body: 18  Reflex: 18  Mind:
         12") and 0x0206 ("Attack[4], Defense[4]"). The reader takes the
         first; the text is the oracle. Every stat and every skill with
         its level must agree, bar the one place the game disagrees with
         itself: the Beserker [sic], whose table has mind 12 and whose
         text says 6. A save made as one must end with a record a skill at
         the end of the zone's list, the hero's, at the level with the
         conversation's bit; a save made as none must have no such record. */
      const ar = ctx.archetypeRules(), texts = rid => ctx.parseDelverTextArray(ctx.smartDecrypt(ctx.getResourceBytes(peek('ARCHIVE'), rid), rid).data).map(t => t.str);
      const statText = texts(0x0205), skillText = texts(0x0206), odd = [];
      for (const a of (ar ? ar.list : [])) {
        const m = /Body: (\d+)\s+Reflex: (\d+)\s+Mind: (\d+)/.exec(statText[a.index] || '');
        if (!m || +m[1] !== a.body || +m[2] !== a.reflex) odd.push(a.name + ' body or reflex');
        if (m && +m[3] !== a.mind) odd.push(a.name + ' mind ' + a.mind + ' against ' + m[3]);
        const said = (skillText[a.index] || '').split(',').map(t => t.trim()).filter(Boolean).map(t => { const g = /^(.*?)(?:\[(\d+)\])?$/.exec(t); return g[1].trim() + ':' + (g[2] || 0); });
        const read = a.skills.map(k => (ctx.selfNameFor(0x1A00 | (k.type & 0xFF)) || '?') + ':' + k.level);
        const loose = t => t.toLowerCase().replace(/s?:/, ':').replace(/ picking/, '');
        if (said.map(loose).join() !== read.map(loose).join()) odd.push(a.name + ' skills ' + read.join(' ') + ' against ' + said.join(' '));
      }
      const fighter = ar && ar.list.find(a => a.skills.length === 2), fs = fighter ? ctx.delverArchiveSpec(new Uint8Array(ctx.newGameSaveBytes({ name: 'NewGame01', archetype: fighter.index }))) : null;
      const tail = fs ? ctx.parseDelverPropList(fs.resources.find(r => r.resid === 0x8100 + d.zone).data).slice(-2) : [];
      const plainList = ctx.parseDelverPropList(spec.resources.find(r => r.resid === 0x8100 + d.zone).data);
      const fh = fs ? ctx.parseDelverCharacterRecords(fs.resources.find(r => r.resid === 0xF009).data)[1] : null;
      if (!ar || ar.list.length !== 9 || typeof ar.flags.at !== 'number' || typeof ar.bit.at !== 'number') fail('archetypes', 'the nine archetypes were not read with the lines their giving comes from');
      else if (odd.length !== 1 || !/mind 12 against 6/.test(odd[0])) fail('archetypes', 'the table and the dialog’s text disagree other than at the one known place: ' + JSON.stringify(odd));
      else if (!fighter || tail.length !== 2 || !tail.every((r, i) => r.flags === ar.flags.v && r.x === 0 && r.y === 1 && r.proptype === fighter.skills[i].type && r.aspect === (fighter.skills[i].level | ar.bit.v)) || fh.body !== fighter.body || fh.raw[29] !== 0)
        fail('archetypes', 'a save made as a ' + (fighter && fighter.name) + ' does not end its zone’s list with the two skills, or has not its stats: ' + JSON.stringify(tail.map(r => [r.flags, r.proptype, r.aspect])));
      else if (plainList.some(r => r.flags === ar.flags.v && r.x === 0 && r.y === 1)) fail('archetypes', 'a save made with no archetype has a skill');
      /* The Berserker's mind as a fix with two ways to go (Data > Patches,
         the text's choices; 8 October 2026). Either option must change one
         resource and leave the table and the dialog's text agreeing on all
         nine; the text's way must keep every other string as it was, the
         strings after the mended one having moved; the table's way must
         change the one word. The control is the file as shipped, which
         disagrees, and the second option run on the first's output, which
         must be refused as having nothing to mend. */
      else if ((() => {
        const base = peek('ARCHIVE.bytes'), before0 = ctx.delverArchiveSpec(base);
        const minds = sp => { const tb = sp.resources.find(r => r.resid === 0x0501).data, top = ctx.dvmArrayWords(tb, ctx.u32be(tb, 0x110) & 0xFFFF);
          const tx = ctx.parseDelverTextArray(sp.resources.find(r => r.resid === 0x0205).data).map(t => t.str);
          return { table: top.map(p => ctx.dvmArrayWords(tb, p & 0xFFFF)[2]), text: tx.map(t => +/Mind: (\d+)/.exec(t)[1]), strings: tx }; };
        const changed = sp => sp.resources.filter(r => { const o = before0.resources.find(x => x.resid === r.resid); return o.data.length !== r.data.length || o.data.some((v, i) => v !== r.data[i]); }).map(r => r.resid);
        const a = ctx.applyDataFixes(base, ['beserker-text']).spec, b = ctx.applyDataFixes(base, ['beserker-table']).spec, m0 = minds(before0), ma = minds(a), mb = minds(b);
        let again = false; try { ctx.applyDataFixes(new Uint8Array(ctx.writeDelverArchive(a)), ['beserker-table']); } catch (e) { again = /agree/.test(e.message); }
        if (m0.table.join() === m0.text.join()) return fail('berserker', 'the shipped file already agrees, so there is nothing for the fix to be tried on'), true;
        if (changed(a).join() !== String(0x0205) || ma.table.join() !== ma.text.join() || ma.table.join() !== m0.table.join() || ma.strings.filter((t, i) => t !== m0.strings[i]).length !== 1)
          return fail('berserker', 'the text’s way did not change the one string of 0x0205 to the table’s figure: ' + JSON.stringify({ changed: changed(a), text: ma.text })), true;
        if (changed(b).join() !== String(0x0501) || mb.table.join() !== mb.text.join() || mb.text.join() !== m0.text.join()) return fail('berserker', 'the table’s way did not change the one word of 0x0501 to the text’s figure: ' + JSON.stringify({ changed: changed(b), table: mb.table })), true;
        if (!again) return fail('berserker', 'the second way was not refused on a file the first had mended'), true;
        console.log(`  berserker: the shipped file has mind ${m0.table[3]} in the table and ${m0.text[3]} on the screen; one way writes ${ma.text[3]} into the text alone, the other ${mb.table[3]} into the table alone, and either leaves all nine agreeing; a mended file refuses the other way`);
        return false; })()) { /* said */ }
      /* The king's welcome and the hero's faces (the same day). The
         welcome's four pieces must be read with their lines, and a save
         made with it must have the flag, the To Do line, the thing held
         and the king's own flag, which the plain save must not. The faces
         are the program's: with it open, two sexes of as many as it
         says, every one a portrait the file has and names for nobody;
         with none open, no strip. */
      else if ((() => { const kw = ctx.kingsWelcomeRules(), hp = ctx.exeHeroPortraits();
        const w = kw ? ctx.delverArchiveSpec(new Uint8Array(ctx.newGameSaveBytes({ name: 'NewGame01', welcomed: true }))) : null;
        const q = w ? ctx.saveQuestState(w) : null, p0 = ctx.saveQuestState(spec);
        const gift = w ? ctx.parseDelverPropList(w.resources.find(r => r.resid === 0x8100 + d.zone).data).slice(-1)[0] : null;
        const faces = hp ? Array.from({ length: hp.perSex.v * 2 }, (_, i) => 0x87FF + hp.first.v + i) : [];
        if (!kw || typeof kw.flag.at !== 'number' || !q || !q.flags[kw.flag.v] || p0.flags[kw.flag.v] || !(q.chars[kw.who].state & (1 << kw.charFlag.v)) || (p0.chars[kw.who].state & (1 << kw.charFlag.v)) ||
            !gift || gift.proptype !== kw.gift.type || gift.d3 !== kw.gift.d3 || gift.flags !== 0x10 || w.resources.find(r => r.resid === 0x0401).data[5] === 0x00 && w.resources.find(r => r.resid === 0x0401).data[4] !== 0x30)
          return fail('welcome', 'the king’s welcome is not in the save made with it, or is in the plain one: ' + JSON.stringify(kw)), true;
        if (hp && (hp.perSex.v < 1 || faces.some(r => !ctx.refExists(r) || ctx.labelFor(r)))) return fail('welcome', 'the hero’s faces are not portraits the file has and names for nobody: ' + JSON.stringify(hp)), true;
        console.log(`  the king's welcome: quest flag ${kw.flag.v}, his flag ${kw.charFlag.v}, To Do line ${kw.todo.line} in slot ${kw.todo.slot} and thing ${kw.gift.type}, each with its line, in the save made with it and not the plain one; ` + (hp ? `${faces.length} faces from the program` : 'no program here, so no faces'));
        return false; })()) { /* said */ }
      else console.log(`  archetypes: nine read from the table, every stat and skill as the dialog’s own text has it but the ${odd[0].split(' ')[0]}’s mind (${/mind (\d+) against (\d+)/.exec(odd[0]).slice(1).join(' in the table, ')} in the text); a ${fighter.name}’s save ends with ${tail.length} skills at their levels, a plain one has none`);
    }
  }
} catch (e) { fail('make a save', e); }

/* Make a Scenario, 8 October 2026: the open scenario with its world
   emptied to one zone (newScenarioBytes, buildNewScenario). That the game
   starts a new game on one is game_check.mjs's; this holds the half that
   needs no game. The file must keep one map, one list and one entry
   script, all the hero's zone's, and no conversation but the creation
   script; the map must be the size and the tile asked for; the hero must
   be the only character and stand where asked; the entry script must carry
   the name; and the creation script must have lost its slideshow and kept
   the rest. The control is the same call with the opening kept, which must
   leave 0x1801 as the scenario has it: a cut that fired whatever was asked
   would fail there. A hero outside the zone and a name the listing cannot
   hold must be refused. */
try {
  const d = ctx.scenarioMakerDefaults();
  const ask = { name: 'Empty Field', width: 24, height: 20, x: 10, y: 12 };
  const made = ctx.newScenarioBytes(ask), kept = ctx.newScenarioBytes(Object.assign({ opening: true }, ask));
  const before = ctx.delverArchiveSpec(peek('ARCHIVE.bytes'));
  const spec = made ? ctx.delverArchiveSpec(new Uint8Array(made)) : null, kspec = kept ? ctx.delverArchiveSpec(new Uint8Array(kept)) : null;
  const of = (sp, rid) => (sp.resources.find(r => r.resid === rid) || {}).data;
  const fam = k => spec.resources.filter(r => (r.resid >> 8) === k).map(r => r.resid);
  const same = (x, y) => !!x && !!y && x.length === y.length && x.every((v, i) => v === y[i]);
  // The first function's listing, a line an instruction, from the bytes alone.
  const says = (b, re) => {
    const fn = ctx.dvmExtents(b, 0x1801).find(e => e[2] === 'function');
    return !!fn && ctx.dvmDisassemble(b.subarray(fn[0], fn[1]), 3).ops.some(op => re.test(op[2] + (op[3] ? ' ' + op[3] : '')));
  };
  let refusedSquare = false, refusedName = false;
  try { refusedSquare = ctx.newScenarioBytes(Object.assign({}, ask, { x: 24 })) === null; } catch (e) { refusedSquare = true; }
  try { ctx.newScenarioBytes(Object.assign({}, ask, { name: 'A "quoted" name' })); } catch (e) { refusedName = true; }
  if (!d || !d.tiles.length || !d.lit) fail('make a scenario', 'the open file offered nothing to start from: ' + JSON.stringify(d && { zone: d.zone, tiles: d.tiles.length, lit: d.lit }));
  else if (!spec || !kspec) fail('make a scenario', 'the page made no file');
  else {
    const z = d.zone, map = of(spec, 0x8000 + z), m = map ? ctx.parseDelverMap(map) : null;
    const cast = ctx.parseDelverCharacterRecords(of(spec, 0xF009)), hero = cast[1];
    const words = new Set(); if (m) for (let i = 0; i < m.width * m.height; i++) words.add((map[m.mapDataOffset + i * 2] << 8) | map[m.mapDataOffset + i * 2 + 1]);
    const cr = of(spec, 0x1801), cr0 = of(before, 0x1801);
    if (fam(0x80).join() !== String(0x8000 + z) || fam(0x81).join() !== String(0x8100 + z) || fam(0x14).join() !== String(0x1400 + z) || fam(0x18).join() !== String(0x1801))
      fail('make a scenario', 'more than the hero’s zone and the creation script is left: ' + JSON.stringify({ maps: fam(0x80).length, lists: fam(0x81).length, entry: fam(0x14).length, talk: fam(0x18).length }));
    else if (!m || m.width !== 24 || m.height !== 20 || words.size !== 1 || !words.has(d.tile)) fail('make a scenario', 'the map is not 24 by 20 of the tile offered: ' + JSON.stringify(m && { w: m.width, h: m.height, words: [...words].slice(0, 4) }));
    else if (hero.zone !== z || hero.x !== 10 || hero.y !== 12 || cast.some((r, i) => i > 1 && (r.zone || ctx.delverCharacterInUse(r)))) fail('make a scenario', 'the hero is not alone at (10, 12): ' + JSON.stringify({ zone: hero.zone, x: hero.x, y: hero.y, others: cast.filter((r, i) => i > 1 && ctx.delverCharacterInUse(r)).length }));
    else if ((ctx.parseDelverScheduleList(of(spec, 0xF00B)) || [0]).length) fail('make a scenario', 'somebody still has a schedule');
    else if (!Buffer.from(of(spec, 0x1400 + z)).includes('Empty Field')) fail('make a scenario', 'the entry script does not carry the name');
    else if (!says(cr0, /Slideshow/) || says(cr, /Slideshow|SpecialView/) || !says(cr, /set_global Karma/) || cr.length >= cr0.length) fail('make a scenario', 'the creation script did not lose its slideshow and keep the rest');
    else if (!same(of(kspec, 0x1801), cr0)) fail('make a scenario', 'with the opening kept, the creation script is not the scenario’s');
    else if (!refusedSquare || !refusedName) fail('make a scenario', 'a hero outside the zone or a name with a quotation mark was not refused: ' + JSON.stringify({ refusedSquare, refusedName }));
    else {
      ctx.showCategory('PATCHES');
      const host = REGISTRY.get('scenarioMaker'), html = host ? (function all(el) { return (el.innerHTML || '') + (el.children || []).map(all).join(''); })(host) : '';
      const buttons = host ? (function all(el) { return (el.tagName === 'BUTTON' ? [el.textContent] : []).concat(...(el.children || []).map(all)); })(host) : [];
      /* The battle and the art (the same day). Two enemy kinds must come
         out as an egg and its creature apiece, in two columns a square
         either side of the hero; two kinds of one alignment must be
         refused, which is the control on the side test. Every picture of
         the five families must come out changed and still decode at its
         own size (an empty one may come out as it went in), a portrait
         must carry the three face colours, the hero's frames must be
         black, white and see-through and nothing else, and the rest of
         the file must be untouched. */
      const kinds = ctx.scenarioCreatureChoices(), ka = kinds[0], kb = kinds.find(k => k.alignment !== ka.alignment), kc = kinds.find(k => k !== ka && k.alignment === ka.alignment);
      const fought = ctx.newScenarioBytes(Object.assign({ armyA: ka.type, armyB: kb.type, armyCount: 3, badArt: true }, ask));
      let sameSide = false;
      try { ctx.newScenarioBytes(Object.assign({ armyA: ka.type, armyB: kc.type }, ask)); } catch (e) { sameSide = /same side/.test(e.message); }
      const fspec = ctx.delverArchiveSpec(new Uint8Array(fought)), farc = ctx.openDelverArchive(new Uint8Array(fought)), marc = ctx.openDelverArchive(new Uint8Array(made));
      const recs = ctx.parseDelverPropList(of(fspec, 0x8100 + z));
      const eggsOk = recs.length === 12 && recs.every((r, i) => i % 2 ? r.flags === 0x08 && (r.d3 >> 8) === 8 : r.flags === 0x42 && (r.d3 & 0xFF) === 100 && (r.x === 9 || r.x === 11) && r.y >= 7 && r.y <= 9);
      let pics = 0, redrawn = 0, sized = 0, others = 0;
      for (const r of fspec.resources) {
        const was = of(spec, r.resid), fam = r.resid >> 8;
        if (![0x84, 0x88, 0x8A, 0x8E, 0x8F].includes(fam)) { if (r.resid !== 0x8100 + z && !same(r.data, was)) others++; continue; }
        pics++;
        const da0 = ctx.decodeResource(marc, was, fam - 1, r.resid);
        // A picture with nothing in it comes out as it went in.
        if (!same(r.data, was) || !da0.image.some(v => v)) redrawn++;
        const da = ctx.decodeResource(marc, was, fam - 1, r.resid), db = ctx.decodeResource(farc, r.data, fam - 1, r.resid);
        if (da.W === db.W && da.H === db.H && db.image.length === da.image.length) sized++;
      }
      const face = ctx.decodeResource(farc, of(fspec, 0x8801), 0x87, 0x8801).image, has = (r, g, b) => face.includes(ctx.badArtIndex(r, g, b));
      const fig = ctx.scenarioFigureTiles(), heroTiles = Object.keys(fig).map(Number).filter(t => fig[t].kind === 'hero');
      const bw = new Set([0, ctx.badArtIndex(0, 0, 0), ctx.badArtIndex(255, 255, 255)]);
      const heroOk = heroTiles.length >= 2 && heroTiles.every(t => { const sheet = ctx.decodeResource(farc, of(fspec, 0x8E00 + (t >> 4)), 141, 0x8E00 + (t >> 4)).image, px = sheet.subarray((t & 15) * 1024, (t & 15) * 1024 + 1024); return px.includes(0) && px.some(v => v) && px.every(v => bw.has(v)); });
      /* The same as a patch (scenarioPatch): merged into the open file, as
         the browser player merges one, every resource the made file holds
         must come out as the made file has it. What the made file dropped
         stays, which is the difference a patch cannot help; the control is
         that the merge changes the hero's zone's map at all. */
      const pw = ctx.scenarioPatch(Object.assign({ armyA: ka.type, armyB: kb.type, armyCount: 3, badArt: true }, ask));
      const mergedSpec = ctx.delverArchiveSpec(ctx.mergeDelverPatch(peek('ARCHIVE.bytes'), pw.bytes).bytes);
      const strays = fspec.resources.filter(r => !same(of(mergedSpec, r.resid), r.data)).length;
      const patchOk = pw.count > 400 && !strays && mergedSpec.resources.length === before.resources.length && !same(of(mergedSpec, 0x8000 + z), of(before, 0x8000 + z));
      if (!host || buttons.length !== 5) fail('make a scenario', 'Data › Patches does not offer the maker with its five buttons: ' + JSON.stringify(buttons));
      else if (!patchOk) fail('make a scenario', 'the patch, merged, is not the made file over the open one: ' + JSON.stringify({ count: pw.count, strays, resources: mergedSpec.resources.length }));
      else if (!eggsOk || !sameSide) fail('make a scenario', 'the battle is not six eggs in two columns north of the hero, or one side against itself was not refused: ' + JSON.stringify({ records: recs.length, sameSide }));
      else if (!pics || redrawn !== pics || sized !== pics || others) fail('make a scenario', 'the pictures were not all redrawn at their own sizes with the rest left alone: ' + JSON.stringify({ pics, redrawn, sized, others }));
      else if (!has(255, 255, 255) || !has(0, 0, 0) || !has(220, 0, 0)) fail('make a scenario', 'a portrait has no face drawn on it');
      else if (!heroOk) fail('make a scenario', 'the hero’s ' + heroTiles.length + ' frames are not a black and white figure');
      else console.log(`  make a scenario, battle and art: ${ka.name} against ${kb.name}, three eggs a side; ${ka.name} against ${kc.name} refused; ${pics} pictures redrawn at their own sizes, a face on the portrait, the hero’s ${heroTiles.length} frames black and white, nothing else changed; as a patch, ${pw.count} resources that merge to the same`);
      if (!host || buttons.length !== 5) { /* said above */ }
      else console.log(`  make a scenario: ${before.resources.length} resources to ${spec.resources.length}; zone ${z} alone, 24 by 20 of ${d.tiles[0].name}, the hero alone at (10, 12); the slideshow cut (${cr0.length - cr.length} bytes) and kept when asked; a square outside and a quoted name refused`);
    }
  }
} catch (e) { fail('make a scenario', e); }

/* A zone from Manborough's editor, 8 October 2026 (manboroughMap). His
   sample export in reference/ is Land King Hall as his importer made it
   from this same archive, which makes the archive the oracle: every map
   word read from his file must be the archive's, and every thing must sit
   where the archive has a record of that type. The scenario made from it
   must keep the people he placed, each in the zone with a conversation,
   and nobody else. A JSON file that is not a map must be refused. Skips
   with a line when the sample is not on the disk. */
try {
  const sample = 'reference/community/editors/Manborough/mygreatscenario.zip';
  if (!existsSync(sample)) console.log('  manborough: the sample export is not at ' + sample + ', so the import was not tried');
  else {
    const m = ctx.manboroughMap(new Uint8Array(readFileSync(sample))), arc = peek('ARCHIVE'), z = ctx.loadCharacterTable()[1].zone;
    const raw = ctx.getResourceBytes(arc, 0x8000 + z), mp = ctx.parseDelverMap(raw);
    let words = 0; for (let i = 0; i < m.width * m.height; i++) if (((raw[mp.mapDataOffset + i * 2] << 8) | raw[mp.mapDataOffset + i * 2 + 1]) === m.tiles[i]) words++;
    const have = new Set(ctx.parseDelverPropList(ctx.getResourceBytes(arc, 0x8100 + z)).map(r => r.proptype + '@' + r.x + ',' + r.y));
    const found = m.props.filter(p => have.has(p.type + '@' + p.x + ',' + p.y)).length;
    const made = ctx.delverArchiveSpec(new Uint8Array(ctx.newScenarioBytes({ map: m })));
    const cast = ctx.parseDelverCharacterRecords(made.resources.find(r => r.resid === 0xF009).data);
    const there = cast.map((r, i) => i > 1 && ctx.delverCharacterInUse(r) ? i : 0).filter(Boolean), asked = m.cast.map(c => c.index).sort((a, b) => a - b);
    const talk = made.resources.filter(r => (r.resid >> 8) === 0x18 && r.resid !== 0x1801).map(r => r.resid - 0x1800).sort((a, b) => a - b);
    const list = ctx.parseDelverPropList(made.resources.find(r => r.resid === 0x8100 + z).data);
    let refused = false; try { ctx.manboroughMap(new TextEncoder().encode('{"levels":[]}')); } catch (e) { refused = true; }
    /* The hatcheries (the same day's correction): his number is the unit
       record's, so a guard's must hatch the prop type unit 7 wears and not
       prop type 7, which v1.272.0 wrote. And out again (manboroughExport):
       his map written back must read as the same map, object for object,
       which is his own text returned; a zone made by the form must come
       back as its size, its one tile and the hero's square, with the
       battle named as left out. */
    const units = ctx.parseMonsterStats(), guard = units[7].proptype;
    const eggsOk = m.eggs.length && m.eggs.every(e => e.type === guard) && guard !== 7;
    const outA = ctx.manboroughExport({ map: m }), backA = ctx.manboroughMap(outA.bytes);
    const j = v => JSON.stringify(v);
    const roundA = j(backA.source.objects) === j(m.source.objects) && j(backA.source.cells) === j(m.source.cells) && backA.x === m.x && backA.y === m.y && j(Array.from(backA.tiles)) === j(Array.from(m.tiles));
    const outB = ctx.manboroughExport({ name: 'Empty Field', width: 24, height: 20, x: 10, y: 12, armyA: 47, armyB: 93 }), backB = ctx.manboroughMap(outB.bytes);
    const roundB = backB.width === 24 && backB.height === 20 && backB.x === 10 && backB.y === 12 && new Set(backB.tiles).size === 1 && !backB.props.length && outB.left.join() === 'the battle' && /^[a-z0-9_]+$/.test(outB.id);
    if (!eggsOk) fail('manborough', 'a guard hatchery does not hatch the guard: ' + j(m.eggs.slice(0, 2)) + ', unit 7 wears ' + guard);
    else if (!roundA || !roundB) fail('manborough', 'a map written out does not read back: ' + j({ roundA, roundB, left: outB.left, id: outB.id }));
    else if (mp.width !== m.width || mp.height !== m.height || words !== m.width * m.height) fail('manborough', `the map read is not the archive's: ${words} of ${m.width * m.height} words agree`);
    else if (!m.props.length || found !== m.props.length) fail('manborough', `${m.props.length - found} of ${m.props.length} things are not where the archive has one of that type`);
    else if (!asked.length || there.join() !== asked.join() || !asked.every(i => talk.includes(i) && cast[i].zone === z)) fail('manborough', 'the people placed are not the ones kept, in the zone, with their conversations: ' + JSON.stringify({ asked, there, talk }));
    else if (list.length !== m.props.length + 2 * m.eggs.length || !m.eggs.length) fail('manborough', `the zone's list is ${list.length} records for ${m.props.length} things and ${m.eggs.length} hatcheries`);
    else if (m.x !== ctx.loadCharacterTable()[1].x || m.y !== ctx.loadCharacterTable()[1].y || !refused) fail('manborough', 'the start square is not the hero\'s, or a file that is no map was taken');
    else console.log(`  manborough: his Land King Hall read back as the archive's, ${words} map words and ${found} things; ${asked.length} people kept with their conversations, ${m.eggs.length} hatcheries; ${m.skipped.length} objects left out; a file that is no map refused; written out, his map and a made zone both read back`);
  }
} catch (e) { fail('manborough', e); }

/* What uses a character flag the program does not name, 8 October 2026
   (charFlagUses, in a record's Edit form). The mistake to catch is a flag
   of byte 8 listed with every script that sets flag 0 on anybody, forty
   characters' private notes under one head: so a character whose script
   sets its own flag 0 must say so with a link, a character whose script
   never mentions flag 0 must say nothing, and a flag of byte 26 must name
   its spell on any record. */
try {
  const cf = ctx.characterFlagSites().flags, f0 = cf.find(x => x.flag === 0);
  const own = f0 ? f0.set.map(s => s.resid - 0x1800).find(i => i > 1 && i < 256 && ctx.loadCharacterTable()[i]) : undefined;
  const touched = new Set(f0 ? [...f0.set, ...f0.clear, ...f0.test, ...f0.effect].flatMap(s => [s.resid - 0x1800, s.who]) : []);
  let none = -1; for (let i = 2; i < 256; i++) if (ctx.loadCharacterTable()[i] && !touched.has(i)) { none = i; break; }
  const withEffect = cf.find(x => x.flag >= 24 && x.effect.length);
  const mine = own !== undefined ? ctx.charFlagUses(own, 0) : '';
  const links = (mine.match(/jumpToScriptAt\((\d+)/g) || []).map(m => +m.replace(/\D+/, ''));
  if (own === undefined || none < 0 || !withEffect) fail('flag uses', 'the file has no character to try: ' + JSON.stringify([own, none, withEffect && withEffect.flag]));
  else if (!/^set in <button/.test(mine) && !/set in <button/.test(mine)) fail('flag uses', 'character ' + own + '’s flag 0 does not say where its script sets it: ' + mine.slice(0, 200));
  else if (ctx.charFlagUses(none, 0) !== '') fail('flag uses', 'character ' + none + ', whose script never mentions flag 0, is told of other characters’: ' + ctx.charFlagUses(none, 0).slice(0, 200));
  else if (!/the effect of /.test(ctx.charFlagUses(none, withEffect.flag))) fail('flag uses', 'flag ' + withEffect.flag + ' does not name the spell it is the effect of');
  else if (!/The program has no name for these/.test(ctx.charEditHTML(own))) fail('flag uses', 'the record form does not carry the uses');
  else console.log(`  flag uses: character ${own}'s flag 0 is listed from its own script, character ${none}'s is not listed, and flag ${withEffect.flag} names its spell on any record`);
} catch (e) { fail('flag uses', e); }
