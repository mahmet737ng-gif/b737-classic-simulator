'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Electrical = require('../engine/systems/electrical-v7');
const Loads = require('../engine/systems/electrical-loads-v8');
const TrainerCore = require('../engine/trainer/core');
const {WarningEngine} = require('../audio/warning-engine');
const Pneumatics = require('../engine/systems/pneumatics-v6');
const ElectricalPack = require('../engine/integration/isn-electrical-pack-v1');
const EngineAPU = require('../engine/integration/isn-engine-apu-v1');
const Start = require('../engine/integration/isn-start-sequence-v1');
const registry = require('../engine/integration/isn-start-sequence-contracts-v1.json');
const make = () => new Start.Session({EngineAPU, ElectricalPack, Electrical, Loads, TrainerCore, WarningEngine, Pneumatics});
const observe = (device, running) => ({type:'SOURCE_OBSERVATION',device,running,
  origin:'INSTRUCTOR_OBSERVATION',instructor:true});
const feedback = (device,key,value) => ({type:'FEEDBACK',device,key,value,
  origin:'INSTRUCTOR_OBSERVATION',instructor:true});
const electrical = action => ({type:'ELECTRICAL',action});
const pneumatic = action => ({type:'PNEUMATIC',action});

assert.equal(registry.schema, 'b737-isn-start-sequence-contracts/1');
assert.ok(registry.blockedAutomation.some(x => x.from === 'engine.n2Percent'));
assert.ok(registry.blockedAutomation.some(x => x.from === 'apu.rpmPercent'));
assert.ok(registry.confirmedExecutableEdges.some(x=>x.to==='engine.advisory.egt725Latched'));
assert.ok(registry.blockedAutomation.some(x => x.to === 'warning.hungStart'));
const s = make();
let o = s.get();
assert.equal(o.observation.engine1.phase, 'UNKNOWN');
assert.equal(o.network.electrical, null);
assert.equal(o.observation.engine1.feedback.n2Percent.value, null);

o = s.send({type:'SOURCE_REQUEST',device:'engine1',request:'START'});
assert.equal(o.observation.engine1.phase, 'START_REQUESTED_RUNNING_NOT_PROVEN');
assert.equal(o.observation.engine1.running, null);
o = s.send(feedback('engine1','starterEngaged',true));
assert.equal(o.observation.engine1.phase, 'STARTER_ACTIVITY_OBSERVED_RUNNING_NOT_PROVEN');
o = s.send(feedback('engine1','ignitionEnergized',true));
o = s.send(feedback('engine1','fuelStartLever','IDLE'));
o = s.send(feedback('engine1','n2Percent',24.7));
o = s.send(feedback('engine1','egtC',755));
assert.equal(o.observation.engine1.running,null,'N2, EGT, ignition and starter are not auto-start confirmation');
assert.equal(o.network.electrical,null);
assert.equal(o.network.warnings,null);
assert.equal(o.observation.engine1.completionRule,'RUNNING_REQUIRES_INDEPENDENT_SOURCE_OBSERVATION');
assert.equal(o.observation.engine1.evidence.speed,'INSTRUCTOR_OBSERVATION');
assert.ok(o.recentEvents.at(-1).changes.some(x=>x.path==='engine1.feedback.egtC'));

o = s.send(observe('engine1',true));
assert.equal(o.observation.engine1.phase,'RUNNING_OBSERVED');
assert.equal(o.network.status,'WAITING_FOR_SOURCE_OBSERVATIONS');
o = s.send(observe('engine2',false));
o = s.send(observe('apu',false));
assert.equal(o.network.status,'SOURCE_GATED_ACTIVE');
assert.equal(o.network.electrical.bus.generator1,true);
assert.equal(o.network.pneumatics.bleed.engine1ValveOpen,true);

o = s.send(electrical({type:'FAULT',id:'GEN1_FAILED',active:true,instructor:true}));
assert.equal(o.network.electrical.bus.generator1,false);
assert.equal(o.observation.engine1.phase,'RUNNING_OBSERVED', 'Generator failure is not an observed engine shutdown');
assert.equal(o.network.pneumatics.bleed.engine1ValveOpen,true);
assert.equal(o.network.warnings.audio.active.some(x=>x.id==='fireBell'),false,
  'Generator failure does not create a fire bell');

