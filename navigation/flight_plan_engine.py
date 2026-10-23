#!/usr/bin/env python3
"""AIRAC 2610 private-data Flight Plan DRAFT composer for B737 Classic.

Never creates verified flyable legs or autopilot guidance. It preserves procedure
source statements as non-executable blocks and uses only exact airways coordinates.
Not for real-world navigation.
"""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
from functools import lru_cache
import json
import math
import os
from pathlib import Path
import sqlite3
import tempfile
from typing import Any

AIRAC_MARKER = '//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1'
CYCLE = '2610'
VERSION = 'NPE_STAGE4_FLIGHT_PLAN_DRAFT_v1'
MAX_JUNCTION_SEPARATION_NM = 0.25
MAX_AIRWAY_SECTION = 500

class RouteError(ValueError): pass


def haversine_nm(lat1, lon1, lat2, lon2):
    earth_nm=3440.065
    phi1,phi2=map(math.radians,(lat1,lat2))
    delta_lat=phi2-phi1
    delta_lon=math.radians(lon2-lon1)
    a=math.sin(delta_lat/2)**2+math.cos(phi1)*math.cos(phi2)*math.sin(delta_lon/2)**2
    return 2*earth_nm*math.asin(min(1.0,math.sqrt(max(0,a))))


def initial_true_course(lat1, lon1, lat2, lon2):
    p1,p2=map(math.radians,(lat1,lat2))
    dl=math.radians(lon2-lon1)
    y=math.sin(dl)*math.cos(p2)
    x=math.cos(p1)*math.sin(p2)-math.sin(p1)*math.cos(p2)*math.cos(dl)
    if abs(x)+abs(y)<1e-13: return None
    return round(math.degrees(math.atan2(y,x))%360,3)


def normalize_ident(v):
    if not isinstance(v,str) or not v or len(v)>32 or not all(c.isalnum() or c in '-_.' for c in v):
        raise RouteError('Invalid empty/nonliteral identifier')
    return v.upper()


def load_airway_section(conn, ident, entry, exit_fix):
    """Return uniquely identified directed contiguous airway sequence or fail closed."""
    ident,entry,exit_fix=map(normalize_ident,(ident,entry,exit_fix))
    rows=[dict(r) for r in conn.execute('''SELECT id, ident, seq, fix_ident, lat, lon, source_file, source_line
        FROM airways WHERE ident=? ORDER BY seq, id''',(ident,))]
    if not rows: raise RouteError(f'Airway {ident} absent')
    begin=[i for i,r in enumerate(rows) if r['fix_ident'].upper()==entry]
    end=[i for i,r in enumerate(rows) if r['fix_ident'].upper()==exit_fix]
    if len(begin)!=1 or len(end)!=1: raise RouteError(f'Ambiguous/missing {ident} entry={entry} exit={exit_fix}')
    a,b=begin[0],end[0]
    if a==b: raise RouteError(f'Airway {ident} entry=exit is not a leg')
    step=1 if b>a else -1
    selected=[rows[i] for i in range(a,b+step,step)]
    if len(selected)>MAX_AIRWAY_SECTION:raise RouteError('Airway section exceeds safety cap')
    for i,r in enumerate(selected):
        if not (-90<=r['lat']<=90 and -180<=r['lon']<=180):
            raise RouteError(f'Invalid coordinates {ident} {r["fix_ident"]}')
        if i and r['seq']-selected[i-1]['seq']!=step:
            raise RouteError(f'Airway {ident} has missing/repeated sequence at {r["seq"]}')
    return selected


def unique_airport(con, ident):
    icao=normalize_ident(ident)
    rows=con.execute('SELECT icao,lat,lon,source_file,source_line FROM airports WHERE icao=?',(icao,)).fetchall()
    if len(rows)!=1:raise RouteError(f'Airport {icao} missing or ambiguous')
    return dict(rows[0])


def append_gap(items, reason, before, after):
    if items and items[-1].get('type')=='DISCONTINUITY' and items[-1].get('reason')==reason:
        return
    items.append({'type':'DISCONTINUITY','label':'ROUTE DISCONTINUITY','reason':reason,
                  'before':before,'after':after,'required_action':'EXPLICIT_VERIFY_AND_RESOLVE',
                  'fmc_status':'NOT_EXECUTABLE'})


