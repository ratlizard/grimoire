#!/usr/bin/env node
// Are the field names in a routine's pseudo-code (exeRecordFields and the
// record reading in exePseudoLines, js/page-views.js) the fields the bits
// are?
//
//   node utilities/pseudo_fields_check.mjs index.html "$TMPDIR/Cythera.data" delvmod
//   node utilities/pseudo_fields_check.mjs index.html "$TMPDIR/Cythera.data" delvmod --controls
//
// WHY. The names come from GetField's code: each case of its switch on a
// field number reads that field out of a record, and the bits it reads,
// named by delvmod's number for the field, name the same bits wherever the
// program reads them. A fault in following the bits (a rotate the wrong
// way, a byte off) would learn a wrong layout and print every name in the
// program against the wrong bits, and each line would still read well.
//
// THE ORACLE. delvmod reads the same prop records out of a map's prop list
// (delv/level.py, PropList.load_from_bfile and PropListEntry) without the
// program: a flag byte, x and y packed in three bytes (read_xy24), the
// aspect and the prop type in a word (read_uint6_uint10), then d3, whose
// high byte is d1 and low byte d2. The check reads those lines out of
// delvmod's source and fails if they have changed. Each Prop field
// GetField gives must then sit in the bits where delvmod reads the same
// field. The names differ between delvmod's two vocabularies (the prop
// list's `proptype` and `d1` are the interpreter's `obj_type` and
// `data1`), and the pairing is written below, in this check and not in
// the page. A character's record has a second reader, the save editor's
// parseDelverCharacterRecords (delvmod's wiki page for F009, and two bytes
// read out of the program), and each Character field GetField gives must
// sit on the bytes that reader gives the same field.
//
// THE LINES. A few routines are read whole and must name what they name:
// GetPropParent(PropItem*) tests its argument's flags against 24 and
// returns its container, DoTicks counts each prop's data1 down in a loop
// that steps a pointer through the props from Prop 256, and
// TActiveMonster::CanMove works out a prop's record by its index and
// compares its x and y with a square, and ScheduleTime tests a flag of a
// character's bit_flags in place, which names part of a field.
//
// THE CONTROLS, with --controls, each in a fresh page:
//   cell    a record's bits counted a byte late; the layout must fail;
//   rotate  a rotate taken the other way; the layout must fail;
//   facts   no record pointer carried into a block; the lines must fail.
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { join } from 'node:path';
import { pageSource } from './page_scripts.mjs';
import { makeSandbox } from './dom_stub.mjs';

const args = process.argv.slice(2);
const controls = args.includes('--controls');
const [htmlPath = 'index.html', dataPath, delvPath = 'delvmod'] = args.filter(a => !a.startsWith('--'));
if (!dataPath || !existsSync(dataPath)) { console.log('  skip  no application data fork at ' + dataPath); process.exit(0); }
if (!existsSync(join(delvPath, 'delv', 'level.py'))) { console.log('  skip  no delvmod at ' + delvPath); process.exit(0); }
const appBytes = new Uint8Array(readFileSync(dataPath));
const source = pageSource(htmlPath);
const levelPy = readFileSync(join(delvPath, 'delv', 'level.py'), 'utf8'), utilPy = readFileSync(join(delvPath, 'delv', 'util.py'), 'utf8');

// ---- the layout delvmod reads, from its source ----
const range = (a, b) => { const out = []; for (let i = a; i <= b; i++) out.push(i); return out; };
const delvmod = (() => {
  const need = [
    [levelPy, /flags=self\.src\.read_uint8\(\)\s+loc= ?self\.src\.read_xy24\(\)\s+aspect,proptype = self\.src\.read_uint6_uint10\(\)\s+d3 = self\.src\.read_uint16\(\)/, 'the prop list reads flags, loc, aspect and proptype, d3 in that order'],
    [utilPy, /return \(d\[0\]<<4\)\|\(d\[1\]>>4\), \(\(d\[1\]&0x0F\)<<8\)\|d\[2\]/, 'read_xy24 packs x in the top 12 bits and y in the low 12'],
    [utilPy, /v = self\.read_uint16\(offset\)\s+return v>>10, v&0x3FF/, 'read_uint6_uint10 is the top 6 bits and the low 10'],
    [levelPy, /self\.aspect=aspect&0x1F\s+self\.rotated = aspect&0xE0/, 'the aspect is the low 5 of the 6 and the rotation the bit above'],
    [levelPy, /self\.container = \(self\.raw_location&0x00FFFF\)/, 'the container is the low 16 bits of the location'],
    [levelPy, /def get_d1\(self\):\s+return self\.d3>>8/, 'd1 is the high byte of d3'],
    [levelPy, /def get_d2\(self\):\s+return self\.d3&0xFF/, 'd2 is the low byte of d3'],
  ];
  const missing = need.filter(([src, re]) => !re.test(src)).map(n => n[2]);
  // Record bits counted from the top bit of byte 0: flags byte 0, the
  // location bytes 1 to 3, the aspect word bytes 4 and 5, d3 bytes 6 and 7.
  return { missing, fields: {
    flags: range(0, 7), x: range(8, 19), y: range(20, 31), container: range(16, 31),
    rotate: [32], aspect: range(33, 37), obj_type: range(38, 47), aspect_and_proptype: range(32, 47),
    data1: range(48, 55), data2: range(56, 63),
  } };
})();

