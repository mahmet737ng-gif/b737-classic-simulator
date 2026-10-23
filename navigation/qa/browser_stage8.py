"""Chromium DOM QA; mock browser network with real private Stage4 SQL fixture."""
import os,sys,json
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(root/'navigation'))
from npe_stage8_server import PrivatePlanStore
from npe_stage8 import reference_position
store=PrivatePlanStore(os.environ['NPE_STAGE8_PRIVATE_STAGE4'])
try:
 plans=store.plans();ref=store.reference(plans[0]['id'])
 pos=reference_position(ref,{'lat':35.7,'lon':51.3},0)
finally:store.close()
html=(root/'navigation/npe-stage8/index.html').read_text().replace('<script src="app.js"></script>','')
script=(root/'navigation/npe-stage8/app.js').read_text()
mock='''window.fetch=async function(url,init){
 const path=String(url).split('?')[0];
 if(path==='/api/stage8/status')return {ok:true,json:async()=>( ''' + json.dumps({'stage':'8','version':'mock','airac':'2610','source':'PRIVATE','fmc_executable':False,'guidance':'OFF','plans':len(plans)}) + ''')};
 if(path==='/api/stage8/plans')return {ok:true,json:async()=>( ''' + json.dumps({'plans':plans}) + ''')};
 if(path==='/api/stage8/reference')return {ok:true,json:async()=>( ''' + json.dumps(ref) + ''')};
 if(path==='/api/stage8/position')return {ok:true,json:async()=>( ''' + json.dumps(pos) + ''')};
 return {ok:false,json:async()=>({error:'MOCK_UNSUPPORTED'})};
};'''
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox','--disable-dev-shm-usage'])
 page=browser.new_page(viewport={'width':1320,'height':900},device_scale_factor=1)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.set_content(html,wait_until='load')
 page.add_script_tag(content=mock)
 page.add_script_tag(content=script)
 
 try:page.wait_for_function("document.querySelector('#mapNote').textContent.includes('10 source reference chords')",timeout=3000)
 except Exception:
  print('ERRORS',errors,'STATUS',page.locator('#status').inner_text(),'MAPNOTE',page.locator('#mapNote').inner_text(),'LEGCOUNT',page.locator('#chords button').count());raise
 assert page.locator('#chords button').count()==10
 assert page.locator('#plot line').count()==10
 page.locator('#evaluate').click()
 page.wait_for_function("document.querySelector('#diagnostic').textContent.includes('XTK')",timeout=10000)
 assert 'NO AUTO SEQUENCING' in page.locator('#diagnostic').inner_text()
 assert not errors,errors
 path=root/'stage8-browser-dom-qa.png';page.screenshot(path=str(path),full_page=True)
 print(json.dumps({'qa':'CHROMIUM_DOM_PASS_REAL_SQL_RESPONSE_NETWORK_MOCKED',
                   'chords':10,'discontinuities':4,'position':True,'screenshot':str(path)}))
 browser.close()