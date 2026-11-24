(async()=>{
;
/* ./pedestal-mechanical-frequency-v1.js?v=PD-ROLLING-FREQUENCY-0003 */
try{
/* B737 Classic VHF rotating-drum frequency displays, photographic pedestal.
 * Owner-provided 5-number mechanical windows: three MHz digits + decimal + two fraction digits.
 * Source: LHT LAN 737CL ATA23 VHF 118.000-136.975 MHz, ATA34 NAV 108.00-117.95 MHz.
 * 25 kHz COM channels use a 2-digit legacy display (e.g. 118.025 reads 118.02).
 * Exact channel remains in integer kHz; this readout does NOT simulate RF transmission.
 */
(function(root){
'use strict';
const VERSION='PD-ROLLING-FREQUENCY-0003';
const CHANNELS={COMM:{min:118000,max:136975,step:25},NAV:{min:108000,max:117950,step:50}};
const WINDOWS=[
 {id:'comm-capt-left',plate:'vhf-comm-capt',kind:'COMM',seat:'CAPT',rect:[215,167,395,161],dim:[1799,815],index:'bar'},
 {id:'comm-capt-right',plate:'vhf-comm-capt',kind:'COMM',seat:'CAPT',rect:[1117,167,405,161],dim:[1799,815],index:'wedge'},
 {id:'comm-fo-left',plate:'vhf-comm-fo',kind:'COMM',seat:'FO',rect:[215,167,395,161],dim:[1799,815],index:'bar'},
 {id:'comm-fo-right',plate:'vhf-comm-fo',kind:'COMM',seat:'FO',rect:[1117,167,405,161],dim:[1799,815],index:'wedge'},
 {id:'nav-capt-manual',plate:'vhf-nav-capt',kind:'NAV',seat:'CAPT',rect:[1103,142,462,182],dim:[1799,813],index:'bar'},
 {id:'nav-fo-manual',plate:'vhf-nav-fo',kind:'NAV',seat:'FO',rect:[1103,142,462,182],dim:[1799,813],index:'bar'},
 {id:'nav-capt-auto',plate:'vhf-nav-capt',kind:'NAV',seat:'CAPT',rect:[214,142,458,182],dim:[1799,813],index:'none',automatic:true},
 {id:'nav-fo-auto',plate:'vhf-nav-fo',kind:'NAV',seat:'FO',rect:[214,142,458,182],dim:[1799,813],index:'none',automatic:true}
];
// The legacy mechanical NAV AUTO readout must not show unsupported dashes on
// initial mount. 110.30 MHz is a training seed until a valid FMC auto-tune
// event provides the actual current AUTO selection for that seat.
const DEFAULT_NAV_AUTO_KHZ=110300;
const live=new Map(),auto=new Map([
 ['CAPT',DEFAULT_NAV_AUTO_KHZ],['FO',DEFAULT_NAV_AUTO_KHZ]
]),autoFromFmc=new Set();
function valid(kind,khz){
 const c=CHANNELS[kind];
 return !!c&&Number.isInteger(khz)&&khz>=c.min&&khz<=c.max&&khz%c.step===0;
}
function exact(khz){return (khz/1000).toFixed(3)}
function display(khz){
 if(khz==null)return '---.--';
 const mhz=Math.floor(khz/1000),fraction=Math.floor(khz%1000/10);
 return String(mhz).padStart(3,'0')+'.'+String(fraction).padStart(2,'0');
}
function node(tag,cls,parent){
 const e=document.createElement(tag);if(cls)e.className=cls;
 if(parent)parent.append(e);return e;
}
function buildWheel(parent){
 const wheel=node('span','pd-freq-wheel',parent);
 wheel.setAttribute('aria-hidden','true');
 return wheel;
}
function setWheel(wheel,next,old,forward){
 wheel.replaceChildren();
 const strip=node('span','pd-freq-strip',wheel);
 if(old!=null&&old!==next&&/\d/.test(old)&&/\d/.test(next)){
  strip.classList.add(forward?'pd-freq-roll-up':'pd-freq-roll-down');
  const shown=forward?[old,next,String((Number(next)+1)%10)]:
   [String((Number(next)+9)%10),next,old];
  for(const glyph of shown)node('span','pd-freq-glyph',strip).textContent=glyph;
 }else{
  const n=/\d/.test(next)?Number(next):null;
  for(const glyph of [n===null?next:String((n+9)%10),next,n===null?next:String((n+1)%10)])
   node('span','pd-freq-glyph',strip).textContent=glyph;
 }
}
function refresh(item,khz,motion){
 if(khz!=null&&!valid(item.spec.kind,khz))return false;
 const shown=display(khz),prior=item.shown;
 if(prior===shown&&item.value===khz)return true;
 // Use the physical rotation direction even at the numeric wrap-around: e.g.
 // 108 <- 117 (left swipe) must roll backward although the total MHz increases.
 const forward=motion?.direction?motion.direction>0:
   (khz!=null&&item.value!=null?khz>item.value:true);
 for(let i=0,j=0;i<shown.length;i++){
  if(i===3)continue;
  if(!prior||shown[i]!==prior[i])setWheel(item.wheels[j],shown[i],prior?prior[i]:null,forward);
  j++;
 }
 item.shown=shown;item.value=khz;
 item.root.dataset.frequencyKhz=khz===null?'':String(khz);
 item.root.dataset.frequencyMhz=khz===null?'':exact(khz);
 item.root.title=khz===null?'Not automatically tuned':'Exact frequency: '+exact(khz)+' MHz';
 item.root.setAttribute('aria-label',item.spec.seat+' '+item.spec.kind+
   (item.spec.automatic?' AUTO':'')+' frequency '+(khz===null?'not available':exact(khz)+' megahertz'));
 return true;
}
function create(spec,frame){
 if(live.has(spec.id)&&live.get(spec.id).root.isConnected)return true;
 const box=node('div','pd-freq-mechanical',frame);
 box.dataset.mechanicalFrequency=spec.id;
 box.dataset.kind=spec.kind;
 box.dataset.index=spec.index;
 box.setAttribute('role','img');
 const [x,y,w,h]=spec.rect,[sw,sh]=spec.dim;
 Object.assign(box.style,{left:100*x/sw+'%',top:100*y/sh+'%',
   width:100*w/sw+'%',height:100*h/sh+'%'});
 const glass=node('span','pd-freq-glass',box);
 const wheels=[];
 for(let i=0;i<5;i++){
  if(i===3)node('span','pd-freq-dot',glass).textContent='.';
  wheels.push(buildWheel(glass));
 }
 node('span','pd-freq-index',box);
 const item={spec,root:box,wheels,shown:null,value:null};
 live.set(spec.id,item);
 const state=root.B737UnifiedVHFDualV1?.getState?.(spec.id);
 const preset=spec.automatic?(auto.get(spec.seat)??DEFAULT_NAV_AUTO_KHZ):
  (state?.frequencyKhz??(spec.kind==='COMM'?118000:110300));
 if(spec.automatic)box.dataset.autoSource=autoFromFmc.has(spec.seat)?'fmc':'training-seed';
 refresh(item,preset);
 return true;
}
function mount(){
 let count=0;
 for(const spec of WINDOWS){
  const frame=document.querySelector('#unified-pedestal-faceplates [data-faceplate="'+spec.plate+'"]');
  if(frame&&create(spec,frame))count++;
 }
 return count===WINDOWS.length;
}
root.addEventListener('b737:unified-vhf-frequency',event=>{
 const d=event.detail||{},item=live.get(d.id);
 if(item&&d.kind===item.spec.kind&&valid(d.kind,d.frequencyKhz))refresh(item,d.frequencyKhz,d);
});
// FMC/avionics can supply NAV AUTO without changing manual tuning.
root.addEventListener('b737:nav-auto-frequency',event=>{
 const d=event.detail||{};
 if(!['CAPT','FO'].includes(d.seat)||!valid('NAV',d.frequencyKhz))return;
 auto.set(d.seat,d.frequencyKhz);
 autoFromFmc.add(d.seat);
 const item=live.get('nav-'+d.seat.toLowerCase()+'-auto');
 if(item){item.root.dataset.autoSource='fmc';refresh(item,d.frequencyKhz);}
});
function start(){
 if(mount())return;
 const watch=new MutationObserver(()=>{if(mount())watch.disconnect()});
 watch.observe(document.body,{childList:true,subtree:true});
}
root.addEventListener('b737:cockpit-mounted',mount);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
root.B737UnifiedMechanicalFrequencyV1=Object.freeze({
 version:VERSION,windows:WINDOWS,channels:CHANNELS,defaultNavAutoKhz:DEFAULT_NAV_AUTO_KHZ,mount,display,valid,
 getState:id=>{const item=live.get(id);return item?{frequencyKhz:item.value,display:item.shown,
  source:item.spec.automatic?(autoFromFmc.has(item.spec.seat)?'fmc':'training-seed'):'manual'}:null;},
 setNavAuto:(seat,khz)=>{
  if(!['CAPT','FO'].includes(seat)||!valid('NAV',khz))return false;
  auto.set(seat,khz);autoFromFmc.add(seat);
  const item=live.get('nav-'+seat.toLowerCase()+'-auto');
  if(item){item.root.dataset.autoSource='fmc';refresh(item,khz);}
  return true;
 }
});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./pedestal-vhf-comm-tfr-v1.js?v=PD-COMM-TFR-0001 */
try{
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./pedestal-vhf-comm-test-v1.js?v=PD-COMM-TEST-0001 */
try{
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./pedestal-vhf-nav-controls-v1.js?v=PD-NAV-CTRL-0002 */
try{
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/flight/classic-low-speed-envelope-v1.js?v=LOW-SPEED-AUTO-SLAT-0002&amp;trainer=TOGA-145-FD-N1-110-125-0001 */
try{
/* B737 Classic low-speed instructor aerodynamics surrogate.
 * FCOM describes autoslats on TE flap 1/2/5 approaching stall and system B/PTU.
 * It does NOT supply a universal stall or shaker IAS: those require
 * aircraft/weight/CG/configuration/AoA-specific performance data.
 * The coefficients below are explicit TRAINING ASSUMPTIONS, NOT AFM/FCOM V-speeds.
 * Never publish these outputs as ADC sensor or certified FCC performance.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicLowSpeedEnvelopeV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_CLASSIC_LOW_SPEED_TRAINER_0001';
 const REF_MASS_KG=54000,AREA_M2=91.04,RHO=1.225,GRAVITY=9.80665;
 const DETENTS=Object.freeze([0,1,2,5,10,15,25,30,40]);
 // Illustrative maximum-lift schedule, NOT type-approved aerodynamic tables.
 const CL=Object.freeze([1.62,1.82,1.91,2.05,2.24,2.42,2.62,2.76,2.88]);
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 function interpolateFlap(flap){
  const n=clamp(flap,0,40);
  for(let i=1;i<DETENTS.length;i++)if(n<=DETENTS[i]){
   const k=(n-DETENTS[i-1])/(DETENTS[i]-DETENTS[i-1]);
   return CL[i-1]+k*(CL[i]-CL[i-1]);
  }
  return CL.at(-1);
 }
 function evaluate(input){
  if(!input||!finite(input.iasKt)||input.iasKt<0||input.iasKt>600||
     !finite(input.flapActual)||input.flapActual<0||input.flapActual>40||
     !DETENTS.includes(input.flapLever)||!finite(input.bankDeg)||Math.abs(input.bankDeg)>90||
     typeof input.airborne!=='boolean')throw Error('INVALID_LOW_SPEED_TRAINING_INPUT');
  const massSource=finite(input.massKg)?'OBSERVED_TRAINING_MASS':'ASSUMED_54000_KG';
  const massKg=massSource==='OBSERVED_TRAINING_MASS'?input.massKg:REF_MASS_KG;
  if(massKg<30000||massKg>75000)throw Error('INVALID_TRAINING_MASS');
  const eligible=input.airborne&&[1,2,5].includes(input.flapLever);
  const observedSlatsFull=input.slatsFull===true&&eligible;
  const computedSlatExtension=finite(input.slatExtension)?
   clamp(input.slatExtension,0,1):0;
  const slatExtension=eligible?
   Math.max(observedSlatsFull?1:0,computedSlatExtension):0;
  const slatsFull=slatExtension>=.999;
  const bank=clamp(input.bankDeg,-65,65);
  const loadFactor=1/Math.cos(bank*Math.PI/180);
  const clMax=interpolateFlap(input.flapActual)*(1+.055*slatExtension);
  const derivedStallKt=Math.sqrt(2*massKg*GRAVITY*loadFactor/(RHO*AREA_M2*clMax))/.514444;
  // User-approved RUNWAY_READY instructor-only speed band. This is NOT
  // the flap/weight-specific AFM stall speed or a real stick-shaker setting.
  const trainingTakeoff=input.takeoffTrainingProfile===true;
  const stallKt=trainingTakeoff?110:derivedStallKt;
  const shakerKt=trainingTakeoff?110:stallKt*1.09;
  const minManeuverKt=trainingTakeoff?125:stallKt*1.30;
  const threshold=input.autoSlatPreviouslyRequested===true?1.20:1.12;
  const autoSlatRequest=eligible&&input.iasKt<=shakerKt*threshold;
  const belowShaker=input.airborne&&input.iasKt<=shakerKt;
  const belowStall=input.airborne&&input.iasKt<stallKt;
  const shortfall=belowStall?clamp((stallKt-input.iasKt)/stallKt,0,.5):0;
  const sinkDemandFpm=shortfall*2300;
  const flapDragKtSec= input.airborne?(0.22*Math.pow(input.flapActual/40,1.1)+
   (.065*slatExtension)):0;
  return {schema:VERSION,source:'INSTRUCTOR_AERO_PROXY_NOT_FCOM_DATA',
   massKg,massSource,flapLever:input.flapLever,flapActual:input.flapActual,
   slatsFull,slatExtension,
   slatEffectSource:observedSlatsFull?'LE_OWNER_FULL_CONFIRMED':
    slatExtension>0?'TRAINING_AUTO_SLAT_DELAY_PROXY':'NOT_EXTENDED',
   clMax,loadFactor,stallKt,stickShakerKt:shakerKt,minimumManeuverKt:minManeuverKt,
   takeoffTrainingProfile:trainingTakeoff,derivedStallKt,
   buffer:{lowerKt:shakerKt,upperKt:minManeuverKt},
   belowShaker,belowStall,sinkDemandFpm,flapDragKtSec,
   autoSlatRequest,autoSlatEligible:eligible,
   autoSlatTrigger:'TRAINING_IAS_LOAD_PROXY_NOT_VALIDATED_AOA',
   calibrated:false};
 }
 return Object.freeze({VERSION,REF_MASS_KG,DETENTS,evaluate,interpolateFlap});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/flight/altitude-capture-training-v1.js?v=ALT-ACQ-RAMP-0001 */
try{
/* Instructor-only altitude acquisition for B737 Classic Unified.
 * Deliberately approximate AFDS: current observed V/S and distance select
 * a constant vertical deceleration profile. NOT a certified FCOM capture law.
 * One profile is consumed by the FCC, flight plant and MCP/FMA.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AltitudeCaptureTrainingV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_ALT_ACQ_TRAINER_0001';
 const MAX_DURATION_SEC=9;
 const MIN_DURATION_SEC=1.2;
 const MIN_TRACKING_VS_FPM=120;
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function opportunity(input){
  const {altitudeFt,targetAltitudeFt,vsFpm}=input||{};
  if(![altitudeFt,targetAltitudeFt,vsFpm].every(finite))
   return {acquire:false,reason:'INVALID_ALTITUDE_OR_VS'};
  const gapFt=targetAltitudeFt-altitudeFt;
  const toward=gapFt*vsFpm>0,absVs=Math.abs(vsFpm);
  const timeToAltitudeSec=absVs>0?60*Math.abs(gapFt)/absVs:null;
  const inhibit=finite(input?.inhibitUntilSec)&&finite(input?.elapsedSec)&&
   input.elapsedSec<input.inhibitUntilSec;
  const arrivalTimeSec=MAX_DURATION_SEC/2;
  const lowRateHold=Math.abs(gapFt)<=6&&absVs<=MIN_TRACKING_VS_FPM;
  const acquire=!inhibit&&(lowRateHold||
   toward&&absVs>=MIN_TRACKING_VS_FPM&&
   timeToAltitudeSec<=arrivalTimeSec);
  return {acquire,reason:inhibit?'MCP_ALTITUDE_CHANGE_LOCKOUT':
   lowRateHold?'NEAR_LEVEL_LOW_RATE':!toward?'MOVING_AWAY':
   absVs<MIN_TRACKING_VS_FPM?'RATE_TOO_LOW':
   acquire?'TIME_TO_ALTITUDE_CAPTURE':'OUTSIDE_ACQUISITION_WINDOW',
   gapFt,vsFpm,timeToAltitudeSec,arrivalTimeSec,
   distanceNeededFt:absVs*MAX_DURATION_SEC/120};
 }
 function begin(input){
  const {altitudeFt,targetAltitudeFt,vsFpm}=input||{};
  if(![altitudeFt,targetAltitudeFt,vsFpm].every(finite))
   throw TypeError('INVALID_ALT_ACQ_START');
  const gap=targetAltitudeFt-altitudeFt,absVs=Math.abs(vsFpm);
  if(gap*vsFpm<0&&Math.abs(gap)>6)throw RangeError('ALT_ACQ_WRONG_DIRECTION');
  const exact=absVs>=1?120*Math.abs(gap)/absVs:MIN_DURATION_SEC;
  const durationSec=clamp(exact,MIN_DURATION_SEC,MAX_DURATION_SEC);
  return {schema:VERSION,phase:'ACQUIRE',
   entryAltitudeFt:altitudeFt,targetAltitudeFt,entryVsFpm:vsFpm,
   durationSec,elapsedSec:0,altitudeFt,vsFpm,
   decelerationFpmPerSec:durationSec>0?
    Math.abs(120*gap/(durationSec*durationSec)):0,
   source:'INSTRUCTOR_CONSTANT_DECELERATION_PROFILE'};
 }
 function advance(plan,dt){
  if(plan?.schema!==VERSION||!finite(dt)||dt<0||dt>2)
   throw TypeError('INVALID_ALT_ACQ_STEP');
  if(plan.phase==='HELD')return {...plan,altitudeFt:plan.targetAltitudeFt,vsFpm:0};
  // Floating-point 0.1s slices may total 7.999999999 instead of 8.0;
  // settle at the exact deadline rather than delaying ALT HOLD one frame.
  const stepped=plan.elapsedSec+dt;
  const elapsedSec=stepped>=plan.durationSec-1e-8?
   plan.durationSec:clamp(stepped,0,plan.durationSec);
  const fraction=elapsedSec/plan.durationSec;
  const gap=plan.targetAltitudeFt-plan.entryAltitudeFt;
  const altitudeFt=plan.entryAltitudeFt+gap*(2*fraction-fraction*fraction);
  // Derivative of altitude curve: starts at observed V/S when the capture
  // window is entered on time and decreases by a constant fpm per second.
  const vsFpm=120*gap/plan.durationSec*(1-fraction);
  return {...plan,phase:fraction>=1?'HELD':'ACQUIRE',
   elapsedSec,altitudeFt,vsFpm:fraction>=1?0:vsFpm};
 }
 return Object.freeze({VERSION,MAX_DURATION_SEC,MIN_DURATION_SEC,
  MIN_TRACKING_VS_FPM,opportunity,begin,advance});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/flight/flight-control-laws-v1.js?v=TOGA-PITCH-FOLLOW-0001 */
try{
/* Unified B737 Classic instructor-only coupled AFDS/flight-plant control laws.
 * Same bank/pitch targets are used by the FCC command bars AND aircraft plant.
 * Illustrative training dynamics, not measured B737 autopilot actuator rates.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FlightControlLawsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_FLIGHT_CONTROL_LAWS_0001';
 const RAD=Math.PI/180,KT_TO_MPS=.514444,FTPM_TO_MPS=.3048/60;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const wrap=x=>((x%360)+360)%360;
 const difference=(from,to)=>((to-from+540)%360)-180;
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 // Instructor-only slew/lag settings, not validated B737 actuator limits.
 // A V/S mode change commands a gradual pitch change then a delayed V/S response.
 const RATES=Object.freeze({rollDegSec:2.3,pitchDegSec:0.65,vsFpmSec:230,
  pitchCommandTauSec:2.6,rollCommandTauSec:1.5});
 const TRIM_PITCH_DEG=2;
 function bankForHeading(headingTrue,targetTrue,limitDeg=25){
  if(!finite(headingTrue)||!finite(targetTrue))return null;
  const err=difference(headingTrue,targetTrue);
  const bankLimit=clamp(finite(limitDeg)?limitDeg:25,10,30);
  return Math.abs(err)<.4?0:clamp(err*.65,-bankLimit,bankLimit);
 }
 function pitchForVs(vsFpm,tasKt){
  if(!finite(vsFpm)||!finite(tasKt))return null;
  const velocity=Math.max(60,tasKt)*KT_TO_MPS;
  return clamp(TRIM_PITCH_DEG+Math.atan(vsFpm*FTPM_TO_MPS/velocity)/RAD,-10,15);
 }
 function vsForPitch(pitchDeg,tasKt){
  if(!finite(pitchDeg)||!finite(tasKt))return null;
  const velocity=Math.max(60,tasKt)*KT_TO_MPS;
  return clamp(Math.tan(clamp(pitchDeg-TRIM_PITCH_DEG,-12,13)*RAD)*velocity/FTPM_TO_MPS,-5000,5000);
 }
 function altitudeVs(altitude,targetAlt,rate=2){
  if(!finite(altitude)||!finite(targetAlt))return null;
  const gap=targetAlt-altitude;
  return Math.abs(gap)<2?0:clamp(gap*rate,-2500,2500);
 }
 function guidance(frame,target){
  if(!frame||!target)return null;
  const tas=finite(frame.tasKt)?frame.tasKt:frame.iasKt;
  const bank=target.lateralMode==='BANK'?
   clamp(target.bankCommandDeg??0,-30,30):
   bankForHeading(frame.trueHeadingDeg,target.headingDeg,target.bankLimitDeg);
  let vs=target.vsFpm??0;
  if(target.verticalMode==='ALTITUDE')
   vs=altitudeVs(frame.altitudeFt,target.altitudeFt);
  else if(target.verticalMode==='GLIDEPATH'&&finite(target.glideVsFpm))
   vs=target.glideVsFpm;
  vs=clamp(vs,-5000,5000);
  const pitchHold=target.verticalMode==='PITCH'&&finite(target.pitchDeg);
  const desiredPitchDeg=pitchHold?clamp(target.pitchDeg,-10,15):pitchForVs(vs,tas);
  return {desiredBankDeg:bank,
   desiredVsFpm:pitchHold?vsForPitch(desiredPitchDeg,tas):vs,
   desiredPitchDeg,rates:RATES};
 }
 function move(current,target,maxRate,dt){
  if(!finite(current)||!finite(target)||!finite(maxRate)||!finite(dt)||dt<0)throw TypeError('CONTROL_SLEW');
  return current+clamp(target-current,-maxRate*dt,maxRate*dt);
 }
 function stepAttitude(frame,target,dt){
  const desired=guidance(frame,target);
  if(!desired)throw TypeError('INVALID_FLIGHT_CONTROL_TARGET');
  const previousPitch=finite(frame.flightControl?.commandedPitchDeg)?
   frame.flightControl.commandedPitchDeg:frame.pitchDeg;
  const previousBank=finite(frame.flightControl?.commandedBankDeg)?
   frame.flightControl.commandedBankDeg:frame.bankDeg;
  const directPitch=target.verticalMode==='PITCH';
  const pitchTau=directPitch?1:RATES.pitchCommandTauSec;
  const pitchDemand=previousPitch+(desired.desiredPitchDeg-previousPitch)*
   (1-Math.exp(-dt/pitchTau));
  const bankDemand=previousBank+(desired.desiredBankDeg-previousBank)*
   (1-Math.exp(-dt/RATES.rollCommandTauSec));
  const bankDeg=move(frame.bankDeg,bankDemand,RATES.rollDegSec,dt);
  const pitchDeg=move(frame.pitchDeg,pitchDemand,directPitch?2.2:RATES.pitchDegSec,dt);
  // Loss of lift below the instructor-estimated stall envelope adds sink.
  // This is NOT a certified stall/alpha protection law.
  const sinkDemand=finite(frame.aeroEnvelope?.sinkDemandFpm)?
   clamp(frame.aeroEnvelope.sinkDemandFpm,0,1200):0;
  const commandedPhysicalVs=vsForPitch(pitchDeg,frame.tasKt)-sinkDemand;
  const vsFpm=move(frame.vsFpm,commandedPhysicalVs,RATES.vsFpmSec,dt);
  return {...desired,bankDeg,pitchDeg,vsFpm,
   commandedPitchDeg:pitchDemand,commandedBankDeg:bankDemand,
   actualVsFromPitchFpm:commandedPhysicalVs};
 }
 return Object.freeze({VERSION,RATES,TRIM_PITCH_DEG,bankForHeading,pitchForVs,
  vsForPitch,altitudeVs,guidance,stepAttitude,move,difference,wrap});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/flight/flight-scenario-core-v1.js?v=CD-GENERAL-TEST-0001&amp;aero=LOW-SPEED-0002&amp;alt=ACQ-0001&amp;ils=SHI-CH4-0004&amp;trainer=TOGA-145-FD-N1-110-125-0001 */
try{
/* Unified Flight Scenario Core v1 — deterministic, offline training model.
 * NOT FCOM performance, not a certified aerodynamic model or navigation source.
 * Runway reference points are explicitly ARP-DERIVED PROVISIONAL until official
 * runway THR coordinates are imported. All bearings are TRUE, altitude MSL.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FlightScenarioCoreV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const RAD=Math.PI/180, EARTH_NM=3440.065, KT_TO_MPS=.514444, FT_PER_NM=6076.1155;
 const Laws=(typeof globalThis==='object'?globalThis.B737FlightControlLawsV1:null)||
  (typeof module==='object'&&typeof require==='function'?
   require('./flight-control-laws-v1.js'):null);
 const Envelope=(typeof globalThis==='object'?globalThis.B737ClassicLowSpeedEnvelopeV1:null)||
  (typeof module==='object'&&typeof require==='function'?
   require('./classic-low-speed-envelope-v1.js'):null);
 const AltCapture=(typeof globalThis==='object'?globalThis.B737AltitudeCaptureTrainingV1:null)||
  (typeof module==='object'&&typeof require==='function'?
   require('./altitude-capture-training-v1.js'):null);
 const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
 const wrap=h=>(h%360+360)%360;
 const angle=(a,b)=>((wrap(b)-wrap(a)+540)%360)-180;
 const finite=(v,lo,hi,name)=>{const n=Number(v);if(!Number.isFinite(n)||n<lo||n>hi)throw RangeError(name);return n;};
 const AIRPORTS=Object.freeze({
  OIMM:Object.freeze({icao:'OIMM',name:'Mashhad / Shahid Hashemi Nejad',lat:36.2348333,lon:59.643,elevationFt:3263,defaultRunway:'31R',
   runways:Object.freeze({ '13L':134,'13R':134,'31L':314,'31R':314 })}),
  OIII:Object.freeze({icao:'OIII',name:'Tehran / Mehrabad',lat:35.6891667,lon:51.3143333,elevationFt:3962,defaultRunway:'29L',
   runways:Object.freeze({ '11L':109,'11R':109,'29L':289,'29R':289 })}),
  OISS:Object.freeze({icao:'OISS',name:'Shiraz / Shahid Dastghaib',lat:29.5391667,lon:52.5898333,elevationFt:4927,defaultRunway:'29L',
   runways:Object.freeze({ '11L':114,'11R':114,'29L':294,'29R':294 })}),
  OIFM:Object.freeze({icao:'OIFM',name:'Esfahan / Shahid Beheshti International',lat:32.75083333,lon:51.86277778,elevationFt:5058,defaultRunway:'25R',
   runways:Object.freeze({ '07L':77.93,'25R':257.96,'07R':77.93,'25L':257.96 })})
 });
 const PRESETS=Object.freeze(['RUNWAY_READY','COLD_DARK','FINAL_5','FINAL_10','MANUAL']);
 function move(lat,lon,heading,distNm){
  const d=distNm/EARTH_NM,br=heading*RAD,la=lat*RAD,lo=lon*RAD;
  const lat2=Math.asin(Math.sin(la)*Math.cos(d)+Math.cos(la)*Math.sin(d)*Math.cos(br));
  const lon2=lo+Math.atan2(Math.sin(br)*Math.sin(d)*Math.cos(la),Math.cos(d)-Math.sin(la)*Math.sin(lat2));
  return {lat:lat2/RAD,lon:((lon2/RAD+540)%360)-180};
 }
 function distanceNm(a,b){
  const dLat=(b.lat-a.lat)*RAD,dLon=(b.lon-a.lon)*RAD,la=a.lat*RAD,lb=b.lat*RAD;
  const h=Math.sin(dLat/2)**2+Math.cos(la)*Math.cos(lb)*Math.sin(dLon/2)**2;
  return 2*EARTH_NM*Math.asin(Math.min(1,Math.sqrt(h)));
 }
 function bearing(a,b){
  const la=a.lat*RAD,lb=b.lat*RAD,dl=(b.lon-a.lon)*RAD;
  return wrap(Math.atan2(Math.sin(dl)*Math.cos(lb),Math.cos(la)*Math.sin(lb)-Math.sin(la)*Math.cos(lb)*Math.cos(dl))/RAD);
 }
 function runwayAnchor(icao,runway,thresholds){
  const airport=AIRPORTS[icao];if(!airport||!Object.hasOwn(airport.runways,runway))throw RangeError('UNKNOWN_RUNWAY');
  const verified=thresholds?.[icao]?.[runway];
  if(verified&&Number.isFinite(verified.lat)&&Number.isFinite(verified.lon)&&
      distanceNm(airport,verified)<8)
   return {lat:verified.lat,lon:verified.lon,
    quality:verified.quality==='TRAINING_ILS_PROXY'?'TRAINING_ILS_PROXY':'VERIFIED_INPUT',
    source:verified.source||'TRAINER_IMPORTED_THR',
    elevationFt:Number.isFinite(verified.elevationFt)?verified.elevationFt:airport.elevationFt,
    glideDeg:Number.isFinite(verified.glideDeg)?verified.glideDeg:3,
    tchFt:Number.isFinite(verified.tchFt)?verified.tchFt:50,
    courseTrueDeg:Number.isFinite(verified.courseTrueDeg)?verified.courseTrueDeg:airport.runways[runway]};
  // ARP approximate. NOT a surveyed runway threshold: deliberately flagged.
  return {lat:airport.lat,lon:airport.lon,quality:'PROVISIONAL_ARP',source:'AIRPORT_REFERENCE_POINT_NOT_THR'};
 }
 function newScenario(config={},thresholds={}){
  const icao=String(config.airport||'OIMM').toUpperCase();
  const airport=AIRPORTS[icao];if(!airport)throw RangeError('UNKNOWN_AIRPORT');
  const runway=String(config.runway||airport.defaultRunway).toUpperCase();
  if(!Object.hasOwn(airport.runways,runway))throw RangeError('UNKNOWN_RUNWAY');
  const kind=String(config.preset||'RUNWAY_READY').toUpperCase();
  if(!PRESETS.includes(kind))throw RangeError('UNKNOWN_PRESET');
  const anchor=runwayAnchor(icao,runway,thresholds),
   hdg=Number.isFinite(anchor.courseTrueDeg)?anchor.courseTrueDeg:airport.runways[runway],
   runwayElevationFt=Number.isFinite(anchor.elevationFt)?anchor.elevationFt:airport.elevationFt,
   glideDeg=Number.isFinite(anchor.glideDeg)?anchor.glideDeg:3,
   tchFt=Number.isFinite(anchor.tchFt)?anchor.tchFt:50;
  const finalNm=kind==='FINAL_5'?5:kind==='FINAL_10'?10:0;
  const isFinal=finalNm>0, manual=kind==='MANUAL';
  const ground=kind==='COLD_DARK'||kind==='RUNWAY_READY'||(manual&&config.airborne===false);
  const latitude=manual&&config.lat!==undefined?finite(config.lat,-90,90,'LAT'):isFinal?move(anchor.lat,anchor.lon,wrap(hdg+180),finalNm).lat:anchor.lat;
  const longitude=manual&&config.lon!==undefined?finite(config.lon,-180,180,'LON'):isFinal?move(anchor.lat,anchor.lon,wrap(hdg+180),finalNm).lon:anchor.lon;
  // FINAL_10 training starts one GS dot BELOW the received ILS beam.
   // 0.35deg per dot is the existing geometry training receiver convention;
   // not a certified angular or flight control calibration.
   const gsBelowDots=isFinal?(config.glideslopeBelowDots===undefined?
    kind==='FINAL_10'?1:0:finite(config.glideslopeBelowDots,0,2.5,'GS_BELOW_DOTS')):0;
   const initialGsDeg=glideDeg-gsBelowDots*.35;
   const defaultAlt=runwayElevationFt+(isFinal?
    Math.tan(initialGsDeg*RAD)*finalNm*FT_PER_NM+tchFt:ground?0:3000);
  const altitudeInput=manual&&config.altitudeFt!==undefined?finite(config.altitudeFt,-1000,65000,'ALTITUDE_FT'):defaultAlt;
  const alt=ground?runwayElevationFt:altitudeInput;
  if(alt<runwayElevationFt-.01)throw RangeError('ALTITUDE_BELOW_AIRPORT_SURFACE');
  const speedInput=config.speedKt!==undefined?finite(config.speedKt,0,450,'IAS_KT'):isFinal?(finalNm===5?155:142):ground?0:220;
  const speed=ground?0:speedInput;
  if(!ground&&speed<80)throw RangeError('AIRBORNE_IAS_BELOW_TRAINING_MINIMUM');
  const heading=manual&&config.headingDeg!==undefined?wrap(finite(config.headingDeg,0,360,'HEADING_DEG')):hdg;
  const bank=manual&&config.bankDeg!==undefined?finite(config.bankDeg,-30,30,'BANK_DEG'):0;
  const vsInput=config.vsFpm!==undefined?finite(config.vsFpm,-5000,5000,'VS_FPM'):kind==='FINAL_10'?0:isFinal?-speed*FT_PER_NM/60*Math.tan(glideDeg*RAD):0;
  const vs=ground?0:vsInput;
  const guidance={lateralMode:manual&&bank!==0?'BANK':'HEADING',verticalMode:kind==='FINAL_10'?'ALTITUDE':isFinal?'GLIDEPATH':'VS',
   headingDeg:heading,bankCommandDeg:bank,bankLimitDeg:25,altitudeFt:ground?runwayElevationFt+3000:alt,
   vsFpm:ground?1500:vs,speedKt:ground?150:speed};
  return {schema:'B737_FLIGHT_SCENARIO_STATE_V1',revision:1,
   icao,airportName:airport.name,runway,runwayHeadingTrueDeg:hdg,threshold:anchor,
   preset:kind,phase:ground?'GROUND_READY':isFinal?'FINAL_APPROACH':'AIRBORNE',
   airborne:!ground,groundRoll:false,lat:latitude,lon:longitude,
   altitudeFt:alt,radioAltitudeFt:Math.max(0,alt-runwayElevationFt),
   elevationFt:runwayElevationFt,iasKt:speed,tasKt:speed,
   gsKt:speed,trueHeadingDeg:heading,trueTrackDeg:heading,
   bankDeg:bank,pitchDeg:ground?0:vs>100?3:vs< -100?-2:2,vsFpm:ground?0:vs,
   glideslopeBelowDots:gsBelowDots,flapLever:0,flapActual:0,slatsFull:false,autoSlatTrainingFraction:0,
   massKg:config.massKg===undefined?null:finite(config.massKg,30000,75000,'MASS_KG'),
   // Instructor automation is independent of the aircraft's physical A/P.
   takeoffAutoMode:kind==='RUNWAY_READY',
   rotationSpeedKt:145,rotationRateDegSec:2.5,rotationTargetDeg:10,
   rotationStarted:false,
   autoSlatRequest:false,aeroEnvelope:null,altitudeCapture:null,
   target:guidance,windFromDeg:0,windKt:0,elapsedSec:0,georefQuality:anchor.quality,
   notices:['TRAINING_SURROGATE','NO_FCOM_PERFORMANCE_CLAIM',anchor.source]};
 }
 function command(state,action){
  if(!state||state.schema!=='B737_FLIGHT_SCENARIO_STATE_V1')throw TypeError('STATE');
  if(!action||typeof action!=='object')throw TypeError('ACTION');
  const next={...state,target:{...state.target},revision:state.revision+1};
  switch(action.type){
   case 'HEADING':next.target.headingDeg=wrap(finite(action.value,0,360,'HEADING'));next.target.lateralMode='HEADING';break;
   case 'BANK':next.target.bankCommandDeg=finite(action.value,-30,30,'BANK');next.target.lateralMode='BANK';break;
   case 'BANK_LIMIT':next.target.bankLimitDeg=finite(action.value,10,30,'BANK_LIMIT');break;
   case 'ALT_ACQ':{
    const selected=finite(action.value,0,65000,'ALT_ACQ_ALTITUDE');
    if(!AltCapture)throw Error('ALT_ACQ_TRAINING_ENGINE_MISSING');
    if(next.altitudeCapture?.phase!=='ACQUIRE'||
       next.altitudeCapture.targetAltitudeFt!==selected)
     next.altitudeCapture=AltCapture.begin({altitudeFt:state.altitudeFt,
      targetAltitudeFt:selected,vsFpm:state.vsFpm});
    next.target.altitudeFt=selected;next.target.verticalMode='ALT_ACQ';
    break;
   }
   case 'ALTITUDE':
    next.target.altitudeFt=finite(action.value,0,65000,'ALTITUDE');
    next.target.verticalMode='ALTITUDE';
    if(next.altitudeCapture?.phase!=='HELD'||
       next.altitudeCapture.targetAltitudeFt!==next.target.altitudeFt)
     next.altitudeCapture=null;
    break;
   case 'PITCH':
    next.target.pitchDeg=finite(action.value,-10,15,'PITCH');
    next.target.verticalMode='PITCH';next.altitudeCapture=null;
    if(action.source!=='TRAINER_AUTO_TO'&&action.source!=='FCC_CMD')
     next.takeoffAutoMode=false;
    break;
   case 'VS':
    next.target.vsFpm=finite(action.value,-5000,5000,'VS');
    next.target.verticalMode='VS';next.altitudeCapture=null;
    break;
   case 'SPEED':next.target.speedKt=finite(action.value,0,450,'SPEED');break;
   case 'AERO_CONFIG':
    if(!Envelope?.DETENTS?.includes(action.flapLever)||
      typeof action.slatsFull!=='boolean')throw RangeError('AERO_CONFIG_INPUT');
    next.flapLever=action.flapLever;
    next.flapActual=finite(action.flapActual,0,40,'ACTUAL_TE_FLAP');
    next.slatsFull=action.slatsFull;
    if(action.massKg!==undefined)
     next.massKg=action.massKg===null?null:finite(action.massKg,30000,75000,'MASS_KG');
    // Refresh the actual-flap instructor low-speed envelope immediately,
    // including a paused 10 NM FINAL preset. Never infer TE travel from
    // flap lever selection or overwrite certified ADC/FCC speed limits.
    next.aeroEnvelope=Envelope.evaluate({
     iasKt:next.iasKt,massKg:next.massKg,
     flapLever:next.flapLever,flapActual:next.flapActual,
     slatsFull:next.slatsFull,
     slatExtension:next.autoSlatTrainingFraction,
     bankDeg:next.bankDeg,airborne:next.airborne,
     autoSlatPreviouslyRequested:state.autoSlatRequest,
     takeoffTrainingProfile:next.preset==='RUNWAY_READY'
    });
    break;
   case 'MANUAL_HOLD':
    // Autopilot disconnect: preserve last observed bank and vertical motion.
    // Do not let obsolete HDG SEL / ALT targets keep steering the aircraft.
    next.target.lateralMode='BANK';
    next.target.bankCommandDeg=next.bankDeg;
    next.target.verticalMode='VS';
    next.target.vsFpm=next.vsFpm;
    next.altitudeCapture=null;
    next.target.flightControlOwner='MANUAL_TRIM_NO_AP';
    next.takeoffAutoMode=false;
    break;
   case 'WIND':next.windFromDeg=wrap(finite(action.direction,0,360,'WIND_DIR'));next.windKt=finite(action.speed,0,150,'WIND_KT');break;
   case 'TAKEOFF_ROLL':
    if(state.phase!=='GROUND_READY')throw Error('NOT_GROUND_READY');
    next.phase='TAKEOFF_ROLL';next.groundRoll=true;break;
   case 'STOP':
    if(state.airborne)throw Error('CANNOT_STOP_AIRBORNE');
    next.phase='GROUND_READY';next.groundRoll=false;next.iasKt=0;next.gsKt=0;next.vsFpm=0;break;
   case 'PAUSE':next.paused=!!action.value;break;
   default:throw RangeError('UNKNOWN_ACTION');
  }
  return next;
 }
 function step(state,dtSeconds,propulsion=null){
  const dt=finite(dtSeconds,0,2,'DT_SECONDS');
  if(state.paused||dt===0)return state;
  const s={...state,target:{...state.target},revision:state.revision+1,elapsedSec:state.elapsedSec+dt};
  const target=s.target;
  const assessAero=()=>Envelope?.evaluate({iasKt:s.iasKt,
   massKg:s.massKg,flapLever:s.flapLever,flapActual:s.flapActual,
   slatsFull:s.slatsFull,slatExtension:s.autoSlatTrainingFraction,
   bankDeg:s.bankDeg,airborne:s.airborne,
   autoSlatPreviouslyRequested:state.autoSlatRequest,
   takeoffTrainingProfile:s.preset==='RUNWAY_READY'})??null;
  if(s.phase==='GROUND_READY'){
   s.altitudeCapture=null;
   s.airborne=false;s.iasKt=0;s.tasKt=0;s.gsKt=0;s.vsFpm=0;s.pitchDeg=0;s.bankDeg=0;
   s.autoSlatTrainingFraction=0;
   s.aeroEnvelope=assessAero();s.autoSlatRequest=false;
   s.radioAltitudeFt=Math.max(0,s.altitudeFt-s.elevationFt);return s;
  }
  const groundRoll=s.phase==='TAKEOFF_ROLL',landingRoll=s.phase==='LANDING_ROLL';
  const commandedSpeed=landingRoll?0:groundRoll?165:target.speedKt;
  const rate=groundRoll?2.4:landingRoll?1.8:s.iasKt<commandedSpeed?1.2:1;
  // Shared ISN-18 ECU N1 is the sole observed propulsion input. Do not
  // synthesize takeoff acceleration from the TO/GA label or a speed target.
  // The following coefficients are TRAINING approximations, not AFM data.
  const observed=propulsion?.valid===true&&Array.isArray(propulsion.engines)&&
   propulsion.engines.length===2&&propulsion.engines.every(e=>
    typeof e?.running==='boolean'&&Number.isFinite(e.n1Percent)&&
    e.n1Percent>=0&&e.n1Percent<=120);
  if(groundRoll&&observed){
   // At idle N1 there is no takeoff acceleration. Real observed engine
   // spool drives a bounded training surrogate with rolling/drag losses.
   const normalizedThrust=propulsion.engines.reduce((sum,e)=>
    sum+(e.running?Math.pow(clamp((e.n1Percent-22)/78,0,1),1.25):0),0)/2;
   const resistanceKtSec=.12+.000025*s.iasKt*s.iasKt;
   const accelerationKtSec=4.1*normalizedThrust-resistanceKtSec;
   s.iasKt=clamp(s.iasKt+accelerationKtSec*dt,0,450);
   s.propulsion={source:'ISN18_OBSERVED_N1_GROUND_TRAINING_PLANT',
    normalizedThrust,resistanceKtSec,accelerationKtSec};
  }else if(groundRoll){
   // An absent/invalid ECU observation cannot authorize synthetic thrust.
   const accelerationKtSec=-(.12+.000025*s.iasKt*s.iasKt);
   s.iasKt=Math.max(0,s.iasKt+accelerationKtSec*dt);
   s.propulsion={source:'NO_ENGINE_OBSERVATION_NO_SYNTHETIC_THRUST',
    accelerationKtSec};
  }else if(observed&&s.airborne&&!landingRoll){
   const n1Equivalent=32+propulsion.engines.reduce((sum,e)=>
    sum+(e.running?clamp(e.n1Percent-32,0,65):0),0)/2;
   const requiredN1=clamp(42+.105*s.iasKt+.0002*s.iasKt*s.iasKt+
    3*s.vsFpm/1000,32,92);
   const accelerationKtSec=clamp((n1Equivalent-requiredN1)*.065,-2,1.8);
   s.iasKt=clamp(s.iasKt+accelerationKtSec*dt,0,450);
   s.propulsion={source:'ISN18_OBSERVED_N1_TRAINING_PLANT',
    n1Equivalent,requiredN1,accelerationKtSec};
  }else{
   s.iasKt=Math.max(0,s.iasKt+clamp(commandedSpeed-s.iasKt,-rate*dt,rate*dt));
   s.propulsion={source:'KINEMATIC_TRAINING_FALLBACK'};
  }
  // Trainer aerodynamic drag responds to actual TE flap travel, not just lever
  // selection. This is NOT a calibrated performance/engine model.
  const preliminary=assessAero();
  if(preliminary&&s.airborne){
   const drag=preliminary.flapDragKtSec*Math.pow(s.iasKt/180,2)*dt;
   s.iasKt=Math.max(0,s.iasKt-drag);
   if(s.propulsion)s.propulsion.flapDragKtSec=preliminary.flapDragKtSec;
  }
  // Simplified TAS=IAS approximation; density/weight/thrust modeling is deferred.
  s.tasKt=s.iasKt;
  // One instructor-only Auto Slat response: request from the SAME
  // weight/flap/bank/shaker envelope, then rate-limit lift credit so neither
  // the IAS tape nor the airplane physics teleports when the request trips.
  // The frozen owner LE device remains authoritative for cockpit lamps.
  const envelopeDemand=assessAero();
  const requested=envelopeDemand?.autoSlatRequest===true&&s.airborne;
  const actualFull=s.slatsFull===true&&envelopeDemand?.autoSlatEligible===true;
  const nextSlatTarget=actualFull||requested?1:0;
  const slatSeconds=nextSlatTarget>state.autoSlatTrainingFraction?4:6;
  const previousFraction=Number.isFinite(state.autoSlatTrainingFraction)?
   state.autoSlatTrainingFraction:0;
  s.autoSlatTrainingFraction=clamp(previousFraction+
   clamp(nextSlatTarget-previousFraction,-dt/slatSeconds,dt/slatSeconds),0,1);
  if(actualFull)s.autoSlatTrainingFraction=1;
  s.aeroEnvelope=assessAero();
  s.autoSlatRequest=requested;
  if(groundRoll){
   // VR=145 kt in this classroom scenario. No pre-rotation at 128 kt.
   // Liftoff is conditional on actual pitch, NOT merely IAS >= VR.
   if(s.takeoffAutoMode===true&&s.iasKt>=s.rotationSpeedKt){
    s.rotationStarted=true;
    s.pitchDeg=clamp(state.pitchDeg+s.rotationRateDegSec*dt,0,s.rotationTargetDeg);
    s.flightControl={source:'TRAINER_AUTO_ROTATION_NOT_AP',
     desiredPitchDeg:s.rotationTargetDeg,commandedPitchDeg:s.pitchDeg};
   }else if(s.takeoffAutoMode===true)s.pitchDeg=0;
   else if(target.verticalMode==='PITCH'){
    // Manual pilot/controller input can independently follow F/D. It is
    // never auto-applied by merely making F/D command bars visible.
    s.pitchDeg=clamp(state.pitchDeg+
     clamp(target.pitchDeg-state.pitchDeg,-2.5*dt,2.5*dt),-10,15);
    s.flightControl={source:'MANUAL_PILOT_PITCH_INPUT',
     desiredPitchDeg:target.pitchDeg,commandedPitchDeg:s.pitchDeg};
   }
   if(s.iasKt>=s.rotationSpeedKt&&s.pitchDeg>=8){
    s.airborne=true;s.groundRoll=false;s.phase='INITIAL_CLIMB';
    if(s.takeoffAutoMode===true){s.target.verticalMode='PITCH';s.target.pitchDeg=15;}
    s.target.vsFpm=1500;
   }
  }
  if(!s.airborne){
   s.bankDeg=0;s.vsFpm=0;s.altitudeFt=s.elevationFt;s.radioAltitudeFt=0;
  }else{
   const captureStep=target.verticalMode==='ALT_ACQ'&&
    s.altitudeCapture?.phase==='ACQUIRE'?
    AltCapture?.advance(s.altitudeCapture,dt):null;
   if(captureStep)s.altitudeCapture=captureStep;
   let wantVS=captureStep?captureStep.vsFpm:target.vsFpm;
   if(target.verticalMode==='ALTITUDE'){
    const diff=target.altitudeFt-s.altitudeFt;
    wantVS=Math.abs(diff)<30?0:clamp(diff*2,-2500,2500);
   }else if(target.verticalMode==='GLIDEPATH'){
    const distance=distanceNm(s,s.threshold);
    const height=s.elevationFt+50+Math.tan(3*RAD)*distance*FT_PER_NM;
    wantVS=clamp(-Math.max(0,s.gsKt)*5.307+
     clamp((height-s.altitudeFt)*.8,-900,900),-2200,600);
   }
   const commanded={...target,verticalMode:target.verticalMode==='PITCH'?'PITCH':'VS',vsFpm:wantVS};
   const control=Laws?.stepAttitude(s,commanded,dt);
   if(control){
    // Pitch, vertical response, and bank are one physical control chain.
    // Same pitch/bank targets are used by FCC flight-director bars.
    s.bankDeg=control.bankDeg;s.pitchDeg=control.pitchDeg;
    s.vsFpm=control.vsFpm;
    s.flightControl={source:'FCC_SHARED_TRAINING_CONTROL_LAWS',
     desiredBankDeg:control.desiredBankDeg,
     desiredPitchDeg:control.desiredPitchDeg,
     commandedBankDeg:control.commandedBankDeg,
     commandedPitchDeg:control.commandedPitchDeg,
     desiredVsFpm:control.desiredVsFpm};
   }else{
    // Fallback for isolated fixture environments without the new module.
    const limit=Number.isFinite(target.bankLimitDeg)?target.bankLimitDeg:25;
    const error=angle(s.trueHeadingDeg,target.headingDeg);
    const bank=target.lateralMode==='BANK'?target.bankCommandDeg:clamp(error*.65,-limit,limit);
    s.bankDeg+=clamp(bank-s.bankDeg,-3.2*dt,3.2*dt);
    const desiredPitch=target.verticalMode==='PITCH'?clamp(target.pitchDeg,-10,15):
     clamp(2+Math.atan2(wantVS/60*.3048,Math.max(s.tasKt*KT_TO_MPS,35))/RAD,-10,15);
    s.pitchDeg+=clamp(desiredPitch-s.pitchDeg,-1.15*dt,1.15*dt);
    const actualVs=clamp(Math.tan((s.pitchDeg-2)*RAD)*Math.max(s.tasKt*KT_TO_MPS,35)*60/.3048,-5000,5000);
    s.vsFpm+=clamp(actualVs-s.vsFpm,-420*dt,420*dt);
   }
   if(captureStep){
    // One capture profile owns ACTUAL vertical motion and the FCC director
    // uses its very same V/S. Roll still follows the ordinary AFDS controller.
    // Constant vertical deceleration is deliberate trainer behavior.
    const pitchDemand=Laws?.pitchForVs?.(captureStep.vsFpm,s.tasKt);
    if(Number.isFinite(pitchDemand))
     s.pitchDeg=clamp(state.pitchDeg+
      clamp(pitchDemand-state.pitchDeg,-1.6*dt,1.6*dt),-10,15);
    s.vsFpm=captureStep.vsFpm;
    s.flightControl={...(s.flightControl||{}),
     source:'ALT_ACQ_SHARED_TRAINING_PROFILE',
     commandedPitchDeg:Number.isFinite(pitchDemand)?pitchDemand:s.pitchDeg,
     desiredVsFpm:captureStep.vsFpm};
   }
   // Bounded training disturbance. Positive bank is toward the heavier right wing.
   // The shared controller continues to apply its corrective bank command.
   const imbalance=propulsion?.fuelImbalanceKg;
   if(Number.isFinite(imbalance)){
    const rollBiasDegSec=clamp(imbalance/453*.12,-1.2,1.2);
    s.bankDeg=clamp(s.bankDeg+rollBiasDegSec*dt,-45,45);
    s.fuelBalance={imbalanceKg:imbalance,rollBiasDegSec,source:'TRAINING_LATERAL_FUEL_MASS'};
   }else delete s.fuelBalance;
   // Gravity coordinated-turn relation, using the RATE-LIMITED bank angle.
   const velocity=Math.max(s.tasKt*KT_TO_MPS,50);
   const turnDegPerSec=(9.80665*Math.tan(s.bankDeg*RAD)/velocity)/RAD;
   s.trueHeadingDeg=wrap(s.trueHeadingDeg+turnDegPerSec*dt);
   const oldAlt=s.altitudeFt;
   s.altitudeFt=Math.max(s.elevationFt,captureStep?
    captureStep.altitudeFt:s.altitudeFt+s.vsFpm/60*dt);
   if(captureStep?.phase==='HELD'){
    s.altitudeFt=captureStep.targetAltitudeFt;s.vsFpm=0;
    s.target.verticalMode='ALTITUDE';
    s.target.altitudeFt=captureStep.targetAltitudeFt;
   }
   if(target.verticalMode==='ALTITUDE'&&
      (target.altitudeFt-oldAlt)*(target.altitudeFt-s.altitudeFt)<=0){
    s.altitudeFt=target.altitudeFt;s.vsFpm=0;
   }
   s.radioAltitudeFt=Math.max(0,s.altitudeFt-s.elevationFt);
   // Runway touchdown follows the modeled flare to near-surface altitude.
   // Never teleport the airplane from ~80 ft RA to touchdown merely because
   // it crossed the runway threshold. This is a training touchdown proxy.
   const thrDist=distanceNm(s,s.threshold);
   const inboundDelta=angle(s.trueHeadingDeg,s.runwayHeadingTrueDeg);
   const nearCenterline=thrDist*Math.abs(Math.sin(inboundDelta*RAD))<.08;
   if(s.preset.startsWith('FINAL_')&&s.airborne===true&&
       thrDist<.75&&nearCenterline&&s.radioAltitudeFt<=8){
    s.phase='LANDING_ROLL';s.airborne=false;s.iasKt=Math.min(s.iasKt,145);
    s.vsFpm=0;s.altitudeFt=s.elevationFt;s.radioAltitudeFt=0;s.pitchDeg=0;s.bankDeg=0;
   }
  }
  const windTo=wrap(s.windFromDeg+180),heading=s.trueHeadingDeg;
  const speedEast=Math.sin(heading*RAD)*s.tasKt+Math.sin(windTo*RAD)*s.windKt;
  const speedNorth=Math.cos(heading*RAD)*s.tasKt+Math.cos(windTo*RAD)*s.windKt;
  s.gsKt=Math.max(0,Math.hypot(speedEast,speedNorth));
  s.trueTrackDeg=s.gsKt<.01?heading:wrap(Math.atan2(speedEast,speedNorth)/RAD);
  if(s.gsKt>0&&s.phase!=='GROUND_READY'){
   const next=move(s.lat,s.lon,s.trueTrackDeg,s.gsKt*dt/3600);
   s.lat=next.lat;s.lon=next.lon;
  }
  return s;
 }
 return Object.freeze({VERSION:'FLIGHT-SCENARIO-CORE-0001',
  AIRPORTS,PRESETS,newScenario,command,step,move,distanceNm,bearing,runwayAnchor,wrap,angle});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
