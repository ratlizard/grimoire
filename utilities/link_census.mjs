// link_census.mjs -- where the links on the Scenario tab lead.
//
//   node utilities/link_census.mjs index.html "$TMPDIR/Cythera Data.data" [--list]
//   (--list goes last; smoke_boot reads the third argument as a category)
//
// The maintainer's rule of 20 September 2026 is that a figure on a Scenario
// page lands on the component it belongs to -- its record under Components
// > Records, its script under Components > Functions -- and the component
// page steps on down to the bytes under Data (jumpToTableAt's comment in
// js/page-rules.js). On 16 October 2026 he asked for it of every scenario
// figure. This walks the Scenario tab the way a reader would: every page of
// it, every detail page reached from one (a character, a unit, an item, a
// prop type), and every link on each, which it follows and sorts by the top
// tab it lands on. A link that skips Components for Data is the finding,
// and a failure: check_all runs this as "scenario links". So is a component
// page it lands on with no link on down to the bytes.
//
// A link is followed by running its onclick in the page, then reading the
// category the page is showing, which is what the tab strip itself is drawn
// from; the onclick's name alone would not say, since jumpToTableAt goes to
// Components or to Data by whether it has the table. Only handlers that
// navigate are run (an allow-list below), so nothing is edited or saved.
import {ctx, peek, REGISTRY, finish, drainRaf, fail as tallyFail} from './smoke_boot.mjs';

const LIST = process.argv.includes('--list');
const TIMES = process.argv.includes('--times');   // the milliseconds each page took, on stderr, for balancing the parts
const all = el => (el.innerHTML || '') + (el.children || []).map(all).join('');
const grid = () => all(REGISTRY.get('sheetGrid')) + all(REGISTRY.get('textContent') || {children: []});

// The top tab and leaf a category value belongs to, from the page's tree.
const tree = peek('TAB_TREE');
const topOf = new Map();
(function walk(nodes, top, path) {
  for (const n of nodes) {
    const t = top || n.label, p = path ? path + ' › ' + n.label : n.label;
    for (const v of n.values || []) if (!topOf.has(v)) topOf.set(v, {top: t, path: p});
    if (n.children) walk(n.children, t, p);
  }
})(tree, '', '');
const where = () => {
  const v = String(ctx.CUR_SUBN ?? '');
  const sel = REGISTRY.get('categorySelect');
  const val = v || (sel && sel.value) || '';
  return Object.assign({value: val}, topOf.get(val) || {top: '?', path: '?' + val});
};

// Handlers that only navigate. Anything else (an edit, a save, a toggle of
// the page's state) is counted by name and not run.
const NAV = /^(jumpTo\w+|show\w*Detail|showCategory|openPefRoutine|searchFor|mechLink|showCharacterOnMap|jumpToResource|showZone\w*|openZone\w*|answerCharacterChip|showRecordDetail|jumpToForkBytes|openRecord\w*)$/;

const SCEN = (tree.find(n => n.id === 'entities').children || []).flatMap(n => n.values || []);
const seen = new Set();          // onclick strings already followed
const visited = new Set();       // Scenario pages already harvested, by onclick
const tally = new Map();         // "from-page-kind -> top tab (path)" -> count
const examples = new Map();
const unrun = new Map();
const queue = SCEN.map(v => ({go: `showCategory('${v}')`}));
/* The galleries' tiles take their clicks as functions set in code
   (cell.onclick), not as markup, so the character and unit pages are not
   in any page's HTML to be found; they are queued here, each after the
   list it is opened from, as a reader would reach it. */
{
  const chars = peek('loadCharacterTable()');
  for (let i = 0; i < chars.length; i++) if (peek(`characterRecord(${i})`)) queue.push({go: `showCharacterDetail(${i})`, parent: 'CHARACTERS'});
  const units = peek('parseMonsterStats()');
  for (let i = 0; i < units.length; i++) queue.push({go: `showMonsterDetail(${i})`, parent: 'MONSTERS'});
}

