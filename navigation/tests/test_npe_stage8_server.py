import json,os,sys,threading,unittest,urllib.request,urllib.error
from functools import partial
from http.server import ThreadingHTTPServer
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from npe_stage8_server import Handler,PrivatePlanStore

@unittest.skipUnless(os.environ.get('NPE_STAGE8_PRIVATE_STAGE4'),'requires local private Stage4 data')
class LocalHttpTests(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.store=PrivatePlanStore(os.environ['NPE_STAGE8_PRIVATE_STAGE4'])
  cls.server=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,root=Path(__file__).resolve().parents[1],store=cls.store))
  cls.port=cls.server.server_port
  cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
 @classmethod
 def tearDownClass(cls):
  cls.server.shutdown();cls.server.server_close();cls.thread.join();cls.store.close()
 def url(self,path):return f'http://127.0.0.1:{self.port}{path}'
 def json(self,path,**kwargs):
  with urllib.request.urlopen(urllib.request.Request(self.url(path),**kwargs),timeout=4) as r:return json.load(r)
 def test_status_keeps_guidance_off(self):
  d=self.json('/api/stage8/status')
  self.assertEqual(d['guidance'],'OFF');self.assertFalse(d['fmc_executable'])
 def test_reference_does_not_cross_gaps(self):
  out=self.json('/api/stage8/reference?id=1')
  self.assertEqual(len(out['reference_chords']),10);self.assertEqual(len(out['gaps']),4)
  self.assertEqual(out['lnav_commands'],[])
 def test_position_no_autopilot(self):
  data=json.dumps({'plan_id':1,'reference_leg_index':0,'position':{'lat':35.7,'lon':51.3}}).encode()
  out=self.json('/api/stage8/position',method='POST',data=data,headers={'Content-Type':'application/json'})
  self.assertFalse(out['sequencer_advanced']);self.assertEqual(out['aircraft_control_commands'],[])
 def test_bad_host_rejected(self):
  req=urllib.request.Request(self.url('/api/stage8/status'),headers={'Host':'example.com'})
  with self.assertRaises(urllib.error.HTTPError) as c:urllib.request.urlopen(req,timeout=4)
  self.assertEqual(c.exception.code,422)
 def test_bad_origin_rejected(self):
  req=urllib.request.Request(self.url('/api/stage8/status'),headers={'Origin':'https://evil.example'})
  with self.assertRaises(urllib.error.HTTPError):urllib.request.urlopen(req,timeout=4)
 def test_invalid_leg_index_rejected(self):
  data=json.dumps({'plan_id':1,'reference_leg_index':999,'position':{'lat':35.7,'lon':51.3}}).encode()
  req=urllib.request.Request(self.url('/api/stage8/position'),method='POST',data=data)
  with self.assertRaises(urllib.error.HTTPError) as err:urllib.request.urlopen(req,timeout=4)
  self.assertEqual(err.exception.code,422)
if __name__=='__main__':unittest.main()