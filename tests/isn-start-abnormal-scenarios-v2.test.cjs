'use strict';
const assert=require('node:assert/strict');
const Electrical=require('../engine/systems/electrical-v7');
const Loads=require('../engine/systems/electrical-loads-v8');
const TrainerCore=require('../engine/trainer/core');
const {WarningEngine}=require('../audio/warning-engine');
const Pneumatics=require('../engine/systems/pneumatics-v6');
const Pack=require('../engine/integration/isn-electrical-pack-v1');
const EngineAPU=require('../engine/integration/isn-engine-apu-v1');
const Start=require('../engine/integration/isn-start-sequence-v1');
const Dynamics=require('../engine/integration/isn-engine-start-dynamics-v1');
const {Chain,FAULT_KEYS,FAULT_TIMING,ORIGIN}=require('../engine/integration/isn-apu-start-chain-v1');

function prepared(){
 const session=new Start.Session({EngineAPU,ElectricalPack:Pack,Electrical,Loads,TrainerCore,WarningEngine,Pneumatics});
 const chain=new Chain(session);
 chain.synchronize({toggles:{'bleed-apu':'ON','pack-l':'OFF','pack-r':'OFF','isolation-valve':'OPEN'},
  guards:{'battery-master':{value:'on'}},rotaries:{'ignition-source':'BOTH'},context:{onGround:true}});
 chain.event({id:'apu-start',kind:'toggle',next:'START'});chain.advance(1400);
 session.core.pack.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',source:'APU',side:1}});
 chain.syncPower();return chain;
}
function start(chain,n){chain.event({id:'engine-start-'+n,kind:'rotary',next:'GRD'});}
function fuel(chain,n){chain.advance(850);chain.lever('engine'+n,'IDLE');}
function off(chain,n){chain.lever('engine'+n,'CUTOFF');}

assert.deepEqual(FAULT_KEYS,['n2Stall','egtHigh','noLightOff','hungStart','earlyCutout','flameOut']);
assert.equal(Dynamics.sample('LIGHT_OFF_SEQUENCE',1000,{noLightOff:true}).egtC,0);
assert.equal(Dynamics.sample('LIGHT_OFF_SEQUENCE',1000,{noLightOff:true}).n2Percent,32);
assert.equal(Dynamics.sample('LIGHT_OFF_SEQUENCE',1000,{hungStart:true}).n2Percent,35);
assert.equal(Dynamics.sample('LIGHT_OFF_SEQUENCE',1000,{hungStart:true}).egtC,250);

// Fuel flow with no EGT rise is an injected no-light-off case, not an
// automatic diagnosis or a fabricated running source.
let chain=prepared();chain.setTrainingFault('engine1','noLightOff',true);
start(chain,1);fuel(chain,1);chain.advance(5000);
let s=chain.get(),f=s.faultStatus.engine1;
assert.equal(s.phase.engine1,'NO_LIGHT_OFF');
assert.equal(f.selected,'noLightOff');assert.equal(f.origin,ORIGIN);
assert.deepEqual([f.observed.n2Percent,f.observed.egtC,f.observed.fuelFlowKgHr],[32,0,400]);
assert.equal(f.observed.running,false);assert.equal(f.observed.startValveOpen,true);
assert.equal(f.requiredAction,'MOVE_START_LEVER_TO_CUTOFF');assert.equal(f.retryAllowed,false);
assert.equal(s.observations.engine1.rules.advisory.egt725Latched,false);
assert.equal(chain.start.core.pack.get().warnings.audio.active.some(a=>a.id==='fireBell'),false);
start(chain,1);assert.equal(chain.get().phase.engine1,'NO_LIGHT_OFF');
off(chain,1);s=chain.get();
assert.equal(s.phase.engine1,'OFF');assert.equal(s.faultStatus.engine1.observed.fuelFlowKgHr,0);
assert.equal(s.faultStatus.engine1.observed.startValveOpen,false);
assert.equal(s.faultStatus.engine1.retryAllowed,true);
chain.setTrainingFault('engine1','noLightOff',false);
start(chain,1);fuel(chain,1);chain.advance(1000);
assert.equal(chain.get().sources.engine1.running,true,'normal retry works after CUTOFF and fault removal');

