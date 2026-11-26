(async()=>{
;
/* ./thrust-mode-annunciator-v1.js?v=FCOM-TMD-0001 */
try{
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fuel-used-physical-ch7-v1.js?v=FUEL-RECESSED-DB-0001 */
try{
/* Chapter 7.10.6-7 (EIS) and 7.10.16-17 (Conventional) physical
 * FUEL USED controls: EIS recessed PUSH / RESET, Conventional spring-loaded
 * RESET-RATE-USED selector. Always use the existing backend's one ECU ledger.
 */
(function(win){'use strict';
 const doc=win.document,REG=win.B737EnginePhotoControlRegistrationV1;
 const VERSION='FUEL_USED_PHYSICAL_CH7_0002-RECESSED-DB-PHOTO';
 let root=null,eis=null,conv=null,lastMode=null,lastError=null,mounts=0;
 let showButton=null,resetButton=null,lastGeometry=null;
 const api=()=>win.B737UnifiedEngineIndicationsV2;
 function command(type,value){
  try{
   if(!api()?.command)throw Error('Engine indication backend unavailable');
   const result=api().command({type,...(value!==undefined?{value}:{})});
   if(result===null)throw Error('Engine indication ECU not ready');
   lastError=null;return true;
  }catch(error){lastError=String(error?.message||error);win.console.warn('FUEL USED physical control',error);return false;}
 }
 function makeButton(host,label,id,klass,fn){
  const b=doc.createElement('button');b.type='button';b.id=id;
  b.className=klass;b.title=label;b.setAttribute('aria-label',label);
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn();});
  host.appendChild(b);return b;
 }
 function install(){
  if(root)return;
  root=doc.createElement('div');root.className='fuel-used-physical-ch7';root.id='fuelUsedPhysicalCh7';
  root.setAttribute('aria-label','Fuel used controls Chapter 7.10');
  eis=doc.createElement('div');eis.className='fuel-used-eis';root.appendChild(eis);
  showButton=makeButton(eis,'EIS: push to display FUEL USED for ten seconds','fuelUsedEisShow',
   'fuel-recessed fuel-used-show',()=>command('FUEL_MODE','USED'));
  resetButton=makeButton(eis,'EIS: RESET FUEL USED','fuelUsedEisReset',
   'fuel-recessed fuel-used-reset',()=>command('RESET_FUEL_USED'));
  conv=doc.createElement('div');conv.className='fuel-used-conventional';root.appendChild(conv);
  const control=makeButton(conv,'Conventional fuel flow switch, spring return RATE',
   'fuelUsedConventionalSelector','fuel-flow-selector',()=>{});
  const label=doc.createElement('span');label.className='fuel-flow-indicator';
  label.textContent='RATE';conv.appendChild(label);
  let held=null;
  function release(){
   if(held===null)return;
   held=null;label.textContent='RATE';control.dataset.position='RATE';
   command('FUEL_MODE','RATE');
  }
  control.addEventListener('pointerdown',e=>{
   if(e.button!==0&&e.pointerType==='mouse')return;
   e.preventDefault();e.stopPropagation();
   control.setPointerCapture?.(e.pointerId);
   // Upper part of source circle = RESET, lower part = USED.
   const box=control.getBoundingClientRect();
   held=e.clientY<box.top+box.height/2?'RESET':'USED';
   control.dataset.position=held;label.textContent=held;
   if(held==='RESET'){
    command('FUEL_MODE','USED');
    command('RESET_FUEL_USED');
   }else command('FUEL_MODE','USED');
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(event,release);
  control.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown',' '].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   if(e.key==='ArrowUp'){held='RESET';label.textContent='RESET';command('RESET_FUEL_USED');}
   else{held='USED';label.textContent='USED';command('FUEL_MODE','USED');}
  });
  control.addEventListener('keyup',e=>{if(['ArrowUp','ArrowDown',' '].includes(e.key))release();});
  win.addEventListener('blur',release);
 }
 function mount(){
  const native=doc.querySelector('#region-main .region-native');
  const piece=native?.querySelector('.texture-piece[data-piece="engine"]');
  if(!native||!piece)return false;
  install();
  if(root.parentNode!==native)native.appendChild(root);
  const mode=doc.documentElement.dataset.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
  const geo=win.B737EngineIndicationModeV1?.layout?.();
  const rect=mode==='CONVENTIONAL'&&geo?.w>0?geo:
   {x:parseFloat(piece.style.left),y:parseFloat(piece.style.top),
    w:parseFloat(piece.style.width),h:parseFloat(piece.style.height)};
  if(!Object.values(rect).every(Number.isFinite))return false;
  Object.assign(root.style,{left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px'});
  root.dataset.mode=mode;
  if(mode==='EIS'){
   // Existing buttons, not decorative replacements. Fit the approved
   // recessed-button database asset into each unique EIS photo aperture.
   if(!REG?.apply){lastError='Engine photo registration unavailable';return false;}
   const show=REG.apply(showButton,'FUEL_USED_PUSH',rect);
   const reset=REG.apply(resetButton,'RESET_FUEL_USED',rect);
   for(const [button,geo] of [[showButton,show],[resetButton,reset]]){
    button.style.backgroundImage='url("'+geo.asset+'")';
    button.dataset.assetSource='B737EnginePhotoControlRegistrationV1';
   }
   lastGeometry={show,reset};
  }else lastGeometry=null;
  lastMode=mode;
  mounts++;
  return true;
 }
 for(const name of ['b737:cockpit-mounted','b737:engine-indication-view','b737:aircraft-profile-change'])
  win.addEventListener(name,mount);
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 win.B737FuelUsedPhysicalCh7V1=Object.freeze({version:VERSION,mount,getStatus:()=>({
  mode:lastMode,mounts,error:lastError,photoRegistration:lastGeometry,
  ledger:api()?.getState?.()?.snapshot?.fuelUsedKg||null})});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/interaction/touch-rotary-swipe-v1.js?v=TOUCH-ROTARY-ASP-NATIVE-0003 */
try{
/* TOUCH-ROTARY-0001: iPad/stylus horizontal swipe controls for live cockpit knobs.
 * Reuses each control's existing wheel handler: no duplicate state/backend owner.
 * Mouse, keyboard, native scroll outside knobs and two-finger gestures are unchanged.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737TouchRotarySwipeV1 = api;
  if (typeof document !== 'undefined') api.install(document);
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SELECTOR = [
    '.mounted-rotary:not(.ignition-toggle)',
    '.aircon400-knob',
    '.oh22-pressure-controls [data-role="actuator"]:not(.oh22-pressure-actuator-spring):not(.oh22-pressure-hotspot)',
    '.mcp-ias-mach-knob',
    '.mcp-v3-knob',
    '.irs-upper-outer',
    '.irs-upper-brt',
    '.irs-msu-mini',
    '.irs-live-msu-control',
    '.asp-vbr-selector',
    '[data-acdc-selector]'
  ].join(',');
  // ASP volume controls own their pointer lifecycle. In particular, a global
  // capture-phase listener must NEVER steal their pointerup and leave the
  // page's pan controller waiting for a stale finger.
  const ASP_VOLUME = '.asp-photo-control[data-kind="volume"]';
  const ASP_SWIPE_START_PX = 12;
  const REVERSE = '.mcp-ias-mach-knob,.mcp-v3-knob,.irs-upper-brt';

  // Both distance and finger velocity matter: deliberate swipes produce fine
  // adjustment while quick strokes produce several existing backend steps.
  // There is no momentum after lifting a finger, and a reversal is immediate.
  function createMotion(options = {}) {
    const pixelsPerStep = options.pixelsPerStep ?? 14;
    const maxSteps = options.maxSteps ?? 36;
    if (!(pixelsPerStep > 0 && maxSteps >= 1)) throw new Error('Invalid touch rotary motion');
    let travel = 0;
    return Object.freeze({
      feed(dx, dt) {
        if (!Number.isFinite(dx) || !Number.isFinite(dt) || !dx) return 0;
        const velocity = Math.abs(dx) / Math.max(8, dt);
        const gain = Math.min(2.8, 1 + 0.85 * velocity);
        travel += dx * gain;
        const steps = Math.min(maxSteps, Math.trunc(Math.abs(travel) / pixelsPerStep));
        if (!steps) return 0;
        const result = Math.sign(travel) * steps;
        travel -= result * pixelsPerStep;
        return result;
      },
      reset() { travel = 0; },
      pending() { return travel; }
    });
  }

  function tapDirection(clientX, rect) {
    return clientX < rect.left + rect.width / 2 ? -1 : 1;
  }

  function install(doc) {
    if (!doc || doc.__b737TouchRotarySwipeV1) return false;
    doc.__b737TouchRotarySwipeV1 = true;
    let active = null;
    const suppressClicks = new WeakMap();
    const style = doc.createElement('style');
    style.id = 'b737-touch-rotary-swipe-style-v1';
    style.textContent = SELECTOR + '{touch-action:none!important;-webkit-user-select:none!important;user-select:none!important}';
    (doc.head || doc.documentElement).appendChild(style);

    function stop(e) {
      if (e.cancelable) e.preventDefault();
      e.stopImmediatePropagation();
    }
    function step(el, count) {
      const reversed = el.matches(REVERSE);
      const direction = Math.sign(count);
      for (let i = 0; i < Math.abs(count); i++) {
        // Standard knobs: swipe right = clockwise/increase. The MCP IAS/MACH
        // and ASP volume wheel handlers have opposite native wheel polarity.
        const deltaY = direction * (reversed ? -100 : 100);
        el.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true, cancelable: true, deltaY, deltaMode: 0
        }));
      }
    }
    function clear(e, cancelled) {
      if (!active || (e && e.pointerId !== active.id)) return;
      const current = active;
      active = null;
      if (e) stop(e);
      suppressClicks.set(current.el, (typeof performance === 'object' ? performance.now() : Date.now()) + 650);
      if (!cancelled && !current.moved) {
        const x = e && Number.isFinite(e.clientX) ? e.clientX : current.startX;
        step(current.el, tapDirection(x, current.el.getBoundingClientRect()));
      }
      try {
        if (current.el.hasPointerCapture?.(current.id))
          current.el.releasePointerCapture(current.id);
      } catch (_) { /* A removed or replaced knob has already lost capture. */ }
    }

    doc.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      if (active) {
        // Second finger is not interpreted as a second knob or rapid turn.
        clear(null, true);
        return;
      }
      if (e.isPrimary === false || e.button !== 0) return;
      // Native ASP controller handles both touch and mouse with a single
      // pointer capture owner; never intercept its events at document capture.
      if (e.target?.closest?.(ASP_VOLUME)) return;
      const el = e.target?.closest?.(SELECTOR);
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      stop(e);
      active = {
        el, id: e.pointerId, startX: e.clientX, startY: e.clientY,
        lastX: e.clientX, lastTime: e.timeStamp,
        moved: false, motion: createMotion()
      };
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      el.focus?.({ preventScroll: true });
    }, true);
    doc.addEventListener('pointermove', e => {
      if (!active || e.pointerId !== active.id) return;
      stop(e);
      const item = active;
      const dx = e.clientX - item.lastX;
      const dt = e.timeStamp - item.lastTime;
      item.lastX = e.clientX;
      item.lastTime = e.timeStamp;
      if (Math.hypot(e.clientX - item.startX, e.clientY - item.startY) > 5)
        item.moved = true;
      if (!item.moved || !dx) return;
      const count = item.motion.feed(dx, dt);
      if (count) step(item.el, count);
    }, true);
    doc.addEventListener('pointerup', e => clear(e, false), true);
    doc.addEventListener('pointercancel', e => clear(e, true), true);
    doc.addEventListener('lostpointercapture', e => {
      if (active && e.pointerId === active.id) clear(e, true);
    }, true);
    doc.addEventListener('click', e => {
      if (e.detail === 0) return; // keyboard accessibility stays functional
      const el = e.target?.closest?.(SELECTOR);
      if (!el) return;
      const now = typeof performance === 'object' ? performance.now() : Date.now();
      if (now <= (suppressClicks.get(el) || 0)) stop(e);
    }, true);
    doc.defaultView?.addEventListener('blur', () => clear(null, true));
    return true;
  }
  return Object.freeze({ createMotion, tapDirection, install, selector: SELECTOR,
    ASP_SWIPE_START_PX, ASP_VOLUME });
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./electrical-consumer-subscribers-v1.js?v=ATA24-CONSUMER-REG-0003 */
try{
/* ATA24 Unified electrical consumer registration (event driven, no polling).
 * Register ALL logical MRG devices once. Their cached supply is updated only
 * by the existing bus/CB event hub; only implemented owners receive actions.
 * No stand-alone electrical plant or per-frame/interval electrical queries.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){
  root.B737UnifiedElectricalSubscribersV1=api;
  const boot=()=>{try{api.install(root);}catch(e){console.error('ATA24 registrations',e);}};
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
 }
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='ATA24-CONSUMER-REG-0001';
 const OWNER_GROUPS=Object.freeze({
  ISN:'ISN',WINDOW:'WINDOW',ENGINE:'ENGINE',AUTOBRAKE:'AUTOBRAKE',
  CDU:'CDU',ANTIICE:'ANTIICE'
 });
 const groupFor=name=>{
  if(/^Fuel Boost Pump|^Electric Hydraulic Pump|^Engine [12] Electric Hydraulic Pump Control/i.test(name))return 'ISN';
  if(/^Window Heat(?: Control)?\b/i.test(name))return 'WINDOW';
  if(/^Alpha Vane AoA|^Pitot Heat|^Temp Probe Heat|^Wing Anti-Ice|^Engine [12] Anti-Ice/i.test(name))return 'ANTIICE';
  if(name==='Autobrake Control')return 'AUTOBRAKE';
  if(name==='CDU FO')return 'CDU';
  if(/^(?:Engine [12] (?:Fuel Flow Indication|N2 Indication|Oil Pressure Indication|Oil Quantity Indication|Oil Temp Indication)|Engines? (?:N1|N2|EGT|Fuel Flow) Indication|Engine 1-2 AVM Indication)/i.test(name))return 'ENGINE';
  return null;
 };
 function createRegistry(bridge,owners={}){
  if(!bridge?.subscribeDevice||!bridge?.subscribe)throw Error('ATA24 event bridge required');
  const state=new Map(),unsubscribers=[],pending=new Set();
  let registered=false,scheduled=false,active=true,registrationCount=0,groupCalls=0,ownerRouted=0;
  const doFlush=()=>{
   scheduled=false;
   if(!active)return;
   const groups=[...pending];pending.clear();
   if(groups.includes('ISN')&&groups.includes('ANTIICE'))
    groups.splice(groups.indexOf('ANTIICE'),1); // ISN render updates alpha too
   for(const group of groups){
    const handler=owners[group];
    if(typeof handler!=='function')continue;
    try{handler(state);groupCalls++;}catch(e){console.warn('ATA24 owner group '+group,e);}
   }
  };
  function mark(group){
   if(!group||!active)return;
   pending.add(group);
   if(scheduled)return;scheduled=true;
   Promise.resolve().then(doFlush);
  }
  function attach(snapshot){
   if(!active||registered||!snapshot?.devices)return false;
   // 322 known logical devices (including variants not fitted in current model).
   // An entry in the registry means power telemetry is connected, NOT that
   // an unimplemented aircraft component has been magically simulated.
   const names=Object.keys(snapshot.devices);
   if(names.length!==322)throw Error('ATA24 expected 322 MRG logical devices, found '+names.length);
   for(const name of names){
    const group=groupFor(name);
    if(group)ownerRouted++;
    const stop=bridge.subscribeDevice(name,event=>{
     const d=event?.value;if(!d)return;
     state.set(name,{state:d.state,topology:d.topology,
      capabilities:d.capabilities||{},group,
      channelCount:d.feedChannels?.length||0,sequence:event.sequence});
     if(group)mark(group);
    });
    unsubscribers.push(stop);registrationCount++;
   }
   registered=true;
   return true;
  }
  // The legacy aggregate callback fires only on actual electrical changes,
  // not on every ECU observation. We use it solely for one-time registration.
  const off=bridge.subscribe(s=>{if(!registered)attach(s);});
  unsubscribers.push(off);
  return Object.freeze({
   version:VERSION,get ready(){return registered&&active;},
   getRegistrationCount:()=>registrationCount,
   getState:name=>{const d=state.get(name);return d?{...d,capabilities:{...d.capabilities}}:null;},
   getStats:()=>({registered:registrationCount,cached:state.size,
    ownerRouted,telemetryOnly:registrationCount-ownerRouted,
    ownerActions:groupCalls,pendingGroups:pending.size,ready:registered&&active}),
   destroy:()=>{active=false;pending.clear();
    for(const fn of unsubscribers)try{fn?.();}catch(e){console.warn(e);}
    unsubscribers.length=0;state.clear();}
  });
 }
 let runtime=null;
 function install(win){
  if(runtime)return runtime;
  const bridge=win.B737UnifiedBusConsumerLiveV1;
  if(!bridge?.subscribeDevice||!bridge?.subscribe)return null;
  const owner={
   ISN:()=>win.B737ISNCockpitV1?.reconcileElectricalConsumers?.('ATA24_EVENT_DELTA'),
   ANTIICE:()=>win.B737ISNCockpitV1?.refreshElectricalAnnunciations?.(),
   WINDOW:()=>{
    const feeds={};let complete=true;
    for(const [name,voltage]of [['generator1','115VAC'],['generator2','115VAC'],
     ['main1','115VAC'],['main2','115VAC'],['dc1','28VDC'],['dc2','28VDC']]){
     const value=bridge.getBus(name,voltage)?.powered;
     if(typeof value!=='boolean'&&value!==null)complete=false;
     feeds[name]=value;
    }
    if(complete)win.B737WindowHeatUnifiedV1?.setElectricalBusSnapshot?.(feeds);
   },
   ENGINE:()=>win.B737UnifiedEngineIndicationsV2?.onElectricalPowerChange?.(),
   CDU:state=>win.B737UnifiedCduBusFailureGateV1?.receiveElectricalAvailability?.(
    state.get('CDU FO')?.state??null),
   AUTOBRAKE:state=>win.B737AutobrakeUnified?.receiveElectricalAvailability?.(
    state.get('Autobrake Control')?.state??null)
  };
  runtime=createRegistry(bridge,owner);
  win.B737UnifiedElectricalRuntimeV1=runtime;
  return runtime;
 }
 return Object.freeze({VERSION,OWNER_GROUPS,groupFor,createRegistry,install,
  isReady:()=>runtime?.ready===true,getStats:()=>runtime?.getStats()||null});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
