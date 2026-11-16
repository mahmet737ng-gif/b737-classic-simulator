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
 const VERSION='B737_FCC_SCENARIO_GUIDANCE_0001';
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const norm=x=>((x%360)+360)%360;
 const delta=(from,to)=>((to-from+540)%360)-180;
 const valid=x=>typeof x==='number'&&Number.isFinite(x);
 function createState(){return {schema:VERSION,engagementKey:'',
  altitudeHoldFt:null,cwsHeadingDeg:null,cwsAltitudeFt:null,
  altitudeCapture:false,altitudeHeld:false,navCapture:false,reason:'NOT_ACTIVE'};}
 function evaluate(prior,mcp,flight,nav=null){
  if(prior?.schema!==VERSION)throw TypeError('FCC_STATE');
  const out={state:{...prior},actions:[],pitchCommandDeg:null,rollCommandDeg:null,
   pitchValid:false,rollValid:false,fd:{captain:false,firstOfficer:false},
   reasons:[],status:'INACTIVE',altAcquireConfirmed:false,altitudeHoldConfirmed:false};
  if(flight?.schema!=='B737_FLIGHT_SCENARIO_STATE_V1'||mcp?.power!==true)
   return {...out,status:'NO_ACTIVE_POWERED_FLIGHT_SOURCE'};
  const m=mcp.modes||{},a=mcp.axisControl||{},v=mcp.values||{};
  const active=/^(?:CMD|CWS)_[AB]$/.test(m.autopilot||'');
  const cmd=active&&(m.autopilot.startsWith('CMD_'));
  const pAxis=active?a.pitch:null,rAxis=active?a.roll:null;
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
  // CWS axes retain the attitude/heading at hand-off. No fabricated manual
  // yoke force: only an existing MCP CWS state can enable this hold.
  if(rAxis==='CWS'){
   if(!valid(out.state.cwsHeadingDeg))out.state.cwsHeadingDeg=flight.trueHeadingDeg;
   out.actions.push({type:'HEADING',value:norm(out.state.cwsHeadingDeg)});
   out.rollCommandDeg=0;out.rollValid=true;
  }else if(direction==='HDG_SEL'&&valid(v.heading)){
   out.actions.push({type:'HEADING',value:norm(v.heading)});
   out.actions.push({type:'BANK_LIMIT',value:bankLimit});
   out.rollCommandDeg=clamp(delta(flight.trueHeadingDeg,v.heading)*.75,-bankLimit,bankLimit);
   out.rollValid=true;
  }else if(direction==='LNAV'){
   if(nav?.fmcTrackValid===true&&valid(nav.trackDeg)){
    out.actions.push({type:'HEADING',value:norm(nav.trackDeg)});
    out.rollCommandDeg=clamp(delta(flight.trueHeadingDeg,nav.trackDeg)*.75,-bankLimit,bankLimit);
    out.rollValid=true;
   }else out.reasons.push('LNAV_ACTIVE_LEG_TRACK_NOT_VERIFIED');
  }else if(direction==='VOR_LOC'||mcp.capture?.roll==='VOR_LOC'){
   if(nav?.courseTrackValid===true&&valid(nav.courseDeg)){
    out.actions.push({type:'HEADING',value:norm(nav.courseDeg)});
    out.rollCommandDeg=clamp(delta(flight.trueHeadingDeg,nav.courseDeg)*.75,-bankLimit,bankLimit);
    out.rollValid=true;
   }else out.reasons.push('VOR_LOC_CAPTURE_SOURCE_UNVERIFIED');
  }else if(active)out.reasons.push('ROLL_MODE_CWS_OR_NO_COMMAND');
  const pitchMode=m.vertical;
  if(pAxis==='CWS'){
   if(!valid(out.state.cwsAltitudeFt))out.state.cwsAltitudeFt=flight.altitudeFt;
   out.actions.push({type:'ALTITUDE',value:out.state.cwsAltitudeFt});
   out.pitchCommandDeg=flight.pitchDeg;out.pitchValid=true;
  }else if(pitchMode==='ALT_HLD'||mcp.capture?.pitch==='ALT_HOLD'){
   if(!valid(out.state.altitudeHoldFt))out.state.altitudeHoldFt=flight.altitudeFt;
   out.actions.push({type:'ALTITUDE',value:out.state.altitudeHoldFt});
   const deltaAlt=out.state.altitudeHoldFt-flight.altitudeFt;
   out.pitchCommandDeg=clamp(flight.pitchDeg+clamp(deltaAlt*.012,-3,3)-flight.vsFpm*.00065,-10,20);
   out.pitchValid=true;
  }else if(pitchMode==='VS'){
   if(valid(v.verticalSpeed)){
    const targetVS=clamp(v.verticalSpeed,-5000,5000);
    out.actions.push({type:'VS',value:targetVS});
    out.pitchCommandDeg=clamp(flight.pitchDeg+clamp((targetVS-flight.vsFpm)*.002,-6,6),-10,20);
    out.pitchValid=true;
    // Selected MCP altitude is a *capture boundary*, not a replacement for
    // V/S command immediately after engagement.
    const selected=v.altitude,remaining=selected-flight.altitudeFt;
    const approaching=(remaining>0&&targetVS>0)||(remaining<0&&targetVS<0);
    if(valid(selected)&&approaching&&Math.abs(remaining)<250){
     out.state.altitudeCapture=true;out.altAcquireConfirmed=true;
     out.actions.push({type:'ALTITUDE',value:selected});
     if(Math.abs(remaining)<35&&Math.abs(flight.vsFpm)<500){
      out.state.altitudeHeld=true;out.altitudeHoldConfirmed=true;
     }
    }
   }
  }else if(pitchMode==='LVL_CHG'){
   if(valid(v.speed)&&valid(v.altitude)&&mcp.speedDisplayMode==='IAS'){
    const climb=Math.sign(v.altitude-flight.altitudeFt);
    const iasError=v.speed-flight.iasKt;
    const climbRate=clamp((climb*1700)-iasError*20,-2500,2500);
    out.actions.push({type:'SPEED',value:v.speed});
    out.actions.push({type:'VS',value:Math.abs(v.altitude-flight.altitudeFt)<120?0:climbRate});
    out.pitchCommandDeg=clamp(flight.pitchDeg+clamp((climbRate-flight.vsFpm)*.0015,-6,6),-10,20);
    out.pitchValid=true;
    if(Math.abs(v.altitude-flight.altitudeFt)<250&&climb!==0)
     {out.altAcquireConfirmed=true;out.actions.push({type:'ALTITUDE',value:v.altitude});}
   }else out.reasons.push('LVL_CHG_VALID_IAS_AND_ALTITUDE_REQUIRED');
  }else if(pitchMode==='VNAV'){
   if(nav?.fmcVerticalValid===true&&valid(nav.vsFpm)){
    out.actions.push({type:'VS',value:clamp(nav.vsFpm,-5000,5000)});
    out.pitchCommandDeg=clamp(flight.pitchDeg+(nav.vsFpm-flight.vsFpm)*.002,-10,20);
    out.pitchValid=true;
   }else out.reasons.push('VNAV_FMC_VERTICAL_PROFILE_UNVERIFIED');
  }else if(mcp.capture?.pitch==='ALT_ACQ'&&valid(v.altitude)){
   out.actions.push({type:'ALTITUDE',value:v.altitude});
   out.pitchCommandDeg=clamp(flight.pitchDeg+(v.altitude-flight.altitudeFt)*.018,-10,20);
   out.pitchValid=true;
  }else if(active)out.reasons.push('PITCH_MODE_CWS_OR_NO_COMMAND');
  // FCOM 4.20.4: both commanded pitch and roll modes must be available.
  // CWS forced handover retracts FD bars on the overridden axis.
  const validBars=out.pitchValid&&out.rollValid&&pAxis!=='CWS'&&rAxis!=='CWS';
  out.fd.captain=fdCommand(mcp.controls?.fd?.left)&&validBars;
  out.fd.firstOfficer=fdCommand(mcp.controls?.fd?.right)&&validBars;
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
