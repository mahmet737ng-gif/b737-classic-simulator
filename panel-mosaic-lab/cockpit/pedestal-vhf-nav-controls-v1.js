/* PD-VHF-NAV-CONTROLS-0001 — 737 Classic VHF NAV/DME panel.
 * FCOM 11.10.13–14: two three-position spring-centered TEST toggles,
 * momentary VOR / DME and ILS UP/LT / DN/RT. Illuminated AUTO/MANUAL push selector.
 * AUTO is from FMC NAV auto frequency event; MANUAL is from the independent knob.
 * Test outputs are scoped diagnostics; existing flight instruments are not changed.
 */
(function(root){
'use strict';
const VERSION='PD-VHF-NAV-CONTROLS-0002';
const SEATS=Object.freeze(['CAPT','FO']);
const CONTROL=Object.freeze({vorDme:{up:'VOR',down:'DME'},ils:{up:'UP/LT',down:'DN/RT'}});
const EXPECTED=Object.freeze({
 VOR:'VOR tuned + course 000: CDI centered, bearing 180°, FROM',
 DME:'DME tuned: DME fail flag/dashes during test, reading <= 000.5',
 'UP/LT':'ILS tuned + course within 90° of heading: one dot UP and LEFT',
 'DN/RT':'ILS tuned + course within 90° of heading: one dot DOWN and RIGHT'
});
const data=new Map(SEATS.map(seat=>[seat,{mode:'auto',vorDme:'center',ils:'center'}]));
function read(seat,kind){
 return root.B737UnifiedMechanicalFrequencyV1?.getState?.('nav-'+seat.toLowerCase()+'-'+kind)?.frequencyKhz??null;
}
function getState(seat){
 const s=data.get(seat);if(!s)return null;
 const autoFrequencyKhz=read(seat,'auto'),manualFrequencyKhz=read(seat,'manual');
 return Object.freeze({version:VERSION,seat,mode:s.mode,
  autoFrequencyKhz,manualFrequencyKhz,
  activeFrequencyKhz:s.mode==='auto'?autoFrequencyKhz:manualFrequencyKhz,
  inactiveFrequencyKhz:s.mode==='auto'?manualFrequencyKhz:autoFrequencyKhz,
  activeTest:Object.freeze({vorDme:s.vorDme,ils:s.ils})});
}
function frame(seat){
 return document.querySelector?.('#unified-pedestal-faceplates [data-faceplate="vhf-nav-'+seat.toLowerCase()+'"]')||null;
}
function paint(seat){
 const plate=frame(seat),s=data.get(seat);
 if(!plate||!s)return;
 plate.dataset.navMode=s.mode;
 const button=plate.querySelector('[data-nav-mode-control]');
 if(button){
  button.dataset.mode=s.mode;
  button.setAttribute('aria-pressed',String(s.mode==='auto'));
  button.setAttribute('aria-label',seat+' NAV tuning: '+s.mode.toUpperCase());
 }
 for(const kind of Object.keys(CONTROL)){
  const toggle=plate.querySelector('[data-nav-test="'+kind+'"]');
  if(toggle){toggle.dataset.position=s[kind];toggle.setAttribute('aria-label',
   seat+' '+kind+' test: '+s[kind]);}
 }
}
function emitMode(seat,reason){
 root.dispatchEvent(new CustomEvent('b737:vhf-nav-mode',{detail:{...getState(seat),reason}}));
}
function setMode(seat,mode){
 if(!data.has(seat)||!['auto','manual'].includes(mode))return false;
 const s=data.get(seat);
 if(s.mode===mode){paint(seat);return true}
 s.mode=mode;paint(seat);emitMode(seat,'select');return true;
}
function setTest(seat,kind,position){
 if(!data.has(seat)||!CONTROL[kind]||!['up','center','down'].includes(position))return false;
 const s=data.get(seat);
 if(s[kind]===position)return true;
 s[kind]=position;paint(seat);
 const test=CONTROL[kind][position]||null;
 root.dispatchEvent(new CustomEvent('b737:vhf-nav-test',{detail:{
  version:VERSION,seat,control:kind,position,held:position!=='center',
  test,expectedIndications:test?EXPECTED[test]:null,
  activeFrequencyKhz:getState(seat).activeFrequencyKhz
 }}));
 return true;
}
// Owner-requested independent training adjustment of the AUTO drum, including
// while MANUAL is selected. The original FMC auto-tune input remains supported.
function tuneAuto(seat,part,dir){
 if(!SEATS.includes(seat)||!['outer','inner'].includes(part)||!Number.isFinite(dir)||dir===0)return false;
 const mechanical=root.B737UnifiedMechanicalFrequencyV1;
 const old=read(seat,'auto');
 if(!Number.isInteger(old))return false;
 const next=root.B737UnifiedVHFDualV1?.nextFrequency?.('NAV',old,part,dir);
 if(!Number.isInteger(next)||next===old)return false;
 if(!mechanical?.setNavAuto?.(seat,next))return false;
 emitMode(seat,'auto-window-tuned');
 return true;
}
function autoWindowControl(seat,plate){
 if(plate.querySelector('[data-nav-auto-tuner]'))return;
 const button=document.createElement('button');
 button.type='button';button.className='pd-nav-auto-tuner';
 button.dataset.navAutoTuner=seat;
 button.setAttribute('aria-label',seat+' NAV AUTO frequency: drag or wheel to tune; left digits MHz, right digits 50 kHz');
 button.title='AUTO FREQUENCY — drag / wheel to adjust while retaining both displays';
 let drag=null,skipClick=false;
 const partAt=x=>{
  const bounds=button.getBoundingClientRect();
  return x<bounds.left+bounds.width*0.60?'outer':'inner';
 };
 button.addEventListener('wheel',e=>{
  e.preventDefault();e.stopPropagation();
  tuneAuto(seat,partAt(e.clientX),e.deltaY<0?1:-1);
 },{passive:false});
 button.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  e.stopPropagation();
  drag={id:e.pointerId,x:e.clientX,y:e.clientY,part:partAt(e.clientX),acc:0,moved:false};
  button.setPointerCapture?.(e.pointerId);
 });
 button.addEventListener('pointermove',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  e.preventDefault();e.stopPropagation();
  drag.acc+=(drag.y-e.clientY)+(e.clientX-drag.x)*0.60;
  drag.x=e.clientX;drag.y=e.clientY;
  const steps=Math.trunc(drag.acc/9);
  if(!steps)return;
  drag.moved=true;drag.acc-=steps*9;
  for(let i=0;i<Math.min(Math.abs(steps),20);i++)
   tuneAuto(seat,drag.part,Math.sign(steps));
 });
 button.addEventListener('pointerup',e=>{
  if(!drag||drag.id!==e.pointerId)return;
  e.stopPropagation();skipClick=drag.moved;drag=null;
 });
 button.addEventListener('pointercancel',()=>{drag=null;skipClick=true});
 button.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  if(skipClick){skipClick=false;return}
  tuneAuto(seat,e.detail===0?'inner':partAt(e.clientX),e.shiftKey?-1:1);
 });
 button.addEventListener('keydown',e=>{
  if(!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))return;
  e.preventDefault();e.stopPropagation();
  tuneAuto(seat,e.shiftKey?'outer':'inner',e.key==='ArrowUp'||e.key==='ArrowRight'?1:-1);
 });
 plate.append(button);
}
function modeButton(seat,plate){
 let button=plate.querySelector('[data-nav-mode-control]');
 if(button)return;
 button=document.createElement('button');button.type='button';
 button.className='pd-nav-mode-switch';button.dataset.navModeControl=seat;
 button.title='VHF NAV — push to alternate AUTO / MANUAL';
 for(const mode of ['auto','manual']){
  const lamp=document.createElement('span');
  lamp.className='pd-nav-lamp pd-nav-lamp-'+mode;
  lamp.textContent=mode.toUpperCase();lamp.setAttribute('aria-hidden','true');
  button.append(lamp);
 }
 button.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  setMode(seat,data.get(seat).mode==='auto'?'manual':'auto');
 });
 plate.append(button);
}
function toggleButton(seat,plate,kind){
 if(plate.querySelector('[data-nav-test="'+kind+'"]'))return;
 const button=document.createElement('button');
 button.type='button';button.className='pd-nav-test-toggle';
 button.dataset.navTest=kind;button.dataset.position='center';
 button.title=kind==='vorDme'?'VOR / DME self-test — spring return':'ILS UP/LT / DN/RT self-test — spring return';
 const photo=document.createElement('span');photo.className='pd-nav-test-photo';photo.setAttribute('aria-hidden','true');button.append(photo);
 let heldPointer=null;
 function positionFromPoint(y){
  const r=button.getBoundingClientRect();
  return y>=r.top+r.height/2?'down':'up';
 }
 button.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  heldPointer=e.pointerId;button.setPointerCapture?.(heldPointer);
  setTest(seat,kind,positionFromPoint(e.clientY));
 });
 button.addEventListener('pointermove',e=>{
  if(heldPointer!==e.pointerId)return;
  e.preventDefault();e.stopPropagation();
  setTest(seat,kind,positionFromPoint(e.clientY));
 });
 function release(e){
  if(e&&heldPointer!==null&&e.pointerId!==heldPointer)return;
  heldPointer=null;e?.stopPropagation?.();setTest(seat,kind,'center');
 }
 button.addEventListener('pointerup',release);
 button.addEventListener('pointercancel',release);
 button.addEventListener('lostpointercapture',release);
 button.addEventListener('keydown',e=>{
  const position=e.key==='ArrowUp'?'up':e.key==='ArrowDown'?'down':
   (e.key==='Enter'||e.key===' ')?'up':null;
  if(!position)return;
  e.preventDefault();e.stopPropagation();setTest(seat,kind,position);
 });
 button.addEventListener('keyup',e=>{
  if(['ArrowUp','ArrowDown','Enter',' '].includes(e.key)){
   e.preventDefault();e.stopPropagation();setTest(seat,kind,'center');
  }
 });
 button.addEventListener('blur',()=>setTest(seat,kind,'center'));
 plate.append(button);
}
function mount(){
 let count=0;
 for(const seat of SEATS){
  const plate=frame(seat);if(!plate)continue;
  modeButton(seat,plate);
  autoWindowControl(seat,plate);
  toggleButton(seat,plate,'vorDme');
  toggleButton(seat,plate,'ils');
  paint(seat);count++;
 }
 return count===SEATS.length;
}
function start(){
 if(mount())return;
 const observer=new MutationObserver(()=>{if(mount())observer.disconnect()});
 observer.observe(document.body,{childList:true,subtree:true});
}
root.addEventListener('b737:pedestal-faceplates-mounted',mount);
root.addEventListener('b737:cockpit-mounted',mount);
root.addEventListener('b737:unified-vhf-frequency',e=>{
 const d=e.detail||{};
 if(d.kind==='NAV'&&SEATS.includes(d.seat))emitMode(d.seat,'manual-tuned');
});
root.addEventListener('b737:nav-auto-frequency',e=>{
 const d=e.detail||{};
 if(SEATS.includes(d.seat))emitMode(d.seat,'auto-tuned');
});
root.addEventListener('blur',()=>SEATS.forEach(seat=>{
 setTest(seat,'vorDme','center');setTest(seat,'ils','center');
}));
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
else start();
root.B737UnifiedVHFNavControlsV1=Object.freeze({
 version:VERSION,mount,getState,setMode,setTest,tuneAuto,expectedIndications:EXPECTED
});
})(window);
