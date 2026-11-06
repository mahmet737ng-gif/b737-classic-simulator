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

test('optional or omitted diagnostic main/charger keys cannot light a proven unpowered CDU',()=>{
 const p=Electrical.evaluate(Electrical.initialState({coldDark:true}));
 const buses={...p.bus};
 delete buses.main1;delete buses.main2;delete buses.groundService;delete buses.hotBattery;
 assert.equal(FMC.globalPower({bus:buses}),'ABSENT',
  'A diagnostic with all 10 known switched feeds off is still a proven blackout');
 assert.equal(FMC.globalPower({bus:{...buses,hotBattery:true,groundService:true}}),'ABSENT');
});
test('unknown essential voltage or contradictory main bus never fabricates absence',()=>{
 const p=Electrical.evaluate(Electrical.initialState({coldDark:true}));
 assert.equal(FMC.globalPower({bus:{...p.bus,dc1:null}}),'UNKNOWN');
 assert.equal(FMC.globalPower({bus:{...p.bus,transfer1:undefined}}),'UNKNOWN');
 assert.equal(FMC.globalPower({bus:{...p.bus,main1:true}}),'UNKNOWN');
});
test('BAT switch and available alternate power re-evaluate real ECU feed',()=>{
 let s=Electrical.initialState({coldDark:true});
 assert.equal(FMC.globalPower(Electrical.evaluate(s)),'ABSENT');
 s=Electrical.apply(s,{type:'CONTROL',key:'batterySwitch',value:true});
 assert.equal(FMC.globalPower(Electrical.evaluate(s)),'UNKNOWN',
  'Battery bus can be energized; individual CDU CB mapping stays unverified');
 s=Electrical.apply(s,{type:'CONTROL',key:'batterySwitch',value:false});
 assert.equal(FMC.globalPower(Electrical.evaluate(s)),'ABSENT',
  'CDU must become dark again immediately after battery disconnect');
 s=Electrical.apply(s,{type:'CONTROL',key:'groundPowerAttached',value:true});
 s=Electrical.apply(s,{type:'CONTROL',key:'groundServiceSelected',value:true});
 assert.equal(FMC.globalPower(Electrical.evaluate(s)),'ABSENT',
  'Battery charger service power alone cannot illuminate CDU');
});
test('embedded CDU is fail-dark until live ECU power proof and does not paint an unpowered page',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const cockpit=path.join(__dirname,'../panel-mosaic-lab/cockpit');
 const child=fs.readFileSync(path.join(cockpit,'cdu-fmc-telemetry-v1.js'),'utf8');
 const stage=fs.readFileSync(path.join(cockpit,'cdu-stage.html'),'utf8');
 const bridge=fs.readFileSync(path.join(cockpit,'fmc-systems-bridge-v1.js'),'utf8');
 assert.ok(stage.includes('unified-cdu-power-fail-dark-css-v2'));
 assert.ok(stage.includes('dataset.cduAwaitingPower=\'true\''));
 assert.ok(child.includes("pendingPowerEvidence||feed==='ABSENT'"));
 assert.ok(child.includes('pendingPowerEvidence=false;paintFeed()'));
 assert.ok(bridge.includes('electrical.evaluate(source)'));
 assert.ok(bridge.includes('getElectricalState?.()'));
});
