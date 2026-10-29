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
  const r=viewport.getBoundingClientRect();
  const a=e.touches[0],b=e.touches[1];
  return {distance:Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY),
   x:(a.clientX+b.clientX)/2-r.left,y:(a.clientY+b.clientY)/2-r.top};
 };
 const interactive='button,input,select,textarea,a,[contenteditable="true"],[role="slider"],[role="switch"],[role="button"],[data-control],.cockpit-light,.mounted-light';
 let gesture=null,oneFinger=null,suppressRemaining=false,iframeBlocked=false;
 function begin(point,kind){
  if(!adapter()||!point||point.distance<2)return;
  const start=adapter().begin(point.distance,point.x,point.y);
  if(!start)return;
  gesture={kind,start};
  oneFinger=null;
  if(kind==='overhead')iframeBlocked=true;
 }
 function move(point,kind){
  if(!gesture||gesture.kind!==kind||!adapter())return;
  adapter().move(gesture.start,point.distance,point.x,point.y);
 }
 function finish(kind,remaining){
  if(gesture?.kind===kind)gesture=null;
  if(remaining>0)suppressRemaining=true;
  else {suppressRemaining=false;oneFinger=null;}
  if(kind==='overhead'&&remaining===0)iframeBlocked=false;
 }
 viewport.addEventListener('touchstart',e=>{
  if(e.touches.length>=2){
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
   viewport.scrollLeft=oneFinger.left-dx;
   viewport.scrollTop=oneFinger.top-dy;
   if(e.cancelable)e.preventDefault();
  }
 },{capture:true,passive:false});
 const end=e=>{
  if(e.touches.length<2&&gesture?.kind==='parent')finish('parent',e.touches.length);
  if(e.touches.length===0){oneFinger=null;suppressRemaining=false}
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
   const point=convertFromOverhead(d,frame);
   if(point){if(!gesture||gesture.kind!=='overhead')begin(point,'overhead');move(point,'overhead');}
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
 window.B737UnifiedPinchV1=Object.freeze({version:'UNIFIED-PINCH-0001'});
})();
