'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const dir=__dirname;
const read=file=>fs.readFileSync(path.join(dir,file),'utf8');
const registry=JSON.parse(read('panel-photo-registry.v1.json'));
const entries=Object.keys(registry.panels).filter(key=>key.startsWith('OH21_')).sort();
assert.deepEqual(entries,['OH21_300500','OH21_400']);
const approved=registry.panels.OH21_400,classic=registry.panels.OH21_300500;
assert.equal(approved.layout,'dual-recirc');
assert.equal(classic.layout,'single-recirc');
assert.deepEqual(Object.keys(classic.controls).filter(x=>x.startsWith('recirc-fan')),['recirc-fan']);
assert.ok(Object.keys(approved.controls).includes('recirc-fan-l'));
assert.equal(approved.file,classic.file,'Exactly one owner-approved beige source photo');
assert.ok(classic.retired_photo.file.includes('300500'),'Old blue photo recorded only as archive');
assert.notEqual(classic.file,classic.retired_photo.file,'Retired blue source never active');
assert.deepEqual([approved.width,approved.height],[classic.width,classic.height]);

const photoScript=read('oh21-owner-photo-registration-v1.js');
const embeddedCss=read('overhead-embed.css');
const stage=read('overhead-stage.html');
const assembly=JSON.parse(read('assembly.json'));
assert.match(embeddedCss,/OH21 APPROVED-ONLY/);
assert.match(embeddedCss,/atlas-piece\[data-key="OH21"\] > \.atlas-image-window\{\s*visibility:hidden!important/);
assert.ok(photoScript.includes('NEUTRAL_BLANK')||photoScript.includes('neutral blank'));
assert.ok(photoScript.includes('singleRecircAppearance'));
assert.ok(photoScript.includes("detail?.file===asset.file"));
assert.ok(stage.includes('oh21-owner-photo-registration-v1.js?v=OH21-APPROVED-ONLY-20261103'));
assert.ok(stage.includes('overhead-embed.css?v=OH21-APPROVED-ONLY-20261103'));
assert.ok(assembly.regions.some(r=>r.id==='overhead'&&r.embeddedUrl.includes('oh21=APPROVED-ONLY-20261103')));
new vm.Script(photoScript,{filename:'oh21-owner-photo-registration-v1.js'});

class Node{
 constructor(tag){this.tag=tag;this.style={};this.dataset={};this.children=[];this.parentNode=null;this.attributes={};}
 append(...nodes){for(const node of nodes){if(node.parentNode)node.remove();node.parentNode=this;this.children.push(node)}}
 remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);this.parentNode=null}
 setAttribute(k,v){this.attributes[k]=String(v)}
 removeAttribute(k){delete this.attributes[k]}
 getAttribute(k){return this.attributes[k]??null}
 querySelectorAll(sel){
  if(sel.includes('oh21-single-recirc-removal')||sel.includes('oh21-single-recirc-title'))
   return this.children.filter(n=>['oh21-single-recirc-removal','oh21-single-recirc-title'].includes(n.className));
  return [];
 }
 querySelector(sel){return this.querySelectorAll(sel)[0]??null}
 get isConnected(){return !!this.parentNode}
}
async function mount(initial='B737-300-500',failImage=false){
 let created=0;
 const host=new Node('div');
 const piece=new Node('article');
 piece.style={left:'1724px',top:'1751px',width:'493px',height:'701px'};
 host.querySelector=(sel)=>sel==='.atlas-piece[data-key="OH21"]'?piece:null;
 host.querySelectorAll=()=>[];
 const root=new Node('html');
 const listeners={};
 const doc={
  baseURI:'https://example.org/panel-mosaic-lab/all-overhead/',
  documentElement:root,
  getElementById:id=>id==='atlasAbsolute'?host:null,
  createElement:tag=>new Node(tag)
 };
 const win={
  addEventListener:(type,cb)=>{(listeners[type]??=[]).push(cb)},
  dispatchEvent:()=>{}
 };
 class Image extends Node{
  constructor(){super('img');created++;this.naturalWidth=approved.width;this.naturalHeight=approved.height}
  set src(v){this._src=v;queueMicrotask(()=>failImage?this.onerror?.(new Error('unavailable')):this.onload?.())}
  get src(){return this._src}
 }
 const globals={
  document:doc,window:win,parent:win,location:{origin:'https://example.org'},
  localStorage:{getItem:key=>key==='b737classic.aircraft-profile.v1'?JSON.stringify({aircraftFamily:initial}):null},
  fetch:async()=>({ok:true,json:async()=>registry}),
  MutationObserver:class{observe(){}disconnect(){}},
  Image,URL,CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts?.detail}},
  requestAnimationFrame:()=>0,setInterval:()=>0,
  queueMicrotask,console:{warn:()=>{}}
 };
 vm.runInNewContext(photoScript,globals,{filename:'OH21 approved-only'});
 for(let i=0;i<12;i++)await Promise.resolve();
 return {win,host,listeners,created:()=>created};
}
(async()=>{
 const p=await mount();
 let state=p.win.B737OH21OwnerPhotoV1.status();
 assert.equal(state.active,'OH21_300500');assert.equal(state.asset,approved.file);
 assert.equal(p.host.children.length,1,'One and only one photo node');
 assert.equal(p.host.children[0].children.length,3,'Approved photo plus 300/500 mask and label');
 assert.equal(p.created(),1);
 for(const family of ['B737-400','B737-300-500','B737-400']){
  for(const handler of p.listeners.message||[])handler({origin:'https://example.org',source:p.win,
   data:{type:'b737:cockpit-command',action:'aircon-background',family}});
  state=p.win.B737OH21OwnerPhotoV1.status();
  assert.equal(state.active,family==='B737-400'?'OH21_400':'OH21_300500');
  assert.equal(p.host.children.length,1,'Never stack old or new photo layers');
  const expected=family==='B737-400'?1:3;
  assert.equal(p.host.children[0].children.length,expected,'Only correct fan markings');
 }
 assert.equal(p.created(),1,'Family switching reuses the approved image');
 const fail=await mount('B737-300-500',true);
 assert.equal(fail.win.B737OH21OwnerPhotoV1.status().failed,true);
 assert.equal(fail.host.children.length,0,'No forbidden old fallback after image error');
 console.log('PASS: exactly two live OH21 configurations; approved beige source only; 400 dual / 300-500 single RECIRC; atomic switch; retired blue blank-on-error.');
})().catch(error=>{console.error(error);process.exitCode=1});
