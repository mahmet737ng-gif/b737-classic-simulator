'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Battery=require('../engine/systems/battery-dynamics-v1');
const Loads=require('../engine/integration/battery-panel-loads-v1');
const E=require('../engine/systems/electrical-v7');
const Network=require('../engine/systems/electrical-network-v1');
const Pack=require('../engine/integration/isn-electrical-pack-v1');
const ElectricalLoads=require('../engine/systems/electrical-loads-v8');
const TrainerCore=require('../engine/trainer/core');
const {WarningEngine}=require('../audio/warning-engine');
const control=(s,key,value)=>E.apply(s,{type:'CONTROL',key,value});
function pack(){
 const p=new Pack.Session({Electrical:E,Loads:ElectricalLoads,TrainerCore,WarningEngine});
 for(const key of ['engine1Running','engine2Running'])p.send({type:'ELECTRICAL',action:{type:'CONTROL',key,value:false}});
 for(const side of [1,2])p.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',source:'OFF',side}});
 return p;
}
test('coulomb count: 10 A for one real hour consumes exactly 10 Ah and voltage falls',()=>{
 const initial=Battery.initial(),end=Battery.step(initial,3600,{loadAmps:10});
 assert.ok(Math.abs(end.chargeAh-30)<1e-8);assert.ok(Math.abs(end.dischargedAh-10)<1e-8);
 assert.equal(end.ammeterA,-10);assert.ok(end.voltageV<initial.voltageV);
 assert.equal(initial.chargeAh,40,'pure integration preserves input state');
});
test('background catch-up and foreground ticks integrate the same consumption',()=>{
 const once=Battery.step(Battery.initial(),600,{loadAmps:12,inverterWatts:160});
 let ticks=Battery.initial();for(let i=0;i<600;i++)ticks=Battery.step(ticks,1,{loadAmps:12,inverterWatts:160});
 assert.ok(Math.abs(once.chargeAh-ticks.chargeAh)<1e-10);
 assert.ok(Math.abs(once.dischargedWh-ticks.dischargedWh)<1e-10);
});
test('exhaustion never creates negative charge or keeps discharging an empty battery',()=>{
 const end=Battery.step(Battery.initial(),7200,{loadAmps:40});
 assert.equal(end.chargeAh,0);assert.equal(end.depleted,true);assert.equal(end.available,false);
 assert.equal(end.dischargeA,0);assert.ok(Math.abs(end.dischargedAh-40)<1e-8);
 assert.equal(Battery.snapshot(end).percent,0);
});
test('charger supplies attached load first, restores charge and tapers at full capacity',()=>{
 const initial=Battery.initial({chargeAh:20});
 const end=Battery.step(initial,3600,{loadAmps:3,chargerAvailable:true});
 assert.ok(end.chargeAh>initial.chargeAh);assert.ok(end.chargeAh<=40);assert.equal(end.voltageV,28);
 const full=Battery.step(Battery.initial(),3600,{loadAmps:3,chargerAvailable:true});
 assert.equal(full.chargeAh,40);assert.equal(full.ammeterA,0);assert.equal(full.chargerA,3);
});
test('saved numerical state survives JSON reload without refilling',()=>{
 const b=Battery.step(Battery.initial(),3600,{loadAmps:12});
 assert.equal(Battery.step(JSON.parse(JSON.stringify(b)),0).chargeAh,b.chargeAh);
 assert.throws(()=>Battery.step({...b,chargeAh:1000},1));
 assert.throws(()=>Battery.step(b,NaN));assert.throws(()=>Battery.step(b,1,{loadAmps:-1}));
});
test('same Pack owns capacity, current, bus cutoff and actual BAT meter readings',()=>{
 const p=pack();p.attachBattery(Battery,Battery.initial({chargeAh:1}));
 let s=p.electricalState,e=p.get().electrical;
 let demand=Loads.project(s,e,{litLamps:20,brightness:50});
 const before=p.getBattery();p.advanceBattery(60,demand);
 assert.ok(p.getBattery().chargeAh<before.chargeAh);assert.ok(p.getBattery().ammeterA<0);
 const n=Network.project(p.electricalState,p.get().electrical);
 assert.equal(n.meterSources.DC.BAT.amps,p.getBattery().ammeterA);
 assert.equal(n.meterSources.DC.BAT.volts,p.getBattery().voltageV);
 p.advanceBattery(3600,demand);
 assert.equal(p.getBattery().chargeAh,0);assert.equal(p.get().electrical.bus.battery,false);
 assert.equal(p.get().electrical.bus.hotBattery,false);
 assert.equal(Loads.project(p.electricalState,p.get().electrical).panelPower,false);
});
test('actual brightness, illuminated lamps, standby inverter and APU starter change current',()=>{
 const p=pack();p.attachBattery(Battery);
 const base=Loads.project(p.electricalState,p.get().electrical,{brightness:0});
 const bright=Loads.project(p.electricalState,p.get().electrical,{brightness:100,litLamps:30});
 const starter=Loads.project(p.electricalState,p.get().electrical,{apuPhase:'STARTING'});
 assert.ok(bright.loadAmps>base.loadAmps);assert.ok(starter.loadAmps>base.loadAmps+200);
 p.send({type:'ELECTRICAL',action:{type:'CONTROL',key:'standbySelector',value:'BAT'}});
 const standby=Loads.project(p.electricalState,p.get().electrical);
 assert.equal(standby.inverterWatts,160);
 p.send({type:'ELECTRICAL',action:{type:'FAULT',id:'STATIC_INVERTER_FAILED',active:true,instructor:true}});
 assert.equal(Loads.project(p.electricalState,p.get().electrical).inverterWatts,0);
});
test('BATTERY OFF disconnects switched panel load but retains hot-bus consumption',()=>{
 const p=pack();p.attachBattery(Battery);
 const on=Loads.project(p.electricalState,p.get().electrical);
 p.send({type:'ELECTRICAL',action:{type:'CONTROL',key:'batterySwitch',value:false}});
 const off=Loads.project(p.electricalState,p.get().electrical);
 assert.ok(off.loadAmps<on.loadAmps);assert.equal(off.loadAmps,0.05);assert.equal(off.panelPower,false);
});
test('external AC through service/charger recharges an exhausted installed battery',()=>{
 const p=pack();p.attachBattery(Battery,Battery.initial({chargeAh:0}));
 p.send({type:'ELECTRICAL',action:{type:'CONTROL',key:'groundPowerAttached',value:true}});
 p.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',side:1,source:'EXT'}});
 const input=Loads.project(p.electricalState,p.get().electrical);
 assert.equal(input.chargerAvailable,true);p.advanceBattery(60,input);
 assert.ok(p.getBattery().chargeAh>0);assert.ok(p.getBattery().ammeterA>0);
 assert.equal(p.get().electrical.bus.hotBattery,true);
});
test('Pack switch reset cannot magically restore consumed capacity',()=>{
 const p=pack();p.attachBattery(Battery);p.advanceBattery(600,{loadAmps:15});
 const charge=p.getBattery().chargeAh;p.reset();assert.equal(p.getBattery().chargeAh,charge);
});
test('training profile is explicit; missing aircraft currents are not silently certified',()=>{
 assert.match(Battery.PROFILE.quality,/TRAINING/);
 const p=pack(),input=Loads.project(p.electricalState,p.get().electrical);
 assert.match(input.quality,/NOT_EP_FSI/);
 assert.ok(input.loads.every(x=>x.quality==='LIVE_SWITCH_WITH_TRAINING_CURRENT'));
});
