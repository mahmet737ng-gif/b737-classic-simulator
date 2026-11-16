/* Unified Flight Scenario Lab v1. Optional instructor feed; no panel DOM overrides. */
(function(win){
 'use strict';
 const Core=win.B737FlightScenarioCoreV1;
 if(!Core){console.error('B737FlightScenarioCoreV1 dependency missing');return;}
 const doc=win.document,by=id=>doc.getElementById(id);
 let state=null,active=false,pause=false,lastTick=0,lastPublish=0,lastUI=0;
 let producers={},producerErrors={},timer=null,mcpFollow=true,previouslyCoupled=false;
 let lastPropulsionAt=0,lastPropulsion=null,lastEngineContextAt=0;
 const VERSION='UNIFIED-FLIGHT-SCENARIOS-0001';
 const html=`
  <div class="flight-head"><strong id="flightScenarioTitle">FLIGHT SCENARIO ENGINE</strong><button id="flightScenarioClose" type="button" aria-label="Close flight scenarios">×</button></div>
  <p class="flight-sub">B737 Classic · Instructor training model · MSL altitude / MAGNETIC heading using live WMM2025 variation; TRUE retained inside flight physics. Training only.</p>
  <div class="flight-grid">
   <label>Airport / فرودگاه<select id="flightAirport"><option value="OIMM">MASHHAD · OIMM</option><option value="OIII">TEHRAN MEHRABAD · OIII</option><option value="OISS">SHIRAZ · OISS</option></select></label>
   <label>Runway / باند<select id="flightRunway"></select></label>
   <label>Aircraft status<select id="flightAirGround"><option value="GROUND">GROUND</option><option value="AIRBORNE">AIRBORNE</option></select></label>
   <label>Start location<select id="flightPreset"><option value="RUNWAY_READY">READY FOR TAKEOFF</option><option value="FINAL_5">5 NM FINAL</option><option value="FINAL_10">10 NM FINAL</option><option value="MANUAL">MANUAL INITIAL STATE</option></select></label>
  </div>
  <div class="flight-heading">INITIAL STATE / MANUAL TARGET</div>
  <div class="flight-grid flight-numbers">
   <label>Altitude MSL (ft)<input id="flightAlt" type="number" min="0" max="65000" step="100" value="6263"></label>
   <label>Heading MAG (°)<input id="flightHeading" type="number" min="0" max="359" step="1" value="309"></label>
   <label>Indicated speed (kt)<input id="flightSpeed" type="number" min="0" max="450" step="1" value="220"></label>
   <label>Vertical speed (fpm)<input id="flightVS" type="number" min="-5000" max="5000" step="100" value="0"></label>
   <label>Bank command (°)<input id="flightBank" type="number" min="-30" max="30" step="1" value="0"></label>
  </div>
  <div class="flight-actions">
   <button type="button" id="flightLoad" class="flight-primary">LOAD SCENARIO</button>
   <button type="button" id="flightTargets">APPLY FLIGHT TARGETS</button>
   <button type="button" id="flightTakeoff">BEGIN TAKEOFF ROLL</button>
   <button type="button" id="flightPause">PAUSE</button>
   <button type="button" id="flightStop">STOP FEED</button>
  </div>
  <label class="flight-mcp"><input id="flightFollowMCP" type="checkbox" checked> AUTO FCC COUPLING · Follow powered MCP CMD/CWS flight modes (default ON)</label>
  <div class="flight-heading">LIVE AIRCRAFT STATE</div>
  <div class="flight-telemetry" id="flightTelemetry">
   <div><span>PHASE</span><strong id="flightOutPhase">NOT ACTIVE</strong></div>
   <div><span>IAS</span><strong id="flightOutIAS">—</strong></div>
   <div><span>ALT MSL</span><strong id="flightOutAlt">—</strong></div>
   <div><span>VS</span><strong id="flightOutVS">—</strong></div>
   <div><span>MAG HDG</span><strong id="flightOutHDG">—</strong></div>
   <div><span>MAG VAR · WMM2025</span><strong id="flightOutVar">—</strong></div>
   <div><span>BANK</span><strong id="flightOutBank">—</strong></div>
   <div><span>PITCH</span><strong id="flightOutPitch">—</strong></div>
   <div><span>AGL*</span><strong id="flightOutAGL">—</strong></div>
   <div><span>LAT</span><strong id="flightOutLat">—</strong></div>
   <div><span>LON</span><strong id="flightOutLon">—</strong></div>
   <div><span>GS</span><strong id="flightOutGS">—</strong></div>
   <div><span>RWY DIST</span><strong id="flightOutDist">—</strong></div>
  </div>
  <p id="flightGeorefWarning" class="flight-warning">Runway threshold geometry is provisional: airport reference point, not certified runway threshold. AGL* uses airport elevation, not terrain.</p>
  <p id="flightScenarioStatus" class="flight-status" role="status">Select airport, runway and scenario; then press LOAD SCENARIO. Current Unified avionics remain unchanged until activated.</p>
 `;
 const fields=['Alt','Heading','Speed','VS','Bank'];
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
 function airportChanged(){
  const a=Core.AIRPORTS[by('flightAirport').value];
  const rw=by('flightRunway'),previous=rw.value;
  rw.replaceChildren();
  for(const [id,hdg] of Object.entries(a.runways)){
   const opt=new Option('RWY '+id+' · '+magLabel(hdg,airportPoint(a)),id);rw.add(opt);
  }
  rw.value=Object.hasOwn(a.runways,previous)?previous:a.defaultRunway;
  const manual=by('flightPreset').value==='MANUAL';
  if(!manual){
   const mag=magneticHeading(a.runways[rw.value],airportPoint(a));
    by('flightHeading').value=Number.isFinite(mag)?Math.round(mag)%360:'';
   by('flightAlt').value=a.elevationFt+(by('flightPreset').value==='RUNWAY_READY'?0:3000);
  }
 }
 function presetChanged(){
  const kind=by('flightPreset').value;
  if(kind==='RUNWAY_READY')by('flightAirGround').value='GROUND';
  else if(kind==='FINAL_5'||kind==='FINAL_10')by('flightAirGround').value='AIRBORNE';
  const a=Core.AIRPORTS[by('flightAirport').value];
  if(kind!=='MANUAL'){
   const mag=magneticHeading(a.runways[by('flightRunway').value],airportPoint(a));
    by('flightHeading').value=Number.isFinite(mag)?Math.round(mag)%360:'';
   by('flightAlt').value=Math.round(a.elevationFt+(kind==='RUNWAY_READY'?0:kind==='FINAL_5'?1643:3236));
   by('flightSpeed').value=kind==='RUNWAY_READY'?0:kind==='FINAL_5'?155:170;
   by('flightVS').value=kind==='RUNWAY_READY'?0:kind==='FINAL_5'?-823:-902;
   by('flightBank').value=0;
  }
 }
 function airGroundChanged(){
  const g=by('flightAirGround').value==='GROUND',p=by('flightPreset');
  if(g&&p.value!=='RUNWAY_READY'&&p.value!=='MANUAL')p.value='MANUAL';
  if(!g&&p.value==='RUNWAY_READY')p.value='MANUAL';
  presetChanged();
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
  sendAvionics();
 }
 function updateUI(){
  if(!by('flightOutPhase'))return;
  const put=(name,value)=>{by('flightOut'+name).textContent=value;};
  if(!state){
   put('Phase','NOT ACTIVE');
   if(by('flightStop'))by('flightStop').disabled=true;
   if(by('flightPause'))by('flightPause').disabled=true;
   return;
  }
  if(by('flightStop'))by('flightStop').disabled=state.airborne===true;
  if(by('flightPause'))by('flightPause').disabled=false;
  const n=(x,d=0)=>Number(x).toFixed(d);
  put('Phase',state.phase.replaceAll('_',' '));
  put('IAS',n(state.iasKt)+' kt');put('Alt',n(state.altitudeFt)+' ft');
  put('VS',n(state.vsFpm)+' fpm');put('HDG',magLabel(state.trueHeadingDeg,state));
  const magVariation=magneticVariation(state);
  put('Var',Number.isFinite(magVariation)?
   Math.abs(magVariation).toFixed(2)+'° '+(magVariation<0?'W':'E'):'N/A');
  put('Bank',n(state.bankDeg,1)+'°');put('Pitch',n(state.pitchDeg,1)+'°');
  put('AGL',n(state.radioAltitudeFt)+' ft');put('Lat',n(state.lat,5));
  put('Lon',n(state.lon,5));put('GS',n(state.gsKt)+' kt');
  put('Dist',n(Core.distanceNm(state,state.threshold),2)+' NM');
  by('flightGeorefWarning').textContent=state.georefQuality==='PROVISIONAL_ARP'?
   'PROVISIONAL ARP-BASED RUNWAY ANCHOR — not the surveyed runway threshold. 5/10 NM are relative to this simulated anchor. AGL* is airport-elevation-based, not terrain elevation.':
   'Runway anchor supplied externally. Source: '+state.threshold.source+' · AGL* is airport-elevation-based.';
  by('flightTakeoff').disabled=state.phase!=='GROUND_READY';
  by('flightPause').textContent=pause?'RESUME':'PAUSE';
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
  win.dispatchEvent(new CustomEvent('b737:flight-scenario-stopped',{detail:{version:VERSION}}));
  return true;
 }
 function load(){
  try{
   const preset=by('flightPreset').value;
   const config={airport:by('flightAirport').value,runway:by('flightRunway').value,preset,
    airborne:by('flightAirGround').value==='AIRBORNE'};
   if(preset==='MANUAL'){
    config.altitudeFt=v('Alt');config.headingDeg=trueHeading(v('Heading'),airportPoint(Core.AIRPORTS[config.airport]));
    config.speedKt=v('Speed');config.vsFpm=v('VS');config.bankDeg=v('Bank');
   }
   state=Core.newScenario(config);
   active=true;pause=false;previouslyCoupled=false;lastTick=performance.now();lastPublish=0;
   if(preset!=='MANUAL'){
    by('flightAlt').value=Math.round(state.altitudeFt);
    const mag=magneticHeading(state.trueHeadingDeg,state);
     by('flightHeading').value=Number.isFinite(mag)?Math.round(mag)%360:'';
    by('flightSpeed').value=Math.round(state.iasKt);
    by('flightVS').value=Math.round(state.vsFpm);
    by('flightBank').value=0;
   }
   publish();lastPublish=performance.now();updateUI();
   status('ACTIVE · '+state.icao+' RWY '+state.runway+' · '+state.phase+' · '+state.georefQuality);
  }catch(error){status('SCENARIO NOT LOADED: '+String(error.message||error),true);}
 }
 function targets(){
  if(!active||!state){status('Load a scenario first.',true);return;}
  try{
   state=Core.command(state,{type:'SPEED',value:v('Speed')});
   if(v('Bank')!==0)state=Core.command(state,{type:'BANK',value:v('Bank')});
   else state=Core.command(state,{type:'HEADING',value:trueHeading(v('Heading'),state)});
   state=Core.command(state,{type:'VS',value:v('VS')});
   // Manual VS and altitude target are alternate vertical guidance modes.
   // ALT field in scenario load is the current altitude; this button
   // commands ALT CAPTURE when a nonzero vertical distance is requested.
   if(Math.abs(v('Alt')-state.altitudeFt)>50)
    state=Core.command(state,{type:'ALTITUDE',value:v('Alt')});
   status('Targets accepted — aircraft changes heading/bank, IAS and altitude over simulated time.');
  }catch(error){status('INVALID TARGET: '+String(error.message||error),true);}
 }
 function followMcp(){
  if(!active||!state?.airborne)return;
  const fcc=win.B737UnifiedFccFlightV1;
  const output=win.B737McpAFDSBridgeV1?.getOutput?.();
  if(!mcpFollow||output?.power!==true||!output.modes?.autopilot){
   if(previouslyCoupled){
    state=Core.command(state,{type:'MANUAL_HOLD'});
    previouslyCoupled=false;
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
    case 'VS':return t.verticalMode==='VS'&&t.vsFpm===action.value;
    case 'ALTITUDE':return t.verticalMode==='ALTITUDE'&&Math.abs(t.altitudeFt-action.value)<.01;
    case 'SPEED':return Math.abs(t.speedKt-action.value)<.01;
    default:return false;
   }
  };
  for(const command of commands.actions){
   if(matches(command))continue;
   try{state=Core.command(state,command);}
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
   {valid:true,engines}:null;
  return lastPropulsion;
 }
 function tick(){
  const now=performance.now();
  if(active&&state){
   const dt=lastTick?Math.min(.3,Math.max(0,(now-lastTick)/1000)):0;
   lastTick=now;
   if(!pause){
    if(now-lastEngineContextAt>=900){
     lastEngineContextAt=now;
     try{win.B737ISNCockpitV1?.setFlightScenarioContext?.({
      active:true,onGround:!state.airborne,iasKt:state.iasKt,
      altitudeFt:state.altitudeFt,source:'FLIGHT_SCENARIO_ENGINE'});}
     catch(error){console.warn('ISN scenario flight context',error);}
    }
    followMcp();
    if(dt>0)state=Core.step(state,dt,propulsionObservation(now));
   }
   if(now-lastPublish>=250){publish();lastPublish=now;}
   if(now-lastUI>=400){updateUI();lastUI=now;}
  }else lastTick=now;
 }
 function mount(){
  if(by('flightScenarioDialog'))return;
  const header=doc.querySelector('.unified-minimal-header .header-settings');
  if(!header)return;
  const launch=doc.createElement('button');
  launch.id='flightScenarioHeader';launch.textContent='GROUND / AIRBORNE';
  launch.setAttribute('aria-haspopup','dialog');launch.setAttribute('aria-controls','flightScenarioDialog');
  header.appendChild(launch);
  const dlg=doc.createElement('dialog');
  dlg.id='flightScenarioDialog';dlg.setAttribute('aria-labelledby','flightScenarioTitle');
  dlg.setAttribute('dir','ltr');dlg.innerHTML=html;doc.body.appendChild(dlg);
  launch.addEventListener('click',()=>dlg.showModal());
  by('flightScenarioClose').addEventListener('click',()=>dlg.close());
  by('flightAirport').addEventListener('change',()=>{airportChanged();presetChanged();});
  by('flightRunway').addEventListener('change',presetChanged);
  by('flightPreset').addEventListener('change',presetChanged);
  by('flightAirGround').addEventListener('change',airGroundChanged);
  by('flightLoad').addEventListener('click',load);
  by('flightTargets').addEventListener('click',targets);
  by('flightTakeoff').addEventListener('click',()=>{
   try{state=Core.command(state,{type:'TAKEOFF_ROLL'});updateUI();status('Takeoff roll underway. Approximate training acceleration; not AFM V-speeds.');}
   catch(e){status(String(e.message||e),true);}
  });
  by('flightPause').addEventListener('click',()=>{if(!active)return;pause=!pause;updateUI();});
  by('flightStop').addEventListener('click',stop);
  by('flightFollowMCP').addEventListener('change',e=>{mcpFollow=e.target.checked;});
  airportChanged();presetChanged();updateUI();
  timer=win.setInterval(tick,100);
 }
 const api=Object.freeze({version:VERSION,getState:snapshot,
  loadScenario:config=>{state=Core.newScenario(config);active=true;pause=false;previouslyCoupled=false;lastTick=performance.now();publish();lastPublish=performance.now();updateUI();return snapshot();},
  command:(action)=>{if(!state)throw Error('NO_SCENARIO');state=Core.command(state,action);publish();updateUI();return snapshot();},
  stepForTest:dt=>{if(!state)throw Error('NO_SCENARIO');state=Core.step(state,dt);return snapshot();},
  pause:value=>{pause=value===true;updateUI();},stop,
  getDiagnostics:()=>({active,paused:pause,airborne:state?.airborne===true,
   phase:state?.phase??null,revision:state?.revision??null,elapsedSec:state?.elapsedSec??null,
   lastPublishAgeMs:active?Math.max(0,performance.now()-lastPublish):null,
   mcpFollow,producers:Object.keys(producers),producerErrors:{...producerErrors}})});
 win.B737UnifiedFlightScenarioV1=api;
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);
