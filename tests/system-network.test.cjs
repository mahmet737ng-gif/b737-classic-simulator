'use strict';

const assert = require('node:assert/strict');
const graph = require('../engine/network/b737cl-system-graph.v0.1.json');
const { evaluateEngineFireDetection: detect } = require('../engine/network/fire-detection-pilot.cjs');
const loop = (healthy, overheat=false, fire=false) => ({healthy, overheat, fire});
const evalFire = (selector, A, B, extra={}) =>
  detect({selector, power:'POWERED', loops:{A,B}, ...extra});

// Static graph integrity: every link exists and is source-traced.
assert.equal(graph.groups.length, 15);
assert.equal(graph.nodes.length, 78);
assert.equal(graph.edges.length, 81);
assert.equal(graph.faultCases.length, 7);
assert.equal(graph.status, 'DRAFT_GRAPH_NOT_EXECUTABLE_AIRCRAFT_MODEL');
const nodeIds = graph.nodes.map(n => n.id), groupIds = graph.groups.map(g => g.id);
assert.equal(new Set(nodeIds).size, nodeIds.length);
assert.equal(new Set(graph.edges.map(e => e.id)).size, graph.edges.length);
assert.equal(new Set(groupIds).size, groupIds.length);
for (const n of graph.nodes) {
  assert.ok(groupIds.includes(n.group), n.id + ' unknown system group');
}
for (const e of graph.edges) {
  assert.ok(nodeIds.includes(e.from), e.id+' invalid from: '+e.from);
  assert.ok(nodeIds.includes(e.to), e.id+' invalid to: '+e.to);
  assert.ok(e.kind && e.source && Number.isInteger(e.source.pdfPage));
  assert.ok(e.source.pdfPage>=1 && e.source.pdfPage<=1937);
  assert.ok(e.source.section && e.source.sourceId==='FCOM-SEPEHRAN-1937');
}
for (const c of graph.faultCases) {
  assert.ok(c.source.pdfPage>=1 && c.source.pdfPage<=1937);
}

// FCOM 8.20.1: good A and B in NORMAL -> require agreement.
let r=evalFire('NORMAL',loop(true,false,true),loop(true,false,false));
assert.equal(r.operational,true);
assert.equal(r.fireDetected,false);
assert.equal(r.detectorFault,false);

// Both valid detect fire -> primary + overheat indications; FCOM 8.20.2.
r=evalFire('NORMAL',loop(true,false,true),loop(true,false,true));
assert.equal(r.fireDetected,true);
assert.equal(r.alerts.masterFireWarn,true);
assert.equal(r.alerts.fireBell,true);
assert.equal(r.alerts.engOverheat,true);
assert.equal(r.alerts.masterCaution,true);

// Single failed loop in NORMAL silently excluded; good loop still monitors.
r=evalFire('NORMAL',loop(false),loop(true,true));
assert.equal(r.operational,true);
assert.equal(r.silentlyDegraded,true);
assert.equal(r.detectorFault,false);
assert.equal(r.alerts.masterCaution,true);

// Both failed in NORMAL -> FAULT / inoperative; no fabricated fire alert.
r=evalFire('NORMAL',loop(false),loop(false));
assert.equal(r.operational,false);
assert.equal(r.detectorFault,true);
assert.equal(r.fireDetected,false);

// Selected failed loop must produce FAULT, regardless of nonselected good loop.
r=evalFire('A',loop(false),loop(true,true,true));
assert.equal(r.operational,false);
assert.equal(r.detectorFault,true);
assert.equal(r.overheatDetected,false);

// Selected good loop functions alone.
r=evalFire('B',loop(false),loop(true,false,true));
assert.equal(r.operational,true);
assert.equal(r.fireDetected,true);

// Acknowledging warnings affects outputs, not the underlying hazardous state.
r=evalFire('NORMAL',loop(true,true,true),loop(true,true,true),{
  fireWarnAcknowledged:true,masterCautionAcknowledged:true
});
assert.equal(r.fireDetected,true);
assert.equal(r.overheatDetected,true);
assert.equal(r.alerts.fireBell,false);
assert.equal(r.alerts.masterFireWarn,false);
assert.equal(r.alerts.masterCaution,false);
assert.equal(r.alerts.engFireSwitch,true);

// Bus failure: unknown rather than inventing a clear or fault state.
r=detect({selector:'NORMAL',power:'UNPOWERED',loops:{A:loop(true),B:loop(true)}});
assert.equal(r.sensorStatus,'UNPOWERED');
assert.equal(r.fireDetected,null);
assert.equal(r.alerts.fireBell,null);

// Reject incomplete physical inputs.
assert.throws(()=>evalFire('NORMAL', {healthy:true}, loop(true)), TypeError);
assert.throws(()=>evalFire('C',loop(true),loop(true)), TypeError);

console.log('B737CL integrated-system graph checks and fire-loop pilot tests PASSED');
