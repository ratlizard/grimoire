/* Delver VM scripts, folded into something closer to source.
 * ===========================================================================
 *
 * js/delv-script.js renders the listing the rest of this project is built on:
 * one op a line, the offset in the gutter, indented by the expression tree. It
 * stays exactly as it is and nothing here changes it, because three things
 * depend on its text character for character -- `decoder snapshot` in the
 * suite hashes it, the search index is built from it so a line of dialogue can
 * be found, and the matchers in js/page-rules.js read rules out of it with
 * regular expressions over op text. A folded view is therefore a SECOND
 * renderer over the SAME decoder, not a change to the first.
 *
 * LOAD ORDER: after js/delv-script.js, whose dvmDisassemble, dvmExtents and
 * DVM_SYM this uses.
 *
 * WHAT FOLDING IS. The listing is already a tree -- dvmDisassemble gives each
 * op the number of expression frames it opens, and the 0x40 that closes one.
 * But inside a frame the stream is POSTFIX: `add` does not carry its operands,
 * it consumes the two values before it. So
 *
 *     call_resource CastSpell           CastSpell(Arg00.container, 6, 24)
 *         arg Arg00
 *         get_field container     -->
 *         byte 0x06
 *         byte 0x18
 *     end
 *
 * Note what that says and what it does not: `get_field` CONSUMES the Arg00
 * before it, so the call takes three arguments and not four. Read the other way
 * it would be four, and the fold would be asserting something about CastSpell
 * that the bytes do not say.
 *
 * needs both halves: the frame structure for the call, and a small stack
 * machine inside it for `get_field`, which turns the value before it into a
 * field access.
 *
 * WHICH OPS CONSUME VALUES IS THE ONE THING NOT WRITTEN DOWN ANYWHERE.
 * delvmod's ddasm emits postfix, so it never needs arity; its rdasm is a flat
 * one-mnemonic-one-byte assembler and carries none either. The wiki's RDASM
 * Opcodes page gives the semantics in words -- "Push an immediate signed byte
 * onto the evaluation stack", "The usual arithmetic operation", "length of
 * object on top of stack" -- which settles what each op MEANS without ever
 * stating a number. So DVM_POPS below is read off those descriptions, and it
 * is checked rather than trusted: utilities/fold_check.mjs folds every
 * function in the archive and fails unless
 *
 *   1. every expression frame reduces to exactly one value -- a wrong arity
 *      anywhere leaves a frame with two values or short of one, and
 *   2. re-expanding the folded tree gives back the identical op sequence.
 *
 * Together those say the fold is a faithful reorganisation of the decode and
 * not a second reading of it. (1) is the one that catches a wrong number.
 */

/* How many values an op consumes from the frame it sits in, for the ops that
   open no frame of their own. Everything absent from this map is a value: a
   literal, a local, an argument, a global, a loaded word. Read off the wiki's
   RDASM Opcodes table. */
const DVM_POPS = {
  0x46: 2,                                  // index: an array and a subscript
  0x4A: 2, 0x4B: 2, 0x4C: 2, 0x4D: 2, 0x4E: 2,          // add sub mul div mod
  0x4F: 2, 0x50: 2, 0x51: 2, 0x52: 2, 0x53: 2, 0x54: 2, // lt le gt ge ne eq
  0x55: 1,                                              // neg
  0x56: 2, 0x57: 2, 0x58: 2,                            // bitwise and or xor
  0x59: 1,                                              // bitwise_not
  0x5A: 2, 0x5B: 2,                                     // shifts
  0x5C: 2, 0x5D: 2,                                     // logical and or
  0x5E: 1, 0x5F: 1,                                     // not, len
  0x60: 1,                                  // has_member: of the object below
  0x61: 1,                                  // class_member: indexes it
  0x62: 1, 0x63: 1, 0x64: 1,                // get_field, cast, is_type
};

/* How each of those reads once folded. A binary entry is infix, a unary one is
   a prefix symbol unless it is spelt as a call. */
const DVM_INFIX = {
  0x4A: '+', 0x4B: '-', 0x4C: '*', 0x4D: '/', 0x4E: '%',
  0x4F: '<', 0x50: '<=', 0x51: '>', 0x52: '>=', 0x53: '!=', 0x54: '==',
  0x56: '&', 0x57: '|', 0x58: '^', 0x5A: '<<', 0x5B: '>>',
  // The VM's logical `and` and `or` consume two values already computed, so
  // both sides have run. They are spelt as words, not `&&` and `||`, because a
  // reader takes those to stop at the first side that settles it -- which is
  // what a merged condition (dvmMergeConditions) does, and these do not.
  0x5C: 'and', 0x5D: 'or',
};
const DVM_PREFIX = { 0x55: '-', 0x59: '~', 0x5E: '!' };

/* A symbol's name without the code the listing prints beside it: the raw
   listing says `get_field container (0xB)` so that the number is never hidden,
   and folded text says `.container`, the number being one tap away in the raw
   view. An operand with no name keeps whatever the listing gave it. */
function dvmPlainName(arg) {
  const m = /^(.*?)\s*\((0x[0-9A-Fa-f]+)\)\s*$/.exec(arg || '');
  return m ? m[1] : (arg || '');
}

/* The first token of an operand, dropping the `// note` the listing appends.
   `dvmAnnotateInt` writes those notes and they are worth reading, but they are
   sentences and belong in the raw view. */
function dvmBareOperand(arg) {
  const s = String(arg || '').split('  //')[0].trim();
  return s;
}

/* Every offset in this resource that the dispatch table names, and what it
 * names it. The table is at the offset the first word gives, and each entry is
 * six bytes: a dref as a big-endian long, then the key as a word. A dref with
 * the top bit set and this resource's id in bits 16..30 points at an object
 * here; 0x5000FFFF is the table's way of saying the slot is empty.
 *
 * This is what turns `function obj_0061(1 args, 0 locals)` into
 * `function Use(Arg00)`. delvmod's ddasm has named functions this way since it
 * was written and this page never did, which is the single largest difference
 * between the two listings for a reader.
 */
function dvmSlotNames(b, resid) {
  const names = new Map();
  if (!b || b.length < 4) return names;
  const head = b[0];
  // Only the dispatch-table shape has a table; a bare function or array does
  // not, and neither does subindex 3's named-script form.
  if (head === 0x81 || (head & 0xF0) === 0x90 || (head & 0xF0) === 0xA0) return names;
  const toff = u16be(b, 0);
  if (toff < 2 || toff + 2 > b.length) return names;
  const count = u16be(b, toff) & 0x0FFF;
  for (let i = 0, p = toff + 2; i < count && p + 6 <= b.length; i++, p += 6) {
    const value = u32be(b, p), key = u16be(b, p + 4);
    if (!(value & 0x80000000)) continue;
    if (((value & 0x7FFF0000) >>> 16) !== resid) continue;
    const off = value & 0xFFFF;
    if (off >= b.length) continue;
    const name = (DVM_SYM.method && DVM_SYM.method[String(key)]) ||
                 (DVM_SYM.field && DVM_SYM.field[String(key)]) ||
                 ('Slot' + key.toString(16).toUpperCase().padStart(4, '0'));
    // A slot already named keeps its first name: two keys can point at one
    // object (0x1A28 has two slots on 0x5000FFFF and the shipped archive has
    // objects shared between a method and a field), and the first is the one
    // the table lists.
    if (!names.has(off)) names.set(off, name);
  }
  return names;
}

