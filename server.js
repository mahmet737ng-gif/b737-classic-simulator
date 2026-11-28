'use strict';
/* Standalone ATA24 lab gateway. No upstream application routes or cross-app writes. */
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const zlib = require('node:zlib');
const {performance} = require('node:perf_hooks');
const { Pool } = require('pg');
const {WebSocketServer}=require('ws');
const {Readable: CrewReadable}=require('node:stream');
const PrivateNavData=require('./navdata-store.js');
const IranNavDataV2=require('./iran-navdata-v2.js');
const IranBootstrapV2=require('./iran-navdata-bootstrap-v2.js');
const {createCrewRoomHandler}=require('./crew-rooms.js');
const NavdataBootstrap=require('./navdata-bootstrap.js');
const NavdataRelay=require('./navdata-relay.js');
const {OWNER_SESSION_SECONDS,GUEST_SESSION_SECONDS,DEVICE_SESSION_SECONDS,isDocumentNavigation,canRegisterDevice}=require('./auth-policy.js');

const PORT = Number(process.env.PORT || 3000);
const USER = process.env.LAB_USER || 'Ali.m';
const BUILTIN_SCRYPT = 'scrypt:e16e63d5777399754f7b87d6666a7768:575fd8471f434a6e088f38abde8e62ce9a9cec892bd70b69ff07593d0abed044b99e0b5cd93f36bd4c83e340e96fdc9d4ce2bbe2a762d6aa3098d2b1d680ba89';
const PASSWORD_HASH = process.env.LAB_PASSWORD_SCRYPT || BUILTIN_SCRYPT;
const MAX_DEVICES = 3;
// This owner-supplied navigation subset is held in Railway variables only.
// Never publish the route database as part of the public GitHub repository.
const AIRWAY_REFERENCE=(()=>{try{return JSON.parse(process.env.LAB_AIRWAY_DHN_VERIFIED||'{}');}
 catch(_){return {};}})();
// Owner's wpNavRTE.txt ordered fixes, populated privately in Railway. Unknown
// topology must fail closed; a global waypoint-name match is not sufficient.
const AIRWAY_POINTS=(()=>{try{return JSON.parse(process.env.LAB_AIRWAY_DHN_ROUTE_POINTS_V1||'{}');}
 catch(_){return {};}})();
const UNLIMITED_USER = 'Taregh';
// Disabled unless Railway provides the salted verifier via a protected variable.
const UNLIMITED_PASSWORD_SCRYPT = process.env.LAB_TAREGH_PASSWORD_SCRYPT || '';
// Additional Unified accounts live exclusively in the protected Railway environment.
// Only salted scrypt verifiers, never plaintext passwords, are stored here.
const EXTRA_USERS = Object.freeze(JSON.parse(process.env.LAB_ADDITIONAL_USERS_JSON || '{}'));
for (const [name, verifier] of Object.entries(EXTRA_USERS)) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,39}$/.test(name) ||
      !/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(verifier) ||
      [UNLIMITED_USER,USER].some(value => value.toLowerCase() === name.toLowerCase())) {
    throw new Error('Invalid additional Unified account configuration');
  }
}
if (new Set(Object.keys(EXTRA_USERS).map(name => name.toLowerCase())).size !== Object.keys(EXTRA_USERS).length)
  throw new Error('Duplicate additional Unified account username');
const TOKEN_COOKIE = 'ata24_session';
const DEVICE_COOKIE = 'ata24_device';
const folder = path.join(__dirname, 'public');
const runtimeDir = path.join(__dirname, 'runtime');
const runtimeFiles = new Set(require('./runtime/manifest.json'));

/* Version-matched optimized cockpit compiled by the same tested web compiler
 * used for GitHub Pages. The protected Railway session check still precedes
 * EVERY response. Only public JS and HTML from the main simulator are mirrored;
 * owner photographs and all private NAVDATA remain in their original routes. */