// Hung-start plateau is injected; no unsupported rate-of-acceleration
// criterion or automatic fire warning is asserted.
chain=prepared();chain.setTrainingFault('engine2','hungStart',true);
start(chain,2);fuel(chain,2);chain.advance(5000);s=chain.get();f=s.faultStatus.engine2;
assert.equal(s.phase.engine2,'HUNG_START');
assert.deepEqual([f.observed.n2Percent,f.observed.egtC,f.observed.fuelFlowKgHr],[35,250,350]);
assert.equal(f.observed.running,false);assert.equal(f.observed.startValveOpen,true);
assert.equal(s.observations.engine2.rules.advisory.accelerationAfter32Criterion,null);
assert.equal(f.requiredAction,'MOVE_START_LEVER_TO_CUTOFF');
off(chain,2);assert.equal(chain.get().phase.engine2,'OFF');

// Premature starter cutout is queued before the normal motoring checkpoint,
// even if the instructor advances the clock in one large step.
chain=prepared();chain.setTrainingFault('engine1','earlyCutout',true);
start(chain,1);chain.advance(5000);s=chain.get();f=s.faultStatus.engine1;
assert.equal(s.phase.engine1,'EARLY_STARTER_CUTOUT');
assert.ok(f.observed.n2Percent>0&&f.observed.n2Percent<25);
assert.equal(f.observed.fuelStartLever,'CUTOFF');
assert.equal(f.observed.startValveOpen,false);
assert.equal(f.observed.running,false);assert.equal(f.retryAllowed,false);
assert.equal(chain.start.get().network.requests.engine1,'SHUTDOWN');
assert.deepEqual(chain.consumeEffects(),[{type:'ROTARY_RELEASE',id:'engine-start-1',position:'OFF'}]);
off(chain,1);assert.equal(chain.get().phase.engine1,'OFF');
chain.setTrainingFault('engine1','earlyCutout',false);start(chain,1);
assert.equal(chain.get().phase.engine1,'MOTORING');

// Flameout occurs only after a witnessed training RUNNING state. It removes
// the source but does not silently move the fuel lever or invent zero flow.
chain=prepared();chain.setTrainingFault('engine2','flameOut',true);
start(chain,2);fuel(chain,2);chain.advance(1000);
assert.equal(chain.get().phase.engine2,'RUNNING');
chain.advance(FAULT_TIMING.flameOutAfterRunningMs-1);
assert.equal(chain.get().sources.engine2.running,true);
chain.advance(1);s=chain.get();f=s.faultStatus.engine2;
assert.equal(s.phase.engine2,'FLAMEOUT');assert.equal(f.observed.running,false);
assert.equal(f.observed.fuelStartLever,'IDLE');assert.equal(f.observed.fuelFlowKgHr,null);
assert.equal(f.requiredAction,'MOVE_START_LEVER_TO_CUTOFF');assert.equal(f.retryAllowed,false);
assert.equal(chain.start.get().network.requests.engine2,'SHUTDOWN');
start(chain,2);assert.equal(chain.get().phase.engine2,'FLAMEOUT');
off(chain,2);assert.equal(chain.get().phase.engine2,'OFF');
chain.setTrainingFault('engine2','flameOut',false);start(chain,2);
assert.equal(chain.get().phase.engine2,'MOTORING');

// Manual shutdown before the scheduled flameout cancels that fault job.
chain=prepared();chain.setTrainingFault('engine1','flameOut',true);
start(chain,1);fuel(chain,1);chain.advance(1000);off(chain,1);chain.advance(5000);
assert.equal(chain.get().phase.engine1,'OFF');
assert.equal(chain.get().sources.engine1.running,false);

// A newly selected instructor failure replaces the old one on that engine
// without changing the other engine's independent configuration.
chain=prepared();chain.setTrainingFault('engine1','noLightOff',true);
chain.setTrainingFault('engine2','earlyCutout',true);
chain.setTrainingFault('engine1','hungStart',true);
assert.equal(chain.get().trainingFaults.engine1.noLightOff,false);
assert.equal(chain.get().trainingFaults.engine1.hungStart,true);
assert.equal(chain.get().trainingFaults.engine2.earlyCutout,true);
assert.throws(()=>chain.setTrainingFault('engine1','notReal',true),/Invalid instructor start fault/);

console.log('PASS ISN-08 backend no-light-off, hung start, early cutout and flameout; manual cutoff, retry gates and source separation.');
