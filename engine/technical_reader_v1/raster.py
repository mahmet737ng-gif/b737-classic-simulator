"""Raster curve evidence assistance, deliberately without branch-label guessing."""
from .numeric import ReaderError


def scanline_candidates(path, roi, *, step=5, threshold=100, target_rgb=None, color_tolerance=30):
    """Return dark/colored run intervals for each sampled x column inside an ROI.

    Grid lines, text and curve crossings are retained as candidates, never
    silently promoted to altitude-labelled traces. Source pixel coordinates are
    preserved. A reader/vision stage resolves branches into pixel_segments.
    """
    from PIL import Image
    if type(step) is not int or step < 1 or not 0 <= threshold <= 255:
        raise ReaderError("Invalid scan step or threshold")
    if type(color_tolerance) not in (int, float) or not 0 <= color_tolerance <= 255:
        raise ReaderError("Invalid color tolerance")
    if target_rgb is not None and (len(target_rgb) != 3 or any(type(v) is not int or not 0 <= v <= 255 for v in target_rgb)):
        raise ReaderError("RGB must have three channels in 0..255")
    with Image.open(path) as im:
        im = im.convert("RGB")
        x0, y0, x1, y1 = roi
        if any(type(v) is not int for v in roi) or not (0 <= x0 < x1 <= im.width and 0 <= y0 < y1 <= im.height):
            raise ReaderError("ROI must be integer source-pixel bounds")
        pixels = im.load()
        output = []
        for x in range(x0, x1, step):
            runs, start = [], None
            for y in range(y0, y1):
                rgb = pixels[x, y]
                dark = max(abs(a - b) for a, b in zip(rgb, target_rgb)) <= color_tolerance if target_rgb is not None else sum(rgb) / 3 <= threshold
                if dark and start is None:
                    start = y
                if start is not None and (not dark or y == y1 - 1):
                    end = y if dark else y - 1
                    runs.append({"y_min": start, "y_max": end, "center": (start + end) / 2})
                    start = None
            output.append({"x": x, "runs": runs, "ambiguous": len(runs) != 1})
    return {"status": "candidate", "method": "scanline_runs", "roi": roi,
            "branch_assignment": "unresolved", "columns": output}


def check_model(model, checkpoints, *, tolerance, context=None, mode="simulator"):
    """Holdout numerical QA. Checkpoint independence is the caller's responsibility."""
    from .models import evaluate
    from .numeric import finite
    tolerance = finite(tolerance)
    if tolerance < 0 or not checkpoints:
        raise ReaderError("Nonnegative tolerance and holdout checkpoints required")
    results = []
    for point in checkpoints:
        actual = evaluate(model, point["inputs"], context=context, mode=mode)["value"]
        error = abs(finite(actual) - finite(point["expected"]))
        results.append({"inputs": point["inputs"], "expected": point["expected"], "actual": actual,
                        "absolute_error": error, "passed": error <= tolerance, "reference": point.get("reference")})
    return {"model_id": model["id"], "revision": model["revision"], "tolerance": tolerance,
            "passed": all(r["passed"] for r in results), "checkpoints": results,
            "quality_promoted": False, "independence_verified": False}
