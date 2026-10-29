'use strict';
// FCOM Boeing 737-300/400/500 SP.3.1–SP.3.2 Window Heat overheat-test contract.
const test=require('node:test'),assert=require('node:assert/strict');
const Core=require('../engine/systems/window-heat-v1.js');
const buses=Object.fromEntries(['generator1','generator2','main1','main2','dc1','dc2'].map(x=>[x,true]));
const on=Object.fromEntries(Object.values(Core.CHANNELS).map(c=>[c.switchId,'ON']));
const project=(state,switches=on,seconds=0,breakers={})=>Core.step(state,{switches,buses,breakers},seconds);
const all=v=>Object.values(v.channels);
test('SP.3.1: with all four switches ON, OVHT gives four amber lights and anti-ice/master caution immediately',()=>{
 const before=project(Core.initialState(),on,2);
 assert.ok(all(before.output).every(x=>x.greenOn&&!x.overheatOn));
 const command=project(before.state,{...on,'window-power-test':'OVHT'},0);
 assert.ok(all(command.output).every(x=>x.overheatOn),'all four OVERHEAT indicators');
 assert.equal(command.output.annunciations.masterCautionRequest,true);
 assert.equal(command.output.annunciations.antiIceCaution,true);
 assert.ok(all(command.output).every(x=>x.greenOn),'ON lights must not disappear immediately');
 assert.ok(all(command.output).every(x=>!x.heaterPower),'overheat trip must interrupt heat');
});
test('SP.3.2: switch springs to neutral but test trip remains latched for 60 seconds',()=>{
 let r=project(Core.initialState(),on,1);
 r=project(r.state,{...on,'window-power-test':'OVHT'},0);
 r=project(r.state,on,30);
 assert.ok(all(r.output).every(x=>x.greenOn&&x.overheatOn));
 r=project(r.state,on,29);
 assert.ok(all(r.output).every(x=>x.greenOn&&x.overheatOn));
 r=project(r.state,on,1);
 assert.ok(all(r.output).every(x=>!x.greenOn&&x.overheatOn));
 assert.equal(r.output.annunciations.antiIceCaution,true);
 r=project(r.state,on,20);
 assert.ok(all(r.output).every(x=>!x.greenOn&&x.overheatOn),'must remain tripped beyond one minute');
});
test('SP.3.2: OVERHEAT test never artificially illuminates a green light that was OFF before testing',()=>{
 let s=Core.initialState();
 s.channels.L_FWD.temp=41;
 let r=project(s,on,1);
 assert.equal(r.output.channels.L_FWD.greenOn,false);
 assert.equal(r.output.channels.L_SIDE.greenOn,true);
 r=project(r.state,{...on,'window-power-test':'OVHT'},0);
 assert.equal(r.output.channels.L_FWD.greenOn,false);
 assert.equal(r.output.channels.L_SIDE.greenOn,true);
 assert.ok(all(r.output).every(x=>x.overheatOn));
});
test('SP.3.2: OFF then ON resets each window channel independently, not via spring test neutral',()=>{
 let r=project(Core.initialState(),on,1);
 r=project(r.state,{...on,'window-power-test':'OVHT'},0);
 r=project(r.state,on,65);
 assert.ok(all(r.output).every(x=>x.overheatOn&&!x.greenOn));
 const keys=Object.entries(Core.CHANNELS);
 for(const [channel,d] of keys){
  r=project(r.state,{...on,[d.switchId]:'OFF'},0);
  assert.equal(r.output.channels[channel].overheatOn,false,channel+' OFF');
  r=project(r.state,on,0);
  assert.equal(r.output.channels[channel].overheatOn,false,channel+' RESET');
  assert.equal(r.output.channels[channel].greenOn,true,channel+' HEAT RESTORED');
 }
 assert.equal(r.output.annunciations.masterCautionRequest,false);
 assert.equal(r.output.annunciations.antiIceCaution,false);
});
test('SP.3.2: actual fault is not masked by a successful overheat-test reset',()=>{
 let r=project(Core.initialState(),on,1);
 r.state=Core.injectFault(r.state,'R_SIDE','STUCK_OVERHEAT',true);
 r=project(r.state,{...on,'window-power-test':'OVHT'},0);
 r=project(r.state,on,61);
 r=project(r.state,{...on,'window-r-side':'OFF'},0);
 r=project(r.state,on,0);
 assert.equal(r.output.channels.R_SIDE.overheatOn,true,'real fault remains active');
 assert.equal(r.output.channels.R_SIDE.greenOn,false);
});
