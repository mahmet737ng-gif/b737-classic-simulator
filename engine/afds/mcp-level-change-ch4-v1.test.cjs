'use strict';
const assert=require('node:assert/strict');
const Core=require('./mcp-mode-core-v1.js');
const Fma=require('./fma-mode-engine-v1.js');
function ready(alt){
 const s=Core.initialState();s.electrical.mcpPower=true;
 s.fd.left=true;s.autoThrottleArm=true;s.values.altitude=alt;
 return s;
}
const fly=(s,alt,flags={})=>Core.transition(s,{type:'FLIGHT_OBSERVATION',
 sample:{schema:'B737_AFDS_FLIGHT_OBSERVATION_V1',confirmed:true,
 source:'SIMULATED_FCC',altitudeFt:alt,radioAltitudeFt:3500,
 establishedEnroute:true,thrustIdleConfirmed:false,...flags}});
let s=ready(29000);s=fly(s,25000);
s=Core.transition(s,{type:'BUTTON',id:'LVL_CHG'});
assert.equal(s.modes.vertical,'LVL_CHG');assert.equal(s.lvlChgPhase,'CLIMB');
assert.equal(s.modes.thrust,'N1');
assert.equal(Fma.fromMcp(Core.output(s),'CAPT').pitch.active,'MCP SPD');
assert.equal(Fma.fromMcp(Core.output(s),'CAPT').at.active,'N1');
s=fly(s,33000);
assert.equal(s.lvlChgPhase,'DESCENT');
assert.equal(s.modes.thrust,'RETARD');
assert.equal(Fma.fromMcp(Core.output(s),'CAPT').at.active,'RETARD');
s=fly(s,32500,{thrustIdleConfirmed:true});
assert.equal(s.modes.thrust,'ARM');
assert.equal(Fma.fromMcp(Core.output(s),'CAPT').at.active,'ARM');
s=Core.transition(s,{type:'VALUE',id:'altitude',value:39000});
assert.equal(s.lvlChgPhase,'CLIMB');
assert.equal(s.modes.thrust,'N1');
let early=ready(20000);
early=fly(early,17000,{establishedEnroute:false,secondsSinceLiftoff:90});
early=Core.transition(early,{type:'BUTTON',id:'LVL_CHG'});
assert.equal(early.modes.thrust,null,'No automatic climb N1 reduction before 150 s');
early=fly(early,17400,{establishedEnroute:false,secondsSinceLiftoff:151});
assert.equal(early.modes.thrust,'N1');
let unknown=ready(21000);
unknown=Core.transition(unknown,{type:'BUTTON',id:'LVL_CHG'});
assert.equal(unknown.lvlChgPhase,'UNKNOWN');
assert.equal(unknown.modes.thrust,null,'No synthetic climb without altitude evidence');
console.log('PASS Chapter 4 LVL CHG: climb N1, descent RETARD/ARM, selected altitude transition, early climb inhibition, no evidence guard');
