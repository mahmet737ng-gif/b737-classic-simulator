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
 let testHold=null,lastNativeInput=null;
 const owner=()=>root.B737ISNCockpitV1;
 const frame=()=>document.getElementById('overheadFrame');
 function paintPneumaticImmediately(derived){
  // Same-origin original OH21 lamp engine already supports the single ECU's
  // authoritative pneumatic snapshot. Apply the qualified ON/OFF directly
  // in the iframe to avoid an extra asynchronous postMessage render cycle.
  // The existing refresh() still broadcasts Six-Pack/400 status normally.
  try{
   frame()?.contentWindow?.B737OverheadLights
    ?.setAuthoritativePneumatics?.({lamps:derived.lamps});
  }catch(error){console.warn('OVHT direct visual projection fallback',error)}
 }
 function ovhtQualifier(){
  if(testHold)return testHold;
  const core=root.B737AirconOVHTQualificationV1;
  if(!core?.create)throw Error('AIRCON OVHT 5-second qualification core not loaded');
  testHold=core.create({
   clock:()=>performance.now(),
   onQualified:()=>{
    // Only AFTER five uninterrupted seconds should the pneumatic owner
    // receive a qualified detector-test signal; real leak sensors are
    // independent and continue to respond immediately.
    const out=command({type:'SENSOR',key:'wingBodyTestHeld',value:true});
    paintPneumaticImmediately(out);
    lastNativeInput={id:'aircon-ovht-test',held:true,qualified:true,
     durationMs:core.DELAY_MS,l:out.lamps.wingBodyOverheatL,
     r:out.lamps.wingBodyOverheatR};
    if(actionNotice)actionNotice.textContent='OVHT TEST QUALIFIED · 5.0 s · WING BODY L/R '+
     Number(out.lamps.wingBodyOverheatL)+'/'+Number(out.lamps.wingBodyOverheatR);
    refresh(true);
   },
   onReleased:()=>{
    const out=command({type:'SENSOR',key:'wingBodyTestHeld',value:false});
    paintPneumaticImmediately(out);
    lastNativeInput={id:'aircon-ovht-test',held:false,qualified:false,
     durationMs:0,l:out.lamps.wingBodyOverheatL,r:out.lamps.wingBodyOverheatR};
    refresh(true);
   }
  });
  return testHold;
 }
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
  help.textContent='OVHT TEST · keep the original P5-10 button continuously pressed for 5 seconds. Test lamps remain DARK until qualification; real overheats are immediate. Clear initiating faults before TRIP RESET. Model 400 includes independent ZONE TEMP and Recall channels.';
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
   const h=testHold?.snapshot();
   const testLabel=h?.held?(h.qualified?'QUALIFIED ≥5s':
    'HOLDING '+(h.elapsedMs/1000).toFixed(1)+' / 5.0s'):'RELEASED';
   summary.textContent='MODEL '+variant+' · TRIP LATCHES '+count+
    ' · OVHT TEST '+testLabel+
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
  // Native P5-10 recessed pushbuttons are already installed on the
  // owner-approved OH21 photo. They emit recessed-button, not the retired
  // aircon-fcom-input event from an incorrect, overlapping transparent hit.
  if(e.data.kind!=='recessed-button')return;
  const d=e.data;
  if(d.source!=='recessed-hardware-v2'||typeof d.pressed!=='boolean')return;
  try{
   if(d.id==='aircon-ovht-test'){
    const hold=ovhtQualifier();
    const before=hold.snapshot();
    if(d.pressed){
     if(before.held)return;
     // Deliberately no wingBodyTestHeld=true command on PRESS.
     // The timer qualifies only after 5 seconds without release.
     // Convert the originating frame's monotonic press time to our own
     // monotonic clock. This subtracts any accumulated cross-frame queue
     // delay before scheduling the 5000-ms qualification deadline.
     const epoch=Number(d.physicalEpochMs);
     const now=performance.now();
     const physicalStart=Number.isFinite(epoch)&&Number.isFinite(performance.timeOrigin)
      ?epoch-performance.timeOrigin:now;
     const validStart=physicalStart<=now&&now-physicalStart<=60000?physicalStart:now;
     const physicalHold=hold.press(validStart);
     lastNativeInput={id:d.id,held:true,qualified:physicalHold.qualified,
      durationMs:physicalHold.elapsedMs,messageLatencyMs:Math.max(0,now-validStart)};
     if(actionNotice&&!physicalHold.qualified)
      actionNotice.textContent='OVHT TEST HELD · WAITING '+
       (physicalHold.remainingMs/1000).toFixed(1)+' s · WING BODY TEST OFF';
    }else{
     if(!before.held)return;
     const durationMs=before.elapsedMs,passed=before.qualified;
     hold.release();
     lastNativeInput={id:d.id,held:false,qualified:false,
      durationMs,l:latest?.derived?.lamps?.wingBodyOverheatL??false,
      r:latest?.derived?.lamps?.wingBodyOverheatR??false};
     if(actionNotice)actionNotice.textContent='OVHT TEST '+(passed?'5 SECOND CHECK COMPLETE':'RELEASED BEFORE 5 SECONDS')+
      ' · '+Math.round(durationMs)+' ms';
    }
   }else if(d.id==='trip-reset'){
    if(!d.pressed)return; // reset only on PRESS, never on release
    command({type:'TRIP_RESET'});
    lastNativeInput={id:d.id,pressed:true};
    if(actionNotice)actionNotice.textContent='TRIP RESET · initiating fault must be cleared';
   }else return;
   refresh(true);
  }catch(err){
   // Do not leave the parent stuck in the "held" state on a rejected
   // source command (e.g. iframe ready before the deferred ECU dependency).
   if(d.id==='aircon-ovht-test'&&d.pressed===false)testHold?.release();
   if(actionNotice)actionNotice.textContent='AIRCON FCOM ERROR · '+err.message;
   console.error('AIRCON FCOM native recessed input',err);
  }
 });
 for(const name of ['b737:unified-ecu-observation','b737:electrical-owner-ready',
  'b737:aircraft-profile-change','b737:cockpit-mounted'])
  root.addEventListener(name,()=>refresh());
 const releaseTest=()=>{
  try{testHold?.release();}catch(error){console.warn('OVHT fail-safe release',error)}
 };
 root.addEventListener('blur',releaseTest);
 root.addEventListener('pagehide',releaseTest);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseTest()});
 frame()?.addEventListener('load',()=>{releaseTest();last='';refresh(true);});
 root.B737AirconFCOMUnifiedV1=Object.freeze({
  getState:()=>latest?{family:family(),state:latest.state,derived:latest.derived,
   nativeInput:lastNativeInput,ovhtTest:testHold?.snapshot()||
     {held:false,qualified:false,remainingMs:0,delayMs:5000}}:null,
  setFailure:setInput,resetTrip:()=>command({type:'TRIP_RESET'}),refresh
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>refresh(true),{once:true});
 else refresh(true);
})(window);
