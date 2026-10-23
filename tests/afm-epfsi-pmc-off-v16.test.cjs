'use strict';
const a=require('node:assert/strict');
const n=require('../engine/fmc/performance/afm-epfsi-pmc-off-v16.cjs');
const c={registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000,phase:'TAKEOFF',pmcMode:'OFF',pressureAltitudeFt:1000,oatC:10,iasKts:50,acPacks:'AUTO',antiIce:'OFF'};
const d={syntheticFixtureOnly:true,sourcePage:756,
 altitudeCurves:[{altitudeFt:0,points:[{x:0,y:90},{x:20,y:88}]},{altitudeFt:2000,points:[{x:0,y:94},{x:20,y:92}]}],
 maximumN1:[{x:0,y:90.5},{x:20,y:91}],
 bleedCorrections:{'AUTO:OFF':[{altitudeFt:0,points:[{x:0,y:0},{x:20,y:0}]},{altitudeFt:2000,points:[{x:0,y:0},{x:20,y:0}]}]}};
let pass=0;function t(k,f){f();pass++;console.log('PASS',k)}
t('midpoint base=91',()=>a.equal(n.altitudeCurveAt(d.altitudeCurves,1000,10),91));
t('max cap binding',()=>a.equal(n.syntheticTest(c,d).diagnosticCapBinding,true));
t('minimum applied in synthetic diagnostics',()=>a.equal(n.syntheticTest(c,d).diagnosticN1Pct,90.75));
t('non-capped source branch in synthetic',()=>a.equal(n.syntheticTest({...c,pressureAltitudeFt:0},d).diagnosticN1Pct,89));
t('synthetic output never N1 target',()=>a.equal(n.syntheticTest(c,d).n1Pct,null));
t('synthetic output never A/T target',()=>a.equal(n.syntheticTest(c,d).autothrottleTarget,null));
t('unsigned AFM data fails',()=>a.equal(n.calculate(c,d).reason,'INDEPENDENT_COMPLETE_SOURCE_QA_NOT_SIGNED'));
t('unsigned data never N1',()=>a.equal(n.calculate(c,d).n1Pct,null));
t('wrong airplane blocked',()=>a.equal(n.syntheticTest({...c,serial:29339},d).reason,'AIRFRAME_MISMATCH'));
t('wrong engine blocked',()=>a.equal(n.syntheticTest({...c,engine:'CFM56-3C-1'},d).reason,'AIRFRAME_MISMATCH'));
t('wrong thrust rating blocked',()=>a.equal(n.syntheticTest({...c,ratingLbf:22000},d).reason,'AIRFRAME_MISMATCH'));
t('PMC not OFF blocked',()=>a.equal(n.syntheticTest({...c,pmcMode:'NORMAL'},d).reason,'PMC_NOT_OFF'));
t('temperature extrapolation refused',()=>a.equal(n.syntheticTest({...c,oatC:21},d).reason,'OUTSIDE_DOCUMENTED_CURVE_NO_EXTRAPOLATION'));
t('altitude extrapolation refused',()=>a.equal(n.syntheticTest({...c,pressureAltitudeFt:5000},d).reason,'ALTITUDE_OUTSIDE_VERIFIED_GRID'));
t('missing bleed refused',()=>a.equal(n.syntheticTest({...c,acPacks:'HIGH'},d).reason,'BLEED_CASE_NOT_DIGITIZED'));
t('Cowl TAI above 10C blocked',()=>a.equal(n.syntheticTest({...c,antiIce:'COWL_TAI',oatC:11},d).reason,'COWL_TAI_PROHIBITED_ABOVE_10C'));
t('Takeoff below 40kt blocked',()=>a.equal(n.syntheticTest({...c,iasKts:39},d).reason,'THRUST_SETTING_SPEED_MUST_BE_40_TO_60_KT'));
t('Takeoff above 60kt blocked',()=>a.equal(n.syntheticTest({...c,iasKts:61},d).reason,'THRUST_SETTING_SPEED_MUST_BE_40_TO_60_KT'));
t('invalid curve order rejected',()=>a.equal(n.syntheticTest(c,{...d,maximumN1:[{x:20,y:91},{x:0,y:90}]}).reason,'NONMONOTONIC_SOURCE_DOMAIN'));
t('unassigned source data not signed',()=>a.equal(n.signedSource({...d,qa:{independentReviewers:[{id:'A'},{id:'A'}]}}),false));
t('ref source 755 756',()=>{a.equal(n.SOURCE.procedurePage,755);a.equal(n.SOURCE.sourcePage,756)});
console.log(pass+' EP-FSI v16 cap/bleed/curve/QA tests passed — NUMERIC N1 SOURCE BLOCKED');
