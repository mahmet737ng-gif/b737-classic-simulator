/* PERF-0003: shared, viewport-prioritized image decoding (not a simulation scheduler).
 * Frozen image files and physical panel registrations remain untouched.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737ImageLoader=api.install(root);})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 function choose(asset,extent){return asset.levels.find(level=>level.extent>=extent)||asset.levels.at(-1);}
 function intersects(a,b){return a.width>0&&a.height>0&&a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;}
 function install(win){
  const doc=win.document,rootURL=new URL('../../',doc.currentScript.src),manifest=win.B737PerformanceAssets;
  const entries=new Map(),pending=new Set(),inflight=new Map(),readyURLs=new Set(),seen=new Set();
  const MAX_CONCURRENT_TEXTURES=5,MAX_CONCURRENT_UPGRADES=2;
  let timer=0,idleTimer=0,lastMotionAt=0,activeDecodes=0,activeUpgrades=0,lastVisible=0,lastSharp=0;
  function sourceKey(src){
   const u=new URL(src,doc.baseURI);
   return u.origin===rootURL.origin&&u.pathname.startsWith(rootURL.pathname)?decodeURIComponent(u.pathname.slice(rootURL.pathname.length)):null;
  }
  function box(node){
   let r=node.getBoundingClientRect(),w=win;
   let rect={left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
   while(w!==w.top){
    const frame=w.frameElement;if(!frame)return null;
    const f=frame.getBoundingClientRect(),sx=f.width/frame.clientWidth,sy=f.height/frame.clientHeight;
    rect={left:f.left+rect.left*sx,top:f.top+rect.top*sy,right:f.left+rect.right*sx,bottom:f.top+rect.bottom*sy,width:rect.width*sx,height:rect.height*sy};w=w.parent;
   }
   return rect;
  }
  function viewport(){
   const top=win.top,v=top.document.getElementById('viewport')?.getBoundingClientRect();
   return {left:Math.max(0,v?.left||0),top:Math.max(0,v?.top||0),right:Math.min(top.innerWidth,v?.right||top.innerWidth),bottom:Math.min(top.innerHeight,v?.bottom||top.innerHeight)};
  }
  function measure(node,view){
   if(!node?.isConnected)return null;
   const host=node.closest('.atlas-piece,.texture-piece,.flap-bmp-overlay')||node;
   const hr=box(host);if(!hr||!intersects(hr,view))return null;
   const r=host===node?hr:box(node);if(!r)return null;
   return {r,hr,view};
  }
  function visible(node,view){return !!measure(node,view||viewport());}
  function desiredLevel(img,item,m){
   if(!item.asset)return null;
   const dpr=Math.min(win.top.devicePixelRatio||1,2);
   const pixels=Math.max(m.r.width,m.r.height)*dpr;
   const exposed=Math.min(m.hr.bottom,m.view.bottom)-Math.max(m.hr.top,m.view.top);
   // Show useful <=768px previews fast; only request full source when
   // genuine on-screen pixel demand exceeds the last derivative.
   const first=item.extent===0,extent=exposed<24?384:first?Math.min(768,pixels):pixels;
   return choose(item.asset,extent);
  }
  function apply(img,item,url,level){
   if(!img.isConnected)return;
   if(item.extent>=level.extent)return;
   img.src=url;item.extent=level.extent;
   img.dataset.perfExtent=String(level.extent);
   img.dataset.perfReady='true';
   seen.add(url);
   win.dispatchEvent(new win.CustomEvent('b737:texture-ready'));
  }
  function fallback(img,item){
   if(!img.isConnected||item.extent)return;
   img.src=new URL(item.source,doc.baseURI).href;
   item.extent=Infinity;img.dataset.perfExtent='Infinity';img.dataset.perfFallback='true';
  }
  function schedule(){
   if(!timer)timer=win.setTimeout(refresh,115);
  }
  function complete(url,ok){
   const job=inflight.get(url);if(!job)return;
   inflight.delete(url);activeDecodes--;if(job.upgrade)activeUpgrades--;
   if(ok)readyURLs.add(url);
   for(const w of job.waiters){
    w.item.loading=null;
    if(ok)apply(w.img,w.item,url,w.level);
    else fallback(w.img,w.item);
   }
   schedule();
  }
  function begin(url,waiters,upgrade){
   activeDecodes++;if(upgrade)activeUpgrades++;
   for(const w of waiters)w.item.loading=url;
   inflight.set(url,{waiters,upgrade});
   const next=new win.Image();next.decoding='async';next.fetchPriority=upgrade?'low':'high';
   next.onload=async()=>{
    try{if(typeof next.decode==='function')await next.decode();}catch{}
    complete(url,true);
   };
   next.onerror=()=>complete(url,false);
   next.src=url;
  }
  function refresh(){
   timer=0;
   const view=viewport(),moving=Date.now()-lastMotionAt<310;
   const first=[],upgrades=[];
   lastVisible=0;lastSharp=0;
   const cx=(view.left+view.right)/2,cy=(view.top+view.bottom)/2;
   for(const [img,item] of entries){
    if(!img.isConnected){entries.delete(img);continue;}
    const m=measure(img,view);if(!m)continue;
    lastVisible++;
    if(!item.asset){
     if(!item.extent){img.src=new URL(item.source,doc.baseURI).href;item.extent=Infinity;img.dataset.perfExtent='Infinity';}
     lastSharp++;continue;
    }
    const level=desiredLevel(img,item,m);if(!level)continue;
    if(item.extent>=level.extent){lastSharp++;continue;}
    if(item.loading||moving&&item.extent)continue;
    const url=new URL(level.url,rootURL).href;
    if(readyURLs.has(url)){apply(img,item,url,level);continue;}
    const candidate={img,item,level,url,priority:Math.abs((m.hr.left+m.hr.right)/2-cx)+Math.abs((m.hr.top+m.hr.bottom)/2-cy)};
    (item.extent?upgrades:first).push(candidate);
   }
   first.sort((a,b)=>a.priority-b.priority);
   upgrades.sort((a,b)=>a.priority-b.priority);
   for(const group of [first,upgrades]){
    for(const w of group){
     const existing=inflight.get(w.url);
     if(existing){existing.waiters.push(w);w.item.loading=w.url;continue;}
     if(activeDecodes>=MAX_CONCURRENT_TEXTURES)break;
     const upgrade=!!w.item.extent;
     if(upgrade&&activeUpgrades>=MAX_CONCURRENT_UPGRADES)continue;
     // Gather sibling strips/clones sharing the same source texture, so
     // there is one download and decode instead of one per placed DOM image.
     const siblings=group.filter(x=>x.url===w.url&&!x.item.loading);
     if(!siblings.length)continue;
     begin(w.url,siblings,upgrade);
    }
   }
   for(const task of pending)if(visible(task.node,view)){pending.delete(task);task.run();}
   if(win===win.top)for(const frame of doc.querySelectorAll('iframe')){
    try{frame.contentWindow?.B737ImageLoader?.refresh();}catch{}
   }
  }
  function noteMotion(){
   lastMotionAt=Date.now();schedule();
   if(idleTimer&&typeof win.clearTimeout==='function')win.clearTimeout(idleTimer);
   idleTimer=win.setTimeout(()=>{idleTimer=0;schedule();},340);
  }
  function assign(img,source){
   const key=sourceKey(source),asset=manifest?.images[key];
   img.dataset.perfSource=source;
   if(asset){img.width=asset.width;img.height=asset.height;}
   entries.set(img,{source,asset,extent:0,loading:null});schedule();return img;
  }
  function scan(node){
   if(node.nodeType!==1)return;
   if(node.matches('img[data-perf-source]')&&!entries.has(node))assign(node,node.dataset.perfSource);
   for(const img of node.querySelectorAll('img[data-perf-source]'))if(!entries.has(img))assign(img,img.dataset.perfSource);
   schedule();
  }
  new win.MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);}).observe(doc.documentElement,{childList:true,subtree:true});
  doc.addEventListener('scroll',noteMotion,{capture:true,passive:true});
  win.addEventListener('resize',noteMotion);
  win.addEventListener('b737:performance-view',noteMotion);
  win.addEventListener('b737:cockpit-mounted',schedule);
  const api={
   assign,refresh:schedule,
   clone(img){const node=img.cloneNode(false);node.removeAttribute('src');delete node.dataset.perfReady;delete node.dataset.perfExtent;return assign(node,img.dataset.perfSource);},
   whenVisible(node,run){pending.add({node,run});schedule();},
   fullURL(source){const a=manifest?.images[sourceKey(source)];return a?new URL(a.levels.at(-1).url,rootURL).href:new URL(source,doc.baseURI).href;},
   labelPatchURL(){const path=manifest?.patches['engine-start-label'];return path?new URL(path,rootURL).href:null;},
   patchURL(source,rect){const key=sourceKey(source)+':'+['x','y','w','h'].map(k=>rect[k]).join(',');const path=manifest?.patches[key];return path?new URL(path,rootURL).href:null;},
   stats:()=>({tracked:entries.size,requested:seen.size,decoding:activeDecodes,upgrading:activeUpgrades,visible:lastVisible,sharp:lastSharp,sharedRequests:inflight.size,maxParallel:MAX_CONCURRENT_TEXTURES,maxUpgrades:MAX_CONCURRENT_UPGRADES})
  };
  doc.querySelectorAll('img[data-perf-source]').forEach(scan);return Object.freeze(api);
 }
 return {choose,intersects,install};
});