// A sibling directory keeps these three documents outside the legacy cockpit
// worker's scope. Their original relative asset bases and same-origin session
// remain valid. Only these documents are routed through the new entry.
const cockpitSource='panel-mosaic-lab/cockpit/';
const cduLab=require('./unified-cdu-lab.js');
const directPath='/panel-mosaic-lab/unified/';
const directDocuments=new Map([
 [directPath,cockpitSource+'index.html'],
 [cduLab.labPath,cockpitSource+'index.html'],
 [directPath+'overhead-stage.html',cockpitSource+'overhead-stage.html'],
 [directPath+'cdu-stage.html',cockpitSource+'cdu-stage.html']
]);
const fastRuntimeDir=path.join(runtimeDir,'fast-unified');
// Apply a narrowly scoped, revisioned correction AFTER verifying the packaged
// source digests. Derived responses get their own digest and release cache key.
function applyColdDarkVisualFix(bytes,compressed,digests){
 const root='panel-mosaic-lab/cockpit/';
 const previewKey='cdu-standalone-v6/assets/cdu-approved-unlit.png';
 const photo=JSON.parse(bytes.get(root+'performance/manifest.json').toString()).images[previewKey];
 const local=photo.levels.filter(x=>!x.original&&bytes.has(x.url)).sort((a,b)=>b.extent-a.extent)[0];
 if(!local)throw Error('CDU local faceplate not packaged');
 const changes=[];
 function patch(relative,from,to){
  const body=bytes.get(relative);if(!body)throw Error('Visual fix asset missing '+relative);
  const source=body.toString('utf8');
  if(source.split(from).length!==2)throw Error('Visual fix marker mismatch '+relative);
  const result=Buffer.from(source.replace(from,to));
  bytes.set(relative,result);
  const digest=crypto.createHash('sha256').update(result).digest('hex');
  digests.set(relative,digest);changes.push([relative,digest]);
  if(/\.(?:js|css)$/.test(relative))compressed.set(relative,zlib.brotliCompressSync(result,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:4}}));
 }
 const app=root+'desktop-bundle-a7262b13b5fc72a5.js';
 patch(app,`   if(preview){
    child.style.visibility='hidden';
    child.addEventListener('load',()=>{
     preview.remove();child.style.visibility='';
     station.removeAttribute('data-visual-shell');
    },{once:true});
   }`,`   // A frame load can be an error document or precede image decoding.
   // Retain the approved physical face until the actual child face is ready.
   {
    child.style.visibility='hidden';
    let generation=0;
    child.addEventListener('load',()=>{
     const current=++generation;
     child.style.visibility='hidden';
     station.dataset.cduPhysicalReady='false';
     const handoff=async()=>{
      if(current!==generation||!child.isConnected)return;
      let image;
      try{image=child.contentDocument?.querySelector('#cdu-stage img.base');}catch(_){}
      if(image&&image.complete&&image.naturalWidth>0){
       try{await image.decode();}catch(_){image=null;}
       if(current!==generation||!child.isConnected)return;
       if(image&&image.complete&&image.naturalWidth>0&&image===child.contentDocument?.querySelector('#cdu-stage img.base')){
        child.style.visibility='';preview?.remove();station.removeAttribute('data-visual-shell');
        station.dataset.cduPhysicalReady='true';return;
       }
      }
      window.setTimeout(handoff,100);
     };
     handoff();
    });
   }`);

 // Every station has its own permanent, correctly registered unlit face.
 // Keep it underneath the child, independent of power, load and crew role.
 patch(app,"frameWindow.className='cdu-frame-window';frameWindow.append(child);station.append(frameWindow);",`frameWindow.className='cdu-frame-window';const physical=document.createElement('img');physical.className='cdu-permanent-face';physical.alt='';physical.setAttribute('aria-hidden','true');physical.src='/${local.url}';physical.draggable=false;Object.assign(physical.style,{position:'absolute',pointerEvents:'none',width:item.nativeWidth+'px',height:item.nativeHeight+'px',left:placement.left+'px',top:placement.top+'px',transform:'scale('+placement.scaleX+','+placement.scaleY+')',transformOrigin:'0 0'});frameWindow.append(physical,child);station.dataset.cduPhysicalFallback='true';station.append(frameWindow);`);
 // Remove the obsolete full-face optical blackout. Retain the independent
 // live engine channel/CB logic; blank only luminous pointers and glyphs.
 const glass=root+'desktop-bundle-02bd2b77b2f6ae57.js';
 patch(glass,"if(absent!==last){last=absent;if(layer)layer.dataset.unpowered=String(absent);}","if(absent!==last){last=absent;document.documentElement.dataset.eisAllFeedsAbsent=String(absent);if(layer)layer.dataset.unpowered=String(absent);}");
 const skin=root+'style.css';
 patch(skin,'.cdu-frame-window{position:absolute;inset:0;overflow:hidden}',`.cdu-frame-window{position:absolute;inset:0;overflow:hidden}
 .cdu-station[data-cdu-physical-fallback="true"]:not(.ready)::after{display:none!important}
 #eisColdDarkGlassV1{display:none!important}
 html[data-eis-all-feeds-absent="true"] #region-main .isn-engine-gauges [data-gauge]{display:none!important}
 #region-main [data-eis-readout][data-engine-live-status="POWER_LOSS"],#region-main [data-eis-readout][data-engine-live-status="UNIT_FAILED"],html[data-eis-all-feeds-absent="true"] #region-main [data-eis-readout]{visibility:visible!important}
 #region-main [data-eis-readout][data-engine-live-status="POWER_LOSS"] [data-eis-digit-cell],#region-main [data-eis-readout][data-engine-live-status="UNIT_FAILED"] [data-eis-digit-cell],html[data-eis-all-feeds-absent="true"] #region-main [data-eis-readout] [data-eis-digit-cell]{display:none!important}
 #region-main [data-eis-readout][data-engine-live-status="POWER_LOSS"] rect[data-eis-display-face],#region-main [data-eis-readout][data-engine-live-status="POWER_LOSS"] rect[data-eis-tall-window],#region-main [data-eis-readout][data-engine-live-status="UNIT_FAILED"] rect[data-eis-display-face],#region-main [data-eis-readout][data-engine-live-status="UNIT_FAILED"] rect[data-eis-tall-window],html[data-eis-all-feeds-absent="true"] #region-main [data-eis-readout] rect[data-eis-display-face],html[data-eis-all-feeds-absent="true"] #region-main [data-eis-readout] rect[data-eis-tall-window]{fill-opacity:1!important}
 `);
 // Use the verified, same-photo local texture immediately. No dependency on
 // an upstream original fetch for first paint; preserve all native geometry.
 patch(root+'cdu-stage.html','<img class="base" src="assets/cdu-approved-unlit.png"','<img class="base" src="/'+local.url+'"');
 const welcome=root+'unified-welcome-v1.js';
 patch(welcome,'    if (stable && startRequested) beginFlight(now);',`    // The scenario can prepare early; reveal only once all photographs,
    // both CDU faces and subsystem readiness are simultaneously confirmed.
    if (stable && startRequested && (!scenarioStarted || (panelComplete && physicalCduReady()))) beginFlight(now);`);
 patch(welcome,'  function releaseSystems() {',`  function physicalCduReady(){
    if(win.B737UnifiedNoCduTest)return true;
    return ['CAPT','FO'].every(seat=>{
      const frame=by('cduFrame'+seat);
      if(!frame||frame.style.visibility==='hidden')return false;
      try{return imagesReady(frame.contentDocument,'#cdu-stage img.base');}catch(_){return false;}
    });
  }

  function releaseSystems() {`);
 patch(welcome,'if (gate?.canEnter === true && priorityReady) {','if (gate?.canEnter === true && priorityReady && (!scenarioStarted || (panelComplete && physicalCduReady()))) {');
 patch(welcome,"if (full?.cdu !== true) labels.push('Preparing Captain and First Officer CDU…');","if (full?.cdu !== true || !physicalCduReady()) labels.push('Preparing Captain and First Officer CDU…');");
 // Shared timed training runtime: derive from verified packaged sources.
 for(const [relative,from,to] of [["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","activeScenario.config?.preset !== 'FINAL_10' || activeScenario.ready === true),","(activeScenario.config?.preset !== 'FINAL_10'&&!activeScenario.config?.trainingId) || activeScenario.ready === true || activeScenario.started===true),\n    loadTimed:async config=>{if(!online||!['captain','firstOfficer','instructor'].includes(role))throw Error('CREW ROOM NOT CONNECTED');if(pendingScenario)throw Error('SCENARIO ALREADY LOADING');pendingScenario=true;try{return await send('command',{requestId:client+'-'+(++requestSerial).toString(36),command:{type:'loadFlight',id:'flight',value:config}});}catch(e){pendingScenario=false;throw e;}},"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","activeScenario.config?.preset !== 'FINAL_10' || activeScenario.ready === true),","(activeScenario.config?.preset !== 'FINAL_10'&&!activeScenario.config?.trainingId) || activeScenario.ready === true || activeScenario.started===true),\n    loadTimed:async config=>{if(!online||!['captain','firstOfficer','instructor'].includes(role))throw Error('CREW ROOM NOT CONNECTED');if(pendingScenario)throw Error('SCENARIO ALREADY LOADING');pendingScenario=true;try{return await send('command',{requestId:client+'-'+(++requestSerial).toString(36),command:{type:'loadFlight',id:'flight',value:config}});}catch(e){pendingScenario=false;throw e;}},"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","if(entry.type==='engineFailure')return !!win.B737ISNCockpitV1?.injectFlightEngineFailure;","if(entry.type==='engineFailure')return !!win.B737ISNCockpitV1?.injectFlightEngineFailure;\n    if(entry.type==='timedFailure')return entry.id==='rapid'?!!win.B737UnifiedInstructorNonNormalV1?.armRapid:!!win.B737ISNCockpitV1?.injectFlightEngineFailure;"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","if(entry.type==='engineFailure')return !!win.B737ISNCockpitV1?.injectFlightEngineFailure;","if(entry.type==='engineFailure')return !!win.B737ISNCockpitV1?.injectFlightEngineFailure;\n    if(entry.type==='timedFailure')return entry.id==='rapid'?!!win.B737UnifiedInstructorNonNormalV1?.armRapid:!!win.B737ISNCockpitV1?.injectFlightEngineFailure;"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","case 'loadFlight': flight().loadScenario(value,{crewReplay:true}); scenarioGeneration=Math.max(scenarioGeneration,entry.sequence??0); break;","case 'loadFlight': {const st=flight().loadScenario(value,{crewReplay:true});if(value.trainingId==='RAPID_DECOMPRESSION'){if(!win.B737PoweredGeneralPresetsV1?.applyCruise)throw Error('Cruise owner unavailable');win.B737PoweredGeneralPresetsV1.applyCruise(st);}scenarioGeneration=Math.max(scenarioGeneration,entry.sequence??0);pendingScenario=false;break;}"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","case 'loadFlight': flight().loadScenario(value,{crewReplay:true}); scenarioGeneration=Math.max(scenarioGeneration,entry.sequence??0); break;","case 'loadFlight': {const st=flight().loadScenario(value,{crewReplay:true});if(value.trainingId==='RAPID_DECOMPRESSION'){if(!win.B737PoweredGeneralPresetsV1?.applyCruise)throw Error('Cruise owner unavailable');win.B737PoweredGeneralPresetsV1.applyCruise(st);}scenarioGeneration=Math.max(scenarioGeneration,entry.sequence??0);pendingScenario=false;break;}"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","      case 'engineFailure': {","      case 'timedFailure': {\n        if(entry.generation!==scenarioGeneration)return entry.generation<scenarioGeneration;\n        if(id==='rapid'){\n          if(win.B737UnifiedInstructorNonNormalV1?.pressureState?.()?.rapid===true)return true;\n          return !!win.B737UnifiedInstructorNonNormalV1.armRapid(value,entry.elapsedSec);\n        }\n        const owner=win.B737ISNCockpitV1,type=['PERSISTING','CONTROLLABLE'].includes(value)?'FIRE':value;\n        if(owner.getPropulsionSnapshot?.()?.engines?.[id]?.flightFailure===type)return true;\n        return owner.injectFlightEngineFailure({engine:id,type,persisting:value==='PERSISTING'})?.accepted===true;\n      }\n      case 'engineFailure': {"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","      case 'engineFailure': {","      case 'timedFailure': {\n        if(entry.generation!==scenarioGeneration)return entry.generation<scenarioGeneration;\n        if(id==='rapid'){\n          if(win.B737UnifiedInstructorNonNormalV1?.pressureState?.()?.rapid===true)return true;\n          return !!win.B737UnifiedInstructorNonNormalV1.armRapid(value,entry.elapsedSec);\n        }\n        const owner=win.B737ISNCockpitV1,type=['PERSISTING','CONTROLLABLE'].includes(value)?'FIRE':value;\n        if(owner.getPropulsionSnapshot?.()?.engines?.[id]?.flightFailure===type)return true;\n        return owner.injectFlightEngineFailure({engine:id,type,persisting:value==='PERSISTING'})?.accepted===true;\n      }\n      case 'engineFailure': {"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","!activeScenario?.active || activeScenario.config?.preset !== 'FINAL_10' || scenarioGeneration!==activeScenario.generation) return;","!activeScenario?.active || (activeScenario.config?.preset !== 'FINAL_10'&&!activeScenario.config?.trainingId) || activeScenario.started || scenarioGeneration!==activeScenario.generation) return;"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","!activeScenario?.active || activeScenario.config?.preset !== 'FINAL_10' || scenarioGeneration!==activeScenario.generation) return;","!activeScenario?.active || (activeScenario.config?.preset !== 'FINAL_10'&&!activeScenario.config?.trainingId) || activeScenario.started || scenarioGeneration!==activeScenario.generation) return;"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","    const check=matching?win.B737Final10ApproachPresetV1?.getStatus?.():null;\n    const missing=matching && check && Array.isArray(check.missing) ?\n      check.missing.slice(0,64) : ['SCENARIO_OWNER_NOT_READY'];\n    const complete=matching && check?.complete===true && missing.length===0;","    const final=config.preset==='FINAL_10';\n    const check=matching?(final?win.B737Final10ApproachPresetV1?.getStatus?.():win.B737PoweredGeneralPresetsV1?.getStatus?.()):null;\n    const complete=!!(matching&&check&&(final?check.complete===true:check.settled===true&&check.coreReady===true));\n    const missing=complete?[]:matching&&check&&Array.isArray(check.missing)&&check.missing.length?check.missing.slice(0,64):['SCENARIO_OWNER_NOT_READY'];"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","    const check=matching?win.B737Final10ApproachPresetV1?.getStatus?.():null;\n    const missing=matching && check && Array.isArray(check.missing) ?\n      check.missing.slice(0,64) : ['SCENARIO_OWNER_NOT_READY'];\n    const complete=matching && check?.complete===true && missing.length===0;","    const final=config.preset==='FINAL_10';\n    const check=matching?(final?win.B737Final10ApproachPresetV1?.getStatus?.():win.B737PoweredGeneralPresetsV1?.getStatus?.()):null;\n    const complete=!!(matching&&check&&(final?check.complete===true:check.settled===true&&check.coreReady===true));\n    const missing=complete?[]:matching&&check&&Array.isArray(check.missing)&&check.missing.length?check.missing.slice(0,64):['SCENARIO_OWNER_NOT_READY'];"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","if (entry.client === client && entry.type!=='clock') {","if (entry.client === client && entry.type!=='clock' && !(entry.type==='loadFlight'&&entry.value?.trainingId)) {"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","if (entry.client === client && entry.type!=='clock') {","if (entry.client === client && entry.type!=='clock' && !(entry.type==='loadFlight'&&entry.value?.trainingId)) {"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","'mcpMode','mcpValue','mcpHardware','trim','frequency','navMode','commTransfer','engineFailure'].includes(queue[n].type)","'mcpMode','mcpValue','mcpHardware','trim','frequency','navMode','commTransfer','engineFailure','timedFailure'].includes(queue[n].type)"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","'mcpMode','mcpValue','mcpHardware','trim','frequency','navMode','commTransfer','engineFailure'].includes(queue[n].type)","'mcpMode','mcpValue','mcpHardware','trim','frequency','navMode','commTransfer','engineFailure','timedFailure'].includes(queue[n].type)"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","send('flight', {state, paused: flight().getDiagnostics().paused})","send('flight', {state, paused: flight().getDiagnostics().paused,generation:scenarioGeneration})"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","send('flight', {state, paused: flight().getDiagnostics().paused})","send('flight', {state, paused: flight().getDiagnostics().paused,generation:scenarioGeneration})"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","    const phase = activeScenario?.config?.preset === 'FINAL_10' ?","    const phase = activeScenario?.config?.trainingId ? (activeScenario.triggered?' · FAILURE ACTIVE':activeScenario.started?' · SCENARIO RUNNING':activeScenario.ready?' · SCENARIO READY (CPT+FO)':' · SCENARIO PREPARING (CPT/FO)') : activeScenario?.config?.preset === 'FINAL_10' ?"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","    const phase = activeScenario?.config?.preset === 'FINAL_10' ?","    const phase = activeScenario?.config?.trainingId ? (activeScenario.triggered?' · FAILURE ACTIVE':activeScenario.started?' · SCENARIO RUNNING':activeScenario.ready?' · SCENARIO READY (CPT+FO)':' · SCENARIO PREPARING (CPT/FO)') : activeScenario?.config?.preset === 'FINAL_10' ?"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","    const update = latestFlight;\n    latestFlight = null;","    const update = latestFlight;\n    latestFlight = null;\n    if(activeScenario?.config?.trainingId&&update.generation!==scenarioGeneration)return;"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","    const update = latestFlight;\n    latestFlight = null;","    const update = latestFlight;\n    latestFlight = null;\n    if(activeScenario?.config?.trainingId&&update.generation!==scenarioGeneration)return;"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","if(entry.type==='loadFlight'){\n          lastReceivedOverhead=null;lastPublishedOverhead=null;latestFlight=null;","if(entry.type==='loadFlight'){\n          lastReceivedOverhead=null;lastPublishedOverhead=null;latestFlight=null;lastFlightPacket=null;lastFlightAt=0;"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","if(entry.type==='loadFlight'){\n          lastReceivedOverhead=null;lastPublishedOverhead=null;latestFlight=null;","if(entry.type==='loadFlight'){\n          lastReceivedOverhead=null;lastPublishedOverhead=null;latestFlight=null;lastFlightPacket=null;lastFlightAt=0;"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js"," function armRapid(type){"," function armRapid(type,sharedStartElapsed){"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","  renderNeeded=true;reportPressure();return pressureState();\n }\n function readRapidManual","  if(Number.isFinite(sharedStartElapsed))pressure.sharedStartElapsed=sharedStartElapsed;\n  renderNeeded=true;reportPressure();return pressureState();\n }\n function readRapidManual"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","  if(pressure){if(!pressure.rapid||!root.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.paused)stepPressure(elapsed);reportPressure();}","  if(pressure){if(!pressure.rapid||!root.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.paused){const t=root.B737UnifiedFlightScenarioV1?.getState?.()?.elapsedSec;const dt=Number.isFinite(pressure.sharedStartElapsed)&&Number.isFinite(t)?Math.max(0,t-pressure.sharedStartElapsed-pressure.elapsedSec):elapsed;if(dt>0)stepPressure(dt);}reportPressure();}"],["engine/afds/desktop-bundle-041e2850eaa0172a.js","if(pause&&state.preset==='FINAL_10'&&win.B737CrewScenarioReadyV1?.canStart?.()===false)","if(pause&&win.B737CrewScenarioReadyV1?.canStart?.()===false)"],["engine/afds/desktop-bundle-041e2850eaa0172a.js","status('PRIVATE ROOM NOT READY · Captain and FO must verify FINAL_10 systems.',true);","status('PRIVATE ROOM NOT READY · Captain and FO must verify cockpit systems.',true);"],["engine/afds/desktop-bundle-041e2850eaa0172a.js","pauseButton.disabled=!state||(pause&&state?.preset==='FINAL_10'&&win.B737CrewScenarioReadyV1?.canStart?.()===false)","pauseButton.disabled=!state||(pause&&win.B737CrewScenarioReadyV1?.canStart?.()===false)"],["engine/afds/desktop-bundle-041e2850eaa0172a.js","sceneToggle.disabled=!state||!active||(pause&&state?.preset==='FINAL_10'&&win.B737CrewScenarioReadyV1?.canStart?.()===false)","sceneToggle.disabled=!state||!active||(pause&&win.B737CrewScenarioReadyV1?.canStart?.()===false)"],["panel-mosaic-lab/cockpit/index.html"," if(crew())throw Error('TIMED SCENARIOS REQUIRE STANDALONE; USE LIVE FAILURE IN THE INSTRUCTOR SEAT');\n if(!type)throw Error('SELECT FAILURE TYPE');\n const airport=by('flightAirport').value,runway=by('flightRunway').value;"," if(!type)throw Error('SELECT FAILURE TYPE');\n const airport=by('flightAirport').value,runway=by('flightRunway').value;\n if(crew()){\n  const preset=id==='ENGINE_FAILURE_FINAL'?'FINAL_10':id==='RAPID_DECOMPRESSION'?'MANUAL':'READY_FOR_TAKEOFF';\n  const cfg={airport,runway,preset,airborne:preset!=='READY_FOR_TAKEOFF',holdStart:true,trainingId:id,trainingType:type,...(id==='RAPID_DECOMPRESSION'?{altitudeFt:30000,headingDeg:90,speedKt:279,vsFpm:0}:{})};\n  if(!win.B737CrewScenarioReadyV1?.loadTimed)throw Error('CREW SCENARIO OWNER NOT READY');\n  await win.B737CrewScenarioReadyV1.loadTimed(cfg);return;\n }"],["panel-mosaic-lab/cockpit/index.html","  apply.disabled=id!=='NONE'&&(!selectedType(id)||!catalog.supported.includes(id)||crew());\n  if(id!=='NONE'&&crew())status('Timed scenarios are standalone only. Instructor: use Live Failure for the current flight.');","  apply.disabled=(crew()&&doc.documentElement.dataset.crewRole==='observer')||(id!=='NONE'&&(!selectedType(id)||!catalog.supported.includes(id)));\n  if(id!=='NONE'&&crew()&&catalog.supported.includes(id))status('Shared scenario · both cockpits prepare before START.');"],["panel-mosaic-lab/cockpit/index.html","status('SCENARIO LOADED');dialog.close();","status(crew()&&id!=='NONE'?'SHARED SCENARIO REQUESTED':'SCENARIO LOADED');dialog.close();"],["panel-mosaic-lab/cockpit/index.html","CREW-LIVE-FAILURE-20261128","CREW-TIMED-SCENARIOS-20261128"],["panel-mosaic-lab/cockpit/index.html","FLT-PHASE-WELCOME-PARITY-20261128","FLT-PHASE-CREW-TIMED-20261128"]])patch(relative,from,to);
 // CDU temperature presentation and bounded training-only SEL TEMP policy.
 for(const [relative,from,to] of [["cdu-standalone-v6/engine/cdu-engine.js","const temp=v=>Number.isFinite(v)?(v>=0?'+':'')+v+'°C':'----';","const temp=v=>Number.isFinite(v)?(Math.round(v)>=0?'+':'')+Math.round(v)+'°C':'----';"],["cdu-standalone-v6/engine/cdu-engine.js","if(!input){if(x.sel!==null||x.oat!==null){s.scratch=(x.sel??'')+'/'+(x.oat??'');s.message='';}else inactive();return;}","if(!input){const actual=x.oat??globalThis.CDU_TAKEOFF_OAT?.();if(x.sel!==null||Number.isFinite(actual)){s.scratch=(x.sel??'')+'/'+(Number.isFinite(actual)?Math.round(actual):'');s.message='';}else inactive();return;}"],["cdu-standalone-v6/engine/cdu-engine.js"," if(st.page==='N1_LIMIT'){n1Enter(st,pages,key);return;}"," if(st.page==='N1_LIMIT'){n1Enter(st,pages,key);return;}\n if(st.page==='TAKEOFF'&&['L1','L2'].includes(key)&&st.fmcOnGroundVerified!==false){\n  const x=n1Selection(st),input=clean(st.scratch),oat=x.oat??globalThis.CDU_TAKEOFF_OAT?.();\n  if(!input){const n=key==='L1'?oat:x.sel;if(Number.isFinite(n)){st.scratch=String(Math.round(n));st.message='';}else addMessage(st,'KEY INACTIVE');return;}\n  if(input==='DELETE'&&key==='L1'){perfStore(st,{OAT:''});return;}\n  if(input==='DELETE'&&key==='L2'){perfStore(st,{SEL_TEMP:''});return;}\n  if(input.includes('/')){addMessage(st,'INVALID ENTRY');return;}\n  if(key==='L1')st.scratch='/'+input;\n  n1Enter(st,pages,'L1');return;\n }"],["cdu-standalone-v6/app.js","window.CDU_VALIDATE_TAKEOFF_N1=evaluateTakeoffN1;","window.CDU_VALIDATE_TAKEOFF_N1=evaluateTakeoffN1;\nwindow.CDU_TAKEOFF_OAT=()=>{const e=window.parent.B737PerformanceEngineV07;const x=core.n1Selection(state);return x.oat??e?.takeoffContext?.(core.readValue(state,'ORIGIN','RTE'))?.oatC??null;};"],["cdu-standalone-v6/app.js","if(mode==='TO'&&Number.isFinite(selected.sel))mode='R-TO';","if(mode==='TO'&&Number.isFinite(selected.sel)&&!r.noThrustReduction)mode='R-TO';"],["cdu-standalone-v6/app.js","if(n1&&state.page==='TAKEOFF'&&row===3){labelL=n1.mode+' N1';valueL=n1.maxN1Pct.toFixed(1)+'%';}","if(state.page==='TAKEOFF'){\n    const x=core.n1Selection(state),v=row===1?window.CDU_TAKEOFF_OAT():row===2?x.sel:null;\n    if(row===1||row===2)valueL=Number.isFinite(v)?(Math.round(v)>=0?'+':'')+Math.round(v)+'°C':'----';\n    if(row===3&&n1){labelL=(n1.estimated?'SIM ':'')+(n1.noThrustReduction?'TO':n1.phase||'TO')+' N1';valueL=n1.maxN1Pct.toFixed(1)+'%';}\n   }"],["engine/performance/performance-engine-v07.js","if(assumedC<min||assumedC>max){const e=Error('ASSUMED_TEMP_OUTSIDE_ENVELOPE');e.details=assumedTemperatureEnvelope;throw e;}","if(assumedC>max){const e=Error('ASSUMED_TEMP_OUTSIDE_ENVELOPE');e.details=assumedTemperatureEnvelope;throw e;}\n     // Training entry below the extracted minimum is accepted without thrust reduction.\n     // Never extrapolate reduced-thrust tables or imply operational approval.\n     if(assumedC<min){const full=n1({...input,mode:'TO',assumedC:null});return {...full,source:'SIM_BELOW_MIN_FULL_RATED',estimated:true,noThrustReduction:true,trainingOnly:true,assumedTemperatureEnvelope,selectedTemperatureC:assumedC,quality:[...new Set([...full.quality,'TRAINING_INPUT_ONLY'])]};}"],["engine/performance/performance-engine-v07.js","mode:sel===null?'TO':'R-TO',rating,derate,referencePct:full.n1Pct","mode:sel===null||reduced.noThrustReduction?'TO':'R-TO',rating,derate,referencePct:full.n1Pct"]])patch(relative,from,to);
 // No automatic IRS position injection from FLT PHASE.
 patch("engine/afds/desktop-bundle-041e2850eaa0172a.js","  if(!pending||busy)return;","  // Location is simulator truth, not a crew SET IRS POS command.\n  pending=null;lastResult={status:'MANUAL_POSITION_ENTRY_REQUIRED'};return;");
 // IRS shutdown and inadvertent OFF training interlock.
 for(const [relative,from,to] of [["engine/systems/irs-trainer-web-v1.js","function begin(u,config,mode){","function begin(u,config,mode){\n u.offCycleRequired=false;"],["engine/systems/irs-trainer-web-v1.js","if(cmd.mode==='OFF'){u.mode='OFF';u.valid=false;u.phase=u.powered?'SHUTDOWN':'OFF';u.alignmentElapsedSec=0;emit(s,u.id,u.powered?'SHUTDOWN':'OFF');break;}","if(cmd.mode==='OFF'){\n      const previous=u.phase;\n      u.mode='OFF';u.valid=false;u.offCycleRequired=false;\n      // Repeated OFF is idempotent; do not restart the shutdown clock.\n      if(previous==='SHUTDOWN')break;\n      if(u.position&&u.initialized)u.lastStoredPosition={...u.position};\n      Object.assign(u,{initialized:false,enteredPosition:null,entrySource:null,entryPending:{lat:null,lon:null},position:null,basePosition:null,groundSpeedKt:null,trueTrackDeg:null,trueHeadingDeg:null,altitudeFt:null,windFromDeg:null,windKt:null,alignmentElapsedSec:0,powerTestElapsedSec:0,lastWarning:null,alignFault:null});\n      clearAlignmentBlock(u);\n      u.phase=u.powered&&!['OFF','OFF_REQUIRED'].includes(previous)?'SHUTDOWN':'OFF';\n      emit(s,u.id,u.phase);break;\n     }"],["engine/systems/irs-trainer-web-v1.js","    if(!u.powered)throw new Error('IRS requires power for mode selection');","    if(!u.powered)throw new Error('IRS requires power for mode selection');\n    // Conservative training interlock: physical selection is recorded, but\n    // an interrupted shutdown cannot restore NAV or begin alignment.\n    if(u.phase==='SHUTDOWN'||u.phase==='OFF_REQUIRED'||u.offCycleRequired){u.mode=cmd.mode;u.offCycleRequired=true;u.lastWarning='COMPLETE OFF SHUTDOWN';emit(s,u.id,'OFF_CYCLE_REQUIRED');break;}\n    if(u.phase==='ATT'&&cmd.mode!=='ATT'){u.mode=cmd.mode;u.phase='ATT_OFF_REQUIRED';u.valid=false;u.offCycleRequired=true;u.lastWarning='SELECT OFF FIRST';emit(s,u.id,'OFF_CYCLE_REQUIRED');break;}"],["engine/systems/irs-trainer-web-v1.js","if(u.mode==='NAV'||u.mode==='ALIGN'){\n        begin(u,s.config,u.mode);","if(u.offCycleRequired&&u.mode!=='OFF'){\n        u.phase='OFF_REQUIRED';u.valid=false;u.lastWarning='SELECT OFF FIRST';\n      }else if(u.mode==='NAV'||u.mode==='ALIGN'){\n        begin(u,s.config,u.mode);"],["engine/systems/irs-trainer-web-v1.js","if(u.alignmentElapsedSec>=CAL.shutdownSeconds){u.phase='OFF';u.position=null;u.valid=false;}","if(u.alignmentElapsedSec>=CAL.shutdownSeconds){u.phase=u.mode==='OFF'?'OFF':'OFF_REQUIRED';u.offCycleRequired=u.mode!=='OFF';u.position=null;u.valid=false;u.initialized=false;u.enteredPosition=null;u.entrySource=null;u.lastWarning=u.offCycleRequired?'SELECT OFF FIRST':null;emit(s,u.id,'SHUTDOWN_COMPLETE');}"],["engine/systems/irs-trainer-web-v1.js","trainingAlignmentReference,parseCoordinate","trainingAlignmentReference,isTrainingAlignmentReference:p=>p?.[FULL_ALIGN_REFERENCE]!==undefined,parseCoordinate"],["panel-mosaic-lab/cockpit/irs-trainer-unified-v1.js"," const eligible=SIDES.filter(x=>state.units[x].powered&&['SELFTEST','ALIGNING','ALIGN_READY','WAIT_POSITION','HIGH_LAT_READY','FAST_REALIGN'].includes(state.units[x].phase));"," const prepared=Core.isTrainingAlignmentReference(originPosition);\n const eligible=SIDES.filter(x=>state.units[x].powered&&(prepared?state.units[x].mode==='NAV':['SELFTEST','ALIGNING','ALIGN_READY','WAIT_POSITION','HIGH_LAT_READY','FAST_REALIGN'].includes(state.units[x].phase)));"],["panel-mosaic-lab/cockpit/irs-trainer-unified-v1.js"," state=Core.apply(state,{type:'SELECT_MODE',side,mode:value});\n update();return get(side);"," state=Core.apply(state,{type:'SELECT_MODE',side,mode:value});\n if(value==='OFF'&&side===selected){keys={lat:'',lon:'',stage:'LAT',enteredLat:false,heading:''};root.B737ISDUCues?.setCue('ENT',false);root.B737ISDUCues?.setCue('CLR',false);}\n update();return get(side);"]])patch(relative,from,to);
 // Route existing physical recessed stall test caps to approved shaker audio; remove legacy overlay.
 for(const [relative,from,to] of [["panel-mosaic-lab/cockpit/desktop-bundle-cb665f3fa7900b08.js","(function(root){'use strict';\n if(!root?.document||root.parent===root)return;\n const parent=root.parent,origin=root.location.origin;\n const active={1:false,2:false};\n const send=(ch,pressed)=>{\n  if(active[ch]===pressed)return;\n  active[ch]=pressed;\n  parent.postMessage({type:'b737:cockpit-overhead',kind:'stick-shaker-test',channel:ch,\n    pressed,source:'AFT_OH06_STALL_WARN_TEST',trainingRegistration:true},origin);\n };\n function button(ch){\n  const btn=root.document.createElement('button');\n  btn.id='aftOhStallTest'+ch;\n  btn.type='button';\n  btn.dataset.control='stall-warning-test-'+ch;\n  btn.setAttribute('aria-label','AFT OVERHEAD · STALL WARNING TEST '+ch);\n  btn.textContent='STALL TEST '+ch;\n  btn.title='Momentary stall warning test '+ch+' — ground/115V AC';\n  btn.style.cssText='position:absolute;top:63%;left:'+(ch===1?'82%':'90%')+\n   ';width:7%;min-width:0;height:5.8%;min-height:22px;border:3px solid #8e969c;'+\n   'border-radius:14px;background:linear-gradient(#404e58,#18242d);color:#f2f6fc;'+\n   'font:700 12px Arial,sans-serif;letter-spacing:.4px;cursor:pointer;'+\n   'z-index:40;touch-action:none;user-select:none;box-shadow:0 2px 7px #000a';\n  let down=false;\n  const release=()=>{if(!down)return;down=false;btn.style.background='linear-gradient(#404e58,#18242d)';send(ch,false)};\n  btn.addEventListener('pointerdown',e=>{\n   if(e.pointerType==='mouse'&&e.button!==0)return;\n   e.stopPropagation();down=true;btn.style.background='#718c9e';send(ch,true);\n   try{btn.setPointerCapture(e.pointerId)}catch(_){}\n  });\n  for(const type of ['pointerup','pointercancel','lostpointercapture'])btn.addEventListener(type,e=>{e.stopPropagation();release()});\n  btn.addEventListener('click',e=>e.stopPropagation());\n  btn.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.repeat){e.preventDefault();down=true;send(ch,true)}});\n  btn.addEventListener('keyup',e=>{if(e.key==='Enter'||e.key===' ')release()});\n  btn.addEventListener('blur',release);\n  return btn;\n }\n let installed=false,obs=null;\n function mount(){\n  if(installed)return true;\n  const photo=root.document.querySelector('#atlasAbsolute .atlas-piece[data-key=\"UPPER\"]');\n  if(!photo)return false;\n  photo.append(button(1),button(2));\n  installed=true;\n  if(obs){obs.disconnect();obs=null;}\n  return true;\n }\n const abort=()=>{send(1,false);send(2,false)};\n root.addEventListener('blur',abort);\n root.addEventListener('pagehide',abort);\n root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden)abort()});\n if(!mount()){\n  const rootNode=root.document.getElementById('atlasAbsolute')||root.document.body;\n  obs=new MutationObserver(()=>mount());\n  obs.observe(rootNode,{childList:true,subtree:true});\n }\n root.B737AftOverheadStallTestV1=Object.freeze({getState:()=>({...active}),mount});\n})(typeof window==='object'?window:null);","(function(root){'use strict';\n if(!root?.document||root.parent===root)return;\n const parent=root.parent,origin=root.location.origin,active={1:false,2:false};\n const channels={'stall-warning-1':1,'stall-warning-2':2};\n const send=(ch,pressed)=>{\n  if(active[ch]===pressed)return;\n  active[ch]=pressed;\n  parent.postMessage({type:'b737:cockpit-overhead',kind:'stick-shaker-test',channel:ch,\n   pressed,source:'AFT_OH06_RECESSED_STALL_WARN_TEST',trainingRegistration:true},origin);\n };\n // Existing photo-registered recessed cap owns pointer and keyboard events.\n // Never mount an additional visual control or duplicate click listener.\n root.addEventListener('b737:recessed-button',e=>{\n  const d=e.detail,ch=channels[d?.id];\n  if(ch&&typeof d.pressed==='boolean'&&d.source==='recessed-hardware-v2')send(ch,d.pressed);\n });\n const abort=()=>{send(1,false);send(2,false);};\n root.addEventListener('blur',abort);\n root.addEventListener('pagehide',abort);\n root.document.addEventListener('visibilitychange',()=>{if(root.document.hidden)abort();});\n root.B737AftOverheadStallTestV1=Object.freeze({getState:()=>({...active}),mount:()=>true});\n})(typeof window==='object'?window:null);"],["panel-mosaic-lab/cockpit/desktop-bundle-6dfd1ac03dc1e4ba.js","if(item.id==='aircon-ovht-test')nativeAirconReleases.set(item.id,()=>set(false));","if(['aircon-ovht-test','stall-warning-1','stall-warning-2'].includes(item.id))nativeAirconReleases.set(item.id,()=>set(false));"],["panel-mosaic-lab/cockpit/desktop-bundle-6dfd1ac03dc1e4ba.js","const releaseAircon=()=>nativeAirconReleases.get('aircon-ovht-test')?.();","const releaseAircon=()=>{for(const release of nativeAirconReleases.values())release();};"],["panel-mosaic-lab/cockpit/desktop-bundle-80ca1e7d3efede04.js","  if(!doc||doc===boundOverhead)return false;\n  boundOverhead=doc;","  if(!doc||doc===boundOverhead)return false;\n  press(1,false);press(2,false);\n  boundOverhead=doc;"]])patch(relative,from,to);
 // Brake physics, measured N1 acceleration, and owner-sample common horn.
 for(const [relative,from,to] of [["panel-mosaic-lab/cockpit/desktop-bundle-e4da0a11b25f3c4b.js","function step(state,dtSeconds,propulsion=null){","function step(state,dtSeconds,propulsion=null,controls={}){"],["panel-mosaic-lab/cockpit/desktop-bundle-e4da0a11b25f3c4b.js","  if(groundRoll&&observed){","  const brakeSet=controls.parkingBrakeSet===true;\n  s.parkingBrakeSet=brakeSet;\n  if(!s.airborne&&brakeSet){\n   // Explicit stationary training brake constraint. Moving aircraft decelerates, no instant teleport.\n   s.iasKt=Math.max(0,s.iasKt-5*dt);s.propulsion={source:'PARKING_BRAKE_TRAINING_CONSTRAINT',accelerationKtSec:(s.iasKt-state.iasKt)/dt};\n  }else if(groundRoll&&observed){"],["panel-mosaic-lab/cockpit/desktop-bundle-e4da0a11b25f3c4b.js","   const resistanceKtSec=.12+.000025*s.iasKt*s.iasKt;\n   const accelerationKtSec=4.1*normalizedThrust-resistanceKtSec;","   const resistanceKtSec=.12+.000018*s.iasKt*s.iasKt;\n   const massFactor=clamp(55000/(Number.isFinite(s.massKg)?s.massKg:55000),.73,1.35);\n   const accelerationKtSec=5.8*massFactor*normalizedThrust-resistanceKtSec;"],["panel-mosaic-lab/cockpit/desktop-bundle-e4da0a11b25f3c4b.js","const accelerationKtSec=clamp((n1Equivalent-requiredN1)*.065,-2,1.8);","const massFactor=clamp(55000/(Number.isFinite(s.massKg)?s.massKg:55000),.73,1.35);\n   const accelerationKtSec=clamp((n1Equivalent-requiredN1)*.085*massFactor,-2.5,2.4);"],["panel-mosaic-lab/cockpit/desktop-bundle-e4da0a11b25f3c4b.js","if(s.iasKt>=s.rotationSpeedKt&&s.pitchDeg>=8){","if(!brakeSet&&s.iasKt>=s.rotationSpeedKt&&s.pitchDeg>=8){"],["panel-mosaic-lab/cockpit/desktop-bundle-e4da0a11b25f3c4b.js","  s.gsKt=Math.max(0,Math.hypot(speedEast,speedNorth));","  s.gsKt=!s.airborne&&s.iasKt<=.001?0:Math.max(0,Math.hypot(speedEast,speedNorth));"],["engine/afds/desktop-bundle-041e2850eaa0172a.js","Math.min(.3,Math.max(0,(now-lastTick)/1000))","Math.min(1,Math.max(0,(now-lastTick)/1000))"],["engine/afds/desktop-bundle-041e2850eaa0172a.js","const before=state;state=Core.step(state,step,propulsionObservation(now));","const before=state;state=Core.step(state,step,propulsionObservation(now),{parkingBrakeSet:win.B737UnifiedParkingBrakeV1?.getState?.()?.engaged===true});"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","    if (entry.type === 'speedbrake') return win.B737SpeedbrakeLever?.mounted();","    if(entry.type==='parkingBrake')return !!win.B737UnifiedParkingBrakeV1?.setEngaged;\n    if (entry.type === 'speedbrake') return win.B737SpeedbrakeLever?.mounted();"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","    if (entry.type === 'speedbrake') return win.B737SpeedbrakeLever?.mounted();","    if(entry.type==='parkingBrake')return !!win.B737UnifiedParkingBrakeV1?.setEngaged;\n    if (entry.type === 'speedbrake') return win.B737SpeedbrakeLever?.mounted();"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","      case 'speedbrake': win.B737SpeedbrakeLever.set(value); break;","      case 'parkingBrake': win.B737UnifiedParkingBrakeV1.setEngaged(value,'CREW_REPLAY'); break;\n      case 'speedbrake': win.B737SpeedbrakeLever.set(value); break;"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","      case 'speedbrake': win.B737SpeedbrakeLever.set(value); break;","      case 'parkingBrake': win.B737UnifiedParkingBrakeV1.setEngaged(value,'CREW_REPLAY'); break;\n      case 'speedbrake': win.B737SpeedbrakeLever.set(value); break;"],["panel-mosaic-lab/cockpit/crew-cockpit-v1.js","  listen(doc, 'b737:speedbrake-position', d => command('speedbrake', 'speedbrake', d.position));","  listen(win,'b737:parking-brake-state',d=>{if(d.source!=='CREW_REPLAY'&&d.source!=='AIRCRAFT_GENERAL_STATE')command('parkingBrake','parkingBrake',d.engaged);});\n  listen(doc, 'b737:speedbrake-position', d => command('speedbrake', 'speedbrake', d.position));"],["panel-mosaic-lab/cockpit/desktop-bundle-fa87fb95723b69b3.js","  listen(doc, 'b737:speedbrake-position', d => command('speedbrake', 'speedbrake', d.position));","  listen(win,'b737:parking-brake-state',d=>{if(d.source!=='CREW_REPLAY'&&d.source!=='AIRCRAFT_GENERAL_STATE')command('parkingBrake','parkingBrake',d.engaged);});\n  listen(doc, 'b737:speedbrake-position', d => command('speedbrake', 'speedbrake', d.position));"],["panel-mosaic-lab/cockpit/isn-cockpit.js","  if(document.hidden){render(live);return;}","  if(document.hidden){pendingTick=live;return;} // no hidden DOM paint; ECU simulation continues"],["panel-mosaic-lab/cockpit/index.html","</body></html>","<script id=\"unified-intermittent-horn-v1\">(function(w,d){'use strict';\n const base64=\"SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYxLjcuMTAzAAAAAAAAAAAAAAD/8yjEAA0I4pFBQRgAA1/4ALGPGMeAAKIifuf9dz0d+IhbiEGh+moEFgg79YIROfEZ+t4fw+XP8/+D44H3kP/+D6pDGUNVITP/8yjEBg2qLwQBgDgAPPqXN3RqnyWXm0L8xupzeJ2Uznn2pV79ez5+5WtEvSrza/n/3tKuVVexpb/9R3uZVQzOrGaInygBHjn/8yjECg9BKxMfymgA1JZJrYlO5bQFsFJrbHRSSVpGQWCXSMgSxc+Pgvpda/rRICXzA/rdo7f093/uyv/p/u/oRmdIXknIEbb/8yjECA7pJwryK9qKO0XPKmFxFcyf5LMAJPxfRi7ULMOL1mYSN6qoKeUauLgtv2/GV+c6Of0dOt+ns/X2fp/8gniZeL/tpU3/8yjEBw2ZRzr+E1SmOgNainFMduEmTiagvoWdARkBtcwKn3BtJ1Xg4J30/jX84t+W/V+t2j/08/+n9XIVAEZYkkfQDB/ayJj/8yjECw/C3wr0K0S+BjiBVEyAyAKzOjcXQ8MprG4LS3qEMq2oVDbr3/GV+Vt+e/b9f0/t+/6//7fiP1/X+n6/xgmqqlh2fXT/8yjEBw6RJ0seO87CktA+kds89QkF6eFha1er3PA+I4FdNRKb2EcWIjVCxN//xJ9VGr9Hfqf9TdH/lea/Rzv6FYmZiXP9rtf/8yjEBwzwezb+CMQuUADjaPjxxNVB6XQCN3CiRKASoaDs9CSBFr1gJ8eFTuzHhotBq3xF+REvt8q5BtjARIx2rlSWYYCFXaz/8yjEDgxYzpjKQMQ8NUDHjKYkiPr3L8pWhq2sNrSSM00IO2sOnfUHSybnZLHfb2UqSwUAoPEnoKBlAqM0xLCrAx4RRMXhpoj/8yjEFwxwdoAKGAaAA6+oiFDUMvrDdovLUBLWrdeizGEc9/9f+/+mBSkgAYQ/hKcFG3IzyiRC/i/y/z/J/ReFO5ZQ55q9YGH/8yjEIAzRonweCEbcRJIakiwwVCIBIwi064YeRCtP5KqQcRNZgUpwHzJUNlyq7DMDbQ3jbZITBqdYTLnl3FpEBI4uxhKhJEf/8yjEJwxowlQACYYEwkHUQn7zumr3HU2M1gpcVB1Sg92jAQaMDIOjVF/59VD7aUNejYbeWgZJYfWLiHpK72oUeiZ9aNWxHqX/8yjEMAvg7kAAGEaEcxzRoDCo4kMxm4naQQqBKLujyq6YMjI4KANbLVJFg8RM+pPWDWWpVKlfbeWs8kptNI5KNHEYBh3cBLz/8yjEOwuYiigAGEyIrPWSAzdVWcBU1X/jMfaxqq+oZB9gKgqe/q4K8Gj3/or+FXGlkUgU98i5DFrIDxURmQKDYqGQmKkTICH/8yjERwrhCgQAMIaMUiZGC/Uv8yLMSZCTwFUR2WSoZGrWo5GRrJSMjVrUMjJlBR0MmUMDBo5GrBQQJzICCQuZ///oCosSTEH/8yjEVgoYBggAAAAATUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/8yjEaArBKZwACAYMVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=\";\n let ctx=null,buffer=null,loading=null,voice=null,frame=null,cabin=null,cutout=false,last={},lastError=null;\n const stop=()=>{if(voice){try{voice.stop();voice.disconnect();}catch(_){}voice=null;}};\n function evaluate(x){const high=Number.isFinite(x.cabinAltitudeFt)&&x.cabinAltitudeFt>=10000;\n const bad=x.brake===true||x.speedbrakeDown===false||x.flapInvalid===true||x.leadingEdgeInvalid===true||x.trimInvalid===true;\n const takeoff=x.onGround===true&&x.takeoffThrust===true&&bad;\n return {cabinHigh:high,takeoffConfig:takeoff,active:x.power===true&&(takeoff||(high&&!x.cutout))};}\n function read(){\n  const p=w.B737ISNCockpitV1?.getPropulsionSnapshot?.(),f=w.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active===true?frame:null;\n  const ground=typeof f?.airborne==='boolean'?!f.airborne:p?.onGround;\n  const thrust=Object.values(p?.engines||{}).some(e=>e.running&&Number.isFinite(e.throttle)&&e.throttle>=.65);\n  const brake=w.B737UnifiedParkingBrakeV1?.getState?.()?.engaged;\n  const sb=w.B737SpeedbrakeLever,sd=sb?.mounted?.()?sb.get()===0:null;\n  const le=w.B737Final10ApproachPresetV1?.getLiveFlapOwnerState?.()??w.B737LEDevicesUnifiedLink?.getState?.(),q=le?.projection;\n  const fl=q?.tePosition;\n  const v=w.B737AircraftProfileStore?.get?.(),min=String(v?.model||v?.aircraftModel||'').includes('400')?1:1;\n  const cab=w.B737UnifiedInstructorNonNormalV1?.pressureState?.()?.cabinAltitudeFt??w.B737UnifiedCabinNeedles?.getMeasuredReadings?.()?.cabinAltitudeFt??cabin;\n  if(Number.isFinite(cab)&&cab<10000)cutout=false;\n  const possible=thrust&&ground===true||Number.isFinite(cab)&&cab>=10000;\n  let power=false;\n  if(possible){const e=w.B737ISNCockpitV1?.getElectricalState?.(),b=e&&w.B737ElectricalV7?.evaluate?.(e)?.bus;power=!!(b&&(b.transfer1===true||b.transfer2===true||b.acStandby===true));}\n  const trim=w.B737StabilizerTrim?.getState?.();\n  last={...evaluate({cabinAltitudeFt:cab,onGround:ground,takeoffThrust:thrust,brake,speedbrakeDown:sd,flapInvalid:Number.isFinite(fl)&&(fl<min||fl>15),leadingEdgeInvalid:Number.isFinite(fl)&&fl>=1&&fl<=15&&q?.leStage==='RETRACTED',trimInvalid:trim?.takeoffValid===false,power,cutout}),cabinAltitudeFt:cab,power,brake,thrust,audioReady:!!buffer&&ctx?.state==='running',lastError};\n  if(!last.active){stop();return last;}\n  if(ctx?.state==='running'&&buffer&&!voice){voice=ctx.createBufferSource();voice.buffer=buffer;voice.loop=true;voice.connect(ctx.destination);voice.start();}\n  return last;\n }\n function unlock(){try{if(!ctx){const A=w.AudioContext||w.webkitAudioContext;if(!A)return;ctx=new A();}\n  if(ctx.state!=='running')ctx.resume().then(read).catch(e=>{lastError=String(e);});\n  if(!buffer&&!loading){const bytes=Uint8Array.from(w.atob(base64),c=>c.charCodeAt(0));loading=ctx.decodeAudioData(bytes.buffer).then(b=>{buffer=b;read();}).catch(e=>{lastError=String(e);loading=null;});}\n }catch(e){lastError=String(e);}}\n function safeRead(){try{return read();}catch(e){lastError=String(e);stop();return last;}}\n d.addEventListener('pointerdown',unlock,true);d.addEventListener('keydown',unlock,true);\n let bound=new WeakSet();function bind(){for(const id of ['overheadFrame','pedestalFrame']){const f=d.getElementById(id);try{const c=f?.contentDocument;if(c&&!bound.has(c)){bound.add(c);c.addEventListener('pointerdown',unlock,true);c.addEventListener('keydown',unlock,true);}}catch(_){}}}\n w.addEventListener('b737:cockpit-mounted',bind);\n w.addEventListener('b737:flight-scenario-state',e=>{frame=e.detail;});\n w.addEventListener('b737:flight-scenario-stopped',()=>{frame=null;cabin=null;cutout=false;safeRead();});\n w.addEventListener('b737:instructor-cabin-pressure',e=>{cabin=e.detail?.cabinAltitudeFt;safeRead();});\n w.addEventListener('b737:parking-brake-state',safeRead);\n d.addEventListener('click',e=>{if(e.target?.closest?.('#isnCutoutCabin')){cutout=true;safeRead();}});\n w.addEventListener('pagehide',stop);\n d.addEventListener('visibilitychange',()=>{if(!d.hidden){bind();safeRead();}});\n w.setInterval(()=>{safeRead();},100);w.setInterval(bind,1500);\n w.B737UnifiedIntermittentHornV1=Object.freeze({getState:()=>({...last}),evaluate,cutoutCabin:()=>{cutout=true;safeRead();},refresh:safeRead});\n})(window,document);</script></body></html>"]])patch(relative,from,to);
 return changes;
}
const fastRuntime=(()=>{
 try {
  const disk=require('node:fs');
  const manifest=JSON.parse(disk.readFileSync(path.join(fastRuntimeDir,'manifest.json'),'utf8'));
  if(manifest.schema!=='b737-unified-fast-runtime/1'||
   !/^[a-f0-9]{40}$/.test(manifest.sourceCommit)||
   !Array.isArray(manifest.files))throw Error('Invalid compiled-runtime manifest');
  const bytes=new Map(),compressed=new Map(),digests=new Map();
  for(const entry of manifest.files){
   const relative=entry.path;
   if(typeof relative!=='string'||relative.includes('..')||
    !/^(?:[a-zA-Z0-9._-]+\/)+[a-zA-Z0-9._-]+\.(?:html|js|cjs|css|json|webmanifest|svg|webp|png|ttf|woff2|mp3|m4a)$/.test(relative)||
    !/^[a-f0-9]{64}$/.test(entry.sha256))
     throw Error('Invalid compiled-runtime resource path');
   const full=path.resolve(fastRuntimeDir,relative);
   if(!full.startsWith(fastRuntimeDir+path.sep))throw Error('Runtime path escapes directory');
   const body=disk.readFileSync(full);
   if(crypto.createHash('sha256').update(body).digest('hex')!==entry.sha256)
    throw Error('Invalid compiled-runtime digest: '+relative);
   if(bytes.has(relative))throw Error('Duplicate compiled-runtime resource');
   bytes.set(relative,body);digests.set(relative,entry.sha256);
   if(/\.(?:js|cjs|css|json)$/.test(relative)){
    compressed.set(relative,zlib.brotliCompressSync(body,{
     params:{[zlib.constants.BROTLI_PARAM_QUALITY]:4}
    }));
   }
  }
  if(!bytes.has('panel-mosaic-lab/cockpit/index.html')||
   !bytes.has('panel-mosaic-lab/cockpit/overhead-stage.html'))
    throw Error('Compiled cockpit or overhead entry missing');
  // Package revision-bound lamp artwork instead of fetching it at boot.
  // Authorization is still performed by the existing source route.
  const mirrored=new Set();
  const mirrorDir=path.join(runtimeDir,'fast-unified-source-cache');
  try{
   const mirror=JSON.parse(disk.readFileSync(path.join(mirrorDir,'index.json'),'utf8'));
   if(mirror.sourceCommit!==manifest.sourceCommit||!Array.isArray(mirror.files))
    throw Error('Source cache revision mismatch');
   let mirrorBytes=0,skipped=0;
   for(const entry of mirror.files){
    try{
     const relative=entry.path;
     if(typeof relative!=='string'||relative.includes('..')||
      !/^panel-mosaic-lab\/lights-reference-v2\/svg\/[a-zA-Z0-9_. -]+\.svg$/.test(relative)||
      !/^[a-f0-9]{40}$/.test(entry.sha)||!Number.isSafeInteger(entry.size)||entry.size<0||
      entry.size>1024*1024||mirrorBytes+entry.size>16*1024*1024||bytes.has(relative)){skipped++;continue;}
     const full=path.resolve(mirrorDir,'files',relative);
     if(!full.startsWith(path.join(mirrorDir,'files')+path.sep)){skipped++;continue;}
     const body=disk.readFileSync(full);
     const blobSha=crypto.createHash('sha1').update('blob '+body.length+'\0').update(body).digest('hex');
     if(body.length!==entry.size||blobSha!==entry.sha||body.subarray(0,42).toString().startsWith('version https://git-lfs.github.com/spec/v1')){skipped++;continue;}
     bytes.set(relative,body);digests.set(relative,crypto.createHash('sha256').update(body).digest('hex'));
     mirrored.add(relative);mirrorBytes+=body.length;
    }catch(error){skipped++;}
   }
   console.log('UNIFIED LOCAL SOURCE CACHE: '+mirrored.size+' assets / '+mirrorBytes+' bytes / '+skipped+' skipped');
  }catch(error){console.warn('UNIFIED LOCAL SOURCE CACHE unavailable: '+error.message);}
  const derived=applyColdDarkVisualFix(bytes,compressed,digests);
  console.log('UNIFIED VISUAL FIX: '+derived.length+' derived resources');
  console.log('UNIFIED FAST RUNTIME LOADED: '+manifest.sourceCommit+' / '+bytes.size+' verified resources');
  return {sourceCommit:manifest.sourceCommit,releaseId:crypto.createHash('sha256').update(JSON.stringify(manifest)).update(JSON.stringify(derived)).digest('hex'),bytes,compressed,digests,mirrored};
 } catch(error){
  if(error.code==='ENOENT'&&!require('node:fs').existsSync(fastRuntimeDir))return null;
  throw Error('Invalid Unified release', {cause:error});
 }
})();
// Deployment activation, after manifest and digest validation, is the release
// boundary. Browser navigation must never consult the moving GitHub ref.
function optimizedSource(relative){
 return fastRuntime?.bytes.get(relative);
}

