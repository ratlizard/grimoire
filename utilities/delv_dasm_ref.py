#!/usr/bin/env python3
"""Disassemble every script in a Cythera archive with delvmod and print a
canonical trace of the walk.

    python3 utilities/delv_dasm_ref.py delvmod \\
            "$TMPDIR/Cythera Data.data" > "$TMPDIR/dasm_ref.json"

This is the reference half of utilities/delv_dasm_check.mjs. delvmod's
ddasm.Disassembler is the implementation Bryce Schroeder wrote against the
format he reverse-engineered; the viewer's dvmDisassemble in
js/delv-script.js is a separate walk over the same bytecode.
delv_crosscheck.mjs proves the two OPCODE TABLES identical on every run, but
until now nothing had ever run the two WALKS against each other -- the
expectation stack, the code/text mode switching, the subroutine handling,
the operand widths actually consumed. A walk that has been wrong since the
day it was written passes the decoder snapshot forever, which is exactly the
hole delv_graphics_check.mjs closed for decompressDCG.

What is compared is deliberately NOT the rendered text -- the two sides
format differently on purpose (labels, symbolics, indentation). It is the
sequence of decode events: which offsets each walk treated as instruction
starts, which opcode byte it saw there, and where it read runs of direct
text. Two walks that consume the same bytes the same way produce identical
event streams whatever they print; a walk that desyncs by even one operand
byte diverges immediately and permanently. Events are:

    [offset, opcode]   an instruction decoded at `offset` (opcode = the byte)
    ["t", offset]      a run of direct/implicit text starting at `offset`

per function, keyed by the function's offset in the resource, flattened in
decode order. Three ddasm bookkeeping artifacts are normalised here because
they are representation, not walk: the synthetic OpEndr pseudo-ops it
inserts at conversation-response chain targets (nothing is decoded there);
OpCases, whose recorded offset is two bytes past the 0x40 that opened it
because the case count is read before the object is constructed; and nested
subroutine DFunctions, which are flattened inline as an [offset, 0x81] event
plus their own events, matching a linear walk over the same bytes.

Scope mirrors delv/hints.py, which is delvmod's own statement of what is a
script: subindex (resid>>8)-1 in 0..14 or 47 is dscript.Direct, 15..125 is
dscript.Class, minus the subindexes hints.py maps to graphics, maps, props
and sound. Subindex 3 (0x04xx, the AI combat scripts) is excluded from both
sides: those are Pascal-name-prefixed raw bodies, ddasm's read_DVMObj
misreads the leading length byte as a class table offset, and the viewer
strips the name with dvmNamedScript -- neither side is an oracle for the
other there.

Nothing in the delvmod checkout is modified; the compatibility shims come
from utilities/delv_compat.py, installed from outside, as everywhere else.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from delv_compat import install_shims  # noqa: E402

# The subindexes hints.py maps AWAY from dscript: maps (127), prop lists
# (128), graphics (131, 135, 137, 141, 142), sound (144). Everything else in
# 0..14, 15..125 and 47 is a script. Kept as a literal rather than imported
# so the scope is visible here; delv.hints is still imported below and the
# two are asserted to agree, so this copy cannot drift silently.
NON_SCRIPT_SI = {127, 128, 131, 135, 137, 141, 142, 144}


def script_mode(resid):
    """'direct', 'class', or None if the resource is not a script."""
    si = (resid >> 8) - 1
    if si in NON_SCRIPT_SI:
        return None
    if si == 3:
        return None          # AI combat scripts: name-prefixed, see above
    if 0 <= si <= 14 or si == 47:
        return 'direct'
    if 15 <= si <= 125:
        return 'class'
    return None


def canonical_events(code, ddasm, out):
    """Flatten a DFunction.code list into the canonical event stream."""
    for line in code:
        if isinstance(line, tuple):
            text, offs = line
            if text and offs >= 0:
                out.append(['t', offs])
        elif isinstance(line, ddasm.DFunction):
            # An inline subroutine: ddasm nests it, a linear walk sees its
            # 0x81 header and then its body. Same bytes, flattened.
            out.append([line.offset, 0x81])
            canonical_events(line.code, ddasm, out)
        elif isinstance(line, ddasm.OpEndr):
            continue        # synthetic marker, no byte was decoded
        elif isinstance(line, ddasm.OpCases):
            out.append([line._true_offset - 2, 0x40])
        elif isinstance(line, ddasm.Opcode):
            out.append([line._true_offset, line.opcode])
    return out


def collect_functions(obj, ddasm, funcs, others, seen):
    """Walk the loaded object model, recording every DFunction's events and
       the offsets of everything else that carries one."""
    if id(obj) in seen:
        return
    seen.add(id(obj))
    if isinstance(obj, ddasm.DFunction):
        funcs[obj.offset] = canonical_events(obj.code, ddasm, [])
    elif isinstance(obj, ddasm.DClass):
        for v in obj.values():
            collect_functions(v, ddasm, funcs, others, seen)
        for _off, sub in obj.subs:
            collect_functions(sub, ddasm, funcs, others, seen)
    elif isinstance(obj, ddasm.DTable):
        for v in obj.values():
            collect_functions(v, ddasm, funcs, others, seen)
        others.setdefault(obj.offset, 'table')
    elif isinstance(obj, ddasm.DArray):
        for v in obj:
            collect_functions(v, ddasm, funcs, others, seen)
        others.setdefault(obj.offset, 'array')
    elif isinstance(obj, ddasm.DData):
        others.setdefault(obj.offset, 'data')
    elif isinstance(obj, ddasm.DDirect):
        others.setdefault(obj.offset, 'raw')
    # plain strings and ints carry no offset; nothing to record


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    delv_path, archive_path = sys.argv[1], sys.argv[2]
    sys.path.insert(0, delv_path)
    install_shims()

    import delv.archive
    import delv.ddasm as ddasm
    import delv.dscript
    import delv.hints

    # ddasm reuses the name `offset` on OpWriteFarWord/OpReadFarWord for the
    # far-word OPERAND, clobbering the instruction offset Opcode.__init__
    # recorded -- so `.offset` cannot be trusted as "where this instruction
    # is". Observe the true position from outside instead of editing the
    # checkout: wrap __init__ to note tell()-1 before parse() runs. This
    # changes nothing about how ddasm decodes; it only remembers a number the
    # original computes and then loses.
    _orig_op_init = ddasm.Opcode.__init__

    def _noting_init(self, opcode, bfile, func):
        self._true_offset = bfile.tell() - 1
        _orig_op_init(self, opcode, bfile, func)
    ddasm.Opcode.__init__ = _noting_init

    # The scope table above is a copy of what hints.py expresses in code;
    # prove they agree before trusting it.
    for si in list(NON_SCRIPT_SI) + [0, 7, 14, 15, 47, 60, 125, 126]:
        cls = delv.hints._OBJECT_SI_HINTS.get(si)
        is_script = cls in (delv.dscript.Direct, delv.dscript.Class)
        claims = script_mode((si + 1) << 8) is not None or si == 3
        if is_script != claims:
            print('scope table disagrees with delv.hints at subindex %d' % si,
                  file=sys.stderr)
            return 1

    # ddasm narrates subroutine discovery to stdout, which would land in the
    # middle of the JSON. Park stdout on stderr for the duration.
    real_stdout = sys.stdout
    sys.stdout = sys.stderr

    arc = delv.archive.Archive(open(archive_path, 'rb'))
    out = {}
    for res in arc.resources():
        mode = script_mode(res.resid)
        if mode is None:
            continue
        rec = {'mode': mode}
        try:
            data = bytes(res.get_data())
            dd = ddasm.Disassembler(context_resource=res.resid)
            dd.disassemble(data, force_classmode=(mode == 'class'))
            funcs, others = {}, {}
            seen = set()
            for content in dd.content:
                collect_functions(content, ddasm, funcs, others, seen)
            rec.update({
                'ok': True,
                'functions': {str(k): v for k, v in sorted(funcs.items())},
                'others': {str(k): v for k, v in sorted(others.items())},
            })
        except Exception as exc:
            rec.update({'ok': False,
                        'error': '%s: %s' % (type(exc).__name__, exc)})
        out['%04X' % res.resid] = rec

    sys.stdout = real_stdout
    json.dump(out, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
