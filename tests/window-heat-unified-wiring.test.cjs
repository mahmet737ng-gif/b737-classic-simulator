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
 return {result:win.B737WindowHeatUnifiedV1.getOutput(),events};
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
