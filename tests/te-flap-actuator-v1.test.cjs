const test=require('node:test'),assert=require('node:assert/strict');
const flap=require('../engine/systems/te-flap-actuator-v1.js');
const EPS=.0001;
function goto(s,target,seconds){
 s=flap.apply(s,{type:'COMMAND',value:target});
 for(let remaining=seconds;remaining>0;){const dt=Math.min(60,remaining);s=flap.apply(s,{type:'TICK',seconds:dt});remaining-=dt;}
 return s;
}
test('owner calibrated segment durations, total UP to 40 in 50.8 seconds',()=>{
 const s=flap.initialState();
 for(const [a,b,d] of [[0,1,11],[1,2,10.7],[2,5,9.4],[5,10,5.1],[10,15,5],[15,25,2.3],[25,30,2.3],[30,40,5]])
  assert.equal(flap.estimate(s,a,b),d);
 assert.equal(flap.estimate(s,15,40),9.6);
 assert.equal(flap.estimate(s,40,15),9.6);
 assert.equal(flap.estimate(s,0,40),50.8);
 assert.equal(flap.estimate(s,40,0),50.8);
});
test('lever jumps immediately while actual flaps and both needles must interpolate',()=>{
 let s=flap.initialState();
 s=flap.apply(s,{type:'COMMAND',value:1});
 assert.equal(s.command,1);assert.equal(s.actual,0);
 s=flap.apply(s,{type:'TICK',seconds:5.5});
 assert.ok(Math.abs(s.actual-.5)<EPS);
 s=flap.apply(s,{type:'TICK',seconds:5.5});
 assert.equal(s.actual,1);
 s=goto(s,2,10.7);assert.equal(s.actual,2);
 s=goto(s,5,9.4);assert.equal(s.actual,5);
});
test('high detents complete rapidly but not instantly',()=>{
 let s=flap.initialState();
 s=goto(s,15,41.2);assert.equal(s.actual,15);
 s=flap.apply(s,{type:'COMMAND',value:40});
 s=flap.apply(s,{type:'TICK',seconds:2.3});
 assert.equal(s.actual,25);
 s=flap.apply(s,{type:'TICK',seconds:2.3});
 assert.equal(s.actual,30);
 s=flap.apply(s,{type:'TICK',seconds:5});
 assert.equal(s.actual,40);
});
test('retraction is staged, reversible mid-movement, 15->40 and 40->15 symmetrical',()=>{
 let s=goto(flap.initialState(),40,60);
 s=flap.apply(s,{type:'TICK',seconds:7.5});
 assert.equal(s.actual,40);
 s=goto(s,15,9.6);assert.equal(s.actual,15);
 s=goto(s,5,10.1);assert.equal(s.actual,5);
 s=goto(s,0,31.1);assert.equal(s.actual,0);
 s=goto(s,15,41.2);assert.equal(s.actual,15);
 s=goto(s,5,2);
 assert.ok(s.actual<15&&s.actual>5);
 s=goto(s,15,2);assert.equal(s.actual,15);
});
test('hydraulic pressure changes speed and hydraulic B failure freezes position',()=>{
 let s=flap.initialState();
 s=flap.apply(s,{type:'PRESSURE',psi:1500});
 assert.equal(flap.estimate(s,0,1),22);
 s=goto(s,1,11);assert.ok(Math.abs(s.actual-.5)<EPS);
 s=flap.apply(s,{type:'HYDRAULIC',value:false});
 const before=s.actual;
 s=goto(s,2,20);assert.equal(s.actual,before);
 assert.equal(flap.estimate(s,s.actual,2),Infinity);
 s=flap.apply(s,{type:'HYDRAULIC',value:true});
 s=flap.apply(s,{type:'PRESSURE',psi:3000});
 s=flap.apply(s,{type:'TICK',seconds:5.5});assert.equal(s.actual,1);
 s=flap.apply(s,{type:'TICK',seconds:10.7});assert.equal(s.actual,2);
});
test('custom calibration is stored per state and invalid timing is rejected',()=>{
 const original=flap.initialState();
 const s=flap.apply(original,{type:'CALIBRATE',from:1,to:2,seconds:18});
 assert.equal(flap.estimate(s,1,2),18);
 assert.equal(flap.estimate(original,1,2),10.7);
 assert.throws(()=>flap.apply(s,{type:'CALIBRATE',from:1,to:5,seconds:10}));
 assert.throws(()=>flap.apply(s,{type:'PRESSURE',psi:-50}));
});
