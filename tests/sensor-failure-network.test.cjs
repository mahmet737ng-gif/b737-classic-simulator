'use strict';

const assert=require('node:assert/strict');
const {initialAircraftState:init,deriveAircraftState:derive,
  transitionAircraftState:step,replayAircraftActions:replay}=
  require('../engine/network/integrated-aircraft-kernel.cjs');
const {SENSOR_IDS,initialSensorConfig}=require('../engine/network/sensor-failure-engine.cjs');

const cmd=(type,more={})=>({type,...more});
const advance=(state,type,more={})=>step(state,cmd(type,more));
const base=init();
const normal=derive(base);
assert.equal(SENSOR_IDS.length,12);
assert.deepEqual(Object.keys(initialSensorConfig()),[...SENSOR_IDS]);
assert.equal(normal.sensors['FUEL.CTR_RIGHT'].reportedPressure,'NORMAL');
assert.equal(normal.sensors['FUEL.CTR_RIGHT'].physicalPressure,'NORMAL');
assert.equal(normal.sensors['FUEL.CTR_RIGHT'].quality,'VALID_NOMINAL_PILOT');
assert.equal(normal.warnings.masterCaution.logicalDemand,false);

// Sensor open circuit is NOT the same as a failed electric motor.
let x=advance(base,'SET_SENSOR_MODE',{sensor:'FUEL.CTR_RIGHT',value:'OPEN_CIRCUIT'});
let v=x.view;
assert.equal(v.pumps.fuel.CTR_RIGHT.motor,'RUNNING');
assert.equal(v.pressurePhysics.fuel.pumpOutlets.CTR_RIGHT.pumpOutletPressure,'NORMAL');
assert.equal(v.sensors['FUEL.CTR_RIGHT'].physicalPressure,'NORMAL');
assert.equal(v.sensors['FUEL.CTR_RIGHT'].reportedPressure,'UNKNOWN');
assert.equal(v.sensors['FUEL.CTR_RIGHT'].quality,'INVALID_INJECTED_DISCONNECT');
assert.equal(v.pumps.fuel.CTR_RIGHT.outputPressureSensor.state,'UNKNOWN');
assert.equal(v.pumps.fuel.CTR_RIGHT.lowPressureLampDemand,null);
assert.equal(v.warnings.masterCaution.logicalDemand,false);
assert.ok(v.warnings.unresolvedCauses.includes('FUEL.CTR_RIGHT_PRESSURE_INDETERMINATE'));
assert.ok(x.event.sensorSignalChanges.some(c=>c.id==='FUEL.CTR_RIGHT'));
assert.equal(x.event.sensorSignalChanges.find(c=>c.id==='FUEL.CTR_RIGHT').durationSeconds,null);

// STUCK_LOW can present a false observed LOW indication, without pump failure.
// FCOM does not prove that the equipment can diagnose this false signal.
x=advance(base,'SET_SENSOR_MODE',{sensor:'FUEL.CTR_RIGHT',value:'STUCK_LOW'});
v=x.view;
assert.equal(v.pumps.fuel.CTR_RIGHT.motor,'RUNNING');
assert.equal(v.pressurePhysics.fuel.pumpOutlets.CTR_RIGHT.pumpOutletPressure,'NORMAL');
assert.equal(v.sensors['FUEL.CTR_RIGHT'].physicalPressure,'NORMAL');
assert.equal(v.sensors['FUEL.CTR_RIGHT'].reportedPressure,'LOW');
assert.equal(v.sensors['FUEL.CTR_RIGHT'].trainingDiagnosticMismatch,true);
assert.equal(v.warnings.masterCaution.logicalDemand,true);
assert.ok(v.warnings.causeIds.includes('FUEL.CTR_RIGHT_LOW'));
assert.equal(v.sensors['FUEL.CTR_RIGHT'].evidenceOfWiringOrDetection,'NOT_VERIFIED_BY_FCOM');
const ack=advance(x.state,'ACK_MASTER_CAUTION');
assert.equal(ack.view.warnings.masterCaution.logicalDemand,false);
assert.equal(ack.view.pumps.fuel.CTR_RIGHT.motor,'RUNNING');
const restored=advance(ack.state,'SET_SENSOR_MODE',{sensor:'FUEL.CTR_RIGHT',value:'HEALTHY'});
assert.equal(restored.view.warnings.causeIds.length,0);
assert.equal(restored.view.warnings.masterCaution.logicalDemand,false);
const refault=advance(restored.state,'SET_SENSOR_MODE',{sensor:'FUEL.CTR_RIGHT',value:'STUCK_LOW'});
assert.equal(refault.view.warnings.masterCaution.logicalDemand,true);

