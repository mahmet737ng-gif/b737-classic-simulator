"""Stage6 source selector tests; synthetic conditions, optional private real fixture."""
import json
import os
from pathlib import Path
import sys
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from procedure_semantics import RISKS, ProcedureGateError, catalog
from npe_stage6_server import Stage6Service,STAGE3_MEMBERS, safe_extract_known

ROOT=Path(__file__).resolve().parents[1]

class SemanticUnit(unittest.TestCase):
 def test_known_types_default_nonexecutability(self):
  self.assertEqual(RISKS['FIX_PASSAGE'],'PATH_TERMINATOR_TF_DF_CF_NOT_PROVEN')
  self.assertIn('NOT_PROVEN',RISKS['RADIAL_INTERCEPT'])
 def test_reject_invalid_icao_and_kind_before_db_open(self):
  with self.assertRaises(ProcedureGateError):catalog('unused.sqlite','XX','SID')
  with self.assertRaises(ProcedureGateError):catalog('unused.sqlite','OIII','INVALID')
 def test_reject_unexpected_zip_member(self):
  import tempfile,zipfile
  with tempfile.TemporaryDirectory() as tmp:
   p=Path(tmp);a=p/'a.zip'
   with zipfile.ZipFile(a,'w') as z:z.writestr('unexpected','x')
   with self.assertRaises(KeyError):safe_extract_known(a,{'private_data/missing.sqlite':'s.sqlite'},p)

@unittest.skipUnless(os.environ.get('NPE_STAGE6_PRIVATE_DIR'),'Private fixture not supplied')
class PrivateSource(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  p=Path(os.environ['NPE_STAGE6_PRIVATE_DIR'])
  cls.s=Stage6Service(p/'stage4.sqlite',p/'stage1.sqlite',p/'stage2.sqlite',p/'stage3.sqlite')
 def test_catalogue_iran_and_global(self):
  a=self.s.catalog('OIII','SID');self.assertEqual(a['airac'],'2610');self.assertEqual(a['fmc_executable'],False)
  self.assertTrue(any(x['ident']=='DAXI1A' for x in a['items']))
  b=self.s.catalog('OIMM','APP');self.assertTrue(any(x['ident']=='ILS31RY' for x in b['items']))
 def test_source_semantic_report(self):
  d=self.s.semantics('OIII','SID','DAXI1A','29R')
  self.assertEqual(d['arinc_leg_count'],0)
  self.assertFalse(d['fmc_executable']);self.assertIn('TRACK_FRAME_AND_TERMINATION_NOT_PROVEN',d['blocking_reasons'])
  self.assertTrue(all(x['post_marker_line']>0 for x in d['source_lines']))
 def test_same_source_recompose(self):
  original=self.s.plan(self.s.plan_ids[0]);output=self.s.selection_compose({'plan_id':self.s.plan_ids[0],'selections':{}})
  self.assertEqual(output['qa']['discontinuity_count'],original['qa']['discontinuity_count'])
  self.assertEqual(output['qa']['airway_fix_row_count'],original['qa']['airway_fix_row_count'])
  self.assertFalse(output['autopilot_guidance_enabled']);self.assertEqual(output['fmc_legs_activated'],0)
 def test_changed_real_sid_selection(self):
  result=self.s.selection_compose({'plan_id':self.s.plan_ids[0],
      'selections':{'SID':{'ident':'DHN2C','runway':'29R'}}})
  self.assertEqual(result['selected_departure']['ident'],'DHN2C')
  self.assertEqual(result['selected_departure']['selected_runway'],'29R')
  self.assertGreaterEqual(result['qa']['discontinuity_count'],3)
 def test_reject_bad_runway_and_transition(self):
  with self.assertRaises(Exception):self.s.selection_compose({'plan_id':self.s.plan_ids[0],
    'selections':{'SID':{'ident':'DAXI1A','runway':'31L'}}})
  with self.assertRaises(Exception):self.s.selection_compose({'plan_id':self.s.plan_ids[0],
    'selections':{'APP':{'ident':'ILS31RY','runway':'31R','transition':'NOTEXIST'}}})
 def test_reject_wrong_plan_id(self):
  with self.assertRaises(Exception):self.s.selection_compose({'plan_id':9999999,'selections':{}})
 def test_approach_conflict_remains_blocked(self):
  with self.assertRaises(Exception):self.s.selection_compose({'plan_id':self.s.plan_ids[0],
    'selections':{'STAR':{'ident':'ALMU1N.13L','runway':'13L'}}})

if __name__=='__main__':unittest.main()