#!/usr/bin/env python3
"""Read-only source AST API for future B737 Classic FMC/CDU development.
No FMC activation, map geometry, or automatically combined flight legs.
Never use for real-world navigation.
"""
import argparse
import json
from pathlib import Path
import sqlite3

VALID_KINDS=('SID','STAR','APP')


def open_readonly(db_path):
    path=Path(db_path).resolve()
    con=sqlite3.connect(path.as_uri()+'?mode=ro',uri=True)
    con.row_factory=sqlite3.Row
    marker=con.execute('SELECT source_marker FROM npe_decoder_runs').fetchall()
    from procedure_decoder import AIRAC_MARKER
    if len(marker)!=1 or marker[0]['source_marker']!=AIRAC_MARKER:
        con.close();raise ValueError('Unrecognized AIRAC decoder provenance')
    return con


def list_procedures(db_path, airport_icao, kind=None, runway=None, include_incomplete=False):
    if kind and kind not in VALID_KINDS:raise ValueError('Unsupported procedure kind')
    with open_readonly(db_path) as c:
        query='''SELECT p.id,p.airport_icao,p.kind,p.ident,d.runway_reference_json,
                  d.transition_labels_json,d.parse_status,d.fmc_status
                  FROM procedures p JOIN npe_decoded_procedures d ON d.procedure_id=p.id
                  WHERE p.airport_icao=?'''
        args=[airport_icao.upper().strip()]
        if kind:query+=' AND p.kind=?';args.append(kind)
        rows=[]
        for record in c.execute(query,args):
            row=dict(record)
            row['runways']=json.loads(row.pop('runway_reference_json'))
            row['transitions']=json.loads(row.pop('transition_labels_json'))
            if not include_incomplete and row['parse_status']!='SOURCE_TOKEN_DECODED':continue
            # A specific runway is selectable only with explicit source support.
            if runway is not None and runway.upper() not in row['runways']:continue
            rows.append(row)
        return rows


def get_procedure(db_path, airport_icao, kind, ident, *, runway=None, transition=None):
    """Return source variants without inventing leg ordering between base/variants.

    If runway/transition is omitted, the variant is not silently selected.
    All results are explicitly marked non-executable.
    """
    if kind not in VALID_KINDS:raise ValueError('Invalid kind')
    with open_readonly(db_path) as c:
        rows=c.execute('''SELECT p.id,d.*,f.archive_member,f.post_marker_sha256
                   FROM procedures p JOIN npe_decoded_procedures d ON p.id=d.procedure_id
                   JOIN navdata_procedure_details det ON det.procedure_id=p.id
                   JOIN navdata_procedure_files f ON f.id=det.file_id
                   WHERE p.airport_icao=? AND p.kind=? AND p.ident=?''',
                   (airport_icao.upper(),kind,ident.upper())).fetchall()
        if not rows:raise LookupError('Procedure not found')
        if len(rows)!=1:raise ValueError('Ambiguous same-named procedures; manual source resolution needed')
        record=rows[0]
        if record['parse_status']!='SOURCE_TOKEN_DECODED':
            raise ValueError('Source has unresolved or incomplete procedures')
        runways=json.loads(record['runway_reference_json'])
        transitions=json.loads(record['transition_labels_json'])
        if runway is not None and runway.upper() not in runways:
            raise ValueError('Runway not explicitly supported by source')
        if transition is not None and transition.upper() not in transitions:
            raise ValueError('Transition not explicitly supported by source')
        segments=[]
        for s in c.execute('''SELECT s.seq,s.segment_kind,s.qualifier,s.expression,s.post_marker_line,
                  d.ast_json,d.decode_status FROM navdata_procedure_segments s
                  JOIN npe_decoded_segments d ON d.segment_id=s.id
                  WHERE s.procedure_id=? ORDER BY s.seq''',(record['id'],)):
            if s['segment_kind']=='RUNWAY_CLAUSE' and (runway is None or s['qualifier']!=runway.upper()):continue
            if s['segment_kind']=='TRANSITION' and (transition is None or s['qualifier']!=transition.upper()):continue
            segments.append({'source_segment_seq':s['seq'],'variant':s['segment_kind'],
                             'qualifier':s['qualifier'],'expression':s['expression'],
                             'post_marker_line':s['post_marker_line'],
                             'ast':json.loads(s['ast_json']), 'parse_status':s['decode_status']})
        return {'procedure_id':record['id'],'airport_icao':airport_icao.upper(),
                'kind':kind,'ident':ident.upper(),'available_runways':runways,
                'available_transitions':transitions,'selected_runway':runway.upper() if runway else None,
                'selected_transition':transition.upper() if transition else None,
                'source_member':record['archive_member'],'post_marker_sha256':record['post_marker_sha256'],
                'segments':segments,'fmc_status':'NOT_EXECUTABLE_UNTIL_VERIFIED',
                'important':'Segments are independent source statements; no inferred connectivity or leg ordering.'}


def main():
    ap=argparse.ArgumentParser()
    ap.add_argument('--db',required=True)
    sub=ap.add_subparsers(dest='command',required=True)
    listing=sub.add_parser('list');listing.add_argument('icao');listing.add_argument('--kind',choices=VALID_KINDS);listing.add_argument('--runway')
    get=sub.add_parser('get');get.add_argument('icao');get.add_argument('kind',choices=VALID_KINDS);get.add_argument('ident');get.add_argument('--runway');get.add_argument('--transition')
    args=ap.parse_args()
    result=list_procedures(args.db,args.icao,args.kind,args.runway) if args.command=='list' else get_procedure(args.db,args.icao,args.kind,args.ident,runway=args.runway,transition=args.transition)
    print(json.dumps(result,indent=2,ensure_ascii=False))

if __name__=='__main__':main()