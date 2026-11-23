(async()=>{
;
/* ../../engine/afds/fcc-flight-guidance-v1.js?v=FCC-GUIDANCE-TOGA-FD-SPEED-20261123&amp;fd=CMD-AXES-0002&amp;alt=ACQ-0001&amp;ils=SHI-CH4-0004 */
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
   // TRAINING-ONLY sink-rate scheduling; Boeing FCOM does not publish
   // touchdown servo gains. Retains realistic descent to runway after 50 RA.
   const flareVs=clamp(-420+Math.max(0,50-(flight.radioAltitudeFt||0))*3,-420,-250);
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
   // Go-around pitch remains commanded while a separately selected roll
   // mode can replace track-hold above 400ft per FCOM 4.20.24-26.
   const rollSelected=!!m.lateral;
   out.pitchValid=true;
   out.pitchCommandDeg=nav.togaPitchDeg??15;
   if(!rollSelected){
    out.rollValid=true;
    out.rollCommandDeg=Number.isFinite(nav.togaTrackDeg)?
     bankForHeading(nav.togaTrackDeg):0;
   }
   if(active){
    out.actions=out.actions.filter(a=>!['VS','ALTITUDE','ALT_ACQ','PITCH'].includes(a.type)&&
     (rollSelected||a.type!=='HEADING'));
    // Engaged CMD uses the same 13/15-degree GA pitch commanded by F/D.
    out.actions.push({type:'PITCH',value:clamp(nav.togaPitchDeg??15,-10,15)});
    if(!rollSelected&&Number.isFinite(nav.togaTrackDeg))
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
   // FCOM 4.20.7/26: pressing TO/GA in flight may automatically bring
   // both flight director bars into view even if physical F/D switches are OFF.
   const permitted=selected||trainingCmd||
    (nav?.togaActive===true&&nav?.togaFdAutoPopUp===true&&
     mcp.flightDirectorBarsRetracted!==true);
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
/* ../../engine/afds/classic-toga-ch4-v1.js?v=CH4-TOGA-FD-SPEED-20261123&amp;trainer=TOGA-145-FD-N1-110-125-0001 */
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
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 const FCOM_TAKEOFF_INCREMENT_KT=20;
 const trainerIncrement=c=>c.takeoffSpeedIncrementKt===15?15:FCOM_TAKEOFF_INCREMENT_KT;
 function eligibleTakeoffFdPopUp(c){
  // SHI 4.20.14: OFF-switch pop-up only after 80 KIAS,
  // below 2000ft AGL, and less than 150s since lift-off.
  return safe(c.iasKt,0)>80&&safe(c.radioAltitudeFt,Infinity)<2000&&
   safe(c.sinceLiftoffSec,0)<150;
 }
 function speedPitch(state,c,dt){
  const ias=safe(c.iasKt,state.previousIasKt??0);
  const accel=finite(c.iasAccelerationKtSec)?c.iasAccelerationKtSec:
   dt>=.05&&finite(state.previousIasKt)?(ias-state.previousIasKt)/dt:0;
  const acceleration=clamp(accel,-5,5);
  const error=ias+2*acceleration-safe(state.targetSpeedKt,ias);
  const n1=safe(c.availableN1Percent,85),vs=safe(c.vsFpm,1500);
  const massKg=safe(c.massKg,60000),flapDeg=safe(c.flapActualDeg,5);
  // Classroom surrogate: NOT Boeing-published FCC gains.
  const equilibrium=clamp(9+.07*(n1-85)+clamp((vs-1500)/1500,-1,1)+
   clamp((massKg-60000)/1000,-25,20)*.035-
   clamp(flapDeg,0,40)*.025,6,12);
  let demand=clamp(equilibrium+.30*error-.25*safe(c.pitchRateDegSec,0),1,15);
  if(ias<safe(state.targetSpeedKt,ias)-20)demand=Math.min(demand,7);
  const current=safe(state.fdPitchDeg,15);
  return {pitch:clamp(current+clamp(demand-current,-3*dt,3*dt),1,15),
   acceleration,raw:demand};
 }
 const initial=()=>({version:VERSION,phase:'OFF',presses:0,elapsedSec:0,liftoffSec:null,
  initialSpeedKt:null,fdPitchDeg:0,fdRollTrackDeg:null,thrustDemand:'NONE',
  atMode:'',pitchMode:'',rollMode:'',afdsMode:'',apDisengage:false,
  targetSpeedKt:null,atLimit:'NONE',throttleFraction:0,reason:'NOT_ENGAGED',
  singleEngine:false,engineFailureAfterEngagement:false,gaFullReady:false,
  fdAutoPopUp:false,takeoffV2Kt:null,takeoffIncrementKt:FCOM_TAKEOFF_INCREMENT_KT,
  speedGuidanceActive:false,climbQualifiedSec:0,previousIasKt:null,
  previousPitchDeg:null,n1SelectedAfterArm:false,
  accelerationKtSec:0,pitchDemandRawDeg:null});
 function engineCount(c){return Number(c.engine1Running===true)+Number(c.engine2Running===true);}
 function engage(previous,ctx={}){
  if(!['OFF','TO','GA'].includes(previous?.phase))throw Error('Invalid TOGA previous state');
  const airborne=ctx.airborne===true;
  const engines=engineCount(ctx);
  const fdSelected=ctx.fdLeft===true||ctx.fdRight===true;
  const at=ctx.atArmed===true;
  const altitude=safe(ctx.radioAltitudeFt,Infinity),postTouchdown=ctx.touchedDown===true;
  const canGA=(airborne&&altitude<2000&&ctx.isTakeoffMode!==true)||
   (postTouchdown&&safe(ctx.sinceTouchdownSec,Infinity)<=2);
  if(!airborne&&ctx.groundReady!==true&&!postTouchdown)return {...previous,reason:'GROUND_TAKEOFF_NOT_ARMED'};
  if(airborne&&!canGA)return {...previous,reason:'GA_NOT_AVAILABLE'};
  const phase=airborne||postTouchdown?'GA':'TO';
  const autoPop=phase==='TO'?eligibleTakeoffFdPopUp(ctx):
   ctx.allowFdAutoEngage===true&&altitude<2000;
  // Pressing TO/GA on the runway is permitted with BOTH FD switches OFF.
  // Command bars are a separate indication and pop up when qualified.
  if(phase==='GA'&&!fdSelected&&!autoPop)
   return {...previous,reason:'GO_AROUND_FD_CONDITION_NOT_MET'};
  // FCOM 4.20.24: only dual A/P with FLARE armed retains A/P for GA.
  const dual=ctx.apChannels===2&&ctx.flareArmed===true&&!postTouchdown;
  const target=safe(ctx.iasKt,0);
  const approachTarget=safe(ctx.selectedSpeedKt,target);
  const single=engines===1;
  const v2=safe(ctx.selectedSpeedKt,safe(ctx.v2Kt,target));
  const increment=trainerIncrement(ctx);
  return {...initial(),phase,presses:1,initialSpeedKt:target,
   fdAutoPopUp:!fdSelected&&autoPop,takeoffV2Kt:phase==='TO'?v2:null,
   takeoffIncrementKt:increment,previousIasKt:target,
   fdPitchDeg:phase==='TO'?(target<60?-10:15):single?13:15,
   fdRollTrackDeg:safe(ctx.groundTrackDeg,0),
   thrustDemand:at&&engines>0?(phase==='TO'?'TAKEOFF_LIMIT':'GA_REDUCED'):'NONE',
   atMode:at&&engines>0?(phase==='TO'?'N1':'GA'):'',
   pitchMode:'TO/GA',rollMode:phase==='TO'&&ctx.takeoffRollHdGSel===true?'HDG SEL':'',
   afdsMode:dual?'CMD':'FD',apDisengage:(ctx.apChannels??0)>0&&!dual,
   targetSpeedKt:phase==='TO'?(single?Math.max(safe(ctx.v2Kt,v2),v2):v2+increment):
    single?Math.max(safe(ctx.v2Kt,0),approachTarget):approachTarget,
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
  // An OFF-switch ground TO/GA starts immediately; the two FD bars
  // automatically appear only after the documented 80 KIAS threshold.
  if(previous.phase==='TO'&&ctx.fdLeft!==true&&ctx.fdRight!==true)
   next.fdAutoPopUp=previous.fdAutoPopUp||eligibleTakeoffFdPopUp(ctx);
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
    // MCP takeoff V2 is retained even when separate takeoff-data is absent.
    const takeoffV2=safe(previous.takeoffV2Kt,safe(ctx.selectedSpeedKt,v2));
    next={...next,singleEngine:true,engineFailureAfterEngagement:true,
     targetSpeedKt:takeoffV2>0?Math.max(takeoffV2,Math.min(takeoffV2+20,ias)):
      safe(ctx.selectedSpeedKt,ias),
     reason:'ENGINE_FAILURE_DURING_TAKEOFF'};
   }
  }
  if(previous.phase==='TO'){
   // Fixed ground-roll cue, then a predictive IAS director after positive
   // climb is established. MCP V2 stays the speed reference for this mode.
   if(!next.singleEngine&&finite(ctx.selectedSpeedKt)){
    next.takeoffV2Kt=ctx.selectedSpeedKt;
    next.targetSpeedKt=ctx.selectedSpeedKt+next.takeoffIncrementKt;
   }
   if(ctx.airborne===true&&previous.liftoffSec===null)next.liftoffSec=elapsed;
   if(ctx.airborne===true){
    next.climbQualifiedSec=safe(ctx.vsFpm,0)>=300?
     previous.climbQualifiedSec+dtSec:0;
    next.speedGuidanceActive=previous.speedGuidanceActive||
     next.climbQualifiedSec>=.75;
   }
   if(next.speedGuidanceActive&&ctx.airborne===true){
    const actualPitchRate=dtSec>=.05&&finite(previous.previousPitchDeg)&&
     finite(ctx.pitchDeg)?clamp((ctx.pitchDeg-previous.previousPitchDeg)/dtSec,-6,6):0;
    const cue=speedPitch({...previous,targetSpeedKt:next.targetSpeedKt},
     {...ctx,pitchRateDegSec:actualPitchRate},dtSec);
    next.fdPitchDeg=cue.pitch;
    next.accelerationKtSec=cue.acceleration;
    next.pitchDemandRawDeg=cue.raw;
   }else{
    next.fdPitchDeg=ias<60?-10:15;
    next.pitchDemandRawDeg=next.fdPitchDeg;
   }
   next.previousIasKt=ias;
   next.previousPitchDeg=safe(ctx.pitchDeg,previous.previousPitchDeg);
   if(ias>=84&&next.atMode==='N1'&&!next.n1SelectedAfterArm){next.atMode='THR HLD';next.thrustDemand='THR_HOLD';}
   if(ctx.airborne===true&&next.liftoffSec!==null){
    const after=elapsed-next.liftoffSec;
    // Unified instructor schedule: THR HLD -> ARM at 400 ft AGL; N1
    // may then be explicitly reselected from the real MCP pushbutton.
    if(ra>=400&&next.atMode==='THR HLD'){next.atMode='ARM';next.thrustDemand='ARM';}
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
 function selectN1(previous,ctx={}){
  if(previous?.phase!=='TO')return {...previous,reason:'N1_RESELECT_REQUIRES_TAKEOFF'};
  if(safe(ctx.radioAltitudeFt,0)<400)return {...previous,reason:'N1_BELOW_400_RA'};
  if(ctx.atArmed!==true||engineCount(ctx)<1)
   return {...previous,reason:'N1_REQUIRES_ARMED_RUNNING_ENGINE'};
  if(previous.atMode!=='ARM')return {...previous,reason:'WAIT_THR_HLD_TO_ARM'};
  return {...previous,atMode:'N1',thrustDemand:'TAKEOFF_LIMIT',
   throttleFraction:1,n1SelectedAfterArm:true,reason:'N1_SELECTED_AFTER_400_RA'};
 }
 function fma(s){
  return {at:s.atMode,pitch:s.pitchMode,roll:s.rollMode,afds:s.afdsMode,
   fdPitch:s.fdPitchDeg,targetSpeedKt:s.targetSpeedKt,thrust:s.thrustDemand};
 }
 return Object.freeze({VERSION,FCOM_TAKEOFF_INCREMENT_KT,eligibleTakeoffFdPopUp,
  initial,engage,press,advance,selectN1,fma});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./flight-scenario-panel-v1.js?v=FLT-READY-GATE-0001&amp;aero=ACTUAL-TE-0001&amp;alt=ACQ-0001&amp;ils=SHI-CH4-0004&amp;trainer=TOGA-145-FD-N1-110-125-0001 */
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
 let tickErrorCount=0,lastTickError=null,crewFollower=false;
 const crewEvent=(type,value)=>win.dispatchEvent(new CustomEvent('b737:crew-flight-command',{detail:{type,value}}));
 const VERSION='UNIFIED-FLIGHT-SCENARIOS-0009-FINAL10-STARTPAUSE';
 const html=`
  <div class="flight-head"><strong id="flightScenarioTitle">FLIGHT SCENARIO ENGINE</strong><button id="flightScenarioClose" type="button" aria-label="Close flight scenarios">×</button></div>
  <p class="flight-sub">B737 Classic · Instructor training model · MSL altitude / MAGNETIC heading using live WMM2025 variation; TRUE retained inside flight physics. Training only.</p>
  <div class="flight-grid">
   <label>Airport<select id="flightAirport"><option value="OIMM">MASHHAD · OIMM</option><option value="OIII">TEHRAN MEHRABAD · OIII</option><option value="OISS">SHIRAZ · OISS</option><option value="OIFM">ESFAHAN · OIFM</option></select></label>
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
  if(!['FINAL_5','FINAL_10','RUNWAY_READY'].includes(config.preset))return {};
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
   const next=Core.newScenario(config,approachThresholds(config));
   if(typeof beforeStart==='function')beforeStart();
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
 const api=Object.freeze({version:VERSION,getState:snapshot,startFromSelection:load,
  loadScenario:config=>{state=Core.newScenario(config,approachThresholds(config));
   win.B737UnifiedFlightLocationV1?.choose({lat:state.lat,lon:state.lon,icao:state.icao,source:'FLIGHT_SCENARIO_INITIAL_POSITION'});
   active=true;pause=state.preset==='FINAL_10';previouslyCoupled=false;lastTick=performance.now();
   syncInitialEngineContext();
   publish();lastPublish=performance.now();updateUI();
   if(state.preset==='FINAL_10')win.B737Final10ApproachPresetV1?.apply?.(state);
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./instructor-advanced-failures-v1.js?v=ADV-FAILURES-20261122-01 */
try{
/* Unified instructor advanced fault and scenario controls · additive live bridge.
 * Training only. No DOM lamp overrides; all non-native fault changes are published
 * as typed events for authoritative system consumers. */
(function(win){
 'use strict';
 if(!win?.document)return;
 const doc=win.document;
 const KEY='b737.unified.advanced-failures.v1';
 const catalogue=[
  {group:'NAVIGATION',items:[['irs.left','LEFT IRS FAILURE'],['irs.right','RIGHT IRS FAILURE'],['irs.both','BOTH IRS FAILURE'],['fmc.left','LEFT FMC FAILURE'],['fmc.right','RIGHT FMC FAILURE'],['fmc.both','BOTH FMC FAILURE']]},
  {group:'FLIGHT INSTRUMENTS',items:['CPT','FO'].flatMap(seat=>['EADI','EHSI','ASI','ALTIMETER','VSI','RDMI','IVSI'].map(unit=>[seat.toLowerCase()+'.'+unit.toLowerCase(),seat+' '+unit+' FAILURE']))},
  {group:'AIR SYSTEMS',items:[['air.autoFail','PRESSURIZATION AUTO FAIL'],['air.cargoDoor','CARGO DOOR PRESSURE LOSS']]},
  {group:'ENGINES',items:[['engine.1.startValveOpen','ENG 1 START VALVE STUCK OPEN'],['engine.2.startValveOpen','ENG 2 START VALVE STUCK OPEN']]},
  {group:'HYDRAULICS',items:[['hyd.a.loss','SYSTEM A LOSS'],['hyd.b.loss','SYSTEM B LOSS'],['hyd.standbyPump','STANDBY PUMP FAILURE'],['hyd.ptu','PTU FAILURE'],['hyd.lgtu','LANDING GEAR TRANSFER UNIT FAILURE']]}
 ];
 const all=new Set(catalogue.flatMap(g=>g.items.map(x=>x[0])));
 let failed=new Set(),selected='emergency-descent',cause='autoFail',severity='uncontrolled',messageNode=null;
 const meta={engine:{},hydraulics:{},pressurization:null};
 function message(text,error=false){if(messageNode){messageNode.textContent=text;messageNode.dataset.error=String(error);}}
 function emit(name,detail){win.dispatchEvent(new CustomEvent(name,{detail}));}
 function read(){try{const v=JSON.parse(win.sessionStorage.getItem(KEY)||'[]');return new Set(Array.isArray(v)?v.filter(id=>all.has(id)):[]);}catch{return new Set();}}
 failed=read();
 function publish(){
  win.sessionStorage.setItem(KEY,JSON.stringify([...failed]));
  emit('b737:advanced-failures-changed',{source:'UNIFIED_INSTRUCTOR',failures:[...failed],at:Date.now()});
  refresh();
 }
 function set(id,active){
  if(!all.has(id))throw Error('Unknown fault '+id);
  if(active)failed.add(id);else failed.delete(id);
  // Both fails dominate individual channel status, without deleting individual selections.
  publish();
  if(id.startsWith('hyd.')){
   const h=win.B737HydraulicLabV1;
   if(h?.inject){
    const bridge={'hyd.a.loss':'A_RAPID_LEAK','hyd.b.loss':'B_RAPID_LEAK',
     'hyd.standbyPump':'STBY_PUMP_FAIL','hyd.ptu':'PTU_FAIL','hyd.lgtu':'LGTU_FAIL'};
    // Independent test-lab state remains isolated from Unified.
    emit('b737:hydraulic-failure-request',{id,active,labId:bridge[id]});
   }
  }
 }
 function isFailed(id){return failed.has(id);}
 function channelFailed(sys,side){return isFailed(sys+'.both')||isFailed(sys+'.'+side);}
 function status(){return Object.freeze({navigation:{
  irs:{left:!channelFailed('irs','left'),right:!channelFailed('irs','right')},
  fmc:{left:!channelFailed('fmc','left'),right:!channelFailed('fmc','right')}},
  instruments:Object.fromEntries(['cpt','fo'].map(seat=>[seat,Object.fromEntries(['eadi','ehsi','asi','altimeter','vsi','rdmi','ivsi'].map(unit=>[unit,!isFailed(seat+'.'+unit)]))])),
  air:{autoFail:isFailed('air.autoFail'),cargoDoor:isFailed('air.cargoDoor')},
  engines:{startValve1Stuck:isFailed('engine.1.startValveOpen'),startValve2Stuck:isFailed('engine.2.startValveOpen')},
  hydraulics:{aFailed:isFailed('hyd.a.loss'),bFailed:isFailed('hyd.b.loss'),
    standbyPumpFailed:isFailed('hyd.standbyPump'),ptuFailed:isFailed('hyd.ptu'),lgtuFailed:isFailed('hyd.lgtu')}});}
 function refresh(){
  for(const el of doc.querySelectorAll('[data-advanced-failure]')){
   const yes=failed.has(el.dataset.advancedFailure);el.checked=yes;
  }
  const count=doc.getElementById('advancedFailureCount');
  if(count)count.textContent=failed.size+' ACTIVE';
 }
 function el(tag,parent,cls,txt){
  const node=doc.createElement(tag);
  if(cls)node.className=cls;if(txt!==undefined)node.textContent=txt;
  parent?.append(node);return node;
 }
 function labelControl(parent,text,tag,values,id){
  const l=el('label',parent,'adv-label');el('span',l,'',text);
  const input=el(tag,l);input.id=id;
  if(tag==='select')for(const [v,t] of values){const option=el('option',input,'',t);option.value=v;}
  return input;
 }
 function installFailures(){
  const panel=doc.getElementById('failuresHeaderPopover');
  if(!panel||panel.querySelector('#advancedFailureBranch'))return !!panel;
  for(const group of catalogue){
   const section=el('details',panel,'failures-electrical');
   if(group.group==='NAVIGATION')section.id='advancedFailureBranch';
   const header=el('summary',section,'failures-section-title',group.group);
   if(group.group==='NAVIGATION'){const n=el('span',header,'failures-branch-counter','0 ACTIVE');n.id='advancedFailureCount';}
   const grid=el('div',section,'adv-failure-grid');
   for(const [id,title] of group.items){
    const label=el('label',grid,'adv-failure-label');
    const input=el('input',label);input.type='checkbox';input.dataset.advancedFailure=id;
    input.checked=failed.has(id);
    input.onchange=()=>set(id,input.checked);
    el('span',label,'',title);
   }
   if(group.group==='HYDRAULICS'){
    const open=el('button',section,'adv-action','OPEN HYDRAULIC LIVE TEST LAB');
    open.type='button';open.onclick=()=>win.B737HydraulicLabV1?.open?.();
   }
  }
  messageNode=el('p',panel,'failures-feedback','Advanced failures are available for instructor selection; avionics/engine/aircraft effects require a connected consumer.');
  messageNode.id='advancedFailureFeedback';
  const clear=el('button',panel,'adv-action','CLEAR ADVANCED FAILURES');
  clear.type='button';clear.onclick=()=>{failed.clear();publish();message('Advanced instructor failures cleared.');};
  refresh();return true;
 }
 function flightPreset(altitude,speed){
  const bridge=win.B737UnifiedFlightScenarioV1;
  if(!bridge?.loadScenario)throw Error('FLT PHASE ENGINE NOT READY');
  const airport=doc.getElementById('flightAirport')?.value||'OIMM';
  const runway=doc.getElementById('flightRunway')?.value||'31';
  return bridge.loadScenario({airport,runway,preset:'MANUAL',
    airborne:true,altitudeFt:altitude,speedKt:speed,
    headingDeg:Number(doc.getElementById('flightHeading')?.value)||0,
    lat:Number(doc.getElementById('flightLat')?.value)||36.235,
    lon:Number(doc.getElementById('flightLon')?.value)||59.643});
 }
 function busBothOff(){
  const p=win.B737UnifiedBusFailureInjectionV1;
  if(!p?.live?.get||!p?.payload||!p?.live?.write)throw Error('LIVE ELECTRICAL INJECTION NOT READY');
  const old=p.live.get(),keys=new Set(old.active?old.offBusKeys:[]);
  keys.add('transfer1@115VAC');keys.add('transfer2@115VAC');
  p.live.write(p.payload(p.BUS_KEYS.filter(k=>keys.has(k))));
 }
 function launch(){
  try{
   if(selected==='both-bus-off-climb'){
    const loaded=flightPreset(12000,260);
    busBothOff();
    emit('b737:instructor-scenario-loaded',{id:selected,phase:'CLIMB',altitudeFt:12000,targetAltitudeFt:30000,verticalRateFpm:1800,loaded});
   }else if(selected==='emergency-descent'){
    const loaded=flightPreset(31000,280);
    set(cause==='cargoDoor'?'air.cargoDoor':'air.autoFail',true);
    const state={id:selected,cause,severity,phase:'CRUISE',aircraftAltitudeFt:31000,
      cabinAltitudeFt:5500,cabinDifferentialPsi:7.83,
      initialCabinRateFpm:0,manualRecoveryAllowed:severity==='controlled',loaded};
    meta.pressurization=state;
    emit('b737:instructor-scenario-loaded',state);
   }else if(selected==='hydraulic-a'||selected==='hydraulic-b'){
    flightPreset(31000,280);
    set(selected==='hydraulic-a'?'hyd.a.loss':'hyd.b.loss',true);
    emit('b737:instructor-scenario-loaded',{id:selected,phase:'CRUISE'});
   }else throw Error('UNKNOWN SCENARIO');
   const node=doc.getElementById('advancedScenarioStatus');
   if(node)node.textContent='SCENARIO REQUESTED · '+selected.toUpperCase()+
    ' · Only connected native consumers will change actual cockpit indications.';
  }catch(e){const node=doc.getElementById('advancedScenarioStatus');
   if(node)node.textContent='SCENARIO LOAD FAILED: '+String(e.message||e);}
 }
 function installScenarios(){
  const dialog=doc.getElementById('flightScenarioDialog');
  if(!dialog||dialog.querySelector('#advancedScenarioBlock'))return !!dialog;
  const block=el('section',null,'adv-scenario');block.id='advancedScenarioBlock';
  el('strong',block,'','INSTRUCTOR NON-NORMAL SCENARIOS');
  const opt=labelControl(block,'Scenario','select',[
   ['emergency-descent','EMERGENCY DESCENT · PRESSURIZATION'],
   ['both-bus-off-climb','BOTH BUS OFF · CLIMB 12,000 FT'],
   ['hydraulic-a','LOSS OF HYDRAULIC SYSTEM A'],
   ['hydraulic-b','LOSS OF HYDRAULIC SYSTEM B']], 'advScenarioSelect');
  opt.onchange=()=>{selected=opt.value;setVisible();};
  const choices=el('div',block,'adv-choices');choices.id='advancedPressurizationOptions';
  const reason=labelControl(choices,'Cause','select',[['autoFail','AUTO FAIL'],['cargoDoor','CARGO DOOR']],'advCause');
  const mode=labelControl(choices,'Severity','select',[['controlled','CONTROLLED'],['uncontrolled','UNCONTROLLED']],'advSeverity');
  mode.value=severity;reason.onchange=()=>{cause=reason.value;};
  mode.onchange=()=>{severity=mode.value;};
  const launchButton=el('button',block,'adv-action','LOAD SELECTED NON-NORMAL SCENARIO');
  launchButton.type='button';launchButton.onclick=launch;
  const status=el('p',block,'flight-status','Load this scenario using its separate button. Pilot response and system follow-up are training-only.');
  status.id='advancedScenarioStatus';
  const original=doc.getElementById('flightScenarioStatus');dialog.insertBefore(block,original);
  function setVisible(){choices.hidden=selected!=='emergency-descent';}
  setVisible();return true;
 }
 function installStyle(){
  if(doc.getElementById('advancedInstructorStyle'))return;
  const s=el('style',doc.head);s.id='advancedInstructorStyle';
  s.textContent='.adv-failure-grid{padding:12px;display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:8px}.adv-failure-label{display:flex;align-items:center;gap:8px;font:12px system-ui;color:#d8e5ee}.adv-failure-label input{accent-color:#d99c40}.adv-action{margin:9px;padding:9px 13px;background:#16324b;color:#f3f9ff;border:1px solid #5984a7;border-radius:6px;cursor:pointer}.adv-scenario{margin:12px 0;padding:12px;border:1px solid #5a7890;border-radius:7px;background:#102332;color:#eaf5ff;display:grid;gap:8px}.adv-label{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.adv-label select{background:#10202c;color:#fff;padding:7px;border:1px solid #62839c;border-radius:5px}.adv-choices{display:flex;gap:20px;flex-wrap:wrap}.adv-choices[hidden]{display:none}';
 }
 let tries=0;
 function mount(){installStyle();const a=installFailures(),b=installScenarios();
  if((!a||!b)&&++tries<40)win.setTimeout(mount,250);
 }
 const api=Object.freeze({version:'ADV-FAILURES-20261122-01',getStatus:status,
  getFailures:()=>[...failed],setFailure:set,launchScenario:(id,options={})=>{
   selected=id;cause=options.cause||cause;severity=options.severity||severity;launch();},
  refresh,mount});
 win.B737UnifiedAdvancedInstructorV1=api;
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
