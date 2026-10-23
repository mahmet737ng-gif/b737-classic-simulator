#!/usr/bin/env python3
"""737 Classic simulator-only reference guidance core, AIRAC 2610 Rev.1.

A stateful, fail-closed lateral *training* controller for individually validated
Stage8 WGS84 enroute reference chords. This does NOT turn narrative SID/STAR/APP
into coded ARINC legs, and cannot issue real autopilot, AFDS, LNAV, VNAV, throttle,
or flight-director actuator commands. Outputs are demonstrator values only.

All source records MUST have been imported solely after the exact AIRAC marker.
No implicit bridging of source discontinuities, unverified fly-by, or holds.
"""
from __future__ import annotations
import math
from dataclasses import dataclass
from typing import Optional
from npe_stage8 import AIRAC, AIRAC_MARKER, VERSION as REF_VERSION, Stage8Error, coords, distance_nm, course_true, reference_position

VERSION = 'NPE_STAGE9_SIMULATOR_REFERENCE_GUIDANCE_v1'
MODE_OFF='OFF'; MODE_ARMED='ARMED'; MODE_TRACK='SIM_REFERENCE_TRACK'; MODE_HOLD='SUSPENDED'; MODE_END='END_OF_CONTIGUOUS_GROUP'

def wrap180(a):
    return (a+180)%360-180

def clamp(v,lo,hi):
    return max(lo,min(hi,v))

def _num(v,name,low=None,high=None):
    if type(v) not in (int,float) or not math.isfinite(v):raise Stage8Error(name+' must be finite numeric')
    v=float(v)
    if (low is not None and v<low) or (high is not None and v>high):raise Stage8Error(name+' out of range')
    return v

def sensor_valid(s,previous_timestamp=None):
    if not isinstance(s,dict) or s.get('source')!='SIMULATOR_INTERNAL' or s.get('integrity')!='VALID':
        raise Stage8Error('Only explicitly valid SIMULATOR_INTERNAL sensor supported')
    coords(s.get('lat'),s.get('lon'))
    _num(s.get('gs_kt'),'groundspeed kt',50,550)
    _num(s.get('track_true_deg'),'true track deg',0,360)
    t=_num(s.get('sim_time_s'),'simulation timestamp seconds',0)
    if previous_timestamp is not None and t<=previous_timestamp:raise Stage8Error('Non-monotonic/duplicate sensor frame')
    if previous_timestamp is not None and t-previous_timestamp>10:raise Stage8Error('Stale sensor gap >10s: rearm required')
    return t


def plan_valid(ref):
    if (not isinstance(ref,dict) or ref.get('version')!=REF_VERSION or ref.get('airac')!=AIRAC
        or ref.get('source_marker')!=AIRAC_MARKER or ref.get('fmc_executable') is not False):
        raise Stage8Error('Stage8 source provenance and non-executable gate required')
    chords=ref.get('reference_chords'); gaps=ref.get('gaps')
    if not isinstance(chords,list) or not chords or len(chords)>1000 or not isinstance(gaps,list):
        raise Stage8Error('Empty/large or malformed source route')
    for i,leg in enumerate(chords):
        if leg.get('seq')!=i or leg.get('kind')!='ORDERED_WGS84_REFERENCE_CHORD' or leg.get('fmc_executable') is not False:
            raise Stage8Error('Untrusted reference chord source identity')
        a=coords(*leg['from_point']);b=coords(*leg['to_point']);length=distance_nm(a,b)
        if not .005<length<=200 or abs(length-leg['distance_nm'])>.02:
            raise Stage8Error('Reference distance corrupt')
        if i>0 and leg['group']==chords[i-1]['group']:
            prior=chords[i-1]
            if prior['to_plan_index']!=leg['from_plan_index'] or distance_nm(coords(*prior['to_point']),a)>.005:
                raise Stage8Error('Source chain linkage ambiguous')
        if i>0 and leg['group']<chords[i-1]['group']:
            raise Stage8Error('Unordered source groups')
    return True


def turn_preview_nm(gs_kt, turn_deg, bank_deg):
    """Fly-by tangent lead *diagnostic* only, not a leg-switch authorization."""
    gs=_num(gs_kt,'groundspeed',50,550);bank=_num(bank_deg,'bank',5,30)
    turn=abs(_num(turn_deg,'turn angle',-180,180))
    if turn>=170:return None  # approximate tangent singularity
    speed=gs*0.514444
    radius_m=speed**2/(9.80665*math.tan(math.radians(bank)))
    return radius_m*math.tan(math.radians(turn/2))/1852


