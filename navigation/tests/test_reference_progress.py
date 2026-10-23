"""Stage8 synthetic and REAL USER PRIVATE Stage4 source-fixture tests."""
import copy,json,math,sys,unittest,zipfile,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from reference_progress import candidates,analyze,MonitorError,safe_plan,coord

ARCHIVE=os.environ.get('NPE_STAGE4_PRIVATE_ZIP')

def source():
    # Entirely synthetic coordinates and fixes; no licensed data checked into GitHub.
    def item(kind,label,lat=None,lon=None,dist=None):
        v={'type':kind,'label':label,'fmc_status':'NOT_EXECUTABLE'}
        if kind=='FIX':v.update(lat=lat,lon=lon,reference_leg_distance_nm=dist)
        return v
    return {'engine':'NPE_STAGE4_FLIGHT_PLAN_DRAFT_v1','airac':'2610',
        'source_marker':'//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1',
        'origin':'ZZAA','destination':'ZZBB',
        'status':'DRAFT_WITH_DISCONTINUITIES_NOT_FMC_EXECUTABLE',
        'fmc_legs_activated':0,'autopilot_guidance_enabled':False,
        'items':[item('AIRPORT','ZZAA'),
          item('DISCONTINUITY','ROUTE DISCONTINUITY'),
          item('FIX','ALFAA',0.,0.),item('FIX','BETAA',0.,1.,60.04),
          item('FIX','GAMMA',1.,1.,60.04),
          item('DISCONTINUITY','ROUTE DISCONTINUITY'),
          item('FIX','DELTA',2.,2.),item('AIRPORT','ZZBB')],
        'qa':{'discontinuity_count':2}}

class Stage8RefTests(unittest.TestCase):
    def setUp(self):self.plan=source()
    def test_synthetic_edges_and_gaps(self):
        self.assertEqual(len(candidates(self.plan)),2)
        self.assertEqual(self.plan['qa']['discontinuity_count'],2)
    @unittest.skipUnless(ARCHIVE and Path(ARCHIVE).is_file(),'Private source ZIP only')
    def test_real_private_stage4_source_10_edges_4_gaps(self):
        with zipfile.ZipFile(ARCHIVE) as z:
            p=json.loads(z.read('NPE_STAGE4/sample_flight_plan_PRIVATE.json'))
        self.assertEqual(len(candidates(p)),10)
        self.assertEqual(p['qa']['discontinuity_count'],4)
    def test_first_ref_at_start_has_zero_cross_track(self):
        edge=candidates(self.plan)[0]
        a=analyze(self.plan,edge['to_item_index'],edge['start']['lat'],edge['start']['lon'])
        self.assertAlmostEqual(a['cross_track_nm_right_positive'],0.,places=3)
        self.assertAlmostEqual(a['along_track_nm'],0.,places=3)
        self.assertAlmostEqual(a['direct_distance_to_fix_nm'],edge['length_nm'],delta=.002)
    def test_end_reference(self):
        edge=candidates(self.plan)[0]
        a=analyze(self.plan,edge['to_item_index'],edge['end']['lat'],edge['end']['lon'])
        self.assertAlmostEqual(a['direct_distance_to_fix_nm'],0.,places=3)
        self.assertAlmostEqual(a['along_track_nm'],edge['length_nm'],delta=.002)
    def test_normal_geodetic_position_and_guidance_empty(self):
        a=analyze(self.plan,3,0.1,0.2)
        self.assertEqual(a['reference_phase'],'ON_REFERENCE_SPAN')
        self.assertEqual(a['status'],'REFERENCE_ADVISORY_ONLY_NO_AUTO_SEQUENCING')
        self.assertEqual(a['lnav_commands'],[]);self.assertEqual(a['afds_commands'],[])
        self.assertFalse(a['fmc_executable'])
    def test_all_source_gaps_have_no_auto_refs(self):
        refs={x['to_item_index'] for x in candidates(self.plan)}
        for i,item in enumerate(self.plan['items']):
            if item['type']=='DISCONTINUITY':
                self.assertNotIn(i,refs);self.assertNotIn(i+1,refs)
                with self.assertRaises(MonitorError):analyze(self.plan,i,35,51)
    def test_manual_leg_index_only(self):
        with self.assertRaises(MonitorError):analyze(self.plan,3.0,35,51)
        with self.assertRaises(MonitorError):analyze(self.plan,5,35,51)
    def test_reject_invented_typed_execution(self):
        x=copy.deepcopy(self.plan);x['fmc_legs_activated']=1
        with self.assertRaises(MonitorError):candidates(x)
        x=copy.deepcopy(self.plan);x['autopilot_guidance_enabled']=True
        with self.assertRaises(MonitorError):candidates(x)
    def test_reject_wrong_airac_and_source_marker(self):
        for key,v in [('airac','2609'),('source_marker','//bogus')]:
            x=copy.deepcopy(self.plan);x[key]=v
            with self.assertRaises(MonitorError):candidates(x)
    def test_reject_removed_gap(self):
        x=copy.deepcopy(self.plan);x['items']=[item for item in x['items'] if item['type']!='DISCONTINUITY']
        with self.assertRaises(MonitorError):candidates(x)
    def test_reject_bad_reference_course_distance(self):
        x=copy.deepcopy(self.plan);x['items'][3]['reference_leg_distance_nm']+=20
        with self.assertRaises(MonitorError):candidates(x)
    def test_reject_missing_reference_distance(self):
        x=copy.deepcopy(self.plan);x['items'][3]['reference_leg_distance_nm']=None
        with self.assertRaises(MonitorError):candidates(x)
    def test_reject_nan_infinity_bad_types(self):
        for v in [float('nan'),float('inf'),'35.5',True]:
            with self.assertRaises(MonitorError):coord(v,51)
    def test_wrong_ownship_coordinates(self):
        with self.assertRaises(MonitorError):analyze(self.plan,3,91,51)
    def test_dateline_crossing_synthetic_reference(self):
        x=copy.deepcopy(self.plan)
        a=x['items'][2];b=x['items'][3]
        a.update(lat=0.,lon=179.8)
        b.update(lat=0.,lon=-179.8,reference_leg_distance_nm=24.016)
        x['items']=[x['items'][0],a,b,x['items'][-1]]
        x['qa']['discontinuity_count']=0
        r=candidates(x)
        self.assertEqual(len(r),1)
        self.assertAlmostEqual(r[0]['length_nm'],24.016,delta=.02)
    def test_signed_cross_track_symmetry_synthetic(self):
        x=copy.deepcopy(self.plan)
        x['items']=[x['items'][0],x['items'][2],x['items'][3],x['items'][-1]]
        x['qa']['discontinuity_count']=0
        north=analyze(x,2,0.1,0.5);south=analyze(x,2,-0.1,0.5)
        self.assertLess(north['cross_track_nm_right_positive'],0)
        self.assertGreater(south['cross_track_nm_right_positive'],0)
        self.assertAlmostEqual(abs(north['cross_track_nm_right_positive']),abs(south['cross_track_nm_right_positive']),delta=.002)

if __name__=='__main__':unittest.main()