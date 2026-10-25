'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('./cabin-dual-needles-model');
const atlas=JSON.parse(fs.readFileSync(path.join(__dirname,'../all-overhead/atlas-layout.json'),'utf8'));
const oh19=atlas.placements.find(piece=>piece.id===model.source.piece);
assert.ok(oh19);
assert.deepEqual(oh19.sourceDimensions,[model.source.width,model.source.height]);
assert.deepEqual(model.pivot,{x:489,y:365});
assert.deepEqual(model.needles.map(needle=>needle.id),['cabAlt','press']);
assert.ok(model.needles[0].tipRadius<model.needles[1].tipRadius);
assert.deepEqual(model.needles.map(needle=>needle.layer),[0,1]);
const at=model.placement(oh19);assert.ok(at.x>oh19.x&&at.x<oh19.x+oh19.w);assert.ok(at.y>oh19.y&&at.y<oh19.y+oh19.h);
assert.equal(model.angle('press',200),166);assert.equal(model.angle('cabAlt',-200),-166);
assert.throws(()=>model.angle('bad',0));assert.throws(()=>model.angle('press',NaN));
for(const needle of model.needles){
 const asset=fs.readFileSync(path.join(__dirname,needle.asset),'utf8');
 assert.match(asset,/viewBox="0 0 512 512"/);
 assert.match(asset,new RegExp(needle.id==='cabAlt'?'CAB ALT':'PRESS'));
 assert.doesNotMatch(asset,/<image/);
}
const ui=fs.readFileSync(path.join(__dirname,'cabin-dual-needles-unified.js'),'utf8');
assert.ok(ui.includes('`.atlas-piece[data-key="${model.source.piece}"]`'));
assert.ok(ui.includes('for(const needle of model.needles)'));
assert.ok(ui.includes('window.B737UnifiedCabinNeedles'));
assert.ok(ui.includes('needle.tipRadius/220'));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.ok(html.includes('cabin-dual-needles-model.js?v=CDN-0001'));
assert.ok(html.includes('cabin-dual-needles-unified.js?v=CDN-0001'));
console.log('PASS: separate OH19 CAB ALT and PRESS needles share a pivot, rotate independently, and keep CAB ALT beneath PRESS.');


const photo=require('../../engine/instruments/oh19-cab-alt-photo-anchors-v1.json');
assert.equal(photo.sourceDimensions[0],model.source.width);
assert.equal(photo.sourceDimensions[1],model.source.height);
assert.equal(photo.sourceSha256.length,64);
assert.equal(model.photoPreviewApproved,false);
assert.equal(photo.review.productionApproved,false);
assert.deepEqual(photo.marks.map(x=>x.valueFt),model.cabinAltPhotoAnchors.map(x=>x.valueFt));
for(const {valueFt,angleDeg} of photo.marks)
 assert.ok(Math.abs(model.cabinAltitudePreviewBearing(valueFt)-angleDeg)<.00001);
const expectedAngles=[
 [66,2.71+(66/500)*(13.59-2.71)],
 [3260,59.98+(260/7000)*(108.64-59.98)],
 [3963,59.98+(963/7000)*(108.64-59.98)]
];
for(const [ft,expected] of expectedAngles)
 assert.ok(Math.abs(model.cabinAltitudePreviewBearing(ft)-expected)<.00001);
assert.ok(model.cabinAltitudePreviewBearing(66)<model.cabinAltitudePreviewBearing(3260));
assert.ok(model.cabinAltitudePreviewBearing(3260)<model.cabinAltitudePreviewBearing(3963));
assert.ok(model.cabinAltitudePreviewBearing(50000)>300,'Angle must unwrap beyond 180 degrees');
assert.throws(()=>model.cabinAltitudePreviewBearing(NaN),/Invalid CAB ALT/);
assert.ok(ui.includes('state.cabAlt=model.cabinAltitudePreviewBearing(readings.cabinAltitudeFt)'));
assert.ok(ui.includes('NOT FINAL'));
