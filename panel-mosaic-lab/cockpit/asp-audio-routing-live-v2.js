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
    b.onclick=()=>{Runtime.press(seat,ptt);refresh();};control.append(b);
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