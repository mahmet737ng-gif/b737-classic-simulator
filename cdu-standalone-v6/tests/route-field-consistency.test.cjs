'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const core = require('../engine/cdu-engine.js');
const scope = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../data/page-definitions.js'),'utf8'),scope);
const pages = scope.window.CDU_PAGES;
const press=(s,k)=>core.press(s,pages,'CDU_CAPT_'+k);
const navigate=(s,p)=>press(s,p);
function input(s,code,side){
  navigate(s,'RTE');
  for(const c of code) press(s,'KEY_'+c);
  press(s,'LSK_'+side);
  assert.equal(s.scratch,'');
  assert.equal(s.message,'');
}
function shown(s,page,field){
  core.choose(s,pages,page);
  const result=core.render(s,pages);
  assert.equal(core.readValue(s,field,page),field==='ORIGIN'?'OIII':field==='DEST'?'OIMM':'29R');
  return result.join('\n');
}
const s=core.makeState('INDEX');
input(s,'OIII','L1');
input(s,'OIMM','R1');
input(s,'29R','L3');
assert.equal(s.active.ORIGIN,'');
assert.equal(s.active.DEST,'');
assert.equal(s.stagedRoute.ORIGIN,'OIII');
assert.equal(s.stagedRoute.DEST,'OIMM');
assert.equal(s.stagedRoute.RUNWAY,'29R');
// Source of the screenshot regression: values are still staged but must be
// visible in the departure/arrival context before ACTIVATE and EXEC.
assert.match(shown(s,'DEP_ARR','ORIGIN'),/OIII/);
assert.match(shown(s,'DEP_ARR','DEST'),/OIMM/);
assert.match(shown(s,'DEPARTURES','ORIGIN'),/OIII/);
assert.match(shown(s,'DEPARTURES','RUNWAY'),/29R/);
assert.match(shown(s,'ARRIVALS','DEST'),/OIMM/);
// Only the RTE activation path may transfer staged fields into pending/active.
navigate(s,'RTE');
press(s,'LSK_L5');
assert.equal(s.page,'ACTIVATE');
assert.equal(s.pending.ORIGIN,'OIII');
press(s,'EXEC');
assert.equal(s.active.ORIGIN,'OIII');
assert.equal(s.active.DEST,'OIMM');
assert.equal(s.active.RUNWAY,'29R');
assert.equal(Object.keys(s.stagedRoute).length,0);
assert.match(shown(s,'DEPARTURES','ORIGIN'),/OIII/);
assert.match(shown(s,'ARRIVALS','DEST'),/OIMM/);
// Priority remains pending > staged > active. No stale active origin may leak.
s.pending.ORIGIN='OIII';
s.stagedRoute.ORIGIN='ZZZZ';
assert.equal(core.readValue(s,'ORIGIN','DEPARTURES'),'OIII');
delete s.pending.ORIGIN;
assert.equal(core.readValue(s,'ORIGIN','DEPARTURES'),'ZZZZ');
delete s.stagedRoute.ORIGIN;
assert.equal(core.readValue(s,'ORIGIN','DEPARTURES'),'OIII');
console.log('CDU RTE staged airport propagation to DEP/ARR, DEPARTURES, ARRIVALS: PASS');
