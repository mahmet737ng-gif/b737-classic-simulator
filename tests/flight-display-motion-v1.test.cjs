'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Motion=require('../engine/instruments/flight-display-motion-v1.js');
const Flight=require('../engine/flight/flight-scenario-core-v1.js');
const sample=()=>Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
 altitudeFt:5000,speedKt:200,vsFpm:0,headingDeg:359,bankDeg:0});
test('initial scenario snaps to real display measurement, no 0-to-5000 climb animation',()=>{
 const f=sample(),x=Motion.stepFrame(null,f,0);
 assert.equal(x.altitudeFt,5000);assert.equal(x.iasKt,200);
 assert.equal(x.trueHeadingDeg,359);
});
test('presented IAS altitude VS pitch and roll interpolate without instantaneous display jump',()=>{
 const f=sample(),p=Motion.stepFrame(null,f,0),q=Motion.stepFrame(p,{
  ...f,revision:f.revision+1,elapsedSec:f.elapsedSec+.1,iasKt:250,
  altitudeFt:6000,vsFpm:3500,pitchDeg:10,bankDeg:25},.033);
 for(const [field,limit] of [['iasKt',18],['altitudeFt',200],['vsFpm',650],
 ['pitchDeg',3.4],['bankDeg',6]]){
  assert.ok(Math.abs(q[field]-p[field])<=limit*.033+1e-7,
   field+' broke rate limit: '+q[field]+' -> '+p[field]);
 }
 assert.ok(q.altitudeFt>p.altitudeFt&&q.altitudeFt<6000);
 assert.ok(q.iasKt>p.iasKt&&q.iasKt<250);
});
test('heading presentation follows 359-to-000 shortest circular path',()=>{
 const p=Motion.stepFrame(null,sample(),0);
 const q=Motion.stepFrame(p,{...sample(),revision:2,elapsedSec:.1,trueHeadingDeg:1},.04);
 assert.ok(q.trueHeadingDeg>359||q.trueHeadingDeg<2);
 assert.ok(Math.min(q.trueHeadingDeg,360-q.trueHeadingDeg)<2);
});
test('changing to a new scenario origin resets smoothing rather than drifting from previous airport',()=>{
 const f=sample(),p=Motion.stepFrame(null,f,0);
 const q=Motion.stepFrame(p,{...f,icao:'OISS',revision:1,elapsedSec:0,
  altitudeFt:12000,iasKt:230},.035);
 assert.equal(q.altitudeFt,12000);assert.equal(q.iasKt,230);
});
test('source invalidity cannot be filled with synthetic airspeed',()=>{
 assert.equal(Motion.stepFrame(null,{schema:'INVALID',iasKt:200},.05),null);
 assert.equal(Motion.stepValue(200,null,.05),200);
});