/* The protected guest is a live mirror of the original main-branch cockpit.
 * Railway authenticates and serves the same source URLs under its own origin.
 * No duplicated/stale overhead code or artwork is maintained here. */
const {Readable} = require('node:stream');
const GITHUB_RAW_ROOT = 'https://raw.githubusercontent.com/mahmet737ng-gif/b737-classic-simulator/';
const GITHUB_RAW = GITHUB_RAW_ROOT+(fastRuntime?.sourceCommit||'main')+'/';
const GITHUB_PAGES = 'https://mahmet737ng-gif.github.io/b737-classic-simulator/';
const UPSTREAM_TIMEOUT_MS = 20000;
const ALLOWED_SOURCE_ROOTS = new Set([
  'acdc-metering-lab','approved-panel-stack','assets','audio','audio-lab',
  'branding','bus-consumer-test-lab','cb-panel-lab','cdu-font-test',
  'cdu-standalone','cdu-standalone-v3','cdu-standalone-v5','cdu-standalone-v6',
  'cpcs-lab','dcpcs-lab','eadi-attitude-lab','eadi-attitude-v5',
  'efis-display-lab', // EADI/EHSI renderers, glyphs, reference geometry
  'electrical-lab','electrical-load-lab','engine','fire-handle-lab',
  'fire-protection-lab','flight-controls-panel','fuel-panel','instrument-lab',
  'integration-lab','interactive-panel-test','isn-ecu-start-lab',
  'isn-electrical-pack-lab','isn-start-sequence-lab','main-panel-lab',
  'navigation','overhead-layout','panel-mosaic-lab','panels-stacked',
  'pneumatics-lab','shared-assets','stall-warning-lab','switch-lab',
  'systems-integration-lab','trainer-lab','vector-lab','technical-database',
  'data','navdata','mrg','aircon-lab','anti-ice-lab','apu-lab','hydraulic-lab'
]);
const PROXY_EXTENSIONS = new Set(['.html','.htm','.js','.mjs','.cjs','.css','.json','.svg',
 '.png','.jpg','.jpeg','.webp','.gif','.avif','.ico','.woff','.woff2','.ttf',
 '.webmanifest','.txt','.csv','.xml','.wasm','.bin','.b64','.mp3','.m4a','.mp4','.webm','.pdf']);
