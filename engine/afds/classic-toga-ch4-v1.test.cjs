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
console.log('PASS CH4 TOGA: FD N1/THR HLD, 60/84 kt thresholds, FD-only GA, dual AP GA, single-engine 13°, reduced-to-full GA');
