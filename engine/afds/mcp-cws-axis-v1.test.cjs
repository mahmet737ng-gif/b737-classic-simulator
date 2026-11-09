'use strict';
/* FCOM Sepehran 4.10.18 / 4.20.9–4.20.10
 * CMD autopilot with no pitch/roll command => independent CWS P/R.
 * CWS status belongs in the FOURTH AFDS FMA column. Corresponding
 * pitch and roll command columns stay BLANK. CWS selector sets both.
 */
const assert=require('node:assert/strict');
const core=require('./mcp-mode-core-v1.js');
const fma=require('./fma-mode-engine-v1.js');
let s=core.initialState();
const bus=Object.fromEntries([
 'generator1','generator2','transfer1','transfer2','main1','main2',
 'acStandby','groundService','dc1','dc2','battery','hotBattery',
 'switchedHotBattery','dcStandby'
].map(k=>[k,k==='dc1'||k==='battery'||k==='hotBattery']));
bus.electronic1=true;
const send=a=>(s=core.transition(s,a),core.output(s));
const read=seat=>fma.fromMcp(core.output(s),seat);
assert.equal(fma.VERSION,'B737-FMA-ENGINE-0002-CWS-AXIS');
assert.equal(core.axisControl(s,false).pitch,'OFF');
send({type:'ELECTRICAL',snapshot:{schema:'B737_ELECTRICAL_V7_RESULT',revision:1,bus}});
send({type:'FD',side:'left',on:true});
assert.equal(read('CAPT').afds.active,'FD');
assert.equal(read('CAPT').pitch.active,'');
assert.equal(read('CAPT').roll.active,'');
assert.equal(read('CAPT').afds.secondary,'');
assert.deepEqual(core.output(s).axisControl,{pitch:'OFF',roll:'OFF'});
send({type:'BUTTON',id:'CMD_A'});
assert.deepEqual(core.output(s).axisControl,{pitch:'CWS',roll:'CWS'});
assert.equal(read('CAPT').pitch.active,'');
assert.equal(read('CAPT').roll.active,'');
assert.equal(read('CAPT').afds.active,'CMD');
assert.equal(read('CAPT').afds.secondary,'CWS P');
assert.equal(read('CAPT').afds.tertiary,'CWS R');
assert.equal(fma.color('afds','CWS P'),'yellow');
assert.equal(fma.color('afds','CWS R'),'yellow');
assert.equal(read('FO').afds.active,'CMD','both EADI reflect an engaged A/P');
assert.equal(read('FO').afds.secondary,'CWS P');
assert.equal(read('FO').afds.tertiary,'CWS R');
// Select pitch V/S: only roll remains in CWS.
send({type:'BUTTON',id:'VS'});
assert.deepEqual(core.output(s).axisControl,{pitch:'CMD',roll:'CWS'});
assert.equal(read('CAPT').pitch.active,'V/S');
assert.equal(read('CAPT').roll.active,'');
assert.equal(read('CAPT').afds.active,'CMD');
assert.equal(read('CAPT').afds.secondary,'CWS R');
// Now select the roll mode: CMD on both axes.
send({type:'BUTTON',id:'HDG_SEL'});
assert.deepEqual(core.output(s).axisControl,{pitch:'CMD',roll:'CMD'});
assert.equal(read('CAPT').afds.active,'CMD');
assert.equal(read('CAPT').pitch.active,'V/S');
assert.equal(read('CAPT').roll.active,'HDG SEL');
// Deselect V/S: pitch blank, only CWS P in AFDS status.
send({type:'BUTTON',id:'VS'});
assert.deepEqual(core.output(s).axisControl,{pitch:'CWS',roll:'CMD'});
assert.equal(read('CAPT').pitch.active,'');
assert.equal(read('CAPT').roll.active,'HDG SEL');
assert.equal(read('CAPT').afds.secondary,'CWS P');
// Restore pitch, then deselect HDG: only roll blank and CWS R.
send({type:'BUTTON',id:'ALT_HLD'});
assert.equal(read('CAPT').afds.active,'CMD');
send({type:'BUTTON',id:'HDG_SEL'});
assert.deepEqual(core.output(s).axisControl,{pitch:'CMD',roll:'CWS'});
assert.equal(read('CAPT').pitch.active,'ALT HOLD');
assert.equal(read('CAPT').roll.active,'');
assert.equal(read('CAPT').afds.secondary,'CWS R');
// Explicit CWS selector: CWS in BOTH axes regardless of selected CMD modes.
send({type:'BUTTON',id:'HDG_SEL'});
send({type:'BUTTON',id:'CWS_A'});
assert.deepEqual(core.output(s).axisControl,{pitch:'CWS',roll:'CWS'});
assert.equal(read('CAPT').pitch.active,'');
assert.equal(read('CAPT').roll.active,'');
assert.equal(read('CAPT').afds.secondary,'CWS P');
assert.equal(read('CAPT').afds.tertiary,'CWS R');
// Turn off the A/P: blank axes are not CWS merely because the F/D is ON.
send({type:'BUTTON',id:'CWS_A'});
assert.deepEqual(core.output(s).axisControl,{pitch:'OFF',roll:'OFF'});
assert.equal(read('CAPT').afds.active,'FD');
assert.equal(read('CAPT').afds.secondary,'');
// Qualified FCC altitude capture ends pitch CWS; roll can remain CWS.
const output={...core.output(s),modes:{...core.output(s).modes,
  autopilot:'CMD_A',vertical:null,lateral:null},
 axisControl:{pitch:'CWS',roll:'CWS'}};
