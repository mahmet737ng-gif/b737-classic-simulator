'use strict';
const assert=require('node:assert/strict');
const T=require('./classic-toga-ch4-v1');
const ctx={groundReady:true,airborne:false,fdLeft:true,fdRight:true,
 atArmed:true,apChannels:0,engine1Running:true,engine2Running:true,
 iasKt:0,v2Kt:140,radioAltitudeFt:0,groundTrackDeg:270,selectedSpeedKt:140};
let s=T.press(T.initial(),ctx);
assert.equal(s.phase,'TO');assert.deepEqual([s.atMode,s.pitchMode,s.rollMode,s.afdsMode],
 ['N1','TO/GA','','FD']);
assert.equal(s.throttleFraction,1);
assert.equal(T.advance(s,{...ctx,iasKt:59},1).fdPitchDeg,-10);
s=T.advance(s,{...ctx,iasKt:60},2);assert.equal(s.fdPitchDeg,15);
s=T.advance(s,{...ctx,iasKt:84},2);assert.equal(s.atMode,'THR HLD');
s=T.advance(s,{...ctx,airborne:true,iasKt:150,radioAltitudeFt:50},2);
s=T.advance(s,{...ctx,airborne:true,iasKt:170,radioAltitudeFt:450},20>10?10:10);
s=T.advance(s,{...ctx,airborne:true,iasKt:170,radioAltitudeFt:450},9);
assert.equal(s.atMode,'ARM');
let below=T.press(T.initial(),{...ctx,fdLeft:false});
assert.equal(below.phase,'OFF','Both FDs required for on-ground takeoff');
let ga=T.press(T.initial(),{...ctx,groundReady:false,airborne:true,radioAltitudeFt:700,
 apChannels:1,selectedSpeedKt:145});
assert.equal(ga.phase,'GA');assert.equal(ga.apDisengage,true);
assert.deepEqual([ga.atMode,ga.pitchMode,ga.rollMode,ga.afdsMode],
 ['GA','TO/GA','','FD']);
assert.equal(ga.throttleFraction,.86,'First GA press requests reduced GA');
assert.equal(T.press(ga,{...ctx,airborne:true}).presses,1,
 'Full GA unavailable until reduced GA limit reached');
ga=T.advance(ga,{...ctx,reducedGaN1Reached:true},1);
ga=T.press(ga,{...ctx,airborne:true});assert.equal(ga.throttleFraction,1);
let single=T.press(T.initial(),{...ctx,groundReady:false,airborne:true,
 radioAltitudeFt:500,engine2Running:false,selectedSpeedKt:130,v2Kt:138});
assert.equal(single.singleEngine,true);assert.equal(single.fdPitchDeg,13);
assert.equal(single.targetSpeedKt,138,'Target not less than V2');
let dual=T.press(T.initial(),{...ctx,groundReady:false,airborne:true,
 radioAltitudeFt:50,apChannels:2,flareArmed:true});
assert.equal(dual.afdsMode,'CMD');assert.equal(dual.apDisengage,false);
assert.equal(T.press(T.initial(),{...ctx,groundReady:false,airborne:true,radioAltitudeFt:3000}).phase,'OFF');
// FCOM 4.20.27: second engine fails AFTER GA starts, with <10s and >10s
// branches. Actual aircraft performance limits are not inferred.
let oneAfter=T.press(T.initial(),{...ctx,groundReady:false,airborne:true,
 radioAltitudeFt:400,iasKt:150,selectedSpeedKt:145});
oneAfter=T.advance(oneAfter,{...ctx,airborne:true,iasKt:153,
 engine1Running:true,engine2Running:false,v2Kt:140,selectedSpeedKt:145},5);
assert.equal(oneAfter.singleEngine,true);
assert.equal(oneAfter.fdPitchDeg,13);
assert.equal(oneAfter.targetSpeedKt,145,'Before 10 s use selected MCP approach speed');
let gaAfter10=T.press(T.initial(),{...ctx,groundReady:false,airborne:true,
 radioAltitudeFt:500,iasKt:150,selectedSpeedKt:140});
gaAfter10=T.advance(gaAfter10,{...ctx,engine1Running:true,engine2Running:true,iasKt:152},10);
gaAfter10=T.advance(gaAfter10,{...ctx,engine1Running:true,engine2Running:false,
 iasKt:153,selectedSpeedKt:140,v2Kt:140},1);