// The interpreter's names for a character's fields and the save reader's.
const CHARACTER_PAIRS = {
  bit_flags: 'state', body: 'body', reflex: 'reflex', mind: 'mind', exp: 'xp',
  health: 'health', full_health: 'healthMax', magic: 'magic', full_magic: 'magicMax',
  timing: 'party', level: 'level', nutrition: 'nutrition', training: 'training',
};

const CONTROLS = {
  cell: { mustFail: 'layout', code: `(() => { const was = exeCellBits; exeCellBits = function (off, size, signed) { return was(off + 1, size, signed); }; })();` },
  rotate: { mustFail: 'layout', patch: src => src.split('o[(p + n) & 31] = b[p]').join('o[(p - n) & 31] = b[p]') },
  facts: { mustFail: 'lines', code: `(() => { exeRecFacts = function () { return new Map(); }; })();` },
};

function run(control) {
  const { sandbox } = makeSandbox();
  const ctx = vm.createContext(sandbox);
  const c = control ? CONTROLS[control] : null;
  new vm.Script(c && c.patch ? c.patch(source) : source, { filename: htmlPath }).runInContext(ctx);
  if (c && c.code) vm.runInContext(c.code, ctx);
  ctx.APP_DATA = appBytes;
  const pef = ctx.appPef();
  if (!pef || !pef.routines || !pef.routines.length) return { fatal: 'the application has no routines' };
  const bad = { layout: [], lines: [] };
  const RF = ctx.exeRecordFields();
  // ---- the Prop layout GetField gives, against delvmod's ----
  const prop = [...RF.tables.entries()].find(([k, t]) => t.kind === 'Prop' && /\|16$/.test(k));
  if (!prop) bad.layout.push('GetField gives no Prop table of 16-byte records');
  else {
    const got = new Map([...prop[1].fields].map(([key, name]) => [name, key.split(',').map(Number)]));
    for (const [name, want] of Object.entries(delvmod.fields)) {
      const b = got.get(name);
      if (!b) { bad.layout.push('GetField gives no ' + name); continue; }
      // The value right-aligned: bit p is the record's bit (last - p), and
      // above the field nothing or copies of its top bit.
      const last = want[want.length - 1], n = want.length;
      const ok = b.every((x, p) => p < n ? x === last - p : x === -1 || x === want[0]);
      if (!ok) bad.layout.push(name + ' is read from bits ' + [...new Set(b.filter(x => x >= 0))].sort((a, b) => a - b).join(',') + ', and delvmod reads it from ' + want[0] + '-' + last);
    }
  }
  // ---- the Character layout, against the save reader's ----
  // parseDelverCharacterRecords (js/delv-archive.js) lays out a character
  // record from delvmod's wiki page for F009 and two bytes read out of the
  // program, and delv_write_check.mjs compares it with the shipped table.
  // Each of its fields is found by setting one byte of a record at a time.
  const chr = [...RF.tables.entries()].find(([k, t]) => t.kind === 'Character' && /\|32$/.test(k));
  if (!chr) bad.layout.push('GetField gives no Character table of 32-byte records');
  else {
    const bytesOf = new Map();
    for (let i = 0; i < 32; i++) {
      const raw = new Uint8Array(32); raw[i] = 0xFF;
      const rec = ctx.parseDelverCharacterRecords(raw)[0];
      for (const [k, v] of Object.entries(rec)) if (typeof v === 'number' && v && k !== 'index') { if (!bytesOf.has(k)) bytesOf.set(k, []); bytesOf.get(k).push(i); }
    }
    const got = new Map([...chr[1].fields].map(([key, name]) => [name, key.split(',').map(Number)]));
    let compared = 0;
    for (const [mine, theirs] of Object.entries(CHARACTER_PAIRS)) {
      const bytes = bytesOf.get(theirs), b = got.get(mine);
      if (!bytes) { bad.layout.push('the save reader has no ' + theirs); continue; }
      if (!b) { bad.layout.push('GetField gives no Character ' + mine); continue; }
      const want = range(bytes[0] * 8, bytes[bytes.length - 1] * 8 + 7), last = want[want.length - 1];
      if (!b.every((x, p) => p < want.length ? x === last - p : x === -1 || x === want[0])) bad.layout.push('Character ' + mine + ' is not bytes ' + bytes.join(',') + ', where the save reader has ' + theirs);
      compared++;
    }
    if (compared < Object.keys(CHARACTER_PAIRS).length) bad.layout.push('compared ' + compared + ' Character fields');
  }
  // ---- the lines ----
  const text = name => { const r = ctx.exeRoutineNamed(name); return r ? ctx.exePseudo(r).lines.map(l => l.text).join('\n') : ''; };
  const pins = [
    ['GetPropParent(PropItem*)', /arg1->flags == 24/, 'tests its argument’s flags against 24'],
    ['GetPropParent(PropItem*)', /r3 = r3->container/, 'reads the container'],
    ['GetPropParent(PropItem*)', /r3->aspect [!=]= 9/, 'tests the aspect against 9'],
    ['TGameViewer::DoTicks(long, unsigned char)', /r30 = &Prop\[256\]/, 'starts its pointer at Prop 256'],
    ['TGameViewer::DoTicks(long, unsigned char)', /r30->data1 = 0/, 'clears data1 through the pointer in the loop'],
    ['TActiveMonster::CanMove(short&, short&, short&, short&)', /r30 = &Prop\[local\d+ & 0x7FFF\]/, 'works out a prop’s record by its index'],
    ['ScheduleTime(short, unsigned char)', /\(Character\[r27\]\.bit_flags & 0x40\) [!=]= 0/, 'tests a character’s flag 0x40 in its bit_flags'],
    ['TActiveMonster::CanMove(short&, short&, short&, short&)', /[!=]= r30->x\)/, 'compares its x'],
    ['TActiveMonster::CanMove(short&, short&, short&, short&)', /[!=]= r30->y\)/, 'compares its y'],
  ];
  for (const [name, re, what] of pins) if (!re.test(text(name))) bad.lines.push(name + ' no longer ' + what);
  let fields = 0, tables = 0, named = 0, lines = 0;
  for (const t of RF.tables.values()) { tables++; fields += t.fields.size; }
  const NAMED = /\b\w+\[[^\]]*\]\.\w|\b(?:r|arg)\d+->\w/;
  for (const r of pef.routines) for (const l of ctx.exePseudo(r).lines) { lines++; if (NAMED.test(l.text)) named++; }
  return { bad, stats: { fields, tables, types: RF.types.size, named, lines } };
}

