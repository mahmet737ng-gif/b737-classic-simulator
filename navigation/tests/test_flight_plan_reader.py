import json,sqlite3,tempfile,unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from flight_plan_engine import store_snapshot,RouteError
from flight_plan_reader import page,open_drafts, retrieve

class CduPayloadTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=Path(self.tmp.name)/'db.sqlite'
  self.plan={'origin':'AAAA','destination':'BBBB','airac':'2610','status':'DRAFT',
    'fmc_legs_activated':0,'autopilot_guidance_enabled':False,
    'qa':{'discontinuity_count':1},
    'items':[{'type':'DISCONTINUITY','label':'ROUTE DISCONTINUITY'}],
    'rte_page_model':{'rows':[{'via':'A1','to':'TEST'}]},
    'legs_page_model':{'rows':[{'ident':f'F{i}','type':'FIX'} for i in range(11)]}}
  store_snapshot(self.path,[self.plan])
 def tearDown(self):self.tmp.cleanup()
 def test_paginated_legs(self):
  first=page(self.path,kind='LEGS',number=1)
  third=page(self.path,kind='LEGS',number=3)
  self.assertEqual(first['page_count'],3)
  self.assertEqual(len(first['rows']),5)
  self.assertEqual(len(third['rows']),1)
  self.assertEqual(first['fmc_status'],'NOT_EXECUTABLE')
 def test_rte(self):
  self.assertEqual(page(self.path,kind='RTE')['rows'][0]['via'],'A1')
 def test_out_of_range_fails(self):
  with self.assertRaises(RouteError):page(self.path,kind='LEGS',number=4)
 def test_rejects_tampered_activation(self):
  with sqlite3.connect(self.path) as con:
   p=json.loads(con.execute('SELECT payload_json FROM plans').fetchone()[0]);p['fmc_legs_activated']=1
   con.execute('UPDATE plans SET payload_json=?',(json.dumps(p),))
  with self.assertRaises(RouteError):retrieve(self.path)
 def test_rejects_tampered_airac(self):
  with sqlite3.connect(self.path) as con: con.execute("UPDATE meta SET value='2609' WHERE key='airac'")
  with self.assertRaises(RouteError):open_drafts(self.path)

if __name__=='__main__':unittest.main()