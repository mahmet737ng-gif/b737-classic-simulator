#!/usr/bin/env python3
"""Loopback-only reference geometry diagnostics for private AIRAC 2610 plans.
Private SQLite stays outside the served repository root. Simulator-only.
"""
from __future__ import annotations
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import sqlite3
import tempfile
import zipfile
from urllib.parse import urlsplit,parse_qs
from npe_stage8 import AIRAC,VERSION,Stage8Error,reference_position,stage4_reference_chords

ALLOWED_IN_ZIP='NPE_STAGE4/NPE_STAGE4_FLIGHT_PLANS_PRIVATE.sqlite'

class PrivatePlanStore:
    def __init__(self,path:str):
        self.path=Path(path).resolve(strict=True)
        self.conn=sqlite3.connect(self.path.as_uri()+'?mode=ro',uri=True,check_same_thread=False)
        self.conn.row_factory=sqlite3.Row
        metadata=dict(self.conn.execute('SELECT key,value FROM meta'))
        if metadata.get('version')!='NPE_STAGE4_FLIGHT_PLAN_DRAFT_v1':
            raise Stage8Error('Unsupported stage4 private plan source')
    def plans(self):
        return [dict(row) for row in self.conn.execute('SELECT id,origin,destination,airac,status,discontinuities FROM plans ORDER BY id LIMIT 200')]
    def reference(self,plan_id:int):
        if type(plan_id)is not int or plan_id<=0:raise Stage8Error('Select an explicit private plan id')
        row=self.conn.execute('SELECT payload_json FROM plans WHERE id=?',(plan_id,)).fetchone()
        if row is None:raise Stage8Error('Selected plan unavailable')
        return stage4_reference_chords(json.loads(row['payload_json']))
    def close(self):self.conn.close()

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,root,store,**kwargs):
        self.store=store
        super().__init__(*args,directory=str(root),**kwargs)
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','SAMEORIGIN')
        self.send_header('Referrer-Policy','no-referrer')
        self.send_header('Content-Security-Policy',"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; img-src 'self' data:")
        super().end_headers()
    def _response(self,obj,code):
        data=json.dumps(obj,ensure_ascii=False,separators=(',',':')).encode('utf8')
        self.send_response(code)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers();self.wfile.write(data)
    def _check_origin(self):
        # Restrict Host to literal loopback; no localhost subdomain DNS rebinding.
        h=self.headers.get('Host','')
        expected={'localhost:'+str(self.server.server_port),'127.0.0.1:'+str(self.server.server_port)}
        if h not in expected:raise Stage8Error('UNTRUSTED_HOST')
        origin=self.headers.get('Origin')
        if origin is not None and origin not in {'http://'+x for x in expected}:
            raise Stage8Error('CROSS_ORIGIN_BLOCKED')
    def _run(self):
        req=urlsplit(self.path);path=req.path
        q=parse_qs(req.query)
        if self.command=='GET' and path=='/api/stage8/status':
            return {'stage':'8','version':VERSION,'airac':AIRAC,'source':'PRIVATE_AIRAC_2610',
                    'fmc_executable':False,'afds_commands':[],'guidance':'OFF','plans':len(self.store.plans())}
        if self.command=='GET' and path=='/api/stage8/plans':return {'plans':self.store.plans()}
        if self.command=='GET' and path=='/api/stage8/reference':
            plan_id=int(q.get('id',[''])[0]);return self.store.reference(plan_id)
        if self.command=='POST' and path=='/api/stage8/position':
            raw_length=self.headers.get('Content-Length','')
            if not raw_length.isdecimal() or not 1<=int(raw_length)<=2048:raise Stage8Error('Bad request length')
            payload=json.loads(self.rfile.read(int(raw_length)))
            require_keys={'plan_id','position','reference_leg_index'}
            if not isinstance(payload,dict) or require_keys-set(payload):raise Stage8Error('Explicit plan, position and leg required')
            ref=self.store.reference(payload['plan_id'])
            return reference_position(ref,payload['position'],payload['reference_leg_index'])
        raise Stage8Error('UNKNOWN_API_ENDPOINT')
    def do_GET(self):
        if not urlsplit(self.path).path.startswith('/api/'):
            # Host check applies to static assets too.
            try:self._check_origin()
            except Stage8Error as e:return self._response({'error':str(e)},403)
            return super().do_GET()
        return self._api()
    def do_POST(self):return self._api()
    def _api(self):
        try:
            self._check_origin();return self._response(self._run(),200)
        except (Stage8Error,TypeError,ValueError,KeyError,json.JSONDecodeError) as e:
            return self._response({'error':str(e),'guidance':'OFF'},422)
    def log_message(self,fmt,*args):
        pass

def main():
    ap=argparse.ArgumentParser(description='Private B737 NAVDB reference diagnostics (localhost only)')
    source=ap.add_mutually_exclusive_group(required=True)
    source.add_argument('--stage4')
    source.add_argument('--stage4-zip')
    ap.add_argument('--root',default='.')
    ap.add_argument('--port',type=int,default=8768)
    args=ap.parse_args();temp=None
    root=Path(args.root).resolve()
    if not (root/'navigation/npe-stage8/index.html').exists():raise SystemExit('Point --root to project checkout')
    path=args.stage4
    if args.stage4_zip:
        temp=Path(tempfile.mkdtemp(prefix='b737-nav-stage8-private-'))
        try:
            with zipfile.ZipFile(args.stage4_zip) as z:
                info=z.getinfo(ALLOWED_IN_ZIP)
                if info.file_size>100*1024*1024:raise Stage8Error('Unexpectedly large private stage4 data')
                path=temp/'stage4.sqlite'
                with z.open(info) as src,open(path,'wb') as dst:shutil.copyfileobj(src,dst)
        except Exception:
            shutil.rmtree(temp,ignore_errors=True);raise
    try:
        store=PrivatePlanStore(str(path))
        from functools import partial
        http=ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,root=root,store=store))
        print(f'PRIVATE ONLY http://127.0.0.1:{args.port}/navigation/npe-stage8/index.html')
        try:http.serve_forever()
        except KeyboardInterrupt:pass
        finally:http.server_close();store.close()
    finally:
        if temp:shutil.rmtree(temp,ignore_errors=True)
if __name__=='__main__':main()