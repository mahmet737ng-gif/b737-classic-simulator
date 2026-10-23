"""Synthetic-only Stage3 intent classification; no licensed nav data."""
import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from leg_intent_overlay import classify

class Stage3IntentSafetyTests(unittest.TestCase):
    def test_track_bearing_not_assumed(self):
        n={'kind':'TRACK','values':{'bearing_token':'285','until':{'kind':'ALTITUDE_UNTIL_TOKEN','raw_value':'4360'}}}
        token,fix,required,blocked=classify(n,None,False)
        self.assertEqual(token,'285')
        self.assertIn('BEARING_FRAME_NOT_PROVEN',blocked)
        self.assertIn('TERMINATOR_NOT_VERIFIED',blocked)
    def test_hold_without_fix_is_blocked(self):
        n={'kind':'HOLD','values':{'fix_ident':'X','inbound_course_token':'90'}}
        self.assertIn('REFERENCE_FIX_POSITION_UNRESOLVED',classify(n,None,False)[3])
        self.assertIn('INCOMPLETE_SOURCE_FILE',classify(n,None,True)[3])
    def test_atc_vectors_never_fmc_autoguide(self):
        n={'kind':'ATC_VECTORS','values':{}}
        self.assertIn('ATC_HEADING_MANUAL_TERMINATION',classify(n,None,False)[3])

if __name__=='__main__':unittest.main()
