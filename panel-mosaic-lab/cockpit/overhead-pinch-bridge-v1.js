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
