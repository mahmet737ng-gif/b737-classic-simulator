#!/usr/bin/env python3
"""Fail-closed read-only CDU RTE and LEGS page models for NPE Stage 4.

Displays source-reference drafts only; no active FMC/autopilot data feed.
Never use for operational navigation.
"""
import argparse
import json
from pathlib import Path
import sqlite3
from flight_plan_engine import AIRAC_MARKER,VERSION,RouteError

ROWS_PER_PAGE=5

def open_drafts(db_path):
    p=Path(db_path).resolve()
    con=sqlite3.connect(p.as_uri()+'?mode=ro',uri=True)
    con.row_factory=sqlite3.Row
    try:
        meta=dict(con.execute('SELECT key,value FROM meta'))
        if (meta.get('version')!=VERSION or meta.get('airac')!='2610' or
            meta.get('source_marker')!=AIRAC_MARKER or meta.get('fmc_status')!='NOT_EXECUTABLE'):
            raise RouteError('Stage4 draft provenance or safety gate failed')
        return con
    except Exception:
        con.close()
        raise

def retrieve(db_path,plan_id=1):
    with open_drafts(db_path) as c:
        row=c.execute('SELECT payload_json,airac,status FROM plans WHERE id=?',(plan_id,)).fetchone()
        if row is None:raise LookupError('Draft flight plan not found')
        obj=json.loads(row['payload_json'])
        if obj.get('airac')!='2610' or obj.get('fmc_legs_activated')!=0 or obj.get('autopilot_guidance_enabled') is not False or obj.get('status')!=row['status']:
            raise RouteError('Attempt to read altered or activated plan')
        return obj

def page(db_path,plan_id=1,kind='LEGS',number=1):
    if kind not in ('LEGS','RTE'):raise RouteError('Only RTE or LEGS pages supported')
    if not isinstance(number,int) or isinstance(number,bool) or number<1:raise RouteError('Page number invalid')
    plan=retrieve(db_path,plan_id)
    rows=(plan['legs_page_model']['rows'] if kind=='LEGS' else plan['rte_page_model']['rows'])
    page_count=max(1,(len(rows)+ROWS_PER_PAGE-1)//ROWS_PER_PAGE)
    if number>page_count:raise RouteError('Page beyond available range')
    start=(number-1)*ROWS_PER_PAGE
    return {'page':kind,'page_number':number,'page_count':page_count,
            'origin':plan['origin'],'destination':plan['destination'],
            'rows':rows[start:start+ROWS_PER_PAGE],
            'discontinuities_remaining':plan['qa']['discontinuity_count'],
            'airac':'2610','fmc_status':'NOT_EXECUTABLE',
            'status_text':'DRAFT / NOT ACTIVE',
            'warning':'Course values are TRUE reference bearings, not FMC magnetic courses.'}

if __name__=='__main__':
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--db',required=True);ap.add_argument('--id',type=int,default=1)
    ap.add_argument('--page',choices=['RTE','LEGS'],default='LEGS')
    ap.add_argument('--number',type=int,default=1)
    args=ap.parse_args()
    print(json.dumps(page(args.db,args.id,args.page,args.number),indent=2))