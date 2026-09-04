#!/usr/bin/env python3
"""delv_conversation_ref.py -- delvmod's reading of the conversation prompts.

    python3 utilities/delv_conversation_ref.py <delvmod path> <Cythera Data> 

Emits JSON on stdout:

    {"<resid hex>": [[offset, keywords, target], ...], ...}

one entry per `conversation_response` in each character script
(0x1801..0x18FF), in the order delvmod decodes them:

    offset     the operation's absolute offset in the resource
    keywords   the prompt string, comma-joined, exactly as stored
    target     the offset the prompt jumps to when it is chosen

This is the same idea as delv_dasm_ref.py: what is compared is not rendered
text -- the two sides format conversations quite differently -- but the decode
events, so that two walks which consume the same bytes the same way agree
whatever they print.

`dvmConversation` in js/delv-script.js reads these out of the disassembled
`conversation_response` opcode, splitting its argument at the last ` -> 0x`.
delvmod reads them in `DCConversationPrompt`, which splits the prompt on
commas into `promptstr` and keeps the jump in `nextfield`. Joining that list
back with commas is what makes the two comparable.

Characters are class scripts and need `delv.script.ClassContainer`; plain
`Script` reads one as a bare atom and reports no conversation at all.

delvmod could not decode a conversation at all until `ae4b3b1`; two str
constants were being compared against bytes. Nothing in delvmod is edited
from here -- see utilities/delv_compat.py -- and it is the oracle precisely
because it is a separate implementation.
"""
import json
import os
import sys


def main():
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    delv_path, data_path = sys.argv[1], sys.argv[2]

    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    os.environ.setdefault('DELVMOD', delv_path)
    import delv_compat  # noqa: F401  (imported for its side effects)
    sys.path.insert(0, delv_path)

    import delv.archive
    import delv.library
    import delv.script

    # The archive narrates every decrypt to stdout, which would land in the
    # middle of the JSON. Park stdout on stderr for the duration, as
    # delv_dasm_ref.py does for ddasm's subroutine narration.
    real_stdout = sys.stdout
    sys.stdout = sys.stderr

    archive = delv.archive.Archive(data_path)
    library = delv.library.Library(archive)

    def prompts_in(obj, seen, out, depth=0):
        """Collect every DCConversationPrompt reachable from a decoded script.

        The decoded form is a tree of Code, Array and DispatchTable objects
        whose shape varies by script, so this walks rather than assuming a
        path. `seen` guards the cycles the symbol table introduces."""
        if depth > 14 or id(obj) in seen:
            return
        seen.add(id(obj))
        if isinstance(obj, delv.script.DCConversationPrompt):
            out.append(obj)
        if isinstance(obj, (list, tuple)):
            for item in obj:
                prompts_in(item, seen, out, depth + 1)
        elif isinstance(obj, dict):
            for item in obj.values():
                prompts_in(item, seen, out, depth + 1)
        elif hasattr(obj, '__dict__'):
            for value in vars(obj).values():
                prompts_in(value, seen, out, depth + 1)

    result = {}
    for resid in sorted(archive.resource_ids()):
        # The characters are 0x1801..0x18FF, which is the population
        # dialogue_check.mjs walks. They are class scripts, so they need
        # ClassContainer: plain Script reads one as a bare atom and finds
        # nothing, which is what made this look empty at first.
        if not 0x1800 <= resid < 0x1900:
            continue
        try:
            script = delv.script.ClassContainer(archive.get(resid))
            script.load_from_library(library)
        except Exception:
            # A script delvmod cannot read is reported as absent rather than
            # as an empty conversation, so the check can tell the two apart.
            continue
        found = []
        prompts_in(script, set(), found)
        if not found:
            continue
        events = []
        for prompt in found:
            keywords = b','.join(bytes(part) for part in prompt.promptstr)
            events.append([
                prompt.true_offset,
                keywords.decode('mac-roman', 'replace'),
                prompt.nextfield,
            ])
        events.sort()
        result['%04X' % resid] = events

    sys.stdout = real_stdout
    json.dump(result, sys.stdout)


if __name__ == '__main__':
    main()
