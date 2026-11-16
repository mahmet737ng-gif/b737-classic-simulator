'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Guidance=require('../engine/afds/fcc-flight-guidance-v1.js');
const Protection=require('../engine/afds/fcom-ch4-ap-protection-v1.js');
const Flight=require('../engine/flight/flight-scenario-core-v1.js');
const source=fs.readFileSync(path.resolve(__dirname,'../panel-mosaic-lab/cockpit/fcc-flight-runtime-v1.js'),'utf8');
function boot(){
 const callbacks={},published=[];let currentMs=100;
 const scenario=Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  altitudeFt:6000,speedKt:220,headingDeg:85,vsFpm:0});
 const modes={power:true,controls:{fd:{left:true,right:true}},modes:{autopilot:'CMD_A',
  vertical:'VS',lateral:'HDG_SEL'},axisControl:{pitch:'CMD',roll:'CMD'},
  values:{speed:220,heading:134,altitude:10000,verticalSpeed:2000},bankAngleLimit:20,
  speedDisplayMode:'IAS',capture:{pitch:null,roll:null}};
 const net={connectExternal:()=>({publish:(topic,value)=>published.push({topic,value,ms:currentMs})}),
  getSignal:()=>null};
 const win={document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},
  B737FccFlightGuidanceV1:Guidance,B737FcomCh4APProtectionV1:Protection,
  B737WMM2025V1:{evaluate:()=>({valid:true,declinationDeg:5})},
  B737UnifiedFlightScenarioV1:{getDiagnostics:()=>({active:true}),
   getState:()=>scenario},
  B737McpAFDSBridgeV1:{getOutput:()=>modes},B737UnifiedAvionicsNetworkV1:net,
  addEventListener:(k,fn)=>callbacks[k]=fn,setInterval(){return 1;},
  dispatchEvent(){},console:{error(){},warn(){}}};
 class CustomEvent{constructor(type,opt){this.type=type;this.detail=opt.detail;}}
 vm.runInNewContext(source,{window:win,CustomEvent,performance:{now:()=>currentMs}});
 const paint=()=>callbacks['b737:flight-scenario-state']({detail:scenario});
 return {paint,published,advance:ms=>{currentMs+=ms;paint();},
  get:(suffix,offset=0)=>published.filter(x=>x.topic==='afds.director'+suffix).at(-1-offset)?.value,
  scenario};
}
test('the first FD bar command starts at the actual attitude then rate-limits toward FCC demand',()=>{
 const r=boot();r.paint();const a=r.get(1);
 assert.equal(a.enabled,true);
 assert.equal(a.pitchDeg,r.scenario.pitchDeg);
 assert.equal(a.rollDeg,r.scenario.bankDeg);
 r.advance(250);const b=r.get(1);
 assert.ok(b.pitchDeg>a.pitchDeg&&b.pitchDeg-a.pitchDeg<=2.2*.25+1e-8);
 assert.ok(b.rollDeg>a.rollDeg&&b.rollDeg-a.rollDeg<=5.2*.25+1e-8);
 assert.equal(r.get(2).pitchDeg,b.pitchDeg);
 assert.equal(r.get(2).rollDeg,b.rollDeg);
});
test('after many frames FD demand converges on the same FCC pitch and bank limits',()=>{
 const r=boot();r.paint();for(let i=0;i<80;i++)r.advance(250);
 const v=r.get(1);
 assert.ok(v.pitchDeg>6&&v.pitchDeg<8);
 assert.equal(v.rollDeg,20);
});
