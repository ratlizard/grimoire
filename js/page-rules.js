/* The rules, read out of the scripts and the executable: what the Mechanics, Skills, Spells and Barks sheets state.

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
   last of these. File 10 of 14. */

/* ---- Entities > Mechanics ---------------------------------------------------
   The rules the scripts imply, read out of them rather than listed. Two so
   far, both worked out on 5 September 2026: the talk balloons, and the dice
   game.
   Each section is built from the open archive on the spot, so a modded file
   shows its own words and its own rules or says that it has none.

   TALK BALLOONS. A character record has a field at 0x26, delvmod's
   `talk_balloon`; a script assigns a string to it and the engine draws the
   words over the character's head, in a 128x32 rounded balloon with a tail
   (TBark in the executable). The catalogue below is every `set_field
   talk_balloon` in every script, with the string that follows it, plus
   every call of the two tavern helpers 0xC84 and 0xC85, which take a list
   of shouts and a list of replies and pick one of each. A list is a `data`
   block the disassembler does not open, so its words are the printable runs
   of its bytes -- which is what they are, length-prefixed. Who says it is
   the character whose dialogue script it is in; a line in a shared or an
   object script is anyone's. */
function buildBarkCatalogue() {
  if (window.BARKS) return window.BARKS;
  const out = [];
  const runsOf = bytes => {
    const r = []; let cur = '';
    for (const b of bytes) { if (b >= 0x20 && b < 0x7F) cur += String.fromCharCode(b); else { if (cur.length >= 3) r.push(cur); cur = ''; } }
    if (cur.length >= 3) r.push(cur);
    return r;
  };
  if (!masterIndexGlobal) return (window.BARKS = out);
  for (let subn = 0; subn < 256; subn++) {
    const mi = masterIndexGlobal[subn];
    if (!mi || !mi[0] || XREF_SKIP_SUBN.has(subn)) continue;
    const count = subindexCount(subn);
    for (let ri = 0; ri < count; ri++) {
      const resid = ((subn + 1) << 8) | ri;
      let data;
      try {
        const raw = getResourceBytes(resid);
        if (!raw || !raw.length) continue;
        data = smartDecrypt(raw, resid).data;
        if (dvmNamedScript(data)) continue;
      } catch (e) { continue; }
      let disc;
      try { disc = dvmDiscover(data, resid); } catch (e) { continue; }
      if (disc.tableOffset === null) continue;
      const offs = Object.keys(disc.kinds).map(Number).sort((x, y) => x - y);
      for (const off of offs) {
        if (disc.kinds[off] !== 'function') continue;
        let end = data.length;
        for (const o2 of offs) if (o2 > off && o2 < end) end = o2;
        let ops;
        try { ops = dvmDisassemble(data.slice(off, end), 3).ops; } catch (e) { continue; }
        // The words in the data block at ops[k]. A block is 0x45, a 16-bit
        // length, then an array header 0x90 and a count, then one 4-byte
        // entry per element whose last two bytes are the offset, within the
        // resource, of a NUL-terminated string. Read that way the words come
        // out exact; a block of another shape falls back to its printable
        // runs, which is what they are minus the odd length byte.
        const dataWords = k => {
          const at = off + ops[k][0];
          const len = u16be(data, at + 1), body = at + 3;
          if (data[body] === 0x90 && body + 2 + data[body + 1] * 4 <= at + 3 + len) {
            const n = data[body + 1], words = [];
            for (let i = 0; i < n; i++) {
              const so = u16be(data, body + 2 + i * 4 + 2);
              if (so >= data.length) continue;
              let e = so; while (e < data.length && data[e] !== 0) e++;
              const w = decodeMacRoman(data.subarray(so, e));
              if (w) words.push(w);
            }
            if (words.length) return words;
          }
          return runsOf(data.subarray(at + 1, Math.min(data.length, at + 1 + 2 + len)));
        };
        const who = subn === 23 ? ri : null;
        for (let k = 0; k < ops.length; k++) {
          const [, depth, mn, txt] = ops[k];
          if (mn === 'set_field' && /talk_balloon/.test(String(txt))) {
            // The value is the first string after the target's `end`; a
            // list is a local set from a data block a little earlier.
            // The first operand is the character; the value is what comes
            // after that operand's `end`. A leaf target (arg, local) is one
            // op and an end; a cast is two.
            let words = null, how = 'says';
            for (let j = k + 2; j < Math.min(ops.length, k + 12); j++) {
              if (ops[j - 1][2] !== 'end') continue;
              if (ops[j][2] === 'string' || ops[j][2] === 'string(implicit)') { words = [JSON.parse(ops[j][3])]; break; }
              if (ops[j][2] === 'local') {
                for (let m = k; m >= Math.max(0, k - 60); m--) if (ops[m][2] === 'data') { words = dataWords(m); how = 'one of'; break; }
              }
              break;
            }
            if (words && words.length) out.push({ resid, who, how, words });
          } else if (mn === 'call_resource' && /0xC8[45]\b|\(0xC8[45]\)/i.test(String(txt))) {
            const lists = [];
            for (let j = k + 1; j < ops.length; j++) {
              if (ops[j][1] <= depth && ops[j][2] === 'end') break;
              if (ops[j][2] === 'data') lists.push(dataWords(j));
            }
            if (lists[0] && lists[0].length) out.push({ resid, who, how: 'one of', words: lists[0], then: lists[1] || null,
              helper: /C84/i.test(String(txt)) ? 'wine' : 'food' });
          }
        }
      }
    }
  }
  return (window.BARKS = out);
}

/* THE DICE GAME. Innkeepers offer it (Parium, Crito, Apis: "a game of
   @dice"), and the game is one function in the inn's shared dialogue,
   0x812. The rules below are read from that function, and the section
   quotes the innkeeper's own explanation from the same script beside them,
   so the two can be compared. The expected value is enumerated here over
   all 216 rolls, with and without the Gambling skill (0xCF). */
/* The dice game, with its numbers read off the script rather than typed
   in. The maintainer asked what to edit to change the odds, and the answer
   is five bytes and two branch targets of 0x812, all found here from the
   listing so the sheet can name them: the three Random(0, n) ranges the
   dice are thrown with (the operand byte after each `byte 0x06`), the
   skill's own roll, the payout after "You've got a match" (`set_local 0x06`
   then `byte 0x02`), and the two `then ->` targets that gate the skill's
   fix-up -- the first on having Gambling at all, the second on the roll
   matching. A target rewritten to the next instruction turns a test into
   a fall-through, which is how "always" is spelt in bytecode. An `at` is
   an offset into the resource's plaintext, which is what Edit Bytes shows.
   The figures come from mechDiceExact over the numbers read, so an edited
   archive's sheet says what that archive pays. */
function diceGame() {
  const R = 0x812;
  const e = dvmScriptEntry(R);
  if (!e || !/three dice/.test(e.text)) return null;
  const m = /string\(implicit\) ("\\"It's very simple[^\n]*)/.exec(e.text);
  let explain = '';
  try { explain = m ? JSON.parse(m[1]) : ''; } catch (err) { explain = ''; }
  const ops = dvmOpsOf(e);
  const hex4 = n => '0x' + n.toString(16).toUpperCase().padStart(4, '0');
  // Every Random(0, n) in the script, with the op that holds the n. A
  // byte's operand is the byte after its opcode, which is what Edit Bytes
  // writes at; the link goes to the instruction.
  const rolls = dvmSeqAll(ops, [/^sys Random$/, /^byte (?:0x00|0)$/, DVM_NUM]).map(g => ({ i: ops.indexOf(g[0]), val: dvmVal(R, g[2]) }));
  // The Gambling question is GetSkill of skill 0xCF.
  const g = ops.findIndex((o, i) => o.text === 'sys GetSkill' && ops[i + 2] && /^short (?:0x00CF|207)$/i.test(ops[i + 2].text));
  const before = rolls.filter(r => g < 0 || r.i < g).slice(-3);
  const after = g < 0 ? null : rolls.find(r => r.i > g) || null;
  if (before.length < 3) return null;
  const faces = before.map(r => r.val.v);
  const byte = (what, val) => ({ what, at: val.at + 1, now: val.v, val });
  const bytes = [
    byte('faces on the innkeeper’s first die', before[0].val),
    byte('faces on your die', before[1].val),
    byte('faces on the innkeeper’s second die', before[2].val)
  ];
  // The branch that needs the skill: `then -> T` after GetSkill's `end`.
  // T equal to the next instruction's offset means no skill is needed.
  let skillFree = false, skillAlways = false;
  const branch = (from, span) => {
    for (let k = from; k < Math.min(ops.length - 1, from + span); k++) {
      const t = /^then -> (0x[0-9A-F]+)$/.exec(ops[k].text);
      if (t) return { k, target: parseInt(t[1]) };
    }
    return null;
  };
  if (g >= 0) {
    const b = branch(g, 6);
    if (b) {
      skillFree = b.target === ops[b.k + 1].at;
      bytes.push({ what: 'the test for the Gambling skill', at: ops[b.k].at + 1, now: hex4(b.target), target: true, next: ops[b.k + 1].at, val: { v: b.target, resid: R, at: ops[b.k].at } });
    }
  }
  if (after) {
    bytes.push(byte('faces on the skill’s own roll', after.val));
    // `if_not (Random == Var03) then -> T`, then `set_local 0x04`: T equal
    // to the set_local's offset means the fix-up runs whatever was rolled.
    const b = branch(after.i, 8);
    if (b) {
      const set = ops.slice(b.k + 1, b.k + 3).find(o => o.text === 'set_local 0x04');
      skillAlways = !!set && b.target === set.at;
      bytes.push({ what: 'the test that the skill’s roll matched', at: ops[b.k].at + 1, now: hex4(b.target), target: true, next: set ? set.at : null, val: { v: b.target, resid: R, at: ops[b.k].at } });
    }
  }
  // What a match pays: the number set into local 6 after the line that
  // announces it. No figure is supplied when it is not found; the game is
  // not modelled from a guess.
  const mi = ops.findIndex(o => /You've got a match/.test(o.text));
  const pay = mi < 0 ? null : dvmSeqFirst(ops.slice(mi, mi + 6), [/^set_local 0x06$/, DVM_NUM]);
  if (!pay) return null;
  const matchPay = dvmVal(R, pay[1]);
  bytes.push(byte('what a match pays', matchPay));
  const opts = { faces, matchPay: matchPay.v, skillFaces: after ? after.val.v : null, skillAlways };
  const plain = mechDiceExact(opts), skilled = mechDiceExact(Object.assign({ gambling: true }, opts));
  const total = plain.total;
  return { explain, faces, matchPay: matchPay.v, skillFaces: opts.skillFaces, skillAlways, skillFree, total, bytes, opts,
           vals: { faces: before.map(r => r.val), matchPay, skillFaces: after ? after.val : null },
           fair: plain.mean, skilled: skilled.mean,
           wins: Math.round(plain.wins * total), pushes: Math.round(plain.pushes * total), losses: Math.round(plain.losses * total) };
}
// The script's numbers for the simulator and the figures, {} when there is
// no game in the archive.
function diceOpts() { try { return (diceGame() || {}).opts || {}; } catch (e) { return {}; } }

/* ---- Components > Text > Barks ------------------------------------------
   The catalogue buildBarkCatalogue makes, as a table: who says it, the
   words, and the script it is in. A person is a chip to their dossier; a
   line in a shared or an object script is anyone's and is a chip to the
   script. The rule the lines obey is under Entities > Mechanics. */
/* ---------------------------------------------------------------------------
   Entities > Skills and Entities > Spells: each one a unit.

   The 0x1A00 block holds the spells (0x1A00-0x1A30) and, from 0x1AC0, the
   skills (Attack to Thievery) and the Do menu's commands (Estimate Time to
   Pass). A gallery of those resources was a row of script icons under
   subindex headings, which the maintainer found no way to read a skill from.
   Each card here gathers what the file says about the one thing: its own
   description (the script's text, with the game's inline "aptitude /
   training" alternative shown as one), the lines a teacher says lesson by
   lesson, who teaches it, which scripts ask whether you have it, the weapons
   swung with it, and the rule on the Mechanics sheet it takes part in.
   Spells the same way: level, cost, what it does to health, the status it
   applies. Nothing here is typed in; it is all read on the spot.
--------------------------------------------------------------------------- */
function dvmCleanText(t) {
  // The game's inline codes: 0x10 opens an alternative, 0x02+letter marks
  // each branch; the rest is style bytes. "[aptitude / training]" keeps
  // both branches visible, since which the player sees depends on level.
  let x = String(t || '');
  // The renderer writes control bytes as \uXXXX; put them back first.
  x = x.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCharCode(parseInt(h, 16)));
  x = x.replace(/\x10[^\x02]*\x02.([^\x02]*)\x02.(\S+)/g, '[$1 / $2]');
  x = x.replace(/.?0b\x03A/g, '');            // a style code: printable bytes around a control
  x = x.replace(/[^\x20-\x7E\n‘’“”—–]/g, '');
  x = x.replace(/\\+$/, '').replace(/\s*A$/, '').trim();
  return x;
}
// The description a skill or spell script returns: the strings of the
// function whose first string starts "This skill" / "This spell", or the
// one data string that does.
function dvmDescriptionOf(resid) {
  const e = buildScriptTextIndex().find(x => x.resid === resid);
  if (!e) return '';
  const ls = e.text.split('\n').map(l => l.replace(/^\s*[0-9A-F]{4}\s+/, '')).filter(Boolean);
  for (let i = 0; i < ls.length; i++) {
    const m = /^(?:string(?:\(implicit\))?|obj_[0-9A-F]+ =) "((?:This (?:skill|spell))[^"]*)"/.exec(ls[i]);
    if (!m) continue;
    if (/^obj_/.test(ls[i])) return dvmCleanText(m[1].replace(/\\n/g, ' '));
    const parts = [m[1]];
    let alt = null;   // the string after a 0x10, waiting for the string it is an alternative to
    for (let j = i + 1; j < ls.length; j++) {
      const l = ls[j];
      if (/^byte (?:0x10|16)$/.test(l)) { alt = ''; continue; }
      const sm = /^string(?:\(implicit\))? "([^"]*)"/.exec(l);
      if (sm) {
        if (alt === '') { alt = sm[1]; continue; }
        if (alt) {
          // "[aptitude / ability] to use a sword": the alternative is to the
          // first word of what follows, and the rest of it is common
          const w = /^(\S+)([\s\S]*)$/.exec(sm[1]) || [null, sm[1], ''];
          parts.push('[' + alt + ' / ' + w[1] + ']' + w[2]); alt = null; continue;
        }
        parts.push(sm[1]); continue;
      }
      if (/^(byte 0x00|end|\}|return)/.test(l)) break;
    }
    if (alt) parts.push('[' + alt + ']');
    return dvmCleanText(parts.join('').replace(/\\n/g, ' '));
  }
  return '';
}
// The other quoted strings of a skill script, in order: what a teacher says
// at each lesson, "*"-separated in the file, here as one line a lesson.
function dvmLessonLines(resid) {
  const e = buildScriptTextIndex().find(x => x.resid === resid);
  if (!e) return [];
  const out = [];
  for (const m of e.text.matchAll(/obj_[0-9A-F]+ = "((?:[^"\\]|\\.)*)"/g)) {
    const t = m[1].replace(/\\n/g, ' ').replace(/\\"/g, '"');
    if (/^This (?:skill|spell)/.test(t) || t === '*' || !t.trim()) continue;
    out.push(dvmCleanText(t));
  }
  return out;
}
const SKILL_KINDS = [[0x1AC0, 0x1AC3, 'attribute'], [0x1AC4, 0x1AC9, 'weapon'], [0x1ACA, 0x1AEF, 'special'], [0x1AF0, 0x1AFF, 'command']];
function skillKind(resid) { const k = SKILL_KINDS.find(k => resid >= k[0] && resid <= k[1]); return k ? k[2] : 'skill'; }
// Which Mechanics section a skill takes part in, by what its rule is read from.
const SKILL_RULES = { Attack: 'combat', Defense: 'combat', Sword: 'combat', Axe: 'combat', Mace: 'combat', Barehand: 'combat', Missile: 'combat', Shield: 'combat',
  Mana: 'experience', Casting: 'spells', Gambling: 'dice', Haggling: 'shops', 'Lock Picking': 'locks' };
function skillCatalogue() {
  const out = [];
  const tr = trainingRules(), sk = skillConsultations(), gear = gearTable();
  for (let r = 0x1AC0; r < 0x1B00; r++) {
    if (!refExists(r)) continue;
    const name = selfNameFor(r) || ('0x' + r.toString(16).toUpperCase());
    const id = r - 0x1A00;
    out.push({ resid: r, id, name, kind: skillKind(r),
      description: dvmDescriptionOf(r),
      lessons: dvmLessonLines(r),
      teachers: tr.teachers.filter(t => t.skills.has(id)).map(t => ({ who: t.who, resid: t.resid, mastery: !!t.skills.get(id) })),
      askedBy: [...(sk.by.get(id) || [])].sort((a, b) => a - b),
      weapons: gear.filter(g => g.skill === name) });
  }
  return out;
}
/* A link to a rules section, wherever that section's tab now is.

   Every one of these named MECHANICS until 14 September 2026, when the sheet
   became seven tabs. The id is still the target -- mechGo resolves
   `mech-<id>` -- so the only thing that had to change is which category is
   opened first, and mechGroupOf answers that off MECH_GROUPS rather than from
   a second table that could drift from it. */
function mechLink(id, label) {
  const g = mechGroupOf(id);
  const v = g ? g.value : MECH_GROUPS[0].value;
  return '<button class="navChip" onclick="showCategory(\'' + v + '\'); setTimeout(function(){ mechGo(\'' + id + '\'); }, 60)">' + svEsc(label) + '</button>';
}
/* The picture a skill or a spell wears in the game. Subindex 137 is one
   32x16 icon per class in subindex 25: icon n belongs to class 0x1A00|n,
   the same join skillNameForIcon makes the other way. Drawn once into a
   data URL per resource, like the relation chips' tile icons, and dropped
   with the other archive-keyed caches. A class with no icon gets the tab's
   own tile, so a card never goes without a picture. */
const _skillIconURLs = new Map();
function skillIconURL(resid) {
  const icon = 0x8A00 | (resid & 0xFF);
  if (_skillIconURLs.has(icon)) return _skillIconURLs.get(icon);
  let url = '';
  try {
    const raw = refExists(icon) ? getResourceBytes(icon) : null;
    const dec = raw ? decodeResource(raw, 137, icon) : null;
    if (dec && dec.W) {
      const c = document.createElement('canvas');
      drawToCanvas(c, dec.W, dec.H, dec.image, 0);
      url = c.toDataURL('image/png');
    }
  } catch (e) { url = ''; }
  _skillIconURLs.set(icon, url);
  return url;
}
function skillIconHTML(resid, tabId) {
  const url = skillIconURL(resid);
  if (url) return '<img class="skillIcon" src="' + url + '" alt="" width="32" height="16">';
  // No icon where the file has none: the tab's tile stood in until 9
  // September 2026, and it meant nothing about the skill.
  return '';
}
/* A card on the Skills, Spells and Mechanics sheets is a <details>: the
   head is its summary and the rest opens under it. They open closed, a
   filter opens what it matched, and a link into one (mechGo) opens it
   before scrolling. The chips in a head are buttons of their own, and a
   click on one runs the chip and not the toggle. */
function foldCard(id, cls, open) {
  const sec = document.createElement('details');
  sec.className = cls ? 'mechSec ' + cls : 'mechSec';
  sec.id = id;
  if (open) sec.open = true;
  return sec;
}
function renderSkillsSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  const all = skillCatalogue();
  const shown = all.filter(x => !q || x.name.toLowerCase().includes(q) || x.description.toLowerCase().includes(q));
  const box = document.createElement('div');
  box.className = 'mechView';
  // What a script asks about a skill, above the skills it asks about. This
  // was a section of the Mechanics sheet until 13 September 2026.
  try { box.appendChild(skillsMechSection()); } catch (e) {}
  const kinds = [['attribute', 'Attributes', 'The four figures every character has a number for.'],
                 ['weapon', 'Weapon skills', 'One per kind of weapon; the skill goes on the blow’s margin and its damage.'],
                 ['special', 'Special skills', 'Learned from a teacher and asked about by the scripts that need them.'],
                 ['command', 'Commands', 'The Do menu, in the same block of the file as the skills. Each is a name and a script, nothing more.']];
  const propChip = (pt, name) => '<button class="relChip" onclick="showPropTypeDetail(' + pt + ')"><span class="relText"><span class="relMain">' + svEsc(name) + '</span></span></button>';
  let count = 0;
  for (const [kind, title, note] of kinds) {
    const list = shown.filter(x => x.kind === kind);
    if (!list.length) continue;
    const h = document.createElement('div'); h.className = 'propHead'; h.innerHTML = '<span class="groupTitle">' + svEsc(title) + '</span><span class="groupNote">' + svEsc(note) + '</span>';
    box.appendChild(h);
    if (kind === 'command') {
      // A command has no lessons, no teacher and no description: a fold
      // would open on nothing, so they are one line of names.
      count += list.length;
      const d = document.createElement('div'); d.className = 'mechLede';
      d.innerHTML = list.map(x => partChip(x.name, x.resid)).join(', ');
      box.appendChild(d);
      continue;
    }
    for (const x of list) {
      count++;
      const sec = foldCard('skill-' + x.resid.toString(16), 'skillCard', !!q);
      const head = document.createElement('summary'); head.className = 'mechHead';
      head.innerHTML = skillIconHTML(x.resid, 'skills') + '<h3>' + svEsc(x.name) + '</h3><span class="mechFrom">' + partChip('the script', x.resid) + '</span>';
      sec.appendChild(head);
      if (x.description) { const p = document.createElement('p'); p.className = 'mechLede'; p.innerHTML = svEsc(x.description); sec.appendChild(p); }
      const rows = [];
      if (kind !== 'command') {
        rows.push(['Taught by', x.teachers.length ? x.teachers.map(t => (t.who !== null && loadCharacterTable()[t.who] ? characterChip(t.who) : svChip(t.resid)) + (t.mastery ? ' <span class="inspDim">to mastery</span>' : '')).join(' ') : '<span class="inspDim">no teacher in this archive</span>']);
        if (x.askedBy.length) rows.push(['Asked about by', x.askedBy.map(r => svChip(r)).join(' ')]);
        if (x.weapons.length) rows.push(['Swung with it', x.weapons.map(w => propChip(w.pt, w.name)).join(' ')]);
        const rule = SKILL_RULES[x.name];
        rows.push(['The rule', (rule ? ruleLink(rule) + ' ' : '') + mechLink('training', 'Mechanics › training')]);
      }
      if (rows.length) {
        const d = document.createElement('div'); d.className = 'mechBody';
        d.innerHTML = '<table class="vocabTable barkTable mechTable"><tbody>' + rows.map(r => '<tr><td class="skillKey">' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</tbody></table>';
        sec.appendChild(d);
      }
      // What it is made of, beside what it does. The script is already named
      // on the summary, so the strip carries the icon it wears.
      {
        const chips = skillSpellParts(x.resid);
        if (chips.length) { const p = document.createElement('div'); p.innerHTML = partsStrip('Made of', chips); sec.appendChild(p); }
      }
      if (x.lessons.length) {
        const sub = document.createElement('div'); sub.className = 'mechSub'; sub.textContent = kind === 'command' ? 'What it says' : 'What a teacher says, lesson by lesson';
        sec.appendChild(sub);
        const ol = document.createElement('ol'); ol.className = 'ruleList lessonList';
        ol.innerHTML = x.lessons.map(l => '<li>' + svEsc(l) + '</li>').join('');
        sec.appendChild(ol);
      }
      box.appendChild(sec);
    }
  }
  grid.appendChild(box);
  out.textContent = count + ' of ' + all.length + ' in the file’s skill block' + (q ? ' matching “' + q + '”' : '') + '.';
}
/* SCHEDULES. The table 0xF00B, one list per character: an hour, a byte the
   engine copies into the character's `behavior` field, a script id, a zone
   and a square. The dossier shows one character's day; this sheet shows
   everybody's, a folding card each, and every square opens the zone there.
   The behaviour byte is shown as it is stored: the scripts test it against
   small numbers (0xEA3 asks for 4, 6 and 7) and most entries carry 0x80 on
   top of one, and what that bit means is not read here. The script field
   is nearly always 0; the few that are not name a resource. */
function renderSchedulesSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  const scheds = loadSchedules();
  const box = document.createElement('div');
  box.className = 'mechView';
  const ampm = h => h === 0 ? '12am' : h < 12 ? h + 'am' : h === 12 ? '12pm' : (h - 12) + 'pm';
  const people = [];
  for (let i = 0; i < scheds.length; i++) {
    const real = scheds[i].filter(e => e.mode !== 0);
    if (!real.length) continue;
    const name = characterName(i) || ('Character ' + i);
    if (q && !name.toLowerCase().includes(q)) continue;
    people.push({ i, name, real });
  }
  people.sort((a, b) => a.name.localeCompare(b.name));
  let entries = 0;
  for (const p of people) {
    entries += p.real.length;
    const sec = foldCard('sched-' + p.i, 'skillCard', !!q);
    const head = document.createElement('summary'); head.className = 'mechHead';
    head.innerHTML = '<h3>' + svEsc(p.name) + '</h3><span class="foldGist">' + p.real.length + ' post' + (p.real.length === 1 ? '' : 's') +
      ', ' + [...new Set(p.real.map(e => zoneDisplayName(e.level)))].slice(0, 3).map(svEsc).join(', ') + '</span>' +
      '<span class="mechFrom">' + characterChip(p.i) + '</span>';
    sec.appendChild(head);
    const rows = p.real.slice().sort((a, b) => a.hour - b.hour).map(e =>
      '<tr><td class="num">' + ampm(e.hour) + '</td><td>' + svLink(zoneDisplayName(e.level) || ('zone ' + e.level), 'atlasOpenSquare(' + (0x8000 + e.level) + ',' + e.x + ',' + e.y + ')', e.x + ', ' + e.y) + '</td>' +
      '<td>' + (e.script ? (refExists(e.script) ? svLink(labelFor(e.script) || ('0x' + e.script.toString(16).toUpperCase()), 'jumpToResource(' + e.script + ')') : '0x' + e.script.toString(16).toUpperCase()) : '') + '</td>' +
      '<td class="num">0x' + e.mode.toString(16).toUpperCase().padStart(2, '0') + '</td></tr>').join('');
    const d = document.createElement('div'); d.className = 'mechBody';
    d.innerHTML = '<div class="tableScroll"><table class="vocabTable barkTable mechTable"><thead><tr><th class="num">from</th><th>where</th><th>script</th><th class="num">behaviour</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    sec.appendChild(d);
    box.appendChild(sec);
  }
  const all = document.createElement('div');
  all.className = 'foldAll';
  all.innerHTML = svLink('Open all', 'mechOpenAll(true)') + svLink('Close all', 'mechOpenAll(false)');
  box.insertBefore(all, box.firstChild);
  grid.appendChild(box);
  out.textContent = people.length + ' characters with a day in 0xF00B, ' + entries + ' posts' + (q ? ' matching “' + q + '”' : '') + '. A post holds from its hour until the next; the square opens the zone there.';
}
function renderSpellsSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  const sp = spellRules();
  const fx = spellEffects();
  const st = statusRules();
  const applies = new Map();
  for (const [nm, arr] of st.applies) for (const a of arr) (applies.get(a.resid) || applies.set(a.resid, []).get(a.resid)).push(svEsc(nm) + (a.duration !== null ? ' for ' + srcNum(a.durationVal, a.duration) : ''));
  const tgt = new Map(targetRules().map(t => [t.resid, t]));
  const spells = sp.spells.map(x => Object.assign({}, x, { description: dvmDescriptionOf(x.resid), fx: fx.get(x.resid), status: applies.get(x.resid) || [], target: tgt.get(x.resid) }))
    .sort((a, b) => a.level - b.level || a.cost - b.cost || a.name.localeCompare(b.name));
  const shown = spells.filter(x => !q || x.name.toLowerCase().includes(q) || x.description.toLowerCase().includes(q));
  const clockNow = appImage() ? exeClockRules() : null;
  const unitsNote = clockNow && clockNow.unitsPerHour ? '; ' + srcNum(clockNow.unitsPerHour) + ' is an hour' : '';
  const box = document.createElement('div');
  box.className = 'mechView';
  const intro = document.createElement('p'); intro.className = 'mechLede';
  intro.innerHTML = spells.length + ' spells, each cast through one helper with a level and a cost in magic points. A cast ' + (sp.rule && sp.rule.timing ? 'costs ' + srcNum(sp.rule.timeBase) + ' plus ' + srcNum(sp.rule.timeMult) + ' times the level in time and ' : '') + 'fails when two rolls of 0 to the caster’s Casting fall short of a roll of 0 to the level ' + cardLink('spells', 'the rules above') + '.';
  box.appendChild(intro);
  // How a cast works, above the spells it works on. This was a section of the
  // Mechanics sheet until 13 September 2026.
  try { box.appendChild(spellsMechSection()); } catch (e) {}
  let level = null, count = 0;
  for (const x of shown) {
    if (x.level !== level) { level = x.level; const h = document.createElement('div'); h.className = 'propHead'; h.innerHTML = 'Level ' + level; box.appendChild(h); }
    count++;
    const sec = foldCard('spell-' + x.resid.toString(16), 'skillCard', !!q);
    const head = document.createElement('summary'); head.className = 'mechHead';
    head.innerHTML = skillIconHTML(x.resid, 'spells') + '<h3>' + svEsc(x.name) + '</h3><span class="mechStats" style="margin:0"><span class="mechStat"><b>' + srcNum(x.levelVal) + '</b> level</span><span class="mechStat"><b>' + srcNum(x.costVal) + '</b> magic</span></span><span class="mechFrom">' + partChip('the script', x.resid) + '</span>';
    sec.appendChild(head);
    if (x.description) { const p = document.createElement('p'); p.className = 'mechLede'; p.innerHTML = svEsc(x.description); sec.appendChild(p); }
    const rows = [];
    if (x.fx) {
      for (const d of x.fx.damage) rows.push(['Damage', '<b>' + srcNum({ resid: x.resid, at: d.at }, amountWords(d.amount) || 'an amount the script works out') + '</b> ' + (d.type !== null ? damageTypeName(d.type) : '') + ' to ' + d.who]);
      for (const h of x.fx.heals) rows.push(['Heals', '<b>' + srcNum({ resid: x.resid, at: h.at }, h.text) + '</b>']);
    }
    if (x.status.length) rows.push(['Applies', x.status.join(', ') + ' <span class="inspDim">(clock units' + (unitsNote || '') + ')</span>']);
    if (x.target) rows.push(['Cast on', targetWordWords(x.target.word).map(svEsc).join(', ') + ' ' + srcNum(x.target.val, propWordHex(x.target.word)) +
      ((x.target.word & 0x8000) ? ' <span class="inspDim">(a neighbour)</span>' : '')]);
    if (!rows.length) rows.push(['Does', '<span class="inspDim">something other than health: the light, a lock, a rune, the map, or a look</span>']);
    const d = document.createElement('div'); d.className = 'mechBody';
    d.innerHTML = '<table class="vocabTable barkTable mechTable"><tbody>' + rows.map(r => '<tr><td class="skillKey">' + r[0] + '</td><td>' + r[1] + '</td></tr>').join('') + '</tbody></table>';
    sec.appendChild(d);
    // The same strip the skills carry: the icon it wears, the script being
    // already named on the summary.
    {
      const chips = skillSpellParts(x.resid);
      if (chips.length) { const p = document.createElement('div'); p.innerHTML = partsStrip('Made of', chips); sec.appendChild(p); }
    }
    box.appendChild(sec);
  }
  grid.appendChild(box);
  out.textContent = count + ' of ' + spells.length + ' spells' + (q ? ' matching “' + q + '”' : '') + '.';
}

function renderBarksSheet() {
  stopAllViewActivity();
  const grid = document.getElementById('sheetGrid');
  const out = document.getElementById('output');
  grid.style.display = '';
  grid.innerHTML = '';
  document.getElementById('singleControls').style.display = 'none';
  const barks = buildBarkCatalogue();
  const q = (window.PROP_FILTER || '').trim().toLowerCase();
  const shown = barks.filter(b => !q || b.words.concat(b.then || []).some(w => w.toLowerCase().includes(q)) ||
    (b.who !== null && characterName(b.who).toLowerCase().includes(q)));
  const rows = [];
  for (const b of shown) {
    const who = b.who !== null && loadCharacterTable()[b.who] ? characterChip(b.who)
      : '<span class="inspDim">anyone, </span>' + svChip(b.resid);
    const words = b.words.map(w => '“' + svEsc(w) + '”').join(', ');
    rows.push('<tr><td>' + who + '</td><td>' + (b.how === 'one of' ? '<span class="inspDim">one of</span> ' : '') + words +
      (b.then && b.then.length ? '<div class="inspDim">then, when the ' + b.helper + ' comes: ' + b.then.map(w => '“' + svEsc(w) + '”').join(', ') + '</div>' : '') +
      '</td><td>' + (b.who !== null ? svChip(b.resid) : '') + '</td></tr>');
  }
  const scroll = document.createElement('div');
  scroll.className = 'tableScroll';
  scroll.innerHTML = rows.length
    ? '<table class="vocabTable barkTable"><thead><tr><th>who</th><th>says</th><th>where</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>'
    : '<div class="changesNote">' + (barks.length ? 'Nothing matches the filter.' : 'No script in this archive sets a talk balloon.') + '</div>';
  // How a balloon works, above the lines themselves. This was a section of
  // the Mechanics sheet until 13 September 2026.
  mechCardAboveGallery(grid, balloonsMechSection);
  grid.appendChild(scroll);
  const distinct = new Set(barks.flatMap(b => b.words.concat(b.then || []))).size;
  out.textContent = barks.length
    ? barks.length + ' places in the scripts put a line over a character’s head, ' + distinct + ' distinct lines' +
      (q ? '; ' + shown.length + ' shown' : '') + '. How the balloon works is in the card above.'
    : 'No script in this archive sets a talk balloon.';
}

/* WEAPONS AND ARMOUR. Every item class script carries a keyed table
   (parseItemClass, ITEM_FIELD_INFO), and the combat keys 0x2A-0x2F are
   the weapon, ammunition, armour and shield parameters. Armour's one
   number is points of protection, which the wiki establishes; the others
   are not published anywhere, so the table shows them as stored and says
   the one thing the data itself shows: the first melee number orders the
   weapons as their damage would. */
function gearTable() {
  const rows = [];
  for (let pt = 1; pt < 512; pt++) {
    const cls = parseItemClass(pt);
    if (!cls) continue;
    const f = k => { const e = cls.data.find(x => x.key === k); return e ? e.words.map(w => (w & 0xF0000000) ? null : (w & 0x0FFFFFFF)) : null; };
    // Where each entry sits in the class script, for the table's links.
    const at = k => { const e = cls.data.find(x => x.key === k); return e ? { resid: cls.resid, at: e.off } : null; };
    const melee = f(0x2A), thrown = f(0x2B), armour = f(0x2C), ammo = f(0x2D), ranged = f(0x2E), shield = f(0x2F);
    if (!(melee || thrown || armour || ammo || ranged || shield)) continue;
    const skillName = id => (id !== null && id !== undefined && refExists(0x1A00 + id) && selfNameFor(0x1A00 + id)) || (id !== null && id !== undefined ? 'skill ' + id : '');
    rows.push({ pt, name: propDisplayName(pt) || ('prop 0x' + pt.toString(16)), weight: itemWeight(pt),
      melee, thrown, armour, ammo, ranged, shield,
      damage: melee ? melee[0] : thrown ? thrown[0] : ammo ? ammo[1] : null,
      thrownDamage: thrown ? thrown[0] : null, thrownRange: thrown ? thrown[1] : null,
      reach: melee ? melee[1] : thrown ? thrown[1] : ranged ? ranged[1] : null,
      type: melee ? melee[2] : ammo ? ammo[2] : null,
      skill: melee ? skillName(melee[3]) : shield ? skillName(shield[1]) : '',
      ammoClass: ranged ? ranged[0] : ammo ? ammo[0] : null,
      block: shield ? shield[0] : null, protection: armour ? armour[0] : null,
      src: { weight: at(0x24), damage: melee ? at(0x2A) : thrown ? at(0x2B) : ammo ? at(0x2D) : null, thrown: at(0x2B),
             reach: melee ? at(0x2A) : thrown ? at(0x2B) : ranged ? at(0x2E) : null, type: melee ? at(0x2A) : ammo ? at(0x2D) : null,
             ammoClass: ranged ? at(0x2E) : ammo ? at(0x2D) : null, block: at(0x2F), protection: at(0x2C) } });
  }
  return rows;
}

/* WHAT EACH SKILL IS CONSULTED FOR. A script asks `GetSkill(who, skill)`;
   where the skill is a constant the question is about that skill -- the
   dice game asks about Gambling -- and where it is an argument the script
   is a helper that checks whichever skill it is handed. Skill n's own
   script is 0x1A00 + n, which is where its name comes from. */
function skillConsultations() {
  const by = new Map(); let generic = 0;
  for (const e of buildScriptTextIndex()) {
    const lines = e.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/sys GetSkill\b/.test(lines[i])) continue;
      // Either spelling: the listing renders a plain number in decimal now,
      // and did so in hex before. Matching one alone would quietly stop
      // finding skills the day the other is used.
      const m = /short (?:0x([0-9A-F]{4})|(\d+))\b/i.exec((lines[i + 1] || '') + ' ' + (lines[i + 2] || ''));
      if (!m) { generic++; continue; }
      const id = m[1] !== undefined ? parseInt(m[1], 16) : parseInt(m[2], 10);
      if (!by.has(id)) by.set(id, new Set());
      by.get(id).add(e.resid);
    }
  }
  return { by, generic };
}

/* KARMA. A global the scripts add to and subtract from, read here as
   every write: a literal step, a call of the two helpers 0xF11 (down) and
   0xF12 (up), the assignment at creation, and one table of steps by the
   victim's alignment when something is killed (0xE8D: a data block of
   28-bit words, read as signed). The reads are the thresholds. */
function karmaRules() {
  const writes = [], reads = [];
  const val = t => { const m = /(byte|short|word) (0x[0-9A-F]+|\d+)/i.exec(t || ''); return m ? parseInt(m[2]) : null; };
  for (const e of buildScriptTextIndex()) {
    const lines = e.text.split('\n');
    // The occasion: the nearest line the script prints, looking back first
    // (the deed is usually said before its price) and then ahead.
    const near = i => {
      const grab = j => { const m = /string(?:\(implicit\))? "(.{3,90}?)(?:\\n)?"/.exec(lines[j] || ''); return m ? m[1].replace(/\\"/g, '"').replace(/\*/g, ' ').trim() : ''; };
      for (let j = i - 1; j >= Math.max(0, i - 7); j--) { const t = grab(j); if (t) return t; }
      for (let j = i; j < Math.min(lines.length, i + 8); j++) { const t = grab(j); if (t) return t; }
      return '';
    };
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/set_global Karma/.test(l)) {
        const a = lines[i + 1] || '', b = lines[i + 2] || '', c = lines[i + 3] || '';
        if (/global Karma/.test(a) && /\b(add|sub)\b/.test(c)) {
          const n = val(b);
          if (n !== null) writes.push({ resid: e.resid, change: (/sub/.test(c) ? -n : n), val: dvmValAtLine(e, i + 2), note: near(i + 4) });
          else if (/local|index/.test(b) || /index/.test(c)) writes.push({ resid: e.resid, change: null, note: near(i + 4), why: 'by an amount the script works out' });
        } else if (val(a) !== null && !/global Karma/.test(a)) writes.push({ resid: e.resid, set: val(a), val: dvmValAtLine(e, i + 1), note: near(i + 2) });
      } else if (/call_resource 0xF1[12]\b/.test(l)) {
        const n = val(lines[i + 1]); const down = /0xF11/.test(l);
        writes.push({ resid: e.resid, change: n === null ? null : (down ? -n : n), val: n === null ? null : dvmValAtLine(e, i + 1), note: near(i + 2), why: n === null ? (down ? 'down by an amount the script works out' : 'up by an amount the script works out') : '' });
      } else if (/global Karma/.test(l) && !/set_global/.test(l) && /(lt|gt|le|ge|eq)\b/.test(lines[i + 2] || '')) {
        const n = val(lines[i + 1]);
        if (n !== null) reads.push({ resid: e.resid, test: (/lt|le/.test(lines[i + 2]) ? 'below ' : 'above ') + n, below: /lt|le/.test(lines[i + 2]), n, val: dvmValAtLine(e, i + 1), note: near(i + 3) });
      }
    }
  }
  // The kill table: 0xE8D's data block, indexed by the victim's alignment.
  let byAlignment = null, byAlignmentSrc = null;
  try {
    const raw = getResourceBytes(0xE8D);
    const d = raw ? smartDecrypt(raw, 0xE8D).data : null;
    if (d) for (let i = 0; i + 5 < d.length; i++) {
      if (d[i] === 0x45 && d[i + 3] === 0x90 && d[i + 4] >= 2 && d[i + 4] <= 8 && u16be(d, i + 1) === 2 + d[i + 4] * 4) {
        byAlignment = [];
        for (let k = 0; k < d[i + 4]; k++) { let w = u32be(d, i + 5 + k * 4) & 0x0FFFFFFF; if (w & 0x08000000) w -= 0x10000000; byAlignment.push(w); }
        byAlignmentSrc = { resid: 0xE8D, at: i };   // the data block's own line
        break;
      }
    }
  } catch (e) { byAlignment = null; }
  return { writes, reads, byAlignment, byAlignmentSrc };
}

/* EXPERIENCE AND LEVELS. One helper, GainExp (0xE8B), takes every award:
   it adds, caps at 65535, and raises the level by one when experience
   passes 100 x 2^(level-1). AdjCharLevel (0xE86) then recomputes full
   health -- body + reflex/2 + level, plus Defense x 5 x reflex / 15, Defense
   being the skill where the character has it and otherwise a class figure
   of nothing, half the level, the level or twice it (0xE95) -- and full
   magic as mind + Mana the same way (0xE83, 0xE96). The damage helper
   0xEB8 awards the attacker the damage dealt, up to the victim's level
   above theirs plus one; a shared award (0xE8E) is split across the party.
   The fixed awards are every GainExp with a constant. */
function experienceRules() {
  const idx = buildScriptTextIndex();
  const gain = dvmScriptEntry(0xE8B);
  let rule = null;
  if (gain) {
    const go = dvmOpsOf(gain);
    // exp + award < cap, and exp > (1 << (level - less)) * base.
    const cap = dvmSeqFirst(go, [/^add$/, DVM_NUM, /^lt$/]);
    const dbl = dvmSeqFirst(go, [DVM_NUM, /^arg Arg00$/, /^get_field level/, DVM_NUM, /^sub$/, /^left_shift$/, DVM_NUM, /^mul$/]);
    // Full health off 0xE82: body + reflex / a + level + skill x b x reflex / c.
    const fh = dvmScriptEntry(0xE82) ? dvmOpsOf(dvmScriptEntry(0xE82)) : [];
    const half = dvmSeqFirst(fh, [/^get_field reflex/, DVM_NUM, /^div$/]);
    const def = dvmSeqFirst(fh, [/^local Var\w+$/, DVM_NUM, /^mul$/, /^arg Arg00$/, /^get_field reflex/, /^mul$/, DVM_NUM, /^div$/]);
    // What a blow earns, off the damage helper 0xEB8: the level gap plus
    // this, and this for a blow past the gap the other way.
    const eb = dvmScriptEntry(0xEB8) ? dvmOpsOf(dvmScriptEntry(0xEB8)) : [];
    const gap = dvmSeqFirst(eb, [/^get_field level/, /^local Var\w+$/, /^get_field level/, /^sub$/, DVM_NUM, /^add$/]);
    const past = dvmSeqAll(eb, [/^call_resource GainExp\b/, /^local Var\w+$/, DVM_NUM, /^end$/])[0] || null;
    rule = { cap: cap ? dvmVal(0xE8B, cap[1]) : null, doubling: !!dbl, base: dbl ? dvmVal(0xE8B, dbl[6]) : null, less: dbl ? dvmVal(0xE8B, dbl[3]) : null,
             healthReflexDiv: half ? dvmVal(0xE82, half[1]) : null, healthMul: def ? dvmVal(0xE82, def[1]) : null, healthDiv: def ? dvmVal(0xE82, def[6]) : null,
             gapAdd: gap ? dvmVal(0xEB8, gap[4]) : null, pastGap: past ? dvmVal(0xEB8, past[2]) : null };
  }
  const awards = [];
  for (const e of idx) {
    const lines = e.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (!/call_resource GainExp\b/.test(lines[i])) continue;
      const m = /(byte|short|word) (0x[0-9A-F]+|\d+)/i.exec(lines[i + 2] || '');
      if (!m) continue;
      let note = '';
      for (let j = i - 1; j >= Math.max(0, i - 8) && !note; j--) { const t = /string(?:\(implicit\))? "(.{3,90}?)(?:\\n)?"/.exec(lines[j]); if (t) note = t[1].replace(/\\"/g, '"').replace(/\*/g, ' ').trim(); }
      for (let j = i + 3; j < Math.min(lines.length, i + 10) && !note; j++) { const t = /string(?:\(implicit\))? "(.{3,90}?)(?:\\n)?"/.exec(lines[j]); if (t) note = t[1].replace(/\\"/g, '"').replace(/\*/g, ' ').trim(); }
      awards.push({ resid: e.resid, amount: parseInt(m[2]), note, val: dvmValAtLine(e, i + 2) });
    }
  }
  return { rule, awards };
}

/* FOOD AND POTIONS. A potion's aspect picks its effect: the potion class
   (0x101F) calls 0xA00 + aspect, and its own text names the eight, so the
   names line up with the eight effect scripts, each read for what it sets,
   clears or applies. A food's Use method adds to nutrition: a constant,
   or for the general foodstuff class a value per variant from a data
   block, the variant being named by its tile. */
// `entry` is a script's index entry. Each thing done carries the offset of
// the instruction that does it, so the table can link it (`effects`);
// `does` is the same words as plain strings.
function effectSummary(entry) {
  const text = entry.text, ops = dvmOpsOf(entry);
  const out = [];
  const lines = text.split('\n').map(l => l.replace(/^\s*[0-9A-F]{4}\s+/, ''));   // offsets off, so runs of ops match
  const at = i => { const o = dvmOpAtLine(entry, i); return o ? { resid: entry.resid, at: o.at } : null; };
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i], next = lines.slice(i + 1, i + 12).join(' ');
    if (/set_field nutrition/.test(l)) { const m = /byte (0x[0-9A-F]+)/i.exec(next); if (m) out.push({ text: 'nutrition set to ' + parseInt(m[1]), src: at(i), field: 'nutrition', set: parseInt(m[1]) }); }
    else if (/set_field health/.test(l)) { const m = /byte (0x[0-9A-F]+)[\s\S]*?add[\s\S]*?sys Random\s+byte (0x[0-9A-F]+)\s+byte (0x[0-9A-F]+)/i.exec(next); out.push({ text: m ? 'health +' + parseInt(m[1]) + ' plus ' + rollWords([parseInt(m[2]), parseInt(m[3])]) : 'health changed', src: at(i) }); }
    else if (/set_field magic \(/.test(l) && !/full_magic/.test(l)) out.push({ text: 'magic restored', src: at(i) });
    else if (/sys ClearFlag/.test(l)) { const m = /flag: ([a-z\/ -]+)/.exec(lines[i + 2] || ''); if (m) out.push({ text: 'clears ' + m[1].trim(), src: at(i) }); }
    else if (/sys StatusEffect/.test(l)) {
      const m = /flag: ([a-z\/ -]+)/.exec(lines[i + 2] || '');
      const c = /byte (0x[0-9A-F]+)\s+byte (0x[0-9A-F]+)\s+sys Random\s+byte (0x[0-9A-F]+)\s+byte (0x[0-9A-F]+)/i.exec(lines.slice(i + 3, i + 9).join(' '));
      out.push({ text: (m ? m[1].trim() : 'a status') + (c ? ' for ' + parseInt(c[1]) + ' plus ' + parseInt(c[2]) + ' times ' + rollWords([parseInt(c[3]), parseInt(c[4])]) : ''), src: at(i) });
    }
    else if (/sys SpecialView/.test(l)) { const m = /byte (0x[0-9A-F]+)/i.exec(next); out.push({ text: 'a special view' + (m ? ' (' + parseInt(m[1]) + ')' : ''), src: at(i) }); }
  }
  const said = /string\(implicit\) "([^"\\]{3,80})/.exec(text);
  const effects = out.filter((x, i) => out.findIndex(y => y.text === x.text) === i);
  return { does: effects.map(x => x.text), effects, says: said ? said[1] : '' };
}
function foodRules() {
  const idx = buildScriptTextIndex();
  const potion = idx.find(e => e.resid === 0x101F);
  const names = potion ? [...potion.text.matchAll(/\/\/\s+\+0x[0-9A-F]+: "([^"]+ Potion)"/g)].map(m => m[1]) : [];
  const potions = [];
  for (let n = 0; n < 8; n++) {
    const fx = idx.find(e => e.resid === 0xA00 + n);
    if (!fx) continue;
    potions.push(Object.assign({ resid: 0xA00 + n, name: names[n] || ('potion ' + n) }, effectSummary(fx)));
  }
  // Foods: every item class whose code sets nutrition.
  const foods = [];
  const tiles = getPropTileList();
  for (const e of idx.filter(e => e.subn === 15)) {
    if (!/set_field nutrition/.test(e.text)) continue;
    const pt = e.resid - 0x1000;
    const name = propDisplayName(pt) || ('prop 0x' + pt.toString(16));
    const lines = e.text.split('\n').map(l => l.replace(/^\s*[0-9A-F]{4}\s+/, ''));
    const i = lines.findIndex(l => /set_field nutrition/.test(l));
    const after = lines.slice(i, i + 14).join(' ');
    const flat = /byte (0x[0-9A-F]+)\s+add/i.exec(after);
    if (flat && !/index/.test(after)) {
      // The number's own line: the first constant then `add` after the write.
      const fo = dvmOpsOf(e), wi = fo.findIndex(o => /^set_field nutrition/.test(o.text));
      const g = wi < 0 ? null : dvmSeqFirst(fo.slice(wi, wi + 14), [DVM_NUM, /^add$/]);
      foods.push({ pt, name, plus: parseInt(flat[1]), val: g ? dvmVal(e.resid, g[0]) : null });
      continue;
    }
    if (/index[\s\S]*?byte (0x[0-9A-F]+)\s+mul/i.test(after)) {
      // A value per variant, from the data block: 0x45, length, 0x90, count, then 4-byte words.
      const mul = parseInt(/index[\s\S]*?byte (0x[0-9A-F]+)\s+mul/i.exec(after)[1]);
      let table = null, tableSrc = null;
      try {
        const raw = getResourceBytes(e.resid); const d = smartDecrypt(raw, e.resid).data;
        for (let k = 0; k + 5 < d.length; k++) if (d[k] === 0x45 && d[k + 3] === 0x90 && u16be(d, k + 1) === 2 + d[k + 4] * 4) {
          table = []; for (let q = 0; q < d[k + 4]; q++) table.push(u32be(d, k + 5 + q * 4) & 0x0FFFFFFF);
          tableSrc = { resid: e.resid, at: k };   // the data block's line
          break;
        }
      } catch (err) { table = null; }
      const base = tiles[pt];
      // The line the eater says: one string for every variant, or a table
      // of strings indexed by the aspect like the nutrition is.
      let says = '', saysPer = null;
      const balloon = /set_field talk_balloon[\s\S]{0,160}?(?=set_field nutrition)/.exec(lines.join(' '));
      if (balloon) {
        const c = /string "([^"]*)"/.exec(balloon[0]);
        if (/get_field aspect(?: \(0x[0-9A-F]+\))?\s+index/.test(balloon[0])) {
          try {
            const raw = getResourceBytes(e.resid); const d = smartDecrypt(raw, e.resid).data;
            // The block is 0x45, a length, 0x90, a count, then drefs
            // (0x80000000 | resid << 16 | offset) back into this resource,
            // each at a string.
            for (let k = 0; k + 6 < d.length && !saysPer; k++) {
              if (d[k] !== 0x45 || d[k + 3] !== 0x90) continue;
              const n = d[k + 4], strs = [];
              for (let q = 0; q < n; q++) { const p = k + 5 + q * 4; if (p + 4 > d.length) break; const wv = u32be(d, p); if (!(wv & 0x80000000) || ((wv & 0x7FFF0000) >>> 16) !== e.resid) break; const v = dvmDataValue(d, wv & 0xFFFF); if (typeof v !== 'string') break; strs.push(v); }
              if (n && strs.length === n) saysPer = strs;
            }
          } catch (err) { saysPer = null; }
        } else if (c) says = c[1];
      }
      const variants = table ? table.map((v, a) => ({ aspect: a, name: base !== undefined ? (terrainNameFor(base + a) || '') : '', plus: v * mul, src: tableSrc, says: saysPer ? (saysPer[a] || '') : says })) : [];
      foods.push({ pt, name, variants, mul, says, saysPer: !!saysPer });
      continue;
    }
    foods.push({ pt, name, plus: null });
  }
  return { potions, foods };
}

