'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const Core=require('../engine/flight/flight-scenario-core-v1.js');
const source=fs.readFileSync(path.resolve(__dirname,
 '../panel-mosaic-lab/cockpit/flight-scenario-panel-v1.js'),'utf8');
function boot(){
 const status={textContent:'',dataset:{}},pause={textContent:'PAUSE'},stop={disabled:false};
 const document={readyState:'loading',addEventListener(){},
  getElementById:id=>id==='flightScenarioStatus'?status:
   id==='flightPause'?pause:id==='flightStop'?stop:null};
 let stoppedMotion=0,stoppedEvent=0;
 const win={document,B737FlightScenarioCoreV1:Core,console:{error(){},warn(){}},
  setInterval:()=>1,dispatchEvent:e=>{if(e.type==='b737:flight-scenario-stopped')stoppedEvent++;},
  B737IRSTrainerUnified:{stopMotion:()=>stoppedMotion++},
  B737ISNCockpitV1:{setFlightScenarioContext(){} }};
 class CustomEvent{constructor(type,options={}){this.type=type;this.detail=options.detail;}}
 vm.runInNewContext(source,{window:win,CustomEvent,console:{error(){},warn(){}}});
 return {api:win.B737UnifiedFlightScenarioV1,status,pause,stop,
  get stoppedMotion(){return stoppedMotion},get stoppedEvent(){return stoppedEvent}};
}
test('STOP FEED is blocked while airborne and does not withdraw IRS/ADC/RA sources',()=>{
 const x=boot();
 x.api.loadScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  altitudeFt:6705,speedKt:231,headingDeg:140,vsFpm:0});
 assert.equal(x.api.getDiagnostics().active,true);
 assert.equal(x.api.getDiagnostics().airborne,true);
 assert.equal(x.api.stop(),false);
 assert.equal(x.api.getDiagnostics().active,true);
 assert.equal(x.stoppedMotion,0);
 assert.equal(x.stoppedEvent,0);
 assert.match(x.status.textContent,/STOP FEED BLOCKED WHILE AIRBORNE/);
});
test('STOP FEED remains available on ground and clears the scenario normally',()=>{
 const x=boot();
 x.api.loadScenario({airport:'OIII',preset:'RUNWAY_READY',airborne:false});
 assert.equal(x.api.stop(),true);
 assert.equal(x.api.getDiagnostics().active,false);
 assert.equal(x.stoppedMotion,1);
 assert.equal(x.stoppedEvent,1);
});
