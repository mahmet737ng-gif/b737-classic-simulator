"""Mathematical and workflow tests; no aircraft source data."""
import copy,json,sys,tempfile,threading,unittest
from unittest.mock import patch
from pathlib import Path
from http.server import ThreadingHTTPServer
from urllib.request import Request,urlopen
from urllib.error import HTTPError
sys.path.insert(0,str(Path(__file__).resolve().parents[2]))
from engine.technical_reader_v2.geometry import *
from engine.technical_reader_v2.workspace import ReviewWorkspace
from engine.technical_reader_v2.geometric_models import save_geometry_model,evaluate_geometry
from engine.technical_reader_v2.server import handler_class,model_from_spec

def nomogram():return {'input_axes':[{'ticks':[{'value':0,'pixel':[0,0]},{'value':10,'pixel':[0,100]}]},{'ticks':[{'value':0,'pixel':[100,0]},{'value':10,'pixel':[100,100]}]}],'output_axis':{'ticks':[{'value':0,'pixel':[50,0]},{'value':10,'pixel':[50,100]}]}}
class Geometry(unittest.TestCase):
 def test_rotated_affine(self):
  c=CartesianCalibration([{'pixel':[10,20],'value':[0,0]},{'pixel':[10,120],'value':[10,0]},{'pixel':[-90,20],'value':[0,20]}]);x,y=c.to_value([-40,70]);self.assertAlmostEqual(x,5);self.assertAlmostEqual(y,10)
 def test_projective(self):
  c=CartesianCalibration([{'pixel':[0,0],'value':[0,0]},{'pixel':[200,0],'value':[10,0]},{'pixel':[160,100],'value':[10,10]},{'pixel':[40,100],'value':[0,10]}]);x,y=c.to_value([100,62.5]);self.assertAlmostEqual(x,5);self.assertAlmostEqual(y,5)
 def test_log(self):
  c=CartesianCalibration([{'pixel':[0,0],'value':[1,100]},{'pixel':[100,0],'value':[100,100]},{'pixel':[0,100],'value':[1,1]}],x_scale='log10',y_scale='log10');x,y=c.to_value([50,50]);self.assertAlmostEqual(x,10);self.assertAlmostEqual(y,10)
 def test_collinear(self):
  with self.assertRaises(ReaderError):CartesianCalibration([{'pixel':[i,i],'value':[i,i]} for i in [0,1,2]])
 def test_invalid_log(self):
  with self.assertRaises(ReaderError):CartesianCalibration([{'pixel':[0,0],'value':[0,0]},{'pixel':[1,0],'value':[1,0]},{'pixel':[0,1],'value':[0,1]}],x_scale='log10')
 def test_polar(self):
  c=PolarCalibration([100,100],[[0,0],[100,10]]);self.assertEqual(c.to_value([100,0]),[90,10]);self.assertEqual(c.to_value([150,100]),[0,5])
 def test_loop_ambiguity(self):
  b=split_trace([[0,0],[2,2],[0,4]]);self.assertEqual(len(b),2)
  with self.assertRaisesRegex(ReaderError,'AMBIGUOUS'):read_trace(b,1)
  self.assertEqual(read_trace(b,1,'branch-1')['value'],1);self.assertEqual(read_trace(b,1,'branch-2')['value'],3)
 def test_vertical(self):
  with self.assertRaisesRegex(ReaderError,'VERTICAL'):read_trace(split_trace([[0,0],[0,2]]),0)
 def test_gap(self):
  with self.assertRaises(ReaderError):read_trace([{'id':'a','points':[[0,0],[1,1]]},{'id':'b','points':[[2,2],[3,3]]}],1.5)
 def test_nomogram(self):
  for a,b in [(2,8),(1,4),(10,10),(0,0)]:self.assertAlmostEqual(alignment_nomogram(inputs=[a,b],**nomogram())['value'],(a+b)/2)
 def test_nomogram_log(self):
  g=nomogram()
  for ax in g['input_axes']+[g['output_axis']]:ax.update(scale='log10');ax['ticks'][0]['value']=1;ax['ticks'][1]['value']=100
  self.assertAlmostEqual(alignment_nomogram(inputs=[1,100],**g)['value'],10)
 def test_envelope_boundary_and_hole(self):
  outer=[[0,0],[10,0],[10,10],[0,10]];hole=[[4,4],[6,4],[6,6],[4,6]]
  self.assertTrue(envelope_contains([outer],[0,5])['inside']);self.assertTrue(envelope_contains([outer],[5,5])['inside']);self.assertFalse(envelope_contains([outer,hole],[5,5])['inside']);self.assertFalse(envelope_contains([outer],[11,5])['inside'])
 def test_envelope_invalid(self):
  with self.assertRaises(ReaderError):envelope_contains([[[0,0],[1,1]]],[0,0])
 def test_nomogram_outside(self):
  with self.assertRaises(ReaderError):alignment_nomogram(inputs=[-1,2],**nomogram())
