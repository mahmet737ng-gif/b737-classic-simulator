(function(){'use strict';
const electrical=(function(){const module={exports:{}};const exports=module.exports;
'use strict';

/**
 * B737 Classic Electrical Network — deterministic integration pilot v0.1.
 * Private authoritative reference: Sepehran FCOM Vol 2 §6.20.1–19
 * (PDF physical pp.1150–1168); Fire §8.20.1 (PDF p.1234).
 * This is an intentionally bounded operational model, not certified wiring.
 * No numerical voltage/load, contactor transient, bus-indicator power
 * or pump hydraulic pressure is invented.
 */
const SOURCE = 'FCOM-SEPEHRAN-1937';
const REF = Object.freeze({
  ac: {sourceId:SOURCE, pdfPages:[1150,1151,1152,1153], section:'6.20.1-4'},
  dc: {sourceId:SOURCE, pdfPages:[1157,1158], section:'6.20.8-9'},
  standby: {sourceId:SOURCE, pdfPages:[1160,1161], section:'6.20.11-12'},
  loads1: {sourceId:SOURCE, pdfPages:[1167], section:'6.20.18'},
  loads2: {sourceId:SOURCE, pdfPages:[1168], section:'6.20.19'},
  fire: {sourceId:SOURCE, pdfPages:[1234], section:'8.20.1'}
});
const requiredBoolean = (v,n) => {
  if(typeof v !== 'boolean') throw new TypeError(n+' must be boolean');
};
const oneOf = (v,a,n) => {
  if(!a.includes(v)) throw new TypeError(n+' must be '+a.join('|'));
};
const state = v => v ? 'POWERED' : 'UNPOWERED';

/** A crew-selectable initial topology, not a complete switch event sequencer. */
function evaluateElectricalPower(p) {
  if(!p || typeof p !== 'object') throw new TypeError('electrical input required');
  oneOf(p.phase,['AIR','GROUND'],'phase');
  oneOf(p.busTransfer,['AUTO','OFF'],'busTransfer');
  oneOf(p.standbySwitch,['AUTO','OFF','BAT'],'standbySwitch');
  if(!p.selected || !p.available) throw new TypeError('selected and available required');
  oneOf(p.selected.bus1,['GEN1','APU','EXT','NONE'],'selected.bus1');
  oneOf(p.selected.bus2,['GEN2','APU','EXT','NONE'],'selected.bus2');
  for(const key of ['GEN1','GEN2','APU','EXT']) requiredBoolean(p.available[key],'available.'+key);
  for(const key of ['batterySwitchOn','batteryUsable','inverterOperable','glideSlopeCaptured','groundPowerSwitchOn','groundServiceSwitchOn']) {
    requiredBoolean(p[key],key);
  }
  const t = p.trOperable || {TR1:true,TR2:true,TR3:true};
  for(const k of ['TR1','TR2','TR3']) requiredBoolean(t[k],'trOperable.'+k);
  if(p.phase === 'AIR' && (p.selected.bus1 === 'EXT' || p.selected.bus2 === 'EXT')) {
    throw new RangeError('External AC in flight: outside documented pilot scope');
  }
  if(p.phase === 'AIR' && p.selected.bus1 === 'APU' && p.selected.bus2 === 'APU') {
    throw new RangeError('APU may not power both generator buses in flight');
  }

  const requested = [p.selected.bus1,p.selected.bus2];
  const effective = requested.map(s => {
    if(s === 'NONE' || !p.available[s]) return null;
    if(s === 'EXT' && (!p.groundPowerSwitchOn || !p.batterySwitchOn || p.phase !== 'GROUND')) return null;
    return s;
  });
  const [s1,s2] = effective;
  const generatorBus1=!!s1, generatorBus2=!!s2;
  // No source paralleling. Generator buses never become electrically tied.
  const mainBus1=generatorBus1, mainBus2=generatorBus2;
  const transferBus1=generatorBus1 ? 'BUS1' :
    (p.busTransfer==='AUTO' && generatorBus2 ? 'BUS2' : null);
  const transferBus2=generatorBus2 ? 'BUS2' :
    (p.busTransfer==='AUTO' && generatorBus1 ? 'BUS1' : null);
  const tr1=!!transferBus1 && t.TR1;
  const tr2=!!transferBus2 && t.TR2;
  const tr3=mainBus2 && t.TR3;
  const dcTieClosed=p.busTransfer==='AUTO' && !p.glideSlopeCaptured;

  // §6.20.9 gives normal TR1/TR2 supply and TR3 backup, but the precise
  // degraded relay path from TR3 is not established here: report unknown.
  function dc(side) {
    if(dcTieClosed) {
      if(tr1 || tr2) return 'POWERED';
      return tr3 ? 'UNRESOLVED_TR3_BACKUP' : 'UNPOWERED';
    }
    const own=side===1 ? tr1 : tr2;
    if(own) return 'POWERED';
    return tr3 ? 'UNRESOLVED_TR3_BACKUP' : 'UNPOWERED';
  }
  const dc1=dc(1),dc2=dc(2);
  const batteryBus=tr3 || (p.batterySwitchOn && p.batteryUsable);
  const hotBatteryBus=p.batteryUsable;
  const switchedHotBatteryBus=p.batterySwitchOn && p.batteryUsable;

  let acStandby,dcStandby,standbySource;
  if(p.standbySwitch==='OFF'){
    acStandby='UNPOWERED'; dcStandby='UNPOWERED'; standbySource='OFF';
  } else if(p.standbySwitch==='BAT'){
    dcStandby=state(p.batteryUsable);
    acStandby=state(p.batteryUsable && p.inverterOperable);
    standbySource='BAT_MANUAL';
  } else if(transferBus1 && dc1==='POWERED') {
    acStandby='POWERED'; dcStandby='POWERED'; standbySource='NORMAL';
  } else if(p.phase==='AIR'){
    // §6.20.11 automatic battery-bus takeover in flight, subject to
    // explicit battery/inverter usability inputs and battery switch ON.
    const able=p.batterySwitchOn && p.batteryUsable && batteryBus;
    dcStandby=state(able);
    acStandby=state(able && p.inverterOperable);
    standbySource='BATTERY_AUTO_AIR';
  } else if(!generatorBus1 && !generatorBus2) {
    acStandby='UNPOWERED'; dcStandby='UNPOWERED';
    standbySource='GROUND_AUTO_INHIBIT_ALL_AC_LOST';
  } else {
    acStandby='UNRESOLVED_GROUND_PARTIAL_LOSS';
    dcStandby='UNRESOLVED_GROUND_PARTIAL_LOSS';
    standbySource='UNKNOWN';
  }

  const groundServiceBus = p.phase==='GROUND' && p.available.EXT &&
    p.groundServiceSwitchOn && !p.groundPowerSwitchOn
      ? 'POWERED_EXTERNAL_GROUND_SERVICE_ONLY' : 'NOT_EVALUATED';

  const genCount=new Set(effective.filter(x=>x && x!=='EXT')).size;
  let galley='NOT_EVALUATED';
  if(p.phase==='AIR'){
    galley=(genCount===1) ? 'SHED_SINGLE_GENERATOR' :
      (genCount===0 ? 'UNPOWERED_NO_GENERATORS' : 'NOT_SHED_BY_SINGLE_GEN_RULE');
  }
  // FCOM power-distribution tables have narrow preconditions. These
  // observations must NOT be extrapolated to every equipment configuration.
  const case1=p.phase==='AIR' && p.busTransfer==='AUTO' &&
    !generatorBus1 && s2==='GEN2' && requested[0]==='GEN1';
  const case2=p.phase==='AIR' && p.busTransfer==='AUTO' &&
    !generatorBus2 && s1==='GEN1' && requested[1]==='GEN2';
  const failures=[];
  function add(side,id,category,signal,section,pdfPage){
    failures.push({side,id,category,effect:'INOPERATIVE_IN_FCOM_CASE',
      reportedSignal:signal,source:{sourceId:SOURCE,section,pdfPage}});
  }
  if(case1){
    add(1,'FUEL.TANK1_FORWARD_PUMP','fuel','LOW PRESSURE light','6.20.18',1167);
    add(1,'FUEL.CENTER_RIGHT_PUMP','fuel','LOW PRESSURE light','6.20.18',1167);
    add(1,'HYD.SYSTEM_B_ELECTRIC_PUMP','hydraulics','LOW PRESSURE light','6.20.18',1167);
    add(1,'ENV.EQUIP_COOLING_NORMAL','air_systems','OFF light','6.20.18',1167);
  }
  if(case2){
    add(2,'FUEL.TANK2_FORWARD_PUMP','fuel','LOW PRESSURE light','6.20.19',1168);
    add(2,'FUEL.CENTER_LEFT_PUMP','fuel','LOW PRESSURE light','6.20.19',1168);
    add(2,'HYD.SYSTEM_A_ELECTRIC_PUMP','hydraulics','LOW PRESSURE light','6.20.19',1168);
    add(2,'ENV.EQUIP_COOLING_ALTERNATE','air_systems','OFF if alternate selected','6.20.19',1168);
  }

  return {
    schema:'b737cl-electrical-pilot-v0.1',
    config:{phase:p.phase,busTransfer:p.busTransfer,standbySwitch:p.standbySwitch},
    sourceAssignments:{bus1:s1,bus2:s2},
    buses:{
      generator1:state(generatorBus1),generator2:state(generatorBus2),
      main1:state(mainBus1),main2:state(mainBus2),
      transfer1:state(!!transferBus1),transfer2:state(!!transferBus2),
      transfer1Feed:transferBus1,transfer2Feed:transferBus2,
      dc1,dc2,dcTie:dcTieClosed?'CONNECTED':'ISOLATED',
      battery:state(batteryBus),hotBattery:state(hotBatteryBus),
      switchedHotBattery:state(switchedHotBatteryBus),
      acStandby,dcStandby,standbySource,groundService:groundServiceBus
    },
    transformerRectifiers:{TR1:state(tr1),TR2:state(tr2),TR3:state(tr3)},
    galley,
    documentedFailureCase:case1?'GEN1_FAILED_FLIGHT_TRANSFER_NORMAL':
      case2?'GEN2_FAILED_FLIGHT_TRANSFER_NORMAL':null,
    crossSystemEffects:failures,
    fireDetectionPower:state(batteryBus),
    fireExtinguishingPower:state(hotBatteryBus),
    unresolved:[
      'Bus lamp energization and caution logic not simulated',
      'DC TR3 degraded relay backup requires further schematic review',
      'Pump pressures and fuel/hydraulic dynamics not simulated',
      'Battery state-of-charge and timing not simulated',
      'APU load-dependent shedding threshold not simulated'
    ],
    provenance:REF
  };
}
module.exports={evaluateElectricalPower,REF};
return module.exports;})();
const feederAudit=(function(){const module={exports:{}};const exports=module.exports;
'use strict';
/**
 * Electrical functional feeder/effectivity audit v0.2.
 *
 * FCOM §6.20.1-4, PDF 1150-1153 documents bus topology/transfer.
 * FCOM §6.20.18-19, PDF 1167-1168 documents INOPERATIVE consumers
 * with GEN1 or GEN2 failed IN FLIGHT and transfer buses NORMAL.
 *
 * An INOPERATIVE list is NOT a Boeing WDM/SSM wiring diagram. The
 * corresponding contactor/CB/direct AC feeder is NOT inferred here.
 */
const SOURCE='FCOM-SEPEHRAN-1937';
const FEEDS=Object.freeze({
  'FUEL.MAIN1_FWD': {effect:'FUEL.TANK1_FORWARD_PUMP',genLost:'GEN1',pdfPage:1167},
  'FUEL.CTR_RIGHT': {effect:'FUEL.CENTER_RIGHT_PUMP',genLost:'GEN1',pdfPage:1167},
  'HYD.B_ELECTRIC': {effect:'HYD.SYSTEM_B_ELECTRIC_PUMP',genLost:'GEN1',pdfPage:1167},
  'FUEL.MAIN2_FWD': {effect:'FUEL.TANK2_FORWARD_PUMP',genLost:'GEN2',pdfPage:1168},
  'FUEL.CTR_LEFT': {effect:'FUEL.CENTER_LEFT_PUMP',genLost:'GEN2',pdfPage:1168},
  'HYD.A_ELECTRIC': {effect:'HYD.SYSTEM_A_ELECTRIC_PUMP',genLost:'GEN2',pdfPage:1168},
  'FUEL.MAIN1_AFT': {effect:null,genLost:null,pdfPage:null},
  'FUEL.MAIN2_AFT': {effect:null,genLost:null,pdfPage:null}
});
const VALID_SOURCE_IDS=Object.keys(FEEDS);
function evaluateFeeder(electrical,id) {
  if(!VALID_SOURCE_IDS.includes(id)) throw new TypeError('Unknown feeder consumer '+String(id));
  if(!electrical || !electrical.buses || !electrical.sourceAssignments ||
     !Array.isArray(electrical.crossSystemEffects))
    throw new TypeError('evaluateElectricalPower() result required');
  const rule=FEEDS[id], b=electrical.buses;
  const verifiedLoss=rule.effect &&
    electrical.crossSystemEffects.some(e=>e.id===rule.effect);
  const source=(rule.genLost ?
    {sourceId:SOURCE,pdfPage:rule.pdfPage,section:rule.genLost==='GEN1'?'6.20.18':'6.20.19'}:
    {sourceId:SOURCE,pdfPage:1153,section:'6.20.4'});
  const base={
    id, physicalFeeder:'UNVERIFIED_WDM_SSM_REQUIRED',
    circuitBreaker:'UNVERIFIED_WDM_SSM_REQUIRED',
    relay:'UNVERIFIED_WDM_SSM_REQUIRED',
    flightFaultCase:electrical.documentedFailureCase,source
  };
  if(verifiedLoss) return {...base,state:'UNPOWERED',
    basis:'FCOM_SPECIFIED_FAILED_LOAD_IN_NARROW_FLIGHT_CASE',
    functionalCertainty:'SOURCE_EQUIPMENT_LOSS_LIST'};
  if(b.generator1==='UNPOWERED' && b.generator2==='UNPOWERED')
    return {...base,state:'UNPOWERED',
      basis:'NO_MAIN_GENERATOR_AC_IN_MODEL',functionalCertainty:'FCOM_GENERAL_AC_PUMP_DEPENDENCY'};
  if(b.generator1==='POWERED' && b.generator2==='POWERED')
    return {...base,state:'POWERED',
      basis:'BOTH_GENERATOR_BUSES_LIVE_NORMAL_FIXTURE',
      functionalCertainty:'OPERATIONAL_TEST_FIXTURE_NOT_WIRING'};
  if(electrical.documentedFailureCase)
    return {...base,state:'POWERED',
      basis:'OTHER_CONSUMER_NOT_IN_FCOM_FAILED_LIST',
      functionalCertainty:'CONDITIONAL_NEGATIVE_INFERENCE_NOT_WIRING'};
  return {...base,state:'UNKNOWN',basis:'FEEDER_OR_ALTERNATE_PATH_NOT_SOURCE_VERIFIED',
    functionalCertainty:'UNKNOWN'};
}
function evaluateAllFeeders(electrical) {
  return Object.fromEntries(VALID_SOURCE_IDS.map(id=>[id,evaluateFeeder(electrical,id)]));
}
function compareElectricalTransitions(before,after) {
  if(!before || !after) throw new TypeError('electrical snapshots required');
  const diff=(group,oldValues,newValues) =>
    Object.keys(newValues).filter(k=>oldValues[k]!==newValues[k]).map(id=>({
      group,id,before:oldValues[id],after:newValues[id]}));
  const buses=diff('BUS',before.buses,after.buses);
  const consumers=diff('FEEDER',Object.fromEntries(Object.entries(evaluateAllFeeders(before))
    .map(([id,x])=>[id,x.state])),
    Object.fromEntries(Object.entries(evaluateAllFeeders(after)).map(([id,x])=>[id,x.state])));
  return {buses,consumers,nonParalleling:true,
    physicalRelayTiming:'UNVERIFIED_NO_DELAY_INVENTED'};
}
module.exports={FEEDS,evaluateFeeder,evaluateAllFeeders,compareElectricalTransitions};
return module.exports;})();
const consumers=(function(){const module={exports:{}};const exports=module.exports;const require=(p)=>{if(p==='./electrical-power-pilot.cjs')return electrical;if(p==='./electrical-feeder-audit.v0.2.cjs')return feederAudit;if(p==='./pump-sensor-warning-engine.cjs')return consumers;if(p==='./pressure-distribution.v0.2.cjs')return pressurePhysics;if(p==='./electrical-consumer-feeders.cjs')return feederMap;if(p==='./fluid-pressure-engine.cjs')return fluidObservations;if(p==='./sensor-failure-engine.cjs')return sensorEngine;if(p==='./fire-detection-pilot.cjs')return firePilot;if(p==='./annunciation-output-engine.cjs')return annunciator;if(p==='./engine-apu-integration.cjs')return propulsionEngine;if(p==='./pneumatic-start-protection.cjs')return safetyEngine;throw new Error('Unknown browser module '+p);};
'use strict';

/**
 * Source-traced B737 Classic pump -> discrete pressure sensor -> warning logic.
 * D6-27370-300/400/500-SHI FCOM: 12.10.2-3 pp1826-27,
 * 12.20.1 p1834, 13.10.1/4 pp1842/45, 13.20.2-3 pp1847-48,
 * 6.20.18-19 pp1167-68, 15.20.2-4 pp1906-08.
 *
 * Pilot limitations: nominal pump output is a fixture-level qualitative
 * assumption, NOT a calibrated pressure, pump inertia or wiring model.
 * Lamp commands are separate from lamp power/visibility.
 */

const SOURCE = 'FCOM-SEPEHRAN-1937';
const {evaluateFeeder}=require('./electrical-feeder-audit.v0.2.cjs');
const FUEL_IDS = Object.freeze([
  'MAIN1_FWD', 'MAIN1_AFT', 'MAIN2_FWD', 'MAIN2_AFT',
  'CTR_LEFT', 'CTR_RIGHT'
]);
const HYD_IDS = Object.freeze(['A', 'B']);
const SENSOR_QUALITY = 'DERIVED_DISCRETE_NOT_PRESSURE_CALIBRATED';
const checkBool = (x, k) => { if (typeof x !== 'boolean') throw new TypeError(k + ' must be boolean'); };
const requireKeys = (obj, keys, name) => {
  if (!obj || typeof obj !== 'object') throw new TypeError(name + ' missing');
  for (const k of keys) checkBool(obj[k], name + '.' + k);
};
const src = (section, pdfPage) => ({sourceId: SOURCE, section, pdfPage});
const low = (running, hasPressureMedium) => {
  if (running === null || hasPressureMedium === null) return 'UNKNOWN';
  return running && hasPressureMedium ? 'NORMAL' : 'LOW';
};
const light = p => p === 'UNKNOWN' ? null : p === 'LOW';
const andKnown = (a,b) => a === false || b === false ? false :
  (a === null || b === null ? null : a && b);

const CONSUMER_IDS = Object.freeze({
  'FUEL.TANK1_FORWARD_PUMP':'FUEL.MAIN1_FWD',
  'FUEL.TANK2_FORWARD_PUMP':'FUEL.MAIN2_FWD',
  'FUEL.CENTER_LEFT_PUMP':'FUEL.CTR_LEFT',
  'FUEL.CENTER_RIGHT_PUMP':'FUEL.CTR_RIGHT',
  'HYD.SYSTEM_A_ELECTRIC_PUMP':'HYD.A_ELECTRIC',
  'HYD.SYSTEM_B_ELECTRIC_PUMP':'HYD.B_ELECTRIC',
  'FUEL.MAIN1_AFT':'FUEL.MAIN1_AFT',
  'FUEL.MAIN2_AFT':'FUEL.MAIN2_AFT'
});
function consumerPower(electrical,id) {
  const key=CONSUMER_IDS[id];
  if(!key)throw new TypeError('Unregistered pump electrical consumer '+String(id));
  const feeder=evaluateFeeder(electrical,key);
  const basis=feeder.basis==='FCOM_SPECIFIED_FAILED_LOAD_IN_NARROW_FLIGHT_CASE'?
    'FCOM_FAILURE_TABLE' :
    feeder.basis==='BOTH_GENERATOR_BUSES_LIVE_NORMAL_FIXTURE'?
      'NOMINAL_TWO_AC_BUS_FIXTURE' :
    feeder.basis==='NO_MAIN_GENERATOR_AC_IN_MODEL'?
      'ALL_NORMAL_AC_SOURCES_LOST':
    feeder.basis==='OTHER_CONSUMER_NOT_IN_FCOM_FAILED_LIST'?
      'OTHER_LOAD_NOT_IN_FCOM_FAILURE_LIST':'EXACT_FEEDER_AND_RELAY_UNVERIFIED';
  return {...feeder,basis};
}

function computeMotor({switchOn,working,power,medium,autoCutoff=false}) {
  if (!switchOn) return {motor:'STOPPED_SWITCH_OFF',output:'LOW'};
  if (autoCutoff) return {motor:'STOPPED_CENTER_AUTO_SHUTOFF',output:'LOW'};
  if (!working) return {motor:'FAILED',output:'LOW'};
  if (power === 'UNPOWERED') return {motor:'STOPPED_NO_AC',output:'LOW'};
  if (power === 'UNKNOWN') return {motor:'UNKNOWN',output:'UNKNOWN'};
  if (!medium) return {motor:'RUNNING_NO_INLET',output:'LOW'};
  return {motor:'RUNNING',output:'NORMAL'};
}

function evaluatePumpNetwork(electrical, pumps) {
  if (!pumps || !pumps.fuel || !pumps.hydraulic) throw new TypeError('pumps.fuel/hydraulic required');
  const f=pumps.fuel, h=pumps.hydraulic;
  requireKeys(f.switches,FUEL_IDS,'fuel.switches');
  requireKeys(f.healthy,FUEL_IDS,'fuel.healthy');
  requireKeys(f.fuelAtInlet,['MAIN1','MAIN2','CENTER'],'fuel.fuelAtInlet');
  requireKeys(f.centerAutoCutoff,['CTR_LEFT','CTR_RIGHT'],'fuel.centerAutoCutoff');
  requireKeys(h.electricSwitches,HYD_IDS,'hydraulic.electricSwitches');
  requireKeys(h.electricHealthy,HYD_IDS,'hydraulic.electricHealthy');
  requireKeys(h.fluidAvailable,HYD_IDS,'hydraulic.fluidAvailable');
  requireKeys(h.flightControlValveOn,HYD_IDS,'hydraulic.flightControlValveOn');
  if (!h.engineDriven) throw new TypeError('hydraulic.engineDriven required');

  const fuel={};
  const feedTank={
    MAIN1_FWD:'MAIN1', MAIN1_AFT:'MAIN1',MAIN2_FWD:'MAIN2',
    MAIN2_AFT:'MAIN2',CTR_LEFT:'CENTER',CTR_RIGHT:'CENTER'
  };
  const fuelElectricalId={
    MAIN1_FWD:'FUEL.TANK1_FORWARD_PUMP',
    MAIN2_FWD:'FUEL.TANK2_FORWARD_PUMP',
    CTR_LEFT:'FUEL.CENTER_LEFT_PUMP',
    CTR_RIGHT:'FUEL.CENTER_RIGHT_PUMP'
  };
  for(const id of FUEL_IDS) {
    const supply=consumerPower(electrical,fuelElectricalId[id] || 'FUEL.'+id);
    const x=computeMotor({switchOn:f.switches[id],working:f.healthy[id],
      power:supply.state,medium:f.fuelAtInlet[feedTank[id]],
      autoCutoff:f.centerAutoCutoff[id] || false});
    const pressureSensor=x.output;
    // Main LOW PRESSURE lamp is ON even with its pump switch OFF; center
    // lamp is inhibited by its own switch OFF. FCOM 12.10.2/3.
    const lamp=id.startsWith('CTR') ? (f.switches[id] ? light(pressureSensor) : false) :
      light(pressureSensor);
    fuel[id]={
      switchOn:f.switches[id],motor:x.motor,ac:supply.state,powerEvidence:supply,
      outputPressureSensor:{state:pressureSensor,quality:SENSOR_QUALITY},
      lowPressureLampDemand:lamp,
      lowPressureLampSource:src(id.startsWith('CTR')?'12.10.2':'12.10.3',
        id.startsWith('CTR')?1826:1827)
    };
  }

  const hydraulic={};
  for(const id of HYD_IDS) {
    const mech=h.engineDriven[id];
    if(!mech) throw new TypeError('hydraulic.engineDriven.'+id+' required');
    for(const key of ['engineRunning','switchOn','healthy','fireSwitchPulled'])
      checkBool(mech[key],'hydraulic.engineDriven.'+id+'.'+key);
    const supply=consumerPower(electrical,'HYD.SYSTEM_'+id+'_ELECTRIC_PUMP');
    const x=computeMotor({switchOn:h.electricSwitches[id],
      working:h.electricHealthy[id],power:supply.state,medium:h.fluidAvailable[id]});
    const engineRunning=mech.engineRunning && mech.healthy && mech.switchOn &&
      !mech.fireSwitchPulled && h.fluidAvailable[id];
    const engineOutput=engineRunning ? 'NORMAL' : 'LOW';
    const enginePressureLamp=mech.fireSwitchPulled ? false : light(engineOutput);
    const electricPressureLamp=light(x.output);
    const systemPressure=engineOutput==='NORMAL'||x.output==='NORMAL'?'AVAILABLE':
      x.output==='UNKNOWN'?'UNKNOWN':'LOW';
    const flightControlPressureLamp=!h.flightControlValveOn[id] ? false :
      (systemPressure==='UNKNOWN'?null:systemPressure==='LOW');
    hydraulic[id]={
      electric:{switchOn:h.electricSwitches[id],ac:supply.state,powerEvidence:supply,
        motor:x.motor,outputPressureSensor:{state:x.output,quality:SENSOR_QUALITY},
        lowPressureLampDemand:electricPressureLamp},
      engineDriven:{switchOn:mech.switchOn,engineRunning:mech.engineRunning,
        fireSwitchPulled:mech.fireSwitchPulled,
        outputPressureSensor:{state:engineOutput,quality:SENSOR_QUALITY},
        lowPressureLampDemand:enginePressureLamp},
      systemPressure:{state:systemPressure,psi:null,
        reason:'NO_NUMERIC_HYDRAULIC_DYNAMICS_OR_TRANSMITTER'},
      flightControlLowPressureLampDemand:flightControlPressureLamp,
      source:src('13.10.1,13.10.4,13.20.2-3',1848)
    };
  }
  return {fuel,hydraulic};
}

/** FCOM-driven *causes*, not direct writes to physical lamp hardware. */
function evaluateWarningCauses(network) {
  const f=network.fuel, h=network.hydraulic;
  const cause=[], simple=[], unknown=[];
  const warn=(id,system,source)=>cause.push({id,system,source});
  const recalled=(id,system,source)=>simple.push({id,system,source});
  for(const side of ['MAIN1','MAIN2']) {
    const a=f[side+'_FWD'].lowPressureLampDemand;
    const b=f[side+'_AFT'].lowPressureLampDemand;
    if(a===true && b===true)
      warn('FUEL.'+side+'_DUAL_LOW','FUEL',src('12.10.3',1827));
    else if(a===null || b===null)
      unknown.push('FUEL.'+side+'_MAIN_PUMP_PRESSURE_INDETERMINATE');
    else if(a===true || b===true)
      recalled('FUEL.'+side+'_SINGLE_LOW','FUEL',src('12.10.3',1827));
  }
  // Center tank: warning if both switches ON and either low; or one switch
  // OFF and the other switch's lamp is low. With both OFF neither lamp alerts.
  for(const side of ['LEFT','RIGHT']) {
    const id='CTR_'+side, opposite=side==='LEFT'?'CTR_RIGHT':'CTR_LEFT';
    const l=f[id].lowPressureLampDemand;
    if(l===true && f[opposite].switchOn !== undefined)
      warn('FUEL.'+id+'_LOW','FUEL',src('12.10.2',1826));
    else if(l===null && f[id].switchOn)
      unknown.push('FUEL.'+id+'_PRESSURE_INDETERMINATE');
  }
  for(const side of HYD_IDS) {
    if(h[side].flightControlLowPressureLampDemand===true)
      warn('FLT_CONT.'+side+'_PRESSURE_LOW','FLT CONT',
        src('13.10.4',1845));
    else if(h[side].flightControlLowPressureLampDemand===null)
      unknown.push('HYD.'+side+'_SYSTEM_PRESSURE_INDETERMINATE');
    // A pump LOW PRESSURE is not itself enough to assert MASTER CAUTION
    // without the installed system's caution logic.
  }
  return {active:cause,simple,unresolved:unknown};
}

/** Warning annunciator power is a separate QA gate from the logical demand. */
function projectWarnings(network,warnCauses,electrical,control) {
  if(!control || !Array.isArray(control.acknowledged) ||
     !Array.isArray(control.activeCauseIds) || typeof control.recallPressed!=='boolean')
    throw new TypeError('warning control required');
  const active=warnCauses.active, simple=warnCauses.simple;
  const acknowledged=new Set(control.acknowledged);
  const newCaution=active.some(x=>!acknowledged.has(x.id));
  const recall=control.recallPressed && simple.length>0;
  const physicalDisplayPower = electrical.buses.dc1==='POWERED' &&
    electrical.buses.dc2==='POWERED' ? 'PILOT_ASSUMED_PANEL_AVAILABLE' :
    'UNKNOWN_PANEL_SUPPLY';
  const visible=v=>physicalDisplayPower==='PILOT_ASSUMED_PANEL_AVAILABLE' ? v : null;
  const lowFuel={};
  for(const [id,p] of Object.entries(network.fuel))
    lowFuel[id]={logicalDemand:p.lowPressureLampDemand,visible:visible(p.lowPressureLampDemand)};
  const lowHyd={};
  for(const [id,p] of Object.entries(network.hydraulic))
    lowHyd[id]={electric:{logicalDemand:p.electric.lowPressureLampDemand,
      visible:visible(p.electric.lowPressureLampDemand)},
      engine:{logicalDemand:p.engineDriven.lowPressureLampDemand,
      visible:visible(p.engineDriven.lowPressureLampDemand)},
      flightControl:{logicalDemand:p.flightControlLowPressureLampDemand,
      visible:visible(p.flightControlLowPressureLampDemand)}};
  // FCOM §13.20.3 documents FLT CONT + HYD annunciators when loss of
  // hydraulic output affects flight-control pressure. A lone pump LOW PRESS
  // with the other pump maintaining system pressure is *not* enough evidence
  // to declare the entire HYD caution circuit's behavior.
  const hydFlightControlCaution=active.some(x=>x.system==='FLT CONT');
  const otherHydPumpLow=Object.values(network.hydraulic).some(p=>
    p.electric.lowPressureLampDemand!==false ||
    p.engineDriven.lowPressureLampDemand!==false);
  const systemAnnunciators={
    FUEL: active.some(x=>x.system==='FUEL') || (control.recallPressed && simple.some(x=>x.system==='FUEL')),
    HYD: hydFlightControlCaution ? true : (otherHydPumpLow ? null : false),
    'FLT CONT':hydFlightControlCaution
  };
  return {
    causeIds:active.map(x=>x.id),
    unacknowledgedCauseIds:active.filter(x=>!acknowledged.has(x.id)).map(x=>x.id),
    simpleRecallIds:simple.map(x=>x.id),
    unresolvedCauses:warnCauses.unresolved,
    masterCaution:{logicalDemand:newCaution||recall,visible:visible(newCaution||recall),
      acknowledgementApplied:active.length>0 && active.every(x=>acknowledged.has(x.id))},
    systemAnnunciators:Object.fromEntries(Object.entries(systemAnnunciators)
      .map(([id,demand])=>[id,{logicalDemand:demand,visible:visible(demand)}])),
    pumpLampDemands:{fuel:lowFuel,hydraulic:lowHyd},
    displayPower:physicalDisplayPower,
    displayQuality:'PROVISIONAL_ELECTRICAL_FEED_NOT_WDM_VERIFIED',
    provenance:[src('12.10.2-3',1827),src('13.10.1-4',1845),
      src('15.20.2-4',1908)]
  };
}
module.exports={FUEL_IDS,HYD_IDS,consumerPower,evaluatePumpNetwork,
  evaluateWarningCauses,projectWarnings};
return module.exports;})();
const pressurePhysics=(function(){const module={exports:{}};const exports=module.exports;
'use strict';
/**
 * B737 Classic Fuel/Hydraulic Pressure & Feed Distribution v0.2.
 * Source: private FCOM §§12.20.1-2 (PDF 1834-35), 13.10.2
 * (PDF 1843), 13.20.1-3 (PDF 1846-48).
 *
 * Steady-state *qualitative* physics only. No unsupported simulated psi,
 * pressure decay/build-up time, flow quantity, suction performance or
 * hydraulic accumulator data is invented. Failures/power state come
 * from the integrated aircraft electrical/actuator network.
 */
const SOURCE='FCOM-SEPEHRAN-1937';
const src=(section,pdfPage)=>({sourceId:SOURCE,section,pdfPage});
function outputOfMotor(motor) {
  if(motor==='RUNNING') return 'NORMAL';
  if(motor==='UNKNOWN') return 'UNKNOWN';
  if(typeof motor!=='string') throw new TypeError('motor state missing');
  if(motor==='FAILED' || motor.startsWith('STOPPED') || motor==='RUNNING_NO_INLET')
    return 'LOW';
  throw new TypeError('Unrecognized motor state '+motor);
}
function combine(one,two) {
  if(one==='NORMAL' || two==='NORMAL') return 'AVAILABLE';
  if(one==='UNKNOWN' || two==='UNKNOWN') return 'UNKNOWN';
  return 'LOW';
}
/** Source priority is *per side*. Center left supplies left feed, center
 * right supplies right feed in this crossfeed-CLOSED fixture. With center
 * pump pressurized, its lower cracking check valve preferentially opens
 * (FCOM §12.20.1). No crossfeed valve actuation is claimed.
 */
function oneFuelSide(center,mainFwd,mainAft,hasMainFuel) {
  if(center==='NORMAL') return {source:'CENTER_PRIORITY',
    certainty:'QUALITATIVE_PRESSURIZED_FEED'};
  if(center==='UNKNOWN') return {source:'UNKNOWN',
    certainty:'CENTER_PRESSURE_UNCERTAIN'};
  if(mainFwd==='NORMAL' || mainAft==='NORMAL') return {
    source:'MAIN_TANK_PUMPED',certainty:'QUALITATIVE_PRESSURIZED_FEED'};
  if(mainFwd==='UNKNOWN'||mainAft==='UNKNOWN') return {
    source:'UNKNOWN',certainty:'MAIN_PUMP_PRESSURE_UNCERTAIN'};
  // Suction-feed capability is not a guarantee of continued engine fuel
  // flow: FCOM notes altitude, temperature and dissolved air limitations.
  return hasMainFuel ? {
    source:'SUCTION_FEED_POSSIBLE_NOT_GUARANTEED',
    certainty:'NO_PRESSURIZED_PUMP_FEED'}:{
    source:'NO_PRESSURIZED_PUMP_FEED',
    certainty:'NO_FUEL_AT_MAIN_INLET'};
}
function derivePressureDistribution(electrical,network,fixture) {
  if(!electrical || !network || !network.fuel || !network.hydraulic ||
    !fixture || !fixture.fuel || !fixture.hydraulic)
    throw new TypeError('electrical, network and pump fixtures required');
  const fuel={};
  for(const [id,pump] of Object.entries(network.fuel)) {
    const output=outputOfMotor(pump.motor);
    fuel[id]={
      motor:pump.motor,pumpOutletPressure:output,
      pressurePsi:null,flowKgPerHour:null,volumeLitersPerMinute:null,
      sensorLocation:'INDIVIDUAL_PUMP_OUTLET',
      signalQuality:'QUALITATIVE_FROM_COMMAND_POWER_INLET',
      source:src('12.20.1',1834)};
  }
  const sources={
    ENGINE1:oneFuelSide(fuel.CTR_LEFT.pumpOutletPressure,
      fuel.MAIN1_FWD.pumpOutletPressure,fuel.MAIN1_AFT.pumpOutletPressure,
      fixture.fuel.fuelAtInlet.MAIN1),
    ENGINE2:oneFuelSide(fuel.CTR_RIGHT.pumpOutletPressure,
      fuel.MAIN2_FWD.pumpOutletPressure,fuel.MAIN2_AFT.pumpOutletPressure,
      fixture.fuel.fuelAtInlet.MAIN2)
  };
  const hydraulic={};
  for(const side of ['A','B']) {
    const pump=network.hydraulic[side], switchStates=fixture.hydraulic;
    const elec=outputOfMotor(pump.electric.motor);
    const eng=pump.engineDriven.outputPressureSensor.state;
    if(!['LOW','NORMAL','UNKNOWN'].includes(eng))
      throw new TypeError('hydraulic engine pump sensor invalid');
    const state=combine(elec,eng);
    // FCOM §13.10.2: "When both pumps for a system are OFF,
    // respective pointer reads zero". Do not use 3000 as a measured PSI.
    const bothOff=!switchStates.electricSwitches[side] &&
      !switchStates.engineDriven[side].switchOn;
    const gauge=bothOff ? 0 : null;
    hydraulic[side]={
      electricPumpOutlet:elec,engineDrivenPumpOutlet:eng,
      combinedSystemPressure:state,
      pressureTransmitter:{
        actualPsi:gauge,indicationPsi:gauge,
        quality:bothOff?'FCOM_BOTH_PUMPS_OFF_INDICATES_ZERO':
          'UNMODELED_ANALOG_TRANSMITTER',
        normalReferencePsi:3000,maximumRedReferencePsi:3500},
      pumpFlowRatio:{
        engineVsElectricNominalApprox:4,
        verifiedInput:'FCOM_APPROX_RELATIVE_FLOW_ONLY',
        actualFlowLitersPerMinute:null},
      independentPressureSwitches:true,
      notModeled:[
        'reservoir pressurization dynamics','pressure accumulation/discharge',
        'fluid temperature/viscosity','pump curve and demanded flow',
        'hydraulic leakage and PTU interactions'],
      source:[src('13.10.2',1843),src('13.20.2',1847),src('13.20.3',1848)]
    };
  }
  return {
    schema:'b737cl-pressure-distribution-v0.2',
    fuel:{pumpOutlets:fuel,engineFeed:sources,
      crossfeedValve:'CLOSED_TEST_FIXTURE',
      source:src('12.20.1-2',1835)},
    hydraulic,
    timingQuality:'INSTANT_EQUILIBRIUM_FIXTURE_NOT_PHYSICAL_TRANSIENT',
    measuredPressureAvailable:false,
    unresolved:['quantitative pump head','time constants',
      'fuel suction endurance','validated warning pressure-switch thresholds']
  };
}
/**
 * Sensor/warning authority is explicitly the pressure engine. It rebinds
 * qualifying discrete sensor states but leaves pump commands, power evidence
 * and existing warning policy completely separate.
 */
function bindPressureSensors(network,physics,fixture) {
  const result=JSON.parse(JSON.stringify(network));
  for(const [id,pump] of Object.entries(result.fuel)) {
    const p=physics.fuel.pumpOutlets[id];
    pump.outputPressureSensor.state=p.pumpOutletPressure;
    pump.outputPressureSensor.pressurePsi=p.pressurePsi;
    pump.outputPressureSensor.authority='PRESSURE_DISTRIBUTION_V0.2';
    pump.lowPressureLampDemand=id.startsWith('CTR') ?
      (!pump.switchOn ? false : p.pumpOutletPressure==='UNKNOWN' ?
        null :p.pumpOutletPressure==='LOW') :
      (p.pumpOutletPressure==='UNKNOWN'?null:p.pumpOutletPressure==='LOW');
  }
  for(const [side,h] of Object.entries(result.hydraulic)) {
    const p=physics.hydraulic[side];
    h.electric.outputPressureSensor.state=p.electricPumpOutlet;
    h.electric.outputPressureSensor.authority='PRESSURE_DISTRIBUTION_V0.2';
    h.electric.lowPressureLampDemand=p.electricPumpOutlet==='UNKNOWN'?null:
      p.electricPumpOutlet==='LOW';
    h.engineDriven.outputPressureSensor.state=p.engineDrivenPumpOutlet;
    h.engineDriven.outputPressureSensor.authority='PRESSURE_DISTRIBUTION_V0.2';
    h.engineDriven.lowPressureLampDemand=h.engineDriven.fireSwitchPulled?false:
      p.engineDrivenPumpOutlet==='UNKNOWN'?null:p.engineDrivenPumpOutlet==='LOW';
    h.systemPressure.state=p.combinedSystemPressure;
    h.systemPressure.psi=p.pressureTransmitter.actualPsi;
    h.systemPressure.reason=p.pressureTransmitter.quality;
    h.systemPressure.normalReferencePsi=p.pressureTransmitter.normalReferencePsi;
    h.systemPressure.maximumRedReferencePsi=p.pressureTransmitter.maximumRedReferencePsi;
    h.flightControlLowPressureLampDemand=fixture.hydraulic.flightControlValveOn[side]?
      p.combinedSystemPressure==='UNKNOWN'?null:p.combinedSystemPressure==='LOW':false;
  }
  return result;
}
/** Cause → pressure direction only, NEVER a made-up time in seconds.
 * A pending transient is not asserted as a measured physical value.
 */
function comparePressureTransitions(before,after) {
  if(!before || !after) throw new TypeError('pressure snapshots required');
  const events=[];
  const trajectory=(a,b)=>a===b?'STABLE':
    (a==='LOW'||a==='UNKNOWN') && (b==='NORMAL'||b==='AVAILABLE') ?
      'BUILDUP_TIMING_UNVERIFIED':
      (a==='NORMAL'||a==='AVAILABLE')&&(b==='LOW') ?
        'DECAY_TIMING_UNVERIFIED':'STATE_CHANGE_TIMING_UNVERIFIED';
  for(const id of Object.keys(after.fuel.pumpOutlets)){
    const x=before.fuel.pumpOutlets[id].pumpOutletPressure;
    const y=after.fuel.pumpOutlets[id].pumpOutletPressure;
    if(x!==y) events.push({id:'FUEL.'+id,from:x,to:y,
      trajectory:trajectory(x,y)});
  }
  for(const side of ['A','B']){
    const a=before.hydraulic[side].combinedSystemPressure;
    const b=after.hydraulic[side].combinedSystemPressure;
    if(a!==b)events.push({id:'HYD.SYSTEM_'+side,from:a,to:b,
      trajectory:trajectory(a,b)});
  }
  return {events,unit:'DISCRETE_EVENT',durationSeconds:null,
    reason:'FCOM_DOES_NOT_DEFINE_PUMP_PRESSURE_TIME_CONSTANTS'};
}
module.exports={derivePressureDistribution,bindPressureSensors,
  comparePressureTransitions};
return module.exports;})();
const feederMap=(function(){const module={exports:{}};const exports=module.exports;
'use strict';
/** FCOM-backed electrical consumer feeder assessment: no invented WDM pinouts.
 * FCOM 6.20.18-19 PDF 1167-68 and §6.20.3-4 PDF 1152-53.
 */
const SOURCE='FCOM-SEPEHRAN-1937';
const loads=[
 ['FUEL.MAIN1_FWD','FUEL.TANK1_FORWARD_PUMP','FUEL',1,1167],
 ['FUEL.CTR_RIGHT','FUEL.CENTER_RIGHT_PUMP','FUEL',1,1167],
 ['HYD.B_ELECTRIC','HYD.SYSTEM_B_ELECTRIC_PUMP','HYD',1,1167],
 ['FUEL.MAIN2_FWD','FUEL.TANK2_FORWARD_PUMP','FUEL',2,1168],
 ['FUEL.CTR_LEFT','FUEL.CENTER_LEFT_PUMP','FUEL',2,1168],
 ['HYD.A_ELECTRIC','HYD.SYSTEM_A_ELECTRIC_PUMP','HYD',2,1168],
 ['FUEL.MAIN1_AFT',null,'FUEL',null,null],
 ['FUEL.MAIN2_AFT',null,'FUEL',null,null]
];
function evaluateConsumerFeederMap(e) {
 if(!e||!e.buses||!Array.isArray(e.crossSystemEffects)) throw new TypeError('electrical output required');
 const mapped={};
 for(const [id,original,category,lossSide,page] of loads) {
  const failure=e.crossSystemEffects.find(x=>x.id===original);
  let state='UNKNOWN',basis='PHYSICAL_FEEDER_BUS_UNVERIFIED';
  if(failure){state='UNPOWERED';basis='FCOM_INOPERATIVE_LIST';}
  else if(e.buses.generator1==='POWERED' && e.buses.generator2==='POWERED'){
    state='POWERED';basis='BOTH_GENERATOR_BUSES_POWERED_NOMINAL_PILOT';
  }else if(e.buses.generator1==='UNPOWERED' && e.buses.generator2==='UNPOWERED'){
    state='UNPOWERED';basis='BOTH_GENERATOR_BUSES_UNPOWERED';
  }else if(e.documentedFailureCase) {
    state='POWERED';basis='NOT_LISTED_AS_INOPERATIVE_FCOM_CASE_PROVISIONAL';
  }
  mapped[id]={
   id,category,state,basis,physicalFeederBus:null,
   exactContactorPath:null,wireAndCircuitBreaker:'UNVERIFIED',
   source:{sourceId:SOURCE,section:page===1167?'6.20.18':page===1168?'6.20.19':'6.20.3-4',pdfPage:page||1153},
   caseApplicable:e.documentedFailureCase!==null,
   mustNotInfer:'Generator failure equipment list is not a WDM wiring diagram'
  };
 }
 return {status:'FUNCTIONAL_SOURCE_GROUNDED_NOT_WDM_VERIFIED',consumers:mapped,
   transferRelays:{left:{bus:e.buses.transfer1Feed,qualifier:'FCOM_6.20.3-4'},
    right:{bus:e.buses.transfer2Feed,qualifier:'FCOM_6.20.3-4'}},
   groundRules:['AC sources cannot parallel','Source selection replaces previous generator-bus source'],
   unresolved:['actual pump supply feeder and contactor IDs','CB/relay topology','source switching transients']};
}
module.exports={evaluateConsumerFeederMap};
return module.exports;})();
const fluidObservations=(function(){const module={exports:{}};const exports=module.exports;
'use strict';
/** Hydraulic and fuel pressure network v0.2.
 * References: Sepehran 737CL FCOM 13.10.2 PDF1843 (nominal 3000 psi,
 * red max 3500 psi); 13.20.2-3 PDF1847-48; 12.20.1 PDF1834,
 * 12.20.2 PDF1835. Does not fabricate transient rates, pump flow,
 * absolute fuel psi or actual gauge readings. All quantitative readings
 * need external confirmed sensor input, validated by contract.
 */
const S='FCOM-SEPEHRAN-1937';
function requireReading(o,key,unit,max) {
 if(!o || !Object.prototype.hasOwnProperty.call(o,key)) return null;
 const n=o[key];
 if(n===null) return null;
 if(typeof n!=='number'||!Number.isFinite(n)||n<0 || (max!==null&&n>max)) throw new TypeError(key+' requires nonnegative finite '+unit);
 return n;
}
function pressureHydraulic(net,observations={}) {
 const out={};
 for(const id of ['A','B']){
  const h=net.hydraulic[id],s=h.systemPressure.state;
  const reading=requireReading(observations.hydraulicPsi,id,'psi',null);
  const consistency=reading===null?'NOT_OBSERVED':
    s==='LOW'&&reading>0?'MEASUREMENT_CONFLICT_CHECK_SENSOR':
    s==='AVAILABLE'&&reading===0?'MEASUREMENT_CONFLICT_CHECK_SENSOR':'OBSERVATION_PRESENT';
  out[id]={
   system:id,enginePumpOutput:h.engineDriven.outputPressureSensor.state,
   electricPumpOutput:h.electric.outputPressureSensor.state,
   combinedQualitative:s,
   gaugePsi:reading,measurementQuality:reading===null?'NO_MEASUREMENT':'EXTERNAL_OBSERVATION_UNVALIDATED',
   consistency,
   normalReferencePsi:3000,redMaximumReferencePsi:3500,
   simulatedPsi:null,
   model:'SOURCE_GROUNDED_QUALITATIVE_FLOW_PATH',
   unresolved:['pump displacement, reservoir depletion, load flow, response time and pressure decay not documented in FCOM'],
   source:{sourceId:S,section:'13.10.2;13.20.2-3',pdfPages:[1843,1847,1848]}
  };
 }
 return out;
}
function pressureFuel(net,observations={}){
 const mainIds=['MAIN1_FWD','MAIN1_AFT','MAIN2_FWD','MAIN2_AFT'];
 const centerIds=['CTR_LEFT','CTR_RIGHT'];
 const readings=observations.fuelPumpPsi||{};
 const pumps={};
 for(const id of [...mainIds,...centerIds]){
  const x=net.fuel[id],measured=requireReading(readings,id,'psi',null);
  pumps[id]={motor:x.motor,outletState:x.outputPressureSensor.state,
   measuredPsi:measured,simulatedPsi:null,
   observationQuality:measured===null?'NO_MEASUREMENT':'EXTERNAL_OBSERVATION_UNVALIDATED',
   model:'QUALITATIVE_SWITCH_PRESSURE_ONLY',
   source:{sourceId:S,section:'12.20.1;12.10.2-3',pdfPages:[1834,1826,1827]}};
 }
 const tank={};
 for(const [label,ids] of [['MAIN1',['MAIN1_FWD','MAIN1_AFT']],
  ['MAIN2',['MAIN2_FWD','MAIN2_AFT']],['CENTER',centerIds]]) {
  const pressure=ids.map(k=>pumps[k].outletState);
  tank[label]={pressureAvailability:pressure.includes('NORMAL')?'AVAILABLE':
    pressure.includes('UNKNOWN')?'UNKNOWN':'NO_AC_PUMP_PRESSURE',
    pumpIds:ids};
 }
 return {pumps,tank,
  sourceSelection:{preferredTank:tank.CENTER.pressureAvailability==='AVAILABLE'?'CENTER':
    tank.CENTER.pressureAvailability==='UNKNOWN'?'UNKNOWN':
    (tank.MAIN1.pressureAvailability==='AVAILABLE'||tank.MAIN2.pressureAvailability==='AVAILABLE'?
       'MAIN_TANKS':'SUCTION_FEED_POSSIBLE_NOT_MODELED'),
   criterion:'CENTER_CHECK_VALVES_OPEN_AT_LOWER_PRESSURE_THAN_MAIN; NO_NUMERICAL_PRESSURE_ASSUMED',
   source:{sourceId:S,section:'12.20.1-2',pdfPages:[1834,1835]}},
  unresolved:['fuel pressure PSI','suction feed envelope','fuel flow and engine demand','center auto shutoff delay']};
}
function evaluateFluidPressureNetwork(net,observations={}) {
 if(!net || !net.hydraulic || !net.fuel) throw new TypeError('pump network required');
 if(!observations||typeof observations!=='object')throw new TypeError('observations required');
 return {hydraulic:pressureHydraulic(net,observations),
  fuel:pressureFuel(net,observations),
  mode:'FCOM_CONSTRAINED_QUALITATIVE_WITH_OPTIONAL_MEASURED_PSI'};
}
module.exports={evaluateFluidPressureNetwork};
return module.exports;})();
const sensorEngine=(function(){const module={exports:{}};const exports=module.exports;
'use strict';

/**
 * B737CL ISN-04: explicitly injected discrete sensor fault / signal-quality layer.
 * Observed pressure switches: Fuel FCOM §12.10.2-3/12.20.1 (PDF 1826-27,
 * 1834), Hydraulic §13.10.1/13.10.4/13.20.3 (PDF 1842/1845/1848).
 * Warning system §15.20.2 (PDF 1906).
 *
 * Physical flow/pressure MUST remain owned by pressure-distribution.v0.2.
 * Sensor faults are TRAINING INJECTIONS. FCOM does not establish that these
 * electrical fault modes are detectable by aircraft hardware, nor their
 * detection thresholds/delays. Never claim a WDM-proven sensor pin/circuit.
 */
const SOURCE='FCOM-SEPEHRAN-1937';
const FUEL=['MAIN1_FWD','MAIN1_AFT','MAIN2_FWD','MAIN2_AFT','CTR_LEFT','CTR_RIGHT'];
const HYD=['A','B'];
const ids=Object.freeze([
  ...FUEL.map(k=>'FUEL.'+k),
  ...HYD.flatMap(k=>['HYD.'+k+'.ELECTRIC','HYD.'+k+'.ENGINE','HYD.'+k+'.SYSTEM'])
]);
const modes=Object.freeze(['HEALTHY','OPEN_CIRCUIT','UNPOWERED','STUCK_LOW','STUCK_NORMAL','INTERMITTENT']);
const samples=Object.freeze(['LOW','NORMAL','DROPOUT']);
const source=id=>({
  sourceId:SOURCE,
  section:id.startsWith('FUEL.')?'12.10.2-3;12.20.1':
    id.endsWith('.SYSTEM')?'13.10.4;13.20.3':'13.10.1;13.20.3',
  pdfPages:id.startsWith('FUEL.')?[1826,1827,1834]:
    id.endsWith('.SYSTEM')?[1845,1848]:[1842,1848]
});
function validateId(id){if(!ids.includes(id))throw new TypeError('Unknown sensor '+String(id));}
function validateMode(mode){if(!modes.includes(mode))throw new TypeError('Unknown sensor mode '+String(mode));}
function validateSample(value){if(!samples.includes(value))throw new TypeError('Unknown sampled signal '+String(value));}
function initialSensorConfig(){
  return Object.fromEntries(ids.map(id=>[id,{
    mode:'HEALTHY',sample:'DROPOUT',settling:false
  }]));
}
function validateSensorConfig(config){
  if(!config || typeof config!=='object')throw new TypeError('sensor config required');
  for(const id of ids){
    const c=config[id];
    if(!c || typeof c!=='object')throw new TypeError('sensor config missing '+id);
    validateMode(c.mode);validateSample(c.sample);
    if(typeof c.settling!=='boolean')throw new TypeError('sensor settling must be boolean: '+id);
  }
  for(const key of Object.keys(config))validateId(key);
}
function interpretSensor(id,truth,config){
  validateId(id);
  if(!['NORMAL','LOW','UNKNOWN'].includes(truth))
    throw new TypeError('invalid physical pressure state '+id);
  if(!config || !modes.includes(config.mode) || typeof config.settling!=='boolean')
    throw new TypeError('invalid sensor config '+id);
  validateSample(config.sample);
  let reported=truth,quality=truth==='UNKNOWN'?'UNKNOWN_PHYSICAL_INPUT':'VALID_NOMINAL_PILOT';
  if(config.settling){reported='UNKNOWN';quality='PENDING_UNVERIFIED_DURATION';}
  else if(config.mode==='OPEN_CIRCUIT'){reported='UNKNOWN';quality='INVALID_INJECTED_DISCONNECT';}
  else if(config.mode==='UNPOWERED'){reported='UNKNOWN';quality='UNPOWERED_INJECTED_SENSOR_FEED';}
  else if(config.mode==='STUCK_LOW'){reported='LOW';quality='SUSPECT_INJECTED_STUCK_LOW';}
  else if(config.mode==='STUCK_NORMAL'){reported='NORMAL';quality='SUSPECT_INJECTED_STUCK_NORMAL';}
  else if(config.mode==='INTERMITTENT'){
    reported=config.sample==='DROPOUT'?'UNKNOWN':config.sample;
    quality=reported==='UNKNOWN'?'INVALID_EXPLICIT_DROPOUT':'SUSPECT_EXPLICIT_SAMPLE';
  }
  const mismatched=(truth!=='UNKNOWN' && reported!=='UNKNOWN' && truth!==reported);
  return {
    id,physicalPressure:truth,reportedPressure:reported,quality,
    injectedFault:config.mode==='HEALTHY'?null:config.mode,
    evidenceOfWiringOrDetection:'NOT_VERIFIED_BY_FCOM',
    trainingDiagnosticMismatch:mismatched,
    settling:config.settling,delaySeconds:null,
    warningDeviceSees:'REPORTED_PRESSURE_NOT_INJECTOR_GROUND_TRUTH',
    source:source(id)
  };
}
/** Rebind the network's sensor outputs, not the physical pump or fluid state.
 * All FCOM warning conditions below are calculated by existing warning
 * engine from reported sensor state. Inhibit rules remain in control logic.
 */
function bindSensorSignals(network,physics,config){
  validateSensorConfig(config);
  const result=JSON.parse(JSON.stringify(network)),sensors={};
  const apply=(id,sensor,truth)=>{
    const sample=interpretSensor(id,truth,config[id]);
    sensors[id]=sample;
    sensor.physicalState=sample.physicalPressure;
    sensor.state=sample.reportedPressure;
    sensor.quality=sample.quality;
    sensor.faultMode=sample.injectedFault;
    sensor.signalAuthority='ISN_04_SENSOR_SIGNAL_AFTER_PRESSURE_MODEL';
    sensor.physicalAuthority=sensor.authority;
    return sample;
  };
  const lamp=p=>p==='UNKNOWN'?null:p==='LOW';
  for(const k of FUEL){
    const id='FUEL.'+k;
    const pump=result.fuel[k];
    const physical=physics.fuel.pumpOutlets[k].pumpOutletPressure;
    const obs=apply(id,pump.outputPressureSensor,physical);
    pump.lowPressureLampDemand=k.startsWith('CTR') && !pump.switchOn ?
      false:lamp(obs.reportedPressure);
  }
  for(const side of HYD){
    const h=result.hydraulic[side],p=physics.hydraulic[side];
    const e=apply('HYD.'+side+'.ELECTRIC',
      h.electric.outputPressureSensor,p.electricPumpOutlet);
    h.electric.lowPressureLampDemand=lamp(e.reportedPressure);
    const m=apply('HYD.'+side+'.ENGINE',
      h.engineDriven.outputPressureSensor,p.engineDrivenPumpOutlet);
    h.engineDriven.lowPressureLampDemand=h.engineDriven.fireSwitchPulled?
      false:lamp(m.reportedPressure);
    // Physical system pressure is immutable by a sensor injection.
    const physicalSystem=p.combinedSystemPressure==='AVAILABLE'?'NORMAL':
      p.combinedSystemPressure==='LOW'?'LOW':'UNKNOWN';
    const observed=apply('HYD.'+side+'.SYSTEM',
      { },physicalSystem);
    h.systemPressure.sensorState=observed.reportedPressure;
    h.systemPressure.sensorQuality=observed.quality;
    h.systemPressure.physicalState=p.combinedSystemPressure;
    // This is a discrete pressure-switch indication, not actual PSI.
    // The hydraulic pump fixture retains the valve switch separately and
    // the indication is inhibited when it is OFF, regardless of sensor fault.
    // The authoritative valve value is provided separately as an argument.
  }
  return {network:result,sensors};
}
function applySystemValveInhibit(result,fixture){
  for(const side of HYD){
    const h=result.network.hydraulic[side];
    const val=h.systemPressure.sensorState;
    h.flightControlLowPressureLampDemand=fixture.hydraulic.flightControlValveOn[side]?
      (val==='UNKNOWN'?null:val==='LOW'):false;
  }
  return result;
}
function compareSensorSignals(before,after){
  const changes=[];
  for(const id of ids){
    const a=before[id],b=after[id];
    if(!a||!b)throw new TypeError('sensor snapshots missing '+id);
    if(a.reportedPressure!==b.reportedPressure || a.quality!==b.quality ||
       a.physicalPressure!==b.physicalPressure)changes.push({
        id,physicalBefore:a.physicalPressure,physicalAfter:b.physicalPressure,
        reportedBefore:a.reportedPressure,reportedAfter:b.reportedPressure,
        qualityBefore:a.quality,qualityAfter:b.quality,
        durationSeconds:null
      });
  }
  return changes;
}
module.exports={SENSOR_IDS:ids,SENSOR_MODES:modes,SENSOR_SAMPLES:samples,
  initialSensorConfig,validateId,validateMode,validateSample,
  validateSensorConfig,interpretSensor,bindSensorSignals,
  applySystemValveInhibit,compareSensorSignals};
return module.exports;})();
const firePilot=(function(){const module={exports:{}};const exports=module.exports;
'use strict';

/**
 * 737 Classic engine overheat/fire detection: isolated, testable pilot model.
 * FCOM Sepehran D6-27370-300/400/500-SHI, §8.20.1-2,
 * private source PDF physical pages 1234-1235.
 *
 * NOT a full thermal detector model: A/B overheat and fire flags are outputs
 * of a yet-to-be-implemented sensor physics layer. No temperatures, debounce
 * times or wiring assumptions are invented here.
 *
 * No UI effects; never directly writes lamps or plays audio.
 */
const VALID_SELECTORS = new Set(['NORMAL', 'A', 'B']);

function checkLoop(loop, side) {
  if (!loop || typeof loop !== 'object') {
    throw new TypeError('loop ' + side + ' must be provided');
  }
  for (const field of ['healthy', 'overheat', 'fire']) {
    if (typeof loop[field] !== 'boolean') {
      throw new TypeError('loop ' + side + '.' + field + ' must be boolean');
    }
  }
}

/**
 * @param {Object} input
 * @param {'NORMAL'|'A'|'B'} input.selector
 * @param {'POWERED'|'UNPOWERED'} input.power
 * @param {{A:{healthy:boolean,overheat:boolean,fire:boolean},
 *          B:{healthy:boolean,overheat:boolean,fire:boolean}}} input.loops
 * @param {boolean} [input.fireWarnAcknowledged]
 * @param {boolean} [input.masterCautionAcknowledged]
 * @returns {Object} derived detector/alert conditions (no mutable state)
 */
function evaluateEngineFireDetection(input) {
  if (!input || !VALID_SELECTORS.has(input.selector)) {
    throw new TypeError('selector must be NORMAL, A or B');
  }
  if (!['POWERED', 'UNPOWERED'].includes(input.power)) {
    throw new TypeError('power must be POWERED or UNPOWERED');
  }
  if (typeof (input.fireWarnAcknowledged ?? false) !== 'boolean' ||
      typeof (input.masterCautionAcknowledged ?? false) !== 'boolean') {
    throw new TypeError('acknowledgement values must be boolean');
  }
  if (!input.loops) throw new TypeError('loops A and B are required');
  checkLoop(input.loops.A, 'A');
  checkLoop(input.loops.B, 'B');

  // The FCOM documents detector dependence on the battery bus, but
  // not the complete cockpit indication behavior with that bus dead.
  // UNKNOWN is intentional: do not fabricate a lit FAULT or a clear warning.
  if (input.power === 'UNPOWERED') {
    return {
      sensorStatus: 'UNPOWERED', operational: false,
      activeLoops: [], silentlyDegraded: null, detectorFault: null,
      overheatDetected: null, fireDetected: null,
      alerts: {
        engOverheat: null, ovhtDet: null, masterCaution: null,
        engFireSwitch: null, masterFireWarn: null, fireBell: null
      },
      reason: 'DETECTION_BUS_UNPOWERED_INDICATION_UNVERIFIED'
    };
  }

  const l = input.loops;
  const healthy = input.selector === 'NORMAL'
    ? ['A','B'].filter(side => l[side].healthy)
    : (l[input.selector].healthy ? [input.selector] : []);
  const operational = healthy.length > 0;
  const silentlyDegraded = input.selector === 'NORMAL' && healthy.length === 1;
  const detectorFault = !operational;

  // In NORMAL, healthy A AND B must agree. If one fails, it is automatically
  // excluded and the surviving loop operates alone without a failure light.
  const vote = field => !operational ? false :
    (healthy.length === 1 ? l[healthy[0]][field] :
      l.A[field] && l.B[field]);
  const fire = vote('fire');
  const overheat = vote('overheat') || fire;
  const fa = input.fireWarnAcknowledged ?? false;
  const ca = input.masterCautionAcknowledged ?? false;
  return {
    sensorStatus: detectorFault ? 'FAULT' : silentlyDegraded ? 'DEGRADED' : 'VALID',
    operational, activeLoops: healthy, silentlyDegraded, detectorFault,
    overheatDetected: overheat, fireDetected: fire,
    alerts: {
      engOverheat: overheat,
      ovhtDet: overheat,
      masterCaution: overheat && !ca,
      engFireSwitch: fire,
      masterFireWarn: fire && !fa,
      fireBell: fire && !fa
    },
    reason: detectorFault ? 'SELECTED_DETECTORS_INOPERATIVE' :
      silentlyDegraded ? 'ONE_LOOP_AUTOMATICALLY_ISOLATED' : 'NOMINAL'
  };
}

module.exports = { evaluateEngineFireDetection };
return module.exports;})();
const annunciator=(function(){const module={exports:{}};const exports=module.exports;
'use strict';
/**
 * ISN-05: logical output adapter, NOT aircraft WDM lamp-pin validation.
 * FCOM Sepehran Ch 12 §12.10.2-3 PDF pp1826-27; Ch13 §13.10.1,
 * 13.10.4 pp1842,1845; Ch15 §15.20.1-4 pp1905-08;
 * Ch8 §8.20.1-2 pp1234-35.
 *
 * The real visual output layer gets lamp commands, physical visibility
 * confidence, and an audio *intent* (not an automatically played file).
 * In particular: MASTER CAUTION / FUEL / HYD low pressure have NO
 * general caution aural cue in these source cases.
 */
const SOURCE='FCOM-SEPEHRAN-1937';
const ref=(section,pdfPages)=>({sourceId:SOURCE,section,pdfPages});
const desc={
  masterCaution:ref('15.20.2',[1906]),
  system:ref('15.20.3-4',[1907,1908]),
  fuel:ref('12.10.2-3',[1826,1827]),
  hydraulic:ref('13.10.1,13.10.4',[1842,1845]),
  fire:ref('8.20.1-2,15.20.2',[1234,1235,1906])
};
function logical(v){
  if(v===true)return 'ON';
  if(v===false)return 'OFF';
  if(v===null||v===undefined)return 'UNKNOWN';
  throw new TypeError('lamp input must be boolean or null');
}
function annunciationDisplay(logicalDemand, panelPower){
  if(panelPower==='PILOT_ASSUMED_PANEL_AVAILABLE')return logical(logicalDemand);
  return 'UNKNOWN';
}
function makeLamp(id,control,kind,source,power,group){
  const demand=logical(control);
  return {
    id,group,severity:kind,
    logicalDemand:demand,
    projectedVisibility:annunciationDisplay(control,power),
    actualLampCircuit:'NOT_VERIFIED_WDM',
    source
  };
}
function projectAnnunciation(view,fire,propulsion){
  if(!view||!view.warnings||!view.pumps||!view.electrical)
    throw new TypeError('integrated aircraft view required');
  if(!fire||!fire.alerts)
    throw new TypeError('fire-detection evaluation required');
  const warning=view.warnings, panelPower=warning.displayPower;
  const lamps={};
  const set=(id,d,kind,source,group='OVERHEAD')=>{
    lamps[id]=makeLamp(id,d,kind,source,panelPower,group);
  };
  set('MASTER_CAUTION_CAPT',warning.masterCaution.logicalDemand,'CAUTION',desc.masterCaution,'GLARESHIELD');
  set('MASTER_CAUTION_FO',warning.masterCaution.logicalDemand,'CAUTION',desc.masterCaution,'GLARESHIELD');
  // System-annunciator lenses are resettable. Existing warning domain
  // owns active causes and ACKs; recall can temporarily show simple faults.
  // Keep physical pump pressure lamps independent of master ACK.
  const anyUnack=warning.unacknowledgedCauseIds.length>0;
  const recalling=view.warningControl?.recallPressed===true;
  const activeSystem=id=>view.warningCauses.active.some(x=>x.system===id && 
    warning.unacknowledgedCauseIds.includes(x.id));
  const simpleSystem=id=>recalling && view.warningCauses.simple.some(x=>x.system===id);
  const fuelAnn=activeSystem('FUEL')||simpleSystem('FUEL');
  const fltAnn=activeSystem('FLT CONT');
  const hydAnn=warning.systemAnnunciators.HYD.logicalDemand===null?
    null:(activeSystem('FLT CONT')?true:false);
  set('ANNUN_FUEL',fuelAnn,'CAUTION',desc.system,'GLARESHIELD');
  set('ANNUN_HYD',hydAnn,'CAUTION',desc.system,'GLARESHIELD');
  set('ANNUN_FLT_CONT',fltAnn,'CAUTION',desc.system,'GLARESHIELD');
  set('ANNUN_OVHT_DET',activeSystem('OVHT/DET'),'CAUTION',desc.system,'GLARESHIELD');
  // Electrical system status: bus state is NOT equivalent to bus-off
  // bulb-feed logic; explicit uncertain until source schematic is audited.
  set('ANNUN_ELEC',null,'CAUTION',ref('6.20.1-19,15.20.3',[1150,1168,1907]),'GLARESHIELD');
  for(const [id,pump] of Object.entries(view.pumps.fuel))
    set('FUEL_'+id+'_LOW',pump.lowPressureLampDemand,'CAUTION',desc.fuel,'FUEL_PANEL');
  for(const [system,p] of Object.entries(view.pumps.hydraulic)){
    set('HYD_'+system+'_ELEC_LOW',p.electric.lowPressureLampDemand,'CAUTION',desc.hydraulic,'HYD_PANEL');
    set('HYD_'+system+'_ENG_LOW',p.engineDriven.lowPressureLampDemand,'CAUTION',desc.hydraulic,'HYD_PANEL');
    set('FLT_CONT_'+system+'_LOW',p.flightControlLowPressureLampDemand,'CAUTION',desc.hydraulic,'FLT_CONT_PANEL');
  }
  // Fire section: these are DETECTOR outputs, not actual thermodynamic fire.
  // MASTER FIRE WARN is separate from MASTER CAUTION and has a separate
  // acknowledgement/cutout (FCOM §15.20.2).
  set('ENG1_FIRE_SWITCH',fire.alerts.engFireSwitch,'WARNING',desc.fire,'FIRE_PANEL');
  set('ENG1_OVHT',fire.alerts.engOverheat,'CAUTION',desc.fire,'FIRE_PANEL');
  set('MASTER_FIRE_WARN_CAPT',fire.alerts.masterFireWarn,'WARNING',desc.fire,'GLARESHIELD');
  set('MASTER_FIRE_WARN_FO',fire.alerts.masterFireWarn,'WARNING',desc.fire,'GLARESHIELD');
  if(propulsion&&propulsion.mode==='INTEGRATED'){
    // §7.30.2: APU GEN OFF BUS annunciates load-ready power awaiting
    // electrical bus connection. This is a logical indication demand.
    set('APU_GEN_OFF_BUS',propulsion.apu.generatorOffBusLightDemand,
      'CAUTION',ref('7.30.2',[1217]),'APU_PANEL');
    const pneumatic=propulsion.pneumatic?.distribution;
    if(pneumatic){
      set('DUAL_BLEED',pneumatic.dualBleedLightDemand,
        'CAUTION',ref('2.10.2;2.20.2',[983,1001]),'AIR_SYSTEM_PANEL');
      for(const side of ['1','2']){
        set('BLEED_TRIP_'+side,pneumatic.engineValves[side].bleedTripLatched,
          'CAUTION',ref('2.10.3;2.20.1',[984,1000]),'AIR_SYSTEM_PANEL');
      }
    }
    for(const side of ['1','2']){
      set('ENG'+side+'_EGT_FLASH',propulsion.protection.engines[side].egtDigitalFlashDemand,
        'ADVISORY',ref('7.20.7',[1208]),'ENGINE_PANEL');
    }
    for(const id of ['1','2']){
      // The start valve is a physical sensor/feedback indication, not an
      // invented consequence of selecting GRD.
      set('ENG'+id+'_START_VALVE_OPEN',
        propulsion.engines[id].startValveOpenIndication,
        'CAUTION',ref('7.20.7,NP.21.34-35',[1208,134,135]),
        'ENGINE_PANEL');
    }
  }
  const sound=fire.alerts.fireBell;
  const audio={
    activeKeys:sound===true?['fireBell']:[],
    unresolvedKeys:sound===null?['fireBell']:[],
    rules:{
      fireBell:{
        condition:sound===null?'UNKNOWN':sound?'ACTIVE':'INACTIVE',
        key:'fireBell',priority:95,
        auralModulePower:'UNVERIFIED',
        sampleCandidate:'fire-alarm.mp3',
        physicalPlayer:'NOT_CONNECTED_BY_THIS_PURE_FUNCTION',
        source:desc.fire
      },
      masterCaution:{
        condition:'NO_GENERAL_AURAL_IN_FCOM_CASE',
        key:null,
        source:desc.masterCaution
      }
    }
  };
  return {
    schema:'b737cl-annunciation-isn05-v0.1',
    lamps,audio,
    confirmedLogicPower:panelPower,
    panelProjectionQuality:warning.displayQuality,
    warningCauseIds:[...warning.causeIds],
    simpleRecallIds:[...warning.simpleRecallIds],
    unresolvedIndications:[...warning.unresolvedCauses],
    unresolvedPhysical:['Individual lamp supply and electrical warning relay WDM/SSM',
      'Master fire lamp feed and aural module supply',
      'Graphic panel coordinates pending cockpit artwork reference calibration'],
    provenance:desc
  };
}
function compareAnnunciation(before,after){
  if(!before||!after)throw new TypeError('annunciation snapshots required');
  const changes=Object.keys(after.lamps).filter(id=>{
    const a=before.lamps[id],b=after.lamps[id];
    return !a||a.logicalDemand!==b.logicalDemand||
      a.projectedVisibility!==b.projectedVisibility;
  }).map(id=>({
    id,from:before.lamps[id]?.logicalDemand||'UNKNOWN',
    to:after.lamps[id].logicalDemand,
    projectedVisibility:after.lamps[id].projectedVisibility
  }));
  const oldKeys=new Set(before.audio.activeKeys),newKeys=new Set(after.audio.activeKeys);
  const start=[...newKeys].filter(k=>!oldKeys.has(k));
  const stop=[...oldKeys].filter(k=>!newKeys.has(k));
  return {lamps:changes,audio:{
    start:start.map(key=>({key,command:'START',source:'FIRE_DETECTOR_CONDITION'})),
    stop:stop.map(key=>({key,command:'STOP',source:'CLEARED_OR_ACKNOWLEDGED'})),
    keep:[...newKeys].filter(k=>oldKeys.has(k)).map(key=>({key,command:'HOLD'}))
  }};
}
module.exports={projectAnnunciation,compareAnnunciation};
return module.exports;})();
const safetyEngine=(function(){const module={exports:{}};const exports=module.exports;
'use strict';
/**
 * ISN-07: source-indexed discrete bleed valves, trips, APU protections,
 * and observed-input engine start protections. NOT an AMM/WDM air-flow solver.
 * FCOM Sepehran §2.10.2-3 (PDF 983-984), §2.20.1-2 (1000-1001),
 * §7.20.7 (1208), §7.30.3 (1218), NP.21.33-35 (133-135).
 */
const SOURCE='FCOM-SEPEHRAN-1937';
const ref=(section,pages)=>({sourceId:SOURCE,section,pdfPages:pages});
const IDS=['1','2'];
const APU_SHUTDOWN=new Set(['OVERSPEED','LOW_OIL_PRESSURE','HIGH_OIL_TEMPERATURE','FIRE','FCU_FAILURE']);
const FAULT_IDS=[...APU_SHUTDOWN,'BLEED_OVERTEMP'];
const finite=(v,n,lo,hi)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<lo||v>hi)throw new TypeError(n+' invalid');};
const bool=(v,n)=>{if(typeof v!=='boolean')throw new TypeError(n+' must be boolean');};
const sel=(v,list,n)=>{if(!list.includes(v))throw new TypeError(n+' invalid');};
const side=id=>sel(String(id),IDS,'engine');
function initializeProtection(){
 const e=()=>({
   starterElapsedSeconds:0,attemptCount:0,cooldownRemainingSeconds:0,
   startFault:null,secondsAfterIdle:0,egtC:null,egtRiseConfirmed:null,
   n2Acceleration:'UNKNOWN',oilPressureIndicated:null
 });
 return {
   pneumatic:{
     isolationSwitch:'AUTO',engineBleedSwitches:{'1':true,'2':true},
     packs:{L:'OFF',R:'OFF'},
     bleedTripCondition:{'1':false,'2':false},
     bleedTripLatched:{'1':false,'2':false}
   },
   apuFaultSignals:Object.fromEntries(FAULT_IDS.map(k=>[k,false])),
   engines:{'1':e(),'2':e()}
 };
}
function verifyStartAttempt(p,id) {
 const e=p.safety.engines[id],eng=p.engines[id];
 if(eng.startSwitch==='GRD')return;
 if(e.cooldownRemainingSeconds>0)throw new Error('STARTER_COOLDOWN_REQUIRED: '+e.cooldownRemainingSeconds+'s');
 if(e.startFault==='STARTER_DUTY_LIMIT')throw new Error('STARTER_DUTY_FAULT_REQUIRES_RESET');
 if(e.attemptCount>0 && eng.n2Pct>=20 && !eng.lightoffConfirmed)
   throw new Error('EARLY_START_REENGAGEMENT_REQUIRES_N2_BELOW_20');
}
function endStarter(e){
 if(e.starterElapsedSeconds>0||e.attemptCount>0)
   e.cooldownRemainingSeconds=Math.max(e.cooldownRemainingSeconds,e.attemptCount===1?20:180);
}
function reconcileStarterEdges(p,before){
 if(!before||before.mode!=='INTEGRATED')return;
 for(const id of IDS){
   const prior=before.engines[id],next=p.engines[id],state=p.safety.engines[id];
   if(prior.startSwitch!=='GRD'&&next.startSwitch==='GRD'){
     verifyStartAttempt(before,id);
     state.attemptCount++;state.starterElapsedSeconds=0;
     state.secondsAfterIdle=0;state.egtRiseConfirmed=null;
     state.n2Acceleration='UNKNOWN';
   } else if(prior.startSwitch==='GRD'&&next.startSwitch!=='GRD'){
     endStarter(state);
   }
   if(prior.startLever!=='IDLE'&&next.startLever==='IDLE'){
     state.secondsAfterIdle=0;state.egtRiseConfirmed=null;
   }
 }
}
function tickProtection(p,dt){
 finite(dt,'elapsed seconds',0,3600);
 const results=[];
 for(const id of IDS){
   const e=p.engines[id],s=p.safety.engines[id];
   const wasStarting=e.startSwitch==='GRD';
   if(s.cooldownRemainingSeconds>0&&!wasStarting)
     s.cooldownRemainingSeconds=Math.max(0,s.cooldownRemainingSeconds-dt);
   if(wasStarting){
     s.starterElapsedSeconds+=dt;
     if(s.starterElapsedSeconds>120){
       s.startFault='STARTER_DUTY_LIMIT';
       e.startSwitch='OFF';e.startLever='CUTOFF';
       e.phase='OFF';e.lightoffConfirmed=false;
       endStarter(s);
       results.push({id,reason:'STARTER_DUTY_LIMIT'});
     }
   }
   if(e.startLever==='IDLE'&&e.phase!=='RUNNING')s.secondsAfterIdle+=dt;
 }
 return results;
}
function resetStarterDuty(p,id){
 const s=p.safety.engines[id],e=p.engines[id];
 if(e.startSwitch==='GRD')throw new Error('Cannot reset starter duty with starter engaged');
 if(s.cooldownRemainingSeconds>0)throw new Error('Cooldown still required');
 s.startFault=null;
}
function reconcileApuProtections(p){
 const q=p.safety.apuFaultSignals;
 const shutdown=[...APU_SHUTDOWN].find(k=>q[k]);
 if(shutdown && p.apu.phase!=='OFF'){
   p.apu.phase='OFF';p.apu.switch='OFF';p.apu.bleedSwitchOn=false;
   p.apu.fault='AUTO_SHUTDOWN_'+shutdown;
 }
 return shutdown;
}
function applyProtectionAction(p,a){
 const s=p.safety,air=s.pneumatic;
 const yes=()=>bool(a.value,'value');
 switch(a.type){
 case 'SET_ISOLATION_SWITCH':
   sel(a.value,['AUTO','OPEN','CLOSE'],'isolation switch');
   air.isolationSwitch=a.value;break;
 case 'SET_ENGINE_BLEED_SWITCH':
   side(a.engine);yes();air.engineBleedSwitches[String(a.engine)]=a.value;break;
 case 'SET_PACK_SWITCH':
   sel(a.pack,['L','R'],'pack');sel(a.value,['OFF','AUTO','HIGH'],'pack switch');
   air.packs[a.pack]=a.value;break;
 case 'SET_BLEED_TRIP_CONDITION':
   side(a.engine);yes();
   air.bleedTripCondition[String(a.engine)]=a.value;
   if(a.value)air.bleedTripLatched[String(a.engine)]=true;
   break;
 case 'PUSH_BLEED_TRIP_RESET':
   for(const id of IDS)if(!air.bleedTripCondition[id])air.bleedTripLatched[id]=false;
   break;
 case 'SET_APU_PROTECTION_SIGNAL':
   sel(a.fault,FAULT_IDS,'APU protection');yes();
   s.apuFaultSignals[a.fault]=a.value;break;
 case 'SET_ENGINE_EGT_C':
   side(a.engine);
   if(a.value!==null)finite(a.value,'EGT degC',-100,1300);
   s.engines[String(a.engine)].egtC=a.value;break;
 case 'SET_ENGINE_EGT_RISE_CONFIRMED':
   side(a.engine);
   if(a.value!==null)yes();
   s.engines[String(a.engine)].egtRiseConfirmed=a.value;break;
 case 'SET_ENGINE_N2_ACCELERATION':
   side(a.engine);sel(a.value,['NORMAL','SLOW','UNKNOWN'],'N2 acceleration');
   s.engines[String(a.engine)].n2Acceleration=a.value;break;
 case 'SET_ENGINE_OIL_PRESSURE_INDICATED':
   side(a.engine);if(a.value!==null)yes();
   s.engines[String(a.engine)].oilPressureIndicated=a.value;break;
 case 'RESET_STARTER_DUTY_FAULT':
   side(a.engine);resetStarterDuty(p,String(a.engine));break;
 default:throw new TypeError('Unsupported ISN07 action '+String(a.type));
 }
}
const PROTECTION_COMMANDS=new Set([
 'SET_ISOLATION_SWITCH','SET_ENGINE_BLEED_SWITCH','SET_PACK_SWITCH',
 'SET_BLEED_TRIP_CONDITION','PUSH_BLEED_TRIP_RESET',
 'SET_APU_PROTECTION_SIGNAL','SET_ENGINE_EGT_C','SET_ENGINE_EGT_RISE_CONFIRMED',
 'SET_ENGINE_N2_ACCELERATION','SET_ENGINE_OIL_PRESSURE_INDICATED',
 'RESET_STARTER_DUTY_FAULT'
]);
/**
 * The isolator is AC-operated; command and verified physical actuation are
 * not interchangeable. With normal AC available we use a clearly labeled
 * nominal actuator assumption for training; otherwise UNKNOWN, not CLOSED.
 */
function evaluatePneumatics(p,electrical) {
 const s=p.safety, a=s.pneumatic;
 const isolationCommand=a.isolationSwitch==='AUTO'?
  (a.engineBleedSwitches['1']&&a.engineBleedSwitches['2']&&
   a.packs.L!=='OFF'&&a.packs.R!=='OFF'?'CLOSE':'OPEN'):
  a.isolationSwitch;
 const acKnown=(electrical.buses.generator1==='POWERED'||
   electrical.buses.generator2==='POWERED');
 const isolation=acKnown?isolationCommand:'UNKNOWN';
 const apuOvertemp=s.apuFaultSignals.BLEED_OVERTEMP;
 const apuValve=p.apu.phase==='AVAILABLE'&&p.apu.bleedSwitchOn&&!apuOvertemp;
 const engineValves={};
 for(const id of IDS){
   engineValves[id]={
    command:a.engineBleedSwitches[id],
    observed:'UNVERIFIED_VALVE_FEEDBACK',
    available:p.engines[id].phase==='RUNNING'&&a.engineBleedSwitches[id]&&!a.bleedTripLatched[id],
    bleedTripCondition:a.bleedTripCondition[id],
    bleedTripLatched:a.bleedTripLatched[id],
    source:ref('2.10.3;2.20.1',[984,1000])
   };
 }
 const dualBleed=apuValve&&(
   a.engineBleedSwitches['1']||
   (a.engineBleedSwitches['2']&&isolation==='OPEN'));
 const dualUncertain=apuValve&&!a.engineBleedSwitches['1']&&
   a.engineBleedSwitches['2']&&isolation==='UNKNOWN';
 const target={};
 for(const id of IDS){
   const local=engineValves[id].available;
   // APU feed connects to No.1 side by the FCOM 2.20.3 schematic; exact
   // flow/pressure under isolation transition is still not calculated.
   const apuReach=apuValve&&(id==='1'||isolation==='OPEN');
   const cartReach=p.pneumatic.groundCartOn&&(id==='2'||isolation==='OPEN');
   const crossReach=p.pneumatic.crossbleedOn&&(
     id==='1'?engineValves['2'].available:engineValves['1'].available)&&
       isolation==='OPEN';
   let source=apuReach?'APU':cartReach?'GROUND_CART':
     crossReach?'ENGINE_CROSSBLEED':local?'ENGINE_BLEED_SELF':'NONE';
   let access='AVAILABLE';
   if(source==='NONE'){
     source=(isolation==='UNKNOWN' &&(apuValve||p.pneumatic.groundCartOn ||
      p.pneumatic.crossbleedOn))?'UNKNOWN_ROUTING':'NONE';
     access=source==='NONE'?'UNAVAILABLE':'UNKNOWN';
   }
   target[id]={source,access};
 }
 return {
   isolation:{switch:a.isolationSwitch,command:isolationCommand,
     nominalProjectedPosition:isolation,actualValveFeedback:null,
     quality:acKnown?'NOMINAL_ACTUATOR_PILOT':'AC_ACTUATOR_UNVERIFIED'},
   engineValves,apuBleedValve:{command:p.apu.bleedSwitchOn,
     projectedOpen:apuValve,overTemperatureShutdown:apuOvertemp,
     actualValveFeedback:null},
   dualBleedLightDemand:dualUncertain?null:dualBleed,
   engines:target,
   source:ref('2.10.2-3;2.20.1-3',[983,984,1000,1001,1002]),
   unresolved:['No valve travel times or duct routing pressure losses',
      'Actual valve feedback and isolation actuator circuit not WDM-verified',
      'Ground cart coupling route and partial-AC isolation behavior provisional']
 };
}
function evaluateStartProtections(p) {
 const eng={};
 for(const id of IDS){
   const s=p.safety.engines[id],e=p.engines[id];
   const reasons=[];
   if(s.startFault==='STARTER_DUTY_LIMIT')reasons.push('STARTER_DUTY_LIMIT');
   if(e.startLever==='IDLE' && e.phase!=='RUNNING'){
     if(s.egtC!==null&&s.egtC>=725)reasons.push('EGT_AT_OR_ABOVE_725_C');
     if(s.secondsAfterIdle>=10&&s.egtRiseConfirmed===false)
       reasons.push('NO_EGT_RISE_WITHIN_10_SECONDS');
     if(e.n2Pct>=32&&s.n2Acceleration==='SLOW'&&s.egtRiseConfirmed===true)
       reasons.push('SLOW_N2_ACCELERATION_AFTER_EGT_RISE');
   }
   if(e.phase==='RUNNING'&&s.oilPressureIndicated===false)
     reasons.push('NO_OIL_PRESSURE_AT_STABLE_IDLE');
   eng[id]={
     ...s,recommendedProcedure:reasons.length?'REVIEW_ABORTED_ENGINE_START':'NONE_CONFIRMED',
     advisoryReasons:reasons,
     egtDigitalFlashDemand:e.startLever==='IDLE'&&e.phase!=='RUNNING'&&
       s.egtC!==null&&s.egtC>=725,
     automaticEngineShutdown:false,
     evidence:ref('NP.21.33-35;7.20.7',[133,134,135,1208])
   };
 }
 const active=[...APU_SHUTDOWN].filter(k=>p.safety.apuFaultSignals[k]);
 const overtemp=p.safety.apuFaultSignals.BLEED_OVERTEMP;
 return {
   engines:eng,
   apu:{shutdownFaults:active,overtemperatureBleedClosure:overtemp,
     note:'APU overtemperature closes bleed, does not imply APU shutdown',
     source:ref('7.30.3',[1218])},
   source:ref('NP.21.33-35;7.30.3',[133,134,135,1218])
 };
}
module.exports={initializeProtection,PROTECTION_COMMANDS,verifyStartAttempt,
 reconcileStarterEdges,tickProtection,reconcileApuProtections,
 applyProtectionAction,evaluatePneumatics,evaluateStartProtections};
return module.exports;})();
const propulsionEngine=(function(){const module={exports:{}};const exports=module.exports;const require=(p)=>{if(p==='./electrical-power-pilot.cjs')return electrical;if(p==='./electrical-feeder-audit.v0.2.cjs')return feederAudit;if(p==='./pump-sensor-warning-engine.cjs')return consumers;if(p==='./pressure-distribution.v0.2.cjs')return pressurePhysics;if(p==='./electrical-consumer-feeders.cjs')return feederMap;if(p==='./fluid-pressure-engine.cjs')return fluidObservations;if(p==='./sensor-failure-engine.cjs')return sensorEngine;if(p==='./fire-detection-pilot.cjs')return firePilot;if(p==='./annunciation-output-engine.cjs')return annunciator;if(p==='./engine-apu-integration.cjs')return propulsionEngine;if(p==='./pneumatic-start-protection.cjs')return safetyEngine;throw new Error('Unknown browser module '+p);};
'use strict';
/**
 * ISN-06 Engine/APU/Fuel/Bleed/Electrical event integration (training pilot).
 * Private source: Sepehran 737CL FCOM NP.21.34-35 (PDF 134-135),
 * §7.10.22 (PDF 1193), §7.20.7-8 (PDF 1208-09),
 * §7.30.1-3 (PDF 1216-18), §6.20.1-4 (PDF 1150-53),
 * §12.20.1-2 (PDF 1834-35).
 *
 * No synthetic N2/EGT/duct-pressure spool-up or invented time constants.
 * Aircraft source selections remain explicit, NEVER silently paralleled.
 */
const {initializeProtection,evaluatePneumatics,evaluateStartProtections,
  verifyStartAttempt}=require('./pneumatic-start-protection.cjs');
const SOURCE='FCOM-SEPEHRAN-1937';
const src=(section,pdfPages)=>({sourceId:SOURCE,section,pdfPages});
const ENGINE_IDS=['1','2'];
const requireBool=(x,k)=>{if(typeof x!=='boolean')throw new TypeError(k+' must be boolean');};
const enumVal=(x,values,k)=>{if(!values.includes(x))throw new TypeError(k+' invalid');};
const finite=(x,k,min,max)=>{
  if(typeof x!=='number'||!Number.isFinite(x)||x<min||x>max)
    throw new TypeError(k+' outside valid observed range');
};
function initPropulsion(){
  const engine=()=>({
    phase:'OFF',startSwitch:'OFF',startLever:'CUTOFF',
    n2Pct:0,n1Rotating:false,maxMotoring:false,
    lightoffConfirmed:false,generatorHealthy:true,
    startValveOpenFeedback:null
  });
  return {
    mode:'LEGACY_FIXTURE',
    engines:{'1':engine(),'2':engine()},
    ignitionSelect:'R',
    safety:initializeProtection(),
    apu:{phase:'OFF',switch:'OFF',inletDoorOpen:false,
      fireSwitchIn:true,groundFireHandleIn:true,
      generatorHealthy:true,bleedSwitchOn:false,
      dcBoostPumpHealthy:true,stabilizationSeconds:0,
      fault:null},
    pneumatic:{groundCartOn:false,crossbleedOn:false,
      ductPsi:null,fieldElevationFt:0}
  };
}
function synchronizedInputs(snapshot){
  const e=JSON.parse(JSON.stringify(snapshot.electrical));
  const pumps=JSON.parse(JSON.stringify(snapshot.pumps));
  if(!snapshot.propulsion||snapshot.propulsion.mode!=='INTEGRATED')return {electrical:e,pumps};
  const p=snapshot.propulsion;
  e.available.GEN1=p.engines['1'].phase==='RUNNING'&&p.engines['1'].generatorHealthy;
  e.available.GEN2=p.engines['2'].phase==='RUNNING'&&p.engines['2'].generatorHealthy;
  e.available.APU=p.apu.phase==='AVAILABLE'&&p.apu.generatorHealthy;
  pumps.hydraulic.engineDriven.A.engineRunning=p.engines['1'].phase==='RUNNING';
  pumps.hydraulic.engineDriven.B.engineRunning=p.engines['2'].phase==='RUNNING';
  return {electrical:e,pumps};
}
function fuelAccess(feed, side){
  const f=feed.fuel.engineFeed['ENGINE'+side];
  const ok=['CENTER_PRIORITY','MAIN_TANK_PUMPED'].includes(f.source);
  return {state:ok?'PRESSURIZED':
    f.source==='UNKNOWN'?'UNKNOWN':'UNCONFIRMED',
    source:f.source,certainty:f.certainty,
    note:'Suction feed possible does not guarantee fuel during start'};
}
function ignitionSupply(p,electrical){
  const left=electrical.buses.transfer1==='POWERED'&&
    electrical.buses.transfer2==='POWERED'?'AVAILABLE':
    electrical.buses.transfer1==='UNPOWERED'&&
    electrical.buses.transfer2==='UNPOWERED'?'UNAVAILABLE':'UNKNOWN';
  const right=electrical.buses.acStandby==='POWERED'?'AVAILABLE':
    electrical.buses.acStandby==='UNPOWERED'?'UNAVAILABLE':'UNKNOWN';
  let state=p.ignitionSelect==='L'?left:p.ignitionSelect==='R'?right:
    (left==='AVAILABLE'||right==='AVAILABLE'?'AVAILABLE':
      left==='UNAVAILABLE'&&right==='UNAVAILABLE'?'UNAVAILABLE':'UNKNOWN');
  return {state,left,right,selector:p.ignitionSelect,
    caveat:'Left igniter AC transfer bus exact side unverified; L-only uncertain in partial-bus modes',
    source:src('7.20.8',[1209])};
}
function evaluatePropulsion(p,electrical,feed,pumps){
  if(!p||p.mode!=='INTEGRATED')return {mode:'LEGACY_FIXTURE',authority:'NONE'};
  const bat=electrical.buses.battery;
  const usable=electrical.buses.hotBattery==='POWERED';
  const apu=p.apu;
  const ready=apu.phase==='AVAILABLE';
  const apuDC=electrical.config && electrical.buses.hotBattery==='POWERED';
  const tank1=pumps.fuel.fuelAtInlet.MAIN1;
  const aFuel=tank1?(feed.fuel.engineFeed.ENGINE1.source==='CENTER_PRIORITY'||
      feed.fuel.engineFeed.ENGINE1.source==='MAIN_TANK_PUMPED'?
      'PRESSURIZED_FROM_LEFT_MANIFOLD':'SUCTION_NO1_DC_BOOST'):
      'NO_NO1_FUEL';
  const dcBoost=apu.phase==='DOOR_OPENING'||apu.phase==='STARTING'?
    (apu.dcBoostPumpHealthy&&usable?'RUNNING':'UNAVAILABLE'):
    ready?'OFF_AT_GOVERNED':'OFF';
  const pneumaticRouting=evaluatePneumatics(p,electrical);
  const apuBleed=pneumaticRouting.apuBleedValve.projectedOpen;
  const other=p.engines;
  const srcAir=pneumaticRouting.engines['1'].source===
    pneumaticRouting.engines['2'].source?
      pneumaticRouting.engines['1'].source:'MIXED';
  const minDuct= Math.max(0,30-0.5*(p.pneumatic.fieldElevationFt/1000));
  const pressure=p.pneumatic.ductPsi===null?'UNMEASURED':
    p.pneumatic.ductPsi>=minDuct?'ADEQUATE':'LOW';
  const airReady=pressure==='ADEQUATE';
  const ig=ignitionSupply(p,electrical);
  const engines={};
  for(const id of ENGINE_IDS){
    const eng=p.engines[id];
    const ownAir=pneumaticRouting.engines[id];
    const dc=bat==='POWERED';
    const valveCommand=eng.startSwitch==='GRD'?
      (dc?'COMMAND_OPEN':'UNPOWERED'):'COMMAND_CLOSED';
    const fuel=fuelAccess(feed,id);
    const gate=(eng.n2Pct>=25&&eng.n1Rotating) ||
      (eng.maxMotoring&&eng.n2Pct>=20&&eng.n1Rotating);
    const ignitionAvailable=ig.state==='AVAILABLE'&&eng.startLever==='IDLE' &&
      ['GRD','CONT','FLT'].includes(eng.startSwitch);
    let status='OFF';
    if(eng.phase==='RUNNING')status='RUNNING_CONFIRMED';
    else if(eng.startSwitch==='GRD'){
      status=!dc?'NO_DC_START_VALVE':
        !(airReady&&ownAir.access==='AVAILABLE')?'AIR_NOT_CONFIRMED':
        !gate?'MOTORING_BELOW_FUEL_INTRODUCTION':
        eng.startLever!=='IDLE'?'READY_FOR_START_LEVER':
        fuel.state!=='PRESSURIZED'?'FUEL_NOT_CONFIRMED':
        !ignitionAvailable?'IGNITION_NOT_CONFIRMED':
        eng.lightoffConfirmed?'LIGHTOFF_CONFIRMED':'AWAITING_LIGHTOFF_CONFIRMATION';
    }
    engines[id]={
      phase:eng.phase,startSwitch:eng.startSwitch,
      startLever:eng.startLever,n2Pct:eng.n2Pct,n1Rotating:eng.n1Rotating,
      starterValveCommand:valveCommand,
      startValveOpenIndication:eng.startValveOpenFeedback===null?null:eng.startValveOpenFeedback,
      air:{source:ownAir.source,measuredPsi:p.pneumatic.ductPsi,minimumPsi:minDuct,
        pressure:pressure,available:airReady&&ownAir.access==='AVAILABLE'},
      dcStarterPower:bat,ignition:{...ig,available:ignitionAvailable},
      fuel,lightoffConfirmed:eng.lightoffConfirmed,
      status,generatorAvailable:eng.phase==='RUNNING'&&eng.generatorHealthy,
      source:src('7.20.7-8,NP.21.34-35',[1208,1209,134,135])
    };
  }
  return {
    mode:'INTEGRATED',engines,
    apu:{
      phase:apu.phase,switch:apu.switch,inletDoorOpen:apu.inletDoorOpen,
      startPower:usable&&electrical.buses.switchedHotBattery==='POWERED'?'AVAILABLE':'UNAVAILABLE',
      batterySwitchRequired:true,fuel:aFuel,dcBoostPump:dcBoost,
      generatorAvailable:ready&&apu.generatorHealthy,
      generatorOffBusLightDemand:ready&&!Object.values(electrical.sourceAssignments).includes('APU'),
      bleedSource:apuBleed?'AVAILABLE':'OFF',
      recommendedBleedWarmup:{
        completed:apu.stabilizationSeconds>=60,
        secondsObserved:apu.stabilizationSeconds,
        advisoryOnly:true
      },
      fault:apu.fault,source:src('7.30.1-3',[1216,1217,1218])
    },
    pneumatic:{source:srcAir,ductPsi:p.pneumatic.ductPsi,
      minimumForStartPsi:minDuct,status:pressure,distribution:pneumaticRouting},
    protection:evaluateStartProtections(p),
    unresolved:['No automatic N2, N1, fuel-flow or EGT computation',
      'Pneumatic duct pressure is an external measurement',
      'Engine generator quality/transient after idle not modeled',
      'Actual starter-valve feedback distinct from command',
      'Exact left igniter transfer bus feeder side not WDM-verified'],
    source:src('NP.21.34-35;7.20.7-8;7.30.1-3',[134,135,1208,1209,1216,1217,1218])
  };
}
function applyPropulsionAction(p,action,context){
  if(!p||p.mode!=='INTEGRATED')throw new TypeError('ISN06 integrated mode required');
  const q=action,apu=p.apu;
  const chooseEngine=()=>{
    const id=String(q.engine);
    enumVal(id,ENGINE_IDS,'engine');return p.engines[id];
  };
  const b=()=>requireBool(q.value,'value');
  switch(q.type){
    case 'SET_APU_SWITCH':
      enumVal(q.value,['OFF','ON','START'],'APU switch');
      apu.switch=q.value;
      if(q.value==='OFF'){
        apu.phase='OFF';apu.inletDoorOpen=false;apu.bleedSwitchOn=false;
        apu.stabilizationSeconds=0;apu.fault=null;
      }else if(q.value==='START'){
        if(context.electrical.buses.switchedHotBattery!=='POWERED' ||
           !apu.fireSwitchIn || !apu.groundFireHandleIn){
          apu.phase='OFF';apu.fault='APU_START_INTERLOCK';apu.switch='ON';
        }else{
          apu.phase='DOOR_OPENING';apu.inletDoorOpen=false;
          apu.stabilizationSeconds=0;apu.fault=null;apu.switch='ON';
        }
      }
      break;
    case 'SET_APU_INLET_OPEN':
      b();apu.inletDoorOpen=q.value;
      if(q.value && apu.phase==='DOOR_OPENING')apu.phase='STARTING';
      break;
    case 'CONFIRM_APU_READY':
      if(apu.phase!=='STARTING'||!apu.inletDoorOpen ||
         !context.electrical.buses.hotBattery ||
         context.electrical.buses.hotBattery!=='POWERED' ||
         !apu.dcBoostPumpHealthy||!context.fuelAtInlet.MAIN1)
        throw new Error('APU ready cannot be confirmed: start/door/DC fuel prerequisites missing');
      apu.phase='AVAILABLE';apu.stabilizationSeconds=0;break;
    case 'SET_APU_BLEED':
      b();apu.bleedSwitchOn=q.value;break;
    case 'SET_APU_FIRE_SWITCH_IN':
      b();apu.fireSwitchIn=q.value;
      if(!q.value){apu.phase='OFF';apu.bleedSwitchOn=false;apu.switch='OFF';}
      break;
    case 'SET_APU_GROUND_FIRE_HANDLE_IN':
      b();apu.groundFireHandleIn=q.value;
      if(!q.value){apu.phase='OFF';apu.bleedSwitchOn=false;apu.switch='OFF';}
      break;
    case 'SET_APU_DC_BOOST_HEALTH':
      b();apu.dcBoostPumpHealthy=q.value;break;
    case 'SET_APU_GENERATOR_HEALTH':
      b();apu.generatorHealthy=q.value;break;
    case 'ADVANCE_SECONDS':
      finite(q.value,'seconds',0,3600);
      if(apu.phase==='AVAILABLE')apu.stabilizationSeconds+=q.value;
      break;
    case 'SET_GROUND_CART':
      b();p.pneumatic.groundCartOn=q.value;break;
    case 'SET_CROSSBLEED':
      b();p.pneumatic.crossbleedOn=q.value;break;
    case 'SET_DUCT_PSI':
      if(q.value!==null)finite(q.value,'duct psi',0,200);
      p.pneumatic.ductPsi=q.value;break;
    case 'SET_FIELD_ELEVATION_FT':
      finite(q.value,'field elevation ft',0,15000);
      p.pneumatic.fieldElevationFt=q.value;break;
    case 'SET_IGNITION_SELECTOR':
      enumVal(q.value,['L','R','BOTH'],'ignition select');
      p.ignitionSelect=q.value;break;
    case 'SET_ENGINE_START_SWITCH':{
      const eng=chooseEngine();
      enumVal(q.value,['OFF','GRD','CONT','FLT'],'engine start switch');
      if(q.value==='GRD' && eng.startSwitch!=='GRD')verifyStartAttempt(p,String(q.engine));
      eng.startSwitch=q.value;break;
    }
    case 'SET_ENGINE_START_LEVER':{
      const eng=chooseEngine();
      enumVal(q.value,['CUTOFF','IDLE'],'start lever');
      eng.startLever=q.value;
      if(q.value==='CUTOFF'){
        eng.phase='OFF';eng.lightoffConfirmed=false;
      }
      break;
    }
    case 'SET_ENGINE_N2':{
      const eng=chooseEngine();
      finite(q.value,'N2%',0,110);eng.n2Pct=q.value;
      if(eng.startSwitch==='GRD'&&q.value>=46)eng.startSwitch='OFF';
      break;
    }
    case 'SET_ENGINE_N1_ROTATION':
      b();chooseEngine().n1Rotating=q.value;break;
    case 'SET_ENGINE_MAX_MOTORING':
      b();chooseEngine().maxMotoring=q.value;break;
    case 'SET_ENGINE_START_VALVE_FEEDBACK':
      if(q.value!==null)b();
      chooseEngine().startValveOpenFeedback=q.value;break;
    case 'SET_ENGINE_GENERATOR_HEALTH':
      b();chooseEngine().generatorHealthy=q.value;break;
    case 'CONFIRM_ENGINE_LIGHTOFF':{
      const eng=chooseEngine(),evaluated=context.propulsion.engines[String(q.engine)];
      if(eng.startLever!=='IDLE' || evaluated.status!=='AWAITING_LIGHTOFF_CONFIRMATION')
        throw new Error('Engine lightoff prerequisites not met: N2, air, power, fuel or ignition');
      eng.lightoffConfirmed=true;eng.phase='MOTORING';break;
    }
    case 'CONFIRM_ENGINE_IDLE':{
      const eng=chooseEngine();
      if(!eng.lightoffConfirmed||eng.n2Pct<46||eng.startLever!=='IDLE')
        throw new Error('Stable idle requires confirmed lightoff, N2 >=46 and lever IDLE');
      eng.phase='RUNNING';eng.startSwitch='OFF';break;
    }
    case 'ABORT_ENGINE_START':{
      const eng=chooseEngine();
      eng.phase='OFF';eng.startLever='CUTOFF';
      eng.startSwitch='OFF';eng.lightoffConfirmed=false;break;
    }
    default:throw new TypeError('Unsupported propulsion action '+String(q.type));
  }
}
const PROPULSION_COMMANDS=new Set([
'SET_APU_SWITCH','SET_APU_INLET_OPEN','CONFIRM_APU_READY','SET_APU_BLEED',
'SET_APU_FIRE_SWITCH_IN','SET_APU_GROUND_FIRE_HANDLE_IN',
'SET_APU_DC_BOOST_HEALTH','SET_APU_GENERATOR_HEALTH','ADVANCE_SECONDS',
'SET_GROUND_CART','SET_CROSSBLEED','SET_DUCT_PSI',
'SET_FIELD_ELEVATION_FT','SET_IGNITION_SELECTOR',
'SET_ENGINE_START_SWITCH','SET_ENGINE_START_LEVER','SET_ENGINE_N2',
'SET_ENGINE_N1_ROTATION','SET_ENGINE_MAX_MOTORING',
'SET_ENGINE_START_VALVE_FEEDBACK','SET_ENGINE_GENERATOR_HEALTH',
'CONFIRM_ENGINE_LIGHTOFF','CONFIRM_ENGINE_IDLE','ABORT_ENGINE_START']);
module.exports={initPropulsion,synchronizedInputs,evaluatePropulsion,
  applyPropulsionAction,PROPULSION_COMMANDS};
return module.exports;})();
const kernel=(function(){const module={exports:{}};const exports=module.exports;const require=(p)=>{if(p==='./electrical-power-pilot.cjs')return electrical;if(p==='./electrical-feeder-audit.v0.2.cjs')return feederAudit;if(p==='./pump-sensor-warning-engine.cjs')return consumers;if(p==='./pressure-distribution.v0.2.cjs')return pressurePhysics;if(p==='./electrical-consumer-feeders.cjs')return feederMap;if(p==='./fluid-pressure-engine.cjs')return fluidObservations;if(p==='./sensor-failure-engine.cjs')return sensorEngine;if(p==='./fire-detection-pilot.cjs')return firePilot;if(p==='./annunciation-output-engine.cjs')return annunciator;if(p==='./engine-apu-integration.cjs')return propulsionEngine;if(p==='./pneumatic-start-protection.cjs')return safetyEngine;throw new Error('Unknown browser module '+p);};
'use strict';

/**
 * Deterministic standalone B737CL power->pump->pressure sensor->warning
 * integration kernel. Uses real electrical pilot output; no static mock
 * caution flags. Fixed test-fixture configuration only, not a flight model.
 */
const {evaluateElectricalPower}=require('./electrical-power-pilot.cjs');
const {evaluateAllFeeders,compareElectricalTransitions}=
  require('./electrical-feeder-audit.v0.2.cjs');
const {derivePressureDistribution,bindPressureSensors,comparePressureTransitions}=
  require('./pressure-distribution.v0.2.cjs');
const {FUEL_IDS,HYD_IDS,evaluatePumpNetwork,evaluateWarningCauses,
  projectWarnings}=require('./pump-sensor-warning-engine.cjs');

const {evaluateConsumerFeederMap}=require('./electrical-consumer-feeders.cjs');
const {evaluateFluidPressureNetwork}=require('./fluid-pressure-engine.cjs');

const {initialSensorConfig,validateId:validateSensorId,
  validateMode:validateSensorMode,validateSample:validateSensorSample,
  bindSensorSignals,applySystemValveInhibit,compareSensorSignals}=
    require('./sensor-failure-engine.cjs');

const {evaluateEngineFireDetection}=require('./fire-detection-pilot.cjs');
const {projectAnnunciation,compareAnnunciation}=
  require('./annunciation-output-engine.cjs');

const {initPropulsion,synchronizedInputs,evaluatePropulsion,
  applyPropulsionAction,PROPULSION_COMMANDS}=
  require('./engine-apu-integration.cjs');

const {PROTECTION_COMMANDS,applyProtectionAction,reconcileStarterEdges,
  tickProtection,reconcileApuProtections}=
  require('./pneumatic-start-protection.cjs');

const clone = x => JSON.parse(JSON.stringify(x));
const bool = (v,n) => {if(typeof v !== 'boolean') throw new TypeError(n+' must be boolean');};
const pick = (v,allowed,name) => {
  if(!allowed.includes(v)) throw new TypeError(name+' invalid: '+String(v));
};
const one = (obj, prop, value) => {obj[prop]=value;};
function initialAircraftState() {
  const fuelSwitches=Object.fromEntries(FUEL_IDS.map(k=>[k,true]));
  const healthy=Object.fromEntries(FUEL_IDS.map(k=>[k,true]));
  return {
    schema:'b737cl-integration-kernel-v0.1',
    step:0,
    electrical:{
      phase:'AIR',busTransfer:'AUTO',standbySwitch:'AUTO',
      selected:{bus1:'GEN1',bus2:'GEN2'},
      available:{GEN1:true,GEN2:true,APU:false,EXT:false},
      batterySwitchOn:true,batteryUsable:true,inverterOperable:true,
      glideSlopeCaptured:false,groundPowerSwitchOn:false,
      groundServiceSwitchOn:false,
      trOperable:{TR1:true,TR2:true,TR3:true}
    },
    pumps:{
      fuel:{
        switches:fuelSwitches,healthy,
        fuelAtInlet:{MAIN1:true,MAIN2:true,CENTER:true},
        centerAutoCutoff:{CTR_LEFT:false,CTR_RIGHT:false}
      },
      hydraulic:{
        electricSwitches:{A:true,B:true},
        electricHealthy:{A:true,B:true},
        fluidAvailable:{A:true,B:true},
        flightControlValveOn:{A:true,B:true},
        engineDriven:{
          A:{switchOn:true,engineRunning:true,healthy:true,fireSwitchPulled:false},
          B:{switchOn:true,engineRunning:true,healthy:true,fireSwitchPulled:false}
        }
      }
    },
    sensors:initialSensorConfig(),
    propulsion:initPropulsion(),
    fire:{selector:'NORMAL',acknowledged:false,
      loops:{A:{healthy:true,overheat:false,fire:false},
        B:{healthy:true,overheat:false,fire:false}}},
    warning:{acknowledged:[],activeCauseIds:[],recallPressed:false}
  };
}

/** All subsystem outputs derive from one consistent input snapshot. */
function deriveAircraftState(snapshot) {
  if(!snapshot || snapshot.schema!=='b737cl-integration-kernel-v0.1')
    throw new TypeError('B737CL integration state required');
  const modeled=synchronizedInputs(snapshot);
  const electrical=evaluateElectricalPower(modeled.electrical);
  const preliminary=evaluatePumpNetwork(electrical,modeled.pumps);
  const pressurePhysics=derivePressureDistribution(electrical,preliminary,modeled.pumps);
  const physicalNetwork=bindPressureSensors(preliminary,pressurePhysics,modeled.pumps);
  const observed=applySystemValveInhibit(
    bindSensorSignals(physicalNetwork,pressurePhysics,snapshot.sensors),
    modeled.pumps);
  const network=observed.network;
  const electricalFeeders=evaluateAllFeeders(electrical);
  const propulsion=evaluatePropulsion(snapshot.propulsion,electrical,pressurePhysics,modeled.pumps);
  const fireDetection=evaluateEngineFireDetection({
    selector:snapshot.fire.selector,
    power:electrical.fireDetectionPower,
    loops:snapshot.fire.loops,
    fireWarnAcknowledged:snapshot.fire.acknowledged
  });
  const causes=evaluateWarningCauses(network);
  if(fireDetection.overheatDetected===true){
    causes.active.push({
      id:'OVHT_DET.ENG1_OVERHEAT',system:'OVHT/DET',
      source:{sourceId:'FCOM-SEPEHRAN-1937',section:'8.20.1-2,15.20.3',
        pdfPages:[1234,1235,1907]}
    });
  }else if(fireDetection.overheatDetected===null){
    causes.unresolved.push('OVHT_DET.ENG1_DETECTOR_UNPOWERED');
  }
  const warnings=projectWarnings(network,causes,electrical,snapshot.warning);
  const announInput={warnings,pumps:network,electrical,warningCauses:causes,
    warningControl:snapshot.warning};
  const annunciation=projectAnnunciation(announInput,fireDetection,propulsion);
  return {step:snapshot.step,electrical,electricalFeeders,pressurePhysics,
    pumps:network,sensors:observed.sensors,warnings,warningCauses:causes,
    fireDetection,annunciation,propulsion,
    sourceModel:'FCOM_REFERENCED_PRESSURE_AND_FEEDER_V0.2_PILOT'};
}

/** Atomic source/switch/fault input transition and cause-latch update. */
function transitionAircraftState(previous,action) {
  if(!action || typeof action!=='object') throw new TypeError('action required');
  const before=deriveAircraftState(previous);
  const state=clone(previous),p=action;
  const e=state.electrical, f=state.pumps.fuel, h=state.pumps.hydraulic;
  const validateBoolean=()=>bool(p.value,p.type+'.value');
  const fuelId=()=>pick(p.pump,FUEL_IDS,'pump');
  const side=()=>pick(p.system,HYD_IDS,'system');
  switch(p.type) {
    case 'SET_GENERATOR_AVAILABLE':
      if(state.propulsion?.mode==='INTEGRATED'&&p.generator!=='EXT')
        throw new Error('Integrated engine/APU authority owns GEN availability');
      pick(p.generator,['GEN1','GEN2','APU','EXT'],'generator');
      validateBoolean();one(e.available,p.generator,p.value);break;
    case 'SET_GENERATOR_SOURCE':
      pick(p.bus,['bus1','bus2'],'bus');
      pick(p.value,p.bus==='bus1'?['GEN1','APU','EXT','NONE']:['GEN2','APU','EXT','NONE'],'value');
      one(e.selected,p.bus,p.value);break;
    case 'SET_BUS_TRANSFER':
      pick(p.value,['AUTO','OFF'],'value');e.busTransfer=p.value;break;
    case 'SET_STANDBY':
      pick(p.value,['AUTO','OFF','BAT'],'value');e.standbySwitch=p.value;break;
    case 'SET_PHASE':
      pick(p.value,['AIR','GROUND'],'value');e.phase=p.value;break;
    case 'SET_BATTERY_USABLE':
      validateBoolean();e.batteryUsable=p.value;break;
    case 'SET_BATTERY_SWITCH':
      validateBoolean();e.batterySwitchOn=p.value;break;
    case 'SET_INVERTER_OPERABLE':
      validateBoolean();e.inverterOperable=p.value;break;
    case 'SET_FUEL_PUMP_SWITCH':
      fuelId();validateBoolean();f.switches[p.pump]=p.value;break;
    case 'SET_FUEL_PUMP_HEALTH':
      fuelId();validateBoolean();f.healthy[p.pump]=p.value;break;
    case 'SET_FUEL_INLET':
      pick(p.tank,['MAIN1','MAIN2','CENTER'],'tank');
      validateBoolean();f.fuelAtInlet[p.tank]=p.value;break;
    case 'SET_CENTER_AUTO_CUTOFF':
      pick(p.pump,['CTR_LEFT','CTR_RIGHT'],'pump');
      validateBoolean();f.centerAutoCutoff[p.pump]=p.value;break;
    case 'SET_HYD_ELECTRIC_SWITCH':
      side();validateBoolean();h.electricSwitches[p.system]=p.value;break;
    case 'SET_HYD_ELECTRIC_HEALTH':
      side();validateBoolean();h.electricHealthy[p.system]=p.value;break;
    case 'SET_ENGINE_RUNNING':
      if(state.propulsion?.mode==='INTEGRATED')
        throw new Error('Engine-driven hydraulic pump follows engine state in integrated mode');
      side();validateBoolean();h.engineDriven[p.system].engineRunning=p.value;break;
    case 'SET_ENGINE_HYD_SWITCH':
      side();validateBoolean();h.engineDriven[p.system].switchOn=p.value;break;
    case 'SET_ENGINE_HYD_HEALTH':
      side();validateBoolean();h.engineDriven[p.system].healthy=p.value;break;
    case 'SET_ENGINE_FIRE_SWITCH_PULL':
      side();validateBoolean();h.engineDriven[p.system].fireSwitchPulled=p.value;break;
    case 'SET_HYD_FLUID':
      side();validateBoolean();h.fluidAvailable[p.system]=p.value;break;
    case 'SET_FLIGHT_CONTROL_VALVE':
      side();validateBoolean();h.flightControlValveOn[p.system]=p.value;break;
    case 'SET_SENSOR_MODE':
      validateSensorId(p.sensor);validateSensorMode(p.value);
      state.sensors[p.sensor].mode=p.value;break;
    case 'SET_SENSOR_SAMPLE':
      validateSensorId(p.sensor);validateSensorSample(p.value);
      state.sensors[p.sensor].sample=p.value;break;
    case 'SET_SENSOR_SETTLING':
      validateSensorId(p.sensor);validateBoolean();
      state.sensors[p.sensor].settling=p.value;break;
    case 'ENTER_COLD_DARK':
      state.propulsion=initPropulsion();
      state.propulsion.mode='INTEGRATED';
      e.phase='GROUND';
      e.available.GEN1=false;e.available.GEN2=false;e.available.APU=false;
      e.selected.bus1='GEN1';e.selected.bus2='GEN2';
      for(const pump of FUEL_IDS)f.switches[pump]=false;
      for(const system of HYD_IDS)h.electricSwitches[system]=false;
      break;
    case 'SET_FIRE_LOOP':
      pick(p.loop,['A','B'],'loop');
      pick(p.field,['healthy','overheat','fire'],'field');
      validateBoolean();
      state.fire.loops[p.loop][p.field]=p.value;break;
    case 'SET_FIRE_SELECTOR':
      pick(p.value,['NORMAL','A','B'],'value');
      state.fire.selector=p.value;break;
    case 'ACK_FIRE_WARN':
      state.fire.acknowledged=true;break;
    case 'ACK_MASTER_CAUTION':break;
    case 'SET_WARNING_RECALL':
      validateBoolean();state.warning.recallPressed=p.value;break;
    default:
      if(PROTECTION_COMMANDS.has(p.type))applyProtectionAction(state.propulsion,p);
      else if(PROPULSION_COMMANDS.has(p.type))
        applyPropulsionAction(state.propulsion,p,{
          electrical:before.electrical,
          propulsion:before.propulsion,
          fuelAtInlet:state.pumps.fuel.fuelAtInlet
        });
      else throw new TypeError('Unknown action '+String(p.type));
      break;
  }
  if(state.propulsion?.mode==='INTEGRATED') {
    if(previous.propulsion.mode==='INTEGRATED')
      reconcileStarterEdges(state.propulsion,previous.propulsion);
    if(p.type==='ADVANCE_SECONDS')tickProtection(state.propulsion,p.value);
    reconcileApuProtections(state.propulsion);
  }
  // FCOM §7.30.2 ground battery-switch OFF shuts down the APU.
  if(state.propulsion?.mode==='INTEGRATED'&&e.phase==='GROUND'&&
     !e.batterySwitchOn&&state.propulsion.apu.phase!=='OFF'){
    state.propulsion.apu.phase='OFF';
    state.propulsion.apu.bleedSwitchOn=false;
    state.propulsion.apu.switch='OFF';
  }
  let afterNoLatch=deriveAircraftState(state);
  // Fire cutout remains until fire condition clears or a fresh detector
  // transition occurs. This is a discrete event model, not fire heat physics.
  if(p.type!=='ACK_FIRE_WARN' &&
     afterNoLatch.fireDetection.fireDetected===true &&
     before.fireDetection.fireDetected!==true) {
    state.fire.acknowledged=false;
    afterNoLatch=deriveAircraftState(state);
  }
  if(afterNoLatch.fireDetection.fireDetected===false){
    state.fire.acknowledged=false;
    afterNoLatch=deriveAircraftState(state);
  }
  const active=afterNoLatch.warningCauses.active.map(x=>x.id);
  const keepOld = state.warning.acknowledged.filter(id=>active.includes(id));
  state.warning.acknowledged = p.type==='ACK_MASTER_CAUTION' ?
    [...new Set([...keepOld,...active])].sort() : [...new Set(keepOld)].sort();
  state.warning.activeCauseIds = active;
  state.step++;
  const after=deriveAircraftState(state);
  const sensorChanges=[];
  for(const id of FUEL_IDS) {
    const b=before.pumps.fuel[id],a=after.pumps.fuel[id];
    if(a.motor!==b.motor || a.outputPressureSensor.state!==b.outputPressureSensor.state) {
      sensorChanges.push({id:'FUEL.'+id,oldMotor:b.motor,motor:a.motor,
        oldPressure:b.outputPressureSensor.state,pressure:a.outputPressureSensor.state});
    }
  }
  for(const id of HYD_IDS) {
    const b=before.pumps.hydraulic[id],a=after.pumps.hydraulic[id];
    if(a.electric.motor!==b.electric.motor ||
       a.electric.outputPressureSensor.state!==b.electric.outputPressureSensor.state ||
       a.systemPressure.state!==b.systemPressure.state){
      sensorChanges.push({id:'HYD.'+id+'_ELECTRIC',
        oldMotor:b.electric.motor,motor:a.electric.motor,
        oldPressure:b.electric.outputPressureSensor.state,
        pressure:a.electric.outputPressureSensor.state,
        oldSystemPressure:b.systemPressure.state,systemPressure:a.systemPressure.state});
    }
  }
  return {state,view:after,event:{
    sequence:state.step,action:clone(action),
    electricalChanges:compareElectricalTransitions(before.electrical,after.electrical),
    pressureChanges:comparePressureTransitions(before.pressurePhysics,after.pressurePhysics),
    sensorChanges,
    sensorSignalChanges:compareSensorSignals(before.sensors,after.sensors),
    annunciationChanges:compareAnnunciation(before.annunciation,after.annunciation),
    propulsionChanges:before.propulsion.mode==='INTEGRATED'||after.propulsion.mode==='INTEGRATED'?
      {apu:{from:before.propulsion.apu?.phase||'NONE',to:after.propulsion.apu?.phase||'NONE'},
       engines:Object.fromEntries(['1','2'].map(id=>[id,{
         from:before.propulsion.engines?.[id]?.status||'LEGACY',
         to:after.propulsion.engines?.[id]?.status||'LEGACY'
       }]))}:null,
    activatedWarnings:after.warnings.causeIds.filter(x=>!before.warnings.causeIds.includes(x)),
    clearedWarnings:before.warnings.causeIds.filter(x=>!after.warnings.causeIds.includes(x)),
    masterCautionBefore:before.warnings.masterCaution.logicalDemand,
    masterCautionAfter:after.warnings.masterCaution.logicalDemand
  }};
}

function replayAircraftActions(initial,actions){
  if(!Array.isArray(actions)) throw new TypeError('actions must be an array');
  let state=clone(initial);const events=[];
  for(const action of actions){
    const r=transitionAircraftState(state,action);
    state=r.state;events.push(r.event);
  }
  return {state,view:deriveAircraftState(state),events};
}
module.exports={initialAircraftState,deriveAircraftState,
  transitionAircraftState,replayAircraftActions};
return module.exports;})();
globalThis.B737PowerNetwork=Object.freeze(kernel);
})();
