import sys, unittest, sqlite3, tempfile
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from queries import distance_nm, find_navaids, readiness
from navdb import SCHEMA

class QueryTests(unittest.TestCase):
    def test_distance(self):
        self.assertAlmostEqual(distance_nm(0,0,0,1),60.04,places=1)
        self.assertAlmostEqual(distance_nm(0,179.9,0,-179.9),12.0,delta=0.1)
    def test_invalid(self):
        with self.assertRaises(ValueError):
            find_navaids('missing.sqlite',near=(99,0))
    def test_query(self):
        with tempfile.TemporaryDirectory() as folder:
            db=Path(folder)/'nav.sqlite'
            with sqlite3.connect(db) as con:
                con.executescript(SCHEMA)
                con.execute("INSERT INTO sources(id,name,filename,retrieved_utc,sha256,license) VALUES(1,'fixture','test.csv','now','abc','test')")
                con.execute("INSERT INTO navaids(id,source_id,ident,name,type,lat,lon) VALUES(1,1,'TST','Sample','VOR',0,179.9)")
            result=find_navaids(db,near=(0,-179.9),radius_nm=15)
            self.assertEqual(len(result),1)
            self.assertEqual(result[0]['source_sha256'],'abc')
            self.assertEqual(len(find_navaids(db,ident='tst')),1)
            self.assertFalse(readiness(db)['fmc_active'])
