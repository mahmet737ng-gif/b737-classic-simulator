/* Unified B737 Classic instructor-only coupled AFDS/flight-plant control laws.
 * Same bank/pitch targets are used by the FCC command bars AND aircraft plant.
 * Illustrative training dynamics, not measured B737 autopilot actuator rates.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737FlightControlLawsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='B737_FLIGHT_CONTROL_LAWS_0001';
 const RAD=Math.PI/180,KT_TO_MPS=.514444,FTPM_TO_MPS=.3048/60;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const wrap=x=>((x%360)+360)%360;
 const difference=(from,to)=>((to-from+540)%360)-180;
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const RATES=Object.freeze({rollDegSec:3.2,pitchDegSec:1.15,vsFpmSec:420});
 const TRIM_PITCH_DEG=2;
 function bankForHeading(headingTrue,targetTrue,limitDeg=25){
  if(!finite(headingTrue)||!finite(targetTrue))return null;
  const err=difference(headingTrue,targetTrue);
  const bankLimit=clamp(finite(limitDeg)?limitDeg:25,10,30);
  return Math.abs(err)<.4?0:clamp(err*.65,-bankLimit,bankLimit);
 }
 function pitchForVs(vsFpm,tasKt){
  if(!finite(vsFpm)||!finite(tasKt))return null;
  const velocity=Math.max(60,tasKt)*KT_TO_MPS;
  return clamp(TRIM_PITCH_DEG+Math.atan(vsFpm*FTPM_TO_MPS/velocity)/RAD,-10,15);
 }
 function vsForPitch(pitchDeg,tasKt){
  if(!finite(pitchDeg)||!finite(tasKt))return null;
  const velocity=Math.max(60,tasKt)*KT_TO_MPS;
  return clamp(Math.tan(clamp(pitchDeg-TRIM_PITCH_DEG,-12,13)*RAD)*velocity/FTPM_TO_MPS,-5000,5000);
 }
 function altitudeVs(altitude,targetAlt,rate=2){
  if(!finite(altitude)||!finite(targetAlt))return null;
  const gap=targetAlt-altitude;
  return Math.abs(gap)<2?0:clamp(gap*rate,-2500,2500);
 }
 function guidance(frame,target){
  if(!frame||!target)return null;
  const tas=finite(frame.tasKt)?frame.tasKt:frame.iasKt;
  const bank=target.lateralMode==='BANK'?
   clamp(target.bankCommandDeg??0,-30,30):
   bankForHeading(frame.trueHeadingDeg,target.headingDeg,target.bankLimitDeg);
  let vs=target.vsFpm??0;
  if(target.verticalMode==='ALTITUDE')
   vs=altitudeVs(frame.altitudeFt,target.altitudeFt);
  else if(target.verticalMode==='GLIDEPATH'&&finite(target.glideVsFpm))
   vs=target.glideVsFpm;
  vs=clamp(vs,-5000,5000);
  return {desiredBankDeg:bank,desiredVsFpm:vs,
   desiredPitchDeg:pitchForVs(vs,tas),rates:RATES};
 }
 function move(current,target,maxRate,dt){
  if(!finite(current)||!finite(target)||!finite(maxRate)||!finite(dt)||dt<0)throw TypeError('CONTROL_SLEW');
  return current+clamp(target-current,-maxRate*dt,maxRate*dt);
 }
 function stepAttitude(frame,target,dt){
  const desired=guidance(frame,target);
  if(!desired)throw TypeError('INVALID_FLIGHT_CONTROL_TARGET');
  const bankDeg=move(frame.bankDeg,desired.desiredBankDeg,RATES.rollDegSec,dt);
  const pitchDeg=move(frame.pitchDeg,desired.desiredPitchDeg,RATES.pitchDegSec,dt);
  const commandedPhysicalVs=vsForPitch(pitchDeg,frame.tasKt);
  const vsFpm=move(frame.vsFpm,commandedPhysicalVs,RATES.vsFpmSec,dt);
  return {...desired,bankDeg,pitchDeg,vsFpm,
   actualVsFromPitchFpm:commandedPhysicalVs};
 }
 return Object.freeze({VERSION,RATES,TRIM_PITCH_DEG,bankForHeading,pitchForVs,
  vsForPitch,altitudeVs,guidance,stepAttitude,move,difference,wrap});
});
