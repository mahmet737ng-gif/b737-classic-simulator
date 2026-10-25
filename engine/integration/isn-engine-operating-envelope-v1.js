/* B737 Classic training-only continuous engine operating envelope.
 * User-tunable estimates, not AFM/FCOM performance tables or aircraft limits.
 * Independent of DOM/CDU/gauges. Running status is supplied by ISN source owner;
 * throttle demand cannot start an engine or override external observations.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNEngineOperatingEnvelopeV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const ORIGIN='TRAINING_ENVELOPE_SIMULATED';
 const SCHEMA='b737-engine-operating-envelope/1';
 const LIMITS=Object.freeze({
  groundIdleN1:22, groundIdleN2:60, groundIdleEgtC:450,
  flightIdleN1:32, flightIdleN2:78, flightIdleEgtC:480,
  maxN1:97, maxN2:101, maxSteadyEgtC:850,
  normalStartPeakEgtC:600, startPeakAfterCutoutMs:1600,
  startTransientDurationMs:3900,
  idleFuelFlowKgHr:330, maxFuelFlowKgHr:3000,
  n1AccelerationTauMs:2500, n1DecelerationTauMs:3900,
  n2AccelerationTauMs:3100, n2DecelerationTauMs:4600,
  egtRiseTauMs:650, egtFallTauMs:1800,
  shutdownN1TauMs:5500, shutdownN2TauMs:7500,
  shutdownEgtTauMs:11000, shutdownEgtAmbientC:35
 });
 const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const round=x=>Math.round(x*1000)/1000;
 function demand(throttle,onGround){
  if(!finite(throttle)||throttle<0||throttle>1)throw Error('Throttle demand must be within 0..1');
  if(typeof onGround!=='boolean')throw Error('Explicit onGround boolean required');
  const n1Idle=onGround?LIMITS.groundIdleN1:LIMITS.flightIdleN1;
  const n2Idle=onGround?LIMITS.groundIdleN2:LIMITS.flightIdleN2;
  const egtIdle=onGround?LIMITS.groundIdleEgtC:LIMITS.flightIdleEgtC;
  const load=Math.pow(throttle,0.87);
  return {n1Percent:n1Idle+(LIMITS.maxN1-n1Idle)*load,
    n2Percent:n2Idle+(LIMITS.maxN2-n2Idle)*Math.pow(throttle,0.77),
    egtC:egtIdle+(LIMITS.maxSteadyEgtC-egtIdle)*Math.pow(throttle,0.92),
    fuelFlowKgHr:LIMITS.idleFuelFlowKgHr+(LIMITS.maxFuelFlowKgHr-LIMITS.idleFuelFlowKgHr)*load,
    idle:{n1Percent:n1Idle,n2Percent:n2Idle,egtC:egtIdle}};
 }
 function initial({n1Percent=12,n2Percent=46,egtC=420,phase='RUNNING',elapsedMs=0}={}){
  for(const v of [n1Percent,n2Percent,egtC,elapsedMs])if(!finite(v))throw Error('Finite initial engine state required');
  if(n1Percent<0||n2Percent<0||elapsedMs<0||!['RUNNING','STOPPING'].includes(phase))
   throw Error('Invalid initial engine envelope');
  return {schema:SCHEMA,origin:ORIGIN,phase,elapsedMs,
   n1Percent,n2Percent,egtC,fuelFlowKgHr:phase==='RUNNING'?LIMITS.idleFuelFlowKgHr:0,
   startElapsedMs:phase==='RUNNING'?0:null,egtStartPeakObservedC:egtC,
   lastThrottleDemand:0,lastOnGround:true};
 }
 function approach(current,target,ms,tau){
  return target+(current-target)*Math.exp(-ms/tau);
 }
 function advance(previous,{running,onGround=true,throttle=0,faults={}}={},dtMs){
  if(!previous||previous.schema!==SCHEMA)throw Error('Envelope state required');
  if(!finite(dtMs)||dtMs<0||dtMs>120000)throw Error('Elapsed milliseconds must be 0..120000');
  if(typeof running!=='boolean')throw Error('Explicit running source required');
  if(faults===null||typeof faults!=='object')throw Error('Faults must be an object');
  const target=demand(throttle,onGround);
  const next={...previous,phase:running?'RUNNING':'STOPPING',lastThrottleDemand:throttle,lastOnGround:onGround};
  if(previous.phase==='STOPPING'&&running)next.startElapsedMs=0;
  if(previous.phase==='RUNNING'&&!running)next.startElapsedMs=null;
  // Small bounded substeps allow a start EGT transient without large clock jumps
  // missing its peak. No real-time timers: same inputs/clock reproduce outputs.
  let remaining=dtMs;
  while(remaining>0){
   const h=Math.min(remaining,50);
   remaining-=h;
   next.elapsedMs+=h;
   if(running){
    next.startElapsedMs=next.startElapsedMs===null?0:next.startElapsedMs+h;
    const transientElapsed=next.startElapsedMs;
    const peakPhase=Math.min(1,transientElapsed/LIMITS.startTransientDurationMs);
    // Bounded short heat bump: peaks about 600C then settles to idle EGT.
    const bump=Math.pow(Math.sin(Math.PI*peakPhase),2)*190;
    const egtTarget=clamp(target.egtC+bump,0, Math.max(LIMITS.maxSteadyEgtC,LIMITS.normalStartPeakEgtC));
    const tauN1=target.n1Percent>=next.n1Percent?LIMITS.n1AccelerationTauMs:LIMITS.n1DecelerationTauMs;
    const tauN2=target.n2Percent>=next.n2Percent?LIMITS.n2AccelerationTauMs:LIMITS.n2DecelerationTauMs;
    next.n1Percent=approach(next.n1Percent,target.n1Percent,h,tauN1);
    next.n2Percent=approach(next.n2Percent,target.n2Percent,h,tauN2);
    next.egtC=approach(next.egtC,egtTarget,h,
      egtTarget>=next.egtC?LIMITS.egtRiseTauMs:LIMITS.egtFallTauMs);
    // IDLE floors apply only after the engine has spooled up to idle.
    // During early stabilization it is legitimate to be below idle.
    next.fuelFlowKgHr=approach(next.fuelFlowKgHr,target.fuelFlowKgHr,h,2200);
    next.egtStartPeakObservedC=Math.max(next.egtStartPeakObservedC,next.egtC);
   }else{
    next.n1Percent=approach(next.n1Percent,0,h,LIMITS.shutdownN1TauMs);
    next.n2Percent=approach(next.n2Percent,0,h,LIMITS.shutdownN2TauMs);
    next.egtC=approach(next.egtC,LIMITS.shutdownEgtAmbientC,h,LIMITS.shutdownEgtTauMs);
    next.fuelFlowKgHr=0;
   }
  }
  // Preserve physical startup spool below idle until acceleration reaches target,
  // without ever commanding a running low-idle below the selected idle floor.
  next.n1Percent=clamp(next.n1Percent,0,LIMITS.maxN1);
  next.n2Percent=clamp(next.n2Percent,0,LIMITS.maxN2);
  if(running&&!faults.egtHigh)next.egtC=clamp(next.egtC,0,LIMITS.maxSteadyEgtC);
  if(faults.egtHigh&&running)next.egtC=Math.max(next.egtC,750);
  for(const key of ['n1Percent','n2Percent','egtC','fuelFlowKgHr','egtStartPeakObservedC'])
   next[key]=round(next[key]);
  return next;
 }
 return Object.freeze({SCHEMA,ORIGIN,LIMITS,initial,demand,advance});
});
