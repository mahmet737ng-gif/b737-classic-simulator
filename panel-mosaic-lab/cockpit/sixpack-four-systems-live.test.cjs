'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const bridge=require('./sixpack-live-integration-v1.js');

const overhead=(frames,power=true,lampTest=false)=>bridge.overhead({frames,power,lampTest});
const contains=(reasons,category,id)=>(reasons[category]||[]).some(x=>(typeof x==='string'?x:x.id)===id);

test('FLT CONT accepts real STBY RUD ON; no warning on dead/test overhead',()=>{
 assert.ok(contains(overhead({'stby-rudder':'ON'}),'CAPT.FLT CONT','OH:stby-rudder'));
 assert.equal(overhead({'stby-rudder':'ON'},false)['CAPT.FLT CONT'].length,0);
 assert.equal(overhead({'stby-rudder':'ON'},true,true),null);
});
test('ANTI-ICE maps individual pitot/probe lenses, but not normal TAT TEMP PROBE',()=>{
 const reasons=overhead({'probe-capt-ps':'ON','probe-r-alpha':'ON','probe-temp':'ON'});
 assert.ok(contains(reasons,'FO.ANTI ICE','OH:probe-capt-ps'));
 assert.ok(contains(reasons,'FO.ANTI ICE','OH:probe-r-alpha'));
 assert.ok(!contains(reasons,'FO.ANTI ICE','OH:probe-temp'));
});
test('APU oil lamp uses both physical OH evidence and live ECU state',()=>{
 assert.ok(contains(overhead({'apu-low-pressure':'ON'}),'CAPT.APU','OH:apu-low-pressure'));
 assert.ok(contains(bridge.apuECU({apu:{phase:'STARTING',oil:{lowPressureLamp:true}}}),
  'CAPT.APU','ECU:APU:LOW_OIL_PRESSURE'));
 assert.equal(bridge.apuECU({apu:{phase:'OFF',oil:{lowPressureLamp:true}}})['CAPT.APU'].length,0);
 assert.equal(bridge.apuECU({apu:{phase:'READY',oil:{lowPressureLamp:false}}})['CAPT.APU'].length,0);
 assert.equal(bridge.apuECU({apu:{phase:'STARTING'}}),null);
});
test('AIR COND retains PACK, BLEED, DUCT, pressurization and 400 zone fault paths',()=>{
 const oh=overhead({'pack-trip-l':'ON','bleed-trip-r':'ON','duct-overheat-l':'ON','dual-bleed':'ON'});
 for(const id of ['pack-trip-l','bleed-trip-r','duct-overheat-l'])
  assert.ok(contains(oh,'FO.AIR COND','OH:'+id));
 assert.ok(!contains(oh,'FO.AIR COND','OH:dual-bleed')); // configuration annunciation, not injected as failure
 assert.ok(contains(bridge.pressurization({system:'CPCS',lamps:{autoFail:true,offSchedDescent:false}}),
  'FO.AIR COND','PRESS:CPCS:AUTO_FAIL'));
 assert.ok(contains(bridge.airconZones({family:'B737-400',zoneFaults:{'cont-cab':true}}),
  'FO.AIR COND','AIRCON400:cont-cab:ZONE_FAULT'));
});
function runtime(){
 const listeners=new Map(),received=[];
 const frame={contentWindow:{postMessage(){}},addEventListener(){}};
 const w={
  location:{origin:'https://trainer.local'},
  document:{readyState:'loading',addEventListener(){},getElementById:id=>id==='overheadFrame'?frame:null},
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail;}},
  addEventListener(name,fn){if(!listeners.has(name))listeners.set(name,[]);listeners.get(name).push(fn);},
  dispatchEvent(e){for(const fn of listeners.get(e.type)||[])fn(e);},
  B737SixPack:{setLiveConditions:conditions=>received.push(conditions),getCautionDiagnostics:()=>({recalled:[]})}
 };
 const api=bridge.install(w);
 const event=(name,detail)=>w.dispatchEvent(new w.CustomEvent(name,{detail}));
 const post=data=>{for(const fn of listeners.get('message')||[])fn({
  origin:w.location.origin,source:frame.contentWindow,data:{type:'b737:cockpit-overhead',...data}});};
 return {api,event,post,received};
}
test('four live sources combine, dedupe APU and clear when faults recover',()=>{
 const r=runtime();
 r.event('b737:unified-ecu-observation',{apu:{phase:'STARTING',oil:{lowPressureLamp:true}}});
 assert.ok(!contains(r.api.snapshot().reasons,'CAPT.APU','ECU:APU:LOW_OIL_PRESSURE'));
 r.post({kind:'state',power:true,lampTest:false,frames:{
  'stby-rudder':'ON','probe-capt-ps':'ON','pack-trip-l':'ON','apu-low-pressure':'ON'}});
 for(const [category,id] of [
  ['CAPT.FLT CONT','OH:stby-rudder'],['FO.ANTI ICE','OH:probe-capt-ps'],
  ['FO.AIR COND','OH:pack-trip-l'],['CAPT.APU','ECU:APU:LOW_OIL_PRESSURE']])
  assert.ok(contains(r.api.snapshot().reasons,category,id),category+' missing');
 assert.ok(!contains(r.api.snapshot().reasons,'CAPT.APU','OH:apu-low-pressure'));
 r.event('b737:unified-ecu-observation',{apu:{phase:'READY',oil:{lowPressureLamp:false}}});
 assert.equal(r.api.snapshot().reasons['CAPT.APU'].length,0);
 r.post({kind:'aircon400-zone-status',family:'B737-400',zoneFaults:{'cont-cab':true}});
 assert.ok(contains(r.api.snapshot().reasons,'FO.AIR COND','AIRCON400:cont-cab:ZONE_FAULT'));
 r.event('b737:aircraft-profile-change',{aircraftFamily:'B737-300-500'});
 assert.ok(!contains(r.api.snapshot().reasons,'FO.AIR COND','AIRCON400:cont-cab:ZONE_FAULT'));
 r.post({kind:'state',power:false,lampTest:false,frames:{'stby-rudder':'ON'}});
 assert.equal(r.api.snapshot().reasons['CAPT.FLT CONT'].length,0);
});
