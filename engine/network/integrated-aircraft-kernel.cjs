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
      if(PROPULSION_COMMANDS.has(p.type))
        applyPropulsionAction(state.propulsion,p,{
          electrical:before.electrical,
          propulsion:before.propulsion,
          fuelAtInlet:state.pumps.fuel.fuelAtInlet
        });
      else throw new TypeError('Unknown action '+String(p.type));
      break;
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
