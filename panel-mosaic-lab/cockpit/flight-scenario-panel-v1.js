/* Unified Flight Scenario Lab v1. Optional instructor feed; no panel DOM overrides. */
(function(win){
 'use strict';
 const Core=win.B737FlightScenarioCoreV1;
 if(!Core){console.error('B737FlightScenarioCoreV1 dependency missing');return;}
 const doc=win.document,by=id=>doc.getElementById(id);
 let mounted=false, setupTab='LOCATION';
 const selectedPreset=()=>setupTab==='GENERAL'?'COLD_DARK':by('flightPreset').value;
 let state=null,active=false,pause=false,lastTick=0,lastPublish=0,lastUI=0,choiceArmed=false;
 let producers={},producerErrors={},timer=null,mcpFollow=true,previouslyCoupled=false;
 let lastPropulsionAt=0,lastPropulsion=null,lastEngineContextAt=0;
 let tickErrorCount=0,lastTickError=null,crewFollower=false;
 const crewEvent=(type,value)=>win.dispatchEvent(new CustomEvent('b737:crew-flight-command',{detail:{type,value}}));
 const VERSION='UNIFIED-FLIGHT-SCENARIOS-0009-FINAL10-STARTPAUSE';
 const html=`
  <div class="flight-head"><strong id="flightScenarioTitle">FLIGHT SCENARIO ENGINE</strong><button id="flightScenarioClose" type="button" aria-label="Close flight scenarios">×</button></div>
  <p class="flight-sub">B737 Classic · Instructor training model · MSL altitude / MAGNETIC heading using live WMM2025 variation; TRUE retained inside flight physics. Training only.</p>
  <div class="flight-grid">
   <label>Airport<select id="flightAirport"><option value="OIMM">MASHHAD · OIMM</option><option value="OIII">TEHRAN MEHRABAD · OIII</option><option value="OISS">SHIRAZ · OISS</option><option value="OIFM">ESFAHAN · OIFM</option></select></label>
   <label>Runway<select id="flightRunway"></select></label>
   <label>Start location<select id="flightPreset"><option value="RUNWAY_READY">ON RUNWAY</option><option value="FINAL_5">5 NM FINAL</option><option value="FINAL_10">10 NM FINAL</option><option value="MANUAL">MANUAL INITIAL STATE</option></select></label>
  </div>
  <div class="flight-heading">INITIAL STATE / MANUAL TARGET</div>
  <div class="flight-grid flight-numbers">
   <label>Altitude MSL (ft)<input id="flightAlt" type="number" min="0" max="65000" step="100" value="6263"></label>
   <label>Heading MAG (°)<input id="flightHeading" type="number" min="0" max="359" step="1" value="309"></label>
   <label>Indicated speed (kt)<input id="flightSpeed" type="number" min="0" max="450" step="1" value="220"></label>
   <label>Latitude (°)<input id="flightLat" type="number" min="-90" max="90" step="0.000001" value="36.2348333"></label>
   <label>Longitude (°)<input id="flightLon" type="number" min="-180" max="180" step="0.000001" value="59.643"></label>
  </div>
  <div class="flight-actions">
   <button type="button" id="flightLoad" class="flight-primary">LOAD SCENARIO</button>
   <button type="button" id="flightTargets">APPLY FLIGHT TARGETS</button>
   <button type="button" id="flightTakeoff">PRESS TOGA</button>
   <button type="button" id="flightPause">PAUSE</button>
   <button type="button" id="flightStop">STOP FEED</button>
  </div>
  <div class="flight-actions">
   <label>MANUAL PITCH (°)<input id="flightManualPitch" type="number" min="-10" max="15" step=".5" value="0"></label>
   <button type="button" id="flightManualPitchApply">APPLY MANUAL PITCH</button>
  </div>
  <p id="flightScenarioStatus" class="flight-status" role="status">Select airport, runway and scenario; then press LOAD SCENARIO. Current Unified avionics remain unchanged until activated.</p>
 `;
 const v=id=>Number(by('flight'+id).value);
 const wmm=win.B737WMM2025V1;
 const airportPoint=a=>({lat:a.lat,lon:a.lon,altitudeFt:a.elevationFt});
 function magneticVariation(point){
  const result=wmm?.evaluate?.({lat:point?.lat,lon:point?.lon,
   altitudeFt:point?.altitudeFt??0});
  return result?.valid===true?result.declinationDeg:null;
 }
 function magneticHeading(trueHeading,point){
  const variation=magneticVariation(point);
  return Number.isFinite(variation)?wmm.trueToMag(trueHeading,variation):null;
 }
 function trueHeading(magHeading,point){
  const variation=magneticVariation(point);
  if(!Number.isFinite(variation))throw Error('WMM2025 magnetic variation unavailable at current position/date');
  return wmm.magToTrue(magHeading,variation);
 }
 const magLabel=(trueDeg,point)=>{
  const mag=magneticHeading(trueDeg,point);
  return Number.isFinite(mag)?String(Math.round(mag)%360).padStart(3,'0')+'° MAG':'MAG N/A';
 };
 function publishSelectedReference(){
  if(!choiceArmed)return;
  const a=Core.AIRPORTS[by('flightAirport').value];
  if(!a)return;
  const manual=selectedPreset()==='MANUAL';
  const lat=manual?Number(by('flightLat').value):a.lat;
  const lon=manual?Number(by('flightLon').value):a.lon;
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
  try{win.B737UnifiedFlightLocationV1?.choose({lat,lon,icao:a.icao,source:'FLIGHT_PHASE_SELECTION'});}
  catch(error){status('INVALID POSITION: '+String(error.message||error),true);}
 }
 function airportChanged(){
  const a=Core.AIRPORTS[by('flightAirport').value];
  const rw=by('flightRunway'),previous=rw.value;
  rw.replaceChildren();
  for(const [id,hdg] of Object.entries(a.runways)){
   const opt=new Option('RWY '+id+' · '+magLabel(hdg,airportPoint(a)),id);rw.add(opt);
  }
  rw.value=Object.hasOwn(a.runways,previous)?previous:a.defaultRunway;
  const manual=selectedPreset()==='MANUAL';
  if(!manual){
   by('flightLat').value=String(a.lat);by('flightLon').value=String(a.lon);
   const mag=magneticHeading(a.runways[rw.value],airportPoint(a));
    by('flightHeading').value=Number.isFinite(mag)?Math.round(mag)%360:'';
   by('flightAlt').value=a.elevationFt+(['RUNWAY_READY','COLD_DARK'].includes(selectedPreset())?0:3000);
  }
  publishSelectedReference();
 }
 function presetChanged(){
  const kind=selectedPreset();
  const a=Core.AIRPORTS[by('flightAirport').value];
  if(kind!=='MANUAL'){
   const mag=magneticHeading(a.runways[by('flightRunway').value],airportPoint(a));
    by('flightHeading').value=Number.isFinite(mag)?Math.round(mag)%360:'';
   const preview=Core.newScenario({airport:a.icao,runway:by('flightRunway').value,preset:kind},
    approachThresholds({airport:a.icao,runway:by('flightRunway').value,preset:kind}));
   by('flightAlt').value=Math.round(preview.altitudeFt);
   by('flightSpeed').value=Math.round(preview.iasKt);
   by('flightLat').value=String(a.lat);by('flightLon').value=String(a.lon);
  }
  publishSelectedReference();
 }
 function status(message,isError=false){
  const p=by('flightScenarioStatus');
  if(p){p.textContent=message;p.dataset.error=isError?'true':'false';}
 }
 function snapshot(){return state?JSON.parse(JSON.stringify(state)):null;}
 function producer(owner){
  if(producers[owner])return producers[owner];
  if(producerErrors[owner])return null;
  try{
   const network=win.B737UnifiedAvionicsNetworkV1;
   if(!network?.connectExternal)return null;
   producers[owner]=network.connectExternal(owner);
   return producers[owner];
  }catch(error){producerErrors[owner]=String(error?.message||error);return null;}
 }
 function sendAvionics(){
  if(!state)return;
  const adc=producer('ADC');
  const sample={pressureAltitudeFt:state.altitudeFt,casKt:state.iasKt,iasKt:state.iasKt,
   tasKt:state.tasKt,mach:Math.min(.95,state.tasKt/660),
   source:'FLIGHT_SCENARIO_V1_TRAINING'};
  for(const topic of ['airdata.adc1','airdata.adc2'])
   try{adc?.publish(topic,sample);}catch(e){producerErrors.ADC=String(e);}
  const ra=producer('RADIO_ALTIMETER');
  const ralt={heightFt:Math.min(5000,state.radioAltitudeFt),source:'AIRPORT_ELEVATION_SURROGATE_TRAINING'};
  for(const topic of ['airdata.radioAltitude1','airdata.radioAltitude2'])
   try{ra?.publish(topic,ralt);}catch(e){producerErrors.RADIO_ALTIMETER=String(e);}
  const gps=producer('GPS');
  const pos={lat:state.lat,lon:state.lon,gsKt:state.gsKt,trackDeg:state.trueTrackDeg,
   source:'FLIGHT_SCENARIO_V1_TRAINING'};
  for(const topic of ['navigation.gps1','navigation.gps2'])
   try{gps?.publish(topic,pos);}catch(e){producerErrors.GPS=String(e);}
 }
 function publish(){
  if(!state||!active)return;
  const sample={valid:true,sourceTimestampMs:Date.now(),gsKt:state.gsKt,
   trueTrackDeg:state.trueTrackDeg,trueHeadingDeg:state.trueHeadingDeg,
   pitchDeg:state.pitchDeg,rollDeg:state.bankDeg,altitudeFt:state.altitudeFt,
   windFromDeg:state.windFromDeg,windKt:state.windKt,
   lat:state.lat,lon:state.lon,source:'UNIFIED_SCENARIO_ENGINE'};
  win.dispatchEvent(new CustomEvent('b737:simulator-telemetry',{detail:sample}));
  win.dispatchEvent(new CustomEvent('b737:flight-scenario-state',{detail:snapshot()}));
  win.B737UnifiedFlightLocationV1?.choose({lat:state.lat,lon:state.lon,icao:state.icao,source:'FLIGHT_SCENARIO_LIVE_POSITION'});
  sendAvionics();
 }
 function togglePause(){
  if(!active||!state)return false;
   // Shared FINAL_10 starts only when both cockpit owner checks pass.
   if(pause&&state.preset==='FINAL_10'&&win.B737CrewScenarioReadyV1?.canStart?.()===false){
    status('PRIVATE ROOM NOT READY · Captain and FO must verify FINAL_10 systems.',true);
    return false;
   }
  pause=!pause;lastTick=performance.now();
  publish();updateUI();
  status((pause?'PAUSED':'RUNNING')+' · '+state.icao+' RWY '+state.runway+
   ' · '+state.phase+' · '+Math.round(state.iasKt)+' KT');
  crewEvent('pauseFlight',pause);
  win.dispatchEvent(new CustomEvent('b737:flight-scenario-paused',{
   detail:{paused:pause,icao:state.icao,runway:state.runway,preset:state.preset}}));
  return true;
 }
 function updateUI(){
  const stopButton=by('flightStop'),pauseButton=by('flightPause'),takeoffButton=by('flightTakeoff');
  if(stopButton)stopButton.disabled=!state||state.airborne===true;
  if(pauseButton){pauseButton.disabled=!state||(pause&&state?.preset==='FINAL_10'&&win.B737CrewScenarioReadyV1?.canStart?.()===false);pauseButton.textContent=state&&pause?'START':'PAUSE';}
  const sceneToggle=by('flightScenarioSceneToggle');
  if(sceneToggle){
   sceneToggle.disabled=!state||!active||(pause&&state?.preset==='FINAL_10'&&win.B737CrewScenarioReadyV1?.canStart?.()===false);
   sceneToggle.textContent=state&&pause?'START':'PAUSE';
   sceneToggle.setAttribute('aria-pressed',String(!!state&&!pause));
   sceneToggle.dataset.flightStatus=!state?'NOT_LOADED':pause?'PAUSED':'RUNNING';
   sceneToggle.title=!state?'Load a FLT PHASE scenario first':
    pause?'Start flight simulation':'Pause flight simulation';
  }
  if(takeoffButton)takeoffButton.disabled=!state||!(state.phase==='GROUND_READY'||(state.airborne===true&&state.radioAltitudeFt<2000));
 }
 function stop(){
  // Never withdraw the only IRS/ADC/RA telemetry source while the aircraft
  // is airborne. Core STOP already prohibits this; the panel/API must match.
  if(active&&state?.airborne===true){
   status('STOP FEED BLOCKED WHILE AIRBORNE · land first; use PAUSE if required.',true);
   return false;
  }
  try{win.B737ISNCockpitV1?.setFlightScenarioContext?.({active:false,source:'FLIGHT_SCENARIO_ENGINE'});}
  catch(error){console.warn('ISN flight context restore',error);}
  active=false;pause=false;state=null;lastTick=0;previouslyCoupled=false;
  lastPropulsionAt=0;lastPropulsion=null;lastEngineContextAt=0;
  win.B737IRSTrainerUnified?.stopMotion?.();
  for(const owner of Object.keys(producers)){
   for(const topic of producers[owner].topics)
    try{producers[owner].publish(topic,null,{quality:'UNKNOWN',reason:'SCENARIO_STOPPED'});}catch(_){}
  }
  by('flightPause').textContent='PAUSE';
  status('Scenario feed stopped. IFR/IRS consumers will use their existing sources or show source unavailable.');
  updateUI();
  crewEvent('stopFlight',true);
  win.dispatchEvent(new CustomEvent('b737:flight-scenario-stopped',{detail:{version:VERSION}}));
  return true;
 }
 // Prefer the selected runway's local ILS reference over the ARP for
 // training finals. The current coordinates are PROVISIONAL, not surveyed
 // localizer, GP or DME antennas; never label them verified navigation data.
 const OIFM_AIP_THRESHOLDS=Object.freeze({
  '07L':Object.freeze({lat:32.74873611,lon:51.83781944,elevationFt:5057,courseTrueDeg:77.93,glideDeg:3,tchFt:50}),
  '25R':Object.freeze({lat:32.75701944,lon:51.883725,elevationFt:5043,courseTrueDeg:257.96,glideDeg:2.63,tchFt:55}),
  '07R':Object.freeze({lat:32.74468056,lon:51.83884444,elevationFt:5058,courseTrueDeg:77.93,glideDeg:3,tchFt:50}),
  '25L':Object.freeze({lat:32.75296389,lon:51.88474444,elevationFt:5037,courseTrueDeg:257.96,glideDeg:3,tchFt:50})
 });
 function approachThresholds(config){
  if(config.airport==='OIFM'&&OIFM_AIP_THRESHOLDS[config.runway])
   return {OIFM:{[config.runway]:{...OIFM_AIP_THRESHOLDS[config.runway],
    quality:'AIP_SURVEYED_RWY_THR',source:'IRAN_AIP_OIFM_AD2_12'}}};
  if(!['FINAL_5','FINAL_10','RUNWAY_READY','COLD_DARK'].includes(config.preset))return {};
  const station=win.B737IranRadioNavaidsV1?.STATIONS?.find(s=>
   s.type==='ILS_DME'&&s.airport===config.airport&&s.runway===config.runway);
  if(!station)return {};
  return {[config.airport]:{[config.runway]:{
   lat:station.lat,lon:station.lon,elevationFt:station.elevationFt,
   glideDeg:station.glideDeg,tchFt:station.tchFt??50,
   courseTrueDeg:station.courseTrueDeg,quality:'TRAINING_ILS_PROXY',
   source:'TRAINING_ILS_'+station.ident+'_NOT_SURVEYED'}}};
 }
 // Load the same ECU flight context before START, so a paused final
 // already has a consistent airborne IAS and altitude. No separate engine.
 function syncInitialEngineContext(){
  if(!active||!state)return false;
  try{
   return win.B737ISNCockpitV1?.setFlightScenarioContext?.({
    active:true,onGround:!state.airborne,iasKt:state.iasKt,
    altitudeFt:state.altitudeFt,source:'FLIGHT_SCENARIO_ENGINE'})?.active===true;
  }catch(error){console.warn('FLT PHASE initial ECU context',error);return false;}
 }
 function load(beforeStart){
  try{
   const preset=selectedPreset();
   const config={airport:by('flightAirport').value,runway:by('flightRunway').value,preset,
    airborne:!['RUNWAY_READY','COLD_DARK'].includes(preset)};
   if(preset==='MANUAL'){
    config.altitudeFt=v('Alt');config.headingDeg=trueHeading(v('Heading'),airportPoint(Core.AIRPORTS[config.airport]));
    config.speedKt=v('Speed');
   }
   if(preset==='MANUAL'){
    config.lat=v('Lat');config.lon=v('Lon');
   }
   const next=Core.newScenario(config,approachThresholds(config));
   if(typeof beforeStart==='function')beforeStart();
   win.B737ColdDarkGeneralPresetV1?.stop();
   state=next;
   win.B737UnifiedFlightLocationV1?.choose({lat:state.lat,lon:state.lon,icao:state.icao,source:'FLIGHT_SCENARIO_INITIAL_POSITION'});
   active=true;pause=preset==='FINAL_10';previouslyCoupled=false;lastTick=performance.now();lastPublish=0;
   syncInitialEngineContext();
   if(preset!=='MANUAL'){
    by('flightAlt').value=Math.round(state.altitudeFt);
    const mag=magneticHeading(state.trueHeadingDeg,state);
     by('flightHeading').value=Number.isFinite(mag)?Math.round(mag)%360:'';
    by('flightSpeed').value=Math.round(state.iasKt);
   }
   publish();lastPublish=performance.now();updateUI();
   if(preset==='FINAL_10')win.B737Final10ApproachPresetV1?.apply?.(state);
   if(preset==='COLD_DARK')win.B737ColdDarkGeneralPresetV1?.apply();
   crewEvent('loadFlight',config);
   status((pause?'PAUSED / CONFIGURING':'ACTIVE')+' · '+state.icao+' RWY '+
    state.runway+' · '+state.phase+' · '+state.georefQuality);
   return true;
  }catch(error){status('SCENARIO NOT LOADED: '+String(error.message||error),true);return false;}
 }
 function targets(){
  if(!active||!state){status('Load a scenario first.',true);return;}
  try{
   state=Core.command(state,{type:'SPEED',value:v('Speed')});
   state=Core.command(state,{type:'HEADING',value:trueHeading(v('Heading'),state)});
   // Altitude capture is available; VS and bank follow the flight model/MCP.
   if(Math.abs(v('Alt')-state.altitudeFt)>50)
    state=Core.command(state,{type:'ALTITUDE',value:v('Alt')});
   crewEvent('flightTargets',{speedKt:state.target.speedKt,
    headingDeg:trueHeading(v('Heading'),state),altitudeFt:v('Alt')});
   status('Targets accepted — aircraft changes heading/bank, IAS and altitude over simulated time.');
  }catch(error){status('INVALID TARGET: '+String(error.message||error),true);}
 }
 function followMcp(){
  if(!active||!state?.airborne)return;
  const fcc=win.B737UnifiedFccFlightV1;
  const mcp=win.B737McpAFDSBridgeV1;
  const output=mcp?.getOutput?.();
  const toga=win.B737UnifiedTOGACh4V1?.getState?.();
  if(!mcpFollow||output?.power!==true||!output.modes?.autopilot){
   if(previouslyCoupled){
    state=Core.command(state,{type:'MANUAL_HOLD'});
    previouslyCoupled=false;
   }
   // Classroom instructor-auto mode follows the SAME TOGA pitch as the FD.
   // No fake CMD/autopilot annunciation. Manual pitch input disables it.
   if(mcpFollow&&output?.power===true&&state.takeoffAutoMode===true&&
      toga?.phase==='TO'&&Number.isFinite(toga.fdPitchDeg)){
    const demand=Math.max(-10,Math.min(15,toga.fdPitchDeg));
    if(state.target.verticalMode!=='PITCH'||
       Math.abs((state.target.pitchDeg??0)-demand)>.05)
     state=Core.command(state,{type:'PITCH',value:demand,source:'TRAINER_AUTO_TO'});
    if(Number.isFinite(toga.targetSpeedKt)&&
       Math.abs(state.target.speedKt-toga.targetSpeedKt)>.05)
     state=Core.command(state,{type:'SPEED',value:toga.targetSpeedKt});
   }
   return;
  }
  if(!fcc?.follow)return;
  previouslyCoupled=true;
  const commands=fcc.follow(state);
  if(!commands?.actions?.length)return;
  const matches=action=>{
   const t=state.target;
   switch(action.type){
    case 'HEADING':return t.lateralMode==='HEADING'&&Math.abs(Core.angle(t.headingDeg,action.value))<.01;
    case 'BANK_LIMIT':return t.bankLimitDeg===action.value;
    case 'PITCH':return t.verticalMode==='PITCH'&&Math.abs(t.pitchDeg-action.value)<.01;
    case 'VS':return t.verticalMode==='VS'&&t.vsFpm===action.value;
    case 'ALT_ACQ':return t.verticalMode==='ALT_ACQ'&&
     state.altitudeCapture?.phase==='ACQUIRE'&&
     Math.abs(t.altitudeFt-action.value)<.01;
    case 'ALTITUDE':return t.verticalMode==='ALTITUDE'&&Math.abs(t.altitudeFt-action.value)<.01;
    case 'SPEED':return Math.abs(t.speedKt-action.value)<.01;
    default:return false;
   }
  };
  for(const command of commands.actions){
   if(matches(command))continue;
   try{state=Core.command(state,{...command,source:'FCC_CMD'});}
   catch(error){console.warn('FCC flight command rejected',command,error);}
  }
  if(commands.altAcquireConfirmed&&
     output.capture?.pitch!=='ALT_ACQ'&&output.capture?.pitch!=='ALT_HOLD')
   mcp.observeAltitudeCapture?.({stage:'ACQUIRE',confirmed:true,source:'SIMULATED_FCC'});
  if(commands.altitudeHoldConfirmed&&output.capture?.pitch!=='ALT_HOLD')
   mcp.observeAltitudeCapture?.({stage:'HOLD',confirmed:true,source:'SIMULATED_FCC'});
 }
 function propulsionObservation(now){
  if(now-lastPropulsionAt<180)return lastPropulsion;
  lastPropulsionAt=now;
  const owner=win.B737ISNCockpitV1;
  const fast=owner?.getPropulsionSnapshot?.();
  const chain=!fast?owner?.getStartState?.():null;
  if(!fast&&!chain?.phase){lastPropulsion=null;return null;}
  const ecu=!fast?owner.getECUState?.():null;
  const engines=[1,2].map(n=>{
   const id='engine'+n;
   return {running:fast?.engines?.[id]?.running??(chain?.phase?.[id]==='RUNNING'),
    n1Percent:fast?.engines?.[id]?.n1Percent??ecu?.engines?.[id]?.n1Percent??null};
  });
  lastPropulsion=engines.every(e=>Number.isFinite(e.n1Percent))?
   {valid:true,engines,fuelImbalanceKg:owner.getFuelImbalanceKg?.()}:null;
  return lastPropulsion;
 }
 // Consume the actual TE actuator projection; the cockpit lever is not
 // proof that surfaces have moved. Keep instructor mass separate from ADC.
 function syncAeroConfiguration(){
  if(!state||!active)return false;
  // Authoritative owner TE angle prevails over a stale iframe relay revision.
  const le=win.B737Final10ApproachPresetV1?.getLiveFlapOwnerState?.()??
   win.B737LEDevicesUnifiedLink?.getState?.();
  const projection=le?.projection;
  if(!projection||!Number.isFinite(projection.tePosition))return false;
  const flapLever=le.lever,flapActual=projection.tePosition;
  // OWNER FINAL LE bridge exposes the approved stage and disagreement list,
  // not its locked per-slat position objects. Credit FULL only on agreement.
  const slatsFull=projection.leStage==='FULL'&&
   projection.center?.extended===true&&
   Array.isArray(projection.mismatch)&&projection.mismatch.length===0;
  if(![0,1,2,5,10,15,25,30,40].includes(flapLever)||
    flapActual<0||flapActual>40)return false;
  const ctx=win.B737UnifiedAvionicsNetworkV1?.getSignal?.('flightcontext.state');
  const observed=ctx?.quality==='VALID'?ctx.value?.massKg:null;
  const massKg=Number.isFinite(observed)&&observed>=30000&&observed<=75000?observed:null;
  if(state.flapLever===flapLever&&Math.abs(state.flapActual-flapActual)<1e-5&&
    state.slatsFull===slatsFull&&state.massKg===massKg)return false;
  state=Core.command(state,{type:'AERO_CONFIG',flapLever,flapActual,slatsFull,massKg});
  return true;
 }
 function tick(){
  const now=performance.now();
  if(active&&state){
   const dt=lastTick?Math.min(.3,Math.max(0,(now-lastTick)/1000)):0;
   lastTick=now;
   try{
    // Read actual flap actuator travel while paused; only flight time and
    // kinematics are frozen, not the physical setup of the aircraft.
    syncAeroConfiguration();
    if(!pause&&!crewFollower){
    if(now-lastEngineContextAt>=900){
     lastEngineContextAt=now;
     try{win.B737ISNCockpitV1?.setFlightScenarioContext?.({
      active:true,onGround:!state.airborne,iasKt:state.iasKt,
      altitudeFt:state.altitudeFt,source:'FLIGHT_SCENARIO_ENGINE'});}
     catch(error){console.warn('ISN scenario flight context',error);}
    }
    followMcp();
    if(dt>0)state=Core.step(state,dt,propulsionObservation(now));
   }}catch(error){
    // An FCC/plant update error must not withdraw healthy IRS/ADC/RA
    // sources. Publish the last valid simulated state, as during PAUSE,
    // and retain the failure for diagnosis instead of letting TTL expire.
    tickErrorCount++;
    lastTickError={message:String(error?.message||error),atMs:Date.now()};
    if(tickErrorCount===1||tickErrorCount%100===0)
     console.warn('FLIGHT UPDATE ERROR',error);
    status('FLIGHT UPDATE ERROR · '+lastTickError.message+
     ' · Telemetry continues from the last valid simulated state.',true);
   }
   if(now-lastPublish>=250){publish();lastPublish=now;}
   if(now-lastUI>=400){updateUI();lastUI=now;}
  }else lastTick=now;
 }
 function mountSetupTabs(){
  const select=by('flightPreset'),grid=select.closest('.flight-grid');
  if(!grid||by('flightSetupTabs'))return;
  const root=doc.createElement('div');root.id='flightSetupTabs';
  grid.before(root);
  const nav=doc.createElement('div');nav.className='flight-actions';nav.setAttribute('role','group');nav.setAttribute('aria-label','Aircraft initial setup');
  const location=doc.createElement('button'),general=doc.createElement('button');
  for(const [button,label] of [[location,'FLIGHT LOCATION'],[general,'GENERAL SETUP']]){
   button.type='button';button.textContent=label;nav.append(button);
  }
  const panel=doc.createElement('fieldset');panel.id='flightGeneralSetup';panel.style.cssText='border:1px solid #52748a;border-radius:8px;padding:12px;margin:8px 0;color:inherit;';
  const legend=doc.createElement('legend');legend.textContent='Aircraft General Setup';panel.append(legend);
  for(const [value,label,disabled] of [['COLD_DARK','COLD & DARK',false],['READY_FOR_START','READY FOR START',true],['READY_FOR_TAKEOFF','READY FOR TAKEOFF',true]]){
   const row=doc.createElement('label');row.style.cssText='display:flex;align-items:center;gap:8px;padding:7px 0;'+(disabled?'opacity:.45;':'');
   const input=doc.createElement('input');input.type='radio';input.name='flightGeneralSetup';input.value=value;input.disabled=disabled;input.checked=!disabled;
   const title=doc.createElement('span');title.textContent=label;row.append(input,title);
   if(disabled){const note=doc.createElement('small');note.textContent='COMING SOON';note.style.marginLeft='auto';row.append(note);}
   panel.append(row);
  }
  root.append(nav,grid,panel);
  location.setAttribute('aria-controls','flightLocationGrid');grid.id='flightLocationGrid';general.setAttribute('aria-controls',panel.id);
  function choose(tab,notify=true){
   setupTab=tab;const isGeneral=tab==='GENERAL';
   grid.hidden=isGeneral;grid.style.display=isGeneral?'none':'';
   panel.hidden=!isGeneral;panel.style.display=isGeneral?'':'none';
   for(const [button,active] of [[location,!isGeneral],[general,isGeneral]]){
    button.setAttribute('aria-pressed',String(active));button.classList.toggle('flight-primary',active);
   }
   if(notify)select.dispatchEvent(new Event('change',{bubbles:true}));
  }
  location.addEventListener('click',()=>choose('LOCATION'));general.addEventListener('click',()=>choose('GENERAL'));
  choose('LOCATION',false);
 }
 function mount(){
  if(mounted)return;
  const header=doc.querySelector('.unified-minimal-header .header-settings');
  if(!header)return;
  let launch=by('flightScenarioHeader');
  if(!launch){
   launch=doc.createElement('button');launch.id='flightScenarioHeader';launch.type='button';launch.textContent='FLT PHASE';
   launch.setAttribute('aria-haspopup','dialog');launch.setAttribute('aria-controls','flightScenarioDialog');
   header.appendChild(launch);
  }
  let dlg=by('flightScenarioDialog');
  if(!dlg){
   dlg=doc.createElement('dialog');dlg.id='flightScenarioDialog';
   dlg.setAttribute('aria-labelledby','flightScenarioTitle');dlg.setAttribute('dir','ltr');
   dlg.innerHTML=html;doc.body.appendChild(dlg);
  }
  if(launch.dataset?.flightShell!=='READY'){
   launch.addEventListener('click',()=>{if(!dlg.open)dlg.showModal();});
   by('flightScenarioClose').addEventListener('click',()=>dlg.close());
  }
  // The UI and scenario core must never drift: reconcile both the static dialog and dynamic fallback.
  const airportSelect=by('flightAirport');
  for(const airport of Object.values(Core.AIRPORTS)){
   if(typeof airportSelect?.add==='function'&&
      !Array.from(airportSelect.options||[]).some(option=>option.value===airport.icao)){
    airportSelect.add(new Option(airport.name.toUpperCase()+' · '+airport.icao,airport.icao));
   }
  }
  mountSetupTabs();
  by('flightAirport').addEventListener('change',()=>{choiceArmed=true;airportChanged();presetChanged();});
  by('flightRunway').addEventListener('change',()=>{choiceArmed=true;presetChanged();});
  by('flightPreset').addEventListener('change',()=>{choiceArmed=true;presetChanged();});
  for(const field of ['Lat','Lon'])by('flight'+field).addEventListener('change',()=>{if(selectedPreset()==='MANUAL'){choiceArmed=true;publishSelectedReference();}});
  by('flightLoad').addEventListener('click',load);
  by('flightTargets').addEventListener('click',targets);
  by('flightTakeoff').addEventListener('click',()=>{
   // Same TO/GA request is generated by either photographed thrust-lever
   // pushbutton. The Chapter 4 bridge resolves takeoff versus go-around.
   win.dispatchEvent(new CustomEvent('b737:toga-request',{detail:{source:'FLT_PHASE'}}));
  });
  by('flightManualPitchApply')?.addEventListener('click',()=>{
   if(!active||!state)return status('LOAD FLIGHT BEFORE MANUAL PITCH',true);
   if(win.B737McpAFDSBridgeV1?.getOutput?.()?.modes?.autopilot)
    return status('DISENGAGE A/P BEFORE MANUAL PITCH CONTROL',true);
   try{
    state=Core.command(state,{type:'PITCH',value:Number(by('flightManualPitch').value),
     source:'MANUAL_PILOT'});
    previouslyCoupled=false;
    status('MANUAL PITCH SELECTED · trainer auto-follow released');
    publish();updateUI();
   }catch(error){status('INVALID MANUAL PITCH · '+String(error?.message||error),true);}
  });
  by('flightPause').addEventListener('click',togglePause);
  by('flightStop').addEventListener('click',stop);
  const scene=by('scene');
  if(scene&&!by('flightScenarioSceneToggle')){
   const toggle=doc.createElement('button');toggle.type='button';
   toggle.id='flightScenarioSceneToggle';toggle.textContent='START';
   toggle.setAttribute('aria-label','Start or pause the loaded flight scenario');
   toggle.setAttribute('data-flight-owner','B737UnifiedFlightScenarioV1');
   toggle.disabled=true;
   toggle.addEventListener('click',togglePause);
   scene.append(toggle);
  }
  airportChanged();presetChanged();updateUI();
  timer=win.setInterval(tick,100);mounted=true;
 }
 const api=Object.freeze({version:VERSION,getState:snapshot,getSelectedPreset:selectedPreset,startFromSelection:load,
  loadScenario:config=>{win.B737ColdDarkGeneralPresetV1?.stop();state=Core.newScenario(config,approachThresholds(config));
   win.B737UnifiedFlightLocationV1?.choose({lat:state.lat,lon:state.lon,icao:state.icao,source:'FLIGHT_SCENARIO_INITIAL_POSITION'});
   active=true;pause=state.preset==='FINAL_10';previouslyCoupled=false;lastTick=performance.now();
   syncInitialEngineContext();
   publish();lastPublish=performance.now();updateUI();
   if(state.preset==='FINAL_10')win.B737Final10ApproachPresetV1?.apply?.(state);
   if(state.preset==='COLD_DARK')win.B737ColdDarkGeneralPresetV1?.apply();
   return snapshot();},
  command:(action)=>{if(!state)throw Error('NO_SCENARIO');state=Core.command(state,action);publish();updateUI();return snapshot();},
  stepForTest:dt=>{if(!state)throw Error('NO_SCENARIO');state=Core.step(state,dt);return snapshot();},
  crewFollower:value=>{crewFollower=value===true;lastTick=performance.now();},
  followCrew:(sample,paused)=>{
   const initial=!active||state?.icao!==sample.icao||state?.runway!==sample.runway||state?.preset!==sample.preset;
   state=sample;active=true;pause=paused;crewFollower=true;lastTick=performance.now();
   if(initial||lastTick-lastEngineContextAt>=900){
    lastEngineContextAt=lastTick;syncInitialEngineContext();
   }
   publish();updateUI();
   // A follower can receive a flight sample before loadFlight after
   // a late join/reconnect. Restore real FINAL_10 cockpit owners, including
   // immediate FLAPS 30 and LE FULL, not only the flight display numbers.
   if(initial&&sample.preset==='COLD_DARK')win.B737ColdDarkGeneralPresetV1?.apply();
   if(initial&&sample.preset==='FINAL_10')
    win.B737Final10ApproachPresetV1?.apply?.(state);
  },
  pause:value=>{pause=value===true;lastTick=performance.now();updateUI();},togglePause,stop,
  getDiagnostics:()=>({active,paused:pause,airborne:state?.airborne===true,
   phase:state?.phase??null,revision:state?.revision??null,elapsedSec:state?.elapsedSec??null,
   lastPublishAgeMs:active?Math.max(0,performance.now()-lastPublish):null,
   tickErrorCount,lastTickError:lastTickError?{...lastTickError}:null,
   mcpFollow,producers:Object.keys(producers),producerErrors:{...producerErrors}})});
 win.B737UnifiedFlightScenarioV1=api;
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
