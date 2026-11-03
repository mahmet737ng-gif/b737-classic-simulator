'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
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
const ECU=require('../engine/integration/isn-13-18-ecu-testbench-v1');
const sim=()=>new ECU.Testbench({Electrical,Loads,TrainerCore,WarningEngine,
 Pneumatics,Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,timingProfile:'REALTIME_TRAINING'});

test('APU READY preset requires explicit instructor action and real battery prerequisites',()=>{
 const unit=sim();
 assert.throws(()=>unit.instructorPresetAPUReady(),/Explicit instructor/);
 assert.throws(()=>unit.instructorPresetAPUReady({instructor:true}),/BATTERY ON/);
 assert.equal(unit.get().apu.phase,'OFF');
});

test('Unified initial APU READY uses real single-owner source, gauges and normal OFF',()=>{
 const unit=sim();
 unit.battery(true);
 unit.apuBleed(true);
 const before=unit.get();
 assert.equal(before.apu.phase,'OFF');
 const initialFuel=before.fuel.tanksKg.main1;
 const result=unit.instructorPresetAPUReady({instructor:true});
 assert.equal(result.apu.phase,'READY');
 assert.equal(result.apu.generator.ready,true);
 assert.equal(result.apu.generator.voltageV,115);
 assert.equal(result.apu.generator.frequencyHz,400);
 assert.equal(result.apu.generator.connectedBusSides.length,0,'APU generator must not auto-connect');
 assert.equal(result.apu.rpmPct,95.5);
 assert.ok(result.apu.egtC>=390&&result.apu.egtC<=460,'steady-state EGT from the live load model');
 assert.equal(result.apu.oil.pressurePsi,55);
 assert.equal(result.apu.oil.lowPressureLamp,false);
 assert.equal(unit.chain.get().sources.apu.running,true);
 assert.equal(unit.chain.jobs.filter(job=>job.device==='apu').length,0);
 assert.equal(result.engines.engine1.phase,'OFF');
 assert.equal(result.engines.engine2.phase,'OFF');
 assert.equal(result.fuel.tanksKg.main1,initialFuel,'preset must not burn 85 seconds of fuel');
 assert.equal(unit.instructorPresetAPUReady({instructor:true}).apu.phase,'READY','idempotent preset');
 unit.advance(1000);
 assert.equal(unit.get().apu.phase,'READY');
 assert.ok(unit.get().fuel.tanksKg.main1<initialFuel,'real fuel consumption after launch');
 unit.chain.event({id:'apu-start',kind:'toggle',next:'OFF'});
 unit.advance(1000);
 assert.equal(unit.get().apu.phase,'OFF','physical APU OFF must work after initial preset');
 assert.equal(unit.chain.get().sources.apu.running,false);
});
