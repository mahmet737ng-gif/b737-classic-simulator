'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const evidence=read('unity/Assets/B737Classic/GuardedSwitches/Resources/GuardReferenceEvidence_20261026.json');
const bp=read('unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json');
const answer=read('engine/maps/guarded-switch-owner-hinge-quiz-v1.json');
const byId=new Map(bp.controls.map(c=>[c.controlId,c]));

test('Two owner screenshots add 14 conservative visual sightings without changing owner hinge answers',()=>{
 assert.equal(evidence.references.length,2);
 assert.equal(evidence.controls.length,14);
 assert.equal(new Set(evidence.controls.map(c=>c.controlId)).size,14);
 assert.equal(bp.controls.length,17);
 assert.equal(answer.questions.length,17);
 for(const c of bp.controls){
  const owner=answer.questions.find(x=>x.controlId===c.controlId);
  assert.equal(c.hingeDirection,owner.selection,c.controlId+' hinge');
  assert.equal(c.geometry.approvedDimensionsMm,null);
  assert.equal(c.geometry.engineUnitScaleToMm,null);
  assert.ok(c.geometry.contourProfile);
  assert.equal(c.identityContract.meshRefSameOpenClosed,true);
  assert.equal(c.identityContract.materialRefSameOpenClosed,true);
  assert.equal(c.identityContract.scaleSameOpenClosed,true);
 }
 for(const ref of evidence.controls){
  const c=byId.get(ref.controlId);
  assert.ok(c,ref.controlId);
  assert.equal(ref.screenshotSizePx[0],1920);
  assert.equal(ref.screenshotSizePx[1],1080);
  const [x,y,w,h]=ref.approximateCoverRectPx;
  assert.ok(x>=0&&y>=0&&w>0&&h>0&&x+w<=1920&&y+h<=1080,ref.controlId);
  assert.equal(ref.hingeEvidence,'NOT_DERIVED_FROM_IMAGE_USE_OWNER_QUIZ');
  assert.deepEqual(c.referenceScreenshotEvidence.approximateCoverRectPx,ref.approximateCoverRectPx);
  if(ref.visibility==='complete'&&c.geometry.coverAspectSource==='OWNER_SCREENSHOT_APPROXIMATE_ASPECT_RATIO_NOT_METRIC'){
   assert.ok(Math.abs(c.geometry.previewWidth/c.geometry.previewHeight-ref.aspectRatioApprox)<0.05,ref.controlId+' silhouette aspect');
  }
 }
 assert.deepEqual(evidence.unmatchedControlIds.sort(),
 ['bus-transfer','flight-recorder-test','gpws-terrain-inhibit'].sort());
});
test('Owner-authenticated ANTISKID black base, specular reflection, and oxygen black cover',()=>{
 const oxy=byId.get('passenger-oxygen'),anti=byId.get('antiskid');
 assert.equal(oxy.material.swatchHex,'#242426');
 assert.match(oxy.material.colorSource,/OWNER_SCREENSHOT/);
 assert.equal(anti.material.swatchHex,'#202125');
 assert.match(anti.material.colorSource,/OWNER_DIRECT_CORRECTION/);
 assert.match(anti.material.colorSource,/REFLECTION/);
 assert.equal(anti.geometry.contourProfile,'black-antiskid-inset');
 assert.equal(evidence.ownerCorrection.antiskid.includes('physically BLACK'),true);
 for(const id of ['alternate-flaps-master','generator-disconnect-1','generator-disconnect-2']){
  assert.equal(byId.get(id).geometry.contourProfile,'red-tapered-long-cap');
 }
});
test('Owner correction: three separate GPWS covers exactly the same geometry and base material',()=>{
 const ids=['gpws-flap-inhibit','gpws-gear-inhibit','gpws-terrain-inhibit'];
 const three=ids.map(id=>byId.get(id));
 assert.equal(new Set(three.map(x=>x.controlId)).size,3);
 assert.equal(evidence.gpwsAssembly.physicalCoverCount,3);
 assert.equal(evidence.gpwsAssembly.allIndependent,true);
 assert.equal(evidence.gpwsAssembly.allSamePhysicalShapeAndSize,true);
 const shape=x=>JSON.stringify([x.geometry.previewWidth,x.geometry.previewHeight,x.geometry.previewThickness,x.geometry.previewCornerRadius,x.geometry.contourProfile]);
 const appearance=x=>JSON.stringify([x.material.swatchHex,x.material.metallic,x.material.roughness]);
 assert.equal(new Set(three.map(shape)).size,1);
 assert.equal(new Set(three.map(appearance)).size,1);
 assert.equal(new Set(three.map(x=>x.material.materialIdentity)).size,3);
 assert.equal(new Set(three.map(x=>x.identityContract.coverGeometrySource)).size,3);
 for(const c of three){
  assert.equal(c.hingeDirection,'Up');
  assert.equal(c.geometry.contourProfile,'gpws-three-identical');
  assert.equal(c.material.swatchHex,'#202125');
  assert.equal(c.hardwareGrouping.physicalCoverCount,3);
  assert.equal(c.hardwareGrouping.independentCovers,true);
  assert.equal(c.hardwareGrouping.identicalShapeAndSize,true);
  assert.equal(c.hardwareGrouping.identicalBaseMaterial,true);
  assert.equal(c.hardwareGrouping.assemblyId,'gpws-three-individual-equal-covers');
  assert.equal(c.hardwareGrouping.calibratedSocketStatus,'PENDING_DISTINCT_SOURCE_SOCKET_MEASUREMENTS');
  assert.equal(c.geometry.approvedDimensionsMm,null);
 }
 for(const id of ids.slice(0,2)){
  const e=evidence.controls.find(x=>x.controlId===id);
  assert.equal(e.regionMeaning,'PARTIAL_SHARED_PANEL_VIEW_NOT_INDIVIDUAL_GUARD_BOUNDS');
  assert.equal(e.individualCoverBoundsConfirmed,false);
 }
 assert.ok(!JSON.stringify(three).includes('gpws-flap-gear-combined'));
});
test('Changed contour is manufactured exactly once; opening only rotates fixed pivot and never replaces mesh',()=>{
 const mesh=fs.readFileSync(path.join(root,'unity/Assets/B737Classic/GuardedSwitches/Runtime/GuardCoverMesh.cs'),'utf8');
 const factory=fs.readFileSync(path.join(root,'unity/Assets/B737Classic/GuardedSwitches/Runtime/GuardSwitchFactory.cs'),'utf8');
 const animator=fs.readFileSync(path.join(root,'unity/Assets/B737Classic/GuardedSwitches/Runtime/GuardSwitchView.cs'),'utf8');
 assert.ok(mesh.includes('contourProfile == "red-tapered-long-cap"'));
 assert.ok(mesh.includes('contourProfile == "black-shouldered-cap"'));
 assert.ok(mesh.includes('contourProfile == "black-antiskid-inset"'));
 assert.ok(mesh.includes('contourProfile == "gpws-three-identical"'));
 assert.ok(!mesh.includes('silver-satin-inset'));
 assert.ok(factory.includes('g.previewThickness, g.previewCornerRadius, g.contourProfile'));
 assert.ok(animator.includes('_pivot.localRotation = Quaternion.SlerpUnclamped'));
 assert.ok(animator.includes('_filter.sharedMesh == _lockedMesh'));
 assert.ok(animator.includes('_renderer.sharedMaterial == _lockedMaterial'));
 assert.ok(animator.includes('_lockedMaterial.color == _lockedColor'));
 assert.ok(animator.includes('_cover.localScale == _lockedScale'));
});
