'use strict';
// These are *focused* changes to B737 Classic source/pack routing, not a
// replacement for unrelated baseline Electrical V7 / fuel-path QA.
const assert=require('node:assert/strict');
const E=require('../engine/systems/electrical-v7.js');
const Network=require('../engine/systems/electrical-network-v1.js');
const Selector=require('../panel-mosaic-lab/cockpit/ac-dc-selector-model-v1.js');
const Pneumatics=require('../engine/systems/pneumatics-v6.js');
const Packs=require('../engine/integration/isn-electrical-pack-v1.js');
const Loads=require('../engine/systems/electrical-loads-v8.js');
const TrainerCore=require('../engine/trainer/core.js');
const {WarningEngine}=require('../audio/warning-engine');
const EngineAPU=require('../engine/integration/isn-engine-apu-v1.js');
const Start=require('../engine/integration/isn-start-sequence-v1.js');
const Chain=require('../engine/integration/isn-apu-start-chain-v1.js');
const Dynamics=require('../engine/integration/isn-engine-start-dynamics-v1.js');
const control=(s,key,value)=>E.apply(s,{type:'CONTROL',key,value});
const select=(s,source,side)=>E.apply(s,{type:'SELECT_SOURCE',source,side});
const net=s=>Network.project(s,E.evaluate(s),{numericMode:'NOMINAL_MODEL'});
let s=E.initialState({coldDark:true});
s=control(s,'engine1Running',true);
let n=net(s);
assert.equal(n.nodes.GEN1.busContactorClosed,false);
assert.equal(n.nodes.GEN1.driveAtOperatingSpeed,true);
assert.equal(n.nodes.GEN1.electricallyExcited,true);
assert.equal(n.meterSources.AC.GEN1.volts,115);
assert.equal(n.meterSources.AC.GEN1.cps,400);
assert.equal(n.nodes.GENERATOR_BUS_1.powered,false);
assert.equal(n.nodes.MAIN_1.powered,false);
assert.equal(n.lamps.genOffBus1,true);
let selectors=Selector.create();
for(const pos of ['GEN1','GEN2'])selectors.setSourceMeasurement('AC',pos,n.meterSources.AC[pos]);
selectors.choose('AC','GEN1');
assert.equal(selectors.readings().acVolts,115);
assert.equal(selectors.readings().cps,400);
s=control(s,'engine2Running',true);n=net(s);
selectors.setSourceMeasurement('AC','GEN2',n.meterSources.AC.GEN2);
selectors.choose('AC','GEN2');
assert.equal(selectors.readings().acVolts,115);
assert.equal(selectors.readings().cps,400);
assert.equal(n.nodes.GENERATOR_BUS_2.powered,false);
s=select(s,'GEN1',1);n=net(s);
assert.equal(n.nodes.GENERATOR_BUS_1.powered,true);
assert.equal(n.meterSources.AC.GEN1.volts,115);
s=select(s,'OFF',1);n=net(s);
assert.equal(n.nodes.GENERATOR_BUS_1.powered,false);
assert.equal(n.meterSources.AC.GEN1.volts,115);
s=control(s,'engine1Running',false);n=net(s);
assert.equal(n.meterSources.AC.GEN1.volts,0);
assert.equal(n.meterSources.AC.GEN1.cps,0);
s=E.apply(s,{type:'FAULT',id:'GEN2_FAILED',active:true,instructor:true});n=net(s);
assert.equal(n.meterSources.AC.GEN2.volts,0);
assert.equal(n.meterSources.AC.GEN2.cps,0);
const sensorOnly=Network.project(control(E.initialState({coldDark:true}),'engine1Running',true),
 E.evaluate(control(E.initialState({coldDark:true}),'engine1Running',true)),{numericMode:'SENSOR_ONLY'});
assert.equal(sensorOnly.meterSources.AC.GEN1.volts,null);
// Packs are independent consumers and cannot be an unverified electrical
// starter inhibit if the corresponding manifold has start air.
const ECU=require('../engine/integration/isn-13-18-ecu-testbench-v1.js');
const ThrustPlanner=require('../engine/integration/isn-thrust-performance-v1.js');
const FuelRuntime=require('../engine/integration/isn-09-12-runtime-v1.js');
const sim=new ECU.Testbench({Electrical:E,Loads,TrainerCore,WarningEngine,Pneumatics,
 Pack:Packs,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,timingProfile:'CLASSROOM_COMPRESSED'});
sim.battery(true);sim.startAPU();sim.advance(1400);sim.apuBleed(true);
sim.chain.event({id:'pack-l',kind:'toggle',next:'AUTO'});
sim.chain.event({id:'pack-r',kind:'toggle',next:'HIGH'});
assert.equal(Pneumatics.derive(sim.start.core.pneumaticState).duct.L.anySupply,true);
assert.equal(sim.chain.canStartEngine('engine1'),null,
 'PACK AUTO/HIGH must not create start interlock when left manifold supplied');
sim.engineStart('engine1');
assert.equal(sim.get().engines.engine1.phase,'MOTORING');
console.log('CLASSIC_PACK_GEN_SOURCE_PASS',JSON.stringify({packAutoAllowed:true,
 generatorVolts:115,generatorHz:400,genOffBusStillLit:true,busStillIsolated:true,
 failedAndStoppedGeneratorsDoNotSupply:true,selectionReadings:true}));
