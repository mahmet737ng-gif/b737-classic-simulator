#!/usr/bin/env python3
"""Fail-closed, repository-wide B737 Classic Owner18 RED ZONE release gate.

The protected Git blobs are compared to the OWNER APPROVED commit, not to mutable
previous-main, the latest edited manifest, or a 'release bypass' label. Approved
runtime toggle actuation remains legal; unapproved source/visual changes do not.
For complete push prevention configure GitHub Rulesets/branch protections, too.
"""
import hashlib
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ANCHOR = "730815ed6ece9beb30950b96ba536e1ce3f2c4ca"
FROZEN = "panel-mosaic-lab/cockpit/guard-redzone-lock.json"
ENGINE_MIRROR = "engine/maps/guard-owner18-redzone-v1.json"
GUARD_DIR = "panel-mosaic-lab/assets/locked/2026-10-23/Switches/guard/"
issues = []

def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, text=True, capture_output=True)

def blob_sha(raw):
    return hashlib.sha1(("blob " + str(len(raw)) + "\0").encode() + raw).hexdigest()

def verify(condition, reason):
    if not condition:
        issues.append(reason)

def read(path):
    dest = ROOT / path
    if not dest.is_file():
        issues.append("MISSING RED ZONE file: " + path)
        return b""
    return dest.read_bytes()

def fingerprint(assembly):
    ids = ("overhead", "main", "pedestal")
    regions = []
    for r in assembly["regions"]:
        if r["id"] not in ids:
            continue
        v = {k:r[k] for k in ("id","x","y","w","h")}
        if r["id"] in ("main", "pedestal"):
            v.update({k:r[k] for k in ("nativeWidth","nativeHeight")})
            piece_id = "fo-inner" if r["id"] == "main" else "pedestal-radio"
            v["pieces"] = [{k:p[k] for k in ("id","asset","x","y","w","h")}
                           for p in r["placements"] if p["id"] == piece_id]
        regions.append(v)
    return {"canvas":assembly["canvas"],"regions":regions}

try:
    current = json.loads(read(FROZEN))
    engine = json.loads(read(ENGINE_MIRROR))
    verify(current == engine, "ENGINE DATABASE and cockpit RED ZONE mirror differ")
    verify(current["approvedCommit"] == ANCHOR, "RED ZONE approval anchor changed")
    verify(current["status"] == "FINAL_FROZEN_RED_ZONE", "RED ZONE status no longer frozen")
    verify(len(current["frozenControls"]) == 18, "18 guarded controls are required")
    verify(len(set(c["id"] for c in current["frozenControls"])) == 18,
           "Duplicated guarded switch identity")
    verify(len(current["frozenBlobs"]) == 26, "Frozen file coverage must remain complete")
    verify(current["ownerOnlyUnlock"]["noAutonomousAlterations"] is True,
           "A non-owner unlock path was introduced")

    original = git("show", ANCHOR + ":panel-mosaic-lab/cockpit/guard-owner18-v1.json")
    verify(original.returncode == 0, "Canonical approved Git commit unavailable")
    if original.returncode == 0:
        source = json.loads(original.stdout)
        verify(source["controls"] == current["frozenControls"],
               "Manifest was silently rebaselined against unapproved switch values")
        verify(json.loads(read("panel-mosaic-lab/cockpit/guard-owner18-v1.json"))["controls"] ==
               current["frozenControls"], "Guard geometry, logic, color, hinge, source or visual style altered")

    for path, expected in current["frozenBlobs"].items():
        data = read(path)
        if data or path.endswith(".gitkeep"):
            actual = blob_sha(data)
            verify(actual == expected, "RED ZONE MODIFICATION BLOCKED: " + path +
                   " (" + actual + " != " + expected + ")")
            canonical = git("rev-parse", ANCHOR + ":" + path)
            verify(canonical.returncode == 0 and canonical.stdout.strip() == expected,
                   "Frozen file inventory or expected hash was rewritten: " + path)

    original_guards = {x for x in current["frozenBlobs"] if x.startswith(GUARD_DIR)}
    now = git("ls-files", "--", GUARD_DIR)
    verify(now.returncode == 0, "Unable to enumerate all guarded switch photos")
    if now.returncode == 0:
        verify(set(now.stdout.splitlines()) == original_guards,
               "Guard asset added, deleted or renamed without owner authorization")

    art = json.loads(read("panel-mosaic-lab/cockpit/assembly.json"))
    verify(fingerprint(art) == current["frozenFootprint"],
           "Guard positions moved indirectly via cockpit regions or photo pieces")

    for name, prefix in (
        ("panel-mosaic-lab/cockpit/index.html", "./"),
        ("panel-mosaic-lab/cockpit/overhead-stage.html", "../cockpit/"),
    ):
        page = read(name).decode("utf-8")
        guard_css = prefix + "guard-owner18-v1.css?v=OWNER18-004"
        logic = prefix + "guard-close-policy-v2.js?v=OWNER18-004"
        renderer = prefix + "guard-owner18-v1.js?v=OWNER18-004"
        verify(page.count(guard_css) == 1 and page.count(logic) == 1
               and page.count(renderer) == 1 and page.index(logic) < page.index(renderer),
               "Guard CSS, close logic, or runtime import removed, duplicated or reordered: " + name)
        if name.endswith("overhead-stage.html"):
            verify(page.count(prefix + "no-old-guards.js?v=GUARDS-RESET-0002") == 1 and
                   page.count(prefix + "no-old-guards.css?v=GUARDS-RESET-0002") == 1,
                   "Original background guard masks removed: " + name)

except Exception as e:
    issues.append("RED ZONE audit aborted without passing: " + repr(e))

if "--negative-self-test" in sys.argv:
    a = b"guard-owner18 frozen sample"
    verify(blob_sha(a + b" unauthorized change") != blob_sha(a),
           "Hash-diff negative self-test failed")
    try:
        assert blob_sha(a) == blob_sha(a + b" unauthorized change")
        issues.append("Mutation test incorrectly accepted a modification")
    except AssertionError:
        print("PASS: synthetic unauthorized file modification rejected")

if issues:
    for issue in issues:
        print("RED ZONE DENIED: " + issue, file=sys.stderr)
    sys.exit(1)
print("PASS: OWNER18 RED ZONE locked 18 controls, 26 exact source/render/logic assets, approved panel registrations, runtime imports and engine database mirror")
