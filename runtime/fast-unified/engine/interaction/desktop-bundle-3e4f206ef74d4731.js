(async()=>{
;
/* ../../engine/interaction/asp-physical-commands-v1.js?v=ASP-PHYSICAL-0001 */
try{
/* ASP-PHYSICAL-0001 — FCOM 5.10.3/5.10.6.
 * Physical detents map directly to the single ASP audio backend.
 * This helper contains NO second state machine or aircraft-power assumptions.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ASPPhysicalCommandsV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const SEATS=Object.freeze(['CAPT','FO','OBS']);
 const CONTROLS=Object.freeze({
  PTT:Object.freeze({x:145,y:747,positions:Object.freeze(['ASP_RT',null,'ASP_IC']),spring:true}),
  MASK_BOOM:Object.freeze({x:410,y:747,positions:Object.freeze(['MASK','BOOM']),spring:false}),
  ALT_NORM:Object.freeze({x:980,y:747,positions:Object.freeze(['ALT','NORM']),spring:false})
 });
 function validate(seat,kind,value){
  if(!SEATS.includes(seat))throw Error('Unknown ASP station');
  if(!Object.hasOwn(CONTROLS,kind))throw Error('Unknown ASP physical control');
  if(!CONTROLS[kind].positions.includes(value))throw Error('Invalid ASP detent '+kind);
  return true;
 }
 function command(seat,kind,value){
  validate(seat,kind,value);
  return Object.freeze({seat,type:kind==='PTT'?'PTT':kind==='MASK_BOOM'?'MIC_SOURCE':'MODE',value});
 }
 function topBottom(kind,yFraction){
  if(!Object.hasOwn(CONTROLS,kind)||!Number.isFinite(yFraction))throw Error('Invalid ASP pointer');
  const detents=CONTROLS[kind].positions;
  return yFraction<.5?detents[0]:detents[detents.length-1];
 }
 function visualFromBackend(backend,seat){
  if(!backend||backend.schema!=='b737-asp-audio-v1')throw Error('ASP V1 backend required');
  if(!SEATS.includes(seat))throw Error('Unknown station');
  const s=backend.stations[seat];
  // WHEEL_MIC, WHEEL_INT and HAND key other physical microphones; ASP PTT stays neutral.
  const physicalPtt=['ASP_RT','ASP_IC'].includes(s.ptt)?s.ptt:null;
  validate(seat,'PTT',physicalPtt);
  validate(seat,'MASK_BOOM',s.microphone);validate(seat,'ALT_NORM',s.mode);
  return {seat,PTT:physicalPtt,MASK_BOOM:s.microphone,ALT_NORM:s.mode,
   mic:s.mic,receivers:{...s.receivers},volumes:{...s.volumes}};
 }
 return Object.freeze({version:'ASP-PHYSICAL-0001',SEATS,CONTROLS,validate,command,topBottom,visualFromBackend});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../cockpit/asp-physical-controls-v1.js?v=ASP-PHYSICAL-0001-VIEWBOX-0005 */
try{
/* ASP-PHYSICAL-0001: real faceplate MASK/BOOM, spring-return PTT, ALT/NORM.
 * Single authority: parent B737ASPAudioRuntimeV1, including OBS in OH04 iframe.
 * NO artwork edits, NO other electrical state, NO fake audio output.
 */
(function(root){'use strict';
 const Model=root.B737ASPPhysicalCommandsV1;
 if(!Model){root.console?.error('ASP physical detent model unavailable');return;}
 const isObserver=!!root.B737ASPOnlyObserver;
 const localSeats=isObserver?['OBS']:['CAPT','FO'];
 const names={PTT:'PTT · R/T / I/C',MASK_BOOM:'MASK / BOOM',ALT_NORM:'ALT / NORM'};
 const mounted=new Map();let lastObserverState=null,observerPending=false,received=0,rejected=0;
 function parentFrame(){return document.getElementById('overheadFrame')?.contentWindow||null;}
 function publish(seat,kind,value){
  const c=Model.command(seat,kind,value);
  if(isObserver){
   if(root.parent===root)throw Error('Observer must have parent cockpit authority');
   root.parent.postMessage({type:'b737:asp-obs-physical',command:c},root.location.origin);
  }else{
   const api=root.B737ASPAudioRuntimeV1;
   if(!api)throw Error('Shared ASP backend unavailable');
   if(c.type==='PTT')api.press(seat,c.value);
   else if(c.type==='MIC_SOURCE')api.setMicSource(seat,c.value);
   else api.setMode(seat,c.value);
  }
 }
 function mirror(){
  if(isObserver)return lastObserverState;
  const api=root.B737ASPAudioRuntimeV1;
  return api?api.getState():null;
 }
 function updateControl(el,value){
  const kind=el.dataset.aspPhysicalKind,seat=el.dataset.seat;
  Model.validate(seat,kind,value);
  el.dataset.value=value===null?'NEUTRAL':value;
  const detent=kind==='PTT'?(value===null?'CENTER':value==='ASP_RT'?'UP':'DOWN')
              :kind==='MASK_BOOM'?(value==='MASK'?'UP':'DOWN'):(value==='ALT'?'UP':'DOWN');
  el.dataset.detent=detent;
  el.setAttribute('aria-label','ASP '+seat+' '+names[kind]+' · '+(value??'NEUTRAL'));
  el.setAttribute('aria-pressed',String(detent==='UP'));
 }
 function project(local=mirror()){
  if(!local)return;
  for(const seat of localSeats){
   const v=Model.visualFromBackend(local,seat);
   const host=mounted.get(seat);if(!host)continue;
   for(const el of host.querySelectorAll('[data-asp-physical-kind]')){
    updateControl(el,v[el.dataset.aspPhysicalKind]);
   }
   host.dataset.aspAudioMode=v.ALT_NORM;
   // OBS photo is in the embedded iframe; the parent remains its sole logical owner.
   if(isObserver){
    for(const button of host.querySelectorAll('.asp-photo-control')){
     const name=button.dataset.channel,kind=button.dataset.kind;
     const on=v.ALT_NORM==='ALT'?(kind==='mic'&&name==='VHF-1'):
              (kind==='mic'?name===v.mic:!!v.receivers[name]);
     button.dataset.selected=String(on);
     if(kind==='mic')button.setAttribute('aria-pressed',String(on));
     button.style.pointerEvents=v.ALT_NORM==='ALT'?'none':'auto';
     if(kind==='volume'&&Number.isFinite(v.volumes[name])){
      const angle=45+v.volumes[name]*2.7,rotor=button.querySelector('.asp-control-rotor');
      if(rotor)rotor.style.transform='rotate('+angle+'deg)';
      button.dataset.volume=String(v.volumes[name]);
     }
    }
   }
  }
 }
 function positionSwitch(host,b){
  const slot=Model.CONTROLS[b.dataset.aspPhysicalKind];
  const img=host.querySelector(':scope > img');
  const w=img?.offsetWidth||host.clientWidth,h=img?.offsetHeight||host.clientHeight;
  if(!(w>0&&h>0))return;
  const originX=img?.offsetLeft||0,originY=img?.offsetTop||0;
  const frame=root.B737ASPSocketRegistrationV2.viewport(w,h,originX,originY);
  const p=frame.point(slot.x,slot.y);
  b.style.left=p.x+'px';b.style.top=p.y+'px';
  b.style.width=112*frame.scale+'px';b.style.height=112*frame.scale+'px';
  b.dataset.aspRegistration='SVG-xMidYMid-meet';
 }
 function makeSwitch(host,seat,kind){
  const c=Model.CONTROLS[kind];
  const button=document.createElement('button');
  button.type='button';button.className='asp-physical-switch';
  button.dataset.aspPhysicalKind=kind;button.dataset.seat=seat;
  positionSwitch(host,button);
  button.title=kind==='PTT'?'Hold upper half for R/T or lower for I/C; release returns neutral':
   'Top: '+c.positions[0]+' · Bottom: '+c.positions[c.positions.length-1];
  button.innerHTML='<span class="asp-physical-base"></span><span class="asp-physical-lever"></span>';
  const fraction=e=>{const box=button.getBoundingClientRect();return (e.clientY-box.top)/box.height;};
  const input=(value)=>{try{publish(seat,kind,value);}catch(e){root.console?.warn?.('ASP physical control rejected',e);}};
  if(kind==='PTT'){
   let held=false,activeId=null,activeValue=null;
   const press=value=>{
    if(activeValue===value)return;
    activeValue=value;button.dataset.detent=value==='ASP_RT'?'UP':value==='ASP_IC'?'DOWN':'CENTER';
    input(value);
   };
   const release=()=>{if(!held&&!activeValue)return;held=false;activeId=null;press(null);};
   button.addEventListener('pointerdown',e=>{
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();e.stopPropagation();
    held=true;activeId=e.pointerId;
    try{button.setPointerCapture(e.pointerId);}catch(_){}
    press(Model.topBottom(kind,fraction(e)));
   });
   button.addEventListener('pointermove',e=>{
    if(held&&e.pointerId===activeId){e.preventDefault();e.stopPropagation();press(Model.topBottom(kind,fraction(e)));}
   });
   for(const evt of ['pointerup','pointercancel','lostpointercapture'])
    button.addEventListener(evt,e=>{e.stopPropagation();if(activeId===null||e.pointerId===activeId)release();});
   button.addEventListener('keydown',e=>{
    if(e.repeat)return;
    const pos=(e.key==='ArrowUp'||e.key==='r'||e.key==='R'||e.key===' ')?'ASP_RT':
              (e.key==='ArrowDown'||e.key==='i'||e.key==='I')?'ASP_IC':null;
    if(pos){e.preventDefault();e.stopPropagation();held=true;press(pos);}
   });
   button.addEventListener('keyup',e=>{if(['ArrowUp','ArrowDown','r','R','i','I',' '].includes(e.key)){e.preventDefault();release();}});
   button.addEventListener('blur',release);
   root.addEventListener('blur',release);
   document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
   button.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();}); // Never toggle/latch a momentary PTT
  }else{
   button.addEventListener('pointerdown',e=>e.stopPropagation());
   button.addEventListener('click',e=>{
    e.preventDefault();e.stopPropagation();
    input(Model.topBottom(kind,fraction(e)));
   });
   button.addEventListener('keydown',e=>{
    const v=e.key==='ArrowUp'?c.positions[0]:e.key==='ArrowDown'?c.positions.at(-1):undefined;
    if(v!==undefined){e.preventDefault();e.stopPropagation();input(v);}
   });
  }
  const state=mirror();
  updateControl(button,state?.stations?.[seat]?(kind==='PTT'?state.stations[seat].ptt:kind==='MASK_BOOM'?state.stations[seat].microphone:state.stations[seat].mode):
    kind==='PTT'?null:kind==='MASK_BOOM'?'BOOM':'NORM');
  host.append(button);
  return button;
 }
 function mount(){
  for(const seat of localSeats){
   if(mounted.has(seat)&&mounted.get(seat).isConnected)continue;
   const host=document.querySelector('.asp-bare-mounted[data-seat="'+seat+'"]');
   if(!host||host.classList.contains('asp-observer-legacy'))continue;
   if(!isObserver&&seat==='OBS')continue;
   for(const kind of ['PTT','MASK_BOOM','ALT_NORM']){
    if(!host.querySelector('[data-asp-physical-kind="'+kind+'"]'))makeSwitch(host,seat,kind);
   }
   mounted.set(seat,host);
   new ResizeObserver(()=>{
    for(const b of host.querySelectorAll('[data-asp-physical-kind]'))positionSwitch(host,b);
   }).observe(host);
  }
  project();
  return localSeats.every(s=>mounted.get(s)?.isConnected);
 }
 if(isObserver){
  root.addEventListener('message',e=>{
   if(e.source!==root.parent||e.origin!==root.location.origin)return;
   const d=e.data;
   if(!d||d.type!=='b737:asp-obs-audio-projection')return;
   const v=d.station;
   if(!v||v.seat!=='OBS'||!['BOOM','MASK'].includes(v.microphone)||
      !['ALT','NORM'].includes(v.mode)||![null,'ASP_RT','ASP_IC','WHEEL_MIC','WHEEL_INT','HAND'].includes(v.ptt)){
    rejected++;return;
   }
   lastObserverState={schema:'b737-asp-audio-v1',stations:{OBS:{...v}}};
   received++;project();
  });
 }else{
  function sendObserver(){
   const frame=parentFrame(),state=mirror();
   if(!frame||!state)return;
   frame.postMessage({type:'b737:asp-obs-audio-projection',
    station:{seat:'OBS',...state.stations.OBS}},root.location.origin);
  }
  root.addEventListener('message',e=>{
   if(e.origin!==root.location.origin||e.source!==parentFrame())return;
   const d=e.data;
   if(d?.type==='b737:asp-obs-physical-ready'){sendObserver();return;}
   if(d?.type!=='b737:asp-obs-physical')return;
   const c=d.command;
   try{
    Model.validate(c?.seat,c?.type==='MIC_SOURCE'?'MASK_BOOM':c?.type==='MODE'?'ALT_NORM':c?.type==='PTT'?'PTT':'?',c?.value);
    if(c.seat!=='OBS')throw Error('OBS station required');
    publish('OBS',c.type==='PTT'?'PTT':c.type==='MIC_SOURCE'?'MASK_BOOM':'ALT_NORM',c.value);
    sendObserver();received++;
   }catch(_){rejected++;}
  });
  root.addEventListener('b737:asp-audio-state',()=>{project();sendObserver();});
  root.addEventListener('load',sendObserver);
  root.addEventListener('b737:cockpit-mounted',()=>{mount();sendObserver();});
  root.B737ASPPhysicalControlsV1=Object.freeze({mount,snapshot:()=>({localSeats,received,rejected,
    mounts:localSeats.map(seat=>({seat,controlCount:mounted.get(seat)?.querySelectorAll('.asp-physical-switch').length||0}))})});
 }
 function boot(){
  if(mount()&&isObserver){
   root.parent.postMessage({type:'b737:asp-obs-physical-ready'},root.location.origin);
  }
  const watch=new MutationObserver(()=>{if(!localSeats.every(s=>mounted.get(s)?.isConnected)){if(mount()&&isObserver)
    root.parent.postMessage({type:'b737:asp-obs-physical-ready'},root.location.origin);}});
  watch.observe(document.documentElement,{childList:true,subtree:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
 if(isObserver)root.B737ASPPhysicalControlsV1=Object.freeze({mount,snapshot:()=>({localSeats,received,rejected,
   mounts:localSeats.map(seat=>({seat,controlCount:mounted.get(seat)?.querySelectorAll('.asp-physical-switch').length||0}))})});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../cockpit/aircon-400-model.js?v=AIRCON400-0005-SOCKET-CENTER */
try{
/* B737-400 Environmental Control Panel: Unified-only, distinct OH20 overlay.
 * No physical source image or immutable atlas geometry is changed.
 * Screen geometry is calibrated in pixels of the owner's 1122x1402 PNG.
 * Zone caution states are external inputs; no synthetic failure rules invented.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Aircon400Model=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const source=Object.freeze({width:1122,height:1402,asset:'Boeing-Style Environmental Control Panel.png'});
 const precheck=Object.freeze({
  id:'air-temp-precheck',label:'AIR TEMP PRECHECK',type:'rotary',
  x:839,y:348,diameter:258,
  states:Object.freeze(['SUPPLY DUCT FWD','SUPPLY DUCT AFT','CONT CAB','PASS CAB FWD','PASS CAB AFT','PACK L','PACK R']),
  angles:Object.freeze([-130,-94,-45,0,45,91,130]),default:'PASS CAB FWD'
 });
 const temperatureStates=Object.freeze(['C','AUTO COOL','AUTO','AUTO WARM','W','OFF']);
 const temperatureAngles=Object.freeze([-128,-61,0,61,128,180]);
 // Measured from the original 1122x1402 source's black socket centres:
 // top (839,348), trim (553,639), lower (220/561/900,1117).
 // These coordinates are SOURCE IMAGE pixels, not screen/zoom CSS pixels.
 const zoneKnobs=Object.freeze([
  Object.freeze({id:'cont-cab',label:'CONT CAB TEMPERATURE',type:'rotary',x:220,y:1117,diameter:260,states:temperatureStates,angles:temperatureAngles,default:'AUTO',mirror:'control-cabin-temp'}),
  Object.freeze({id:'fwd-cab',label:'FWD CAB TEMPERATURE',type:'rotary',x:561,y:1117,diameter:260,states:temperatureStates,angles:temperatureAngles,default:'AUTO'}),
  Object.freeze({id:'aft-cab',label:'AFT CAB TEMPERATURE',type:'rotary',x:900,y:1117,diameter:260,states:temperatureStates,angles:temperatureAngles,default:'AUTO',mirror:'pass-cabin-temp'})
 ]);
 const trim=Object.freeze({id:'trim-air',label:'TRIM AIR',type:'toggle',x:553,y:639,width:176,height:220,states:Object.freeze(['OFF','ON']),default:'OFF'});
 // Lamp locations correspond to the INTERNAL black glass inside orange rims.
 // Verified against owner-approved 1122x1402 background: outer frames
 // [107..337,774..886], [456..678,774..886], [787..1016,774..886].
 // Never expand faces across those already printed orange metal frames.
 const lamps=Object.freeze([
  Object.freeze({id:'zone-temp-cont',zone:'cont-cab',label:'CONT CAB ZONE TEMP',rect:Object.freeze([118,788,210,88])}),
  Object.freeze({id:'zone-temp-fwd',zone:'fwd-cab',label:'FWD CAB ZONE TEMP',rect:Object.freeze([466,788,204,88])}),
  Object.freeze({id:'zone-temp-aft',zone:'aft-cab',label:'AFT CAB ZONE TEMP',rect:Object.freeze([797,788,210,88])})
 ]);
 const controls=Object.freeze([precheck,trim,...zoneKnobs]);
 const defaults=Object.freeze(Object.fromEntries(controls.map(c=>[c.id,c.default])));
 function normalize(input){
  const out={...defaults};
  for(const c of controls)if(c.states.includes(input?.[c.id]))out[c.id]=input[c.id];
  return out;
 }
 function step(c,value,delta){
  const current=c.states.indexOf(value);
  return c.states[Math.max(0,Math.min(c.states.length-1,current+Math.sign(delta)))];
 }
 function map(point,placement){
  const x=Number(placement.x),y=Number(placement.y),w=Number(placement.w),h=Number(placement.h);
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)throw Error('Invalid OH20 placement');
  return {x:x+point[0]*w/source.width,y:y+point[1]*h/source.height};
 }
 function rect(b,placement){
  const lt=map([b[0],b[1]],placement),rb=map([b[0]+b[2],b[1]+b[3]],placement);
  return {x:lt.x,y:lt.y,w:rb.x-lt.x,h:rb.y-lt.y};
 }
 function angle(c,state){return c.angles?.[c.states.indexOf(state)]??0;}
 function validate(){
  const ids=new Set();
  for(const c of controls){if(ids.has(c.id)||c.x<=0||c.y<=0||c.x>=source.width||c.y>=source.height||!c.states.includes(c.default))throw Error('Invalid 400 control '+c.id);ids.add(c.id);}
  for(const l of lamps){if(!ids.has(l.zone)||l.rect[0]<0||l.rect[1]<0||l.rect[0]+l.rect[2]>source.width||l.rect[1]+l.rect[3]>source.height)throw Error('Invalid 400 zone lamp '+l.id);}
  return true;
 }
 return Object.freeze({source,precheck,zoneKnobs,trim,lamps,controls,defaults,normalize,step,map,rect,angle,validate});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../cockpit/aircon-400-overlay.js?v=AIRCON400-SIXPACK-LIVE-0001 */
try{
/* Unified B737-400 OH20 controls. The photographed panel remains untouched.
 * This script is not loaded by the frozen standalone overhead mosaic.
 */
(function(){
 'use strict';
 const model=window.B737Aircon400Model,host=document.getElementById('atlasAbsolute');
 if(!model||!host)throw Error('B737-400 Air Conditioning overlay requires its model/atlas');
 model.validate();
 const PROFILE_KEY='b737classic.aircraft-profile.v1';
 const STORE_KEY='b737classic.aircon400-controls.v1';
 const asset=filename=>new URL('../assets/locked/2026-10-23/'+filename,document.baseURI).href;
 const rotarySrc=asset('Switches/Rotary/rotary-standard-v1.webp');
 const toggleSrc={
  OFF:asset('Switches/Toggle/b737-toggle-off.webp'),
  ON:asset('Switches/Toggle/b737-toggle-on.webp')
 };
 const lampSrc={
  OFF:asset('LIGHTS/black-yellow-v1/mounted/ZONE_TEMP_YELLOW_OFF.svg'),
  ON:asset('LIGHTS/black-yellow-v1/mounted/ZONE_TEMP_YELLOW_ON.svg')
 };
 let state,zoneFaults={'cont-cab':false,'fwd-cab':false,'aft-cab':false},test=false,family='B737-300-500',plate=null,layer=null;
 // Temperature values come from external simulated sensors, never from invented defaults.
 const measuredTemperatures=Object.create(null);
 function publishIndicatedTemperature(){
  const position=state[model.precheck.id];
  const celsius=measuredTemperatures[position];
  if(family!=='B737-400'||!Number.isFinite(celsius))return false;
  const detail={source:position,celsius};
  window.dispatchEvent(new CustomEvent('b737:aircon400-temperature',{detail}));
  if(parent!==window)parent.postMessage({type:'b737:cockpit-overhead',kind:'aircon400-temperature-reading',...detail},location.origin);
  return true;
 }
 function setTemperatureReading(position,celsius){
  if(!model.precheck.states.includes(position)||!Number.isFinite(celsius))return false;
  measuredTemperatures[position]=Math.max(0,Math.min(100,celsius));
  if(state[model.precheck.id]===position)publishIndicatedTemperature();
  return true;
 }
 const controls=new Map(),lamps=new Map();
 function saved(){
  try{return model.normalize(JSON.parse(localStorage.getItem(STORE_KEY)||'null'));}
  catch(_){return model.normalize(null);}
 }
 function save(){try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}catch(_){}}
 function selectedFamily(){
  try {return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')?.aircraftFamily==='B737-400'?'B737-400':'B737-300-500';}
  catch(_){return 'B737-300-500';}
 }
 state=saved();
 function report(control,value,reason){
  const detail={id:control.id,value,reason,family:'B737-400',state:{...state}};
  window.dispatchEvent(new CustomEvent('b737:aircon400-control-change',{detail}));
  if(parent!==window)parent.postMessage({type:'b737:cockpit-overhead',kind:'aircon400-control',...detail},location.origin);
 }
 function setValue(id,value,reason='ui'){
  const c=model.controls.find(c=>c.id===id);
  if(!c||!c.states.includes(value))return false;
  if(state[id]===value)return true;
  state[id]=value;save();renderOne(c);
  if(c.mirror&&value!=='OFF'){
   const mirrorValue={'C':'MANUAL COOL','AUTO COOL':'AUTO COOL','AUTO':'AUTO NORM','AUTO WARM':'AUTO WARM','W':'MANUAL WARM'}[value];
   if(mirrorValue)window.B737RotaryGuards?.setAirconTemperature?.(c.mirror,mirrorValue);
  }
  report(c,value,reason);if(c.id===model.precheck.id)publishIndicatedTemperature();return true;
 }
 function addRotary(c){
  const b=document.createElement('button');b.type='button';b.className='aircon400-knob';b.dataset.airconControl=c.id;
  b.setAttribute('role','slider');b.setAttribute('aria-valuemin','0');b.setAttribute('aria-valuemax',String(c.states.length-1));
  b.title=c.label;
  const im=document.createElement('img');im.src=rotarySrc;im.alt='';im.draggable=false;b.append(im);
  let gesture=null,suppressClick=false;
  const index=()=>c.states.indexOf(state[c.id]);
  const step=(d,reason)=>setValue(c.id,model.step(c,state[c.id],d),reason);
  b.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;e.stopPropagation();b.focus({preventScroll:true});
   b.setPointerCapture(e.pointerId);gesture={pointer:e.pointerId,x:e.clientX,y:e.clientY,from:index()};
  });
  b.addEventListener('pointerup',e=>{
   if(!gesture||gesture.pointer!==e.pointerId)return;
   e.stopPropagation();
   const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y,threshold=Math.max(9,b.getBoundingClientRect().width*.17);
   const distance=Math.max(Math.abs(dx),Math.abs(dy));
   if(distance>threshold){
    const sign=(Math.abs(dx)>=Math.abs(dy)?dx:-dy)>0?1:-1;
    const ticks=Math.min(3,Math.max(1,Math.round(distance/threshold)));
    setValue(c.id,c.states[Math.max(0,Math.min(c.states.length-1,gesture.from+sign*ticks))],'detent-drag');
    suppressClick=true;
   }else suppressClick=false;
   gesture=null;
  });
  b.addEventListener('pointercancel',()=>{gesture=null;suppressClick=true;});
  b.addEventListener('lostpointercapture',()=>{gesture=null;});
  b.addEventListener('click',e=>{e.stopPropagation();if(suppressClick){suppressClick=false;return;}step(1,'detent-tap');});
  b.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();step(e.deltaY>0?1:-1,'detent-wheel');},{passive:false});
  b.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   if(e.key==='Home')setValue(c.id,c.states[0],'keyboard');
   else if(e.key==='End')setValue(c.id,c.states.at(-1),'keyboard');
   else step(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1,'keyboard');
  });
  layer.append(b);controls.set(c.id,b);
 }
 function addTrim(c){
  const b=document.createElement('button');b.type='button';b.className='aircon400-trim';b.dataset.airconControl=c.id;
  b.title=c.label+' · OFF / ON';b.setAttribute('role','switch');
  for(const value of c.states){const img=document.createElement('img');img.dataset.frame=value;img.src=toggleSrc[value];img.alt='';img.draggable=false;b.append(img);}
  b.addEventListener('pointerdown',e=>e.stopPropagation());
  b.addEventListener('click',e=>{e.stopPropagation();setValue(c.id,state[c.id]==='OFF'?'ON':'OFF','toggle-click');});
  b.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   setValue(c.id,['ArrowUp','Home'].includes(e.key)?'OFF':'ON','toggle-key');
  });
  layer.append(b);controls.set(c.id,b);
 }
 function addLamp(l){
  const button=document.createElement('button');button.type='button';button.className='aircon400-zone-lamp';button.dataset.airconLamp=l.id;
  button.title=l.label;button.setAttribute('aria-label',l.label);
  const off=document.createElement('img');off.src=lampSrc.OFF;off.dataset.frame='OFF';off.alt='';
  const on=document.createElement('img');on.src=lampSrc.ON;on.dataset.frame='ON';on.alt='';
  button.append(off,on);
  button.addEventListener('pointerdown',e=>e.stopPropagation());
  button.addEventListener('click',e=>e.stopPropagation());
  layer.append(button);lamps.set(l.zone,button);
 }
 function renderOne(c){
  const node=controls.get(c.id);if(!node)return;
  node.dataset.state=state[c.id];
  node.setAttribute('aria-label',c.label+' — '+state[c.id]);
  if(c.type==='rotary'){
   node.style.setProperty('--aircon-angle',model.angle(c,state[c.id])+'deg');
   node.setAttribute('aria-valuenow',String(c.states.indexOf(state[c.id])));
   node.setAttribute('aria-valuetext',state[c.id]);
  }else{
   node.setAttribute('aria-checked',String(state[c.id]==='ON'));
   for(const img of node.querySelectorAll('img'))img.classList.toggle('active',img.dataset.frame===state[c.id]);
  }
 }
 function paintLamps(){
  for(const l of model.lamps){
   const node=lamps.get(l.zone);if(!node)continue;
   const active=test||zoneFaults[l.zone]===true;
   node.dataset.state=active?'ON':'OFF';
   for(const im of node.querySelectorAll('img'))im.classList.toggle('active',im.dataset.frame===(active?'ON':'OFF'));
  }
 }
 function position(){
  const p=plate;if(!p||!layer)return;
  const placement={x:parseFloat(p.style.left),y:parseFloat(p.style.top),w:parseFloat(p.style.width),h:parseFloat(p.style.height)};
  for(const c of model.controls){
   const point=model.map([c.x,c.y],placement),node=controls.get(c.id);
   const width=(c.type==='toggle'?c.width:c.diameter)*placement.w/model.source.width;
   const height=(c.type==='toggle'?c.height:c.diameter)*placement.h/model.source.height;
   Object.assign(node.style,{left:point.x+'px',top:point.y+'px',width:width+'px',height:height+'px'});
  }
  for(const l of model.lamps){const node=lamps.get(l.zone),rect=model.rect(l.rect,placement);Object.assign(node.style,{left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px'});}
 }
 function syncVisibility(){
  if(!layer)return;
  const switches=document.getElementById('rotaryGuardLayer');
  const lights=document.getElementById('overheadLightLayer');
  for(const node of controls.values())node.style.visibility=switches?.classList.contains('hidden')?'hidden':'visible';
  for(const node of lamps.values())node.style.visibility=lights?.classList.contains('hidden')?'hidden':'visible';
 }
 function mount(){
  const next=host.querySelector('.atlas-piece[data-key="OH20"]');
  if(!next||!window.B737RotaryGuards||!window.B737OverheadLights)return false;
  if(layer?.isConnected&&plate===next)return true;
  plate=next;layer?.remove();layer=document.createElement('div');
  layer.id='aircon400Overlay';layer.className='aircon400-layer';
  model.controls.forEach(c=>c.type==='rotary'?addRotary(c):addTrim(c));
  model.lamps.forEach(addLamp);host.append(layer);
  position();model.controls.forEach(renderOne);paintLamps();syncVisibility();applyFamily(family);
  for(const id of ['toggleVisibility','lightVisibility'])document.getElementById(id)?.addEventListener('change',syncVisibility);
  return true;
 }
 function applyFamily(value){
  if(!['B737-400','B737-300-500'].includes(value))return;
  family=value;document.documentElement.classList.toggle('b737-aircon400',family==='B737-400');
  document.documentElement.classList.toggle('b737-aircon300500',family==='B737-300-500');
  if(layer)layer.hidden=family!=='B737-400';
  if(family==='B737-400')publishIndicatedTemperature();
   publishZones();
 }
 let lastSixpackZones='';
 function publishZones(){
  const state={family,zoneFaults:{...zoneFaults}};
  const sign=JSON.stringify(state);if(sign===lastSixpackZones)return;
  lastSixpackZones=sign;
  if(parent!==window)parent.postMessage({
   type:'b737:cockpit-overhead',kind:'aircon400-zone-status',...state
  },location.origin);
 }
 function setZoneFault(zone,active){
  if(!Object.hasOwn(zoneFaults,zone)||typeof active!=='boolean')return false;
  zoneFaults[zone]=active;paintLamps();publishZones();return true;
 }
 function setLampTest(active){test=!!active;paintLamps();}
 function boot(){
  applyFamily(selectedFamily());
  if(mount())return;
  const watch=new MutationObserver(()=>{if(mount())watch.disconnect();});
  watch.observe(host,{childList:true,subtree:true});
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:cockpit-command')return;
  if(e.data.action==='aircon-background')applyFamily(e.data.family);
  if(e.data.action==='aircon400-zone-fault')setZoneFault(e.data.zone,e.data.active);
  if(e.data.action==='aircon400-temperature-reading')setTemperatureReading(e.data.source,e.data.celsius);
  if(e.data.action==='visual-test'||e.data.action==='lamp-test')setLampTest(e.data.active);
 });
 window.addEventListener('storage',e=>{if(e.key===PROFILE_KEY)applyFamily(selectedFamily());});
 window.addEventListener('b737:aircon400-zone-fault',e=>setZoneFault(e.detail?.zone,e.detail?.active));
 for(const id of ['toggleVisibility','lightVisibility']){
  const el=document.getElementById(id);el?.addEventListener('change',syncVisibility);
 }
 window.addEventListener('b737:aircon400-reset',()=>{state=model.normalize(null);save();model.controls.forEach(renderOne);});
 window.B737Aircon400=Object.freeze({
  getState:()=>({family,controls:{...state},zoneFaults:{...zoneFaults},lampTest:test}),
  setValue,setZoneFault,setLampTest,setTemperatureReading,
  switchFamily:applyFamily
 });
 boot();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../cockpit/aircon-400-oh21-model.js?v=AIRCON400-OH21-0002-SYMMETRIC */
try{
/* Unified-only 737-400 OH21 installation geometry; frozen OH21 artwork unchanged.
 * Positions originate from OH21 source coordinates (1122 x 1402).
 * This variant reuses the existing right RECIRC FAN switch and both pack trip inputs.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Aircon400Oh21Model=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const source=Object.freeze({width:1122,height:1402,placementId:'OH21'});
 const switches=Object.freeze([
  Object.freeze({id:'recirc-fan-l',label:'L RECIRC FAN',sourcePoint:Object.freeze([185.13,269.33]),states:Object.freeze(['OFF','AUTO']),default:'AUTO'}),
  Object.freeze({id:'recirc-fan',label:'R RECIRC FAN',sourcePoint:Object.freeze([860.57,269.33]),states:Object.freeze(['OFF','AUTO']),default:'AUTO',existing:true})
 ]);
 const packs=Object.freeze([
  Object.freeze({side:'L',id:'pack-400-l',legacyId:'pack-trip-l',label:'PACK',rect:Object.freeze([243,862,180,66])}),
  Object.freeze({side:'R',id:'pack-400-r',legacyId:'pack-trip-r',label:'PACK',rect:Object.freeze([701,862,180,66])})
 ]);
 // Pixel-calibrated matched placards. Dimensions are OH21 source pixels.
 // Both headings share exactly the same width/height and font treatment.
 const labels=Object.freeze([
  Object.freeze({id:'title-l',text:'L RECIRC FAN',kind:'title',rect:Object.freeze([30,120,325,50])}),
  Object.freeze({id:'title-r',text:'R RECIRC FAN',kind:'title',rect:Object.freeze([700,120,325,50])}),
  Object.freeze({id:'off-l',text:'OFF',kind:'detent',rect:Object.freeze([256,178,120,56])}),
  Object.freeze({id:'auto-l',text:'AUTO',kind:'detent',rect:Object.freeze([256,252,120,56])}),
  Object.freeze({id:'off-r',text:'OFF',kind:'detent',rect:Object.freeze([700,178,120,56])}),
  Object.freeze({id:'auto-r',text:'AUTO',kind:'detent',rect:Object.freeze([700,252,120,56])})
 ]);
 // Variant-only skin over the 300/500 RECIRC title, switch, and detents
 // before repainting both 400 switch positions. Never change locked source.
 const nativeRightCover=Object.freeze([677,113,350,228]);

 function geometry(placement){
  const {x,y,w,h}=placement;
  if(![x,y,w,h].every(Number.isFinite)||w<=0||h<=0)throw Error('Invalid OH21 placement');
  return {
   point:([sx,sy])=>({x:x+w*sx/source.width,y:y+h*sy/source.height}),
   rect:([sx,sy,sw,sh])=>({x:x+w*sx/source.width,y:y+h*sy/source.height,w:w*sw/source.width,h:h*sh/source.height})
  };
 }
 function normalizeSwitch(value){return ['OFF','AUTO'].includes(value)?value:'AUTO';}
 function variant(family){return family==='B737-400'?'B737-400':'B737-300-500';}
 function validate(){
  const xs=switches.map(s=>s.sourcePoint[0]);
  if(xs[0]>=xs[1]||switches[1].id!=='recirc-fan'||packs.length!==2)throw Error('Invalid dual RECIRC installation');
  for(const c of [...packs,...labels]){const [x,y,w,h]=c.rect;if(x<0||y<0||x+w>source.width||y+h>source.height)throw Error('OH21 variant geometry exceeds source');}
  const intersects=(a,b)=>a[0]<b[0]+b[2]&&a[0]+a[2]>b[0]&&a[1]<b[1]+b[3]&&a[1]+a[3]>b[1];
  const headers=labels.filter(x=>x.kind==='title');
  const detents=labels.filter(x=>x.kind==='detent');
  if(headers.length!==2||headers[0].rect[2]!==headers[1].rect[2]||headers[0].rect[3]!==headers[1].rect[3]||headers[0].rect[1]!==headers[1].rect[1])
   throw Error('737-400 dual RECIRC headings must have identical box dimensions');
  for(let i=0;i<labels.length;i++)for(let j=i+1;j<labels.length;j++){
   if(intersects(labels[i].rect,labels[j].rect))throw Error('Intersecting RECIRC placards: '+labels[i].id+' and '+labels[j].id);
  }
  for(const toggle of switches){
   // Envelope includes bezel and the full raised/upper actuator at OFF.
   const [x,y]=toggle.sourcePoint;
   const lever=[x-60,y-85,120,145];
   if(headers.some(h=>intersects(lever,h.rect)))throw Error('Toggle actuator enters RECIRC heading: '+toggle.id);
   // Detent placards are outside the lever's narrow central stem.
   const stem=[x-21,y-75,42,140];
   if(detents.some(h=>intersects(stem,h.rect)))throw Error('Toggle actuator enters detent legend: '+toggle.id);
  }

  return true;
 }
 return Object.freeze({source,switches,packs,labels,nativeRightCover,geometry,normalizeSwitch,variant,validate});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../cockpit/aircon-400-oh21-overlay.js?v=AIRCON400-OH21-0002-SYMMETRIC */
try{
/* Unified-only 737-400 OH21 air systems adaptation.
 * Does not modify or mount within the immutable all-overhead mosaic.
 * Existing right RECIRC toggle and pack-trip caution logic are reused.
 */
(function(){
 'use strict';
 const m=window.B737Aircon400Oh21Model,host=document.getElementById('atlasAbsolute');
 if(!m||!host)throw Error('737-400 OH21 overlay dependencies unavailable');
 m.validate();
 const PROFILE_KEY='b737classic.aircraft-profile.v1',STORE_KEY='b737classic.aircon400-recirculation.v1';
 const asset=name=>new URL('../cockpit/assets/'+name,document.baseURI).href;
 let family='B737-300-500',plate=null,layer=null,underlay=null,left=null,rightToggle=null,rightOriginal=null,packNodes=new Map();
 let leftValue='AUTO';
 try{leftValue=m.normalizeSwitch(localStorage.getItem(STORE_KEY));}catch(_){}
 function storedFamily(){
  try{return m.variant(JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')?.aircraftFamily);}
  catch(_){return 'B737-300-500';}
 }
 function absolutePlacement(el){
  const n=x=>parseFloat(x);
  return {x:n(el.style.left),y:n(el.style.top),w:n(el.style.width),h:n(el.style.height)};
 }
 function fit(node,rect){
  Object.assign(node.style,{left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px'});
 }
 function publishLeft(){
  window.B737OverheadLights?.setAircon400LeftRecirc?.(leftValue);
  window.dispatchEvent(new CustomEvent('b737:aircon400-recirculation-change',{
   detail:{family:'B737-400',side:'L',value:leftValue}
  }));
  if(parent!==window)parent.postMessage({
   type:'b737:cockpit-overhead',kind:'aircon400-recirculation',
   family:'B737-400',side:'L',value:leftValue
  },location.origin);
 }
 function renderLeft(){
  if(!left)return;
  const sprite=left.querySelector('.toggle-sprite');
  const reference=window.B737OverheadToggles?.getRegistry()||{};
  const defs=reference.assets||{},small=reference.visualFamilies?.Small;
  const frame=leftValue==='OFF'?3:4,down=frame===4,definition=defs[down?'vertical-off':'vertical-on'];
  if(sprite&&small){
   // The 737-400 L and R RECIRC FAN use precisely the same fixed-bezel Small atlas.
   sprite.style.backgroundImage='url("'+new URL('../interactive-overhead/'+small.asset,document.baseURI).href+'")';
   sprite.style.backgroundSize='500% 100%';
   sprite.style.backgroundPosition=frame*25+'% 50%';
  }else if(sprite&&definition){
   sprite.style.backgroundImage='url("'+new URL('../interactive-overhead/'+definition.url,document.baseURI).href+'")';
   sprite.style.backgroundSize=down?'100% 100%':'500% 100%';
   sprite.style.backgroundPosition=down?'50% 50%':frame*25+'% 50%';
  }
  left.dataset.state=leftValue;
  left.setAttribute('aria-valuenow',String(leftValue==='OFF'?0:1));
  left.setAttribute('aria-valuetext',leftValue);
  left.setAttribute('aria-label','L RECIRC FAN — '+leftValue);
 }
 function setLeft(value,reason='ui'){
  if(!['OFF','AUTO'].includes(value))return false;
  if(value===leftValue)return true;
  leftValue=value;
  try{localStorage.setItem(STORE_KEY,value);}catch(_){}
  renderLeft();publishLeft();
  return true;
 }
 // Share actual title font metrics and secondary detent font metrics.
 function addLabels(g){
  const grouped=new Map();
  for(const item of m.labels){
   const rect=g.rect(item.rect);
   const ctx=document.createElement('canvas').getContext('2d');
   const maxHeight=rect.h*.72;ctx.font='800 '+maxHeight+'px Arial';
   const width=ctx.measureText(item.text).width;
   const candidate=maxHeight*Math.min(1,(rect.w-10)/Math.max(1,width))*.94;
   grouped.set(item.kind,Math.min(grouped.get(item.kind)??Infinity,candidate));
  }
  for(const item of m.labels){
   const node=document.createElement('span');node.className='aircon400-recirculation-label';
   node.textContent=item.text;node.dataset.airconLabel=item.text;
   node.dataset.labelKind=item.kind;node.dataset.labelId=item.id;
   fit(node,g.rect(item.rect));
   node.style.fontSize=grouped.get(item.kind).toFixed(2)+'px';
   layer.append(node);
  }
 }
 function installRightCover(g){
  underlay?.remove();
  underlay=document.createElement('div');
  underlay.className='aircon400-oh21-underlay';
  underlay.id='aircon400Oh21Underlay';
  const patch=document.createElement('span');
  patch.className='aircon400-native-recirc-cover';
  fit(patch,g.rect(m.nativeRightCover));
  underlay.append(patch);host.append(underlay);
 }
 function placeRight(g){
  if(!rightToggle)return;
  if(!rightOriginal){
   rightOriginal={left:rightToggle.style.left,top:rightToggle.style.top,title:rightToggle.getAttribute('title')};
  }
  if(family==='B737-400'){
   const point=g.point(m.switches[1].sourcePoint);
   rightToggle.style.left=point.x+'px';rightToggle.style.top=point.y+'px';
   // Native tooltip was the unexpected third "RECIRC FAN" label.
   rightToggle.removeAttribute('title');
   rightToggle.setAttribute('aria-label','R RECIRC FAN — '+(window.B737OverheadToggles?.getState()?.['recirc-fan']||'AUTO'));
  }else{
   rightToggle.style.left=rightOriginal.left;rightToggle.style.top=rightOriginal.top;
   if(rightOriginal.title===null)rightToggle.removeAttribute('title');
   else rightToggle.setAttribute('title',rightOriginal.title);
  }
 }

 function addLeft(g,right){
  const point=g.point(m.switches[0].sourcePoint);
  // Reuse the approved physical toggle artwork/size, not a new unrelated switch.
  left=right.cloneNode(true);
  left.id='toggle-recirc-fan-l-400';left.dataset.control='recirc-fan-l';
  left.classList.add('aircon400-left-recirculation');left.dataset.visualFamily='Small';
  left.title='L RECIRC FAN — OFF / AUTO';
  Object.assign(left.style,{left:point.x+'px',top:point.y+'px'});
  left.addEventListener('pointerdown',e=>{e.stopPropagation();e.preventDefault();});
  left.addEventListener('pointerup',e=>{e.stopPropagation();});
  left.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();setLeft(leftValue==='OFF'?'AUTO':'OFF');});
  left.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();setLeft(e.deltaY>0?'AUTO':'OFF');},{passive:false});
  left.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown','Home','End',' ','Enter'].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   if(['Home','ArrowUp'].includes(e.key))setLeft('OFF');
   else if(['End','ArrowDown'].includes(e.key))setLeft('AUTO');
   else setLeft(leftValue==='OFF'?'AUTO':'OFF');
  });
  layer.append(left);renderLeft();
 }
 function addPack(g,item){
  const node=document.createElement('span');node.className='aircon400-pack-face';
  node.dataset.airconPack=item.side;node.setAttribute('aria-label',item.side+' PACK caution');
  fit(node,g.rect(item.rect));
  for(const state of ['OFF','ON']){
   const img=document.createElement('img');img.src=asset('737-400-PACK_FITTED_'+state+'.svg');
   img.alt='';img.draggable=false;img.dataset.frame=state;node.append(img);
  }
  layer.append(node);packNodes.set(item.side,{node,item});
 }
 function paint(){
  if(!layer||family!=='B737-400')return;
  const output=window.B737OverheadLights?.getState();
  for(const {node,item} of packNodes.values()){
   const state=output?.frames?.[item.legacyId]==='ON'?'ON':'OFF';
   node.dataset.state=state;
   for(const img of node.querySelectorAll('img'))img.classList.toggle('active',img.dataset.frame===state);
  }
  const togglesHidden=document.getElementById('overheadToggleLayer')?.classList.contains('hidden');
  const lightsHidden=document.getElementById('overheadLightLayer')?.classList.contains('hidden');
  if(left)left.style.visibility=togglesHidden?'hidden':'visible';
  for(const {node} of packNodes.values())node.style.visibility=lightsHidden?'hidden':'visible';
 }
 function mount(){
  const next=host.querySelector('.atlas-piece[data-key="OH21"]');
  const right=document.getElementById('toggle-recirc-fan');
  if(!next||!right||!window.B737OverheadLights||!window.B737OverheadToggles)return false;
  if(layer?.isConnected&&plate===next)return true;
  plate=next;layer?.remove();underlay?.remove();left=null;packNodes=new Map();rightToggle=right;
  layer=document.createElement('div');layer.id='aircon400Oh21Overlay';
  layer.className='aircon400-oh21-layer';
  const g=m.geometry(absolutePlacement(plate));
  installRightCover(g);
  addLabels(g);addLeft(g,right);for(const p of m.packs)addPack(g,p);
  host.append(layer);
  applyFamily(family);
  return true;
 }
 function applyFamily(value){
  family=m.variant(value);
  if(layer)layer.hidden=family!=='B737-400';
  if(underlay)underlay.hidden=family!=='B737-400';
  if(plate&&rightToggle)placeRight(m.geometry(absolutePlacement(plate)));
  window.B737OverheadLights?.setAircraftFamily?.(family);
  if(family==='B737-400'){
   window.B737OverheadLights?.setAircon400LeftRecirc?.(leftValue);
   paint();
  }
 }
 function boot(){
  applyFamily(storedFamily());
  if(mount())return;
  const watch=new MutationObserver(()=>{if(mount())watch.disconnect();});
  watch.observe(host,{childList:true,subtree:true});
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:cockpit-command')return;
  if(e.data.action==='aircon-background')applyFamily(e.data.family);
 });
 window.addEventListener('storage',e=>{if(e.key===PROFILE_KEY)applyFamily(storedFamily());});
 window.addEventListener('b737:overhead-light-state',paint);
 window.addEventListener('b737:switch-change',e=>{
   if(e.detail?.id==='recirc-fan'){
    if(family==='B737-400')rightToggle?.setAttribute('aria-label','R RECIRC FAN — '+e.detail.next);
    paint();
   }
  });
 for(const id of ['toggleVisibility','lightVisibility'])
  document.getElementById(id)?.addEventListener('change',()=>queueMicrotask(paint));
 document.getElementById('resetToggles')?.addEventListener('click',()=>{
  setLeft('AUTO','reset');queueMicrotask(paint);
 });
 window.B737Aircon400Oh21=Object.freeze({
  getState:()=>({family,left:leftValue,right:window.B737OverheadToggles?.getState()?.['recirc-fan']??null,
   lamps:Object.fromEntries([...packNodes].map(([side,{node}])=>[side,node.dataset.state]))}),
  switchFamily:applyFamily,setLeft
 });
 boot();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/cpcs-v5.js?v=PRESS-OH22-0001&amp;cb=CB-UNIFIED-0001 */
try{
/* B737 Classic CPCS training module v5 (NOT DCPCS / EP-FSI installation).
 * Source-indexed FCOM 2.10.11-13, 2.40.1-2, .3, .5-.8, .10.
 * No undocumented relay/wiring, cabin physics or valve motion timings.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737CPCSV5=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const SOURCE={configuration:'FCOM 2.40.1 / DB page 1014 (CPCS listed for FSA, FSB, FSF, FSK, FSG, FST, FSE; FSI uses DCPCS)',control:'FCOM 2.10.11-13 / DB pages 992-994',sensors:'FCOM 2.40.1-3 / DB pages 1014-1016',automatic:'FCOM 2.40.6-8 / DB pages 1019-1021',standby:'FCOM 2.40.10 / DB page 1023',outflow:'FCOM 2.40.5 / DB page 1018',cabinHorn:'FCOM 2.10.11 / DB page 992'};
 const FAULTS=Object.freeze(['autoControllerFailed','standbyControllerFailed','autoAcPowerFailed','manualAcMotorFailed','dcMotorFailed','valveMechanismFailed','airGroundSensorInvalid','cabinSenseInvalid']);
 const INPUT_TYPES=Object.freeze({onGround:'boolean',acPowerAvailable:'boolean',dcPowerAvailable:'boolean',airplaneAltitudeFt:'number',cabinAltitudeFt:'number',cabinRateFtMin:'number',differentialPsid:'number',baroCaptainInHg:'number',baroFirstOfficerInHg:'number',recircFanOn:'boolean',mainOutflowNearlyClosed:'boolean',ambientPressureExceedsCabin:'boolean',bleedAirAvailable:'boolean',stallManagementSignalPresent:'boolean',offScheduleDescent:'boolean'});
 const LIMITS=Object.freeze({autoFailRateFtMin:1890,autoFailCabinAltitudeFt:13875,reliefPsid:8.65,flowValvePsid:2.5,standbyRatesFtMin:{DECR:50,INDEX:300,INCR:2000},groundFlightPressurizationOffsetFt:-200});
 const deepcopy=x=>JSON.parse(JSON.stringify(x));const own=(o,k)=>Object.prototype.hasOwnProperty.call(o,k);const validNumber=x=>typeof x==='number'&&Number.isFinite(x);
 function initial(){return {schema:'b737-cpcs/5',seq:0,clockMs:0,selectedMode:'AUTO',flightGround:'GRD',valveSwitch:'NEUTRAL',cabinRate:'INDEX',autoFailTriggered:false,autoCbLossSinceMs:null,events:[],faults:Object.fromEntries(FAULTS.map(x=>[x,false])),settings:{flightAltitudeFt:28000,landingAltitudeFt:0,standbyCabinAltitudeFt:0},inputs:{onGround:true,acPowerAvailable:true,dcPowerAvailable:true,airplaneAltitudeFt:0,cabinAltitudeFt:0,cabinRateFtMin:0,differentialPsid:0,baroCaptainInHg:29.92,baroFirstOfficerInHg:29.92,recircFanOn:false,mainOutflowNearlyClosed:false,ambientPressureExceedsCabin:false,bleedAirAvailable:true,stallManagementSignalPresent:true,offScheduleDescent:false}};}
 function validate(s){if(!s||s.schema!=='b737-cpcs/5'||!s.settings||!s.inputs||!s.faults||!Array.isArray(s.events))throw Error('Invalid CPCS state')}
 function faultsAndSignals(s){const i=s.inputs,f=s.faults;const cb=globalThis.B737UnifiedCB;const autoPower=cb?.available('press.autoAC')!==false&&cb?.available('press.autoDC')!==false;const cbLossConfirmed=!autoPower&&s.autoCbLossSinceMs!==null&&s.clockMs-s.autoCbLossSinceMs>=1000;const causes={autoAcPowerLoss:!i.acPowerAvailable||f.autoAcPowerFailed||cbLossConfirmed,excessiveCabinRate:Math.abs(i.cabinRateFtMin)>LIMITS.autoFailRateFtMin,highCabinAltitude:i.cabinAltitudeFt>LIMITS.autoFailCabinAltitudeFt,autoControllerFailed:f.autoControllerFailed};return {causes,anyAutoFailure:Object.values(causes).some(Boolean)};}
 function apply(state,command){validate(state);if(!command||typeof command.type!=='string')throw Error('Invalid CPCS command');if(command.type==='RESET')return initial();const s=deepcopy(state);switch(command.type){
 case 'MODE':if(!['AUTO','STBY','MAN_AC','MAN_DC'].includes(command.value))throw Error('Invalid CPCS selector mode');s.selectedMode=command.value;if(command.value==='STBY')s.autoFailTriggered=false;break;
 case 'AUTO_CHECK':if(command.pressed!==true)throw Error('CHECK is a momentary test request');if(s.selectedMode!=='AUTO')throw Error('AUTO CHECK only modeled with selector in AUTO');s.events.push({seq:s.seq+1,atMs:s.clockMs,command:{type:'AUTO_CHECK',pressed:true},policy:'CHECK_FUNCTION_NOT_SOURCE_SPECIFIED'});s.seq++;return s;
 case 'FLIGHT_GROUND':if(!['FLT','GRD'].includes(command.value))throw Error('Invalid FLT/GRD setting');s.flightGround=command.value;break;
 case 'VALVE_SWITCH':if(!['OPEN','CLOSE','NEUTRAL'].includes(command.value))throw Error('Invalid outflow switch');s.valveSwitch=command.value;break;
 case 'CABIN_RATE':if(!['DECR','INDEX','INCR'].includes(command.value))throw Error('Invalid cabin rate');s.cabinRate=command.value;break;
 case 'ALTITUDE':if(!['flightAltitudeFt','landingAltitudeFt','standbyCabinAltitudeFt'].includes(command.key)||!validNumber(command.value))throw Error('Invalid altitude setting');s.settings[command.key]=command.value;break;
 case 'INPUT':if(!own(INPUT_TYPES,command.key)||typeof command.value!==INPUT_TYPES[command.key]||(INPUT_TYPES[command.key]==='number'&&!validNumber(command.value)))throw Error('Invalid sourced sensor');s.inputs[command.key]=command.value;break;
 case 'FAULT':if(!FAULTS.includes(command.id)||typeof command.active!=='boolean'||command.instructor!==true)throw Error('Instructor-only CPCS fault');s.faults[command.id]=command.active;break;
 case 'ADVANCE':if(!Number.isInteger(command.ms)||command.ms<0||command.ms>600000)throw Error('Invalid elapsed time');s.clockMs+=command.ms;break;
 default:throw Error('Unknown CPCS command '+command.type);
 }
 // Wait out short CB initialization gaps before recording a real AUTO FAIL.
 const cb=globalThis.B737UnifiedCB;
 const cbLoss=cb?.available('press.autoAC')===false||cb?.available('press.autoDC')===false;
 if(cbLoss&&s.autoCbLossSinceMs===null)s.autoCbLossSinceMs=s.clockMs;
 else if(!cbLoss)s.autoCbLossSinceMs=null;
 const ff=faultsAndSignals(s);
 if(s.selectedMode==='AUTO'&&ff.anyAutoFailure)s.autoFailTriggered=true;
 s.seq++;s.events.push({seq:s.seq,atMs:s.clockMs,command:deepcopy(command)});if(s.events.length>400)s.events.shift();return s;
 }
 function derive(s){validate(s);const i=s.inputs,f=s.faults,ff=faultsAndSignals(s);const manuallySelected=s.selectedMode.startsWith('MAN_');
 const autoTrip=s.selectedMode==='AUTO'&&(s.autoFailTriggered||ff.anyAutoFailure);
 const operatingMode=manuallySelected?s.selectedMode:s.selectedMode==='STBY'||autoTrip?'STBY':'AUTO';
 const drive=operatingMode==='AUTO'?'AC':operatingMode==='STBY'?'DC':operatingMode==='MAN_AC'?'AC':'DC';
 const voltage=drive==='AC'?i.acPowerAvailable && (operatingMode==='AUTO'?!f.autoAcPowerFailed:!f.manualAcMotorFailed):i.dcPowerAvailable&&!f.dcMotorFailed;
 const controllerWorking=operatingMode==='AUTO'?!f.autoControllerFailed:operatingMode==='STBY'?!f.standbyControllerFailed:true;
 const required=operatingMode==='AUTO'?['autoAC','autoDC']:operatingMode==='STBY'?['standbyDC']:operatingMode==='MAN_AC'?['manualAC']:['manualDC'];
 const circuitAvailable=required.every(name=>globalThis.B737UnifiedCB?.available('press.'+name)!==false);
 const actuationAvailable=voltage&&controllerWorking&&!f.valveMechanismFailed&&circuitAvailable;
 const flightEffective=s.flightGround==='GRD'&&!i.onGround?'FLT':s.flightGround;
 let outflowCommand='HOLD_OR_UNDETERMINED';
 if(!actuationAvailable)outflowCommand='NO_ACTUATION_AVAILABLE';
 else if(manuallySelected)outflowCommand=s.valveSwitch;
 else if(flightEffective==='GRD')outflowCommand='DRIVE_FULL_OPEN';
 else if(i.onGround&&operatingMode==='STBY')outflowCommand='RATE_CONTROL_TO_SELECTED_CABIN_ALT';
 else if(i.onGround)outflowCommand='MODULATE_TOWARD_CLOSE_GROUND_PREPRESS';
 else if(operatingMode==='STBY')outflowCommand='RATE_CONTROL_TO_SELECTED_CABIN_ALT';
 else outflowCommand='AUTO_PRESSURE_SCHEDULE_NOT_NUMERICALLY_MODELED';
 const cabinTarget=operatingMode==='STBY'?s.settings.standbyCabinAltitudeFt:i.onGround&&flightEffective==='FLT'?i.airplaneAltitudeFt+LIMITS.groundFlightPressurizationOffsetFt:null;
 // AC-powered valve position indication is a *display*, not a physical position model.
 const valveIndicator=i.acPowerAvailable?'UNKNOWN_ACTUAL_POSITION':'FULL_LEFT_NO_AC';
 const fwdValveCloses=i.mainOutflowNearlyClosed||i.recircFanOn;
 const flowValveExhaust=i.onGround||i.differentialPsid<LIMITS.flowValvePsid;
 return {schema:'b737-cpcs-output/5',clockMs:s.clockMs,selectedMode:s.selectedMode,operatingMode,flightGroundRequested:s.flightGround,flightGroundEffective:flightEffective,standbyRateSelected:s.cabinRate,standbyRateTargetFtMin:LIMITS.standbyRatesFtMin[s.cabinRate],controller:{autoHealthy:!f.autoControllerFailed,standbyHealthy:!f.standbyControllerFailed,autoFailure:ff.causes,autoTrip,activeController:manuallySelected?'PILOT_MANUAL':operatingMode==='AUTO'?'AUTO_CONTROLLER':'STANDBY_CONTROLLER'},outflow:{drive,actuationAvailable,command:outflowCommand,manualSwitch:s.valveSwitch,display:valveIndicator,measuredPosition:'UNKNOWN',cabinTargetFt:cabinTarget},lamps:{autoFail:autoTrip,standby:operatingMode==='STBY',manual:manuallySelected,offSchedDescent:i.offScheduleDescent},relief:{positiveReliefAtLimit:i.differentialPsid>=LIMITS.reliefPsid,limitPsid:LIMITS.reliefPsid,negativeReliefRequired:i.ambientPressureExceedsCabin},airflow:{bleedAirAvailable:i.bleedAirAvailable,forwardValveClosedRequested:fwdValveCloses,flowValveExhaustRequested:flowValveExhaust},inputContract:{autoStaticPorts:'SOURCE_DESCRIBED_NOT_NUMERICALLY_INTERPRETED',standbyADC:'MIXED_CPCS_DCPCS_SECTION_NEEDS_VARIANT_QA',baroAuto:i.baroCaptainInHg,baroStby:i.baroFirstOfficerInHg,cabinSenseValid:!f.cabinSenseInvalid,airGroundSensorValid:!f.airGroundSensorInvalid,stallManagementComputerFunctionalSignal:i.stallManagementSignalPresent,stallManagementSignalPayload:'SOURCE_UNSPECIFIED'},cabAltitudeWarningSensorFt:i.cabinAltitudeFt,qa:{configuration:'CPCS_NOT_INSTALLED_ON_EP_FSI_FSI_DCPCS',physicalPressure:'NOT_CALCULATED',motorSpeed:'NOT_SOURCE_QUANTIFIED',valvePosition:'NOT_CALCULATED',faults:'INSTRUCTOR_TRAINING_FAULTS_NOT_HARDWARE_FAILURE_EFFECTS',autoCheck:'TEST_DETAILS_NOT_SOURCE_VERIFIED',source:SOURCE}};
 }
 function replay(commands){let s=initial();for(const cmd of commands)s=apply(s,cmd);return s;}
 return Object.freeze({SOURCE,FAULTS,INPUT_TYPES,LIMITS,initial,apply,derive,replay});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/dcpcs-v4.js?v=PRESS-OH22-0001&amp;cb=CB-UNIFIED-0001 */
try{
/* B737 Classic DCPCS systems/procedure trainer v4 — source-linked discrete logic.
 * Private DB: FCOM Sepehran 2.10.14-16 (pages 995-997), 2.40.1-11
 * (pages 1014-1024) and 15.20 Cabin Altitude warning.
 * DOES NOT simulate actual cabin pressure dynamics, physical valve rates or wiring.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737DCPCSV4=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const SOURCES=Object.freeze({indicators:'FCOM 2.10.14-16 / DB 995-997',controllers:'FCOM 2.40.1-2,7,9 / DB 1014-1015,1020,1022',manual:'FCOM 2.40.11 / DB 1024',relief:'FCOM 2.40.1 / DB 1014',horn:'FCOM 15.20 / source-indexed WarningEngine'});
 const FAULTS=Object.freeze(['controller1Fault','controller2Fault','outflowControlFault','pressureSensorInvalid','altitudeSensorInvalid','rateSensorInvalid']);
 const INPUT_TYPES=Object.freeze({onGround:'boolean',taxiIn:'boolean',dcPowerAvailable:'boolean',engineN1Pct:'number',engineN2Pct:'number',cabinAltitudeFt:'number',cabinRateFtMin:'number',cabinDifferentialPsid:'number',airplaneAltitudeFt:'number',flightAltitudeFt:'number',landingAltitudeFt:'number',controllerNotResponding:'boolean',descentBeforeCruise:'boolean'});
 const LIMITS=Object.freeze({prepressN1GreaterThan:60,prepressN2GreaterThan:89,prepressHoldMs:1500,taxiOpenN1LessThan:50,autoFailDiffGreaterThan:8.30,autoFailRateAbsGreaterThan:2000,autoFailCabinAltitudeGreaterThan:15800,mechanicalReliefPsid:8.65,maxSelectedFlightAltitudeFt:37000,cruiseLimitBelowEqual28000Psid:7.45,cruiseLimitAbove28000Psid:7.80,manualFullTravelIllustrativeMs:20000});
 const clone=v=>JSON.parse(JSON.stringify(v));
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 function initial(){return {schema:'b737-dcpcs/4',seq:0,clockMs:0,selector:'AUTO',manualCommand:'NEUTRAL',flightNumber:0,primary:1,autoFailLatched:false,acknowledged:false,prepressQualifiedSince:null,manualValveFraction:1,events:[],faults:Object.fromEntries(FAULTS.map(f=>[f,false])),input:{onGround:true,taxiIn:false,dcPowerAvailable:true,engineN1Pct:25,engineN2Pct:70,cabinAltitudeFt:0,cabinRateFtMin:0,cabinDifferentialPsid:0,airplaneAltitudeFt:0,flightAltitudeFt:28000,landingAltitudeFt:0,controllerNotResponding:false,descentBeforeCruise:false}};}
 function validateInput(k,v){if(!(k in INPUT_TYPES))throw Error('Unknown DCPCS input '+k);if(INPUT_TYPES[k]==='boolean'&&typeof v!=='boolean')throw Error('Expected Boolean for '+k);if(INPUT_TYPES[k]==='number'&&!finite(v))throw Error('Expected finite number for '+k);if((k==='flightAltitudeFt'&&(v < -1000||v>37000||v%500!==0))||(k==='landingAltitudeFt'&&(v < -1000||v>14000||v%50!==0)))throw Error('FCOM selector range/increment not met');}
 function apply(state,cmd){if(!state||state.schema!=='b737-dcpcs/4'||!cmd||typeof cmd.type!=='string')throw Error('Invalid DCPCS state/command');if(cmd.type==='RESET')return initial();const s=clone(state),i=s.input;
  switch(cmd.type){
   case 'INPUT':validateInput(cmd.key,cmd.value);i[cmd.key]=cmd.value;break;
   case 'MODE':if(!['AUTO','ALTN','MAN'].includes(cmd.value))throw Error('Invalid DCPCS mode');s.selector=cmd.value;if(cmd.value==='ALTN'&&s.autoFailLatched)s.acknowledged=true;if(cmd.value==='AUTO')s.acknowledged=false;break;
   case 'MANUAL_SWITCH':if(!['OPEN','CLOSE','NEUTRAL'].includes(cmd.value))throw Error('Invalid manual valve switch');s.manualCommand=cmd.value;break;
   case 'FAULT':if(!FAULTS.includes(cmd.id)||typeof cmd.active!=='boolean'||cmd.instructor!==true)throw Error('Instructor-only fault expected');s.faults[cmd.id]=cmd.active;break;
   case 'NEW_FLIGHT':s.flightNumber++;s.primary=s.primary===1?2:1;s.prepressQualifiedSince=null;s.autoFailLatched=false;s.acknowledged=false;s.selector='AUTO';s.manualCommand='NEUTRAL';break;
   case 'ADVANCE':if(!Number.isInteger(cmd.ms)||cmd.ms<0||cmd.ms>600000)throw Error('Invalid time delta');s.clockMs+=cmd.ms;break;
   default:throw Error('Unsupported DCPCS command '+cmd.type);
  }
  const qualified=i.onGround&&i.engineN1Pct>LIMITS.prepressN1GreaterThan&&i.engineN2Pct>LIMITS.prepressN2GreaterThan;
  if(!qualified)s.prepressQualifiedSince=null;else if(s.prepressQualifiedSince===null)s.prepressQualifiedSince=s.clockMs;
  // Instructor model uses explicit power/health inputs; not an inferred DC bus connection.
  const abnormalities=i.controllerNotResponding&&((!s.faults.pressureSensorInvalid&&i.cabinDifferentialPsid>8.30)||(!s.faults.rateSensorInvalid&&Math.abs(i.cabinRateFtMin)>2000)||(!s.faults.altitudeSensorInvalid&&i.cabinAltitudeFt>15800));
  const activeFault=s.faults['controller'+s.primary+'Fault'];
  if(s.selector!=='MAN'&&(!i.dcPowerAvailable||s.faults.outflowControlFault||abnormalities||activeFault))s.autoFailLatched=true;
  if(s.selector==='MAN'&&s.manualCommand!=='NEUTRAL'&&i.dcPowerAvailable&&globalThis.B737UnifiedCB?.available('press.manual')!==false&&!s.faults.outflowControlFault&&cmd.type==='ADVANCE'){
    // Deliberate trainer approximation: fixed upper-bound full travel, not a measured installed speed.
    const dx=cmd.ms/LIMITS.manualFullTravelIllustrativeMs*(s.manualCommand==='OPEN'?1:-1);
    s.manualValveFraction=Math.max(0,Math.min(1,s.manualValveFraction+dx));
  }
  s.seq++;s.events.push({seq:s.seq,atMs:s.clockMs,command:clone(cmd)});if(s.events.length>500)s.events.shift();return s;
 }
 function derive(s){if(!s||s.schema!=='b737-dcpcs/4')throw Error('Invalid DCPCS state');const i=s.input,f=s.faults,nominal=s.primary,other=nominal===1?2:1;
  const health={1:i.dcPowerAvailable&&globalThis.B737UnifiedCB?.available('press.auto1')!==false&&!f.controller1Fault&&!f.outflowControlFault,2:i.dcPowerAvailable&&globalThis.B737UnifiedCB?.available('press.auto2')!==false&&!f.controller2Fault&&!f.outflowControlFault};
  const thresholdProblem=i.controllerNotResponding&&((!f.pressureSensorInvalid&&i.cabinDifferentialPsid>8.30)||(!f.rateSensorInvalid&&Math.abs(i.cabinRateFtMin)>2000)||(!f.altitudeSensorInvalid&&i.cabinAltitudeFt>15800));
  const currentIsFailed=!health[nominal]||thresholdProblem;
  const autoTransferNeeded=s.autoFailLatched||currentIsFailed;
  const manual=s.selector==='MAN';
  let channel=manual?null:s.selector==='ALTN'?other:autoTransferNeeded?other:nominal;
  const channelHealthy=channel!==null&&health[channel]&&!(thresholdProblem&&channel===nominal);
  if(!channelHealthy)channel=null;
  const operatingMode=manual?'MAN':channel===null?'NO_AUTO_CONTROL':(channel===nominal?'AUTO':'ALTN');
  const autoFail= !manual && (autoTransferNeeded||!health[nominal]||!health[other]) && !(s.selector==='ALTN'&&channel!==null&&s.acknowledged);
  const altn= !manual && channel===other;
  const prepress=i.onGround&&i.engineN1Pct>60&&i.engineN2Pct>89&&s.prepressQualifiedSince!==null&&s.clockMs-s.prepressQualifiedSince>=1500;
  let outflow='UNDETERMINED_NO_PRESSURE_PHYSICS';
  if(manual)outflow=i.dcPowerAvailable&&globalThis.B737UnifiedCB?.available('press.manual')!==false&&!f.outflowControlFault?(s.manualCommand==='NEUTRAL'?'HOLD':s.manualCommand):'NO_DRIVE_AVAILABLE';
  else if(channel===null)outflow='NO_AUTO_COMMAND';
  else if(i.onGround)outflow=prepress?'MODULATE_TOWARD_CLOSED':(i.taxiIn&&i.engineN1Pct<50?'SLOWLY_OPEN_FULL':'DRIVE_FULL_OPEN_LOW_POWER');
  else outflow='AUTO_RATE_CONTROL_NO_NUMERIC_SCHEDULE';
  const detected={powerLoss:!i.dcPowerAvailable,controller1:f.controller1Fault,controller2:f.controller2Fault,outflowControl:f.outflowControlFault,controllerNotResponding:i.controllerNotResponding,
   differentialHigh:i.cabinDifferentialPsid>8.30,rateHigh:Math.abs(i.cabinRateFtMin)>2000,cabinAltitudeHigh:i.cabinAltitudeFt>15800,
   triggerByQualifiedAbnormality:thresholdProblem};
  return {clockMs:s.clockMs,selectedMode:s.selector,operatingMode,primary:nominal,activeController:channel,controllerHealthy:health,
   lamps:{autoFail,altn,manual,offSchedDescent:i.descentBeforeCruise},detected,
   prepressQualified:prepress,outflowCommand:outflow,manualValveFraction:s.manualValveFraction,
   relief:{limitPsid:8.65,aboveMechanicalReliefThreshold:i.cabinDifferentialPsid>8.65,mechanicalNotSoftwareControlled:true},
   maxCruiseDifferentialPsid:i.flightAltitudeFt<=28000?7.45:7.80,
   cabinHornSensorFt:i.cabinAltitudeFt,
   statuses:{pressureDynamics:'NOT_MODELED',manualTravel:'ILLUSTRATIVE_UPPER_BOUND_20S',dcPowerFeed:'EXPLICIT_TRAINER_INPUT_BUS_NOT_VERIFIED',engineSignals:'AGGREGATE_CHANNEL_UNKNOWN',sensorFaultHandling:'SOURCE_UNKNOWN_TRAINER_PROJECTION',dualControllerFailure:'AUTO_FAIL_ALONE_WHEN_NO_ALTN',source:SOURCES}};
 }
 function replay(commands){let s=initial();for(const c of commands)s=apply(s,c);return s;}
 return Object.freeze({SOURCES,FAULTS,INPUT_TYPES,LIMITS,initial,apply,derive,replay});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
