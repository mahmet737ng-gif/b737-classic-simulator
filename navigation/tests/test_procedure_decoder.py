import sys
from pathlib import Path
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from procedure_decoder import decode_expression

class DecodeTests(unittest.TestCase):
    def test_iranian_departure(self):
        expr='RNW 29R RNW 29L TRK 285 UNTIL 4360 FIX RUS FIX DAXIL'
        nodes,issues=decode_expression(expr)
        self.assertEqual(issues,[])
        self.assertEqual([x['kind'] for x in nodes],['RUNWAY_REFERENCE','RUNWAY_REFERENCE','TRACK','FIX_PASSAGE','FIX_PASSAGE'])
        self.assertEqual(nodes[2]['values']['until']['raw_value'],'4360')
    def test_rnav_altitude_speed_and_overfly(self):
        nodes,issues=decode_expression('FIX OVERFLY D245L 8000 SPEED 240 TURN RIGHT DIRECT FIX TRN AT OR ABOVE 13000 FIX NAGMO')
        self.assertEqual(issues,[])
        self.assertEqual(nodes[0]['values']['constraints'][0]['kind'],'ALTITUDE_EXACT_TOKEN')
        self.assertEqual(nodes[0]['values']['constraints'][1]['raw_value'],'240')
        self.assertEqual(nodes[1]['values']['constraints'][0]['kind'],'ALTITUDE_MIN_TOKEN')
    def test_intercept_and_hold(self):
        nodes,issues=decode_expression('HDG 203 INTERCEPT RADIAL 248 TO FIX RUS FIX RUS HOLD AT FIX RUS RIGHT TURN INBOUNDCOURSE 145 ALT 7000 SPEED 220 LEGTIME 1')
        self.assertEqual(issues,[])
        self.assertEqual([n['kind'] for n in nodes],['HEADING','RADIAL_INTERCEPT','FIX_PASSAGE','HOLD'])
        self.assertEqual(nodes[3]['values']['parameters'][-1]['kind'],'LEGTIME')
    def test_double_altitude_window(self):
        nodes,issues=decode_expression('FIX CLMNT AT OR BELOW 11000 AT OR ABOVE 9000 SPEED 250')
        self.assertFalse(issues)
        self.assertEqual([x['kind'] for x in nodes[0]['values']['constraints']],['ALTITUDE_MAX_TOKEN','ALTITUDE_MIN_TOKEN','SPEED_TOKEN'])
    def test_unknown_not_silently_dropped(self):
        expr='FIX ABC AT OR ABOVE 6000 MAGIC GIZMO TURN LEFT DIRECT FIX XYZ'
        nodes,issues=decode_expression(expr)
        self.assertEqual([n['kind'] for n in nodes],['FIX_PASSAGE','UNRESOLVED','TURN_DIRECT'])
        self.assertTrue(issues)
        self.assertEqual(' '.join(n['raw'] for n in nodes),expr)
    def test_incomplete_phrase(self):
        nodes,issues=decode_expression('FIX ABC INTERCEPT RADIAL 270 TO')
        self.assertTrue(issues)
        self.assertEqual(' '.join(x['raw'] for x in nodes),'FIX ABC INTERCEPT RADIAL 270 TO')
    def test_trk_can_be_a_real_fix_ident(self):
        expr="FIX TRK 6000 TRK 229 UNTIL 7.9 FROM FIX TRK TURN LEFT DIRECT FIX TRK"
        nodes,issues=decode_expression(expr)
        self.assertEqual(issues,[])
        self.assertEqual([n["kind"] for n in nodes],["FIX_PASSAGE","TRACK","TURN_DIRECT"])
        self.assertEqual(nodes[0]["values"]["ident"],"TRK")

    def test_empty(self):
        self.assertEqual(decode_expression(''),([],[]))
    def test_track_until_distance(self):
        nodes,issues=decode_expression('TRK 245 UNTIL 12.0 FROM FIX TRN SPEED 240')
        self.assertFalse(issues)
        self.assertEqual(nodes[0]['values']['until']['relation'],'FROM')
        self.assertEqual(nodes[0]['values']['until']['fix_ident'],'TRN')
    def test_vectors(self):
        nodes,issues=decode_expression('HDG 120 VECTORS')
        self.assertFalse(issues)
        self.assertEqual(nodes[-1]['kind'],'ATC_VECTORS')
if __name__=='__main__':unittest.main()