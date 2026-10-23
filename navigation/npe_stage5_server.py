#!/usr/bin/env python3
"""Loopback-only Stage-5 source-locked CDU RTE/DEP-ARR/LEGS preview service.

No private navigation source is stored in this public code or served as static files.
No autopilot, AFDS, LNAV, VNAV or executable FMC route interfaces.
"""
import argparse
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import sqlite3
import tempfile
import zipfile
import shutil
from urllib.parse import urlsplit, parse_qs

from flight_plan_reader import retrieve, open_drafts
from flight_plan_engine import AIRAC_MARKER, VERSION, RouteError

class Stage5Error(ValueError): pass

class Stage5Service:
    def __init__(self, stage4_db, stage1=None, stage2=None, stage3=None):
        self.stage4_db=Path(stage4_db).resolve()
        with open_drafts(self.stage4_db) as c:
            self.plan_ids=[row[0] for row in c.execute('SELECT id FROM plans ORDER BY id LIMIT 100')]
        if not self.plan_ids:raise Stage5Error('No private Stage-4 plans found')
        self.stage1=Path(stage1).resolve() if stage1 else None
        self.stage2=Path(stage2).resolve() if stage2 else None
        self.stage3=Path(stage3).resolve() if stage3 else None
        if any((self.stage1,self.stage2,self.stage3)) and not all((self.stage1,self.stage2,self.stage3)):
            raise Stage5Error('Live compose requires ALL three private Stage1, Stage2, Stage3 databases')
        self.compose_enabled=bool(self.stage1 and self.stage2 and self.stage3)
        self.source_chain=None
        if self.compose_enabled:
            from flight_plan_engine import validate_sources
            self.source_chain=validate_sources(self.stage1,self.stage2,self.stage3)

    @staticmethod
    def guard(plan):
        if (not isinstance(plan,dict) or plan.get('engine')!=VERSION or plan.get('airac')!='2610' or
            plan.get('source_marker')!=AIRAC_MARKER or plan.get('fmc_legs_activated')!=0 or
            plan.get('autopilot_guidance_enabled') is not False or
            'NOT_FMC_EXECUTABLE' not in plan.get('status','') or
            not isinstance(plan.get('items'),list) or len(plan['items'])>500 or
            any(item.get('fmc_status') not in ('SOURCE_ONLY','NOT_EXECUTABLE') for item in plan['items']) or
            plan.get('qa',{}).get('discontinuity_count')!=sum(x.get('type')=='DISCONTINUITY' for x in plan['items'])):
            raise Stage5Error('NAVDB Stage4 active-data/provenance safety gate failed')
        return plan

    def status(self):
        return {'airac':'2610','marker':AIRAC_MARKER,'mode':'LOCAL_PRIVATE_PREVIEW_ONLY',
                'ready':True,'compose_enabled':self.compose_enabled,'saved_plans':len(self.plan_ids),
                'fmc_executable':False,'autopilot_guidance_enabled':False,
                'browser_backend':'LOCALHOST_ONLY'}

    def plans(self):
        result=[]
        for pid in self.plan_ids:
            p=self.guard(retrieve(self.stage4_db,pid))
            result.append({'id':pid,'origin':p['origin'],'destination':p['destination'],
                           'discontinuities':p['qa']['discontinuity_count'],
                           'airac':'2610','status':'DRAFT_NOT_ACTIVE'})
        return result

    def plan(self,plan_id):
        if plan_id not in self.plan_ids:raise Stage5Error('Unknown private draft plan')
        return self.guard(retrieve(self.stage4_db,plan_id))

    def procedures(self,airport,kind):
        if not self.compose_enabled:raise Stage5Error('Stage1–3 private databases not configured')
        if kind not in ('SID','STAR','APP') or not isinstance(airport,str) or len(airport)!=4 or not airport.isalpha():
            raise Stage5Error('Invalid ICAO or procedure kind')
        from npe_reader import list_procedures
        results=list_procedures(self.stage1,airport.upper(),kind)
        return [{'ident':r['ident'],'runways':r['runways'],'transitions':r['transitions'],
                 'fmc_status':'NOT_EXECUTABLE'} for r in results[:1000]]

    def compose(self,request):
        if not self.compose_enabled:raise Stage5Error('Cannot compose without verified private Stage1/2/3 sources')
        if not isinstance(request,dict) or set(request)-{'origin','destination','departure','arrival','approach','enroute'}:
            raise Stage5Error('Unsupported route request fields')
        from flight_plan_engine import compose
        return self.guard(compose(self.stage1,self.stage2,self.stage3,request,source_chain=self.source_chain))

