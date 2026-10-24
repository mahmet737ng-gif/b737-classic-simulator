"""Validated data contracts and reusable, source-traceable numerical evaluation."""
from __future__ import annotations

import ast
import copy
import itertools
import math
import operator

from .numeric import ReaderError, finite, interpolate, piecewise

KINDS = {"curve", "family", "grid", "lookup", "formula"}
QUALITIES = {"candidate", "traced", "validated", "simulation_approx", "rejected"}


def _require(condition, message):
    if not condition:
        raise ReaderError(message)


def _segments(segments):
    _require(isinstance(segments, list) and bool(segments), "At least one segment required")
    for segment in segments:
        _require(isinstance(segment.get("points"), list) and len(segment["points"]) >= 2,
                 "A segment requires at least two points")
        points = segment["points"]
        _require(all(isinstance(p, (tuple, list)) and len(p) == 2 for p in points), "Points must be [x,y]")
        for p in points:
            finite(p[0]); finite(p[1])
        _require(all(b[0] > a[0] for a, b in zip(points, points[1:])), "Non-monotonic curve x; split branches")


def validate_model(model):
    """Structural checks only. These do not promote source validation status."""
    for key in ("id", "revision", "kind", "title", "quality", "provenance", "inputs", "output"):
        _require(key in model, f"Missing model field: {key}")
    _require(isinstance(model["id"], str) and bool(model["id"]), "Model ID required")
    _require(type(model["revision"]) is int and model["revision"] >= 1, "Revision must be a positive integer")
    _require(model["kind"] in KINDS, "Unsupported model kind")
    _require(model["quality"] in QUALITIES, "Unsupported quality")
    _require(isinstance(model["provenance"], list) and bool(model["provenance"]), "Source references required")
    for p in model["provenance"]:
        _require(bool(p.get("source_id")) and bool(p.get("source_revision")), "Source identity and revision required")
        _require(type(p.get("pdf_page")) is int and p["pdf_page"] >= 1, "1-based physical/source page required")
        if "bbox" in p:
            box = p["bbox"]
            _require(len(box) == 4 and all(type(v) in (int, float) and math.isfinite(v) for v in box), "Invalid bbox")
            _require(box[0] < box[2] and box[1] < box[3], "Empty/reversed bbox")
            _require(p.get("coordinate_space") in ("pixel", "pdf_point"), "Coordinate space required")
    _require(isinstance(model["inputs"], list) and bool(model["inputs"]), "Input definitions required")
    names = [d.get("name") for d in model["inputs"]]
    _require(all(isinstance(n, str) and n for n in names) and len(set(names)) == len(names), "Unique input names required")
    _require(all(isinstance(d.get("unit"), str) and d["unit"] for d in model["inputs"]), "Input units required")
    _require(bool(model["output"].get("unit")) and bool(model["output"].get("name")), "Output name and unit required")
    if model["quality"] == "validated":
        _require(bool(model.get("validation", {}).get("evidence")), "Validated models require validation evidence")
    if model.get("absolute_error") is not None:
        _require(finite(model["absolute_error"]) >= 0, "Negative error bound")
    kind = model["kind"]
    if kind == "curve":
        _require(len(names) == 1, "Curve requires one input")
        _segments(model["segments"])
    elif kind == "family":
        _require(len(names) == 2, "Family requires x and family parameter inputs")
        _require(len(model["curves"]) >= 1, "Empty curve family")
        ids = [c.get("id") for c in model["curves"]]
        _require(all(isinstance(i, str) and i for i in ids) and len(set(ids)) == len(ids), "Unique curve branch IDs required")
        levels = [finite(c["parameter"]) for c in model["curves"]]
        _require(all(b > a for a, b in zip(levels, levels[1:])), "Family parameters must be increasing")
        for curve in model["curves"]:
            _segments(curve["segments"])
    elif kind == "grid":
        axes = model["axes"]
        _require(len(axes) == len(names) and [a["name"] for a in axes] == names, "Grid axis/input order mismatch")
        for a in axes:
            xs = [finite(x) for x in a["values"]]
            _require(bool(xs) and all(b > x for x, b in zip(xs, xs[1:])), "Grid coordinates must be increasing")
            _require(a.get("scale", "linear") in ("linear", "log10"), "Unsupported grid scale")
            if a.get("scale") == "log10":
                _require(min(xs) > 0, "Log grid must be positive")
        expected = math.prod(len(a["values"]) for a in axes)
        _require(len(model["values"]) == expected, "Incomplete rectangular grid")
        for v in model["values"]:
            if v is not None:
                finite(v)
    elif kind == "lookup":
        _require(bool(model["rows"]), "Empty lookup")
        keys = []
        for row in model["rows"]:
            _require(len(row["keys"]) == len(names), "Lookup key length mismatch")
            _require(all(isinstance(v, (str, int, float)) and not isinstance(v, bool) for v in row["keys"]), "Invalid lookup key")
            keys.append(tuple(row["keys"]))
        _require(len(set(keys)) == len(keys), "Duplicate lookup keys")
    elif kind == "formula":
        _expression(model["expression"], {n: 1.0 for n in names}, validate_only=True)
    if kind in ("curve", "family"):
        for key in ("x_scale", "y_scale", "parameter_scale"):
            _require(model.get(key, "linear") in ("linear", "log10"), "Unsupported chart scale")
        curves = [{"segments": model["segments"]}] if kind == "curve" else model["curves"]
        for c in curves:
            for seg in c["segments"]:
                if model.get("x_scale") == "log10":
                    _require(min(p[0] for p in seg["points"]) > 0, "Log x must be positive")
                if model.get("y_scale") == "log10":
                    _require(min(p[1] for p in seg["points"]) > 0, "Log y must be positive")
        if kind == "family" and model.get("parameter_scale") == "log10":
            _require(min(c["parameter"] for c in model["curves"]) > 0, "Log parameter must be positive")
    return model