/* --part=i/n (after the five positional arguments smoke_boot reads) shares the
   walk between machines. Every part walks the category pages, which are few and
   cheap (11 pages, 4.6 of the 59 seconds). The detail pages found on them, and
   the characters and units that start the walk, are dealt out in turn. A part
   walks the pages dealt to it and every page reachable from them. Every page
   that one walk reaches has a first detail page on the way, and that page is
   dealt to some part, so the parts together reach all the pages. A page
   reached from two parts is walked by both. A part fails on what it finds, so
   a finding in any part fails the check. check_all runs the parts as separate
   checks on separate machines, and --times shows what each page cost. */
const PART = /^--part=(\d+)\/(\d+)$/.exec(process.argv.find(a => a.startsWith('--part=')) || '');
const PART_INDEX = PART ? Number(PART[1]) - 1 : 0, PART_COUNT = PART ? Number(PART[2]) : 1;
let dealt = 0;
const dealOut = () => dealt++ % PART_COUNT;   // the index of the part that has the next detail page
if (PART) for (const entry of queue) if (entry.parent) entry.own = dealOut();

function harvest(label) {
  const html = grid();
  const out = [];
  const re = /onclick="([^"]+)"[^>]*>([^<]{0,60})/g;
  let m;
  while ((m = re.exec(html))) out.push({js: m[1].replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'), text: m[2].trim()});
  return out;
}
const kindOf = label => label.replace(/\(.*$/, '').replace(/ .*$/, '');
function follow(js) {
  const fn = (/^\s*(?:return\s+)?([A-Za-z_$][\w$]*)\s*\(/.exec(js) || [])[1];
  if (!fn || !NAV.test(fn)) { unrun.set(fn || js.slice(0, 30), (unrun.get(fn || js.slice(0, 30)) || 0) + 1); return null; }
  // An onclick is a function body ("jumpToResource(n);return false").
  try { peek('(function () {' + js + '\n})()'); } catch (e) { return {top: 'error', path: String(e.message).slice(0, 60), value: ''}; }
  try { drainRaf(); } catch (e) { /* a frame callback's failure is not this link's */ }
  return where();
}

/* Following a link costs a page render, and the Scenario tab has tens of
   thousands of them, most repeating: every link to a line of one script
   lands where any other line of it does. So a destination is cached by the
   handler and its first argument, and a page's links are all read before
   any is followed, rather than going back to the page after each. */
const destOf = new Map();
/* The second half of the chain: the component page a link lands on steps
   on down to the bytes, a record by jumpToForkBytes and a resource by
   jumpToForkEntry (since 16 October 2026). Read from the panel that page
   draws its links in, since the others keep what the last page left. */
const noStep = new Map();
/* A tile sheet's panel is filled on a timer the first time (showArtUsage
   yields so its note paints), and nothing here waits for a timer; so the
   census it reads is built first, as it is after a reader's first sheet. */
peek('buildTileSheetUsage()');
function stepsDown(dest) {
  const v = dest.value;
  const n = Number(v);
  const panel = v === 'RECORDS' ? 'sheetGrid' : Number.isInteger(n) && peek(`SCRIPT_SUBN.has(${n})`) ? 'scriptRefs' : 'artUsage';
  return /jumpToFork(Entry|Bytes)\(/.test(all(REGISTRY.get(panel) || {children: []}));
}
const queued = new Set(queue.map(q => q.go));
const keyOf = js => (/^\s*(?:return\s+)?([A-Za-z_$][\w$]*\s*\(\s*[^,)]*)/.exec(js) || [, js])[1];
let pages = 0;
while (queue.length && pages < 4000) {
  const {go, parent, own} = queue.shift();
  const startedAt = Date.now();
  if (own !== undefined && own !== PART_INDEX) continue;   // dealt to another part
  if (visited.has(go)) continue;
  visited.add(go);
  // A detail page draws over whatever tab is showing; open its list first,
  // so the page is where a reader would have it.
  if (parent) follow(`showCategory('${parent}')`);
  const at = follow(go);
  if (!parent && (!at || at.top !== 'Scenario')) continue;
  const here = at ? at.value : parent;
  pages++;
  if (pages % 50 === 0) console.error(`  ${pages} pages, ${queue.length} queued, ${destOf.size} destinations`);
  for (const l of harvest(go)) {
    const fn = (/^\s*(?:return\s+)?([A-Za-z_$][\w$]*)/.exec(l.js) || [, '?'])[1];
    if (!NAV.test(fn)) { unrun.set(fn, (unrun.get(fn) || 0) + 1); continue; }
    const isPage = /Detail$|^showCategory$/.test(fn);
    let dest = destOf.get(keyOf(l.js));
    if (!dest) {
      // A detail page is followed when its turn in the queue comes.
      dest = isPage ? {top: 'Scenario', path: 'a page of it', value: ''} : follow(l.js);
      if (dest && dest.top === 'Components') dest.down = stepsDown(dest);
      if (!isPage) destOf.set(keyOf(l.js), dest);
    }
    if (isPage && fn !== 'showCategory' && !visited.has(l.js) && !queued.has(l.js)) {
      queued.add(l.js);
      // A detail page found on a category page is dealt to a part. One found on a detail page stays with the part that is on it.
      queue.push({go: l.js, parent: here, ...(PART && /^showCategory\(/.test(go) ? {own: dealOut()} : {})});
    }
    if (dest.top === 'Components' && !dest.down) { const dk = dest.path + '\t' + keyOf(l.js); if (!noStep.has(dk)) noStep.set(dk, `${go}  "${l.text}"  ${l.js}`); }
    const k = `${kindOf(go)}\t${dest.top}\t${dest.path}\t${fn}`;
    tally.set(k, (tally.get(k) || 0) + 1);
    if (!examples.has(k)) examples.set(k, `${go}  "${l.text}"  ${l.js}`);
  }
  if (TIMES) console.error(`TIME ${String(Date.now() - startedAt).padStart(6)} ms  ${go}${parent ? '  from ' + parent : ''}`);
}

console.log(`pages walked: ${pages}`);
const rows = [...tally].sort((a, b) => a[0].localeCompare(b[0]));
for (const [k, n] of rows) {
  const [from, top, path, fn] = k.split('\t');
  console.log(`${String(n).padStart(6)}  ${from.padEnd(22)} -> ${top.padEnd(11)} ${path.padEnd(44)} ${fn}`);
  if (LIST) console.log('        e.g. ' + examples.get(k).slice(0, 200));
}
/* The finding, as a verdict: a link from a Scenario page that lands on the
   data file's bytes has skipped the component they belong to. The
   program's routines (Data > Cythera (App)) are not counted: a figure the
   application sets has no component in the scenario to land on. */
let skipped = 0, links = 0;
for (const [k, n] of tally) { links += n; if (k.split('\t')[2].startsWith('Data › Cythera Data')) skipped += n; }
const broken = [...tally].filter(([k]) => k.split('\t')[1] === 'error').reduce((a, [, n]) => a + n, 0);
if (skipped) tallyFail('scenario links', `${skipped} link(s) go from a Scenario page straight to the data file's bytes`);
if (noStep.size) tallyFail('scenario links', `${noStep.size} component page(s) reached from Scenario have no step down to Data`);
if (LIST) for (const [k, e] of noStep) console.log('  no step down: ' + k.split('\t')[0] + '  e.g. ' + e.slice(0, 160));
if (broken) tallyFail('scenario links', `${broken} link(s) threw when followed`);
console.log(`scenario links: ${pages} pages, ${links} links followed, ${skipped} straight to the data file's bytes, ${noStep.size} component pages with no step down`);
console.log('not run (not navigation): ' + [...unrun].map(([f, n]) => `${f} ${n}`).join(', '));
finish([]);
