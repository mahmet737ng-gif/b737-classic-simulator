'use strict';
/* EADI-FMA-MCP-LIVE-0001: real event-sequence regression with the production
 * MCP flight-mode engine; preserves old EIS/Conventional glass registrations.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const AFDS=require('../../engine/afds/mcp-mode-core-v1.js');
const FMA=require('../../engine/afds/fma-mode-engine-v1.js');
const View=require('./eadi-fma-fcom-v2.js');
const src=fs.readFileSync(__dirname+'/mcp-afds-bridge-v1.js','utf8');
const hardwareSrc=fs.readFileSync(__dirname+'/mcp-hardware-v1.js','utf8');
assert.match(src,/b737:mcp-hardware-change/);
assert.match(src,/b737:mcp-button-request/);
assert.match(src,/b737:mcp-afds-state/);
assert.match(hardwareSrc,/AT_ARM/);
assert.match(hardwareSrc,/FD_LEFT/);
assert.match(hardwareSrc,/FD_RIGHT/);
const source=AFDS.initialState();
let state=source;
const physical={AT_ARM:'OFF',FD_LEFT:'OFF',FD_RIGHT:'OFF'};
const listeners=new Map(),draws=[],painters={};
const on=(event,fn)=>{const stack=listeners.get(event)||[];stack.push(fn);listeners.set(event,stack);};
const emit=(event,detail)=>{for(const fn of listeners.get(event)||[])fn({detail});};
const fakeWin={
 B737FmaModeEngineV1:FMA,
 B737McpHardwareV1:{getState:()=>({...physical})},
 B737McpAFDSBridgeV1:{getOutput:()=>AFDS.output(state)},
 B737UnifiedEADIStage1:{
  registerLayer(seat,slot,fn){assert.equal(slot,'fma');painters[seat]=fn;return()=>{}},
  snapshot:()=>({stations:{CAPT:{pitch:0,bank:0},FO:{pitch:0,bank:0}}}),
  setAttitude(seat,pitch,bank){draws.push({seat,pitch,bank});}
 },
 addEventListener:on,
 setTimeout(fn,delay){assert.ok(delay>0&&delay<=10000);return 1},
 clearTimeout(){},
 console:{warn(){}}
};
function send(action){
 state=AFDS.transition(state,action);
 emit('b737:mcp-afds-state',AFDS.output(state));
 return AFDS.output(state);
}
function seat(s){return View.getState(s).fields}
function visualPower(on){
 if(!on){
  send({type:'ELECTRICAL',snapshot:{schema:'B737_ELECTRICAL_V7_RESULT',revision:10,
   bus:{generator1:false,generator2:false,transfer1:false,transfer2:false,main1:false,main2:false,acStandby:false,groundService:false,dc1:false,dc2:false,battery:false,hotBattery:false,switchedHotBattery:false,dcStandby:false,electronic1:false}}});
 }else{
  send({type:'ELECTRICAL',snapshot:{schema:'B737_ELECTRICAL_V7_RESULT',revision:11,
   bus:{generator1:false,generator2:false,transfer1:false,transfer2:false,main1:false,main2:false,acStandby:false,groundService:false,dc1:true,dc2:false,battery:true,hotBattery:true,switchedHotBattery:true,dcStandby:true,electronic1:true}}});
 }
}
assert.equal(View.bind(fakeWin),true);
assert.ok(painters.CAPT&&painters.FO);
assert.equal(View.inspectLink().ready,true);
assert.equal(View.inspectLink().mcpPowered,null);
// Physical switch alone cannot illuminate EADI when power is unverified.
physical.AT_ARM='ARM';
emit('b737:mcp-hardware-change',{id:'AT_ARM',value:'ARM',method:'click'});
assert.equal(seat('CAPT').at.active,'');
assert.equal(seat('FO').at.active,'');
visualPower(true);
assert.equal(View.inspectLink().mcpPowered,true);
assert.equal(View.inspectLink().mcpPowerEvidence,'SIMULATED_DC1');
assert.equal(seat('CAPT').at.active,'ARM');
assert.equal(seat('FO').at.active,'ARM');
assert.equal(FMA.color('at',seat('CAPT').at.active),'white');
// Bridge consumes the physical toggle and records the armed switch state.
send({type:'AT_ARM',armed:true});
// Left F/D physically ON: CAPT FD only; bridge may lag on a short hardware
// event, but direct hardware reconciliation must show switch position.
physical.FD_LEFT='ON';
emit('b737:mcp-hardware-change',{id:'FD_LEFT',value:'ON',method:'click'});
assert.equal(seat('CAPT').afds.active,'FD');
assert.equal(seat('FO').afds.active,'');
assert.equal(View.inspectLink().physicalSource,'VERIFIED_PHYSICAL_SWITCH_OVERRIDE');
// Real AFDS core now confirms its own copy; no duplicate FMA state change.
send({type:'FD',side:'left',on:true});
assert.equal(seat('CAPT').afds.active,'FD');
assert.equal(View.inspectLink().physicalSource,'PHYSICAL_AFDS_MATCH');
physical.FD_RIGHT='ON';
send({type:'FD',side:'right',on:true});
assert.equal(seat('FO').afds.active,'FD');
// Physical right F/D off again: left remains engaged, F/O FD disappears.
physical.FD_RIGHT='OFF';
emit('b737:mcp-hardware-change',{id:'FD_RIGHT',value:'OFF',method:'click'});
assert.equal(seat('CAPT').afds.active,'FD');
assert.equal(seat('FO').afds.active,'');
send({type:'FD',side:'right',on:false});
// HDG SEL, V/S, ALT HOLD, N1, SPEED are sourced only from AFDS output,
// not from glass/light-test interactions or synthetic click assumptions.
send({type:'BUTTON',id:'HDG_SEL'});
assert.equal(seat('CAPT').roll.active,'HDG SEL');
send({type:'BUTTON',id:'VS'});
assert.equal(seat('CAPT').pitch.active,'V/S');
assert.equal(seat('CAPT').at.active,'MCP SPD');
send({type:'BUTTON',id:'ALT_HLD'});
assert.equal(seat('CAPT').pitch.active,'ALT HOLD');
send({type:'BUTTON',id:'N1'});
assert.equal(state.lastRejection,'AT_N1_INCOMPATIBLE_WITH_PITCH_SPEED_HOLD');
assert.equal(seat('CAPT').at.active,'MCP SPD','FCOM ALT HOLD A/T SPEED blocks conflicting N1');
send({type:'BUTTON',id:'ALT_HLD'}); // exit ALT HOLD
assert.equal(seat('CAPT').at.active,'ARM','automatic pitch-owned SPEED is released');
send({type:'BUTTON',id:'N1'}); // new compatible A/T selection
assert.equal(seat('CAPT').at.active,'N1');
send({type:'BUTTON',id:'CMD_A'});
assert.equal(seat('CAPT').pitch.active,'');
assert.equal(seat('CAPT').afds.active,'CWS P');
assert.equal(seat('FO').afds.active,'CWS P');
// A/T switch OFF must extinguish A/T column (without damaging AFDS output).
const base=AFDS.output(state);
physical.AT_ARM='OFF';
emit('b737:mcp-hardware-change',{id:'AT_ARM',value:'OFF',method:'click'});
assert.equal(seat('CAPT').at.active,'');
assert.equal(seat('FO').at.active,'');
assert.equal(base.controls.atArm,true,'Physical preview never mutates the MCP core before bridge handles toggle');
send({type:'AT_ARM',armed:false});
const after=AFDS.output(state);
assert.equal(after.controls.atArm,false);
// Disengage CMD with a second valid press; FD left stays selected.
send({type:'BUTTON',id:'CMD_A'});
assert.equal(seat('CAPT').afds.active,'FD');
assert.equal(seat('FO').afds.active,'');
// Two physical FD OFF -> no persistent stale pitch, roll or CMD on FMA.
physical.FD_LEFT='OFF';
emit('b737:mcp-hardware-change',{id:'FD_LEFT',value:'OFF',method:'click'});
for(const s of ['CAPT','FO']){
 assert.equal(seat(s).afds.active,'');
 assert.equal(seat(s).pitch.active,'');
 assert.equal(seat(s).roll.active,'');
}
send({type:'FD',side:'left',on:false});
visualPower(false);
for(const s of ['CAPT','FO']){
 assert.equal(seat(s).at.active,'');
 assert.equal(seat(s).afds.active,'');
 assert.equal(seat(s).pitch.active,'');
 assert.equal(seat(s).roll.active,'');
}
// Same events operate even while the cockpit switches EIS ↔ CONVENTIONAL.
// This test checks event continuity, not changes to EIS locked geometry.
emit('b737:engine-indication-view',{mode:'CONVENTIONAL'});
emit('b737:engine-indication-view',{mode:'EIS'});
assert.ok(draws.some(x=>x.seat==='CAPT'));
assert.ok(draws.some(x=>x.seat==='FO'));
assert.equal(View.inspectLink().lastTrigger,'b737:engine-indication-view');
console.log('PASS: A/T ARM, independent F/D switches, HDG/V/S/ALT/N1/CMD, OFF, power failure and panel mode change flow through MCP→AFDS→FMA.');
