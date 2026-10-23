'use strict';
const assert=require('node:assert/strict');
const {sourceOnlyCapPreview,finalTakeoffN1,AIRCRAFT}=
  require('../engine/network/afm-n1-research-preview.cjs');
// Synthetic unit-test knots only. Private AFM data must stay in Library.
const capKnots=[-20,-10,0,10,20].map((oatC,i)=>({oatC,capN1Pct:80+2*i}));
const q={effectivity:AIRCRAFT,pmcMode:'OFF',oatC:-5,capKnots};
const x=sourceOnlyCapPreview(q);
assert.equal(x.previewCapPct,83);
assert.deepEqual(x.interval,[-10,0]);
assert.equal(x.finalTakeoffN1Pct,null);
assert.equal(x.approvedForFMC,false);
assert.equal(x.quantity,'MAXIMUM_N1_CAP_NOT_ENGINE_TARGET');
for(const bad of [-21,21])assert.throws(()=>sourceOnlyCapPreview({...q,oatC:bad}),RangeError);
assert.throws(()=>sourceOnlyCapPreview({...q,pmcMode:'ON'}),/PMC OFF/);
assert.throws(()=>sourceOnlyCapPreview({...q,effectivity:{...AIRCRAFT,msn:29341}}),TypeError);
assert.throws(()=>sourceOnlyCapPreview({...q,capKnots:capKnots.slice(0,4)}),TypeError);
assert.throws(()=>sourceOnlyCapPreview({...q,capKnots:capKnots.map((p,i)=>({...p,oatC:0}))}),TypeError);
assert.throws(()=>finalTakeoffN1(),e=>e.code==='AFM_N1_QA_BLOCKED');
console.log('AFM v17 research-only bounded CAP preview and blocked FMC N1 PASS');