def select_procedure(db_path, airport, kind, data):
    if data is None:return None
    if not isinstance(data,dict) or 'ident' not in data: raise RouteError(f'Invalid {kind} selection')
    # Import the strict Stage1 getter; never infer base/transition stitching.
    from npe_reader import get_procedure
    ident=normalize_ident(data['ident'])
    runway=normalize_ident(data['runway']) if data.get('runway') else None
    transition=normalize_ident(data['transition']) if data.get('transition') else None
    try:r=get_procedure(db_path,airport,kind,ident,runway=runway,transition=transition)
    except (LookupError,ValueError) as e:raise RouteError(f'{kind} {ident}: {e}') from e
    # Crucial: a runway/transition clause is not silently inserted or reordered.
    return {'kind':kind,'ident':ident,'selected_runway':r['selected_runway'],
            'selected_transition':r['selected_transition'],
            'available_runways':r['available_runways'],
            'available_transitions':r['available_transitions'],
            'source_member':r['source_member'],
            'post_marker_sha256':r['post_marker_sha256'],
            'source_statement_refs':[{'seq':s['source_segment_seq'],
               'kind':s['variant'],'qualifier':s['qualifier'],
               'post_marker_line':s['post_marker_line'],
               'parse_status':s['parse_status']} for s in r['segments']],
            'status':'SELECTED_SOURCE_ONLY', 'fmc_status':'NOT_EXECUTABLE'}


def validate_sources(stage1,stage2,stage3):
    from leg_preview_reader import verified
    # Checks Stage3 marker, inactivity, and immutable SHA-256 chain Stage1 and Stage2.
    try:m=verified(stage1,stage2,stage3)
    except (ValueError,sqlite3.Error,OSError) as e:
        raise RouteError(f'Source-chain validation failed: {e}') from e
    with sqlite3.connect(Path(stage1).resolve().as_uri()+'?mode=ro',uri=True) as c:
        a=c.execute('SELECT source_marker FROM npe_decoder_runs').fetchall()
        b=c.execute('SELECT marker,airac_cycle FROM navdata_import_batches').fetchall()
    if len(a)!=1 or a[0][0]!=AIRAC_MARKER or len(b)!=1 or b[0]!=(AIRAC_MARKER,CYCLE):
        raise RouteError('AIRAC header/source-batch mismatch: reject pre-marker data')
    return {'airac':CYCLE,'stage3_version':m.get('build_id'),
            'stage1_sha256':m.get('source_stage1_sha256'),
            'stage2_sha256':m.get('source_stage2_sha256'),
            'stage3_fmc_status':m.get('fmc_status')}


