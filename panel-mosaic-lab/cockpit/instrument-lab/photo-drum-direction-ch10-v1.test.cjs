'use strict';
// FCOM style photo altimeter/ASI and standby mechanical wheel visual direction.
// This checks the runtime renderer, not the source-value digit arithmetic.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Wheel=require('../../../engine/instruments/mechanical-number-wheels-v1.js');
const gauge=fs.readFileSync(path.join(__dirname,'gauges.js'),'utf8');
test('Photo mechanical wheels scroll DOWN on increase, UP on decrease',()=>{
 assert.ok(gauge.includes('t.glyphs[0].textContent=String(f.next)'),
  'upcoming digit is ABOVE viewport center');
 assert.ok(gauge.includes('t.glyphs[2].textContent=String(f.previous)'),
  'previous digit remains BELOW viewport center');
 assert.ok(gauge.includes("t.moving.setAttribute('transform','translate(0 '+(f.fraction*stride)+')')"),
  'wheel must translate DOWN with positive phase, including IAS and both altimeters');
});
test('FCOM 20-foot altitude wheels preserve correct carry timing after direction correction',()=>{
 const a=Wheel.framesTwenty(12970,5),b=Wheel.framesTwenty(12990,5);
 assert.equal(a[1].fraction,0);
 assert.equal(b[1].fraction,.5);
 const a2=Wheel.framesTwenty(12380,5),b2=Wheel.framesTwenty(12390,5);
 assert.equal(a2[3].digit,8);
 assert.equal(b2[3].digit,8);assert.equal(b2[3].fraction,.5);
});
