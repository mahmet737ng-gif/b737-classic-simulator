#!/usr/bin/env python3
"""NPE Stage 8: read-only WGS84 great-circle reference progress monitor.

This NEVER supplies active legs, autopilot steering, LNAV/VNAV, or procedural
path-terminator interpretation. Input flight plans must have the exact AIRAC
2610 import boundary, private source provenance, and explicit non-executable
status. Segment selection is MANUAL and may not cross discontinuities.
Not for operational navigation.
"""
from __future__ import annotations
from math import asin, atan2, cos, radians, sin, sqrt, degrees, isfinite
from typing import Any

EARTH_NM=3440.065
MARKER='//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1'
VERSION='NPE_STAGE8_REFERENCE_MONITOR_v1'
PLAN_VERSION='NPE_STAGE4_FLIGHT_PLAN_DRAFT_v1'

class MonitorError(ValueError):pass

def require(cond: bool, message: str):
    if not cond:raise MonitorError(message)

def coord(lat:Any,lon:Any):
    require(type(lat) in (int,float) and type(lon) in (int,float) and
            isfinite(lat) and isfinite(lon) and -90<=lat<=90 and -180<=lon<=180,
            'Invalid geographic coordinates')
    return float(lat),float(lon)

def angle_between(a,b):
    la1,lo1=coord(a['lat'],a['lon']);la2,lo2=coord(b['lat'],b['lon'])
    f1,f2,dlat,dlon=radians(la1),radians(la2),radians(la2-la1),radians(lo2-lo1)
    u=sin(dlat/2)**2+cos(f1)*cos(f2)*sin(dlon/2)**2
    return 2*asin(min(1.,sqrt(max(0.,u))))

def bearing(a,b):
    la1,lo1=coord(a['lat'],a['lon']);la2,lo2=coord(b['lat'],b['lon'])
    f1,f2,d=radians(la1),radians(la2),radians(lo2-lo1)
    x=cos(f1)*sin(f2)-sin(f1)*cos(f2)*cos(d)
    y=sin(d)*cos(f2)
    require(abs(x)+abs(y)>1e-14,'Identical or antipodal navigation fixes')
    return atan2(y,x)

def nm(a,b):return EARTH_NM*angle_between(a,b)

def safe_plan(plan):
    require(isinstance(plan,dict) and plan.get('engine')==PLAN_VERSION and
            plan.get('airac')=='2610' and plan.get('source_marker')==MARKER and
            plan.get('fmc_legs_activated')==0 and plan.get('autopilot_guidance_enabled') is False and
            plan.get('status','').endswith('NOT_FMC_EXECUTABLE'), 'AIRAC / source / ACTIVE FMC gate failed')
    items=plan.get('items')
    require(isinstance(items,list) and 2<=len(items)<=500,'Invalid private plan items')
    gaps=0
    for i,item in enumerate(items):
        require(isinstance(item,dict) and item.get('type') in ('AIRPORT','PROCEDURE','FIX','DISCONTINUITY') and
                item.get('fmc_status') in ('SOURCE_ONLY','NOT_EXECUTABLE'),f'Unsafe item at {i}')
        if item['type']=='DISCONTINUITY':gaps+=1
        if item['type']=='FIX':
            coord(item.get('lat'),item.get('lon'))
            require(isinstance(item.get('label'),str) and 1<=len(item['label'])<=12,'Malformed FIX')
    require(gaps==plan.get('qa',{}).get('discontinuity_count'),'Missing discontinuity references')
    return items

def candidates(plan):
    """Only two adjacent source FIX rows with a verified published reference chord.

    Every non-FIX boundary breaks continuity. These lines are geodesic visual
    references NOT ARINC TF/DF or navigation commands.
    """
    items=safe_plan(plan);output=[]
    for i in range(1,len(items)):
        a,b=items[i-1],items[i]
        if a['type']!='FIX' or b['type']!='FIX':continue
        declared=b.get('reference_leg_distance_nm')
        require(type(declared) in (int,float) and isfinite(declared) and declared>0,
                f'No verified chord {i-1}→{i}')
        length=nm(a,b)
        require(0.005<length<=200 and abs(length-declared)<=0.30,
                f'Bad published reference chord {i-1}→{i}')
        require(length<EARTH_NM*3.12,'Ambiguous geographic antipodal reference')
        output.append({'to_item_index':i,'from':a['label'],'to':b['label'],
                       'start':{'lat':a['lat'],'lon':a['lon']},
                       'end':{'lat':b['lat'],'lon':b['lon']},
                       'length_nm':round(length,3),'true_initial_course_deg':round(degrees(bearing(a,b))%360,3),
                       'kind':'SOURCE_REFERENCE_CHORD_NOT_ARINC_LEG',
                       'fmc_executable':False})
    return output

def analyze(plan,to_item_index,lat,lon):
    """Read-only signed cross-track and along-track relative to one manually selected chord."""
    require(type(to_item_index) is int,'Manually choose a valid reference leg index')
    poslat,poslon=coord(lat,lon)
    edges=candidates(plan)
    match=[e for e in edges if e['to_item_index']==to_item_index]
    require(len(match)==1,'Selected item is not a connected reference leg (possibly a DISCONTINUITY)')
    edge=match[0];a=edge['start'];b=edge['end'];p={'lat':poslat,'lon':poslon}
    dist_13=angle_between(a,p)
    theta12=bearing(a,b)
    if dist_13<1e-12:
        xt=0.0;at=0.0
    else:
        theta13=bearing(a,p)
        delta=theta13-theta12
        xt=asin(max(-1,min(1,sin(dist_13)*sin(delta))))*EARTH_NM
        # atan2 formulation preserves negative and overshoot along-track values
        at=atan2(sin(dist_13)*cos(delta),cos(dist_13))*EARTH_NM
    if at<0:phase='BEFORE_REFERENCE_START'
    elif at>edge['length_nm']:phase='BEYOND_REFERENCE_END'
    else:phase='ON_REFERENCE_SPAN'
    # This is NOT a CDI or approved lateral deviation indicator.
    return {'version':VERSION,'airac':'2610','plan_origin':plan['origin'],
      'plan_destination':plan['destination'],'manual_item_index':to_item_index,
      'from_fix':edge['from'],'to_fix':edge['to'],
      'reference_true_course_deg':edge['true_initial_course_deg'],
      'reference_length_nm':edge['length_nm'],
      'along_track_nm':round(at,3), 'cross_track_nm_right_positive':round(xt,3),
      'direct_distance_to_fix_nm':round(nm(p,b),3),
      'reference_phase':phase,'requires_manual_next_leg_selection':True,
      'source_position':'MANUAL_POSITION_ENTRY_ONLY',
      'status':'REFERENCE_ADVISORY_ONLY_NO_AUTO_SEQUENCING',
      'arinc_legs':[],'fmc_executable':False,'lnav_commands':[],
      'vnav_commands':[],'afds_commands':[], 'autopilot_guidance_enabled':False}