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
const child=read('panel-mosaic-lab/cockpit/cdu-stage.html');for(const source of ['ehsi/ehsi-engine.js','ehsi/photo-panel.js','stage5-map.js'])assert.ok(!child.includes('src="'+source+'"'));
// The embedded CDU uses the nav-map helper to validate routed fixes; EHSI renders in the parent.
assert.ok(child.includes('src="nav-map-overlay.js"'));
assert.ok(child.includes('engine/cdu-engine.js'));assert.ok(child.includes('cdu-bridge.js'));assert.ok(!read('panel-mosaic-lab/cockpit/flap-lever-test.js').includes('sourceImage=new Image'));
// BOOT-SAFE-0001: every owner-frozen direct mount remains byte-identical.
const linkedCSS=[...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g)].map(m=>m[1]);
assert.ok(linkedCSS.length<=36,'Source-verified 36-link CSS ceiling includes required independent owner-locked, fuel-used, crew and thrust styles');
const expectedCssOrder=["flight-scenario-panel-v1.css","style.css","engine-indication-live-v2.css","guard-owner18-v1.css","main-panel-seam-repair.css","mcp-visual-v3.css","mcp-hardware-v1.css","mcp-toggle-reference-v2.css","mcp-authentic-sprites-v2.css","mcp-owner-photo-components-v1.css","mcp-front-actual-photo-v3.css","mcp-owner13-v1.css","mcp-photo-optics-v1.css","mcp-knob-retina-v1.css","mcp-afds-bridge-v1.css","unified-lights.css","flap-needles.css","aircraft-settings.css","pressurization-oh22-diagnostic-ui.css","isn-cockpit.css","isn-engine-gauges.css","flap-lever-test.css","engine-start-levers.css","throttle-levers.css","speedbrake-lever-unified-v1.css","fire-lights-unified.css","irs-isdu-frontend-v1.css","irs-isdu-onpanel-v2.css","irs-isdu-cues-v1.css","irs-sys-dspl-v1.css","irs-sys-dspl-lr-markings-v1.css","irs-dspl-sel-upper-v1.css","irs-upper-face-v2.css","irs-amber-display-v1.css","irs-upper-dspl-v1.css","irs-13seg-display-v2.css","irs-trainer-unified-v1.css","irs-panel-registration-v1.css","irs-rotary-detent-indices-v1.css","asp-controls-v1.css","engine-indication-mode-v1.css","conventional-physical-controls-v1.css","eis-autobrake-physical-v1.css","conventional-engine-needles-v1.css","ground-power-header-v1.css","failures-header-v1.css","cockpit-photo-input-v1.css","unified-pinch-v1.css","cb-panel-entry-v1.css","eis-dot-readouts-v1.css","afds-annunciator-switch-v1.css","flight-scenario-panel-v1.css","smiths-fuel-quantity-v1.css","unified-workspace-v1.css","unified-welcome-v1.css","crew-room-v1.css","eis-cold-dark-glass-v1.css","asp-physical-controls-v1.css","asp-vbr-small-silver-v1.css","toggle-base-matte-v1.css","antiice-live-test-lab-v2.css","aircon-live-test-lab-v1.css","exterior-lights-classic-v1.css","sixpack-glareshield-v1.css","overhead-test-labs-v1.css","overhead-cross-cockpit-v1.css","hydraulic-live-lab-v1.css","engine-indication-live-v2.css","manual-n1-live-v1.css","fuel-used-physical-ch7-v1.css","manual-n1-live-v1.css","fuel-used-physical-ch7-v1.css","thrust-mode-annunciator-v1.css","efis-pedestal-raster-v1.css","pedestal-dual-vhf-knobs-v1.css","pedestal-mechanical-frequency-v1.css","pedestal-vhf-comm-tfr-v1.css","pedestal-vhf-comm-test-v1.css","pedestal-vhf-nav-controls-v1.css"];
const frozenLinks=["./guard-owner18-v1.css?v=OWNER18-004","./mcp-owner-photo-components-v1.css?v=MCP-PHOTO-0002","./mcp-owner13-v1.css?v=AT-PADDLE-20261027-R2","./irs-isdu-frontend-v1.css?v=IRS-UI-0001","./irs-isdu-onpanel-v2.css?v=IRS-UI-0004","./irs-isdu-cues-v1.css?v=IRS-CUES-0003","./irs-sys-dspl-v1.css?v=IRS-SYS-0001","./irs-sys-dspl-lr-markings-v1.css?v=IRS-LR-0001","./irs-dspl-sel-upper-v1.css?v=IRS-AMBER-0001","./irs-upper-face-v2.css?v=IRS-AMBER-0001","./irs-amber-display-v1.css?v=IRS-AMBER-0001","./irs-upper-dspl-v1.css?v=IRS-UPPER-0004","./irs-13seg-display-v2.css?v=IRS-FILAMENT-0002","./irs-trainer-unified-v1.css?v=IRS-LIVE-0002-MSU-PHOTO","./irs-panel-registration-v1.css?v=IRS-PANEL-0002","./irs-rotary-detent-indices-v1.css?v=IRS-INDEX-0002","./conventional-physical-controls-v1.css?v=CONV-CONTROLS-0003-AXLE","./conventional-engine-needles-v1.css?v=CONV-FULL-NEEDLES-0002-ABOVE-DIGITS"];
for(const href of frozenLinks)assert.ok(linkedCSS.includes(href),'Protected stylesheet must retain its exact original tag: '+href);
const actualCssOrder=[];
for(const href of linkedCSS){
 const filename=href.split('?')[0].replace(/^\.\//,'');
 if(!/^unified-css-safe-\d+-v1\.css$/.test(filename)){
  actualCssOrder.push(filename);continue;
 }
 const bundle=read('panel-mosaic-lab/cockpit/'+filename);
 const entries=[...bundle.matchAll(/\/\* BEGIN ([\w.-]+\.css) ([a-f0-9]{40}) \*\/\n([\s\S]*?)\n\/\* END \1 \*\//g)];
 assert.ok(entries.length>=2,'Safe bundle is empty or corrupt: '+filename);
 for(const [,name,,contents] of entries){
  assert.ok(!/(?:irs|guard|owner|le-devices|conventional)/i.test(name),'Protected CSS must never be bundled: '+name);
  assert.equal(contents,read('panel-mosaic-lab/cockpit/'+name),'Source CSS differs from owner file: '+name);
  actualCssOrder.push(name);
 }
}
assert.deepEqual(actualCssOrder,expectedCssOrder,'Every original stylesheet must retain exactly its original cascade order');
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
 async function request(url){
  let task,update;
  handlers.fetch({request:{url,method:'GET',mode:'cors'},respondWith:p=>task=p,waitUntil:p=>update=p});
  if(!task)return null;
  const response=await task;await update;return response;
 }
 const image='https://test.example/repo/'+Object.values(manifest.images)[0].levels[0].url;await request(image);const after=network;await request(image);assert.equal(network,after,'Immutable image must come from runtime cache');
 const json='https://test.example/repo/panel-mosaic-lab/cockpit/assembly.json';await request(json);generation=2;assert.equal((await request(json)).generation,2,'New flight configuration must not be hidden behind stale cache');
 assert.equal(await request('https://test.example/repo/api/route'),null);assert.equal(await request('https://third.example/photo.webp'),null);
 console.log('PASS: '+Object.keys(manifest.images).length+' preserved original textures; all smallest levels '+(small/1e6).toFixed(2)+' MB vs '+(original/1e6).toFixed(2)+' MB; unchanged overhead geometry; lean CDU; immutable runtime cache and fresh configuration.');
})().catch(error=>{console.error(error);process.exitCode=1;});
