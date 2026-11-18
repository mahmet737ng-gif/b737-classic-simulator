'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const TCAS=require('../engine/tcas/classic-tcas-v1.js');
const own={airborne:true,altitudeFt:9000,radioAltitudeFt:6000,tasKt:220,pitchDeg:2,vsFpm:0,trueHeadingDeg:90,trueTrackDeg:90,elapsedSec:0};
const run=(scenario,t=20,changes={},extra={})=>TCAS.evaluate({scenario,elapsedSec:t,own:{...own,...changes},...extra});
test('script presents TA before initial RA, then strengthens, reverses or weakens',()=>{
 assert.equal(run('CLIMB',4).advisory,'TA');assert.equal(run('CLIMB',19).ra.id,'CLIMB');
 assert.equal(run('CLIMB',26).ra.id,'LEVEL_OFF_CLIMB');
 assert.equal(run('REVERSAL_CLIMB',19).ra.id,'DESCEND');
 assert.equal(run('REVERSAL_CLIMB',26).ra.id,'REVERSAL_CLIMB');
 assert.equal(run('REVERSAL_DESCEND',26).ra.id,'REVERSAL_DESCEND');
 assert.equal(run('INCREASE_CLIMB',26).ra.min,2500);
 assert.equal(run('INCREASE_DESCENT',26).ra.max,-2500);
});
test('RA and voice inhibits honor exact nominal FCOM boundaries',()=>{
 for(const h of [0,499,500,999])assert.equal(run('CLIMB',20,{radioAltitudeFt:h}).ra,null);
 assert.equal(run('CLIMB',20,{radioAltitudeFt:999}).mode,'TA_ONLY');
 assert.equal(run('CLIMB',20,{radioAltitudeFt:1000}).advisory,'RA');
 assert.equal(run('DESCEND',15,{radioAltitudeFt:1099}).ra,null);
 assert.equal(run('DESCEND',15,{radioAltitudeFt:1100}).ra.id,'DESCEND');
 assert.equal(run('INCREASE_DESCENT',24,{radioAltitudeFt:1499}).ra.id,'DESCEND');
 assert.equal(run('INCREASE_DESCENT',24,{radioAltitudeFt:1500}).ra.id,'INCREASE_DESCENT');
 assert.equal(run('TA_ONLY',5,{radioAltitudeFt:499}).voiceAllowed,false);
 assert.equal(run('TA_ONLY',5,{radioAltitudeFt:500}).voiceAllowed,true);
 assert.equal(run('CLIMB',20,{}, {mode:'TA_ONLY'}).ra,null);
 assert.equal(run('CLIMB',20,{}, {priorityWarning:true}).advisory,null);
 assert.equal(run('CLIMB',20,{}, {priorityWarning:true}).voiceAllowed,false);
 assert.equal(run('CLIMB',20,{airborne:false}).targets.length,0);
 assert.equal(run('CLIMB',20,{radioAltitudeFt:null}).ra,null);
});
test('SL thresholds vary by radio height and pressure altitude instead of universal 40/25 seconds',()=>{
 assert.equal(TCAS.thresholds({...own,radioAltitudeFt:2000}).taSec,25);
 assert.equal(TCAS.thresholds(own).taSec,40);assert.equal(TCAS.thresholds(own,'TA_ONLY').sl,2);
 assert.equal(TCAS.thresholds({...own,altitudeFt:15000}).raSec,30);
 assert.equal(TCAS.thresholds({...own,altitudeFt:30000}).raSec,35);
});
test('red avoid pitch regions have correct sense, TAS conversion and double-sided corridor',()=>{
 const climb=TCAS.guidance('CLIMB',own),desc=TCAS.guidance('DESCEND',own);
 assert.equal(climb.avoid[0].side,'BELOW');assert.ok(climb.avoid[0].pitchDeg>own.pitchDeg);
 assert.equal(desc.avoid[0].side,'ABOVE');assert.ok(desc.avoid[0].pitchDeg<own.pitchDeg);
 assert.equal(TCAS.guidance('MULTI_LEVEL',own).avoid.length,2);
 assert.equal(TCAS.guidance('LEVEL_OFF_CLIMB',own).avoid[0].pitchDeg,2);
 assert.ok(TCAS.guidance('CLIMB',{...own,tasKt:440}).avoid[0].pitchDeg<climb.avoid[0].pitchDeg);
});
test('maintain requires an existing rate, missing altitude cannot produce RA, bearing remains unknown',()=>{
 assert.equal(run('MAINTAIN_CLIMB').ra.id,'CLIMB');
 assert.equal(run('MAINTAIN_CLIMB',20,{vsFpm:2000}).ra.id,'MAINTAIN_CLIMB');
 assert.equal(run('NO_ALTITUDE').ra,null);assert.equal(run('NO_ALTITUDE',20,{altitudeFt:15500}).advisory,null);assert.equal(run('NO_ALTITUDE').targets[0].relativeAltitude,null);
 assert.equal(run('NO_BEARING').targets[0].bearing,null);
 assert.ok(run('OFFSCALE').targets[0].distance>40);
});
test('every defined encounter terminates and never mutates the aircraft or generates a nonfinite cue',()=>{
 const input=Object.freeze({...own});
 for(const scenario of Object.keys(TCAS.SCENARIOS)){
  for(let t=0;t<60;t++){
   const out=TCAS.evaluate({scenario,elapsedSec:t,own:input});
   for(const z of out.ra?.avoid||[])assert.ok(Number.isFinite(z.pitchDeg));
   if(t===59){assert.equal(out.complete,true);assert.equal(out.targets.length,0);assert.equal(out.ra,null);}
  }
 }
 assert.equal(input.vsFpm,0);assert.equal(input.altitudeFt,9000);
});
function runtime(){
 const events=new Map();let state={...own},flightActive=true,age=0;
 const win={document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},B737ClassicTcasV1:TCAS,
  B737UnifiedFlightScenarioV1:{getDiagnostics:()=>({active:flightActive,lastPublishAgeMs:age}),getState:()=>state,
   command(){throw Error('TCAS MUST NEVER COMMAND FLIGHT');}},
  addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);},
  dispatchEvent(event){for(const f of events.get(event.type)||[])f(event);}};
 class CustomEvent{constructor(type,opt={}){this.type=type;this.detail=opt.detail;}}
 vm.runInNewContext(fs.readFileSync('panel-mosaic-lab/cockpit/tcas-training-unified-v1.js','utf8'),{window:win,CustomEvent});
 const api=win.B737UnifiedTcasV1;
 return {api,setAge(value){age=value;},advance(t){state={...state,elapsedSec:t};win.dispatchEvent(new CustomEvent('b737:flight-scenario-state',{detail:state}));},
  stopFlight(){flightActive=false;win.dispatchEvent(new CustomEvent('b737:flight-scenario-stopped'));}};
}
test('runtime follows flight time / pause, next event, source stop and mode changes',()=>{
 const f=runtime();f.api.start('REVERSAL_CLIMB');
 f.advance(5);assert.equal(f.api.getState().advisory,'TA');
 f.advance(5);assert.equal(f.api.getDiagnostics().elapsedSec,5);
 f.api.next();assert.equal(f.api.getState().ra.id,'DESCEND');
 f.api.next();assert.equal(f.api.getState().ra.id,'REVERSAL_CLIMB');
 f.api.setMode('TA_ONLY');assert.equal(f.api.getState().ra,null);
 f.api.setMode('TA_RA');assert.equal(f.api.getState().ra.id,'REVERSAL_CLIMB');
 f.setAge(3001);assert.equal(f.api.getState().mode,'FAIL');assert.equal(f.api.getState().ra,null);
 f.setAge(0);assert.ok(f.api.getState().ra);
 f.api.setPriorityWarning(true);assert.equal(f.api.getState().ra,null);
 f.stopFlight();assert.equal(f.api.getState().mode,'OFF');assert.equal(f.api.getState().targets.length,0);
});
test('FLT PHASE removes only ground/airborne selector; retained controls and TCAS mounts exist',()=>{
 const source=fs.readFileSync('panel-mosaic-lab/cockpit/flight-scenario-panel-v1.js','utf8');
 assert.doesNotMatch(source,/flightAirGround/);
 for(const id of ['flightAirport','flightRunway','flightPreset','flightLoad','flightTargets','flightTakeoff','flightPause','flightStop'])assert.ok(source.includes(id));
 const html=fs.readFileSync('panel-mosaic-lab/cockpit/index.html','utf8');
 assert.ok(html.includes('tcas-training-unified-v1.js'));assert.ok(html.includes('classic-tcas-v1.js'));
});
test('TCAS controls mount inside the existing flight dialog and user buttons run the same runtime',()=>{
 const nodes=new Map(),listeners=new Map();let ready;
 const node=id=>({id,textContent:'',value:'',checked:false,handlers:{},
  addEventListener(k,fn){this.handlers[k]=fn;},
  appendChild(n){nodes.set(n.id,n);},
  set innerHTML(html){this.html=html;for(const [,id] of html.matchAll(/id="([^"]+)"/g))nodes.set(id,node(id));},
  get innerHTML(){return this.html;}});
 nodes.set('flightScenarioDialog',node('flightScenarioDialog'));
 const document={readyState:'loading',getElementById:id=>nodes.get(id)||null,
  createElement:()=>node(''),addEventListener(type,fn){if(type==='DOMContentLoaded')ready=fn;}};
 const flight={...own};
 const win={document,B737ClassicTcasV1:TCAS,
  B737UnifiedFlightScenarioV1:{getDiagnostics:()=>({active:true,lastPublishAgeMs:0}),getState:()=>flight},
  addEventListener(type,fn){listeners.set(type,fn);},dispatchEvent(e){listeners.get(e.type)?.(e);}};
 class CustomEvent{constructor(type,opt={}){this.type=type;this.detail=opt.detail;}}
 vm.runInNewContext(fs.readFileSync('panel-mosaic-lab/cockpit/tcas-training-unified-v1.js','utf8'),{window:win,CustomEvent});
 ready();assert.ok(nodes.get('tcasTrainingControls'));
 nodes.get('tcasTrainingScenario').value='REVERSAL_DESCEND';
 nodes.get('tcasTrainingStart').handlers.click();
 assert.equal(win.B737UnifiedTcasV1.getDiagnostics().active,true);
 nodes.get('tcasTrainingNext').handlers.click();nodes.get('tcasTrainingNext').handlers.click();
 assert.equal(win.B737UnifiedTcasV1.getState().ra.id,'CLIMB');
 nodes.get('tcasTrainingNext').handlers.click();assert.equal(win.B737UnifiedTcasV1.getState().ra.id,'REVERSAL_DESCEND');
 const aural=[];listeners.set('b737:tcas-aural',e=>aural.push(e.detail.text));
 nodes.get('tcasTrainingVoice').handlers.change({target:{checked:true}});
 assert.equal(aural.length,1);assert.match(aural[0],/DESCEND NOW/);
 win.dispatchEvent(new CustomEvent('b737:flight-scenario-state',{detail:flight}));assert.equal(aural.length,1,'no replay every 250 ms');
 nodes.get('tcasTrainingStop').handlers.click();assert.equal(win.B737UnifiedTcasV1.getState().ra,null);
 assert.equal(win.B737UnifiedTcasV1.getDiagnostics().active,false);
});
