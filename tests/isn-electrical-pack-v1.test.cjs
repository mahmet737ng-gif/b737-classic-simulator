'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Electrical = require('../engine/systems/electrical-v7');
const Loads = require('../engine/systems/electrical-loads-v8');
const TrainerCore = require('../engine/trainer/core');
const {WarningEngine} = require('../audio/warning-engine');
const Pack = require('../engine/integration/isn-electrical-pack-v1');
const readSession = () => new Pack.Session({Electrical, Loads, TrainerCore, WarningEngine});
const powerFault = (s, id, active) => s.send({type: 'ELECTRICAL', action: {type: 'FAULT', id, active, instructor: true}});
const powerControl = (s, key, value) => s.send({type: 'ELECTRICAL', action: {type: 'CONTROL', key, value}});
const switchPump = (s, id, value) => s.send({type: 'PUMP_SWITCH', id, value});
const trit = (v) => v === true || v === false || v === null;

const s = readSession();
let o = s.get();
assert.equal(o.mode, 'SOURCE_GATED');
assert.equal(Pack.PUMP_REGISTRY.length, 8);
assert.equal(o.loads.coverage.loadsKnownBus, 0);
assert.equal(o.loads.coverage.loadsPending, 16);
for (const p of Pack.PUMP_REGISTRY) {
  assert.equal(o.pumps[p.id].sourceBus, null, 'No undocumented fuel/hyd equipment bus asserted');
  assert.equal(o.pumps[p.id].powered, null);
  assert.equal(o.pumps[p.id].lowPressure, p.group === 'CENTER' ? false : true);
}
assert.equal(o.warnings.masterCautionHyd, null, 'Unsupported hydraulic master caution is UNKNOWN');
assert.equal(o.warnings.masterCautionFuelCandidate, true);
assert.equal(o.warnings.qa.fuelCaution, 'TRAINER_CORE_CANDIDATE_NOT_SOURCE_APPROVED_MASTER_CAUTION');

switchPump(s, 'fuel.main1FwdPump', true);
o = s.get();
assert.equal(o.pumps['fuel.main1FwdPump'].operating, null);
assert.equal(o.pumps['fuel.main1FwdPump'].lowPressure, null);
powerFault(s, 'GEN1_FAILED', true);
o = s.get();
assert.equal(o.electrical.bus.generator1, false);
assert.equal(o.electrical.bus.transfer1, true, 'Crossfeed from GEN2 keeps transfer1 alive');
assert.equal(o.pumps['fuel.main1FwdPump'].powered, null, 'Crossfeed must not imply fuel pump feed');
powerFault(s, 'GEN2_FAILED', true);
o = s.get();
assert.equal(o.electrical.bus.transfer1, false);
assert.equal(o.pumps['fuel.main1FwdPump'].powered, null, 'Unknown equipment voltage class stays UNKNOWN at AC blackout');
assert.ok(o.recentEvents.at(-1).changes.some(c => c.path === 'elec.bus.transfer1'));

// Independently observed trainer sensor is not promoted to a claimed wire map.
o = s.send({type: 'OBSERVED_POWER', id: 'fuel.main1FwdPump', value: true, instructor: true});
assert.equal(o.pumps['fuel.main1FwdPump'].operating, true);
assert.equal(o.pumps['fuel.main1FwdPump'].sourceBus, null);
assert.equal(o.pumps['fuel.main1FwdPump'].powerEvidence, 'INDEPENDENT_INSTRUCTOR_SENSOR');
o = s.send({type: 'OBSERVED_POWER', id: 'fuel.main1FwdPump', value: false, instructor: true});
assert.equal(o.pumps['fuel.main1FwdPump'].operating, false);
assert.equal(o.pumps['fuel.main1FwdPump'].lowPressure, true);
assert.throws(() => s.send({type: 'OBSERVED_POWER', id: 'fuel.main1FwdPump', value: true}), /instructor/);

const sim = readSession();
sim.send({type: 'MODE', value: 'TRAINING_SURROGATE', instructor: true});
switchPump(sim, 'fuel.main1FwdPump', true);
let r = sim.get();
assert.equal(r.pumps['fuel.main1FwdPump'].operating, true);
assert.equal(r.pumps['fuel.main1FwdPump'].lowPressure, false);
assert.equal(r.pumps['fuel.main1FwdPump'].sourceBus, 'transfer1');
assert.equal(r.pumps['fuel.main1FwdPump'].powerQuality, 'EDUCATIONAL_ASSUMPTION');
powerFault(sim, 'GEN1_FAILED', true);
r = sim.get();
assert.equal(r.pumps['fuel.main1FwdPump'].operating, true, 'Source crossfeed prevents simulated pump dropout');
powerControl(sim, 'busTransferAuto', false);
r = sim.get();
assert.equal(r.pumps['fuel.main1FwdPump'].operating, false);
assert.equal(r.pumps['fuel.main1FwdPump'].lowPressure, true);
assert.ok(r.recentEvents.at(-1).changes.some(c => c.path === 'fuel.main1FwdPump.operating' && c.evidence === 'TRAINING_SURROGATE_UNVERIFIED_BUS_ASSIGNMENT'));
assert.ok(r.recentEvents.at(-1).changes.some(c => c.path === 'fuel.main1FwdPump.lowPressure'));

