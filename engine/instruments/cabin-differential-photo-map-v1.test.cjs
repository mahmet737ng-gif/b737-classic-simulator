'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const m=require('./cabin-differential-photo-map-v1.js');
const alt=require('./cabin-altitude-photo-map-v1.js');
test('OH19 51 photographed outer PRESS ticks do not share CAB ALT inner radius',()=>{
 assert.equal(m.ticks.length,51);assert.equal(alt.ticks.length,47);
 assert.equal(m.SOURCE.sha256,alt.SOURCE.sha256);
 assert.deepEqual(m.SOURCE.pivot,alt.SOURCE.pivot);
 assert.ok(m.ticks.every(t=>t.innerRadiusPx>200&&t.innerRadiusPx<245));
 assert.ok(alt.ticks.every(t=>t.innerRadiusPx<130));
 assert.equal(m.SOURCE.finalApproved,false);
});
test('11 printed integer PSI labels and exactly four short strokes between',()=>{
 const major=m.ticks.filter(t=>t.major);
 assert.equal(major.length,11);
 assert.deepEqual(major.map(t=>t.psi),[0,1,2,3,4,5,6,7,8,9,10]);
 for(let i=1;i<m.ticks.length;i++){
  assert.ok(Math.abs(m.ticks[i].psi-m.ticks[i-1].psi-.2)<1e-9);
  assert.ok(m.ticks[i].angleDeg>m.ticks[i-1].angleDeg);
 }
 assert.equal(m.ticks[0].angleDeg,1.5);
 assert.equal(m.ticks.at(-1).angleDeg,322.05);
});
test('Actual 0 PSI on equalized airport -> outer zero and no cabin ALT overwrite',()=>{
 const x=m.poseAtPsi(0);
 assert.equal(x.angleDeg,1.5);assert.ok(x.verifiedPhotoStroke);
 assert.equal(x.finalApproved,false);
 const y=alt.poseAtFt(3963);
 assert.notEqual(x.angleDeg,y.angleDeg);
 assert.ok(y.angleDeg>59.98);
});
test('Positive PSI follows photographed nonlinear local 0.2 ticks through 180',()=>{
 const s=[0,.2,.4,1,1.5,2,3,5,6,7,8,9,10].map(k=>m.poseAtPsi(k).angleDeg);
 for(let i=1;i<s.length;i++)assert.ok(s[i]>s[i-1]);
 assert.ok(m.poseAtPsi(6).angleDeg>180);
 assert.ok(m.poseAtPsi(8.65).angleDeg>256&&m.poseAtPsi(8.65).angleDeg<291);
 assert.equal(m.poseAtPsi(-0.5).status,'out_of_range');
 assert.equal(m.poseAtPsi(11,{outOfRange:'clamp'}).angleDeg,322.05);
 assert.throws(()=>m.poseAtPsi(NaN),/Finite/);
});
test('Differential pressure pointer length corrected to source inner tick radius',()=>{
 assert.equal(m.needle.newTipRadiusModelPx,230);
 assert.equal(m.needle.oldTipRadiusModelPx,207);
 assert.ok(m.needle.displayedTipRadiusPx>225);
 for(const ft of [0,1,3.5,7,10]){
  const p=m.poseAtPsi(ft);
  assert.ok(p.stretch>.9&&p.stretch<1.1);
  assert.ok(Math.abs(p.innerRadiusPx-m.needle.displayedTipRadiusPx*p.stretch)<1e-9);
 }
});
