const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./air-mix-valve-300500-v1.js');
const live=(c,p)=>({CONT:{selector:c,actuatorPower:true,indicatorPower:true,packMode:'AUTO'},
 PASS:{selector:p,actuatorPower:true,indicatorPower:true,packMode:'AUTO'}});
test('two needles independent, endpoints / 110-degree arc',()=>{
 let s=M.create();s=M.step(s,live('MANUAL COOL','MANUAL WARM'),90);
 assert.equal(s.positions.CONT,0);assert.equal(s.positions.PASS,1);
 assert.equal(M.indication(s,live('MANUAL COOL','MANUAL WARM'),'CONT').angle,-55);
 assert.equal(M.indication(s,live('MANUAL COOL','MANUAL WARM'),'PASS').angle,55);
});
test('actuator power loss retains valve position',()=>{
 const s=M.create(),x=live('MANUAL COOL','MANUAL WARM');x.CONT.actuatorPower=false;
 const r=M.step(s,x,90);assert.equal(r.positions.CONT,0.5);assert.equal(r.positions.PASS,1);
});
test('P6-4 D3 and DC bus2 affect indication only, not physical valve',()=>{
 const x=live('MANUAL WARM','MANUAL COOL');x.CONT.indicatorCB=false;x.PASS.indicatorPower=false;
 const r=M.step(M.create(),x,90);
 assert.equal(r.positions.CONT,1);assert.equal(r.positions.PASS,0);
 assert.equal(M.indication(r,x,'CONT').valid,false);assert.equal(M.indication(r,x,'PASS').valid,false);
});
test('AUTO needs real sensor sample; deadband holds',()=>{
 let x=live('AUTO NORM','AUTO NORM'),s=M.create();s=M.step(s,x,60);
 assert.equal(s.positions.CONT,0.5);assert.equal(s.reason.CONT,'SENSOR_UNKNOWN');
 x.CONT.cabinC=22.2;s=M.step(s,x,60);assert.equal(s.positions.CONT,0.5);
 x.CONT.cabinC=15;s=M.step(s,x,60);assert.ok(s.positions.CONT>0.5);
});
test('duct limit overrides manual warm; pack OFF drives full cold',()=>{
 let x=live('MANUAL WARM','AUTO NORM');x.CONT.ductC=61;x.PASS.packMode='OFF';
 const r=M.step(M.create(),x,90);assert.equal(r.positions.CONT,0);assert.equal(r.positions.PASS,0);
});
test('88C duct overheat latches until reset',()=>{
 let x=live('MANUAL WARM','AUTO NORM');x.CONT.ductC=90;
 let s=M.step(M.create(),x,1);assert.equal(s.overheatLatched.CONT,true);
 x.CONT.ductC=20;assert.equal(M.resetOverheat(s,'CONT',x),true);
 assert.equal(s.overheatLatched.CONT,false);
});
test('stuck valve does not follow command',()=>{
 const x=live('MANUAL WARM','MANUAL COOL');x.PASS.stuck=true;
 const r=M.step(M.create(),x,90);assert.equal(r.positions.PASS,0.5);
});
