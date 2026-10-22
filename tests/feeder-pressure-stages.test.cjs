'use strict';
const assert=require('node:assert/strict');
const {initialAircraftState,deriveAircraftState,transitionAircraftState}=require('../engine/network/integrated-aircraft-kernel.cjs');
const {evaluateFluidPressureNetwork}=require('../engine/network/fluid-pressure-engine.cjs');
const init=initialAircraftState();const normal=deriveAircraftState(init);
assert.equal(normal.electricalFeeders['HYD.A_ELECTRIC'].state,'POWERED');
assert.equal(normal.pressurePhysics.hydraulic.A.combinedSystemPressure,'AVAILABLE');
assert.equal(normal.pressurePhysics.hydraulic.A.pressureTransmitter.normalReferencePsi,3000);
assert.equal(normal.pressurePhysics.hydraulic.A.pressureTransmitter.maximumRedReferencePsi,3500);
assert.equal(normal.pressurePhysics.hydraulic.A.pressureTransmitter.actualPsi,null);
assert.equal(normal.pressurePhysics.fuel.engineFeed.ENGINE1.source,'CENTER_PRIORITY');
const g1=transitionAircraftState(init,{type:'SET_GENERATOR_AVAILABLE',generator:'GEN1',value:false});
assert.equal(g1.view.electricalFeeders['HYD.B_ELECTRIC'].state,'UNPOWERED');
assert.equal(g1.view.pumps.hydraulic.B.electric.outputPressureSensor.state,'LOW');
assert.equal(g1.view.pressurePhysics.hydraulic.B.combinedSystemPressure,'AVAILABLE');
assert.equal(g1.view.pressurePhysics.hydraulic.B.pressureTransmitter.actualPsi,null);
assert.equal(g1.view.pressurePhysics.fuel.engineFeed.ENGINE2.source,'MAIN_TANK_PUMPED');
assert.ok(g1.event.electricalChanges.consumers.some(x=>x.id==='HYD.B_ELECTRIC'));
assert.ok(g1.event.pressureChanges.events.some(x=>x.id==='FUEL.CTR_RIGHT'));
assert.equal(g1.view.electricalFeeders['HYD.B_ELECTRIC'].physicalFeeder,'UNVERIFIED_WDM_SSM_REQUIRED');
const g2=transitionAircraftState(init,{type:'SET_GENERATOR_AVAILABLE',generator:'GEN2',value:false});
assert.equal(g2.view.electricalFeeders['HYD.A_ELECTRIC'].state,'UNPOWERED');
assert.equal(g2.view.pressurePhysics.fuel.engineFeed.ENGINE1.source,'MAIN_TANK_PUMPED');
const both=transitionAircraftState(g1.state,{type:'SET_GENERATOR_AVAILABLE',generator:'GEN2',value:false});
assert.equal(both.view.pressurePhysics.fuel.engineFeed.ENGINE1.source,'SUCTION_FEED_POSSIBLE_NOT_GUARANTEED');
const unknown=transitionAircraftState(
  transitionAircraftState(init,{type:'SET_BUS_TRANSFER',value:'OFF'}).state,
  {type:'SET_GENERATOR_AVAILABLE',generator:'GEN1',value:false});
assert.equal(unknown.view.electricalFeeders['HYD.B_ELECTRIC'].state,'UNKNOWN');
assert.equal(unknown.view.pumps.hydraulic.B.electric.outputPressureSensor.state,'UNKNOWN');
const bothOff=transitionAircraftState(
  transitionAircraftState(init,{type:'SET_HYD_ELECTRIC_SWITCH',system:'A',value:false}).state,
  {type:'SET_ENGINE_HYD_SWITCH',system:'A',value:false});
assert.equal(bothOff.view.pressurePhysics.hydraulic.A.pressureTransmitter.indicationPsi,0);
assert.equal(bothOff.view.pressurePhysics.hydraulic.A.combinedSystemPressure,'LOW');
const obs=evaluateFluidPressureNetwork(normal.pumps,{hydraulicPsi:{A:2950}});
assert.equal(obs.hydraulic.A.gaugePsi,2950);
assert.equal(obs.hydraulic.A.simulatedPsi,null);
assert.equal(obs.fuel.pumps.CTR_LEFT.simulatedPsi,null);
assert.throws(()=>evaluateFluidPressureNetwork(normal.pumps,{hydraulicPsi:{A:-1}}),TypeError);
console.log('B737CL stages 1/2 verified: feeder cases, fuel source priority, hydraulic pressure and no invented psi');
