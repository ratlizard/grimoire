/* The executable's sheet, Tools, parts and uses, monsters, the text and conversation views, and editing.

   One of the fourteen js/page-*.js files that were index.html's inline
   script until 16 September 2026, cut at its own section banners and
   nowhere else, so every function is where it was in the one file. This
   tier knows the page's furniture: js/mac-*.js know nothing of Cythera,
   js/delv-*.js know the formats but not the page, and these know both.
   They are classic scripts, never modules, because the page has to work
   from a file:// origin, and they share one global scope, so a name
   declared in any of them is reachable from all. The order only decides
   what has run when a statement runs at load time; the one such statement
   that needed a later file, the brand line, stayed in the page after the
   last of these. File 12 of 14. */

/* ---- Data > Cythera (App) > Data Fork ------------------------------------
   The PowerPC executable, read with js/mac-pef.js: the container's sections,
   the loader's imported libraries and symbols (the host API the game needs,
   498 of its 563 imports from InterfaceLib), its two exports, and every
   routine the code section names for itself in its traceback tables --
   1,992 in 1.0.4, grouped by class. The sheets that cite a routine
   ("read from the executable") carry a chip here (pefChip), which opens
   this sheet filtered to the name. Addresses are offsets into the code
   section, the convention the workbench's traces use, except that a trace
   written down as 0x0437BC names the word after the entry: the entry
   TMapWindow::KeyRoutine is 0x0437B8, four bytes earlier, which is where a
   `bl` lands. */
window.PEF_FILTER = '';
function appPef() {
  if (window.APP_PEF) return window.APP_PEF;
  if (!window.APP_DATA) return null;
  let pef = null;
  try { pef = parsePEF(window.APP_DATA); } catch (e) { pef = null; }
  if (!pef) return null;
  try { pef.routines = pefTracebacks(pef, window.APP_DATA); } catch (e) { pef.routines = []; }
  return (window.APP_PEF = pef);
}
function pefFilter(v) { window.PEF_FILTER = String(v || ''); window.PEF_VIEW = null; renderAppPefSheet(); }
// A routine cited by name opens on its own listing; a name the program
// does not have filters the list to it, which says so.
function openPefRoutine(name) {
  const r = exeRoutineNamed(name);
  if (r) return jumpToExeAt(r.offset);
  window.PEF_FILTER = name; window.PEF_VIEW = null;
  showCategory('APPPEF');
}
// A chip to a routine of the executable, wherever a sheet cites one.
function pefChip(name) {
  const leaf = TAB_BY_ID.get('apppef');
  return relChip({ js: 'openPefRoutine(\'' + name.replace(/'/g, '\\\'') + '\')', main: name, sub: 'routine', icon: leaf ? relIconURL({ tile: leaf.tile }) : '', title: 'Data › Cythera (App) › Data Fork' });
}

/* ---- a number read off the program, and where ------------------------------
   The executable's figures -- the clock's hour, how often a fed character
   heals, how long a balloon stays up, the costs of the commands -- are read
   out of its PowerPC code on the spot, the way the Mechanics sheet reads the
   archive's scripts, and each is printed as a link to the instruction that
   holds it (srcNum with an `exe` address, jumpToExeAt). Until 11 September
   2026 they were typed in from traces made outside the site
   (cythera-workbench's doc/game-clock.md and doc/talk-balloons.md), which is
   a copy of the program nobody could follow back and an edited program would
   contradict in silence.

   The instructions are js/mac-ppc.js's, the sections and relocations
   js/mac-pef.js's (pefLoad). A routine is found by the name its traceback
   table gives, its instructions decoded once (exeOpsOf), and a call
   resolved to what it reaches: another routine, or through a glue stub --
   `lwz 12, d(2)`, `stw 2, 20(1)`, `lwz 0, 0(12)`, `lwz 2, 4(12)`, `mtctr 0`,
   `bctr` -- to the import whose transition vector the TOC slot holds. An
   address is an offset into the code section, as everywhere on the site.
   Without the application open none of this answers, and the sentences
   that need it say what to open instead of stating a number. */
function appImage() {
  const pef = appPef();
  if (!pef) return null;
  if (pef.image === undefined) {
    try { pef.image = pefLoad(window.APP_DATA); } catch (e) { pef.image = null; }
    if (pef.image) {
      pef.image.codeIndex = pef.image.pef.sections.findIndex(x => x.kind === 0);
      pef.image.code = pef.image.contents[pef.image.codeIndex] ? pef.image.contents[pef.image.codeIndex].bytes : null;
    }
  }
  return pef.image && pef.image.code ? pef.image : null;
}
function exeWord(at) { const img = appImage(); return img && at >= 0 && at + 4 <= img.code.length ? pefU32(img.code, at) : null; }
// The routine an address is inside, by the traceback tables.
function exeRoutineAt(at) {
  const pef = appPef(); if (!pef || !pef.routines) return null;
  const rs = pef.routines; let lo = 0, hi = rs.length - 1, best = null;
  while (lo <= hi) { const m = (lo + hi) >> 1; if (rs[m].offset <= at) { best = rs[m]; lo = m + 1; } else hi = m - 1; }
  return best && at < best.offset + best.length ? best : null;
}
// A routine by its name, with or without its argument list.
function exeRoutineNamed(name) {
  const pef = appPef(); if (!pef || !pef.routines) return null;
  return pef.routines.find(r => r.name === name) || pef.routines.find(r => r.name.startsWith(name + '(')) || pef.routines.find(r => r.mangled === name) || null;
}
// A routine's instructions: address, word, the decode, and where a branch goes.
function exeOpsOf(r) {
  if (!r) return [];
  if (r.ops) return r.ops;
  const img = appImage(); if (!img) return [];
  const ops = [];
  for (let at = r.offset; at < r.offset + r.length && at + 4 <= img.code.length; at += 4) {
    const w = pefU32(img.code, at), d = ppcDecode(w);
    ops.push({ at, word: w, d, mn: d ? d.mn : '', text: d ? d.text : '.long 0x' + w.toString(16).toUpperCase(),
               to: d && d.branch && !d.indirect && !d.aa ? at + d.disp : null });
  }
  return (r.ops = ops);
}
// The import a glue stub at `at` calls, or null.
function exeGlueImport(at) {
  const img = appImage(); if (!img || !img.toc) return null;
  const d = [0, 1, 2, 3, 4, 5].map(k => { const w = exeWord(at + 4 * k); return w === null ? null : ppcDecode(w); });
  if (!d[0] || d[0].mn !== 'lwz' || d[0].rt !== 12 || d[0].ra !== 2 || !d[5] || d[5].mn !== 'bctr') return null;
  const p = pefPointerAt(img, img.toc.section, img.toc.offset + d[0].d);
  return p && p.name ? p.name : null;
}
// What a branch reaches, by name: a routine (with its offset inside it) or an import.
function exeTargetName(to) {
  if (to === null || to === undefined) return '';
  const r = exeRoutineAt(to);
  if (r) return r.name + (to !== r.offset ? '+0x' + (to - r.offset).toString(16).toUpperCase() : '');
  const g = exeGlueImport(to);
  return g ? g : '0x' + to.toString(16).toUpperCase();
}
// Does op call `name` -- a routine's name without its arguments, or an import?
function exeCalls(op, name) {
  if (!op || op.mn !== 'bl' || op.to === null) return false;
  const r = exeRoutineAt(op.to);
  if (r) return r.offset === op.to && (r.name === name || r.name.startsWith(name + '('));
  return exeGlueImport(op.to) === name;
}
// Every call of a routine anywhere in the code, by one scan kept with the program.
function exeCallersOf(name) {
  const img = appImage(), pef = appPef(); if (!img) return [];
  const target = exeRoutineNamed(name); if (!target) return [];
  if (!pef.callIndex) {
    pef.callIndex = new Map();
    for (let at = 0; at + 4 <= img.code.length; at += 4) {
      const w = pefU32(img.code, at);
      if ((w >>> 26) !== 18 || (w & 3) !== 1) continue;            // bl
      let li = w & 0x03FFFFFC; if (li & 0x02000000) li -= 0x04000000;
      const to = at + li;
      (pef.callIndex.get(to) || pef.callIndex.set(to, []).get(to)).push(at);
    }
  }
  return (pef.callIndex.get(target.offset) || []).map(at => { const r = exeRoutineAt(at); const ops = exeOpsOf(r); return { routine: r, ops, i: ops.findIndex(o => o.at === at) }; }).filter(c => c.routine && c.i >= 0);
}
// A number an instruction holds, with where: { v, exe }.
function exeVal(op, v) { return op ? { v, exe: op.at } : null; }
// A word of the TOC's section at a displacement from the TOC.
function exeTocOffset(d) { const img = appImage(); return img && img.toc ? img.toc.offset + d : null; }
function exeDataWords(off, n) {
  const img = appImage(); if (!img || !img.toc) return null;
  const sec = img.contents[img.toc.section]; if (!sec || off < 0 || off + 4 * n > sec.bytes.length) return null;
  const out = []; for (let k = 0; k < n; k++) out.push(pefI32(sec.bytes, off + 4 * k));
  return out;
}
// A C string a pointer reaches, when it is one.
function exeStringAt(p) {
  const img = appImage(); if (!img || !p || p.section === undefined) return null;
  const sec = img.contents[p.section]; if (!sec) return null;
  let e = p.offset, s = '';
  while (e < sec.bytes.length && sec.bytes[e] && s.length < 200) { const ch = sec.bytes[e++]; if (ch < 0x20 && ch !== 0x0A && ch !== 0x0D) return null; s += String.fromCharCode(ch); }
  return s.length >= 2 ? decodeMacRoman(sec.bytes.subarray(p.offset, e)) : null;
}
// The ops of a routine by name, for the readers below.
function exeOpsNamed(name) { return exeOpsOf(exeRoutineNamed(name)); }
// The first op at or after `from` satisfying `test`, within `span` ops.
function exeFind(ops, from, span, test) {
  for (let i = Math.max(0, from); i < Math.min(ops.length, from + span); i++) if (ops[i].d && test(ops[i].d, ops[i])) return i;
  return -1;
}
function exeFindBack(ops, from, span, test) {
  for (let i = Math.min(ops.length - 1, from); i >= Math.max(0, from - span); i--) if (ops[i].d && test(ops[i].d, ops[i])) return i;
  return -1;
}

/* Open the application's code at an address: the routine that holds it,
   listed, with that instruction ringed. */
window.PEF_VIEW = null;
function jumpToExeAt(at) {
  if (window.CUR_SUBN === 'MECHANICS' || MECH_GROUP_BY_VALUE[window.CUR_SUBN]) mechKeepPlace();
  window.PEF_VIEW = { at };
  if (window.CUR_SUBN === 'APPPEF') renderAppPefSheet();
  else openVia('APPPEF', () => {});
  setTimeout(() => {
    const hit = document.getElementById('listingHit');
    if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center' });
  }, 40);
  return true;
}
function pefBackToList() { window.PEF_VIEW = null; renderAppPefSheet(); }
// One routine, instruction by instruction: calls and branches named and
// followable, TOC slots said as what they hold.
function exeListingHTML(r, ringAt) {
  const img = appImage();
  const hex = (n, w) => '0x' + (n >>> 0).toString(16).toUpperCase().padStart(w || 6, '0');
  const lines = exeOpsOf(r).map(o => {
    let t = svEsc(o.text);
    const d = o.d;
    if (o.to !== null) {
      const nm = exeTargetName(o.to);
      const inside = o.to >= r.offset && o.to < r.offset + r.length;
      t += '   ' + (exeRoutineAt(o.to) ? svLink(inside ? '+0x' + (o.to - r.offset).toString(16).toUpperCase() : nm, 'jumpToExeAt(' + o.to + ')') : '<span class="refnote">' + svEsc(nm) + '</span>');
    }
    if (d && d.ra === 2 && img.toc) {
      if (d.d !== undefined) {
        const p = pefPointerAt(img, img.toc.section, img.toc.offset + d.d);
        const str = p && p.section !== undefined ? exeStringAt(p) : null;
        t += '   <span class="refnote">; TOC ' + (d.d >= 0 ? '+' : '') + d.d + (p ? (p.name ? ', ' + svEsc(p.name) : str ? ', “' + svEsc(str.replace(/\n/g, ' ')) + '”' : ', ' + (img.pef.sections[p.section] ? img.pef.sections[p.section].kindName : 'section ' + p.section) + ' ' + hex(p.offset)) : '') + '</span>';
      } else if (d.mn === 'addi') t += '   <span class="refnote">; data ' + hex(img.toc.offset + d.imm) + '</span>';
    }
    const line = hex(o.at) + '  ' + o.word.toString(16).toUpperCase().padStart(8, '0') + '  ' + t;
    return o.at === ringAt ? '<span id="listingHit" class="listingHit">' + line + '</span>' : line;
  });
  return '<pre class="pane exeListing" style="max-height:none">' + lines.join('\n') + '</pre>';
}
function renderAppPefSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const pef = appPef();
  if (!pef) { renderPlaceholderSheet(PLACEHOLDER_TABS.APPPEF + (window.APP_DATA ? ' This data fork is not a PEF container.' : NO_INSTALLER_HINT)); return; }
  const view = window.PEF_VIEW && exeRoutineAt(window.PEF_VIEW.at);
  if (view && appImage()) {
    const box = document.createElement('div');
    box.className = 'mechView';
    const hexv = n => '0x' + (n >>> 0).toString(16).toUpperCase();
    box.innerHTML = '<div class="foldAll" style="justify-content:flex-start">' + svLink('All routines', 'pefBackToList()') + '</div>' +
      '<div class="changesHead">' + svEsc(view.name) + '</div>' +
      '<p class="mechLede">At ' + hexv(view.offset) + ' in the code section, ' + view.length.toLocaleString() + ' bytes, ' + (view.length / 4) + ' instructions' +
      (view.mangled !== view.name ? ' <span class="inspDim">(' + svEsc(view.mangled) + ')</span>' : '') + '. A branch or a call is a link to where it goes; a TOC slot says what the loader puts there.</p>' +
      exeListingHTML(view, window.PEF_VIEW.at);
    grid.appendChild(box);
    out.textContent = view.name + ', ' + (view.length / 4) + ' instructions';
    return;
  }
  const hex = n => '0x' + (n >>> 0).toString(16).toUpperCase();
  const num = v => '<td class="num">' + svEsc(String(v)) + '</td>';
  const box = document.createElement('div');
  box.className = 'mechView';
  const ld = pef.loader;
  const code = pef.sections.find(x => x.kind === 0);
  let h = '<div class="changesHead">The application’s data fork: a PEF container, ' + svEsc(pef.arch === 'pwpc' ? 'PowerPC' : pef.arch) + '</div>';
  h += '<p class="mechLede">' + pef.sections.length + ' sections' + (ld ? ', entry in section ' + ld.mainSection + ' at ' + hex(ld.mainOffset) + ', ' + ld.libraries.length + ' libraries imported for ' + ld.symbols.length + ' symbols, ' + ld.exports.length + ' exported' : '') +
    (pef.routines.length ? ', and ' + pef.routines.length.toLocaleString() + ' routines named in the code section’s traceback tables.' : '.') + '</p>';
  h += '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><thead><tr><th>no.</th><th>section</th><th class="num">unpacked</th><th class="num">packed</th><th class="num">at</th></tr></thead><tbody>' +
    pef.sections.map(x => '<tr>' + num(x.index) + '<td>' + svEsc(x.kindName) + (x.name ? ' ' + svEsc(x.name) : '') + '</td>' + num(x.unpackedSize.toLocaleString()) + num(x.packedSize.toLocaleString()) + num(hex(x.containerOffset)) + '</tr>').join('') + '</tbody></table></div>';
  if (ld) {
    h += '<div class="mechSub">Imported libraries</div>';
    h += ld.libraries.map(L => '<details class="mechSec"><summary class="mechHead"><h3>' + svEsc(L.name) + '</h3><span class="mechStats" style="margin:0"><span class="mechStat"><b>' + L.importedSymbolCount + '</b> symbol' + (L.importedSymbolCount === 1 ? '' : 's') + '</span>' + (L.weak ? '<span class="mechStat">weak</span>' : '') + '</span></summary>' +
      '<div class="mechBody"><div class="partsStrip">' + L.symbols.map(y => '<span class="navChip" style="cursor:default">' + svEsc(y.name) + '</span>').join('') + '</div></div></details>').join('');
    if (ld.exports.length) h += '<div class="mechSub">Exports</div><div class="partsStrip">' + ld.exports.map(e => '<span class="navChip" style="cursor:default" title="' + svEsc(e.className) + ', section ' + e.sectionIndex + ' at ' + hex(e.value) + '">' + svEsc(e.name) + '</span>').join('') + '</div>';
  }
  const q = (window.PEF_FILTER || '').trim().toLowerCase();
  h += '<div class="mechSub">Routines</div>' +
    '<input type="search" id="pefFilterBox" value="' + svEsc(window.PEF_FILTER || '') + '" placeholder="a routine or a class" oninput="pefFilter(this.value)" style="width:100%;box-sizing:border-box;margin:4px 0 8px">';
  const rs = pef.routines.filter(r => !q || r.name.toLowerCase().includes(q) || r.mangled.toLowerCase().includes(q));
  const byClass = new Map();
  for (const r of rs) { const c = r.name.includes('::') ? r.name.slice(0, r.name.lastIndexOf('::', r.name.indexOf('(') < 0 ? undefined : r.name.indexOf('('))) : ''; (byClass.get(c) || byClass.set(c, []).get(c)).push(r); }
  const row = r => '<tr>' + num(hex(r.offset)) + num(r.length.toLocaleString()) + '<td title="' + svEsc(r.mangled) + '">' + svLink(r.name, 'jumpToExeAt(' + r.offset + ')') + '</td></tr>';
  const table = list => '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><thead><tr><th class="num">at</th><th class="num">bytes</th><th>routine</th></tr></thead><tbody>' + list.map(row).join('') + '</tbody></table></div>';
  if (q) h += rs.length ? table(rs) : '<div class="changesNote">No routine matches.</div>';
  else h += [...byClass.entries()].sort((a, b) => (a[0] || '~').localeCompare(b[0] || '~')).map(([c, list]) =>
    '<details class="mechSec"><summary class="mechHead"><h3>' + svEsc(c || 'functions outside a class') + '</h3><span class="mechStats" style="margin:0"><span class="mechStat"><b>' + list.length + '</b></span></span></summary><div class="mechBody">' + table(list) + '</div></details>').join('');
  h += '<p class="mechLede" style="margin-top:10px">An address is an offset into the code section, where a call lands. The routines are read from the traceback table the compiler leaves after each one: its length and its name, mangled; the name is read back as far as the mangling allows and left as written where it does not.</p>';
  box.innerHTML = h;
  grid.appendChild(box);
  out.textContent = pef.routines.length.toLocaleString() + ' routines named in the executable' + (q ? ', ' + rs.length + ' matching “' + window.PEF_FILTER.trim() + '”' : ', by class') + '; ' + (ld ? ld.symbols.length + ' imports from ' + ld.libraries.length + ' libraries.' : '');
}

