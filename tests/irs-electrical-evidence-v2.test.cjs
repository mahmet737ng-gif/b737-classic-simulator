'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Power=require('../engine/systems/irs-electrical-evidence-v2.js');
const Core=require('../engine/systems/irs-trainer-core-v1.cjs');
const Electrical=require('../engine/systems/electrical-v7.js');
const root=path.join(__dirname,'..');
const V7=(acStandby,transfer2,switchedHotBattery)=>({
 schema:'B737_ELECTRICAL_V7_RESULT',
 bus:{acStandby,transfer2,switchedHotBattery}
});
const normal=Electrical.evaluate(Electrical.initialState());
assert.equal(normal.schema,'B737_ELECTRICAL_V7_RESULT');
const ready=Core.initialState();
const core=Core.apply(Core.apply(ready,{type:'POWER',side:'L',available:true}),{type:'SELECT_MODE',side:'L',mode:'NAV'});
const modes={L:'NAV',R:'NAV'};
let out=Power.evaluate(Power.initialState(),{electrical:normal,modes,
 unitStates:{L:Core.status(core,'L'),R:{phase:'OFF'}},dtSec:1});
assert.equal(out.units.L.powered,true);
assert.equal(out.units.L.normalBus,'AC_STANDBY');
assert.equal(out.units.L.onDcLamp,true,'ON DC self test remains visible for startup cue');
assert.equal(out.units.L.dcFailLamp,false);
assert.equal(out.units.R.source,'AC_TRANSFER_2');
assert.equal(out.rightBackupElapsedSec,0);
assert.deepEqual(modes,{L:'NAV',R:'NAV'},'Selectors are read-only');
assert.equal(out.diagnostics.geometryModified,false);
let unknown=Power.evaluate(Power.initialState(),{modes});
assert.equal(unknown.units.L.powered,null,'Missing V7 bus must fail closed');
assert.equal(unknown.units.R.onDcLamp,null,'No invented annunciator on unknown feed');
assert.equal(unknown.units.L.dcFailLamp,null);
unknown=Power.evaluate(unknown.state,{electrical:V7(undefined,false,true),modes,dtSec:5});
assert.equal(unknown.units.L.powered,null,'Unknown AC with known DC does not prove feed');
assert.equal(unknown.units.R.powered,true);
assert.equal(unknown.rightBackupElapsedSec,5);
const backup=V7(true,false,true);
const baseline=JSON.stringify(backup);
let session=Power.initialState();
for(let i=0;i<59;i++){
 out=Power.evaluate(session,{electrical:backup,modes,dtSec:5,
  unitStates:{R:{phase:'NAV_READY',faultLamp:false}}});
 session=out.state;
 assert.equal(out.units.R.powered,true,'R cutoff must not trip before exactly 300 seconds');
 assert.equal(out.units.R.onDcLamp,true,'ON DC illuminates on R backup');
 assert.equal(out.units.R.dcFailLamp,false);
 assert.equal(out.units.L.onDcLamp,false,'Left normal AC is not on DC');
 assert.equal(out.units.L.powered,true);
}
assert.equal(out.rightBackupElapsedSec,295);
out=Power.evaluate(session,{electrical:backup,modes,dtSec:5});
assert.equal(out.units.R.powered,false,'Exactly 300 seconds of R backup expires');
assert.equal(out.units.R.reason,'RIGHT_DC_300_SECOND_CUTOFF');
assert.equal(out.units.R.onDcLamp,false,'Unpowered lamp cannot stay illuminated');
assert.equal(out.units.L.powered,true);
session=out.state;
out=Power.evaluate(session,{electrical:V7(true,true,true),modes,dtSec:1});
assert.equal(out.units.R.powered,true,'Normal AC recovery restores R feed');
assert.equal(out.units.R.source,'AC_TRANSFER_2');
assert.equal(out.rightBackupElapsedSec,0,'Restored AC resets DC backup elapsed');
out=Power.evaluate(out.state,{electrical:backup,modes,dtSec:2});
assert.equal(out.rightBackupElapsedSec,2,'New backup interval starts fresh');
const leftDc=V7(false,true,true);
for(let i=0;i<65;i++)out=Power.evaluate(out.state,{electrical:leftDc,modes,dtSec:5});
assert.equal(out.units.L.powered,true,'Left DC backup not subject to right 5min cutoff');
assert.equal(out.units.L.onDcLamp,true);
assert.equal(out.units.R.powered,true);
const failDc=Power.evaluate(out.state,{electrical:V7(true,true,false),modes,dtSec:1});
assert.equal(failDc.units.L.dcFailLamp,true);
assert.equal(failDc.units.R.dcFailLamp,true);
assert.match(failDc.units.L.lampConfidence.dcFail,/PROVISIONAL/);
assert.equal(failDc.units.L.powered,true,'DC feed failure not AC whole-unit failure');
const noFeed=Power.evaluate(failDc.state,{electrical:V7(false,true,false),modes});
assert.equal(noFeed.units.L.powered,false);
assert.equal(noFeed.units.L.dcFailLamp,false,'Dark whole unit is not a lit failure indicator');
assert.equal(noFeed.units.R.powered,true);
const cb=Power.evaluate(noFeed.state,{electrical:V7(true,true,true),modes,dtSec:0,
 cbEvidence:{'P6-1|ALL|A1':{pulled:true,label:'UNPROVEN IRS'}}});
assert.equal(cb.units.L.powered,true,'Undocumented CB cannot de-energize IRS');
assert.equal(cb.units.L.circuitBreakerStatus,'CB_PRESENT_BUT_EQUIPMENT_ROUTE_UNVERIFIED');
assert.equal(cb.units.L.isolationApplied,false);
assert.equal(cb.diagnostics.cbCoverage,'NO_VERIFIED_IRS_CB_ASSIGNMENTS');
const off=Power.evaluate(cb.state,{electrical:backup,modes:{L:'OFF',R:'OFF'},dtSec:5});
assert.equal(off.units.L.powered,false);
assert.equal(off.units.R.powered,false);
assert.equal(off.rightBackupElapsedSec,0);
assert.equal(off.units.L.onDcLamp,false);
assert.equal(JSON.stringify(backup),baseline,'Power projection may not rewrite upstream electrical buses');
assert.throws(()=>Power.evaluate(Power.initialState(),{electrical:{bus:{acStandby:true}},modes}),/V7/);
assert.throws(()=>Power.evaluate(Power.initialState(),{electrical:normal,modes,dtSec:200}),/0 and 5/);
assert.throws(()=>Power.evaluate(Power.initialState(),{electrical:normal,modes:{L:'NAV',R:'CRUISE'}}),/IRS MODE/);
// Model proof: owners' 93 frozen IRS front-end files and lock snapshots are
// deliberately not modified by this backend-only set of changes.
const frozen=JSON.parse(fs.readFileSync(path.join(root,'panel-mosaic-lab/cockpit/irs-complete-redzone-lock-v1.json'),'utf8'));
assert.equal(frozen.status,'FINAL_FROZEN_RED_ZONE');
assert.equal(Object.keys(frozen.protectedBlobs).length,93);
const cbBridge=fs.readFileSync(path.join(root,'engine/cb/electrical-v7-integration.js'),'utf8');
assert(!/load:\s*["']irs[.]/i.test(cbBridge),'MRG circuit->IRS route must not be guessed');
console.log('PASS IRS electrical evidence: AC standby/transfer2, independent L/R DC, startup cue, 300s R cutoff, DC FAIL training gate, unknown fail-closed, unknown CB quarantine and owner lock');
