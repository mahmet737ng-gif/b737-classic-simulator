'use strict';
const assert=require('node:assert/strict'),B=require('../engine/integration/isn-13-18-ecu-testbench-v1');
function simulate(start,input,ms,step){let s=start;for(let t=0;t<ms;t+=step)s=B.oilStep(s,input,Math.min(step,ms-t));return s;}
const idle={n2Percent:60,engineRunning:true,throttle:0};
const hot={...B.oilInitial(),temperatureC:82};
const warmIdle=simulate(hot,idle,10000,100);
assert.ok(warmIdle.pressurePsi>28&&warmIdle.pressurePsi<36,'Warm idle is no longer near 74 PSI');
const coldIdle=simulate(B.oilInitial(),idle,10000,100);
assert.ok(coldIdle.pressurePsi>warmIdle.pressurePsi&&coldIdle.pressurePsi<45);
const full=simulate(hot,{...idle,n2Percent:101,throttle:1},10000,100);
assert.ok(full.pressurePsi>warmIdle.pressurePsi&&full.pressurePsi<65);
const tiny=simulate(B.oilInitial(),idle,300000,8);
const large=simulate(B.oilInitial(),idle,300000,250);
assert.ok(tiny.temperatureC>79,'Temperature cannot freeze when every update is below 0.01 C');
assert.ok(Math.abs(tiny.temperatureC-large.temperatureC)<1e-7,'Thermal response is independent of frame/tick size');
const heating=simulate(hot,{...idle,n2Percent:101,throttle:1},120000,100);
assert.ok(heating.temperatureC>95&&heating.temperatureC<104);
const cooling=simulate(heating,{...idle,engineRunning:false,n2Percent:0,ambientC:5},120000,100);
assert.ok(cooling.temperatureC<heating.temperatureC-25&&cooling.temperatureC>5);
const failed=simulate({...warmIdle,faults:{...warmIdle.faults,pumpFailure:true}},idle,30000,100);
assert.ok(failed.pressurePsi<1&&failed.lowPressureLamp);
// Passive host path must cool hot engine oil even with all source owners off.
const passive={aircraft:{oatC:20},oil:{engine1:{...heating},engine2:B.oilInitial()},
 coast:{engine1:{n1:0,n2:0,egt:20},engine2:{n1:0,n2:0,egt:20}},
 chain:{get:()=>({phase:{apu:'OFF',engine1:'OFF',engine2:'OFF'}})},
 apuThermalEgtC:0,apuOilPressurePsi:0,elapsedMs:0,get(){return this;}};
assert.equal(B.Testbench.prototype.hasPassiveEngineState.call(passive),true);
B.Testbench.prototype.coolAPU.call(passive,60000);
assert.ok(passive.oil.engine1.temperatureC<heating.temperatureC);
console.log('PASS oil dynamics: plausible training PSI, temperature/load/OAT response, 8 ms invariance, faults and all-off passive cooling.');
