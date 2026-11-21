'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Guidance=require('../engine/afds/fcc-flight-guidance-v1.js');
const Protection=require('../engine/afds/fcom-ch4-ap-protection-v1.js');
const Flight=require('../engine/flight/flight-scenario-core-v1.js');
const source=fs.readFileSync(path.resolve(__dirname,
 '../panel-mosaic-lab/cockpit/fcc-flight-runtime-v1.js'),'utf8');
function boot({lateNetwork=false,throwNetwork=false}={}){
 let now=100;const callbacks={},published=[];
 const scene=Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  speedKt:139,headingDeg:135,altitudeFt:6860,vsFpm:0});
 const mcp={power:true,controls:{fd:{left:false,right:false}},
  modes:{autopilot:'CMD_A',vertical:'VS',lateral:null},
  values:{verticalSpeed:1000,altitude:10000,heading:90,speed:139},
  capture:{pitch:null,roll:null},axisControl:{pitch:'CMD',roll:'CWS'},bankAngleLimit:20};
 let ready=!lateNetwork;
 const net={connectExternal:()=>{
  if(throwNetwork)throw Error('TRANSIENT_NETWORK_PUBLISH_FAILED');
  return ready?{publish:(topic,value)=>published.push({topic,value})}:null;
 }};
 const win={document:{getElementById(){return null;}},
  B737FccFlightGuidanceV1:Guidance,
  B737FcomCh4APProtectionV1:Protection,
  B737WMM2025V1:{evaluate:()=>({valid:true,declinationDeg:5})},
  B737UnifiedFlightScenarioV1:{getDiagnostics:()=>({active:true}),getState:()=>scene},
  B737McpAFDSBridgeV1:{getOutput:()=>mcp},
  B737UnifiedAvionicsNetworkV1:net,
  addEventListener:(type,fn)=>{callbacks[type]=fn;},
  dispatchEvent(){},setInterval(){},console:{warn(){},error(){}}};
 class CustomEvent{constructor(type,data){this.type=type;this.detail=data?.detail;}}
 vm.runInNewContext(source,{window:win,CustomEvent,performance:{now:()=>now}});
 const tick=()=>callbacks['b737:flight-scenario-state']({detail:scene});
 return {win,mcp,published,tick,ready:()=>{ready=true;},advance:ms=>{now+=ms;tick();},
  stop:()=>callbacks['b737:flight-scenario-stopped']({detail:{}})};
}
test('screenshotted CMD / V/S / CWS R supplies pitch cue but no roll cue with FD selectors off',()=>{
 const t=boot();t.tick();
 for(const seat of ['CAPT','FO']){
  const out=t.win.B737UnifiedFccFlightV1.getDirector(seat);
  assert.equal(out.enabled,true);
  assert.ok(Number.isFinite(out.pitchDeg),'pitch cue present');
  assert.equal(out.rollDeg,null,'CWS R blank roll bar');
 }
 assert.equal(t.published.length,2);
 const f=t.win.B737UnifiedFccFlightV1.getState();
 assert.equal(f.last.fdAxes.captain.pitch,true);
 assert.equal(f.last.fdAxes.captain.roll,false);
 t.stop();
 assert.equal(t.win.B737UnifiedFccFlightV1.getDirector('CAPT'),null);
});
test('EADI obtains identical active FCC director when the Avionics publisher loads late',()=>{
 const t=boot({lateNetwork:true});t.tick();
 assert.equal(t.published.length,0);
 assert.ok(Number.isFinite(t.win.B737UnifiedFccFlightV1.getDirector('CAPT').pitchDeg));
 t.ready();t.advance(250);
 assert.equal(t.published.length,2,'avionics comes online without reloading cockpit');
 const local=t.win.B737UnifiedFccFlightV1.getDirector('CAPT');
 assert.equal(local.pitchDeg,t.published[0].value.pitchDeg);
 assert.equal(local.rollDeg,t.published[0].value.rollDeg);
});
test('publisher throwing never removes live pitch command bars or corrupts FMA source',()=>{
 const t=boot({throwNetwork:true});t.tick();t.advance(250);
 assert.equal(t.published.length,0);
 const out=t.win.B737UnifiedFccFlightV1.getDirector('CAPT');
 assert.equal(out.enabled,true);
 assert.ok(Number.isFinite(out.pitchDeg));
 assert.equal(out.rollDeg,null);
 assert.equal(t.win.B737UnifiedFccFlightV1.getState().last.status,'COUPLED_CMD');
});
test('EADI painter is subscribed to scene frames and accepts the same FCC per-seat cue',()=>{
 const src=fs.readFileSync(path.resolve(__dirname,
  '../panel-mosaic-lab/cockpit/eadi-lab-unified-v2.js'),'utf8');
 assert.match(src,/getDirector\?\.\(seat\)/);
 assert.match(src,/director:|\bdirector,tcas:/);
 assert.match(src,/b737:flight-scenario-state/);
 assert.match(src,/fdPitchBar/);
 assert.match(src,/fdRollBar/);
});
