'use strict';
/* Strong evidence gate: 19 additional native-photo four-sided glass geometry matches.
 * Original sourceRect and photographed pixels are kept immutable.
 */
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=__dirname,read=p=>JSON.parse(fs.readFileSync(path.resolve(root,p),'utf8'));
const v3=read('photo-pixel-registration-v3.json');
const v2=read('photo-pixel-registration-v2.json');
const old=new Map(v2.records.map(x=>[x.id,x]));
const oh=read('../interactive-overhead/lights.json'),main=read('../cockpit/lights.json');
const live=new Map([...oh.lights,...main.lights].map(x=>[x.id,x]));
const finalCorrections=read('photo-position-corrections-v2.json');
const latest=new Map(finalCorrections.records.map(c=>[c.id,c.newSourceRect]));
assert.equal(latest.size,1);
assert.equal(v3.summary.mounted,142);
assert.equal(v3.records.length,142);
assert.equal(v3.summary.priorPixelApproved,120);
assert.equal(v3.summary.thirdScanlineApproved,19);
assert.equal(v3.summary.totalPixelApproved,139);
assert.equal(v3.summary.remainingPixelUnresolved,3);
assert.equal(v3.summary.sourceRectChangesByScanline,0);
assert.equal(v3.summary.sourcePhotosChanged,0);
let prior=0,scan=0,pending=0;
for(const row of v3.records){
 const baseline=old.get(row.id),lamp=live.get(row.id);
 assert.ok(lamp&&baseline,row.id);
 assert.deepEqual(row.currentSourceRect,baseline.currentSourceRect,row.id+' photo baseline preserved');
 assert.deepEqual(lamp.sourceRect,latest.get(row.id)||row.currentSourceRect,row.id+' source position not corrupted');
 if(row.status==='AUTO_PIXEL_CENTRE_MATCH_3PX'){
  assert.equal(row.verifiedStatus,'AUTO_PIXEL_CENTRE_MATCH_3PX');prior++;continue;
 }
 if(row.verifiedStatus==='SCANLINE_PIXEL_CENTRE_MATCH_3PX'){
  assert.equal(row.verificationMethod,'PHOTO_INDEPENDENT_FOUR_EDGE_SCANLINE');
  const p=row.scanlineEvidence;
  assert.equal(p.status,'SCANLINE_CENTRE_CANDIDATE');
  assert.ok(Array.isArray(p.centreDeviationSourcePx)&&p.centreDeviationSourcePx.length===2);
  assert.ok(p.centreDeviationSourcePx.every(x=>Math.abs(x)<=3),row.id+' centre tolerance');
  assert.ok(p.apertureWidthDeltaPx!==null && Math.abs(p.apertureWidthDeltaPx)<=24);
  assert.ok(p.apertureHeightDeltaPx!==null && Math.abs(p.apertureHeightDeltaPx)<=16);
  for(const k of ['left','right','top','bottom']){
   assert.ok(p.detectedSides?.[k]?.strength>=7,row.id+' '+k+' missing strong native-pixel edge');
  }
  scan++;continue;
 }
 assert.equal(row.verifiedStatus,'PHOTO_ENLARGED_REVIEWED_PIXEL_PRECISION_OPEN');
 pending++;
}
assert.deepEqual(v3.remaining.map(r=>r.id).sort(),['flight-recorder-off','fuel-1-aft','main-pull-up-captain'].sort());
assert.equal(prior,120);
assert.equal(scan,19);
assert.equal(pending,3);
console.log('PASS: 142 source-photo lens positions, 139 independent <=3px four-edge/region confirmations, 3 unresolved with no invented geometry.');
