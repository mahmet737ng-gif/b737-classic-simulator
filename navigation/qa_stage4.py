#!/usr/bin/env python3
"""Check private draft Flight Plan and cross-reference every enroute record."""
import argparse
import hashlib
import json
from pathlib import Path
import sqlite3
from flight_plan_engine import AIRAC_MARKER,VERSION,haversine_nm,RouteError
from flight_plan_reader import retrieve

def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as fh:
        for block in iter(lambda:fh.read(1024*1024),b''):h.update(block)
    return h.hexdigest()

def audit(stage1,stage4,plan_id=1):
    draft=retrieve(stage4,plan_id)
    assert draft['source_marker']==AIRAC_MARKER and draft['engine']==VERSION
    assert draft['fmc_legs_activated']==0 and draft['autopilot_guidance_enabled'] is False
    with sqlite3.connect(Path(stage4).resolve().as_uri()+'?mode=ro',uri=True) as con:
        assert con.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
        assert con.execute('PRAGMA foreign_key_check').fetchall()==[]
    with sqlite3.connect(Path(stage1).resolve().as_uri()+'?mode=ro',uri=True) as db:
        recon=0
        for item in draft['items']:
            if item['type']!='FIX':continue
            table='waypoints' if item['via']=='DCT' else 'airways'
            if table=='airways':
                sql='''SELECT COUNT(*) FROM airways WHERE ident=? AND seq=? AND fix_ident=?
                       AND lat=? AND lon=? AND source_file=? AND source_line=?'''
                args=(item['via'],item['airway_seq'],item['label'],item['lat'],item['lon'],item['source_file'],item['source_line'])
            else:
                sql='''SELECT COUNT(*) FROM waypoints WHERE ident=? AND lat=? AND lon=? AND source_file=? AND source_line=?'''
                args=(item['label'],item['lat'],item['lon'],item['source_file'],item['source_line'])
            if db.execute(sql,args).fetchone()[0]!=1:raise RouteError('Draft fix source provenance fails: '+item['label'])
            recon+=1
    assert draft['qa']['airway_fix_row_count']==recon
    gap_count=sum(i['type']=='DISCONTINUITY' for i in draft['items'])
    assert gap_count==draft['qa']['discontinuity_count']
    assert all(i['fmc_status']=='NOT_EXECUTABLE' for i in draft['items'] if i['type']=='DISCONTINUITY')
    assert all(x['altitude_constraint']=='UNRESOLVED' and x['speed_constraint']=='UNRESOLVED'
               for x in draft['legs_page_model']['rows'])
    return {'status':'PASS','source_airac':'2610','stage4_source_marker_exact':True,
      'source_fix_rows_verified':recon,'discontinuities_verified':gap_count,
      'fmc_legs_activated':0,'stage4_sha256':sha(stage4)}

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--stage1',required=True);p.add_argument('--stage4',required=True)
 args=p.parse_args();print(json.dumps(audit(args.stage1,args.stage4),indent=2))