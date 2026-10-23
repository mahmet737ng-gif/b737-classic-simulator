#!/usr/bin/env python3
"""AIRAC 2610 Stage-2 reference geometry; explicitly NOT a flight path / FMC leg generator.

Reads private Stage-1 source-faithful AST and writes a separate SQLite geometry overlay.
Every SidStars file was already filtered strictly from the exact AIRAC marker.
No pre-marker text is ever accessed. No point-to-point reference chord means a flyable path.
All distance/courses are spherical WGS84-radius approximations, courses TRUE.
For simulation development only; never for real-world navigation.
"""
from __future__ import annotations
import argparse
from collections import Counter,defaultdict
from contextlib import closing
from datetime import datetime,timezone
import hashlib
import json
import math
from pathlib import Path
import os
import sqlite3
import tempfile

AIRAC_MARKER = '//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1'
EARTH_NM=3440.065
GLOBAL_RADIUS_NM=350.0
COLLOCATION_NM=0.05
SOURCE_SCHEMA_VERSION=1
BUILD_ID='NPE_GEOMETRY_STAGE2_v1'
EXPLICIT_NODE_TYPES={'FIX_PASSAGE','TURN_DIRECT','HOLD','RADIAL_INTERCEPT','RUNWAY_REFERENCE'}
NON_GEOMETRIC_TYPES={'TRACK','HEADING','RADIAL_INTERCEPT','ATC_VECTORS','TURN_DIRECT','HOLD'}

DDL='''
PRAGMA foreign_keys=ON;
CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE point_nodes(
 segment_id INTEGER NOT NULL, node_seq INTEGER NOT NULL,
 procedure_id INTEGER NOT NULL, file_id INTEGER NOT NULL, airport_icao TEXT NOT NULL,
 node_kind TEXT NOT NULL, ident TEXT NOT NULL, lat REAL, lon REAL,
 resolution TEXT NOT NULL, source_table TEXT, source_id INTEGER,
 source_line INTEGER, airport_distance_nm REAL, candidate_count INTEGER NOT NULL,
 note TEXT NOT NULL, PRIMARY KEY(segment_id,node_seq),
 CHECK(lat BETWEEN -90 AND 90 OR lat IS NULL),
 CHECK(lon BETWEEN -180 AND 180 OR lon IS NULL));
CREATE TABLE reference_chords(
 segment_id INTEGER NOT NULL, first_node_seq INTEGER NOT NULL, second_node_seq INTEGER NOT NULL,
 procedure_id INTEGER NOT NULL, start_ident TEXT NOT NULL, end_ident TEXT NOT NULL,
 start_lat REAL NOT NULL,start_lon REAL NOT NULL,end_lat REAL NOT NULL,end_lon REAL NOT NULL,
 distance_nm REAL NOT NULL, initial_true_deg REAL, final_true_deg REAL,
 status TEXT NOT NULL DEFAULT 'REFERENCE_CHORD_NOT_FMC_LEG',
 PRIMARY KEY(segment_id,first_node_seq,second_node_seq));
CREATE TABLE geometry_events(
 segment_id INTEGER NOT NULL,node_seq INTEGER NOT NULL, procedure_id INTEGER NOT NULL,
 node_kind TEXT NOT NULL, source_raw TEXT NOT NULL, status TEXT NOT NULL,
 reason TEXT NOT NULL, PRIMARY KEY(segment_id,node_seq));
CREATE TABLE segment_qa(
 segment_id INTEGER PRIMARY KEY,procedure_id INTEGER NOT NULL,
 source_segment_kind TEXT NOT NULL, source_file_status TEXT NOT NULL,
 node_count INTEGER NOT NULL, point_nodes INTEGER NOT NULL,
 resolved_points INTEGER NOT NULL, unresolved_points INTEGER NOT NULL,
 reference_chords INTEGER NOT NULL, nongeometric_events INTEGER NOT NULL,
 build_status TEXT NOT NULL);
CREATE INDEX node_ident_idx ON point_nodes(airport_icao,ident);
CREATE INDEX node_proc_idx ON point_nodes(procedure_id);
CREATE INDEX chord_proc_idx ON reference_chords(procedure_id);
CREATE INDEX event_proc_idx ON geometry_events(procedure_id);
CREATE INDEX qa_proc_idx ON segment_qa(procedure_id);
'''

