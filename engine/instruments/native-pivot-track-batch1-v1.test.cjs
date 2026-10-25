'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const r=require('./native-pivot-track-batch1-v1.json');
const inventory=require('./gauge-inventory-v1.json');
const original=require('./gauge-survey-stage2-3.json');
test('Every previously missing pivot has either rotary candidate or linear track',()=>{
 const tracked=new Set(r.circularFaces.concat(r.linearFaces).map(x=>x.id));
 const missing=original.faces.filter(x=>x.pivot===null).map(x=>x.id);
 assert.equal(missing.length,34);assert.equal(tracked.size,34);
 assert.deepEqual(tracked,new Set(missing));
 assert.equal(r.circularFaces.length,29);assert.equal(r.linearFaces.length,5);
});
test('Native center candidates are in bounds and blocked from live signal',()=>{
 for(const f of r.circularFaces){
  const c=f.pivotCandidate;
  assert.ok(c.x>0&&c.x<f.sourceWidth&&c.y>0&&c.y<f.sourceHeight,f.id);
  assert.ok(f.roughDialRadiusPx>30);
  assert.equal(f.pivotVerified,false);assert.equal(f.zeroAngleDeg,null);
  assert.equal(f.majorMinorTicksVerified,false);assert.equal(f.liveNeedleEnabled,false);
  assert.match(f.sourceSha256,/^[a-f0-9]{64}$/);
 }
 for(const f of r.linearFaces){
  assert.equal(f.pivot,'not_applicable');
  const q=f.travelWindowCandidate;
  assert.ok(q.x0<q.x1&&q.y0<q.y1&&q.x0>=0&&q.y0>=0&&q.x1<f.sourceWidth&&q.y1<f.sourceHeight,f.id);
  assert.equal(f.travelTickPositionsVerified,false);
 }
});
