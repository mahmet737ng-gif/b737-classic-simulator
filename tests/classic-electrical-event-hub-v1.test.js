/* node tests/classic-electrical-event-hub-v1.test.js */
'use strict';const assert=require('node:assert/strict');
require('../engine/systems/classic-multifeed-topology-v1.js');
const Core=require('../engine/systems/classic-bus-consumer-engine-v1.js');
const Hub=require('../engine/systems/classic-electrical-event-hub-v1.js');
const index=require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');
const bus={};for(const k of ['generator1','generator2','main1','main2',
 'transfer1','transfer2','dc1','dc2','battery','hotBattery','switchedHotBattery',
 'groundService','acStandby','dcStandby'])bus[k]=true;
const electrical={schema:'B737_ELECTRICAL_V7_RESULT',bus,revision:'TEST'};
const base=Object.fromEntries(Object.keys(Core.defineBuses(electrical)).map(k=>[k,true]));
const project=delta=>Core.project({index,electrical,
 labBusPower:{...base,...delta},includeAllConfigurations:true});
const hub=Hub.createHub(),msgs={bus:[],heater:[],pump:[],unrelated:[]};
const stop=[
 hub.subscribeBus('transfer1@115VAC',e=>msgs.bus.push(e)),
 hub.subscribeCapability('Alpha Vane AoA - left','VANE_HEATER',e=>msgs.heater.push(e)),
 hub.subscribeDevice('Fuel Boost Pump - Main Tank 1 Aft',e=>msgs.pump.push(e)),
 hub.subscribeDevice('Window Heat Control - R1',e=>msgs.unrelated.push(e))
];
hub.publish(project({}));assert.equal(msgs.bus[0].type,'INITIAL');
assert.equal(msgs.heater[0].value.available,true);
hub.publish(project({}));assert.equal(msgs.bus.length,1);
hub.publish(project({'transfer1@115VAC':false}));
assert.equal(msgs.bus.at(-1).type,'POWER_LOST');
assert.equal(msgs.heater.at(-1).value,false);
assert.equal(msgs.pump.at(-1).value.state,'OFF');
assert.equal(msgs.unrelated.length,1);
const size=msgs.bus.length;
hub.publish(project({'transfer1@115VAC':false}));
assert.equal(msgs.bus.length,size);
hub.publish(project({}));
assert.equal(msgs.bus.at(-1).type,'POWER_RESTORED');
assert.equal(msgs.heater.at(-1).value,true);
stop.forEach(x=>x());assert.equal(hub.getStats().activeSubscriptions,0);
let late=0;const unsub=hub.subscribeBus('transfer1@115VAC',()=>late++);
assert.equal(late,1);unsub();
console.log('PASS ATA24 event hub: deltas, isolation, no duplicates, restore, cleanup');