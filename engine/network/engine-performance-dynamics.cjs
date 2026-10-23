'use strict';
/**
 * ISN-10 — deliberately bounded Performance/Dynamics adapter for
 * B737-33V EP-FSI MSN29340 / CFM56-3B-1 20K.
 *
 * NOT a CFM56 thermodynamic model. The merged private AFM v16 QA has zero independently
 * approved final N1 points, so there is no operational N1 interpolation.
 * Accepted time-series are external measured training telemetry and are
 * labelled unverified; interpolated only between supplied observations.
 */
const AIRCRAFT=Object.freeze({
 registration:'EP-FSI',msn:29340,type:'B737-33V',
 engine:'CFM56-3B-1',ratingLbf:20000
});
const AFM_GATE=Object.freeze({
 sourceId:'AFM-73733V-D6-8730.33V-R32-20180214',
 sourcePdfSha256:'3c7002212482f0c47a1735c2302ee304ef41ef4ca270591281b72f5f2a714105',
 qaVersion:16,approvedFinalN1Points:0,
 independentHumanQA:false,releaseGatesActive:0,
 numericN1Enabled:false,quality:'BLOCKED_SOURCE_CURVE_QA',
 blockedReasons:[
  'No independently signed complete 20K N1 curves',
  'MCT and PMC OFF branches / bleed corrections not fully validated',
  'Installed PMC option unverified',
  'No verified engine transient maps for N1 N2 EGT and fuel flow'
 ]
});
const CHANNELS=['n1Pct','n2Pct','egtC','fuelFlowKgHr'];
const BOUNDS={n1Pct:[0,120],n2Pct:[0,110],
 egtC:[-100,1300],fuelFlowKgHr:[0,20000]};