switchPump(sim, 'hyd.electricPumpA', true);
r = sim.get();
assert.equal(r.pumps['hyd.electricPumpA'].sourceBus, 'transfer2');
assert.equal(r.pumps['hyd.electricPumpA'].operating, true);
powerFault(sim, 'GEN2_FAILED', true);
r = sim.get();
assert.equal(r.pumps['hyd.electricPumpA'].operating, false);
assert.equal(r.pumps['hyd.electricPumpA'].lowPressure, true);
assert.equal(r.warnings.masterCautionHyd, null);
sim.send({type: 'MODE', value: 'SOURCE_GATED', instructor: true});
r = sim.get();
assert.equal(r.pumps['fuel.main1FwdPump'].sourceBus, null);
assert.equal(r.pumps['fuel.main1FwdPump'].operating, null);
assert.equal(r.pumps['hyd.electricPumpA'].operating, null);

const failure = readSession();
switchPump(failure, 'fuel.centerLeftPump', true);
failure.send({type: 'PUMP_FAULT', id: 'fuel.centerLeftPump', value: true, instructor: true});
r = failure.get();
assert.equal(r.pumps['fuel.centerLeftPump'].lowPressure, true);
assert.equal(r.warnings.masterCautionFuelCandidate, true);
assert.equal(r.warnings.audio.active.some(a => a.id === 'fireBell'), false,
  'Pump low-pressure must not invent a fire or aural warning');
failure.send({type: 'PUMP_SWITCH', id: 'fuel.centerLeftPump', value: false});
assert.equal(failure.get().pumps['fuel.centerLeftPump'].lowPressure, false);
failure.send({type: 'PUMP_SWITCH', id: 'hyd.electricPumpB', value: true});
failure.send({type: 'PUMP_OVERHEAT', id: 'hyd.electricPumpB', value: true, instructor: true});
assert.equal(failure.get().pumps['hyd.electricPumpB'].operating, false);
assert.equal(failure.get().pumps['hyd.electricPumpB'].overheat, true);

// Existing WarningEngine is active on its documented fire/cabin inputs.
r = failure.send({type: 'WARNING_SENSOR', key: 'engine1Fire', value: true});
assert.ok(r.warnings.audio.active.some(a => a.id === 'fireBell'));
assert.ok(r.recentEvents.at(-1).changes.some(c => c.path === 'warnings.audio.fireBell'));
r = failure.send({type: 'ACK_FIRE'});
assert.ok(!r.warnings.audio.active.some(a => a.id === 'fireBell'));
r = failure.send({type: 'WARNING_SENSOR', key: 'cabinAltitudeFt', value: 12000});
assert.ok(r.warnings.audio.active.some(a => a.id === 'intermittentHorn'));
r = failure.send({type: 'CUTOUT_CABIN'});
assert.ok(!r.warnings.audio.active.some(a => a.id === 'intermittentHorn'));

for (const bad of [
  {type: 'MODE', value: 'TRAINING_SURROGATE'},
  {type: 'MODE', value: 'VERIFIED', instructor: true},
  {type: 'PUMP_SWITCH', id: 'hyd.electricPumpA', value: null},
  {type: 'PUMP_FAULT', id: 'hyd.electricPumpA', value: true},
  {type: 'PUMP_OVERHEAT', id: 'fuel.centerLeftPump', value: true, instructor: true},
  {type: 'WARNING_SENSOR', key: 'oilPressure', value: 10}
]) assert.throws(() => failure.send(bad));
assert.equal(Pack.tOr([false, null]), null);
assert.equal(Pack.tAnd([true, null]), null);
assert.equal(Pack.tAnd([false, null]), false);
const replayCommands = [
  {type: 'MODE', value: 'TRAINING_SURROGATE', instructor: true},
  {type: 'PUMP_SWITCH', id: 'fuel.main1FwdPump', value: true},
  {type: 'ELECTRICAL', action: {type: 'FAULT', id: 'GEN1_FAILED', active: true, instructor: true}},
  {type: 'ELECTRICAL', action: {type: 'CONTROL', key: 'busTransferAuto', value: false}}
];
const left = readSession().replay(replayCommands);
const right = readSession().replay(replayCommands);
assert.deepEqual(left, right, 'Event replay must be deterministic');
assert.ok(Pack.PUMP_REGISTRY.every(p => trit(left.pumps[p.id].lowPressure)));
const labHtml = fs.readFileSync(path.join(__dirname, '../isn-electrical-pack-lab/index.html'), 'utf8');
const unifiedHtml = fs.readFileSync(path.join(__dirname, '../panel-mosaic-lab/cockpit/index.html'), 'utf8');
for (const id of ['mode', 'buses', 'pumps', 'warningSummary', 'eventTrace']) {
  assert.ok(labHtml.includes('id="' + id + '"'), 'Missing interactive lab element: ' + id);
}
assert.ok(unifiedHtml.includes('href="../../isn-electrical-pack-lab/"'), 'ISN test must be reachable from Unified');
const standalone = fs.readFileSync(path.join(__dirname, '../isn-electrical-pack-lab/standalone.html'), 'utf8');
assert.equal((standalone.match(/<script>/g) || []).length, 6, 'All six local scripts must be embedded');
assert.equal((standalone.match(/<style>/g) || []).length, 1, 'Stylesheet must be embedded');
assert.ok(!/<script[^>]+src=|<link[^>]+href=/.test(standalone), 'Standalone must not request external scripts/styles');
assert.ok(standalone.includes('B737ISNElectricalPackV1') && standalone.includes('B737ElectricalLoadsV8'));
console.log('PASS: ISN Electrical Pack V1 — 8 consumers, crossfeed, source-gated unknown, explicit training surrogate, warning/audio, trace and deterministic replay.');
