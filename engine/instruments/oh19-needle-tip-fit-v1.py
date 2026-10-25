#!/usr/bin/env python3
"""OH19 source-pixel tip fit with immutable SVG shapes, not needle calibration.

Reads actual source PNG and owner-approved SVG assets. Compares *painted* SVG
tip reach, not erroneous nominal tipRadius, with detected inner ends of printed
tick strokes. Emits visual evidence. Does not authorize live cockpit motion.
"""
from __future__ import annotations
import base64
import hashlib
import json
import math
import re
import statistics
import xml.etree.ElementTree as ET
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
INSTR = ROOT / "engine/instruments"
COCKPIT = ROOT / "panel-mosaic-lab/cockpit"
OUT = ROOT / "artifacts/oh19-pixel-qa"
SOURCE = INSTR / "oh19-native-ticks-batch1.json"
MODEL = COCKPIT / "cabin-dual-needles-model.js"
HALF_DEG = (-0.65, 0, 0.65)


def white(pixel: tuple[int, int, int]) -> bool:
    return min(pixel) > 170 and max(pixel) - min(pixel) < 100


def image_stroke_start(image: Image.Image, pivot, angle_deg, r0, r1):
    """First >=7 consecutive 0.5px samples with 2/3 white angular rays."""
    px = image.load()
    streak = []
    for k in range(round(r0 * 2), round(r1 * 2) + 1):
        radius = k / 2.0
        good = 0
        for delta in HALF_DEG:
            a = math.radians(angle_deg + delta)
            x = round(pivot["x"] + radius * math.sin(a))
            y = round(pivot["y"] - radius * math.cos(a))
            if 0 <= x < image.width and 0 <= y < image.height and white(px[x, y]):
                good += 1
        if good >= 2:
            streak.append(radius)
        else:
            if len(streak) >= 7:
                return streak[0]
            streak = []
    return streak[0] if len(streak) >= 7 else None


def sprite_spec(model: str, needle: str, filename: str):
    match = re.search(r"\bid:'" + re.escape(needle) + r"'[^}]+?\btipRadius:([0-9.]+)", model)
    if not match:
        raise AssertionError(f"Needle {needle} not registered in model")
    nominal = float(match.group(1))
    tree = ET.parse(COCKPIT / filename)
    root = tree.getroot()
    namespace = "{http://www.w3.org/2000/svg}"
    path = root.find(namespace + "path")
    assert path is not None
    move = re.match(r"M\s*([0-9.]+)[,\s]+([0-9.]+)", path.attrib["d"])
    assert move
    x, y = float(move.group(1)), float(move.group(2))
    stroke = float(path.attrib["stroke-width"])
    # For the published source sprites, the uppermost painted flat-tip segment
    # begins at first M and ends at first L, at identical y.
    first_segment = re.match(r"M\s*[0-9.]+[,\s]+[0-9.]+\s+L\s*([0-9.]+)[,\s]+([0-9.]+)", path.attrib["d"])
    assert first_segment and float(first_segment.group(2)) == y
    right_x = float(first_segment.group(1))
    extent = max(math.hypot(x - 256, 256 - y), math.hypot(right_x - 256, 256 - y))
    paint_reach = nominal * (extent + stroke / 2) / 220.0
    return {
        "id": needle,
        "asset": filename,
        "registeredScaleFactorPx": nominal,
        "tipEndpointsInSprite": [[x, y], [right_x, y]],
        "nominalTipVertexDistance": round(extent, 4),
        "svgStrokeWidthPx": stroke,
        "outermostPaintRadiusPx": round(paint_reach, 4),
        "hiddenMechanicalSpindleApproved": False,
    }


def preview_svg(original_bytes, items, sprites, name, angles):
    """Exact original PNG plus unchanged original SVG paths at given angles."""
    width, height = items["source"]["width"], items["source"]["height"]
    pivot = items["commonPivot"]
    photo_uri = "data:image/png;base64," + base64.b64encode(original_bytes).decode()
    result = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{width*2}" height="{height*2}" '
        f'viewBox="0 0 {width} {height}">',
        f'<image href="{photo_uri}" x="0" y="0" width="{width}" height="{height}"/>',
    ]
    for sprite in sprites:
        angle = angles[sprite["id"]]
        scale = sprite["registeredScaleFactorPx"] / 220.0
        # Recreate the same nested group transforms as cabin-dual-needles-unified.js.
        asset = (COCKPIT / sprite["asset"]).read_text(encoding="utf-8")
        asset = re.sub(r"^\s*<\?xml[^>]+\?>\s*", "", asset)
        result.append(
            f'<g transform="translate({pivot["x"]} {pivot["y"]}) scale({scale:.8f}) '
            f'translate(-256 -256)"><g transform="rotate({angle:.3f} 256 256)">'
            + asset + "</g></g>"
        )
    result.extend([
        '<rect x="12" y="15" width="920" height="61" rx="5" fill="#111720" fill-opacity=".95"/>',
        f'<text x="24" y="38" fill="white" font-family="Arial" font-size="19">{name}</text>',
        '<text x="24" y="58" fill="#ffc159" font-family="Arial" font-size="13">'
        'SOURCE PIXEL TIP FIT PREVIEW · NOT PHYSICAL SHAFT CERTIFICATION</text>',
        '</svg>',
    ])
    filename = "OH19_NEEDLES_" + name.replace(" ", "_").upper() + ".svg"
    (OUT / filename).write_text("\n".join(result) + "\n", encoding="utf-8")
    return filename


