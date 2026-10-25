'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const json=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const toggleRegistry=json('panel-mosaic-lab/interactive-overhead/registry.json');
const rotaryRegistry=json('panel-mosaic-lab/interactive-overhead/rotary-guards.json');
const ToggleModel=require('../panel-mosaic-lab/interactive-overhead/model.js');
const Router=require('../engine/integration/isn-unified-control-router-v1.js');
const CockpitBridge=require('../engine/integration/isn-cockpit-bridge-v1.js');
const ECU=require('../engine/integration/isn-13-18-ecu-testbench-v1.js');
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
function rig(){
 const ecu=new ECU.Testbench({Electrical,Loads,TrainerCore,WarningEngine,Pneumatics,Pack,
   EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,timingProfile:'REALTIME_TRAINING'});
 const bridge=new CockpitBridge.Bridge(ecu.start.core.pack,{sourceOwner:'ISN03_START_SESSION'});
 return {ecu,bridge};
}
function packet(toggles, guards={},rotaries={}){
 return {toggles,guards:{'battery-master':{value:'on'},'standby-power':{value:'bat'},...guards},
  rotaries:{'ignition-source':'IGN R','engine-start-1':'OFF','engine-start-2':'OFF',...rotaries},
  context:{onGround:true,apuRunning:false,engine1Running:false,engine2Running:false}};
}
const {ecu,bridge}=rig();
const toggles=ToggleModel.controller(toggleRegistry,{},event=>{
 const message={...event,kind:'toggle'};
 bridge.handleEvent(message);
 Router.dispatch(ecu,message);
});
const p=packet(toggles.snapshot());
bridge.synchronize(p);Router.synchronize(ecu,p);
const guard=(id,value)=>{const event={id,kind:'guarded',next:{value}};bridge.handleEvent(event);Router.dispatch(ecu,event);};
const rotary=(id,next)=>{const event={id,kind:'rotary',next};Router.dispatch(ecu,event);};
guard('battery-master','on');guard('standby-power','bat');
rotary('ignition-source','IGN R');
assert.equal(ecu.get().electrical.battery,true);
assert.equal(ecu.get().electrical.standbyAcPowered,true);
assert.equal(toggles.get('apu-start'),'ON');
toggles.set('apu-start','START','legend-tap');
assert.equal(ecu.get().apu.phase,'INLET_DOOR','Actual registry event starts APU from OFF');
toggles.release('apu-start');
assert.equal(ecu.get().apu.phase,'INLET_DOOR','Spring return ON must not stop APU');
ecu.advance(85000);
assert.equal(ecu.get().apu.phase,'READY');
// Toggle each physically mounted air-system switch using its real registry.
for(const [id,val] of [['pack-l','OFF'],['pack-r','OFF'],['isolation-valve','OPEN']]){
 assert.equal(toggles.set(id,val,'legend-tap'),true,id);
}
assert.equal(toggles.get('bleed-apu'),'ON','Locked overhead default APU BLEED is ON');
assert.equal(ecu.get().apu.bleedValveOpen,true);
rotary('engine-start-1','GRD');rotary('engine-start-2','GRD');
assert.equal(ecu.get().engines.engine1.phase,'MOTORING');
assert.equal(ecu.get().engines.engine2.phase,'MOTORING');
ecu.advance(28000);
assert.equal(ecu.fuelLever('engine1','IDLE').accepted,true);
assert.equal(ecu.fuelLever('engine2','IDLE').accepted,true);
assert.equal(ecu.get().engines.engine1.fuelSupplyReason,'OWN_MAIN_ENGINE_DRIVEN_SUCTION');
ecu.advance(37000);
assert.equal(ecu.get().engines.engine1.phase,'RUNNING');
assert.equal(ecu.get().engines.engine2.phase,'RUNNING');
ecu.setThrottle('engine1',1);ecu.advance(22000);
assert.ok(ecu.get().engines.engine1.fuelFlowKgHr>3750);
assert.ok(ecu.get().engines.engine2.fuelFlowKgHr<500);
// When the momentary START event is missed (loading/race), a snapshot of
// the actual held START switch must reissue it exactly once.
const other=rig(),switches=ToggleModel.controller(toggleRegistry,{},()=>{});
const ps=packet(switches.snapshot());other.bridge.synchronize(ps);
Router.synchronize(other.ecu,ps);
const batteryEvent={id:'battery-master',kind:'guarded',next:{value:'on'}};
other.bridge.handleEvent(batteryEvent);Router.dispatch(other.ecu,batteryEvent);
switches.set('apu-start','START','legend-tap');
const first=Router.synchronize(other.ecu,packet(switches.snapshot()));
assert.ok(first.recovered.includes('apu-start'));
assert.equal(other.ecu.get().apu.phase,'INLET_DOOR');
const second=Router.synchronize(other.ecu,packet(switches.snapshot()));
assert.deepEqual(second.recovered,[],'Do not restart APU on repeated snapshot');
console.log('PASS UNIFIED PHYSICAL REGISTRY E2E: actual spring-loaded APU START click, battery/standby, overhead bleed and packs, dual GRD, two physical levers suction feed, 65s start, throttle and lost-event recovery.');
