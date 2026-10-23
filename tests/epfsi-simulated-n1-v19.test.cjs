'use strict';
const assert=require('node:assert/strict');
const n=require('../engine/fmc/performance/epfsi-simulated-n1-v19.cjs');
const env=require('../engine/fmc/performance/epfsi-scenario-defaults-v17.cjs');
const aircraft={registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000};
let ok=0;function t(label,fn){fn();ok++;console.log('PASS',label);}
function run(phase,more){return n.estimate({...aircraft,...env.normalize({pressureAltitudeFt:0}),phase,...more});}
t('TO value user approximate range',()=>assert.ok(run('TAKEOFF').maxN1Pct>=88&&run('TAKEOFF').maxN1Pct<=95));
t('GA value user approximate range',()=>assert.ok(run('GO_AROUND').maxN1Pct>=88&&run('GO_AROUND').maxN1Pct<=95));
t('TO present 1 within approximate range',()=>assert.ok(run('TAKEOFF').presentN1Pct[1]>=88&&run('TAKEOFF').presentN1Pct[1]<=95));
t('GA present within approximate range',()=>assert.ok(run('GO_AROUND').presentN1Pct[1]>=88&&run('GO_AROUND').presentN1Pct[1]<=95));
t('default TO is reproducible',()=>assert.equal(run('TAKEOFF').maxN1Pct,91.7));
t('default GA is reproducible',()=>assert.equal(run('GO_AROUND').maxN1Pct,93.7));
t('engine indications distinct',()=>assert.notEqual(run('TAKEOFF').presentN1Pct[1],run('TAKEOFF').presentN1Pct[2]));
t('lever 0 idle-like display surrogate',()=>assert.equal(run('TAKEOFF',{thrustLeverPct:0}).presentN1Pct[1],20));
t('lever 100 target surrogate',()=>assert.equal(run('TAKEOFF',{thrustLeverPct:100}).presentN1Pct[1],run('TAKEOFF').maxN1Pct));
t('altitude changes coarse estimate',()=>assert.notEqual(run('TAKEOFF',{pressureAltitudeFt:15000,oatC:15,weatherMode:'CUSTOM'}).maxN1Pct,run('TAKEOFF').maxN1Pct));
t('bleed-off changes estimate (not AFM)',()=>assert.notEqual(run('TAKEOFF',{engineBleedMode:'OFF'}).maxN1Pct,run('TAKEOFF').maxN1Pct));
t('anti-ice engine changes estimate',()=>assert.notEqual(run('TAKEOFF',{antiIceMode:'ENGINE'}).maxN1Pct,run('TAKEOFF').maxN1Pct));
t('no altitude still approximate & explicitly assumed',()=>{const v=n.estimate({...aircraft,phase:'TAKEOFF'});assert.ok(v.altitudeAssumed);assert.equal(v.status,'SIM_ESTIMATE')});
t('unknown PMC does not block estimates',()=>assert.equal(run('TAKEOFF',{pmcMode:'UNKNOWN'}).status,'SIM_ESTIMATE'));
t('not AFM validated',()=>assert.equal(run('TAKEOFF').afmValidated,false));
t('no autothrottle target',()=>assert.equal(run('GO_AROUND').canDriveAutothrottle,false));
t('clearly labeled EST',()=>assert.equal(run('TAKEOFF').sourceLabel,'EST'));
t('wrong serial blocks',()=>assert.equal(n.estimate({...aircraft,serial:29339,phase:'TAKEOFF'}).status,'BLOCKED'));
t('wrong rating blocks',()=>assert.equal(n.estimate({...aircraft,ratingLbf:22000,phase:'TAKEOFF'}).status,'BLOCKED'));
t('extreme temperatures still user display band',()=>assert.ok(run('TAKEOFF',{oatC:90,weatherMode:'CUSTOM'}).maxN1Pct>=88));
t('no numeric truth implied',()=>assert.match(run('TAKEOFF').provenance,/NOT_AFM/));
console.log('PASS '+ok+' EP-FSI user-accepted EST N1 surrogate tests');
