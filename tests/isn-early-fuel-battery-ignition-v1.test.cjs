'use strict';
// B737 Classic ignition right: AC STANDBY, supported via battery + inverter
// in STANDBY BAT; NOT a bare 28V DC direct exciter assumption.
// Fuel lever commands at any N2; start recommendation remains informational.
const assert=require('node:assert/strict');
const E=require('../engine/integration/isn-13-18-ecu-testbench-v1');
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
const rig=()=>new E.Testbench({Electrical,Loads,TrainerCore,WarningEngine,
 Pneumatics,Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,timingProfile:'CLASSROOM_COMPRESSED'});
const prepare=s=>{s.battery(true);s.startAPU();s.advance(1400);
 s.selectGenerator('APU',1);s.apuBleed(true);s.prepareFuel();};

// Mechanical IDLE is allowed before GRD, N2=0. Fuel absent means no ignition/flow.
const off=rig();
let result=off.fuelLever('engine1','IDLE');
assert.equal(result.accepted,true);
assert.equal(off.get().engines.engine1.fuelLever,'IDLE');
assert.equal(off.get().engines.engine1.n2Percent,0);
assert.equal(off.get().engines.engine1.fuelFlowKgHr,0);
assert.equal(off.get().engines.engine1.phase,'OFF');
off.fuelLever('engine1','CUTOFF');
assert.equal(off.get().engines.engine1.fuelLever,'CUTOFF');

// Right ignition via AC standby static inverter, even with NO APU generator selected.
const battery=rig();
battery.battery(true);battery.startAPU();battery.advance(1400);
battery.setStandbyPower('BAT');battery.setIgnitionSelector('IGN_R');
battery.apuBleed(true);
assert.ok(Object.values(battery.get().electrical.selectedSources).every(x=>x!== 'APU'));
battery.engineStart('engine1');
assert.equal(battery.get().engines.engine1.phase,'MOTORING','No generator required for pneumatic starter');
battery.advance(850);
const first=battery.fuelLever('engine1','IDLE');
assert.equal(first.accepted,true,'Fuel lever opens at 25% even if pumps still unpowered');
assert.equal(first.fuelAvailable,true,'Classic own-main engine-driven suction works without AC boost pumps');
assert.equal(battery.get().engines.engine1.ignition.eligible.right,true,'BAT inverter energizes AC standby igniter');
assert.equal(battery.get().engines.engine1.ignition.eligible.left,false,'IGN_R does not select left igniter');
assert.ok(battery.get().engines.engine1.fuelFlowKgHr>0,'Suction gives lightoff fuel flow at N2=25');
assert.equal(battery.get().engines.engine1.phase,'LIGHT_OFF_SEQUENCE',
 'Battery inverter right ignition plus suction can start without AC generator');
assert.equal(battery.get().engines.engine1.fuelSupplyReason,'OWN_MAIN_ENGINE_DRIVEN_SUCTION');
assert.ok(Object.values(battery.get().electrical.selectedSources).every(x=>x!=='APU'));
battery.advance(1000);
assert.equal(battery.get().engines.engine1.phase,'RUNNING');

// Moderate early IDLE (<20% N2) is a hot-start risk, not a guaranteed hot-start.
const moderate=rig();prepare(moderate);moderate.engineStart('engine1');moderate.advance(550);
assert.ok(moderate.get().engines.engine1.n2Percent>10&&moderate.get().engines.engine1.n2Percent<20);
result=moderate.fuelLever('engine1','IDLE');
assert.equal(result.accepted,true);assert.equal(result.fuelAvailable,true);
assert.equal(moderate.get().engines.engine1.phase,'LIGHT_OFF_SEQUENCE');
moderate.advance(1900);
assert.equal(moderate.get().engines.engine1.phase,'RUNNING');
assert.equal(moderate.get().engines.engine1.fuelLever,'IDLE');

// Much earlier light-off can lead to EGT >=725C and an abnormal-start latch.
const veryEarly=rig();prepare(veryEarly);veryEarly.engineStart('engine2');veryEarly.advance(250);
const lowN2=veryEarly.get().engines.engine2.n2Percent;
assert.ok(lowN2>=5&&lowN2<10,'test near 5 percent N2, not 25');
result=veryEarly.fuelLever('engine2','IDLE');
assert.equal(result.accepted,true);
assert.equal(veryEarly.get().engines.engine2.phase,'LIGHT_OFF_SEQUENCE');
veryEarly.advance(1600);
assert.equal(veryEarly.get().engines.engine2.phase,'ABNORMAL_EGT');
assert.ok(veryEarly.get().engines.engine2.egtC>=725);
assert.notEqual(veryEarly.get().engines.engine2.phase,'RUNNING');
assert.ok(veryEarly.get().alerts.some(x=>x.id.includes('START_EGT_725')||x.id.includes('ABNORMAL_START_EGT')));
veryEarly.fuelLever('engine2','CUTOFF');
assert.equal(veryEarly.get().engines.engine2.fuelLever,'CUTOFF');
console.log('PASS EARLY IDLE + BAT ignition: mechanical lever at N2=0; right igniter AC STANDBY powered via battery inverter; no AC generator for motoring; boost pumps OFF but suction starts; under-20 N2 risk and severe early hot-start EGT cutoff.');
