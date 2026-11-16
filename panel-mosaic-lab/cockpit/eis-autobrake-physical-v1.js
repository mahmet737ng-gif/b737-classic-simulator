/* EIS-AUTOBRAKE-0001 — B737 Classic AUTO BRAKE selector in EIS main panel.
 * This is a physical view adapter ONLY. Both EIS and Conventional command the
 * one B737AutobrakeUnified engine (FCOM 14.10/14.20; LAN ATA 32-40).
 * The approved EIS photograph/Owner18 guarded switches remain unmodified.
 * PIXEL-REGISTERED from the user's CURRENT live EIS screenshot (1920x1080):
 * open aperture white ring circle: center=(1120,568), radius=38 screen px;
 * existing OFF-detent rotary round base: center=(1136,556), radius=37 px.
 * The actual base, not its long pointer handle, must move LEFT 16px,
 * DOWN 12px. At 1.007 rendered px/source px, reference [102,893]
 * centers the base over the photo well. EIS diameter 94 source px
 * is now 105 source px: its base reaches just inside the photographed
 * white ring (about 2px border still visible at native screenshot zoom).
 * These are EIS-only adjustments. Conventional sprite, six detents,
 * switching law, 1500 ms RTO test, and backend remain untouched.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.install(root);
})(typeof window!=='undefined'?window:null,function(){
 'use strict';
 const REF=Object.freeze({
  image:Object.freeze([918,1713]),
  center:Object.freeze([102,893]),
  diameter:105,
  source:'EIS_FO_INNER_SCREENSHOT_PIXEL_REGISTERED_20261105_V5'
 });
 const DETENTS=Object.freeze(['RTO','OFF','1','2','3','MAX']);
 const ANGLES=Object.freeze({RTO:-135,OFF:-90,'1':-45,'2':0,'3':45,MAX:90});
 // Center/width/height of the *printed lettering* relative to the
 // knob diameter (not a 45-degree polar placement of the knob).
 const PRINTED=Object.freeze({
  RTO:[-.70,.34,.32,.19],OFF:[-.83,0,.32,.19],
  '1':[-.59,-.51,.16,.19],'2':[0,-.75,.16,.19],
  '3':[.56,-.51,.16,.19],MAX:[.84,0,.38,.20]
 });
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
  const detentLabels=new Map();
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
   for(const [value,button]of detentLabels)button.setAttribute('aria-pressed',String(value===detent));
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
  function placeDetentLabels(host,target){
   const geometry=win.B737DetentHitGeometryV1;
   if(!geometry?.build)throw Error('B737DetentHitGeometryV1 must load before AUTOBRAKE');
   const boxes=geometry.build(DETENTS.map(value=>{
    const [dx,dy,tw,th]=PRINTED[value];
    return {id:value,cx:target.x+dx*target.w,cy:target.y+dy*target.h,
     w:tw*target.w,h:th*target.h};
   }),{paddingPx:5});
   // Exact text-centered invisible zones. Expansions are clamped against
   // neighboring detent labels by the common geometry owner.
   for(const box of boxes){
    const detent=box.id;
    let label=detentLabels.get(detent);
    if(!label){
     label=doc.createElement('button');label.type='button';
     label.className='b737-autobrake-detent-label';
     label.dataset.autobrakeLabel=detent;
     label.dataset.autobrakeInstallation='EIS';
     label.setAttribute('aria-label','AUTO BRAKE → '+detent);
     label.setAttribute('aria-pressed','false');
     label.title='AUTO BRAKE · '+detent+' (tap printed marking)';
     Object.assign(label.style,{position:'absolute',zIndex:'55',padding:'0',
      border:'0',margin:'0',borderRadius:'4px',background:'transparent',
      boxShadow:'none',touchAction:'manipulation',cursor:'pointer'});
     label.addEventListener('pointerdown',e=>e.stopPropagation());
     label.addEventListener('click',e=>{
      if(mode()!=='EIS')return;
      e.preventDefault();e.stopPropagation();set(detent,'printed-label-tap');
     });
     detentLabels.set(detent,label);
    }
    Object.assign(label.style,{
     left:box.x.toFixed(3)+'px',top:box.y.toFixed(3)+'px',
     width:box.w.toFixed(3)+'px',height:box.h.toFixed(3)+'px',
     transform:'none'
    });
    label.dataset.hitPaddingPx=box.paddingPx.toFixed(2);
    if(label.parentElement!==host)host.append(label);
    label.setAttribute('aria-pressed',String(selected()===detent));
   }
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
   placeDetentLabels(host,target);
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
