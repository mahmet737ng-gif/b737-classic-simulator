/* Unified B737 Classic avionics data network v1 — independent source ownership.
 * Signal exchange / evidence only. Not certified ARINC wiring; never commands actuators.
 * One producer per topic, many read-only consumers, monotonic revisions, TTL and trace.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737AvionicsDataNetworkV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const CATALOG=Object.freeze({
  'electrical.buses':{owner:'ELECTRICAL',ttl:1500},
  'electrical.fmcFeeds':{owner:'FMC_FEEDS',ttl:1500},
  'irs.left':{owner:'IRS',ttl:2000},'irs.right':{owner:'IRS',ttl:2000},
  'airdata.adc1':{owner:'ADC',ttl:2000},'airdata.adc2':{owner:'ADC',ttl:2000},
  'navigation.gps1':{owner:'GPS',ttl:3000},'navigation.gps2':{owner:'GPS',ttl:3000},
  'navigation.vor1':{owner:'VHF_NAV',ttl:4000},'navigation.vor2':{owner:'VHF_NAV',ttl:4000},
  'navigation.dme1':{owner:'DME',ttl:4000},'navigation.dme2':{owner:'DME',ttl:4000},
  'fuel.quantity':{owner:'FUEL',ttl:3000},'fuel.pumps':{owner:'FUEL',ttl:2000},
  'flightcontext.state':{owner:'FLIGHT_CONTEXT',ttl:2000},
  'apu.state':{owner:'APU',ttl:2000},
  'hydraulics.state':{owner:'HYDRAULICS',ttl:3000},
  'propulsion.engine1':{owner:'ENGINE',ttl:2000},'propulsion.engine2':{owner:'ENGINE',ttl:2000},
  'pneumatics.state':{owner:'PNEUMATICS',ttl:3000},
  'antiice.state':{owner:'ANTIICE',ttl:3000},
  'aircraft.airground':{owner:'AIRGROUND',ttl:2000},
  'environment.tat':{owner:'TAT',ttl:3000},
  'clock.utc':{owner:'CLOCK',ttl:2500},
  'crew.flightplan':{owner:'CDU',ttl:60000},
  'aircraft.profile':{owner:'PROFILE',ttl:60000},
  'mcp.state':{owner:'MCP',ttl:2000},
  'afds.state':{owner:'AFDS',ttl:2000},
  'autothrottle.state':{owner:'AUTOTHROTTLE',ttl:2000},
  'navigation.database':{owner:'NAVDB',ttl:86400000},
  'performance.database':{owner:'PERFDB',ttl:86400000},
  'datalink.acars':{owner:'ACARS',ttl:60000},
  'cb.observations':{owner:'CB',ttl:3000},
  'fmc.computed':{owner:'FMC',ttl:2000}
 });
 const QUALITIES=Object.freeze(['VALID','UNKNOWN','INVALID']);
 const ORIGINS=Object.freeze(['LIVE_SYSTEM','SIMULATOR_TELEMETRY','TRAINING_SCENARIO','CREW_ENTRY','REFERENCE_DATABASE','UNVERIFIED']);
 const copy=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
 const isObject=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
 const number=(x,min,max)=>typeof x==='number'&&Number.isFinite(x)&&x>=min&&x<=max;
 function validate(topic,value){
  if(!isObject(value))throw Error('SIGNAL_PAYLOAD_MUST_BE_OBJECT_'+topic);
  const n=(key,lo,hi)=>{if(value[key]!==undefined&&value[key]!==null&&!number(value[key],lo,hi))throw Error('SIGNAL_RANGE_'+topic+'.'+key)};
  if(/^airdata\.adc/.test(topic)){n('pressureAltitudeFt',-2000,70000);n('casKt',0,600);n('tasKt',0,850);n('mach',0,1.5);n('tatC',-100,100);n('satC',-100,80);}
  if(/^navigation\.gps|^irs\./.test(topic)){n('lat',-90,90);n('lon',-180,180);n('gsKt',0,850);n('trackDeg',0,360);}
  if(/^navigation\.dme/.test(topic))n('distanceNm',0,500);
  if(/^navigation\.vor/.test(topic))n('bearingDeg',0,360);
  if(topic==='fuel.quantity'){n('totalKg',0,50000);n('totalLb',0,110000);}
  if(/^propulsion\.engine/.test(topic)){n('n1Percent',0,125);n('n2Percent',0,125);n('egtC',-100,1200);n('fuelFlowKgHr',0,10000);}
  if(topic==='environment.tat')n('tatC',-100,100);
 }
 function createNetwork({now=()=>Date.now(),onError=null}={}){
  const state=new Map(),owners=new Set(),listeners=new Map(),trace=[],errors=[];
  let revision=0;
  function error(item){errors.push(item);if(errors.length>32)errors.shift();if(typeof onError==='function')onError(item);}
  function read(topic){
   if(!Object.hasOwn(CATALOG,topic))throw Error('UNKNOWN_TOPIC_'+topic);
   const stored=state.get(topic);
   if(!stored)return {topic,owner:CATALOG[topic].owner,quality:'UNKNOWN',origin:'UNVERIFIED',value:null,revision:0,receivedAtMs:null,reason:'NO_SOURCE_CONNECTED'};
   const next=copy(stored),ttl=CATALOG[topic].ttl;delete next.fingerprint;
   if(next.quality==='VALID'&&now()-next.receivedAtMs>ttl){next.quality='STALE';next.reason='TIME_TO_LIVE_EXCEEDED';}
   return next;
  }
  function producer(owner){
   if(!/^[A-Z][A-Z_0-9]{1,32}$/.test(owner))throw Error('INVALID_OWNER');
   if(owners.has(owner))throw Error('DUPLICATE_OWNER_'+owner);
   const topics=Object.keys(CATALOG).filter(k=>CATALOG[k].owner===owner);
   if(!topics.length)throw Error('UNREGISTERED_OWNER_'+owner);
   owners.add(owner);
   return Object.freeze({owner,topics:[...topics],publish(topic,value,{quality='VALID',origin='LIVE_SYSTEM',reason=null}={}){
    if(!topics.includes(topic))throw Error('TOPIC_NOT_OWNED_'+owner+':'+topic);
    if(!QUALITIES.includes(quality)||!ORIGINS.includes(origin))throw Error('INVALID_SIGNAL_METADATA');
    if(quality==='VALID'&&origin==='UNVERIFIED')throw Error('UNVERIFIED_CANNOT_BE_VALID');
    if(quality==='VALID')validate(topic,value);
    else if(value!==null&&value!==undefined)validate(topic,value);
    const old=state.get(topic),payload=quality==='VALID'?copy(value):copy(value??null);
    const fingerprint=JSON.stringify([quality,origin,payload,reason]);
    const stamp=now();
    if(!Number.isFinite(stamp)||stamp<0)throw Error('INVALID_CLOCK');
    if(old&&old.fingerprint===fingerprint){
     old.receivedAtMs=stamp;
     return read(topic);
    }
    revision++;
    const next={topic,owner,quality,origin,value:payload,revision,receivedAtMs:stamp,reason,fingerprint};
    state.set(topic,next);
    const record=read(topic);delete record.fingerprint;
    trace.push({topic,owner,quality,revision,receivedAtMs:stamp});
    if(trace.length>256)trace.shift();
    for(const key of [topic,'*'])for(const listener of [...(listeners.get(key)||[])])try{listener(copy(record));}catch(e){error({topic,consumerError:String(e?.message||e),revision});}
    return record;
   }});
  }
  function subscribe(topic,fn,{replay=true}={}){
   if(topic!=='*'&&!Object.hasOwn(CATALOG,topic))throw Error('UNKNOWN_TOPIC_'+topic);
   if(typeof fn!=='function')throw Error('SUBSCRIBER_REQUIRED');
   if(!listeners.has(topic))listeners.set(topic,new Set());
   listeners.get(topic).add(fn);
   if(replay){const snapshot=topic==='*'?Object.keys(CATALOG).map(read):[read(topic)];
    for(const item of snapshot)try{fn(copy(item));}catch(e){error({topic,consumerError:String(e?.message||e),revision});}}
   return ()=>listeners.get(topic)?.delete(fn);
  }
  function snapshot(){return Object.fromEntries(Object.keys(CATALOG).map(topic=>[topic,read(topic)]));}
  function audit(){const signals=Object.values(snapshot());return {schema:'B737_AVIONICS_NETWORK_V1',revision,totalTopics:signals.length,valid:signals.filter(x=>x.quality==='VALID').length,stale:signals.filter(x=>x.quality==='STALE').length,unavailable:signals.filter(x=>x.quality==='UNKNOWN').map(x=>x.topic),invalid:signals.filter(x=>x.quality==='INVALID').map(x=>x.topic),owners:[...owners],errors:copy(errors),trace:copy(trace)};}
  return Object.freeze({producer,read,subscribe,snapshot,audit,topics:()=>Object.keys(CATALOG),getRevision:()=>revision});
 }
 return Object.freeze({CATALOG,QUALITIES,ORIGINS,createNetwork});
});
