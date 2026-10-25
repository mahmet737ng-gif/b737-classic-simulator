'use strict';
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
const make=()=>{const start=new Start.Session({EngineAPU,ElectricalPack:Pack,Electrical,Loads,TrainerCore,WarningEngine,Pneumatics});
 return {start,chain:new Chain.Chain(start)};};
const overhead={toggles:{'apu-start':'ON','bleed-apu':'ON','bleed-eng-1':'ON','bleed-eng-2':'ON',
 'pack-l':'OFF','pack-r':'OFF','isolation-valve':'OPEN'},
 guards:{'battery-master':{value:'on'}},rotaries:{'ignition-source':'BOTH',
 'engine-start-1':'OFF','engine-start-2':'OFF'},context:{onGround:true,engine1Running:true,
 engine2Running:true,apuRunning:false,groundPowerAttached:false}};
let {start,chain}=make();
let result=chain.synchronize(overhead);
assert.equal(result.sources.apu.running,false);
assert.equal(result.sources.apu.origin,Chain.ORIGIN);
assert.equal(result.electrical.generator1,false,'ISN03 cold scenario supersedes legacy default running');
assert.equal(result.electrical.battery,true);
assert.equal(result.bleed.apuBleedValveOpen,false,'APU selected bleed not supplied until running');

// APU physical START switch is momentary. Instructor training timeline is synthetic.
chain.event({id:'apu-start',kind:'toggle',next:'START'});
assert.equal(chain.get().phase.apu,'INLET_DOOR');
chain.advance(399);
assert.equal(start.get().observation.apu.feedback.inletDoorOpen.value,null);
chain.advance(1);
assert.equal(start.get().observation.apu.feedback.inletDoorOpen.value,true);
assert.equal(chain.get().phase.apu,'STARTING');
chain.advance(1000);
result=chain.get();
assert.equal(result.phase.apu,'READY');
assert.equal(result.sources.apu.running,true);
assert.equal(result.sources.apu.origin,Chain.ORIGIN);
assert.equal(result.projected['apu-gen-off-bus'],true);
assert.equal(result.bleed.apuBleedValveOpen,true);
assert.equal(result.electrical.generator1,false,'APU READY does not auto-select APU GEN');

// Pneumatic GRD motoring does not require ignition AC GEN selection.
 // Spark eligibility remains separately source-gated at fuel lightoff.
chain.event({id:'engine-start-1',kind:'rotary',next:'GRD'});
assert.equal(chain.get().phase.engine1,'MOTORING');
assert.equal(chain.get().selectedSources[1],null);
assert.equal(chain.get().observations.engine1.rules.ignition.supplyEligible.left,false);
assert.equal(result.sources.engine1.running,false);
chain.event({id:'engine-start-1',kind:'rotary',next:'OFF'});
// Real Unified ISN02 bridge and ISN03 share EXACT same Pack session.
const bridge=new Bridge.Bridge(start.core.pack,{sourceOwner:'ISN03_START_SESSION'});
bridge.synchronize(overhead);
assert.equal(start.core.pack.electricalState.config.engine1Running,false,
  'Legacy overhead context must not bypass the central observed source');
bridge.handleEvent({id:'apu-gen-1',kind:'toggle',next:'ON'});
chain.syncPower();
result=chain.get();
assert.equal(result.selectedSources[1],'APU');
assert.equal(result.electrical.generator1,true);
assert.equal(result.projected['apu-gen-off-bus'],false);
assert.equal(bridge.get().state.electrical.bus.generator1,true);

chain.event({id:'engine-start-1',kind:'rotary',next:'GRD'});
assert.equal(chain.get().phase.engine1,'MOTORING');
assert.equal(chain.get().projected.mainStartValve1,true);
assert.equal(start.get().observation.engine1.running,false);
chain.advance(850);
assert.equal(chain.get().phase.engine1,'AWAIT_FUEL_LEVER_IDLE');
assert.equal(start.get().observation.engine1.rules.fuel.recommendMovingLeverToIdle,true);
chain.lever('engine1','IDLE');
assert.equal(chain.get().phase.engine1,'LIGHT_OFF_SEQUENCE');
chain.advance(1000);
result=chain.get();
assert.equal(result.phase.engine1,'RUNNING');
assert.equal(result.sources.engine1.running,true);
assert.equal(result.sources.engine1.origin,Chain.ORIGIN);
assert.equal(start.get().controls.engine1.startSwitch,'OFF');
assert.equal(result.projected.mainStartValve1,false);
assert.deepEqual(chain.consumeEffects(),[{type:'ROTARY_RELEASE',id:'engine-start-1',position:'OFF'}]);
chain.event({id:'engine-start-1',kind:'rotary',next:'GRD'});
assert.equal(chain.get().phase.engine1,'RUNNING','a running engine cannot be restarted in the training sequence');
assert.deepEqual(chain.consumeEffects(),[{type:'ROTARY_RELEASE',id:'engine-start-1',position:'OFF'}]);
assert.equal(start.core.pack.get().electrical.bus.generator1,true,
  'Selected APU generator remains valid after Engine 1 becomes available');

