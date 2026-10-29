'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const Core=require('../engine/systems/window-heat-v1.js');
const code=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/window-heat-unified-v1.js'),'utf8');
const busOn=Object.fromEntries(['generator1','generator2','main1','main2','dc1','dc2'].map(k=>[k,true]));
const switchOn=Object.fromEntries(Object.values(Core.CHANNELS).map(c=>[c.switchId,'ON']));
function mount(authority){
 const timers=[],subscriptions=[],events=[],memory=new Map();
 const win={B737WindowHeatV1:Core,B737ISNCockpitV1:authority,addEventListener(type,cb){subscriptions.push([type,cb]);},
 dispatchEvent(e){events.push(e);return true;}};
 const frame={contentWindow:{B737OverheadToggles:{getState:()=>switchOn},B737OverheadLights:{getState:()=>({lampTest:false})},addEventListener(){}},
 contentDocument:{documentElement:{classList:{contains:()=>false}},querySelector:()=>null}};
 const doc={readyState:'complete',getElementById:id=>id==='overheadFrame'?frame:null,querySelector:()=>null};
 const store={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
 const ctx={window:win,document:doc,localStorage:store,performance:{now:()=>1500},
 setInterval:cb=>{timers.push(cb);return 1;},CustomEvent:class{constructor(type,data){this.type=type;this.detail=data.detail;}}};
 vm.runInNewContext(code,ctx,{filename:'window-heat-unified-v1.js'});
 assert.equal(timers.length,1);
 timers[0]();
 return {result:win.B737WindowHeatUnifiedV1.getOutput(),events,
  trainer:win.B737WindowHeatUnifiedV1,store};
}
test('Window Heat sees electrical bus object directly from live ISN start chain',()=>{
 const {result}=mount({getStartState:()=>({electrical:busOn})});
 assert.ok(result,'No live Window Heat evaluation');
 assert.ok(Object.values(result.channels).every(x=>x.greenOn&&x.controllerPower),'Power expected in four live channels');
});
test('Window Heat can fall back to ISN pack bridge state shape',()=>{
 const {result}=mount({getStartState:()=>({electrical:null}),getState:()=>({state:{electrical:{bus:busOn}}})});
 assert.ok(result,'No fallback live Window Heat evaluation');
 assert.equal(result.channels.L_FWD.heaterPower,true);
});
test('Window Heat correctly refuses to synthesize power from absent authority',()=>{
 const {result}=mount({getStartState:()=>({electrical:null}),getState:()=>({state:{electrical:{bus:null}}})});
 assert.equal(result,null);
});
test('Window Heat has master caution request event on hot-window fault',()=>{
 const authority={getStartState:()=>({electrical:busOn})};
 const {result,events}=mount(authority);
 assert.ok(result);
 assert.ok(events.some(e=>e.type==='b737:window-heat-annunciations'));
});

function mountInteractiveOH15(){
 const timer=[],handlers={},childEvents={},outEvents=[];
 const sw={...switchOn},memory=new Map();
 let time=0;
 const frame={contentWindow:{
   B737OverheadToggles:{getState:()=>({...sw})},
   B737OverheadLights:{getState:()=>({lampTest:false})},
   addEventListener(type,callback){childEvents[type]=callback;},
   postMessage(){}},
   contentDocument:{documentElement:{classList:{contains:()=>false}},querySelector:()=>null}};
 const win={B737WindowHeatV1:Core,
 B737ISNCockpitV1:{getStartState:()=>({electrical:busOn})},
 addEventListener(type,fn){handlers[type]=fn;},
 dispatchEvent(ev){outEvents.push(ev);return true;}};
 const doc={readyState:'complete',getElementById:id=>id==='overheadFrame'?frame:null,querySelector:()=>null};
 const store={getItem:key=>memory.get(key)||null,setItem:(key,val)=>memory.set(key,val)};
 vm.runInNewContext(code,{window:win,document:doc,localStorage:store,
 performance:{now:()=>time},setInterval:fn=>{timer.push(fn);return 1;},
 CustomEvent:class{constructor(type,data){this.type=type;this.detail=data.detail;}},
 location:{origin:'https://example.test'}},
 {filename:'window-heat-unified-v1.js'});
 assert.equal(timer.length,1);
 function change(id,value){sw[id]=value;childEvents['b737:switch-change']({detail:{id,next:value}});}
 return {change,step(seconds){time+=1000*seconds;timer[0]();return win.B737WindowHeatUnifiedV1.getOutput();},
 output:()=>win.B737WindowHeatUnifiedV1.getOutput(),events:outEvents};
}
test('Real OH15 spring test is sampled immediately even when held for less than 250 ms',()=>{
 const h=mountInteractiveOH15();
 h.step(0);
 h.change('window-power-test','OVHT');
 h.change('window-power-test','OFF');
 const o=h.output();
 assert.ok(o,'No Window Heat output');
 assert.ok(Object.values(o.channels).every(x=>x.overheatOn),'four amber after short OVHT pulse');
 h.step(59);
 assert.ok(Object.values(h.output().channels).every(x=>x.overheatOn&&x.greenOn));
 h.step(1);
 assert.ok(Object.values(h.output().channels).every(x=>!x.overheatOn&&x.greenOn),'timer should expire at 60 sec');
});
test('Real OH15 OFF->ON clears only selected amber immediately',()=>{
 const h=mountInteractiveOH15();
 h.step(0);
 h.change('window-power-test','OVHT');
 h.change('window-power-test','OFF');
 h.step(10);
 h.change('window-l-side','OFF');
 assert.equal(h.output().channels.L_SIDE.overheatOn,false);
 assert.equal(h.output().channels.R_SIDE.overheatOn,true);
 h.change('window-l-side','ON');
 assert.equal(h.output().channels.L_SIDE.overheatOn,false);
 assert.equal(h.output().channels.L_SIDE.greenOn,true);
 assert.equal(h.output().channels.R_SIDE.overheatOn,true);
});

test('Cold & dark reports exact missing AC/DC feeds and never falsely illuminates green',()=>{
 const dark=Object.fromEntries(Object.keys(busOn).map(k=>[k,false]));
 const {trainer,result}=mount({getStartState:()=>({electrical:dark})});
 assert.ok(result);
 assert.ok(Object.values(result.channels).every(x=>!x.greenOn));
 assert.equal(trainer.getPowerDiagnostic().mode,'AIRCRAFT_ELECTRICAL');
 assert.equal(trainer.getPowerDiagnostic().off.length,6);
});
test('Explicit isolated Window Heat training supply enables all four ON lamps with cold/dark aircraft',()=>{
 const dark=Object.fromEntries(Object.keys(busOn).map(k=>[k,false]));
 const {trainer,store}=mount({getStartState:()=>({electrical:dark})});
 const diagnostic=trainer.setTrainingPower(true);
 assert.equal(diagnostic.mode,'WINDOW_HEAT_TRAINING_SUPPLY');
 assert.equal(store.getItem('b737.windowheat.training-power.v1'),'1');
 assert.ok(Object.values(trainer.getOutput().channels).every(x=>x.greenOn&&x.controllerPower));
 assert.equal(trainer.getOutput().powerDiagnostic.effectiveBuses.generator1,true);
 trainer.setTrainingPower(false);
 assert.ok(Object.values(trainer.getOutput().channels).every(x=>!x.greenOn));
});
test('Instructor Window Heat training supply still respects a pulled heater CB',()=>{
 const dark=Object.fromEntries(Object.keys(busOn).map(k=>[k,false]));
 const {trainer,store}=mount({getStartState:()=>({electrical:dark})});
 trainer.setTrainingPower(true);
 store.setItem('b737classic.cb.v1',JSON.stringify({breakers:[{id:'P6-11|ALL|B9',pulled:true}]}));
 trainer.evaluate();
 const o=trainer.getOutput().channels;
 assert.equal(o.L_FWD.greenOn,false);
 assert.equal(o.L_FWD.cbHeaterClosed,false);
 assert.equal(o.L_SIDE.greenOn,true);
 assert.equal(o.R_FWD.greenOn,true);
 assert.equal(o.R_SIDE.greenOn,true);
});
test('Instructor Window Heat training supply does not mask a failed controller or thermal overheat',()=>{
 const dark=Object.fromEntries(Object.keys(busOn).map(k=>[k,false]));
 const {trainer}=mount({getStartState:()=>({electrical:dark})});
 trainer.setTrainingPower(true);
 trainer.injectFault('L_SIDE','CONTROLLER_FAIL',true);
 assert.equal(trainer.getOutput().channels.L_SIDE.greenOn,false);
 assert.equal(trainer.getOutput().channels.R_FWD.greenOn,true);
 trainer.injectFault('R_SIDE','STUCK_OVERHEAT',true);
 assert.equal(trainer.getOutput().channels.R_SIDE.overheatOn,true);
 assert.equal(trainer.getOutput().channels.R_SIDE.greenOn,false);
});
