#!/usr/bin/env python3
"""Fail-closed source-token decoder for PMDG SID/STAR/APP AIRAC 2610 Rev.1.

Output is a *source-faithful instruction AST*, not ARINC-424/FMC flight legs.
Inputs must be the already-validated post-marker-only SQLite import. No pre-marker
bytes are used. Unrecognized spans are always preserved as UNRESOLVED.
Simulator development only; NOT for operational navigation.
"""
from __future__ import annotations
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3
import tempfile

AIRAC_MARKER = '//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1'
COMMANDS = frozenset(('RNW','FIX','TRK','HDG','TURN','HOLD','INTERCEPT','VECTORS','SPEED'))
TYPES = ('RUNWAY_REFERENCE','FIX_PASSAGE','TRACK','HEADING','TURN_DIRECT','HOLD',
         'RADIAL_INTERCEPT','ATC_VECTORS','SPEED_TOKEN','UNRESOLVED')


def numeric(s, minimum=0.0, maximum=100000.0):
    """Validate but preserve original numeric string; zero and decimals are valid."""
    try:
        v=float(s)
        if minimum<=v<=maximum and v==v and v not in (float('inf'),float('-inf')):
            return s
    except (TypeError,ValueError):
        pass
    return None


def valid_ident(s):
    return (s is not None and len(s)>0 and len(s)<=24 and
            all(c.isalnum() or c in '._-' for c in s))


class DecodeError(Exception):
    pass


