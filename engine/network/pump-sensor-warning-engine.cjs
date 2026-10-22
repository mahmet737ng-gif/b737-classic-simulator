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
