'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const Cb=require('../engine/cb/tat-probe-cb-link-v1.js');
const Core=require('../engine/systems/tat-probe-v1.js');
test('P18-3 C5 exists as one exact canonical photo-CB key',()=>{
 assert.equal(Cb.CB_ID,Core.CB_ID);
 assert.equal(Cb.CB_ID,'P18-3|ALL|C5');
});
test('Pull and push a CB from an empty real-world Lab snapshot without inventing a different circuit',()=>{
 const open=Cb.setPulled(null,true),closed=Cb.setPulled(open.snapshot,false);
 assert.equal(open.ok,true);assert.equal(open.snapshot.schema,1);
 assert.equal(Cb.read(open.snapshot).pulled,true);
 assert.equal(closed.ok,true);assert.equal(Cb.read(closed.snapshot).pulled,false);
});
test('TAT CB bridge preserves unrelated pulled and faulted breakers',()=>{
 const before={schema:1,variant:'DCPCS',breakers:[
  {id:'P6-11|ALL|B9',pulled:true,tripped:false,fault:null},
  {id:'P6-2|ALL|C4',pulled:true,tripped:true,fault:'CB fail'}
 ],buses:[{id:'MAIN2',powered:true,source:'EXTERNAL_AUTHORITY'}]};
 const open=Cb.setPulled(before,true);
 assert.equal(open.ok,true);assert.equal(open.snapshot.variant,'DCPCS');
 assert.deepEqual(open.snapshot.breakers.slice(0,2),before.breakers);
 assert.deepEqual(open.snapshot.buses,before.buses);
 const close=Cb.setPulled(open.snapshot,false);
 assert.deepEqual(close.snapshot.breakers,before.breakers);
 assert.deepEqual(before.breakers.length,2);
});
test('Tripped/faulted P18-3 C5 cannot be pushed by an instructor shortcut',()=>{
 const s={schema:1,variant:'CPCS',breakers:[{id:Cb.CB_ID,pulled:true,tripped:true,fault:'short'}],buses:[]};
 const r=Cb.setPulled(s,false);
 assert.equal(r.ok,false);assert.equal(r.reason,'TRIPPED_CB_REQUIRES_FAULT_CLEAR');
 assert.equal(Cb.read(s).pulled,true);
});
test('Photo CB action changes the TAT heater on a ground TAT TEST',()=>{
 const base={onGround:true,testPressed:true,switches:{'pitot-a':'OFF'},
  buses:{main2:true,dc1:true},breakers:{}};
 const open=Cb.setPulled(null,true).snapshot;
 const pulled={...base,breakers:{[Cb.CB_ID]:!Cb.read(open).pulled}};
 assert.equal(Core.evaluate(Core.initialState(),base).heaterPower,true);
 assert.equal(Core.evaluate(Core.initialState(),pulled).heaterPower,false);
 assert.equal(Core.evaluate(Core.initialState(),pulled).amberOn,true);
});
test('Reject corrupt persisted data instead of silently overwriting other CBs',()=>{
 const bad={schema:1,variant:'CPCS',breakers:'corrupt',buses:[]};
 assert.equal(Cb.setPulled(bad,true).ok,false);
});
