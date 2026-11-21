/* Instructor-only altitude acquisition for B737 Classic Unified.
 * Deliberately approximate AFDS: current observed V/S and distance select
 * a constant vertical deceleration profile. NOT a certified FCOM capture law.
 * One profile is consumed by the FCC, flight plant and MCP/FMA.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AltitudeCaptureTrainingV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_ALT_ACQ_TRAINER_0001';
 const MAX_DURATION_SEC=9;
 const MIN_DURATION_SEC=1.2;
 const MIN_TRACKING_VS_FPM=120;
 const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
 const finite=v=>typeof v==='number'&&Number.isFinite(v);
 function opportunity(input){
  const {altitudeFt,targetAltitudeFt,vsFpm}=input||{};
  if(![altitudeFt,targetAltitudeFt,vsFpm].every(finite))
   return {acquire:false,reason:'INVALID_ALTITUDE_OR_VS'};
  const gapFt=targetAltitudeFt-altitudeFt;
  const toward=gapFt*vsFpm>0,absVs=Math.abs(vsFpm);
  const timeToAltitudeSec=absVs>0?60*Math.abs(gapFt)/absVs:null;
  const inhibit=finite(input?.inhibitUntilSec)&&finite(input?.elapsedSec)&&
   input.elapsedSec<input.inhibitUntilSec;
  const arrivalTimeSec=MAX_DURATION_SEC/2;
  const lowRateHold=Math.abs(gapFt)<=6&&absVs<=MIN_TRACKING_VS_FPM;
  const acquire=!inhibit&&(lowRateHold||
   toward&&absVs>=MIN_TRACKING_VS_FPM&&
   timeToAltitudeSec<=arrivalTimeSec);
  return {acquire,reason:inhibit?'MCP_ALTITUDE_CHANGE_LOCKOUT':
   lowRateHold?'NEAR_LEVEL_LOW_RATE':!toward?'MOVING_AWAY':
   absVs<MIN_TRACKING_VS_FPM?'RATE_TOO_LOW':
   acquire?'TIME_TO_ALTITUDE_CAPTURE':'OUTSIDE_ACQUISITION_WINDOW',
   gapFt,vsFpm,timeToAltitudeSec,arrivalTimeSec,
   distanceNeededFt:absVs*MAX_DURATION_SEC/120};
 }
 function begin(input){
  const {altitudeFt,targetAltitudeFt,vsFpm}=input||{};
  if(![altitudeFt,targetAltitudeFt,vsFpm].every(finite))
   throw TypeError('INVALID_ALT_ACQ_START');
  const gap=targetAltitudeFt-altitudeFt,absVs=Math.abs(vsFpm);
  if(gap*vsFpm<0&&Math.abs(gap)>6)throw RangeError('ALT_ACQ_WRONG_DIRECTION');
  const exact=absVs>=1?120*Math.abs(gap)/absVs:MIN_DURATION_SEC;
  const durationSec=clamp(exact,MIN_DURATION_SEC,MAX_DURATION_SEC);
  return {schema:VERSION,phase:'ACQUIRE',
   entryAltitudeFt:altitudeFt,targetAltitudeFt,entryVsFpm:vsFpm,
   durationSec,elapsedSec:0,altitudeFt,vsFpm,
   decelerationFpmPerSec:durationSec>0?
    Math.abs(120*gap/(durationSec*durationSec)):0,
   source:'INSTRUCTOR_CONSTANT_DECELERATION_PROFILE'};
 }
 function advance(plan,dt){
  if(plan?.schema!==VERSION||!finite(dt)||dt<0||dt>2)
   throw TypeError('INVALID_ALT_ACQ_STEP');
  if(plan.phase==='HELD')return {...plan,altitudeFt:plan.targetAltitudeFt,vsFpm:0};
  const elapsedSec=clamp(plan.elapsedSec+dt,0,plan.durationSec);
  const fraction=elapsedSec/plan.durationSec;
  const gap=plan.targetAltitudeFt-plan.entryAltitudeFt;
  const altitudeFt=plan.entryAltitudeFt+gap*(2*fraction-fraction*fraction);
  // Derivative of altitude curve: starts at observed V/S when the capture
  // window is entered on time and decreases by a constant fpm per second.
  const vsFpm=120*gap/plan.durationSec*(1-fraction);
  return {...plan,phase:fraction>=1?'HELD':'ACQUIRE',
   elapsedSec,altitudeFt,vsFpm:fraction>=1?0:vsFpm};
 }
 return Object.freeze({VERSION,MAX_DURATION_SEC,MIN_DURATION_SEC,
  MIN_TRACKING_VS_FPM,opportunity,begin,advance});
});