/* STATUS EFFECTS. Every StatusEffect call, by flag -- the disassembler
   names the flags (DVM_FLAG_NAMES) -- with the duration the call gives and
   who gives it: a spell, a trap, a potion, a place. And every ClearFlag,
   which is what cures. The unit of a duration is the engine's; only the
   numbers are the scripts'. */
function statusRules() {
  const applies = new Map(), cures = new Map();
  for (const e of buildScriptTextIndex()) {
    const lines = e.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/sys StatusEffect/.test(l)) {
        const f = /flag: ([a-z\/ -]+)/.exec(lines[i + 2] || '');
        const nm = f ? f[1].trim() : (/byte (0x[0-9A-F]+)/i.exec(lines[i + 2] || '') ? 'flag ' + parseInt(/byte (0x[0-9A-F]+)/i.exec(lines[i + 2])[1]) : 'a status');
        const d = /(?:word|short|byte) (0x[0-9A-F]+|\d+)/i.exec(lines[i + 3] || '');
        // A duration with a roll in it is reported as computed, not as its base.
        const dur = d && !/sys Random/.test(lines.slice(i + 4, i + 9).join(' ')) ? parseInt(d[1]) : null;
        if (!applies.has(nm)) applies.set(nm, []);
        applies.get(nm).push({ resid: e.resid, duration: dur, durationVal: dur !== null ? dvmValAtLine(e, i + 3) : null,
                               at: (dvmOpAtLine(e, i) || {}).at });
      } else if (/sys ClearFlag/.test(l)) {
        const f = /flag: ([a-z\/ -]+)/.exec(lines[i + 2] || '');
        if (!f) continue;
        const nm = f[1].trim();
        if (!cures.has(nm)) cures.set(nm, new Set());
        cures.get(nm).add(e.resid);
      }
    }
  }
  return { applies, cures };
}

/* ---- a number read off a script, and where it was read -------------------
   The Mechanics sheet states rules with numbers in them, and until
   11 September 2026 most of those numbers were typed into the sentence
   behind a pattern that checked the script still said them: "capped at
   65,535" was printed because /word 65535/ matched. A number the code keeps
   its own copy of is one an edited archive silently contradicts and one a
   reader has no way to check, so the numbers are read now, each with the
   offset of the instruction that holds it, and the sheet prints each as a
   link that opens the script ringed at that line (srcNum, jumpToScriptAt).

   The listing is dvmRender's, as buildScriptTextIndex caches it. A line's
   offset there counts from the start of its object -- dvmDisassemble is
   handed the object's own bytes -- while a branch target is the resource's,
   so the object's start, from its `function obj_XXXX(` header, is added
   back. `at` is then an offset in the resource's plaintext, which is what a
   branch, Edit Bytes and the link all mean by one. */
let _dvmEntryIndex = { src: null, byId: new Map() };
function dvmScriptEntry(resid) {
  const all = buildScriptTextIndex();
  if (_dvmEntryIndex.src !== all) _dvmEntryIndex = { src: all, byId: new Map(all.map(e => [e.resid, e])) };
  return _dvmEntryIndex.byId.get(resid) || null;
}
// Every instruction line of a listing: its resource offset, its object's
// start, its nesting, and its text without the offset (`byte 0x04`).
function dvmOpsOf(entry) {
  if (!entry) return [];
  if (entry.ops) return entry.ops;
  const ops = [];
  let base = 0;
  const lines = entry.text.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const h = /^(?:function )?obj_([0-9A-F]{4})\b/.exec(lines[li]);
    if (h) { base = parseInt(h[1], 16); continue; }
    const m = /^  ([0-9A-F]{4})  ((?:    )*)(\S+)(?: (.*))?$/.exec(lines[li]);
    if (!m) continue;
    // The disassembler's annotations (`byte 0x09  // flag: poison`) are kept
    // apart, so an operand with one still reads as a number. A quoted
    // string cannot hold one: the `//` would be inside the quotes.
    const whole = m[3] + (m[4] !== undefined ? ' ' + m[4] : '');
    const c = /^string/.test(m[3]) ? null : /^(.*?)\s+\/\/\s*(.*)$/.exec(whole);
    ops.push({ at: base + parseInt(m[1], 16), obj: base, line: li, depth: m[2].length / 4,
               mn: m[3], text: c ? c[1] : whole, note: c ? c[2] : '' });
  }
  return (entry.ops = ops);
}
// The instruction on line `li` of a listing, for a reader that walks the
// text by line: its number with where it was read, or null.
function dvmOpAtLine(entry, li) {
  if (!entry) return null;
  if (!entry.opByLine) entry.opByLine = new Map(dvmOpsOf(entry).map(o => [o.line, o]));
  return entry.opByLine.get(li) || null;
}
function dvmValAtLine(entry, li) {
  const op = dvmOpAtLine(entry, li);
  return op ? dvmVal(entry.resid, op) : null;
}
// A constant operand as a number, or null (`word True` is not one).
const DVM_NUM = /^(?:byte|short|word) (?:-?0x[0-9A-F]+|-?\d+)$/i;
function dvmNum(op) {
  const m = op && /^(byte|short|word) (-?0x[0-9A-F]+|-?\d+)$/i.exec(op.text);
  if (!m) return null;
  let v = parseInt(m[2]);
  // `word` already arrives signed, through dvmWord's 28-bit reading. A byte
  // and a short do not: they are shown as the bytes they are, and the
  // interpreter sign-extends both before using them (see the literal branch
  // of dvmDisassemble). 49 byte and 2 short literals in the shipped archive
  // have the high bit set, across 39 script resources; the zone light levels
  // are eighteen of them.
  const w = m[1].toLowerCase();
  if (w === 'byte' && v > 0x7F) v -= 0x100;
  if (w === 'short' && v > 0x7FFF) v -= 0x10000;
  return v;
}
// The number an instruction pushes, with where: { v, resid, at }.
function dvmVal(resid, op) {
  const v = dvmNum(op);
  return v === null ? null : { v, resid, at: op.at };
}
// The ops from `i` that match `pat` one for one: each element a RegExp
// tested against an op's text, or null for any single op. The matched ops,
// or null.
function dvmSeq(ops, i, pat) {
  if (i < 0 || i + pat.length > ops.length) return null;
  const got = [];
  for (let k = 0; k < pat.length; k++) {
    const op = ops[i + k];
    if (pat[k] && !pat[k].test(op.text)) return null;
    got.push(op);
  }
  return got;
}
function dvmSeqFirst(ops, pat, from) {
  for (let i = from || 0; i < ops.length; i++) { const g = dvmSeq(ops, i, pat); if (g) return g; }
  return null;
}
function dvmSeqAll(ops, pat) {
  const out = [];
  for (let i = 0; i < ops.length; i++) { const g = dvmSeq(ops, i, pat); if (g) out.push(g); }
  return out;
}
// The first match in a script, by resource id, as a convenience.
function dvmSeqIn(resid, pat) { return dvmSeqFirst(dvmOpsOf(dvmScriptEntry(resid)), pat); }

/* A number the sheet read, as a link to the line that holds it. `text` is
   what is printed when that is not the operand itself -- "29" for a
   `Random(0, 30)`, "65,535" for `word 65535`. A value that was not read
   prints as plain text, so a sentence never shows a link to nowhere. */
function srcNum(val, text) {
  const shown = text === undefined || text === null ? (val ? String(val.v) : '') : String(text);
  // A figure read out of the application's code opens its routine instead.
  if (val && typeof val.exe === 'number') {
    const r = exeRoutineAt(val.exe);
    return '<button class="svLink srcNum" onclick="jumpToExeAt(' + val.exe + ')" title="' + svEsc((r ? r.name + ', ' : '') + 'code 0x' + val.exe.toString(16).toUpperCase().padStart(6, '0')) + '">' + svEsc(shown) + '</button>';
  }
  if (!val || typeof val.resid !== 'number' || typeof val.at !== 'number') return svEsc(shown);
  return '<button class="svLink srcNum" onclick="jumpToScriptAt(' + val.resid + ',' + val.at + ')" title="' +
    propWordHex(val.resid) + ' at ' + propWordHex(val.at) + '">' + svEsc(shown) + '</button>';
}
// A table cell holding one.
function srcCell(val, text) {
  return '<td class="num">' + (val || (text !== undefined && text !== null && text !== '') ? srcNum(val, text) : '') + '</td>';
}

/* Open a script with one line ringed and in view. The resource view is
   jumpToResource's; a conversation opens on its dialogue, so the listing
   is brought out from behind the toggle. The ring is painted by
   paintDecodedPane from LISTING_AT, which jumpToResource clears, so it
   belongs to this one jump and to no later visit of the same script. The
   scroll waits a beat because setMode puts a detail view at the top of
   the page on a timeout of its own. */
window.LISTING_AT = null;
function jumpToScriptAt(resid, at) {
  if (window.CUR_SUBN === 'MECHANICS' || MECH_GROUP_BY_VALUE[window.CUR_SUBN]) mechKeepPlace();
  if (!jumpToResource(resid)) return false;
  window.LISTING_AT = { resid, at };
  const tabs = document.getElementById('viewTabs');
  if (tabs && tabs.style.display === 'none') toggleRawDump();
  showPane('textContent');
  paintDecodedPane();
  setTimeout(() => {
    const hit = document.getElementById('listingHit');
    if (hit && hit.scrollIntoView) hit.scrollIntoView({ block: 'center' });
  }, 40);
  return true;
}
// The line of a listing an offset falls on: the last instruction at or
// before it, within the object that holds it.
function listingLineFor(text, at) {
  const lines = String(text).split('\n');
  let base = -1, best = -1;
  for (let i = 0; i < lines.length; i++) {
    const h = /^(?:function )?obj_([0-9A-F]{4})\b/.exec(lines[i]);
    if (h) {
      base = parseInt(h[1], 16);
      if (base > at) break;
      best = i;
      continue;
    }
    const m = base >= 0 && /^  ([0-9A-F]{4})  /.exec(lines[i]);
    if (!m) continue;
    if (base + parseInt(m[1], 16) > at) break;
    best = i;
  }
  return best;
}
function listingRing(html, text, at) {
  const i = listingLineFor(text, at);
  if (i < 0) return html;
  const hl = html.split('\n');
  if (i >= hl.length) return html;
  hl[i] = '<span id="listingHit" class="listingHit">' + hl[i] + '</span>';
  return hl.join('\n');
}

// The arguments of a call at ops[i]: the ops one level inside it, up to
// its `end`.
function dvmCallArgs(ops, i) {
  const out = [], d = ops[i].depth;
  for (let j = i + 1; j < ops.length && ops[j].obj === ops[i].obj; j++) {
    if (ops[j].depth <= d) break;
    if (ops[j].depth === d + 1) out.push(ops[j]);
  }
  return out;
}
// A quoted string an op pushes, as the game has it.
function dvmOpString(op) {
  const m = op && /^string(?:\(implicit\))? ("(?:[^"\\]|\\.)*")/.exec(op.text);
  if (!m) return null;
  try { return JSON.parse(m[1]).replace(/\n$/, ''); } catch (e) { return null; }
}

/* DAMAGE TO THINGS. Every blow and every damaging spell ends in the
   target's TakeDamage method (0x41), handed the damage and its type: the
   combat outcome 0xE87 calls it after ResistDamage, the damage helper
   0xEB8 for a spell, 0xE8F for a weapon's roll. A character takes it as
   health through the default method 0x3041. An item class can carry a
   TakeDamage of its own, and the metal door's -- blunt doubled, edged
   halved, piercing quartered, then the door helper 0xE49 -- was written up
   on 9 September 2026 from that one class and kept off the sheet until
   every class that has one had been read (asked for on 11 September).
   They have been, and the arithmetic is the doors', the chest's, the
   coffer's and the crate's alike; the rest do something of their own.

   So this reads each class's method for its parts rather than naming
   classes: the type table (`if (type & M) damage op= K`, tested in turn,
   the first bit that matches deciding), a guard (a type equal to N, a
   Data1 below N, a damage above N), where the damage goes (0xE49 with the
   door's aspects, 0xE4A with the chest's and a strength, or a lock of the
   class's own against Data2), and what follows (the thing deleted, turned
   into another prop type, given an aspect, experience awarded, a line
   said). The two helpers are read once, by bashRule. */
function bashRule(resid) {
  const ops = dvmOpsOf(dvmScriptEntry(resid));
  if (!ops.length) return null;
  const v = g => g ? dvmVal(resid, g.find(o => DVM_NUM.test(o.text))) : null;
  const byClass = dvmSeqFirst(ops, [/^class_member 0x3400$/, DVM_NUM, /^mul$/, /^gt$/]);
  const byArg = dvmSeqFirst(ops, [/^arg Arg01$/, /^arg Arg\d+$/, DVM_NUM, /^mul$/, /^gt$/]);
  const destroy = byClass ? { factor: dvmVal(resid, byClass[1]), strength: 'class' } : byArg ? { factor: dvmVal(resid, byArg[2]), strength: 'argument' } : null;
  const opens = dvmSeqFirst(ops, [/^arg Arg01$/, /^arg Arg00$/, /^get_field data2/, /^gt$/]);
  const wear = dvmSeqFirst(ops, [/^arg Arg01$/, /^arg Arg00$/, /^get_field data2/, DVM_NUM, /^div$/, /^gt$/]);
  const step = dvmSeqFirst(ops, [/^set_field data2/, /^arg Arg00$/, /^end$/, /^arg Arg00$/, /^get_field data2/, DVM_NUM, /^sub$/]);
  // The destroying blow is tested inside the locked branch for a door, so
  // only a locked or magically locked door can be destroyed, and a
  // magically locked one only that way: the condition is
  // locked || (magically locked && damage > strength x factor).
  const magicOnlyDestroyed = !!dvmSeqFirst(ops, [/^eq$/, /^or$/, /^arg Arg01$/, /^arg Arg00$/, /^class_member 0x3400$/, DVM_NUM, /^mul$/, /^gt$/, /^and$/, /^or$/]);
  const says = ops.map(dvmOpString).filter(Boolean);
  const spills = ops.some(o => o.text === 'call_resource 0xE48');
  // Anything inside it flagged 2 is used on the one attacking and removed
  // before the blow is judged.
  const setsOff = !!dvmSeqFirst(ops, [/^get_field flags/, /^byte (?:0x02|2)$/, /^bitwise_and$/]) && ops.some(o => /^method UseOn/.test(o.text));
  // The line each outcome says: the first string with words in it after
  // the test that leads to it, and the one after that for the blow that
  // does nothing. Chosen by where it sits, so an edited line is quoted as
  // edited.
  const lineAfter = (g, skip) => {
    if (!g) return null;
    let n = skip || 0;
    for (let i = ops.indexOf(g[g.length - 1]) + 1; i < ops.length; i++) {
      const s = dvmOpString(ops[i]);
      if (s && /[A-Za-z]{2}/.test(s) && ops[i].text !== 'string "It contained"' && n-- === 0) return s;
    }
    return null;
  };
  const destroyG = byClass || byArg;
  return { resid, destroy, opens: opens ? { resid, at: opens[0].at } : null,
           wear: wear ? dvmVal(resid, wear[3]) : null, step: step ? dvmVal(resid, step[5]) : null,
           magicOnlyDestroyed, says, spills, setsOff,
           saysDestroyed: lineAfter(destroyG), saysOpened: lineAfter(opens), saysWorn: lineAfter(wear), saysHeld: lineAfter(wear, 1) };
}
// The weapons whose damage type passes `test`, off their classes, and a
// bare hand where the outcome routine's type for one passes it too.
function damageTypeCarriers(test) {
  const names = [];
  const bare = dvmSeqIn(0xE87, [/^class_member 0x2D02$/, /^end$/, /^branch /, /^set_local /, DVM_NUM, /^end$/]);
  if (bare && test(dvmNum(bare[4]))) names.push('a bare hand');
  for (const g of gearTable()) if (g.type !== null && test(g.type)) names.push(g.name);
  const u = [...new Set(names)];
  return u.length ? u.slice(0, 4).join(', ') + (u.length > 4 ? ' and ' + (u.length - 4) + ' more' : '') : '';
}
// What a class does when struck, in words with its numbers as links: the
// cell of the Mechanics table and the item page's line.
function damageRowWords(r) {
  const bits = [];
  const carried = t => { const c = damageTypeCarriers(t); return c ? ' <span class="inspDim">(' + svEsc(c) + ')</span>' : ''; };
  if (r.onlyType) bits.push('only a blow of type ' + srcNum(r.onlyType) + carried(t => t === r.onlyType.v));
  if (r.data1Below) bits.push('only while its Data1 is below ' + srcNum(r.data1Below));
  if (r.overDamage) bits.push('any blow above ' + srcNum(r.overDamage));
  if (r.types.length) bits.push('the damage changed by its type');
  if (r.rule === 'door') bits.push('bashed as a door' + (r.strength ? ' of strength ' + srcNum(r.strength) : ''));
  else if (r.rule === 'chest') bits.push('bashed as a chest' + (r.strength ? ' of strength ' + srcNum(r.strength) : ''));
  else if (r.rule === 'lock') bits.push('a lock of strength ' + srcNum(r.strength) + ' of its own, opened by a blow above what is left' + (r.wear ? ' and worn down by one above what is left ÷ ' + srcNum(r.wear) : '') + (r.deletes ? '; destroyed when struck closed and unlocked' : ''));
  else if (r.rule === 'data2') bits.push('breaks when a blow is above its Data2' + (r.data2Default ? ', ' + srcNum(r.data2Default) + ' until set' : ''));
  if (r.becomes) bits.push('becomes ' + svEsc(propDisplayName(r.becomes.v) || 'prop type') + ' (prop type ' + srcNum(r.becomes) + ')');
  else if (r.aspects.length && r.rule !== 'lock') bits.push('shows aspect ' + r.aspects.filter((a, i, all) => all.findIndex(b => b.v === a.v) === i).map(a => srcNum(a)).join(' or '));
  if (r.deletes && r.rule !== 'lock') bits.push('destroyed');
  if (r.spills !== null) bits.push('drops what it held');
  if (r.xp) bits.push('rolls for a hit and gives ' + srcNum(r.xp) + ' experience for one' + (r.xpWhileBelow ? ', until its Data1 counts to ' + srcNum(r.xpWhileBelow) : ''));
  return bits.join('; ');
}
function damageTakers() {
  const rows = [];
  for (let pt = 1; pt < 512; pt++) {
    let cls = null;
    try { cls = parseItemClass(pt); } catch (e) { cls = null; }
    const take = cls && cls.code.find(c => c.key === 0x41);
    if (!take) continue;
    const r = cls.resid;
    const ops = dvmOpsOf(dvmScriptEntry(r)).filter(o => o.obj === take.off);
    if (!ops.length) continue;
    const val = op => dvmVal(r, op);
    const types = dvmSeqAll(ops, [/^if_not$/, /^arg Arg02$/, DVM_NUM, /^bitwise_and$/, /^then /, /^set_local 0x31$/, /^arg Arg01$/, DVM_NUM, /^(mul|div)$/])
      .map(g => ({ mask: val(g[2]), k: val(g[7]), op: g[8].mn }));
    const onlyType = dvmSeqFirst(ops, [/^if_not$/, /^arg Arg02$/, DVM_NUM, /^eq$/]);
    const overDamage = dvmSeqFirst(ops, [/^if_not$/, /^arg Arg01$/, DVM_NUM, /^gt$/]);
    // A Data1 test is a guard where nothing follows it but the damage, and
    // a count where experience is awarded under it (the practice targets).
    const d1 = dvmSeqFirst(ops, [/^if_not$/, /^arg Arg00$/, /^get_field data1/, DVM_NUM, /^lt$/]);
    const xpAt = ops.findIndex(o => /^call_resource GainExp\b/.test(o.text));
    const d1Idx = d1 ? ops.indexOf(d1[0]) : -1;
    const counts = d1 && xpAt > d1Idx && xpAt - d1Idx < 10;
    let xp = null;
    if (xpAt >= 0) { const a = dvmCallArgs(ops, xpAt).find(o => DVM_NUM.test(o.text)); xp = a ? val(a) : null; }
    const hand = (target) => {
      const i = ops.findIndex(o => o.text === 'call_resource ' + target);
      return i < 0 ? null : dvmCallArgs(ops, i).filter(o => DVM_NUM.test(o.text)).map(val);
    };
    const door = hand('0xE49'), chest = hand('0xE4A');
    // A lock of the class's own, as the trapdoor has: Data2 starts at the
    // class's lock figure and the damage is tested against what is left.
    const ownLock = !!dvmSeqFirst(ops, [/^set_field data2/, /^arg Arg00$/, /^end$/, /^arg Arg00$/, /^class_member 0x3400$/]);
    const dataDefault = dvmSeqFirst(ops, [/^if_not$/, /^arg Arg00$/, /^get_field data2/, DVM_NUM, /^eq$/, /^then /, /^set_field data2/, /^arg Arg00$/, /^end$/, DVM_NUM]);
    const overData2 = dvmSeqFirst(ops, [/^if_not$/, /^arg Arg01$/, /^arg Arg00$/, /^get_field data2/, /^gt$/]);
    const wear = dvmSeqFirst(ops, [/^arg Arg01$/, /^arg Arg00$/, /^get_field data2/, DVM_NUM, /^div$/, /^gt$/]);
    const becomes = dvmSeqFirst(ops, [/^set_field obj_type/, /^arg Arg00$/, /^end$/, DVM_NUM]);
    const aspects = dvmSeqAll(ops, [/^set_field aspect/, /^arg Arg00$/, /^end$/, DVM_NUM]).map(g => val(g[3]));
    const deletes = !!dvmSeqFirst(ops, [/^sys Delete$/, /^arg Arg00$/]);
    const spillAt = ops.findIndex(o => o.text === 'call_resource 0xE48');
    const says = ops.map(dvmOpString).filter(Boolean);
    let strength = null;
    if (door || ownLock) {
      const lk = cls.data.find(x => x.key === 0x34);
      if (lk && lk.words.length) strength = { v: lk.words[0] & 0x0FFFFFFF, resid: r, at: lk.off };
    } else if (chest && chest.length) strength = chest[chest.length - 1];
    rows.push({ pt, resid: r, at: ops[0].at, name: propDisplayName(pt) || ('prop 0x' + pt.toString(16)),
      types, onlyType: onlyType ? val(onlyType[2]) : null, overDamage: overDamage ? val(overDamage[2]) : null,
      data1Below: d1 && !counts ? val(d1[3]) : null, xp, xpWhileBelow: counts ? val(d1[3]) : null,
      rule: door ? 'door' : chest ? 'chest' : ownLock ? 'lock' : dataDefault || overData2 ? 'data2' : 'own',
      strength, data2Default: dataDefault ? val(dataDefault[9]) : null, wear: wear ? val(wear[3]) : null,
      becomes: becomes ? val(becomes[3]) : null, aspects, deletes, spills: spillAt >= 0 ? dvmOpString(dvmCallArgs(ops, spillAt).find(o => /^string/.test(o.mn))) || '' : null,
      says });
  }
  return { rows, door: bashRule(0xE49), chest: bashRule(0xE4A) };
}

