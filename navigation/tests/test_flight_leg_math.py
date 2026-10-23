import math
import unittest
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from flight_leg_math import (
    destination_nm,distance_nm,initial_course_true,true_bearing,
    ground_vector_from_heading,turn_radius_nm,turn_preview,hold_preview,
    intersect_forward_rays
)

class LegMathTests(unittest.TestCase):
    def test_bearings_magnetic_explicit(self):
        self.assertEqual(true_bearing(350,frame='MAG',variation_east_deg=20),10)
        self.assertEqual(true_bearing(12,frame='TRUE'),12)
        with self.assertRaises(ValueError): true_bearing(270,frame='MAG')
        with self.assertRaises(ValueError): true_bearing(270,frame='SOURCE_UNKNOWN')
        with self.assertRaises(ValueError): true_bearing(270,frame='TRUE',variation_east_deg=0)
    def test_one_degree_equator(self):
        self.assertAlmostEqual(distance_nm(0,0,0,1),60.04,places=1)
        self.assertAlmostEqual(initial_course_true(0,0,0,1),90,places=5)
    def test_antimeridian(self):
        self.assertAlmostEqual(distance_nm(0,179.9,0,-179.9),12.0,delta=.03)
        lat,lon=destination_nm(0,179.9,90,12.008)
        self.assertAlmostEqual(lat,0,delta=.01)
        self.assertAlmostEqual(lon,-179.9,delta=.01)
    def test_pole_crossing_and_zero(self):
        self.assertEqual(destination_nm(0,0,90,0),(0.0,0.0))
        p=destination_nm(89.9,0,0,20)
        self.assertLess(p[0],90)
    def test_unique_forward_intercept(self):
        p=intersect_forward_rays((0,0),90,(1,1),180,max_nm=100)
        self.assertAlmostEqual(p['lat'],0,places=6)
        self.assertAlmostEqual(p['lon'],1,places=6)
        self.assertAlmostEqual(p['distance_a_nm'],60.04,delta=.05)
    def test_parallel_ambiguous_or_reverse(self):
        for case in [((0,0),90,(1,0),90),((0,0),270,(1,1),180),((0,0),90,(1,1),0)]:
            with self.assertRaises(ValueError):intersect_forward_rays(*case,max_nm=100)
    def test_intercept_requires_range(self):
        with self.assertRaises(ValueError):intersect_forward_rays((0,0),90,(1,10),180,max_nm=100)
        with self.assertRaises(ValueError):intersect_forward_rays((0,0),90,(1,1),180,max_nm=0)
    def test_heading_drift(self):
        calm=ground_vector_from_heading(90,180,0,0)
        self.assertAlmostEqual(calm['ground_track_true_deg'],90,places=5)
        self.assertAlmostEqual(calm['groundspeed_kt'],180,places=5)
        southwind=ground_vector_from_heading(90,180,0,50)
        self.assertGreater(southwind['ground_track_true_deg'],90)
        self.assertGreater(southwind['groundspeed_kt'],180)
        with self.assertRaises(ValueError):ground_vector_from_heading(0,100,0,100)
    def test_turn_radius_consistency(self):
        r=turn_radius_nm(180,25)
        self.assertGreater(r,0.5)
        self.assertLess(r,3)
        self.assertAlmostEqual(turn_radius_nm(360,25)/r,4,places=6)
        with self.assertRaises(ValueError): turn_radius_nm(180,0)
    def test_turn_90_direction(self):
        right=turn_preview(0,0,0,90,'RIGHT',tas_kt=180,bank_deg=25,wind_from_true=0,wind_kt=0)
        left=turn_preview(0,0,0,90,'LEFT',tas_kt=180,bank_deg=25,wind_from_true=0,wind_kt=0)
        self.assertEqual(right['end_heading_true_deg'],90)
        self.assertEqual(left['end_heading_true_deg'],270)
        self.assertGreater(right['points'][-1][1],0)
        self.assertLess(left['points'][-1][1],0)
        self.assertEqual(len(right['points']),37)
    def test_turn_wind_effect(self):
        still=turn_preview(0,0,0,90,'RIGHT',tas_kt=180,bank_deg=25,wind_from_true=0,wind_kt=0)
        wind=turn_preview(0,0,0,90,'RIGHT',tas_kt=180,bank_deg=25,wind_from_true=0,wind_kt=35)
        self.assertGreater(distance_nm(*still['points'][-1],*wind['points'][-1]),.1)
        self.assertEqual(still['duration_seconds'],wind['duration_seconds'])
    def test_hold_racetrack(self):
        h=hold_preview(fix_lat=33,fix_lon=51,inbound_true=90,turn_dir='RIGHT',
            leg_nm=4,tas_kt=180,bank_deg=25,wind_from_true=0,wind_kt=0)
        self.assertGreater(len(h['points']),140)
        self.assertLess(h['closure_error_nm'],.1)
        self.assertEqual(h['points'][0],(33,51))
        self.assertLess(distance_nm(*h['points'][-1],33,51),.1)
    def test_hold_time_explicit(self):
        h=hold_preview(fix_lat=0,fix_lon=0,inbound_true=0,turn_dir='LEFT',
            leg_minutes=1,tas_kt=180,bank_deg=25,wind_from_true=0,wind_kt=0)
        self.assertAlmostEqual(h['outbound_length_nm'],3,places=4)
    def test_hold_bans_implicit_units_and_wind(self):
        args=dict(fix_lat=0,fix_lon=0,inbound_true=0,turn_dir='LEFT',tas_kt=180,bank_deg=25,
                  wind_from_true=0,wind_kt=0)
        with self.assertRaises(ValueError):hold_preview(**args)
        with self.assertRaises(ValueError):hold_preview(**args,leg_nm=4,leg_minutes=1)
        with self.assertRaises(ValueError):hold_preview(**{**args,'wind_kt':15},leg_nm=4)
    def test_nan_invalid(self):
        with self.assertRaises(ValueError):destination_nm(math.nan,0,90,1)
        with self.assertRaises(ValueError):destination_nm(0,0,90,-1)
        with self.assertRaises(ValueError):true_bearing(math.inf,frame='TRUE')

if __name__=='__main__': unittest.main()