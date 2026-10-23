#!/usr/bin/env python3
"""Private-only Stage6 CDU DEP/ARR source selector and validated draft re-composer.

Requires user-held Stage3 licensed data and Stage4 draft archives. No private
SQL files are copied into the public web directory. NO FMC/LNAV output.
"""
import argparse
import json
from pathlib import Path
import shutil
import tempfile
import zipfile
from functools import partial
from http.server import ThreadingHTTPServer
from urllib.parse import urlsplit,parse_qs

from npe_stage5_server import Stage5Service,Handler,Stage5Error
from flight_plan_engine import RouteError
from procedure_semantics import catalog, inspect

STAGE3_MEMBERS={
  'private_data/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE1.sqlite':'stage1.sqlite',
  'private_data/B737_NAVDB_WORLD_AIRAC2610_NPE_STAGE2_GEOMETRY.sqlite':'stage2.sqlite',
  'private_data/NPE_STAGE3_INTENTS.sqlite':'stage3.sqlite',
}
STAGE4_MEMBER='NPE_STAGE4/NPE_STAGE4_FLIGHT_PLANS_PRIVATE.sqlite'

def safe_extract_known(archive,mapping,output):
    with zipfile.ZipFile(archive) as z:
        for source,target in mapping.items():
            info=z.getinfo(source)
            if not 0 < info.file_size <= 700_000_000:
                raise Stage5Error('Unexpected private SQLite archive size')
            with z.open(info) as stream,(output/target).open('wb') as to:
                shutil.copyfileobj(stream,to,2*1024*1024)

class Stage6Service(Stage5Service):
    def catalog(self,airport,kind):
        if not self.compose_enabled:raise Stage5Error('Stage 3 private data required')
        return {'airac':'2610','airport':airport.upper(),'kind':kind,
                'items':catalog(self.stage1,airport,kind),
                'fmc_executable':False}
    def semantics(self,airport,kind,ident,runway=None,transition=None):
        if not self.compose_enabled:raise Stage5Error('Stage 3 private data required')
        return inspect(self.stage1,airport,kind,ident,runway,transition)
    def selection_compose(self,payload):
        if not self.compose_enabled:raise Stage5Error('Stage 3 private data required')
        if not isinstance(payload,dict) or set(payload)!={'plan_id','selections'}:
            raise Stage5Error('Only a saved private plan and explicit source selections are accepted')
        plan_id=payload['plan_id']
        if type(plan_id) is not int or plan_id not in self.plan_ids:raise Stage5Error('Invalid saved plan ID')
        plan=self.plan(plan_id); sels=payload['selections']
        if not isinstance(sels,dict) or set(sels)-{'SID','STAR','APP'}:raise Stage5Error('Invalid selection kinds')
        request={'origin':plan['origin'],'destination':plan['destination'],'enroute':[]}
        for sec in plan['enroute_sections']:
            if sec['status']!='REFERENCE_ONLY':continue
            if sec.get('route_type','AIRWAY')!='AIRWAY':
                raise Stage5Error('DCT source record cannot be reconstructed without exact waypoint ID')
            if sec.get('via') in ('SID','STAR','APP') or not sec.get('from') or not sec.get('to'):
                raise Stage5Error('Airway entry/exit provenance incomplete')
            request['enroute'].append({'type':'AIRWAY','ident':sec['via'],'entry':sec['from'],'exit':sec['to']})
        keys={'SID':'departure','STAR':'arrival','APP':'approach'}
        for kind,key in keys.items():
            value=sels.get(kind,'SAME')
            if value=='SAME':
                old=plan.get('selected_'+key)
                if old:value={'ident':old['ident'],'runway':old['selected_runway'], 'transition':old['selected_transition']}
                else:value=None
            if value is None:continue
            if not isinstance(value,dict) or set(value)-{'ident','runway','transition'} or not isinstance(value.get('ident'),str):
                raise Stage5Error('Invalid '+kind+' source selection')
            if not value['ident'].isascii() or len(value['ident'])>12:raise Stage5Error('Invalid identifier')
            if value.get('runway') is not None and not isinstance(value['runway'],str):raise Stage5Error('Invalid runway')
            if value.get('transition') is not None and not isinstance(value['transition'],str):raise Stage5Error('Invalid transition')
            request[key]={k:v for k,v in value.items() if v is not None}
            airport=plan['origin'] if kind=='SID' else plan['destination']
            inspect(self.stage1,airport,kind,value['ident'],value.get('runway'),value.get('transition'))
        output=self.guard(self.compose(request))
        # Keep every discontinuity from the trusted composer; never add an inferred join.
        return output

class Stage6Handler(Handler):
    def dispatch(self):
        self.check_host()
        u=urlsplit(self.path)
        p=parse_qs(u.query)
        if u.path=='/api/stage6/catalog' and self.command=='GET':
            if set(p)-{'airport','kind'}:raise Stage5Error('Invalid catalogue query')
            return self.service.catalog(p.get('airport',[''])[0],p.get('kind',[''])[0])
        if u.path=='/api/stage6/semantics' and self.command=='GET':
            if set(p)-{'airport','kind','ident','runway','transition'}:raise Stage5Error('Invalid procedure query')
            return self.service.semantics(*[p.get(k,[''])[0] for k in ('airport','kind','ident')],
                runway=p.get('runway',[None])[0],transition=p.get('transition',[None])[0])
        if u.path=='/api/stage6/compose' and self.command=='POST':
            if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json':raise Stage5Error('JSON required')
            n=int(self.headers.get('Content-Length','0'))
            if n<2 or n>8192:raise Stage5Error('Invalid request size')
            return self.service.selection_compose(json.loads(self.rfile.read(n)))
        return super().dispatch()

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--stage3-zip',required=True,help='Existing user-owned private NPE Stage3 bundle')
    ap.add_argument('--stage4-zip',required=True,help='Existing user-owned private NPE Stage4 bundle')
    ap.add_argument('--root',default='.')
    ap.add_argument('--port',type=int,default=8766)
    args=ap.parse_args()
    root=Path(args.root).resolve()
    if not (root/'cdu-standalone-v6/index.html').is_file():ap.error('Root must be simulator checkout')
    with tempfile.TemporaryDirectory(prefix='b737-npe-stage6-') as temporary:
        private=Path(temporary)
        safe_extract_known(args.stage3_zip,STAGE3_MEMBERS,private)
        safe_extract_known(args.stage4_zip,{STAGE4_MEMBER:'stage4.sqlite'},private)
        service=Stage6Service(private/'stage4.sqlite',private/'stage1.sqlite',private/'stage2.sqlite',private/'stage3.sqlite')
        class Local(Stage6Handler):pass
        Local.service=service
        server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(Local,root=root))
        print(f'Local CDU Stage6: http://127.0.0.1:{args.port}/navigation/npe-stage5/index.html')
        print('STRICT AIRAC 2610 / REFERENCE ONLY / NO LNAV VNAV AFDS')
        try:server.serve_forever()
        except KeyboardInterrupt:pass
        finally:server.server_close()
if __name__=='__main__':main()