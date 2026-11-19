(async()=>{
;
/* ./asp-audio-routing-live-v2.js?v=ASP-ROUTE-0002 */
try{
/* ASP live routing v2: read-only V7/CB provenance + shared virtual RF signals.
 * Separate from locked photo artwork. All emitted signals are trainer metadata only.
 */
(function(root){'use strict';const Routing=root.B737ASPAudioRoutingV2,Audit=root.B737ASPCBSourceAuditV2;
 const Runtime=root.B737ASPAudioRuntimeV1;
 if(!Routing||!Audit||!Runtime)return;
 const radioStatus={},signals={},RADIOS=['VHF-1','VHF-2','VHF-3','HF-1'];
 let panel=null,speakerInhibitOnTransmit=false;
 function electrical(){
  try{return root.B737ISNCockpitV1?.getState?.()?.state?.electrical||null;}catch(_){return null;}
 }
 function audit(){return Audit.examine({catalog:root.CB_CATALOG||null,
  cbNetwork:root.B737_CB_Electrical?.network||null,electrical:electrical()});}
 function snapshot(){
  const base=Runtime.getProjection();
  return Routing.compute(Runtime.getState(),{powerMode:base.stations.CAPT.powerMode,
   electrical:electrical(),radioStatus,signals,speakerInhibitOnTransmit,
   cbEvidence:audit()});
 }
 function refresh(){
  if(panel){
   const p=snapshot();
   for(const seat of ['CAPT','FO','OBS']){
    const o=p.stations[seat],row=panel.querySelector('[data-route-seat="'+seat+'"]');
    if(row)row.textContent=seat+' '+o.mode+' | TX '+(o.transmitter.channel||'—')+
      ' ['+o.transmitter.routeStatus+'] | RX '+o.headset.channels.map(x=>x.channel).join(', ')+
      ' | CB '+o.electrical.cb.sourceStatus;
   }
  }
 }
 function instructorStatus(channel,status){
  if(!RADIOS.includes(channel)||!Routing.RADIO_STATUSES.includes(status))throw Error('Invalid instructor RF fault');
  radioStatus[channel]=status;refresh();return snapshot();
 }
 function setSignal(channel,value){
  if(![...RADIOS,'PA','FLT INT','SERV INT','NAV-1','NAV-2','ADF-1','ADF-2','MKR'].includes(channel)||
    ![true,false,null].includes(value))throw Error('Invalid trainer signal');
  signals[channel]=value;refresh();return snapshot();
 }
 function boot(){
  const container=document.getElementById('inspector');
  if(!container)return;
  panel=document.createElement('section');panel.id='aspAudioRouteV2';panel.dir='ltr';
  panel.style.cssText='border:1px solid #597481;background:#13232b;color:#d8e8ec;border-radius:9px;margin:7px 0;padding:9px;font:11px/1.55 system-ui';
  const title=document.createElement('strong');title.textContent='ASP V2 · ROUTING + CB EVIDENCE';panel.append(title);
  const note=document.createElement('p');note.textContent='RF failure / PTT tests are instructor simulations only. Actual ASP CB feeds: quarantined (MRG vs photo conflict).';panel.append(note);
  for(const seat of ['CAPT','FO','OBS']){
   const row=document.createElement('div');row.dataset.routeSeat=seat;row.style.cssText='padding:5px 0;border-top:1px solid #364d58';panel.append(row);
   const control=document.createElement('div');
   for(const [name,ptt] of [['R/T','ASP_RT'],['I/C','ASP_IC'],['RELEASE',null]]){
    const b=document.createElement('button');b.type='button';b.textContent=seat+' '+name;
    b.style.cssText='margin:1px;padding:3px 5px;background:#274653;color:white;border:1px solid #728994;border-radius:4px';
    if(ptt===null){
     b.onclick=()=>{Runtime.press(seat,null);refresh();};
    }else{
     let active=false;
     const press=()=>{if(active)return;active=true;Runtime.press(seat,ptt);refresh();};
     const release=()=>{if(!active)return;active=false;Runtime.press(seat,null);refresh();};
     b.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();press();try{b.setPointerCapture(e.pointerId);}catch(_){}});
     b.addEventListener('pointerup',release);
     b.addEventListener('pointercancel',release);
     b.addEventListener('lostpointercapture',release);
     b.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();press();}});
     b.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();release();}});
     b.addEventListener('blur',release);
     root.addEventListener('blur',release);
     b.onclick=e=>e.preventDefault(); // no toggle-on-click
    }
    control.append(b);
   }panel.append(control);
  }
  const controls=document.createElement('div');controls.style.cssText='margin-top:6px;border-top:1px solid #465c69;padding-top:6px';
  const rf=document.createElement('select');rf.setAttribute('aria-label','Instructor RF status target');
  for(const name of RADIOS){const opt=document.createElement('option');opt.value=name;opt.textContent=name;rf.append(opt);}
  const state=document.createElement('select');state.setAttribute('aria-label','Instructor RF availability');
  for(const name of Routing.RADIO_STATUSES){const opt=document.createElement('option');opt.value=name;opt.textContent=name;state.append(opt);}
  const apply=document.createElement('button');apply.textContent='Inject RF status';apply.onclick=()=>instructorStatus(rf.value,state.value);
  for(const el of [rf,state,apply]){el.style.margin='2px';controls.append(el);}
  panel.append(controls);container.prepend(panel);
  root.addEventListener('b737:asp-audio-state',refresh);
  root.setInterval(refresh,2000);refresh();
 }
 const API=Object.freeze({getRouting:snapshot,getCBSourceAudit:audit,
  setRadioStatus:instructorStatus,setInputSignal:setSignal,
  setSpeakerMutePolicy(value){if(typeof value!=='boolean')throw Error('Boolean policy required');speakerInhibitOnTransmit=value;refresh();},
  setPtt(seat,value){Runtime.press(seat,value);refresh();return snapshot();},
  getConfiguration:()=>({speakerInhibitOnTransmit,rfStatuses:{...radioStatus},signals:{...signals}})});
 root.B737ASPAudioRoutingLiveV2=API;
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
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
/* ./asp-physical-controls-v1.js?v=ASP-PHYSICAL-0001-VIEWBOX-0005 */
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
/* ./asp-vbr-model-v1.js?v=ASP-VBR-SILVER-0001 */
try{
/* Three physical V/B/R detents; image index is the recessed upper notch. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.B737ASPVBRModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const positions=Object.freeze(['V','B','R']),angles=Object.freeze([-45,0,45]);
 const socket=Object.freeze({x:702,y:747,hit:150,baseDiameter:104});
 const image=Object.freeze({width:1254,height:1254,pivotX:626.6753137115194,pivotY:601.4506340581195,baseDiameter:808.6592505372294});
 function create(){
  const state=new Map(['CAPT','FO','OBS'].map(s=>[s,1]));
  function read(seat){if(!state.has(seat))throw Error('Unknown ASP station');const index=state.get(seat);return Object.freeze({seat,index,position:positions[index],angle:angles[index]});}
  function select(seat,index){read(seat);if(!Number.isInteger(index))throw Error('Invalid VBR detent');state.set(seat,Math.max(0,Math.min(2,index)));return read(seat);}
  return Object.freeze({read,select,step(seat,delta){if(!Number.isInteger(delta))throw Error('Invalid VBR step');return select(seat,read(seat).index+delta);}});
 }
 return Object.freeze({version:'ASP-VBR-SILVER-0001',positions,angles,socket,image,create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
