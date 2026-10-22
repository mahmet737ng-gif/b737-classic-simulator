'use strict';
const assert = require('node:assert/strict');
const {initialAircraftState:init,deriveAircraftState:derive,
  transitionAircraftState:step,replayAircraftActions:replay} =
  require('../engine/network/integrated-aircraft-kernel.cjs');

const cmd=(type,fields={})=>({type,...fields});
const act=(s,type,fields={})=>step(s,cmd(type,fields));
const base=init();
let r=derive(base);

// Initial state: AC-powered pumps have nominal discrete pressure output.
assert.equal(r.electrical.buses.main1,'POWERED');
assert.equal(r.pumps.fuel.MAIN1_FWD.motor,'RUNNING');
assert.equal(r.pumps.fuel.MAIN1_FWD.outputPressureSensor.state,'NORMAL');
assert.equal(r.pumps.hydraulic.A.electric.motor,'RUNNING');
assert.equal(r.pumps.hydraulic.A.systemPressure.state,'AVAILABLE');
assert.equal(r.warnings.masterCaution.logicalDemand,false);
assert.equal(r.warnings.masterCaution.visible,false);
assert.deepEqual(r.warnings.causeIds,[]);

// GEN1 fault propagates to the affected real pumps, then pressure sensors,
// then FUEL caution logic. B system survives on its engine-driven pump.
let tr=act(base,'SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false});
let s=tr.state;r=tr.view;
assert.equal(r.electrical.buses.transfer1,'POWERED');
assert.equal(r.electrical.buses.main1,'UNPOWERED');
assert.equal(r.pumps.fuel.MAIN1_FWD.motor,'STOPPED_NO_AC');
assert.equal(r.pumps.fuel.MAIN1_FWD.outputPressureSensor.state,'LOW');
assert.equal(r.pumps.fuel.MAIN1_FWD.lowPressureLampDemand,true);
assert.equal(r.pumps.fuel.MAIN1_AFT.motor,'RUNNING');
assert.equal(r.pumps.fuel.CTR_RIGHT.motor,'STOPPED_NO_AC');
assert.equal(r.pumps.fuel.CTR_RIGHT.lowPressureLampDemand,true);
assert.equal(r.pumps.hydraulic.B.electric.motor,'STOPPED_NO_AC');
assert.equal(r.pumps.hydraulic.B.electric.outputPressureSensor.state,'LOW');
assert.equal(r.pumps.hydraulic.B.electric.lowPressureLampDemand,true);
assert.equal(r.pumps.hydraulic.B.engineDriven.outputPressureSensor.state,'NORMAL');
assert.equal(r.pumps.hydraulic.B.systemPressure.state,'AVAILABLE');
assert.ok(r.warnings.causeIds.includes('FUEL.CTR_RIGHT_LOW'));
assert.ok(r.warnings.simpleRecallIds.includes('FUEL.MAIN1_SINGLE_LOW'));
assert.equal(r.warnings.masterCaution.logicalDemand,true);
assert.equal(r.warnings.masterCaution.visible,true);
assert.equal(r.warnings.systemAnnunciators.FUEL.logicalDemand,true);
assert.equal(r.warnings.systemAnnunciators.HYD.logicalDemand,null);
assert.ok(tr.event.sensorChanges.some(x=>x.id==='HYD.B_ELECTRIC'));
assert.ok(tr.event.activatedWarnings.includes('FUEL.CTR_RIGHT_LOW'));
assert.equal(r.pumps.fuel.MAIN1_FWD.powerEvidence.basis,'FCOM_FAILURE_TABLE');
assert.equal(r.pumps.fuel.MAIN1_FWD.powerEvidence.source.pdfPage,1167);

// Acknowledgement extinguishes the master caution DEMAND but not pump
// low pressure or the active fault. Recovery disarms acknowledgement.
tr=act(s,'ACK_MASTER_CAUTION');s=tr.state;r=tr.view;
assert.equal(r.warnings.masterCaution.logicalDemand,false);
assert.equal(r.pumps.fuel.CTR_RIGHT.lowPressureLampDemand,true);
assert.ok(r.warnings.causeIds.includes('FUEL.CTR_RIGHT_LOW'));
tr=act(s,'SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:true});
s=tr.state;r=tr.view;
assert.equal(r.pumps.fuel.CTR_RIGHT.motor,'RUNNING');
assert.equal(r.pumps.fuel.CTR_RIGHT.outputPressureSensor.state,'NORMAL');
assert.equal(r.pumps.hydraulic.B.electric.motor,'RUNNING');
assert.equal(r.warnings.masterCaution.logicalDemand,false);
assert.equal(r.warnings.causeIds.length,0);
assert.ok(tr.event.clearedWarnings.includes('FUEL.CTR_RIGHT_LOW'));
tr=act(s,'SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false});
assert.equal(tr.view.warnings.masterCaution.logicalDemand,true);

// GEN2 failure has different physical load ownership.
tr=act(base,'SET_GENERATOR_AVAILABLE',{generator:'GEN2',value:false});
r=tr.view;
assert.equal(r.electrical.buses.transfer2,'POWERED');
assert.equal(r.electrical.transformerRectifiers.TR3,'UNPOWERED');
assert.equal(r.pumps.fuel.MAIN2_FWD.motor,'STOPPED_NO_AC');
assert.equal(r.pumps.fuel.CTR_LEFT.motor,'STOPPED_NO_AC');
assert.equal(r.pumps.hydraulic.A.electric.motor,'STOPPED_NO_AC');
assert.equal(r.pumps.hydraulic.A.systemPressure.state,'AVAILABLE');
assert.ok(r.warnings.causeIds.includes('FUEL.CTR_LEFT_LOW'));
assert.ok(r.warnings.simpleRecallIds.includes('FUEL.MAIN2_SINGLE_LOW'));
assert.equal(r.warnings.masterCaution.logicalDemand,true);
assert.equal(r.pumps.hydraulic.B.electric.motor,'RUNNING');
assert.equal(r.pumps.fuel.MAIN2_FWD.powerEvidence.source.pdfPage,1168);

// Single main-tank pump low: simple fault until recall; never an immediate
// unacknowledged MASTER CAUTION by itself.
tr=act(base,'SET_FUEL_PUMP_HEALTH',{pump:'MAIN1_FWD',value:false});
s=tr.state;r=tr.view;
assert.equal(r.pumps.fuel.MAIN1_FWD.motor,'FAILED');
assert.equal(r.pumps.fuel.MAIN1_FWD.lowPressureLampDemand,true);
assert.equal(r.warnings.masterCaution.logicalDemand,false);
assert.deepEqual(r.warnings.simpleRecallIds,['FUEL.MAIN1_SINGLE_LOW']);
tr=act(s,'SET_WARNING_RECALL',{value:true});
assert.equal(tr.view.warnings.masterCaution.logicalDemand,true);
assert.equal(tr.view.warnings.systemAnnunciators.FUEL.logicalDemand,true);
tr=act(tr.state,'SET_WARNING_RECALL',{value:false});
assert.equal(tr.view.warnings.masterCaution.logicalDemand,false);

// Both main tank pumps low means hard fuel caution, including switches OFF.
const two=replay(base,[
 cmd('SET_FUEL_PUMP_SWITCH',{pump:'MAIN1_FWD',value:false}),
 cmd('SET_FUEL_PUMP_SWITCH',{pump:'MAIN1_AFT',value:false})
]);
assert.equal(two.view.pumps.fuel.MAIN1_FWD.lowPressureLampDemand,true);
assert.equal(two.view.pumps.fuel.MAIN1_AFT.lowPressureLampDemand,true);
assert.ok(two.view.warnings.causeIds.includes('FUEL.MAIN1_DUAL_LOW'));
assert.equal(two.view.warnings.masterCaution.logicalDemand,true);

// Center pump LOW light is OFF with switch OFF, unlike main pump.
tr=act(base,'SET_FUEL_PUMP_SWITCH',{pump:'CTR_LEFT',value:false});
assert.equal(tr.view.pumps.fuel.CTR_LEFT.outputPressureSensor.state,'LOW');
assert.equal(tr.view.pumps.fuel.CTR_LEFT.lowPressureLampDemand,false);
assert.equal(tr.view.warnings.masterCaution.logicalDemand,false);

// Opposite center pump low when one pump selected OFF => hard FUEL caution.
let seq=replay(base,[
 cmd('SET_FUEL_PUMP_SWITCH',{pump:'CTR_LEFT',value:false}),
 cmd('SET_FUEL_PUMP_HEALTH',{pump:'CTR_RIGHT',value:false})
]);
assert.ok(seq.view.warnings.causeIds.includes('FUEL.CTR_RIGHT_LOW'));
assert.equal(seq.view.warnings.masterCaution.logicalDemand,true);
seq=replay(base,[
 cmd('SET_FUEL_PUMP_SWITCH',{pump:'CTR_LEFT',value:false}),
 cmd('SET_FUEL_PUMP_SWITCH',{pump:'CTR_RIGHT',value:false})
]);
assert.equal(seq.view.warnings.masterCaution.logicalDemand,false);
assert.equal(seq.view.pumps.fuel.CTR_RIGHT.lowPressureLampDemand,false);

// Explicit center auto-cutoff: deliberately no guessed trip delay.
tr=act(base,'SET_CENTER_AUTO_CUTOFF',{pump:'CTR_RIGHT',value:true});
assert.equal(tr.view.pumps.fuel.CTR_RIGHT.motor,'STOPPED_CENTER_AUTO_SHUTOFF');
assert.equal(tr.view.pumps.fuel.CTR_RIGHT.lowPressureLampDemand,true);
assert.equal(tr.view.warnings.masterCaution.logicalDemand,true);

// System pressure sensor is not equal to one electrical pump output sensor.
// Engine-driven pump sustains A if A electric failed; when both pumps fail,
// flight-control LOW PRESSURE becomes an independent hard caution cause.
seq=replay(base,[
 cmd('SET_ENGINE_RUNNING',{system:'A',value:false}),
 cmd('SET_HYD_ELECTRIC_SWITCH',{system:'A',value:false})
]);
assert.equal(seq.view.pumps.hydraulic.A.electric.motor,'STOPPED_SWITCH_OFF');
assert.equal(seq.view.pumps.hydraulic.A.electric.lowPressureLampDemand,true);
assert.equal(seq.view.pumps.hydraulic.A.engineDriven.lowPressureLampDemand,true);
assert.equal(seq.view.pumps.hydraulic.A.systemPressure.state,'LOW');
assert.equal(seq.view.pumps.hydraulic.A.systemPressure.psi,null);
assert.equal(seq.view.pumps.hydraulic.A.flightControlLowPressureLampDemand,true);
assert.ok(seq.view.warnings.causeIds.includes('FLT_CONT.A_PRESSURE_LOW'));
assert.equal(seq.view.warnings.systemAnnunciators['FLT CONT'].logicalDemand,true);
assert.equal(seq.view.warnings.systemAnnunciators.HYD.logicalDemand,true);
assert.equal(seq.view.warnings.masterCaution.logicalDemand,true);

// When the engine fire switch is pulled its related hydraulic engine pump
// LOW PRESSURE light is inhibited, even if the pressure sensor is LOW.
tr=act(base,'SET_ENGINE_FIRE_SWITCH_PULL',{system:'B',value:true});
assert.equal(tr.view.pumps.hydraulic.B.engineDriven.outputPressureSensor.state,'LOW');
assert.equal(tr.view.pumps.hydraulic.B.engineDriven.lowPressureLampDemand,false);
assert.equal(tr.view.pumps.hydraulic.B.systemPressure.state,'AVAILABLE');

// Fully electric blackout does not automatically stop engine-driven pumps.
// Physical availability and warning panel power remain distinct.
seq=replay(base,[
 cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false}),
 cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN2',value:false})
]);
assert.equal(seq.view.pumps.fuel.MAIN1_FWD.motor,'STOPPED_NO_AC');
assert.equal(seq.view.pumps.fuel.MAIN2_FWD.motor,'STOPPED_NO_AC');
assert.equal(seq.view.pumps.hydraulic.A.electric.motor,'STOPPED_NO_AC');
assert.equal(seq.view.pumps.hydraulic.B.electric.motor,'STOPPED_NO_AC');
assert.equal(seq.view.pumps.hydraulic.A.systemPressure.state,'AVAILABLE');
assert.equal(seq.view.pumps.hydraulic.B.systemPressure.state,'AVAILABLE');
assert.equal(seq.view.warnings.masterCaution.logicalDemand,true);
assert.equal(seq.view.warnings.masterCaution.visible,null);
assert.equal(seq.view.warnings.displayPower,'UNKNOWN_PANEL_SUPPLY');

// Undocumented BUS TRANS OFF feeder effects must be UNKNOWN rather than false
// positive pump failures or fake cleared caution.
seq=replay(base,[
 cmd('SET_BUS_TRANSFER',{value:'OFF'}),
 cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false})
]);
assert.equal(seq.view.pumps.fuel.MAIN1_FWD.ac,'UNKNOWN');
assert.equal(seq.view.pumps.fuel.MAIN1_FWD.outputPressureSensor.state,'UNKNOWN');
assert.equal(seq.view.pumps.fuel.MAIN1_FWD.lowPressureLampDemand,null);
assert.equal(seq.view.pumps.hydraulic.B.electric.motor,'UNKNOWN');
assert.ok(seq.view.warnings.unresolvedCauses.length>0);

