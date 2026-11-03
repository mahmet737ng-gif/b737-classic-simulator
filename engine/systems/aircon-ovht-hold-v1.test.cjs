'use strict';
const assert=require('node:assert/strict');
const H=require('./aircon-ovht-hold-v1.js');
let ms=0,seq=0,events=[],timers=new Map();
const clock=()=>ms;
const schedule=(fn,delay)=>{const id=++seq;timers.set(id,{at:ms+delay,fn});return id;};
const cancel=id=>timers.delete(id);
function advance(time){
 assert.ok(time>=ms);ms=time;
 for(let spin=0;spin<20;spin++){
  const due=[...timers.entries()].filter(([,job])=>job.at<=ms).sort((a,b)=>a[1].at-b[1].at);
  if(!due.length)break;
  for(const [id,job]of due){timers.delete(id);job.fn()}
 }
}
const h=H.create({clock,schedule,cancel,onQualified:()=>events.push('ON'),
 onReleased:()=>events.push('OFF')});
assert.equal(H.DELAY_MS,5000);
h.press();assert.equal(h.snapshot().qualified,false);assert.deepEqual(events,[]);
advance(4999);assert.equal(h.snapshot().qualified,false);
assert.deepEqual(events,[],'Even 4999ms holds must NOT light WING BODY');
advance(5000);assert.equal(h.snapshot().qualified,true);assert.deepEqual(events,['ON']);
advance(7500);h.press();assert.deepEqual(events,['ON'],'Duplicate down does not re-qualify');
h.release();assert.deepEqual(events,['ON','OFF']);
assert.equal(h.snapshot().held,false);
assert.equal(h.snapshot().qualified,false);
assert.equal(timers.size,0);
h.press();advance(11999);h.release();
assert.deepEqual(events,['ON','OFF'],'Short hold rejected with no lamp activity');
advance(20000);assert.deepEqual(events,['ON','OFF'],'Cancelled timeouts never relight');
h.press();advance(24999);assert.deepEqual(events,['ON','OFF']);
advance(25000);assert.deepEqual(events,['ON','OFF','ON']);
h.release();assert.deepEqual(events,['ON','OFF','ON','OFF']);
let rejected=0;
const bad=H.create({clock,schedule,cancel,onQualified:()=>{rejected++;throw Error('ECU OFFLINE')}});
bad.press();assert.throws(()=>advance(30000),/ECU OFFLINE/);
assert.equal(rejected,1);
assert.equal(bad.snapshot().qualified,false,'A rejected ECU command must never mark test qualified');
bad.release();
assert.throws(()=>H.create({delayMs:-1}),/Invalid/);
console.log('PASS: full 5000ms quiet delay, then one ON, release OFF, short/repeated presses do nothing, timer cancellation and rejected ECU safety.');
