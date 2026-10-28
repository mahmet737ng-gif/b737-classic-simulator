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
 function makeSwitch(host,seat,kind){
  const c=Model.CONTROLS[kind];
  const button=document.createElement('button');
  button.type='button';button.className='asp-physical-switch';
  button.dataset.aspPhysicalKind=kind;button.dataset.seat=seat;
  button.style.left=(c.x/1122*100)+'%';button.style.top=(c.y/888*100)+'%';
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
