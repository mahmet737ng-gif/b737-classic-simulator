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
