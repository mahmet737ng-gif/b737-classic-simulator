'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Electrical=require('../engine/systems/electrical-v7.js');
const V2=require('../engine/systems/electrical-demand-estimate-v2.js');
function state(){
 let s=Electrical.initialState({coldDark:true});
 s=Electrical.apply(s,{type:'CONTROL',key:'batterySwitch',value:true});
 s=Electrical.apply(s,{type:'CONTROL',key:'apuRunning',value:true});
 s=Electrical.apply(s,{type:'SELECT_SOURCE',side:1,source:'APU'});
 return Electrical.apply(s,{type:'SELECT_SOURCE',side:2,source:'APU'});
}
const ground=(toggles={},other={},s=state())=>V2.project({
 electrical:Electrical.evaluate(s),toggles,onGround:true,...other
});
test('real default overhead fuel/hydraulic/galley switches do not imply all galley heaters ON',()=>{
 const toggles={'fuel-center-l':'ON','fuel-center-r':'ON','fuel-1-fwd':'ON',
  'fuel-1-aft':'ON','fuel-2-fwd':'ON','fuel-2-aft':'ON',
  'hyd-elec-1':'ON',galley:'ON','recirc-fan':'AUTO'};
 const result=ground(toggles);
 assert.equal(result.loads.find(x=>x.id==='GALLEY_1').currentA,0);
 assert.equal(result.loads.find(x=>x.id==='GALLEY_2').currentA,0);
 assert.equal(result.loads.find(x=>x.id==='HYD_ELEC_1').currentA,21.46);
 assert.ok(result.sourceAmps.APU>40&&result.sourceAmps.APU<125,
  'cold ground APU should show connected pump/fan demand, not a pegged meter');
 assert.equal(result.apu.overLimit,false);
});
test('individual pump, heater, hydraulic or galley load follows real source selection',()=>{
 const original=ground(),on=ground({'fuel-1-fwd':'ON'});
 assert.equal(on.sourceAmps.APU-original.sourceAmps.APU,5.5);
 const heat=ground({'window-l-fwd':'ON'},{windowHeat:{channels:{L_FWD:{heaterPower:true}}}});
 const off=ground({'window-l-fwd':'ON'},{windowHeat:{channels:{L_FWD:{heaterPower:false}}}});
 assert.equal(heat.sourceAmps.APU-off.sourceAmps.APU,9);
 const idle=ground({'hyd-elec-1':'ON'},{hydraulicDuty:0});
 const loaded=ground({'hyd-elec-1':'ON'},{hydraulicDuty:1});
 assert.ok(loaded.sourceAmps.APU>idle.sourceAmps.APU);
 const galley=ground({galley:'ON'},{galleyDuty:1});
 assert.ok(Math.abs(galley.sourceAmps.APU-original.sourceAmps.APU-58)<1e-9);
});
test('transient motor start decays to steady load without arbitrary random changes',()=>{
 const toggles={'hyd-elec-1':'ON'};
 const atStart=ground(toggles,{motorRunSeconds:{HYD_ELEC_1:0}});
 const after=ground(toggles,{motorRunSeconds:{HYD_ELEC_1:3}});
 assert.ok(atStart.sourceAmps.APU>after.sourceAmps.APU);
 assert.equal(after.sourceAmps.APU,ground(toggles).sourceAmps.APU);
});
test('on-ground APU load shed simulation requires high measured demand and is latched',()=>{
 const t={galley:'ON','hyd-elec-1':'ON','hyd-elec-2':'ON',
  'fuel-1-fwd':'ON','fuel-1-aft':'ON','fuel-2-fwd':'ON','fuel-2-aft':'ON',
  'fuel-center-l':'ON','fuel-center-r':'ON','window-l-fwd':'ON','window-r-fwd':'ON'};
 const pre=ground(t,{galleyDuty:1,hydraulicDuty:1,
  motorRunSeconds:{HYD_ELEC_1:0,HYD_ELEC_2:0}});
 assert.ok(pre.apu.needsGalleyShed);
 const shed=ground(t,{galleyDuty:1,galleyShedLatched:true,hydraulicDuty:1,
  motorRunSeconds:{HYD_ELEC_1:0,HYD_ELEC_2:0}});
 assert.ok(shed.sourceAmps.APU<pre.sourceAmps.APU);
 assert.ok(shed.loads.filter(x=>x.system==='GALLEY').every(x=>x.currentA===0));
});
test('APU disconnected is zero, GPU takes load, and battery DC current is independent',()=>{
 let s=state();
 const apu=ground({'fuel-1-fwd':'ON'},{battery:{ammeterA:-9,chargerA:3}},s);
 assert.equal(apu.batteryAmps,-9);
 s=Electrical.apply(s,{type:'CONTROL',key:'groundPowerAttached',value:true});
 s=Electrical.apply(s,{type:'SELECT_SOURCE',side:1,source:'EXT'});
 const gpu=ground({'fuel-1-fwd':'ON'}, {},s);
 assert.equal(gpu.sourceAmps.APU,0);
 assert.ok(gpu.sourceAmps.EXT>0);
 const dead=Electrical.evaluate(Electrical.initialState({coldDark:true}));
 const zero=V2.project({electrical:dead,toggles:{'hyd-elec-1':'ON'}});
 assert.equal(zero.sourceAmps.APU,0);
});
test('no input state or approved source is mutated; invalid demand rejected',()=>{
 const s=state(),input={electrical:Electrical.evaluate(s),toggles:{galley:'ON'},galleyDuty:.5};
 const frozen=JSON.stringify(input);
 V2.project(input);
 assert.equal(JSON.stringify(input),frozen);
 assert.throws(()=>V2.project({...input,hydraulicDuty:2}),/fraction/);
});