@dataclass
class ReferenceGuidance:
    """Stateful training-mode route guidance; not an aircraft autopilot adapter."""
    ref:dict
    leg_index:int=0

    def __post_init__(self):
        plan_valid(self.ref)
        if type(self.leg_index) is not int or not 0<=self.leg_index<len(self.ref['reference_chords']):
            raise Stage8Error('Explicit start leg index required')
        self.mode=MODE_OFF
        self.last_time:Optional[float]=None
        self.events=[]
        self.arm_approved=False
        self.group=self.ref['reference_chords'][self.leg_index]['group']

    def arm(self,training_consent:bool):
        if training_consent is not True:raise Stage8Error('Explicit SIM ONLY consent required')
        if self.mode not in (MODE_OFF,MODE_HOLD,MODE_END):raise Stage8Error('Reset before rearming')
        self.mode=MODE_ARMED;self.arm_approved=True;self.last_time=None
        return self._inert('ARMED_FOR_SIMULATOR_TEST_ONLY')

    def disengage(self,reason='PILOT_DISENGAGE'):
        self.mode=MODE_OFF;self.arm_approved=False;self.last_time=None
        self.events.append({'type':'DISENGAGED','reason':reason})
        return self._inert(reason)

    def _inert(self,reason):
        return {'version':VERSION,'mode':self.mode,'reason':reason,'leg_index':self.leg_index,
                'command_authority':'SIMULATED_ADVISORY_ONLY','aircraft_actuator_commands':[],
                'afds_commands':[],'lnav_commands':[],'vnav_commands':[],
                'fmc_legs_executable':False,'reference_only':True,
                'desired_true_track_deg':None,'sim_fd_bank_preview_deg':None}

    def step(self,s):
        if self.mode not in (MODE_ARMED,MODE_TRACK):return self._inert('NOT_ENGAGED')
        try:
            new_time=sensor_valid(s,self.last_time)
            loc=(s['lat'],s['lon'])
            leg=self.ref['reference_chords'][self.leg_index]
            refpos=reference_position(self.ref,s,self.leg_index)
            xtk=refpos['signed_cross_track_nm']
            atk=refpos['along_track_nm']
            dtg=refpos['distance_to_fix_nm']
            length=refpos['segment_length_nm']
            # Do not capture the wrong leg if aircraft is remote or beyond track.
            if abs(xtk)>8 or atk < -8 or atk>length+8:
                self.mode=MODE_HOLD;self.arm_approved=False;self.last_time=None
                return {**self._inert('POSITION_OUTSIDE_SOURCE_CHORD_CAPTURE'),
                        'signed_cross_track_nm':xtk,'distance_to_fix_nm':dtg}
            # Advance at most one leg per valid sensor update, within same source group.
            # Never infer terminal/procedure connectivity across Stage4 gaps.
            gs=s['gs_kt'];capture=clamp(gs*8/3600,.15,.6)
            advanced=False
            if dtg<=capture and atk>=length-capture and abs(xtk)<.5:
                nextidx=self.leg_index+1
                if nextidx>=len(self.ref['reference_chords']) or self.ref['reference_chords'][nextidx]['group']!=leg['group']:
                    self.mode=MODE_END;self.arm_approved=False;self.last_time=None
                    return {**self._inert('MANDATORY_END_OF_CONTIGUOUS_SOURCE_GROUP'),
                            'distance_to_fix_nm':dtg,'signed_cross_track_nm':xtk,
                            'at_source_boundary':True}
                self.leg_index=nextidx;leg=self.ref['reference_chords'][nextidx]
                refpos=reference_position(self.ref,s,nextidx)
                xtk=refpos['signed_cross_track_nm'];dtg=refpos['distance_to_fix_nm']
                if abs(xtk)>8:
                    self.mode=MODE_HOLD;self.last_time=None
                    return self._inert('NEXT_LEG_NOT_CAPTURED')
                advanced=True
                self.events.append({'type':'AUTO_SEQUENCE_IN_GROUP','to_leg':nextidx,'sim_time_s':new_time})
            self.last_time=new_time;self.mode=MODE_TRACK
            # Proportional cross-track correction applied to true reference course.
            # +XTK means right side: command a LEFT correction (negative offset).
            lookahead_nm=clamp(gs*45/3600,1.0,8.0)
            correction=clamp(math.degrees(math.atan2(1.4*xtk,lookahead_nm)),-30,30)
            true_track=(leg['true_course_deg']-correction)%360
            track_error=wrap180(true_track - s['track_true_deg'])
            # Simulated FD preview bank command, independent of actual AFDS.
            bank_preview=round(clamp(.25*track_error,-20,20),2)
            nxt=self.ref['reference_chords'][self.leg_index+1] if self.leg_index+1<len(self.ref['reference_chords']) else None
            turn=None
            if nxt is not None and nxt['group']==leg['group']:
                angle=wrap180(nxt['true_course_deg']-leg['true_course_deg'])
                turn={'angle_deg':round(angle,2),'lead_distance_nm_preview_only':round(turn_preview_nm(gs,angle,25),3) if abs(angle)<170 else None,
                     'automatic_fly_by_turn_enabled':False}
            return {'version':VERSION,'mode':self.mode,'airac':AIRAC,'leg_index':self.leg_index,
                'group':leg['group'],'from':leg['from'],'to':leg['to'],
                'auto_sequenced_in_same_group':advanced,'signed_cross_track_nm':xtk,
                'distance_to_fix_nm':dtg,'along_track_nm':refpos['along_track_nm'],
                'desired_true_track_deg':round(true_track,3),
                'true_reference_course_deg':leg['true_course_deg'],
                'track_error_deg':round(track_error,3),
                'sim_fd_bank_preview_deg':bank_preview,
                'turn':turn,'reference_only':True,'fmc_legs_executable':False,
                'command_authority':'SIMULATED_ADVISORY_ONLY','aircraft_actuator_commands':[],
                'afds_commands':[],'lnav_commands':[],'vnav_commands':[]}
        except (Stage8Error,KeyError,TypeError,IndexError) as e:
            self.mode=MODE_HOLD;self.arm_approved=False;self.last_time=None
            return self._inert('SENSOR_OR_SOURCE_REJECTED: '+str(e))


