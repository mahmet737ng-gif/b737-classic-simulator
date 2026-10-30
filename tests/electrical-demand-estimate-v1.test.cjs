'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const Electrical=require('../engine/systems/electrical-v7.js');
const Est=require('../engine/systems/electrical-demand-estimate-v1.js');
const baseline=()=>Electrical.initialState();
const sample=(state,toggles={},rest={})=>Est.project({electrical:Electrical.evaluate(state),toggles,...rest});
test('large per-system approximate catalogue is explicit and tagged unverified',()=>{
 assert.ok(Est.CATALOG.length>=42);
 assert.ok(Est.CATALOG.every(x=>x.bus&&x.kind&&Number.isFinite(x.amps)&&x.amps>0));
 assert.match(sample(baseline()).quality,/NOT_AIRFRAME/);
});
test('individual fuel pump changes connected GEN1 load only',()=>{
 const s=baseline(),base=sample(s),on=sample(s,{'fuel-1-fwd':'ON'});
 assert.ok(Math.abs(on.sourceAmps.GEN1-base.sourceAmps.GEN1-5.5)<1e-9);
 assert.equal(on.sourceAmps.GEN2,base.sourceAmps.GEN2);
 assert.ok(on.loads.find(x=>x.id==='FUEL_1_FWD').active);
 assert.equal(sample(s,{'fuel-1-fwd':'OFF'}).sourceAmps.GEN1,base.sourceAmps.GEN1);
});
test('two electric hydraulic pumps produce heavy separate AC load; engine-driven hydraulic toggle does not',()=>{
 const s=baseline(),base=sample(s);
 const one=sample(s,{'hyd-elec-1':'ON'}),both=sample(s,{'hyd-elec-1':'ON','hyd-elec-2':'ON','hyd-eng-1':'ON'});
 assert.equal(one.sourceAmps.GEN1-base.sourceAmps.GEN1,29);
 assert.equal(both.sourceAmps.GEN1,one.sourceAmps.GEN1);
 assert.equal(both.sourceAmps.GEN2-base.sourceAmps.GEN2,29);
});
test('galley and heat have realistic source gating with thermostat and load-shed',()=>{
 const base=sample(baseline());
 const heater=sample(baseline(),{'window-l-fwd':'ON'},{windowHeat:{channels:{L_FWD:{heaterPower:true}}}});
 const cutout=sample(baseline(),{'window-l-fwd':'ON'},{windowHeat:{channels:{L_FWD:{heaterPower:false}}}});
 assert.equal(heater.sourceAmps.GEN1-base.sourceAmps.GEN1,9);
 assert.equal(cutout.sourceAmps.GEN1,base.sourceAmps.GEN1);
 const galley=sample(baseline(),{galley:'ON'});
 assert.equal(galley.sourceAmps.GEN1-base.sourceAmps.GEN1,29);
 assert.equal(galley.sourceAmps.GEN2-base.sourceAmps.GEN2,29);
});
test('transfer bus crossfeed moves fuel pump load onto other generator',()=>{
 let s=baseline();
 s=Electrical.apply(s,{type:'FAULT',id:'GEN1_FAILED',active:true,instructor:true});
 const b=sample(s),p=sample(s,{'fuel-1-fwd':'ON'});
 assert.equal(p.sourceAmps.GEN1,0);
 assert.equal(p.sourceAmps.GEN2-b.sourceAmps.GEN2,5.5);
 assert.equal(p.loads.find(x=>x.id==='FUEL_1_FWD').source,'GEN2');
});
test('APU or GPU supply carries AC currents, not engine gen needles',()=>{
 let s=baseline();
 s=Electrical.apply(s,{type:'CONTROL',key:'apuRunning',value:true});
 s=Electrical.apply(s,{type:'SELECT_SOURCE',side:1,source:'APU'});
 s=Electrical.apply(s,{type:'SELECT_SOURCE',side:2,source:'APU'});
 let b=sample(s),p=sample(s,{'fuel-1-fwd':'ON','fuel-2-fwd':'ON'});
 assert.equal(p.sourceAmps.APU-b.sourceAmps.APU,11);
 assert.equal(p.sourceAmps.GEN1,0);
 assert.equal(p.sourceAmps.GEN2,0);
 s=Electrical.apply(s,{type:'CONTROL',key:'groundPowerAttached',value:true});
 s=Electrical.apply(s,{type:'SELECT_SOURCE',side:1,source:'EXT'});
 b=sample(s);p=sample(s,{'hyd-elec-1':'ON'});
 assert.equal(p.sourceAmps.EXT-b.sourceAmps.EXT,29);
 assert.equal(p.sourceAmps.APU,0);
});
test('no electrical bus means no load even with physical switch ON',()=>{
 let s=baseline();
 s=Electrical.apply(s,{type:'FAULT',id:'GEN1_FAILED',active:true,instructor:true});
 s=Electrical.apply(s,{type:'FAULT',id:'GEN2_FAILED',active:true,instructor:true});
 const p=sample(s,{'hyd-elec-1':'ON','fuel-2-fwd':'ON','galley':'ON'});
 assert.equal(p.sourceAmps.GEN1+p.sourceAmps.GEN2+p.sourceAmps.APU+p.sourceAmps.EXT,0);
 assert.equal(p.loads.find(x=>x.id==='HYD_ELEC_1').active,false);
});
test('DC selector source totals respond and battery ammeter is actual dynamics, not fabricated',()=>{
 const s=baseline(),base=sample(s);
 const p=sample(s,{'yaw-damper':'ON','pack-l':'AUTO'},{battery:{ammeterA:-15.75,chargerA:3}});
 assert.ok(p.trAmps.TR1>base.trAmps.TR1);
 assert.ok(p.trAmps.TR3>=3);
 assert.equal(p.batteryAmps,-15.75);
 assert.equal(p.chargingAmps,3);
});
test('estimated demand never writes or energizes the authority state',()=>{
 const s=baseline(),before=JSON.stringify(s);
 sample(s,{'fuel-1-fwd':'ON','hyd-elec-1':'ON'});
 assert.equal(JSON.stringify(s),before);
});
