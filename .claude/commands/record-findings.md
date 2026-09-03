---
description: Write what this session learned into the existing docs, in the house voice
argument-hint: [optional: which files or which topic]
---

Record what this session established in the documentation that already exists.
$ARGUMENTS

The point is that the next person — or the next model — does not pay twice for
anything this session paid for once. Work in this order.

1. **Find the right existing file.** `CLAUDE.md` for anything about how the two
   trees work and the traps in them; `NEXT-SESSION.md` for the state of the work
   and what to do next; `SYSTEMLESS.md` for what is known about Cythera under
   systemless; `port/README.md` and `port/POWERPC-NOTES.md` for the port; a
   file's own header comment when the fact belongs to that code. **Do not create
   a new markdown file**, and do not start a CHANGELOG — this repository records
   reasoning in place, not in a log.

2. **Write down what went wrong, not only what works.** The dead ends are the
   expensive part: the fix that was plausible and changed nothing, the harness
   that was wrong rather than the code, the constraint that turned out to be
   about one machine. Say what was tried and rejected, so it is not retried.
   Anything that cost more than an hour to find is worth a paragraph.

3. **Correct what is now stale.** A reference to a file that has been deleted, a
   measurement that has moved, an "impossible" that has since been done. Check
   claims you relied on this session rather than assuming they still hold.

4. **Match the register.** Long comments explaining *why*, in prose; the reason
   a design is the way it is, and the bug that motivated it. No bullet-point
   summaries of what the diff did, no `feat:`/`fix:` prefixes, no emoji. See the
   Conventions section of `CLAUDE.md`.

5. **Then run the checks and commit.** `node utilities/check_all.mjs` for the
   site, `port/smoke.sh` for the port, and only what the change touches. The
   commit message is a sentence describing the change from the user's side.
