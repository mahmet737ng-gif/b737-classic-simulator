(async()=>{
;
/* ../../engine/afds/fcom-ch4-ap-protection-v1.js?v=FCC-PROTECT-0001 */
try{
/* Boeing 737 Classic FCOM §4.20.2–4.20.4 autopilot protection.
 * Variant-dependent selectors are normalized to named events.
 * Explicit loss evidence is required; UNKNOWN never means FAILED.
 * Only confirmed events may disengage an engaged CMD/CWS autopilot.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FcomCh4APProtectionV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_FCOM_CH4_AP_PROTECTION_0001';
 const REASONS=Object.freeze([
  'CONTROL_WHEEL_AP_DISCONNECT','AP_DISENGAGE_BAR_DOWN',
  'AP_ENGAGE_PADDLE_OFF','ILLUMINATED_AP_ENGAGE_SWITCH',
  'TOGA_BELOW_2000_RA','DUAL_AP_TOGA_AFTER_TOUCHDOWN',
  'CONTROL_WHEEL_TRIM','STAB_TRIM_AUTOPILOT_CUTOUT',
  'AP_A_HYDRAULIC_PRESSURE_LOST','AP_B_HYDRAULIC_PRESSURE_LOST',
  'LEFT_IRS_FAILURE','RIGHT_IRS_FAILURE',
  'ELECTRICAL_POWER_LOST','CRITICAL_SENSOR_INPUT_LOST',
  'EFI_TRANSFER_REPOSITIONED','RADIO_ALT_FAILURE_AFTER_LOC_GS_2S'
 ]);
 const physical=new Set(['CONTROL_WHEEL_AP_DISCONNECT','AP_DISENGAGE_BAR_DOWN',
  'AP_ENGAGE_PADDLE_OFF','ILLUMINATED_AP_ENGAGE_SWITCH',
  'TOGA_BELOW_2000_RA','DUAL_AP_TOGA_AFTER_TOUCHDOWN',
  'CONTROL_WHEEL_TRIM','STAB_TRIM_AUTOPILOT_CUTOUT','EFI_TRANSFER_REPOSITIONED']);
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 function initial(){return {schema:VERSION,raFailureSinceMs:null,reason:null};}
 function evaluate(prev,mcp,input={},nowMs=0){
  if(prev?.schema!==VERSION||!finite(nowMs))throw TypeError('INVALID_PROTECTION_STATE');
  const next={...prev},ap=mcp?.modes?.autopilot||null;
  const engaged=/^(CMD|CWS)_[AB]$/.test(ap);
  if(!engaged){next.raFailureSinceMs=null;return {state:next,disengage:false,reason:null};}
  const checked=(reason,ok)=>ok===true?{state:{...next,reason},disengage:true,reason}:
   {state:next,disengage:false,reason:null};
  // Pilot hardware events must be directly observed and explicitly confirmed.
  if(input.hardware?.confirmed===true&&input.hardware?.source==='COCKPIT_HARDWARE'&&
     physical.has(input.hardware.reason)){
   const reason=input.hardware.reason;
   if(reason==='TOGA_BELOW_2000_RA'&&!(finite(input.radioAltitudeFt)&&input.radioAltitudeFt<2000))
    return checked(reason,false);
   if(reason==='DUAL_AP_TOGA_AFTER_TOUCHDOWN'&&input.touchdown!==true)return checked(reason,false);
   return checked(reason,true);
  }
  if(mcp?.power===false)return checked('ELECTRICAL_POWER_LOST',true);
  if(input.stabTrimAutopilotNormal===false&&input.stabTrimVerified===true)
   return checked('STAB_TRIM_AUTOPILOT_CUTOUT',true);
  if(input.hydraulicsVerified===true){
   if(ap.endsWith('_A')&&input.hydraulicAAvailable===false)
    return checked('AP_A_HYDRAULIC_PRESSURE_LOST',true);
   if(ap.endsWith('_B')&&input.hydraulicBAvailable===false)
    return checked('AP_B_HYDRAULIC_PRESSURE_LOST',true);
  }
  if(input.irsVerified===true){
   if(input.leftIrsFault===true)return checked('LEFT_IRS_FAILURE',true);
   if(input.rightIrsFault===true)return checked('RIGHT_IRS_FAILURE',true);
  }
  if(input.criticalSensorFailureVerified===true&&input.criticalSensorFailed===true)
   return checked('CRITICAL_SENSOR_INPUT_LOST',true);
  // FCOM 4.20.4: with an inoperative RA, disconnect 2 s after LOC & GS
  // capture. Do not assume LOC/GS capture from APP mode selection alone.
  if(input.raFailureVerified===true&&input.radioAltimeterInoperative===true&&
     mcp.nav?.loc===true&&mcp.nav?.gs===true){
   if(next.raFailureSinceMs===null)next.raFailureSinceMs=nowMs;
   if(nowMs-next.raFailureSinceMs>=2000)
    return checked('RADIO_ALT_FAILURE_AFTER_LOC_GS_2S',true);
  }else next.raFailureSinceMs=null;
  return {state:next,disengage:false,reason:null};
 }
 return Object.freeze({VERSION,REASONS,initial,evaluate});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/flight/iran-nav-reference-v1.js?v=FLT-PHASE-IRAN-NAV-0001 */
try{
/* Public-domain airport and VOR reference positions (OurAirports).
 * Non-operational chart orientation only. NOT FMC AIRAC, NOT valid for flight.
 * OurAirports individual facility pages verified 2026-11-17; community-maintained,
 * NOTAM/availability not guaranteed. Never use for LNAV or procedure activation.
 */
(function(root,factory){
 'use strict';
 const rows=factory();
 if(typeof module==='object'&&module.exports)module.exports=rows;
 if(root?.document)root.B737IranNavReferenceV1=rows;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 return Object.freeze([
  // Public airport ARP reference points (not runway thresholds).
  Object.freeze({type:'AIRPORT',ident:'OIIE',lat:35.416100,lon:51.152199,verified:true}),
  Object.freeze({type:'AIRPORT',ident:'OIIP',lat:35.776100,lon:50.826698,verified:true}),
  // Public VOR-DME reference points. Operational service status is NOT verified.
  Object.freeze({type:'VOR',ident:'TRN',lat:35.696999,lon:51.283798,verified:true}),
  Object.freeze({type:'VOR',ident:'IKA',lat:35.409698,lon:51.178501,verified:true}),
  Object.freeze({type:'VOR',ident:'PIM',lat:35.762001,lon:50.851601,verified:true}),
  Object.freeze({type:'VOR',ident:'MSD',lat:36.231201,lon:59.650600,verified:true}),
  Object.freeze({type:'VOR',ident:'SYZ',lat:29.540199,lon:52.588799,verified:true}),
  Object.freeze({type:'VOR',ident:'BUZ',lat:28.951401,lon:50.826099,verified:true})
 ]);
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/flight/flight-location-reference-v1.js?v=FLT-PHASE-LOCATION-0001 */
try{
/* Unified flight-position reference, shared by Flight Scenario, CDU and EHSI.
 * Pure client-side source catalog; never treats a selected location as an
 * aligned IRS position or an operational FMC route.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){
  const instance=api.create(root,root.B737FlightScenarioCoreV1?.AIRPORTS);
  if(Array.isArray(root.B737IranNavReferenceV1))instance.setCatalog(root.B737IranNavReferenceV1);
  root.B737UnifiedFlightLocationV1=instance;
 }
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const R=Math.PI/180,EARTH_NM=3440.065;
 const VALID_TYPES=new Set(['VOR','NDB','AIRPORT','WAYPOINT']);
 const finite=(x,a,b)=>typeof x==='number'&&Number.isFinite(x)&&x>=a&&x<=b;
 const normalize=(point)=>{if(!point||!finite(point.lat,-90,90)||!finite(point.lon,-180,180))throw Error('INVALID_FLIGHT_LOCATION');return Object.freeze({lat:point.lat,lon:point.lon,icao:/^[A-Z0-9]{4}$/.test(point.icao||'')?point.icao:null,source:point.source||'SCENARIO_REFERENCE'});};
 function offsets(center,point){
  const a=center.lat*R,b=point.lat*R,d=(point.lon-center.lon)*R;
  const q=Math.sin((b-a)/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(d/2)**2;
  const nm=2*EARTH_NM*Math.asin(Math.min(1,Math.sqrt(q)));
  const bearing=Math.atan2(Math.sin(d)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(d));
  return {x:nm*Math.sin(bearing),y:nm*Math.cos(bearing),distanceNm:nm};
 }
 function create(host,airports){
  let selected=null,catalog=[];
  const publish=()=>host?.dispatchEvent?.(new host.CustomEvent('b737:flight-location-reference',{detail:selected}));
  return Object.freeze({
   getLocation:()=>selected,
   choose(point){selected=normalize(point);publish();return selected;},
   clear(){selected=null;publish();},
   setCatalog(rows){
    if(!Array.isArray(rows))throw Error('LOCATION_CATALOG_REQUIRED');
    catalog=rows.filter(r=>VALID_TYPES.has(r?.type)&&/^[A-Z0-9._-]{2,12}$/.test(r.ident||'')&&finite(r.lat,-90,90)&&finite(r.lon,-180,180)&&r.verified===true)
     .map(r=>Object.freeze({type:r.type,ident:r.ident,lat:r.lat,lon:r.lon,verified:true}));
    publish();return catalog.length;
   },
   mapObjects(center,options={},rangeNm=40,additional=[]){
    if(!center||!finite(center.lat,-90,90)||!finite(center.lon,-180,180))return [];
    const seeds=[...Object.values(airports||{}).map(a=>({type:'AIRPORT',ident:a.icao,lat:a.lat,lon:a.lon,verified:true})),
      ...catalog,...additional];
    const seen=new Set(),out=[];
    for(const obj of seeds){
     if(!obj||!VALID_TYPES.has(obj.type)||!finite(obj.lat,-90,90)||!finite(obj.lon,-180,180)||
        !/^[A-Z0-9._-]{2,12}$/.test(obj.ident||''))continue;
     const on=obj.type==='AIRPORT'?options.arpt:obj.type==='WAYPOINT'?options.wpt:options.navAid;
     if(!on)continue;
     const v=offsets(center,obj);
     if(v.distanceNm>Math.max(1,Number(rangeNm)||40)*1.3||v.distanceNm<.03)continue;
     const id=obj.type+'@'+obj.ident+'@'+obj.lat+'@'+obj.lon;
     if(seen.has(id))continue;seen.add(id);
     out.push({name:obj.ident,x:v.x,y:v.y,on:true,
      shape:obj.type==='AIRPORT'?'airport':obj.type==='WAYPOINT'?'star':'nav'});
    }
    return out;
   }
  });
 }
 return Object.freeze({create,offsets,normalize});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./flight-phase-position-bridge-v1.js?v=FLT-PHASE-POSLINK-0001 */
try{
/* Additive Unified FLT PHASE -> IRS initialization bridge.
 * Do not modify the owner-locked IRS panel/core. Only uses its public FMC
 * POS INIT API, which observes L/R power and alignment eligibility.
 * Never forces NAV VALID, completes alignment, or drives AFDS.
 */
(function(win){
 'use strict';
 const PHASES=new Set(['SELFTEST','ALIGNING','ALIGN_READY','WAIT_POSITION','HIGH_LAT_READY','FAST_REALIGN']);
 let pending=null,delivered=new Set(),busy=false,lastResult=null;
 function format(v,width){
  const abs=Math.abs(v),degrees=Math.floor(abs),tenths=Math.round((abs-degrees)*600);
  const dd=degrees+Math.floor(tenths/600),mm=tenths%600;
  return (v<0?(width===2?'S':'W'):(width===2?'N':'E'))+
   String(dd).padStart(width,'0')+String(mm).padStart(3,'0');
 }
 function positionText(p){
  if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||
     Math.abs(p.lat)>90||Math.abs(p.lon)>180)throw Error('INVALID_FLIGHT_LOCATION');
  return format(p.lat,2)+' '+format(p.lon,3);
 }
 function attempt(){
  if(!pending||busy)return;
  const trainer=win.B737IRSTrainerUnified;
  if(!trainer?.getState||!trainer?.setFmcPosition)return;
  const snapshot=trainer.getState();
  const eligible=['L','R'].filter(side=>{
   const u=snapshot.units?.[side];
   return u?.powered===true&&PHASES.has(u.phase);
  });
  if(!eligible.some(side=>!delivered.has(side)))return;
  const candidate=pending;
  busy=true;
  try{
   // The existing IRS API applies to all currently eligible L/R units.
   // We cannot initialize OFF, unpowered, or NAV-ready IRS.
   const result=trainer.setFmcPosition(positionText(candidate));
   for(const side of result.sides||[])delivered.add(side);
   lastResult={status:'ENTERED_FOR_ALIGNMENT',sides:[...delivered],icao:candidate.icao||null,
    latitude:candidate.lat,longitude:candidate.lon};
   win.dispatchEvent(new CustomEvent('b737:flight-location-irs-transfer',{detail:lastResult}));
   if(delivered.has('L')&&delivered.has('R'))pending=null;
  }catch(error){
   lastResult={status:'DEFERRED',reason:String(error?.message||error)};
  }finally{busy=false;}
 }
 win.addEventListener('b737:flight-location-reference',e=>{
  const p=e.detail;
  if(!p||p.source==='FLIGHT_SCENARIO_LIVE_POSITION')return;
  pending=p;delivered=new Set();attempt();
 });
 // Event-driven retry when an independently powered IRS enters ALIGN/NAV.
 win.addEventListener('b737:irs-trainer-state',attempt);
 win.B737UnifiedFlightIRSBridgeV1=Object.freeze({
  positionText,attempt,getStatus:()=>lastResult?{...lastResult}:null
 });
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/afds/classic-toga-ch4-v1.js?v=CH4-TOGA-0003 */
try{
/* Boeing 737 Classic Chapter 4 TO/GA — instructor-only flight-mode state machine.
 * Source: Sepehran FCOM D6-27370-300/400/500-SHI 4.20.14-16,
 * 4.20.24-27 (2023). Airframe effectivity can choose HDG SEL takeoff roll.
 * This is not a certified FCC or AFM N1 performance model.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ClassicTogaCH4V1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='TOGA-CH4-SHI-0001';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const safe=(x,defaultValue)=>finite(x)?x:defaultValue;
 const initial=()=>({version:VERSION,phase:'OFF',presses:0,elapsedSec:0,liftoffSec:null,
  initialSpeedKt:null,fdPitchDeg:0,fdRollTrackDeg:null,thrustDemand:'NONE',
  atMode:'',pitchMode:'',rollMode:'',afdsMode:'',apDisengage:false,
  targetSpeedKt:null,atLimit:'NONE',throttleFraction:0,reason:'NOT_ENGAGED',
  singleEngine:false,engineFailureAfterEngagement:false,gaFullReady:false});
 function engineCount(c){return Number(c.engine1Running===true)+Number(c.engine2Running===true);}
 function engage(previous,ctx={}){
  if(!['OFF','TO','GA'].includes(previous?.phase))throw Error('Invalid TOGA previous state');
  const airborne=ctx.airborne===true;
  const engines=engineCount(ctx);
  const fd=ctx.fdLeft===true&&ctx.fdRight===true;
  const at=ctx.atArmed===true;
  const altitude=safe(ctx.radioAltitudeFt,Infinity),postTouchdown=ctx.touchedDown===true;
  const canGA=(airborne&&altitude<2000&&ctx.isTakeoffMode!==true)||
   (postTouchdown&&safe(ctx.sinceTouchdownSec,Infinity)<=2);
  if(!airborne&&ctx.groundReady!==true&&!postTouchdown)return {...previous,reason:'GROUND_TAKEOFF_NOT_ARMED'};
  if(airborne&&!canGA)return {...previous,reason:'GA_NOT_AVAILABLE'};
  if(!fd&&(!airborne||ctx.fdLeft===false&&ctx.fdRight===false)&&ctx.allowFdAutoEngage!==true)
   return {...previous,reason:'BOTH_FD_REQUIRED'};
  // FCOM 4.20.24: only dual A/P with FLARE armed retains A/P for GA.
  const dual=ctx.apChannels===2&&ctx.flareArmed===true&&!postTouchdown;
  const phase=airborne||postTouchdown?'GA':'TO';
  const target=safe(ctx.iasKt,0);
  const approachTarget=safe(ctx.selectedSpeedKt,target);
  const single=engines===1;
  return {...initial(),phase,presses:1,initialSpeedKt:target,
   fdPitchDeg:phase==='TO'?-10:single?13:15,
   fdRollTrackDeg:safe(ctx.groundTrackDeg,0),
   thrustDemand:at&&engines>0?(phase==='TO'?'TAKEOFF_LIMIT':'GA_REDUCED'):'NONE',
   atMode:at&&engines>0?(phase==='TO'?'N1':'GA'):'',
   pitchMode:'TO/GA',rollMode:phase==='TO'&&ctx.takeoffRollHdGSel===true?'HDG SEL':'',
   afdsMode:dual?'CMD':'FD',apDisengage:(ctx.apChannels??0)>0&&!dual,
   targetSpeedKt:single?Math.max(safe(ctx.v2Kt,0),approachTarget):approachTarget,
   atLimit:phase==='TO'?'TO':'G/A',singleEngine:single,gaFullReady:false,
   // First GA press is reduced GA; first TO press selects FMC takeoff N1.
   throttleFraction:at&&engines>0?(phase==='TO'?1:.86):0,
   reason:phase==='TO'?'TAKEOFF_FD':'GO_AROUND_FD'};
 }
 function press(previous,ctx={}){
  if(previous.phase!=='GA'||previous.presses<1)return engage(previous,ctx);
  if(ctx.atArmed!==true||engineCount(ctx)<1)return {...previous,reason:'GA_AUTOTHROTTLE_NOT_AVAILABLE'};
  if(previous.gaFullReady!==true)return {...previous,reason:'WAIT_REDUCED_GA_N1'};
  return {...previous,presses:2,thrustDemand:'GA_FULL',throttleFraction:1,
   reason:'FULL_GO_AROUND_N1'};
 }
 function advance(previous,ctx={},dtSec=0){
  if(!finite(dtSec)||dtSec<0||dtSec>10)throw RangeError('Invalid TOGA dt');
  if(previous.phase==='OFF')return previous;
  const elapsed=previous.elapsedSec+dtSec,ias=safe(ctx.iasKt,0),ra=safe(ctx.radioAltitudeFt,0);
  let next={...previous,elapsedSec:elapsed};
  const observedEngines=typeof ctx.engine1Running==='boolean'&&
    typeof ctx.engine2Running==='boolean'?engineCount(ctx):null;
  if(observedEngines===1&&!previous.singleEngine){
   const v2=safe(ctx.v2Kt,0);
   if(previous.phase==='GA'){
    // FCOM 4.20.27: failure before 10 seconds uses selected approach
    // speed; after 10 seconds, speed at GA engagement if current IAS is
    // within 5 kt, otherwise current IAS. Never command below V2.
    const target=elapsed<10?safe(ctx.selectedSpeedKt,ias):
     Math.abs(ias-previous.initialSpeedKt)<=5?previous.initialSpeedKt:ias;
    next={...next,singleEngine:true,engineFailureAfterEngagement:true,
     targetSpeedKt:Math.max(v2,target),reason:'ENGINE_FAILURE_AFTER_GA'};
   }else{
    // FCOM 4.20.15: engine-out takeoff target is clamped V2..V2+20.
    next={...next,singleEngine:true,engineFailureAfterEngagement:true,
     targetSpeedKt:v2>0?Math.max(v2,Math.min(v2+20,ias)):safe(ctx.selectedSpeedKt,ias),
     reason:'ENGINE_FAILURE_DURING_TAKEOFF'};
   }
  }
  if(previous.phase==='TO'){
   // Takeoff-specific FCOM phases: -10° until 60 kt; 15° after 60;
   // 84 kt disconnects thrust servo while TAKEOFF remains selected.
   next.fdPitchDeg=ias<60?-10:15;
   if(ias>=84&&next.atMode==='N1'){next.atMode='THR HLD';next.thrustDemand='THR_HOLD';}
   if(ctx.airborne===true&&previous.liftoffSec===null)next.liftoffSec=elapsed;
   if(ctx.airborne===true&&next.liftoffSec!==null){
    const after=elapsed-next.liftoffSec;
    if(ra>=400&&after>=18&&next.atMode==='THR HLD'){next.atMode='ARM';next.thrustDemand='ARM';}
    if(ctx.autopilotEngaged===true&&ra>=400){
     next={...next,afdsMode:'CMD',pitchMode:'MCP SPD',
      rollMode:ctx.otherRollMode||next.rollMode,reason:'CMD_AFTER_TAKEOFF'};
    }
   }
  }
  if(previous.phase==='GA'){
   // Reduced GA has to be achieved before a second TOGA press can ask full N1.
   next.gaFullReady=ctx.reducedGaN1Reached===true||previous.gaFullReady;
   next.fdPitchDeg=next.singleEngine?13:15;
   if(next.singleEngine){
    const v2=safe(ctx.v2Kt,0);
    const selected=safe(ctx.selectedSpeedKt,next.targetSpeedKt);
    // After failure, only a HIGHER MCP selection can command acceleration.
    next.targetSpeedKt=Math.max(v2,next.targetSpeedKt,
     selected>next.targetSpeedKt?selected:next.targetSpeedKt);
   }
  }
  return next;
 }
 function fma(s){
  return {at:s.atMode,pitch:s.pitchMode,roll:s.rollMode,afds:s.afdsMode,
   fdPitch:s.fdPitchDeg,targetSpeedKt:s.targetSpeedKt,thrust:s.thrustDemand};
 }
 return Object.freeze({VERSION,initial,engage,press,advance,fma});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./flight-scenario-panel-v1.js?v=FLT-UI-SLIM-0002&amp;aero=ACTUAL-TE-0001 */
try{
/* Unified Flight Scenario Lab v1. Optional instructor feed; no panel DOM overrides. */
(function(win){
 'use strict';
 const Core=win.B737FlightScenarioCoreV1;
 if(!Core){console.error('B737FlightScenarioCoreV1 dependency missing');return;}
 const doc=win.document,by=id=>doc.getElementById(id);
 let mounted=false;
 let state=null,active=false,pause=false,lastTick=0,lastPublish=0,lastUI=0,choiceArmed=false;
 let producers={},producerErrors={},timer=null,mcpFollow=true,previouslyCoupled=false;
 let lastPropulsionAt=0,lastPropulsion=null,lastEngineContextAt=0;
 let tickErrorCount=0,lastTickError=null;
 const VERSION='UNIFIED-FLIGHT-SCENARIOS-0008-STATIC-SHELL';
 const html=`
  <div class="flight-head"><strong id="flightScenarioTitle">FLIGHT SCENARIO ENGINE</strong><button id="flightScenarioClose" type="button" aria-label="Close flight scenarios">×</button></div>
  <p class="flight-sub">B737 Classic · Instructor training model · MSL altitude / MAGNETIC heading using live WMM2025 variation; TRUE retained inside flight physics. Training only.</p>
  <div class="flight-grid">
   <label>Airport<select id="flightAirport"><option value="OIMM">MASHHAD · OIMM</option><option value="OIII">TEHRAN MEHRABAD · OIII</option><option value="OISS">SHIRAZ · OISS</option></select></label>
   <label>Runway<select id="flightRunway"></select></label>
   <label>Start location<select id="flightPreset"><option value="RUNWAY_READY">READY FOR TAKEOFF</option><option value="FINAL_5">5 NM FINAL</option><option value="FINAL_10">10 NM FINAL</option><option value="MANUAL">MANUAL INITIAL STATE</option></select></label>
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
  const manual=by('flightPreset').value==='MANUAL';
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
  const manual=by('flightPreset').value==='MANUAL';
  if(!manual){
   by('flightLat').value=String(a.lat);by('flightLon').value=String(a.lon);
   const mag=magneticHeading(a.runways[rw.value],airportPoint(a));
    by('flightHeading').value=Number.isFinite(mag)?Math.round(mag)%360:'';
   by('flightAlt').value=a.elevationFt+(by('flightPreset').value==='RUNWAY_READY'?0:3000);
  }
  publishSelectedReference();
 }
 function presetChanged(){
  const kind=by('flightPreset').value;
  const a=Core.AIRPORTS[by('flightAirport').value];
  if(kind!=='MANUAL'){
   const mag=magneticHeading(a.runways[by('flightRunway').value],airportPoint(a));
    by('flightHeading').value=Number.isFinite(mag)?Math.round(mag)%360:'';
   by('flightAlt').value=Math.round(a.elevationFt+(kind==='RUNWAY_READY'?0:kind==='FINAL_5'?1643:3236));
   by('flightSpeed').value=kind==='RUNWAY_READY'?0:kind==='FINAL_5'?155:170;
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
 function updateUI(){
  const stopButton=by('flightStop'),pauseButton=by('flightPause'),takeoffButton=by('flightTakeoff');
  if(stopButton)stopButton.disabled=!state||state.airborne===true;
  if(pauseButton){pauseButton.disabled=!state;pauseButton.textContent=state&&pause?'RESUME':'PAUSE';}
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
  win.dispatchEvent(new CustomEvent('b737:flight-scenario-stopped',{detail:{version:VERSION}}));
  return true;
 }
 function load(beforeStart){
  try{
   const preset=by('flightPreset').value;
   const config={airport:by('flightAirport').value,runway:by('flightRunway').value,preset,
    airborne:preset!=='RUNWAY_READY'};
   if(preset==='MANUAL'){
    config.altitudeFt=v('Alt');config.headingDeg=trueHeading(v('Heading'),airportPoint(Core.AIRPORTS[config.airport]));
    config.speedKt=v('Speed');
   }
   if(preset==='MANUAL'){
    config.lat=v('Lat');config.lon=v('Lon');
   }
   const next=Core.newScenario(config);
   if(typeof beforeStart==='function')beforeStart();
   state=next;
   win.B737UnifiedFlightLocationV1?.choose({lat:state.lat,lon:state.lon,icao:state.icao,source:'FLIGHT_SCENARIO_INITIAL_POSITION'});
   active=true;pause=false;previouslyCoupled=false;lastTick=performance.now();lastPublish=0;
   if(preset!=='MANUAL'){
    by('flightAlt').value=Math.round(state.altitudeFt);
    const mag=magneticHeading(state.trueHeadingDeg,state);
     by('flightHeading').value=Number.isFinite(mag)?Math.round(mag)%360:'';
    by('flightSpeed').value=Math.round(state.iasKt);
   }
   publish();lastPublish=performance.now();updateUI();
   status('ACTIVE · '+state.icao+' RWY '+state.runway+' · '+state.phase+' · '+state.georefQuality);
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
   status('Targets accepted — aircraft changes heading/bank, IAS and altitude over simulated time.');
  }catch(error){status('INVALID TARGET: '+String(error.message||error),true);}
 }
 function followMcp(){
  if(!active||!state?.airborne)return;
  const fcc=win.B737UnifiedFccFlightV1;
  const mcp=win.B737McpAFDSBridgeV1;
  const output=mcp?.getOutput?.();
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
   {valid:true,engines,fuelImbalanceKg:owner.getFuelImbalanceKg?.()}:null;
  return lastPropulsion;
 }
 // Consume the actual TE actuator projection; the cockpit lever is not
 // proof that surfaces have moved. Keep instructor mass separate from ADC.
 function syncAeroConfiguration(){
  if(!state||!active)return false;
  const le=win.B737LEDevicesUnifiedLink?.getState?.();
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
   try{if(!pause){
    if(now-lastEngineContextAt>=900){
     lastEngineContextAt=now;
     try{win.B737ISNCockpitV1?.setFlightScenarioContext?.({
      active:true,onGround:!state.airborne,iasKt:state.iasKt,
      altitudeFt:state.altitudeFt,source:'FLIGHT_SCENARIO_ENGINE'});}
     catch(error){console.warn('ISN scenario flight context',error);}
    }
    syncAeroConfiguration();
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
  by('flightAirport').addEventListener('change',()=>{choiceArmed=true;airportChanged();presetChanged();});
  by('flightRunway').addEventListener('change',()=>{choiceArmed=true;presetChanged();});
  by('flightPreset').addEventListener('change',()=>{choiceArmed=true;presetChanged();});
  for(const field of ['Lat','Lon'])by('flight'+field).addEventListener('change',()=>{if(by('flightPreset').value==='MANUAL'){choiceArmed=true;publishSelectedReference();}});
  by('flightLoad').addEventListener('click',load);
  by('flightTargets').addEventListener('click',targets);
  by('flightTakeoff').addEventListener('click',()=>{
   // Same TO/GA request is generated by either photographed thrust-lever
   // pushbutton. The Chapter 4 bridge resolves takeoff versus go-around.
   win.dispatchEvent(new CustomEvent('b737:toga-request',{detail:{source:'FLT_PHASE'}}));
  });
  by('flightPause').addEventListener('click',()=>{if(!active)return;pause=!pause;updateUI();});
  by('flightStop').addEventListener('click',stop);
  airportChanged();presetChanged();updateUI();
  timer=win.setInterval(tick,100);mounted=true;
 }
 const api=Object.freeze({version:VERSION,getState:snapshot,startFromSelection:load,
  loadScenario:config=>{state=Core.newScenario(config);win.B737UnifiedFlightLocationV1?.choose({lat:state.lat,lon:state.lon,icao:state.icao,source:'FLIGHT_SCENARIO_INITIAL_POSITION'});active=true;pause=false;previouslyCoupled=false;lastTick=performance.now();publish();lastPublish=performance.now();updateUI();return snapshot();},
  command:(action)=>{if(!state)throw Error('NO_SCENARIO');state=Core.command(state,action);publish();updateUI();return snapshot();},
  stepForTest:dt=>{if(!state)throw Error('NO_SCENARIO');state=Core.step(state,dt);return snapshot();},
  pause:value=>{pause=value===true;updateUI();},stop,
  getDiagnostics:()=>({active,paused:pause,airborne:state?.airborne===true,
   phase:state?.phase??null,revision:state?.revision??null,elapsedSec:state?.elapsedSec??null,
   lastPublishAgeMs:active?Math.max(0,performance.now()-lastPublish):null,
   tickErrorCount,lastTickError:lastTickError?{...lastTickError}:null,
   mcpFollow,producers:Object.keys(producers),producerErrors:{...producerErrors}})});
 win.B737UnifiedFlightScenarioV1=api;
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./flight-envelope-le-bridge-v1.js?v=LE-PORTS-AERO-0001 */
try{
/* Instructor flight envelope -> OWNER FINAL LE Devices external dynamics port.
 * Do not modify the locked LE model, trainer bridge or physical lever.
 * Conditional autoslat demand is an IAS proxy, not certified AoA logic.
 */
(function(win){
 'use strict';
 const VALID='B737_FLIGHT_SCENARIO_STATE_V1';
 const source=()=>win.document.getElementById('overheadFrame')?.contentWindow;
 let ready=false,onGround=true,requested=false,previous=null;
 function transmit(force=false){
  const target=source(),key=JSON.stringify([onGround,requested]);
  if(!ready||!target||(!force&&previous===key))return false;
  target.postMessage({type:'b737:cockpit-command',action:'le-aircraft-dynamics',
   source:'INSTRUCTOR_LOW_SPEED_ENVELOPE_NOT_AOA',
   snapshot:{onGround,autoslatRequested:requested}},win.location.origin);
  previous=key;return true;
 }
 win.addEventListener('b737:flight-scenario-state',e=>{
  const f=e.detail;if(f?.schema!==VALID)return;
  onGround=f.airborne!==true;
  const p=win.B737LEDevicesUnifiedLink?.getState?.();
  requested=!onGround&&[1,2,5].includes(p?.lever)&&f.autoSlatRequest===true;
  transmit();
 });
 win.addEventListener('b737:flight-scenario-stopped',()=>{
  onGround=true;requested=false;transmit();
 });
 win.addEventListener('message',e=>{
  if(e.origin!==win.location.origin||e.source!==source()||
     e.data?.type!=='b737:cockpit-overhead'||e.data.kind!=='ready')return;
  ready=true;previous=null;transmit(true);
 });
 win.B737FlightEnvelopeLEBridgeV1=Object.freeze({snapshot:()=>({
  ready,onGround,requested,source:'INSTRUCTOR_LOW_SPEED_ENVELOPE_NOT_AOA'
 })});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./toga-unified-ch4-v1.js?v=CH4-TOGA-ECU-RETRY-20261119 */
try{
/* TCAS-independent Unified TO/GA integration.
 * Source: Sepehran 737CL FCOM Ch 4 §§4.20.14–16,4.20.24–27.
 * All commands pass the SINGLE ISN-18 engine controller and AFDS FMA owner.
 * The reduced GA thrust fraction is a TRAINING proxy, not AFM N1 data.
 */
(function(win){'use strict';
 const T=win.B737ClassicTogaCH4V1;
 if(!T){win.console?.warn('TOGA CH4 core unavailable');return;}
 const doc=win.document;
 let state=T.initial(),lastMs=0,lastFma='',lastThrust='',errors=[];
 let thrustFeedback='NOT_REQUESTED';
 const getFlight=()=>win.B737UnifiedFlightScenarioV1;
 const mcp=()=>win.B737McpAFDSBridgeV1?.getOutput?.();
 const owner=()=>win.B737ISNCockpitV1;
 const engineRunning=(n)=>owner()?.getStartState?.()?.phase?.['engine'+n]==='RUNNING';
 const active=()=>['TO','GA'].includes(state.phase);
 const scenario=()=>getFlight()?.getState?.()??null;
 function context(light=false){
  const f=scenario(),m=mcp(),c=m?.controls||{},engines=light?null:owner()?.getPropulsionSnapshot?.()?.engines;
  return {groundReady:f?.phase==='GROUND_READY',airborne:f?.airborne===true,
   radioAltitudeFt:f?.radioAltitudeFt,iasKt:f?.iasKt,groundTrackDeg:f?.trueTrackDeg??f?.trueHeadingDeg,
   fdLeft:c.fd?.left===true,fdRight:c.fd?.right===true,atArmed:c.atArm===true,
   apChannels:/^(?:CMD|CWS)_[AB]$/.test(m?.modes?.autopilot||'')?1:0,
   autopilotEngaged:/^(?:CMD|CWS)_[AB]$/.test(m?.modes?.autopilot||''),
   engine1Running:light?undefined:engineRunning(1),engine2Running:light?undefined:engineRunning(2),
   // Presence of both engines running is checked independently from pump/fuel faults.
   selectedSpeedKt:m?.values?.speed??f?.iasKt,
   v2Kt:win.B737UnifiedTakeoffDataV1?.get?.()?.v2Kt??null,
   flareArmed:false,touchedDown:false,
   isTakeoffMode:state.phase==='TO',
   // FCOM 4.20.14-15 FSI/FST option: takeoff roll FMA HDG SEL, unlike
   // other variants with a BLANK lateral TO/GA mode. EP-FSI uses FSI.
   takeoffRollHdGSel:win.B737AircraftProfileStore?.get?.()?.aircraftModel==='737-300',
   // No digitized AFM N1 target exists. The reduced-GA-achieved gate is
   // explicitly a training approximation based on the observed same-ECU
   // throttle and N1; never an actual aircraft's reduced GA criterion.
   reducedGaN1Reached:engines&&['engine1','engine2'].some(id=>
    engines[id]?.running&&Number.isFinite(engines[id]?.n1Percent)&&
    Number.isFinite(engines[id]?.throttle)&&
    engines[id].throttle>=.82&&engines[id].n1Percent>=80)
  };
 }
 function banner(message,error=false){
  const el=doc.getElementById('flightScenarioStatus');
  if(el){el.textContent=message;el.dataset.error=String(error);}
 }
 function publishFma(){
  if(!active())return;
  const m=mcp();
  if(m?.power!==true)return;
  const fm=T.fma(state),fingerprint=JSON.stringify([fm,m.power,m.controls?.fd]);
  if(lastFma===fingerprint)return;
  lastFma=fingerprint;
  for(const seat of ['CAPT','FO']){
   win.dispatchEvent(new CustomEvent('b737:fma-fcc-observation',{detail:{
    schema:'B737_FMA_FCC_OBSERVATION_V1',confirmed:true,seat,
    source:'SIMULATED_FCC',evidence:{togaModeConfirmed:true},
    fields:{at:{active:fm.at},pitch:{active:fm.pitch},
     roll:{active:fm.roll},
     afds:{active:fm.afds==='CMD'||m.controls?.fd?.[seat==='CAPT'?'left':'right']===true?
      fm.afds:''}}
   }}));
  }
 }
 function thrust(){
  const fm=T.fma(state);
  if(!['TAKEOFF_LIMIT','GA_REDUCED','GA_FULL'].includes(fm.thrust))return;
  const finger=state.phase+':'+state.presses+':'+state.throttleFraction;
  if(lastThrust===finger)return;
  const result=[];let attempts=0,reason='NO_RUNNING_ENGINE';
  for(const n of [1,2]){
   if(!engineRunning(n))continue;
   attempts++;
   try{
    const r=owner()?.togaThrottleCommand?.({engine:'engine'+n,
     value:state.throttleFraction,controller:'B737_TOGA_CH4_TRAINING',
     phase:state.phase});
    if(r?.accepted){
     result.push(n);
     doc.dispatchEvent(new CustomEvent('b737:throttle-state',{detail:{
      engine:n,percent:state.throttleFraction*100,source:'CH4_TOGA',visualOnly:true}}));
    }else reason=r?.reason||'THROTTLE_OWNER_NOT_READY';
   }catch(e){reason=String(e?.message||e);}
  }
  if(attempts>0&&result.length===attempts){
   lastThrust=finger;thrustFeedback='APPLIED_TO_'+result.join('_');
  }else{
   // A partial acceptance must not latch the whole TO/GA thrust command.
   // Retry against the SAME ECU until the running-engine set accepts it,
   // but never override THR HLD once that FCOM mode has been entered.
   thrustFeedback='NOT_APPLIED_'+reason;
   if(errors.at(-1)!==thrustFeedback)errors.push(thrustFeedback);
   if(errors.length>24)errors.shift();
  }
 }
 function press(source='INSTRUCTOR'){
  const flight=getFlight(),f=flight?.getState?.();
  if(!flight?.getDiagnostics?.()?.active||!f){
   banner('TO/GA BLOCKED · LOAD AN ACTIVE FLIGHT SCENARIO',true);return state;
  }
  const c=context(),was=state.phase;
  // Check the current engine snapshot on the SECOND GA push: do not block
  // forever merely because no periodic full-ECU poll ran in between.
  const before=state.phase==='GA'?T.advance(state,c,0):state;
  const next=T.press(before,c);
  if(next===state||next.reason===state.reason&&next.phase===state.phase){
   banner('TO/GA BLOCKED · '+next.reason,true);return state;
  }
  state=next;
  if(state.phase==='OFF'){banner('TO/GA BLOCKED · '+state.reason,true);return state;}
  if((was==='OFF'||was==='TO')&&state.phase==='TO'&&f.phase==='GROUND_READY'){
   // FD TO/GA may engage with unavailable A/T, but a training takeoff ROLL
   // cannot accelerate under imaginary thrust while both engines are OFF.
   if(c.atArmed===true&&(c.engine1Running===true||c.engine2Running===true)){
    try{flight.command({type:'TAKEOFF_ROLL'});}catch(e){
     state=T.initial();banner('TO/GA BLOCKED · '+String(e.message||e),true);return state;
    }
   }else banner('TO/GA FD MODE · A/T ARMED AND RUNNING ENGINE REQUIRED FOR POWERED GROUND ROLL',true);
  }
  if(state.apDisengage===true){
   win.B737McpAFDSBridgeV1?.disconnectConfirmed?.({
    reason:'TOGA_BELOW_2000_RA',confirmed:true,source:'SIMULATED_FCC'
   });
  }
  publishFma();thrust();
  banner('TO/GA '+state.phase+' · '+state.reason+' · FMA '+state.atMode+
    ' / '+state.pitchMode+' / '+(state.rollMode||'BLANK')+' / '+state.afdsMode);
  win.dispatchEvent(new CustomEvent('b737:toga-mode',{detail:{...state,source}}));
  return state;
 }
 function tick(){
  const flight=getFlight(),current=flight?.getState?.();
  if(active()&&current){
   const ms=performance.now(),dt=lastMs?Math.min(.35,Math.max(0,(ms-lastMs)/1000)):0;
   const next=T.advance(state,context(true),dt);
   state=next;publishFma();thrust();
   lastMs=ms;
  }else lastMs=performance.now();
 }
 win.addEventListener('b737:toga-request',e=>press(e.detail?.source||'THRUST_LEVER'));
 // Engine indication emits an existing throttled shared-ECU packet; adapt the
 // 2-engine GA to a single-engine target using Chapter 4 F/D speed rules.
 win.addEventListener('b737:engine-indications-live-v2',()=>{
  if(!active())return;
  const next=T.advance(state,context(),0);
  if(next.singleEngine!==state.singleEngine||next.targetSpeedKt!==state.targetSpeedKt){
   state=next;lastFma='';publishFma();
   win.dispatchEvent(new CustomEvent('b737:toga-mode',{detail:{...state,source:'ENGINE_FEEDBACK'}}));
  }
 });
 function releaseToga(){
  if(state.phase==='OFF')return;
  state=T.initial();lastFma='';lastThrust='';thrustFeedback='NOT_REQUESTED';
  win.dispatchEvent(new CustomEvent('b737:fma-fcc-clear'));
 }
 win.addEventListener('b737:flight-scenario-stopped',releaseToga);
 // Above 400ft RA selecting another pitch mode terminates TO/GA. Below
 // 400ft only turning BOTH FD OFF may terminate the protected phase.
 win.addEventListener('b737:mcp-button-request',e=>{
  const id=e.detail?.id;
  if(!active()||(scenario()?.radioAltitudeFt??0)<400)return;
  if(/^CMD_[AB]$/.test(id)&&mcp()?.modes?.autopilot===id){
   releaseToga();return;
  }
  if(['VNAV','LVL_CHG','ALT_HLD','VS'].includes(id))releaseToga();
 });
 win.addEventListener('b737:mcp-hardware-change',e=>{
  if(!active())return;
  if(!['FD_LEFT','FD_RIGHT'].includes(e.detail?.id))return;
  const controls=mcp()?.controls?.fd;
  if(controls?.left===false&&controls?.right===false)releaseToga();
 });
 const api=Object.freeze({getState:()=>({...state}),press,tickForTest:tick,
  getDiagnostics:()=>({version:T.VERSION,errors:errors.slice(-12),
   thrustFeedback,lastAcceptedCommand:lastThrust||null})});
 win.B737UnifiedTOGACh4V1=api;
 if(typeof win.setInterval==='function')win.setInterval(tick,150);
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
