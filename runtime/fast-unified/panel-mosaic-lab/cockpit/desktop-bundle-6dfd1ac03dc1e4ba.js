(async()=>{
;
/* ../cockpit/recessed-overhead-v2.js?v=RECESS-0003-RESID-SOCKET-CENTER&airconP5=NATIVE-WALLCLOCK-0005&oh18=PHOTO-SOCKET-FIT-0001 */
try{
/* RECESS-OH18-FIT-0001: screenshot-registered ATTEND, GRD CALL and R RAIN REPELLENT. Original panel bitmaps, all other controls and guards remain immutable. */
(function(root){
 'use strict';
 const source={UPPER:[1731,909],OH10:[1095,1436],OH15:[1280,1229],OH18:[816,1926],OH21:[1122,1402]};
 const nodes=[{"id":"mach-airspeed-1","piece":"UPPER","label":"MACH AIRSPEED WARNING TEST NO 1","cx":1610,"cy":458,"d":40,"quality":"photo"},{"id":"mach-airspeed-2","piece":"UPPER","label":"MACH AIRSPEED WARNING TEST NO 2","cx":1674,"cy":458,"d":40,"quality":"photo"},{"id":"stall-warning-1","piece":"UPPER","label":"STALL WARNING TEST NO 1","cx":1478,"cy":592,"d":42,"quality":"photo"},{"id":"stall-warning-2","piece":"UPPER","label":"STALL WARNING TEST NO 2","cx":1609,"cy":592,"d":42,"quality":"photo"},{"id":"pitot-static-tat-test","piece":"OH15","label":"PITOT STATIC HEAT / TAT TEST","cx":638,"cy":1027,"d":122,"quality":"photo"},{"id":"residual-volts","piece":"OH10","label":"AC DC METERING RESIDUAL VOLTS","cx":917,"cy":1273,"d":112,"quality":"screenshot-aligned","note":"Owner screenshot OH10 bore center: 8 native px left, 45 native px down; bezel and cap unchanged"},{"id":"aircon-ovht-test","piece":"OH21","label":"AIR CONDITIONING OVERHEAT TEST","cx":925,"cy":472,"d":108,"quality":"photo"},{"id":"trip-reset","piece":"OH21","label":"PACK / BLEED TRIP RESET","cx":559,"cy":1051,"d":109,"quality":"photo"},{"id":"attend","piece":"OH18","label":"ATTEND","cx":188,"cy":435,"d":192,"quality":"screenshot-aligned"},{"id":"ground-call","piece":"OH18","label":"GRD CALL","cx":643,"cy":435,"d":192,"quality":"screenshot-aligned"},{"id":"rain-repellent-left","piece":"OH18","label":"RAIN REPELLENT LEFT","cx":236,"cy":1035,"d":176,"quality":"photo"},{"id":"rain-repellent-right","piece":"OH18","label":"RAIN REPELLENT RIGHT","cx":570,"cy":1045,"d":176,"quality":"screenshot-aligned"}];
 const host=root.document.getElementById('atlasAbsolute');
 if(!host)return;
 const mounted=new Map(),nativeAirconReleases=new Map();
 const send=(id,pressed,quality,inputTimeStamp)=>{
  // The browser's PointerEvent.timeStamp dates the physical input, even if
  // a busy frame delays the handler. Use that time before our own now().
  const now=root.performance.now(),time=Number(inputTimeStamp);
  const valid=Number.isFinite(time)&&time>=0&&time<=now&&now-time<=60000;
  const physicalEpochMs=root.performance.timeOrigin+(valid?time:now);
  const detail={id,pressed,action:pressed?'PRESS':'RELEASE',momentary:true,quality,
   physicalEpochMs,source:'recessed-hardware-v2'};
  root.dispatchEvent(new CustomEvent('b737:recessed-button',{detail}));
  if(root.parent!==root)root.parent.postMessage({type:'b737:cockpit-overhead',kind:'recessed-button',...detail},root.location.origin);
 };
 function make(item){
  const ring=root.document.createElement('div');
  ring.className='b737-recess-unit';ring.dataset.recessedId=item.id;ring.dataset.qa=item.quality;
  ring.title=item.label;
  const cap=root.document.createElement('button');
  cap.className='b737-recess-unit__cap';cap.type='button';cap.dataset.pressed='false';
  cap.setAttribute('aria-label',item.label+' recessed momentary button');cap.setAttribute('aria-pressed','false');
  ring.append(cap);
  let pressed=false;
  const set=(next,event)=>{next=!!next;if(pressed===next)return;pressed=next;cap.dataset.pressed=String(next);cap.setAttribute('aria-pressed',String(next));send(item.id,next,item.quality,event?.timeStamp);};
  // Keep the original installed air-con cap. Fail-safe release on lost
  // window focus so a 5-second TEST cannot remain stuck after alt-tab.
  if(item.id==='aircon-ovht-test')nativeAirconReleases.set(item.id,()=>set(false));
  cap.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.stopPropagation();e.preventDefault();try{cap.setPointerCapture(e.pointerId);}catch(_){}set(true,e);});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])cap.addEventListener(name,e=>{e.stopPropagation();set(false,e);});
  cap.addEventListener('pointerleave',e=>{if(!cap.hasPointerCapture?.(e.pointerId))set(false,e);});
  cap.addEventListener('blur',()=>set(false));
  cap.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)set(true);}});
  cap.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();set(false);}});
  cap.addEventListener('click',e=>e.stopPropagation());
  return ring;
 }
 function geometry(piece,item){
  const [sw,sh]=source[item.piece],n=x=>Number.parseFloat(x);
  const x=n(piece.style.left),y=n(piece.style.top),w=n(piece.style.width),h=n(piece.style.height);
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)return null;
  return {left:x+w*item.cx/sw,top:y+h*item.cy/sh,width:w*item.d/sw};
 }
 function mount(){
  for(const item of nodes){
   const piece=host.querySelector('.atlas-piece[data-key="'+item.piece+'"]');
   if(!piece)continue;
   const g=geometry(piece,item);if(!g)continue;
   let node=mounted.get(item.id);
   const newlyMounted=!node||!node.isConnected;
   if(newlyMounted){node=make(item);host.append(node);mounted.set(item.id,node);}
   // Approved OH21 owner photo aligns these very same P5-10 caps to the
   // photograph's registration points. Do not overwrite that geometry
   // with the retired atlas x/y whenever unrelated DOM children change.
   const photoOwned=item.piece==='OH21'&&
    root.document.documentElement?.hasAttribute?.('data-owner-oh21-photo');
   if(newlyMounted||!photoOwned)
    Object.assign(node.style,{left:g.left+'px',top:g.top+'px',width:g.width+'px',height:g.width+'px'});
  }
  // LE TEST remains owned by its existing momentary 26-window logic. Only its visual cap is themed via CSS.
  const le=root.document.querySelector('.b737-le-devices__test');
  if(le)le.dataset.recessedIntegrated='v2';
 }
 let queue=false;const schedule=()=>{if(queue)return;queue=true;root.requestAnimationFrame(()=>{queue=false;mount();});};
 const observer=new MutationObserver(schedule);observer.observe(host,{childList:true,subtree:false});
 root.addEventListener('resize',schedule);
 const releaseAircon=()=>nativeAirconReleases.get('aircon-ovht-test')?.();
 root.addEventListener('blur',releaseAircon);
 root.addEventListener('pagehide',releaseAircon);
 root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden)releaseAircon();});
 root.B737RecessedOverheadV2={version:'RECESS-OH18-FIT-0001',registry:()=>nodes.map(x=>({...x})),mounted:()=>[...mounted.keys()],refresh:mount};
 schedule();
})(window);
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../cockpit/overhead-photo-input-v1.js?v=PHOTO-INPUT-0001 */
try{
/* PHOTO-INPUT-0001
   Intercept only photo-tile selection in Unified's embedded overhead iframe.
   Do not alter the locked atlas renderer or physical switch event handling.
   Touch scroll and two-finger gestures still reach existing listeners.
*/
(function(){
 'use strict';
 const viewport=document.getElementById('viewport');
 if(!viewport)return;
 const tileSelector='.atlas-piece, .piece, .top-image';
 const controlSelector='button, input, select, textarea, a, label, [contenteditable], [role="slider"], [role="switch"], [role="checkbox"], [role="combobox"], [data-control], .mounted-toggle';
 function plainTile(event){
   const target=event.target;
   if(!(target instanceof Element)||!viewport.contains(target))return null;
   const tile=target.closest(tileSelector);
   if(!tile||!viewport.contains(tile))return null;
   // Physical controls mounted on or inside a photo must keep their own events.
   let node=target;
   while(node&&node!==tile){
     if(node.matches?.(controlSelector))return null;
     node=node.parentElement;
   }
   return tile;
 }
 // The frozen atlas's photo onClick and SVG polygon "pick()" must never fire
 // on this embedded route. These listeners run in capture phase.
 for(const name of ['click','dblclick','auxclick']){
   viewport.addEventListener(name,event=>{
     if(plainTile(event)){
       event.preventDefault();
       event.stopImmediatePropagation();
     }
   },true);
 }
 viewport.addEventListener('contextmenu',event=>{
   if(plainTile(event)){
     event.preventDefault();
     event.stopImmediatePropagation();
   }
 },true);
 viewport.addEventListener('dragstart',event=>{
   if(plainTile(event))event.preventDefault();
 },true);
 viewport.addEventListener('selectstart',event=>{
   if(plainTile(event))event.preventDefault();
 },true);
 // Photo tiles are not keyboard targets in the cockpit. This changes
 // only the runtime elements of THIS embedded copy, not any source atlas file.
 function neutralize(){
   viewport.querySelectorAll(tileSelector).forEach(tile=>{
     if(tile.getAttribute('role')==='button')tile.removeAttribute('role');
     if(tile.hasAttribute('tabindex'))tile.setAttribute('tabindex','-1');
   });
 }
 neutralize();
 const observer=new MutationObserver(neutralize);
 observer.observe(viewport,{childList:true,subtree:true});
 window.addEventListener('pagehide',()=>observer.disconnect(),{once:true});
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../cockpit/overhead-pinch-bridge-v1.js?v=UNIFIED-PINCH-0001 */
try{
/* UNIFIED-PINCH-0001: local overhead 2-touch gesture -> parent canvas.
   This file is mounted only in the embedded overhead, not the locked atlas.
*/
(function(){
 'use strict';
 if(window.parent===window)return;
 const root=document.getElementById('viewport');
 if(!root)return;
 const send=(kind,p={})=>window.parent.postMessage({type:'b737:cockpit-overhead',kind,...p},location.origin);
 let active=false,suppressUntilRelease=false;
 const pointers=new Set();
 // Suppress extra physical switch activations when a second finger joins.
 document.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch'||!root.contains(e.target))return;
  pointers.add(e.pointerId);
  if(pointers.size>=2){e.preventDefault();e.stopPropagation();}
 },true);
 document.addEventListener('pointermove',e=>{
  if(e.pointerType==='touch'&&pointers.size>=2&&pointers.has(e.pointerId)&&active){
   e.stopPropagation();
  }
 },true);
 const pointerEnd=e=>{if(e.pointerType==='touch')pointers.delete(e.pointerId)};
 document.addEventListener('pointerup',pointerEnd,true);
 document.addEventListener('pointercancel',pointerEnd,true);
 const point=e=>{
  if(e.touches.length<2)return null;
  const a=e.touches[0],b=e.touches[1];
  return {distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),
   x:(a.clientX+b.clientX)/2,y:(a.clientY+b.clientY)/2};
 };
 function start(e){
  if(e.touches.length<2)return;
  if(!active){active=true;suppressUntilRelease=true;send('pinch-start',point(e));}
  if(e.cancelable)e.preventDefault();
 }
 document.addEventListener('touchstart',start,{capture:true,passive:false});
 document.addEventListener('touchmove',e=>{
  if(e.touches.length>=2){
   if(!active)start(e);
   send('pinch-move',point(e));
   if(e.cancelable)e.preventDefault();
  }else if(suppressUntilRelease&&e.cancelable)e.preventDefault();
 },{capture:true,passive:false});
 function finish(e){
  const remaining=e.touches.length;
  if(active&&remaining<2){active=false;send('pinch-end',{remaining});}
  else if(suppressUntilRelease&&remaining===0)send('pinch-end',{remaining:0});
  if(remaining===0){suppressUntilRelease=false;pointers.clear();}
 }
 document.addEventListener('touchend',finish,{capture:true,passive:true});
 document.addEventListener('touchcancel',finish,{capture:true,passive:true});
 // A two-finger gesture must never leave a synthetic click on a switch.
 document.addEventListener('click',e=>{
  if(!suppressUntilRelease)return;
  if(root.contains(e.target)){e.preventDefault();e.stopImmediatePropagation();}
 },true);
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
