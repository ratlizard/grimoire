#!/usr/bin/env node
/* The bitmap-font writer, against the two fonts Ambrosia shipped.

   `writeResourceFork` got its evidence from the strongest thing available --
   the forks Apple's own Resource Manager wrote in 1999, handed back byte for
   byte. A font inside one of those forks is the same kind of claim one level
   down: `nfntSpec` reads every field of an NFNT, `writeNFNT` puts it back, and
   the shipped bytes must return exactly. Nothing else here can say the format
   is understood rather than merely drawn -- `decodeNFNT` walks past both of
   the tables that follow the bit image, so a reader that renders a strike
   correctly can still be wrong about everything after it.

   It was wrong about exactly that on the first run: the location table has
   nGlyphs + 1 entries and the offset/width table has nGlyphs, and reading both
   the same way made every font two bytes too long. That is the bug this check
   exists to keep fixed.

   The negative control is the point, not a flourish. Flip one bit of the bit
   image and the output must move; without that, a writer that returned its own
   input would pass every assertion above.

     node utilities/nfnt_write_check.mjs index.html "$TMPDIR/Cythera Data.rsrc"

   The fonts are Cythera's, so with no fork to read this skips rather than
   failing -- there is no synthetic half, because a made-up font would only
   prove the writer agrees with the reader. */

import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { pageSource } from './page_scripts.mjs';
import { makeSandbox } from './dom_stub.mjs';

const [htmlPath, forkPath] = process.argv.slice(2);
if (!htmlPath) {
  console.error('usage: nfnt_write_check.mjs <page.html> <fork.rsrc>');
  process.exit(2);
}
if (!forkPath || !existsSync(forkPath)) {
  console.log('no resource fork to read — skipped');
  process.exit(0);
}

const { sandbox: G } = makeSandbox();
const ctx = vm.createContext(G);
new vm.Script(pageSource(htmlPath), { filename: htmlPath }).runInContext(ctx);

const fork = G.openResourceFork(new Uint8Array(readFileSync(forkPath)));
const fonts = (fork.resourcesByType && fork.resourcesByType['NFNT']) || [];
if (!fonts.length) {
  console.log('the fork carries no NFNT — skipped');
  process.exit(0);
}

let failed = 0, identical = 0;
for (const e of fonts) {
  const data = fork.dataOf('NFNT', e);
  let spec;
  try { spec = G.nfntSpec(data); }
  catch (err) { console.error(`NFNT ${e.id}: could not be read — ${err.message}`); failed++; continue; }

  const back = G.writeNFNT(spec);
  let where = -1;
  if (back.length !== data.length) where = -2;
  else for (let i = 0; i < data.length; i++) if (data[i] !== back[i]) { where = i; break; }

  if (where === -1) {
    identical++;
    console.log(`NFNT ${e.id}: ${data.length} bytes back byte for byte ` +
                `(${spec.nGlyphs} glyphs, ${spec.fRectWidth}x${spec.fRectHeight} cell, ` +
                `strike ${spec.strikeBytes} bytes, offset/width table at ${spec.owOff})`);
  } else if (where === -2) {
    console.error(`NFNT ${e.id}: came back ${back.length} bytes against ${data.length}`);
    failed++;
  } else {
    console.error(`NFNT ${e.id}: differs at 0x${where.toString(16)}`);
    failed++;
  }

  // The control. One bit of the bit image, and the output has to notice.
  const bent = G.nfntSpec(data);
  bent.strike = bent.strike.slice();
  bent.strike[0] ^= 1;
  const moved = G.writeNFNT(bent).some((b, i) => b !== data[i]);
  if (!moved) {
    console.error(`NFNT ${e.id}: a flipped bit in the bit image did not move the output — ` +
                  `the writer is not writing the strike`);
    failed++;
  }
}

console.log(`${identical} of ${fonts.length} shipped fonts written back byte for byte, ` +
            `each with its negative control`);
process.exit(failed ? 1 : 0);