def decode_expression(expression):
    """Return (source-preserving nodes, issues). No inferred geometry/flight-path terminator."""
    tokens=expression.split()
    n=len(tokens)
    nodes=[];issues=[]; i=0

    def append(kind, begin, end, **values):
        nodes.append({'seq':len(nodes), 'kind':kind,'token_start':begin,
                      'token_end_exclusive':end,'raw':' '.join(tokens[begin:end]),
                      'values':values, 'execution_status':'NOT_FMC_VERIFIED'})

    def unresolved(begin, end, reason):
        end=max(begin+1,end)
        append('UNRESOLVED',begin,end,reason=reason)
        issues.append({'token_start':begin,'token_end_exclusive':end,
                       'code':reason,'raw':' '.join(tokens[begin:end])})

    def parse_constraints(pos):
        constraints=[]
        while pos<n:
            if tokens[pos:pos+3]==['AT','OR','ABOVE'] and pos+3<n:
                v=numeric(tokens[pos+3]);
                if v is None:break
                constraints.append({'kind':'ALTITUDE_MIN_TOKEN','raw_value':v})
                pos+=4
            elif tokens[pos:pos+3]==['AT','OR','BELOW'] and pos+3<n:
                v=numeric(tokens[pos+3]);
                if v is None:break
                constraints.append({'kind':'ALTITUDE_MAX_TOKEN','raw_value':v})
                pos+=4
            elif tokens[pos]=='SPEED' and pos+1<n:
                v=numeric(tokens[pos+1],0,999)
                if v is None:break
                constraints.append({'kind':'SPEED_TOKEN','raw_value':v})
                pos+=2
            elif tokens[pos]=='ALT' and pos+1<n:
                v=numeric(tokens[pos+1]);
                if v is None:break
                constraints.append({'kind':'ALTITUDE_TOKEN','raw_value':v})
                pos+=2
            elif numeric(tokens[pos]) is not None:
                constraints.append({'kind':'ALTITUDE_EXACT_TOKEN','raw_value':tokens[pos]})
                pos+=1
            else:
                break
        return pos, constraints

    while i<n:
        begin=i
        tok=tokens[i]
        if tok=='RNW' and i+1<n and valid_ident(tokens[i+1]):
            i+=2
            append('RUNWAY_REFERENCE',begin,i,ident=tokens[begin+1],
                   semantic_role='NOT_ASSUMED_AS_APPLICABILITY_OR_THRESHOLD')
            continue
        if tok=='FIX':
            j=i+1; overfly=False
            if j<n and tokens[j]=='OVERFLY':overfly=True;j+=1
            if j<n and valid_ident(tokens[j]):
                ident=tokens[j];j+=1
                j,constraints=parse_constraints(j)
                append('FIX_PASSAGE',begin,j,ident=ident,overfly=overfly,
                       constraints=constraints)
                i=j;continue
        if tok in ('TRK','HDG') and i+1<n:
            bearing=numeric(tokens[i+1],0,360)
            if bearing is not None:
                j=i+2
                until=None
                if j<n and tokens[j]=='UNTIL' and j+1<n:
                    raw_val=numeric(tokens[j+1])
                    if raw_val is not None:
                        j+=2
                        if j+2<n and tokens[j] in ('FROM','TO') and tokens[j+1]=='FIX' and valid_ident(tokens[j+2]):
                            until={'kind':'DISTANCE_FROM_TO_FIX_TOKEN','raw_value':raw_val,
                                   'relation':tokens[j],'fix_ident':tokens[j+2]}
                            j+=3
                        else:
                            until={'kind':'ALTITUDE_UNTIL_TOKEN','raw_value':raw_val}
                append('TRACK' if tok=='TRK' else 'HEADING',begin,j,
                       bearing_token=bearing, until=until)
                i=j;continue
        if tok=='TURN' and i+3<n and tokens[i+1] in ('LEFT','RIGHT') and tokens[i+2]=='DIRECT' and tokens[i+3]=='FIX':
            j=i+4;overfly=False
            if j<n and tokens[j]=='OVERFLY':overfly=True;j+=1
            if j<n and valid_ident(tokens[j]):
                ident=tokens[j];j+=1
                j,constraints=parse_constraints(j)
                append('TURN_DIRECT',begin,j,direction=tokens[begin+1],
                       ident=ident,overfly=overfly,constraints=constraints)
                i=j;continue
        if tok=='INTERCEPT' and i+4<n and tokens[i+1]=='RADIAL':
            radial=numeric(tokens[i+2],0,360)
            if radial is not None and tokens[i+3] in ('TO','FROM') and tokens[i+4]=='FIX' and i+5<n and valid_ident(tokens[i+5]):
                j=i+6
                append('RADIAL_INTERCEPT',begin,j, radial_token=radial,
                       direction=tokens[begin+3],fix_ident=tokens[begin+5],
                       reference_navaid_unverified=True)
                i=j;continue
        if tok=='HOLD' and i+7<n and tokens[i:i+3]==['HOLD','AT','FIX'] and valid_ident(tokens[i+3]):
            j=i+4
            if j+2<n and tokens[j] in ('LEFT','RIGHT') and tokens[j+1]=='TURN' and tokens[j+2]=='INBOUNDCOURSE' and j+3<n:
                course=numeric(tokens[j+3],0,360)
                if course is not None:
                    j+=4;params=[]
                    while j+1<n and tokens[j] in ('ALT','SPEED','LEGTIME','LEGDIST'):
                        v=numeric(tokens[j+1])
                        if v is None:break
                        params.append({'kind':tokens[j], 'raw_value':v})
                        j+=2
                    append('HOLD',begin,j,fix_ident=tokens[begin+3],
                           direction=tokens[begin+4],inbound_course_token=course,
                           parameters=params)
                    i=j;continue
        if tok=='VECTORS':
            i+=1;append('ATC_VECTORS',begin,i);continue
        if tok=='SPEED' and i+1<n and numeric(tokens[i+1],0,999) is not None:
            i+=2;append('SPEED_TOKEN',begin,i,raw_value=tokens[i-1]);continue
        # Never jump past an unrecognized token nor silently reinterpret it.
        # Adjacent unknown tokens are kept in one unresolved span until a command.
        j=i+1
        while j<n and tokens[j] not in COMMANDS:j+=1
        unresolved(i,j,'UNRECOGNIZED_SYNTAX')
        i=j
    # Exact losslessness check: every original token belongs to exactly one node.
    reconstructed=[]
    for node in nodes:reconstructed.extend(node['raw'].split())
    if reconstructed!=tokens:
        raise AssertionError('Token preservation broken')
    return nodes,issues


