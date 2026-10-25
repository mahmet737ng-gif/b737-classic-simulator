const test=require('node:test');const assert=require('node:assert/strict');
const r=require('../engine/instruments/stage11-highrisk-native-review-v2.json');
const m=require('../engine/instruments/stage11-acceptance-matrix-v1.json');
test('15 high-risk photo records have immutable sources and no approval promotion',()=>{
 assert.equal(r.faces.length,15);
 assert.equal(new Set(r.faces.map(x=>x.id)).size,15);
 assert.equal(r.counts.mechanicalPivotCertified,0);
 assert.equal(r.counts.scaleLinesCertified,0);
 assert.equal(r.counts.versionedFOImageSourcePathsResolved,3);
 for(const face of r.faces){
  assert.equal(face.shaftApproved,false);
  assert.equal(face.majorMinorScaleApproved,false);
  assert.equal(face.releasedInUnified,false);
  assert.match(face.sourceSha256,/^[a-f0-9]{64}$/);
  assert.ok(face.specificVisualFinding.length>35);
  assert.equal(m.faces.find(x=>x.id===face.id).priority,'high');
 }
});
test('Historical CPS/DC AMPS centers are quarantined, RMI case center is not shaft',()=>{
 const dc=r.faces.find(x=>x.id==='oh.elec.dc_amps');
 const cps=r.faces.find(x=>x.id==='oh.elec.cps');
 assert.deepEqual(dc.rejectedPriorOverlay,{x:310,y:168});
 assert.deepEqual(dc.preferredProvisional,{x:310,y:192});
 assert.deepEqual(cps.rejectedPriorOverlay,{x:715,y:190});
 assert.deepEqual(cps.preferredProvisional,{x:780,y:192});
 assert.equal(r.faces.find(x=>x.id==='capt.rmi').rejectedCaseCircleAsShaft,true);
 const trim=r.faces.find(x=>x.id==='ped.stab_trim.right');
 assert.deepEqual(trim.rejectedWindow,{x0:961,y0:609,x1:1063,y1:965});
 assert.equal(trim.preferredProvisional,null);
});
test('Three FO image files have verified source path but unapproved geometry',()=>{
 assert.equal(m.sourceDiscovery.status,'REPOSITORY_ROOT_SHA256_AND_1123X1400_DIMENSIONS_VERIFIED');
 for(const id of ['fo.outer_altimeter','fo.outer_vertical_speed','fo.outer_clock']){
  const face=m.faces.find(x=>x.id===id);
  assert.equal(face.originalImageRepositoryStatus,'REPOSITORY_ROOT_ASSET_SHA256_AND_DIMENSIONS_VERIFIED');
  assert.equal(face.nativeGeometry.pivotCertified,false);
 }
 assert.equal(m.counts.operationalNeedlesReleased,0);
});
