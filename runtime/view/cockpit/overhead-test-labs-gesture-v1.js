/* OVERHEAD-LAB-GESTURE-0001
 * Physical invariant: three intentional short taps, at the same non-control
 * point, in the same dedicated overhead panel. Never use click/dblclick counts:
 * native switch movement, button activation, zoom and drag are not lab gestures.
 * Owner18, IRS and atlas artwork remain completely untouched.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737OverheadLabGestureV1=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const GAP_MS=650,DOWN_MS=420,RADIUS_PX=12;
 const INTERACTIVE_SELECTOR=[
  'button','input','select','textarea','a','label',
  '[role="button"]','[role="slider"]','[role="switch"]','[role="checkbox"]',
  '[contenteditable="true"]','[data-control]','[data-light]','[data-rotary]',
  '[data-switch]','[data-action]','[data-knob]','[data-recessed]',
  '.mounted-toggle','.mounted-rotary','.mounted-light',
  '.owner18-guard-control','.owner18-guard','.guarded-switch',
  '.mounted-guard','.rotary-hitzone','.toggle-sprite',
  '.recessed-switch','.recessed-button','.le-device-control',
  '.le-devices-control','.press-oh22-control','.oh21-overlay-control'
 ].join(',');
 function isInteractive(node){
  if(!node)return false;
  if(typeof node.closest==='function'){
   try{return !!node.closest(INTERACTIVE_SELECTOR);}catch(_){return true;}
  }
  return !!node.isContentEditable;
 }
 const blank=()=>({count:0,region:null,x:null,y:null,lastAt:0,fire:false});
 function advance(previous,tap){
  const old=previous||blank();
  if(!tap||tap.valid!==true||!tap.region||!Number.isFinite(tap.x)||!Number.isFinite(tap.y)||!Number.isFinite(tap.at))return blank();
  const same=old.count>0&&old.region===tap.region&&tap.at>=old.lastAt&&tap.at-old.lastAt<=GAP_MS&&
   Math.hypot(tap.x-old.x,tap.y-old.y)<=RADIUS_PX;
  const count=same?old.count+1:1;
  return count===3?{...blank(),fire:true,region:tap.region}:{
   count,region:tap.region,x:tap.x,y:tap.y,lastAt:tap.at,fire:false
  };
 }
 function shortStationary(down,up){
  return !!down&&!!up&&down.id===up.id&&up.at>=down.at&&up.at-down.at<=DOWN_MS&&
   Math.hypot(up.x-down.x,up.y-down.y)<=RADIUS_PX&&down.region===up.region&&
   down.valid===true&&up.valid===true;
 }
 return Object.freeze({GAP_MS,DOWN_MS,RADIUS_PX,INTERACTIVE_SELECTOR,isInteractive,blank,advance,shortStationary});
});
