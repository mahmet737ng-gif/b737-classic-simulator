'use strict';
const assert=require('node:assert/strict');
const core=require('./mcp-mode-core-v1.js');
const fma=require('./fma-mode-engine-v1.js');
const keys=['generator1','generator2','transfer1','transfer2','main1',
 'main2','acStandby','groundService','dc1','dc2','battery','hotBattery',
 'switchedHotBattery','dcStandby'];
const bus=Object.fromEntries(keys.map(k=>[k,['dc1','battery','hotBattery'].includes(k)]));
bus.electronic1=true;
let s=core.initialState();
const send=a=>(s=core.transition(s,a),core.output(s));
const sample=o=>send({type:'FLIGHT_OBSERVATION',sample:{
 schema:'B737_AFDS_FLIGHT_OBSERVATION_V1',confirmed:true,source:'SIMULATED_FCC',...o}});
const f=()=>fma.fromMcp(core.output(s),'CAPT');
send({type:'ELECTRICAL',snapshot:{schema:'B737_ELECTRICAL_V7_RESULT',revision:1,bus}});
send({type:'FD',side:'left',on:true});
send({type:'BUTTON',id:'CMD_A'});
assert.equal(f().afds.active,'CMD');
assert.equal(f().afds.secondary,'CWS P');
assert.equal(f().afds.tertiary,'CWS R');
assert.equal(send({type:'BUTTON',id:'APP'}).rejection,'APP_ILS_NAV_EVIDENCE_REQUIRED');
sample({navKind:'ILS',navValid:true});
send({type:'BUTTON',id:'APP'});
assert.equal(f().roll.armed,'VOR/LOC');
assert.equal(f().pitch.armed,'G/S');
sample({bankDeg:4,headingDeg:221,rollForceReleased:true,
 radioAltitudeFt:3000,gearDown:false});
assert.equal(core.output(s).axisDemand.roll.type,'WINGS_LEVEL_HEADING_HOLD');
sample({bankDeg:12,headingDeg:222,rollForceReleased:true});
assert.equal(core.output(s).axisDemand.roll.type,'BANK_ATTITUDE_HOLD');
sample({bankDeg:4,headingDeg:223,rollForceReleased:true,
 radioAltitudeFt:900,gearDown:true});
assert.equal(core.output(s).axisDemand.roll.type,'BANK_ATTITUDE_HOLD');
sample({navCaptureConfirmed:true,navKind:'ILS',navValid:true});
assert.equal(f().roll.active,'VOR/LOC');
assert.equal(f().roll.armed,'');
sample({gsCaptureConfirmed:true,gsBelowDots:0.4});
assert.equal(f().pitch.active,'G/S');
assert.equal(f().pitch.armed,'');
send({type:'BUTTON',id:'ALT_HLD'});
sample({pitchOverrideConfirmed:true,altitudeFt:10000});
assert.equal(core.output(s).axisControl.pitch,'CWS');
sample({pitchForceReleased:true,altitudeFt:9800});
assert.equal(f().pitch.active,'ALT ACQ');
sample({altitudeHoldConfirmed:true});
assert.equal(f().pitch.active,'ALT HOLD');
sample({pitchOverrideConfirmed:true,altitudeFt:10000});
sample({pitchForceReleased:true,altitudeFt:9600,pitchDeg:3});
assert.equal(core.output(s).axisControl.pitch,'CWS');
sample({altAcquireConfirmed:true});
assert.equal(f().pitch.active,'ALT ACQ');
sample({altitudeHoldConfirmed:true});
assert.equal(f().pitch.active,'ALT HOLD');
sample({dualAutopilot:true,pitchOverrideConfirmed:true});
assert.equal(core.output(s).modes.autopilot,null);
console.log('PASS FCOM CWS bank, ALT override, NAV arming, LOC and G/S captures');
