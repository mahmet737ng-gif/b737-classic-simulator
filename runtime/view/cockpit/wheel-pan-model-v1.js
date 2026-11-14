/* Unified cockpit wheel routing (display navigation only).
 * Distinguishes line/pixel/page wheel deltas. No effect on cockpit controls.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737WheelPanModelV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 function normalize(payload,viewport){
  if(!payload||!Number.isFinite(payload.deltaX)||!Number.isFinite(payload.deltaY))return null;
  const mode=payload.deltaMode===1?1:payload.deltaMode===2?2:0;
  const factor=mode===1?16:mode===2?Math.max(1,Number(viewport?.height)||600):1;
  let x=payload.deltaX*factor,y=payload.deltaY*factor;
  if(payload.shiftKey&&x===0){x=y;y=0;}
  if(!Number.isFinite(x)||!Number.isFinite(y))return null;
  return {x,y};
 }
 function pan(viewport,payload){
  const p=normalize(payload,{height:viewport?.clientHeight});
  if(!p||!viewport)return false;
  viewport.scrollLeft+=p.x;
  viewport.scrollTop+=p.y;
  return true;
 }

 // RAF-coalesced visual pan. Keep the original synchronous pan() API for
 // compatibility with standalone embedded panels and existing test fixtures.
 function createController(viewport,{requestFrame=null,cancelFrame=null,ease=0.48}={}){
  const raf=requestFrame||(typeof requestAnimationFrame==='function'?requestAnimationFrame:null);
  const caf=cancelFrame||(typeof cancelAnimationFrame==='function'?cancelAnimationFrame:null);
  if(!viewport)throw Error('Wheel viewport required');
  if(!Number.isFinite(ease)||ease<=0||ease>1)throw Error('Invalid smoothing factor');
  let goalX=0,goalY=0,ticket=null,running=false;
  function bound(value,extent,visible){
   return Math.max(0,Math.min(value,Number.isFinite(extent)&&Number.isFinite(visible)?Math.max(0,extent-visible):Infinity));
  }
  function cancel(){
   if(ticket!==null&&caf)caf(ticket);
   ticket=null;running=false;
  }
  function frame(){
   ticket=null;if(!running)return;
   const dx=goalX-viewport.scrollLeft,dy=goalY-viewport.scrollTop;
   if(Math.abs(dx)<0.5&&Math.abs(dy)<0.5){
    viewport.scrollLeft=goalX;viewport.scrollTop=goalY;running=false;return;
   }
   viewport.scrollLeft+=dx*ease;viewport.scrollTop+=dy*ease;
   ticket=raf(frame);
  }
  function enqueue(payload){
   const delta=normalize(payload,{height:viewport.clientHeight});
   if(!delta)return false;
   if(!raf||!caf)return pan(viewport,payload);
   if(!running){goalX=viewport.scrollLeft;goalY=viewport.scrollTop;running=true;}
   goalX=bound(goalX+delta.x,viewport.scrollWidth,viewport.clientWidth);
   goalY=bound(goalY+delta.y,viewport.scrollHeight,viewport.clientHeight);
   if(ticket===null)ticket=raf(frame);
   return true;
  }
  return Object.freeze({pan:enqueue,cancel,active:()=>running});
 }
 return Object.freeze({normalize,pan,createController});
});
