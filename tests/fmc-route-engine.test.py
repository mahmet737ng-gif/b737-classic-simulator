#!/usr/bin/env python3
"""All public test fixtures are synthetic, no restricted navdata included."""
import json
from pathlib import Path
import sqlite3
import sys
import tempfile
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'navigation'))
from fmc_route_engine import NavigationEngine, NavError, AIRAC_MARKER

class TestRouteEngine(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.path=Path(self.temp.name)/'test.sqlite'
        with sqlite3.connect(self.path) as db:
            db.executescript('''
              create table metadata(key text primary key,value text);
              create table npe_decoder_runs(source_marker text);
              create table airports(icao text,lat real,lon real,source_file text,source_line int);
              create table waypoints(ident text,lat real,lon real,source_file text,source_line int);
              create table navaids(ident text,lat real,lon real,source_file text,source_line int);
              create table airways(ident text,seq int,fix_ident text,lat real,lon real,source_file text,source_line int);
              create table procedures(id integer,airport_icao text,kind text,ident text);
              create table npe_decoded_procedures(procedure_id integer,parse_status text,fmc_status text,runway_reference_json text,transition_labels_json text);
              create table navdata_procedure_details(procedure_id integer,file_id integer);
              create table navdata_procedure_files(id integer,archive_member text,post_marker_sha256 text);
              create table navdata_procedure_segments(id integer,procedure_id int,seq int,segment_kind text,qualifier text,expression text,post_marker_line int);
            ''')
            db.executemany('insert into metadata values(?,?)',[('cycle','2610'),('scope','WORLDWIDE')])
            db.execute('insert into npe_decoder_runs values(?)',(AIRAC_MARKER,))
            db.executemany('insert into airports values(?,?,?,?,?)',[('AAAA',0,0,'synthetic-airport',1),('BBBB',0,4,'synthetic-airport',2)])
            db.executemany('insert into waypoints values(?,?,?,?,?)',[('FIXA',0,1,'synthetic-fix',1),('FIXB',0,2,'synthetic-fix',2),('FIXC',0,3,'synthetic-fix',3)])
            db.executemany('insert into airways values(?,?,?,?,?,?,?)', [('X10',1,'FIXA',0,1,'synthetic-airway',1),('X10',2,'FIXB',0,2,'synthetic-airway',2),('X10',3,'FIXC',0,3,'synthetic-airway',3)])
            db.execute('insert into procedures values(1,"AAAA","SID","TEST1A")')
            db.execute('insert into npe_decoded_procedures values(1,"SOURCE_TOKEN_DECODED","NOT_EXECUTABLE_UNTIL_VERIFIED",?,?)',(json.dumps(['01']),json.dumps(['FIXC'])))
            db.execute('insert into navdata_procedure_files values(1,"SidStars/AAAA.txt","fakefixturehash")')
            db.execute('insert into navdata_procedure_details values(1,1)')
            db.executemany('insert into navdata_procedure_segments values(?,?,?,?,?,?,?)',[(1,1,0,'BASE',None,'FIX FIXA FIX FIXB',4),(2,1,1,'TRANSITION','FIXC','FIX FIXC',5)])
        self.engine=NavigationEngine(self.path)
    def tearDown(self):
        self.engine.close();self.temp.cleanup()
    def test_direct(self):
        r=self.engine.route({'origin':'AAAA','destination':'BBBB','via':[{'type':'DCT','to':'FIXA'}]})
        self.assertEqual([x['to'] for x in r['legs']],['FIXA','BBBB'])
        self.assertFalse(r['fmcExecutable']);self.assertGreater(r['totalDistanceNm'],200)
        self.assertAlmostEqual(r['legs'][0]['trueInitialTrackDeg'],90,delta=.01)
    def test_airway(self):
        r=self.engine.route({'origin':'AAAA','destination':'BBBB','via':[{'type':'DCT','to':'FIXA'}, {'type':'AIRWAY','airway':'X10','to':'FIXC'}]})
        self.assertEqual([x['to'] for x in r['legs']],['FIXA','FIXB','FIXC','BBBB'])
        self.assertEqual(r['legs'][2]['via'],'X10')
    def test_reject_gaps(self):
        with self.assertRaises(NavError) as cm:self.engine.route({'origin':'AAAA','destination':'BBBB','via':[{'type':'AIRWAY','airway':'X10','to':'FIXC'}]})
        self.assertEqual(cm.exception.code,'AIRWAY_DISCONNECTED')
    def test_reject_unrecognized(self):
        with self.assertRaises(NavError) as cm:self.engine.route({'origin':'AAAA','destination':'BBBB','via':[{'type':'PROCEDURE','name':'TEST1A'}]})
        self.assertEqual(cm.exception.code,'UNSUPPORTED_SEGMENT')
    def test_reject_ambiguous_fix(self):
        self.engine.db.execute('PRAGMA query_only=OFF')
        # read-only source must refuse mutation
        with self.assertRaises(sqlite3.OperationalError):
            self.engine.db.execute('insert into waypoints values("FIXA",0,1.1,"fixture",4)')
    def test_catalog_and_runway_validation(self):
        self.assertEqual(len(self.engine.procedure_catalog('AAAA','SID')),1)
        preview=self.engine.procedure_preview('AAAA','SID','TEST1A',runway='01',transition='FIXC')
        self.assertFalse(preview['readyForFMC']);self.assertEqual(len(preview['segments']),2)
        with self.assertRaises(NavError):self.engine.procedure_preview('AAAA','SID','TEST1A',runway='19')
    def test_marker_gate(self):
        self.engine.close()
        with sqlite3.connect(self.path) as db:db.execute('update npe_decoder_runs set source_marker="FAKE"')
        with self.assertRaises(NavError) as cm:NavigationEngine(self.path)
        self.assertEqual(cm.exception.code,'AIRAC_PROVENANCE')
        self.engine=NavigationEngine.__new__(NavigationEngine);self.engine.db=sqlite3.connect(':memory:');self.engine.geo=None
    def test_empty_route(self):
        with self.assertRaises(NavError):self.engine.route({'origin':'AAAA','destination':'BBBB','via':[]})

if __name__=='__main__':unittest.main(verbosity=2)