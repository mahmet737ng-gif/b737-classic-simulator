#!/usr/bin/env python3
"""Check completeness of an extracted FCOM offline corpus."""
import argparse
import json
import sqlite3
from pathlib import Path


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("directory",nargs="?",default="FCOM_EXTRACTED")
    ap.add_argument("--require-images",action="store_true")
    args=ap.parse_args()
    root=Path(args.directory)
    m=json.loads((root/"manifest.json").read_text(encoding="utf-8"))
    expected=m["source_pdf_pages"]
    missing_pages=[n for n in range(1,expected+1) if not (root/"pages"/f"{n:05d}.json").is_file()]
    missing_images=[n for n in range(1,expected+1) if not (root/"page-images"/f"{n:05d}.png").is_file()]
    con=sqlite3.connect(root/"fcom.sqlite")
    dbpages=con.execute("SELECT count(*) FROM pages").fetchone()[0]
    con.close()
    checked=0; mislabeled=0; tables=0; imgs=0; no_text=0
    for p in sorted((root/"pages").glob("[0-9]*.json")):
        obj=json.loads(p.read_text(encoding="utf-8"))
        checked+=1
        mislabeled+=(obj.get("pdf_sha256")!=m["source_sha256"])
        tables+=len(obj.get("tables",[]))
        imgs+=len(obj.get("figures",[]))
        no_text+=(not bool(obj.get("text","").strip()))
    print(json.dumps({"expected_pages":expected,"page_json_files":checked,"database_rows":dbpages,
          "missing_pages":len(missing_pages),"missing_page_images":len(missing_images),
          "source_hash_mismatches":mislabeled,"detected_tables":tables,
          "embedded_image_placements":imgs,"pages_without_selectable_text":no_text,
          "missing_first_pages":missing_pages[:25]},indent=2))
    complete=not missing_pages and dbpages==expected and mislabeled==0
    if args.require_images:
        complete=complete and not missing_images
    if not complete:
        raise SystemExit("INCOMPLETE (resume extraction) ")
    print("COMPLETE (page coverage; individual table cell accuracy still needs QA)")


if __name__ == "__main__":
    main()