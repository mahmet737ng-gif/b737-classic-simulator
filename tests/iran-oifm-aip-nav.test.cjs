'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const nav=require('../engine/flight/iran-radio-navaids-v1.js');
const core=require('../engine/flight/flight-scenario-core-v1.js');
const map=require('../engine/flight/iran-nav-reference-v1.js');
const aip=require('../engine/flight/data/iran-oifm-official-aip-v1.json');
test('OIFM authoritative runways and surveyed thresholds are distinct',()=>{
 assert.equal(aip.icao,'OIFM');
 assert.deepEqual(Object.keys(aip.runways),['07L','25R','07R','25L']);
 assert.equal(aip.runways['25R'].trueBearingDeg,257.96);
 assert.equal(aip.runways['25R'].threshold.lat,32.75701944);
 assert.equal(aip.runways['07R'].threshold.lon,51.83884444);
 assert.equal(aip.runways['25R'].declaredDistancesM.lda,4399);
 assert.equal(aip.runways['25L'].ilsIdent,null);
 assert.equal(aip.runways['25R'].papiAngleDeg,2.6);
 assert.equal(core.AIRPORTS.OIFM.runways['25R'],257.96);
});
test('ISN DVOR and military IFN TACAN are distinct from 337kHz NDB',()=>{
 const vor=nav.byIdent('ISN'),tacan=nav.byIdent('IFN','TACAN'),ndb=nav.byIdent('IFN','NDB');
 assert.equal(vor.type,'DVOR_DME');assert.equal(vor.freqKhz,113200);assert.equal(vor.dmeChannel,'79X');
 assert.equal(tacan.type,'TACAN');assert.equal(tacan.tacanChannel,'118X');
 assert.equal(ndb.freqKhz,337);assert.equal(ndb.morseCode,'.. ..-. -.');
 assert.equal(nav.match(337,'VOR'),null);
 assert.equal(nav.match(337,'NDB').ident,'IFN');
 assert.equal(nav.match(117100,'VOR'),null);
});
test('OIFM IIFN ILS only on 25R, 2.63 degree GP, DME measured from antenna',()=>{
 const ils=nav.byIdent('IIFN');
 assert.equal(ils.type,'ILS_DME');assert.equal(ils.runway,'25R');assert.equal(ils.freqKhz,109900);
 assert.equal(ils.glideDeg,2.63);assert.equal(ils.tchFt,55);assert.equal(ils.glideFreqKhz,333800);
 assert.equal(ils.dmeChannel,'36X');assert.equal(ils.courseTrueDeg,257.96);
 assert.equal(ils.morseCode,'.. .. ..-. -.');
 assert.equal(nav.STATIONS.some(x=>x.airport==='OIFM'&&x.runway==='25L'&&x.type==='ILS_DME'),false);
 const antenna={lat:ils.dmeLat,lon:ils.dmeLon,altitudeFt:ils.dmeElevationFt};
 assert(nav.dmeSlantNm(antenna,ils)<0.00001);
 assert(nav.dmeSlantNm({lat:ils.lat,lon:ils.lon,altitudeFt:ils.elevationFt},ils)>.05);
 const tuned=nav.match(109900,'ILS',{lat:32.75,lon:51.88,altitudeFt:5000});
 assert.equal(tuned.ident,'IIFN');
});
test('Varamin VR and Kahrizak KAZ ADF freqs cannot leak into VHF NAV match',()=>{
 assert.equal(nav.byIdent('VR','NDB').freqKhz,373);
 assert.equal(nav.byIdent('KAZ','NDB').freqKhz,358);
 assert.equal(nav.byIdent('KZ').ident,'KAZ');
 assert.equal(nav.byIdent('VR').morseCode,'...- .-.');
 assert.equal(nav.byIdent('KAZ').morseCode,'-.- .- --..');
 assert.equal(nav.match(373,'NDB').ident,'VR');
 assert.equal(nav.match(358,'ILS'),null);
 assert.equal(nav.match(358,'VOR'),null);
 assert.equal(nav.dmeSlantNm({lat:35.4,lon:51.5,altitudeFt:4000},nav.byIdent('VR')),null);
 assert(map.some(x=>x.ident==='VR'&&x.type==='NDB'));
 assert(map.some(x=>x.ident==='KAZ'&&x.type==='NDB'));
 assert(map.some(x=>x.ident==='OIFM'&&x.type==='AIRPORT'));
});
test('Flight scenario includes OIFM and 10nm final references true runway course',()=>{
 const thr=aip.runways['25R'];
 const prepared=core.newScenario({airport:'OIFM',runway:'25R',preset:'FINAL_10'},{OIFM:{
  '25R':{lat:thr.threshold.lat,lon:thr.threshold.lon,elevationFt:thr.thresholdElevationFt,courseTrueDeg:thr.trueBearingDeg,glideDeg:aip.aids.IIFN.glidePathAngleDeg,tchFt:aip.aids.IIFN.referenceDatumHeightFt,source:'IRAN_AIP_OIFM_AD2_12'}
 }});
 assert.equal(prepared.icao,'OIFM');assert.equal(prepared.runway,'25R');
 assert(prepared.altitudeFt>5043);
 assert(nav.STATIONS.some(s=>s.ident==='ESH'&&s.type==='NDB'));
});
