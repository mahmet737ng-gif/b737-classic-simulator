'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {build}=require('./oh19-photo-evidence-v2.js');
const ticks=require('./oh19-native-ticks-batch1.json');
const photo=require('./oh19-cab-alt-photo-anchors-v1.json');
const preview=require('./stage10-preview-scale-subset-v1.json');
const fresh=()=>JSON.parse(JSON.stringify({ticks,photo,preview}));
test('OH19 photo evidence keeps the 47/51 rings and shaft explicitly uncertified',()=>{
 const a=build({ticks,photo,preview});
 assert.equal(a.counts.inner,47);
 assert.equal(a.counts.outer,51);
 assert.equal(a.counts.operationalApproved,0);
 assert.equal(a.pivotCandidate.certified,false);
 assert.equal(a.sourceImageInspectedThisRun,false);
 assert.equal(a.originalArtworkModified,false);
 assert.equal(a.releaseState,'BLOCKED_PIXEL_SHAFT_AND_EVERY_MINOR_TICK_VALUE_PENDING');
 assert.ok(a.inner.every(t=>t.physicalTipApproved===false&&t.numericValueApproved===false));
 assert.ok(a.outer.every(t=>t.physicalTipApproved===false&&t.numericValueApproved===false));
});
test('OH19 separates 15 candidate photo value anchors from 32 unclassified minors',()=>{
 const a=build({ticks,photo,preview});
 assert.equal(a.counts.innerPreviewAnchors,15);
 assert.equal(a.counts.innerUnclassifiedMinorValues,32);
 assert.deepEqual(a.inner.filter(t=>t.anchorPreviewValueFt!==null).map(t=>t.anchorPreviewValueFt),
    [0,500,1000,1500,2000,2500,3000,10000,15000,20000,
     25000,30000,35000,40000,50000]);
 assert.equal(a.inner[7].anchorPreviewValueFt,null);
 assert.equal(a.inner[7].class,'UNKNOWN_MINOR_VALUE');
 assert.equal(a.inner[7].shouldIgnoreInferredLegacyValue,true);
 assert.equal(a.inner[18].anchorPreviewValueFt,null);
 assert.ok(a.outer.every(t=>t.numericValueApproved===false));
});
test('OH19 freezes image checksum, shaft estimate, native pixel endpoints and no promotion',()=>{
 const a=fresh();a.ticks.source.sha256='0'.repeat(64);
 assert.throws(()=>build(a),/source SHA disagreement/);
 const b=fresh();b.photo.pivot.x+=1;
 assert.throws(()=>build(b),/candidate centre disagreement/);
 const c=fresh();c.ticks.scales[0].allVisibleTickCandidates[0].tipCandidate.x+=5;
 assert.throws(()=>build(c),/reconstructed tip disagrees/);
 const d=fresh();d.preview.calibrations['oh.cabin.diff_pressure_altitude:cabinAltitude'].approval.shaftPivotPhotoReviewed=true;
 assert.throws(()=>build(d),/unexpected production approval/);
});
test('OH19 checks every registered endpoint falls inside the true-size photo',()=>{
 const a=build({ticks,photo,preview});
 const pts=[...a.inner,...a.outer];
 assert.equal(pts.length,98);
 for(const t of pts){
  assert.ok(Math.abs(t.radiusResidualPx)<.025);
  assert.ok(t.bearingResidualDeg<.025);
  assert.ok(t.point.x>=0&&t.point.x<a.source.width);
  assert.ok(t.point.y>=0&&t.point.y<a.source.height);
 }
});
