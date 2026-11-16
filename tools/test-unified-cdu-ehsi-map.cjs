'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
const root=path.resolve(__dirname,'..');
const cockpit='panel-mosaic-lab/cockpit/';

(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined});
 try{
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.setContent('<base href="https://example.test/cockpit/">'+
   '<style>.unified-ehsi-glass{width:350px!important;height:411px!important}svg{width:100%;height:100%}</style>'+
   '<div id="region-main"><div class="region-native"><div data-piece="captain"></div>'+
   '<div data-piece="fo-outer"></div></div></div>');
  await page.evaluate(()=>{
   const iru={powered:true,positionValid:true,lat:35,lon:51,phase:'NAV_READY',
    trackDeg:290,headingDeg:290,magneticVariationDeg:6,gsKt:0};
   window.browserFixture={
    'irs.left':{quality:'VALID',value:{...iru}},
    'irs.right':{quality:'VALID',value:{...iru}},
    'electrical.buses':{quality:'VALID',value:{bus:{electronic1:true,electronic2:true}}},
    'fmc.computed':{quality:'VALID',value:{operational:true,position:{quality:'UNKNOWN'}}}
   };
   window.B737UnifiedAvionicsNetworkV1={getSnapshot:()=>window.browserFixture};
  });
  for(const script of [
   'efis-display-lab/reference-geometry.js','efis-display-lab/glyphs.js',
   'efis-display-lab/core.js','efis-display-lab/ehsi-v2.js',
   cockpit+'unified-efis-sources-v1.js',cockpit+'cdu-sg-route-state-v1.js',
   cockpit+'cdu-sg-ehsi-preview-v1.js',cockpit+'ehsi-unified-v1.js'
  ])await page.addScriptTag({path:path.join(root,script)});
  await page.evaluate(()=>{
   const state=window.B737CduSgRouteV1;
   state.setConnected(true);
   state.setContext({origin:'OIII',destination:'OIMM'});
   const runway='29L',kind='SID',airport='OIII',ident='TEST2C';
   const points=[[50.91,35.015],[50.79,35.03]];
   state.select({airport,kind,ident,runway,
    procedure:{airport,kind,ident,fmc_executable:false,runway_options:[runway],transition_options:[]},
    geometry:{type:'FeatureCollection',metadata:{airport,kind,ident,selected_runway:runway,
     airac:'UNSPECIFIED_IN_UPLOADED_FILES',fmc_executable:false},
     features:[
      {geometry:{type:'LineString',coordinates:points},
       properties:{fmc_executable:false,render_style:'reference'}},
      ...points.map((coordinates,i)=>({geometry:{type:'Point',coordinates},
       properties:{fmc_executable:false,ident:['TRNX','DHNX'][i]}}))
     ]}
   });
  });
  for(const seat of ['CAPT','FO']){
   const svg=page.locator('#unifiedEhsi'+seat);
   const trace=svg.locator('[data-cdu-sg-reference] path');
   await trace.waitFor({state:'visible'});
   assert.equal(await trace.getAttribute('stroke'),'#ffffff');
   assert.equal(await svg.locator('[data-source-ident]').first().textContent(),'TRNX');
   assert.equal(await svg.locator('[data-cdu-sg-status]').textContent(),'MOD REF');
  }
  await page.evaluate(()=>{
   window.browserFixture['irs.right'].value.lon=59;
   window.B737UnifiedEHSI.refresh();
  });
  const status=page.locator('#unifiedEhsiFO [data-cdu-sg-status]');
  assert.equal(await status.textContent(),'MOD REF OFF MAP');
  await page.evaluate(()=>{
   window.browserFixture['irs.right'].value.positionValid=false;
   window.B737UnifiedEHSI.refresh();
  });
  assert.equal(await status.textContent(),'MOD REF NO POS');
  await page.evaluate(()=>{
   window.dispatchEvent(new CustomEvent('b737:unified-efis-control',{detail:{seat:'FO',state:{mode:'PLAN'}}}));
  });
  await page.locator('#unifiedEhsiFO [data-source-ident]').first().waitFor({state:'visible'});
  assert.equal(await status.textContent(),'MOD REF');
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
