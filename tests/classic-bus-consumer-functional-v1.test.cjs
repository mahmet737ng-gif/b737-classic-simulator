'use strict';
// Source-located MRG 340 -> live Electrical V7 -> shared ISN fuel/hyd pumps.
// Tests capability, not equipment switch command or installation WDM.
const assert=require('node:assert/strict');
const index=require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');
const Core=require('../engine/systems/classic-bus-consumer-engine-v1.js');
const E=require('../engine/systems/electrical-v7.js');
const Loads=require('../engine/systems/electrical-loads-v8.js');
const TrainerCore=require('../engine/trainer/core');
const {WarningEngine}=require('../audio/warning-engine');
const Pack=require('../engine/integration/isn-electrical-pack-v1.js');
const active=s=>Core.project({index,electrical:E.evaluate(s),electricalState:s,mode:'CONVENTIONAL',pressurization:'CPCS'});
const find=(p,name)=>Object.values(p.consumers).find(x=>x.name===name);
assert.equal(Core.validate(index),true);
let s=E.initialState({coldDark:true}),cold=active(s);
assert.equal(Object.keys(cold.consumers).length,340);
assert.equal(Object.keys(cold.buses).length,26);
assert.equal(cold.coverage.sourceRows,340);
assert.equal(cold.coverage.logicalDevices,322,'Source rows aggregate into distinct electrical devices');
assert.equal(Object.keys(cold.devices).length,322);
const eq300=active(E.initialState());
assert.equal(find(eq300,'Temp. Control - aft cabin (400)').powerState,'NOT_INSTALLED');
assert.equal(find(eq300,'Temp. Control Auto - left (300-500)').powerState,'NORMAL');
assert.equal(find(eq300,'Rain Repellent - left (As installed)').powerState,'UNKNOWN');
const eq400=Core.project({index,electrical:E.evaluate(E.initialState()),
 electricalState:E.initialState(),aircraftModel:'737-400',pressurization:'DCPCS'});
assert.equal(find(eq400,'Temp. Control - aft cabin (400)').powerState,'NORMAL');
assert.equal(find(eq400,'Temp. Control Auto - left (300-500)').powerState,'NOT_INSTALLED');
assert.equal(cold.buses['main1@115VAC'].powered,false);
assert.equal(cold.buses['hotBattery@28VDC'].powered,true);
assert.equal(cold.buses['battery@28VDC'].powered,false);
assert.equal(find(cold,'Fuel Boost Pump - Main Tank 1 Forward').powerState,'OFF');
assert.equal(find(cold,'Engines N1 Indication').powerState,'OFF');
const before=JSON.stringify(s);
active(s);
assert.equal(JSON.stringify(s),before,'projection never mutates owned electrical source');
s=E.apply(s,{type:'CONTROL',key:'batterySwitch',value:true});
const bat=active(s);
assert.equal(find(bat,'Engines N1 Indication').powerState,'NORMAL');
assert.equal(find(bat,'Engines EGT Indication').powerState,'OFF');
assert.equal(find(bat,'Fuel Boost Pump - Main Tank 1 Forward').powerState,'OFF');
s=E.apply(s,{type:'CONTROL',key:'engine1Running',value:true});
s=E.apply(s,{type:'CONTROL',key:'engine2Running',value:true});
s=E.apply(s,{type:'SELECT_SOURCE',side:1,source:'GEN1'});
s=E.apply(s,{type:'SELECT_SOURCE',side:2,source:'GEN2'});
const normal=active(s);
assert.equal(normal.coverage.NORMAL>310,true);
assert.equal(Core.lookupPump('fuel.main1FwdPump',E.evaluate(s)).powered,true);
assert.equal(Core.lookupPump('hyd.electricPumpA',E.evaluate(s)).powered,true);
let one=E.apply(s,{type:'SELECT_SOURCE',side:1,source:'OFF'});
const backfeed=active(one);
assert.equal(E.evaluate(one).bus.transfer1,true);
assert.equal(E.evaluate(one).bus.main1,false);
assert.equal(Core.lookupPump('fuel.main1AftPump',E.evaluate(one)).powered,true);
assert.equal(Core.lookupPump('fuel.main1FwdPump',E.evaluate(one)).powered,false);
assert.equal(Core.lookupPump('fuel.centerRightPump',E.evaluate(one)).powered,false);
assert.equal(Core.lookupPump('hyd.electricPumpB',E.evaluate(one)).powered,false);
assert.equal(Core.lookupPump('hyd.electricPumpA',E.evaluate(one)).powered,true);
assert.equal(backfeed.systems.FUEL.state,'DEGRADED');
assert.equal(backfeed.devices['Autothrottle'].topology,'ALL_REQUIRED');
assert.equal(backfeed.devices['Autothrottle'].state,'OFF',
 'Autothrottle needs AC and DC electronic power');
