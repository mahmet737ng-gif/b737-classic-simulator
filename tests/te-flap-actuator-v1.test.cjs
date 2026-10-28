const test=require('node:test'),assert=require('node:assert/strict');
const flap=require('../engine/systems/te-flap-actuator-v1.js');
const EPS=.0001;
function goto(s,target,seconds){
 s=flap.apply(s,{type:'COMMAND',value:target});
 for(let remaining=seconds;remaining>0;){const dt=Math.min(60,remaining);s=flap.apply(s,{type:'TICK',seconds:dt});remaining-=dt;}
 return s;
}
test('owner provisional segment durations, inclusive 15 to 40 in 4.5 seconds',()=>{
 const s=flap.initialState();
 for(const [a,b,d] of [[0,1,20],[1,2,15],[2,5,12],[5,10,9],[10,15,7],[15,25,2],[25,30,1.25],[30,40,1.25]])
  assert.equal(flap.estimate(s,a,b),d);
 assert.equal(flap.estimate(s,15,40),4.5);
 assert.equal(flap.estimate(s,40,15),4.5);
});
test('lever jumps immediately while actual flaps and both needles must interpolate',()=>{
 let s=flap.initialState();
 s=flap.apply(s,{type:'COMMAND',value:1});
 assert.equal(s.command,1);assert.equal(s.actual,0);
 s=flap.apply(s,{type:'TICK',seconds:10});
 assert.ok(Math.abs(s.actual-.5)<EPS);
 s=flap.apply(s,{type:'TICK',seconds:10});
 assert.equal(s.actual,1);
 s=goto(s,2,15);assert.equal(s.actual,2);
 s=goto(s,5,12);assert.equal(s.actual,5);
});
test('high detents complete rapidly but not instantly',()=>{
 let s=flap.initialState();
 s=goto(s,15,63);assert.equal(s.actual,15);
 s=flap.apply(s,{type:'COMMAND',value:40});
 s=flap.apply(s,{type:'TICK',seconds:2});
 assert.equal(s.actual,25); // 15 to 25 takes 2 seconds
 s=flap.apply(s,{type:'TICK',seconds:2.5});
 assert.equal(s.actual,40);
});
test('retraction is staged, reversible mid-movement, 15->40 and 40->15 symmetrical',()=>{
 let s=goto(flap.initialState(),40,60);
 s=flap.apply(s,{type:'TICK',seconds:7.5});
 assert.equal(s.actual,40);
 s=goto(s,15,4.5);assert.equal(s.actual,15);
 s=goto(s,5,16);assert.equal(s.actual,5);
 s=goto(s,0,47);assert.equal(s.actual,0);
 s=goto(s,15,63);assert.equal(s.actual,15);
 s=goto(s,5,2);
 assert.ok(s.actual<15&&s.actual>5);
 s=goto(s,15,2);assert.equal(s.actual,15);
});
test('hydraulic pressure changes speed and hydraulic B failure freezes position',()=>{
 let s=flap.initialState();
 s=flap.apply(s,{type:'PRESSURE',psi:1500});
 assert.equal(flap.estimate(s,0,1),40);
 s=goto(s,1,20);assert.ok(Math.abs(s.actual-.5)<EPS);
 s=flap.apply(s,{type:'HYDRAULIC',value:false});
 const before=s.actual;
 s=goto(s,2,20);assert.equal(s.actual,before);
 assert.equal(flap.estimate(s,s.actual,2),Infinity);
 s=flap.apply(s,{type:'HYDRAULIC',value:true});
 s=flap.apply(s,{type:'PRESSURE',psi:3000});
 s=flap.apply(s,{type:'TICK',seconds:10});assert.equal(s.actual,1);
});
test('custom calibration is stored per state and invalid timing is rejected',()=>{
 const original=flap.initialState();
 const s=flap.apply(original,{type:'CALIBRATE',from:1,to:2,seconds:18});
 assert.equal(flap.estimate(s,1,2),18);
 assert.equal(flap.estimate(original,1,2),15);
 assert.throws(()=>flap.apply(s,{type:'CALIBRATE',from:1,to:5,seconds:10}));
 assert.throws(()=>flap.apply(s,{type:'PRESSURE',psi:-50}));
});
