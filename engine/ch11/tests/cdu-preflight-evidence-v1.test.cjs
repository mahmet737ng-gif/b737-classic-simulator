'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const src=require('../cdu-preflight-evidence-v1.js');
test('IDENT never displays fabricated model, nav cycle, active date or software revision',()=>{
 for(const name of ['MODEL','ENG_RATING','NAV_DATA','ACTIVE','INACTIVE','OP_PROGRAM','SUPP_DATA']){
  assert.equal(src.identValue(name,{}),'',name);
  assert.equal(src.identValue(name,{[name]:{quality:'VALID',origin:'TRAINING_SCENARIO',value:'DEMO ONLY'}}),'',name);
 }
 assert.equal(src.identValue('MODEL',{MODEL:{quality:'VALID',origin:'VERIFIED_AIRCRAFT_PROFILE',value:'737-400'}}),'737-400');
 assert.equal(src.identValue('OP_PROGRAM',{OP_PROGRAM:{quality:'UNKNOWN',origin:'VERIFIED_FMC_SOFTWARE',value:'U10.8A'}}),'');
});
test('FMC last position is a single combined latitude/longitude field only with computed evidence',()=>{
 assert.equal(src.lastPosition({}),'');
 assert.equal(src.lastPosition({lastFmcPosition:{quality:'VALID',origin:'IRS',positionValid:true,lat:35,lon:51}}),'');
 assert.equal(src.lastPosition({lastFmcPosition:{quality:'VALID',origin:'FMC_COMPUTED',positionValid:true,lat:47.54,lon:-122.31}}),'N47°32.4 W122°18.6');
 assert.equal(src.lastPosition({lastFmcPosition:{quality:'VALID',origin:'FMC_COMPUTED',positionValid:true,lat:91,lon:51}}),'');
});
test('POS INIT clock requires valid captain/FO aircraft clock; local PC clock is never substituted',()=>{
 assert.equal(src.clock({}),'');
 const data={clock:{quality:'VALID',origin:'CAPTAIN_CLOCK',valid:true,isoUtc:'2026-10-30T14:32:12Z'}};
 assert.equal(src.clock(data),'1432.2Z10/30');
 assert.equal(src.clock({clock:{...data.clock,origin:'HOST_PC_CLOCK'}}),'');
});
test('Set IRS position is shown only during a verified, uninitialized ALIGN',()=>{
 assert.equal(src.irsPositionPrompt({}),'');
 assert.equal(src.irsPositionPrompt({irs:{L:{mode:'ALIGN',powered:true,positionEntered:false}}}),'□□□□');
 assert.equal(src.irsPositionPrompt({irs:{L:{mode:'ALIGN',powered:true,positionEntered:true}}}),'');
 assert.equal(src.irsPositionPrompt({irs:{L:{mode:'NAV',powered:true,positionEntered:false}}}),'');
});
test('ATT-mode heading field is hidden unless an actual powered IRS is in ATT',()=>{
 assert.equal(src.irsHeadingAvailable({}),false);
 assert.equal(src.irsHeadingAvailable({irs:{L:{mode:'ATT',powered:false}}}),false);
 assert.equal(src.irsHeadingAvailable({irs:{R:{mode:'ATT',powered:true}}}),true);
});
