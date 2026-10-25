'use strict';
// 737-300/400/500 main-tank bypass suction feed under engine-driven-pump
// rotation. Topology source: Classic FCOM 12.20; numerical onset is SIM only.
// No electric boost pump ON, APU GEN or engineered fuel-bus side effects.
const assert=require('node:assert/strict');
const ECU=require('../engine/integration/isn-13-18-ecu-testbench-v1');
const Fuel=require('../engine/integration/isn-09-12-runtime-v1');
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
 Pneumatics,Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,
 timingProfile:'CLASSROOM_COMPRESSED'});
const n=rig();
n.battery(true);n.startAPU();n.advance(1400);
n.setStandbyPower('BAT');n.setIgnitionSelector('IGN_R');n.apuBleed(true);
assert.ok(Object.values(n.get().electrical.selectedSources).every(x=>x!=='APU'),
 'No APU GEN connected at any point');
const pumps=()=>n.start.core.pack.get().pumps;
for(const id of ['fuel.main1FwdPump','fuel.main1AftPump','fuel.main2FwdPump','fuel.main2AftPump'])
 assert.equal(pumps()[id].switchOn,false,id+' remains OFF');
n.engineStart('engine1');
assert.equal(n.get().engines.engine1.fuelSupplyReady,false,
 'Stationary pump at N2=0 does not create suction pressure');
const zero=n.fuelLever('engine1','CUTOFF');
assert.equal(zero.accepted,true);
n.advance(850);
let a=n.get().engines.engine1;
assert.equal(a.phase,'AWAIT_FUEL_LEVER_IDLE');
assert.equal(a.fuelSupplyReady,true);
assert.equal(a.fuelSupplyReason,'OWN_MAIN_ENGINE_DRIVEN_SUCTION');
assert.equal(a.fuelPath.available,false,'CUTOFF still closes physical fuel command');
assert.equal(a.ignition.eligible.right,true);
let lever=n.fuelLever('engine1','IDLE');
assert.equal(lever.accepted,true);
assert.equal(lever.fuelAvailable,true);
assert.equal(lever.fuelSupplyReason,'OWN_MAIN_ENGINE_DRIVEN_SUCTION');
assert.equal(n.get().engines.engine1.phase,'LIGHT_OFF_SEQUENCE');
assert.ok(n.get().engines.engine1.fuelFlowKgHr>0);
n.advance(1000);
assert.equal(n.get().engines.engine1.phase,'RUNNING');
assert.equal(n.get().engines.engine1.fuelPath.tank,'main1');
n.engineStart('engine2');n.advance(850);
assert.equal(n.get().engines.engine2.fuelSupplyReason,'OWN_MAIN_ENGINE_DRIVEN_SUCTION');
assert.equal(n.fuelLever('engine2','IDLE').fuelAvailable,true);
n.advance(1000);
assert.equal(n.get().engines.engine2.phase,'RUNNING');
assert.equal(n.get().engines.engine2.fuelPath.tank,'main2');
n.advance(4000);
assert.ok(n.get().fuel.burnedKg.engine1>0);
assert.ok(n.get().fuel.burnedKg.engine2>0);
assert.ok(Object.values(n.get().electrical.selectedSources).every(x=>x!=='APU'));
for(const id of ['fuel.main1FwdPump','fuel.main1AftPump','fuel.main2FwdPump','fuel.main2AftPump'])
 assert.equal(pumps()[id].switchOn,false);
n.core.setSuctionFeedFault('engine2',true);
assert.equal(n.get().engines.engine2.fuelPath.available,false);
n.advance(1000);
assert.equal(n.get().engines.engine2.phase,'FUEL_STARVATION');
assert.equal(n.get().engines.engine1.phase,'RUNNING',
 'Independent engine 1 suction feed must remain intact');

// Suction path is not the center tank, is not available without tank fuel, and
// is never reported as certifiably reliable at arbitrary high altitude.
const f=new Fuel.FuelNetwork({initialFuelKg:{main1:100,main2:100,center:250}});
const offPumps={};
const val={fuelStartLever:'IDLE',engineDrivenPumpRotating:true,pressureAltitudeFt:0};
assert.equal(f.supply('engine1',offPumps,val).reason,'OWN_MAIN_ENGINE_DRIVEN_SUCTION');
assert.equal(f.supply('engine1',offPumps,{...val,engineDrivenPumpRotating:false}).available!==true,true);
assert.equal(f.supply('engine1',offPumps,{...val,fireSwitchPulled:true}).available,false);
assert.equal(f.supply('engine2',offPumps,{...val,suctionPathFailed:true}).available!==true,true);
assert.equal(f.supply('engine2',offPumps,{...val,pressureAltitudeFt:25000}).available,null,
 'Suction degradation at altitude cannot be assumed to be impossible or safe');
f.setTank('main1',0);
assert.equal(f.supply('engine1',offPumps,val).available!==true,true,
 'Center tank has no suction bypass; no own-main fuel means no source');
assert.equal(f.get().suctionTraining,true);
console.log('PASS 737CL SUCTION FEED: without AC generators or boost pumps, battery/inverter right igniter and APU air start both engines from separate main tanks; fuel burn; suction fault independent; center bypass absent; high-altitude risk unresolved.');
