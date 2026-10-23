import unittest,json,sys,threading,urllib.request,urllib.error
from pathlib import Path
from functools import partial
from http.server import ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from npe_stage8_server import PrivatePlanStore
from npe_stage10_server import Handler
from test_npe_stage10 import sample,synthetic_stage4_plan
import zipfile,tempfile,shutil,sqlite3

class HTTPTest(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.d=tempfile.TemporaryDirectory()
  root=Path(cls.d.name)
  with sqlite3.connect(root/'test.sqlite') as con:
   con.execute('CREATE TABLE meta (key TEXT, value TEXT)')
   con.execute('INSERT INTO meta VALUES (?,?)',('version','NPE_STAGE4_FLIGHT_PLAN_DRAFT_v1'))
   con.execute('CREATE TABLE plans (id INTEGER PRIMARY KEY,origin TEXT,destination TEXT,airac TEXT,status TEXT,discontinuities INTEGER,payload_json TEXT)')
   con.execute('INSERT INTO plans VALUES (?,?,?,?,?,?,?)',
      (1,'ZZAA','ZZBB','2610','DRAFT',1,json.dumps(synthetic_stage4_plan())))
  cls.store=PrivatePlanStore(str(root/'test.sqlite'))
  cls.srv=ThreadingHTTPServer(('127.0.0.1',0),partial(Handler,root=root,store=cls.store,sessions={},guard=threading.RLock()))
  cls.thread=threading.Thread(target=cls.srv.serve_forever,daemon=True);cls.thread.start()
  cls.port=cls.srv.server_port
 @classmethod
 def tearDownClass(cls):
  cls.srv.shutdown();cls.srv.server_close();cls.thread.join(3);cls.store.close();cls.d.cleanup()
 def call(self,path,body=None,host=None):
  data=json.dumps(body).encode() if body is not None else None
  url=f'http://127.0.0.1:{self.port}/api/stage10/{path}'
  h={'Content-Type':'application/json'}
  if host:h['Host']=host
  req=urllib.request.Request(url,data=data,headers=h,method='POST' if body is not None else 'GET')
  try:
   with urllib.request.urlopen(req,timeout=3) as x:return x.status,json.load(x)
  except urllib.error.HTTPError as e:return e.code,json.loads(e.read())
 def test_status_no_phantom_live_simulator(self):
  code,v=self.call('status');self.assertEqual(code,200)
  self.assertFalse(v['real_simulator_bridge_connected']);self.assertFalse(v['afds_connected'])
 def test_host_rebinding_rejected(self):
  code,_=self.call('status',host='attack.invalid');self.assertEqual(code,422)
 def test_workflow_and_afds_deny(self):
  code,plans=self.call('plans');self.assertEqual(code,200)
  pid=plans['plans'][0]['id'];self.assertGreater(pid,0)
  code,new=self.call('new',{'plan_id':pid});self.assertEqual(code,200)
  token=new['session']
  code,bus=self.call('telemetry',{'session':token,'aircraft':sample()});self.assertEqual(code,200)
  code,arm=self.call('arm',{'session':token,'sim_only_consent':True});self.assertEqual(code,200)
  code,frame=self.call('frame',{'session':token});self.assertEqual(code,200)
  self.assertEqual(frame['mode'],'SIM_REFERENCE_TRACK');self.assertEqual(frame['afds_commands'],[])
  code,blocked=self.call('afds-request',{'session':token});self.assertEqual(code,200)
  self.assertFalse(blocked['accepted'])
  code,ended=self.call('stop',{'session':token});self.assertEqual(code,200)
  self.assertEqual(ended['mode'],'OFF')
 def test_status_expires_when_sensor_stops(self):
  _,new=self.call('new',{'plan_id':1})
  token=new['session']
  self.assertEqual(self.call('telemetry',{'session':token,'aircraft':sample()})[0],200)
  self.assertTrue(self.call('status')[1]['telemetry_source_connected'])
  self.srv.RequestHandlerClass.keywords['sessions'][token].bus.arrived_at-=15
  self.assertFalse(self.call('status')[1]['telemetry_source_connected'])
  self.call('stop',{'session':token})
 def test_reject_non_json_post(self):
  url=f'http://127.0.0.1:{self.port}/api/stage10/new'
  req=urllib.request.Request(url,data=b'plan_id=1',headers={'Content-Type':'application/x-www-form-urlencoded'},method='POST')
  with self.assertRaises(urllib.error.HTTPError) as e:urllib.request.urlopen(req,timeout=3)
  self.assertEqual(e.exception.code,422)
 def test_bad_token(self):
  code,_=self.call('frame',{'session':'wrong'});self.assertEqual(code,422)
if __name__=='__main__':unittest.main()