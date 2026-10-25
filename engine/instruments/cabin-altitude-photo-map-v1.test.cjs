'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const path=require('node:path'),fs=require('node:fs');
const m=require('./cabin-altitude-photo-map-v1.js');
const cold=require('./cold-dark-indicator-v1.js');
const gauge=require('../../panel-mosaic-lab/cockpit/cabin-dual-needles-model.js');
test('Native image and physical independent needle source registration',()=>{
 assert.equal(m.SOURCE.width,1267);
 assert.equal(m.SOURCE.height,1241);
 assert.deepEqual(m.SOURCE.pivot,gauge.pivot);
 assert.match(m.SOURCE.sha256,/^[a-f0-9]{64}$/i);
 assert.equal(gauge.needles[0].id,'cabAlt');
 assert.equal(m.ticks.length,47);
 assert.equal(m.SOURCE.finalApproved,false);
});
test('All photo-detected printed major CAB ALT numeric anchors are correct and ordered',()=>{
 assert.deepEqual(m.anchors.map(a=>a.thousandsFeet),[0,3,10,15,20,25,30,35,40,50]);
 assert.deepEqual(m.anchors.map(a=>a.index),[0,6,11,16,22,28,33,38,42,46]);
 assert.equal(m.anchors[0].printed,false); // 0 indicated by unnumbered upper zero tick
 for(let i=1;i<m.anchors.length;i++){
  assert.equal(m.anchors[i].printed,true);
  const t=m.ticks[m.anchors[i].index];
  assert.equal(t.valueThousandsFt,m.anchors[i].thousandsFeet);
 }
 for(let i=1;i<m.ticks.length;i++){
  assert.ok(m.ticks[i].angleDeg>m.ticks[i-1].angleDeg);
  assert.ok(m.ticks[i].valueThousandsFt>m.ticks[i-1].valueThousandsFt);
 }
 assert.equal(m.ticks[0].angleDeg,2.71);
 assert.equal(m.ticks.at(-1).angleDeg,327.37);
});
test('Every scanned tick is near the inner scale and has source-pixel coordinates',()=>{
 const pivot=m.SOURCE.pivot;
 for(const t of m.ticks){
   assert.ok(t.x>0&&t.x<m.SOURCE.width);
   assert.ok(t.y>0&&t.y<m.SOURCE.height);
   const radius=Math.hypot(t.x-pivot.x,t.y-pivot.y);
   assert.ok(Math.abs(radius-t.innerRadiusPx-7)<.0001);
   assert.ok(t.innerRadiusPx>=110&&t.innerRadiusPx<=130);
 }
});
test('The unnumbered increments differ by anchor section (cannot use single global degrees/ft)',()=>{
 assert.deepEqual(m.intervals.map(s=>s.gaps),[6,5,5,6,6,5,5,4,4]);
 assert.ok(Math.abs(m.intervals[0].stepThousandsFt-.5)<1e-10);
 assert.ok(Math.abs(m.intervals[1].stepThousandsFt-1.4)<1e-10);
 assert.ok(Math.abs(m.intervals.at(-1).stepThousandsFt-2.5)<1e-10);
});
test('User airport default CAB ALT maps to different inner needle angles from the photo',()=>{
 const cases=[['OIAW',66],['OIMM',3260],['OIII',3963]];
 const results=cases.map(([icao,ft])=>{
  const actual=cold.resolve('oh.cabin.diff_pressure_altitude',
    {fieldElevationFt:ft,cabinEqualized:true});
  assert.equal(actual.needles.cabAlt.value,ft);
  assert.equal(actual.needles.press.value,0);
  const p=m.poseAtFt(ft);
  assert.ok(p.angleDeg>=2.71&&p.angleDeg<=327.37);
  assert.ok(p.approved===false);
  assert.equal(p.appliedFeet,ft);
  return [icao,Number(p.angleDeg.toFixed(3))];
 });
 assert.ok(results[0][1]>2.7&&results[0][1]<13.59);
 assert.ok(results[1][1]>59.98&&results[1][1]<69.45);
 assert.ok(results[2][1]>results[1][1]&&results[2][1]<69.45);
 assert.ok(Math.abs(results[2][1]-results[1][1])>2);
});
test('Rotates smoothly clockwise past 180 without wrapping back through zero',()=>{
 const angles=[0,2000,4000,10000,15000,20000,25000,30000,35000,40000,50000].map(ft=>m.poseAtFt(ft).angleDeg);
 for(let i=1;i<angles.length;i++)assert.ok(angles[i]>angles[i-1]);
 assert.ok(m.poseAtFt(20000).angleDeg>180);
 assert.ok(m.poseAtFt(50000).angleDeg>320);
 assert.ok(m.poseAtFt(50100).status==='out_of_range');
 assert.ok(m.poseAtFt(50100,{outOfRange:'clamp'}).angleDeg===m.poseAtFt(50000).angleDeg);
 assert.throws(()=>m.poseAtFt(NaN),/finite/);
});
test('Existing pointer tip fit is measured, not represented as final certified',()=>{
 const t=m.measureTipFit(3963);
 assert.ok(Math.abs(t.tipToWhiteTickInnerEdgePx)<10);
 assert.ok(t.approved===false);
 assert.ok(t.tipRadiusPx>110&&t.tipRadiusPx<130);
});
