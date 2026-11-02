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

// Regression: live reads must be cached, detached and recursively immutable;
// commands, same-sequence battery updates and reset must invalidate them.
const b=rig();
for(const session of [b.start,b.start.core,b.start.core.pack]){
 const live=session.getLive();
 assert.equal(session.getLive(),live);
 assert.equal('recentEvents' in live,false);
 const walk=value=>{if(value&&typeof value==='object'){assert.ok(Object.isFrozen(value));Object.values(value).forEach(walk);}};
 walk(live);
 assert.throws(()=>{live.schema='corrupt';},TypeError);
 const diagnostic=session.get();diagnostic.schema='private edit';
 assert.notEqual(session.getLive().schema,'private edit');
 assert.ok(Array.isArray(diagnostic.recentEvents));
}
const old=b.start.getLive();b.battery(true);
assert.notEqual(b.start.getLive(),old);
assert.equal('recentEvents' in b.start.getLive().network,false);
assert.ok(Array.isArray(b.start.get().network.recentEvents));
const pack=b.start.core.pack;pack.attachBattery(require('../engine/systems/battery-dynamics-v1'));
const previous=pack.getLive();pack.rechargeBattery();
assert.notEqual(pack.getLive(),previous);
const prior=b.start.getLive();b.start.reset();assert.notEqual(b.start.getLive(),prior);
console.log('Live snapshot isolation, cache, history and invalidation passed');
// Same commands and simulation time must produce identical diagnostic output.
const types=[Start.Session,EngineAPU.Session,Pack.Session];
const readers=types.map(Type=>Type.prototype.getLive);
function scenario(legacy){
 try{
  types.forEach((Type,i)=>{Type.prototype.getLive=legacy?function(){return this.get();}:readers[i];});
  const run=rig();run.battery(true);run.startAPU();run.advance(1400);
  run.selectGenerator('APU',1);run.apuBleed(true);run.prepareFuel();
  run.engineStart('engine1');run.advance(850);run.fuelLever('engine1','IDLE');
  for(let i=0;i<20;i++)run.advance(100);
  return {ecu:run.get(),start:run.start.get(),pack:run.start.core.pack.get()};
 }finally{types.forEach((Type,i)=>{Type.prototype.getLive=readers[i];});}
}
assert.deepEqual(scenario(false),scenario(true));
console.log('Cached and legacy reads preserve engine start, fuel, electrical and diagnostic outputs');
