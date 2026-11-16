'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Gauges=require('../engine/instruments/flight-dynamics-gauge-model-v1.js');
const Flight=require('../engine/flight/flight-scenario-core-v1.js');
const near=(x,y,t=.0001)=>assert.ok(Math.abs(x-y)<=t,`${x} !== ${y}`);
test('altimeter long hand rotates one revolution per 1000 feet',()=>{
 near(Gauges.altimeterAngle(10000),0);
 near(Gauges.altimeterAngle(10250),90);
 near(Gauges.altimeterAngle(10500),180);
 near(Gauges.altimeterAngle(10750),270);
 near(Gauges.altimeterAngle(11000),0);
 near(Gauges.altimeterAngle(-100),324);
});
test('IVSI zero, climb, descent and nonlinear boundaries have correct directions',()=>{
 near(Gauges.ivsiAngle(0),-90);
 near(Gauges.ivsiAngle(1000),-48);
 near(Gauges.ivsiAngle(-1000),-132);
 near(Gauges.ivsiAngle(6000),0);
 near(Gauges.ivsiAngle(-6000),-180);
 assert.ok(Gauges.ivsiAngle(500)>Gauges.ivsiAngle(0));
 assert.ok(Gauges.ivsiAngle(-500)<Gauges.ivsiAngle(0));
});
test('dynamic cockpit gauge state is sourced from real flight scenario samples',()=>{
 const state=Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  altitudeFt:12500,speedKt:225,vsFpm:-1500,headingDeg:290});
 const view=Gauges.sample(state);
 assert.equal(view.altitudeFt,12500);
 assert.equal(view.standbyAltitudeFt,12500);
 assert.equal(view.altimeterNeedleDeg,180);
 assert.equal(view.standbyNeedleDeg,180);
 assert.equal(view.indicatedSpeedKt,225);
 assert.ok(view.ivsiNeedleDeg< -90);
 assert.equal(view.source,'UNIFIED_FLIGHT_SCENARIO');
});
test('ground IAS below photo pointer scale is identified and not misrepresented',()=>{
 const state=Flight.newScenario({airport:'OIMM',preset:'RUNWAY_READY'});
 const view=Gauges.sample(state);
 assert.equal(view.indicatedSpeedKt,0);
 assert.equal(view.airspeedPointerKt,60);
 assert.equal(view.airspeedBelowScale,true);
 assert.equal(view.verticalSpeedFpm,0);
});
test('invalid arbitrary gauge messages cannot supersede a scenario source',()=>{
 assert.throws(()=>Gauges.sample({altitudeFt:10000,iasKt:100,vsFpm:0}),TypeError);
 assert.throws(()=>Gauges.altimeterAngle(Infinity),RangeError);
 assert.throws(()=>Gauges.ivsiAngle(NaN),RangeError);
});
test('climbing and descending sample moves altimeter and IVSI in both pilot channels',()=>{
 const state=Flight.newScenario({airport:'OISS',preset:'MANUAL',airborne:true,
  altitudeFt:9000,speedKt:205,vsFpm:0});
 const before=Gauges.sample(state);
 let up=Flight.command(state,{type:'VS',value:1200});
 for(let i=0;i<75;i++)up=Flight.step(up,.2);
 const afterUp=Gauges.sample(up);
 assert.ok(afterUp.altitudeFt>before.altitudeFt);
 assert.ok(afterUp.ivsiNeedleDeg>before.ivsiNeedleDeg);
 let down=Flight.command(up,{type:'VS',value:-1800});
 for(let i=0;i<100;i++)down=Flight.step(down,.2);
 const afterDown=Gauges.sample(down);
 assert.ok(afterDown.ivsiNeedleDeg<before.ivsiNeedleDeg);
 assert.ok(afterDown.indicatedSpeedKt>=0);
});
