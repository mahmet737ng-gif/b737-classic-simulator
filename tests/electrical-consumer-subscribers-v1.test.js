/* node tests/electrical-consumer-subscribers-v1.test.js
 * This verifies real MRG registration/delta delivery and does not claim
 * that every aircraft system already has a physical/visual implementation.
 */
'use strict';
const assert=require('node:assert/strict');
require('../engine/systems/classic-multifeed-topology-v1.js');
const Core=require('../engine/systems/classic-bus-consumer-engine-v1.js');
const Hub=require('../engine/systems/classic-electrical-event-hub-v1.js');
const Registry=require('../panel-mosaic-lab/cockpit/electrical-consumer-subscribers-v1.js');
const index=require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');
async function main(){
 const bus={};
 for(const id of ['generator1','generator2','main1','main2','transfer1','transfer2',
  'dc1','dc2','battery','hotBattery','switchedHotBattery','groundService','acStandby','dcStandby'])
  bus[id]=true;
 const electrical={schema:'B737_ELECTRICAL_V7_RESULT',bus,revision:'TEST'};
 const baseline=Object.fromEntries(Object.keys(Core.defineBuses(electrical)).map(key=>[key,true]));
 const project=delta=>Core.project({index,electrical,
  labBusPower:{...baseline,...delta},includeAllConfigurations:true});
 const hub=Hub.createHub();
 let snapshot=project({});hub.publish(snapshot);
 const legacy=new Set();
 const bridge={
  subscribeDevice:(name,fn)=>hub.subscribeDevice(name,fn),
  subscribe(fn){legacy.add(fn);fn(snapshot);return ()=>legacy.delete(fn);},
  getBus:(name,voltage)=>hub.getBus(name+'@'+voltage)
 };
 const calls=[];
 const callbacks=Object.fromEntries(Object.keys(Registry.OWNER_GROUPS)
  .map(group=>[group,()=>calls.push(group)]));
 const registry=Registry.createRegistry(bridge,callbacks);
 await Promise.resolve();await Promise.resolve();
 assert.equal(registry.getStats().registered,322);
 assert.equal(registry.getStats().cached,322);
 assert.equal(registry.ready,true);
 assert.equal(registry.getState('Alpha Vane AoA - left').capabilities.VANE_HEATER,true);
 const start=registry.getStats().ownerActions;
 assert.ok(start<=6,'initial state grouped, not 322 individual owner actions');
 calls.length=0;
 snapshot=project({'transfer1@115VAC':false});hub.publish(snapshot);
 await Promise.resolve();await Promise.resolve();
 assert.equal(calls.filter(x=>x==='ISN').length,1);
 assert.equal(calls.includes('ANTIICE'),false,'ISN owner also projects AoA lamps');
 assert.equal(registry.getState('Fuel Boost Pump - Main Tank 1 Aft').state,'OFF');
 assert.equal(registry.getState('Alpha Vane AoA - left').capabilities.VANE_HEATER,false);
 const count=calls.length;
 hub.publish(project({'transfer1@115VAC':false}));
 await Promise.resolve();assert.equal(calls.length,count,'repeated injection must not notify owners');
 snapshot=project({});hub.publish(snapshot);await Promise.resolve();await Promise.resolve();
 assert.equal(registry.getState('Fuel Boost Pump - Main Tank 1 Aft').state,'NORMAL');
 assert.equal(registry.getState('Alpha Vane AoA - left').capabilities.VANE_HEATER,true);
 registry.destroy();
 assert.equal(hub.getStats().activeSubscriptions,0);
 assert.equal(registry.getStats().cached,0);
 assert.equal(legacy.size,0);
 console.log('PASS ATA24 subscribers: 322 registered, grouped owners, bus loss/restore, no duplicates, no leaks');
}
main().catch(error=>{console.error(error);process.exitCode=1;});