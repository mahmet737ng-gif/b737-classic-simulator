'use strict';
// Unified physical-control -> shared ECU acceptance. No artwork replacement.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
const ui=read('panel-mosaic-lab/cockpit/isn-cockpit.js');
const index=read('panel-mosaic-lab/cockpit/index.html');
const lever=read('panel-mosaic-lab/cockpit/engine-start-levers.js');
const throttle=read('panel-mosaic-lab/cockpit/throttle-levers.js');
assert.match(ui,/new window\.B737ISN1318ECUTestbenchV1\.Testbench\(/);
assert.match(ui,/const startSession=ecu\.start,chain=ecu\.chain,session=startSession\.core\.pack/);
assert.match(ui,/timingProfile:'REALTIME_TRAINING'/);
assert.match(ui,/getECUState:\(\)=>ecu\.get\(\)/);
const router=read('engine/integration/isn-unified-control-router-v1.js');
assert.match(ui,/physical\.dispatch\(ecu,event\)/);
assert.match(router,/ecu\.startAPU\(\)/);
assert.match(router,/ecu\.engineStart\(ENGINE_START\[id\]\)/);
assert.match(ui,/ecu\.fuelLever\(e\.detail\.device,e\.detail\.position\)/);
assert.match(ui,/ecu\.setThrottle\('engine'\+id/);
assert.match(ui,/ecu\.advance\(elapsed\)/);
assert.match(ui,/ecu\.core\.refreshFuelDelivery\(\)/);
assert.match(ui,/starterDuctPsiTraining/);
for(const key of ['n1','n2','egt','fuel','oil'])assert.ok(ui.includes('data-field="'+key+'"'),key+' actual indication');
assert.match(ui,/b737:unified-ecu-observation/);
assert.match(ui,/b737:isn-start-indications/);
assert.match(lever,/b737:engine-start-lever-command/);
assert.match(throttle,/b737:throttle-position/);
for(const frozen of ['engine-start-levers.js?v=ISN-0003','throttle-levers.js?v=THR-0005','isn-engine-gauges.js?v=ISN-0007-CDARK'])
 assert.ok(index.includes(frozen),'Locked hardware renderer untouched '+frozen);

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
const CockpitBridge=require('../engine/integration/isn-cockpit-bridge-v1');
const ecu=new ECU.Testbench({Electrical,Loads,TrainerCore,WarningEngine,Pneumatics,
 Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,timingProfile:'REALTIME_TRAINING'});
const bridge=new CockpitBridge.Bridge(ecu.start.core.pack,{sourceOwner:'ISN03_START_SESSION'});
assert.equal(bridge.session,ecu.start.core.pack);
assert.equal(ecu.core.chain,ecu.chain);
const packet={toggles:{'bleed-apu':'ON','pack-l':'OFF','pack-r':'OFF','isolation-valve':'OPEN'},
 guards:{'battery-master':{value:'on'},'standby-power':{value:'bat'}},
 rotaries:{'ignition-source':'IGN R','engine-start-1':'OFF','engine-start-2':'OFF'},
 context:{onGround:true}};
bridge.synchronize(packet);
ecu.chain.synchronize(packet);
assert.equal(ecu.get().electrical.battery,true);
assert.equal(ecu.get().electrical.standbySelector,'BAT');
assert.equal(ecu.get().apu.phase,'OFF');
// Overhead APU START -> real-time ECU & the shared session.
ecu.startAPU();ecu.advance(85000);
assert.equal(ecu.get().apu.phase,'READY');
assert.equal(ecu.get().apu.generator.voltageV,115);
// Bleed valve is a real overhead control action and starter must have air.
ecu.chain.event({id:'bleed-apu',kind:'toggle',next:'ON'});
ecu.core.refreshFuelDelivery();
assert.equal(ecu.get().apu.bleedValveOpen,true);
ecu.engineStart('engine1');ecu.engineStart('engine2');
assert.equal(ecu.get().engines.engine1.phase,'MOTORING');
assert.equal(ecu.get().engines.engine2.phase,'MOTORING');
ecu.advance(28000);
assert.equal(ecu.get().engines.engine1.phase,'AWAIT_FUEL_LEVER_IDLE');
// Pedestal lever event calls ECU fuel command, with electric pumps OFF.
assert.equal(ecu.fuelLever('engine1','IDLE').accepted,true);
assert.equal(ecu.fuelLever('engine2','IDLE').accepted,true);
assert.equal(ecu.get().engines.engine1.fuelSupplyReason,'OWN_MAIN_ENGINE_DRIVEN_SUCTION');
ecu.advance(27750);
assert.ok(ecu.get().engines.engine1.egtC>=615);
ecu.advance(9250);
assert.equal(ecu.get().engines.engine1.phase,'RUNNING');
assert.equal(ecu.get().engines.engine2.phase,'RUNNING');
assert.equal(ecu.get().engines.engine1.startElapsedSec,65);
// Throttle sprite positions drive ECU running state.
ecu.setThrottle('engine1',1);
ecu.advance(25000);
const eng1=ecu.get().engines.engine1,eng2=ecu.get().engines.engine2;
assert.ok(eng1.fuelFlowKgHr>3800);
assert.ok(eng1.n1Percent>95);
assert.ok(eng2.fuelFlowKgHr<500,'Physical throttle engine 2 remains at idle');
assert.equal(ecu.get().apu.generator.frequencyHz,400);
// Fuel lever CUTOFF terminates the engine without altering engine 2.
ecu.fuelLever('engine1','CUTOFF');
ecu.advance(1000);
assert.equal(ecu.get().engines.engine1.phase,'OFF');
assert.equal(ecu.get().engines.engine2.phase,'RUNNING');
console.log('PASS Unified ECU physical wiring: shared source owner, battery/standby, APU 85s, real overhead bleed/start, pedestal fuel levers, both engines 65s suction start, physical throttle->N1/fuel, independent cutoff and unmodified approved artwork.');