const confirmed={
 schema:'B737_FMA_FCC_OBSERVATION_V1',confirmed:true,seat:'CAPT',
 fields:{pitch:{active:'ALT ACQ'}},evidence:{altAcquire:true}
};
const acquired=fma.project(output,'CAPT',confirmed);
assert.equal(acquired.pitch.active,'ALT ACQ');
assert.equal(acquired.roll.active,'');
assert.equal(acquired.afds.active,'CMD');
assert.equal(acquired.afds.secondary,'CWS R');
const loc=fma.project(output,'CAPT',{
 ...confirmed,fields:{roll:{active:'VOR/LOC'}},
 evidence:{navCaptured:true}
});
assert.equal(loc.roll.active,'VOR/LOC');
assert.equal(loc.afds.secondary,'CWS P');
// A verified manual override of engaged CMD pitch requires FCC evidence.
const commanded={...output,modes:{...output.modes,lateral:'HDG_SEL',vertical:'VS'},
 axisControl:{pitch:'CMD',roll:'CMD'}};
const overridden=fma.project(commanded,'CAPT',{
 ...confirmed,fields:{},evidence:{pitchCwsOverride:true,autopilotEngaged:true}
});
assert.equal(overridden.pitch.active,'');
assert.equal(overridden.roll.active,'HDG SEL');
assert.equal(overridden.afds.secondary,'CWS P');
assert.throws(()=>fma.project(commanded,'CAPT',{
 ...confirmed,fields:{},
 evidence:{pitchCwsOverride:true,autopilotEngaged:true,dualAp:true,
  locCaptured:true,gsCaptured:true}
}),/disengages autopilot/);
assert.throws(()=>fma.project(commanded,'CAPT',{
 ...confirmed,fields:{},evidence:{pitchCwsOverride:true}
}),/A\/P evidence/);
// Loss of MCP power prevents any CWS indication.
const dead=Object.fromEntries(Object.keys(bus).filter(k=>k!=='electronic1').map(k=>[k,false]));dead.electronic1=false;
send({type:'ELECTRICAL',snapshot:{schema:'B737_ELECTRICAL_V7_RESULT',revision:2,bus:dead}});
assert.deepEqual(core.output(s).axisControl,{pitch:'OFF',roll:'OFF'});
assert.equal(read('CAPT').afds.active,'');
console.log('PASS: FCOM CMD→single/both CWS axes, FMA AFDS placement, FCC capture and dual APP override protection.');
