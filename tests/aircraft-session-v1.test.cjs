'use strict';
const assert=require('node:assert/strict');
const test=require('node:test');
const {Session}=require('../engine/runtime/aircraft-session-v1.js');
const {create}=require('../engine/runtime/electrical-adapter-v1.js');
const Electrical=require('../engine/systems/electrical-v7.js');
const Loads=require('../engine/systems/electrical-loads-v8.js');
const factory=(options={})=>new Session({adapters:[create(Electrical,Loads)],...options});
const cmd=(id,actor,action,target='electrical')=>({id,actor,action,target});
const cockpit=(id,key,value)=>cmd(id,'COCKPIT',{type:'CONTROL',key,value});
const scenario=(id,key,value)=>cmd(id,'SCENARIO',{type:'CONTROL',key,value});
const fail=(s,c,pattern)=>assert.throws(()=>s.dispatch(c),pattern);
test('owner registered once; actual V7 + V8 data only',()=>{
 const s=factory(),a=s.audit(),p=s.snapshot();
 assert.deepEqual(a.owners,[{path:'electrical',owner:'electrical'},{path:'electricalLoads',owner:'electrical'}]);
 assert.equal(p.systems.electrical.electrical.schema,'B737_ELECTRICAL_V7_RESULT');
 assert.equal(p.systems.electrical.loads.schema,'B737_ELECTRICAL_LOADS_V8');
 assert.equal(p.systems.electrical.authority,'ELECTRICAL_V7');
});
test('no double ownership, missing dependency, cycle or invalid profile',()=>{
 const dummy=id=>({id,owns:[id],dependsOn:[],initialState:()=>({value:0}),
  apply:(s)=>s,project:(s)=>({...s})});
 assert.throws(()=>new Session({adapters:[dummy('a'),{...dummy('b'),owns:['a']}]}),/owner/i);
 assert.throws(()=>new Session({adapters:[{...dummy('a'),dependsOn:['missing']}]}),/dependency/i);
 assert.throws(()=>new Session({adapters:[{...dummy('a'),dependsOn:['b']},{...dummy('b'),dependsOn:['a']}]}),/Cyclic/);
 assert.throws(()=>factory({profile:'B737-800'}),/Invalid profile/);
});
test('cold and dark scenario starts engines and APU off, no source selected',()=>{
 const p=factory().snapshot().systems.electrical.electrical;
 assert.equal(p.source[1],null);assert.equal(p.source[2],null);
 assert.equal(p.bus.generator1,false);assert.equal(p.bus.generator2,false);
 assert.equal(p.lamps.busOff1,true);assert.equal(p.lamps.busOff2,true);
});
test('scenario source status cannot be changed directly by cockpit',()=>{
 const s=factory();
 fail(s,cockpit('x','engine1Running',true),/forbidden/);
 fail(s,cockpit('y','apuRunning',true),/forbidden/);
 fail(s,scenario('z','batterySwitch',true),/forbidden/);
 assert.equal(s.audit().revision,0);
});
test('electrical cockpit action drives physical switch, not invented LRU wiring',()=>{
 const s=factory();
 s.dispatch(cockpit('batt-on','batterySwitch',true));
 let p=s.snapshot().systems.electrical;
 assert.equal(p.electrical.bus.switchedHotBattery,true);
 assert.equal(p.loads.coverage.loadsKnownBus,0);
 assert.equal(p.loads.loads['fuel.main1FwdPump'].powered,null);
});
test('bad source and forged instructor failure rejected without state mutation',()=>{
 const s=factory();const before=s.snapshot();
 fail(s,cmd('g','COCKPIT',{type:'FAULT',id:'GEN1_FAILED',active:true,instructor:true}),/Instructor-only/);
 fail(s,cmd('h','INSTRUCTOR',{type:'SELECT_SOURCE',side:1,source:'EXT'}),/physical cockpit/);
 fail(s,cmd('j','COCKPIT',{type:'SELECT_SOURCE',side:1,source:'EXT'}),/connection conditions/);
 assert.deepEqual(s.snapshot(),before);
});
test('instructor fault is accepted and effects derived from V7',()=>{
 const s=factory();
 s.dispatch(scenario('run1','engine1Running',true));
 s.dispatch(cmd('select1','COCKPIT',{type:'SELECT_SOURCE',side:1,source:'GEN1'}));
 assert.equal(s.snapshot().systems.electrical.electrical.bus.generator1,true);
 s.dispatch(cmd('fault','INSTRUCTOR',{type:'FAULT',id:'GEN1_FAILED',active:true,instructor:true}));
 assert.equal(s.snapshot().systems.electrical.electrical.bus.generator1,false);
});
test('idempotency, identity collision, and no duplicate command execution',()=>{
 const s=factory(),c=cockpit('c1','batterySwitch',true);
 assert.equal(s.dispatch(c).applied,1);
 const b=s.snapshot();
 assert.equal(s.dispatch(c).duplicate,1);
 assert.deepEqual(s.snapshot(),b);
 fail(s,cockpit('c1','batterySwitch',false),/collision/);
});
test('atomic batch validation; rejection leaves state, revision, IDs untouched',()=>{
 const s=factory(),prev=s.snapshot();
 assert.throws(()=>s.dispatchBatch([
  cockpit('valid-first','batterySwitch',true),
  cmd('invalid-second','COCKPIT',{type:'CONTROL',key:'unknown',value:true})
 ]),/forbidden/);
 assert.deepEqual(s.snapshot(),prev);
 assert.equal(s.audit().commandsSeen,0);
 assert.equal(s.dispatch(cockpit('valid-first','batterySwitch',true)).applied,1);
});
test('transaction rollback when downstream projection throws',()=>{
 const a={id:'a',owns:['a'],dependsOn:[],initialState:()=>({value:0}),
  apply:(s)=>({value:s.value+1}),project:s=>{if(s.value)throw Error('projection exploded');return s;}};
 const s=new Session({adapters:[a]}),before=s.snapshot();
 fail(s,cmd('any','COCKPIT',{type:'GO'},'a'),/projection exploded/);
 assert.deepEqual(s.snapshot(),before);assert.equal(s.audit().events,0);
});
test('hostile adapter cannot mutate frozen previous state',()=>{
 const a={id:'hostile',owns:['hostile'],dependsOn:[],initialState:()=>({value:{inner:5}}),
  apply:s=>{s.value.inner=999;return s;},project:s=>s};
 const s=new Session({adapters:[a]});
 fail(s,cmd('mutate','COCKPIT',{type:'GO'},'hostile'),/read only|read-only|Cannot assign/i);
 assert.equal(s.snapshot().systems.hostile.value.inner,5);
});
test('frontend cannot mutate snapshot or outputs',()=>{
 const s=factory(),a=s.snapshot();
 a.systems.electrical.electrical.bus.transfer1=true;
 a.systems.electrical.loads.loads['fuel.main1FwdPump'].powered=true;
 assert.notEqual(s.snapshot().systems.electrical.loads.loads['fuel.main1FwdPump'].powered,true);
});
test('projected dependencies topologically ordered independent of adapter registration order',()=>{
 const a={id:'a',owns:['A'],dependsOn:[],initialState:()=>({x:7}),apply:s=>s,project:s=>s};
 const b={id:'b',owns:['B'],dependsOn:['a'],initialState:()=>({}),apply:s=>s,
  project:(s,deps)=>({x:deps.a.x*2})};
 const s=new Session({adapters:[b,a]});
 assert.deepEqual(s.audit().order,['a','b']);assert.equal(s.snapshot().systems.b.x,14);
});
test('clock advances deterministically and rejects fractional/oversized steps',()=>{
 const s=factory(),before=s.snapshot();
 assert.throws(()=>s.advance(1500),/Clock step/);
 assert.throws(()=>s.advance(1.5),/Clock step/);
 assert.deepEqual(s.snapshot(),before);
 s.advance(250);assert.equal(s.snapshot().timeMs,250);
});
test('zero-duration tick must be a no-op',()=>{
 const s=factory(),before=s.snapshot();s.advance(0);
 assert.deepEqual(s.snapshot(),before);
});
test('reset clears command IDs, fault history, clock and scenario state',()=>{
 const s=factory();s.dispatch(cockpit('reset-c1','batterySwitch',true));s.advance(50);
 s.reset();assert.equal(s.audit().revision,0);assert.equal(s.audit().commandsSeen,0);
 assert.equal(s.snapshot().timeMs,0);assert.equal(s.dispatch(cockpit('reset-c1','batterySwitch',true)).applied,1);
});
test('replay from recorded commands and simulation times matches original',()=>{
 const s=factory();s.dispatch(cockpit('a','batterySwitch',true));s.advance(120);
 s.dispatch(scenario('b','groundPowerAttached',true));s.dispatch(scenario('c','groundPowerQualityGood',true));
 const original=s.snapshot(),log=s.events.map(e=>JSON.parse(JSON.stringify(e)));
 const second=factory();second.replay(log);
 assert.deepEqual(second.snapshot(),original);
});
test('replay failure cannot damage a running session',()=>{
 const s=factory();s.dispatch(cockpit('safe','batterySwitch',true));
 const original=s.snapshot();
 assert.throws(()=>s.replay([cockpit('run','batterySwitch',true),cockpit('bad','apuRunning',true)]),/forbidden/);
 assert.deepEqual(s.snapshot(),original);
});
test('independent sessions do not leak profile or state',()=>{
 const a=factory({profile:'B737-300'}),b=factory({profile:'B737-500'});
 a.dispatch(cockpit('batt','batterySwitch',true));
 assert.equal(b.snapshot().profile,'B737-500');
 assert.notDeepEqual(a.snapshot().systems.electrical,b.snapshot().systems.electrical);
});
test('source conflict UNKNOWN survives runtime, including projected Loads',()=>{
 const s=factory(),v=s.snapshot().systems.electrical.electrical;
 assert.equal(v.bus.acStandby,null);assert.ok(v.qa.some(x=>x.level==='SOURCE_CONFLICT'));
 assert.equal(s.snapshot().systems.electrical.loads.loads['dcpcs.controller1'].powered,null);
});
console.log('Aircraft Session v1 adversarial test suite loaded');
