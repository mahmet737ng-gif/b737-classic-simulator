'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ui=require('../engine/ch11-route-pages-v1.js');
const engine=require('../engine/cdu-engine.js');
const session=require('../../panel-mosaic-lab/cockpit/cdu-session.js');
const adapter=require('../stage6-selector.js');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/page-definitions.js'),'utf8'),scope);
const pages=scope.window.CDU_PAGES;
const state=(page='RTE')=>Object.assign(engine.makeState(page),{chapter11RoutePages:true});
const press=(s,key)=>engine.press(s,pages,'CDU_CAPT_'+key);
const type=(s,code,key)=>{s.scratch=code;press(s,key);};

test('FCOM RTE page 1 fields, two VIA/TO rows and activation at R6',()=>{
 const s=state();
 assert.equal(ui.view(s).title,'RTE');
 assert.equal(ui.view(s).count,1);
 assert.equal(ui.view(s).rows[0].valueL,'□□□□');
 assert.equal(ui.view(s).rows[5].valueR,'');
 type(s,'OIII','LSK_L1');type(s,'OIMM','LSK_R1');
 assert.equal(ui.view(s).rows[5].valueR,'');
 type(s,'FIX01','LSK_R4');
 assert.equal(ui.view(s).rows[3].valueL,'DIRECT');
 assert.equal(ui.view(s).rows[3].valueR,'FIX01');
 type(s,'FIX02','LSK_R5');
 assert.equal(ui.view(s).rows[4].valueR,'FIX02');
 assert.equal(ui.view(s).rows[5].valueR,'ACTIVATE>');
 press(s,'NEXT_PAGE');
 assert.equal(ui.view(s).number,2);
 assert.equal(ui.routeCell(s,'LSK_R1').field,'TO3');
 press(s,'PREV_PAGE');
 assert.equal(ui.view(s).number,1);
 press(s,'LSK_R6');
 assert.equal(s.routeActivationArmed,true);
 assert.equal(ui.view(s).title,'MOD RTE');
 assert.equal(engine.lights(s).EXEC,true);
 press(s,'EXEC');
 assert.equal(ui.view(s).title,'ACT RTE');
 s.fmcOnGroundVerified=true;
 assert.equal(ui.view(s).rows[5].valueR,'PERF INIT>');
 press(s,'LSK_R6');
 assert.equal(s.page,'PERF_INIT');
});

test('shared route activation, EXEC and ERASE preserve independent CDU pages and scratchpads',()=>{
 const shared=session.create(),fo=state(),capt=state('LEGS');
 function register(seat,s){
  return shared.attach(seat,{read:()=>s,write:data=>session.apply(s,data),refresh(){}});
 }
 const foSession=register('FO',fo),captSession=register('CAPT',capt);
 type(fo,'OIII','LSK_L1');type(fo,'OIMM','LSK_R1');type(fo,'FIX01','LSK_R4');
 fo.navFixEvidence={ORIGIN:{ident:'OIII',lat:35,lon:51},DEST:{ident:'OIMM',lat:36,lon:59},
  TO1:{ident:'FIX01',lat:36,lon:55}};
 fo.scratch='A';foSession.publish();
 assert.equal(capt.scratch,'');
 assert.equal(capt.page,'LEGS');
 assert.equal(ui.view(capt).rows[0].valueL,'FIX01');
 assert.equal(ui.activeReferenceRoute(capt),null);
 press(capt,'LSK_R6');captSession.publish();
 assert.equal(ui.view(fo).title,'MOD RTE');
 press(capt,'EXEC');captSession.publish();
 assert.equal(ui.view(fo).title,'ACT RTE');
 assert.equal(fo.routeRevision,1);
 assert.deepEqual(ui.activeReferenceRoute(fo).points.map(x=>x.name),['OIII','FIX01','OIMM']);
 type(fo,'FIX02','LSK_R4');foSession.publish();
 assert.equal(ui.view(capt).title,'MOD RTE LEGS');
 assert.deepEqual(ui.activeReferenceRoute(capt).points.map(x=>x.name),['OIII','FIX01','OIMM']);
 press(capt,'LSK_L6');captSession.publish();
 assert.equal(ui.view(fo).title,'ACT RTE');
 assert.equal(ui.view(fo).rows[3].valueR,'FIX01');
 assert.equal(fo.routeRevision,1);
});

test('Progress pages consume known data and leave unavailable quantities blank',()=>{
 const s=state('PROG');
 s.active.FLIGHT='123';
 s.fmcPageInputs={fuel:{quality:'VALID',totalKg:15200},motion:{windFromDeg:80,windKt:23},
  airData:{tasKt:426},predictions:{quality:'VALID',destination:{distanceNm:127,fuelKg:null}}};
 assert.equal(ui.view(s).title,'FLT 123 PROGRESS');
 assert.equal(ui.view(s).rows[4].valueR,'15.2');
 assert.equal(ui.view(s).rows[5].valueL,'080°/23KT');
 assert.equal(ui.view(s).rows[3].valueR,'127');
 press(s,'NEXT_PAGE');
 assert.equal(ui.view(s).title,'RTA PROGRESS');
 press(s,'NEXT_PAGE');
 assert.equal(ui.view(s).rows[3].valueR,'426KT');
 assert.equal(ui.view(s).number,3);
});

test('DEP/ARR uses separately ordered source columns and L6/R6 prompts',async()=>{
 const s=state('DEP_ARR');
 s.stagedRoute={ORIGIN:'OIII',DEST:'OIMM'};
 const fixtures={
  STAR:[{ident:'STAR2',status:'SOURCE_ONLY_NOT_FMC_EXECUTABLE'},{ident:'STAR1',status:'SOURCE_ONLY_NOT_FMC_EXECUTABLE'}],
  APP:[{ident:'ILS32R',status:'SOURCE_ONLY_NOT_FMC_EXECUTABLE'}]
 };
 const api=adapter({},s,engine,pages,async value=>{
  const url=new URL(value,'http://localhost'),kind=url.searchParams.get('kind');
  const body=kind==='runways'?{airac:'2610',mode:'SOURCE_REFERENCE_ONLY',lookup:{rows:[{runway_ident:'32R'}]}}:
   {airport:'OIMM',kind,airac:'2610',fmc_executable:false,items:fixtures[kind]};
  return {ok:true,json:async()=>body};
 });
 assert.equal(api.beforeKey('CDU_CAPT_LSK_R2'),true);
 await new Promise(resolve=>setImmediate(resolve));
 const view=api.chapter11CatalogView();
 assert.equal(view.title,'OIMM ARRIVALS');
 assert.equal(view.rows[0].valueL,'STAR1');
 assert.equal(view.rows[0].valueR,'ILS32R');
 assert.equal(view.rows[1].valueR,'RW32R');
 assert.equal(view.rows[5].valueL,'<INDEX');
 assert.equal(view.rows[5].valueR,'ROUTE>');
 assert.equal(api.beforeKey('CDU_CAPT_LSK_R6'),true);
 assert.equal(s.page,'RTE');
});
