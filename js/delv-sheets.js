/* The rules sheets: how a section of one is built, and what the Mechanics
   sheet is divided into.

   WHY THIS FILE EXISTS. index.html had grown to some 24,000 lines with every
   sheet, gallery and card inside it, and the parts that are not tied to the
   document had no reason to be there (the maintainer, 13 September 2026).
   The rule in CLAUDE.md draws its line at the DOM -- bytes-to-bytes goes in
   js/, bytes-to-screen stays in the page -- and that rule is about keeping
   the decoders checkable against delvmod, not about keeping the page one
   file. What is here is the sheet scaffolding and the tables that say how a
   sheet is arranged: no archive reading, and only the shallow bit of DOM a
   section needs to exist.

   THE TIER. js/mac-*.js know nothing of Cythera; js/delv-*.js know the
   formats but not the page. This file knows the page's furniture, so it sits
   last in the load order, after delv-mechanics.js. It is still a classic
   script -- no module, no import -- because these pages have to work from a
   file:// origin, and it may call functions the inline script declares:
   classic scripts share one global scope and nothing here runs at load time.

   WHAT BELONGS HERE. A builder that turns already-read figures into a card,
   and the tables that order them. What does NOT belong here is anything that
   reads the archive: those readers stay in the page beside the sheets that
   call them, until there is a reason to move them too. */

/* A section of a rules sheet, built anywhere.

   These were closures inside renderMechanicsSheet, which meant a section
   could only ever appear on the Mechanics sheet. Five of them belong
   elsewhere -- the balloons with the Barks, the writing with the Writings,
   the spells and the skills with their own tabs, and who answers as whom
   with the Dialogue -- and a real move needs the builder reachable from
   those renderers.

   The id stays `mech-<id>`: mechGo and eleven mechLink call sites resolve a
   section by it, so a move must not rename one. */
function mechSectionEl(id, title, icon, from, lede, rules, html, chips) {
  const sec = foldCard('mech-' + id, '', false);
  const head = document.createElement('summary');
  head.className = 'mechHead';
  const iconURL = icon ? relIconURL(icon) : '';
  head.innerHTML = (iconURL ? '<img class="skillIcon skillIconTile" src="' + iconURL + '" alt="" width="16" height="16">' : '') +
    '<h3>' + svEsc(title) + '</h3>' + (from ? '<span class="mechFrom">' + from + '</span>' : '');
  sec.appendChild(head);
  if (lede) { const p = document.createElement('p'); p.className = 'mechLede'; p.innerHTML = lede; sec.appendChild(p); }
  if (rules && rules.length) { const ul = document.createElement('ul'); ul.className = 'ruleList'; ul.innerHTML = rules.map(r => '<li>' + r + '</li>').join(''); sec.appendChild(ul); }
  if (html) { const d = document.createElement('div'); d.className = 'mechBody'; d.innerHTML = html; sec.appendChild(d); }
  if (chips) { const d = document.createElement('div'); d.className = 'partsStrip'; d.innerHTML = chips; sec.appendChild(d); }
  return sec;
}

// The string builders the sections are written with. Pure, so they are here
// rather than rebuilt on every render; the sheets keep short aliases.
const mechTable = (heads, rows, cls) => rows.length
  ? '<div class="tableScroll"><table class="vocabTable barkTable mechTable' + (cls ? ' ' + cls : '') + '"><thead><tr>' +
    heads.map(h => '<th' + (/^#/.test(h) ? ' class="num"' : '') + '>' + h.replace(/^#/, '') + '</th>').join('') +
    '</tr></thead><tbody>' + rows.join('') + '</tbody></table></div>' : '';
const mechNum = v => '<td class="num">' + (v === null || v === undefined || v === '' ? '' : svEsc(String(v))) + '</td>';
const mechStat = (n, what) => '<span class="mechStat"><b>' + svEsc(String(n)) + '</b> ' + svEsc(what) + '</span>';
const mechSrc = (label, resid) => refExists(resid) ? partChip(label, resid) : '';
const MECH_NO_APP = 'Open the game from its installer, under Settings, and the application’s figures are read here.';

/* What the Mechanics sheet is divided into, in the order it is shown.
   The maintainer's grouping, 13 September 2026. Each entry is a title, a
   line saying what the group is, and the section ids in it; a section not
   named here still appears, under Other.

   Hackery is the group for the parts of the scenario that are machinery
   rather than rules: how a record is laid out, what a use can be aimed at,
   what an egg does, what calls what, and the places the file does not add
   up. */
const MECH_GROUPS = [
  ['Combat', 'What a blow does, who swings it, and what it does to a thing.',
    ['combat', 'combatai', 'damage', 'gear']],
  ['Progress', 'What a character gains, and what it costs to be taught.',
    ['experience', 'karma', 'training', 'todo']],
  ['Status', 'The body and the clock: what feeds, heals, poisons and wears off.',
    ['food', 'hunger', 'potions', 'status', 'clock', 'sleep', 'ground', 'springs']],
  ['Economy', 'What things cost, and what a wager pays.',
    ['shops', 'dice']],
  ['Interactions', 'What a thing does when it is used.',
    ['locks']],
  ['Puzzles', 'The ones the file answers outright.',
    ['puzzles']],
  ['Hackery', 'The machinery under the scenario, and the places it does not add up.',
    ['propword', 'target', 'eggs', 'leans', 'loose']],
];
