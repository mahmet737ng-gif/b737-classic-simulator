'use strict';
const assert=require('node:assert/strict');
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
const s=new ECU.Testbench({Electrical,Loads,TrainerCore,WarningEngine,Pneumatics,Pack,
 EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime});
s.battery(true);
s.startAPU();
s.advance(85000);
assert.equal(s.get().apu.phase,'READY');
// APU running alone does not power either ignition channel: explicitly
// connect APU GEN to AC transfer, preserving physical source-selection logic.
s.selectGenerator('APU',1);
s.apuBleed(true);
for(const [id,next] of [
 ['pack-l','OFF'],['pack-r','OFF'],['isolation-valve','OPEN']
])s.chain.event({id,kind:'toggle',next});
assert.equal(s.chain.canStartEngine('engine1'),null);
s.engineStart('engine1');
s.advance(28000);
assert.equal(s.get().engines.engine1.phase,'AWAIT_FUEL_LEVER_IDLE');
assert.equal(s.fuelLever('engine1','IDLE').accepted,true);
s.advance(37000);
assert.equal(s.get().engines.engine1.phase,'RUNNING');
// GEN 1 must be selected before disconnecting the APU generator; otherwise
// valve-control and transfer-bus power may be unavailable.
s.selectGenerator('GEN1',1);
// APU shutdown leaves first engine providing a real, independently
// source-observed engine bleed (training pressure is separately configured).
s.chain.stopAPU();
s.advance(1000);
s.chain.event({id:'bleed-apu',kind:'toggle',next:'OFF'});
// ENG BLEED stays OFF after the first start until the pilot actively selects ON.
s.chain.event({id:'bleed-eng-1',kind:'toggle',next:'ON'});
const duct=Pneumatics.derive(s.start.core.pneumaticState);
assert.equal(duct.bleed.engine1ValveOpen,true);
assert.equal(duct.bleed.isolationOpen,true);
assert.equal(duct.duct.R.anySupply,true);
assert.equal(s.chain.canStartEngine('engine2'),null,
 'Crossbleed from observed ENG1 via OPEN isolation must be eligible without APU');
s.engineStart('engine2');
assert.equal(s.get().engines.engine2.phase,'MOTORING');
assert.equal(s.get().engines.engine1.phase,'RUNNING');
s.chain.event({id:'engine-start-1',kind:'rotary',next:'CONT'});
assert.equal(s.start.getLive().controls.engine1.startSwitch,'CONT');
s.chain.event({id:'engine-start-1',kind:'rotary',next:'FLT'});
assert.equal(s.start.getLive().controls.engine1.startSwitch,'FLT');
s.chain.event({id:'engine-start-1',kind:'rotary',next:'OFF'});
assert.equal(s.start.getLive().controls.engine1.startSwitch,'OFF');
assert.equal(s.get().engines.engine1.phase,'RUNNING',
 'Switch OFF must not magically stop the running engine');
console.log('PASS: crossbleed ENG2 start with APU off, real CONT/FLT/OFF ignition detents and independent running engine');
