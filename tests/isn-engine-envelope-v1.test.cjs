'use strict';
// Simulator-only owner-selected operating envelope. These are not approved AFM values.
const assert=require('node:assert/strict');
const Dynamics=require('../engine/integration/isn-engine-start-dynamics-v1');
const Electrical=require('../engine/systems/electrical-v7');
const Loads=require('../engine/systems/electrical-loads-v8');
const TrainerCore=require('../engine/trainer/core');
const {WarningEngine}=require('../audio/warning-engine');
const Pneumatics=require('../engine/systems/pneumatics-v6');
const Pack=require('../engine/integration/isn-electrical-pack-v1');
const EngineAPU=require('../engine/integration/isn-engine-apu-v1');
const Start=require('../engine/integration/isn-start-sequence-v1');
const {Chain}=require('../engine/integration/isn-apu-start-chain-v1');
const near=(value,want,tol=0.3)=>assert.ok(Math.abs(value-want)<=tol,
 'expected '+value+' to be near '+want+' ± '+tol);
assert.equal(Dynamics.ORIGIN,'TRAINING_SEQUENCE_SIMULATED');
assert.equal(Dynamics.ENVELOPE.normalStartPeakEgtC,620);
near(Dynamics.sample('LIGHT_OFF_SEQUENCE',750).egtC,620,0.001);
assert.equal(Dynamics.sample('LIGHT_OFF_SEQUENCE',1000).egtC,420);
assert.ok(Dynamics.sample('LIGHT_OFF_SEQUENCE',850,{egtHigh:true}).egtC>600);
assert.deepEqual(Dynamics.runningTarget({throttle:0,onGround:true}),
 Dynamics.ENVELOPE.groundIdle);
assert.deepEqual(Dynamics.runningTarget({throttle:0,onGround:false}),
 Dynamics.ENVELOPE.flightIdle);
assert.deepEqual(Dynamics.runningTarget({throttle:1,onGround:true}),
 Dynamics.ENVELOPE.fullThrust);
assert.throws(()=>Dynamics.runningTarget({throttle:1.1}));
assert.throws(()=>Dynamics.stepRunning(Dynamics.initialRunning(),{deltaMs:-1}));
let state=Dynamics.initialRunning();
state=Dynamics.stepRunning(state,{deltaMs:30000,throttle:0,onGround:true});
near(state.n1Percent,22);near(state.n2Percent,60);near(state.egtC,445);
state=Dynamics.stepRunning(state,{deltaMs:30000,throttle:0,onGround:false});
near(state.n1Percent,32);near(state.n2Percent,78);near(state.egtC,495);
state=Dynamics.stepRunning(state,{deltaMs:30000,throttle:1,onGround:false});
assert.ok(state.n1Percent>96.9&&state.n1Percent<=97);
assert.ok(state.n2Percent>100&&state.n2Percent<=101);
assert.ok(state.egtC>680&&state.egtC<=695);
state=Dynamics.stepRunning(state,{deltaMs:30000,throttle:0,onGround:false});
assert.ok(state.n1Percent>=32&&state.n2Percent>=78);
near(state.n1Percent,32);near(state.n2Percent,78);
const start=new Start.Session({EngineAPU,ElectricalPack:Pack,Electrical,Loads,TrainerCore,WarningEngine,Pneumatics});
const chain=new Chain(start);
chain.synchronize({
 toggles:{'apu-start':'ON','bleed-apu':'ON','bleed-eng-1':'ON','bleed-eng-2':'ON',
 'pack-l':'OFF','pack-r':'OFF','isolation-valve':'OPEN'},
 guards:{'battery-master':{value:'on'}},
 rotaries:{'ignition-source':'BOTH','engine-start-1':'OFF','engine-start-2':'OFF'},
 context:{onGround:true}
});
chain.event({id:'apu-start',kind:'toggle',next:'START'});chain.advance(1400);
start.core.pack.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',source:'APU',side:1}});
chain.syncPower();
chain.event({id:'engine-start-1',kind:'rotary',next:'GRD'});
chain.advance(850);chain.lever('engine1','IDLE');chain.advance(750);
near(chain.get().observations.engine1.feedback.egtC.value,620,0.001);
chain.advance(250);assert.equal(chain.get().phase.engine1,'RUNNING');
let sim=chain.get().runningEnvelope;
assert.equal(sim.quality,'SIMULATION_APPROX_ONLY');
assert.equal(sim.engines.engine2,null);
assert.equal(sim.engines.engine1.n2Percent,46);
chain.advance(30000);sim=chain.get().runningEnvelope;
near(sim.engines.engine1.n1Percent,22);
near(chain.get().observations.engine1.feedback.n2Percent.value,60);
near(chain.get().observations.engine1.feedback.egtC.value,445);
chain.setOnGround(false);chain.advance(30000);
sim=chain.get().runningEnvelope;near(sim.engines.engine1.n1Percent,32);
near(sim.engines.engine1.n2Percent,78);
chain.setThrottle('engine1',1);chain.advance(30000);
sim=chain.get().runningEnvelope;
assert.ok(sim.engines.engine1.n1Percent>96.9&&sim.engines.engine1.n1Percent<=97);
chain.setThrottle('engine1',0);chain.advance(30000);
sim=chain.get().runningEnvelope;
assert.ok(sim.engines.engine1.n1Percent>=32&&sim.engines.engine1.n2Percent>=78);
chain.lever('engine1','CUTOFF');
assert.equal(chain.get().runningEnvelope.engines.engine1,null);
assert.equal(chain.get().phase.engine1,'OFF');
assert.throws(()=>chain.setThrottle('engine1',-0.1));
console.log('PASS ISN owner-selected ground/flight idle, N1 max, EGT start peak, smooth throttle and shutdown envelope.');
