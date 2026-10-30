"""Stage6 private NAVDATA lookup integration tests, with synthetic source only."""
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
import http.client
import json
import sys
import threading
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'navigation'))
from npe_stage6_server import Stage6Handler,Stage6Service
from test_navdata_catalog_v1 import NavDataCatalogTests


class Stage6LookupIntegrationTests(unittest.TestCase):
    def setUp(self):
        fixture=NavDataCatalogTests()
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        self.service=Stage6Service.__new__(Stage6Service)
        self.service.stage1=fixture.path
        self.service.compose_enabled=True

    def test_source_query_is_private_and_reference_only(self):
        airport=self.service.navdata_lookup('airport',ident='OIII')
        self.assertEqual(airport['airac'],'2610')
        self.assertEqual(airport['kind'],'airport')
        self.assertEqual(airport['lookup']['rows'][0]['icao'],'OIII')
        self.assertFalse(airport['fmc_executable'])
        self.assertFalse(airport['lookup']['fmc_executable'])
        self.assertEqual(self.service.navdata_lookup('runways',airport='OIII')
                         ['lookup']['rows'][0]['runway_ident'],'29R')
        self.assertEqual(len(self.service.navdata_lookup('waypoints',ident='DUP')
                             ['lookup']['rows']),2)
        self.assertEqual(self.service.navdata_lookup('navaids',ident='VOR')
                         ['lookup']['rows'][0]['type'],'VOR')
        self.assertEqual(self.service.navdata_lookup('airways',ident='A1')
                         ['lookup']['rows'][0]['fix_ident'],'DUP')
        self.assertEqual(self.service.navdata_lookup('procedures',airport='OIII',ident='SID')
                         ['lookup']['rows'][0]['ident'],'SYN1')

    def test_bad_query_fields_never_fallback_to_demo_data(self):
        for kind,ident,airport in [
            ('airport',None,None),('airport','OIII','OIII'),
            ('runways',None,None),('waypoints',None,None),
            ('procedures','DEP','OIII'),('unknown','OIII',None)
        ]:
            with self.subTest(kind=kind,ident=ident,airport=airport):
                with self.assertRaises(ValueError):
                    self.service.navdata_lookup(kind,ident=ident,airport=airport)

    def test_no_private_source_fails_closed(self):
        self.service.compose_enabled=False
        with self.assertRaises(ValueError):
            self.service.navdata_lookup('airport',ident='OIII')

    def test_real_loopback_get_routes_and_rejects_repeated_params(self):
        class Local(Stage6Handler):
            pass
        Local.service=self.service
        srv=ThreadingHTTPServer(('127.0.0.1',0),partial(Local,root=ROOT))
        srv.daemon_threads=True
        thread=threading.Thread(target=srv.serve_forever,daemon=True)
        thread.start()
        self.addCleanup(lambda:(srv.shutdown(),srv.server_close(),thread.join(timeout=3)))

        def get(path,host=None):
            conn=http.client.HTTPConnection('127.0.0.1',srv.server_port,timeout=3)
            try:
                headers={'Host':host} if host is not None else {}
                conn.request('GET',path,headers=headers)
                r=conn.getresponse()
                return r.status,json.loads(r.read())
            finally:conn.close()

        ok,body=get('/api/stage6/navdata?kind=airport&ident=OIII')
        self.assertEqual(ok,200)
        self.assertEqual(body['lookup']['rows'][0]['icao'],'OIII')
        for url in (
            '/api/stage6/navdata?kind=airport&ident=OIII&ident=OMDB',
            '/api/stage6/navdata?kind=airport&ident=OIII&extra=true',
            '/api/stage6/navdata?kind=airways&ident=A1&airport=OIII',
        ):
            with self.subTest(url=url):
                status,_=get(url)
                self.assertEqual(status,422)
        denied,_=get('/api/stage6/navdata?kind=airport&ident=OIII','evil.example')
        self.assertNotEqual(denied,200)


if __name__=='__main__':unittest.main()