// STUCK_NORMAL conceals a REAL low-pressure indication; physical fault persists.
x=advance(base,'SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false});
assert.equal(x.view.pressurePhysics.fuel.pumpOutlets.CTR_RIGHT.pumpOutletPressure,'LOW');
assert.equal(x.view.warnings.masterCaution.logicalDemand,true);
let masked=advance(x.state,'SET_SENSOR_MODE',{sensor:'FUEL.CTR_RIGHT',value:'STUCK_NORMAL'});
assert.equal(masked.view.pumps.fuel.CTR_RIGHT.motor,'STOPPED_NO_AC');
assert.equal(masked.view.sensors['FUEL.CTR_RIGHT'].physicalPressure,'LOW');
assert.equal(masked.view.sensors['FUEL.CTR_RIGHT'].reportedPressure,'NORMAL');
assert.equal(masked.view.sensors['FUEL.CTR_RIGHT'].trainingDiagnosticMismatch,true);
assert.equal(masked.view.warnings.causeIds.includes('FUEL.CTR_RIGHT_LOW'),false);
assert.equal(masked.view.warnings.masterCaution.logicalDemand,false);
assert.ok(masked.view.warnings.simpleRecallIds.includes('FUEL.MAIN1_SINGLE_LOW'));

// Hydraulic pump false low does not remove the engine-driven hydraulic
// pressure or assert a fabricated full-system hydraulic failure.
x=advance(base,'SET_SENSOR_MODE',{sensor:'HYD.B.ELECTRIC',value:'STUCK_LOW'});
assert.equal(x.view.pumps.hydraulic.B.electric.motor,'RUNNING');
assert.equal(x.view.pumps.hydraulic.B.electric.outputPressureSensor.state,'LOW');
assert.equal(x.view.pressurePhysics.hydraulic.B.combinedSystemPressure,'AVAILABLE');
assert.equal(x.view.pumps.hydraulic.B.systemPressure.state,'AVAILABLE');
assert.equal(x.view.warnings.masterCaution.logicalDemand,false);

// Hydraulic system pressure switch fault is distinct from physical combined
// hydraulic pressure; warning demand follows reported pressure only.
x=advance(base,'SET_SENSOR_MODE',{sensor:'HYD.A.SYSTEM',value:'STUCK_LOW'});
assert.equal(x.view.pressurePhysics.hydraulic.A.combinedSystemPressure,'AVAILABLE');
assert.equal(x.view.pumps.hydraulic.A.systemPressure.state,'AVAILABLE');
assert.equal(x.view.pumps.hydraulic.A.systemPressure.sensorState,'LOW');
assert.equal(x.view.pumps.hydraulic.A.flightControlLowPressureLampDemand,true);
assert.equal(x.view.warnings.masterCaution.logicalDemand,true);
assert.ok(x.view.warnings.causeIds.includes('FLT_CONT.A_PRESSURE_LOW'));
assert.equal(x.view.warnings.systemAnnunciators['FLT CONT'].logicalDemand,true);
assert.equal(x.view.sensors['HYD.A.SYSTEM'].trainingDiagnosticMismatch,true);
const blocked=advance(x.state,'SET_FLIGHT_CONTROL_VALVE',{system:'A',value:false});
assert.equal(blocked.view.pumps.hydraulic.A.flightControlLowPressureLampDemand,false);
assert.equal(blocked.view.warnings.masterCaution.logicalDemand,false);

// No invented sensor failure indication on OPEN_CIRCUIT or simulated loss
// of sensor power; unresolved rather than normal/low.
x=advance(base,'SET_SENSOR_MODE',{sensor:'HYD.A.SYSTEM',value:'OPEN_CIRCUIT'});
assert.equal(x.view.pumps.hydraulic.A.systemPressure.sensorState,'UNKNOWN');
assert.equal(x.view.pumps.hydraulic.A.flightControlLowPressureLampDemand,null);
assert.equal(x.view.warnings.masterCaution.logicalDemand,false);
assert.ok(x.view.warnings.unresolvedCauses.includes('HYD.A_SYSTEM_PRESSURE_INDETERMINATE'));
let noPower=advance(base,'SET_SENSOR_MODE',{sensor:'FUEL.CTR_LEFT',value:'UNPOWERED'});
assert.equal(noPower.view.pumps.fuel.CTR_LEFT.motor,'RUNNING');
assert.equal(noPower.view.sensors['FUEL.CTR_LEFT'].quality,'UNPOWERED_INJECTED_SENSOR_FEED');
assert.equal(noPower.view.warnings.masterCaution.logicalDemand,false);

// INTERMITTENT uses explicit samples, not fake stochastic failures.
x=advance(base,'SET_SENSOR_MODE',{sensor:'FUEL.CTR_LEFT',value:'INTERMITTENT'});
assert.equal(x.view.sensors['FUEL.CTR_LEFT'].reportedPressure,'UNKNOWN');
x=advance(x.state,'SET_SENSOR_SAMPLE',{sensor:'FUEL.CTR_LEFT',value:'LOW'});
assert.equal(x.view.sensors['FUEL.CTR_LEFT'].reportedPressure,'LOW');
assert.equal(x.view.warnings.masterCaution.logicalDemand,true);
x=advance(x.state,'SET_SENSOR_SAMPLE',{sensor:'FUEL.CTR_LEFT',value:'NORMAL'});
assert.equal(x.view.sensors['FUEL.CTR_LEFT'].reportedPressure,'NORMAL');
assert.equal(x.view.warnings.masterCaution.logicalDemand,false);
x=advance(x.state,'SET_SENSOR_SAMPLE',{sensor:'FUEL.CTR_LEFT',value:'DROPOUT'});
assert.equal(x.view.sensors['FUEL.CTR_LEFT'].reportedPressure,'UNKNOWN');
assert.equal(x.view.warnings.masterCaution.logicalDemand,false);

// Explicit pending reading: without FCOM-verified duration, don't invent
// 2/5/10-second debounce and do not issue a speculative caution.
x=advance(base,'SET_SENSOR_SETTLING',{sensor:'FUEL.CTR_RIGHT',value:true});
assert.equal(x.view.sensors['FUEL.CTR_RIGHT'].quality,'PENDING_UNVERIFIED_DURATION');
assert.equal(x.view.sensors['FUEL.CTR_RIGHT'].reportedPressure,'UNKNOWN');
assert.equal(x.view.sensors['FUEL.CTR_RIGHT'].delaySeconds,null);
x=advance(x.state,'SET_SENSOR_SETTLING',{sensor:'FUEL.CTR_RIGHT',value:false});
assert.equal(x.view.sensors['FUEL.CTR_RIGHT'].reportedPressure,'NORMAL');

// If second main pump becomes unreadable, don't derive fabricated dual-low.
x=advance(base,'SET_FUEL_PUMP_HEALTH',{pump:'MAIN1_FWD',value:false});
x=advance(x.state,'SET_SENSOR_MODE',{sensor:'FUEL.MAIN1_AFT',value:'OPEN_CIRCUIT'});
assert.equal(x.view.warnings.masterCaution.logicalDemand,false);
assert.ok(x.view.warnings.unresolvedCauses.some(s=>s.includes('MAIN1_MAIN_PUMP_PRESSURE')));

// Engine hydraulic pump LOW PRESS lamp remains fire-switch inhibited
// even when the associated sensor has STUCK_LOW.
x=advance(base,'SET_SENSOR_MODE',{sensor:'HYD.B.ENGINE',value:'STUCK_LOW'});
x=advance(x.state,'SET_ENGINE_FIRE_SWITCH_PULL',{system:'B',value:true});
assert.equal(x.view.pumps.hydraulic.B.engineDriven.lowPressureLampDemand,false);

// Replay is deterministic including sensor-fault changes and physical truth.
const actions=[
  cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false}),
  cmd('SET_SENSOR_MODE',{sensor:'FUEL.CTR_RIGHT',value:'STUCK_NORMAL'}),
  cmd('SET_SENSOR_MODE',{sensor:'HYD.B.SYSTEM',value:'STUCK_LOW'}),
  cmd('ACK_MASTER_CAUTION'),
  cmd('SET_SENSOR_MODE',{sensor:'FUEL.CTR_RIGHT',value:'HEALTHY'}),
  cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:true})
];
assert.deepEqual(replay(base,actions),replay(base,actions));
assert.equal(base.sensors['FUEL.CTR_RIGHT'].mode,'HEALTHY');
assert.equal(base.step,0);
assert.throws(()=>advance(base,'SET_SENSOR_MODE',{sensor:'WRONG',value:'OPEN_CIRCUIT'}),TypeError);
assert.throws(()=>advance(base,'SET_SENSOR_MODE',{sensor:'FUEL.CTR_LEFT',value:'RANDOM_FAULT'}),TypeError);
assert.throws(()=>advance(base,'SET_SENSOR_SAMPLE',{sensor:'FUEL.CTR_LEFT',value:'WAVERING'}),TypeError);
assert.throws(()=>advance(base,'SET_SENSOR_SETTLING',{sensor:'FUEL.CTR_LEFT',value:'yes'}),TypeError);
assert.equal(derive(base).warnings.masterCaution.logicalDemand,false);
console.log('ISN-04 sensor fault/signal quality, physical-vs-observed, caution and replay tests PASS');
