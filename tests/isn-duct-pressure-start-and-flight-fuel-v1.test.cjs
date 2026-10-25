'use strict';
// Owner-selected B737 Classic simulator curves, NOT AFM/CFM56-3 certified
// engine fuel tables, measured duct PSI, or approved operating limitations.
const assert=require('node:assert/strict');
const Dynamics=require('../engine/integration/isn-engine-start-dynamics-v1');
const ECU=require('../engine/integration/isn-13-18-ecu-testbench-v1');
const Electrical=require('../engine/systems/electrical-v7');
const Loads=require('../engine/systems/electrical-loads-v8');
const TrainerCore=require('../engine/trainer/core');
const {WarningEngine}=require('../audio/warning-engine');
const Pneumatics=require('../engine/systems/pneumatics-v6');
const Pack=require('../engine/integration/isn-electrical-pack-v1');
const EngineAPU=require('../engine/integration/isn-engine-apu-v1');
const Start=require('../engine/integration/isn-start-sequence-v1');
const Chain=require('../engine/integration/isn-apu-start-chain-v1');
const ThrustPlanner=require('../engine/integration/isn-thrust-performance-v1');
const FuelRuntime=require('../engine/integration/isn-09-12-runtime-v1');
const rig=()=>new ECU.Testbench({Electrical,Loads,TrainerCore,WarningEngine,
 Pneumatics,Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime});
const approx=(v,w,tolerance=5)=>assert.ok(Math.abs(v-w)<=tolerance,
 'Expected '+v+' to be within '+tolerance+' of '+w);
// Reference: 35 PSI -> 28s motoring then 37s lightoff (65s from GRD at prompt IDLE).
const sim=rig();
assert.equal(sim.get().timingProfile,'REALTIME_TRAINING');
assert.equal(sim.get().timing.apuReadyMs,85000,'Do not alter APU 85s user calibration');
assert.equal(sim.get().timing.engineMotoringMs,28000);
assert.equal(sim.get().timing.engineLightoffMs,37000);
approx(sim.get().engines.engine1.startTimingTraining.motoringMs/1000,28,.01);
approx(sim.get().engines.engine1.startTimingTraining.lightoffMs/1000,37,.01);
assert.equal(sim.get().engines.engine1.starterDuctPsiTraining,35);
assert.throws(()=>sim.setStartDuctPressure('engine1',15),/20\.\.50/);
assert.throws(()=>sim.setStartDuctPressure('engine3',35),/Unknown engine/);
sim.setStartDuctPressure('engine2',45);
approx(sim.get().engines.engine2.startTimingTraining.motoringMs/1000,28*35/45,.01);
approx(sim.get().engines.engine2.startTimingTraining.lightoffMs/1000,37*35/45,.01);
sim.battery(true);sim.startAPU();sim.advance(85000);
sim.apuBleed(true);
sim.engineStart('engine1');sim.engineStart('engine2');
assert.equal(sim.get().engines.engine1.phase,'MOTORING');
assert.equal(sim.get().engines.engine2.phase,'MOTORING');
assert.throws(()=>sim.setStartDuctPressure('engine1',40),/before starting/);
sim.advance(20000);
assert.ok(sim.get().engines.engine2.n2Percent>sim.get().engines.engine1.n2Percent,
 'Higher duct pressure must accelerate N2 faster at equal elapsed time');
sim.advance(Math.round(28000*35/45)-20000);
assert.equal(sim.get().engines.engine2.phase,'AWAIT_FUEL_LEVER_IDLE');
assert.equal(sim.get().engines.engine1.phase,'MOTORING');
sim.fuelLever('engine2','IDLE');
sim.advance(28000-Math.round(28000*35/45));
assert.equal(sim.get().engines.engine1.phase,'AWAIT_FUEL_LEVER_IDLE');
sim.fuelLever('engine1','IDLE');
const fastTotal=Math.round(28000*35/45)+Math.round(37000*35/45);
assert.ok(fastTotal<65000);
sim.advance(fastTotal-28000);
assert.equal(sim.get().engines.engine2.phase,'RUNNING');
assert.equal(sim.get().engines.engine1.phase,'LIGHT_OFF_SEQUENCE');
sim.advance(65000-fastTotal);
assert.equal(sim.get().engines.engine1.phase,'RUNNING');
assert.equal(sim.get().engines.engine1.startElapsedSec,65);
assert.ok(sim.get().engines.engine1.fuelFlowKgHr>0);
sim.advance(9000);
approx(sim.get().engines.engine1.n2Percent,60,1);
assert.ok(sim.get().engines.engine1.oil.lowPressureLamp===false);

