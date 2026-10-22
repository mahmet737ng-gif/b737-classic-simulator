'use strict';
const assert=require('node:assert/strict');
const n=require('../engine/fmc/performance/n1-interpolation-guard-v11.cjs');
const clean={serial:29340,engine:'CFM56-3B-1',ratingLbf:20000,sourceId:'SYNTHETIC-TEST-ONLY',
 altitudeFt:[0,5000],temperatureC:[0,10],n1Pct:[[80,82],[78,80]],
 qa:{reviewA:'A',reviewB:'B',completeCurves:true,bleedCorrectionsVerified:true,antiIceCorrectionsVerified:true,maxLimitsVerified:true,scopedGoldenVectorsPassed:true}};
let tests=0;
function run(name,f){f();tests++;console.log('PASS',name)}
run('synthetic centre point',()=>assert.equal(n.bilinear(clean,2500,5).n1Pct,80));
run('exact synthetic corner',()=>assert.equal(n.bilinear(clean,0,0).n1Pct,80));
run('edge interpolation',()=>assert.equal(n.bilinear(clean,5000,5).n1Pct,79));
run('outside temperature blocked',()=>assert.equal(n.tryInterpolate(clean,1000,12).reason,'OUTSIDE_VALIDATED_CHART_RANGE'));
run('outside altitude blocked',()=>assert.equal(n.tryInterpolate(clean,8000,8).reason,'OUTSIDE_VALIDATED_CHART_RANGE'));
run('wrong ASN blocked',()=>assert.equal(n.tryInterpolate({...clean,serial:29341},2500,5).reason,'WRONG_AIRCRAFT'));
run('one reviewer blocked',()=>assert.equal(n.tryInterpolate({...clean,qa:{...clean.qa,reviewB:'A'}},2500,5).reason,'INDEPENDENT_REVIEW_PENDING'));
run('incomplete family blocked',()=>assert.equal(n.tryInterpolate({...clean,qa:{...clean.qa,completeCurves:false}},2500,5).reason,'FULL_CURVES_NOT_VALIDATED'));
run('bleed blocked',()=>assert.equal(n.tryInterpolate({...clean,qa:{...clean.qa,bleedCorrectionsVerified:false}},2500,5).reason,'CORRECTIONS_UNVERIFIED'));
run('anti ice blocked',()=>assert.equal(n.tryInterpolate({...clean,qa:{...clean.qa,antiIceCorrectionsVerified:false}},2500,5).reason,'CORRECTIONS_UNVERIFIED'));
run('limits blocked',()=>assert.equal(n.tryInterpolate({...clean,qa:{...clean.qa,maxLimitsVerified:false}},2500,5).reason,'MAX_N1_LIMIT_UNVERIFIED'));
run('golden vector blocked',()=>assert.equal(n.tryInterpolate({...clean,qa:{...clean.qa,scopedGoldenVectorsPassed:false}},2500,5).reason,'GOLDEN_VECTORS_PENDING'));
run('grid incomplete blocked',()=>assert.equal(n.tryInterpolate({...clean,n1Pct:[[80,82]]},2500,5).reason,'INCOMPLETE_GRID'));
run('unsorted temperature blocked',()=>assert.equal(n.tryInterpolate({...clean,temperatureC:[10,0]},2500,5).reason,'NON_MONOTONIC_GRID'));
run('bad numeric out blocked',()=>assert.equal(n.tryInterpolate({...clean,n1Pct:[[120,120],[120,120]]},2500,5).reason,'N1_OUTPUT_INVALID'));
run('v11 field-locked',()=>assert.equal(n.tryInterpolate({...clean,qa:{...clean.qa,completeCurves:false}},2500,5).n1Pct,null));
console.log('PASS',tests,'generic synthetic interpolation and QA gates');