def coord_ok(lat,lon):
 return lat is not None and lon is not None and math.isfinite(lat) and math.isfinite(lon) and -90<=lat<=90 and -180<=lon<=180

def distance_nm(lat1,lon1,lat2,lon2):
 if not (coord_ok(lat1,lon1) and coord_ok(lat2,lon2)):raise ValueError('Invalid coordinates')
 a,b=math.radians(lat1),math.radians(lat2)
 dlon=math.radians((lon2-lon1+180)%360-180)
 h=math.sin((b-a)/2)**2+math.cos(a)*math.cos(b)*math.sin(dlon/2)**2
 return 2*EARTH_NM*math.asin(min(1,math.sqrt(h)))

def true_initial_course(lat1,lon1,lat2,lon2):
 if not (coord_ok(lat1,lon1) and coord_ok(lat2,lon2)):raise ValueError('Invalid coordinates')
 if distance_nm(lat1,lon1,lat2,lon2)<1e-8:return None
 a,b=math.radians(lat1),math.radians(lat2)
 dl=math.radians((lon2-lon1+180)%360-180)
 y=math.sin(dl)*math.cos(b)
 x=math.cos(a)*math.sin(b)-math.sin(a)*math.cos(b)*math.cos(dl)
 if abs(x)+abs(y)<1e-14:return None  # antipodal ambiguity
 return (math.degrees(math.atan2(y,x))+360)%360


def sha256_file(path):
 d=hashlib.sha256()
 with open(path,'rb') as f:
  for chunk in iter(lambda:f.read(4*1024*1024),b''):d.update(chunk)
 return d.hexdigest()


def source_check(c):
 rows=c.execute('SELECT marker,airac_cycle FROM navdata_import_batches').fetchall()
 if len(rows)!=1 or rows[0]!=(AIRAC_MARKER,'2610'):
  raise ValueError('Exact AIRAC 2610 post-marker provenance required')
 nr=c.execute('SELECT source_marker,status FROM npe_decoder_runs').fetchall()
 if len(nr)!=1 or nr[0][0]!=AIRAC_MARKER or nr[0][1]!='SOURCE_AST_NON_EXECUTABLE':
  raise ValueError('Stage 1 decoder or AIRAC gate not verified')
 if c.execute('SELECT COUNT(*) FROM navdata_procedure_files WHERE marker_relative_line != 1').fetchone()[0]:
  raise ValueError('A SidStars file has invalid post-marker provenance')
 if c.execute('SELECT COUNT(*) FROM navdata_procedure_segments WHERE post_marker_line < 2').fetchone()[0]:
  raise ValueError('A SidStars segment precedes the approved AIRAC marker')
 if c.execute('SELECT COUNT(*) FROM procedure_legs').fetchone()[0]:
  raise ValueError('Input has executable procedure legs; refuse unexpected mixed source')


def load_sources(c):
 """Read only normalized, provenance-preserving source point tables."""
 airports={r[0]:(r[1],r[2]) for r in c.execute('SELECT icao,lat,lon FROM airports')}
 # Scoped local fixes take absolute precedence over any global identifier matches.
 locals_by_file=defaultdict(dict)
 for fid,ident,pid,lat,lon,line in c.execute('SELECT file_id,ident,id,lat,lon,post_marker_line FROM navdata_local_fixes'):
  if ident in locals_by_file[fid]:raise ValueError('Duplicate local fix ident within same post-marker file')
  locals_by_file[fid][ident]=(pid,lat,lon,line)
 global_by_ident=defaultdict(list)
 for table in ('waypoints','navaids'):
  for ident,pid,lat,lon,line in c.execute(f'SELECT ident,id,lat,lon,source_line FROM {table}'):
   if coord_ok(lat,lon):global_by_ident[ident].append((table,pid,lat,lon,line))
 runways={}
 for icao,ident,pid,lat,lon,line in c.execute('SELECT airport_icao,runway_ident,id,lat,lon,source_line FROM runways'):
  if (icao,ident) in runways:raise ValueError('Duplicate runway ident in airport')
  runways[(icao,ident)]=(pid,lat,lon,line)
 return airports,locals_by_file,global_by_ident,runways


