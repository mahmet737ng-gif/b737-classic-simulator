'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),{prepare,ENTRY}=require('../tools/build-unified-web.cjs');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('public build reduces requests, keeps owner mounts exact and keys other scripts/styles to their source bytes',()=>{
 const before=read(ENTRY),a=prepare(root),b=prepare(root);assert.equal(a.html,b.html);assert.equal(a.revision,b.revision);
 assert.ok(a.after<a.before*.65);
 const base=new URL('https://test.invalid/'+ENTRY),bundles=new Map(a.bundles.map(x=>[x.path,x.content]));
 const tags=text=>[...text.matchAll(/<(?:script|link)\b[^>]*>/gi)].map(m=>m[0]);
 for(const tag of tags(before)){
  const match=tag.match(/\b(?:src|href)=(["'])([^"']+)\1/i);
  if(match&&/(?:irs|guard|owner|le-devices|conventional)/i.test(new URL(match[2],base).pathname))assert.ok(a.html.includes(tag),tag);
 }
 let revised=0;for(const tag of tags(a.html)){
  const match=tag.match(/\b(?:src|href)=(["'])([^"']+)\1/i);if(!match)continue;
  const u=new URL(match[2],base);if(!u.searchParams.get('v')?.startsWith('WEB-'))continue;
  const file=u.pathname.slice(1),content=bundles.get(file)??fs.readFileSync(path.join(root,file));
  assert.equal(u.searchParams.get('v'),'WEB-'+crypto.createHash('sha256').update(content).digest('hex').slice(0,16));revised++;
 }
 assert.ok(revised>35);assert.equal(read(ENTRY),before,'Never rewrite the checked-in source or locked mount tags');
});

test('published compiled cockpit retains the visible recharge command and its actual ECU handler',()=>{
 const artifact=prepare(root),html=artifact.html,entry=read(ENTRY);
 assert.match(entry,/<button id="liveBatteryRecharge"[^>]*>BAT RECHARGE<\/button>/);
 assert.match(entry,/<script id="battery-recharge-prepaint-v4">/);
 assert.match(html,/<button id="liveBatteryRecharge"[^>]*>BAT RECHARGE<\/button>/);
 assert.match(html,/<script id="battery-recharge-prepaint-v4">/);
 assert.equal((html.match(/id="liveBatteryRecharge"/g)||[]).length,1,'No duplicated BAT RECHARGE button');
 assert.ok(html.indexOf('battery-recharge-prepaint-v4')<html.indexOf('<main>'),'Instructor button is repaired synchronously ahead of the cockpit startup');
 const scripts=artifact.bundles.map(b=>b.content).join('\n')+
  '\n'+read('panel-mosaic-lab/cockpit/battery-recharge-header-v1.js');
 assert.match(scripts,/rechargeLiveBattery|installed\.recharge\(\)/,'Button retains the live ECU recharge path');
 assert.match(scripts,/BAT RECHARGE/);
});
test('revisioned JS/CSS reuse cache, a new revision downloads, and mutable configuration stays fresh with offline recovery',async()=>{
 const manifest=require('../panel-mosaic-lab/cockpit/performance/manifest.json'),handlers={},stores=new Map();let calls=0,generation=1,offline=false;
 const caches={keys:async()=>[],open:async name=>{if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);return {match:async req=>store.get(req.url),put:async(req,response)=>store.set(req.url,response)};}};
 const self={location:{href:'https://test.invalid/repo/panel-mosaic-lab/cockpit/sw.js'},addEventListener:(n,f)=>handlers[n]=f};
 vm.runInNewContext(read('panel-mosaic-lab/cockpit/sw.js'),{self,caches,URL,B737PerformanceAssets:manifest,importScripts(){},fetch:async()=>{calls++;if(offline)throw Error('offline');return {ok:true,type:'basic',generation,clone(){return {...this};}};}});
 const request=async url=>{let task;handlers.fetch({request:{url,method:'GET',mode:'cors'},respondWith:p=>task=p});return task?await task:null;};
 const url='https://test.invalid/repo/panel-mosaic-lab/cockpit/app.js?v=WEB-0123456789abcdef';
 await request(url);const n=calls;generation=2;assert.equal((await request(url)).generation,1);assert.equal(calls,n);
 assert.equal((await request(url.replace('abcdef','abcdee'))).generation,2);assert.equal(calls,n+1,'New source revision must not use old cached JS');
 const json='https://test.invalid/repo/panel-mosaic-lab/cockpit/assembly.json';await request(json);generation=3;assert.equal((await request(json)).generation,3);
 offline=true;assert.equal((await request(json)).generation,3);assert.equal((await request(url)).generation,1);
 assert.equal(await request('https://test.invalid/repo/api/route.json'),null);assert.equal(await request(url.replace('test.invalid','elsewhere.invalid')),null);
});

test('PERF-0003 compiles embedded Overhead from its real HTML base without altering protected mounts',()=>{
 const compiled=prepare(root),before=read('panel-mosaic-lab/cockpit/overhead-stage.html');
 assert.ok(compiled.overhead.before>=45);
 assert.ok(compiled.overhead.after<compiled.overhead.before,'Embedded Overhead requests should also be bundled');
 const base=new URL('../all-overhead/','https://test.invalid/panel-mosaic-lab/cockpit/overhead-stage.html');
 const files=new Set(compiled.overhead.bundles.map(x=>x.path));
 for(const bundle of compiled.overhead.bundles){
  const link=[...compiled.overhead.html.matchAll(/<script\b[^>]*src=(["'])([^"']+)\1/gi)].map(x=>x[2]).find(u=>new URL(u,base).pathname.slice(1)===bundle.path);
  assert.ok(link,'Bundle URL must resolve against Overhead base element: '+bundle.path);
 }
 const protectedPath=/(?:irs|guard|owner|le-devices|conventional)/i;
 const scripts=[...before.matchAll(/<script\b[^>]*src=(["'])([^"']+)\1[^>]*><\/script>/gi)];
 for(const match of scripts)if(protectedPath.test(new URL(match[2],base).pathname))
  assert.ok(compiled.overhead.html.includes(match[0]),'Protected OH mount modified: '+match[2]);
 assert.equal(read('panel-mosaic-lab/cockpit/overhead-stage.html'),before);
});

test('PERF-0004 publishes a separate compiled Unified test page without modifying the owner-approved original mounts',()=>{
 const source=read('panel-mosaic-lab/cockpit/app.js'),compiled=prepare(root);
 const prod=compiled.html,stage=compiled.overhead.html;
 assert.match(source,/B737OverheadCompositeTest/);
 assert.ok(!prod.includes('window.B737OverheadCompositeTest=true'),'Production entry must never enable composite test');
 assert.ok(!stage.includes('overhead-composite-test.css'),'Production overhead remains unchanged');
 const builder=read('tools/build-unified-web.cjs');
 assert.match(builder,/unified-composite-test.html/);
 assert.match(builder,/overhead-composite-stage.html/);
 assert.match(builder,/PERF-0004-COMPOSITE-TEST/);
});

test('PERF-0005 has isolated Full vs Static controls test routes on the same composite WebP',()=>{
 const builder=read('tools/build-unified-web.cjs');
 const app=read('panel-mosaic-lab/cockpit/app.js');
 const css=read('panel-mosaic-lab/cockpit/overhead-ab-static.css');
 assert.match(builder,/unified-static-controls-test.html/);
 assert.match(builder,/overhead-static-controls-stage.html/);
 assert.match(builder,/unified-ab-hud.js/);
 assert.match(builder,/overhead-ab-metrics.js/);
 assert.match(app,/B737OverheadStaticTest/);
 assert.match(css,/\.rg-layer/);
 assert.match(css,/\.lights-layer/);
 assert.match(css,/\.toggle-layer/);
 assert.doesNotMatch(css,/\.atlas-photo\s*\{/);
 assert.doesNotMatch(read('panel-mosaic-lab/cockpit/overhead-stage.html'),/overhead-ab-static/);
});

test('PERF-0006 keeps production protected and publishes two opt-in diagnostic routes',()=>{
 const builder=read('tools/build-unified-web.cjs');
 const diag=read('panel-mosaic-lab/cockpit/perf-diagnostic-v6.js');
 const profiler=read('tools/profile-unified-overhead-v6.cjs');
 assert.match(builder,/unified-diagnostic-v6.html/);
 assert.match(builder,/unified-diagnostic-static-v6.html/);
 assert.match(builder,/B737PerfDiagnosticV6/);
 assert.match(diag,/PerformanceObserver/);
 assert.match(diag,/longtask/);
 assert.match(diag,/B737ABStageMetrics/);
 assert.match(diag,/Copy report/);
 assert.match(profiler,/Performance.getMetrics/);
 assert.match(profiler,/Profiler.start/);
 assert.match(profiler,/ScriptDuration/);
 assert.doesNotMatch(read('panel-mosaic-lab/cockpit/index.html'),/perf-diagnostic-v6/);
 assert.doesNotMatch(read('panel-mosaic-lab/cockpit/overhead-stage.html'),/perf-diagnostic-v6/);
});

test('PERF-0007 source-only Overhead builds native HTML inputs with zero browser scripts and no protected source edits',()=>{
 const src=read('tools/build-overhead-ui-only.cjs');
 assert.match(src,/overhead-ui-only.html/);
 assert.match(src,/data-no-js/);
 assert.match(src,/model\.js/);
 assert.match(src,/assert\.equal\(toggle\.controls\.length,59/);
 assert.match(src,/assert\.equal\(rotaryControls\.length,20/);
 assert.match(src,/assert\.equal\(overheadGuards\.length,13/);
 assert.ok(!read('panel-mosaic-lab/cockpit/overhead-stage.html').includes('overhead-ui-only'));
 assert.ok(!read('panel-mosaic-lab/cockpit/index.html').includes('overhead-ui-only'));
});

test('PERF-0008 creates real incremental visual/electrical/dynamics/messaging tests without modifying the approved cockpit',()=>{
 const source=read('tools/build-overhead-step-lanes.cjs');
 const runtime=read('panel-mosaic-lab/cockpit/overhead-progressive-v8.js');
 assert.match(source,/overhead-visual-only-v8.html/);
 assert.match(source,/overhead-electrical-v8.html/);
 assert.match(source,/overhead-engine-v8.html/);
 assert.match(source,/overhead-messaging-v8.html/);
 assert.match(source,/assert.equal\(results\[0\].scripts,0/);
 assert.match(runtime,/B737ElectricalV7/);
 assert.match(runtime,/B737ISNEngineStartDynamicsV1/);
 assert.match(runtime,/B737ISNAPULoadDynamicsV1/);
 assert.match(runtime,/PerformanceObserver/);
 assert.match(runtime,/perf8-ping/);
 assert.doesNotMatch(read('panel-mosaic-lab/cockpit/index.html'),/PERF-0008/);
 assert.doesNotMatch(read('panel-mosaic-lab/cockpit/overhead-stage.html'),/PERF-0008/);
});

test('PERF-0009 isolates original real Overhead controls, lamps, and V7 kernels without altering source',()=>{
 const builder=read('tools/build-overhead-real-lanes-v9.cjs');
 const runtime=read('panel-mosaic-lab/cockpit/overhead-real-v9.js');
 assert.match(builder,/path\.join\(out,'overhead-real-v9-meta.json'\)/);
 assert.match(builder,/path\.join\(out,'overhead-real-v9-meta.json'\)/);
 assert.match(builder,/path\.join\(out,'overhead-real-v9-meta.json'\)/);
 assert.match(builder,/guard-owner18-v1.js/);
 assert.match(builder,/rotary-guards.js/);
 assert.match(runtime,/instance-faces.json/);
 assert.match(runtime,/readability-faces.json/);
 assert.match(runtime,/B737ISNAPULoadDynamicsV1/);
 assert.match(runtime,/B737ElectricalV7/);
 assert.ok(!read('panel-mosaic-lab/cockpit/overhead-stage.html').includes('PERF-0009'));
 assert.ok(!read('panel-mosaic-lab/cockpit/index.html').includes('PERF-0009'));
});

test('PERF-0010 publishes isolated parent-FMC vs full-Overhead experiments without changing production',()=>{
 const app=read('panel-mosaic-lab/cockpit/app.js');
 const build=read('tools/build-unified-web.cjs');
 const probe=read('panel-mosaic-lab/cockpit/perf-diagnostic-v6.js');
 const source=read('tools/build-composite-overhead-test.cjs');
 assert.match(app,/B737UnifiedNoCduTest/);
 assert.match(app,/B737UnifiedLightOverheadTest/);
 assert.match(build,/unified-no-cdu-v10.html/);
 assert.match(build,/unified-light-overhead-v10.html/);
 assert.match(probe,/NO_FO_CDU/);
 assert.match(probe,/REAL_F_OVERHEAD/);
 assert.match(source,/overhead-real-f-in-unified-v10.html/);
 assert.doesNotMatch(read('panel-mosaic-lab/cockpit/index.html'),/PERF-0010/);
 assert.doesNotMatch(read('panel-mosaic-lab/cockpit/overhead-stage.html'),/PERF-0010/);
});

test('PERF-0011 corrected diagnostic FPS uses wall-clock time and retains long frame stalls',()=>{
 const code=read('panel-mosaic-lab/cockpit/perf-diagnostic-v6.js');
 const web=read('tools/build-unified-web.cjs');
 assert.match(code,/frameCallbacks\*10000\/wall/);
 assert.match(code,/maxFrameGapMs/);
 assert.match(code,/observedFrameGapCoveragePct/);
 assert.match(code,/stallsOver1000Ms/);
 assert.doesNotMatch(code,/d<2000/);
 assert.match(web,/PERF-0011-RAF-FIX/);
});

test('PERF-0011 overhead iframe FPS retains stalls above two seconds',()=>{
 const stage=read('panel-mosaic-lab/cockpit/overhead-ab-metrics.js');
 assert.match(stage,/if\(delta>0\)\{/);
 assert.doesNotMatch(stage,/delta<2000/);
 assert.match(stage,/stallsOver1000Ms/);
 assert.match(read('tools/build-unified-web.cjs'),/PERF-0011-GAPFIX/);
});
