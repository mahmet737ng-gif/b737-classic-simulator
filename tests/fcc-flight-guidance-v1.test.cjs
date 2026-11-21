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
const evaluateMag=(state,mcp,frame,nav={magneticVariationDeg:5})=>
 Guidance.evaluate(state,mcp,frame,nav);
function frame(){
 return Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  speedKt:210,altitudeFt:8000,headingDeg:85,vsFpm:0});
}
test('CMD HDG SEL magnetic 134 commands true 139 with 5deg east variation and both FD commands',()=>{
 const m=mcp(),f=frame();
 const o=evaluateMag(Guidance.createState(),m,f);
 assert.equal(o.status,'COUPLED_CMD');
 assert.equal(o.fd.captain,true);assert.equal(o.fd.firstOfficer,true);
 assert.ok(o.actions.some(a=>a.type==='HEADING'&&a.value===139));
 assert.ok(o.actions.some(a=>a.type==='VS'&&a.value===2000));
 assert.ok(o.actions.some(a=>a.type==='BANK_LIMIT'&&a.value===20));
 assert.ok(o.rollCommandDeg>0);
 assert.ok(o.pitchCommandDeg>f.pitchDeg);
});
test('FD bars are independently gated by each mode, with CMD training guidance active',()=>{
 const m=mcp();m.controls.fd.right=false;
 let o=evaluateMag(Guidance.createState(),m,frame());
 assert.equal(o.fd.captain,true);assert.equal(o.fd.firstOfficer,true,
  'CMD training guidance stays available when one FD selector is off');
 m.modes.lateral='LNAV';
 o=evaluateMag(Guidance.createState(),m,frame());
 assert.equal(o.fd.captain,true);
 assert.deepEqual(o.fdAxes.captain,{pitch:true,roll:false});
 assert.ok(o.reasons.includes('LNAV_ACTIVE_LEG_TRACK_NOT_VERIFIED'));
 m.modes.lateral='HDG_SEL';m.flightDirectorBarsRetracted=true;
 o=evaluateMag(Guidance.createState(),m,frame());
 assert.equal(o.fd.captain,false);
});
test('HDG bank command honors selected MCP bank angle limit',()=>{
 const m=mcp();m.bankAngleLimit=10;const o=evaluateMag(Guidance.createState(),m,frame());
 assert.equal(o.rollCommandDeg,10);
});
test('ALT HOLD captures actual altitude on engagement, not MCP altitude window',()=>{
 const m=mcp(),f=frame();m.modes.vertical='ALT_HLD';
 let o=evaluateMag(Guidance.createState(),m,f);
 assert.equal(o.actions.find(a=>a.type==='ALTITUDE').value,f.altitudeFt);
 const future={...f,altitudeFt:f.altitudeFt+300};
 o=evaluateMag(o.state,m,future);
 assert.equal(o.actions.find(a=>a.type==='ALTITUDE').value,f.altitudeFt);
});
test('V/S acquires based on actual rate and height, and ALT HOLD waits for ramp completion',()=>{
 const m=mcp();let f=frame();
 let o=evaluateMag(Guidance.createState(),m,f);
 assert.equal(o.altAcquireConfirmed,false);
 assert.ok(!o.actions.some(a=>a.type==='ALT_ACQ'));
 f={...f,altitudeFt:9800,vsFpm:1850};
 o=evaluateMag(o.state,m,f);
 assert.equal(o.altAcquireConfirmed,false,'200 ft is beyond the deceleration distance');
 f={...f,altitudeFt:9890,vsFpm:1850,elapsedSec:2};
 o=evaluateMag(o.state,m,f);
 assert.equal(o.altAcquireConfirmed,true);
 assert.ok(o.actions.some(a=>a.type==='ALT_ACQ'&&a.value===10000));
 const Capture=require('../engine/flight/altitude-capture-training-v1.js');
 let plan=Capture.begin({altitudeFt:f.altitudeFt,targetAltitudeFt:10000,vsFpm:f.vsFpm});
 while(plan.phase!=='HELD')plan=Capture.advance(plan,Math.min(1,plan.durationSec-plan.elapsedSec));
 m.capture.pitch='ALT_ACQ';
 f={...f,altitudeCapture:plan,
  altitudeFt:10000,vsFpm:0,elapsedSec:2+plan.durationSec};
 o=evaluateMag(o.state,m,f);
 assert.equal(o.altitudeHoldConfirmed,true);
 assert.ok(o.actions.some(a=>a.type==='ALTITUDE'&&a.value===10000));
});
test('F/D-only command modes show bars but never command flight actuators',()=>{
 const m=mcp();m.modes.autopilot=null;
 const o=evaluateMag(Guidance.createState(),m,frame());
 assert.equal(o.fd.captain,true);assert.equal(o.fd.firstOfficer,true);
 assert.equal(o.actions.length,0);
});
test('CWS does not fabricate a new HDG SEL pitch/roll command and retracts FD bars',()=>{
 const m=mcp();m.modes.autopilot='CWS_A';m.axisControl={pitch:'CWS',roll:'CWS'};
 const o=evaluateMag(Guidance.createState(),m,frame());
 assert.equal(o.fd.captain,false);
 assert.equal(o.actions.find(a=>a.type==='HEADING').value,frame().trueHeadingDeg);
 assert.equal(o.actions.find(a=>a.type==='ALTITUDE').value,frame().altitudeFt);
});
test('LVL CHG creates pitch/speed guidance; VNAV lacks invented profile',()=>{
 const m=mcp();m.modes.vertical='LVL_CHG';
 let o=evaluateMag(Guidance.createState(),m,frame());
 assert.ok(o.actions.some(a=>a.type==='SPEED'&&a.value===241));
 assert.ok(o.actions.some(a=>a.type==='VS'));
 m.modes.vertical='VNAV';
 o=evaluateMag(Guidance.createState(),m,frame());
 assert.equal(o.pitchValid,false);
 assert.ok(o.reasons.includes('VNAV_FMC_VERTICAL_PROFILE_UNVERIFIED'));
});

