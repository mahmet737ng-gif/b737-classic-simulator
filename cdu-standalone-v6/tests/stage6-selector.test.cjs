'use strict';
const assert=require('node:assert/strict');
const model=require('../stage5-model.js');
const make=require('../stage6-selector.js');
const MARKER='//AIRAC Cycle : 2610 (01/OCT/2026 - 29/OCT/2026) - Ver.1';
function sample(){
 return {engine:'NPE_STAGE4_FLIGHT_PLAN_DRAFT_v1',airac:'2610',source_marker:MARKER,
  origin:'ZZAA',destination:'ZZBB',origin_airport:{},destination_airport:{},
  selected_departure:null,selected_arrival:null,selected_approach:null,enroute_sections:[],
  items:[{type:'AIRPORT',label:'ZZAA',fmc_status:'NOT_EXECUTABLE'},
   {type:'DISCONTINUITY',label:'ROUTE DISCONTINUITY',fmc_status:'NOT_EXECUTABLE',required_action:'EXPLICIT_VERIFY_AND_RESOLVE'},
   {type:'AIRPORT',label:'ZZBB',fmc_status:'NOT_EXECUTABLE'}],
  qa:{discontinuity_count:1,source_chain:{airac:'2610',stage3_fmc_status:'NOT_EXECUTABLE'}},
  fmc_legs_activated:0,autopilot_guidance_enabled:false,status:'DRAFT_WITH_DISCONTINUITIES_NOT_FMC_EXECUTABLE'};
}
function setup(){
 const state={page:'DEP_ARR',pending:{},stagedRoute:{},active:{ORIGIN:'ZZAA',DEST:'ZZBB'},
  stage5Committed:sample(),message:'',scratch:'',stage5Page:1,ehsi:{mode:'PLAN'}};
 const core={choose(s,_pages,p){s.page=p;s.message=''},hasStagedRoute:s=>Object.keys(s.stagedRoute).length>0,pendingCount:s=>Object.keys(s.pending).length};
 const catalogue={airac:'2610',airport:'ZZAA',kind:'SID',fmc_executable:false,items:[{ident:'DAXI1A',runways:['29R'],transitions:[],status:'SOURCE_ONLY_NOT_FMC_EXECUTABLE'}]};
 const calls=[];
 async function fetcher(u,opts){calls.push([u,opts]);const body=u.includes('/catalog')?catalogue:sample();return {ok:true,json:async()=>body};}
 const api=make(model,state,core,{DEP_ARR:{},DEPARTURES:{},ARRIVALS:{},RTE:{},ACTIVATE:{},LEGS:{}},fetcher,()=>{});
 return {api,state,calls,catalogue};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 {const {api,state}=setup();assert.throws(()=>api.setBasePlanId(0));api.setBasePlanId(1);assert.equal(api.snapshot().ready,true);
 assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);await tick();await tick();
 assert.equal(state.page,'DEPARTURES');assert.equal(state.stage6View.mode,'CATALOG');
 assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);assert.equal(state.stage6View.mode,'RUNWAY');
 assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),true);await tick();await tick();
 assert.equal(state.stage6Selections.SID.runway,'29R');assert.equal(state.stage6PendingPlan.fmc_legs_activated,0);
 state.page='RTE';assert.equal(api.beforeKey('CDU_CAPT_LSK_L5'),true);assert.equal(state.page,'ACTIVATE');
 assert.equal(api.snapshot().mode,'WAIT_EXEC');assert.equal(api.beforeKey('CDU_CAPT_EXEC'),true);
 assert.equal(state.stage6PendingPlan,undefined);assert.equal(state.stage5Committed.autopilot_guidance_enabled,false);
 assert.equal(api.snapshot().activeGuidance,false);
 }
 {const {api,state,catalogue}=setup();api.setBasePlanId(1);catalogue.items[0].ident='ALMU1N.13L';api.beforeKey('LSK_L1');await tick();await tick();assert.equal(state.stage6View.mode,'CATALOG');}
 {const {api,state}=setup();api.setBasePlanId(1);assert.equal(api.beforeKey('EXEC'),false);state.stage6PendingPlan=sample();assert.equal(api.beforeKey('EXEC'),true);assert.match(state.message,/ACTIVATE/);}
 {const {api,state}=setup();api.setBasePlanId(1);state.pending={CO_ROUTE:'BAD'};api.beforeKey('LSK_L1');await tick();await tick();assert.equal(state.stage6View.mode,'ERROR');}
 {const {api,state}=setup();api.setBasePlanId(1);state.stage6PendingPlan=sample();state.page='RTE';api.beforeKey('LSK_L5');assert.equal(state.page,'ACTIVATE');api.beforeKey('LSK_L5');assert.equal(state.stage6PendingPlan,undefined);}
 // Standalone CDU mode: private Stage5/Stage4 is optional, not an external simulator requirement.
 {const {api,state,calls}=setup();delete state.stage5Committed;
  assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),false);
  assert.equal(api.beforeKey('CDU_CAPT_LSK_R1'),false);
  assert.equal(api.beforeKey('CDU_CAPT_LSK_R2'),false);
  assert.equal(state.message,'');assert.equal(calls.length,0);}
 {const {api,state,calls}=setup();
  // Even a source preview without an explicit saved Stage4 plan must not hijack DEP/ARR.
  assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),false);
  assert.equal(state.message,'');assert.equal(calls.length,0);}
 {const {api,state,calls}=setup();api.setBasePlanId(1);state.active.DEST='ZZCC';
  assert.equal(api.beforeKey('CDU_CAPT_LSK_L1'),false);
  assert.equal(state.message,'');assert.equal(calls.length,0);}
 console.log('Stage6 selector: 8 tests PASS');
})().catch(e=>{console.error(e);process.exitCode=1});