#!/usr/bin/env python3
"""Local source-preserving FCOM archive builder.

Requires authorized access to the source PDF. Writes extracted text, structured
blocks, tables, embedded image objects, full-page image references, an FTS search
index, and a machine-verifiable manifest. Never performs network I/O.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import sqlite3
import sys
import time
from pathlib import Path

import fitz

SCHEMA_VERSION = "fcom-offline-archive-v1"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for piece in iter(lambda: f.read(1024 * 1024), b""):
            h.update(piece)
    return h.hexdigest()


def json_write(path: Path, data: dict | list) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".part")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)


def safe_box(bbox) -> list[float]:
    return [round(float(z), 2) for z in bbox]


def text_blocks(page) -> list[dict]:
    # Keep text and its bounding boxes, not image binary embedded in dict.
    data = page.get_text("dict", flags=fitz.TEXTFLAGS_DICT & ~fitz.TEXT_PRESERVE_IMAGES)
    res = []
    for b in data.get("blocks", []):
        if b.get("type") != 0:
            continue
        lines = []
        for line in b.get("lines", []):
            spans = [{"bbox_pt": safe_box(s["bbox"]), "text": s.get("text", ""),
                      "font": s.get("font"), "size_pt": round(s.get("size", 0), 2),
                      "color_rgb_int": s.get("color")}
                     for s in line.get("spans", [])]
            if spans:
                lines.append({"bbox_pt": safe_box(line["bbox"]), "spans": spans})
        if lines:
            res.append({"bbox_pt": safe_box(b["bbox"]), "lines": lines})
    return res


def printable_codes(text: str) -> list[str]:
    # Boeing style printed folios such as 4.10.2 and NP.21.2.
    pat = r"(?<!\w)(?:[A-Z]{1,3}\.)?\d{1,3}\.\d{1,3}(?:\.\d{1,4})?(?!\w)"
    candidates = re.findall(pat, text)
    return list(dict.fromkeys(candidates))[-18:]


def export_figures(doc, page, page_number: int, out: Path,
                   cache: dict, save_images: bool) -> list[dict]:
    items = []
    seen = set()
    for entry in page.get_images(full=True):
        xref = entry[0]
        if xref in seen:
            continue
        seen.add(xref)
        locations = [safe_box(r) for r in page.get_image_rects(xref)]
        item = {"xref": xref, "rectangles_pt": locations, "filename": None}
        if save_images:
            if xref not in cache:
                try:
                    image = doc.extract_image(xref)
                    if image:
                        blob = image["image"]
                        digest = hashlib.sha256(blob).hexdigest()
                        ext = str(image.get("ext", "bin")).lower()
                        ext = ext if re.fullmatch(r"[a-z0-9]{2,6}", ext) else "bin"
                        rel = f"figures/assets/{digest}.{ext}"
                        dest = out / rel
                        dest.parent.mkdir(parents=True, exist_ok=True)
                        if not dest.exists():
                            dest.write_bytes(blob)
                        cache[xref] = rel
                except Exception as ex:
                    item["error"] = f"{type(ex).__name__}: {ex}"
            item["filename"] = cache.get(xref)
        items.append(item)
    return items


def export_tables(page, page_number: int, out: Path, method: str, dpi: int) -> tuple[list[dict], list[str]]:
    result = []
    warnings = []
    if method == "off":
        return result, warnings
    try:
        tables = page.find_tables(strategy=method)
    except Exception as ex:
        return [], [f"Table detection failed: {type(ex).__name__}: {ex}"]
    for n, t in enumerate(tables.tables, 1):
        bbox = safe_box(t.bbox)
        values = t.extract()
        rel = f"tables/{page_number:05d}-{n:02d}.csv"
        dst = out / rel
        dst.parent.mkdir(parents=True, exist_ok=True)
        with dst.open("w", newline="", encoding="utf-8-sig") as f:
            csv.writer(f).writerows([["" if x is None else x for x in row] for row in values])
        # Crop of the original page is the non-heuristic reference for every detected table.
        clip = fitz.Rect(t.bbox)
        image_rel = f"tables/{page_number:05d}-{n:02d}.png"
        page.get_pixmap(matrix=fitz.Matrix(dpi/72, dpi/72), clip=clip, alpha=False).save(out / image_rel)
        result.append({"number": n, "bbox_pt": bbox, "rows": values,
                       "csv": rel, "visual_crop": image_rel, "method": method,
                       "status": "HEURISTIC_NEEDS_VISUAL_QA"})
    return result, warnings


def init_db(path: Path):
    conn = sqlite3.connect(str(path))
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("CREATE TABLE IF NOT EXISTS pages (page INTEGER PRIMARY KEY, text TEXT NOT NULL,"
                 " folio_candidates TEXT, image_path TEXT, tables_json TEXT, figures_json TEXT)")
    conn.execute("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)")
    try:
        conn.execute("CREATE VIRTUAL TABLE IF NOT EXISTS page_fts USING fts5(text, tokenize='unicode61')")
        fts = True
    except sqlite3.OperationalError:
        fts = False
    conn.commit()
    return conn, fts


def store_db(conn, has_fts: bool, data: dict):
    n = data["page"]
    conn.execute("INSERT OR REPLACE INTO pages VALUES(?,?,?,?,?,?)",
                 (n, data["text"], json.dumps(data["printed_folio_candidates"]),
                  data.get("page_image"), json.dumps(data["tables"]),
                  json.dumps(data["figures"])))
    if has_fts:
        conn.execute("DELETE FROM page_fts WHERE rowid=?", (n,))
        conn.execute("INSERT INTO page_fts(rowid,text) VALUES(?,?)", (n, data["text"]))
    conn.commit()


def build(args):
    source = Path(args.pdf).expanduser().resolve()
    if not source.is_file():
        raise SystemExit(f"PDF not found: {source}")
    out = Path(args.out).expanduser().resolve()
    out.mkdir(parents=True, exist_ok=True)
    pdf_sha = sha256_file(source)
    doc = fitz.open(str(source))
    if doc.needs_pass:
        if not args.password or not doc.authenticate(args.password):
            raise SystemExit("Source is password-protected; a valid authorized password is needed.")
    total = doc.page_count
    begin = max(1, args.from_page)
    end = min(total, args.to_page or total)
    if begin > end:
        raise SystemExit("Invalid page range")
    db, has_fts = init_db(out / "fcom.sqlite")
    db.execute("INSERT OR REPLACE INTO meta VALUES(?,?)", ("source_sha256", pdf_sha))
    db.execute("INSERT OR REPLACE INTO meta VALUES(?,?)", ("schema_version", SCHEMA_VERSION))
    db.execute("INSERT OR REPLACE INTO meta VALUES(?,?)", ("source_pages", str(total)))
    db.commit()
    image_cache = {}
    errors = []
    start = time.time()
    for n in range(begin, end + 1):
        path = out / "pages" / f"{n:05d}.json"
        if args.resume and path.is_file():
            try:
                old = json.loads(path.read_text(encoding="utf-8"))
                needed_image = (not args.no_page_images) and not (out / f"page-images/{n:05d}.png").is_file()
                if old.get("pdf_sha256") == pdf_sha and not needed_image:
                    store_db(db, has_fts, old)
                    print(f"[{n}/{total}] skipped (resume)", flush=True)
                    continue
            except Exception:
                pass
        try:
            page = doc.load_page(n - 1)
            text = page.get_text("text", sort=True)
            blocks = text_blocks(page)
            tables, warnings = export_tables(page, n, out, args.tables, args.render_dpi)
            figures = export_figures(doc, page, n, out, image_cache, not args.no_embedded_images)
            img_path = None
            if not args.no_page_images:
                img_path = f"page-images/{n:05d}.png"
                path_img = out / img_path
                path_img.parent.mkdir(exist_ok=True)
                page.get_pixmap(matrix=fitz.Matrix(args.render_dpi/72, args.render_dpi/72), alpha=False).save(path_img)
            obj = {"schema": SCHEMA_VERSION, "pdf_sha256": pdf_sha, "page": n,
                   "page_count": total, "page_width_pt": round(page.rect.width, 2),
                   "page_height_pt": round(page.rect.height, 2),
                   "printed_folio_candidates": printable_codes(text), "text": text,
                   "blocks": blocks, "tables": tables, "figures": figures,
                   "page_image": img_path, "warnings": warnings + (["NO_SELECTABLE_TEXT"] if not text.strip() else []),
                   "source_notes": "All pixel diagrams also preserved through full-page image; table recognition is heuristic."}
            json_write(path, obj)
            tpath = out / "text" / f"{n:05d}.txt"
            tpath.parent.mkdir(exist_ok=True)
            tpath.write_text(text, encoding="utf-8")
            store_db(db, has_fts, obj)
            print(f"[{n}/{total}] chars={len(text)} tables={len(tables)} images={len(figures)}", flush=True)
        except Exception as ex:
            msg = f"page {n}: {type(ex).__name__}: {ex}"
            errors.append(msg)
            print(f"ERROR: {msg}", file=sys.stderr, flush=True)
            if args.fail_fast:
                break
    db.close()
    done_pages = sorted((out / "pages").glob("[0-9]*.json"))
    manifest = {"schema": SCHEMA_VERSION, "source_pdf_basename": source.name,
                "source_sha256": pdf_sha, "source_pdf_pages": total,
                "pages_exported": len(done_pages), "requested_range": [begin, end],
                "full_document_complete": len(done_pages) == total and not errors,
                "render_dpi": args.render_dpi, "table_strategy": args.tables,
                "embedded_images_enabled": not args.no_embedded_images,
                "full_page_images_enabled": not args.no_page_images,
                "sqlite_fts5": has_fts, "errors": errors, "elapsed_seconds": round(time.time()-start, 1),
                "notice": "USER-SUPPLIED, BOEING PROPRIETARY / EXPORT CONTROLLED — do not publish publicly without authorization."}
    json_write(out / "manifest.json", manifest)
    print(f"FINISHED {len(done_pages)}/{total}; full_document_complete={manifest['full_document_complete']}")
    print(f"Archive: {out}")
    if errors:
        raise SystemExit(1)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", help="Path to user's authorized FCOM PDF")
    parser.add_argument("--out", default="FCOM_EXTRACTED", help="Archive output directory")
    parser.add_argument("--from-page", type=int, default=1)
    parser.add_argument("--to-page", type=int)
    parser.add_argument("--render-dpi", type=int, default=120)
    parser.add_argument("--tables", choices=["lines", "lines_strict", "text", "off"], default="lines")
    parser.add_argument("--no-page-images", action="store_true")
    parser.add_argument("--no-embedded-images", action="store_true")
    parser.add_argument("--resume", action="store_true", help="Skip already extracted pages from same PDF")
    parser.add_argument("--fail-fast", action="store_true")
    parser.add_argument("--password", default="", help="Only if the user is authorized")
    args = parser.parse_args()
    if args.render_dpi < 72 or args.render_dpi > 300:
        parser.error("--render-dpi must be in [72, 300]")
    build(args)


if __name__ == "__main__":
    main()