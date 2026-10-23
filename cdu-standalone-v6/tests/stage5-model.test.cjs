const assert=require('node:assert/strict');
const m=require('../stage5-model.js');
const route={engine:'NPE_STAGE4_FLIGHT_PLAN_DRAFT_v1',airac:'2610',source_marker:m.MARKER,
 origin:'ZZAA',destination:'ZZBB',fmc_legs_activated:0,autopilot_guidance_enabled:false,
 status:'DRAFT_WITH_DISCONTINUITIES_NOT_FMC_EXECUTABLE',
 qa:{source_chain:{airac:'2610',stage3_fmc_status:'NOT_EXECUTABLE'},discontinuity_count:1},
 selected_departure:{kind:'SID',ident:'FOO1',fmc_status:'NOT_EXECUTABLE',status:'SELECTED_SOURCE_ONLY',source_member:'SidStars/ZZAA.txt',selected_runway:'10',selected_transition:null},
 selected_arrival:null,selected_approach:null,enroute_sections:[{via:'A1',to:'FIXB',status:'REFERENCE_ONLY'}],
 items:[
 {type:'AIRPORT',label:'ZZAA',fmc_status:'NOT_EXECUTABLE'},
 {type:'PROCEDURE',label:'FOO1',kind:'SID',detail:{fmc_status:'NOT_EXECUTABLE',status:'SELECTED_SOURCE_ONLY',source_member:'SidStars/ZZAA.txt'},fmc_status:'SOURCE_ONLY'},
 {type:'DISCONTINUITY',label:'ROUTE DISCONTINUITY',required_action:'EXPLICIT_VERIFY_AND_RESOLVE',fmc_status:'NOT_EXECUTABLE'},
 {type:'FIX',label:'FIXA',lat:10,lon:20,via:'A1',source_file:'synthetic.dat',source_line:8,fmc_status:'NOT_EXECUTABLE',reference_leg_distance_nm:null},
 {type:'FIX',label:'FIXB',lat:10,lon:21,via:'A1',source_file:'synthetic.dat',source_line:9,fmc_status:'NOT_EXECUTABLE',reference_leg_distance_nm:59.13},
 {type:'AIRPORT',label:'ZZBB',fmc_status:'NOT_EXECUTABLE'}]
};
const clone=x=>JSON.parse(JSON.stringify(x));
assert.equal(m.validate(route).discontinuities,1);
assert.equal(m.rows(route,'LEGS').length,6);
assert.equal(m.rows(route,'RTE').length,1);
assert.equal(m.rows(route,'DEP_ARR')[0].ident,'FOO1');
assert.equal(m.paginate(m.rows(route,'LEGS'),5,2).rows.length,1);
assert.equal(m.safeReferenceLines(route).length,1);
assert.equal(m.safeReferenceLines(route)[0].length,2);
const corrupt=clone(route);corrupt.source_marker='//AIRAC Cycle : 2609';assert.throws(()=>m.validate(corrupt));
const active=clone(route);active.fmc_legs_activated=1;assert.throws(()=>m.validate(active));
const erased=clone(route);erased.items.splice(2,1);assert.throws(()=>m.validate(erased));
const jump=clone(route);jump.items[4].reference_leg_distance_nm=12;assert.equal(m.safeReferenceLines(jump).length,0);
const broken=clone(route);broken.items.splice(4,0,{type:'DISCONTINUITY',label:'ROUTE DISCONTINUITY',required_action:'EXPLICIT_VERIFY_AND_RESOLVE',fmc_status:'NOT_EXECUTABLE'});broken.qa.discontinuity_count=2;assert.equal(m.safeReferenceLines(broken).length,0);
const map=require('../stage5-map.js');const st={stage5Committed:route,active:{ORIGIN:'ZZAA',DEST:'ZZBB'},pending:{},stagedRoute:{},ehsi:{mode:'PLAN'}};
assert.equal(map.accepted(st),true);
assert.equal(map.project(m.safeReferenceLines(route))[0].length,2);
st.ehsi.mode='MAP';assert.equal(map.accepted(st),false);
st.ehsi.mode='PLAN';st.pending={DEST:'ZZCC'};assert.equal(map.accepted(st),false);st.pending={};
const factory=require('../stage5-adapter.js');
let updates=0;
const s={page:'RTE',active:{ORIGIN:'',DEST:''},pending:{},stagedRoute:{},message:''};
const core={pendingCount:st=>Object.keys(st.pending).length,hasStagedRoute:st=>Object.keys(st.stagedRoute).length>0,
 choose(st,_,p){st.page=p;}};
const adapter=factory(m,s,core,{RTE:{},ACTIVATE:{},LEGS:{}},()=>updates++);
assert.equal(adapter.stagePlan(route).status,'MOD_REFERENCE_ONLY');
assert.equal(adapter.snapshot().stage,'MOD_REFERENCE_ONLY');
assert.equal(adapter.beforeKey('CDU_CAPT_EXEC'),true);adapter.afterKey('CDU_CAPT_EXEC','RTE');assert.equal(adapter.snapshot().stage,'MOD_REFERENCE_ONLY');
s.pending={ORIGIN:'ZZAA',DEST:'ZZBB'};s.stagedRoute={};s.page='ACTIVATE';adapter.afterKey('CDU_CAPT_LSK_L5','RTE');
assert.equal(s.stage5AwaitingExec,true);assert.equal(adapter.beforeKey('CDU_CAPT_EXEC'),false);
s.active={ORIGIN:'ZZAA',DEST:'ZZBB'};s.pending={};adapter.afterKey('CDU_CAPT_EXEC','ACTIVATE');
assert.equal(adapter.snapshot().stage,'ACT_REFERENCE_ONLY');assert.equal(adapter.snapshot().routeGuidance,false);assert.equal(updates,1);
s.pending={DEST:'ZZCC'};assert.equal(adapter.snapshot().stage,'NONE');s.pending={};
assert.throws(()=>adapter.stagePlan(route));
console.log('PASS stage5 model, discontinuities, fail-closed MOD/EXEC, EHSI map');