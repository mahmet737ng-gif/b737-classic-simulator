'use strict';
const assert=require('node:assert/strict');
const {initialAircraftState:init,deriveAircraftState:derive,
  transitionAircraftState:step,replayAircraftActions:replay}=
  require('../engine/network/integrated-aircraft-kernel.cjs');
const cmd=(type,data={})=>({type,...data});
const doIt=(s,type,data={})=>step(s,cmd(type,data));
let s=init();
let baseline=derive(s);
assert.equal(baseline.propulsion.mode,'LEGACY_FIXTURE');
assert.equal(baseline.electrical.buses.generator1,'POWERED');
assert.equal(baseline.pumps.hydraulic.A.engineDriven.engineRunning,true);

// Starting the new scenario deliberately switches from legacy running
// fixture to a real event-owned cold/dark engine and APU state.
let out=doIt(s,'ENTER_COLD_DARK');s=out.state;let v=out.view;
assert.equal(v.propulsion.mode,'INTEGRATED');
assert.equal(v.electrical.buses.generator1,'UNPOWERED');
assert.equal(v.electrical.buses.generator2,'UNPOWERED');
assert.equal(v.pumps.hydraulic.A.engineDriven.engineRunning,false);
assert.equal(v.propulsion.apu.phase,'OFF');
assert.throws(()=>doIt(s,'SET_GENERATOR_AVAILABLE',{generator:'GEN1',value:true}),Error);
assert.throws(()=>doIt(s,'SET_ENGINE_RUNNING',{system:'A',value:true}),Error);
assert.throws(()=>doIt(s,'CONFIRM_APU_READY'),Error);
// On a cold dark airplane the battery can power APU starting (no AC
// generator required); FCOM 7.30.1-2 left-tank suction/DC boost fuel.
out=doIt(s,'SET_APU_SWITCH',{value:'START'});s=out.state;v=out.view;
assert.equal(v.propulsion.apu.phase,'DOOR_OPENING');
assert.equal(v.propulsion.apu.startPower,'AVAILABLE');
assert.equal(v.propulsion.apu.generatorAvailable,false);
out=doIt(s,'SET_APU_INLET_OPEN',{value:true});s=out.state;
assert.equal(out.view.propulsion.apu.phase,'STARTING');
out=doIt(s,'CONFIRM_APU_READY');s=out.state;v=out.view;
assert.equal(v.propulsion.apu.phase,'AVAILABLE');
assert.equal(v.electrical.buses.generator1,'UNPOWERED');
assert.equal(v.propulsion.apu.generatorAvailable,true);
assert.equal(v.propulsion.apu.fuel,'SUCTION_NO1_DC_BOOST');
assert.equal(v.propulsion.apu.dcBoostPump,'OFF_AT_GOVERNED');
assert.equal(v.annunciation.lamps.APU_GEN_OFF_BUS.logicalDemand,'ON');
assert.equal(v.propulsion.apu.recommendedBleedWarmup.completed,false);
out=doIt(s,'ADVANCE_SECONDS',{value:60});s=out.state;
assert.equal(out.view.propulsion.apu.recommendedBleedWarmup.completed,true);
// Use the APU source *explicitly* on both generator buses on the ground.
out=doIt(s,'SET_GENERATOR_SOURCE',{bus:'bus1',value:'APU'});s=out.state;
out=doIt(s,'SET_GENERATOR_SOURCE',{bus:'bus2',value:'APU'});s=out.state;
v=out.view;
assert.equal(v.electrical.sourceAssignments.bus1,'APU');
assert.equal(v.electrical.sourceAssignments.bus2,'APU');
assert.equal(v.annunciation.lamps.APU_GEN_OFF_BUS.logicalDemand,'OFF');
assert.equal(v.electrical.buses.acStandby,'POWERED');
// Engine start from APU BLEED + verified duct pressure. Fuel requires a
// real powered fuel boost pump on Engine 2 side.
out=doIt(s,'SET_APU_BLEED',{value:true});s=out.state;
out=doIt(s,'SET_DUCT_PSI',{value:35});s=out.state;
out=doIt(s,'SET_FUEL_PUMP_SWITCH',{pump:'MAIN2_AFT',value:true});s=out.state;
assert.equal(out.view.pressurePhysics.fuel.engineFeed.ENGINE2.source,'MAIN_TANK_PUMPED');
out=doIt(s,'SET_ENGINE_START_SWITCH',{engine:2,value:'GRD'});s=out.state;
assert.equal(out.view.propulsion.engines['2'].status,'MOTORING_BELOW_FUEL_INTRODUCTION');
assert.equal(out.view.propulsion.engines['2'].starterValveCommand,'COMMAND_OPEN');
assert.equal(out.view.annunciation.lamps.ENG2_START_VALVE_OPEN.logicalDemand,'UNKNOWN');
out=doIt(s,'SET_ENGINE_START_VALVE_FEEDBACK',{engine:2,value:true});s=out.state;
assert.equal(out.view.annunciation.lamps.ENG2_START_VALVE_OPEN.logicalDemand,'ON');
out=doIt(s,'SET_ENGINE_N1_ROTATION',{engine:2,value:true});s=out.state;
out=doIt(s,'SET_ENGINE_N2',{engine:2,value:24});s=out.state;
out=doIt(s,'SET_ENGINE_START_LEVER',{engine:2,value:'IDLE'});s=out.state;
assert.throws(()=>doIt(s,'CONFIRM_ENGINE_LIGHTOFF',{engine:2}),Error);
out=doIt(s,'SET_ENGINE_N2',{engine:2,value:25});s=out.state;
assert.equal(out.view.propulsion.engines['2'].status,'AWAITING_LIGHTOFF_CONFIRMATION');
assert.equal(out.view.propulsion.engines['2'].ignition.state,'AVAILABLE');
out=doIt(s,'CONFIRM_ENGINE_LIGHTOFF',{engine:2});s=out.state;
assert.equal(out.view.propulsion.engines['2'].lightoffConfirmed,true);
out=doIt(s,'SET_ENGINE_N2',{engine:2,value:46});s=out.state;
assert.equal(out.view.propulsion.engines['2'].startSwitch,'OFF');
assert.equal(out.view.propulsion.engines['2'].starterValveCommand,'COMMAND_CLOSED');
assert.throws(()=>doIt(s,'CONFIRM_ENGINE_IDLE',{engine:1}),Error);
out=doIt(s,'CONFIRM_ENGINE_IDLE',{engine:2});s=out.state;v=out.view;
assert.equal(v.propulsion.engines['2'].phase,'RUNNING');
assert.equal(v.electrical.buses.generator2,'POWERED'); // still on APU, GEN2 source available
assert.equal(v.propulsion.engines['2'].generatorAvailable,true);
assert.equal(v.pumps.hydraulic.B.engineDriven.engineRunning,true);
assert.equal(v.pumps.hydraulic.A.engineDriven.engineRunning,false);
assert.ok(out.event.propulsionChanges.engines['2']);
out=doIt(s,'SET_GENERATOR_SOURCE',{bus:'bus2',value:'GEN2'});s=out.state;
assert.equal(out.view.electrical.sourceAssignments.bus2,'GEN2');
assert.equal(out.view.electrical.sourceAssignments.bus1,'APU');
assert.equal(out.view.electrical.buses.generator1,'POWERED');
// Engine1 is started in the same way, using the retained APU bleed source.
const start1=[
  cmd('SET_FUEL_PUMP_SWITCH',{pump:'MAIN1_AFT',value:true}),
  cmd('SET_ENGINE_START_SWITCH',{engine:1,value:'GRD'}),
  cmd('SET_ENGINE_N1_ROTATION',{engine:1,value:true}),
  cmd('SET_ENGINE_N2',{engine:1,value:25}),
  cmd('SET_ENGINE_START_LEVER',{engine:1,value:'IDLE'}),
  cmd('CONFIRM_ENGINE_LIGHTOFF',{engine:1}),
  cmd('SET_ENGINE_N2',{engine:1,value:46}),
  cmd('CONFIRM_ENGINE_IDLE',{engine:1}),
  cmd('SET_GENERATOR_SOURCE',{bus:'bus1',value:'GEN1'})
];
const res=replay(s,start1);s=res.state;v=res.view;
assert.equal(v.electrical.sourceAssignments.bus1,'GEN1');
assert.equal(v.electrical.sourceAssignments.bus2,'GEN2');
assert.equal(v.propulsion.engines['1'].status,'RUNNING_CONFIRMED');
assert.equal(v.propulsion.engines['2'].status,'RUNNING_CONFIRMED');
assert.equal(v.pumps.hydraulic.A.engineDriven.engineRunning,true);
assert.equal(v.pumps.hydraulic.B.engineDriven.engineRunning,true);
assert.equal(v.electrical.buses.main1,'POWERED');
assert.equal(v.electrical.buses.main2,'POWERED');
assert.equal(v.electrical.buses.dc1,'POWERED');
assert.equal(v.electrical.buses.dc2,'POWERED');
assert.deepEqual(Object.values(v.electrical.sourceAssignments).sort(),['GEN1','GEN2']);
out=doIt(s,'SET_APU_SWITCH',{value:'OFF'});s=out.state;
assert.equal(out.view.propulsion.apu.phase,'OFF');
assert.equal(out.view.electrical.buses.generator1,'POWERED');
assert.equal(out.view.electrical.buses.generator2,'POWERED');
// When engine 1 is shut down, hydraulic A engine pump and GEN1 availability
// follow it; GEN2 may keep TRANSFER1 in BUS TRANS AUTO.
out=doIt(s,'ABORT_ENGINE_START',{engine:1});
assert.equal(out.view.electrical.buses.generator1,'UNPOWERED');
assert.equal(out.view.electrical.buses.transfer1,'POWERED');
assert.equal(out.view.pumps.hydraulic.A.engineDriven.engineRunning,false);
assert.equal(out.view.pumps.hydraulic.B.engineDriven.engineRunning,true);

