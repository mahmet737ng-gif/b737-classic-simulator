'use strict';
const assert=require('node:assert/strict');
const {evaluateElectricalPower}=require('../engine/network/electrical-power-pilot.cjs');
const {FEEDS,evaluateFeeder,evaluateAllFeeders,compareElectricalTransitions}=
  require('../engine/network/electrical-feeder-audit.v0.2.cjs');
const {initialAircraftState:init,deriveAircraftState:derive,
  transitionAircraftState:step,replayAircraftActions:replay}=
  require('../engine/network/integrated-aircraft-kernel.cjs');
const {comparePressureTransitions}=require('../engine/network/pressure-distribution.v0.2.cjs');
const cmd=(type,more={})=>({type,...more});
const act=(s,type,more={})=>step(s,cmd(type,more));
let b=init(),r=derive(b);
assert.equal(Object.keys(FEEDS).length,8);
assert.equal(Object.keys(r.electricalFeeders).length,8);
for(const feed of Object.values(r.electricalFeeders)){
  assert.equal(feed.state,'POWERED');
  assert.equal(feed.physicalFeeder,'UNVERIFIED_WDM_SSM_REQUIRED');
  assert.equal(feed.circuitBreaker,'UNVERIFIED_WDM_SSM_REQUIRED');
  assert.equal(feed.relay,'UNVERIFIED_WDM_SSM_REQUIRED');
  assert.ok(feed.source.sourceId==='FCOM-SEPEHRAN-1937');
}
assert.equal(r.pressurePhysics.schema,'b737cl-pressure-distribution-v0.2');
assert.equal(r.pressurePhysics.measuredPressureAvailable,false);
assert.equal(r.pressurePhysics.hydraulic.A.combinedSystemPressure,'AVAILABLE');
assert.equal(r.pressurePhysics.hydraulic.A.pressureTransmitter.actualPsi,null);
assert.equal(r.pressurePhysics.hydraulic.A.pressureTransmitter.normalReferencePsi,3000);
assert.equal(r.pressurePhysics.hydraulic.A.pressureTransmitter.maximumRedReferencePsi,3500);
assert.equal(r.pressurePhysics.hydraulic.A.pumpFlowRatio.engineVsElectricNominalApprox,4);
assert.equal(r.pressurePhysics.fuel.engineFeed.ENGINE1.source,'CENTER_PRIORITY');
assert.equal(r.pressurePhysics.fuel.engineFeed.ENGINE2.source,'CENTER_PRIORITY');
assert.equal(r.pumps.fuel.CTR_LEFT.outputPressureSensor.authority,
  'PRESSURE_DISTRIBUTION_V0.2');
assert.equal(r.pumps.hydraulic.A.electric.outputPressureSensor.authority,
  'PRESSURE_DISTRIBUTION_V0.2');
assert.equal(r.pumps.hydraulic.A.systemPressure.psi,null);

