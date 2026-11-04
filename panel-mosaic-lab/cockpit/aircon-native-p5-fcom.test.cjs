'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const P=require('../../engine/systems/pneumatics-v6.js');
const H=require('../../engine/systems/aircon-ovht-hold-v1.js');
const read=file=>fs.readFileSync(path.join(__dirname,file),'utf8');
const unified=read('aircon-fcom-unified-v1.js');
const stage=read('overhead-stage.html');
const native=read('recessed-overhead-v2.js');
const approved=read('oh21-owner-photo-registration-v1.js');
const manifest=JSON.parse(read('assembly.json'));
const html=read('index.html');
assert.ok(native.includes("kind:'recessed-button'"),'Native P5 input only');
assert.ok(native.includes('"id":"aircon-ovht-test"'));
assert.ok(native.includes('"id":"trip-reset"'));
assert.ok(approved.includes('data-recessed-id'));
assert.ok(native.includes('if(newlyMounted||!photoOwned)'),'Approved photo coordinates cannot jump');
assert.ok(stage.includes('airconP5=NATIVE-0002'),'Native button loaded');
assert.ok(!stage.includes('aircon-fcom-p5-buttons-v1.js'),'Duplicate synthetic button retired');
assert.ok(html.includes('aircon-fcom-unified-v1.js?v=AIRCON-OVHT-DELAY-0004-LAB'));
assert.ok(html.includes('aircon-ovht-hold-v1.js?v=AIRCON-OVHT-DELAY-0003'));
assert.ok(unified.includes("kind!=='recessed-button'"));
assert.ok(unified.includes("d.source!=='recessed-hardware-v2'"));
assert.ok(unified.includes('const projection=command')===false||unified.includes('onQualified:'));
assert.ok(unified.includes("onQualified:()=>"),'No immediate light on PRESS');
assert.ok(unified.includes("onReleased:()=>"),'Release deasserts qualified test');
assert.ok(manifest.regions.some(x=>x.id==='overhead'&&x.embeddedUrl.includes('aircon=OVHT-DELAY-0003')));

let now=0,timerSerial=0,state=P.initial();
const jobs=new Map(),sent=[],emitted=[],listeners={};
function tick(to){
 assert.ok(to>=now);now=to;
 for(let i=0;i<20;i++){
  const pending=[...jobs.entries()].filter(([,job])=>job.at<=now);
  if(!pending.length)break;
  for(const [id,job]of pending){jobs.delete(id);job.run()}
 }
}
const timeout=(fn,ms)=>{const id=++timerSerial;jobs.set(id,{at:now+ms,run:fn});return id};
const clear=id=>jobs.delete(id);
const directFrames=[];
const frameWindow={
 postMessage(packet){sent.push(packet)},
 B737OverheadLights:{setAuthoritativePneumatics(packet){directFrames.push(packet.lamps)}}
};
const frame={contentWindow:frameWindow,addEventListener(){}};
const doc={
 readyState:'loading',hidden:false,
 querySelector(){return null},
 getElementById(id){return id==='overheadFrame'?frame:null},
 addEventListener(){}
};
const win={
 B737PneumaticsV6:P,
 B737AirconOVHTQualificationV1:{DELAY_MS:H.DELAY_MS,
  create:options=>H.create({...options,schedule:timeout,cancel:clear})},
 B737ISNCockpitV1:{
  getPneumaticState:()=>state,
  sendPneumatic:cmd=>{state=P.apply(state,cmd);return P.derive(state)}
 },
 addEventListener(name,cb){(listeners[name]??=[]).push(cb)},
 dispatchEvent(event){emitted.push(event)}
};
class CustomEvent{constructor(type,options){this.type=type;this.detail=options?.detail}}
vm.runInNewContext(unified,{
 window:win,document:doc,location:{origin:'https://example.org'},
 localStorage:{getItem:()=>JSON.stringify({aircraftFamily:'B737-300-500'})},
 performance:{now:()=>now,timeOrigin:1000000},CustomEvent,console,
},{filename:'aircon-fcom-unified-v1.js'});
const parent=win.B737AirconFCOMUnifiedV1;
assert.ok(parent,'Native FCOM bridge ready');
function nativeMessage(id,pressed,source='recessed-hardware-v2',epoch=1000000+now){
 const packet={type:'b737:cockpit-overhead',kind:'recessed-button',
  id,pressed,source,physicalEpochMs:epoch};
 for(const handle of listeners.message??[])handle({
  origin:'https://example.org',source:frameWindow,data:packet
 });
}
function foreignMessage(packet,source={}){
 for(const handler of listeners.message??[])handler({
  origin:'https://example.org',source,data:packet
 });
}
nativeMessage('aircon-ovht-test',true);
assert.equal(state.inputs.wingBodyTestHeld,false,'Real PRESS never energizes indication immediately');
assert.equal(P.derive(state).lamps.wingBodyOverheatL,false);
assert.equal(P.derive(state).lamps.wingBodyOverheatR,false);
tick(4999);
assert.equal(state.inputs.wingBodyTestHeld,false,'No lamp at 4999ms');
assert.equal(parent.getState().ovhtTest.qualified,false);
tick(5000);
assert.equal(state.inputs.wingBodyTestHeld,true,'Only full 5-second continuous test reaches ECU');
assert.equal(P.derive(state).lamps.wingBodyOverheatL,true);
assert.equal(P.derive(state).lamps.wingBodyOverheatR,true);
assert.equal(sent.at(-1).action,'aircon-fcom-projection');
assert.equal(sent.at(-1).payload.lamps.wingBodyOverheatL,true);
assert.equal(sent.at(-1).payload.lamps.wingBodyOverheatR,true);
assert.equal(directFrames.at(-1).wingBodyOverheatL,true,
 'Visual panel must be updated synchronously on qualified ECU frame');
