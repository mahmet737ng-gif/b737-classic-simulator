'use strict';
const assert = require('node:assert/strict');
const Electrical = require('../engine/systems/electrical-v7');
const Loads = require('../engine/systems/electrical-loads-v8');
const TrainerCore = require('../engine/trainer/core');
const {WarningEngine} = require('../audio/warning-engine');
const Pneumatics = require('../engine/systems/pneumatics-v6');
const ElectricalPack = require('../engine/integration/isn-electrical-pack-v1');
const EngineAPU = require('../engine/integration/isn-engine-apu-v1');
const contracts = require('../engine/integration/isn-engine-apu-contracts-v1.json');
const make = () => new EngineAPU.Session({ElectricalPack, Electrical, Loads, TrainerCore, WarningEngine, Pneumatics});
const observed = (device, running) => ({type: 'SOURCE_OBSERVATION', device, running,
  origin: 'INSTRUCTOR_OBSERVATION', instructor: true});
const power = action => ({type:'ELECTRICAL', action});
const pneumatic = action => ({type:'PNEUMATIC', action});
const pack = action => ({type:'PACK', action});
const initialKnown = [observed('engine1', false), observed('engine2', false), observed('apu', false)];
assert.equal(contracts.schema, 'b737-isn-engine-apu-contracts/1');
assert.equal(contracts.sourceOwnership.startRequestsAreObservations, false);
assert.equal(contracts.edges.filter(edge => edge.to.startsWith('electrical.config.')).length, 3);
assert.equal(contracts.edges.filter(edge => edge.to.startsWith('pneumatics.inputs.')).length, 3);
assert.ok(contracts.blockedEdges.some(edge => edge.from === 'source.START_REQUEST'));
assert.ok(contracts.blockedEdges.some(edge => edge.to.includes('individualFeeder')));

const s = make();
let o = s.get();
assert.equal(o.status, 'WAITING_FOR_SOURCE_OBSERVATIONS');
assert.deepEqual(o.unresolved, ['engine1','engine2','apu']);
for (const id of ['electrical','pneumatics','fuelAndHydraulicPumps','warnings','engineFuelFeed'])
  assert.equal(o[id], null, `No inferred aircraft outputs while ${id} status unresolved`);

o = s.send({type:'SOURCE_REQUEST', device:'engine1', request:'START'});
assert.equal(o.source.engine1.running, null, 'Starter request is not successful ignition evidence');
assert.equal(o.electrical, null);
o = s.send(observed('engine1', false));
assert.equal(o.status, 'WAITING_FOR_SOURCE_OBSERVATIONS');
o = s.send(observed('engine2', false));
assert.equal(o.status, 'WAITING_FOR_SOURCE_OBSERVATIONS');
o = s.send(observed('apu', false));
assert.equal(o.status, 'SOURCE_GATED_ACTIVE');
assert.equal(o.electrical.bus.generator1, false);
assert.equal(o.electrical.bus.generator2, false);
assert.equal(o.pneumatics.bleed.engine1ValveOpen, false);
assert.equal(o.pneumatics.bleed.engine2ValveOpen, false);
assert.equal(o.pneumatics.bleed.apuBleedValveOpen, false);
assert.equal(o.warnings.audio.active.some(x => x.id === 'fireBell'), false);

o = s.send(observed('engine1', true));
assert.equal(o.electrical.bus.generator1, true, 'GEN1 readiness follows independently observed engine1 state');
assert.equal(o.electrical.bus.generator2, false);
assert.equal(o.pneumatics.bleed.engine1ValveOpen, true);
assert.equal(o.pneumatics.bleed.engine2ValveOpen, false);
assert.ok(o.recentEvents.at(-1).changes.some(x => x.path === 'electrical.bus.generator1'));
assert.ok(o.recentEvents.at(-1).changes.some(x => x.path === 'pneumatics.bleed.engine1ValveOpen'));

o = s.send(pack({type:'PUMP_SWITCH', id:'fuel.main1FwdPump', value:true}));
assert.equal(o.fuelAndHydraulicPumps['fuel.main1FwdPump'].operating, null,
  'GEN1 does not prove physical pump feeder');
assert.equal(o.fuelAndHydraulicPumps['fuel.main1FwdPump'].sourceBus, null);
assert.equal(o.engineFuelFeed, null, 'No engine fuel availability inferred from electric pump');

