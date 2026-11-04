#!/usr/bin/env python3
"""Generate size-reduced, pixel-exact WebP alternatives without editing approved images."""
import argparse
import hashlib
import io
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE_MANIFEST = ROOT / "panel-mosaic-lab/cockpit/performance/manifest.json"
DESTINATION = ROOT / "panel-mosaic-lab/cockpit/performance/lossless"
MINIMUM_SAVING = 0.02

def sha256(data):
    return hashlib.sha256(data).hexdigest()

def verify_image(source, candidate, filename):
    with Image.open(io.BytesIO(candidate)) as actual:
        actual.load()
        if source.size != actual.size:
            raise ValueError(f"{filename}: dimensions changed")
        if source.convert("RGBA").tobytes() != actual.convert("RGBA").tobytes():
            raise ValueError(f"{filename}: pixel mismatch")
        if source.info.get("icc_profile", b"") != actual.info.get("icc_profile", b""):
            raise ValueError(f"{filename}: ICC profile mismatch")

def optimize_all():
    manifest = json.loads(SOURCE_MANIFEST.read_text(encoding="utf-8"))
    selected = {}
    scanned = 0
    source_bytes = 0
    optimized_bytes = 0
    skipped = []
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for key, item in sorted(manifest["images"].items()):
        if not key.lower().endswith(".png"):
            continue
        src = (ROOT / key).resolve()
        if not src.is_relative_to(ROOT.resolve()) or not src.is_file():
            raise ValueError(f"Source missing or out of root: {key}")
        original = src.read_bytes()
        if len(original) != item["sourceBytes"] or sha256(original) != item["sourceSha256"]:
            raise ValueError(f"Original asset failed frozen integrity check: {key}")
        scanned += 1
        source_bytes += len(original)
        with Image.open(io.BytesIO(original)) as image:
            image.load()
            if image.mode not in {"RGB", "RGBA", "P", "LA", "L"} or getattr(image, "n_frames", 1) != 1:
                skipped.append({"source": key, "reason": "unsupported mode/animation"})
                continue
            if any(k in image.info for k in ("gamma", "chromaticity", "srgb")):
                skipped.append({"source": key, "reason": "color-space metadata"})
                continue
            icc = image.info.get("icc_profile")
            exif = image.info.get("exif")
            options = {"lossless": True, "quality": 100, "method": 6, "exact": True}
            if icc:
                options["icc_profile"] = icc
            if exif:
                options["exif"] = exif
            output = io.BytesIO()
            try:
                image.save(output, format="WEBP", **options)
                candidate = output.getvalue()
                verify_image(image, candidate, key)
            except (OSError, ValueError) as error:
                skipped.append({"source": key, "reason": "roundtrip rejected: " + str(error)})
                continue
            if len(candidate) >= len(original) * (1 - MINIMUM_SAVING):
                skipped.append({"source": key, "reason": "saving below 2%"})
                continue
            relative = f'panel-mosaic-lab/cockpit/performance/lossless/{item["sourceSha256"][:24]}-exact.webp'
            (ROOT / relative).write_bytes(candidate)
            selected[key] = {
                "url": relative,
                "sourceSha256": item["sourceSha256"],
                "sha256": sha256(candidate),
                "bytes": len(candidate),
                "sourceBytes": len(original),
                "width": image.width,
                "height": image.height,
                "pixelIdentical": True,
                "codec": "webp-lossless",
            }
            optimized_bytes += len(candidate)
            print(f"LOSSLESS {key}: {len(original):,} -> {len(candidate):,} bytes")
    summary = {
        "scannedPng": scanned,
        "optimized": len(selected),
        "rejected": len(skipped),
        "eligibleSourceBytes": sum(x["sourceBytes"] for x in selected.values()),
        "optimizedBytes": optimized_bytes,
        "savedBytes": sum(x["sourceBytes"] - x["bytes"] for x in selected.values()),
        "allPngSourceBytes": source_bytes,
        "rejectedDetails": skipped,
    }
    result = {"schema": "b737.lossless-fullsize.v1", "version": "", "images": selected, "summary": summary}
    fingerprint = sha256(json.dumps(selected, sort_keys=True, separators=(",", ":")).encode("utf-8"))[:16]
    result["version"] = "LOSSLESS-" + fingerprint
    text = "globalThis.B737LosslessAssets=" + json.dumps(result, ensure_ascii=False, separators=(",", ":"), sort_keys=True) + ";\n"
    (DESTINATION / "manifest.js").write_text(text, encoding="utf-8")
    (DESTINATION / "report.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"version": result["version"], **{k: v for k, v in summary.items() if k != "rejectedDetails"}}, indent=2))

def check():
    path = DESTINATION / "manifest.js"
    assert path.is_file(), "Lossless manifest is missing"
    script = path.read_text(encoding="utf-8")
    prefix = "globalThis.B737LosslessAssets="
    assert script.startswith(prefix) and script.rstrip().endswith(";"), "Invalid JS manifest"
    data = json.loads(script[len(prefix):].strip().removesuffix(";"))
    for key, item in data["images"].items():
        source = (ROOT / key).read_bytes()
        out = (ROOT / item["url"]).read_bytes()
        assert sha256(source) == item["sourceSha256"], key
        assert sha256(out) == item["sha256"] and len(out) == item["bytes"], key
        with Image.open(io.BytesIO(source)) as img:
            img.load()
            verify_image(img, out, key)
        assert len(out) < len(source) * (1 - MINIMUM_SAVING), key
    print(f'PASS: {len(data["images"])} PNGs verified byte-hash + full RGBA pixel equality')

def self_test():
    from PIL import ImageDraw
    image = Image.new("RGBA", (97, 61), (0, 0, 0, 0))
    d = ImageDraw.Draw(image)
    d.rectangle((5, 6, 85, 52), fill=(17, 29, 58, 255))
    d.text((8, 11), "FLT ALT 12,400", fill=(247, 247, 240, 255))
    d.line((4, 57, 91, 57), fill=(0, 0, 0, 0), width=1)
    buf = io.BytesIO()
    image.save(buf, format="WEBP", lossless=True, quality=100, method=6, exact=True)
    verify_image(image, buf.getvalue(), "self-test")
    print("PASS: synthetic pixel-perfect lossless WebP roundtrip")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        self_test()
    if args.write:
        optimize_all()
    if args.check:
        check()
    if not (args.write or args.check or args.self_test):
        parser.error("Pass --write, --check, and/or --self-test")

if __name__ == "__main__":
    main()
