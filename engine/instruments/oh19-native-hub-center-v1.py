#!/usr/bin/env python3
"""Measure OH19 VISIBLE black hub aperture from exact original PNG.

This independently segments the central dark aperture; unlike a Hough case rim,
it measures a visible hole, NOT a hidden mechanical spindle. Never promotes
needle geometry or approval flags.
"""
from __future__ import annotations
import hashlib
import json
import math
import statistics
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "engine/instruments/oh19-native-ticks-batch1.json"
DEST = ROOT / "artifacts/oh19-pixel-qa/OH19_VISIBLE_HUB_EVIDENCE.json"

def aperture_component(pixels, width, height, start, threshold, box):
    x0, y0, x1, y1 = box
    assert x0 <= start[0] < x1 and y0 <= start[1] < y1
    q = deque([start])
    seen = {start}
    pts = []
    while q:
        x, y = q.popleft()
        if pixels[x, y] > threshold:
            continue
        pts.append((x, y))
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if not (dx or dy):
                    continue
                p = (x + dx, y + dy)
                if x0 <= p[0] < x1 and y0 <= p[1] < y1 and p not in seen:
                    seen.add(p)
                    q.append(p)
    return pts

def main():
    ticks = json.loads(DATA.read_text())
    src = ticks["source"]
    png = ROOT / src["asset"]
    buf = png.read_bytes()
    assert hashlib.sha256(buf).hexdigest() == src["sha256"], "source image hash changed"
    image = Image.open(png)
    assert image.format == "PNG" and image.size == (src["width"], src["height"])
    gray = image.convert("L")
    bounds = (440, 315, 540, 415)
    estimates = []
    for cutoff in (4, 8, 12, 16, 20):
        pts = aperture_component(gray.load(), *gray.size, (489, 365), cutoff, bounds)
        assert 1050 <= len(pts) <= 1420, (cutoff, len(pts))
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        xs, ys = zip(*pts)
        diameter = (max(xs) - min(xs) + 1, max(ys) - min(ys) + 1)
        assert 35 <= diameter[0] <= 45 and 35 <= diameter[1] <= 45
        estimates.append({
            "thresholdGrayLE": cutoff,
            "darkPixels": len(pts),
            "centroidX": round(cx, 4),
            "centroidY": round(cy, 4),
            "pixelBoundingDiameter": list(diameter),
            "equivalentDiskRadius": round(math.sqrt(len(pts) / math.pi), 3),
        })
    center = {
        "x": round(statistics.median(p["centroidX"] for p in estimates), 3),
        "y": round(statistics.median(p["centroidY"] for p in estimates), 3),
    }
    prior = ticks["commonPivot"]
    dist = math.hypot(center["x"] - prior["x"], center["y"] - prior["y"])
    assert dist < 3, "Prior optical pivot is inconsistent with visible aperture"
    result = {
        "schema": "b737.oh19.visible-hub-source-pixels.v1",
        "originalSha256Verified": True,
        "imageSize": list(image.size),
        "sourceOriginal": src["asset"],
        "feature": "black inner hub aperture, not instrument bezel",
        "method": "8-connected native grayscale dark-aperture segmentation; threshold sweep",
        "cutoffs": estimates,
        "visibleHoleCenterPx": center,
        "priorOpticalPivotPx": {"x": prior["x"], "y": prior["y"]},
        "centerSeparationPx": round(dist, 3),
        "status": "VISIBLE_HOLE_CENTER_MEASURED_NOT_MECHANICAL_AXIS_CERTIFICATION",
        "hiddenShaftAxisCertified": False,
        "needlePivotOperationallyApproved": False,
        "pixelReviewRecommendation": "retain existing provisional pivot pending exact physical shaft/needle fit",
        "renderingMutations": 0,
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    DEST.write_text(json.dumps(result, indent=2) + "\n")
    print("OH19 original visible aperture center:", center)
    print("OH19 offset from old (489,365):", round(dist, 3), "px")
    print("OH19 visible aperture grayscale threshold tests:", len(estimates))
    print("OH19 physical shaft axis approved:", result["hiddenShaftAxisCertified"])

if __name__ == "__main__":
    main()
