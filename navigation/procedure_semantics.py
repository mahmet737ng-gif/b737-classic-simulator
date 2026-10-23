"""Stage6 SID/STAR/APP structural semantics gate, not executable FMC legs.

Only reads Stage1 records that have already been imported from after the exact
AIRAC header. No inferred ARINC path terminators or missing constraints.
"""
from collections import Counter
from npe_reader import get_procedure, list_procedures
from flight_plan_engine import AIRAC_MARKER

RISKS = {
 'RUNWAY_REFERENCE':'RUNWAY_ROLE_NOT_PROVEN',
 'FIX_PASSAGE':'PATH_TERMINATOR_TF_DF_CF_NOT_PROVEN',
 'TRACK':'TRACK_FRAME_AND_TERMINATION_NOT_PROVEN',
 'HEADING':'HEADING_FRAME_WIND_AND_TERMINATION_NOT_PROVEN',
 'TURN_DIRECT':'TURN_RADIUS_AND_DIRECT_TERMINATOR_NOT_PROVEN',
 'HOLD':'HOLD_ENTRY_LENGTH_TURN_AND_EXIT_NOT_PROVEN',
 'RADIAL_INTERCEPT':'RADIAL_DEFINITION_GEOMETRY_AND_INTERCEPT_NOT_PROVEN',
 'ATC_VECTORS':'ATC_INSTRUCTIONS_REQUIRE_PILOT_CLEARANCE',
 'SPEED_TOKEN':'SPEED_CONSTRAINT_APPLICABILITY_NOT_PROVEN',
}

class ProcedureGateError(ValueError):pass

def catalog(db, airport, kind):
    if not (isinstance(airport,str) and len(airport)==4 and airport.isalpha()):
        raise ProcedureGateError('Airport must be a four-letter ICAO identifier')
    if kind not in ('SID','STAR','APP'):raise ProcedureGateError('Invalid procedure kind')
    rows=list_procedures(db,airport.upper(),kind)
    return [{'ident':r['ident'],'runways':sorted(set(r['runways'])),
             'transitions':sorted(set(r['transitions'])),
             'status':'SOURCE_ONLY_NOT_FMC_EXECUTABLE'} for r in rows]

def inspect(db,airport,kind,ident,runway=None,transition=None):
    result=get_procedure(db,airport,kind,ident,runway=runway,transition=transition)
    if result.get('fmc_status')!='NOT_EXECUTABLE_UNTIL_VERIFIED' or not result['source_member'].startswith('SidStars/'):
        raise ProcedureGateError('Invalid source evidence')
    nodes=Counter();risks=Counter();lines=[]
    for segment in result['segments']:
        if segment['parse_status']!='COMPLETE_TOKEN_DECODE':
            raise ProcedureGateError('Source segment has incomplete tokens')
        types=[]
        for node in segment['ast']:
            k=node['kind']; nodes[k]+=1;types.append(k)
            risks[RISKS.get(k,'UNKNOWN_PATH_TERMINATOR_SEMANTICS')]+=1
            if node.get('execution_status') != 'NOT_FMC_VERIFIED':
                raise ProcedureGateError('Unexpected active source token')
        lines.append({'post_marker_line':segment['post_marker_line'],
                      'kind':segment['variant'],'qualifier':segment['qualifier'],
                      'token_kinds':types,'status':'SOURCE_ONLY'})
    return {'airport':airport.upper(),'kind':kind,'ident':ident.upper(),
            'runway':result['selected_runway'],'transition':result['selected_transition'],
            'source_member':result['source_member'],'post_marker_sha256':result['post_marker_sha256'],
            'source_airac_marker':AIRAC_MARKER, 'node_count':sum(nodes.values()),
            'token_kinds':dict(nodes),'blocking_reasons':sorted(risks),
            'source_lines':lines,'arinc_leg_count':0,'fmc_executable':False,
            'status':'STRUCTURE_VERIFIED_SEMANTICS_UNRESOLVED'}