#!/usr/bin/env python3
"""Serialize Delver archives with delvmod and print them for comparison.

    python3 utilities/delv_write_ref.py delvmod > "$TMPDIR/write_ref.json"
    python3 utilities/delv_write_ref.py delvmod "$TMPDIR/Cythera Data.data"

This is the reference half of utilities/delv_write_check.mjs, and the writing
counterpart of delv_graphics_ref.py: delvmod's Archive.to_file() is the
implementation of record for the archive container, and the viewer's
writeDelverArchive() is a separate port of the same layout. The check fails
if the two ever emit a different byte for the same logical content.

Without a second argument it builds a handful of synthetic archives -- clear,
encrypted, mixed, gappy, accented-title, empty -- and prints each one as
{spec, bytes}: the logical content that went in, and delvmod's serialization
of it, both base64/hex-encoded into one JSON document. With a real archive as
the second argument it additionally loads that file and re-serializes it, so
the JS side can prove its read-then-write of the real thing matches delvmod's.

Encryption is always stated explicitly through hint_encryption() rather than
left to the library's subindex tables, so this script produces identical
output on any delvmod new enough to run at all -- the oracle must not change
underneath the check when the submodule is bumped.

Nothing in the delvmod checkout is modified; the shims come from
utilities/delv_compat.py as everywhere else.
"""
import base64
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from delv_compat import install_shims  # noqa: E402


def build_cases(delv):
    """Each case: (name, kwargs for header, [(resid, plaintext, encrypted)])."""
    return [
        ('empty', {}, []),
        ('clear-only', {'title': 'Test Scenario', 'player': 'Nobody'}, [
            (0x0400, b'plain text resource', False),
            (0x0403, bytes(range(64)), False),
            (0x04FF, b'last slot', False),
        ]),
        ('encrypted', {}, [
            (0x0200, b'\x01\x02\x03encrypted payload', True),
            (0x0203, b'another secret', True),
            (0x0210, b'single_known says clear', False),
        ]),
        ('mixed-and-gappy', {'title': 'Célandine', 'player': 'Müller'}, [
            (0x0200, b'enc one', True),
            (0x0400, b'clear one', False),
            (0x0480, b'clear two, big gap in slots', False),
            (0x3D07, b'printable text in an unknown subindex', False),
            (0xBC00, b'known clear subindex 187', False),
        ]),
        ('empty-resource-dropped', {}, [
            (0x0400, b'kept', False),
            (0x0401, b'', False),      # delvmod drops zero-length on write
            (0x0402, b'also kept', False),
        ]),
    ]


def build_archive(delv, header, resources):
    arc = delv.archive.Scenario()
    if 'title' in header:
        arc.scenario_title = header['title']
    if 'player' in header:
        arc.player_name = header['player']
    for resid, data, enc in resources:
        res = arc.get(resid, True)
        # bytearray(bytes) rather than set_data(text): works on every
        # delvmod vintage and keeps the oracle bytes-only.
        res.data = bytearray(data)
        res.loaded = True
        res.dirty = True
        res.hint_encryption(enc)
    return arc


def spec_of(arc, header, resources):
    return {
        'scenarioTitle': header.get('title', arc.scenario_title
                                    if isinstance(arc.scenario_title, str)
                                    else 'Cythera: Fate of Alaric'),
        'playerName': header.get('player', ''),
        'resources': [
            {'resid': resid, 'data': data.hex(), 'encrypted': enc}
            for resid, data, enc in resources
        ],
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    delv_path = sys.argv[1]

    # Decode mode: base64 DCG bytes on argv, base64 pixels out. Used by the
    # write check to prove the viewer's literal-opcode DCG encoder against
    # delvmod's decompressor, the same oracle the graphics check uses for
    # the other direction.
    if len(sys.argv) > 3 and sys.argv[2] == 'decode':
        sys.path.insert(0, delv_path)
        install_shims()
        import delv.graphics
        real_stdout = sys.stdout
        sys.stdout = sys.stderr
        img = delv.graphics.Portrait(bytearray(base64.b64decode(sys.argv[3])))
        pixels = bytes(img.get_logical_image())
        sys.stdout = real_stdout
        print(base64.b64encode(pixels).decode('ascii'))
        return 0

    real_path = sys.argv[2] if len(sys.argv) > 2 else None
    sys.path.insert(0, delv_path)
    install_shims()

    import delv.archive

    # delvmod narrates to stdout while it works; keep the JSON clean.
    real_stdout = sys.stdout
    sys.stdout = sys.stderr

    out = {'cases': []}
    for name, header, resources in build_cases(delv):
        arc = build_archive(delv, header, resources)
        blob = arc.to_string()
        out['cases'].append({
            'name': name,
            'spec': spec_of(arc, header, resources),
            'bytes': base64.b64encode(bytes(blob)).decode('ascii'),
        })

    if real_path and os.path.isfile(real_path):
        arc = delv.archive.Scenario(open(real_path, 'rb'))
        blob = arc.to_string()
        out['real'] = {
            'source': os.path.basename(real_path),
            'bytes': base64.b64encode(bytes(blob)).decode('ascii'),
        }

    sys.stdout = real_stdout
    json.dump(out, sys.stdout)
    return 0


if __name__ == '__main__':
    sys.exit(main())
