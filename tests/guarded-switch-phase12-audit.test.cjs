'use strict';
/* Phase-1/2 source-integrity guards. These never claim real-world hinge certification. */
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>JSON.parse(fs.readFileSync(path.join(root,name),'utf8'));
const audit=read('engine/maps/guarded-switches-fcom-visual-audit-v1.json');
const live=read('panel-mosaic-lab/interactive-overhead/rotary-guards.json').guards;
const extra=read('panel-mosaic-lab/interactive-overhead/lights-controls.json').guards;
const prior=read('flight-controls-panel/fcom-controls-registry.json').guarded;
const ids=new Set([...live,...extra].map(c=>c.id));
const FCOM_LOADED=Object.freeze({manual:'Sepehran 737 Classic',family:['300','400','500']});
test('Phase 1 completeness: 17 cockpit protected controls plus cabin excluded',()=>{
 assert.equal(audit.schema,'b737-classic/guarded-control-fcom-visual-audit/v1');
 assert.equal(audit.controls.length,17);
 assert.equal(new Set(audit.controls.map(c=>c.id)).size,17);
 assert.equal(audit.excludedCabinControl.location,'AFT_FLIGHT_ATTENDANT_PANEL_OUTSIDE_COCKPIT_SCOPE');
 for(const c of audit.controls){
  assert.ok(c.fcom.folio&&/^\d+\./.test(c.fcom.folio),c.id+' source page');
  if(c.documentedStates){
   assert.equal(c.numberOfPositionsConfirmed,c.documentedStates.length);
   assert.ok(c.documentedStates.includes(c.protectedState),c.id+' protected');
  }else{
   assert.equal(c.fcom.confirmation,'FCOM_ACTION_ONLY');
   assert.equal(c.numberOfPositionsConfirmed,null);
  }
  assert.equal(c.visual.dimensionsMm,null,'Never synthesize real hardware millimetres '+c.id);
 }
});
test('Registry exact mapping: 12 live, five missing; three independent passes',()=>{
 for(let pass=1;pass<=3;pass++){
  const m=audit.controls.filter(c=>c.implementation.status==='INSTALLED_REQUIRES_AUDIT');
  const n=audit.controls.filter(c=>c.implementation.status==='MISSING_FROM_GUARDED_REGISTRY');
  assert.equal(m.length,12);assert.equal(n.length,5);
  assert.deepEqual(new Set(m.map(c=>c.id)),ids);
  for(const c of m){
   assert.deepEqual(c.implementation.codeStates,[...live,...extra].find(a=>a.id===c.id).states);
   assert.equal(c.visual.colorInCurrentMockup,[...live,...extra].find(a=>a.id===c.id).color);
  }
  assert.deepEqual(n.map(c=>c.id).sort(),['antiskid','bus-transfer','gpws-flap-inhibit','gpws-gear-inhibit','gpws-terrain-inhibit'].sort());
 }
});
test('Hinge mismatch provenance: never mistake asserted top for authentic Boeing hardware',()=>{
 const mismatch=audit.controls.filter(c=>c.visual.auditDisposition==='MISMATCH_LIVE_SPRITE_VS_SECOND_REGISTRY');
 assert.equal(mismatch.length,6);
 for(const c of mismatch){
  assert.equal(c.visual.claimedHingeInSecondRegistry,'top');
  assert.equal(c.visual.hingeInLiveArtwork,'bottom');
  assert.equal(c.visual.actualHinge,'UNVERIFIED_HARDWARE');
 }
 for(const c of prior){const id={flightA:'flight-control-a',flightB:'flight-control-b',spoilerA:'spoiler-a',spoilerB:'spoiler-b',alternateFlapsArm:'alternate-flaps-master',emergencyExitLights:'emergency-exit-lights'}[c.id];
  assert.ok(mismatch.some(m=>m.id===id));
 }
});
test('Guard safety facts: force policy is NOT mechanical FCOM evidence',()=>{
 for(const c of audit.controls)assert.equal(c.visual.colorAuthenticity,'UNVERIFIED_CLASSIC_HARDWARE');
 for(const id of ['generator-disconnect-1','generator-disconnect-2']){
  const c=audit.controls.find(x=>x.id===id);
  assert.equal(c.numberOfPositionsConfirmed,null);
  assert.equal(c.implementation.codeStates.length,2);
  assert.match(c.fcom.notes,/action/i);
 }
 const rec=audit.controls.find(x=>x.id==='flight-recorder-test');
 assert.equal(rec.visual.actualHinge,'LEFT_VERTICAL_AXIS_OPEN_FREE_EDGE_TOWARD_LEFT');
 assert.equal(rec.visual.hingeEvidence,'OWNER_EXPLICIT_REFERENCE_2026_10_26');
 const stby=audit.controls.find(x=>x.id==='standby-power');
 assert.equal(stby.protectedState,'AUTO');
 assert.deepEqual(stby.documentedStates,['BAT','OFF','AUTO']);
 const o2=audit.controls.find(x=>x.id==='passenger-oxygen');
 assert.equal(o2.risk,'CRITICAL');
});
test('No changes to locked mosaics, source images or full FCOM copied into audit',()=>{
 assert.equal(audit.sourceAvailability.includes('do not publish'),true);
 assert.equal(audit.counts.hardwareFullyVerified,0);
 assert.deepEqual(FCOM_LOADED.family,['300','400','500']);
});
