'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Core=require('../engine/flight/flight-scenario-core-v1.js');
function advance(s,seconds,dt=.1){for(let i=0;i<Math.ceil(seconds/dt);i++)s=Core.step(s,dt);return s;}
function almost(actual,expected,tolerance=.02){assert.ok(Math.abs(actual-expected)<=tolerance,`${actual} != ${expected}`);}
test('all airport runway options have the correct 5 and 10 NM reciprocal final geometry',()=>{
 for(const icao of ['OIMM','OIII','OISS']){
  const a=Core.AIRPORTS[icao];
  for(const runway of Object.keys(a.runways)){
   for(const [preset,nm] of [['FINAL_5',5],['FINAL_10',10]]){
    const s=Core.newScenario({airport:icao,runway,preset});
    almost(Core.distanceNm(s,s.threshold),nm,.001);
    assert.equal(s.phase,'FINAL_APPROACH');assert.equal(s.airborne,true);
    assert.equal(s.trueHeadingDeg,a.runways[runway]);
    assert.ok(s.altitudeFt>a.elevationFt);
    assert.equal(s.georefQuality,'PROVISIONAL_ARP');
   }
  }
 }
});
test('ready runway stays stationary and ground altitude is runway elevation',()=>{
 let s=Core.newScenario({airport:'OIII',runway:'29L',preset:'RUNWAY_READY'});
 const before=[s.lat,s.lon];s=advance(s,80);
 assert.equal(s.airborne,false);assert.equal(s.phase,'GROUND_READY');
 assert.equal(s.altitudeFt,Core.AIRPORTS.OIII.elevationFt);
 assert.equal(s.radioAltitudeFt,0);assert.equal(s.iasKt,0);
 assert.deepEqual([s.lat,s.lon],before);
});
test('manual ground input cannot put the aircraft 3000 ft above airport while on ground',()=>{
 const s=Core.newScenario({airport:'OISS',preset:'MANUAL',airborne:false,
  altitudeFt:10000,headingDeg:270,speedKt:150,vsFpm:2500});
 assert.equal(s.altitudeFt,Core.AIRPORTS.OISS.elevationFt);
 assert.equal(s.iasKt,0);assert.equal(s.vsFpm,0);assert.equal(s.airborne,false);
});
test('ground roll requires explicit instruction and eventually enters climb',()=>{
 let s=Core.newScenario({airport:'OIMM',preset:'RUNWAY_READY'});
 assert.throws(()=>Core.command(s,{type:'PAUSE_WRONG'}));
 s=Core.command(s,{type:'TAKEOFF_ROLL'});
 s=advance(s,85);
 assert.equal(s.airborne,true);assert.equal(s.phase,'INITIAL_CLIMB');
 assert.ok(s.altitudeFt>Core.AIRPORTS.OIMM.elevationFt);
 assert.ok(s.vsFpm>0);assert.ok(s.iasKt>125);
});
test('heading command banks and smoothly changes true heading without teleporting',()=>{
 let s=Core.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  altitudeFt:10000,speedKt:220,headingDeg:0});
 s=Core.command(s,{type:'HEADING',value:90});const old=s.trueHeadingDeg;
 s=Core.step(s,.1);assert.ok(s.bankDeg>0&&s.bankDeg<3);
 s=advance(s,25);
 assert.ok(s.trueHeadingDeg>old+10&&s.trueHeadingDeg<90);
 assert.ok(s.bankDeg<=25);
});
test('fixed bank demand creates a coordinated turn with finite motion',()=>{
 let s=Core.newScenario({airport:'OISS',preset:'MANUAL',airborne:true,
  altitudeFt:12000,speedKt:210,headingDeg:10,bankDeg:20});
 s=advance(s,20);assert.ok(s.trueHeadingDeg>30);
 almost(s.bankDeg,20,1);
 for(const x of ['lat','lon','altitudeFt','trueHeadingDeg','trueTrackDeg','pitchDeg'])assert.ok(Number.isFinite(s[x]),x);
});
test('vertical speed command changes pressure-independent MSL altitude over time',()=>{
 let s=Core.newScenario({airport:'OIMM',preset:'MANUAL',airborne:true,
  altitudeFt:12000,speedKt:200,headingDeg:90,vsFpm:0});
 s=Core.command(s,{type:'VS',value:-1500});
 s=advance(s,60);assert.ok(s.altitudeFt<10800&&s.altitudeFt>9500);
 assert.ok(s.vsFpm<-1400);assert.ok(s.pitchDeg<2);
});
test('target altitude capture never overshoots commanded altitude',()=>{
 let s=Core.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  altitudeFt:9000,speedKt:200,headingDeg:290});
 s=Core.command(s,{type:'ALTITUDE',value:10000});
 s=advance(s,130);almost(s.altitudeFt,10000,30);
 assert.ok(s.vsFpm<=500);
});
test('final starts descending on glideslope and can touch down',()=>{
 let s=Core.newScenario({airport:'OIII',runway:'29L',preset:'FINAL_5'});
 const initial=s.altitudeFt;
 s=advance(s,20);
 assert.ok(s.altitudeFt<initial-150,`final failed to descend: ${s.altitudeFt}`);
 s=advance(s,120);
 assert.equal(s.airborne,false);assert.equal(s.phase,'LANDING_ROLL');
 assert.equal(s.altitudeFt,Core.AIRPORTS.OIII.elevationFt);
});
test('invalid limits and airports are rejected instead of silently clamped',()=>{
 assert.throws(()=>Core.newScenario({airport:'ZZZZ'}),RangeError);
 assert.throws(()=>Core.newScenario({airport:'OIMM',runway:'88'}),RangeError);
 assert.throws(()=>Core.newScenario({preset:'FINAL_12'}),RangeError);
 assert.throws(()=>Core.newScenario({preset:'MANUAL',airborne:true,speedKt:0,altitudeFt:10000}),RangeError);
 assert.throws(()=>Core.step(Core.newScenario(),NaN),RangeError);
});
