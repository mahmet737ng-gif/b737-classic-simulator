#!/usr/bin/env python3
"""Loopback-only local FMC reference-route service for private AIRAC data.

Usage: python navigation/fmc_server.py --stage1 /private/STAGE1.sqlite
       --stage2 /private/STAGE2_GEOMETRY.sqlite --root . --port 8765

The server only listens on 127.0.0.1; it must never expose the source data to a public website.
"""
import argparse
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
import json
from pathlib import Path
import tempfile
import zipfile
import shutil
from urllib.parse import urlsplit,parse_qs
from fmc_route_engine import NavigationEngine, NavError

class Handler(SimpleHTTPRequestHandler):
    engine=None
    def __init__(self,*a,root=None,**kw):super().__init__(*a,directory=str(root),**kw)
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','SAMEORIGIN')
        self.send_header('Referrer-Policy','no-referrer')
        super().end_headers()
    def reply(self,obj,code=200):
        data=json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode()
        self.send_response(code);self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def invoke(self):
        req=urlsplit(self.path)
        q={key:values[0] for key,values in parse_qs(req.query).items()}
        if req.path=='/api/status':return self.engine.status()
        if req.path=='/api/airport':return self.engine.airport(q.get('icao',''))
        if req.path=='/api/procedures':return self.engine.procedure_catalog(q.get('airport',''),q.get('kind'))
        if req.path=='/api/procedure-preview':
            return self.engine.procedure_preview(q.get('airport',''),q.get('kind',''),q.get('ident',''),q.get('runway'),q.get('transition'))
        if req.path=='/api/route' and self.command=='POST':
            length=int(self.headers.get('Content-Length','-1'))
            if length<1 or length>32768:raise NavError('INVALID_BODY','Request body exceeds 32 KB')
            return self.engine.route(json.loads(self.rfile.read(length)))
        raise NavError('UNSUPPORTED_ENDPOINT','Unsupported API request')
    def do_GET(self):
        if not self.path.startswith('/api/'):
            return super().do_GET()
        self.api()
    def do_POST(self):
        self.api()
    def api(self):
        if not self.path.startswith('/api/') or (self.command=='POST' and urlsplit(self.path).path!='/api/route'):
            return self.reply({'error':'UNSUPPORTED_ENDPOINT'},404)
        # No cross-origin Access-Control-Allow-Origin: requests are local same-origin only.
        try:
            origin=self.headers.get('Origin')
            host=self.headers.get('Host','')
            if origin and origin not in ('http://'+host,'http://127.0.0.1:'+str(self.server.server_port)):
                raise NavError('ORIGIN_REJECTED','Cross-origin calls prohibited')
            return self.reply(self.invoke())
        except NavError as e:return self.reply({'error':e.code,'message':str(e)},422)
        except (ValueError,TypeError,json.JSONDecodeError) as e:return self.reply({'error':'INVALID_REQUEST','message':str(e)},400)
    def log_message(self,fmt,*args):
        if args and str(args[1])[:1]=='2':return
        super().log_message(fmt,*args)

def main():
    p=argparse.ArgumentParser(description='Loopback private AIRAC 2610 reference route source')
    p.add_argument('--stage1')
    p.add_argument('--stage2')
    p.add_argument('--private-zip',help='Existing private NPE Stage-2 ZIP containing Stage-1 and Stage-2 SQLite. Extracts to OS temporary directory, never into public repo.')
    p.add_argument('--root',default='.')
    p.add_argument('--port',type=int,default=8765)
    args=p.parse_args()
    extracted=None
    if args.private_zip:
        if args.stage1 or args.stage2:raise SystemExit('Use either --private-zip or --stage1/--stage2')
        extracted=Path(tempfile.mkdtemp(prefix='b737-private-nav-'))
        with zipfile.ZipFile(args.private_zip) as arc:
            allowed={
              'private_data/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite':'stage1.sqlite',
              'private_data/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_GEOMETRY.sqlite':'stage2.sqlite'}
            for source,destination in allowed.items():
                with arc.open(source) as src,open(extracted/destination,'wb') as dst:
                    shutil.copyfileobj(src,dst,length=2*1024*1024)
        args.stage1=str(extracted/'stage1.sqlite')
        args.stage2=str(extracted/'stage2.sqlite')
    if not args.stage1:raise SystemExit('Provide --stage1 or --private-zip')
    try:engine=NavigationEngine(args.stage1,args.stage2)
    except Exception:
        if extracted:shutil.rmtree(extracted,ignore_errors=True)
        raise
    class LocalHandler(Handler):pass
    LocalHandler.engine=engine
    root=Path(args.root).resolve()
    if not (root/'cdu-standalone-v6'/'index.html').exists():raise SystemExit('--root must point to B737 simulator repo')
    from functools import partial
    http=ThreadingHTTPServer(('127.0.0.1',args.port),partial(LocalHandler,root=root))
    print('LOCAL ONLY: http://127.0.0.1:'+str(args.port)+'/navigation/fmc-lab/index.html')
    print('AIRAC '+engine.cycle+' validated | stage2 bound: '+str(bool(engine.geo)))
    try:http.serve_forever()
    except KeyboardInterrupt:pass
    finally:
        http.server_close();engine.close()
        if extracted:shutil.rmtree(extracted,ignore_errors=True)

if __name__=='__main__':main()