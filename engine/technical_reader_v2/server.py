"""Local-only workbench. Source manuals and uploads remain on this machine."""
import argparse,csv,hashlib,io,json,mimetypes,shutil,tempfile,uuid
from pathlib import Path
from http.server import ThreadingHTTPServer,BaseHTTPRequestHandler
from urllib.parse import urlparse,parse_qs
from .workspace import ReviewWorkspace,canonical,digest
from .geometric_models import save_geometry_model,evaluate_geometry,SCHEMA as GEOMETRY_SCHEMA
from .geometry import CartesianCalibration,PolarCalibration,split_trace,alignment_nomogram
from ..technical_reader_v1.numeric import ReaderError
from ..technical_reader_v1.models import evaluate
from ..technical_reader_v1.tables import table_to_grid
from ..technical_reader_v1.ingest import extract_pdf,guided_table

UI=Path(__file__).with_name('ui')


def model_from_spec(ws,spec):
    docid=spec['document_id'];n=int(spec['page']);doc=ws.document(docid)
    calibration=spec.get('calibration',{})
    evidence=ws.render(docid,n,ws.path.parent/'renders'/f'{docid}-{n}.png',dpi=216)
    page={'pdf_page':n,'width':evidence['width'],'height':evidence['height'],'coordinate_space':'pixel','method':'render_for_guided_digitization','spans':[],'text':'','tables':[],'render_dpi':216}
    sid=docid;rev=doc['sha256']
    ws.store.source(sid,rev,rev,{'document_id':docid,'original_metadata':json.loads(doc['metadata_json'])})
    ws.store.add_page(sid,rev,page)
    bbox=spec.get('bbox',[0,0,page['width'],page['height']])
    base={'id':spec['id'],'revision':int(spec.get('revision',1)),'kind':spec['kind'],'title':spec['title'],'quality':'simulation_approx','provenance':[{'source_id':sid,'source_revision':rev,'pdf_page':n,'bbox':bbox,'coordinate_space':'pixel','render_dpi':216}], 'inputs':spec['inputs'],'output':spec['output'],'conditions':spec.get('conditions',{}),'limitations':['Guided numerical extraction; no independent source accuracy review.'],'calibration':calibration}
    if spec['kind'] in ('curve','family'):
        transform=PolarCalibration(**calibration['polar']) if calibration.get('type')=='polar' else CartesianCalibration(calibration['anchors'],calibration.get('x_scale','linear'),calibration.get('y_scale','linear'))
        curves=[]
        for curve in spec['curves']:
            branches=[]
            for trace in curve['traces']:
                values=[transform.to_value(p) for p in trace]
                split=split_trace(values)
                if any(b['vertical'] for b in split) or len(split)!=1:raise ReaderError('SPLIT_TRACE_AT_TURNS_OR_CHOOSE_BRANCH: one y per x required for each segment')
                points=split[0]['points']
                if points[0][0]>points[-1][0]:points.reverse()
                branches.append({'points':points,'pixel_points':trace})
            curves.append({'id':curve['id'],'parameter':curve.get('parameter',0),'segments':branches})
        if spec['kind']=='curve':base['segments']=curves[0]['segments']
        else:base['curves']=sorted(curves,key=lambda c:c['parameter'])
        base['x_scale']=calibration.get('x_scale','linear');base['y_scale']=calibration.get('y_scale','linear')
    elif spec['kind']=='grid':
        mapped=table_to_grid(spec['rows'],base,locale=spec.get('locale',{}));mapped['quality']='simulation_approx';base=mapped
    elif spec['kind']=='lookup':base['rows']=spec['rows']
    elif spec['kind']=='formula':base['expression']=spec['expression']
    else:raise ReaderError('UNSUPPORTED_MODEL_KIND')
    ws.store.add_model(base)
    ws.add_region(docid,n,spec.get('region_id',base['id']+'@'+str(base['revision'])), 'table' if base['kind']=='grid' else base['kind'],{'title':base['title'],'source_dpi':216},base)
    return base


