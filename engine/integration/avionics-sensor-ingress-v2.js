/* B737 Classic independent ADC/GPS/VOR/DME simulator ingress, stage 2.
 * Explicitly opt-in for a named LOCAL simulator adapter; never assumes GPS
 * installation, never derives sensor values from cockpit gauges or route maps.
 * Commands: NONE.  All signals remain TRAINING/TELEMETRY, not certified flight.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737AvionicsSensorIngressV2=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const KINDS=Object.freeze(['adc1','adc2','gps1','gps2','vor1','vor2','dme1','dme2']);
 const OWNER=Object.freeze({adc:'ADC',gps:'GPS',vor:'VHF_NAV',dme:'DME'});
 const TOPIC=Object.freeze(Object.fromEntries(KINDS.map(k=>[k,k.startsWith('adc')?'airdata.'+k:'navigation.'+k])));
 const copy=v=>JSON.parse(JSON.stringify(v));
 const finite=(v,min,max)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
 const obj=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 function field(value,k,lo,hi,required=false){
  const v=value[k];
  if(v==null){if(required)throw Error('MISSING_'+k.toUpperCase());return null;}
  if(!finite(v,lo,hi))throw Error('INVALID_'+k.toUpperCase());
  return v;
 }
 function parse(kind,data){
  if(!obj(data)||typeof data.valid!=='boolean')throw Error('SENSOR_VALIDITY_REQUIRED_'+kind);
  if(data.valid===false){
   if(Object.keys(data).some(k=>k!=='valid'&&k!=='failureCode'))throw Error('INVALID_SENSOR_MUST_NOT_CARRY_MEASUREMENTS');
   return {quality:'INVALID',value:null,reason:String(data.failureCode||'SENSOR_REPORTED_INVALID').slice(0,80)};
  }
  if(kind.startsWith('adc')){
   const pressureAltitudeFt=field(data,'pressureAltitudeFt',-2000,70000);
   const casKt=field(data,'casKt',0,600),tasKt=field(data,'tasKt',0,850);
   const mach=field(data,'mach',0,1.5),tatC=field(data,'tatC',-100,100),satC=field(data,'satC',-100,80);
   if([pressureAltitudeFt,casKt,tasKt,mach].every(x=>x===null))throw Error('ADC_REQUIRES_AT_LEAST_ONE_AIR_DATA_MEASUREMENT');
   return {quality:'VALID',value:{sensorValid:true,pressureAltitudeFt,casKt,tasKt,mach,tatC,satC,
    source:'SIMULATOR_ADC_CHANNEL_'+kind.slice(-1)}};
  }
  if(kind.startsWith('gps')){
   if(data.fixValid!==true)throw Error('GPS_VALID_SIGNAL_REQUIRES_FIX');
   const lat=field(data,'lat',-90,90,true),lon=field(data,'lon',-180,180,true);
   return {quality:'VALID',value:{fixValid:true,lat,lon,gsKt:field(data,'gsKt',0,850),
    trackDeg:field(data,'trackDeg',0,360),source:'SIMULATOR_GPS_CHANNEL_'+kind.slice(-1)}};
  }
  if(kind.startsWith('vor')){
   const stationIdent=String(data.stationIdent||'').toUpperCase();
   if(!/^[A-Z0-9]{2,5}$/.test(stationIdent))throw Error('VOR_STATION_IDENT_REQUIRED');
   return {quality:'VALID',value:{stationIdent,bearingDeg:field(data,'bearingDeg',0,360,true),
    stationLat:field(data,'stationLat',-90,90),stationLon:field(data,'stationLon',-180,180),
    tunedFrequencyMHz:field(data,'tunedFrequencyMHz',108,117.95),
    source:'SIMULATOR_VOR_CHANNEL_'+kind.slice(-1)}};
  }
  if(kind.startsWith('dme')){
   const stationIdent=String(data.stationIdent||'').toUpperCase();
   if(!/^[A-Z0-9]{2,5}$/.test(stationIdent))throw Error('DME_STATION_IDENT_REQUIRED');
   return {quality:'VALID',value:{stationIdent,distanceNm:field(data,'distanceNm',0,500,true),
    stationLat:field(data,'stationLat',-90,90),stationLon:field(data,'stationLon',-180,180),
    tunedFrequencyMHz:field(data,'tunedFrequencyMHz',108,117.95),
    source:'SIMULATOR_DME_CHANNEL_'+kind.slice(-1),
    measurement:'SLANT_RANGE_NM_NO_GEOMETRIC_FIX'}};
  }
  throw Error('UNKNOWN_SENSOR_KIND');
 }
 function create({getPublisher,now=()=>Date.now()}={}){
  if(typeof getPublisher!=='function')throw Error('SENSOR_BUS_PUBLISHER_REGISTRY_REQUIRED');
  let config=null,lastSequence=-1,lastFrameTime=null,accepted=0,rejected=0;
  const active=new Set(),lastRejected=[];
  function configure({sourceId,equipment}={}){
   if(config!==null)throw Error('SOURCE_ALREADY_CONFIGURED');
   if(typeof sourceId!=='string'||!(/^[A-Z][A-Z0-9_-]{2,63}$/).test(sourceId))
    throw Error('EXPLICIT_SIMULATOR_SOURCE_ID_REQUIRED');
   if(!obj(equipment)||Object.keys(equipment).some(k=>!['adc','gps','vor','dme'].includes(k)))
    throw Error('EQUIPMENT_MANIFEST_REQUIRED');
   const channels=[];
   for(const type of ['adc','gps','vor','dme']){
    if(!Array.isArray(equipment[type])||equipment[type].some(n=>![1,2].includes(n))||new Set(equipment[type]).size!==equipment[type].length)
     throw Error('EQUIPMENT_CHANNELS_REQUIRED_'+type);
    for(const n of equipment[type])channels.push(type+n);
   }
   if(channels.length===0)throw Error('NO_INSTALLED_SENSORS_DECLARED');
   config=Object.freeze({sourceId,equipment:copy(equipment),channels:Object.freeze(channels)});
   for(const kind of channels)active.add(kind);
   return diagnostics();
  }
  function ingest(frame){
   if(!config)throw Error('SENSOR_SOURCE_NOT_CONFIGURED');
   const failure=reason=>{rejected++;lastRejected.push(reason);if(lastRejected.length>24)lastRejected.shift();throw Error(reason);};
   if(!obj(frame)||frame.schema!=='B737_SENSOR_FRAME_V2'||frame.sourceId!==config.sourceId)failure('SENSOR_FRAME_SOURCE_MISMATCH');
   if(!Number.isSafeInteger(frame.sequence)||frame.sequence<=lastSequence||frame.sequence<0)failure('SENSOR_REPLAY_OR_OUT_OF_ORDER');
   const time=now();
   if(!Number.isFinite(time)||!finite(frame.sourceTimestampMs,0,1e15)||
      time-frame.sourceTimestampMs>2500||frame.sourceTimestampMs-time>500)failure('SENSOR_FRAME_STALE_OR_FUTURE');
   if(!obj(frame.sensors)||Object.keys(frame.sensors).length===0)failure('SENSOR_FRAME_EMPTY');
   const staged=[];
   try{
    for(const [kind,measurement] of Object.entries(frame.sensors)){
     if(!active.has(kind))throw Error('UNINSTALLED_OR_UNAUTHORIZED_SENSOR_'+kind);
     staged.push({kind,...parse(kind,measurement)});
    }
   }catch(e){failure(e.message||String(e))}
   // Atomic validation: no sensor changes or sequence advances on bad packets.
   for(const s of staged){
    const owner=OWNER[s.kind.replace(/[12]$/,'')],topic=TOPIC[s.kind];
    getPublisher(owner).publish(topic,s.value,{quality:s.quality,origin:'SIMULATOR_TELEMETRY',reason:s.reason??null});
   }
   lastSequence=frame.sequence;lastFrameTime=frame.sourceTimestampMs;accepted++;
   return {schema:'B737_SENSOR_INGRESS_RESULT_V2',accepted:true,sourceId:config.sourceId,
    sequence:frame.sequence,channels:staged.map(s=>s.kind),invalid:staged.filter(s=>s.quality==='INVALID').map(s=>s.kind)};
  }
  function diagnostics(){return {configured:config!==null,sourceId:config?.sourceId||null,
   equipment:config?copy(config.equipment):null,channels:[...active],lastSequence,lastFrameTime,
   accepted,rejected,lastRejected:[...lastRejected],authority:'SIMULATOR_TELEMETRY_ONLY_NO_FLIGHT_CONTROL'};}
  return Object.freeze({configure,ingest,diagnostics,TOPIC});
 }
 return Object.freeze({KINDS,OWNER,TOPIC,parse,create});
});
