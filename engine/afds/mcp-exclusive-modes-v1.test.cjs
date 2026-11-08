'use strict';
/* MCP/FMA EXCLUSIVE-0001 — FCOM 737CL 4.10.4–4.10.11.
 * 4 distinct FMA channels; SPEED and LVL CHG are not two pitch modes.
 * A new compatible mode replaces the previously active mode atomically.
 * Incompatible A/T requests are rejected, with active mode preserved.
 */
const assert=require('node:assert/strict');
const Core=require('./mcp-mode-core-v1.js');
const FMA=require('./fma-mode-engine-v1.js');
const required=['generator1','generator2','transfer1','transfer2','main1','main2','acStandby',
 'groundService','dc1','dc2','battery','hotBattery','switchedHotBattery','dcStandby'];
const bus=Object.fromEntries(required.map(k=>[k,k==='dc1'||k==='battery'||k==='hotBattery']));
bus.electronic1=true;
let state=Core.initialState();
const send=a=>(state=Core.transition(state,a),Core.output(state));
const lamps=()=>Core.output(state).lamps;
const fma=seat=>FMA.fromMcp(Core.output(state),seat);
const check=()=> {
 const output=Core.output(state);
 for(const [channel,values] of Object.entries(Core.MODE_OWNERS)){
  const selected=values.filter(id=>output.lamps[id]===true);
  assert.ok(selected.length<=1,channel+' has competing illuminated selectors: '+selected.join(','));
 }
 for(const seat of ['CAPT','FO']){
  const e=fma(seat);
  for(const col of FMA.FIELDS){
   assert.equal(typeof e[col].active,'string');
   assert.ok(FMA.MODES[col].includes(e[col].active),
    seat+' '+col+' reported invalid active mode');
   assert.equal(typeof e[col].armed,'string');
  }
 }
};
send({type:'ELECTRICAL',snapshot:{schema:'B737_ELECTRICAL_V7_RESULT',revision:1,bus}});
send({type:'FD',side:'left',on:true});
send({type:'AT_ARM',armed:true});
state.values.speed=225;const targetSpeed=state.values.speed;
check();
// The user example: A/T SPEED annunciates MCP SPD in A/T column.
send({type:'BUTTON',id:'SPEED'});
assert.equal(fma('CAPT').at.active,'MCP SPD');
assert.equal(fma('CAPT').pitch.active,'');
assert.equal(lamps().SPEED,true);
check();
// FCOM 4.10.9: LVL CHG engages PITCH MCP SPD. Existing selected IAS is
// retained, but A/T SPEED is no longer a competing active thrust mode.
send({type:'BUTTON',id:'LVL_CHG'});
assert.equal(state.values.speed,targetSpeed);
assert.equal(state.modes.vertical,'LVL_CHG');
assert.equal(state.modes.thrust,null);
assert.equal(lamps().SPEED,false);
assert.equal(lamps().LVL_CHG,true);
assert.equal(fma('CAPT').pitch.active,'MCP SPD');
assert.equal(fma('CAPT').at.active,'ARM');
check();
// A second SPEED command is incompatible while LVL CHG is selected.
const before=JSON.stringify(state.modes);
send({type:'BUTTON',id:'SPEED'});
assert.equal(state.lastRejection,'AT_SPEED_INCOMPATIBLE_WITH_LVL_CHG');
assert.equal(JSON.stringify(state.modes),before);
assert.equal(lamps().LVL_CHG,true);
check();
// Deselect LVL CHG; SPEED can now engage in the A/T channel.
send({type:'BUTTON',id:'LVL_CHG'});
assert.equal(state.modes.vertical,null);
send({type:'BUTTON',id:'SPEED'});
assert.equal(fma('CAPT').at.active,'MCP SPD');
check();
// Press N1: atomic same-channel substitution, no SPEED + N1 together.
send({type:'BUTTON',id:'N1'});
assert.equal(lamps().SPEED,false);
assert.equal(lamps().N1,true);
assert.equal(fma('CAPT').at.active,'N1');
check();
// Changing pitch to V/S automatically changes A/T to SPEED. Two different
// annunciations can be present at the same time in DIFFERENT FMA channels.
send({type:'BUTTON',id:'VS'});
assert.equal(fma('CAPT').pitch.active,'V/S');
assert.equal(fma('CAPT').at.active,'MCP SPD');
assert.equal(lamps().VS,true);
assert.equal(lamps().N1,false);
assert.equal(lamps().SPEED,true);
check();
// ALT HOLD replaces V/S (not simultaneous), and A/T remains in SPEED.
send({type:'BUTTON',id:'ALT_HLD'});
assert.equal(lamps().VS,false);
assert.equal(lamps().ALT_HLD,true);
assert.equal(fma('CAPT').pitch.active,'ALT HOLD');
assert.equal(fma('CAPT').at.active,'MCP SPD');
check();
// An incompatible N1 request during ALT HOLD is rejected, not layered.
const old=JSON.stringify(state.modes);
send({type:'BUTTON',id:'N1'});
assert.equal(state.lastRejection,'AT_N1_INCOMPATIBLE_WITH_PITCH_SPEED_HOLD');
assert.equal(JSON.stringify(state.modes),old);
check();
// Leaving the pitch speed-hold cancels its AUTOMATIC A/T source.
send({type:'BUTTON',id:'ALT_HLD'});
assert.equal(state.modes.vertical,null);
assert.equal(state.modes.thrust,null);
assert.equal(fma('CAPT').at.active,'ARM');
check();
// Lateral source replacement: HDG SEL is extinguished on LNAV selection.
send({type:'BUTTON',id:'HDG_SEL'});
assert.equal(lamps().HDG_SEL,true);
send({type:'EVIDENCE',key:'fmcRouteReady',value:true});
send({type:'BUTTON',id:'LNAV'});
assert.equal(lamps().HDG_SEL,false);
assert.equal(lamps().LNAV,true);
assert.equal(fma('CAPT').roll.active,'LNAV');
check();
// AFDS A/B command sources are mutually exclusive; CWS replaces CMD.
send({type:'BUTTON',id:'CMD_A'});
assert.equal(lamps().CMD_A,true);
send({type:'BUTTON',id:'CMD_B'});
assert.equal(lamps().CMD_A,false);
assert.equal(lamps().CMD_B,true);
assert.equal(fma('FO').afds.active,'CMD');
send({type:'BUTTON',id:'CWS_A'});
assert.equal(lamps().CMD_B,false);
assert.equal(lamps().CWS_A,true);
assert.equal(fma('CAPT').pitch.active,'CWS P');
assert.equal(fma('CAPT').roll.active,'CWS R');
check();
// Both flight directors OFF clears AFDS modes but not the physical A/T arm.
send({type:'FD',side:'left',on:false});
for(const v of ['lateral','vertical','thrust','autopilot'])assert.equal(state.modes[v],null);
assert.equal(fma('CAPT').roll.active,'');
assert.equal(fma('CAPT').pitch.active,'');
check();
// Electrical absence extinguishes the whole FMA, regardless of switch state.
const dead=Object.fromEntries(required.map(k=>[k,false]));dead.electronic1=false;
send({type:'ELECTRICAL',snapshot:{schema:'B737_ELECTRICAL_V7_RESULT',revision:2,bus:dead}});
for(const col of FMA.FIELDS)assert.equal(fma('CAPT')[col].active,'');
console.log('PASS: one active per FMA channel; A/T SPEED→LVL CHG handoff retains IAS target, incompatible selections reject, transitions replace old modes and lamps.');