def handler_class(db):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self,*a):pass
        def send(self,data,status=200,mime='application/json'):
            if mime=='application/json':data=json.dumps(data,ensure_ascii=False,allow_nan=False).encode()
            self.send_response(status);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(data)));self.send_header('X-Content-Type-Options','nosniff');self.end_headers();self.wfile.write(data)
        def do_GET(self):
            try:
                uri=urlparse(self.path);q=parse_qs(uri.query)
                if uri.path.startswith('/api/'):
                    w=ReviewWorkspace(db)
                    try:
                        if uri.path=='/api/documents':r=[{k:v for k,v in dict(row).items() if k!='path'} for row in w.conn.execute('SELECT * FROM cr2_documents')]
                        elif uri.path=='/api/pages':r={'pages':w.pages(q['document_id'][0]),'summary':w.summary(q['document_id'][0])}
                        elif uri.path=='/api/page':
                            row=w.conn.execute('SELECT * FROM cr2_pages WHERE document_id=? AND page=?',(q['document_id'][0],int(q['page'][0]))).fetchone()
                            if not row:raise ReaderError('PAGE_NOT_FOUND')
                            r=dict(row);r['regions']=[dict(a) for a in w.conn.execute('SELECT * FROM cr2_regions WHERE document_id=? AND page=?',(q['document_id'][0],int(q['page'][0])))]
                        elif uri.path=='/api/image':
                            docid=q['document_id'][0];n=int(q['page'][0]);path=w.path.parent/'renders'/f'{docid}-{n}.png';w.render(docid,n,path,dpi=216);self.send(path.read_bytes(),mime='image/png');return
                        elif uri.path=='/api/export':r=w.export(q['document_id'][0])
                        elif uri.path=='/api/models':
                            w.conn.execute(GEOMETRY_SCHEMA)
                            r=[{'id':row['model_id'],'revision':row['revision'],'model':json.loads(row['payload_json']),'geometry':False} for row in w.conn.execute('SELECT * FROM ctr_models ORDER BY model_id,revision')]
                            r += [{'id':row['id'],'revision':row['revision'],'model':json.loads(row['payload_json']),'geometry':True} for row in w.conn.execute('SELECT * FROM cr2_geometry_models ORDER BY id,revision')]
                        else:self.send({'error':'not found'},404);return
                    finally:w.close()
                    self.send(r);return
                relative=uri.path.lstrip('/') or 'index.html';path=(UI/relative).resolve()
                if not path.is_relative_to(UI.resolve()) or not path.is_file():self.send({'error':'not found'},404);return
                self.send(path.read_bytes(),mime=mimetypes.guess_type(path)[0] or 'application/octet-stream')
            except (ReaderError,ValueError,KeyError,TypeError) as e:self.send({'error':str(e)},400)
        def do_POST(self):
            origin=self.headers.get('Origin')
            if origin and origin!=f'http://{self.headers.get("Host")}':self.send({'error':'origin rejected'},403);return
            try:
                size=int(self.headers.get('Content-Length','0'))
                if not 0<size<=300*1024*1024:raise ReaderError('UPLOAD_SIZE_1_TO_300MB')
                data=self.rfile.read(size);w=ReviewWorkspace(db)
                try:
                    if self.path.startswith('/api/upload'):
                        suffix=parse_qs(urlparse(self.path).query).get('suffix',['.pdf'])[0].lower()
                        if suffix not in ('.pdf','.png','.jpg','.jpeg','.tif','.tiff','.webp'):raise ReaderError('PDF_OR_IMAGE_REQUIRED')
                        ident='upload-'+uuid.uuid4().hex[:12];directory=w.path.parent/'sources';directory.mkdir(exist_ok=True)
                        path=directory/(ident+suffix);path.write_bytes(data);original={'file_sha256':digest(path),'filename':parse_qs(urlparse(self.path).query).get('name',['uploaded source'])[0]}
                        if suffix!='.pdf':
                            from PIL import Image
                            with Image.open(path) as image:image.convert('RGB').save(directory/(ident+'.pdf'),'PDF',resolution=216)
                            path=directory/(ident+'.pdf');original['image_wrapped_for_viewing']=True
                        r=w.index_pdf(path,ident,metadata=original)
                    else:
                        spec=json.loads(data)
                        if self.path=='/api/model':r=model_from_spec(w,spec)
                        elif self.path=='/api/geometry-model':r=save_geometry_model(w,spec)
                        elif self.path=='/api/calculate':r=evaluate_geometry(w,spec['id'],int(spec['revision']),spec['inputs'],conditions=spec.get('conditions',{}),branch_id=spec.get('branch_id')) if spec.get('geometry') else w.store.calculate(spec['id'],int(spec['revision']),spec['inputs'],context=spec.get('conditions',{}),mode='simulator')
                        elif self.path=='/api/review':
                            evidence=w.render(spec['document_id'],int(spec['page']),w.path.parent/'renders'/f"review-{uuid.uuid4().hex}.png",dpi=216)
                            r=w.review(spec['document_id'],int(spec['page']),spec['reviewer'],evidence,spec['notes'],numeric_complete=bool(spec.get('numeric_complete',False)))
                        elif self.path=='/api/region':r={'id':w.add_region(spec['document_id'],int(spec['page']),spec['id'],spec['kind'],spec['payload'])}
                        elif self.path=='/api/table-extract':
                            doc=w.document(spec['document_id']);page=extract_pdf(doc['path'],pages=[int(spec['page'])],dpi=216,force_ocr=True)[0]
                            spans=[{**s,'bbox':[v*3 for v in s['bbox']]} for s in page['spans']]
                            r=guided_table(spans,spec['row_edges'],spec['col_edges'])
                        elif self.path=='/api/ocr':
                            doc=w.document(spec['document_id']);r=extract_pdf(doc['path'],pages=[int(spec['page'])],dpi=216,force_ocr=True)[0]
                        elif self.path=='/api/nomogram':r=alignment_nomogram(spec['input_axes'],spec['output_axis'],spec['inputs'])
                        else:raise ReaderError('UNKNOWN_OPERATION')
                finally:w.close()
                self.send(r)
            except (ReaderError,ValueError,KeyError,TypeError,sqlite_error()) as e:self.send({'error':str(e)},400)
    return Handler


def sqlite_error():
    import sqlite3
    return sqlite3.Error


def main(argv=None):
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--db',required=True);p.add_argument('--pdf');p.add_argument('--index');p.add_argument('--document-id',default='AFM-R32');p.add_argument('--port',type=int,default=8765);p.add_argument('--inventory-only',action='store_true');p.add_argument('--open-browser',action='store_true');a=p.parse_args(argv)
    w=ReviewWorkspace(a.db)
    if a.pdf:print(json.dumps(w.index_pdf(a.pdf,a.document_id,existing_index=a.index)))
    w.close()
    if a.inventory_only:return
    server=ThreadingHTTPServer(('127.0.0.1',a.port),handler_class(str(Path(a.db).resolve())))
    print(f'Chart Reader: http://127.0.0.1:{a.port}',flush=True)
    if a.open_browser:
        import threading,webbrowser
        threading.Timer(.5,lambda:webbrowser.open(f'http://127.0.0.1:{a.port}')).start()
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()
