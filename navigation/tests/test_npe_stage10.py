import sys,unittest,zipfile,json
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from npe_stage8 import Stage8Error,stage4_reference_chords
from npe_stage10_bus import AircraftStateBus,normalize_aircraft_frame,ADAPTER
from npe_stage10_live import LiveReferenceSession,AFDSReferencePort

from npe_stage8 import AIRAC, AIRAC_MARKER, distance_nm, course_true, VERSION as STAGE8_VERSION
import os

def synthetic_stage4_plan():
    def fix(name,lat,lon,seq,dist=None):
        return {'type':'FIX','label':name,'via':'T1','lat':lat,'lon':lon,
           'source_file':'SYNTHETIC_TEST_REFERENCE','source_line':seq+1,'airway_seq':seq,
           'reference_leg_distance_nm':dist,'fmc_status':'NOT_EXECUTABLE'}
    p1=(35.,51.);p2=(35.3,51.1);p3=(35.6,51.2)
    p4=(35.7,51.3);p5=(35.9,51.5)
    return {'airac':AIRAC,'source_marker':AIRAC_MARKER,'origin':'ZZAA','destination':'ZZBB',
      'fmc_legs_activated':0,'autopilot_guidance_enabled':False,
      'items':[fix('PT01',*p1,1),fix('PT02',*p2,2,distance_nm(p1,p2)),
              fix('PT03',*p3,3,distance_nm(p2,p3)),
              {'type':'DISCONTINUITY','label':'ROUTE DISCONTINUITY',
                'required_action':'EXPLICIT_VERIFY_AND_RESOLVE','reason':'UNVERIFIED_BOUNDARY'},
              fix('PT04',*p4,4),fix('PT05',*p5,5,distance_nm(p4,p5))]}

def route():
    return stage4_reference_chords(synthetic_stage4_plan())

def real_private_route_optional():
    path=os.environ.get('NPE_STAGE10_PRIVATE_STAGE4_ZIP')
    if not path or not Path(path).exists():return None
    with zipfile.ZipFile(path) as z:
        plan=json.loads(z.read('NPE_STAGE4/sample_flight_plan_PRIVATE.json'))
    return stage4_reference_chords(plan)

def sample(ref=None,t=10):
    r=ref or route();leg=r['reference_chords'][0]
    lat,lon=leg['from_point']
    true=leg['true_course_deg']
    return {'adapter_id':ADAPTER,'source':'SIMULATOR_INTERNAL','integrity':'VALID',
      'position_source':'IRS','sensors':{'irs_aligned':True,'gps_valid':True,'position_integrity':'VALID'},
      'lat':lat,'lon':lon,'gs_kt':210,'track_true_deg':true,
      'heading_true_deg':true,'heading_magnetic_deg':true-3,'magnetic_variation_deg':3,
      'pressure_alt_ft':12000,'vertical_speed_fpm':0,'pitch_deg':2,'bank_deg':0,'sim_time_s':t}

class TestPrivateRealSource(unittest.TestCase):
    def test_optional_private_iran_source(self):
        private=real_private_route_optional()
        if private is None:self.skipTest('Private NAVDATA fixture not checked into public GitHub')
        self.assertEqual(len(private['reference_chords']),10)
        self.assertEqual(len(private['gaps']),4)

