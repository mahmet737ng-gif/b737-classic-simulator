const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const crypto=require('node:crypto');
const path=require('node:path');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'irs-panel-registration-v1.json')));
const code=fs.readFileSync(path.join(__dirname,'irs-panel-registration-v1.js'),'utf8');
function fixture(){
 const nodes=new Map(),events=new Map();
 class Node{
  constructor(id=''){this.id=id;this.dataset={};this.style={setProperty(k,v){this[k]=v}};this.classList={add(){}};this.children=[];this.offsetWidth=2220;}
  setAttribute(){}
  append(...ns){this.children.push(...ns);for(const n of ns)if(n.id)nodes.set(n.id,n);}
  querySelector(s){if(s.startsWith('#'))return nodes.get(s.slice(1));return this.querySelectorAll(s)[0];}
  querySelectorAll(s){
   if(s.includes('.irs-photo-key'))return keys;
   if(s==='[data-msu-mini]')return buttons;
   if(s.includes('[data-msu-mini='))return buttons.filter(n=>s.includes('"'+n.dataset.msuMini+'"'));
   if(s==='.irs-msu-phys-lamp')return lamps;
   return [];
  }
  getBoundingClientRect(){const s=this.style;return {left:parseFloat(s.left)||0,top:parseFloat(s.top)||0,width:parseFloat(s.width)||2220,height:parseFloat(s.height)||3300};}
 }
 const region=new Node('region-overhead');nodes.set(region.id,region);
 for(const id of ['irsUpperDsplMounted','irsTrainerMSU'])nodes.set(id,new Node(id));
 const keys=Object.keys(data.keys).map(k=>{const n=new Node();n.dataset.isduKey=k;return n;});
 const buttons=['L','R'].map(k=>{const n=new Node();n.dataset.msuMini=k;return n;});
 const lamps=Object.keys(data.lamps).map(k=>{const n=new Node();n.dataset.irsPhysical=k;return n;});
 for(const [id,p,w,h] of [['irsSysDsplMounted',data.fixedSys,70.4,63],['irsSegmentDisplayMounted',data.fixedDisplay,299*2214/1731,39*1019/909]]){
  const n=new Node(id);Object.assign(n.style,{left:p.cx-w/2,top:p.cy-h/2,width:w,height:h});
  n.style=new Proxy(n.style,{set(){throw Error('Attempt to change frozen '+id);}});nodes.set(id,n);
 }
 const document={readyState:'complete',documentElement:{dataset:{}},getElementById:id=>nodes.get(id),createElement:()=>new Node()};
 class Image{constructor(){this.complete=true;this.naturalWidth=1097;this.naturalHeight=1434;}set src(s){this._src=s;this.onload?.();}get src(){return this._src;}}
 const window={addEventListener:(n,f)=>events.set(n,f),console};
 const context={window,document,Image,fetch:async()=>({ok:true,json:async()=>data}),MutationObserver:class{observe(){}disconnect(){}}};
 vm.runInNewContext(code,context);
 return {window,nodes,keys,buttons,lamps,events};
}
test('uploaded panel PNG is byte-identical to the selected owner image',()=>{
 const png=fs.readFileSync(path.join(__dirname,'assets',data.asset));
 assert.equal(crypto.createHash('sha256').update(png).digest('hex'),data.sha256);
 assert.equal(png.readUInt32BE(16),data.image.width);assert.equal(png.readUInt32BE(20),data.image.height);
});
test('all 25 actual mounts register to their aperture centers without writing frozen styles',async()=>{
 const f=fixture();await new Promise(setImmediate);
 const a=f.window.B737IRSPanelRegistration.audit();
 assert.equal(a.ready,true);assert.equal(a.targets.length,25);assert.ok(a.maxErrorNativePx<1e-9);
 assert.equal(f.nodes.get('region-overhead').dataset.irsPanelVersion,data.version);
 for(const key of f.keys){
  const s=key.style,p=data.keys[key.dataset.isduKey].native;
  // The original black-cap mask has a y center of 70/138, not 1/2.
  assert.ok(Math.abs(parseFloat(s.left)+parseFloat(s.width)/2-p.cx)<1e-9);
  assert.ok(Math.abs(parseFloat(s.top)+parseFloat(s.height)*70/138-p.cy)<1e-9);
 }
 const frozen=f.nodes.get('irsSysDsplMounted');assert.equal(frozen.style.width,70.4);assert.equal(frozen.style.height,63);
});
test('repeated cockpit mount keeps one panel and preserves existing control nodes and lamp authority',async()=>{
 const f=fixture();await new Promise(setImmediate);
 const layer=f.nodes.get('irsBarePanelRegistered'),key=f.keys[0],lamp=f.lamps[0];
 f.events.get('b737:cockpit-mounted')();f.events.get('b737:cockpit-mounted')();
 assert.equal(f.nodes.get('irsBarePanelRegistered'),layer);assert.equal(f.keys[0],key);assert.equal(f.lamps[0],lamp);
 f.events.get('b737:visual-test')({detail:{active:true}});
 assert.equal(f.nodes.get('region-overhead').dataset.irsPanelTest,'true');
 f.events.get('b737:visual-test')({detail:{active:false}});
 assert.equal(f.nodes.get('region-overhead').dataset.irsPanelTest,'false');
 assert.match(lamp.style['--irs-panel-lamp-on'],/BRIGHT\.svg/);
});