/* A data value in a script, read as JavaScript. A `data` block (0x45, a
   16-bit length) holds an array: 0x90, a count, then 4-byte entries, each
   either a pointer (0x98, a byte, a 16-bit offset into the same resource)
   to a C string or to another array, or a 28-bit number. The shops' goods
   lists, the trainers' menus and the bark lists are all this shape; read
   here once so each reader gets the same strings, numbers and nesting. */
function dvmDataValue(d, at, depth) {
  depth = depth || 0;
  if (depth > 6 || at + 2 > d.length) return null;
  if (d[at] === 0x90) {
    const n = d[at + 1], out = [];
    for (let k = 0; k < n; k++) {
      const p = at + 2 + k * 4;
      if (p + 4 > d.length) break;
      if (d[p] === 0x98) out.push(dvmDataValue(d, u16be(d, p + 2), depth + 1));
      else { let w = u32be(d, p) & 0x0FFFFFFF; if (w & 0x08000000) w -= 0x10000000; out.push(w); }
    }
    return out;
  }
  let e = at; while (e < d.length && d[e] !== 0) e++;
  return decodeMacRoman(d.subarray(at, e));
}
// The data blocks in the operands of a call at ops[k], as values, and the
// blocks in the ops before it (a menu built into a local), for a caller
// that wants either.
function dvmCallData(d, off, ops, k, before) {
  const out = [];
  if (before) { for (let j = Math.max(0, k - 60); j < k; j++) if (ops[j][2] === 'data') out.push(dvmDataValue(d, off + ops[j][0] + 3)); }
  else for (let j = k + 1; j < Math.min(ops.length, k + 14); j++) {
    if (ops[j][2] === 'end' && ops[j][1] <= ops[k][1]) break;
    if (ops[j][2] === 'data') out.push(dvmDataValue(d, off + ops[j][0] + 3));
  }
  return out;
}
// The same, each block with the offset of its `data` instruction in the
// resource, for a table that links a value to where it was read.
function dvmCallDataAt(d, off, ops, k, before) {
  const out = [];
  const one = j => ({ value: dvmDataValue(d, off + ops[j][0] + 3), at: off + ops[j][0] });
  if (before) { for (let j = Math.max(0, k - 60); j < k; j++) if (ops[j][2] === 'data') out.push(one(j)); }
  else for (let j = k + 1; j < Math.min(ops.length, k + 14); j++) {
    if (ops[j][2] === 'end' && ops[j][1] <= ops[k][1]) break;
    if (ops[j][2] === 'data') out.push(one(j));
  }
  return out;
}
// Every call of `resid` in every script, with the caller and the ops around it.
function dvmCallSites(target) {
  const out = [];
  if (!masterIndexGlobal) return out;
  for (let subn = 0; subn < 256; subn++) {
    const mi = masterIndexGlobal[subn];
    if (!mi || !mi[0] || XREF_SKIP_SUBN.has(subn)) continue;
    const count = subindexCount(subn);
    for (let ri = 0; ri < count; ri++) {
      const resid = ((subn + 1) << 8) | ri;
      let data;
      try { const raw = getResourceBytes(resid); if (!raw || !raw.length) continue; data = smartDecrypt(raw, resid).data; if (dvmNamedScript(data)) continue; } catch (e) { continue; }
      let disc; try { disc = dvmDiscover(data, resid); } catch (e) { continue; }
      if (disc.tableOffset === null) continue;
      const offs = Object.keys(disc.kinds).map(Number).sort((x, y) => x - y);
      for (const off of offs) {
        if (disc.kinds[off] !== 'function') continue;
        let end = data.length; for (const o2 of offs) if (o2 > off && o2 < end) end = o2;
        let ops; try { ops = dvmDisassemble(data.slice(off, end), 3).ops; } catch (e) { continue; }
        const want = new RegExp('0x' + target.toString(16).toUpperCase().padStart(3, '0') + '\\b|\\(0x' + target.toString(16).toUpperCase() + '\\)', 'i');
        ops.forEach((op, k) => { if (op[2] === 'call_resource' && want.test(String(op[3]))) out.push({ resid, subn, data, off, ops, k }); });
      }
    }
  }
  return out;
}

/* LOCKPICKING. One helper, PickLock (0xE43), takes a key or a pick, a key
   number (255 for a pick) and the lock. A key fits when the lock's number
   is the key's plus the number given. A pick succeeds when the picker's
   reflex plus a roll of 0 to 19 is at least 20 plus another roll of 0 to
   19 plus 5 for every 20 of the lock's difficulty, and breaks otherwise;
   the lockpick item refuses to be used at all without the Lock Picking
   skill (0x1109). The difficulty is the placed lock's own data1; the
   classes carry a lock parameter of their own, shown as stored. */
function lockRules() {
  const idx = buildScriptTextIndex();
  const pick = idx.find(e => e.resid === 0xE43);
  const item = idx.find(e => e.resid === 0x1109);
  // reflex + Random(0, pickRoll) >= base + Random(0, lockRoll) + (data1 + addend) / per * step
  const f = pick ? dvmSeqFirst(dvmOpsOf(pick), [/^local Var\w+$/, /^sys Random$/, /^byte (?:0x00|0)$/, DVM_NUM, /^end$/, /^add$/, DVM_NUM, /^sys Random$/, /^byte (?:0x00|0)$/, DVM_NUM, /^end$/, /^add$/,
    /^arg Arg\d+$/, /^get_field data1/, DVM_NUM, /^add$/, DVM_NUM, /^div$/, DVM_NUM, /^mul$/, /^add$/, /^lt$/]) : null;
  const v = k => dvmVal(0xE43, f[k]);
  const numbers = f ? { pickRoll: v(3), base: v(6), lockRoll: v(9), addend: v(14), per: v(16), step: v(18) } : null;
  const rule = pick ? { breaks: /The lockpick broke/.test(pick.text), keyFits: /The key doesn't fit/.test(pick.text),
    formula: !!(f && /get_field reflex/.test(pick.text)), numbers,
    lk: numbers ? { pickRoll: numbers.pickRoll.v, base: numbers.base.v, lockRoll: numbers.lockRoll.v, addend: numbers.addend.v, per: numbers.per.v, step: numbers.step.v } : null } : null;
  const needsSkill = !!(item && /GetSkill[\s\S]{0,140}short 0x00D5/.test(item.text));
  const classes = [];
  for (let pt = 1; pt < 512; pt++) {
    const cls = parseItemClass(pt); if (!cls) continue;
    const f = cls.data.find(x => x.key === 0x34);
    if (f) classes.push({ pt, name: propDisplayName(pt) || ('prop 0x' + pt.toString(16)), words: f.words.map(w => w & 0x0FFFFFFF), src: { resid: cls.resid, at: f.off } });
  }
  return { rule, needsSkill, classes };
}

/* SHOPS. Every vendor calls one helper, 0xEA5, with a name for the shop, a
   list of goods -- each a prop word, a name, a price and a count -- and
   four bargaining figures of its own. The helper's arithmetic is the
   game's; what is shown is what each vendor lists and at what price, and
   that the Haggling skill (0xCC) takes a further roll of 0 to 5 off the
   vendor's figure, which the helper's own code says. */
function shopRules() {
  const shops = [];
  for (const site of dvmCallSites(0xEA5)) {
    const { resid, subn, data, off, ops, k } = site;
    const title = ops[k + 1] && ops[k + 1][2] === 'string' ? (() => { try { return JSON.parse(ops[k + 1][3]); } catch (e) { return ''; } })() : '';
    const blocks = dvmCallDataAt(data, off, ops, k, false);
    const gb = blocks.find(b => Array.isArray(b.value) && b.value.length && Array.isArray(b.value[0]));
    const goods = (gb ? gb.value : []).filter(g => Array.isArray(g) && g.length >= 3)
      .map(g => ({ word: g[0], name: String(g[1]), price: g[2], count: g[3], src: { resid, at: gb.at } }));
    const tb = blocks.find(b => Array.isArray(b.value) && b.value.length === 4 && b.value.every(x => typeof x === 'number')) || null;
    if (goods.length) shops.push({ resid, who: subn === 23 ? resid & 0xFF : null, title, goods, terms: tb ? tb.value : null, termsSrc: tb ? { resid, at: tb.at } : null });
  }
  // Haggling: after GetSkill of skill 0xCC, a Random(0, n) taken off the figure.
  const ho = dvmOpsOf(dvmScriptEntry(0xEA5));
  const hi = ho.findIndex(o => /^short (?:0x00CC|204)$/i.test(o.text));
  const hg = hi < 0 ? null : dvmSeqFirst(ho.slice(hi, hi + 12), [/^sys Random$/, /^byte (?:0x00|0)$/, DVM_NUM]);
  const haggling = hg ? dvmVal(0xEA5, hg[2]) : null;
  return { shops, haggling };
}

/* TRAINING. Every teacher calls one helper, 0xEB1, with the pupil, their
   own name, a skill and whether they teach it to mastery; a skill named as
   a constant is one lesson on offer, and a menu of them is a data list of
   name-and-skill pairs built just before the call. A lesson costs one
   training point (0xEAF): a character is made with 4 (the hero's script),
   gains 6 less the difficulty level with each level (0xE86), and a skill
   is mastered at level 15. */
function trainingRules() {
  const byTeacher = new Map();
  for (const site of dvmCallSites(0xEB1)) {
    const { resid, subn, data, off, ops, k } = site;
    const who = subn === 23 ? resid & 0xFF : null;
    const key = resid;
    if (!byTeacher.has(key)) byTeacher.set(key, { resid, who, skills: new Map() });
    const t = byTeacher.get(key);
    const args = ops.slice(k + 1, k + 8);
    const mastery = args.some(o => o[2] === 'word' && /True/.test(String(o[3])));
    const constant = args.find(o => o[2] === 'short');
    if (constant) { const id = parseInt(constant[3], 16); if (id >= 0xC0 && id <= 0xD6) t.skills.set(id, mastery || t.skills.get(id) || false); continue; }
    for (const b of dvmCallData(data, off, ops, k, true)) {
      if (!Array.isArray(b)) continue;
      for (const e of b) if (Array.isArray(e) && e.length === 2 && typeof e[1] === 'number' && e[1] >= 0xC0 && e[1] <= 0xD6) t.skills.set(e[1], mastery || t.skills.get(e[1]) || false);
    }
  }
  // The points, each off its own line: gained with a level (0xE86, n less
  // the difficulty level), given at creation (the hero's script), taken by a
  // lesson and the aspect that is mastery (0xEAF).
  const at = (resid, pat, k) => { const g = dvmSeqIn(resid, pat); return g ? dvmVal(resid, g[k]) : null; };
  const perLevel = at(0xE86, [/^get_field training/, DVM_NUM, /^global DifficultyLevel/, /^sub$/], 1);
  const atStartVal = at(0x1801, [/^set_field training/, /^arg Arg00$/, /^end$/, DVM_NUM], 3);
  const perLessonVal = at(0xEAF, [/^get_field training/, DVM_NUM, /^sub$/], 1);
  const masteryVal = at(0xEAF, [/^get_field aspect/, DVM_NUM, /^eq$/], 1);
  const points = {
    perLevel, atStart: atStartVal ? atStartVal.v : null, atStartVal,
    perLesson: perLessonVal ? perLessonVal.v : null, perLessonVal,
    mastery: masteryVal ? masteryVal.v : null, masteryVal
  };
  return { teachers: [...byTeacher.values()], points };
}

/* COMBAT. Three routines. 0xE88 (melee) and 0xE89 (missile) work out the
   attacker's margin: reflex -- body, for a monster flagged so -- plus the
   weapon's skill (Barehand for no weapon, Missile for a launcher) plus a
   roll of 0 to 29, less the defender's reflex plus a roll of 0 to 29, plus
   the attacker's Attack skill less the defender's Defence (0xE84, each a
   class figure where the skill is absent). 0xE87 resolves it: every shield
   the defender wears blocks a roll of 0 to its block plus the Shield skill,
   and a margin under that is parried; the weapon's enchantment and skill
   are added to the margin and the skill to the damage; a margin of nothing
   or less misses; a hit does a roll of 0 to the damage figure plus the
   enchantment, named grazed, hit, hit hard, very hard, extremely hard,
   crushed, smashed, ground to dust or shredded by thresholds of 3, 6, 9,
   12, 16, 20, 25 and 35; ResistDamage takes the type; experience follows. */
function combatRules() {
  const melee = dvmScriptEntry(0xE88), missile = dvmScriptEntry(0xE89), resolve = dvmScriptEntry(0xE87);
  if (!melee || !missile || !resolve) return null;
  const mo = dvmOpsOf(melee), so = dvmOpsOf(missile), ro = dvmOpsOf(resolve);
  // Each side's roll, attacker's first: `Random(0, n)` in the blow's margin.
  const rolls = (ops, r) => dvmSeqAll(ops, [/^sys Random$/, /^byte (?:0x00|0)$/, DVM_NUM, /^end$/]).map(g => dvmVal(r, g[2]));
  const mr = rolls(mo, 0xE88), sr = rolls(so, 0xE89);
  const roll = mr[0] || null, rollDefender = mr[1] || null;
  const barehand = /short (?:0x00C7|199)\b/.test(melee.text), missileSkill = /short (?:0x00C8|200)\b/.test(missile.text);
  const parry = /parries/.test(resolve.text) && /class_member 0x2F00/.test(resolve.text) && /class_member 0x2F01/.test(resolve.text);
  // The damage: Random(0, the figure) plus this, then the enchantment.
  const add = dvmSeqFirst(ro, [/^sys Random$/, /^byte (?:0x00|0)$/, /^arg Arg04$/, /^end$/, DVM_NUM, /^add$/]);
  // The blow words: `if (roll < n) word = "..."`, with the suffix a second
  // local takes where there is one (" hard", " to dust"), then the word for
  // everything past the last threshold.
  const words = [];
  let lastIdx = -1;
  for (const g of dvmSeqAll(ro, [/^if_not$/, /^local Var\w+$/, DVM_NUM, /^lt$/, /^then /, /^set_local /, /^string /, /^end$/])) {
    const w = dvmOpString(g[6]);
    if (w === null || !/^[a-z]/.test(w)) continue;
    const i = ro.indexOf(g[7]);
    const suf = dvmSeq(ro, i + 1, [/^set_local /, /^string /, /^end$/]);
    words.push({ below: dvmNum(g[2]), word: w + (suf ? dvmOpString(suf[1]) || '' : ''), val: dvmVal(0xE87, g[2]) });
    lastIdx = suf ? i + 3 : i;
  }
  let last = null;
  if (lastIdx >= 0) {
    const g = dvmSeqFirst(ro, [/^branch /, /^set_local /, /^string /, /^end$/], lastIdx + 1);
    if (g) {
      const i = ro.indexOf(g[3]);
      const suf = dvmSeq(ro, i + 1, [/^set_local /, /^string /, /^end$/]);
      last = { word: dvmOpString(g[2]) + (suf ? dvmOpString(suf[1]) || '' : ''), resid: 0xE87, at: g[2].at };
    }
  }
  return { d30: !!(roll && rollDefender && sr.length >= 2), roll, rollDefender, missileRolls: sr.slice(0, 2),
           barehand, missileSkill, parry, dmgAdd: add ? dvmVal(0xE87, add[4]) : null, words, last };
}

/* THE ATTACK ITSELF. Before a blow or a missile is resolved, one routine
   (0x3042, called by nothing in the archive, so the executable's, and the
   only caller of 0xE88 and 0xE89) decides what is swung or thrown. It takes
   the squared distance from 0xE8C (dx² + dy²) less one, and walks the
   attacker's equipment for the first melee entry whose reach squared is at
   least that; that weapon swings, its damage figure plus a roll of 0 to
   (body − 12) / 4 (0xE90). Only when nothing reached, the target is beyond
   the adjacent squares and in sight, does it walk again for a thrown entry
   whose range squared covers the distance: the item's own tile flies
   (ShootEffect), the missile margin resolves it with the Missile skill and a
   roll of 0 to (reflex − 12) / 4, and then the item is moved -- into the
   target's inventory (flags 9, container the target) when the outcome
   routine answered true, which it does for a hit and for a parry, or onto
   the target's square (flags 1) when it missed. A launcher is the same
   branch with its ammunition spent one a shot. Read 9 September 2026 after
   the maintainer's mystic spear flew at a target that had stepped away.
   Every number here is read off the listing rather than typed, so an edited
   archive states its own rule, and a pattern that stops matching drops the
   sentence instead of misstating it. */
function attackRules() {
  const idx = buildScriptTextIndex();
  const atk = idx.find(e => e.resid === 0x3042), dist = idx.find(e => e.resid === 0xE8C), scale = idx.find(e => e.resid === 0xE90);
  if (!atk) return null;
  const strip = t => t.replace(/^\s*[0-9A-F]{4}\s+/gm, '');
  const a = strip(atk.text), d = dist ? strip(dist.text) : '', sc = scale ? strip(scale.text) : '';
  const squared = /get_field x \(0x1\)[\s\S]{0,60}sub[\s\S]{0,60}mul[\s\S]{0,80}get_field y \(0x2\)[\s\S]{0,60}sub[\s\S]{0,60}mul[\s\S]{0,60}add/.test(d);
  const lessOne = /call_resource 0xE8C[\s\S]{0,60}?end\s+end\s+set_local 0x02\s+local Var02\s+byte 0x01\s+sub/.test(a);
  const test = k => new RegExp('class_member 0x' + k + '01\\s+local Var03\\s+class_member 0x' + k + '01\\s+mul\\s+local Var02\\s+ge').test(a);
  const reach = test('2A'), range = test('2B'), launcher = test('2E');
  const meleeAt = a.indexOf('call_resource 0xE88'), thrownAt = a.indexOf('has_member ThrownWeapon');
  const meleeFirst = meleeAt >= 0 && thrownAt > meleeAt;
  const beyondAdjacent = /local Var02\s+byte 0x01\s+gt/.test(a) && /sys HasSightLine/.test(a);
  const flies = /sys ShootEffect[\s\S]{0,240}get_field tile \(0xA\)[\s\S]{0,160}call_resource 0xE89/.test(a);
  const lodges = /call_resource 0xE89[\s\S]{0,400}?then -> 0x[0-9A-F]+\s+set_field flags \(0x0\)\s+local Var03\s+end\s+byte 0x09\s+end\s+set_field container \(0xB\)/.test(a);
  const drops = /set_field flags \(0x0\)\s+local Var03\s+end\s+byte 0x01\s+end\s+set_field x \(0x1\)/.test(a);
  const bodyRoll = /call_resource 0xE88[\s\S]{0,160}class_member 0x2A00\s+sys Random\s+byte 0x00\s+call_resource 0xE90\s+arg Arg00\s+get_field body/.test(a);
  const reflexRoll = /class_member 0x2B00\s+sys Random\s+byte 0x00\s+call_resource 0xE90\s+arg Arg00\s+get_field reflex/.test(a);
  // (stat - n) / m, with the two numbers' lines.
  const scm = sc ? dvmSeqIn(0xE90, [DVM_NUM, /^sub$/, DVM_NUM, /^div$/]) : null;
  const one = dvmSeqIn(0x3042, [/^set_local 0x02$/, /^local Var02$/, DVM_NUM, /^sub$/]);
  const ammoSpent = /set_field quantity \(0x9\)[\s\S]{0,60}byte 0x01[\s\S]{0,500}sys Delete/.test(a);
  return { squared, lessOne, reach, range, launcher, meleeFirst, beyondAdjacent, flies, lodges, drops, bodyRoll, reflexRoll,
    scale: scm ? { sub: dvmNum(scm[0]), div: dvmNum(scm[2]), subVal: dvmVal(0xE90, scm[0]), divVal: dvmVal(0xE90, scm[2]) } : null,
    lessOneVal: one ? dvmVal(0x3042, one[2]) : null, ammoSpent };
}

