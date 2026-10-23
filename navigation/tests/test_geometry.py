import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]) if Path(__file__).parent.name=="tests" else str(Path(__file__).parent))
from pathlib import Path
import shutil
import sqlite3
import tempfile
import unittest

from route_geometry import (AIRAC_MARKER,build,coord_ok,distance_nm,true_initial_course,resolve)
from procedure_decoder import decode_expression
from geometry_reader import get_reference_geometry,verify_overlay

class GeometryTests(unittest.TestCase):
 def setUp(self):
  self.t=tempfile.TemporaryDirectory();root=Path(self.t.name)
  self.db=root/'stage1.sqlite';self.overlay=root/'stage2.sqlite'
  with sqlite3.connect(self.db) as c:
   c.executescript('''
   CREATE TABLE airports(icao TEXT,lat REAL,lon REAL);
   CREATE TABLE waypoints(id INTEGER,ident TEXT,lat REAL,lon REAL,source_line INTEGER);
   CREATE TABLE navaids(id INTEGER,ident TEXT,lat REAL,lon REAL,source_line INTEGER);
   CREATE TABLE runways(id INTEGER,airport_icao TEXT,runway_ident TEXT,lat REAL,lon REAL,source_line INTEGER);
   CREATE TABLE navdata_local_fixes(id INTEGER,file_id INTEGER,ident TEXT,lat REAL,lon REAL,post_marker_line INTEGER);
   CREATE TABLE navdata_import_batches(marker TEXT,airac_cycle TEXT);
   CREATE TABLE npe_decoder_runs(source_marker TEXT,status TEXT);
   CREATE TABLE navdata_procedure_files(id INTEGER,airport_code TEXT,status TEXT,marker_relative_line INTEGER,archive_member TEXT,post_marker_sha256 TEXT);
   CREATE TABLE procedures(id INTEGER,airport_icao TEXT,kind TEXT,ident TEXT);
   CREATE TABLE navdata_procedure_details(procedure_id INTEGER,file_id INTEGER);
   CREATE TABLE navdata_procedure_segments(id INTEGER,procedure_id INTEGER,seq INTEGER,segment_kind TEXT,qualifier TEXT,post_marker_line INTEGER,expression TEXT);
   CREATE TABLE npe_decoded_segments(segment_id INTEGER,ast_json TEXT,decode_status TEXT);
   CREATE TABLE npe_decoded_procedures(procedure_id INTEGER,parse_status TEXT,runway_reference_json TEXT,transition_labels_json TEXT);
   CREATE TABLE procedure_legs(id INTEGER);
   ''')
   c.execute('INSERT INTO navdata_import_batches VALUES(?,?)',(AIRAC_MARKER,'2610'))
   c.execute('INSERT INTO npe_decoder_runs VALUES(?,?)',(AIRAC_MARKER,'SOURCE_AST_NON_EXECUTABLE'))
   c.execute('INSERT INTO airports VALUES(?,?,?)',('OIII',35.69,51.31))
   c.executemany('INSERT INTO waypoints VALUES(?,?,?,?,?)',[(31,'GLOB',35.9,51.9,1),(32,'DUP',35.4,51.5,2),(33,'DUP',35.6,51.6,3),(34,'XYZ',35.6,51.6,4)])
   c.execute('INSERT INTO navaids VALUES(?,?,?,?,?)',(40,'GLOB',35.9,51.9,15))
   c.execute('INSERT INTO runways VALUES(?,?,?,?,?,?)',(22,'OIII','29R',35.68,51.33,80))
   c.executemany('INSERT INTO navdata_local_fixes VALUES(?,?,?,?,?,?)',[(1,10,'ABC',35.5,51.5,3),(2,10,'XYZ',35.7,51.7,4),(3,11,'ABC',35.5,51.5,3)])
   c.executemany('INSERT INTO navdata_procedure_files VALUES(?,?,?,?,?,?)',[(10,'OIII','SOURCE_STRUCTURE_OK',1,'SidStars/OIII.txt','abc'),(11,'OIII','SOURCE_INCOMPLETE',1,'SidStars/OIII_BAD.txt','bad')])
   c.executemany('INSERT INTO procedures VALUES(?,?,?,?)',[(1,'OIII','SID','TEST1A'),(2,'OIII','SID','BAD1A')])
   c.executemany('INSERT INTO navdata_procedure_details VALUES(?,?)',[(1,10),(2,11)])
   c.executemany('INSERT INTO npe_decoded_procedures VALUES(?,?,?,?)',[(1,'SOURCE_TOKEN_DECODED','["29R"]','["ABC"]'),(2,'UNRESOLVED_OR_SOURCE_INCOMPLETE','[]','[]')])
   exprs=[(1,1,0,'BASE',None,'FIX ABC FIX XYZ FIX DUP TRK 285 UNTIL 4000 FIX GLOB HOLD AT FIX ABC LEFT TURN INBOUNDCOURSE 090 LEGDIST 4 FIX ABC RNW 29R'),
          (2,1,1,'TRANSITION','ABC','FIX ABC FIX XYZ'),
          (3,2,0,'BASE',None,'FIX ABC FIX XYZ')]
   for sid,pid,seq,skind,qual,expr in exprs:
    ast,issues=decode_expression(expr)
    assert not issues
    c.execute('INSERT INTO navdata_procedure_segments VALUES(?,?,?,?,?,?,?)',(sid,pid,seq,skind,qual,8,expr))
    c.execute('INSERT INTO npe_decoded_segments VALUES(?,?,?)',(sid,json.dumps(ast),'SOURCE_TOKEN_DECODED'))
 def tearDown(self):self.t.cleanup()
 def build(self):return build(self.db,self.overlay)
 def test_geodesic_dateline(self):
  self.assertAlmostEqual(distance_nm(0,179.9,0,-179.9),12.008,places=2)
  self.assertAlmostEqual(true_initial_course(0,179.9,0,-179.9),90,places=3)
 def test_geodesic_cardinals(self):
  self.assertAlmostEqual(distance_nm(0,0,1,0),60.04,places=1)
  self.assertAlmostEqual(true_initial_course(0,0,1,0),0,places=6)
  self.assertAlmostEqual(true_initial_course(0,0,0,-1),270,places=6)
 def test_geodesic_invalid(self):
  with self.assertRaises(ValueError):distance_nm(91,0,0,0)
  self.assertFalse(coord_ok(float('nan'),0))
 def test_in_place_not_allowed(self):
  with self.assertRaises(ValueError):build(self.db,self.db)
 def test_source_marker_rejection(self):
  with sqlite3.connect(self.db) as c:c.execute("UPDATE navdata_import_batches SET marker='//AIRAC Cycle : 2609'")
  with self.assertRaisesRegex(ValueError,'AIRAC'):self.build()
  self.assertFalse(self.overlay.exists())
 def test_local_scoped_priority_and_ambiguity(self):
  r=self.build();self.assertEqual(r['stats']['segments'],3)
  with sqlite3.connect(self.overlay) as c:
   c.row_factory=sqlite3.Row
   a=c.execute('SELECT * FROM point_nodes WHERE segment_id=1 AND node_seq=1').fetchone()
   self.assertEqual(a['resolution'],'LOCAL_AIRAC_FIX')
   self.assertAlmostEqual(a['lat'],35.7)
   dup=c.execute('SELECT * FROM point_nodes WHERE segment_id=1 AND node_seq=2').fetchone()
   self.assertEqual(dup['resolution'],'AMBIGUOUS_GLOBAL_IDENT');self.assertIsNone(dup['lat'])
   local=c.execute('SELECT * FROM point_nodes WHERE segment_id=1 AND node_seq=0').fetchone()
   self.assertEqual(local['source_table'],'navdata_local_fixes')
 def test_source_global_collocated_records(self):
  self.build()
  with sqlite3.connect(self.overlay) as c:
   r=c.execute('SELECT resolution,candidate_count FROM point_nodes WHERE segment_id=1 AND node_seq=4').fetchone()
   self.assertEqual(r,('GLOBAL_UNIQUE_NEAR_AIRPORT',2))
 def test_only_adjacent_explicit_fix_chords(self):
  self.build()
  with sqlite3.connect(self.overlay) as c:
   rows=c.execute('SELECT segment_id,first_node_seq,second_node_seq FROM reference_chords ORDER BY segment_id').fetchall()
   self.assertEqual(rows,[(1,0,1),(2,0,1)])
   self.assertEqual(c.execute('SELECT count(*) FROM reference_chords WHERE segment_id=3').fetchone()[0],0)
 def test_nongeo_gated(self):
  self.build()
  with sqlite3.connect(self.overlay) as c:
   r=c.execute('SELECT node_kind,status FROM geometry_events WHERE segment_id=1 ORDER BY node_seq').fetchall()
   self.assertIn(('TRACK','NOT_EXECUTABLE_UNTIL_SEMANTICS_VERIFIED'),r)
   self.assertIn(('HOLD','NOT_EXECUTABLE_UNTIL_SEMANTICS_VERIFIED'),r)
 def test_incomplete_source_quarantined(self):
  self.build()
  with sqlite3.connect(self.overlay) as c:
   self.assertEqual(c.execute("SELECT count(*) FROM point_nodes WHERE segment_id=3 AND resolution='QUARANTINED_INCOMPLETE_SOURCE' AND lat IS NULL").fetchone()[0],2)
   self.assertEqual(c.execute('SELECT count(*) FROM reference_chords WHERE segment_id=3').fetchone()[0],0)
 def test_reader_variant_separation_and_source_hash(self):
  self.build();res=get_reference_geometry(self.db,self.overlay,'OIII','SID','TEST1A',runway='29R',transition='ABC')
  self.assertEqual(len(res['geometry_segments']),2)
  self.assertEqual(res['fmc_status'],'NOT_EXECUTABLE_UNTIL_VERIFIED')
  self.assertEqual(len(res['geometry_segments'][0]['reference_chords']),1)
  with self.assertRaises(ValueError):get_reference_geometry(self.db,self.overlay,'OIII','SID','BAD1A')
 def test_reader_detects_altered_stage1(self):
  self.build()
  with sqlite3.connect(self.db) as c:c.execute('INSERT INTO airports VALUES(?,?,?)',('ZZZZ',0,0))
  with self.assertRaisesRegex(ValueError,'checksum'):verify_overlay(self.db,self.overlay)
 def test_atomic_previous_overlay_kept(self):
  self.build();prior=self.overlay.read_bytes()[:100]
  with sqlite3.connect(self.db) as c:c.execute('UPDATE navdata_import_batches SET marker=?',('OLD',))
  with self.assertRaises(ValueError):self.build()
  self.assertEqual(self.overlay.read_bytes()[:100],prior)

if __name__=='__main__':unittest.main()