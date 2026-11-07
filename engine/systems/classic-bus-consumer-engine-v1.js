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
 function family(item){for(const [id,pattern]of FAMILY)if(pattern.test(item))return id;return 'OTHER';}
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
   switchedHotBattery:'28VDC',acStandby:'115VAC',dcStandby:'28VDC',groundService:'115VAC'
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
  add('standby@115VAC','115VAC',raw.acStandby??null,['acStandby@115VAC']);
  add('standby@28VDC','28VDC',raw.dcStandby??null,['dcStandby@28VDC']);
  // Canonical explicit names for the standby source variants.
  add('acStandby@115VAC','115VAC',raw.acStandby??null,
   [],'FCOM_STANDBY_SWITCH');
  add('dcStandby@28VDC','28VDC',raw.dcStandby??null,
   [],'FCOM_STANDBY_SWITCH');
  return all;
 }
 function getBus(buses,source,voltage){
  const parts=source.split('|');
  const values=parts.map(part=>{
   const key=part+'@'+voltage;
   return buses[key]||{id:key,voltage,powered:null,status:'UNKNOWN',parents:[],
    basis:'BUS_OR_CONVERTER_NOT_MODELLED'};
  });
  const live=values.filter(x=>x.powered===true).length;
  const lost=values.filter(x=>x.powered===false).length;
  const state=parts.length===1?values[0].powered:
   lost===parts.length?false:live===parts.length?true:live>0?'DEGRADED':null;
  return {busIds:values.map(x=>x.id),sourceStatus:state,inputs:values,
   powerStatus:state===true?'NORMAL':state===false?'OFF':state==='DEGRADED'?'DEGRADED':'UNKNOWN',
   basis:values.map(x=>x.basis)};
 }
 function appropriate(row,{mode,pressurization}){
  if(row.applicability==='DCPCS'&&pressurization!=='DCPCS')return false;
  if(row.applicability==='CPCS'&&pressurization!=='CPCS')return false;
  if(/non.EIS/i.test(row.item)&&mode==='EIS')return false;
  if(/\(EIS\)/i.test(row.item)&&mode==='CONVENTIONAL')return false;
  return true;
 }
 function project({index,electrical,electricalState=null,mode='CONVENTIONAL',
  pressurization='CPCS',cbAvailable=null}={}){
  validate(index);
  if(!['EIS','CONVENTIONAL'].includes(mode)||!['CPCS','DCPCS'].includes(pressurization))
   throw Error('Invalid B737 Classic aircraft configuration');
  // Fail loudly if the 8 functional pump associations drift away from the
  // exact consumer labels and feed buses in the committed MRG reference.
  for(const [id,feed]of Object.entries(MRG_PUMP_FEEDS)){
   if(!index.rows.some(r=>r.item===feed.item&&r.feedBus===feed.bus&&r.feedVoltage===feed.voltage))
    throw Error('MRG functional pump source conflict: '+id);
  }
  const buses=defineBuses(electrical,{electricalState}),consumers={},systems={};
  const tally={NORMAL:0,OFF:0,DEGRADED:0,UNKNOWN:0,NOT_INSTALLED:0};
  for(const row of index.rows){
   const installed=appropriate(row,{mode,pressurization});
   const feed=getBus(buses,row.feedBus,row.feedVoltage);
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
   const quality=row.sourceConfidence==='PRINTED_INDEX_READABLE'?
    'MRG_CLASSIC_FUNCTIONAL':'MRG_SOURCE_REVIEW_PENDING';
   // Unknown or photograph-review feeds must not be represented as reliable ON.
   if(installed&&quality!=='MRG_CLASSIC_FUNCTIONAL'&&state==='NORMAL')state='UNKNOWN';
   const type=role(row.item),group=family(row.item);
   const entry={
    id:row.id,name:row.item,system:group,role:type,
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
    activeCommand:'NOT_OBSERVED',quality,
    note:'Bus state models electrical availability; actual command, sensor, and mechanical operation are independently owned.'
   };
   consumers[row.id]=entry;tally[state]++;
   if(!systems[group])systems[group]={id:group,consumerIds:[],counts:{NORMAL:0,OFF:0,DEGRADED:0,UNKNOWN:0,NOT_INSTALLED:0}};
   systems[group].consumerIds.push(row.id);systems[group].counts[state]++;
  }
  for(const group of Object.values(systems)){
   const c=group.counts,total=c.NORMAL+c.OFF+c.DEGRADED+c.UNKNOWN;
   group.state=c.DEGRADED>0||c.NORMAL>0&&c.OFF>0?'DEGRADED':
    total===0?'NOT_INSTALLED':c.NORMAL===total?'NORMAL':c.OFF===total?'OFF':'UNKNOWN';
  }
  return {schema:SCHEMA,revision:electrical.revision,mode,pressurization,
   buses,consumers,systems,coverage:{...tally,sourceRows:index.rows.length,
    activeRows:index.rows.length-tally.NOT_INSTALLED},
   assumptions:['GENERATOR_ELECTRONIC_BUS_PROXY','28VAC_TRANSFORMER_NOT_MONITORED',
    'GENERAL_MRG_NOT_AIRFRAME_WDM','CB_POWER_EFFECT_ONLY_WHEN_MAPPED'],
   sources:{FCOM:'6.20.1-12',MRG:'IV.6 printed pp.182-188',LAN:'ATA 24'},
   sourceOwner:'Electrical_V7_READ_ONLY'};
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
