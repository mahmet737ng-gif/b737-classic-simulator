#!/usr/bin/env python3
"""Stage 3 source-faithful leg intent classification, AIRAC 2610.

Classifies every Stage2 unresolved instruction from private source AST and adds
explicit blockers. Builds a SEPARATE private SQLite file. This classification
DOES NOT generate any executable FMC legs or silently infer magnetic variation.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import tempfile

MARKER='//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1'
VERSION='NPE_LEG_INTENTS_STAGE3_v1'
KINDS={'TRACK','HEADING','TURN_DIRECT','HOLD','RADIAL_INTERCEPT','ATC_VECTORS'}
DDL='''
PRAGMA foreign_keys=ON;
CREATE TABLE meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE leg_intents(
 segment_id INTEGER NOT NULL,node_seq INTEGER NOT NULL,procedure_id INTEGER NOT NULL,
 airport_icao TEXT NOT NULL,kind TEXT NOT NULL,raw_source TEXT NOT NULL,
 bearing_token TEXT,bearing_frame TEXT NOT NULL DEFAULT 'UNKNOWN',
 reference_fix TEXT,anchor_lat REAL,anchor_lon REAL,anchor_resolution TEXT,
 termination_token_json TEXT,required_inputs_json TEXT NOT NULL,
 blockers_json TEXT NOT NULL,
 geometry_readiness TEXT NOT NULL,
 fmc_status TEXT NOT NULL DEFAULT 'NOT_EXECUTABLE',
 PRIMARY KEY(segment_id,node_seq));
CREATE INDEX intents_airport_idx ON leg_intents(airport_icao,kind);
CREATE INDEX intents_proc_idx ON leg_intents(procedure_id);
CREATE TABLE summary(kind TEXT PRIMARY KEY,records INTEGER NOT NULL,anchored INTEGER NOT NULL,
 source_incomplete INTEGER NOT NULL,preview_ready INTEGER NOT NULL);
'''

def sha256(path):
 d=hashlib.sha256()
 with open(path,'rb') as f:
  for b in iter(lambda:f.read(4*1024*1024),b''):d.update(b)
 return d.hexdigest()

def classify(node,anchor,source_incomplete):
 k=node['kind'];v=node['values']; ref=v.get('fix_ident') or v.get('ident')
 bearing_token=v.get('bearing_token') if k in ('HEADING','TRACK') else v.get('radial_token') if k=='RADIAL_INTERCEPT' else v.get('inbound_course_token') if k=='HOLD' else None
 required=[]; blockers=[]
 if k in ('HEADING','TRACK'):
  required=['VERIFIED_BEARING_FRAME','VERIFIED_VARIATION_IF_MAG','KNOWN_START_STATE','VERIFIED_TERMINATOR']
  blockers=['BEARING_FRAME_NOT_PROVEN','TERMINATOR_NOT_VERIFIED','START_STATE_NOT_KNOWN']
  if k=='HEADING': required+=['TAS_KT','WIND_FROM_TRUE','WIND_KT'];blockers+=['HEADING_WIND_DRIFT_NOT_MODELED']
 if k=='RADIAL_INTERCEPT':
  required=['VERIFIED_RADIAL_NAVAID','VERIFIED_BEARING_FRAME','VERIFIED_VARIATION_IF_MAG','KNOWN_INBOUND_PATH','VERIFIED_TO_FROM_SEMANTICS']
  blockers=['RADIAL_REFERENCE_NOT_PROVEN','COURSE_TO_INTERCEPT_NOT_KNOWN','MAGNETIC_REFERENCE_NOT_VERIFIED']
 if k=='TURN_DIRECT':
  required=['KNOWN_START_POSITION','KNOWN_START_HEADING','TAS_KT','BANK_DEG','WIND','VERIFIED_TURN_AND_OVERFLY_SEMANTICS']
  blockers=['TURN_ENTRY_STATE_UNKNOWN','BANK_SPEED_MODEL_NOT_SOURCE_VERIFIED']
 if k=='HOLD':
  required=['RESOLVED_HOLD_FIX','VERIFIED_INBOUND_COURSE_FRAME','TAS_KT','BANK_DEG','WIND','VERIFIED_LEG_UNITS','HOLD_ENTRY_AND_EXIT']
  blockers=['HOLD_COURSE_FRAME_NOT_PROVEN','HOLD_ENTRY_EXIT_NOT_VERIFIED','FLIGHT_CONDITIONS_MISSING']
 if k=='ATC_VECTORS':
  required=['EXTERNAL_ATC_INSTRUCTIONS','MANUAL_TERMINATION']
  blockers=['ATC_HEADING_MANUAL_TERMINATION']
 if k in ('TURN_DIRECT','RADIAL_INTERCEPT','HOLD'):
  if not anchor or anchor[0] is None: blockers.append('REFERENCE_FIX_POSITION_UNRESOLVED')
 if source_incomplete: blockers.append('INCOMPLETE_SOURCE_FILE')
 # ALWAYS record non-executable even if positional anchor is known.
 return (str(bearing_token) if bearing_token is not None else None,ref,required,blockers)

def build(stage1,stage2,out,report_path=None):
 a,b,c=map(lambda x:Path(x).resolve(),(stage1,stage2,out))
 if not (a.is_file() and b.is_file()) or c in (a,b):raise ValueError('missing source or output would overwrite source')
 ah,bh=sha256(a),sha256(b)
 c.parent.mkdir(parents=True,exist_ok=True)
 fd,name=tempfile.mkstemp(prefix='.npe-stage3-',suffix='.sqlite',dir=str(c.parent));os.close(fd)
 tmp=Path(name);counts=Counter();anchored=Counter();quarantined=Counter()
 try:
  with sqlite3.connect(tmp) as dst,sqlite3.connect(f'file:{a}?mode=ro',uri=True) as src:
   src.execute('ATTACH DATABASE ? AS geo',(f'file:{b}?mode=ro',))
   marker=src.execute('SELECT marker FROM navdata_import_batches').fetchall()
   if marker != [(MARKER,)]:raise ValueError('strict AIRAC marker mismatch')
   source_marker=src.execute('SELECT source_marker,status FROM npe_decoder_runs').fetchall()
   if source_marker != [(MARKER,'SOURCE_AST_NON_EXECUTABLE')]:raise ValueError('stage1 decoder not authorized')
   geo_meta=dict(src.execute('SELECT key,value FROM geo.meta'))
   if geo_meta.get('source_sha256')!=ah or geo_meta.get('source_marker')!=MARKER:
    raise ValueError('stage2 is stale or source marker mismatch')
   if src.execute('SELECT COUNT(*) FROM procedure_legs').fetchone()[0] != 0:
    raise ValueError('source has executable legs unexpectedly')
   dst.executescript(DDL)
   for k,v in [('build_id',VERSION),('airac','2610'),('source_stage1_sha256',ah),('source_stage2_sha256',bh),('marker',MARKER),('fmc_status','NOT_EXECUTABLE'),('created_utc',datetime.now(timezone.utc).isoformat()),('preview_geometry','NONE_AUTO_GENERATED')]:
    dst.execute('INSERT INTO meta VALUES(?,?)',(k,v))
   query='''SELECT e.segment_id,e.node_seq,e.procedure_id,e.node_kind,e.source_raw,
                   ds.ast_json,p.airport_icao,dp.source_file_status,
                   pn.lat,pn.lon,pn.resolution
            FROM geo.geometry_events e
            JOIN npe_decoded_segments ds ON ds.segment_id=e.segment_id
            JOIN procedures p ON p.id=e.procedure_id
            JOIN npe_decoded_procedures dp ON dp.procedure_id=p.id
            LEFT JOIN geo.point_nodes pn ON pn.segment_id=e.segment_id AND pn.node_seq=e.node_seq
            ORDER BY e.segment_id,e.node_seq'''
   cur=src.execute(query)
   total=0
   for segid,seq,pid,kind,raw,ast,airport,status,lat,lon,resolution in cur:
    if kind not in KINDS:raise ValueError(f'unexpected geometry event type {kind}')
    nodes=json.loads(ast)
    if seq<0 or seq>=len(nodes):raise ValueError(f'AST node index out of range {segid}:{seq}')
    node=nodes[seq]
    if node['seq']!=seq or node['kind']!=kind or node['raw']!=raw:
     raise ValueError(f'AST/raw identity mismatch at {segid}:{seq}')
    incomplete=(status!='SOURCE_STRUCTURE_OK')
    bt,fix,req,blocks=classify(node,(lat,lon,resolution) if resolution else None,incomplete)
    required_json=json.dumps(req,separators=(',',':'))
    blockers_json=json.dumps(blocks,separators=(',',':'))
    until=node['values'].get('until')
    params=node['values'].get('parameters')
    details=until if until is not None else params if params is not None else node['values'].get('constraints')
    dst.execute('''INSERT INTO leg_intents(segment_id,node_seq,procedure_id,airport_icao,kind,raw_source,
                  bearing_token,reference_fix,anchor_lat,anchor_lon,anchor_resolution,
                  termination_token_json,required_inputs_json,blockers_json,geometry_readiness)
                  VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)''',
                  (segid,seq,pid,airport,kind,raw,bt,fix,lat,lon,resolution,
                   json.dumps(details,separators=(',',':')) if details is not None else None,
                   required_json,blockers_json,'BLOCKED_INCOMPLETE_SOURCE' if incomplete else 'PARAMETERIZED_MATH_ONLY'))
    counts[kind]+=1
    if lat is not None:anchored[kind]+=1
    if incomplete:quarantined[kind]+=1
    total+=1
   for kind in sorted(counts):
    dst.execute('INSERT INTO summary VALUES(?,?,?,?,?)',(kind,counts[kind],anchored[kind],quarantined[kind],0))
   expected=src.execute('SELECT COUNT(*) FROM geo.geometry_events').fetchone()[0]
   if total!=expected or total!=sum(counts.values()):raise ValueError('not all geometry events classified')
   if dst.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('SQLite integrity failed')
  os.replace(tmp,c)
  report={'version':VERSION,'airac':'2610','stage1_sha256':ah,'stage2_sha256':bh,
   'intent_total':total,'kinds':dict(counts),'anchored':dict(anchored),
   'source_incomplete':dict(quarantined),'auto_generated_fmc_legs':0,
   'auto_generated_flight_paths':0,'metadata_status':'NON_EXECUTABLE',
   'disclaimer':'Source-framed intents only; no actual magnetic or heading/wind inputs inferred.'}
  if report_path:
   Path(report_path).write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
  return report
 finally:
  if tmp.exists():tmp.unlink()

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--stage1',required=True);p.add_argument('--stage2',required=True)
 p.add_argument('--output',required=True);p.add_argument('--report')
 x=p.parse_args()
 print(json.dumps(build(x.stage1,x.stage2,x.output,x.report),indent=2))