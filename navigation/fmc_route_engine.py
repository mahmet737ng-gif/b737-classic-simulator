#!/usr/bin/env python3
"""Local/private 737 Classic FMC source-to-route adapter, AIRAC 2610 R1.

Generates measured reference segments from real private source coordinates.
Neither this module nor its output generates certified ARINC legs, magnetic
courses, autopilot commands or verified procedure turns. Simulation only.
No private input records are bundled or published with this source code.
"""
from __future__ import annotations
import hashlib
import json
import math
from pathlib import Path
import re
import sqlite3

AIRAC_MARKER = '//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1'
IDENT = re.compile(r'^[A-Z0-9]{2,8}$')
AIRPORT = re.compile(r'^[A-Z0-9]{4}$')
EARTH_NM = 3440.065

class NavError(ValueError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code=code

def normalize(value, pattern=IDENT):
    val = str(value).strip().upper()
    if not pattern.fullmatch(val):
        raise NavError('INVALID_IDENT', 'Invalid ICAO, fix, or airway identifier')
    return val

def arc(a, b):
    p1,l1,p2,l2=map(math.radians,(a['lat'],a['lon'],b['lat'],b['lon']))
    dp=p2-p1;dl=l2-l1
    k=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    distance=2*EARTH_NM*math.atan2(math.sqrt(k),math.sqrt(max(0,1-k)))
    y=math.sin(dl)*math.cos(p2)
    x=math.cos(p1)*math.sin(p2)-math.sin(p1)*math.cos(p2)*math.cos(dl)
    bearing=(math.degrees(math.atan2(y,x))+360)%360 if distance>0.00001 else None
    return round(distance,3), (round(bearing,3) if bearing is not None else None)

def open_db(path):
    path=Path(path).resolve(strict=True)
    if not path.is_file():raise NavError('SOURCE_UNAVAILABLE','Navigation source must be an existing local file')
    db=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True,check_same_thread=False)
    db.row_factory=sqlite3.Row
    db.execute('PRAGMA query_only=ON')
    return db

