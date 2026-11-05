'use strict';
// FCOM 2.20.2, MRG IV.7 and Lufthansa LAN ATA36: physical pneumatic
// source topology, not switch OPEN, is the engine starter's air gate.
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
function ready(){
 const s=new ECU.Testbench({Electrical,Loads,TrainerCore,WarningEngine,
  Pneumatics,Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,
  timingProfile:'CLASSROOM_COMPRESSED'});
 s.battery(true);s.startAPU();s.advance(1400);s.apuBleed(true);
 for(const id of ['pack-l','pack-r'])
  s.chain.event({id,kind:'toggle',next:'OFF'});
 return s;
}
function valve(s){return Pneumatics.derive(s.start.core.pneumaticState);}
const auto=ready();auto.selectGenerator('APU',1);
auto.chain.event({id:'isolation-valve',kind:'toggle',next:'AUTO'});
assert.equal(valve(auto).bleed.isolationOpen,true,'AUTO opens with PACK OFF');
assert.equal(valve(auto).duct.L.anySupply,true);
assert.equal(valve(auto).duct.R.anySupply,true);
assert.equal(auto.chain.canStartEngine('engine1'),null);
assert.equal(auto.chain.canStartEngine('engine2'),null);
auto.engineStart('engine1');auto.engineStart('engine2');
assert.equal(auto.get().engines.engine1.phase,'MOTORING');
assert.equal(auto.get().engines.engine2.phase,'MOTORING');
const close=ready();close.selectGenerator('APU',1);
close.chain.event({id:'isolation-valve',kind:'toggle',next:'CLOSE'});
assert.equal(valve(close).bleed.isolationOpen,false);
assert.equal(valve(close).duct.L.anySupply,true,'APU locally supplies engine 1');
assert.equal(valve(close).duct.R.anySupply,false,'no APU air crosses closed valve');
assert.equal(close.chain.canStartEngine('engine1'),null,'CLOSE is not global start lock');
assert.match(close.chain.canStartEngine('engine2'),/NO RIGHT START DUCT AIR/);
close.engineStart('engine1');close.engineStart('engine2');
assert.equal(close.get().engines.engine1.phase,'MOTORING');
assert.equal(close.get().engines.engine2.phase,'BLOCKED');
close.chain.event({id:'engine-start-2',kind:'rotary',next:'OFF'});
close.chain.event({id:'isolation-valve',kind:'toggle',next:'AUTO'});
assert.equal(close.chain.canStartEngine('engine2'),null);
close.engineStart('engine2');
assert.equal(close.get().engines.engine2.phase,'MOTORING');
const unpowered=ready(); // APU BLEED active, but no APU GEN on TRANSFER BUS 1.
unpowered.chain.event({id:'isolation-valve',kind:'toggle',next:'AUTO'});
assert.equal(unpowered.start.core.pneumaticState.inputs.isolationAcPower,false);
assert.equal(valve(unpowered).bleed.isolationOpen,null);
assert.equal(unpowered.chain.canStartEngine('engine1'),null,
 'local APU source exists without powered crossover actuator');
assert.match(unpowered.chain.canStartEngine('engine2'),/ROUTE UNVERIFIED/);
unpowered.selectGenerator('APU',1);
assert.equal(valve(unpowered).bleed.isolationOpen,true);
assert.equal(unpowered.chain.canStartEngine('engine2'),null);
let p=Pneumatics.initial();
p=Pneumatics.apply(p,{type:'CONTROL',key:'apuBleed',value:'ON'});
p=Pneumatics.apply(p,{type:'SENSOR',key:'apuRunning',value:true});
assert.equal(Pneumatics.derive(p).bleed.isolationOpen,false,
 'APU BLEED alone never changes isolation AUTO position');
console.log('PASS FCOM/LAN/MRG isolation routing: APU left; AUTO opens packs OFF; CLOSE blocks right only; AC transfer1 controls actuator');