// GEN1: center RIGHT and hydraulic B electric lose AC, alternate transfer
// bus 1 stays powered. Right engine moves to main tank pumped feed.
let tr=act(b,'SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false});
r=tr.view;
assert.equal(r.electrical.buses.transfer1,'POWERED');
assert.equal(r.electricalFeeders['FUEL.MAIN1_FWD'].state,'UNPOWERED');
assert.equal(r.electricalFeeders['FUEL.CTR_RIGHT'].state,'UNPOWERED');
assert.equal(r.electricalFeeders['HYD.B_ELECTRIC'].state,'UNPOWERED');
assert.equal(r.electricalFeeders['FUEL.MAIN1_FWD'].source.pdfPage,1167);
assert.equal(r.electricalFeeders['FUEL.CTR_LEFT'].state,'POWERED');
assert.equal(r.pressurePhysics.fuel.engineFeed.ENGINE1.source,'CENTER_PRIORITY');
assert.equal(r.pressurePhysics.fuel.engineFeed.ENGINE2.source,'MAIN_TANK_PUMPED');
assert.equal(r.pressurePhysics.fuel.pumpOutlets.CTR_RIGHT.pumpOutletPressure,'LOW');
assert.equal(r.pumps.fuel.CTR_RIGHT.lowPressureLampDemand,true);
assert.equal(r.pressurePhysics.hydraulic.B.combinedSystemPressure,'AVAILABLE');
assert.equal(r.pressurePhysics.hydraulic.B.engineDrivenPumpOutlet,'NORMAL');
assert.equal(r.pressurePhysics.hydraulic.B.electricPumpOutlet,'LOW');
assert.equal(r.pumps.hydraulic.B.electric.lowPressureLampDemand,true);
assert.equal(r.warnings.masterCaution.logicalDemand,true);
assert.ok(tr.event.electricalChanges.consumers.some(x=>
  x.id==='FUEL.CTR_RIGHT' && x.before==='POWERED' && x.after==='UNPOWERED'));
assert.ok(tr.event.pressureChanges.events.some(x=>
  x.id==='FUEL.CTR_RIGHT' && x.trajectory==='DECAY_TIMING_UNVERIFIED'));
assert.equal(tr.event.pressureChanges.durationSeconds,null);

// Restored GEN1 yields pressure recovery without invented seconds.
let restored=act(tr.state,'SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:true});
assert.equal(restored.view.pressurePhysics.fuel.engineFeed.ENGINE2.source,'CENTER_PRIORITY');
assert.equal(restored.view.pumps.fuel.CTR_RIGHT.outputPressureSensor.state,'NORMAL');
assert.ok(restored.event.pressureChanges.events.some(x=>
  x.id==='FUEL.CTR_RIGHT' && x.trajectory==='BUILDUP_TIMING_UNVERIFIED'));
assert.equal(restored.view.warnings.masterCaution.logicalDemand,false);

// GEN2: center LEFT and electric A lose AC; transfer 2 remains powered.
tr=act(b,'SET_GENERATOR_AVAILABLE',{generator:'GEN2',value:false});
r=tr.view;
assert.equal(r.electrical.buses.transfer2,'POWERED');
assert.equal(r.electricalFeeders['FUEL.MAIN2_FWD'].source.pdfPage,1168);
assert.equal(r.electricalFeeders['FUEL.CTR_LEFT'].state,'UNPOWERED');
assert.equal(r.electricalFeeders['HYD.A_ELECTRIC'].state,'UNPOWERED');
assert.equal(r.pressurePhysics.fuel.engineFeed.ENGINE1.source,'MAIN_TANK_PUMPED');
assert.equal(r.pressurePhysics.fuel.engineFeed.ENGINE2.source,'CENTER_PRIORITY');

// GEN 1 plus BUS TRANS OFF: feeder is UNKNOWN without WDM, not fabricated.
const unknown=replay(b,[
  cmd('SET_BUS_TRANSFER',{value:'OFF'}),
  cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false})
]).view;
assert.equal(unknown.electricalFeeders['HYD.B_ELECTRIC'].state,'UNKNOWN');
assert.equal(unknown.pumps.hydraulic.B.electric.motor,'UNKNOWN');
assert.equal(unknown.pressurePhysics.hydraulic.B.electricPumpOutlet,'UNKNOWN');
assert.equal(unknown.pressurePhysics.hydraulic.B.combinedSystemPressure,'AVAILABLE');

// Full AC loss: all 8 AC pump feeds go UNPOWERED; engine-driven hydraulics
// can sustain system pressure independent of AC motor supply.
const blackout=replay(b,[
  cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:false}),
  cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN2',value:false})
]).view;
assert.ok(Object.values(blackout.electricalFeeders).every(x=>x.state==='UNPOWERED'));
assert.equal(blackout.pressurePhysics.hydraulic.A.combinedSystemPressure,'AVAILABLE');
assert.equal(blackout.pressurePhysics.hydraulic.B.combinedSystemPressure,'AVAILABLE');
assert.equal(blackout.pressurePhysics.fuel.engineFeed.ENGINE1.source,
  'SUCTION_FEED_POSSIBLE_NOT_GUARANTEED');
assert.equal(blackout.pressurePhysics.fuel.engineFeed.ENGINE2.source,
  'SUCTION_FEED_POSSIBLE_NOT_GUARANTEED');
assert.equal(blackout.pressurePhysics.fuel.engineFeed.ENGINE1.certainty,
  'NO_PRESSURIZED_PUMP_FEED');
assert.equal(blackout.pressurePhysics.hydraulic.A.pressureTransmitter.actualPsi,null);

// Each fuel pump is actually controlled by fuel availability and pump command,
// not by a standalone fuel pressure value authored independently.
const dry=act(b,'SET_FUEL_INLET',{tank:'CENTER',value:false}).view;
assert.equal(dry.pressurePhysics.fuel.pumpOutlets.CTR_LEFT.pumpOutletPressure,'LOW');
assert.equal(dry.pressurePhysics.fuel.pumpOutlets.CTR_RIGHT.pumpOutletPressure,'LOW');
assert.equal(dry.pressurePhysics.fuel.engineFeed.ENGINE1.source,'MAIN_TANK_PUMPED');
assert.equal(dry.warnings.masterCaution.logicalDemand,true);

