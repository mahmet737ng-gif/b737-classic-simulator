'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const Servo=require('../engine/afds/autothrottle-speed-servo-v1.js');
const Flight=require('../engine/flight/flight-scenario-core-v1.js');
function mcp(target=220){return {power:true,controls:{atArm:true},modes:{thrust:'SPEED'},
 speedDisplayMode:'IAS',displayBlank:{speed:false},values:{speed:target}};}
function engines(n=2,n1=70,throttle=.5){
 return {engine1:{running:n>=1,n1Percent:n>=1?n1:0,throttle:n>=1?throttle:0},
 engine2:{running:n>=2,n1Percent:n>=2?n1:0,throttle:n>=2?throttle:0}};
}
function runServo(patch={},prior=Servo.initial()){
 return Servo.step(prior,{dtSec:.2,mcp:mcp(),flight:{iasKt:200,vsFpm:0},
 engines:engines(),...patch});
}
test('A/T ARM alone cannot drive throttles; SPEED must be engaged',()=>{
 const m=mcp();m.modes.thrust=null;
 const o=runServo({mcp:m});
 assert.equal(o.active,false);assert.equal(o.reason,'AT_SPEED_NOT_ENGAGED');
 assert.deepEqual(o.commands,[]);
});
test('MCP electrical loss, A/T disarm, target mode blank and manual override inhibit motor commands',()=>{
 for(const change of [m=>{m.power=false;},m=>{m.controls.atArm=false;},
 m=>{m.speedDisplayMode='MACH';},m=>{m.displayBlank.speed=true;}]){
  const m=mcp();change(m);
  const o=runServo({mcp:m});assert.equal(o.active,false);assert.equal(o.commands.length,0);
 }
 assert.equal(runServo({inhibited:true}).reason,'MANUAL_OVERRIDE');
 assert.equal(runServo({paused:true}).reason,'SCENARIO_PAUSED');
 assert.equal(runServo({flight:{iasKt:0,vsFpm:0,airborne:false}}).reason,'ON_GROUND_SPEED_SERVO_INHIBITED');
 assert.equal(runServo({flight:{iasKt:null,vsFpm:0}}).reason,'MEASURED_AIRSPEED_UNAVAILABLE');
});
test('only running engines receive commands, and no synthetic engine start is allowed',()=>{
 let s=runServo({engines:engines(0)});
 assert.equal(s.reason,'NO_RUNNING_ENGINES');assert.equal(s.commands.length,0);
 s=runServo({engines:engines(1)});
 assert.equal(s.active,true);assert.equal(s.commands.length,1);
 assert.equal(s.commands[0].engine,'engine1');
 s=runServo({engines:engines(2)});
 assert.deepEqual(s.commands.map(x=>x.engine),['engine1','engine2']);
});
test('larger MCP target demands more N1 and throttle; smaller target less',()=>{
 const source={dtSec:.2,flight:{iasKt:200,vsFpm:0},engines:engines()};
 const hi=Servo.step(Servo.initial(),{...source,mcp:mcp(250)});
 const lo=Servo.step(Servo.initial(),{...source,mcp:mcp(170)});
 assert.ok(hi.demandN1>lo.demandN1);
 assert.ok(hi.commands[0].throttle>lo.commands[0].throttle);
 assert.ok(hi.commands[1].throttle>lo.commands[1].throttle);
});
test('servo N1 and lever travel obey training-only command limits and rate limiting',()=>{
 let st=Servo.initial(),inputs={dtSec:.2,mcp:mcp(450),
 flight:{iasKt:100,vsFpm:0},engines:engines(2,35,.05)};
 for(let j=0;j<50;j++){
  const previous=st;st=Servo.step(st,inputs);
  assert.ok(st.throttle>=0&&st.throttle<=1);
  assert.ok(st.demandN1>=32&&st.demandN1<=92);
  if(previous.active)assert.ok(st.throttle-previous.throttle<=.22*.2+1e-9);
 }
});
test('observed ISN engine N1 affects IAS in the flight core independently of selected speed',()=>{
 const initial=Flight.newScenario({airport:'OIII',preset:'MANUAL',
  airborne:true,altitudeFt:10000,speedKt:220,headingDeg:290});
 const high=Flight.step(initial,1,{valid:true,engines:[
  {running:true,n1Percent:93},{running:true,n1Percent:93}]});
 const low=Flight.step(initial,1,{valid:true,engines:[
  {running:true,n1Percent:40},{running:true,n1Percent:40}]});
 assert.ok(high.iasKt>initial.iasKt);
 assert.ok(low.iasKt<initial.iasKt);
 assert.equal(high.propulsion.source,'ISN18_OBSERVED_N1_TRAINING_PLANT');
});
test('end-to-end mock ISN N1 lag/servo closes selected speed error without an instant speed jump',()=>{
 const m=mcp(225);
 let st=Servo.initial();
 let flight=Flight.newScenario({airport:'OIMM',preset:'MANUAL',airborne:true,
  altitudeFt:12000,speedKt:180,headingDeg:90,vsFpm:0});
 let throttle=[.35,.35],n1=[65,65],firstSpeed=null,maxBeforeChange=0;
 for(let i=0;i<850;i++){
  const sources={};for(const j of [0,1])sources['engine'+(j+1)]={running:true,n1Percent:n1[j],throttle:throttle[j]};
  st=Servo.step(st,{dtSec:.2,mcp:m,flight,engines:sources});
  for(const j of [0,1]){
   throttle[j]=st.commands[j].throttle;
   const demand=32+65*Math.pow(throttle[j],1.12);
   n1[j]+=(demand-n1[j])*(1-Math.exp(-.2/2.2));
  }
  flight=Flight.step(flight,.2,{valid:true,engines:n1.map(n=>({running:true,n1Percent:n}))});
  if(i===0)firstSpeed=flight.iasKt;
  if(i<350)maxBeforeChange=Math.max(maxBeforeChange,flight.iasKt);
  if(i===349)m.values.speed=195;
 }
 assert.ok(firstSpeed<181,'no speed teleport on MCP target change');
 assert.ok(maxBeforeChange>219&&maxBeforeChange<235,'climb to first selected speed without runaway overshoot');
 assert.ok(Math.abs(flight.iasKt-195)<3,'after reducing target engine deceleration captures lower IAS');
 assert.ok(st.throttle<.8,'thrust lever moved aft for lower selected speed');
});
