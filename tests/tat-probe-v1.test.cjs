'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const Core=require('../engine/systems/tat-probe-v1.js');
const candidate=fs.readFileSync(path.join(__dirname,'../cb-panel-lab/catalog.js'),'utf8');
const win={};vm.runInNewContext(candidate,{window:win});
const panel=win.CB_CATALOG.panels.find(p=>p.id==='P18-3');
const row=String(panel.breakers).split(';').find(x=>x.trim().startsWith('C5:'));
const input=(v={})=>({
 onGround:true,switches:{'pitot-a':'OFF'},
 buses:{main2:true},breakers:{},testPressed:false,...v
});
const evalWith=(params={},state=Core.initialState())=>Core.evaluate(state,input(params));
test('photo-indexed TEMP PROBE CB exists on Classic P18-3 C5',()=>{
 assert.equal(Core.CB_ID,'P18-3|ALL|C5');
 assert.match(row,/C5:5\|TEMP PROBE/);
});
test('FCOM 3.10.4: unheated probe reports TEMP PROBE amber on the ground',()=>{
 const x=evalWith();assert.equal(x.amberOn,true);assert.equal(x.heaterPower,false);
});
test('TAT TEST held on ground routes MAIN BUS 2 heat and extinguishes amber',()=>{
 const x=evalWith({testPressed:true});assert.equal(x.heaterRequested,true);
 assert.equal(x.heaterPower,true);assert.equal(x.amberOn,false);assert.equal(x.cbClosed,true);
});
test('TAT TEST release stops ground heater and re-lights TEMP PROBE',()=>{
 const pressed=evalWith({testPressed:true}),released=evalWith({testPressed:false});
 assert.equal(pressed.amberOn,false);assert.equal(released.amberOn,true);
 assert.equal(released.heaterPower,false);
});
test('TAT button only powers heating when pressed on ground; PITOT A OFF is valid',()=>{
 const onGroundAOn=evalWith({switches:{'pitot-a':'ON'}});
 assert.equal(onGroundAOn.heaterPower,false);
 const pressAOn=evalWith({switches:{'pitot-a':'ON'},testPressed:true});
 assert.equal(pressAOn.heaterPower,true);
});
test('In flight PITOT A ON requests heat; TAT TEST itself cannot power probe',()=>{
 const inFlight=evalWith({onGround:false,switches:{'pitot-a':'ON'}});
 assert.equal(inFlight.heaterPower,true);assert.equal(inFlight.amberOn,false);
 const testOnly=evalWith({onGround:false,testPressed:true});
 assert.equal(testOnly.heaterPower,false);assert.equal(testOnly.testEligible,false);
});
test('P18-3 C5 pulled prevents heat and keeps TEMP PROBE amber illuminated',()=>{
 const x=evalWith({testPressed:true,breakers:{[Core.CB_ID]:false}});
 assert.equal(x.cbClosed,false);assert.equal(x.heaterPower,false);assert.equal(x.amberOn,true);
});
test('MAIN BUS 2 loss or UNKNOWN inhibits heater without fabricated electrical supply',()=>{
 for(const main2 of [false,null,undefined]){
  const x=evalWith({testPressed:true,buses:{main2}});
  assert.equal(x.heaterPower,false);
  assert.equal(x.amberOn,true);
 }
});
test('Instructor supply powers ONLY TAT heater but cannot bypass CB or heater failure',()=>{
 const good=evalWith({testPressed:true,trainingPower:true,buses:{main2:false}});
 assert.equal(good.heaterPower,true);assert.equal(good.liveMain2,false);
 const bad=evalWith({testPressed:true,trainingPower:true,buses:{main2:false},breakers:{[Core.CB_ID]:false}});
 assert.equal(bad.heaterPower,false);
 const fault=Core.injectFault(Core.initialState(),'HEATER_FAIL',true);
 assert.equal(evalWith({testPressed:true,trainingPower:true,buses:{main2:false}},fault).heaterPower,false);
});
test('Heater fail or current sensor fail stays amber during TAT press',()=>{
 for(const fault of ['HEATER_FAIL','CURRENT_SENSE_FAIL']){
  const state=Core.injectFault(Core.initialState(),fault,true);
  const result=evalWith({testPressed:true},state);
  assert.equal(result.amberOn,true,fault);
  if(fault==='CURRENT_SENSE_FAIL')assert.equal(result.heaterPower,true);
 }
});
test('Indicator stuck ON / OFF faults remain independent from actual heat',()=>{
 const on=Core.injectFault(Core.initialState(),'INDICATOR_STUCK_ON',true);
 const off=Core.injectFault(Core.initialState(),'INDICATOR_STUCK_OFF',true);
 assert.equal(evalWith({testPressed:true},on).amberOn,true);
 assert.equal(evalWith({},off).amberOn,false);
 assert.equal(evalWith({},off).heaterPower,false);
});
test('Unknown on-ground / in-flight state cannot energize a heater',()=>{
 const unknown=evalWith({onGround:null,testPressed:true,switches:{'pitot-a':'ON'}});
 assert.equal(unknown.heaterPower,false);assert.equal(unknown.onGround,null);
});
