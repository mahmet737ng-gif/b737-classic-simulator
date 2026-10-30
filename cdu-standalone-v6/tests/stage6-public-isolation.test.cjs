'use strict';
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../stage6-selector.js'),'utf8');
const core=require('../engine/cdu-engine.js');
function load(hostname) {
  const state=core.makeState('DEP_ARR');
  const window={location:{hostname},NPE_STAGE5_MODEL:{validate:()=>({})},CDU_PAGES:{},updateStage5View:()=>{}};
  vm.runInNewContext(source,{window,state,core,fetch:()=>{throw new Error('Private API accessed in public CDU')}});
  return {window,state};
}
for(const hostname of ['mahmet737ng-gif.github.io','example.github.io','example.com']){
  assert.equal(load(hostname).window.CDU_STAGE6_API,undefined,
    'Stage6 private-source selector must not hijack standalone CDU on '+hostname);
}
for(const hostname of ['localhost','127.0.0.1']){
  assert.equal(typeof load(hostname).window.CDU_STAGE6_API?.beforeKey,'function');
}
const s=core.makeState('DEP_ARR');
const pages=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/page-definitions.json'),'utf8')).pages;
// Current FCOM INDEX selects a route airport, rather than an empty menu link.
s.active.ORIGIN='OIII';s.active.DEST='OIMM';
core.press(s,pages,'CDU_CAPT_LSK_L1');
assert.equal(s.page,'DEPARTURES');
assert.equal(s.depArrSelection.airport,'OIII');
assert.equal(s.message,'');
core.press(s,pages,'CDU_CAPT_DEP_ARR');
core.press(s,pages,'CDU_CAPT_LSK_R1');
assert.equal(s.page,'ARRIVALS');
assert.equal(s.depArrSelection.airport,'OIII');
assert.equal(s.message,'');
core.press(s,pages,'CDU_CAPT_DEP_ARR');
core.press(s,pages,'CDU_CAPT_LSK_R2');
assert.equal(s.depArrSelection.airport,'OIMM');
console.log('Standalone CDU and private Stage6 isolation: PASS');
