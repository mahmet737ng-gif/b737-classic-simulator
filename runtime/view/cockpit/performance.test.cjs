'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const manifest=JSON.parse(read('panel-mosaic-lab/cockpit/performance/manifest.json')),loader=require('./performance-loader');
let original=0,small=0;for(const [source,asset]of Object.entries(manifest.images)){
 const raw=fs.readFileSync(path.join(root,source));assert.equal(hash(raw),asset.sourceSha256);assert.equal(raw.length,asset.sourceBytes);
 assert.ok(asset.levels.length>=2);assert.equal(asset.levels.at(-1).url,source);assert.equal(asset.levels.at(-1).original,true);
 let prev=0;for(const level of asset.levels){assert.ok(level.extent>prev);prev=level.extent;const data=fs.readFileSync(path.join(root,level.url));assert.equal(data.length,level.bytes);assert.equal(hash(data),level.sha256);}
 assert.equal(loader.choose(asset,1),asset.levels[0]);assert.equal(loader.choose(asset,Infinity),asset.levels.at(-1));original+=raw.length;small+=asset.levels[0].bytes;
}
assert.ok(small<original*.03,'All smallest display textures must be below 3% of original bytes');
assert.equal(loader.intersects({left:0,top:0,right:10,bottom:10,width:10,height:10},{left:20,top:0,right:30,bottom:10}),false);
assert.equal(loader.intersects({left:0,top:0,right:10,bottom:10,width:10,height:10},{left:5,top:5,right:15,bottom:15}),true);
const frozen=read('panel-mosaic-lab/all-overhead/stage.js');const embedded=read('panel-mosaic-lab/cockpit/performance/overhead-renderer.js');
const changes={"img.src=asset.url;":"window.B737ImageLoader.assign(img,asset.url);","img.src=assetById('UPPER').url;":"window.B737ImageLoader.assign(img,assetById('UPPER').url);","photo.src=asset.url;":"window.B737ImageLoader.assign(photo,asset.url);","photo.cloneNode(false)":"window.B737ImageLoader.clone(photo)","'./spec.json?ts='+Date.now()":"'./spec.json?v=UPD-0012'","'../upper-oh/geometry.json?ts='+Date.now()":"'../upper-oh/geometry.json?v=UPD-0012'","'./atlas-layout.json?ts='+Date.now()":"'./atlas-layout.json?v=UPD-0012'","{cache:'no-store'}":"{cache:'default'}"};
let restored=embedded.slice(embedded.indexOf('\n')+1);for(const [before,after]of Object.entries(changes))restored=restored.split(after).join(before);assert.equal(restored,frozen,'Embedded renderer must retain every frozen geometry/input statement');
const html=read('panel-mosaic-lab/cockpit/index.html');assert.ok(html.indexOf('performance-loader.js')<html.indexOf('./app.js?'));
const child=read('panel-mosaic-lab/cockpit/cdu-stage.html');for(const source of ['ehsi/ehsi-engine.js','ehsi/photo-panel.js','nav-map-overlay.js','stage5-map.js'])assert.ok(!child.includes('src="'+source+'"'));
assert.ok(child.includes('engine/cdu-engine.js'));assert.ok(child.includes('cdu-bridge.js'));assert.ok(!read('panel-mosaic-lab/cockpit/flap-lever-test.js').includes('sourceImage=new Image'));
// Service-worker contracts: no install download, immutable reuse, fresh mutable text,
// API isolation and removal of only this route's outdated cache namespace.
(async()=>{
 const handlers={},stores=new Map([['unrelated-app',new Map()],['b737-unified-perf-old',new Map()]]);let network=0,generation=1;
 const caches={keys:async()=>[...stores.keys()],delete:async name=>stores.delete(name),open:async name=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {match:async req=>store.get(req.url),put:async(req,response)=>store.set(req.url,response)};}};
 const self={location:{href:'https://test.example/repo/panel-mosaic-lab/cockpit/sw.js'},addEventListener:(name,fn)=>handlers[name]=fn,skipWaiting:async()=>{},clients:{claim:async()=>{}}};
 const response=()=>({ok:true,type:'basic',generation,clone(){return {...this};}});
 const context={self,caches,URL,B737PerformanceAssets:manifest,importScripts:()=>{},fetch:async()=>{network++;return response();}};
 vm.runInNewContext(read('panel-mosaic-lab/cockpit/sw.js'),context);
 let pending;handlers.install({waitUntil:p=>pending=p});await pending;assert.equal(network,0,'Install must never prefetch the whole aircraft');
 handlers.activate({waitUntil:p=>pending=p});await pending;assert.ok(stores.has('unrelated-app'));assert.ok(!stores.has('b737-unified-perf-old'));
 async function request(url){let task;handlers.fetch({request:{url,method:'GET',mode:'cors'},respondWith:p=>task=p});return task?await task:null;}
 const image='https://test.example/repo/'+Object.values(manifest.images)[0].levels[0].url;await request(image);const after=network;await request(image);assert.equal(network,after,'Immutable image must come from runtime cache');
 const json='https://test.example/repo/panel-mosaic-lab/cockpit/assembly.json';await request(json);generation=2;assert.equal((await request(json)).generation,2,'New flight configuration must not be hidden behind stale cache');
 assert.equal(await request('https://test.example/repo/api/route'),null);assert.equal(await request('https://third.example/photo.webp'),null);
 console.log('PASS: '+Object.keys(manifest.images).length+' preserved original textures; all smallest levels '+(small/1e6).toFixed(2)+' MB vs '+(original/1e6).toFixed(2)+' MB; unchanged overhead geometry; lean CDU; immutable runtime cache and fresh configuration.');
})().catch(error=>{console.error(error);process.exitCode=1;});
