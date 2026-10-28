'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const base=__dirname;
const code=fs.readFileSync(path.join(base,'irs-rotary-detent-indices-v1.js'),'utf8');
const css=fs.readFileSync(path.join(base,'irs-rotary-detent-indices-v1.css'),'utf8');
const upper=fs.readFileSync(path.join(base,'irs-upper-dspl-v1.js'),'utf8');
const msu=fs.readFileSync(path.join(base,'irs-trainer-unified-v1.css'),'utf8');
const page=fs.readFileSync(path.join(base,'index.html'),'utf8');
class Element{
 constructor(name){this.nodeName=name;this.childNodes=[];this.attrs={};this.dataset={};this.style={};this.classList={add:(...classes)=>{this.classes.push(...classes)}};this.classes=[];this.id='';}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='class')this.classes=String(v).split(/\s+/).filter(Boolean);}
 appendChild(n){this.childNodes.push(n);return n;}
 insertBefore(n,ref){let i=this.childNodes.indexOf(ref);if(i<0)throw Error('Bad ref');this.childNodes.splice(i,0,n);return n;}
 querySelectorAll(selector){
  const result=[];const match=n=>{
   if(selector.startsWith('.'))return n.classes.includes(selector.slice(1));
   if(selector.startsWith('[')){const m=selector.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);return m&&n.attrs[m[1]]!==undefined&&(m[2]===undefined||n.attrs[m[1]]===m[2]);}
   return false;
  };
  const visit=n=>{for(const ch of n.childNodes){if(match(ch))result.push(ch);visit(ch)}};
  visit(this);return result;
 }
 querySelector(s){return this.querySelectorAll(s)[0]||null}
}
function fixture(){
 const upperMount=new Element('div'),outer=new Element('div'),msuMount=new Element('div');
 outer.classes.push('irs-upper-mode-rotor');upperMount.appendChild(outer);
 const left=new Element('button'),right=new Element('button');
 left.attrs['data-msu-mini']='L';right.attrs['data-msu-mini']='R';
 left.dataset.mode='OFF';right.dataset.mode='NAV';msuMount.appendChild(left);msuMount.appendChild(right);
 const map=new Map([['irsUpperDsplMounted',upperMount],['irsTrainerMSU',msuMount]]);
 const document={readyState:'complete',getElementById:k=>map.get(k),
  createElementNS:(_ns,tag)=>new Element(tag),documentElement:new Element('html')};
 const events=new Map(),window={B737IRSDisplaySelector:{
  geometry:{modeAngles:[0,35,65,125,150]},getState:()=>({mode:'PPOS'})
 },addEventListener:(k,fn)=>events.set(k,fn)};
 vm.runInNewContext(code,{window,document,MutationObserver:class{observe(){throw Error('Should not need observer with all controls mounted')}},Math},{timeout:1500});
 return {window,upperMount,outer,msuMount,left,right,events};
}
test('exact five stationary DSPL SEL ticks match all five existing angular detents',()=>{
 const f=fixture();const a=f.window.B737IRSRotaryIndices.audit();
 assert.deepEqual(a.map(x=>x.tickCount),[5,4,4]);
 assert.deepEqual(a.map(x=>x.pointerCount),[1,1,1]);assert(a.every(x=>x.pass));
 const fixed=f.upperMount.querySelector('[data-irs-tick-bank="upper"]');
 assert.equal(f.upperMount.childNodes[0],fixed,'Fixed tick plate must be before the moving rotor');
 assert.equal(f.outer.querySelectorAll('.irs-rotary-reference-pointer').length,1,'Reference pointer must be on moving outer rotor');
 assert.equal(f.upperMount.querySelectorAll('[data-detent-index="0"]').length,1);
 assert.equal(f.upperMount.querySelectorAll('[data-detent-index="4"]').length,1);
 const lines=f.upperMount.querySelectorAll('.irs-detent-tick');
 for(const [index,line]of lines.entries()){
  const from=[Number(line.attrs.x1)-44,Number(line.attrs.y1)-44];
  const theta=Math.atan2(from[1],from[0])*180/Math.PI;
  const expected=(180+[0,35,65,125,150][index])*Math.PI/180;
  assert(Math.abs(Math.cos(theta*Math.PI/180)-Math.cos(expected))<1e-4);
  assert(Math.abs(Math.sin(theta*Math.PI/180)-Math.sin(expected))<1e-4);
 }
 const ink=f.outer.querySelector('.irs-index-ink');
 assert.equal(ink.attrs.stroke,'#07090a');
 assert(Number(ink.attrs['stroke-width'])>=3.5,'Black index must be visible when scaled down');
});
test('four white ticks and single black pointer are independently installed on both MSU rotaries',()=>{
 const f=fixture();
 for(const side of [f.left,f.right]){
  const lines=side.querySelectorAll('.irs-detent-tick');
  assert.equal(lines.length,4);
  assert.deepEqual(lines.map(x=>x.attrs['data-detent-mode']),['OFF','ALIGN','NAV','ATT']);
  assert.equal(side.querySelectorAll('.irs-index-ink').length,1);
 }
 for(const [mode,angle]of [['OFF',-115],['ALIGN',-40],['NAV',24],['ATT',88]]){
  assert(msu.includes('.irs-msu-mini[data-mode="'+mode+'"]{--irs-msu-angle:'+angle+'deg}'));
 }
 assert(css.includes('rotate(var(--irs-msu-angle,-115deg))'),'Pointer should follow the existing angular state');
});
test('extra visual marks do not change detents or duplicate on repeated cockpit mounts',()=>{
 const f=fixture();f.events.get('b737:cockpit-mounted')();f.window.B737IRSRotaryIndices.install();
 assert.equal(f.upperMount.querySelectorAll('.irs-detent-tick').length,5);
 assert.equal(f.msuMount.querySelectorAll('.irs-detent-tick').length,8);
 assert.equal(f.msuMount.querySelectorAll('.irs-index-ink').length,2);
 assert(upper.includes('const ANGLES=Object.freeze([0,35,65,125,150])'));
 assert(upper.includes('irs-upper-mode-rotor'));
 assert(!code.includes('irsSysDsplMounted'),'Must never modify locked lower SYS DSPL');
 assert(!code.includes('dispatchEvent'),'Must not synthesize control events or electrical state');
 assert(!/\.irs-sys-dspl|#irsSysDsplMounted/.test(css),'Must not style locked SYS DSPL');
 assert(page.includes('irs-rotary-detent-indices-v1.js?v=IRS-INDEX-0001'));
 assert(page.includes('irs-rotary-detent-indices-v1.css?v=IRS-INDEX-0001'));
});
