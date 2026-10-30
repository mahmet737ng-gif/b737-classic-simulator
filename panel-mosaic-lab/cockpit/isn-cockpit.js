(function(){
 'use strict';
 const moduleBase=document.currentScript.src;
 const deps=[
  ['B737PneumaticsV6','../../engine/systems/pneumatics-v6.js'],
  ['B737ISNEngineAPUV1','../../engine/integration/isn-engine-apu-v1.js'],
  ['B737ISNStartSequenceV1','../../engine/integration/isn-start-sequence-v1.js'],
  ['B737ISNEngineStartDynamicsV1','../../engine/integration/isn-engine-start-dynamics-v1.js'],
  ['B737ISNAPUStartChainV1','../../engine/integration/isn-apu-start-chain-v1.js'],
  ['B737ISNStartIndicationsV1','../../engine/integration/isn-start-indications-v1.js'],
  ['B737ISNUnifiedControlRouterV1','../../engine/integration/isn-unified-control-router-v1.js'],
  ['B737ISNThrustPerformanceV1','../../engine/integration/isn-thrust-performance-v1.js'],
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
    script.src=new URL(path,moduleBase).href+'?v=ELEC-LIVE-0001';
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
  FuelRuntime:window.B737ISN0912RuntimeV1,timingProfile:'REALTIME_TRAINING'});
 // ATA24 owns the physical source-current estimate; the ECU consumes it
 // to update its EXISTING generator governor/EGT/fuel model. This listener
 // never changes source selection, electrical state, or needle geometry.
 window.addEventListener('b737:electrical-demand-estimate',e=>{
  const amps=e.detail?.sourceAmps?.APU;
  if(Number.isFinite(amps))ecu.observeAPUSourceAmps(amps);
 });
 const startSession=ecu.start,chain=ecu.chain,session=startSession.core.pack;
 const bridge=new Adapter.Bridge(session,{sourceOwner:'ISN03_START_SESSION'});
 const pendingEvents=[];
 const strip=document.createElement('section');strip.id='isnStartIndications';strip.className='isn-start-indications';
 strip.setAttribute('aria-label','ISN-03 engine start training indications');
 strip.innerHTML='<div class="isn-engine-card isn-apu-card" data-apu-phase="OFF" role="status"><b>APU</b><span data-apu-field="phase">OFF</span><span>RPM <strong data-apu-field="rpm">0%</strong></span><span>EGT <strong data-apu-field="egt">—</strong></span><span>AC <strong data-apu-field="generator">0 V</strong></span><span>TIME <strong data-apu-field="time">0s</strong></span></div>'+
 [1,2].map(n=>'<div class="isn-engine-card" data-engine="engine'+n+'" role="status"><b>ENG '+n+'</b><span data-field="phase">OFF</span><span>N1 <strong data-field="n1">0%</strong></span><span>N2 <strong data-field="n2">0%</strong></span><span>EGT <strong data-field="egt">—</strong></span><span>FUEL <strong data-field="fuel">0 kg/h</strong></span><span>OIL <strong data-field="oil">0 PSI</strong></span><span>START VALVE <strong data-field="valve">UNKNOWN</strong></span></div>').join('')+
 '<p class="isn-indication-error" id="isnIndicationError" role="alert"></p>';
 document.querySelector('.workbench .toolbar').after(strip);
 const cards=Object.fromEntries([1,2].map(n=>['engine'+n,strip.querySelector('[data-engine="engine'+n+'"]')]));
 const panel=document.createElement('section');panel.className='isn-bridge-panel';panel.id='isnBridgePanel';
 panel.innerHTML='<h2>ISN-02 · شبکهٔ زندهٔ کابین</h2><p id="isnStatus" role="status">منتظر وضعیت سوییچ‌های اورهد…</p><p class="isn-note">خروجی Source-Gated مستند است؛ منبع دقیق تغذیهٔ ۸ پمپ هنوز تأیید نشده و UNKNOWN باقی می‌ماند. وضعیت‌های آموزشی به‌صورت مجزا مشخص‌اند.</p><button id="isnMode" type="button" aria-pressed="false">Training Surrogate · خاموش</button><div class="isn-buses" id="isnBuses"></div><details><summary>کنترل‌های مربی · بدون سوییچ فیزیکی</summary><label class="isn-setting"><input type="checkbox" id="isnBusTransfer" checked> BUS TRANSFER AUTO · وضعیت سوییچ واقعی OH12</label><label class="isn-setting"><input type="checkbox" id="isnGen1Fault"> GEN 1 FAILED · تزریق مربی</label><label class="isn-setting"><input type="checkbox" id="isnGen2Fault"> GEN 2 FAILED · تزریق مربی</label><button id="isnReset" type="button">بازنشانی موتور ISN بر اساس وضعیت فعلی کابین</button></details><div class="isn-scroll"><table class="isn-table"><thead><tr><th>سوییچ / چراغ واقعی</th><th>RUN</th><th>LOW PRESS</th><th>Power Evidence</th><th>تست مربی</th></tr></thead><tbody id="isnPumpRows"></tbody></table></div><div class="isn-warnings" id="isnWarnings"></div><details><summary>ردگیری فرمان → سیستم → چراغ / هشدار</summary><div id="isnTrace" class="isn-trace" dir="ltr"></div></details><p id="isnError" class="isn-error" role="status"></p>';
 const trainer=document.createElement('details');trainer.innerHTML='<summary>هشدارهای مستند · ورودی سناریوی مربی</summary><label class="isn-setting"><input id="isnFire1" type="checkbox"> ENGINE 1 FIRE · ورودی آزمایشی</label><label class="isn-setting"><input id="isnCabinHigh" type="checkbox"> CABIN ALTITUDE 12000 ft · ورودی آزمایشی</label><button id="isnAckFire" type="button">Fire Bell Acknowledge</button><button id="isnCutoutCabin" type="button">Cabin Horn Cutout</button>';
 panel.querySelector('.isn-warnings').after(trainer);
 const replayButton=document.createElement('button');replayButton.id='isnReplay';replayButton.type='button';replayButton.textContent='بازپخش قطعی رویدادهای ISN';
 panel.querySelector('#isnTrace').after(replayButton);
 const startPanel=document.createElement('details');startPanel.open=true;startPanel.className='isn-start-panel';startPanel.innerHTML='<summary>ISN-18 · Unified ECU / APU / Engine Start</summary><p class="isn-note">سوییچ‌های واقعی اورهد و Fuel Leverهای پدستال به انجین ECU مشترک متصل هستند. ۳۵ PSI آموزشی: حدود ۶۵ ثانیه تا RUNNING در صورت ورود به‌موقع سوخت. Suction Feed از مخزن اصلی هر موتور پشتیبانی می‌شود. پارامترهای مدل آموزشی هستند.</p><div id="isnStartStatus" role="status" dir="ltr">Waiting for overhead…</div><p id="isnStartLeverStatus" class="isn-lever-status" role="status" dir="ltr">ENG 1 CUTOFF · ENG 2 CUTOFF</p><p id="isnApuTelemetry" dir="ltr" role="status">APU OFF · EGT — · GEN OFF</p><p id="isnStartError" class="isn-error" role="alert"></p><details><summary>ECU starter duct pressure · instructor only</summary><label>ENG 1 DUCT (training PSI) <input id="unifiedStarterDuct1" type="number" min="20" max="50" value="35"></label><label>ENG 2 DUCT (training PSI) <input id="unifiedStarterDuct2" type="number" min="20" max="50" value="35"></label><p>این ورودی فشار اندازه‌گیری‌شدهٔ واقعی نیست؛ فقط سرعت استارت موتور آموزشی را تنظیم می‌کند.</p></details><a href="../../isn-ecu-start-lab/">ECU Testbench مستقل ↗</a>';
 const faultControls=document.createElement('details');faultControls.className='isn-start-faults';
 faultControls.innerHTML='<summary>سناریوهای خطای آموزشی · پیش از GRD تنظیم کن</summary><p>تزریق مربی: توقف N2 در ۱۸٪ یا رشد EGT تا ۷۶۰°C. عددهای تزریق، عملکرد واقعی موتور نیستند؛ معیار هشدار ۷۲۵°C از موتور قواعد مستند می‌آید.</p><label><input type="checkbox" data-start-fault="engine1:n2Stall"> ENG 1 · N2 STALL</label><label><input type="checkbox" data-start-fault="engine1:egtHigh"> ENG 1 · EGT HIGH</label><label><input type="checkbox" data-start-fault="engine2:n2Stall"> ENG 2 · N2 STALL</label><label><input type="checkbox" data-start-fault="engine2:egtHigh"> ENG 2 · EGT HIGH</label>';
 startPanel.append(faultControls);
 panel.querySelector('.isn-note').after(startPanel);
 const anchor=document.querySelector('.aircraft-profile-summary');if(anchor)anchor.after(panel);else byId('inspector').prepend(panel);
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
 let lastPhysicalPacket=null,lastOwnerGuardSignature='';
 function ownerElectricalGuards(){
  return byId('overheadFrame')?.contentWindow?.B737GuardOwner18?.inspect?.()||{};
 }
 function mergeOwnerGuards(packet){return window.B737Owner18ElectricalInputV1.merge(packet,ownerElectricalGuards());}
 function synchronizeOwnerGuards(){
  if(!lastPhysicalPacket||!liveGateway.initialized)return false;
  const mounted=ownerElectricalGuards(),signature=JSON.stringify(Object.keys(window.B737Owner18ElectricalInputV1.DETENTS).map(id=>mounted[id]||null));
  if(signature===lastOwnerGuardSignature)return false;
  lastOwnerGuardSignature=signature;
  liveGateway.synchronize(mergeOwnerGuards(lastPhysicalPacket));return true;
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

 function renderStart(){const s=chain.get(),live=ecu.get();
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
   '/'+numeric(live.apu.generator.frequencyHz,'Hz')+' · BLEED '+stateName(live.apu.bleedValveOpen);
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
  window.dispatchEvent(new CustomEvent('b737:isn-start-indications',{detail:indication}));
  window.dispatchEvent(new CustomEvent('b737:unified-ecu-observation',{detail:live}));
  const levers={engine1:s.observations.engine1.feedback.fuelStartLever.value,
   engine2:s.observations.engine2.feedback.fuelStartLever.value};
  if(document.body.classList.contains('side-open'))byId('isnStartLeverStatus').textContent='ENG 1 '+levers.engine1+' · ENG 2 '+levers.engine2;
  window.dispatchEvent(new CustomEvent('b737:engine-start-lever-state',{detail:{levers}}));
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
  lamps['apu-gen-off-bus']=projected['apu-gen-off-bus'];
  lamps['apu-low-pressure']=projected['apu-low-pressure'];
  const key=JSON.stringify(lamps);if(key===lastLampProjection)return;lastLampProjection=key;
  f.contentWindow.postMessage({type:'b737:cockpit-command',action:'isn-projection',lamps},location.origin);
 }
 function render(){
  // Instructor-only tables, trace and fault controls are not visible in the main cockpit.
  if(document.body.classList.contains('side-open')){
  const {state,lamps,rejected,initialized}=bridge.get();
  byId('isnStatus').textContent=initialized?'۸ سوییچ پمپ متصل · ۸ چراغ Low Pressure + چراغ‌های برق · '+state.mode:'در انتظار همگام‌سازی اورهد…';
  byId('isnMode').textContent=state.mode==='SOURCE_GATED'?'Training Surrogate · فعال‌سازی آموزشی':'TRAINING SURROGATE · فعال (غیرمستند)';
  byId('isnMode').setAttribute('aria-pressed',String(state.mode!=='SOURCE_GATED'));
  const buses=byId('isnBuses');buses.replaceChildren(...['generator1','generator2','transfer1','transfer2','dc1','dc2'].map(id=>indicator(id,state.electrical.bus[id])));
  byId('isnBusTransfer').checked=session.electricalState.config.busTransferAuto;
  byId('isnGen1Fault').checked=session.electricalState.faults.GEN1_FAILED;
  byId('isnGen2Fault').checked=session.electricalState.faults.GEN2_FAILED;
  byId('isnFire1').checked=state.sensors.engine1Fire;
  byId('isnCabinHigh').checked=state.sensors.cabinAltitudeFt===12000;
  for(const p of Pack.PUMP_REGISTRY){const value=state.pumps[p.id],n=node.get(p.id);n.run.replaceChildren(span(value.operating));n.low.replaceChildren(span(lamps[Adapter.LAMPS[p.id]]));
   n.evidence.textContent=value.powerEvidence+(value.sourceBus?' · '+value.sourceBus:'');n.faultInput.checked=value.failed;n.observed.value=String(value.observedPower);
  }
  const w=byId('isnWarnings');w.replaceChildren(indicator('FUEL caution (candidate)',state.warnings.masterCautionFuelCandidate),indicator('HYD Master Caution (unknown)',state.warnings.masterCautionHyd),indicator('FIRE BELL',state.warnings.audio.active.some(a=>a.id==='fireBell')),indicator('CABIN HORN',state.warnings.audio.active.some(a=>a.id==='intermittentHorn')));
  const trace=byId('isnTrace');trace.replaceChildren();for(const event of [...state.recentEvents].reverse().slice(0,25)){
   const box=document.createElement('p');box.textContent='#'+event.seq+' '+event.command.type+' · '+(event.command.id||event.command.action?.type||'')+' → '+(event.changes.length?event.changes.map(c=>c.path+' '+stateName(c.from)+'→'+stateName(c.to)+' ['+c.evidence+']').join(' | '):'NO OUTPUT CHANGE');trace.append(box);
  }
  const liveFailure=liveGateway.get().latestFailure;
  byId('isnError').textContent=liveFailure?'فرمان فیزیکی رد شد: '+liveFailure.id+' · '+liveFailure.reason:
   rejected.length?'آخرین فرمان ردشده: '+rejected.at(-1).reason:(ownerElectricalGuards()['bus-transfer']?'BUS TRANSFER: متصل به گارد نصب‌شدهٔ Owner18.':'BUS TRANSFER: منتظر نصب گارد.');
  }
  renderStart();
  postProjection();
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
 byId('isnBusTransfer').title='BUS TRANSFER را از سوییچ واقعی روی OH12 تغییر بده.';
 for(const [input,fault] of [['isnGen1Fault','GEN1_FAILED'],['isnGen2Fault','GEN2_FAILED']])byId(input).onchange=e=>{bridge.instructor({type:'ELECTRICAL',action:{type:'FAULT',id:fault,active:e.target.checked,instructor:true}});render();};
 byId('isnFire1').onchange=e=>{bridge.instructor({type:'WARNING_SENSOR',key:'engine1Fire',value:e.target.checked});render();};
 byId('isnCabinHigh').onchange=e=>{bridge.instructor({type:'WARNING_SENSOR',key:'cabinAltitudeFt',value:e.target.checked?12000:0});render();};
 byId('isnAckFire').onclick=()=>{bridge.instructor({type:'ACK_FIRE'});render();};
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
 // OH09 rotary is the REAL CROSSFEED switch; only the shared FuelNetwork
 // owns the valve's flow topology. The rotor graphic and detents are frozen.
 function observeCrossfeed(detent){
  if(!['CLOSED','OPEN'].includes(detent))return false;
  if(ecu.core.fuel.crossfeed===detent)return false;
  // Battery bus is required to motor the valve; an unpowered knob cannot
  // silently change the fuel distribution manifold.
  if(chain.get().electrical.battery!==true)return false;
  ecu.core.fuel.setCrossfeed(detent);ecu.core.refreshFuelDelivery();return true;
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==byId('overheadFrame')?.contentWindow||e.data?.type!=='b737:cockpit-overhead')return;
  try{
   if(e.data.kind==='controls-state'){
    lastPhysicalPacket=e.data;
    liveGateway.synchronize(mergeOwnerGuards(e.data));
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
  }catch(error){byId('isnError').textContent='خطای ارتباط ISN: '+error.message;}
 });
 let lastTime=performance.now();
 setInterval(()=>{const now=performance.now(),elapsed=Math.max(0,Math.min(500,now-lastTime));lastTime=now;
  // Owner18 may mount asynchronously after the first iframe report.
  if(synchronizeOwnerGuards())render();
  const sources=chain.get().sources;
  if(!chain.jobs.length&&!sources.engine1.running&&!sources.engine2.running&&!sources.apu.running)return;
  ecu.advance(elapsed);
  for(const effect of chain.consumeEffects())if(effect.type==='ROTARY_RELEASE'){
   byId('overheadFrame')?.contentWindow?.postMessage({type:'b737:cockpit-command',
    action:'isn-starter-cutout',id:effect.id},location.origin);
  }
  render();
 },100);
 window.B737ISNCockpitV1=Object.freeze({getState:()=>bridge.get(),getStartState:()=>chain.get(),getECUState:()=>ecu.get(),
   getArchitectureAudit:()=>window.B737UnifiedAuthorityDiagnosticsV1.audit({bridge:bridge.get(),ecu:ecu.get()}),
   getLiveGatewayState:()=>liveGateway.get(),getAircraftSnapshot:()=>liveGateway.snapshot(),
   getElectricalState:()=>JSON.parse(JSON.stringify({schema:session.electricalState.schema,rev:session.electricalState.rev,
    config:session.electricalState.config,source:session.electricalState.source,faults:session.electricalState.faults,battery:session.electricalState.battery})),
   attachLiveBattery:saved=>session.attachBattery(window.B737BatteryDynamicsV1,saved),
   getLiveBattery:()=>session.getBattery(),
   advanceLiveBattery:(dt,inputs)=>{const b=session.advanceBattery(dt,inputs);chain.syncPower();ecu.core.refreshFuelDelivery();render();return b;},
   // Pass only source-observed pneumatic supply to pressurization. UNKNOWN
   // must never become a fabricated zero PACK or an invented DC bus mapping.
   getPressurizationAir:()=>startSession.core.complete()
     ?startSession.core.Pneumatics.derive(startSession.core.pneumaticState).toPressurization
     :null,
  instructor:command=>{const r=bridge.instructor(command);chain.syncPower();ecu.core.refreshFuelDelivery();render();return r;},reset:()=>{const r=bridge.reset();render();return r;}});
 // Dependencies are dynamically loaded, so request a fresh iframe snapshot
 // even if its initial ready event arrived before this message listener.
 byId('overheadFrame')?.contentWindow?.postMessage({type:'b737:cockpit-command',action:'report'},location.origin);
 window.dispatchEvent(new CustomEvent('b737:electrical-owner-ready'));
 render();
 }
 loadDependencies().then(init).catch(error=>{
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
 });
})();
