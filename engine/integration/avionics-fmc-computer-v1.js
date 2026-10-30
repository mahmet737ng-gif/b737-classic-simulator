/* FMC consumer/projection for the independent avionics topic network.
 * FCOM 11.20/11.30–32 evidence model. Does NOT move aircraft or fabricate radio fixes.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737AvionicsFmcComputerV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const INPUTS=Object.freeze(['electrical.buses','electrical.fmcFeeds','irs.left','irs.right','airdata.adc1','airdata.adc2',
  'navigation.gps1','navigation.gps2','navigation.vor1','navigation.vor2','navigation.dme1','navigation.dme2',
  'fuel.quantity','propulsion.engine1','propulsion.engine2','pneumatics.state','antiice.state',
  'aircraft.airground','environment.tat','clock.utc','crew.flightplan','aircraft.profile',
  'mcp.state','afds.state','autothrottle.state','navigation.database','performance.database','datalink.acars','cb.observations']);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const valid=x=>x?.quality==='VALID';
 const coord=v=>v&&Number.isFinite(v.lat)&&v.lat>=-90&&v.lat<=90&&Number.isFinite(v.lon)&&v.lon>=-180&&v.lon<=180;
 function project(network){
  const read=t=>network.read(t),inputs=Object.fromEntries(INPUTS.map(t=>[t,read(t)]));
  const issues=[],data={};
  const pick=(arr)=>{
   const found=arr.map(t=>inputs[t]).find(x=>valid(x));
   return found||null;
  };
  const gps=pick(['navigation.gps1','navigation.gps2']);
  const irs=pick(['irs.left','irs.right']);
  const adc=pick(['airdata.adc1','airdata.adc2']);
  const fuel=inputs['fuel.quantity'],plan=inputs['crew.flightplan'],feeds=inputs['electrical.fmcFeeds'];
  const radioCandidates=['navigation.dme1','navigation.dme2','navigation.vor1','navigation.vor2'].filter(t=>valid(inputs[t]));
  const gpsFix=gps&&coord(gps.value)&&gps.value.fixValid===true;
  const irsFix=irs&&coord(irs.value)&&irs.value.positionValid===true;
  const fix=gpsFix?gps:irsFix?irs:null;
  data.position=fix?{latitudeDeg:fix.value.lat,longitudeDeg:fix.value.lon,source:fix.topic,
    origin:fix.origin,quality:'VALID',method:gpsFix?'GPS_UPDATE':'IRS_REFERENCE'}:
    {latitudeDeg:null,longitudeDeg:null,source:null,quality:'UNKNOWN',method:'NO_VALID_POSITION'};
  data.radioUpdate={availableCandidates:radioCandidates,fixComputed:false,
    reason:'RADIO_FIX_REQUIRES_VALIDATED_NAVAID_GEOMETRY_AND_TUNING'};
  if(!fix)issues.push('POSITION_SOURCE_MISSING');
  data.airData=adc?{source:adc.topic,pressureAltitudeFt:adc.value.pressureAltitudeFt??null,
    casKt:adc.value.casKt??null,tasKt:adc.value.tasKt??null,mach:adc.value.mach??null,origin:adc.origin}:
    {source:null,quality:'UNKNOWN'};
  if(!adc)issues.push('ADC_SIGNAL_MISSING');
  data.fuel=valid(fuel)?{totalKg:fuel.value.totalKg??null,totalLb:fuel.value.totalLb??null,
    source:fuel.topic,origin:fuel.origin}: {totalKg:null,totalLb:null,source:null,quality:'UNKNOWN'};
  if(!valid(fuel))issues.push('FUEL_SUMMATION_MISSING');
  const fmcFeed=valid(feeds)?feeds.value:null;
  const primary=fmcFeed?.FMC1?.feed??'UNKNOWN',secondary=fmcFeed?.FMC2?.feed??'UNKNOWN';
  data.fmcFeeds={FMC1:primary,FMC2:secondary,provenance:feeds?.origin||'UNVERIFIED'};
  const powerReady=[primary,secondary].includes('PRESENT');
  if(!powerReady)issues.push('FMC_EQUIPMENT_FEED_NOT_PROVEN_PRESENT');
  const route=valid(plan)?plan.value:{};
  const active=route?.active===true&&/^[A-Z]{4}$/.test(route.origin||'')&&
   /^[A-Z]{4}$/.test(route.dest||'')&&route.origin!==route.dest;
  data.route={origin:route?.origin||'',dest:route?.dest||'',active,legsVerified:route?.legsVerified===true,
   discontinuitiesUnknown:route?.discontinuitiesUnknown!==false,source:valid(plan)?plan.origin:'UNVERIFIED'};
  if(!active||!data.route.legsVerified||data.route.discontinuitiesUnknown)issues.push('ROUTE_LEGS_NOT_AUDITED');
  const mcp=inputs['mcp.state'];data.mcp=valid(mcp)?{altitudeFt:mcp.value.altitudeFt??null,
    selectedSpeedKt:mcp.value.selectedSpeedKt??null,source:mcp.origin}:{quality:'UNKNOWN'};
  data.autoflight={mcp:valid(mcp),afds:valid(inputs['afds.state']),
   autothrottle:valid(inputs['autothrottle.state']),commandsIssued:false};
  if(!valid(inputs['navigation.database']))issues.push('NAV_DATABASE_SOURCE_NOT_VERIFIED');
  if(!valid(inputs['performance.database']))issues.push('PERFORMANCE_DATABASE_SOURCE_NOT_VERIFIED');
  data.predictions={fuelAtDestinationKg:null,topOfDescentNm:null,optimumAltitudeFt:null,
   n1TargetPercent:null,quality:'UNKNOWN',reason:'NO_VALIDATED_PERFORMANCE_AND_FLIGHT_MODEL'};
  const ready=powerReady&&!!fix&&active&&data.route.legsVerified&&!data.route.discontinuitiesUnknown;
  data.guidance={routeEvidenceReady:ready,canCommandAircraft:false,authority:'ADVISORY_ONLY',
   reason:ready?'INPUT_EVIDENCE_READY_NO_ACTUATOR_AUTHORITY':'SOURCE_OR_ROUTE_NOT_VERIFIED'};
  return {schema:'B737_FMC_COMPUTED_V1',inputs:INPUTS.length,position:data.position,
   radioUpdate:data.radioUpdate,airData:data.airData,fuel:data.fuel,fmcFeeds:data.fmcFeeds,
   route:data.route,mcp:data.mcp,autoflight:data.autoflight,predictions:data.predictions,
   guidance:data.guidance,issues,sourceQuality:Object.fromEntries(INPUTS.map(t=>[t,inputs[t].quality]))};
 }
 function connect(network){
  if(!network?.producer||!network?.read||!network?.subscribe)throw Error('AVIONICS_NETWORK_REQUIRED');
  const out=network.producer('FMC');let previous='',updating=false;
  function refresh(){
   if(updating)return null;
   updating=true;
   try{const value=project(network),fingerprint=JSON.stringify(value);
    if(previous!==fingerprint){previous=fingerprint;out.publish('fmc.computed',value,{origin:'TRAINING_SCENARIO'});}
    return value;
   }finally{updating=false;}
  }
  const unsub=network.subscribe('*',msg=>{if(msg.topic!=='fmc.computed')refresh();},{replay:false});
  refresh();
  return Object.freeze({refresh,getState:()=>copy(project(network)),disconnect:unsub});
 }
 return Object.freeze({INPUTS,project,connect});
});
