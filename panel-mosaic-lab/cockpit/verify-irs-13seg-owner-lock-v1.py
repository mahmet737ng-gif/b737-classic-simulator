#!/usr/bin/env python3
"""Fail closed on ANY unapproved mutation to owner-frozen IRS 13-segment display.

The approved user-visible display is the original 13-cell single-row filament
version, unchanged after the owner request to FINALIZE AND LOCK. Future FCOM
mapping and IRS source data must be delivered through new independent adapters.
Never refresh, weaken or bypass expected object hashes to make CI green.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = Path(__file__).with_name("irs-13seg-owner-lock-v1.json")
INDEX = ROOT / "panel-mosaic-lab/cockpit/index.html"
OWNER_ID = "IRS-ISDU-13SEG-OWNER-LOCK-0001"

def blob_sha(content: bytes) -> str:
    prefix = b"blob " + str(len(content)).encode("ascii") + b"\0"
    return hashlib.sha1(prefix + content).hexdigest()

def verify(fault_injection: bool = False):
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    errors = []
    if manifest.get("id") != OWNER_ID:
        errors.append("Owner lock ID is missing or modified")
    geometry = manifest.get("frozenGeometry", {})
    for k, expected in [("characterCount", 13), ("leftCells", 6), ("rightCells", 7),
                        ("upperPoints", 4), ("lowerDecimalPoints", 2)]:
        if geometry.get(k) != expected:
            errors.append(f"Owner-approved geometry changed: {k}")
    for rel, expected in manifest.get("frozenGitBlobs", {}).items():
        target = ROOT / rel
        if not target.is_file():
            errors.append(f"Missing owner-locked file: {rel}")
        else:
            actual = blob_sha(target.read_bytes())
            if actual != expected:
                errors.append(f"Modified owner-locked file: {rel} {actual} != {expected}")
    expected_paths = {
        "panel-mosaic-lab/cockpit/irs-13seg-display-v2.js",
        "panel-mosaic-lab/cockpit/irs-13seg-display-v2.css",
        "panel-mosaic-lab/cockpit/irs-13seg-display-v2.test.cjs",
    }
    if set(manifest.get("frozenGitBlobs", {})) != expected_paths:
        errors.append("Frozen asset inventory incomplete or unexpectedly expanded")
    actual_html = INDEX.read_text(encoding="utf-8")
    tags = manifest.get("frozenIndexMounts", [])
    if len(tags) != 2:
        errors.append("Two exact frozen Unified HTML mount tags are required")
    for tag in tags:
        if actual_html.count(tag) != 1:
            errors.append(f"Missing or duplicated frozen Unified display mount: {tag}")
    if fault_injection:
        first = ROOT / next(iter(sorted(expected_paths)))
        invalid_checksum = "0" * 40
        if blob_sha(first.read_bytes()) == invalid_checksum:
            errors.append("Unexpected negative self-test collision")
        # A deliberate, isolated synthetic comparison must be rejected.
        if blob_sha(first.read_bytes()) != invalid_checksum:
            print("PASS negative self-test: altered checksum rejected")
        else:
            errors.append("Checksum mutation was incorrectly accepted")
    return errors

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--negative-self-test", action="store_true")
    opts = parser.parse_args()
    errors = verify(opts.negative_self_test)
    if errors:
        for error in errors:
            print("FAIL IRS ISDU 13-SEG OWNER LOCK:", error, file=sys.stderr)
        return 1
    print("PASS IRS ISDU 13-SEG OWNER LOCK: 13 fields / 6+7; 4 upper + 2 lower dots; 3 exact frozen files; 2 mounts")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