class Handler(SimpleHTTPRequestHandler):
    service=None
    def __init__(self,*args,root=None,**kwargs):
        super().__init__(*args,directory=str(root),**kwargs)
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('X-Frame-Options','SAMEORIGIN')
        self.send_header('Referrer-Policy','no-referrer')
        super().end_headers()
    def json_reply(self,value,status=200):
        data=json.dumps(value,ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type','application/json; charset=utf-8')
        self.send_header('Content-Length',str(len(data)))
        self.end_headers();self.wfile.write(data)
    def check_host(self):
        host=self.headers.get('Host','')
        # Prevent DNS-rebinding to loopback and reject foreign-origin POSTs.
        if host not in ('127.0.0.1:'+str(self.server.server_port), 'localhost:'+str(self.server.server_port)):
            raise Stage5Error('Non-loopback Host rejected')
        origin=self.headers.get('Origin')
        if origin and origin not in ('http://'+host,):
            raise Stage5Error('Cross-origin request rejected')
    def dispatch(self):
        self.check_host()
        u=urlsplit(self.path)
        if u.path=='/api/stage5/status' and self.command=='GET':return self.service.status()
        if u.path=='/api/stage5/plans' and self.command=='GET':return self.service.plans()
        if u.path=='/api/stage5/plan' and self.command=='GET':
            params=parse_qs(u.query)
            if set(params)-{'id'}:raise Stage5Error('Unrecognized plan query')
            return self.service.plan(int(params.get('id',['0'])[0]))
        if u.path=='/api/stage5/procedures' and self.command=='GET':
            params=parse_qs(u.query)
            return self.service.procedures(params.get('airport',[''])[0],params.get('kind',[''])[0])
        if u.path=='/api/stage5/compose' and self.command=='POST':
            if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json':raise Stage5Error('Require application/json')
            n=int(self.headers.get('Content-Length','0'))
            if not 1<=n<=16384:raise Stage5Error('Request size invalid')
            return self.service.compose(json.loads(self.rfile.read(n)))
        raise Stage5Error('Unsupported endpoint/method')
    def handle_api(self):
        try:self.json_reply(self.dispatch())
        except (ValueError,KeyError,LookupError,RouteError,sqlite3.Error,json.JSONDecodeError) as e:
            self.json_reply({'error':'STAGE5_REJECTED','message':str(e)},422)
    def do_GET(self):
        if urlsplit(self.path).path.startswith('/api/'):
            return self.handle_api()
        try:self.check_host()
        except Stage5Error as e:return self.json_reply({'error':str(e)},403)
        return super().do_GET()
    def do_POST(self):
        return self.handle_api()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage4-db')
    parser.add_argument('--stage4-zip',help='Private Stage4 archive (never extract into GitHub webroot)')
    parser.add_argument('--stage1');parser.add_argument('--stage2');parser.add_argument('--stage3')
    parser.add_argument('--root',default='.')
    parser.add_argument('--port',type=int,default=8766)
    a=parser.parse_args()
    if bool(a.stage4_db)==bool(a.stage4_zip):parser.error('Provide exactly one of --stage4-db or --stage4-zip')
    temp=None
    try:
        if a.stage4_zip:
            temp=Path(tempfile.mkdtemp(prefix='b737-stage5-private-'))
            member='NPE_STAGE4/NPE_STAGE4_FLIGHT_PLANS_PRIVATE.sqlite'
            with zipfile.ZipFile(a.stage4_zip) as z:
                with z.open(member) as source,(temp/'private-stage4.sqlite').open('wb') as target:
                    shutil.copyfileobj(source,target)
            a.stage4_db=str(temp/'private-stage4.sqlite')
        service=Stage5Service(a.stage4_db,a.stage1,a.stage2,a.stage3)
        root=Path(a.root).resolve()
        if not (root/'cdu-standalone-v6'/'index.html').is_file() or not (root/'navigation'/'npe-stage5'/'index.html').is_file():
            raise Stage5Error('Point --root at simulator repo checkout with stage5 frontend')
        from functools import partial
        class Local(Handler):pass
        Local.service=service
        srv=ThreadingHTTPServer(('127.0.0.1',a.port),partial(Local,root=root))
        print(f'PRIVATE STAGE 5 LAB: http://127.0.0.1:{a.port}/navigation/npe-stage5/index.html')
        print('REFERENCE ONLY / NO ACTIVE FMC LEGS, LNAV or AUTOPILOT')
        try:srv.serve_forever()
        except KeyboardInterrupt:pass
        finally:srv.server_close()
    finally:
        if temp:shutil.rmtree(temp,ignore_errors=True)
if __name__=='__main__':main()