'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Sources=require('../panel-mosaic-lab/cockpit/unified-efis-sources-v1.js');
function record(value,quality='VALID'){return {quality,value};}
function snapshot(){
 const iru={powered:true,positionValid:true,attitudeValid:true,phase:'NAV_READY',
  pitchDeg:2,rollDeg:1,headingDeg:90,trackDeg:95,gsKt:230,lat:35,lon:51,
  magneticVariationDeg:5,source:'EXTERNAL_TELEMETRY'};
 return {
  'irs.left':record(iru),'irs.right':record(iru),
  'airdata.adc1':record({casKt:231,mach:.45}),
  'airdata.radioAltitude1':record({heightFt:2743}),
  'mcp.state':record({powered:true,courseL:90,courseR:90,headingDeg:90,
   speedDisplayMode:'IAS',selectedSpeedKt:240,altitudeFt:10000,verticalSpeedFpm:0}),
  'fmc.computed':record({operational:true,motion:{trueTrackDeg:95,gsKt:230}})
 };
}
test('EFIS diagnostics expose valid IRS attitude, track, ADC, radio altitude, display and SG feeds',()=>{
 const src=Sources.resolve(snapshot(),'CAPT',{}, {1:true,2:true},{},{lat:35,lon:51,altitudeFt:6705});
 assert.equal(src.health.irsQuality,'VALID');
 assert.equal(src.health.irsPowered,true);
 assert.equal(src.health.irsPhase,'NAV_READY');
 assert.equal(src.health.attitudeValid,true);
 assert.equal(src.health.trackDisplayValid,true);
 assert.equal(src.health.adcQuality,'VALID');
 assert.equal(src.health.adcCasKt,231);
 assert.equal(src.health.adcMach,.45);
 assert.equal(src.health.radioAltQuality,'VALID');
 assert.equal(src.health.radioAltitudeFt,2743);
 assert.equal(src.health.displayPowered,true);
 assert.equal(src.health.sgVideo,true);
});
test('missing IRS/ADC/RA signals are reported as UNKNOWN, never disguised as display-power failure',()=>{
 const src=Sources.resolve({},'CAPT',{}, {1:true,2:true},{},{});
 assert.equal(src.health.irsQuality,'UNKNOWN');
 assert.equal(src.health.irsPowered,false);
 assert.equal(src.health.attitudeValid,false);
 assert.equal(src.health.adcQuality,'UNKNOWN');
 assert.equal(src.health.radioAltQuality,'UNKNOWN');
 assert.equal(src.health.displayPowered,true);
 assert.equal(src.health.sgVideo,true);
});
test('receiving display power and SG video are diagnosed independently',()=>{
 const src=Sources.resolve(snapshot(),'CAPT',{}, {1:false,2:true},{1:true,2:false},{});
 assert.equal(src.health.displayPowered,false);
 assert.equal(src.health.sgVideo,true);
});
