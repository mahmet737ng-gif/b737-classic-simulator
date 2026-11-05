'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../panel-mosaic-lab/cockpit/engine-start-lever-model');
const file='panel-mosaic-lab/cockpit/engine-start-levers.js';
for(const id of ['engine1','engine2'])for(const t of [0,.1,.4,.7,1]){
 const g=M.geometry(id,t);assert.equal(g.pivotX,g.jointX,'Metal arms stay perfectly straight');
 assert.equal(g.pivotY,843,'Shaft does not move with the grip');
 assert.equal(g.y,M.DETENTS.CUTOFF-73*t);
 if(t>0&&t<1)assert.equal(M.detentAt(t),null,'No intermediate fuel detents');
}
for(const zoom of [.15,.5,1,2])assert.ok(Math.abs(M.dragTravel(0,100,100-73*zoom*.4,73*zoom)-.4)<1e-12);
let screenScale=.25;
class Node{
 constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.dataset={};this.style={};this.listeners=new Map();this.captured=null;}
 append(n){this.children.push(n);n.parentNode=this;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 addEventListener(k,fn){this.listeners.set(k,fn);}
 setPointerCapture(id){this.captured=id;}
 hasPointerCapture(id){return this.captured===id;}
 releasePointerCapture(){this.captured=null;}
 getBoundingClientRect(){return {width:parseFloat(this.style.width)*screenScale};}
 emit(type,more={}){const e={button:0,pointerType:'mouse',pointerId:1,clientY:100,stopPropagation(){},preventDefault(){},...more};this.listeners.get(type)?.(e);}
}
const native=new Node('div'),texture={offsetLeft:272,offsetTop:0,offsetWidth:606,offsetHeight:740.9857819905213};
native.querySelector=()=>texture;
const listeners=new Map(),commands=[];let allow=true;
const win={B737EngineStartLeverModel:M,addEventListener:(k,fn)=>listeners.set(k,fn),
 dispatchEvent(e){if(e.type==='b737:engine-start-lever-command'){
  commands.push(e.detail);
  if(allow){state[e.detail.device]=e.detail.position;feedback();}
 }else listeners.get(e.type)?.(e);}};
const state={engine1:'CUTOFF',engine2:'CUTOFF'};
function feedback(){win.dispatchEvent({type:'b737:engine-start-lever-state',detail:{levers:{...state}}});}
const context={window:win,document:{baseURI:'https://localhost/panel-mosaic-lab/cockpit/',querySelector:()=>native,
 createElement:tag=>new Node(tag),createElementNS:(ns,tag)=>new Node(tag)},URL,
 CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail;}}};
vm.runInNewContext(fs.readFileSync(file,'utf8'),context);win.dispatchEvent({type:'b737:cockpit-mounted'});
const buttons=native.children.filter(n=>n.tagName==='button'),first=buttons[0],second=buttons[1],api=win.B737EngineStartLevers;
assert.equal(buttons.length,2);assert.equal(first.attrs.role,'slider');
const art=native.children.find(n=>n.tagName==='svg');
for(const group of art.children.filter(n=>n.attrs['data-start-lever-assembly']))
 assert.equal(group.children.filter(n=>n.tagName==='circle').length,1,'Only the lower attachment exists; no top disk');
const span=73*(606/800)*screenScale;
first.emit('pointerdown');first.emit('pointermove',{clientY:100-span*.4});
assert.ok(Math.abs(api.getTravel('engine1')-.4)<1e-10);assert.equal(commands.length,0);
feedback();assert.ok(Math.abs(api.getTravel('engine1')-.4)<1e-10,'Feedback cannot overwrite the hand position');
first.emit('pointermove',{clientY:100-span});assert.equal(commands.length,1);assert.equal(api.getPosition('engine1'),'IDLE');
first.emit('pointermove',{clientY:100-span*1.2});assert.equal(commands.length,1,'No repeat command at a held detent');
first.emit('pointerup',{clientY:100-span});first.emit('click');assert.equal(commands.length,1,'Drag click cannot toggle it back');
assert.equal(api.getPosition('engine2'),'CUTOFF','Other engine independent');
first.emit('pointerdown');first.emit('pointermove',{clientY:100+span*.5});first.emit('pointercancel');
assert.equal(api.getTravel('engine1'),1,'Interrupted drag returns to last accepted detent');
assert.equal(commands.length,1);
allow=false;second.emit('pointerdown');second.emit('pointermove',{clientY:100-span});second.emit('pointerup',{clientY:100-span});
assert.equal(api.getPosition('engine2'),'CUTOFF');assert.equal(api.getTravel('engine2'),0,'Rejected command cannot latch a false IDLE');
allow=true;second.emit('keydown',{key:'ArrowUp'});assert.equal(api.getTravel('engine2'),.05);second.emit('keydown',{key:'Escape'});assert.equal(api.getTravel('engine2'),0);
second.emit('keydown',{key:'End'});assert.equal(api.getPosition('engine2'),'IDLE');second.emit('keydown',{key:'Home'});assert.equal(api.getPosition('engine2'),'CUTOFF');
// Touch drag follows the exact same continuous, zoom-correct path.
second.emit('pointerdown',{pointerType:'touch',pointerId:7});second.emit('pointermove',{pointerType:'touch',pointerId:7,clientY:100-span*.6});
assert.ok(Math.abs(api.getTravel('engine2')-.6)<1e-10);second.emit('pointercancel',{pointerId:7});
win.dispatchEvent({type:'b737:cockpit-mounted'});assert.equal(native.children.filter(n=>n.tagName==='button').length,2,'No duplicate mount');
console.log('PASS continuous start levers: straight arms, stationary shaft, scale-correct mouse/touch travel, authoritative endpoint-only fuel commands, no duplicate clicks, cancel/reject and keyboard.');
