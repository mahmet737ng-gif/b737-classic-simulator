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
 return Object.freeze({normalize,pan});
});
