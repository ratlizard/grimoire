#!/usr/bin/env node
// read_check.mjs -- does the Read view say everything each function does?
//
//   node utilities/read_check.mjs index.html "$TMPDIR/Cythera Data.data" [--control=NAME]
//
// dvmReadRender (js/delv-fold.js) reads every function of a script as
// sentences, walking the tree the structure recovery made. A sentence is a
// reading, not a rendering, so this holds each one to the function's own
// code, from the outside, over every function in the archive:
//
//   calls       every syscall and method the function's ops call is said, by
//               its name taken apart the way the sayer takes it apart
//               (dvmSayName) -- a call left out of a sentence is a thing the
//               function does that the reader is not told;
//   conditions  every test in the recovered tree -- each if, if-else, while,
//               for, do-while and each conditional jump left over -- is a
//               clause of its own that begins with "if", "while", "for each"
//               or "repeat, and go round again while";
//   strings     every string the function holds is in its sentences, which is
//               what catches a print lost in the merging of prints;
//   words       nothing reads "undefined", "null" or the fold's "/*under*/";
//   prompts     in a conversation, every `answer "kw" -> target` guard is a
//               "when asked about" clause of its own, the follow-ups nested
//               in the answer whose stretch holds them;
//   helpers     a call to a helper said by what it returns or sets
//               (dvmInlineHelper) still names the helper, so no call is
//               hidden by being read through;
//   self        in a method -- a function its class's table reaches, which the
//               engine calls with the object it belongs to first -- that first
//               argument is said "it" throughout, and "Arg00" appears nowhere.
//
// What it cannot see: whether the words chosen are the right words. A name
// taken apart says what the name says; if delvmod's name for a syscall is
// wrong, the sentence is wrong the same way, and no check here can tell.
//
// Controls, each of which must fail the assertion it is named for:
//   --control=calls       every syscall said as nothing
//   --control=conditions  every block's heading dropped, its body kept
//   --control=strings     every print clause dropped
//   --control=self        no function taken to be a method
//   --control=prompts     every follow-up prompt flattened into its parent
//   --control=helpers     a helper read through without its name
import {readFileSync, existsSync} from 'node:fs';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const args = process.argv.slice(2);
const controlArg = args.find(a => a.startsWith('--control'));
const control = controlArg ? controlArg.split('=')[1] : null;
const [htmlPath = 'index.html', dataPath] = args.filter(a => !a.startsWith('--'));
if (!dataPath || !existsSync(dataPath)) {
  console.log(`  (no archive at ${dataPath || '<none given>'}; this check needs one)`);
  process.exit(0);
}

const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);
sandbox.__a = new Uint8Array(readFileSync(dataPath));
ev('parseArchiveBytes(__a, {name: "Cythera Data"})');

const CONTROLS = {
  calls: {say: 'every syscall said as nothing',
    code: `(() => { const was = dvmSayCall; dvmSayCall = function (n, c) { return /^sys /.test(n.mn) ? '' : was(n, c); }; })();`},
  conditions: {say: 'every block’s heading dropped, its body kept',
    code: `(() => { const was = dvmSayTree; dvmSayTree = function (t, c, l) { return was(t, c, l).flatMap(x => x.kids ? x.kids : [x]); }; })();`},
  self: {say: 'no function taken to be a method',
    code: `(() => { const was = dvmReadRender; dvmReadRender = function (a, b, r) { return was(a, b, r).map(f => f.self ? Object.assign({}, f, { self: true, clauses: JSON.parse(JSON.stringify(f.clauses).split('"it"').join('"Arg00"').split(' it ').join(' Arg00 ').split('its ').join('Arg00\u2019s ')) }) : f); }; })();`},
  helpers: {say: 'a helper read through without its name',
    code: `(() => { const was = dvmFoldNote; dvmFoldNote = function (c, t) { if (typeof t === 'string' && /^(0x[0-9A-F]+|[A-Z]\\w+)$/.test(t)) return; return was(c, t); }; })();`},
  prompts: {say: 'every follow-up prompt flattened into its parent',
    code: `(() => { const was = dvmSayConversation; dvmSayConversation = function (s, c) { return was(s, c).map(x => x.kids ? Object.assign({}, x, { kids: x.kids.filter(k => k.prompt === undefined) }) : x); }; })();`},
  strings: {say: 'every print clause dropped',
    code: `(() => { const was = dvmSayTree; dvmSayTree = function (t, c, l) { return was(t, c, l).filter(x => !/^print /.test(x.text)); }; })();`},
};
if (control) {
  if (!CONTROLS[control]) { console.error(`no control called ${control}; there are ${Object.keys(CONTROLS).join(', ')}`); process.exit(2); }
  ev(CONTROLS[control].code);
  console.log(`  (control: ${CONTROLS[control].say})`);
}

