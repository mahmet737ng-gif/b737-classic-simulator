/* UNIFIED-PINCH-0001 — zoom and pan the cockpit, never the browser page.
   Works over the main panel and pedestal, plus the embedded overhead iframe.
   One-finger taps on real hardware controls are deliberately not intercepted.
*/
(function(){
 'use strict';
 const viewport=document.getElementById('viewport');
 if(!viewport)return;
 const adapter=()=>window.B737UnifiedPinchAdapterV1;
 const clampPoint=(e)=>{
  // The viewport boundary is stationary during scroll/zoom. Cache its rect
  // for the gesture to avoid forced layout reads after the prior zoom frame.
  const r=pinchViewportRect||(pinchViewportRect=viewport.getBoundingClientRect());
  const a=e.touches[0],b=e.touches[1];
  return {distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),
   x:(a.clientX+b.clientX)/2-r.left,y:(a.clientY+b.clientY)/2-r.top};
 };
 const interactive='button,input,select,textarea,a,[contenteditable="true"],[role="slider"],[role="switch"],[role="button"],[data-control],.cockpit-light,.mounted-light';
 let gesture=null,oneFinger=null,suppressRemaining=false,iframeBlocked=false,pinchViewportRect=null;
 // A touch controller can send many move events before the display can paint.
 // Coalesce only the viewport pan writes; never alter the aircraft controls,
 // switch/guard hit testing, or the final finger-end scroll location.
 function flushOneFinger(){
  const current=oneFinger;
  if(!current)return;
  if(current.frame!==undefined){
   cancelAnimationFrame(current.frame);
   current.frame=undefined;
  }
  if(current.pending){
   viewport.scrollLeft=current.left-current.pending.dx;
   viewport.scrollTop=current.top-current.pending.dy;
   current.pending=null;
  }
  oneFinger=null;
 }
 function moveOneFinger(current,dx,dy){
  current.pending={dx,dy};
  if(current.frame!==undefined)return;
  current.frame=requestAnimationFrame(()=>{
   current.frame=undefined;
   if(oneFinger!==current)return;
   const point=current.pending;
   current.pending=null;
   if(!point)return;
   viewport.scrollLeft=current.left-point.dx;
   viewport.scrollTop=current.top-point.dy;
  });
 }
 function begin(point,kind){
  if(!adapter()||!point||point.distance<2)return;
  // Flush the last one-finger coordinate before capturing the pinch anchor.
  flushOneFinger();
  const start=adapter().begin(point.distance,point.x,point.y);
  if(!start)return;
  gesture={kind,start};
  if(kind==='overhead')iframeBlocked=true;
 }
 // Coalesce high-frequency touchmove messages to the next screen frame.
 // A single paint uses the newest midpoint/scale without intermediate layouts.
 function move(point,kind){
  if(!gesture||gesture.kind!==kind||!adapter())return;
  const current=gesture;
  current.nextPoint=point;
  if(current.frame!==undefined)return;
  current.frame=requestAnimationFrame(()=>{
   current.frame=undefined;
   const queued=current.nextPoint;
   current.nextPoint=null;
   if(gesture!==current||!queued)return;
   const latest=typeof queued==='function'?queued():queued;
   if(latest)adapter()?.move(current.start,latest.distance,latest.x,latest.y);
  });
 }
 function finish(kind,remaining){
  if(gesture?.kind===kind){
   const current=gesture;
   if(current.frame!==undefined)cancelAnimationFrame(current.frame);
   // Preserve the final finger position when the gesture ends before paint.
   const queued=current.nextPoint;
   const latest=typeof queued==='function'?queued():queued;
   if(latest)adapter()?.move(current.start,latest.distance,latest.x,latest.y);
   // Restore exact display-label geometry and schedule source image quality
   // only when the pinch finishes; never during its compositor frame loop.
   adapter()?.end?.(current.start);
   gesture=null;
  }
  if(remaining>0)suppressRemaining=true;
  else {suppressRemaining=false;flushOneFinger();}
  if(kind==='overhead'&&remaining===0)iframeBlocked=false;
  if(kind==='parent')pinchViewportRect=null;
 }
 viewport.addEventListener('touchstart',e=>{
  if(e.touches.length>=2){
   if(!gesture||gesture.kind!=='parent')pinchViewportRect=null;
   const point=clampPoint(e);
   if(!gesture||gesture.kind!=='parent')begin(point,'parent');
   oneFinger=null;
   if(e.cancelable)e.preventDefault();
   e.stopImmediatePropagation(); // suppress the older native pinch listener
  }else if(e.touches.length===1&&!suppressRemaining&&!gesture){
   const el=e.target;
   if(el instanceof Element&&el.closest(interactive)){oneFinger=null;return}
   const touch=e.touches[0];
   oneFinger={id:touch.identifier,x:touch.clientX,y:touch.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};
  }
 },{capture:true,passive:false});
 viewport.addEventListener('touchmove',e=>{
  if(e.touches.length>=2){
   const point=clampPoint(e);
   if(!gesture||gesture.kind!=='parent')begin(point,'parent');
   move(point,'parent');
   if(e.cancelable)e.preventDefault();
   e.stopImmediatePropagation();
  }else if(gesture||suppressRemaining){
   if(e.cancelable)e.preventDefault();
   e.stopImmediatePropagation();
  }else if(oneFinger&&e.touches.length===1){
   const touch=e.touches[0];
   if(touch.identifier!==oneFinger.id)return;
   const dx=touch.clientX-oneFinger.x,dy=touch.clientY-oneFinger.y;
   moveOneFinger(oneFinger,dx,dy);
   if(e.cancelable)e.preventDefault();
  }
 },{capture:true,passive:false});
 const end=e=>{
  if(e.touches.length<2&&gesture?.kind==='parent')finish('parent',e.touches.length);
  if(oneFinger){
   // Touchend may contain a final coordinate not present in touchmove.
   const finalTouch=Array.from(e.changedTouches||[]).find(t=>t.identifier===oneFinger.id);
   if(finalTouch)oneFinger.pending={
    dx:finalTouch.clientX-oneFinger.x,dy:finalTouch.clientY-oneFinger.y
   };
   if(finalTouch||e.touches.length===0)flushOneFinger();
  }
  if(e.touches.length===0)suppressRemaining=false;
 };
 viewport.addEventListener('touchend',end,{capture:true,passive:true});
 viewport.addEventListener('touchcancel',end,{capture:true,passive:true});
 // The overhead is an iframe. Touch events cannot bubble across frames, so its
 // gesture bridge sends a midpoint in local iframe coordinates.
 function convertFromOverhead(data,frame){
  if(!Number.isFinite(data.distance)||data.distance<2||!Number.isFinite(data.x)||!Number.isFinite(data.y))return null;
  const r=frame.getBoundingClientRect(),v=viewport.getBoundingClientRect();
  const factor=r.width/(frame.clientWidth||2220);
  if(!Number.isFinite(factor)||factor<=0)return null;
  return {distance:data.distance,x:r.left-v.left+data.x*factor,y:r.top-v.top+data.y*factor};
 }
 window.addEventListener('message',e=>{
  const frame=document.getElementById('overheadFrame');
  if(!frame||e.source!==frame.contentWindow||e.origin!==location.origin||e.data?.type!=='b737:cockpit-overhead')return;
  const d=e.data;
  if(d.kind==='pinch-start'){
   const point=convertFromOverhead(d,frame);
   if(point)begin(point,'overhead');
   return;
  }
  if(d.kind==='pinch-move'){
   // An iframe reports many touch-move messages during one screen frame.
   // Defer the expensive parent/iframe rect reads until the one rAF that
   // actually applies the zoom. The latest midpoint always wins.
   if(!gesture||gesture.kind!=='overhead'){
    const first=convertFromOverhead(d,frame);
    if(first)begin(first,'overhead');
   }
   if(gesture?.kind==='overhead')move(()=>convertFromOverhead(d,frame),'overhead');
   return;
  }
  if(d.kind==='pinch-end'){
   finish('overhead',Math.max(0,Number(d.remaining)||0));
   return;
  }
  // Block the old one-pointer pan stream during a multi-touch overhead gesture.
  if(iframeBlocked&&['pan-start','pan-move','pan-end'].includes(d.kind)){
   e.stopImmediatePropagation();
  }
 },true);
 window.addEventListener('resize',()=>{pinchViewportRect=null;});
 window.B737UnifiedPinchV1=Object.freeze({version:'UNIFIED-PINCH-0003'});
})();
