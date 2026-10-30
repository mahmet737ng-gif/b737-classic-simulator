'use strict';
/* Synthetic loopback responses only; no licensed NAVDATA in public tests. */
const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../engine/cdu-engine.js');
const model=require('../stage5-model.js');
const pages=require('../data/page-definitions.json').pages;
const stage6Factory=require('../stage6-selector.js');

const settle=()=>new Promise(resolve=>setImmediate(resolve));
function setup(overrides={}){
 const state=core.makeState('RTE'),calls=[],refreshes=[];
 const response=(kind,url)=>{
  const params=new URL(url,'http://127.0.0.1').searchParams;
  const ident=params.get('ident'),airport=params.get('airport');
  const make=rows=>({airac:'2610',kind,mode:'SOURCE_REFERENCE_ONLY',fmc_executable:false,
   lookup:{source_cycle:'2610',rows,has_more:false,fmc_executable:false}});
  if(kind==='airport')return make(ident==='OIII'||ident==='OIMM'?[{id:1,icao:ident}]:[]);
  if(kind==='runways')return make(airport==='OIII'?[{runway_ident:'29R'}]:[]);
  if(kind==='airways')return make(ident==='A1'?[{id:1,ident:'A1',fix_ident:'FIX1'}]:[]);
  if(kind==='waypoints')return make(ident==='DUP'?[{id:1,ident:'DUP'},{id:2,ident:'DUP'}]:ident==='FIX1'?[{id:3,ident:'FIX1'}]:[]);
  if(kind==='navaids')return make([]);
  return null;
 };
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  if(overrides.reject)throw Error('NO PRIVATE SOURCE');
  const u=new URL(url,'http://127.0.0.1'),kind=u.searchParams.get('kind');
  let data;
  if(u.pathname==='/api/stage6/catalog'){
   const airport=u.searchParams.get('airport'),proc=u.searchParams.get('kind');
   data={airac:'2610',airport,kind:proc,fmc_executable:false,items:[
    {ident:'SYN1',runways:[],transitions:[],status:'SOURCE_ONLY_NOT_FMC_EXECUTABLE'}
   ]};
  }else data=response(kind,url);
  if(overrides.mutate)data=overrides.mutate(data);
  return {ok:!!data,status:data?200:422,json:async()=>data||{message:'INVALID SOURCE'}};
 };
 const api=stage6Factory(model,state,core,pages,fetcher,()=>refreshes.push(state.page));
 return {api,state,calls,refreshes};
}

test('RTE origin, destination and runway use private source instead of accepting arbitrary ICAO',async()=>{
 const {api,state,calls}=setup();
 state.scratch='OIII';assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);await settle();
 assert.equal(state.stagedRoute.ORIGIN,'OIII');assert.equal(state.scratch,'');
 state.scratch='OIMM';assert.equal(api.beforeKey('CDU_CAPT_LSK_R1'),true);await settle();
 assert.equal(state.stagedRoute.DEST,'OIMM');
 state.scratch='29R';assert.equal(api.beforeKey('CDU_CAPT_LSK_L3'),true);await settle();
 assert.equal(state.stagedRoute.RUNWAY,'29R');
 assert.ok(calls.some(c=>c.url.includes('kind=runways&airport=OIII')));
 assert.equal(state.stage6PendingPlan,undefined);
});
test('missing airport fails closed and preserves scratch',async()=>{
 const {api,state}=setup();state.scratch='XXXX';
 assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);await settle();
 assert.equal(state.stagedRoute.ORIGIN,undefined);
 assert.equal(state.scratch,'XXXX');assert.equal(state.message,'NOT IN NAV DATA');
});
test('lookup outage never commits unverified origin',async()=>{
 const {api,state}=setup({reject:true});state.scratch='OIII';
 assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);await settle();
 assert.equal(state.stagedRoute.ORIGIN,undefined);
 assert.equal(state.message,'NO PRIVATE SOURCE');
});
test('duplicate waypoint is blocked; unique fix and airway accepted as trainer fields',async()=>{
 const {api,state}=setup();state.page='FLIGHT_PLAN';
 state.scratch='DUP';assert.equal(api.beforeKey('CDU_CAPT_LSK_R1'),true);await settle();
 assert.equal(state.pending.TO1,undefined);assert.equal(state.message,'DUPLICATE WAYPOINT');
 state.scratch='FIX1';assert.equal(api.beforeKey('CDU_CAPT_LSK_R1'),true);await settle();
 assert.equal(state.pending.TO1,'FIX1');
 state.scratch='A1';assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);await settle();
 assert.equal(state.pending.VIA1,'A1');
});
test('FCOM DEP/ARR index opens real-source catalog without Stage4 saved plan',async()=>{
 const {api,state,calls}=setup();state.stagedRoute.ORIGIN='OIII';state.active.DEST='OIMM';
 core.choose(state,pages,'DEP_ARR');
 assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);await settle();
 assert.equal(state.page,'DEPARTURES');assert.equal(state.stage6View.mode,'CATALOG');
 assert.equal(state.stage6View.referenceOnly,true);
 assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);await settle();
 assert.deepEqual(state.navdataReferenceProcedures['SID@OIII'],{ident:'SYN1'});
 assert.equal(state.page,'DEP_ARR');assert.equal(state.stage6PendingPlan,undefined);
 assert.equal(state.stage5Committed,undefined);
 assert.ok(calls.some(c=>c.url.startsWith('/api/stage6/catalog?airport=OIII')));
});
test('bad cycle and invalid ICAO do not create source route',async()=>{
 const {api,state}=setup({mutate:d=>d?.mode==='SOURCE_REFERENCE_ONLY'?{...d,airac:'2611'}:d});
 state.scratch='OIII';assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);await settle();
 assert.equal(state.stagedRoute.ORIGIN,undefined);
 assert.equal(state.message,'NAV DATA SOURCE REJECTED');
 state.scratch='O1II';assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),false);
});