// New warning after ACK should illuminate even while first problem remains.
seq=replay(base,[
 cmd('SET_FUEL_PUMP_HEALTH',{pump:'CTR_LEFT',value:false}),
 cmd('ACK_MASTER_CAUTION'),
 cmd('SET_FUEL_PUMP_HEALTH',{pump:'MAIN1_FWD',value:false}),
 cmd('SET_FUEL_PUMP_HEALTH',{pump:'MAIN1_AFT',value:false})
]);
assert.ok(seq.view.warnings.causeIds.includes('FUEL.CTR_LEFT_LOW'));
assert.ok(seq.view.warnings.causeIds.includes('FUEL.MAIN1_DUAL_LOW'));
assert.deepEqual(seq.view.warnings.unacknowledgedCauseIds,['FUEL.MAIN1_DUAL_LOW']);
assert.equal(seq.view.warnings.masterCaution.logicalDemand,true);

// Deterministic replay, no caller object mutation, invalid commands rejected.
assert.deepEqual(replay(base,[
 cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false}),
 cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:true})
]).view,derive({...base,step:2,warning:{acknowledged:[],activeCauseIds:[],recallPressed:false}}));
assert.equal(base.electrical.available.GEN1,true);
assert.equal(base.step,0);
assert.throws(()=>act(base,'SET_FUEL_PUMP_SWITCH',{pump:'INVALID',value:true}),TypeError);
assert.throws(()=>act(base,'SET_FUEL_PUMP_HEALTH',{pump:'MAIN1_FWD',value:'OFF'}),TypeError);
assert.throws(()=>act(base,'SET_BUS_TRANSFER',{value:'INVALID'}),TypeError);
assert.throws(()=>act(base,'INVENTED_ACTION'),TypeError);
console.log('B737CL integrated pump/sensor/warning kernel: deterministic scenario tests PASS');
