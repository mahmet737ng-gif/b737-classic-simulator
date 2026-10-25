const assert=require('node:assert/strict');
const test=require('node:test');
const evidence=require('./native-photo-geometric-evidence-v1.json');
const baseline=require('./needle-zero-reference-stage1-v1.json');
const names=new Set(baseline.faces.map(f=>f.id));
const error=(a,b)=>Math.abs((((a-b+180)%360)+360)%360-180);
test('54 native-image gauge records, no invented certification',()=>{
 assert.equal(evidence.faces.length,54);
 assert.equal(new Set(evidence.faces.map(f=>f.id)).size,54);
 assert.deepEqual(new Set(evidence.faces.map(f=>f.id)),names);
 assert.equal(evidence.counts.fullyApproved,0);
 assert.equal(evidence.counts.initialRotaryPivotCandidates,20);
 assert.equal(evidence.counts.coarseRotaryPivotCandidates,29);
 assert.equal(evidence.counts.linearTracks,5);
 assert.equal(evidence.counts.rawLineCandidates,940);
 assert.equal(evidence.counts.photoAngleReferences,52);
 assert.equal(evidence.counts.uniquePhotoHoughCorrelations+
  evidence.counts.multiplePhotoHoughCorrelations+
  evidence.counts.unmatchedPhotoAngles,52);
 for (const face of evidence.faces){
   assert.equal(face.approval,'BLOCKED_REQUIRES_ORIGINAL_PIXEL_VISUAL_CHECK',face.id);
   assert.equal(face.pivotImageCertification,false,face.id);
   assert.match(face.source.sha256,/^[0-9a-f]{64}$/i);
   assert.ok(face.source.width>0&&face.source.height>0);
   assert.ok(Array.isArray(face.radialLinesNotSemanticallyAssigned));
   assert.ok(Array.isArray(face.photoReferenceMatches));
   if (face.pivot) {
     assert.ok(face.pivot.x>=0&&face.pivot.x<face.source.width);
     assert.ok(face.pivot.y>=0&&face.pivot.y<face.source.height);
   } else {
     assert.ok(face.linearTravelWindowCandidate,face.id);
     assert.equal(face.radialLineCandidateCount,0);
   }
   for(const a of face.photoReferenceMatches){
     assert.equal(a.sourcePhotoApproved,false,face.id);
     for(const match of a.nearbyHoughLines){
       assert.ok(match.angularErrorDeg<=2.5+1e-8,face.id);
       assert.ok(match.lengthPx>0);
       assert.ok(match.innerTipPx.length===2&&match.outerTipPx.length===2);
     }
   }
 }
});
test('Native Hough line pixel endpoints generally agree with their reported angle',()=>{
 for(const face of evidence.faces.filter(f=>f.pivot)){
  for(const s of face.radialLinesNotSemanticallyAssigned){
   const p=face.pivot;
   const cx=(s.innerPoint[0]+s.outerPoint[0])/2,cy=(s.innerPoint[1]+s.outerPoint[1])/2;
   const a=Math.atan2(cx-p.x,p.y-cy)*180/Math.PI;
   assert.ok(error(a,s.angleDeg)<3.5,face.id+' '+a+' vs '+s.angleDeg);
  }
 }
});
test('RMI and clocks remain non-certifiable from visual circle detection alone',()=>{
 for(const id of ['capt.rmi','fo.rmi','capt.clock','fo.outer_clock']){
  const x=evidence.faces.find(f=>f.id===id);
  assert.ok(x);
  assert.equal(x.approval,'BLOCKED_REQUIRES_ORIGINAL_PIXEL_VISUAL_CHECK');
 }
});