def main():
    ledger = json.loads(SOURCE.read_text(encoding="utf-8"))
    assert ledger["scaleCalibrationApproved"] is False
    src = ledger["source"]
    source_bytes = (ROOT / src["asset"]).read_bytes()
    assert hashlib.sha256(source_bytes).hexdigest() == src["sha256"]
    original = Image.open(ROOT / src["asset"])
    assert original.size == (src["width"], src["height"]) and original.format == "PNG"
    original = original.convert("RGB")
    model = MODEL.read_text(encoding="utf-8")
    specs = [
        sprite_spec(model, "press", "cabin-diff-pressure-needle.svg"),
        sprite_spec(model, "cabAlt", "cabin-altitude-needle.svg"),
    ]
    assert model.index("id:'press'") < model.index("id:'cabAlt'"), "pressure must draw under altitude"
    assert all("hiddenMechanicalSpindleApproved" in s for s in specs)
    assignments = [("press", "diffPressure", 202, 250), ("cabAlt", "cabinAltitude", 98, 145)]
    reports = []
    for needle, ring_name, r0, r1 in assignments:
        scale = next(s for s in ledger["scales"] if s["mode"] == ring_name)
        s = next(a for a in specs if a["id"] == needle)
        radius = s["outermostPaintRadiusPx"]
        ticks = []
        for entry in scale["allVisibleTickCandidates"]:
            start = image_stroke_start(original, ledger["commonPivot"],
                                       entry["angleDeg"], r0, r1)
            ledger_start = entry["innerRadiusPx"]
            gap = round(ledger_start - radius, 4)
            if start is not None and abs(start - ledger_start) > 7.5:
                raise AssertionError(f"Candidate stroke source discrepancy {needle}:{entry['index']}")
            ticks.append({
                "tickIndex": entry["index"],
                "angleDeg": entry["angleDeg"],
                "ledgerStrokeStartPx": ledger_start,
                "measuredPhotoStrokeStartPx": start,
                "visibleTipGapLedgerPx": gap,
                "strokeValueApproved": False,
                "shaftAxisCertified": False,
            })
        gaps = [p["visibleTipGapLedgerPx"] for p in ticks]
        reports.append({
            "needleId": needle,
            "printedRing": ring_name,
            "paintTipRadiusPx": radius,
            "tickCount": len(ticks),
            "imageDetectedCount": sum(t["measuredPhotoStrokeStartPx"] is not None for t in ticks),
            "tipOverlapCountLedger": sum(g <= 0 for g in gaps),
            "minimumTipToTickGapPx": round(min(gaps), 3),
            "maximumTipToTickGapPx": round(max(gaps), 3),
            "medianTipToTickGapPx": round(statistics.median(gaps), 3),
            "ticks": ticks,
        })
    assert [r["tickCount"] for r in reports] == [51, 47]
    assert reports[0]["imageDetectedCount"] >= 40
    assert reports[1]["imageDetectedCount"] == 47
    # Hard non-invasive graphic QA gate: no paint over white calibration marks.
    assert all(r["tipOverlapCountLedger"] == 0 for r in reports), \
        "Needle sprite tip penetrates printed tick line; correct sprite scale"
    # PRESS may not be so short that it misses the outer ring by >8 px.
    assert reports[0]["maximumTipToTickGapPx"] <= 8.0
    # Inner ring has intrinsically variable tick-start radius (115–128);
    # an unchanging rigid needle cannot touch every printed inner end exactly.
    assert reports[1]["maximumTipToTickGapPx"] <= 16.0
    OUT.mkdir(parents=True, exist_ok=True)
    angles = [
        ("ZERO_END", {"press": 1.5, "cabAlt": 2.71}),
        ("MIDDLE_ARCS", {"press": 159.47, "cabAlt": 200.55}),
        ("FULL_SWEEP", {"press": 322.05, "cabAlt": 327.37}),
    ]
    visuals = [preview_svg(source_bytes, ledger, specs, name, rotations)
               for name, rotations in angles]
    report = {
        "schema": "b737.oh19.native-tip-and-stroke-fit.v1",
        "originalSourceHashVerified": True,
        "sourceImageSize": [src["width"], src["height"]],
        "sourcePhotoSha256": src["sha256"],
        "sourceSVGAssetsUnmodified": True,
        "clockwiseFromTopNativeDegrees": True,
        "renderOrder": ["press", "cabAlt"],
        "candidateVisibleHubPivot": ledger["commonPivot"],
        "physicalShaftAndPixelGeometryCertified": False,
        "realCabinPressureSystemMotionAuthorized": False,
        "sourceScaleValuesAllReviewed": False,
        "sprites": specs,
        "rings": reports,
        "previewArtifacts": visuals,
    }
    (OUT / "OH19_REAL_SVG_TIP_FIT_REPORT.json").write_text(
        json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print("OH19 original locked image SHA verified")
    for r in reports:
        print(f"{r['needleId']}: {r['tickCount']} candidate ticks, "
              f"{r['imageDetectedCount']} photo strokes, "
              f"min gap {r['minimumTipToTickGapPx']:.3f}px, "
              f"max gap {r['maximumTipToTickGapPx']:.3f}px, "
              f"overlapping strokes {r['tipOverlapCountLedger']}")
    print("OH19 physical shaft and needle release certified: False")

if __name__ == "__main__":
    main()