// If one center tank pump switch OFF, its low pressure lamp is inhibited.
const off=act(b,'SET_FUEL_PUMP_SWITCH',{pump:'CTR_LEFT',value:false}).view;
assert.equal(off.pressurePhysics.fuel.pumpOutlets.CTR_LEFT.pumpOutletPressure,'LOW');
assert.equal(off.pumps.fuel.CTR_LEFT.lowPressureLampDemand,false);

// No pump pressure → single-engine suction FEED possibility, not flow/guarantee.
const suction=replay(b,[
  cmd('SET_FUEL_PUMP_SWITCH',{pump:'CTR_LEFT',value:false}),
  cmd('SET_FUEL_PUMP_SWITCH',{pump:'MAIN1_FWD',value:false}),
  cmd('SET_FUEL_PUMP_SWITCH',{pump:'MAIN1_AFT',value:false})
]).view;
assert.equal(suction.pressurePhysics.fuel.engineFeed.ENGINE1.source,
 'SUCTION_FEED_POSSIBLE_NOT_GUARANTEED');
assert.equal(suction.pressurePhysics.fuel.engineFeed.ENGINE2.source,'CENTER_PRIORITY');

// Both hydraulic pumps switched OFF: FCOM gauge reads zero. No dynamic
// estimated PSI is generated for any other configuration.
const hydOff=replay(b,[
  cmd('SET_HYD_ELECTRIC_SWITCH',{system:'A',value:false}),
  cmd('SET_ENGINE_HYD_SWITCH',{system:'A',value:false})
]);
assert.equal(hydOff.view.pressurePhysics.hydraulic.A.combinedSystemPressure,'LOW');
assert.equal(hydOff.view.pressurePhysics.hydraulic.A.pressureTransmitter.indicationPsi,0);
assert.equal(hydOff.view.pumps.hydraulic.A.systemPressure.psi,0);
assert.ok(hydOff.event===undefined); // replay returns events, not one event
assert.ok(hydOff.events.some(ev=>ev.pressureChanges.events.some(x=>
  x.id==='HYD.SYSTEM_A' && x.trajectory==='DECAY_TIMING_UNVERIFIED')));
assert.equal(hydOff.view.warnings.systemAnnunciators.HYD.logicalDemand,true);
assert.equal(hydOff.view.warnings.systemAnnunciators['FLT CONT'].logicalDemand,true);

// Failed electric pump but operating engine pump sustains A system.
const electricOnly=act(b,'SET_HYD_ELECTRIC_HEALTH',{system:'A',value:false}).view;
assert.equal(electricOnly.pressurePhysics.hydraulic.A.electricPumpOutlet,'LOW');
assert.equal(electricOnly.pressurePhysics.hydraulic.A.combinedSystemPressure,'AVAILABLE');
assert.equal(electricOnly.pressurePhysics.hydraulic.A.pressureTransmitter.actualPsi,null);

// No fuel in main 1 and pumps off: cannot claim suction-feed.
const noFuel=replay(b,[
  cmd('SET_FUEL_PUMP_SWITCH',{pump:'CTR_LEFT',value:false}),
  cmd('SET_FUEL_PUMP_SWITCH',{pump:'MAIN1_FWD',value:false}),
  cmd('SET_FUEL_PUMP_SWITCH',{pump:'MAIN1_AFT',value:false}),
  cmd('SET_FUEL_INLET',{tank:'MAIN1',value:false})
]).view;
assert.equal(noFuel.pressurePhysics.fuel.engineFeed.ENGINE1.source,'NO_PRESSURIZED_PUMP_FEED');

// Deterministic pressure and feeder transition output and no input mutation.
const actions=[
  cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN2',value:false}),
  cmd('SET_GENERATOR_AVAILABLE',{generator:'GEN2',value:true})
];
assert.deepEqual(replay(b,actions).view,
  replay(b,actions).view);
assert.equal(b.electrical.available.GEN1,true);
assert.equal(b.step,0);
assert.throws(()=>evaluateFeeder(r.electrical,'FUEL.UNVERIFIED'),TypeError);
assert.throws(()=>comparePressureTransitions(null,r.pressurePhysics),TypeError);
assert.throws(()=>compareElectricalTransitions(null,r.electrical),TypeError);
console.log('Electrical feeder v0.2 + fuel/hydraulic pressure v0.2 integration scenarios PASS');
