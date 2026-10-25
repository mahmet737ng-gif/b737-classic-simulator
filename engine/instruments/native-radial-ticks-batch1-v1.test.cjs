'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const r=require('./native-radial-ticks-batch1-v1.json');
test('OH09/OH20/OH21 candidate radial strokes have immutable-source provenance',()=>{
 assert.equal(r.faces.length,3);assert.equal(r.count.totalStrokeCandidates,152);
 for(const f of r.faces){
  assert.match(f.sourceSha256,/^[0-9a-f]{64}$/);
  assert.equal(f.approved,false);
  assert.equal(f.hasAllStrokesPhotoVerified,false);
  let past=-Infinity;
  for(const t of f.strokeCandidates){
   assert.ok(t.angleDeg>past);past=t.angleDeg;
   assert.equal(t.approved,false);
   assert.ok(t.innerPoint.x>=0&&t.innerPoint.x<f.sourceSize[0],f.id);
   assert.ok(t.innerPoint.y>=0&&t.innerPoint.y<f.sourceSize[1],f.id);
   const dx=t.innerPoint.x-f.pivotCandidate.x,dy=t.innerPoint.y-f.pivotCandidate.y;
   const r2=Math.hypot(dx,dy);
   assert.ok(Math.abs(r2-t.candidateInnerRadiusPx)<.03,f.id+' '+t.id);
  }
  assert.equal(f.strokeCandidates.filter(t=>t.majorNumber!==null).length,f.majorReferenceAngles.length);
  for(const major of f.strokeCandidates.filter(t=>t.majorNumber!==null))
   assert.ok(major.anchorDisagreementDeg<=1.7);
 }
});
test('Cold-dark numeric 0 cannot be inferred from all dial zero-labels',()=>{
 const fuel=r.faces.find(f=>f.id==='oh.fuel.temperature');
 assert.equal(fuel.strokeCandidates.length,49);
 assert.ok(fuel.strokeCandidates[0].majorNumber===null);
 assert.ok(fuel.strokeCandidates.at(-1).majorNumber===null);
 const cab=r.faces.find(f=>f.id==='oh.cabin.temperature');
 assert.equal(cab.strokeCandidates.length,51);
 const duct=r.faces.find(f=>f.id==='oh.duct.pressure_lr');
 assert.equal(duct.strokeCandidates.length,52);
 assert.ok(duct.strokeCandidates.some(t=>t.numberingStatus==='provisional_unlabeled_zero_stroke'));
});
