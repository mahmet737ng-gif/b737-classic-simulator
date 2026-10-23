import sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from npe_stage9_training_aircraft import KinematicTrainingAircraft,simulate
from npe_stage9_guidance import ReferenceGuidance
from test_npe_stage9_guidance import make_ref

class SandboxClosedLoop(unittest.TestCase):
 def test_physics_straight(self):
  a=KinematicTrainingAircraft(lat=35,lon=50,true_track_deg=90,gs_kt=200)
  x=a.advance({'mode':'OFF','sim_fd_bank_preview_deg':None},1)
  self.assertGreater(x['lon'],50)
  self.assertEqual(x['real_aircraft_command'],None)
 def test_turn_direction(self):
  a=KinematicTrainingAircraft(lat=35,lon=50,true_track_deg=90,gs_kt=180)
  x=a.advance({'mode':'SIM_REFERENCE_TRACK','sim_fd_bank_preview_deg':10},1)
  self.assertGreater(x['true_track_deg'],90)
 def test_closed_loop_lateral_capture(self):
  g=ReferenceGuidance(make_ref());g.arm(True)
  a=KinematicTrainingAircraft(lat=34.988,lon=50.04,true_track_deg=90,gs_kt=180)
  history=simulate(g,a,frames=200,dt_s=1)
  values=[abs(v['guidance'].get('signed_cross_track_nm',999)) for v in history if v['guidance']['mode']=='SIM_REFERENCE_TRACK']
  self.assertGreater(len(values),60)
  self.assertLess(values[-1],values[0])
  self.assertLess(values[-1],.5)
  self.assertTrue(all(x['aircraft']['real_aircraft_command'] is None for x in history))

if __name__=='__main__':unittest.main()