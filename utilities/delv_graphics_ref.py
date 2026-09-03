#!/usr/bin/env python3
"""Decode every graphic in a Cythera archive with delvmod and print a digest.

    python3 utilities/delv_graphics_ref.py delvmod \\
            "$TMPDIR/Cythera Data.data" > "$TMPDIR/gfx_ref.json"

This is the reference half of utilities/delv_graphics_check.mjs. delvmod's
DelvImage is an independent implementation of the Delver Compressed Graphics
format, written by the people who worked the format out; the viewer's
decompressDCG is a separate port of the same thing. Until now nothing had ever
compared them, so the viewer's snapshot proved its decoder was *stable* without
anything proving it was *right*.

Nothing in the delvmod checkout is modified. The two compatibility shims the
library needs on a modern Python -- an inspect.getargspec stand-in and a stub
for the uninstalled parsley -- are installed from outside, by
utilities/delv_compat.py. They lived here as a second copy until the port arrived
carrying the first; see the note in that file for what each one is for.
"""
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from delv_compat import install_shims  # noqa: E402


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    delv_path, archive_path = sys.argv[1], sys.argv[2]
    sys.path.insert(0, delv_path)
    install_shims()

    import delv.archive
    import delv.graphics

    # delvmod chats to stdout while it works ("Decrypt if required <Resource
    # 8800>..."), which lands in the middle of the JSON. Send anything it prints
    # to stderr for the duration and put stdout back at the end.
    real_stdout = sys.stdout
    sys.stdout = sys.stderr

    arc = delv.archive.Archive(open(archive_path, 'rb'))
    out = []
    # The same five subindexes the viewer draws, and delvmod's own mapping from
    # subindex to image class (_CLASS_HINTS in delv/graphics.py).
    for subindex in (135, 137, 141, 131, 142):
        for res in arc.resources(subindex):
            rec = {'resid': res.resid, 'subindex': subindex}
            try:
                img = delv.graphics.DelvImageFactory(res)
                # Two shapes, and the difference matters. `image` is the whole
                # decompression buffer, logical_width wide -- for the 8Fxx
                # "sized" resources that is padded out to a multiple of four.
                # get_image() crops it to the part the engine actually draws,
                # which is what the viewer's decodeResource returns. Comparing
                # the padded buffer against the cropped one reports eleven
                # false disagreements.
                logical = bytes(img.image)
                visible = bytes(img.get_image())
                rec.update({
                    'ok': True,
                    'width': img.width, 'height': img.height,
                    'logical_width': img.logical_width,
                    'logical_height': img.logical_height,
                    'pixels': len(visible),
                    'sha256': hashlib.sha256(visible).hexdigest()[:16],
                    'logical_pixels': len(logical),
                    'logical_sha256': hashlib.sha256(logical).hexdigest()[:16],
                })
            except Exception as exc:
                rec.update({'ok': False, 'error': '%s: %s' % (type(exc).__name__, exc)})
            out.append(rec)
    sys.stdout = real_stdout
    json.dump(out, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