/* ---- the tree -------------------------------------------------------------
 * One pass over the flat op list. An op that opens frames gets its children in
 * `groups`, one array per frame, in the order the frames close -- which is the
 * order they appear in the bytes. `close` keeps the closing op of each frame,
 * because `then -> 0x0094` and `cases ( ... )` carry the branch targets and an
 * `end` carries nothing.
 */
function dvmForest(ops) {
  const root = { groups: [[]], close: [], pending: 0, mn: '<root>' };
  const stack = [root.groups[0]];           // innermost open frame last
  const owners = [root];
  for (const [at, delta, mn, arg, expect, op] of ops) {
    const frame = stack[stack.length - 1];
    if (delta === -1) {
      // Close the innermost frame: it belongs to the owner beside it.
      const owner = owners[owners.length - 1];
      if (owner === root) continue;          // a stray 0x40; the raw view shows it
      owner.close.push({ at, mn, arg });
      owner.pending--;
      stack.pop(); owners.pop();
      if (owner.pending > 0) {
        // The same op opens another frame straight away -- set_field takes two,
        // set_index three -- so open the next one for it rather than returning
        // to its parent.
        owner.groups.push([]);
        stack.push(owner.groups[owner.groups.length - 1]);
        owners.push(owner);
      }
      continue;
    }
    const node = { at, mn, arg, op, expect, groups: [], close: [], pending: expect };
    frame.push(node);
    if (expect > 0) {
      node.groups.push([]);
      stack.push(node.groups[0]);
      owners.push(node);
    }
  }
  return root.groups[0];
}

/* ---- rendering a frame ----------------------------------------------------
 * The postfix half. Walk a frame's nodes, pushing values and applying the ops
 * that consume them; the result should be one value. `left` is what the frame
 * had left over, and the check reads it: anything but exactly one means the
 * arity table is wrong for something in here.
 */
function dvmReduceFrame(nodes, ctx) {
  const st = [];
  for (const n of nodes) {
    const pops = (n.expect > 0) ? 0 : (DVM_POPS[n.op] || 0);
    if (n.expect > 0) { st.push(dvmFoldCall(n, ctx)); continue; }
    if (!pops) { st.push(dvmFoldValue(n, ctx)); continue; }
    if (st.length < pops) { st.push(dvmFoldValue(n, ctx) + '/*under*/'); continue; }
    const args = st.splice(st.length - pops, pops);
    st.push(dvmFoldOperator(n, args, ctx));
  }
  return st;
}

function dvmFoldFrame(nodes, ctx) {
  const st = dvmReduceFrame(nodes, ctx);
  if (st.length === 1) return st[0];
  if (!st.length) return '';
  // More than one value left. The raw view is the honest thing to send a
  // reader to, so say so rather than joining them and pretending.
  return st.join(', ');
}

function dvmFoldValue(n, ctx) {
  const bare = dvmBareOperand(n.arg);
  switch (n.mn) {
    case 'local': case 'arg': return bare;
    case 'byte': case 'short': case 'word': return dvmFoldNumber(bare);
    case 'string': case 'string(implicit)': return bare;
    case 'global': return dvmPlainName(bare);
    case 'load_near_word': return 'word@' + bare;
    case 'load_far_word': return 'word@' + bare;
    case 'subroutine': return 'sub@' + bare;
    case 'data': return '<data ' + bare + '>';
    case 'index': return 'index';
    case 'exit': return 'exit';
    case '??': return '<' + bare + '>';
    default: return n.mn + (bare ? ' ' + bare : '');
  }
}

/* An operand as a number. The raw listing prints a byte and a short in hex and
   a word already decimal, which reads as two conventions in one line --
   `PlaySound(0x30, ...)` beside `MagicAuraEffect(..., 240)`. Decimal throughout
   here; the raw view keeps its own spelling, which is an open question of its
   own and not one this view has to wait for. A value that is not a plain number
   (a dref, an object reference, a name the word decoder resolved) is left
   exactly as the decoder wrote it. */
function dvmFoldNumber(bare) {
  const m = /^0x([0-9A-Fa-f]+)$/.exec(bare);
  if (m) return String(parseInt(m[1], 16));
  return bare;
}

function dvmFoldOperator(n, args, ctx) {
  const infix = DVM_INFIX[n.op];
  if (infix) return '(' + args[0] + ' ' + infix + ' ' + args[1] + ')';
  const prefix = DVM_PREFIX[n.op];
  if (prefix) return prefix + args[0];
  const bare = dvmPlainName(dvmBareOperand(n.arg));
  switch (n.op) {
    case 0x46: return args[0] + '[' + args[1] + ']';           // index
    case 0x5F: return 'len(' + args[0] + ')';
    case 0x60: return args[0] + ' has ' + bare;                // has_member
    case 0x61: return args[0] + '.' + bare;                    // class_member
    case 0x62: return args[0] + '.' + bare;                    // get_field
    case 0x63: return bare + '(' + args[0] + ')';              // cast
    case 0x64: return args[0] + ' is ' + bare;                 // is_type
    default: return n.mn + '(' + args.join(', ') + ')';
  }
}

/* An op that opened frames. Most are calls or statements; the ones that take
   more than one frame spell out where each frame went. */
function dvmFoldCall(n, ctx) {
  const bare = dvmPlainName(dvmBareOperand(n.arg));
  const g = n.groups.map(f => dvmFoldFrame(f, ctx));
  // `sys Name` arrives as one mnemonic with the name inside it.
  if (/^sys /.test(n.mn)) return n.mn.slice(4) + '(' + dvmArgList(n.groups[0], ctx) + ')';
  switch (n.mn) {
    case 'call_resource': case 'call_subroutine':
      return bare + '(' + dvmArgList(n.groups[0], ctx) + ')';
    case 'call_index':
      /* `9C rr rr (i...) 40 (p...) 40` -- the wiki's table: calls the resource
         at r plus the index expression, with the second frame as its
         parameters. Two frames of different kinds, which is why the fold check
         classifies its groups separately. */
      return bare + '[' + (g[0] || '') + '](' + dvmArgList(n.groups[1], ctx) + ')';
    case 'method': {
      // The receiver is the first value in the frame and the rest are the
      // arguments, which is how `method Look / arg Arg00 / end` reads as
      // Arg00.Look().
      const vals = dvmReduceFrame(n.groups[0] || [], ctx);
      const recv = vals.length ? vals[0] : '';
      return (recv ? recv + '.' : '') + bare + '(' + vals.slice(1).join(', ') + ')';
    }
    case 'gui': return 'gui.' + bare + '(' + dvmArgList(n.groups[0], ctx) + ')';
    case 'gui_close': return 'gui.close(' + (g[0] || '') + ')';
    case 'ai_state': return 'ai_state(' + bare + (g[0] ? ', ' + g[0] : '') + ')';
    default: return n.mn + (bare ? ' ' + bare : '') + '(' + g.join(', ') + ')';
  }
}

/* A frame whose values are an argument list rather than one expression. */
function dvmArgList(nodes, ctx) {
  return dvmReduceFrame(nodes || [], ctx).join(', ');
}

/* ---- statements -----------------------------------------------------------
 * The top level of a function body, and of any frame that holds statements
 * rather than one value. A statement keeps its offset, because the offset is
 * the join to Edit Bytes: js/page-rules.js maps a listed operand to its place
 * in the plaintext and the raw view shows it.
 */