/* WHAT A SPELL OR A USE CAN BE AIMED AT. A script that wants a target says
   so by what it returns: it prints its question ("Cast 'Healing' on whom?",
   "Use lock pick on what?") and returns a word, which the application keeps
   until the next click and tests bit by bit before it accepts the square or
   the thing under the pointer. So the word is read off each script here,
   with the line that holds it, and the bits are named below.

   The names come from the application's own tests, read there rather than
   guessed: TDroppableWindow::NeedsTarget stores the word, and
   MouseRoutine tests it -- 0x8000 against CanSearch, which is the same
   within-reach test that decides whether an item can be dragged (the three
   by three squares around the character), 0x4000 against
   TViewer::IsStraightAbs, and the low bits against what is under the
   pointer. Bit 8 is left unnamed on purpose: its four users are the things
   you hand to a person, and what the application tests for it is a flag on
   the character whose meaning is not established, so it prints as hex.

   Why it is worth a section: it is the difference between a spell you can
   cast across the room and one that needs a neighbour, which no other part
   of the file states. */
const TARGET_BIT_NAMES = [
  [0x8000, 'within reach'],
  [0x4000, 'in a straight line'],
  [0x0004, 'a character'],
  [0x0002, 'a square'],
  [0x0001, 'a thing']
];
function targetWordWords(word) {
  const bits = [];
  let left = word;
  for (const [mask, name] of TARGET_BIT_NAMES) if (word & mask) { bits.push(name); left &= ~mask; }
  for (let b = 1; b <= 0x8000; b <<= 1) if (left & b) bits.push('bit ' + propWordHex(b));
  return bits;
}
function targetRules() {
  const out = [];
  for (const e of buildScriptTextIndex()) {
    const ops = dvmOpsOf(e);
    // The prompt, then the return and its constant. Every match is looked
    // at rather than the first, because a class's Examine prints its own
    // lines and returns 0 from the same shape earlier in the resource --
    // the unguent's does, and taking the first match dropped it entirely.
    // A question mark is what marks the prompt, and a word of 0 is a script
    // that wants no target.
    let g = null, prompt = null;
    for (const cand of dvmSeqAll(ops, [/^string(?:\(implicit\))? "/, /^return$/, DVM_NUM])) {
      const s = dvmOpString(cand[0]);
      if (s && /\?$/.test(s.trim()) && dvmNum(cand[2])) { g = cand; prompt = s; break; }
    }
    if (!g) continue;
    const val = dvmVal(e.resid, g[2]);
    if (!val || !val.v) continue;
    const pt = e.resid >= 0x1000 && e.resid < 0x1200 ? e.resid - 0x1000 : null;
    out.push({ resid: e.resid, pt, prompt: prompt.trim(), word: val.v, val,
               name: pt !== null ? (propDisplayName(pt) || ('prop 0x' + pt.toString(16))) : (selfNameFor(e.resid) || labelFor(e.resid) || ('0x' + e.resid.toString(16).toUpperCase())),
               kind: pt !== null ? 'item' : 'spell' });
  }
  out.sort((a, b) => (b.word & 0x8000) - (a.word & 0x8000) || a.word - b.word || a.name.localeCompare(b.name));
  return out;
}
// The target word one script returns, for that item's or spell's own page.
function targetOf(resid) {
  try { return targetRules().find(t => t.resid === resid) || null; } catch (e) { return null; }
}
/* The walk that would close the distance. With a target out of reach the
   click handler calls TGameSys::WalkToLocation, and in the shipped program
   that routine is two instructions: it answers false and does nothing, so
   the click is refused instead. Read rather than stated: a build where it
   was implemented would have a body and this returns null. */
function exeWalkStub() {
  const ops = exeOpsNamed('TGameSys::WalkToLocation');
  if (!ops.length || ops.length > 4) return null;
  const li = ops.findIndex(o => o.d && o.d.mn === 'li' && o.d.rd === 3 && o.d.imm === 0);
  const ret = ops.findIndex(o => o.d && /^blr$/.test(o.d.mn));
  return li >= 0 && ret > li ? { at: exeVal(ops[li], 0), ops: ops.length } : null;
}

/* WHAT THE GROUND DOES. Walking is the application's, but the damage a
   square does is a script: the default method 0x301F takes the character
   and a code for what they stepped on. Two codes do something -- a range
   for the swamp, one value for lava -- and everything else is a prop, whose
   UseOn runs with the character on it, which is how a rune goes off.

   Both are guarded by a character flag (the disassembler names them) and by
   a monster's own immunity, and both hand their damage to TakeDamage
   directly rather than through ResistDamage, so armour takes nothing off
   either. Read after a Discord conversation about a game played without
   magic, where the swamp and the Lake of Fire were the two things that
   could not be avoided. */
function terrainRules() {
  const e = dvmScriptEntry(0x301F);
  if (!e) return null;
  const ops = dvmOpsOf(e);
  const val = op => dvmVal(0x301F, op);
  const flagName = op => (op && /flag: ([a-z\/ -]+)/.exec(op.note || '') || [])[1] || null;
  // The swamp: a code between two bounds, a flag, an immunity, a roll.
  const band = dvmSeqFirst(ops, [DVM_NUM, /^arg Arg01$/, /^le$/, /^arg Arg01$/, DVM_NUM, /^le$/, /^and$/]);
  const guard = k => dvmSeqFirst(ops, [/^sys TestFlag$/, /^arg Arg00$/, DVM_NUM, /^end$/, /^not$/], k);
  const swampGuard = band ? guard(ops.indexOf(band[6])) : null;
  const chance = dvmSeqFirst(ops, [/^sys Random$/, DVM_NUM, DVM_NUM, /^end$/, DVM_NUM, /^eq$/]);
  const bite = dvmSeqFirst(ops, [/^method TakeDamage/, /^arg Arg00$/, DVM_NUM, DVM_NUM]);
  const poison = dvmSeqFirst(ops, [/^sys SetFlag$/, /^arg Arg00$/, DVM_NUM]);
  const saysBit = ops.map(dvmOpString).filter(Boolean);
  // Lava: one code, its own flag, and a roll for the damage.
  const lavaAt = dvmSeqFirst(ops, [/^arg Arg01$/, DVM_NUM, /^eq$/]);
  const lavaGuard = lavaAt ? guard(ops.indexOf(lavaAt[2])) : null;
  const burn = dvmSeqFirst(ops, [/^method TakeDamage/, /^arg Arg00$/, /^sys Random$/, DVM_NUM, DVM_NUM, /^end$/, DVM_NUM, /^add$/, DVM_NUM]);
  const onProp = /method UseOn/.test(e.text);
  return {
    resid: 0x301F,
    swamp: band && bite ? {
      from: val(band[0]), to: val(band[4]),
      flag: swampGuard ? val(swampGuard[2]) : null, flagName: swampGuard ? flagName(swampGuard[2]) : null,
      chance: chance ? { lo: val(chance[1]), hi: val(chance[2]), is: val(chance[4]) } : null,
      damage: val(bite[2]), type: val(bite[3]),
      poison: poison ? val(poison[2]) : null, poisonName: poison ? flagName(poison[2]) : null,
      says: saysBit[0] || ''
    } : null,
    lava: lavaAt && burn ? {
      code: val(lavaAt[1]),
      flag: lavaGuard ? val(lavaGuard[2]) : null, flagName: lavaGuard ? flagName(lavaGuard[2]) : null,
      roll: { lo: val(burn[3]), hi: val(burn[4]) }, plus: val(burn[6]), type: val(burn[8]),
      says: saysBit[1] || ''
    } : null,
    onProp
  };
}

/* THE WATER. One class (0x1036) is every fountain and spring in the game,
   and the placed prop's Data1 picks which water it is: the plain kinds say
   something and do nothing, one poisons, one heals, one is a wishing well,
   and one clears four statuses at once. Read as a list of kinds because
   that is how the script is written -- a chain of tests on the Data1 -- so
   each kind's words and effects are what lies between its test and the
   next. The census underneath is the placed props, so an edited archive
   shows its own.

   One kind is not a constant at all: it asks the game's own state and
   answers with another kind, which is how Catamarca's water turns from
   brackish to fresh over the course of the game. */
function springRules() {
  const e = dvmScriptEntry(0x1036);
  if (!e) return null;
  const ops = dvmOpsOf(e);
  const val = op => dvmVal(0x1036, op);
  const flagName = op => (op && /flag: ([a-z\/ -]+)/.exec(op.note || '') || [])[1] || null;
  // Each kind's test: `if_not (the Data1 local == n)`, in the order written.
  const tests = dvmSeqAll(ops, [/^if_not$/, /^local Var00$/, DVM_NUM, /^eq$/]).map(g => ({ at: ops.indexOf(g[0]), kind: dvmNum(g[2]), val: val(g[2]) }));
  if (!tests.length) return null;
  const kinds = [];
  for (let i = 0; i < tests.length; i++) {
    const from = tests[i].at, to = i + 1 < tests.length ? tests[i + 1].at : ops.length;
    const span = ops.slice(from, to);
    const says = span.map(dvmOpString).filter(Boolean);
    const heal = dvmSeqFirst(span, [/^set_field health/, /^local Var\w+$/, /^end$/, /^local Var\w+$/, /^get_field health/, /^sys Random$/, DVM_NUM, DVM_NUM]);
    const food = dvmSeqFirst(span, [/^set_field nutrition/, /^local Var\w+$/, /^end$/, /^local Var\w+$/, /^get_field nutrition/, DVM_NUM, /^add$/]);
    const cap = dvmSeqFirst(span, [/^get_field nutrition/, DVM_NUM, /^lt$/]);
    const sets = dvmSeqAll(span, [/^sys SetFlag$/, /^global CurrentCharacter/, DVM_NUM]).map(g => ({ val: val(g[2]), name: flagName(g[2]) }));
    const clears = dvmSeqAll(span, [/^sys ClearFlag$/, /^local Var\w+$/, DVM_NUM]).map(g => ({ val: val(g[2]), name: flagName(g[2]) }));
    const hurt = dvmSeqFirst(span, [/^call_resource 0x3041$/, /^global CurrentCharacter/, /^sys Random$/, DVM_NUM, DVM_NUM, /^end$/, DVM_NUM, /^add$/, DVM_NUM]);
    const wish = span.some(o => /^sys OpenConversation$/.test(o.text));
    const chance = wish ? dvmSeqFirst(span, [/^sys Random$/, DVM_NUM, DVM_NUM, /^end$/, DVM_NUM, /^eq$/]) : null;
    kinds.push({ kind: tests[i].kind, val: tests[i].val, says,
      heal: heal ? { lo: val(heal[6]), hi: val(heal[7]) } : null,
      food: food ? { plus: val(food[5]), below: cap ? val(cap[1]) : null } : null,
      sets, clears, wish,
      hurt: hurt ? { lo: val(hurt[3]), hi: val(hurt[4]), plus: val(hurt[6]), type: val(hurt[8]) } : null,
      chance: chance ? { lo: val(chance[1]), hi: val(chance[2]), is: val(chance[4]) } : null });
  }
  // The kind that asks the game's state, and what sets that state.
  const gate = dvmSeqFirst(ops, [/^sys GetState$/, DVM_NUM, /^end$/, DVM_NUM, /^lt$/]);
  let setter = null;
  if (gate) {
    const which = dvmNum(gate[1]);
    for (const en of buildScriptTextIndex()) {
      const g = dvmSeqFirst(dvmOpsOf(en), [/^sys SetState$/, DVM_NUM, DVM_NUM]);
      if (g && dvmNum(g[1]) === which && en.resid !== 0x1036) {
        const pt = en.resid >= 0x1000 && en.resid < 0x1200 ? en.resid - 0x1000 : null;
        setter = { resid: en.resid, pt, name: pt !== null ? (propDisplayName(pt) || ('prop 0x' + pt.toString(16))) : (labelFor(en.resid) || ''), to: dvmVal(en.resid, g[2]) };
        break;
      }
    }
  }
  // Where they are, by kind: the placed records of this class.
  const placed = new Map();
  try {
    for (let z = 1; z < 0x100; z++) {
      const praw = refExists(0x8100 + z) ? getResourceBytes(0x8100 + z) : null;
      if (!praw) continue;
      for (const r of parseDelverPropList(smartDecrypt(praw, 0x8100 + z).data)) {
        if (r.proptype !== 0x36 || !r.onMap || r.flags === 0xFF || (r.flags & 0x40)) continue;
        if (!placed.has(r.d1)) placed.set(r.d1, []);
        placed.get(r.d1).push({ zone: 0x8000 + z, x: r.x, y: r.y });
      }
    }
  } catch (err) { /* an archive with no prop lists says nothing about where */ }
  return { kinds, gate: gate ? { state: val(gate[1]), below: val(gate[3]) } : null, setter, placed };
}

/* A CURE THAT MIGHT NOT WORK. A script that clears a status behind a roll
   is a cure with a chance, and the unguent is the one the game has: it
   heals a little and, if the character is poisoned, takes the poison away
   one time in five. Read as the roll it is, because the chance is what a
   player wants to know and it is nowhere in the interface. */
function chanceCures() {
  const out = [];
  for (const e of buildScriptTextIndex()) {
    const ops = dvmOpsOf(e);
    const g = dvmSeqFirst(ops, [/^sys TestFlag$/, /^local Var\w+$/, DVM_NUM, /^end$/, /^sys Random$/, DVM_NUM, DVM_NUM, /^end$/, DVM_NUM, /^eq$/, /^and$/]);
    if (!g) continue;
    const clear = dvmSeqFirst(ops, [/^sys ClearFlag$/, /^local Var\w+$/, DVM_NUM], ops.indexOf(g[10]));
    if (!clear) continue;
    const flag = (/flag: ([a-z\/ -]+)/.exec(g[2].note || '') || [])[1] || null;
    const pt = e.resid >= 0x1000 && e.resid < 0x1200 ? e.resid - 0x1000 : null;
    out.push({ resid: e.resid, pt, name: pt !== null ? (propDisplayName(pt) || ('prop 0x' + pt.toString(16))) : (labelFor(e.resid) || ''),
               flag, lo: dvmVal(e.resid, g[5]), hi: dvmVal(e.resid, g[6]), is: dvmVal(e.resid, g[8]) });
  }
  return out;
}

/* WHAT WEARING IT DOES. A few classes set a character flag in their Wear
   method and clear it again when the thing comes off: that is the whole of
   what protective clothing is in this game, and it is not in any field the
   item page shows. Read per class and per method, so the page can say it
   on the item's own page and in one table. */
function grantRules() {
  const rows = [];
  for (let pt = 1; pt < 512; pt++) {
    let cls = null;
    try { cls = parseItemClass(pt); } catch (e) { cls = null; }
    if (!cls || !cls.code.length) continue;
    const ops = dvmOpsOf(dvmScriptEntry(cls.resid));
    for (const m of cls.code) {
      const mine = ops.filter(o => o.obj === m.off);
      if (!mine.length) continue;
      const sets = dvmSeqAll(mine, [/^sys SetFlag$/, /^arg Arg\d+$/, DVM_NUM]).map(g => g[2]);
      if (!sets.length) continue;
      for (const op of sets) {
        const name = (/flag: ([a-z\/ -]+)/.exec(op.note || '') || [])[1] || null;
        // The method that takes it away again, where the class has one: the
        // same flag cleared in another of its methods. Without this the page
        // would have to say "while worn" on faith.
        let clearedBy = null;
        for (const other of cls.code) {
          if (other.key === m.key) continue;
          const theirs = ops.filter(o => o.obj === other.off);
          if (dvmSeqAll(theirs, [/^sys ClearFlag$/, /^arg Arg\d+$/, DVM_NUM]).some(g => dvmNum(g[2]) === dvmNum(op))) { clearedBy = itemFieldLabel(other.key); break; }
        }
        rows.push({ pt, resid: cls.resid, key: m.key, method: itemFieldLabel(m.key), clearedBy,
                    name: propDisplayName(pt) || ('prop 0x' + pt.toString(16)),
                    flag: dvmVal(cls.resid, op), flagName: name });
      }
    }
  }
  return rows;
}

/* WHAT A BOMB DOES. The one thing in the game that damages a square rather
   than a target: when its fuse runs out it walks the three by three around
   itself and hands each square a figure, the biggest on its own square. The
   three figures and the damage type are read off the script; which figure
   belongs to which ring is read off the guards, so a changed script says
   what it now does rather than what this one did. */
function blastRules() {
  const e = dvmScriptEntry(0x1142);
  if (!e) return null;
  const ops = dvmOpsOf(e);
  const val = op => dvmVal(0x1142, op);
  const both = dvmSeqFirst(ops, [/^if_not$/, /^local Var\w+$/, DVM_NUM, /^eq$/, /^local Var\w+$/, DVM_NUM, /^eq$/, /^and$/, /^then /, /^set_local 0x08$/, DVM_NUM]);
  const either = dvmSeqFirst(ops, [/^if_not$/, /^local Var\w+$/, DVM_NUM, /^eq$/, /^local Var\w+$/, DVM_NUM, /^eq$/, /^or$/, /^then /, /^set_local 0x08$/, DVM_NUM]);
  const rest = dvmSeqAll(ops, [/^set_local 0x08$/, DVM_NUM]).map(g => g[1])
    .filter(op => (!both || op !== both[10]) && (!either || op !== either[10]));
  const hit = dvmSeqFirst(ops, [/^call_resource 0xEB8$/, /^local Var\w+$/, /^local Var\w+$/, DVM_NUM]);
  const span = dvmSeqFirst(ops, [/^sys RangeIterator$/, /^word &Var\w+$/, DVM_NUM, DVM_NUM, DVM_NUM]);
  if (!both || !hit) return null;
  return { resid: 0x1142, centre: val(both[10]), edge: either ? val(either[10]) : null, corner: rest.length ? val(rest[0]) : null,
           type: val(hit[3]), side: span ? val(span[4]) : null,
           fuse: (dvmSeqFirst(ops, [/^set_field data1/, /^arg Arg00$/, /^end$/, DVM_NUM]) || [])[3] ? val(dvmSeqFirst(ops, [/^set_field data1/, /^arg Arg00$/, /^end$/, DVM_NUM])[3]) : null };
}

/* THE TO DO LIST. A character's script appends a line with the syscall
   delvmod names AddQuest, which the application calls cbAddToDo and which
   reaches TToDo::AddToDo. Its first operand is the slot, and the slot is
   used as handed -- the entry is base + slot * 8 -- so the number in the
   script is the number in the saved game. Its second operand is a reference
   into a text array, written `0x021A[0] + n`, and n is the line.

   Slot and line are usually the same number. Six sites pass a different
   line, so one slot reads differently depending on who told you, and one
   site composes the line from a quest value, which is how the ten lines
   counting the Books of Wisdom are reached when no script names them. The
   text array is joined by its own index field, which is not its position in
   the array beyond entry 37. Nothing here is a "quest": these calls touch
   neither the quest values nor the quest flags. */
function todoRules() {
  const adds = [], dones = [];
  let textResid = null;
  for (const e of buildScriptTextIndex()) {
    const ops = dvmOpsOf(e);
    for (let i = 0; i < ops.length; i++) {
      const t = ops[i].text;
      if (/^sys CompleteQuest$/.test(t) && ops[i + 1] && DVM_NUM.test(ops[i + 1].text)) {
        dones.push({ resid: e.resid, slot: dvmVal(e.resid, ops[i + 1]) });
        continue;
      }
      if (!/^sys AddQuest$/.test(t)) continue;
      const slotOp = ops[i + 1], refOp = ops[i + 2], idxOp = ops[i + 3];
      if (!slotOp || !refOp || !idxOp || !DVM_NUM.test(slotOp.text) || !DVM_NUM.test(idxOp.text)) continue;
      // The text reference renders as the resource and an index; the array
      // is read off whichever resource the scripts themselves name.
      const m = /(0x[0-9A-Fa-f]+)\[(\d+)\]\s*$/.exec(refOp.text);
      if (!m) continue;
      if (textResid === null) textResid = parseInt(m[1], 16);
      const state = ops[i + 4] && /^sys GetState$/.test(ops[i + 4].text) && ops[i + 5] && DVM_NUM.test(ops[i + 5].text)
        ? dvmVal(e.resid, ops[i + 5]) : null;
      adds.push({ resid: e.resid, slot: dvmVal(e.resid, slotOp), line: dvmVal(e.resid, idxOp), base: +m[2], state });
    }
  }
  let lines = null;
  if (textResid !== null && refExists(textResid)) {
    try {
      const d = smartDecrypt(getResourceBytes(textResid), textResid);
      lines = new Map(parseDelverTextArray(d.data).map(x => [x.index, x.str]));
    } catch (err) { lines = null; }
  }
  return { adds, dones, textResid, lines };
}

/* EGGS. A prop record with flags 0x42 is not a thing standing on a square
   but a trigger: its aspect is the kind and its low ten bits the kind's
   argument. The file says neither, so the names below are this page's, from
   the eleven handlers TGameViewer::DrawRoutine dispatches through (the
   workbench's save-format.md has each handler's address and what it does).
   Everything stated on the sheet -- which kinds are used, their arguments,
   how many of each -- is counted off the archive here, so an archive that
   places eggs differently says so. Flags 0x44 is ROOF and is not an egg. */
const EGG_KIND_NAMES = [
  { what: 'hatches a monster' },
  { what: 'a way to another place', arg: 'zoneport' },
  { what: 'signals the zone’s script when stood on', arg: 'signal' },
  { what: 'an ambient sound', arg: 'sound' },
  { what: 'changes zone', arg: 'zone' },
  { what: 'plays music', arg: 'tune' },
  { what: 'signals the zone’s script from anywhere inside it', arg: 'signal' },
  { what: 'brings neighbours in when a condition holds' },
  { what: 'a room', arg: 'room' },
  { what: 'nothing' },
  { what: 'counts down' }
];

/* What one egg does, in full. The kind is the aspect and the argument is the
   bits a thing would keep its prop type in; past that, each kind reads its
   own fields, and two of them are worth saying out loud.

   A HATCHING egg holds its monsters as contained records, the way a chest
   holds what it holds, and TActiveMonster::HatchEgg reads the conditions off
   the egg's own Data1 and Data2. The chance is a roll of rand modulo 100
   compared against Data2, and it passes when the roll is less than or equal,
   so the odds are Data2 PLUS ONE in a hundred: a Data2 of zero is one in a
   hundred rather than never, and 100 is always. Data1 bit 0x10 holds it to
   daylight and 0x20 to the night, the clock being compared against 24576 and
   73728, which at 4096 units an hour are six in the morning and six at night.
   Bit 0x01 is "only once", done by writing 101 into the chance so no later
   roll can pass. Bit 0x04 stops the hatched creature being turned to face a
   random way. Bit 0x08 is set on a few eggs and is read nowhere in the
   hatching path, so nothing is claimed for it.

   An AMBIENT SOUND egg names a sound resource, 0x9100 plus the argument, and
   these are placed by terrain rather than by event: every one of the hundred
   carrying 0x9106, Waves / Seashore Loop, stands on water, and the frogs
   stand in the swamps. That is why the draw loop's dispatch does nothing with
   them; the audio side registers them through TAudio::Ambient, which keeps
   the nearest emitter of each sound and pans it with CalcStereo. */
/* What an egg does, in words, and where `linked` is set as chips to the
   things it names: the creatures it hatches, the sound it plays, the room
   or the place it leads to.

   The flag is not decoration. Both hover cards are `pointer-events:none`,
   so a link drawn in one could never be clicked; the inspector's card is
   what a tap opens and what can hold them. So the sentence is built once
   and each piece is wrapped by `one`, which is a chip in the inspector and
   escaped text in the card. */
function eggDetail(g, allProps, linked) {
  const k = EGG_KIND_NAMES[g.aspect];
  const one = (text, js) => linked && js ? svLink(String(text), js) : svEsc(String(text));
  if (g.aspect === 3) {
    const rid = 0x9100 + g.proptype;
    const nm = refExists(rid) ? labelFor(rid) : null;
    return nm ? 'the sound of ' + one(String(nm).toLowerCase(), 'jumpToResource(' + rid + ')')
              : 'an ambient sound, ' + one(propWordHex(rid), refExists(rid) ? 'jumpToResource(' + rid + ')' : null);
  }
  if (g.aspect === 0) {
    const held = containerContents(g, allProps || []);
    const chance = g.d2 >= 99 ? 'always' : (g.d2 + 1) + (g.d2 === 0 ? ' time in 100' : ' times in 100');
    const when = [];
    if (g.d1 & 0x10) when.push('by day');
    if (g.d1 & 0x20) when.push('by night');
    /* Bit 0x08 is set and not decoded. Odemia's five chicken eggs carry d1
       0x18, its goat 0x0A and its guards 0x14 and 0x24, so the bit appears
       beside day, beside night and on its own: it is a real condition of the
       kind-0 egg and nothing here knows what it says. Said out loud rather
       than dropped, because a reader comparing two eggs would otherwise see
       them described identically when the file distinguishes them. */
    if (g.d1 & 0x08) when.push('and a condition at bit 0x08 that is not read here');
    // "only once" rather than "once": with the chance at always, a bare
    // "always, once" reads as a contradiction where it means guaranteed the
    // first time and never after.
    if (g.d1 & 0x01) when.push('only once');
    // Each creature by name, and in the inspector each one opens its own
    // page. An egg holding no records says "something" because the file
    // gives it nothing to hatch, which is worth seeing rather than hiding.
    const names = held.map(h => one(propDisplayName(h.proptype) || ('prop ' + h.proptype),
                                    'showItemDetail(' + h.proptype + ')'));
    return 'hatches ' + (names.length ? names.join(' and ') : 'something') + ', ' + svEsc(chance) +
           (when.length ? ', ' + svEsc(when.join(' and ')) : '');
  }
  if (g.aspect === 1) {
    // A way somewhere: name where it lands rather than the number alone.
    let z = null;
    try { z = zoneportInfo(g.proptype); } catch (e) { z = null; }
    return z ? 'a way to ' + one(z.name, 'jumpToResource(' + z.resid + ')') +
               svEsc(', square ' + z.x + ', ' + z.y)
             : 'a way to another place, zoneport ' + svEsc(String(g.proptype));
  }
  if (g.aspect === 8) {
    const rid = 0x1B00 + g.proptype;
    return 'a room, ' + one('room ' + g.proptype, refExists(rid) ? 'jumpToResource(' + rid + ')' : null);
  }
  if (g.aspect === 4) {
    const rid = 0x8000 + g.proptype;
    return 'changes zone to ' + one(labelFor(rid) || propWordHex(rid),
                                    refExists(rid) ? 'jumpToResource(' + rid + ')' : null);
  }
  return svEsc(k ? k.what : 'kind ' + g.aspect) + (k && k.arg ? ', ' + svEsc(k.arg + ' ' + g.proptype) : '');
}
/* WHERE A ROOM IS. A kind-8 egg is a room, and the room is not the egg's
   square: it is a rectangle around it, which the application computes in
   IsInArea__FssP8PropItem and CharEntry::GetRoom with the same arithmetic
   inlined. d1 and d2 are the size, and the rectangle is inclusive and
   centred on the egg, biased one square left and up when the size is even:

     left = ex - floor((d1 + 1) / 2)   right  = left + d1
     top  = ey - floor((d2 + 1) / 2)   bottom = top + d2

   so it is d1 + 1 squares wide and d2 + 1 tall. The workbench's
   save-format.md has the reading and the addresses; the figure to check this
   against is room 1 of Land King Hall, published there from a saved game as
   x 15..23, y 18..29 from the egg at (19,24) sized 8 by 11, which this
   reproduces. The un-biased formula gives y 19 and does not.

   Not one of the archive's 170 room eggs is a single square -- the smallest
   is 2 by 2 and the largest 22 by 22 -- so a ring on the trigger square
   misdrew every one of them. */
function eggRect(g) {
  const left = g.x - Math.floor((g.d1 + 1) / 2), top = g.y - Math.floor((g.d2 + 1) / 2);
  return { left, top, right: left + g.d1, bottom: top + g.d2, w: g.d1 + 1, h: g.d2 + 1 };
}
function eggCovers(g, tx, ty) {
  const r = eggRect(g);
  return tx >= r.left && tx <= r.right && ty >= r.top && ty <= r.bottom;
}
function eggKinds() {
  const kinds = new Map();
  let zones = 0, roofs = 0;
  /* What the kind-0 eggs hatch, counted while the lists are open.
     A hatching egg does not name its creatures: they are records in the same
     zone list that name the egg as their container (flags & 0x08, container =
     holder - 0x100), which is the join containerContents makes for one egg in
     the inspector. The kinds walk already has every list in its hands and
     threw the records away, so the tally rides it rather than reading the
     archive a second time. Counted by prop type, with the zones each is
     found in, and separately the eggs that hold nothing at all -- which the
     file does leave, and which is worth seeing rather than rounding away. */
  const hatch = new Map();
  let emptyEggs = 0;
  try {
    for (let z = 1; z < 0x100; z++) {
      if (!refExists(0x8100 + z)) continue;
      zones++;
      const list = parseDelverPropList(smartDecrypt(getResourceBytes(0x8100 + z), 0x8100 + z).data);
      for (const r of list) {
        if (r.flags === 0x44) { roofs++; continue; }
        if (r.flags !== 0x42) continue;
        if (!kinds.has(r.aspect)) kinds.set(r.aspect, { kind: r.aspect, n: 0, args: new Set() });
        const k = kinds.get(r.aspect);
        k.n++;
        k.args.add(r.proptype);
        if (r.aspect !== 0) continue;
        const held = containerContents(r, list);
        if (!held.length) { emptyEggs++; continue; }
        for (const h of held) {
          if (!hatch.has(h.proptype)) hatch.set(h.proptype, { proptype: h.proptype, n: 0, zones: new Set() });
          const e = hatch.get(h.proptype);
          e.n++;
          e.zones.add(z);
        }
      }
    }
  } catch (err) { return null; }
  if (!kinds.size) return null;
  // The rooms are checkable: a kind-8 egg's argument is a room number, and
  // a room number has a script at 0x1B00 + it. Anything else would mean the
  // kind has been read wrongly, so the sheet says how many resolve.
  const rooms = kinds.get(8);
  const named = rooms ? [...rooms.args].filter(a => refExists(0x1B00 + a)).length : 0;
  return { kinds: [...kinds.values()].sort((a, b) => a.kind - b.kind), zones, roofs,
           rooms: rooms ? { total: rooms.args.size, named } : null,
           hatch: [...hatch.values()].sort((a, b) => b.n - a.n || a.proptype - b.proptype),
           emptyEggs };
}

/* THE LIBRARY. Cythera's own writing is in the archive: the histories and
   bestiaries on its bookshelves, the three prophecies, the scrolls and
   letters, the signs over its doors, the words on its gravestones and
   inside its rings. Each lives in a text array of the 0x02xx range, and a
   prop shows one passage of one array: the class calls the document helper
   (0xE64 or 0xE65) with the array and the prop's own Data1 added to it, so
   a bookshelf's Data1 is which book it holds. The pairs are read off the
   classes rather than listed here, so an archive wired differently says so.

   Two questions fall out of that and the file answers both. A passage no
   placed prop and no script points at is written and never shown; a Data1
   with no passage behind it is a prop pointing at nothing. The first list
   was wrong twice while it had only placed props in it: three Sapphire
   volumes are handed over by Itanos, Prusa and Unhayt rather than placed,
   and the Wine Contract is handed over by Apis, so all four read as
   unreachable until `sys Create` was counted as a second source. */
/* sys Create's recipient is not always a register. Thirteen of the archive's
   twenty-seven flat Creates address it as a plain number, character 1 being
   the hero, so a pattern that insists on `global`/`arg`/`local` cannot see any
   of them. Both readers of Create below match on this one shape, so they
   cannot drift apart about what a Create looks like. */
const CREATE_RECIPIENT = /^(?:global|arg|local) |^(?:byte|short|word) /;
function libraryRules() {
  // Memoised: Loose ends and the Writings sheet both read this, and it is a
  // walk over every item class, every prop list and every script. A gallery
  // redraws far more often than the Mechanics sheet ever did.
  if (window.LIBRARY_RULES) return window.LIBRARY_RULES;
  const docs = new Map();
  const want = new Map();
  const sent = new Map();
  const doc = tid => {
    if (!docs.has(tid)) docs.set(tid, { resid: tid, readers: [], entries: [], placed: new Map(), made: new Map() });
    return docs.get(tid);
  };
  for (let pt = 1; pt < 512; pt++) {
    let cls = null;
    try { cls = parseItemClass(pt); } catch (e) { cls = null; }
    if (!cls || !cls.code.length) continue;
    let ops = [];
    try { ops = dvmOpsOf(dvmScriptEntry(cls.resid)); } catch (e) { continue; }
    // Two shapes say the same thing. A document opens in a window through
    // the helper; a caption is printed where it stands. Paper does both: a
    // scroll by Data1, and, when Data1 is the sentinel below, a picture whose
    // caption comes from another array by Data2.
    const wire = (g, refIdx, fieldIdx) => {
      const m = /(0x[0-9A-Fa-f]+)\[\d+\]\s*$/.exec(g[refIdx].text);
      if (!m) return;
      const field = /data2/.test(g[fieldIdx].text) ? 'd2' : 'd1';
      const d = doc(parseInt(m[1], 16));
      if (d.readers.some(r => r.pt === pt && r.field === field)) return;
      d.readers.push({ pt, resid: cls.resid, field, at: g[0].at,
                       name: propDisplayName(pt) || ('prop ' + pt) });
      if (!want.has(pt)) want.set(pt, []);
      want.get(pt).push({ d, field });
    };
    for (const g of dvmSeqAll(ops, [/^call_resource 0xE6[45]$/, /^arg Arg\d+$/, /\[\d+\]\s*$/, /^arg Arg\d+$/, /^get_field data[12]\b/, /^add$/])) wire(g, 2, 4);
    for (const g of dvmSeqAll(ops, [/^print$/, /\[\d+\]\s*$/, /^arg Arg\d+$/, /^get_field data[12]\b/, /^add$/])) wire(g, 1, 3);
    // A number the class tests its own Data against is a sentinel choosing a
    // path, not a passage: paper's 255 means "a picture, not a scroll". Left
    // in, it would be reported as a thing pointing at a passage that is not
    // there, which is the opposite of what it is.
    for (const g of dvmSeqAll(ops, [/^get_field data[12]\b/, VAL_ANY, /^eq$/])) {
      if (!sent.has(pt)) sent.set(pt, new Set());
      sent.get(pt).add(dvmNum(g[1]));
    }
    // The other way a class says "there is nothing here" is a bare truth test
    // on the field, with no number in it at all. The ring does that, and its
    // Data1 of 0 means a ring with no inscription rather than a ring pointing
    // at a passage that is missing.
    for (const g of dvmSeqAll(ops, [/^if_not$/, /^arg Arg\d+$/, /^get_field data[12]\b/, /^then /])) {
      if (!sent.has(pt)) sent.set(pt, new Set());
      sent.get(pt).add(0);
    }
  }
  if (!docs.size) return null;
  for (const d of docs.values()) {
    try { d.entries = parseDelverTextArray(smartDecrypt(getResourceBytes(d.resid), d.resid).data); }
    catch (e) { d.entries = []; }
  }
  // Where each passage is shown: every placed record of a reading class.
  try {
    for (let z = 1; z < 0x100; z++) {
      if (!refExists(0x8100 + z)) continue;
      for (const r of parseDelverPropList(smartDecrypt(getResourceBytes(0x8100 + z), 0x8100 + z).data)) {
        const ws = want.get(r.proptype);
        if (!ws || r.flags === 0xFF || (r.flags & 0x40)) continue;
        for (const w of ws) {
          const k = w.field === 'd2' ? r.d2 : r.d1;
          if (!w.d.placed.has(k)) w.d.placed.set(k, []);
          w.d.placed.get(k).push({ zone: 0x8000 + z, x: r.x, y: r.y, onMap: r.onMap });
        }
      }
    }
  } catch (e) { /* an archive with no prop lists says nothing about where */ }
  // The second source: a prop a script hands over rather than places. Create
  // takes the packed type, whose low ten bits are the prop type, and then
  // the value that lands in Data1.
  for (const e of buildScriptTextIndex()) {
    let ops = [];
    try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (const g of dvmSeqAll(ops, [/^sys Create$/, CREATE_RECIPIENT, DVM_NUM, DVM_NUM])) {
      const ws = want.get(dvmNum(g[2]) & 0x3FF);
      if (!ws) continue;
      const d1 = dvmNum(g[3]);
      for (const w of ws) {
        if (w.field !== 'd1') continue;
        if (!w.d.made.has(d1)) w.d.made.set(d1, []);
        w.d.made.get(d1).push({ resid: e.resid, at: g[3].at, name: labelFor(e.resid) || propWordHex(e.resid) });
      }
    }
  }
  for (const d of docs.values()) {
    const shown = new Set([...d.placed.keys(), ...d.made.keys()]);
    const have = new Set(d.entries.map(x => x.index));
    d.unshown = d.entries.filter(x => !shown.has(x.index) && String(x.str).trim());
    d.dangling = [...shown].filter(k => !have.has(k) &&
      !d.readers.some(r => (sent.get(r.pt) || new Set()).has(k))).sort((a, b) => a - b);
    d.shownCount = d.entries.length - d.unshown.length;
  }
  return window.LIBRARY_RULES = [...docs.values()].sort((a, b) => a.resid - b.resid);
}

/* LOOSE ENDS. Things the scenario's own scripts get wrong, each read off
   the line that causes it rather than collected from anywhere. Four kinds,
   and every one of them is a question the file can settle: a To Do line
   nothing ever strikes off; a line that shows another line's words; a quest
   value compared against a number no script ever assigns it, so the branch
   behind it cannot be taken; and a quest value or flag written and never
   read, or read and never written. The library's two lists join them. */
function looseEnds() {
  const VAL = /^(?:byte|short|word) (?:-?0x[0-9A-F]+|-?\d+)$/i;
  const asg = new Map(), tst = new Map(), reads = new Map(), writes = new Map();
  const flagAsg = new Map(), flagRead = new Map();
  const computed = new Set();
  const put = (m, k, v) => { if (!m.has(k)) m.set(k, new Set()); m.get(k).add(v); };
  // Every finding carries WHERE it was found, the same way `tst` below
  // already does: the resource and the offset of the instruction. Keeping
  // only the resource is what left half the Loose ends table unable to link
  // to anything, so the sheet had to render those rows as plain labels while
  // the rest were links. Deduped on resource and offset together, since one
  // script can touch the same value in several places.
  const putSite = (m, k, resid, at) => {
    if (!m.has(k)) m.set(k, new Map());
    m.get(k).set(resid + ':' + at, { resid, at });
  };
  for (const e of buildScriptTextIndex()) {
    let ops = [];
    try { ops = dvmOpsOf(e); } catch (err) { continue; }
    for (const g of dvmSeqAll(ops, [/^sys SetState$/, VAL, VAL])) {
      put(asg, dvmNum(g[1]), dvmNum(g[2])); putSite(writes, dvmNum(g[1]), e.resid, g[0].at);
    }
    // A value the script computes rather than states -- Selinus counting the
    // Sapphire volumes does SetState(5, GetState(5) + 1) -- can hold anything,
    // so nothing may be concluded about which numbers it reaches. Without
    // this the Books counter came out as "a test nothing can satisfy", which
    // is the opposite of true: it is the one value that counts up.
    for (const g of dvmSeqAll(ops, [/^sys SetState$/, VAL])) {
      putSite(writes, dvmNum(g[1]), e.resid, g[0].at);
      const after = ops[ops.indexOf(g[1]) + 1];
      if (after && !VAL.test(after.text)) computed.add(dvmNum(g[1]));
    }
    for (const g of dvmSeqAll(ops, [/^sys GetState$/, VAL])) putSite(reads, dvmNum(g[1]), e.resid, g[0].at);
    for (const g of dvmSeqAll(ops, [/^sys GetState$/, VAL, /^end$/, VAL, /^eq$/])) {
      const v = dvmVal(e.resid, g[3]);
      if (v) put(tst, dvmNum(g[1]), JSON.stringify({ v: v.v, resid: e.resid, at: g[3].at }));
    }
    for (const g of dvmSeqAll(ops, [/^sys SetStateFlag$/, VAL])) putSite(flagAsg, dvmNum(g[1]), e.resid, g[0].at);
    for (const g of dvmSeqAll(ops, [/^sys GetStateFlag$/, VAL])) putSite(flagRead, dvmNum(g[1]), e.resid, g[0].at);
  }
  // A comparison nothing can satisfy. Zero is every value's starting state,
  // so a test against it is always reachable and is not counted.
  const unreachable = [];
  for (const [k, set] of tst) {
    if (computed.has(k)) continue;
    const made = asg.get(k) || new Set();
    if (!made.size) continue;
    for (const s of set) {
      const t = JSON.parse(s);
      if (t.v !== 0 && !made.has(t.v)) unreachable.push({ state: k, want: t, assigned: [...made].sort((a, b) => a - b) });
    }
  }
  const only = (a, b) => [...a.keys()].filter(k => !b.has(k)).sort((x, y) => x - y);
  return { unreachable,
           writtenNeverRead: only(writes, reads), readNeverWritten: only(reads, writes),
           flagWrittenNeverRead: only(flagAsg, flagRead), flagReadNeverWritten: only(flagRead, flagAsg),
           writes, reads };
}

const VAL_ANY = /^(?:byte|short|word) (?:-?0x[0-9A-F]+|-?\d+)$/i;

/* PUZZLES. Two the file answers completely. The braziers in Alaric's void
   room keep the sequence in a quest value: each brazier's Data1 is its
   place in the order, lighting one whose place is the next after the value
   advances it, lighting any other resets the value to zero, and the last
   one prints its line. The Maayti buttons are a lookup table and nothing
   else: a button's Data1 and Data2 each carry a panel offset in the low
   nibble and, in the high nibble, which of seven arrays to use; pressing it
   takes each panel's aspect, reads it through the array, and stores the
   result, then signals when the two panels agree. The arrays are a blob in
   the class: seven pointers, then sixteen entries each. */
function puzzleRules() {
  const out = { braziers: null, buttons: null };
  const bz = dvmScriptEntry(0x113F);
  if (bz) {
    const ops = dvmOpsOf(bz);
    const val = op => dvmVal(0x113F, op);
    const step = dvmSeqFirst(ops, [/^get_field data1/, /^sys GetState$/, VAL_ANY, /^end$/, VAL_ANY, /^add$/, /^eq$/]);
    const last = dvmSeqFirst(ops, [/^get_field data1/, VAL_ANY, /^eq$/]);
    const says = ops.map(dvmOpString).filter(Boolean);
    if (step) out.braziers = { resid: 0x113F, state: val(step[2]), plus: val(step[4]),
                               last: last ? val(last[1]) : null,
                               say: says.filter(s => s.length > 60)[0] || null,
                               lit: says.filter(s => /lit|extinguish/i.test(s)) };
  }
  const bt = dvmScriptEntry(0x1104);
  if (bt) {
    let bytes = null;
    try { bytes = smartDecrypt(getResourceBytes(0x1104), 0x1104).data; } catch (e) { bytes = null; }
    const ops = dvmOpsOf(bt);
    const blob = ops.find(o => /^data </.test(o.text));
    let arrays = null;
    if (bytes && blob) {
      // The operand is an opcode byte, a two byte length, then the outer
      // array; each of its words carries the offset of one table in its low
      // half. Read rather than assumed: a table that does not decode is left
      // out rather than guessed at.
      const outer = dvmArrayWords(bytes, blob.at + 3);
      if (outer) {
        arrays = [];
        for (const w of outer) {
          const sub = dvmArrayWords(bytes, w & 0xFFFF);
          if (sub) arrays.push(sub);
        }
      }
    }
    const pt = 0x104;
    const buttons = [];
    let zone = null, records = null;
    try {
      for (let z = 1; z < 0x100; z++) {
        if (!refExists(0x8100 + z)) continue;
        const list = parseDelverPropList(smartDecrypt(getResourceBytes(0x8100 + z), 0x8100 + z).data);
        const here = list.filter(r => r.proptype === pt && r.flags !== 0xFF && !(r.flags & 0x40));
        if (!here.length) continue;
        zone = 0x8000 + z;
        records = list;
        // The panel a button drives is its OWN RECORD INDEX plus the low
        // nibble, not its position in this filtered list: the class does
        // `arg Arg00 + (data1 & 15)` and casts the result to a Prop. The two
        // agree only if the buttons run from record 0 with nothing between
        // them, and here they are records 82 to 157 with panels and doors
        // interleaved, so counting from the list printed panels that do not
        // exist. Resolve the record and keep it.
        const byIndex = new Map(list.map(r => [r.index, r]));
        for (const r of here)
          buttons.push({ x: r.x, y: r.y, d1: r.d1, d2: r.d2, index: r.index,
                         a: { panel: r.index + (r.d1 & 15), table: r.d1 >> 4, rec: byIndex.get(r.index + (r.d1 & 15)) || null },
                         b: { panel: r.index + (r.d2 & 15), table: r.d2 >> 4, rec: byIndex.get(r.index + (r.d2 & 15)) || null } });
        break;
      }
    } catch (e) { /* no prop lists, no buttons */ }
    // The rooms. Both panels a button drives carry the same door number in
    // their Data1, and a door with that number stands between them, so the
    // five rooms fall out of the records rather than being described here.
    const rooms = new Map();
    if (records) for (const b of buttons) for (const side of [b.a, b.b]) {
      if (!side.rec || !side.rec.d1) continue;
      if (!rooms.has(side.rec.d1)) rooms.set(side.rec.d1, { door: side.rec.d1, panels: new Map(), buttons: new Set(), doorRec: null });
      const rm = rooms.get(side.rec.d1);
      rm.panels.set(side.rec.index, side.rec);
      rm.buttons.add(b);
    }
    if (records) for (const r of records) {
      if (r.flags === 0xFF || (r.flags & 0x40)) continue;
      const rm = rooms.get(r.d1);
      if (rm && r.proptype !== 0x104 && !rm.panels.has(r.index) && !rm.doorRec) rm.doorRec = r;
    }
    if (arrays || buttons.length) out.buttons = { resid: 0x1104, blobAt: blob ? blob.at : null, arrays, buttons, zone, pt,
      rooms: [...rooms.values()].map(rm => ({ door: rm.door, doorRec: rm.doorRec,
        panels: [...rm.panels.values()].sort((a, b) => a.x - b.x), buttons: [...rm.buttons] })).sort((a, b) => a.door - b.door) };
  }
  out.riddles = riddleRules();
  out.tunes = tuneRules();
  return out;
}

/* TUNES. Three locks in the scenario are opened by playing or ringing things
   in an order, and all three encode the order the same way: as a base-16
   number, one nibble per note, compared against a single constant.

   The bells in the Tyrant's Tomb accumulate into a near word,
   near[8] = (near[8] * 0x10 + data1) & 0xFFFF, so only the LAST FOUR rings
   count and a misring can be rung out rather than restarting. The four bells
   carry 1 to 4 in Data1, ascending west to east, which settles a numbering
   the board had to adjudicate between two conventions.

   The instruments are handed an accumulator by the Instrument widget and mask
   it to the length of their tune: three nibbles for the lyre, five for the
   panpipes. Each instrument's gui Instrument call carries a list of the notes
   it can play, and a note n is the letter at 65 + n -- which is how the
   file's 0xF79C3 is the PHJMD players write down, and 0xFC6 is PMG. That
   mapping is derived, not assumed: it spells both of the community's strings,
   and a mapping shifted by one spells neither.

   A tune's signal opens the prop carrying it in Data1, the same mechanism the
   Hall of Truth buttons use. */
function tuneRules() {
  const out = { bells: null, instruments: [] };
  const letter = n => String.fromCharCode(65 + n);
  const nibbles = (v, n) => v.toString(16).toUpperCase().padStart(n, '0').split('').map(c => parseInt(c, 16));
  /* What a signal opens is NOT in the archive, and the first version of this
     reader claimed it was. It matched every prop whose Data1 equalled the
     signal, archive wide, and reported that the bells open a plaque in
     Cademia, a torch in Kosha, three bookshelves in Pnyx and a Hall of Truth
     button. Two separate errors: these are small integers reused everywhere
     as an ordinary field, and on a door Data1 is not a signal at all -- the
     door class tests `data1 < 128` and hands eight aspect values to 0xE40,
     which is the opening helper, comparing the door's ASPECT against them for
     "Locked!" and "Magically Locked!".

     EmitSignal is opcode 0xC5, cbSendSignal, and the eggs reach the same
     thing as TGameSys::SendSignal (the workbench's save-format.md). Delivery
     is the engine's: no class in the archive has a handler, the stone door
     that demonstrably answers the Hall of Truth buttons included. So the
     sheet states the signal a tune emits and stops there. */

  // ---- the bells -----------------------------------------------------
  const bellEntry = dvmScriptEntry(0x10C1);
  if (bellEntry) {
    const ops = dvmOpsOf(bellEntry);
    // the shift is `load_near_word, byte, mul, ..., add, word, bitwise_and`
    const shift = dvmSeqFirst(ops, [/^load_near_word/, DVM_NUM, /^mul$/]);
    const orders = [];
    for (const m of dvmSeqAll(ops, [/^load_near_word/, DVM_NUM, /^eq$/, /^then/, /^sys EmitSignal$/, DVM_NUM])) {
      const tune = dvmVal(0x10C1, m[1]), sig = dvmVal(0x10C1, m[5]);
      if (!tune || !sig) continue;
      orders.push({ tune, signal: sig, rings: nibbles(tune.v, 4) });
    }
    const bells = [];
    let zone = null;
    try {
      for (let z = 1; z < 0x100; z++) {
        if (!refExists(0x8100 + z)) continue;
        const here = parseDelverPropList(smartDecrypt(getResourceBytes(0x8100 + z), 0x8100 + z).data)
          .filter(r => r.proptype === 0xC1 && r.flags !== 0xFF && !(r.flags & 0x40) && r.d1);
        if (here.length < 2) continue;
        zone = 0x8000 + z;
        for (const r of here.sort((a, b) => a.x - b.x)) bells.push({ x: r.x, y: r.y, number: r.d1 });
        break;
      }
    } catch (e) { /* no prop lists */ }
    if (orders.length) out.bells = { resid: 0x10C1, base: shift ? dvmVal(0x10C1, shift[1]) : null, orders, bells, zone };
  }

  // ---- the instruments -----------------------------------------------
  for (const [resid, what] of [[0x1099, 'panpipes'], [0x109A, 'lyre']]) {
    const entry = dvmScriptEntry(resid);
    if (!entry) continue;
    let bytes = null;
    try { bytes = smartDecrypt(getResourceBytes(resid), resid).data; } catch (e) { continue; }
    const ops = dvmOpsOf(entry);
    // the test is `arg, word mask, bitwise_and, word tune, eq`
    const m = dvmSeqFirst(ops, [/^arg /, DVM_NUM, /^bitwise_and$/, DVM_NUM, /^eq$/]);
    if (!m) continue;
    const mask = dvmVal(resid, m[1]), tune = dvmVal(resid, m[3]);
    const emit = dvmSeqFirst(ops, [/^sys EmitSignal$/, DVM_NUM]);
    const sig = emit ? dvmVal(resid, emit[1]) : null;
    if (!mask || !tune) continue;
    const len = Math.round(Math.log2(mask.v + 1) / 4);
    const notes = nibbles(tune.v, len);
    // Each gui Instrument call carries the notes that instrument can play.
    const lists = [];
    for (const o of ops.filter(o => /^data </.test(o.text))) {
      const words = dvmArrayWords(bytes, o.at + 3);
      if (words) lists.push({ at: o.at, notes: words, spelled: words.map(letter).join('') });
    }
    // Only a prop whose Data1 matches can be the working one, where the class
    // tests it. Read the test rather than stating which instrument it is.
    const gate = dvmSeqFirst(ops, [/^get_field data1/, DVM_NUM, /^eq$/]);
    out.instruments.push({ resid, what, mask, tune, signal: sig,
      notes, spelled: notes.map(letter).join(''),
      gate: gate ? dvmVal(resid, gate[1]) : null, lists,
      given: createsOf(resid === 0x1099 ? 0x99 : 0x9A) });
  }
  return out;
}

/* WHAT A SIGNAL REACHES. Scripts emit signals all over the scenario -- the
   bells, both music locks, the Hall of Truth buttons, every lever -- and
   nothing in the ARCHIVE says what answers one. No class has a handler, not
   even the stone door that demonstrably opens when a Hall of Truth button is
   pressed. The answer is in the application, in TGameSys::SendSignal, and
   this reads it there rather than guessing from the records.

   The order, from the routine itself: a signal of zero returns at once;
   otherwise GetMessage (method 21) goes to the ZONE, then to the ROOM; then,
   only when the signal is below 256, to every prop of the level whose flags
   pass a mask, whose class carries a flag bit, and WHOSE DATA1 EQUALS THE
   SIGNAL; then to all 512 character slots; then TGremlin::OnSignal.

   The mask is worth stating carefully. The instruction is `li 0, -163`, which
   is 0xFFFFFF5D, and it is ANDed with a byte, so the test is `flags & 0x5D`
   being 0 or 1. Against the archive's own conventions that excludes eggs
   (0x42 -> 0x40), roofs (0x44 -> 0x44) and contained props (0x09), and admits
   a plain placed prop, which is what the rule should do.

   One thing this deliberately does NOT say is which classes carry the flag.
   That table is *(r2-30424), one long per class indexed by prop type times
   four -- the same table the workbench's item-dragging-spec.md documents from
   the 68K side at A5+$21488, where $200000 is slidable and $100000 droppable
   and the signal bit is $10000. It cannot be read out of the program image:
   the pointer resolves into the data section and every long there is zero, so
   it is built at load time. The control that established that, rather than
   leaving "no class listens" on the page, was counting the slidable and
   droppable classes: both came back zero, which is impossible for a shipped
   game and proved the read empty rather than the table. */
function signalRules() {
  const r = exeRoutineNamed('TGameSys::SendSignal');
  if (!r) return null;
  const ops = exeOpsOf(r);
  if (!ops.length) return null;
  const imm = o => (o && o.d && typeof o.d.imm === 'number') ? o.d.imm : null;
  // Matched by the SHAPE of the instructions, never by address, so a
  // differently built application still reads or else says nothing.
  const first = (mn, v) => ops.find(o => o.mn === mn && imm(o) === v) || null;
  const method = first('li', 21);
  const under = first('cmpwi', 256);
  const slots = first('cmpwi', 512);
  const mask = first('li', -163);
  const stride = ops.find(o => o.mn === 'addi' && o.d && o.d.rd === o.d.ra && imm(o) === 16) || null;
  const calls = ops.filter(o => o.mn === 'bl' && o.to !== null && o.to !== undefined)
                   .map(o => ({ at: o.at, name: exeTargetName(o.to) }));
  const sends = calls.filter(c => /DoInterp/.test(c.name));
  const gremlin = calls.find(c => /OnSignal/.test(c.name)) || null;
  if (!method || !under || !slots) return null;
  return {
    name: r.name, at: r.offset, length: r.length,
    method: exeVal(method, 21), under: exeVal(under, 256), slots: exeVal(slots, 512),
    mask: mask ? exeVal(mask, 0x5D) : null, stride: stride ? exeVal(stride, 16) : null,
    sends: sends.length, sendAt: sends.length ? exeVal({ at: sends[0].at }, sends.length) : null,
    gremlin: gremlin ? { name: gremlin.name, val: exeVal({ at: gremlin.at }, 0) } : null
  };
}

/* Who hands a prop over. sys Create is (recipient, aspect<<10|proptype,
   data1, data2), a signature delv-script.js records from the board and
   confirms against call sites -- Ennomus's tomb key is Create(you, 3<<10|66,
   5, 0), and the archive has exactly that.

   The recipient is NOT always a register. Thirteen of the archive's
   twenty-seven flat Creates address it as a plain number, character 1 being
   the hero, and a pattern that insists on `global`/`arg`/`local` cannot see
   any of them. libraryRules carried that narrower pattern until 14 September
   2026: it cost nothing on this archive, because every document handed over
   goes through `global PlayerCharacter`, but it would have under-counted in a
   modded one. Both read CREATE_RECIPIENT now. */
function createsOf(proptype) {
  const out = [];
  const RECIPIENT = CREATE_RECIPIENT;
  try {
    for (let subn = 0; subn < 256; subn++) {
      const mi = masterIndexGlobal && masterIndexGlobal[subn];
      if (!mi || !mi[0]) continue;
      for (let ri = 0, n = subindexCount(subn); ri < n; ri++) {
        const resid = ((subn + 1) << 8) | ri;
        if (!refExists(resid)) continue;
        let ops = null;
        try { ops = dvmOpsOf(dvmScriptEntry(resid)); } catch (e) { continue; }
        if (!ops) continue;
        for (const m of dvmSeqAll(ops, [/^sys Create$/, RECIPIENT, DVM_NUM, DVM_NUM])) {
          const ap = dvmNum(m[2]);
          if (ap === null || (ap & 0x3FF) !== proptype) continue;
          out.push({ resid, name: labelFor(resid) || null, at: m[0].at, data1: dvmVal(resid, m[3]) });
        }
      }
    }
  } catch (e) { /* no archive */ }
  return out;
}

/* THE RIDDLES. The five buttons in the Hall of Truth each speak a riddle and
   take a spoken answer: 0x1110 opens a conversation, prints one of five
   strings chosen by the button's own Data1, and accepts one keyword. Get it
   right and it emits the button's Data2 as a signal; a stone door carrying
   that number in its Data1 is what opens.

   The five strings are reached through a table of DREFS. A dref is
   0x80000000 | resid << 16 | offset (js/delv-script.js), so the entries read
   0x91100068 and the rest, every one of them pointing back into 0x1110
   itself, and the text at each offset runs to a NUL.

   That last detail took three readings and the two wrong ones are worth
   recording, because the first looked right. Reading a length byte at the
   offset gives " am always hungry," -- the byte there is 'I', 73, a perfectly
   plausible length, so the string comes out long and almost correct with its
   first character eaten. Reading a length byte before the offset gives
   "I am al". Neither is a Pascal string; there is no length anywhere. The
   same mistake, a swallowed leading byte, once produced a false claim in this
   project that a hundred dialogues held unrendered text, so the smoke pins
   the first riddle whole and pins what the wrong reading would give.

   dvmStringObjects finds this prose too, but as separate lines, because it
   sweeps regions the disassembler could not reach rather than following the
   table. Whole riddles need the table. */
function riddleRules() {
  const entry = dvmScriptEntry(0x1110);
  if (!entry) return null;
  let bytes = null;
  try { bytes = smartDecrypt(getResourceBytes(0x1110), 0x1110).data; } catch (e) { return null; }
  const ops = dvmOpsOf(entry);
  const blob = ops.find(o => /^data </.test(o.text));
  const table = blob ? dvmArrayWords(bytes, blob.at + 3) : null;
  const text = [];
  if (table) for (const w of table) {
    if (!(w & 0x80000000) || ((w & 0x7FFF0000) >>> 16) !== 0x1110) { text.push(null); continue; }
    const off = w & 0xFFFF;
    let end = off;
    while (end < bytes.length && bytes[end]) end++;
    text.push(decodeMacRoman(bytes.slice(off, end)));
  }
  // The answers, in the order the script tests them, read off the opcodes
  // rather than listed here. A keyword with a comma is two spellings of one
  // answer, which is how "sound" also takes "noise".
  const answers = ops.map(o => {
    const m = /^conversation_response "([^"]*)"/.exec(o.text);
    return m ? m[1] : null;
  }).filter(Boolean);
  const buttons = [], doors = [];
  let zone = null;
  try {
    for (let z = 1; z < 0x100; z++) {
      if (!refExists(0x8100 + z)) continue;
      const list = parseDelverPropList(smartDecrypt(getResourceBytes(0x8100 + z), 0x8100 + z).data);
      const here = list.filter(r => r.proptype === 0x110 && r.flags !== 0xFF && !(r.flags & 0x40));
      if (!here.length) continue;
      zone = 0x8000 + z;
      for (const r of here) {
        const door = list.find(d => d.d1 === r.d2 && d.proptype !== 0x110 && d.flags !== 0xFF && !(d.flags & 0x40));
        buttons.push({ x: r.x, y: r.y, which: r.d1, signal: r.d2, door: door || null });
      }
      // The lone button of its own class, which emits from both its fields.
      for (const r of list.filter(r => r.proptype === 0x107 && r.flags !== 0xFF && !(r.flags & 0x40))) {
        const door = list.find(d => d.d1 === r.d1 && d.proptype !== 0x107 && d.flags !== 0xFF && !(d.flags & 0x40));
        doors.push({ x: r.x, y: r.y, signal: r.d1, second: r.d2, door: door || null });
      }
      break;
    }
  } catch (e) { /* no prop lists */ }
  buttons.sort((a, b) => a.which - b.which);
  return { resid: 0x1110, blobAt: blob ? blob.at : null, text, answers, buttons, zone, lone: doors };
}