const lower=rig();
lower.setStartDuctPressure('engine1',25);
assert.ok(lower.get().engines.engine1.startTimingTraining.motoringMs>28000);
assert.ok(lower.get().engines.engine1.startTimingTraining.lightoffMs>37000);
lower.battery(true);lower.startAPU();lower.advance(85000);lower.apuBleed(true);
lower.engineStart('engine1');lower.advance(28000);
assert.ok(lower.get().engines.engine1.n2Percent<25,
 'Low duct pressure should leave engine below nominal 25% N2 at 28 seconds');
assert.equal(lower.get().engines.engine1.phase,'MOTORING');

// Independent operating fuel curves: 4000 kg/h full sea-level takeoff,
// while ~1000 kg/h at flight cruise around 35k/250 IAS/.78 throttle.
assert.equal(Dynamics.runningTarget({throttle:1,onGround:true}).fuelFlowKgHr,4000);
const takeoff=Dynamics.fuelFlowTarget({throttle:1,onGround:true,pressureAltitudeFt:0,iasKt:0});
const takeoffRoll=Dynamics.fuelFlowTarget({throttle:1,onGround:true,pressureAltitudeFt:0,iasKt:145});
const climb=Dynamics.fuelFlowTarget({throttle:.78,onGround:false,pressureAltitudeFt:12000,iasKt:230});
const cruise=Dynamics.fuelFlowTarget({throttle:.78,onGround:false,pressureAltitudeFt:35000,iasKt:250});
assert.ok(takeoff>takeoffRoll&&takeoffRoll>climb&&climb>cruise,
 'Engine fuel flow responds to speed/altitude and power');
assert.ok(takeoffRoll>3700);
assert.ok(cruise>=900&&cruise<=1100,'High-altitude nominal cruise target is ~1000 kg/h');
assert.ok(Dynamics.fuelFlowTarget({throttle:1,onGround:false,pressureAltitudeFt:35000,iasKt:250})>cruise,
 'High-altitude full thrust must still burn more than cruise');
assert.ok(Dynamics.fuelFlowTarget({throttle:0,onGround:false,pressureAltitudeFt:35000,iasKt:250})<cruise);
assert.throws(()=>Dynamics.fuelFlowTarget({throttle:1,pressureAltitudeFt:NaN}),/Invalid/);

// Confirm live fuel measurements and fuel burn use conditions, not only the
// static calculator. Target converges after ~20s first-order response.
sim.setOnGround(true);sim.setFlightInputs({pressureAltitudeFt:0,iasKt:0});
sim.setThrottle('engine1',1);sim.advance(22000);
let live=sim.get().engines.engine1.fuelFlowKgHr;
assert.ok(live>3850,'Takeoff engine fuel flow converges toward 4000 kg/h per engine');
const beforeBurn=sim.get().fuel.burnedKg.engine1;
sim.setOnGround(false);
sim.setFlightInputs({pressureAltitudeFt:35000,iasKt:250});
sim.setThrottle('engine1',.78);sim.advance(22000);
const high=sim.get().engines.engine1.fuelFlowKgHr;
assert.ok(high<1100&&high>900,'Cruise fuel flow drops to ~1000 kg/h in trainer');
assert.ok(sim.get().fuel.burnedKg.engine1>beforeBurn,'ISN-12 consumes actual modeled engine flow');
assert.ok(sim.get().engines.engine1.phase==='RUNNING');
console.log('PASS ECU DUCT & FUEL: 35 PSI 65s engine, higher duct spools faster/lower slower, APU still 85s; 4000kg/h sea-level TO and ~1000kg/h 35k cruise coupled to live flow and fuel burn.');