o = s.send(power({type:'FAULT', id:'GEN1_FAILED', active:true, instructor:true}));
assert.equal(o.electrical.bus.generator1, false, 'Generator fault independently removes electrical source');
assert.equal(o.pneumatics.bleed.engine1ValveOpen, true,
  'Electrical generator fault does not imply a pneumatic bleed valve failure');
assert.equal(o.source.engine1.running, true);
o = s.send(power({type:'FAULT', id:'GEN1_FAILED', active:false, instructor:true}));
assert.equal(o.electrical.bus.generator1, true);

o = s.send(observed('engine1', false));
assert.equal(o.electrical.bus.generator1, false);
assert.equal(o.pneumatics.bleed.engine1ValveOpen, false);
assert.equal(o.warnings.audio.active.some(x => x.id === 'fireBell'), false,
  'Engine stopping must not synthesize a fire alarm');

o = s.send(observed('apu', true));
assert.equal(o.electrical.bus.generator1, false,
  'APU running does not automatically select the APU generator');
o = s.send(power({type:'SELECT_SOURCE', source:'APU', side:1}));
assert.equal(o.electrical.source[1], 'APU');
assert.equal(o.electrical.bus.generator1, true);
assert.equal(o.pneumatics.bleed.apuBleedValveOpen, false, 'APU running does not automatically turn BLEED switch ON');
o = s.send(pneumatic({type:'CONTROL', key:'apuBleed', value:'ON'}));
assert.equal(o.pneumatics.bleed.apuBleedValveOpen, true);
assert.equal(o.pneumatics.duct.L.anySupply, null, 'APU duct assignment remains UNKNOWN');
assert.equal(o.pneumatics.duct.R.anySupply, null);

o = s.send(pack({type:'WARNING_SENSOR', key:'apuFire', value:true}));
assert.equal(o.warnings.audio.active.some(x => x.id === 'fireBell'), true);
o = s.send(pack({type:'WARNING_SENSOR', key:'apuFire', value:false}));
assert.equal(o.warnings.audio.active.some(x => x.id === 'fireBell'), false);

o = s.send(power({type:'CONTROL', key:'onGround', value:false}));
assert.equal(s.pneumaticState.inputs.onGround, false);
assert.equal(s.pack.electricalState.config.onGround, false);

o = s.send(observed('engine2', null));
assert.equal(o.status, 'WAITING_FOR_SOURCE_OBSERVATIONS');
assert.equal(o.electrical, null, 'Withdrawing sensor truth must withhold stale derived outputs');
assert.equal(o.pneumatics, null);
o = s.send(observed('engine2', true));
assert.equal(o.status, 'SOURCE_GATED_ACTIVE');
assert.equal(o.electrical.bus.generator2, true);
assert.equal(o.pneumatics.bleed.engine2ValveOpen, true);

const forbidden = [
  {type:'SOURCE_OBSERVATION', device:'apu', running:true},
  {type:'SOURCE_OBSERVATION', device:'engine3', running:true, origin:'EXTERNAL_SENSOR_OBSERVATION'},
  {type:'SOURCE_OBSERVATION', device:'engine1', running:1, origin:'EXTERNAL_SENSOR_OBSERVATION'},
  {type:'SOURCE_REQUEST', device:'apu', request:'IGNITION_CONFIRMED'},
  power({type:'CONTROL', key:'engine1Running', value:true}),
  power({type:'RESET'}),
  pneumatic({type:'SENSOR', key:'apuRunning', value:true}),
  pneumatic({type:'SENSOR', key:'onGround', value:true}),
  pack({type:'MODE', value:'TRAINING_SURROGATE', instructor:true}),
  pack({type:'ELECTRICAL', action:{type:'CONTROL', key:'engine1Running', value:true}})
];
for (const bad of forbidden) assert.throws(() => s.send(bad), 'Reject bypass or fabricated source state');

const scenario = [
  ...initialKnown,
  {type:'SOURCE_REQUEST', device:'apu', request:'START'},
  observed('apu', true),
  power({type:'SELECT_SOURCE', source:'APU', side:2}),
  pneumatic({type:'CONTROL', key:'apuBleed', value:'ON'}),
  pack({type:'PUMP_SWITCH', id:'hyd.electricPumpA', value:true}),
  pack({type:'WARNING_SENSOR', key:'engine1Fire', value:true}),
  observed('engine1', true)
];
assert.deepEqual(make().replay(scenario), make().replay(scenario), 'Deterministic replay of all coupled ports');

console.log('PASS: ISN-03 observed Engine/APU → Electrical/Pneumatics/Fuel/Warning, no START inference, source-gated UNKNOWN, independent faults, trace and replay.');
