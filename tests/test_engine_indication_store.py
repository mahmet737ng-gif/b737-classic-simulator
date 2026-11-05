"""SQLite source-provenance, idempotency and conflict regression checks."""
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from engine.technical_reader_v1.engine_indication_store import rows_from_source, import_rules

class EngineIndicationsStoreTests(unittest.TestCase):
    def test_import_is_immutable_and_idempotent(self):
        data, rules = rows_from_source()
        self.assertEqual(data["schema"], "b737classic.engine-indication-technical-data/1")
        self.assertEqual(len(rules), 36)
        with sqlite3.connect(":memory:") as conn:
            a=import_rules(conn)
            b=import_rules(conn)
            self.assertEqual(a,b)
            self.assertEqual(conn.execute("SELECT COUNT(*) FROM ctr_engine_indication_rules").fetchone()[0],36)

    def test_same_revision_different_payload_is_rejected(self):
        data, _ = rows_from_source()
        with sqlite3.connect(":memory:") as conn, tempfile.TemporaryDirectory() as directory:
            import_rules(conn)
            data["laws"]["oilPressureRedLinePsi"] = 999
            altered=Path(directory)/"changed.json"
            altered.write_text(json.dumps(data),encoding="utf-8")
            with self.assertRaisesRegex(ValueError,"IMMUTABLE_REVISION_CONFLICT"):
                import_rules(conn,altered)

if __name__=="__main__":
    unittest.main()