test('HDG SEL without a valid magnetic variation cannot quietly treat MAG as TRUE',()=>{
 const o=Guidance.evaluate(Guidance.createState(),mcp(),frame(),{magneticVariationDeg:null});
 assert.equal(o.rollValid,false);
 assert.equal(o.fd.captain,true);
 assert.deepEqual(o.fdAxes.captain,{pitch:true,roll:false});
 assert.ok(o.reasons.includes('HDG_SEL_MAGNETIC_VARIATION_UNAVAILABLE'));
 assert.ok(!o.actions.some(a=>a.type==='HEADING'));
});
test('west/east variation changes true MCP target but displayed magnetic bug is unchanged',()=>{
 const west=evaluateMag(Guidance.createState(),mcp(),frame(),{magneticVariationDeg:-7});
 const east=evaluateMag(Guidance.createState(),mcp(),frame(),{magneticVariationDeg:5});
 assert.equal(west.actions.find(a=>a.type==='HEADING').value,127);
 assert.equal(east.actions.find(a=>a.type==='HEADING').value,139);
 assert.equal(mcp().values.heading,134);
});

test('CWS R keeps pitch bar only; CWS P keeps roll bar only; blank axes stay blank',()=>{
 const m=mcp(),f=frame();
 m.axisControl={pitch:'CMD',roll:'CWS'};
 let o=evaluateMag(Guidance.createState(),m,f);
 assert.deepEqual(o.fdAxes.captain,{pitch:true,roll:false});
 m.axisControl={pitch:'CWS',roll:'CMD'};
 o=evaluateMag(Guidance.createState(),m,f);
 assert.deepEqual(o.fdAxes.captain,{pitch:false,roll:true});
 m.axisControl={pitch:'CMD',roll:'CMD'};
 m.modes.vertical=null;m.modes.lateral='HDG_SEL';
 o=evaluateMag(Guidance.createState(),m,f);
 assert.deepEqual(o.fdAxes.captain,{pitch:false,roll:true});
 m.modes.lateral=null;
 o=evaluateMag(Guidance.createState(),m,f);
 assert.deepEqual(o.fdAxes.captain,{pitch:false,roll:false});
 m.modes.vertical='VS';
 o=evaluateMag(Guidance.createState(),m,f);
 assert.deepEqual(o.fdAxes.captain,{pitch:true,roll:false});
 m.controls.fd.left=false;
 o=evaluateMag(Guidance.createState(),m,f);
 assert.deepEqual(o.fdAxes.captain,{pitch:true,roll:false});
 assert.deepEqual(o.fdAxes.firstOfficer,{pitch:true,roll:false});
 // Without an engaged CMD A/P, the individual physical switches own the bars.
 m.modes.autopilot=null;
 o=evaluateMag(Guidance.createState(),m,f);
 assert.deepEqual(o.fdAxes.captain,{pitch:false,roll:false});
 assert.deepEqual(o.fdAxes.firstOfficer,{pitch:true,roll:false});
});

test('screenshot case: V/S plus CWS R with CMD selected produces pitch bar only for both seats',()=>{
 const m=mcp();
 m.axisControl={pitch:'CMD',roll:'CWS'};
 m.modes.lateral=null;
 m.controls.fd.left=false;m.controls.fd.right=false;
 const s=evaluateMag(Guidance.createState(),m,frame());
 assert.deepEqual(s.fdAxes.captain,{pitch:true,roll:false});
 assert.deepEqual(s.fdAxes.firstOfficer,{pitch:true,roll:false});
 assert.equal(s.pitchValid,true);
 assert.equal(s.rollCommandDeg,0);
 assert.equal(s.rollValid,true);
 assert.equal(s.status,'COUPLED_CMD');
});
