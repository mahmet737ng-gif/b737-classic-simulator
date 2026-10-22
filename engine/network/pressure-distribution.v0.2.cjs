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
