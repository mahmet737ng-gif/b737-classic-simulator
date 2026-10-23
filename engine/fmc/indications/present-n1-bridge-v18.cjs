(function(root,factory){'use strict';
const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.EPFSI_PRESENT_N1_V18=api;
})(typeof window!=='undefined'?window:null,function(){'use strict';
/* Present N1 (not N1 LIMIT) is an observed engine value, never an AFM lookup.
 * No fake engine physics. Values are accepted only from explicit authoritative
 * external/core packets or conspicuously labeled instructor TEST packets.
 * This adapter does not implement transport, engine dynamics, or A/T.
 */
const PROFILE=Object.freeze({registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000});
const SOURCES=Object.freeze(['ENGINE_CORE','EXTERNAL_SIM','INSTRUCTOR_TEST']);
const DEFAULT_MAX_AGE_MS=2500;
function createStore({maxAgeMs=DEFAULT_MAX_AGE_MS}={}){
 if(!Number.isFinite(maxAgeMs)||maxAgeMs<=0)throw Error('INVALID_MAX_AGE');
 let selected='ENGINE_CORE',seq={1:-1,2:-1},samples={1:null,2:null};
 function selectSource(source){
  if(!SOURCES.includes(source))throw Error('INVALID_TELEMETRY_SOURCE');
  // Fail closed; NEVER leak values across source changes.
  selected=source;seq={1:-1,2:-1};samples={1:null,2:null};
  return selected;
 }
 function ingest(packet,receivedAtMs){
  if(!packet||packet.source!==selected||!SOURCES.includes(packet.source))return {accepted:false,reason:'SOURCE_NOT_SELECTED'};
  if(packet.registration!==PROFILE.registration||packet.serial!==PROFILE.serial)return {accepted:false,reason:'AIRFRAME_MISMATCH'};
  const engineId=packet.engineId;
  if(engineId!==1&&engineId!==2)return {accepted:false,reason:'ENGINE_ID_INVALID'};
  if(!Number.isFinite(packet.n1Pct)||packet.n1Pct<0||packet.n1Pct>106)return {accepted:false,reason:'N1_MEASUREMENT_INVALID'};
  if(!Number.isSafeInteger(packet.seq)||packet.seq<0||packet.seq<=seq[engineId])return {accepted:false,reason:'SEQUENCE_OLD_OR_INVALID'};
  if(!Number.isFinite(receivedAtMs)||receivedAtMs<0)return {accepted:false,reason:'RECEIVE_TIMESTAMP_INVALID'};
  // Never silently transform missing measurements, engineRunning, N2 or thrust lever to N1.
  seq[engineId]=packet.seq;
  samples[engineId]=Object.freeze({engineId,n1Pct:packet.n1Pct,receivedAtMs,seq:packet.seq,source:packet.source});
  return {accepted:true,engineId,seq:packet.seq};
 }
 function reading(engineId,nowMs){
  if(engineId!==1&&engineId!==2)throw Error('INVALID_ENGINE_ID');
  if(!Number.isFinite(nowMs)||nowMs<0)throw Error('INVALID_SNAPSHOT_TIME');
  const packet=samples[engineId];
  if(!packet)return {engineId,status:'NO_DATA',n1Pct:null,display:'---.-',source:selected,isTest:selected==='INSTRUCTOR_TEST',ageMs:null};
  const ageMs=nowMs-packet.receivedAtMs;
  if(ageMs<0||ageMs>maxAgeMs)return {engineId,status:'STALE',n1Pct:null,display:'---.-',source:selected,isTest:selected==='INSTRUCTOR_TEST',ageMs};
  return {engineId,status:selected==='INSTRUCTOR_TEST'?'TEST_ONLY':'LIVE_OBSERVATION',
    n1Pct:packet.n1Pct,display:packet.n1Pct.toFixed(1),source:selected,
    isTest:selected==='INSTRUCTOR_TEST',ageMs,seq:packet.seq};
 }
 function snapshot(nowMs){
  const left=reading(1,nowMs),right=reading(2,nowMs);
  return {source:selected,sourceLabel:selected==='INSTRUCTOR_TEST'?'TEST':selected==='EXTERNAL_SIM'?'EXT':'ENGINE',
    engine1:left,engine2:right,hasActualLiveN1:(left.status==='LIVE_OBSERVATION'||right.status==='LIVE_OBSERVATION'),
    forAutothrottle:false,performanceCalculated:false};
 }
 function reset(){return selectSource(selected);}
 return Object.freeze({selectSource,ingest,reading,snapshot,reset,getSource:()=>selected});
}
return Object.freeze({PROFILE,SOURCES,DEFAULT_MAX_AGE_MS,createStore});
});