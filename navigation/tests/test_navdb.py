import csv
from pathlib import Path
import sqlite3
import tempfile
import unittest
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from navdb import build, airport, summary

# Synthetic fixtures test mechanics only; never present them as real navigation records.
class NavDbTests(unittest.TestCase):
    def setUp(self):
        self.work=tempfile.TemporaryDirectory(); self.root=Path(self.work.name)
        self.data=self.root/'data'; self.data.mkdir()
        fixtures={
         'airports.csv':(['id','ident','icao_code','iata_code','name','iso_country','municipality','latitude_deg','longitude_deg','elevation_ft','type'],[
             [1,'TST1','ZZZZ','ZZ1','TEST AIRPORT','ZZ','Testville','33.0','51.0','4000','small_airport'],
             [2,'BAD1','ZBAD','','BAD COORD','ZZ','','999','51','','small_airport']]),
         'runways.csv':(['id','airport_ref','le_ident','he_ident','length_ft','width_ft','surface','le_latitude_deg','le_longitude_deg','he_latitude_deg','he_longitude_deg'],[
             [10,1,'09','27','10000','150','ASP','33.0','51.0','33.01','51.01'],
             [11,2,'09','27','0','0','','','','','']]),
         'navaids.csv':(['id','ident','name','type','frequency_khz','latitude_deg','longitude_deg','elevation_ft','magnetic_variation_deg','associated_airport'],[
             [20,'TST','TEST VOR','VOR-DME','113900','33.0','51.0','','','ZZZZ']]),
         'airport-frequencies.csv':(['id','airport_ref','type','description','frequency_mhz'],[
             [30,1,'TWR','Tower','118.500']])
        }
        for filename,(cols,rows) in fixtures.items():
            with (self.data/filename).open('w',newline='') as f:
                w=csv.writer(f); w.writerow(cols); w.writerows(rows)
        self.db=self.root/'navdb.sqlite'
    def tearDown(self): self.work.cleanup()
    def test_build_and_airport_query(self):
        counts=build(self.data,self.db)
        self.assertEqual(counts['airports'],{'accepted':1,'rejected':1})
        self.assertEqual(counts['runways'],{'accepted':1,'rejected':1})
        with sqlite3.connect(self.db) as con:
            a=airport(con,'ZZZZ')
            self.assertEqual(a['icao'],'ZZZZ')
            self.assertEqual(len(a['runways']),1)
            self.assertEqual(len(a['frequencies']),1)
            self.assertIsNone(airport(con,'OIII'))
            self.assertEqual(summary(con)['counts']['procedures'],0)
            self.assertEqual(con.execute('PRAGMA foreign_key_check').fetchall(),[])
    def test_failed_build_preserves_previous_database(self):
        build(self.data,self.db)
        self.data.joinpath('airports.csv').unlink()
        with self.assertRaises(FileNotFoundError): build(self.data,self.db)
        with sqlite3.connect(self.db) as con:
            self.assertIsNotNone(airport(con,'ZZZZ'))
    def test_faa_records_are_only_staged(self):
        rec='S'+'X'*131
        faa=self.root/'FAACIFP18'; faa.write_text(rec+'\n'+'bad line\n',encoding='ascii')
        result=build(self.data,self.db,faa_path=faa,faa_cycle='261001')
        self.assertEqual(result['faa']['staged_faa_records'],1)
        self.assertEqual(result['faa']['rejected_faa_records'],1)
        with sqlite3.connect(self.db) as con:
            self.assertEqual(summary(con)['counts']['procedures'],0)
            self.assertEqual(con.execute('SELECT status FROM faa_raw').fetchone()[0],'STAGED_UNVERIFIED')
            self.assertEqual(con.execute("SELECT state FROM airac_cycles WHERE source='FAA CIFP'").fetchone()[0],'STAGED_NOT_FMC_READY')
if __name__=='__main__': unittest.main()