assert.equal(gaAfter10.targetSpeedKt,150,'After 10 s within ±5 knots: speed at GA engagement');
let gaFast=T.press(T.initial(),{...ctx,groundReady:false,airborne:true,radioAltitudeFt:500,iasKt:150});
gaFast=T.advance(gaFast,{...ctx,engine1Running:true,engine2Running:true,iasKt:152},10);
gaFast=T.advance(gaFast,{...ctx,engine1Running:true,engine2Running:false,
 iasKt:170,selectedSpeedKt:140,v2Kt:140},1);
assert.equal(gaFast.targetSpeedKt,170,'After 10 s >5 knots: current IAS');
let toFail=T.press(T.initial(),{...ctx,selectedSpeedKt:145});
toFail=T.advance(toFail,{...ctx,engine1Running:true,engine2Running:false,
 v2Kt:145,iasKt:178},4);
assert.equal(toFail.targetSpeedKt,165,'Engine-out takeoff target clamps to V2+20');
let noSecondary=T.press(T.initial(),{...ctx,selectedSpeedKt:150,
 takeoffSpeedIncrementKt:15});
noSecondary=T.advance(noSecondary,{...ctx,selectedSpeedKt:150,v2Kt:null,
 engine1Running:true,engine2Running:false,iasKt:190},.5);
assert.equal(noSecondary.targetSpeedKt,170,
 'Engine-out clamp uses MCP V2+20 when external V2 data is missing');

 // User-requested Unified V2+15 profile stays separate from the 2023 SHI V2+20 baseline.
 const popCtx={...ctx,fdLeft:false,fdRight:false,iasKt:85,
  takeoffSpeedIncrementKt:15,selectedSpeedKt:140};
 assert.equal(T.eligibleTakeoffFdPopUp({...popCtx,iasKt:80}),false);
 assert.equal(T.eligibleTakeoffFdPopUp({...popCtx,radioAltitudeFt:2000}),false);
 assert.equal(T.eligibleTakeoffFdPopUp({...popCtx,sinceLiftoffSec:150}),false);
 assert.equal(T.eligibleTakeoffFdPopUp({...popCtx,sinceLiftoffSec:149}),true);
 let pop=T.press(T.initial(),popCtx);
 assert.equal(pop.phase,'TO','After 80 KIAS TOGA may pop FD despite both switches OFF');
 assert.equal(pop.fdAutoPopUp,true);
 assert.equal(pop.targetSpeedKt,155,'Trainer schedule holds MCP V2 + 15 kt');
 assert.equal(T.press(T.initial(),{...popCtx,iasKt:79}).phase,'OFF');
 pop=T.advance(pop,{...popCtx,airborne:true,radioAltitudeFt:20,
  iasKt:145,vsFpm:650,availableN1Percent:90},.4);
 assert.equal(pop.fdPitchDeg,15,'Do not switch to IAS control until sufficient climb');
 assert.equal(pop.speedGuidanceActive,false);
 pop=T.advance(pop,{...popCtx,airborne:true,radioAltitudeFt:35,
  iasKt:145,vsFpm:850,availableN1Percent:90},.4);
 assert.equal(pop.speedGuidanceActive,true,'Positive climb activates speed guidance');
 for(let i=0;i<20;i++)pop=T.advance(pop,{...popCtx,airborne:true,
  radioAltitudeFt:80,iasKt:145,vsFpm:1400,availableN1Percent:90},.15);
 assert.ok(pop.fdPitchDeg<12&&pop.fdPitchDeg>1,
  'Below target speed, guidance should reduce pitch without freezing at +15');
 const lowSpeedPitch=pop.fdPitchDeg;
 for(let i=0;i<20;i++)pop=T.advance(pop,{...popCtx,airborne:true,
  radioAltitudeFt:120,iasKt:174,vsFpm:1400,availableN1Percent:90},.15);
 assert.ok(pop.fdPitchDeg>lowSpeedPitch,'High IAS commands more pitch');
 pop=T.advance(pop,{...popCtx,airborne:true,radioAltitudeFt:140,
  iasKt:160,selectedSpeedKt:150,vsFpm:1400,availableN1Percent:85},.2);
 assert.equal(pop.targetSpeedKt,165,'Changing MCP V2 changes the trainer target');
 assert.equal(T.FCOM_TAKEOFF_INCREMENT_KT,20);
 assert.equal(T.press(T.initial(),ctx).targetSpeedKt,160,
  'FCOM profile remains V2+20 with no trainer customization');
console.log('PASS CH4 TOGA: FD N1/THR HLD, 60/84 kt thresholds, FD-only GA, dual AP GA, single-engine 13°, reduced-to-full GA');
