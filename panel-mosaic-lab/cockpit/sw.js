/* Runtime cache restricted to Unified clients and immutable, versioned image/font bytes. */
'use strict';
importScripts('./performance/manifest.js');
const PREFIX='b737-unified-perf-',CACHE=PREFIX+B737PerformanceAssets.version+'-1';
const root=new URL('../../',self.location.href);
const immutable=new Set(Object.values(B737PerformanceAssets.images).flatMap(a=>a.levels.map(l=>new URL(l.url,root).pathname)));
for(const path of Object.values(B737PerformanceAssets.patches))immutable.add(new URL(path,root).pathname);
for(const name of ['BoeingCDU-Large.ttf','BoeingCDU-Small.ttf'])immutable.add(new URL('assets/fonts/boeing-cdu/'+name,root).pathname);
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(name.startsWith(PREFIX)&&name!==CACHE)await caches.delete(name);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
 const req=event.request,u=new URL(req.url);if(req.method!=='GET'||u.origin!==root.origin||!u.pathname.startsWith(root.pathname))return;
 // Never cache API calls, browser extensions, private sources or unrelated simulator routes.
 const asset=immutable.has(u.pathname),text=/\.(?:html|js|css|json)$/.test(u.pathname)&&!u.searchParams.has('ts')&&!u.pathname.includes('/api/');
 if(!asset&&!text&&req.mode!=='navigate')return;
 event.respondWith((async()=>{let cache,hit;try{cache=await caches.open(CACHE);hit=await cache.match(req);}catch{}
  if(asset&&hit)return hit;
  try{const reply=await fetch(req);if(reply.ok&&reply.type==='basic'){try{await cache?.put(req,reply.clone());}catch{}return reply;}if(hit)return hit;return reply;}
  catch(error){if(hit)return hit;throw error;}
 })());
});

// Adopt only resources this client actually used, from HTTP cache only: no extra download.
self.addEventListener('message',event=>{
 if(event.origin!==root.origin||event.data?.type!=='b737:prime-used-textures'||!Array.isArray(event.data.urls))return;
 event.waitUntil((async()=>{let cache;try{cache=await caches.open(CACHE);}catch{return;}
  for(const url of [...new Set(event.data.urls)].slice(0,128)){try{const u=new URL(url);if(u.origin!==root.origin||!immutable.has(u.pathname))continue;const req=new Request(u.href,{cache:'only-if-cached',mode:'same-origin'});if(await cache.match(req))continue;const reply=await fetch(req);if(reply.ok&&reply.type==='basic')await cache.put(req,reply);}catch{}}
 })());
});
