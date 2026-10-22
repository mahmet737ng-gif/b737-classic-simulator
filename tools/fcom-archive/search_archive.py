#!/usr/bin/env python3
"""Query extracted FCOM text from SQLite without opening the PDF."""
import argparse
import sqlite3
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("terms", help='Search phrase, e.g. "autothrottle"')
    ap.add_argument("--db", default="FCOM_EXTRACTED/fcom.sqlite")
    ap.add_argument("--max", type=int, default=15)
    args = ap.parse_args()
    if not Path(args.db).is_file():
        ap.error("Database not found. Extract the FCOM first.")
    con = sqlite3.connect(args.db)
    try:
        rows = con.execute("SELECT pages.page, snippet(page_fts,0,'[',']',' … ',18) "
                           "FROM page_fts JOIN pages ON pages.page=page_fts.rowid "
                           "WHERE page_fts MATCH ? ORDER BY rank LIMIT ?", (args.terms, args.max)).fetchall()
    except sqlite3.OperationalError:
        rows = con.execute("SELECT page, substr(text,1,220) FROM pages WHERE text LIKE ? LIMIT ?",
                           ('%'+args.terms+'%', args.max)).fetchall()
    for page, snippet in rows:
        print(f"PDF PAGE {page} | {snippet}\n")
    if not rows:
        print("No matching pages")


if __name__ == "__main__":
    main()