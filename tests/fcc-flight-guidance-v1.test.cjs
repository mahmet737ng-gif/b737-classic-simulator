'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Guidance=require('../engine/afds/fcc-flight-guidance-v1.js');
const Flight=require('../engine/flight/flight-scenario-core-v1.js');
function mcp(){
 return {power:true,values:{heading:134,altitude:10000,verticalSpeed:2000,speed:241},
  controls:{fd:{left:true,right:true}},flightDirectorBarsRetracted:false,
  modes:{autopilot:'CMD_A',lateral:'HDG_SEL',vertical:'VS',thrust:'SPEED'},
  axisControl:{pitch:'CMD',roll:'CMD'},bankAngleLimit:20,
  speedDisplayMode:'IAS',nav:{loc:false,gs:false},capture:{pitch:null,roll:null}};
}
function frame(){
 return Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  speedKt:210,altitudeFt:8000,headingDeg:85,vsFpm:0});
}
test('CMD HDG SEL/V/S sends real flight targets and both FD commands',()=>{
 const m=mcp(),f=frame();
 const o=Guidance.evaluate(Guidance.createState(),m,f);
 assert.equal(o.status,'COUPLED_CMD');
 assert.equal(o.fd.captain,true);assert.equal(o.fd.firstOfficer,true);
 assert.ok(o.actions.some(a=>a.type==='HEADING'&&a.value===134));
 assert.ok(o.actions.some(a=>a.type==='VS'&&a.value===2000));
 assert.ok(o.actions.some(a=>a.type==='BANK_LIMIT'&&a.value===20));
 assert.ok(o.rollCommandDeg>0);
 assert.ok(o.pitchCommandDeg>f.pitchDeg);
});
test('FD bars require BOTH valid command axes and pilot-side FD switch',()=>{
 const m=mcp();m.controls.fd.right=false;
 let o=Guidance.evaluate(Guidance.createState(),m,frame());
 assert.equal(o.fd.captain,true);assert.equal(o.fd.firstOfficer,false);
 m.modes.lateral='LNAV';
 o=Guidance.evaluate(Guidance.createState(),m,frame());
 assert.equal(o.fd.captain,false);
 assert.ok(o.reasons.includes('LNAV_ACTIVE_LEG_TRACK_NOT_VERIFIED'));
 m.modes.lateral='HDG_SEL';m.flightDirectorBarsRetracted=true;
 o=Guidance.evaluate(Guidance.createState(),m,frame());
 assert.equal(o.fd.captain,false);
});
test('HDG bank command honors selected MCP bank angle limit',()=>{
 const m=mcp();m.bankAngleLimit=10;const o=Guidance.evaluate(Guidance.createState(),m,frame());
 assert.equal(o.rollCommandDeg,10);
});
test('ALT HOLD captures actual altitude on engagement, not MCP altitude window',()=>{
 const m=mcp(),f=frame();m.modes.vertical='ALT_HLD';
 let o=Guidance.evaluate(Guidance.createState(),m,f);
 assert.equal(o.actions.find(a=>a.type==='ALTITUDE').value,f.altitudeFt);
 const future={...f,altitudeFt:f.altitudeFt+300};
 o=Guidance.evaluate(o.state,m,future);
 assert.equal(o.actions.find(a=>a.type==='ALTITUDE').value,f.altitudeFt);
});
test('V/S captures selected altitude only near threshold, not immediately',()=>{
 const m=mcp();let f=frame();
 let o=Guidance.evaluate(Guidance.createState(),m,f);
 assert.equal(o.altAcquireConfirmed,false);
 assert.ok(!o.actions.some(a=>a.type==='ALTITUDE'));
 f={...f,altitudeFt:9820,vsFpm:1850};
 o=Guidance.evaluate(o.state,m,f);
 assert.equal(o.altAcquireConfirmed,true);
 assert.ok(o.actions.some(a=>a.type==='ALTITUDE'&&a.value===10000));
 f={...f,altitudeFt:9995,vsFpm:200};
 o=Guidance.evaluate(o.state,m,f);
 assert.equal(o.altitudeHoldConfirmed,true);
});
test('F/D-only command modes show bars but never command flight actuators',()=>{
 const m=mcp();m.modes.autopilot=null;
 const o=Guidance.evaluate(Guidance.createState(),m,frame());
 assert.equal(o.fd.captain,true);assert.equal(o.fd.firstOfficer,true);
 assert.equal(o.actions.length,0);
});
test('CWS does not fabricate a new HDG SEL pitch/roll command and retracts FD bars',()=>{
 const m=mcp();m.modes.autopilot='CWS_A';m.axisControl={pitch:'CWS',roll:'CWS'};
 const o=Guidance.evaluate(Guidance.createState(),m,frame());
 assert.equal(o.fd.captain,false);
 assert.equal(o.actions.find(a=>a.type==='HEADING').value,frame().trueHeadingDeg);
 assert.equal(o.actions.find(a=>a.type==='ALTITUDE').value,frame().altitudeFt);
});
test('LVL CHG creates pitch/speed guidance; VNAV lacks invented profile',()=>{
 const m=mcp();m.modes.vertical='LVL_CHG';
 let o=Guidance.evaluate(Guidance.createState(),m,frame());
 assert.ok(o.actions.some(a=>a.type==='SPEED'&&a.value===241));
 assert.ok(o.actions.some(a=>a.type==='VS'));
 m.modes.vertical='VNAV';
 o=Guidance.evaluate(Guidance.createState(),m,frame());
 assert.equal(o.pitchValid,false);
 assert.ok(o.reasons.includes('VNAV_FMC_VERTICAL_PROFILE_UNVERIFIED'));
});
