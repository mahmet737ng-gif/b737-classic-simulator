'use strict';
/* Two different IRS latitude tests: user training 4NM and genuine IRU
 * sine/cosine comparison. 4NM ORIGIN airport warning is NOT an IRU test.
 * This file validates numeric sensor-vs-pilot comparisons independently.
 */
const assert=require('node:assert/strict');
const Core=require('../engine/systems/irs-trainer-core-v1.cjs');
const grounded={dtSec:5,stationary:true,valid:true,gsKt:0,trueTrackDeg:0};
function boot(opts={}){
 let s=Core.initialState({...opts,requireIndependentLatitude:true});
 s=Core.apply(s,{type:'POWER',side:'L',available:true});
 s=Core.apply(s,{type:'SELECT_MODE',side:'L',mode:'NAV'});
 return s;
}
function position(s,pos,origin){
 return Core.apply(s,{type:'FMC_SET_IRS_POS',sides:['L'],position:pos,originPosition:origin});
}
function computed(s,latitudeDeg,source='SIMULATOR_SENSOR'){
 return Core.apply(s,{type:'SET_COMPUTED_LATITUDE',side:'L',latitudeDeg,source});
}
function complete(s){
 s=Core.tick(s,{...grounded,dtSec:3.5});
 for(let n=0;n<120;n++)s=Core.tick(s,grounded);
 return s;
}
// Exact four-arcminute latitude difference equals 4NM, including boundary.
let s=boot();
s=computed(s,35);
s=position(s,'N35040 E051254');
s=complete(s);
assert.equal(Core.status(s,'L').phase,'NAV_READY');
assert.equal(Core.status(s,'L').positionValid,true);
assert(Math.abs(Core.status(s,'L').latitudeComparisonNm-4)<1e-6);
assert.equal(Core.status(s,'L').computedLatitudeDeg,35);
assert.equal(Core.status(s,'L').computedLatitudeSource,'SIMULATOR_SENSOR');
assert.equal(Core.status(s,'L').latitudeComparisonPolicy,'OWNER_4NM');
// Difference >4NM flashes ALIGN on first entry and FAULT on an identical retry.
s=boot();s=computed(s,35);s=position(s,'N35050 E051254');
s=complete(s);
assert.equal(Core.status(s,'L').positionValid,false);
assert.equal(Core.status(s,'L').alignStatusCode,2);
assert.equal(Core.status(s,'L').alignLampFlashing,true);
assert.equal(Core.status(s,'L').faultLamp,false);
assert.equal(s.units.L.computedRejectCount,1);
assert(Math.abs(Core.status(s,'L').latitudeComparisonNm-5)<1e-6);
s=position(s,'N35050 E051254');
assert.equal(Core.status(s,'L').faultLamp,true);
assert.equal(Core.status(s,'L').alignStatusCode,2);
assert.equal(Core.status(s,'L').positionValid,false);
assert.throws(()=>position(s,'N35010 E051254'),/INTERNAL FAULT/);
// Different corrected latitude passes with no false FAULT.
s=boot();s=computed(s,35);s=position(s,'N35050 E051254');s=complete(s);
s=position(s,'N35020 E051254');
assert.equal(Core.status(s,'L').phase,'NAV_READY');
assert.equal(Core.status(s,'L').faultLamp,false);
assert(Math.abs(Core.status(s,'L').latitudeComparisonNm-2)<1e-6);
// Sensor is NEVER fabricated from pilot-entered latitude.
s=boot();s=position(s,'N35395 E051254');s=complete(s);
assert.equal(Core.status(s,'L').phase,'WAIT_LATITUDE_SENSOR');
assert.equal(Core.status(s,'L').positionValid,false);
assert.equal(Core.status(s,'L').computedLatitudeDeg,null);
assert.equal(Core.status(s,'L').cduMessage,'IRS LATITUDE NOT AVAILABLE');
assert.throws(()=>computed(s,35,'FMC_INPUT'),/provenance/);
assert.throws(()=>computed(s,91),/latitude/);
s=computed(s,35+39.5/60);
assert.equal(Core.status(s,'L').phase,'NAV_READY');
assert.equal(Core.status(s,'L').positionValid,true);
// Only latitude checked: wildly different longitude cannot be internally
// detected by IRS computed latitude (unless a SEPARATE ORIGIN warning fires).
s=boot();s=computed(s,35);s=position(s,'N35010 W122306');s=complete(s);
assert.equal(Core.status(s,'L').phase,'NAV_READY');
assert.equal(Core.status(s,'L').position.lon<0,true);
// FCOM's 4NM ORIGIN airport check remains separate: advisory only.
s=boot();s=computed(s,35);s=position(s,'N35010 E051254',{lat:36,lon:52});
assert.equal(Core.status(s,'L').warning,'VERIFY POSITION');
s=complete(s);
assert.equal(Core.status(s,'L').phase,'NAV_READY');
assert.equal(Core.status(s,'L').faultLamp,false);
// Genuine classic sine/cos criterion is NOT equivalent to 4NM:
s=boot({latitudeComparisonPolicy:'CLASSIC_SIN_COS'});
s=computed(s,35);s=position(s,'N35050 E051254');s=complete(s);
assert.equal(Core.status(s,'L').phase,'NAV_READY','5NM can pass Classic sin/cos threshold');
assert(Math.abs(Core.status(s,'L').latitudeComparisonNm-5)<1e-6);
assert.equal(Core.status(s,'L').latitudeComparisonPolicy,'CLASSIC_SIN_COS');
// Clear sensor evidence on power interruption: never carry a stale computed
// latitude forward across a subsequent alignment.
s=Core.apply(s,{type:'POWER',side:'L',available:false});
assert.equal(Core.status(s,'L').computedLatitudeDeg,null);
s=Core.apply(s,{type:'POWER',side:'L',available:true});
assert.equal(Core.status(s,'L').phase,'SELFTEST');
assert.equal(Core.status(s,'L').computedLatitudeSource,null);
// L/R sensors are completely independent.
let both=Core.initialState({requireIndependentLatitude:true});
for(const side of ['L','R']){
 both=Core.apply(both,{type:'POWER',side,available:true});
 both=Core.apply(both,{type:'SELECT_MODE',side,mode:'NAV'});
}
both=Core.apply(both,{type:'SET_COMPUTED_LATITUDE',side:'L',latitudeDeg:35,source:'INSTRUCTOR_SENSOR'});
both=Core.apply(both,{type:'SET_COMPUTED_LATITUDE',side:'R',latitudeDeg:36,source:'INSTRUCTOR_SENSOR'});
both=Core.apply(both,{type:'FMC_SET_IRS_POS',position:'N35010 E051254'});
both=complete(both);
assert.equal(Core.status(both,'L').phase,'NAV_READY');
assert.equal(Core.status(both,'R').alignStatusCode,2);
assert.equal(Core.status(both,'R').positionValid,false);
assert.equal(Core.status(both,'L').positionValid,true);
console.log('PASS independent IRS computed-latitude: separate signed sensor evidence, 4NM inclusive, 5NM reject, retry FAULT, corrected position, no invented longitude, separate FMC ORIGIN, strict missing, 737 Classic sin/cos and L/R independence');
