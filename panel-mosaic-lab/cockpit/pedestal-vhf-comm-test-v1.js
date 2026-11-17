/* PD-COMM-TEST-0001 — momentary recessed receiver test per B737 Classic FCOM 5.10.2.
 * Holding COMM TEST defeats automatic squelch, permitting background receiver
 * noise / improved weak-signal reception. This is NOT a transmit or PTT test.
 * Receiver audio is routed by the separate ASP; no fabricated RF signal here.
 */
(function(root){
'use strict';
const VERSION='PD-COMM-TEST-0001',SEATS=Object.freeze(['CAPT','FO']);
const held=new Map(SEATS.map(seat=>[seat,false]));
function getState(seat){
 if(!SEATS.includes(seat))return null;
 const pressed=held.get(seat);
 return Object.freeze({version:VERSION,seat,pressed,
  automaticSquelchEnabled:!pressed,squelchForcedOpen:pressed,
  backgroundNoisePermitted:pressed,weakSignalReceptionEnhanced:pressed,
  activeFrequencyKhz:root.B737UnifiedVHFCommTFRV1?.getState?.(seat)?.activeFrequencyKhz??null});
}
function paint(seat){
 const button=document.querySelector?.('#unified-pedestal-faceplates [data-comm-test="'+seat+'"]');
 if(button){
  button.dataset.pressed=String(held.get(seat));
  button.setAttribute('aria-pressed',String(held.get(seat)));
 }
}
function setPressed(seat,pressed){
 if(!SEATS.includes(seat))return false;
 const next=Boolean(pressed);
 if(held.get(seat)===next){paint(seat);return true}
 held.set(seat,next);paint(seat);
 root.dispatchEvent(new CustomEvent('b737:vhf-comm-test',{detail:getState(seat)}));
 return true;
}
function create(seat){
 const frame=document.querySelector?.('#unified-pedestal-faceplates [data-faceplate="vhf-comm-'+seat.toLowerCase()+'"]');
 if(!frame)return false;
 if(frame.querySelector('[data-comm-test]')){paint(seat);return true}
 const button=document.createElement('button');
 button.type='button';button.className='pd-vhf-comm-test';
 button.dataset.commTest=seat;
 button.setAttribute('aria-label',seat+' COMM TEST — hold to override receiver squelch');
 button.setAttribute('aria-pressed','false');
 button.title='COMM TEST — momentary receiver squelch override';
 const cap=document.createElement('span');cap.className='pd-comm-test-cap';button.append(cap);
 let pointerId=null;
 button.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  e.stopPropagation();e.preventDefault();
  pointerId=e.pointerId;button.setPointerCapture?.(pointerId);setPressed(seat,true);
 });
 function release(e){
  if(e&&pointerId!==null&&e.pointerId!==pointerId)return;
  e?.stopPropagation?.();pointerId=null;setPressed(seat,false);
 }
 button.addEventListener('pointerup',release);
 button.addEventListener('pointercancel',release);
 button.addEventListener('lostpointercapture',release);
 button.addEventListener('keydown',e=>{
  if(e.repeat||!['Space','Enter',' '].includes(e.key))return;
  e.preventDefault();e.stopPropagation();setPressed(seat,true);
 });
 button.addEventListener('keyup',e=>{
  if(!['Space','Enter',' '].includes(e.key))return;
  e.preventDefault();e.stopPropagation();setPressed(seat,false);
 });
 button.addEventListener('blur',()=>setPressed(seat,false));
 frame.append(button);paint(seat);return true;
}
function mount(){return SEATS.map(create).every(Boolean)}
function start(){
 if(mount())return;
 const watcher=new MutationObserver(()=>{if(mount())watcher.disconnect()});
 watcher.observe(document.body,{childList:true,subtree:true});
}
root.addEventListener('blur',()=>SEATS.forEach(seat=>setPressed(seat,false)));
root.addEventListener('b737:pedestal-faceplates-mounted',mount);
root.addEventListener('b737:cockpit-mounted',mount);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
root.B737UnifiedVHFCommTestV1=Object.freeze({version:VERSION,mount,getState,setPressed});
})(window);
