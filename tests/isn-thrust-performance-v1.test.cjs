'use strict';
const assert=require('node:assert/strict');
const P=require('../engine/integration/isn-thrust-performance-v1');
const base={pressureAltitudeFt:10000,oatC:0,iasKt:240,weightKg:55000,
 verticalSpeedFpm:0,mode:'CRZ',onGround:false,windSpeedKt:30,trackTrueDeg:0,windFromDeg:0,
 engineAntiIce:false,wingAntiIce:false,packsOn:true};
const head=P.performance(base),tail=P.performance({...base,windFromDeg:180});
assert.equal(head.origin,'SIMULATION_APPROX_ONLY');
assert.deepEqual(head.mode.limitTable,tail.mode.limitTable);
assert.equal(head.performance.requiredN1NowPercent,tail.performance.requiredN1NowPercent);
assert.ok(tail.speeds.groundSpeedKt-head.speeds.groundSpeedKt>59.9);
const cross=P.performance({...base,windFromDeg:90});
assert.ok(Math.abs(cross.speeds.headwindKt)<1e-9);
assert.ok(cross.speeds.groundSpeedKt<head.speeds.tasKt);
const hold200=P.performance({...base,iasKt:200,windSpeedKt:0});
const hold240=P.performance({...base,iasKt:240,windSpeedKt:0});
const speedUp=P.performance({...base,iasKt:200,targetIasKt:240,accelTimeSec:30,windSpeedKt:0});
assert.ok(speedUp.performance.requiredN1NowPercent>hold200.performance.requiredN1NowPercent);
assert.ok(speedUp.performance.requiredN1NowPercent>hold240.performance.requiredN1NowPercent);
assert.equal(speedUp.performance.requiredN1HoldTargetPercent,hold240.performance.requiredN1NowPercent);
assert.ok(hold240.performance.selectedN1CommandPercent<=hold240.mode.limitN1Percent);
const climb=P.performance({...base,verticalSpeedFpm:1500,windSpeedKt:0});
assert.ok(climb.performance.requiredN1NowPercent>hold240.performance.requiredN1NowPercent);
const descent=P.performance({...base,verticalSpeedFpm:-2500,windSpeedKt:0});
assert.ok(descent.performance.selectedN1CommandPercent>=32);
const heavy=P.performance({...base,weightKg:68000,windSpeedKt:0});
assert.ok(heavy.performance.requiredN1NowPercent>hold240.performance.requiredN1NowPercent);
const c=P.performance({...base,mode:'CLB-1'});
assert.equal(c.mode.limitN1Percent,Number((c.mode.limitTable.CLB-3).toFixed(2)));
assert.equal(P.performance({...base,mode:'CLB-2'}).mode.limitN1Percent,Number((c.mode.limitTable.CLB-6).toFixed(2)));
const cleared=P.performance({...base,mode:'CLB-1',pressureAltitudeFt:16000});
assert.equal(cleared.mode.active,'CLB');assert.equal(cleared.mode.autoCleared,true);
assert.throws(()=>P.performance({...base,mode:'CLB-2',clb2Available:false}));
assert.throws(()=>P.performance({...base,iasKt:200,targetIasKt:240}));
assert.throws(()=>P.performance({...base,weightKg:null}));
assert.throws(()=>P.performance({...base,windSpeedKt:-1}));
const limits=P.ratings({pressureAltitudeFt:10000,oatC:0}).limitsN1Percent;
assert.ok(limits.TO>=limits.CON&&limits.CON>=limits.CLB&&limits.CLB>=limits.CRZ);
for(const m of ['TO','GA','CON','CLB','CRZ'])assert.ok(limits[m]<=97);
const calls=[];
const chain={flight:{onGround:false},get(){return {phase:{engine1:'RUNNING',engine2:'RUNNING'},
 sources:{engine1:{running:true,origin:'TRAINING_SEQUENCE_SIMULATED'},
 engine2:{running:true,origin:'TRAINING_SEQUENCE_SIMULATED'}}}},
 setThrottle(id,value){calls.push({id,value});}};
const applied=P.applyToTrainingChain(chain,'engine1',{...base,windSpeedKt:0});
assert.equal(applied.status,'THROTTLE_COMMAND_APPLIED_FOR_SIMULATION');
assert.equal(calls.length,1);assert.equal(calls[0].id,'engine1');
assert.ok(calls[0].value>0&&calls[0].value<1);
assert.throws(()=>P.applyToTrainingChain({...chain,flight:{onGround:true}},'engine1',base),/onGround/);
assert.throws(()=>P.applyToTrainingChain({...chain,get(){return {phase:{engine1:'OFF'},sources:{engine1:{running:false}}}}},'engine1',base),/not RUNNING/);
assert.throws(()=>P.applyToTrainingChain({...chain,get(){return {phase:{engine1:'RUNNING'},sources:{engine1:{running:true,origin:'EXTERNAL_SENSOR_OBSERVATION'}}}}},'engine1',base),/externally/);
for(const temp of [-15,0,20]){
 const r=P.performance({...base,oatC:temp,windSpeedKt:0});
 assert.ok(r.performance.requiredN1NowPercent>0);
}
console.log('PASS ISN thrust planner: weather, winds, 200→240 acceleration, mass, climb/descent, limits and ISN guards.');
