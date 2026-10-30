'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const E=require('../engine/systems/electrical-v7');
const N=require('../engine/systems/electrical-network-v1');
const control=(s,key,value)=>E.apply(s,{type:'CONTROL',key,value});
const fault=(s,id)=>E.apply(s,{type:'FAULT',id,active:true,instructor:true});
const select=(s,source,side=1)=>E.apply(s,{type:'SELECT_SOURCE',source,side});
const net=(s,opts)=>N.project(s,E.evaluate(s),opts);
function cold(){let s=E.initialState();for(const key of ['engine1Running','engine2Running','batterySwitch'])s=control(s,key,false);s=select(select(s,'OFF',1),'OFF',2);return s;}
test('normal Classic source/transfer/TR paths and DC tie are distinct',()=>{
 const s=E.initialState(),before=JSON.stringify(s),n=net(s);
 assert.equal(n.authority,'EXISTING_ECU_ELECTRICAL_PACK');
 assert.deepEqual(n.nodes.TR1.feeds,['TRANSFER_1']);assert.deepEqual(n.nodes.TR2.feeds,['TRANSFER_2']);
 assert.deepEqual(n.nodes.TR3.feeds,['MAIN_2']);assert.deepEqual(n.nodes.BATTERY_BUS.feeds,['TR3']);
 assert.equal(n.nodes.DC_1.volts,28);assert.equal(n.nodes.AC_STANDBY.volts,115);
 assert.equal(JSON.stringify(s),before,'projection cannot mutate the sole owner');
});
test('GEN1 loss preserves the dead main bus and traces essential transfer to GEN2',()=>{
 const n=net(fault(E.initialState(),'GEN1_FAILED'));
 assert.equal(n.nodes.MAIN_1.powered,false);assert.equal(n.nodes.GENERATOR_BUS_1.powered,false);
 assert.equal(n.nodes.TRANSFER_1.powered,true);
 assert.deepEqual(n.nodes.TRANSFER_1.feeds,['GENERATOR_BUS_2']);
 assert.equal(n.edges.filter(x=>x.to==='GENERATOR_BUS_1'&&x.closed===true).length,0);
});
test('BUS TRANS OFF removes alternate transfer and separates DC sides',()=>{
 const n=net(control(fault(E.initialState(),'GEN1_FAILED'),'busTransferAuto',false));
 assert.equal(n.nodes.TRANSFER_1.powered,false);assert.equal(n.dcTieClosed,false);
 assert.equal(n.nodes.DC_1.powered,false);assert.equal(n.nodes.DC_2.powered,true);
});
test('external AC is measurable before connection; battery and contactor are required for buses',()=>{
 let s=control(cold(),'groundPowerAttached',true);let n=net(s);
 assert.equal(n.nodes.EXT.available,true);assert.equal(n.nodes.EXT.volts,115);
 assert.equal(n.nodes.GENERATOR_BUS_1.powered,false);
 assert.throws(()=>select(s,'EXT'),/conditions/);
 s=select(control(s,'batterySwitch',true),'EXT');n=net(s);
 assert.deepEqual(n.nodes.GENERATOR_BUS_1.feeds,['EXT']);assert.deepEqual(n.nodes.GENERATOR_BUS_2.feeds,['EXT']);
 s=select(control(s,'engine1Running',true),'GEN1');n=net(s);
 assert.deepEqual(n.nodes.GENERATOR_BUS_1.feeds,['GEN1']);assert.deepEqual(n.nodes.GENERATOR_BUS_2.feeds,['EXT']);
 assert.equal(n.edges.filter(x=>x.to==='GENERATOR_BUS_1'&&x.closed).length,1);
});
test('ground service supplies charger with both aircraft generator buses dead',()=>{
 let s=control(control(cold(),'groundPowerAttached',true),'groundServiceSelected',true);const n=net(s);
 assert.equal(n.nodes.GROUND_SERVICE.powered,true);assert.deepEqual(n.nodes.CHARGER.feeds,['GROUND_SERVICE']);
 assert.equal(n.nodes.GENERATOR_BUS_1.powered,false);assert.equal(n.nodes.GENERATOR_BUS_2.powered,false);
 assert.equal(n.nodes.CHARGER.amps,null);
});
test('ground power quality failure deenergizes supplied buses',()=>{
 let s=select(control(control(cold(),'batterySwitch',true),'groundPowerAttached',true),'EXT');
 const n=net(control(s,'groundPowerQualityGood',false));
 assert.equal(n.nodes.EXT.available,false);assert.equal(n.nodes.MAIN_1.powered,false);assert.equal(n.nodes.TR3.powered,false);
});
test('APU supplies two ground buses; flight selection keeps only the selected side',()=>{
 let s=control(control(cold(),'batterySwitch',true),'apuRunning',true);
 s=select(select(s,'APU',1),'APU',2);assert.equal(net(s).nodes.APU.connectedBusSides.length,2);
 s=control(s,'onGround',false);s=select(s,'APU',2);const n=net(s);
 assert.deepEqual(n.nodes.APU.connectedBusSides,[2]);assert.equal(n.nodes.MAIN_1.powered,false);
 assert.equal(n.nodes.TRANSFER_1.powered,true);
});
test('standby BAT with battery switch OFF has a continuous hot-bus -> inverter path',()=>{
 const s=control(cold(),'standbySelector','BAT'),n=net(s);
 assert.equal(n.nodes.BATTERY_BUS.powered,true);assert.equal(n.nodes.SWITCHED_HOT_BATTERY_BUS.powered,false);
 assert.deepEqual(n.nodes.BATTERY_BUS.feeds,['HOT_BATTERY_BUS']);
 assert.deepEqual(n.nodes.INVERTER.feeds,['BATTERY_BUS']);assert.deepEqual(n.nodes.AC_STANDBY.feeds,['INVERTER']);
 assert.equal(n.nodes.AC_STANDBY.volts,115);assert.equal(n.nodes.DC_STANDBY.volts,24);
});
test('BAT standby forces battery feed even with TR3 live; empty battery does not masquerade as TR3',()=>{
 let s=control(E.initialState(),'standbySelector','BAT');
 assert.deepEqual(net(s).nodes.BATTERY_BUS.feeds,['HOT_BATTERY_BUS']);
 s=fault(s,'BATTERY_DEPLETED');assert.equal(net(s).nodes.BATTERY_BUS.powered,false);
});
test('inverter fault removes only AC emergency standby; DC path stays alive',()=>{
 const s=fault(control(cold(),'standbySelector','BAT'),'STATIC_INVERTER_FAILED'),n=net(s);
 assert.equal(n.nodes.INVERTER.powered,false);assert.equal(n.nodes.AC_STANDBY.powered,false);
 assert.equal(n.nodes.DC_STANDBY.powered,true);
});
test('ground AUTO source conflict and TR3 backup uncertainty stay UNKNOWN',()=>{
 const s=control(cold(),'batterySwitch',true),n=net(s);
 assert.equal(n.nodes.AC_STANDBY.powered,null);assert.equal(n.nodes.AC_STANDBY.volts,null);
 const t=net(fault(fault(E.initialState(),'TR1_FAILED'),'TR2_FAILED'));
 assert.equal(t.nodes.DC_1.powered,null);assert.equal(t.edges.find(x=>x.from==='TR3'&&x.to==='DC_1').closed,null);
});
test('meter positions select terminals, not buses; disconnected spinning generator field stays unknown',()=>{
 let s=select(E.initialState(),'OFF',1);const n=net(s);
 assert.equal(n.nodes.GEN1.available,true);assert.equal(n.meterSources.AC.GEN1.volts,null);
 assert.equal(n.meterSources.DC['APU BAT'].volts,null);assert.equal(n.meterSources.AC.TEST.cps,null);
 assert.equal(n.meterSources.DC.TR3.volts,28);assert.equal(n.meterSources.DC.TR3.amps,null);
});
test('strict numbers distinguish nominal model, missing sensors and dead circuits',()=>{
 const s=E.initialState(),n=net(s,{numericMode:'SENSOR_ONLY'});
 assert.equal(n.nodes.TRANSFER_1.powered,true);assert.equal(n.nodes.TRANSFER_1.volts,null);
 assert.equal(net(cold(),{numericMode:'SENSOR_ONLY'}).nodes.MAIN_1.volts,0);
 assert.equal(net(s).nodes.MAIN_1.numericQuality,'NOMINAL_MODEL');
});
test('explicit source sensors propagate along AC paths and cannot resurrect a dead bus',()=>{
 const n=net(E.initialState(),{measurements:{GEN1:{volts:114,hz:399,amps:20},BATTERY:{volts:25}}});
 assert.equal(n.nodes.TRANSFER_1.volts,114);assert.equal(n.nodes.AC_STANDBY.hz,399);
 assert.equal(n.nodes.HOT_BATTERY_BUS.volts,25);
 assert.equal(n.nodes.GEN1.numericQuality,'SENSOR_INPUT');assert.equal(n.nodes.GEN1.amps,20);
 assert.equal(net(cold(),{measurements:{MAIN_1:{volts:115}}}).nodes.MAIN_1.volts,0);
});
test('sensor values and stale owner results are validated before publication',()=>{
 const s=E.initialState();assert.throws(()=>N.project(control(s,'onGround',false),E.evaluate(s)),/Matching/);
 for(const sample of [{GEN1:{hz:NaN}},{BATTERY:{hz:400}},{GEN1:{volts:-1}},{NO_BUS:{volts:1}}]){
  assert.throws(()=>net(s,{measurements:sample}));
 }
});
test('consumer port requires an explicit bus and CB; a definite open gate always removes power',()=>{
 const n=net(E.initialState());assert.equal(N.supply(n,{bus:'transfer1'}).operating,null);
 assert.equal(N.supply(n,{bus:'transfer1',cbClosed:true}).operating,true);
 assert.equal(N.supply(n,{bus:'UNKNOWN'}).operating,null);
 assert.equal(N.supply(n,{bus:'UNKNOWN',cbClosed:false}).operating,false);
 assert.equal(N.supply(n,{bus:'transfer1',cbClosed:true,switchOn:false}).operating,false);
});
