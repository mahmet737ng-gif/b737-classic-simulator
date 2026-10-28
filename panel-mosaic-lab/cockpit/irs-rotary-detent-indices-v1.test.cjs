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
 left.dataset.mode='OFF';right.dataset.mode='NAV';
 for(const knob of [left,right]){const photo=new Element('img');photo.classes.push('irs-msu-owner-photo');knob.appendChild(photo);}
 msuMount.appendChild(left);msuMount.appendChild(right);
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
 assert.deepEqual(Array.from(a,x=>x.tickCount),[5,0,0]);
 assert.deepEqual(Array.from(a,x=>x.pointerCount),[1,0,0]);assert(a.every(x=>x.pass));
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
test('IRS L/R reuse the approved photo: no extra white ticks or fake pointer on either selector',()=>{
 const f=fixture();
 for(const knob of [f.left,f.right]){
  assert.equal(knob.querySelectorAll('.irs-detent-tick').length,0);
  assert.equal(knob.querySelectorAll('.irs-index-ink').length,0);
  assert(knob.querySelector('.irs-msu-owner-photo'));
  assert.equal(knob.dataset.irsIndexVersion,'IRS-INDEX-0002');
 }
 const app=fs.readFileSync(path.join(base,'irs-trainer-unified-v1.js'),'utf8');
 const manifest=JSON.parse(fs.readFileSync(path.join(base,'../assets/locked/2026-10-23/Switches/Rotary/rotary-standard-v1.json'),'utf8'));
 assert.equal(manifest.status,'approved');
 assert.equal(manifest.rendering.rotate_entire_sprite,true);
 assert.equal(manifest.rendering.css_transform_origin,'50% 44%');
 assert(app.includes("photo.src='../assets/locked/2026-10-23/Switches/Rotary/rotary-standard-v1.webp'"));
 assert(app.includes("b.append(photo)"),'Each actual MSU hotspot must mount one photographic sprite');
 assert(msu.includes('transform-origin:50% 44%'));
 assert(msu.includes('transform:rotate(var(--irs-msu-angle,-70deg))'));
 assert(!msu.includes('background:radial-gradient(circle at 34%'),'No gradient cartoon circular selector');
 assert(!css.includes('.irs-rotary-fixed-ticks-msu'),'No extra painted MSU white lines');
 assert(!css.includes('.irs-rotary-reference-pointer-msu'),'No overlaid MSU reference pointer');
});

test('four deterministic positions aim the photo pointer at OFF ALIGN NAV ATT labels',()=>{
 const angle={OFF:-70,ALIGN:-38,NAV:25,ATT:69};
 const expectedRay={OFF:-160,ALIGN:-128,NAV:-65,ATT:-21};
 for(const mode of ['OFF','ALIGN','NAV','ATT']){
  const needleRay=-90+angle[mode]; // approved photo pointer is upright at 0 rotation
  assert.equal(needleRay,expectedRay[mode]);
  assert(msu.includes('.irs-msu-mini[data-mode="'+mode+'"]{--irs-msu-angle:'+angle[mode]+'deg}'));
 }
 assert.deepEqual(Object.keys(angle),['OFF','ALIGN','NAV','ATT']);
 assert(!code.includes("appendChild(tickFace('msu'"));
 assert(!code.includes("appendChild(pointerFace('msu'"));
});

test('repeated cockpit mounts keep photographic selectors isolated from locked SYS DSPL and 18 guards',()=>{
 const f=fixture();
 f.events.get('b737:cockpit-mounted')();f.window.B737IRSRotaryIndices.install();
 assert.equal(f.upperMount.querySelectorAll('.irs-detent-tick').length,5);
 assert.equal(f.msuMount.querySelectorAll('.irs-detent-tick').length,0);
 assert.equal(f.msuMount.querySelectorAll('.irs-index-ink').length,0);
 assert.equal(f.msuMount.querySelectorAll('.irs-msu-owner-photo').length,2);
 assert(upper.includes('const ANGLES=Object.freeze([0,35,65,125,150])'));
 assert(!code.includes('irsSysDsplMounted'),'Must never modify locked lower SYS DSPL');
 assert(!code.includes('dispatchEvent'),'No synthetic control events');
 assert(!/\\.irs-sys-dspl|#irsSysDsplMounted/.test(css),'No styling of owner-locked SYS DSPL');
 assert(page.includes('irs-rotary-detent-indices-v1.js?v=IRS-INDEX-0002'));
 assert(page.includes('irs-rotary-detent-indices-v1.css?v=IRS-INDEX-0002'));
 assert(page.includes('irs-trainer-unified-v1.css?v=IRS-LIVE-0002-MSU-PHOTO'));
});
