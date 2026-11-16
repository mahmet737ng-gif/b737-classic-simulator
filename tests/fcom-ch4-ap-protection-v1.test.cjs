'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../engine/afds/fcom-ch4-ap-protection-v1.js');
const state=()=>({power:true,modes:{autopilot:'CMD_A'},nav:{loc:false,gs:false}});
const run=(input,mcp=state())=>P.evaluate(P.initial(),mcp,input,10000);
test('all documented A/P disengage reasons have explicit source identifiers',()=>{
 for(const id of ['CONTROL_WHEEL_AP_DISCONNECT','AP_DISENGAGE_BAR_DOWN',
  'AP_ENGAGE_PADDLE_OFF','ILLUMINATED_AP_ENGAGE_SWITCH','TOGA_BELOW_2000_RA',
  'CONTROL_WHEEL_TRIM','STAB_TRIM_AUTOPILOT_CUTOUT',
  'AP_A_HYDRAULIC_PRESSURE_LOST','AP_B_HYDRAULIC_PRESSURE_LOST',
  'LEFT_IRS_FAILURE','RIGHT_IRS_FAILURE','ELECTRICAL_POWER_LOST',
  'CRITICAL_SENSOR_INPUT_LOST','EFI_TRANSFER_REPOSITIONED',
  'RADIO_ALT_FAILURE_AFTER_LOC_GS_2S'])assert.ok(P.REASONS.includes(id));
});
test('physical disengage bar / yoke / trim explicitly disconnect engaged CMD/CWS',()=>{
 for(const reason of ['AP_DISENGAGE_BAR_DOWN','CONTROL_WHEEL_AP_DISCONNECT','CONTROL_WHEEL_TRIM']){
  assert.equal(run({hardware:{source:'COCKPIT_HARDWARE',confirmed:true,reason}}).reason,reason);
 }
 assert.equal(run({hardware:{source:'INSTRUCTOR_UNVERIFIED',confirmed:true,
  reason:'CONTROL_WHEEL_AP_DISCONNECT'}}).disengage,false);
});
test('TOGA disconnect requires observed RA below 2000; no inferred loss above',()=>{
 const hardware={source:'COCKPIT_HARDWARE',confirmed:true,reason:'TOGA_BELOW_2000_RA'};
 assert.equal(run({hardware,radioAltitudeFt:1999}).disengage,true);
 assert.equal(run({hardware,radioAltitudeFt:2000}).disengage,false);
 assert.equal(run({hardware}).disengage,false);
});
test('hydraulic loss is side-specific and requires confirmed unavailable',()=>{
 const obs={hydraulicsVerified:true,hydraulicAAvailable:false,hydraulicBAvailable:true};
 assert.equal(run(obs).reason,'AP_A_HYDRAULIC_PRESSURE_LOST');
 const b=state();b.modes.autopilot='CMD_B';
 assert.equal(run(obs,b).disengage,false);
 assert.equal(run({...obs,hydraulicsVerified:false}).disengage,false);
});
test('verified either IRS FAULT, critical sensor failure, or power loss disconnect',()=>{
 assert.equal(run({irsVerified:true,leftIrsFault:true}).reason,'LEFT_IRS_FAILURE');
 assert.equal(run({irsVerified:true,rightIrsFault:true}).reason,'RIGHT_IRS_FAILURE');
 assert.equal(run({irsVerified:false,leftIrsFault:true}).disengage,false);
 assert.equal(run({criticalSensorFailureVerified:true,criticalSensorFailed:true}).reason,'CRITICAL_SENSOR_INPUT_LOST');
 const s=state();s.power=false;
 assert.equal(run({},s).reason,'ELECTRICAL_POWER_LOST');
});
test('two-second RA timer runs only after confirmed LOC and GS capture',()=>{
 const s=state();s.nav={loc:true,gs:true};
 const p={raFailureVerified:true,radioAltimeterInoperative:true};
 let v=P.evaluate(P.initial(),s,p,1000);assert.equal(v.disengage,false);
 v=P.evaluate(v.state,s,p,2900);assert.equal(v.disengage,false);
 v=P.evaluate(v.state,s,p,3000);
 assert.equal(v.reason,'RADIO_ALT_FAILURE_AFTER_LOC_GS_2S');
 assert.equal(run(p).disengage,false);
});
test('unknown evidence and no engaged AP do not cause false disengagement',()=>{
 assert.equal(run({hydraulicAAvailable:false,irsVerified:false}).disengage,false);
 const s=state();s.modes.autopilot=null;
 assert.equal(run({irsVerified:true,leftIrsFault:true},s).disengage,false);
});
