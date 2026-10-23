'use strict';
const assert=require('node:assert/strict');
const {initialAircraftState:init,transitionAircraftState:step,replayAircraftActions:replay}=require('../engine/network/integrated-aircraft-kernel.cjs');
const {getAFMTargetN1,validateTrack,sampleAt,integratedFuelKg,AFM_GATE}=require('../engine/network/engine-performance-dynamics.cjs');
const cmd=(type,data={})=>({type,...data});
const run=(s,type,data={})=>step(s,cmd(type,data));
const aircraft={registration:'EP-FSI',msn:29340,engine:'CFM56-3B-1',ratingLbf:20000};
const make=(sourceType='OBSERVED_TELEMETRY')=>({
 aircraft,sourceType,sourceId:'EPFSI_RECORDER_TEST_001',
 samples:[
  {timeSec:0,n1Pct:5,n2Pct:20,egtC:100,fuelFlowKgHr:0},
  {timeSec:10,n1Pct:25,n2Pct:40,egtC:400,fuelFlowKgHr:3600},
  {timeSec:20,n1Pct:55,n2Pct:60,egtC:600,fuelFlowKgHr:7200}
 ]
});
assert.equal(AFM_GATE.approvedFinalN1Points,0);
assert.equal(AFM_GATE.numericN1Enabled,false);
assert.throws(()=>getAFMTargetN1({...aircraft,qaSigned:true}),e=>e.code==='AFM_N1_QA_BLOCKED');
assert.throws(()=>getAFMTargetN1({...aircraft,ratingLbf:22000}),/effectivity/);
assert.throws(()=>validateTrack({...make(),aircraft:{...aircraft,msn:29339}}),/mismatch/);
assert.throws(()=>validateTrack({...make(),sourceType:'AFM_APPROVED'}),/source/);
assert.throws(()=>validateTrack({...make('SYNTHETIC_TEST_FIXTURE')}),/opt-in/);
assert.throws(()=>validateTrack({...make(),samples:[make().samples[0],make().samples[0]]}),/increase/);
assert.throws(()=>validateTrack({...make(),samples:[make().samples[0],{...make().samples[1],egtC:NaN}]}),/invalid/);
const trace=validateTrack(make());
const mid=sampleAt(trace,5);
assert.equal(mid.kind,'INTERPOLATED_BETWEEN_SUPPLIED_SAMPLES');
assert.equal(mid.sample.n1Pct,15);
assert.equal(mid.sample.n2Pct,30);
assert.equal(mid.sample.egtC,250);
assert.equal(mid.sample.fuelFlowKgHr,1800);
assert.equal(sampleAt(trace,25),null);
assert.equal(integratedFuelKg(trace,0,5),1.25);
assert.equal(integratedFuelKg(trace,0,10),5);
assert.equal(integratedFuelKg(trace,10,20),15);
const original=init();
let r=run(original,'ENTER_COLD_DARK'),s=r.state;
assert.equal(r.view.performance.afmN1.value,null);
assert.equal(r.view.performance.engines['1'].commandedLeverEffect,'NO_VERIFIED_THRUST_TO_N1_MAP');
r=run(s,'SET_ENGINE_THRUST_COMMAND',{engine:1,value:63});s=r.state;
assert.equal(r.view.performance.engines['1'].commandedLeverPct,63);
assert.equal(r.view.indications.engines['1'].primary.n1Pct.display,'NO_DATA');
assert.throws(()=>run(s,'SET_ENGINE_THRUST_COMMAND',{engine:1,value:120}),TypeError);
r=run(s,'LOAD_ENGINE_OBSERVED_TRACK',{engine:1,track:make()});s=r.state;
assert.equal(r.view.performance.engines['1'].mode,'REPLAY_ACTIVE');
assert.equal(r.view.performance.engines['1'].traceQuality,'USER_SUPPLIED_UNVERIFIED_TELEMETRY');
assert.equal(r.view.indications.engines['1'].primary.n1Pct.value,5);
assert.equal(r.view.indications.engines['1'].primary.n2Pct.value,20);
assert.equal(r.view.indications.engines['1'].primary.egtC.value,100);
assert.throws(()=>run(s,'SET_ENGINE_N2',{engine:1,value:65}),/owned/);
assert.throws(()=>run(s,'SET_ENGINE_EGT_C',{engine:1,value:500}),/owned/);
assert.throws(()=>run(s,'SET_ENGINE_INDICATION',{engine:1,instrument:'n1Pct',value:30}),/owned/);
assert.throws(()=>run(s,'SET_ENGINE_INDICATION',{engine:1,instrument:'fuelFlowKgHr',value:3600}),/owned/);
// Engine 2 remains independently writable.
r=run(s,'SET_ENGINE_INDICATION',{engine:2,instrument:'n1Pct',value:7});s=r.state;
assert.equal(r.view.indications.engines['2'].primary.n1Pct.value,7);
r=run(s,'RESET_FUEL_USED',{engine:1});s=r.state;
r=run(s,'ADVANCE_SECONDS',{value:1});s=r.state;
assert.equal(r.view.indications.engines['1'].fuelUsedKg,0);
r=run(s,'ADVANCE_SECONDS',{value:4});s=r.state;
assert.equal(r.view.indications.engines['1'].primary.n1Pct.value,15);
assert.equal(r.view.indications.engines['1'].primary.n2Pct.value,30);
assert.equal(r.view.indications.engines['1'].primary.egtC.value,250);
assert.equal(r.view.performance.engines['1'].coverage,'INTERPOLATED_BETWEEN_SUPPLIED_SAMPLES');
assert.equal(r.view.indications.engines['1'].fuelUsedKg,1.2); // first second was reset-preview
r=run(s,'ADVANCE_SECONDS',{value:5});s=r.state;
assert.equal(r.view.indications.engines['1'].primary.n1Pct.value,25);
assert.equal(r.view.indications.engines['1'].fuelUsedKg,4.95);
assert.equal(r.view.indications.engines['1'].primary.ffDigital.value,3.6);
r=run(s,'ADVANCE_SECONDS',{value:10});s=r.state;
assert.equal(r.view.indications.engines['1'].primary.n1Pct.value,55);
assert.equal(r.view.indications.engines['1'].fuelUsedKg,19.95);
assert.equal(r.view.performance.engines['1'].elapsedSec,20);
r=run(s,'ADVANCE_SECONDS',{value:1});s=r.state;
assert.equal(r.view.performance.engines['1'].mode,'REPLAY_ENDED');
assert.equal(r.view.performance.engines['1'].coverage,'NO_EXTRAPOLATION_AT_END');
assert.equal(r.view.performance.engines['1'].elapsedSec,20);
assert.equal(r.view.indications.engines['1'].fuelUsedKg,null);
assert.throws(()=>run(s,'SET_ENGINE_N2',{engine:1,value:70}),/owned/);
r=run(s,'STOP_ENGINE_OBSERVED_TRACK',{engine:1});s=r.state;
assert.equal(r.view.performance.engines['1'].mode,'STOPPED');
r=run(s,'SET_ENGINE_N2',{engine:1,value:70});s=r.state;
assert.equal(r.view.indications.engines['1'].primary.n2Pct.value,70);
assert.throws(()=>run(s,'LOAD_ENGINE_OBSERVED_TRACK',{engine:1,track:{...make(),sourceType:'AFM_APPROVED'}}),TypeError);
// No user-provided QA flags or metadata turn observations into certified engine models.
const repeat=[cmd('ENTER_COLD_DARK'),cmd('LOAD_ENGINE_OBSERVED_TRACK',{engine:2,track:make()}),
 cmd('ADVANCE_SECONDS',{value:5}),cmd('ADVANCE_SECONDS',{value:5})];
assert.deepEqual(replay(original,repeat),replay(original,repeat));
assert.equal(original.propulsion.mode,'LEGACY_FIXTURE');
console.log('ISN-10 AFM fail-closed, observed four-channel replay, trapezoidal fuel integral and source authority PASS');
