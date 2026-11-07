'use strict';
// A known electrical bus cannot become UNKNOWN merely because a printed
// MRG index row requires photo QA or because equipment is "as installed".
// These tests validate electrical availability, not hardware installation.
const assert = require('node:assert/strict');
const Core = require('../engine/systems/classic-bus-consumer-engine-v1.js');
const E = require('../engine/systems/electrical-v7.js');
const Lab = require('../engine/systems/classic-bus-consumer-test-lab-v1.js');
const index = require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');
const lab = Lab.makeSession({Core,Electrical:E,index,mode:'CONVENTIONAL',
  pressurization:'DCPCS',aircraftModel:'737-300'});
const cases = [
 ['MRG-CL-185-012','electronic2@28VDC','MRG_SOURCE_REVIEW_PENDING','GENERAL_CLASSIC_REFERENCE'],
 ['MRG-CL-185-013','battery@28VDC','MRG_SOURCE_REVIEW_PENDING','GENERAL_CLASSIC_REFERENCE'],
 ['MRG-CL-187-010','dc1@28VDC','INSTALLATION_OPTION_UNCONFIRMED','AS_INSTALLED_UNVERIFIED'],
 ['MRG-CL-187-011','dc2@28VDC','INSTALLATION_OPTION_UNCONFIRMED','AS_INSTALLED_UNVERIFIED'],
 ['MRG-CL-188-027','generator2@115VAC','INSTALLATION_OPTION_UNCONFIRMED','AS_INSTALLED_UNVERIFIED'],
 ['MRG-CL-188-029','generator1@115VAC','INSTALLATION_OPTION_UNCONFIRMED','AS_INSTALLED_UNVERIFIED']
];
function entry(id){return lab.snapshot().consumers[id];}
function assertState(id,bus,expected,where){
  const row=entry(id);
  assert.ok(row,'The displayed source row exists: '+id);
  assert.equal(row.busKeys.length,1,where+' '+id+' must have one known bus');
  assert.equal(row.busKeys[0],bus,where+' '+id+' source bus');
  assert.equal(row.powerState,expected,where+' '+id+' electrical availability');
  assert.equal(row.canOperate,expected==='NORMAL',where+' '+id+' bus gate');
}
assert.equal(lab.buses.length,24);
const initial=lab.snapshot();
assert.equal(initial.coverage.sourceRows,340);
assert.equal(initial.coverage.UNKNOWN,0,'All-on known feeds must not be amber');
for(const [id,bus,qa,fit] of cases) {
  assertState(id,bus,'NORMAL','ALL ON');
  assert.equal(entry(id).quality,qa,'Source QA must be preserved');
  assert.equal(entry(id).installationStatus,fit,'Installation confidence must be preserved');
}
for(const [id,bus,qa,fit] of cases){
  lab.set(bus,false);
  assertState(id,bus,'OFF','SOURCE LOST');
  assert.equal(entry(id).quality,qa,'Losing power does not change documentary QA');
  assert.equal(entry(id).installationStatus,fit,'Losing power does not change installation status');
  for(const [otherId,otherBus] of cases)if(otherBus!==bus)
    assertState(otherId,otherBus,'NORMAL','UNRELATED BUS KEPT');
  lab.set(bus,true);
  assertState(id,bus,'NORMAL','SOURCE RESTORED');
}
for(const bus of lab.buses){
  lab.restore();
  lab.set(bus,false);
  for(const [id,feed] of cases)
    assertState(id,feed,feed===bus?'OFF':'NORMAL','SINGLE BUS '+bus);
  assert.equal(lab.snapshot().coverage.UNKNOWN,0,
    'No invented unknown state after a direct isolated bus loss');
}
lab.all(false);
for(const [id,bus] of cases)assertState(id,bus,'OFF','ALL OFF');
assert.equal(lab.snapshot().coverage.NORMAL,0);
assert.equal(lab.snapshot().coverage.UNKNOWN,0);
lab.all(true);
for(const [id,bus]of cases)assertState(id,bus,'NORMAL','ALL ON RESTORED');
assert.equal(lab.snapshot().coverage.UNKNOWN,0);
console.log('PASS ATA24: 6 interphone/optional feed rows BLUE or RED from 24 buses; document QA and optional installation preserved');