class TestBus(unittest.TestCase):
    def test_all_fields_and_snapshot_isolation(self):
        b=AircraftStateBus(clock=lambda:100.)
        self.assertEqual(b.publish(sample())['sequence'],1)
        a=b.snapshot();self.assertIn('pressure_alt_ft',a['aircraft'])
        a['aircraft']['sensors']['irs_aligned']=False
        self.assertTrue(b.snapshot()['aircraft']['sensors']['irs_aligned'])
    def test_invalid_adapter(self):
        x=sample();x['adapter_id']='UNKNOWN'
        with self.assertRaises(Stage8Error):normalize_aircraft_frame(x)
    def test_irs_failed_no_inference(self):
        x=sample();x['sensors']['irs_aligned']=False
        with self.assertRaises(Stage8Error):normalize_aircraft_frame(x)
    def test_gps_as_explicit_alternative(self):
        x=sample();x['position_source']='GPS';x['sensors']['irs_aligned']=False
        self.assertEqual(normalize_aircraft_frame(x)['position_source'],'GPS')
    def test_invalid_magnetic_heading(self):
        x=sample();x['heading_magnetic_deg']=180
        with self.assertRaises(Stage8Error):normalize_aircraft_frame(x)
    def test_invalid_numeric_nan(self):
        x=sample();x['lat']=float('nan')
        with self.assertRaises(Stage8Error):normalize_aircraft_frame(x)
    def test_monotonic_and_invalidate_bad_frame(self):
        b=AircraftStateBus(clock=lambda:0);b.publish(sample(t=10))
        with self.assertRaises(Stage8Error):b.publish(sample(t=10))
        with self.assertRaises(Stage8Error):b.snapshot()
    def test_freshness_expiry(self):
        clock=[20];b=AircraftStateBus(max_age_s=1.5,clock=lambda:clock[0]);b.publish(sample())
        clock[0]=22
        with self.assertRaises(Stage8Error):b.snapshot()
    def test_low_gs_advisory_blocked(self):
        x=sample();x['gs_kt']=10
        b=AircraftStateBus(clock=lambda:4);b.publish(x)
        with self.assertRaises(Stage8Error):b.stage9_sensor()

class TestLive(unittest.TestCase):
    def test_explicit_arm(self):
        s=LiveReferenceSession(route());s.ingest(sample());
        with self.assertRaises(Stage8Error):s.arm(False)
        self.assertTrue(s.disarmed)
    def test_healthy_step(self):
        s=LiveReferenceSession(route());s.ingest(sample());s.arm(True)
        f=s.frame();self.assertEqual(f['mode'],'SIM_REFERENCE_TRACK')
        self.assertTrue(f['reference_only']);self.assertEqual(f['afds_commands'],[])
        self.assertTrue(-20<=f['fd']['bank_preview_deg']<=20)
    def test_duplicate_frame_stops(self):
        s=LiveReferenceSession(route());s.ingest(sample());s.arm(True);s.frame()
        f=s.frame();self.assertEqual(f['mode'],'OFF');self.assertTrue(s.disarmed)
    def test_corrupted_telemetry_fails_open_never(self):
        s=LiveReferenceSession(route());s.ingest(sample());s.arm(True)
        x=sample(t=11);x['integrity']='FAILED'
        with self.assertRaises(Stage8Error):s.ingest(x)
        self.assertEqual(s.frame()['mode'],'OFF')
    def test_stale_telemetry_suspends(self):
        clock=[10];s=LiveReferenceSession(route(),clock=lambda:clock[0]);s.ingest(sample());s.arm(True)
        clock[0]=13;f=s.frame();self.assertEqual(f['mode'],'OFF')
    def test_hard_gap_end(self):
        r=route();leg=r['reference_chords'][0];group=leg['group']
        idx=max(i for i,x in enumerate(r['reference_chords']) if x['group']==group)
        s=LiveReferenceSession(r,initial_leg=idx)
        target=r['reference_chords'][idx]['to_point'];x=sample(r)
        x['lat'],x['lon']=target;s.ingest(x);s.arm(True)
        f=s.frame();self.assertEqual(f['mode'],'OFF')
        self.assertIn('MANDATORY_END',f['reason'])
    def test_afds_interface_always_denies(self):
        v=AFDSReferencePort.request_afds_engage();self.assertFalse(v['accepted'])
        self.assertEqual(v['afds_commands'],[])
    def test_explicit_disengage(self):
        s=LiveReferenceSession(route());s.ingest(sample());s.arm(True)
        self.assertEqual(s.disengage()['mode'],'OFF')
    def test_early_gs_does_not_arm(self):
        s=LiveReferenceSession(route());x=sample();x['gs_kt']=0;s.ingest(x)
        with self.assertRaises(Stage8Error):s.arm(True)
        self.assertTrue(s.disarmed)

if __name__=='__main__':unittest.main()