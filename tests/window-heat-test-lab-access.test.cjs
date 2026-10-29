'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const Core=require('../engine/systems/window-heat-v1.js');
const code=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/window-heat-unified-v1.js'),'utf8');

function fakeNode(name){
 const children=new Map();
 return {
  name,style:{},dataset:{},children:[],listeners:{},value:name==='#wh-channel'?'L_FWD':name==='#wh-fault'?'HEATER_FAIL':'',
  checked:false,open:false,innerHTML:'',textContent:'',title:'',
  addEventListener(type,fn){this.listeners[type]=fn;},
  append(...items){this.children.push(...items);},
  querySelector(selector){if(!children.has(selector))children.set(selector,fakeNode(selector));return children.get(selector);},
  replaceChildren(){this.children=[];},
  setAttribute(){},
  close(){this.open=false;},
  showModal(){this.open=true;}
 };
}
function mount(){
 let now=1000;
 const timers=[],memory=new Map();
 const inspector=fakeNode('#inspector'),heading=fakeNode('#inspector h1'),frame=fakeNode('overheadFrame');
 inspector.querySelector=selector=>selector==='h1'?heading:fakeNode(selector);
 const switches=Object.fromEntries(Object.values(Core.CHANNELS).map(c=>[c.switchId,'OFF']));
 switches['window-power-test']='OFF';
 frame.contentWindow={
  B737OverheadToggles:{getState:()=>({...switches})},
  B737OverheadLights:{getState:()=>({lampTest:false})},
  addEventListener(){},postMessage(){}
 };
 frame.contentDocument={documentElement:{classList:{contains:()=>false}},querySelector:()=>null};
 const body=fakeNode('body');
 const document={
  readyState:'complete',body,
  querySelector(selector){if(selector==='.overhead-tools')return null;if(selector==='#inspector')return inspector;if(selector==='#inspector h1')return heading;return null;},
  createElement(name){return fakeNode(name);},
  getElementById(id){return id==='overheadFrame'?frame:null;}
 };
 const window={
  B737WindowHeatV1:Core,
  B737ISNCockpitV1:{getStartState:()=>({electrical:{generator1:true,generator2:true,main1:true,main2:true,dc1:true,dc2:true}})},
  addEventListener(){},dispatchEvent(){return true;}
 };
 const context={
  window,document,localStorage:{getItem:key=>memory.get(key)||null,setItem:(key,value)=>memory.set(key,value)},
  performance:{now:()=>now},setInterval:fn=>{timers.push(fn);return 1;},
  setTimeout:()=>1,clearTimeout:()=>{},CustomEvent:class{constructor(type,data){this.type=type;this.detail=data.detail;}},
  location:{origin:'https://example.test'},console
 };
 vm.runInNewContext(code,context,{filename:'window-heat-unified-v1.js'});
 return {heading,body,advance(ms){now+=ms;},lab:()=>body.children.find(x=>x.name==='dialog')};
}
test('Window Heat Test Lab opens only after three consecutive heading clicks/taps',()=>{
 const h=mount(),lab=h.lab();
 assert.ok(lab,'hidden test lab dialog should be mounted');
 assert.equal(lab.open,false,'lab starts hidden');
 h.heading.listeners.click();
 h.advance(250);h.heading.listeners.click();
 assert.equal(lab.open,false,'two taps must not open the lab');
 h.advance(250);h.heading.listeners.click();
 assert.equal(lab.open,true,'third tap opens the lab');
});
