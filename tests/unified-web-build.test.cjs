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
