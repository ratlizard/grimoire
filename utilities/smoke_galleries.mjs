// smoke_galleries.mjs -- one part of the UI smoke: every category opened, every gallery drawn and every resource in it opened, the fork galleries, the roofs, walls and marks, the frame runs, the gallery filter, the map landing and the deep links.
// Cut out of viewer_smoke.mjs on 18 September 2026 at a point where the open
// file changes, so it runs from a fresh boot (smoke_boot.mjs) as its own
// process. Run alone with
//   node utilities/viewer_smoke.mjs index.html "$TMPDIR/Cythera Data.data" "" <installers .sit> <saved game> galleries
// and with the other parts by naming them; with none named the runner drives
// all six in this process, in order.
import { htmlPath, dataPath, onlyCat, visePath, savePath, html, js, archive, rsrcPath, rsrcFork, missingIds,
         El, REGISTRY, catSel, optionSource, CATEGORY_VALUES, body, documentStub, rafQueue, drainRaf, sandbox,
         ctx, peek, fail, t0, status, A, readFileSync, existsSync, tally } from './smoke_boot.mjs';

// v1.47.0: the dialogue box is read off the file -- the frame from a tile
// as a border-image, the blue from a clut's ColorSpec in the fork -- and
// since v1.52.0 which tile, which clut and where in it are the
// application's (exeDialogueBox). With only the data file open there is no
// application, so nothing is drawn over the stylesheet's own look; the
// installer section below requires the box drawn from the program.
await new Promise(r => setTimeout(r, 200));
{
  const box = ctx.__peek('window.DIALOGUE_BOX');
  /* Inverted on 13 September 2026. This used to require that with no
     application open the box showed NOTHING -- the stylesheet's own frame
     and blue stood in, from a captured PNG and a typed colour. Both of those
     are gone: the frame tile 0x19D is in the DATA file, so a data-only
     session draws the game's real frame, and the blue falls back to the
     figure the program gives (which the installer check below reads back out
     of the executable, so it cannot drift).

     What must still be true here is that the PROGRAM is not the source --
     `read` null, `fromProgram` false -- while the frame and the blue are
     present anyway. The frame is built asynchronously from the tile, so it
     is waited for rather than assumed. */
  for (let w = 0; w < 3000 && !((ctx.__peek('window.DIALOGUE_BOX') || {}).frame); w += 50) await new Promise(r => setTimeout(r, 50));
  const b2 = ctx.__peek('window.DIALOGUE_BOX') || {};
  if (b2.read || b2.fromProgram) fail('dialogue box', 'the program is not open here, yet the box says it supplied the figures: ' + JSON.stringify(b2.read));
  else if (!b2.blue) fail('dialogue box', 'the data file alone gave no blue, where the default should have stood in');
  else if (!b2.frame) fail('dialogue box', 'the data file alone drew no frame, though tile 0x19D is in the archive');
  else if (!/--boxBlue:rgba\(/.test(b2.css || '')) fail('dialogue box', 'no blue rule was written: ' + JSON.stringify((b2.css || '').slice(0, 60)));
  else console.log('  dialogue box: the data file alone — frame from tile 0x' + (b2.tile || 0).toString(16).toUpperCase() +
    ', blue ' + b2.blue.join(',') + (b2.blueFromDefault ? ' (the program’s figure, as default)' : ' (from the file’s own clut)'));

/* The default blue is written TWICE and must not drift.

   It shows before a file is open, deliberately: seeing it is how a reader
   knows they are looking at the hard-coded figure rather than the file's own
   (the maintainer, 13 September 2026). That only works while the figure on
   screen IS the fallback the script would use -- and the two live apart, as
   `rgba(0,0,168,.5)` in the stylesheet and `[0, 0, 168]` in
   DLG_BOX_DEFAULTS, in different notations. Change one and the indicator
   quietly stops indicating anything. Compared against the page's own source
   text, since the stub parses no CSS. */
{
  const D = peek('DLG_BOX_DEFAULTS') || {};
  const m = /--boxBlue:rgba\((\d+),\s*(\d+),\s*(\d+),\s*\.5\)/.exec(html);
  const css = m ? [+m[1], +m[2], +m[3]] : null;
  if (!D.blue) fail('dialogue box', 'DLG_BOX_DEFAULTS is not reachable, so the default cannot be checked at all');
  else if (!css) fail('dialogue box', 'the stylesheet carries no --boxBlue default to compare against');
  else if (css.join(',') !== D.blue.join(',')) fail('dialogue box', 'the default has drifted: the stylesheet shows ' + css.join(',') + ' and DLG_BOX_DEFAULTS.blue is ' + D.blue.join(','));
  else console.log('  dialogue box default: the stylesheet and DLG_BOX_DEFAULTS agree on ' + D.blue.join(','));
}
}

/* The loop below is most of this part's time, and one category is most of
   the loop: 127, the maps, whose every resource is a whole map rendered
   through the stub -- 15.6 of the loop's 27 seconds on 18 September 2026,
   with no other category over 1.1 (the `slowest:` line below names them).
   So check_all.mjs runs it as two rows: imported as
   smoke_galleries.mjs?slice=a it drives the maps alone, as ?slice=b every
   other category, with no slice the lot. The sections that followed the
   loop are smoke_views.mjs. */
const slice = new URL(import.meta.url).searchParams.get('slice');
const cats = onlyCat ? [onlyCat] : CATEGORY_VALUES;
const wanted = slice === 'a' ? cats.filter(v => String(v) === '127') : slice === 'b' ? cats.filter(v => String(v) !== '127') : cats;
let galleries = 0, opened = 0, cellsSeen = 0;
const took = [];   // [category, ms], so the slow ones are named rather than guessed
for (const v of wanted) {
  const grid = REGISTRY.get('sheetGrid');
  const tv = Date.now();
  took.push([v, 0]);
  try {
    if (!ctx.showCategory(v)) { fail('showCategory ' + v, 'refused'); continue; }
  } catch (e) { fail('showCategory ' + v, e); continue; }
  galleries++;
  const cells = grid.querySelectorAll('.cell').length + grid.children.length;
  cellsSeen += cells;
  const resids = ctx.CUR_RESIDS || [];
  const out = REGISTRY.get('output').textContent;
  if (!out) fail('gallery ' + v, 'no status text');
  if (!cells) console.log(`  note: category ${v} drew no tiles (${out.slice(0, 60)})`);

  // Open every resource this category lists.
  let localFail = 0;
  for (const entry of resids) {
    try {
      if (!ctx.openResource(entry[0])) { localFail++; continue; }
      opened++;
    } catch (e) {
      localFail++;
      if (localFail <= 2) fail(`open 0x${entry[0].toString(16).toUpperCase()} in ${v}`, e);
    }
  }
  if (localFail > 2) fail(`category ${v}`, `${localFail} resources failed to open`);
  // Back to the gallery, which is also what Esc does.
  try { ctx.returnToSheet(); } catch (e) { fail('returnToSheet from ' + v, e); }
  console.log(`  ${String(v).padEnd(11)} ${String(resids.length).padStart(4)} resources  ${String(cells).padStart(4)} tiles  ${localFail ? localFail + ' FAILED' : 'ok'}`);
  took[took.length - 1][1] = Date.now() - tv;
}
console.log(`  ${galleries} galleries, ${cellsSeen} tiles, ${opened} resources opened in ${Date.now() - t0} ms`);
console.log('  slowest: ' + took.sort((a, b) => b[1] - a[1]).slice(0, 8).map(([v, ms]) => v + ' ' + (ms / 1000).toFixed(1) + 's').join(', '));
