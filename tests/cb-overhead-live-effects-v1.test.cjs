'use strict';
// CB pull/push must modify the existing live overhead indications, not only CB artwork.
// No aircraft-specific WDM feed is implied by these catalogue-derived trainer gates.
const {test,afterEach}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const Kernel=require('../engine/cb/cb-kernel');
const Gates=require('../engine/cb/unified-circuit-gates-v1');
const LightModel=require('../panel-mosaic-lab/interactive-overhead/lights-model');
const Electrical=require('../engine/systems/electrical-v7');
const Pneumatics=require('../engine/systems/pneumatics-v6');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('cb-panel-lab/catalog.js','utf8'),context);
const catalog=context.window.CB_CATALOG;
const light=(id,rule,control)=>({id,rule,controls:[control],states:['OFF','ON']});
const registry={lights:[
 light('fuel-1-fwd-low','fuel-pressure','fuel-1-fwd'),
 light('fuel-2-fwd-low','fuel-pressure','fuel-2-fwd'),
 light('fuel-center-l-low','fuel-pressure','fuel-center-l'),
 light('hyd-a-low','hyd-pressure','hyd-elec-2'),
 light('hyd-b-low','hyd-pressure','hyd-elec-1'),
 light('flight-pressure-a','flight-pressure','flight-control-a'),
 light('stby-rud-on','standby-rudder','flight-control-a'),
 light('stby-pressure','standby-pressure','flight-control-a')
]};
function setup(){
 const gates=Gates.create(catalog,Kernel);
 global.B737UnifiedCB=gates;
 const overhead=LightModel.controller(registry,Electrical,()=>{},Pneumatics);
 const toggles={
  'battery-master':'ON','fuel-1-fwd':'ON','fuel-2-fwd':'ON',
  'fuel-center-l':'ON','hyd-elec-2':'ON','hyd-elec-1':'ON',
  'hyd-eng-1':'ON','hyd-eng-2':'ON','flight-control-a':'on'
 };
 const sync=(now=0)=>overhead.ingest(toggles,{guards:{},rotaries:{}},now);
 sync(0);overhead.setAircraftElectricalPower(true,0);overhead.evaluate(1800);
 const on=id=>overhead.snapshot().lights[id];
 const pull=id=>{assert.equal(gates.network.action(id,'PULL').ok,true,id);overhead.evaluate(2000);};
 const push=id=>{assert.equal(gates.network.action(id,'PUSH').ok,true,id);overhead.evaluate(2000);};
 return {gates,overhead,toggles,sync,on,pull,push};
}
afterEach(()=>{delete global.B737UnifiedCB;});
test('Six individual fuel pump CBs affect their own live pressure indication, not the other side',()=>{
 const s=setup();
 assert.equal(s.on('fuel-1-fwd-low'),false);assert.equal(s.on('fuel-2-fwd-low'),false);
 s.pull('P6-3|ALL|B7');
 assert.equal(s.on('fuel-1-fwd-low'),true);assert.equal(s.on('fuel-2-fwd-low'),false);
 assert.equal(s.toggles['fuel-1-fwd'],'ON','switch is not moved by a CB pull');
 s.push('P6-3|ALL|B7');assert.equal(s.on('fuel-1-fwd-low'),false);
 s.pull('P6-3|ALL|E5');
 assert.equal(s.on('fuel-center-l-low'),true);
 assert.equal(s.on('fuel-2-fwd-low'),false);
});
test('Hydraulic electric pump A/B circuits are isolated and engine-driven pressure is independent',()=>{
 const s=setup();
 s.pull('P6-12|ALL|C2');
 assert.equal(s.on('hyd-a-low'),true);assert.equal(s.on('hyd-b-low'),false);
 assert.equal(s.on('flight-pressure-a'),false,'engine-driven system A still has pressure');
 s.overhead.update({engine1Running:false},2600);
 assert.equal(s.on('flight-pressure-a'),true,'loss of both A sources means low flight pressure');
 s.push('P6-12|ALL|C2');
 assert.equal(s.on('hyd-a-low'),false);assert.equal(s.on('flight-pressure-a'),false);
});
test('STBY RUD control CB stops its indication; standby NORMAL/ALTN supply breakers are redundant',()=>{
 const s=setup();s.toggles['flight-control-a']='STBY RUD';s.sync(3500);
 assert.equal(s.on('stby-rud-on'),true);
 s.pull('P6-11|ALL|A8');
 assert.equal(s.on('stby-rud-on'),true,'ALTN source remains');
 s.pull('P6-12|ALL|A8');
 assert.equal(s.on('stby-rud-on'),false);
 assert.equal(s.on('stby-pressure'),true);
 s.push('P6-12|ALL|A8');
 assert.equal(s.on('stby-rud-on'),true);assert.equal(s.on('stby-pressure'),false);
 s.pull('P6-2|ALL|A11');
 assert.equal(s.on('stby-rud-on'),false);assert.equal(s.on('stby-pressure'),true);
 s.push('P6-2|ALL|A11');
 assert.equal(s.on('stby-rud-on'),true);
});
test('A tripped CB cannot be pushed until the fault is cleared',()=>{
 const s=setup();const id='P6-3|ALL|B7';
 assert.equal(s.gates.network.action(id,'INJECT_TRIP','Short circuit').ok,true);
 s.overhead.evaluate(2500);assert.equal(s.on('fuel-1-fwd-low'),true);
 assert.equal(s.gates.network.action(id,'PUSH').ok,false);
 assert.equal(s.gates.network.action(id,'CLEAR_FAULT').ok,true);
 s.push(id);assert.equal(s.on('fuel-1-fwd-low'),false);
});
