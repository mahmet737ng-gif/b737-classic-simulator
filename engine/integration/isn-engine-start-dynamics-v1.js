/* Continuous *training* interpolation between ISN-03 discrete checkpoints.
 * This is not a physical engine performance model or an external sensor.
 * The source-backed 25% fuel cue and approximate 46% starter cutout remain
 * enforced by the independent ISN start-sequence rules engine.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNEngineStartDynamicsV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const ORIGIN='TRAINING_SEQUENCE_SIMULATED';
 const duration=Object.freeze({motoringMs:850,lightoffMs:1000});
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const smooth=x=>{const t=clamp(x,0,1);return t*t*(3-2*t);};
 function sample(phase,elapsedMs){
  if(!Number.isFinite(elapsedMs)||elapsedMs<0)throw Error('Nonnegative elapsed time required');
  if(phase==='MOTORING'){
   const f=smooth(elapsedMs/duration.motoringMs);
   return {n2Percent:25*f,egtC:null,fuelFlowKgHr:0,origin:ORIGIN};
  }
  if(phase==='LIGHT_OFF_SEQUENCE'){
   const f=smooth(elapsedMs/duration.lightoffMs);
   return {n2Percent:25+21*f,egtC:420*f,fuelFlowKgHr:400-50*f,origin:ORIGIN};
  }
  throw Error('Unsupported training phase '+phase);
 }
 return Object.freeze({ORIGIN,duration,sample});
});
