'use strict';
// A cross-tab instructor failure modifies only electrical availability in the
// live Unified source read-model. It must never turn an engine OFF, move source
// selectors, or create a second electrical owner.
const assert=require('node:assert/strict');
const Electrical=require('../engine/systems/electrical-v7.js');
const Injection=require('../engine/systems/unified-bus-failure-injection-v1.js');
const Core=require('../engine/systems/classic-bus-consumer-engine-v1.js');
const Pack=require('../engine/integration/isn-electrical-pack-v1.js');
const Loads=require('../engine/systems/electrical-loads-v8.js');
const TrainerCore=require('../engine/trainer/core.js');
const WarningEngine=require('../audio/warning-engine.js').WarningEngine;
const Indications=require('../engine/instruments/engine-indication-backend-v1.js');
const EngineDB=require('../engine/instruments/engine-indication-technical-db-v1.json');
const index=require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');

assert.equal(Injection.BUS_KEYS.length,24);
assert.equal(new Set(Injection.BUS_KEYS).size,24);
assert.throws(()=>Injection.payload(['engine-suddenly-stopped']),/Invalid bus/);
assert.throws(()=>Injection.payload(['main1@115VAC','main1@115VAC']),/Invalid bus/);
const before=Electrical.initialState({coldDark:false});
const frozen=JSON.stringify(before);
const base=Electrical.evaluate(before);
const one=Injection.payload(['main1@115VAC'],123);
assert.equal(one.active,true);
assert.equal(Injection.overlay(base,one).bus.main1,false);
assert.equal(Injection.overlay(base,one).bus.transfer1,true,
 'An isolated main bus cut cannot shut an unrelated transfer bus');
assert.equal(Injection.overlay(base,one).source[1],base.source[1],
 'Electrical generator/source selector is immutable');
assert.equal(Injection.overlay(base,Injection.payload([])),base,
 'Clearing the injection restores the native electrical result by identity');
assert.equal(JSON.stringify(before),frozen);
assert.equal(Injection.normalize({...one,offBusKeys:['UNKNOWN']}),null);

const storage=new Map(),listeners={},events=[];
const win={
 B737ElectricalV7:Electrical,
 localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
 document:{readyState:'loading',addEventListener(){},getElementById(){return null;},querySelector(){return null;}},
 CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail;}},
 addEventListener:(event,fn)=>{(listeners[event]??=[]).push(fn);},
 dispatchEvent:event=>{events.push(event.type);(listeners[event.type]||[]).forEach(fn=>fn(event));}
};
const active=Injection.install(win);
assert.ok(active);
assert.equal(active.get().active,false);
assert.equal(win.B737ElectricalV7.evaluate(before).bus.main1,true);
function receive(record){
 const string=JSON.stringify(record);
 storage.set(Injection.KEY,string);
 for(const fn of listeners.storage||[])fn({key:Injection.KEY,newValue:string});
}
receive(Injection.payload(['main1@115VAC','electronic1@115VAC','transfer1@28VAC'],1001));
assert.deepEqual(active.get().offBusKeys,
 ['main1@115VAC','electronic1@115VAC','transfer1@28VAC']);
const live=win.B737ElectricalV7.evaluate(before);
assert.equal(live.bus.main1,false);
assert.equal(live.bus.generator1,true);
assert.equal(live.bus.transfer1,true);
assert.ok(live.busClassOutages.includes('transfer1@28VAC'));
assert.equal(Core.defineBuses(live)['electronic1@115VAC'].powered,false);
assert.equal(Core.defineBuses(live)['transfer1@28VAC'].powered,false);
assert.equal(Core.defineBuses(live)['transfer1@115VAC'].powered,true);
assert.equal(Core.lookupPump('fuel.main1FwdPump',live).powered,false);
assert.equal(Core.lookupPump('fuel.main1AftPump',live).powered,true);
assert.ok(events.includes('b737:bus-failure-injection-changed'));
assert.equal(JSON.stringify(before),frozen);

function observed(){
 const u={n1:'%',n2:'%',egt:'°C',fuelFlow:'kg/h',oilPressure:'psi',
  oilTemperature:'°C',oilQuantity:'%FULL',vibration:'units'};
 return Object.fromEntries([1,2].map(n=>['engine'+n,
  Object.fromEntries(Object.entries(u).map(([p,unit])=>[p,
   {valid:true,value:75,unit,origin:'BUS_INJECT_REGRESSION'}]))]));
}
const indications=Indications.calculate(EngineDB,{
 mode:'CONVENTIONAL',electrical:live,observed:observed()});
assert.equal(indications.engines.engine1.indications.oilPressure.status,'POWER_LOSS',
 'An isolated 28VAC converter cut disables oil indication, not the 115VAC transfer bus');
assert.equal(indications.engines.engine1.indications.n1.status,'VALID');
assert.equal(indications.engines.engine1.indications.n2.status,'VALID');

const old=globalThis.B737ClassicBusConsumersV1;
globalThis.B737ClassicBusConsumersV1=Core;
try{
 const pack=new Pack.Session({Electrical:win.B737ElectricalV7,Loads,TrainerCore,WarningEngine});
 for(const id of Object.keys(Core.MRG_PUMP_FEEDS))
  pack.send({type:'PUMP_SWITCH',id,value:true});
 for(const n of [1,2])pack.send({type:'ELECTRICAL',action:{type:'CONTROL',key:'engine'+n+'Running',value:true}});
 pack.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',side:1,source:'GEN1'}});
 pack.send({type:'ELECTRICAL',action:{type:'SELECT_SOURCE',side:2,source:'GEN2'}});
 const power=pack.compute(null);
 assert.equal(power.pumps['fuel.main1FwdPump'].operating,false);
 assert.equal(power.pumps['fuel.main1AftPump'].operating,true);
 assert.equal(pack.electricalState.config.engine1Running,true);
 receive(Injection.payload([],1002));
 const restored=pack.compute(null);
 assert.equal(restored.pumps['fuel.main1FwdPump'].operating,true);
 assert.equal(restored.pumps['fuel.main1AftPump'].operating,true);
 assert.equal(pack.electricalState.config.engine1Running,true,
  'Clearing the bus overlay never stopped the running engine');
}finally{
 if(old===undefined)delete globalThis.B737ClassicBusConsumersV1;
 else globalThis.B737ClassicBusConsumersV1=old;
}
assert.equal(win.B737ElectricalV7.evaluate(before).bus.main1,true);
assert.equal(active.get().active,false);
assert.equal(Injection.normalize({schema:Injection.SCHEMA,active:false,
 offBusKeys:['main1@115VAC'],issuedAt:42}),null);
assert.equal(index.rows.length,340);
console.log('PASS: cross-tab storage Inject/Clear, 24 class validator, 8 live pumps, exact 28VAC engine indicator, source selectors/engine RUNNING unchanged');
