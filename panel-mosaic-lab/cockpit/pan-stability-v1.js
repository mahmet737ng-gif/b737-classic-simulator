/* Unified viewport geometry guard v1.
 * Read-only navigation math; no aircraft, instrument or protected artwork changes.
 * Prevents stale input deltas and preserves user-selected visual-first navigation
 * during the switch to the hydrated Unified cockpit.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root&&root.document)root.B737PanStabilityV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const finite=Number.isFinite;
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function limit(available,visible){
  if(!finite(available)||!finite(visible))return Infinity;
  return Math.max(0,available-visible);
 }
 function boundedPan(viewport,dx,dy){
  if(!viewport||![dx,dy].every(finite))return false;
  const maxX=limit(viewport.scrollWidth,viewport.clientWidth);
  const maxY=limit(viewport.scrollHeight,viewport.clientHeight);
  viewport.scrollLeft=clamp(viewport.scrollLeft-dx,0,maxX);
  viewport.scrollTop=clamp(viewport.scrollTop-dy,0,maxY);
  return true;
 }
 function step(previous,current,viewport){
  if(!previous||!current||![previous.x,previous.y,current.x,current.y].every(finite))
   return {accepted:false,dx:0,dy:0};
  const dx=current.x-previous.x,dy=current.y-previous.y;
  // One input packet cannot legitimately move farther than most of the
  // viewport. Multi-screen/iframe coordinate changes are rejected instead
  // of teleporting the entire cockpit to an unrelated section.
  const maxX=Math.max(120,(viewport?.clientWidth||800)*.70);
  const maxY=Math.max(120,(viewport?.clientHeight||600)*.70);
  return {accepted:Math.abs(dx)<=maxX&&Math.abs(dy)<=maxY,dx,dy};
 }
 function handoff(snapshot,canvas,viewport){
  if(!snapshot||snapshot.interacted!==true||
   !finite(snapshot.zoom)||snapshot.zoom<=0||!canvas||!viewport)return null;
  const zoom=clamp(snapshot.zoom,.04,2);
  const left=finite(snapshot.left)?snapshot.left:0,top=finite(snapshot.top)?snapshot.top:0;
  const screenW=Math.max(0,canvas.width*zoom),screenH=Math.max(0,canvas.height*zoom);
  const x=Math.max(0,(viewport.clientWidth-screenW)/2),y=Math.max(0,(viewport.clientHeight-screenH)/2);
  return {zoom,left:clamp(left,0,Math.max(0,screenW-viewport.clientWidth)),
   top:clamp(top,0,Math.max(0,screenH-viewport.clientHeight)),
   sceneLeft:x,sceneTop:y,focused:snapshot.focused||'main'};
 }
 return Object.freeze({version:'PAN-STABLE-0004-HANDOFF-DELTA-GUARD',step,boundedPan,handoff});
});