/* ---- Tools -------------------------------------------------------------------
   The page's own switches and its sister pages, which are not part of the
   archive and so have no place under the other three tabs. The undither
   switch moved here from every gallery that had one: it is one setting for
   every image, and the galleries keep only a preview the other way. */
function renderToolsSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const box = document.createElement('div');
  box.className = 'changesView';
  const sec = (title, note) => {
    const d = document.createElement('div');
    d.className = 'changesGroup';
    d.innerHTML = '<div class="changesGroupTitle">' + svEsc(title) + '</div>' +
      (note ? '<div class="changesNote" style="margin-left:0">' + svEsc(note) + '</div>' : '');
    box.appendChild(d);
    return d;
  };
  const d = sec('Ditherizer', 'Any image in, Cythera-palette checkerboard art out, the undither run ' +
    'backwards. It lives on the Portraits gallery because that is where a result can be written ' +
    'straight into a portrait resource.');
  const db = document.createElement('button');
  db.className = 'secondary';
  db.textContent = 'Open the ditherizer';
  db.onclick = () => { showCategory('135'); openDitherTool(); };
  d.appendChild(db);
  /* The preferences file, which is the only thing on this page that changes
     how the GAME behaves rather than how this page reads it. Two bits: the
     smooth movement Cythera has always had and gates on a preference, and the
     gate on the cheat keys, which nothing in the game ever sets. The long
     comment above buildCytheraPreferences says where each came from and, just
     as plainly, that this file has never been put in front of the game. */
  const layout = cytheraPrefsLayout();
  const pf = sec('Cythera’s preferences file', '');
  const pfNote = document.createElement('div');
  pfNote.className = 'changesNote';
  pfNote.style.cssText = 'margin-left:0';
  pf.appendChild(pfNote);
  if (!layout) {
    pfNote.innerHTML = svEsc('The file in the System Folder’s Preferences folder that holds the game’s settings and the gate on its cheat keys. ' +
      'Its record is read out of the application; open the game from its installer, under Settings, and the switches are offered here.');
  } else {
    pfNote.innerHTML = svEsc('The ' + layout.bytes + '-byte ‘' + layout.type + '’ “' + layout.key + '” record, which lives in the System Folder’s Preferences folder. ' +
      'The switches are the game’s own: the labels of its Preferences dialog' + (layout.smoothLabel ? ', and “' + layout.smoothLabel + '” from its unlisted Preferences menu, which the record the game first stores leaves off' : '') + '. ' +
      'The last is the gate on the cheat keys, which nothing in the game ever sets, so a shipped copy cannot enter cheat mode however long you type ' + layout.gate.word + ' at it. ' +
      'The Cheats sheet has the record field by field.');
    const prefsRow = document.createElement('div');
    prefsRow.style.cssText = 'display:flex;gap:10px 18px;flex-wrap:wrap;align-items:center;margin:8px 0 6px';
    const prefBox = (id, label, on) => '<label style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '> ' + svEsc(label) + '</label>';
    const idOf = opt => 'pref' + opt[0].toUpperCase() + opt.slice(1);
    prefsRow.innerHTML =
      (layout.smoothLabel ? prefBox('prefSmooth', layout.smoothLabel, true) : '') +
      layout.controls.map(c => prefBox(idOf(c.opt), c.label, !!((layout.base >>> (24 - 8 * c.byte)) & (1 << c.bit)))).join('') +
      prefBox('prefCheats', 'Allow the cheat keys', true);
    pf.appendChild(prefsRow);
    const pbtns = document.createElement('div');
    pbtns.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
    for (const [label, kind, title] of [
      ['Disk image, for an emulator', 'dsk', 'Mounts as “' + PREFS_VOLUME_NAME + '” with an ' + PREFS_SCRIPT_NAME + ' script beside the file'],
      ['MacBinary, for a real Mac', 'bin', 'Unwrap it and drag the file into System Folder ▸ Preferences']]) {
      const btn = document.createElement('button');
      btn.className = 'secondary';
      btn.style.cssText = 'width:auto;margin:0';
      btn.textContent = label;
      btn.title = title;
      btn.onclick = () => downloadCytheraPrefs(kind);
      pbtns.appendChild(btn);
    }
    pf.appendChild(pbtns);
    const pnote = document.createElement('div');
    pnote.className = 'changesNote';
    pnote.style.cssText = 'margin-left:0;margin-top:8px';
    pnote.innerHTML = 'Tested in the game: a file this page wrote was read, and cheat mode activated. ' +
      'It replaces any settings already stored.';
    pf.appendChild(pnote);
  }

  const pages = sec('The other pages', '');
  for (const [href, label, note] of [
    ['canvas.html', 'Colour-cycling canvas', 'a paint studio for the palette animation Cythera uses for water and fire'],
    ['https://github.com/ratlizard/grimoire', 'The repository', 'where this page and its checks live']]) {
    const b = document.createElement('button');
    b.className = 'secondary';
    b.style.cssText = 'width:auto;margin:6px 6px 0 0';
    b.textContent = label;
    b.title = note;
    b.onclick = () => window.open(href, '_blank', 'noopener');
    pages.appendChild(b);
  }
  // Which face the page is actually drawing in: the open file's own sfnt,
  // Chicago, or this device's. A person can tell in a glance here what no
  // harness can, which is whether the font on the screen is the one out of
  // the file. Chosen under Settings; this only reports.
  const font = sec('The face this page is set in', '');
  const fn = document.createElement('div');
  fn.className = 'amNote';
  fn.textContent = window.FACE_IN_USE === 'game' && window.GAME_FONT
    ? 'Argos A Nouveau, out of the open file: ' + window.GAME_FONT + ' in Cythera Data’s resource fork, made into a TrueType the browser accepts.'
    : window.FACE_IN_USE === 'system'
      ? 'This device’s own face, chosen under Settings.'
      : 'Chicago, Susan Kare’s 1984 face for the Macintosh, reproduced by Duane King and shipped with this page. ' +
        (window.GAME_FONT ? 'The game’s own is loaded and can be chosen under Settings.'
          : window.GAME_FONT_STATE === 'loading' ? 'The file’s own is still loading.'
          : window.GAME_FONT_STATE ? 'The file’s own could not be used: ' + window.GAME_FONT_STATE + '.'
          : 'No file is open to read the game’s own out of.');
  font.appendChild(fn);
  grid.appendChild(box);
  /* What fell back without saying so. Every optional decode that failed
     since the page loaded, kept by quiet() in js/mac-bytes.js, so a
     missing picture or an empty sheet has a reason a visitor can find. At
     the foot of the sheet and folded, one grey line (the maintainer, 19
     September 2026: it was the second thing on the page); the count is in
     the line, so a fault still shows without the list being open. */
  {
    const q = document.createElement('details');
    q.className = 'quietLog';
    const n = QUIET_FAILURES.size;
    const line = n ? n + (n === 1 ? ' thing' : ' things') + ' fell back quietly since the page loaded' : 'Nothing has fallen back quietly since the page loaded';
    q.innerHTML = '<summary>' + line + '</summary>';
    if (n) {
      const ul = document.createElement('div');
      ul.style.cssText = 'font-family:ui-monospace,Menlo,monospace;font-size:0.75rem;line-height:1.6;color:#b5b2a8;white-space:pre-wrap;margin-top:6px';
      // The file and line, not the origin it was served from.
      ul.textContent = [...QUIET_FAILURES].map(([m, v]) => (v.count > 1 ? v.count + '\u00d7 ' : '') + m + (v.where ? '\n    ' + v.where.replace(/https?:\/\/[^/\s]+\//g, '') : '')).join('\n');
      q.appendChild(ul);
    } else q.innerHTML += '<div class="changesNote" style="margin:6px 0 0">Every optional decode the page attempted has succeeded. What could not be read or drawn would be listed here, one line each with how many times.</div>';
    box.appendChild(q);
  }
  out.textContent = 'Settings and links; nothing here is read from the archive except the font.';
}

/* ---- A tile on a sheet opens on its own ---------------------------------------
   The sheet is drawn at whatever shape the gallery tools chose, so the click
   is mapped back through that shape to a tile index, and the tile opens in
   the sprite zoom: the picture at sixteen times, what it was cut from, and
   every class that is drawn by it -- the class whose base it is, and each
   one that reaches it at an aspect -- each a chip to that class's page.

   A tap used to leave the sheet. Until 16 September 2026 it went to the prop
   type whose block held the tile, so the hatchet, the tile after the spear,
   opened the spear's page, which does not show it. That was narrowed to a
   prop type's own frames, which left the same gesture doing two different
   things -- a named frame navigated, anything else opened the zoom. Since
   20 September 2026 it always opens the zoom (the maintainer), and the
   chips there are the way on. */
/* An image of one resource opens that resource when tapped: the portrait
   on a character's page, a frame on a prop's, the sprite an item leaves
   behind. The maintainer's ask of 18 September 2026: every isolated image
   links to the graphical resource it was drawn from. A tile's resource is
   its sheet, sixteen tiles a sheet. */
function sheetOfTile(tileId) { return 0x8E00 + (tileId >> 4); }
function imageOpens(el, resid, what) {
  el.style.cursor = 'pointer';
  el.title = (what ? what + ' ' : '') + '0x' + resid.toString(16).toUpperCase() + ', tap to open';
  el.onclick = e => { e.stopPropagation(); jumpToResource(resid); };
  return el;
}
function tileSheetClick(ev, resid) {
  const canvas = ev.currentTarget;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const px = (ev.clientX - rect.left) / rect.width * canvas.width;
  const py = (ev.clientY - rect.top) / rect.height * canvas.height;
  const shape = window.SHEET_SHAPE || 'grid';
  let idx;
  if (shape === 'column') idx = Math.floor(py / 32);
  else if (shape === 'row') idx = Math.floor(px / 32);
  else if (shape === 'tiles') idx = Math.floor(py / 35) * 4 + Math.floor(px / 35);   // 32px tiles, 3px gutters
  else idx = Math.floor(py / 32) * 4 + Math.floor(px / 32);
  if (!(idx >= 0 && idx < 16)) return;
  const tileId = ((resid - 0x8E00) << 4) | idx;
  // The tile on its own, and nowhere else. A tap used to leave the sheet
  // for the prop type that wears the tile, where a tile whose prop could
  // not be named stayed and opened the zoom -- so the same gesture did two
  // different things depending on the tile. The zoom names the prop type
  // and links to it (tileFactsHTML), which is the route out for anyone who
  // wants it (the maintainer, 20 September 2026).
  showSpriteZoom(tileId, terrainNameFor(tileId) || '');
}

/* ---- What a window shows -----------------------------------------------------
   A container, a sign, a book or an instrument opens a window its class script
   builds with `gui Create`. With six operands that is the prop, the picture,
   and four numbers placing it; with two it is a plain window of a size (the
   shops, the bed, the inkwell), which shows no picture. The picture n is
   resource 0x8F00 + n: TPixCacheFromCachedSegFiles::GetData adds 0x8F00 to
   the number it is given, and nothing else in the application builds that id.

   Most classes go through a helper that takes the picture as an argument
   (0xE64, 0xE65, 0xE66 and 0xE67 in the shipped file), so a helper is read for
   which argument it passes, and the number is taken at each call. A poster and
   a sheet of paper pass their own Data2, so the picture is whatever each
   placed one carries.

   This replaced a table that matched prop names to pictures. The scripts
   disagree with it twice: the bookshelf shows its text on the scroll (0x8F03)
   rather than the open book, and the lute class opens 0x8F12, the pipes, the
   same picture as the panpipes. Nothing opens 0x8F15, the lute. That is the
   scenario as shipped, and it is shown as the script has it. */
DERIVED.SCRIPTED_WINDOWS = null;
function buildScriptedWindows() {
  if (DERIVED.SCRIPTED_WINDOWS) return DERIVED.SCRIPTED_WINDOWS;
  const byScript = new Map(), byPicture = new Map();
  const add = (resid, n) => {
    const pic = 0x8F00 + n;
    if (!(n >= 0) || !refExists(pic)) return;
    if (!byScript.has(resid)) byScript.set(resid, new Set());
    byScript.get(resid).add(pic);
    if (!byPicture.has(pic)) byPicture.set(pic, new Set());
    byPicture.get(pic).add(resid);
  };
  let index = [];
  try { index = buildScriptTextIndex(); } catch (e) { index = []; }
  const helpers = new Map(), fromData2 = new Set();
  for (const e of index) {
    const ops = dvmOpsOf(e);
    ops.forEach((o, i) => {
      if (!/^gui Create\b/.test(o.text)) return;
      const v = dvmCallValues(ops, i);
      if (v.length !== 6) return;
      const n = dvmValueNum(v[1]), a = dvmValueArg(v[1]);
      if (n !== null) add(e.resid, n);
      else if (a !== null) helpers.set(e.resid, a);
      else if (v[1].length === 2 && dvmValueArg([v[1][0]]) === 0 && /^get_field data2\b/.test(v[1][1].text)) fromData2.add(e.resid);
    });
  }
  if (helpers.size) for (const e of index) {
    const ops = dvmOpsOf(e);
    ops.forEach((o, i) => {
      const m = /^call_resource 0x([0-9A-F]+)\b/.exec(o.text);
      if (!m || !helpers.has(parseInt(m[1], 16))) return;
      const n = dvmValueNum(dvmCallValues(ops, i)[helpers.get(parseInt(m[1], 16))]);
      if (n !== null) add(e.resid, n);
    });
  }
  if (fromData2.size) for (let z = 0; z < 0x100; z++) {
    if (!refExists(0x8100 + z)) continue;
    let list;
    try { list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data); } catch (e) { continue; }
    // Each class tests the prop before it builds this window -- the poster
    // wants a Data1 of 0 and a Data2, the paper a Data1 of 255 -- and opens
    // the helper's picture otherwise. Every placed one in the shipped file
    // that carries a Data2 passes its class's test, so a Data2 is the test
    // this reads.
    for (const r of list) if (r.flags !== 0xFF && r.d2 && fromData2.has(0x1000 + r.proptype)) add(0x1000 + r.proptype, r.d2);
  }
  return (DERIVED.SCRIPTED_WINDOWS = { byScript, byPicture });
}
function containerWindowsFor(pt) {
  let w = null;
  try { w = buildScriptedWindows().byScript.get(0x1000 + pt); } catch (e) { w = null; }
  return w ? [...w].sort((a, b) => a - b) : [];
}

/* ---- Parts and uses --------------------------------------------------------
   The joins between the two halves of the tree. An entity page carries a
   "Made of" row: the components it is assembled from, each chip a jump to
   that resource under Components. A component's page carries the reverse --
   "Worn by", "Spoken by", "Played by", "Referenced by" -- so that from a
   portrait you reach the person and from a sound you reach the scripts that
   play it. Nothing here is guessed from names: each join is a resource-id
   rule the archive itself follows (character i's dialogue is 0x1800+i, its
   portrait 0x8800+i-1, zone n's entry script 0x1400+n), or a call read out
   of disassembled code. Where a join does not hold -- a sound no script
   names -- the row says so rather than staying silent. */
function trailForResid(resid) {
  const leaf = TAB_LEAF_FOR.get(String((resid >> 8) - 1));
  return leaf ? tabTrail(leaf) : '';
}

// A part of a thing: the relation first ("Portrait"), then what the part is
// called, then its id.
function partChip(label, resid) {
  const lbl = labelFor(resid);
  return relChip({ resid, main: label, sub: lbl || '', title: trailForResid(resid) });
}

// A link in text: see .svLink.
function svLink(label, js, note) {
  return '<button class="svLink" onclick="' + js + '">' + svEsc(label) + (note ? ' <i>' + svEsc(note) + '</i>' : '') + '</button>';
}

function actionChip(label, js, note) {
  return '<button class="sv-chip" onclick="' + js + '">' + svEsc(label) +
    (note ? ' <i>' + svEsc(note) + '</i>' : '') + '</button>';
}

function partsStrip(title, chips, note) {
  if (!chips.length && !note) return '';
  return '<div class="partsStrip"><span class="partsTitle">' + svEsc(title) + '</span>' +
    chips.join('') + (note ? '<span class="partsNote">' + svEsc(note) + '</span>' : '') + '</div>';
}

// A dossier opened from a component's page lands under Entities > Characters,
// tabs and deep link included, rather than inside whatever gallery was open.
/* Open a detail view that lives under another category, as one step: the
   category switch is made with the history silent (syncDeepLink), the view
   is opened, and then the hash is written once. Every "Open X in Y" link
   from the World tab comes through here, which is also what makes them work
   from there at all: the atlas panel hides the sheet, and a detail drawn
   into the hidden sheet without the switch was the "Open cloth in Items does
   nothing" of 10 September 2026. */
window.NAV_SUPPRESS = false;
function openVia(cat, fn) {
  window.NAV_SUPPRESS = true;
  try { showCategory(cat); } finally { window.NAV_SUPPRESS = false; }
  fn();
  syncDeepLink();
}
function openCharacter(i) { openVia('CHARACTERS', () => showCharacterDetail(i)); }

/* One character's day, on the Schedules sheet under Components.

   A dossier used to chip its schedule straight at 0xF00B, the raw table
   under Data, which is the jump the maintainer asked to stop: a component
   should be reached through the Components tab that shows it, and the table
   underneath from there. Schedules became such a tab on 13 September 2026.

   The card's own id is what renderSchedulesSheet gives it. The open is
   deferred a tick because the sheet is built by the category switch and the
   card does not exist until it has run, the same reason mechLink waits. */
function openSchedule(i) {
  openVia('SCHEDULES', () => {
    setTimeout(() => {
      const el = document.getElementById('sched-' + i);
      if (!el) return;
      el.open = true;
      if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  });
}

// A person, wearing their portrait -- the face names the person where the
// sprite only names a class (the maintainer, 8 September 2026: a portrait is
// the better way to identify a character wherever one is cited). The sprite
// stands in where there is no portrait, the tab's tile where there is neither.
// `terse` names the record and not the person, for a row whose title is
// already the person's name (the schedules list).
function characterChip(i, terse) {
  let icon = '', face = false;
  try { const f = characterFace(i); if (f && f.url) { icon = f.url; face = true; } } catch (e) { icon = ''; }
  if (!icon) try {
    const c = loadCharacterTable()[i];
    const base = c ? getPropTileList()[c.proptype] : undefined;
    if (base !== undefined) icon = relIconURL({ tile: base + (c.aspect || 0) });
  } catch (e) { icon = ''; }
  if (!icon) { const leaf = TAB_BY_ID.get('characters'); icon = leaf ? relIconURL({ tile: leaf.tile }) : ''; }
  return relChip({ js: 'openCharacter(' + i + ')', main: terse ? 'character ' + i : characterName(i), sub: terse ? '' : 'character ' + i, icon, face,
                   title: 'Scenario › Characters' });
}

// What a person says over their head, from the bark catalogue: their own
// lines, and the shared idle script's where their dialogue hands off to it.
function characterSays(i) {
  let mine = [];
  try { mine = buildBarkCatalogue().filter(b => b.who === i); } catch (e) { mine = []; }
  if (!mine.length) return '';
  const lines = mine.flatMap(b => b.words).map(w => '“' + svEsc(w) + '”');
  return partsStrip('Says', ['<button class="navChip" onclick="showCategory(\'BARKS\')">Barks</button>'],
    lines.join(', '));
}

const HERO_CLASS_TEXT = [['Class names', 0x203], ['Class descriptions', 0x204], ['Class stats', 0x205], ['Class skills', 0x206]];

function characterParts(i, d) {
  const chips = [];
  const talk = 0x1800 + i;
  if (refExists(talk)) chips.push(partChip('Talk', talk));
  const portrait = 0x8800 + (i - 1);
  if (refExists(portrait)) chips.push(partChip('Portrait', portrait));
  if (d.tile) {
    const sheet = 0x8E00 + (d.tile >> 4);
    if (refExists(sheet)) chips.push(partChip('Sprite sheet', sheet));
  }
  const cls = 0x1000 + d.rec.proptype;
  if (d.rec.proptype && refExists(cls)) chips.push(partChip('Class script', cls));
  // The name itself is a component: character n is entry n+1 of the string
  // table 0x0201, which is what derivedCharacterName reads and what makes a
  // person the same person in every Cythera file.
  if (refExists(0x0201)) chips.push(partChip('Name label', 0x0201));
  // The hero is the one character the player makes, and what is offered at
  // creation is these four lists: the classes, what each is, and each one's
  // attributes and skills as text. Character 1 is the hero wherever the
  // scripts address characters by number (see the Creates in page-rules.js).
  if (i === 1) for (const [label, r] of HERO_CLASS_TEXT) if (refExists(r)) chips.push(partChip(label, r));
  if (refExists(0xF009)) chips.push(partChip('Record', 0xF009));
  // Through the Schedules sheet, not at the raw table: a component is
  // reached by the Components tab that shows it, and the bytes from there.
  if (d.schedule.length) chips.push(actionChip('Schedule', 'openSchedule(' + i + ')', 'their day'));
  return chips;
}

// A zone is a map, its prop list, and the scripts numbered like it: all 42
// entry scripts (0x14xx) and the three region scripts (0x15xx) in the
// shipped archive share their index with a map.
function mapParts(resid, propResid) {
  const level = resid & 0xFF;
  const chips = [];
  if (propResid && refExists(propResid)) chips.push(partChip('Prop list', propResid));
  if (refExists(0x1400 + level)) chips.push(partChip('Entry script', 0x1400 + level));
  if (refExists(0x1500 + level)) chips.push(partChip('Sub-zone script', 0x1500 + level));
  /* The backdrop the zone is drawn against is a component like the rest of
     them, and the page has read it all along without ever showing it: the
     entry script's one SetLandscapeImage call, which zoneLandscapeArg picks
     out. Zero and up is a strip at 0x8400 + n. The negatives are the
     engine's own backdrops and have no resource to chip at -- -1 is the
     wavy void behind Land King Hall, drawn from the pair 0x8F50/0x8F51 --
     so those are named rather than linked, because a chip that opens
     nothing is worse than a word. */
  try {
    const land = zoneLandscapeArg(level);
    if (land !== null && land >= 0 && refExists(0x8400 + land)) chips.push(partChip('Landscape', 0x8400 + land));
    else if (land === -1) chips.push(actionChip('Landscape', "showCategory('142')", 'the ethereal void'));
    else if (land !== null && land < 0) chips.push(actionChip('Landscape', "showCategory('131')", 'one the engine keeps'));
  } catch (e) { quiet(e); }
  return chips;
}

/* Who plays a sound, by every route the game has.

   The application reaches the archive's sounds through four routines, and all
   four add 0x9100 to a number: TAudio::PlaySound, PlayAmbientSound,
   BeginSpotSound and CalcAmbient (read 16 September 2026). Their callers are
   where the numbers come from:
     - the scripts' own calls: PlaySound, PlaySoundSync (slot 0xD4, which
       delvmod's table calls UnknownD4; the binary's routine there is
       cbPlaySoundSync) and PlayAmbientSound;
     - ShootEffect (cbMissileFX), whose eighth operand TGameViewer::DoMissile
       hands to the TSoundTracker that follows a thrown or shot thing;
     - TViewer::SetStage, for every loose prop whose class's SoundEffects
       begins with a number (FillIntfCache keeps that word per prop type),
       and for every kind-3 egg, whose prop-type field is the sound.
   PlayIFSound, the only other, plays the application's own snd resources.

   So a sound is a constant in one of those calls, or it reaches one as
     - an argument of a helper, named where the helper is called or queued as
       a task: AddTask's task n runs helper 0xC00 + n, which the helpers bear
       out (0xC44 sets the talk balloon for task 0x44, 0xC4F uses one thing on
       another for 0x4F, 0xC42 waits for 0x42);
     - a word of the table of the class the call reads, `class_member 0xKKWW`,
       or an entry of an array that word points at, by index: a weapon's miss
       and hit sounds, a bow's shot, a creature's cries;
     - an entry of a list the script builds in place, which is how 0x3041
       gives anyone without cries of their own the default ones;
     - the first word of a prop's SoundEffects, played where the prop stands;
     - an egg.
   Each is read from the shape of the instructions, following a local back to
   what was stored in it; nothing here names a routine's address or a class.
   The scripts are read through buildScriptTextIndex, whose listings hold only
   the functions dvmDiscover found: the archive's data blocks decode into
   thousands of false PlaySound calls if bytes are walked as code. Sound n is
   0x9100 + n, music n is 0x9000 + n. */
const SOUND_CALLS = { 'sys PlaySound': 0, 'sys UnknownD4': 0, 'sys PlayAmbientSound': 0, 'sys ShootEffect': 7 };

// Where a sound value in a listing comes from: {num}, {arg}, {key, word},
// {data}, each with a `slot` when an array is indexed.
function soundValueSources(ops, v, depth) {
  if (!v || !v.length || depth > 4) return [];
  const n = dvmValueNum(v);
  if (n !== null) return [{ num: n }];
  const a = dvmValueArg(v);
  if (a !== null) return [{ arg: a }];
  const last = v[v.length - 1];
  if (last.mn === 'index' && v.length >= 3) {
    const slot = dvmNum(v[v.length - 2]);
    if (slot === null) return [];
    return soundValueSources(ops, v.slice(0, -2), depth + 1)
      .filter(s => (s.key !== undefined && s.slot === undefined) || s.data !== undefined)
      .map(s => Object.assign({}, s, { slot }));
  }
  let m = /^class_member 0x([0-9A-F]{2})([0-9A-F]{2})$/.exec(last.text);
  if (m) return [{ key: parseInt(m[1], 16), word: parseInt(m[2], 16) }];
  if (v.length === 1 && last.mn === 'data') return [{ data: last.at }];
  m = v.length === 1 && /^local Var([0-9A-F]{2})$/.exec(last.text);
  if (m) {
    const out = [], set = 'set_local 0x' + m[1];
    ops.forEach((o, j) => { if (o.obj === last.obj && o.text === set) out.push(...soundValueSources(ops, dvmCallValues(ops, j)[0], depth + 1)); });
    return out;
  }
  return [];
}

DERIVED.SOUND_USAGE = null;
function buildSoundUsage() {
  if (DERIVED.SOUND_USAGE) return DERIVED.SOUND_USAGE;
  const u = { scripts: new Map(), classes: new Map(), lists: new Map(), props: new Map(), eggs: new Map(), music: new Map() };
  const put = (map, n, v) => { if (!(n > 0)) return; if (!map.has(n)) map.set(n, []); map.get(n).push(v); };
  const count = (map, n, resid) => {
    if (!(n > 0)) return;
    if (!map.has(n)) map.set(n, new Map());
    map.get(n).set(resid, (map.get(n).get(resid) || 0) + 1);
  };
  let index = [];
  try { index = buildScriptTextIndex(); } catch (e) { index = []; }
  const helpers = new Map(), fields = new Map();
  for (const e of index) {
    const ops = dvmOpsOf(e);
    ops.forEach((o, i) => {
      if (o.text === 'sys PlayMusic') { count(u.music, dvmValueNum(dvmCallValues(ops, i)[0]), e.resid); return; }
      if (!(o.text in SOUND_CALLS)) return;
      for (const s of soundValueSources(ops, dvmCallValues(ops, i)[SOUND_CALLS[o.text]], 0)) {
        if (s.num !== undefined) count(u.scripts, s.num, e.resid);
        else if (s.arg !== undefined) helpers.set(e.resid, s.arg);
        else if (s.key !== undefined) {
          const tag = s.key + ':' + s.word + ':' + s.slot;
          if (!fields.has(tag)) fields.set(tag, { key: s.key, word: s.word, slot: s.slot, via: new Set() });
          fields.get(tag).via.add(e.resid);
        } else if (s.data !== undefined && s.slot !== undefined) {
          let list = null;
          try { list = dvmDataValue(smartDecrypt(getResourceBytes(ARCHIVE, e.resid), e.resid).data, s.data + 3); } catch (err) { quiet(err); }
          if (Array.isArray(list) && typeof list[s.slot] === 'number') put(u.lists, list[s.slot], e.resid);
        }
      }
    });
  }
  // A helper's sound is named by whoever calls it or queues it: for a call,
  // argument k is value k; for AddTask, value 0 is who and value 1 the task.
  if (helpers.size) for (const e of index) {
    const ops = dvmOpsOf(e);
    ops.forEach((o, i) => {
      let k = null;
      const m = /^call_resource 0x([0-9A-F]+)\b/.exec(o.text);
      if (m && helpers.has(parseInt(m[1], 16))) k = helpers.get(parseInt(m[1], 16));
      else if (o.text === 'sys AddTask') {
        const t = dvmValueNum(dvmCallValues(ops, i)[1]);
        if (t !== null && helpers.has(0xC00 + t)) k = helpers.get(0xC00 + t) + 1;
      }
      if (k !== null) count(u.scripts, dvmValueNum(dvmCallValues(ops, i)[k]), e.resid);
    });
  }
  const soundEffects = Number(Object.keys(DVM_SYM.method).find(k => DVM_SYM.method[k] === 'SoundEffects'));
  for (let resid = 0x1000; resid < 0x2000; resid++) {
    const kind = dvmClassName(resid);
    if ((kind !== 'Item' && kind !== 'Monster') || !refExists(resid)) continue;
    let cls = null;
    try { cls = parseClassTable(resid); } catch (e) { cls = null; }
    if (!cls) continue;
    for (const f of fields.values()) {
      const n = classFieldNumber(cls, f.key, f.word, f.slot);
      if (n > 0) put(u.classes, n, { resid, key: f.key, word: f.word, slot: f.slot, via: [...f.via] });
    }
    const own = classFieldNumber(cls, soundEffects, 0);
    if (own > 0) put(u.props, own, resid);
  }
  for (const [n, eggs] of eggsOfKind(3)) for (const g of eggs) put(u.eggs, n, g);
  return (DERIVED.SOUND_USAGE = u);
}

// The sounds a class names, for its owner's parts strip.
function classSounds(resid) {
  const u = buildSoundUsage(), out = new Set();
  for (const [n, list] of u.classes) if (list.some(c => c.resid === resid)) out.add(n);
  for (const [n, list] of u.props) if (list.includes(resid)) out.add(n);
  return [...out].sort((a, b) => a - b).filter(n => refExists(0x9100 + n));
}

function soundUsageRows(resid, subn) {
  const u = buildSoundUsage();
  const rows = [];
  // A bare 0x0812 says little; refDescription turns it into "object script".
  const chipsFor = counts => [...(counts || new Map())].sort((a, b) => a[0] - b[0])
    .map(([r, c]) => svChip(r, (refDescription(r) || '') + (c > 1 ? ' ×' + c : '')));
  if (subn === 144) {
    const n = resid - 0x9100;
    const scripts = chipsFor(u.scripts.get(n));
    if (scripts.length) rows.push(['Played by', scripts, '']);
    const owners = [];
    const byClass = new Map();
    for (const c of u.classes.get(n) || []) if (!byClass.has(c.resid)) byClass.set(c.resid, itemFieldLabel(c.key));
    for (const r of u.props.get(n) || []) if (!byClass.has(r)) byClass.set(r, 'where it stands');
    for (const [r, what] of byClass) owners.push(...classOwnerChips(r, what));
    if (owners.length) rows.push(['Sound of', owners, '']);
    const lists = [...new Set(u.lists.get(n) || [])];
    if (lists.length) rows.push(['Default in', lists.map(r => svChip(r, 'for anyone with no sounds of their own')), '']);
    const eggs = u.eggs.get(n) || [];
    if (eggs.length) rows.push(['Heard in', zoneSquareChips(eggs), '']);
    if (!rows.length) rows.push(['Played by', [], 'Nothing plays this sound: no script, class, list or egg in the file names it.']);
  } else if (subn === 143) {
    const chips = chipsFor(u.music.get(resid - 0x9000));
    rows.push(['Played by', chips, chips.length ? '' :
      'No script names this music by number; the application starts some itself.']);
  }
  return rows;
}

/* ---- What a component belongs to -------------------------------------------
   The maintainer's rule (13 September 2026): tapping almost anything should
   take you somewhere. A walk over every page under Components on 16 September
   found most of them led nowhere but back -- every landscape, every skill
   icon, most class scripts and nearly every room script -- because the joins
   existed in one direction only. A character chipped at its class script and
   the class script never named the character; a zone chipped at its
   landscape and the landscape never named a zone.

   These are the reverse of those chips, and they keep the rule the section
   comment above sets: each is a numbering the archive follows, never a name.

     0x1000 + prop type   the class of that prop type (dvmClassName's Item)
     0x1900 + n           the class of monster record n in 0xF008. The engine
                          numbers Monster objects as it numbers characters
                          (0x1800 + i is record i of 0xF009), and the file
                          bears it out: all 29 of the shipped 0x19xx scripts
                          land on a filled record, and the only one with a
                          line of its own, 0x191A's "Something smells bad.",
                          lands on the ooze.
     0x1A00 | n           skill or spell n, and 0x8A00 | n its icon
     0x1B00 + room        the room a kind-8 egg carries as its prop type,
                          which eggKinds already checks resolves
     0x8400 + n           the landscape a zone's entry script sets with n
     0xA00 + aspect       the potion the class 0x101F calls it for

     0x8Fxx               the window a class's script opens with it, read
                          by buildScriptedWindows

   The shared helpers and the default methods at 0x30xx are left out on
   purpose: they belong to no one thing, and "Referenced by" is already the
   honest row for them. */

// Where a class leads. Through openVia, so the tabs light and the deep link
// is written once, as a dossier opened from a component already does.
function openItem(pt, aspect) {
  openVia('ITEMS', () => { if (aspect === undefined) showItemDetail(pt); else propWordOpen(pt, aspect); });
}
function openUnit(idx) { openVia('MONSTERS', () => showMonsterDetail(idx)); }
function openPropType(pt) { openVia('PROPS', () => showPropTypeDetail(pt)); }

// A skill or a spell is a card on its sheet, not a page of its own, so this
// opens the sheet and then the card, deferred a tick for the reason
// openSchedule gives. A command has no card; the sheet is where it is listed.
function openClassCard(resid) {
  let spell = false;
  try { spell = spellRules().spells.some(s => s.resid === resid); } catch (e) { quiet(e); }
  openVia(spell ? 'SPELLS' : 'SKILLS', () => {
    setTimeout(() => {
      const el = document.getElementById((spell ? 'spell-' : 'skill-') + resid.toString(16));
      if (!el) return;
      el.open = true;
      if (el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  });
}

// A thing on a Scenario tab, wearing its own sprite where it has one.
function ownerChip(cat, js, main, sub, pt) {
  const leaf = TAB_LEAF_FOR.get(cat);
  let icon = '';
  if (pt !== undefined) icon = relIconURL({ icon: pt });
  if (!icon && leaf) icon = relIconURL({ tile: leaf.tile });
  return relChip({ js, main, sub, icon, title: leaf ? tabTrail(leaf) : '' });
}

// The thing a class is the class of: the units wearing a living prop type,
// else the item, else the prop type; a monster class's unit. `sub` says what
// the chip is for where the caller knows better than "unit" or "item".
function classOwnerChips(resid, sub) {
  const kind = dvmClassName(resid);
  if (kind === 'Monster') {
    const m = parseMonsterStats()[resid - 0x1900];
    return m && !m.blank ? [ownerChip('MONSTERS', 'openUnit(' + m.index + ')', propDisplayName(m.proptype) || 'record ' + m.index, sub || 'unit', m.proptype)] : [];
  }
  if (kind !== 'Item') return [svChip(resid)];
  const pt = resid - 0x1000;
  const units = parseMonsterStats().filter(m => !m.blank && m.proptype === pt);
  if (units.length) return units.map(m => ownerChip('MONSTERS', 'openUnit(' + m.index + ')', propDisplayName(pt) || 'record ' + m.index, sub || 'unit', pt));
  if (isInventoryItem(pt)) return [ownerChip('ITEMS', 'openItem(' + pt + ')', propDisplayName(pt) || 'prop type ' + pt, sub || 'item', pt)];
  if (getPropTileList()[pt] !== undefined) return [ownerChip('PROPS', 'openPropType(' + pt + ')', propDisplayName(pt) || 'prop type ' + pt, sub || 'prop type', pt)];
  return [];
}

// A zone's name, including the map numbered 0, which zoneDisplayName reads as
// "not placed in a zone".
function zoneLabel(z) { return z ? zoneDisplayName(z) : (labelFor(0x8000) || 'zone 0'); }

// Squares on the maps, a chip a zone: the first square opens, and the count
// says how many more there are.
function zoneSquareChips(spots) {
  const byZone = new Map();
  for (const s of spots) { if (!byZone.has(s.zone)) byZone.set(s.zone, []); byZone.get(s.zone).push(s); }
  return [...byZone].sort((a, b) => a[0] - b[0]).map(([z, list]) => relChip({
    js: 'showSquareOnMap(' + (0x8000 + z) + ',' + list[0].x + ',' + list[0].y + ')',
    main: zoneLabel(z), sub: 'at ' + list[0].x + ', ' + list[0].y,
    note: list.length > 1 ? '×' + list.length : '',
    icon: relIconFor(0x8000 + z), title: trailForResid(0x8000 + z) }));
}

// Every egg in the file, by kind and then by its argument (the prop-type
// field): the zone and the square. A room is kind 8, an ambient sound kind 3.
DERIVED.EGGS = null;
function eggsOfKind(kind) {
  if (!DERIVED.EGGS) {
    const all = new Map();
    for (let z = 0; z < 0x100; z++) {
      if (!refExists(0x8100 + z)) continue;
      let list;
      try { list = parseDelverPropList(smartDecrypt(getResourceBytes(ARCHIVE, 0x8100 + z), 0x8100 + z).data); } catch (e) { continue; }
      for (const r of list) {
        if (r.flags !== 0x42) continue;
        if (!all.has(r.aspect)) all.set(r.aspect, new Map());
        const byArg = all.get(r.aspect);
        if (!byArg.has(r.proptype)) byArg.set(r.proptype, []);
        byArg.get(r.proptype).push({ zone: z, x: r.x, y: r.y });
      }
    }
    DERIVED.EGGS = all;
  }
  return DERIVED.EGGS.get(kind) || new Map();
}
function roomEggIndex() { return eggsOfKind(8); }

// The Combat AI section, on whichever Mechanics tab holds it.
function combatAiRuleChip() {
  const g = mechGroupOf('combatai');
  return relChip({ js: "showCategory('" + (g ? g.value : 'MECH_COMBAT') + "'); setTimeout(function(){ mechGo('combatai'); }, 60)",
                   main: 'Combat AI', sub: 'Mechanics' + (g ? ' › ' + g.title : ''), icon: g ? relIconURL({ tile: g.tile }) : '' });
}

function ownerRows(resid, subn) {
  const rows = [];
  if (subn === 15 || subn === 16 || subn === 24) {
    // A living prop type is a unit, and the unit's page lists the characters
    // who wear it; anything else is an item or, failing that, a prop type.
    const chips = classOwnerChips(resid);
    if (chips.length) rows.push(['Class of', chips, '']);
  }
  if (subn === 142) {
    // A picture a class's script opens as its window, read by buildScriptedWindows.
    let scripts = [];
    try { scripts = [...(buildScriptedWindows().byPicture.get(resid) || [])].sort((a, b) => a - b); } catch (e) { scripts = []; }
    const chips = scripts.flatMap(r => classOwnerChips(r));
    if (chips.length) rows.push(['Window of', chips, '']);
  }
  if (subn === 25 || subn === 137) {
    const cls = 0x1A00 | (resid & 0xFF);
    if (refExists(cls)) {
      let spell = false;
      try { spell = spellRules().spells.some(s => s.resid === cls); } catch (e) { quiet(e); }
      const kind = spell ? 'spell' : skillKind(cls) === 'command' ? 'command' : 'skill';
      const chip = ownerChip(spell ? 'SPELLS' : 'SKILLS', 'openClassCard(' + cls + ')',
                             selfNameFor(cls) || labelFor(cls) || kind, kind);
      rows.push([subn === 137 ? 'Icon of' : 'Script of', [chip], '']);
    }
  }
  if (subn === 26 || subn === 27 || subn === 29) {
    const eggs = roomEggIndex().get(resid - 0x1B00) || [];
    rows.push(['Room in', eggs.map(e => relChip({
      js: 'showSquareOnMap(' + (0x8000 + e.zone) + ',' + e.x + ',' + e.y + ')',
      main: zoneLabel(e.zone), sub: 'at ' + e.x + ', ' + e.y,
      icon: relIconFor(0x8000 + e.zone), title: trailForResid(0x8000 + e.zone) })),
      eggs.length ? '' : 'No zone places this room.']);
  }
  if (subn === 131) {
    const n = resid - 0x8400, zones = [];
    for (let z = 0; z < 0x100; z++) if (refExists(0x8000 + z) && zoneLandscapeArg(z) === n) zones.push(svChip(0x8000 + z));
    rows.push(['Behind', zones, zones.length ? '' : 'No zone’s entry script sets this landscape.']);
  }
  if (subn === 1 && HERO_CLASS_TEXT.some(([, r]) => r === resid) && loadCharacterTable()[1])
    rows.push(['Offered to', [characterChip(1)], '']);
  // The compiled combat AI and the scenario's own tests and actions are what
  // the Combat AI section on Mechanics describes; neither belongs to one unit.
  if (subn === 3 || subn === 8) rows.push(['Rules on', [combatAiRuleChip()], '']);
  if (subn === 9 && refExists(0x101F)) {
    let potion = null;
    try { potion = foodRules().potions.find(p => p.resid === resid); } catch (e) { quiet(e); }
    if (potion) rows.push(['Drunk as', [ownerChip('ITEMS', 'openItem(' + 0x1F + ',' + (resid - 0xA00) + ')', potion.name, 'aspect ' + (resid - 0xA00), 0x1F)], '']);
  }
  return rows;
}

function renderUsage(resid, subn) {
  const rows = [];
  const chars = loadCharacterTable();
  if (subn === 135) {
    const i = resid - 0x8800 + 1;
    if (chars[i]) rows.push(['Worn by', [characterChip(i)], '']);
  }
  if (subn === 23) {
    const i = resid - 0x1800;
    if (chars[i]) rows.push(['Spoken by', [characterChip(i)], '']);
  }
  if (subn === 19 || subn === 20) {
    const map = 0x8000 + (resid & 0xFF);
    if (refExists(map)) rows.push(['Runs for', [partChip(subn === 19 ? 'Zone' : 'Sub-zone of', map)], '']);
  }
  try { for (const r of ownerRows(resid, subn)) rows.push(r); } catch (e) { quiet(e); }
  if (subn === 144 || subn === 143) for (const r of soundUsageRows(resid, subn)) rows.push(r);
  let ins = [];
  try { ins = buildXrefIndex().inbound[resid] || []; } catch (e) { quiet(e); }
  if (ins.length) {
    const shown = ins.slice(0, 24);
    rows.push(['Referenced by', shown.map(e => svChip(e.from, (refDescription(e.from) || e.via) + (e.count > 1 ? ' ×' + e.count : ''))),
               ins.length > shown.length ? 'and ' + (ins.length - shown.length) + ' more' : '']);
  }
  return rows.map(([t, c, n]) => partsStrip(t, c, n)).join('');
}

// --- Monster stats (0xF008) ------------------------------------------------
// 128 records of 16 bytes. The field map is the wiki's F008 page, and it holds
// up against this archive: record 22 is prop type 0x5A, which the prop-type
// list names "goat", and the wiki's own note says the goat is entry 0x16 = 22.
// Records 21/23/24 line up with bird, crab and ratlizard the same way.
//
// The useful part is that prop_type joins this table to everything else -- the
// sprite, the name, and any character wearing it -- so a monster stops being a
// row of hex and becomes a creature. corpse_type is packed the same way a prop
// record's aspect/proptype word is (6 bits aspect, 10 bits type), which is
// what says a dead goat is a goat at aspect 2 while an undead leaves "bones".
const MONSTER_FIELDS = [
  ['body', 'One of the three main stats. The wiki warns these three may be out of order.'],
  ['reflex', 'One of the three main stats.'],
  ['mind', 'One of the three main stats.'],
  ['armor', 'Damage reduction.'],
  ['size', 'Unidentified; the wiki guesses size.'],
  ['hp', 'Hit points.']
];

/* The 0xF008 flags word, decoded. Neither delvmod (monster.py is a stub) nor
   the wiki ever worked these out. They fell to a cross-reference: gandreas
   posted the authoritative monster attribute list on the old board (t1217;
   preserved at forums.cytheraguides.com/post/11047, tabulated on the
   cytheraguides Monster Stats page), and solving his labels against the
   archive's flag words gives every attribute exactly one bit, uniquely,
   with zero contradictions across 32 monsters. 0x4000 = bleeds is Bryce's
   (delvmod's rdasm header), confirmed by the same solve: every human and
   animal has it, no undead, construct, spirit or ooze does.

   Three bits remain unnamed. 0x0004 sits on every humanoid (and tracks
   gandreas's "Body based attack" imperfectly); 0x1000 is bird + harpy +
   sea monster; 0x2000 is ghost, golem, harpy and the oozes. Do not guess
   labels for them here -- an unlabeled bit prints as hex below, which is
   honest.

   How the engine consumes these is not a guess: the default ResistDamage
   is a script in the archive, at 0x3040 -- default methods live at
   0x3000|method_id (subindex 47; the wiki's Object page pointed there).
   Its rules, in order: fire flag 0x0080 zeroes type-0x08 damage; electric
   flag 0x8000 zeroes type-0x20; resist-magic 0x0800 HALVES type-0x40;
   vulnerable-to-fire 0x0200 DOUBLES type-0x08; character status flag 23
   (Resist Fire, gator boots) zeroes type-0x08; resist-non-blunt 0x0400
   halves edged/piercing (type&0x03 without 0x04); and resist-non-magical
   0x0100 returns ZERO for any damage type with no magic bit (type&0xC0
   empty) -- total immunity, not a reduction. Armor then subtracts
   stochastically. So the lich, with 0x0100 and no fire bit, shrugs off
   bombs AND Fireball (both are pure type 0x08), exactly as in-game
   testing has confirmed -- while gandreas's published list stays
   correct that it has no fire immunity. 0x3040 contains no
   check for death-immunity 0x0020, so that flag must be tested by each
   spell -- which is where "Death Strike hurts demons despite Immune to
   Death" lives. */
const MONSTER_FLAG_NAMES = [
  [0x0001, 'can swim'],
  [0x0002, 'can fly'],
  [0x0010, 'immune to sleep'],
  [0x0020, 'immune to death magic'],
  [0x0040, 'immune to poison'],
  [0x0080, 'immune to fire'],
  [0x0100, 'resists non-magical weapons'],
  [0x0200, 'vulnerable to fire'],
  [0x0400, 'resists non-blunt weapons'],
  [0x0800, 'resists magic'],
  [0x4000, 'bleeds'],
  [0x8000, 'immune to electricity'],
];
function monsterFlagsText(f) {
  const bits = [];
  let rest = f;
  for (const [bit, name] of MONSTER_FLAG_NAMES)
    if (f & bit) { bits.push(name); rest &= ~bit; }
  if (rest) bits.push('+0x' + rest.toString(16).toUpperCase() + ' (unidentified)');
  return bits.length ? bits.join(' · ') : 'none set';
}

/* Where the default ResistDamage (0x3040) tests each flag bit: the `word N`
   that follows a `get_field monster_flags`, with its offset, so a flag on a
   monster's page opens the line that reads it. Bits 0x3040 does not test
   are named from gandreas's list (MONSTER_FLAG_NAMES) with no link. */
function monsterFlagSites() {
  if (DERIVED.MONSTER_FLAG_SITES) return DERIVED.MONSTER_FLAG_SITES;
  const out = new Map();
  try {
    const e = buildScriptTextIndex().find(x => x.resid === 0x3040);
    const ops = e ? dvmOpsOf(e) : [];
    for (let i = 0; i + 1 < ops.length; i++) {
      if (!/^get_field monster_flags\b/.test(ops[i].text)) continue;
      const m = /^(?:byte|short|word) (-?0x[0-9A-F]+|-?\d+)$/i.exec(ops[i + 1].text);
      if (!m) continue;
      const mask = parseInt(m[1]);
      if (!out.has(mask)) out.set(mask, { resid: 0x3040, at: ops[i + 1].at });
    }
  } catch (e) { quiet(e); }
  return (DERIVED.MONSTER_FLAG_SITES = out);
}
function monsterFlagsHTML(f) {
  const sites = monsterFlagSites();
  const bits = [];
  let rest = f;
  for (const [bit, name] of MONSTER_FLAG_NAMES)
    if (f & bit) { const s = sites.get(bit); bits.push(s ? srcNum(s, name) : svEsc(name)); rest &= ~bit; }
  if (rest) bits.push('+0x' + rest.toString(16).toUpperCase() + ' (unidentified)');
  return bits.length ? bits.join(' · ') : 'none set';
}

function parseMonsterStats() {
  if (DERIVED.MONSTER_STATS) return DERIVED.MONSTER_STATS;
  const out = [];
  try {
    const d = getResourceBytes(ARCHIVE, 0xF008);
    if (d) {
      for (let i = 0; i * 16 + 16 <= d.length; i++) {
        const p = i * 16, r = d.subarray(p, p + 16);
        let blank = true;
        for (const v of r) if (v) { blank = false; break; }
        const cw = u16be(r, 14);
        // The layout is GetField's second jump table (exeMonsterFields),
        // not a guess: field 44 reads byte 0 and so on down to field 54,
        // the halfword at 14. Two corrections came out of reading it. The
        // special flags are the WORD at 8, and this parsed the halfword at
        // 10, so the top half -- set on eleven of the fifty -- was never
        // shown. And byte 6 is delvmod's `alignment`, which used to be
        // swallowed by an "unknown2" spanning bytes 6 to 9, a field that
        // straddled the alignment and half the flags and meant nothing.
        out.push({
          index: i, blank, raw: r,
          body: r[0], reflex: r[1], mind: r[2], armor: r[3], damage: r[4], hp: r[5],
          alignment: r[6], unknown7: r[7],
          flags: u32be(r, 8),
          proptype: u16be(r, 12),
          corpseWord: cw, corpseType: cw & 0x03FF, corpseAspect: (cw >> 10) & 0x3F
        });
      }
    }
  } catch (e) { quiet(e); }
  return (DERIVED.MONSTER_STATS = out);
}

function renderMonsterSheet() {
  stopSpriteAnimations();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  const recs = parseMonsterStats().filter(r => !r.blank);
  const tiles = getPropTileList();
  for (const r of recs) {
    const cell = document.createElement('div');
    cell.className = 'cell propCell';
    const wrap = document.createElement('div');
    wrap.className = 'cellimgwrap';
    const base = tiles[r.proptype];
    if (base !== undefined) {
      // Assembled the way the program builds it, facing the reader.
      // Every unit at the same pixels a square, and the cell grows to hold
      // it: the hydra covers nine squares and the crab one, and they are
      // drawn at one scale so the two can be compared.
      const spr = drawUnitSprite(r.proptype, GALLERY_TILE_PX);
      fitGalleryCell(cell, wrap, spr);
      if (spr) { wrap.appendChild(spr.canvas); animateUnitSprite(spr); }
    }
    cell.appendChild(wrap);
    const lbl = document.createElement('div');
    lbl.className = 'lbl';
    lbl.innerHTML = propNameHTML(r.proptype);
    cell.appendChild(lbl);
    const sub = document.createElement('div');
    sub.className = 'resid';
    sub.textContent = 'B' + r.body + ' R' + r.reflex + ' M' + r.mind +
                      ' \u00b7 ' + r.hp + ' hp' + (r.armor ? ' \u00b7 ' + r.armor + ' armor' : '');
    cell.appendChild(sub);
    cell.onclick = () => showMonsterDetail(r.index);
    grid.appendChild(cell);
  }
  out.textContent = recs.length + ' monsters defined in 0xF008 (of ' +
                    parseMonsterStats().length + ' record slots).';
}

/* ---- byte 4 of a unit's record ------------------------------------------
   gandreas's 1999 field list calls it Size with a question mark, and the
   question mark was right: nothing in the application reads it. What does
   read it is a script, through GetField -- the field whose handler loads
   byte 4 (exeMonsterFields) -- and exactly one script in the shipped file
   asks for that field. It builds a blow as the byte plus a random amount
   drawn from the attacker's Body and hands the sum to the damage helper,
   so the byte is the fixed part of what a blow does.

   The figures agree with that and not with size: a bird 1, a child 2, a
   crab 8, a gator 10, and the king 100 beside 255 health and 30 armor.
   That corroboration is in GRIMOIRE-NOTES.md and not in the sentence the
   page prints, which says what the script does and stops.

   The site is found rather than written down: the field number comes from
   the executable and the line from the script that names it. Null with no
   application open, and then the page says only that the byte is byte 4. */
DERIVED.MONSTER_DAMAGE_SITE = undefined;
function monsterDamageSite() {
  if (DERIVED.MONSTER_DAMAGE_SITE !== undefined) return DERIVED.MONSTER_DAMAGE_SITE;
  let out = null;
  try {
    const mf = appImage() ? exeMonsterFields() : null;
    const f = mf && mf.fields.find(x => x.offset && x.offset.v === 4);
    if (f) {
      const named = DVM_SYM.field[String(f.field)];
      const tag = new RegExp('^\\s*([0-9A-Fa-f]{4})\\s+get_field\\s+(?:0x' +
        f.field.toString(16).toUpperCase() + '\\b|' + (named ? named + '\\b' : '(?!)') + ')', 'm');
      for (const e of buildScriptTextIndex()) {
        const m = tag.exec(e.text);
        if (m) { out = { resid: e.resid, at: parseInt(m[1], 16), field: f.field }; break; }
      }
    }
  } catch (e) { quiet(e); }
  return (DERIVED.MONSTER_DAMAGE_SITE = out);
}
function monsterByteNote() {
  const site = monsterDamageSite();
  if (!site) return 'Damage is byte 4 of the record, which gandreas\u2019s list calls Size with a question mark.';
  return 'Damage is byte 4, which gandreas\u2019s list calls Size with a question mark. ' +
    'Nothing in the application reads it and one script does: ' +
    srcNum({ resid: site.resid, at: site.at }, 'it asks for field ' + site.field) +
    ', adds a random amount drawn from Body, and passes the sum to the damage helper.';
}

function showMonsterDetail(idx) {
  stopSpriteAnimations();
  markDetailView('monster', idx);
  const grid = document.getElementById('sheetGrid');
  grid.style.display = 'block';
  grid.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'secondary';
  back.textContent = 'All monsters';
  back.onclick = renderMonsterSheet;
  grid.appendChild(back);

  const r = parseMonsterStats()[idx];
  if (!r) return;
  const tiles = getPropTileList();
  const nm = propDisplayName(r.proptype) || ('prop type 0x' + r.proptype.toString(16).toUpperCase());
  const panel = document.createElement('div');
  panel.style.cssText = 'width:100%;max-width:560px;margin:12px auto;text-align:left';

  let h = '<div style="font-size:1.25rem;color:#fff">' + svEsc(nm) +
          '</div><div style="font-size:0.75rem;color:#b5b2a8;margin-bottom:10px">' +
          'record ' + r.index + ' of 0xF008 \u00b7 prop type 0x' +
          r.proptype.toString(16).toUpperCase() + '</div>';
  // Every figure opens the instruction that reads its byte: the handler
  // GetField jumps to for the field a script asks for. `stat` takes the
  // byte's offset in the record and finds the field whose handler loads it.
  const mf = appImage() ? exeMonsterFields() : null;
  const fieldAt = off => mf ? mf.fields.find(f => f.offset && f.offset.v === off) : null;
  const stat = (off, v) => {
    const f = fieldAt(off);
    return f && f.at ? srcNum({ exe: f.at }, String(v)) : String(v);
  };
  h += '<div class="sv-facts">' +
    '<div><b>Body / Reflex / Mind</b>' + stat(0, r.body) + ' \u00b7 ' + stat(1, r.reflex) + ' \u00b7 ' + stat(2, r.mind) +
      '<br><span style="font-size:0.6875rem;color:#b5b2a8">The wiki cautions these three may be in a different order than named.</span></div>' +
    '<div><b>Health</b>' + stat(5, r.hp) + (r.armor ? ' &nbsp; <b>Armor</b> ' + stat(3, r.armor) : '') +
      (r.damage ? ' &nbsp; <b>Damage</b> ' + stat(4, r.damage) : '') +
      (r.alignment ? ' &nbsp; <b>Alignment</b> ' + stat(6, r.alignment) : '') +
      '<br><span style="font-size:0.6875rem;color:#8c8980">' + monsterByteNote() + '</span></div>' +
    '<div><b>Special flags</b>0x' + r.flags.toString(16).toUpperCase().padStart(8, '0') +
      ' <span style="font-size:0.6875rem;color:#b5b2a8">' + monsterFlagsHTML(r.flags) + '</span>' +
      '<br><span style="font-size:0.6875rem;color:#8c8980">A linked flag opens the line of the default ResistDamage that tests it; the rest are named from gandreas’s list and tested elsewhere. The flags are the word at byte 8, which ' +
      (mf ? srcNum({ exe: (fieldAt(8) || {}).at }, 'the field that reads them') : 'the field that reads them') + ' takes whole.</span></div>' +
    '</div>';
  panel.innerHTML = h;

  // The unit as the program builds it, then every frame of its own.
  const base = tiles[r.proptype];
  if (base !== undefined) {
    const whole = drawUnitSprite(r.proptype, 48);
    if (whole && whole.unit) {
      const u = whole.unit;
      const box = document.createElement('div');
      box.style.cssText = 'display:flex;gap:14px;align-items:flex-start;margin-bottom:12px;flex-wrap:wrap';
      const holder = document.createElement('div');
      holder.style.cssText = 'padding:6px;background:#1c1913;border:1px solid #33302a';
      holder.appendChild(whole.canvas);
      animateUnitSprite(whole);
      box.appendChild(holder);
      const how = document.createElement('div');
      how.style.cssText = 'font-size:0.75rem;color:#b5b2a8;line-height:1.5;max-width:380px';
      const lay = u.layout ? 'Layout ' + srcNum({ resid: u.layout.resid, at: u.layout.at }, String(u.layout.code)) + ' (the first word of its key 55)' : 'No layout word';
      const app = appImage();
      if (u.kind === 'octo') how.innerHTML = lay + ': <b>a body with ' + (u.rule ? srcNum(u.rule.arms, u.rule.arms.v + ' arms') : '8 arms') + '</b> of ' +
        (u.arm !== null ? svLink(propDisplayName(u.arm) || ('prop ' + u.arm), 'showMonsterDetail(' + (parseMonsterStats().findIndex(m => m.proptype === u.arm)) + ')') : 'no class') +
        ', the class its key 54 names, arm <i>i</i> at aspect <i>i</i> \u00d7 ' +
        (u.rule && u.rule.aspectStep ? srcNum(u.rule.aspectStep, String(u.step)) : String(u.step)) +
        ' -- the frames one direction owns -- on the ' + (u.rule ? srcNum(u.rule.dx, 'eight squares') : 'eight squares') + ' around it' +
        (app ? ', as ' + pefChip('TOctoMonster::TOctoMonster') + ' builds it' : '') + '.';
      else if (u.kind === 'crawl') how.innerHTML = lay + ': <b>a head with its tail behind it</b>, the tail a second record at the head’s aspect plus ' + (u.rule ? srcNum(u.rule.tailOffset, '8') : '8') +
        (app ? ', as ' + pefChip('TCrawlMonster::TCrawlMonster') + ' builds it; ' + pefChip('TActiveMonster::CreateMonster') + ' picks that kind by the layout' : '') + '.';
      else if (u.kind === 'span') how.innerHTML = lay + ': one record, and <b>its tiles span ' + whole.cols + ' by ' + whole.rows + '</b> by their attributes, the way a placed thing’s do.';
      else how.innerHTML = lay + ': one record, one tile' + (app ? '; ' + pefChip('TActiveMonster::AdjustAspect') + ' picks the frame by the layout' : '') + '.';
      box.appendChild(how);
      panel.appendChild(box);
    }
    const info = spriteFrameInfo(0, r.proptype);
    const strip = document.createElement('div');
    strip.style.cssText = 'display:flex;flex-wrap:wrap;gap:3px;margin-bottom:12px';
    for (const f of info.present.slice(0, 16)) {
      const holder = document.createElement('div');
      holder.style.cssText = 'width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:#1c1913;border:1px solid #33302a;overflow:hidden';
      const spr = drawPropSprite(base + f, 20);
      if (spr) holder.appendChild(spr.canvas);
      imageOpens(holder, sheetOfTile(base + f), 'frame ' + f + ', sheet');
      strip.appendChild(holder);
    }
    panel.appendChild(strip);
  }

  // What it leaves behind. This is the field that makes the table worth
  // reading: an undead leaves bones, a goat leaves a goat at aspect 2.
  const cd = document.createElement('div');
  cd.style.cssText = 'font-size:0.8125rem;line-height:1.7;margin-bottom:10px';
  if (r.corpseWord) {
    const cnm = propDisplayName(r.corpseType) || ('0x' + r.corpseType.toString(16).toUpperCase());
    cd.innerHTML = '<b style="color:#b5b2a8">Leaves behind</b> ' + svEsc(cnm) +
                   ' at aspect ' + r.corpseAspect +
                   ' <span style="font-size:0.6875rem;color:#8c8980">(corpse_type 0x' +
                   r.corpseWord.toString(16).toUpperCase().padStart(4, '0') +
                   ', packed 6-bit aspect + 10-bit prop type)</span>';
    const cbase = tiles[r.corpseType];
    if (cbase !== undefined) {
      const spr = drawPropSprite(cbase + r.corpseAspect, 40);
      if (spr) { spr.canvas.style.marginTop = '6px'; imageOpens(spr.canvas, sheetOfTile(cbase + r.corpseAspect), 'sheet'); cd.appendChild(spr.canvas); }
    }
  } else {
    cd.innerHTML = '<b style="color:#b5b2a8">Leaves behind</b> nothing.';
  }
  panel.appendChild(cd);
  // The components: its class script, the sheet its sprite is cut from, and
  // the stats table this record is a row of.
  {
    const chips = [];
    const cls = 0x1000 + r.proptype;
    if (r.proptype && refExists(cls)) chips.push(partChip('Class script', cls));
    const base = tiles[r.proptype];
    if (base !== undefined && refExists(0x8E00 + (base >> 4))) chips.push(partChip('Sprite sheet', 0x8E00 + (base >> 4)));
    for (const n of classSounds(0x1900 + r.index)) chips.push(partChip('Sound', 0x9100 + n));
    if (refExists(0xF008)) chips.push(partChip('Stats table', 0xF008));
    chips.push(actionChip('Prop type', 'showPropTypeDetail(' + r.proptype + ')', 'every frame'));
    const made = document.createElement('div');
    made.innerHTML = partsStrip('Made of', chips);
    panel.appendChild(made);
  }

  // Named characters wearing this sprite.
  const users = [];
  try {
    const chars = loadCharacterTable();
    for (let i = 1; i < chars.length; i++) if (chars[i].proptype === r.proptype) users.push(i);
  } catch (e) { quiet(e); }
  if (users.length) {
    const u = document.createElement('div');
    u.style.cssText = 'font-size:0.8125rem;line-height:1.9;margin-bottom:10px';
    u.innerHTML = '<b style="color:#b5b2a8">Characters using this sprite</b><br>' +
      users.slice(0, 30).map(i => '<button class="sv-chip" onclick="showCharacterDetail(' + i + ')">' +
        svEsc(characterName(i)) + '</button>').join(' ');
    panel.appendChild(u);
  }

  const raw = document.createElement('div');
  raw.style.cssText = 'font-family:ui-monospace,Menlo,monospace;font-size:0.6875rem;color:#b5b2a8';
  raw.textContent = 'raw: ' + Array.from(r.raw).map(b => b.toString(16).padStart(2, '0')).join(' ') +
                    (r.unknown7 ? '   byte 7 = ' + r.unknown7 + ', which no field reads' : '');
  panel.appendChild(raw);
  grid.appendChild(panel);
  document.getElementById('output').textContent = nm + ', record ' + r.index + ' of 0xF008';
}

// --- Record-width inspector ------------------------------------------------
// For the F0xx tables that genuinely have no field map. Guessing a stride is
// the first step in reading any of them, so let the stride be chosen and show
// the consequences: rows as raw bytes and as big-endian words, with the
// leftover tail called out, since a stride that divides evenly is usually the
// right one.
window.TABLE_WIDTH = 16;
function setTableWidth(w) { window.TABLE_WIDTH = +w; renderTableInspector(window.CUR_TABLE_RESID); }

function renderTableInspector(resid) {
  const host = document.getElementById('tableInspector');
  if (!host) return;
  window.CUR_TABLE_RESID = resid;
  let d = null;
  try { d = smartDecrypt(getResourceBytes(ARCHIVE, resid), resid).data; } catch (e) { quiet(e); }
  if (!d || !d.length) { host.style.display = 'none'; return; }
  host.style.display = '';
  const w = window.TABLE_WIDTH || 16;
  const widths = [2, 4, 6, 8, 12, 16, 24, 32];
  let h = '<details class="sv" open><summary>Read as fixed-width records</summary><div style="padding:0 10px 10px">';
  h += '<div class="sv-note" style="margin-bottom:8px">' + d.length + ' bytes. ' +
       'A stride that divides evenly is usually the right one.</div>';
  h += '<div class="sv-chips" style="margin-bottom:8px">' + widths.map(x =>
        '<button class="navChip' + (x === w ? ' active' : '') + '" onclick="setTableWidth(' + x + ')">' +
        x + ' \u00d7 ' + Math.floor(d.length / x) + (d.length % x ? ' +' + (d.length % x) : '') +
        '</button>').join('') + '</div>';
  const rows = Math.min(Math.floor(d.length / w), 400);
  h += '<pre class="pane" style="max-height:340px;font-size:0.6875rem;white-space:pre">';
  let body = '';
  for (let i = 0; i < rows; i++) {
    const p = i * w;
    let hexs = '', words = '';
    for (let k = 0; k < w; k++) hexs += d[p + k].toString(16).padStart(2, '0') + ' ';
    for (let k = 0; k + 1 < w; k += 2) words += (u16be(d, p+k) + '').padStart(6) + ' ';
    body += String(i).padStart(4) + '  ' + hexs + ' |' + words + '\n';
  }
  if (Math.floor(d.length / w) > rows) body += '... ' + (Math.floor(d.length / w) - rows) + ' more records\n';
  if (d.length % w) {
    let tail = '';
    for (let k = d.length - (d.length % w); k < d.length; k++) tail += d[k].toString(16).padStart(2, '0') + ' ';
    body += '\ntail (' + (d.length % w) + ' bytes): ' + tail + '\n';
  }
  h += svEsc(body) + '</pre></div></details>';
  host.innerHTML = h;
}

function renderText() {
  const out = document.getElementById('output');
  const sel = document.getElementById('residSelect');
  const idx = parseInt(sel.value);
  const [resid, roff, rlen] = window.CUR_RESIDS[idx];
  // An open editor holds the PREVIOUS resource's bytes; left open across
  // navigation, Apply would write them into whatever is showing now.
  cancelResourceEdit();
  try {
    const resDataRaw = ARCHIVE.bytes.slice(roff, roff+rlen);
    const { data: resData, wasDecrypted, rawScore, decScore, allZero } = smartDecrypt(resDataRaw, resid);

    document.getElementById('textPreview').style.display = 'block';
    document.getElementById('zoomControls').style.display = 'none';
    document.getElementById('resourceNav').style.display = 'flex';
    document.getElementById('backToSheet').style.display = 'block';

    // The identity of the resource is now the job of the script view's header,
    // so this line carries only what that panel does not: the decision the
    // decryptor made, and how close it was.
    const lbl = labelFor(resid);
    document.getElementById('textLabel').textContent =
      (wasDecrypted ? 'decrypted' : 'read as stored') +
      (rawScore || decScore ? '  (plaintext score ' + Math.max(rawScore, decScore).toFixed(2) +
                              ' vs ' + Math.min(rawScore, decScore).toFixed(2) + ')' : '  (decided by structure)');
    updateUsagePanel(resid, window.CUR_SUBN);

    // Three separate views rather than one concatenated blob.
    let content = '', stringsText = '', hexText = '';
    const subn = window.CUR_SUBN;

    // Prop Lists (0x81xx) -- structured 16-byte records, ported from delv/level.py PropList
    if (subn === 128) {
      const recs = parseDelverPropList(resData);
      content += "--- PROP LIST (parsed as delv.level.PropList, " + recs.length + " records) ---\n";
      content += recs.map(r =>
        '#' + r.index + '  flags=0x' + r.flags.toString(16).padStart(2,'0') +
        // Same reading as delvmod's textual_location: the location word is a
        // containment link, not coordinates, once the flags say so.
        '  ' + (r.carriedBy !== null
                  ? (r.equipped ? 'equipped by #' : 'carried by #') + r.carriedBy
                  : r.container !== null
                      ? 'inside prop #' + r.container
                      : '(' + r.x + ',' + r.y + ')') +
        '  proptype=0x' + r.proptype.toString(16).padStart(3,'0') +
        '  aspect=' + r.aspect + (r.rotated ? '(rot)' : '') +
        '  d1=' + r.d1 + ' d2=' + r.d2 +
        '  storeref=0x' + r.storeref.toString(16).padStart(4,'0') +
        (storeSymbol(r.storeref) ? ' (' + storeSymbol(r.storeref) + ')' : '') +
        '  otherprop32=0x' + r.otherprop.toString(16).padStart(8,'0') +
        '  tail=' + r.tail +
        '  u=0x' + r.u.toString(16).padStart(4,'0')
      ).join('\n') + '\n\n';
    }
    // Schedule List (resource 0xF00B specifically) -- ported from delv/schedule.py
    else if (resid === 0xF00B) {
      const sched = parseDelverScheduleList(resData);
      if (sched && sched.length) {
        content += "--- SCHEDULE LIST (parsed as delv.schedule.ScheduleList, " + sched.length + " characters with entries) ---\n";
        content += sched.map(s =>
          'Character #' + s.character + ':\n' + s.entries.map(e =>
            '  hour=' + e.hour + '  mode=0x' + e.mode.toString(16).padStart(2,'0') +
            '  scripting=0x' + e.scripting.toString(16).padStart(4,'0') +
            '  level=' + e.level + '  (' + e.x + ',' + e.y + ')'
          ).join('\n')
        ).join('\n') + '\n\n';
      } else {
        content += "--- SCHEDULE LIST ---\n(Resource too short to parse)\n\n";
      }
    }
    // Known "Delver atom array" text resources -- ported from delv/script.py
    else {
      const structured = DELVER_TEXT_ARRAY_RESIDS.has(resid) ? parseDelverTextArray(resData) : null;
      if (structured && structured.length) {
        content += "Delver atom array, " + structured.length + " entries:\n\n";
        content += structured.map(e =>
          '#' + e.index + '  (offset 0x' + e.offset.toString(16).padStart(4,'0') + ')  "' + e.str + '"'
        ).join('\n') + '\n';
      }
    }

    // The strings pane is built for every category, not just the ones that
    // fall through to it -- a prop list or a map header can still carry text.
    stringsText = extractReadableStrings(ARCHIVE, resData, resid) || '(No readable strings in this resource.)';
    hexText = hexDump(resData);

    const midiBtn = document.getElementById('midiBtn');
    if (midiBtn) midiBtn.style.display = 'none';
    if (subn === 143) {
      let head = "--- QTMA TUNE (decoded) ---\n";
      try {
        const info = qtmaToMidi(resDataRaw);
        const gm = Object.keys(info.noteRequests).sort((a,b)=>a-b)
          .map(p => "  part " + p + " -> MIDI ch " + ((info.chanOf[p]|0)+1) +
                    ", GM program " + info.noteRequests[p] + " (" +
                    (GM_NAMES[info.noteRequests[p]-1] || "?") + ")").join("\n");
        head += "Notes: " + info.noteCount + "   Events: " + info.eventCount +
                "   Length: " + info.durationSec.toFixed(1) + "s\n" +
                "Parts:\n" + (gm || "  (none declared)") + "\n\n" +
                "Use \"Download as MIDI\" below, then render with any General MIDI\n" +
                "synth (e.g. fluidsynth -F out.wav SoundFont.sf2 file.mid).\n\n";
        if (midiBtn) midiBtn.style.display = '';
      } catch(e) {
        head += "(could not decode as a QTMA tune: " + e.message + ")\n\n";
      }
      content = head + content;
    }

    // Every non-media subindex holds Delver VM containers, so every one of
    // them gets a real disassembly instead of a byte dump. Subindexes 1, 2, 4,
    // 10 and 29 were missing from this list, which is the whole reason 27
    // resources -- 0x0301 among them -- rendered as anonymous hex. They were
    // decrypting correctly the entire time and the disassembler could already
    // read them; it was simply never called. 0x0301 is `[2, 3, 1, 1]`.
    const SCRIPT_SUBN = new Set([0,1,2,3,4,7,8,9,10,11,12,13,14,15,16,19,20,23,24,25,26,27,29,47]);
    let scriptText = '';
    if (SCRIPT_SUBN.has(subn)) {
      try {
        const named = dvmNamedScript(resData);
        if (named) {
          // Name the thing, then be honest about the body. Running the VM
          // disassembler over it produces a plausible-looking stream that is
          // entirely wrong -- 0x0410 "decodes" as PlayNote followed by thirty
          // Var00 pushes -- so it is not shown. The bytes fall into short
          // repeating groups and look like a condition/action table, but that
          // is a hunch, not a format.
          scriptText = 'name: "' + named.name + '"\n\n' +
                       'The body starts at +0x' + named.bodyOffset.toString(16).toUpperCase() +
                       ' and runs ' + (resData.length - named.bodyOffset) + ' bytes.\n' +
                       'It is NOT Delver VM bytecode -- forcing the disassembler over it\n' +
                       'produces confident nonsense -- and its real format is unknown.\n' +
                       'The bytes are in the raw dump below.';
        } else {
          const dis = dvmRender(ARCHIVE, resData, resid);
          if (dis && dis.split('\n').length > 2) scriptText = dis;
        }
      } catch (e) {
        scriptText = '// disassembly failed: ' + e.message;
      }
    }
    const sv = document.getElementById('scriptView');
    if (SCRIPT_SUBN.has(subn)) {
      buildScriptView({ resid, subn, byteLength: rlen, wasDecrypted, allZero,
                        resData, scriptText: '', isScript: true });
      content = (scriptText ? scriptText + '\n\n' : '') + content;
      if (!scriptText && !content.trim()) content = 'Nothing in this resource decoded as Delver VM code.';
    } else if (sv) {
      sv.style.display = 'none'; sv.innerHTML = '';
    }
    window.LAST_DECODED = { resid, text: content || '(nothing decoded)',
                            isScript: SCRIPT_SUBN.has(subn) };
    paintDecodedPane();
    // The F0xx tables are the ones with no field map, so they get the stride
    // explorer. Everything else keeps a plain hex pane.
    const insp = document.getElementById('tableInspector');
    if (subn === 239) renderTableInspector(resid);
    else if (insp) { insp.style.display = 'none'; insp.innerHTML = ''; }
    document.getElementById('paneStrings').textContent = stringsText;
    document.getElementById('paneHex').textContent = hexText;
    document.getElementById('viewTabs').style.display = '';
    document.getElementById('tabDecoded').classList.toggle('empty', !content.trim());
    document.getElementById('tabStrings').classList.toggle('empty', stringsText.charAt(0) === '(');
    showPane('textContent');
    renderDialoguePane(resData, subn, resid);
    out.textContent = "Rendered resource 0x" + resid.toString(16).toUpperCase() +
      (wasDecrypted ? " (auto-decrypted)" : " (no decryption applied)");
    currentResid = resid;
    window.CUR_RAW_BYTES = resDataRaw;
  } catch(err) { out.textContent = "Text render error: " + err.message; }
}

// --- Readable dialogue pane -------------------------------------------
// Cythera stores dialogue as many short Pascal strings emitted by compiled
// Delver bytecode, so a single spoken line is usually split across several
// consecutive fragments. Adjacent fragments are stitched back together
// (a fragment that does not end in sentence punctuation continues into the
// next one), '*' separates alternate responses, and '@word' marks a
// conversation keyword the player can ask about.
const DIALOGUE_SUBN = new Set([0,1,3,4,7,8,9,11,12,13,15,16,19,20,23,24,25,26,27,29,47]);

function escHtml(t){ return t.replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }

function stitchDialogue(strs) {
  const lines = [];
  let cur = null;
  for (const e of strs) {
    if (cur && e.offset === cur.end) {
      cur.text += e.str; cur.end = e.offset + e.str.length + 1;
    } else {
      if (cur) lines.push(cur);
      cur = { offset: e.offset, text: e.str, end: e.offset + e.str.length + 1 };
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

/* ---------------------------------------------------------------------------
   The conversation view
   ---------------------------------------------------------------------------
   dvmConversation reads the topics straight out of the script's
   conversation_response chain (see the long note above it in delv-script.js).
   This renderer turns that structure into what the community spent 2016
   collecting by hand: keywords, responses, follow-ups, and the inheritance
   chain -- with the difference that the conditions and side effects come from
   the code, and every line still carries its in-place edit link.

   The group names below are NOT stored in the archive: subindex 8 resources
   are anonymous functions. They were identified empirically, by matching each
   resource's text against the community's verified per-group dialogue files
   (cytheraguides.com/dialogue, collected in play by BreadWorldMercy453), and
   utilities/dialogue_check.mjs re-verifies character->group chains against
   that same collection. 0x813 is the pool of tavern rumors the bartenders
   draw from. 0x803 is House Atussa: a 14-byte stub with no prompts, because
   the House is defunct -- but Sardis, Ake and Milcom (all tied to Atussa)
   still call it, which is how it was identified. 0x814 is an empty stub.
--------------------------------------------------------------------------- */
const DIALOGUE_GROUP_NAMES = {
  0x801:'Human', 0x802:'House Attis', 0x803:'House Atussa',
  0x804:'House Comana', 0x805:'House Dodona',
  0x806:'House Nicander', 0x807:'House Strymon', 0x808:'Mage', 0x809:'Land King Hall',
  0x80A:'Odemia', 0x80B:'Catamarca', 0x80C:'Pnyx', 0x80D:'Kosha', 0x80E:'Cademia',
  0x80F:'Seldane', 0x810:'Student', 0x811:'Iron Mine', 0x812:'Bartender',
  0x813:'Tavern rumors', 0x817:'Judge'
};

function conversationFor(resid) {
  if (!DERIVED.CONV_CACHE) DERIVED.CONV_CACHE = new Map();
  if (DERIVED.CONV_CACHE.has(resid)) return DERIVED.CONV_CACHE.get(resid);
  let conv = null;
  try {
    const raw = getResourceBytes(ARCHIVE, resid);
    if (raw) conv = dvmConversation(smartDecrypt(raw, resid).data, resid);
  } catch (e) { quiet(e); }
  DERIVED.CONV_CACHE.set(resid, conv);
  return conv;
}

// The engine's own rule: the first four letters of the first word typed,
// prefix-matched against the stored keyword (which may itself be shorter --
// "bye" -- or carry comma-separated alternatives -- "iron,mine").
function convKwMatches(kw, word) {
  const t = String(word || '').toLowerCase();
  return String(kw || '').toLowerCase().split(',').some(k =>
    k && (t.startsWith(k) || k.startsWith(t.slice(0, 4))));
}

function convFindEntry(entries, word) {
  for (const e of entries) {
    if (e.kw && e.kw !== '*' && convKwMatches(e.kw, word)) return e;
    const s = convFindEntry(e.sub, word);
    if (s) return s;
  }
  return null;
}

// An @word in a response is the game marking a blue keyword. Resolve it the
// way the engine would: this character first, then the groups in chain order.
function convJumpWord(resid, word) {
  const conv = conversationFor(resid);
  if (conv) {
    const hit = convFindEntry(conv.entries, word);
    if (hit) return convScrollTo(resid, hit.at);
    for (const gid of conv.groups) {
      const g = conversationFor(gid);
      if (g && convFindEntry(g.entries, word)) {
        window.PENDING_CONV_WORD = word;
        return jumpToResource(gid);
      }
    }
  }
}

function convScrollTo(resid, at) {
  const el = document.getElementById('conv-' + resid + '-' + at);
  if (!el) return;
  document.querySelectorAll('.convCard.convHit').forEach(c => c.classList.remove('convHit'));
  el.classList.add('convHit');
  el.scrollIntoView({ block: 'center' });
}

function convBadgeFor(a) {
  if (a.call !== undefined) {
    if (a.call === 0xF00) return 'learns your name';
    if (a.call === 0xE86) return 'training';
    if (a.call === 0x813) return 'a rumor from the pool';
    if ((a.call >> 8) === 8) return null;              // chain calls render in the header
    const d = typeof refDescription === 'function' ? refDescription(a.call) : null;
    return 'calls ' + (d || ('0x' + a.call.toString(16).toUpperCase()));
  }
  // AddQuest and CompleteQuest are delvmod's names for cbAddToDo and
  // cbDoneToDo: they write and strike off a line in the To Do window and
  // touch no other state, so they are not said here as "a quest".
  const M = { JoinParty: 'can join the party', LeaveParty: 'leaves the party',
    Create: 'gives something', New: 'makes something', AddQuest: 'adds a line to the To Do list',
    CompleteQuest: 'strikes a line off the To Do list', ChangeZone: 'travel', Delete: 'removes something',
    SetFlag: 'sets a status flag', SetStateFlag: 'sets a game flag',
    AddTask: null, FinishTasks: null, TakeItem: 'takes something',
    AddConversationKeyword: 'unlocks a keyword', GameOver: 'ends the game' };
  let label = M[a.sys] !== undefined ? M[a.sys] : a.sys;
  if (!label) return null;
  if (a.note && (a.sys === 'Create' || a.sys === 'New'))
    label = 'gives: ' + a.note.replace(/^.*proptype \d+ (, )?/, '').replace(/^proptype, /, '');
  return label;
}

function convTextHtml(resid, e) {
  let html = '';
  for (const t of e.text) {
    const body = escHtml(t.str)
      .replace(/@([A-Za-z][A-Za-z'-]*)/g,
        '<span class="convLink" onclick="convJumpWord(' + resid + ',\'$1\')">$1</span>');
    html += '<p class="dlgLine">' + body +
      ' <button class="linkbtn dlgEdit" onclick="editStringAt(' + resid + ',' + t.off + ')">edit</button></p>';
  }
  return html;
}

function convCardHtml(resid, e, depth) {
  const kws = e.kw === '*' ? '<span class="convKw">anything else</span>'
    : String(e.kw).split(',').map(k => '<span class="convKw">' + svEsc(k) + '</span>').join('');
  const badges = [];
  if (e.conds.length) badges.push('depends on: ' + e.conds.join(', '));
  for (const a of e.actions) { const b = convBadgeFor(a); if (b) badges.push(b); }
  let html = '<div class="convCard' + (depth ? ' convSub' : '') + '" id="conv-' + resid + '-' + e.at + '">' +
    kws + badges.map(b => '<span class="convBadge">' + svEsc(b) + '</span>').join('') +
    convTextHtml(resid, e);
  for (const s of e.sub) html += convCardHtml(resid, s, depth + 1);
  return html + '</div>';
}

function renderConversationPane(data, subn, resid) {
  let conv = null;
  try { conv = dvmConversation(data, resid); } catch (e) { quiet(e); }
  if (!conv || !conv.entries.length) return false;
  const wrap = document.getElementById('dlgWrap');
  if (!wrap) return false;
  let head = '';
  if (subn === 8) {
    const nm = window.SHOW_BUILTIN_LABELS ? DIALOGUE_GROUP_NAMES[resid] : null;
    head = nm ? 'Generic <b>' + svEsc(nm) + '</b> prompts, shared by everyone who inherits them'
              : 'Generic prompts';
  } else {
    const chain = conv.groups.map(g =>
      '<button class="sv-chip" onclick="jumpToResource(' + g + ')">' +
      svEsc((window.SHOW_BUILTIN_LABELS && DIALOGUE_GROUP_NAMES[g]) || ('0x' + g.toString(16).toUpperCase())) + '</button>').join(' ');
    head = conv.entries.length + ' topic' + (conv.entries.length === 1 ? '' : 's') +
      ', read from the code' + (chain ? ' · also answers as: ' + chain : '');
  }
  let html = '<div class="convHead">' + head + '</div>';
  // The catch-all last, whatever order the chain tests it in.
  const ordered = conv.entries.filter(e => e.kw !== '*').concat(conv.entries.filter(e => e.kw === '*'));
  for (const e of ordered) html += convCardHtml(resid, e, 0);
  wrap.innerHTML = html;
  wrap.style.display = '';
  if (window.PENDING_CONV_WORD) {
    const hit = convFindEntry(conv.entries, window.PENDING_CONV_WORD);
    window.PENDING_CONV_WORD = null;
    if (hit) setTimeout(() => convScrollTo(resid, hit.at), 0);
  }
  return true;
}

function renderDialoguePane(data, subn, resid) {
  const wrap = document.getElementById('dlgWrap');
  const toggle = document.getElementById('dlgToggle');
  const pre = document.getElementById('textContent');
  if (!wrap) return;
  // Dialogue scripts (0x18xx) and the generic-prompt archetypes (0x08xx) get
  // the structured conversation view when the extractor finds topics; the
  // twelve one-liner characters and anything the disassembler cannot follow
  // fall through to the flat string list below. Keyed off the resid, not
  // subn: this function's subn parameter is the master-index slot, which
  // runs one below the resid's high byte.
  const convSub = resid !== undefined ? (resid >> 8) : -1;
  if ((convSub === 0x18 || convSub === 0x08) && renderConversationPane(data, convSub, resid)) {
    if (toggle) { toggle.style.display = ''; toggle.textContent = 'Show Decoded / Strings / Hex'; }
    const tabs = document.getElementById('viewTabs');
    if (tabs) tabs.style.display = 'none';
    for (const id of ['textContent', 'paneStrings', 'paneHex']) {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    }
    return;
  }
  if (!DIALOGUE_SUBN.has(subn)) {
    wrap.style.display = 'none';
    if (toggle) toggle.style.display = 'none';
    pre.style.display = '';
    return;
  }
  // Container strings are already whole -- they do not need stitching, and
  // stitching them would glue unrelated lines together. Only the fragmentary
  // Pascal fallback gets stitched.
  let lines;
  const owned = (resid !== undefined) ? dvmStringObjects(ARCHIVE, data, resid) : [];
  if (owned.length) {
    lines = owned.filter(e => /[A-Za-z]{2}/.test(e.str))
                 .map(e => ({ offset: e.offset, text: e.str }));
  } else {
    lines = stitchDialogue(extractPascalStrings(data).filter(e => /[A-Za-z]{2}/.test(e.str)));
  }
  if (!lines.length) {
    wrap.style.display = 'none';
    if (toggle) toggle.style.display = 'none';
    pre.style.display = '';
    return;
  }
  let html = '';
  for (const ln of lines) {
    // '*' separates alternate/among-many responses in the same block.
    const parts = ln.text.split('*').filter(p => p.trim().length);
    parts.forEach((part, i) => {
      const body = escHtml(part)
        .replace(/@([A-Za-z][A-Za-z'-]*)/g, '<span class="dlgKw">$1</span>');
      const tag = i === 0
        ? '<span class="dlgOff">0x' + ln.offset.toString(16).padStart(4,'0') + '</span>'
        : '<span class="dlgSep">&#8226; </span>';
      // Whole stored strings are editable in place; the offset carried here
      // is where editStringAt goes looking for the Pascal length byte.
      const edit = i === 0
        ? ' <button class="linkbtn dlgEdit" onclick="editStringAt(' + resid + ',' + ln.offset + ')">edit</button>'
        : '';
      html += '<p class="dlgLine">' + tag + body + edit + '</p>';
    });
  }
  wrap.innerHTML = html;
  wrap.style.display = '';
  pre.style.display = 'none';
  if (toggle) { toggle.style.display = ''; toggle.textContent = 'Show Raw Hex / Strings'; }
}

// One pane visible at a time; a tab with nothing behind it is dimmed rather
// than hidden, so the set of views does not shift around between resources.
function showPane(id) {
  const panes = { textContent: 'tabDecoded', paneStrings: 'tabStrings', paneHex: 'tabHex' };
  for (const pid of Object.keys(panes)) {
    const pane = document.getElementById(pid), tab = document.getElementById(panes[pid]);
    if (!pane || !tab) continue;
    const on = (pid === id);
    pane.style.display = on ? '' : 'none';
    tab.classList.toggle('active', on);
  }
}

// When a dialogue pane is showing, this collapses the whole tabbed area
// rather than just the decoded pane -- hiding one pane while its tab stayed
// lit left the tab bar pointing at nothing.
function toggleRawDump() {
  const tabs = document.getElementById('viewTabs');
  const toggle = document.getElementById('dlgToggle');
  const hidden = tabs.style.display === 'none';
  tabs.style.display = hidden ? '' : 'none';
  for (const id of ['textContent','paneStrings','paneHex']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
  if (hidden) showPane('textContent');
  toggle.textContent = hidden ? 'Hide Decoded / Strings / Hex' : 'Show Decoded / Strings / Hex';
}

function downloadCurrentRawBytes() {  const bytes = window.CUR_RAW_BYTES;
  if (!bytes || currentResid == null) return;
  const subn = window.CUR_SUBN;
  const ext = (subn === 143) ? 'qtma' : 'bin';
  downloadBlob(bytes, 'cythera_0x' + currentResid.toString(16).toUpperCase() + '.' + ext);
}

// --- Editing ----------------------------------------------------------
// The first edit path this page has ever had, and deliberately the narrowest
// one that is real end to end: hex-edit one resource's plaintext, rebuild the
// ENTIRE archive through writeDelverArchive (the writer delv_write_check.mjs
// holds byte-identical to delvmod's), and re-enter through parseArchiveBytes
// as if the rebuilt file had just been opened. Rebuilding wholesale instead
// of patching ARCHIVE.bytes in place costs ~none (a 5.6 MB archive re-serializes
// in milliseconds) and buys everything: every derived cache resets, every
// gallery and map redraws from the edited bytes, and the thing on screen is
// provably the thing a download produces -- there is no second, edited-but-
// unserialized state to drift.
//
// Edits live only in ARCHIVE.bytes. The IndexedDB copy is deliberately NOT
// updated -- a reload restores the original, and "Download edited archive"
// is the way to keep work. The download is the bare data fork (.data):
// delvmod, mag.py and this page all read it directly; the resource fork the
// .hqx carried is untouched by data-fork edits and still in the original.
window.EDITED_RESIDS = new Set();

function startResourceEdit() {
  if (currentResid == null || !ARCHIVE) return;
  const raw = getResourceBytes(ARCHIVE, currentResid);
  if (!raw) { setStatus('This resource has no bytes to edit.', true); return; }
  const dec = smartDecrypt(raw, currentResid);
  let hex = '';
  for (let i = 0; i < dec.data.length; i++) {
    hex += dec.data[i].toString(16).padStart(2, '0');
    hex += (i % 16 === 15) ? '\n' : ' ';
  }
  document.getElementById('editBytesText').value = hex.trimEnd();
  document.getElementById('editBytesNote').textContent =
    'Plaintext bytes of 0x' + currentResid.toString(16).toUpperCase() +
    (dec.wasDecrypted ? ' (stored encrypted; re-encrypted on rebuild)' : '') +
    '. Whitespace is ignored; the length may change; emptying it removes the ' +
    'resource from the archive.';
  document.getElementById('editBytesWrap').style.display = '';
}

function cancelResourceEdit() {
  document.getElementById('editBytesWrap').style.display = 'none';
}

function parseHexBytes(text) {
  const clean = text.replace(/\s+/g, '');
  if (!/^[0-9a-fA-F]*$/.test(clean)) return null;
  if (clean.length % 2) return null;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
  return out;
}

function applyResourceEditFromText() {
  const bytes = parseHexBytes(document.getElementById('editBytesText').value);
  if (!bytes) { setStatus('Not hex: pairs of 0-9/a-f, whitespace ignored, even count.', true); return; }
  if (applyResourceEdit(currentResid, bytes)) cancelResourceEdit();
}

function applyResourceEdit(resid, newData) {
  const spec = delverArchiveSpec(ARCHIVE.bytes);
  if (!spec) { setStatus('The open archive did not re-parse; nothing changed.', true); return false; }
  const entry = spec.resources.find(r => r.resid === resid);
  if (!entry) { setStatus('0x' + resid.toString(16).toUpperCase() + ' is not in the archive.', true); return false; }
  if (newData.length) entry.data = newData;
  else spec.resources.splice(spec.resources.indexOf(entry), 1);
  // resetDerivedCaches clears EDITED_RESIDS along with everything else keyed
  // to the open file -- correctly, since parseArchiveBytes is also how a
  // DIFFERENT archive arrives. Carry the dirty list across this rebuild by
  // hand; it is user state, not a derived table.
  const dirty = new Set(window.EDITED_RESIDS);
  dirty.add(resid);
  const name = window.ARCHIVE_SOURCE_NAME || 'archive';
  parseArchiveBytes(writeDelverArchive(spec), name, { rsrc: window.CYTHERA_RSRC_RAW, via: 'edit' });
  window.EDITED_RESIDS = dirty;
  refreshChangesBadge();
  setStatus('Rebuilt the archive with 0x' + resid.toString(16).toUpperCase() +
    (newData.length ? ' edited' : ' removed') + ', ' + dirty.size +
    ' resource(s) changed this session. Edits live in memory only: ' +
    'Data › Cythera Data › Changes is where they leave the page.');
  showEditNotice(resid, newData.length ? 'edited' : 'removed', dirty.size);
  return true;
}
/* The status line lives in the Settings panel, so an edit made from a page
   said where it went to nobody. This line under the top row says it on the
   page, with the Changes tab a link, and goes away on its own. */
let _editNoticeTimer = null;
function showEditNotice(resid, what, count) {
  const el = document.getElementById('editNotice');
  if (!el) return;
  el.innerHTML = '0x' + resid.toString(16).toUpperCase() + ' ' + what + ' in memory, ' + count + ' resource' + (count === 1 ? '' : 's') +
    ' changed this session. ' + svLink('Changes', "showCategory('CHANGES')", 'is where an edit leaves the page');
  el.style.display = '';
  if (_editNoticeTimer) clearTimeout(_editNoticeTimer);
  _editNoticeTimer = setTimeout(() => { el.style.display = 'none'; }, 15000);
}

function downloadEditedArchive() {
  if (!ARCHIVE) return;
  const base = (window.ARCHIVE_SOURCE_NAME || 'Cythera Data')
    .replace(/\.(hqx|data|bin)$/i, '');
  dlBlob(new Blob([ARCHIVE.bytes], { type: 'application/octet-stream' }),
         safeFileName(base + ' (edited)') + '.data');
}

// --- Structured prop editing ------------------------------------------
// The first field-level editor, sitting on the seam applyResourceEdit
// opened: the map inspector's Edit chip unfolds a small form over one prop
// record, and Apply re-parses the prop list, changes just those fields,
// re-serializes it with writeDelverPropList -- which delv_write_check.mjs
// proves is the exact inverse of the parser over every record in the
// shipped archive -- and hands the bytes to applyResourceEdit. The map
// redraws from the rebuilt archive, so a moved prop visibly moves.
function togglePropEdit(propResid, index) {
  const host = document.getElementById('propEdit-' + index);
  if (!host) return;
  if (host.style.display !== 'none') { host.style.display = 'none'; host.innerHTML = ''; return; }
  const raw = getResourceBytes(ARCHIVE, propResid);
  if (!raw) { setStatus('Prop list 0x' + propResid.toString(16).toUpperCase() + ' is not readable.', true); return; }
  const rec = parseDelverPropList(smartDecrypt(raw, propResid).data)[index];
  if (!rec) return;
  const fld = (label, id, val, size) =>
    '<label>' + label + ' <input id="pe-' + index + '-' + id + '" value="' + val +
    '" size="' + (size || 5) + '" spellcheck="false"></label>';
  host.innerHTML =
    fld('type 0x', 'proptype', rec.proptype.toString(16).toUpperCase()) +
    fld('aspect', 'aspect', rec.aspect, 3) +
    '<label>rotated <input type="checkbox" id="pe-' + index + '-rotated"' + (rec.rotated ? ' checked' : '') + '></label>' +
    fld('x', 'x', rec.x, 4) + fld('y', 'y', rec.y, 4) +
    fld('flags 0x', 'flags', rec.flags.toString(16).padStart(2, '0').toUpperCase(), 3) +
    fld('d3 0x', 'd3', rec.d3.toString(16).padStart(4, '0').toUpperCase()) +
    fld('ref 0x', 'storeref', rec.storeref.toString(16).padStart(4, '0').toUpperCase()) +
    '<button class="sv-chip" onclick="applyPropEditForm(' + propResid + ',' + index + ')">Apply</button>' +
    '<div class="inspDim">x/y are the raw location word: for a carried or contained ' +
    'prop they encode the holder, not a square. Apply rebuilds the whole archive.</div>';
  host.style.display = '';
}

function applyPropEditForm(propResid, index) {
  const get = id => document.getElementById('pe-' + index + '-' + id);
  const num = (id, base, max) => {
    const v = parseInt(get(id).value, base);
    return (Number.isInteger(v) && v >= 0 && v <= max) ? v : null;
  };
  const fields = {
    proptype: num('proptype', 16, 0x3FF), aspect: num('aspect', 10, 31),
    rotated: get('rotated').checked ? 0x20 : 0,
    x: num('x', 10, 0xFFF), y: num('y', 10, 0xFFF),
    flags: num('flags', 16, 0xFF), d3: num('d3', 16, 0xFFFF),
    storeref: num('storeref', 16, 0xFFFF)
  };
  for (const [k, v] of Object.entries(fields)) {
    if (v === null) { setStatus('Bad value for ' + k + ', nothing changed.', true); return; }
  }
  applyPropRecordEdit(propResid, index, fields);
}

function applyPropRecordEdit(propResid, index, fields) {
  const raw = getResourceBytes(ARCHIVE, propResid);
  if (!raw) return false;
  const records = parseDelverPropList(smartDecrypt(raw, propResid).data);
  if (!records[index]) return false;
  Object.assign(records[index], fields);
  return applyResourceEdit(propResid, writeDelverPropList(records));
}

function downloadEditedMacBinary() {
  if (!ARCHIVE) return;
  // Both forks in one emulator-ready file: the edited data fork, and the
  // resource fork exactly as it arrived -- data-fork edits never touch it.
  // The Finder identity is whatever the container that brought the archive
  // declared (kept in ARCHIVE_FINDER), so the game recognises its own file.
  const f = window.ARCHIVE_FINDER || { name: 'Cythera Data', type: 'DelS', creator: 'Delv' };
  const bin = writeMacBinary({
    name: f.name, type: f.type, creator: f.creator,
    data: ARCHIVE.bytes, rsrc: window.CYTHERA_RSRC_RAW || new Uint8Array(0)
  });
  const base = (window.ARCHIVE_SOURCE_NAME || f.name || 'Cythera Data')
    .replace(/\.(hqx|data|bin)$/i, '');
  dlBlob(new Blob([bin], { type: 'application/macbinary' }),
         safeFileName(base + ' (edited)') + '.bin');
  const forkWarning = missingForkWarning(window.CYTHERA_RSRC_RAW);
  if (forkWarning) setStatus('Wrote the MacBinary copy, but ' + forkWarning, true);
}

/* The names on the exported disk, and the script that uses them.
   ==========================================================================

   These three constants are a contract with the retired mobile shell, which types the disk
   and the script's names at the emulated Finder to select them -- so they are
   named here rather than spelled inline, and `mobile_install_check.mjs`
   fails if the two pages stop agreeing about them.

   The script itself is the answer to "how do you install a mod without
   knowing where any window is". The Finder cannot copy a file from the
   keyboard -- there is no Copy and Paste for files in System 7 -- and every
   drag needs coordinates, which depend on the screen, the resolution and
   wherever the user last left a window. AppleScript needs none of that, and
   Mac OS 7.6 has it: a TEXT file whose creator is `ToyS` opens in Script
   Editor, and Command-R runs it.

   So the whole install is five keystroke groups with no pointer at all, which
   is what the retired mobile shell's Install button sends. It was worked out against a
   real Mac OS 7.6 and every line of the script below was compiled by it;
   three things it taught, so they are not rediscovered:

     - `try ... end try` does not compile in this AppleScript. It wants the
       `on error` clause, and says "Expected "on" but found "end"".
     - `duplicate ... with replacing` does the replace with no confirmation,
       which is what makes this one step rather than an interactive one.
     - `display dialog` compiles, so the Dialogs scripting addition is there
       and the not-found case can say so.

   The game is *found*, not named: the folder holding an application called
   "Cythera" is the one whose data gets replaced, so this works whatever the
   disk is called and whatever version folder the game sits in. */
const DISK_VOLUME_NAME = 'Cythera Export';
const DISK_SCRIPT_NAME = 'Install and Play';
const DISK_ARCHIVE_NAME = 'Cythera Data';
/* The folder the zip's contents land in inside the emulated Mac. infinite-mac
   names it after the zip itself (`parentName = file.name.slice(0, -4)`), and
   the installer this page's sibling types searches every disk for a folder of
   this name -- so the two have to agree, and
   utilities/mobile_handoff_check.mjs fails if they drift. */
const ZIP_FOLDER_NAME = 'Cythera Patch';

/* A Delver scenario without its resource fork is not a scenario the game will
   open, and nothing about the file says so until Cythera refuses it.

   Measured, in the emulator, against the real 1.0.4 Cythera Data: with its
   1,247,331-byte fork the game starts; with the identical data fork and no
   resource fork it dies on launch with

       Sorry - there has been a fatal error:Unable to open RT

   -- which names nothing a person could connect back to this page. So the
   export says it here instead.

   The fork goes missing whenever the archive arrived without one: a bare
   `.data` file dropped or picked, a `?src=` pointing at one, or a remembered
   copy saved from either. A `.hqx`, MacBinary or AppleSingle carries both,
   which is why index.html fetches the `.hqx` and not the data fork. */
function missingForkWarning(rsrc) {
  if (rsrc && rsrc.length) return null;
  return 'This archive was loaded without its resource fork, so the disk cannot ' +
         'run in the game: Cythera refuses it with “Unable to open RT”. Open the ' +
         '.hqx (or a MacBinary copy) instead of a bare data fork, and export again.';
}
