#!/usr/bin/env python3
"""AIRAC 2610 evidence gate and reference-route diagnostic engine (simulation only).

The stage-1 PMDG narrative tokens DO NOT contain verified ARINC 424 path terminator
codes. Never map narrative FIX/TRK/HDG to IF/TF/DF/CF by inference.

This module supports source-*coded* ARINC data ONLY when independently supplied
with record and file provenance, and still never issues FMC/AFDS/flight commands.
It independently builds read-only *reference chords* from ordered Stage-4 airway
FIXes, never across a discontinuity or procedure marker.
"""
from __future__ import annotations
import hashlib
import json
import math
import re
from typing import Any

AIRAC_MARKER = '//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1'
AIRAC = '2610'
VERSION = 'NPE_STAGE8_EVIDENCE_AND_REFERENCE_SEQUENCER_v1'
EARTH_NM = 3440.065
ALLOWED_TYPES = frozenset({'IF','TF','DF','CF','FA','VA','VM','RF','AF','HF','HA','HM','CI','VI','CR','VR','CD','VD','FD','FC','CA','FM'})
HEX64 = re.compile(r'^[0-9a-f]{64}$')
IDENT = re.compile(r'^[A-Z0-9._-]{2,12}$')

class Stage8Error(ValueError):
    pass


def require(ok: bool, reason: str):
    if not ok:
        raise Stage8Error(reason)


def finite(v: Any, name: str) -> float:
    require(type(v) in (int,float) and math.isfinite(v), f'{name}: nonfinite or nonnumeric value')
    return float(v)


def coords(lat: Any, lon: Any) -> tuple[float,float]:
    lat,lon=finite(lat,'lat'),finite(lon,'lon')
    require(-90 <= lat <= 90 and -180 <= lon <= 180, 'coordinate outside WGS84 bounds')
    return lat,lon


def distance_nm(a:tuple[float,float],b:tuple[float,float])->float:
    lat1,lon1=coords(*a);lat2,lon2=coords(*b)
    p1,p2=map(math.radians,(lat1,lat2))
    dp=p2-p1;dl=math.radians(lon2-lon1)
    x=math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return 2*EARTH_NM*math.asin(min(1.0,math.sqrt(max(0,x))))


def course_true(a:tuple[float,float],b:tuple[float,float])->float:
    p1,p2=map(math.radians,(a[0],b[0]));dl=math.radians(b[1]-a[1])
    y=math.sin(dl)*math.cos(p2)
    x=math.cos(p1)*math.sin(p2)-math.sin(p1)*math.cos(p2)*math.cos(dl)
    require(abs(x)+abs(y)>1e-13,'coincident/antipodal points do not have unique course')
    return math.degrees(math.atan2(y,x))%360


