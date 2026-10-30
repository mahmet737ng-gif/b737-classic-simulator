"""Synthetic tests; no licensed NAVDATA is committed to the repository."""
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from navdata_catalog_v1 import NavCatalog, CatalogError, MARKER, INDEXES


class NavDataCatalogTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.path = Path(self.temp.name) / 'private-fixture.sqlite'
        with sqlite3.connect(self.path) as db:
            db.executescript('''
            CREATE TABLE navdata_import_batches(airac_cycle TEXT,marker TEXT,status TEXT);
            CREATE TABLE npe_decoder_runs(source_marker TEXT,status TEXT);
            CREATE TABLE airports(id INTEGER,icao TEXT,lat REAL,lon REAL,source_file TEXT,source_line INT);
            CREATE TABLE runways(id INTEGER,airport_icao TEXT,runway_ident TEXT,length_ft INT,magnetic_bearing INT,lat REAL,lon REAL,ils_frequency_mhz REAL,localizer_course INT,elevation_ft INT,source_file TEXT,source_line INT);
            CREATE TABLE navaids(id INTEGER,ident TEXT,name TEXT,type TEXT,frequency REAL,frequency_unit TEXT,lat REAL,lon REAL,source_file TEXT,source_line INT);
            CREATE TABLE waypoints(id INTEGER,ident TEXT,display_name TEXT,lat REAL,lon REAL,source_file TEXT,source_line INT);
            CREATE TABLE airways(id INTEGER,ident TEXT,seq INT,fix_ident TEXT,lat REAL,lon REAL,source_file TEXT,source_line INT);
            CREATE TABLE procedures(id INTEGER,airport_icao TEXT,kind TEXT,ident TEXT,status TEXT);
            CREATE TABLE npe_decoded_procedures(procedure_id INT,parse_status TEXT,fmc_status TEXT,runway_reference_json TEXT,transition_labels_json TEXT);
            CREATE TABLE procedure_legs(procedure_id INT);
            ''')
            for table, name in INDEXES.items():
                col = {'airports':'icao','runways':'airport_icao,runway_ident',
                       'navaids':'ident','waypoints':'ident','airways':'ident,seq',
                       'procedures':'airport_icao,kind,ident'}[table]
                db.execute(f'CREATE INDEX {name} ON {table}({col})')
            db.execute('INSERT INTO navdata_import_batches VALUES (?,?,?)',('2610',MARKER,'IMPORTED_RAW_FMC_BLOCKED'))
            db.execute('INSERT INTO npe_decoder_runs VALUES (?,?)',(MARKER,'SOURCE_AST_NON_EXECUTABLE'))
            db.execute("INSERT INTO airports VALUES (1,'OIII',35.0,51.0,'fixture',1)")
            db.execute("INSERT INTO runways VALUES (1,'OIII','29R',10000,280,35,51,NULL,NULL,3900,'fixture',2)")
            db.execute("INSERT INTO waypoints VALUES (1,'DUP','A',35,51,'fixture',3)")
            db.execute("INSERT INTO waypoints VALUES (2,'DUP','B',36,52,'fixture',4)")
            db.execute("INSERT INTO navaids VALUES (1,'VOR','VOR TEST','VOR',113.0,'MHz',35,51,'fixture',5)")
            db.execute("INSERT INTO airways VALUES (1,'A1',1,'DUP',35,51,'fixture',6)")
            db.execute("INSERT INTO procedures VALUES (1,'OIII','SID','SYN1','SOURCE_ONLY')")
            db.execute("INSERT INTO npe_decoded_procedures VALUES (1,'SOURCE_TOKEN_DECODED','NOT_EXECUTABLE_UNTIL_VERIFIED','[\"29R\"]','[]')")

    def test_source_gated_lookups_and_no_fmc_legs(self):
        with NavCatalog(self.path) as c:
            self.assertEqual(c.airport('oiii')['rows'][0]['icao'],'OIII')
            self.assertEqual(c.runways('OIII')['rows'][0]['runway_ident'],'29R')
            self.assertEqual(c.fix('VOR','navaids')['rows'][0]['type'],'VOR')
            self.assertEqual(c.airway('A1')['rows'][0]['fix_ident'],'DUP')
            self.assertEqual(c.procedures('OIII','SID')['rows'][0]['ident'],'SYN1')
            self.assertEqual(c.summary()['records']['procedure_legs'],0)
            self.assertFalse(c.procedures('OIII','SID')['fmc_executable'])

    def test_duplicate_fixes_are_ambiguous_without_inventing_selection(self):
        with NavCatalog(self.path) as c:
            result = c.fix('DUP', limit=1)
            self.assertTrue(result['has_more'])
            self.assertEqual(result['resolution'],'MULTIPLE_SOURCE_CANDIDATES_SELECT_EXACT_ID')
            self.assertEqual(len(result['rows']),1)

    def test_invalid_queries_are_blocked(self):
        with NavCatalog(self.path) as c:
            with self.assertRaises(CatalogError): c.airport("OIII' OR 1=1 --")
            with self.assertRaises(CatalogError): c.fix('AAA','procedures')
            with self.assertRaises(CatalogError): c.fix('DUP',limit=1000)
            with self.assertRaises(CatalogError): c.procedures('OIII','DEP')
            with self.assertRaises(sqlite3.OperationalError): c.db.execute("DELETE FROM airports")

    def test_mismatched_provenance_is_rejected(self):
        with sqlite3.connect(self.path) as db:
            db.execute("UPDATE navdata_import_batches SET airac_cycle='2611'")
        with self.assertRaisesRegex(CatalogError,'PROVENANCE'):
            NavCatalog(self.path)

    def test_missing_index_is_rejected(self):
        with sqlite3.connect(self.path) as db:
            db.execute('DROP INDEX idx_waypoints_ident')
        with self.assertRaisesRegex(CatalogError,'INDEX_MISSING'):
            NavCatalog(self.path)

    def test_exec_legs_are_rejected(self):
        with sqlite3.connect(self.path) as db:
            db.execute('INSERT INTO procedure_legs VALUES (1)')
        with self.assertRaisesRegex(CatalogError,'UNEXPECTED_EXECUTABLE'):
            NavCatalog(self.path)

if __name__ == '__main__': unittest.main()
