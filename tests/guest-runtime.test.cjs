'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const manifest=new Set(require('../runtime/manifest.json'));
const root=path.join(__dirname,'..');
const runtime=url=>path.join(root,'runtime',url.slice(1));
function exists(url){assert(manifest.has(url),'Route not allowlisted: '+url);assert(fs.existsSync(runtime(url)),'Asset missing: '+url);}
for(const url of manifest){
 assert(!url.includes('..')&&!url.includes('//'),'Unsafe route '+url);
 exists(url);
}
for(const page of [
  ['public/index.html','/'],
  ['public/lab.html','/lab/'],
  ['runtime/view/interactive-overhead/index.html','/view/interactive-overhead/'],
  ['runtime/cb-panel-lab/index.html','/cb-panel-lab/']
]){
 const html=fs.readFileSync(path.join(root,page[0]),'utf8');
 assert(!/https?:\/\/(?:mahmet|[^"' ]*github\.io)/i.test(html),'Source-site navigation in '+page[0]);
 const base=page[0].includes('/interactive-overhead/')
    ?'/view/all-overhead/':page[1];
 for(const match of html.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)){
  const target=match[1];const u=new URL(target,'https://example.test'+base);
  if(u.origin!=='https://example.test')throw Error('Unexpected external resource '+u.href);
  if(u.pathname.startsWith('/static/')){
    const asset=u.pathname.split('/').at(-1);assert(fs.existsSync(path.join(root,'public',asset)),'Missing public '+u.pathname);
  }else exists(u.pathname);
 }
}
const spec=require('../runtime/view/all-overhead/spec.json');
assert(spec.images.length>=18);
for(const art of spec.images){const u=new URL(art.url,'https://example.test/view/all-overhead/');exists(u.pathname);}
const lights=require('../runtime/view/interactive-overhead/lights.json');
assert(lights.lights.length>=100);
for(const item of lights.lights){
 for(const state of Object.values(lights.assets[item.asset]||{})){
  const ref=typeof state==='string'?state:state?.url;
  if(ref){const u=new URL(ref,'https://example.test/view/interactive-overhead/');exists(u.pathname);}
 }
}
const source=fs.readFileSync(path.join(root,'server.js'),'utf8');
assert(source.includes('MAX_DEVICES = 3'),'Missing three-device server-side cap');
assert(source.includes('pg_advisory_xact_lock'),'Concurrent login cap must be atomic');
assert(source.includes('runtimeFiles.has(runtimePath)'),'Static route guard missing');
assert(source.includes("const ok=await authorized(req)"),'Authentication guard missing');
const guest=fs.readFileSync(path.join(root,'runtime/view/interactive-overhead/index.html'),'utf8');
assert(guest.includes('/bridge/failure-protocol.js'));
assert(guest.includes('/bridge/cb-live.js'));
assert(guest.includes('/bridge/guest-overhead.js'));
const portal=fs.readFileSync(path.join(root,'public/index.html'),'utf8');
assert(portal.includes('src="/view/interactive-overhead/"'));
assert(portal.includes('src="/cb-panel-lab/"'));
assert(portal.includes('src="/lab/"'));
console.log('Guest overhead, photos, CB, lab, protected resources, and injection contract: OK');
