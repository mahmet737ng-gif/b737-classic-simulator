'use strict';
// EXTL-INBOARD-LEFT-PIXEL-0002
// Owner photo, 795px mobile screenshot: black INBOARD L hole ≈x427;
// original OUTBOARD L/R at x82/259, correct INBOARD R at x687.
// Fit against the three unchanged physical switch axes gives expected
// source X 397.4; native photo registration rounds to X398.
// Do NOT modify the locked OH23-25 image or any other switch/mode.
const assert=require('node:assert/strict');
const model=require('./model.js');
const registry=require('./registry.json');
const layout=require('../all-overhead/atlas-layout.json');
const names=['landing-out-l','landing-out-r','landing-in-l','landing-in-r'];
const controls=names.map(id=>registry.controls.find(c=>c.id===id));
assert.ok(controls.every(Boolean),'Four authoritative exterior landing switches');
const [outL,outR,inL,inR]=controls;
assert.equal(inL.placementId,'OH23-25');
assert.deepEqual(inL.sourcePoint,[398,318],
 'INBOARD L must be centred on the unoccupied L photo bezel, NOT the ON legend');
assert.deepEqual(outL.sourcePoint,[235,318]);
assert.deepEqual(outR.sourcePoint,[318,318]);
assert.deepEqual(inR.sourcePoint,[520,318]);
assert.deepEqual(inL.states,['OFF','ON'],'INBOARD LEFT remains two-position');
assert.deepEqual(inR.states,['OFF','ON'],'INBOARD RIGHT remains two-position');
assert.deepEqual(outL.states,['RETRACT','EXTEND','ON']);
assert.deepEqual(outR.states,['RETRACT','EXTEND','ON']);
assert.ok(!registry.controls.some(c=>c.placementId==='OH23-25' &&
 c.id!=='landing-in-l' &&
 Math.abs(c.sourcePoint[0]-inL.sourcePoint[0])<20 &&
 Math.abs(c.sourcePoint[1]-inL.sourcePoint[1])<25),
 'No overlapping/duplicate interactive controls above photographed L hole');
const sourcePoints=controls.map(c=>c.sourcePoint[0]);
assert.ok(sourcePoints[0]<sourcePoints[1]&&sourcePoints[1]<sourcePoints[2]&&
 sourcePoints[2]<sourcePoints[3],'L/R mounting order');
const placement=layout.placements.find(p=>p.id==='OH23-25');
const centers=controls.map(c=>model.mapPoint(c,placement));
const scale=placement.w/placement.sourceDimensions[0];
assert.ok(Math.abs((centers[2].x-centers[1].x)-(398-318)*scale)<1e-7);
assert.ok(Math.abs((centers[3].x-centers[2].x)-(520-398)*scale)<1e-7);
const behavior=model.controller(registry);
assert.equal(behavior.get(inL.id),'OFF');
behavior.cycle(inL.id);
assert.equal(behavior.get(inL.id),'ON','INBOARD L clickable OFF to ON');
behavior.cycle(inL.id);
assert.equal(behavior.get(inL.id),'OFF','INBOARD L clickable ON to OFF');
assert.equal(behavior.get(inR.id),'OFF','INBOARD R unaffected');
console.log('PASS: INBOARD LEFT x398 centred in vacant photo hole, no duplicate; OUTBOARD/INBOARD R unchanged, two-position OFF/ON retained.');
