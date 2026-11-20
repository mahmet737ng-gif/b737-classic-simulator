/* PERF-0003: shared, viewport-prioritized image decoding (not a simulation scheduler).
 * Frozen image files and physical panel registrations remain untouched.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737ImageLoader=api.install(root);})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 function svgImage(node){return node.namespaceURI==='http://www.w3.org/2000/svg'&&node.localName==='image';}
 function choose(asset,extent){return asset.levels.find(level=>level.extent>=extent)||asset.levels.at(-1);}
 function intersects(a,b){return a.width>0&&a.height>0&&a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;}
 function install(win){
  const doc=win.document,rootURL=new URL('../../',doc.currentScript.src),manifest=win.B737PerformanceAssets;
  const entries=new Map(),pending=new Set(),inflight=new Map(),readyURLs=new Set(),seen=new Set();
  const MAX_CONCURRENT_TEXTURES=4,MAX_CONCURRENT_UPGRADES=1;
  let startupScales=null,cockpitZoom=1,zoomPreview=false;
  let timer=0,idleTimer=0,lastMotionAt=0,activeDecodes=0,activeUpgrades=0,lastVisible=0,lastSharp=0;
  function sourceKey(src){
   const u=new URL(src,doc.baseURI);
   return u.origin===rootURL.origin&&u.pathname.startsWith(rootURL.pathname)?decodeURIComponent(u.pathname.slice(rootURL.pathname.length)):null;
  }
  function frameProjection(){
   let left=0,top=0,scaleX=1,scaleY=1,w=win;
   while(w!==w.top){
    const frame=w.frameElement;if(!frame||!frame.clientWidth||!frame.clientHeight)return null;
    const rect=frame.getBoundingClientRect(),x=rect.width/frame.clientWidth,y=rect.height/frame.clientHeight;
    left=rect.left+left*x;top=rect.top+top*y;
    scaleX*=x;scaleY*=y;w=w.parent;
   }
   return {left,top,scaleX,scaleY};
  }
  function box(node,projection){
   if(!projection)return null;
   const rect=node.getBoundingClientRect(),{left,top,scaleX,scaleY}=projection;
   return {left:left+rect.left*scaleX,top:top+rect.top*scaleY,
    right:left+rect.right*scaleX,bottom:top+rect.bottom*scaleY,
    width:rect.width*scaleX,height:rect.height*scaleY};
  }
  function viewport(){
   const top=win.top,v=top.document.getElementById('viewport')?.getBoundingClientRect();
   return {left:Math.max(0,v?.left||0),top:Math.max(0,v?.top||0),right:Math.min(top.innerWidth,v?.right||top.innerWidth),bottom:Math.min(top.innerHeight,v?.bottom||top.innerHeight)};
  }
  function measure(node,view,geometryCache,projection,primeScale){
   if(!node?.isConnected)return null;
   const host=node.closest('.atlas-piece,.texture-piece,.flap-bmp-overlay')||node;
   // One layout read per physical host/clone group per refresh, rather
   // than reflowing the same Overhead strip for every duplicated image.
   let hr=geometryCache?.get(host);
   if(hr===undefined){hr=box(host,projection);geometryCache?.set(host,hr);}
   if(!hr||!primeScale&&!intersects(hr,view))return null;
   let r=host===node?hr:geometryCache?.get(node);
   if(r===undefined){r=box(node,projection);geometryCache?.set(node,r);}
   if(!r||!r.width||!r.height)return null;
   return {r,hr,view,primeScale};
  }
  function desiredLevel(img,item,m){
   if(!item.asset)return null;
   const dpr=Math.min(win.top.devicePixelRatio||1,2);
   const pixels=Math.max(m.r.width,m.r.height)*dpr;
   const exposed=Math.min(m.hr.bottom,m.view.bottom)-Math.max(m.hr.top,m.view.top);
   // Request useful fit-view detail on the first pass for cockpit photos.
   // Progressive upgrades during zoom still use the original source pixels.
   const extent=m.primeScale?Math.min(1536,pixels*m.primeScale):
    exposed<24?384:item.extent===0?Math.min(768,pixels):pixels;
   return choose(item.asset,extent);
  }
  function setSource(node,url){
   if(svgImage(node))node.setAttribute('href',url);
   else node.src=url;
  }
  function currentSource(node){
   return svgImage(node)?node.getAttribute('href'):node.src;
  }
  function apply(img,item,url,level){
   if(!img.isConnected)return;
   if(item.extent>=level.extent)return;
   setSource(img,url);item.extent=level.extent;
   img.dataset.perfExtent=String(level.extent);
   img.dataset.perfReady='true';
   seen.add(url);
   win.dispatchEvent(new win.CustomEvent('b737:texture-ready'));
  }
  function fallback(img,item){
   if(!img.isConnected||item.extent)return;
   setSource(img,new URL(item.source,doc.baseURI).href);
   item.extent=Infinity;img.dataset.perfExtent='Infinity';img.dataset.perfFallback='true';
  }
  function schedule(delay=115){
   if(!timer)timer=win.setTimeout(refresh,delay);
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
   // Fill freed slots promptly instead of waiting 115 ms per decode wave.
   schedule(0);
  }
  function traceTexture(){
   if(win.B737BootTrace)return win.B737BootTrace;
   if(win.frameElement?.id)return win.parent.B737BootTrace;
   return undefined;
  }
  function begin(url,waiters,upgrade){
   const trace=traceTexture(),start=trace?win.performance.now():0;
   const record=(kind,from,ok)=>trace?.texture(win.frameElement?.id,win.performance.timeOrigin,
    url,waiters[0].level.extent,kind,from,win.performance.now(),ok);
   activeDecodes++;if(upgrade)activeUpgrades++;
   for(const w of waiters)w.item.loading=url;
   inflight.set(url,{waiters,upgrade});
   const next=new win.Image();next.decoding='async';next.fetchPriority=upgrade?'low':'high';
   next.onload=async()=>{
    const decodeStart=trace?win.performance.now():0;
    record(upgrade?'zoom-texture-load':'texture-load',start,true);
    let decoded=true;
    try{if(typeof next.decode==='function')await next.decode();}catch{decoded=false;}
    record('decode',decodeStart,decoded);
    complete(url,true);
   };
   next.onerror=()=>{record('texture-load',start,false);complete(url,false);};
   next.src=url;
  }
  function refresh(){
   timer=0;
   const view=viewport(),moving=zoomPreview||win.top!==win&&win.top.B737ImageLoader?.zoomPreview?.()||Date.now()-lastMotionAt<310,geometryCache=new Map();
   const projection=frameProjection(),first=[],upgrades=[];
   const frameId=win!==win.top?win.frameElement?.id:'';
   const overhead=frameId==='overheadFrame';
   const cdu=frameId==='cduFrameCAPT'||frameId==='cduFrameFO';
   let overheadScale=0;
   if(overhead){
    const frame=win.frameElement.getBoundingClientRect();
    overheadScale=win.parent.B737ImageLoader?.fitRatio('overhead')||
     Math.min((view.right-view.left)/frame?.width,(view.bottom-view.top)/frame?.height);
   }
   lastVisible=0;lastSharp=0;
   const cx=(view.left+view.right)/2,cy=(view.top+view.bottom)/2;
   for(const [img,item] of entries){
    if(!img.isConnected){entries.delete(img);continue;}
    let primeScale=0;
    if(!item.extent){
     if(overheadScale>0&&Number.isFinite(overheadScale)&&img.classList.contains('atlas-photo'))primeScale=overheadScale;
     else if(cdu&&img.matches('#cdu-stage img.base'))primeScale=1;
     else if(startupScales&&img.parentElement?.classList.contains('fire-handle-control'))primeScale=fitRatio('pedestal');
     else if(startupScales&&img.parentElement?.classList.contains('texture-piece')){
      const region=img.closest('.region')?.dataset.region;
      primeScale=fitRatio(region);
     }
    }
    const m=measure(img,view,geometryCache,projection,primeScale);if(!m)continue;
    lastVisible++;
    if(!item.asset){
     if(!item.extent){setSource(img,new URL(item.source,doc.baseURI).href);item.extent=Infinity;img.dataset.perfExtent='Infinity';}
     lastSharp++;continue;
    }
    const level=desiredLevel(img,item,m);if(!level)continue;
    if(item.extent>=level.extent){lastSharp++;continue;}
    if(item.loading||moving&&item.extent)continue;
    const url=new URL(level.url,rootURL).href;
    if(primeScale){
     // Put every fit-size cockpit photo on the browser's request queue in
     // the same pass. The browser shares requests for identical crop URLs.
     // Keep the bounded decode pool for subsequent zoom upgrades.
     item.loading=url;
     img.fetchPriority='high';
     const trace=traceTexture(),start=trace?win.performance.now():0;
     const settled=event=>{
      trace?.texture(frameId,win.performance.timeOrigin,url,level.extent,'fit-image-load',
       start,win.performance.now(),event.type==='load');
      img.removeEventListener('load',settled);
      img.removeEventListener('error',settled);
      item.loading=null;
      if(event.type==='error'){
       item.extent=0;
       fallback(img,item);
      }
      schedule();
     };
     img.addEventListener('load',settled);
     img.addEventListener('error',settled);
     apply(img,item,url,level);
     continue;
    }
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
   for(const task of pending)if(measure(task.node,view,geometryCache,projection)){pending.delete(task);task.run();}
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
   if(asset&&!svgImage(img)){img.width=asset.width;img.height=asset.height;}
   entries.set(img,{source,asset,extent:0,loading:null});schedule();return img;
  }
  function assignPreview(img,source,extent){
   assign(img,source);
   const item=entries.get(img);
   const original=new URL(source,doc.baseURI).href;
   if(!item.asset){setSource(img,original);return;}
   const level=choose(item.asset,extent),url=new URL(level.url,rootURL).href;
   if(!svgImage(img))img.fetchPriority='high';
   item.extent=level.extent;
   img.dataset.perfExtent=String(level.extent);
   img.addEventListener('error',()=>{
    if(currentSource(img)!==url)return;
    item.extent=0;fallback(img,item);
   },{once:true});
   setSource(img,url);
  }
  function scan(node){
   if(node.nodeType!==1)return;
   // Most new nodes are status spans, dial digits and lamp elements. The
   // observer sees them at 10Hz or faster; never run descendant selector
   // searches for leaf nodes with no image children.
   if(node.tagName==='IMG'&&node.hasAttribute('data-perf-source')&&!entries.has(node))
    assign(node,node.dataset.perfSource);
   if(!node.childElementCount)return;
   for(const img of node.querySelectorAll('img[data-perf-source]'))if(!entries.has(img))
    assign(img,img.dataset.perfSource);
   // Real texture image insertions still schedule the usual priority loader.
  }
  new win.MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);}).observe(doc.documentElement,{childList:true,subtree:true});
  doc.addEventListener('scroll',noteMotion,{capture:true,passive:true});
  win.addEventListener('resize',noteMotion);
  win.addEventListener('b737:performance-view',noteMotion);
  win.addEventListener('b737:cockpit-mounted',()=>schedule());
  function fitRatio(region){return (startupScales?.[region]||0)/cockpitZoom;}
  const api={
   fitRatio,
   primeCockpit(scales,zoom){startupScales=scales;cockpitZoom=zoom;
    if(timer)win.clearTimeout(timer);
    timer=0;schedule(0);
   },
   setCockpitZoom(zoom){cockpitZoom=zoom;},
   setZoomPreview(active){zoomPreview=active;},zoomPreview:()=>zoomPreview,
   assign,assignPreview,refresh:schedule,
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
