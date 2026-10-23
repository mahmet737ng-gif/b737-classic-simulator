#!/usr/bin/env python3
"""Stage10: explicit, fail-closed aircraft telemetry contract for the B737 trainer.

This module is an in-process bus. Real simulator bridges may publish into it,
provided they match the exact schema. It does not claim access to FSX/MSFS/
X-Plane or to physical avionics. Simulator only, never real navigation.
"""
from __future__ import annotations
from copy import deepcopy
import math
import time
from npe_stage8 import Stage8Error, coords
from npe_stage9_guidance import wrap180

VERSION='STAGE10_AIRCRAFT_STATE_BUS_v1'
ADAPTER='EXPLICIT_SIMULATOR_TELEMETRY_V1'


def number(d,key,low,high):
    x=d.get(key)
    if type(x) not in (float,int) or not math.isfinite(x) or not low<=x<=high:
        raise Stage8Error(f'{key}: missing, invalid or out of range')
    return float(x)


def normalize_aircraft_frame(raw):
    if type(raw) is not dict or raw.get('adapter_id')!=ADAPTER or raw.get('source')!='SIMULATOR_INTERNAL':
        raise Stage8Error('Untrusted telemetry adapter/source')
    if raw.get('integrity')!='VALID':raise Stage8Error('Aircraft sensor integrity not VALID')
    pos=raw.get('position_source')
    if pos not in ('IRS','GPS'):raise Stage8Error('Explicit IRS or GPS position selection required')
    sensors=raw.get('sensors')
    if type(sensors) is not dict or type(sensors.get('irs_aligned')) is not bool or type(sensors.get('gps_valid')) is not bool:
        raise Stage8Error('Explicit boolean IRS/GPS health required')
    if pos=='IRS' and not sensors['irs_aligned']:raise Stage8Error('IRS not aligned')
    if pos=='GPS' and not sensors['gps_valid']:raise Stage8Error('GPS invalid')
    if sensors.get('position_integrity')!='VALID':raise Stage8Error('Selected position sensor integrity unknown')
    lat=number(raw,'lat',-90,90);lon=number(raw,'lon',-180,180);coords(lat,lon)
    gs=number(raw,'gs_kt',0,600)
    track=number(raw,'track_true_deg',0,360)
    heading=number(raw,'heading_true_deg',0,360)
    hdgmag=number(raw,'heading_magnetic_deg',0,360)
    magvar=number(raw,'magnetic_variation_deg',-45,45)
    if abs(wrap180(heading-(hdgmag+magvar)))>2.0:
        raise Stage8Error('Heading magnetic/true variation disagree')
    frame={
      'version':VERSION,'adapter_id':ADAPTER,'source':'SIMULATOR_INTERNAL',
      'integrity':'VALID','position_source':pos,
      'sensors':{'irs_aligned':sensors['irs_aligned'],'gps_valid':sensors['gps_valid'],'position_integrity':'VALID'},
      'lat':lat,'lon':lon,'gs_kt':gs,'track_true_deg':track,
      'heading_true_deg':heading,'heading_magnetic_deg':hdgmag,
      'magnetic_variation_deg':magvar,
      'pressure_alt_ft':number(raw,'pressure_alt_ft',-2000,60000),
      'vertical_speed_fpm':number(raw,'vertical_speed_fpm',-9000,9000),
      'pitch_deg':number(raw,'pitch_deg',-40,40),
      'bank_deg':number(raw,'bank_deg',-70,70),
      'sim_time_s':number(raw,'sim_time_s',0,1e12)
    }
    # All samples identify themselves as synthetic-simulator telemetry. We do not
    # accept FCOM/AFDS state from this channel as avionics authority.
    return frame


class AircraftStateBus:
    def __init__(self,max_age_s=2.0,clock=None):
        if type(max_age_s) not in (int,float) or not .1<=max_age_s<=10:raise ValueError('Invalid freshness limit')
        self.max_age_s=float(max_age_s)
        self.clock=clock if clock is not None else time.monotonic
        self.sequence=0;self.frame=None;self.arrived_at=None

    def publish(self,raw):
        try:
            next_frame=normalize_aircraft_frame(raw)
            if self.frame is not None:
                delta=next_frame['sim_time_s']-self.frame['sim_time_s']
                if not 0<delta<=10:raise Stage8Error('Duplicated/reversed or stale simulation timestamp')
        except (Stage8Error,KeyError,TypeError):
            # Corrupt new data must never leave the previous frame appearing live.
            self.invalidate()
            raise
        self.sequence+=1;self.frame=next_frame;self.arrived_at=self.clock()
        return {'version':VERSION,'sequence':self.sequence,'accepted':True,'guidance_authority':'NONE'}

    def invalidate(self):
        self.frame=None;self.arrived_at=None

    def snapshot(self):
        if self.frame is None or self.arrived_at is None:raise Stage8Error('No valid aircraft frame')
        age=self.clock()-self.arrived_at
        if not 0<=age<=self.max_age_s:
            self.invalidate();raise Stage8Error('Aircraft position telemetry expired')
        return {'sequence':self.sequence,'age_s':round(age,4),'aircraft':deepcopy(self.frame)}

    def stage9_sensor(self):
        v=self.snapshot()['aircraft']
        if not 50<=v['gs_kt']<=550:raise Stage8Error('Stage9 lateral guidance requires 50–550 kt groundspeed')
        return {k:v[k] for k in ('source','integrity','lat','lon','gs_kt','track_true_deg','sim_time_s')}