"""Browser DOM exercise using private source-derived fixture and in-page fake backend.
Does NOT claim same-origin localhost visual acceptance. No live aircraft/AFDS.
"""
import sys,json,zipfile
from pathlib import Path
from playwright.sync_api import sync_playwright
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from npe_stage8 import stage4_reference_chords
from test_npe_stage10 import synthetic_stage4_plan, real_private_route_optional
root=Path(__file__).resolve().parents[2]
reference=real_private_route_optional() or stage4_reference_chords(synthetic_stage4_plan())
page_html=(root/'navigation/npe-stage10/index.html').read_text().replace('<script src="app.js"></script>','')
js=(root/'navigation/npe-stage10/app.js').read_text()
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=b.new_page(viewport={'width':1280,'height':820})
    page.set_content(page_html)
    page.evaluate('''([reference]) => {
      window.fakeCalls=[];
      Object.defineProperty(document.querySelector('#cdu'),'contentWindow',{configurable:true,value:{postMessage(){}}});
      let next=0;
      window.fetch=async (url,options) => {
         const body=options&&options.body?JSON.parse(options.body):{};
         window.fakeCalls.push({url,body});
         const v=url.replace('/api/stage10/','');
         let value;
         if(v==='status')value={airac:'2610',private_plan_count:1,real_simulator_bridge_connected:false,afds_connected:false};
         else if(v==='plans')value={plans:[{id:1,origin:'OIII',destination:'OIMM'}]};
         else if(v.startsWith('reference'))value=reference;
         else if(v==='new')value={session:'synthetic-session',status:'AWAITING_EXPLICIT_SIMULATOR_TELEMETRY'};
         else if(v==='telemetry')value={accepted:true,sequence:++next};
         else if(v==='arm')value={status:'SIM_REFERENCE_ARMED'};
         else if(v==='frame')value={version:'STAGE10_LIVE_REFERENCE_NAV_v1',mode:'SIM_REFERENCE_TRACK',source:'AIRAC_2610_PRIVATE',reference_only:true,fmc_executable:false,session_authority:'SIM_REFERENCE_ONLY',leg_index:0,to:'RUS',afds_commands:[],lnav_commands:[],vnav_commands:[],servo_commands:[],aircraft:{lat:35,lon:51,heading_true_deg:91,pressure_alt_ft:12000},signed_cross_track_nm:0,distance_to_fix_nm:5,desired_true_track_deg:91,fd:{mode:'SIM_REF_FD_PREVIEW',flight_director_authority:false,autopilot_engaged:false,bank_preview_deg:1},telemetry_seq:next};
         else if(v==='afds-request')value={accepted:false,status:'BLOCKED_UNVERIFIED_EP_FSI_AFDS_INTERFACE',afds_commands:[]};
         else if(v==='stop')value={mode:'OFF'};
         else throw Error('Unsupported synthetic call '+v);
         return {ok:true,json:async()=>value};
      };
    }''',[reference])
    page.add_script_tag(content=js)
    page.wait_for_timeout(100)
    assert 'NOT CONNECTED' in page.locator('#status').inner_text()
    page.locator('#consent').check()
    page.locator('#create').click()
    page.wait_for_timeout(100)
    assert 'synthetic-session' in page.locator('#output').inner_text()
    page.locator('#arm').click()
    page.wait_for_timeout(150)
    assert 'SIM_REFERENCE_TRACK' in page.locator('#output').inner_text()
    page.locator('#requestAfds').click()
    page.wait_for_timeout(100)
    assert 'BLOCKED_UNVERIFIED_EP_FSI_AFDS_INTERFACE' in page.locator('#output').inner_text()
    assert page.evaluate("window.fakeCalls.some(x=>x.url==='/api/stage10/telemetry')")
    out=root/'stage10-browser-dom-mocked.png'
    page.screenshot(path=str(out),full_page=True)
    print('Stage10 DOM mock PASS: status, session, telemetry, ARM/frame, AFDS denial. Screenshot:',out)
    b.close()