def resolve(ident,kind,airport_icao,file_id,sources):
 airports,local,world,runways=sources
 airport=airports.get(airport_icao)
 if kind=='RUNWAY_REFERENCE':
  v=runways.get((airport_icao,ident))
  if v:
   pid,lat,lon,line=v
   if coord_ok(lat,lon):
    dist=distance_nm(*airport,lat,lon) if airport else None
    return (lat,lon,'RUNWAY_SOURCE_ONLY','runways',pid,line,dist,1,'Runway position; semantic role NOT inferred')
  return (None,None,'UNRESOLVED_RUNWAY',None,None,None,None,0,'Runway identifier not uniquely located')
 v=local.get(file_id,{}).get(ident)
 if v:
  pid,lat,lon,line=v
  if not coord_ok(lat,lon):return (None,None,'INVALID_LOCAL_FIX',None,None,None,None,1,'Invalid local coordinate')
  dist=distance_nm(*airport,lat,lon) if airport else None
  note='Local AIRAC post-marker source takes precedence; not flyable'
  if dist is not None and dist>700:note+='; distance from airport exceeds 700 NM, review'
  return (lat,lon,'LOCAL_AIRAC_FIX','navdata_local_fixes',pid,line,dist,1,note)
 if airport is None:
  return (None,None,'AIRPORT_ANCHOR_MISSING',None,None,None,None,0,'Airport missing from worldwide source')
 candidates=[]
 for table,pid,lat,lon,line in world.get(ident,()):
  d=distance_nm(*airport,lat,lon)
  if d<=GLOBAL_RADIUS_NM:candidates.append((d,table,pid,lat,lon,line))
 if not candidates:
  return (None,None,'NOT_FOUND_IN_AIRPORT_REGION',None,None,None,None,0,'No local fix or global coordinate within 350 NM')
 candidates.sort(key=lambda x:(x[0],x[1],x[2]))
 first=candidates[0]
 # Same ident in approximately collocated fixes can come from duplicate global records;
 # reject if coordinates diverge, rather than choosing a conveniently nearby candidate.
 if any(distance_nm(first[3],first[4],x[3],x[4])>COLLOCATION_NM for x in candidates[1:]):
  return (None,None,'AMBIGUOUS_GLOBAL_IDENT',None,None,None,None,len(candidates),'Conflicting same-name global fixes in 350 NM radius')
 d,table,pid,lat,lon,line=first
 return (lat,lon,'GLOBAL_UNIQUE_NEAR_AIRPORT',table,pid,line,d,len(candidates),'Global within 350 NM; collocated duplicates allowed')


def source_node_ident(node):
 v=node['values']
 return (v.get('ident') if node['kind'] in ('FIX_PASSAGE','TURN_DIRECT','RUNWAY_REFERENCE')
         else v.get('fix_ident'))