let failures = 0;
if (delvmod.missing.length) { console.log('FAIL delvmod’s prop reader differs from the lines this check reads (' + delvmod.missing.join('; ') + ')'); process.exit(1); }
if (controls) {
  for (const [name, c] of Object.entries(CONTROLS)) {
    const res = run(name);
    if (res.fatal) { console.log('FAIL ' + res.fatal); failures++; continue; }
    const n = res.bad[c.mustFail].length;
    if (n) console.log(`  ok   control ${name} fails ${c.mustFail}  — ${n} finding(s)`);
    else { console.log(`FAIL control ${name} does not fail ${c.mustFail}`); failures++; }
  }
  console.log(failures ? `FAIL FIELDS controls: ${failures} passed that should fail` : `FIELDS controls: all ${Object.keys(CONTROLS).length} fail their assertion`);
  process.exit(failures ? 1 : 0);
}
const res = run(null);
if (res.fatal) { console.log('FAIL ' + res.fatal); process.exit(1); }
for (const [what, list] of Object.entries(res.bad)) {
  if (list.length) { failures++; console.log(`FAIL ${what}: ${list.length} — ${list.slice(0, 4).join('; ')}`); }
  else console.log(`  ok   ${what}`);
}
const s = res.stats;
console.log(failures ? `FAIL — ${failures} assertion(s)` : `FIELDS ${s.fields} fields in ${s.tables} tables, ${s.types} record types, ${s.named} of ${s.lines} lines name a field`);
process.exit(failures ? 1 : 0);
