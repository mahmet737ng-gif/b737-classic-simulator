(async()=>{
;
/* ./cb-panel-entry-v1.js?v=CB-ENTRY-CB-SYNC-0002-FOUR-FLASH-0001&amp;cb=CB-UNIFIED-0001 */
try{
/* CB-ENTRY-0001. The CB panel is an independent full-screen view.
   No cockpit switch coordinates, protected assets or simulation state are modified. */
(function(){
 'use strict';
 const open=document.getElementById('cbPanelOpen');
 const dialog=document.getElementById('cbPanelDialog');
 const close=document.getElementById('cbPanelClose');
 const frame=document.getElementById('cbPanelFrame');
 if(!open||!dialog||!close||!frame)return;
 function openCB(){
  if(!frame.getAttribute('src'))frame.src=new URL('../../cb-panel-lab/?v=CB-SIXPACK-FUEL-ANTIICE-0002',document.baseURI).href;
  if(typeof dialog.showModal==='function'&&!dialog.open)dialog.showModal();
  else if(typeof dialog.showModal!=='function')location.assign(frame.src);
 }
 function closeCB(){if(dialog.open)dialog.close();
  // Reconcile persisted pulls before painting the now-visible cockpit.
  // Also covers browsers which postpone cross-frame message delivery.
  window.B737UnifiedCB?.refresh?.();
 }
 open.addEventListener('click',openCB);
 close.addEventListener('click',closeCB);
 dialog.addEventListener('click',e=>{if(e.target===dialog)closeCB();});
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./aircon-300500-slim-knob-unified-v1.js?v=AIRCON-300500-ROUND-0004 */
try{
/* 737-300/500 Unified only: place the owner's photo-extracted slim black
 * temperature selector on the two EXISTING OH20 rotary controls. No new hit
 * targets; no changes to the locked overhead atlas or Owner18 guards.
 */
(function(){
 'use strict';
 const ids=['control-cabin-temp','pass-cabin-temp'];
 const asset=new URL('./assets/aircon-300500-owner-approved-round-knob-v3.webp',document.baseURI).href;
 const originals=new WeakMap();
 const key='b737classic.aircraft-profile.v1';
 const propNames=['left','top','width','height','transform-origin','object-fit','scale'];
 function family(doc){
  if(doc.documentElement.classList.contains('b737-aircon400'))return 'B737-400';
  if(doc.documentElement.classList.contains('b737-aircon300500'))return 'B737-300-500';
  try{return JSON.parse(localStorage.getItem(key)||'null')?.aircraftFamily==='B737-400'?'B737-400':'B737-300-500';}
  catch{return 'B737-300-500';}
 }
 function save(el){
  if(originals.has(el))return originals.get(el);
  if(!el.getAttribute('src'))return null;
  const state={src:el.getAttribute('src'),styles:Object.fromEntries(propNames.map(name=>[name,{value:el.style.getPropertyValue(name),priority:el.style.getPropertyPriority(name)}]))};
  originals.set(el,state);
  return state;
 }
 function restore(el){
  const state=originals.get(el);if(!state)return;
  if(el.getAttribute('src')!==state.src)el.setAttribute('src',state.src);
  for(const name of propNames){const p=state.styles[name];if(p.value)el.style.setProperty(name,p.value,p.priority);
   else el.style.removeProperty(name);}
  delete el.dataset.aircon300500Approved;
 }
 function fit(btn,img){
  const w=parseFloat(btn.style.width),h=parseFloat(btn.style.height);
  if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0)return false;
  // The physical pivot remains exactly the existing OH20 rotary socket center.
  // Owner-approved transparent round knob (192x192): its full central base\n  // covers the recessed hole at the reference-photo scale (diameter =\n  // original control hit-area width), without moving the socket/pivot.
  const imageW=w,imageH=imageW;
  img.style.setProperty('width',imageW+'px');
  img.style.setProperty('height',imageH+'px');
  img.style.setProperty('left',(w-imageW)/2+'px');
  img.style.setProperty('top',(h-imageH)/2+'px');
  img.style.setProperty('transform-origin','50% 50%');
  img.style.setProperty('object-fit','fill');
  img.style.setProperty('scale','1','important');
  return true;
 }
 function sync(){
  let frame,child;
  try{frame=document.getElementById('overheadFrame');child=frame?.contentDocument;}catch{return;}
  if(!child||!child.documentElement)return;
  const selectedFamily=family(child);
  for(const id of ids){
   const btn=child.querySelector('#rotaryGuardLayer .mounted-rotary[data-control="'+id+'"]');
   const image=btn?.querySelector('img.rotary-picture');
   if(!image||!save(image))continue;
   if(selectedFamily!=='B737-300-500'){if(image.dataset.aircon300500Approved==='true')restore(image);continue;}
   if(!fit(btn,image))continue;
   if(image.getAttribute('src')!==asset)image.setAttribute('src',asset);
   image.dataset.aircon300500Approved='true';
  }
 }
 function boot(){
  const frame=document.getElementById('overheadFrame');
  frame?.addEventListener('load',sync);
  window.addEventListener('storage',e=>{if(e.key===key)sync();});
  window.addEventListener('message',e=>{if(e.origin===location.origin&&e.source===frame?.contentWindow&&e.data?.type==='b737:cockpit-overhead'&&e.data.kind==='ready')sync();});
  // The frame mounts controls asynchronously after its 'load' event.
  // Periodic idempotent reconciliation also follows Settings changes.
  setInterval(sync,700);sync();
 }
 window.B737Aircon300500SlimKnobsV1=Object.freeze({sync,getAsset:()=>asset,ids:Object.freeze([...ids])});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/aircon-ovht-hold-v1.js?v=AIRCON-OVHT-WALLCLOCK-0005 */
try{
/* AIRCON-OVHT-DELAY-0003: owner-requested 5-second qualification.
 * Classic FCOM SP.2.1: hold minimum 5 sec; this trainer deliberately
 * waits the full five seconds before issuing any detector-test indication.
 * Genuine overheat faults remain independent and instantaneous.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AirconOVHTQualificationV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const DELAY_MS=5000;
 function create({clock=()=>Date.now(),schedule=(fn,ms)=>setTimeout(fn,ms),
  cancel=id=>clearTimeout(id),onQualified=()=>{},onReleased=()=>{},delayMs=DELAY_MS}={}){
  if(!Number.isFinite(delayMs)||delayMs<0)throw Error('Invalid OVHT qualification delay');
  let held=false,qualified=false,at=null,timer=null,sequence=0;
  function qualify(seq){
   timer=null;
   if(!held||seq!==sequence||qualified)return;
   const elapsed=clock()-at;
   if(elapsed<delayMs){
    timer=schedule(()=>qualify(seq),Math.max(1,delayMs-elapsed));
    return;
   }
   // Mark complete only if downstream ECU accepts this genuine qualified
   // test. Failures stay observable/retriable instead of leaving a phantom
   // active annunciation in a test-state object.
   onQualified();
   qualified=true;
  }
  function press(physicalStartedAtMs){
   if(held)return snapshot();
   const now=clock();
   // The original physical switch is in the Overhead iframe. Its PRESS
   // message may reach the Unified ECU only after a busy main-thread task.
   // Honor the physical timestamp (transformed to the caller's monotonic
   // clock) instead of starting a fresh five seconds after IPC latency.
   const valid=Number.isFinite(physicalStartedAtMs)&&physicalStartedAtMs<=now&&
    now-physicalStartedAtMs<=60000;
   held=true;qualified=false;at=valid?physicalStartedAtMs:now;
   const seq=++sequence,remaining=Math.max(0,delayMs-(now-at));
   if(remaining===0)qualify(seq);
   else timer=schedule(()=>qualify(seq),remaining);
   return snapshot();
  }
  function release(){
   if(!held)return snapshot();
   ++sequence;held=false;
   if(timer!==null){cancel(timer);timer=null}
   const wasQualified=qualified;
   try{
    if(wasQualified)onReleased();
   }finally{qualified=false;at=null}
   return snapshot();
  }
  function snapshot(){return Object.freeze({
   held,qualified,elapsedMs:held?Math.max(0,clock()-at):0,
   remainingMs:held&&!qualified?Math.max(0,delayMs-(clock()-at)):0,
   delayMs
  })}
  // Optional visual-frame deadline check. A busy cockpit may delay the
  // setTimeout task, even though its deadline was exactly 5000ms. The
  // original foreground rAF loop can qualify on the first painted frame
  // at/after that same deadline without creating a second state owner.
  function check(){
   if(held&&!qualified&&clock()-at>=delayMs){
    if(timer!==null){cancel(timer);timer=null}
    qualify(sequence);
   }
   return snapshot();
  }
  return Object.freeze({press,release,snapshot,check});
 }
 return Object.freeze({DELAY_MS,create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./aircon-fcom-unified-v1.js?v=AIRCON-OVHT-WALLCLOCK-0005-ECU-PROBE */
try{
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
 let testHold=null,lastNativeInput=null,deadlineFrame=null;
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
 // Every foreground animation frame is another opportunity to qualify the
 // SAME deadline. This avoids late setTimeout wakeups in the dense Unified
 // cockpit while preserving the original single ECU ownership and time gate.
 function stopDeadlineFrame(){
  if(deadlineFrame!==null&&typeof root.cancelAnimationFrame==='function')
   root.cancelAnimationFrame(deadlineFrame);
  deadlineFrame=null;
 }
 function pollDeadlineFrame(){
  deadlineFrame=null;
  const s=testHold?.snapshot();
  if(!s?.held||s.qualified)return;
  if(s.remainingMs<=0){
   try{testHold.check()}
   catch(error){console.warn('OVHT visual deadline check rejected by ECU',error);return}
  }
  const after=testHold?.snapshot();
  if(after?.held&&!after.qualified&&typeof root.requestAnimationFrame==='function')
   deadlineFrame=root.requestAnimationFrame(pollDeadlineFrame);
 }
 function startDeadlineFrame(){
  if(deadlineFrame===null&&typeof root.requestAnimationFrame==='function')
   deadlineFrame=root.requestAnimationFrame(pollDeadlineFrame);
 }
 function ovhtQualifier(){
  if(testHold)return testHold;
  const core=root.B737AirconOVHTQualificationV1;
  if(!core?.create)throw Error('AIRCON OVHT 5-second qualification core not loaded');
  testHold=core.create({
   clock:()=>performance.now(),
   onQualified:()=>{
    stopDeadlineFrame();
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
    stopDeadlineFrame();
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
     if(!physicalHold.qualified)startDeadlineFrame();
     lastNativeInput={id:d.id,held:true,qualified:physicalHold.qualified,
      durationMs:physicalHold.elapsedMs,messageLatencyMs:Math.max(0,now-validStart)};
     if(actionNotice&&!physicalHold.qualified)
      actionNotice.textContent='OVHT TEST HELD · WAITING '+
       (physicalHold.remainingMs/1000).toFixed(1)+' s · WING BODY TEST OFF';
    }else{
     if(!before.held)return;
     const durationMs=before.elapsedMs,passed=before.qualified;
     stopDeadlineFrame();
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
   if(d.id==='aircon-ovht-test'&&d.pressed===false){
    stopDeadlineFrame();testHold?.release();
   }
   if(actionNotice)actionNotice.textContent='AIRCON FCOM ERROR · '+err.message;
   console.error('AIRCON FCOM native recessed input',err);
  }
 });
 for(const name of ['b737:unified-ecu-observation','b737:electrical-owner-ready',
  'b737:aircraft-profile-change','b737:cockpit-mounted'])
  root.addEventListener(name,()=>{
   const profiler=name==='b737:unified-ecu-observation'?root.B737InteractionProfilerV1:null;
   const started=profiler?performance.now():0;
   try{refresh();}
   finally{if(profiler)profiler.markWork('ECU listener AIRCON FCOM',performance.now()-started);}
  });
 const releaseTest=()=>{
  stopDeadlineFrame();
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/aircon-live-lab-v1.js?v=AIRCON-LIVE-LAB-0001 */
try{
/* AIRCON-LIVE-LAB-0001: isolated OH21 B737 Classic pneumatic fault bench.
 * Uses exact existing Pneumatics V6 + Duct Pressure estimator and the shared
 * five-second OVHT qualifier. Not an aircraft-certified equipment test.
 * No commands ever leave this lab model for the operational Unified ECU.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AirconLiveLabV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const FAMILIES=Object.freeze(['B737-300-500','B737-400']);
 const GROUPS=Object.freeze([
  Object.freeze({name:'WING–BODY DETECTION & TEST',family:'BOTH',entries:Object.freeze([
   ['wingBodyLLeakDetected','L WING–BODY duct leak / real overheat','SENSOR'],
   ['wingBodyRLeakDetected','R WING–BODY duct leak / real overheat','SENSOR'],
   ['wingBodyLDetectorFailed','L OVHT TEST detector circuit open','SENSOR'],
   ['wingBodyRDetectorFailed','R OVHT TEST detector circuit open','SENSOR']
  ])}),
  Object.freeze({name:'BLEED AIR & VALVES',family:'BOTH',entries:Object.freeze([
   ['bleed1Overlimit','ENG 1 BLEED overpressure / overtemperature','SENSOR'],
   ['bleed2Overlimit','ENG 2 BLEED overpressure / overtemperature','SENSOR'],
   ['engineBleed1ValveFailed','ENG 1 BLEED valve fail closed','FAULT'],
   ['engineBleed2ValveFailed','ENG 2 BLEED valve fail closed','FAULT'],
   ['apuBleedValveFailed','APU BLEED valve fail','FAULT'],
   ['isolationJammedOpen','ISOLATION valve jammed OPEN','FAULT'],
   ['isolationJammedClosed','ISOLATION valve jammed CLOSED','FAULT'],
   ['bleedValveControlPower','BLEED VALVE control supply lost','INVERTED_SENSOR'],
   ['isolationAcPower','ISOLATION AC power lost','INVERTED_SENSOR']
  ])}),
  Object.freeze({name:'PACKS & DUCT',family:'BOTH',entries:Object.freeze([
   ['packLOverheat','L PACK overheat / PACK TRIP','SENSOR'],
   ['packROverheat','R PACK overheat / PACK TRIP','SENSOR'],
   ['packLValveFailed','L PACK valve stuck / failed','FAULT'],
   ['packRValveFailed','R PACK valve stuck / failed','FAULT'],
   ['ductGaugeAcPower','DUCT PRESSURE indicator AC supply lost','INVERTED_SENSOR']
  ])}),
  Object.freeze({name:'DUCT OVERHEAT · 737-300/500',family:'B737-300-500',entries:Object.freeze([
   ['ductLOverheat','L DUCT OVERHEAT · FULL COLD','SENSOR'],
   ['ductROverheat','R DUCT OVERHEAT · FULL COLD','SENSOR']
  ])}),
  Object.freeze({name:'PACK CONTROLLERS · 737-400',family:'B737-400',entries:Object.freeze([
   ['packLPrimaryControlFailed','L PACK primary controller fail · RECALL','SENSOR'],
   ['packLStandbyControlFailed','L PACK standby controller fail · RECALL','SENSOR'],
   ['packRPrimaryControlFailed','R PACK primary controller fail · RECALL','SENSOR'],
   ['packRStandbyControlFailed','R PACK standby controller fail · RECALL','SENSOR']
  ])}),
  Object.freeze({name:'ZONE TEMPERATURE · 737-400',family:'B737-400',entries:Object.freeze([
   ['zoneContOverheat','CONT CAB ZONE TEMP overheat','SENSOR'],
   ['zoneFwdOverheat','FWD CAB ZONE TEMP overheat','SENSOR'],
   ['zoneAftOverheat','AFT CAB ZONE TEMP overheat','SENSOR'],
   ['contPrimaryTempControlFailed','CONT CAB primary controller fail · RECALL','SENSOR'],
   ['contStandbyTempControlFailed','CONT CAB standby controller fail · RECALL','SENSOR'],
   ['fwdTempControlFailed','FWD CAB temperature controller fail · RECALL','SENSOR'],
   ['aftTempControlFailed','AFT CAB temperature controller fail · RECALL','SENSOR']
  ])}),
  Object.freeze({name:'RECIRC FANS · CONTROL POWER',family:'BOTH',entries:Object.freeze([
   ['recircFanFailed','Single RECIRC fan failure · 300/500','FAULT'],
   ['recircFanLFailed','L RECIRC fan failure · 400','FAULT'],
   ['recircFanRFailed','R RECIRC fan failure · 400','FAULT'],
   ['recircAcPower','RECIRC AC supply lost','INVERTED_SENSOR']
  ])})
 ]);
 const SOURCES=Object.freeze([
  ['engine1Running','ENG 1 bleed source running'],
  ['engine2Running','ENG 2 bleed source running'],
  ['apuRunning','APU air source running'],
  ['externalAirAvailable','Ground pneumatic air cart attached']
 ]);
 const LAMP_IDS=Object.freeze(['wing-body-overheat-l','wing-body-overheat-r',
  'bleed-trip-l','bleed-trip-r','pack-trip-l','pack-trip-r',
  'duct-overheat-l','duct-overheat-r','dual-bleed']);
 const LAMP_MODES=Object.freeze(['NORMAL','LAMP_OPEN','LAMP_STUCK_ON','DIM_LAMP']);
 const SCENARIOS=Object.freeze([
  ['healthy','NORMAL / RESET ALL',[]],
  ['wing-l','L WING–BODY OVHT',[['wingBodyLLeakDetected',true]]],
  ['wing-r','R WING–BODY OVHT',[['wingBodyRLeakDetected',true]]],
  ['ovht-l-detector','L OVHT DETECTOR OPEN',[['wingBodyLDetectorFailed',true]]],
  ['ovht-r-detector','R OVHT DETECTOR OPEN',[['wingBodyRDetectorFailed',true]]],
  ['bleed-l','L BLEED TRIP OFF',[['bleed1Overlimit',true]]],
  ['bleed-r','R BLEED TRIP OFF',[['bleed2Overlimit',true]]],
  ['pack-l','L PACK TRIP',[['packLOverheat',true]]],
  ['pack-r','R PACK TRIP',[['packROverheat',true]]],
  ['duct-l','L DUCT OVERHEAT',[['ductLOverheat',true]]],
  ['duct-r','R DUCT OVERHEAT',[['ductROverheat',true]]],
  ['400-cont','400 CONT CAB ZONE TEMP',[['zoneContOverheat',true]]],
  ['400-fwd','400 FWD CAB ZONE TEMP',[['zoneFwdOverheat',true]]],
  ['400-aft','400 AFT CAB ZONE TEMP',[['zoneAftOverheat',true]]],
  ['400-pack-l-primary','400 L PACK PRIMARY FAIL · RECALL',[['packLPrimaryControlFailed',true]]],
  ['400-pack-l-dual','400 L PACK BOTH CONTROLLERS',[['packLPrimaryControlFailed',true],['packLStandbyControlFailed',true]]],
  ['both-wing','BOTH WING–BODY DETECTORS',[['wingBodyLLeakDetected',true],['wingBodyRLeakDetected',true]]],
  ['apu-valve','APU BLEED VALVE FAILED',[['apuBleedValveFailed',true]]],
  ['left-pack-valve','L PACK VALVE FAILED',[['packLValveFailed',true]]],
  ['isolation-stuck','ISOLATION STUCK CLOSED',[['isolationJammedClosed',true]]]
 ]);
 const catalog=Object.freeze(Object.fromEntries(GROUPS.flatMap(g=>g.entries.map(([id,label,kind])=>[id,{id,label,kind,family:g.family}]))));
 function create({P,pressure,qualification,clock=()=>performance.now(),
  schedule=(f,ms)=>setTimeout(f,ms),cancel=id=>clearTimeout(id),onChange=()=>{}}={}){
  if(!P?.apply||!P?.derive||!qualification?.create)throw Error('Pneumatics V6 and OVHT timing kernel required');
  let state=P.initial(),lampFaults={},lastPreset='healthy';
  const apply=command=>{state=P.apply(state,command);onChange();return state};
  const qualifier=qualification.create({
   clock,schedule,cancel,
   onQualified:()=>apply({type:'SENSOR',key:'wingBodyTestHeld',value:true}),
   onReleased:()=>apply({type:'SENSOR',key:'wingBodyTestHeld',value:false})
  });
  function setFamily(value){
   if(!FAMILIES.includes(value))throw Error('Invalid Classic panel variant');
   if(state.controls.aircraftFamily!==value)apply({type:'CONTROL',key:'aircraftFamily',value});
   return value;
  }
  function inject(id,active){
   const item=catalog[id];
   if(!item||typeof active!=='boolean')throw Error('Unknown air-conditioning failure');
   const type=item.kind;
   if(type==='FAULT')apply({type:'FAULT',id,active,instructor:true});
   else apply({type:'SENSOR',key:id,value:type==='INVERTED_SENSOR'?!active:active});
   return active;
  }
  function selected(id){
   const entry=catalog[id];if(!entry)return false;
   return entry.kind==='FAULT'?state.faults[id]===true:
    entry.kind==='INVERTED_SENSOR'?state.inputs[id]===false:state.inputs[id]===true;
  }
  function source(id,active){
   if(!SOURCES.some(([key])=>key===id)||typeof active!=='boolean')throw Error('Unknown air source');
   if(state.inputs[id]!==active)apply({type:'SENSOR',key:id,value:active});
  }
  function control(id,value){
   if(!P.CONTROL_TYPES[id]?.includes(value))throw Error('Unsupported pneumatic switch/detent');
   if(state.controls[id]!==value)apply({type:'CONTROL',key:id,value});
  }
  function reset(){
   qualifier.release();
   const family=state.controls.aircraftFamily;
   state=P.initial();
   if(family!==state.controls.aircraftFamily)state=P.apply(state,{type:'CONTROL',key:'aircraftFamily',value:family});
   lampFaults={};lastPreset='healthy';onChange();
  }
  function preset(id){
   const entry=SCENARIOS.find(s=>s[0]===id);
   if(!entry)throw Error('Unknown air-conditioning failure preset');
   reset();
   for(const [key,active] of entry[2])inject(key,active);
   lastPreset=id;onChange();
  }
  function lamp(id,mode){
   if(!LAMP_IDS.includes(id)||!LAMP_MODES.includes(mode))throw Error('Invalid lamp failure');
   if(mode==='NORMAL')delete lampFaults[id];
   else lampFaults[id]=mode;
   onChange();
  }
  function testPress(){return qualifier.press()}
  function testRelease(){return qualifier.release()}
  function tripReset(){return apply({type:'TRIP_RESET'})}
  function snapshot(){
   const d=P.derive(state);
   const modeledLamps=Object.entries(d.lamps).map(([id,on])=>({id,on}));
   const immediate=d.lamps.wingBodyOverheatL||d.lamps.wingBodyOverheatR||
    d.lamps.bleedTrip1||d.lamps.bleedTrip2||d.lamps.packTripL||d.lamps.packTripR||
    d.lamps.ductOverheatL||d.lamps.ductOverheatR||
    (state.controls.aircraftFamily==='B737-400'&&
     Object.values(d.zoneTemp400).some(z=>z.immediate));
   const recall=state.controls.aircraftFamily==='B737-400'&&(
    Object.values(d.pack400).some(p=>p.recallOnly)||
    Object.values(d.zoneTemp400).some(z=>z.recallOnly));
   let pressures=null;
   if(pressure?.project){
    try{const ecu={engines:{
      engine1:{phase:state.inputs.engine1Running?'RUNNING':'OFF',n1Percent:32},
      engine2:{phase:state.inputs.engine2Running?'RUNNING':'OFF',n1Percent:32}},
     apu:{phase:state.inputs.apuRunning?'READY':'OFF'}};
     pressures=pressure.project({ecu,bleed:d.bleed,controls:state.controls,pack:d.pack,
      sensors:{L:state.inputs.ductLeftPsi,R:state.inputs.ductRightPsi},
      gaugePowered:state.inputs.ductGaugeAcPower});
    }catch{pressures=null}
   }
   return {state,derived:d,test:qualifier.snapshot(),faults:Object.fromEntries(
    Object.keys(catalog).map(id=>[id,selected(id)])),
    lamps:modeledLamps,lampFaults:{...lampFaults},immediateCaution:!!immediate,
    recallOnly:!!recall,pressures,preset:lastPreset};
  }
  return Object.freeze({setFamily,inject,selected,source,control,reset,preset,lamp,
   testPress,testRelease,tripReset,snapshot});
 }
 return Object.freeze({FAMILIES,GROUPS,SOURCES,LAMP_IDS,LAMP_MODES,SCENARIOS,catalog,create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./aircon-live-test-lab-v1.js?v=AIRCON-LIVE-LAB-0002-CONTROLS */
try{
/* AIRCON-LIVE-LAB-0001: photographic OH21 live isolated failure test bench.
 * The popup embeds the exact approved Unified Overhead OH21 stage and its
 * original P5-10 hardware, switches and annunciator sockets. Independent
 * Pneumatics V6 instance, not a shadow writer to the operational aircraft.
 */
(function(root){
 'use strict';
 const Core=root.B737AirconLiveLabV1,Hold=root.B737AirconOVHTQualificationV1;
 const P=()=>root.B737PneumaticsV6,D=()=>root.B737DuctPressureLiveV1;
 if(!Core||!Hold)return;
 const TILE={x:1724,y:1751,w:493,h:701},STAGE={w:2220,h:3312};
 const SOURCE_MAP={engineBleed1:'bleed-eng-1',engineBleed2:'bleed-eng-2',
  apuBleed:'bleed-apu',isolation:'isolation-valve',packL:'pack-l',
  packR:'pack-r',recirc:'recirc-fan'};
 const LAMP_NAMES={
  wingBodyOverheatL:'L WING–BODY OVHT',wingBodyOverheatR:'R WING–BODY OVHT',
  bleedTrip1:'ENG 1 BLEED TRIP',bleedTrip2:'ENG 2 BLEED TRIP',
  packTripL:'L PACK TRIP',packTripR:'R PACK TRIP',
  ductOverheatL:'L DUCT OVERHEAT',ductOverheatR:'R DUCT OVERHEAT',
  dualBleed:'DUAL BLEED'
 };
 let dialog=null,iframe=null,model=null,ready=false,lastDocument=null,lastProjection='';
 let renderQueued=false,interval=null,gauge=null,nativeHeld=false,opening=false;
 const $=id=>dialog?.querySelector('#'+id);
 const clean=id=>String(id).replace(/[^a-z0-9-_]/gi,'');
 function status(msg,error=false){
  const box=$('airconLabStatus');if(box){box.textContent=msg;box.dataset.error=String(error)}
 }
 function preferredFamily(){
  try{return JSON.parse(localStorage.getItem('b737classic.aircraft-profile.v1')||'null')?.aircraftFamily==='B737-400'
   ?'B737-400':'B737-300-500'}
  catch{return 'B737-300-500'}
 }
 function visualDoc(){try{return iframe?.contentDocument}catch{return null}}
 function visualWindow(){try{return iframe?.contentWindow}catch{return null}}
 function bootModel(){
  if(model)return true;
  if(!P()?.initial||!D()?.project)return false;
  model=Core.create({P:P(),pressure:D(),qualification:Hold,onChange:schedulePaint});
  model.setFamily(preferredFamily());
  status('LIVE PNEUMATIC CORE READY · LAB ISOLATED');
  return true;
 }
 function stageCommand(action,payload){
  if(!ready)return;
  visualWindow()?.postMessage({type:'b737:cockpit-command',action,...payload},location.origin);
 }
 function syncPhysical(){
  if(!ready||!model)return;
  const physical=visualWindow()?.B737OverheadToggles?.getState?.()||{};
  for(const [id,physicalId]of Object.entries(SOURCE_MAP)){
   const raw=physical[physicalId];
   if(raw===undefined||raw===null)continue;
   const v=String(raw).trim().toUpperCase();
   if(P().CONTROL_TYPES[id]?.includes(v))model.control(id,v);
  }
 }
 function setFamily(family){
  if(!bootModel())return false;
  model.setFamily(family);
  const local=visualWindow();
  local?.B737OverheadLights?.setAircraftFamily?.(family);
  stageCommand('aircon-background',{family});
  lastProjection='';schedulePaint();
  return true;
 }
 function ensureGauge(){
  if(!ready||!D()?.advanceDynamics)return false;
  const doc=visualDoc(),atlas=doc?.getElementById('atlasAbsolute');
  const photo=atlas?.querySelector('.owner-oh21-photo-layer-v1');
  const m=root.B737DuctPressureNeedlesModel;
  if(!photo||!atlas||!m)return false;
  if(gauge?.node?.isConnected){
   for(const k of ['left','top','width','height'])gauge.node.style[k]=photo.style[k];
   return true;
  }
  const n='http://www.w3.org/2000/svg';
  const svg=doc.createElementNS(n,'svg');
  svg.setAttribute('data-aircon-live-lab-needles','OH21');
  svg.setAttribute('viewBox','0 0 '+m.source.width+' '+m.source.height);
  svg.setAttribute('preserveAspectRatio','none');
  Object.assign(svg.style,{position:'absolute',zIndex:'1005',pointerEvents:'none',
   overflow:'hidden',left:photo.style.left,top:photo.style.top,
   width:photo.style.width,height:photo.style.height});
  const blades={};
  for(const needle of m.needles){
   const group=doc.createElementNS(n,'g');
   group.setAttribute('transform','translate('+m.pivot.x+' '+m.pivot.y+') scale('+
    needle.tipRadius/220+') translate(-256 -256)');
   const blade=doc.createElementNS(n,'g');
   blade.style.transformOrigin='256px 256px';
   blade.style.transition='none';
   blade.setAttribute('data-duct-pressure-blade',needle.id);
   const image=doc.createElementNS(n,'image');
   image.setAttribute('href',new URL('./'+needle.asset+'?v=DPN-0005-LR',document.baseURI).href);
   image.setAttribute('x','0');image.setAttribute('y','0');
   image.setAttribute('width','512');image.setAttribute('height','512');
   blade.append(image);group.append(blade);svg.append(group);
   blades[needle.id]=blade;
  }
  atlas.append(svg);
  gauge={node:svg,blades,motion:D().initialDynamics(),target:{L:0,R:0},last:null,raf:0};
  return true;
 }
 function animateGauge(ts){
  if(!gauge||!dialog?.open){if(gauge)gauge.raf=0;return}
  gauge.raf=0;
  const dt=gauge.last===null?16:Math.min(80,Math.max(0,ts-gauge.last));
  gauge.last=ts;
  gauge.motion=D().advanceDynamics(gauge.motion,gauge.target,dt);
  const m=root.B737DuctPressureNeedlesModel;
  for(const side of ['L','R'])gauge.blades[side].style.transform=
   'rotate('+m.bearing(side,gauge.motion[side].value)+'deg)';
  if(!D().settled(gauge.motion,gauge.target))gauge.raf=requestAnimationFrame(animateGauge);
  else gauge.last=null;
 }
 function pressureNeedles(pressures){
  if(!pressures||!ensureGauge())return;
  for(const side of ['L','R']){
   const value=pressures[side];
   if(typeof value==='number'&&Number.isFinite(value))gauge.target[side]=value;
   gauge.blades[side].style.opacity=value===null?'.22':'1';
  }
  if(!gauge.raf)gauge.raf=requestAnimationFrame(animateGauge);
 }
 function indicatorOverrides(faults){
  const doc=visualDoc();if(!doc?.head)return;
  let sheet=doc.getElementById('airconLiveLabIndicatorOverrides');
  if(!sheet){sheet=doc.createElement('style');sheet.id='airconLiveLabIndicatorOverrides';doc.head.append(sheet)}
  const css=[];
  for(const [id,mode]of Object.entries(faults)){
   if(!Core.LAMP_IDS.includes(id))continue;
   const selector='.mounted-light[data-light="'+id+'"]';
   const faces=selector+' .light-face';
   if(mode==='LAMP_OPEN'){
    css.push(faces+'{opacity:0!important}');
    css.push(selector+' .light-face[data-frame="OFF"]{opacity:1!important}');
   }else if(mode==='LAMP_STUCK_ON'){
    css.push(faces+'{opacity:0!important}');
    css.push(selector+' .light-face[data-frame="ON"]{opacity:1!important}');
   }else if(mode==='DIM_LAMP')css.push(selector+' .light-face.active{opacity:.22!important}');
  }
  sheet.textContent=css.join('\n');
 }
 function sendProjection(result,force=false){
  if(!ready||!result)return;
  const out=result.derived;
  const payload={family:result.state.controls.aircraftFamily,
   lamps:out.lamps,pack400:out.pack400,zones:out.zoneTemp400,
   latched:result.state.latched,
   inputs:{wingBodyTestHeld:result.state.inputs.wingBodyTestHeld}};
  const signature=JSON.stringify(payload);
  if(force||signature!==lastProjection){
   lastProjection=signature;
   stageCommand('aircon-fcom-projection',{payload});
  }
  indicatorOverrides(result.lampFaults);
  pressureNeedles(result.pressures);
 }
 function updateProgress(){
  const t=model?.snapshot().test;
  const pct=t?.held?Math.min(100,100*t.elapsedMs/t.delayMs):0;
  const fill=$('airconLabHoldFill');if(fill)fill.style.width=pct+'%';
  const button=$('airconLabHold');
  if(button){
   button.setAttribute('aria-pressed',String(t?.held===true));
   button.textContent=t?.held?(t.qualified?'OVHT TEST · QUALIFIED':
    'OVHT TEST · '+(t.remainingMs/1000).toFixed(1)+' s'):'HOLD OVHT TEST · 5 s';
  }
 }
 function schedulePaint(){
  if(renderQueued)return;
  renderQueued=true;
  queueMicrotask(()=>{renderQueued=false;paint()});
 }
 function paint(){
  if(!dialog||!model)return;
  const s=model.snapshot(),d=s.derived;
  const family=s.state.controls.aircraftFamily;
  const select=$('airconLabFamily');if(select)select.value=family;
  for(const box of dialog.querySelectorAll('[data-aircon-fault]')){
   box.checked=s.faults[box.dataset.airconFault]===true;
   box.closest('label').hidden=box.dataset.family!=='BOTH'&&box.dataset.family!==family;
  }
  for(const box of dialog.querySelectorAll('[data-aircon-source]'))
   box.checked=s.state.inputs[box.dataset.airconSource]===true;
  for(const section of dialog.querySelectorAll('[data-aircon-family]'))
   section.hidden=section.dataset.airconFamily!=='BOTH'&&section.dataset.airconFamily!==family;
  for(const opt of dialog.querySelectorAll('[data-aircon-scenario]')){
   const id=opt.dataset.airconScenario;
   opt.setAttribute('aria-pressed',String(s.preset===id));
   opt.hidden=(id.startsWith('400-')&&family!=='B737-400')||
    (id.startsWith('duct-')&&family!=='B737-300-500');
  }
  for(const [id,on]of Object.entries(d.lamps)){
   const node=$('airconLamp-'+clean(id));
   if(node){node.dataset.on=String(on);node.textContent=(LAMP_NAMES[id]||id)+' : '+(on?'ON':'OFF');}
  }
  for(const z of ['CONT','FWD','AFT']){
   const node=$('airconZone-'+z);
   if(node){node.dataset.on=String(d.zoneTemp400[z].immediate);
    node.textContent=z+' ZONE TEMP : '+(d.zoneTemp400[z].immediate?'ON':
     d.zoneTemp400[z].recallOnly?'RECALL ONLY':'OFF');
    node.dataset.recall=String(d.zoneTemp400[z].recallOnly);
    node.hidden=family!=='B737-400';
   }
  }
  const warn=$('airconLabCaution');if(warn){
   warn.dataset.on=String(s.immediateCaution);
   warn.querySelector('span').textContent=s.immediateCaution?'ON':s.recallOnly?'RECALL ONLY':'OFF';
  }
  const psi=$('airconLabDuct');
  if(psi){
   const value=v=>typeof v==='number'?v.toFixed(1)+' PSI':'NO AC INDICATION';
   psi.textContent='L '+value(s.pressures?.L)+' · R '+value(s.pressures?.R);
  }
  const valves=$('airconLabValves');
  if(valves)valves.textContent='ENG1 BLEED '+(d.bleed.engine1ValveOpen?'OPEN':'CLOSED')+
   ' · ENG2 '+(d.bleed.engine2ValveOpen?'OPEN':'CLOSED')+
   ' · APU '+(d.bleed.apuBleedValveOpen?'OPEN':'CLOSED')+
   ' · ISOLATION '+(d.bleed.isolationOpen===null?'UNKNOWN':d.bleed.isolationOpen?'OPEN':'CLOSED');
  const pack=$('airconLabPack');
  if(pack)pack.textContent='L PACK '+String(d.pack.L.flow)+' · R PACK '+String(d.pack.R.flow);
  const n=$('airconLabFailures');
  if(n)n.textContent=Object.values(s.faults).filter(Boolean).length+' ACTIVE FAILURES'+
   ' · '+Object.keys(s.lampFaults).length+' INDICATOR FAULTS'+
   ' · '+Object.values(s.state.latched).filter(Boolean).length+' TRIP LATCHES';
  updateProgress();
  sendProjection(s);
 }
 function connect(){
  if(!dialog?.open||!bootModel())return false;
  const w=visualWindow(),doc=visualDoc();
  if(!doc?.querySelector('#atlasAbsolute .atlas-piece[data-key="OH21"]')||
    !w?.B737OverheadToggles?.getState||!w?.B737OverheadLights?.getState)return false;
  if(ready&&lastDocument===doc)return true;
  ready=true;lastDocument=doc;lastProjection='';gauge=null;
  try{
   w.B737OverheadLights.setAircraftElectricalPower?.(true);
   w.B737OverheadLights.setScenario?.({panelPower:true,
    engine1Running:model.snapshot().state.inputs.engine1Running,
    engine2Running:model.snapshot().state.inputs.engine2Running,
    apuRunning:model.snapshot().state.inputs.apuRunning});
  }catch(err){status('Laboratory light power configuration unavailable: '+err.message,true)}
  setFamily(model.snapshot().state.controls.aircraftFamily);
  syncPhysical();schedulePaint();
  status('ORIGINAL OH21 LIVE PANEL READY · all faults isolated from operational Unified');
  return true;
 }
 function crop(){
  const box=$('airconLabCrop'),area=$('airconLabWindow');
  if(!box||!area)return;
  const width=Math.max(190,Math.min(590,box.clientWidth||560));
  const maxHeight=Math.max(300,Math.min(780,window.innerHeight*.67));
  const scale=Math.min(width/TILE.w,maxHeight/TILE.h,2);
  box.style.height=Math.round(TILE.h*scale)+'px';
  area.style.transform='scale('+scale+')';
  area.style.width=TILE.w+'px';area.style.height=TILE.h+'px';
 }
 function press(){
  if(!bootModel())return;
  model.testPress();nativeHeld=true;schedulePaint();
 }
 function release(){
  nativeHeld=false;
  if(model)model.testRelease();
  schedulePaint();
 }
 function holdButton(){
  const button=$('airconLabHold');
  button.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   e.preventDefault();try{button.setPointerCapture(e.pointerId)}catch{}
   press();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']){
   button.addEventListener(event,e=>{e.stopPropagation();release()});
  }
  button.addEventListener('keydown',e=>{
   if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)press()}
  });
  button.addEventListener('keyup',e=>{
   if(e.key===' '||e.key==='Enter'){e.preventDefault();release()}
  });
  button.addEventListener('blur',release);
  button.addEventListener('click',e=>e.preventDefault());
 }
 function build(){
  dialog=document.createElement('dialog');
  dialog.id='airconLiveTestLabV1';dialog.className='aircon-live-dialog';dialog.dir='ltr';
  const option=arr=>arr.map(x=>'<option value="'+x+'">'+x.replaceAll('_',' ')+'</option>').join('');
  const presets=Core.SCENARIOS.map(s=>
   '<button type="button" data-aircon-scenario="'+s[0]+'" aria-pressed="false">'+s[1]+'</button>').join('');
  const groups=Core.GROUPS.map(g=>
   '<section class="aircon-section" data-aircon-family="'+g.family+'"><h3>'+g.name+'</h3>'+
   '<div class="aircon-grid">'+g.entries.map(([id,label])=>
    '<label data-variant="'+g.family+'"><input type="checkbox" data-aircon-fault="'+id+
     '" data-family="'+g.family+'"><span>'+label+'</span></label>').join('')+'</div></section>').join('');
  const sources=Core.SOURCES.map(([id,label])=>
   '<label><input type="checkbox" data-aircon-source="'+id+'"><span>'+label+'</span></label>').join('');
  const lamps=Object.keys(LAMP_NAMES).map(id=>
   '<span class="aircon-lamp" id="airconLamp-'+clean(id)+'" data-on="false">'+LAMP_NAMES[id]+' : OFF</span>').join('')+
   ['CONT','FWD','AFT'].map(z=>
    '<span class="aircon-lamp" id="airconZone-'+z+'" hidden>'+z+' ZONE TEMP</span>').join('');
  const faultModes=Core.LAMP_MODES.map(x=>'<option value="'+x+'">'+x.replaceAll('_',' ')+'</option>').join('');
  const lampSelect=Core.LAMP_IDS.map(id=>
   '<label><span>'+id+'</span><select data-aircon-lamp="'+id+'">'+faultModes+'</select></label>').join('');
  dialog.innerHTML=
   '<header class="aircon-head"><div><strong>AIR CONDITIONING · LIVE TEST LAB</strong>'+
   '<small>Approved real Unified OH21 panel · independent failure injection and original physical controls</small></div>'+
   '<button id="airconLabClose" type="button" aria-label="Close test lab">×</button></header>'+
   '<div class="aircon-body"><section class="aircon-left">'+
   '<div class="aircon-crop" id="airconLabCrop"><div class="aircon-window" id="airconLabWindow">'+
   '<iframe id="airconLabStage" title="Original B737 Classic OH21 air conditioning panel"></iframe></div></div>'+
   '<p class="aircon-note">This is the original photo, switches and lights from Unified, running in a separate laboratory instance. Test faults never change the operating cockpit.</p>'+
   '<div class="aircon-summary"><div class="aircon-caution" id="airconLabCaution" data-on="false"><b>MASTER CAUTION · AIR COND</b><span>OFF</span></div>'+
   '<div><b>DUAL DUCT PRESSURE · ESTIMATE</b><span id="airconLabDuct">L — · R —</span></div>'+
   '<div><b>BLEED / ISOLATION VALVES</b><span id="airconLabValves">—</span></div>'+
   '<div><b>PACK AIR FLOW</b><span id="airconLabPack">—</span></div></div>'+
   '<div class="aircon-actions"><button type="button" id="airconLabHold" aria-pressed="false">HOLD OVHT TEST · 5 s</button>'+
   '<button type="button" id="airconLabTrip">TRIP RESET</button>'+
   '<button type="button" id="airconLabReset">RESET LAB</button></div>'+
   '<div id="airconLabHoldMeter" aria-label="5 second detector test qualification"><div id="airconLabHoldFill"></div></div>'+
   '<div id="airconLabFailures" role="status"></div>'+
   '<div class="aircon-lamps" id="airconLabLamps">'+lamps+'</div>'+
   '<p id="airconLabStatus" role="status">WAITING FOR LIVE OVERHEAD STAGE</p></section>'+
   '<aside class="aircon-right"><div class="aircon-row"><label for="airconLabFamily">AIRCRAFT</label>'+
   '<select id="airconLabFamily"><option value="B737-300-500">B737-300 / 500</option>'+
   '<option value="B737-400">B737-400</option></select></div>'+
   '<section class="aircon-section"><h3>QUICK REALISTIC FAILURE SCENARIOS</h3>'+
   '<div class="aircon-presets">'+presets+'</div></section>'+
   '<section class="aircon-section"><h3>AIR SOURCES · LAB ONLY</h3>'+
   '<div class="aircon-grid">'+sources+'</div></section>'+groups+
   '<section class="aircon-section"><h3>INDIVIDUAL ANNUNCIATOR FAILURES · LAB ONLY</h3>'+
   '<div class="aircon-lamp-list">'+lampSelect+'</div></section>'+
   '<p class="aircon-note">Select any combination of faults. WING–BODY leak is immediate; OVHT TEST is deliberately qualified after 5 uninterrupted seconds. BLEED / PACK / DUCT / ZONE trips need removal of initiating fault before TRIP RESET. Duct PSI, actual temperature thresholds and component wiring use training estimates, not aircraft-certified calibration.</p>'+
   '</aside></div>';
  document.body.append(dialog);
  iframe=$('airconLabStage');
  iframe.style.left='-'+TILE.x+'px';iframe.style.top='-'+TILE.y+'px';
  iframe.style.width=STAGE.w+'px';iframe.style.height=STAGE.h+'px';
  $('airconLabClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
  dialog.addEventListener('close',()=>{
   release();
   ready=false;lastDocument=null;lastProjection='';
   if(gauge?.raf)cancelAnimationFrame(gauge.raf);
   gauge=null;iframe.removeAttribute('src');
  });
  $('airconLabFamily').addEventListener('change',e=>setFamily(e.target.value));
  $('airconLabTrip').addEventListener('click',()=>{model?.tripReset();schedulePaint()});
  $('airconLabReset').addEventListener('click',()=>{
   if(!model)return;model.reset();model.setFamily($('airconLabFamily').value);
   schedulePaint();status('LAB RESET · all injected failures removed');
  });
  $('airconLabHold').addEventListener('contextmenu',e=>e.preventDefault());
  holdButton();
  dialog.addEventListener('change',e=>{
   const t=e.target;
   if(t.dataset.airconFault){
    if(!bootModel())return;model.inject(t.dataset.airconFault,t.checked);schedulePaint();
   }else if(t.dataset.airconSource){
    if(!bootModel())return;model.source(t.dataset.airconSource,t.checked);schedulePaint();
    if(ready&&['engine1Running','engine2Running','apuRunning'].includes(t.dataset.airconSource))
     visualWindow()?.B737OverheadLights?.setScenario?.({
      [t.dataset.airconSource]:t.checked
     });
   }else if(t.dataset.airconLamp){
    if(!bootModel())return;model.lamp(t.dataset.airconLamp,t.value);schedulePaint();
   }
  });
  dialog.addEventListener('click',e=>{
   const id=e.target.closest('[data-aircon-scenario]')?.dataset.airconScenario;
   if(!id)return;
   if(!bootModel())return;
   model.preset(id);schedulePaint();
  });
  iframe.addEventListener('load',()=>{ready=false;lastDocument=null;lastProjection='';gauge=null;connect()});
  window.addEventListener('resize',crop);
  interval=setInterval(()=>{
   if(!dialog?.open)return;
   if(!model)bootModel();
   if(!ready)connect();
   if(ready)syncPhysical();
   updateProgress();
   if(ready&&model){
    const s=model.snapshot();
    if(!gauge?.node?.isConnected)pressureNeedles(s.pressures);
    sendProjection(s);
   }
  },140);
 }
 function onMessage(e){
  if(!iframe||e.source!==visualWindow()||e.origin!==location.origin||
   e.data?.type!=='b737:cockpit-overhead')return;
  // A separate original overhead instance must NEVER feed the operational
  // Unified ECU or six-pack, regardless of event order.
  e.stopImmediatePropagation();
  const msg=e.data;
  if(msg.kind==='ready'){ready=false;connect();schedulePaint();return}
  if(msg.kind==='recessed-button'&&msg.source==='recessed-hardware-v2'){
   if(!bootModel())return;
   if(msg.id==='aircon-ovht-test'){
    if(msg.pressed)press();else release();
   }else if(msg.id==='trip-reset'&&msg.pressed){
    model.tripReset();schedulePaint();
   }
  }
  if(msg.kind==='control-event'||msg.kind==='controls-state')syncPhysical();
 }
 root.addEventListener('message',onMessage,true);
 function ensureButton(){
  const holder=document.getElementById('unifiedLabShortcuts');
  if(!holder)return;
  let btn=document.getElementById('airconLiveLabOpen');
  if(!btn){
   btn=document.createElement('button');btn.id='airconLiveLabOpen';btn.type='button';
   btn.textContent='AIR COND LAB';btn.title='FCOM Air Conditioning OH21 live failure test lab';
   btn.addEventListener('click',open);
  }
  if(btn.parentElement!==holder)holder.append(btn);
 }
 function open(){
  if(!dialog)build();
  if(!dialog.open)dialog.showModal();
  crop();
  if(!bootModel())status('WAITING FOR PNEUMATICS V6 ECU CORE · loading original OH21');
  // Loading the actual photo is independent of the asynchronously installed
  // Unified ECU. A lab opened early must never remain blank indefinitely.
  if(!iframe.hasAttribute('src')){
   const main=document.getElementById('overheadFrame');
   const origin=main?.getAttribute('src')||'./overhead-stage.html';
   iframe.src=new URL(origin,document.baseURI).href+
    (origin.includes('?')?'&':'?')+'airconLiveLab=1';
  }
  schedulePaint();
 }
 function readyInit(){ensureButton();root.addEventListener('b737:cockpit-mounted',ensureButton);}
 root.B737AirconLiveTestLabV1=Object.freeze({open,
  snapshot:()=>model?.snapshot()||null,
  inject:(id,value)=>{if(!bootModel())throw Error('Pneumatic core not ready');return model.inject(id,value)},
  preset:id=>{if(!bootModel())throw Error('Pneumatic core not ready');return model.preset(id)},
  testPress:press,testRelease:release,
  isOpen:()=>dialog?.open===true});
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',readyInit,{once:true});
 else readyInit();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/air-mix-valve-300500-v1.js?v=AIR-MIX-300500-THERMAL-0002 */
try{
/* B737-300/500 ATA 21 cabin-temperature and air mix valve training plant.
 * Independent CONT/PASS temperature sensors, proportional AUTO demand,
 * physical 0..1 valve travel, thermal inertia and safety overrides.
 * FCOM 2.10 / 2.30 establishes functionality; exact detent temperatures,
 * thermal time constants and actuator rates are explicitly SIM estimates.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AirMixValve300500V1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const SIDES=Object.freeze(['CONT','PASS']);
 const AUTO_TARGETS=Object.freeze({
  'AUTO 16':16,'AUTO 18':18,'AUTO 20':20,'AUTO 22':22,
  'AUTO 24':24,'AUTO 26':26,
  // Compatibility with original five-detent layout and 737-400 mirror.
  'AUTO COOL':20,'AUTO NORM':22,'AUTO WARM':24
 });
 const SELECTORS=Object.freeze(['MANUAL COOL',...Object.keys(AUTO_TARGETS),'MANUAL WARM']);
 const GAUGES=Object.freeze({
  CONT:Object.freeze({x:226,y:423,selector:'control-cabin-temp',pack:'pack-l'}),
  PASS:Object.freeze({x:1023,y:423,selector:'pass-cabin-temp',pack:'pack-r'})
 });
 const SOURCE=Object.freeze({width:1254,height:1254,piece:'OH20'});
 const CONFIG=Object.freeze({
  fullTravelSeconds:90,benchFullTravelSeconds:10,deadbandC:0.45,
  ductLimitC:60,overheatC:88,
  coldSupplyC:12,hotSupplyC:32,neutralC:22,temperatureTauSeconds:100,
  idleTauSeconds:3600,proportionalGain:0.12,valveTolerance:0.005,
  targetC:AUTO_TARGETS
 });
 const clamp=(n,min=0,max=1)=>Math.max(min,Math.min(max,n));
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 const copy=x=>({...x});
 function create(){
  return {positions:{CONT:0.5,PASS:0.5},
   temperatures:{CONT:20,PASS:20},
   ductTemperatures:{CONT:22,PASS:22},
   valveDemand:{CONT:0.5,PASS:0.5},
   targetTemperatures:{CONT:22,PASS:22},
   overheatLatched:{CONT:false,PASS:false},
   command:{CONT:'HOLD',PASS:'HOLD'},reason:{CONT:'SENSOR_UNKNOWN',PASS:'SENSOR_UNKNOWN'}};
 }
 function angle(position){return -64+128*clamp(position);}
 function sample(inputs,side){
  const v=inputs?.[side]||{};
  return {selector:SELECTORS.includes(v.selector)?v.selector:'AUTO NORM',
   cabinC:finite(v.cabinC)?v.cabinC:null,ductC:finite(v.ductC)?v.ductC:null,
   packMode:['OFF','AUTO','HIGH'].includes(v.packMode)?v.packMode:null,
   packAirAvailable:typeof v.packAirAvailable==='boolean'?v.packAirAvailable:null,
   actuatorPower:typeof v.actuatorPower==='boolean'?v.actuatorPower:null,
   indicatorPower:typeof v.indicatorPower==='boolean'?v.indicatorPower:null,
   indicatorCB:v.indicatorCB!==false,
   overheat:v.overheat===true,stuck:v.stuck===true,
   benchBypassPack:v.benchBypassPack===true,
   transmitterFailed:v.transmitterFailed===true,
   targetC:finite(v.targetC)?v.targetC:null};
 }
 function resetOverheat(s,side,inputs){
  if(!SIDES.includes(side))throw Error('Invalid valve side');
  const v=sample(inputs,side);
  if(v.overheat||(v.ductC!==null&&v.ductC>=CONFIG.overheatC))return false;
  s.overheatLatched[side]=false;return true;
 }
 function step(state,inputs,elapsedSeconds){
  const next={positions:copy(state.positions),overheatLatched:copy(state.overheatLatched),
   command:copy(state.command),reason:copy(state.reason),
   temperatures:copy(state.temperatures||{CONT:20,PASS:20}),
   ductTemperatures:copy(state.ductTemperatures||{CONT:22,PASS:22}),
   valveDemand:copy(state.valveDemand||{CONT:0.5,PASS:0.5}),
   targetTemperatures:copy(state.targetTemperatures||{CONT:22,PASS:22})};
  const dt=finite(elapsedSeconds)?clamp(elapsedSeconds,0,3600):0;
  for(const side of SIDES){
   const v=sample(inputs,side),oldPos=clamp(next.positions[side]);
   const temperature=finite(v.cabinC)?v.cabinC:finite(next.temperatures[side])?next.temperatures[side]:20;
   const target=finite(v.targetC)?v.targetC:(AUTO_TARGETS[v.selector]??null);
   let desired=oldPos,reason='HOLD';
   if(v.overheat||(v.ductC!==null&&v.ductC>=CONFIG.overheatC))next.overheatLatched[side]=true;
   if(next.overheatLatched[side]){desired=0;reason='DUCT_OVERHEAT_LATCH';}
   else if(v.packMode==='OFF'&&!v.benchBypassPack){desired=0;reason='PACK_OFF_FULL_COLD';}
   else if(v.ductC!==null&&v.ductC>=CONFIG.ductLimitC){desired=0;reason='DUCT_LIMIT_COOL';}
   else if(v.selector==='MANUAL COOL'){desired=0;reason='MANUAL_COOL';}
   else if(v.selector==='MANUAL WARM'){desired=1;reason='MANUAL_WARM';}
   else if(target!==null){
    const error=target-temperature;
    // Feed-forward supplies the heat required to HOLD each setpoint; error
    // adds proportional effort, so large differences command more travel.
    desired=clamp(0.5+(target-CONFIG.neutralC)/(CONFIG.hotSupplyC-CONFIG.coldSupplyC)
     +CONFIG.proportionalGain*error);
    reason=Math.abs(error)<=CONFIG.deadbandC?'AUTO_DEADBAND':error>0?'AUTO_HEAT_DEMAND':'AUTO_COOL_DEMAND';
   }else reason='SENSOR_UNKNOWN';
   let direction=Math.abs(desired-oldPos)<=CONFIG.valveTolerance?0:Math.sign(desired-oldPos);
   // Small sensor excursions near the established setpoint do not hunt
   // the actuator. A different demanded equilibrium is still attainable.
   if(reason==='AUTO_DEADBAND'&&Math.abs(desired-oldPos)<=0.03)direction=0;
   if(v.stuck){direction=0;reason='ACTUATOR_STUCK';}
   else if(v.actuatorPower!==true){direction=0;reason=v.actuatorPower===false?'ACTUATOR_UNPOWERED':'ACTUATOR_POWER_UNKNOWN';}
   const travel=dt/(v.benchBypassPack?CONFIG.benchFullTravelSeconds:CONFIG.fullTravelSeconds);
   const moved=direction?oldPos+Math.sign(desired-oldPos)*Math.min(Math.abs(desired-oldPos),travel):oldPos;
   next.positions[side]=clamp(moved);
   next.valveDemand[side]=desired;
   next.targetTemperatures[side]=target;
   next.command[side]=direction<0?'COLD':direction>0?'HOT':'HOLD';
   next.reason[side]=v.benchBypassPack&&v.packMode==='OFF'&&reason!=='DUCT_OVERHEAT_LATCH'?'BENCH_'+reason:reason;
   const supply=CONFIG.coldSupplyC+(CONFIG.hotSupplyC-CONFIG.coldSupplyC)*next.positions[side];
   next.ductTemperatures[side]=supply;
   // External measured temperature (when supplied) is authoritative.
   // Otherwise integrate cabin temperature only with a running PACK/bench air.
   if(v.cabinC!==null)next.temperatures[side]=v.cabinC;
   else {
    const airflow=(v.packMode!=='OFF'&&v.packAirAvailable!==false)||v.benchBypassPack;
    const equilibrium=airflow?supply:CONFIG.neutralC;
    const tau=airflow?CONFIG.temperatureTauSeconds:CONFIG.idleTauSeconds;
    next.temperatures[side]=clamp(temperature+(equilibrium-temperature)*
     (1-Math.exp(-dt/tau)),-30,70);
   }
  }
  return next;
 }
 function indication(state,inputs,side){
  if(!SIDES.includes(side))throw Error('Invalid valve side');
  const v=sample(inputs,side);
  const valid=v.indicatorPower!==false&&v.indicatorCB&&!v.transmitterFailed;
  return {valid,position:valid?clamp(state.positions[side]):null,
   angle:valid?angle(state.positions[side]):null,
   powerKnown:v.indicatorPower!==null,reason:!v.indicatorCB?'CB_P6-4_D3_OPEN':
    v.indicatorPower===false?'DC_BUS_2_UNPOWERED':
    v.transmitterFailed?'TRANSMITTER_FAILED':v.indicatorPower===null?'INDICATION_POWER_UNKNOWN':'OK'};
 }
 return Object.freeze({SIDES,SELECTORS,AUTO_TARGETS,GAUGES,SOURCE,CONFIG,create,step,indication,resetOverheat,angle,sample});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./air-mix-valve-300500-unified-v1.js?v=AIR-MIX-300500-THERMAL-0002 */
try{
/* Unified 737-300/500, nonintrusive OH20 pair of independent single-needle indicators & backend adapter.
 * Source/atlas/Owner18/400 panels remain untouched.
 */
(function(){
 'use strict';
 const model=window.B737AirMixValve300500V1;
 if(!model){console.error('AIR-MIX-300500 model missing');return;}
 const SVG='http://www.w3.org/2000/svg',PROFILE='b737classic.aircraft-profile.v1',CB='b737classic.cb.v1';
 const sprite=new URL('./assets/air-mix-valve-300500-reference-needle-v2.svg?v=AIR-MIX-300500-RESTORED-SIZE-0001',document.baseURI).href;
 const state={CONT:{cabinC:null,ductC:null,overheat:false,stuck:false,transmitterFailed:false,targetC:null},
  PASS:{cabinC:null,ductC:null,overheat:false,stuck:false,transmitterFailed:false,targetC:null}};
 let engine=model.create(),frame=null,layer=null,assemblies={},last=performance.now(),trainingPower=null;
 const $=id=>document.getElementById(id);
 function family(){return window.B737AircraftProfileStore?.get()?.aircraftFamily==='B737-400'?'B737-400':'B737-300-500';}
 function child(){try{return frame?.contentWindow;}catch{return null;}}
 function createSvg(doc,parent,tag,attrs={}){
  const el=doc.createElementNS(SVG,tag);for(const [name,value]of Object.entries(attrs))el.setAttribute(name,String(value));parent.append(el);return el;
 }
 // OH20 source photograph contains an upright white needle baked into EACH gauge.
 // Occlude only that narrow, unchanging photo pointer with a feathered face-tone
 // strip before mounting the owner-approved moving needle.  This is a separate
 // overlay; the immutable OH20 photo, its tick marks, and the atlas are untouched.
 function concealPhotoNeedle(doc,g,side){
  const key='airMixPhotoPointerV2'+side;
  const defs=createSvg(doc,g,'defs');
  const face=createSvg(doc,defs,'linearGradient',{id:key+'Face',x1:'0',y1:'-68',x2:'0',y2:'8',gradientUnits:'userSpaceOnUse'});
  for(const [offset,color] of [['0%','#272621'],['18%','#362f29'],['48%','#342d26'],['80%','#2d2823'],['100%','#272521']]){
   createSvg(doc,face,'stop',{offset,'stop-color':color});
  }
  // Two independent feather gradients keep the narrow concealer inside
  // the original photograph's color field, without a hard rectangular seam.
  const fade=createSvg(doc,defs,'linearGradient',{id:key+'Fade',x1:'-9',y1:'0',x2:'9',y2:'0',gradientUnits:'userSpaceOnUse'});
  for(const [offset,color] of [['0%','#000'],['18%','#fff'],['82%','#fff'],['100%','#000']]){
   createSvg(doc,fade,'stop',{offset,'stop-color':color});
  }
  const endFade=createSvg(doc,defs,'linearGradient',{id:key+'EndFade',x1:'0',y1:'-68',x2:'0',y2:'8',gradientUnits:'userSpaceOnUse'});
  for(const [offset,color] of [['0%','#000'],['8%','#fff'],['92%','#fff'],['100%','#000']]){
   createSvg(doc,endFade,'stop',{offset,'stop-color':color});
  }
  const mask=createSvg(doc,defs,'mask',{id:key+'Mask',x:'-9',y:'-68',width:'18',height:'76',maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse'});
  createSvg(doc,mask,'rect',{x:-9,y:-68,width:18,height:76,fill:'url(#'+key+'Fade)'});
  const endMask=createSvg(doc,defs,'mask',{id:key+'EndMask',x:'-9',y:'-68',width:'18',height:'76',maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse'});
  createSvg(doc,endMask,'rect',{x:-9,y:-68,width:18,height:76,fill:'url(#'+key+'EndFade)'});
  const group=createSvg(doc,g,'g',{mask:'url(#'+key+'EndMask)'});
  createSvg(doc,group,'rect',{'data-air-mix-concealed-photo-needle':side,x:-9,y:-68,width:18,height:76,
   fill:'url(#'+key+'Face)',mask:'url(#'+key+'Mask)', 'pointer-events':'none'});
 }
 function syncLayer(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  const plate=host?.querySelector('.atlas-piece[data-key="OH20"]'),strip=plate?.querySelector('.atlas-source-strip');
  if(!plate||!strip)return false;
  if(!layer||!layer.isConnected){
   layer=createSvg(doc,host,'svg',{'data-air-mix-valve-300500':'true',viewBox:'0 0 1254 1254',preserveAspectRatio:'none',
    'aria-label':'737-300/500 air mix valve position needles'});
   Object.assign(layer.style,{position:'absolute',zIndex:'1007',pointerEvents:'none',overflow:'hidden'});
   assemblies={};
   for(const side of model.SIDES){
    const p=model.GAUGES[side],g=createSvg(doc,layer,'g',{'data-air-mix-side':side,transform:'translate('+p.x+' '+p.y+')'});
    // Original photo pointer remains at the old source coordinate (224,425)/(1021,425).
    // Keep its concealment fixed while the calibrated moving pivot shifts (+2,-2).
    const photographMask=createSvg(doc,g,'g',{transform:'translate(-2 2)','data-photo-pointer-mask':side});
    concealPhotoNeedle(doc,photographMask,side);
    const rotary=createSvg(doc,g,'g',{'data-air-mix-rotor':side});
    // Native SVG rotation around the actual gauge shaft; CSS transform-origin on <g> was not reliable.
    rotary.setAttribute('transform','rotate(0 0 0)');
    createSvg(doc,rotary,'image',{href:sprite,x:-128,y:-128,width:256,height:256});
    assemblies[side]=g;
   }
  }
  const n=v=>Number.parseFloat(v)||0;
  Object.assign(layer.style,{left:(n(plate.style.left)+n(strip.style.left))+'px',
   top:(n(plate.style.top)+n(strip.style.top))+'px',width:strip.style.width,height:strip.style.height,
   display:family()==='B737-300-500'?'block':'none'});
  return true;
 }
 function cbClosed(){
  try{
   const s=JSON.parse(localStorage.getItem(CB)||'null'),variant=window.B737AircraftProfileStore?.get()?.pressurization==='DCPCS'?'DCPCS':'CPCS';
   if(!s||!Array.isArray(s.breakers))return true; // no pulled CBs persisted
   return !s.breakers.some(b=>b.id==='P6-4|'+variant+'|D3'&&(b.pulled||b.tripped));
  }catch{return true;}
 }
 function bus(){
  try{return window.B737ISNCockpitV1?.getState()?.state?.electrical?.bus||null;}catch{return null;}
 }
 function bool(v){return typeof v==='boolean'?v:null;}
 function inputs(){
  const w=child(),rot=w?.B737RotaryGuards?.getState?.()?.rotaries||{},tog=w?.B737OverheadToggles?.getState?.()||{},b=bus();
  const livePack=window.B737AirconFCOMUnifiedV1?.getState?.()?.derived?.pack||null;
  const ac=b?Boolean(b.transfer1===true||b.transfer2===true):null;
  const power=trainingPower===null?ac:trainingPower;
  // Bench override simulates BOTH 115V actuator and 28V indicator supply;
  // it bypasses PACK OFF only for training, never in the normal cockpit mode.
  const result={};
  for(const side of model.SIDES){
   const meta=model.GAUGES[side],selector=rot[meta.selector];
   result[side]={...state[side],
    cabinC:state[side].cabinC,
    benchSensor:trainingPower===true&&state[side].cabinC===null,
    selector:model.SELECTORS.includes(selector)?selector:'AUTO NORM',
    packMode:['OFF','AUTO','HIGH'].includes(tog[meta.pack])?tog[meta.pack]:null,
    packAirAvailable:trainingPower===true?true:typeof livePack?.[side==='CONT'?'L':'R']?.operational==='boolean'?
     livePack[side==='CONT'?'L':'R'].operational:null,
    actuatorPower:power,indicatorPower:trainingPower===true?true:bool(b?.dc2),
    indicatorCB:cbClosed(),benchBypassPack:trainingPower===true};
  }
  return result;
 }
 function render(x){
  if(!syncLayer())return;
  for(const side of model.SIDES){
   const g=assemblies[side],rotor=g?.querySelector('[data-air-mix-rotor]');if(!g||!rotor)continue;
   const value=model.indication(engine,x,side);
   // A mechanical pointer must not visually disappear just because supply is lost.
   // For unknown/unpowered indication hold the last visibly observed needle angle.
   g.style.visibility='visible';
   if(value.valid)rotor.setAttribute('transform','rotate('+value.angle.toFixed(3)+' 0 0)');
   g.setAttribute('data-selector',x[side].selector);
   g.setAttribute('data-pack-mode',x[side].packMode||'UNKNOWN');
   g.setAttribute('data-indication-valid',String(value.valid));
   g.setAttribute('data-air-mix-position',engine.positions[side].toFixed(5));
   g.setAttribute('data-air-mix-valid',String(value.valid));
   g.setAttribute('aria-label',side+' '+Math.round(engine.positions[side]*100)+' percent hot; '+value.reason);
  }
  const readout=$('airMix300500Readout');
  if(readout)readout.textContent=model.SIDES.map(side=>side+' '+x[side].selector+
   ' / '+engine.temperatures[side].toFixed(1)+'°C ACTUAL / '+(engine.targetTemperatures[side]===null?'MANUAL':engine.targetTemperatures[side]+'°C TARGET')+
   ' / PACK '+(x[side].packMode||'UNKNOWN')+' / '+Math.round(engine.positions[side]*100)+'% HOT'+
   ' / '+engine.command[side]+' / '+engine.reason[side]+
   ' / '+model.indication(engine,x,side).reason).join('\n');
 }
 function tick(){
  const now=performance.now(),dt=Math.max(0,Math.min(1,(now-last)/1000));last=now;
  if(family()!=='B737-300-500'){if(layer)layer.style.display='none';return;}
  const x=inputs();engine=model.step(engine,x,dt);render(x);
  // The single TEMP indicator displays ONLY the physical source selected.
  // Cabin readings are independent of the target temperature.
  const rot=child()?.B737RotaryGuards?.getState?.()?.rotaries||{};
  const tempSource=rot['temperature-source']||'CONT CABIN';
  const indicatedC=tempSource==='PASS CABIN'?engine.temperatures.PASS:
   tempSource==='SUPPLY DUCT'?(engine.ductTemperatures.CONT+engine.ductTemperatures.PASS)/2:
   engine.temperatures.CONT;
  if(Number.isFinite(indicatedC))window.B737UnifiedCabinTemperatureNeedle?.setTemperature(indicatedC);
  window.dispatchEvent(new CustomEvent('b737:air-mix-valve-300500-state',
   {detail:{positions:{...engine.positions},temperatures:{...engine.temperatures},
    targets:{...engine.targetTemperatures},ductTemperatures:{...engine.ductTemperatures},
    selectedTemperatureSource:tempSource,indicatedC,
    command:{...engine.command},reason:{...engine.reason},
    power:{CONT:x.CONT.indicatorPower,PASS:x.PASS.indicatorPower}}}));
 }
 function setInputs(side,data){
  if(!model.SIDES.includes(side)||!data||typeof data!=='object')throw Error('Invalid air mix input');
  const fields=['cabinC','ductC','overheat','stuck','transmitterFailed','targetC'];
  for(const k of fields)if(Object.prototype.hasOwnProperty.call(data,k)){
   const v=data[k];if(['cabinC','ductC','targetC'].includes(k)){if(v!==null&&!(typeof v==='number'&&Number.isFinite(v)))throw Error('Invalid '+k);}
   else if(typeof v!=='boolean')throw Error('Invalid '+k);
   state[side][k]=v;
  }
  tick();return getState();
 }
 function getState(){return {family:family(),engine:JSON.parse(JSON.stringify(engine)),inputs:inputs(),trainingPower};}
 function reset(){engine=model.create();for(const side of model.SIDES)Object.assign(state[side],{cabinC:null,ductC:null,overheat:false,stuck:false,transmitterFailed:false,targetC:null});trainingPower=null;tick();}
 function connect(){
  const next=$('overheadFrame');if(!next)return;
  if(next!==frame){frame=next;frame.addEventListener('load',()=>{layer=null;assemblies={};syncLayer();});}
  syncLayer();
 }
 function panel(){
  const anchor=$('inspector');if(!anchor||$('airMix300500Lab'))return;
  const section=document.createElement('section');section.id='airMix300500Lab';section.dir='ltr';
  const h=document.createElement('h2');h.textContent='AIR MIX VALVE · 300/500 · CLOSED-LOOP';section.append(h);
  const note=document.createElement('p');note.className='muted';note.textContent='Real selector positions drive independent COLD/HOT valves. PACK OFF drives COLD in normal mode. Training AC ON is a clearly marked bench override (115V actuator + 28V indicator, temporary PACK OFF bypass). The real P6-4/D3 CB still cuts indication. Cabin sensors start at 20°C and evolve independently with thermal inertia; injected numeric sensor readings override the simulation for fault training. Detent targets and timing are training estimates.';section.append(note);
  for(const side of model.SIDES){
   const label=document.createElement('label');label.textContent=side+' CABIN SENSOR °C';label.style.display='block';
   const inp=document.createElement('input');Object.assign(inp,{type:'number',min:'-30',max:'70',step:'0.5',placeholder:'Unknown'});
   inp.style.width='85px';inp.addEventListener('change',()=>setInputs(side,{cabinC:inp.value===''?null:Number(inp.value)}));
   label.append(inp);section.append(label);
  }
  const label=document.createElement('label');label.textContent='Power / Bench mode';label.style.display='block';
  const select=document.createElement('select');
  for(const [v,name] of [['AUTO','Aircraft power + real PACK logic'],['ON','Bench TEST: 115V + 28V, permit selector with PACK OFF'],['OFF','Instructor actuator power OFF']]){
   const opt=document.createElement('option');opt.value=v;opt.textContent=name;select.append(opt);
  }
  select.addEventListener('change',()=>{trainingPower=select.value==='AUTO'?null:select.value==='ON';tick();});label.append(select);section.append(label);
  const read=document.createElement('p');read.id='airMix300500Readout';read.style.fontSize='12px';read.style.lineHeight='1.7';read.style.whiteSpace='pre-line';read.style.overflowWrap='anywhere';section.append(read);
  const resetButton=document.createElement('button');resetButton.type='button';resetButton.textContent='Reset air-mix training state';
  resetButton.onclick=()=>{reset();select.value='AUTO';for(const input of section.querySelectorAll('input'))input.value='';};
  section.append(resetButton);anchor.append(section);
 }
 window.B737AirMix300500UnifiedV1=Object.freeze({getState,setInputs,reset,
  setTrainingPower:v=>{if(v!==null&&typeof v!=='boolean')throw Error('Power must be boolean or null');trainingPower=v;tick();},
  resetOverheat:side=>model.resetOverheat(engine,side,inputs()),sync:()=>{connect();tick();}});
 window.addEventListener('b737:cockpit-mounted',connect);
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
  const d=event.data;
  if(d?.type==='b737:cockpit-overhead'&&d.kind==='control-event'&&
     ['control-cabin-temp','pass-cabin-temp','pack-l','pack-r'].includes(d.event?.id))tick();
 });
 window.addEventListener('b737:aircraft-profile-change',()=>{connect();tick();});
 window.addEventListener('storage',e=>{if(e.key===CB||e.key===PROFILE)tick();});
 window.addEventListener('b737:aircon300500-inputs',e=>{for(const [side,data] of Object.entries(e.detail||{}))if(model.SIDES.includes(side))setInputs(side,data);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{connect();panel();},{once:true});else{connect();panel();}
 setInterval(tick,160);
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
