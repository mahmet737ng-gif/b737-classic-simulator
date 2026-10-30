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
test('100ms APU starter fuel use accumulates without rounding bias',()=>{
 const f=new FuelRuntime.FuelNetwork({initialFuelKg:{main1:100,main2:0,center:0}});
 const rate=FuelRuntime.approx.apuStartFuelKgHr,seconds=100;
 for(let i=0;i<seconds*10;i++)f.consume('apu',rate*.1/3600,'main1');
 const expected=rate*seconds/3600;
 assert.ok(Math.abs(f.burnedKg.apu-expected)<.002,'Expected physical-time approximate burn, not 0.001kg per-tick quantization bias');
 assert.ok(Math.abs((100-f.tanks.main1)-expected)<.002);
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
 assert.equal(bridge.bearingForEGT(0),-241.5);
 assert.equal(bridge.bearingForEGT(800),0.8);
 const model=require('../panel-mosaic-lab/cockpit/apu-egt-needle-model.js');
 assert.equal(bridge.bearingForEGT(0),model.needle.initialAngle,'Cold pointer must not jump at startup');
 assert.equal(bridge.bearingForEGT(-40),model.needle.initialAngle,'Negative ambient is clipped to cold end');
 assert.equal(bridge.bearingForEGT(1400),0.8,'Out-of-range temperatures clamp to photographed 8 mark');
 for(const [lo,hi] of [[0,20],[20,390],[390,620],[620,750],[750,800]])
  assert.ok(bridge.bearingForEGT(hi)>bridge.bearingForEGT(lo),'EGT rising '+lo+' -> '+hi+' must rotate clockwise');

 assert.ok(bridge.bearingForEGT(620)>bridge.bearingForEGT(390),'Increasing EGT must rotate CLOCKWISE');
 handlers['b737:unified-ecu-observation']({detail:{apu:{phase:'STARTING',egtC:620,rpmPct:60,generator:{ready:false,voltageV:0,frequencyHz:0}}}});
 assert.equal(angles.length,1);
 assert.ok(angles[0]>bridge.bearingForEGT(390),'620°C pointer must be clockwise beyond 390°C');
 const snap=bridge.snapshot();
 assert.equal(snap.egtC,620);assert.equal(snap.voltsV,0);
 handlers['b737:unified-ecu-observation']({detail:{apu:{phase:'READY',egtC:390,rpmPct:95.5,generator:{ready:true,voltageV:115,frequencyHz:400,currentEstimatedA:40}}}});
 assert.equal(angles.length,2);
 assert.ok(angles[1]<angles[0],'EGT cool-down must rotate counterclockwise');
 assert.equal(bridge.snapshot().sourceAmpsA,40);
 assert.equal(bridge.snapshot().frequencyHz,400);
});
test('Actual OH09 crossfeed detent is connected to FuelNetwork with battery-bus gating',()=>{
 const overhead=JSON.parse(fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/interactive-overhead/rotary-guards.json'),'utf8'));
 const raw=JSON.stringify(overhead);
 assert.ok(raw.includes('"id":"crossfeed"')||raw.includes('"id": "crossfeed"'));
 const src=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
 assert.match(src,/function observeCrossfeed\(detent\)/);
 assert.match(src,/ecu\.core\.fuel\.setCrossfeed\(detent\)/);
 assert.match(src,/e\.data\.rotaries\?\.crossfeed/);
 assert.match(src,/e\.data\.event\?\.id==='crossfeed'/);
 assert.match(src,/chain\.get\(\)\.electrical\.battery!==true/);
});
test('Photo 0..8 x100 EGT major graduations are monotone and match supplied reference',()=>{
 const text=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/apu-live-meter-unified-v1.js'),'utf8');
 const window={addEventListener(){}};
 vm.runInNewContext(text,{window});
 const api=window.B737APULiveMetersV1;
 const printed=[-241.5,-212.5,-183.8,-154.1,-121.1,-89.7,-59,-28.5,0.8];
 for(let number=0;number<=8;number++){
  assert.ok(Math.abs(api.bearingForEGT(number*100)-printed[number])<.00001,'Printed major '+number);
  assert.ok(Math.abs(api.bearingForEGT(number*100+50)-printed[Math.min(8,number+1)]/2-printed[number]/2)<.0001||number===8,
   'Interpolate minor ticks at '+number+'.5');
 }
 assert.equal(api.bearingForEGT(800),api.bearingForEGT(900),'Over-range EGT must stop on 8');
 assert.ok(api.bearingForEGT(50)>api.bearingForEGT(0));
 assert.ok(api.bearingForEGT(50)<api.bearingForEGT(100));
});
test('Shutdown EGT reaches 50°C within 40 seconds, then cools very slowly',()=>{
 const s=sim();s.battery(true);s.startAPU();s.advance(1400);
 const ready=s.get().apu.egtC;assert.ok(ready>380);
 s.chain.event({id:'apu-start',kind:'toggle',next:'OFF'});
 const stopped=s.get();
 assert.equal(stopped.apu.phase,'STOPPING');
 assert.ok(stopped.apu.egtC>=ready-1,'APU shutdown must not jump to 20°C');
 assert.equal(stopped.apu.generator.ready,false);
 s.advance(400); // STOPPING -> OFF; 0.4s of the 40s limit has elapsed
 assert.equal(s.get().apu.phase,'OFF');
 s.coolAPU(39600);
 const at40=s.get().apu.egtC;
 assert.ok(at40<=50&&at40>45,'Even a hot APU must reach 50°C within 40 seconds');
 const before=at40;
 s.coolAPU(120000);
 const slow=s.get().apu.egtC;
 assert.ok(slow<before&&slow>before-4,'Below 50°C the 2-minute drop should only be a few degrees');
 assert.equal(s.get().apu.generator.voltageV,0,'Shutdown remains electrically disconnected');
});
test('Analytic cooling is independent of clock step and crosses at 50°C without a jump',()=>{
 const B=ECU,initial=390;
 assert.equal(B.apuCoolingStep(20,10000),20);
 assert.equal(B.apuCoolingStep(50,0),50);
 assert.throws(()=>B.apuCoolingStep(390,-1));
 let a=initial;
 for(let i=0;i<240;i++)a=B.apuCoolingStep(a,1000);
 let b=initial;b=B.apuCoolingStep(b,120000);b=B.apuCoolingStep(b,120000);
 assert.ok(Math.abs(a-b)<.00001,'1000ms and 120000ms integration must agree');
 const afterFast=B.apuCoolingStep(51,10000);
 const afterSlow=B.apuCoolingStep(50,10000);
 assert.ok(afterFast<afterSlow&&afterFast<51,'Crossing 50°C during a tick must transition continuously to the slow tail');
 for(const hot of [390,620,800]){
  const crossingMs=B.CONFIG.apuCoolFastTauMs*Math.log((hot-20)/(50-20));
  assert.ok(crossingMs<=40000,'EGT '+hot+'°C must reach 50°C within 40 seconds');
  assert.ok(B.apuCoolingStep(hot,40000)<=50,'40 seconds from '+hot+'°C must be at or below 50°C');
 }
 const threeMin=B.apuCoolingStep(B.apuCoolingStep(390,120000),60000);
 assert.ok(threeMin>45&&threeMin<48,'Three-minute trace remains in the slow cooling tail');
});
test('APU EGT passive cooling bridge continues after all engines stop without heavy 10Hz ECU loop',()=>{
 const source=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
 assert.match(source,/ecu\.coolAPU\(slice\)/);
 assert.match(source,/if\(coolingElapsed<1000\)return/);
 assert.match(source,/ecu\.apuThermalEgtC/);
 assert.match(source,/lastPassiveCoolingAt=now/);
});
test('Existing APU AC amp blade is driven by source-gated ATA24 current',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/electrical-demand-live-unified-v1.js'),'utf8');
 assert.match(src,/source\.APU/);
 assert.match(src,/setAngle\('apuAcAmps'/);
 const html=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/index.html'),'utf8');
 assert.ok(html.includes('apu-live-meter-unified-v1.js'));
 assert.ok(html.includes('apu-egt-needle-unified.js'));
});
