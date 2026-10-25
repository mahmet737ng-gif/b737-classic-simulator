const test=require("node:test");
const assert=require("node:assert/strict");
const m=require("./needle-zero-reference-stage1-v1.json");
const inventory=require("./gauge-inventory-v1.json");
test("All 54 known Unified faces have an immutable-source stage-1 audit entry",()=>{
 const expected=inventory.faceGroups.flatMap(g=>g.ids).concat("oh.crew_oxygen.pressure");
 assert.equal(expected.length,54);
 assert.equal(m.faces.length,54);
 assert.deepEqual(new Set(m.faces.map(x=>x.id)),new Set(expected));
 for(const f of m.faces){
  assert.match(f.source.sha256,/^[a-f0-9]{64}$/i);
  assert.ok(f.source.width>0&&f.source.height>0);
  assert.equal(f.faceApproved,false,f.id);
  assert.ok(Array.isArray(f.scales)&&f.scales.length,f.id);
  if(f.pivot){
   assert.ok(f.pivot.x>=0&&f.pivot.x<f.source.width&&f.pivot.y>=0&&f.pivot.y<f.source.height,f.id);
  }
  for(const s of f.scales) {
   assert.equal(s.approved,false);
   for(const p of s.referenceCandidates){
    assert.equal(p.approved,false);
    assert.ok(Number.isFinite(p.value)&&Number.isFinite(p.angleDeg),f.id);
    if(p.point){
     assert.ok(f.pivot,f.id);
     const b=Math.atan2(p.point.x-f.pivot.x,f.pivot.y-p.point.y)*180/Math.PI;
     assert.ok(Math.abs(b-p.angleDeg)<0.3,f.id+":"+p.value+" "+b+" "+p.angleDeg);
    }
   }
   if(s.zeroTick?.anglesDeg?.length) assert.ok(s.referenceCandidates.some(x=>x.value===0),f.id);
  }
 }
 assert.equal(m.coverage.fullyCertifiedFaces,0);
});
test("Photographic pivot conflicts are surfaced, not silently merged",()=>{
 const conflicts=m.faces.filter(f=>f.pivotConflict);
 assert.ok(conflicts.some(f=>f.id==="oh.elec.dc_amps"));
 assert.ok(conflicts.some(f=>f.id==="oh.elec.cps"));
 for(const f of conflicts)assert.notDeepEqual(f.pivotConflict.overlayPivot,f.pivotConflict.photoCandidatePivot);
});
test("Zero reference and cabin-altitude have independent physically measured candidates",()=>{
 const by=id=>m.faces.find(f=>f.id===id);
 assert.equal(by("oh.fuel.temperature").scales[0].zeroTick.anglesDeg[0],0.5);
 const cabin=by("oh.cabin.diff_pressure_altitude").scales;
 assert.equal(cabin.length,2);
 assert.equal(cabin[0].referenceCandidates.filter(x=>x.value===0).length,1);
 assert.equal(cabin[1].zeroTick.anglesDeg[0],2.71);
 assert.equal(by("oh.crew_oxygen.pressure").scales[0].zeroTick,null);
});
