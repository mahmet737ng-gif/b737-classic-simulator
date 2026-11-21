(async()=>{
;
/* ../../engine/afds/fcc-flight-guidance-v1.js?v=FCC-GUIDANCE-0003-COUPLED-FLIGHT&amp;fd=CMD-AXES-0002&amp;alt=ACQ-0001 */
try{
/* B737 Classic unified FCC flight guidance for instructor Flight Scenario.
 * FCOM Ch 4.20.4-10 mode selection and FD visibility; commands are a training
 * surrogate, NOT an aircraft-performance law or qualified LRU output.
 * Navigational capture requires a verified active NAV/FMC source: no fiction.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FccFlightGuidanceV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_FCC_SCENARIO_GUIDANCE_0002';
 const Laws=(typeof globalThis==='object'?globalThis.B737FlightControlLawsV1:null)||
  (typeof module==='object'&&typeof require==='function'?
   require('../flight/flight-control-laws-v1.js'):null);
 const AltCapture=(typeof globalThis==='object'?globalThis.B737AltitudeCaptureTrainingV1:null)||
  (typeof module==='object'&&typeof require==='function'?
   require('../flight/altitude-capture-training-v1.js'):null);
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const norm=x=>((x%360)+360)%360;
 const delta=(from,to)=>((to-from+540)%360)-180;
 const valid=x=>typeof x==='number'&&Number.isFinite(x);
 function createState(){return {schema:VERSION,engagementKey:'',
  altitudeHoldFt:null,cwsHeadingDeg:null,cwsAltitudeFt:null,
  altitudeCapture:false,altitudeHeld:false,selectedAltitudeFt:null,
  captureInhibitUntilSec:0,navCapture:false,reason:'NOT_ACTIVE'};}
 function evaluate(prior,mcp,flight,nav=null){
  if(prior?.schema!==VERSION)throw TypeError('FCC_STATE');
  const out={state:{...prior},actions:[],pitchCommandDeg:null,rollCommandDeg:null,
   pitchValid:false,rollValid:false,fd:{captain:false,firstOfficer:false},
   fdAxes:{captain:{pitch:false,roll:false},firstOfficer:{pitch:false,roll:false}},
   reasons:[],status:'INACTIVE',altAcquireConfirmed:false,altitudeHoldConfirmed:false};
  if(flight?.schema!=='B737_FLIGHT_SCENARIO_STATE_V1'||mcp?.power!==true)
   return {...out,status:'NO_ACTIVE_POWERED_FLIGHT_SOURCE'};
  const m=mcp.modes||{},a=mcp.axisControl||{},v=mcp.values||{};
  const active=/^(?:CMD|CWS)_[AB]$/.test(m.autopilot||'');
  const cmd=active&&(m.autopilot.startsWith('CMD_'));
  const pAxis=active?a.pitch:null,rAxis=active?a.roll:null;
  const altitudeChanged=valid(prior.selectedAltitudeFt)&&valid(v.altitude)&&
   prior.selectedAltitudeFt!==v.altitude;
  out.state.selectedAltitudeFt=valid(v.altitude)?v.altitude:null;
  if(altitudeChanged){
   out.state.altitudeCapture=false;out.state.altitudeHeld=false;
   out.state.captureInhibitUntilSec=(valid(flight.elapsedSec)?flight.elapsedSec:0)+1.5;
  }
  const key=[m.autopilot,m.vertical,m.lateral,mcp.capture?.pitch,
   mcp.capture?.roll,pAxis,rAxis].join('|');
  if(prior.engagementKey!==key){
   out.state.engagementKey=key;
   if(prior.engagementKey.split('|')[1]!==m.vertical||!active){
    out.state.altitudeHoldFt=null;out.state.altitudeCapture=false;out.state.altitudeHeld=false;
   }
   if(prior.engagementKey.split('|')[5]!==pAxis)out.state.cwsAltitudeFt=null;
   if(prior.engagementKey.split('|')[6]!==rAxis)out.state.cwsHeadingDeg=null;
  }
  const fdCommand=fn=>fn===true&&mcp.flightDirectorBarsRetracted!==true;
  const bankLimit=[10,15,20,25,30].includes(mcp.bankAngleLimit)?mcp.bankAngleLimit:20;
  const direction=m.lateral;
  const speedForPitch=valid(flight.tasKt)?flight.tasKt:flight.iasKt;
  const pitchForVs=vs=>Laws?.pitchForVs(vs,speedForPitch)??clamp(
   2+Math.atan2(vs*.3048/60,Math.max(speedForPitch*.514444,35))*180/Math.PI,-10,15);
  const bankForHeading=trueTarget=>Laws?.bankForHeading(flight.trueHeadingDeg,trueTarget,bankLimit)??
   clamp(delta(flight.trueHeadingDeg,trueTarget)*.65,-bankLimit,bankLimit);
  const altitudeVs=alt=>Laws?.altitudeVs(flight.altitudeFt,alt)??
   clamp((alt-flight.altitudeFt)*2,-2500,2500);
  function acquireAltitude(selected){
   if(!valid(selected))return false;
   const plan=flight.altitudeCapture;
   const samePlan=plan?.targetAltitudeFt===selected;
   const alreadyAcquiring=!altitudeChanged&&
    (mcp.capture?.pitch==='ALT_ACQ'||out.state.altitudeCapture)&&
    (!plan||samePlan);
   const opportunity=AltCapture?.opportunity({
    altitudeFt:flight.altitudeFt,targetAltitudeFt:selected,vsFpm:flight.vsFpm,
    elapsedSec:flight.elapsedSec,
    inhibitUntilSec:out.state.captureInhibitUntilSec});
   if(!alreadyAcquiring&&opportunity?.acquire!==true)return false;
   out.state.altitudeCapture=true;out.altAcquireConfirmed=true;out.pitchValid=true;
   if(samePlan&&plan.phase==='HELD'){
    out.state.altitudeHeld=true;out.altitudeHoldConfirmed=true;
    out.actions.push({type:'ALTITUDE',value:selected});
    out.pitchCommandDeg=pitchForVs(0);
   }else{
    out.actions.push({type:'ALT_ACQ',value:selected});
    out.pitchCommandDeg=pitchForVs(samePlan?plan.vsFpm:flight.vsFpm);
   }
   return true;
  }
  // APP/VOR-LOC capture is a separate validated FCC state. Without
  // capture, heading/LNAV continue to command the existing lateral mode.
  // These are explicitly training response gains, not Boeing servo gains.
  // CWS axes retain the attitude/heading at hand-off. No fabricated manual
  // yoke force: only an existing MCP CWS state can enable this hold.
  if(rAxis==='CWS'){
   if(!valid(out.state.cwsHeadingDeg))out.state.cwsHeadingDeg=flight.trueHeadingDeg;
   out.actions.push({type:'HEADING',value:norm(out.state.cwsHeadingDeg)});
   out.rollCommandDeg=0;out.rollValid=true;
  }else if(direction==='HDG_SEL'&&valid(v.heading)){
   // MCP selector and EHSI bug are MAGNETIC. The flight plant uses TRUE
   // heading. Only a valid observed/WMM2025 variation may bridge them.
   if(valid(nav?.magneticVariationDeg)){
    const targetTrue=norm(v.heading+nav.magneticVariationDeg);
    out.actions.push({type:'HEADING',value:targetTrue});
    out.actions.push({type:'BANK_LIMIT',value:bankLimit});
    out.rollCommandDeg=bankForHeading(targetTrue);
    out.rollValid=true;
   }else out.reasons.push('HDG_SEL_MAGNETIC_VARIATION_UNAVAILABLE');
  }else if(direction==='LNAV'){
   if(nav?.fmcTrackValid===true&&valid(nav.trackDeg)){
    out.actions.push({type:'HEADING',value:norm(nav.trackDeg)});
    out.rollCommandDeg=bankForHeading(nav.trackDeg);
    out.rollValid=true;
   }else out.reasons.push('LNAV_ACTIVE_LEG_TRACK_NOT_VERIFIED');
  }else if(direction==='VOR_LOC'||mcp.capture?.roll==='VOR_LOC'){
   if(nav?.courseTrackValid===true&&valid(nav.courseDeg)){
    out.actions.push({type:'HEADING',value:norm(nav.courseDeg)});
    out.rollCommandDeg=bankForHeading(nav.courseDeg);
    out.rollValid=true;
   }else out.reasons.push('VOR_LOC_CAPTURE_SOURCE_UNVERIFIED');
  }else if(active)out.reasons.push('ROLL_MODE_CWS_OR_NO_COMMAND');
  const pitchMode=m.vertical;
  if(pAxis==='CWS'){
   if(!valid(out.state.cwsAltitudeFt))out.state.cwsAltitudeFt=flight.altitudeFt;
   out.actions.push({type:'ALTITUDE',value:out.state.cwsAltitudeFt});
   out.pitchCommandDeg=pitchForVs(altitudeVs(out.state.cwsAltitudeFt));out.pitchValid=true;
  }else if(mcp.capture?.pitch==='FLARE'&&nav?.glideValid===true){
   const flareVs=clamp(-250+Math.max(0,50-(flight.radioAltitudeFt||0))*3,-250,-60);
   out.actions.push({type:'VS',value:flareVs});
   out.pitchCommandDeg=pitchForVs(flareVs);
   out.pitchValid=true;
  }else if(mcp.capture?.pitch==='G/S'&&nav?.glideValid===true){
   out.actions.push({type:'VS',value:nav.gsVsFpm});
   out.pitchCommandDeg=pitchForVs(nav.gsVsFpm);
   out.pitchValid=true;
  }else if(pitchMode==='ALT_HLD'||mcp.capture?.pitch==='ALT_HOLD'){
   if(!valid(out.state.altitudeHoldFt))
    out.state.altitudeHoldFt=mcp.capture?.pitch==='ALT_HOLD'&&valid(v.altitude)?
     v.altitude:flight.altitudeFt;
   out.actions.push({type:'ALTITUDE',value:out.state.altitudeHoldFt});
   out.pitchCommandDeg=pitchForVs(altitudeVs(out.state.altitudeHoldFt));
   out.pitchValid=true;
  }else if(pitchMode==='VS'){
   if(valid(v.verticalSpeed)){
    if(!acquireAltitude(v.altitude)){
     const targetVS=clamp(v.verticalSpeed,-5000,5000);
     out.actions.push({type:'VS',value:targetVS});
     out.pitchCommandDeg=pitchForVs(targetVS);
     out.pitchValid=true;
    }
   }
  }else if(pitchMode==='LVL_CHG'){
   if(valid(v.speed)&&valid(v.altitude)&&mcp.speedDisplayMode==='IAS'){
    const climb=Math.sign(v.altitude-flight.altitudeFt);
    const iasError=v.speed-flight.iasKt;
    // LVL CHG regulates IAS with pitch. A climb clearance must not
    // accidentally turn into descent merely because target IAS is high.
    const climbRate=climb>0?clamp(1700-iasError*12,0,2400):
     climb<0?clamp(-1700-iasError*12,-2400,0):0;
    out.actions.push({type:'SPEED',value:v.speed});
    if(!acquireAltitude(v.altitude)){
     out.actions.push({type:'VS',value:climbRate});
     out.pitchCommandDeg=pitchForVs(climbRate);
    }
    out.pitchValid=true;
   }else out.reasons.push('LVL_CHG_VALID_IAS_AND_ALTITUDE_REQUIRED');
  }else if(pitchMode==='VNAV'){
   if(nav?.fmcVerticalValid===true&&valid(nav.vsFpm)){
    out.actions.push({type:'VS',value:clamp(nav.vsFpm,-5000,5000)});
    out.pitchCommandDeg=pitchForVs(clamp(nav.vsFpm,-5000,5000));
    out.pitchValid=true;
   }else out.reasons.push('VNAV_FMC_VERTICAL_PROFILE_UNVERIFIED');
  }else if(mcp.capture?.pitch==='ALT_ACQ'&&valid(v.altitude)){
   acquireAltitude(v.altitude);
  }else if(active)out.reasons.push('PITCH_MODE_CWS_OR_NO_COMMAND');
  if(nav?.togaActive===true){
   // TO/GA: pitch guidance and ground-track roll steering remain valid
   // even though the ROLL FMA is intentionally blank in this mode.
   out.pitchValid=true;out.rollValid=true;
   out.pitchCommandDeg=nav.togaPitchDeg??15;
   out.rollCommandDeg=Number.isFinite(nav.togaTrackDeg)?
    bankForHeading(nav.togaTrackDeg):0;
   if(active){
    out.actions=out.actions.filter(a=>!['VS','ALTITUDE','ALT_ACQ','HEADING'].includes(a.type));
    out.actions.push({type:'VS',value:clamp(nav.togaVsFpm??1500,300,2200)});
    if(Number.isFinite(nav.togaTrackDeg))
     out.actions.push({type:'HEADING',value:norm(nav.togaTrackDeg)});
   }
  }
  // Independent axes: an active pitch mode never authorizes a roll cue,
  // and a blank lateral mode never suppresses an otherwise valid pitch cue.
  // CWS removes only its overridden axis; approach flare retracts both.
  const flareRetract=mcp.nav?.loc===true&&mcp.nav?.gs===true&&
   valid(flight.radioAltitudeFt)&&flight.radioAltitudeFt<=50;
  const pitchBar=out.pitchValid&&pAxis!=='CWS'&&!flareRetract;
  const rollBar=out.rollValid&&rAxis!=='CWS'&&!flareRetract;
  for(const [side,selector] of [['captain','left'],['firstOfficer','right']]){
   // Unified training contract: an engaged CMD A/P supplies the active
   // director-axis cues even if the corresponding physical F/D selector
   // was OFF at engagement. Without CMD, physical F/D still owns visibility.
   // Retract/flare overrides both. Do not synthesize the blank opposite axis.
   const selected=fdCommand(mcp.controls?.fd?.[selector]);
   const trainingCmd=cmd&&mcp.flightDirectorBarsRetracted!==true;
   const permitted=selected||trainingCmd;
   out.fdAxes[side]={pitch:permitted&&pitchBar,roll:permitted&&rollBar};
   out.fd[side]=out.fdAxes[side].pitch||out.fdAxes[side].roll;
  }
  // With no engaged autopilot, the F/D may still display command guidance,
  // but it does not automatically move the airplane.
  out.actions=active?out.actions:[];
  if(!active){out.altAcquireConfirmed=false;out.altitudeHoldConfirmed=false;}
  out.status=active?'COUPLED_'+(cmd?'CMD':'CWS'):'FD_ONLY_NOT_AUTOPILOT';
  out.state.reason=out.reasons.join(',')||out.status;
  return out;
 }
 return Object.freeze({VERSION,createState,evaluate});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
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
/* ./flight-scenario-panel-v1.js?v=FLT-UI-SLIM-0002&amp;aero=ACTUAL-TE-0001&amp;alt=ACQ-0001 */
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
/* ../../engine/flight/iran-radio-navaids-v1.js?v=IRAN-RADIONAV-0003 */
try{
/* B737 Classic Unified — educational VOR/DME and ILS geometry.
 * Community reference data only. NOT an AIRAC database, approved approach,
 * radio-propagation model, actual station status or flight-navigation source.
 * Runway threshold approximation is explicitly flagged for ILS; DME is
 * slant range to the modeled reference point, NOT a surveyed DME antenna.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document)root.B737IranRadioNavaidsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const R=Math.PI/180,EARTH_NM=3440.065,FT_PER_NM=6076.11549;
 const rad=n=>n*R,wrap=n=>(n%360+360)%360,delta=(a,b)=>((wrap(a-b)+540)%360)-180;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 // Existing OurAirports reference positions, published IR ENR references
 // and reference approach/runway locations. Nonoperational trainer data.
 const sites=[
  {ident:'TRN',type:'VOR_DME',freqKhz:115300,lat:35.696999,lon:51.283798,elevationFt:3960,source:'OURAIRPORTS_COMMUNITY'},
  {ident:'IKA',type:'VOR_DME',freqKhz:114300,lat:35.409698,lon:51.178501,elevationFt:3280,source:'OURAIRPORTS_COMMUNITY',note:'SIMULATED_ONLY_STATION_STATUS_UNVERIFIED'},
  {ident:'MSD',type:'VOR_DME',freqKhz:114000,lat:36.231201,lon:59.650600,elevationFt:3251,source:'OURAIRPORTS_COMMUNITY'},
  {ident:'SYZ',type:'VOR_DME',freqKhz:117800,lat:29.540199,lon:52.588799,elevationFt:4920,source:'OURAIRPORTS_COMMUNITY'},
  {ident:'IFN',type:'VORTAC',freqKhz:117100,lat:32.746389,lon:51.824722,elevationFt:5063,source:'PUBLIC_IR_ENR_REFERENCE'},
  {ident:'DHN',type:'VOR_DME',freqKhz:114500,lat:35.254167,lon:52.720278,elevationFt:2756,source:'PUBLIC_IR_ENR_REFERENCE'},
  // ITRN is shown as OIIE RWY 29L in user chart; OIII uses ITHL.
  {ident:'ITRN',type:'ILS_DME',freqKhz:110700,lat:35.4114,lon:51.165798,elevationFt:3305,courseTrueDeg:290,glideDeg:3,runway:'29L',airport:'OIIE',source:'USER_IRAN_CHART_2620',positionQuality:'PROVISIONAL_RWY_THR'},
  {ident:'IIKA',type:'ILS_DME',freqKhz:110300,lat:35.413101,lon:51.166000,elevationFt:3305,courseTrueDeg:288.88,glideDeg:3,runway:'29R',airport:'OIIE',source:'PUBLIC_OIIE_APPROACH_REF',positionQuality:'PROVISIONAL_RWY_THR'},
  // Mehrabad OIII RWY 29L: ident ITHL, frequency 109.90 MHz; threshold is a TRAINING proxy, not localizer/DME surveyed antenna.
  {ident:'ITHL',type:'ILS_DME',freqKhz:109900,lat:35.682400,lon:51.333599,elevationFt:3797,dmeElevationFt:3804,courseMagDeg:285,courseTrueDeg:289.75,glideDeg:3.3,tchFt:59,locMaxNm:18,gsMaxNm:10,runway:'29L',airport:'OIII',source:'JEPPESEN_OIII_11-1_IRAN2620_CHART',positionQuality:'PROVISIONAL_RWY_THR',dmePositionQuality:'COLOCATED_THRESHOLD_TRAINING_PROXY'},
  {ident:'IMSD',type:'ILS_DME',freqKhz:109900,lat:36.224098,lon:59.657100,elevationFt:3263,courseTrueDeg:313.74,glideDeg:3,runway:'31R',airport:'OIMM',source:'PUBLIC_OIMM_APPROACH_REF',positionQuality:'PROVISIONAL_RWY_THR'},
  {ident:'ISYZ',type:'ILS_DME',freqKhz:109900,lat:29.5391667,lon:52.5898333,elevationFt:4927,courseTrueDeg:294.4,glideDeg:3,runway:'29L',airport:'OISS',source:'PUBLIC_OISS_APPROACH_REF',positionQuality:'PROVISIONAL_AIRPORT_ARP'}
 ];
 const STATIONS=Object.freeze(sites.map(s=>Object.freeze(s)));
 const ALIASES=Object.freeze({MHD:'MSD'}); // MHD is an IATA airport code, not a separate VOR
 const byIdent=ident=>STATIONS.find(s=>s.ident===(ALIASES[String(ident).toUpperCase()]||String(ident).toUpperCase()))||null;
 function ground(from,to){
  const a=rad(from.lat),b=rad(to.lat),dl=rad(to.lon-from.lon),dp=b-a;
  const h=Math.sin(dp/2)**2+Math.cos(a)*Math.cos(b)*Math.sin(dl/2)**2;
  const distanceNm=2*EARTH_NM*Math.asin(Math.min(1,Math.sqrt(h)));
  const bearingTrue=wrap(Math.atan2(Math.sin(dl)*Math.cos(b),Math.cos(a)*Math.sin(b)-Math.sin(a)*Math.cos(b)*Math.cos(dl))/R);
  return {distanceNm,bearingTrue};
 }
 function dmeSlantNm(aircraft,station){
  const g=ground(aircraft,station).distanceNm;
  return Math.hypot(g,(Number(aircraft.altitudeFt)-Number(station.dmeElevationFt??station.elevationFt))/FT_PER_NM);
 }
 function validAircraft(a){return a&&Number.isFinite(a.lat)&&Math.abs(a.lat)<=90&&Number.isFinite(a.lon)&&Math.abs(a.lon)<=180&&Number.isFinite(a.altitudeFt);}
 function evaluate(aircraft,station,{variationDeg=null,courseMagDeg=null}={}){
  if(!validAircraft(aircraft)||!station)return null;
  const g=ground(aircraft,station),out={stationIdent:station.ident,stationLat:station.lat,stationLon:station.lon,
   tunedFrequencyMHz:station.freqKhz/1000,distanceNm:dmeSlantNm(aircraft,station),
   bearingDeg:g.bearingTrue,bearingReference:'TRUE',groundDistanceNm:g.distanceNm,
   quality:'TRAINING_GEOMETRY',source:station.source};
  if(station.type!=='ILS_DME'){
   const radialTrue=ground(station,aircraft).bearingTrue;
   const radialMag=Number.isFinite(variationDeg)?wrap(radialTrue-variationDeg):null;
   const toMag=Number.isFinite(variationDeg)?wrap(g.bearingTrue-variationDeg):null;
   const crs=Number.isFinite(courseMagDeg)?wrap(courseMagDeg):null;
   const to=crs!==null&&toMag!==null&&Math.abs(delta(toMag,crs))<=90;
   return {...out,radialMagDeg:radialMag,toFrom:crs===null||toMag===null?null:to?'TO':'FROM',
    deviationDots:crs===null||radialMag===null?null:clamp((to?delta(toMag,crs):delta(radialMag,crs))/2,-2.5,2.5)};
  }
  const fromThreshold=ground(station,aircraft);
  const approachRay=wrap(station.courseTrueDeg+180);
  const offAxis=delta(fromThreshold.bearingTrue,approachRay);
  const front=Math.abs(offAxis)<=35&&g.distanceNm<=(station.locMaxNm??18);
  const loc=front?clamp(offAxis/1.25,-2.5,2.5):null;
  const effectiveNm=Math.max(.03,g.distanceNm);
  const actualGlide=Math.atan2(aircraft.altitudeFt-station.elevationFt-(station.tchFt??50),effectiveNm*FT_PER_NM)/R;
  const gsValid=front&&g.distanceNm<=(station.gsMaxNm??10)&&Math.abs(actualGlide-station.glideDeg)<=5;
  return {...out,frontCourse:front,runway:station.runway,airport:station.airport,
   localizerDots:loc,glideslopeDots:gsValid?clamp((actualGlide-station.glideDeg)/.35,-2.5,2.5):null,
   glidepathAngleDeg:actualGlide,courseTrueDeg:station.courseTrueDeg,courseMagDeg:station.courseMagDeg??null,tchFt:station.tchFt??50,positionQuality:station.positionQuality};
 }
 function match(freqKhz,type,aircraft=null){
  if(!Number.isInteger(freqKhz))return null;
  const options=STATIONS.filter(s=>s.freqKhz===freqKhz&&(type==='ILS'?s.type==='ILS_DME':s.type!=='ILS_DME'));
  if(!options.length)return null;
  if(options.length===1)return options[0];
  if(!validAircraft(aircraft))return null;
  return options.sort((a,b)=>ground(aircraft,a).distanceNm-ground(aircraft,b).distanceNm)[0];
 }
 return Object.freeze({version:'IRAN-RADIONAV-TRAINING-0003',STATIONS,ALIASES,byIdent,ground,dmeSlantNm,evaluate,match,wrap,delta});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
