/* The machinery the patch builders use to turn edits into one Magpie patch,
   run inside the page's vm sandbox exactly as the page runs it.

   Until 28 September 2026 the edit machinery itself was here, as a string of
   page code the sandbox ran. It is js/delv-datapatch.js now, so that the
   Patches section can build a patch from the fixes a visitor chooses, and
   the fixes themselves are js/delv-datafixes.js; what is left here is the
   wrapping: the sandbox, the files, and the check that the patch merged
   back onto the shipped file gives the patched file.

   buildPatch({ htmlPath, dataPath, outDir, name, description, edits,
                dataEdits, textEdits })
     For a builder with edits of its own (the casts, the Strine opening,
     Sour Grapes): js/delv-datapatch.js's three kinds of edit, as one stage.
     A data edit's fn is sent into the sandbox as its source and run there,
     so it sees the page's readers (parseDelverMap, decompressDCG) as globals.

   buildFixes({ htmlPath, dataPath, outDir, name, description, ids, stages,
                communityTypos })
     For the fixes: applyDataFixes with the ids chosen (every fix, if none are
     given), keeping the parts of `stages` alone when given, which is how the
     builders write the patches that were made one stage each.

   Both write "<name>" (the bare patch), "<name>.bin" (MacBinary, DelP) and
   the patched "Cythera Data.data" into outDir, and return false when the
   patch merged back onto the shipped file does not give the patched file
   byte for byte. What they write is the game's data changed and belongs in
   no repository. */
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import vm from 'node:vm';
import {makeSandbox} from './dom_stub.mjs';
import {pageSource} from './page_scripts.mjs';

// The page's scripts in a sandbox of their own, with the data file in hand.
export function pageContext(htmlPath = 'index.html', dataPath) {
  const {sandbox} = makeSandbox();
  sandbox.Buffer = Buffer;
  const ctx = vm.createContext(sandbox);
  new vm.Script(pageSource(htmlPath), {filename: htmlPath}).runInContext(ctx);
  if (dataPath) sandbox.__a = new Uint8Array(readFileSync(dataPath));
  return {sandbox, ctx};
}

// A patch's description is a Pascal string, 255 bytes at most, and
// writeDelverPatch cuts a longer one without a word. Three builders did
// exactly that until 27 September 2026 ("Community Fixes" lost its last
// sixty characters), and only the further and combined builders checked
// for themselves; here every builder is checked. Mac Roman keeps a curly
// quote in one byte, so the length in characters is the length.
function checkDescription(name, description) {
  if (String(description).length > 255) throw new Error(name + ': the description is ' + String(description).length + ' characters, and a patch holds 255');
}

// The session's result written out: the patch, its MacBinary, the patched file.
const WRITE_OUT = (name, description) => `
    const patched = writeDelverArchive(done.spec);
    const w = writeDelverPatch(done.spec, done.changed, { description: ${JSON.stringify(description)}, typeCode: DELV_PATCH_EXPORT_TYPE });
    const bin = writeMacBinary({ name: ${JSON.stringify(name)}, type: 'DelP', creator: DELV_PATCH_CREATOR, data: w.bytes });
    const merged = mergeDelverPatch(__a, w.bytes);
    const same = merged && merged.bytes && merged.bytes.length === patched.length && merged.bytes.every((x, i) => x === patched[i]);
    return { log: done.log, patch: Array.from(w.bytes), bin: Array.from(bin), patched: Array.from(patched), resids: w.resids, same: !!same, mergeInfo: merged ? Object.keys(merged).join(',') : null };`;

function writeOut(out, outDir, name) {
  mkdirSync(outDir, { recursive: true });
  writeFileSync(outDir + '/' + name, Buffer.from(out.patch));
  writeFileSync(outDir + '/' + name + '.bin', Buffer.from(out.bin));
  writeFileSync(outDir + '/Cythera Data.data', Buffer.from(out.patched));
  for (const l of out.log) console.log('  ' + l);
  console.log(`  patch: ${out.resids.length} resources, ${out.patch.length} bytes; merged onto the shipped file it ${out.same ? 'gives the patched file byte for byte' : 'does NOT give the patched file (' + out.mergeInfo + ')'}`);
  return out.same;
}

export function buildPatch({htmlPath = 'index.html', dataPath, outDir, name, description, edits = [], dataEdits = [], textEdits = []}) {
  checkDescription(name, description);
  const {ctx} = pageContext(htmlPath, dataPath);
  const out = vm.runInContext(`(() => {
    const EDITS = ${JSON.stringify(edits)};
    const DATA = ${JSON.stringify(dataEdits.map(d => ({what: d.what, resid: d.resid, src: d.fn.toString()})))}
      .map(d => ({ what: d.what, resid: d.resid, fn: (0, eval)('(' + d.src + ')') }));
    const TEXT = ${JSON.stringify(textEdits)};
    const s = dataPatchSession(__a);
    applyDataEdits(s, { edits: EDITS, dataEdits: DATA, textEdits: TEXT });
    const done = finishDataPatch(s);
    ${WRITE_OUT(name, description)}
  })()`, ctx);
  return writeOut(out, outDir, name);
}

export function buildFixes({htmlPath = 'index.html', dataPath, outDir, name, description, ids = null, stages = null, communityTypos = null}) {
  checkDescription(name, description);
  const {ctx} = pageContext(htmlPath, dataPath);
  const out = vm.runInContext(`(() => {
    const ids = ${JSON.stringify(ids)} || DATA_FIXES.map(f => f.id);
    const done = applyDataFixes(__a, ids, { stages: ${JSON.stringify(stages)}, communityTypos: ${JSON.stringify(communityTypos)} });
    ${WRITE_OUT(name, description)}
  })()`, ctx);
  return writeOut(out, outDir, name);
}

// The ids of every fix, and of every option of the text's, with the spelling
// named: what the builders that write the whole of a stage choose.
export function everyFix(htmlPath = 'index.html', spelling = 'us') {
  const {ctx} = pageContext(htmlPath);
  return JSON.parse(vm.runInContext(`JSON.stringify(DATA_FIXES.filter(f => f.choice !== 'spelling' || f.id === ${JSON.stringify('spelling-' + spelling)}).map(f => f.id))`, ctx));
}
