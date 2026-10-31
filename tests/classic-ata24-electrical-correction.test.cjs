/* B737-300/400/500 ATA 24: source/relay/standby regression gate.
 * Educational modelling; does not certify any EP-FSI WDM installation.
 */
'use strict';
const test=require('node:test');
const a=require('node:assert/strict');
const V7=require('../engine/systems/electrical-v7.js');
const Network=require('../engine/systems/electrical-network-v1.js');
const Loads=require('../engine/integration/battery-panel-loads-v1.js');
const Battery=require('../engine/systems/battery-dynamics-v1.js');
const Pack=require('../engine/integration/isn-electrical-pack-v1.js');
const fresh=()=>V7.initialState({coldDark:true});
const evalWith=(change=()=>{})=>{
 const state=fresh();change(state);
 const electrical=V7.evaluate(state);
 return {state,electrical,network:Network.project(state,electrical),
  loads:Loads.project(state,electrical)};
};
test('Cold & dark preset starts with no AC source, no Battery Bus and no ground AUTO standby',()=>{
 const {state,electrical:e}=evalWith();
 a.equal(state.config.engine1Running,false);a.equal(state.config.engine2Running,false);
 a.equal(state.source[1],null);a.equal(state.source[2],null);
 a.equal(e.bus.generator1,false);a.equal(e.bus.generator2,false);
 a.equal(e.bus.battery,false);
 a.equal(e.bus.acStandby,false);a.equal(e.bus.dcStandby,false);
});
test('BAT ON supplies battery bus but not ground AUTO standby; BAT forces standby',()=>{
 const normal=evalWith(s=>{s.config.batterySwitch=true}).electrical;
 a.equal(normal.bus.battery,true);
 a.equal(normal.bus.acStandby,false);a.equal(normal.bus.dcStandby,false);
 const forced=evalWith(s=>{s.config.standbySelector='BAT'}).electrical;
 a.equal(forced.bus.battery,true);
 a.equal(forced.bus.acStandby,true);a.equal(forced.bus.dcStandby,true);
});
test('BAT OFF interrupts TR3 Battery Bus relay even with AC / normal standby available',()=>{
 const {electrical:e,network:n}=evalWith(s=>{
  s.config.engine2Running=true;s.source[2]='GEN2';
 });
 a.equal(e.bus.generator2,true);a.equal(e.feed.tr.TR3,true);
 a.equal(e.bus.battery,false);
 a.equal(n.edges.find(x=>x.id==='TR3>BATTERY_BUS').closed,false);
 a.equal(e.bus.acStandby,true);a.equal(e.bus.dcStandby,true);
});
test('Battery Charger feeds Hot Battery Bus with flat battery and online generator',()=>{
 const {electrical:e,network:n,loads:l}=evalWith(s=>{
  s.config.batterySwitch=true;s.config.engine2Running=true;s.source[2]='GEN2';
  s.battery=Battery.step(Battery.initial({chargeAh:0}),0);
 });
 a.equal(e.feed.batteryAvailable,false);
 a.equal(e.feed.chargerSource,'MAIN_2');
 a.equal(e.feed.hotBatterySource,'CHARGER');
 a.equal(e.bus.hotBattery,true);a.equal(e.bus.battery,true);
 a.equal(n.nodes.BATTERY.powered,false);
 a.deepEqual(n.nodes.HOT_BATTERY_BUS.feeds,['CHARGER']);
 a.equal(n.nodes.CHARGER.powered,true);
 a.equal(l.chargerAvailable,true);
});
test('A flat battery with no AC cannot energize the Hot Battery Bus',()=>{
 const {electrical:e,network:n}=evalWith(s=>{
  s.config.batterySwitch=true;
  s.battery=Battery.step(Battery.initial({chargeAh:0}),0);
 });
 a.equal(e.bus.hotBattery,false);a.equal(e.bus.battery,false);
 a.equal(n.nodes.CHARGER.powered,false);
});
test('Ground service can power charger without energizing main AC busses',()=>{
 const {electrical:e,network:n}=evalWith(s=>{
  s.config.onGround=true;s.config.groundPowerAttached=true;
  s.config.groundServiceSelected=true;
  s.battery=Battery.step(Battery.initial({chargeAh:0}),0);
 });
 a.equal(e.bus.generator1,false);a.equal(e.bus.generator2,false);
 a.equal(e.feed.chargerSource,'GROUND_SERVICE');
 a.deepEqual(n.nodes.HOT_BATTERY_BUS.feeds,['CHARGER']);
});
test('GPU availability is not an AC connection and APU running is not a GEN selection',()=>{
 const gpu=evalWith(s=>{s.config.groundPowerAttached=true}).electrical;
 a.equal(gpu.bus.generator1,false);a.equal(gpu.bus.generator2,false);
 const apu=evalWith(s=>{s.config.apuRunning=true}).electrical;
 a.equal(apu.bus.generator1,false);a.equal(apu.bus.generator2,false);
});
test('Generator contactor energizes its AC bus and can crossfeed transfer without energizing opposite generator bus',()=>{
 const {electrical:e}=evalWith(s=>{
  s.config.batterySwitch=true;s.config.engine1Running=true;s.source[1]='GEN1';
 });
 a.equal(e.bus.generator1,true);a.equal(e.bus.generator2,false);
 a.equal(e.bus.transfer1,true);a.equal(e.bus.transfer2,true);
});
test('Flight AUTO transfers to battery inverter after AC loss',()=>{
 const {electrical:e,network:n}=evalWith(s=>{
  s.config.onGround=false;s.config.batterySwitch=true;
 });
 a.equal(e.bus.acStandby,true);a.equal(e.bus.dcStandby,true);
 a.equal(n.nodes.INVERTER.powered,true);
});
test('Explicit STANDBY OFF disables both standby buses even with GEN1 connected',()=>{
 const {electrical:e}=evalWith(s=>{
  s.config.engine1Running=true;s.source[1]='GEN1';s.config.standbySelector='OFF';
 });
 a.equal(e.bus.acStandby,false);a.equal(e.bus.dcStandby,false);
});
test('Integrated electrical pack resets cold and dark instead of legacy both-engines-running bench',()=>{
 const instance=Object.create(Pack.Session.prototype);
 instance.Electrical=V7;instance.WarningEngine=function(){return {}};
 instance.compute=()=>({schema:'test'});
 instance.reset();
 a.equal(instance.electricalState.config.engine1Running,false);
 a.equal(instance.electricalState.config.engine2Running,false);
 a.equal(instance.electricalState.source[1],null);
 a.equal(instance.electricalState.source[2],null);
});
test('Battery charge still integrates with AC charger rather than faking percentage',()=>{
 const discharged=Battery.step(Battery.initial({chargeAh:20}),60,{loadAmps:4});
 const charged=Battery.step(discharged,120,{loadAmps:0.5,chargerAvailable:true});
 a(charged.chargeAh>discharged.chargeAh);
});