def vertical_constraint_preview(*, distance_nm_to_fix, constraint=None, current_alt_ft=None):
    """Strictly non-commanding altitude/speed window from independently verified inputs."""
    dist=_num(distance_nm_to_fix,'distance',0,500)
    if not isinstance(constraint,dict) or constraint.get('evidence')!='VERIFIED_EXPLICIT_SOURCE':
        return {'state':'BLOCKED_NO_VERIFIED_VERTICAL_CONSTRAINT','fmc_vnav_active':False,'pitch_command_deg':None}
    if constraint.get('airac')!=AIRAC or constraint.get('source_marker')!=AIRAC_MARKER:
        raise Stage8Error('Explicit vertical constraint has wrong AIRAC cycle or post-marker provenance')
    if (not isinstance(constraint.get('source'),dict) or not constraint['source'].get('file') or
        type(constraint['source'].get('line')) is not int or constraint['source']['line']<=0):
        raise Stage8Error('Explicit vertical constraint provenance required')
    kind=constraint.get('kind')
    if kind not in ('AT','AT_OR_ABOVE','AT_OR_BELOW'):raise Stage8Error('Unsupported vertical constraint')
    alt=_num(constraint.get('altitude_ft'),'altitude feet',-2000,60000)
    speed=None
    if constraint.get('speed_max_kt') is not None:speed=_num(constraint['speed_max_kt'],'speed kt',80,500)
    _num(current_alt_ft,'current altitude ft',-2000,60000)
    # 3-degree descent runway geometry *only for familiarization*, not published VNAV.
    projected=alt + dist * 6076.12 * math.tan(math.radians(3))  # feet per NM
    return {'state':'SIMULATOR_CONSTRAINT_PREVIEW_ONLY','kind':kind,'fix_altitude_ft':alt,
       'speed_max_kt':speed,'distance_nm':dist,'illustrative_three_degree_descent_altitude_ft':round(projected),
       'current_altitude_ft':current_alt_ft,'fmc_vnav_active':False,'pitch_command_deg':None,
       'aircraft_actuator_commands':[]}