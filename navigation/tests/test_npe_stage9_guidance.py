import unittest,sys,math,json,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from npe_stage8 import stage4_reference_chords,Stage8Error
from npe_stage9_guidance import ReferenceGuidance,MODE_ARMED,MODE_TRACK,MODE_HOLD,MODE_END,turn_preview_nm,vertical_constraint_preview,plan_valid

def make_ref(separate=False):
    def fix(name,lat,lon,seq,distance,ix):
        return dict(type='FIX',label=name,via='A1',lat=lat,lon=lon,source_file='test',source_line=ix,
          airway_seq=seq,reference_leg_distance_nm=distance,fmc_status='NOT_EXECUTABLE')
    from npe_stage8 import distance_nm
    a=(35.,50.);b=(35.,50.3);c=(35.25,50.3);d=(35.50,50.3)
    items=[fix('AAA',*a,1,None,1),fix('BBB',*b,2,round(distance_nm(a,b),3),2),fix('CCC',*c,3,round(distance_nm(b,c),3),3)]
    if separate:
       items+= [{'type':'DISCONTINUITY','required_action':'EXPLICIT_VERIFY_AND_RESOLVE','reason':'UNVERIFIED'}]
       items+= [fix('DDD',*d,4,None,4),fix('EEE',35.6,50.4,5,round(distance_nm(d,(35.6,50.4)),3),5)]
    p={'airac':'2610','source_marker':'//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1','fmc_legs_activated':0,'autopilot_guidance_enabled':False,'items':items}
    return stage4_reference_chords(p)

def sensor(lat=35,lon=50.15,t=1,track=90,gs=220,valid=True):
    return {'source':'SIMULATOR_INTERNAL','integrity':'VALID' if valid else 'FAILED',
            'lat':lat,'lon':lon,'sim_time_s':t,'track_true_deg':track,'gs_kt':gs}

class SimGuidance(unittest.TestCase):
 def test_provenance(self):
    x=make_ref();x['source_marker']='wrong'
    with self.assertRaises(Stage8Error):ReferenceGuidance(x)
 def test_starts_off(self):
    x=ReferenceGuidance(make_ref());self.assertEqual(x.step(sensor())['mode'],'OFF')
 def test_needs_explicit_consent(self):
    with self.assertRaises(Stage8Error):ReferenceGuidance(make_ref()).arm(False)
 def test_arm_without_auto_activation(self):
    x=ReferenceGuidance(make_ref());self.assertEqual(x.arm(True)['mode'],MODE_ARMED)
    self.assertIsNone(x._inert('safe')['desired_true_track_deg'])
 def test_centerline_track(self):
    g=ReferenceGuidance(make_ref());g.arm(True);v=g.step(sensor())
    self.assertEqual(v['mode'],MODE_TRACK);self.assertLess(abs(v['signed_cross_track_nm']),.01)
    self.assertAlmostEqual(v['desired_true_track_deg'],90,delta=1)
    self.assertEqual(v['aircraft_actuator_commands'],[])
 def test_right_of_track_commands_left(self):
    g=ReferenceGuidance(make_ref());g.arm(True);v=g.step(sensor(lat=34.98))
    # Eastbound -> south side is RIGHT; desired course should shift LEFT (counterclockwise)
    self.assertGreater(v['signed_cross_track_nm'],0)
    self.assertLess(v['desired_true_track_deg'],90)
 def test_left_of_track_commands_right(self):
    g=ReferenceGuidance(make_ref());g.arm(True);v=g.step(sensor(lat=35.02))
    self.assertLess(v['signed_cross_track_nm'],0)
    self.assertGreater(v['desired_true_track_deg'],90)
 def test_advance_inside_chain(self):
    g=ReferenceGuidance(make_ref());g.arm(True)
    v=g.step(sensor(lon=50.3, t=1))
    self.assertEqual(v['leg_index'],1);self.assertTrue(v['auto_sequenced_in_same_group'])
 def test_no_advance_across_gap(self):
    g=ReferenceGuidance(make_ref(separate=True),leg_index=1);g.arm(True)
    x=g.step(sensor(lat=35.25,lon=50.3,t=1))
    self.assertEqual(x['mode'],MODE_END);self.assertIsNone(x['desired_true_track_deg'])
    self.assertEqual(x['aircraft_actuator_commands'],[])
 def test_final_leg_stops(self):
    g=ReferenceGuidance(make_ref(),leg_index=1);g.arm(True)
    x=g.step(sensor(lat=35.25,lon=50.3,t=1))
    self.assertEqual(x['mode'],MODE_END)
 def test_bad_sensor_suspends(self):
    g=ReferenceGuidance(make_ref());g.arm(True);v=g.step(sensor(valid=False))
    self.assertEqual(v['mode'],MODE_HOLD);self.assertIsNone(v['sim_fd_bank_preview_deg'])
 def test_stale_sensor_suspends(self):
    g=ReferenceGuidance(make_ref());g.arm(True)
    g.step(sensor(t=1));v=g.step(sensor(t=20))
    self.assertEqual(v['mode'],MODE_HOLD)
 def test_duplicate_time_suspends(self):
    g=ReferenceGuidance(make_ref());g.arm(True)
    g.step(sensor(t=1));v=g.step(sensor(t=1))
    self.assertEqual(v['mode'],MODE_HOLD)
 def test_out_of_capture_suspends(self):
    g=ReferenceGuidance(make_ref());g.arm(True)
    v=g.step(sensor(lat=33.))
    self.assertEqual(v['mode'],MODE_HOLD)
 def test_no_turn_anticipation_without_proof(self):
    g=ReferenceGuidance(make_ref());g.arm(True);v=g.step(sensor())
    self.assertFalse(v['turn']['automatic_fly_by_turn_enabled'])
    self.assertGreater(v['turn']['lead_distance_nm_preview_only'],0)
 def test_turn_preview(self):
    self.assertAlmostEqual(turn_preview_nm(220,0,25),0)
    self.assertIsNone(turn_preview_nm(220,180,25))
 def test_no_vnav_without_evidence(self):
    self.assertFalse(vertical_constraint_preview(distance_nm_to_fix=8)['fmc_vnav_active'])
 def test_verified_constraint_preview_no_actuation(self):
    x=vertical_constraint_preview(distance_nm_to_fix=10, current_alt_ft=12000,
      constraint={'evidence':'VERIFIED_EXPLICIT_SOURCE','kind':'AT','altitude_ft':5000,
                  'source':{'file':'fixture','line':2},'speed_max_kt':250})
    self.assertEqual(x['state'],'SIMULATOR_CONSTRAINT_PREVIEW_ONLY')
    self.assertAlmostEqual(x['illustrative_three_degree_descent_altitude_ft'],8184,delta=8)
    self.assertIsNone(x['pitch_command_deg'])
 def test_unapproved_actuation_never_available(self):
    g=ReferenceGuidance(make_ref());g.arm(True)
    for i in range(1,6):
      v=g.step(sensor(lon=50.1+i*.01,t=i))
      self.assertFalse(v['fmc_legs_executable']);self.assertEqual(v['afds_commands'],[])

if __name__=='__main__':unittest.main()