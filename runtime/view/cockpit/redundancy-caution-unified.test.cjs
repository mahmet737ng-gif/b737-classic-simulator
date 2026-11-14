'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const model=require('../../engine/systems/classic-redundancy-caution-v1.js');
const bridge=require('./sixpack-live-integration-v1.js');
function cockpit(){
 const events=new Map(),nativeMsgs=[],doc={
  readyState:'loading',addEventListener(){},querySelectorAll(){return []},
  getElementById(id){return id==='overheadFrame'?{contentWindow:{postMessage(x){nativeMsgs.push(x)},addEventListener(){}}}:null;}
 };
 const window={document:doc,location:{origin:'https://trainer.local'},B737ClassicRedundancyCautionV1:model,
  addEventListener(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn)},
  dispatchEvent(e){for(const fn of events.get(e.type)||[])fn(e)},
  CustomEvent:class{constructor(type,{detail}={}){this.type=type;this.detail=detail;}}
 };
 const source=fs.readFileSync(path.join(__dirname,'sixpack-glareshield-v1.js'),'utf8');
 vm.runInNewContext(source,{window,document:doc,CustomEvent:window.CustomEvent},{timeout:3000});
 return {window,ui:window.B737SixPack,runtime:bridge.install(window),nativeMsgs,
  event(name,detail){window.dispatchEvent(new window.CustomEvent(name,{detail}))}};
}
const dark=s=>({master:s.ui.getEffectiveState()['CAPT.MASTER CAUTION'],locator:s.ui.getEffectiveState()['CAPT.FLT CONT']});
test('FCOM channel rules: 0 normal, 1 recall-only, 2 immediate, for all supported systems',()=>{
 for(const system of model.KEYS){
  const e=model.create(),id=model.CHANNELS[system].individualLamp;
  assert.equal(e.snapshot().indicators[id].mode,'NORMAL');
  assert.equal(e.setChannel(system,'A',true).indicators[id].mode,'RECALL_ONLY');
  assert.equal(e.setChannel(system,'B',true).indicators[id].mode,'IMMEDIATE');
  assert.equal(e.setChannel(system,'A',false).indicators[id].mode,'RECALL_ONLY');
  assert.equal(e.setChannel(system,'B',false).indicators[id].mode,'NORMAL');
  assert.equal(e.setChannel(system,'X',true),false);
 }
});
test('single FCC failure is stored silently; pressing either Six-Pack recalls locator, not master',()=>{
 const s=cockpit();s.runtime.setChannelFailure('MACH_TRIM','A',true);
 assert.deepEqual(dark(s),{master:false,locator:false});
 assert.equal(s.runtime.snapshot().reasons['CAPT.FLT CONT'][0].mode,'RECALL_ONLY');
 s.ui.press('FO');assert.equal(dark(s).locator,true);
 s.ui.release('FO');assert.deepEqual(dark(s),{master:false,locator:true});
 assert.equal(s.nativeMsgs.at(-1).indicators['mach-trim'].on,true);
 s.ui.acknowledge();assert.deepEqual(dark(s),{master:false,locator:false});
 assert.equal(s.nativeMsgs.at(-1).indicators['mach-trim'].on,false);
});
test('dual channel failure warns immediately; master reset retains physical source lamp',()=>{
 const s=cockpit();
 s.runtime.setChannelFailure('SPEED_TRIM','B',true);
 s.runtime.setChannelFailure('SPEED_TRIM','A',true);
 assert.deepEqual(dark(s),{master:true,locator:true});
 assert.equal(s.nativeMsgs.at(-1).indicators['speed-trim'].on,true);
 s.ui.acknowledge();assert.deepEqual(dark(s),{master:false,locator:false});
 assert.equal(s.nativeMsgs.at(-1).indicators['speed-trim'].on,true);
 s.ui.recall('CAPT');assert.deepEqual(dark(s),{master:true,locator:true});
 s.ui.acknowledge();
 s.runtime.setChannelFailure('SPEED_TRIM','A',false);
 assert.deepEqual(dark(s),{master:false,locator:false});
 s.ui.recall('FO');assert.deepEqual(dark(s),{master:false,locator:true});
});
test('same category ACK never suppresses a new independent fault and invalid snapshots are atomic',()=>{
 const s=cockpit();
 s.ui.setLiveConditions({'CAPT.FLT CONT':['OH:feel-diff']});
 s.ui.acknowledge();
 s.runtime.setChannelFailure('AUTO_SLAT','A',true);
 assert.equal(dark(s).master,false);
 s.runtime.setChannelFailure('AUTO_SLAT','B',true);
 assert.equal(dark(s).master,true);
 s.ui.acknowledge();
 s.runtime.setChannelFailure('AUTO_SLAT','B',false);
 assert.equal(dark(s).master,false);
 s.runtime.setChannelFailure('AUTO_SLAT','B',true);
 assert.equal(dark(s).master,true);
 const prev=JSON.stringify(s.ui.getLiveReasons());
 assert.equal(s.ui.setLiveConditions({'CAPT.FLT CONT':['OK'],'FO.DOORS':[12]}),false);
 assert.equal(JSON.stringify(s.ui.getLiveReasons()),prev);
});
test('three dual-channel systems produce independent recall classifications',()=>{
 const s=cockpit();
 for(const name of model.KEYS)s.runtime.setChannelFailure(name,'A',true);
 assert.equal(dark(s).master,false);
 assert.equal(dark(s).locator,false);
 s.ui.recall('CAPT');assert.equal(dark(s).locator,true);
 assert.equal(dark(s).master,false);
 s.ui.acknowledge();
 s.runtime.setChannelFailure('MACH_TRIM','B',true);
 assert.equal(dark(s).master,true);
 assert.equal(s.runtime.getRedundancyState().indicators['auto-slat'].mode,'RECALL_ONLY');
 assert.equal(s.runtime.getRedundancyState().indicators['mach-trim'].mode,'IMMEDIATE');
});
test('only physical lamp faces are overlaid; original flight-control source state is immutable',()=>{
 const callbacks=new Map(),frames={'speed-trim':'OFF','mach-trim':'OFF','auto-slat':'OFF'};
 const state={power:true,frames};
 const nodes=new Map(Object.keys(frames).map(k=>[k,{
  dataset:{},classList:{remove(){}},setAttribute(){},
  querySelectorAll(){return [{dataset:{frame:'ON'},classList:{toggle(){} }},{dataset:{frame:'OFF'},classList:{toggle(){}}}]}
 }]));
 const parent={},window={parent,location:{origin:'https://trainer.local'},
  document:{querySelector(selector){
   const k=selector.split('data-light="')[1]?.split('"')[0];
   return nodes.get(k)||null;
  }},
  B737OverheadLights:{getState(){return state}},
  addEventListener(t,fn){callbacks.set(t,fn)}
 };
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'redundancy-physical-recall-v1.js'),'utf8'),
  {window},{timeout:3000});
 const packet=on=>({type:'b737:cockpit-command',action:'redundancy-physical-lamps',indicators:{
  'speed-trim':{on,mode:'RECALL_ONLY'},'mach-trim':{on:false,mode:'NORMAL'},'auto-slat':{on:false,mode:'NORMAL'}}});
 callbacks.get('message')({source:parent,origin:window.location.origin,data:packet(true)});
 assert.equal(nodes.get('speed-trim').dataset.frame,'ON');
 assert.equal(state.frames['speed-trim'],'OFF');
 callbacks.get('message')({source:parent,origin:window.location.origin,data:packet(false)});
 assert.equal(nodes.get('speed-trim').dataset.frame,'OFF');
 frames['speed-trim']='ON';callbacks.get('b737:overhead-light-state')();
 assert.equal(nodes.get('speed-trim').dataset.frame,'ON');
 state.power=false;callbacks.get('b737:overhead-light-state')();
 assert.equal(nodes.get('speed-trim').dataset.frame,'OFF');
});

