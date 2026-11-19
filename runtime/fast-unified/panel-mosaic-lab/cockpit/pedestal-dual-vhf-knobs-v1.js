/* PD-VHF-DUAL-0004: independent, cyclic whole-MHz and fractional tuning knobs.
   Hole registration is measured on immutable 1799px source faceplates.
   Visual overlay only; frequency change events are available for radio wiring. */
(function(root){
'use strict';
const VERSION='PD-VHF-DUAL-0004';
const source=document.currentScript?.src||location.href;
const ASSET=new URL('./assets/vhf-concentric-ivory-v1.webp',source).href;
// Source pixel coordinates; COMM is 1799x815, NAV is 1799x813.
const SLOTS=Object.freeze([
 Object.freeze({"id":"comm-capt-left","plate":"vhf-comm-capt","kind":"COMM","seat":"CAPT","position":"left","cx":404,"cy":575,"d":315,"sw":1799,"sh":815}),
 Object.freeze({"id":"comm-capt-right","plate":"vhf-comm-capt","kind":"COMM","seat":"CAPT","position":"right","cx":1349,"cy":575,"d":315,"sw":1799,"sh":815}),
 Object.freeze({"id":"comm-fo-left","plate":"vhf-comm-fo","kind":"COMM","seat":"FO","position":"left","cx":404,"cy":575,"d":315,"sw":1799,"sh":815}),
 Object.freeze({"id":"comm-fo-right","plate":"vhf-comm-fo","kind":"COMM","seat":"FO","position":"right","cx":1349,"cy":575,"d":315,"sw":1799,"sh":815}),
 Object.freeze({"id":"nav-capt-manual","plate":"vhf-nav-capt","kind":"NAV","seat":"CAPT","position":"manual","cx":1338.5,"cy":541,"d":315,"sw":1799,"sh":813}),
 Object.freeze({"id":"nav-fo-manual","plate":"vhf-nav-fo","kind":"NAV","seat":"FO","position":"manual","cx":1338.5,"cy":541,"d":315,"sw":1799,"sh":813})
]);
const state=new Map();
const minMax={COMM:[118000,136975],NAV:[108000,117950]};
const initial={COMM:118000,NAV:110300};
const channelStep={COMM:25,NAV:50};
// Both shafts operate independent cyclic number bands. Neither shaft carries into
// the other: NAV 108<->117 MHz and 00<->95 (50-kHz); COMM 118<->136
// MHz and 000<->975 (25-kHz). Counter-clockwise/left swipe decrements.
function nextFrequency(kind,khz,part,dir){
 const limits=minMax[kind],spacing=channelStep[kind];
 if(!limits||!['outer','inner'].includes(part)||!Number.isInteger(khz)||
  khz<limits[0]||khz>limits[1]||khz%spacing!==0||!Number.isFinite(dir)||!dir)return null;
 const whole=Math.floor(khz/1000),fraction=khz%1000,sign=Math.sign(dir);
 const wrap=(n,count)=>((n%count)+count)%count;
 if(part==='outer'){
  const first=Math.floor(limits[0]/1000),last=Math.floor(limits[1]/1000);
  return (first+wrap(whole-first+sign,last-first+1))*1000+fraction;
 }
 return whole*1000+wrap(fraction/spacing+sign,1000/spacing)*spacing;
}
function step(slot,part,dir){
 const s=state.get(slot.id);if(!s||!dir)return false;
 const next=nextFrequency(slot.kind,s.khz,part,dir);
 if(next===null||next===s.khz)return false;
 const direction=Math.sign(dir);
 s.khz=next;s.angle[part]=(s.angle[part]+direction*(part==='outer'?12:16))%360;
 s.images[part].style.transform='rotate('+s.angle[part]+'deg)';
 s.root.dataset.frequency=(next/1000).toFixed(3);
 root.dispatchEvent(new CustomEvent('b737:unified-vhf-frequency',{detail:{
  version:VERSION,id:slot.id,kind:slot.kind,seat:slot.seat,position:slot.position,part,direction,
  whole:Math.floor(next/1000),fractionKhz:next%1000,
  frequencyKhz:next,frequencyMhz:Number((next/1000).toFixed(3))
 }}));
 return true;
}
function bind(button,slot,part){
 let track=null,skipClick=false;
 const delta=(dir)=>step(slot,part,dir);
 button.addEventListener('wheel',e=>{
  e.preventDefault();e.stopPropagation();delta(e.deltaY<0?1:-1);
 },{passive:false});
 button.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;e.stopPropagation();
  track={id:e.pointerId,x:e.clientX,y:e.clientY,acc:0,moved:false};
  button.setPointerCapture?.(e.pointerId);
 });
 button.addEventListener('pointermove',e=>{
  if(!track||track.id!==e.pointerId)return;
  e.preventDefault();e.stopPropagation();
  track.acc+=track.y-e.clientY+(e.clientX-track.x)*.6;
  track.x=e.clientX;track.y=e.clientY;
  const n=Math.trunc(track.acc/9);
  if(n){track.moved=true;track.acc-=n*9;
   for(let i=0;i<Math.min(Math.abs(n),24);i++)delta(Math.sign(n));
  }
 });
 button.addEventListener('pointerup',e=>{
  e.stopPropagation();skipClick=!!track?.moved;track=null;
 });
 button.addEventListener('pointercancel',()=>{track=null;skipClick=true});
 button.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  if(skipClick){skipClick=false;return}delta(e.shiftKey?-1:1);
 });
 button.addEventListener('keydown',e=>{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();
  delta(e.key==='ArrowUp'||e.key==='ArrowRight'?1:-1);
 });
}
function make(slot,frame){
 let mount=frame.querySelector('[data-vhf-rotor="'+slot.id+'"]');
 if(mount)return true;
 mount=document.createElement('div');
 mount.className='pd-vhf-rotor';mount.dataset.vhfRotor=slot.id;
 Object.assign(mount.style,{left:(slot.cx/slot.sw*100)+'%',
  top:(slot.cy/slot.sh*100)+'%',width:(slot.d/slot.sw*100)+'%'});
 const images={};
 for(const part of ['outer','inner']){
  const b=document.createElement('button');b.type='button';
  b.className='pd-vhf-'+part;b.dataset.part=part;
  b.setAttribute('aria-label',slot.id+' '+part+' frequency '+(part==='outer'?'MHz':'kHz'));
  b.title=slot.kind+' '+slot.id+' '+(part==='outer'?'whole MHz':'decimal kHz');
  const img=document.createElement('img');img.src=ASSET;img.draggable=false;img.alt='';
  b.append(img);mount.append(b);images[part]=img;
  bind(b,slot,part);
 }
 frame.append(mount);
 state.set(slot.id,{root:mount,khz:initial[slot.kind],
  angle:{outer:0,inner:0},images});
 mount.dataset.frequency=(initial[slot.kind]/1000).toFixed(3);
 return true;
}
function mount(){
 let done=0;
 for(const slot of SLOTS){
  const frame=document.querySelector('#unified-pedestal-faceplates [data-faceplate="'+slot.plate+'"]');
  if(frame&&make(slot,frame))done++;
 }
 return done===SLOTS.length;
}
function start(){
 if(mount())return;
 const observer=new MutationObserver(()=>{
  if(mount())observer.disconnect();
 });
 observer.observe(document.body,{childList:true,subtree:true});
}
root.addEventListener('b737:cockpit-mounted',mount);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
function setFrequency(id,khz){
 const slot=SLOTS.find(x=>x.id===id),s=state.get(id);
 if(!slot||!s||!Number.isInteger(khz))return false;
 const [min,max]=minMax[slot.kind],spacing=slot.kind==='COMM'?25:50;
 if(khz<min||khz>max||khz%spacing!==0)return false;
 if(s.khz===khz)return true;
 s.khz=khz;s.root.dataset.frequency=(khz/1000).toFixed(3);
 root.dispatchEvent(new CustomEvent('b737:unified-vhf-frequency',{detail:{
  version:VERSION,id:slot.id,kind:slot.kind,seat:slot.seat,position:slot.position,part:'external',
  whole:Math.floor(khz/1000),fractionKhz:khz%1000,frequencyKhz:khz,
  frequencyMhz:Number((khz/1000).toFixed(3))
 }}));
 return true;
}
root.B737UnifiedVHFDualV1=Object.freeze({version:VERSION,slots:SLOTS,asset:ASSET,mount,setFrequency,nextFrequency,spec:Object.freeze({COMM:{minKhz:118000,maxKhz:136975,stepKhz:25},NAV:{minKhz:108000,maxKhz:117950,stepKhz:50}}),
 tune:(id,part,dir)=>{
  const s=SLOTS.find(x=>x.id===id);return !!s&&['outer','inner'].includes(part)&&step(s,part,dir);
 },getState:(id)=>{const s=state.get(id);return s?Object.freeze({frequencyKhz:s.khz,frequencyMhz:s.khz/1000,...s.angle}):null;}});
})(window);
