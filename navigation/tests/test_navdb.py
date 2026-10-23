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
             [1,'TST1','ZZZZ','ZZ1','TEST AIRPORT','IR','Testville','33.0','51.0','4000','small_airport'],
             [2,'BAD1','ZBAD','','BAD COORD','IR','','999','51','','small_airport']]),
         'runways.csv':(['id','airport_ref','le_ident','he_ident','length_ft','width_ft','surface','le_latitude_deg','le_longitude_deg','he_latitude_deg','he_longitude_deg'],[
             [10,1,'09','27','10000','150','ASP','33.0','51.0','33.01','51.01'],
             [11,2,'09','27','0','0','','','','','']]),
         'navaids.csv':(['id','ident','name','type','frequency_khz','latitude_deg','longitude_deg','elevation_ft','magnetic_variation_deg','associated_airport','iso_country'],[
             [20,'TST','TEST VOR','VOR-DME','113900','33.0','51.0','','','ZZZZ','IR']]),
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
        self.assertEqual(counts['airports'],{'accepted':1,'rejected':1,'skipped_outside_iran':0})
        self.assertEqual(counts['runways'],{'accepted':1,'rejected':1,'skipped_outside_iran':0})
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
    def test_no_faa_records_in_iran_only_build(self):
        faa=self.root/'FAACIFP18'; faa.write_text('S'+'X'*131+'\n',encoding='ascii')
        with self.assertRaisesRegex(ValueError,'Iran-only'):
            build(self.data,self.db,faa_path=faa,faa_cycle='261001')
        self.assertFalse(self.db.exists())

    def test_strict_country_filter_and_fk_children(self):
        def append(filename, row):
            with (self.data/filename).open('a',newline='') as f: csv.writer(f).writerow(row)
        append('airports.csv',[3,'TEST3','EGLL','LHR','OUTSIDE','GB','London',51.0,-0.4,80,'large_airport'])
        append('runways.csv',[12,3,'09','27',1000,100,'ASP',51,-0.4,51,-0.3])
        append('airport-frequencies.csv',[31,3,'TWR','Foreign',118.7])
        append('navaids.csv',[21,'LON','OUTSIDE VOR','VOR',113000,51.0,-0.4,'','','EGLL','GB'])
        stat=build(self.data,self.db)
        self.assertEqual(stat['airports']['skipped_outside_iran'],1)
        self.assertEqual(stat['runways']['skipped_outside_iran'],1)
        self.assertEqual(stat['frequencies']['skipped_outside_iran'],1)
        self.assertEqual(stat['navaids']['skipped_outside_iran'],1)
        with sqlite3.connect(self.db) as con:
            self.assertEqual(con.execute('SELECT DISTINCT country FROM airports').fetchall(),[('IR',)])
            self.assertEqual(con.execute("SELECT COUNT(*) FROM navaids WHERE ident='LON'").fetchone()[0],0)
            self.assertEqual(con.execute('SELECT COUNT(*) FROM faa_raw').fetchone()[0],0)
            self.assertEqual(dict(con.execute('SELECT key,value FROM metadata'))['iso_country'],'IR')
            self.assertEqual(con.execute('PRAGMA foreign_key_check').fetchall(),[])

    def test_reject_missing_country_columns_preserve_old_database(self):
        build(self.data,self.db)
        self.data.joinpath('navaids.csv').write_text('id,ident,latitude_deg,longitude_deg\n9,X,30,50\n')
        with self.assertRaisesRegex(ValueError,'Incompatible source columns'):
            build(self.data,self.db)
        with sqlite3.connect(self.db) as con:
            self.assertIsNotNone(airport(con,'ZZZZ'))

if __name__=='__main__': unittest.main()
