'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const P=require('../../engine/systems/pneumatics-v6.js');
const read=file=>fs.readFileSync(path.join(__dirname,file),'utf8');
const unified=read('aircon-fcom-unified-v1.js');
const stage=read('overhead-stage.html');
const native=read('recessed-overhead-v2.js');
const approved=read('oh21-owner-photo-registration-v1.js');
const manifest=JSON.parse(read('assembly.json'));
const html=read('index.html');

assert.ok(native.includes("kind:'recessed-button'"),'Real hardware emits recessed-button');
assert.ok(native.includes("id":"aircon-ovht-test")||native.includes('"id":"aircon-ovht-test"'));
assert.ok(native.includes('"id":"trip-reset"'),'Original TRIP RESET remains installed');
assert.ok(approved.includes("data-recessed-id"),'Photo fitter positions original recessed controls');
assert.ok(!stage.includes('aircon-fcom-p5-buttons-v1.js'),
 'No duplicate invisible button may overlay an already approved original');
assert.ok(!stage.includes('AIRCON-FCOM-0001" defer></script><script src="../cockpit/aircon-fcom-p5-buttons'));
assert.ok(html.includes('aircon-fcom-unified-v1.js?v=AIRCON-NATIVE-P5-0002'));
assert.ok(unified.includes("kind!=='recessed-button'"),'Parent consumes real physical events');
assert.ok(unified.includes("d.source!=='recessed-hardware-v2'"),'Only the original installed cap can command the live system');
assert.ok(!unified.includes("kind!=='aircon-fcom-input'"),'Retired hit path is not live');
assert.ok(manifest.regions.some(r=>r.id==='overhead'&&r.embeddedUrl.includes('aircon=NATIVE-P5-0002')));

let now=0,state=P.initial();
const sent=[],emitted=[],listeners={};
const frameWindow={postMessage(packet){sent.push(packet)}};
const frame={contentWindow:frameWindow,addEventListener(){}};
const doc={
 readyState:'loading',
 querySelector(){return null}, // no instructor drawer needed for physical buttons
 getElementById(id){return id==='overheadFrame'?frame:null},
 addEventListener(){}
};
const win={
 B737PneumaticsV6:P,
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
 performance:{now:()=>now},CustomEvent,console,
},{filename:'aircon-fcom-unified-v1.js'});
assert.ok(win.B737AirconFCOMUnifiedV1,'FCOM parent integration installed');
function nativeMessage(id,pressed,source='recessed-hardware-v2'){
 const packet={type:'b737:cockpit-overhead',kind:'recessed-button',id,pressed,source};
 for(const handle of listeners.message??[])handle({
  origin:'https://example.org',source:frameWindow,data:packet
 });
}
function messageSource(packet,source={}){for(const fn of listeners.message??[])fn({
 origin:'https://example.org',source,data:packet
})}

nativeMessage('aircon-ovht-test',true);
assert.equal(state.inputs.wingBodyTestHeld,true);
assert.equal(P.derive(state).lamps.wingBodyOverheatL,true,'L wing/body lights as soon as native cap pressed');
assert.equal(P.derive(state).lamps.wingBodyOverheatR,true,'R wing/body lights as soon as native cap pressed');
assert.equal(sent.at(-1).action,'aircon-fcom-projection');
assert.equal(sent.at(-1).payload.lamps.wingBodyOverheatL,true);
assert.equal(sent.at(-1).payload.lamps.wingBodyOverheatR,true);
now=5000;nativeMessage('aircon-ovht-test',true); // duplicate pointer action is ignored
assert.equal(state.inputs.wingBodyTestHeld,true);
now=5300;nativeMessage('aircon-ovht-test',false);
assert.equal(P.derive(state).lamps.wingBodyOverheatL,false);
assert.equal(P.derive(state).lamps.wingBodyOverheatR,false);
assert.ok(win.B737AirconFCOMUnifiedV1.getState().nativeInput.durationMs>=5000);
assert.equal(win.B737AirconFCOMUnifiedV1.getState().ovhtHeld,false);

state=P.apply(state,{type:'SENSOR',key:'wingBodyLDetectorFailed',value:true});
now=5500;nativeMessage('aircon-ovht-test',true);
assert.equal(P.derive(state).lamps.wingBodyOverheatL,false,'Failed left test circuit stays dark');
assert.equal(P.derive(state).lamps.wingBodyOverheatR,true,'Right test circuit remains independent');
now=11500;nativeMessage('aircon-ovht-test',false);
assert.equal(state.inputs.wingBodyTestHeld,false);

state=P.apply(state,{type:'SENSOR',key:'bleed1Overlimit',value:true});
state=P.apply(state,{type:'SENSOR',key:'bleed1Overlimit',value:false});
assert.equal(P.derive(state).lamps.bleedTrip1,true);
nativeMessage('trip-reset',false);
assert.equal(P.derive(state).lamps.bleedTrip1,true,'Release is not another reset');
nativeMessage('trip-reset',true);
assert.equal(P.derive(state).lamps.bleedTrip1,false,'Native reset cap clears cooled latched trip');

nativeMessage('aircon-ovht-test',true,'untrusted-duplicate');
assert.equal(state.inputs.wingBodyTestHeld,false,'Synthetic nonhardware commands ignored');
messageSource({type:'b737:cockpit-overhead',kind:'recessed-button',id:'aircon-ovht-test',
 pressed:true,source:'recessed-hardware-v2'});
assert.equal(state.inputs.wingBodyTestHeld,false,'Untrusted iframe ignored');
assert.ok(sent.some(p=>p.payload?.lamps?.wingBodyOverheatR===true));
assert.ok(emitted.some(e=>e.type==='b737:aircon-fcom-status'));

console.log('PASS: actual OH21 recessed pushbutton reaches ECU and both WING BODY lamps immediately; 5s hold/release, failure and TRIP RESET verified; no duplicate button.');
