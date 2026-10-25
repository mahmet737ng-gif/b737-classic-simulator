#!/usr/bin/env python3
"""OH19 exact original-photo pixel evidence; no automatic needle release.

The 98 geometric points come from candidate bearings, not new measurements.
This script reads REAL RGB pixels around each point and reports the white-stroke
contrast. Contrast is NOT enough to assign a tick value or certify a spindle.
"""
from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
AUDIT_PATH = ROOT / "artifacts/oh19-pixel-qa/OH19_PIXEL_EVIDENCE_REPORT.json"
OUT_PATH = ROOT / "artifacts/oh19-pixel-qa/OH19_SOURCE_PIXEL_INTENSITIES.json"


def white(rgb: tuple[int, int, int]) -> int:
    """High brightness with low chroma: candidate source white paint, not proof."""
    return int(min(rgb) >= 183 and max(rgb) - min(rgb) <= 72)


def pixel_fraction(image, pivot, angle_deg, radius, offset_deg):
    """Radial sample across a potential mark; no semantic label interpretation."""
    w, h = image.size
    theta = math.radians(angle_deg + offset_deg)
    hits = 0
    samples = 0
    for r in range(max(0, round(radius) - 4), round(radius) + 24):
        # Pixel sampling is clamped, never interpolated or artificially whitened.
        x = int(round(pivot["x"] + r * math.sin(theta)))
        y = int(round(pivot["y"] - r * math.cos(theta)))
        if 0 <= x < w and 0 <= y < h:
            samples += 1
            hits += white(image.getpixel((x, y)))
    return round(hits / samples, 5) if samples else None


def main():
    # Pillow is confined to the offline original-image QA workflow.
    from PIL import Image

    audit = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
    assert audit["schema"] == "b737.oh19.pixel-evidence-review.v2"
    assert audit["releaseState"] == "BLOCKED_PIXEL_SHAFT_AND_EVERY_MINOR_TICK_VALUE_PENDING"
    source = audit["source"]
    path = (ROOT / source["asset"]).resolve()
    assert path.is_file(), "Exact OH19 photo missing; never substitute a stock image"
    raw = path.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == source["sha256"], "Original OH19 image altered"

    with Image.open(path) as original:
        assert original.format == "PNG"
        assert original.size == (source["width"], source["height"])
        image = original.convert("RGB")

    positions = []
    for ring in ("inner", "outer"):
        for t in audit[ring]:
            frac = pixel_fraction(
                image, audit["pivotCandidate"], t["angleDeg"], t["radiusPx"], 0
            )
            left = pixel_fraction(
                image, audit["pivotCandidate"], t["angleDeg"], t["radiusPx"], -2.5
            )
            right = pixel_fraction(
                image, audit["pivotCandidate"], t["angleDeg"], t["radiusPx"], 2.5
            )
            background = (left + right) / 2 if left is not None and right is not None else None
            contrast = round(frac - background, 5) if background is not None and frac is not None else None
            positions.append({
                "ring": ring,
                "index": t["index"],
                "point": t["point"],
                "candidateAngleDeg": t["angleDeg"],
                "candidateRadiusPx": t["radiusPx"],
                "previewValueFt": t.get("anchorPreviewValueFt"),  # null for 32 unclassified CAB ALT minors
                "centerWhiteFraction": frac,
                "adjacentWhiteFraction": round(background, 5) if background is not None else None,
                "localWhiteContrast": contrast,
                "sourcePhotoActuallySampled": True,
                "tickIdentityCertified": False,
                "shaftCertified": False,
                "needleTipCertified": False,
            })
    assert len(positions) == 98
    result = {
        "schema": "b737.oh19.native-white-stroke-contrast.v2",
        "originalPhotoHashVerified": True,
        "pixelReadbackComplete": True,
        "sourceSha256": source["sha256"],
        "whiteThreshold": {"minimumRGBChannel": 183, "maxRGBChannelSpan": 72},
        "sampling": "source-native radial pixel intensities, r-4 through r+23, angular sidebands +/-2.5 deg",
        "status": "NON_CERTIFYING_OBSERVATIONAL_CONTRAST",
        "mechanicalPivotCertified": False,
        "cabAltEveryMinorValueCertified": False,
        "operationalNeedlesReleased": 0,
        "points": positions,
    }
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(f"OH19 native RGB pixels sampled at {len(positions)} candidate locations")
    print("No needle calibration or release has been certified.")


if __name__ == "__main__":
    main()
