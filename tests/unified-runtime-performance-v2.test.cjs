'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const base='panel-mosaic-lab/cockpit/';
const isn=read(base+'isn-cockpit.js');
test('All 14 ECU dependency downloads are queued in one turn, while execution stays ordered',async()=>{
 const start=isn.indexOf(' async function loadDependencies(){'),end=isn.indexOf('\n function init(){',start);
 assert.ok(start>0&&end>start);
 const loader=isn.slice(start,end);
 assert.match(loader,/script\.async=false/);
 const deps=[...isn.slice(0,start).matchAll(/\['(B737[^']+)','([^']+)'\]/g)].map(m=>[m[1],m[2]]);
 assert.equal(deps.length,14);
 const queued=[],win={};
 const document={head:{append(node){queued.push(node);}},createElement:()=>({})};
 const sandbox={window:win,document,URL,deps,moduleBase:'https://example.test/repo/panel-mosaic-lab/cockpit/isn-cockpit.js'};
 vm.runInNewContext(loader+';this.loadTest=loadDependencies;',sandbox);
 const pending=sandbox.loadTest();
 assert.equal(queued.length,14,'Previous implementation queued only one script per completed request');
 assert.ok(queued.every(s=>s.async===false),'Module execution order must remain browser-serial');
 for(let i=0;i<queued.length;i++){win[deps[i][0]]={ready:true};queued[i].onload();}
 await pending;
 assert.equal(Object.keys(win).length,14);
});
test('Missing ECU global must fail closed, not initialize half-connected cockpit',async()=>{
 const start=isn.indexOf(' async function loadDependencies(){'),end=isn.indexOf('\n function init(){',start);
 const deps=[...isn.slice(0,start).matchAll(/\['(B737[^']+)','([^']+)'\]/g)].map(m=>[m[1],m[2]]);
 const queued=[],win={},document={head:{append(node){queued.push(node);}},createElement:()=>({})};
 const sandbox={window:win,document,URL,deps,moduleBase:'https://example.test/repo/panel-mosaic-lab/cockpit/isn-cockpit.js'};
 vm.runInNewContext(isn.slice(start,end)+';this.loadTest=loadDependencies;',sandbox);
 const task=sandbox.loadTest();for(let i=0;i<queued.length;i++){if(i!==3)win[deps[i][0]]={};queued[i].onload();}
 await assert.rejects(task,/Integration module did not register/);
});
test('Assembly starts downloading in HEAD before deferred modules and is consumed once in app',()=>{
 const html=read(base+'index.html'),app=read(base+'app.js');
 assert.ok(html.indexOf('B737UnifiedAssemblyPrefetch')<html.indexOf('performance-loader.js'));
 assert.ok(html.indexOf('B737UnifiedAssemblyPrefetch')<html.indexOf('src="./app.js?'));
 assert.ok(app.includes('await window.B737UnifiedAssemblyPrefetch'));
 assert.ok(app.includes('model.validate(assembly)'),'Same validation remains authoritative');
 assert.ok(app.includes("fetch('./assembly.json',{cache:'no-store'})"),'Standalone fallback must still exist');
});
test('PERF-0003 shared textures decode once for all duplicate strips and prioritize first paint',async()=>{
 const loader=require('../panel-mosaic-lab/cockpit/performance-loader');
 const manifest=require('../panel-mosaic-lab/cockpit/performance/manifest.json');
 const sent=[],tasks=[];
 const rect=()=>({left:0,top:0,right:140,bottom:140,width:140,height:140});
 const doc={currentScript:{src:'https://example.test/repo/panel-mosaic-lab/cockpit/performance-loader.js'},
  baseURI:'https://example.test/repo/panel-mosaic-lab/cockpit/',
  documentElement:{},addEventListener(){},querySelectorAll:()=>[],
  getElementById:()=>({getBoundingClientRect:()=>({left:0,top:0,right:800,bottom:800})})};
 class Img{
  constructor(){this.dataset={};this.isConnected=true;}
  set src(value){this._src=value;}
  get src(){return this._src;}
  decode(){return Promise.resolve();}
  getClientRects(){return [rect()];}
  getBoundingClientRect(){return rect();}
  closest(){return null;}
 }
 class Download extends Img{set src(value){this._src=value;sent.push(this);}}
 const win={document:doc,devicePixelRatio:1,innerWidth:800,innerHeight:800,Image:Download,
  CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent(){},
  MutationObserver:class{observe(){}},clearTimeout(){},
  setTimeout(fn){tasks.push(fn);return tasks.length;},addEventListener(){}};
 win.top=win;win.B737PerformanceAssets=manifest;
 const runtime=loader.install(win);
 const first=Array.from({length:17},()=>new Img()),other=new Img();
 for(const img of first)runtime.assign(img,'https://example.test/repo/assets/main-panel.webp');
 runtime.assign(other,'https://example.test/repo/assets/pedestal.webp');
 assert.equal(tasks.length,1,'Multiple requests coalesce before the first scan');
 tasks.shift()();
 assert.equal(sent.length,2,'17 identical source images must share one network/decode task');
 assert.equal(runtime.stats().decoding,2);
 for(const img of sent)await img.onload();
 assert.equal(runtime.stats().decoding,0);
 assert.ok(first.every(img=>img.dataset.perfReady==='true'));
 assert.equal(other.dataset.perfReady,'true');
 const repeat=new Img();runtime.assign(repeat,'https://example.test/repo/assets/main-panel.webp');
 tasks.shift()();
 assert.equal(sent.length,2,'A warmed texture URL must not start another download');
 assert.equal(repeat.dataset.perfReady,'true');
 assert.equal(runtime.stats().maxUpgrades,1,'Full quality decode upgrades are serialized to protect interaction latency');
});
test('Heavy resource-timing statistics are gated while Controls drawer is closed',()=>{
 const metrics=read(base+'performance-metrics.js');
 assert.match(metrics,/out\.closest\('#inspector'\)/);
 assert.match(metrics,/document\.body\.classList\.contains\('side-open'\)/);
 assert.ok(metrics.includes('B737LoadDiagnostics'), 'On-demand diagnostics remain available');
});

