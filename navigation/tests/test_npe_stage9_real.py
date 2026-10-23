import json,unittest,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from npe_stage8 import Stage8Error
from npe_stage8_server import PrivatePlanStore
from npe_stage9_guidance import ReferenceGuidance,MODE_TRACK,MODE_END

class PrivateRealDataTest(unittest.TestCase):
 def test_real_iran_plan_guidance(self):
  import os
  path=os.environ.get('NPE_STAGE9_PRIVATE_STAGE4')
  if not path or not Path(path).exists():self.skipTest('Requires local PRIVATE Stage4 SQLite')
  db=PrivatePlanStore(path)
  try:ref=db.reference(1)
  finally:db.close()
  self.assertEqual(len(ref['reference_chords']),10)
  self.assertEqual(len(ref['gaps']),4)
  g=ReferenceGuidance(ref);g.arm(True)
  leg=ref['reference_chords'][0]
  lat,lon=leg['from_point'];out=g.step({'source':'SIMULATOR_INTERNAL','integrity':'VALID',
    'lat':lat+.01,'lon':lon+.01,'gs_kt':220,'track_true_deg':leg['true_course_deg'],'sim_time_s':1})
  self.assertEqual(out['mode'],MODE_TRACK)
  self.assertEqual(out['from'],'RUS');self.assertEqual(out['to'],'TRN')
  self.assertLess(abs(out['signed_cross_track_nm']),1)
  self.assertFalse(out['fmc_legs_executable'])
  last=ref['reference_chords'][-1]
  h=ReferenceGuidance(ref,9);h.arm(True)
  end=h.step({'source':'SIMULATOR_INTERNAL','integrity':'VALID',
     'lat':last['to_point'][0],'lon':last['to_point'][1],
     'gs_kt':220,'track_true_deg':last['true_course_deg'],'sim_time_s':1})
  self.assertEqual(end['mode'],MODE_END)
  self.assertEqual(end['afds_commands'],[])

if __name__=='__main__':unittest.main()