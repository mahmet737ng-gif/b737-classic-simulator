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
    }
  });
  // Future simulator sensor adapters can inject sourced inputs to the selected
  // pressure engine; no made-up shared physical pressure model is introduced.
  // Standalone Unified trainer environment: explicit instructor inputs until
  // the upstream flight and PACK systems publish validated live adapters.
  // Do NOT silently interpret missing PACK data as a real electrical bus state.
  const pressureEnvironment={aircraftAltitudeFt:groundSelection.fieldElevationFt??0,
    onGround:true,packsAvailable:false,bleedAirAvailable:false};
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
        pressureEnvironment.onGround=Boolean(value);groundBox.checked=Boolean(value);
      }
      if(system===selectedPressure()&&key==='bleedAirAvailable'){
        pressureEnvironment.bleedAirAvailable=Boolean(value);packsBox.checked=Boolean(value);
      }
      return applyPressureCommand(system,{type:'INPUT',key,value});
    },
    sync:()=>publishPressureState()
  });

  // Render the owner background for the selected pressurization type only.
  // The image is a preview; no original panel source or cockpit geometry is modified.
  const pressureField = form.querySelector('input[name="pressurization"]')?.closest('fieldset');
  const ownerPreview = document.createElement('figure');
  ownerPreview.className = 'aircraft-pressure-owner-preview';
  ownerPreview.id = 'aircraftPressureOwnerPreview';
  const ownerImage = document.createElement('img');
  ownerImage.id = 'aircraftPressureOwnerImage';
  ownerImage.alt = 'Owner-approved DCPCS background';
  ownerImage.loading = 'lazy';
  const ownerCaption = document.createElement('figcaption');
  ownerCaption.textContent = 'DCPCS · تصویر تأییدشدهٔ مرجع (بدون تغییر)';
  ownerPreview.append(ownerImage, ownerCaption);
  pressureField?.append(ownerPreview);
  function showPressureArtwork(pressureId) {
    const selected = api.CATALOG.pressurization.find(item => item.id === pressureId);
    const source = selected?.backgroundAsset;
    ownerPreview.hidden = !source;
    if (source) {
      const uri = new URL('../../' + source, document.baseURI).href;
      if (ownerImage.src !== uri) ownerImage.src = uri;
    } else {
      ownerImage.removeAttribute('src');
    }
  }
  form.querySelectorAll('input[name="pressurization"]').forEach(input => {
    input.addEventListener('change', () => {
      if (input.checked) showPressureArtwork(input.value);
    });
  });

  function render(detail) {
    const selected = detail.resolved;
    const family = selected.family.label;
    const pressure = selected.pressurization.id;
    const instruments = selected.engineInstruments.id === 'EIS' ? 'EIS' : 'CONVENTIONAL';
    byId('aircraftProfileHeader').textContent = family + ' · ' + pressure + ' · ' + instruments;
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
    byId('openSelectedPressurizationPanel').textContent = 'باز کردن پنل ' + pressure + ' برای تست';
    try {
      activeSession = getPressureSession(pressure);
      window.B737ActivePressurization = activeSession;
      publishPressureState(pressure);
      byId('activeProfileStatus').textContent = 'سیستم ' + pressure + ' V' + activeSession.engineVersion + ' فعال است؛ کنترل‌ها، نمایشگرها و چراغ‌های OH22 از موتور اختصاصی همین سیستم فرمان می‌گیرند. مدل آموزشی فشار کابین و حرکت Outflow Valve به‌صورت حلقه‌بسته فعال است؛ ضرایب، منبع قطعی تغذیه و نرخ واقعی موتور هنوز کالیبره نشده‌اند.';
    } catch (error) {
      window.B737ActivePressurization = null;
      byId('activeProfileStatus').textContent = 'موتور انتخاب‌شده در دسترس نیست: ' + error.message;
    }
    if (pressureDialog.open) {
      byId('selectedPressureTitle').textContent = 'پنل ' + pressure + ' · سیستم فشار کابین';
      pressureFrame.src = '../../' + selected.pressurization.lab;
    }
  }

  store.subscribe(render);
  render({resolved: store.resolve()});
  updatePressureDiagnostics();

  function showSettings() {
    const profile = store.get();
    for (const field of api.FIELDS) {
      const control = form.querySelector('input[name="' + field + '"][value="' + profile[field] + '"]');
      if (control) control.checked = true;
    }
    showPressureArtwork(profile.pressurization);
    byId('aircraftSettingsError').hidden = true;
    settings.showModal();
  }
  byId('aircraftSettingsOpen').addEventListener('click', showSettings);
  byId('aircraftSettingsClose').addEventListener('click', () => settings.close());
  byId('aircraftSettingsCancel').addEventListener('click', () => settings.close());
  form.addEventListener('submit', event => {
    event.preventDefault();
    const values = new FormData(form);
    const changes = Object.fromEntries(api.FIELDS.map(field => [field, values.get(field)]));
    try {
      store.set(changes);
      settings.close();
    } catch (error) {
      const notice = byId('aircraftSettingsError');
      notice.hidden = false;
      notice.textContent = 'تنظیمات ذخیره نشد: ' + error.message;
    }
  });

  byId('openSelectedPressurizationPanel').addEventListener('click', () => {
    const selected = store.resolve().pressurization;
    byId('selectedPressureTitle').textContent = 'پنل ' + selected.id + ' · سیستم فشار کابین';
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