DDL = '''
CREATE TABLE npe_decoder_runs (
  id INTEGER PRIMARY KEY, source_marker TEXT NOT NULL,
  decoder_version TEXT NOT NULL, created_utc TEXT NOT NULL,
  status TEXT NOT NULL, source_procedures INTEGER NOT NULL,
  source_segments INTEGER NOT NULL);
CREATE TABLE npe_decoded_segments (
  segment_id INTEGER PRIMARY KEY REFERENCES navdata_procedure_segments(id),
  procedure_id INTEGER NOT NULL REFERENCES procedures(id),
  token_count INTEGER NOT NULL, node_count INTEGER NOT NULL,
  unresolved_node_count INTEGER NOT NULL, ast_json TEXT NOT NULL,
  decode_status TEXT NOT NULL, raw_expression_sha256 TEXT NOT NULL);
CREATE TABLE npe_decoded_procedures (
  procedure_id INTEGER PRIMARY KEY REFERENCES procedures(id),
  source_file_status TEXT NOT NULL,
  segment_count INTEGER NOT NULL,
  total_nodes INTEGER NOT NULL,
  unresolved_nodes INTEGER NOT NULL,
  runway_reference_json TEXT NOT NULL,
  transition_labels_json TEXT NOT NULL,
  parse_status TEXT NOT NULL, fmc_status TEXT NOT NULL);
CREATE TABLE npe_decoder_issues (
  id INTEGER PRIMARY KEY, procedure_id INTEGER NOT NULL REFERENCES procedures(id),
  segment_id INTEGER NOT NULL REFERENCES navdata_procedure_segments(id),
  token_start INTEGER NOT NULL, code TEXT NOT NULL, raw_token_span TEXT NOT NULL);
CREATE INDEX npe_issue_proc_idx ON npe_decoder_issues(procedure_id);
CREATE INDEX npe_segment_proc_idx ON npe_decoded_segments(procedure_id);
CREATE INDEX npe_proc_status_idx ON npe_decoded_procedures(parse_status);
'''


