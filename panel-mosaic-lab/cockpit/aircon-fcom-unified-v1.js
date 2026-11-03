/* AIRCON-FCOM-0001. Unified instructor and OH21 physical P5-10 integration.
 * EXISTING ISN 13/18 ECU -> Pneumatics V6 is the sole plant.
 * FCOM 2.10.2–10, 2.20.5, SP.2.1; training semantics, not flight use.
 */
(function(root){
 'use strict';
 const pneumatic=()=>root.B737PneumaticsV6;
 const PROFILE_KEY='b737classic.aircraft-profile.v1';
 const SENSORS=Object.freeze([
  ['bleed1Overlimit','L BLEED · overpressure / overtemperature','BOTH'],
  ['bleed2Overlimit','R BLEED · overpressure / overtemperature','BOTH'],
  ['packLOverheat','L PACK · overheat / trip','BOTH'],
  ['packROverheat','R PACK · overheat / trip','BOTH'],
  ['wingBodyLLeakDetected','L WING-BODY · real duct leak / overheat','BOTH'],
  ['wingBodyRLeakDetected','R WING-BODY · real duct leak / overheat','BOTH'],
  ['wingBodyLDetectorFailed','L WING-BODY · broken detector test circuit','BOTH'],
  ['wingBodyRDetectorFailed','R WING-BODY · broken detector test circuit','BOTH'],
  ['ductLOverheat','L DUCT OVERHEAT · mix valve full cold','B737-300-500'],
  ['ductROverheat','R DUCT OVERHEAT · mix valve full cold','B737-300-500'],
  ['zoneContOverheat','CONT CAB ZONE TEMP · duct overheat','B737-400'],
  ['zoneFwdOverheat','FWD CAB ZONE TEMP · duct overheat','B737-400'],
  ['zoneAftOverheat','AFT CAB ZONE TEMP · duct overheat','B737-400'],
  ['packLPrimaryControlFailed','L PACK primary controller failure · recall only','B737-400'],
  ['packLStandbyControlFailed','L PACK standby controller failure · recall only','B737-400'],
  ['packRPrimaryControlFailed','R PACK primary controller failure · recall only','B737-400'],
  ['packRStandbyControlFailed','R PACK standby controller failure · recall only','B737-400'],
  ['contPrimaryTempControlFailed','CONT CAB primary temperature controller','B737-400'],
  ['contStandbyTempControlFailed','CONT CAB standby temperature controller','B737-400'],
  ['fwdTempControlFailed','FWD CAB temperature control failure · recall only','B737-400'],
  ['aftTempControlFailed','AFT CAB temperature control failure · recall only','B737-400']
 ]);
 let section=null,inputs=new Map(),summary=null,latest=null,last='',lastFrame=null,actionNotice=null;
 const owner=()=>root.B737ISNCockpitV1;
 const frame=()=>document.getElementById('overheadFrame');
 function family(){
  try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')?.aircraftFamily==='B737-400'?'B737-400':'B737-300-500';}
  catch{return 'B737-300-500';}
 }
 function command(action){
  if(typeof owner()?.sendPneumatic!=='function')throw Error('Live pneumatic ECU is not ready');
  return owner().sendPneumatic(action);
 }
 function setInput(key,value){
  if(!SENSORS.some(([id])=>id===key)||typeof value!=='boolean')
   throw Error('Unsupported AIR COND training sensor');
  return command({type:'SENSOR',key,value});
 }
 function makeControls(){
  if(section?.isConnected)return;
  const holder=document.querySelector('#inspector .overhead-tools')||document.getElementById('inspector');
  if(!holder)return;
  section=document.createElement('section');section.id='airconFCOMLab';
  section.setAttribute('dir','ltr');
  const title=document.createElement('h2');title.textContent='AIR CONDITIONING · FCOM TEST & FAILURES';section.append(title);
  const help=document.createElement('p');help.className='muted';
  help.textContent='OVHT TEST is a momentary P5-10 detector test; hold 5 seconds for the FCOM check. Real faults require cause removal, then TRIP RESET. 400 has ZONE TEMP and controller recall differences.';
  section.append(help);
  summary=document.createElement('p');summary.id='airconFCOMStatus';summary.setAttribute('role','status');section.append(summary);
  for(const [id,label,variant]of SENSORS){
   const row=document.createElement('label');row.dataset.family=variant;
   row.style.cssText='display:flex;align-items:center;gap:7px;margin:5px 0;font-size:11px';
   const checkbox=document.createElement('input');checkbox.type='checkbox';checkbox.dataset.airconFailure=id;
   checkbox.addEventListener('change',()=>{
    try{setInput(id,checkbox.checked);actionNotice.textContent='Sensor '+id+' = '+checkbox.checked;}
    catch(e){checkbox.checked=!checkbox.checked;actionNotice.textContent=e.message;}
    refresh(true);
   });
   row.append(checkbox,document.createTextNode(label));section.append(row);
   inputs.set(id,{row,checkbox,variant});
  }
  const row=document.createElement('div');row.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-top:9px';
  const reset=document.createElement('button');reset.type='button';reset.textContent='TRIP RESET';
  reset.addEventListener('click',()=>{
   try{command({type:'TRIP_RESET'});actionNotice.textContent='Trip reset requested; active faults remain latched.';}
   catch(e){actionNotice.textContent=e.message;}
   refresh(true);
  });
  row.append(reset);section.append(row);
  actionNotice=document.createElement('p');actionNotice.className='muted';actionNotice.setAttribute('role','status');section.append(actionNotice);
  holder.append(section);
 }
 function live(){
  const s=owner()?.getPneumaticState?.();if(!s||!pneumatic()?.derive)return null;
  return {state:s,derived:pneumatic().derive(s)};
 }
 function refresh(force=false){
  makeControls();
  const real=live();if(!real)return null;
  const variant=family();
  if(real.state.controls.aircraftFamily!==variant){
   // Only synchronize the aircraft variant; never reset fault latches or ECU.
   command({type:'CONTROL',key:'aircraftFamily',value:variant});
   return refresh(true);
  }
  latest=real;
  const payload={
   family:variant,lamps:real.derived.lamps,pack400:real.derived.pack400,
   zones:real.derived.zoneTemp400,inputs:{
    wingBodyTestHeld:real.state.inputs.wingBodyTestHeld
   },latched:real.state.latched
  };
  const signature=JSON.stringify(payload);
  const newFrame=frame()?.contentWindow||null;
  if(signature!==last||newFrame!==lastFrame||force){
   last=signature;lastFrame=newFrame;
   if(newFrame)newFrame.postMessage({type:'b737:cockpit-command',
    action:'aircon-fcom-projection',payload},location.origin);
   root.dispatchEvent(new CustomEvent('b737:aircon-fcom-status',{detail:payload}));
  }
  if(section?.isConnected){
   for(const [id,{row,checkbox,variant:scope}] of inputs){
    row.hidden=scope!=='BOTH'&&scope!==variant;
    checkbox.checked=real.state.inputs[id]===true;
   }
   const count=Object.values(real.state.latched).filter(Boolean).length;
   summary.textContent='MODEL '+variant+' · TRIP LATCHES '+count+
    ' · OVHT TEST '+(real.state.inputs.wingBodyTestHeld?'HELD':'RELEASED')+
    ' · L/R WING-BODY '+Number(real.derived.lamps.wingBodyOverheatL)+'/'+
    Number(real.derived.lamps.wingBodyOverheatR);
  }
  return payload;
 }
 root.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==frame()?.contentWindow||
     e.data?.type!=='b737:cockpit-overhead')return;
  // The iframe may have discarded an early projection before its physical
  // lamps and OH20 400 zone overlay became ready. Re-send exactly at READY;
  // do NOT echo on every controls-state/status report (would loop).
  if(e.data.kind==='ready'){last='';refresh(true);return;}
  if(e.data.kind!=='aircon-fcom-input')return;
  const d=e.data;
  try{
   if(d.id==='OVHT_TEST'&&typeof d.held==='boolean')
    command({type:'SENSOR',key:'wingBodyTestHeld',value:d.held});
   else if(d.id==='TRIP_RESET')command({type:'TRIP_RESET'});
   else return;
   if(d.id==='OVHT_TEST'&&d.held===false&&actionNotice){
    actionNotice.textContent='OVHT TEST '+(d.durationMs>=5000?'5 SECOND CHECK COMPLETED':'RELEASED BEFORE 5 SECONDS')+
     ' · '+Math.round(d.durationMs||0)+' ms';
   }
   refresh(true);
  }catch(err){if(actionNotice)actionNotice.textContent=err.message;console.warn('AIRCON FCOM input',err);}
 });
 for(const name of ['b737:unified-ecu-observation','b737:electrical-owner-ready',
  'b737:aircraft-profile-change','b737:cockpit-mounted'])
  root.addEventListener(name,()=>refresh());
 frame()?.addEventListener('load',()=>{last='';refresh(true);});
 root.B737AirconFCOMUnifiedV1=Object.freeze({
  getState:()=>latest?{family:family(),state:latest.state,derived:latest.derived}:null,
  setFailure:setInput,resetTrip:()=>command({type:'TRIP_RESET'}),refresh
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>refresh(true),{once:true});
 else refresh(true);
})(window);
