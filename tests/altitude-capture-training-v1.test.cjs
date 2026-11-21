'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Numeric=require('../engine/afds/mcp-fcom-ch4-numeric-v1.js');
globalThis.B737McpFCOMCh4NumericV1=Numeric;
const Capture=require('../engine/flight/altitude-capture-training-v1.js');
const Flight=require('../engine/flight/flight-scenario-core-v1.js');
const Guidance=require('../engine/afds/fcc-flight-guidance-v1.js');
const MCP=require('../engine/afds/mcp-mode-core-v1.js');
const FMA=require('../engine/afds/fma-mode-engine-v1.js');
const close=(a,b,tol=1e-6)=>assert.ok(Math.abs(a-b)<=tol,`${a} differs from ${b}`);
function mcpState(altitudeFt=7000){
 const m=MCP.initialState();
 m.electrical.mcpPower=true;
 m.modes.autopilot='CMD_A';m.modes.vertical='VS';
 m.fd.left=true;m.fd.right=true;
 m.values.altitude=altitudeFt;m.values.verticalSpeed=1800;
 return m;
}
function runCapture({vsFpm=1800,target=7000,gapFt=100,step=.1,changeAt=null}={}){
 const start=target-Math.sign(vsFpm)*gapFt;
 let scene=Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  altitudeFt:start,vsFpm,speedKt:218});
 let mcp=mcpState(target),fcc=Guidance.createState();
 const trace=[];let startAt=null,holdAt=null,cancelAt=null,cancelSample=null;
 for(let i=0;i<140;i++){
  const now=i*step;
  mcp.flight={...(mcp.flight||{}),verticalSpeedFpm:scene.vsFpm,
   altitudeFt:scene.altitudeFt};
  if(changeAt!==null&&cancelAt===null&&now>=changeAt){
   const exact=scene.vsFpm,alt=scene.altitudeFt;
   mcp=MCP.transition(mcp,{type:'VALUE',id:'altitude',value:target+100});
   cancelAt=now;cancelSample={exact,alt,selected:mcp.values.verticalSpeed,
    capture:mcp.capture.pitch,mode:mcp.modes.vertical};
  }
  const o=Guidance.evaluate(fcc,MCP.output(mcp),scene,{magneticVariationDeg:5});
  fcc=o.state;
  for(const action of o.actions){
   if(action.type==='ALT_ACQ'&&scene.target.verticalMode==='ALT_ACQ'&&
      scene.altitudeCapture?.phase==='ACQUIRE'&&
      scene.target.altitudeFt===action.value)continue;
   if(action.type==='HEADING'&&scene.target.headingDeg===action.value)continue;
   if(action.type==='VS'&&scene.target.verticalMode==='VS'&&
      scene.target.vsFpm===action.value)continue;
   if(action.type==='ALTITUDE'&&scene.target.verticalMode==='ALTITUDE'&&
      scene.target.altitudeFt===action.value)continue;
   scene=Flight.command(scene,action);
  }
  if(o.altAcquireConfirmed&&!['ALT_ACQ','ALT_HOLD'].includes(mcp.capture.pitch)){
   mcp=MCP.transition(mcp,{type:'FCC_ALTITUDE_CAPTURE',stage:'ACQUIRE',
    confirmed:true,source:'SIMULATED_FCC'});
   if(startAt===null)startAt=now;
  }
  if(o.altitudeHoldConfirmed&&mcp.capture.pitch!=='ALT_HOLD'){
   mcp=MCP.transition(mcp,{type:'FCC_ALTITUDE_CAPTURE',stage:'HOLD',
    confirmed:true,source:'SIMULATED_FCC'});
   if(holdAt===null)holdAt=now;
  }
  trace.push({time:now,vs:scene.vsFpm,alt:scene.altitudeFt,
   mode:MCP.output(mcp).capture.pitch,fma:FMA.fromMcp(MCP.output(mcp),'CAPT').pitch.active,
   altTarget:scene.target.verticalMode});
  scene=Flight.step(scene,step);
  if(holdAt!==null&&now>holdAt+1)break;
  if(cancelAt!==null&&now>cancelAt+2)break;
 }
 return {scene,mcp,trace,startAt,holdAt,cancelAt,cancelSample};
}
test('acquisition window is determined by actual VS and distance in both directions',()=>{
 const a=Capture.opportunity({altitudeFt:6800,targetAltitudeFt:7000,vsFpm:1800});
 assert.equal(a.acquire,false,'200ft is too far away at 1800fpm');
 const b=Capture.opportunity({altitudeFt:6880,targetAltitudeFt:7000,vsFpm:1800});
 assert.equal(b.acquire,true,'120ft permits a roughly 8s linear capture');
 assert.equal(b.distanceNeededFt,135);
 assert.equal(Capture.opportunity({altitudeFt:7120,targetAltitudeFt:7000,vsFpm:-1800}).acquire,true);
 assert.equal(Capture.opportunity({altitudeFt:6880,targetAltitudeFt:7000,vsFpm:-1800}).acquire,false);
 assert.equal(Capture.opportunity({altitudeFt:6880,targetAltitudeFt:7000,vsFpm:1800,
  elapsedSec:5,inhibitUntilSec:6}).acquire,false);
});
test('one constant-rate capture reaches exact MCP altitude and zero VS within 9 simulation seconds',()=>{
 for(const vsFpm of [850,1800,3200,-1500,-4200]){
  const start=7000-Math.sign(vsFpm)*Math.abs(vsFpm)*8/120;
  let p=Capture.begin({altitudeFt:start,targetAltitudeFt:7000,vsFpm});
  assert.ok(p.durationSec<=9);
  close(p.durationSec,8);
  let prior=p.vsFpm,priorDelta=null;
  for(let t=0;t<80;t++){
   p=Capture.advance(p,.1);
   const delta=p.vsFpm-prior;
   if(priorDelta!==null)close(delta,priorDelta,1e-7);
   priorDelta=delta;prior=p.vsFpm;
  }
  assert.equal(p.phase,'HELD');
  close(p.altitudeFt,7000,1e-6);close(p.vsFpm,0);
 }
});
test('FCC, flight plant, MCP and FMA agree from ALT ACQ to ALT HOLD within 10 s',()=>{
 for(const vsFpm of [1800,-1800,3500,-3500]){
  const target=7000,gapFt=Math.abs(vsFpm)*3.7/60;
  const r=runCapture({vsFpm,target,gapFt});
  assert.notEqual(r.startAt,null,`capture should start for ${vsFpm}`);
  assert.notEqual(r.holdAt,null,`hold should finish for ${vsFpm}`);
  assert.ok(r.holdAt-r.startAt<=10,`capture duration ${r.holdAt-r.startAt}s`);
  assert.equal(r.mcp.capture.pitch,'ALT_HOLD');
  assert.equal(r.mcp.modes.vertical,'ALT_HLD');
  assert.ok(r.trace.some(x=>x.fma==='ALT ACQ'));
  assert.ok(r.trace.some(x=>x.fma==='ALT HOLD'));
  assert.ok(Math.abs(r.scene.altitudeFt-target)<3);
  assert.ok(Math.abs(r.scene.vsFpm)<40);
 }
});
test('first 100ft MCP detent cancels ALT ACQ and keeps instantaneous VS',()=>{
 const r=runCapture({vsFpm:1800,gapFt:110,changeAt:2.1});
 assert.notEqual(r.cancelAt,null);
 assert.equal(r.cancelSample.capture,null);
 assert.equal(r.cancelSample.mode,'VS');
 assert.ok(Math.abs(r.cancelSample.selected-r.cancelSample.exact)<=60,
  'Selected VS detent reflects actual rate, not pre-capture 1800fpm');
 assert.equal(r.mcp.capture.pitch,null);
 assert.equal(r.mcp.modes.vertical,'VS');
 assert.equal(r.scene.target.verticalMode,'VS');
 assert.equal(r.mcp.values.altitude,7100);
 assert.equal(r.trace.at(-1).fma,'V/S');
 assert.ok(Math.abs(r.trace.at(-1).vs-r.cancelSample.exact)<500,
  'Rate continuity is maintained after changing MCP altitude');
 assert.ok(r.holdAt===null,'must not auto-engage ALT HOLD after cancelling capture');
});
test('MCP change below 100ft still cancels when the selector value actually changes',()=>{
 let m=mcpState(7000);
 m.capture.pitch='ALT_ACQ';m.flight={verticalSpeedFpm:-1473,altitudeFt:7230};
 m=MCP.transition(m,{type:'VALUE',id:'altitude',value:7100});
 assert.equal(m.capture.pitch,null);
 assert.equal(m.modes.vertical,'VS');
 assert.equal(m.values.verticalSpeed,Numeric.normalize('verticalSpeed',-1473));
 assert.equal(FMA.fromMcp(MCP.output(m),'FO').pitch.active,'V/S');
});
