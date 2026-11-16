'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const WMM=require('../engine/efis/wmm2025-magnetic-model-v1.js');
// NOAA NCEI/BGS reference: WMM2025_TEST_VALUES.txt, field 11 DECLINATION.
const NOAA=[
 [2025,0,80,0,1.28],[2025,0,0,120,-.16],[2025,0,-80,240,68.78],
 [2025,100,80,0,.85],[2025,100,0,120,-.15],[2025,100,-80,240,68.21],
 [2027.5,0,80,0,2.59],[2027.5,0,0,120,-.24],[2027.5,0,-80,240,68.49],
 [2027.5,100,80,0,2.16],[2027.5,100,0,120,-.23],[2027.5,100,-80,240,67.93]
];
test('WMM2025 contains all 90 NOAA spherical harmonic coefficient rows',()=>{
 assert.equal(WMM.COEFFICIENT_COUNT,90);
 assert.equal(WMM.EPOCH,2025);assert.equal(WMM.UNTIL,2030);
});
test('12 independent official NOAA 2025/2027.5 reference declinations <0.01 deg',()=>{
 for(const [date,altitudeKm,lat,lon,decl] of NOAA){
  const observed=WMM.evaluate({date,altitudeFt:altitudeKm*1000/.3048,lat,lon});
  assert.equal(observed.valid,true);
  assert.ok(Math.abs(observed.declinationDeg-decl)<.01,
   `NOAA lat ${lat} lon ${lon} year ${date}: ${observed.declinationDeg} vs ${decl}`);
 }
});
test('airports OIII OIMM OISS use WMM2025 2026 position values, not fixed lookup',()=>{
 const at='2026-11-16T00:00:00Z';
 const sites=[{name:'OIII',lat:35.689175,lon:51.314392,approx:4.97},
 {name:'OIMM',lat:36.234821,lon:59.642949,approx:4.66},
 {name:'OISS',lat:29.5392,lon:52.5898,approx:3.35}];
 for(const site of sites){
  const v=WMM.evaluate({lat:site.lat,lon:site.lon,date:at});
  assert.equal(v.valid,true);
  assert.ok(Math.abs(v.declinationDeg-site.approx)<.06,site.name+': '+v.declinationDeg);
  assert.equal(v.source,'NOAA_NCEI_BGS_WMM2025');
 }
});
test('date, altitude, position changes continuously change magnetic variation',()=>{
 const input={lat:35.689175,lon:51.314392};
 const early=WMM.evaluate({...input,date:2025});
 const late=WMM.evaluate({...input,date:2029.5});
 assert.ok(Math.abs(late.declinationDeg-early.declinationDeg)>.15);
 const route=WMM.evaluate({lat:34.1,lon:56.1,date:2026.875});
 assert.ok(Math.abs(route.declinationDeg-early.declinationDeg)>.05);
 const high=WMM.evaluate({...input,date:2026.875,altitudeFt:35000});
 const low=WMM.evaluate({...input,date:2026.875,altitudeFt:0});
 assert.ok(Math.abs(high.declinationDeg-low.declinationDeg)>0.00001);
 assert.equal(WMM.decimalYear('2026-01-01T00:00:00Z'),2026);
});
test('east variation: true = magnetic + east declination; magnetic = true - declination',()=>{
 const varE=5;
 assert.equal(WMM.magToTrue(134,varE),139);
 assert.equal(WMM.trueToMag(91,varE),86);
 assert.equal(WMM.magToTrue(359,varE),4);
 assert.equal(WMM.trueToMag(2,5),357);
});
test('invalid and out-of-epoch model requests return invalid, never invent zero variation',()=>{
 for(const input of [{lat:null,lon:51,date:2026},
 {lat:100,lon:50,date:2026},{lat:35,lon:50,date:2030},
 {lat:35,lon:50,date:2020},{lat:35,lon:50,date:NaN}]){
  const r=WMM.evaluate(input);
  assert.equal(r.valid,false);assert.equal(r.declinationDeg,null);
 }
 assert.equal(WMM.trueToMag(91,null),null);
});
