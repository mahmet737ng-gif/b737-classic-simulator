'use strict';
// Sepehran B737 Classic FCOM 4.10.19/4.20.2:
// Flight Director ON controls the related ADI bars, NOT the A/P engage
// authorization. Retain all AP protections (wheel force, trim, bar).
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../engine/afds/mcp-mode-core-v1.js');
function ready(){
 const s=Core.initialState();
 s.electrical.mcpPower=true;
 s.flight={controlWheelForceApplied:false,stabTrimAutopilotNormal:true,
   apDisengageBarUp:true};
 return s;
}
test('Both F/D OFF allows verified A/P CMD or CWS engagement without drawing FD bars',()=>{
 for(const id of ['CMD_A','CWS_B']){
  const s=Core.transition(ready(),{type:'BUTTON',id});
  assert.equal(s.modes.autopilot,id);
  assert.equal(s.fd.left,false);assert.equal(s.fd.right,false);
  assert.equal(Core.output(s).controls.fd.left,false);
  assert.equal(Core.output(s).controls.fd.right,false);
 }
});
test('Physical F/D OFF after A/P engagement does not disengage the A/P',()=>{
 let s=Core.transition(ready(),{type:'FD',side:'left',on:true});
 s=Core.transition(s,{type:'BUTTON',id:'CMD_A'});
 s=Core.transition(s,{type:'BUTTON',id:'HDG_SEL'});
 s=Core.transition(s,{type:'FD',side:'left',on:false});
 assert.equal(s.modes.autopilot,'CMD_A');
 assert.equal(s.modes.lateral,'HDG_SEL');
 assert.equal(s.fd.left,false);
 // FCOM 4.10.19: switching F/D ON with AP engaged picks up the AP modes.
 s=Core.transition(s,{type:'FD',side:'right',on:true});
 assert.equal(s.modes.autopilot,'CMD_A');
 assert.equal(s.fd.right,true);
});
test('Engagement remains inhibited by genuine FCOM protective conditions',()=>{
 for(const [key,reason] of [
  ['controlWheelForceApplied','AP_ENGAGEMENT_INHIBITED_WHEEL_FORCE'],
  ['stabTrimAutopilotNormal','AP_ENGAGEMENT_INHIBITED_STAB_TRIM_CUTOUT'],
  ['apDisengageBarUp','AP_ENGAGEMENT_INHIBITED_DISENGAGE_BAR']
 ]){
  const s=ready();s.flight[key]=(key==='controlWheelForceApplied');
  const rejected=Core.transition(s,{type:'BUTTON',id:'CMD_A'});
  assert.equal(rejected.modes.autopilot,null);
  assert.equal(rejected.lastRejection,reason);
 }
});
