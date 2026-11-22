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
test('owner-locked LE engine accepts autoslat on 1/2/5 and returns to EXT in normal training motion',()=>{
 let s=LE.initialState();
 s=LE.apply(s,{type:'FLAP_LEVER',value:5});
 s=LE.apply(s,{type:'GROUND',value:false});
 s=LE.apply(s,{type:'TICK',seconds:5}); // Instructor non-timed mode, intermediate EXT.
 assert.equal(s.position.SLAT_1,1);
 s=LE.apply(s,{type:'AUTOSLAT',value:true});
 s=LE.apply(s,{type:'TICK',seconds:5});
 assert.equal(s.position.SLAT_1,2);
 s=LE.apply(s,{type:'AUTOSLAT',value:false});
 s=LE.apply(s,{type:'TICK',seconds:5});
 assert.equal(s.position.SLAT_1,1);
 assert.equal(s.position.FLAP_1,1);
 const ground=LE.apply(s,{type:'GROUND',value:true});
 assert.equal(LE.evaluate(ground).autoslatInhibit,false);
});
test('PTU backup extends only autoslats in approved core, not regular LE flaps',()=>{
 let s=LE.initialState();
 s=LE.apply(s,{type:'FLAP_LEVER',value:5});
 s=LE.apply(s,{type:'HYDRAULIC',system:'B',value:false});
 s=LE.apply(s,{type:'GROUND',value:false});
 s=LE.apply(s,{type:'AUTOSLAT',value:true});
 s=LE.apply(s,{type:'TICK',seconds:10});
 assert.equal(s.position.SLAT_1,2);
 assert.equal(s.position.FLAP_1,0);
});
test('locked first-extension 0-32s schedule must not be overwritten by external integration',()=>{
 let s=LE.initialState();
 s=LE.apply(s,{type:'FLAP_LEVER',value:5});
 s=LE.apply(s,{type:'START_LE_SEQUENCE'});
 s=LE.apply(s,{type:'FOLLOW_TE',position:5,command:5});
 s=LE.apply(s,{type:'GROUND',value:false});
 s=LE.apply(s,{type:'AUTOSLAT',value:true});
 s=LE.apply(s,{type:'TICK',seconds:12,motionProfile:'TIMED',pressureFactor:1});
 assert.equal(s.autoslatsRequested,true);
 assert.ok(s.position.SLAT_1<=1.01,
  'OWNER FINAL initial schedule remains unchanged and is a known Auto Slat integration limitation');
});

test('one instructor flight state drives flap drag, continuous autoslat, shaker and stall margin',()=>{
 const source=Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  altitudeFt:7000,speedKt:139,vsFpm:0});
 let s=Flight.command(source,{type:'AERO_CONFIG',
  flapLever:5,flapActual:5,slatsFull:false,massKg:54000});
 s=Flight.step(s,.2);
 assert.equal(s.autoSlatRequest,true,'same IAS/shaker envelope requests autoslats');
 assert.ok(s.autoSlatTrainingFraction>0&&s.autoSlatTrainingFraction<1);
 assert.equal(s.aeroEnvelope.slatEffectSource,'TRAINING_AUTO_SLAT_DELAY_PROXY');
 const startingShaker=s.aeroEnvelope.stickShakerKt;
 for(let k=0;k<19;k++)s=Flight.step(s,.2);
 assert.ok(s.autoSlatTrainingFraction>.95,'training proxy extends smoothly over ~4s');
 assert.ok(s.aeroEnvelope.stickShakerKt<startingShaker,
  'increasing slat lift reduces the same EADI shaker speed');
 assert.equal(s.aeroEnvelope.flapActual,5);
 assert.ok(s.aeroEnvelope.flapDragKtSec>0);
 const withdrawn=Flight.command(s,{type:'AERO_CONFIG',
  flapLever:10,flapActual:10,slatsFull:false,massKg:54000});
 let retract=Flight.step(withdrawn,.2);
 assert.equal(retract.autoSlatRequest,false,'FLAP 10 inhibits autoslat');
 assert.ok(retract.autoSlatTrainingFraction<s.autoSlatTrainingFraction);
 for(let k=0;k<40;k++)retract=Flight.step(retract,.2);
 assert.ok(retract.autoSlatTrainingFraction<.01,
  'proxy retracts instead of staying latched after flap selection changes');
 assert.equal(retract.aeroEnvelope.slatExtension,0);
});

test('FLAPS 30 at 54-ton nominal training mass stalls near 115 KIAS; shaker stays higher',()=>{
 const result=evalAt({massKg:54000,iasKt:145,flapLever:30,
  flapActual:30,bankDeg:0,airborne:true});
 assert.ok(Math.abs(result.stallKt-115)<=2,
  'FLAPS 30 expected approximately 115 KT stall, got '+result.stallKt);
 assert.ok(Math.abs(result.stickShakerKt-124)<2,
  'shaker speed must be distinct from stall speed');
 assert.equal(result.belowStall,false);
 assert.equal(result.belowShaker,false);
 assert.equal(result.calibrated,false,'trainer estimate is not AFM verified');
 const slowed=evalAt({massKg:54000,iasKt:112,flapLever:30,flapActual:30});
 assert.equal(slowed.belowStall,true);
 assert.equal(slowed.belowShaker,true);
 const heavier=evalAt({massKg:65000,flapLever:30,flapActual:30});
 assert.ok(heavier.stallKt>result.stallKt);
 const banked=evalAt({massKg:54000,flapLever:30,flapActual:30,bankDeg:35});
 assert.ok(banked.stallKt>result.stallKt);
});

test('real TE FLAPS 30 updates the live stall envelope immediately even before unpausing',()=>{
 const initial=Flight.newScenario({airport:'OIII',preset:'MANUAL',airborne:true,
  altitudeFt:6000,speedKt:145,vsFpm:-600});
 const frozen=Flight.command(initial,{type:'PAUSE',value:true});
 const leverOnly=Flight.command(frozen,{type:'AERO_CONFIG',flapLever:30,
  flapActual:0,slatsFull:false,massKg:54000});
 assert.equal(leverOnly.flapLever,30);
 assert.equal(leverOnly.flapActual,0);
 assert.ok(leverOnly.aeroEnvelope.stallKt>145,
  'flap lever alone never grants actual TE-flap lift credit');
 const extended=Flight.command(leverOnly,{type:'AERO_CONFIG',flapLever:30,
  flapActual:30,slatsFull:false,massKg:54000});
 assert.ok(Math.abs(extended.aeroEnvelope.stallKt-115)<=2);
 assert.ok(extended.aeroEnvelope.stickShakerKt>extended.aeroEnvelope.stallKt);
 assert.equal(extended.iasKt,initial.iasKt,'config change cannot accelerate airplane');
 assert.equal(extended.altitudeFt,initial.altitudeFt,'config change cannot move aircraft');
 assert.equal(extended.elapsedSec,initial.elapsedSec,'config is available while paused');
 assert.equal(extended.paused,true);
 assert.equal(Flight.step(extended,.2).aeroEnvelope.stallKt,extended.aeroEnvelope.stallKt);
});