/* WHO ANSWERS AS WHOM. A character's conversation is their own topics and
   then, for most of them, a generic set they fall through to: Naxos answers
   as House Comana, then as Cademia, then as Human. The chain is in the "*"
   catch-all, and dvmConversation already returns it as `groups`.

   The distinction that matters here, and that cost a rewrite of this reader:
   `groups` is INHERITANCE, the catch-all chain, while `groupsAll` also sweeps
   calls made from a single topic. Those are different things. The Student
   group answers "golem" by calling the Mage group, and eight groups answer
   "where is" by calling GiveDirections (0x816), which is not a group at all
   but a routine that opens with AddConversationKeyword "Where Is". Counting
   groupsAll as inheritance inflates every number and invents a hierarchy on
   top of routines; this reads `groups` and reports the calls separately.

   Three of the 0x8xx resources are not groups: 0x813 (Tavern rumors) and
   0x816 are routines with no topic list, and 0x803 (House Atussa, defunct)
   and 0x814 are stubs of 14 and 11 bytes. They are labelled as such rather
   than shown as groups with nothing in them. */
function convRules() {
  // Memoised for the same reason as libraryRules: the Dialogue gallery shows
  // this card, and building it walks all 256 conversation resources.
  if (window.CONV_RULES) return window.CONV_RULES;
  const chars = [];
  for (let rid = 0x1800; rid <= 0x18FF; rid++) {
    if (!refExists(rid)) continue;
    let c = null;
    try { c = conversationFor(rid); } catch (e) { c = null; }
    if (!c || !c.entries || !c.entries.length) continue;
    const chain = c.groups || [], all = c.groupsAll || [];
    chars.push({ rid, name: labelFor(rid) || propWordHex(rid), topics: c.entries.length,
                 deeper: c.entries.filter(e => e.sub && e.sub.length).length,
                 chain, calls: all.filter(g => chain.indexOf(g) < 0) });
  }
  const groups = [];
  for (let rid = 0x800; rid <= 0x8FF; rid++) {
    if (!refExists(rid)) continue;
    let c = null;
    try { c = conversationFor(rid); } catch (e) { c = null; }
    let bytes = 0;
    try { bytes = getResourceBytes(rid).length; } catch (e) { bytes = 0; }
    const topics = c && c.entries ? c.entries.length : 0;
    groups.push({ rid, topics, bytes,
                  name: (typeof DIALOGUE_GROUP_NAMES === 'object' && DIALOGUE_GROUP_NAMES[rid]) || null,
                  kind: topics ? 'group' : (bytes < 40 ? 'stub' : 'a routine, not a topic list'),
                  inherited: chars.filter(ch => ch.chain.indexOf(rid) >= 0).length,
                  called: chars.filter(ch => ch.calls.indexOf(rid) >= 0).length });
  }
  const gname = rid => {
    const g = groups.find(q => q.rid === rid);
    return (g && g.name) || labelFor(rid) || propWordHex(rid);
  };
  const shapes = new Map();
  for (const ch of chars) {
    const key = ch.chain.length ? ch.chain.map(gname).join(' > ') : '';
    if (!shapes.has(key)) shapes.set(key, []);
    shapes.get(key).push(ch);
  }
  return window.CONV_RULES = { chars, groups, gname,
           shapes: [...shapes.entries()].map(([k, who]) => ({ shape: k, who }))
                     .sort((a, b) => b.who.length - a.who.length) };
}