def compose(stage1,stage2,stage3,request,*,source_chain=None):
    """Build candidate sequence, RTE/LEGS page models, and mandatory discontinuities."""
    if not isinstance(request,dict):raise RouteError('Flight plan JSON object required')
    if not source_chain:source_chain=validate_sources(stage1,stage2,stage3)
    origin=normalize_ident(request['origin']);destination=normalize_ident(request['destination'])
    if origin==destination:raise RouteError('Same origin/destination requires a different explicit workflow')
    airway_spec=request.get('enroute',[])
    if not isinstance(airway_spec,list) or len(airway_spec)>30:raise RouteError('Enroute must be <=30 route sections')
    departure=select_procedure(stage1,origin,'SID',request.get('departure'))
    arrival=select_procedure(stage1,destination,'STAR',request.get('arrival'))
    approach=select_procedure(stage1,destination,'APP',request.get('approach'))
    if arrival and approach and arrival['selected_runway'] and approach['selected_runway'] and arrival['selected_runway']!=approach['selected_runway']:
        raise RouteError('Arrival and approach explicit runway selections conflict')
    if not request.get('departure') and not request.get('arrival') and not request.get('approach') and not airway_spec:
        raise RouteError('Empty route without selections')
    with sqlite3.connect(Path(stage1).resolve().as_uri()+'?mode=ro',uri=True) as con:
        con.row_factory=sqlite3.Row
        depairport=unique_airport(con,origin);destairport=unique_airport(con,destination)
        sections=[]
        for j,s in enumerate(airway_spec):
            if not isinstance(s,dict):raise RouteError('Route section must be an object')
            mode=s.get('type','AIRWAY')
            if mode=='AIRWAY':
                air=normalize_ident(s['ident'])
                rows=load_airway_section(con,air,s['entry'],s['exit'])
            elif mode=='DCT':
                # Caller must choose the exact global waypoint ID; duplicate idents
                # may exist worldwide and must NEVER be arbitrarily resolved.
                pk=s.get('waypoint_id')
                if not isinstance(pk,int) or isinstance(pk,bool) or pk<=0:
                    raise RouteError('DCT requires exact positive waypoint_id')
                ident=normalize_ident(s.get('ident'))
                found=con.execute('''SELECT id,ident AS fix_ident,lat,lon,source_file,source_line
                    FROM waypoints WHERE id=? AND ident=?''',(pk,ident)).fetchall()
                if len(found)!=1:raise RouteError('Selected DCT ID/ident is absent or mismatched')
                row=dict(found[0]);row['seq']=None
                rows=[row];air='DCT'
            else:raise RouteError('Unsupported route type (only AIRWAY/DCT)')
            sections.append({'index':j,'type':mode,'airway':air,'entry':rows[0]['fix_ident'],
                             'exit':rows[-1]['fix_ident'],'points':rows})
    items=[{'type':'AIRPORT','label':origin,'position':[depairport['lat'],depairport['lon']],
            'source_file':depairport['source_file'],'source_line':depairport['source_line'],
            'role':'ORIGIN','fmc_status':'NOT_EXECUTABLE'}]
    if departure:
        items.append({'type':'PROCEDURE','label':departure['ident'],'kind':'SID','detail':departure,
                      'fmc_status':'SOURCE_ONLY'})
    if sections:
        append_gap(items,'DEPARTURE_TO_ENROUTE_UNVERIFIED',departure['ident'] if departure else origin,sections[0]['entry'])
    previous=None
    total_nm=0.0
    for sec in sections:
        points=sec['points']
        if previous is not None and sec['type']=='AIRWAY':
            gap_nm=haversine_nm(previous['lat'],previous['lon'],points[0]['lat'],points[0]['lon'])
            if previous['fix_ident']!=points[0]['fix_ident'] or gap_nm>MAX_JUNCTION_SEPARATION_NM:
                append_gap(items,'AIRWAY_JUNCTION_UNVERIFIED',previous['fix_ident'],points[0]['fix_ident'])
                previous=None
        for idx,p in enumerate(points):
            # Distinct shared source fix only once when consecutive sections meet exactly.
            if previous is not None and idx==0 and previous['fix_ident']==p['fix_ident'] and haversine_nm(previous['lat'],previous['lon'],p['lat'],p['lon'])<=MAX_JUNCTION_SEPARATION_NM:
                previous=p
                continue
            dist=round(haversine_nm(previous['lat'],previous['lon'],p['lat'],p['lon']),3) if previous is not None else None
            course=initial_true_course(previous['lat'],previous['lon'],p['lat'],p['lon']) if previous is not None else None
            if dist is not None:total_nm+=dist
            items.append({'type':'FIX','label':p['fix_ident'],'via':sec['airway'],
                          'lat':p['lat'],'lon':p['lon'],
                          'reference_leg_distance_nm':dist,
                          'reference_course_true_deg':course,
                          'course_is_magnetic':False,
                          'source_file':p['source_file'],'source_line':p['source_line'],
                          'airway_seq':p['seq'],
                          'warning':('USER_REQUESTED_DIRECT_REFERENCE_ONLY' if sec['type']=='DCT' else 'REFERENCE_CHORD_ONLY') if dist is not None else 'UNJOINED_START',
                          'fmc_status':'NOT_EXECUTABLE'})
            previous=p
    last=previous['fix_ident'] if previous else departure['ident'] if departure else origin
    if arrival:
        append_gap(items,'ENROUTE_TO_STAR_UNVERIFIED',last,arrival['ident'])
        items.append({'type':'PROCEDURE','label':arrival['ident'],'kind':'STAR','detail':arrival,'fmc_status':'SOURCE_ONLY'})
        last=arrival['ident']
    if approach:
        append_gap(items,'STAR_TO_APPROACH_UNVERIFIED' if arrival else 'ENROUTE_TO_APPROACH_UNVERIFIED',last,approach['ident'])
        items.append({'type':'PROCEDURE','label':approach['ident'],'kind':'APP','detail':approach,'fmc_status':'SOURCE_ONLY'})
        last=approach['ident']
    append_gap(items,'DESTINATION_TERMINAL_LINK_UNVERIFIED',last,destination)
    items.append({'type':'AIRPORT','label':destination,'position':[destairport['lat'],destairport['lon']],
                  'source_file':destairport['source_file'],'source_line':destairport['source_line'],
                  'role':'DESTINATION','fmc_status':'NOT_EXECUTABLE'})
    rte_rows=[{'via':s['airway'],'to':s['exit'],'from':s['entry'],'status':'REFERENCE_ONLY', 'route_type':s['type']} for s in sections]
    if departure:rte_rows.insert(0,{'via':'SID','to':departure['ident'],'status':'SELECTED_SOURCE_ONLY'})
    if arrival:rte_rows.append({'via':'STAR','to':arrival['ident'],'status':'SELECTED_SOURCE_ONLY'})
    if approach:rte_rows.append({'via':'APP','to':approach['ident'],'status':'SELECTED_SOURCE_ONLY'})
    legs_rows=[]
    for i,item in enumerate(items):
        text='----- ROUTE DISCONTINUITY -----' if item['type']=='DISCONTINUITY' else item['label']
        legs_rows.append({'index':i,'ident':text,'type':item['type'],
                          'via':item.get('via'),'reference_distance_nm':item.get('reference_leg_distance_nm'),
                          'reference_course_true_deg':item.get('reference_course_true_deg'),
                          'altitude_constraint':'UNRESOLVED','speed_constraint':'UNRESOLVED',
                          'status':item.get('fmc_status'),'manual_action':item.get('required_action')})
    discontinuities=sum(x['type']=='DISCONTINUITY' for x in items)
    return {'engine':VERSION,'airac':CYCLE,'source_marker':AIRAC_MARKER,
            'origin':origin,'destination':destination,'origin_airport':depairport,'destination_airport':destairport,
            'selected_departure':departure,'selected_arrival':arrival,'selected_approach':approach,
            'enroute_sections':rte_rows, 'items':items,'rte_page_model':{'origin':origin,'destination':destination,
            'rows':rte_rows},'legs_page_model':{'rows':legs_rows,'rows_per_page':5},
            'qa':{'reference_airway_distance_nm':round(total_nm,3),
                  'discontinuity_count':discontinuities,
                  'airway_fix_row_count':sum(i['type']=='FIX' for i in items),
                  'source_chain':source_chain,
                  'source_endpoints_not_inferred':True},
            'status':'DRAFT_WITH_DISCONTINUITIES_NOT_FMC_EXECUTABLE',
            'fmc_legs_activated':0,'autopilot_guidance_enabled':False,
            'caution':'Airway/direct great-circle segments are only enroute references; no turns, magnetic courses, altitude constraints, procedure sequencing or guidance.'}


