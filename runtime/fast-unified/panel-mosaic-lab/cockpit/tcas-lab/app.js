(function(win){'use strict';
 const C=win.B737ClassicTcasV2,Core=win.EFISDisplayLabCore,Cruise=win.B737TcasCruiseScenarioV1,
  by=id=>document.getElementById(id);
 let settings=C.controls(),own={airborne:true,altitudeFt:27000,radioAltitudeFt:24000,
  tasKt:440,gsKt:448,iasKt:293,mach:.73,pitchDeg:2,vsFpm:0,
  trueHeadingDeg:0,trueTrackDeg:0,elapsedSec:0},initialAltitudeFt=27000,
 encounter=null,out=null,running=false,last=null,targetPitch=2,autopilotEngaged=true,
 pitchRateDegPerSec=0,tfcVisible=true,
 loadedScenarioId=null,loadSequence=0;
 const scenario=by('scenario');for(const [id,s] of Object.entries(C.SCENARIOS)){const o=new Option(s.label,id);scenario.add(o);}scenario.value='DIVERGING_ABOVE';
 for(const id of Object.keys(settings.failures)){const label=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.failure=id;label.append(input,document.createTextNode(id));by('failures').append(label);input.addEventListener('change',()=>{settings.failures[id]=input.checked;refresh();});}
 function feeds(){return {xpdr1:by('bus1').checked,xpdr2:by('bus2').checked&&by('atc2cb').checked,computer:!settings.failures.computer,aligned:!settings.failures.irs,adc1:true,adc2:true,radioAlt:true,irs:true};}
 const LEVEL_CRUISE_PITCH_DEG=2; // This lab's 0-FPM cruise reference.
 function load(autoRun=false){
  const requestedId=scenario.value;
  const feedback=by('scenarioStatus');
  if(!C.SCENARIOS[requestedId])throw Error('UNKNOWN_SELECTED_SCENARIO: '+requestedId);
  feedback.dataset.loadState='loading';
  feedback.textContent='LOADING SCENARIO · '+C.SCENARIOS[requestedId].label;
  running=false;last=null;by('play').textContent='RUN';autopilotEngaged=true;
  pitchRateDegPerSec=0;
  own.elapsedSec=0;own.altitudeFt=Number(by('altitude').value);own.radioAltitudeFt=Number(by('radioHeight').value);own.iasKt=Number(by('speed').value);
  // 293 KIAS / Mach .73 cruise demonstration, with TAS distinct from CAS.
  // These are trainer estimates, not an ADC atmosphere calculation.
  own.tasKt=own.iasKt*(440/293);own.gsKt=own.tasKt+8;
  own.mach=Math.min(.98,Math.max(0,own.iasKt/293*.73));
  own.pitchDeg=Number(by('pitch').value);targetPitch=own.pitchDeg;own.vsFpm=Number(by('vs').value);
  initialAltitudeFt=own.altitudeFt;
  own.trueTrackDeg=own.trueHeadingDeg=Cruise.route({elapsedSec:0,groundSpeedKt:own.gsKt}).own.headingDeg;
  // The trainer's progressive profile derives warnings from future 3D
  // overlap, not a scripted class switch. Passing traffic never overrides
  // its physical near-miss geometry just because CONVERGING was left checked.
  // Select an observable real geometry when a scenario is loaded. Previously
  // the default 8.2-NM start delayed the first TA/RA by 34-49 s and allowed
  // reversal encounters to clear before the reverse advisory was reached.
  // Normal encounters begin at a physically calculated TA (~5 s before RA).
  // A reversal begins with its initial RA, preserving the subsequent 7-s RA.
  const options={progressive:true,
   distanceNm:requestedId.startsWith('REVERSAL_')||requestedId==='TA_ONLY'?2.5:4.5};
  if(requestedId!=='TA_ONLY'&&by('converging').checked){
   options.converging=true;options.lateralSide=by('intruderSide').value;
  }
  if(by('relative').value.trim())options.relativeAltitudeFt=Number(by('relative').value);
  if(by('intruderVS').value.trim())options.verticalRateFpm=Number(by('intruderVS').value);
  const nextEncounter=C.create(requestedId,own,options);
  if(nextEncounter.scenario!==requestedId)throw Error('SCENARIO_ID_MISMATCH: '+requestedId);
  // Commit the new scenario and its own T+0 output together. Never leave the
  // old encounter on-screen while reporting the new selection as loaded.
  encounter=C.step(nextEncounter,own,0,settings,feeds());
  out=encounter.output;
  if(!out||!Array.isArray(out.targets))throw Error('EMPTY_SCENARIO_OUTPUT: '+requestedId);
  loadedScenarioId=requestedId;
  ++loadSequence;
  feedback.dataset.loadedScenario=requestedId;
  feedback.dataset.loadSequence=String(loadSequence);
  feedback.dataset.loadState='loaded';
  tfcVisible=true;syncTfc();
  // A graphic failure must be reported separately from encounter initialization.
  // It must not silently restore old data or disguise a successful load.
  paint();
  running=autoRun;last=null;by('play').textContent=running?'PAUSE':'RUN';updateScenarioStatus();
 }
 function updateScenarioStatus(){if(!encounter)return;
  const spec=C.SCENARIOS[encounter.scenario],status=by('scenarioStatus');
  if(scenario.value!==loadedScenarioId && status?.dataset.loadState==='selected')return;
  if(status){
   const primary=out?.targets?.find(t=>!t.id?.startsWith('OTHER-'));
   status.textContent='LOADED #'+loadSequence+' · '+(spec?.label||encounter.scenario)+
    ' · '+(out?.stage||'MONITOR')+
    ' · TARGET '+(primary?primary.kind+' '+Number(primary.distance).toFixed(1)+' NM':'NOT TRANSMITTING')+
    ' · T+'+Math.floor(own.elapsedSec)+' S · '+(running?'RUNNING':'PAUSED');
   status.dataset.loadedScenario=encounter.scenario;
   status.dataset.loadState='loaded';
   status.dataset.elapsedSec=String(Math.floor(own.elapsedSec));
  }
 }
 function refresh(){if(!encounter)return;encounter=C.step(encounter,own,0,settings,feeds());out=encounter.output;paint();}
 function step(dt){
  // Smooth instructor pitch plant: 0.55 deg/s peak, 0.45 deg/s² slew.
  // Unlike the previous instant 3 deg/s jump, a normal 1500-FPM RA
  // takes several seconds to establish and an urgent 10° command longer.
  const maxRate=.55,maxAcceleration=.45;
  const desiredRate=Math.max(-maxRate,Math.min(maxRate,
   (targetPitch-own.pitchDeg)*.95));
  pitchRateDegPerSec+=Math.max(-maxAcceleration*dt,
   Math.min(maxAcceleration*dt,desiredRate-pitchRateDegPerSec));
  const remaining=targetPitch-own.pitchDeg,change=pitchRateDegPerSec*dt;
  if(Math.abs(change)>=Math.abs(remaining)){
   own.pitchDeg=targetPitch;pitchRateDegPerSec=0;
  }else own.pitchDeg+=change;
  own.vsFpm=Math.sin((own.pitchDeg-LEVEL_CRUISE_PITCH_DEG)*Math.PI/180)*own.tasKt*6076.11549/60;
  own.altitudeFt+=own.vsFpm*dt/60;own.radioAltitudeFt+=own.vsFpm*dt/60;own.elapsedSec+=dt;
  // LNAV-like simulation follows each route leg and turns to the next fix.
  own.trueTrackDeg=own.trueHeadingDeg=Cruise.route({elapsedSec:own.elapsedSec,groundSpeedKt:own.gsKt}).own.headingDeg;
  encounter=C.step(encounter,own,dt,settings,feeds());out=encounter.output;paint();
 }
 function syncTfc(){
  const button=by('tfc');
  button.textContent=tfcVisible?'TFC ON':'TFC OFF';
  button.className=tfcVisible?'tfc-on':'tfc-off';
  button.setAttribute?.('aria-pressed',String(tfcVisible));
 }
 function paint(){
  const state=Core.initial(),cp=win.B737TcasEfisCPV1?.getState?.();
  if(cp)state.eadi.brightness=cp.brightness.adi;
  state.eadi.pitch=own.pitchDeg;state.eadi.bank=0;
  // The two attitude inputs agree: do not generate an artificial PITCH compare flag.
  state.eadi.otherPitch=own.pitchDeg;state.eadi.otherBank=0;
  state.eadi.ias=own.iasKt;state.eadi.mach=own.mach;state.eadi.machVisible=true;
  state.eadi.groundSpeed=own.gsKt;state.eadi.radioAlt=own.radioAltitudeFt;
  state.eadi.dh=-20; // Instructor cruise: no DH setting, not a failed DH sensor.
  state.eadi.fmaFontScale=.88; // TCAS Lab only; Unified FMA lettering is unchanged.
  state.eadi.selectedSpeed=own.iasKt;state.eadi.fmcCommandSpeed=own.iasKt;
  state.eadi.tcasRa=out.ra;state.eadi.tcasFenceSimple=true;
  // Cruise FMC guidance is unchanged by a TCAS response: the crew
  // disengages CMD and flies the RA with the flight director available.
  state.eadi.at='FMC SPD';state.eadi.pitchMode='VNAV PTH';state.eadi.rollMode='LNAV';
  state.eadi.afds=autopilotEngaged?'CMD':'FD';state.eadi.apEngaged=autopilotEngaged;
  state.eadi.fd=true;state.eadi.fdAuto=false;
  // FD does not follow a manual TCAS maneuver. VNAV PTH continues asking
  // for level cruise (2° in this simplified 0-FPM flight-path model).
  // As the aircraft pitches up to comply with a CLIMB RA, the level-flight
  // FD cue moves DOWN relative to the airplane symbol, never up with the RA.
  state.eadi.fdPitch=LEVEL_CRUISE_PITCH_DEG;
  state.eadi.fdRoll=0;
  state.eadi.fmcVerticalValid=true;state.eadi.phase='CRUISE';
  win.EFISDisplayLabEadi.render(by('eadi'),state,Core);
  const cruise=Cruise.route({elapsedSec:own.elapsedSec,groundSpeedKt:own.gsKt});
  const ambientAll=Cruise.ambient({elapsedSec:own.elapsedSec,ownAltitudeFt:own.altitudeFt,
   initialAltitudeFt,ownGroundSpeedKt:own.gsKt});
  const rangeNm=Number(by('range').value);
  const separation=(a,b)=>{
   const aAngle=a.bearing*Math.PI/180,bAngle=b.bearing*Math.PI/180;
   return Math.hypot(a.distance*Math.sin(aAngle)-b.distance*Math.sin(bAngle),
    a.distance*Math.cos(aAngle)-b.distance*Math.cos(bAngle));
  };
  // Only two non-target contacts inside 10 NM, and never crowd the chosen
  // encounter target or each other. The targets remain independently moving.
  const ambient=[];
  for(const t of ambientAll.sort((a,b)=>a.distance-b.distance)){
   if(t.distance>rangeNm)continue;
   if(rangeNm<=10&&ambient.length>=2)break;
   if(out.targets.some(target=>Number.isFinite(target.bearing)&&
    separation(t,target)<2.6))continue;
   if(ambient.some(visible=>separation(t,visible)<3))continue;
   ambient.push(t);
  }
  // Ambient contacts are visual-only; TCAS guidance comes exclusively from C.step.
  const traffic={...out,targets:[...out.targets,...ambient]};
  // The integrated IVSI and EHSI consume exactly the same live traffic list:
  // primary encounter plus up to two ambient targets at 10 NM.
  win.B737ClassicPhotoIVSIV1?.renderLab?.(by('ivsi'),own,traffic,{rangeNm,filter:settings.filter});
  win.EFISClassicEHSIV2.render(by('ehsi'),{mode:by('displayMode').value,range:rangeNm,
   heading:own.trueHeadingDeg,track:own.trueTrackDeg,geoTrack:own.trueTrackDeg,selectedHeading:own.trueTrackDeg,
   trueRef:false,nav:cruise.nav,route:cruise.route,options:{tfc:tfcVisible,...cp?.options},traffic,
   trueAirspeed:own.tasKt,groundSpeed:own.gsKt,syntheticAirport:false,mapObjects:[],
   trafficLabelOffsetY:12,routeClipToScale:true,trainingRoseLarge:true,routeOnFull:true,
   efis:{displayPower:true,sgValid:true,headingValid:!settings.failures.irs,
    trackValid:!settings.failures.irs,brightness:cp?.brightness.hsi??1,
    wxBrightness:cp?.brightness.wxInner??1},weather:{}});
  win.B737TcasEfisCPV1?.sync?.({mode:by('displayMode').value,range:rangeNm,tfc:tfcVisible});
  by('status').textContent=[out.mode,out.stage,out.callout,out.raContinuity,...out.inhibits].filter(Boolean).join(' · ');
  updateScenarioStatus();
  const t=out.transponder;by('xpdr').textContent='ATC '+t.selectedUnit+' · '+t.displayedCode+' · MODE S '+(t.modeS?'ON':'OFF')+' · ALT '+(t.altitudeReporting?'REPORTING':'OFF / INVALID')+' · '+(t.atcFailLight?'ATC FAIL / TEST':'NORMAL')+(t.ident?' · IDENT':'');
  by('ownState').textContent='SIM UTC '+cruise.utc+' · NEXT '+cruise.next+
   ' · DIST '+cruise.distanceNm.toFixed(1)+' NM · TTG '+cruise.timeToGo+
   ' · ETA '+cruise.eta+' · GS '+Math.round(own.gsKt)+' KT · TAS '+Math.round(own.tasKt)+
   ' KT · IAS '+Math.round(own.iasKt)+' KT · M '+own.mach.toFixed(2)+
   ' · ALT '+Math.round(own.altitudeFt)+' FT · VS '+Math.round(own.vsFpm)+' FPM';
  const tbody=by('trafficRows');tbody.replaceChildren();for(const t of traffic.targets){const tr=document.createElement('tr');
   const clock=Number.isFinite(t.bearing)?((Math.round(((t.bearing-own.trueHeadingDeg+360)%360)/30)%12)||12):'—';
   for(const value of [t.id,t.kind,clock,t.distance.toFixed(2),
    t.relativeAltitude===null?'UNKNOWN':Math.round(t.relativeAltitude),
    t.verticalRate??'—',t.verticalRelation??'—',
    Number.isFinite(t.tcpaSec)?Math.max(0,t.tcpaSec).toFixed(1):'—',
    Number.isFinite(t.timeToRaProximitySec)?t.timeToRaProximitySec.toFixed(1):
     Number.isFinite(t.timeToTaProximitySec)?t.timeToTaProximitySec.toFixed(1):'NO CONFLICT',
    Number.isFinite(t.predictedSeparationFt)?Math.round(t.predictedSeparationFt):'—']){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}tbody.append(tr);}
 }
 function showScenarioError(error){
  running=false;last=null;by('play').textContent='RUN';
  const message=String(error?.message||error);
  by('status').textContent='SCENARIO LOAD / RUNTIME ERROR: '+message;
  const banner=by('scenarioStatus');
  banner.textContent='FAILED TO LOAD '+(C.SCENARIOS[scenario.value]?.label||scenario.value)+
   ' · '+message+' · Old scenario: '+(loadedScenarioId||'NONE');
  banner.dataset.loadState='error';
  banner.dataset.requestedScenario=scenario.value;
  console.error('TCAS Scenario Lab',error);
 }
 function guard(fn){return ()=>{try{fn();}catch(e){showScenarioError(e);}};}
 function ensureLoadedSelection(){
  if(encounter&&scenario.value===loadedScenarioId)return true;
  const banner=by('scenarioStatus');
  banner.dataset.loadState='selected';
  banner.textContent='NOT LOADED · '+(C.SCENARIOS[scenario.value]?.label||scenario.value)+
   ' · CLICK LOAD SCENARIO FIRST';
  return false;
 }
 by('start').onclick=guard(()=>load(true));
 by('play').onclick=guard(()=>{
  if(!ensureLoadedSelection())return;
  running=!running;last=null;
  by('play').textContent=running?'PAUSE':'RUN';updateScenarioStatus();
 });
 by('step').onclick=guard(()=>{if(ensureLoadedSelection())step(1);});
 // Manual response converts CMD to FD and follows the actual vertical-rate
 // instruction, including urgent cases that may need roughly 10° pitch.
 // Values are intentionally instructor physics, not an operational AP command.
 function commandedPitchForRa(ra,target){
  const horizon=Math.max(5,Math.min(35,Number.isFinite(target?.tcpaSec)?target.tcpaSec:20));
  const intruderRate=Number.isFinite(target?.verticalRate)?target.verticalRate:0;
  const relative=Number.isFinite(target?.relativeAltitude)?target.relativeAltitude:0;
  const margin=600; // instructor separation goal at CPA (ft)
  let rate=own.vsFpm;
  if(ra.min!==null&&ra.max===null)
   rate=Math.max(ra.min,intruderRate+(relative+margin)*60/horizon);
  else if(ra.max!==null&&ra.min===null)
   rate=Math.min(ra.max,intruderRate+(relative-margin)*60/horizon);
  else if(ra.min!==null&&ra.max!==null)
   rate=Math.max(ra.min,Math.min(ra.max,rate));
  return Math.max(-12,Math.min(12,C.pitchForVs(Math.max(-6500,Math.min(6500,rate)),own)));
 }
 by('respond').onclick=guard(()=>{
  if(!out?.ra)return;
  // Disconnect CMD but keep FD commanded level-cruise, independent of RA.
  autopilotEngaged=false;
  const threat=out.targets.find(t=>t.kind==='RA'&&!t.invalidEcho)||null;
  targetPitch=commandedPitchForRa(out.ra,threat);
  by('pitch').value=targetPitch.toFixed(1);
  paint();
 });
 for(const [id,key] of [['mode','mode'],['unit','unit'],['altSource','altSource'],['code','code'],['filter','filter']])by(id).onchange=guard(()=>{settings[key]=['unit','altSource'].includes(key)?Number(by(id).value):by(id).value;refresh();});
 function syncScenarioOptions(){
  const passing=scenario.value==='TA_ONLY';
  const checkbox=by('converging');
  if(passing)checkbox.checked=false;
  checkbox.disabled=passing;
  checkbox.closest?.('label')?.setAttribute?.('title',passing?
   'Passing traffic is a verified lateral near miss; CONVERGING is unavailable for this preset.':
   'Select a lateral altitude-crossing encounter');
 }
 scenario.addEventListener('change',()=>{syncScenarioOptions();
  if(scenario.value!==loadedScenarioId){
   // STOP the previous encounter as soon as a different preset is chosen.
   // Otherwise each animation frame overwrites the "NOT YET LOADED" message
   // with the old running encounter, making LOAD appear unresponsive.
   running=false;last=null;by('play').textContent='RUN';
   const banner=by('scenarioStatus');
   banner.dataset.loadState='selected';
   banner.dataset.requestedScenario=scenario.value;
   banner.textContent='SELECTED: '+C.SCENARIOS[scenario.value].label+
    ' · NOT YET LOADED · PRESS LOAD SCENARIO';
  }
 });
 syncScenarioOptions();
 by('pitch').onchange=()=>{targetPitch=Number(by('pitch').value);};
 by('vs').onchange=()=>{targetPitch=2+Math.asin(Math.max(-.7,Math.min(.7,Number(by('vs').value)/(own.tasKt*6076.11549/60))))*180/Math.PI;by('pitch').value=targetPitch.toFixed(1);};
 by('priority').onchange=()=>{settings.priorityWarning=by('priority').checked;refresh();};
 for(const id of ['displayMode','range','bus1','bus2','atc2cb'])by(id).onchange=refresh;
 by('tfc').onclick=()=>{tfcVisible=!tfcVisible;syncTfc();paint();};
 by('ident').onclick=()=>{settings.identUntil=own.elapsedSec+1;refresh();};by('absolute').onclick=()=>{settings.absoluteUntil=own.elapsedSec+15;refresh();};
 function tick(now){if(running&&last!==null){const dt=Math.min(.2,(now-last)/1000)*Number(by('rate').value);try{step(dt);}catch(e){running=false;by('play').textContent='RUN';
  by('status').textContent='SCENARIO ERROR: '+e.message;by('scenarioStatus').textContent='SCENARIO ERROR: '+e.message;
  console.error('TCAS Scenario Lab animation',e);}}last=now;requestAnimationFrame(tick);}
 win.B737TcasEfisCPChanged=()=>{if(out)paint();};
 syncTfc();load();requestAnimationFrame(tick);
})(window);
