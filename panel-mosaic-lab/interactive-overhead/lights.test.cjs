'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const m=require('./lights-model'),tm=require('./model'),gm=require('./rotary-guards-model'),electrical=require('../../engine/systems/electrical-v7'),mechanics=require('../../flight-controls-panel/fcom-control-mechanics'),pneumatics=require('../../engine/systems/pneumatics-v6');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,p),'utf8')),reg=read('lights.json'),treg=read('registry.json'),rg=read('rotary-guards.json'),extra=read('lights-controls.json');rg.rotaries.push(...extra.rotaries);rg.guards.push(...extra.guards);
const t=tm.controller(treg),g=gm.controller(rg,{},()=>{},mechanics),e=m.controller(reg,electrical,()=>{},pneumatics);let time=0;const sync=()=>e.ingest(t.snapshot(),g.snapshot(),time+=1000),on=id=>e.snapshot().lights[id];
assert.equal(m.validate(reg,read('../all-overhead/atlas-layout.json'),tm.mapPoint,new Set([...treg.controls,...rg.rotaries,...rg.guards].map(c=>c.id))),true);assert.equal(reg.lights.length,112);assert.equal(Object.keys(reg.assets).length,68);
assert.deepEqual(reg.lights.find(c=>c.id==='irs-l-align').sourceRect,[428,535,64,32]);assert.deepEqual(reg.lights.find(c=>c.id==='irs-r-align').sourceRect,[604,535,64,32]);assert.equal(reg.lights.filter(c=>c.asset==='ALIGN_WHITE').length,2,'one reusable ALIGN pair for both IRS sides');
for(const c of reg.lights)for(const a of Object.values(reg.assets[c.asset]))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,a.url))).digest('hex'),a.sha256);
// OH14 owns ONE physical switch in the regular registry; the NOT ARMED
// annunciator follows that exact switch, never a second floating selector.
const oh14=treg.controls.filter(c=>c.id==='emergency-exit-lights');
assert.equal(oh14.length,1);
assert.equal(oh14[0].visualFamily,'Small Silver');
assert.deepEqual(oh14[0].states,['OFF','ARMED','ON']);
assert.deepEqual(reg.lights.find(c=>c.id==='emergency-not-armed').controls,['emergency-exit-lights']);
e.setAircraftElectricalPower(true);
sync();assert.equal(on('emergency-not-armed'),false,'ARMED default keeps NOT ARMED dark');
t.set('emergency-exit-lights','OFF');sync();assert.equal(on('emergency-not-armed'),true,'OFF illuminates NOT ARMED');
t.set('emergency-exit-lights','ARMED');sync();assert.equal(on('emergency-not-armed'),false,'ARMED extinguishes NOT ARMED');
t.set('emergency-exit-lights','ON');sync();assert.equal(on('emergency-not-armed'),false,'ON extinguishes NOT ARMED');
t.set('emergency-exit-lights','OFF');sync();e.setAircraftElectricalPower(false,time);
assert.equal(on('emergency-not-armed'),true,'The OH14 DC indication cannot depend on AC availability');
e.update({panelPower:false},time);assert.equal(on('emergency-not-armed'),false,'Panel power OFF extinguishes the lamp');
e.update({panelPower:true},time);assert.equal(on('emergency-not-armed'),true,'Restore panel supply lights NOT ARMED');
t.set('emergency-exit-lights','ARMED');sync();e.setAircraftElectricalPower(true,time);
assert.equal(on('emergency-not-armed'),false);