function dvmFoldStatement(n, ctx) {
  const bare = dvmPlainName(dvmBareOperand(n.arg));
  const g = n.groups.map(f => dvmFoldFrame(f, ctx));
  const target = () => {
    const c = n.close.find(c => c.mn === 'then');
    const m = c && /->\s*(0x[0-9A-F]+)/i.exec(c.arg);
    return m ? m[1] : null;
  };
  switch (n.mn) {
    case 'return': return 'return' + (g[0] ? ' ' + g[0] : '');
    case 'print': return 'print(' + (g[0] || '') + ')';
    case 'if': { const t = target(); return 'if (' + g[0] + ')' + (t ? ' goto ' + ctx.label(t) : ''); }
    case 'if_not': { const t = target(); return 'if (!(' + g[0] + '))' + (t ? ' goto ' + ctx.label(t) : ''); }
    case 'branch': return 'goto ' + ctx.label(bare);
    case 'set_local': {
      /* The operand is a slot in the same numbering the `local` and `arg` ops
         use: below 0x30 a local, 0x30 and up an argument. The local half is
         certain and is spelt `VarNN` here. The argument half is NOT: the
         handoff's own item on `set_local 0x31` says the interpreter's handler
         for opcode 0x82 has not been read, and 24 scripts use it -- so it is
         left in the raw spelling, which looks different enough to send a reader
         to the raw listing rather than quietly asserting a reading nobody has
         confirmed. */
      const slot = parseInt(bare, 16);
      const lhs = (Number.isFinite(slot) && slot < 0x30)
        ? 'Var' + slot.toString(16).toUpperCase().padStart(2, '0')
        : 'set_local ' + bare;
      return lhs + ' = ' + (g[0] || '');
    }
    case 'set_global': return dvmPlainName(bare) + ' = ' + (g[0] || '');
    case 'set_field': return (g[0] || '') + '.' + bare + ' = ' + (g[1] || '');
    case 'set_index': return (g[0] || '') + '[' + (g[1] || '') + '] = ' + (g[2] || '');
    case 'write_near_word': return 'word@' + bare + ' = ' + (g[0] || '');
    case 'write_far_word': return 'word@' + bare + ' = ' + (g[0] || '');
    case 'switch': {
      const c = n.close.find(c => c.mn === 'cases');
      const cases = c ? (c.arg.match(/0x[0-9A-F]+/gi) || []) : [];
      return 'switch (' + (g[0] || '') + ') -> ' + cases.map(t => ctx.label(t)).join(', ');
    }
    case 'exit': return 'exit';
    case 'string(implicit)': return 'print(' + dvmBareOperand(n.arg) + ')';
    case 'conversation_prompt': return 'ask ' + dvmBareOperand(n.arg);
    case 'conversation_response': return 'answer ' + dvmBareOperand(n.arg);
    default:
      if (n.expect > 0) return dvmFoldCall(n, ctx);
      return dvmFoldValue(n, ctx);
  }
}

/* ---- a whole resource ----------------------------------------------------- */

/* Which offsets anything jumps to, so a label can be put there. The raw view
   prints `then -> 0x0094` and leaves the reader to find 0x0094; a label at the
   destination is what makes a jump followable, and it is what delvmod's ddasm
   does. */
function dvmBranchTargets(ops) {
  const out = new Set();
  for (const [at, delta, mn, arg] of ops) {
    if (mn === 'then' || mn === 'branch' || mn === 'cases')
      for (const m of String(arg).matchAll(/0x[0-9A-F]+/gi)) out.add(parseInt(m[0], 16));
  }
  return out;
}

function dvmFoldRender(arc, b, resid) {
  dvmContextResid = (typeof resid === 'number') ? resid : null;
  const objs = dvmExtents(b, resid);
  const slots = dvmSlotNames(b, resid);
  const lines = [];
  const hex4 = v => v.toString(16).padStart(4, '0').toUpperCase();
  const str = seg => decodeMacRoman(seg.filter(c => c));
  let folded = 0, partial = 0;
  for (const [st, en, kind] of objs) {
    const seg = b.subarray(st, Math.min(en, b.length));
    if (!seg.length) continue;
    const named = slots.get(st);
    const name = named || ('obj_' + hex4(st));
    if (kind === 'function') {
      const body = seg.subarray(3);
      const ph = dvmProseHead(body);
      if (ph && ph.bare) { lines.push('', name + ' = ' + JSON.stringify(str(ph.head))); folded++; continue; }
      const r = dvmDisassemble(seg, 3);
      /* A branch target is an offset into the RESOURCE, and an op's `at` is an
         offset into the function -- 0x0061 + 0x2F is the 0x0090 that `if_not`
         jumps to. The raw listing prints the relative one and leaves the reader
         to do that sum, which is why no label could be put anywhere. Everything
         below is absolute: the gutter, the labels and the object names then all
         mean the same thing, and it is the thing Edit Bytes shows. */
      const targets = dvmBranchTargets(r.ops);
      const ctx = { label: t => 'L' + String(t).replace(/^0x/i, '').toUpperCase().padStart(4, '0') };
      const args = [];
      for (let i = 0; i < seg[1]; i++) args.push('Arg' + i.toString(16).padStart(2, '0').toUpperCase());
      const locals = seg[2] ? '   // ' + seg[2] + ' local' + (seg[2] === 1 ? '' : 's') : '';
      lines.push('', 'function ' + name + '(' + args.join(', ') + ') {' + locals);
      const forest = dvmForest(r.ops);
      let over = 0;
      for (const n of forest) {
        const abs = st + n.at;
        if (targets.has(abs)) lines.push('  ' + ctx.label('0x' + hex4(abs)) + ':');
        const text = dvmFoldStatement(n, ctx);
        if (/\/\*under\*\//.test(text)) over++;
        lines.push('    ' + hex4(abs) + '  ' + text);
      }
      lines.push('}');
      if (r.bad) { lines.push('// ^ decoder desynced (' + r.bad + ' unrecognised bytes) - unreliable'); partial++; }
      else if (over) { lines.push('// ^ ' + over + ' statement(s) the fold could not balance; read them in the raw listing'); partial++; }
      else folded++;
    } else if (kind === 'array') {
      const v = dvmArrayContents(seg);
      lines.push('', name + ' = ' + (v ? '[' + v.join(', ') + ']' : '<array>'));
      folded++;
    } else if (kind === 'table') { lines.push('', name + ' = <table>'); folded++; }
    else if (dvmIsProse(seg) || dvmIsIdentifier(seg)) { lines.push('', name + ' = ' + JSON.stringify(str(seg))); folded++; }
    else { lines.push('', name + ' = <' + seg.length + ' bytes>'); partial++; }
  }
  const cls = dvmClassName(resid);
  const sym = resourceSymbol(resid);
  if (sym) lines.unshift('// name: ' + sym);
  lines.unshift('// ' + objs.length + ' objects: ' + folded + ' folded, ' + partial + ' not');
  if (cls) lines.unshift('// class: ' + cls + ' (resource 0x' + resid.toString(16).toUpperCase() + ')');
  return lines.join('\n');
}

/* ---- the round trip ------------------------------------------------------
 * Re-emit the flat op sequence a tree came from. utilities/fold_check.mjs
 * compares this with dvmDisassemble's own output for every function in the
 * archive: equal means the tree lost nothing and invented nothing, which is
 * the half of the proof that the frame-balance count does not cover.
 */
function dvmExpandForest(forest) {
  const out = [];
  const walk = nodes => {
    for (const n of nodes) {
      out.push([n.at, n.expect ? 1 : 0, n.mn, n.arg]);
      for (let i = 0; i < n.groups.length; i++) {
        walk(n.groups[i]);
        const c = n.close[i];
        if (c) out.push([c.at, -1, c.mn, c.arg]);
      }
    }
  };
  walk(forest);
  return out;
}

/* ===========================================================================
 * Structure recovery: the jumps as blocks.
 * ===========================================================================
 *
 * The folded view above leaves control flow exactly as the bytes have it --
 * `if (!(C)) goto L0094` and a label at 0x0094 -- because every line of it is a
 * local reorganisation of ops that are there, and three assertions in
 * utilities/fold_check.mjs say so. This half is different in kind, and the
 * difference is the whole reason it is separate:
 *
 *   A MISREAD JUMP RENDERS A WRONG PROGRAM THAT LOOKS RIGHT.
 *
 * Nothing in the fold's assertions catches that. Every statement would still be
 * individually correct; only their nesting would lie, and a nesting that lies is
 * worse than a goto that does not, because a reader believes it.
 *
 * So the recovery is built around two rules.
 *
 * FIRST, IT REFUSES RATHER THAN GUESSES. Each pattern below is matched only
 * when the region it would build is closed -- nothing outside it jumps into its
 * middle, and nothing inside it leaves except to the one place control is meant
 * to continue. A jump that fits no pattern stays a `goto` with its label, which
 * is the honest rendering and is what the folded view already gives. A function
 * can come out wholly structured, partly, or not at all, and the header line
 * says which.
 *
 * SECOND, THE CONTROL-FLOW GRAPH HAS TO SURVIVE IT. Every statement has
 * successors that the flat listing fixes: a conditional goes to its target and
 * to the statement after it, a `branch` only to its target, a `return` nowhere.
 * Re-derive that edge set from the NESTING -- an `if (C) { A }` means the
 * condition reaches the first statement of A and also the statement after the
 * block, the last statement of A reaches the statement after the block, and a
 * `while` sends its body's end back to the condition -- and the two sets must be
 * identical. Equal edge sets mean the recovery moved the braces and nothing
 * else. `utilities/structure_check.mjs` does that for every function in the
 * archive and has a control that swaps a branch target to prove it can fail.
 *
 * That is the analogue of the fold's re-expansion, one level up, and it is the
 * only reason this half is shippable at all.
 */

/* The top-level statements of a function, in address order, each with what the
   listing says its successors are. `abs` is the offset in the resource, which
   is the coordinate the branch targets use. */
function dvmStatementList(forest, segStart) {
  const out = [];
  for (const n of forest) {
    const abs = segStart + n.at;
    const targetOf = mn => {
      const c = n.close.find(c => c.mn === mn);
      const m = c && /0x[0-9A-F]+/i.exec(c.arg);
      return m ? parseInt(m[0], 16) : null;
    };
    let kind = 'plain', targets = [];
    if (n.mn === 'if' || n.mn === 'if_not') {
      const t = targetOf('then');
      if (t === null) kind = 'plain'; else { kind = 'cond'; targets = [t]; }
    } else if (n.mn === 'branch') {
      const m = /0x[0-9A-F]+/i.exec(dvmBareOperand(n.arg));
      if (m) { kind = 'jump'; targets = [parseInt(m[0], 16)]; }
    } else if (n.mn === 'switch') {
      const c = n.close.find(c => c.mn === 'cases');
      const list = c ? (c.arg.match(/0x[0-9A-F]+/gi) || []) : [];
      kind = 'switch'; targets = list.map(t => parseInt(t, 16));
    } else if (n.mn === 'return' || n.mn === 'exit') {
      kind = 'end';
    }
    out.push({ abs, node: n, kind, targets, negated: n.mn === 'if' });
  }
  return out;
}

/* The edge set the flat listing fixes. A `cond` and a `switch` fall through as
   well as branching; a `jump` does not; an `end` goes nowhere. An edge off the
   end of the function is dropped and counted, since there is nothing to point
   at -- compiler output does not do it, and a function that does is left
   unstructured rather than explained. */
function dvmFlatEdges(stmts) {
  const edges = new Set();
  let offEnd = 0;
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    const next = (i + 1 < stmts.length) ? stmts[i + 1].abs : null;
    for (const t of s.targets) edges.add(s.abs + '>' + t);
    if (s.kind === 'end' || s.kind === 'jump') continue;
    if (next === null) { offEnd++; continue; }
    edges.add(s.abs + '>' + next);
  }
  return { edges, offEnd };
}

