'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../engine/afds/mcp-mode-core-v1.js');
const base=()=>{const s=Core.initialState();
 s.electrical.mcpPower=true;s.electrical.globalPowerPossible=true;
 s.fd.left=true;s.fd.right=true;s.modes.autopilot='CMD_A';
 s.modes.vertical='VS';s.modes.lateral='HDG_SEL';
 s.modes.thrust='SPEED';s.autoThrottleArm=true;return s;};
test('confirmed photo AP disengage bar disconnects CMD but keeps FD switches and modes',()=>{
 const s=base(),o=Core.transition(s,{type:'AP_DISENGAGE_CONFIRMED',
  confirmed:true,source:'COCKPIT_HARDWARE',reason:'AP_DISENGAGE_BAR_DOWN'});
 assert.equal(o.modes.autopilot,null);
 assert.equal(o.fd.left,true);assert.equal(o.fd.right,true);
 assert.equal(o.modes.lateral,'HDG_SEL');assert.equal(o.modes.vertical,'VS');
 assert.equal(o.lastAutopilotDisengagement.reason,'AP_DISENGAGE_BAR_DOWN');
 assert.equal(Core.output(o).lastAutopilotDisengagement.source,'COCKPIT_HARDWARE');
});
test('unconfirmed / wrong-source protection events cannot disengage AP',()=>{
 const s=base();
 for(const payload of [
  {confirmed:false,source:'SIMULATED_FCC',reason:'LEFT_IRS_FAILURE'},
  {confirmed:true,source:'UNVERIFIED',reason:'CONTROL_WHEEL_TRIM'},
  {confirmed:true,source:'SIMULATED_FCC',reason:'INVALID_EVENT'}]){
  const o=Core.transition(s,{type:'AP_DISENGAGE_CONFIRMED',...payload});
  assert.equal(o.modes.autopilot,'CMD_A');assert.equal(o.lastRejection,'UNVERIFIED_AP_DISCONNECT_EVENT');
 }
});
test('confirmed acquire and hold from FCC maintain selected V/S until acquisition',()=>{
 let s=base();
 s=Core.transition(s,{type:'FCC_ALTITUDE_CAPTURE',confirmed:true,
  source:'SIMULATED_FCC',stage:'ACQUIRE'});
 assert.equal(s.capture.pitch,'ALT_ACQ');assert.equal(s.modes.vertical,'VS');
 s=Core.transition(s,{type:'FCC_ALTITUDE_CAPTURE',confirmed:true,
  source:'SIMULATED_FCC',stage:'HOLD'});
 assert.equal(s.capture.pitch,'ALT_HOLD');assert.equal(s.modes.vertical,'ALT_HLD');
 assert.equal(s.modes.thrust,'SPEED');
});
test('source power loss disconnects autopilot without inventing FD',()=>{
 const s=base();const o=Core.transition(s,{type:'AP_DISENGAGE_CONFIRMED',
  confirmed:true,source:'SIMULATED_FCC',reason:'ELECTRICAL_POWER_LOST'});
 assert.equal(o.modes.autopilot,null);assert.equal(o.fd.left,true);
});
