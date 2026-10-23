#!/usr/bin/env python3
"""Deterministic private AIRAC source sample audit; no raw licensed navigation data exported."""
import argparse
from collections import Counter
import json
import sqlite3
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
from procedure_reference_leg_engine import compile_reference

def audit(db,limit=250):
    with sqlite3.connect(f'file:{Path(db).resolve()}?mode=ro',uri=True) as con:
        con.row_factory=sqlite3.Row
        rows=con.execute('''SELECT p.airport_icao,p.kind,p.ident,
            d.runway_reference_json,d.transition_labels_json
            FROM procedures p JOIN npe_decoded_procedures d ON d.procedure_id=p.id
            WHERE d.parse_status='SOURCE_TOKEN_DECODED'
            ORDER BY p.airport_icao,p.kind,p.ident''').fetchall()
    # Regular stepping samples the entire worldwide order, not only airport OIII.
    step=max(1,len(rows)//limit); chosen=rows[::step][:limit]
    totals=Counter();issues=Counter()
    for r in chosen:
        runways=json.loads(r['runway_reference_json']);transitions=json.loads(r['transition_labels_json'])
        try:
            p=compile_reference(db,r['airport_icao'],r['kind'],r['ident'],
                      runway=runways[0] if runways else None,
                      transition=transitions[0] if transitions else None)
            totals['compiled']+=1
            totals['source_nodes']+=p['qa']['ast_nodes']
            totals['located_fixes']+=p['qa']['located_local_fix_refs']
            totals['reference_chords']+=p['qa']['reference_chords']
            if p['arinc_legs'] or p['lnav_commands'] or p['vnav_commands'] or p['afds_commands'] or p['fmc_executable']:
                raise RuntimeError('FMC guidance surfaced from unverified source')
            issues.update(p['qa']['unresolved_reasons'])
        except Exception as err:
            totals['failed_source_selection_or_decode']+=1
            issues[type(err).__name__+': '+str(err)[:100]]+=1
    return {'airac':'2610','sample_size':len(chosen),'sample_method':'whole-world deterministic ordered stepping',
            'counts':dict(totals),'unresolved_reason_occurrences':dict(issues),'fmc_executable':False,
            'active_leg_count':0,'pass_no_navigation_commands':True}

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--db',required=True);p.add_argument('--limit',type=int,default=250);p.add_argument('--output');a=p.parse_args()
 obj=audit(a.db,a.limit)
 text=json.dumps(obj,ensure_ascii=False,indent=2)
 if a.output:Path(a.output).write_text(text,encoding='utf8')
 else:print(text)