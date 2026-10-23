"""Stage 7 safety gates and real source integration. Requires private test databases locally."""
import copy
import os
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from procedure_reference_leg_engine import (compile_reference,LegReferenceError,
                                             _raw_token_integrity,_fix_position,_validate_batch,VERSION)
from npe_stage7_server import Stage7Service

PRIVATE=Path(os.environ.get('NPE_STAGE7_PRIVATE_DIR','/unavailable-private-navdb'))
DB=PRIVATE/'stage1.sqlite'

class UnitGates(unittest.TestCase):
 def test_source_token_integrity_rejects_omission(self):
  nodes=[{'raw':'FIX RUS','token_start':0,'token_end_exclusive':2}]
  with self.assertRaisesRegex(LegReferenceError,'omits'):_raw_token_integrity('FIX RUS FIX DHN',nodes)
 def test_source_token_integrity_rejects_wrong_raw(self):
  with self.assertRaisesRegex(LegReferenceError,'mismatch'):_raw_token_integrity('FIX RUS',[{'raw':'FIX WRONG','token_start':0,'token_end_exclusive':2}])
 def test_source_token_integrity_valid(self):
  _raw_token_integrity('FIX RUS FIX DHN',[{'raw':'FIX RUS','token_start':0,'token_end_exclusive':2},{'raw':'FIX DHN','token_start':2,'token_end_exclusive':4}])
 def test_missing_local_fix_is_unresolved(self):
  self.assertEqual(_fix_position({},'NOTEXIST'),(None,'LOCAL_FIX_ABSENT'))
 def test_duplicate_position_conflict_fails(self):
  m={'X':[{'ident':'X','lat':31,'lon':51,'post_marker_line':1},{'ident':'X','lat':32,'lon':51,'post_marker_line':2}]}
  self.assertEqual(_fix_position(m,'X'),(None,'LOCAL_FIX_DUPLICATE_COORDINATE_CONFLICT'))
 def test_identical_duplicate_is_resolvable(self):
  m={'X':[{'ident':'X','lat':31,'lon':51,'post_marker_line':1},{'ident':'X','lat':31,'lon':51,'post_marker_line':2}]}
  self.assertIsNone(_fix_position(m,'X')[1])

@unittest.skipUnless(DB.exists(),'Private Stage1 DB unavailable')
class PrivateSourceRealTests(unittest.TestCase):
 def test_daxi1a_sourced_chord(self):
  result=compile_reference(DB,'OIII','SID','DAXI1A',runway='29R')
  self.assertEqual(result['version'],VERSION)
  self.assertEqual(result['qa']['reference_chords'],1)
  c=result['segments'][0]['reference_chords'][0]
  self.assertEqual((c['from'],c['to']),('RUS','DAXIL'))
  self.assertEqual(c['arinc_path_terminator'],None)
  self.assertFalse(c['fmc_executable'])
  self.assertEqual(result['arinc_legs'],[])
  self.assertEqual(result['afds_commands'],[])
 def test_dhn2c_does_not_join_through_turn(self):
  result=compile_reference(DB,'OIII','SID','DHN2C',runway='29R')
  types=[e['kind'] for s in result['segments'] for e in s['events']]
  self.assertIn('TURN_DIRECT',types)
  self.assertEqual(result['qa']['reference_chords'],0)
 def test_unknown_runway_fails(self):
  with self.assertRaises(Exception):compile_reference(DB,'OIII','SID','DAXI1A',runway='31L')
 def test_missing_airac_procedure_fails(self):
  with self.assertRaises((LookupError,ValueError)):compile_reference(DB,'OIII','SID','NOTEXIST',runway='29R')
 def test_multiple_runways_require_explicit_choice(self):
  with self.assertRaisesRegex(LegReferenceError,'Explicit runway'):
   compile_reference(DB,'OIII','SID','DAXI1A')
 def test_incomplete_source_is_quarantined(self):
  import sqlite3
  with sqlite3.connect(DB) as con:
   x=con.execute("SELECT ident,kind FROM procedures WHERE airport_icao='ZYYJ' ORDER BY id LIMIT 1").fetchone()
  if x:
   with self.assertRaises((ValueError,LookupError,LegReferenceError)):
    compile_reference(DB,'ZYYJ',x[1],x[0])
 def test_private_service_validation(self):
  service=Stage7Service(PRIVATE/'stage4.sqlite',DB,PRIVATE/'stage2.sqlite',PRIVATE/'stage3.sqlite')
  result=service.procedure_reference('OIII','SID','DAXI1A',runway='29R')
  self.assertEqual(result['qa']['reference_chords'],1)
  self.assertFalse(result['fmc_executable'])

if __name__=='__main__':unittest.main()