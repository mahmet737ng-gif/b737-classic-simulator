"""Synthetic and private-fixture tests; no licensed navdata committed to GitHub."""
import os,sys,json,unittest,sqlite3
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from npe_stage8 import (AIRAC_MARKER,Stage8Error,validate_source_coded_leg,
                        stage4_reference_chords,reference_position,distance_nm)


def mini():
    def pt(name,lon,seq,via='A1'):
        return dict(type='FIX',label=name,lat=0.,lon=lon,source_file='wpNavRTE.txt',
                    source_line=seq+1,airway_seq=seq,via=via,reference_leg_distance_nm=None,
                    fmc_status='NOT_EXECUTABLE')
    def gap():
        return dict(type='DISCONTINUITY',label='ROUTE DISCONTINUITY',
                    reason='SOURCE_JUNCTION_UNVERIFIED',required_action='EXPLICIT_VERIFY_AND_RESOLVE')
    a,b,c,d=pt('AAA',0,1),pt('BBB',1,2),pt('CCC',2,3),pt('DDD',3,4)
    b['reference_leg_distance_nm']=distance_nm((0,0),(0,1))
    d['reference_leg_distance_nm']=distance_nm((0,2),(0,3))
    return dict(airac='2610',source_marker=AIRAC_MARKER,
                fmc_legs_activated=0,autopilot_guidance_enabled=False,
                items=[a,b,gap(),c,d],origin='XXXX',destination='YYYY')

class ReferenceTests(unittest.TestCase):
    def test_mandatory_gap_not_crossed(self):
        out=stage4_reference_chords(mini())
        self.assertEqual([(x['from'],x['to']) for x in out['reference_chords']],[('AAA','BBB'),('CCC','DDD')])
        self.assertEqual(len(out['gaps']),1)
        self.assertEqual(out['lnav_commands'],[])
    def test_reference_position_sign(self):
        a=stage4_reference_chords(mini())
        pos=reference_position(a,{'lat':-0.1,'lon':.5},0)
        self.assertGreater(pos['signed_cross_track_nm'],0) # south of an eastbound track is right
        self.assertEqual(pos['position_status'],'PROJECTED_WITHIN_SEGMENT')
        self.assertFalse(pos['sequencer_advanced'])
    def test_before_and_after_are_not_autosequenced(self):
        c=stage4_reference_chords(mini())
        self.assertEqual(reference_position(c,{'lat':0.,'lon':-.1},0)['position_status'],'BEFORE_START')
        self.assertEqual(reference_position(c,{'lat':0.,'lon':1.1},0)['position_status'],'PAST_END')
        self.assertEqual(reference_position(c,{'lat':0.,'lon':1.1},0)['aircraft_control_commands'],[])
    def test_wrong_distance_rejected(self):
        p=mini();p['items'][1]['reference_leg_distance_nm']=1
        with self.assertRaisesRegex(Stage8Error,'distance inconsistent'):stage4_reference_chords(p)
    def test_gap_requires_acknowledgement(self):
        p=mini();p['items'][2].pop('required_action')
        with self.assertRaisesRegex(Stage8Error,'discontinuity safety'):stage4_reference_chords(p)
    def test_a_source_rte_may_not_already_be_active(self):
        p=mini();p['fmc_legs_activated']=1
        with self.assertRaises(Stage8Error):stage4_reference_chords(p)
    def test_missing_marker_blocked(self):
        p=mini();p['source_marker']='//AIRAC Cycle : 2609'
        with self.assertRaises(Stage8Error):stage4_reference_chords(p)
    def test_corrupted_source_sequence_blocked(self):
        p=mini();p['items'][1]['airway_seq']=10
        with self.assertRaisesRegex(Stage8Error,'sequence'):stage4_reference_chords(p)
    def test_stops_at_procedure_boundary(self):
        p=mini();p['items'].insert(1,{'type':'PROCEDURE','label':'MYPROC'})
        self.assertEqual(len(stage4_reference_chords(p)['reference_chords']),1)
    def test_invalid_position_blocked(self):
        with self.assertRaises(Stage8Error):reference_position(stage4_reference_chords(mini()),{'lat':100,'lon':0},0)
    def test_no_automatic_leg_selection(self):
        with self.assertRaises(Stage8Error):reference_position(stage4_reference_chords(mini()),{'lat':0,'lon':0},None)

class EvidenceTests(unittest.TestCase):
    def record(self,code='TF'):
        d=dict(airac='2610',source_marker=AIRAC_MARKER,evidence_type='EXPLICIT_ARINC424_LEG_RECORD',
            source={'file':'/explicit/arinc424.txt','line':17,'sha256':'a'*64},
            raw_coded_record='LEG 001 '+code, path_terminator=code,fix='BBB',
            fix_position={'lat':0.,'lon':1.})
        if code=='TF':d['from_position']={'lat':0.,'lon':0.}
        return d
    def test_explicit_tf_reference_not_fmc(self):
        r=validate_source_coded_leg(self.record())
        self.assertEqual(r['geometry']['kind'],'CODED_TF_REFERENCE')
        self.assertEqual(r['lnav_commands'],[])
        self.assertFalse(r['fmc_executable'])
    def test_narrative_leg_rejected(self):
        d=self.record();d['evidence_type']='SIDSTAR_TEXT_INFERRED'
        with self.assertRaisesRegex(Stage8Error,'evidence_type'):validate_source_coded_leg(d)
    def test_missing_provenance_rejected(self):
        d=self.record();d['source']['sha256']='NA'
        with self.assertRaises(Stage8Error):validate_source_coded_leg(d)
    def test_cf_mag_without_verification_blocked(self):
        d=self.record('CF');d['course_deg']=285.;d['course_frame']='MAGNETIC'
        r=validate_source_coded_leg(d)
        self.assertIn('VERIFIED_MAGNETIC_VARIATION_ABSENT',r['blocking_reasons'])
    def test_df_is_live_position_dependent(self):
        r=validate_source_coded_leg(self.record('DF'))
        self.assertIn('LIVE_AIRCRAFT_POSITION_AND_TURN_DYNAMICS_UNVERIFIED',r['blocking_reasons'])
    def test_unsupported_leg_never_executes(self):
        r=validate_source_coded_leg(self.record('RF'))
        self.assertEqual(r['geometry']['kind'],'UNSUPPORTED_CODING_NO_GEOMETRY')
    def test_missing_required_tf_start(self):
        d=self.record();d.pop('from_position')
        with self.assertRaises(Stage8Error):validate_source_coded_leg(d)

class PrivateIntegration(unittest.TestCase):
    @unittest.skipUnless(os.environ.get('NPE_STAGE8_PRIVATE_STAGE4'),'set NPE_STAGE8_PRIVATE_STAGE4 for private integration test')
    def test_real_airac_stage4(self):
        path=os.environ['NPE_STAGE8_PRIVATE_STAGE4']
        with sqlite3.connect('file:'+Path(path).resolve().as_posix()+'?mode=ro',uri=True) as c:
            p=json.loads(c.execute('select payload_json from plans order by id limit 1').fetchone()[0])
        result=stage4_reference_chords(p)
        self.assertEqual(result['qa']['hard_discontinuities'],4)
        self.assertEqual(result['qa']['chords'],10)
        self.assertEqual(result['lnav_commands'],[])
        self.assertTrue(result['reference_chords'][0]['source']['from_file'])

if __name__=='__main__':unittest.main()