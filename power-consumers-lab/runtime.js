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
const consumers=(function(){const module={exports:{}};const exports=module.exports;
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

function consumerPower(electrical, id) {
  if (!electrical || !electrical.buses || !Array.isArray(electrical.crossSystemEffects)) {
    throw new TypeError('evaluateElectricalPower output required');
  }
  const effect = electrical.crossSystemEffects.find(x => x.id === id);
  if (effect) return {state:'UNPOWERED', basis:'FCOM_FAILURE_TABLE', source:effect.source};
  const b = electrical.buses;
  if (b.generator1 === 'POWERED' && b.generator2 === 'POWERED') {
    return {state:'POWERED', basis:'NOMINAL_TWO_AC_BUS_FIXTURE',
      source:src('6.20.1-4',1153)};
  }
  if (b.generator1 === 'UNPOWERED' && b.generator2 === 'UNPOWERED') {
    return {state:'UNPOWERED', basis:'ALL_NORMAL_AC_SOURCES_LOST',
      source:src('6.20.1-4',1153)};
  }
  if (electrical.documentedFailureCase) {
    return {state:'POWERED', basis:'OTHER_LOAD_NOT_IN_FCOM_FAILURE_LIST',
      source:src(electrical.documentedFailureCase.includes('GEN1')?'6.20.18':'6.20.19',
        electrical.documentedFailureCase.includes('GEN1')?1167:1168)};
  }
  return {state:'UNKNOWN', basis:'EXACT_FEEDER_AND_RELAY_UNVERIFIED',
    source:src('6.20.3-4',1153)};
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
  const systemAnnunciators={
    FUEL: active.some(x=>x.system==='FUEL') || (control.recallPressed && simple.some(x=>x.system==='FUEL')),
    HYD: null,  // Pump LOW PRESSURE -> system HYD caution rule still unverified.
    'FLT CONT':active.some(x=>x.system==='FLT CONT')
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
const kernel=(function(){const module={exports:{}};const exports=module.exports;const require=(p)=>{if(p==='./electrical-power-pilot.cjs')return electrical;if(p==='./pump-sensor-warning-engine.cjs')return consumers;throw new Error('Unknown browser module '+p);};
'use strict';

/**
 * Deterministic standalone B737CL power->pump->pressure sensor->warning
 * integration kernel. Uses real electrical pilot output; no static mock
 * caution flags. Fixed test-fixture configuration only, not a flight model.
 */
const {evaluateElectricalPower}=require('./electrical-power-pilot.cjs');
const {FUEL_IDS,HYD_IDS,evaluatePumpNetwork,evaluateWarningCauses,
  projectWarnings}=require('./pump-sensor-warning-engine.cjs');

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
    warning:{acknowledged:[],activeCauseIds:[],recallPressed:false}
  };
}

/** All subsystem outputs derive from one consistent input snapshot. */
function deriveAircraftState(snapshot) {
  if(!snapshot || snapshot.schema!=='b737cl-integration-kernel-v0.1')
    throw new TypeError('B737CL integration state required');
  const electrical=evaluateElectricalPower(snapshot.electrical);
  const network=evaluatePumpNetwork(electrical,snapshot.pumps);
  const causes=evaluateWarningCauses(network);
  const warnings=projectWarnings(network,causes,electrical,snapshot.warning);
  return {step:snapshot.step,electrical,pumps:network,warnings,
    warningCauses:causes,sourceModel:'FCOM_REFERENCED_PARTIAL_PILOT'};
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
    case 'ACK_MASTER_CAUTION':break;
    case 'SET_WARNING_RECALL':
      validateBoolean();state.warning.recallPressed=p.value;break;
    default:throw new TypeError('Unknown action '+String(p.type));
  }
  const afterNoLatch=deriveAircraftState(state);
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
    sensorChanges,
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
