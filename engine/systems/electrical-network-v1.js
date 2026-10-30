/* Classic ATA24 live distribution projection. The existing ECU Electrical Pack
 * remains the ONLY state owner. No second source selector or electrical session.
 * FCOM private DB: 6.20.1-4, 6.20.9-12; controls 6.10.7. No manual text/assets.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ElectricalNetworkV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='ELEC-LIVE-0001';
 const BUS_IDS=Object.freeze({generator1:'GENERATOR_BUS_1',generator2:'GENERATOR_BUS_2',
  main1:'MAIN_1',main2:'MAIN_2',transfer1:'TRANSFER_1',transfer2:'TRANSFER_2',
  dc1:'DC_1',dc2:'DC_2',battery:'BATTERY_BUS',hotBattery:'HOT_BATTERY_BUS',
  switchedHotBattery:'SWITCHED_HOT_BATTERY_BUS',acStandby:'AC_STANDBY',
  dcStandby:'DC_STANDBY',groundService:'GROUND_SERVICE'});
 const copy=v=>JSON.parse(JSON.stringify(v));
 const tri=v=>v===true||v===false||v===null;
 const status=v=>v===null?'UNKNOWN':v?'ENERGIZED':'DEENERGIZED';
 function project(state,electrical,{numericMode='NOMINAL_MODEL',measurements={}}={}){
  if(state?.schema!=='b737-electrical/7'||electrical?.schema!=='B737_ELECTRICAL_V7_RESULT'||
   state.rev!==electrical.revision)throw Error('Matching shared Electrical Pack state/result required');
  if(!['NOMINAL_MODEL','SENSOR_ONLY'].includes(numericMode))throw Error('Invalid numeric mode');
  if(!measurements||typeof measurements!=='object'||Array.isArray(measurements))throw Error('Invalid measurements');
  const c=state.config,f=state.faults,e=electrical,nodes={},edges=[];
  function node(id,kind,powered,feeds=[],nominal=null,reason=null){
   if(!tri(powered))throw Error('Invalid electrical power status');
   const n={id,kind,powered,status:status(powered),feeds:[...feeds],volts:null,hz:null,amps:null,
    numericQuality:'UNAVAILABLE',reason};
   if(powered===false){n.volts=0;if(kind==='AC')n.hz=0;n.numericQuality='DEENERGIZED_MODEL';}
   else if(powered===true&&numericMode==='NOMINAL_MODEL'&&nominal){
    n.volts=nominal.volts;n.hz=kind==='AC'?nominal.hz:null;n.numericQuality='NOMINAL_MODEL';
   }
   const sample=measurements[id];
   if(sample!==undefined){
    if(!sample||typeof sample!=='object'||Array.isArray(sample))throw Error('Invalid sensor '+id);
    for(const [key,value]of Object.entries(sample)){
     if(!['volts','hz','amps'].includes(key)||value!==null&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('Invalid sensor value');
     if(key!=='amps'&&value!==null&&value<0)throw Error('Negative voltage/frequency');
     if(key==='hz'&&kind!=='AC'&&value!==null)throw Error('DC node has no frequency');
    }
    if(powered===true){Object.assign(n,sample);n.numericQuality='SENSOR_INPUT';}
   }
   nodes[id]=n;return n;
  }
  function edge(from,to,closed,role='FEED'){
   edges.push({id:from+'>'+to,from,to,closed,role});
  }
  const connected=id=>[1,2].filter(side=>e.source[side]===id);
  const readiness={GEN1:c.engine1Running&&!f.GEN1_FAILED,GEN2:c.engine2Running&&!f.GEN2_FAILED,
   APU:c.apuRunning&&!f.APU_FAILED&&!e.apuAutomaticShutdownRequested,
   EXT:c.onGround&&c.groundPowerAttached&&c.groundPowerQualityGood,BATTERY:!f.BATTERY_DEPLETED};
  for(const id of ['GEN1','GEN2','APU','EXT']){
   const sides=connected(id),available=Boolean(readiness[id]);
   // A spinning, disconnected generator is NOT proof of rated field voltage.
   const powered=!available?false:id==='EXT'||sides.length>0?true:null;
   node(id,'AC',powered,[],{volts:115,hz:400},powered===null?'DISCONNECTED_GENERATOR_FIELD_UNVERIFIED':null);
   Object.assign(nodes[id],{available,connectedBusSides:sides});
  }
  node('BATTERY','DC',readiness.BATTERY,[],{volts:24});
  Object.assign(nodes.BATTERY,{available:readiness.BATTERY,capacityAh:null,stateOfCharge:null,
   reason:'NOMINAL_24V_NO_DISCHARGE_OR_CHARGE_CHEMISTRY_YET'});
  function acBus(id,powered,feeds,reason=null){
   const parent=feeds.length?nodes[feeds[0]]:null;
   return node(id,'AC',powered,feeds,parent?{volts:parent.volts,hz:parent.hz}:null,reason);
  }
  for(const side of [1,2]){
   const id='GENERATOR_BUS_'+side,source=e.source[side];
   for(const s of side===1?['GEN1','APU','EXT']:['GEN2','APU','EXT'])edge(s,id,source===s,'SOURCE_CONTACTOR');
   acBus(id,e.bus['generator'+side],source?[source]:[]);
   acBus('MAIN_'+side,e.bus['main'+side],[id]);edge(id,'MAIN_'+side,e.bus['main'+side]);
  }
  for(const side of [1,2]){
   const id='TRANSFER_'+side,feed=e.feed.transferSource[side];
   acBus(id,e.bus['transfer'+side],feed?[feed]:[]);
   for(const sourceSide of [1,2])edge('GENERATOR_BUS_'+sourceSide,id,feed==='GENERATOR_BUS_'+sourceSide,
    side===sourceSide?'NORMAL_TRANSFER':'ALTERNATE_TRANSFER');
  }
  const serviceExternal=c.onGround&&c.groundServiceSelected&&c.groundPowerAttached&&c.groundPowerQualityGood;
  const serviceFeed=serviceExternal?'EXT':'GENERATOR_BUS_1';
  acBus('GROUND_SERVICE',e.bus.groundService,e.bus.groundService?[serviceFeed]:[]);
  edge('EXT','GROUND_SERVICE',Boolean(serviceExternal),'GROUND_SERVICE_RELAY');
  edge('GENERATOR_BUS_1','GROUND_SERVICE',e.bus.groundService&&!serviceExternal);
  for(const [id,feed]of [['TR1','TRANSFER_1'],['TR2','TRANSFER_2'],['TR3','MAIN_2']]){
   node(id,'DC',e.feed.tr[id],[feed],{volts:28});edge(feed,id,e.feed.tr[id],'AC_TO_DC');
  }
  for(const side of [1,2]){
   const feeds=['TR'+side];if(e.feed.tie)feeds.push('TR'+(side===1?2:1));
   const active=feeds.filter(id=>nodes[id].powered===true);
   node('DC_'+side,'DC',e.bus['dc'+side],active,{volts:28},
    e.bus['dc'+side]===null?'TR3_BACKUP_ROUTE_UNVERIFIED':null);
   for(const id of ['TR1','TR2'])edge(id,'DC_'+side,feeds.includes(id)&&nodes[id].powered,
    id==='TR'+side?'NORMAL_DC_FEED':'VIA_DC_TIE');
   // Preserve the unresolved TR3 backup route; never invent a relay path.
   edge('TR3','DC_'+side,e.bus['dc'+side]===null?null:false,'UNVERIFIED_BACKUP');
  }
  node('HOT_BATTERY_BUS','DC',e.bus.hotBattery,['BATTERY'],{volts:nodes.BATTERY.volts});
  edge('BATTERY','HOT_BATTERY_BUS',e.bus.hotBattery,'UNSWITCHED');
  node('SWITCHED_HOT_BATTERY_BUS','DC',e.bus.switchedHotBattery,['HOT_BATTERY_BUS'],{volts:nodes.HOT_BATTERY_BUS.volts});
  edge('HOT_BATTERY_BUS','SWITCHED_HOT_BATTERY_BUS',c.batterySwitch,'BATTERY_SWITCH');
  const forcedBattery=c.standbySelector==='BAT';
  const batteryFeed=forcedBattery?'HOT_BATTERY_BUS':e.feed.tr.TR3?'TR3':'HOT_BATTERY_BUS';
  const batteryVolts=nodes[batteryFeed].volts;
  node('BATTERY_BUS','DC',e.bus.battery,e.bus.battery?[batteryFeed]:[],{volts:batteryVolts});
  edge('TR3','BATTERY_BUS',!forcedBattery&&e.feed.tr.TR3,'NORMAL_BATTERY_BUS');
  edge('HOT_BATTERY_BUS','BATTERY_BUS',forcedBattery||(!e.feed.tr.TR3&&c.batterySwitch),'BATTERY_BUS_CONTROL');
  const normalStandby=e.feed.standbyFeed==='TRANSFER1_DC1';
  const unknownStandby=e.bus.acStandby===null||e.bus.dcStandby===null;
  const batteryStandby=!normalStandby&&c.standbySelector!=='OFF'&&!unknownStandby&&
   (e.bus.acStandby===true||e.bus.dcStandby===true);
  const inverter=unknownStandby?null:batteryStandby&&e.bus.battery&&!f.STATIC_INVERTER_FAILED;
  node('INVERTER','AC',inverter,inverter?['BATTERY_BUS']:[],{volts:115,hz:400},
   unknownStandby?'STANDBY_CONFIGURATION_UNRESOLVED':null);
  edge('BATTERY_BUS','INVERTER',inverter,'DC_TO_AC');
  acBus('AC_STANDBY',e.bus.acStandby,e.bus.acStandby?[normalStandby?'TRANSFER_1':'INVERTER']:[],e.feed.standbyFeed);
  const dcStandbyFeed=normalStandby?'DC_1':'BATTERY_BUS';
  node('DC_STANDBY','DC',e.bus.dcStandby,e.bus.dcStandby?[dcStandbyFeed]:[],
   {volts:normalStandby?28:batteryVolts},e.feed.standbyFeed);
  edge('TRANSFER_1','AC_STANDBY',normalStandby,'NORMAL_STANDBY');
  edge('INVERTER','AC_STANDBY',unknownStandby?null:batteryStandby,'ALTERNATE_STANDBY');
  edge('DC_1','DC_STANDBY',normalStandby,'NORMAL_STANDBY');
  edge('BATTERY_BUS','DC_STANDBY',unknownStandby?null:batteryStandby,'ALTERNATE_STANDBY');
  const chargerFeed=e.bus.groundService?'GROUND_SERVICE':e.bus.main2?'MAIN_2':null;
  node('CHARGER','DC',chargerFeed!==null,chargerFeed?[chargerFeed]:[],null,'CHARGE_CAPABILITY_ONLY_NO_CHARGING_CURRENT_MODEL');
  edge('GROUND_SERVICE','CHARGER',chargerFeed==='GROUND_SERVICE','CHARGER_AC_FEED');
  edge('MAIN_2','CHARGER',chargerFeed==='MAIN_2','CHARGER_ALTERNATE_FEED');
  // Sensor data never energizes a bus. It only replaces numbers on an already
  // energized authoritative node, and never resolves a source/effectivity gap.
  for(const id of Object.keys(measurements))if(!nodes[id])throw Error('Unknown sensor '+id);
  const dc=id=>({volts:nodes[id].volts,amps:nodes[id].amps});
  const ac=id=>({volts:nodes[id].volts,cps:nodes[id].hz});
  const sources={DC:{'STBY PWR':dc('DC_STANDBY'),'BAT BUS':dc('BATTERY_BUS'),BAT:dc('BATTERY'),
    'APU BAT':{volts:null,amps:null},TR1:dc('TR1'),TR2:dc('TR2'),TR3:dc('TR3')},
   AC:{'STBY PWR':ac('AC_STANDBY'),'GND PWR':ac('EXT'),GEN1:ac('GEN1'),
    'APU GEN':ac('APU'),GEN2:ac('GEN2'),INV:ac('INVERTER'),TEST:{volts:null,cps:null}}};
  const qa=copy(e.qa);
  qa.push({id:'NOMINAL_NUMBERS',level:'MODEL_LIMIT',detail:'24/28/115 V and 400 Hz are nominal training values, not a load-flow or battery model.'},
   {id:'APU_BAT_EFFECTIVITY',level:'UNKNOWN',detail:'Separate APU battery installation is not confirmed.'},
   {id:'LOAD_CURRENT',level:'UNKNOWN',detail:'Installed device feeds, CB mapping and currents require per-device evidence.'});
  return {schema:'b737-electrical-network/1',version:VERSION,revision:state.rev,
   authority:'EXISTING_ECU_ELECTRICAL_PACK',numericMode,nodes,edges,meterSources:sources,
   controls:copy(c),faults:copy(f),lamps:copy(e.lamps),galleyShed:e.galleyShed,
   dcTieClosed:e.feed.tie,qa,reference:'FCOM Classic chapter 6; single-battery baseline; EP-FSI effectivity pending'};
 }
 function supply(network,{bus,cbClosed=null,switchOn=true,healthy=true}={}){
  for(const value of [cbClosed,switchOn,healthy])if(!tri(value))throw Error('Three-state consumer inputs required');
  const id=BUS_IDS[bus]||bus,n=network?.nodes?.[id],upstream=n?.powered??null;
  const gates=[upstream,cbClosed,switchOn,healthy];
  const operating=gates.includes(false)?false:gates.includes(null)?null:true;
  return {bus:id||null,busPowered:upstream,cbClosed,switchOn,healthy,operating,
   quality:!n?'UNVERIFIED_BUS':operating===null?'UNRESOLVED_CIRCUIT':'DECLARED_CIRCUIT_MODEL'};
 }
 return Object.freeze({VERSION,BUS_IDS,project,supply});
});
