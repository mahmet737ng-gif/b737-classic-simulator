/* ASP AUDIO-RUNTIME-0001: independent station state + existing owner-approved controls.
 * No writes to any pinned overhead/IRS/guard or photo-asset files.
 * ALT/NORM hot-spots are invisible, registered to the existing switch aperture.
 * Pilot commands are logic only until verified aircraft bus and audio wiring exists.
 */
(function(root){'use strict';
 const Core=root.B737ASPAudioLogicV1;if(!Core){root.console?.error('ASP audio logic missing');return;}
 const seats=Core.SEATS;let state=Core.initialState(),powerMode='AIRCRAFT',panel=null;
 const copy=x=>JSON.parse(JSON.stringify(x));
 const getElectrical=()=>{
  try{return root.B737ISNCockpitV1?.getState?.()?.state?.electrical||null;}catch(_){return null;}
 };
 const read=()=>Core.project(state,{powerMode,electrical:getElectrical()});
 const send=(seat,type,fields={})=>{state=Core.apply(state,{seat,type,...fields});render();return read().stations[seat];};
 function setMode(seat,mode){return send(seat,'MODE',{value:mode});}
 function paint(){
  const data=read();
  for(const seat of seats){
   const host=document.querySelector('.asp-bare-mounted[data-seat="'+seat+'"]');
   if(!host)continue;
   const p=data.stations[seat];host.dataset.aspAudioMode=p.mode;
   // UI remains photographic: only existing illuminated-state flags are controlled.
   for(const b of host.querySelectorAll('.asp-photo-control')){
    const kind=b.dataset.kind,channel=b.dataset.channel;
    if(kind==='mic'){
     const lit=p.functional&&p.whiteMicLamp===channel;
     b.dataset.selected=String(Boolean(lit));b.setAttribute('aria-pressed',String(Boolean(lit)));
    }else{
     const lit=p.functional&&p.mode==='NORM'&&state.stations[seat].receivers[channel];
     b.dataset.selected=String(Boolean(lit));
     b.setAttribute('aria-valuetext',(state.stations[seat].volumes[channel]??50)+'%, '+(lit?'selected':'off'));
    }
    b.style.pointerEvents=p.mode==='ALT'?'none':'auto';
   }
   const hot=host.querySelector('[data-asp-alt-norm]');
   if(hot){hot.setAttribute('aria-label','ASP '+seat+' ALT NORM — '+p.mode);hot.title='ASP '+seat+' '+p.mode+' · click to select '+(p.mode==='NORM'?'ALT':'NORM');hot.setAttribute('aria-pressed',String(p.mode==='ALT'));}
  }
 }
 function render(){
  paint();
  if(panel){
   const data=read();
   for(const seat of seats){
    const p=data.stations[seat],row=panel.querySelector('[data-audio-seat="'+seat+'"]');
    if(!row)continue;
    row.querySelector('[data-status]').textContent=p.mode+' · '+(p.micSelection||'NO MIC')+' · '+(p.functional?'CONTROL OK':'FAULT')+' · '+(p.powerMode==='BENCH'?'BENCH':'AIRCRAFT POWER UNKNOWN');
    for(const mode of ['NORM','ALT'])row.querySelector('[data-mode="'+mode+'"]').setAttribute('aria-pressed',String(p.mode===mode));
   }
   panel.querySelector('[data-power-mode]').value=powerMode;
  }
  root.dispatchEvent(new CustomEvent('b737:asp-audio-state',{detail:{projection:read()}}));
 }
 function mount(){
  for(const seat of seats){
   const host=document.querySelector('.asp-bare-mounted[data-seat="'+seat+'"]');
   if(!host||host.querySelector('[data-asp-alt-norm]'))continue;
   const b=document.createElement('button');b.type='button';
   b.dataset.aspAltNorm=seat;
   b.style.cssText='position:absolute;left:84.6%;top:79.8%;width:8.7%;height:8.2%;transform:translate(-50%,-50%);margin:0;padding:0;opacity:0;border:0;background:transparent;cursor:pointer;z-index:5;touch-action:manipulation';
   b.addEventListener('pointerdown',e=>e.stopPropagation());
   b.addEventListener('click',e=>{e.stopPropagation();setMode(seat,state.stations[seat].mode==='NORM'?'ALT':'NORM');});
   host.append(b);
  }
  paint();
 }
 function buildPanel(){
  if(panel)return;const inspector=document.getElementById('inspector');if(!inspector)return;
  panel=document.createElement('section');panel.id='aspAudioDiagnostics';panel.dir='ltr';
  panel.style.cssText='border:1px solid #607888;border-radius:8px;padding:8px;margin:8px 0;font:11px/1.5 system-ui;display:grid;gap:7px;color:#dcebf5;background:#122531';
  const h=document.createElement('strong');h.textContent='ASP AUDIO · FCOM / MRG · PROCEDURE TRAINER';panel.append(h);
  const description=document.createElement('small');description.textContent='Three independent ALT/NORM circuits. LIVE bus/CB feed unverified; BENCH is instructor-only simulation.';panel.append(description);
  const select=document.createElement('select');select.dataset.powerMode='';
  for(const [val,label] of [['AIRCRAFT','AIRCRAFT (unverified equipment power)'],['BENCH','BENCH simulated power']]){
   const op=document.createElement('option');op.value=val;op.textContent=label;select.append(op);
  }select.onchange=()=>{powerMode=select.value;render();};panel.append(select);
  for(const seat of seats){
   const row=document.createElement('div');row.dataset.audioSeat=seat;row.style.cssText='border-top:1px solid #45606e;padding-top:4px;';
   const title=document.createElement('b');title.textContent=seat+' ';row.append(title);
   for(const mode of ['NORM','ALT']){
    const btn=document.createElement('button');btn.type='button';btn.dataset.mode=mode;btn.textContent=mode;btn.style.cssText='padding:3px 6px;margin:2px';
    btn.onclick=()=>setMode(seat,mode);row.append(btn);
   }
   const status=document.createElement('div');status.dataset.status='';row.append(status);panel.append(row);
  }
  inspector.prepend(panel);render();
 }
 // Existing mic/receiver buttons dispatch this physical event. We own only audio logic.
 root.addEventListener('b737:asp-control',e=>{
  const d=e.detail||{},seat=d.seat,channel=d.channel;
  if(!seats.includes(seat))return;
  const item=Core.RECEIVERS.includes(channel);
  if(!item)return;
  try{
   if(d.kind==='mic')send(seat,'SELECT_MIC',{channel});
   else if(d.kind==='volume'){
    send(seat,'RECEIVER',{channel,selected:Boolean(d.selected)});
    if(Number.isFinite(Number(d.volume)))send(seat,'VOLUME',{channel,value:Number(d.volume)});
   }
  }catch(err){root.console?.warn?.('ASP command rejected',err);}
  // Existing UI initially updates itself. Re-project from backend immediately.
  paint();
 });
 function boot(){mount();buildPanel();root.addEventListener('b737:cockpit-mounted',()=>{mount();buildPanel();render();});
  const observer=new MutationObserver(()=>{if(!seats.every(s=>document.querySelector('.asp-bare-mounted[data-seat="'+s+'"] [data-asp-alt-norm]')))mount();});
  observer.observe(document.getElementById('scene')||document.body,{subtree:true,childList:true});
  root.setInterval(()=>{if(document.getElementById('aspAudioDiagnostics'))render();},1500);
 }
 root.B737ASPAudioRuntimeV1=Object.freeze({
  setMode,getProjection:read,getState:()=>copy(state),
  setPowerMode(mode){if(!['AIRCRAFT','BENCH'].includes(mode))throw Error('Invalid ASP power mode');powerMode=mode;render();},
  dispatch(seat,type,fields){return send(seat,type,fields);},
  setMicSource(seat,microphone){return send(seat,'MIC_SOURCE',{value:microphone});},
  press(seat,value){return send(seat,'PTT',{value});},
  instructorFault(seat,fault,active){return send(seat,'FAULT',{fault,active,instructor:true});},
  diagnostics:()=>({powerEvidence:Core.powerEvidence(getElectrical()),cbCandidates:Core.CB_CANDIDATES,status:'CB_MAPPING_QUARANTINED'})
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);
