#!/usr/bin/env python3
"""Private loopback-only reference-progress read API for AIRAC 2610 Stage4.

Additive Stage8 progress diagnostic. Reuses existing Stage5 private Plan Store;
never sends user-owned source SQLite files as public static assets.
"""
import argparse
from functools import partial
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import shutil
import tempfile
from urllib.parse import parse_qs,urlsplit
import zipfile

from npe_stage5_server import Handler,Stage5Service,Stage5Error
from reference_progress import VERSION,candidates,analyze

class ReferenceService(Stage5Service):
    def references(self,plan_id):
        plan=self.plan(plan_id)
        return {'version':VERSION,'airac':'2610','source':'PMDG_WORLD_2610_WITH_PROCEDURES_R1',
         'plan_id':plan_id,'origin':plan['origin'],'destination':plan['destination'],
         'discontinuities':plan['qa']['discontinuity_count'],
         'manual_selectable_reference_chords':candidates(plan),
         'no_automatic_sequencing':True,'fmc_executable':False,
         'advisory_only':True,'afds_commands':[]}
    def sample(self,payload):
        if not isinstance(payload,dict) or set(payload)!={'plan_id','to_item_index','lat','lon'}:
            raise Stage5Error('Manual plan/position selection fields required')
        plan_id=payload['plan_id']
        if type(plan_id) is not int:raise Stage5Error('Invalid private plan id')
        return {'plan_id':plan_id,**analyze(self.plan(plan_id),payload['to_item_index'],payload['lat'],payload['lon'])}

class ReferenceHandler(Handler):
    def dispatch(self):
        self.check_host()
        url=urlsplit(self.path)
        if url.path=='/api/stage8/reference' and self.command=='GET':
            args=parse_qs(url.query)
            if set(args)!={'id'} or len(args['id'])!=1:raise Stage5Error('Invalid plan query')
            return self.service.references(int(args['id'][0]))
        if url.path=='/api/stage8/position' and self.command=='POST':
            if self.headers.get('Content-Type','').split(';')[0].strip()!='application/json':
                raise Stage5Error('Require application/json')
            size=int(self.headers.get('Content-Length','0'))
            if not 2<=size<=2048:raise Stage5Error('Invalid position request size')
            return self.service.sample(json.loads(self.rfile.read(size)))
        return super().dispatch()

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    src=parser.add_mutually_exclusive_group(required=True)
    src.add_argument('--stage4-zip');src.add_argument('--stage4-db')
    parser.add_argument('--root',default='.')
    parser.add_argument('--port',type=int,default=8769)
    args=parser.parse_args()
    root=Path(args.root).resolve()
    if not (root/'navigation/reference-progress/index.html').is_file() or not (root/'cdu-standalone-v6/index.html').is_file():
        parser.error('Set --root to the actual simulator checkout')
    tmp=None
    try:
        filename=args.stage4_db
        if args.stage4_zip:
            tmp=Path(tempfile.mkdtemp(prefix='b737-progress-private-'))
            with zipfile.ZipFile(args.stage4_zip) as archive:
                member='NPE_STAGE4/NPE_STAGE4_FLIGHT_PLANS_PRIVATE.sqlite'
                info=archive.getinfo(member)
                if info.file_size<=0 or info.file_size>100_000_000:
                    raise Stage5Error('Private SQLite archive size invalid')
                with archive.open(member) as src,(tmp/'stage4.sqlite').open('wb') as dst:
                    shutil.copyfileobj(src,dst)
            filename=str(tmp/'stage4.sqlite')
        service=ReferenceService(filename)
        class Local(ReferenceHandler):pass
        Local.service=service
        server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(Local,root=root))
        print(f'PRIVATE REFERENCE PROGRESS: http://127.0.0.1:{args.port}/navigation/reference-progress/index.html')
        print('SIMULATOR DIAGNOSTIC — NO LNAV / VNAV / AFDS')
        try:server.serve_forever()
        except KeyboardInterrupt:pass
        finally:server.server_close()
    finally:
        if tmp:shutil.rmtree(tmp,ignore_errors=True)

if __name__=='__main__':main()