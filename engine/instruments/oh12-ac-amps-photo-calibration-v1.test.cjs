'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const calibration=require('./oh12-ac-amps-photo-graduations-v1.json');
const model=require('../../panel-mosaic-lab/cockpit/drive-amps-needle-model.js');
const photo=require('./native-bezel-centre-evidence-v1.json');
test('both authentic OH12 21-line instrument arcs and source provenance',()=>{
 assert.match(calibration.sha256,/^[0-9a-f]{64}$/);
 assert.deepEqual(calibration.verifiedPrintedMajorAmps,[0,50,100,150,200]);
 assert.equal(calibration.minorIncrementAmps,10);
 assert.equal(calibration.gauge.length,2);
 for(const row of calibration.gauge){
  assert.equal(row.numericTickCount,21);
  assert.equal(row.strokes.length,21);
  assert.equal(row.strokes.filter(t=>t.category==='PRINTED_MAJOR_LONG').length,5);
  assert.deepEqual(row.strokes.map(t=>t.valueA),Array.from({length:21},(_,i)=>10*i));
  assert.ok(row.radialFitRmsPx<3);
  assert.equal(row.physicalHiddenShaftCertified,undefined);
  assert.equal(calibration.hiddenPhysicalShaftCertified,false);
  const m=model.needles.find(n=>n.id===row.id);
  assert.ok(m&&m.piece==='OH12');
  assert.ok(Math.abs(m.x-row.radialLineIntersectionPivotPx[0])<.001);
  assert.ok(Math.abs(m.y-row.radialLineIntersectionPivotPx[1])<.001);
  assert.equal(m.tipRadius,125);
  assert.ok(Math.hypot(m.x-row.bezelCandidatePivotPx[0],m.y-row.bezelCandidatePivotPx[1])>40);
  for(const mark of row.strokes){
   assert.ok(Math.abs(model.bearingForAmps(row.id,mark.valueA)-mark.angleDeg)<1e-8);
   assert.ok(mark.innerStrokeRadiusPx-125>2.5);
  }
 }
});
test('0-200A full scale uses nonuniform source tick angles rather than fake linear angle',()=>{
 for(const id of ['acAmps1','acAmps2']){
  const a=model.ampPhotoAngles[id];
  assert.equal(a.length,21);
  assert.ok(a.every((v,i)=>i===0||v>a[i-1]));
  for(let amps=0;amps<=200;amps++){
   const angle=model.bearingForAmps(id,amps);
   const reversed=model.ampsForBearing(id,angle);
   assert.ok(Math.abs(reversed-amps)<1e-9,[id,amps,angle,reversed].join(','));
  }
  assert.equal(model.bearingForAmps(id,-0.1),null);
  assert.equal(model.bearingForAmps(id,200.1),null);
  assert.throws(()=>model.bearingForAmps(id,Infinity));
  assert.throws(()=>model.bearingForAmps('driveOil1',40));
 }
});
test('needle drawn with center translated and tip at all 42 line angles',()=>{
 const s=fs.readFileSync(path.join(__dirname,'../../panel-mosaic-lab/cockpit/drive-amps-needle-unified.js'),'utf8');
 assert.ok(s.includes("translate(${needle.x} ${needle.y}) scale(${needle.tipRadius/220})"));
 assert.ok(s.includes('setAmps(needle.id,Number(input.value))'));
 assert.ok(s.includes('getReadings'));
 const html=fs.readFileSync(path.join(__dirname,'../../panel-mosaic-lab/cockpit/index.html'),'utf8');
 assert.ok(html.includes('drive-amps-needle-model.js?v=DAN-0006-TICK-CAL'));
 assert.ok(html.includes('drive-amps-needle-unified.js?v=DAN-0006-TICK-CAL'));
});
test('zero-angle model rest now matches physical 0-A source major, no sharing center across gauges',()=>{
 for(const id of ['acAmps1','acAmps2']){
  const g=model.needles.find(n=>n.id===id);
  assert.equal(g.initialAngle,model.bearingForAmps(id,0));
 }
 const a=model.needles.find(n=>n.id==='acAmps1'),b=model.needles.find(n=>n.id==='acAmps2');
 assert.notEqual(a.x,b.x);
 assert.notEqual(model.bearingForAmps('acAmps1',125),model.bearingForAmps('acAmps2',125));
 const preserved=photo.gauges.filter(x=>x.id==='acAmps1'||x.id==='acAmps2');
 assert.ok(preserved.every(x=>!x.shaftPivotCertified));
});
