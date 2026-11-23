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
