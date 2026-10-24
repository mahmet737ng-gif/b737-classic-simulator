"""Additive SQLite store. Every model revision is immutable and source linked."""
from __future__ import annotations

import hashlib
import json
import sqlite3
from pathlib import Path

from .models import evaluate, validate_model
from .numeric import ReaderError, parse_number


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False)


class TechnicalStore:
    def __init__(self, path):
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(self.path)
        self.conn.row_factory = sqlite3.Row
        self.conn.executescript(Path(__file__).with_name("schema.sql").read_text())
        try:
            self.conn.execute("CREATE VIRTUAL TABLE IF NOT EXISTS ctr_text_fts USING fts5(text,source_id UNINDEXED,source_revision UNINDEXED,pdf_page UNINDEXED)")
            self.fts = True
        except sqlite3.OperationalError:
            self.fts = False
        self.conn.execute("INSERT OR IGNORE INTO ctr_meta VALUES(?,?)", ("engine", canonical({"id": "TD-CHART-TABLE-READER", "version": "1.0.0"})))
        self.conn.commit()

    def close(self):
        self.conn.close()

    def audit(self, action, entity, details):
        self.conn.execute("INSERT INTO ctr_audit(action,entity_id,details_json) VALUES(?,?,?)", (action, entity, canonical(details)))

    def source(self, source_id, revision, sha256, metadata):
        if not source_id or not revision or len(sha256) != 64 or any(c not in "0123456789abcdef" for c in sha256):
            raise ReaderError("Source ID, revision and lowercase SHA256 required")
        payload = canonical(metadata)
        old = self.conn.execute("SELECT * FROM ctr_sources WHERE source_id=? AND revision=?", (source_id, revision)).fetchone()
        if old:
            if old["sha256"] != sha256 or old["metadata_json"] != payload:
                raise ReaderError("SOURCE_REVISION_CONFLICT: use a new revision")
            return
        with self.conn:
            self.conn.execute("INSERT INTO ctr_sources VALUES(?,?,?,?)", (source_id, revision, sha256, payload))
            self.audit("source_added", source_id, {"revision": revision, "sha256": sha256})

    def add_page(self, source_id, revision, page):
        page = dict(page)
        if "text" not in page:
            groups = {}
            for index, span in enumerate(page.get("spans", [])):
                key = tuple(span.get("line_id", [index]))
                groups.setdefault(key, []).append(span["text"])
            page["text"] = "\n".join(" ".join(words) for words in groups.values())
            if page.get("tables"):
                page["text"] += "\n" + "\n".join("\t".join("" if v is None else str(v) for v in row) for table in page["tables"] for row in table["rows"])
        number = page["pdf_page"]
        if type(number) is not int or number < 1:
            raise ReaderError("Pages are 1-based")
        payload = canonical(page)
        old = self.conn.execute("SELECT payload_json FROM ctr_pages WHERE source_id=? AND source_revision=? AND pdf_page=?", (source_id, revision, number)).fetchone()
        if old:
            if old[0] != payload:
                raise ReaderError("PAGE_REVISION_CONFLICT: re-extract into a new source revision")
            return
        with self.conn:
            self.conn.execute("INSERT INTO ctr_pages VALUES(?,?,?,?,?,?,?,?)", (source_id, revision, number, page["width"], page["height"], page["coordinate_space"], page["method"], payload))
            for span in page.get("spans", []):
                self.conn.execute("INSERT INTO ctr_spans(source_id,source_revision,pdf_page,text,bbox_json,confidence) VALUES(?,?,?,?,?,?)", (source_id, revision, number, span["text"], canonical(span["bbox"]), span.get("confidence")))
            if self.fts:
                self.conn.execute("INSERT INTO ctr_text_fts VALUES(?,?,?,?)", (page["text"], source_id, revision, number))
            for i, table in enumerate(page.get("tables", [])):
                table_id = f"{source_id}@{revision}:p{number}:t{i + 1}"
                self.conn.execute("INSERT INTO ctr_table_candidates VALUES(?,?,?,?,?)", (table_id, source_id, revision, number, canonical({k: v for k, v in table.items() if k != "rows"})))
                for row, cells in enumerate(table["rows"]):
                    for col, raw in enumerate(cells):
                        cell_metadata = table.get("cell_metadata", {}).get(f"{row}:{col}", {})
                        parsed = parse_number(raw, **table.get("numeric_locale", {}))
                        self.conn.execute("INSERT INTO ctr_cells VALUES(?,?,?,?,?,?)", (table_id, row, col, raw, canonical(parsed), canonical(cell_metadata)))
            self.audit("page_extracted", f"{source_id}:{number}", {"revision": revision, "method": page["method"]})

    def region(self, region_id, source_id, revision, page, kind, status, metadata):
        with self.conn:
            self.conn.execute("INSERT INTO ctr_regions VALUES(?,?,?,?,?,?,?)", (region_id, source_id, revision, page, kind, status, canonical(metadata)))
            self.audit("region_added", region_id, {"status": status})

    def add_model(self, model):
        validate_model(model)
        payload = canonical(model)
        digest = hashlib.sha256(payload.encode()).hexdigest()
        old = self.conn.execute("SELECT sha256 FROM ctr_models WHERE model_id=? AND revision=?", (model["id"], model["revision"])).fetchone()
        if old:
            if old[0] != digest:
                raise ReaderError("MODEL_REVISION_CONFLICT: original revision is immutable")
            return digest
        with self.conn:
            self.conn.execute("INSERT INTO ctr_models(model_id,revision,kind,quality,payload_json,sha256) VALUES(?,?,?,?,?,?)", (model["id"], model["revision"], model["kind"], model["quality"], payload, digest))
            for p in model["provenance"]:
                self.conn.execute("INSERT INTO ctr_model_sources VALUES(?,?,?,?,?,?)", (model["id"], model["revision"], p["source_id"], p["source_revision"], p["pdf_page"], canonical(p)))
            curves = ([{"id": model["id"], "segments": model["segments"]}] if model["kind"] == "curve" else model.get("curves", []))
            for curve in curves:
                for si, segment in enumerate(curve["segments"]):
                    for pi, (x, y) in enumerate(segment["points"]):
                        self.conn.execute("INSERT INTO ctr_curve_points VALUES(?,?,?,?,?,?,?,?)", (model["id"], model["revision"], curve["id"], curve.get("parameter"), si, pi, x, y))
            self.audit("model_added", model["id"], {"revision": model["revision"], "quality": model["quality"], "sha256": digest})
        return digest

    def get_model(self, model_id, revision):
        # Revision must be pinned. Never silently select a different source/model version.
        row = self.conn.execute("SELECT payload_json FROM ctr_models WHERE model_id=? AND revision=?", (model_id, revision)).fetchone()
        if not row:
            raise ReaderError("MODEL_NOT_FOUND")
        return json.loads(row[0])

    def calculate(self, model_id, revision, inputs, **kwargs):
        result = evaluate(self.get_model(model_id, revision), inputs, **kwargs)
        with self.conn:
            cur = self.conn.execute("INSERT INTO ctr_calculations(model_id,model_revision,inputs_json,result_json) VALUES(?,?,?,?)", (model_id, revision, canonical(inputs), canonical(result)))
        result["calculation_id"] = cur.lastrowid
        return result

    def search(self, text, limit=30):
        if not text or not 1 <= limit <= 200:
            raise ReaderError("Provide text and limit 1..200")
        # Literal substring search avoids treating user text as FTS query syntax.
        rows = self.conn.execute("SELECT source_id,source_revision,pdf_page,json_extract(payload_json,'$.text') AS text,extraction_method FROM ctr_pages WHERE instr(lower(json_extract(payload_json,'$.text')),lower(?))>0 LIMIT ?", (text, limit)).fetchall()
        return [dict(r) for r in rows]

    def export(self):
        tables = [r[0] for r in self.conn.execute("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'ctr_%' AND name NOT LIKE 'ctr_text_fts%' ORDER BY name")]
        return {"schema": "TD-CHART-TABLE-READER/1", "tables": {table: [dict(r) for r in self.conn.execute(f'SELECT * FROM "{table}"')] for table in tables}}

    def export_text(self):
        lines = []
        for row in self.conn.execute("SELECT source_id,source_revision,pdf_page,payload_json FROM ctr_pages ORDER BY source_id,source_revision,pdf_page"):
            lines.extend([f"SOURCE {row['source_id']} | REVISION {row['source_revision']} | PHYSICAL/SOURCE PAGE {row['pdf_page']}",
                          json.loads(row["payload_json"])["text"], ""])
        for row in self.conn.execute("SELECT model_id,revision,payload_json FROM ctr_models ORDER BY model_id,revision"):
            model = json.loads(row["payload_json"])
            lines.extend([f"MODEL {row['model_id']} | REVISION {row['revision']} | QUALITY {model['quality']}", model["title"], ""])
        return "\n".join(lines)
