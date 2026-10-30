'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const FuelRuntime=require('../engine/integration/isn-09-12-runtime-v1');
const ECU=require('../engine/integration/isn-13-18-ecu-testbench-v1');
const Load=require('../engine/integration/isn-apu-load-dynamics-v1');
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
const sim=()=>new ECU.Testbench({Electrical,Loads,TrainerCore,WarningEngine,Pneumatics,Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,timingProfile:'CLASSROOM_COMPRESSED'});
test('APU suction feeds from main tank 1 with both AC pumps off',()=>{
 const f=new FuelRuntime.FuelNetwork({initialFuelKg:{main1:50,main2:40,center:20}});
 const s=f.apuSupply({});
 assert.equal(s.available,true);assert.equal(s.tank,'main1');
 assert.equal(s.reason,'MAIN1_SUCTION');assert.equal(s.pressurized,false);
});
test('APU main-1/center pressurized feed and crossfeed use actual existing pump state',()=>{
 const f=new FuelRuntime.FuelNetwork({initialFuelKg:{main1:50,main2:40,center:20}});
 const on=id=>({[id]:{operating:true}});
 let s=f.apuSupply(on('fuel.main1FwdPump'));
 assert.equal(s.tank,'main1');assert.equal(s.pressurized,true);
 s=f.apuSupply(on('fuel.centerLeftPump'));
 assert.equal(s.tank,'center');
 f.tanks.main1=0;f.tanks.center=0;
 s=f.apuSupply(on('fuel.main2AftPump'));
 assert.equal(s.available,false,'No crossfeed: right main tank cannot reach left manifold');
 f.setCrossfeed('OPEN');s=f.apuSupply(on('fuel.main2AftPump'));
 assert.equal(s.available,true);assert.equal(s.tank,'main2');
 f.tanks.main2=0;
 assert.equal(f.apuSupply({}).available,false);
});
test('No fuel path inhibits an APU start: no READY, generator or electrical feed',()=>{
 const s=sim();s.core.fuel.tanks.main1=0;s.core.fuel.tanks.main2=0;
 s.battery(true);s.startAPU();s.advance(200);
 const a=s.get();
 assert.equal(a.apu.phase,'FUEL_STARVATION');
 assert.equal(a.apu.generator.ready,false);
 assert.equal(a.apu.fuelPath.available,false);
 assert.notEqual(s.chain.get().sources.apu.running,true);
 s.advance(2500);
 assert.equal(s.get().apu.phase,'FUEL_STARVATION','Old timer must not restart the APU');
});
test('APU burns from the same live tank ledger during start and running',()=>{
 const s=sim();s.battery(true);s.startAPU();
 s.advance(700);
 const start=s.get();
 assert.equal(start.apu.phase,'STARTING');
 assert.ok(start.fuel.burnedKg.apu>0,'APU consumes fuel during starter operation');
 const before=start.fuel.tanksKg.main1;
 s.advance(700);const running=s.get();
 assert.equal(running.apu.phase,'READY');
 assert.ok(running.fuel.tanksKg.main1<before);
 assert.equal(running.apu.fuelPath.reason,'MAIN1_SUCTION');
 assert.ok(running.apu.generator.ready);
});
test('APU fuel loss trips selected APU GEN and BLEED, without affecting unrelated engines',()=>{
 const s=sim();s.battery(true);s.startAPU();s.advance(1400);
 s.selectGenerator('APU',1);s.apuBleed(true);
 assert.equal(s.get().electrical.selectedSources[1],'APU');
 s.core.fuel.tanks.main1=0;s.advance(100);
 const out=s.get();
 assert.equal(out.apu.phase,'FUEL_STARVATION');
 assert.equal(out.apu.generator.ready,false);
 assert.notEqual(out.electrical.selectedSources[1],'APU');
 assert.equal(out.apu.bleedValveOpen,false);
 assert.equal(out.apu.fuelPath.available,false);
});
test('Physical APU generator load drives existing RPM, EGT and shared tank fuel, not a second power owner',()=>{
 const s=sim();s.battery(true);s.startAPU();s.advance(1400);
 s.selectGenerator('APU',1);
 const base=s.get().apu.egtC;
 s.observeAPUSourceAmps(55);
 s.advance(19000);
 const a=s.get();
 assert.equal(a.apu.generator.currentEstimatedA,55);
 assert.ok(a.apu.load.loadDemandKva>15);
 assert.ok(a.apu.egtC>base+15);
 assert.ok(a.apu.fuelFlowEstimatedKgHr>FuelRuntime.approx.apuFuelKgHr);
 assert.ok(a.fuel.burnedKg.apu>0);
 s.observeAPUSourceAmps(0);
 s.advance(25000);
 assert.ok(s.get().apu.egtC<a.apu.egtC);
 assert.throws(()=>s.observeAPUSourceAmps(-1));
});
test('Live source load remains zero unless APU is selected and never double counts presets',()=>{
 assert.equal(Load.demand({selectedSources:{1:'GEN1'},physicalSourceAmpsA:30}).kva,0);
 const d=Load.demand({selectedSources:{1:'APU'},physicalSourceAmpsA:20,switches:{AVIONICS:true}});
 assert.ok(d.kva>=8&&d.kva<9);
 assert.ok(d.contributing.some(x=>x.id==='ATA24_LIVE_APU_SOURCE'));
});
test('Unified EGT pointer tracks ECU start/steady/loads with exact frozen sprite API',()=>{
 const file=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/apu-live-meter-unified-v1.js'),'utf8');
 const handlers={},angles=[],window={
  addEventListener:(id,fn)=>handlers[id]=fn,
  B737UnifiedApuEgtNeedle:{setAngle:angle=>angles.push(angle)}
 };
 vm.runInNewContext(file,{window,CustomEvent:class{}});
 const bridge=window.B737APULiveMetersV1;
 assert.equal(bridge.bearingForEGT(0),127);
 assert.equal(bridge.bearingForEGT(1000),-110);
 assert.ok(bridge.bearingForEGT(620)<bridge.bearingForEGT(390));
 handlers['b737:unified-ecu-observation']({detail:{apu:{phase:'STARTING',egtC:620,rpmPct:60,generator:{ready:false,voltageV:0,frequencyHz:0}}}});
 assert.equal(angles.length,1);
 assert.ok(angles[0]<0);
 const snap=bridge.snapshot();
 assert.equal(snap.egtC,620);assert.equal(snap.voltsV,0);
 handlers['b737:unified-ecu-observation']({detail:{apu:{phase:'READY',egtC:390,rpmPct:95.5,generator:{ready:true,voltageV:115,frequencyHz:400,currentEstimatedA:40}}}});
 assert.equal(angles.length,2);
 assert.equal(bridge.snapshot().sourceAmpsA,40);
 assert.equal(bridge.snapshot().frequencyHz,400);
});
test('Existing APU AC amp blade is driven by source-gated ATA24 current',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/electrical-demand-live-unified-v1.js'),'utf8');
 assert.match(src,/source\.APU/);
 assert.match(src,/setAngle\('apuAcAmps'/);
 const html=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/index.html'),'utf8');
 assert.ok(html.includes('apu-live-meter-unified-v1.js'));
 assert.ok(html.includes('apu-egt-needle-unified.js'));
});
