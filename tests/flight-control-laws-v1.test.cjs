'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Law=require('../engine/flight/flight-control-laws-v1.js');
const Flight=require('../engine/flight/flight-scenario-core-v1.js');
const FCC=require('../engine/afds/fcc-flight-guidance-v1.js');
function mcp(overrides={}){
 const original={power:true,values:{heading:134,speed:240,verticalSpeed:2000,altitude:10000},
  modes:{autopilot:'CMD_A',vertical:'VS',lateral:'HDG_SEL',thrust:'SPEED'},
  axisControl:{pitch:'CMD',roll:'CMD'},controls:{fd:{left:true,right:true}},
  capture:{pitch:null,roll:null},bankAngleLimit:20,speedDisplayMode:'IAS'};
 return {...original,...overrides};
}
function frame(config={}){
 return Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  altitudeFt:5000,speedKt:220,headingDeg:85,vsFpm:0,...config});
}
const near=(a,b,eps=.0001)=>assert.ok(Math.abs(a-b)<eps,a+' != '+b);
test('AFDS FD command pitch and roll equal actual flight-control-law demands',()=>{
 const f=frame(),m=mcp(),res=FCC.evaluate(FCC.createState(),m,f,{magneticVariationDeg:5});
 near(res.pitchCommandDeg,Law.pitchForVs(2000,f.tasKt));
 near(res.rollCommandDeg,Law.bankForHeading(85,139,20));
 assert.ok(res.fd.captain);assert.ok(res.fd.firstOfficer);
 assert.ok(res.actions.some(x=>x.type==='HEADING'&&x.value===139));
});
test('pitch/bank/VS rates are limited in physical flight plant, no instant setpoints',()=>{
 let s=frame(),m=mcp(),fcc=FCC.createState();
 for(let i=0;i<100;i++){
  const r=FCC.evaluate(fcc,m,s,{magneticVariationDeg:5});fcc=r.state;
  const previous=s;
  for(const action of r.actions)s=Flight.command(s,action);
  s=Flight.step(s,.1);
  assert.ok(Math.abs(s.pitchDeg-previous.pitchDeg)<=Law.RATES.pitchDegSec*.1+1e-8);
  assert.ok(Math.abs(s.bankDeg-previous.bankDeg)<=Law.RATES.rollDegSec*.1+1e-8);
  assert.ok(Math.abs(s.vsFpm-previous.vsFpm)<=Law.RATES.vsFpmSec*.1+1e-8);
  assert.ok(Math.abs(s.bankDeg)<=20+.001);
 }
 near(s.vsFpm,2000,50);
 near(s.pitchDeg,Law.pitchForVs(2000,s.tasKt),.15);
 assert.ok(s.trueHeadingDeg>85&&s.altitudeFt>5000);
});
test('ALT ACQ remains latched and does NOT alternate VS/ALT flight commands',()=>{
 let s=frame({altitudeFt:9500,vsFpm:1500}),m=mcp(),fcc=FCC.createState();
 let r=FCC.evaluate(fcc,m,s,{magneticVariationDeg:5});fcc=r.state;
 assert.ok(r.actions.some(x=>x.type==='VS'));
 s={...s,altitudeFt:9790,vsFpm:1450};
 r=FCC.evaluate(fcc,m,s,{magneticVariationDeg:5});fcc=r.state;
 assert.equal(r.altAcquireConfirmed,true);
 assert.equal(r.actions.filter(x=>x.type==='ALTITUDE').length,1);
 assert.equal(r.actions.some(x=>x.type==='VS'),false);
 for(const altitude of [9810,9890,9960]){
  r=FCC.evaluate(fcc,m,{...s,altitudeFt:altitude},{magneticVariationDeg:5});fcc=r.state;
  assert.equal(r.actions.some(x=>x.type==='VS'),false);
  assert.equal(r.actions.find(x=>x.type==='ALTITUDE').value,10000);
 }
 r=FCC.evaluate(fcc,m,{...s,altitudeFt:9990,vsFpm:180},{magneticVariationDeg:5});
 assert.equal(r.altitudeHoldConfirmed,true);
});
test('LVL CHG climb target never generates descent command for high IAS selection',()=>{
 const m=mcp({modes:{autopilot:'CMD_A',vertical:'LVL_CHG',lateral:'HDG_SEL'},
  values:{heading:134,speed:320,verticalSpeed:0,altitude:12000},speedDisplayMode:'IAS'});
 const r=FCC.evaluate(FCC.createState(),m,frame(),{magneticVariationDeg:5});
 const commanded=r.actions.find(x=>x.type==='VS');
 assert.ok(commanded&&commanded.value>=0,'LVL CHG climb clearance cannot reverse to descent');
 assert.ok(r.pitchCommandDeg>=Law.TRIM_PITCH_DEG);
});
test('ALT HLD holds captured altitude with a gently damped pitch command',()=>{
 const m=mcp({modes:{autopilot:'CMD_A',vertical:'ALT_HLD',lateral:'HDG_SEL'}});
 const f=frame({altitudeFt:7000,vsFpm:2000});
 let r=FCC.evaluate(FCC.createState(),m,f,{magneticVariationDeg:5});
 assert.equal(r.actions.find(x=>x.type==='ALTITUDE').value,7000);
 assert.ok(r.pitchCommandDeg<=2.1);
 r=FCC.evaluate(r.state,m,{...f,altitudeFt:7100,vsFpm:900},{magneticVariationDeg:5});
 assert.equal(r.actions.find(x=>x.type==='ALTITUDE').value,7000);
 assert.ok(r.pitchCommandDeg<2);
});
