#!/usr/bin/env python3
"""Fail-closed owner lock for LOWER IRS SYS DSPL L/R only.

A future UPPER DSPL SEL / brightness module MUST be additive.
Never reset the locked snapshot or expected object IDs to force a PASS.
"""
from __future__ import annotations
import hashlib
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LOCK = Path(__file__).resolve().with_name("irs-sys-dspl-owner-lock-v1.json")
INDEX = REPO / "panel-mosaic-lab/cockpit/index.html"

def git_blob_sha(data: bytes) -> str:
    header = b"blob " + str(len(data)).encode("ascii") + bytes([0])
    return hashlib.sha1(header + data).hexdigest()

def main() -> int:
    manifest = json.loads(LOCK.read_text(encoding="utf-8"))
    if manifest.get("id") != "IRS-SYS-DSPL-OWNER-LOCK-0001":
        raise RuntimeError("LOWER IRS SYS DSPL lock manifest altered")
    errors = []
    for rel, expected in manifest["frozenGitBlobs"].items():
        target = REPO / rel
        if not target.is_file():
            errors.append(f"MISSING: {rel}")
            continue
        actual = git_blob_sha(target.read_bytes())
        if actual != expected:
            errors.append(f"MODIFIED/LOCKED: {rel} wanted={expected} got={actual}")
    html = INDEX.read_text(encoding="utf-8")
    for fragment in manifest["indexMounts"]:
        count = html.count(fragment)
        if count != 1:
            errors.append(f"INDEX MOUNT MODIFIED: expected one occurrence, got {count} for {fragment!r}")
    if errors:
        print("IRS SYS DSPL OWNER LOCK FAILED (no auto-reset):", file=sys.stderr)
        for issue in errors:
            print("  -", issue, file=sys.stderr)
        return 1
    print("PASS IRS SYS DSPL OWNER LOCK — 6 exact approved artifacts + 4 untouched mounts")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
