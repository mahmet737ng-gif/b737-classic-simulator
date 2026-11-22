(async()=>{
;
/* ./aircraft-settings.js?v=ENGLISH-SETTINGS-FAMILY-IDENT-0001&amp;cb=CB-UNIFIED-0001 */
try{
(function() {
  'use strict';
  const api = window.B737AircraftProfileV1;
  if (!api) throw Error('Aircraft profile registry is not loaded');
  const byId = id => document.getElementById(id);
  const settings = byId('aircraftSettingsDialog');
  const pressureDialog = byId('selectedPressurizationDialog');
  const pressureFrame = byId('selectedPressureFrame');
  const form = byId('aircraftSettingsForm');
  let storage = null;
  try { storage = window.localStorage; } catch (_) { /* browser storage may be restricted */ }
  const store = api.createStore({storage, emitter: window});
  const airfieldModel=window.B737GroundAirfieldElevationV1;
  if(!airfieldModel)throw Error('Ground airfield elevation registry not loaded');
  const airfieldStoreKey='b737.pressurization.trainer-airfield.v1';
  let storedGround=null;
  try{storedGround=JSON.parse(storage?.getItem(airfieldStoreKey)||'null');}catch(_){}
  function initialGround(){
    try {
      if(storedGround&&storedGround.icao&&storedGround.fieldElevationFt!=null)
        return airfieldModel.resolve(storedGround.icao,storedGround.fieldElevationFt);
    } catch(_){}
    // Visible TRAINING SCENARIO, not an assertion about simulator position.
    return airfieldModel.resolve('OIII');
  }
  let groundSelection=initialGround();
  // Cold-dark policy can obtain the same selected ground baseline.
  window.B737GroundAirfieldContext=()=>{
    const physical=pressureSessions.get(selectedPressure())?.physical();
    const onGround=pressureEnvironment.onGround;
    const equalized=onGround&&(!physical||Math.abs(physical.differentialPsid)<0.05);
    return Object.freeze({
      fieldElevationFt:groundSelection.fieldElevationFt,
      cabinAltitudeFt:physical?.cabinAltitudeFt??null,
      cabinEqualized:equalized,
      cabinPressureStable:equalized&&Math.abs(physical?.cabinRateFtMin||0)<1,
      groundAirportIcao:groundSelection.icao
    });
  };
  let activeSession = null;
  const pressureSessions = new Map();
  window.B737AircraftProfileStore = store;
  function selectedPressure(){return store.resolve().pressurization.id;}
  function getPressureSession(system){
    if(!['DCPCS','CPCS'].includes(system))throw Error('Unsupported pressurization system');
    if(!pressureSessions.has(system)){
      pressureSessions.set(system,api.createPressurizationSession(
        {...store.get(),pressurization:system},window,
        {fieldElevationFt:groundSelection.fieldElevationFt}));
    }
    return pressureSessions.get(system);
  }
  // One authoritative engine state per installation. Swapping installation
  // does not mix CPCS controls, lamp output or memory with DCPCS.
  window.addEventListener('b737:cb-state-change',()=>publishPressureState());
  function publishPressureState(system=selectedPressure()){
    if(system!==selectedPressure())return;
    const session=getPressureSession(system);
    const target=byId('overheadFrame')?.contentWindow;
    if(target)target.postMessage({
      type:'b737:cockpit-command',action:'pressurization-state',
      system,output:session.read(),state:session.snapshot()
    },location.origin);
    window.dispatchEvent(new CustomEvent('b737:pressurization-state',{
      detail:{system,output:session.read(),state:session.snapshot()}
    }));
  }
  function applyPressureCommand(system,cmd){
    if(system!==selectedPressure())throw Error('Control belongs to the inactive pressurization installation');
    if(!cmd||!['MODE','MANUAL_SWITCH','INPUT','ALTITUDE','CABIN_RATE','FLIGHT_GROUND','VALVE_SWITCH','AUTO_CHECK','ADVANCE'].includes(cmd.type))throw Error('Invalid OH22 control command');
    const session=getPressureSession(system);
    const output=session.dispatch(cmd);
    publishPressureState(system);
    return output;
  }
  window.addEventListener('message',event=>{
    if(event.origin!==location.origin||event.source!==byId('overheadFrame')?.contentWindow)return;
    const msg=event.data;
    if(msg?.type!=='b737:cockpit-overhead')return;
    if(msg.kind==='pressurization-need-state'&&msg.system===selectedPressure()){
      publishPressureState(msg.system);
    } else if(msg.kind==='pressurization-command'){
      try{applyPressureCommand(msg.system,msg.command);}
      catch(error){
        byId('activeProfileStatus').textContent='OH22 '+msg.system+': '+error.message;
        publishPressureState();
      }
    } else if(msg.kind==='pressurization-horn-cutout'){
      // The physical cutout button belongs to OH19-DIFF, immediately next
      // to CPCS OH22. Route it to the EXISTING ISN cabin warning controller.
      // Never create an independent horn clock or silence unrelated alarms.
      if(msg.system!=='CPCS'||msg.system!==selectedPressure()||msg.sourcePiece!=='OH19-DIFF')return;
      const warning=window.B737ISNCockpitV1;
      if(typeof warning?.instructor==='function'){
        try{
          warning.instructor({type:'CUTOUT_CABIN'});
          byId('activeProfileStatus').textContent='CPCS ALT HORN CUTOUT → ISN WarningEngine (cabin horn only)';
        }catch(error){byId('activeProfileStatus').textContent='ALT HORN CUTOUT REJECTED: '+error.message;}
      }else{
        byId('activeProfileStatus').textContent='ALT HORN CUTOUT NOT READY: ISN warning owner has not initialized';
      }
    }
  });
  // Future simulator sensor adapters can inject sourced inputs to the selected
  // pressure engine; no made-up shared physical pressure model is introduced.
  // Standalone Unified trainer environment: explicit instructor inputs until
  // the upstream flight and PACK systems publish validated live adapters.
  // Do NOT silently interpret missing PACK data as a real electrical bus state.
  const pressureEnvironment={aircraftAltitudeFt:groundSelection.fieldElevationFt??0,
    onGround:true,packsAvailable:false,bleedAirAvailable:false};
  // Apply a loaded FLT PHASE scenario to the physical pressure trainer BEFORE
   // the next one-second plant update. The CPCS FLT/GRD selector must reflect
   // airborne scenarios even when the aircraft did not start on the ground.
   window.addEventListener('b737:flight-scenario-state',event=>{
     const flight=event.detail;
     if(typeof flight?.airborne!=='boolean')return;
     const onGround=!flight.airborne;
     const altitude=Number.isFinite(flight.altitudeFt)?flight.altitudeFt:null;
     const changed=pressureEnvironment.onGround!==onGround;
     const altitudeChanged=altitude!==null&&Math.abs(pressureEnvironment.aircraftAltitudeFt-altitude)>1;
     if(!changed&&!altitudeChanged)return;
     pressureEnvironment.onGround=onGround;
     if(altitude!==null)pressureEnvironment.aircraftAltitudeFt=altitude;
     if(groundBox)groundBox.checked=onGround;
     if(altitudeBox&&altitude!==null)altitudeBox.value=String(Math.round(altitude));
     if(changed&&selectedPressure()==='CPCS'){
       getPressureSession('CPCS').dispatch({type:'FLIGHT_GROUND',value:onGround?'GRD':'FLT'});
     }
     publishPressureState();
   });
   let pressureRunning=true,packInstructorOverride=false,packSource='COLD_DARK_NO_BLEED';
  const pressureMount=byId('pressurePhysicsDiagnostics');
  const details=document.createElement('details');
  details.innerHTML='<summary>Cabin pressure · physical trainer / diagnostics</summary>'+
    '<label style="display:block">On-ground airport / CAB ALT baseline <select id="pressureGroundAirport" style="width:100%">'+
      '<option value="OIII">OIII · Mehrabad · 3963 ft</option>'+
      '<option value="OIAW">OIAW · Ahwaz · 66 ft</option>'+
      '<option value="OIMM">OIMM · Mashhad · 3260 ft</option>'+
      '<option value="CUSTOM">Other airport · explicit elevation</option>'+
    '</select></label>'+
    '<label style="display:block">Airport ICAO <input id="pressureGroundIcao" maxlength="4" placeholder="OIII" style="width:100%"></label>'+
    '<label style="display:block">Field elevation (ft) <input id="pressureGroundElevation" type="number" min="-2000" max="14000" step="1" style="width:100%"></label>'+
    '<button id="pressureApplyGroundAirport" type="button">Apply airport cold-dark baseline</button>'+
    '<small id="pressureGroundStatus">Airport scenario elevations supplied for this trainer; live airport data may override.</small>'+
    '<label style="display:block">Aircraft ALT (ft) <input id="pressureInstructorAltitude" type="number" min="-1000" max="40000" step="1" value="0" style="width:100%"></label>'+
    '<label style="display:block"><input id="pressureInstructorGround" type="checkbox" checked> On ground</label>'+
    '<label style="display:block"><input id="pressureInstructorPacks" type="checkbox"> PACK / bleed source available (trainer override)</label>'+
    '<button id="pressureTrainerRun" type="button">Pause physical model</button> '+
    '<button id="pressureTrainerReset" type="button">Reset selected model</button>'+
    '<output id="pressureTrainerReadout" style="display:block;white-space:pre-line;direction:ltr;text-align:left;font:12px/1.6 monospace"></output>'+
    '<small>Provisional physics only: mass flow, cabin volume, relief and valve rate not aircraft-calibrated. These inputs are instructor overrides, not actual avionics wiring.</small>';
  pressureMount?.append(details);
  const altitudeBox=byId('pressureInstructorAltitude'),groundBox=byId('pressureInstructorGround'),packsBox=byId('pressureInstructorPacks');
  const groundAirportBox=byId('pressureGroundAirport');
  const groundIcaoBox=byId('pressureGroundIcao');
  const groundElevationBox=byId('pressureGroundElevation');
  const groundStatus=byId('pressureGroundStatus');
  function displayGroundSelection(){
    const preset=!!airfieldModel.AIRFIELDS[groundSelection.icao]&&
      airfieldModel.AIRFIELDS[groundSelection.icao].elevationFt===groundSelection.fieldElevationFt;
    if(groundAirportBox)groundAirportBox.value=preset?groundSelection.icao:'CUSTOM';
    if(groundIcaoBox)groundIcaoBox.value=groundSelection.icao||'';
    if(groundElevationBox)groundElevationBox.value=String(groundSelection.fieldElevationFt??'');
    if(altitudeBox)altitudeBox.value=String(pressureEnvironment.aircraftAltitudeFt);
    if(groundStatus)groundStatus.textContent=
      (groundSelection.icao||'CUSTOM')+' · field '+groundSelection.fieldElevationFt+
      ' ft · '+groundSelection.source+' · cabin initial = field when equalized';
  }
  function setGroundAirport(icao,overrideFt,source){
    if(!pressureEnvironment.onGround)throw Error('Cannot change the cold-dark airport during flight');
    const selection=airfieldModel.resolve(icao,overrideFt);
    if(!selection.groundReferenceKnown)throw Error('Unknown airport elevation; supply a real value in feet');
    // Preflight every existing installation before mutating either. CPCS
    // and DCPCS continue to hold independent plant/controller state.
    for(const [system,session] of pressureSessions){
      const sensor=session.snapshot().input||session.snapshot().inputs;
      if(!sensor.onGround||Math.abs(session.physical()?.differentialPsid||0)>0.05)
        throw Error(system+' cannot reinitialize a non-equalized or airborne cabin');
    }
    for(const session of pressureSessions.values())session.rebaseGround(selection.fieldElevationFt);
    groundSelection=selection;
    pressureEnvironment.aircraftAltitudeFt=selection.fieldElevationFt;
    pressureEnvironment.onGround=true;
    groundBox.checked=true;
    if(storage)try{storage.setItem(airfieldStoreKey,JSON.stringify({
      icao:selection.icao,fieldElevationFt:selection.fieldElevationFt
    }));}catch(_){}
    displayGroundSelection();
    publishPressureState();
    updatePressureDiagnostics();
    window.dispatchEvent(new CustomEvent('b737:cold-dark-state',{
      detail:window.B737GroundAirfieldContext()
    }));
    window.dispatchEvent(new CustomEvent('b737:ground-airfield-changed',{
      detail:{...selection,scenarioSource:source||'TRAINER_SELECTION'}
    }));
    return selection;
  }
  groundAirportBox?.addEventListener('change',()=>{
    const code=groundAirportBox.value;
    if(code==='CUSTOM'){groundIcaoBox.value='';groundElevationBox.value='';return;}
    const selection=airfieldModel.resolve(code);
    groundIcaoBox.value=code;
    groundElevationBox.value=String(selection.fieldElevationFt);
  });
  byId('pressureApplyGroundAirport')?.addEventListener('click',()=>{
    try{
      const custom=groundAirportBox.value==='CUSTOM';
      const code=custom?groundIcaoBox.value:groundAirportBox.value;
      const ft=custom?(groundElevationBox.value.trim()?Number(groundElevationBox.value):null):undefined;
      setGroundAirport(code,ft,'MANUAL_TRAINER');
    }catch(error){if(groundStatus)groundStatus.textContent='AIRFIELD ERROR: '+error.message;}
  });
  window.addEventListener('b737:airport-ground-context',event=>{
    const ctx=event.detail;
    if(!ctx||ctx.onGround===false)return;
    try{setGroundAirport(ctx.icao,ctx.fieldElevationFt,'EXTERNAL_AIRPORT_CONTEXT');}
    catch(error){if(groundStatus)groundStatus.textContent='GROUND SOURCE REJECTED: '+error.message;}
  });
  displayGroundSelection();
  altitudeBox?.addEventListener('change',()=>{
    const altitude=Number(altitudeBox.value);
    if(!Number.isFinite(altitude)||altitude< -1000||altitude>40000){altitudeBox.value=String(pressureEnvironment.aircraftAltitudeFt);return;}
    pressureEnvironment.aircraftAltitudeFt=altitude;
  });
  groundBox?.addEventListener('change',()=>{pressureEnvironment.onGround=groundBox.checked;});
  packsBox?.addEventListener('change',()=>{packInstructorOverride=true;packSource='INSTRUCTOR_OVERRIDE';pressureEnvironment.packsAvailable=packsBox.checked;pressureEnvironment.bleedAirAvailable=packsBox.checked;});
  byId('pressureTrainerRun')?.addEventListener('click',()=>{
    pressureRunning=!pressureRunning;
    byId('pressureTrainerRun').textContent=pressureRunning?'Pause physical model':'Resume physical model';
  });
  byId('pressureTrainerReset')?.addEventListener('click',()=>{
    getPressureSession(selectedPressure()).reset();
    publishPressureState();
    updatePressureDiagnostics();
  });
  function updatePressureDiagnostics(){
    const active=selectedPressure(),out=getPressureSession(active).read(),p=out.physical;
    const node=byId('pressureTrainerReadout');
    if(!node)return;
    node.textContent=!p?'Physical plant unavailable':
      active+' · '+out.operatingMode+
      '\\nCAB ALT: '+p.cabinAltitudeFt.toFixed(0)+' ft | RATE: '+p.cabinRateFtMin.toFixed(0)+' ft/min'+
      '\\nDIFF: '+p.differentialPsid.toFixed(2)+' psid | VALVE: '+(100*p.valveOpenFraction).toFixed(0)+'% open'+
      '\\nTARGET: '+p.targetCabinAltitudeFt.toFixed(0)+' ft | PACK: '+p.packFlowKgS.toFixed(2)+' kg/s ('+packSource+')'+
      '\\nAUTO FAIL: '+Boolean(out.lamps.autoFail)+' | ALT: '+pressureEnvironment.aircraftAltitudeFt+' ft'+
      '\\nAIRPORT: '+(groundSelection.icao||'OTHER')+' | FIELD: '+groundSelection.fieldElevationFt+' ft';
  }
  // Keep cabin physics isolated to the selected installation; browser tabs
  // in the background must not simulate a giant elapsed interval on return.
  window.setInterval(()=>{
    if(!pressureRunning||document.hidden)return;
    try{
      // ISN-03 pneumatic output is only trusted if its source observations
      // are complete. Unknown does NOT mean PACK OFF.
      const air=window.B737ISNCockpitV1?.getPressurizationAir?.();
      const conditioned=air?.packConditionedAirAvailable;
      if(!packInstructorOverride&&typeof conditioned==='boolean'){
        pressureEnvironment.packsAvailable=conditioned;
        pressureEnvironment.bleedAirAvailable=conditioned;
        packsBox.checked=conditioned;
        packSource='SOURCE_GATED_PNEUMATICS_V6';
      }
      const active=selectedPressure(),session=getPressureSession(active);
      if(active==='DCPCS'){
        // Functional signal only. Stall Management / ISN signal pin mapping
        // remains UNKNOWN; never combine N1 from one engine with N2 of another.
        const running=window.B737ISNCockpitV1?.getStartState?.()?.runningEnvelope?.engines;
        const pairs=Object.values(running||{}).filter(v=>v&&Number.isFinite(v.n1Percent)&&Number.isFinite(v.n2Percent));
        if(pairs.length){
          const sample=pairs.sort((x,y)=>Math.min(y.n1Percent/60,y.n2Percent/89)-Math.min(x.n1Percent/60,x.n2Percent/89))[0];
          const current=session.snapshot().input;
          if(Math.abs(current.engineN1Pct-sample.n1Percent)>.05)session.dispatch({type:'INPUT',key:'engineN1Pct',value:sample.n1Percent});
          if(Math.abs(current.engineN2Pct-sample.n2Percent)>.05)session.dispatch({type:'INPUT',key:'engineN2Pct',value:sample.n2Percent});
        }
      }
      session.stepPhysics(1000,{...pressureEnvironment});
      // Send measured cabin altitude to the ALREADY EXISTING ISN warning
      // engine. No second horn instance or duplicate audio timer is created.
      const measured=session.physical()?.cabinAltitudeFt;
      if(Number.isFinite(measured)&&typeof window.B737ISNCockpitV1?.instructor==='function'){
        window.B737ISNCockpitV1.instructor({type:'WARNING_SENSOR',key:'cabinAltitudeFt',value:measured});
      }
      publishPressureState(active);
      updatePressureDiagnostics();
    }catch(error){
      pressureRunning=false;
      const node=byId('pressureTrainerReadout');
      if(node)node.textContent='PRESSURE PHYSICS STOPPED: '+error.message;
    }
  },1000);
  window.B737PressurizationIntegration=Object.freeze({
    getSelected:selectedPressure,
    read:system=>getPressureSession(system).read(),
    snapshot:system=>getPressureSession(system).snapshot(),
    dispatch:applyPressureCommand,
    setGroundAirport:(icao,fieldElevationFt)=>setGroundAirport(icao,fieldElevationFt,'EXTERNAL_API'),
    getGroundAirport:()=>({...groundSelection}),
    feed(system,key,value){
      if(system===selectedPressure()&&key==='airportIcao')
        return setGroundAirport(value,null,'EXTERNAL_ADAPTER');
      if(system===selectedPressure()&&key==='fieldElevationFt')
        return setGroundAirport(groundSelection.icao,value,'EXTERNAL_ADAPTER');
      if(system===selectedPressure()&&key==='packsAvailable'){
        packInstructorOverride=true;packSource='EXTERNAL_ADAPTER';pressureEnvironment.packsAvailable=Boolean(value);packsBox.checked=Boolean(value);return getPressureSession(system).read();
      }
      if(system===selectedPressure()&&key==='airplaneAltitudeFt'){
        pressureEnvironment.aircraftAltitudeFt=value;altitudeBox.value=String(value);
      }
      if(system===selectedPressure()&&key==='onGround'){
        const onGround=Boolean(value),changed=pressureEnvironment.onGround!==onGround;
         pressureEnvironment.onGround=onGround;groundBox.checked=onGround;
         if(changed&&system==='CPCS')
           getPressureSession('CPCS').dispatch({type:'FLIGHT_GROUND',value:onGround?'GRD':'FLT'});
      }
      if(system===selectedPressure()&&key==='bleedAirAvailable'){
        pressureEnvironment.bleedAirAvailable=Boolean(value);packsBox.checked=Boolean(value);
      }
      return applyPressureCommand(system,{type:'INPUT',key,value});
    },
    sync:()=>publishPressureState()
  });

  // No bare DCPCS/CPCS artwork preview is mounted in Settings.
  // Keep owner-approved OH22 artwork selection inside the cockpit itself.

  function render(detail) {
    const selected = detail.resolved;
    const family = selected.aircraftModel.label;
    const installedEngine = selected.engineVariant;
    const pressure = selected.pressurization.id;
    const instruments = selected.engineInstruments.id === 'EIS' ? 'EIS' : 'Non-EIS';
    byId('aircraftProfileHeader').textContent = family + ' · ' + installedEngine.label + ' (' + installedEngine.rating + ')' + ' · ' + pressure + ' · ' + instruments;
    byId('activeAircraftFamily').textContent = family;
    byId('activePressurization').textContent = pressure;
    byId('activeEngineInstruments').textContent = selected.engineInstruments.label;
    // Apply the selected owner artwork to the embedded OH22 panel, not only this dialog.
    const overheadFrame = byId('overheadFrame');
    if(overheadFrame?.contentWindow) {
      overheadFrame.contentWindow.postMessage({
        type:'b737:cockpit-command', action:'pressurization-background', system:pressure
      }, location.origin);
      overheadFrame.contentWindow.postMessage({
        type:'b737:cockpit-command', action:'aircon-background', family:selected.family.id
      }, location.origin);
    }
    byId('openSelectedPressurizationPanel').textContent = 'Open '+pressure+' Pressure Panel';
    try {
      activeSession = getPressureSession(pressure);
      if(pressure==='CPCS'){
        const expected=pressureEnvironment.onGround?'GRD':'FLT';
        if(activeSession.snapshot().flightGround!==expected)
          activeSession.dispatch({type:'FLIGHT_GROUND',value:expected});
      }
      window.B737ActivePressurization = activeSession;
      publishPressureState(pressure);
      byId('activeProfileStatus').textContent = pressure+' V'+activeSession.engineVersion+' active. OH22 indications use the selected pressure controller. Cabin-pressure plant is a training model; coefficients and actuator timing are not aircraft-validated.';
    } catch (error) {
      window.B737ActivePressurization = null;
      byId('activeProfileStatus').textContent = 'Selected pressure controller unavailable: '+error.message;
    }
    if (pressureDialog.open) {
      byId('selectedPressureTitle').textContent = pressure+' · Cabin Pressurization';
      pressureFrame.src = '../../' + selected.pressurization.lab;
    }
  }

  store.subscribe(render);
  render({resolved: store.resolve()});
  updatePressureDiagnostics();

  // Aircraft family is the only selectable aircraft/IDENT model source.
  // ProfileStore derives 737-300 / 20K and 737-400 / 22K automatically.

  function showSettings() {
    const profile = store.get();
    for (const field of api.FIELDS) {
      const control = form.querySelector('input[name="' + field + '"][value="' + profile[field] + '"]');
      if (control) control.checked = true;
    }
    byId('aircraftSettingsError').hidden = true;
    byId('ivsiEquipment').value=localStorage.getItem('b737.ivsi.equipment')||'analog';
    settings.showModal();
  }
  byId('aircraftSettingsOpen').addEventListener('click', showSettings);
  byId('aircraftSettingsClose').addEventListener('click', () => settings.close());
  byId('aircraftSettingsCancel').addEventListener('click', () => settings.close());
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(form);
    const editableFields = ['aircraftFamily','pressurization','engineInstruments'];
    const changes = Object.fromEntries(editableFields.map(field => [field, values.get(field)]));
    try {
      store.set(changes);
      localStorage.setItem('b737.ivsi.equipment',byId('ivsiEquipment').value);
      window.dispatchEvent(new Event('b737:ivsi-equipment'));
      settings.close();
    } catch (error) {
      const notice = byId('aircraftSettingsError');
      notice.hidden = false;
      notice.textContent = 'Settings not saved: '+error.message;
    }
  });

  byId('openSelectedPressurizationPanel').addEventListener('click', () => {
    const selected = store.resolve().pressurization;
    byId('selectedPressureTitle').textContent = selected.id+' · Cabin Pressurization';
    pressureFrame.src = '../../' + selected.lab;
    pressureDialog.showModal();
  });
  function closePressure() {
    pressureDialog.close();
    pressureFrame.removeAttribute('src');
  }
  byId('selectedPressureClose').addEventListener('click', closePressure);
  pressureDialog.addEventListener('close', () => pressureFrame.removeAttribute('src'));
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cdu-ident-profile-bridge-v1.js?v=CDU-ENGINE-IDENT-0001 */
try{
/* Source-of-truth: Unified Aircraft Settings -> both CDU IDENT screens.
 * No cockpit bitmap/hotspot edits. This does not certify an actual
 * aircraft installation or alter electrical/FMC/engine physics.
 */
(function(root){
 'use strict';
 const store=root.B737AircraftProfileStore;
 const catalog=root.B737CDUIdentInstallationV1;
 if(!store||!catalog){root.console?.error('CDU engine IDENT configuration dependencies missing');return;}
 const seats=['CAPT','FO'];
 function current(){return catalog.select(store.get());}
 function send(seat){
  if(!seats.includes(seat))return false;
  const frame=root.document.getElementById('cduFrame'+seat);
  if(!frame?.contentWindow)return false;
  frame.contentWindow.postMessage({
   type:'b737:cdu-installation-v1',seat,installation:current()
  },root.location.origin);
  return true;
 }
 function broadcast(){return seats.map(seat=>({seat,delivered:send(seat)}));}
 root.addEventListener('message',event=>{
  if(event.origin!==root.location.origin||!seats.includes(event.data?.seat)||
     event.data?.type!=='b737:cdu-installation-request-v1')return;
  const frame=root.document.getElementById('cduFrame'+event.data.seat);
  if(event.source!==frame?.contentWindow)return;
  send(event.data.seat);
 });
 // The two IFRAMES are mounted after the settings bootstrap; handle both
 // the initial load and later iframe reloads, not just settings changes.
 root.document.addEventListener('load',event=>{
  for(const seat of seats){
   if(event.target===root.document.getElementById('cduFrame'+seat)){send(seat);break;}
  }
 },true);
 store.subscribe(broadcast);
 root.B737CDUIdentProfileBridgeV1=Object.freeze({
  version:catalog.VERSION,current,broadcast
 });
 broadcast();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cdu-bus-failure-gate-v1.js?v=ATA24-CONSUMER-REG-0001 */
try{
/* CDU First Officer electrical availability training gate.
 * CAPT CDU is deliberately not mounted in Unified. Do not create a second
 * FMC owner, mutate route state or change the approved CDU bitmap.
 */
(function(win){'use strict';
 const API=()=>win.B737UnifiedBusFailureInjectionV1?.live;
 let receivedState=null,eventRegistered=false;
 function receiveElectricalAvailability(state){
  if(!['NORMAL','OFF','UNKNOWN','DEGRADED','NOT_INSTALLED'].includes(state))return false;
  if(eventRegistered&&state===receivedState)return false;
  eventRegistered=true;receivedState=state;refresh();return true;
 }
 function refresh(){
  const frame=win.document?.getElementById('cduFrameFO');
  if(!frame)return;
  const aperture=frame.closest?.('.cdu-frame-window')||frame.parentElement;
  const station=frame.closest?.('.cdu-station');
  if(!aperture||!station)return;
  const scenario=API()?.get();
  const injecting=scenario?.active===true;
  const bus=win.B737ISNCockpitV1?.getState?.()?.state?.electrical?.bus;
  // Electronic Bus 1 AC is the MRG source for the FO CDU. The generic
  // Classic model derives it from Generator Bus 1; a direct electronic bus
  // injection can independently remove this LRU feed.
  const loss=eventRegistered?
   (receivedState==='OFF'||receivedState==='NOT_INSTALLED'):
   injecting&&(scenario.offBusKeys.includes('electronic1@115VAC')||
    bus?.generator1===false);
  station.dataset.busInjectionPower=loss?'OFF':'UNINJECTED';
  aperture.style.filter=loss?'brightness(0)':'';
  aperture.style.pointerEvents=loss?'none':'';
  const status=win.document.getElementById('cduStatus');
  if(status){
   status.dataset.injectedPower=String(loss);
   status.title=loss?'FO CDU feed lost (Electronic Bus 1 AC), training injection only':'';
  }
 }
 for(const e of ['b737:bus-failure-injection-changed','b737:electrical-owner-ready',
  'b737:cockpit-mounted','b737:electrical-v7-state'])
  win.addEventListener(e,()=>{if(!eventRegistered||e==='b737:cockpit-mounted')refresh();});
 if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',refresh,{once:true});
 else refresh();
 win.B737UnifiedCduBusFailureGateV1=Object.freeze({refresh,receiveElectricalAvailability,
  powered:()=>win.document?.getElementById('cduFrameFO')?.closest?.('.cdu-station')?.dataset?.busInjectionPower!=='OFF'});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cdu-airac-status-v1.js?v=AIRAC-SETTINGS-HIDDEN-0001 */
try{
/* Unified AIRAC calendar/status readout. Never claims a date-only cycle
 * was installed into an executable FMC navigation database.
 */
(function(root){
 'use strict';
 const model=root.B737FMCAiracBanksV1,output=root.document.getElementById('fmcAiracCycleStatus');
 if(!model)return;
 const seats=new Map();
 const today=()=>new Date().toISOString().slice(0,10);
 function render(){
  const date=today(),schedule=model.status(model.initial(),date);
  const period=model.dateRange('2611');
  const reports=[...seats.entries()];
  const active=reports.map(([seat,x])=>seat+': '+(x.activeCycle||'NOT LOADED'));
  if(!output)return; // AIRAC status is internal; no Settings text is rendered.
  output.textContent='AIRAC calendar: '+(schedule.calendarCurrentCycle||'UNKNOWN')+
   ' · 2611 '+period+
   ' · 2611 NAVDATA: '+(reports.some(([,x])=>x.installedCycles?.includes('2611'))?'PRIVATE SOURCE INSTALLED':'SOURCE NOT PROVIDED')+
   ' · FMC: '+(active.length?active.join(' | '):'NO VERIFIED ACTIVE NAVDB')+
   ' · 2610 preserved as private reference; not silently promoted to active.';
 }
 root.addEventListener('message',event=>{
  const d=event.data;
  if(event.origin!==root.location.origin||d?.type!=='b737:unified-cdu'||
     d.kind!=='airac-banks'||!['CAPT','FO'].includes(d.seat))return;
  const frame=root.document.getElementById('cduFrame'+d.seat);
  if(!frame||event.source!==frame.contentWindow)return;
  seats.set(d.seat,{activeCycle:d.activeCycle,
   inactiveCycle:d.inactiveCycle,installedCycles:d.installedCycles||[]});
  render();
 });
 root.B737FMCAiracStatusV1=Object.freeze({version:model.VERSION,read:()=>({
  calendar:model.currentCycle(today()),seats:Object.fromEntries(seats)
 })});
 render();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cdu-airac-status-bridge-v1.js?v=CDU-AIRAC-BANKS-0001 */
try{
/* Parent: calendar display and authenticated private NAVDB bank status.
 * Current AIRAC is calendar metadata, NEVER equivalent to loaded FMC data.
 * Nothing is retrieved over the public Internet; 2610 private source stays private.
 */
(function(root){
 'use strict';
 const api=root.B737CDUAiracBanksV1;
 if(!api){root.console?.error('AIRAC cycle model not loaded');return;}
 const seats=['CAPT','FO'];let bankRecords={ACTIVE:null,INACTIVE:null};
 const utcDay=()=>new Date().toISOString().slice(0,10);
 const status=()=>api.fcomIdent(bankRecords,utcDay());
 const panel=root.document.getElementById('airacDatabaseStatus');
 function paint(){
  if(!panel)return;
  const s=status(),cy=s.currentCalendarCycle||'UNKNOWN';
  const active=s.ACTIVE?.value||'NOT INSTALLED',inactive=s.INACTIVE?.value||'NOT INSTALLED';
  panel.textContent='AIRAC '+cy+' is current by UTC calendar · FMC NAV DATA ACTIVE: '+active+
    ' · INACTIVE: '+inactive+
    (s.importRequired?' · Licensed navigation data must be privately imported; 2610 preserved.':'');
  panel.dataset.calendar=cy;
  panel.dataset.fmcInstalled=String(!s.importRequired);
 }
 function send(seat){
  const frame=root.document.getElementById('cduFrame'+seat);
  if(!frame?.contentWindow)return false;
  frame.contentWindow.postMessage({type:'b737:cdu-navdb-bank-snapshot-v1',seat,
    asOf:utcDay(),bankRecords},root.location.origin);return true;
 }
 function notify(){paint();return seats.map(seat=>({seat,delivered:send(seat)}));}
 root.addEventListener('message',e=>{
  if(e.origin!==root.location.origin||e.data?.type!=='b737:cdu-navdb-bank-request-v1'||
     !seats.includes(e.data.seat))return;
  const frame=root.document.getElementById('cduFrame'+e.data.seat);
  if(e.source!==frame?.contentWindow)return;
  send(e.data.seat);
 });
 root.document.addEventListener('load',event=>{
  for(const seat of seats)if(event.target===root.document.getElementById('cduFrame'+seat))
   {send(seat);break;}
 },true);
 // To be called ONLY by a private, source-verified NAVDB importer.
 // Explicit labels "ACTIVE"/"INACTIVE" are FMC storage banks; calendar
 // effectivity NEVER automatically swaps actual database slots.
 function attachVerifiedBanks(payload){
  const next={ACTIVE:payload?.ACTIVE??null,INACTIVE:payload?.INACTIVE??null};
  for(const name of ['ACTIVE','INACTIVE'])if(next[name])api.validateBank(next[name]);
  bankRecords=next;return notify();
 }
 root.B737CDUAiracStatusBridgeV1=Object.freeze({version:api.VERSION,status,notify,attachVerifiedBanks});
 notify();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./pressurization-oh22-diagnostic-ui.js?v=OH22-DIAG-0001 */
try{
/* Unified-facing, read-only CPCS/DCPCS diagnostic console.
 * Runs inside the existing cockpit, scans the actual OH22 iframe DOM and
 * collects controller state. No instructor faults or switch commands.
 */
(function(){
 'use strict';
 const mount=document.querySelector('.aircraft-profile-summary');
 if(!mount)return;
 const wrap=document.createElement('section');
 wrap.className='oh22-diagnostic-console';
 wrap.id='oh22DiagnosticConsole';
 wrap.setAttribute('aria-label','OH22 pressure panel diagnostic scanner');
 wrap.innerHTML='<h3>OH22 · CPCS / DCPCS Diagnostics</h3>'+
   '<p class="muted">Live scan of selected OH22 layer, controller state, lamp assets, physical clipping, and control overlap. Read-only — no switches are moved.</p>'+
   '<div class="oh22-diag-actions">'+
     '<button id="oh22DiagScan" type="button">Scan current panel</button>'+
     '<button id="oh22DiagOverlay" type="button" aria-pressed="false">Show socket outlines</button>'+
     '<button id="oh22DiagCopy" type="button" disabled>Copy JSON report</button>'+
   '</div><p id="oh22DiagStatus" role="status">Ready for inspection</p>'+
   '<output id="oh22DiagTotals" style="display:block;direction:ltr;text-align:left"></output>'+
   '<div id="oh22DiagResults" class="oh22-diag-results" dir="ltr"></div>'+
   '<small>Alignment against the original photo still requires visual approval; match to registry coordinates is not proof of photo accuracy.</small>';
 const target=document.getElementById('pressurePhysicsDiagnostics');
 if(target)target.before(wrap);else mount.append(wrap);
 const el=id=>wrap.querySelector('#'+id);
 const frame=()=>document.getElementById('overheadFrame');
 const status=el('oh22DiagStatus'),results=el('oh22DiagResults'),totals=el('oh22DiagTotals');
 let last=null,token=0,overlay=false;
 function send(action,more={}){
   const w=frame()?.contentWindow;
   if(!w){status.textContent='Overhead iframe is not ready.';return false;}
   w.postMessage({type:'b737:cockpit-command',action,...more},location.origin);return true;
 }
 function scan(){
   token+=1;status.textContent='Scanning live OH22 (read-only)…';
   if(!send('pressurization-diagnostics-request',{requestId:token})){
     status.textContent='Embedded OH22 is not available.';
   }
 }
 // Report is intentionally bounded to a single in-flight request and the
 // selected installation; stale CPCS results cannot be shown as DCPCS.
 function result(report){
   last=report;el('oh22DiagCopy').disabled=false;
   const s=report.summary;
   totals.textContent=report.system+' | '+s.CRITICAL+' critical · '+s.ERROR+' errors · '+s.WARNING+' warnings · '+s.INFO+' notes';
   results.replaceChildren();
   const append=(message,kind)=>{
     const node=document.createElement('p');node.className='oh22-diag-'+kind.toLowerCase();node.textContent=message;
     results.append(node);
   };
   if(!report.issues.length)append('No runtime issues detected. Photo-level calibration still required.','INFO');
   for(const issue of report.issues)append('['+issue.severity+'] '+issue.code+' — '+issue.message,issue.severity);
   status.textContent='Completed '+new Date(report.observed?.scanTime||Date.now()).toLocaleTimeString()+
     ' · '+report.metrics.controlsRegistered+' controls / '+report.metrics.lampsRegistered+' lamps / '+report.metrics.displaysRegistered+' readouts.';
 }
 window.addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==frame()?.contentWindow)return;
   const d=e.data;
   if(d?.type!=='b737:cockpit-overhead'||!['pressurization-diagnostics-result','pressurization-diagnostics-error'].includes(d.kind))return;
   if(d.requestId!==token)return;
   const selected=window.B737PressurizationIntegration?.getSelected?.();
   if(d.kind==='pressurization-diagnostics-error'){status.textContent='OH22 scan error: '+d.error;return;}
   if(d.report?.system!==selected){status.textContent='Panel selection changed; rerun scan.';return;}
   result(d.report);
 });
 el('oh22DiagScan').onclick=scan;
 el('oh22DiagOverlay').onclick=()=>{
   overlay=!overlay;
   el('oh22DiagOverlay').setAttribute('aria-pressed',String(overlay));
   el('oh22DiagOverlay').textContent=overlay?'Hide socket outlines':'Show socket outlines';
   send('pressurization-diagnostics-overlay',{enabled:overlay});
 };
 el('oh22DiagCopy').onclick=async()=>{
   if(!last)return;
   const serialized=JSON.stringify(last,null,2);
   try{
     await navigator.clipboard.writeText(serialized);
     status.textContent='OH22 diagnostic JSON copied.';
   }catch(error){
     status.textContent='Clipboard unavailable; select the text shown below to copy.';
     const pre=document.createElement('pre');pre.textContent=serialized;pre.style.whiteSpace='pre-wrap';pre.style.overflowWrap='anywhere';
     results.prepend(pre);
   }
 };
 window.addEventListener('b737:aircraft-profile-change',()=>{
   last=null;el('oh22DiagCopy').disabled=true;
   totals.textContent='';results.replaceChildren();status.textContent='Selected profile changed — scan the new OH22 installation.';
   if(overlay)send('pressurization-diagnostics-overlay',{enabled:true});
 });
 const overhead=frame();
 // A mount-time read-only scan is useful for a screenshot-driven audit.
 // The Scan button remains available after zoom/profile changes.
 if(overhead)overhead.addEventListener('load',()=>window.setTimeout(scan,350));
 window.setTimeout(()=>{if(!last)scan();},1400);
 window.B737UnifiedOH22Diagnostics=Object.freeze({scan,getLatest:()=>last});
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./view-model.js?v=CKP-0012 */
try{
(function(root,factory){const a=factory();if(typeof module==='object'&&module.exports)module.exports=a;if(root)root.B737CockpitView=a;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function validate(a){const ids=new Set();for(const r of a.regions){if(ids.has(r.id))throw Error('Duplicate region');ids.add(r.id);if(r.x<0||r.y<0||r.w<=0||r.h<=0||r.x+r.w>a.canvas.width||r.y+r.h>a.canvas.height)throw Error('Invalid region '+r.id);for(const p of r.placements||[]){const s=a.assets[p.asset];if(!s)throw Error('Missing source '+p.id);if(p.x<0||p.y<0||p.w<=0||p.h<=0||p.x+p.w>r.nativeWidth+.1||p.y+p.h>r.nativeHeight+2)throw Error('Placement out of bounds '+p.id);const window=p.sourceWindow||{x:0,y:0,w:s.dimensions[0],h:s.dimensions[1]};if(![window.x,window.y,window.w,window.h].every(Number.isFinite)||window.x<0||window.y<0||window.w<=0||window.h<=0||window.x+window.w>s.dimensions[0]||window.y+window.h>s.dimensions[1])throw Error('Invalid source window '+p.id);if(p.presentation==='contain'&&p.sourceWindow)throw Error('Contain must show entire image '+p.id);if(p.presentation!=='contain'&&Math.abs(p.w/p.h-window.w/window.h)>.0001)throw Error('Source aspect distorted '+p.id);if(p.maskPolygon&&(!Array.isArray(p.maskPolygon)||p.maskPolygon.length<3||p.maskPolygon.some(pt=>!Array.isArray(pt)||pt.length!==2||!pt.every(Number.isFinite)||pt[0]<0||pt[1]<0||pt[0]>s.dimensions[0]||pt[1]>s.dimensions[1])))throw Error('Invalid image silhouette '+p.id);}}if(!['overhead','main','pedestal'].every(id=>ids.has(id)))throw Error('Three cockpit regions required');return true;}
 function fit(region,width,height){return clamp(Math.min((width-42)/region.w,(height-65)/region.h),.04,2);}
 function zoomAnchor(current,next,left,top,x,y,before={x:0,y:0},after={x:0,y:0}){next=clamp(next,.04,2);return {zoom:next,left:Math.max(0,(left+x-before.x)/current*next+after.x-x),top:Math.max(0,(top+y-before.y)/current*next+after.y-y)};}
 function instrumentBox(a,item){const r=a.regions.find(r=>r.id===item.regionId);if(!r||!r.nativeWidth)throw Error('Invalid instrument region '+item.id);const scale=r.w/r.nativeWidth;return {id:item.id,label:item.label,x:r.x+item.x*scale,y:r.y+item.y*scale,w:item.w*scale,h:item.h*scale};}
 function target(a,id){if(id==='cdu-both'){const boxes=(a.embeddedInstruments||[]).map(i=>instrumentBox(a,i));if(!boxes.length)return null;const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {id,label:'CAPTAIN / FIRST OFFICER CDU',x,y,w:Math.max(...boxes.map(b=>b.x+b.w))-x,h:Math.max(...boxes.map(b=>b.y+b.h))-y};}if(id==='all')return {x:0,y:0,w:a.canvas.width,h:a.canvas.height};const r=a.regions.find(r=>r.id===id);if(r)return r;const item=(a.embeddedInstruments||[]).find(i=>i.id===id);return item?instrumentBox(a,item):null;}
 function instrumentPresentation(i){const source=i.sourceWindow||{x:0,y:0,w:i.nativeWidth,h:i.nativeHeight};const scaleX=i.w/source.w,scaleY=i.h/source.h;return {scaleX,scaleY,left:-source.x*scaleX,top:-source.y*scaleY};}
 function validateInstruments(a){const ids=new Set();for(const i of a.embeddedInstruments||[]){if(ids.has(i.id)||!['CAPT','FO'].includes(i.seat))throw Error('Invalid CDU identity');ids.add(i.id);const r=a.regions.find(r=>r.id===i.regionId);if(!r||[i.x,i.y,i.w,i.h,i.nativeWidth,i.nativeHeight].some(n=>!Number.isFinite(n))||i.x<0||i.y<0||i.w<=0||i.h<=0||i.nativeWidth<=0||i.nativeHeight<=0||i.x+i.w>r.nativeWidth||i.y+i.h>r.nativeHeight)throw Error('CDU outside native panel '+i.id);if(i.sourceWindow){const s=i.sourceWindow;if(i.presentation!=='reference-frame-fit'||[s.x,s.y,s.w,s.h].some(n=>!Number.isFinite(n))||s.x<0||s.y<0||s.w<=0||s.h<=0||s.x+s.w>i.nativeWidth||s.y+s.h>i.nativeHeight)throw Error('Invalid CDU source window '+i.id);}else if(Math.abs(i.w/i.h-i.nativeWidth/i.nativeHeight)>.0001)throw Error('CDU aspect changed without reference calibration '+i.id);}return true;}
 return Object.freeze({validate,fit,zoomAnchor,clamp,instrumentBox,target,validateInstruments,instrumentPresentation});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/fmc/sg-procedure-trajectory-v1.js?v=SG-TRAJECTORY-0001-20261117 */
try{
/* FCOM-like source-token to EHSI training geometry. NOT a flight director,
 * certified FMS turn-prediction algorithm, or real-world procedure validation.
 * Known fixes, runway thresholds and command altitudes are sourced; GS, VS,
 * roll and bank used to locate the variable altitude turn are TRAINING inputs.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedSGProcedureTrajectoryV1=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const VERSION='SG-PROCEDURE-TRAJECTORY-0001',RAD=Math.PI/180;
 const FT_PER_NM=6076.1155,EARTH_KT_TO_MPS=0.514444;
 const finite=Number.isFinite;
 const wrap=v=>(v%360+360)%360;
 const diff=(a,b)=>((a-b+540)%360)-180;
 const point=p=>p&&finite(p.lon)&&finite(p.lat)&&Math.abs(p.lon)<=180&&Math.abs(p.lat)<=90;
 const radians=d=>d*RAD;
 function distanceNM(a,b){
  const x=(b.lon-a.lon)*60*Math.cos(radians((a.lat+b.lat)/2));
  const y=(b.lat-a.lat)*60;
  return Math.hypot(x,y);
 }
 function bearing(a,b){
  const x=(b.lon-a.lon)*Math.cos(radians((a.lat+b.lat)/2));
  const y=b.lat-a.lat;
  return wrap(Math.atan2(x,y)/RAD);
 }
 function local(origin,p){
  return [(p.lon-origin.lon)*60*Math.cos(radians((origin.lat+p.lat)/2)),(p.lat-origin.lat)*60];
 }
 function geo(origin,p){
  const lat=origin.lat+p[1]/60;
  return {lat,lon:origin.lon+p[0]/(60*Math.cos(radians((origin.lat+lat)/2)))};
 }
 function program(source,{kind,runway,airportRecord}={}){
  if(kind!=='SID'||source?.fmc_executable!==false||!Array.isArray(source.segments)||
     !Array.isArray(airportRecord?.runways)||typeof runway!=='string')return null;
  const runwayRecord=airportRecord.runways.find(x=>x?.runway===runway);
  const start={lat:runwayRecord?.threshold_lat,lon:runwayRecord?.threshold_lon};
  if(!point(start)||!finite(runwayRecord?.airport_elevation_ft))return null;
  const oppositeName=runway.replace(/^(\d{2})([LCR]?)$/,(_whole,num,suffix)=>{
   const reciprocal=(Number(num)+17)%36+1;
   const end={L:'R',R:'L',C:'C','':''}[suffix];
   return String(reciprocal).padStart(2,'0')+end;
  });
  const other=airportRecord.runways.find(x=>x?.runway===oppositeName);
  const opposite={lat:other?.threshold_lat,lon:other?.threshold_lon};
  // Magnetic track is not a true bearing. A surveyed reciprocal runway pair
  // gives a local inferred variation rather than silently equating the two.
  if(!point(opposite)||distanceNM(start,opposite)<0.2||
     !finite(runwayRecord.magnetic_heading_deg))return null;
  const variation=diff(bearing(start,opposite),runwayRecord.magnetic_heading_deg);
  if(Math.abs(variation)>15)return null;
  for(const segment of source.segments){
   const events=segment?.events||segment?.ast;
   if(!Array.isArray(events))continue;
   const filtered=events.filter(e=>e&&
    !['RUNWAY_REFERENCE','ALTITUDE_CONSTRAINT','SPEED_TOKEN'].includes(e.kind));
   // Unrecognized path terminators must not be silently interpolated.
   if(filtered.length!==6||filtered.map(x=>x.kind).join(',')!==
      'TRK,UNTIL,TURN,DIRECT,FIX_PASSAGE,FIX_PASSAGE')continue;
   const [trk,until,turn,direct,first,last]=filtered;
   const magneticTrack=Number(trk.values?.degrees),altitude=Number(until.values?.altitudeFt);
   const direction=turn.values?.direction;
   if(!finite(magneticTrack)||magneticTrack<0||magneticTrack>=360||
      !finite(altitude)||altitude<=runwayRecord.airport_elevation_ft||altitude>20000||
      !['LEFT','RIGHT'].includes(direction))continue;
   if(first.reference_status!=='LOCAL_FIX_COORDINATE_VERIFIED'||
      last.reference_status!=='LOCAL_FIX_COORDINATE_VERIFIED'||
      !point(first.fix)||!point(last.fix)||
      first.values?.ident!==first.fix.ident||last.values?.ident!==last.fix.ident||
      !first.fix.ident||!last.fix.ident)continue;
   return {version:VERSION,kind:'TRACK_UNTIL_ALTITUDE_TURN_DIRECT',
    runway,source:'LOCAL_AIRPORT_PROCEDURE_TEXT',sourceLine:segment.source_line||null,
    airport:source.airport||airportRecord.icao,
    sourceOnly:true,fmcExecutable:false,
    trackMagneticDeg:magneticTrack,altitudeMSLFt:altitude,
    runwayElevationFt:runwayRecord.airport_elevation_ft,
    runwayLengthFt:finite(runwayRecord.length_ft)?runwayRecord.length_ft:null,
    variationDeg:variation,turnDirection:direction,
    start,opposite,fixes:[{ident:first.fix.ident,lat:first.fix.lat,lon:first.fix.lon},
     {ident:last.fix.ident,lat:last.fix.lat,lon:last.fix.lon}]};
  }
  return null;
 }
 function trajectory(p,flight=null){
  if(p?.version!==VERSION||p.kind!=='TRACK_UNTIL_ALTITUDE_TURN_DIRECT'||
    !point(p.start)||!Array.isArray(p.fixes)||p.fixes.length!==2||
    !p.fixes.every(point)||!['LEFT','RIGHT'].includes(p.turnDirection))return null;
  const airborne=flight?.airborne===true;
  const gs=airborne&&finite(flight?.gsKt)&&flight.gsKt>=80&&flight.gsKt<=350?
   flight.gsKt:160;
  const vs=airborne&&finite(flight?.vsFpm)&&flight.vsFpm>=500&&flight.vsFpm<=6000?
   flight.vsFpm:1600;
  // No actual liftoff or 4360-ft crossing point is supplied by OIII.txt.
  // Roll distance is an explicit training assumption, NOT an AFM datum.
  const rollNm=finite(p.runwayLengthFt)?Math.max(.65,Math.min(1.6,p.runwayLengthFt/FT_PER_NM*.6)):1.2;
  const climbNm=Math.max(.05,(p.altitudeMSLFt-p.runwayElevationFt)*gs/(vs*60));
  if(!finite(climbNm)||climbNm>40)return null;
  const theta=radians(wrap(p.trackMagneticDeg+p.variationDeg));
  const r=(gs*EARTH_KT_TO_MPS)**2/(9.80665*Math.tan(radians(25)))/1852;
  if(!finite(r)||r<.1||r>10)return null;
  const from=p.start,target=local(from,p.fixes[0]),sign=p.turnDirection==='LEFT'?1:-1;
  const to=geo(from,[(rollNm+climbNm)*Math.sin(theta),(rollNm+climbNm)*Math.cos(theta)]);
  const initial=[(rollNm+climbNm)*Math.sin(theta),(rollNm+climbNm)*Math.cos(theta)];
  const startVector=[Math.sin(theta),Math.cos(theta)];
  const center=[initial[0]-sign*startVector[1]*r,initial[1]+sign*startVector[0]*r];
  const radial=[initial[0]-center[0],initial[1]-center[1]];
  const phi=Math.atan2(radial[1],radial[0]);
  const delta=[target[0]-center[0],target[1]-center[1]],distance=Math.hypot(...delta);
  if(distance<=r+.01)return null;
  const base=Math.atan2(delta[1],delta[0]),tangentArc=Math.acos(r/distance);
  const options=[base+tangentArc,base-tangentArc].map(angle=>{
   const end=[center[0]+r*Math.cos(angle),center[1]+r*Math.sin(angle)];
   const v=[target[0]-end[0],target[1]-end[1]];
   const dir=[-Math.sin(angle)*sign,Math.cos(angle)*sign];
   const forward=v[0]*dir[0]+v[1]*dir[1];
   const sweep=sign>0?(angle-phi+4*Math.PI)%(2*Math.PI):
    (phi-angle+4*Math.PI)%(2*Math.PI);
   return {angle,end,forward,sweep};
  }).filter(x=>x.forward>0.1&&x.sweep>0.01&&x.sweep<2*Math.PI-.01)
   .sort((a,b)=>a.sweep-b.sweep);
  if(!options.length)return null;
  const arc=options[0],slices=Math.min(180,Math.max(12,Math.ceil(arc.sweep/radians(3))));
  const routeArc=[];
  for(let i=0;i<=slices;i++){
   const angle=phi+sign*arc.sweep*i/slices;
   routeArc.push(geo(from,[center[0]+r*Math.cos(angle),center[1]+r*Math.sin(angle)]));
  }
  const startLatLon=geo(from,[0,0]),turnEnd=routeArc.at(-1),lead=p.fixes[0];
  return {version:VERSION,sourceOnly:true,fmcExecutable:false,
   profile:airborne&&gs===flight.gsKt&&vs===flight.vsFpm?'LIVE_TRAINING_SNAPSHOT':'NOMINAL_TRAINING_PREVIEW',
   assumptions:{groundRollNm:rollNm,groundSpeedKt:gs,verticalSpeedFpm:vs,
    bankDeg:25,turnRadiusNm:r,altitudeMSLFt:p.altitudeMSLFt},
   altitudeTurnPoint:to,turnEntryTrackTrueDeg:wrap(p.trackMagneticDeg+p.variationDeg),
   segments:[
    {type:'TRACK_TO_ALTITUDE',points:[startLatLon,to]},
    {type:'TURN_'+p.turnDirection,points:routeArc},
    {type:'DIRECT_FIX',points:[turnEnd,lead]},
    {type:'NEXT_FIX',points:[lead,p.fixes[1]]}
   ]};
 }
 return Object.freeze({VERSION,program,trajectory,distanceNM,bearing});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
