"""Sandbox-only synthetic coordinated-turn aircraft for B737 Stage9 guidance QA.

NOT a physics model of the EP-FSI aircraft. Explicitly no instrument outputs,
AFDS coupling, real actuator APIs, wind, or actual aircraft dynamics.
"""
from __future__ import annotations
from dataclasses import dataclass
import math
from npe_stage8 import coords,EARTH_NM,Stage8Error
from npe_stage9_guidance import ReferenceGuidance,MODE_TRACK,clamp,_num

@dataclass
class KinematicTrainingAircraft:
    lat:float
    lon:float
    true_track_deg:float
    gs_kt:float
    sim_time_s:float=0
    bank_deg:float=0

    def __post_init__(self):
        coords(self.lat,self.lon)
        self.true_track_deg=_num(self.true_track_deg,'true track',0,360)
        self.gs_kt=_num(self.gs_kt,'ground speed',50,550)
        self.sim_time_s=_num(self.sim_time_s,'sim time',0)
        self.bank_deg=_num(self.bank_deg,'bank deg',-25,25)

    def position_sample(self):
        return {'source':'SIMULATOR_INTERNAL','integrity':'VALID','lat':self.lat,
          'lon':self.lon,'track_true_deg':self.true_track_deg,'gs_kt':self.gs_kt,
          'sim_time_s':self.sim_time_s}

    def advance(self,advisory:dict,dt_s:float=1.0):
        """Apply a *synthetic* roll response then propagate position on a sphere.

        The bank preview is not a real flight-director command and this method
        never creates/returns a control channel to the main B737 simulator.
        """
        dt=_num(dt_s,'time step seconds',.1,2)
        demanded=advisory.get('sim_fd_bank_preview_deg') if advisory.get('mode')==MODE_TRACK else 0.0
        demanded=clamp(_num(demanded,'bank preview',-20,20),-20,20)
        # Synthetic roll-rate cap 3deg/s; not measured Boeing response.
        self.bank_deg+=clamp(demanded-self.bank_deg,-3*dt,3*dt)
        mps=self.gs_kt*.514444
        # Rate of change of track for a constant-bank coordinated *synthetic* turn.
        delta=math.degrees(9.80665*math.tan(math.radians(self.bank_deg))/mps*dt)
        self.true_track_deg=(self.true_track_deg+delta)%360
        travel_rad=(self.gs_kt*dt/3600)/EARTH_NM
        lat1=math.radians(self.lat);lon1=math.radians(self.lon)
        bearing=math.radians(self.true_track_deg)
        lat2=math.asin(clamp(math.sin(lat1)*math.cos(travel_rad)+math.cos(lat1)*math.sin(travel_rad)*math.cos(bearing),-1,1))
        lon2=lon1+math.atan2(math.sin(bearing)*math.sin(travel_rad)*math.cos(lat1),
                            math.cos(travel_rad)-math.sin(lat1)*math.sin(lat2))
        self.lat=math.degrees(lat2)
        self.lon=((math.degrees(lon2)+180)%360)-180
        self.sim_time_s+=dt
        return {'lat':round(self.lat,7),'lon':round(self.lon,7),'true_track_deg':round(self.true_track_deg,3),
                'synthetic_bank_deg':round(self.bank_deg,3),'sim_time_s':self.sim_time_s,
                'model':'SYNTHETIC_POINT_MASS_TRAINING_ONLY','real_aircraft_command':None}


def simulate(guidance:ReferenceGuidance,aircraft:KinematicTrainingAircraft,frames:int,dt_s:float=1):
    if type(frames)is not int or not 1<=frames<=20000:raise Stage8Error('Synthetic frame count outside bounds')
    history=[]
    for _ in range(frames):
        # Time increases during the physical propagation; sample at t>0 on first frame.
        if aircraft.sim_time_s==0:aircraft.sim_time_s=dt_s
        advisory=guidance.step(aircraft.position_sample())
        history.append({'guidance':advisory,'aircraft':aircraft.advance(advisory,dt_s)})
        if advisory['mode']!='SIM_REFERENCE_TRACK':break
    return history