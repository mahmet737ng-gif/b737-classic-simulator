'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const base=__dirname;
function runtime(){
 class Node{
  constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.dataset={};this.style={setProperty(k,v){this[k]=v;}};this.events={};this.className='';}
  setAttribute(k,v){this.attrs[k]=v;if(k==='class')this.className=v;}
  append(...nodes){this.children.push(...nodes);for(const n of nodes)n.parentNode=this;}
  querySelector(sel){const ok=n=>sel[0]==='#'?n.id===sel.slice(1):sel[0]==='.'?n.className.split(' ').includes(sel.slice(1)):n.tag===sel;for(const n of this.children){if(ok(n))return n;const r=n.querySelector?.(sel);if(r)return r;}return null;}
  addEventListener(n,fn){(this.events[n]??=[]).push(fn);}
  getBoundingClientRect(){return {width:88,height:79};}
  setPointerCapture(){} focus(){}
  fire(n,data={}){const event={button:0,pointerType:'mouse',pointerId:1,clientX:0,clientY:0,currentTarget:this,preventDefault(){},stopPropagation(){},...data};for(const fn of this.events[n]||[])fn(event);}
 }
 const region=new Node('section');region.id='region-overhead';const events=[];
 const document={readyState:'complete',documentElement:new Node('html'),getElementById:id=>id==='region-overhead'?region:null,createElement:t=>new Node(t),createElementNS:(ns,t)=>new Node(t),querySelectorAll:()=>[]};
 const window={addEventListener(){},dispatchEvent:e=>events.push(e)};
 const CustomEvent=class{constructor(type,args){this.type=type;this.detail=args.detail;}};
 vm.runInNewContext(fs.readFileSync(path.join(base,'irs-upper-dspl-v1.js'),'utf8'),{window,document,CustomEvent});
 const api=window.B737IRSDisplaySelector,root=api.getElement();
 return {api,root,region,events,outer:root.querySelector('.irs-upper-mode-control'),inner:root.querySelector('.irs-upper-brt-control')};
}
test('mode and brightness use independent state, pivots and rotor transforms',()=>{
 const {api,root}=runtime();const b=api.getState();
 assert.equal(b.mode,'PPOS');assert.equal(b.brightness,82);
 const inner=root.querySelector('.irs-upper-brt-rotor'),outer=root.querySelector('.irs-upper-mode-rotor');
 const innerBefore=inner.style.transform;api.setMode('HDG/STS');assert.equal(inner.style.transform,innerBefore);assert.equal(api.getState().brightness,82);
 const outerBefore=outer.style.transform;api.setBrightness(24);assert.equal(outer.style.transform,outerBefore);assert.equal(api.getState().mode,'HDG/STS');assert.notEqual(inner.style.transform,innerBefore);
 assert.equal(api.geometry.pivot[0],.5);assert.equal(api.geometry.pivot[1],.5);
 assert.throws(()=>api.setMode('NAV'));assert.throws(()=>api.setBrightness(NaN));assert.equal(api.setBrightness(130),100);assert.equal(api.setBrightness(-2),0);
});
test('outer keyboard/click and inner wheel/keyboard never change the other axis',()=>{
 const {api,outer,inner}=runtime();outer.fire('keydown',{key:'ArrowRight'});assert.equal(api.getState().mode,'WIND');assert.equal(api.getState().brightness,82);
 inner.fire('wheel',{deltaY:1});assert.equal(api.getState().brightness,84);assert.equal(api.getState().mode,'WIND');
 outer.fire('click',{shiftKey:true});assert.equal(api.getState().mode,'PPOS');assert.equal(api.getState().brightness,84);
 inner.fire('keydown',{key:'Home'});assert.equal(api.getState().brightness,0);assert.equal(api.getState().mode,'PPOS');
 inner.fire('wheel',{deltaY:10,ctrlKey:true});assert.equal(api.getState().brightness,0,'Ctrl+wheel belongs to viewport zoom');
 assert.equal(outer.attrs['aria-valuetext'],'PPOS');assert.equal(inner.attrs['aria-valuetext'],'0%');
});
test('separate simultaneous pointers change their own knob only; drag does not add a click step',()=>{
 const {api,outer,inner,events}=runtime();outer.fire('pointerdown',{pointerId:1});inner.fire('pointerdown',{pointerId:2});
 outer.fire('pointermove',{pointerId:1,clientX:19});assert.equal(api.getState().mode,'WIND');assert.equal(api.getState().brightness,82);
 inner.fire('pointermove',{pointerId:2,clientX:-20});assert.equal(api.getState().brightness,70);assert.equal(api.getState().mode,'WIND');
 outer.fire('pointerup',{pointerId:1});outer.fire('click');assert.equal(api.getState().mode,'WIND');
 inner.fire('pointercancel',{pointerId:2});assert.equal(api.getState().brightness,70);
 assert.ok(events.every(e=>e.detail.frontendOnly===true));
});
test('black reference line rotates with the OUTER part, while BRT image remains independent',()=>{
 const {root,api}=runtime();const outer=root.querySelector('.irs-upper-mode-rotor'),inner=root.querySelector('.irs-upper-brt-rotor');
 assert.ok(outer.querySelector('svg'));assert.equal(inner.querySelector('svg'),null);
 const line=outer.querySelector('line');assert.equal(line.attrs.stroke,'#101010');assert.equal(line.attrs.y1,line.attrs.y2);assert.equal(line.attrs.y1,'499');assert.equal(line.attrs.x1,'104');assert.equal(line.attrs.x2,'152');
 const before=inner.style.transform;api.setMode('TEST');assert.equal(inner.style.transform,before);assert.equal(outer.style.transform,'rotate(0deg)');
});
test('actual source bore registration, alpha PNGs and mount idempotence are preserved',()=>{
 const {api,region}=runtime();api.mount();assert.equal(region.children.filter(n=>n.id==='irsUpperDsplMounted').length,1);
 const g=api.geometry;assert.ok(Math.abs(g.center.x-(3+471.454545*2214/1731))<1e-7);assert.ok(Math.abs(g.center.y-(3+368.699675*1019/909))<1e-7);
 const meta=JSON.parse(fs.readFileSync(path.join(base,'irs-upper-dspl-v1.json')));
 for(const [name,spec]of Object.entries(meta.assets)){const b=fs.readFileSync(path.join(base,'assets',name));assert.equal(b.toString('ascii',1,4),'PNG');assert.equal(b.readUInt32BE(16),1774);assert.equal(b.readUInt32BE(20),887);assert.equal(b[25],6,'RGBA alpha PNG');assert.equal(crypto.createHash('sha256').update(b).digest('hex'),spec.sha256);}
 const html=fs.readFileSync(path.join(base,'index.html'),'utf8');assert.equal(html.split('irs-upper-dspl-v1.js?v=IRS-UPPER-0003').length-1,1);assert.equal(html.split('irs-upper-dspl-v1.css?v=IRS-UPPER-0003').length-1,1);
});