def decode_db(input_db, output_db, report_path=None, *, expected_marker=AIRAC_MARKER):
    """Atomically create an enriched SQLite copy; never replace the source DB."""
    input_db=Path(input_db);output_db=Path(output_db)
    if input_db.resolve()==output_db.resolve():raise ValueError('input and output must differ')
    output_db.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix='.npe-stage1-',suffix='.sqlite',dir=output_db.parent)
    os.close(fd);tmp=Path(name);db=None
    try:
        # Online backup gives consistent copy without changing the source file.
        with sqlite3.connect(f'file:{input_db}?mode=ro',uri=True) as src, sqlite3.connect(tmp) as dst:
            src.backup(dst)
        db=sqlite3.connect(tmp)
        db.execute('PRAGMA foreign_keys=ON')
        db.execute('PRAGMA temp_store=MEMORY')
        # verify EVERY source file belongs to the strict post-header import
        batch_rows=db.execute('SELECT marker,airac_cycle,status FROM navdata_import_batches').fetchall()
        if len(batch_rows)!=1 or batch_rows[0][0]!=expected_marker or batch_rows[0][1]!='2610':
            raise ValueError('Incorrect/missing strict AIRAC source import batch')
        if db.execute("SELECT COUNT(*) FROM navdata_procedure_files WHERE marker_relative_line != 1 OR post_marker_line_count<1").fetchone()[0]:
            raise ValueError('Source file marker provenance invalid')
        if db.execute("SELECT COUNT(*) FROM navdata_procedure_segments WHERE post_marker_line<2").fetchone()[0]:
            raise ValueError('Pre-marker line detected in procedure segment')
        if db.execute("SELECT COUNT(*) FROM sqlite_master WHERE name='npe_decoder_runs'").fetchone()[0]:
            raise ValueError('Decoder already installed; do not overwrite source analysis')
        if db.execute('SELECT COUNT(*) FROM procedure_legs').fetchone()[0]:
            raise ValueError('Existing FMC legs unexpectedly present; refuse to overwrite')
        db.executescript(DDL)
        nprocs=db.execute('SELECT COUNT(*) FROM procedures').fetchone()[0]
        nsegs=db.execute('SELECT COUNT(*) FROM navdata_procedure_segments').fetchone()[0]
        db.execute('INSERT INTO npe_decoder_runs(source_marker,decoder_version,created_utc,status,source_procedures,source_segments) VALUES(?,?,?,?,?,?)',
                   (expected_marker,'NPE_STAGE1_v1',datetime.now(timezone.utc).isoformat(),'SOURCE_AST_NON_EXECUTABLE',nprocs,nsegs))
        counts=Counter();pending=[];pending_issues=[];acc={}
        query='''SELECT s.id,s.procedure_id,s.segment_kind,s.qualifier,s.expression,
                 f.status,f.airport_code,p.kind,p.ident
                 FROM navdata_procedure_segments s
                 JOIN navdata_procedure_details d ON d.procedure_id=s.procedure_id
                 JOIN navdata_procedure_files f ON f.id=d.file_id
                 JOIN procedures p ON p.id=s.procedure_id
                 ORDER BY s.procedure_id,s.seq'''
        def flush():
            if pending:
                db.executemany('INSERT INTO npe_decoded_segments VALUES(?,?,?,?,?,?,?,?)',pending)
                pending.clear()
            if pending_issues:
                db.executemany('INSERT INTO npe_decoder_issues(procedure_id,segment_id,token_start,code,raw_token_span) VALUES(?,?,?,?,?)',pending_issues)
                pending_issues.clear()
        for segment_id,proc_id,kind,qual,expression,file_status,airport,proc_kind,ident in db.execute(query):
            nodes,issues=decode_expression(expression)
            status='COMPLETE_TOKEN_DECODE' if not issues else 'PARTIAL_UNRESOLVED'
            pending.append((segment_id,proc_id,len(expression.split()),len(nodes),len(issues),
                            json.dumps(nodes,separators=(',',':'),ensure_ascii=True),status,
                            hashlib.sha256(expression.encode('utf-8')).hexdigest()))
            for issue in issues:
                pending_issues.append((proc_id,segment_id,issue['token_start'],issue['code'],issue['raw']))
            a=acc.get(proc_id)
            if a is None:
                a={'file_status':file_status,'segments':0,'nodes':0,'unresolved':0,
                   'runways':set(),'transitions':set()};acc[proc_id]=a
            a['segments']+=1;a['nodes']+=len(nodes);a['unresolved']+=len(issues)
            if kind=='RUNWAY_CLAUSE' and qual:a['runways'].add(qual)
            if kind=='TRANSITION' and qual:a['transitions'].add(qual)
            for node in nodes:
                counts['node_'+node['kind']]+=1
                if node['kind']=='RUNWAY_REFERENCE':a['runways'].add(node['values']['ident'])
            counts['segments']+=1
            if issues:counts['segments_with_unresolved']+=1
            if len(pending)>=5000:flush()
        flush()
        for pid,a in acc.items():
            is_clean= a['unresolved']==0 and a['file_status']=='SOURCE_STRUCTURE_OK'
            status='SOURCE_TOKEN_DECODED' if is_clean else 'UNRESOLVED_OR_SOURCE_INCOMPLETE'
            db.execute('INSERT INTO npe_decoded_procedures VALUES(?,?,?,?,?,?,?,?,?)',
                       (pid,a['file_status'],a['segments'],a['nodes'],a['unresolved'],
                        json.dumps(sorted(a['runways']),separators=(',',':')),
                        json.dumps(sorted(a['transitions']),separators=(',',':')),
                        status,'NOT_EXECUTABLE_UNTIL_VERIFIED'))
            counts['procedures']+=1
            counts['proc_'+status]+=1
        db.commit()
        qa=db.execute('PRAGMA quick_check').fetchone()[0]
        fk=db.execute('PRAGMA foreign_key_check').fetchall()
        if qa!='ok' or fk:raise ValueError(f'QA failed integrity={qa} FK={fk[:3]}')
        if counts['procedures']!=nprocs or counts['segments']!=nsegs:
            raise ValueError('Incomplete source coverage')
        if db.execute('SELECT COUNT(*) FROM procedure_legs').fetchone()[0]:
            raise ValueError('Decoder cannot activate FMC executable legs')
        report={'airac':'2610','revision':1,'marker':AIRAC_MARKER,
                'decoder':'NPE_STAGE1_v1','source_procedures':nprocs,'source_segments':nsegs,
                'counts':dict(counts),'fmc_active':False,'procedure_legs_populated':False,
                'sqlite_quick_check':qa,'foreign_keys_ok':not fk,
                'source_incomplete_files':[dict(airport=r[0],member=r[1],status=r[2]) for r in db.execute("SELECT airport_code,archive_member,status FROM navdata_procedure_files WHERE status!='SOURCE_STRUCTURE_OK'")],
                'notes':['AST does not imply path terminator or flyable leg',
                         'Numeric labels preserve source tokens; magnetic/true frame and leg physics remain unverified',
                         'No content preceding exact AIRAC header was used']}
        db.close();db=None
        os.replace(tmp,output_db)
        if report_path:
            path=Path(report_path);path.parent.mkdir(parents=True,exist_ok=True)
            path.write_text(json.dumps(report,indent=2),encoding='utf-8')
        return report
    finally:
        if db:db.close()
        if tmp.exists():tmp.unlink()


def cli():
    p=argparse.ArgumentParser()
    p.add_argument('--input',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--report',type=Path)
    args=p.parse_args()
    print(json.dumps(decode_db(args.input,args.output,args.report),indent=2))

if __name__=='__main__':cli()