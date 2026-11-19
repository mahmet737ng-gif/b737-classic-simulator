#!/usr/bin/env python3
"""Audit immutable panel art by bytes, SHA-256, Git Blob SHA-1, and append-only history.

The authoritative manifest records original bytes and stable immutable paths.
On CI checkout, all uploaded items must be present and must match exactly.
When GITHUB_BASE_SHA is set, changes or deletions of previously locked files
are rejected; additions at NEW paths are allowed. It does not replace GitHub
repository rulesets that must be configured by a repository administrator.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path

repo = Path(__file__).resolve().parents[1]
manifest = json.loads((repo / "panel-mosaic-lab/immutable-manifest.json").read_text(encoding="utf-8"))
assets = manifest["assets"]
issues = []
ids = set()
paths = set()

# The P8 owner explicitly retired these old copies. Compare exact former bytes
# and permit deletion only; all original cockpit locks still use the same rule.
retirement_file = "panel-mosaic-lab/fire-asset-retirements.json"
retirements = json.loads((repo / retirement_file).read_text())["assets"]
retired = {entry["path"]: entry for entry in retirements}
p8_paths = re.compile(
    r"panel-mosaic-lab/assets/locked/2026-10-23/(?:"
    r"(?:Switches/Fire_Handles/)?FIRE_HANDEL_(?:[A-Z0-9_]+\.(?:png|webp)|(?:APU_45_|ENGINES_45_)?manifest\.json)"
    r"|LIGHTS/(?:black-amber-v1/(?:gallery|mounted)/|unified-mounted-v1/|unified-v2/)?"
    r"(?:APU_DET_INOP|ENG_[12]_OVERHEAT|[LR]_BOTTLE_DISCHARGED|WHEEL_WELL_RED)_(?:ON|OFF)\.svg)"
)
for rel in retired:
    if not p8_paths.fullmatch(rel) or (repo / rel).exists():
        issues.append("Invalid or republished P8 retirement: " + rel)

def git(*args):
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True)

for item in assets:
    ident = item["id"]
    rel = item["path"]
    if ident in ids:
        issues.append("Duplicate ID: " + ident)
    if rel in paths:
        issues.append("Duplicate path: " + rel)
    ids.add(ident)
    paths.add(rel)
    if item.get("status") != "uploaded":
        issues.append("Uncommitted image in immutable manifest: " + ident)
        continue
    if not rel.startswith("panel-mosaic-lab/assets/locked/") or not item.get("immutable"):
        issues.append("Unsafe locked path/policy: " + ident)
        continue
    image = repo / rel
    if not image.is_file():
        issues.append("Missing locked image: " + rel)
        continue
    data = image.read_bytes()
    actual_sha = hashlib.sha256(data).hexdigest()
    actual_git_blob = hashlib.sha1(("blob " + str(len(data)) + "\0").encode() + data).hexdigest()
    if actual_sha != item["sha256"]:
        issues.append("SHA-256 CHANGED for " + ident + " (" + actual_sha + ")")
    if len(data) != item["bytes"]:
        issues.append("BYTE LENGTH CHANGED for " + ident)
    if item.get("gitBlobSha1") and actual_git_blob != item["gitBlobSha1"]:
        issues.append("GIT BLOB CHANGED for " + ident)
    print("LOCKED", ident, len(data), actual_sha, rel)

# Verify any future locked files as soon as users manually upload them.
# Pending entries can be absent without failing a deployment; an incorrect
# upload always fails both CI and the live SHA-gated viewer.
for item in manifest.get("pendingUploads", []):
    asset = repo / item["path"]
    if not asset.exists():
        print("AWAITING UPLOAD", item["id"], item["path"])
        continue
    content = asset.read_bytes()
    actual = hashlib.sha256(content).hexdigest()
    if len(content) != item["bytes"] or actual != item["sha256"]:
        issues.append("PENDING IMAGE DOES NOT MATCH ORIGINAL: " + item["id"])
    else:
        print("PENDING ASSET VERIFIED", item["id"], len(content), actual)

base = os.getenv("GITHUB_BASE_SHA", "").strip()
if base and base != "0" * 40:
    head = git("rev-parse", "HEAD")
    verify = git("rev-parse", "--verify", base + "^{commit}")
    if head.returncode or verify.returncode:
        issues.append("Cannot verify locked history against requested Git base " + base)
    else:
        old_retirement = git("show", base + ":" + retirement_file)
        if old_retirement.returncode == 0:
            former = json.loads(old_retirement.stdout)["assets"]
            if any(retired.get(entry["path"]) != entry for entry in former):
                issues.append("Existing P8 retirement record altered")
        diff = git("diff", "--no-renames", "--name-status", "-z", base, "HEAD", "--", "panel-mosaic-lab/assets/locked/")
        if diff.returncode:
            issues.append("Git immutable diff failed: " + diff.stderr.strip())
        else:
            records = diff.stdout.split("\0")
            for i in range(0, len(records)-1, 2):
                status = records[i]
                pathname = records[i+1]
                if status == "D" and pathname in retired:
                    blob = git("rev-parse", base + ":" + pathname)
                    if blob.returncode == 0 and blob.stdout.strip() == retired[pathname]["gitBlobSha1"]:
                        continue
                if not status.startswith("A"):
                    issues.append("LOCKED CONTENT WAS CHANGED OR REMOVED: " + status + " " + pathname)
        prior = git("show", base + ":panel-mosaic-lab/immutable-manifest.json")
        if prior.returncode == 0:
            previous = json.loads(prior.stdout)
            index = {a["id"]: a for a in assets}
            for old in previous.get("assets", []):
                if old.get("status") != "uploaded":
                    continue
                new = index.get(old["id"])
                if new is None:
                    issues.append("Previously locked asset omitted from manifest: " + old["id"])
                else:
                    for field in ("path", "sha256", "bytes", "gitBlobSha1", "immutable"):
                        if old.get(field) != new.get(field):
                            issues.append("Previously locked manifest entry altered: " + old["id"] + "." + field)
if issues:
    print("\n".join("ERROR: " + msg for msg in issues), file=sys.stderr)
    raise SystemExit(1)
print(f"PASS: {len(assets)} exact locked assets; no existing binary replacements detected.")
