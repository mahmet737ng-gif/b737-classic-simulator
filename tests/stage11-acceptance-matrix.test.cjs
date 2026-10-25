'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const m=require('../engine/instruments/stage11-acceptance-matrix-v1.json');
const review=require('../engine/instruments/stage34-native/qa-review-queue-v1.json');
const sources=require('../engine/instruments/stage8-signal-contracts-v1.json');
const routes=require('../engine/instruments/stage8-pointer-routing-v1.json');
const owners=require('../engine/instruments/stage6-needle-fit-candidates-v1.json');
test('54 faces each retain source-proven photo geometry blockers and distinct band contexts',()=>{
 assert.equal(m.faces.length,54);
 assert.equal(new Set(m.faces.map(x=>x.id)).size,54);
 assert.deepEqual(new Set(m.faces.map(x=>x.id)),new Set(review.faces.map(x=>x.id)));
 assert.equal(m.counts.rotary,49);
 assert.equal(m.counts.linear,5);
 assert.equal(m.counts.highRisk,15);
 assert.equal(m.counts.missingVersionControlledImageSourceFaces,0);
 assert.equal(m.counts.rootStoredPhotoSourceFaces,3);
 assert.equal(m.sourceDiscovery.status,'REPOSITORY_ROOT_SHA256_AND_1123X1400_DIMENSIONS_VERIFIED');
 assert.equal(m.counts.mediumRisk,14);
 assert.equal(m.counts.normalRisk,25);
 assert.equal(m.counts.finalGeometricCalibration,0);
 assert.equal(m.counts.operationalNeedlesReleased,0);
 for(const f of m.faces){
  assert.equal(f.stage11.isReleased,false);
  assert.equal(f.stage11.actualVisualFlightTestAccepted,false);
  assert.equal(f.nativeGeometry.pivotCertified,false);
  assert.equal(f.nativeGeometry.allTicksCertified,false);
  assert.ok(f.blockingReasons.length);
  assert.ok(f.sourceOriginal.endsWith('.png')||f.sourceOriginal.endsWith('.webp'),f.id);
  if(!f.sourceOriginal.startsWith('panel-mosaic-lab/')){
   assert.equal(f.originalImageRepositoryStatus,'REPOSITORY_ROOT_ASSET_SHA256_AND_DIMENSIONS_VERIFIED');
   assert.ok(f.blockingReasons.includes('original_photo_present_but_dial_geometry_not_certified'));
   assert.ok(!f.blockingReasons.includes('original_source_not_in_versioned_repository'));
  }
  assert.deepEqual(f.systemChannels.map(x=>x.id),sources.faces[f.id].channels.map(x=>x.id));
  for(const s of f.numericScales)assert.equal(s.minorGraduationsCertified,false);
  for(const p of f.pointers){
   assert.equal(p.angleOffsetAccepted,false);
   assert.equal(p.geometryAccepted,false);
  }
 }
});
test('No electrical feed or per-pointer source is misreported as flight-circuit certified',()=>{
 assert.equal(m.counts.unapprovedSourceFeeds,62);
 assert.equal(m.counts.unknownPerGaugeElectricalFeeds,54);
 assert.equal(m.counts.sourceProviderMappedChannels,23);
 assert.equal(m.counts.unmappedSourceChannels,39);
 assert.equal(sources.verifiedPerInstrumentElectricalPowerFeeds,0);
 assert.equal(sources.activation,'BLOCKED');
 assert.equal(routes.counts.liveApproved,0);
 assert.equal(m.counts.logicalNeedles,owners.pointers.length);
 const p=m.faces.flatMap(f=>f.pointers);
 assert.equal(p.length,38);
 assert.deepEqual(new Set(p.map(x=>x.pointerId)),new Set(owners.pointers.map(x=>x.ownerSpriteId)));
});
test('Photo-review and flight-QA gaps cannot be promoted via scenario success',()=>{
 assert.equal(m.scenarioObservationsAreTrainingOnly,true);
 assert.equal(m.originalArtworkKeptImmutable,true);
 assert.equal(m.counts.sceneExamples,12);
 assert.equal(m.counts.scenarioAssertions,10);
 assert.ok(m.stage11Disposition.includes('RELEASE_BLOCKED'));
 assert.equal(m.counts.withCandidateNumericPreview,6);
 for(const f of m.faces)assert.equal(f.acceptance,
  'BLOCKED_AWAITING_FULL_NATIVE_GEOMETRY_SYSTEM_WIRING_AND_VISUAL_FLIGHT_QA');
});