// A second engine can start from the same APU air/electric source.
chain.event({id:'engine-start-2',kind:'rotary',next:'GRD'});
assert.equal(chain.get().phase.engine2,'MOTORING');
chain.advance(850);chain.lever('engine2','IDLE');chain.advance(1000);
assert.equal(chain.get().sources.engine2.running,true);
assert.deepEqual(chain.consumeEffects(),[{type:'ROTARY_RELEASE',id:'engine-start-2',position:'OFF'}]);
chain.event({id:'apu-start',kind:'toggle',next:'OFF'});
assert.equal(chain.get().selectedSources[1],null,'APU OFF trips selected APU GEN');
chain.advance(400);
assert.equal(chain.get().sources.apu.running,false);
assert.equal(chain.get().sources.engine1.running,true,'Stopping APU does not extinguish independently running engines');
chain.lever('engine1','CUTOFF');
assert.equal(chain.get().phase.engine1,'OFF');
assert.equal(start.get().network.requests.engine1,'SHUTDOWN');

// Negative cases: battery unavailable, incomplete bleed path and packs left AUTO.
({start,chain}=make());
chain.synchronize({...overhead,guards:{'battery-master':{value:'off'}}});
chain.event({id:'apu-start',kind:'toggle',next:'START'});
assert.equal(chain.get().phase.apu,'BLOCKED');
chain.advance(5000);
assert.equal(chain.get().sources.apu.running,false);
({start,chain}=make());
chain.synchronize({...overhead,toggles:{...overhead.toggles,'pack-l':'AUTO'}});
chain.event({id:'apu-start',kind:'toggle',next:'START'});chain.advance(1400);
start.core.pack.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',source:'APU',side:1}});
chain.syncPower();chain.event({id:'engine-start-1',kind:'rotary',next:'GRD'});
assert.equal(chain.get().phase.engine1,'BLOCKED');
assert.match(chain.get().lastError,/PACK L\/R/);

const host=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
const child=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/overhead-bridge.js'),'utf8');
const rotary=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/interactive-overhead/rotary-guards.js'),'utf8');
for(const value of ['isn-apu-start-chain-v1.js','isn-start-sequence-v1.js','isn-starter-cutout','b737:engine-start-lever-command','getStartState']){
 assert.ok(host.includes(value),'Unified should load and expose '+value);
}
assert.ok(child.includes('isn-starter-cutout'));
assert.ok(rotary.includes('setDetent:'));
assert.equal(Chain.CONTROLS['apu-start'],'apu');
assert.equal(Chain.CONTROLS['engine-start-2'],'engine2');

// The battery power source must also abort an APU already in its training start.
({start,chain}=make());
chain.synchronize(overhead);
chain.event({id:'apu-start',kind:'toggle',next:'START'});
chain.event({id:'battery-master',kind:'guarded',next:{value:'off',guard:'open'}});
assert.equal(chain.get().phase.apu,'STOPPING');
chain.advance(250);
assert.equal(chain.get().sources.apu.running,false);
chain.advance(5000);
assert.equal(chain.get().sources.apu.running,false,'Pending APU-ready jobs must be cancelled after power loss');

// A motor in progress must not complete after loss of the APU bleed source.
({start,chain}=make());
chain.synchronize(overhead);chain.event({id:'apu-start',kind:'toggle',next:'START'});chain.advance(1400);
start.core.pack.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',source:'APU',side:1}});
chain.syncPower();chain.event({id:'engine-start-1',kind:'rotary',next:'GRD'});
chain.event({id:'bleed-apu',kind:'toggle',next:'OFF'});
chain.syncPower();
assert.equal(chain.get().phase.engine1,'OFF');
chain.advance(6000);
assert.equal(chain.get().sources.engine1.running,false);
console.log('PASS ISN03 Unified APU→GEN+BLEED→ENG1/2 trainer chain, separate training evidence, amber start valves, starter cutout, and negative gates.');
