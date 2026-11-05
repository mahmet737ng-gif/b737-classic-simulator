"""Immutable source-indexed technical reader records for 737 Classic engine indications.
Additive staging. Not a verified airframe/WDM source database.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import sqlite3
from pathlib import Path

SOURCE = Path(__file__).resolve().parents[1] / "instruments" / "engine-indication-technical-db-v1.json"
DDL = """
CREATE TABLE IF NOT EXISTS ctr_engine_indication_rules(
 rule_id TEXT NOT NULL, revision INTEGER NOT NULL, quality TEXT NOT NULL,
 payload_json TEXT NOT NULL, source_refs_json TEXT NOT NULL, sha256 TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(rule_id,revision)
);
CREATE TABLE IF NOT EXISTS ctr_engine_indication_imports(
 schema_id TEXT NOT NULL, revision INTEGER NOT NULL, content_sha256 TEXT NOT NULL,
 record_count INTEGER NOT NULL, imported_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(schema_id,revision)
);
"""
def canonical(obj):
    return json.dumps(obj, sort_keys=True, ensure_ascii=False, separators=(",",":"), allow_nan=False)

def sha(obj):
    return hashlib.sha256(canonical(obj).encode("utf-8")).hexdigest()

def rows_from_source(source=SOURCE):
    data = json.loads(Path(source).read_text(encoding="utf-8"))
    if data.get("schema") != "b737classic.engine-indication-technical-data/1":
        raise ValueError("unsupported engine indication technical-data schema")
    if type(data.get("revision")) is not int or data["revision"]<1:
        raise ValueError("revision must be a positive integer")
    refs = data.get("sources")
    if not refs or not data.get("instruments"):
        raise ValueError("missing provenance or rules")
    rows=[]
    for name, rule in data["instruments"].items():
        citation = {s:refs[s] for s in rule["sources"]}
        for mode in ("EIS","CONVENTIONAL"):
            for side in ("1","2"):
                wiring=rule["wiring"][mode][side]
                payload={"name":name,"mode":mode,"side":int(side),"bus":wiring["bus"],
                  "feedQuality":wiring["quality"],"voltage":wiring["voltage"],
                  "sensor":rule["sensor"],"unit":rule["displayUnits"][mode],
                  "section":rule["section"]}
                rows.append((f"engine.{mode}.{name}.{side}",data["revision"],
                  "SOURCE_TRACED_NOT_INSTALLED_WDM",canonical(payload),
                  canonical(citation),sha(payload)))
    for name,rule in data["lamps"].items():
        citation={s:refs[s] for s in rule["sourceRefs"]}
        payload={"name":name,**rule}
        rows.append((f"engine.lamp.{name}",data["revision"],"TRAINING_SOURCE_TRACED",
                     canonical(payload),canonical(citation),sha(payload)))
    return data,rows

def import_rules(conn,source=SOURCE):
    data,rows=rows_from_source(source)
    conn.executescript(DDL)
    digest=sha(data)
    prev=conn.execute(
      "SELECT content_sha256 FROM ctr_engine_indication_imports WHERE schema_id=? AND revision=?",
      (data["schema"],data["revision"])).fetchone()
    if prev and prev[0]!=digest:
        raise ValueError("IMMUTABLE_REVISION_CONFLICT: create a new revision")
    with conn:
        for row in rows:
            old=conn.execute("SELECT sha256 FROM ctr_engine_indication_rules WHERE rule_id=? AND revision=?",
                (row[0],row[1])).fetchone()
            if old and old[0]!=row[5]:
                raise ValueError("IMMUTABLE_RULE_CONFLICT: "+row[0])
            conn.execute("INSERT OR IGNORE INTO ctr_engine_indication_rules"
              "(rule_id,revision,quality,payload_json,source_refs_json,sha256)"
              "VALUES(?,?,?,?,?,?)",row)
        conn.execute("INSERT OR IGNORE INTO ctr_engine_indication_imports"
          "(schema_id,revision,content_sha256,record_count) VALUES(?,?,?,?)",
          (data["schema"],data["revision"],digest,len(rows)))
    return {"schema":data["schema"],"revision":data["revision"],
            "records":len(rows),"sha256":digest,"status":"IMPORTED_OR_ALREADY_IDENTICAL"}

def main(argv=None):
    p=argparse.ArgumentParser()
    p.add_argument("command",choices=["import","show"])
    p.add_argument("--db",required=True)
    p.add_argument("--source",default=str(SOURCE))
    args=p.parse_args(argv)
    with sqlite3.connect(args.db) as conn:
        if args.command=="import": result=import_rules(conn,args.source)
        else:
            conn.executescript(DDL)
            result={"imports":conn.execute(
              "SELECT schema_id,revision,record_count,content_sha256 "
              "FROM ctr_engine_indication_imports ORDER BY revision").fetchall()}
    print(json.dumps(result,ensure_ascii=False))
if __name__=="__main__":
    main()