_OPS = {ast.Add: operator.add, ast.Sub: operator.sub, ast.Mult: operator.mul,
        ast.Div: operator.truediv, ast.Pow: operator.pow}
_FUNCS = {"min": min, "max": max, "abs": abs, "sqrt": math.sqrt, "log10": math.log10}


def _expression(expression, values, validate_only=False):
    _require(isinstance(expression, str) and len(expression) <= 2000, "Expression too long/invalid")
    try:
        tree = ast.parse(expression, mode="eval")
    except SyntaxError as exc:
        raise ReaderError("Invalid expression syntax") from exc
    _require(sum(1 for _ in ast.walk(tree)) <= 150, "Expression too complex")

    def visit(node):
        if isinstance(node, ast.Expression):
            return visit(node.body)
        if isinstance(node, ast.Constant):
            return finite(node.value)
        if isinstance(node, ast.Name) and node.id in values:
            return finite(values[node.id])
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.UAdd, ast.USub)):
            v = visit(node.operand)
            return v if isinstance(node.op, ast.UAdd) else -v
        if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
            left, right = visit(node.left), visit(node.right)
            if isinstance(node.op, ast.Pow):
                _require(abs(right) <= 16, "Exponent exceeds supported bound")
            if validate_only:
                return 1.0
            return finite(_OPS[type(node.op)](left, right))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name) and node.func.id in _FUNCS and not node.keywords:
            args = [visit(n) for n in node.args]
            _require(bool(args) and (node.func.id in ("min", "max") or len(args) == 1), "Invalid function arity")
            if validate_only:
                return 1.0
            return finite(_FUNCS[node.func.id](*args))
        raise ReaderError("Unsupported expression node; attributes, code and imports are prohibited")
    try:
        return visit(tree)
    except (ZeroDivisionError, OverflowError, TypeError, ValueError) as exc:
        if isinstance(exc, ReaderError):
            raise
        raise ReaderError(f"Invalid formula evaluation: {type(exc).__name__}") from exc


def _grid(model, inputs):
    choices, indices = [], []
    for axis in model["axes"]:
        _, detail = interpolate(axis["values"], list(range(len(axis["values"]))), inputs[axis["name"]], scale=axis.get("scale", "linear"))
        choices.append(list(zip(detail["indices"], detail["weights"])))
    result = 0
    for corner in itertools.product(*choices):
        index, weight = 0, 1
        for axis, (i, w) in zip(model["axes"], corner):
            index = index * len(axis["values"]) + i
            weight *= w
        v = model["values"][index]
        _require(v is not None, "MISSING_GRID_CELL: no interpolation through blanks")
        result += weight * v
        indices.append({"flat_index": index, "weight": weight})
    return result, {"method": "multilinear", "corners": indices}


