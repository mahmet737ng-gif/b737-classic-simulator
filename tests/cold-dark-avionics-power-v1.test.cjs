'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const Electrical=require('../engine/systems/electrical-v7.js');
const FMC=require('../engine/ch11/fmc-systems-network-v1.js');

test('hot battery bus stays live with BAT OFF, but cannot power the CDU',()=>{
 const s=Electrical.initialState({coldDark:true});
 const p=Electrical.evaluate(s);
 assert.equal(p.bus.hotBattery,true,'Unswitched hot battery may be alive');
 assert.equal(p.bus.battery,false,'Main battery relay is open');
 assert.equal(p.bus.transfer1,false);
 assert.equal(p.bus.transfer2,false);
 assert.equal(FMC.globalPower(p),'ABSENT','No switched aircraft bus may illuminate a CDU');
});
test('attached but unselected GPU and ground service cannot energize CDU',()=>{
 let s=Electrical.initialState({coldDark:true});
 s=Electrical.apply(s,{type:'CONTROL',key:'groundPowerAttached',value:true});
 s=Electrical.apply(s,{type:'CONTROL',key:'groundServiceSelected',value:true});
 const p=Electrical.evaluate(s);
 assert.equal(p.bus.groundService,true);
 assert.equal(p.bus.transfer1,false);
 assert.equal(FMC.globalPower(p),'ABSENT');
});
test('ground power truly selected on aircraft buses restores unknown feed, not fake proof of CDU supply',()=>{
 let s=Electrical.initialState({coldDark:true});
 s=Electrical.apply(s,{type:'CONTROL',key:'batterySwitch',value:true});
 s=Electrical.apply(s,{type:'CONTROL',key:'groundPowerAttached',value:true});
 s=Electrical.apply(s,{type:'SELECT_SOURCE',side:1,source:'EXT'});
 const p=Electrical.evaluate(s);
 assert.equal(p.bus.transfer1,true);
 assert.equal(p.bus.transfer2,true);
 assert.equal(FMC.globalPower(p),'UNKNOWN','Upstream bus power does not prove a particular CDU CB feed');
});
test('unknown or partial electrical evidence stays unknown',()=>{
 assert.equal(FMC.globalPower(null),'UNKNOWN');
 assert.equal(FMC.globalPower({bus:{hotBattery:true}}),'UNKNOWN');
});