const fails = {calls: [], conditions: [], strings: [], words: [], self: [], prompts: [], helpers: []};
const stats = ev(`(() => {
  const out = { functions: 0, answers: 0, calls: 0, conditions: 0, strings: 0, methods: 0, fails: { calls: [], conditions: [], strings: [], words: [], self: [], prompts: [], helpers: [] }, inlined: 0 };
  const flat = cl => cl.flatMap(c => [c.text].concat(c.kids ? flat(c.kids) : []));
  const heads = cl => cl.reduce((k, c) => k + (/^(if |while |for each |repeat, and go round again while )/.test(c.text) ? 1 : 0) + (c.kids ? heads(c.kids) : 0), 0);
  const tests = t => t.reduce((k, n) => k + (n.kind === 'if' || n.kind === 'ifelse' || n.kind === 'while' || n.kind === 'dowhile' ? 1 : 0) +
    (n.kind === 'stmt' && n.stmt.kind === 'cond' ? 1 : 0) + ['then', 'els', 'body'].reduce((a, key) => a + (n[key] ? tests(n[key]) : 0), 0), 0);
  for (let subn = 0; subn < 256; subn++) {
    const mi = ARCHIVE.index[subn];
    if (!mi || !mi[0] || !SCRIPT_SUBN.has(subn)) continue;
    const count = subindexCount(ARCHIVE, subn);
    for (let i = 0; i < count; i++) {
      const resid = ((subn + 1) << 8) | i;
      let data;
      try { const raw = getResourceBytes(ARCHIVE, resid); if (!raw || !raw.length) continue; data = smartDecrypt(raw, resid).data; } catch (e) { continue; }
      let fns;
      try { fns = dvmReadRender(ARCHIVE, data, resid); } catch (e) { out.fails.words.push(hex(resid) + ' threw ' + e.message); continue; }
      for (const f of fns) {
        if (f.answers) {
          out.answers++;
          const count = cl => cl.reduce((k, c) => k + (c.prompt !== undefined ? 1 : 0) + (c.kids ? count(c.kids) : 0), 0);
          if (!f.clauses) { out.fails.prompts.push(hex(resid) + ' ' + f.name + ' was not read'); continue; }
          const have = count(f.clauses);
          if (have !== f.answers) out.fails.prompts.push(hex(resid) + ' ' + f.name + ': ' + f.answers + ' guards, ' + have + ' prompts');
        }
        if (!f.clauses || f.bad) continue;
        out.functions++;
        const where = hex(resid) + ' ' + f.name;
        const text = flat(f.clauses).join('\\n');
        for (const o of f.ops) {
          const mn = o[2];
          let name = null;
          if (/^sys /.test(mn)) name = mn.slice(4);
          else if (mn === 'method') name = dvmPlainName(dvmBareOperand(o[3]));
          if (name) { out.calls++; if (text.indexOf(dvmSayName(name)) < 0) out.fails.calls.push(where + ': ' + name); }
          if (mn === 'call_resource') {
            const id = /0x([0-9A-F]{2,4})\\b/i.exec(String(o[3] || ''));
            const rid = id ? parseInt(id[1], 16) : null;
            if (rid !== null && dvmInlineHelper(ARCHIVE, rid)) {
              out.inlined++;
              if (text.indexOf(dvmFoldResourceName(rid)) < 0) out.fails.helpers.push(where + ': ' + dvmFoldResourceName(rid));
            }
          }
          if (mn === 'string' || mn === 'string(implicit)') { out.strings++; const lit = dvmBareOperand(o[3]); if (text.indexOf(lit) < 0) out.fails.strings.push(where + ': ' + lit.slice(0, 40)); }
        }
        if (f.tree) {
          const want = tests(f.tree), have = heads(f.clauses);
          out.conditions += want;
          if (want !== have) out.fails.conditions.push(where + ': ' + want + ' tests, ' + have + ' clauses');
        }
        if (f.self) { out.methods++; if (/\\bArg00\\b/.test(text)) out.fails.self.push(where + ' says Arg00'); }
        const bad = /\\bundefined\\b|\\bnull\\b|\\/\\*under\\*\\//.exec(text);
        if (bad) out.fails.words.push(where + ': "' + bad[0] + '"');
      }
    }
  }
  return out;
  function hex(r) { return '0x' + r.toString(16).toUpperCase(); }
})()`);

let failures = 0;
for (const [what, list] of Object.entries(stats.fails)) {
  if (!list.length) continue;
  failures++;
  console.error(`FAIL ${what}: ${list.length} -- ${list.slice(0, 6).join('; ')}${list.length > 6 ? '; ...' : ''}`);
}
const line = `read ${stats.functions} functions: ${stats.calls} calls, ${stats.conditions} tests and ${stats.strings} strings said, ${stats.methods} methods said of "it", ${stats.inlined} helper calls read through and named; ` +
  `${stats.answers} of them conversations, every prompt a clause`;
if (failures) { console.error(line); process.exit(1); }
console.log(line);