def evaluate(model, inputs, *, context=None, mode="validated"):
    """Inputs must already use the declared units. No implicit variant fallback."""
    validate_model(model)
    _require(mode in ("validated", "simulator"), "Unknown evaluation mode")
    allowed = {"validated"} if mode == "validated" else {"validated", "traced", "simulation_approx"}
    _require(model["quality"] in allowed, f"QUALITY_NOT_EXECUTABLE: {model['quality']}")
    _require(set(inputs) == {d["name"] for d in model["inputs"]}, "Inputs must exactly match model contract")
    context = context or {}
    for k, expected in model.get("conditions", {}).items():
        _require(k in context and context[k] == expected, f"CONDITION_MISMATCH: {k} requires {expected!r}")
    for d in model["inputs"]:
        if d.get("type", "number") != "category":
            v = finite(inputs[d["name"]])
            if "min" in d:
                _require(v >= finite(d["min"]), f"OUT_OF_DOMAIN: {d['name']}")
            if "max" in d:
                _require(v <= finite(d["max"]), f"OUT_OF_DOMAIN: {d['name']}")
    kind = model["kind"]
    names = [d["name"] for d in model["inputs"]]
    scale = {"scale": model.get("x_scale", "linear"), "y_scale": model.get("y_scale", "linear")}
    if kind == "curve":
        value, detail = piecewise(model["segments"], inputs[names[0]], **scale)
        detail["method"] = "piecewise"
    elif kind == "family":
        curves = model["curves"]
        levels = [c["parameter"] for c in curves]
        _, selected = interpolate(levels, list(range(len(levels))), inputs[names[1]], scale=model.get("parameter_scale", "linear"))
        value, traces = 0, []
        for i, weight in zip(selected["indices"], selected["weights"]):
            v, trace = piecewise(curves[i]["segments"], inputs[names[0]], **scale)
            value += weight * v
            traces.append({"curve_id": curves[i]["id"], "parameter": levels[i], "weight": weight, **trace})
        detail = {"method": "family_interpolation", "curves": traces}
    elif kind == "grid":
        value, detail = _grid(model, inputs)
    elif kind == "lookup":
        rows = [r for r in model["rows"] if r["keys"] == [inputs[n] for n in names]]
        _require(len(rows) == 1, "NO_EXACT_LOOKUP_MATCH")
        value, detail = rows[0]["value"], {"method": "exact_lookup", "keys": rows[0]["keys"]}
    else:
        value = _expression(model["expression"], inputs)
        detail = {"method": "declared_formula", "expression": model["expression"]}
    if not isinstance(value, str):
        value = finite(value)
    error = model.get("absolute_error")
    interval = [value - error, value + error] if error is not None and not isinstance(value, str) else None
    return {"model_id": model["id"], "revision": model["revision"], "value": value,
            "unit": model["output"]["unit"], "quality": model["quality"], "mode": mode,
            "inputs": copy.deepcopy(inputs), "conditions": model.get("conditions", {}),
            "absolute_error": error, "interval": interval, "uncertainty_known": error is not None,
            "provenance": copy.deepcopy(model["provenance"]), "trace": detail,
            "assumptions": model.get("assumptions", []), "limitations": model.get("limitations", []),
            "explanation": f"{model['title']}: {inputs} -> {value} {model['output']['unit']} ({detail['method']}, {model['quality']})."}


def linearize(model, step):
    """Dense numerical rows per original segment. Never flatten away gaps/kinks."""
    validate_model(model)
    _require(model["kind"] in ("curve", "family"), "Linearization requires curve/family")
    step = finite(step)
    _require(step > 0, "Step must be positive")
    curves = [{"id": model["id"], "segments": model["segments"]}] if model["kind"] == "curve" else model["curves"]
    results = []
    for curve in curves:
        for si, seg in enumerate(curve["segments"]):
            lo, hi = seg["points"][0][0], seg["points"][-1][0]
            _require((hi - lo) / step <= 1_000_000, "Requested sampling is too dense")
            # All original knots are retained even when they are off the sampling grid.
            xs = sorted(set([p[0] for p in seg["points"]] + [lo + i * step for i in range(int((hi - lo) / step) + 1)]))
            for x in xs:
                value, _ = piecewise([seg], x, scale=model.get("x_scale", "linear"), y_scale=model.get("y_scale", "linear"))
                results.append({"curve_id": curve["id"], "parameter": curve.get("parameter"),
                                "segment": si, "x": x, "y": value, "quality": model["quality"]})
    return results


def digitize_trace(pixel_segments, x_axis, y_axis):
    """A trace is assigned to a named branch by the reader; crossings aren't auto-guessed."""
    segments = []
    for pixels in pixel_segments:
        points = [[x_axis.to_value(x), y_axis.to_value(y)] for x, y in pixels]
        if len(points) >= 2 and points[0][0] > points[-1][0]:
            points.reverse()
        segments.append({"points": points, "pixel_points": copy.deepcopy(pixels)})
    _segments(segments)
    return segments
