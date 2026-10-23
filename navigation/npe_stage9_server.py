#!/usr/bin/env python3
"""Loopback-only Stage9 simulated reference guidance laboratory.

Does not expose raw/private navdata; returns derived reference chords and a
stateful simulator-only lateral advisory with hard discontinuity gates.
"""
from __future__ import annotations
import argparse
from functools import partial
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import secrets
import shutil
import tempfile
import threading
import zipfile
from urllib.parse import urlsplit,parse_qs
from npe_stage8 import AIRAC, Stage8Error
from npe_stage8_server import Handler as Stage8Handler,PrivatePlanStore,ALLOWED_IN_ZIP
from npe_stage9_guidance import ReferenceGuidance,VERSION

class Handler(Stage8Handler):
    def __init__(self,*args,root,store,sessions,guard,**kw):
        self.sessions=sessions;self.guard=guard
        super().__init__(*args,root=root,store=store,**kw)

    def _read_payload(self):
        length=self.headers.get('Content-Length','')
        if not length.isdecimal() or not 2<=int(length)<=8192:raise Stage8Error('Bad body length')
        v=json.loads(self.rfile.read(int(length)))
        if type(v) is not dict:raise Stage8Error('Expected JSON object')
        return v

    def _run(self):
        req=urlsplit(self.path);path=req.path
        if self.command=='GET' and path=='/api/stage9/status':
            return {'version':VERSION,'airac':AIRAC,'private_plans':len(self.store.plans()),
                    'fmc_executable':False,'guidance_authority':'SIMULATED_ADVISORY_ONLY',
                    'lnav':False,'vnav':False,'afds':False,'active_sessions':len(self.sessions)}
        if self.command=='GET' and path=='/api/stage9/plans':return {'plans':self.store.plans()}
        if self.command=='GET' and path=='/api/stage9/reference':
            q=parse_qs(req.query);return self.store.reference(int(q.get('id',[''])[0]))
        if self.command=='POST' and path in ('/api/stage9/start','/api/stage9/step','/api/stage9/disengage'):
            body=self._read_payload()
            with self.guard:
                if path=='/api/stage9/start':
                    if body.get('sim_only_consent') is not True:raise Stage8Error('Explicit simulator-only consent required')
                    if len(self.sessions)>=8:raise Stage8Error('Too many lab sessions')
                    ref=self.store.reference(body.get('plan_id'))
                    g=ReferenceGuidance(ref,body.get('leg_index',0))
                    g.arm(True);token=secrets.token_urlsafe(22)
                    self.sessions[token]=g
                    return {'session':token,'status':'ARMED_SIM_REFERENCE_ONLY','leg_index':g.leg_index,
                            'fmc_executable':False,'afds_commands':[]}
                token=body.get('session')
                if type(token) is not str or token not in self.sessions:raise Stage8Error('Session not found or expired')
                if path=='/api/stage9/disengage':
                    g=self.sessions.pop(token);return g.disengage()
                result=self.sessions[token].step(body.get('sensor'))
                return result
        return super()._run()


def main():
    ap=argparse.ArgumentParser(description='B737 Stage9 simulator-only guidance lab (loopback)')
    src=ap.add_mutually_exclusive_group(required=True)
    src.add_argument('--stage4');src.add_argument('--stage4-zip')
    ap.add_argument('--root',default='.')
    ap.add_argument('--port',type=int,default=8769)
    a=ap.parse_args()
    root=Path(a.root).resolve(strict=True)
    if not (root/'navigation/npe-stage9/index.html').is_file():raise SystemExit('Point --root to B737 simulator project checkout')
    temp=None;db=a.stage4
    try:
        if a.stage4_zip:
            temp=Path(tempfile.mkdtemp(prefix='b737-private-stage9-'))
            with zipfile.ZipFile(a.stage4_zip) as archive:
                item=archive.getinfo(ALLOWED_IN_ZIP)
                if item.file_size>100*1024*1024:raise Stage8Error('Private plan source size exceeds cap')
                db=str(temp/'stage4.sqlite')
                with archive.open(item) as source,open(db,'wb') as target:shutil.copyfileobj(source,target)
        store=PrivatePlanStore(db)
        try:
            http=ThreadingHTTPServer(('127.0.0.1',a.port),partial(Handler,root=root,store=store,sessions={},guard=threading.Lock()))
            print(f'PRIVATE SIM ONLY: http://127.0.0.1:{a.port}/navigation/npe-stage9/index.html')
            try:http.serve_forever()
            except KeyboardInterrupt:pass
            finally:http.server_close()
        finally:store.close()
    finally:
        if temp:shutil.rmtree(temp,ignore_errors=True)

if __name__=='__main__':main()