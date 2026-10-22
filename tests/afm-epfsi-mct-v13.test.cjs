'use strict';
const assert=require('node:assert/strict');
const m=require('../engine/fmc/performance/afm-epfsi-mct-v13.cjs');
const c={registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000,pmcMode:'NORMAL',phase:'MAX_CONTINUOUS',pressureAltitudeFt:5000,mach:.5,tatC:10,referenceTatC:5};
const curves={sourceClass:'SYNTHETIC_TEST_FIXTURE_ONLY',
 pressureLimit:()=>98,temperatureLimit:()=>96,tatCorrection:()=>1,
 altitudeCorrection:()=>-.5,bleedAdjustments:()=>[-1,-1],
 nomogram:x=>x+.7};
let count=0;function t(name,fn){fn();count++;console.log('PASS',name);}
t('airframe',()=>assert.equal(m.PROFILE.serial,29340));
t('printed source',()=>assert.equal(m.SOURCE.pdfPage,130));
t('six steps',()=>assert.equal(m.STAGES.length,6));
t('default remains blocked',()=>assert.equal(m.requestMctN1(c).n1Pct,null));
t('default autothrottle null',()=>assert.equal(m.requestMctN1(c).autothrottleTarget,null));
t('wrong serial blocked',()=>assert.equal(m.requestMctN1({...c,serial:29339}).reason,'WRONG_AIRFRAME'));
t('wrong engine blocked',()=>assert.equal(m.requestMctN1({...c,engine:'CFM56-3C-1'}).reason,'WRONG_AIRFRAME'));
t('22K blocked',()=>assert.equal(m.requestMctN1({...c,ratingLbf:22000}).reason,'WRONG_AIRFRAME'));
t('unknown PMC blocked',()=>assert.equal(m.requestMctN1({...c,pmcMode:'UNKNOWN'}).reason,'PMC_UNKNOWN'));
t('PMC OFF MCT uses same source',()=>assert.equal(m.requestMctN1({...c,pmcMode:'OFF'}).source.pdfPage,130));
t('non MCT phase blocked',()=>assert.equal(m.requestMctN1({...c,phase:'TAKEOFF'}).reason,'INVALID_PHASE'));
t('no synthetic without explicit tag',()=>assert.equal(m.calculateSyntheticTrace(c,{...curves,sourceClass:'AFM'}).status,'BLOCKED'));
const r=m.calculateSyntheticTrace(c,curves);
t('synthetic trace tag',()=>assert.equal(r.status,'SYNTHETIC_TEST_TRACE_ONLY'));
t('synthetic expected 95.2',()=>assert.ok(Math.abs(r.diagnosticSyntheticN1Pct-95.2)<1e-7));
t('synthetic pressure limit stage',()=>assert.equal(r.stages[0].value,98));
t('synthetic temperature plus TAT stage',()=>assert.equal(r.stages[1].value,97));
t('synthetic lower temperature chosen',()=>assert.equal(r.stages[2].limitingBranch,'TEMPERATURE'));
t('synthetic altitude correction',()=>assert.equal(r.stages[3].value,96.5));
t('synthetic bleed sum',()=>assert.equal(r.stages[4].value,94.5));
t('final unit separated',()=>assert.equal(r.stages[5].unit,'N1_GAGE_PERCENT'));
t('synthetic cannot flow to CDU',()=>assert.equal(r.n1Pct,null));
t('synthetic cannot flow to A/T',()=>assert.equal(r.autothrottleTarget,null));
t('TAT outside altitude window not applied',()=>assert.equal(m.calculateSyntheticTrace({...c,pressureAltitudeFt:2000,referenceTatC:null},curves).stages[1].tatCorrection,0));
t('TAT at 2500 applied',()=>assert.equal(m.calculateSyntheticTrace({...c,pressureAltitudeFt:2500},curves).stages[1].tatCorrection,1));
t('TAT at 10000 applied',()=>assert.equal(m.calculateSyntheticTrace({...c,pressureAltitudeFt:10000},curves).stages[1].tatCorrection,1));
t('TAT above 10000 skipped',()=>assert.equal(m.calculateSyntheticTrace({...c,pressureAltitudeFt:10001,referenceTatC:null},curves).stages[1].tatCorrection,0));
t('pressure limit branch selection',()=>assert.equal(m.calculateSyntheticTrace(c,{...curves,pressureLimit:()=>90}).stages[2].limitingBranch,'PRESSURE'));
t('missing lookups error',()=>assert.throws(()=>m.calculateSyntheticTrace(c,{sourceClass:'SYNTHETIC_TEST_FIXTURE_ONLY'}),/MISSING_SYNTHETIC/));
t('NaN missing input error',()=>assert.throws(()=>m.calculateSyntheticTrace({...c,tatC:NaN},curves),/INVALID_TAT_C/));
t('invalid synthetic gage value error',()=>assert.throws(()=>m.calculateSyntheticTrace(c,{...curves,nomogram:()=>150}),/OUT_OF_BOUNDS/));
console.log('PASS: '+count+' synthetic MCT stage/QA tests; zero approved AFM N1');