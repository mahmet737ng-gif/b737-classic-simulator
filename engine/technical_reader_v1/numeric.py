"""Deterministic numeric primitives. No network, eval or inferred curve labels."""
from __future__ import annotations

import bisect
import math
import re
from dataclasses import dataclass


class ReaderError(ValueError):
    pass


def finite(value):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value):
        raise ReaderError(f"Expected a finite number, got {value!r}")
    return float(value)


_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩−–", "01234567890123456789--")
_NUM = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?"


def parse_number(raw, *, decimal=".", thousands=None):
    """Preserve ambiguity, missing cells, bounds and ranges; never guess O/0 or I/1."""
    if decimal not in (".", ",") or thousands not in (None, ",", ".", " ", "\u202f"):
        raise ReaderError("Unsupported numeric locale")
    if thousands == decimal:
        raise ReaderError("Decimal and grouping separator must differ")
    text = "" if raw is None else str(raw)
    s = text.strip().translate(_DIGITS).replace("٫", decimal).replace("٬", ",")
    result = {"raw": text, "kind": "text", "value": None}
    if s.upper() in ("", "-", "—", "N/A", "NA", "NIL", "NONE"):
        return {**result, "kind": "missing"}
    if thousands:
        # Check grouping before removal: '1,2' must not become 12.
        sep = re.escape(thousands)
        for token in re.findall(r"[\d.,\u202f ]+", s):
            token = token.strip()
            if thousands in token:
                integer = token.split(decimal)[0]
                if not re.fullmatch(r"\d{1,3}(?:" + sep + r"\d{3})+", integer):
                    return {**result, "kind": "ambiguous", "reason": "invalid_grouping"}
        s = s.replace(thousands, "")
    elif "," in s and decimal != ",":
        return {**result, "kind": "ambiguous", "reason": "declare_numeric_locale"}
    s = s.replace(decimal, ".")
    if re.fullmatch(_NUM, s):
        return {**result, "kind": "number", "value": finite(float(s))}
    m = re.fullmatch(r"(<=|>=|<|>|≤|≥)\s*(" + _NUM + ")", s)
    if m:
        return {**result, "kind": "bound", "operator": m[1], "bound": finite(float(m[2]))}
    m = re.fullmatch(r"(" + _NUM + r")\s*(?:\.\.|\bto\b)\s*(" + _NUM + ")", s, re.I)
    if m:
        lo, hi = map(float, m.groups())
        return {**result, "kind": "range", "minimum": min(lo, hi), "maximum": max(lo, hi)}
    return result


def interpolate(xs, ys, x, *, scale="linear"):
    """Piecewise interpolation in the chosen x scale; rejects all extrapolation."""
    if scale not in ("linear", "log10"):
        raise ReaderError("Unsupported interpolation scale")
    xs, ys, x = [finite(v) for v in xs], [finite(v) for v in ys], finite(x)
    if len(xs) != len(ys) or not xs:
        raise ReaderError("Mismatched or empty coordinate arrays")
    if any(b <= a for a, b in zip(xs, xs[1:])):
        raise ReaderError("Coordinates must be strictly increasing, without duplicate x")
    if scale == "log10" and (x <= 0 or min(xs) <= 0):
        raise ReaderError("Log scale requires positive values")
    if x < xs[0] or x > xs[-1]:
        raise ReaderError("OUT_OF_DOMAIN: extrapolation is disabled")
    i = bisect.bisect_left(xs, x)
    if i < len(xs) and x == xs[i]:
        return ys[i], {"indices": [i], "weights": [1.0]}
    a, b = xs[i - 1], xs[i]
    transform = math.log10 if scale == "log10" else float
    w = (transform(x) - transform(a)) / (transform(b) - transform(a))
    return ys[i - 1] * (1 - w) + ys[i] * w, {"indices": [i - 1, i], "weights": [1 - w, w]}


def piecewise(segments, x, *, scale="linear", y_scale="linear"):
    """Keep breaks/gaps; overlapping segments require explicit branch selection."""
    if y_scale not in ("linear", "log10"):
        raise ReaderError("Unsupported y scale")
    x = finite(x)
    matches = []
    for number, segment in enumerate(segments):
        points = segment["points"]
        xs, ys = [p[0] for p in points], [p[1] for p in points]
        if xs[0] <= x <= xs[-1]:
            if y_scale == "log10":
                if min(ys) <= 0:
                    raise ReaderError("Log y requires positive values")
                ys = [math.log10(v) for v in ys]
            value, detail = interpolate(xs, ys, x, scale=scale)
            if y_scale == "log10":
                value = 10 ** value
            matches.append((value, {"segment": number, **detail}))
    if len(matches) != 1:
        raise ReaderError("AMBIGUOUS_BRANCH" if matches else "OUT_OF_DOMAIN_OR_GAP")
    return matches[0]


@dataclass(frozen=True)
class Axis:
    """Two or more pixel/value tick anchors, including reversed/nonuniform axes."""
    anchors: tuple
    scale: str = "linear"
    unit: str = "1"

    def __post_init__(self):
        if self.scale not in ("linear", "log10") or len(self.anchors) < 2:
            raise ReaderError("Axis requires >=2 anchors and linear/log10 scale")
        p, v = zip(*self.anchors)
        p, v = [finite(x) for x in p], [finite(x) for x in v]
        if any(b <= a for a, b in zip(p, p[1:])):
            raise ReaderError("Pixel anchors must be strictly increasing")
        if not (all(b > a for a, b in zip(v, v[1:])) or all(b < a for a, b in zip(v, v[1:]))):
            raise ReaderError("Axis values must be strictly monotonic")
        if self.scale == "log10" and min(v) <= 0:
            raise ReaderError("Log anchors must be positive")

    def to_value(self, pixel):
        pixels, values = zip(*self.anchors)
        if self.scale == "log10":
            values = [math.log10(v) for v in values]
        value, _ = interpolate(pixels, values, pixel)
        return 10 ** value if self.scale == "log10" else value

    def to_pixel(self, value):
        pixels, values = zip(*self.anchors)
        if values[0] > values[-1]:
            pixels, values = pixels[::-1], values[::-1]
        return interpolate(values, pixels, value, scale=self.scale)[0]

    def interval(self, pixel, pixel_error):
        error = finite(pixel_error)
        if error < 0:
            raise ReaderError("Pixel uncertainty cannot be negative")
        lo, hi = self.anchors[0][0], self.anchors[-1][0]
        return sorted([self.to_value(max(lo, pixel - error)), self.to_value(min(hi, pixel + error))])


def convert_unit(value, source, target):
    """Small explicit unit registry; a caller must request conversions."""
    value = finite(value)
    if source == target:
        return value
    groups = {
        "length": {"m": 1, "ft": 0.3048, "NM": 1852},
        "mass": {"kg": 1, "lb": 0.45359237},
        "pressure": {"Pa": 1, "kPa": 1000, "psi": 6894.757293168},
        "speed": {"m/s": 1, "kt": 1852 / 3600},
        "fraction": {"1": 1, "%": 0.01},
    }
    if source in ("degC", "degF", "K") and target in ("degC", "degF", "K"):
        c = value - 273.15 if source == "K" else (value - 32) * 5 / 9 if source == "degF" else value
        return c + 273.15 if target == "K" else c * 9 / 5 + 32 if target == "degF" else c
    for units in groups.values():
        if source in units and target in units:
            return value * units[source] / units[target]
    raise ReaderError(f"Unknown or incompatible units: {source} -> {target}")