o = s.send({type:'SOURCE_REQUEST',device:'engine1',request:'SHUTDOWN'});
assert.equal(o.observation.engine1.phase,'SHUTDOWN_REQUESTED_AWAITING_OBSERVATION');
assert.equal(o.network.electrical.bus.generator1,false);
o = s.send(observe('engine1',false));
assert.equal(o.observation.engine1.phase,'STOPPED_OBSERVED_AFTER_REQUEST');
assert.equal(o.network.pneumatics.bleed.engine1ValveOpen,false);

o = s.send({type:'SOURCE_REQUEST',device:'apu',request:'START'});
o = s.send(feedback('apu','starterEngaged',true));
o = s.send(feedback('apu','rpmPercent',96));
o = s.send(feedback('apu','egtC',670));
assert.equal(o.observation.apu.running,false,'High APU RPM cannot promote readiness without validated rule');
assert.equal(o.network.electrical.source[1],null);
o = s.send(observe('apu',true));
assert.equal(o.observation.apu.phase,'RUNNING_OBSERVED');
assert.equal(o.network.electrical.source[1],null,'APU source must still be explicitly selected');
o = s.send(electrical({type:'SELECT_SOURCE',source:'APU',side:1}));
assert.equal(o.network.electrical.bus.generator1,true);
o = s.send(pneumatic({type:'CONTROL',key:'apuBleed',value:'ON'}));
assert.equal(o.network.pneumatics.bleed.apuBleedValveOpen,true);
assert.equal(o.network.pneumatics.duct.L.anySupply,null);
assert.equal(o.network.engineFuelFeed,null);

o = s.send(feedback('engine1','n2Percent',null));
assert.equal(o.observation.engine1.feedback.n2Percent.value,null);
assert.equal(o.observation.engine1.feedback.n2Percent.origin,null,'Withdrawing sample removes evidence');

for (const bad of [
  feedback('apu','n2Percent',23),
  feedback('engine1','rpmPercent',20),
  feedback('engine1','n2Percent',-1),
  feedback('engine1','egtC',Infinity),
  feedback('engine1','starterEngaged',1),
  feedback('engine1','fuelStartLever','START'),
  {type:'FEEDBACK',device:'engine1',key:'egtC',value:430,origin:'INSTRUCTOR_OBSERVATION'},
  {type:'FEEDBACK',device:'engine1',key:'egtC',value:430,origin:'FAKE_SENSOR'},
  electrical({type:'CONTROL',key:'engine1Running',value:true}),
  {type:'PACK',action:{type:'MODE',value:'TRAINING_SURROGATE',instructor:true}}
]) assert.throws(()=>s.send(bad),'Invalid feedback or bypass must be rejected');

const scenario = [
  {type:'SOURCE_REQUEST',device:'engine1',request:'START'},
  feedback('engine1','starterEngaged',true),
  feedback('engine1','n2Percent',22.1),
  feedback('engine1','egtC',460),
  observe('engine1',true),observe('engine2',false),observe('apu',false),
  {type:'SOURCE_REQUEST',device:'engine1',request:'SHUTDOWN'},
  observe('engine1',false)
];
assert.deepEqual(make().replay(scenario),make().replay(scenario),'Deterministic sequence replay');
assert.equal(make().replay(scenario).recentEvents.at(-1).command.type,'SOURCE_OBSERVATION');

const lab = fs.readFileSync(path.join(__dirname, '../isn-start-sequence-lab/index.html'),'utf8');
const script = fs.readFileSync(path.join(__dirname, '../isn-start-sequence-lab/app.js'),'utf8');
for(const dependency of ['electrical-v7.js','electrical-loads-v8.js','core.js','warning-engine.js',
  'isn-electrical-pack-v1.js','pneumatics-v6.js','isn-engine-apu-v1.js','isn-start-sequence-v1.js','app.js']) {
  assert.ok(lab.includes('src="')&&lab.includes(dependency),'Standalone lab must load '+dependency);
}
for(const id of ['sources','networkStatus','unresolved','outputs','trace','reset','cold']) {
  assert.ok(lab.includes('id="'+id+'"'),'Missing test control '+id);
}
assert.ok(script.includes('new Start.Session') && script.includes('INSTRUCTOR_OBSERVATION'));

console.log('PASS ISN-03 Stage 2: typed feedback, request/observation separation, replay and source-gated propagation.');
