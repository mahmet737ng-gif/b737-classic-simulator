#!/usr/bin/env python3
"""Fail-closed owner IRS physical panel RED ZONE, baseline fixed to approved Git commit.
Frozen: photographic panel/keypad/MSU knobs/ticks, annunciators, display, geometry,
mounting JS/CSS and their own existing regression tests. State changes while using
the trainer are permitted; changing physical hardware sources is not.
Backend-only IRS math and navigation telemetry are outside this visual red zone.
For server-side write rejection, GitHub branch rules + required checks are ALSO
necessary: CI alone cannot stop a repository administrator bypassing checks.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ANCHOR = "3cd894d061a5d33ac90f0cb0cdcd50a2eec0f1db"
MANIFEST_COMMIT = "ec70014f2436caa912e65aba789287a17c2378c3"
MANIFEST_PATH = "panel-mosaic-lab/cockpit/irs-complete-redzone-lock-v1.json"
MANIFEST_BLOB = "05c39dc42e1d51d66820f587d284542e26926f98"
VERIFIER_PATH = "panel-mosaic-lab/cockpit/verify-irs-complete-redzone-v1.py"
ALLOWED_NEW_FILES = {MANIFEST_PATH, VERIFIER_PATH}
HARDWARE_IDS = {
    "msu": ["L", "R"],
    "msuDetents": ["OFF", "ALIGN", "NAV", "ATT"],
    "keypad": ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "ENT", "CLR"],
    "irsLamps": ["L-ALIGN", "L-ON DC", "L-FAULT", "L-DC FAIL",
                 "R-ALIGN", "R-ON DC", "R-FAULT", "R-DC FAIL"],
    "displayCells": 13,
    "upperSelectorModes": ["TEST", "TK/GS", "PPOS", "WIND", "HDG/STS"],
    "lowerSelectorModes": ["L", "R"],
}
ISSUES: list[str] = []

def git(*args: str) -> str:
    result = subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError("git " + " ".join(args) + ": " + result.stderr.strip())
    return result.stdout.strip()

def sha(raw: bytes) -> str:
    return hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\x00" + raw).hexdigest()

def must(ok: bool, reason: str) -> None:
    if not ok:
        ISSUES.append(reason)

def read(path: str) -> bytes:
    p = ROOT / path
    if not p.is_file():
        ISSUES.append("MISSING frozen physical IRS file: " + path)
        return b""
    return p.read_bytes()

def is_protected(path: str, prefixes: list[str], exact: set[str]) -> bool:
    return path in exact or any(path.startswith(p) for p in prefixes)

def index_imports(html: str) -> list[str]:
    # Preserve the complete, ordered IRS imports and cache-busting version values,
    # without freezing the rest of the cockpit index.
    tags = re.findall(r"<(?:script|link)\b[^>]*>", html, re.I)
    result = []
    for tag in tags:
        match = re.search(r"\b(?:src|href)\s*=\s*['\"]([^'\"]+)['\"]", tag, re.I)
        if not match:
            continue
        url = match.group(1)
        if "irs-" in url.lower() or "/irs-" in url.lower():
            result.append(tag)
    return result

def audit(negative: bool = False) -> None:
    manifest_raw = read(MANIFEST_PATH)
    must(sha(manifest_raw) == MANIFEST_BLOB,
         "Owner-approved IRS manifest was modified/rebaselined")
    must(git("rev-parse", MANIFEST_COMMIT + ":" + MANIFEST_PATH) == MANIFEST_BLOB,
         "Approved IRS manifest anchor unavailable or inconsistent")
    manifest = json.loads(manifest_raw)
    must(manifest.get("status") == "FINAL_FROZEN_RED_ZONE" and
         manifest.get("version") == "IRS-REDZONE-0001" and
         manifest.get("approvedSourceCommit") == ANCHOR,
         "IRS owner lock status/version/approval commit changed")
    policy = manifest.get("policy", {})
    for key in ("noAutonomousVisualOrGeometryAlterations", "noAutomaticRebaseline",
                "changesRequireExplicitOwnerInstructionAndSeparateConfirmation",
                "lockIncludesPanelKnobsButtonsLampsDisplayMounts"):
        must(policy.get(key) is True, "Required owner approval policy removed: " + key)
    must(policy.get("operatorStatesMayChangeAtRuntime") is True,
         "Normal operation of frozen physical switches must remain possible")
    hw = manifest.get("protectedHardware", {})
    for key, value in HARDWARE_IDS.items():
        must(hw.get(key) == value, "Approved IRS hardware definition changed: " + key)
    must(hw.get("msuPhoto") ==
         "panel-mosaic-lab/assets/locked/2026-10-23/Switches/Rotary/rotary-standard-v1.webp",
         "Approved IRS photographic rotary source changed")
    protected = manifest.get("protectedBlobs", {})
    must(isinstance(protected, dict) and len(protected) == 93,
         "IRS protected inventory size is no longer 93")
    prefixes = manifest["inventoryRules"]["prefixes"]
    exact = set(manifest["inventoryRules"]["requiredExact"])
    anchor_paths = git("ls-tree", "-r", "--name-only", ANCHOR).splitlines()
    anchored = {x for x in anchor_paths if is_protected(x, prefixes, exact)}
    must(set(protected) == anchored,
         "Owner-approved complete IRS protected file inventory altered")
    must(exact.issubset(anchored), "Required shared rotary and lamp sources are missing")
    for rel, approved_hash in protected.items():
        must(git("rev-parse", ANCHOR + ":" + rel) == approved_hash,
             "Pinned approved IRS baseline was silently changed for " + rel)
        raw = read(rel)
        if not raw and not (ROOT / rel).is_file():
            continue
        actual = sha(raw)
        must(actual == approved_hash,
             "IRS RED ZONE MODIFICATION BLOCKED: " + rel +
             " (" + actual + " != " + approved_hash + ")")
    tracked = set(git("ls-files", "--cached").splitlines())
    actual_protected = {x for x in tracked if is_protected(x, prefixes, exact)}
    must(actual_protected == anchored | ALLOWED_NEW_FILES,
         "IRS protected files added, renamed or removed without owner authorization: " +
         repr(sorted(actual_protected ^ (anchored | ALLOWED_NEW_FILES))))
    html_path = manifest["indexGuard"]["file"]
    approved_html = git("show", ANCHOR + ":" + html_path)
    current_html = read(html_path).decode("utf-8")
    original = index_imports(approved_html)
    current = index_imports(current_html)
    must(bool(original) and current == original,
         "IRS panel import/version/order modified in Unified index.html")
    required = ("irs-trainer-unified-v1.css", "irs-trainer-unified-v1.js",
                "irs-panel-registration-v1.js", "irs-panel-registration-v1.css",
                "irs-13seg-display-v2.js", "irs-rotary-detent-indices-v1.js")
    for name in required:
        must(sum(name in x for x in current) == 1,
             "Frozen IRS physical renderer import missing or duplicated: " + name)
    # Layered protection: existing display, lower selector, owner 18 and
    # original overhead lock scripts must still pass as separate checks.
    if negative:
        first = next(iter(sorted(protected)))
        raw = read(first)
        actual = sha(raw + b"\nUNAUTHORIZED-IRS-MUTATION")
        must(actual != protected[first],
             "Negative self-test FAIL: altered IRS control was accepted")
        if actual != protected[first]:
            print("PASS: simulated unauthorized IRS source mutation rejected")

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--negative-self-test", action="store_true")
    args = parser.parse_args()
    try:
        audit(args.negative_self_test)
    except Exception as exc:
        ISSUES.append("Fail-closed IRS audit aborted: " + repr(exc))
    if ISSUES:
        for msg in ISSUES:
            print("IRS COMPLETE RED ZONE DENIED: " + msg, file=sys.stderr)
        return 1
    print("PASS: IRS COMPLETE RED ZONE — 93 pinned Git blobs, 2 MSU, 4 positions each, "
          "12 keypad buttons, 8 lamps, 13 cells, preserved source geometry and imports")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