// Owner18 FLT CONTROL A/B detents must drive the one real STBY RUD ON lamp.
const ownerFlight=(a,b)=>{
 const snapshot=g.snapshot();
 snapshot.guards={...snapshot.guards,'flight-control-a':{value:a},'flight-control-b':{value:b}};
 return e.ingest(t.snapshot(),snapshot,time+=1000);
};
ownerFlight('ON','ON');assert.equal(on('stby-rudder'),false,'normal FLT CONTROL keeps STBY RUD OFF');
ownerFlight('STBY RUD','ON');assert.equal(on('stby-rudder'),true,'A STBY RUD illuminates');
ownerFlight('ON','STBY RUD');assert.equal(on('stby-rudder'),true,'B STBY RUD illuminates');
ownerFlight('STBY RUD','STBY RUD');assert.equal(on('stby-rudder'),true,'both STBY RUD illuminate');
e.update({standbyPumpFailed:true},time);assert.equal(on('stby-rudder'),false,'failed standby pump inhibits indication');
e.update({standbyPumpFailed:false},time);assert.equal(on('stby-rudder'),true,'restored pump relights indication');
ownerFlight('OFF','ON');assert.equal(on('stby-rudder'),false,'leaving STBY RUD extinguishes');
sync();e.evaluate(time+800);assert.equal(on('fuel-center-l'),false);assert.equal(on('hyd-eng-1'),false);assert.equal(on('yaw-damper'),false);
t.set('fuel-center-l','OFF');sync();assert.equal(on('fuel-center-l'),false,'center pump OFF inhibits low-pressure indication');t.set('fuel-center-l','ON');sync();assert.equal(on('fuel-center-l'),true,'pressure builds');e.evaluate(time+800);assert.equal(on('fuel-center-l'),false);e.update({fuelAvailable:false},time+800);assert.equal(on('fuel-center-l'),true);e.update({fuelAvailable:true,faults:{'fuel-center-l':true}},time+800);assert.equal(on('fuel-center-l'),true,'failed pump stays low with switch ON');e.update({faults:{'fuel-center-l':false}},time+800);assert.equal(on('fuel-center-l'),false);
t.set('fuel-1-aft','OFF');sync();assert.equal(on('fuel-1-aft'),true);t.set('fuel-1-aft','ON');sync();e.evaluate(time+800);assert.equal(on('fuel-1-aft'),false);
e.update({engine1Running:false},time);assert.equal(on('hyd-eng-1'),true);assert.equal(on('flight-pressure-a'),true,'both system A pumps unavailable');t.set('hyd-elec-2','ON');sync();assert.equal(on('flight-pressure-a'),false,'second pump restores system pressure');e.update({engine1Running:true},time);
t.set('window-power-test','OVHT');sync();assert.equal(on('window-l-side-overheat'),true);t.release('window-power-test');sync();assert.equal(on('window-l-side-overheat'),false);assert.equal(on('probe-capt-ps'),true);t.set('pitot-a','ON');sync();assert.equal(on('probe-capt-ps'),false);
g.setRotary('irs-mode-l','NAV');sync();e.update({irsBatterySupply:true,faults:{'irs-l-fault':true}},time);assert.equal(on('irs-l-on-dc'),true);assert.equal(on('irs-l-fault'),true);g.setRotary('irs-mode-l','OFF');sync();assert.equal(on('irs-l-on-dc'),false);assert.equal(on('irs-l-fault'),false);
g.setRotary('irs-mode-l','ALIGN');sync();assert.equal(on('irs-l-align'),true);assert.equal(on('irs-r-align'),false);e.update({faults:{'irs-l-align':true}},time);assert.equal(e.snapshot().frames['irs-l-align'],'FLASH');e.update({faults:{'irs-l-align':false}},time);g.setRotary('irs-mode-l','NAV');sync();e.update({irsLAlignmentInProgress:true},time);assert.equal(on('irs-l-align'),true);e.update({irsLAlignmentInProgress:false},time);assert.equal(on('irs-l-align'),false);g.setRotary('irs-mode-l','ATT');sync();assert.equal(on('irs-l-align'),true);e.update({irsLAttitudeAvailable:true},time);assert.equal(on('irs-l-align'),false);g.setRotary('irs-mode-l','OFF');sync();e.update({irsLShutdownInProgress:true},time);assert.equal(on('irs-l-align'),true);e.update({irsLShutdownInProgress:false,irsLAttitudeAvailable:false},time);assert.equal(on('irs-l-align'),false);
e.setLampTest(true,time);assert.equal(Object.values(e.snapshot().lights).filter(Boolean).length,112);e.setLampTest(false,time);assert.equal(on('filter-1'),false);e.update({panelPower:false},time);e.setLampTest(true,time);assert.equal(Object.values(e.snapshot().lights).filter(Boolean).length,0,'lamp test respects power');e.setLampTest(false,time);e.update({panelPower:true},time);
e.update({equipmentSupplyFailed:true},time);assert.equal(on('equip-supply-off'),true);t.set('equip-cooling-supply','ALTERNATE');sync();assert.equal(on('equip-supply-off'),false,'alternate fan clears normal-fan failure');
// With Classic ground AUTO, loss of normal AC does not automatically transfer
// standby buses to battery. The V7 source decision is known; a completely
// unpowered panel must not illuminate a physical STANDBY PWR OFF lamp.
// Preserve UNKNOWN only for genuinely unresolved electrical source paths.
// This scenario is explicitly UNPOWERED. Earlier test cases set external
// aircraft AC power to true; reset that test input before checking dark lamps.
e.setAircraftElectricalPower(false,time);
e.update({engine1Running:false,engine2Running:false},time);
const groundAuto=e.snapshot();
assert.equal(groundAuto.electrical.bus.acStandby,false,'Classic ground AUTO standby AC is unpowered');
assert.equal(groundAuto.electrical.bus.dcStandby,false,'Classic ground AUTO standby DC is unpowered');
assert.equal(groundAuto.electrical.lamps.standbyPowerOff,true,'Electrical logic requests standby OFF indication');
assert.equal(on('standby-power-off'),false,'Unpowered panel cannot light standby OFF');
assert.equal(groundAuto.unknown.includes('standby-power-off'),false,'Resolved Classic ground AUTO is no longer an UNKNOWN source');
assert.throws(()=>e.update({faults:{invalid:true}}));assert.throws(()=>e.update({engine1Running:'yes'}));
// Return the test fixture to its powered baseline for subsequent probe,
// engine anti-ice and lamp-test assertions. Production logic is unchanged.
e.setAircraftElectricalPower(true,time);
e.reset(time);sync();assert.equal(on('pass-oxygen'),false);assert.equal(e.snapshot().lampTest,false);

