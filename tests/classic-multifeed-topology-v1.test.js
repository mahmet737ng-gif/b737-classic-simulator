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
console.log('PASS multi-feed topology '+cases+' operational state assertions across 17 devices');