def build(input_db,output_db,report_path=None,verify_sha=None):
 """Build a distinct geometry overlay, atomically. Stage1 stays untouched."""
 inp=Path(input_db).resolve();out=Path(output_db).resolve()
 if inp==out:raise ValueError('Input and output must be different files')
 if not inp.is_file():raise FileNotFoundError(inp)
 # Guarantee derived overlay knows exact source version.
 digest=sha256_file(inp)
 if verify_sha is not None and digest.lower()!=verify_sha.lower():
  raise ValueError('Stage1 SQLite SHA-256 mismatch')
 out.parent.mkdir(parents=True,exist_ok=True)
 fd,name=tempfile.mkstemp(prefix='.geom-stage2-',suffix='.sqlite',dir=out.parent)
 os.close(fd);temp=Path(name)
 stats=Counter();reasons=Counter();first_samples=[]
 try:
  with closing(sqlite3.connect(inp.as_uri()+'?mode=ro',uri=True)) as src, closing(sqlite3.connect(temp)) as dest:
   source_check(src)
   sources=load_sources(src)
   dest.executescript(DDL)
   for k,v in [('build_id',BUILD_ID),('airac','2610'),('source_sha256',digest),('source_filename',inp.name),('source_marker',AIRAC_MARKER),('geometry_status','REFERENCE_ONLY_NOT_FMC_LEGS'),('magnetic_variation','UNVERIFIED'),('source_schema_version',str(SOURCE_SCHEMA_VERSION))]:
    dest.execute('INSERT INTO meta(key,value) VALUES(?,?)',(k,v))
   q='''SELECT s.id,s.procedure_id,s.segment_kind,f.id,f.airport_code,f.status,d.ast_json
    FROM navdata_procedure_segments s
    JOIN navdata_procedure_details x ON x.procedure_id=s.procedure_id
    JOIN navdata_procedure_files f ON f.id=x.file_id
    JOIN npe_decoded_segments d ON d.segment_id=s.id
    ORDER BY s.id'''
   points_batch=[];chords_batch=[];events_batch=[];qa_batch=[]
   def flush():
    dest.executemany('INSERT INTO point_nodes VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',points_batch)
    dest.executemany('INSERT INTO reference_chords(segment_id,first_node_seq,second_node_seq,procedure_id,start_ident,end_ident,start_lat,start_lon,end_lat,end_lon,distance_nm,initial_true_deg,final_true_deg) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',chords_batch)
    dest.executemany('INSERT INTO geometry_events VALUES(?,?,?,?,?,?,?)',events_batch)
    dest.executemany('INSERT INTO segment_qa VALUES(?,?,?,?,?,?,?,?,?,?,?)',qa_batch)
    points_batch.clear();chords_batch.clear();events_batch.clear();qa_batch.clear()
   for sid,pid,segkind,file_id,airport,file_status,ast in src.execute(q):
    nodes=json.loads(ast)
    prior=None
    thispoint=thisresolved=thisunresolved=thischord=thisevent=0
    incomplete=(file_status!='SOURCE_STRUCTURE_OK')
    for node in nodes:
     kind=node['kind'];seq=node['seq']
     # Every non-passage instruction creates a hard barrier to direct-chord linking.
     if kind!='FIX_PASSAGE':prior=None
     if kind in EXPLICIT_NODE_TYPES:
      ident=source_node_ident(node)
      if not ident:
       r=(None,None,'UNRESOLVED_IDENT',None,None,None,None,0,'Node lacks explicit identifier')
      else:r=resolve(ident,kind,airport,file_id,sources)
      lat,lon,status,table,rowid,line,adist,candidates,note=r
      # All incomplete-source nodes are preserved for audit but excluded from display.
      if incomplete:
       status='QUARANTINED_INCOMPLETE_SOURCE';note='Source incomplete; geometric point prohibited'
       lat=lon=None;table=rowid=line=adist=None;candidates=0
      points_batch.append((sid,seq,pid,file_id,airport,kind,ident or '',lat,lon,status,table,rowid,line,round(adist,5) if adist is not None else None,candidates,note))
      thispoint+=1;stats['point_nodes']+=1;reasons[status]+=1
      if lat is None:thisunresolved+=1;stats['unresolved_points']+=1
      else:thisresolved+=1;stats['resolved_points']+=1
      # Reference chords ONLY for consecutive explicit FIX_PASSAGE nodes in SAME expression.
      if kind=='FIX_PASSAGE' and lat is not None:
       if prior is not None:
        pseq,pident,plat,plon=prior
        d=distance_nm(plat,plon,lat,lon)
        if d>1e-7:
         course=true_initial_course(plat,plon,lat,lon)
         final_course=true_initial_course(lat,lon,plat,plon)
         final_course=None if final_course is None else (final_course+180)%360
         chords_batch.append((sid,pseq,seq,pid,pident,ident,plat,plon,lat,lon,round(d,6),None if course is None else round(course,6),None if final_course is None else round(final_course,6)))
         thischord+=1;stats['reference_chords']+=1
       prior=(seq,ident,lat,lon)
      else:prior=None
     else:prior=None
     if kind in NON_GEOMETRIC_TYPES:
      event_status='BLOCKED_INCOMPLETE_SOURCE' if incomplete else 'NOT_EXECUTABLE_UNTIL_SEMANTICS_VERIFIED'
      if kind=='HOLD':reason='Hold anchor only: circuit, time/distance, true vs magnetic, entry are not verified'
      elif kind=='RADIAL_INTERCEPT':reason='Radial datum, bearing frame, ray intersection and leg termination not verified'
      elif kind=='TURN_DIRECT':reason='Turn radius, bank limits and flyby/overfly execution not verified'
      elif kind in ('TRACK','HEADING'):reason='Course/heading bearing frame and termination not verified; no ray is drawn'
      else:reason='ATC vectors are not a deterministic autonomous flight path'
      events_batch.append((sid,seq,pid,kind,node['raw'],event_status,reason));thisevent+=1;stats['nongeometric_events']+=1
     if kind=='UNRESOLVED':
      prior=None;stats['unknown_ast_nodes']+=1
    status='QUARANTINED_INCOMPLETE_SOURCE' if incomplete else 'REFERENCE_ONLY'
    qa_batch.append((sid,pid,segkind,file_status,len(nodes),thispoint,thisresolved,thisunresolved,thischord,thisevent,status))
    stats['segments']+=1
    if incomplete:stats['quarantined_segments']+=1
    if len(qa_batch)>=1200:flush()
   if qa_batch:flush()
   dest.commit()
   if dest.execute('PRAGMA quick_check').fetchone()[0]!='ok':raise ValueError('SQLite integrity failed')
   if dest.execute('PRAGMA foreign_key_check').fetchall():raise ValueError('Geometry foreign-key validation failed')
   stats['procedures']=src.execute('SELECT COUNT(*) FROM procedures').fetchone()[0]
   stats['source_fmc_legs']=src.execute('SELECT COUNT(*) FROM procedure_legs').fetchone()[0]
   stats['geometry_fmc_legs']=0
   if stats['segments']!=src.execute('SELECT COUNT(*) FROM navdata_procedure_segments').fetchone()[0]:
    raise ValueError('Missing source segments')
   if stats['source_fmc_legs']!=0:raise ValueError('Unsafe executable legs found')
  os.replace(temp,out)
  report={'build':BUILD_ID,'airac':'2610','source_sha256':digest,'overlay_sha256':sha256_file(out),
   'source_db':inp.name,'overlay_db':out.name,'stats':dict(stats),'resolution_breakdown':dict(reasons),
   'scope':'global read-only reference geometry','fmc_active':False,
   'limits':['only explicit local or strictly disambiguated global point positions',
    'reference chords are straight great-circle point-to-point measurements, NOT verified flight legs',
    'no crossing RUNWAY_CLAUSE, TRANSITION or independent source segment boundaries',
    'no TRK/HDG/intercept/hold/turn geometry until source semantics verified',
    'courses are TRUE; source bearing reference and magnetic variation not validated',
    'ZYYJ incomplete source blocked','strict AIRAC 2610 post-header input verified']}
  if report_path:
   rp=Path(report_path);rp.parent.mkdir(parents=True,exist_ok=True)
   rp.write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
  return report
 finally:
  if temp.exists():temp.unlink()


def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('source_stage1_sqlite',type=Path);p.add_argument('geometry_overlay_sqlite',type=Path)
 p.add_argument('--report',type=Path);p.add_argument('--sha256')
 a=p.parse_args()
 print(json.dumps(build(a.source_stage1_sqlite,a.geometry_overlay_sqlite,a.report,a.sha256),indent=2))

if __name__=='__main__':main()