// js/mac-*.js are copies of ratlizard/mac-files and must stay byte for byte what
// it has: a change goes to mac-files first and is copied here (its README,
// *Changing a file*). This finds mac-files where MAC_FILES points, else beside
// this checkout (in a front, its worktree), else at ~/e-z-g-cythera/mac-files,
// and fails without it: a check that skips passes unseen.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = process.env.MAC_FILES || [path.join(ROOT, '..', 'mac-files'), path.join(os.homedir(), 'e-z-g-cythera', 'mac-files')]
  .find(p => fs.existsSync(path.join(p, 'js')));
if (!M) { console.log('FAIL: no mac-files checkout beside this one or at ~/e-z-g-cythera/mac-files (set MAC_FILES)'); process.exit(1); }
const sourceDir = path.join(M, 'js');

const copyFiles = fs.readdirSync(path.join(ROOT, 'js')).filter(f => /^mac-.*\.js$/.test(f)).sort();
let bad = 0;
for (const f of copyFiles) {
  const bPath = path.join(sourceDir, f);
  if (!fs.existsSync(bPath)) { console.log(`FAIL ${f}: mac-files has no such file`); bad++; continue; }
  if (!fs.readFileSync(path.join(ROOT, 'js', f)).equals(fs.readFileSync(bPath))) { console.log(`FAIL ${f}: differs from ${bPath}`); bad++; }
}
console.log(`${copyFiles.length} mac-* files, ${copyFiles.length - bad} identical to mac-files'`);
process.exit(bad ? 1 : 0);
