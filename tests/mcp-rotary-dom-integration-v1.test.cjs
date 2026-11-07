'use strict';
/* Production MCP visual + hardware DOM integration. NO replacement renderers.
 * Simulates actual pointerdown/move/up on all five real mounted knob DOM nodes
 * and the V/S wheel; verifies live values and FCOM detents (including IAS/MACH).
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.resolve(__dirname,'..');
const load=p=>fs.readFileSync(path.join(dir,p),'utf8');
const Rules=require('../engine/afds/mcp-fcom-ch4-numeric-v1.js');
const Gesture=require('../panel-mosaic-lab/cockpit/mcp-rotary-gesture-v1.js');
class Node{
 constructor(tag){this.tag=tag;this.children=[];this.dataset={};this.attrs={};this.listeners={};
  this.style={setProperty(k,v){this[k]=v}};this.className='';this.captured=0;}
 append(...nodes){for(const child of nodes){child.parent=this;this.children.push(child)}}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this)}
 setAttribute(k,v){this.attrs[k]=String(v)}
 getAttribute(k){return this.attrs[k]}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}
 fire(k,event){for(const fn of this.listeners[k]||[])fn(event)}
 querySelector(q){if(q==='defs')return this.children.find(x=>x.tag==='defs');return null}
 querySelectorAll(q){
  const all=[];const walk=p=>{for(const x of p.children){all.push(x);walk(x)}};walk(this);
  if(q==='.mcp-v3-knob')return all.filter(x=>x.className.includes('mcp-v3-knob'));
  if(q==='.mcp-hw')return all.filter(x=>x.className.includes('mcp-hw'));
  if(q==='[data-mcp-display]')return all.filter(x=>x.attrs['data-mcp-display']);
  if(q==='clipPath[id^=mcp-v5-]')return all.filter(x=>x.tag==='clipPath'&&x.attrs.id?.startsWith('mcp-v5-'));
  return [];
 }
 getBoundingClientRect(){return {left:0,top:0,
  width:this.className.includes('wheel')?55:100,
  height:this.className.includes('wheel')?170:100}}
 focus(){}
 setPointerCapture(id){this.captured=id}
 hasPointerCapture(id){return this.captured===id}
 releasePointerCapture(id){this.captured=0;this.fire('lostpointercapture',{pointerId:id})}
}
class CustomEventMock{constructor(type,o={}){this.type=type;this.detail=o.detail}}
const panel=new Node('section'),listeners={};
const window={
 B737McpFCOMCh4NumericV1:Rules,B737McpRotaryGestureV1:Gesture,
 addEventListener(k,f){(listeners[k]??=[]).push(f)},
 dispatchEvent(e){for(const fn of listeners[e.type]||[])fn(e)}
};
const document={
 currentScript:{src:'https://example.test/cockpit/mcp-visual-v3.js'},
 readyState:'complete',body:new Node('body'),
 querySelectorAll:q=>q==='[data-piece="mcp"]'?[panel]:[],
 createElement:t=>new Node(t),createElementNS:(ns,t)=>new Node(t),
 addEventListener(){},getElementById(){return null}
};
const fire=(el,k,x,y,t,id=1)=>el.fire(k,{
 pointerId:id,pointerType:'touch',button:0,timeStamp:t,
 clientX:x,clientY:y,deltaY:-100,deltaMode:0,
 preventDefault(){},stopPropagation(){},stopImmediatePropagation(){}
});
new Function('window','document','location','CustomEvent',
 load('panel-mosaic-lab/cockpit/mcp-visual-v3.js'))(
 window,document,{search:''},CustomEventMock);
new Function('window','document','location','CustomEvent',
 load('panel-mosaic-lab/cockpit/mcp-hardware-v1.js'))(
 window,document,{search:''},CustomEventMock);
const knobs=panel.querySelectorAll('.mcp-v3-knob'),vsc=panel.querySelectorAll('.mcp-hw')
 .find(x=>x.dataset.mcpHardware==='VS_WHEEL');
assert.deepEqual(knobs.map(x=>x.dataset.control),['courseL','speed','heading','altitude','courseR']);
assert.ok(vsc);
const get=()=>window.B737McpVisualV3.getState();
const emitted=[];
window.addEventListener('b737:mcp-value-change',e=>emitted.push(e.detail));
let pointer=0;
function tap(el,x=75,y=50){
 const id=++pointer;
 fire(el,'pointerdown',x,y,0,id);
 fire(el,'pointerup',x,y,10,id);
}
function swipe(el,dx,dy,ms,ox=50,oy=50){
 const id=++pointer;
 fire(el,'pointerdown',ox,oy,0,id);
 fire(el,'pointermove',ox+dx,oy+dy,ms,id);
 fire(el,'pointerup',ox+dx,oy+dy,ms+1,id);
}
for(const knob of knobs){
 const id=knob.dataset.control,old=get()[id];
 tap(knob);
 assert.equal(get()[id],Rules.step(id,old,1),id+' tap should update display exactly one FCOM step');
}
assert.equal(emitted.length,5);
assert.ok(emitted.every(e=>e.method==='tap'));
const speed=knobs.find(x=>x.dataset.control==='speed');
window.B737McpVisualV3.setValue('speed',180);
swipe(speed,40,0,400);
const slow=get().speed-180;
window.B737McpVisualV3.setValue('speed',180);
swipe(speed,40,0,14);
const fast=get().speed-180;
assert.ok(slow>0&&fast>slow*2,'fast 40px swipe must turn more than slow 40px swipe');
const courseL=knobs.find(x=>x.dataset.control==='courseL');
const oldCourse=get().courseL;
swipe(courseL,0,-30,100);
assert.ok(get().courseL>oldCourse,'vertical swipe works for COURSE');
const heading=knobs.find(x=>x.dataset.control==='heading');
const oldHeading=get().heading;
swipe(heading,-30,0,100);
assert.ok(get().heading<oldHeading,'left swipe turns HEADING lower');
window.B737McpVisualV3.setSpeedMode('MACH');
const machBefore=get().machHundredths;
tap(speed);
assert.equal(get().machHundredths,machBefore+1,'same IAS knob turns MACH .01 after C/O');
window.B737McpVisualV3.setValue('machHundredths',82);
tap(speed);
assert.equal(get().machHundredths,82,'MACH max remains .82');
window.B737McpVisualV3.setSpeedMode('IAS');
window.B737McpVisualV3.setValue('altitude',50000);
tap(knobs.find(x=>x.dataset.control==='altitude'));
assert.equal(get().altitude,50000,'ALT limiter remains 50000');
const vsBefore=get().verticalSpeed;
tap(vsc,30,20);
assert.equal(get().verticalSpeed,vsBefore+50,'V/S top tap = +50 fpm');
swipe(vsc,0,-60,40,30,80);
assert.ok(get().verticalSpeed>50,'V/S wheel upward swipe increases');
assert.ok(emitted.some(e=>e.control==='verticalSpeed'));
// Actual output change reaches the event bus used by the independent
// amber seven-segment renderer and AFDS bridge, never a fake text overlay.
assert.ok(emitted.some(e=>e.control==='courseL'&&e.method==='tap'));
assert.ok(emitted.some(e=>e.control==='machHundredths'&&e.method==='tap'));
assert.ok(emitted.some(e=>e.control==='altitude'&&e.method==='tap'));
console.log('MCP DOM PASS: five mounted knobs and V/S with direct tap/swipe/wheel, velocity and FCOM IAS/MACH/ALT/VS changes');