// New inputs stay independent of the previously accepted left probe group.
t.set('pitot-a','OFF');t.set('pitot-b','ON');sync();assert.equal(on('probe-capt-ps'),true);assert.equal(on('probe-fo-ps'),false);assert.equal(on('probe-temp'),true);t.set('pitot-b','OFF');sync();assert.equal(on('probe-r-alpha'),true);t.set('pitot-b','ON');sync();assert.equal(on('probe-r-alpha'),false);
for(const id of reg.lights.filter(c=>c.id.startsWith('door-')).map(c=>c.id)){e.update({faults:{[id]:true}},time);assert.equal(on(id),true);e.update({faults:{[id]:false}},time);assert.equal(on(id),false);}
t.set('engine-anti-ice-1','ON');sync();e.update({faults:{'cowl-anti-ice-1':true}},time);assert.equal(on('cowl-anti-ice-1'),true);assert.equal(on('cowl-anti-ice-2'),false);
// Reuse source-located V6 trip latches. Switch OFF and clearing the sensor do
// not reset a trip; RESET only works after the initiating condition clears.
for(const id of ['pack-trip-l','pack-trip-r','bleed-trip-l','bleed-trip-r','duct-overheat-l','duct-overheat-r']){
 e.update({faults:{[id]:true}},time);assert.equal(on(id),true);e.tripReset(time);assert.equal(on(id),true,'active overheat prevents reset');e.update({faults:{[id]:false}},time);assert.equal(on(id),true,'trip remains latched');e.tripReset(time);assert.equal(on(id),false);
}
e.update({faults:{'pack-trip-l':true}},time);t.set('pack-l','OFF');sync();assert.equal(on('pack-trip-l'),true);e.update({faults:{'pack-trip-l':false}},time);e.tripReset(time);assert.equal(on('pack-trip-l'),false);t.set('pack-l','AUTO');sync();
e.update({apuRunning:true},time);t.set('bleed-apu','ON');t.set('bleed-eng-1','ON');sync();assert.equal(on('dual-bleed'),true);t.set('bleed-apu','OFF');sync();assert.equal(on('dual-bleed'),false);
e.update({faults:{'wing-body-overheat-l':true}},time);assert.equal(on('wing-body-overheat-l'),true);assert.equal(on('wing-body-overheat-r'),false);e.update({faults:{'wing-body-overheat-l':false}},time);assert.equal(on('wing-body-overheat-l'),false);
g.setRotary('pressurization-mode','AUTO');sync();e.update({faults:{'press-auto-fail':true}},time);assert.equal(on('press-auto-fail'),true);g.setRotary('pressurization-mode','MANUAL');sync();assert.equal(on('press-auto-fail'),false);
e.update({faults:{'press-off-sched-descent':true}},time);assert.equal(on('press-off-sched-descent'),true);e.reset(time);sync();assert.equal(on('press-off-sched-descent'),false);assert.equal(on('pack-trip-l'),false);