// APU start must refuse invalid DC/fire interlocks and No.1 tank fuel.
const cold=doIt(init(),'ENTER_COLD_DARK').state;
let battOff=doIt(cold,'SET_BATTERY_SWITCH',{value:false}).state;
out=doIt(battOff,'SET_APU_SWITCH',{value:'START'});
assert.equal(out.view.propulsion.apu.phase,'OFF');
assert.equal(out.view.propulsion.apu.fault,'APU_START_INTERLOCK');
const noFuel=doIt(cold,'SET_FUEL_INLET',{tank:'MAIN1',value:false}).state;
const noFuelStart=doIt(doIt(noFuel,'SET_APU_SWITCH',{value:'START'}).state,
  'SET_APU_INLET_OPEN',{value:true}).state;
assert.throws(()=>doIt(noFuelStart,'CONFIRM_APU_READY'),Error);

// Failure: APU started, but no pneumatic pressure measurement: no motoring.
const apuBase=replay(cold,[
  cmd('SET_APU_SWITCH',{value:'START'}),
  cmd('SET_APU_INLET_OPEN',{value:true}),
  cmd('CONFIRM_APU_READY'),
  cmd('SET_GENERATOR_SOURCE',{bus:'bus1',value:'APU'}),
  cmd('SET_GENERATOR_SOURCE',{bus:'bus2',value:'APU'}),
  cmd('SET_APU_BLEED',{value:true}),
  cmd('SET_FUEL_PUMP_SWITCH',{pump:'MAIN2_AFT',value:true}),
  cmd('SET_ENGINE_START_SWITCH',{engine:2,value:'GRD'}),
  cmd('SET_ENGINE_N1_ROTATION',{engine:2,value:true}),
  cmd('SET_ENGINE_N2',{engine:2,value:25}),
  cmd('SET_ENGINE_START_LEVER',{engine:2,value:'IDLE'})
]);
assert.equal(apuBase.view.propulsion.engines['2'].status,'AIR_NOT_CONFIRMED');
assert.throws(()=>doIt(apuBase.state,'CONFIRM_ENGINE_LIGHTOFF',{engine:2}),Error);
const lowAir=doIt(apuBase.state,'SET_DUCT_PSI',{value:12});
assert.equal(lowAir.view.propulsion.engines['2'].status,'AIR_NOT_CONFIRMED');
assert.throws(()=>doIt(lowAir.state,'CONFIRM_ENGINE_LIGHTOFF',{engine:2}),Error);
const noR=doIt(lowAir.state,'SET_DUCT_PSI',{value:31});
assert.equal(noR.view.propulsion.engines['2'].status,'AWAITING_LIGHTOFF_CONFIRMATION');
const loss=doIt(noR.state,'SET_APU_SWITCH',{value:'OFF'});
assert.equal(loss.view.electrical.buses.acStandby,'UNPOWERED'); // ground AUTO inhibits battery standby after AC loss
assert.notEqual(loss.view.propulsion.engines['2'].status,'AWAITING_LIGHTOFF_CONFIRMATION');
assert.throws(()=>doIt(loss.state,'CONFIRM_ENGINE_LIGHTOFF',{engine:2}),Error);
// False positive engine gen availability cannot be set directly.
assert.throws(()=>doIt(cold,'SET_GENERATOR_AVAILABLE',{generator:'APU',value:true}),Error);
assert.throws(()=>doIt(cold,'SET_ENGINE_N2',{engine:1,value:120}),TypeError);
assert.throws(()=>doIt(cold,'SET_ENGINE_START_SWITCH',{engine:3,value:'GRD'}),TypeError);
assert.equal(init().propulsion.mode,'LEGACY_FIXTURE');
console.log('ISN-06 cold-dark APU battery/bleed; engine N2 fuel/ignition sequence; generator/hydraulic synchronization PASS');
