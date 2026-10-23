"""Synthetic-only source route tests: never operational route examples."""
import unittest
import sqlite3
import tempfile
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from flight_plan_engine import (haversine_nm,initial_true_course,load_airway_section,
    RouteError,append_gap,normalize_ident,store_snapshot,AIRAC_MARKER)

class FlightPlanEngineTests(unittest.TestCase):
    def setUp(self):
        self.dir=tempfile.TemporaryDirectory()
        self.con=sqlite3.connect(':memory:');self.con.row_factory=sqlite3.Row
        self.con.execute('''CREATE TABLE airways(id INTEGER PRIMARY KEY,ident TEXT NOT NULL,
            seq INTEGER NOT NULL,fix_ident TEXT NOT NULL,lat REAL,lon REAL,
            source_file TEXT NOT NULL, source_line INTEGER NOT NULL)''')
        self.con.executemany('INSERT INTO airways VALUES(?,?,?,?,?,?,?,?)',[
          (1,'T1',1,'AAA',10,20,'fixture',1),(2,'T1',2,'BBB',11,21,'fixture',2),
          (3,'T1',3,'CCC',12,22,'fixture',3),
          (4,'T2',1,'CCC',12,22,'fixture',4),(5,'T2',2,'DDD',13,23,'fixture',5),
          (6,'BROKEN',1,'AAA',10,20,'fixture',6),(7,'BROKEN',3,'CCC',12,22,'fixture',7),
          (8,'REPEAT',1,'AAA',10,20,'fixture',8),(9,'REPEAT',2,'AAA',11,21,'fixture',9),
          (10,'REPEAT',3,'BBB',12,22,'fixture',10)])
    def tearDown(self): self.con.close();self.dir.cleanup()
    def test_forward(self):
        self.assertEqual([r['fix_ident'] for r in load_airway_section(self.con,'T1','AAA','CCC')],['AAA','BBB','CCC'])
    def test_reverse_including_first_index(self):
        self.assertEqual([r['fix_ident'] for r in load_airway_section(self.con,'T1','CCC','AAA')],['CCC','BBB','AAA'])
    def test_missing_airway(self):
        with self.assertRaisesRegex(RouteError,'absent'):
            load_airway_section(self.con,'NOTTHERE','AAA','BBB')
    def test_unknown_fix(self):
        with self.assertRaisesRegex(RouteError,'Ambiguous/missing'):
            load_airway_section(self.con,'T1','ZZZ','BBB')
    def test_repeated_ident_rejected(self):
        with self.assertRaisesRegex(RouteError,'Ambiguous'):
            load_airway_section(self.con,'REPEAT','AAA','BBB')
    def test_missing_sequence_rejected(self):
        with self.assertRaisesRegex(RouteError,'missing/repeated sequence'):
            load_airway_section(self.con,'BROKEN','AAA','CCC')
    def test_antimeridian_distance(self):
        self.assertAlmostEqual(haversine_nm(0,179.9,0,-179.9),12.008,delta=0.05)
    def test_true_course_not_magnetic(self):
        self.assertAlmostEqual(initial_true_course(0,0,0,1),90,delta=0.05)
    def test_invalid_ident(self):
        with self.assertRaises(RouteError):normalize_ident('B411;DROP TABLE')
    def test_discontinuity_preserves_break(self):
        items=[];append_gap(items,'SOURCE_UNVERIFIED','A','B');append_gap(items,'SOURCE_UNVERIFIED','A','B')
        self.assertEqual(len(items),1)
        self.assertEqual(items[0]['fmc_status'],'NOT_EXECUTABLE')
    def test_snapshot_integrity_and_privacy_status(self):
        path=Path(self.dir.name)/'private-draft.sqlite'
        result={'origin':'ZZZZ','destination':'ZZYY','status':'DRAFT_NOT_EXECUTABLE',
                'qa':{'discontinuity_count':1},
                'items':[{'type':'DISCONTINUITY','label':'ROUTE DISCONTINUITY'}]}
        store_snapshot(path,[result])
        with sqlite3.connect(path) as c:
            self.assertEqual(c.execute('PRAGMA integrity_check').fetchone()[0],'ok')
            self.assertEqual(c.execute('SELECT value FROM meta WHERE key="source_marker"').fetchone()[0],AIRAC_MARKER)
            self.assertEqual(c.execute('SELECT value FROM meta WHERE key="fmc_status"').fetchone()[0],'NOT_EXECUTABLE')
            self.assertEqual(c.execute('SELECT COUNT(*) FROM plan_items').fetchone()[0],1)
    def test_fail_closed_keeps_existing_output(self):
        path=Path(self.dir.name)/'private-draft.sqlite'
        store_snapshot(path,[{'origin':'AAAA','destination':'BBBB','status':'DRAFT',
                             'qa':{'discontinuity_count':0},'items':[]}])
        original=path.read_bytes()
        with self.assertRaises(KeyError):store_snapshot(path,[{'origin':'AAAA'}])
        self.assertEqual(path.read_bytes(),original)

if __name__=='__main__':unittest.main()