/* AIRCON-FCOM-0001: real OH21 P5-10 OVHT TEST and TRIP RESET hit zones.
 * Transparent controls over owner-approved photo: no extra face or labels.
 * Exact rects are OH21 source-coordinate registration for 1122x1402.
 * Do not latch TEST; pointer/key release, blur and pagehide always release.
 */
(function(root){
 'use strict';
 const SOURCE={width:1122,height:1402};
 const items=[
  {id:'OVHT_TEST',x:912,y:392,r:57,label:'WING–BODY OVHT TEST · PUSH AND HOLD (5 seconds)'},
  {id:'TRIP_RESET',x:559,y:986,r:58,label:'TRIP RESET · PUSH after cause removed'}
 ];
 let buttons=[],host=null,last=null,active=false,at=0,pressOwner=null;
 const now=()=>performance.now();
 const send=(id,held,durationMs=0)=>{
  if(parent!==root)parent.postMessage({type:'b737:cockpit-overhead',kind:'aircon-fcom-input',
   id,held,durationMs},location.origin);
 };
 function setHold(held,owner='POINTER'){
  if(active===held)return;
  active=held;
  if(held){at=now();pressOwner=owner;}
  const duration=held?0:Math.max(0,now()-at);
  const lights=root.B737OverheadLights;
  lights?.setWingBodyTestHeld?.(held);
  if(buttons[0]){buttons[0].dataset.held=String(held);
   buttons[0].title=held?'OVHT TEST — HOLDING':items[0].label;}
  send('OVHT_TEST',held,duration);
  if(!held){root.dispatchEvent(new CustomEvent('b737:aircon-ovht-test-complete',{
   detail:{durationMs:duration,metFiveSecondCheck:duration>=5000,origin:pressOwner}}));pressOwner=null;}
 }
 function reset(){
  root.B737OverheadLights?.tripReset?.();
  send('TRIP_RESET',true);
 }
 function make(item,layer){
  const button=document.createElement('button');button.type='button';
  button.className='aircon-fcom-photo-hit';
  button.dataset.airconControl=item.id;
  button.setAttribute('aria-label',item.label);
  button.title=item.label;
  button.style.cssText='position:absolute;pointer-events:auto;cursor:pointer;'+
   'background:transparent;border:0;border-radius:50%;margin:0;padding:0;z-index:1;'+
   'left:'+((item.x-item.r)/SOURCE.width*100)+'%;top:'+((item.y-item.r)/SOURCE.height*100)+'%;'+
   'width:'+(2*item.r/SOURCE.width*100)+'%;height:'+(2*item.r/SOURCE.height*100)+'%;';
  button.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;e.preventDefault();e.stopPropagation();
   if(item.id==='OVHT_TEST'){
    button.setPointerCapture(e.pointerId);setHold(true,'POINTER');
   }else reset();
  });
  if(item.id==='OVHT_TEST'){
   for(const event of ['pointerup','pointercancel','lostpointercapture'])
    button.addEventListener(event,e=>{e.stopPropagation();setHold(false,'POINTER');});
   button.addEventListener('keydown',e=>{
    if(![' ','Enter'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();if(!e.repeat)setHold(true,'KEYBOARD');
   });
   button.addEventListener('keyup',e=>{
    if(![' ','Enter'].includes(e.key))return;e.preventDefault();e.stopPropagation();setHold(false,'KEYBOARD');
   });
   button.addEventListener('blur',()=>setHold(false,'BLUR'));
  }else{
   button.addEventListener('keydown',e=>{
    if(![' ','Enter'].includes(e.key)||e.repeat)return;
    e.preventDefault();e.stopPropagation();reset();
   });
  }
  button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();});
  layer.append(button);return button;
 }
 function mount(){
  const piece=document.querySelector('#atlasAbsolute .atlas-piece[data-key="OH21"]');
  if(!piece)return false;
  if(host===piece&&buttons.every(b=>b.isConnected))return true;
  setHold(false,'REMOUNT');
  buttons.forEach(b=>b.remove());buttons=[];
  let layer=piece.querySelector('.aircon-fcom-hit-layer');
  if(layer)layer.remove();
  layer=document.createElement('div');layer.className='aircon-fcom-hit-layer';
  layer.style.cssText='position:absolute;inset:0;z-index:1600;pointer-events:none;';
  buttons=items.map(item=>make(item,layer));
  piece.append(layer);host=piece;
  return true;
 }
 function boot(){
  if(mount())return;
  const parent=document.getElementById('atlasAbsolute');if(!parent)return;
  const watch=new MutationObserver(()=>{if(mount())watch.disconnect();});
  watch.observe(parent,{childList:true});
 }
 root.addEventListener('blur',()=>setHold(false,'WINDOW_BLUR'));
 root.addEventListener('pagehide',()=>setHold(false,'PAGEHIDE'));
 document.addEventListener('visibilitychange',()=>{if(document.hidden)setHold(false,'HIDDEN');});
 root.B737AirconFCOMPhotoControlsV1=Object.freeze({
  status:()=>({mounted:buttons.length===2&&buttons.every(b=>b.isConnected),held:active,
   heldMs:active?now()-at:0,controlIds:items.map(x=>x.id)}),
  pressOVHT:()=>setHold(true,'INSTRUCTOR'),
  releaseOVHT:()=>setHold(false,'INSTRUCTOR'),
  tripReset:reset,
  mount
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})(window);
