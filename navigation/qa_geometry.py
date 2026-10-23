#!/usr/bin/env python3
"""Validate provenance, referential geometry, private sample API and fail-closed gates."""
from collections import Counter
from contextlib import closing
import argparse
import json
from pathlib import Path
import sqlite3

from geometry_reader import verify_overlay,get_reference_geometry
from route_geometry import distance_nm,true_initial_course,AIRAC_MARKER

SAMPLES=[('OIII','APP','ILS29R','29R'),('OIIE','APP','ILS29R','29R'),('OIMM','APP','ILS31RY','31R')]

def audit(stage1,overlay,outpath):
 meta=verify_overlay(stage1,overlay)
 with closing(sqlite3.connect(Path(stage1).resolve().as_uri()+'?mode=ro',uri=True)) as s, closing(sqlite3.connect(Path(overlay).resolve().as_uri()+'?mode=ro',uri=True)) as g:
  for c in (s,g):
   c.execute('PRAGMA query_only=ON')
   if c.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise AssertionError('SQLite integrity failed')
   if c.execute('PRAGMA foreign_key_check').fetchall():raise AssertionError('Foreign key violation')
  expected=s.execute('SELECT COUNT(*) FROM navdata_procedure_segments').fetchone()[0]
  got=g.execute('SELECT COUNT(*) FROM segment_qa').fetchone()[0]
  assert expected==got==236879,(expected,got)
  assert s.execute('SELECT COUNT(*) FROM procedure_legs').fetchone()[0]==0
  rows=g.execute('''SELECT e.segment_id,e.first_node_seq,e.second_node_seq,e.start_lat,e.start_lon,e.end_lat,e.end_lon,e.distance_nm,e.initial_true_deg,e.final_true_deg,
             a.node_kind,a.lat,a.lon,b.node_kind,b.lat,b.lon,e.status
            FROM reference_chords e
            JOIN point_nodes a ON a.segment_id=e.segment_id AND a.node_seq=e.first_node_seq
            JOIN point_nodes b ON b.segment_id=e.segment_id AND b.node_seq=e.second_node_seq''')
  verified=0;high=0;max_nm=0;examples=[]
  for row in rows:
   sid,first,last,slat,slon,elat,elon,dist,course,final,ak,alat,alon,bk,blat,blon,status=row
   assert last==first+1 and ak==bk=='FIX_PASSAGE', ('Disallowed flight chord',sid,first,last)
   assert (slat,slon,elat,elon)==(alat,alon,blat,blon), ('Point mismatch',sid)
   assert status=='REFERENCE_CHORD_NOT_FMC_LEG'
   recompute=distance_nm(slat,slon,elat,elon)
   assert abs(recompute-dist)<0.0000011, ('Distance mismatch',sid)
   assert course is None or abs(true_initial_course(slat,slon,elat,elon)-course)<0.0000011
   verified+=1
   if dist>200:
    high+=1
    if len(examples)<15:examples.append({'segment_id':sid,'reference_chord_distance_nm':dist})
   if dist>max_nm:max_nm=dist
  assert verified==g.execute('SELECT COUNT(*) FROM reference_chords').fetchone()[0]
  z=g.execute('''SELECT COUNT(*) FROM point_nodes n JOIN segment_qa q ON n.segment_id=q.segment_id
     WHERE q.source_file_status!='SOURCE_STRUCTURE_OK' AND (n.lat IS NOT NULL OR n.lon IS NOT NULL)''').fetchone()[0]
  assert z==0
  blocked_edges=g.execute('''SELECT COUNT(*) FROM reference_chords e JOIN segment_qa q ON e.segment_id=q.segment_id
     WHERE q.source_file_status!='SOURCE_STRUCTURE_OK' ''').fetchone()[0]
  assert blocked_edges==0
  stats={k:g.execute('SELECT COUNT(*) FROM '+table).fetchone()[0] for k,table in {
   'geometry_nodes':'point_nodes','reference_chords':'reference_chords',
   'source_segments':'segment_qa','non_exec_events':'geometry_events'}.items()}
  resolved=g.execute('SELECT resolution,COUNT(*) FROM point_nodes GROUP BY resolution ORDER BY COUNT(*) DESC').fetchall()
  samples={}
  for airport,kind,ident,runway in SAMPLES:
   d=get_reference_geometry(stage1,overlay,airport,kind,ident,runway=runway)
   assert d['fmc_status']=='NOT_EXECUTABLE_UNTIL_VERIFIED'
   samples[airport]={'procedure':ident,'segments':len(d['geometry_segments']),
      'points':sum(len(x['reference_points']) for x in d['geometry_segments']),
      'chords':sum(len(x['reference_chords']) for x in d['geometry_segments']),
      'non_executable_events':sum(len(x['non_executable_events']) for x in d['geometry_segments'])}
  result={'airac':'2610','source_marker':AIRAC_MARKER,'source_sha256':meta['source_sha256'],
     'geometry_build_id':meta['build_id'],'integrity_check':'ok','foreign_keys':'ok',
     'chord_source_node_consistency':'PASS_ALL','verified_reference_chords':verified,
     'longer_than_200_nm':high,'longest_reference_chord_nm':round(max_nm,6),
     'long_chord_review_samples':examples,'incomplete_source_nonnull_coordinates':z,
     'incomplete_source_reference_chords':blocked_edges,'counts':stats,
     'point_resolution_breakdown':dict(resolved),'airport_samples':samples,
     'fmc_navigation_active':False,
     'qa_warnings':['Long reference chords >200NM flagged for review; not necessarily incorrect',
       'No course magnetic/true conversion of source bearing tokens','Reference chords are not flyable legs or turn geometries']}
  Path(outpath).write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8')
  return result

def main():
 a=argparse.ArgumentParser();a.add_argument('source');a.add_argument('overlay');a.add_argument('--output',required=True);x=a.parse_args()
 print(json.dumps(audit(x.source,x.overlay,x.output),indent=2))
if __name__=='__main__':main()