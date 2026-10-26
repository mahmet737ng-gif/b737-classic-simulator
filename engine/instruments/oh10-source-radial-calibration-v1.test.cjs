'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const model=require('../../panel-mosaic-lab/cockpit/ac-dc-metering-model.js');
const photo=require('./oh10-source-radial-graduations-v1.json');
test('OH10 true source radial centres and photo tick values for each of three numbered faces',()=>{
 assert.deepEqual(photo.gauges.map(x=>x.id),['dcAmps','dcVolts','acVolts']);
 assert.equal(photo.gauges.reduce((a,g)=>a+g.sourceMarks.length,0),38);
 for(const g of photo.gauges){
  const m=model.meters.find(x=>x.id===g.id);
  assert.ok(m);
  assert.ok(Math.abs(m.x-g.radialIntersectionCenterPx[0])<.001);
  assert.ok(Math.abs(m.y-g.radialIntersectionCenterPx[1])<.001);
  assert.equal(m.tipRadius,g.sourceOriginalPaintedTipPx);
  assert.ok(Math.hypot(m.x-g.rimCenterPx[0],m.y-g.rimCenterPx[1])>40);
  assert.ok(g.radialAxisRmsPx<5);
  assert.equal(g.mechanicalSpindleVerified,false);
  for(const line of g.sourceMarks){
    assert.ok(Math.abs(model.bearingForReading(g.id,line.value)-line.angleDeg)<1e-10);
    assert.ok(line.nativeInnerRadiusPx-m.tipRadius>2.5);
  }
 }
 assert.deepEqual(photo.gauges[0].sourcePrintedMajorValues,[-50,0,50]);
 assert.deepEqual(photo.gauges[1].sourcePrintedMajorValues,[0,20,40]);
 assert.deepEqual(photo.gauges[2].sourcePrintedMajorValues,[100,110,120,130]);
});
test('DC AMPS from -50 to 50 A and DC VOLTS from 0 to 40 V roundtrip to 0.001 units',()=>{
 for(const [id,min,max] of [['dcAmps',-50,50],['dcVolts',0,40]]){
  for(let val=min;val<=max;val+=.25){
    const angle=model.bearingForReading(id,val);
    const inverse=model.readingForBearing(id,angle);
    assert.ok(Math.abs(val-inverse)<.000001,[id,val,angle,inverse].join('/'));
  }
  assert.equal(model.photoScale[id].readoutApprovedForPreview,true);
  assert.equal(model.bearingForReading(id,min-1),null);
  assert.equal(model.bearingForReading(id,max+1),null);
  assert.throws(()=>model.bearingForReading(id,Infinity));
 }
 assert.equal(model.photoScale.acVolts.readoutApprovedForPreview,false);
 assert.equal(model.meters.find(x=>x.id==='acVolts').initialAngle,-70,'cold dark left park unchanged');
 assert.equal(model.readingForBearing('acVolts',-70),null,'park must not be fabricated as a physical voltage');
});
test('Unified OH10 actual slider values and initial physical zero positions persist through HTML',()=>{
 const ui=fs.readFileSync(path.join(__dirname,'../../panel-mosaic-lab/cockpit/ac-dc-metering-unified.js'),'utf8');
 assert.ok(ui.includes('setReading(meter.id,Number(input.value))'));
 assert.ok(ui.includes('getReadings'));
 assert.ok(ui.includes('model.bearingForReading(id,numeric)'));
 assert.ok(ui.includes("model.photoScale[id]?.readoutApprovedForPreview"));
 const html=fs.readFileSync(path.join(__dirname,'../../panel-mosaic-lab/cockpit/index.html'),'utf8');
 assert.ok(html.includes('ac-dc-metering-model.js?v=MET-0004-TICK-CAL'));
 assert.ok(html.includes('ac-dc-metering-unified.js?v=MET-0004-TICK-CAL'));
 const amps=model.meters.find(x=>x.id==='dcAmps'),volts=model.meters.find(x=>x.id==='dcVolts');
 assert.ok(Math.abs(amps.initialAngle-model.bearingForReading('dcAmps',0))<1e-9);
 assert.equal(volts.initialAngle,model.bearingForReading('dcVolts',0));
});