def validate_source_coded_leg(record:dict)->dict:
    """Verify schema/provenance of *explicit* ARINC coding, never prove aircraft suitability.

    Real coded records are not in the supplied SidStars narrative ZIP. This function
    provides a fail-closed future integration contract, NOT an approval mechanism.
    """
    require(isinstance(record,dict),'coded leg must be a JSON object')
    for key,value in [('airac',AIRAC),('source_marker',AIRAC_MARKER),
                      ('evidence_type','EXPLICIT_ARINC424_LEG_RECORD')]:
        require(record.get(key)==value,f'{key}: explicit source evidence required')
    source=record.get('source')
    require(isinstance(source,dict),'source object absent')
    require(isinstance(source.get('file'),str) and source['file'].strip() and
            isinstance(source.get('line'),int) and type(source['line']) is int and source['line']>0 and
            isinstance(source.get('sha256'),str) and HEX64.fullmatch(source['sha256']) is not None,
            'source file/line/SHA256 provenance required')
    require(isinstance(record.get('raw_coded_record'),str) and record['raw_coded_record'].strip(),
            'original explicit coding record required')
    code=record.get('path_terminator')
    require(type(code) is str and code in ALLOWED_TYPES,'unrecognized path terminator')
    require(isinstance(record.get('fix'),str) and IDENT.fullmatch(record['fix']) is not None,
            'fix identifier must be explicit')
    # Required values are deliberately different by leg type; do not infer missing
    # data, course frames, terminators, turn center, or hold parameters.
    for key in ('fix_position',):
        p=record.get(key);require(isinstance(p,dict),'fix position absent')
        coords(p.get('lat'),p.get('lon'))
    blockers=['AIRCRAFT_FMC_FEATURE_SET_NOT_VERIFIED','SOURCE_CODING_NOT_CROSS_CHECKED_WITH_OFFICIAL_PROCEDURE']
    geometry=None
    if code=='IF':
        geometry={'kind':'INITIAL_FIX_REFERENCE','to':record['fix_position']}
    elif code=='TF':
        start=record.get('from_position')
        require(isinstance(start,dict),'TF requires explicit from-fix coordinates')
        a=coords(start.get('lat'),start.get('lon'))
        b=coords(record['fix_position']['lat'],record['fix_position']['lon'])
        d=distance_nm(a,b)
        require(.005<d<=200,'TF source geometry violates preview-distance gate')
        geometry={'kind':'CODED_TF_REFERENCE','distance_nm':round(d,4),'true_course_deg':round(course_true(a,b),4),
                  'from':start,'to':record['fix_position']}
    elif code=='CF':
        v=finite(record.get('course_deg'),'CF course')
        require(0<=v<360 and record.get('course_frame') in ('TRUE','MAGNETIC'),
                'CF requires explicit course and reference frame')
        if record['course_frame']=='MAGNETIC':
            # An explicit magnetic course without verified magvar may be stored,
            # but never converted into a geometric course.
            blockers.append('VERIFIED_MAGNETIC_VARIATION_ABSENT')
        geometry={'kind':'CF_TERMINATING_COURSE_REFERENCE_ONLY','course_deg':v,
                  'course_frame':record['course_frame'],'to':record['fix_position']}
    elif code=='DF':
        geometry={'kind':'DF_TERMINATING_FIX_REFERENCE_ONLY','to':record['fix_position']}
        blockers.append('LIVE_AIRCRAFT_POSITION_AND_TURN_DYNAMICS_UNVERIFIED')
    else:
        geometry={'kind':'UNSUPPORTED_CODING_NO_GEOMETRY','to':record['fix_position']}
        blockers.append('TYPE_SPECIFIC_PATH_AND_TERMINATOR_NOT_IMPLEMENTED')
    return {'leg_type':code,'fix':record['fix'],'source':source,
            'raw_coded_record_sha256':hashlib.sha256(record['raw_coded_record'].encode()).hexdigest(),
            'geometry':geometry,'evidence_class':'EXPLICIT_CODING_UNCROSSCHECKED',
            'blocking_reasons':blockers,'fmc_executable':False,'afds_commands':[],
            'lnav_commands':[],'vnav_commands':[]}


