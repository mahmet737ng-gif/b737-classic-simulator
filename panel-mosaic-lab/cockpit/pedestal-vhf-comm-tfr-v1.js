/* PD-COMM-TFR-0001 — independent CAPT/FO VHF COMM transfer switches.
 * Transfer selects an active window; tuning either frequency is unaffected.
 * The cockpit event provides the selected frequency to later radio/audio consumers.
 */
(function(root){
'use strict';
const VERSION='PD-COMM-TFR-0001',SEATS=['CAPT','FO'],SIDES=['left','right'];
const selected=new Map(SEATS.map(seat=>[seat,'left']));
function key(seat,side){return 'comm-'+seat.toLowerCase()+'-'+side}
function frequency(seat,side){
 const id=key(seat,side);
 const drum=root.B737UnifiedMechanicalFrequencyV1?.getState?.(id);
 if(Number.isInteger(drum?.frequencyKhz))return drum.frequencyKhz;
 const rotor=root.B737UnifiedVHFDualV1?.getState?.(id);
 return Number.isInteger(rotor?.frequencyKhz)?rotor.frequencyKhz:null;
}
function state(seat){
 if(!SEATS.includes(seat))return null;
 const activeSide=selected.get(seat),standbySide=activeSide==='left'?'right':'left';
 return Object.freeze({version:VERSION,seat,activeSide,standbySide,
  activeWindowId:key(seat,activeSide),activeFrequencyKhz:frequency(seat,activeSide),
  standbyFrequencyKhz:frequency(seat,standbySide)});
}
function frame(seat){
 return document.querySelector?.('#unified-pedestal-faceplates [data-faceplate="vhf-comm-'+seat.toLowerCase()+'"]')||null;
}
function paint(seat){
 const plate=frame(seat);if(!plate)return;
 const side=selected.get(seat);plate.dataset.tfrActive=side;
 const button=plate.querySelector('[data-comm-tfr]');
 if(button){
  button.dataset.side=side;
  button.setAttribute('aria-checked',String(side==='right'));
  button.setAttribute('aria-label',seat+' VHF COMM TFR: '+side+' frequency active');
  button.title=seat+' VHF COMM — '+side.toUpperCase()+' ACTIVE';
 }
}
function announce(seat,reason){
 root.dispatchEvent(new CustomEvent('b737:vhf-comm-tfr',{detail:{...state(seat),reason}}));
}
function setActive(seat,side){
 if(!SEATS.includes(seat)||!SIDES.includes(side))return false;
 if(selected.get(seat)===side){paint(seat);return true}
 selected.set(seat,side);paint(seat);announce(seat,'transfer');return true;
}
function create(seat){
 const plate=frame(seat);if(!plate)return false;
 if(plate.querySelector('[data-comm-tfr]')){paint(seat);return true}
 const button=document.createElement('button');
 button.type='button';button.className='pd-vhf-comm-tfr';
 button.dataset.commTfr=seat;button.setAttribute('role','switch');
 button.setAttribute('aria-keyshortcuts','ArrowLeft ArrowRight');
 const track=document.createElement('span'),knob=document.createElement('span');
 track.className='pd-tfr-track';knob.className='pd-tfr-knob';button.append(track,knob);
 let drag=null,ignoreClick=false;
 button.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  e.stopPropagation();drag={id:e.pointerId,x:e.clientX,moved:false};
  button.setPointerCapture?.(e.pointerId);
 });
 button.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  const dx=e.clientX-drag.x;
  if(Math.abs(dx)<8&&!drag.moved)return;
  e.preventDefault();e.stopPropagation();drag.moved=true;
  setActive(seat,dx<0?'left':'right');
 });
 button.addEventListener('pointerup',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  e.stopPropagation();ignoreClick=drag.moved;drag=null;
 });
 button.addEventListener('pointercancel',()=>{drag=null;ignoreClick=true});
 button.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  if(ignoreClick){ignoreClick=false;return}
  if(e.detail===0){setActive(seat,selected.get(seat)==='left'?'right':'left');return}
  const bounds=button.getBoundingClientRect();
  const half=e.clientX<bounds.left+bounds.width/2?'left':'right';
  setActive(seat,half===selected.get(seat)?(half==='left'?'right':'left'):half);
 });
 button.addEventListener('keydown',e=>{
  if(e.key!=='ArrowLeft'&&e.key!=='ArrowRight')return;
  e.preventDefault();e.stopPropagation();
  setActive(seat,e.key==='ArrowLeft'?'left':'right');
 });
 plate.append(button);paint(seat);return true;
}
function mount(){return SEATS.map(create).every(Boolean)}
function start(){
 if(mount())return;
 const observer=new MutationObserver(()=>{if(mount())observer.disconnect()});
 observer.observe(document.body,{childList:true,subtree:true});
}
root.addEventListener('b737:cockpit-mounted',mount);
root.addEventListener('b737:pedestal-faceplates-mounted',mount);
root.addEventListener('b737:unified-vhf-frequency',e=>{
 const d=e.detail||{};
 if(d.kind==='COMM'&&SEATS.includes(d.seat))
  announce(d.seat,selected.get(d.seat)===d.position?'active-tuned':'standby-tuned');
});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
root.B737UnifiedVHFCommTFRV1=Object.freeze({version:VERSION,seats:Object.freeze(SEATS.slice()),
 sides:Object.freeze(SIDES.slice()),mount,getState:state,setActive});
})(window);
