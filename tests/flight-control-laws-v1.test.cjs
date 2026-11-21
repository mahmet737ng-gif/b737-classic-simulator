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
 for(let i=0;i<230;i++){
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
test('ALT ACQ stays latched until its timed profile completes; no VS/ALT oscillation',()=>{
 const Capture=require('../engine/flight/altitude-capture-training-v1.js');
 let s=frame({altitudeFt:9500,vsFpm:1500}),m=mcp(),fcc=FCC.createState();
 let r=FCC.evaluate(fcc,m,s,{magneticVariationDeg:5});fcc=r.state;
 assert.ok(r.actions.some(x=>x.type==='VS'));
 // At 1450 fpm the 9s capture distance is about 109 ft, not 300 ft.
 s={...s,altitudeFt:9880,vsFpm:1450};
 r=FCC.evaluate(fcc,m,s,{magneticVariationDeg:5});fcc=r.state;
 assert.equal(r.altAcquireConfirmed,false);
 s={...s,altitudeFt:9900,vsFpm:1450};
 r=FCC.evaluate(fcc,m,s,{magneticVariationDeg:5});fcc=r.state;
 assert.equal(r.altAcquireConfirmed,true);
 assert.equal(r.actions.filter(x=>x.type==='ALT_ACQ').length,1);
 assert.equal(r.actions.some(x=>x.type==='VS'),false);
 m.capture.pitch='ALT_ACQ';
 let plan=Capture.begin({altitudeFt:9900,targetAltitudeFt:10000,vsFpm:1450});
 for(let i=0;i<25;i++){
  plan=Capture.advance(plan,.1);
  r=FCC.evaluate(fcc,m,{...s,altitudeFt:plan.altitudeFt,vsFpm:plan.vsFpm,
   altitudeCapture:plan},{magneticVariationDeg:5});fcc=r.state;
  assert.equal(r.actions.some(x=>x.type==='VS'),false);
  assert.equal(r.actions.find(x=>x.type==='ALT_ACQ').value,10000);
  assert.equal(r.altitudeHoldConfirmed,false);
 }
 while(plan.phase!=='HELD')plan=Capture.advance(plan,Math.min(.5,plan.durationSec-plan.elapsedSec));
 r=FCC.evaluate(fcc,m,{...s,altitudeFt:10000,vsFpm:0,
  altitudeCapture:plan},{magneticVariationDeg:5});
 assert.equal(r.altitudeHoldConfirmed,true);
 assert.equal(r.actions.find(x=>x.type==='ALTITUDE').value,10000);
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

test('A/P disengagement stops stale MCP guidance while retaining current trim state',()=>{
 let s=frame({headingDeg:90,altitudeFt:6000,vsFpm:1300,bankDeg:12});
 s=Flight.command(s,{type:'HEADING',value:160});
 s=Flight.command(s,{type:'ALTITUDE',value:11000});
 const free=Flight.command(s,{type:'MANUAL_HOLD'});
 assert.equal(free.target.flightControlOwner,'MANUAL_TRIM_NO_AP');
 assert.equal(free.target.lateralMode,'BANK');
 assert.equal(free.target.bankCommandDeg,12);
 assert.equal(free.target.verticalMode,'VS');
 assert.equal(free.target.vsFpm,1300);
 assert.ok(free.target.altitudeFt===11000,'old selection retained for metadata only');
});

test('VS select response has command lag and cannot immediately teleport into commanded rate',()=>{
 let s=frame({vsFpm:0,pitchDeg:2}),m=mcp();
 const demand=2000,first=FCC.evaluate(FCC.createState(),m,s,{magneticVariationDeg:5});
 assert.equal(first.actions.find(x=>x.type==='VS').value,demand);
 const prev=s;
 s=Flight.command(s,{type:'VS',value:demand});
 s=Flight.step(s,.2);
 assert.ok(Math.abs(s.pitchDeg-prev.pitchDeg)<.2,'Pitch must start gradually, not jump');
 assert.ok(Math.abs(s.vsFpm-prev.vsFpm)<100,'V/S needle must not jump to MCP target');
 assert.ok(s.flightControl.commandedPitchDeg<first.pitchCommandDeg,'Pitch demand itself is filtered');
 for(let k=0;k<40;k++)s=Flight.step(s,.1);
 assert.ok(s.vsFpm<demand,'A/P has not instantly reached V/S target in four seconds');
 assert.ok(s.vsFpm>0,'Aircraft starts responding to the command');
});
