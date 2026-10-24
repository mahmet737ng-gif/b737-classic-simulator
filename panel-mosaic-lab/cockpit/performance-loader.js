/* Unified-only progressive textures. Systems and input layers never wait for textures. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737ImageLoader=api.install(root);})(typeof window==='undefined'?globalThis:window,function(){
 'use strict';
 function choose(asset,extent){return asset.levels.find(level=>level.extent>=extent)||asset.levels.at(-1);}
 function intersects(a,b){return a.width>0&&a.height>0&&a.right>b.left&&a.left<b.right&&a.bottom>b.top&&a.top<b.bottom;}
 function install(win){
  const doc=win.document,rootURL=new URL('../../',doc.currentScript.src),manifest=win.B737PerformanceAssets,entries=new Map(),pending=new Set();
  let timer=0;const seen=new Set();
  function sourceKey(src){const u=new URL(src,doc.baseURI);return u.origin===rootURL.origin&&u.pathname.startsWith(rootURL.pathname)?decodeURIComponent(u.pathname.slice(rootURL.pathname.length)):null;}
  function box(node){let r=node.getBoundingClientRect(),w=win;let rect={left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height};
   while(w!==w.top){const f=w.frameElement;if(!f)return null;const fr=f.getBoundingClientRect(),sx=fr.width/f.clientWidth,sy=fr.height/f.clientHeight;rect={left:fr.left+rect.left*sx,top:fr.top+rect.top*sy,right:fr.left+rect.right*sx,bottom:fr.top+rect.bottom*sy,width:rect.width*sx,height:rect.height*sy};w=w.parent;}
   return rect;
  }
  function viewport(){const top=win.top,v=top.document.getElementById('viewport')?.getBoundingClientRect();return {left:Math.max(0,v?.left||0),top:Math.max(0,v?.top||0),right:Math.min(top.innerWidth,v?.right||top.innerWidth),bottom:Math.min(top.innerHeight,v?.bottom||top.innerHeight)};}
  function visible(node){if(!node.isConnected||!node.getClientRects().length)return false;const host=node.closest('.atlas-piece,.texture-piece,.flap-bmp-overlay')||node;const r=box(host);return !!r&&intersects(r,viewport());}
  function request(img,item){
   if(!visible(img))return;if(!item.asset){if(!item.extent){img.src=new URL(item.source,doc.baseURI).href;item.extent=Infinity;}return;}const r=box(img);if(!r)return;
   const host=img.closest('.atlas-piece,.texture-piece')||img,hr=box(host),v=viewport();const visibleHeight=Math.min(hr.bottom,v.bottom)-Math.max(hr.top,v.top);const desired=Math.max(r.width,r.height)*(win.top.devicePixelRatio||1);const wanted=choose(item.asset,visibleHeight<24?Math.min(desired,384):desired);
   if((item.extent||0)>=wanted.extent||item.loading)return;
   item.loading=true;const target=new URL(wanted.url,rootURL).href;
   // Keep the current texture visible while an upgrade downloads and decodes.
   const next=new win.Image();next.decoding='async';next.fetchPriority=item.extent?'low':'high';
   next.onload=async()=>{try{await next.decode();}catch{}item.loading=false;if(!img.isConnected)return;img.src=target;item.extent=wanted.extent;img.dataset.perfExtent=String(wanted.extent);img.dataset.perfReady='true';seen.add(target);win.dispatchEvent(new win.CustomEvent('b737:texture-ready'));schedule();};
   next.onerror=()=>{item.loading=false;if(!item.extent){img.src=new URL(item.source,doc.baseURI).href;item.extent=Infinity;img.dataset.perfFallback='true';}};
   next.src=target;
  }
  function refresh(){timer=0;for(const [img,item]of entries){if(!img.isConnected){entries.delete(img);continue;}request(img,item);}for(const task of pending)if(visible(task.node)){pending.delete(task);task.run();}if(win===win.top)for(const frame of doc.querySelectorAll('iframe')){try{frame.contentWindow?.B737ImageLoader?.refresh();}catch{}}}
  function schedule(){if(!timer)timer=win.setTimeout(refresh,60);}
  function assign(img,source){const key=sourceKey(source),asset=manifest?.images[key];img.dataset.perfSource=source;if(asset){img.width=asset.width;img.height=asset.height;}entries.set(img,{source,asset,extent:0,loading:false});schedule();return img;}
  function scan(node){if(node.nodeType!==1)return;if(node.matches('img[data-perf-source]')&&!entries.has(node))assign(node,node.dataset.perfSource);for(const img of node.querySelectorAll('img[data-perf-source]'))if(!entries.has(img))assign(img,img.dataset.perfSource);schedule();}
  new win.MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);}).observe(doc.documentElement,{childList:true,subtree:true});
  doc.addEventListener('scroll',schedule,{capture:true,passive:true});win.addEventListener('resize',schedule);win.addEventListener('b737:performance-view',schedule);win.addEventListener('b737:cockpit-mounted',schedule);
  const api={assign,refresh:schedule,clone(img){const node=img.cloneNode(false);node.removeAttribute('src');delete node.dataset.perfReady;delete node.dataset.perfExtent;return assign(node,img.dataset.perfSource);},whenVisible(node,run){pending.add({node,run});schedule();},fullURL(source){const a=manifest?.images[sourceKey(source)];return a?new URL(a.levels.at(-1).url,rootURL).href:new URL(source,doc.baseURI).href;},labelPatchURL(){const path=manifest?.patches['engine-start-label'];return path?new URL(path,rootURL).href:null;},patchURL(source,rect){const key=sourceKey(source)+':'+['x','y','w','h'].map(k=>rect[k]).join(',');const path=manifest?.patches[key];return path?new URL(path,rootURL).href:null;},stats:()=>({tracked:entries.size,requested:seen.size})};
  doc.querySelectorAll('img[data-perf-source]').forEach(scan);return Object.freeze(api);
 }
 return {choose,intersects,install};
});
