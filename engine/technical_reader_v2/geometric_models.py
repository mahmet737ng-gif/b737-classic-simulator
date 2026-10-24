"""Persistent executable geometry for non-function curves and nomograms."""
import copy,hashlib,json
from .geometry import alignment_nomogram,read_trace,split_trace,PolarCalibration,CartesianCalibration,envelope_contains
from ..technical_reader_v1.numeric import ReaderError,finite
from ..technical_reader_v1.store import canonical

SCHEMA='CREATE TABLE IF NOT EXISTS cr2_geometry_models(id TEXT NOT NULL,revision INTEGER NOT NULL,payload_json TEXT NOT NULL,sha256 TEXT NOT NULL,PRIMARY KEY(id,revision));'


def save_geometry_model(ws,spec):
    spec=copy.deepcopy(spec)
    if spec.get('kind') not in ('nomogram','polyline','envelope'):raise ReaderError('UNKNOWN_GEOMETRIC_MODEL')
    if not spec.get('id') or not spec.get('title') or type(spec.get('revision')) is not int or spec['revision']<1:raise ReaderError('ID_TITLE_REVISION_REQUIRED')
    inputs=spec.get('inputs',[])
    names=[d.get('name') for d in inputs]
    if len(set(names))!=len(names) or not all(names) or not all(d.get('unit') for d in inputs):raise ReaderError('INPUT_CONTRACT_REQUIRED')
    if not spec.get('output',{}).get('unit'):raise ReaderError('OUTPUT_UNIT_REQUIRED')
    if spec['kind']=='nomogram':
        if len(inputs)!=2 or len(spec.get('input_axes',[]))!=2:raise ReaderError('NOMOGRAM_NEEDS_TWO_INPUTS')
        axes=spec['input_axes']+[spec['output_axis']]
        for axis in axes:
            ticks=axis['ticks'];values=[finite(t['value']) for t in ticks]
            if len(ticks)<2 or not(all(b>a for a,b in zip(values,values[1:])) or all(b<a for a,b in zip(values,values[1:]))):raise ReaderError('MONOTONIC_SCALE_TICKS_REQUIRED')
            for t in ticks:
                if len(t['pixel'])!=2:raise ReaderError('TICK_PIXEL_REQUIRED')
                for v in t['pixel']:finite(v)
    elif spec['kind']=='envelope':
        if len(inputs)!=2 or not spec.get('rings'):raise ReaderError('TWO_INPUTS_AND_POLYGON_RINGS_REQUIRED')
        for ring in spec['rings']:
            envelope_contains([ring],ring[0])
    else:
        if len(inputs)!=1:raise ReaderError('POLYLINE_NEEDS_ONE_X_INPUT')
        if 'pixel_traces' in spec:
            cal=spec['calibration'];tr=PolarCalibration(**cal['polar']) if cal.get('type')=='polar' else CartesianCalibration(cal['anchors'],cal.get('x_scale','linear'),cal.get('y_scale','linear'))
            branches=[]
            for i,trace in enumerate(spec['pixel_traces']):
                for b in split_trace([tr.to_value(p) for p in trace]):b['id']=f'trace-{i+1}-{b["id"]}';branches.append(b)
            spec['branches']=branches
        if not spec.get('branches'):raise ReaderError('BRANCHES_REQUIRED')
        for b in spec['branches']:
            if not b.get('id') or len(b['points'])<2:raise ReaderError('NAMED_BRANCH_WITH_TWO_POINTS_REQUIRED')
            for point in b['points']:
                for v in point:finite(v)
    doc=ws.document(spec['document_id']);spec['provenance']={'document_id':doc['id'],'source_sha256':doc['sha256'],'pdf_page':spec['page']};spec['quality']='simulation_approx'
    payload=canonical(spec);sha=hashlib.sha256(payload.encode()).hexdigest();ws.conn.execute(SCHEMA)
    old=ws.conn.execute('SELECT sha256 FROM cr2_geometry_models WHERE id=? AND revision=?',(spec['id'],spec['revision'])).fetchone()
    if old:
        if old[0]!=sha:raise ReaderError('GEOMETRY_REVISION_CONFLICT')
        return spec
    with ws.conn:
        ws.conn.execute('INSERT INTO cr2_geometry_models VALUES(?,?,?,?)',(spec['id'],spec['revision'],payload,sha))
        ws.add_region(spec['document_id'],spec['page'],f"{spec['id']}@{spec['revision']}",'nomogram' if spec['kind']=='nomogram' else 'curve',{'geometry_model':spec['id'],'geometry_revision':spec['revision']})
        ws.conn.execute('UPDATE cr2_regions SET model_id=?,model_revision=?,state=? WHERE id=?',(spec['id'],spec['revision'],'CONVERTED_GEOMETRY',f"{spec['id']}@{spec['revision']}"))
    return spec


def evaluate_geometry(ws,ident,revision,inputs,conditions=None,branch_id=None):
    ws.conn.execute(SCHEMA);row=ws.conn.execute('SELECT payload_json FROM cr2_geometry_models WHERE id=? AND revision=?',(ident,revision)).fetchone()
    if not row:raise ReaderError('GEOMETRY_MODEL_NOT_FOUND')
    spec=json.loads(row[0]);names=[d['name'] for d in spec['inputs']]
    if set(inputs)!=set(names):raise ReaderError('INPUT_CONTRACT_MISMATCH')
    for key,expected in spec.get('conditions',{}).items():
        if (conditions or {}).get(key)!=expected:raise ReaderError('CONDITION_MISMATCH: '+key)
    values=[finite(inputs[n]) for n in names]
    for definition,value in zip(spec['inputs'],values):
        if ('min' in definition and value<definition['min']) or ('max' in definition and value>definition['max']):raise ReaderError('OUT_OF_DOMAIN')
    result=alignment_nomogram(spec['input_axes'],spec['output_axis'],values) if spec['kind']=='nomogram' else envelope_contains(spec['rings'],values) if spec['kind']=='envelope' else read_trace(spec['branches'],values[0],branch_id=branch_id)
    return {**result,'model_id':ident,'revision':revision,'unit':spec['output']['unit'],'quality':spec['quality'],'provenance':spec['provenance'],'inputs':inputs}
