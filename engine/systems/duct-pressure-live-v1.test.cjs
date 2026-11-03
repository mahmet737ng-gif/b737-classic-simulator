'use strict';
const assert=require('node:assert/strict');
const model=require('./duct-pressure-live-v1');
const engine=(phase='OFF',n1Percent=0)=>({phase,n1Percent});
const ecu=(one=engine(),two=engine(),apuPhase='OFF')=>({
 engines:{engine1:one,engine2:two},apu:{phase:apuPhase}
});
const bleed=(x={})=>({engine1ValveOpen:false,engine2ValveOpen:false,
 apuBleedValveOpen:false,isolationOpen:false,...x});
const close=(a,b)=>assert.ok(Math.abs(a-b)<0.2,'Expected '+a+' close to '+b);
const cold=model.project({ecu:ecu(),bleed:bleed(),controls:{}});
assert.deepEqual([cold.L,cold.R],[0,0]);
assert.equal(cold.quality,'NOT_MEASURED');
const one=model.project({
 ecu:ecu(engine('RUNNING',32)),bleed:bleed({engine1ValveOpen:true}),
 controls:{'pack-l':'AUTO'}
});
assert.ok(one.L>=30&&one.L<=35);assert.equal(one.R,0);
const shut=model.project({
 ecu:ecu(engine('RUNNING',60)),bleed:bleed({engine1ValveOpen:false}),
 controls:{'pack-l':'AUTO'}
});
assert.equal(shut.L,0);
const dual=model.project({
 ecu:ecu(engine('RUNNING',30),engine('RUNNING',70)),
 bleed:bleed({engine1ValveOpen:true,engine2ValveOpen:true}),
 controls:{'pack-l':'AUTO','pack-r':'AUTO'}
});
assert.ok(dual.L>25&&dual.L<40);assert.ok(dual.R>38&&dual.R<43);
assert.ok(dual.R>dual.L,'Independent branches before isolation');
const apuLeft=model.project({
 ecu:ecu(engine(),engine(),'READY'),
 bleed:bleed({apuBleedValveOpen:true}),
 controls:{}
});
assert.equal(apuLeft.L,35);assert.equal(apuLeft.R,0);
const apuShared=model.project({
 ecu:ecu(engine(),engine(),'READY'),
 bleed:bleed({apuBleedValveOpen:true,isolationOpen:true}),
 controls:{}
});
close(apuShared.L,34.2);close(apuShared.R,34.2);
const sensor=model.project({
 ecu:ecu(),bleed:bleed(),sensors:{L:29.5,R:47.1}
});
assert.equal(sensor.L,29.5);assert.equal(sensor.R,47.1);
assert.equal(sensor.quality,'EXPLICIT_SENSOR_HAS_PRIORITY');
const noAC=model.project({ecu:ecu(),bleed:bleed(),gaugePowered:false});
assert.equal(noAC.L,null);assert.equal(noAC.R,null);
assert.equal(noAC.source,'UNPOWERED_INDICATOR');
assert.throws(()=>model.project({ecu:null,bleed:bleed()}));
console.log('PASS: engine bleed, isolation, APU manifold, independent left/right pressure, sensor priority and gauge power.');
