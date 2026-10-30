"""Tests for public HTTPS -> owner's read-only localhost bridge (synthetic DB)."""
from functools import partial
import http.client
from http.server import ThreadingHTTPServer
import json
from pathlib import Path
import sys
import threading
import unittest
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from navdata_public_bridge_v1 import create_server, PrivateCatalogService, PAGES_ORIGIN
from test_navdata_catalog_v1 import NavDataCatalogTests

class PublicBridgeTests(unittest.TestCase):
    def setUp(self):
        fixture=NavDataCatalogTests()
        fixture.setUp()
        self.addCleanup(fixture.doCleanups)
        self.db=fixture.path
        self.token='synthetic-only-development-token-not-secret-12345'
        self.server=create_server(self.db,self.token,0)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True)
        self.thread.start()
        self.addCleanup(self.cleanup_server)

    def cleanup_server(self):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=4)

    def request(self,method,path,origin=PAGES_ORIGIN,token=None,host=None,additional=None):
        connection=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=5)
        headers={'Origin':origin,'Host':host or '127.0.0.1:'+str(self.server.server_port)}
        if token is not None:headers['X-B737-Nav-Token']=token
        headers.update(additional or {})
        try:
            connection.request(method,path,headers=headers)
            response=connection.getresponse()
            body=response.read()
            result=json.loads(body) if body else {}
            return response.status,dict(response.getheaders()),result
        finally:connection.close()

    def test_owner_public_site_can_read_source_with_token(self):
        status,headers,data=self.request('GET','/api/navdata/status',token=self.token)
        self.assertEqual(status,200)
        self.assertEqual(headers.get('Access-Control-Allow-Origin'),PAGES_ORIGIN)
        self.assertEqual(data['airac'],'2610')
        self.assertFalse(data['fmc_executable'])
        status,_,data=self.request('GET','/api/stage6/navdata?kind=airport&ident=OIII',token=self.token)
        self.assertEqual(status,200)
        self.assertEqual(data['lookup']['rows'][0]['icao'],'OIII')
        self.assertFalse(data['fmc_executable'])
        status,_,data=self.request('GET','/api/stage6/catalog?airport=OIII&kind=SID',token=self.token)
        self.assertEqual(status,200)
        self.assertEqual(data['items'][0]['ident'],'SYN1')
        self.assertEqual(data['items'][0]['status'],'SOURCE_ONLY_NOT_FMC_EXECUTABLE')

    def test_private_data_not_readable_without_capability(self):
        for supplied in (None,'invalid',''):
            with self.subTest(supplied=supplied):
                status,_,_=self.request('GET','/api/stage6/navdata?kind=airport&ident=OIII',token=supplied)
                self.assertEqual(status,401)
        status,headers,_=self.request('GET','/api/stage6/navdata?kind=airport&ident=OIII',
                                       origin='https://attacker.example',token=self.token)
        self.assertEqual(status,403)
        self.assertNotIn('Access-Control-Allow-Origin',headers)
        status,_,_=self.request('GET','/api/stage6/navdata?kind=airport&ident=OIII',
                                 token=self.token,host='attacker.example')
        self.assertEqual(status,403)

    def test_no_static_download_and_no_mutations(self):
        for path in ('/private.sqlite','/','/api/navdata/source.zip','/api/stage5/compose'):
            with self.subTest(path=path):
                status,_,_=self.request('GET',path,token=self.token)
                self.assertEqual(status,403)
        status,_,_=self.request('POST','/api/stage6/navdata',token=self.token)
        self.assertEqual(status,405)

    def test_cors_preflight_only_whitelisted_origin_and_headers(self):
        good={'Access-Control-Request-Method':'GET',
              'Access-Control-Request-Headers':'x-b737-nav-token',
              'Access-Control-Request-Private-Network':'true'}
        status,headers,_=self.request('OPTIONS','/api/stage6/catalog',additional=good)
        self.assertEqual(status,204)
        self.assertEqual(headers.get('Access-Control-Allow-Private-Network'),'true')
        status,_,_=self.request('OPTIONS','/api/stage6/catalog',
                                origin='https://attacker.example',additional=good)
        self.assertEqual(status,403)
        status,_,_=self.request('OPTIONS','/api/stage6/catalog',
                                additional={**good,'Access-Control-Request-Headers':'authorization'})
        self.assertEqual(status,403)

    def test_repeated_parameters_and_incomplete_identifiers_rejected(self):
        for path in ('/api/stage6/navdata?kind=airport&ident=OIII&ident=OMDB',
                     '/api/stage6/navdata?kind=airport&ident=OIII&unexpected=x',
                     '/api/stage6/catalog?airport=OIII&kind=BAD',
                     '/api/navdata/status?download=true'):
            with self.subTest(path=path):
                status,_,_=self.request('GET',path,token=self.token)
                self.assertEqual(status,422)

if __name__=='__main__': unittest.main()
