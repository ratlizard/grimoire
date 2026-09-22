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
  0x5C: '&&', 0x5D: '||',
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
    case 'set_local': return bare + ' = ' + (g[0] || '');
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
