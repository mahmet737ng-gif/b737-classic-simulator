const test=require('node:test');
const assert=require('node:assert/strict');
const lines=require('./native-verified-division-intervals-v1.json');
const labels=require('./native-photo-scale-label-inventory-v1.json');
test('photo-inspected source variants and numeric legends remain separate',()=>{
 assert.equal(labels.classifications.length,10);
 assert.equal(labels.sourcePanels,6);
 const rise=labels.classifications.find(x=>x.scale==='GEN DRIVE TEMP RISE');
 const oil=labels.classifications.find(x=>x.scale==='GEN DRIVE OIL TEMP INNER');
 assert.deepEqual(rise.printedNumberLabels,[0,10,20,30]);
 assert.deepEqual(oil.printedNumberLabels,[80,120,160]);
 assert.ok(labels.classifications.some(x=>x.panel==='OH20-400'&&x.sourceVariant==='400'));
 assert.ok(labels.classifications.some(x=>x.panel==='OH20'&&x.sourceVariant==='300/500'));
 assert.ok(labels.classifications.every(x=>x.valueIntervalsKnownFully===false));
 assert.equal(labels.releaseApproved,false);
});
test('OH11: exactly one visually counted minor between printed 10 and 20',()=>{
 const s=lines.cases.find(x=>x.panel==='OH11');
 assert.equal(s.intermediateTicksCount,1);
 assert.equal(s.intervals,2);
 assert.equal((s.printedAnchors[1]-s.printedAnchors[0])/s.intervals,s.perTickUnit);
 assert.deepEqual(s.verifiedPoints,[10,15,20]);
 assert.equal(s.pixelAnglesIndividuallySignedOff,false);
});
test('OH12: four printed minor lines between 50 and 100 imply 10A per division',()=>{
 const s=lines.cases.find(x=>x.panel==='OH12');
 assert.equal(s.intermediateTicksCount,4);
 assert.equal(s.intervals,5);
 assert.equal((s.printedAnchors[1]-s.printedAnchors[0])/s.intervals,s.perTickUnit);
 assert.deepEqual(s.verifiedPoints,[50,60,70,80,90,100]);
 assert.equal(s.pixelAnglesIndividuallySignedOff,false);
 assert.equal(lines.overallOperationalCalibrationApproved,false);
});
