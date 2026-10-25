/* Continuous *training* interpolation between ISN-03 discrete checkpoints.
 * This is not a physical engine performance model or an external sensor.
 * The source-backed 25% fuel cue and approximate 46% starter cutout remain
 * enforced by the independent ISN start-sequence rules engine.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNEngineStartDynamicsV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const ORIGIN='TRAINING_SEQUENCE_SIMULATED';
 const duration=Object.freeze({motoringMs:850,lightoffMs:1000});
 // Instructor-injected endpoints only: neither a certified start schedule nor
 // a diagnostic threshold for a real engine.
 const faultTargets=Object.freeze({noLightOffN2:32,hungStartN2:35,hungStartEgtC:250});
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};

 // Owner-requested simulator-only target envelope, not AFM/CFM certified data.
 const ENVELOPE=Object.freeze({
  groundIdle:Object.freeze({n1Percent:22,n2Percent:60,egtC:445,fuelFlowKgHr:360}),
  flightIdle:Object.freeze({n1Percent:32,n2Percent:78,egtC:495,fuelFlowKgHr:430}),
  fullThrust:Object.freeze({n1Percent:97,n2Percent:101,egtC:695,fuelFlowKgHr:4000}),
  normalStartPeakEgtC:620,
  responseMs:Object.freeze({n1Up:2200,n1Down:3500,n2Up:3000,n2Down:4600,egtUp:1600,egtDown:3200,fuelUp:1800,fuelDown:2500})
 });
 const startEgt=p=>{const t=clamp(p,0,1);
  if(t<=.5)return 420*t;
  if(t<=.75)return 210+(ENVELOPE.normalStartPeakEgtC-210)*smooth((t-.5)/.25);
   return ENVELOPE.normalStartPeakEgtC-(ENVELOPE.normalStartPeakEgtC-420)*smooth((t-.75)/.25);
 };
 const interpolate=(a,b,f)=>a+(b-a)*f;
 // Fuel-rate trainer: ~4000 kg/h per engine at sea-level takeoff power;
 // at ~35000 ft a ~75%-throttle/250 IAS cruise reference trends toward
 // ~1000 kg/h. Flight fuel is NOT simply determined by height: throttle
 // and IAS also influence the estimated flow. NOT calibrated CFM56-3 charts.
 function fuelFlowTarget({throttle=0,onGround=true,pressureAltitudeFt=0,iasKt=0}={}){
  if(!Number.isFinite(throttle)||throttle<0||throttle>1||
   !Number.isFinite(pressureAltitudeFt)||pressureAltitudeFt < -1000||
   !Number.isFinite(iasKt)||iasKt<0||iasKt>600||
   typeof onGround!=='boolean')throw Error('Invalid simulated flight fuel inputs');
  const idle=onGround?ENVELOPE.groundIdle:ENVELOPE.flightIdle;
  const seaLevelFlow=interpolate(idle.fuelFlowKgHr,ENVELOPE.fullThrust.fuelFlowKgHr,Math.pow(throttle,1.35));
  const normalizedAltitude=clamp(Math.max(0,pressureAltitudeFt)/35000,0,1);
  const altitudeFactor=1-.65*Math.pow(normalizedAltitude,.85);
  const speedFactor=1-.1*clamp(iasKt/300,0,1);
  return seaLevelFlow*altitudeFactor*speedFactor;
 }
 function runningTarget({throttle=0,onGround=true,pressureAltitudeFt=0,iasKt=0}={}){
  if(!Number.isFinite(throttle)||throttle<0||throttle>1)throw Error('Throttle must be in [0,1]');
  if(typeof onGround!=='boolean')throw Error('onGround must be boolean');
  const idle=onGround?ENVELOPE.groundIdle:ENVELOPE.flightIdle,top=ENVELOPE.fullThrust;
  return {n1Percent:interpolate(idle.n1Percent,top.n1Percent,Math.pow(throttle,1.12)),
   n2Percent:interpolate(idle.n2Percent,top.n2Percent,Math.pow(throttle,.86)),
   egtC:interpolate(idle.egtC,top.egtC,Math.pow(throttle,.95)),
   fuelFlowKgHr:fuelFlowTarget({throttle,onGround,pressureAltitudeFt,iasKt})};
 }
 function initialRunning(){return {n1Percent:15,n2Percent:46,egtC:420,fuelFlowKgHr:350};}
 function stepRunning(previous,{deltaMs,throttle=0,onGround=true,pressureAltitudeFt=0,iasKt=0}={}){
  if(!Number.isFinite(deltaMs)||deltaMs<0)throw Error('Nonnegative finite deltaMs required');
  if(!previous||['n1Percent','n2Percent','egtC','fuelFlowKgHr'].some(k=>!Number.isFinite(previous[k])))
   throw Error('Finite previous engine state required');
  const target=runningTarget({throttle,onGround,pressureAltitudeFt,iasKt}),tau=ENVELOPE.responseMs,next={};
  for(const [key,up,down] of [['n1Percent','n1Up','n1Down'],['n2Percent','n2Up','n2Down'],
   ['egtC','egtUp','egtDown'],['fuelFlowKgHr','fuelUp','fuelDown']]){
   const constant=target[key]>previous[key]?tau[up]:tau[down];
   const alpha=1-Math.exp(-deltaMs/constant);
   next[key]=interpolate(previous[key],target[key],alpha);
  }
  // An engine in RUNNING settles to (and remains at) ground/flight idle;
  // sub-idle spool-down is possible only outside the RUNNING state.
  next.n1Percent=clamp(next.n1Percent,0,ENVELOPE.fullThrust.n1Percent);
  next.n2Percent=clamp(next.n2Percent,0,ENVELOPE.fullThrust.n2Percent);
  next.egtC=clamp(next.egtC,0,ENVELOPE.fullThrust.egtC);
  return next;
 }

 function sample(phase,elapsedMs,faults={}){
  if(!Number.isFinite(elapsedMs)||elapsedMs<0)throw Error('Nonnegative elapsed time required');
  if(phase==='MOTORING'){
   const f=smooth(elapsedMs/duration.motoringMs);
   return {n2Percent:(faults.n2Stall?18:25)*f,egtC:null,fuelFlowKgHr:0,origin:ORIGIN};
  }
  if(phase==='LIGHT_OFF_SEQUENCE'){
   const f=smooth(elapsedMs/duration.lightoffMs);
   if(faults.noLightOff)return {n2Percent:25+(faultTargets.noLightOffN2-25)*f,
    egtC:0,fuelFlowKgHr:400,origin:ORIGIN};
   if(faults.hungStart)return {n2Percent:25+(faultTargets.hungStartN2-25)*f,
    egtC:faultTargets.hungStartEgtC*f,fuelFlowKgHr:400-50*f,origin:ORIGIN};
   // Fuel can be introduced before the recommended N2 cue. Poor airflow at
    // early light-off raises the simulated EGT peak; this is a conditional
    // risk curve, not a guaranteed hot start or source-certified CFM profile.
    const entryN2=clamp(Number.isFinite(faults.fuelEntryN2)?faults.fuelEntryN2:25,0,25);
    const earlyEgtRise=clamp((20-entryN2)/20,0,1)*150;
    return {n2Percent:entryN2+(46-entryN2)*f,
     egtC:faults.egtHigh?760*f:startEgt(elapsedMs/duration.lightoffMs)*(1+earlyEgtRise/ENVELOPE.normalStartPeakEgtC),
     fuelFlowKgHr:400-50*f,origin:ORIGIN};
  }
  throw Error('Unsupported training phase '+phase);
 }
 return Object.freeze({ORIGIN,duration,faultTargets,ENVELOPE,sample,runningTarget,fuelFlowTarget,initialRunning,stepRunning});
});
