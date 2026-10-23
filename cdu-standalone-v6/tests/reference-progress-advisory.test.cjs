'use strict';
const assert=require('node:assert/strict');
const model=require('../stage5-model.js');
const make=require('../reference-progress-advisory.js');
function item(type,label,extras={}){return {type,label,fmc_status:'NOT_EXECUTABLE',...extras}}
function fixture(){
 const fix=(label,lat,lon,distance)=>item('FIX',label,{lat,lon,source_file:'our-synthetic-fixture',source_line:1,reference_leg_distance_nm:distance});
 const p={engine:'NPE_STAGE4_FLIGHT_PLAN_DRAFT_v1',airac:'2610',source_marker:model.MARKER,
  fmc_legs_activated:0,autopilot_guidance_enabled:false,status:'DRAFT_WITH_DISCONTINUITIES_NOT_FMC_EXECUTABLE',
  origin:'ZZAA',destination:'ZZBB',selected_departure:null,selected_arrival:null,selected_approach:null,
  qa:{discontinuity_count:2,source_chain:{airac:'2610',stage3_fmc_status:'NOT_EXECUTABLE'}},
  items:[item('AIRPORT','ZZAA'),item('DISCONTINUITY','ROUTE DISCONTINUITY',{required_action:'EXPLICIT_VERIFY_AND_RESOLVE'}),
    fix('ALFAA',0,0,null),fix('BETAA',0,1,60.04),fix('GAMMA',1,1,60.04),
    item('DISCONTINUITY','ROUTE DISCONTINUITY',{required_action:'EXPLICIT_VERIFY_AND_RESOLVE'}),item('AIRPORT','ZZBB')]};
 return p;
}
function sampleAndReference(){
 const r={version:'NPE_STAGE8_REFERENCE_MONITOR_v1',airac:'2610',plan_id:3,origin:'ZZAA',destination:'ZZBB',
  no_automatic_sequencing:true,discontinuities:2,fmc_executable:false,
  manual_selectable_reference_chords:[
    {to_item_index:3,from:'ALFAA',to:'BETAA',start:{lat:0,lon:0},end:{lat:0,lon:1},length_nm:60.04,true_initial_course_deg:90},
    {to_item_index:4,from:'BETAA',to:'GAMMA',start:{lat:0,lon:1},end:{lat:1,lon:1},length_nm:60.04,true_initial_course_deg:0}]};
 const s={version:'NPE_STAGE8_REFERENCE_MONITOR_v1',airac:'2610',plan_id:3,plan_origin:'ZZAA',plan_destination:'ZZBB',
  fmc_executable:false,status:'REFERENCE_ADVISORY_ONLY_NO_AUTO_SEQUENCING',requires_manual_next_leg_selection:true,
  reference_true_course_deg:90,reference_length_nm:60.04,
  manual_item_index:3,from_fix:'ALFAA',to_fix:'BETAA',cross_track_nm_right_positive:-1,
  along_track_nm:30,direct_distance_to_fix_nm:30,
  autopilot_guidance_enabled:false,lnav_commands:[],vnav_commands:[],afds_commands:[]};
 return [s,r];
}
function boot(){const plan=fixture();model.validate(plan);const st={stage5Committed:plan,stage6BasePlanId:3,
 active:{ORIGIN:'ZZAA',DEST:'ZZBB'},pending:{},stagedRoute:{},page:'RTE'};
 let changed=0;
 const core={pendingCount:()=>Object.keys(st.pending).length,hasStagedRoute:()=>Object.keys(st.stagedRoute).length>0,
 choose:(s,_,p)=>s.page=p};
 const api=make(st,core,model,()=>changed++);
 return {st,api,getChanged:()=>changed};}
const run=(name,fn)=>{try{fn();console.log('PASS',name)}catch(e){console.error('FAIL',name,e);process.exitCode=1}};
run('read-only progress appears on PROG after source commit',()=>{
 const {st,api,getChanged}=boot(),[sample,ref]=sampleAndReference();
 assert.equal(api.show(sample,ref).guidance,false);assert.equal(st.page,'PROG');
 assert.equal(api.snapshot().fmc_active,false);assert.equal(getChanged(),1);
});
run('wrong saved private plan ID fails',()=>{
 const {api}=boot(),[s,r]=sampleAndReference();r.plan_id=99;assert.throws(()=>api.show(s,r));
});
run('no crossing a missing discontinuity',()=>{
 const {api}=boot(),[s,r]=sampleAndReference();r.manual_selectable_reference_chords.push({to_item_index:6,from:'GAMMA',to:'ZZBB'});assert.throws(()=>api.show(s,r));
});
run('source coordinates drift fails closed',()=>{
 const {api}=boot(),[s,r]=sampleAndReference();r.manual_selectable_reference_chords[0].end.lon+=0.1;assert.throws(()=>api.show(s,r));
});
run('uncommitted CDU edit suppresses stale readout',()=>{
 const {api,st}=boot(),[s,r]=sampleAndReference();api.show(s,r);st.pending.DEST='ZZCC';assert.equal(api.snapshot().visible,false);assert.throws(()=>api.show(s,r));
});
run('unverified procedure modification blocks diagnostics',()=>{
 const {api,st}=boot(),[s,r]=sampleAndReference();st.stage6PendingPlan=fixture();assert.throws(()=>api.show(s,r));
});
run('no navigation commands permitted in sample',()=>{
 const {api}=boot(),[s,r]=sampleAndReference();s.lnav_commands=['turn to course'];assert.throws(()=>api.show(s,r));
});
run('unconnected segment index is invalid',()=>{
 const {api}=boot(),[s,r]=sampleAndReference();s.manual_item_index=6;assert.throws(()=>api.show(s,r));
});