const id=x=>{const v=String(x);if(v!=='1'&&v!=='2')throw new TypeError('invalid engine');return v;};
const finite=(v,name,min,max)=>{
 if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)
   throw new TypeError('invalid '+name);
 return v;
};
const copy=x=>JSON.parse(JSON.stringify(x));
function initEnginePerformance(){
 const data=()=>({mode:'NO_TRACK',track:null,elapsedSec:0,
   commandedLeverPct:null,lastSample:null,coverage:'NONE',traceQuality:'NO_DATA'});
 return {schema:'b737cl-isn10-performance-v1',aircraft:copy(AIRCRAFT),
  engines:{'1':data(),'2':data()}};
}
function validateTrack(track){
 if(!track||typeof track!=='object'||Array.isArray(track))
   throw new TypeError('track object required');
 const a=track.aircraft;
 if(!a||a.msn!==AIRCRAFT.msn||a.registration!==AIRCRAFT.registration||
    a.engine!==AIRCRAFT.engine||a.ratingLbf!==AIRCRAFT.ratingLbf)
   throw new TypeError('track aircraft/engine/rating mismatch');
 if(!['OBSERVED_TELEMETRY','SYNTHETIC_TEST_FIXTURE'].includes(track.sourceType))
   throw new TypeError('source must be observed telemetry or explicit test fixture');
 if(track.sourceType==='SYNTHETIC_TEST_FIXTURE'&&track.allowSyntheticFixture!==true)
   throw new Error('synthetic trace playback requires explicit fixture opt-in');
 if(typeof track.sourceId!=='string'||track.sourceId.length<5||track.sourceId.length>200)
   throw new TypeError('sourceId required');
 if(!Array.isArray(track.samples)||track.samples.length<2||track.samples.length>500)
   throw new TypeError('2..500 observed samples required');
 let last=-Infinity;
 const samples=track.samples.map((s,i)=>{
   if(!s||typeof s!=='object')throw new TypeError('sample missing');
   finite(s.timeSec,'sample time',0,36000);
   if(i===0&&s.timeSec!==0)throw new TypeError('first time must be zero');
   if(s.timeSec<=last)throw new TypeError('times must increase');
   last=s.timeSec;
   const sample={timeSec:s.timeSec};
   for(const k of CHANNELS){
     if(!Object.prototype.hasOwnProperty.call(s,k))
       throw new TypeError('missing observed channel '+k);
     sample[k]=finite(s[k],k,...BOUNDS[k]);
   }
   return sample;
 });
 if(samples.at(-1).timeSec>36000)throw new TypeError('trace duration exceeds range');
 return Object.freeze({
  sourceId:track.sourceId,sourceType:track.sourceType,
  aircraft:copy(AIRCRAFT),samples,
  quality:track.sourceType==='OBSERVED_TELEMETRY'?
    'USER_SUPPLIED_UNVERIFIED_TELEMETRY':'SYNTHETIC_TEST_NOT_AIRCRAFT_PERFORMANCE',
  provenanceStatus:'UNVERIFIED_FOR_AFM_OR_CERTIFICATION'
 });
}
function sampleAt(trace,seconds){
 const rows=trace.samples;
 const t=finite(seconds,'elapsed time',0,36000);
 if(t>rows[rows.length-1].timeSec)return null;
 if(t===0)return {sample:copy(rows[0]),interval:[0,0],kind:'OBSERVED_POINT'};
 for(let i=1;i<rows.length;i++){
   const lo=rows[i-1],hi=rows[i];
   if(t===hi.timeSec)return {sample:copy(hi),interval:[i,i],kind:'OBSERVED_POINT'};
   if(t>lo.timeSec&&t<hi.timeSec){
     const factor=(t-lo.timeSec)/(hi.timeSec-lo.timeSec);
     const sample={timeSec:t};
     for(const k of CHANNELS)
       sample[k]=lo[k]+(hi[k]-lo[k])*factor;
     return {sample,interval:[i-1,i],kind:'INTERPOLATED_BETWEEN_SUPPLIED_SAMPLES'};
   }
 }
 return null;
}
function applySample(state,engine,reading){
 const e=state.propulsion.engines[engine],d=state.indications.engines[engine];
 e.n2Pct=reading.n2Pct;
 state.propulsion.safety.engines[engine].egtC=reading.egtC;
 d.channels.n1Pct.value=reading.n1Pct;
 d.channels.fuelFlowKgHr.value=reading.fuelFlowKgHr;
 if(e.startSwitch==='GRD'&&e.n2Pct>=46)e.startSwitch='OFF';
}
function applyPerformanceAction(state,action){
 const perf=state.performance;
 if(!perf||perf.schema!=='b737cl-isn10-performance-v1')
   throw new TypeError('performance state missing');
 const engine=id(action.engine),channel=perf.engines[engine];
 if(state.propulsion.mode!=='INTEGRATED')
   throw new Error('performance replay only in integrated mode');
 if(action.type==='SET_ENGINE_THRUST_COMMAND'){
   channel.commandedLeverPct=finite(action.value,'thrust lever %',0,100);
   return;
 }
 if(action.type==='LOAD_ENGINE_OBSERVED_TRACK'){
   const trace=validateTrack(action.track);
   channel.track=trace;channel.elapsedSec=0;channel.mode='REPLAY_ACTIVE';
   channel.traceQuality=trace.quality;channel.coverage='OBSERVED_POINT';
   const reading=sampleAt(trace,0);
   channel.lastSample=copy(reading);
   applySample(state,engine,reading.sample);
   return;
 }
 if(action.type==='STOP_ENGINE_OBSERVED_TRACK'){
   channel.mode='STOPPED';channel.coverage='REPLAY_STOPPED';
   channel.track=null;channel.traceQuality='LAST_OBSERVED_VALUES_RETAINED';
   return;
 }
 throw new TypeError('unknown performance action');
}
function advancePerformance(state,seconds){
 finite(seconds,'delta seconds',0,3600);
 const results=[];
 for(const engine of ['1','2']){
   const p=state.performance.engines[engine];
   if(p.mode==='REPLAY_ENDED'){
     results.push({engine,event:'REPLAY_EXHAUSTED',fuelBurnKg:null});continue;
   }
   if(p.mode!=='REPLAY_ACTIVE')continue;
   const target=p.elapsedSec+seconds;
   if(target>p.track.samples.at(-1).timeSec){
     // Stop at the last actually supplied point, never extrapolate.
     const t=p.track.samples.at(-1).timeSec;
     const last=sampleAt(p.track,t);
     p.elapsedSec=t;p.mode='REPLAY_ENDED';p.coverage='NO_EXTRAPOLATION_AT_END';
     const fuelBurnKg=null; // Remaining interval unobserved; do not extrapolate fuel used.
     p.lastSample=copy(last);applySample(state,engine,last.sample);
     results.push({engine,event:'REPLAY_ENDED',lastTimeSec:t,fuelBurnKg});
   }else{
     const next=sampleAt(p.track,target);
     const fuelBurnKg=integratedFuelKg(p.track,p.elapsedSec,target);
     p.elapsedSec=target;p.coverage=next.kind;p.lastSample=copy(next);
     applySample(state,engine,next.sample);
     results.push({engine,event:next.kind,timeSec:target,fuelBurnKg});
   }
 }
 return results;
}
function integratedFuelKg(track,fromSec,toSec){
 if(!track||toSec<=fromSec)return 0;
 const samples=track.samples;
 const points=[fromSec,...samples.map(x=>x.timeSec).filter(t=>t>fromSec&&t<toSec),toSec];
 let mass=0;
 for(let i=1;i<points.length;i++){
   const a=sampleAt(track,points[i-1]).sample.fuelFlowKgHr;
   const b=sampleAt(track,points[i]).sample.fuelFlowKgHr;
   mass+=(a+b)/2*(points[i]-points[i-1])/3600;
 }
 return mass;
}
function performanceAuthority(perf,engine){
 return ['REPLAY_ACTIVE','REPLAY_ENDED'].includes(perf?.engines[id(engine)]?.mode);
}
function getAFMTargetN1(request){
 if(!request||request.registration!==AIRCRAFT.registration||
    request.msn!==AIRCRAFT.msn||request.engine!==AIRCRAFT.engine||
    request.ratingLbf!==AIRCRAFT.ratingLbf)
   throw new TypeError('AFM effectivity mismatch');
 // NEVER accept client-supplied "verified:true" to bypass a build-time QA gate.
 const err=new Error('AFM N1 source chart QA incomplete, no approved 20K numeric N1');
 err.code='AFM_N1_QA_BLOCKED';err.source=AFM_GATE.sourceId;throw err;
}
function evaluatePerformance(state){
 if(!state||state.schema!=='b737cl-isn10-performance-v1')
   throw new TypeError('performance state required');
 const engines={};
 for(const engine of ['1','2']){
   const p=state.engines[engine];
   engines[engine]={
     mode:p.mode,commandedLeverPct:p.commandedLeverPct,
     commandedLeverEffect:'NO_VERIFIED_THRUST_TO_N1_MAP',
     elapsedSec:p.elapsedSec,coverage:p.coverage,
     traceQuality:p.traceQuality,
     observed:p.lastSample?.sample??null,
     segment:p.lastSample?.interval??null,
     sourceType:p.track?.sourceType??null,
     sourceId:p.track?.sourceId??null,
     afmComputedTargetN1:null,
     afmAuthority:'BLOCKED_QA',
     usesPredictiveEnginePhysics:false
   };
 }
 return {schema:state.schema,aircraft:copy(AIRCRAFT),
   afmN1:{available:false,value:null,unit:'N1 %',...AFM_GATE},
   engines,engineModelType:'OBSERVED_TRACE_REPLAY_NOT_ENGINE_PHYSICS'};
}
const PERFORMANCE_COMMANDS=new Set(['SET_ENGINE_THRUST_COMMAND',
 'LOAD_ENGINE_OBSERVED_TRACK','STOP_ENGINE_OBSERVED_TRACK']);
module.exports={AIRCRAFT,AFM_GATE,CHANNELS,initEnginePerformance,
 validateTrack,sampleAt,integratedFuelKg,applyPerformanceAction,advancePerformance,
 performanceAuthority,evaluatePerformance,getAFMTargetN1,PERFORMANCE_COMMANDS};
