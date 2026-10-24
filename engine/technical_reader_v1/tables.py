"""Explicit table-to-model mapping; original headers, raw cells and blanks survive."""
import copy

from .models import validate_model
from .numeric import ReaderError, finite, parse_number


def _number(raw, locale, allow_missing=False):
    parsed = parse_number(raw, **locale)
    if allow_missing and parsed["kind"] == "missing":
        return None
    if parsed["kind"] != "number":
        raise ReaderError(f"Cell cannot be used as a scalar: {raw!r} ({parsed['kind']})")
    return parsed["value"]


def table_to_grid(rows, template, *, header_row=0, row_axis_col=0, locale=None):
    """A rectangular 2D table with x down rows and z across columns.

    Mapping/units/provenance are supplied explicitly in the template. This
    operation creates a candidate, even if the template was previously trusted.
    """
    if len(rows) < header_row + 3 or row_axis_col < 0 or len(template["inputs"]) != 2:
        raise ReaderError("Need a header, >=2 data rows and two input axes")
    locale = locale or {}
    header = rows[header_row]
    if len(header) < row_axis_col + 3 or any(len(row) != len(header) for row in rows[header_row + 1:]):
        raise ReaderError("Table is not rectangular or has insufficient columns")
    z = [_number(v, locale) for v in header[row_axis_col + 1:]]
    data = rows[header_row + 1:]
    x = [_number(row[row_axis_col], locale) for row in data]
    values = [_number(v, locale, allow_missing=True) for row in data for v in row[row_axis_col + 1:]]
    result = copy.deepcopy(template)
    result.update(kind="grid", quality="candidate", axes=[{"name": template["inputs"][0]["name"], "values": x},
                  {"name": template["inputs"][1]["name"], "values": z}], values=values)
    result["table_mapping"] = {"header_row": header_row, "row_axis_col": row_axis_col,
                               "raw_rows": copy.deepcopy(rows), "numeric_locale": locale}
    validate_model(result)
    return result


def describe_table(table, provenance):
    """Lossless row/column text for retrieval; no assumptions about blank values."""
    lines = [f"Source: {provenance['source_id']} | revision: {provenance['source_revision']} | physical/source page: {provenance['pdf_page']}"]
    for r, row in enumerate(table["rows"]):
        lines.append(f"Row {r}: " + " | ".join(f"C{c}={('[MISSING]' if v is None or v == '' else v)}" for c, v in enumerate(row)))
    return "\n".join(lines)
