#!/usr/bin/env node
// What Ambrosia changed in Cythera Data between the four releases.
//
//   node utilities/releases_check.mjs [index.html] [installers dir]
//
// WHY THIS IS A CHECK AND NOT A NOTE. Until 15 September 2026 nobody could
// compare two releases here: the 1.0.1 and 1.0.2 installer archives compress
// their forks with StuffIt method 13, which the page did not decompress. They
// all open now, so `Cythera Data` can be taken out of each and run through
// `describeDelverDiff`, and the answer is a finding rather than a property of
// the code. A finding written only into prose goes stale silently; written
// here it is re-derived on every run, and a change to what the decoder thinks
// "the same resource" means moves these numbers without moving any snapshot.
//
// THE ONE WORTH KNOWING is the last row: `Cythera Data` is byte for byte
// identical in 1.0.3 and 1.0.4. Whatever the 1.0.4 release fixed, it fixed in
// the application and not in the data.
//
// PLAINTEXT, NOT STORED BYTES, and it has to be. The archives are laid out
// differently between builds and the cipher is keyed by resource id, so
// comparing what is stored would report most of the file as changed in every
// pair. `delverArchiveSpec` hands back plaintext with the encryption verdict
// beside it, which is what makes the comparison mean anything.
//
// THE NEGATIVE CONTROL is at the end: a comparison that answered "identical"
// to everything would pass the 1.0.3/1.0.4 row, which is the row that matters
// most, so the 1.0.1/1.0.2 row is required to differ and one resource is bent
// to prove the comparison sees a single changed byte.

