#!/usr/bin/env python3
"""Stage7 private localhost visual reference-leg API. No operational guidance."""
import argparse
import json
from pathlib import Path
import tempfile
from functools import partial
from http.server import ThreadingHTTPServer

from npe_stage6_server import Stage6Handler,Stage6Service,STAGE3_MEMBERS,STAGE4_MEMBER,safe_extract_known
from npe_stage5_server import Stage5Error
from procedure_reference_leg_engine import compile_reference,LegReferenceError

class Stage7Service(Stage6Service):
    def procedure_reference(self,airport,kind,ident,runway=None,transition=None):
        if not self.compose_enabled:raise Stage5Error('Validated Stage1-3 sources required')
        return compile_reference(self.stage1,airport,kind,ident,runway=runway,transition=transition)

class Stage7Handler(Stage6Handler):
    def dispatch(self):
        from urllib.parse import urlsplit,parse_qs
        self.check_host()
        u=urlsplit(self.path)
        if u.path=='/api/stage7/procedure-reference' and self.command=='GET':
            args=parse_qs(u.query)
            if set(args)-{'airport','kind','ident','runway','transition'}:raise Stage5Error('Unexpected query field')
            def one(key):
                items=args.get(key,[])
                if len(items)>1:raise Stage5Error('Repeated query param: '+key)
                return items[0] if items else None
            airport,kind,ident=map(one,('airport','kind','ident'))
            if not all((airport,kind,ident)):raise Stage5Error('Explicit airport, kind and procedure required')
            return self.service.procedure_reference(airport,kind,ident,runway=one('runway'),transition=one('transition'))
        return super().dispatch()

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--stage3-zip',required=True);ap.add_argument('--stage4-zip',required=True)
    ap.add_argument('--root',default='.',help='Public repository web root; source archives are outside this root')
    ap.add_argument('--port',type=int,default=8767);args=ap.parse_args()
    root=Path(args.root).resolve()
    if not (root/'cdu-standalone-v6/index.html').is_file() or not (root/'navigation/npe-stage7/index.html').is_file():
        ap.error('Point --root to simulator repository with Stage7 frontend')
    with tempfile.TemporaryDirectory(prefix='b737-nav-stage7-private-') as folder:
        private=Path(folder)
        safe_extract_known(args.stage3_zip,STAGE3_MEMBERS,private)
        safe_extract_known(args.stage4_zip,{STAGE4_MEMBER:'stage4.sqlite'},private)
        service=Stage7Service(private/'stage4.sqlite',private/'stage1.sqlite',private/'stage2.sqlite',private/'stage3.sqlite')
        class Local(Stage7Handler):pass
        Local.service=service
        server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(Local,root=root))
        print(f'PRIVATE NPE STAGE7: http://127.0.0.1:{args.port}/navigation/npe-stage7/index.html')
        print('NO EXECUTABLE PROCEDURE LEGS; NO LNAV/VNAV/AFDS')
        try:server.serve_forever()
        except KeyboardInterrupt:pass
        finally:server.server_close()

if __name__=='__main__':main()