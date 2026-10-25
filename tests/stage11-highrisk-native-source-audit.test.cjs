'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const ledger=require('../engine/instruments/stage11-highrisk-native-review-v2.json');
const stage11=require('../engine/instruments/stage11-acceptance-matrix-v1.json');
const stage34=require('../engine/instruments/stage34-native/qa-review-queue-v1.json');
const stage5=require('../engine/instruments/stage5-numeric-scale-candidates-v1.json');
const stage6=require('../engine/instruments/stage6-needle-fit-candidates-v1.json');
test('Fifteen high-priority original-image risk decisions cover exact stage11 priority queue',()=>{
 assert.equal(ledger.faces.length,15);
 assert.deepEqual(new Set(ledger.faces.map(f=>f.id)),
  new Set(stage34.faces.filter(f=>f.priority==='high').map(f=>f.id)));
 assert.equal(ledger.counts.mechanicalPivotCertified,0);
 assert.equal(ledger.counts.scaleLinesCertified,0);
 assert.equal(stage11.counts.finalGeometricCalibration,0);
 for(const face of ledger.faces){
  assert.match(face.sourceSha256,/^[0-9a-f]{64}$/);
  assert.ok(face.sourceAsset);
  assert.ok(face.specificVisualFinding.length>20);
  assert.equal(face.shaftApproved,false);
  assert.equal(face.majorMinorScaleApproved,false);
  assert.equal(face.releasedInUnified,false);
 }
});
test('Incorrect historical OH10 pivot assumptions are specifically quarantined',()=>{
 const dc=ledger.faces.find(f=>f.id==='oh.elec.dc_amps');
 const cps=ledger.faces.find(f=>f.id==='oh.elec.cps');
 assert.deepEqual(dc.rejectedPriorOverlay,{x:310,y:168});
 assert.deepEqual(dc.preferredProvisional,{x:310,y:192});
 assert.deepEqual(cps.rejectedPriorOverlay,{x:715,y:190});
 assert.deepEqual(cps.preferredProvisional,{x:780,y:192});
 assert.equal(ledger.counts.historicalOverlayPivotsQuarantined,2);
 const actualStage11=new Map(stage11.faces.map(f=>[f.id,f]));
 assert.deepEqual(actualStage11.get('oh.elec.dc_amps').sourcePivotCandidate.x,310);
 assert.deepEqual(actualStage11.get('oh.elec.cps').sourcePivotCandidate.x,780);
});
test('RMI shell circle not promoted and rejected right-trim box must remain fail-closed',()=>{
 const rmi=ledger.faces.find(x=>x.id==='capt.rmi');
 const trim=ledger.faces.find(x=>x.id==='ped.stab_trim.right');
 assert.equal(rmi.rejectedCaseCircleAsShaft,true);
 assert.equal(trim.reason,'OLD_RIGHT_STAB_TRIM_BOX_EXCLUDES_SCALE_TRACK');
 assert.equal(trim.rejectedWindow.x0,961);
 assert.equal(trim.rejectedWindow.x1,1063);
 assert.deepEqual([trim.provisionalReplacementWindow.x0,trim.provisionalReplacementWindow.x1],[895,998]);
 assert.deepEqual([trim.provisionalReplacementWindow.y0,trim.provisionalReplacementWindow.y1],[609,965]);
 assert.equal(trim.provisionalReplacementWindow.previousRoiRawTransverseCount,0);
 assert.equal(trim.provisionalReplacementWindow.proposedRoiRawHorizontalCount,5);
 assert.match(trim.provisionalReplacementWindow.geometryStatus,/UNVERIFIED/);
 assert.equal(ledger.counts.alternativeRightTrimWindowWithFiveCandidates,1);
 assert.equal(stage6.counts.finalApprovedNeedleFits,0);
 assert.equal(stage5.counts.liveApprovedFaces,0);
});
test('Three FO outer instrument photos are SHA-256 and pixel-size verified in repository root',()=>{
 assert.equal(stage11.counts.missingVersionControlledImageSourceFaces,0);
 assert.equal(stage11.counts.rootStoredPhotoSourceFaces,3);
 assert.equal(ledger.counts.versionedFOImageSourcePathsResolved,3);
 assert.equal(stage11.sourceDiscovery.nativeWidthPx,1123);
 assert.equal(stage11.sourceDiscovery.nativeHeightPx,1400);
 assert.equal(stage11.sourceDiscovery.expectedSha256,
  'b2439666f75ddbcab15835b532d26a7ad2d1ab669be5f48774d656c1b8915a3c');
 for(const id of stage11.sourceDiscovery.affectedFaces){
  const f=stage11.faces.find(x=>x.id===id);
  assert.equal(f.originalImageRepositoryStatus,'REPOSITORY_ROOT_ASSET_SHA256_AND_DIMENSIONS_VERIFIED');
  assert.equal(f.stage11.isReleased,false);
 }
});
