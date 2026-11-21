'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const Envelope=require('../engine/flight/classic-low-speed-envelope-v1.js');
const Flight=require('../engine/flight/flight-scenario-core-v1.js');
const LE=require('../engine/systems/le-devices-classic-v1.js');
const base={massKg:54000,iasKt:140,flapLever:0,flapActual:0,
 slatsFull:false,bankDeg:0,airborne:true,autoSlatPreviouslyRequested:false};
const evalAt=changes=>Envelope.evaluate({...base,...changes});
test('stall and yellow/red margin are mass, bank and actual-flap dependent, not a fixed speed',()=>{
 const clean=evalAt({});
 const flaps=evalAt({flapLever:40,flapActual:40});
 const heavy=evalAt({massKg:66000});
 const turning=evalAt({bankDeg:35});
 assert.ok(flaps.stallKt<clean.stallKt,'Actual full flaps increase illustrative CLmax');
 assert.ok(heavy.stallKt>clean.stallKt,'Heavier mass raises stall speed');
 assert.ok(turning.stallKt>clean.stallKt,'Bank load factor raises stall speed');
 assert.ok(clean.stickShakerKt>clean.stallKt);
 assert.ok(clean.minimumManeuverKt>clean.stickShakerKt);
 assert.equal(clean.calibrated,false);
 assert.equal(clean.source,'INSTRUCTOR_AERO_PROXY_NOT_FCOM_DATA');
 assert.equal(evalAt({}).massSource,'OBSERVED_TRAINING_MASS');
 assert.equal(evalAt({massKg:null}).massSource,'ASSUMED_54000_KG');
});
test('autoslat is inhibited on ground and off the 1/2/5 detents; triggers before surrogate shaker',()=>{
 const near=evalAt({flapLever:5,flapActual:5,iasKt:135});
 assert.equal(near.autoSlatEligible,true);
 assert.equal(near.autoSlatRequest,true);
 assert.equal(evalAt({flapLever:5,flapActual:5,iasKt:135,airborne:false}).autoSlatRequest,false);
 assert.equal(evalAt({flapLever:10,flapActual:10,iasKt:115}).autoSlatRequest,false);
 assert.equal(evalAt({flapLever:0,flapActual:0,iasKt:100}).autoSlatRequest,false);
 assert.equal(evalAt({flapLever:5,flapActual:5,iasKt:185}).autoSlatRequest,false);
 const extended=evalAt({flapLever:5,flapActual:5,slatsFull:true,iasKt:145});
 assert.ok(extended.stallKt<evalAt({flapLever:5,flapActual:5,iasKt:145}).stallKt);
});
test('actual TE flaps create drag and near-stall speed produces bounded sink in physical flight model',()=>{
 const initial=Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  altitudeFt:11000,speedKt:185,vsFpm:0});
 const flapped=Flight.command(initial,{type:'AERO_CONFIG',flapLever:30,
  flapActual:30,slatsFull:false,massKg:54000});
 const clean=Flight.step(initial,1);
 const dirty=Flight.step(flapped,1);
 assert.ok(dirty.iasKt<clean.iasKt,'Flap drag changes observed IAS');
 assert.equal(dirty.aeroEnvelope.flapActual,30);
 assert.ok(dirty.aeroEnvelope.flapDragKtSec>0);
 const slow=Flight.command(Flight.newScenario({airport:'OIII',preset:'MANUAL',
  airborne:true,altitudeFt:11000,speedKt:105,vsFpm:0}),{
  type:'AERO_CONFIG',flapLever:0,flapActual:0,slatsFull:false,massKg:54000});
 const next=Flight.step(slow,.2);
 assert.equal(next.aeroEnvelope.belowStall,true);
 assert.ok(next.vsFpm<0,'Low-speed lift loss lowers actual vertical response');
 assert.ok(next.vsFpm>-100,'Sink is rate-limited, never teleported');
});
test('LE computer actuates full autoslats and returns to intermediate when requested off',()=>{
 let s=LE.initialState();
 s=LE.apply(s,{type:'FLAP_LEVER',value:5});
 s=LE.apply(s,{type:'START_LE_SEQUENCE'});
 s=LE.apply(s,{type:'FOLLOW_TE',position:5,command:5});
 s=LE.apply(s,{type:'GROUND',value:false});
 s=LE.apply(s,{type:'AUTOSLAT',value:true});
 s=LE.apply(s,{type:'TICK',seconds:12,motionProfile:'TIMED',pressureFactor:1});
 assert.ok(s.position.SLAT_1>1.99,'Slats extended through timed actuator');
 assert.equal(s.position.FLAP_1,1);
 s=LE.apply(s,{type:'AUTOSLAT',value:false});
 s=LE.apply(s,{type:'TICK',seconds:6,motionProfile:'TIMED',pressureFactor:1});
 assert.ok(s.position.SLAT_1<=1.001,'Slats return to intermediate when demand clears');
 const ground=LE.apply(s,{type:'GROUND',value:true});
 assert.equal(LE.evaluate(ground).autoslatInhibit,false);
});
test('auto slat PTU backup cannot become hydraulic power for ordinary LE flaps',()=>{
 let s=LE.initialState();
 s=LE.apply(s,{type:'FLAP_LEVER',value:5});
 s=LE.apply(s,{type:'START_LE_SEQUENCE'});
 s=LE.apply(s,{type:'FOLLOW_TE',position:5,command:5});
 s=LE.apply(s,{type:'HYDRAULIC',system:'B',value:false});
 s=LE.apply(s,{type:'GROUND',value:false});
 s=LE.apply(s,{type:'AUTOSLAT',value:true});
 s=LE.apply(s,{type:'TICK',seconds:12,motionProfile:'TIMED',pressureFactor:1});
 assert.ok(s.position.SLAT_1>1.99,'System A/PTU supplies autoslat extension');
 assert.equal(s.position.FLAP_1,0,'PTU alone cannot extend ordinary LE flaps');
});
