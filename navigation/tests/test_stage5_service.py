"""Synthetic-only Stage5 backend smoke tests; no copyrighted navigation source."""
import sys
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
import sqlite3,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from npe_stage5_server import Stage5Service, Stage5Error
from flight_plan_engine import AIRAC_MARKER,VERSION

class ServerTests(unittest.TestCase):
    def setUp(self):
        self.d=TemporaryDirectory();self.db=Path(self.d.name)/'t.sqlite'
        self.conn=sqlite3.connect(self.db)
        self.conn.executescript('''CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
          CREATE TABLE plans(id INTEGER PRIMARY KEY,origin TEXT NOT NULL,destination TEXT NOT NULL,
             airac TEXT NOT NULL,status TEXT NOT NULL,discontinuities INTEGER NOT NULL,payload_json TEXT NOT NULL);
          CREATE TABLE plan_items(plan_id INTEGER,seq INTEGER,item_type TEXT,label TEXT,record_json TEXT,PRIMARY KEY(plan_id,seq));''')
        for k,v in [('version',VERSION),('airac','2610'),('source_marker',AIRAC_MARKER),('fmc_status','NOT_EXECUTABLE')]:
            self.conn.execute('INSERT INTO meta VALUES(?,?)',(k,v))
        self.p={'engine':VERSION,'airac':'2610','source_marker':AIRAC_MARKER,
                'origin':'ZZAA','destination':'ZZBB','fmc_legs_activated':0,'autopilot_guidance_enabled':False,
                'status':'DRAFT_WITH_DISCONTINUITIES_NOT_FMC_EXECUTABLE','items':[
                 {'type':'AIRPORT','label':'ZZAA','fmc_status':'NOT_EXECUTABLE'},
                 {'type':'AIRPORT','label':'ZZBB','fmc_status':'NOT_EXECUTABLE'}],
                'qa':{'discontinuity_count':0}}
        self.conn.execute('INSERT INTO plans VALUES(1,?,?,?,?,?,?)',('ZZAA','ZZBB','2610',self.p['status'],0,json.dumps(self.p)))
        self.conn.commit();self.conn.close()
    def tearDown(self):self.d.cleanup()
    def test_stage4_private_db(self):
        s=Stage5Service(self.db)
        self.assertFalse(s.status()['compose_enabled'])
        self.assertEqual(s.plans()[0]['origin'],'ZZAA')
        self.assertEqual(s.plan(1)['origin'],'ZZAA')
        with self.assertRaises(Stage5Error):s.compose({'origin':'ZZAA','destination':'ZZBB'})
    def test_tampered_activation_rejected(self):
        s=Stage5Service(self.db)
        bad={**self.p,'fmc_legs_activated':1}
        with self.assertRaises(Stage5Error):s.guard(bad)
    def test_source_marker_is_mandatory(self):
        with self.assertRaises(Exception):
            with sqlite3.connect(self.db) as conn:
                conn.execute("UPDATE meta SET value='//AIRAC Cycle : 2609' WHERE key='source_marker'")
            Stage5Service(self.db)
if __name__=='__main__':unittest.main()