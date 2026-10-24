'use strict';
const assert=require('node:assert/strict');
const api=require('../engine.js');
assert.equal(api.allVariants().length,18);
assert.deepEqual([...api.ANGLES],[-45,0,45]);
assert.deepEqual([...api.LIGHTS],['ON','OFF']);
assert.deepEqual([...api.UNITS],['APU','ENG1','ENG2']);
for(const unit of api.UNITS){
 const ctl=api.controller(unit,{light:'OFF'});
 assert.equal(ctl.getState().angle_deg,0);
 assert.equal(ctl.getState().handle_position,'IN');
 assert.equal(ctl.getState().discharge_command,false);
 assert.ok(api.SOURCES[unit].ON.includes('FIRE_HANDEL_'+unit+'_ON.webp'));
 assert.ok(api.SOURCES[unit].OFF.includes('FIRE_HANDEL_'+unit+'_OFF.webp'));
 let count=0;
 ctl.subscribe(({state})=>{count++;assert.equal(state.unit,unit);assert.equal(state.discharge_command,false)});
 ctl.setAngle(-45);
 assert.equal(ctl.getState().angle_deg,-45);
 ctl.setLight('ON');assert.equal(ctl.getState().light,'ON');
 ctl.setAngle(45);assert.equal(ctl.getState().angle_deg,45);
 assert.equal(count,3);
 ctl.reset();assert.equal(ctl.getState().angle_deg,0);assert.equal(ctl.getState().light,'OFF');
 assert.throws(()=>ctl.setAngle(90),RangeError);
 assert.throws(()=>ctl.setLight('FLASH'),RangeError);
}
const states=api.allVariants();
for(const v of states){assert.ok(api.ANGLES.includes(v.angle_deg));assert.ok(api.LIGHTS.includes(v.light)); assert.ok(api.UNITS.includes(v.unit)); assert.equal(v.state.image,api.selectAsset(v.unit,v.light));}
console.log('PASS FIRE HANDLE rotation engine: 18 combinations, state events and input validation.');