def stage4_reference_chords(plan:dict)->dict:
    """Return FIX-to-FIX *reference* spans only; never jump a discontinuity.

    A FIX reference after a discontinuity is the FIRST point of a new chain,
    not a connection to any point prior to the discontinuity.
    """
    require(isinstance(plan,dict),'plan must be an object')
    require(plan.get('airac')==AIRAC and plan.get('source_marker')==AIRAC_MARKER,
            'AIRAC source marker invalid')
    require(plan.get('fmc_legs_activated')==0 and plan.get('autopilot_guidance_enabled') is False,
            'reference compiler refuses active navigation source')
    items=plan.get('items')
    require(isinstance(items,list) and 0<len(items)<=2000,'invalid source plan items')
    chords=[];gaps=[];cursor=None;group=-1;last_seq=None
    for idx,item in enumerate(items):
        require(isinstance(item,dict) and item.get('type') in ('FIX','AIRPORT','PROCEDURE','DISCONTINUITY'),
                f'unrecognized plan item {idx}')
        typ=item['type'];label=item.get('label','')
        if typ!='FIX':
            if typ=='DISCONTINUITY':
                require(item.get('required_action')=='EXPLICIT_VERIFY_AND_RESOLVE',
                        'missing discontinuity safety gate')
                gaps.append({'index':idx,'reason':item.get('reason'),'status':'MUST_NOT_JOIN'})
            cursor=None;last_seq=None;continue
        require(type(label)==str and IDENT.fullmatch(label) is not None,f'bad fix ident {idx}')
        require(item.get('fmc_status')=='NOT_EXECUTABLE', 'source waypoint appears executable')
        require(type(item.get('source_file')) is str and item['source_file'].strip() and
                type(item.get('source_line')) is int and item['source_line']>0,
                'missing fix source provenance')
        p=coords(item.get('lat'),item.get('lon'))
        if cursor is None:
            cursor=(idx,item,p);group+=1;last_seq=item.get('airway_seq');continue
        j,prev,prev_point=cursor
        d=distance_nm(prev_point,p)
        require(.005<d<=200,f'reference segment {prev["label"]}->{label} out of bounds')
        calculated=course_true(prev_point,p)
        advertised=item.get('reference_leg_distance_nm')
        require(type(advertised) in (int,float) and abs(advertised-d)<=.15,
                f'stored source distance inconsistent for {label}')
        if prev.get('via')==item.get('via') and type(last_seq) is int and type(item.get('airway_seq')) is int:
            require(abs(item['airway_seq']-last_seq)==1,'gap in documented airway source sequence')
        chord={'seq':len(chords),'group':group,'from':prev['label'],'to':label,
                'from_point':list(prev_point),'to_point':list(p),'from_plan_index':j,'to_plan_index':idx,
                'true_course_deg':round(calculated,4),'distance_nm':round(d,4),
                'source':{'from_file':prev['source_file'],'from_line':prev['source_line'],
                          'to_file':item['source_file'],'to_line':item['source_line']},
                'kind':'ORDERED_WGS84_REFERENCE_CHORD','fmc_executable':False}
        chords.append(chord);cursor=(idx,item,p);last_seq=item.get('airway_seq')
    require(sum(1 for x in items if x['type']=='DISCONTINUITY')==len(gaps),
            'discontinuity source count mismatch')
    return {'version':VERSION,'airac':AIRAC,'source_marker':AIRAC_MARKER,
            'origin':plan.get('origin'),'destination':plan.get('destination'),
            'reference_chords':chords,'gaps':gaps,
            'qa':{'chords':len(chords),'hard_discontinuities':len(gaps)},
            'fmc_executable':False,'lnav_commands':[],'vnav_commands':[],
            'afds_commands':[],'status':'REFERENCE_ONLY_NO_AUTOMATIC_LEG_SEQUENCING'}


def reference_position(chords:dict,position:dict,leg_index:int)->dict:
    """Great-circle cross/along-track *diagnostic* for caller-selected chord.

    The caller selects the reference leg explicitly. No course steering, automatic
    leg advance, automatic turn anticipation, or traffic/clearance logic is emitted.
    """
    require(chords.get('version')==VERSION and chords.get('fmc_executable') is False,
            'reference-only geometry required')
    require(type(leg_index) is int and 0<=leg_index<len(chords['reference_chords']),
            'explicit leg index required')
    leg=chords['reference_chords'][leg_index]
    a=coords(*leg['from_point']);b=coords(*leg['to_point']);p=coords(position.get('lat'),position.get('lon'))
    full_nm=distance_nm(a,b);ap_nm=distance_nm(a,p)
    bearing_ap=course_true(a,p) if ap_nm>.000001 else leg['true_course_deg']
    delta13=ap_nm/EARTH_NM;theta13=math.radians(bearing_ap)
    theta12=math.radians(course_true(a,b))
    xtk_nm=EARTH_NM*math.asin(max(-1,min(1,math.sin(delta13)*math.sin(theta13-theta12))))
    atk_nm=EARTH_NM*math.atan2(math.sin(delta13)*math.cos(theta13-theta12),math.cos(delta13))
    if atk_nm<0:position_status='BEFORE_START'
    elif atk_nm>full_nm:position_status='PAST_END'
    else:position_status='PROJECTED_WITHIN_SEGMENT'
    return {'reference_leg':leg_index,'from':leg['from'],'to':leg['to'],
            'distance_to_fix_nm':round(distance_nm(p,b),3),
            'signed_cross_track_nm':round(xtk_nm,3),'along_track_nm':round(atk_nm,3),
            'segment_length_nm':round(full_nm,3),'position_status':position_status,
            'status':'MANUAL_REFERENCE_DIAGNOSTIC_ONLY','aircraft_control_commands':[],
            'sequencer_advanced':False,'fmc_executable':False}