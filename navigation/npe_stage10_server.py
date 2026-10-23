#!/usr/bin/env python3
"""Loopback-only AIRAC 2610 Stage10 aircraft telemetry / guidance laboratory.

POST telemetry is an explicit SIMULATOR_INTERFACE_V1 contract, not a claim that
FSX/X-Plane/MSFS is currently wired. EHSI displays reference output only.
No live/autopilot/FD actuator endpoint exists.
"""
from __future__ import annotations
import argparse,json,secrets,shutil,tempfile,threading,zipfile
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
from npe_stage8 import Stage8Error
from npe_stage8_server import Handler as Stage8Handler,PrivatePlanStore,ALLOWED_IN_ZIP
from npe_stage10_live import LiveReferenceSession,AFDSReferencePort,VERSION

MAX_SESSIONS=8

class Handler(Stage8Handler):
    def __init__(self,*args,root,store,sessions,guard,**kwargs):
        self.sessions=sessions;self.guard=guard
        super().__init__(*args,root=root,store=store,**kwargs)

    def _json_body(self):
        length=self.headers.get('Content-Length','')
        if not length.isdecimal() or not 2<=int(length)<=8192:
            raise Stage8Error('Request JSON length invalid')
        v=json.loads(self.rfile.read(int(length)))
        if type(v) is not dict:raise Stage8Error('Expected JSON object')
        return v

    def _session(self,body):
        token=body.get('session')
        if type(token) is not str or token not in self.sessions:
            raise Stage8Error('Unknown/expired session token')
        return self.sessions[token]

    def _run(self):
        path=urlsplit(self.path).path
        if self.command=='GET' and path=='/api/stage10/status':
            return {'version':VERSION,'airac':'2610','private_plan_count':len(self.store.plans()),
                    'telemetry_source_connected':any(v.bus.frame is not None for v in self.sessions.values()),
                    'real_simulator_bridge_connected':False,
                    'sensor_input_contract':'EXPLICIT_SIMULATOR_TELEMETRY_V1',
                    'active_sessions':len(self.sessions),'afds_connected':False,
                    'fmc_procedure_legs_executable':False,'lnav_active':False,'vnav_active':False}
        if self.command=='GET' and path=='/api/stage10/plans':return {'plans':self.store.plans()}
        if self.command=='GET' and path=='/api/stage10/reference':
            ids=parse_qs(urlsplit(self.path).query).get('id',[])
            if len(ids)!=1 or not ids[0].isdigit():raise Stage8Error('Provide valid private plan id')
            return self.store.reference(int(ids[0]))
        if self.command=='POST' and path.startswith('/api/stage10/'):
            body=self._json_body()
            with self.guard:
                if path=='/api/stage10/new':
                    if len(self.sessions)>=MAX_SESSIONS:raise Stage8Error('Session limit reached')
                    ref=self.store.reference(body.get('plan_id'))
                    s=LiveReferenceSession(ref,body.get('leg_index',0))
                    token=secrets.token_urlsafe(24)
                    self.sessions[token]=s
                    return {'session':token,'status':'AWAITING_EXPLICIT_SIMULATOR_TELEMETRY',
                            'bridge_connected':False,'afds_commands':[]}
                if path=='/api/stage10/afds-request':
                    # Explicitly reject external actuation, even if the session is valid.
                    self._session(body)
                    return AFDSReferencePort.request_afds_engage()
                s=self._session(body)
                if path=='/api/stage10/telemetry':return s.ingest(body.get('aircraft'))
                if path=='/api/stage10/arm':return s.arm(body.get('sim_only_consent'))
                if path=='/api/stage10/frame':return s.frame()
                if path=='/api/stage10/stop':
                    result=s.disengage()
                    self.sessions.pop(body['session'],None)
                    return result
        raise Stage8Error('UNKNOWN_STAGE10_API_ENDPOINT')


def main():
    ap=argparse.ArgumentParser(description='B737 Stage10 private LIVE telemetry training ONLY')
    src=ap.add_mutually_exclusive_group(required=True)
    src.add_argument('--stage4')
    src.add_argument('--stage4-zip')
    ap.add_argument('--root',default='.')
    ap.add_argument('--port',type=int,default=8770)
    a=ap.parse_args();temp=None
    root=Path(a.root).resolve(strict=True)
    if not (root/'navigation/npe-stage10/index.html').is_file():
        raise SystemExit('--root must be B737 repo checkout')
    db=a.stage4
    try:
        if a.stage4_zip:
            temp=Path(tempfile.mkdtemp(prefix='b737-stage10-private-'))
            with zipfile.ZipFile(a.stage4_zip) as z:
                info=z.getinfo(ALLOWED_IN_ZIP)
                if info.file_size>100*1024*1024:raise Stage8Error('Private source >100MB rejected')
                db=str(temp/'stage4.sqlite')
                with z.open(info) as src,open(db,'wb') as dest:shutil.copyfileobj(src,dest)
        store=PrivatePlanStore(db)
        try:
            server=ThreadingHTTPServer(('127.0.0.1',a.port),partial(Handler,root=root,
                 store=store,sessions={},guard=threading.RLock()))
            print('B737 STAGE10 SIM ONLY: http://127.0.0.1:'+str(a.port)+'/navigation/npe-stage10/index.html')
            print('External simulator interface NOT connected. Telemetry must be provided explicitly; AFDS disabled.')
            try:server.serve_forever()
            except KeyboardInterrupt:pass
            finally:server.server_close()
        finally:store.close()
    finally:
        if temp:shutil.rmtree(temp,ignore_errors=True)

if __name__=='__main__':main()