/* Is [lo, hi) a region a block can be built from? Two conditions, and refusing
 * when either fails is the whole of what keeps this half honest:
 *
 *   nothing outside the range jumps into its MIDDLE -- an entry past `lo` means
 *   the range is not a block, it is part of something larger, and
 *
 *   nothing inside leaves except to one of `allowed`, which is the place control
 *   is meant to continue -- a jump out to anywhere else means the same thing.
 *
 * A fallthrough into the middle is impossible, the statements being in address
 * order. This is a top-level function rather than a closure inside the recovery
 * so that utilities/structure_check.mjs can replace it with one that says yes to
 * everything: a recovery that cannot be caught claiming a region it has no right
 * to is not one anybody should trust.
 */
function dvmRegionClosed(stmts, index, lo, hi, allowed, sources) {
  if (hi <= lo) return false;
  /* `sources[j]` is every statement index that jumps to j, built once per
     function. Without it this walked the whole function for every candidate
     region, and the recovery did not finish on the archive at all. */
  for (let j = lo + 1; j < hi; j++) {
    const from = sources[j];
    if (!from) continue;
    for (const k of from) if (k < lo || k >= hi) return false;
  }
  const ok = new Set(allowed);
  for (let k = lo; k < hi; k++) {
    for (const t of stmts[k].targets) {
      if (ok.has(t)) continue;
      const j = index.get(t);
      if (j === undefined || j < lo || j >= hi) return false;
    }
  }
  return true;
}

/* ---- two tests, one condition --------------------------------------------
 * Two conditionals in a row that jump to the same place are one condition:
 *
 *     if_not A -> L0094               if (A && B) {
 *     if_not B -> L0094      -->          ...
 *     ...                             }
 *   L0094:
 *
 * which is what a compiler emits for `if (A && B)`, and also for
 * `if (A) { if (B) { ... } }`. The two are the same program, so the merged
 * spelling costs nothing when the nesting was already recoverable -- and where
 * it was not, it is the only spelling that is: `if (A && B) { .. } else { .. }`
 * shares its else between both tests, which nested ifs cannot say, and a loop
 * whose test is two tests (`while (A && B)`) otherwise keeps its second test as
 * a goto out of its own body. Measured on 22 September 2026: 212 such pairs,
 * every one of them two `if_not`s.
 *
 * Merged only when nothing else jumps to the second test. If something did, the
 * second test would be a place of its own that control can reach without the
 * first, and one condition cannot be entered halfway. On the shipped archive no
 * pair fails that, so the guard is never exercised here and nothing here
 * demonstrates it working; it is kept because a hand-edited archive can do
 * what Ambrosia's compiler did not.
 *
 * A pair of `if`s (jump when true) would merge the same way into
 * `if (A || B) goto L`; the archive has none, and a mixed pair is left alone
 * rather than spelt with a negation inside a conjunction.
 *
 * THE SPELLING. The VM also has `and` and `or` opcodes (0x5C, 0x5D; 245 uses
 * in the archive). They are not the same thing: an opcode consumes two values
 * already on the stack, so both sides were evaluated, where the jump pair never
 * evaluates B when A is false. So `&&` and `||` are kept for this, which is
 * what a reader of C-like text takes them to mean, and the opcodes are spelt
 * `and` and `or` (DVM_INFIX). They were both `&&` until 22 September 2026, and
 * only the brackets told them apart.
 *
 * utilities/structure_check.mjs tests each merged condition against the flat
 * listing for every truth assignment of its parts, reading the text the
 * listing prints; the edge check sees the pair as one node.
 */