// Multi-state blue indications preserve boolean light compatibility.
const frame=id=>e.snapshot().frames[id];
g.setRotary('crossfeed','CLOSED');sync();e.evaluate(time+900);assert.equal(frame('crossfeed-valve'),'OFF');g.setRotary('crossfeed','OPEN');sync();assert.equal(frame('crossfeed-valve'),'BRIGHT_BLUE');e.evaluate(time+900);assert.equal(frame('crossfeed-valve'),'DIM_BLUE');assert.equal(on('crossfeed-valve'),true);e.update({faults:{'crossfeed-valve':true}},time+900);assert.equal(frame('crossfeed-valve'),'BRIGHT_BLUE');e.update({faults:{'crossfeed-valve':false}},time+900);assert.equal(frame('crossfeed-valve'),'DIM_BLUE');g.setRotary('crossfeed','CLOSED');sync();e.evaluate(time+900);assert.equal(frame('crossfeed-valve'),'OFF');
e.update({engine1FuelValveClosed:true},time);assert.equal(frame('fuel-valve-closed-1'),'BRIGHT_BLUE');e.evaluate(time+900);assert.equal(frame('fuel-valve-closed-1'),'DIM_BLUE');assert.equal(frame('fuel-valve-closed-2'),'OFF');e.update({engine1FuelValveClosed:false},time+1000);e.evaluate(time+1900);assert.equal(frame('fuel-valve-closed-1'),'OFF');
t.set('window-l-side','ON');sync();assert.equal(frame('window-l-side-on'),'ON');e.update({faults:{'window-l-side-overheat':true}},time);assert.equal(frame('window-l-side-on'),'OFF');e.update({faults:{'window-l-side-overheat':false}},time);assert.equal(frame('window-l-side-on'),'ON');
e.update({groundPowerAttached:true},time);assert.equal(frame('ground-power-available'),'BRIGHT_BLUE');e.update({groundPowerAttached:false},time);assert.equal(frame('ground-power-available'),'OFF');
g.setRotary('pressurization-mode','STANDBY');sync();assert.equal(frame('press-standby'),'ON');assert.equal(frame('press-manual'),'OFF');g.setRotary('pressurization-mode','MANUAL');sync();assert.equal(frame('press-standby'),'OFF');assert.equal(frame('press-manual'),'ON');
e.setLampTest(true,time);assert.equal(frame('crossfeed-valve'),'BRIGHT_BLUE');assert.equal(Object.values(e.snapshot().lights).filter(Boolean).length,112);e.update({panelPower:false},time);assert.ok(Object.values(e.snapshot().frames).every(s=>s==='OFF'));e.reset(time);sync();assert.equal(e.snapshot().lampTest,false);
const assets=require('../lights-test/asset-model'),gallery=read('../lights-test/registry.json');assert.ok(gallery.lights.length>=83);assert.equal(new Set(gallery.lights.map(c=>c.id)).size,gallery.lights.length,'gallery IDs must be unique');assert.deepEqual(assets.parse('FUEL_VALVE_CLOSED_DIM_BLUE.svg').state,'DIM_BLUE');assert.equal(assets.parse('FUEL_VALVE_CLOSED_OFF.svg').id,'FUEL_VALVE_CLOSED');assert.equal(assets.parse('not-a-light.json'),null);
const sample=gallery.lights.find(c=>c.id==='VALVE_OPEN');assert.equal(assets.normalize(sample,true),'BRIGHT_BLUE');assert.equal(assets.normalize(sample,false),'OFF');assert.equal(assets.normalize(sample,'dim_blue'),'DIM_BLUE');assert.equal(assets.normalize(sample,'bogus'),null);assert.equal(assets.merge(gallery).length,gallery.lights.length);
for(const id of ['SPEED_BRAKE_ARMED_GREEN','SPEED_BRAKE_DO_NOT_ARMED_AMBER']){const light=gallery.lights.find(c=>c.id===id);assert.ok(light,id+' must be in gallery');assert.deepEqual(light.states,['OFF','ON']);}
const stab=gallery.lights.find(c=>c.id==='STAB_OUT_OF_TRIM');assert.deepEqual(stab.face,{width:300,height:300});assert.deepEqual(stab.lines,['STAB','OUT OF','TRIM']);
for(const c of gallery.lights)for(const state of c.states)assert.ok(fs.existsSync(path.resolve(__dirname,'../assets/locked/2026-10-23/LIGHTS',c.assets[state])),c.id+' '+state);
console.log('PASS: 112 mounted lamps / 68 overhead legend types / '+gallery.lights.length+' gallery types; paired IRS ALIGN, legacy scenarios; OFF, DIM BLUE, BRIGHT BLUE; valve transit and disagreement; independent fuel valves; window heat; source and mode indicators; power-aware lamp test; stable offline asset catalogue.');
