/* FO-PROPORTIONAL-SCALE-0001 — unified F/O visual scale in native main-panel coordinates.
 * Owner request 2026-11-08: scale the whole F/O field, not just its background.
 * Keep the cockpit's source photos and their registered layout data byte-identical.
 * Immutable Owner18 guarded controls are explicitly excluded: they require
 * their own separate owner approval before any geometry change.
 * No timer, image decode, or aircraft-system polling is introduced.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document)api.install(root);
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const VERSION='FO-PROPORTIONAL-SCALE-0001';
 const config=Object.freeze({anchorX:1222,anchorY:127,scale:1.035,
  originalRightEdge:2069,mainRightEdge:2100});
 function mapRect(x,y,w,h){
  const k=config.scale,a=config.anchorX,b=config.anchorY;
  return {x:a+(x-a)*k,y:b+(y-b)*k,w:w*k,h:h*k};
 }
 function delta(x,y){
  return {dx:(x-config.anchorX)*(config.scale-1),
   dy:(y-config.anchorY)*(config.scale-1)};
 }
 function isProtected(node){
  return node.matches('.owner18-guard-control,[data-guard-id],.owner18-guard-box') ||
   !!node.closest('.owner18-guard-control,[data-guard-id]');
 }
 function isFoLamp(node){
  if(!node.matches('.cockpit-light[data-cockpit-light]'))return false;
  // All lamps carry their source photographic piece ID in their registration title.
  return /(?:^|\\s)fo-(?:inner|outer)(?:\\s|$)/.test(node.title||'');
 }
 function shouldScale(node,native){
  if(isProtected(node))return false;
  if(node.matches('.texture-piece[data-piece="fo-inner"],.texture-piece[data-piece="fo-outer"],#fo-owner-panel-v1,[data-eadi-stage1-seat="FO"]'))return true;
  if(isFoLamp(node))return true;
  // Other independently mounted F/O hardware (e.g. conventional AUTO BRAKE).
  // Never touch protected guards, the seam repair, CDU, shared light layer,
  // captain, MCP, engine, or the aircraft system's opaque host layers.
  if(node.parentElement!==native ||
    node.matches('.texture-piece,.cockpit-light-layer,.cdu-station,.main-panel-seam-repair,.conventional-engine-photo-wrap-v1,.eadi-stage1-host,.region-native') ||
    node.id==='fo-proportional-scale-v1')return false;
  if(node.querySelector('.owner18-guard-control,[data-guard-id]'))return false;
  const x=parseFloat(node.style.left),y=parseFloat(node.style.top);
  return Number.isFinite(x)&&Number.isFinite(y)&&
   x>=config.anchorX&&x<config.mainRightEdge&&
   y>=config.anchorY&&y<920;
 }
 function install(win){
  const doc=win.document;
  let pending=false,observed=null,observer=null;
  const applied=new WeakMap();
  let bootObserver=null;
  function scaleNode(node){
   if(!shouldScale(node,observed))return false;
   const style=win.getComputedStyle(node);
   const x=parseFloat(style.left),y=parseFloat(style.top);
   if(!Number.isFinite(x)||!Number.isFinite(y))return false;
   const d=delta(x,y);
   const transform='translate('+d.dx.toFixed(5)+'px, '+d.dy.toFixed(5)+'px) scale('+config.scale+')';
   const old=applied.get(node);
   // Never overwrite a separately animated/rotated control's own transform.
   if(!old&&node.style.transform&&node.style.transform!=='none')return false;
   if(old&&node.style.transform!==old)return false;
   if(node.style.transform!==transform)node.style.transform=transform;
   if(node.style.transformOrigin!=='0px 0px')node.style.transformOrigin='0px 0px';
   applied.set(node,transform);
   node.dataset.foScaleVersion=VERSION;
   return true;
  }
  function mount(){
   const native=doc.querySelector('#region-main .region-native');
   if(!native)return false;
   if(native!==observed){
    observer?.disconnect();observed=native;
    observer=new win.MutationObserver(queue);
    observer.observe(native,{childList:true,subtree:true});
    bootObserver?.disconnect();bootObserver=null;
   }
   let count=0;
   for(const node of native.children)if(scaleNode(node))count++;
   for(const node of native.querySelectorAll('.cockpit-light-layer > .cockpit-light[data-cockpit-light]'))
    if(scaleNode(node))count++;
   const original={x:config.anchorX,y:config.anchorY,
    w:config.originalRightEdge-config.anchorX,h:694.156862745098};
   win.B737FoProportionalScaleV1=Object.freeze({
    version:VERSION,config,geometry:{before:original,after:mapRect(original.x,original.y,original.w,original.h)},
    inspect:()=>({version:VERSION,factor:config.scale,
      scaledNodes:native.querySelectorAll('[data-fo-scale-version="'+VERSION+'"]').length,
      guardsUnchanged:[...native.querySelectorAll('.owner18-guard-control')].every(n=>!n.dataset.foScaleVersion)})
   });
   return count>0;
  }
  function queue(){
   if(pending)return;pending=true;
   win.requestAnimationFrame(()=>{pending=false;mount();});
  }
  if(!doc.querySelector('#region-main .region-native')){
   const stage=doc.getElementById('scene')||doc.body;
   bootObserver=new win.MutationObserver(queue);
   bootObserver.observe(stage,{childList:true,subtree:true});
  }
  win.addEventListener('b737:cockpit-mounted',queue);
  win.addEventListener('b737:engine-indication-view',queue);
  win.addEventListener('b737:aircraft-profile-change',queue);
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',queue,{once:true});
  queue();
 }
 return Object.freeze({VERSION,config,mapRect,delta,install});
});