/* WHAT THE SCRIPTS LEAN ON. The archive's call graph is small and lopsided:
   most resources call nothing at all, and the few that are called are called
   by nearly everything. buildXrefIndex already computes it in both
   directions and is memoised, so this is a reading rather than an analysis.
   It counts four kinds of reference, and the difference shows: a text array
   like the To Do lines is referenced by two dozen scripts and called by
   none, because they name it in a `word` operand rather than calling it.

   The second half needs writing carefully, and the care is the point.
   "Referenced by nothing" is true of most of the archive and means nothing
   on its own: an item class is reached by its prop type, a dialogue by its
   character index, a room script by its room number, a skill by its skill
   number. Saying so as a headline would be the same mistake as calling the
   ambient-sound eggs "nothing". The cut that carries information is a
   resource unreferenced among siblings that ARE referenced: a helper nobody
   calls standing beside one with a hundred callers.

   Even then, the usual answer is that the application calls it by a
   hardcoded id, not that it is dead, and two ranges here prove it rather
   than assume it: the combat-AI hooks in 0x9xx are invoked by the compiled
   .ai rules that ship beside the game, and the 0x2xx arrays are the
   character-creation tables the dialog reads. So the card says "no script in
   this archive calls it", which is what was measured, and never "dead". */
function leanRules() {
  let idx = null;
  try { idx = buildXrefIndex(); } catch (e) { return null; }
  const inb = idx.inbound, outb = idx.outbound;
  let edges = 0;
  const kinds = {};
  for (const k of Object.keys(outb)) for (const e of outb[k]) { kinds[e.kind] = (kinds[e.kind] || 0) + 1; edges++; }
  const ranked = Object.keys(inb).map(Number).map(rid => ({
    rid, refs: inb[rid].length, calls: inb[rid].filter(e => e.kind === 'call').length
  })).sort((a, b) => b.refs - a.refs);
  const ranges = [];
  try {
    for (let subn = 0; subn < 256; subn++) {
      const mi = masterIndexGlobal && masterIndexGlobal[subn];
      if (!mi || !mi[0] || XREF_SKIP_SUBN.has(subn)) continue;
      let live = 0;
      const dead = [];
      const count = subindexCount(subn);
      for (let ri = 0; ri < count; ri++) {
        const rid = ((subn + 1) << 8) | ri;
        let raw = null;
        try { raw = getResourceBytes(rid); } catch (e) { raw = null; }
        if (!raw || !raw.length) continue;
        if (inb[rid]) live++; else dead.push({ rid, name: labelFor(rid) || null });
      }
      const total = live + dead.length;
      // A range nothing references at all is structural, not interesting.
      if (!total || !live || dead.length / total > 0.9) continue;
      const purpose = SUBINDEX_PURPOSE[subn];
      ranges.push({ subn, total, live, dead,
                    label: '0x' + (subn + 1).toString(16).toUpperCase() + 'xx',
                    what: purpose ? purpose[0] : '' });
    }
  } catch (e) { /* no archive open, and then there are no ranges to show */ }
  return { edges, kinds, ranked, ranges,
           referencing: Object.keys(outb).length, referenced: Object.keys(inb).length };
}

/* SPELLS. Every spell script casts through one helper, CastSpell (0xEA1),
   with the spell's level and its cost in magic points, so the two are read
   off each script's call. The helper says the rest: a cost above the
   caster's magic fails with "The spell requires more power than you
   currently have"; the cost is taken, the caster's timing rises by 10 plus
   twice the level, and the casting fails when two rolls of 0 to the
   caster's Casting figure (the skill, else a class figure) together fall
   short of a roll of 0 to the level. Nothing else about a spell -- what
   it does -- is a rule; that is the spell's own script. */
function spellRules() {
  const idx = buildScriptTextIndex();
  const helper = dvmScriptEntry(0xEA1);
  // The time a cast takes: timing + (base + mult x level).
  const tg = helper ? dvmSeqFirst(dvmOpsOf(helper), [/^get_field timing/, DVM_NUM, DVM_NUM, /^arg Arg01$/, /^mul$/, /^add$/]) : null;
  const rule = helper ? { power: /requires more power/.test(helper.text), failure: /You failed to cast/.test(helper.text),
    timing: !!tg, timeBase: tg ? dvmVal(0xEA1, tg[1]) : null, timeMult: tg ? dvmVal(0xEA1, tg[2]) : null,
    casting: /short (?:0x00C3|195)\b/.test((dvmScriptEntry(0xE85) || { text: '' }).text) } : null;
  const spells = [];
  for (const e of idx.filter(e => e.subn === 25)) {
    const ops = dvmOpsOf(e);
    for (let i = 0; i < ops.length; i++) {
      if (!/^call_resource CastSpell\b/.test(ops[i].text)) continue;
      const a = ops[i + 3], b = ops[i + 4];
      if (!(a && b && /^byte /.test(a.text) && /^byte /.test(b.text))) continue;
      spells.push({ resid: e.resid, name: selfNameFor(e.resid) || labelFor(e.resid) || ('0x' + e.resid.toString(16)),
                    level: dvmNum(a), cost: dvmNum(b), levelVal: dvmVal(e.resid, a), costVal: dvmVal(e.resid, b) });
      break;
    }
  }
  spells.sort((x, y) => x.level - y.level || x.cost - y.cost || x.name.localeCompare(y.name));
  return { rule, spells };
}

/* HUNGER. Nothing in the scripts lowers nutrition; the fall is the
   engine's. The scripts read it: the idle script complains below 4, the
   fountain and Nutrient add up to a ceiling of 100. */
function hungerNotes() {
  const idx = buildScriptTextIndex();
  const falls = idx.some(e => /set_field nutrition[\s\S]{0,120}sub/.test(e.text));
  // Every `nutrition < n`: the idle script's is the complaint, and the
  // largest anywhere else is the ceiling what adds to it stops at.
  const tests = [];
  for (const e of idx) {
    if (!/get_field nutrition/.test(e.text)) continue;
    for (const g of dvmSeqAll(dvmOpsOf(e), [/^get_field nutrition/, DVM_NUM, /^lt$/])) tests.push(dvmVal(e.resid, g[1]));
  }
  const complainsVal = tests.find(t => t.resid === 0x3020) || null;
  const others = tests.filter(t => t.resid !== 0x3020);
  const top = others.length ? Math.max.apply(null, others.map(t => t.v)) : null;
  const ceilingVal = top === null ? null : others.find(t => t.v === top);
  const ceilingBy = top === null ? [] : [...new Set(others.filter(t => t.v === top).map(t => t.resid))];
  return { falls, complains: complainsVal ? complainsVal.v : null, complainsVal, ceiling: top, ceilingVal, ceilingBy };
}

/* THE CLOCK, HUNGER, HEALING AND POISON, off the application's code. One
   routine, TGameViewer::DoTicks, advances the clock and does all four, and
   this reads it the way the trace in the workbench's doc/game-clock.md did,
   instruction by instruction:

   - the table of periods: an `addi r, 2, d` the counting loop indexes with
     `lwzx`, as many words as the loop's `cmpwi 0, n` bound, and the stack
     array the counts go into (`addi r, 1, base` before the `stwx`);
   - the hour and the quarter hour: the `srawi` that shifts the clock word
     before the call of ScheduleTime, and the one before DayTimeChanged;
   - the day: the `lis`/`addi` pair the roll-over loop compares against;
   - hunger: `lbz r, n(31)`, `addi 0, r, -k`, `stb 0, n(31)` -- the first
     byte of the record taken down -- and the count it is gated on;
   - healing: the level byte shifted (`srawi`) and capped (`cmpwi`, `li`),
     the counts indexed by it, gated on nutrition not being 0, and the two
     byte pairs it raises and caps (health against full health, magic
     against full magic);
   - poison and regeneration: the count the six-minute loop runs on, the two
     status bits it tests (`rlwinm.` to one bit each), the coin toss when
     both are set (a call of Random), and the `cmplwi 0, n` before the call
     of CharEntry::DeathRites.

   Each figure comes back as { v, exe } with the address of the instruction
   that holds it. A pattern that does not match leaves its figure null and
   the sheet drops the sentence that needed it. */