test('FCOM main fuel tank FWD/AFT pair: one LOW PRESSURE recall-only; both immediate',()=>{
 const single=bridge.overhead({power:true,lampTest:false,frames:{
  'fuel-1-fwd':'ON','fuel-1-aft':'OFF','fuel-2-fwd':'OFF','fuel-2-aft':'OFF'
 }});
 assert.deepEqual(single['CAPT.FUEL'],[{id:'OH:fuel-1-fwd',mode:'RECALL_ONLY'}]);
 const both=bridge.overhead({power:true,lampTest:false,frames:{
  'fuel-1-fwd':'ON','fuel-1-aft':'ON'
 }});
 assert.deepEqual(both['CAPT.FUEL'],['OH:fuel-1-aft','OH:fuel-1-fwd']);
 const s=cockpit();
 s.ui.setLiveConditions(single);
 assert.equal(s.ui.getEffectiveState()['CAPT.FUEL'],false);
 assert.equal(s.ui.getEffectiveState()['CAPT.MASTER CAUTION'],false);
 s.ui.recall('FO');
 assert.equal(s.ui.getEffectiveState()['CAPT.FUEL'],true);
 assert.equal(s.ui.getEffectiveState()['CAPT.MASTER CAUTION'],false);
 s.ui.acknowledge();s.ui.setLiveConditions(both);
 assert.equal(s.ui.getEffectiveState()['CAPT.MASTER CAUTION'],true);
 const independent=bridge.overhead({power:true,lampTest:false,frames:{
  'fuel-1-fwd':'ON','fuel-1-aft':'OFF','fuel-2-fwd':'OFF','fuel-2-aft':'ON'
 }});
 assert.equal(independent['CAPT.FUEL'].length,2);
 assert.ok(independent['CAPT.FUEL'].every(x=>x.mode==='RECALL_ONLY'));
});
