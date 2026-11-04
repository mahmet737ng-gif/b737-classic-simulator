const test=require('node:test'),assert=require('node:assert/strict');
const M=require('./air-mix-valve-300500-v1.js');
const live=(c,p)=>({CONT:{selector:c,actuatorPower:true,indicatorPower:true,packMode:'AUTO'},
 PASS:{selector:p,actuatorPower:true,indicatorPower:true,packMode:'AUTO'}});
test('two needles independent, endpoints / 128-degree arc',()=>{
 let s=M.create();s=M.step(s,live('MANUAL COOL','MANUAL WARM'),90);
 assert.equal(s.positions.CONT,0);assert.equal(s.positions.PASS,1);
 assert.equal(M.indication(s,live('MANUAL COOL','MANUAL WARM'),'CONT').angle,-64);
 assert.equal(M.indication(s,live('MANUAL COOL','MANUAL WARM'),'PASS').angle,64);
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
test('AUTO simulates cabin sensor in normal mode; external samples override',()=>{
 let x=live('AUTO NORM','AUTO NORM'),s=M.create();
 s=M.step(s,x,60);
 assert.ok(s.positions.CONT>0.5,'20°C cabin demands HOT for 22°C');
 assert.ok(s.temperatures.CONT>20,'cabin temperature increases gradually');
 x.CONT.cabinC=22.2;s=M.step(s,x,1);
 assert.equal(s.temperatures.CONT,22.2,'measured sensor value is authoritative');
 assert.ok(s.positions.CONT<1);
});
test('16 to 26°C auto detents converge independently, without immediate needle jumps',()=>{
 for(const target of [16,18,20,22,24,26]){
  const x=live('AUTO '+target,'AUTO NORM');
  let s=M.create();s=M.step(s,x,0.1);
  assert.ok(Math.abs(s.temperatures.CONT-20)<.1,'thermal inertia persists');
  for(let i=0;i<3600;i++)s=M.step(s,x,.2);
  assert.ok(Math.abs(s.temperatures.CONT-target)<.7,target+'°C converges');
  assert.ok(Math.abs(s.temperatures.PASS-22)<.7,'PASS is independent');
  assert.ok(Math.abs(s.positions.CONT-(.5+(target-22)/20))<.06,'steady valve mix position');
 }
});
test('22°C demand from 20°C drives hot and returns towards equilibrium',()=>{
 let s=M.create(),x=live('AUTO 22','MANUAL COOL');
 s=M.step(s,x,15);
 assert.ok(s.positions.CONT>.5);
 assert.ok(s.temperatures.CONT>20&&s.temperatures.CONT<22);
 for(let i=0;i<3500;i++)s=M.step(s,x,.2);
 assert.ok(Math.abs(s.temperatures.CONT-22)<.5);
 assert.ok(Math.abs(s.positions.CONT-.5)<.05);
});
test('without operative pneumatic PACK, no fake rapid heating or cooling',()=>{
 const x=live('AUTO 26','AUTO 16');
 x.CONT.packAirAvailable=false;x.PASS.packAirAvailable=false;
 let s=M.create();
 for(let i=0;i<150;i++)s=M.step(s,x,.2);
 assert.ok(Math.abs(s.temperatures.CONT-20)<.1);
 assert.ok(Math.abs(s.temperatures.PASS-20)<.1);
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

test('bench mode moves on physical MANUAL WARM even if both PACK switches are OFF',()=>{
 const x=live('MANUAL WARM','MANUAL COOL');
 x.CONT.packMode='OFF';x.PASS.packMode='OFF';
 x.CONT.benchBypassPack=true;x.PASS.benchBypassPack=true;
 const s=M.step(M.create(),x,6);
 assert.equal(s.positions.CONT,1);assert.equal(s.positions.PASS,0);
 assert.equal(s.reason.CONT,'BENCH_MANUAL_WARM');
 assert.equal(s.reason.PASS,'BENCH_MANUAL_COOL');
});
test('normal PACK OFF still takes priority over manual, bench fault priority still holds',()=>{
 const x=live('MANUAL WARM','MANUAL COOL');x.CONT.packMode='OFF';
 let s=M.step(M.create(),x,90);
 assert.equal(s.positions.CONT,0);
 assert.equal(s.reason.CONT,'PACK_OFF_FULL_COLD');
 x.CONT.benchBypassPack=true;x.CONT.overheat=true;
 s=M.step(M.create(),x,6);
 assert.equal(s.positions.CONT,0);
 assert.equal(s.reason.CONT,'DUCT_OVERHEAT_LATCH');
});
test('geometry and pointer sweep are symmetric on the approved source face',()=>{
 assert.equal(M.SOURCE.width,1254);assert.equal(M.GAUGES.CONT.y,M.GAUGES.PASS.y);
 assert.equal(M.GAUGES.CONT.x,226);assert.equal(M.GAUGES.CONT.y,423);
 assert.equal(M.GAUGES.PASS.x,1023);assert.equal(M.GAUGES.PASS.y,423);
 assert.equal(M.angle(0),-64);assert.equal(M.angle(0.5),0);assert.equal(M.angle(1),64);
 assert.equal(M.CONFIG.benchFullTravelSeconds,10);
 for(const p of [0,.125,.25,.5,.75,.875,1])assert.ok(M.angle(p)>=-64&&M.angle(p)<=64);
});
