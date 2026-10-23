#!/usr/bin/env python3
"""Stage 3 private source-intent reader + explicit-input mathematical preview.

No implicit runway/transition selection. Any preview MUST be driven by caller-
provided flight conditions and an expressly verified bearing frame. It cannot
feed cockpit autopilot or active FMC navigation. Simulator-lab use only.
"""
import argparse
from contextlib import closing
from functools import lru_cache
import json
from pathlib import Path
import sqlite3

from flight_leg_math import (true_bearing,hold_preview,turn_preview,
                             destination_nm,ground_vector_from_heading)
from leg_intent_overlay import sha256,MARKER,VERSION
from npe_reader import get_procedure

@lru_cache(maxsize=9)
def fingerprint(path,size,mtime_ns):return sha256(path)

def readonly(path):
    return sqlite3.connect(Path(path).resolve().as_uri()+'?mode=ro',uri=True)

def verified(stage1,stage2,stage3):
    with closing(readonly(stage3)) as c:
        m=dict(c.execute('SELECT key,value FROM meta'))
        n=c.execute("SELECT COUNT(*) FROM leg_intents WHERE fmc_status!='NOT_EXECUTABLE'").fetchone()[0]
        if n:raise ValueError('Unexpected active FMC leg in Stage3 overlay')
    if m.get('marker')!=MARKER or m.get('build_id')!=VERSION or m.get('fmc_status')!='NOT_EXECUTABLE':
        raise ValueError('Unexpected AIRAC or Stage3 metadata')
    for db,key in [(stage1,'source_stage1_sha256'),(stage2,'source_stage2_sha256')]:
        p=Path(db).resolve();st=p.stat()
        if fingerprint(str(p),st.st_size,st.st_mtime_ns)!=m.get(key):
            raise ValueError('Source/overlay checksum mismatch; fail closed')
    return m

def get_intents(stage1,stage2,stage3,airport,kind,ident,*,runway=None,transition=None):
    verified(stage1,stage2,stage3)
    proc=get_procedure(stage1,airport,kind,ident,runway=runway,transition=transition)
    results=[]
    with closing(readonly(stage1)) as src,closing(readonly(stage3)) as over:
        over.row_factory=sqlite3.Row
        for s in proc['segments']:
            segment=src.execute('SELECT id FROM navdata_procedure_segments WHERE procedure_id=? AND seq=?',
                     (proc['procedure_id'],s['source_segment_seq'])).fetchone()
            if segment is None:raise ValueError('Lost source segment identity')
            rows=[]
            for r in over.execute('SELECT * FROM leg_intents WHERE segment_id=? ORDER BY node_seq',(segment[0],)):
                d=dict(r)
                for key in ('required_inputs_json','blockers_json','termination_token_json'):
                    if key in d:
                        val=d.pop(key)
                        d[key.replace('_json','')]=json.loads(val) if val is not None else None
                rows.append(d)
            results.append({'variant':s['variant'],'qualifier':s['qualifier'],
                            'source_post_marker_line':s['post_marker_line'],
                            'source_segment_id':segment[0], 'leg_intents':rows})
    return {'airport':airport.upper(),'kind':kind,'ident':ident.upper(),
            'selected_runway':proc['selected_runway'],
            'selected_transition':proc['selected_transition'],
            'source_file':proc['source_member'],'airac':'2610',
            'segments':results, 'fmc_status':'NOT_EXECUTABLE',
            'note':'No AIRAC source bearing frame, transition link, or path terminator is inferred.'}

