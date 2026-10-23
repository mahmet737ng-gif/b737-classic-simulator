#!/usr/bin/env python3
"""Read-only geometry overlay API for NPE Stage2. Never emits executable FMC legs."""
import argparse
from functools import lru_cache
from contextlib import closing
import json
from pathlib import Path
import sqlite3

from route_geometry import AIRAC_MARKER, BUILD_ID,sha256_file
from npe_reader import get_procedure

@lru_cache(maxsize=4)
def hash_fingerprint(path,st_size,st_mtime_ns):
 return sha256_file(path)

def verify_overlay(stage1_db,overlay_db):
 stage1=Path(stage1_db).resolve();overlay=Path(overlay_db).resolve()
 with closing(sqlite3.connect(overlay.as_uri()+'?mode=ro',uri=True)) as c:
  m=dict(c.execute('SELECT key,value FROM meta'))
 if m.get('source_marker')!=AIRAC_MARKER or m.get('build_id')!=BUILD_ID or m.get('geometry_status')!='REFERENCE_ONLY_NOT_FMC_LEGS':
  raise ValueError('Unrecognized, uncertified geometry overlay')
 st=stage1.stat()
 if hash_fingerprint(str(stage1),st.st_size,st.st_mtime_ns)!=m.get('source_sha256'):
  raise ValueError('Stage-1 source checksum mismatch; refuse stale overlay')
 return m

def get_reference_geometry(stage1_db,overlay_db,icao,kind,ident,*,runway=None,transition=None):
 """Read an explicitly selected source variant; never join independent variants into a route."""
 verify_overlay(stage1_db,overlay_db)
 proc=get_procedure(stage1_db,icao,kind,ident,runway=runway,transition=transition)
 with closing(sqlite3.connect(Path(stage1_db).resolve().as_uri()+'?mode=ro',uri=True)) as src,closing(sqlite3.connect(Path(overlay_db).resolve().as_uri()+'?mode=ro',uri=True)) as geo:
  src.row_factory=sqlite3.Row;geo.row_factory=sqlite3.Row
  segments=[]
  for info in proc['segments']:
   matches=src.execute('SELECT id FROM navdata_procedure_segments WHERE procedure_id=? AND seq=?',(proc['procedure_id'],info['source_segment_seq'])).fetchall()
   if len(matches)!=1:raise ValueError('Source segment identity mismatch')
   sid=matches[0]['id']
   qa=geo.execute('SELECT * FROM segment_qa WHERE segment_id=?',(sid,)).fetchone()
   if qa is None or qa['build_status']!='REFERENCE_ONLY':raise ValueError('Segment not approved for reference geometry')
   points=[dict(row) for row in geo.execute('SELECT node_seq,node_kind,ident,lat,lon,resolution,source_table,source_id,source_line,airport_distance_nm,candidate_count,note FROM point_nodes WHERE segment_id=? ORDER BY node_seq',(sid,))]
   chords=[dict(row) for row in geo.execute('SELECT first_node_seq,second_node_seq,start_ident,end_ident,start_lat,start_lon,end_lat,end_lon,distance_nm,initial_true_deg,final_true_deg,status FROM reference_chords WHERE segment_id=? ORDER BY first_node_seq',(sid,))]
   events=[dict(row) for row in geo.execute('SELECT node_seq,node_kind,source_raw,status,reason FROM geometry_events WHERE segment_id=? ORDER BY node_seq',(sid,))]
   segments.append({'source_segment_seq':info['source_segment_seq'],'source_segment_kind':info['variant'],'qualifier':info['qualifier'],'source_post_marker_line':info['post_marker_line'],
       'reference_points':points,'reference_chords':[{**chord,'qa_flags':['LONG_REFERENCE_CHORD_REVIEW'] if chord['distance_nm']>200 else []} for chord in chords],'non_executable_events':events,
       'geometry_status':'REFERENCE_ONLY_NOT_FMC_LEGS'})
 return {'airport_icao':proc['airport_icao'],'procedure_id':proc['procedure_id'],'kind':kind,'ident':ident.upper(),
   'selected_runway':proc['selected_runway'],'selected_transition':proc['selected_transition'],
   'source_member':proc['source_member'],'source_post_marker_sha256':proc['post_marker_sha256'],
   'geometry_segments':segments,'fmc_status':'NOT_EXECUTABLE_UNTIL_VERIFIED',
   'course_reference':'TRUE_GEODESIC_REFERENCE_ONLY','note':'No connection across base, runway clauses and transitions; source semantics not validated.'}

def main():
 p=argparse.ArgumentParser(description=__doc__)
 p.add_argument('--db',required=True);p.add_argument('--geometry',required=True)
 p.add_argument('airport');p.add_argument('kind',choices=('SID','STAR','APP'));p.add_argument('ident')
 p.add_argument('--runway');p.add_argument('--transition')
 a=p.parse_args()
 print(json.dumps(get_reference_geometry(a.db,a.geometry,a.airport,a.kind,a.ident,runway=a.runway,transition=a.transition),indent=2,ensure_ascii=False))
if __name__=='__main__':main()