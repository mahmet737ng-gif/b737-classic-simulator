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
test('Texture loading is bounded to avoid a burst of decoded full-resolution bitmaps',async()=>{
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
  set src(value){this._src=value;if(!this.dataset)sent.push(this);}
  get src(){return this._src;}
  decode(){return Promise.resolve();}
  getClientRects(){return [rect()];}
  getBoundingClientRect(){return rect();}
  closest(){return null;}
 }
 class Download extends Img{set src(value){this._src=value;sent.push(this);}}
 const win={document:doc,devicePixelRatio:1,innerWidth:800,innerHeight:800,Image:Download,
  CustomEvent:class{constructor(type){this.type=type;}},dispatchEvent(){},
  MutationObserver:class{observe(){}},
  setTimeout(fn){tasks.push(fn);return tasks.length;},addEventListener(){}};
 win.top=win;
 win.B737PerformanceAssets=manifest;
 const runtime=loader.install(win);
 const source='https://example.test/repo/assets/main-panel.webp';
 for(let i=0;i<17;i++)runtime.assign(new Img(),source);
 assert.equal(tasks.length,1,'Multiple assignment requests must coalesce');
 tasks.shift()();
 assert.equal(sent.length,5,'Only five texture requests can be in-flight');
 assert.equal(runtime.stats().decoding,5);
 for(const img of sent.slice(0,5))await img.onload();
 assert.equal(runtime.stats().decoding,0);
 assert.ok(tasks.length>0,'Next batch must continue when the first finishes');
 tasks.shift()();
 assert.equal(sent.length,10);
 assert.equal(runtime.stats().decoding,5);
});
test('Heavy resource-timing statistics are gated while Controls drawer is closed',()=>{
 const metrics=read(base+'performance-metrics.js');
 assert.match(metrics,/out\.closest\('#inspector'\)/);
 assert.match(metrics,/document\.body\.classList\.contains\('side-open'\)/);
 assert.ok(metrics.includes('B737LoadDiagnostics'), 'On-demand diagnostics remain available');
});
