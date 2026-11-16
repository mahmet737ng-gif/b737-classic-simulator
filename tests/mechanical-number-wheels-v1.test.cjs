'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Wheel=require('../engine/instruments/mechanical-number-wheels-v1.js');
test('IAS units roll continuously with fractional indicated speed',()=>{
 const a=Wheel.frames(190.25,3),b=Wheel.frames(190.75,3);
 assert.deepEqual(a.map(x=>x.digit),[1,9,0]);
 assert.deepEqual(b.map(x=>x.digit),[1,9,0]);
 assert.ok(a[2].fraction>0&&a[2].fraction<b[2].fraction);
 assert.equal(a[1].fraction,0,'tens should not drift until carry window');
});
test('carry into tens/hundreds happens only near decade and century rollover',()=>{
 const before=Wheel.frames(198,3),during=Wheel.frames(199.9,3),after=Wheel.frames(200,3);
 assert.equal(before[1].fraction,0);
 assert.ok(during[1].fraction>.9);
 assert.ok(during[0].fraction>.9,'hundreds should follow 199-to-200 transition');
 assert.deepEqual(after.map(x=>x.digit),[2,0,0]);
});
test('altitude window 09980 to 10000 rotates continuously through all carry columns',()=>{
 const prior=Wheel.frames(9989,5),moving=Wheel.frames(9999.9,5),after=Wheel.frames(10000,5);
 assert.deepEqual(prior.map(x=>x.digit),[0,9,9,8,9]);
 assert.ok(moving.every(x=>x.fraction>.9));
 assert.deepEqual(after.map(x=>x.digit),[1,0,0,0,0]);
});
test('negative invalid and overflowing drum inputs are rejected instead of fake digits',()=>{
 assert.throws(()=>Wheel.frames(NaN,3),RangeError);
 assert.throws(()=>Wheel.frames(-1,3),RangeError);
 assert.throws(()=>Wheel.frames(100,0),RangeError);
 assert.throws(()=>Wheel.frames(100,7),RangeError);
});
