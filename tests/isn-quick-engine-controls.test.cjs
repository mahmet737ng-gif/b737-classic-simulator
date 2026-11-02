'use strict';
/* ISN-13 through ISN-18 deterministic simulation QA. Node tests never alter art. */
const assert=require('node:assert/strict');
const B=require('../engine/integration/isn-13-18-ecu-testbench-v1');
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
// Legacy compressed course tests explicitly opt in. The web ECU bench now
// defaults to the longer user-selected timing profile.
const rig=()=>new B.Testbench({Electrical,Loads,TrainerCore,WarningEngine,Pneumatics,Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,timingProfile:'CLASSROOM_COMPRESSED'});

const b=rig();assert.throws(()=>b.instructorRunEngine('engine1'));
b.instructorRunEngine('engine1',{instructor:true});assert.equal(b.get().engines.engine1.phase,'RUNNING');assert.equal(b.get().engines.engine2.phase,'OFF');
b.instructorRunEngine('engine2',{instructor:true});
const initial=b.get();b.setThrottle('engine1',1);b.advance(5000);
assert.ok(b.get().engines.engine1.n1Percent>initial.engines.engine1.n1Percent);assert.equal(b.get().engines.engine2.phase,'RUNNING');
b.instructorRunEngine('engine1',{instructor:true});assert.equal(b.chain.throttle.engine1,1);
b.fuelLever('engine1','CUTOFF');b.advance(1000);assert.equal(b.get().engines.engine1.phase,'OFF');assert.equal(b.get().engines.engine2.phase,'RUNNING');
console.log('PASS independent instructor presets, power response, idempotence and cutoff');
