#!/usr/bin/env node
// Drives index.html's user interface in Node: the archive through the real
// entry point (parseArchiveBytes), then every category, gallery and resource,
// and the sections each part pins. decoder_snapshot.mjs proves the decoders
// still produce the same bytes; this proves the page around them still works,
// so a missing element id, a renamed function or a branch that throws
// surfaces as a failure line instead of a blank pane someone finds later.
//
//   node utilities/viewer_smoke.mjs index.html "$TMPDIR/Cythera Data.data" [category] [installers] [saved game] [part ...]
//
// The drive is in six parts, smoke_<part>.mjs, cut from the one file on
// 18 September 2026 at the points where the open file changes: galleries,
// views, atlas, rules, edits, saves, installer. Named parts run in this process in
// the order given; none named runs all six, which is the four-minute drive
// of old in one process. check_all.mjs runs one part per row so the six run
// at once. Each part starts from smoke_boot.mjs, which loads the page and
// opens the archive, so a part never depends on what another left behind.
import { PARTS, finish } from './smoke_boot.mjs';
// galleries-a and galleries-b are the two halves of the galleries loop, each
// a distinct module instance through its query string; `galleries` is both.
const MODULE = { 'galleries-a': './smoke_galleries.mjs?slice=a', 'galleries-b': './smoke_galleries.mjs?slice=b' };
const ALL = ['galleries', 'views', 'atlas', 'rules', 'edits', 'saves', 'installer'];
const parts = PARTS.length ? PARTS : ALL;
for (const p of parts) {
  if (!ALL.includes(p) && !MODULE[p]) { console.error('no such part: ' + p + ' (' + ALL.concat(Object.keys(MODULE)).join(', ') + ')'); process.exit(2); }
  await import(MODULE[p] || ('./smoke_' + p + '.mjs'));
}
finish(PARTS);
