'use strict';
// Owner-selected APU OIL PSI annunciator training calibration.
// This threshold is not an airframe-certified GTCP-49 or APS 2000 value.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
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
function rig(){return new ECU.Testbench({Electrical,Loads,TrainerCore,WarningEngine,
 Pneumatics,Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,timingProfile:'CLASSROOM_COMPRESSED'});}
test('4 PSI exactly clears APU LOW OIL PRESSURE during start or RUN',()=>{
 assert.equal(ECU.CONFIG.apuOilLampOutPsi,4);
 for(const phase of ['INLET_DOOR','STARTING','READY']){
  assert.equal(ECU.apuLowOilPressureLamp(phase,0),true);
  assert.equal(ECU.apuLowOilPressureLamp(phase,3.99),true);
  assert.equal(ECU.apuLowOilPressureLamp(phase,4),false);
  assert.equal(ECU.apuLowOilPressureLamp(phase,55),false);
 }
 for(const phase of ['OFF','BLOCKED','STOPPING','FUEL_STARVATION'])
  assert.equal(ECU.apuLowOilPressureLamp(phase,0),false,'APU switch/off control disarms '+phase);
 assert.throws(()=>ECU.apuLowOilPressureLamp('STARTING',NaN));
});
test('APU oil pressure is a separate continuous ramp and drops after shutdown',()=>{
 assert.equal(ECU.apuOilPressureStep(0,'INLET_DOOR',0,1000),0);
 const x=ECU.apuOilPressureStep(0,'STARTING',0.30,500);
 assert.ok(x>0 && x<ECU.CONFIG.apuOilNominalPsi);
 assert.ok(ECU.apuOilPressureStep(x,'READY',1,1000)>x);
 assert.ok(ECU.apuOilPressureStep(x,'OFF',0,500)<x);
 assert.equal(ECU.apuOilTargetPsi('OFF',1),0);
});
test('real shared ECU exposes its own oil PSI to the Unified APU lamp',()=>{
 const s=rig();
 assert.equal(s.get().apu.oil.pressurePsi,0);
 assert.equal(s.get().apu.oil.lowPressureLamp,false);
 s.battery(true);s.startAPU();
 assert.equal(s.get().apu.phase,'INLET_DOOR');
 assert.equal(s.get().apu.oil.lowPressureLamp,true);
 s.advance(400);
 assert.equal(s.get().apu.phase,'STARTING');
 const during=s.get().apu.oil.pressurePsi;
 s.advance(1000);
 const ready=s.get().apu;
 assert.equal(ready.phase,'READY');
 assert.ok(ready.oil.pressurePsi>=4, 'Oil pump builds enough pressure to clear lamp');
 assert.equal(ready.oil.lowPressureLamp,false);
 assert.ok(ready.oil.pressurePsi>during,'Oil PSI must rise while APU spools');
 s.chain.event({id:'apu-start',kind:'toggle',next:'OFF'});
 assert.equal(s.get().apu.oil.lowPressureLamp,false);
 s.advance(400);
 assert.equal(s.get().apu.phase,'OFF');
 const before=s.get().apu.oil.pressurePsi;
 s.coolAPU(12000);
 assert.ok(s.get().apu.oil.pressurePsi<before,'Residual pump PSI must decay');
 assert.equal(s.get().apu.oil.lowPressureLamp,false);
});
test('Live Unified routes actual APU oil state, not legacy STARTING time',()=>{
 const src=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
 assert.ok(src.includes("lamps['apu-low-pressure']=ecu.get().apu.oil.lowPressureLamp;"));
 const html=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/index.html'),'utf8');
 assert.ok(html.includes('isn-cockpit.js?v=APU-OIL4-0001'));
});
