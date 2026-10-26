'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const ev=require('./native-bezel-centre-evidence-v1.json');
const ac=require('../../panel-mosaic-lab/cockpit/ac-dc-metering-model.js');
const drv=require('../../panel-mosaic-lab/cockpit/drive-amps-needle-model.js');
const temperature=require('../../panel-mosaic-lab/cockpit/cabin-temperature-needle-model.js');
const duct=require('../../panel-mosaic-lab/cockpit/duct-pressure-needles-model.js');
const nearly=(x,y)=>Math.abs(x-y)<.02;
test('source-specific 11-gauge original photo and SHA256 provenance stays recorded',()=>{
 assert.equal(ev.gauges.length,11);
 assert.equal(Object.keys(ev.sourcePhotos).length,5);
 for(const p of Object.values(ev.sourcePhotos)){
  assert.match(p.sha256,/^[a-f0-9]{64}$/);
  assert.equal(p.size.length,2);
 }
 assert.ok(ev.gauges.every(x=>!x.shaftPivotCertified));
 assert.equal(ev.allGraduationsCertified,false);
});
test('three remaining CPS/GEN DRIVE photo bezel previews stay at provisional rim candidates',()=>{
 const positions=new Map([...ac.meters.map(x=>['OH10:'+x.id,[x.x,x.y]]),
 ...drv.needles.map(x=>[x.piece+':'+x.id,[x.x,x.y]])]);
 const eligible=ev.gauges.filter(x=>x.moveVisualMountToBezelCandidate);
 assert.equal(eligible.length,3);
 for(const r of eligible){
  const actual=positions.get(r.panel+':'+r.id);
  assert.ok(actual,r.panel+':'+r.id);
  assert.ok(nearly(actual[0],r.bezelArcCentrePx[0]));
  assert.ok(nearly(actual[1],r.bezelArcCentrePx[1]));
  assert.ok(r.deltaFromOldPx>10);
  assert.equal(r.status,'BEZEL_CENTRE_PROVISIONAL');
 }
});
test('OH12 A.C. AMPS pointers use real 21-white-stroke radial intersections, NOT bezel center',()=>{
 const radial=ev.gauges.filter(x=>x.id==='acAmps1'||x.id==='acAmps2');
 assert.equal(radial.length,2);
 for(const r of radial){
  assert.equal(r.moveVisualMountToBezelCandidate,false);
  assert.equal(r.all21NumericGraduationsIdentified,true);
  assert.equal(r.originalBezelCenterIsNotMechanicalPivot,true);
  const n=drv.needles.find(x=>x.id===r.id);
  assert.ok(nearly(n.x,r.radialStrokePhotoCenterPx[0]));
  assert.ok(nearly(n.y,r.radialStrokePhotoCenterPx[1]));
  assert.ok(!r.shaftPivotCertified);
 }
});
test('OH10 three photo tick-intersection calibrated centres now replace metal rims',()=>{
 const cases=[['dcAmps',[308.453,281.608]],['dcVolts',[310.307,682.818]],['acVolts',[785.143,702.386]]];
 for(const [id,pivot] of cases){
  const r=ev.gauges.find(x=>x.id===id),n=ac.meters.find(x=>x.id===id);
  assert.ok(r&&n);
  assert.equal(r.moveVisualMountToBezelCandidate,false);
  assert.equal(r.status,'PHOTO_RADIAL_STROKE_PIVOT_SUPERSEDES_BEZEL_CENTRE');
  assert.deepEqual(r.radialStrokePhotoCenterPx,pivot);
  assert.ok(nearly(n.x,pivot[0])&&nearly(n.y,pivot[1]));
  assert.equal(r.shaftPivotCertified,false);
 }
});
test('APU AMPS previous pivot is kept after photo rim contrast decreased',()=>{
 const r=ev.gauges.find(g=>g.id==='apuAcAmps');
 assert.equal(r.moveVisualMountToBezelCandidate,false);
 assert.equal(r.status,'OLD_PIVOT_KEPT_AFTER_RIM_CONTRAST_WORSENED');
 const n=drv.needles.find(g=>g.id==='apuAcAmps');
 assert.deepEqual([n.x,n.y],r.oldPivotPx);
});
test('actual visible hubs on OH20 and OH21 are NOT swapped with rim centres',()=>{
 const a=ev.gauges.filter(x=>x.panel==='OH20'||x.panel==='OH21');
 assert.deepEqual([temperature.pivot.x,temperature.pivot.y],a[0].oldPivotPx);
 assert.deepEqual([duct.pivot.x,duct.pivot.y],a[1].oldPivotPx);
});
test('angle-only inspector API must not claim source-certified Amps or Celsius readings',()=>{
 for(const gauge of ev.gauges)
  assert.ok(!gauge.shaftPivotCertified);
 for(const m of ac.meters)assert.ok(Number.isFinite(m.initialAngle));
 assert.equal(ac.angle(43),43);
 assert.equal(drv.angle(22),22);
 assert.equal(ev.allPhysicalShaftsCertified,false);
});