class Workflow(unittest.TestCase):
 def setUp(self):
  import fitz
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.pdf=self.root/'test.pdf';d=fitz.open()
  for text in ['TABLE pressure 10 20 30','Plain text page']:p=d.new_page();p.insert_text((70,70),text)
  d.save(self.pdf);d.close();self.db=self.root/'test.sqlite';self.w=ReviewWorkspace(self.db);self.w.index_pdf(self.pdf,'test')
 def tearDown(self):self.w.close();self.tmp.cleanup()
 def evidence(self):return self.w.render('test',1,self.root/'p.png',dpi=216)
 def test_inventory_not_reviewed(self):
  s=self.w.summary('test');self.assertEqual(s['indexed_pages'],2);self.assertFalse(s['all_pages_visually_reviewed']);self.assertFalse(s['all_pages_numerically_complete']);self.assertEqual(s['numeric_tokens_unreviewed'],3)
 def test_render_not_reviewed(self):self.evidence();self.assertEqual(self.w.summary('test')['page_states'],{'PENDING_VISUAL_REVIEW':2})
 def test_review_requires_inventory(self):
  with self.assertRaisesRegex(ReaderError,'REGION_INVENTORY'):self.w.review('test',1,'reader',self.evidence(),'Viewed large',numeric_complete=True)
 def test_small_review_rejected(self):
  e=self.evidence();e['width']=800
  with self.assertRaisesRegex(ReaderError,'LARGE_VISUAL'):self.w.review('test',1,'reader',e,'Viewed large')
 def test_no_promote_unconverted(self):
  self.w.add_region('test',1,'chart','curve',{})
  with self.assertRaisesRegex(ReaderError,'UNCONVERTED'):self.w.review('test',1,'reader',self.evidence(),'Viewed large',numeric_complete=True)
 def test_version_changed_rejected(self):
  self.pdf.write_bytes(b'changed')
  with self.assertRaisesRegex(ReaderError,'DOCUMENT_CHANGED'):self.w.index_pdf(self.pdf,'test')
 def test_render_source_changed(self):
  self.pdf.write_bytes(b'changed')
  with self.assertRaisesRegex(ReaderError,'SOURCE_FILE_CHANGED'):self.evidence()
 def test_no_numeric_complete(self):
  self.w.add_region('test',1,'note','no_numeric_content',{});s=self.w.review('test',1,'reader',self.evidence(),'Read full page; no numerical chart/table',numeric_complete=True);self.assertEqual(s['page_states']['VISUALLY_REVIEWED_NUMERIC_COMPLETE'],1);self.assertFalse(s['all_pages_numerically_complete'])
 def test_geometry_roundtrip(self):
  s={**nomogram(),'kind':'nomogram','id':'n','title':'Synthetic averaging nomogram','revision':1,'document_id':'test','page':1,'inputs':[{'name':'a','unit':'1'},{'name':'b','unit':'1'}],'output':{'name':'y','unit':'1'},'conditions':{'mode':'A'}};save_geometry_model(self.w,s);self.assertEqual(evaluate_geometry(self.w,'n',1,{'a':2,'b':8},{'mode':'A'})['value'],5)
  with self.assertRaises(ReaderError):evaluate_geometry(self.w,'n',1,{'a':2,'b':8},{'mode':'B'})
  s['title']='changed'
  with self.assertRaisesRegex(ReaderError,'REVISION_CONFLICT'):save_geometry_model(self.w,s)
 def test_table_blank_preserved(self):
  s={'document_id':'test','page':1,'id':'grid','title':'Synthetic','kind':'grid','inputs':[{'name':'x','unit':'1'},{'name':'z','unit':'1'}],'output':{'name':'y','unit':'1'},'rows':[['axis','0','10'],['0','2',''],['10','4','6']]};m=model_from_spec(self.w,s);self.assertIsNone(m['values'][1])
  with self.assertRaisesRegex(ReaderError,'MISSING_GRID_CELL'):self.w.store.calculate('grid',1,{'x':5,'z':5},mode='simulator')
 def test_export_scoped_to_document(self):
  other=copy.deepcopy(nomogram());other.update(kind='nomogram',id='n',title='Synthetic',revision=1,document_id='test',page=1,inputs=[{'name':'a','unit':'1'},{'name':'b','unit':'1'}],output={'name':'y','unit':'1'})
  save_geometry_model(self.w,other);self.w.index_pdf(self.pdf,'second');self.assertEqual(self.w.export('second')['geometry_models'],[])
 def test_http(self):
  server=ThreadingHTTPServer(('127.0.0.1',0),handler_class(str(self.db)));t=threading.Thread(target=server.serve_forever,daemon=True);t.start();base=f'http://127.0.0.1:{server.server_port}'
  try:
   self.assertIn(b'Chart Reader',urlopen(base).read());self.assertEqual(len(json.load(urlopen(base+'/api/documents'))),1)
   req=Request(base+'/api/nomogram',data=json.dumps({**nomogram(),'inputs':[2,8]}).encode(),headers={'Content-Type':'application/json'});self.assertEqual(json.load(urlopen(req))['value'],5)
   req=Request(base+'/api/nomogram',data=b'{}',headers={'Origin':'https://untrusted.invalid'})
   with self.assertRaises(HTTPError) as e:urlopen(req)
   self.assertEqual(e.exception.code,403)
  finally:server.shutdown();server.server_close();t.join()
 def test_http_guided_table_uses_render_coordinates(self):
  server=ThreadingHTTPServer(('127.0.0.1',0),handler_class(str(self.db)));t=threading.Thread(target=server.serve_forever,daemon=True);t.start();base=f'http://127.0.0.1:{server.server_port}'
  extracted={'pdf_page':1,'width':612,'height':792,'coordinate_space':'pdf_point','method':'tesseract_pdf_render','spans':[{'text':'A','bbox':[10,10,20,20]},{'text':'42','bbox':[40,10,50,20]},{'text':'B','bbox':[10,40,20,50]}]}
  try:
   with patch('engine.technical_reader_v2.server.extract_pdf',return_value=[extracted]):
    payload={'document_id':'test','page':1,'row_edges':[0,90,180],'col_edges':[0,90,180]}
    req=Request(base+'/api/table-extract',data=json.dumps(payload).encode(),headers={'Content-Type':'application/json'})
    result=json.load(urlopen(req))
   self.assertEqual(result['rows'],[['A','42'],['B','']]);self.assertEqual(result['status'],'candidate')
  finally:server.shutdown();server.server_close();t.join()
if __name__=='__main__':unittest.main()
