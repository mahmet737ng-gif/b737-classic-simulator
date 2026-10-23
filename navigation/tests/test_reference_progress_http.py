"""Stage8 loopback REST and origin protections, synthetic-only."""
import http.client,json,sys,threading,unittest
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from reference_progress_server import ReferenceHandler
from reference_progress import candidates,analyze,VERSION
from test_reference_progress import source

class FakeService:
    def plans(self):return [{'id':1,'origin':'ZZAA','destination':'ZZBB'}]
    def references(self,id):
        if id!=1:raise ValueError('No private plan')
        p=source();return {'version':VERSION,'airac':'2610','plan_id':1,
          'origin':p['origin'],'destination':p['destination'],
          'manual_selectable_reference_chords':candidates(p),'discontinuities':2,
          'no_automatic_sequencing':True,'fmc_executable':False}
    def sample(self,payload):
        if set(payload)!={'plan_id','to_item_index','lat','lon'} or payload['plan_id']!=1:raise ValueError('Invalid request')
        return {'plan_id':1,**analyze(source(),payload['to_item_index'],payload['lat'],payload['lon'])}

class ApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        class Local(ReferenceHandler):pass
        Local.service=FakeService()
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(Local,root=Path(__file__).resolve().parents[2]))
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.thread.join(2)
    def request(self,verb,url,data=None,headers=None):
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port,timeout=4)
        try:
            h={'Host':'127.0.0.1:'+str(self.server.server_port),'Content-Type':'application/json'}
            if headers:h.update(headers)
            conn.request(verb,url,body=json.dumps(data) if data is not None else None,headers=h)
            r=conn.getresponse();return r.status,json.loads(r.read())
        finally:conn.close()
    def test_get_reference(self):
        s,x=self.request('GET','/api/stage8/reference?id=1')
        self.assertEqual(s,200);self.assertEqual(len(x['manual_selectable_reference_chords']),2)
        self.assertFalse(x['fmc_executable'])
    def test_post_manual_reference(self):
        s,x=self.request('POST','/api/stage8/position',{'plan_id':1,'to_item_index':3,'lat':0.01,'lon':0.5})
        self.assertEqual(s,200);self.assertEqual(x['status'],'REFERENCE_ADVISORY_ONLY_NO_AUTO_SEQUENCING')
        self.assertEqual(x['afds_commands'],[])
    def test_reject_route_gap(self):
        s,x=self.request('POST','/api/stage8/position',{'plan_id':1,'to_item_index':5,'lat':1,'lon':1})
        self.assertEqual(s,422)
    def test_reject_foreign_host(self):
        s,x=self.request('GET','/api/stage8/reference?id=1',headers={'Host':'foreign.example'})
        self.assertEqual(s,422)
    def test_reject_foreign_origin(self):
        s,x=self.request('POST','/api/stage8/position',{'plan_id':1,'to_item_index':3,'lat':0,'lon':0},headers={'Origin':'https://evil.example'})
        self.assertEqual(s,422)
    def test_reject_extra_fields(self):
        s,x=self.request('POST','/api/stage8/position',{'plan_id':1,'to_item_index':3,'lat':0,'lon':0,'autopilot':True})
        self.assertEqual(s,422)

if __name__=='__main__':unittest.main()