function exeClockRules() {
  const ops = exeOpsNamed('TGameViewer::DoTicks');
  if (!ops.length) return null;
  const val = (i, v) => i >= 0 ? exeVal(ops[i], v) : null;
  const r = {};
  // The period table and the counts.
  const ti = exeFind(ops, 0, 40, d => d.mn === 'addi' && d.ra === 2 && ops.some(o => o.d && o.d.mn === 'lwzx' && o.d.ra === d.rd));
  if (ti < 0) return null;
  const use = exeFind(ops, ti + 1, 200, d => d.mn === 'lwzx' && d.ra === ops[ti].d.rd);
  const store = exeFind(ops, use, 24, d => d.mn === 'stwx');
  const baseI = exeFindBack(ops, store, 4, d => d.mn === 'addi' && d.ra === 1);
  const boundI = exeFind(ops, store, 8, d => d.mn === 'cmpwi');
  if (use < 0 || store < 0 || baseI < 0 || boundI < 0) return null;
  const n = ops[boundI].d.imm, base = ops[baseI].d.imm;
  const periods = exeDataWords(exeTocOffset(ops[ti].d.imm), n);
  if (!periods) return null;
  r.table = val(ti, periods); r.count = val(boundI, n); r.countBase = base;
  const countIndex = d => d && d.mn === 'lwz' && d.ra === 1 && d.d >= base && d.d < base + 4 * n && (d.d - base) % 4 === 0 ? (d.d - base) / 4 : -1;
  // The hour and the quarter hour, by what each change calls.
  const sched = ops.findIndex(o => exeCalls(o, 'ScheduleTime'));
  const light = ops.findIndex(o => exeCalls(o, 'TGameViewer::DayTimeChanged'));
  const hs = sched >= 0 ? exeFindBack(ops, sched, 14, d => d.mn === 'srawi') : -1;
  const qs = light >= 0 ? exeFindBack(ops, light, 14, d => d.mn === 'srawi') : -1;
  r.hourShift = hs >= 0 ? val(hs, ops[hs].d.sh) : null;
  r.quarterShift = qs >= 0 ? val(qs, ops[qs].d.sh) : null;
  r.schedules = sched >= 0 ? val(sched, exeTargetName(ops[sched].to)) : null;
  r.lighting = light >= 0 ? val(light, exeTargetName(ops[light].to)) : null;
  // The day: the roll-over loop's limit.
  for (let i = 0; i < ops.length && !r.day; i++) {
    const a = ops[i].d; if (!a || a.mn !== 'lis') continue;
    const j = exeFind(ops, i + 1, 3, d => d.mn === 'addi' && d.ra === a.rd && d.rd === a.rd);
    if (j < 0) continue;
    const k = exeFind(ops, j + 1, 2, d => d.mn === 'cmpw' && d.rb === a.rd);
    if (k < 0 || !ops[k + 1] || !ops[k + 1].d || ops[k + 1].d.mn !== 'bf' || ops[k + 1].d.disp >= 0) continue;
    r.day = val(i, a.imm * 65536 + ops[j].d.imm);
  }
  // Hunger: the first record byte taken down by a constant.
  const fi = ops.findIndex((o, i) => o.d && o.d.mn === 'addi' && o.d.imm < 0 && o.d.ra === (ops[i - 1] && ops[i - 1].d && ops[i - 1].d.rt) &&
    ops[i - 1].d.mn === 'lbz' && ops[i - 1].d.ra === 31 && ops[i + 1] && ops[i + 1].d && ops[i + 1].d.mn === 'stb' && ops[i + 1].d.d === ops[i - 1].d.d);
  if (fi >= 0) {
    r.nutritionByte = val(fi - 1, ops[fi - 1].d.d);
    r.fall = val(fi, -ops[fi].d.imm);
    const ci = exeFindBack(ops, fi, 16, d => countIndex(d) >= 0);
    r.hungerIndex = ci >= 0 ? val(ci, countIndex(ops[ci].d)) : null;
  }
  // Healing: the level shifted and capped picks the count.
  const si = fi >= 0 ? exeFind(ops, fi, 16, d => d.mn === 'srawi') : -1;
  if (si >= 0 && ops[si - 1] && ops[si - 1].d && ops[si - 1].d.mn === 'lbz') {
    r.levelByte = val(si - 1, ops[si - 1].d.d);
    r.levelShift = val(si, ops[si].d.sh);
    const capI = exeFind(ops, si, 8, d => d.mn === 'cmpwi');
    r.levelCap = capI >= 0 ? val(capI, ops[capI].d.imm) : null;
    // Gated on nutrition: the nutrition byte tested against 0.
    const fed = exeFind(ops, si, 24, d => d.mn === 'lbz' && r.nutritionByte && d.d === r.nutritionByte.v);
    r.fedGate = fed >= 0 ? val(fed, 0) : null;
    const cmp1 = exeFind(ops, si, 30, d => d.mn === 'cmplw');
    const cmp2 = cmp1 >= 0 ? exeFind(ops, cmp1 + 1, 40, d => d.mn === 'cmplw') : -1;
    const pair = i => i >= 2 && ops[i - 1].d && ops[i - 2].d && ops[i - 1].d.mn === 'lbz' && ops[i - 2].d.mn === 'lbz' ? [val(i - 2, ops[i - 2].d.d), val(i - 1, ops[i - 1].d.d)] : null;
    r.healthBytes = cmp1 >= 0 ? pair(cmp1) : null;
    r.magicBytes = cmp2 >= 0 ? pair(cmp2) : null;
  }
  // Poison and regeneration: the six-minute loop.
  const rnd = ops.findIndex(o => exeCalls(o, 'Random'));
  if (rnd >= 0) {
    const bits = [];
    for (let i = exeFindBack(ops, rnd, 20, d => countIndex(d) >= 0); i >= 0 && i < rnd; i++) {
      const d = ops[i].d;
      if (d && d.mn === 'rlwinm.' && d.sh === 0 && d.mb === d.me && bits.length < 2 && !bits.some(b => b.v === 31 - d.mb)) {
        bits.push(val(i, 31 - d.mb));
        // The word the bits are of: the record word loaded just before.
        const w = ops[i - 1] && ops[i - 1].d;
        if (!r.statusWord && w && w.mn === 'lhz' && w.rt === d.rs && w.ra === 31) r.statusWord = val(i - 1, w.d);
      }
    }
    const pi = exeFindBack(ops, rnd, 20, d => countIndex(d) >= 0);
    r.poisonIndex = pi >= 0 ? val(pi, countIndex(ops[pi].d)) : null;
    r.poisonBit = bits[0] || null; r.regenBit = bits[1] || null;
    r.coinToss = val(rnd, 'Random');
    const death = ops.findIndex(o => exeCalls(o, 'CharEntry::DeathRites'));
    const dt = death >= 0 ? exeFindBack(ops, death, 6, d => d.mn === 'cmplwi') : -1;
    r.deathAt = dt >= 0 ? val(dt, ops[dt].d.imm) : null;
    // What a pass takes off a poisoned character's health and gives a
    // regenerating one: the health byte loaded, a constant added, stored back.
    const hb = r.healthBytes ? r.healthBytes[0].v : null;
    const step = (from, sign) => exeFind(ops, from, 40, (d, o) => d.mn === 'addi' && Math.sign(d.imm) === sign && d.imm !== 0 &&
      ops[ops.indexOf(o) - 1] && ops[ops.indexOf(o) - 1].d && ops[ops.indexOf(o) - 1].d.mn === 'lbz' && ops[ops.indexOf(o) - 1].d.d === hb);
    const ps = death >= 0 && hb !== null ? step(death, -1) : -1;
    const gs = ps >= 0 ? step(ps + 1, 1) : -1;
    r.poisonStep = ps >= 0 ? val(ps, -ops[ps].d.imm) : null;
    r.regenStep = gs >= 0 ? val(gs, ops[gs].d.imm) : null;
  }
  if (r.hourShift) r.unitsPerHour = { v: 1 << r.hourShift.v, exe: r.hourShift.exe };
  // The model's parameters, when everything it needs was read.
  const need = [r.unitsPerHour, r.levelShift, r.levelCap, r.hungerIndex, r.poisonIndex, r.fall, r.deathAt, r.poisonStep, r.regenStep];
  r.model = need.every(Boolean) ? { unitsPerHour: r.unitsPerHour.v, periods, levelShift: r.levelShift.v, levelCap: r.levelCap.v,
    hungerIndex: r.hungerIndex.v, poisonIndex: r.poisonIndex.v, fall: r.fall.v, deathAt: r.deathAt.v,
    poisonStep: r.poisonStep.v, regenStep: r.regenStep.v } : null;
  return r;
}
// A period of the table as a length of game time, in words.
function exeClockWords(units, perHour) {
  if (!perHour) return units + ' units';
  const min = units * 60 / perHour;
  if (Math.abs(min - 60) < 0.01) return 'an hour';
  if (min > 60 && Math.abs(min % 60) < 0.01) return (min / 60) + ' hours';
  if (min >= 1) { const m = Math.round(min); return (Math.abs(min - m) < 0.02 ? m : min.toFixed(1)) + ' minutes'; }
  return Math.round(min * 60) + ' seconds';
}

/* THE TALK BALLOON, off TBark: SetBark returns what TickCount answered plus
   a constant, the expiry ShowBarks tests each frame, and the constructor
   hands SetRect the balloon's width and height. */
function exeBarkRules() {
  const sb = exeOpsNamed('TBark::SetBark'), ct = exeOpsNamed('TBark::TBark');
  const r = {};
  const tc = sb.findIndex(o => exeCalls(o, 'TickCount'));
  const ai = tc >= 0 ? exeFind(sb, tc + 1, 3, d => d.mn === 'addi' && d.rd === 3 && d.ra === 3) : -1;
  r.ticks = ai >= 0 ? exeVal(sb[ai], sb[ai].d.imm) : null;
  const sr = ct.findIndex(o => exeCalls(o, 'SetRect'));
  const wi = sr >= 0 ? exeFindBack(ct, sr, 12, d => d.mn === 'li' && d.rd === 6) : -1;
  const hi = sr >= 0 ? exeFindBack(ct, sr, 12, d => d.mn === 'li' && d.rd === 7) : -1;
  r.width = wi >= 0 ? exeVal(ct[wi], ct[wi].d.imm) : null;
  r.height = hi >= 0 ? exeVal(ct[hi], ct[hi].d.imm) : null;
  return r.ticks || r.width ? r : null;
}

/* WHAT A COMMAND COSTS IN TIME. TGameSys::HeartBeat(n) is how a command
   spends the player's time, so every call of it with a constant in r4 is a
   cost, named by the routine that makes the call. A call whose r4 is worked
   out (an attack's, the slide's) has no one number and says so. */
function exeActionCosts() {
  return exeCallersOf('TGameSys::HeartBeat').map(c => {
    const k = exeFindBack(c.ops, c.i - 1, 3, d => d.rd === 4 || d.ra === 4);
    const d = k >= 0 ? c.ops[k].d : null;
    return { routine: c.routine, call: exeVal(c.ops[c.i], null), cost: d && d.mn === 'li' && d.rd === 4 ? exeVal(c.ops[k], d.imm) : null };
  });
}

/* WHO IS WHOSE ENEMY. TActiveMonster::GetEnemyStatus copies a table of
   words from the TOC onto the stack and answers the entry for one side's
   alignment byte times four plus the other's; a byte it tests first answers
   a constant for every pair when set (option-h). */
function exeEnemyTable() {
  const ops = exeOpsNamed('TActiveMonster::GetEnemyStatus');
  const ti = exeFind(ops, 0, 4, d => d.mn === 'addi' && d.ra === 2);
  if (ti < 0) return null;
  const reg = ops[ti].d.rd;
  const words = ops.filter(o => o.d && o.d.mn === 'lwz' && o.d.ra === reg).length;
  const table = exeDataWords(exeTocOffset(ops[ti].d.imm), words);
  const side = Math.round(Math.sqrt(words));
  if (!table || side * side !== words) return null;
  const ab = exeFind(ops, ti, 80, d => d.mn === 'lbz' && d.d > 0 && d.ra !== 5);
  const peace = exeFind(ops, ti, 60, d => d.mn === 'li' && d.rd === 3);
  // The byte tested first is a TOC slot; the key routine flips it with a
  // logical not (cntlzw, then the shift by 5).
  const slot = exeFind(ops, ti, 4, d => d.mn === 'lwz' && d.ra === 2);
  const keys = slot >= 0 ? exeOpsNamed('TMapWindow::KeyRoutine') : [];
  const load = keys.findIndex(o => o.d && o.d.mn === 'lwz' && o.d.ra === 2 && o.d.d === ops[slot].d.d);
  const flip = load >= 0 ? exeFind(keys, load, 5, d => d.mn === 'cntlzw') : -1;
  // The answer the enemy iterator keeps: cbEnemies compares r3 with it
  // straight after the call.
  const cb = exeOpsNamed('cbEnemies');
  const call = cb.findIndex(o => exeCalls(o, 'TActiveMonster::GetEnemyStatus'));
  const test = call >= 0 ? exeFind(cb, call + 1, 3, d => d.mn === 'cmpwi' && d.ra === 3) : -1;
  return { table: exeVal(ops[ti], table), side, alignmentByte: ab >= 0 ? exeVal(ops[ab], ops[ab].d.d) : null,
           peace: peace >= 0 ? exeVal(ops[peace], ops[peace].d.imm) : null, peaceKey: flip >= 0 ? exeVal(keys[flip], 'KeyRoutine') : null,
           enemy: test >= 0 ? exeVal(cb[test], cb[test].d.imm) : null };
}

/* WHERE A FLAG LIVES. TSpellFX::AddAbility sets a character flag by its
   number: below one bound a bit of one record byte, below the next a bit of
   the status word, below the last a bit of another byte, the range's first
   flag taken off the number to make the bit. So a status bit the tick
   routine tests is a flag number the scripts use: the bit plus that range's
   subtrahend. */
function exeAbilityMap() {
  const ops = exeOpsNamed('TSpellFX::AddAbility');
  const out = [];
  for (let i = 0; i < ops.length; i++) {
    const d = ops[i].d;
    if (!d || d.mn !== 'cmpwi') continue;
    const load = exeFind(ops, i + 1, 10, e => e.mn === 'lbzx' || e.mn === 'lhzx');
    if (load < 0) continue;
    const off = exeFind(ops, i + 1, load - i, e => e.mn === 'addi' && e.imm > 0 && e.ra !== 1 && e.ra !== 2);
    const sub = exeFind(ops, i + 1, load - i, e => e.mn === 'addi' && e.imm < 0);
    out.push({ below: exeVal(ops[i], d.imm), offset: off >= 0 ? exeVal(ops[off], ops[off].d.imm) : null,
               sub: sub >= 0 ? exeVal(ops[sub], -ops[sub].d.imm) : exeVal(ops[i], 0), word: ops[load].mn === 'lhzx' });
  }
  return out;
}
// The flag number of a status-word bit, with where its subtrahend was read.
function exeFlagOfStatusBit(bit, statusOffset) {
  const m = exeAbilityMap().find(x => x.word && x.offset && x.offset.v === statusOffset);
  return m && bit ? { v: bit.v + m.sub.v, exe: m.sub.exe } : null;
}

// What each spell does to health, read off its script: every damage call
// (0xEB8: victim, amount, type, source) and every write to health. The
// amount is a stack expression of constants, Random(a,b) rolls and adds.
function dvmAmountExpr(tokens) {
  const st = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    let m;
    if ((m = /^(?:byte|word|short) (-?0x[0-9A-F]+|-?\d+)$/i.exec(t))) { st.push({ base: parseInt(m[1]), rolls: [] }); continue; }
    if (/^sys Random$/.test(t)) {
      const a = /(-?\d+|0x[0-9A-F]+)$/i.exec(tokens[i + 1] || ''), b = /(-?\d+|0x[0-9A-F]+)$/i.exec(tokens[i + 2] || '');
      if (a && b && /^end$/.test(tokens[i + 3] || '')) { st.push({ base: 0, rolls: [[parseInt(a[1]), parseInt(b[1])]] }); i += 3; continue; }
      return null;
    }
    if (/^add$/.test(t)) { const y = st.pop(), x = st.pop(); if (!x || !y) return null; st.push({ base: x.base + y.base, rolls: x.rolls.concat(y.rolls) }); continue; }
    if (/^end$/.test(t)) continue;
    return null;
  }
  return st.length === 1 ? st[0] : null;
}
/* A roll in words. `Random(a, b)` yields a to b MINUS ONE -- `cbrnd` in the
   executable is `a + (rand mod (b - a))`, and 31 places in the archive write
   `Random(0, len(array))` and index that array with it -- so the operands are
   not the ends of the range and printing them as if they were overstates
   every roll on the sheet by a point. It said "a roll of 0 to 10" for
   Fireball's `Random(0, 10)` until 6 September 2026. Where a script passes a
   pair it cannot roll between (`a >= b`, which the routine answers with `a`),
   the one value is printed rather than a backwards range. */
function rollWords(r) {
  const lo = r[0], hi = r[1] - 1;
  return hi <= lo ? 'a fixed ' + lo : 'a roll of ' + lo + ' to ' + hi;
}
function amountWords(a) {
  if (!a) return '';
  const parts = [];
  if (a.base || !a.rolls.length) parts.push(String(a.base));
  const same = a.rolls.length && a.rolls.every(r => r[0] === a.rolls[0][0] && r[1] === a.rolls[0][1]);
  if (a.rolls.length === 1) parts.push(rollWords(a.rolls[0]));
  else if (a.rolls.length > 1 && same) parts.push(['two', 'three', 'four'][a.rolls.length - 2] + ' ' + rollWords(a.rolls[0]).replace(/^a roll of/, 'rolls of').replace(/^a fixed/, 'times'));
  else a.rolls.forEach(r => parts.push(rollWords(r)));
  return parts.join(' + ');
}
// The range an amount can come out at, the top end one short of the operand
// for the same reason rollWords is.
function amountRange(a) { return a ? [a.base + a.rolls.reduce((s, r) => s + r[0], 0), a.base + a.rolls.reduce((s, r) => s + Math.max(r[0], r[1] - 1), 0)] : null; }
// The damage type is a bit set: 0x03 edged or piercing, 0x04 blunt, 0x08
// fire, 0x20 electric, 0xC0 magic (Rules › resistance, 0x100 and 0x3040).
function damageTypeName(t) {
  const base = (t & 0x08) ? 'fire' : (t & 0x20) ? 'electric' : (t & 0x04) ? 'blunt' : (t & 0x03) ? 'edged' : 'plain';
  return ((t & 0xC0) ? 'magical ' : '') + base;
}
function spellEffects() {
  const idx = buildScriptTextIndex();
  const out = new Map();
  const strip = l => l.replace(/^\s*[0-9A-F]{4}\s+/, '').replace(/\s+\/\/.*$/, '').trim();
  for (const sp of spellRules().spells) {
    const e = dvmScriptEntry(sp.resid);
    if (!e) continue;
    // The instructions alone, comments off, in step with their offsets so
    // each effect can say where it was read.
    const ops = dvmOpsOf(e);
    const ls = ops.map(o => strip(o.text));
    const fx = { damage: [], heals: [] };
    for (let i = 0; i < ls.length; i++) {
      if (/^call_resource 0xEB8$/.test(ls[i])) {
        // victim token(s), the amount, the type, the source, end
        let j = i + 1; const victim = ls[j++];
        const expr = []; let type = null;
        for (; j < ls.length && !/^(global CurrentCharacter|word None|arg Arg00)/.test(ls[j]); j++) expr.push(ls[j]);
        const tm = /^byte (0x[0-9A-F]+|\d+)$/i.exec(expr[expr.length - 1] || '');
        if (tm) { type = parseInt(tm[1]); expr.pop(); }
        const amount = dvmAmountExpr(expr);
        // a victim from an iterator is everyone the effect reaches, unless
        // the lines before compare its square with the target's (Fireball)
        const before = ls.slice(Math.max(0, i - 14), i).join(' ');
        const area = /^local Var/.test(victim) ? (/get_field x \(0x1\) arg Arg01 eq/.test(before) ? 'the one on the target square' : /EnemyIterator/.test(ls.slice(Math.max(0, i - 40), i).join(' ')) ? 'every enemy' : 'everything in the effect') : 'the target';
        fx.damage.push({ who: area, amount, type, at: ops[i].at });
      }
      if (/^set_field health \(0x1C\)$/.test(ls[i])) {
        const seg = ls.slice(i + 1, i + 14);
        const k = seg.findIndex(l => /^get_field (health|full_health)/.test(l));
        if (k < 0) continue;
        const full = /full_health/.test(seg[k]);
        const rest = seg.slice(k + 1);
        const expr = [];
        for (const l of rest) { if (/^return$/.test(l) || /^set_local/.test(l)) break; expr.push(l); }
        // drop the trailing 'end' that closes the set_field
        while (expr.length && /^end$/.test(expr[expr.length - 1])) expr.pop();
        if (full) {
          const t = expr.join(' ');
          const q = /byte (0x[0-9A-F]+) div byte (0x[0-9A-F]+) add/i.exec(t);
          fx.heals.push({ text: q ? 'health to full ÷ ' + parseInt(q[1]) + ' plus ' + parseInt(q[2]) : !expr.length ? 'health to full' : 'health from full health', at: ops[i].at });
        } else {
          const a = dvmAmountExpr(['byte 0'].concat(expr));   // the current health is the first operand
          if (a) fx.heals.push({ text: 'health + ' + amountWords(a), amount: a, at: ops[i].at });
        }
      }
    }
    if (fx.damage.length || fx.heals.length) out.set(sp.resid, fx);
  }
  return out;
}
// Sleeping: the bed class (0x100E) picks a quality and the sleep helper
// (0xE93) multiplies what the engine healed during the night by it.
function sleepRules() {
  const idx = buildScriptTextIndex();
  const bed = dvmScriptEntry(0x100E), helper = dvmScriptEntry(0xE93);
  if (!bed || !helper) return null;
  const strip = t => t.replace(/^\s*[0-9A-F]{4}\s+/gm, '');
  const h = strip(helper.text);
  const bo = dvmOpsOf(bed), ho = dvmOpsOf(helper);
  // Your own bed: in room 2 the quality local is set to this.
  const ownG = dvmSeqFirst(bo, [/^global CurrentRoom/, /^short (?:0x0002|2)$/, /^eq$/, /^then /, /^set_local 0x00$/, DVM_NUM]);
  // The night: PassTime(n) for each of hours x k, then healed x quality / d.
  const qG = dvmSeqFirst(ho, [/^sys PassTime$/, DVM_NUM]);
  const hG = dvmSeqFirst(ho, [/^arg Arg00$/, DVM_NUM, /^mul$/]);
  const dG = dvmSeqFirst(ho, [/^arg Arg03$/, /^mul$/, DVM_NUM, /^div$/]);
  const ownVal = ownG ? dvmVal(0x100E, ownG[5]) : null, quarterVal = qG ? dvmVal(0xE93, qG[1]) : null,
        hoursVal = hG ? dvmVal(0xE93, hG[1]) : null, div = dG ? dvmVal(0xE93, dG[2]) : null;
  const own = ownVal ? ownVal.v : null, quarter = !!quarterVal, hours = !!hoursVal, half = !!div;
  const owner = /Out of my bed/.test(h);
  const toss = /toss and turn/.test(h);
  const soundly = /sleep soundly/.test(h);
  // The inn's quality: the bed reads global resource 0x301's array at a
  // slot the innkeeper's dialogue wrote when the room was paid for.
  const store = dvmScriptEntry(0x301);
  const am = store && /obj_0000 = \[([\d, ]+)\]/.exec(strip(store.text));
  const table = am ? am[1].split(',').map(x => parseInt(x.trim())) : null;
  const inns = [];
  for (const e of idx) {
    if (e.resid < 0x1800 || e.resid >= 0x1A00) continue;
    const g = dvmSeqFirst(dvmOpsOf(e), [/^write_far_word 0x03010016$/i, DVM_NUM]);
    if (g) { const slot = dvmNum(g[1]); inns.push({ who: e.resid - 0x1800, slot, slotVal: dvmVal(e.resid, g[1]), quality: table && table[slot] !== undefined ? table[slot] : null, qualitySrc: table ? { resid: 0x301, at: 0 } : null }); }
  }
  inns.sort((a, b) => a.who - b.who);
  return { own, ownVal, quarter, quarterVal, hours, hoursVal, half, div, owner, toss, soundly, table, inns };
}
