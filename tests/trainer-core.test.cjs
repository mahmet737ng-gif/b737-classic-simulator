const assert=require('node:assert/strict');
const E=require('../engine/trainer/core.js');
let passed=0;
function check(label,fn){fn();passed++;console.log('OK',String(passed).padStart(2,'0'),label)}
function set(s,path,value){return E.apply(s,{type:'CONTROL',path,value});}
function fault(s,id,active=true){return E.apply(s,{type:'FAULT',id,active});}
function scenario(s,id){return E.apply(s,{type:'SCENARIO',id});}
check('initial state is powered by engine generators with both transfer buses',()=>{
 const d=E.derive(E.initialState());assert.equal(d.generatorBus[1],'GEN 1');assert.equal(d.generatorBus[2],'GEN 2');assert.equal(d.transferBus[1],true);assert.equal(d.transferBus[2],true);
});
check('no control mutation',()=>{
 const s=E.initialState();const t=set(s,'battery',false);assert.equal(s.controls.battery,true);assert.equal(t.controls.battery,false);
});
check('fault does not mutate input',()=>{const s=E.initialState();const t=fault(s,'gen1Failed');assert.equal(s.faults.gen1Failed,false);assert.equal(t.faults.gen1Failed,true)});
check('GEN1 failed turns only generator bus1 off, transfer1 crossfed AUTO',()=>{
 const d=E.derive(fault(E.initialState(),'gen1Failed'));assert.equal(d.mainBus[1],false);assert.equal(d.mainBus[2],true);assert.equal(d.transferBus[1],true);assert.equal(d.indicators.busOff1,true);assert.equal(d.indicators.transferBusOff1,false);
});
check('AUTO off prevents transfer bus crossfeed',()=>{
 const s=set(fault(E.initialState(),'gen1Failed'),'busTransferAuto',false);const d=E.derive(s);assert.equal(d.transferBus[1],false);assert.equal(d.transferBus[2],true);assert.equal(d.hyd.elecB.lowPressure,true);assert.equal(d.fuel.leftFwd.lowPressure,true);
});
check('GEN2 failed plus transfer off affects other side',()=>{
 const s=set(fault(E.initialState(),'gen2Failed'),'busTransferAuto',false);const d=E.derive(s);assert.equal(d.transferBus[2],false);assert.equal(d.hyd.elecA.lowPressure,true);
});
check('both engine generators fail: both buses unavailable until alternate source is connected',()=>{
 const d=E.derive(fault(fault(E.initialState(),'gen1Failed'),'gen2Failed'));assert.equal(d.mainBus[1],false);assert.equal(d.mainBus[2],false);assert.equal(d.transferBus[1],false);assert.equal(d.transferBus[2],false);
});
check('APU source replacement restores affected bus',()=>{
 let s=fault(E.initialState(),'gen1Failed');s=set(s,'apuRunning',true);s=set(s,'apuGen1Connected',true);const d=E.derive(s);assert.equal(d.mainBus[1],true);assert.equal(d.generatorBus[1],'APU');assert.equal(s.controls.gen1Connected,false);
});
check('APU failed does not energize bus',()=>{
 let s=fault(E.initialState(),'gen1Failed');s=set(s,'apuRunning',true);s=set(s,'apuGen1Connected',true);s=fault(s,'apuGeneratorFailed');assert.equal(E.derive(s).generatorBus[1],null);
});
check('external source requires battery ON at connection',()=>{
 let s=set(E.initialState(),'battery',false);assert.throws(()=>set(s,'externalConnected',true),/BATTERY ON/);
});
check('ground source replacement drops preceding GEN/APU selections',()=>{
 let s=E.initialState();s=set(s,'externalConnected',true);let d=E.derive(s);
 assert.equal(d.generatorBus[1],'EXTERNAL');assert.equal(d.generatorBus[2],'EXTERNAL');assert.equal(s.controls.gen1Connected,false);assert.equal(s.controls.gen2Connected,false);
});
check('battery OFF automatically disconnects external',()=>{let s=set(E.initialState(),'externalConnected',true);s=set(s,'battery',false);assert.equal(s.controls.externalConnected,false)});
check('main fuel LOW PRESSURE when pump switch OFF',()=>{
 let s=set(E.initialState(),'fuel.leftFwd',false);assert.equal(E.derive(s).fuel.leftFwd.lowPressure,true);
});
check('center fuel LOW PRESSURE extinguished with switch OFF',()=>{
 const d=E.derive(E.initialState());assert.equal(d.fuel.centerLeft.lowPressure,false);assert.equal(d.fuel.centerRight.lowPressure,false);
});
check('center fuel switch ON and low power => LOW PRESSURE',()=>{
 let s=E.initialState();s=set(s,'fuel.centerLeft',true);s=fault(s,'fuel_centerLeft_Failed');assert.equal(E.derive(s).fuel.centerLeft.lowPressure,true);
});
check('center fuel running => no low pressure',()=>{
 let s=set(E.initialState(),'fuel.centerLeft',true);assert.equal(E.derive(s).fuel.centerLeft.lowPressure,false);
});
check('two main LOW PRESSURE lights same side trigger fuel annunciator',()=>{
 let s=set(E.initialState(),'fuel.leftFwd',false);s=set(s,'fuel.leftAft',false);assert.equal(E.derive(s).indicators.masterCautionFuel,true);
});
check('one main pump low pressure does not automatically cause fuel master caution',()=>{
 let s=set(E.initialState(),'fuel.leftFwd',false);assert.equal(E.derive(s).indicators.masterCautionFuel,false);
});
check('hydraulic electric LOW PRESSURE with switch OFF',()=>{
 let s=set(E.initialState(),'hyd.elecA',false);assert.equal(E.derive(s).hyd.elecA.lowPressure,true);
});
check('hydraulic electric pump overheat interrupts pump pressure',()=>{
 const d=E.derive(fault(E.initialState(),'elecAOverheat'));
 assert.equal(d.hyd.elecA.overheat,true);assert.equal(d.hyd.elecA.lowPressure,true);
});
check('engine driven pump maintains system A despite electric A fault',()=>{
 const d=E.derive(fault(E.initialState(),'elecAFailed'));assert.equal(d.systemHyd.A,true);
});
check('system A unpressurized when both engine and electric pump unavailable',()=>{
 let s=fault(E.initialState(),'elecAFailed');s=set(s,'engineHyd.A',false);assert.equal(E.derive(s).systemHyd.A,false);
});
check('bus transfer fault isolates bus even with generator present',()=>{
 const d=E.derive(fault(E.initialState(),'transfer1Failed'));assert.equal(d.mainBus[1],true);assert.equal(d.transferBus[1],false);
});
check('QRH trainer scenario detects single bus-off and requires restoration',()=>{
 let s=scenario(fault(E.initialState(),'gen1Failed'),'bus1');let q=E.checklist(s);assert.equal(q.complete,false);assert.equal(q.steps[0].done,true);
 s=set(s,'apuRunning',true);s=set(s,'apuGen1Connected',true);q=E.checklist(s);assert.equal(q.complete,true);
});
check('fault clears but GEN1 still requires connected source',()=>{
 let s=fault(E.initialState(),'gen1Failed');s=fault(s,'gen1Failed',false);assert.equal(E.derive(s).generatorBus[1],'GEN 1');
});
check('replay is deterministic and log count corresponds to commands',()=>{
 const cmds=[{type:'FAULT',id:'gen1Failed',active:true},{type:'CONTROL',path:'busTransferAuto',value:false},{type:'CONTROL',path:'fuel.leftAft',value:false}];const a=E.replay(cmds);const b=E.replay(cmds);assert.deepEqual(a,b);assert.equal(a.events.length,3);assert.equal(a.seq,3);
});
check('reject unknown command, invalid path and boolean coercion',()=>{
 assert.throws(()=>E.apply(E.initialState(),{type:'CONTROL',path:'foo',value:true}),/Unknown/);
 assert.throws(()=>E.apply(E.initialState(),{type:'FAULT',id:'unknown',active:true}),/Unknown/);
 assert.throws(()=>E.apply(E.initialState(),{type:'CONTROL',path:'battery',value:'off'}),/boolean/);
});
check('RESET returns original fixture and clears faults and log',()=>{
 const s=E.apply(fault(E.initialState(),'gen1Failed'),{type:'RESET'});assert.deepEqual(s,E.initialState());
});
console.log(`PASS ${passed} trainer-core tests`);