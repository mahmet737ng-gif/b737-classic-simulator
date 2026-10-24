#!/usr/bin/env python3
"""Block publication if any byte of the owner-approved UPD-0012 mosaic changes."""
import argparse
import hashlib
import json
from pathlib import Path
import sys

MANIFEST_SHA256 = "74ce5f058cb02717d3c32a82754669a8f6b7fe21ae2fd8fe9c50db9da047e267"

def verify(root):
    manifest_path = root / 'panel-mosaic-lab/all-overhead/final-lock.json'
    try:
        raw = manifest_path.read_bytes()
    except OSError as exc:
        return [f'Final overhead lock missing: {exc}']
    if hashlib.sha256(raw).hexdigest() != MANIFEST_SHA256:
        return ['Final overhead lock manifest was altered. Restore the approved manifest.']
    manifest = json.loads(raw)
    problems = []
    for name, expected in manifest['files'].items():
        path = root / name
        if not path.is_file():
            problems.append(f'Missing locked overhead file: {name}')
            continue
        data = path.read_bytes()
        if len(data) != expected['size'] or hashlib.sha256(data).hexdigest() != expected['sha256']:
            problems.append(f'Changed locked overhead file: {name}')
    return problems

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    problems = verify(args.root.resolve())
    if problems:
        print('FINAL OVERHEAD UPD-0012 LOCK FAILED', file=sys.stderr)
        for problem in problems:
            print(problem, file=sys.stderr)
        sys.exit(1)
    print('PASS: FINAL OVERHEAD UPD-0012 is unchanged, including all 18 source images and OH01-OH25 geometry.')