assert.equal(backfeed.devices['Window Heat Control - L1'].state,'OFF',
 'Window heat controller requires both AC main and DC control buses');
assert.equal(backfeed.devices['EFIS Control Panel FO'].state,'NORMAL',
 'Duplicate source row from the same bus must not invent two distinct feeds');
const isolated=E.apply(one,{type:'CONTROL',key:'busTransferAuto',value:false});
const cut=active(isolated);
assert.equal(Core.lookupPump('fuel.main1AftPump',E.evaluate(isolated)).powered,false);
assert.equal(Core.lookupPump('fuel.main2AftPump',E.evaluate(isolated)).powered,true);
assert.equal(find(cut,'Engine 1 Oil Quantity Indication').powerState,'OFF');
assert.equal(find(cut,'Engine 2 Oil Quantity Indication').powerState,'NORMAL');
// Inflight AUTO retains battery-fed AC/DC standby after both engine generators fail.
let flying=E.apply(s,{type:'CONTROL',key:'onGround',value:false});
flying=E.apply(flying,{type:'SELECT_SOURCE',side:1,source:'OFF'});
flying=E.apply(flying,{type:'SELECT_SOURCE',side:2,source:'OFF'});
assert.equal(active(flying).buses['standby@115VAC'].powered,true);
assert.equal(active(flying).buses['standby@28VDC'].powered,true);
let ground=E.apply(flying,{type:'CONTROL',key:'onGround',value:true});
assert.equal(active(ground).buses['standby@115VAC'].powered,false);
const standbyOff=E.apply(s,{type:'CONTROL',key:'standbySelector',value:'OFF'});
assert.equal(find(active(standbyOff),'Engines EGT Indication').powerState,'OFF');
const eit=Core.project({index,electrical:E.evaluate(s),electricalState:s,mode:'EIS',pressurization:'DCPCS',
 cbAvailable:id=>id==='engine1.n1Indicator'?false:true});
assert.equal(find(eit,'Engines N1 Indication').powerState,'DEGRADED');
assert.equal(find(eit,'Engine 1 N2 Indication (non-EIS)').powerState,'NOT_INSTALLED');
assert.equal(find(eit,'Engines Fuel Flow Indication (EIS)').powerState,'NORMAL');
assert.equal(eit.coverage.sourceRows,340);
assert.equal(Object.values(eit.consumers).filter(x=>x.quality==='MRG_SOURCE_REVIEW_PENDING').length>0,true);

const old=globalThis.B737ClassicBusConsumersV1;
globalThis.B737ClassicBusConsumersV1=Core;
try{
 const pack=new Pack.Session({Electrical:E,Loads,TrainerCore,WarningEngine});
 for(const id of Object.keys(Core.MRG_PUMP_FEEDS))
  pack.send({type:'PUMP_SWITCH',id,value:true});
 // Cold/dark: every electrical boost pump unavailable.
 let snap=pack.get();
 for(const id of Object.keys(Core.MRG_PUMP_FEEDS)){
  assert.equal(snap.pumps[id].powered,false,id+' should be OFF cold/dark');
  assert.equal(snap.pumps[id].operating,false,id+' should not run cold/dark');
 }
 pack.send({type:'ELECTRICAL',action:{type:'CONTROL',key:'batterySwitch',value:true}});
 for(const n of [1,2])
  pack.send({type:'ELECTRICAL',action:{type:'CONTROL',key:'engine'+n+'Running',value:true}});
 pack.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',side:1,source:'GEN1'}});
 pack.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',side:2,source:'GEN2'}});
 snap=pack.get();
 for(const id of Object.keys(Core.MRG_PUMP_FEEDS)){
  assert.equal(snap.pumps[id].operating,true,id+' power should follow the real bus');
  assert.equal(snap.pumps[id].powerEvidence,'MRG_IV6_CLASSIC_FUNCTIONAL_BUS');
 }
 pack.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',side:1,source:'OFF'}});
 snap=pack.get();
 assert.equal(snap.pumps['fuel.main1FwdPump'].operating,false);
 assert.equal(snap.pumps['fuel.main1AftPump'].operating,true);
 assert.equal(snap.pumps['hyd.electricPumpB'].operating,false);
 assert.equal(snap.pumps['hyd.electricPumpA'].operating,true);
 pack.send({type:'ELECTRICAL',action:{type:'CONTROL',key:'busTransferAuto',value:false}});
 snap=pack.get();
 assert.equal(snap.pumps['fuel.main1AftPump'].operating,false);
 assert.equal(snap.pumps['fuel.main2AftPump'].operating,true);
}finally{
 if(old===undefined)delete globalThis.B737ClassicBusConsumersV1;
 else globalThis.B737ClassicBusConsumersV1=old;
}
console.log('PASS ATA24 all 340 consumers, 26 bus class nodes, CB channel degradation, standby, 8 working fuel/hyd pumps');
