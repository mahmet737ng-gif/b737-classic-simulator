'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const manifest=JSON.parse(fs.readFileSync(path.join(__dirname,'../engine/network/epfsi-afm-n1-source-gate.v16.json'),'utf8'));
const {AFM_GATE,getAFMTargetN1}=require('../engine/network/engine-performance-dynamics.cjs');
assert.equal(AFM_GATE.qaVersion,16);
assert.equal(AFM_GATE.approvedFinalN1Points,0);
assert.equal(AFM_GATE.numericN1Enabled,false);
assert.equal(manifest.independentlyApprovedFinalNumericN1Points,0);
assert.equal(manifest.humanIndependentNumericalSignoffs,0);
assert.equal(manifest.afmEngineOutputAllowed,false);
assert.equal(manifest.components,13);
assert.equal(manifest.sourceLabels,45);
assert.equal(manifest.inheritedSingleSourceProvisional.v15MaximumN1CapCandidates,5);
assert.equal(manifest.inheritedSingleSourceProvisional.v15StarterCrossings,10);
assert.deepEqual(manifest.source.scopedPages,[128,129,130,756]);
assert.equal(manifest.aircraft.msn,29340);
assert.equal(manifest.aircraft.ratingLbf,20000);
assert.equal(AFM_GATE.sourcePdfSha256,manifest.source.sha256);
assert.throws(()=>getAFMTargetN1({
 registration:'EP-FSI',msn:29340,engine:'CFM56-3B-1',ratingLbf:20000,
 qaSigned:true,verified:true,approvedBy:'owner'}),e=>e.code==='AFM_N1_QA_BLOCKED');
console.log('AFM source v16 QA provenance and sealed N1 release gate PASS');