assert.equal(directFrames.at(-1).wingBodyOverheatR,true);
tick(5100);nativeMessage('aircon-ovht-test',true);
assert.equal(state.inputs.wingBodyTestHeld,true,'Duplicate DOWN ignored');
tick(5300);nativeMessage('aircon-ovht-test',false);
assert.equal(state.inputs.wingBodyTestHeld,false);
assert.equal(P.derive(state).lamps.wingBodyOverheatL,false);
assert.equal(parent.getState().ovhtTest.held,false);
assert.equal(jobs.size,0);

tick(6000);nativeMessage('aircon-ovht-test',true);
tick(9999);nativeMessage('aircon-ovht-test',false);
assert.equal(state.inputs.wingBodyTestHeld,false);
tick(12000);assert.equal(state.inputs.wingBodyTestHeld,false,
 'Cancelled early-release timer cannot re-arm after 5s');

state=P.apply(state,{type:'SENSOR',key:'wingBodyLDetectorFailed',value:true});
tick(13000);nativeMessage('aircon-ovht-test',true);
tick(18000);
assert.equal(P.derive(state).lamps.wingBodyOverheatL,false,'Faulted left detector fails test');
assert.equal(P.derive(state).lamps.wingBodyOverheatR,true,'Healthy right detector passes test');
nativeMessage('aircon-ovht-test',false);
assert.equal(state.inputs.wingBodyTestHeld,false);
state=P.apply(state,{type:'SENSOR',key:'wingBodyLLeakDetected',value:true});
assert.equal(P.derive(state).lamps.wingBodyOverheatL,true,'A real leak remains immediate despite the TEST delay');
state=P.apply(state,{type:'SENSOR',key:'wingBodyLLeakDetected',value:false});

state=P.apply(state,{type:'SENSOR',key:'bleed1Overlimit',value:true});
state=P.apply(state,{type:'SENSOR',key:'bleed1Overlimit',value:false});
assert.equal(P.derive(state).lamps.bleedTrip1,true);
nativeMessage('trip-reset',false);assert.equal(P.derive(state).lamps.bleedTrip1,true);
nativeMessage('trip-reset',true);assert.equal(P.derive(state).lamps.bleedTrip1,false);

nativeMessage('aircon-ovht-test',true,'untrusted-duplicate');
assert.equal(state.inputs.wingBodyTestHeld,false);
foreignMessage({type:'b737:cockpit-overhead',kind:'recessed-button',
 id:'aircon-ovht-test',pressed:true,source:'recessed-hardware-v2'});
assert.equal(state.inputs.wingBodyTestHeld,false,'Non-operational iframe ignored');
assert.ok(emitted.some(event=>event.type==='b737:aircon-fcom-status'));
// The original physical PRESS may be buffered in a busy iframe. The parent
// must subtract that latency: qualification is t+5000 from pointerdown,
// not five seconds after the queued message handler finally runs.
state=P.apply(state,{type:'SENSOR',key:'wingBodyLDetectorFailed',value:false});
tick(19000);
const originalPressEpoch=1000000+19000;
tick(20750); // Intentional 1750ms message delivery latency
nativeMessage('aircon-ovht-test',true,'recessed-hardware-v2',originalPressEpoch);
assert.equal(state.inputs.wingBodyTestHeld,false,'No early lamp despite late message');
tick(23999);
assert.equal(state.inputs.wingBodyTestHeld,false,'Physical hold has not reached 5000ms');
tick(24000);
assert.equal(state.inputs.wingBodyTestHeld,true,
 'Original physical hold reaches 5s, not 6.75s delayed by iframe transport');
assert.equal(directFrames.at(-1).wingBodyOverheatL,true);
nativeMessage('aircon-ovht-test',false);
assert.equal(state.inputs.wingBodyTestHeld,false);
assert.equal(directFrames.at(-1).wingBodyOverheatL,false);
console.log('PASS: native OH21 P5 must stay dark before 5s, then activate both WING BODY, cancel short hold, release, detector failure and reset.');
