'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../engine/flight/flight-scenario-core-v1.js');
const html=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/index.html'),'utf8');
const panel=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/flight-scenario-panel-v1.js'),'utf8');
test('OIFM is in both Flight Phase selectors and the scenario registry',()=>{
 const a=core.AIRPORTS.OIFM;
 assert(a);
 assert.equal(a.name,'Esfahan / Shahid Beheshti International');
 assert.equal(a.defaultRunway,'25R');
 for(const markup of [html,panel])assert.match(markup,/<option value="OIFM">ESFAHAN · OIFM<\/option>/);
 assert.match(panel,/Object.values\(Core.AIRPORTS\)/);
});
test('OIFM four true runway bearings and training final locations',()=>{
 const a=core.AIRPORTS.OIFM;
 assert.deepEqual(Object.keys(a.runways),['07L','25R','07R','25L']);
 assert.equal(a.runways['07L'],77.93);assert.equal(a.runways['25R'],257.96);
 assert.equal(a.runways['07R'],77.93);assert.equal(a.runways['25L'],257.96);
 assert.match(panel,/'25R':Object.freeze\(\{lat:32\.75701944,lon:51\.883725,elevationFt:5043,courseTrueDeg:257\.96,glideDeg:2\.63,tchFt:55\}\)/);
 for(const runway of Object.keys(a.runways)){
  for(const preset of ['RUNWAY_READY','FINAL_5','FINAL_10']){
   const scenario=core.newScenario({airport:'OIFM',runway,preset});
   assert.equal(scenario.icao,'OIFM');assert.equal(scenario.runway,runway);
   assert(Number.isFinite(scenario.lat)&&Number.isFinite(scenario.lon));
   assert.equal(scenario.runwayHeadingTrueDeg,a.runways[runway]);
   assert(scenario.altitudeFt>=a.elevationFt);
  }
 }
});
