'use strict';
/* Deterministic end-to-end system test: actual Unified overhead IDs ->
 * shared electrical/pneumatic/start session -> indicated main-panel lamps.
 * The short APU/N2/EGT timeline is the explicitly tagged classroom surrogate.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Electrical=require('../engine/systems/electrical-v7');
const Loads=require('../engine/systems/electrical-loads-v8');
const TrainerCore=require('../engine/trainer/core');
const {WarningEngine}=require('../audio/warning-engine');
const Pneumatics=require('../engine/systems/pneumatics-v6');
const Pack=require('../engine/integration/isn-electrical-pack-v1');
const EngineAPU=require('../engine/integration/isn-engine-apu-v1');
const Start=require('../engine/integration/isn-start-sequence-v1');
const Chain=require('../engine/integration/isn-apu-start-chain-v1');
const Bridge=require('../engine/integration/isn-cockpit-bridge-v1');
const Indications=require('../engine/integration/isn-start-indications-v1');
const Lights=require('../panel-mosaic-lab/cockpit/lights-model');
const registry=JSON.parse(fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/lights.json')));
const dark={toggles:{'apu-start':'OFF','apu-gen-1':'OFF','apu-gen-2':'OFF',
 'gen-1':'OFF','gen-2':'OFF','bleed-apu':'OFF','bleed-eng-1':'OFF','bleed-eng-2':'OFF',
 'pack-l':'AUTO','pack-r':'AUTO','isolation-valve':'AUTO'},
 guards:{'battery-master':{value:'off'}},rotaries:{'ignition-source':'BOTH',
 'engine-start-1':'OFF','engine-start-2':'OFF'},
 context:{onGround:true,engine1Running:false,engine2Running:false,apuRunning:false,groundPowerAttached:false}};
function rig(){const start=new Start.Session({EngineAPU,ElectricalPack:Pack,Electrical,Loads,TrainerCore,WarningEngine,Pneumatics});
 const chain=new Chain.Chain(start),bridge=new Bridge.Bridge(start.core.pack,{sourceOwner:'ISN03_START_SESSION'});
 bridge.synchronize(dark);chain.synchronize(dark);
 const lights=Lights.controller(registry);
 function view(){const s=chain.get(),v=Indications.project(s);lights.setOverheadPower(s.electrical.battery===true);
  const patch={};for(const n of [1,2]){
   patch['startValve'+n+'Open']=s.observations['engine'+n].feedback.startValveOpen.value===true;
   patch['starter'+n+'Air']=s.observations['engine'+n].feedback.startAirAvailable.value===true;
  }lights.update(patch);return {s,v,lamps:lights.evaluate().frames,overhead:bridge.get().lamps};}
 function event(id,next,kind='toggle'){const payload={id,kind,next};bridge.handleEvent(payload);chain.event(payload);chain.syncPower();return view();}
 return {start,chain,bridge,lights,view,event};
}
const c=rig();let {s,v,lamps}=c.view();
assert.equal(s.phase.apu,'OFF');assert.equal(s.electrical.battery,false);
assert.equal(v.engines.engine1.n2.value,null);assert.equal(v.engines.engine2.egt.value,null);
assert.equal(lamps['main-start-valve-1'],'OFF');assert.equal(lamps['main-start-valve-2'],'OFF');

// Negative gate 1: battery and APU source cannot be bypassed.
c.event('apu-start','START');assert.equal(c.view().s.phase.apu,'BLOCKED');
c.chain.advance(5000);assert.equal(c.view().s.sources.apu.running,false);
c.event('apu-start','OFF');
({s}=c.event('battery-master',{value:'on',guard:'open'},'guarded'));
assert.equal(s.electrical.battery,true);
c.event('apu-start','START');c.chain.advance(1400);({s,v}=c.view());
assert.equal(s.phase.apu,'READY');assert.equal(s.sources.apu.running,true);
assert.equal(s.projected['apu-gen-off-bus'],true);
({s}=c.event('engine-start-2','GRD','rotary'));
assert.equal(s.phase.engine2,'BLOCKED');assert.match(s.lastError,/APU BLEED OFF/);
assert.equal(c.view().lamps['main-start-valve-2'],'OFF');
c.event('engine-start-2','OFF','rotary');

// APU GEN is selected via the actual overhead bridge, not auto-connected.
c.event('apu-gen-1','ON');({s,v}=c.view());
assert.equal(s.selectedSources[1],'APU');assert.equal(s.electrical.transfer1,true);
assert.equal(s.projected['apu-gen-off-bus'],false);
c.event('bleed-apu','ON');assert.equal(c.view().s.bleed.apuBleedValveOpen,true);

// Negative gate 2: PACK left in AUTO; negative gate 3: isolation CLOSED.
({s}=c.event('engine-start-2','GRD','rotary'));
assert.equal(s.phase.engine2,'BLOCKED');assert.match(s.lastError,/PACK L\/R/);
c.event('engine-start-2','OFF','rotary');
c.event('pack-l','OFF');c.event('pack-r','OFF');c.event('isolation-valve','CLOSE');
({s}=c.event('engine-start-2','GRD','rotary'));
assert.equal(s.phase.engine2,'BLOCKED');assert.match(s.lastError,/ISOLATION VALVE CLOSED/);
c.event('engine-start-2','OFF','rotary');c.event('isolation-valve','OPEN');

// Engine 2: GRD -> observed open start valve -> 25 N2 -> IDLE -> 46 N2.
({s,v,lamps}=c.event('engine-start-2','GRD','rotary'));
assert.equal(s.phase.engine2,'MOTORING');assert.equal(v.engines.engine2.n2.text,'0 %');
assert.equal(v.engines.engine2.startValve.text,'OPEN');
assert.equal(lamps['main-start-valve-2'],'ON');assert.equal(lamps['main-start-valve-1'],'OFF');
assert.equal(v.engines.engine2.egt.text,'—');
c.chain.lever('engine2','IDLE');assert.equal(c.view().v.engines.engine2.lever,'IDLE','premature IDLE is mechanical lever motion, not an N2 interlock');
c.chain.advance(425);({s,v}=c.view());
assert.equal(s.phase.engine2,'MOTORING');assert.equal(v.engines.engine2.n2.value,12.5);
assert.equal(lamps['main-start-valve-1'],'OFF');
c.chain.advance(425);({s,v}=c.view());assert.equal(v.engines.engine2.n2.text,'25 %');
c.chain.lever('engine2','IDLE');({s,v}=c.view());
assert.equal(s.phase.engine2,'LIGHT_OFF_SEQUENCE');assert.equal(v.engines.engine2.egt.text,'0 °C');
assert.equal(v.engines.engine2.fuelFlow.text,'400 kg/h');
c.chain.advance(500);({s,v}=c.view());
assert.ok(v.engines.engine2.n2.value>25&&v.engines.engine2.n2.value<46);
assert.ok(v.engines.engine2.egt.value>0&&v.engines.engine2.egt.value<420);
c.chain.advance(500);({s,v,lamps}=c.view());
assert.equal(s.phase.engine2,'RUNNING');assert.equal(v.engines.engine2.n2.text,'46 %');
assert.equal(v.engines.engine2.egt.text,'420 °C');
assert.equal(v.engines.engine2.startValve.text,'CLOSED');assert.equal(lamps['main-start-valve-2'],'OFF');
assert.deepEqual(c.chain.consumeEffects(),[{type:'ROTARY_RELEASE',id:'engine-start-2',position:'OFF'}]);

// Engine 1 is independent and uses the same APU power/air selection.
({s,v,lamps}=c.event('engine-start-1','GRD','rotary'));
assert.equal(s.phase.engine1,'MOTORING');assert.equal(lamps['main-start-valve-1'],'ON');
assert.equal(s.sources.engine2.running,true);
c.chain.advance(850);c.chain.lever('engine1','IDLE');c.chain.advance(1000);
({s,v,lamps}=c.view());assert.equal(s.phase.engine1,'RUNNING');
assert.equal(s.sources.engine1.running,true);assert.equal(s.sources.engine2.running,true);
assert.equal(v.engines.engine1.n2.text,'46 %');
assert.ok(v.engines.engine2.n2.value>46&&v.engines.engine2.n2.value<60,
 'Engine 2 now accelerates smoothly toward stable ground idle while Engine 1 starts');
assert.equal(lamps['main-start-valve-1'],'OFF');assert.equal(lamps['main-start-valve-2'],'OFF');
assert.deepEqual(c.chain.consumeEffects(),[{type:'ROTARY_RELEASE',id:'engine-start-1',position:'OFF'}]);

// Handover to engine generators keeps the buses powered after APU shutdown.
c.event('gen-1','ON');c.event('gen-2','ON');({s}=c.view());
assert.equal(s.selectedSources[1],'GEN1');assert.equal(s.selectedSources[2],'GEN2');
c.event('apu-start','OFF');c.chain.advance(400);({s}=c.view());
assert.equal(s.sources.apu.running,false);assert.equal(s.sources.engine1.running,true);
assert.equal(s.sources.engine2.running,true);assert.equal(s.electrical.generator1,true);
assert.equal(s.electrical.generator2,true);assert.equal(s.bleed.apuBleedValveOpen,false);

// Failures during motoring abort, clear start valve, and never complete later.
const f=rig();f.event('battery-master',{value:'on',guard:'open'},'guarded');
f.event('apu-start','START');f.chain.advance(1400);f.event('apu-gen-1','ON');
f.event('bleed-apu','ON');f.event('pack-l','OFF');f.event('pack-r','OFF');
f.event('isolation-valve','OPEN');f.event('engine-start-1','GRD','rotary');
assert.equal(f.view().lamps['main-start-valve-1'],'ON');
f.event('bleed-apu','OFF');assert.equal(f.view().s.phase.engine1,'OFF');
assert.equal(f.view().lamps['main-start-valve-1'],'OFF');
assert.equal(f.view().v.engines.engine1.n2.value,null,'aborted training reading is not left frozen on the gauge');
f.chain.advance(6000);assert.equal(f.view().s.sources.engine1.running,false);

const g=rig();g.event('battery-master',{value:'on',guard:'open'},'guarded');
g.event('apu-start','START');g.chain.advance(1400);g.event('apu-gen-1','ON');
g.event('bleed-apu','ON');g.event('pack-l','OFF');g.event('pack-r','OFF');
g.event('isolation-valve','OPEN');g.event('engine-start-1','GRD','rotary');
g.event('battery-master',{value:'off',guard:'open'},'guarded');
assert.equal(g.view().s.phase.engine1,'OFF');assert.equal(g.view().lamps['main-start-valve-1'],'OFF');
g.chain.advance(6000);assert.equal(g.view().s.sources.engine1.running,false);

console.log('PASS ISN-03 Stage 4 E2E: cold/dark -> APU GEN/BLEED -> both engines -> engine GEN handover; no-source, PACK, isolation, early lever, bleed-loss and power-loss gates; lamps and indications.');
