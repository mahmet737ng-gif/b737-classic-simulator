'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {createLocalServer,listenLocal}=require('./local-server.cjs');
test('local files revalidate, support audio ranges, reject hidden/traversal requests and port collisions recover',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'cockpit-local-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.writeFile(path.join(root,'index.html'),'0123456789');await fs.writeFile(path.join(root,'.secret'),'hidden');
 const server=createLocalServer({root,entry:'index.html',version:'0.2.0'});const port=await listenLocal(server);t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+port;
 const first=await fetch(base);assert.equal(await first.text(),'0123456789');assert.equal(first.headers.get('cache-control'),'no-cache');
 const cached=await fetch(base,{headers:{'If-None-Match':first.headers.get('etag')}});assert.equal(cached.status,304);
 const range=await fetch(base,{headers:{range:'bytes=2-4'}});assert.equal(range.status,206);assert.equal(await range.text(),'234');
 assert.equal((await fetch(base,{headers:{range:'bytes=999-'}})).status,416);
 assert.equal((await fetch(base+'/.secret')).status,403);
 assert.equal((await fetch(base+'/%5c..%5csecret')).status,403);
 const other=createLocalServer({root,entry:'index.html',version:'0.2.0'});const fallback=await listenLocal(other,port);assert.notEqual(fallback,port);await new Promise(r=>other.close(r));
 const next=createLocalServer({root,entry:'index.html',version:'0.2.1'});const np=await listenLocal(next);t.after(()=>new Promise(r=>next.close(r)));
 const changed=await fetch('http://127.0.0.1:'+np,{headers:{'If-None-Match':first.headers.get('etag')}});assert.equal(changed.status,200);
});

test('desktop override changes only the served response, keeps the URL and rejects escaping mappings',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'cockpit-compiled-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));
 await fs.writeFile(path.join(root,'index.html'),'original');await fs.writeFile(path.join(root,'compiled.html'),'compiled');
 const server=createLocalServer({root,entry:'index.html',version:'0.2.0',overrides:{'index.html':'compiled.html','escape.html':'../outside.html'}});
 const port=await listenLocal(server);t.after(()=>new Promise(r=>server.close(r)));
 assert.equal(await(await fetch('http://127.0.0.1:'+port+'/index.html?desktop-shell=001')).text(),'compiled');
 assert.equal(await fs.readFile(path.join(root,'index.html'),'utf8'),'original');
 assert.equal((await fetch('http://127.0.0.1:'+port+'/escape.html')).status,403);
});