function dvmMergeConditions(stmts) {
  const jumpedTo = new Set();
  for (const s of stmts) for (const t of s.targets) jumpedTo.add(t);
  const list = [], merged = new Map();
  for (let i = 0; i < stmts.length; i++) {
    const s = stmts[i];
    const parts = [s];
    while (s.kind === 'cond' && s.targets.length === 1 && i + 1 < stmts.length) {
      const b = stmts[i + 1];
      if (b.kind !== 'cond' || b.targets.length !== 1 || b.targets[0] !== s.targets[0] ||
          b.negated !== s.negated || jumpedTo.has(b.abs)) break;
      parts.push(b);
      i++;
    }
    if (parts.length === 1) { list.push(s); continue; }
    for (const p of parts.slice(1)) merged.set(p.abs, s.abs);
    list.push({ abs: s.abs, node: s.node, kind: 'cond', targets: [s.targets[0]],
                negated: s.negated, parts });
  }
  return { list, merged };
}

/* ---- the recovery --------------------------------------------------------
 * A recursive reduction over the statement list. `build(lo, hi, follow)` turns
 * statements [lo, hi) into a list of nodes, given that control continues at
 * `follow` when the range runs out. Every pattern checks that the region it
 * would claim is closed before claiming it.
 *
 * It runs over the list with its paired tests merged (above), and says which
 * statements were folded into another's condition in `merged`, because the
 * flat control-flow graph the check compares against has them as nodes of
 * their own.
 */
function dvmRecoverStructure(flat) {
  const { list: stmts, merged } = dvmMergeConditions(flat);
  const index = new Map();
  for (let i = 0; i < stmts.length; i++) index.set(stmts[i].abs, i);
  const sources = [];
  for (let i = 0; i < stmts.length; i++) {
    for (const t of stmts[i].targets) {
      const j = index.get(t);
      if (j === undefined) continue;
      (sources[j] || (sources[j] = [])).push(i);
    }
  }
  let gotos = 0, structured = 0;
  /* The unconditional jumps the structure swallows: an if-else's `goto Lend` at
     the end of its then-branch, and a loop's `goto Lhead` at the end of its
     body. Each exists only to reach a place the braces now say, so it is not
     rendered -- and utilities/structure_check.mjs has to be told, because the
     control-flow graph is legitimately one node shorter for each of them. A
     jump with one outgoing edge can be contracted out of a graph without
     changing what reaches what, which is why absorbing it is safe and why the
     check contracts rather than excuses. */
  const absorbed = new Set();

  const closed = (lo, hi, allowed) => dvmRegionClosed(stmts, index, lo, hi, allowed, sources);
  /* A jump may only be absorbed if nothing else jumps TO it. The check found
     this: 0x1804's function at +0x2 has `goto 0x57B` at 0x40F, and 0x57B is
     itself the `goto` closing a loop. Absorbing 0x57B left 0x40F pointing at a
     label that no longer existed -- a dangling `goto L057B` for a reader, and an
     edge to a node that is not in the tree for the graph. Refusing to absorb it
     keeps the label, which is the same rule as everywhere else here: when the
     structure cannot account for something, leave it as the bytes have it. */
  const absorbable = i => !sources[i] || sources[i].length === 0;

  function build(lo, hi, follow) {
    const out = [];
    let i = lo;
    while (i < hi) {
      const s = stmts[i];
      const after = (i + 1 < stmts.length) ? stmts[i + 1].abs : follow;

      if (s.kind === 'cond' && s.targets.length === 1) {
        const tIdx = index.get(s.targets[0]);
        if (tIdx !== undefined) {

          // while (C) { body }:  Lhead: if_not C -> Lafter / body / goto Lhead
          if (tIdx > i + 1 && tIdx <= hi) {
            const last = stmts[tIdx - 1];
            if (last.kind === 'jump' && last.targets[0] === s.abs &&
                absorbable(tIdx - 1) &&
                closed(i + 1, tIdx - 1, [s.abs, s.targets[0]])) {
              out.push({ kind: 'while', cond: s, body: build(i + 1, tIdx - 1, s.abs) });
              absorbed.add(last.abs);
              structured += 2;
              i = tIdx; continue;
            }
          }

          // if (C) { then } else { else }:
          //   if_not C -> Lelse / then / goto Lend / Lelse: else / Lend:
          if (tIdx > i + 1 && tIdx <= hi) {
            const beforeElse = stmts[tIdx - 1];
            if (beforeElse.kind === 'jump') {
              const endIdx = index.get(beforeElse.targets[0]);
              if (endIdx !== undefined && endIdx >= tIdx && endIdx <= hi &&
                  absorbable(tIdx - 1) &&
                  closed(i + 1, tIdx - 1, [beforeElse.targets[0]]) &&
                  closed(tIdx, endIdx, [beforeElse.targets[0]])) {
                out.push({ kind: 'ifelse', cond: s,
                           then: build(i + 1, tIdx - 1, beforeElse.targets[0]),
                           els: build(tIdx, endIdx, beforeElse.targets[0]) });
                absorbed.add(beforeElse.abs);
                structured += 2;
                i = endIdx; continue;
              }
            }
          }

          // if (C) { then }:  if_not C -> Lafter / then / Lafter:
          if (tIdx > i + 1 && tIdx <= hi && closed(i + 1, tIdx, [s.targets[0]])) {
            out.push({ kind: 'if', cond: s, then: build(i + 1, tIdx, s.targets[0]) });
            structured++;
            i = tIdx; continue;
          }

          // do { body } while (C):  Lhead: body / if C -> Lhead
          if (tIdx < i && tIdx >= lo && closed(tIdx, i, [s.abs, s.targets[0]])) {
            /* The body is what has just been emitted for [tIdx, i). Take those
               nodes back off `out` rather than building them again: building
               twice is what made this not finish, and it also risked counting
               the same block twice. */
            const body = dvmTakeBack(out, stmts[tIdx].abs);
            if (body) {
              out.push({ kind: 'dowhile', cond: s, body });
              structured++;
              i = i + 1; continue;
            }
          }
        }
      }

      // loop { body }:  Lhead: body / goto Lhead, with no condition at all
      if (s.kind === 'jump' && s.targets.length === 1) {
        const tIdx = index.get(s.targets[0]);
        if (tIdx !== undefined && tIdx <= i && tIdx >= lo &&
            absorbable(i) && closed(tIdx, i + 1, [s.abs])) {
          const body = dvmTakeBack(out, stmts[tIdx].abs);
          if (body) {
            out.push({ kind: 'loop', body });
            absorbed.add(s.abs);
            structured++;
            i = i + 1; continue;
          }
        }
      }

      if (s.targets.length) gotos++;
      out.push({ kind: 'stmt', stmt: s });
      i++;
    }
    return out;
  }

  const tree = build(0, stmts.length, null);
  return { tree, gotos, structured, absorbed, merged };
}

/* Take the trailing nodes of `out` that start at or after `abs`, in order, for a
 * backward jump to claim as its body. Returns null when they do not line up with
 * a node boundary -- which means the loop's head is in the middle of a block
 * already built, and a region that cannot be taken cleanly is one to refuse.
 */
function dvmTakeBack(out, abs) {
  let i = out.length;
  while (i > 0) {
    const f = dvmFirstAbs(out[i - 1]);
    if (f === null || f < abs) break;
    i--;
  }
  if (i >= out.length) return null;                 // nothing to take
  if (dvmFirstAbs(out[i]) !== abs) return null;     // the head is not a boundary
  return out.splice(i, out.length - i);
}

/* The first statement offset a node reaches, which is what an edge into it
   points at. */
