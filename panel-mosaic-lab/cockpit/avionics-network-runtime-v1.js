/* Unified read-only avionics source adapters + FMC consumer.
 * Each subsystem owns its topic. Readings are published to any subscribers in
 * the same cockpit session; never sent to unrelated Internet users.
 * Protected IRS/CDU/MCP frontends and CB photos are not modified.
 */
(function(root){
 'use strict';
 const Network=root.B737AvionicsDataNetworkV1,Computer=root.B737AvionicsFmcComputerV1;
 if(!Network||!Computer){root.console?.error('AVIONICS NETWORK DEPENDENCIES MISSING');return;}
 const SensorIngress=root.B737AvionicsSensorIngressV2;
 const network=Network.createNetwork({onError:e=>root.console?.warn('AVIONICS SUBSCRIBER ERROR',e)});
 const owners=new Map(),faults=[];
 let refreshPending=false;
 const enqueue=root.queueMicrotask?fn=>root.queueMicrotask(fn):fn=>Promise.resolve().then(fn);
 function scheduleRefresh(){
  if(refreshPending)return;refreshPending=true;
  enqueue(()=>{if(refreshPending){refreshPending=false;refresh();}});
 }
 function flushRefresh(){if(refreshPending){refreshPending=false;refresh();}}
 const clone=x=>JSON.parse(JSON.stringify(x));
 const getOwner=id=>{if(!owners.has(id))owners.set(id,network.producer(id));return owners.get(id)};
 const sensorIngress=SensorIngress?.create({getPublisher:getOwner})||null;
 const send=(owner,topic,value,origin='TRAINING_SCENARIO')=>{
  try{return getOwner(owner).publish(topic,value,{origin});}
  catch(e){faults.push({owner,topic,error:String(e.message||e)});if(faults.length>32)faults.shift();return null;}
 };
 const snapshotFns=Object.freeze({
  electrical:()=>root.B737ISNCockpitV1?.getState?.()?.state?.electrical,
  irs:()=>root.B737IRSTrainerUnified?.getState?.(),
  mcp:()=>root.B737McpAFDSBridgeV1?.getOutput?.(),
  fmc:()=>root.B737FmcSystemsBridgeV1?.getState?.(),
  ecu:()=>root.B737ISNCockpitV1?.getECUState?.(),
  profile:()=>root.B737AircraftProfileStore?.get?.()
 });
 function electrical(){
  const e=snapshotFns.electrical();
  if(e?.schema==='B737_ELECTRICAL_V7_RESULT'&&e.bus&&typeof e.bus==='object'){
   send('ELECTRICAL','electrical.buses',{bus:e.bus,revision:e.revision??null,
    evidence:'BUS_LEVEL_ONLY_NO_VERIFIED_EQUIPMENT_FEED'},'LIVE_SYSTEM');
  }
 }
 function irs(){
  const state=snapshotFns.irs();
  if(!state?.units)return;
  for(const [side,topic] of [['L','irs.left'],['R','irs.right']]){
   const u=state.units[side];if(!u)continue;
   const position=u.positionValid===true?u.position:null;
   send('IRS',topic,{mode:u.mode,phase:u.phase,powered:u.powered===true,
    positionValid:u.positionValid===true,lat:position?.lat??null,lon:position?.lon??null,
    gsKt:u.gsKt??null,trackDeg:u.trueTrackDeg??null,headingDeg:u.trueHeadingDeg??null,
    source:state.motionSource,trainerOnly:state.trainerOnly===true},
    state.motionSource==='EXTERNAL_TELEMETRY'?'SIMULATOR_TELEMETRY':'TRAINING_SCENARIO');
  }
 }
 function mcp(){
  const s=snapshotFns.mcp();if(s?.schema!=='B737_MCP_AFDS_OUTPUT_V1')return;
  const c=s.controls||{},m=s.modes||{},v=s.values||{};
  send('MCP','mcp.state',{powered:s.power,feedEvidence:s.powerEvidence,
   altitudeFt:v.altitude??null,selectedSpeedKt:v.speed??null,
   headingDeg:v.heading??null,verticalSpeedFpm:v.verticalSpeed??null,courseL:v.courseL??null,courseR:v.courseR??null,
   lateralMode:m.lateral??null,verticalMode:m.vertical??null,pending:s.pending||{}},'TRAINING_SCENARIO');
  send('AFDS','afds.state',{lateralMode:m.lateral??null,verticalMode:m.vertical??null,autopilotMode:m.autopilot??null,
   fdLeft:c.fd?.left??null,fdRight:c.fd?.right??null,power:s.power},'TRAINING_SCENARIO');
  send('AUTOTHROTTLE','autothrottle.state',{armed:c.atArm===true,mode:m.thrust??null,
   power:s.power,actuatorFeedback:'NOT_AVAILABLE'},'TRAINING_SCENARIO');
 }
 function fmcFeedsAndRoute(){
  const s=snapshotFns.fmc();if(!s)return;
  if(s.power)send('FMC_FEEDS','electrical.fmcFeeds',{FMC1:s.power.FMC1, FMC2:s.power.FMC2,
   CDU_CAPT:s.power.CDU_CAPT,CDU_FO:s.power.CDU_FO,
   verification:'PER_UNIT_FEED_EVIDENCE_FROM_FMC_BRIDGE'},'LIVE_SYSTEM');
  const r=s.route;
  if(r)send('CDU','crew.flightplan',{origin:r.origin||'',dest:r.dest||'',active:r.active===true,
   legsVerified:r.legsVerified===true,discontinuitiesUnknown:r.discontinuitiesUnknown!==false,
   routeSource:'DUAL_CDU_SHARED_SESSION',transactional:true},'CREW_ENTRY');
 }
 function engine(){
  const e=snapshotFns.ecu();
  if(!e?.engines)return;
  for(const n of [1,2]){
   const v=e.engines['engine'+n];if(!v||typeof v!=='object')continue;
   send('ENGINE','propulsion.engine'+n,{phase:v.phase||null,n1Percent:v.n1Percent??null,
    n2Percent:v.n2Percent??null,egtC:v.egtC??null,fuelFlowKgHr:v.fuelFlowKgHr??null,
    oilPressurePsi:v.oil?.pressurePsi??null,trainingModel:true},'TRAINING_SCENARIO');
  }
  // An ECU fuel-flow indication is NOT a fuel-quantity summation signal.
  // Fuel quantity stays UNKNOWN until an authoritative summation adapter is attached.
 }
 function auxiliarySystems(){
  const ecu=snapshotFns.ecu();
  if(!ecu)return;
  const aircraft=ecu.aircraft;
  if(aircraft&&typeof aircraft==='object')
   send('FLIGHT_CONTEXT','flightcontext.state',{
    pressureAltitudeFt:aircraft.pressureAltitudeFt??null,iasKt:aircraft.iasKt??null,
    oatC:aircraft.oatC??null,massKg:aircraft.massKg??null,onGround:aircraft.onGround??null,
    source:'ISN13_18_TRAINING_FLIGHT_CONDITIONS_NOT_ADC'},'TRAINING_SCENARIO');
  if(ecu.apu&&typeof ecu.apu==='object')
   send('APU','apu.state',{...ecu.apu,source:'ISN13_18_APU_TRAINING_MODEL'},'TRAINING_SCENARIO');
  if(ecu.hydraulics&&typeof ecu.hydraulics==='object')
   send('HYDRAULICS','hydraulics.state',{...ecu.hydraulics,
    source:'ISN13_18_ENGINE_DRIVEN_PRESSURE_TRAINING_MODEL'},'TRAINING_SCENARIO');
  const pumps=root.B737ISNCockpitV1?.getState?.()?.state?.pumps;
  if(pumps&&typeof pumps==='object')
   send('FUEL','fuel.pumps',{observations:pumps,
    note:'INCLUDES_HYDRAULIC_PUMPS; EQUIPMENT_FEED_ASSIGNMENTS_UNVERIFIED'},'TRAINING_SCENARIO');
 }
 function fuelQuantity(){
  const fuel=snapshotFns.ecu()?.fuel;
  const t=fuel?.tanksKg;
  if(!t||!['main1','main2','center'].every(k=>typeof t[k]==='number'&&Number.isFinite(t[k])&&t[k]>=0))return;
  const totalKg=t.main1+t.main2+t.center;
  send('FUEL','fuel.quantity',{totalKg,tanksKg:{main1:t.main1,main2:t.main2,center:t.center},
   source:'ISN09_12_SIMULATED_TANKS_NOT_A_VERIFIED_FUEL_SUMMATION_UNIT',
   trainingModel:true},'TRAINING_SCENARIO');
 }
 function airGround(){
  const a=snapshotFns.ecu()?.aircraft;
  if(typeof a?.onGround==='boolean'){
   send('AIRGROUND','aircraft.airground',{onGround:a.onGround,
    source:'ISN13_18_TRAINING_FLIGHT_CONTEXT'},'TRAINING_SCENARIO');
  }
 }
 function pneumatics(){
  const start=root.B737ISNCockpitV1?.getStartState?.();
  const bleed=start?.bleed;
  if(bleed&&typeof bleed==='object')send('PNEUMATICS','pneumatics.state',{
   bleedValveObservations:bleed,ductPressurePsi:null,
   ductPressureVerified:false,source:'ISN_START_CHAIN_DISCRETES'},'TRAINING_SCENARIO');
 }
 function antiice(){
  const heat=root.B737WindowHeatUnifiedV1?.getOutput?.();
  const tat=root.B737TATProbeUnifiedV1?.getOutput?.();
  if(!heat&&!tat)return;
  send('ANTIICE','antiice.state',{windowHeat:heat||null,
   tatProbeHeater:tat||null,engineAntiIce:null,wingAntiIce:null,
   completeness:'PARTIAL_WINDOW_HEAT_AND_TAT_ONLY'},'TRAINING_SCENARIO');
 }
 function profile(){
  const s=snapshotFns.profile();
  if(s&&typeof s==='object')send('PROFILE','aircraft.profile',{aircraftFamily:s.aircraftFamily??null,
   pressurization:s.pressurization??null,engineInstruments:s.engineInstruments??null},'CREW_ENTRY');
 }
 function clock(){
  const time=new Date();
  send('CLOCK','clock.utc',{isoUtc:time.toISOString(),epochMs:time.valueOf()},'LIVE_SYSTEM');
 }
 function refresh(){
  refreshPending=false;
  for(const f of [electrical,irs,mcp,fmcFeedsAndRoute,engine,auxiliarySystems,fuelQuantity,airGround,pneumatics,antiice,profile,clock])try{f()}catch(e){
   faults.push({source:f.name,error:String(e.message||e)});if(faults.length>32)faults.shift();
  }
  computer.refresh(); // Let TTL expiry invalidate computed FMC even without new sensor frames.
  return network.audit();
 }
 const computer=Computer.connect(network);
 network.subscribe('*',record=>{
  if(record.revision>0)root.dispatchEvent(new CustomEvent('b737:avionics-data',{detail:record}));
 },{replay:false});
 // Every future adapter is attached to its own fixed owner. It cannot write a
 // topic owned by another avionics system, or override existing live adapters.
 const connectedExternal=new Set();
 function connectExternal(owner){
  if(typeof owner!=='string'||!Object.values(Network.CATALOG).some(x=>x.owner===owner))throw Error('UNKNOWN_AVIONICS_OWNER');
  if(owners.has(owner)||connectedExternal.has(owner)||owner==='FMC')throw Error('OWNER_ALREADY_CONNECTED');
  const publisher=getOwner(owner);
  connectedExternal.add(owner);
  return Object.freeze({owner,topics:[...publisher.topics],
   publish(topic,value,{quality='VALID',origin='SIMULATOR_TELEMETRY',reason=null}={}){
    if(!['SIMULATOR_TELEMETRY','TRAINING_SCENARIO','REFERENCE_DATABASE','CREW_ENTRY'].includes(origin))
     throw Error('EXTERNAL_SOURCE_ORIGIN_UNVERIFIED');
    return publisher.publish(topic,value,{quality,origin,reason});
   }});
 }
 // Non-mutating registration, readable by all authorized same-context consumers.
 root.B737UnifiedAvionicsNetworkV1=Object.freeze({
  getSignal:topic=>{flushRefresh();return network.read(topic)},getSnapshot:()=>{flushRefresh();return network.snapshot()},
  getDiagnostics:()=>{flushRefresh();return {...network.audit(),adapterErrors:clone(faults)}},
  getFmcInputs:()=>{flushRefresh();return computer.getState()},subscribe:(...args)=>{flushRefresh();return network.subscribe(...args)},
  connectExternal,refresh,topics:network.topics,
  configureSensorIngress(options){
   if(!sensorIngress)throw Error('SENSOR_INGRESS_MODULE_NOT_LOADED');
   if(options?.equipment)for(const [kind,nums] of Object.entries(options.equipment)){
    if(!['adc','gps','vor','dme'].includes(kind))throw Error('INVALID_SENSOR_KIND');
    if(Array.isArray(nums)&&nums.length){
     const owner={adc:'ADC',gps:'GPS',vor:'VHF_NAV',dme:'DME'}[kind];
     if(owners.has(owner))throw Error('SENSOR_OWNER_ALREADY_REGISTERED_'+owner);
    }
   }
   const info=sensorIngress.configure(options);
   for(const kind of Object.keys(options.equipment))
    if(options.equipment[kind].length)getOwner({adc:'ADC',gps:'GPS',vor:'VHF_NAV',dme:'DME'}[kind]);
   return info;
  },
  ingestSensorFrame(packet){if(!sensorIngress)throw Error('SENSOR_INGRESS_MODULE_NOT_LOADED');
   return sensorIngress.ingest(packet);},
  getSensorIngressDiagnostics:()=>sensorIngress?.diagnostics()||{configured:false,error:'MODULE_MISSING'},
  supportedSources:Object.freeze({LIVE:['ELECTRICAL','IRS','MCP','AFDS','AUTOTHROTTLE','FMC_FEEDS','CDU','ENGINE','FUEL','FLIGHT_CONTEXT','APU','HYDRAULICS','PNEUMATICS','ANTIICE','AIRGROUND','PROFILE','CLOCK'],
   AWAITING_SIGNAL:['ADC','GPS','VHF_NAV','DME','TAT','NAVDB','PERFDB','ACARS','CB'],
   SENSOR_INGRESS_READY:['ADC','GPS','VHF_NAV','DME']})
 });
 // Old FMC/IRS frontend and driver remain the authoritative writers.
 // Consume existing change events, with a 250ms health poll for non-event sources.
 for(const event of ['b737:irs-trainer-state','b737:mcp-afds-state','b737:isn-start-indications',
  'b737:fmc-systems-state','b737:aircraft-profile-change']){
  root.addEventListener(event,scheduleRefresh);
 }
 root.addEventListener('b737:cockpit-mounted',refresh);
 if(root.document?.readyState==='loading')root.document.addEventListener('DOMContentLoaded',refresh,{once:true});
 refresh();
 root.setInterval(refresh,250);
})(window);
