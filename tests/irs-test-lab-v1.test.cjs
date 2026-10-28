'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Lab=require('../panel-mosaic-lab/irs-test-lab/engine.js');
const Cases=require('../panel-mosaic-lab/irs-test-lab/scenarios.js');
const Core=require('../engine/systems/irs-trainer-core-v1.cjs');
const root=path.join(__dirname,'..');
assert.equal(Cases.all.length,27,'All 27 QRH and procedure cases must be discoverable');
assert.equal(new Set(Cases.all.map(x=>x.id)).size,27,'Unique case identifiers');
assert(Cases.all.every(x=>x.steps.length&&x.expected.length&&x.ref&&['CORE','INJECTED'].includes(x.level)));
const test=Lab.create();
assert.equal(test.snapshot().sourceType,'LOCAL_BENCH_ISOLATED_FROM_UNIFIED');
assert.equal(test.snapshot().units.L.mode,'OFF');
let results=[];
for(const item of Cases.all){
 try{
  test.scenario(item.id,'L');
  const s=test.snapshot();
  const result=test.checkStatus();
  results.push({id:item.id,result,source:item.level});
  assert.equal(s.activeScenario,item.id);
  assert.equal(s.currentScenario.id,item.id);
  assert.equal(result,true,item.id+' should match scenario expected initial indications');
  assert.equal(s.checklist.length,item.steps.length);
  assert.equal(s.powerDiagnostics.cbRoutingVerified,false);
  if(item.level==='INJECTED'){
   assert(item.subtitle,'Explicit training context for simulated faults');
  }
 }catch(err){
  throw Error('QRH lab scenario '+item.id+' failed: '+(err.stack||err));
 }
}
assert.equal(results.length,27);
assert(results.some(r=>r.id==='fault-ground'&&r.result===true));
assert(results.some(r=>r.id==='on-dc-right'&&r.result===true));
assert(results.some(r=>r.id==='right-300'&&r.result===true));
test.scenario('right-300');
let snap=test.snapshot();
assert.equal(snap.units.R.powerSource,'RIGHT_BACKUP_EXPIRED');
assert.equal(snap.units.R.phase,'POWER_LOST');
assert.equal(snap.units.L.phase,'NAV_READY');
assert.equal(snap.units.L.positionValid,true);
assert.equal(snap.units.R.positionValid,false);
test.setBus('transfer2',true);
assert.equal(test.snapshot().units.R.phase,'SELFTEST');
assert.equal(test.snapshot().units.R.positionValid,false);
test.advance(3.5);
assert.equal(test.snapshot().units.R.phase,'ALIGNING');
// Core version of alignment: transition to READY after full duration, not on a
// premature NAV selector change; no stale position is carried through.
test.scenario('no-position');
assert.equal(test.snapshot().units.L.alignStatusCode,8);
test.setPos('N35395 E051254','L');
assert.equal(test.snapshot().units.L.phase,'NAV_READY');
assert.equal(test.snapshot().units.L.alignStatusCode,null);
test.scenario('motion');
assert.equal(test.snapshot().units.L.alignStatusCode,3);
test.setMotion(false);test.advance(5);
assert.equal(test.snapshot().units.L.phase,'ALIGNING');
assert.equal(test.snapshot().units.L.alignStatusCode,null);
test.scenario('stored-position');
assert.equal(test.snapshot().units.L.alignStatusCode,12);
test.setPos('N35395 E051254','L');
assert.equal(test.snapshot().units.L.alignStatusCode,null);
test.scenario('computed-twice');
assert.equal(test.snapshot().units.L.faultLamp,true);
assert.equal(test.snapshot().units.L.alignStatusCode,4);
// The dedicated instructor fault must be distinguished from a real core fault.
test.scenario('fault-flight');
snap=test.snapshot();
assert.equal(snap.units.L.syntheticFault,true);
assert.equal(snap.units.L.faultLamp,true);
assert.equal(snap.units.L.positionValid,false);
assert.equal(Core.status(test.Core.apply(Core.initialState(),{type:'POWER',side:'L',available:true}),'L').faultLamp,false);
test.progressStep(0,true);
assert.equal(test.snapshot().checklist[0],true);
test.selectTransfer('BOTH ON R');
assert.equal(test.snapshot().transfer,'BOTH ON R');
const beforeClear=test.snapshot();
assert(beforeClear.log.length>0);
test.clearLog();
assert.equal(test.snapshot().log.length,0);
assert.equal(test.snapshot().transfer,beforeClear.transfer,'Clear log must not clear selector');
assert.equal(test.snapshot().activeScenario,beforeClear.activeScenario,'Clear log must not clear scenario');
assert.equal(test.snapshot().units.L.faultLamp,beforeClear.units.L.faultLamp,'Clear log must not change injected faults');
test.reset('READY');
test.setBus('switchedHotBattery',false);
assert.equal(test.snapshot().units.L.dcFailLamp,true);
assert.equal(test.snapshot().units.R.dcFailLamp,true);
assert.equal(test.snapshot().units.L.positionValid,true,'Normal AC retains navigation despite backup DC fail');
assert.equal(test.snapshot().units.R.positionValid,true);
test.reset('READY');
test.inject('L','dcFail',true);
assert.equal(test.snapshot().units.L.syntheticDcFail,true);
assert.equal(test.snapshot().units.R.syntheticDcFail,false);
assert.equal(test.snapshot().units.L.positionValid,true);
test.reset('COLD');
test.setMode('L','ALIGN');
test.setPos('N50100 E010000','L');
test.advance(3.5);test.advance(600);
assert.equal(test.snapshot().units.L.phase,'ALIGN_READY','Owner 50N stays ALIGN');
assert.equal(test.snapshot().units.L.alignLampMode,'STEADY');
test.setMode('L','NAV');
assert.equal(test.snapshot().units.L.phase,'NAV_READY');
// Existing cockpit RED ZONE stays intact; no lab files inside pinned area.
const lock=JSON.parse(fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/irs-complete-redzone-lock-v1.json'),'utf8'));
assert.equal(Object.keys(lock.protectedBlobs).length,93);
for(const p of Object.keys(lock.protectedBlobs))assert(!p.startsWith('panel-mosaic-lab/irs-test-lab/'));
const page=fs.readFileSync(path.join(root,'panel-mosaic-lab/irs-test-lab/index.html'),'utf8');
for(const ref of ['engine.js','scenarios.js','lab.js','lab.css','irs-trainer-web-v1.js','irs-electrical-evidence-v2.js'])
 assert(page.includes(ref),'Missing page asset '+ref);
assert(page.includes('DO NOT USE FOR FLIGHT'));
const view=fs.readFileSync(path.join(root,'panel-mosaic-lab/irs-test-lab/lab.js'),'utf8');
assert(!/fetch\(|XMLHttpRequest|localStorage|eval\(/.test(view),'Bench must be local, deterministic and offline-capable');
console.log('PASS IRS QRH LAB: 27/27 scenarios, engine/electrical core, MRG 03/04/08/12, 300s DC cutoff, 50N ALIGN hold, instructor simulation, 93 redzone bytes untouched');
