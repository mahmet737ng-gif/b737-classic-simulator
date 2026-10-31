'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {compile}=require('./build-runtime.cjs');
test('desktop bundles preserve all script order, source bytes and frozen mounts; self-locating scripts stay separate',()=>{
 const root=path.resolve(__dirname,'..'),entry=path.join(root,'panel-mosaic-lab/cockpit/index.html');
 const before=fs.readFileSync(entry,'utf8'),result=compile(root);
 assert.ok(result.after<result.before*.65,'Cold start must open materially fewer script files');
 for(const bundle of result.bundles){for(const source of bundle.sources){
  const u=new URL(source,'https://desktop.invalid/panel-mosaic-lab/cockpit/index.html');
  const original=fs.readFileSync(path.join(root,u.pathname.slice(1)),'utf8');
  assert.ok(bundle.content.includes(original),'Source code may not be rewritten');
  assert.ok(!original.includes('currentScript'),'Self-locating scripts must keep their original URL');
 }}
 const protectedTags=[...before.matchAll(/<script\b[^>]*src=(["'])([^"']+)\1[^>]*><\/script>/gi)].filter(m=>/(?:irs|guard|owner|le-devices)/i.test(new URL(m[2],'https://desktop.invalid/panel-mosaic-lab/cockpit/index.html').pathname)).map(m=>m[0]);
 assert.ok(protectedTags.length>15);for(const tag of protectedTags)assert.ok(result.html.includes(tag),tag);
 assert.equal(fs.readFileSync(entry,'utf8'),before,'Original index is never rewritten');
});

test('compiled modules retain microtask dependency checkpoints and isolate a failed module',async t=>{
 const os=require('node:os'),vm=require('node:vm');const root=fs.mkdtempSync(path.join(os.tmpdir(),'cockpit-bundle-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const dir=path.join(root,'panel-mosaic-lab/cockpit');fs.mkdirSync(dir,{recursive:true});
 const files=[
  '(function(){Promise.resolve().then(()=>window.ready=true);})();',
  '(function(){window.observed=window.ready;})();',
  '(function(){throw Error("module failure");})();',
  '(function(){window.afterFailure=true;})();'
 ];
 files.forEach((code,i)=>fs.writeFileSync(path.join(dir,'m'+i+'.js'),code));
 fs.writeFileSync(path.join(dir,'index.html'),files.map((_,i)=>'<script src="./m'+i+'.js" defer></script>').join(''));
 const result=compile(root),errors=[],w={};assert.equal(result.bundles.length,1);
 await vm.runInNewContext(result.bundles[0].content,{window:w,queueMicrotask:fn=>Promise.resolve().then(()=>{try{fn();}catch(error){errors.push(error.message);}})});
 assert.equal(w.observed,true);assert.equal(w.afterFailure,true);assert.deepEqual(errors,['module failure']);
});

test('TAT projection waits for the iframe document element while fast loading is in progress',()=>{
 const vm=require('node:vm'),file=path.resolve(__dirname,'../panel-mosaic-lab/cockpit/tat-probe-unified-v1.js');
 const text=fs.readFileSync(file,'utf8'),fn=text.slice(text.indexOf(' function project(o){'),text.indexOf('\n function show(o){'));
 const sent=[],f={contentDocument:{documentElement:null},contentWindow:{postMessage:packet=>sent.push(packet)}};
 const context={frame:()=>f,location:{origin:'https://example.test'}};vm.runInNewContext(fn+';this.projectTest=project;',context);
 assert.doesNotThrow(()=>context.projectTest({amberOn:true}));assert.equal(sent.length,0);
 f.contentDocument={documentElement:{classList:{contains:()=>false}},querySelector:()=>null};
 context.projectTest({amberOn:true});assert.equal(sent[0].lamps['probe-temp'],true);
});
