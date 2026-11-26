/* 737 Classic FCOM D6-27370-300/400/500-SHI 7.10.1–7.10.2, 4.10.26.
 * Thrust MODE DISPLAY, not the A/T FMA and not a thrust command.
 * Source priority: valid FMC limit mode > confirmed TO/GA > explicitly
 * marked trainer-flight-phase estimate > no computed N1 limit (----).
 * The real Boeing mode-transition scheduling cannot be inferred from IAS
 * or selected MCP altitude alone. All non-FMC phases are TRAINING proxies.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)api.mount(root);
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const MODES=Object.freeze(['TO','R-TO','CLB','R-CLB','CRZ','G/A','CON','----']);
 const VALID=new Set(MODES);
 const info=(value,origin)=>Object.freeze({mode:value,origin,confirmed:origin==='FMC_CONFIRMED'});
 function resolve(input={}){
  const fmcMode=typeof input.fmcMode==='string'?input.fmcMode.trim().toUpperCase():null;
  if(input.togaPhase==='GA')return info('G/A','SIMULATED_FCC_TOGA');
  if(input.togaPhase==='TO')return info('TO','SIMULATED_FCC_TOGA');
  if(input.fmcConfirmed===true&&VALID.has(fmcMode))return info(fmcMode,'FMC_CONFIRMED');
  // Flight scenario fallbacks are approximate, not authoritative FMC limits.
  if(input.phase==='TAKEOFF_ROLL')return info('TO','TRAINING_PHASE_PROXY');
  if(input.phase==='INITIAL_CLIMB'&&Number(input.elapsedSec)>=50)
   return info('CLB','TRAINING_PHASE_PROXY');
  if(input.phase==='CRUISE')return info('CRZ','TRAINING_PHASE_PROXY');
  if(input.phase==='ENGINE_OUT_CONTINUOUS')return info('CON','TRAINING_PHASE_PROXY');
  return info('----','NO_COMPUTED_N1_LIMIT');
 }
 function mount(win){
  const doc=win.document;
  let face=null,tat=null,mode=null,revision=0,fmcPacket=null;
  function fmcSignal(){
   const net=win.B737UnifiedAvionicsNetworkV1;
   const record=net?.getSignal?.('fmc.computed');
   const value=record?.quality==='VALID'?record.value:null;
   const raw=value?.performance?.n1LimitMode??value?.n1Limit?.mode??value?.thrustLimitMode;
   if(VALID.has(raw))return {mode:raw,confirmed:true};
   return fmcPacket&&fmcPacket.confirmed===true?fmcPacket:{mode:null,confirmed:false};
  }
  function observation(){
   const s=win.B737UnifiedFlightScenarioV1?.getState?.();
   const toga=win.B737UnifiedTOGACh4V1?.getState?.();
   const fmc=fmcSignal();
   return {phase:s?.phase??null,elapsedSec:s?.elapsedSec??0,
    togaPhase:toga?.phase??'OFF',fmcMode:fmc.mode,fmcConfirmed:fmc.confirmed};
  }
  function present(){
   const piece=doc.querySelector('#region-main .texture-piece[data-piece="engine"]');
   if(!piece)return false;
   if(!face||face.parentNode!==piece){
    face?.remove();
    face=doc.createElement('output');
    face.id='unifiedThrustModeDisplayFcom';
    face.className='unified-tmd-fcom';
    face.setAttribute('aria-label','Thrust Mode Display, FMC N1 limit');
    face.setAttribute('role','status');
    piece.appendChild(face);
    tat?.remove();
    tat=doc.createElement('output');tat.className='unified-tat-eis';
    tat.setAttribute('aria-label','Total air temperature, training ISA model, degrees Celsius');piece.appendChild(tat);
   }
   const eis=doc.documentElement.dataset.engineIndication!=='CONVENTIONAL';
   const bus=win.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
   const feeds=['generator1','generator2','transfer1','transfer2','dc1','dc2','acStandby','battery','switchedHotBattery','dcStandby'];
   const dark=!!bus&&feeds.every(id=>bus[id]===false);
   const visible=eis&&!dark;
   const flight=win.B737UnifiedFlightScenarioV1?.getState?.();
   const alt=Number.isFinite(flight?.altitudeFt)?flight.altitudeFt:0;
   const mach=Number.isFinite(flight?.mach)?flight.mach:Number.isFinite(flight?.tasKt)?Math.min(.95,Math.max(0,flight.tasKt/660)):0;
   const sat=15-1.98*Math.min(36089,alt)/1000;
   const temperature=Math.round((sat+273.15)*(1+.2*mach*mach)-273.15);
   tat.hidden=!visible;tat.textContent=(temperature>=0?'+':'')+temperature;
   tat.title='ISA +15°C sea level, 1.98°C per 1000 ft, ideal ram rise (training approximation)';
   const next=resolve(observation());
   const changed=mode?.mode!==next.mode||mode?.origin!==next.origin||face.hidden===visible;
   if(changed){
    face.hidden=!visible;
    if(face.textContent!==next.mode)face.textContent=next.mode;
    face.dataset.source=next.origin;
    face.title='FCOM 7.10.1–2 · '+next.origin+
     (next.confirmed?' · VERIFIED FMC LIMIT':' · NOT A CERTIFIED N1 LIMIT');
    face.dataset.confirmed=String(next.confirmed);
    revision++;
   }
   mode=next;
   return true;
  }
  function confirmedEvent(e){
   const p=e.detail;
   if(p?.confirmed!==true||p.source!=='FMC'||!VALID.has(p.mode))return;
   fmcPacket={mode:p.mode,confirmed:true};
   present();
  }
  win.addEventListener('b737:fmc-n1-limit-mode',confirmedEvent);
  win.addEventListener('b737:thrust-limit-mode',confirmedEvent);
  win.addEventListener('b737:flight-scenario-stopped',()=>{fmcPacket=null;present();});
  for(const ev of ['b737:cockpit-mounted','b737:engine-indication-view',
   'b737:flight-scenario-state','b737:toga-mode','b737:aircraft-profile-change',
   'b737:unified-ecu-observation','b737:electrical-v7-state','b737:electrical-network'])
   win.addEventListener(ev,present);
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',present,{once:true});
  else present();
  win.B737UnifiedThrustModeDisplayV1=Object.freeze({version:'FCOM-TMD-0001',
   getState:()=>({...(mode||resolve()),revision,mounted:!!face&&face.isConnected}),
   update:present});
  return win.B737UnifiedThrustModeDisplayV1;
 }
 return Object.freeze({version:'FCOM-TMD-0001',MODES,resolve,mount});
});
