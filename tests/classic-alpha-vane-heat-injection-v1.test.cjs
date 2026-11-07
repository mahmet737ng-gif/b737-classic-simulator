'use strict';
// Lufthansa ATA30-31 and MRG IV.6: only one physical left AoA vane,
// with the heater on XFR 1 and a second indexed Main 1 supply.
// Physical A/B toggle always remains movable; current-sensing lamp
// depends on 28V DC independently from 115V AC heater power.
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const Alpha=require('../engine/systems/classic-alpha-vane-heat-v1.js');
const Electrical=require('../engine/systems/electrical-v7.js');
const Injection=require('../engine/systems/unified-bus-failure-injection-v1.js');
const Consumer=require('../engine/systems/classic-bus-consumer-engine-v1.js');
const Lab=require('../engine/systems/classic-bus-consumer-test-lab-v1.js');
const index=require('../engine/systems/mrg-classic-340-consumer-bus-index-v1.json');
const repo=path.resolve(__dirname,'..');
const cockpit=fs.readFileSync(path.join(repo,'panel-mosaic-lab/cockpit/index.html'),'utf8');
const runtime=fs.readFileSync(path.join(repo,'panel-mosaic-lab/cockpit/isn-cockpit.js'),'utf8');
const projection=fs.readFileSync(path.join(repo,'panel-mosaic-lab/cockpit/overhead-bridge.js'),'utf8');
const physical=fs.readFileSync(path.join(repo,'panel-mosaic-lab/interactive-overhead/lights-model.js'),'utf8');
const get=(bus,switches={['pitot-a']:'ON',['pitot-b']:'ON'},cbAvailable=null)=>
 Alpha.evaluate({buses:bus,switches,cbAvailable});
const supply={transfer1:true,transfer2:true,main1:true,main2:true,dc1:true,dc2:true};
let x=get(supply);
assert.equal(x.schema,'B737_CLASSIC_ALPHA_VANE_HEAT_ATA30_V1');
assert.deepEqual(x.lamps,{'probe-l-alpha':false,'probe-r-alpha':false});
assert.equal(x.channels.L.heaterPower,true);
assert.equal(x.channels.R.heaterPower,true);
assert.equal(x.channels.L.heaterBus,'transfer1');
assert.equal(x.channels.R.heaterBus,'transfer2');
assert.equal(x.channels.L.sensorReferenceBus,'main1');
assert.equal(x.channels.R.sensorReferenceBus,'main2');
const main1Off=get({...supply,main1:false});
assert.equal(main1Off.channels.L.sensorReferenceBusPowered,false);
assert.equal(main1Off.channels.L.heaterPower,true,
 'Main1 MRG AoA reference cannot be confused with Transfer1 actual heater');
assert.equal(main1Off.lamps['probe-l-alpha'],false);
x=get({...supply,transfer1:false});
assert.equal(x.channels.L.heaterPower,false);
assert.equal(x.lamps['probe-l-alpha'],true,
 'Loss of AC heating with working DC lamp lights amber despite PITOT A ON');
assert.equal(x.channels.R.heaterPower,true);
assert.equal(x.lamps['probe-r-alpha'],false);
assert.equal(x.channels.L.switchMechanicalOperable,true);
assert.equal(x.channels.L.requested,true,'Switch retains its physical detent after bus loss');
x=get({...supply,transfer2:false});
assert.equal(x.channels.R.heaterPower,false);
assert.equal(x.lamps['probe-r-alpha'],true);
assert.equal(x.lamps['probe-l-alpha'],false);
x=get(supply,{'pitot-a':'OFF','pitot-b':'ON'});
assert.equal(x.channels.L.heaterPower,false);
assert.equal(x.lamps['probe-l-alpha'],true,
 'OFF switch leaves lamp on when 28V indication remains available');
x=get({...supply,transfer1:false,dc1:false});
assert.equal(x.channels.L.heaterPower,false);
assert.equal(x.lamps['probe-l-alpha'],false,
 'Dark DC indicator must not falsely illuminate even when heater lost');
x=get({...supply,dc1:false});
assert.equal(x.channels.L.heaterPower,true,
 'Loss of DC indication must not artificially remove independent AC heat');
assert.equal(x.lamps['probe-l-alpha'],false);
x=get(supply,{'pitot-a':'ON','pitot-b':'ON'},id=>id!=='probe.alphaL');
assert.equal(x.channels.L.heaterCbClosed,false);
assert.equal(x.channels.L.heaterPower,false);
assert.equal(x.lamps['probe-l-alpha'],true);
assert.equal(x.channels.R.heaterPower,true);

// Live injected bus failure enters via the same Electrical V7 projection as
// other cockpit consumers, not a local fake probe state.
const normal=Electrical.evaluate(Electrical.initialState({coldDark:false}));
const one=Injection.overlay(normal,Injection.payload(['transfer1@115VAC']));
const post=get({...supply,...one.bus});
assert.equal(post.channels.L.heaterPower,false);
assert.equal(post.lamps['probe-l-alpha'],true);
assert.equal(post.channels.R.heaterPower,true);

// All four MRG AoA rows remain visible with circuit qualification.
const lab=Lab.makeSession({Core:Consumer,Electrical,index});
const four=index.rows.filter(r=>/^Alpha Vane AoA - (left|right)$/i.test(r.item));
assert.equal(four.length,4);
for(const row of four){
 const display=lab.snapshot().consumers[row.id].displayName;
 assert.ok(display.includes(row.feedBus==='transfer1'||row.feedBus==='transfer2'?
  'VANE HEATER':'ADDITIONAL AOA FEED'),row.id+' clarified circuit');
}
assert.match(cockpit,/classic-alpha-vane-heat-v1\.js\?v=ATA30-ALPHA-HEAT-0001/);
assert.ok(cockpit.indexOf('classic-alpha-vane-heat-v1.js')<cockpit.indexOf('isn-cockpit.js'));
assert.match(runtime,/B737ClassicAlphaVaneHeatV1/);
assert.match(runtime,/Object\.assign\(lamps,alphaResult\.lamps\)/);
assert.match(runtime,/physicalSwitches=f\.contentWindow\.B737OverheadToggles/);
assert.match(runtime,/b737:bus-failure-injection-changed/);
assert.match(projection,/if\(d\.action==='isn-projection'/);
assert.match(physical,/case 'probe':active=!isOn\(id\)/,
 'Legacy lamp did not use electrical bus and must be overridden from shared V7');
console.log('PASS ATA30: independent AoA heater Transfer1/2, DC lamp 1/2, MRG Main1/2 distinction, switch mechanical, real injection and live overhead projection');
