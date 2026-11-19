'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const Fire=require('../engine');
const {create,thresholds}=require('../thermal-trainer');
const fireTest={type:'TEST',value:'OVHT_FIRE'};
test('local temperature drives warning stages and independent engine readings',()=>{
 const lab=create(Fire),other=create(Fire);
 assert.equal(lab.snapshot().equipment.ENG1.n1,85);
 assert.equal(lab.snapshot().equipment.ENG2.n1,85);
 assert.equal(lab.snapshot().equipment.APU.n1,100);
 lab.setTemperature('ENG1',thresholds.overheat+12);lab.tick(3);
 assert.equal(lab.snapshot().equipment.ENG1.stage,'OVHT');
 assert.equal(lab.evaluate().indications.ENG1_FIRE,false);
 assert.ok(lab.snapshot().equipment.ENG1.egt>560);
 lab.setTemperature('ENG1',thresholds.fire+25);lab.tick(3);
 assert.equal(lab.snapshot().equipment.ENG1.stage,'FIRE');
 assert.deepEqual(lab.snapshot().cues,[true,true,true]);
 assert.equal(other.getState().engineFire.ENG1,false);
 lab.dispatch({type:'PULL',unit:'ENG1'});const prior=lab.snapshot().equipment.ENG1.egt;lab.tick(2);
 assert.ok(lab.snapshot().equipment.ENG1.egt<prior);
 assert.ok(lab.snapshot().equipment.ENG1.n1<85);
 assert.equal(lab.snapshot().equipment.ENG2.n1,85);
});
test('three independent false cues do not change compartment heat, EGT or handle lock',()=>{
 const lab=create(Fire);
 for(const [cue,i] of [['HANDLE',0],['OVERHEAT',1],['BELL',2]]){
  lab.faultCue(cue);lab.tick(4);
  assert.deepEqual(lab.snapshot().cues,[0,1,2].map(n=>n===i));
  assert.equal(lab.snapshot().equipment.ENG1.egt,560);
  assert.equal(lab.evaluate().handleUnlock.ENG1,false);
 }
 lab.dispatch({type:'BELL_CUTOUT'});
 assert.equal(lab.evaluate().indications.FIRE_BELL,false);
});
test('wheel AC supply, detector breakers, and DC visual test paths are distinct',()=>{
 const lab=create(Fire);
 lab.dispatch(fireTest);
 assert.equal(lab.evaluate().indications.WHEEL_WELL,true);
 assert.equal(lab.evaluate().testLamps.APU_BOTTLE_DISCHARGED,true);
 assert.equal(lab.evaluate().indications.APU_BOTTLE_DISCHARGED,false);
 lab.dispatch({type:'SET_POWER',bus:'acTransfer1',active:false});
 assert.equal(lab.evaluate().indications.WHEEL_WELL,false);
 assert.equal(lab.evaluate().indications.APU_FIRE,true);
 lab.setBreaker('engine1.fireDetector',false);
 assert.equal(lab.evaluate().indications.ENG1_FIRE,false);
 assert.equal(lab.evaluate().indications.ENG2_FIRE,true);
 lab.setBreaker('warning.aural',false);
 assert.equal(lab.evaluate().indications.MASTER_FIRE_WARN,true);
 assert.equal(lab.evaluate().indications.FIRE_BELL,false);
 lab.dispatch({type:'SET_POWER',bus:'hotBatteryBus',active:false});
 assert.equal(lab.evaluate().testLamps.APU_BOTTLE_DISCHARGED,false);
});
