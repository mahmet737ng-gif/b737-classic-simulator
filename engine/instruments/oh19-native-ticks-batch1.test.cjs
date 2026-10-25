'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const m=require('./oh19-native-ticks-batch1.json');
test('Source untouched and 47 CAB ALT plus 51 pressure strokes preserved',()=>{
 assert.equal(m.scales[0].allVisibleTickCandidates.length,47);
 assert.equal(m.scales[1].allVisibleTickCandidates.length,51);
 assert.match(m.source.sha256,/^[0-9a-f]{64}$/);
 assert.deepEqual(m.commonPivot,{x:489,y:365,evidence:'source-photo optical pivot used in prior branch; not independently certified'});
 assert.equal(m.scaleCalibrationApproved,false);
});
test('All reconstructed native-image candidate positions match their bearings/radii',()=>{
 for(const s of m.scales)for(const t of s.allVisibleTickCandidates){
  const dx=t.tipCandidate.x-m.commonPivot.x,dy=t.tipCandidate.y-m.commonPivot.y;
  const radius=Math.hypot(dx,dy);
  assert.ok(Math.abs(radius-t.innerRadiusPx)<.02,s.mode+':'+t.index);
  assert.ok(t.tipCandidate.x>=0&&t.tipCandidate.x<m.source.width);
  assert.ok(t.tipCandidate.y>=0&&t.tipCandidate.y<m.source.height);
  assert.equal(t.calibrationApproved,false);
 }
});
test('Pressure and cabin-altitude rings are independent and nonuniform',()=>{
 const c=m.scales[0].allVisibleTickCandidates,p=m.scales[1].allVisibleTickCandidates;
 assert.ok(c.every(x=>x.innerRadiusPx>110&&x.innerRadiusPx<140));
 assert.ok(p.every(x=>x.innerRadiusPx>200&&x.innerRadiusPx<245));
 for(const a of [c,p]) for(let i=1;i<a.length;i++)assert.ok(a[i].angleDeg>a[i-1].angleDeg);
 assert.equal(c[0].angleDeg,2.71);
 assert.equal(p[0].angleDeg,1.5);
 assert.equal(c[6].interpretedValueFt,3000);
 assert.equal(p[25].interpretedValuePsi,5);
});
