/* Run: node tests/classic-multifeed-topology-v1.test.js
 * Topology only: does not imply live cockpit actuator integration.
 */
'use strict';
const assert=require('node:assert/strict');
const topology=require('../engine/systems/classic-multifeed-topology-v1.js');
const core=require('../engine/systems/classic-bus-consumer-engine-v1.js');
const index=require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');
const coverage=topology.validateIndex(index);
assert.deepEqual([coverage.multifeedDevices,coverage.required,coverage.alternate,coverage.independent],
 [17,8,4,5]);
const raw={};
for(const k of ['generator1','generator2','main1','main2','transfer1','transfer2',
 'dc1','dc2','battery','hotBattery','switchedHotBattery','groundService','acStandby','dcStandby'])
 raw[k]=true;
const electrical={schema:'B737_ELECTRICAL_V7_RESULT',bus:raw,revision:'TEST'};
const base=Object.fromEntries(Object.keys(core.defineBuses(electrical)).map(k=>[k,true]));
const project=changes=>core.project({index,electrical,includeAllConfigurations:true,
 labBusPower:{...base,...changes}});
const nominal=project({});
assert.equal(Object.keys(nominal.devices).length,322);
let cases=0;
for(const [name,profile] of Object.entries(topology.PROFILES)){
 const device=nominal.devices[name];
 assert.equal(device.topology,profile.topology,name);
 assert.equal(device.state,'NORMAL',name);
 cases++;
 for(const key of profile.keys){
  const got=project({[key]:false}).devices[name];
  assert.equal(got.state,profile.topology==='ALL_REQUIRED'?'OFF':
   profile.topology==='ANY_AVAILABLE'?'NORMAL':'DEGRADED',name+' '+key);
  cases++;
 }
 const allLost=Object.fromEntries(profile.keys.map(k=>[k,false]));
 assert.equal(project(allLost).devices[name].state,'OFF',name);
 cases++;
}
for(const [side,key] of [['left','transfer1@115VAC'],['right','transfer2@115VAC']]){
 const d=project({[key]:false}).devices['Alpha Vane AoA - '+side];
 assert.equal(d.capabilities.VANE_HEATER,false);
 assert.equal(d.state,'DEGRADED');
 cases++;
}
for(const [side,extra] of [['left','main1@115VAC'],['right','main2@115VAC']]){
 const d=project({[extra]:false}).devices['Alpha Vane AoA - '+side];
 assert.equal(d.capabilities.VANE_HEATER,true);
 cases++;
}
const required=nominal.devices['Yaw Damper'];
const requiredRows=required.channels.map(id=>nominal.consumers[id]);
const cbRequired=requiredRows.map((row,i)=>i===0?{...row,cbState:'OPEN'}:row);
assert.equal(topology.resolveDevice('Yaw Damper',cbRequired,nominal.buses).state,'OFF');
cases++;
const fmc=nominal.devices.FMC;
const fmcRows=fmc.channels.map(id=>nominal.consumers[id]);
const cbFmc=fmcRows.map((row,i)=>i===0?{...row,cbState:'OPEN'}:row);
assert.equal(topology.resolveDevice('FMC',cbFmc,nominal.buses).state,'NORMAL');
cases++;
const unknownBus={...nominal.buses,'electronic1@115VAC':{
 ...nominal.buses['electronic1@115VAC'],powered:null}};
assert.equal(topology.resolveDevice('Yaw Damper',requiredRows,unknownBus).state,'UNKNOWN');
cases++;
for(const key of Object.keys(base)){
 const snap=project({[key]:false});
 assert.equal(Object.keys(snap.consumers).length,340);
 assert.equal(Object.keys(snap.devices).length,322);
 cases++;
}
console.log('PASS multi-feed topology '+cases+' assertions across 17 devices / 24 buses');