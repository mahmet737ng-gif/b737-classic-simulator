const test=require('node:test'), assert=require('node:assert/strict');
const inv=require('./gauge-inventory-v1.json');
const calibrations=require('./gauge-survey-stage2-3.json');
const policy=require('./cold-dark-indicator-policy-v1.json');
const engine=require('./cold-dark-indicator-v1.js');

test('Every one of the 53 inventory faces plus installed oxygen gauge has a separately documented cold-dark policy',()=>{
 const ids=inv.faceGroups.flatMap(x=>x.ids);
 assert.equal(ids.length,53);
 const covered=Object.keys(policy.entries);
 assert.deepEqual(covered.slice().sort(),[...ids,'oh.crew_oxygen.pressure'].sort());
 assert.equal(covered.length,54);
 assert.equal(Object.keys(engine.snapshot()).length,54);
 assert.equal(Object.keys(engine.snapshot()).filter(id=>id==='oh.crew_oxygen.pressure').length,1);
 for(const id of ids)assert.equal(calibrations.faces.find(x=>x.id===id)?.stage4.realReadingsEnabled,false);
});
test('Difference pressure zero does not mean cabin altitude zero at a high-altitude airfield',()=>{
 const r=engine.resolve('oh.cabin.diff_pressure_altitude',{fieldElevationFt:4050,cabinEqualized:true});
 assert.equal(r.needles.press.value,0);
 assert.equal(r.needles.cabAlt.value,4050);
 assert.equal(r.needles.cabAlt.unit,'ft');
 const noField=engine.resolve('oh.cabin.diff_pressure_altitude');
 assert.equal(noField.needles.press.value,0);
 assert.equal(noField.needles.cabAlt.value,null);
});
test('ASI on the ground physically zero but photographed dial is pegged near 60kt (no fabricated noon zero)',()=>{
 for(const id of ['capt.airspeed','fo.airspeed']){
  const r=engine.resolve(id);
  assert.equal(r.physicalValue,0);
  assert.equal(r.currentVisualMinKt,60);
  assert.equal(r.actualZeroMarkVerified,false);
  assert.equal(r.status,'low_stop_if_offscale');
 }
});
test('Engines off: N1 N2 fuel flow vibration go to zero; EGT oil temp retain thermal readings',()=>{
 const state=engine.snapshot();
 for(const id of ['eng.n1.1','eng.n1.2','eng.n2.1','eng.n2.2',
  'eng.fuel_flow.1','eng.fuel_flow.2','eng.oil_pressure.1','eng.oil_pressure.2',
  'eng.vibration.1','eng.vibration.2'])assert.equal(state[id].value,0,id);
 for(const id of ['eng.egt.1','eng.egt.2','eng.oil_temperature.1','eng.oil_temperature.2',
 'oh.fuel.temperature','oh.cabin.temperature'])assert.equal(state[id].value,null,id);
});
test('AC/DC with buses off is not a fabricated calibrated zero angle',()=>{
 const x=engine.snapshot();
 for(const id of ['oh.elec.dc_amps','oh.elec.cps','oh.elec.dc_volts','oh.elec.ac_volts',
 'oh.ac_amps.1','oh.ac_amps.2','oh.ac_amps.apu']){
  assert.equal(x[id].status,'unpowered_mechanical_rest_unverified');
  assert.equal(x[id].value,null);
  assert.equal(x[id].calibrationApproved,false);
 }
});
test('Fuel mass, oxygen bottle PSI and hydraulic accumulator survive electrical shutdown',()=>{
 const x=engine.snapshot({fuelQuantities:{center:540,1:3200,2:2750},
  oxygenPressurePsi:1280,hydBrakePressurePsi:1700});
 assert.equal(x['eng.fuel_qty.center'].value,540);
 assert.equal(x['eng.fuel_qty.1'].value,3200);
 assert.equal(x['eng.fuel_qty.2'].value,2750);
 assert.equal(x['oh.crew_oxygen.pressure'].value,1280);
 assert.equal(x['fo.hyd_brake_pressure'].value,1700);
 assert.equal(engine.resolve('oh.crew_oxygen.pressure').value,null);
});
test('Flaps and trims retain actual position; zero only when surface really at zero',()=>{
 const x=engine.snapshot({flapPosition:15,stabilizerTrim:4.5,rudderTrim:-2});
 assert.equal(x['fo.flap_position'].value,15);
 assert.equal(x['ped.stab_trim.left'].value,4.5);
 assert.equal(x['ped.stab_trim.right'].value,4.5);
 assert.equal(x['ped.rudder_trim'].value,-2);
 assert.equal(engine.resolve('fo.flap_position').value,null);
});
test('CSD RISE can be 0, IN is actual inlet temperature, not zero',()=>{
 const r=engine.resolve('oh.drive_oil.1',{selectorDriveOilMode:'rise',csdTemperatureEqualized:true});
 assert.equal(r.value,0);
 const t=engine.resolve('oh.drive_oil.2',{selectorDriveOilMode:'inlet',csdInletC:76});
 assert.equal(t.value,76);
 const unknown=engine.resolve('oh.drive_oil.1');
 assert.equal(unknown.status,'selector_unknown');
});
test('Cabin VSI stops at 0, duct PSI only zero after line fully depressurized',()=>{
 assert.equal(engine.resolve('oh.cabin.rate').value,0);
 assert.equal(engine.resolve('oh.duct.pressure_lr').value,null);
 assert.equal(engine.resolve('oh.duct.pressure_lr',{airAndDuctPressureDissipated:true}).value,0);
 assert.equal(engine.resolve('fo.outer_vertical_speed').value,0);
});
test('Actual airport QNH/field elevation drives mechanical altimeters, not assumed zero',()=>{
 assert.equal(engine.resolve('capt.altimeter').value,null);
 const c={fieldElevationFt:3900,baroSettingMatchesQnh:true};
 assert.equal(engine.resolve('capt.altimeter',c).value,3900);
 assert.equal(engine.resolve('fo.outer_altimeter',c).value,3900);
});
test('Cold dark does not force time, RMI heading or anomalous gauge identities to zero',()=>{
 for(const id of ['capt.clock','fo.outer_clock','capt.rmi','fo.rmi',
   'eng.left_upper_20_20','fo.left_linear','capt.alt_ias_combined']){
  const x=engine.resolve(id);assert.equal(x.value,null);
 }
 assert.throws(()=>engine.resolve('unknown.future'),/Unknown cold-dark/);
});
