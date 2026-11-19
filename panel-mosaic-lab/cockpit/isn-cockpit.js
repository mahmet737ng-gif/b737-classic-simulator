(function(){
 'use strict';
 const moduleBase=document.currentScript.src;
 // Cockpit-visible feedback stays outside the hidden instructor strip.
 // Locked overhead imagery, guarded switches and gauge geometry are untouched.
 function startFeedback(message,severity='progress'){
  let node=document.getElementById('unifiedEngineStartFeedback');
  if(!node){node=document.createElement('div');node.id='unifiedEngineStartFeedback';
   node.setAttribute('role','status');node.setAttribute('aria-live','polite');document.body.append(node);}
  node.hidden=!message;
  node.dataset.severity=severity;
  if(node.textContent!==message)node.textContent=message;
 }
 const deps=[
  ['B737PneumaticsV6','../../engine/systems/pneumatics-v6.js'],
  ['B737ISNEngineAPUV1','../../engine/integration/isn-engine-apu-v1.js'],
  ['B737ISNStartSequenceV1','../../engine/integration/isn-start-sequence-v1.js'],
  ['B737ISNEngineStartDynamicsV1','../../engine/integration/isn-engine-start-dynamics-v1.js'],
  ['B737ISNAPUStartChainV1','../../engine/integration/isn-apu-start-chain-v1.js'],
  ['B737ISNStartIndicationsV1','../../engine/integration/isn-start-indications-v1.js'],
  ['B737ISNFuelShutoffIndicatorV1','../../engine/integration/isn-fuel-shutoff-indicator-v1.js'],
  ['B737ISNUnifiedControlRouterV1','../../engine/integration/isn-unified-control-router-v1.js'],
  ['B737ISNThrustPerformanceV1','../../engine/integration/isn-thrust-performance-v1.js'],
   ['B737ClassicFuelSystemV1','../../engine/systems/classic-fuel-system-v1.js'],
  ['B737ISN0912RuntimeV1','../../engine/integration/isn-09-12-runtime-v1.js'],
  ['B737ISNAPULoadDynamicsV1','../../engine/integration/isn-apu-load-dynamics-v1.js'],
  ['B737ISN1318ECUTestbenchV1','../../engine/integration/isn-13-18-ecu-testbench-v1.js'],
  ['B737UnifiedLiveGatewayV1','../../engine/runtime/unified-live-gateway-v1.js'],
  ['B737Owner18ElectricalInputV1','../../engine/runtime/owner18-electrical-input-v1.js'],
  ['B737UnifiedAuthorityDiagnosticsV1','../../engine/runtime/unified-authority-diagnostics-v1.js']
 ];
 async function loadDependencies(){
  // Dynamic script async=false preserves evaluation order even though all
  // scripts download concurrently. Previously each file had to finish before
  // the next request started (14 serial round trips on a cold mobile load).
  // Do not use async=true or Promise.all over independently executing scripts:
  // ECU modules have ordered global dependencies and a single shared owner.
  const requests=[];
  for(const [global,path] of deps){
   if(window[global])continue;
   requests.push(new Promise((resolve,reject)=>{
    const script=document.createElement('script');
    script.async=false;
    script.src=new URL(path,moduleBase).href+'?cb=CB-UNIFIED-0001&v='+(global==='B737ISN1318ECUTestbenchV1'?'APU-OIL4-0001-ENG-OIL-DYNAMIC-0002':global==='B737PneumaticsV6'?'AIRCON-FCOM-0001':global==='B737ISNUnifiedControlRouterV1'?'ENGINE-START-ACK-0001':global==='B737ClassicFuelSystemV1'?'ATA28-FAILURES-FUEL-0002':'ELEC-LIVE-0001');
    script.onload=resolve;
    script.onerror=()=>reject(Error('Missing integration script '+path));
    document.head.append(script);
   }));
  }
  await Promise.all(requests);
  for(const [global,path] of deps)if(!window[global])
   throw Error('Integration module did not register '+global+' from '+path);
 }
 function init(){
 const byId=id=>document.getElementById(id);
 const Pack=window.B737ISNElectricalPackV1,Adapter=window.B737ISNCockpitBridgeV1;
 if(!Pack||!Adapter){console.error('ISN-02: missing integration modules');return;}
 // Shared ECU: physical cockpit controls and engine gauges use one real-time
 // ISN-18 session; no separate compressed startup chain in Unified.
 const ecu=new window.B737ISN1318ECUTestbenchV1.Testbench({
  Electrical:window.B737ElectricalV7,Loads:window.B737ElectricalLoadsV8,
  TrainerCore:window.B737TrainerCore,WarningEngine:window.B737WarningEngine.WarningEngine,
  Pneumatics:window.B737PneumaticsV6,Pack,
  EngineAPU:window.B737ISNEngineAPUV1,Start:window.B737ISNStartSequenceV1,
  Chain:window.B737ISNAPUStartChainV1,
  ThrustPlanner:window.B737ISNThrustPerformanceV1,
  FuelRuntime:window.B737ISN0912RuntimeV1,FuelSystem:window.B737ClassicFuelSystemV1,timingProfile:'REALTIME_TRAINING'});
 // ATA24 owns the physical source-current estimate; the ECU consumes it
 // to update its EXISTING generator governor/EGT/fuel model. This listener
 // never changes source selection, electrical state, or needle geometry.
 window.addEventListener('b737:electrical-demand-estimate',e=>{
  const amps=e.detail?.sourceAmps?.APU;
  if(Number.isFinite(amps))ecu.observeAPUSourceAmps(amps);
 });
 const startSession=ecu.start,chain=ecu.chain,session=startSession.core.pack;
 const bridge=new Adapter.Bridge(session,{sourceOwner:'ISN03_START_SESSION'});
 const fuelValveIndication=window.B737ISNFuelShutoffIndicatorV1.create({travelMs:820});
 const pendingEvents=[];
 const strip=document.createElement('section');strip.id='isnStartIndications';strip.className='isn-start-indications';
 strip.setAttribute('aria-label','ISN-03 engine start training indications');
 strip.innerHTML='<div class="isn-engine-card isn-apu-card" data-apu-phase="OFF" role="status"><b>APU</b><span data-apu-field="phase">OFF</span><span>RPM <strong data-apu-field="rpm">0%</strong></span><span>EGT <strong data-apu-field="egt">—</strong></span><span>AC <strong data-apu-field="generator">0 V</strong></span><span>TIME <strong data-apu-field="time">0s</strong></span></div>'+
 [1,2].map(n=>'<div class="isn-engine-card" data-engine="engine'+n+'" role="status"><b>ENG '+n+'</b><span data-field="phase">OFF</span><span>N1 <strong data-field="n1">0%</strong></span><span>N2 <strong data-field="n2">0%</strong></span><span>EGT <strong data-field="egt">—</strong></span><span>FUEL <strong data-field="fuel">0 kg/h</strong></span><span>OIL <strong data-field="oil">0 PSI</strong></span><span>START VALVE <strong data-field="valve">UNKNOWN</strong></span></div>').join('')+
 '<p class="isn-indication-error" id="isnIndicationError" role="alert"></p>';
 document.querySelector('.workbench .toolbar').after(strip);
 const cards=Object.fromEntries([1,2].map(n=>['engine'+n,strip.querySelector('[data-engine="engine'+n+'"]')]));
 const panel=document.createElement('section');panel.className='isn-bridge-panel';panel.id='isnBridgePanel';
 panel.innerHTML='<h2>ISN-02 · Live Cockpit Network</h2><p id="isnStatus" role="status">Waiting for Overhead Switch States…</p><p class="isn-note">Source-Gated outputs follow documented evidence. Exact supply paths for eight pumps remain UNKNOWN; training overrides are clearly distinguished.</p><button id="isnMode" type="button" aria-pressed="false">Training Surrogate · OFF</button><div class="isn-buses" id="isnBuses"></div><details><summary>Instructor Controls · No Physical Switch</summary><label class="isn-setting"><input type="checkbox" id="isnBusTransfer" checked> BUS TRANSFER AUTO · OH12 Physical Switch State</label><label class="isn-setting"><input type="checkbox" id="isnGen1Fault"> GEN 1 FAILED · Instructor Injection</label><label class="isn-setting"><input type="checkbox" id="isnGen2Fault"> GEN 2 FAILED · Instructor Injection</label><button id="isnReset" type="button">Reset ISN Engine from Current Cockpit State</button></details><div class="isn-scroll"><table class="isn-table"><thead><tr><th>Physical Switch / Lamp</th><th>RUN</th><th>LOW PRESS</th><th>Power Evidence</th><th>Instructor Test</th></tr></thead><tbody id="isnPumpRows"></tbody></table></div><div class="isn-warnings" id="isnWarnings"></div><details><summary>Trace: Command → System → Lamp / Warning</summary><div id="isnTrace" class="isn-trace" dir="ltr"></div></details><p id="isnError" class="isn-error" role="status"></p>';
 const trainer=document.createElement('details');trainer.innerHTML='<summary>Documented Warnings · Instructor Scenario Inputs</summary><label class="isn-setting"><input id="isnFire1" type="checkbox"> ENGINE 1 FIRE · Test Input</label><label class="isn-setting"><input id="isnCabinHigh" type="checkbox"> CABIN ALTITUDE 12000 ft · Test Input</label><button id="isnAckFire" type="button">Fire Bell Acknowledge</button><button id="isnCutoutCabin" type="button">Cabin Horn Cutout</button>';
 panel.querySelector('.isn-warnings').after(trainer);
 const replayButton=document.createElement('button');replayButton.id='isnReplay';replayButton.type='button';replayButton.textContent='Replay Deterministic ISN Events';
 panel.querySelector('#isnTrace').after(replayButton);
 const startPanel=document.createElement('details');startPanel.open=true;startPanel.className='isn-start-panel';startPanel.innerHTML='<summary>ISN-18 · Unified ECU / APU / Engine Start</summary><p class="isn-note">The real overhead switches and pedestal Fuel Levers share the ECU engine. At training 35 PSI, start reaches RUNNING in approximately 65 seconds when fuel is introduced in time. Suction feed is supported from each engine&#39;s main tank; parameters are training estimates.</p><div id="isnStartStatus" role="status" dir="ltr">Waiting for overhead…</div><p id="isnStartLeverStatus" class="isn-lever-status" role="status" dir="ltr">ENG 1 CUTOFF · ENG 2 CUTOFF</p><p id="isnApuTelemetry" dir="ltr" role="status">APU OFF · EGT — · GEN OFF</p><p id="isnStartError" class="isn-error" role="alert"></p><details><summary>ECU starter duct pressure · instructor only</summary><label>ENG 1 DUCT (training PSI) <input id="unifiedStarterDuct1" type="number" min="20" max="50" value="35"></label><label>ENG 2 DUCT (training PSI) <input id="unifiedStarterDuct2" type="number" min="20" max="50" value="35"></label><p>This is not measured duct pressure; it only adjusts training engine start speed.</p></details><a href="../../isn-ecu-start-lab/">Independent ECU Testbench</a>';
 const faultControls=document.createElement('details');faultControls.className='isn-start-faults';
 faultControls.innerHTML='<summary>Training Failure Scenarios · Set Before GRD</summary><p>Instructor injection: stall N2 at 18% or raise EGT to 760°C. Injected values are not real engine behavior. The 725°C warning comes from the documented rules engine.</p><label><input type="checkbox" data-start-fault="engine1:n2Stall"> ENG 1 · N2 STALL</label><label><input type="checkbox" data-start-fault="engine1:egtHigh"> ENG 1 · EGT HIGH</label><label><input type="checkbox" data-start-fault="engine2:n2Stall"> ENG 2 · N2 STALL</label><label><input type="checkbox" data-start-fault="engine2:egtHigh"> ENG 2 · EGT HIGH</label>';
 startPanel.append(faultControls);
 panel.querySelector('.isn-note').after(startPanel);
 const anchor=document.querySelector('.aircraft-profile-summary');if(anchor)anchor.after(panel);else byId('inspector').prepend(panel);
 const quick=document.createElement('section');quick.className='isn-bridge-panel';quick.id='isnQuickEngineControls';
 quick.innerHTML='<h2>Engine Training Controls</h2><p>Quick Run moves the engine to IDLE directly. Quick Stop moves that engine&#39;s Fuel Start Lever to CUTOFF.</p>'+[1,2].map(n=>
  '<div><div class="isn-quick-engine-actions"><button type="button" id="isnQuickRun'+n+'">ENG '+n+' · Quick Run</button><button type="button" id="isnQuickStop'+n+'">ENG '+n+' · Quick Stop</button></div><label style="display:block">ENG '+n+' POWER <input id="isnQuickPower'+n+'" type="range" min="0" max="100" value="0" disabled><output id="isnQuickPowerValue'+n+'">0%</output></label><span id="isnQuickState'+n+'" role="status">OFF</span></div>').join('')+'<p id="isnQuickApuState" dir="ltr" role="status">APU ECU: checking…</p><p id="isnQuickError" role="alert"></p>';
 byId('inspector').prepend(quick);
 for(const n of [1,2]){
  byId('isnQuickRun'+n).onclick=()=>{
   try{ecu.instructorRunEngine('engine'+n,{instructor:true});byId('isnQuickError').textContent='';render();}
   catch(error){byId('isnQuickError').textContent=error.message;}
  };
  byId('isnQuickStop'+n).onclick=()=>{
   try{const engine='engine'+n;if(chain.get().phase[engine]==='RUNNING')ecu.setThrottle(engine,0);
    ecu.shutdown(engine);byId('isnQuickError').textContent='';render();}
   catch(error){byId('isnQuickError').textContent=error.message;}
  };
  byId('isnQuickPower'+n).oninput=event=>{
   try{ecu.setThrottle('engine'+n,Number(event.target.value)/100);
    window.dispatchEvent(new CustomEvent('b737:manual-engine-throttle',{detail:{engine:n,percent:Number(event.target.value),source:'INSTRUCTOR_SLIDER'}}));
    byId('isnQuickError').textContent='';render();}
   catch(error){byId('isnQuickError').textContent=error.message;}
  };
 }
 const node=new Map();
 const stateName=v=>v===null?'UNKNOWN':v?'ON':'OFF';
 const span=(v)=>{const n=document.createElement('span');n.className='isn-state '+(v===null?'unknown':v?'on':'off');n.textContent=stateName(v);return n;};
 const setter=(id,v)=>{const el=byId(id);el.replaceChildren(span(v));};
 for(const pump of Pack.PUMP_REGISTRY){
  const lamp=Adapter.LAMPS[pump.id],tr=document.createElement('tr');tr.dataset.pump=pump.id;
  const name=document.createElement('td');name.dir='ltr';name.textContent=lamp+' / '+pump.label;
  const run=document.createElement('td'),low=document.createElement('td'),evidence=document.createElement('td');evidence.className='isn-evidence';evidence.dir='ltr';
  const teacher=document.createElement('td'),fault=document.createElement('label');fault.className='isn-fault';
  const faultInput=document.createElement('input');faultInput.type='checkbox';faultInput.setAttribute('aria-label','Instructor failure '+pump.label);fault.append(faultInput,' FAIL');
  const observed=document.createElement('select');observed.setAttribute('aria-label','Observed power '+pump.label);
  for(const [value,label]of [['null','Power ?'],['true','Power ON'],['false','Power OFF']]){const o=document.createElement('option');o.value=value;o.textContent=label;observed.append(o);}
  faultInput.onchange=e=>{bridge.instructor({type:'PUMP_FAULT',id:pump.id,value:e.target.checked,instructor:true});render();};
  observed.onchange=e=>{bridge.instructor({type:'OBSERVED_POWER',id:pump.id,value:e.target.value==='null'?null:e.target.value==='true',instructor:true});render();};
  teacher.append(fault,observed);tr.append(name,run,low,evidence,teacher);byId('isnPumpRows').append(tr);
  node.set(pump.id,{run,low,evidence,faultInput,observed});
 }
 const indicator=(label,value)=>{const n=document.createElement('div');const s=document.createElement('small');s.textContent=label;n.append(s,span(value));return n;};
 let lastLampProjection='',lastStartInputs='';
 const numeric=(value,unit='')=>Number.isFinite(value)?Number(value).toFixed(1)+(unit?' '+unit:''):'—';
 const physical=window.B737ISNUnifiedControlRouterV1;
 function ecuCommandFromOverhead(event){return physical.dispatch(ecu,event);}
 const liveGateway=new window.B737UnifiedLiveGatewayV1.Gateway({bridge,ecu,physical:{
  dispatch:(_ecu,event)=>ecuCommandFromOverhead(event),synchronize:(current,packet)=>physical.synchronize(current,packet)
 }});
 let lastPhysicalPacket=null,lastOwnerGuardSignature='',apuDefaultBootChecked=false;
 // One initial ECU preset after physical Owner18 battery authority is present.
 // APU OFF/BAT OFF always win. No guarded switch state or art is mutated.
 function bootDefaultAPU(){
  if(apuDefaultBootChecked||!liveGateway.initialized||!lastPhysicalPacket)return false;
  const battery=ownerElectricalGuards()['battery-master'];
  if(!battery)return false;
  apuDefaultBootChecked=true;
  if(battery.value!=='ON'||lastPhysicalPacket.toggles?.['apu-start']!=='ON')return false;
  if(chain.get().phase.apu!=='OFF')return false;
  try{ecu.instructorPresetAPUReady({instructor:true});return true;}
  catch(error){
   byId('isnStartError').textContent='APU default READY preset: '+error.message;
   return false;
  }
 }
 function ownerElectricalGuards(){
  return byId('overheadFrame')?.contentWindow?.B737GuardOwner18?.inspect?.()||{};
 }
 function mergeOwnerGuards(packet){return window.B737Owner18ElectricalInputV1.merge(packet,ownerElectricalGuards());}
 function synchronizeOwnerGuards(){
  if(!lastPhysicalPacket||!liveGateway.initialized)return false;
  const mounted=ownerElectricalGuards(),signature=JSON.stringify(Object.keys(window.B737Owner18ElectricalInputV1.DETENTS).map(id=>mounted[id]||null));
  if(signature===lastOwnerGuardSignature)return false;
  lastOwnerGuardSignature=signature;
  liveGateway.synchronize(mergeOwnerGuards(lastPhysicalPacket));bootDefaultAPU();return true;
 }
 // Consume the existing, approved output only. A cover-close AUTO transition
 // is reconciled as a hardware snapshot, never rejected as a fake open guard.
 window.addEventListener('b737:guard-changed',event=>{
  if(event.detail?.source!=='owner18-photo-v1'||!Object.hasOwn(window.B737Owner18ElectricalInputV1.DETENTS,event.detail?.id))return;
  if(synchronizeOwnerGuards())render();
 });
 for(const id of [1,2]){
  byId('unifiedStarterDuct'+id).addEventListener('change',event=>{
   try{ecu.setStartDuctPressure('engine'+id,Number(event.target.value));render();}
   catch(error){byId('isnStartError').textContent=error.message;}
  });
 }
 document.addEventListener('b737:throttle-position',e=>{
  const id=e.detail?.engine,pct=e.detail?.percent;
  if(![1,2].includes(id)||!Number.isFinite(pct))return;
  try{ecu.setThrottle('engine'+id,Math.max(0,Math.min(100,pct))/100);}
  catch(error){if(!/must be RUNNING/.test(error.message))byId('isnStartError').textContent=error.message;}
 });

 // Opt-in, read-only performance probes. Never change ECU integration, timing,
 // protected cockpit controls, or outputs when diagnostics are disabled.
 const profileStart=()=>window.B737InteractionProfilerV1?performance.now():null;
 const profileDone=(name,started)=>{if(started!==null)window.B737InteractionProfilerV1?.markWork(name,performance.now()-started);};
 function renderStart(){
  const readStarted=profileStart(),s=chain.get(),live=ecu.get();
  profileDone('ISN state snapshot read',readStarted);
  const startLines=[];let blocked=false;
  for(const n of [1,2]){
   const id='engine'+n,phase=s.phase[id],measured=live.engines[id];
   if(phase==='BLOCKED'){
    blocked=true;
    const error=String(s.lastError||'');
    const reason=error.startsWith(id.toUpperCase()+': ')?
     error.slice(id.length+2):chain.canStartEngine(id)||'START NOT ENGAGED';
    startLines.push('ENG '+n+' START BLOCKED: '+reason+' · Select OFF, correct the condition, then GRD');
   }else if(['MOTORING','AWAIT_FUEL_LEVER_IDLE','LIGHT_OFF_SEQUENCE'].includes(phase)){
    startLines.push('ENG '+n+' '+phase+' · N2 '+numeric(measured.n2Percent,'%')+
     ' · START VALVE '+(measured.startValveOpen===true?'OPEN':'CLOSED'));
   }else if(['N2_STALLED','NO_LIGHT_OFF','HUNG_START','ABNORMAL_EGT','STARTER_TIME_LIMIT','EARLY_STARTER_CUTOUT'].includes(phase)){
    blocked=true;startLines.push('ENG '+n+' '+phase+' · '+(s.lastError||'CHECK START / FUEL LEVER'));
   }
  }
  startFeedback(startLines.join(' | '),blocked?'warning':'progress');
  const apuLive=live.apu,apuGen=apuLive.generator||{};
  // The quick instructor controls are hidden when the drawer is closed.
  // Do not rewrite these hidden nodes ten times each second; opening the
  // drawer already requests an immediate full render via inspectorToggle.
  if(document.body.classList.contains('side-open')){
  byId('isnQuickApuState').textContent='APU ECU '+apuLive.phase+' · RPM '+numeric(apuLive.rpmPct,'%')+
   ' · EGT '+numeric(apuLive.egtC,'°C')+' · OIL '+numeric(apuLive.oil?.pressurePsi,'PSI')+
   ' · GEN '+numeric(apuGen.voltageV,'V')+'/'+numeric(apuGen.frequencyHz,'Hz')+
   (apuGen.connectedBusSides?.length?' · AC BUS '+apuGen.connectedBusSides.join('+'):' · NOT ON AC BUS');

  for(const n of [1,2]){
   const id='engine'+n,running=s.phase[id]==='RUNNING';
   byId('isnQuickRun'+n).disabled=running;
   byId('isnQuickStop'+n).disabled=s.phase[id]==='OFF'&&s.observations[id].feedback.fuelStartLever.value==='CUTOFF';
   byId('isnQuickPower'+n).disabled=!running;
   const pct=Math.round(s.runningEnvelope.throttle[id]*100);
   byId('isnQuickPower'+n).value=pct;byId('isnQuickPowerValue'+n).textContent=pct+'%';
   byId('isnQuickState'+n).textContent=s.phase[id]+' · N1 '+live.engines[id].n1Percent.toFixed(1)+'%';
  }
  }

  const indication=window.B737ISNStartIndicationsV1.project(s);
  // Closed instructor drawer: skip repaint, never skip ECU/needle events.
  if(document.body.classList.contains('side-open')){
  const summary=['APU '+s.phase.apu,'ENG1 '+s.phase.engine1,'ENG2 '+s.phase.engine2,
   'APU GEN '+(Object.values(s.selectedSources).includes('APU')?'SELECTED':'NOT SELECTED'),
   'APU BLEED '+stateName(s.bleed.apuBleedValveOpen),
   'BATTERY '+stateName(s.electrical.battery)];
  summary.push('DUCT1 '+live.engines.engine1.starterDuctPsiTraining+' PSI',
   'DUCT2 '+live.engines.engine2.starterDuctPsiTraining+' PSI');
  byId('isnStartStatus').textContent=summary.join(' · ');
  byId('isnApuTelemetry').textContent='APU '+s.phase.apu+' · RPM '+numeric(live.apu.rpmPct,'%')+
   ' · EGT '+numeric(live.apu.egtC,'°C')+' · GEN '+numeric(live.apu.generator.voltageV,'V')+
   '/'+numeric(live.apu.generator.frequencyHz,'Hz')+' · OIL '+numeric(live.apu.oil.pressurePsi,'PSI')+' · BLEED '+stateName(live.apu.bleedValveOpen);
  const apuCard=strip.querySelector('.isn-apu-card');
  apuCard.dataset.apuPhase=live.apu.phase;
  apuCard.querySelector('[data-apu-field="phase"]').textContent=live.apu.phase;
  apuCard.querySelector('[data-apu-field="rpm"]').textContent=numeric(live.apu.rpmPct,'%');
  apuCard.querySelector('[data-apu-field="egt"]').textContent=numeric(live.apu.egtC,'°C');
  apuCard.querySelector('[data-apu-field="generator"]').textContent=numeric(live.apu.generator.voltageV,'V');
  apuCard.querySelector('[data-apu-field="time"]').textContent=numeric(live.apu.startElapsedSec,'s');
  for(const n of [1,2]){const info=indication.engines['engine'+n],card=cards['engine'+n];
   card.dataset.phase=info.phase;card.dataset.egtAdvisory=String(info.egt725Advisory);
   card.querySelector('[data-field="phase"]').textContent=info.phase;
   const measured=live.engines['engine'+n];
   card.querySelector('[data-field="n1"]').textContent=numeric(measured.n1Percent,'%');
   card.querySelector('[data-field="n2"]').textContent=numeric(measured.n2Percent,'%');
   card.querySelector('[data-field="egt"]').textContent=numeric(measured.egtC,'°C');
   card.querySelector('[data-field="fuel"]').textContent=numeric(measured.fuelFlowKgHr,'kg/h');
   card.querySelector('[data-field="oil"]').textContent=numeric(measured.oil.pressurePsi,'PSI');
   const valve=card.querySelector('[data-field="valve"]');valve.textContent=info.startValve.text;
   valve.dataset.amber=String(info.startValve.mountedLamp===true);
  }
  const activeWarning=[1,2].some(n=>indication.engines['engine'+n].egt725Advisory)?'EGT 725°C ABNORMAL-START ADVISORY':'';
  byId('isnIndicationError').textContent=indication.error||activeWarning;
  for(const input of faultControls.querySelectorAll('[data-start-fault]')){
   const [device,key]=input.dataset.startFault.split(':');
   input.checked=s.trainingFaults[device][key];
   input.disabled=!['OFF','BLOCKED'].includes(s.phase[device]);
  }
  }
  // Existing N2/EGT needle registrations remain untouched; readings now
  // come from the shared ECU rather than the old disconnected start engine.
  for(const n of [1,2]){
   const id='engine'+n,measured=live.engines[id];
   indication.engines[id].n2={value:measured.n2Percent,text:numeric(measured.n2Percent,'%')};
   indication.engines[id].egt={value:measured.egtC,text:numeric(measured.egtC,'°C')};
  }
  const indicationStarted=profileStart();
  window.dispatchEvent(new CustomEvent('b737:isn-start-indications',{detail:indication}));
  profileDone('ISN start-indication listeners',indicationStarted);
  const ecuObserversStarted=profileStart();
  window.dispatchEvent(new CustomEvent('b737:unified-ecu-observation',{detail:live}));
  profileDone('ISN ECU observation listeners',ecuObserversStarted);
  // Both B737-300/500 and B737-400 use the same dual duct pressure indicator.
  // Observe the one existing ECU/pneumatic state owner; do not create a second plant.
  const pneumaticState=startSession.core.pneumaticState;
  const ductSensors=pneumaticState?.inputs||{};
  const pneumaticOutput=startSession.core.Pneumatics.derive(pneumaticState);
  // OH16 anti-ice is not owned by the ECU physical-command router.
  // Read ONLY its actual OH16 switch detents, never lamp-test states.
  // Starter demand uses valve feedback, not simply an ENG START GRD request.
  const oh16=lastPhysicalPacket?.toggles||s.controls;
  const ductObserversStarted=profileStart();
  window.dispatchEvent(new CustomEvent('b737:duct-pressure-live-inputs',{detail:{
   ecu:live,bleed:pneumaticOutput.bleed,controls:pneumaticState.controls,
   apuRunning:ductSensors.apuRunning===true,
   pack:pneumaticOutput.pack,
   antiIce:{
    engine1:oh16?.['engine-anti-ice-1']||'OFF',
    engine2:oh16?.['engine-anti-ice-2']||'OFF',
    wing:oh16?.['wing-anti-ice']||'OFF'
   },
   starterValves:{
    L:live.engines.engine1.startValveOpen===true,
    R:live.engines.engine2.startValveOpen===true
   },
   sensors:{L:ductSensors.ductLeftPsi,R:ductSensors.ductRightPsi},
   gaugePowered:ductSensors.ductGaugeAcPower!==false&&window.B737UnifiedCB?.available('air.ductGauge')!==false
  }}));
  profileDone('ISN duct pressure listeners',ductObserversStarted);
  const levers={engine1:s.observations.engine1.feedback.fuelStartLever.value,
   engine2:s.observations.engine2.feedback.fuelStartLever.value};
  if(document.body.classList.contains('side-open'))byId('isnStartLeverStatus').textContent='ENG 1 '+levers.engine1+' · ENG 2 '+levers.engine2;
  const leverObserversStarted=profileStart();
  window.dispatchEvent(new CustomEvent('b737:engine-start-lever-state',{detail:{levers}}));
  profileDone('ISN engine lever listeners',leverObserversStarted);
  if(document.body.classList.contains('side-open'))byId('isnStartError').textContent=s.lastError||'';
  if(window.B737CockpitLights?.setInputs){
   const startInputs={};for(const n of [1,2]){
    startInputs['startValve'+n+'Open']=s.observations['engine'+n].feedback.startValveOpen.value===true;
    startInputs['starter'+n+'Air']=s.observations['engine'+n].feedback.startAirAvailable.value===true;
   }
   const key=JSON.stringify(startInputs),actual=window.B737CockpitLights.getState()?.inputs;
   if(key!==lastStartInputs||Object.keys(startInputs).some(k=>actual?.[k]!==startInputs[k])){
    window.B737CockpitLights.setInputs(startInputs);lastStartInputs=key;
   }
  }
 }
 function postProjection(){const f=byId('overheadFrame');if(!f?.contentWindow||!bridge.initialized)return;
  const lamps={...bridge.get().lamps};const projected=chain.get().projected;
  // ATA30-31 authoritative physical heater/current indication for the
  // already-mounted L/R ALPHA VANE lamps. Retain the actual interactive
  // PITOT A/B switches: losing AC never locks their mechanical position.
  // This uses the same V7 evaluated bus state as the live electrical pack,
  // including instructor bus-failure injection, never a second backend.
  const alphaHeatEngine=window.B737ClassicAlphaVaneHeatV1;
  if(alphaHeatEngine){
   const evaluated=bridge.get().state.electrical;
   const physicalSwitches=f.contentWindow.B737OverheadToggles?.getState?.()||{};
   const alphaResult=alphaHeatEngine.evaluate({
    buses:evaluated.bus,switches:physicalSwitches,
    cbAvailable:id=>window.B737UnifiedCB?.available?.(id)??null
   });
   Object.assign(lamps,alphaResult.lamps);
   window.B737UnifiedAlphaVaneHeatLiveV1=Object.freeze({
    get:()=>alphaResult
   });
  }
  // FCOM 12.10.1 / LAN ATA 28: valve-position indications, NOT engine-running lights.
  const valveState=fuelValveIndication.observe({
   levers:{engine1:chain.get().observations.engine1.feedback.fuelStartLever.value,
    engine2:chain.get().observations.engine2.feedback.fuelStartLever.value},
   fireHandles:ecu.core.fireSwitch,nowMs:performance.now()});
  for(const n of [1,2])if(ecu.core.fireSwitch['engine'+n])lamps['hyd-eng-'+n]=false;
  for(const n of [1,2])lamps['fuel-valve-closed-'+n]=valveState.frames['engine'+n];
   // Fuel indications derive from the existing ISN09 ledger + same live Pack.
   const actualFuel=ecu.get().fuel?.system;
   if(actualFuel){Object.assign(lamps,actualFuel.lamps);
    lamps['crossfeed-valve']=actualFuel.valves.crossfeed.lamp;}
  // Settle even when the passive ECU is sleeping with both engines stopped.
  if(valveState.transitionStarted)setTimeout(postProjection,valveState.travelMs+20);
  // ECU owns availability; V7 evaluated source (not selected detent)
  // proves the generator actually feeds an AC bus.
  const apuGenerator=ecu.get().apu.generator;
  const apuOnBus=Object.values(bridge.get().state.electrical.source).includes('APU');
  lamps['apu-gen-off-bus']=apuGenerator.ready===true&&!apuOnBus;
  // The real Unified APU lamp follows ECU oil PSI, not a STARTING timer.
  const apuTrip=chain.apuProtectionReason; // latched by the shared APU source owner
   lamps['apu-low-pressure']=ecu.get().apu.oil.lowPressureLamp;
   if(apuTrip==='LOW_OIL_PRESSURE')lamps['apu-low-pressure']=true;
   lamps['apu-high-oil-temp']=apuTrip==='HIGH_OIL_TEMP';
   lamps['apu-overspeed']=apuTrip==='OVERSPEED';
  const key=JSON.stringify(lamps);if(key===lastLampProjection)return;lastLampProjection=key;
  f.contentWindow.postMessage({type:'b737:cockpit-command',action:'isn-projection',lamps},location.origin);
 }
 function render(){
  const renderStarted=profileStart();
  // Instructor-only tables, trace and fault controls are not visible in the main cockpit.
  if(document.body.classList.contains('side-open')){
  const {state,lamps,rejected,initialized}=bridge.get();
  byId('isnStatus').textContent=initialized?'8 Pump Switches Connected · 8 Low Pressure Lamps + Electrical Lamps · '+state.mode:'Waiting for Overhead Synchronization…';
  byId('isnMode').textContent=state.mode==='SOURCE_GATED'?'Training Surrogate · Enable Training Mode':'TRAINING SURROGATE · ACTIVE (UNVERIFIED)';
  byId('isnMode').setAttribute('aria-pressed',String(state.mode!=='SOURCE_GATED'));
  const buses=byId('isnBuses');buses.replaceChildren(...['generator1','generator2','transfer1','transfer2','dc1','dc2'].map(id=>indicator(id,state.electrical.bus[id])));
  byId('isnBusTransfer').checked=session.electricalState.config.busTransferAuto;
  byId('isnGen1Fault').checked=session.electricalState.faults.GEN1_FAILED;
  byId('isnGen2Fault').checked=session.electricalState.faults.GEN2_FAILED;
  byId('isnFire1').checked=window.B737UnifiedFireLights?.getState()?.engineFire.ENG1??state.sensors.engine1Fire;
  byId('isnCabinHigh').checked=state.sensors.cabinAltitudeFt===12000;
  for(const p of Pack.PUMP_REGISTRY){const value=state.pumps[p.id],n=node.get(p.id);n.run.replaceChildren(span(value.operating));n.low.replaceChildren(span(lamps[Adapter.LAMPS[p.id]]));
   n.evidence.textContent=value.powerEvidence+(value.sourceBus?' · '+value.sourceBus:'');n.faultInput.checked=value.failed;n.observed.value=String(value.observedPower);
  }
  const w=byId('isnWarnings');w.replaceChildren(indicator('FUEL caution (candidate)',state.warnings.masterCautionFuelCandidate),indicator('HYD Master Caution (unknown)',state.warnings.masterCautionHyd),indicator('FIRE BELL',state.warnings.audio.active.some(a=>a.id==='fireBell')),indicator('CABIN HORN',state.warnings.audio.active.some(a=>a.id==='intermittentHorn')));
  const trace=byId('isnTrace');trace.replaceChildren();for(const event of [...state.recentEvents].reverse().slice(0,25)){
   const box=document.createElement('p');box.textContent='#'+event.seq+' '+event.command.type+' · '+(event.command.id||event.command.action?.type||'')+' → '+(event.changes.length?event.changes.map(c=>c.path+' '+stateName(c.from)+'→'+stateName(c.to)+' ['+c.evidence+']').join(' | '):'NO OUTPUT CHANGE');trace.append(box);
  }
  const liveFailure=liveGateway.get().latestFailure;
  byId('isnError').textContent=liveFailure?'Physical Command Rejected: '+liveFailure.id+' · '+liveFailure.reason:
   rejected.length?'Last Rejected Command: '+rejected.at(-1).reason:(ownerElectricalGuards()['bus-transfer']?'BUS TRANSFER: Connected to Installed Owner18 Guard.':'BUS TRANSFER: Awaiting Guard Installation.');
  }
  const startIndicationsStarted=profileStart();
  renderStart();
  profileDone('ISN renderStart total',startIndicationsStarted);
  const lampProjectionStarted=profileStart();
  postProjection();
  profileDone('ISN overhead lamp projection',lampProjectionStarted);
  profileDone('ISN render total',renderStarted);
 }
 // Refresh once whenever Controls opens (also when the engines are stopped).
 byId('inspectorToggle')?.addEventListener('click',()=>setTimeout(render,0));
 window.addEventListener('b737:engine-start-lever-command',e=>{
  if(e.detail?.source!=='PEDESTAL_PHYSICAL')return;
  try{ecu.fuelLever(e.detail.device,e.detail.position);render();}
  catch(error){byId('isnStartError').textContent=error.message;}
 });
 faultControls.addEventListener('change',event=>{
  const input=event.target;if(!input.matches('[data-start-fault]'))return;
  const [device,key]=input.dataset.startFault.split(':');
  try{chain.setTrainingFault(device,key,input.checked);render();}
  catch(error){byId('isnStartError').textContent=error.message;renderStart();}
 });
 byId('isnMode').onclick=()=>{bridge.instructor({type:'MODE',value:session.mode==='SOURCE_GATED'?'TRAINING_SURROGATE':'SOURCE_GATED',instructor:true});render();};
 byId('isnBusTransfer').disabled=true;
 byId('isnBusTransfer').title='Change BUS TRANSFER using the physical OH12 switch.';
 for(const [input,fault] of [['isnGen1Fault','GEN1_FAILED'],['isnGen2Fault','GEN2_FAILED']])byId(input).onchange=e=>{bridge.instructor({type:'ELECTRICAL',action:{type:'FAULT',id:fault,active:e.target.checked,instructor:true}});render();};
 byId('isnFire1').onchange=e=>window.B737UnifiedFireLights?.dispatch({type:'SET_FIRE',unit:'ENG1',active:e.target.checked});
 byId('isnCabinHigh').onchange=e=>{bridge.instructor({type:'WARNING_SENSOR',key:'cabinAltitudeFt',value:e.target.checked?12000:0});render();};
 byId('isnAckFire').onclick=()=>window.B737UnifiedFireLights?.dispatch({type:'BELL_CUTOUT'});
 byId('isnCutoutCabin').onclick=()=>{bridge.instructor({type:'CUTOUT_CABIN'});render();};
 byId('isnReplay').onclick=()=>{bridge.replay();chain.syncPower();render();};
 byId('isnReset').onclick=()=>{bridge.reset();
  for(const device of ['engine1','engine2','apu'])chain.obs(device,chain.get().sources[device].running);
  chain.syncPower();render();};
 // BUS TRANSFER: drive the existing single-owner Pack from the separate
 // approved SHAPE REVIEW. The true OH12 source socket is still UNLOCATED.
 window.addEventListener('message',e=>{
  const frame=byId('busTransferGuardReviewDialog')?.querySelector('iframe');
  if(e.origin!==location.origin||!frame||e.source!==frame.contentWindow)return;
  const type=e.data?.type;
  if(type!=='b737:bus-transfer-preview-ready'&&type!=='b737:bus-transfer-preview-command')return;
  const liveValue=()=>session.electricalState.config.busTransferAuto?'auto':'off';
  const send=(fields={})=>frame.contentWindow.postMessage({
   type:'b737:bus-transfer-preview-state',value:liveValue(),...fields
  },location.origin);
  if(type==='b737:bus-transfer-preview-ready'){send();return;}
  const sequence=e.data.sequence;
  if(!Number.isSafeInteger(sequence)||sequence<1||!['auto','off'].includes(e.data.value)){
   send({sequence,accepted:false,reason:'Invalid preview command'});return;
  }
  // Do not trust a self-reported 'guard open' bit. Inspect the actual
  // same-origin guard preview before permitting a simulated detent.
  if(!frame.contentDocument?.querySelector('.station.opened')){
   send({sequence,accepted:false,reason:'GUARD_MUST_BE_OPEN'});return;
  }
  const result=liveGateway.dispatch({id:'bus-transfer',kind:'guarded',
   next:{value:e.data.value,guard:'open'}});
  send({sequence,accepted:result.accepted,reason:result.reason||null});
  render();
 });
 // OH09 rotary commands the battery-powered valve; the single FuelNetwork
 // changes physical flow topology only after valve travel.
 function observeCrossfeed(detent){
  if(!['CLOSED','OPEN'].includes(detent)||!ecu.core.fuelSystem)return false;
  if(ecu.core.fuelSystem.crossfeed.command===detent)return false;
  // Store the physical selector command without inventing electrical power;
  // the controller advances valve position only on a powered Battery Bus.
  ecu.core.fuelSystem.commandCrossfeed(detent);
  ecu.core.refreshFuelDelivery();return true;
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==byId('overheadFrame')?.contentWindow||e.data?.type!=='b737:cockpit-overhead')return;
  try{
   if(e.data.kind==='controls-state'){
    lastPhysicalPacket=e.data;
    liveGateway.synchronize(mergeOwnerGuards(e.data));
    bootDefaultAPU();
    observeCrossfeed(e.data.rotaries?.crossfeed);
    for(const event of pendingEvents.splice(0))liveGateway.dispatch(event);
    render();
   }else if(e.data.kind==='control-event'){
    if(e.data.event?.id==='crossfeed'){
     observeCrossfeed(e.data.event.next);
    }else if(!liveGateway.initialized){
     if(pendingEvents.length<50)pendingEvents.push(e.data.event);
    }else liveGateway.dispatch(e.data.event);
    render();
   }
  }catch(error){byId('isnError').textContent='ISN Connection Error: '+error.message;
   startFeedback('UNIFIED ENGINE LINK ERROR: '+error.message,'warning');}
 });
 let lastTime=performance.now(),lastPassiveCoolingAt=lastTime;
 setInterval(()=>{
  const tickStarted=profileStart();
  const now=performance.now(),elapsed=Math.max(0,Math.min(500,now-lastTime));lastTime=now;
  // Owner18 may mount asynchronously after the first iframe report.
  if(synchronizeOwnerGuards())render();
  const sources=chain.get().sources;
  const fs=ecu.core.fuelSystem,rawFuelPumps=session.getLive().pumps;
  const fuelNeedsTick=!!fs&&(fs.crossfeed.command!==fs.crossfeed.position||fs.scavenge.remainingMs>0||
   Object.keys(fs.centerDryMs).some(id=>rawFuelPumps[id]?.switchOn&&fs.fuel.tanks.center<=0&&!fs.centerAutoStopped[id]));
  const plantActive=!!chain.jobs.length||sources.engine1.running||sources.engine2.running||sources.apu.running||fuelNeedsTick;
  if(!plantActive){
   // When only the APU's thermal mass remains warm, keep its real-time EGT
   // movement alive after shutdown WITHOUT running the expensive fuel/ECU/
   // battery integrations at 10Hz. An idle 1Hz paint is sufficient.
   const ambient=window.B737ISN1318ECUTestbenchV1.CONFIG.oilAmbientTempC;
   if(ecu.apuThermalEgtC<=ambient+0.05&&!ecu.hasPassiveEngineState()){lastPassiveCoolingAt=now;return;}
   const coolingElapsed=now-lastPassiveCoolingAt;
   if(coolingElapsed<1000)return;
   lastPassiveCoolingAt=now;
   let left=Math.max(0,coolingElapsed);
   while(left>0){const slice=Math.min(120000,left);ecu.coolAPU(slice);left-=slice;}
   render();return;
  }
  lastPassiveCoolingAt=now;
  const advanceStarted=profileStart();
  ecu.advance(elapsed);
  profileDone('ISN ECU.advance',advanceStarted);
  for(const effect of chain.consumeEffects())if(effect.type==='ROTARY_RELEASE'){
   byId('overheadFrame')?.contentWindow?.postMessage({type:'b737:cockpit-command',
    action:'isn-starter-cutout',id:effect.id},location.origin);
  }
  render();
  profileDone('ISN 100ms active tick',tickStarted);
 },100);
 // ATA 26 drives actual simulator owners while leaving cockpit switch detents intact.
 let lastFireOutputs='',fireRenderQueued=false;
 function applyFirePanel(state,derived){
  const {outputs,indications}=derived;
  const key=JSON.stringify([outputs,derived.activeFire,indications.WHEEL_WELL,indications.FIRE_BELL,indications.MASTER_FIRE_WARN]);
  if(key===lastFireOutputs)return;
  lastFireOutputs=key;
  for(const n of [1,2]){
   const id='engine'+n,pulled=outputs['ENG'+n].fuelShutoff;
   if(ecu.core.fireSwitch[id]!==pulled){
    if(pulled)for(const side of [1,2]){
     if(session.electricalState.source[side]==='GEN'+n)ecu.selectGenerator('OFF',side);
    }
    ecu.core.setFireSwitch(id,pulled);
    chain.command({type:'PNEUMATIC',action:{type:'SENSOR',key:id+'FireHandle',value:pulled}});
   }
  }
  chain.apuFireDetected=outputs.APU.autoShutdown;
  if(chain.apuFireDetected)chain.tripAPU('APU_FIRE');
  const apuIn=!state.handles.APU.pulled;
  if(chain.start.getLive().observation.apu.feedback.cockpitFireHandleIn.value!==apuIn){
   chain.feedback('apu','cockpitFireHandleIn',apuIn);
   chain.command({type:'PNEUMATIC',action:{type:'SENSOR',key:'apuFireHandle',value:!apuIn}});
   if(!apuIn){chain.feedback('apu','inletDoorOpen',false);chain.feedback('apu','starterEngaged',false);}
  }
  const alerts={engine1Fire:derived.activeFire.ENG1,engine2Fire:derived.activeFire.ENG2,
   apuFire:derived.activeFire.APU,wheelWellFire:indications.WHEEL_WELL};
  for(const [key,value] of Object.entries(alerts)){
   if(session.sensors[key]!==value)bridge.instructor({type:'WARNING_SENSOR',key,value});
  }
  if(!indications.FIRE_BELL&&Object.values(alerts).some(Boolean))bridge.instructor({type:'ACK_FIRE'});
  chain.syncPower();ecu.core.refreshFuelDelivery();
  if(!fireRenderQueued){
   fireRenderQueued=true;queueMicrotask(()=>{fireRenderQueued=false;render();});
  }
 }
 window.addEventListener('b737:ata26-panel-state',e=>applyFirePanel(e.detail.state,e.detail.derived));
 const initialFirePanel=window.B737UnifiedFireLights;
 if(initialFirePanel?.evaluate())applyFirePanel(initialFirePanel.getState(),initialFirePanel.evaluate());
 let flightScenarioBaseline=null;
 window.B737ISNCockpitV1=Object.freeze({getState:()=>bridge.get(),getStartState:()=>chain.get(),getECUState:()=>ecu.get(),
  startupSynchronized:()=>liveGateway.initialized&&apuDefaultBootChecked,
  getPropulsionSnapshot:()=>({
   schema:'B737_ISN_PROPULSION_SNAPSHOT_V1',source:'SHARED_ISN18_ECU',
   onGround:ecu.aircraft.onGround,
   engines:Object.fromEntries(['engine1','engine2'].map(id=>[id,{
    phase:ecu.chain.phase[id],running:ecu.chain.phase[id]==='RUNNING',
    throttle:ecu.chain.throttle[id],n1Percent:ecu.coast[id]?.n1??null
   }]))
  }),
  // Keep the existing ISN-18 ECU as sole engine-dynamics owner. The A/T
  // controller is only permitted to move RUNNING engines in MCP A/T SPEED.
  autoThrottleCommand:({engine,value,controller}={})=>{
   if(controller!=='B737_AT_SPEED_SERVO_0001'||!['engine1','engine2'].includes(engine)||
      !Number.isFinite(value)||value<0||value>1)
    throw Error('Invalid A/T speed servo command');
   const mcp=window.B737McpAFDSBridgeV1?.getOutput?.();
   if(mcp?.power!==true||mcp.controls?.atArm!==true||mcp.modes?.thrust!=='SPEED')
    return {accepted:false,reason:'MCP_A/T_SPEED_NOT_ENGAGED'};
   if(ecu.chain.phase[engine]!=='RUNNING')
    return {accepted:false,reason:'ENGINE_NOT_RUNNING'};
   ecu.setAutothrottle(engine,value);
   // The existing 100ms ISN owner tick repaints EIS and Conventional gauges.
   return {accepted:true,engine,throttle:value};
  },
  // FCOM Ch4 TO/GA instructor linkage: the SAME ECU spool owner receives
  // thrust lever requests. No alternate engine dynamics or independent N1 plant.
  togaThrottleCommand:({engine,value,controller,phase}={})=>{
   if(controller!=='B737_TOGA_CH4_TRAINING'||
      !['engine1','engine2'].includes(engine)||
      !['TO','GA'].includes(phase)||!Number.isFinite(value)||value<0||value>1)
    throw Error('Invalid TO/GA throttle command');
   const flight=window.B737UnifiedFlightScenarioV1;
   if(flight?.getDiagnostics?.()?.active!==true)
    return {accepted:false,reason:'TOGA_REQUIRES_ACTIVE_INSTRUCTOR_FLIGHT'};
   const mcp=window.B737McpAFDSBridgeV1?.getOutput?.();
   if(mcp?.power!==true||mcp.controls?.atArm!==true)
    return {accepted:false,reason:'TOGA_A_T_NOT_ARMED'};
   if(ecu.chain.phase[engine]!=='RUNNING')
    return {accepted:false,reason:'TOGA_ENGINE_NOT_RUNNING'};
   ecu.setAutothrottle(engine,value);
   return {accepted:true,engine,throttle:value,source:'SAME_ISN18_ECU'};
  },
  // FCOM 4.10.8–9: LVL CHG descent A/T retards to idle; climb N1
  // demands may only follow a qualified FMC limit. The same ISN18 ECU
  // remains the single authority over actual engine spool and fuel flow.
  levelChangeThrottleCommand:({engine,value,phase,controller}={})=>{
   if(controller!=='B737_LVLCHG_CH4_TRAINING'||!['engine1','engine2'].includes(engine)||
    !['CLIMB','DESCENT'].includes(phase)||!Number.isFinite(value)||value<0||value>1)
    throw Error('Invalid LVL CHG throttle request');
   const out=window.B737McpAFDSBridgeV1?.getOutput?.();
   if(out?.power!==true||out.controls?.atArm!==true||
      out.modes?.vertical!=='LVL_CHG'||out.modes?.thrust!==(phase==='CLIMB'?'N1':'RETARD'))
    return {accepted:false,reason:'LVL_CHG_NOT_ACTIVE'};
   if(ecu.chain.phase[engine]!=='RUNNING')
    return {accepted:false,reason:'ENGINE_NOT_RUNNING'};
   ecu.setAutothrottle(engine,value);
   return {accepted:true,source:'ISN18_SHARED_ECU',engine,throttle:value};
  },
  // Explicit training scenario controls ECU flight-idle/altitude/IAS context,
  // not real LRU data. Restore instructor values once the scenario stops.
  setFlightScenarioContext:({active,onGround,iasKt,altitudeFt,source}={})=>{
   if(source!=='FLIGHT_SCENARIO_ENGINE')throw Error('Unrecognized flight context owner');
   if(active!==true){
    if(flightScenarioBaseline){
     if(ecu.aircraft.onGround!==flightScenarioBaseline.onGround)
      ecu.setOnGround(flightScenarioBaseline.onGround);
     ecu.setFlightInputs({pressureAltitudeFt:flightScenarioBaseline.pressureAltitudeFt,
      iasKt:flightScenarioBaseline.iasKt});
     flightScenarioBaseline=null;
    }
    return {active:false};
   }
   if(window.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active!==true)
    throw Error('Flight scenario not active');
   if(typeof onGround!=='boolean'||!Number.isFinite(iasKt)||iasKt<0||iasKt>360||
      !Number.isFinite(altitudeFt)||altitudeFt< -1000||altitudeFt>40000)
    return {active:false,reason:'SCENARIO_OUTSIDE_ISN18_INPUT_ENVELOPE'};
   if(!flightScenarioBaseline)flightScenarioBaseline={...ecu.aircraft};
   if(ecu.aircraft.onGround!==onGround)ecu.setOnGround(onGround);
   if(Math.abs(ecu.aircraft.iasKt-iasKt)>.5||
      Math.abs(ecu.aircraft.pressureAltitudeFt-altitudeFt)>20)
    ecu.setFlightInputs({iasKt,pressureAltitudeFt:altitudeFt});
   return {active:true,onGround,iasKt,altitudeFt,origin:'TRAINING_SCENARIO'};
  },
    getFuelImbalanceKg:()=>{
     const tanks=ecu.core.fuel.tanks;
     return tanks.main2-tanks.main1;
    },
    getFuelQuantityIndications:()=>{
     const indications=ecu.core.fuelSystem?.indications();
     if(!indications)return null;
     return {...indications,standbyAc:chain.get().electrical?.acStandby??null};
    },
    getFuelSystem:()=>ecu.get().fuel?.system??null,
   reconcileElectricalConsumers:reason=>reconcileElectricalConsumers(reason),
   refreshElectricalAnnunciations:()=>{render();return true;},
    fuelTrainerAction:command=>{
     if(command?.instructor!==true||!ecu.core.fuelSystem)throw Error('ATA28 instructor-only action required');
     const fs=ecu.core.fuelSystem;
     switch(command.type){
      case 'SERVICE_TANK':fs.service({tank:command.tank,quantityKg:command.quantityKg,
       onGround:ecu.aircraft.onGround});break;
      case 'FUEL_TEMPERATURE':fs.setTemperature(command.celsius);
       window.B737UnifiedFuelTemperature?.setTemperature(command.celsius);break;
      case 'TANK_LEAK':fs.setTankLeak(command.tank,command.rateKgHr);break;
      case 'FUEL_FREEZE_POINT':fs.setFuelFreezePoint(command.celsius);break;
      case 'CROSSFEED_FAILURE':fs.setCrossfeedFailure(command.active);break;
      case 'PUMP_FAILURE':
       if(!Object.hasOwn(window.B737ClassicFuelSystemV1.PUMPS,command.id)||typeof command.active!=='boolean')throw Error('Invalid fuel pump fault');
       bridge.instructor({type:'PUMP_FAULT',id:command.id,value:command.active,instructor:true});
       chain.syncPower();break;
      default:throw Error('Unsupported fuel instructor command');
     }
     ecu.core.refreshFuelDelivery();render();
     return {accepted:true,system:ecu.get().fuel.system};
    },
    // Isolated APU fault lab uses the single shared ECU, never a second owner.
    apuLabProtectionTrip:reason=>{const result=chain.tripAPU(reason);if(result){ecu.log('APU_PROTECTIVE_SHUTDOWN',{reason,origin:'APU_LAB_TRAINING'});render();}return result;},
    apuLabSetHardwareFault:(key,on)=>{if(!['generatorFailure','bleedFailure'].includes(key))throw Error('APU lab fault unavailable');const result=ecu.setAPUFault(key,on);render();return result;},
   getArchitectureAudit:()=>window.B737UnifiedAuthorityDiagnosticsV1.audit({bridge:bridge.get(),ecu:ecu.get()}),
   getLiveGatewayState:()=>liveGateway.get(),getAircraftSnapshot:()=>liveGateway.snapshot(),
   getElectricalState:()=>JSON.parse(JSON.stringify({schema:session.electricalState.schema,rev:session.electricalState.rev,
    config:session.electricalState.config,source:session.electricalState.source,faults:session.electricalState.faults,battery:session.electricalState.battery})),
   attachLiveBattery:saved=>session.attachBattery(window.B737BatteryDynamicsV1,saved),
   getLiveBattery:()=>session.getBattery(),
   rechargeLiveBattery:()=>{const b=session.rechargeBattery();chain.syncPower();ecu.core.refreshFuelDelivery();render();return b;},
   advanceLiveBattery:(dt,inputs)=>{const b=session.advanceBattery(dt,inputs);chain.syncPower();ecu.core.refreshFuelDelivery();render();return b;},
   // Instructor/FCOM P5-10 commands use the EXISTING Pneumatics V6 owner.
   // No shadow session or duplicate annunciator plant is created.
   getPneumaticState:()=>{
    // Hot-path snapshot excludes the expanding 500-event diagnostics log;
    // keeps only the fields required by the existing Pneumatics V6 derive.
    const p=startSession.core.pneumaticState;
    return {schema:p.schema,seq:p.seq,controls:{...p.controls},inputs:{...p.inputs},
     faults:{...p.faults},latched:{...p.latched},events:[]};
   },
   sendPneumatic:action=>{
    if(!['SENSOR','TRIP_RESET','CONTROL'].includes(action?.type))
     throw Error('Unsupported pneumatic trainer command');
    if(action.type==='SENSOR'&&
       (!Object.prototype.hasOwnProperty.call(window.B737PneumaticsV6.INPUT_TYPES,action.key)||
        typeof action.value!=='boolean'))
     throw Error('Pneumatic sensor injection requires a known Boolean');
    if(action.type==='CONTROL'&&action.key!=='aircraftFamily')
     throw Error('Only family switching is allowed through this adapter');
    startSession.core.send({type:'PNEUMATIC',action});
    render();
    return window.B737PneumaticsV6.derive(startSession.core.pneumaticState);
   },
   // Pass only source-observed pneumatic supply to pressurization. UNKNOWN
   // must never become a fabricated zero PACK or an invented DC bus mapping.
   getPressurizationAir:()=>startSession.core.complete()
     ?startSession.core.Pneumatics.derive(startSession.core.pneumaticState).toPressurization
     :null,
  // Instrument/start lab: explicit INSTRUCTOR actions only, on the existing ISN-18 ECU.
  // Starting via GRD / ignition-source still requires the actual OH control;
  // this adapter NEVER secretly moves a physical switch or guarded control.
  engineTrainerAction:command=>{
    if(!command||command.instructor!==true||
       !['engine1','engine2'].includes(command.engine)&&!['ELECTRICAL_FAULT','APU_PRESET'].includes(command.type))
      throw Error('Explicit validated instructor command required');
    const engine=command.engine;
    switch(command.type){
      case 'START_FAULT':
        if(!window.B737ISNAPUStartChainV1.FAULT_KEYS.includes(command.key)||typeof command.active!=='boolean')
          throw Error('Unknown engine start fault');
        ecu.setStartFault(engine,command.key,command.active);break;
      case 'OIL_FAULT':
        if(!['pumpFailure','oilLeak','filterRestriction'].includes(command.key)||typeof command.active!=='boolean')
          throw Error('Unknown engine oil fault');
        ecu.setOilFault(engine,command.key,command.active);break;
      case 'DUCT_PSI':
        if(!Number.isFinite(command.psi)||command.psi<20||command.psi>50)throw Error('Invalid instructor duct PSI');
        ecu.setStartDuctPressure(engine,command.psi);break;
      case 'THROTTLE':
        if(!Number.isFinite(command.value)||command.value<0||command.value>1)throw Error('Invalid throttle');
        ecu.setThrottle(engine,command.value);break;
      case 'LEVER':
        if(!['IDLE','CUTOFF'].includes(command.position))throw Error('Invalid engine start lever');
        ecu.fuelLever(engine,command.position);break;
      case 'PRESET_RUNNING':
        ecu.instructorRunEngine(engine,{instructor:true});break;
      case 'SHUTDOWN':
        ecu.shutdown(engine);break;
      case 'ELECTRICAL_FAULT':
        if(!window.B737ElectricalV7.FAULTS.includes(command.key)||typeof command.active!=='boolean')
          throw Error('Unknown electrical instructor fault');
        bridge.instructor({type:'ELECTRICAL',action:{type:'FAULT',id:command.key,
          active:command.active,instructor:true}});chain.syncPower();ecu.core.refreshFuelDelivery();break;
      case 'APU_PRESET':
        ecu.instructorPresetAPUReady({instructor:true});break;
      default:throw Error('Unsupported engine lab action — use the actual OH start selector');
    }
    render();return {accepted:true,type:command.type,engine:engine||null,ecu:ecu.get()};
  },
  instructor:command=>{const r=bridge.instructor(command);chain.syncPower();ecu.core.refreshFuelDelivery();render();return r;},reset:()=>{const r=bridge.reset();render();return r;}});
 // Dependencies are dynamically loaded, so request a fresh iframe snapshot
 // even if its initial ready event arrived before this message listener.
 byId('overheadFrame')?.contentWindow?.postMessage({type:'b737:cockpit-command',action:'report'},location.origin);
 // One reconciliation per distinct distribution/CB state. The event hub and
 // old compatibility events may arrive together; unchanged power is a NOOP.
 let lastDistributionSignature=null;
 function reconcileElectricalConsumers(reason='ATA24_CHANGE'){
  const evaluated=window.B737ElectricalV7?.evaluate?.(session.electricalState);
  if(!evaluated?.bus)return false;
  const signature=JSON.stringify([evaluated.bus,evaluated.busClassOutages||[],
   window.B737UnifiedCB?.revision??null]);
  if(signature===lastDistributionSignature)return false;
  lastDistributionSignature=signature;
  session.snapshot=session.compute(null);
  chain.syncPower();
  ecu.core.refreshFuelDelivery();
  ecu.advance(0);
  render();
  return true;
 }
 window.addEventListener('b737:cb-state-change',()=>reconcileElectricalConsumers('CB_CHANGE'));
 // An injected bus loss is a power overlay, never an overhead switch or engine STOP.
 window.addEventListener('b737:bus-failure-injection-changed',()=>{
  reconcileElectricalConsumers('INJECTED_BUS_CHANGE');
  window.dispatchEvent(new CustomEvent('b737:electrical-v7-state',{
   detail:{source:'TRAINING_BUS_FAILURE_INJECTION'}}));
 });
 window.dispatchEvent(new CustomEvent('b737:electrical-owner-ready'));
 render();
 }
 const trace=window.B737BootTrace,requestStart=trace?performance.now():0;
 loadDependencies().then(()=>{
  const initStart=trace?performance.now():0;
  trace?.phase('Load electrical and ECU modules',requestStart,initStart);
  init();
  trace?.phase('Initialize electrical and ECU systems',initStart);
 }).catch(error=>{
  console.error('ISN-18 Unified ECU startup failed:',error);
  // If an integration script fails or the new ECU init throws, never leave
  // a silent, apparently functional overhead start panel.
  const anchor=document.querySelector('.workbench .toolbar');
  if(anchor&&!document.getElementById('isnIntegrationLoadError')){
   const status=document.createElement('p');status.id='isnIntegrationLoadError';
   status.className='isn-indication-error';status.setAttribute('role','alert');
   status.textContent='UNIFIED ECU NOT CONNECTED — '+error.message;
   anchor.after(status);
  }
  startFeedback('UNIFIED ECU NOT CONNECTED — '+error.message,'warning');
 });
})();