const PROXY_MIME = Object.freeze({
 '.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8',
 '.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8',
 '.cjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8',
 '.json':'application/json; charset=utf-8','.svg':'image/svg+xml',
 '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp',
 '.gif':'image/gif','.avif':'image/avif','.ico':'image/x-icon',
 '.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf',
 '.webmanifest':'application/manifest+json','.txt':'text/plain; charset=utf-8',
 '.csv':'text/csv; charset=utf-8','.xml':'application/xml',
 '.wasm':'application/wasm','.bin':'application/octet-stream',
 '.b64':'text/plain; charset=utf-8',
 '.mp3':'audio/mpeg','.m4a':'audio/mp4','.mp4':'video/mp4','.webm':'video/webm','.pdf':'application/pdf'
});
function repoAssetPath(urlPath) {
  // Only fixed source roots; never proxy untrusted network addresses.
  let decoded;
  try { decoded = decodeURIComponent(urlPath); } catch (_) { return null; }
  if (decoded.includes('\\') || decoded.includes('\0') || decoded.includes('//')) return null;
  const segments=decoded.split('/').filter(Boolean);
  // A few approved photo references live directly in the repository root.
  if(segments.length===1 && /^[A-Za-z0-9_.-]+\.(?:png|webp|svg|jpg|jpeg)$/i.test(segments[0]))
    return segments[0];
  if (!segments.length || !ALLOWED_SOURCE_ROOTS.has(segments[0])) return null;
  if (segments.some(p=>p==='..' || p==='.' || p.startsWith('.'))) return null;
  if (segments.length===1 || decoded.endsWith('/')) segments.push('index.html');
  const rel=segments.join('/');
  if (!PROXY_EXTENSIONS.has(path.posix.extname(rel).toLowerCase())) return null;
  return rel;
}
async function upstreamFetch(relative) {
  // Never resolve a release dependency against another revision. Generated
  // diagnostic Pages remain available by their explicit entry points.
  const pagesDiagnostic=/^panel-mosaic-lab\/cockpit\/(?:unified-(?:diagnostic-v6|diagnostic-static-v6|light-overhead-v10|no-cdu-v10|composite-test|static-controls-test|efis-v3)\.html|overhead-(?:real-f-in-unified-v10|composite-stage|static-controls-stage)\.html|(?:runtime-build\.json|startup-benchmark\.json))$/.test(relative);
  const origins=!fastRuntime||pagesDiagnostic?[GITHUB_RAW,GITHUB_PAGES]:[GITHUB_RAW];
  for (const origin of origins) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),UPSTREAM_TIMEOUT_MS);
    try {
      const response=await fetch(origin+relative,{signal:controller.signal,
        headers:{'User-Agent':'ATA24-guest-training-gateway','Accept':'*/*'},
        redirect:'follow',cache:'no-store'});
      clearTimeout(timer);
      if(response.ok)return response;
      await response.body?.cancel();
      if(response.status!==404)throw Error('GitHub upstream returned '+response.status);
    }catch(e){clearTimeout(timer);if(origin===origins.at(-1))throw e;}
  }
  return null;
}
// Authorized-only, bounded read-through cache for source JS/CSS. Never cache
// HTML, navigation data, credentials or session decisions. Each request still
// passes the database-backed authorization check BEFORE reaching this cache.
// A version change gets a distinct entry; unversioned and ts-busted files
// continue through the original uncached streaming source path.
const SOURCE_CACHE_TTL_MS=15*60*1000,SOURCE_CACHE_ENTRY_MAX=256*1024,SOURCE_CACHE_LIMIT=24*1024*1024;
const sourceCache=new Map(),sourceInFlight=new Map();
let sourceCacheBytes=0;
async function cachedSourceText(relative,requestUrl) {
  const parsed=new URL(requestUrl,'https://gateway.invalid');
  const version=parsed.searchParams.get('v');
  if(!version || parsed.searchParams.has('ts'))return null;
  const key=relative+'?v='+version+'@'+(typeof fastRuntime!=='undefined'&&fastRuntime?.sourceCommit||'main');
  const current=sourceCache.get(key);
  if(current){
    if(current.expires>Date.now()){
      sourceCache.delete(key);sourceCache.set(key,current);
      return current.bytes;
    }
    sourceCache.delete(key);sourceCacheBytes-=current.bytes.length;
  }
  if(sourceInFlight.has(key))return sourceInFlight.get(key);
  const task=(async()=>{
    const response=await upstreamFetch(relative);
    if(!response)return undefined;
    const bytes=Buffer.from(await response.arrayBuffer());
    if(bytes.length<=SOURCE_CACHE_ENTRY_MAX){
      while(sourceCacheBytes+bytes.length>SOURCE_CACHE_LIMIT && sourceCache.size){
        const oldest=sourceCache.keys().next().value;
        const item=sourceCache.get(oldest);sourceCache.delete(oldest);
        sourceCacheBytes-=item.bytes.length;
      }
      sourceCache.set(key,{bytes,expires:Date.now()+SOURCE_CACHE_TTL_MS});
      sourceCacheBytes+=bytes.length;
    }
    return bytes;
  })();
  sourceInFlight.set(key,task);
  try{return await task;}finally{sourceInFlight.delete(key);}
}
// Prewarm only public, explicitly revisioned JS/CSS referenced by the
// already-authenticated cockpit's compiled entry points. NO NAVDATA, HTML or
// protected user/session data is prefetched. Does not block server health.
async function prewarmFastRuntime(){
 if(!fastRuntime)return;
 const files=new Map(),origin='https://warm.invalid/';
 for(const entry of ['panel-mosaic-lab/cockpit/index.html','panel-mosaic-lab/cockpit/overhead-stage.html']){
  const markup=fastRuntime.bytes.get(entry)?.toString('utf8');
  if(!markup)continue;
  const doc=new URL(entry,origin);
  const baseMatch=markup.match(/<base\s+href=(["'])([^"']+)\1/i);
  const base=baseMatch?new URL(baseMatch[2],doc):doc;
  for(const match of markup.matchAll(/<(?:script|link)\b[^>]*?\b(?:src|href)=(["'])([^"']+)\1[^>]*>/gi)){
   try{
    const url=new URL(match[2].replaceAll('&amp;','&'),base);
    const relative=url.pathname.slice(1);
    if(url.origin!==base.origin||!/^[-a-zA-Z0-9_./]+\.(?:js|css)$/.test(relative)||
     !url.searchParams.has('v')||fastRuntime.bytes.has(relative)||relative.includes('..'))continue;
    files.set(relative+'?'+url.searchParams.get('v'),{relative,url:url.href});
   }catch{}
  }
 }
 const queue=[...files.values()].slice(0,160);
 let index=0,ok=0,errors=0;
 await Promise.all(Array.from({length:8},async()=>{
  while(index<queue.length){
   const item=queue[index++];
   try{if(await cachedSourceText(item.relative,item.url))ok++;else errors++;}
   catch{errors++;}
  }
 }));
 console.log('UNIFIED FAST PREWARM: '+ok+' source JS/CSS ready, '+errors+' unavailable');
}
function directBootSetup(){
 const layout=fastRuntime.bytes.get(cockpitSource+'assembly.json');
 if(!layout)return '';
 const assembly=JSON.parse(layout.toString('utf8'));
 for(const entry of [...assembly.regions,...assembly.embeddedInstruments]){
  const embedded=entry.embeddedUrl;
  if(typeof embedded==='string'&&/^\.\/(?:overhead|cdu)-stage\.html\?/.test(embedded))
   entry.embeddedUrl=directPath+embedded.slice(2);
 }
 const previewManifest=fastRuntime.bytes.get(cockpitSource+'performance/manifest.json');
 const photoRegistry=fastRuntime.bytes.get(cockpitSource+'panel-photo-registry.v1.json');
 const images=previewManifest?JSON.parse(previewManifest).images:{};
 const photos=photoRegistry?JSON.parse(photoRegistry).panels:{};
 // VISUAL FIRST: 384px fitted photos only, never raw 4K originals.
 const firstPaint={};
 for(const key of Object.keys(assembly.assets||{})){
  const level=images[key]?.levels?.find(item=>item.extent===384&&!item.original);
  if(level&&fastRuntime.bytes.has(level.url))firstPaint[key]='/'+level.url;
 }
 // Both CDU stations display their approved unlit image before FMC runtime
 // is connected. The real staged CDU frame replaces the placeholder later.
 const cduPreviewKey='cdu-standalone-v6/assets/cdu-approved-unlit.png';
 const cduPhoto=images[cduPreviewKey]?.levels?.find(item=>item.extent===384&&!item.original);
 if(cduPhoto&&fastRuntime.bytes.has(cduPhoto.url))
  firstPaint[cduPreviewKey]='/'+cduPhoto.url;
 const artIndex=fastRuntime.bytes.get(cockpitSource+'performance/boot-art/manifest.json');
 const art={};
 if(artIndex)for(const [id,asset] of Object.entries(JSON.parse(artIndex))){
  if(!fastRuntime.bytes.has(asset.url)||!asset.url.startsWith(cockpitSource+'performance/boot-art/'))
   throw Error('Missing verified Unified boot artwork '+id);
  art[id]={url:'/'+asset.url,width:asset.width,height:asset.height,changed:asset.changed};
 }
 const preview=filename=>{
  const entry=images['panel-mosaic-lab/assets/locked/2026-10-23/'+filename];
  const image=entry?.levels.find(item=>item.extent===384&&!item.original)?.url;
  return fastRuntime.bytes.has(image)?'/'+image:undefined;
 };
 const photo=key=>{
  const image=cockpitSource+'assets/'+photos[key]?.file;
  return fastRuntime.bytes.has(image)?'/'+image+'?v=OH21-DEDICATED-20261106':undefined;
 };
 const cockpitControls=Object.keys(images).filter(source=>
  /^panel-mosaic-lab\/assets\/throttle-levers\/engine-[12]-[^/]+\.png$/.test(source)||
  source.startsWith(cockpitSource+'assets/asp-controls-v1/')||
  /\/Switches\/Fire_Handles\/FIRE_HANDEL_(?:ENG1|ENG2|APU)_OFF\.webp$/.test(source)||
  source==='cdu-standalone-v6/assets/cdu-approved-unlit.png'
 ).map(source=>{
  const selected=images[source].levels.find(item=>item.extent===384&&!item.original);
  return selected&&fastRuntime.bytes.has(selected.url)?'/'+selected.url:null;
 }).filter(Boolean);
 const setup=JSON.stringify({
  assembly,art,firstPaint,
  previews:{
   aircon400:preview('Boeing-Style Environmental Control Panel.png'),
   dcpcs:preview('DCPCS_Background_Owner.png'),
   oh21_400:photo('OH21_400'),oh21_300500:photo('OH21_300500'),cockpitControls
  }
 });
 const main=assembly.regions.find(region=>region.id==='main');
 const photoURLs=[...new Set([...(main?.placements||[]).map(p=>firstPaint[p.asset]),firstPaint['cdu-standalone-v6/assets/cdu-approved-unlit.png']].filter(Boolean))];
 const photoPreloads=photoURLs.map(url=>'<link rel="preload" as="image" href="'+url+'" fetchpriority="high">').join('');
 return photoPreloads+'<script>window.B737GatewayBoot='+setup.replace(/</g,'\\u003c')+';</script>';
}
function transformCockpitHTML(content,{direct=false,lab=false}={}) {
  // Preserve the original ordered simulator scripts. Direct mode embeds the
  // release layout and starts the same documents under the sibling route.
  // Start an immediate same-origin session renewal BEFORE the hundreds of
  // original deferred cockpit assets. If a cached page survives expiry,
  // show login rather than leaving a partially loaded white cockpit.
  const preflight='<script>(function(){var h={};if(navigator.platform==="MacIntel"&&navigator.maxTouchPoints>1)h["X-Unified-Device-Class"]="ipad";fetch("/api/pulse",{method:"POST",credentials:"same-origin",cache:"no-store",headers:h})'+
    '.then(function(r){if(r.status===401)location.replace("/login?e=expired");})'+
    '.catch(function(){})})();</script>';
  const injection = '<base href="/panel-mosaic-lab/cockpit/">'+(direct?directBootSetup():'')+preflight+
    '<meta name="unified-navdata-seed" content="/api/navdata/local-reference">'+
    '<link rel="stylesheet" href="/static/guest-cockpit.css">'+
    '<script src="/static/guest-cockpit.js" defer></script>'+
    '<script src="/static/user-panel.js" defer></script>'+
    '<script src="/static/session.js" defer></script>';
  if(!/<head\b[^>]*>/i.test(content))throw Error('Source cockpit document is malformed');
  let result=cduLab.addLink(content).replace(/<head\b[^>]*>/i,m=>m+(lab?cduLab.head(true):'')+injection);
  // Photo preloads win the first lane; remove speculative ECU preload burst.
  // Deferred simulator scripts retain their original ordering and behavior.
  if(direct)result=result.replace(/<link\s+rel="preload"\s+as="script"[^>]*>\s*/gi,'');
  // This source is part of the verified release, shared by the three
  // documents. Its repetitive SVG compresses with the HTML. Deferring it
  // to an extra network fetch can trigger hundreds of lamp fallback requests.
  const lampPack=direct&&fastRuntime.bytes.get(cockpitSource+'performance/boot-lamp-sources.json');
  if(lampPack){
   const json=lampPack.toString('utf8').replace(/</g,'\\u003c');
   result=result.replace(/<\/head>/i,closing=>
    '<script>window.B737BootLampSources=Promise.resolve('+json+');</script>'+closing);
  }
  result=result.replace(/<title>[\s\S]*?<\/title>/i,'<title>B737 Classic | Electrical Training Bench</title>');
  result=result.replace(/(<meta\b[^>]*name="(?:application-name|apple-mobile-web-app-title)"[^>]*content=")[^"]*(")/gi,'$1B737 Classic$2');
  if(direct){
    // Release-local correction: the existing yellow aircraft enters from the
    // right and holds in its final pose rather than fading out.
    const aircraftHold='<style id="unified-welcome-aircraft-hold">'+
      '@keyframes unified-intro-arrive {'+
      '0% { opacity:0; transform:translate(110%,-.8%) scale(1); }'+
      '18% { opacity:1; }'+
      '59% { opacity:1; transform:translate(-5.3%,-6%) scale(1.14); }'+
      '100% { opacity:1; transform:translate(-5.8%,-6.3%) scale(1.17); }'+
      '}'+
      '</style>';
    result=result.replace(/<\/head>/i,aircraftHold+'</head>');
  }
  return result;
}
// No session-specific values are embedded in the markup. Build each
// variant once per process and reuse the exact compressed representation.
function versionCompiledLinks(html,relative){
 const junction=new URL(relative,'http://release.invalid/');
 const declared=html.match(/<base\s+href=(["'])([^"']+)\1/i)?.[2];
 const baseUrl=declared?new URL(declared,junction):junction;
 return html.replace(/<(?:link|script)\b[^>]*>/gi,tag=>{
  // Owner mounts and preload URLs paired with dynamically appended scripts
  // keep the exact original URL. Release-tag ordinary deferred assets only.
  if(!/^<script\b/i.test(tag)&&!(/\brel=(["'])stylesheet\1/i.test(tag)))return tag;
  return tag.replace(/\b(?:src|href)=(["'])([^"']+)\1/i,(match,quote,value)=>{
   const asset=new URL(value.replaceAll('&amp;','&'),baseUrl);
   if(asset.origin!==junction.origin||asset.searchParams.has('ts')||
      /(?:irs-|guard|owner18)/i.test(asset.pathname)||
      !/\.(?:js|css)$/.test(asset.pathname)||!optimizedSource(asset.pathname.slice(1)))return match;
   const url=asset.pathname+asset.search.replaceAll('&','&amp;')+
    (asset.search?'&amp;':'?')+'unifiedRelease='+fastRuntime.releaseId+asset.hash;
   return match.slice(0,match.indexOf(quote)+1)+url+quote;
  });
 });
}
const compiledDocuments=new Map();
function compiledDocument(relative,bytes,cockpitDocument,direct,lab=false){
 const key=lab?'cdu-lab:'+relative:direct?'direct:'+relative:relative;
 if(!compiledDocuments.has(key)){
  const original=bytes.toString('utf8');
  const rendered=cockpitDocument?transformCockpitHTML(original,{direct,lab}):
   original.replace(/<head\b[^>]*>/i,m=>m+(relative.endsWith('-stage.html')?cduLab.head(false):'')+'<script src="/static/session.js" defer></script>');
  const html=direct?versionCompiledLinks(rendered,relative):rendered;
  const raw=Buffer.from(html);
  const brotli=zlib.brotliCompressSync(raw,{
   params:{[zlib.constants.BROTLI_PARAM_QUALITY]:4}
  });
  compiledDocuments.set(key,{html,brotli,gzip:zlib.gzipSync(raw,{level:4})});
 }
 return compiledDocuments.get(key);
}
async function serveFastCompiledResponse(req,res,relative,bytes,{cockpitDocument=false,direct=false,authMs}={}){
 const ext=path.posix.extname(relative).toLowerCase();
 if(ext!=='.html'){
  const releasePinned=/\.(?:js|css)$/.test(relative)&&
   new URL(req.url,'http://localhost').searchParams.get('unifiedRelease')===fastRuntime.releaseId;
  const immutable=releasePinned||/desktop-bundle-[a-f0-9]{16}\.js$|[a-f0-9]{20}-q96-(?:384|768|1536)\.webp$/.test(relative)||
   /^panel-mosaic-lab\/cockpit\/performance\/boot-art\/[a-z0-9-]+-[a-f0-9]{20}\.webp$/.test(relative);
  res.setHeader('Cache-Control',immutable?'private, max-age=31536000, immutable':fastRuntime.mirrored?.has(relative)?'private, max-age=30':'private, max-age=0, must-revalidate');
  if(immutable)res.removeHeader('Pragma');
  res.setHeader('Vary','Accept-Encoding');
  const brotli=fastRuntime.compressed.get(relative);
  const accepts=String(req.headers['accept-encoding']||'');
  const encode=/\bbr\b/.test(accepts)&&brotli;
  const etag='"'+fastRuntime.digests.get(relative)+(encode?'-br':'')+'"';
  res.setHeader('ETag',etag);
  if(req.headers['if-none-match']===etag){res.writeHead(304);res.end();return;}
  if(encode)res.setHeader('Content-Encoding','br');
  res.writeHead(200,{'Content-Type':PROXY_MIME[ext]});
  if(req.method==='HEAD')res.end();else res.end(encode?brotli:bytes);
  return;
 }
 const mime='text/html; charset=utf-8';
 res.setHeader('X-Unified-Release',fastRuntime.releaseId);
 res.setHeader('X-Unified-Source-Commit',fastRuntime.sourceCommit);
 const timing=['unified-compiled;desc="'+fastRuntime.sourceCommit+'"'];
 if(direct)timing.push('unified-direct');
 if(Number.isFinite(authMs))timing.push('gateway-auth;dur='+authMs.toFixed(1));
 res.setHeader('Server-Timing',timing.join(', '));
 res.setHeader('Content-Security-Policy',
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; "+
  "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; "+
  "connect-src 'self' https:; font-src 'self' data:; media-src 'self' blob: https:; "+
  "worker-src 'self' blob:; frame-src 'self'; object-src 'none'; "+
  "base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
 const lab=new URL(req.url,'http://localhost').pathname===cduLab.labPath;
 const {html,brotli,gzip}=compiledDocument(relative,bytes,cockpitDocument,direct,lab);
 res.setHeader('Cache-Control','private, no-store');
 res.setHeader('Vary','Accept-Encoding');
 const accepts=String(req.headers['accept-encoding']||'');
 const encoding=/\bbr\b/.test(accepts)?'br':/\bgzip\b/.test(accepts)?'gzip':null;
 if(encoding)res.setHeader('Content-Encoding',encoding);
 res.writeHead(200,{'Content-Type':mime});
 if(req.method==='HEAD'){res.end();return;}
 res.end(encoding==='br'?brotli:encoding==='gzip'?gzip:html);
}
async function serveGitHubSource(req,res,relative,{cockpitDocument=false,authMs}={}) {
  const textExt=path.posix.extname(relative).toLowerCase();
  const compiled=optimizedSource(relative);
  if(compiled){
    // Content-addressed JS bundles and page HTML pass through the unchanged
    // CSP, session injection, MIME and security-header code below.
    return serveFastCompiledResponse(req,res,relative,compiled,{cockpitDocument,authMs});
  }
  if(req.method==='GET'&&(textExt==='.js'||textExt==='.css')){
    try{
      const bytes=await cachedSourceText(relative,req.url);
      if(bytes!==null){
        if(!bytes){res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('File not available in source repository');return;}
        res.setHeader('Cache-Control','private, max-age=30');
        res.writeHead(200,{'Content-Type':PROXY_MIME[textExt]});
        res.end(bytes);return;
      }
    }catch(e){
      console.error('Cached source unavailable',relative,e.message);
      res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});
      res.end('Source repository is temporarily unavailable');return;
    }
  }
  let response;
  try { response=await upstreamFetch(relative); }
  catch(e) {
    console.error('GitHub source unavailable',relative,e.message);
    res.writeHead(502,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('Source repository is temporarily unavailable');return;
  }
  if(!response) {
    res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});
    res.end('File not available in source repository');return;
  }
  const ext=path.posix.extname(relative).toLowerCase();
  const mime=PROXY_MIME[ext]||'application/octet-stream';
  // All original GitHub HTML documents may contain their own inline cockpit
  // and test-lab boot scripts. Preserve those contracts on the Railway origin.
  if(ext==='.html' || ext==='.htm') {
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; "+
      "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; "+
      "connect-src 'self' https:; font-src 'self' data:; media-src 'self' blob: https:; "+
      "worker-src 'self' blob:; frame-src 'self'; object-src 'none'; "+
      "base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
  }
  if(cockpitDocument) {
    // The full cockpit runs with the scripts' original same-origin and inline
    // boot contracts; the separately protected static guest files only change
    // visible panels and startup focus.
    res.setHeader('Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'; "+
      "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; "+
      "connect-src 'self' https:; font-src 'self' data:; media-src 'self' blob: https:; "+
      "worker-src 'self' blob:; frame-src 'self'; object-src 'none'; "+
      "base-uri 'self'; form-action 'self'; frame-ancestors 'self'");
    const html=transformCockpitHTML(await response.text());
    res.setHeader('Server-Timing','unified-source;desc="uncompiled"');
    res.setHeader('Cache-Control','private, no-store');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(html);return;
  }
  if(ext==='.html' || ext==='.htm') {
    const original=await response.text();
    const injected=original.replace(/<head\b[^>]*>/i,m=>m+'<script src="/static/session.js" defer></script>');
    res.setHeader('Cache-Control','private, no-store');
    res.writeHead(200,{'Content-Type':mime});
    res.end(injected);return;
  }
  res.setHeader('Cache-Control','private, max-age=30');
  res.writeHead(200,{'Content-Type':mime});
  if(req.method==='HEAD') {await response.body?.cancel();res.end();return;}
  if(!response.body){res.end();return;}
  const source=Readable.fromWeb(response.body);
  source.on('error',e=>{console.error('Upstream stream interrupted',relative,e.message);res.destroy(e);});
  source.pipe(res);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5, idleTimeoutMillis: 30000 });
const navdata=PrivateNavData.create(pool);
const iranNavdata=IranNavDataV2.create(pool);
const crewAssets=new Map([
  ['/crew/lobby.js', [cockpitSource+'crew-room-v1.js', 'text/javascript']],
  ['/crew/lobby.css', [cockpitSource+'crew-room-v1.css', 'text/css']]
]);
const crewDialog=optimizedSource(cockpitSource+'index.html')?.toString()
  .match(/<dialog id="crewRoomDialog"(?=[\s>])[\s\S]*?<\/dialog>/)?.[0];
const crewReady=crewDialog && [...crewAssets.values()].every(([file])=>optimizedSource(file));
const crewQrEncoder=cockpitSource+'vendor/qrcode-generator-2.0.4.js';
if(optimizedSource(crewQrEncoder))crewAssets.set('/crew/qrcode.js',[crewQrEncoder,'text/javascript']);
const crewCockpitReady=crewReady && crewDialog.includes('data-crew-enter') &&
  optimizedSource(cockpitSource+'crew-cockpit-v1.js');
const crewOrigin=process.env.CREW_ORIGIN || (process.env.RAILWAY_PUBLIC_DOMAIN ?
  'https://'+process.env.RAILWAY_PUBLIC_DOMAIN : 'http://127.0.0.1');
const roomStore={
  async findHostedRoom(manager, at) {
    const result=await pool.query(
      'SELECT room FROM unified_crew_rooms WHERE manager=$1 AND expires_at>$2',[manager,at]);
    return result.rows[0]?.room;
  },
  async findInvitedRoom(invitationHash, at) {
    const result=await pool.query(
      'SELECT room FROM unified_crew_rooms WHERE invitation_hash=$1 AND expires_at>$2',[invitationHash,at]);
    return result.rows[0]?.room;
  },
  async createRoom(record, invitationHash, at) {
    const result=await pool.query(`
      INSERT INTO unified_crew_rooms (manager, expires_at, invitation_hash, room)
      VALUES ($1,$2,$3,$4)
      ON CONFLICT (manager) DO UPDATE SET
        expires_at=EXCLUDED.expires_at, invitation_hash=EXCLUDED.invitation_hash, room=EXCLUDED.room
      WHERE unified_crew_rooms.expires_at<=$5
      RETURNING room`,[record.manager,record.expires,invitationHash,JSON.stringify(record),at]);
    return result.rows[0]?.room ?? roomStore.findHostedRoom(record.manager,at);
  }
};
const crew=createCrewRoomHandler({
  origin: crewOrigin,
  roomStore,
  ownerUsername: UNLIMITED_USER,
  reservedUsernames: [USER, ...Object.keys(EXTRA_USERS)],
  gatewayIdentity: unifiedIdentity,
  async gatewayLogin(req, username, password) {
    const result=await registerUnifiedDevice(req,username,password);
    if(result.error){
      const error=result.error;
      const messages={
        rate:[429,'Too many attempts. Retry in 15 minutes.'],
        full:[409,'All three Unified guest device slots are registered.'],
        invalid:[401,'Incorrect username or password.']
      };
      const [status,message]=messages[error];
      throw Object.assign(new Error(message),{status});
    }
    return {username,cookies:result.cookies};
  },
  accounts: {
    async get(key) {
      const result=await pool.query('SELECT username, verifier FROM unified_crew_accounts WHERE account_key=$1',[key]);
      return result.rows[0];
    },
    async add(key, username, verifier) {
      const result=await pool.query(
        'INSERT INTO unified_crew_accounts(account_key, username, verifier) SELECT $1,$2,$3 WHERE NOT EXISTS(SELECT 1 FROM unified_members WHERE username_key=$1) ON CONFLICT DO NOTHING',
        [key,username,verifier]);
      return result.rowCount===1;
    }
  }
});

function serveCrewEntry(req,res,url){
  const asset=crewAssets.get(url.pathname);
  if(!crewReady || (!asset && url.pathname!=='/crew/'))return false;
  if(req.method!=='GET' && req.method!=='HEAD')return false;
  if(asset){
    res.writeHead(200,{'Content-Type':asset[1]+'; charset=utf-8'});
    res.end(req.method==='HEAD'?undefined:optimizedSource(asset[0]));
    return true;
  }
  const standalone=crewDialog.includes('data-crew-host-role');
  const content=standalone?crewDialog.replace(/^<dialog/,'<main').replace(/<\/dialog>$/,'</main>'):crewDialog;
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end(req.method==='HEAD'?undefined:'<!doctype html><html lang="en"><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width, initial-scale=1"><title>Unified Crew Room</title>'+
    '<link rel="stylesheet" href="/crew/lobby.css"><script src="/crew/lobby.js" defer></script>'+
    '<body data-crew-entry'+(standalone?' data-crew-page':' style="background:#071016"')+'>'+
    (standalone?'':'<button type="button" data-crew-open>Crew Room</button>')+content+'</body></html>');
  return true;
}

const attemptMap = new Map();
const assets = Object.freeze({
  '/': ['index.html','text/html; charset=utf-8'],
  '/lab/': ['lab.html','text/html; charset=utf-8'],
  '/static/portal.css': ['portal.css','text/css; charset=utf-8'],
  '/static/portal.js': ['portal.js','text/javascript; charset=utf-8'],
  '/static/guest-cockpit.css': ['guest-cockpit.css','text/css; charset=utf-8'],
  '/static/guest-cockpit.js': ['guest-cockpit.js','text/javascript; charset=utf-8'],
  '/static/portal-overhead.css': ['portal-overhead.css','text/css; charset=utf-8'],
  '/static/portal-overhead.js': ['portal-overhead.js','text/javascript; charset=utf-8'],
  '/static/lab-injection.js': ['lab-injection.js','text/javascript; charset=utf-8'],
  '/static/app.js': ['app.js','text/javascript; charset=utf-8'],
  '/static/session.js': ['session.js','text/javascript; charset=utf-8'],
  '/static/style.css': ['style.css','text/css; charset=utf-8'],
  '/static/mrg-electrical-plate-v2.css': ['mrg-electrical-plate-v2.css','text/css; charset=utf-8'],
  '/static/electrical-v7.js': ['electrical-v7.js','text/javascript; charset=utf-8'],
  '/static/classic-multifeed-topology-v1.js': ['classic-multifeed-topology-v1.js','text/javascript; charset=utf-8'],
  '/static/classic-bus-consumer-engine-v1.js': ['classic-bus-consumer-engine-v1.js','text/javascript; charset=utf-8'],
  '/static/classic-bus-consumer-test-lab-v1.js': ['classic-bus-consumer-test-lab-v1.js','text/javascript; charset=utf-8'],
  '/static/mrg-electrical-plate-v2.js': ['mrg-electrical-plate-v2.js','text/javascript; charset=utf-8'],
  '/static/mrg-classic-340-consumer-bus-index-v1.json': ['mrg-classic-340-consumer-bus-index-v1.json','application/json; charset=utf-8']
});
function hash(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function random() { return crypto.randomBytes(32).toString('base64url'); }
function cookies(req) {
  const result = Object.create(null);
  for (const chunk of String(req.headers.cookie || '').split(';')) {
    const i = chunk.indexOf('=');
    if (i > 0) {
      try { result[chunk.slice(0,i).trim()] = decodeURIComponent(chunk.slice(i+1).trim()); } catch (_) {}
    }
  }
  return result;
}
function cookie(req, name, value, age, sameSite='Strict') {
  const secure = process.env.NODE_ENV === 'production' || req.headers['x-forwarded-proto'] === 'https';
  return name + '=' + encodeURIComponent(value) + '; Path=/; HttpOnly; SameSite=' + sameSite + '; Max-Age=' + age + (secure ? '; Secure' : '');
}
function commonHeaders(req,res) {
  res.setHeader('Cache-Control','no-store, max-age=0');
  res.setHeader('Pragma','no-cache');
  res.setHeader('Accept-CH','Sec-CH-UA-Platform-Version');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('X-Frame-Options','SAMEORIGIN');
  res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');
  res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; form-action 'self'; base-uri 'self'; frame-src 'self'; frame-ancestors 'self'");
  if (req.headers['x-forwarded-proto'] === 'https') res.setHeader('Strict-Transport-Security','max-age=31536000; includeSubDomains');
}
function redirect(res,location,extraHeaders={}) {
  res.writeHead(303,{Location:location,...extraHeaders});res.end();
}
function verifyPassword(pass, verifier=PASSWORD_HASH) {
  try {
    const bits = verifier.split(':');
    if (bits.length!==3 || bits[0]!=='scrypt') return false;
    const target = Buffer.from(bits[2],'hex');
    const actual = crypto.scryptSync(String(pass),bits[1],target.length);
    return target.length > 0 && crypto.timingSafeEqual(actual,target);
  } catch (_) { return false; }
}
function loginHTML(error) {
  const errorHTML = error === 'expired' ? '<div class="notice" role="alert">Your previous session expired. Sign in again to load all simulator panels.</div>'
    : error === 'full' ? '<div class="notice" role="alert">All 3 member device slots are registered. Sign out on one of the three devices, or ask Taregh to revoke a device. Inactivity never frees a slot.</div>'
    : error === 'invalid' ? '<div class="notice" role="alert">Incorrect username or password.</div>'
    : error === 'rate' ? '<div class="notice" role="alert">Too many attempts. Retry in 15 minutes.</div>' : '';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    + '<meta name="robots" content="noindex,nofollow"><title>Secure Access | B737 Classic Simulator</title>'
    + '<style>*,*::before,*::after{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0%,#17384d,#09131f 55%,#060c14);color:#f1f6fa;font-family:system-ui,Arial,sans-serif;display:grid;place-items:center;padding:24px}.card{width:min(100%,425px);background:#101f2c;border:1px solid #31556e;border-radius:18px;padding:34px;box-shadow:0 24px 80px #0008}.eyebrow{color:#67c8f8;font:700 11px monospace;letter-spacing:.16em}h1{font-size:27px;line-height:1.2;margin:10px 0 7px}p{color:#9eb6c7;font-size:13px;line-height:1.6;margin:0 0 26px}label{display:block;font-size:12px;font-weight:650;color:#bcd2e2;margin:17px 0 7px}input{width:100%;padding:13px 14px;border-radius:9px;background:#0a1723;color:#fff;border:1px solid #39566b;font:inherit}input:focus{outline:2px solid #63bdf7}button{width:100%;padding:14px;border-radius:10px;background:#2689ba;color:#fff;border:0;font-weight:750;cursor:pointer;margin-top:23px}button:hover{background:#3aa8dd}.private-room{display:block;text-align:center;color:#8ed9ff;margin-top:18px}.foot{font:11px monospace;color:#789aac;text-align:center;margin-top:23px}.notice{color:#ffbfbf;background:#4a2029;border:1px solid #a24b59;border-radius:8px;padding:12px;font-size:12px;margin-bottom:16px}</style></head>'
    + '<body><main class="card"><span class="eyebrow">B737 CLASSIC / ATA 24</span><h1>B737 Classic Simulator</h1><p>Authorized access to the complete simulator. Guests may register up to three browser profiles. A slot remains occupied until explicit sign out or owner revocation. Taregh has no device cap.</p>'
    + errorHTML + '<form method="post" action="/api/login" autocomplete="on"><label for="user">Username</label><input id="user" name="username" autocomplete="username" required maxlength="100" autofocus>'
    + '<label for="pass">Password</label><input id="pass" name="password" type="password" autocomplete="current-password" required maxlength="200">'
    + '<button type="submit">SIGN IN</button></form>'
    + (crewReady ? '<a class="private-room" href="/crew/">Join Private Room</a>' : '')
    + '<div class="foot">SESSION PROTECTED · INDEPENDENT TEST ENVIRONMENT</div></main></body></html>';
}
async function body(req) {
  return await new Promise((resolve,reject) => {
    let s='';
    req.on('data',d=>{ s+=d; if (s.length>4096) { reject(new Error('BODY_TOO_LARGE')); req.destroy(); } });
    req.on('end',()=>resolve(s));
    req.on('error',reject);
  });
}
// Share only IN-FLIGHT lookups for a burst of static resources. There is no
// cached authorization decision: a completed query is immediately removed,
// keeping logout and owner revocation database-authoritative.
const authorizationInFlight = new Map();
async function authorized(req) {
  const token = cookies(req)[TOKEN_COOKIE];
  if (!token || token.length < 30 || token.length > 128) return false;
  const key = hash(token);
  let inFlight = authorizationInFlight.get(key);
  if (!inFlight) {
    inFlight = pool.query(
      "SELECT d.session_hash FROM ata24_devices d JOIN unified_members m USING(account_tier) WHERE d.session_hash=$1 AND NOT m.suspended AND (m.account_tier='unlimited' OR NOT (SELECT locked FROM unified_security_state WHERE singleton=true))",
      [key]
    ).then(result=>result.rowCount===1).finally(()=>{
      authorizationInFlight.delete(key);
    });
    authorizationInFlight.set(key,inFlight);
  }
  return inFlight;
}
async function registerUnifiedDevice(req,username,password) {
  const now=Date.now(), ip=String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown').split(',')[0].trim().slice(0,80);
  if (attemptMap.size>5000) attemptMap.clear();
  const bucket=attemptMap.get(ip)||{n:0,until:now+900000};
  if (bucket.until<now) { bucket.n=0; bucket.until=now+900000; }
  if (bucket.n>=8) return {error:'rate'};
  const normalizedUsername = username.toLowerCase();
  const account=(await pool.query('SELECT account_tier,username,verifier,suspended FROM unified_members WHERE username_key=$1',[normalizedUsername])).rows[0];
  const tier=account?.account_tier;
  const legacyVerifier=tier==='unlimited'?UNLIMITED_PASSWORD_SCRYPT:tier==='guest'?PASSWORD_HASH:
    Object.entries(EXTRA_USERS).find(([name])=>name.toLowerCase()===normalizedUsername)?.[1];
  const valid=account&&!account.suspended&&(tier!=='unlimited'||username===UNLIMITED_USER)&&
    verifyPassword(password,account.verifier||legacyVerifier||'');
  if (!valid) {
    bucket.n++;attemptMap.set(ip,bucket);
    await securityEvent(pool,req,username,'LOGIN_FAILED');
    return {error:'invalid'};
  }
  attemptMap.delete(ip);
  const existing=cookies(req)[DEVICE_COOKIE];
  const device=typeof existing==='string'&&/^[A-Za-z0-9_-]{32,128}$/.test(existing)?existing:random();
  const token=random();
  const client=await pool.connect();
  let allowed=false;
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(73724003)');
    const locked=(await client.query('SELECT suspended,verifier FROM unified_members WHERE account_tier=$1',[tier])).rows[0];
    if(!locked||locked.suspended||locked.verifier!==account.verifier||(tier!=='unlimited'&&await securityLocked(client))){
      await client.query('ROLLBACK');return {error:'invalid'};
    }
    // Every registered guest browser keeps its slot until explicit release.
    // The advisory lock serializes competing logins for the fourth slot.
    const same=await client.query('SELECT account_tier FROM ata24_devices WHERE device_hash=$1',[hash(device)]);
    const count=await client.query("SELECT count(*)::int AS total FROM ata24_devices WHERE account_tier=$1",[tier]);
    // Every named guest has its own three-device registry; re-login on an existing
    // device never consumes a second slot. The unlimited owner has no cap.
    if(canRegisterDevice(tier==='unlimited'?'unlimited':'guest',
      same.rows[0]?.account_tier===tier?'guest':null,count.rows[0].total,MAX_DEVICES)){
      const {agent,label}=memberRequestInfo(req);
      await client.query(`INSERT INTO ata24_devices
        (device_hash,session_hash,last_seen,account_tier,device_user_agent,last_ip,registered_at)
        VALUES($1,$2,now(),$3,$4,$5,now())
        ON CONFLICT (device_hash) DO UPDATE SET session_hash=EXCLUDED.session_hash,
          last_seen=now(),presence_started_at=NULL,account_tier=EXCLUDED.account_tier,
          device_user_agent=EXCLUDED.device_user_agent,last_ip=EXCLUDED.last_ip,
          registered_at=CASE WHEN ata24_devices.account_tier=EXCLUDED.account_tier THEN ata24_devices.registered_at ELSE now() END`,
        [hash(device),hash(token),tier,agent,ip]);
      const history=await client.query(`INSERT INTO unified_member_devices(account_tier,device_hash,agent,ip,first_seen,last_seen,device_label)
        VALUES($1,$2,$3,$4,now(),now(),$5) ON CONFLICT(account_tier,device_hash)
        DO UPDATE SET agent=EXCLUDED.agent,ip=EXCLUDED.ip,last_seen=now(),device_label=CASE
          WHEN unified_member_devices.agent=EXCLUDED.agent AND
            ((EXCLUDED.device_label LIKE 'Windows 10/11 %' AND unified_member_devices.device_label ~ '^WIN(10|11) ') OR
             (EXCLUDED.device_label LIKE 'macOS %' AND unified_member_devices.device_label LIKE 'iPad %'))
          THEN unified_member_devices.device_label ELSE EXCLUDED.device_label END RETURNING device_label`,[tier,hash(device),agent,ip,label]);
      await memberEvent(client,tier,'LOGIN',hash(device),null,history.rows[0].device_label,ip);
      await securityEvent(client,req,account.username,'LOGIN_SUCCESS');
      allowed=true;
    }
    await client.query('COMMIT');
  } catch(e) {
    await client.query('ROLLBACK').catch(()=>{});
    throw e;
  } finally { client.release(); }
  if (!allowed) return {error:'full'};
  return {cookies:[
    cookie(req,DEVICE_COOKIE,device,tier==='unlimited'?OWNER_SESSION_SECONDS:DEVICE_SESSION_SECONDS,'Lax'),
    cookie(req,TOKEN_COOKIE,token,tier==='unlimited'?OWNER_SESSION_SECONDS:GUEST_SESSION_SECONDS,'Lax')
  ]};
}

async function signIn(req,res) {
  const payload=new URLSearchParams(await body(req));
  const result=await registerUnifiedDevice(req,payload.get('username')||'',payload.get('password')||'');
  if(result.error){redirect(res,'/login?e='+result.error);return;}
  redirect(res,'/',{'Set-Cookie':result.cookies});
}
async function readPrivateNavData(req){
 if(!String(req.headers['content-type']||'').startsWith('application/json'))throw Error('JSON_REQUIRED');
 if(Number(req.headers['content-length']||0)>3_000_000)throw Error('NAVDATA_TOO_LARGE');
 const chunks=[];let length=0;
 for await(const chunk of req){length+=chunk.length;if(length>3_000_000)throw Error('NAVDATA_TOO_LARGE');chunks.push(chunk);}
 return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function sameOriginRequest(req){
 try{
  const origin=req.headers.origin;
  if(!origin||(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin'))return false;
  const u=new URL(origin);return u.host===req.headers.host&&u.protocol==='https:';
 }catch{return false;}
}


function escapeHtml(value){
 return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
}
function devicesHTML(rows){
 const body=rows.map((d,i)=>{
  const label=escapeHtml(d.device_user_agent||'Unknown browser');
  const ip=escapeHtml(d.last_ip||'Unknown');
  const registered=escapeHtml(d.registered_at?new Date(d.registered_at).toISOString():'Unknown');
  const seen=escapeHtml(d.last_seen?new Date(d.last_seen).toISOString():'Unknown');
  const id=escapeHtml(d.device_hash);
  const account=d.account_tier==='guest'?USER:
    Object.keys(EXTRA_USERS).find(name => 'user:' + name.toLowerCase() === d.account_tier) || 'Guest';
  return '<tr><td>'+String(i+1)+'</td><td>'+escapeHtml(account)+'</td><td>'+label+'<small>ID '+id.slice(0,12)+'</small></td>'+
   '<td>'+ip+'</td><td>'+registered+'</td><td>'+seen+'</td>'+
   '<td><form action="/api/devices/revoke" method="post"><input type="hidden" name="device" value="'+id+'"><button type="submit">REVOKE</button></form></td></tr>';
 }).join('');
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
 '<meta name="robots" content="noindex,nofollow"><title>Guest Device Registry | B737 Classic</title>'+
 '<style>body{background:#0a1420;color:#eaf5ff;font:14px system-ui,Arial,sans-serif;margin:auto;padding:24px;max-width:1100px}a{color:#70cbff}h1{font-size:24px}p,small{color:#a1bbcf}table{width:100%;border-collapse:collapse;display:block;overflow-x:auto}th,td{text-align:left;padding:12px;border-bottom:1px solid #31485c;vertical-align:top}th{white-space:nowrap}small{display:block;margin-top:8px}button{border:0;border-radius:6px;padding:10px;background:#b94747;color:white;font-weight:700;cursor:pointer}td{overflow-wrap:anywhere}td button{white-space:nowrap}th:last-child,td:last-child{min-width:88px}details{max-width:320px;margin-top:5px}summary{color:#9eb7c9;cursor:pointer;font-size:12px}td:has(details){min-width:180px}form{margin:0}</style></head><body>'+
 '<p><a href="/">BACK TO UNIFIED</a></p><h1>Registered Guest Devices — '+rows.length+' total</h1>'+
 '<p>Each guest account has up to three registered browser profiles. Slots persist until sign out or owner revocation. Clearing cookies does not free a registration.</p>'+
 '<table><thead><tr><th>#</th><th>Account</th><th>Device / Browser</th><th>Last IP</th><th>Registered (UTC)</th><th>Last Seen (UTC)</th><th>Control</th></tr></thead><tbody>'+body+'</tbody></table>'+
 (rows.length?'':'<p>No guest devices are registered.</p>')+'</body></html>';
}
async function unifiedIdentity(req){
 const token=cookies(req)[TOKEN_COOKIE];
 if(!token||token.length<30||token.length>128)return null;
 const result=await pool.query('SELECT m.username FROM ata24_devices d JOIN unified_members m USING(account_tier) WHERE d.session_hash=$1 AND NOT m.suspended AND (m.account_tier=\'unlimited\' OR NOT (SELECT locked FROM unified_security_state WHERE singleton=true))',[hash(token)]);
 return result.rows[0]?.username || null;
}

async function ownerAccess(req){
 return await unifiedIdentity(req)===UNLIMITED_USER;
}


function describeMemberDevice(agent,platformVersion='',deviceClass=''){
  const ua=String(agent||'');
  let os='Unknown OS', browser='Unknown browser';
  if(deviceClass==='ipad'||/iPad/i.test(ua))os='iPad';
  else if(/iPhone/i.test(ua))os='iPhone';
  else if(/iPod/i.test(ua))os='iPod';
  else if(/Windows NT 10\.0/i.test(ua)){
    const major=Number(String(platformVersion).replace(/"/g,'').split('.')[0]);
    os=major>=13?'WIN11':major>0?'WIN10':'Windows 10/11';
  }else if(/Windows NT 6\.3/i.test(ua))os='WIN8.1';
  else if(/Windows NT 6\.2/i.test(ua))os='WIN8';
  else if(/Windows NT 6\.1/i.test(ua))os='WIN7';
  else if(/Android/i.test(ua))os='Android';
  else if(/CrOS/i.test(ua))os='ChromeOS';
  else if(/Macintosh|Mac OS X/i.test(ua))os='macOS';
  else if(/Linux/i.test(ua))os='Linux';
  if(/Edg(?:A|iOS)?\/|Edge\//i.test(ua))browser='EDGE';
  else if(/OPR\/|OPiOS\/|Opera/i.test(ua))browser='OPERA';
  else if(/SamsungBrowser\//i.test(ua))browser='SAMSUNG INTERNET';
  else if(/FxiOS\/|Firefox\//i.test(ua))browser='FIREFOX';
  else if(/CriOS\/|Chrome\/|Chromium\//i.test(ua))browser='CHROME';
  else if(/Safari\//i.test(ua)&&/Version\//i.test(ua))browser='SAFARI';
  return os+' '+browser+' BROWSER';
}
function memberRequestInfo(req){
  const agent=String(req.headers['user-agent']||'Unknown browser').slice(0,512);
  const ip=String(req.headers['x-forwarded-for']||req.socket.remoteAddress||'').split(',')[0].trim().slice(0,80);
  const version=String(req.headers['sec-ch-ua-platform-version']||'').slice(0,40);
  const deviceClass=req.headers['x-unified-device-class']==='ipad'?'ipad':'';
  return {agent,ip,label:describeMemberDevice(agent,version,deviceClass)};
}
const securityRates=new Map(),securityCrewStreams=new Set(),securityCrewSockets=new Set();
async function securityLocked(db=pool){
 const r=await db.query('SELECT locked FROM unified_security_state WHERE singleton=true');
 if(r.rowCount!==1)throw Error('Security state unavailable');
 return r.rows[0].locked===true;
}
async function securityEvent(db,req,username,action){
 const info=memberRequestInfo(req);
 await db.query('INSERT INTO unified_security_events(username,action,ip,device_label) VALUES($1,$2,$3,$4)',[String(username||'').slice(0,80),action,info.ip,info.label]);
}
async function confirmOwnerPassword(db,req,password){
 const key=memberRequestInfo(req).ip||'unknown',now=Date.now();
 if(securityRates.size>=5000)for(const [k,v] of securityRates)if(v.until<=now)securityRates.delete(k);
 let r=securityRates.get(key);
 if(!r||r.until<=now){if(securityRates.size>=5000&&!r)return false;r={n:0,until:now+900000};securityRates.set(key,r);}
 if(r.n>=8)return false;
 const result=await db.query("SELECT m.verifier FROM unified_members m JOIN ata24_devices d USING(account_tier) WHERE m.account_tier='unlimited' AND NOT m.suspended AND d.session_hash=$1",[hash(cookies(req)[TOKEN_COOKIE]||'')]);
 const valid=result.rowCount===1&&typeof password==='string'&&password.length>0&&password.length<=200&&verifyPassword(password,result.rows[0].verifier||UNLIMITED_PASSWORD_SCRYPT||'');
 if(!valid){r.n++;await securityEvent(db,req,UNLIMITED_USER,'ADMIN_REAUTH_FAILED');return false;}
 securityRates.delete(key);return true;
}
function securityPanelHTML(state,events,sessions,req,message){
 const E=escapeHtml,stamp=v=>v?new Date(v).toISOString().replace('T',' ').slice(0,19):'—',current=hash(cookies(req)[TOKEN_COOKIE]||'');
 const form=(action,label,extra='',danger=false)=>'<form method="post" action="/api/user-panel/security"><input type="hidden" name="action" value="'+action+'">'+extra+'<label>Owner password<input type="password" name="owner_password" required maxlength="200" autocomplete="current-password"></label><button'+(danger?' class="danger"':'')+'>'+label+'</button></form>';
 const sr=sessions.map(d=>'<tr><td>'+E(d.username)+'</td><td>'+E(d.device_label||describeMemberDevice(d.device_user_agent))+'</td><td>'+E(d.last_ip||'—')+'</td><td>'+stamp(d.last_seen)+'</td><td>'+(d.session_hash===current?'Current session':form('revoke_session','Revoke','<input type="hidden" name="device" value="'+E(d.device_hash)+'">',true))+'</td></tr>').join('')||'<tr><td colspan="5">No registered sessions.</td></tr>';
 const er=events.map(e=>'<tr><td>'+stamp(e.at)+'</td><td>'+E(e.username)+'</td><td>'+E(e.action)+'</td><td>'+E(e.device_label)+'</td><td>'+E(e.ip||'—')+'</td></tr>').join('')||'<tr><td colspan="5">No security events recorded yet.</td></tr>';
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unified Security Center</title><style>*{box-sizing:border-box}body{margin:0;background:#0b1520;color:#e9f3fa;font:14px system-ui}main{max-width:1200px;margin:auto;padding:24px}header{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}a{color:#a6e2ff}section{background:#132331;border:1px solid #2c4659;border-radius:12px;padding:18px;margin:16px 0;overflow:auto}h1{margin:6px 0}h2{font-size:17px;margin-top:0}p,small{color:#a9c2d0}.eyebrow{letter-spacing:1.5px;color:#82b8c5;font-size:11px}.status{font-weight:700;color:#82dfb3}.locked{color:#ffb3b3}input,button{font:inherit;color:#effaff;padding:9px;border:1px solid #45677c;border-radius:7px;background:#0b1925}button{background:#246081;cursor:pointer;font-weight:650;white-space:nowrap}button.danger{background:#843943}form{display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap}label{display:grid;gap:4px;font-size:12px}table{width:100%;border-collapse:collapse;min-width:680px;margin-top:12px}td,th{padding:10px 8px;text-align:left;border-bottom:1px solid #314455}th{color:#adc5d7}td{overflow-wrap:anywhere}td input{width:140px}.notice{padding:10px;border:1px solid #486e85;border-radius:8px}@media(max-width:600px){main{padding:12px}}</style></head><body><main><header><div><div class="eyebrow">B737 CLASSIC / OWNER SECURITY</div><h1>Unified Security Center</h1></div><div><a href="/user-panel/">User Panel</a> · <a href="/user-panel/security/">Refresh</a></div></header>'+
 (message?'<p class="notice" role="status">'+E(message)+'</p>':'')+
 '<section><h2>Emergency Lockdown</h2><p class="'+(state.locked?'locked':'status')+'">'+(state.locked?'LOCKDOWN ACTIVE':'NORMAL OPERATION')+'</p><p>Last change UTC: '+stamp(state.changed_at)+'</p><p>Revokes all other Unified sessions and blocks non-owner sign-ins. Private Room requests are paused during lockdown. Previously downloaded offline files cannot be erased. Unlocking does not restore revoked Unified sessions.</p>'+
 (state.locked?form('unlock','Restore normal access'):form('lockdown','Activate emergency lockdown','<label>Type LOCKDOWN to confirm<input name="confirm" required pattern="LOCKDOWN" autocomplete="off"></label>',true))+'</section>'+
 '<section><h2>Registered sessions</h2><p>The current owner session is preserved. Separate Private Room sessions are not listed here.</p>'+form('revoke_others','Revoke all other Unified sessions','<label>Type REVOKE to confirm<input name="confirm" required pattern="REVOKE" autocomplete="off"></label>',true)+'<table><thead><tr><th>Member</th><th>Device</th><th>Last IP</th><th>Last seen UTC</th><th>Control</th></tr></thead><tbody>'+sr+'</tbody></table></section>'+
 '<section><h2>Security audit — latest 200 events</h2><p>Server-observed login and administrative security activity. No passwords or session tokens are displayed.</p><table><thead><tr><th>UTC</th><th>Username</th><th>Event</th><th>Device</th><th>IP</th></tr></thead><tbody>'+er+'</tbody></table></section></main></body></html>';
}
async function securityPanel(req,res,url){
 if(!await ownerAccess(req)){res.writeHead(403);res.end('Owner access required');return;}
 if(req.method==='GET'&&url.pathname==='/user-panel/security/'){
  const [state,events,sessions]=await Promise.all([
   pool.query('SELECT locked,changed_at FROM unified_security_state WHERE singleton=true'),
   pool.query('SELECT username,action,ip,device_label,at FROM unified_security_events ORDER BY id DESC LIMIT 200'),
   pool.query('SELECT d.*,m.username,h.device_label FROM ata24_devices d JOIN unified_members m USING(account_tier) LEFT JOIN unified_member_devices h USING(account_tier,device_hash) ORDER BY d.last_seen DESC')]);
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(securityPanelHTML(state.rows[0],events.rows,sessions.rows,req,url.searchParams.get('message')?.slice(0,120)));return;
 }
 if(req.method!=='POST'||url.pathname!=='/api/user-panel/security'||!sameOriginRequest(req)){res.writeHead(403);res.end('Origin or method denied');return;}
 const p=new URLSearchParams(await body(req)),action=p.get('action'),client=await pool.connect();
 let message='No change',closeStreams=false;
 try{
  await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(73724003)');
  if(!await confirmOwnerPassword(client,req,p.get('owner_password'))){message='Owner authentication failed or rate limited';}
  else{
   const current=hash(cookies(req)[TOKEN_COOKIE]||'');
   const lock=action==='lockdown'&&p.get('confirm')==='LOCKDOWN',all=action==='revoke_others'&&p.get('confirm')==='REVOKE',one=action==='revoke_session'&&/^[a-f0-9]{64}$/.test(p.get('device')||'');
   if(lock||all||one){
    if(lock)await client.query('UPDATE unified_security_state SET locked=true,changed_at=now() WHERE singleton=true');
    const removed=await client.query('DELETE FROM ata24_devices WHERE session_hash<>$1 AND ($2::text IS NULL OR device_hash=$2) RETURNING account_tier,device_hash,last_seen',[current,one?p.get('device'):null]);
    for(const d of removed.rows){await client.query('UPDATE unified_member_devices SET last_seen=GREATEST(last_seen,$3) WHERE account_tier=$1 AND device_hash=$2',[d.account_tier,d.device_hash,d.last_seen]);await memberEvent(client,d.account_tier,lock?'LOCKDOWN_REVOKE':'SECURITY_REVOKE',d.device_hash,UNLIMITED_USER);}
    await securityEvent(client,req,UNLIMITED_USER,lock?'LOCKDOWN_ENABLED':all?'REVOKE_OTHER_SESSIONS':'REVOKE_SESSION');
    message=lock?'Lockdown active; other Unified sessions revoked':removed.rowCount+' Unified session(s) revoked';closeStreams=lock||all||one;
   }else if(action==='unlock'){
    await client.query('UPDATE unified_security_state SET locked=false,changed_at=now() WHERE singleton=true');
    await securityEvent(client,req,UNLIMITED_USER,'LOCKDOWN_DISABLED');message='Normal access restored';
   }
  }
  await client.query('COMMIT');
 }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
 if(closeStreams){for(const stream of securityCrewStreams){try{stream.end();}catch(_){}}for(const socket of securityCrewSockets){try{socket.close(1008,'Session revoked');}catch(_){}}}
 redirect(res,'/user-panel/security/?message='+encodeURIComponent(message));
}
async function initializeMembers(){
  await pool.query("CREATE TABLE IF NOT EXISTS unified_security_state (singleton boolean PRIMARY KEY CHECK(singleton), locked boolean NOT NULL DEFAULT false, changed_at timestamptz NOT NULL DEFAULT now())");
  await pool.query("INSERT INTO unified_security_state(singleton) VALUES(true) ON CONFLICT DO NOTHING");
  await pool.query("CREATE TABLE IF NOT EXISTS unified_security_events (id bigserial PRIMARY KEY, username text NOT NULL, action text NOT NULL, ip text NOT NULL, device_label text NOT NULL, at timestamptz NOT NULL DEFAULT now())");
  await pool.query("CREATE TABLE IF NOT EXISTS unified_members (account_tier text PRIMARY KEY, username_key text UNIQUE NOT NULL, username text NOT NULL, verifier text, suspended boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now())");
  await pool.query("CREATE TABLE IF NOT EXISTS unified_member_devices (account_tier text NOT NULL, device_hash text NOT NULL, agent text NOT NULL, ip text NOT NULL, first_seen timestamptz NOT NULL, last_seen timestamptz NOT NULL, PRIMARY KEY(account_tier,device_hash))");
  await pool.query("CREATE TABLE IF NOT EXISTS unified_member_events (id bigserial PRIMARY KEY, account_tier text NOT NULL, action text NOT NULL, device_hash text, actor text, at timestamptz NOT NULL DEFAULT now())");
  await pool.query("ALTER TABLE unified_member_devices ADD COLUMN IF NOT EXISTS device_label text");
  await pool.query("ALTER TABLE unified_member_events ADD COLUMN IF NOT EXISTS device_label text");
  await pool.query("ALTER TABLE unified_member_events ADD COLUMN IF NOT EXISTS ip text");
  await pool.query("ALTER TABLE ata24_devices ADD COLUMN IF NOT EXISTS presence_started_at timestamptz");
  await pool.query("CREATE INDEX IF NOT EXISTS unified_member_events_account_at ON unified_member_events(account_tier,at DESC)");
  for(const [tier,name] of [['unlimited',UNLIMITED_USER],['guest',USER],...Object.keys(EXTRA_USERS).map(name=>['user:'+name.toLowerCase(),name])]){
    await pool.query("INSERT INTO unified_members(account_tier,username_key,username) VALUES($1,$2,$3) ON CONFLICT(account_tier) DO NOTHING",[tier,name.toLowerCase(),name]);
  }
  await pool.query("INSERT INTO unified_member_devices(account_tier,device_hash,agent,ip,first_seen,last_seen) SELECT account_tier,device_hash,device_user_agent,last_ip,registered_at,last_seen FROM ata24_devices ON CONFLICT(account_tier,device_hash) DO UPDATE SET last_seen=GREATEST(unified_member_devices.last_seen,EXCLUDED.last_seen)");
}
async function memberEvent(db,tier,action,device,actor,label=null,ip=null){
  await db.query('INSERT INTO unified_member_events(account_tier,action,device_hash,actor,device_label,ip) VALUES($1,$2,$3,$4,$5,$6)',[tier,action,device,actor,label,ip]);
}
const userPanelScript="(function(){\n 'use strict';\n if(window.top!==window.self)return;\n function mount(){\n  const brand=document.querySelector('#unifiedWelcome .welcome-card > .welcome-brand');\n  if(!brand||!brand.querySelector('#unifiedWelcomeTitle'))return false;\n  if(document.getElementById('unifiedUserPanelLink'))return true;\n  const style=document.createElement('style');style.id='unifiedOwnerHeaderStyle';\n  style.textContent=\n   '#unifiedWelcome #unifiedUserPanelLink{display:none}'+\n   '#unifiedWelcome[data-stage=\"setup\"] .welcome-brand.owner-header{display:flex;align-items:center;gap:16px;min-width:0;flex-wrap:nowrap}'+\n   '#unifiedWelcome[data-stage=\"setup\"] .welcome-brand.owner-header>img{flex:0 0 58px}'+\n   '#unifiedWelcome[data-stage=\"setup\"] .welcome-brand.owner-header>h1{flex:1 1 auto;min-width:0}'+\n   '#unifiedWelcome[data-stage=\"setup\"] #unifiedUserPanelLink{display:flex;flex:0 0 auto;align-items:center;gap:11px;margin-left:auto;padding:8px 12px 8px 9px;border:1px solid #385767;border-radius:11px;background:linear-gradient(135deg,#182d37,#101c24);color:#eef8fb;text-decoration:none;box-shadow:0 4px 18px #0003;transition:background .15s,border-color .15s;white-space:nowrap}'+\n   '#unifiedWelcome #unifiedUserPanelLink:hover,#unifiedWelcome #unifiedUserPanelLink:focus-visible{border-color:#78d9d2;background:#1a373d;outline:none}'+\n   '#unifiedWelcome .owner-panel-icon{display:grid;place-items:center;width:34px;height:34px;flex:none;border-radius:8px;color:#8de3dc;background:#213e43;border:1px solid #365f62}'+\n   '#unifiedWelcome .owner-panel-icon svg{width:19px;height:19px}'+\n   '#unifiedWelcome .owner-panel-label{display:grid;gap:2px;line-height:1.1;text-align:left}'+\n   '#unifiedWelcome .owner-panel-label small{font:600 9px system-ui;letter-spacing:1.1px;color:#8aadb9}'+\n   '#unifiedWelcome .owner-panel-label strong{font:650 14px system-ui;color:#eaf7fb}'+\n   '#unifiedWelcome .owner-panel-arrow{color:#8aadb9;font-size:18px;line-height:1;margin-left:4px}'+\n   '@media(max-width:760px){#unifiedWelcome[data-stage=\"setup\"] .welcome-brand.owner-header{gap:10px}#unifiedWelcome[data-stage=\"setup\"] .welcome-brand.owner-header>h1{font-size:clamp(16px,3.3vw,27px)}#unifiedWelcome[data-stage=\"setup\"] #unifiedUserPanelLink{gap:7px;padding:7px}#unifiedWelcome .owner-panel-arrow{display:none}#unifiedWelcome .owner-panel-label small{font-size:8px;letter-spacing:.5px}#unifiedWelcome .owner-panel-label strong{font-size:12px}}'+\n   '@media(max-width:500px){#unifiedWelcome[data-stage=\"setup\"] .welcome-brand.owner-header>img{flex-basis:42px;width:42px;height:42px}#unifiedWelcome .owner-panel-label{display:none}#unifiedWelcome .owner-panel-icon{width:32px;height:32px}#unifiedWelcome[data-stage=\"setup\"] #unifiedUserPanelLink{padding:4px}}';\n  document.head.append(style);\n  const a=document.createElement('a');a.id='unifiedUserPanelLink';a.href='/user-panel/';a.title='User Panel — manage members and devices';a.setAttribute('aria-label','User Panel — administration');\n  a.innerHTML='<span class=\"owner-panel-icon\" aria-hidden=\"true\"><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.7\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M12 22s8-3.5 8-11V5l-8-3-8 3v6c0 7.5 8 11 8 11Z\"/><circle cx=\"12\" cy=\"9\" r=\"2.3\"/><path d=\"M8.2 15.3c.5-2 1.8-3 3.8-3s3.3 1 3.8 3\"/></svg></span><span class=\"owner-panel-label\"><small>ADMIN ACCESS</small><strong>User Panel</strong></span><span class=\"owner-panel-arrow\" aria-hidden=\"true\">›</span>';\n  brand.classList.add('owner-header');brand.append(a);\n  return true;\n }\n fetch('/api/user-panel/access',{credentials:'same-origin',cache:'no-store'}).then(r=>r.ok?r.json():null).then(x=>{\n  if(!x||!x.owner)return;\n  if(mount())return;\n  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});\n  observer.observe(document.body||document.documentElement,{subtree:true,childList:true});\n }).catch(()=>{});\n})();";
function memberPanelHTML(members,devices,events,message){
  const E=escapeHtml;
  const stamp=v=>v?new Date(v).toISOString().replace('T',' ').slice(0,19):'—';
  const action=(tier,kind,label)=>'<form method="post" action="/api/user-panel/change"><input type="hidden" name="tier" value="'+E(tier)+'"><input type="hidden" name="action" value="'+kind+'"><button type="submit" class="'+(kind==='suspend'?'danger':'')+'">'+label+'</button></form>';
  const rows=members.map(m=>'<tr><td><strong>'+E(m.username)+'</strong><small>'+E(m.account_tier==='unlimited'?'Owner':'Member')+'</small></td><td><span class="'+(m.suspended?'off':'on')+'">'+(m.suspended?'Suspended':'Active')+'</span></td><td>'+E(m.registered)+' / '+(m.account_tier==='unlimited'?'Unlimited':'3')+'</td><td>'+E(m.online)+'</td><td>'+E(m.unique_devices)+'</td><td>'+E(m.logins)+'</td><td>'+stamp(m.last_login)+'</td><td class="actions">'+(m.account_tier==='unlimited'?'Protected owner':action(m.account_tier,m.suspended?'activate':'suspend',m.suspended?'Activate':'Suspend')+'<form method="post" action="/api/user-panel/change"><input type="hidden" name="tier" value="'+E(m.account_tier)+'"><input type="hidden" name="action" value="password"><input type="password" name="password" placeholder="New password" minlength="8" maxlength="200" required autocomplete="new-password" aria-label="New password"><button>Reset password</button></form>')+'</td></tr>').join('');
  const ds=devices.map(d=>'<tr><td>'+E(d.username||d.account_tier)+'</td><td>'+E(d.device_label||describeMemberDevice(d.agent))+'<details><summary>Device details</summary><small>'+E(d.agent)+'</small></details><small>ID '+E(d.device_hash.slice(0,12))+'</small></td><td>'+E(d.ip||'—')+'</td><td>'+stamp(d.first_seen)+'</td><td>'+stamp(d.last_seen)+'</td><td>'+(!d.registered?'Released':d.online?'Online':'Offline (registered)')+'</td><td>'+(d.registered&&d.account_tier!=='unlimited'?'<form method="post" action="/api/user-panel/change"><input type="hidden" name="action" value="revoke"><input type="hidden" name="tier" value="'+E(d.account_tier)+'"><input type="hidden" name="device" value="'+E(d.device_hash)+'"><button class="danger">Revoke</button></form>':'—')+'</td></tr>').join('');
  const es=events.map(e=>'<tr><td>'+stamp(e.at)+'</td><td>'+E(e.username||e.account_tier)+'</td><td>'+E(e.action)+'</td><td>'+E(e.device_label||'—')+'<small>'+E(e.device_hash?.slice(0,12)||'—')+'</small></td><td>'+E(e.ip||'—')+'</td><td>'+E(e.actor||'—')+'</td></tr>').join('')||'<tr><td colspan="6">No recorded events yet. Existing sessions will appear on their next heartbeat.</td></tr>';
  const sum=k=>members.reduce((n,m)=>n+Number(m[k]||0),0);
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>User Panel | B737 Classic Unified</title><style>*,*::before,*::after{box-sizing:border-box}body{margin:0;background:#0b1520;color:#e9f3fa;font:14px system-ui,Arial,sans-serif}main{max-width:1500px;margin:auto;padding:24px}a{color:#94d7ff}h1{font-size:28px;margin:10px 0}h2{font-size:18px}p,small{color:#9eb7c9}small{display:block;margin-top:5px}header,.stats,.actions,form{display:flex;gap:10px;align-items:center;flex-wrap:wrap}header{justify-content:space-between}.stats{margin:20px 0}.metric,section{background:#132331;border:1px solid #2c4659;border-radius:12px;padding:16px}.metric{flex:1;min-width:140px}.metric strong{display:block;font-size:28px;margin-top:7px}section{margin:14px 0;overflow:auto}table{width:100%;border-collapse:collapse}td,th{text-align:left;padding:12px 9px;border-bottom:1px solid #314455;vertical-align:top}th{color:#adc5d7;white-space:nowrap;font-size:12px}td{overflow-wrap:anywhere}input,button{border:1px solid #45677c;background:#0b1925;color:#effaff;padding:9px;border-radius:7px;font:inherit}button{background:#246081;cursor:pointer;font-weight:650}button.danger{background:#843943}.on{color:#7de2b2}.off{color:#ff9b9b}.notice{border:1px solid #486e85;padding:10px;border-radius:8px}.actions{min-width:210px}.actions input{width:140px}label{display:flex;flex-direction:column;gap:5px}@media(max-width:600px){main{padding:12px}section{padding:10px}}</style></head><body><main><header><div><small>B737 CLASSIC / ADMINISTRATION</small><h1>User Panel</h1></div><div><a href="/panel-mosaic-lab/unified/">Back to Unified</a> · <a href="/user-panel/">Refresh</a> · <a href="/user-panel/security/">Security Center</a></div></header>'+
  (message?'<p class="notice" role="status">'+E(message)+'</p>':'')+
  '<div class="stats"><div class="metric">Members<strong>'+members.length+'</strong></div><div class="metric">Suspended<strong>'+members.filter(m=>m.suspended).length+'</strong></div><div class="metric">Registered devices<strong>'+sum('registered')+'</strong></div><div class="metric">Online (last 2 min)<strong>'+sum('online')+'</strong></div></div>'+
  '<section><h2>Create member</h2><form method="post" action="/api/user-panel/change"><input type="hidden" name="action" value="create"><label>Username<input name="username" required pattern="[A-Za-z0-9][A-Za-z0-9_.-]{2,39}" maxlength="40" autocomplete="off"></label><label>Initial password<input name="password" type="password" minlength="8" maxlength="200" required autocomplete="new-password"></label><button>Create member</button></form><p>Each new member has three registered browser-profile slots. Suspending or resetting a password revokes all existing sessions. Owner access is protected.</p></section>'+
  '<section><h2>Members</h2><table><thead><tr><th>Username</th><th>Status</th><th>Registered / cap</th><th>Online</th><th>Unique history</th><th>Logins recorded</th><th>Last login UTC</th><th>Controls</th></tr></thead><tbody>'+rows+'</tbody></table></section>'+
  '<section><h2>Device registry and history</h2><p>Device names are derived from browser reports. A unique device is a persistent browser profile, not a hardware serial number. Online means a heartbeat within 2 minutes. Earlier registrations are retained; missing historical events are not invented.</p><table><thead><tr><th>Member</th><th>Browser / OS</th><th>Last IP</th><th>First seen UTC</th><th>Last seen UTC</th><th>State</th><th>Control</th></tr></thead><tbody>'+ds+'</tbody></table></section>'+
  '<section><h2>Activity log — latest 200 events</h2><table><thead><tr><th>UTC</th><th>Member</th><th>Event</th><th>Device / ID</th><th>IP at event</th><th>Admin</th></tr></thead><tbody>'+es+'</tbody></table></section></main></body></html>';
}
async function userPanel(req,res,url){
  if(!await ownerAccess(req)){res.writeHead(403,{'Content-Type':'text/plain'});res.end('Owner access required');return;}
  if(req.method==='GET'&&url.pathname==='/user-panel/'){
    const members=(await pool.query("SELECT m.account_tier,m.username,m.suspended,(SELECT count(*)::int FROM ata24_devices d WHERE d.account_tier=m.account_tier) AS registered,(SELECT count(*)::int FROM ata24_devices d WHERE d.account_tier=m.account_tier AND d.last_seen>now()-interval '2 minutes') AS online,(SELECT count(*)::int FROM unified_member_devices h WHERE h.account_tier=m.account_tier) AS unique_devices,(SELECT count(*)::int FROM unified_member_events e WHERE e.account_tier=m.account_tier AND e.action='LOGIN') AS logins,(SELECT max(at) FROM unified_member_events e WHERE e.account_tier=m.account_tier AND e.action='LOGIN') AS last_login FROM unified_members m ORDER BY (m.account_tier='unlimited') DESC,m.username_key")).rows;
    const devices=(await pool.query("SELECT h.*,m.username,COALESCE(d.last_seen,h.last_seen) AS last_seen,(d.device_hash IS NOT NULL) AS registered,COALESCE(d.last_seen>now()-interval '2 minutes',false) AS online FROM unified_member_devices h LEFT JOIN unified_members m USING(account_tier) LEFT JOIN ata24_devices d USING(account_tier,device_hash) ORDER BY h.account_tier,COALESCE(d.last_seen,h.last_seen) DESC")).rows;
    const events=(await pool.query("SELECT e.*,m.username FROM unified_member_events e LEFT JOIN unified_members m USING(account_tier) ORDER BY e.id DESC LIMIT 200")).rows;
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(memberPanelHTML(members,devices,events,url.searchParams.get('message')?.slice(0,150)).replaceAll('<form method="post" action="/api/user-panel/change">','<form method="post" action="/api/user-panel/change"><input type="password" name="owner_password" placeholder="Owner password" aria-label="Owner password" required maxlength="200" autocomplete="current-password">'));return;
  }
  if(req.method!=='POST'||url.pathname!=='/api/user-panel/change'||!sameOriginRequest(req)){res.writeHead(403);res.end('Origin or method denied');return;}
  const p=new URLSearchParams(await body(req)), action=p.get('action'), tier=p.get('tier'), password=p.get('password')||'';
  const client=await pool.connect();let message='No change';
  try{
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(73724003)');
    if(!await confirmOwnerPassword(client,req,p.get('owner_password'))){message='Owner authentication failed or rate limited';}
    else if(action==='create'){
      const name=(p.get('username')||'').trim(), key=name.toLowerCase();
      if(!/^[A-Za-z0-9][A-Za-z0-9_.-]{2,39}$/.test(name)||password.length<8||password.length>200)message='Invalid username or password (minimum 8 characters)';
      else if(crewReady&&(await client.query('SELECT 1 FROM unified_crew_accounts WHERE account_key=$1',[key])).rowCount)message='Username already in use by a Private Room account';
      else{
        const salt=crypto.randomBytes(16).toString('hex'), verifier='scrypt:'+salt+':'+crypto.scryptSync(password,salt,64).toString('hex'), newTier='user:'+key;
        const inserted=await client.query('INSERT INTO unified_members(account_tier,username_key,username,verifier) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[newTier,key,name,verifier]);
        if(inserted.rowCount){await memberEvent(client,newTier,'CREATE',null,UNLIMITED_USER);message='Member created';}else message='Username already in use';
      }
    }else if(tier&&tier!=='unlimited'&&(await client.query('SELECT 1 FROM unified_members WHERE account_tier=$1',[tier])).rowCount){
      if(action==='suspend'||action==='activate'){
        const changed=await client.query('UPDATE unified_members SET suspended=$2 WHERE account_tier=$1 AND suspended<>$2',[tier,action==='suspend']);
        if(action==='suspend')await releaseMemberDevices(client,tier,null);
        if(changed.rowCount)await memberEvent(client,tier,action.toUpperCase(),null,UNLIMITED_USER);
        message=action==='suspend'?'Member suspended; sessions revoked':'Member activated';
      }else if(action==='password'){
        if(password.length<8||password.length>200)message='Password must contain 8 to 200 characters';
        else{
          const salt=crypto.randomBytes(16).toString('hex'), verifier='scrypt:'+salt+':'+crypto.scryptSync(password,salt,64).toString('hex');
          await client.query('UPDATE unified_members SET verifier=$2 WHERE account_tier=$1',[tier,verifier]);
          await releaseMemberDevices(client,tier,null);await memberEvent(client,tier,'PASSWORD_RESET',null,UNLIMITED_USER);message='Password changed; sessions revoked';
        }
      }else if(action==='revoke'){
        const device=p.get('device')||'';
        if(/^[a-f0-9]{64}$/.test(device)){
          const n=await releaseMemberDevices(client,tier,device);
          if(n)await memberEvent(client,tier,'REVOKE',device,UNLIMITED_USER);
          message=n?'Device revoked':'Device was already released';
        }
      }
    }else message='Invalid member or protected owner';
    await client.query('COMMIT');
  }catch(e){await client.query('ROLLBACK').catch(()=>{});throw e;}finally{client.release();}
  redirect(res,'/user-panel/?message='+encodeURIComponent(message));
}
async function releaseMemberDevices(db,tier,device){
  const result=await db.query('DELETE FROM ata24_devices WHERE account_tier=$1 AND ($2::text IS NULL OR device_hash=$2) RETURNING device_hash,last_seen',[tier,device]);
  for(const row of result.rows)await db.query('UPDATE unified_member_devices SET last_seen=GREATEST(last_seen,$3) WHERE account_tier=$1 AND device_hash=$2',[tier,row.device_hash,row.last_seen]);
  return result.rowCount;
}

function crewMayRead(url, role) {
  if (['/static/session.js','/static/guest-cockpit.js','/static/guest-cockpit.css','/static/user-panel.js'].includes(url.pathname) ||
      directDocuments.has(url.pathname) || navdata.supports(url.pathname) || iranNavdata.supports(url.pathname)) return true;
  const asset = repoAssetPath(url.pathname);
  if (!asset) return false;
  if (role === 'instructor') return true;
  if (!asset.endsWith('.html')) return true;
  return ['panel-mosaic-lab/cockpit/overhead-stage.html',
    'panel-mosaic-lab/cockpit/cdu-stage.html','cdu-standalone-v6/index.html','cb-panel-lab/index.html'].includes(asset);
}

async function handle(req,res) {
  commonHeaders(req,res);
  const url=new URL(req.url,'http://localhost');
  if (url.pathname==='/healthz') { res.writeHead(200,{'Content-Type':'text/plain'});res.end('ok');return; }
  if(crewReady && (url.pathname==='/api/crew' || url.pathname.startsWith('/api/crew/'))){
    if(await securityLocked()){res.writeHead(503,{'Content-Type':'application/json'});res.end(JSON.stringify({error:'Private Room paused by owner'}));return;}
    if(url.pathname==='/api/crew/events'){securityCrewStreams.add(res);res.once('close',()=>securityCrewStreams.delete(res));}
    crew.handle(req,res);return;
  }
  if(serveCrewEntry(req,res,url))return;

  if (req.method==='GET' && url.pathname==='/login') {
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
    res.end(loginHTML(url.searchParams.get('e')));return;
  }
  if (req.method==='POST' && url.pathname==='/api/login') { await signIn(req,res);return; }
  // Public shell only: first top-level navigation changes the popup's site
  // from GitHub Pages to Railway. Lax cookies allow safe top-level links
  // without sending credentials on cross-site POSTs.
  if(req.method==='GET'&&url.pathname==='/navdata-relay/start'){
    const nonce=url.searchParams.get('nonce');
    if(!/^[a-f0-9]{32}$/.test(nonce||'')){
      res.writeHead(400,{'Content-Type':'text/plain'});res.end('INVALID_NONCE');return;
    }
    res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'");
    res.setHeader('Cross-Origin-Opener-Policy','unsafe-none');
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    res.end('<!doctype html><html><head><meta charset="utf-8"></head><body>'+ 
      '<script>location.replace("/navdata-relay?nonce='+nonce+'");</script></body></html>');
    return;
  }
  if(req.method==='GET'&&url.pathname==='/api/user-panel/access'){
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify({owner:await ownerAccess(req)}));return;
  }
  if(req.method==='GET'&&url.pathname==='/static/user-panel.js'){
    res.writeHead(200,{'Content-Type':'text/javascript; charset=utf-8'});res.end(userPanelScript);return;
  }
  const authStarted=performance.now();
  const ok=await authorized(req);
  const authMs=performance.now()-authStarted;
  const candidate = !ok && crewCockpitReady ? crew.cockpitAccess(req) : null;
  const crewGuest = candidate && !await securityLocked() ? candidate : null;
  if (crewGuest) {
    const assetRequest = ['GET','HEAD'].includes(req.method);
    const pulse = req.method==='POST' && url.pathname==='/api/pulse';
    if (pulse) { res.writeHead(204);res.end();return; }
    if (assetRequest && (url.pathname==='/' || url.pathname==='/'+cockpitSource)) {
      redirect(res,directPath+'?crewRoom='+crewGuest.roomId);return;
    }
    if (assetRequest && url.pathname===directPath && url.searchParams.get('crewRoom')!==crewGuest.roomId) {
      url.searchParams.set('crewRoom',crewGuest.roomId);
      redirect(res,url.pathname+url.search);return;
    }
    if (!assetRequest || !crewMayRead(url,crewGuest.role)) {
      res.writeHead(403,{'Content-Type':'text/plain'});res.end('Crew access denied');return;
    }
  }
  if (!ok && !crewGuest) {
    // Redirect only actual document navigations. Serving login HTML as a
    // redirected .js/.css/.image response previously produced a blank page
    // and hundreds of GET /login requests after an expired guest session.
    if (req.method==='GET'&&isDocumentNavigation(url.pathname,req.headers)) redirect(res,'/login?e=expired');
    else {
      res.writeHead(401,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'});
      if(req.method==='HEAD')res.end();
      else res.end('Guest session expired; sign in again');
    }
    return;
  }
  if(url.pathname==='/user-panel/security/'||url.pathname==='/api/user-panel/security'){await securityPanel(req,res,url);return;}
  if(url.pathname==='/user-panel/'||url.pathname==='/api/user-panel/change'){await userPanel(req,res,url);return;}
  if(req.method==='GET'&&url.pathname==='/devices'){
    if(!await ownerAccess(req)){res.writeHead(403,{'Content-Type':'text/plain'});res.end('Owner access required');return;}
    redirect(res,'/user-panel/');return;
  }
  if(req.method==='POST'&&url.pathname==='/api/devices/revoke'){res.writeHead(403);res.end('Use User Panel with owner password confirmation');return;}
  if (req.method==='POST' && url.pathname==='/api/pulse') {
    const token=cookies(req)[TOKEN_COOKIE];
    if(token) {
      const {agent,ip,label}=memberRequestInfo(req);
      const updated=await pool.query(
        `WITH prior AS (
          SELECT d.device_hash,d.account_tier,d.last_seen,d.presence_started_at
          FROM ata24_devices d JOIN unified_members m USING(account_tier)
          WHERE d.session_hash=$1 AND NOT m.suspended FOR UPDATE OF d
        ), touched AS (
          UPDATE ata24_devices d SET last_seen=now(),
            device_user_agent=CASE WHEN $2='Unknown browser' THEN d.device_user_agent ELSE $2 END,
            last_ip=CASE WHEN $3='' THEN d.last_ip ELSE $3 END,
            presence_started_at=CASE WHEN p.presence_started_at IS NULL OR p.last_seen<=now()-interval '2 minutes'
              THEN now() ELSE p.presence_started_at END
          FROM prior p WHERE d.device_hash=p.device_hash
          RETURNING d.account_tier,d.device_hash,d.device_user_agent,d.last_ip,d.registered_at,d.last_seen,
            (p.presence_started_at IS NULL OR p.last_seen<=now()-interval '2 minutes') AS connected
        ), history AS (
          INSERT INTO unified_member_devices(account_tier,device_hash,agent,ip,first_seen,last_seen,device_label)
          SELECT account_tier,device_hash,device_user_agent,last_ip,registered_at,last_seen,
            CASE WHEN $2='Unknown browser' THEN NULL ELSE $4 END FROM touched
          ON CONFLICT(account_tier,device_hash) DO UPDATE SET agent=EXCLUDED.agent,ip=EXCLUDED.ip,last_seen=EXCLUDED.last_seen,
            device_label=CASE WHEN EXCLUDED.device_label IS NULL THEN unified_member_devices.device_label
              WHEN unified_member_devices.agent=EXCLUDED.agent AND
                ((EXCLUDED.device_label LIKE 'Windows 10/11 %' AND unified_member_devices.device_label ~ '^WIN(10|11) ') OR
                 (EXCLUDED.device_label LIKE 'macOS %' AND unified_member_devices.device_label LIKE 'iPad %'))
              THEN unified_member_devices.device_label ELSE EXCLUDED.device_label END
          RETURNING account_tier,device_hash,device_label,ip
        ), event AS (
          INSERT INTO unified_member_events(account_tier,action,device_hash,device_label,ip)
          SELECT t.account_tier,'CONNECTED',t.device_hash,h.device_label,h.ip
          FROM touched t JOIN history h USING(account_tier,device_hash) WHERE t.connected
          RETURNING id
        ) SELECT account_tier FROM touched`,
        [hash(token),agent,ip,label]
      );
      if(updated.rowCount!==1){res.writeHead(401);res.end();return;}
      // Keep persistent cookies refreshed for owners and registered guests.
      if(updated.rowCount===1){
        const owner=updated.rows[0].account_tier==='unlimited';
        const device=cookies(req)[DEVICE_COOKIE];
        const cookiesToSet=[cookie(req,TOKEN_COOKIE,token,owner?OWNER_SESSION_SECONDS:GUEST_SESSION_SECONDS,'Lax')];
        if(device&&/^[A-Za-z0-9_-]{32,128}$/.test(device))
          cookiesToSet.push(cookie(req,DEVICE_COOKIE,device,owner?OWNER_SESSION_SECONDS:DEVICE_SESSION_SECONDS,'Lax'));
        res.setHeader('Set-Cookie',cookiesToSet);
      }
    }
    res.writeHead(204);res.end();return;
  }
  if (req.method==='POST' && url.pathname==='/api/logout') {
    const token=cookies(req)[TOKEN_COOKIE];
    if (token){
      const removed=await pool.query('DELETE FROM ata24_devices WHERE session_hash=$1 RETURNING account_tier,device_hash,last_seen,device_user_agent,last_ip',[hash(token)]);
      for(const d of removed.rows){
        await pool.query('UPDATE unified_member_devices SET last_seen=GREATEST(last_seen,$3) WHERE account_tier=$1 AND device_hash=$2',[d.account_tier,d.device_hash,d.last_seen]);
        const h=(await pool.query('SELECT device_label FROM unified_member_devices WHERE account_tier=$1 AND device_hash=$2',[d.account_tier,d.device_hash])).rows[0];
        await memberEvent(pool,d.account_tier,'LOGOUT',d.device_hash,null,h?.device_label||describeMemberDevice(d.device_user_agent),d.last_ip);
      }
    }
    redirect(res,'/login',{'Set-Cookie':cookie(req,TOKEN_COOKIE,'',0)});return;
  }
  // Owner-only import; the legacy dataset is left intact until client migration.
  if(req.method==='POST'&&url.pathname==='/api/iran-navdata/import'){
    res.setHeader('Cache-Control','private, no-store');
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if(!sameOriginRequest(req)||!await ownerAccess(req)){res.writeHead(403);res.end(JSON.stringify({error:'OWNER_ACCESS_REQUIRED'}));return;}
    try{const input=await readPrivateNavData(req);const result=await iranNavdata.importData(input);res.writeHead(200);res.end(JSON.stringify(result));return;}
    catch(e){res.writeHead(422);res.end(JSON.stringify({error:String(e.message||'INVALID_NAVDATA').slice(0,120)}));return;}
  }
  if(req.method==='GET'&&iranNavdata.supports(url.pathname)){
    const {status,body}=await iranNavdata.lookup(url);
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin','X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify(body));return;
  }
  // Source files stay in Railway PostgreSQL and require the established user session.
  if(req.method==='POST'&&url.pathname==='/api/navdata/import'){
    if(!sameOriginRequest(req)){
      res.writeHead(403,{'Content-Type':'application/json'});res.end('{"error":"CROSS_ORIGIN_DENIED"}');return;
    }
    try{
      const input=await readPrivateNavData(req),result=await navdata.importData(input);
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify(result));return;
    }catch(e){
      res.writeHead(422,{'Content-Type':'application/json','Cache-Control':'no-store'});
      res.end(JSON.stringify({error:String(e.message||'INVALID_NAVDATA').slice(0,120)}));return;
    }
  }
  // Session-gated top-level popup for private NAVDATA on GitHub Pages.
  if(req.method==='GET'&&url.pathname==='/navdata-relay'){
   const html=NavdataRelay.relayHtml(url.searchParams.get('nonce'));
   if(!html){res.writeHead(400,{'Content-Type':'text/plain'});res.end('INVALID_NONCE');return;}
   res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
   res.setHeader('Cross-Origin-Opener-Policy','unsafe-none');
   res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'private, no-store'});
   res.end(html);return;
  }
  // This authenticated import advertises only the local CDU/EHSI reference fields.
  if(req.method==='GET'&&url.pathname==='/api/navdata/local-reference'){
    const site=req.headers['sec-fetch-site'];
    if(req.headers['x-unified-navdata']!=='local-reference'||(site&&site!=='same-origin')){
      res.writeHead(403,{'Content-Type':'application/json','Cache-Control':'private, no-store'});
      res.end('{"error":"CROSS_ORIGIN_DENIED"}');return;
    }
    const {status,body}=await navdata.lookup(url);
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin',
      'X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify(body));return;
  }
  // Airway names alone are not proof of connectivity. Confirm membership
  // at the preceding exact georeferenced fix; do not infer routable FMC legs.
  if(req.method==='GET'&&url.pathname==='/api/cdu/airway-check'){
    const from=String(url.searchParams.get('from')||'').toUpperCase();
    const airway=String(url.searchParams.get('airway')||'').toUpperCase();
    const toRaw=url.searchParams.get('to'),to=toRaw===null?null:String(toRaw).toUpperCase();
    const latitude=url.searchParams.get('lat'),longitude=url.searchParams.get('lon');
    const record=Object.hasOwn(AIRWAY_REFERENCE,from)?AIRWAY_REFERENCE[from]:null;
    const supplied=latitude!==null&&longitude!==null&&latitude!==''&&longitude!=='';
    const lat=supplied?Number(latitude):NaN,lon=supplied?Number(longitude):NaN;
    if(!/^[A-Z0-9]{2,8}$/.test(from)||!/^[A-Z0-9]{2,8}$/.test(airway)||
       (to!==null&&!/^[A-Z0-9]{2,8}$/.test(to))){
      res.writeHead(400,{'Content-Type':'application/json','Cache-Control':'private, no-store'});
      res.end('{"error":"INVALID ENTRY"}');return;
    }
    if(!record||!Array.isArray(record.airways)){
      res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'private, no-store'});
      res.end('{"available":false,"error":"NAV DATA UNAVAILABLE"}');return;
    }
    const near=Number.isFinite(lat)&&Number.isFinite(lon)&&
      Math.abs(lat-record.lat)<=0.02&&Math.abs(lon-record.lon)<=0.02;
    const route=Object.hasOwn(AIRWAY_POINTS,airway)?AIRWAY_POINTS[airway]:null;
    // A VIA-only lookup verifies the entry; a VIA/TO lookup additionally
    // verifies that the exit fix is a *different* fix on the same ordered
    // airway segment. The source does not encode one-way restrictions.
    if(to!==null&&(!Array.isArray(route)||!route.every(x=>typeof x==='string'))){
      res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'private, no-store'});
      res.end('{"available":false,"error":"NAV DATA UNAVAILABLE"}');return;
    }
    const fromIndices=Array.isArray(route)?route.flatMap((ident,i)=>ident===from?[i]:[]):[];
    const toIndices=Array.isArray(route)?route.flatMap((ident,i)=>ident===to?[i]:[]):[];
    const unambiguous=to===null||(fromIndices.length===1&&toIndices.length===1);
    const pathFixes=to!==null&&unambiguous&&fromIndices[0]!==toIndices[0]?
      (fromIndices[0]<toIndices[0]?
       route.slice(fromIndices[0]+1,toIndices[0]+1):
       route.slice(toIndices[0],fromIndices[0]).reverse()):[];
    const valid=near&&record.airways.includes(airway)&&
      (to===null||(unambiguous&&pathFixes.length>0&&pathFixes.at(-1)===to));
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'private, no-store','Cross-Origin-Resource-Policy':'same-origin'});
    res.end(JSON.stringify({source:'OWNER_WPNAVRTE_VERIFIED',fmc_executable:false,
      available:true,valid,from,airway,...(to!==null?{to,fixes:valid?pathFixes:[]}:{})}));return;
  }
  if(req.method==='GET'&&navdata.supports(url.pathname)){
    const {status,body}=await navdata.lookup(url);
    res.writeHead(status,{'Content-Type':'application/json; charset=utf-8',
      'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    res.end(JSON.stringify(body));return;
  }
  if ((req.method==='GET' || req.method==='HEAD') && url.pathname==='/') {
    redirect(res,fastRuntime?directPath:'/panel-mosaic-lab/cockpit/');return;
  }
  if (req.method==='GET' || req.method==='HEAD') {
    // The old standalone entry is retired; shared assets and embedded CDU remain.
    if(cduLab.legacy.test(url.pathname)&&!url.searchParams.has('seat')){redirect(res,cduLab.labPath);return;}
    const document=directDocuments.get(url.pathname);
    const compiled=document&&optimizedSource(document);
    if(compiled){
      await serveFastCompiledResponse(req,res,document,compiled,{
       cockpitDocument:document===cockpitSource+'index.html',direct:true,authMs
      });
      return;
    }
    const sourcePath=repoAssetPath(url.pathname);
    if(sourcePath) {
      await serveGitHubSource(req,res,sourcePath,{
        cockpitDocument:sourcePath==='panel-mosaic-lab/cockpit/index.html',authMs
      });
      return;
    }
  }
  if (req.method==='GET' && Object.hasOwn(assets,url.pathname)) {
    const [filename,type]=assets[url.pathname];
    const contents=await fs.readFile(path.join(folder,filename));
    res.writeHead(200,{'Content-Type':type});
    res.end(contents);return;
  }
  // Authenticated, explicit manifest only. No fallback to the upstream project.
  // Preserve original folder structure for the photo-based overhead and CB engines.
  const rawRuntimePath = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;
  // Asset names may contain spaces and Unicode. Decode only after URL parsing;
  // an exact manifest match is required before reading a filesystem path.
  let runtimePath;
  try { runtimePath = decodeURIComponent(rawRuntimePath); }
  catch (_) {res.writeHead(400);res.end('Bad path');return;}
  if (req.method==='GET' && runtimeFiles.has(runtimePath)) {
    const rel = runtimePath.slice(1);
    const ext = path.extname(rel).toLowerCase();
    const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
      '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
      '.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp',
      '.jpg':'image/jpeg','.jpeg':'image/jpeg'}[ext];
    if (!mime) {res.writeHead(404);res.end();return;}
    const contents = await fs.readFile(path.join(runtimeDir,rel));
    res.writeHead(200,{'Content-Type':mime});
    res.end(contents);return;
  }
  res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');
}
// Persistent ordered command channel. All requests use the existing crew
// authorization, role validation, lockdown checks and receipt deduplication.
function crewSocketRequest(upgrade,action,payload){
 return new Promise(async resolve=>{
  try{
   if(await securityLocked())return resolve({status:503,body:{error:'Private Room paused by owner'}});
   const req=CrewReadable.from([Buffer.from(JSON.stringify(payload))]);
   req.url='/api/crew/'+action;req.method='POST';
   req.headers={...upgrade.headers,'content-type':'application/json'};
   req.socket=upgrade.socket;
   let status=500,done=false;
   const finish=(result)=>{if(!done){done=true;resolve(result);}};
   const res={headersSent:false,writeHead(code){status=code;this.headersSent=true;},
    end(data){let body;try{body=JSON.parse(String(data));}catch{body={error:'Invalid crew response'};}finish({status,body});},
    destroy(){finish({status:500,body:{error:'Crew response failed'}});}};
   crew.handle(req,res);
  }catch{resolve({status:503,body:{error:'Crew service unavailable'}});}
 });
}
function installCrewCommandSocket(httpServer){
 if(!crewCockpitReady)return;
 const wss=new WebSocketServer({noServer:true,maxPayload:12288,perMessageDeflate:false});
 httpServer.on('upgrade',async(req,socket,head)=>{
  const reject=()=>{if(!socket.destroyed){socket.write('HTTP/1.1 403 Forbidden\\r\\nConnection: close\\r\\n\\r\\n');socket.destroy();}};
  try{
   const url=new URL(req.url,crewOrigin),roomId=url.searchParams.get('room'),client=url.searchParams.get('client');
   if(url.pathname!=='/api/crew/socket'||req.headers.origin!==crewOrigin||
     !/^[A-Za-z0-9_-]{32}$/.test(roomId||'')||!/^[a-zA-Z0-9_-]{12,64}$/.test(client||'')||securityCrewSockets.size>=256)return reject();
   const auth=await crewSocketRequest(req,'cockpit',{roomId,client});
   if(auth.status!==200||!['captain','firstOfficer','instructor'].includes(auth.body?.role)||socket.destroyed)return reject();
   wss.handleUpgrade(req,socket,head,ws=>{
    securityCrewSockets.add(ws);let pending=0,chain=Promise.resolve(),halted=false;
    ws.on('error',()=>{halted=true;ws.terminate();});
    ws.on('close',()=>{halted=true;securityCrewSockets.delete(ws);});
    ws.on('message',(data,binary)=>{
     if(halted||binary||++pending>64){halted=true;ws.close(1008,'Command queue limit');return;}
     let msg;try{msg=JSON.parse(data.toString());}catch{halted=true;ws.close(1008,'Invalid command');return;}
     if(!Number.isSafeInteger(msg?.id)||!Array.isArray(msg.commands)||!msg.commands.length||msg.commands.length>24){halted=true;ws.close(1008,'Invalid command');return;}
     chain=chain.then(async()=>{
      if(halted||ws.readyState!==1)return;
      const result=await crewSocketRequest(req,'command',{roomId,client,commands:msg.commands});
      if(ws.readyState!==1)return;
      ws.send(JSON.stringify({id:msg.id,...result}));
      if(result.status===429||result.status>=500||result.status===401||result.status===403){halted=true;ws.close(1013,'Retry using HTTP');}
     }).catch(()=>{halted=true;ws.terminate();}).finally(()=>{pending--;});
    });
   });
  }catch{reject();}
 });
}
async function start() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required: attach a Postgres service.');
  await pool.query('CREATE TABLE IF NOT EXISTS ata24_devices(device_hash text PRIMARY KEY,session_hash text UNIQUE NOT NULL,last_seen timestamptz NOT NULL DEFAULT now())');
  // Migration preserves existing guest sessions and their original cap.
  await pool.query("ALTER TABLE ata24_devices ADD COLUMN IF NOT EXISTS account_tier text NOT NULL DEFAULT 'guest'");
  await pool.query("ALTER TABLE ata24_devices ADD COLUMN IF NOT EXISTS device_user_agent text NOT NULL DEFAULT 'Unknown browser'");
  await pool.query("ALTER TABLE ata24_devices ADD COLUMN IF NOT EXISTS last_ip text NOT NULL DEFAULT ''");
  await pool.query("ALTER TABLE ata24_devices ADD COLUMN IF NOT EXISTS registered_at timestamptz NOT NULL DEFAULT now()");
  await initializeMembers();
  if(crewReady)await pool.query('CREATE TABLE IF NOT EXISTS unified_crew_accounts ('+
    'account_key text PRIMARY KEY, username text NOT NULL, verifier text NOT NULL)');
  if(crewReady)await pool.query('CREATE TABLE IF NOT EXISTS unified_crew_rooms ('+
    'manager text PRIMARY KEY, expires_at bigint NOT NULL, invitation_hash text UNIQUE NOT NULL, room jsonb NOT NULL)');
  await navdata.initialize();
  await iranNavdata.initialize();
  try {const result=await IranBootstrapV2.bootstrap(iranNavdata);console.log('IRAN NAVDATA V2:',JSON.stringify(result));}catch(e){console.error('IRAN NAVDATA V2 IMPORT REJECTED:',e.message);}
  // Imports owner-provided reference data into private PostgreSQL once;
  // never sends the source outside Railway or exposes it as a static asset.
  try{
    const result=await NavdataBootstrap.bootstrapPrivateNavdata(navdata);
    if(result.imported)console.log('Private CDU/SG NAVDATA imported:',result.airports.join(','),'procedures:',result.counts,
      'sha256:',result.sha256);
  }catch(error){
    console.error('Private CDU/SG NAVDATA import rejected:',String(error.message||error));
  }
  // Confirm that private PostgreSQL still contains source data after
  // deployment/restart, including when the one-time transfer is removed.
  try{
    const make=path=>new URL('http://localhost'+path);
    const status=await navdata.lookup(make('/api/source/status'));
    if(status.status===200){
      const sid=await navdata.lookup(make('/api/cdu/catalog?airport=OIII&kind=SID'));
      const approach=await navdata.lookup(make('/api/cdu/catalog?airport=OISS&kind=APP'));
      if(sid.status!==200||approach.status!==200||
         sid.body?.items?.length!==33||approach.body?.items?.length!==17)
        throw Error('PRIVATE_NAVDATA_CATALOG_CHECK_FAILED');
      console.log('Private CDU/SG NAVDATA READY: source status 200; OIII SID 33; OISS APP 17; source only');
    }else console.warn('Private CDU/SG NAVDATA pending import; status',status.status);
  }catch(error){console.error('Private CDU/SG NAVDATA validation failed:',String(error.message||error));}
  if(fastRuntime){
    for(const relative of directDocuments.values()){
      const main=relative===cockpitSource+'index.html';
      const bytes=optimizedSource(relative);
      if(bytes){
        compiledDocument(relative,bytes,main,true);
        compiledDocument(relative,bytes,main,false);
      }
    }
  }
  const httpServer=http.createServer((req,res)=>handle(req,res).catch(e=>{
    console.error('Gateway request failed:',e.message);
    if (!res.headersSent) {res.writeHead(503,{'Content-Type':'text/plain'});res.end('Service temporarily unavailable');}
    else res.end();
  }));
  installCrewCommandSocket(httpServer);
  httpServer.listen(PORT,'0.0.0.0',()=>{
    console.log('ATA24 gateway listening on '+PORT);
    setTimeout(()=>prewarmFastRuntime().catch(e=>console.warn('UNIFIED FAST PREWARM: '+e.message)),1500);
   });
}
start().catch(e=>{console.error('Gateway startup failed:',e.message);process.exit(1);});
