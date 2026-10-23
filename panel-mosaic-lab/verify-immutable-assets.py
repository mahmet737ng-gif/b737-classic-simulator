#!/usr/bin/env python3
"""Verify immutable B737 cockpit image archives by SHA-256.

Pending files remain explicitly pending; this does not pretend to upload files.
After every listed binary is in GitHub, switch manifest statuses to 'uploaded'.
Once uploaded, edits/replacements fail this check.
"""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parents[1]
manifest_path = root / "panel-mosaic-lab" / "immutable-manifest.json"
manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
failures = []
present = 0
for item in manifest["assets"]:
    p = root / item["path"]
    if not p.is_file():
        if item["status"] != "PENDING_BINARY_UPLOAD":
            failures.append(f"Missing locked image: {item['id']}: {item['path']}")
        else:
            print(f"PENDING {item['id']}: {item['path']}")
        continue
    present += 1
    data = p.read_bytes()
    sha = hashlib.sha256(data).hexdigest()
    if sha != item["sha256"]:
        failures.append(f"SHA-256 mismatch {item['id']}: {sha}")
    if len(data) != item["bytes"]:
        failures.append(f"File size mismatch {item['id']}: {len(data)}")
    print(f"VERIFIED {item['id']} [{len(data)} bytes]")

if failures:
    raise SystemExit("\n".join(failures))
print(f"Immutable image check passed: {present}/{len(manifest['assets'])} uploaded, "
      f"{len(manifest['assets'])-present} pending.")
