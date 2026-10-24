"""Run from repository root: python3 -m engine.technical_reader_v1 --help."""
import argparse
import csv
import json
import sqlite3
import sys
from pathlib import Path

from .ingest import ingest
from .models import digitize_trace, linearize
from .numeric import Axis, ReaderError
from .store import TechnicalStore


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--db", required=True)
    subs = parser.add_subparsers(dest="command", required=True)
    subs.add_parser("init")
    p = subs.add_parser("ingest")
    p.add_argument("file"); p.add_argument("--source-id", required=True); p.add_argument("--revision", required=True)
    p.add_argument("--metadata", help="JSON file containing source effectivity and document metadata")
    p.add_argument("--options", default="{}", help="JSON extraction options (crop, pages, lang, dpi, numeric_locale)")
    p = subs.add_parser("import-model"); p.add_argument("file")
    p = subs.add_parser("digitize"); p.add_argument("file"); p.add_argument("--out", required=True)
    p = subs.add_parser("calculate")
    p.add_argument("model_id"); p.add_argument("--revision", type=int, required=True)
    p.add_argument("--inputs", required=True); p.add_argument("--context", default="{}")
    p.add_argument("--mode", choices=["validated", "simulator"], default="validated")
    p = subs.add_parser("search"); p.add_argument("text")
    p = subs.add_parser("export"); p.add_argument("--out", required=True)
    p.add_argument("--format", choices=["json", "text"], default="json")
    p = subs.add_parser("scan-raster")
    p.add_argument("file"); p.add_argument("--roi", required=True); p.add_argument("--out", required=True)
    p = subs.add_parser("calculate-plan")
    p.add_argument("file"); p.add_argument("--inputs", required=True); p.add_argument("--context", default="{}")
    p.add_argument("--mode", choices=["validated", "simulator"], default="validated")
    p = subs.add_parser("linearize")
    p.add_argument("model_id"); p.add_argument("--revision", type=int, required=True)
    p.add_argument("--step", type=float, required=True); p.add_argument("--out", required=True)
    args = parser.parse_args(argv)
    store = None
    try:
        store = TechnicalStore(args.db)
        if args.command == "init":
            result = {"database": str(store.path), "schema": "TD-CHART-TABLE-READER/1"}
        elif args.command == "ingest":
            metadata = json.loads(Path(args.metadata).read_text()) if args.metadata else {}
            result = ingest(store, args.file, args.source_id, args.revision, metadata=metadata, **json.loads(args.options))
        elif args.command == "import-model":
            model = json.loads(Path(args.file).read_text())
            result = {"model_id": model["id"], "sha256": store.add_model(model)}
        elif args.command == "digitize":
            spec = json.loads(Path(args.file).read_text())
            model = spec["model"]
            model["segments"] = digitize_trace(spec["pixel_segments"], Axis(**spec["x_axis"]), Axis(**spec["y_axis"]))
            # Calibration and source-pixel paths remain part of the immutable model.
            model["calibration"] = {"x_axis": spec["x_axis"], "y_axis": spec["y_axis"]}
            store.add_model(model)
            Path(args.out).write_text(json.dumps(model, ensure_ascii=False, indent=2), encoding="utf-8")
            result = {"model_id": model["id"], "output": args.out}
        elif args.command == "calculate":
            result = store.calculate(args.model_id, args.revision, json.loads(args.inputs), context=json.loads(args.context), mode=args.mode)
        elif args.command == "search":
            result = store.search(args.text)
        elif args.command == "export":
            text = store.export_text() if args.format == "text" else json.dumps(store.export(), ensure_ascii=False, indent=2)
            Path(args.out).write_text(text, encoding="utf-8")
            result = {"output": args.out}
        elif args.command == "scan-raster":
            from .raster import scanline_candidates
            candidates = scanline_candidates(args.file, json.loads(args.roi))
            Path(args.out).write_text(json.dumps(candidates), encoding="utf-8")
            result = {"output": args.out, "branch_assignment": "unresolved"}
        elif args.command == "calculate-plan":
            from .plans import calculate_plan
            result = calculate_plan(store, json.loads(Path(args.file).read_text()), json.loads(args.inputs), context=json.loads(args.context), mode=args.mode)
        else:
            rows = linearize(store.get_model(args.model_id, args.revision), args.step)
            with Path(args.out).open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=["curve_id", "parameter", "segment", "x", "y", "quality"])
                writer.writeheader(); writer.writerows(rows)
            result = {"output": args.out, "rows": len(rows)}
        print(json.dumps(result, ensure_ascii=False, indent=2, allow_nan=False))
        return 0
    except (ReaderError, KeyError, OSError, sqlite3.Error, json.JSONDecodeError) as exc:
        print(json.dumps({"error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2
    finally:
        if store:
            store.close()