function dvmFirstAbs(node) {
  switch (node.kind) {
    case 'stmt': return node.stmt.abs;
    case 'if': case 'ifelse': case 'while': return node.cond.abs;
    case 'dowhile': case 'loop':
      return node.body.length ? dvmFirstAbs(node.body[0]) : null;
    default: return null;
  }
}

/* The edge set the NESTING implies. Compared with dvmFlatEdges over every
   function by utilities/structure_check.mjs; equal means the braces moved and
   nothing else did. */
function dvmStructureEdges(tree, follow) {
  const edges = new Set();
  const walk = (list, cont) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const after = (i + 1 < list.length) ? dvmFirstAbs(list[i + 1]) : cont;
      switch (n.kind) {
        case 'stmt': {
          const s = n.stmt;
          for (const t of s.targets) edges.add(s.abs + '>' + t);
          if (s.kind !== 'end' && s.kind !== 'jump' && after !== null)
            edges.add(s.abs + '>' + after);
          break;
        }
        case 'if': {
          const head = n.then.length ? dvmFirstAbs(n.then[0]) : after;
          if (head !== null) edges.add(n.cond.abs + '>' + head);
          if (after !== null) edges.add(n.cond.abs + '>' + after);
          walk(n.then, after);
          break;
        }
        case 'ifelse': {
          const a = n.then.length ? dvmFirstAbs(n.then[0]) : after;
          const b = n.els.length ? dvmFirstAbs(n.els[0]) : after;
          if (a !== null) edges.add(n.cond.abs + '>' + a);
          if (b !== null) edges.add(n.cond.abs + '>' + b);
          walk(n.then, after); walk(n.els, after);
          break;
        }
        case 'while': {
          const head = n.body.length ? dvmFirstAbs(n.body[0]) : n.cond.abs;
          edges.add(n.cond.abs + '>' + head);
          if (after !== null) edges.add(n.cond.abs + '>' + after);
          walk(n.body, n.cond.abs);
          break;
        }
        case 'dowhile': {
          const head = n.body.length ? dvmFirstAbs(n.body[0]) : n.cond.abs;
          edges.add(n.cond.abs + '>' + head);
          if (after !== null) edges.add(n.cond.abs + '>' + after);
          walk(n.body, n.cond.abs);
          break;
        }
        case 'loop': {
          const head = n.body.length ? dvmFirstAbs(n.body[0]) : null;
          walk(n.body, head);
          break;
        }
      }
    }
  };
  walk(tree, follow);
  return edges;
}

/* A conditional's expression, in the polarity the reader needs.
 * `if_not C -> T` jumps when C is false, so the statements it falls through to
 * run when C is TRUE -- which is the `if (C)` a reader wants. `if C -> T` is the
 * other way round, and its fallthrough block is `if (!(C))`. A backward jump
 * wants the opposite of both, since a loop repeats when the jump IS taken.
 *
 * A merged condition (dvmMergeConditions) joins its parts: two `if_not`s fall
 * through when both hold, so `A && B`, and jump when that fails; two `if`s jump
 * when either holds, so `A || B`. `ctx.leaf`, when given, spells a part --
 * utilities/structure_check.mjs names each one `c0`, `c1`, ... and evaluates the
 * result, which is how the joined text is held to the flat listing.
 */
function dvmCondJoined(s, ctx) {
  const leaf = p => (ctx && ctx.leaf) ? ctx.leaf(p) : dvmFoldFrame(p.node.groups[0] || [], ctx);
  if (!s.parts) return leaf(s);
  return s.parts.map(p => dvmCondOperand(leaf(p))).join(s.negated ? ' || ' : ' && ');
}
function dvmCondFallthrough(s, ctx) {
  const e = dvmCondJoined(s, ctx);
  return s.negated ? '!(' + e + ')' : e;
}
function dvmCondTaken(s, ctx) {
  const e = dvmCondJoined(s, ctx);
  return s.negated ? e : '!(' + e + ')';
}
/* A part of a joined condition, bracketed when it has a space outside every
   bracket: `Arg01 has MeleeWeapon && Var00` reads either way, and
   `(Arg01 has MeleeWeapon) && Var00` reads one. A call, a comparison (the fold
   brackets every infix operator) and a negation are already one piece. */
function dvmCondOperand(e) {
  let depth = 0;
  for (const c of e) {
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') depth--;
    else if (c === ' ' && depth === 0) return '(' + e + ')';
  }
  return e;
}

/* ---- for-each, break and continue ------------------------------------------
 * The engine's iterators are one syscall called three ways, and the compiler
 * lays a loop over one out the same way every time:
 *
 *     Var01 = EquipmentIterator(&Var1, 0, Arg01)      the first item
 *     while (!(EquipmentIterator(&Var1, 1))) {         not yet finished
 *         ...
 *         Var01 = EquipmentIterator(&Var1, 2)          the next item
 *     }
 *
 * which is `for Var01 in EquipmentIterator(Arg01) { ... }`. 152 loops in the
 * archive, measured on 22 September 2026, and every one recovers as a `while`
 * with its start just before it and its step last in its body -- so this is a
 * way of printing a recovered `while`, not a new pattern for the recovery, and
 * the tree the structure check compares is the same tree either way.
 *
 * The state word (`&Var1`) is not printed on the `for` line: it is the
 * iterator's bookkeeping, it names the slot one early (the handoff's item on
 * iterator storage), and the raw and folded listings still show it. The
 * iterator keeps its name as the listing gives it rather than losing the
 * `Iterator`, so it can be searched for.
 *
 * The step moves to the loop's closing brace, which carries its offset in the
 * gutter so that a ring on the step lands on the brace rather than on the
 * statement before it; the `for` line carries the start's, and the test,
 * between the two, rings the `for` line.
 *
 * What makes it safe to print, beyond the three calls agreeing on the name,
 * the state word and the loop variable:
 *
 *   nothing jumps to the TEST except the loop's own back edge, which the
 *   recovery absorbed -- in a `for` there is nowhere to jump that runs the test
 *   without the step, and
 *
 *   every goto to the STEP can be printed without a label: a `continue` of
 *   this loop, or a `break` out of a loop nested in it whose exit is the step.
 *   Four jumps in three functions (0xEA3, 0xEB7, 0x1827) are the second kind,
 *   an inner loop left for the outer one's step, and read as the `break` they
 *   are. A goto to the step that is neither would leave the loop a `while`;
 *   the archive has none.
 *
 * `continue` and `break` are printed for every kind of loop, and only for a
 * jump whose innermost enclosing loop is the one it continues or leaves -- the
 * loop a reader would take it to mean. A jump from an inner loop to an outer
 * one's step or exit stays a goto. utilities/structure_check.mjs reads each
 * `break` and `continue` in the printed text, finds its loop by the braces as
 * a reader would, and holds the flat statement's target to that loop's step or
 * exit.
 */

/* The three calls, read off the ops rather than the text. Returns what the
   `for` line needs, or null. `prev` is the node before the `while`. */
