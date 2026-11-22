(async()=>{
;
/* ../../engine/systems/classic-bus-consumer-engine-v1.js?v=ATA24-MULTIFEED-0001 */
try{
/* B737 Classic MRG IV.6 functional bus/consumer engine v1.
 * 340 generic Classic reference rows; FCOM 6.20 and Lufthansa ATA24.
 * Live bus authority: Electrical V7 ONLY. This model does not create an
 * electrical plant, invent measured voltage, or override physical switches.
 * 'NORMAL' means an electrical function CAN operate, not that its
 * physical actuator has been commanded ON.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicBusConsumersV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const SCHEMA='b737classic.bus-consumer-functional/1';
 const BUS_VOLTAGES=Object.freeze({
  generator1:'115VAC',generator2:'115VAC',main1:'115VAC',main2:'115VAC',
  transfer1:'115VAC',transfer2:'115VAC',electronic1:'115VAC+28VDC',
  electronic2:'115VAC+28VDC',standby:'115VAC+28VDC',
  dc1:'28VDC',dc2:'28VDC',battery:'28VDC',hotBattery:'28VDC',
  switchedHotBattery:'28VDC',groundService:'115VAC',external:'115VAC'
 });
 const MRG_PUMP_FEEDS=Object.freeze({
  'fuel.main1FwdPump':{bus:'main1',voltage:'115VAC',item:'Fuel Boost Pump - Main Tank 1 Forward'},
  'fuel.main1AftPump':{bus:'transfer1',voltage:'115VAC',item:'Fuel Boost Pump - Main Tank 1 Aft'},
  'fuel.main2FwdPump':{bus:'main2',voltage:'115VAC',item:'Fuel Boost Pump - Main Tank 2 Forward'},
  'fuel.main2AftPump':{bus:'transfer2',voltage:'115VAC',item:'Fuel Boost Pump - Main Tank 2 Aft'},
  'fuel.centerLeftPump':{bus:'main2',voltage:'115VAC',item:'Fuel Boost Pump - Center Tank Left'},
  'fuel.centerRightPump':{bus:'main1',voltage:'115VAC',item:'Fuel Boost Pump - Center Tank Right'},
  'hyd.electricPumpA':{bus:'generator2',voltage:'115VAC',item:'Electric Hydraulic Pump 2 Sys A'},
  'hyd.electricPumpB':{bus:'generator1',voltage:'115VAC',item:'Electric Hydraulic Pump 1 Sys B'}
 });
 const CB_ITEMS=Object.freeze({
  'Fuel Boost Pump - Main Tank 1 Forward':'fuel.main1FwdPump',
  'Fuel Boost Pump - Main Tank 1 Aft':'fuel.main1AftPump',
  'Fuel Boost Pump - Main Tank 2 Forward':'fuel.main2FwdPump',
  'Fuel Boost Pump - Main Tank 2 Aft':'fuel.main2AftPump',
  'Fuel Boost Pump - Center Tank Left':'fuel.centerLeftPump',
  'Fuel Boost Pump - Center Tank Right':'fuel.centerRightPump',
  'Electric Hydraulic Pump 2 Sys A':'hyd.electricPumpA',
  'Electric Hydraulic Pump 1 Sys B':'hyd.electricPumpB',
  'Fuel Crossfeed Valve':'fuel.crossfeedControl',
  'Air Condition Isolation Valve':'air.bleedIsolationControl',
  'Pneumatic Duct Pressure Indication':'air.ductGauge',
  'Engine 1 N2 Indication (non-EIS)':'engine1.n2Indicator',
  'Engine 2 N2 Indication (non-EIS)':'engine2.n2Indicator',
  'Engine 1 Fuel Flow Indication':'engine1.fuelFlowIndicator',
  'Engine 2 Fuel Flow Indication':'engine2.fuelFlowIndicator',
  'Engine 1 Starter Valve':'engine1.starter',
  'Engine 2 Starter Valve':'engine2.starter',
  'Engines N1 Indication':'engine1.n1Indicator|engine2.n1Indicator',
  'Engines EGT Indication':'engine1.egtIndicator|engine2.egtIndicator',
  'Engines N2 Indication':'engine1.n2Indicator|engine2.n2Indicator',
  'Engines Fuel Flow Indication (EIS)':'engine1.fuelFlowIndicator|engine2.fuelFlowIndicator',
  'Engine 1-2 AVM Indication':'engine.vibrationIndicator',
  'Engine 1 Oil Pressure Indication':'engine1.oilIndicator',
  'Engine 2 Oil Pressure Indication':'engine2.oilIndicator',
  'Engine 1 Oil Quantity Indication':'engine1.oilQuantityIndicator',
  'Engine 2 Oil Quantity Indication':'engine2.oilQuantityIndicator',
  'Engine 1 Oil Temp Indication':'engine1.oilIndicator',
  'Engine 2 Oil Temp Indication':'engine2.oilIndicator'
 });
 const FAMILY=[
  ['ENGINE_INDICATION',/engines? (?:n1|n2|egt|oil|fuel flow)|avm indication|engine [12] (?:n2|fuel flow|oil)/i],
  ['ENGINE_START',/starter|ignition|engine idle|start lever/i],
  ['FUEL',/fuel|crossfeed/i],
  ['HYDRAULICS',/hydraulic|hyd sys|brake pressure/i],
  ['ELECTRICAL',/battery|power|tr unit|generator|rectifier|inverter|bus |charger|drive/i],
  ['ICE_PROTECTION',/anti.ice|window heat|probe heat|pitot heat|static heat|windshield heat/i],
  ['PNEUMATICS',/bleed|isolation valve|duct pressure/i],
  ['AIR_CONDITIONING',/air condition|recirc|pack |temperature|ram air|turbofan/i],
  ['PRESSURIZATION',/pressur|outflow|cabin altitude/i],
  ['FLIGHT_CONTROLS',/flight control|aileron|elevator|stabilizer|spoiler|rudder|flaps|trim/i],
  ['AVIONICS',/fmc|cdu|mcp|efis|adc|irs|dme|adf|vhf|vhf|vhf|transponder|vor|radar|marker|eadi|ehsi|gpws|autopilot|yaw damper|autothrottle/i],
  ['FIRE_PROTECTION',/fire|smoke|extinguisher/i],
  ['LANDING_GEAR',/landing gear|gear |antiskid|anti.skid|autobrake|brake/i],
  ['LIGHTING',/light|lamp|flood/i],
  ['COMMUNICATIONS',/audio|interphone|radio|mic|speaker/i]
 ];
 // Specific ATA system owners: the source index has no miscellaneous OTHER.
 const SPECIALIZED_FAMILY=[
  ['AVIONICS',/^(?:ADS Computer|DAA ?[12]|Instrument Transfer|SG (?:Captain|FO)|FCC ?-?A\s*\/\s*B)/i],
  ['DOORS_AND_STAIRS',/^Air Stair(?:\b|\s|\s*-)/i],
  ['FLIGHT_INSTRUMENTS',/^(?:Alpha Vane AoA|Altimeter |Clock(?: \(| Display)|Mach\s*ASI|Pitot Static Indicator|Pilot Static Indicator|RDMI|Standby Horizon|TAS\s*-|VSI )/i],
  ['WARNING_SYSTEMS',/^(?:Aural Warnings|Mach Warning|Master Caution Annunciation|Stall Warning)/i],
  ['FLIGHT_CONTROLS',/^(?:Auto Slat|Flap Load Limiter|Flap SOV|FCC\s*-?A)/i],
  ['CABIN_SERVICES',/^(?:Cabin Service Outlets|Fasten Belts|Galley\b|Passenger(?:s)?(?: -|\s) |Passengers Signs Control)/i],
  ['WATER_WASTE_SYSTEM',/^(?:Drain mast|Lavatory |Water Quantity Indication)/i],
  ['ELECTRICAL',/^(?:Engine [12] CSD Oil Temp Indication|INV (?:Control|Voltage Indication)|STBY PWR)/i],
  ['EQUIPMENT_COOLING',/^Equip\. Cooling/i],
  ['COMMUNICATIONS',/^(?:lnterphone|Interphone|Public Address Amplifier)/i],
  ['AIR_CONDITIONING',/^(?:Ram Door|Re-circulation Fan|Temp\. Control|Wing Body Overheat)/i],
  ['WINDSHIELD_CLEARING',/^(?:Rain Repellent|Windshield Wiper)/i],
  ['LANDING_GEAR',/^Nose Strut switch/i],
  ['OXYGEN',/^Oxygen System/i],
  ['HYDRAULICS',/^PTU\/LG Bypass Valve/i],
  ['ENGINE_CONTROL',/^(?:PMC ?[12]|Thrust Reverse(?: Control)?$)/i],
  ['ENGINE_INDICATION',/^Thrust Mode Annunciation/i]
 ];
 function family(item){
  for(const [id,pattern]of SPECIALIZED_FAMILY)if(pattern.test(item))return id;
  for(const [id,pattern]of FAMILY)if(pattern.test(item))return id;
  throw Error('MRG electrical item has no assigned aircraft system: '+item);
 }
 function role(item){
  if(/indicat|display|monitor|gauge|meter|clock|warning|annunciat|light|lamp/i.test(item))return 'INDICATION';
  if(/valve|actuator|motor|pump|fan|heat|heater|wiper|trim/i.test(item))return 'ACTUATOR';
  if(/control|switch|selector|relay|logic/i.test(item))return 'CONTROL';
  return 'EQUIPMENT';
 }
 function consequence(r){
  if(r==='INDICATION')return 'BLANK_OR_HOLD_BY_INSTRUMENT';
  if(r==='ACTUATOR')return 'ELECTRIC_FUNCTION_STOPS_OR_CANNOT_START';
  if(r==='CONTROL')return 'COMMAND_AUTHORITY_UNAVAILABLE';
  return 'ELECTRIC_CAPABILITY_UNAVAILABLE';
 }
 const tri=v=>v===true||v===false||v===null;
 const and=a=>a.includes(false)?false:a.includes(null)?null:true;
 function validate(index){
  if(index?.schema!=='b737-classic.mrg-iv6.consumer-bus-index.v1'||!Array.isArray(index.rows)||index.rows.length!==340)
   throw Error('MRG Classic 340 source rows required');
  const ids=new Set();
  for(const row of index.rows){
   if(!row?.id||ids.has(row.id)||!Object.hasOwn(BUS_VOLTAGES,row.feedBus.split('|')[0])||
    !['115VAC','28VDC','28VAC'].includes(row.feedVoltage)||!(row.printedPage>=182&&row.printedPage<=188))
    throw Error('Invalid MRG consumer row '+row?.id);
   ids.add(row.id);
  }
  return true;
 }
 // Distinguish all of the named 115V, 28V DC and 28V AC distribution
 // layers. V7 already owns generation, TR logic, transfer and standby logic.
 // These derived layers are training proxies for availability, not measured
 // transformer excitation or an aircraft-specific wiring schedule.
 function defineBuses(electrical,{electricalState=null}={}){
  if(electrical?.schema!=='B737_ELECTRICAL_V7_RESULT'||!electrical.bus)
   throw Error('One evaluated Electrical V7 output required');
  const raw=electrical.bus,all={};
  function add(id,voltage,power,parents=[],basis='FCOM_ELECTRICAL_V7'){
   if(!tri(power))throw Error('Invalid state for '+id);
   all[id]={id,voltage,powered:power,status:power===true?'ON':power===false?'OFF':'UNKNOWN',
    parents:[...parents],basis};
  }
  for(const [name,voltage]of Object.entries({
   generator1:'115VAC',generator2:'115VAC',main1:'115VAC',main2:'115VAC',
   transfer1:'115VAC',transfer2:'115VAC',
   dc1:'28VDC',dc2:'28VDC',battery:'28VDC',hotBattery:'28VDC',
   switchedHotBattery:'28VDC',groundService:'115VAC'
  }))add(name+'@'+voltage,voltage,raw[name]??null,[],raw[name]===null?'V7_BACKUP_UNRESOLVED':'FCOM_ELECTRICAL_V7');
  const ext=electricalState?.config;
  const extOn=ext?Boolean(ext.onGround&&ext.groundPowerAttached&&ext.groundPowerQualityGood):null;
  add('external@115VAC','115VAC',extOn,[],'EXTERNAL_RECEPTACLE_QUALITY');
  for(const side of [1,2]){
   const tr='transfer'+side,gn='generator'+side,dc='dc'+side;
   add(tr+'@28VAC','28VAC',raw[tr]??null,[tr+'@115VAC'],'28VAC_FUNCTIONAL_CONVERSION_PROXY');
   add('main'+side+'@28VAC','28VAC',raw['main'+side]??null,['main'+side+'@115VAC'],'28VAC_FUNCTIONAL_CONVERSION_PROXY');
   add('electronic'+side+'@115VAC','115VAC',
    raw[gn]??null,[gn+'@115VAC'],'ELECTRONIC_BUS_FUNCTIONAL_PROXY_Generator_Side');
   add('electronic'+side+'@28VDC','28VDC',
    raw[dc]??null,[dc+'@28VDC'],'ELECTRONIC_DC_FUNCTIONAL_PROXY');
  }
  add('groundService@28VAC','28VAC',raw.groundService??null,
   ['groundService@115VAC'],'28VAC_FUNCTIONAL_CONVERSION_PROXY');
  // V7 uses acStandby/dcStandby as internal signals; each corresponds to
  // ONE physically modelled standby bus, not a separate duplicate bus node.
  add('standby@115VAC','115VAC',raw.acStandby??null,[],'FCOM_AC_STANDBY_BUS');
  add('standby@28VDC','28VDC',raw.dcStandby??null,[],'FCOM_DC_STANDBY_BUS');
  // Training-only exact feeder cuts: 28VAC transformer output and electronic
  // bus can fail independently of their upstream 115VAC/28VDC source.
  for(const key of electrical.busClassOutages||[])if(all[key]){
   all[key]={...all[key],powered:false,status:'OFF',
    basis:'INJECTED_BUS_FAILURE_TRAINING'};
  }
  return all;
 }
 function getBus(buses,source,voltage,{anyAvailable=false}={}){
  const parts=source.split('|');
  const values=parts.map(part=>{
   const key=part+'@'+voltage;
   return buses[key]||{id:key,voltage,powered:null,status:'UNKNOWN',parents:[],
    basis:'BUS_OR_CONVERTER_NOT_MODELLED'};
  });
  const live=values.filter(x=>x.powered===true).length;
  const lost=values.filter(x=>x.powered===false).length;
  // The FMC's Electronic 1+2 reference describes alternative usable
  // electrical feeds for binary FMC availability, not one compound
  // half-powered LRU. Other multi-feed devices retain channel degradation.
  const state=anyAvailable?(live>0?true:lost===parts.length?false:null):
   parts.length===1?values[0].powered:
   lost===parts.length?false:live===parts.length?true:live>0?'DEGRADED':null;
  return {busIds:values.map(x=>x.id),sourceStatus:state,inputs:values,
   powerStatus:state===true?'NORMAL':state===false?'OFF':state==='DEGRADED'?'DEGRADED':'UNKNOWN',
   basis:values.map(x=>x.basis)};
 }
 function displayName(row){
  // MRG lists the *same* physical L/R AoA vane on two different electrical
  // feeds. LAN ATA30 establishes Transfer Bus as the heater source. MRG's
  // Main Bus entry is retained as a distinct additional feed, not a second
  // heater; its precise aircraft-specific function is not WDM-confirmed.
  if(/^Alpha Vane AoA - (left|right)$/i.test(row.item)){
   const side=/left/i.test(row.item)?'L':'R';
   if(/^transfer[12]$/.test(row.feedBus))
    return row.item+' [L/R '+side+' · VANE HEATER · '+row.feedBus.toUpperCase()+' 115V AC]';
   if(/^main[12]$/.test(row.feedBus))
    return row.item+' [L/R '+side+' · ADDITIONAL AOA FEED · '+row.feedBus.toUpperCase()+' 115V AC · FUNCTION UNCONFIRMED]';
  }
  const marks=[];
  if(row.applicability==='CPCS')marks.push('CPCS');
  if(row.applicability==='DCPCS')marks.push('DCPCS');
  if(/non.EIS/i.test(row.item))marks.push('CONVENTIONAL');
  else if(/\(EIS\)/i.test(row.item))marks.push('EIS');
  if(/\(400\)/i.test(row.item))marks.push('B737-400');
  if(/\(300-500\)/i.test(row.item))marks.push('B737-300/500');
  if(/\(600-700\)/i.test(row.item))marks.push('737-600/700 REFERENCE');
  if(row.applicability==='EQUIPMENT_OPTION')marks.push('AS INSTALLED');
  const base=row.item.replace(/\s*\((?:non-EIS|EIS|CPCS|DCPCS|400|300-500|600-700|As installed)\)/gi,'').trim();
  return base+(marks.length?' ['+[...new Set(marks)].join(' · ')+']':'');
 }
 function appropriate(row,{mode,pressurization,aircraftModel}){
  if(row.applicability==='DCPCS'&&pressurization!=='DCPCS')return false;
  if(row.applicability==='CPCS'&&pressurization!=='CPCS')return false;
  if(/non.EIS/i.test(row.item)&&mode==='EIS')return false;
  if(/\(EIS\)/i.test(row.item)&&mode==='CONVENTIONAL')return false;
  if(/\(600-700\)/i.test(row.item))return false; // Not a Classic -300/400/500.
  if(/\(400\)/i.test(row.item)&&aircraftModel!=='737-400')return false;
  if(/\(300-500\)/i.test(row.item)&&aircraftModel==='737-400')return false;
  return true;
 }
 function project({index,electrical,electricalState=null,mode='CONVENTIONAL',
  pressurization='DCPCS',aircraftModel='737-300',cbAvailable=null,
  includeAllConfigurations=false,labBusPower=null}={}){
  validate(index);
  if(!['EIS','CONVENTIONAL'].includes(mode)||!['CPCS','DCPCS'].includes(pressurization)||
   !['737-300','737-400','737-500'].includes(aircraftModel))
   throw Error('Invalid B737 Classic aircraft configuration');
  // Fail loudly if the 8 functional pump associations drift away from the
  // exact consumer labels and feed buses in the committed MRG reference.
  for(const [id,feed]of Object.entries(MRG_PUMP_FEEDS)){
   if(!index.rows.some(r=>r.item===feed.item&&r.feedBus===feed.bus&&r.feedVoltage===feed.voltage))
    throw Error('MRG functional pump source conflict: '+id);
  }
  const sourceBuses=defineBuses(electrical,{electricalState});
  // An isolated teaching-lab snapshot can inject a complete set of bus
  // class states. It never writes to Electrical V7, the physical cockpit or
  // the live source session. Missing/unknown bus keys are rejected.
  let buses=sourceBuses;
  if(labBusPower!==null){
   if(typeof labBusPower!=='object'||Array.isArray(labBusPower)||
      Object.keys(labBusPower).length!==Object.keys(sourceBuses).length)
    throw Error('Lab injection requires exactly every known bus-class node');
   buses={};
   for(const [key,original] of Object.entries(sourceBuses)){
    if(!Object.hasOwn(labBusPower,key)||typeof labBusPower[key]!=='boolean')
     throw Error('Invalid laboratory bus state: '+key);
    const powered=labBusPower[key];
    buses[key]={...original,powered,status:powered?'ON':'OFF',
      basis:'ISOLATED_LAB_INJECTION_NOT_AIRCRAFT_BUS'};
   }
   for(const key of Object.keys(labBusPower))
    if(!Object.hasOwn(sourceBuses,key))throw Error('Unknown laboratory bus: '+key);
  }
  const consumers={},systems={};
  const tally={NORMAL:0,OFF:0,DEGRADED:0,UNKNOWN:0,NOT_INSTALLED:0};
  for(const row of index.rows){
   const installed=includeAllConfigurations||appropriate(row,{mode,pressurization,aircraftModel});
   const feed=getBus(buses,row.feedBus,row.feedVoltage,{anyAvailable:row.item==='FMC'});
   const breaker=CB_ITEMS[row.item]||null;
   const cbNames=breaker?.split('|')||[];
   const cbStates=typeof cbAvailable==='function'?cbNames.map(id=>cbAvailable(id)):null;
   const cbOpen=cbStates?.includes(false)===true;
   const cbUnknown=cbStates?.some(x=>x!==true&&x!==false)===true;
   const cbPartial=Boolean(cbStates?.includes(false)&&cbStates?.includes(true));
   // One opened EIS N1/EGT/N2 channel breaker must degrade the paired
   // row, not assert both engine channels are dark.
   let state=!installed?'NOT_INSTALLED':
    cbOpen&&!cbPartial?'OFF':
    cbPartial&&feed.powerStatus==='NORMAL'?'DEGRADED':
    feed.powerStatus;
   const unresolvedOption=row.applicability==='EQUIPMENT_OPTION'&&
    /as installed|rain repellent/i.test(row.item);
   const quality=unresolvedOption?'INSTALLATION_OPTION_UNCONFIRMED':
    row.sourceConfidence==='PRINTED_INDEX_READABLE'?
    'MRG_CLASSIC_FUNCTIONAL':'MRG_SOURCE_REVIEW_PENDING';
   // Test Lab electrical availability must be derived from the mapped bus
   // and CB alone. Source-photo QA and optional installed equipment are
   // separate evidence, not reasons for an energized feed to show UNKNOWN.
   const installationStatus=row.applicability==='EQUIPMENT_OPTION'?
    'AS_INSTALLED_UNVERIFIED':'GENERAL_CLASSIC_REFERENCE';
   const type=role(row.item),group=family(row.item);
   const entry={
    id:row.id,name:row.item,displayName:displayName(row),system:group,role:type,
    feedBus:row.feedBus,feedVoltage:row.feedVoltage,
    busKeys:feed.busIds,powerState:state,
    canOperate:state==='NORMAL'?true:state==='OFF'||state==='NOT_INSTALLED'?false:null,
    requiredCBs:cbNames,cbState:!breaker?'NOT_MAPPED':cbPartial?'PARTIAL_OPEN':cbOpen?'OPEN':cbUnknown?'UNKNOWN':cbStates?'CLOSED':'NOT_OBSERVED',
    source:{reference:'MRG IV.6',printedPage:row.printedPage,
     sourceConfidence:row.sourceConfidence,genericClassic:true},
    impact:state==='NORMAL'?'ELECTRICAL_FUNCTION_AVAILABLE':
     state==='OFF'?consequence(type):state==='DEGRADED'?'SOME_CHANNELS_AVAILABLE':
     state==='NOT_INSTALLED'?'NOT_APPLICABLE_TO_SELECTED_CONFIGURATION':
     'NO_ASSUMED_EQUIPMENT_RESPONSE',
    activeCommand:'NOT_OBSERVED',quality,installationStatus,
    duplicateSourceOf:row.item==='Fuel Pump Control - Main Tank 1 Fwd'&&
     row.id==='MRG-CL-184-048'?'MRG-CL-184-047':null,
    note:'Bus power means the mapped feed has power IF the device is installed. Document QA, optional fit and physical operation are independent.'
   };
   consumers[row.id]=entry;tally[state]++;
   if(!systems[group])systems[group]={id:group,consumerIds:[],counts:{NORMAL:0,OFF:0,DEGRADED:0,UNKNOWN:0,NOT_INSTALLED:0}};
   systems[group].consumerIds.push(row.id);systems[group].counts[state]++;
  }
  // Multiple electrical rows can represent BOTH REQUIRED supplies
  // (115VAC + 28VDC electronic equipment) or alternate/dual sources.
  // Classify only the cases supported by the reference item labels.
  // Unverified alternates remain DEGRADED rather than magically fully normal.
  const deviceRows={};
  for(const entry of Object.values(consumers))
   (deviceRows[entry.name]??=[]).push(entry);
  // Multi-feed authority owns the 17 exact MRG multi-source devices.
  // Single-source device behavior and legacy API shape remain unchanged.
  const devices={};
  // Browsers load this authority as a prior ordered script. Standalone
  // CommonJS Node tests must load the *same* canonical resolver explicitly;
  // previously they failed before any source/CB assertions could run.
  const liveTopology=typeof globalThis!=='undefined'?globalThis.B737ClassicMultifeedV1:null;
  const topologyEngine=liveTopology?.resolveDevice?liveTopology:
   (typeof module==='object'&&module.exports&&typeof require==='function'
    ?require('./classic-multifeed-topology-v1.js'):null);
  if(!topologyEngine?.resolveDevice)throw Error('Multi-feed authority not loaded');
  for(const [name,entries]of Object.entries(deviceRows)){
   const specific=topologyEngine.resolveDevice(name,entries,buses);
   if(specific){
    devices[name]={name,displayName:entries[0].displayName,
     system:entries[0].system,role:entries[0].role,
     topology:specific.topology,state:specific.state,
     channels:entries.map(x=>x.id),effect:specific.effect,
     feedChannels:specific.feedChannels,capabilities:specific.capabilities,
     sourceQuality:specific.sourceQuality,
     liveFeeds:specific.liveFeeds,lostFeeds:specific.lostFeeds,
     unknownFeeds:specific.unknownFeeds};
    continue;
   }
   const applicable=entries.filter(x=>x.powerState!=='NOT_INSTALLED');
   const statuses=applicable.map(x=>x.powerState);
   const hasNormal=statuses.includes('NORMAL'),hasOff=statuses.includes('OFF');
   const hasDegraded=statuses.includes('DEGRADED'),hasUnknown=statuses.includes('UNKNOWN');
   const state=!applicable.length?'NOT_INSTALLED':
    hasDegraded||hasNormal&&hasOff?'DEGRADED':
    hasNormal?'NORMAL':hasUnknown?'UNKNOWN':'OFF';
   devices[name]={name,displayName:entries[0].displayName,
    system:entries[0].system,role:entries[0].role,
    topology:'SINGLE',state,channels:entries.map(x=>x.id),
    feedChannels:[],capabilities:{DEVICE_POWER:state==='NORMAL'?true:state==='OFF'?false:null},
    effect:state==='OFF'?consequence(entries[0].role):
     state==='DEGRADED'?'PARTIAL_POWER_OR_ALTERNATE_SUPPLY':
     state==='UNKNOWN'?'UNRESOLVED_FEED':'ELECTRIC_FUNCTION_AVAILABLE'};
  }
  for(const group of Object.values(systems)){
   const familyDevices=Object.values(devices).filter(d=>d.system===group.id&&d.state!=='NOT_INSTALLED');
   const states=familyDevices.map(d=>d.state);
   group.deviceCount=familyDevices.length;
   group.state=states.includes('DEGRADED')||states.includes('NORMAL')&&states.includes('OFF')?
    'DEGRADED':!states.length?'NOT_INSTALLED':states.every(v=>v==='NORMAL')?
    'NORMAL':states.every(v=>v==='OFF')?'OFF':'UNKNOWN';
  }
  return {schema:SCHEMA,revision:electrical.revision,mode,pressurization,aircraftModel,
   buses,consumers,devices,systems,includeAllConfigurations,coverage:{...tally,sourceRows:index.rows.length,
    logicalDevices:Object.keys(devices).length,
    activeRows:index.rows.length-tally.NOT_INSTALLED},
   assumptions:['GENERATOR_ELECTRONIC_BUS_PROXY','28VAC_TRANSFORMER_NOT_MONITORED',
    'GENERAL_MRG_NOT_AIRFRAME_WDM','CB_POWER_EFFECT_ONLY_WHEN_MAPPED'],
   sources:{FCOM:'6.20.1-12',MRG:'IV.6 printed pp.182-188',LAN:'ATA 24'},
   sourceOwner:labBusPower===null?'Electrical_V7_READ_ONLY':'ISOLATED_LAB_V7_REFERENCE_ONLY',
   labInjected:labBusPower!==null};
 }
 function lookupPump(id,electrical){
  const feed=MRG_PUMP_FEEDS[id];if(!feed)throw Error('Unknown functional pump '+id);
  const buses=defineBuses(electrical);
  const output=getBus(buses,feed.bus,feed.voltage);
  return {...feed,powered:output.sourceStatus,quality:'MRG_IV6_GENERIC_CLASSIC'};
 }
 return Object.freeze({SCHEMA,BUS_VOLTAGES,MRG_PUMP_FEEDS,CB_ITEMS,
  validate,defineBuses,getBus,appropriate,project,lookupPump,role,family});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/classic-alpha-vane-heat-v1.js?v=ATA30-ALPHA-HEAT-0001 */
try{
/* B737 Classic ATA30-31 left/right alpha-vane probe heater.
 * Lufthansa LAN ATA30: left and right heater elements are 115VAC from
 * TRANSFER BUS 1 and TRANSFER BUS 2 respectively, via PROBE HEAT A/B.
 * Annunciator electrical power is separately supplied by 28V DC indicator
 * circuits (simulator approximation: DC1 / DC2; actual P6 dim bus not modeled).
 * Main 1/2 AoA consumer rows in MRG are not a second heater element.
 * This is a functional trainer, not a wiring or dispatch authority.
 */
(function(root,factory){'use strict';
 const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ClassicAlphaVaneHeatV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const CHANNELS=Object.freeze({
  L:Object.freeze({id:'probe-l-alpha',switchId:'pitot-a',heaterBus:'transfer1',
   indicatorBus:'dc1',sensorReferenceBus:'main1',cbId:'probe.alphaL'}),
  R:Object.freeze({id:'probe-r-alpha',switchId:'pitot-b',heaterBus:'transfer2',
   indicatorBus:'dc2',sensorReferenceBus:'main2',cbId:'probe.alphaR'})
 });
 function evaluate({buses={},switches={},cbAvailable=null}={}){
  const indicators={},channels={};
  for(const [side,c]of Object.entries(CHANNELS)){
   const requested=String(switches?.[c.switchId]||'OFF').toUpperCase()==='ON';
   const heaterBusPowered=buses?.[c.heaterBus]===true;
   const heaterCbClosed=typeof cbAvailable==='function'?cbAvailable(c.cbId)!==false:true;
   const heaterPower=requested&&heaterBusPowered&&heaterCbClosed;
   const lampBusPowered=buses?.[c.indicatorBus]===true;
   // Lamp illuminates when the current transformer does not detect heater
   // current, including the switch OFF case. A dead indicator bus leaves
   // the amber face dark even while the physical heater can still work.
   const amberOn=lampBusPowered&&!heaterPower;
   channels[side]=Object.freeze({
    id:c.id,requested,heaterBus:c.heaterBus,heaterBusPowered,
    heaterCbClosed,heaterPower,heaterCurrentDetected:heaterPower,
    indicatorBus:c.indicatorBus,lampBusPowered,amberOn,
    sensorReferenceBus:c.sensorReferenceBus,
    sensorReferenceBusPowered:buses?.[c.sensorReferenceBus]===true,
    switchMechanicalOperable:true,
    failure:!heaterBusPowered?'HEATER_AC_SUPPLY_LOST':
     !heaterCbClosed?'HEATER_CB_OPEN':
     !requested?'PROBE_HEAT_SWITCH_OFF':'NONE'
   });
   indicators[c.id]=amberOn;
  }
  return Object.freeze({
   schema:'B737_CLASSIC_ALPHA_VANE_HEAT_ATA30_V1',
   channels:Object.freeze(channels),lamps:Object.freeze(indicators)
  });
 }
 return Object.freeze({CHANNELS,evaluate});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./mrg-electrical-needle-qa-unified.js?v=MRG-CL-188-B */
try{
/* B737 Classic OH10/OH11 electrical needle MRG QA inspector.
 * Standalone demonstration of physical-value/source auditing only; DO NOT
 * control any instrument's live angle until its native photo scale is certified.
 */
(function(){"use strict";
function mount(){
 const source=window.B737MrgElectricalNeedleAudit;
 const V7=window.B737ElectricalV7;
 const Consumer=window.B737MRGClassicBusConsumerAudit;
 let consumerIndex=null;
 const parent=document.getElementById("unifiedAcDcMeteringNeedles")||document.querySelector(".inspector");
 if(!source||!V7||!parent||document.getElementById("mrgClassicElectricalNeedleQA"))return;
 const section=document.createElement("section");section.id="mrgClassicElectricalNeedleQA";
 section.style.cssText="padding:14px;border:1px solid #7c8d97;border-radius:10px;margin:14px 0;background:#19242a;color:#eff3f7;max-width:580px;direction:ltr";
 const label=document.createElement("h3");label.textContent="MRG Classic · OH10 / OH11 Meter & Needle Logic QA";section.append(label);
 const pre=document.createElement("p");pre.style.fontSize="12px";pre.textContent="Reference: MRG IV.6 printed 142–143, 148, 151, 161–162. Numeric/state QA only — NO physical needle-angle or pivot correction.";
 section.append(pre);
 const meter=document.createElement("select");meter.setAttribute("aria-label","DC meter selector");
 const variant=document.createElement("select");variant.setAttribute("aria-label","Classic CPCS or DCPCS source configuration");
 for(const v of ["DCPCS","CPCS"]){const o=document.createElement("option");o.value=v;o.textContent="Generic "+v;variant.append(o);}
 for(const s of source.SELECTORS){const o=document.createElement("option");o.value=s;o.textContent=s;meter.append(o);}
 const dcVolts=document.createElement("input");dcVolts.type="number";dcVolts.step="0.1";dcVolts.placeholder="Observed DC volts";
 const dcAmps=document.createElement("input");dcAmps.type="number";dcAmps.step="0.1";dcAmps.placeholder="Observed DC amps";
 const oilTemp=document.createElement("input");oilTemp.type="number";oilTemp.step="0.1";oilTemp.placeholder="CSD oil temp °C";
 const oilPsi=document.createElement("input");oilPsi.type="number";oilPsi.step="0.1";oilPsi.placeholder="CSD oil psi";
 const fault=document.createElement("button");fault.type="button";fault.textContent="TEST TR1 FAIL (trainer only)";
 const out=document.createElement("pre");out.style.cssText="white-space:pre-wrap;font-size:12px;line-height:1.55;overflow-wrap:anywhere";
 const layout=document.createElement("div");layout.style.cssText="display:flex;gap:8px;flex-wrap:wrap;align-items:center";
 for(const input of [meter,variant,dcVolts,dcAmps,oilTemp,oilPsi,fault]){input.style.maxWidth="170px";layout.append(input);}
 section.append(layout,out);
 parent.after(section);
 let electrical=V7.initialState();
 function optionalValue(el){return el.value.trim()===""?undefined:Number(el.value);}
 function render(){
  const observed={},drive={};
  if(optionalValue(dcVolts)!==undefined)observed.dcVolts=optionalValue(dcVolts);
  if(optionalValue(dcAmps)!==undefined)observed.dcAmps=optionalValue(dcAmps);
  if(optionalValue(oilTemp)!==undefined)drive.oilTempC=optionalValue(oilTemp);
  if(optionalValue(oilPsi)!==undefined)drive.oilPressurePsi=optionalValue(oilPsi);
  const report=source.evaluate({selector:meter.value,electrical:V7.evaluate(electrical),observed,drive,
   consumerIndex,consumerAudit:Consumer,variant:variant.value});
  const fmt=field=>field.range===null?"NOT INDICATED":field.range.join("–")+" ("+field.status+")";
  const needleRefs=report.needlePowerSourceCandidates;
  const evidence=needleRefs?Object.values(needleRefs):[];
  const sourceLines=evidence.map(x=>x.needleId+": "+x.evidence.map(e=>e.feedBus+" / "+e.feedVoltage).join(", "));
  out.textContent=[
   "Selected "+report.selector+" · "+report.selectedVoltageSource,
   "V: "+fmt(report.dcBusVoltageObserved)+" | A: "+fmt(report.selectedTRAmpsObserved),
   "Bus: "+String(report.upstreamBus)+" | TR source: "+String(report.trSourceAvailable),
   "CSD oil LOW PRESS (<120 psi): "+String(report.drive?.lowOilPressure??"not measured"),
   "CSD HIGH TEMP (>157°C): "+String(report.drive?.highOilTemp??"not measured"),
   "Source flags: "+(report.qa.join("; ")||"none"),
   "GEOMETRY: BLOCKED — OH10 DC AMPS pivot (310,168 vs 310,192); CPS (715,190 vs 780,192).",
   "These readings are an isolated V7 TEST STATE, not live aircraft sensor telemetry.",
   consumerIndex?"MRG CL pp182–188: "+consumerIndex.rows.length+" bus-consumer records, "+evidence.length+" mapped needle families; 0 EP-FSI wires verified":"MRG CL bus-to-item index: loading/unavailable",
   ...sourceLines
  ].join("\n");
 }
 for(const item of [meter,variant,dcVolts,dcAmps,oilTemp,oilPsi])item.addEventListener("input",render);
 fault.addEventListener("click",()=>{
  const old=electrical.faults.TR1_FAILED;
  electrical=V7.apply(electrical,{type:"FAULT",id:"TR1_FAILED",active:!old,instructor:true});
  fault.textContent=old?"TEST TR1 FAIL (trainer only)":"CLEAR TEST TR1 FAIL";
  render();
 });
 render();
 if(Consumer&&typeof fetch==="function"){
  fetch(new URL("../../engine/systems/mrg-classic-340-consumer-bus-index-v1.json",document.baseURI))
   .then(r=>{if(!r.ok)throw Error("MRG index HTTP "+r.status);return r.json();})
   .then(data=>{Consumer.validate(data);consumerIndex=data;render();})
   .catch(e=>{console.warn("MRG generic load-table reference unavailable",e);});
 }
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",mount,{once:true});else mount();
})();
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/electrical-loads-v8.js?v=ISN-0002 */
try{
/* ATA24 electrical-to-consumer traceability bridge. No airframe wiring inferred.
   Only the FCOM-described TR incoming feeds are automatically bound.
   Private source archive references: FCOM 6.20.9 (DB 1158), 15.10.3 (DB 1880),
   2.40.1-2 (DB 1014-15), 12.10.2 (DB 1826), 13.10.1 (DB 1842).
   Educational trainer only: not a load schedule, MEL, or flight tool. */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ElectricalLoadsV8=api;})
(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
 const VERIFIED=Object.freeze([
  Object.freeze({id:'elec.TR1.input',upstream:'transfer1',source:'FCOM-SEPEHRAN-1937',pdfPage:1158,folio:'6.20.9'}),
  Object.freeze({id:'elec.TR2.input',upstream:'transfer2',source:'FCOM-SEPEHRAN-1937',pdfPage:1158,folio:'6.20.9'}),
  Object.freeze({id:'elec.TR3.input',upstream:'main2',source:'FCOM-SEPEHRAN-1937',pdfPage:1158,folio:'6.20.9'})
 ]);
 const LOADS=Object.freeze([
  ['stall.test115vac','STALL','AC115',1880,'15.10.3','115VAC needed for ground test; exact supply bus undocumented'],
  ['stall.computer1','STALL',null,1911,'15.20.7','computer channel power bus and installed feed undocumented'],
  ['stall.computer2','STALL',null,1911,'15.20.7','computer channel power bus and installed feed undocumented'],
  ['dcpcs.controller1','DCPCS',null,1015,'2.40.2','controller feed not identified'],
  ['dcpcs.controller2','DCPCS',null,1015,'2.40.2','controller feed not identified'],
  ['dcpcs.autoOutflowMotor','DCPCS','DC',1015,'2.40.2','brushless DC motor; exact bus not specified'],
  ['cpcs.autoOutflowMotor','CPCS','AC',1014,'2.40.1','AC motor; not applicable to EP-FSI DCPCS config'],
  ['cpcs.standbyOutflowMotor','CPCS','DC',1014,'2.40.1','DC motor; not applicable to EP-FSI DCPCS config'],
  ['fuel.main1FwdPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['fuel.main1AftPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['fuel.main2FwdPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['fuel.main2AftPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['fuel.centerLeftPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['fuel.centerRightPump','FUEL',null,1826,'12.10.2','pump ON function verified; supply bus not identified'],
  ['hyd.electricPumpA','HYDRAULIC',null,1842,'13.10.1','electrically powered, AC/DC class and bus not identified'],
  ['hyd.electricPumpB','HYDRAULIC',null,1842,'13.10.1','electrically powered, AC/DC class and bus not identified']
 ].map(([id,system,electricClass,page,folio,limitation])=>Object.freeze({id,system,electricClass,source:'FCOM-SEPEHRAN-1937',pdfPage:page,folio,limitation})));
 const AC_BUSES=Object.freeze(['generator1','generator2','main1','main2','transfer1','transfer2','acStandby','groundService']);
 const DC_BUSES=Object.freeze(['dc1','dc2','battery','hotBattery','switchedHotBattery','dcStandby']);
 const classes=Object.freeze({AC115:AC_BUSES,AC:AC_BUSES,DC:DC_BUSES});
 function tri(v){if(v===true||v===false||v===null)return v;throw Error('Electrical bus value must be true / false / null');}
 function electricalInput(e){if(!e||e.schema!=='B737_ELECTRICAL_V7_RESULT'||!e.bus||!e.feed?.tr)throw Error('Electrical V7 evaluated output required');return e;}
 function possibleClass(e,type){
  const names=classes[type];if(!names)return {couldBeAvailable:null,buses:[],reason:'NO_DOCUMENTED_VOLTAGE_CLASS'};
  const values=names.map(bus=>({bus,value:tri(e.bus[bus])}));
  // Global absence is the only definite conclusion; any energized source does NOT prove an LRU feed.
  const impossible=values.every(x=>x.value===false);
  return {couldBeAvailable:impossible?false:null,buses:values,reason:impossible?'ALL_POSSIBLE_CLASS_BUSES_OFF':'BUS_TO_EQUIPMENT_WIRING_NOT_VERIFIED'};
 }
 function project(electrical,{mrgIndex=null,mrgAudit=null,variant="DCPCS"}={}){const e=electricalInput(electrical);
  const upstream=Object.fromEntries(VERIFIED.map(item=>{
   const energized=tri(e.bus[item.upstream]);
   const key='TR'+item.id.match(/TR([123])/)[1];
   const enabled=Boolean(e.feed.tr[key]);
   // An upstream AC source cannot prove the TR is operating: the TR may itself fail.
   return [item.id,{...item,acBusAvailable:energized,powerConversionOperating:energized===false?false:enabled,qa:'VERIFIED_UPSTREAM_FEED_AND_FAULT_MODEL'}];
  }));
  const loads=Object.fromEntries(LOADS.map(load=>{
   const possibility=possibleClass(e,load.electricClass);
   return [load.id,{...load,assignedBus:null,powered:possibility.couldBeAvailable===false?false:null,
    status:possibility.couldBeAvailable===false?'PROVEN_GLOBAL_CLASS_POWER_LOSS':'UNVERIFIED_EQUIPMENT_FEED',
    reason:possibility.reason,provenance:'SOURCE_FUNCTION_ONLY_NO_EP_FSI_WIRING',powerBusCandidateCount:possibility.buses.length}];
  }));
  const genericClCandidateFeeds=mrgIndex&&mrgAudit?mrgAudit.v8CandidateSources(mrgIndex,e,variant):null;
  return {schema:'B737_ELECTRICAL_LOADS_V8',electricalRevision:e.revision,upstream,loads,genericClCandidateFeeds,
   classEvidence:{AC115:possibleClass(e,'AC115'),DC:possibleClass(e,'DC')},
   coverage:{verifiedUpstream:VERIFIED.length,loadsKnownBus:0,loadsPending:LOADS.length},
   qa:['EP_FSI_WIRING_SCHEDULE_NOT_IN_INDEX','NO_AUTOMATIC_LRU_POWER_TRUE','CPCS_NON_FSI_CONFIGURATION','CROSS_SYSTEM_MUTATION_BLOCKED_WHEN_FEED_UNKNOWN']};
 }
 function handoff(loadsResult){if(!loadsResult||loadsResult.schema!=='B737_ELECTRICAL_LOADS_V8')throw Error('V8 projected loads required');
  const load=(id)=>loadsResult.loads[id];
  // Downstream contracts: false only for globally demonstrated loss of a required voltage class.
  // Never turn null into false or invent which source feeds an individual device.
  const stall=load('stall.test115vac');
  return {schema:'B737_ELECTRICAL_HANDOFF_V8',
   stallGroundTest:{ac115Available:stall.powered===false?false:null,applyAutomatically:stall.powered===false,
    annotation:stall.powered===false?'GLOBAL_115VAC_UNAVAILABLE':'REQUIRES_INDEPENDENT_VERIFIED_FEED_OR_INSTRUCTOR_INPUT'},
   dcpcs:{dcPowerAvailable:null,applyAutomatically:false,annotation:'CONTROLLER_DC_BUS_NOT_VERIFIED'},
   fuelPumps:{applyAutomatically:false,annotation:'CONFIG_LOAD_BUS_IS_TRAINING_SURROGATE_NOT_VERIFIED'},
   hydraulicPumps:{applyAutomatically:false,annotation:'CONFIG_LOAD_BUS_IS_TRAINING_SURROGATE_NOT_VERIFIED'},
   policy:'DO_NOT_MODIFY_SUBSYSTEM_STATE_FROM_UNKNOWN_FEED'};
 }
 return Object.freeze({VERIFIED,LOADS,AC_BUSES,DC_BUSES,project,handoff});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/trainer/core.js?v=ISN-0002 */
try{
/* B737 Classic switch/fault/checklist trainer v0.1.
 * Pure, deterministic, offline-capable. All outputs are TRAINING-ONLY.
 * Copyright-free software implementation; no manual wording copied.
 * Provenance: Sepehran FCOM 6.10.8-9, 6.20.1-4, 12.10.1-3,
 * 13.10.1-2; Sepehran QRH 6.1-6.4; in-scope generalizations
 * and explicitly labeled surrogate equipment-to-transfer-bus mappings.
 */
(function (root, factory) {
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports) module.exports=api;
  if(root) root.B737TrainerCore=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const FUEL=['leftFwd','leftAft','rightFwd','rightAft','centerLeft','centerRight'];
  const HYD=['elecA','elecB'];
  const CONFIG=Object.freeze({
    // These downstream bus assignments are TRAINING ASSUMPTIONS, not asserted as
    // exact installed circuit wiring. Requires configuration-specific electrical load schedule.
    loadBus:Object.freeze({leftFwd:1,leftAft:1,rightFwd:2,rightAft:2,centerLeft:1,centerRight:2,elecA:2,elecB:1}),
    loadBusStatus:'TRAINING_SURROGATE_NOT_FCOM_WIRING_VERIFIED'
  });
  const FAULTS=Object.freeze(['gen1Failed','gen2Failed','apuGeneratorFailed','externalPowerFailed','transfer1Failed','transfer2Failed','elecAFailed','elecBFailed','elecAOverheat','elecBOverheat',...FUEL.map(x=>'fuel_'+x+'_Failed')]);
  const LABELS=Object.freeze({
    gen1Failed:'GEN 1 unavailable',gen2Failed:'GEN 2 unavailable',apuGeneratorFailed:'APU generator failed',externalPowerFailed:'External AC failed',
    transfer1Failed:'AC transfer bus 1 fault',transfer2Failed:'AC transfer bus 2 fault',
    elecAFailed:'Electric hydraulic pump A failed',elecBFailed:'Electric hydraulic pump B failed',
    elecAOverheat:'Hydraulic pump A overheat',elecBOverheat:'Hydraulic pump B overheat',
    leftFwd:'MAIN 1 FWD',leftAft:'MAIN 1 AFT',rightFwd:'MAIN 2 FWD',rightAft:'MAIN 2 AFT',centerLeft:'CENTER LEFT',centerRight:'CENTER RIGHT',elecA:'ELEC 2 / SYS A',elecB:'ELEC 1 / SYS B'
  });
  function clone(v){return JSON.parse(JSON.stringify(v));}
  function isKey(o,k){return Object.prototype.hasOwnProperty.call(o,k);}
  function initialState(){return {
    version:'b737-cl-trainer/1',seq:0,controls:{battery:true,busTransferAuto:true,externalAvailable:true,externalConnected:false,
      engine1Running:true,engine2Running:true,gen1Connected:true,gen2Connected:true,apuRunning:false,apuGen1Connected:false,apuGen2Connected:false,
      fuel:{leftFwd:true,leftAft:true,rightFwd:true,rightAft:true,centerLeft:false,centerRight:false},
      hyd:{elecA:true,elecB:true},
      // Engine-driven hydraulic pumps remain available even if electric motor pumps fail.
      engineHyd:{A:true,B:true}},
    faults:Object.fromEntries(FAULTS.map(f=>[f,false])),instructor:{scenario:'none'},events:[]};}
  function validBool(value){if(typeof value!=='boolean')throw new Error('Expected boolean');}
  function normalize(s){
    if(!s||s.version!=='b737-cl-trainer/1'||!s.controls||!s.faults||!Array.isArray(s.events))throw new Error('Invalid trainer state');
    return s;
  }
  function setPath(o,path,value){const p=path.split('.');let target=o;for(const part of p.slice(0,-1)){if(!target||!isKey(target,part))throw new Error('Unknown control '+path);target=target[part];}const key=p[p.length-1];if(!target||!isKey(target,key))throw new Error('Unknown control '+path);validBool(value);target[key]=value;}
  function apply(state,command){
    normalize(state);
    if(!command||typeof command.type!=='string')throw new Error('Invalid command');
    if(command.type==='RESET')return initialState();
    const next=clone(state);
    switch(command.type){
      case 'CONTROL':
        setPath(next.controls,command.path,command.value);
        // Source selection is exclusive per generator bus (FCOM 6.20.1-4).
        if(command.value===true){
          if(command.path==='apuGen1Connected'){next.controls.gen1Connected=false;next.controls.externalConnected=false;}
          if(command.path==='apuGen2Connected'){next.controls.gen2Connected=false;next.controls.externalConnected=false;}
          if(command.path==='gen1Connected'){next.controls.apuGen1Connected=false;next.controls.externalConnected=false;}
          if(command.path==='gen2Connected'){next.controls.apuGen2Connected=false;next.controls.externalConnected=false;}
          if(command.path==='externalConnected'){
            if(!next.controls.battery)throw new Error('Ground power connection requires BATTERY ON (FCOM 6.20.2)');
            next.controls.gen1Connected=false;next.controls.gen2Connected=false;
            next.controls.apuGen1Connected=false;next.controls.apuGen2Connected=false;
          }
        }
        if(command.path==='battery'&&command.value===false)next.controls.externalConnected=false;
        break;
      case 'FAULT': if(!isKey(next.faults,command.id))throw new Error('Unknown fault '+command.id);validBool(command.active);next.faults[command.id]=command.active;break;
      case 'SCENARIO': if(command.id!=='bus1'&&command.id!=='bus2'&&command.id!=='none')throw new Error('Unknown scenario');
        next.instructor.scenario=command.id;break;
      default:throw new Error('Unknown command type '+command.type);
    }
    next.seq++;
    next.events.push({seq:next.seq,command:clone(command)});
    if(next.events.length>400)next.events.shift();
    return next;
  }
  function derive(s){
    normalize(s);const c=s.controls,f=s.faults;
    const src={gen1:c.gen1Connected&&c.engine1Running&&!f.gen1Failed,
      gen2:c.gen2Connected&&c.engine2Running&&!f.gen2Failed,
      apu:c.apuRunning&&!f.apuGeneratorFailed,
      external:c.externalAvailable&&c.battery&&!f.externalPowerFailed};
    // Each AC generator bus has a single connected source. Source selection never parallels.
    // Instructor can explicitly select GND/APU/gen with switches; preferred generator for a side
    // is an original training simplification of automatic source arbitration.
    const bus=(side)=>{
      if(side===1&&src.gen1)return 'GEN 1';
      if(side===2&&src.gen2)return 'GEN 2';
      if(src.apu&&(side===1?c.apuGen1Connected:c.apuGen2Connected))return 'APU';
      if(src.external&&c.externalConnected)return 'EXTERNAL';
      return null;
    };
    const generatorBus={1:bus(1),2:bus(2)};
    const transferBus={1:Boolean((generatorBus[1]||(c.busTransferAuto&&generatorBus[2]))&&!f.transfer1Failed),
      2:Boolean((generatorBus[2]||(c.busTransferAuto&&generatorBus[1]))&&!f.transfer2Failed)};
    const mainBus={1:Boolean(generatorBus[1]),2:Boolean(generatorBus[2])};
    const acStandby=transferBus[1]||c.battery; // static inverter / battery standby simplified.
    const dc={bus1:transferBus[1],bus2:transferBus[2],battery:c.battery,standby:c.battery||transferBus[1]};
    const fuel={};
    for(const id of FUEL){const selected=c.fuel[id];const hasPower=transferBus[CONFIG.loadBus[id]];
      const operational=selected&&hasPower&&!f['fuel_'+id+'_Failed'];
      const center=id.startsWith('center');
      fuel[id]={switchOn:selected,powered:hasPower,operational,
        // FCOM 12.10.2-3: CENTER annunciates low pressure only with switch ON;
        // MAIN annunciates with switch OFF or low output pressure.
        lowPressure:center?selected&&!operational:!operational};
    }
    const hyd={};for(const id of HYD){const hasPower=transferBus[CONFIG.loadBus[id]];
      const operating=c.hyd[id]&&hasPower&&!f[id+'Failed']&&!f[id+'Overheat'];
      hyd[id]={switchOn:c.hyd[id],powered:hasPower,operating,lowPressure:!operating,overheat:f[id+'Overheat']};
    }
    const systemHyd={A:c.engineHyd.A&&c.engine1Running||hyd.elecA.operating,
      B:c.engineHyd.B&&c.engine2Running||hyd.elecB.operating};
    const fuelMainCaution=[['leftFwd','leftAft'],['rightFwd','rightAft']].some(pair=>pair.every(k=>fuel[k].lowPressure));
    const ctrFuelCaution=Object.keys(fuel).filter(k=>k.startsWith('center')).some(k=>fuel[k].lowPressure)&&
      (c.fuel.centerLeft||c.fuel.centerRight); // simplified: verifies one center low with either CTR switch active
    const indicators={
      busOff1:!mainBus[1],busOff2:!mainBus[2],transferBusOff1:!transferBus[1],transferBusOff2:!transferBus[2],
      genOffBus1:!generatorBus[1]||generatorBus[1]!=='GEN 1',genOffBus2:!generatorBus[2]||generatorBus[2]!=='GEN 2',
      groundPowerAvailable:src.external,
      masterCautionFuel:fuelMainCaution||ctrFuelCaution,
      masterCautionHyd:false, // Non-Normal/MASTER CAUTION logic NOT yet validated from FCOM
      systemAnnunciatorFuel:fuelMainCaution||ctrFuelCaution
    };
    return {sourceAvailable:src,generatorBus,transferBus,mainBus,acStandby,dc,fuel,hyd,systemHyd,indicators,
      qa:{loadRouting:CONFIG.loadBusStatus,masterCautionHyd:'NOT_MODELED',
        scope:'TRAINER_ONLY',sourceLocations:['FCOM 6.10.8-9 PDF1147-1148','FCOM 6.20.1-4 PDF1150-1153','FCOM 12.10.2-3 PDF1826-1827','FCOM 13.10.1 PDF1842']}};
  }
  function checklist(s){
    const d=derive(s),side=s.instructor.scenario==='bus2'?2:1;
    if(s.instructor.scenario==='none')return {id:'none',title:'Select a training scenario',steps:[],complete:false};
    const other=side===1?2:1;
    const stepData=[
      {id:'diagnose',title:'Identify the affected generator bus',done:d.indicators['busOff'+side],detail:'QRH condition, BUS OFF single, section 6.1; training cue'},
      {id:'isolation',title:'Confirm opposite generator bus remains available',done:Boolean(d.generatorBus[other]),detail:'Transfer bus status and source indication'},
      {id:'retry',title:'Attempt engine generator reconnect (if source healthy)',done:Boolean(d.generatorBus[side]),detail:'QRH branch: recovery can stop here; when fault persists proceed with alternate source'},
      {id:'alternate',title:'Restore affected bus using APU or external source',done:Boolean(d.generatorBus[side]),detail:'On this ground trainer, APU or external power can supply bus; route availability is simulated'},
      {id:'outcome',title:'Confirm BUS OFF extinguished and load state recalculated',done:!d.indicators['busOff'+side],detail:'Recheck fuel/hydraulic derived pump and warning states'}
    ];
    // Retry and alternate are alternative educational paths, not sequential checklist commands.
    const recovered=!d.indicators['busOff'+side];
    return {id:'bus-off-'+side,title:'BUS OFF ('+side+') — instructor-guided trainer',steps:stepData,
      complete:recovered,branch:recovered?'BUS RESTORED':'BUS STILL OFF',
      limitation:'Paraphrased training flow; not the actual QRH checklist. Original QRH 6.1-6.4 PDF 133-136.'};
  }
  function replay(commands){let s=initialState();for(const cmd of commands)s=apply(s,cmd);return s;}
  return Object.freeze({FUEL,HYD,FAULTS,LABELS,CONFIG,initialState,apply,derive,checklist,replay});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../audio/warning-engine.js?v=ISN-0002 */
try{
/* B737 Classic Audio Warning Engine — logic prototype v0.1
 * Training simulator only. Audible timbres are placeholders, not aircraft recordings.
 * Grounded in owner-provided Sepehran 737-300/400/500 FCOM Ch 15.
 * All measurements in ft/kt; thrust lever angles in approximate degrees.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.B737WarningEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const RADIO_CALLOUTS = [2500, 1000, 500, 100, 50, 40, 30, 20, 10];
  const GPWS = new Set([
    "PULL UP", "SINK RATE", "TERRAIN", "TERRAIN AHEAD",
    "CAUTION TERRAIN", "DON'T SINK", "TOO LOW GEAR",
    "TOO LOW FLAPS", "TOO LOW TERRAIN", "GLIDESLOPE",
    "WINDSHEAR", "BANK ANGLE"
  ]);
  const AUDIO = Object.freeze({
    altitude: { asset: "altitude-tone", group: "tone", priority: 35 },
    intermittentHorn: { asset: "intermittent-horn", group: "alarm", priority: 70 },
    gearHorn: { asset: "landing-gear-horn", group: "alarm", priority: 65 },
    fireBell: { asset: "fire-bell", group: "alarm", priority: 95 },
    overspeed: { asset: "overspeed-clacker", group: "alarm", priority: 82 },
    shaker: { asset: "stick-shaker", group: "alarm", priority: 86 },
    apDisconnect: { asset: "autopilot-disconnect", group: "tone", priority: 55 },
    atDisconnect: { asset: "autothrottle-disconnect", group: "tone", priority: 40 },
    gpws: { asset: "egpws-voice", group: "voice", priority: 100 },
    tcas: { asset: "tcas-voice", group: "voice", priority: 80 },
    radioAltitude: { asset: "radio-altitude-voice", group: "voice", priority: 15 },
    minimums: { asset: "minimums-voice", group: "voice", priority: 30 }
  });
  const finite = (v) => typeof v === "number" && Number.isFinite(v);
  const truth = (v) => v === true;
  const normalize = (s) => typeof s === "string" ? s.trim().toUpperCase() : "";

  class WarningEngine {
    constructor(options) {
      const opt = options || {};
      this.variant = opt.variant || "737-300";
      this.takeoffFlapMinimum = this.variant === "737-500" ? 5 : this.variant === "737-300" ? 1 : null;
      this.reset();
    }
    reset() {
      this.previous = null;
      this.cabinCutout = false;
      this.gearCutout = false;
      this.fireAcknowledged = false;
      this.altitudeDeviationArmed = false;
      this.deviationActive = false;
      this.bankTriggered = new Set();
      this.radioCalled = new Set();
    }
    cutoutCabin() { this.cabinCutout = true; }
    cutoutGear() { if (this.lastGearCutoutEligible) this.gearCutout = true; }
    acknowledgeFire() { this.fireAcknowledged = true; }

    update(input) {
      const s = { ...input };
      const p = this.previous;
      const events = [];
      const active = [];
      const lamps = {};
      const push = (id, message) => events.push({ id, message: message || id, ...AUDIO[id] });
      const flag = (id) => active.push({ id, ...AUDIO[id] });
      const gearDown = truth(s.gearDownLocked);
      const ground = truth(s.onGround);
      const flap = finite(s.flaps) ? s.flaps : 0;
      const lever1 = finite(s.thrustLever1Angle) ? s.thrustLever1Angle : 45;
      const lever2 = finite(s.thrustLever2Angle) ? s.thrustLever2Angle : 45;

      // Cabin altitude uses exactly the same audible intermittent horn as T/O configuration.
      const cabinHigh = finite(s.cabinAltitudeFt) && s.cabinAltitudeFt > 10000;
      if (!cabinHigh) this.cabinCutout = false;
      lamps.cabinAltitude = cabinHigh;

      // Takeoff configuration evaluation is only valid with actual discrete inputs.
      // 737-400 flap-minimum remains configuration-dependent until its variant documentation is verified.
      const tcfg = this.takeoffFlapMinimum !== null &&
        [s.leadingEdgeTakeoff, s.speedbrakeDown, s.parkingBrakeSet, s.stabilizerTrimTakeoff].every(v => typeof v === "boolean");
      const min = this.takeoffFlapMinimum;
      const badConfig = tcfg && (
        flap < min || flap > 15 || !s.leadingEdgeTakeoff ||
        !s.speedbrakeDown || s.parkingBrakeSet || !s.stabilizerTrimTakeoff
      );
      const takeoffConfig = ground && truth(s.takeoffThrust) && badConfig;
      lamps.takeoffConfig = takeoffConfig;
      if ((cabinHigh && !this.cabinCutout) || takeoffConfig) flag("intermittentHorn");

      // Landing gear horn from FCOM 15.20.5-6; different silencing rules by flap setting.
      let gearAlert = false;
      let cutoutEligible = false;
      if (!ground && !gearDown) {
        if (flap >= 1 && flap <= 10 && (lever1 <= 10 || lever2 <= 10)) {
          gearAlert = true; cutoutEligible = true;
        } else if (flap === 15) {
          const asymmetric = finite(s.radioAltitudeFt) && s.radioAltitudeFt < 1000 &&
            ((lever1 <= 10 && lever2 > 30) || (lever2 <= 10 && lever1 > 30));
          const bothLow = lever1 < 30 && lever2 < 30;
          gearAlert = asymmetric || bothLow;
          cutoutEligible = asymmetric && !bothLow;
        } else if (flap > 15) gearAlert = true;
      }
      if (!gearAlert || !cutoutEligible) this.gearCutout = false;
      this.lastGearCutoutEligible = cutoutEligible;
      lamps.gearUnsafe = gearAlert;
      if (gearAlert && !(cutoutEligible && this.gearCutout)) flag("gearHorn");

      // Each separate fire condition can re-arm master FIRE WARN after previous cutout.
      const fireKeys = ["engine1Fire", "engine2Fire", "apuFire", "wheelWellFire", "cargoFire"];
      const fireNow = fireKeys.filter(k => truth(s[k]));
      const fireBefore = p ? fireKeys.filter(k => truth(p[k])) : [];
      if (fireNow.some(k => !fireBefore.includes(k))) this.fireAcknowledged = false;
      if (!fireNow.length) this.fireAcknowledged = false;
      lamps.fireWarn = fireNow.length > 0 && !this.fireAcknowledged;
      if (lamps.fireWarn) flag("fireBell");
      // External APU fire horn is not mixed into cockpit sound.
      lamps.remoteApuFireHorn = truth(s.apuFire) && ground && !this.fireAcknowledged;

      // Vmo/Mmo are model/condition inputs; no guessed constants.
      const overspeed = (finite(s.iasKt) && finite(s.vmoKt) && s.iasKt > s.vmoKt) ||
        (finite(s.mach) && finite(s.mmo) && s.mach > s.mmo);
      if (overspeed) flag("overspeed");
      if (!ground && truth(s.stallWarning)) flag("shaker");

      // Altitude capture/deviation. Both alerts inhibited at flaps >= 25 or G/S capture.
      const altValid = finite(s.pressureAltitudeFt) && finite(s.selectedAltitudeFt);
      const altInhibit = flap >= 25 || truth(s.glideslopeCaptured);
      const d = altValid ? Math.abs(s.pressureAltitudeFt - s.selectedAltitudeFt) : Infinity;
      const pd = p && finite(p.pressureAltitudeFt) && finite(p.selectedAltitudeFt)
        ? Math.abs(p.pressureAltitudeFt - p.selectedAltitudeFt) : Infinity;
      const selectedChanged = !!p && s.selectedAltitudeFt !== p.selectedAltitudeFt;
      if (selectedChanged || altInhibit) {
        this.altitudeDeviationArmed = false;
        this.deviationActive = false;
      }
      if (!altInhibit && altValid) {
        if (p && !selectedChanged && pd > 900 && d <= 900 && d > 300) push("altitude", "ALTITUDE ACQUISITION");
        if (d <= 300) { this.altitudeDeviationArmed = true; this.deviationActive = false; }
        if (this.altitudeDeviationArmed && !this.deviationActive && d > 300 && d <= 900) {
          this.deviationActive = true;
          push("altitude", "ALTITUDE DEVIATION");
        }
        if (d > 900) { this.altitudeDeviationArmed = false; this.deviationActive = false; }
      }
      lamps.altitudeSteady = !altInhibit && altValid && d <= 900 && d > 300 && !this.deviationActive;
      lamps.altitudeFlashing = !altInhibit && this.deviationActive;

      // External GPWS/TCAS systems supply their evaluated alert, not invented terrain logic.
      const gpws = normalize(s.egpwsMessage);
      const tcas = normalize(s.tcasMessage);
      if (gpws && GPWS.has(gpws) && (!p || gpws !== normalize(p.egpwsMessage))) push("gpws", gpws);
      if (tcas && (!p || tcas !== normalize(p.tcasMessage))) push("tcas", tcas);
      if (p && truth(p.autopilotEngaged) && s.autopilotEngaged === false) push("apDisconnect");
      if (p && truth(p.autothrottleEngaged) && s.autothrottleEngaged === false) push("atDisconnect");

      // Altitude callouts require a prior valid sample and a downward crossing.
      const ra = s.radioAltitudeFt;
      const pra = p && p.radioAltitudeFt;
      if (!finite(ra) || !finite(pra) || ra > pra + 50 || ground) this.radioCalled.clear();
      if (truth(s.approachActive) && !ground && finite(ra) && finite(pra) && ra < pra) {
        for (const threshold of RADIO_CALLOUTS) {
          if (pra > threshold && ra <= threshold && !this.radioCalled.has(threshold)) {
            this.radioCalled.add(threshold);
            push("radioAltitude", threshold === 2500 ? "TWO THOUSAND FIVE HUNDRED" :
              threshold === 1000 ? "ONE THOUSAND" : String(threshold));
          }
        }
      }
      const dh = s.minimumsRadioFt;
      if (truth(s.approachActive) && !ground && finite(dh) && dh >= 0 && finite(ra) && finite(pra) && ra < pra) {
        if (pra > dh + 100 && ra <= dh + 100) push("minimums", "APPROACHING MINIMUMS");
        if (pra > dh && ra <= dh) push("minimums", "MINIMUMS");
      }

      const bank = Math.abs(s.bankAngleDeg || 0);
      if (bank <= 30) this.bankTriggered.clear();
      for (const n of [35, 40, 45]) {
        if (bank > n && !this.bankTriggered.has(n)) {
          this.bankTriggered.add(n);
          push("gpws", "BANK ANGLE");
        }
      }
      this.previous = s;
      return { active, events, lamps, status: { takeoffConfigEvaluated: tcfg, altitudeInhibited: altInhibit } };
    }
  }
  return { WarningEngine, AUDIO, RADIO_CALLOUTS };
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/integration/isn-electrical-pack-v1.js?v=ATA24-CONSUMER-0001&amp;cb=CB-UNIFIED-0001&amp;p8=ATA26-0003 */
try{
/* ISN Pack 01 — Electrical V7 -> Loads V8 -> Fuel/Hyd electric pump states
 * -> source-labeled warning indications. Educational/discrete only.
 * Never converts the trainer's assumed pump-to-transfer-bus map into verified
 * aircraft wiring. Source-gated mode is the default; UNKNOWN stays UNKNOWN.
 */
(function(root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737ISNElectricalPackV1 = api;
})(typeof globalThis !== 'undefined' ? globalThis : null, function() {
  'use strict';
  const SCHEMA = 'b737-isn-electrical-pack/1';
  const MODES = Object.freeze(['SOURCE_GATED', 'TRAINING_SURROGATE']);
  const PUMP_REGISTRY = Object.freeze([
    ['fuel.main1FwdPump', 'leftFwd', 'FUEL', 'MAIN 1 FWD', 'MAIN'],
    ['fuel.main1AftPump', 'leftAft', 'FUEL', 'MAIN 1 AFT', 'MAIN'],
    ['fuel.main2FwdPump', 'rightFwd', 'FUEL', 'MAIN 2 FWD', 'MAIN'],
    ['fuel.main2AftPump', 'rightAft', 'FUEL', 'MAIN 2 AFT', 'MAIN'],
    ['fuel.centerLeftPump', 'centerLeft', 'FUEL', 'CENTER LEFT', 'CENTER'],
    ['fuel.centerRightPump', 'centerRight', 'FUEL', 'CENTER RIGHT', 'CENTER'],
    ['hyd.electricPumpA', 'elecA', 'HYDRAULIC', 'HYD ELEC A', 'ELECTRIC'],
    ['hyd.electricPumpB', 'elecB', 'HYDRAULIC', 'HYD ELEC B', 'ELECTRIC']
  ].map(([id, legacyId, system, label, group]) => Object.freeze({id, legacyId, system, label, group,
    source: 'FCOM-SEPEHRAN-1937', pdfPage: system === 'FUEL' ? 1826 : 1842,
    folio: system === 'FUEL' ? '12.10.2-3' : '13.10.1'})));
  const BY_ID = Object.freeze(Object.fromEntries(PUMP_REGISTRY.map(entry => [entry.id, entry])));
  const copy = value => JSON.parse(JSON.stringify(value));
  const tri = value => value === true || value === false || value === null;
  function tAnd(values) { if (values.includes(false)) return false; if (values.includes(null)) return null; return true; }
  function tOr(values) { if (values.includes(true)) return true; if (values.includes(null)) return null; return false; }
  function pressureWarning(pump, operating) {
    if (pump.group === 'CENTER' && !pump.switchOn) return false;
    if ((pump.group === 'MAIN' || pump.group === 'ELECTRIC') && !pump.switchOn) return true;
    return operating === null ? null : !operating;
  }
  function warningInputs() { return {
    onGround: true, flaps: 5, gearDownLocked: true, leadingEdgeTakeoff: true,
    speedbrakeDown: true, parkingBrakeSet: false, stabilizerTrimTakeoff: true,
    takeoffThrust: false, thrustLever1Angle: 45, thrustLever2Angle: 45,
    cabinAltitudeFt: 0, engine1Fire: false, engine2Fire: false, apuFire: false, wheelWellFire: false
  }; }
  const SENSOR_FIELDS = Object.freeze({onGround: 'boolean', cabinAltitudeFt: 'number',
    engine1Fire: 'boolean', engine2Fire: 'boolean', apuFire: 'boolean', wheelWellFire:'boolean'});

  class Session {
    constructor({Electrical, Loads, TrainerCore, WarningEngine} = {}) {
      if (!Electrical?.initialState || !Electrical?.apply || !Electrical?.evaluate ||
          !Loads?.project || !TrainerCore?.CONFIG?.loadBus || !TrainerCore?.FUEL || !TrainerCore?.HYD ||
          typeof WarningEngine !== 'function') throw Error('Electrical V7, Loads V8, Trainer Core and WarningEngine required');
      this.Electrical = Electrical;
      this.Loads = Loads;
      this.TrainerCore = TrainerCore;
      this.WarningEngine = WarningEngine;
      this.reset();
    }
    reset() {
      const previousBattery=this.electricalState?.battery;
      this.mode = 'SOURCE_GATED';
      // Unified/ISN must boot from a physically unpowered aircraft.
      // Preserve the V7 legacy bench default only for isolated old tests.
      this.electricalState = this.Electrical.initialState({coldDark:true});
      // Resetting switches/scenarios must not refill the installed battery.
      if(this.batteryEngine)this.electricalState.battery=previousBattery||this.batteryEngine.initial();
      this.pumps = Object.fromEntries(PUMP_REGISTRY.map(p => [p.id, {switchOn: false, failed: false, overheat: false, observedPower: null}]));
      this.sensors = warningInputs();
      // 737-400 suppresses an unverified takeoff-flap threshold; fire and cabin
      // alerts have separate, source-located behavior in the existing engine.
      this.warningEngine = new this.WarningEngine({variant: '737-400'});
      this.seq = 0;
      this.events = [];
      this.snapshot = this.compute(null);
      return this.get();
    }
    attachBattery(Battery,restored=null) {
      if(!Battery?.initial||!Battery?.step||!Battery?.snapshot)throw Error('Battery dynamics engine required');
      if(this.batteryEngine)return this.getBattery();
      const state=Battery.step(restored||Battery.initial(),0);
      this.batteryEngine=Battery;this.electricalState.battery=state;this.electricalState.rev++;
      this.snapshot=this.compute(null);return this.getBattery();
    }
    advanceBattery(dtSec,inputs) {
      if(!this.batteryEngine)throw Error('Live battery not attached');
      const next=this.batteryEngine.step(this.electricalState.battery,dtSec,inputs);
      this.electricalState={...this.electricalState,battery:next,rev:this.electricalState.rev+1};
      this.snapshot=this.compute(null);return this.getBattery();
    }
    // Instructor convenience: refill the installed battery without changing
    // its identity, historical consumption, switches or electrical faults.
    rechargeBattery() {
      if(!this.batteryEngine)throw Error('Live battery not attached');
      const previous=this.electricalState.battery;
      const next=this.batteryEngine.step({
        ...previous,chargeAh:previous.capacityAh,depleted:false
      },0);
      this.electricalState={...this.electricalState,battery:next,rev:this.electricalState.rev+1};
      this.snapshot=this.compute(null);
      return this.getBattery();
    }
    getBattery(){return this.batteryEngine?this.batteryEngine.snapshot(this.electricalState.battery):null;}
    send(command) {
      if (!command || typeof command.type !== 'string') throw Error('ISN command required');
      if (command.type === 'RESET') return this.reset();
      if (command.type === 'ELECTRICAL') {
        this.electricalState = this.Electrical.apply(this.electricalState, command.action);
      } else if (command.type === 'MODE') {
        if (!MODES.includes(command.value) || command.instructor !== true) throw Error('Explicit instructor mode selection required');
        this.mode = command.value;
      } else if (['PUMP_SWITCH', 'PUMP_FAULT', 'PUMP_OVERHEAT', 'OBSERVED_POWER'].includes(command.type)) {
        const pump = this.pumps[command.id];
        if (!pump || !tri(command.value)) throw Error('Unknown pump or invalid three-valued input');
        if (command.type === 'PUMP_SWITCH') {
          if (typeof command.value !== 'boolean') throw Error('Pump switch requires boolean');
          pump.switchOn = command.value;
        } else if (command.type === 'OBSERVED_POWER') {
          if (command.instructor !== true) throw Error('Observed pump power is an instructor/sensor input');
          pump.observedPower = command.value;
        } else {
          if (typeof command.value !== 'boolean' || command.instructor !== true) throw Error('Instructor-only pump failure/overheat');
          if (command.type === 'PUMP_FAULT') pump.failed = command.value;
          else {
            if (!command.id.startsWith('hyd.')) throw Error('Overheat training input is only defined for hydraulic electric pumps');
            pump.overheat = command.value;
          }
        }
      } else if (command.type === 'WARNING_SENSOR') {
        const kind = SENSOR_FIELDS[command.key];
        if (!kind || typeof command.value !== kind || (kind === 'number' && !Number.isFinite(command.value))) throw Error('Unrecognized warning sensor');
        this.sensors[command.key] = command.value;
      } else if (command.type === 'CUTOUT_CABIN') {
        this.warningEngine.cutoutCabin();
      } else if (command.type === 'ACK_FIRE') {
        this.warningEngine.acknowledgeFire();
      } else throw Error('Unknown ISN command ' + command.type);

      this.seq++;
      const previous = this.snapshot;
      this.snapshot = this.compute(command);
      const changes = this.diff(previous, this.snapshot);
      this.events.push({seq: this.seq, command: copy(command), changes});
      if (this.events.length > 250) this.events.shift();
      return this.get();
    }
    compute(command) {
      const electrical = this.Electrical.evaluate(this.electricalState);
      const loads = this.Loads.project(electrical);
      const pumps = {};
      for (const spec of PUMP_REGISTRY) {
        const input = this.pumps[spec.id];
        const projected = loads.loads[spec.id];
        let power = projected.powered;
        let powerEvidence = projected.powered === false ? 'GLOBAL_CLASS_POWER_ABSENT' : 'UNKNOWN_EQUIPMENT_FEED';
        let sourceBus = null;
        if (this.mode === 'TRAINING_SURROGATE') {
          sourceBus = 'transfer' + this.TrainerCore.CONFIG.loadBus[spec.legacyId];
          power = electrical.bus[sourceBus];
          powerEvidence = 'TRAINING_SURROGATE_UNVERIFIED_BUS_ASSIGNMENT';
        } else if (projected.powered !== false && input.observedPower !== null) {
          // Independent live observation/instructor test overrides the generic
          // reference feed, but never conjures global AC power from nothing.
          power = input.observedPower;
          powerEvidence = 'INDEPENDENT_INSTRUCTOR_SENSOR';
        } else if (this.mode === 'SOURCE_GATED' &&
                   globalThis.B737ClassicBusConsumersV1?.lookupPump) {
          // Functional wiring selection from Classic MRG IV.6. The
          // single Pack and Electrical V7 are still the ONLY plant owners.
          // This is enabled in Unified; standalone older isolated benches
          // retain UNKNOWN until the MRG functional engine is installed.
          const reference = globalThis.B737ClassicBusConsumersV1.lookupPump(spec.id,electrical);
          sourceBus = reference.bus;
          power = reference.powered;
          powerEvidence = 'MRG_IV6_CLASSIC_FUNCTIONAL_BUS';
        }
        power=globalThis.B737UnifiedCB?.gate(spec.id,power)??power;
        let operating = !input.switchOn || input.failed || input.overheat ? false : power;
        if (input.switchOn && !input.failed && !input.overheat && power === true) operating = true;
        const lowPressure = pressureWarning({...spec, ...input}, operating);
        pumps[spec.id] = {...spec, ...input, powered: power, operating, lowPressure,
          sourceBus, powerEvidence, powerQuality: this.mode === 'TRAINING_SURROGATE' ? 'EDUCATIONAL_ASSUMPTION' :
            input.observedPower !== null ? 'OBSERVED_NOT_BUS_VERIFIED' :
            powerEvidence === 'MRG_IV6_CLASSIC_FUNCTIONAL_BUS' ?
            'MRG_CLASSIC_GENERIC_FUNCTIONAL' : 'UNRESOLVED',
          qa: 'TRAINER_DISCRETE_INDICATION_NOT_MEASURED_PRESSURE'};
      }
      const low = id => pumps[id].lowPressure;
      const main1 = tAnd([low('fuel.main1FwdPump'), low('fuel.main1AftPump')]);
      const main2 = tAnd([low('fuel.main2FwdPump'), low('fuel.main2AftPump')]);
      const center = tOr(['fuel.centerLeftPump', 'fuel.centerRightPump']
        .filter(id => pumps[id].switchOn).map(low));
      const fuelCautionCandidate = tOr([main1, main2, center]);
      const warning = this.warningEngine.update(this.sensors);
      return {schema: SCHEMA, seq: this.seq, mode: this.mode, electrical, loads, pumps,
        warnings: {
          fuelSystemAnnunciatorCandidate: fuelCautionCandidate,
          masterCautionFuelCandidate: fuelCautionCandidate,
          masterCautionHyd: null,
          lowPressureLights: Object.fromEntries(PUMP_REGISTRY.map(p => [p.id, pumps[p.id].lowPressure])),
          audio: {active: warning.active, events: warning.events, lamps: warning.lamps},
          qa: {fuelCaution: 'TRAINER_CORE_CANDIDATE_NOT_SOURCE_APPROVED_MASTER_CAUTION',
            hydraulicMasterCaution: 'NOT_MODELED', fuelHydAuralWarning: 'NOT_DOCUMENTED_NOT_SYNTHESIZED'}
        },
        sensors: {...this.sensors},
        limitations: ['NO_FUEL_HYD_INSTALLED_BUS_MAP', 'UNKNOWN_IS_NOT_FALSE',
          'NO_SYNTHETIC_FUEL_HYD_AURAL_ALARM', 'NO_MEASURED_PRESSURE_OR_FLOW_PHYSICS',
          'TRAINING_SURROGATE_NEVER_PROMOTED_TO_VERIFIED']};
    }
    diff(before, after) {
      if (!before) return [];
      const changes = [];
      const check = (path, oldValue, newValue, evidence) => {
        if (oldValue !== newValue) changes.push({path, from: oldValue, to: newValue, evidence});
      };
      for (const [bus, state] of Object.entries(after.electrical.bus)) {
        check('elec.bus.' + bus, before.electrical.bus[bus], state, 'ELECTRICAL_V7_SOURCE_LOCATED');
      }
      for (const [id, pump] of Object.entries(after.pumps)) {
        for (const key of ['switchOn', 'powered', 'operating', 'lowPressure']) {
          check(id + '.' + key, before.pumps[id][key], pump[key], pump.powerEvidence);
        }
      }
      check('warnings.masterCautionFuelCandidate', before.warnings.masterCautionFuelCandidate,
        after.warnings.masterCautionFuelCandidate, 'TRAINER_CANDIDATE');
      for (const kind of ['fireBell', 'intermittentHorn']) {
        const old = before.warnings.audio.active.some(a => a.id === kind);
        const now = after.warnings.audio.active.some(a => a.id === kind);
        check('warnings.audio.' + kind, old, now, 'WARNING_ENGINE');
      }
      return changes;
    }
    // Live consumers share a detached, deeply immutable snapshot. Diagnostic
    // get()/send() contracts retain their complete, independently mutable history.
    refreshCircuits() {
      const revision=globalThis.B737UnifiedCB?.revision;
      if(revision!==undefined&&revision!==this.cbRevision){this.cbRevision=revision;this.snapshot=this.compute(null);}
    }
    getLive() {
      this.refreshCircuits();
      if (this.liveSource !== this.snapshot) {
        const freeze = value => {
          if (value && typeof value === 'object' && !Object.isFrozen(value)) {
            for (const child of Object.values(value)) freeze(child);
            Object.freeze(value);
          }
          return value;
        };
        const live = copy(this.snapshot);
        if (live.network) delete live.network.recentEvents;
        this.liveSnapshot = freeze(live);
        this.liveSource = this.snapshot;
      }
      return this.liveSnapshot;
    }
    get() { this.refreshCircuits();return {...copy(this.snapshot), recentEvents: copy(this.events)}; }
    replay(commands) { this.reset(); for (const action of commands) this.send(action); return this.get(); }
  }
  return Object.freeze({SCHEMA, MODES, PUMP_REGISTRY, tAnd, tOr, Session});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/integration/isn-cockpit-bridge-v1.js?v=ELEC-LIVE-0001 */
try{
/* ISN-02: evidence-gated control/annunciator bridge for the Unified cockpit.
 * Registry IDs are exact existing interactive-overhead identifiers. This does
 * not modify the approved overhead artwork, create wires or prove LRU feeders.
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ISNCockpitBridgeV1=api;})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const PUMPS=Object.freeze({
  'fuel-center-l':'fuel.centerLeftPump',
  'fuel-center-r':'fuel.centerRightPump',
  'fuel-1-aft':'fuel.main1AftPump',
  'fuel-1-fwd':'fuel.main1FwdPump',
  'fuel-2-fwd':'fuel.main2FwdPump',
  'fuel-2-aft':'fuel.main2AftPump',
  // Existing TrainerCore names elecA = ELEC 2 / SYS A and elecB = ELEC 1 / SYS B.
  // This names the UI connection; it does not certify aircraft feeder wiring.
  'hyd-elec-2':'hyd.electricPumpA',
  'hyd-elec-1':'hyd.electricPumpB'
 });
 const LAMPS=Object.freeze(Object.fromEntries(Object.entries(PUMPS).map(([lamp,pump])=>[pump,lamp])));
 const ELECTRICAL_LAMPS=Object.freeze({
  'busOff1':'busOff1','busOff2':'busOff2',
  'transferBusOff1':'transferBusOff1','transferBusOff2':'transferBusOff2',
  'genOffBus1':'gen-off-bus-1','genOffBus2':'gen-off-bus-2',
  'groundPowerAvailable':'ground-power-available','standbyPowerOff':'standby-power-off'
 });
 const GUARDED=Object.freeze({'battery-master':'batterySwitch','standby-power':'standbySelector','bus-transfer':'busTransferAuto',
  'generator-disconnect-1':'GEN1_FAILED','generator-disconnect-2':'GEN2_FAILED'});
 const SCENARIO=Object.freeze(['engine1Running','engine2Running','apuRunning','groundPowerAttached','onGround']);
 const copy=v=>JSON.parse(JSON.stringify(v));
 const own=(v,k)=>v!==null&&typeof v==='object'&&Object.prototype.hasOwnProperty.call(v,k);
 function projectLamps(state){
  const lamps={};
  for(const [pump,light] of Object.entries(LAMPS))lamps[light]=state.pumps[pump].lowPressure;
  for(const [key,light] of Object.entries(ELECTRICAL_LAMPS))lamps[light]=state.electrical.lamps[key];
  lamps['hyd-elec-2-overheat']=state.pumps['hyd.electricPumpA'].overheat;
  lamps['hyd-elec-1-overheat']=state.pumps['hyd.electricPumpB'].overheat;
  return lamps;
 }
 class Bridge{
  constructor(session,{sourceOwner='LEGACY_SCENARIO'}={}){if(!session?.send||!session?.get)throw Error('ISN-01 session required');
   if(!['LEGACY_SCENARIO','ISN03_START_SESSION'].includes(sourceOwner))throw Error('Invalid source state owner');
   this.sourceOwner=sourceOwner;this.session=session;this.snapshot=null;this.inputs={toggles:{},guards:{},rotaries:{},context:{}};this.initialized=false;this.rejected=[];this.rejectedTotal=0;}
  send(command){try{return this.session.send(command);}catch(error){this.rejectedTotal++;this.rejected.push({command:copy(command),reason:error.message});if(this.rejected.length>30)this.rejected.shift();return this.session.get();}}
  electrical(action){this.send({type:'ELECTRICAL',action});}
  control(id,next){
   if(own(PUMPS,id)){
    if(next==='ON'||next==='OFF')this.send({type:'PUMP_SWITCH',id:PUMPS[id],value:next==='ON'});
   }else if(id==='battery-master'){
    // ISN03_START_SESSION has the physical ECU/Chain as sole live battery writer.
    // Bridge follows the same pack instance and must never send it twice.
    if(this.sourceOwner==='LEGACY_SCENARIO'&&(next==='on'||next==='off'))
     this.electrical({type:'CONTROL',key:'batterySwitch',value:next==='on'});
   }else if(id==='bus-transfer'){
    if(next==='auto'||next==='off')this.electrical({type:'CONTROL',key:'busTransferAuto',value:next==='auto'});
   }else if(id==='standby-power'){
    if(['auto','off','bat'].includes(next))this.electrical({type:'CONTROL',key:'standbySelector',value:next.toUpperCase()});
   }else if(/^generator-disconnect-[12]$/.test(id)){
    if(['normal','disconnect'].includes(next))this.electrical({type:'FAULT',id:'GEN'+id.at(-1)+'_FAILED',active:next==='disconnect',instructor:true});
   }else if(/^gen-[12]$/.test(id)||/^apu-gen-[12]$/.test(id)){
    // Momentary ON/OFF commands matter; NEUTRAL must NOT erase the selected source.
    const side=Number(id.at(-1)),source=id.startsWith('apu')?'APU':'GEN'+side;
    if(next==='ON')this.electrical({type:'SELECT_SOURCE',side,source});
    if(next==='OFF'){
     const current=this.session.electricalState.source[side];
     if(current===source)this.electrical({type:'SELECT_SOURCE',side,source:'OFF'});
    }
   }else if(id==='ground-power'){
    if(next==='ON')this.electrical({type:'SELECT_SOURCE',side:1,source:'EXT'});
    else if(next==='OFF')for(const side of [1,2]){
     if(this.session.electricalState.source[side]==='EXT')this.electrical({type:'SELECT_SOURCE',side,source:'OFF'});
    }
   }
  }
  synchronize(packet){
   if(!packet||typeof packet!=='object'||!packet.toggles||!packet.guards||!packet.context)throw Error('Overhead controls snapshot required');
   const next={toggles:packet.toggles,guards:packet.guards,rotaries:packet.rotaries||{},context:packet.context};
   // Apply upstream scenarios before source-selector requests.
   for(const key of SCENARIO)if(typeof next.context[key]==='boolean'&&next.context[key]!==this.inputs.context[key]){
    if(this.sourceOwner==='ISN03_START_SESSION'&&['engine1Running','engine2Running','apuRunning'].includes(key))continue;
    this.electrical({type:'CONTROL',key,value:next.context[key]});
    if(key==='onGround')this.send({type:'WARNING_SENSOR',key:'onGround',value:next.context[key]});
   }
   const guardIds=['battery-master','standby-power','generator-disconnect-1','generator-disconnect-2','bus-transfer'];
   for(const id of guardIds){const value=next.guards[id]?.value,previous=this.inputs.guards[id]?.value;if(value!==undefined&&value!==previous)this.control(id,value);}
   // Binary toggles are level signals, not inferred power sources.
   for(const id of Object.keys(PUMPS))if(own(next.toggles,id)&&next.toggles[id]!==this.inputs.toggles[id])this.control(id,next.toggles[id]);
   // If loaded from browser storage with latched ON/OFF, reconcile that source
   // once. For a subsequent rapid pulse, handleEvent catches the detent.
   for(const id of ['gen-1','gen-2','apu-gen-1','apu-gen-2','ground-power']){
    if(own(next.toggles,id)&&next.toggles[id]!==this.inputs.toggles[id])this.control(id,next.toggles[id]);
   }
   this.inputs=copy(next);this.initialized=true;this.snapshot=this.session.get();return this.get();
  }
  handleEvent(event){
   if(!this.initialized||!event||typeof event.id!=='string')return this.get();
   const id=event.id,next=event.kind==='guarded'?event.next?.value:event.next;
   if(typeof next!=='string')return this.get();
   const kind=event.kind==='guarded'?'guards':'toggles';
   if(event.kind==='rotary')return this.get();
   const previous=kind==='guards'?this.inputs.guards[id]?.value:this.inputs.toggles[id];
   if(previous===next)return this.get();
   if(kind==='guards')this.inputs.guards[id]=copy(event.next);
   else this.inputs.toggles[id]=next;
   this.control(id,next);
   this.snapshot=this.session.get();return this.get();
  }
  instructor(command){this.send(command);this.snapshot=this.session.get();return this.get();}
  replay(){const commands=this.session.events.map(e=>copy(e.command));this.session.replay(commands);this.snapshot=this.session.get();return this.get();}
  reset(){this.session.reset();this.initialized=false;const last=copy(this.inputs);this.inputs={toggles:{},guards:{},rotaries:{},context:{}};this.rejected=[];this.rejectedTotal=0;return this.synchronize(last);}
  get(){const state=this.session.get();return {state,lamps:projectLamps(state),initialized:this.initialized,
   rejected:copy(this.rejected),rejectedTotal:this.rejectedTotal,inputs:copy(this.inputs),coverage:{pumpControls:Object.keys(PUMPS).length,pumpLamps:Object.keys(LAMPS).length,electricalLamps:Object.keys(ELECTRICAL_LAMPS).length,busTransferPhysicalControl:false,busTransferPreviewControl:true}};}
 }
 return Object.freeze({PUMPS,LAMPS,ELECTRICAL_LAMPS,GUARDED,SCENARIO,projectLamps,Bridge});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