class NavigationEngine:
    def __init__(self,stage1,stage2=None,verify_hash=True):
        self.source=Path(stage1).resolve()
        self.db=open_db(self.source)
        self.geo=None
        self.source_hash=None
        meta=dict(self.db.execute('select key,value from metadata'))
        runs=list(self.db.execute('select source_marker from npe_decoder_runs'))
        if meta.get('cycle')!='2610' or meta.get('scope')!='WORLDWIDE' or len(runs)!=1 or runs[0][0]!=AIRAC_MARKER:
            raise NavError('AIRAC_PROVENANCE','Unrecognized worldwide 2610 source or NPE marker')
        self.cycle=meta['cycle']
        if stage2:
            self.geo=open_db(stage2)
            gm=dict(self.geo.execute('select key,value from meta'))
            if gm.get('source_marker')!=AIRAC_MARKER or gm.get('airac')!='2610' or gm.get('geometry_status')!='REFERENCE_ONLY_NOT_FMC_LEGS':
                raise NavError('STAGE2_PROVENANCE','Geometry overlay lacks matching source marker')
            if verify_hash:
                h=hashlib.sha256()
                with open(self.source,'rb') as fh:
                    for part in iter(lambda:fh.read(4*1024*1024),b''):h.update(part)
                self.source_hash=h.hexdigest()
                if self.source_hash!=gm.get('source_sha256'):
                    raise NavError('SOURCE_HASH_MISMATCH','Stage-2 geometry belongs to a different Stage-1 source')
        self.source_id='PMDG_WORLD_2610_WITH_PROCEDURES_R1'

    def close(self):
        self.db.close()
        if self.geo:self.geo.close()

    def status(self):
        return {'airac':self.cycle,'sourceId':self.source_id,'stage1Sha256':self.source_hash,
                'stage2':bool(self.geo),'fmcGuidanceEnabled':False,
                'routePreviewEnabled':True,'status':'SOURCE_REAL_REFERENCE_ROUTE_NONEXECUTABLE',
                'limitation':'Geodesics are TRUE reference courses, not magnetic, flyable ARINC legs or AFDS commands'}

    def airport(self,icao):
        icao=normalize(icao,AIRPORT)
        rows=list(self.db.execute('select icao,lat,lon,source_file,source_line from airports where icao=?',(icao,)))
        if len(rows)!=1:raise NavError('AIRPORT_MISSING_OR_AMBIGUOUS',icao+' airport lookup returned '+str(len(rows))+' entries')
        return dict(rows[0])

    def resolve(self, ident, near, max_radius=1100):
        ident=normalize(ident)
        rows=[]
        for table in ('waypoints','navaids','airports'):
            col='icao' if table=='airports' else 'ident'
            for item in self.db.execute(f'select {col} as ident,lat,lon,source_file,source_line from {table} where {col}=?',(ident,)):
                a=dict(item);a['source_table']=table
                a['distance_to_anchor_nm']=arc(near,a)[0]
                if a['distance_to_anchor_nm']<=max_radius:rows.append(a)
        if not rows:raise NavError('FIX_MISSING','No source coordinate for '+ident+' within '+str(max_radius)+' NM of last position')
        rows.sort(key=lambda x:x['distance_to_anchor_nm'])
        if len(rows)>1 and rows[1]['distance_to_anchor_nm']-rows[0]['distance_to_anchor_nm']<20 and arc(rows[0],rows[1])[0]>0.5:
            raise NavError('FIX_AMBIGUOUS',ident+' has multiple nearby, incompatible source positions')
        r=rows[0]
        return {k:r[k] for k in ('ident','lat','lon','source_file','source_line','source_table')}

    def airway(self, name, start, end_name):
        name=normalize(name);end_name=normalize(end_name)
        allrows=[dict(r) for r in self.db.execute('select seq,fix_ident as ident,lat,lon,source_file,source_line from airways where ident=? order by seq',(name,))]
        if not allrows:raise NavError('AIRWAY_NOT_FOUND',name+' does not exist')
        start_positions=[i for i,p in enumerate(allrows) if p['ident']==start['ident'] and arc(start,p)[0]<3]
        end_positions=[i for i,p in enumerate(allrows) if p['ident']==end_name]
        options=sorted((abs(j-i),i,j) for i in start_positions for j in end_positions if i!=j)
        if not options:raise NavError('AIRWAY_DISCONNECTED','Cannot connect '+start['ident']+' to '+end_name+' via '+name)
        if len(options)>1 and options[1][0]==options[0][0]:
            raise NavError('AIRWAY_AMBIGUOUS','Multiple equal source airway sequences')
        _,start_i,end_i=options[0]
        s=1 if end_i>start_i else -1
        points=allrows[start_i+s:end_i+s:s]
        if len(points)>100:raise NavError('AIRWAY_TOO_LONG','Airway section exceeds configured preview limit')
        prev=start
        for pt in points:
            if arc(prev,pt)[0]>300:raise NavError('AIRWAY_GAP','Airway has a discontinuity over 300 NM')
            prev=pt
        return [{**pt,'source_table':'airways','airway':name} for pt in points]

    def procedure_catalog(self,icao,kind=None,limit=100):
        icao=normalize(icao,AIRPORT)
        if kind is not None and kind not in ('SID','STAR','APP'):raise NavError('INVALID_KIND','Bad procedure kind')
        sql='''select p.id,p.kind,p.ident,d.parse_status,d.fmc_status,d.runway_reference_json,d.transition_labels_json
                 from procedures p join npe_decoded_procedures d on d.procedure_id=p.id where p.airport_icao=?'''
        args=[icao]
        if kind:sql+=' and p.kind=?';args.append(kind)
        sql+=' order by p.kind,p.ident limit ?';args.append(min(250,max(1,int(limit))))
        return [{'id':row['id'],'kind':row['kind'],'ident':row['ident'],
                'runways':json.loads(row['runway_reference_json']),
                'transitions':json.loads(row['transition_labels_json']),
                'sourceStatus':row['parse_status'],'guidanceEligible':False}
                for row in self.db.execute(sql,args)]

    def procedure_preview(self,icao,kind,ident,runway=None,transition=None):
        icao=normalize(icao,AIRPORT);ident=normalize(ident)
        if kind not in ('SID','STAR','APP'):raise NavError('INVALID_KIND','Bad procedure kind')
        records=list(self.db.execute('''select p.id,p.kind,p.ident,d.parse_status,d.runway_reference_json,d.transition_labels_json,f.archive_member,f.post_marker_sha256
          from procedures p join npe_decoded_procedures d on p.id=d.procedure_id
          join navdata_procedure_details n on n.procedure_id=p.id
          join navdata_procedure_files f on f.id=n.file_id
          where p.airport_icao=? and p.kind=? and p.ident=?''',(icao,kind,ident)))
        if len(records)!=1:raise NavError('PROCEDURE_MISSING_OR_AMBIGUOUS','No unique source procedure')
        row=records[0]
        if row['parse_status']!='SOURCE_TOKEN_DECODED':raise NavError('PROCEDURE_QUARANTINED','Incomplete/ambiguous source')
        runways=json.loads(row['runway_reference_json']);trans=json.loads(row['transition_labels_json'])
        if runway and normalize(runway) not in runways:raise NavError('INVALID_RUNWAY','Runway not stated in source')
        if transition and normalize(transition) not in trans:raise NavError('INVALID_TRANSITION','Transition not stated in source')
        sel=[]
        for s in self.db.execute('''select s.id,s.seq,s.segment_kind,s.qualifier,s.expression,s.post_marker_line from navdata_procedure_segments s where s.procedure_id=? order by s.seq''',(row['id'],)):
            if s['segment_kind']=='TRANSITION' and s['qualifier']!=transition:continue
            if s['segment_kind']=='RUNWAY_CLAUSE' and s['qualifier']!=runway:continue
            sd=dict(s)
            sd['referenceChords']=[]
            if self.geo:
                sd['referenceChords']=[dict(c) for c in self.geo.execute('''select start_ident,end_ident,start_lat,start_lon,end_lat,end_lon,distance_nm,initial_true_deg,status from reference_chords where segment_id=? order by first_node_seq''',(s['id'],))]
            sel.append(sd)
        return {'airport':icao,'kind':kind,'ident':ident,'runway':runway,'transition':transition,
                'sourceMember':row['archive_member'],'postMarkerSHA256':row['post_marker_sha256'],
                'segments':sel,'readyForFMC':False,'status':'SOURCE_PREVIEW_ONLY_UNVERIFIED_PATH_TERMINATORS',
                'warning':'Source segments must NOT be automatically connected into active FMC legs'}

    def route(self,request):
        if not isinstance(request,dict):raise NavError('INVALID_ROUTE','Route input must be an object')
        origin=self.airport(request.get('origin',''))
        origin={**origin,'ident':origin['icao']}
        dest=self.airport(request.get('destination',''))
        items=request.get('via')
        if not isinstance(items,list) or len(items)>40:raise NavError('INVALID_ROUTE','Route segments must be a list of maximum 40 entries')
        if len(items)==0:raise NavError('EMPTY_ROUTE','Add an explicit DCT fix or AIRWAY segment')
        points=[];last=origin
        for index,item in enumerate(items):
            if not isinstance(item,dict):raise NavError('INVALID_SEGMENT','Route entry must be typed')
            kind=item.get('type')
            if kind=='DCT':
                pos=self.resolve(item.get('to',''),last)
                if arc(last,pos)[0]>1100:raise NavError('DCT_TOO_FAR','Direct route requires a closer verified source fix')
                p=[{**pos,'via':'DCT'}]
            elif kind=='AIRWAY':p=[{**x,'via':normalize(item.get('airway',''))} for x in self.airway(item.get('airway',''),last,item.get('to',''))]
            else:raise NavError('UNSUPPORTED_SEGMENT','Only explicit DCT and AIRWAY are supported')
            points.extend(p)
            last=points[-1]
            if len(points)>250:raise NavError('TOO_MANY_LEGS','The route exceeds the preview limit')
        points.append({**dest,'ident':dest['icao'],'source_table':'airports','via':'DCT'})
        prior={**origin,'ident':origin['icao']};legs=[];cumulative=0
        for i,point in enumerate(points):
            nm,bearing=arc(prior,point)
            if nm>1100:raise NavError('LEG_TOO_FAR','Leg distance exceeds checked DCT limit')
            cumulative+=nm
            legs.append({'index':i+1,'from':prior['ident'],'to':point['ident'],
                         'lat':point['lat'],'lon':point['lon'],'via':point['via'],
                         'distanceNm':nm,'trueInitialTrackDeg':bearing,
                         'cumulativeDistanceNm':round(cumulative,3),
                         'sourceTable':point['source_table'],'sourceFile':point['source_file'],'sourceLine':point['source_line'],
                         'pathType':'REFERENCE_GEODESIC_ONLY'})
            prior=point
        return {'origin':origin['icao'],'destination':dest['icao'],'airac':self.cycle,'sourceId':self.source_id,
                'legs':legs,'totalDistanceNm':round(cumulative,3),
                'verification':'REAL_SOURCE_COORDINATES_REFERENCE_GEODESIC_ONLY',
                'fmcExecutable':False,'afdsCommands':False,
                'disclaimers':['TRUE bearings only; magnetic variation not solved','Direct great-circle segments are not ARINC path terminators',
                                'Procedure turns/holds/vectors and vertical guidance are not generated',
                                'Position/IRS and flight-deck guidance have not been connected']}