function dvmForEach(prev, w, ctx) {
  if (!prev || prev.kind !== 'stmt' || w.kind !== 'while' || !w.body.length) return null;
  const last = w.body[w.body.length - 1];
  if (last.kind !== 'stmt' || last.stmt.parts || w.cond.parts || w.cond.node.mn !== 'if') return null;
  // `Var = Name(args)` with Name an iterator syscall; the values its frame
  // folds to, which are exactly the arguments the folded listing prints.
  const call = n => {
    const g = n.groups[0] || [];
    if (g.length !== 1 || !/^sys \w*Iterator$/.test(g[0].mn) || g[0].expect !== 1) return null;
    return { name: g[0].mn.slice(4), vals: dvmReduceFrame(g[0].groups[0] || [], ctx) };
  };
  const setOf = n => (n.mn === 'set_local' && /^0x[0-9A-F]+$/i.test(dvmBareOperand(n.arg)) &&
                      parseInt(dvmBareOperand(n.arg), 16) < 0x30) ? dvmBareOperand(n.arg) : null;
  const slot = setOf(prev.stmt.node);
  if (slot === null || setOf(last.stmt.node) !== slot) return null;
  const start = call(prev.stmt.node), test = w.cond.node.groups[0] && w.cond.node.groups[0].length === 1 &&
    /^sys /.test(w.cond.node.groups[0][0].mn) ? { name: w.cond.node.groups[0][0].mn.slice(4),
    vals: dvmReduceFrame(w.cond.node.groups[0][0].groups[0] || [], ctx) } : null, step = call(last.stmt.node);
  if (!start || !test || !step || start.name !== test.name || step.name !== start.name) return null;
  const state = start.vals[0];
  if (!/^&Var\w+$/.test(state || '') || start.vals[1] !== '0') return null;
  if (test.vals.length !== 2 || test.vals[0] !== state || test.vals[1] !== '1') return null;
  if (step.vals.length !== 2 || step.vals[0] !== state || step.vals[1] !== '2') return null;
  return { start: prev.stmt, step: last.stmt, name: start.name, args: start.vals.slice(2),
           variable: 'Var' + parseInt(slot, 16).toString(16).toUpperCase().padStart(2, '0') };
}

/* Which `while`s print as `for`, and which jumps print as `break` or
   `continue`. `fors` maps a while node to its dvmForEach reading; `exits` maps a
   statement object to the word it prints instead of `goto`. */
function dvmLoopExits(tree, ctx) {
  const fors = new Map();
  let exits = new Map();
  const jumps = [];
  (function collect(list) {
    for (const n of list) {
      if (n.kind === 'stmt' && n.stmt.targets.length) jumps.push(n.stmt);
      for (const k of ['then', 'els', 'body']) if (n[k]) collect(n[k]);
    }
  })(tree);
  (function findFors(list) {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      if (n.kind === 'while') {
        const f = dvmForEach(list[i - 1], n, ctx);
        if (f && !jumps.some(s => s.targets.includes(n.cond.abs))) fors.set(n, f);
      }
      for (const k of ['then', 'els', 'body']) if (n[k]) findFors(n[k]);
    }
  })(tree);
  // Where each loop continues and where it is left.
  const mark = (list, cont) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const after = (i + 1 < list.length) ? dvmFirstAbs(list[i + 1]) : cont;
      let at = null;
      if (n.kind === 'while') at = { cont: fors.has(n) ? fors.get(n).step.abs : n.cond.abs, exit: n.cond.targets[0] };
      else if (n.kind === 'dowhile') at = { cont: n.cond.abs, exit: after };
      else if (n.kind === 'loop') at = { cont: n.body.length ? dvmFirstAbs(n.body[0]) : null, exit: after };
      if (at) {
        (function direct(l) {
          for (const x of l) {
            if (x.kind === 'stmt' && x.stmt.targets.length === 1 && (x.stmt.kind === 'jump' || x.stmt.kind === 'cond')) {
              const t = x.stmt.targets[0];
              if (t === at.exit && at.exit !== null) exits.set(x.stmt, 'break');
              else if (t === at.cont && at.cont !== null) exits.set(x.stmt, 'continue');
            }
            // A nested loop's statements belong to it, not to this one.
            if (x.kind === 'if' || x.kind === 'ifelse') { direct(x.then); if (x.els) direct(x.els); }
          }
        })(n.body);
      }
      const inner = n.kind === 'while' || n.kind === 'dowhile' ? n.cond.abs
                  : n.kind === 'loop' ? (n.body.length ? dvmFirstAbs(n.body[0]) : null) : after;
      for (const k of ['then', 'els', 'body']) if (n[k]) mark(n[k], inner);
    }
  };
  /* A `for` stands only if every jump to its step is printed as a `continue`
     of it or a `break` out of a loop nested in it that ends on the step; a
     jump left as a goto would need a label on the step, which has no line of
     its own. Dropping one `for` changes where that loop continues, so mark
     again until nothing is dropped. */
  for (;;) {
    exits = new Map();
    mark(tree, null);
    let dropped = false;
    for (const [w, f] of fors)
      if (jumps.some(s => s.targets.includes(f.step.abs) && !exits.has(s))) { fors.delete(w); dropped = true; }
    if (!dropped) break;
  }
  return { fors, exits };
}

/* Which offsets a goto still points at once the structure is recovered, so a
   label is printed only where one is needed. A jump printed as `break` or
   `continue` needs none. */
function dvmRemainingLabels(tree, exits) {
  const out = new Set();
  const walk = list => {
    for (const n of list) {
      if (n.kind === 'stmt' && !(exits && exits.has(n.stmt))) { for (const t of n.stmt.targets) out.add(t); }
      for (const k of ['then', 'els', 'body']) if (n[k]) walk(n[k]);
    }
  };
  walk(tree);
  return out;
}

/* The listing, from the recovered tree. `loops` is dvmLoopExits' reading.
 *
 * A label goes on the line of whatever node begins at its offset. Until
 * 22 September 2026 only a plain statement took one, so a goto into the head
 * of an `if` or a `while` named a label that was printed nowhere -- 94 of
 * them across the archive. (Another 116 aim inside a run of text, where no
 * statement starts, and have no line a label could go on; that is the
 * disassembler's question.) A `do` and a `loop` have no line of their own at
 * their first offset, so theirs is left to the first node of the body, which
 * does.
 *
 * Every closing brace sits under the keyword it closes. It sat two columns
 * left of it until the `for` loop's brace needed the step's offset in the
 * gutter, and a brace with a gutter cannot be further left than the text.
 */
function dvmRenderStructured(tree, ctx, labels, indent, lines, loops) {
  const pad = '    '.repeat(indent);
  const hex4 = v => v.toString(16).toUpperCase().padStart(4, '0');
  const line = (at, text) => lines.push('    ' + (at === null ? '    ' : hex4(at)) + pad + '  ' + text);
  const label = at => { if (at !== null && labels.has(at)) lines.push('  ' + ctx.label('0x' + hex4(at)) + ':'); };
  const fors = loops ? loops.fors : new Map(), exits = loops ? loops.exits : new Map();
  const skip = new Set();
  for (const f of fors.values()) skip.add(f.start);
  for (const n of tree) {
    if (n.kind === 'stmt' && skip.has(n.stmt)) continue;
    const f = n.kind === 'while' ? fors.get(n) : null;
    if (f) label(f.start.abs);
    else if (n.kind !== 'dowhile' && n.kind !== 'loop') label(dvmFirstAbs(n));
    switch (n.kind) {
      case 'stmt': {
        const s = n.stmt, word = exits.get(s);
        const go = word || (s.targets.length === 1 ? 'goto ' + ctx.label('0x' + hex4(s.targets[0])) : null);
        if (s.kind === 'cond' && go && (word || s.parts)) line(s.abs, 'if (' + dvmCondTaken(s, ctx) + ') ' + go);
        else if (s.kind === 'jump' && word) line(s.abs, word);
        else line(s.abs, dvmFoldStatement(s.node, ctx));
        break;
      }
      case 'if':
        line(n.cond.abs, 'if (' + dvmCondFallthrough(n.cond, ctx) + ') {');
        dvmRenderStructured(n.then, ctx, labels, indent + 1, lines, loops);
        line(null, '}');
        break;
      case 'ifelse':
        line(n.cond.abs, 'if (' + dvmCondFallthrough(n.cond, ctx) + ') {');
        dvmRenderStructured(n.then, ctx, labels, indent + 1, lines, loops);
        line(null, '} else {');
        dvmRenderStructured(n.els, ctx, labels, indent + 1, lines, loops);
        line(null, '}');
        break;
      case 'while':
        if (f) {
          line(f.start.abs, 'for ' + f.variable + ' in ' + f.name + '(' + f.args.join(', ') + ') {');
          dvmRenderStructured(n.body.slice(0, -1), ctx, labels, indent + 1, lines, loops);
          line(f.step.abs, '}');
        } else {
          line(n.cond.abs, 'while (' + dvmCondFallthrough(n.cond, ctx) + ') {');
          dvmRenderStructured(n.body, ctx, labels, indent + 1, lines, loops);
          line(null, '}');
        }
        break;
      case 'dowhile':
        line(null, 'do {');
        dvmRenderStructured(n.body, ctx, labels, indent + 1, lines, loops);
        line(n.cond.abs, '} while (' + dvmCondTaken(n.cond, ctx) + ')');
        break;
      case 'loop':
        line(null, 'loop {');
        dvmRenderStructured(n.body, ctx, labels, indent + 1, lines, loops);
        line(null, '}');
        break;
    }
  }
}

