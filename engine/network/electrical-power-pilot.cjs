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
