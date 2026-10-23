#!/usr/bin/env python3
"""AIRAC 2610 source-faithful procedure leg *reference* compiler for the B737 trainer.

Produces audited coordinate point/straight-chord previews, never ARINC 424 legs.
All input is the Stage1 post-EXACT-AIRAC-marker SQLite import. Every unknown,
heading, turn, radial-intercept, hold or missing-fix condition is fail-closed.
No lateral/vertical guidance or aircraft-control commands can be emitted.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import math
from pathlib import Path
import sqlite3
from typing import Any

from npe_reader import get_procedure, open_readonly
from flight_plan_engine import AIRAC_MARKER, haversine_nm, initial_true_course

VERSION='NPE_STAGE7_SOURCE_REFERENCE_v1'
KNOWN_KINDS=frozenset(('RUNWAY_REFERENCE','FIX_PASSAGE','TRACK','HEADING','TURN_DIRECT',
                       'HOLD','RADIAL_INTERCEPT','ATC_VECTORS','SPEED_TOKEN'))
SPECIAL_KINDS=frozenset(('RUNWAY_REFERENCE','TRACK','HEADING','TURN_DIRECT',
                         'HOLD','RADIAL_INTERCEPT','ATC_VECTORS','SPEED_TOKEN'))
MAX_PREVIEW_CHORD_NM=200

class LegReferenceError(ValueError):pass


def _require(condition:bool,message:str)->None:
    if not condition:raise LegReferenceError(message)


def _validate_batch(con):
    batch=con.execute('SELECT marker,airac_cycle FROM navdata_import_batches').fetchall()
    dec=con.execute('SELECT source_marker FROM npe_decoder_runs').fetchall()
    _require(len(batch)==1 and tuple(batch[0])==(AIRAC_MARKER,'2610') and
             len(dec)==1 and dec[0][0]==AIRAC_MARKER,
             'Exact AIRAC 2610 Rev.1 post-marker provenance required')


def _local_fixes(con,archive_member):
    files=con.execute('SELECT id FROM navdata_procedure_files WHERE archive_member=?',(archive_member,)).fetchall()
    _require(len(files)==1,'Nonunique or missing local airport source file')
    rows=con.execute('SELECT ident,lat,lon,post_marker_line FROM navdata_local_fixes WHERE file_id=?',
                     (files[0][0],)).fetchall()
    mapping={}
    for ident,lat,lon,line in rows:
        ident=str(ident or '').upper()
        if (not ident or lat is None or lon is None or not (-90<=lat<=90 and -180<=lon<=180)
                or type(line) is not int or line<=0):continue
        mapping.setdefault(ident,[]).append({'ident':ident,'lat':lat,'lon':lon,'post_marker_line':line})
    return mapping


def _fix_position(mapping,ident):
    rows=mapping.get(str(ident or '').upper(),[])
    if not rows:return None,'LOCAL_FIX_ABSENT'
    # Identical duplicate rows are harmless; coordinates must agree to 50 m.
    ref=rows[0]
    if any(haversine_nm(ref['lat'],ref['lon'],x['lat'],x['lon'])>0.027 for x in rows[1:]):
        return None,'LOCAL_FIX_DUPLICATE_COORDINATE_CONFLICT'
    return ref,None


def _raw_token_integrity(expr,nodes):
    words=expr.split()
    pos=0
    for node in nodes:
        begin=node.get('token_start');end=node.get('token_end_exclusive')
        _require(type(begin) is int and type(end) is int and begin==pos and
                 pos<end<=len(words), 'AST missing or overlapping token range')
        _require(' '.join(words[begin:end])==node.get('raw'), 'Decoded AST/source token mismatch')
        pos=end
    _require(pos==len(words), 'AST omits source tokens')


def compile_reference(stage1_db,airport,kind,ident,*,runway=None,transition=None):
    """Compile audit-only geometries. All output remains not-for-FMC-execution."""
    source=get_procedure(stage1_db,airport,kind,ident,runway=runway,transition=transition)
    _require(source['fmc_status']=='NOT_EXECUTABLE_UNTIL_VERIFIED' and
             source['source_member'].startswith('SidStars/') and
             isinstance(source.get('post_marker_sha256'),str) and
             len(source['post_marker_sha256'])==64,'Incorrect or unverifiable source identity')
    if source['available_runways'] and len(source['available_runways'])>1 and runway is None:
        raise LegReferenceError('Explicit runway selection required for ambiguous procedure')
    if source['available_transitions'] and len(source['available_transitions'])>1 and transition is None:
        raise LegReferenceError('Explicit transition selection required for ambiguous procedure')
    with open_readonly(stage1_db) as con:
        _validate_batch(con)
        local=_local_fixes(con,source['source_member'])
    segments=[];total_nodes=0;located=0;candidate_edges=0;warnings=set()
    for segment in source['segments']:
        _require(segment['parse_status']=='COMPLETE_TOKEN_DECODE','Non-complete source segment blocked')
        _require(type(segment['post_marker_line']) is int and segment['post_marker_line']>0,
                 'Invalid post-marker source line')
        nodes=segment['ast'];_require(isinstance(nodes,list),'Invalid decoded nodes')
        _raw_token_integrity(segment['expression'],nodes)
        events=[];edges=[];previous=None
        for n in nodes:
            kind_node=n.get('kind');_require(kind_node in KNOWN_KINDS,'Unsupported source token kind')
            _require(n.get('execution_status')=='NOT_FMC_VERIFIED','Forbidden already-active decoded token')
            ev={'seq':n['seq'],'kind':kind_node,'raw':n['raw'],
                'source':{'file':source['source_member'],'post_marker_line':segment['post_marker_line'],
                          'token_start':n['token_start'],'token_end':n['token_end_exclusive']},
                'arinc_path_terminator':None,'fmc_executable':False,
                'reference_status':'SOURCE_ONLY','blockers':['ARINC_PATH_TERMINATOR_UNVERIFIED']}
            total_nodes+=1
            if kind_node=='FIX_PASSAGE':
                fix=n.get('values',{}).get('ident')
                pos,reason=_fix_position(local,fix)
                if pos:
                    ev['fix']={'ident':pos['ident'],'lat':pos['lat'],'lon':pos['lon'],
                               'post_marker_line':pos['post_marker_line']}
                    ev['reference_status']='LOCAL_FIX_COORDINATE_VERIFIED'
                    located+=1
                    if previous is not None:
                        dist=haversine_nm(previous['lat'],previous['lon'],pos['lat'],pos['lon'])
                        if 0.005<dist<=MAX_PREVIEW_CHORD_NM:
                            edges.append({'from':previous['ident'],'to':pos['ident'],
                                'from_position':{'lat':previous['lat'],'lon':previous['lon']},
                                'to_position':{'lat':pos['lat'],'lon':pos['lon']},
                                'reference_distance_nm':round(dist,3),
                                'reference_true_course_deg':initial_true_course(previous['lat'],previous['lon'],pos['lat'],pos['lon']),
                                'geometry_kind':'REFERENCE_STRAIGHT_CHORD_NOT_FLYABLE_LEG',
                                'arinc_path_terminator':None,'fmc_executable':False})
                            candidate_edges+=1
                        else:
                            ev['blockers'].append('ZERO_LENGTH_OR_DISTANCE_REVIEW_REQUIRED')
                            warnings.add('ZERO_LENGTH_OR_DISTANCE_REVIEW_REQUIRED')
                    previous=pos
                else:
                    ev['blockers'].append(reason);warnings.add(reason);previous=None
                if n.get('values',{}).get('constraints'):
                    ev['source_constraints']=n['values']['constraints']
                    ev['blockers'].append('CONSTRAINT_SEMANTICS_NOT_VERIFIED')
            else:
                previous=None # Never extrapolate a line across ANY instruction, including runway markers.
                ev['blockers'].append(kind_node+'_SEMANTICS_AND_TERMINATOR_NOT_VERIFIED')
                warnings.add(kind_node+'_SEMANTICS_AND_TERMINATOR_NOT_VERIFIED')
                if n.get('values'):
                    ev['raw_values']=n['values']
            events.append(ev)
        segments.append({'variant':segment['variant'],'qualifier':segment['qualifier'],
             'source_segment_seq':segment['source_segment_seq'],
             'post_marker_line':segment['post_marker_line'],'source_expression_sha256':hashlib.sha256(segment['expression'].encode()).hexdigest(),
             'events':events,'reference_chords':edges,'status':'REFERENCE_ONLY_NOT_FMC_LEGS'})
    return {'version':VERSION,'airac':'2610','source_marker':AIRAC_MARKER,'airport':source['airport_icao'],
      'kind':source['kind'],'ident':source['ident'],'runway':source['selected_runway'],
      'transition':source['selected_transition'],'source_member':source['source_member'],
      'post_marker_sha256':source['post_marker_sha256'],'segments':segments,
      'qa':{'ast_nodes':total_nodes,'located_local_fix_refs':located,'reference_chords':candidate_edges,
            'unresolved_reasons':sorted(warnings)},
      'fmc_executable':False,'arinc_legs':[],'lnav_commands':[],'vnav_commands':[],
      'afds_commands':[],'complete_flyable_procedure':False,
      'status':'SOURCE_REFERENCE_GEOMETRY_ONLY'}


def main():
    p=argparse.ArgumentParser();p.add_argument('--stage1',required=True);p.add_argument('airport');p.add_argument('kind',choices=['SID','STAR','APP']);p.add_argument('ident')
    p.add_argument('--runway');p.add_argument('--transition');p.add_argument('--output');a=p.parse_args()
    result=compile_reference(a.stage1,a.airport,a.kind,a.ident,runway=a.runway,transition=a.transition)
    output=json.dumps(result,ensure_ascii=False,indent=2)
    if a.output:Path(a.output).write_text(output,encoding='utf8')
    else:print(output)

if __name__=='__main__':main()