/* The third state of the script view's toggle. Same decode and same fold as
   dvmFoldRender; the difference is that the jumps become blocks where a block
   can be proven, and stay gotos where one cannot. The header line says how many
   of each, because a reader is entitled to know whether they are looking at
   recovered structure or at the same gotos with extra indentation. */
function dvmStructureRender(arc, b, resid, out) {
  dvmContextResid = (typeof resid === 'number') ? resid : null;
  const objs = dvmExtents(b, resid);
  const slots = dvmSlotNames(b, resid);
  const lines = [];
  const hex4 = v => v.toString(16).padStart(4, '0').toUpperCase();
  const str = seg => decodeMacRoman(seg.filter(c => c));
  let whole = 0, partial = 0, plain = 0;
  /* Where each `break` and `continue` goes, by the offset in its gutter, for a
     caller that makes them links (`out.exits`, read by listingJumps). The text
     cannot say it: the words carry no label, which is the point of them. A
     target that is a jump the braces absorbed is followed to where that jump
     goes, since the absorbed jump has no line of its own to ring. */
  const exitsAt = new Map();
  for (const [st, en, kind] of objs) {
    const seg = b.subarray(st, Math.min(en, b.length));
    if (!seg.length) continue;
    const name = slots.get(st) || ('obj_' + hex4(st));
    if (kind !== 'function') {
      if (kind === 'array') {
        const v = dvmArrayContents(seg);
        lines.push('', name + ' = ' + (v ? '[' + v.join(', ') + ']' : '<array>'));
      } else if (kind === 'table') lines.push('', name + ' = <table>');
      else if (dvmIsProse(seg) || dvmIsIdentifier(seg)) lines.push('', name + ' = ' + JSON.stringify(str(seg)));
      else lines.push('', name + ' = <' + seg.length + ' bytes>');
      continue;
    }
    const ph = dvmProseHead(seg.subarray(3));
    if (ph && ph.bare) { lines.push('', name + ' = ' + JSON.stringify(str(ph.head))); continue; }
    const r = dvmDisassemble(seg, 3);
    const ctx = { label: t => 'L' + String(t).replace(/^0x/i, '').toUpperCase().padStart(4, '0') };
    const args = [];
    for (let i = 0; i < seg[1]; i++) args.push('Arg' + i.toString(16).padStart(2, '0').toUpperCase());
    const locals = seg[2] ? '   // ' + seg[2] + ' local' + (seg[2] === 1 ? '' : 's') : '';
    lines.push('', 'function ' + name + '(' + args.join(', ') + ') {' + locals);
    const forest = dvmForest(r.ops);
    const stmts = dvmStatementList(forest, st);
    const rec = dvmRecoverStructure(stmts);
    const loops = dvmLoopExits(rec.tree, ctx);
    const labels = dvmRemainingLabels(rec.tree, loops.exits);
    dvmRenderStructured(rec.tree, ctx, labels, 0, lines, loops);
    lines.push('}');
    const jumpOf = new Map(stmts.filter(s => rec.absorbed.has(s.abs)).map(s => [s.abs, s.targets[0]]));
    for (const s of loops.exits.keys()) {
      let t = s.targets[0];
      for (let k = 0; jumpOf.has(t) && k < 8; k++) t = jumpOf.get(t);
      exitsAt.set(s.abs, t);
    }
    // A jump printed as `break` or `continue` is structure, not a goto.
    const left = rec.gotos - loops.exits.size;
    if (r.bad) lines.push('// ^ decoder desynced (' + r.bad + ' unrecognised bytes) - unreliable');
    else if (!stmts.some(s => s.targets.length)) plain++;
    else if (left) { lines.push('// ^ ' + left + ' jump(s) fit no block and are left as goto'); partial++; }
    else whole++;
  }
  const cls = dvmClassName(resid);
  const sym = resourceSymbol(resid);
  if (sym) lines.unshift('// name: ' + sym);
  if (out) out.exits = exitsAt;
  lines.unshift('// ' + whole + ' function(s) fully structured, ' + partial +
                ' with jumps left over, ' + plain + ' with no jumps at all');
  if (cls) lines.unshift('// class: ' + cls + ' (resource 0x' + resid.toString(16).toUpperCase() + ')');
  return lines.join('\n');
}

/* Every block in a recovered tree, with the statement control reaches when the
 * block ends. utilities/structure_check.mjs walks these to re-derive, from the
 * tree alone, that each is a region with one way in and one way out -- the
 * property dvmRegionClosed enforces while building, and which has to be checked
 * from the outside or the check is only asking the recovery whether it agrees
 * with itself.
 */
function dvmBlocksOf(tree, follow) {
  const out = [];
  const walk = (list, cont) => {
    for (let i = 0; i < list.length; i++) {
      const n = list[i];
      const after = (i + 1 < list.length) ? dvmFirstAbs(list[i + 1]) : cont;
      /* `exits` is every place a block may legitimately be left for. An if or
         else block has one: the statement after it. A LOOP body has two, and the
         second is a break -- a jump straight out to the statement after the loop,
         which real code here does (20 while bodies in the archive) and which is
         rendered as the `goto` it is. Two named exits is still a region; a jump
         to a third place is not, and that is what the check is for. */
      switch (n.kind) {
        case 'if':
          out.push({ kind: 'if', body: n.then, exits: [after] });
          walk(n.then, after);
          break;
        case 'ifelse':
          out.push({ kind: 'if', body: n.then, exits: [after] });
          out.push({ kind: 'else', body: n.els, exits: [after] });
          walk(n.then, after); walk(n.els, after);
          break;
        case 'while':
          out.push({ kind: 'while', body: n.body, exits: [n.cond.abs, after] });
          walk(n.body, n.cond.abs);
          break;
        case 'dowhile':
          out.push({ kind: 'do', body: n.body, exits: [n.cond.abs, after] });
          walk(n.body, n.cond.abs);
          break;
        case 'loop': {
          const head = n.body.length ? dvmFirstAbs(n.body[0]) : null;
          out.push({ kind: 'loop', body: n.body, exits: [head, after] });
          walk(n.body, head);
          break;
        }
      }
    }
  };
  walk(tree, follow);
  return out;
}
