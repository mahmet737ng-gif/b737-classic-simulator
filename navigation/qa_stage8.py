#!/usr/bin/env python3
"""Private stage-1 complete source coding gate, stage-4 route QA.
Only publishes aggregate counts. Does not export licensed source rows.
"""
from __future__ import annotations
import argparse,collections,json,sqlite3
from pathlib import Path
from npe_stage8 import AIRAC_MARKER,stage4_reference_chords

CODE_KEYS={'arinc_path_terminator','path_terminator','arinc424_leg_type'}

def audit(stage1:str,stage4:str)->dict:
    r={}
    with sqlite3.connect('file:'+Path(stage1).resolve().as_posix()+'?mode=ro',uri=True) as c:
        a=c.execute('SELECT marker,airac_cycle FROM navdata_import_batches').fetchall()
        b=c.execute('SELECT source_marker FROM npe_decoder_runs').fetchall()
        if len(a)!=1 or tuple(a[0])!=(AIRAC_MARKER,'2610') or len(b)!=1 or b[0][0]!=AIRAC_MARKER:
            raise ValueError('Strict exact AIRAC source marker violated')
        proc=c.execute('SELECT COUNT(*) FROM procedures').fetchone()[0]
        stated=c.execute('SELECT COUNT(*) FROM procedure_legs WHERE path_terminator IS NOT NULL').fetchone()[0]
        kinds=collections.Counter();tokens=0;segments=0;explicit_ast=0
        for ast_raw, in c.execute('SELECT ast_json FROM npe_decoded_segments ORDER BY segment_id'):
            nodes=json.loads(ast_raw)
            if not isinstance(nodes,list):raise ValueError('Unexpected AST shape')
            for n in nodes:
                tokens+=1;kinds[n.get('kind','UNKNOWN')]+=1
                if any(k in n and n[k] not in (None,'') for k in CODE_KEYS):explicit_ast+=1
            segments+=1
        r['procedures_scanned']=proc;r['source_segments_scanned']=segments
        r['decoded_nodes_scanned']=tokens;r['types']=dict(kinds)
        r['source_424_coded_legs']=stated;r['explicit_arinc_types_in_ast']=explicit_ast
    with sqlite3.connect('file:'+Path(stage4).resolve().as_posix()+'?mode=ro',uri=True) as c:
        planrows=c.execute('SELECT id,payload_json FROM plans ORDER BY id').fetchall()
        previews=[]
        for id,raw in planrows:
            p=json.loads(raw)
            ref=stage4_reference_chords(p)
            previews.append({'plan_id':id,'airac':ref['airac'],
                             'fix_to_fix_reference_chords':ref['qa']['chords'],
                             'hard_discontinuities':ref['qa']['hard_discontinuities']})
        r['stage4_reference_plans']=previews
    r['evidence_result']='EXPLICIT_ARINC_LEG_CODING_NOT_PRESENT_IN_CURRENT_INPUT' if not stated and not explicit_ast else 'EXPLICIT_CODING_PRESENT_REQUIRES_RECORD_QA'
    r['fmc_leg_activations']=0
    r['source_markers_before_cutoff_used']=0
    r['scope']='SIMULATOR_REFERENCE_ONLY_NOT_NAVIGATION'
    return r

def main():
    p=argparse.ArgumentParser();p.add_argument('--stage1',required=True);p.add_argument('--stage4',required=True);p.add_argument('--out');a=p.parse_args()
    result=audit(a.stage1,a.stage4)
    formatted=json.dumps(result,indent=2,sort_keys=True)
    if a.out:Path(a.out).write_text(formatted+'\n')
    else:print(formatted)
if __name__=='__main__':main()