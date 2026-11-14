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
// Physical stack (rear->front) differs from printed radial scale assignment.
assert.deepEqual(model.needles.map(needle=>needle.id),['press','cabAlt']);
assert.deepEqual(model.needles.map(needle=>needle.layer),[0,1]);
assert.deepEqual(model.needles.map(needle=>needle.stack),['rear','front']);
assert.deepEqual(model.needles.map(needle=>needle.printedScale),['outer','inner']);
assert.deepEqual(model.needles.map(needle=>needle.valueSource),['differentialPsid','cabinAltitudeFt']);
assert.ok(model.needles.find(n=>n.id==='cabAlt').tipRadius<
          model.needles.find(n=>n.id==='press').tipRadius);
// Keep all native OH19 geometry candidate-only (do not swap the printed scales).
const nativeTicks=require('../../engine/instruments/oh19-native-ticks-batch1.json');
assert.deepEqual(nativeTicks.scales.map(scale=>scale.mode),['cabinAltitude','diffPressure']);
const rings=Object.fromEntries(nativeTicks.scales.map(x=>[x.mode,x.allVisibleTickCandidates]));
assert.equal(rings.cabinAltitude.length,47);
assert.equal(rings.diffPressure.length,51);
assert.ok(Math.max(...rings.cabinAltitude.map(x=>x.innerRadiusPx))<
          Math.min(...rings.diffPressure.map(x=>x.innerRadiusPx)));
const ordered=model.needles.slice().sort((a,b)=>a.layer-b.layer);
assert.deepEqual(ordered.map(n=>n.id),['press','cabAlt']);
const at=model.placement(oh19);assert.ok(at.x>oh19.x&&at.x<oh19.x+oh19.w);assert.ok(at.y>oh19.y&&at.y<oh19.y+oh19.h);
assert.equal(model.angle('press',200),200);
assert.equal(model.angle('cabAlt',-200),0);
assert.equal(model.angle('cabAlt',327.37),327.37);
assert.equal(model.angle('press',322.05),322.05);
assert.equal(model.angle('cabAlt',420),360);
const pressure=model.needles.find(n=>n.id==='press');
const altitude=model.needles.find(n=>n.id==='cabAlt');
assert.equal(pressure.tipRadius,222.7);
assert.equal(altitude.tipRadius,114.3);
const outerTicks=nativeTicks.scales.find(x=>x.mode==='diffPressure').allVisibleTickCandidates;
const innerTicks=nativeTicks.scales.find(x=>x.mode==='cabinAltitude').allVisibleTickCandidates;
const pressurePaintReach=pressure.tipRadius*(Math.hypot(4,221)+2.6/2)/220;
const altitudePaintReach=altitude.tipRadius*(Math.hypot(14,217)+3.2/2)/220;
assert.ok(outerTicks.every(t=>pressurePaintReach<t.innerRadiusPx),'pressure SVG tip must stay inside printed outer PSI ticks');
assert.ok(innerTicks.every(t=>altitudePaintReach<t.innerRadiusPx),'altitude SVG tip must stay inside printed inner x1000 FT ticks');
assert.ok(Math.min(...outerTicks.map(t=>t.innerRadiusPx))-pressurePaintReach>.7);
assert.ok(Math.min(...innerTicks.map(t=>t.innerRadiusPx))-altitudePaintReach>1);
assert.throws(()=>model.angle('bad',0));assert.throws(()=>model.angle('press',NaN));
for(const needle of model.needles){
 const asset=fs.readFileSync(path.join(__dirname,needle.asset),'utf8');
 assert.match(asset,/viewBox="0 0 512 512"/);
 assert.match(asset,new RegExp(needle.id==='cabAlt'?'CAB ALT':'PRESS'));
 assert.doesNotMatch(asset,/<image/);
}
const ui=fs.readFileSync(path.join(__dirname,'cabin-dual-needles-unified.js'),'utf8');
assert.ok(ui.includes('`.atlas-piece[data-key="${model.source.piece}"]`'));
assert.ok(ui.includes('for(const needle of stack)'));
assert.ok(ui.includes("'data-cabin-stack':needle.stack"));
assert.ok(ui.includes("'data-cabin-printed-scale':needle.printedScale"));
assert.ok(ui.includes('window.B737UnifiedCabinNeedles'));
assert.ok(ui.includes('needle.tipRadius/220'));
assert.ok(ui.includes("min:'0',max:'360',step:'0.5'"));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
assert.ok(html.includes('cabin-dual-needles-model.js?v=CDN-0004'));
assert.ok(html.includes('cabin-dual-needles-unified.js?v=CDN-0004'));
console.log('PASS: separate OH19 CAB ALT and PRESS needles share a pivot, rotate independently, and stack PRESS behind CAB ALT while preserving PSI outer and ALT inner printed scales.');


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
assert.ok(ui.includes('model.resolvePhysicalReadings(readings)'));
assert.ok(ui.includes("state.press=model.angle('press',mapping.pressBearingDeg)"));
assert.ok(ui.includes("state.cabAlt=model.angle('cabAlt',mapping.cabAltBearingDeg)"));
assert.ok(ui.includes("detail.system!==selected"));
assert.deepEqual(model.pressurePhotoAnchors.map(x=>x.valuePsid),[0,1,2,3,4,5,6,7,8,9,10]);
assert.equal(model.differentialPressurePreviewBearing(0),1.5);
assert.equal(model.differentialPressurePreviewBearing(10),322.05);
assert.equal(model.differentialPressurePreviewBearing(-.1),null);
assert.equal(model.differentialPressurePreviewBearing(10.1),null);
assert.equal(model.resolvePhysicalReadings({cabinAltitudeFt:3260,differentialPsid:5}).status,'BOTH_CANDIDATE_BEARINGS');
assert.ok(ui.includes('NOT FINAL'));
