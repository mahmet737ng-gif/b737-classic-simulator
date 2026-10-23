"""Private Stage9 loopback service smoke tests (requires local Stage4 fixture)."""
import json,os,socket,subprocess,sys,time,unittest,urllib.request,urllib.error
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
DB=os.environ.get('NPE_STAGE9_PRIVATE_STAGE4')

@unittest.skipUnless(DB and Path(DB).exists(),'requires private Stage4 SQLite fixture')
class Stage9Http(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  sock=socket.socket();sock.bind(('127.0.0.1',0));cls.port=sock.getsockname()[1];sock.close()
  cls.proc=subprocess.Popen([sys.executable,str(ROOT/'navigation/npe_stage9_server.py'),
       '--stage4',DB,'--root',str(ROOT),'--port',str(cls.port)],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  cls.base=f'http://127.0.0.1:{cls.port}'
  for _ in range(100):
   if cls.proc.poll() is not None:raise RuntimeError('Stage9 server failed to start: '+cls.proc.stderr.read().decode())
   try:
    cls.req('/api/stage9/status');break
   except Exception:time.sleep(.04)
  else:raise RuntimeError('Stage9 server timed out')
 @classmethod
 def tearDownClass(cls):
  cls.proc.terminate()
  try:cls.proc.wait(timeout=2)
  except subprocess.TimeoutExpired:cls.proc.kill()
 @classmethod
 def req(cls,path,payload=None,headers=None):
  data=json.dumps(payload).encode() if payload is not None else None
  req=urllib.request.Request(cls.base+path,data=data,headers={'Content-Type':'application/json',**(headers or {})})
  with urllib.request.urlopen(req,timeout=4) as result:return json.load(result)
 def test_status(self):
  d=self.req('/api/stage9/status');self.assertEqual(d['airac'],'2610');self.assertFalse(d['afds'])
 def test_reference_source(self):
  d=self.req('/api/stage9/reference?id=1');self.assertEqual(len(d['reference_chords']),10)
 def test_no_consent(self):
  with self.assertRaises(urllib.error.HTTPError):self.req('/api/stage9/start',{'plan_id':1,'leg_index':0,'sim_only_consent':False})
 def test_lifecycle_and_bad_sensor(self):
  a=self.req('/api/stage9/start',{'plan_id':1,'leg_index':0,'sim_only_consent':True})
  token=a['session']
  r=self.req('/api/stage9/step',{'session':token,'sensor':{
   'source':'SIMULATOR_INTERNAL','integrity':'VALID','lat':35.445472,'lon':50.905361,'track_true_deg':50.638,'gs_kt':220,'sim_time_s':1}})
  self.assertEqual(r['mode'],'SIM_REFERENCE_TRACK');self.assertEqual(r['afds_commands'],[])
  b=self.req('/api/stage9/step',{'session':token,'sensor':{
   'source':'SIMULATOR_INTERNAL','integrity':'FAILED','lat':35.445472,'lon':50.905361,'track_true_deg':50.638,'gs_kt':220,'sim_time_s':2}})
  self.assertEqual(b['mode'],'SUSPENDED');self.assertEqual(b['afds_commands'],[])
  self.assertEqual(self.req('/api/stage9/disengage',{'session':token})['mode'],'OFF')
 def test_host_rejected(self):
  with self.assertRaises(urllib.error.HTTPError) as e:self.req('/api/stage9/status',headers={'Host':'attacker.example'})
  self.assertIn(e.exception.code,(403,422))

if __name__=='__main__':unittest.main()