import {readFileSync, existsSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

const [htmlPath = 'index.html', dir = 'reference/game/installers'] = process.argv.slice(2);
let failures = 0;
const fail = (what, why) => { failures++; console.error(`FAIL ${what}: ${why}`); };
const ok = (what, detail) => console.log(`  ok   ${what}${detail ? '  — ' + detail : ''}`);
const skip = why => { console.log(`  skip  ${why}`); process.exit(0); };

const combined = join(dir, 'Cythera installers (archive.org).sit');
if (!existsSync(combined)) skip('the four-in-one installer archive is not here');

const {sandbox} = makeSandbox();
sandbox.Buffer = Buffer;
const ctx = vm.createContext(sandbox);
new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
const ev = code => vm.runInContext(code, ctx);
sandbox.__sit = new Uint8Array(readFileSync(combined));

const out = ev(`(() => {
  const specs = {};
  for (const v of ['1.0.1', '1.0.2', '1.0.3', '1.0.4']) {
    const r = sniffViseInstaller(__sit, 'Cythera ' + v + ' Installer');
    if (!r) { specs[v] = null; continue; }
    const e = r.archive.entries.find(x => x.type === 'DelS');
    specs[v] = e ? delverArchiveSpec(viseExtract(r.archive, e).data) : null;
  }
  globalThis.__specs = specs;
  const rows = [];
  for (const [x, y] of [['1.0.1','1.0.2'], ['1.0.2','1.0.3'], ['1.0.3','1.0.4']]) {
    if (!specs[x] || !specs[y]) { rows.push({pair: x + ' to ' + y, missing: true}); continue; }
    const d = describeDelverDiff(specs[x], specs[y]);
    rows.push({pair: x + ' to ' + y, changed: d.changed.length, added: d.added.length,
               removed: d.removed.length, count: d.aCount, identical: d.identical,
               // The subindexes a reader would want named, biggest first.
               where: d.groups.slice(0, 3).map(g => (CATEGORY_NAMES[g.subn] || ('subindex ' + g.subn)) +
                       ' ' + (g.changed + g.added + g.removed)).join(', '),
               addedIds: d.added.map(a => '0x' + a.resid.toString(16))});
  }
  return rows;
})()`);

// Each row's figures, pinned. A release that is re-mirrored or a decoder that
// changes what counts as the same resource moves one of these.
const WANT = {
  '1.0.1 to 1.0.2': {changed: 246, added: 1, removed: 0, count: 1557},
  '1.0.2 to 1.0.3': {changed: 125, added: 0, removed: 0, count: 1558},
  '1.0.3 to 1.0.4': {changed: 0, added: 0, removed: 0, count: 1558},
};
for (const row of out) {
  if (row.missing) { fail(row.pair, 'one of the two releases is not in the archive'); continue; }
  const w = WANT[row.pair];
  const got = `${row.changed} changed, ${row.added} added, ${row.removed} removed, of ${row.count}`;
  const want = `${w.changed} changed, ${w.added} added, ${w.removed} removed, of ${w.count}`;
  if (got !== want) fail(row.pair, got + ' against ' + want);
  else ok(row.pair, got + (row.where ? '  (' + row.where + ')' : ''));
}
// 0xEB8 is the spell-hit script the Spells sheet cites, and 1.0.1 does not
// have it. Named here because "one resource was added" is a figure and "the
// game gained this script" is the fact.
const first = out.find(r => r.pair === '1.0.1 to 1.0.2');
if (first && !first.missing) {
  if (first.addedIds.length !== 1 || first.addedIds[0] !== '0xeb8')
    fail('what 1.0.2 added', 'expected only 0xeb8, got ' + first.addedIds.join(' '));
  else ok('1.0.2 added one resource', '0xEB8, which the Spells sheet reads a hit from');
}
const last = out.find(r => r.pair === '1.0.3 to 1.0.4');
if (last && !last.missing) {
  if (!last.identical) fail('1.0.3 and 1.0.4', 'the data file differs between them');
  else ok('the data file is unchanged between 1.0.3 and 1.0.4', 'so 1.0.4 changed the application only');
}

// ---- and the applications ---------------------------------------------------
/* The data file answers what the scenario changed; this answers what the
   PROGRAM changed, which for 1.0.4 is the whole of the release, since its
   data file is identical to 1.0.3's.
 *
 * The routine names come from the traceback tables the compiler emitted, so
 * they are Glenn Andreas's own names for his routines, and they make the last
 * release legible in a way no byte count does: 1.0.4 added `MyFindSymbol`,
 * `IsAntiAliasedTextEnabled` and `SetAntiAliasedTextEnabled`. That is the
 * classic look-up-a-symbol-at-runtime idiom plus the thing it looks up, so
 * the final release of Cythera was about anti-aliased text.
 *
 * Pinned by NAME rather than by count. A count would survive a change that
 * swapped which routines differ, and the names are the finding. */
const apps = ev(`(() => {
  const app = v => { const r = sniffViseInstaller(__sit, 'Cythera ' + v + ' Installer');
    if (!r) return null;
    const e = r.archive.entries.find(x => x.type === 'APPL');
    if (!e) return null;
    const g = viseExtract(r.archive, e);
    return {data: g.data, rsrc: g.rsrc}; };
  const out = {};
  for (const [x, y] of [['1.0.1','1.0.2'], ['1.0.2','1.0.3'], ['1.0.3','1.0.4']]) {
    const A = app(x), B = app(y);
    if (!A || !B) { out[x + ' to ' + y] = null; continue; }
    const d = describeApplicationDiff(A, B);
    out[x + ' to ' + y] = {
      added: d.routines ? d.routines.added.map(r => r.name).sort() : null,
      gone: d.routines ? d.routines.gone.map(r => r.name).sort() : null,
      resized: d.routines ? d.routines.resized.length : null,
      resizedNames: d.routines ? d.routines.resized.map(r => r.name).sort() : null,
      moved: d.routines ? d.routines.moved : null,
      aCount: d.routines ? d.routines.aCount : null,
      forkChanged: d.fork ? d.fork.changed.length : null,
      forkTypes: d.fork ? [...new Set(d.fork.changed.map(c => c.type))].sort().join(' ') : null
    };
  }
  return out;
})()`);
const lastApp = apps['1.0.3 to 1.0.4'];
if (!lastApp) console.log('  skip  the applications could not be taken out of the installers');
else {
  const wantAdded = ['IsAntiAliasedTextEnabled', 'MyFindSymbol', 'SetAntiAliasedTextEnabled'];
  if (lastApp.added.join(', ') !== wantAdded.join(', '))
    fail('what 1.0.4 added to the program', lastApp.added.join(', ') + ' against ' + wantAdded.join(', '));
  else ok('1.0.4 added three routines', lastApp.added.join(', '));
  if (lastApp.gone.length) fail('1.0.4 removed nothing', 'it removed ' + lastApp.gone.join(', '));
  const wantResized = ['TAudio::SetSoundVolume(short, unsigned char)', 'TConvMode::Perform()', 'TDelverApp::RunStart()'];
  if (lastApp.resizedNames.join(', ') !== wantResized.join(', '))
    fail('what 1.0.4 recompiled', lastApp.resizedNames.join(', '));
  else ok('and recompiled three', lastApp.resizedNames.length + ': RunStart, SetSoundVolume, Perform');
  ok('its resource fork', lastApp.forkChanged + ' changed, of types ' + lastApp.forkTypes);
  // The suppression is the point of the routine report, so it is asserted:
  // moved-only has to dwarf the meaningful count, or the report is listing
  // relocation noise as though it were change.
  if (!(lastApp.moved > lastApp.added.length + lastApp.resized))
    fail('moved-only is the noise', `${lastApp.moved} moved against ${lastApp.added.length + lastApp.resized} meaningful`);
  else ok('moved-only is counted and not listed', lastApp.moved + ' moved, ' + (lastApp.added.length + lastApp.resized) + ' meaningful');
}
const firstApp = apps['1.0.1 to 1.0.2'];
if (firstApp && firstApp.added) ok('1.0.1 to 1.0.2 in the program',
  `${firstApp.added.length} added, ${firstApp.gone.length} gone, ${firstApp.resized} recompiled, of ${firstApp.aCount}`);

// ---- the negative control --------------------------------------------------
const neg = ev(`(() => {
  const a = __specs['1.0.3'], b = __specs['1.0.4'];
  if (!a || !b) return null;
  // One byte of one resource, which the comparison must see. Without this the
  // "unchanged between 1.0.3 and 1.0.4" result above is indistinguishable
  // from a comparison that always says identical.
  const bent = {scenarioTitle: b.scenarioTitle, playerName: b.playerName,
                formatMajor: b.formatMajor, formatMinor: b.formatMinor,
                resources: b.resources.map(r => ({...r}))};
  const victim = bent.resources.find(r => r.resid === 0x8E04);
  victim.data = victim.data.slice(); victim.data[17] ^= 0x01;
  const d = describeDelverDiff(a, bent);
  // And a resource taken away must read as removed, not as changed.
  const short = {...bent, resources: bent.resources.filter(r => r.resid !== 0x8E34)};
  const d2 = describeDelverDiff(a, short);
  return {oneByteSeen: d.changed.length === 1 && d.changed[0].resid === 0x8E04,
          removalSeen: d2.removed.some(r => r.resid === 0x8E34)};
})()`);
if (!neg) console.log('  skip  the negative control needs 1.0.3 and 1.0.4');
else if (!neg.oneByteSeen) fail('negative control', 'a single flipped byte was not reported as a change');
else if (!neg.removalSeen) fail('negative control', 'a removed resource was not reported as removed');
else ok('the comparison can fail', 'one flipped byte is seen, and a removed resource reads as removed');

const summary = out.filter(r => !r.missing).map(r => r.pair.replace(/1\.0\./g, '') + ': ' + r.changed).join(', ');
console.log(failures ? `\n${failures} failure(s)`
  : `\n  releases: ${summary} resources changed` +
    (lastApp ? `; 1.0.4 changed the program only, in ${lastApp.added.length + lastApp.resized} routines` : ''));
process.exit(failures ? 1 : 0);
