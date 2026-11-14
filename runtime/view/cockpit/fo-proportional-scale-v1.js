/* FO-PROPORTIONAL-SCALE-0003 — coupled outer F/O photo + EADI horizon registration.
 * Owner-authorized 2026-11-08: scale the complete F/O visual field, including
 * the three named GPWS guards. Preserve their guard artwork, switch mechanics,
 * electrical behavior and frozen source geometry; never edit Owner18 masters.
 *
 * Mode-specific photographic seams:
 * EIS          engine right = FO INNER left = 1222
 * CONVENTIONAL panoramic engine right = FO owner photo left = 1374
 * Different anchors are essential: scaling an owner photograph about 1222
 * creates an otherwise visible black gap at the conventional panel seam.
 *
 * CSS individual transforms preserve original transform:scale(...) !important
 * on the three GPWS guards, physical knobs, and photographed needle rotation.
 * No moving DOM nodes (critical for active EADI and aircraft system bindings).
 * Event-driven; zero timers or subsystem polling.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object')module.exports=api;
 if(root?.document)api.install(root);
})(typeof window==='object'?window:globalThis,function(){
 'use strict';
 const VERSION='FO-PROPORTIONAL-SCALE-0003';
 const GPWS_IDS=Object.freeze(['gpws-terrain-inhibit','gpws-flap-inhibit','gpws-gear-inhibit']);
 const OWNER_LAMP_IDS=Object.freeze(['main-pull-up-fo','main-below-gs-fo','main-altitude-fo','main-gpws-inop']);
 const PROFILES=Object.freeze({
  EIS:Object.freeze({anchorX:1222,anchorY:127,scale:1.035,rightEdge:2069,mainRightEdge:2100}),
  CONVENTIONAL:Object.freeze({anchorX:1374,anchorY:127,scale:726/695,rightEdge:2069,mainRightEdge:2100})
 });
 const included=new Set(GPWS_IDS),ownerLamps=new Set(OWNER_LAMP_IDS);
 // Measured glass top edges in native MAIN PANEL units: CAPT 218.20,
 // FO 263.40 prior to FO scaling. The aircraft photo + its attached
 // instruments must travel together; moving only the FO canvas is WRONG.
 const EIS_OUTER_LIFT=218.20-(PROFILES.EIS.anchorY+
  (263.40-PROFILES.EIS.anchorY)*PROFILES.EIS.scale);
 function isOuterSurface(node,mode){
  if(mode!=='EIS')return false;
  if(node.matches('.texture-piece[data-piece="fo-outer"],[data-eadi-stage1-seat="FO"].eadi-stage1-host'))return true;
  if(node.matches('.cockpit-light[data-cockpit-light]'))
   return isFoLamp(node)&&/(?:^|\\s)fo-outer(?:\\s|$)/.test(node.title||'');
  // Standalone, direct-mounted controls on the outboard FO photograph.
  // Do not shift GPWS guards or the RMI / gear field in FO INNER.
  const x=parseFloat(node.style.left);
  return node.matches(':not([data-guard-id]):not(.owner18-guard-control)')&&
    Number.isFinite(x)&&x>=1594&&x<2100;
 }
 function mapRect(x,y,w,h,mode='EIS'){
  const p=PROFILES[mode];if(!p)throw Error('Unknown F/O mode');
  return {x:p.anchorX+(x-p.anchorX)*p.scale,
   y:p.anchorY+(y-p.anchorY)*p.scale,w:w*p.scale,h:h*p.scale};
 }
 function delta(x,y,originX=0,originY=0,mode='EIS'){
  const p=PROFILES[mode],factor=p.scale-1;
  return {dx:factor*(x+originX-p.anchorX),
   dy:factor*(y+originY-p.anchorY)};
 }
 function guardId(node){return node?.getAttribute?.('data-guard-id')||'';}
 function isFoLamp(node){
  return node.matches('.cockpit-light[data-cockpit-light]') &&
   /(?:^|\s)fo-(?:inner|outer)(?:\s|$)/.test(node.title||'');
 }
 function classification(node,native,mode){
  if(!node?.matches||!native||!PROFILES[mode])return null;
  if(node.matches('[data-guard-id],.owner18-guard-control')){
   return included.has(guardId(node))?mode:null;
  }
  if(node.matches('.texture-piece')){
   return mode==='EIS'&&node.matches('[data-piece="fo-inner"],[data-piece="fo-outer"]')?mode:null;
  }
  if(node.matches('#fo-owner-panel-v1')){
   return mode==='CONVENTIONAL'?mode:null;
  }
  // Conventional FO EADI is registered to the owner's actual CRT glass in
  // conventional-eadi-socket-v1.js, not the shared panel-wide FO transform.
  // EIS remains byte-for-byte identical in scale, origin and outer lift.
  if(node.matches('[data-eadi-stage1-seat="FO"].eadi-stage1-host'))
   return mode==='EIS'?'EIS':null;
  if(node.matches('.cockpit-light[data-cockpit-light]')){
   if(!isFoLamp(node))return null;
   return mode==='EIS'||ownerLamps.has(node.dataset.cockpitLight)?mode:null;
  }
  // A mounted FO control whose native coordinates belong to the F/O field.
  // Do not claim generic engine-panorama or captain elements by proximity.
  if(node.parentElement!==native||
     node.matches('.cockpit-light-layer,.cdu-station,.main-panel-seam-repair,.conventional-engine-photo-wrap-v1,.region-native,.eadi-stage1-host,.fo-proportional-scale-group')||
     node.querySelector?.('[data-guard-id],.owner18-guard-control')){
   return null;
  }
  const x=parseFloat(node.style.left),y=parseFloat(node.style.top),p=PROFILES[mode];
  return Number.isFinite(x)&&Number.isFinite(y)&&x>=p.anchorX&&
   x<p.mainRightEdge&&y>=p.anchorY&&y<920?mode:null;
 }
 function install(win){
  const doc=win.document,applied=new Map();
  let native=null,observer=null,bootstrapObserver=null,pending=false,activeMode='EIS';
  function stopBoot(){if(bootstrapObserver){bootstrapObserver.disconnect();bootstrapObserver=null;}}
  function measuredOrigin(node,style){
   const parts=(style.transformOrigin||'').split(/\s+/);
   return [parseFloat(parts[0])||0,parseFloat(parts[1])||0];
  }
  function scaleNode(node,mode){
   const style=win.getComputedStyle(node);
   const x=parseFloat(style.left),y=parseFloat(style.top);
   if(!Number.isFinite(x)||!Number.isFinite(y))return false;
   const [ox,oy]=measuredOrigin(node,style);
   const d=delta(x,y,ox,oy,mode);
   // A single additional vertical offset applies to the entire FO OUTER
   // photograph and every independently mounted item on that photograph.
   // The inner FO/ENGINE join stays registered at its locked native seam.
   if(isOuterSurface(node,mode))d.dy+=EIS_OUTER_LIFT;
   const tr=d.dx.toFixed(5)+'px '+d.dy.toFixed(5)+'px';
   const sc=String(PROFILES[mode].scale);
   let before=applied.get(node);
   if(!before){before={translate:node.style.translate,scale:node.style.scale};applied.set(node,before);}
   if(node.style.translate!==tr)node.style.translate=tr;
   if(node.style.scale!==sc)node.style.scale=sc;
   node.dataset.foScaleVersion=VERSION;
   return true;
  }
  function restore(node){
   const original=applied.get(node);
   if(!original)return;
   node.style.translate=original.translate;
   node.style.scale=original.scale;
   if(node.dataset.foScaleVersion===VERSION)delete node.dataset.foScaleVersion;
   applied.delete(node);
  }
  function mount(){
   const target=doc.querySelector('#region-main .region-native');
   if(!target)return false;
   if(target!==native){
    observer?.disconnect();native=target;
    observer=new win.MutationObserver(queue);
    observer.observe(native,{childList:true,subtree:true});
    stopBoot();
   }
   const mode=doc.documentElement.dataset.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
   activeMode=mode;
   const selected=new Map();
   // Keep the parent of each real instrument unchanged (EADI canvas state).
   for(const node of native.children){
    const id=classification(node,native,mode);
    if(id)selected.set(node,id);
   }
   const lampLayer=native.querySelector('.cockpit-light-layer');
   if(lampLayer){
    for(const node of lampLayer.querySelectorAll('.cockpit-light[data-cockpit-light]')){
     const id=classification(node,native,mode);
     if(id)selected.set(node,id);
    }
   }
   for(const node of applied.keys())if(!selected.has(node)||!node.isConnected)restore(node);
   for(const [node,id]of selected)scaleNode(node,id);
   doc.documentElement.dataset.foScaleVersion=VERSION;
   return selected.size>0;
  }
  function queue(){
   if(pending)return;
   pending=true;
   win.requestAnimationFrame(()=>{pending=false;mount();});
  }
  const stage=doc.getElementById('scene')||doc.body;
  if(!doc.querySelector('#region-main .region-native')){
   bootstrapObserver=new win.MutationObserver(queue);
   bootstrapObserver.observe(stage,{childList:true,subtree:true});
  }
  for(const event of ['b737:cockpit-mounted','b737:engine-indication-view',
   'b737:aircraft-profile-change'])win.addEventListener(event,queue);
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',queue,{once:true});
  queue();
  win.B737FoProportionalScaleV1=Object.freeze({
   version:VERSION,profiles:PROFILES,guards:GPWS_IDS,outerLift:EIS_OUTER_LIFT,
   inspect:()=>({version:VERSION,mode:activeMode,profile:PROFILES[activeMode],
    scaled:[...applied.keys()].filter(n=>n.isConnected).map(n=>({
     id:n.id||n.dataset.guardId||n.dataset.cockpitLight||n.dataset.piece||'fo-control',
     translate:n.style.translate,scale:n.style.scale})),
    alignment:{captainEadiTop:218.20,
     foEadiTop:mapRect(1612.75,263.40,0,0,'EIS').y+EIS_OUTER_LIFT,
     foOutboardTop:mapRect(1594,225,0,0,'EIS').y+EIS_OUTER_LIFT},
    seams:{EIS:{engineRight:1222,foLeft:mapRect(1222,127,0,0).x},
     CONVENTIONAL:{engineRight:1374,foLeft:mapRect(1374,127,0,0,'CONVENTIONAL').x}},
    guards:[...native?.querySelectorAll('[data-guard-id]')||[]]
     .filter(n=>included.has(guardId(n)))
     .map(n=>({id:guardId(n),scaled:n.dataset.foScaleVersion===VERSION}))})
  });
 }
 return Object.freeze({VERSION,PROFILES,GPWS_IDS,OWNER_LAMP_IDS,EIS_OUTER_LIFT,
  mapRect,delta,classification,isOuterSurface,install});
});
