'use strict';
const assert=require('node:assert/strict'),test=require('node:test');
const fs=require('node:fs'),path=require('node:path');
const Gateway=require('../engine/runtime/unified-live-gateway-v1.js');
const Router=require('../engine/integration/isn-unified-control-router-v1.js');
const Bridge=require('../engine/integration/isn-cockpit-bridge-v1.js');
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
const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/interactive-overhead/registry.json')));
const rotary=JSON.parse(fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/interactive-overhead/rotary-guards.json')));
function setup(){
 const ecu=new ECU.Testbench({Electrical,Loads,TrainerCore,WarningEngine,Pneumatics,Pack,
   EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,timingProfile:'REALTIME_TRAINING'});
 const bridge=new Bridge.Bridge(ecu.start.core.pack,{sourceOwner:'ISN03_START_SESSION'});
 const gateway=new Gateway.Gateway({bridge,ecu,physical:Router});
 const controls={toggles:Object.fromEntries(registry.controls.map(x=>[x.id,x.default])),
  guards:Object.fromEntries(rotary.guards.map(x=>[x.id,x.default])),
  rotaries:Object.fromEntries(rotary.rotaries.map(x=>[x.id,x.default])),
  context:{onGround:true,engine1Running:false,engine2Running:false,apuRunning:false,groundPowerAttached:false}};
 controls.guards['battery-master']={value:'off',guard:'open'};
 gateway.synchronize(controls);
 return {ecu,bridge,gateway,controls};
}
const event=(id,next,kind='toggle')=>({id,next,kind});
test('physical control detents are source-registry matched',()=>{
 const real=new Map([...registry.controls,...rotary.guards,...rotary.rotaries].map(x=>[x.id,x]));
 for(const [id,kind] of Object.entries(Gateway.KEYS)){
  assert.ok(real.has(id),'missing real mounted ID '+id);
  assert.deepEqual(Gateway.DETENTS[id]||['OFF','ON'],real.get(id).states,id);
  assert.ok(['guarded','toggle','rotary'].includes(kind));
 }
});
test('single same ECU Pack is required, never a second electrical state owner',()=>{
 const r=setup();assert.equal(r.gateway.get().singleElectricalOwner,true);
 assert.equal(r.bridge.session,r.ecu.start.core.pack);
 assert.equal(r.gateway.snapshot().electricalSource,'ELECTRICAL_V7_EXISTING_PACK');
 const wrong=new Bridge.Bridge(new Pack.Session({Electrical,Loads,TrainerCore,WarningEngine}),
  {sourceOwner:'ISN03_START_SESSION'});
 assert.throws(()=>new Gateway.Gateway({bridge:wrong,ecu:r.ecu,physical:Router}),/single shared/);
});
test('cold-dark physical BATTERY ON writes Electrical once, lamp comes from same V7 Pack',()=>{
 const r=setup(),before=r.ecu.start.core.pack.electricalState.rev;
 const s=r.gateway.dispatch(event('battery-master',{value:'on',guard:'open'},'guarded'));
 assert.equal(s.accepted,true);assert.equal(s.owner,'ISN_ECU_CHAIN');
 assert.equal(r.ecu.start.core.pack.electricalState.rev,before+1);
 const v=r.gateway.snapshot();assert.equal(v.electrical.bus.battery,true);
 assert.deepEqual(v.lamps.busOff1,v.electrical.lamps.busOff1);
 assert.equal(v.singleElectricalOwner,true);
});
test('duplicate physical BAT event does not send a second command; legitimate OFF does',()=>{
 const r=setup();r.gateway.dispatch(event('battery-master',{value:'on'},'guarded'));
 let prev=r.ecu.start.core.pack.electricalState.rev;
 const x=r.gateway.dispatch(event('battery-master',{value:'on'},'guarded'));
 assert.equal(x.duplicate,true);assert.equal(r.ecu.start.core.pack.electricalState.rev,prev);
 assert.equal(r.gateway.dispatch(event('battery-master',{value:'off'},'guarded')).accepted,true);
 assert.equal(r.ecu.start.core.pack.electricalState.rev,prev+1);
});
test('standby selector routes only through Bridge and does not fabricate system power',()=>{
 const r=setup(),prev=r.ecu.start.core.pack.electricalState.rev;
 const s=r.gateway.dispatch(event('standby-power',{value:'bat',guard:'open'},'guarded'));
 assert.equal(s.accepted,true);assert.equal(s.owner,'ISN_PACK_BRIDGE');
 assert.equal(r.ecu.start.core.pack.electricalState.rev,prev+1);
 assert.equal(r.gateway.snapshot().electrical.feed.standbyFeed,'BATTERY_SELECTOR');
 assert.equal(r.gateway.snapshot().loads.coverage.loadsKnownBus,0);
});
test('source selection impossible is rejected not declared successful',()=>{
 const r=setup();const before=r.gateway.snapshot();
 // Real registry defaults ground-power to ON; a fresh physical OFF->ON detent is required.
 assert.equal(r.gateway.dispatch(event('ground-power','OFF')).accepted,true);
 const s=r.gateway.dispatch(event('ground-power','ON'));
 assert.equal(s.accepted,false);assert.match(s.reason,/conditions not met/);
 assert.deepEqual(r.gateway.snapshot().electrical.source,before.electrical.source);
 assert.ok(r.gateway.get().latestFailure);
});
test('initial physical sync reports rejected legacy source commands, not a false clean result',()=>{
 const r=setup(),history=r.gateway.get().recentEvents;
 const first=history.find(e=>e.type==='SYNCHRONIZE');
 assert.equal(first.accepted,true,'other valid controls must still synchronize');
 assert.ok(Array.isArray(first.warnings));
 if(r.bridge.get().rejected.length)assert.ok(first.warnings.some(w=>w.reason==='BRIDGE_REJECTED_ON_SYNC'));
});
test('legacy Bridge error ring full cannot hide new rejected physical commands',()=>{
 const r=setup();
 for(let k=0;k<35;k++)r.bridge.instructor({type:'ELECTRICAL',
  action:{type:'SELECT_SOURCE',side:1,source:'EXT'}});
 assert.equal(r.bridge.get().rejected.length,30);
 assert.ok(r.bridge.get().rejectedTotal>=35);
 assert.equal(r.gateway.dispatch(event('ground-power','OFF')).accepted,true);
 const rejected=r.gateway.dispatch(event('ground-power','ON'));
 assert.equal(rejected.accepted,false);
 assert.match(rejected.reason,/conditions not met/);
});
test('physical APU START uses ECU once and spring release is not another START',()=>{
 const r=setup();r.gateway.dispatch(event('battery-master',{value:'on'},'guarded'));
 assert.equal(r.gateway.dispatch(event('apu-start','START')).accepted,true);
 assert.equal(r.ecu.get().apu.phase,'INLET_DOOR');
 const first=r.ecu.trace.filter(x=>x.type==='APU_START_REQUEST').length;
 r.gateway.dispatch(event('apu-start','START'));
 assert.equal(r.ecu.trace.filter(x=>x.type==='APU_START_REQUEST').length,first);
 assert.equal(r.gateway.dispatch(event('apu-start','ON')).accepted,true);
});
test('hold START snapshot does not dispatch pending duplicate start',()=>{
 const r=setup();r.gateway.dispatch(event('battery-master',{value:'on'},'guarded'));
 const snap={...r.controls,
  guards:{...r.controls.guards,'battery-master':{value:'on',guard:'open'}},
  toggles:{...r.controls.toggles,'apu-start':'START'}};
 r.gateway.synchronize(snap);
 assert.equal(r.ecu.get().apu.phase,'INLET_DOOR');
 const n=r.ecu.trace.filter(x=>x.type==='APU_START_REQUEST').length;
 assert.equal(r.gateway.dispatch(event('apu-start','START')).duplicate,true);
 assert.equal(r.ecu.trace.filter(x=>x.type==='APU_START_REQUEST').length,n);
});
test('wrong kind and impossible detent cannot mutate physical owner',()=>{
 const r=setup(),before=r.gateway.snapshot().electrical;
 assert.equal(r.gateway.dispatch(event('battery-master','ON','toggle')).reason,'WRONG_EVENT_KIND');
 assert.equal(r.gateway.dispatch(event('battery-master',{value:'banana'},'guarded')).reason,'INVALID_DETENT');
 assert.equal(r.gateway.dispatch(event('fake-lamp','ON')).reason,'CONTROL_NOT_MAPPED');
 assert.deepEqual(r.gateway.snapshot().electrical,before);
});
test('frontend receives detached snapshot and cannot mutate ECU from it',()=>{
 const r=setup(),s=r.gateway.snapshot();
 s.electrical.bus.generator1=false;s.lamps.busOff1=false;s.engines.engine1.phase='RUNNING';
 assert.notEqual(r.gateway.snapshot().engines.engine1.phase,'RUNNING');
 assert.equal(r.gateway.snapshot().electrical.bus.generator1,false);
});
test('all mapped commands remain same physical ID, without modifying locked art files',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
 assert.match(code,/liveGateway\.synchronize\(e\.data\)/);
 assert.match(code,/liveGateway\.dispatch\(e\.data\.event\)/);
 assert.match(code,/getAircraftSnapshot:\(\)=>liveGateway\.snapshot\(\)/);
 assert.match(code,/physical\.dispatch\(ecu,event\)/);
});
