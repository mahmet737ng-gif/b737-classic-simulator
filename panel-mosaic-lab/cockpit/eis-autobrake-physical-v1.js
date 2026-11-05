/* EIS-AUTOBRAKE-0001 — B737 Classic AUTO BRAKE selector in EIS main panel.
 * This is a physical view adapter ONLY. Both EIS and Conventional command the
 * one B737AutobrakeUnified engine (FCOM 14.10/14.20; LAN ATA 32-40).
 * The approved EIS photograph/Owner18 guarded switches remain unmodified.
 * PHOTO REGISTRATION — owner-marked red circle, 1920x1080 screenshot:
 * actual AUTO BRAKE hole center (1131,681) screenshot px;
 * current rotary's circular base center (1074,719) screenshot px.
 * Old EIS reference [67.5,915] is therefore 57px LEFT and 38px LOW.
 * New reference [118,881] corrects the displacement at the observed
 * 122 screenshot px / 108 source-px scale. Diameter stays 108;
 * circular knob base stays inside ~140px outer white ring.
 * Conventional photo, sprite, detents, input and ECU remain unchanged.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.install(root);
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const REF=Object.freeze({
  image:Object.freeze([918,1713]),
  center:Object.freeze([118,881]),
  diameter:108,
  source:'EIS_FO_INNER_OWNER_RED_CIRCLE_20261105_CENTERED'
 });
 const DETENTS=Object.freeze(['RTO','OFF','1','2','3','MAX']);
 const ANGLES=Object.freeze({RTO:-135,OFF:-90,'1':-45,'2':0,'3':45,MAX:90});
 function placement(rect){
  if(!rect||![rect.x,rect.y,rect.w,rect.h].every(Number.isFinite)||
    rect.w<=0||rect.h<=0)throw Error('EIS FO-inner placement is required');
  const sx=rect.w/REF.image[0],sy=rect.h/REF.image[1];
  return {x:rect.x+REF.center[0]*sx,y:rect.y+REF.center[1]*sy,
   w:REF.diameter*sx,h:REF.diameter*sy,source:REF.source};
 }
 function install(win){
  const doc=win.document;
  let knob=null,watcher=null,ready=false;
  const shared=()=>win.B737AutobrakeUnified;
  const mode=()=>doc.documentElement?.dataset?.engineIndication||'EIS';
  const native=()=>doc.querySelector('#region-main .region-native');
  const fo=()=>native()?.querySelector('.texture-piece[data-piece="fo-inner"]');
  const selected=()=>shared()?.getState()?.selector||'OFF';
  function paint(){
   if(!knob)return;
   const detent=selected(),index=DETENTS.indexOf(detent);
   if(index<0)return;
   knob.dataset.detent=detent;
   knob.setAttribute('aria-valuenow',String(index));
   knob.setAttribute('aria-valuetext',detent);
   knob.setAttribute('aria-label','AUTO BRAKE EIS selector — '+detent);
   knob.title='AUTO BRAKE · '+detent+' · click/wheel/arrow keys';
   knob.querySelector('img').style.transform='rotate('+ANGLES[detent]+'deg)';
  }
  function set(next,origin){
   if(!DETENTS.includes(next))throw Error('Invalid EIS AUTO BRAKE detent');
   const api=shared();
   if(!api?.setSelector)throw Error('Shared Unified autobrake ECU not available');
   const old=api.getState().selector;
   const out=api.setSelector(next);paint();
   if(old!==next)win.dispatchEvent(new win.CustomEvent('b737:autobrake-selector-changed',{
    detail:{selector:'AUTOBRAKE',detent:next,previous:old,
     detents:DETENTS.slice(),origin,source:'EIS-AUTOBRAKE-0001',visualControl:true}
   }));
   return out;
  }
  function step(delta,origin){
   const current=selected(),index=DETENTS.indexOf(current);
   return set(DETENTS[Math.max(0,Math.min(DETENTS.length-1,index+delta))],origin);
  }
  function make(){
   if(knob)return knob;
   knob=doc.createElement('button');knob.type='button';
   knob.className='b737-eis-autobrake-rotary';
   knob.dataset.control='autobrake-selector';
   knob.dataset.owner='EIS-AUTOBRAKE-0001';
   knob.setAttribute('role','slider');
   knob.setAttribute('aria-valuemin','0');
   knob.setAttribute('aria-valuemax','5');
   knob.setAttribute('aria-orientation','horizontal');
   const image=doc.createElement('img');
   image.alt='';image.draggable=false;
   image.src=new URL('../assets/locked/2026-10-23/Switches/Rotary/rotary-standard-v1.webp',
    doc.baseURI).href;
   knob.append(image);
   knob.addEventListener('click',e=>{
    if(mode()!=='EIS')return;
    e.preventDefault();e.stopPropagation();step(e.shiftKey?-1:1,'click');
   });
   knob.addEventListener('contextmenu',e=>{
    if(mode()!=='EIS')return;
    e.preventDefault();e.stopPropagation();step(-1,'right-click');
   });
   knob.addEventListener('wheel',e=>{
    if(mode()!=='EIS'||!e.deltaY)return;
    e.preventDefault();e.stopPropagation();
    step(e.deltaY<0?1:-1,'wheel');
   },{passive:false});
   knob.addEventListener('keydown',e=>{
    if(mode()!=='EIS')return;
    const key=e.key;
    if(key==='ArrowRight'||key==='ArrowUp'){e.preventDefault();step(1,'keyboard');}
    else if(key==='ArrowLeft'||key==='ArrowDown'){e.preventDefault();step(-1,'keyboard');}
    else if(key==='Home'){e.preventDefault();set('RTO','keyboard');}
    else if(key==='End'){e.preventDefault();set('MAX','keyboard');}
   });
   knob.addEventListener('pointerdown',()=>knob?.classList.add('pressed'));
   for(const type of ['pointerup','pointercancel','pointerleave','blur'])
    knob.addEventListener(type,()=>knob?.classList.remove('pressed'));
   paint();
   return knob;
  }
  function update(){
   const host=native(),piece=fo();
   if(!host||!piece)return false;
   const n=piece.style;
   const rect={x:parseFloat(n.left),y:parseFloat(n.top),
    w:parseFloat(n.width),h:parseFloat(n.height)};
   let target;
   try{target=placement(rect);}catch(_){return false;}
   const control=make();
   Object.assign(control.style,{left:target.x.toFixed(3)+'px',
    top:target.y.toFixed(3)+'px',width:target.w.toFixed(3)+'px',
    height:target.h.toFixed(3)+'px'});
   if(control.parentElement!==host)host.append(control);
   ready=true;paint();return true;
  }
  function stopWatcher(){if(watcher){watcher.disconnect();watcher=null;}}
  function watch(){
   if(watcher||mode()!=='EIS'||!win.MutationObserver)return;
   const node=doc.getElementById('scene')||doc.body;
   if(!node)return;
   watcher=new win.MutationObserver(()=>{if(update()||mode()!=='EIS')stopWatcher();});
   watcher.observe(node,{subtree:true,childList:true});
  }
  function schedule(){
   const callback=()=>{if(update())stopWatcher();else watch();};
   if(win.requestAnimationFrame)win.requestAnimationFrame(callback);else callback();
  }
  for(const type of ['b737:cockpit-mounted','b737:engine-indication-view','resize'])
   win.addEventListener(type,schedule);
  win.addEventListener('b737:autobrake-state',paint);
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',schedule,{once:true});
  else schedule();
  const api=Object.freeze({update,getDetent:selected,setDetent:(d)=>set(d,'api'),
   step:(dir)=>step(dir,'api'),getGeometry:()=>({...REF}),
   getState:()=>({ready,visible:mode()==='EIS',detent:selected(),
    knob:knob?{left:knob.style.left,top:knob.style.top,width:knob.style.width,height:knob.style.height}:null})});
  win.B737EISAutobrakePhysicalV1=api;
  return api;
 }
 return Object.freeze({REF,DETENTS,ANGLES,placement,install});
});
