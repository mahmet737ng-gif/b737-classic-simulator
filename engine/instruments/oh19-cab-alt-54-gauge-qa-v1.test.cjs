const test=require('node:test');const assert=require('node:assert/strict');
const audit=require('./cold-dark-needle-fit-audit-v1.json');
const inventory=require('./gauge-inventory-v1.json');
const photo=require('./oh19-cab-alt-photo-anchors-v1.json');
test('All 54 cold dark faces remain in source-backed geometry QA',()=>{
 const ids=inventory.faceGroups.flatMap(g=>g.ids).concat('oh.crew_oxygen.pressure');
 assert.equal(ids.length,54);
 assert.deepEqual(new Set(ids),new Set(Object.keys(audit.records)));
 assert.equal(audit.approvedFullNumericalCalibrations,0);
 assert.equal(audit.acceptance.approved54GaugeCalibrationCount,0);
 assert.equal(audit.acceptance.photoTickValueValidationComplete,false);
 assert.equal(audit.acceptance.independentNeedleTipSweepApproved,false);
 assert.equal(audit.acceptance.physicalInputGroundAltitudeIntegrated,true);
});
test('Inner OH19 0 to 3k 500-ft ticks are separate from PRESS and ordered in the photo',()=>{
 assert.deepEqual(photo.marks.filter(x=>x.valueFt<=3000).map(x=>x.valueFt),
  [0,500,1000,1500,2000,2500,3000]);
 for(let i=1;i<photo.marks.length;i++)
  assert.ok(photo.marks[i].angleDeg>photo.marks[i-1].angleDeg);
 assert.equal(photo.review.productionApproved,false);
 assert.equal(photo.review.innerThreeToTenNumericMinorLabelsUnknown,true);
 assert.ok(audit.records['oh.cabin.diff_pressure_altitude'].photoNumericMap);
});