def store_snapshot(db_path,plans):
    """Atomic local SQLite snapshot, containing licensed route extracts; NEVER push to public repository."""
    target=Path(db_path);target.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix='.stage4-',suffix='.sqlite',dir=target.parent)
    os.close(fd);tmp=Path(name)
    try:
        with sqlite3.connect(tmp) as con:
            con.executescript('''CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
                CREATE TABLE plans(id INTEGER PRIMARY KEY,origin TEXT NOT NULL,destination TEXT NOT NULL,
                    airac TEXT NOT NULL,status TEXT NOT NULL,discontinuities INTEGER NOT NULL,
                    payload_json TEXT NOT NULL);
                CREATE TABLE plan_items(plan_id INTEGER NOT NULL REFERENCES plans(id),seq INTEGER NOT NULL,
                    item_type TEXT NOT NULL,label TEXT NOT NULL,record_json TEXT NOT NULL,
                    PRIMARY KEY(plan_id,seq)); PRAGMA foreign_keys=ON;''')
            for k,v in [('version',VERSION),('airac',CYCLE),('source_marker',AIRAC_MARKER),
                        ('usage','PRIVATE_SIMULATOR_DRAFT_ONLY'),('fmc_status','NOT_EXECUTABLE'),
                        ('created_utc',datetime.now(timezone.utc).isoformat())]:
                con.execute('INSERT INTO meta VALUES(?,?)',(k,v))
            for plan in plans:
                i=con.execute('INSERT INTO plans(origin,destination,airac,status,discontinuities,payload_json) VALUES(?,?,?,?,?,?)',
                      (plan['origin'],plan['destination'],CYCLE,plan['status'],plan['qa']['discontinuity_count'],
                       json.dumps(plan,separators=(',',':'),ensure_ascii=False))).lastrowid
                con.executemany('INSERT INTO plan_items VALUES(?,?,?,?,?)',
                   [(i,n,it['type'],it['label'],json.dumps(it,ensure_ascii=False)) for n,it in enumerate(plan['items'])])
            if con.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise RouteError('Database integrity failure')
        os.replace(tmp,target)
    finally:
        if tmp.exists():tmp.unlink()


def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--stage1',required=True);ap.add_argument('--stage2',required=True);ap.add_argument('--stage3',required=True)
    ap.add_argument('--request',required=True);ap.add_argument('--output',required=True);ap.add_argument('--sqlite-output')
    args=ap.parse_args()
    req=json.loads(Path(args.request).read_text('utf-8'))
    result=compose(args.stage1,args.stage2,args.stage3,req)
    Path(args.output).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    if args.sqlite_output:store_snapshot(args.sqlite_output,[result])
    print(json.dumps({'origin':result['origin'],'destination':result['destination'],
        'enroute_fixes':result['qa']['airway_fix_row_count'],
        'discontinuities':result['qa']['discontinuity_count'],
        'fmc_activated':result['fmc_legs_activated']},indent=2))

if __name__=='__main__':main()