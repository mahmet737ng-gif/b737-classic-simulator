/* Unified cache: immutable images/fonts and content-revisioned JS/CSS only. */
'use strict';
importScripts('./performance/manifest.js');
try{importScripts('./performance/lossless/manifest.js');}catch{}
const LOSSLESS=typeof B737LosslessAssets==='object'?B737LosslessAssets:null;
let cachePromise;
const openCache=()=>cachePromise??=caches.open(CACHE).catch(()=>{cachePromise=null;return null;});
const PREFIX='b737-unified-perf-',CACHE=PREFIX+B737PerformanceAssets.version+'-'+(LOSSLESS?.version||'base')+'-5';
const root=new URL('../../',self.location.href);
const immutable=new Set(Object.values(B737PerformanceAssets.images).flatMap(a=>a.levels.map(l=>new URL(l.url,root).pathname)));
for(const path of Object.values(B737PerformanceAssets.patches))immutable.add(new URL(path,root).pathname);
for(const item of Object.values(LOSSLESS?.images||{}))if(item.pixelIdentical&&item.url)immutable.add(new URL(item.url,root).pathname);
for(const name of ['BoeingCDU-Large.ttf','BoeingCDU-Small.ttf'])immutable.add(new URL('assets/fonts/boeing-cdu/'+name,root).pathname);
function revisioned(u){
 // Explicitly versioned JS/CSS is immutable for that version. Unversioned
 // code, HTML, JSON and URLs with timestamp cache-busters stay network-first.
 if(!/\.(?:js|css)$/.test(u.pathname)||u.searchParams.has('ts'))return false;
 const version=u.searchParams.get('v')||'';
 return /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/.test(version);
}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const req=event.request,u=new URL(req.url);if(req.method!=='GET'||u.origin!==root.origin||!u.pathname.startsWith(root.pathname)||u.pathname.includes('/api/'))return;
 // Never cache API calls, browser extensions, private sources or unrelated simulator routes.
 const asset=immutable.has(u.pathname)||revisioned(u),text=/\.(?:html|js|css|json)$/.test(u.pathname)&&!u.searchParams.has('ts')&&!u.pathname.includes('/api/');
 if(!asset&&!text&&req.mode!=='navigate')return;
 let update;
 const task=(async()=>{
  const match=async()=>{
   try{return await (await openCache())?.match(req);}catch{return undefined;}
  };
  const hit=asset?await match():null;
  if(hit)return hit;
  try{
   const reply=await fetch(req);
   if(reply.ok&&reply.type==='basic'){
    const copy=reply.clone();
    update=openCache().then(cache=>cache?.put(req,copy)).catch(()=>{});
    return reply;
   }
   return await match()||reply;
  }catch(error){const fallback=await match();if(fallback)return fallback;throw error;}
 })();
 event.respondWith(task);
 event.waitUntil(task.then(()=>update,()=>{}));
});

// Adopt only resources this client actually used, from HTTP cache only: no extra download.
self.addEventListener('message',event=>{
 if(event.origin!==root.origin||event.data?.type!=='b737:prime-used-textures'||!Array.isArray(event.data.urls))return;
 event.waitUntil((async()=>{let cache;try{cache=await caches.open(CACHE);}catch{return;}
  for(const url of [...new Set(event.data.urls)].slice(0,512)){try{const u=new URL(url);if(u.origin!==root.origin||!u.pathname.startsWith(root.pathname)||(!immutable.has(u.pathname)&&!revisioned(u)))continue;const req=new Request(u.href,{cache:'only-if-cached',mode:'same-origin'});if(await cache.match(req))continue;const reply=await fetch(req);if(reply.ok&&reply.type==='basic')await cache.put(req,reply);}catch{}}
 })());
});
