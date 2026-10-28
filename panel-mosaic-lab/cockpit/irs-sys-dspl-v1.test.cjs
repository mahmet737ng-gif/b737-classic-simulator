'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const vm=require('node:vm');
const read=p=>fs.readFileSync(path.join(__dirname,p),'utf8');
const html=read('index.html'),js=read('irs-sys-dspl-v1.js'),css=read('irs-sys-dspl-v1.css');
const photo=fs.readFileSync(path.join(__dirname,'assets/irs-sys-dspl-selector-approved-v1.avif'));
assert(photo.length>=2700,'Approved source photo is too small or missing');
assert.equal(photo.toString('ascii',4,12),'ftypavif','Selected asset must be AVIF');
assert(html.includes('irs-sys-dspl-v1.css?v=IRS-SYS-0001'));
assert(html.includes('irs-sys-dspl-v1.js?v=IRS-SYS-0001'));
assert(!js.includes('B737ElectricalV7.apply'),'IRS visual selector must not call electrical engine');
assert(!js.includes('B737IRS.apply'),'IRS visual selector must not update IRS backend');
assert.match(css,/\.irs-sys-dspl-mount\[data-system="L"\].*rotate\(-33deg\)/);
assert.match(css,/\.irs-sys-dspl-mount\[data-system="R"\].*rotate\(33deg\)/);
assert.match(js,/const centerSource=Object\.freeze\(\{x:471\.27,y:469\.53\}\)/);
assert.match(js,/sourceWidth:1731,sourceHeight:909,atlasWidth:2214,atlasHeight:1019/);
assert.match(css,/\.reference-mode #region-overhead \.irs-sys-dspl-mount\{display:none\}/);
assert.match(js,/frontendOnly:true/);
const x=3+471.27*2214/1731,y=3+469.53*1019/909;
const ww=70.4,hh=63;
assert(x-ww/2>0&&y-hh/2>0);
assert(Math.abs(x-3-471.27*2214/1731)<.01);
const source=fs.readFileSync(path.join(__dirname,'../assets/locked/2026-10-23/OH01-06-source-9d8ac0ac86bd.png'));
assert.equal(crypto.createHash('sha256').update(source).digest('hex'),'9d8ac0ac86bdb92c040e9bdd97811ca381535d949bff94aa5b1a01e5de8e23df');
const listeners={};
const emitted=[];
class CustomEvent{constructor(type,options){this.type=type;this.detail=options.detail;}}
function element(tag){
 return {
  tag,children:[],style:{},dataset:{},attributes:{},listeners:{},parentNode:null,
  append(child){child.parentNode=this;this.children.push(child);},
  setAttribute(key,val){this.attributes[key]=val;},
  querySelector(sel){
   if(sel==='.irs-sys-dspl-switch')return this.children.find(n=>n.className==='irs-sys-dspl-switch')||null;
   if(sel==='#irsSysDsplMounted')return this.children.find(n=>n.id==='irsSysDsplMounted')||null;
   return null;
  },
  addEventListener(name,fn){this.listeners[name]=fn;},
  setPointerCapture(){}
 };
}
const region=element('section');region.id='region-overhead';
const doc={
 readyState:'loading',
 addEventListener(name,fn){listeners[name]=fn;},
 getElementById(name){return name==='region-overhead'?region:null;},
 createElement:element
};
const win={dispatchEvent(e){emitted.push(e);},addEventListener(){}};
vm.runInNewContext(js,{window:win,document:doc,CustomEvent,MutationObserver:class{}},{timeout:2000});
const api=win.B737IRSSysDspl;
assert(api);
listeners.DOMContentLoaded();
assert(region.children.length===1,'One selector should be mounted');
const holder=region.children[0],btn=holder.children[0],img=btn.children[0];
assert.equal(holder.dataset.backend,'DISCONNECTED');
assert.equal(holder.dataset.system,'L');
assert.equal(img.src,'./assets/irs-sys-dspl-selector-approved-v1.avif');
assert(Math.abs(parseFloat(holder.style.left)+ww/2-x)<.02);
assert(Math.abs(parseFloat(holder.style.top)+hh/2-y)<.02);
const event=(name,props={})=>btn.listeners[name]({button:0,pointerType:'mouse',pointerId:1,currentTarget:btn,stopPropagation(){},preventDefault(){},...props});
event('click');
assert.equal(api.getSystem(),'R');
event('keydown',{key:'ArrowLeft'});
assert.equal(api.getSystem(),'L');
event('keydown',{key:'End'});
assert.equal(api.getSystem(),'R');
event('wheel',{deltaY:-100});
assert.equal(api.getSystem(),'L');
event('wheel',{deltaY:100});
assert.equal(api.getSystem(),'R');
event('pointerdown',{clientX:120,clientY:0});
event('pointermove',{clientX:100,clientY:0});
event('pointerup',{clientX:100,clientY:0});
assert.equal(api.getSystem(),'L');
event('click');
assert.equal(api.getSystem(),'L','Drag must not cause an extra click toggle');
assert.throws(()=>api.setSystem('NAV'),/L or R only/);
assert(emitted.some(e=>e.type==='b737:irs-sys-dspl-visual-change'&&e.detail.frontendOnly===true));
assert.equal(api.mount(),holder,'Mount must be idempotent');
assert.equal(region.children.length,1,'No duplicate selector');
console.log('IRS SYS DSPL PASS: approved AVIF, source-photo center, 2 positions, click/drag/wheel/keyboard, independent unchanged guards');