test('PERF-0002 defers overhead rendering, builds gallery on demand and coalesces visible navigation',()=>{
 const app=read(base+'app.js'),wheel=read(base+'wheel-pan-model-v1.js'),loader=read(base+'performance-loader.js');
 assert.match(app,/b737:unified-usable',\(\)=>/);
 assert.match(app,/IntersectionObserver/);
 assert.match(app,/frame\.dataset\.deferredUrl=\(window\.B737OverheadCompositeTest\?/);
 assert.match(app,/mountGallery\(\);byId\('galleryDialog'\)/);
 assert.match(app,/wheelController\.pan\(payload\)/);
 assert.match(app,/scheduleViewRefresh\(\)/);
 assert.match(wheel,/createController\(viewport/);
 assert.match(loader,/lastMotionAt/);
 assert.match(loader,/const view=viewport\(\),moving=/);
 assert.match(loader,/if\(item\.loading\|\|moving&&item\.extent\)continue/);
});

test('PERF-0003 only starts overhead on focus/visibility or after quiet prewarm; avionics remain independent',()=>{
 const app=read(base+'app.js');
 assert.match(app,/lastNavigationAt/);
 assert.match(app,/setTimeout\(prewarm,8500\)/);
 assert.match(app,/setTimeout\(startOverheadFrame,24000\)/);
 assert.match(app,/requestIdleCallback/);
 assert.match(app,/if\(id==='overhead'\|\|id==='all'\)startOverheadFrame\(\)/);
 assert.match(app,/ENABLED_CDU_SEAT='FO'/);
});
test('PERF-0003 reports both first interactive paint and sharp first-panel paint',()=>{
 const metrics=read(base+'performance-metrics.js');
 assert.match(metrics,/mainSharpReadyMs:mainSharpReady/);
 assert.match(metrics,/measureFps:/);
 assert.match(metrics,/maxNative|const native=/);
 assert.match(metrics,/dataset\.unifiedSharpMs/);
});

test('PERF-0003 layout measurements are shared within a refresh and decode upgrades stay serialized',()=>{
 const loader=read(base+'performance-loader.js');
 assert.match(loader,/geometryCache=new Map\(\)/);
 assert.match(loader,/geometryCache\?\.get\(host\)/);
 assert.match(loader,/measure\(img,view,geometryCache\)/);
 assert.match(loader,/MAX_CONCURRENT_TEXTURES=4,MAX_CONCURRENT_UPGRADES=1/);
});