def preview_hold_intent(stage1,stage2,stage3,segment_id,node_seq,*,
                        verified_frame,variation_east_deg=None,source_units_confirmed=False,
                        tas_kt=None,bank_deg=None,wind_from_true=None,wind_kt=None):
    """One established circuit only; external confirmation of frame AND units mandatory."""
    verified(stage1,stage2,stage3)
    if not source_units_confirmed:raise ValueError('Hold source LEGTIME/LEGDIST units not verified')
    if verified_frame not in ('MAG','TRUE'):raise ValueError('Explicit reviewed frame required')
    if None in (tas_kt,bank_deg,wind_from_true,wind_kt):raise ValueError('TAS, bank and wind must be explicitly supplied')
    with closing(readonly(stage3)) as c:
        c.row_factory=sqlite3.Row
        row=c.execute('SELECT * FROM leg_intents WHERE segment_id=? AND node_seq=?',(segment_id,node_seq)).fetchone()
        if row is None or row['kind']!='HOLD':raise ValueError('Hold intent not found')
        blocks=json.loads(row['blockers_json'])
        if 'INCOMPLETE_SOURCE_FILE' in blocks or row['anchor_lat'] is None:
            raise ValueError('Source incomplete or hold anchor unresolved')
        token=row['bearing_token']
        params=json.loads(row['termination_token_json'])
    values={p['kind']:float(p['raw_value']) for p in params}
    if ('LEGDIST' in values)==('LEGTIME' in values):
        raise ValueError('Hold source has no unique time/distance unit')
    # Direction comes exclusively from source phrase; no guessed routing semantics.
    raw=row['raw_source']
    if ' LEFT TURN ' in ' '+raw+' ':direction='LEFT'
    elif ' RIGHT TURN ' in ' '+raw+' ':direction='RIGHT'
    else:raise ValueError('No reliable hold turn direction')
    try: course=true_bearing(float(token),frame=verified_frame,variation_east_deg=variation_east_deg)
    except TypeError as ex:raise ValueError('Bearing token unavailable') from ex
    config={'leg_nm':values['LEGDIST']} if 'LEGDIST' in values else {'leg_minutes':values['LEGTIME']}
    result=hold_preview(fix_lat=row['anchor_lat'],fix_lon=row['anchor_lon'],
               inbound_true=course,turn_dir=direction,tas_kt=tas_kt,bank_deg=bank_deg,
               wind_from_true=wind_from_true,wind_kt=wind_kt,**config)
    result.update(source_segment_id=segment_id,source_node_seq=node_seq,
           source_fix=row['reference_fix'], bearing_frame_confirmed=verified_frame,
           verified_units_user_assertion=True, source_airac='2610',
           fmc_status='NOT_EXECUTABLE', legal_navigation_use=False)
    return result

def preview_bearing_intent(stage1,stage2,stage3,segment_id,node_seq,*,
                           start_lat,start_lon,verified_frame,variation_east_deg=None,
                           preview_duration_seconds=None,preview_distance_nm=None,
                           tas_kt=None,wind_from_true=None,wind_kt=None):
    """Explicit lab ray. TRACK is ground course; HEADING with wind drift."""
    verified(stage1,stage2,stage3)
    if (preview_duration_seconds is None)==(preview_distance_nm is None):
        raise ValueError('Exactly one independent preview distance/time needed')
    with closing(readonly(stage3)) as c:
        c.row_factory=sqlite3.Row
        row=c.execute('SELECT * FROM leg_intents WHERE segment_id=? AND node_seq=?',(segment_id,node_seq)).fetchone()
        if row is None or row['kind'] not in ('HEADING','TRACK'):
            raise ValueError('Heading/track intent not found')
        if 'INCOMPLETE_SOURCE_FILE' in json.loads(row['blockers_json']):
            raise ValueError('Incomplete source blocked')
        hdg=true_bearing(float(row['bearing_token']),frame=verified_frame,variation_east_deg=variation_east_deg)
        if row['kind']=='HEADING':
            if None in (tas_kt,wind_from_true,wind_kt):raise ValueError('Heading requires speed and explicit wind')
            v=ground_vector_from_heading(hdg,tas_kt,wind_from_true,wind_kt)
            course=v['ground_track_true_deg'];speed=v['groundspeed_kt']
        else:
            course=hdg
            speed=tas_kt
        if preview_distance_nm is None:
            if speed is None or speed<=0:raise ValueError('TAS or groundspeed needed for time-based preview')
            d=float(preview_duration_seconds)*speed/3600
        else:d=float(preview_distance_nm)
        if not 0<d<=100:raise ValueError('Preview length must be 0..100 NM')
        endpoint=destination_nm(start_lat,start_lon,course,d)
    return {'source_segment_id':segment_id,'source_node_seq':node_seq,
       'source_kind':row['kind'],'start':[start_lat,start_lon],
       'end':list(endpoint),'reference_course_true_deg':course,'distance_nm':d,
       'bearing_frame_confirmed':verified_frame,'flight_path_terminator':'UNRESOLVED',
       'status':'EXPLICIT_INPUT_MATH_PREVIEW_NOT_FMC_LEG'}

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--stage1',required=True);p.add_argument('--stage2',required=True);p.add_argument('--stage3',required=True)
 p.add_argument('airport');p.add_argument('kind',choices=('SID','STAR','APP'));p.add_argument('ident')
 p.add_argument('--runway');p.add_argument('--transition')
 a=p.parse_args()
 print(json.dumps(get_intents(a.stage1,a.stage2,a.stage3,a.airport,a.kind,a.ident,
                            runway=a.runway,transition=a.transition),indent=2))