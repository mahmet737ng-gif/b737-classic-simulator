const test=require('node:test');
const assert=require('node:assert/strict');
const contracts=require('./stage8-signal-contracts-v1.json');
const policy=require('./cold-dark-indicator-policy-v1.json');
const {create:makeBridge}=require('./stage8-ism-signal-bridge-v1.js');
const {create:makeCold}=require('./stage7-cold-dark-state-v1.js');
const bridge=makeBridge(contracts),cold=makeCold({contracts,policy});
const training={
 quality:'TRAINING_SIMULATION_ONLY',timeMs:34000,
 engines:{
  engine1:{n1Percent:0,n2Percent:0,egtC:57,fuelFlowKgHr:0,
    oil:{pressurePsi:0,temperatureC:45}},
  engine2:{n1Percent:70,n2Percent:75,egtC:620,fuelFlowKgHr:4100,
    oil:{pressurePsi:70,temperatureC:89}}},
 apu:{egtC:300},
 fuel:{tanksKg:{main1:2000,main2:1800,center:0}},
 hydraulics:{systemA:{pressurePsi:0},systemB:{pressurePsi:2900}},
 aircraft:{iasKt:0,pressureAltitudeFt:3963}
};
const physical={source:'PROVISIONAL_IDEAL_GAS_TRAINER',
 cabinAltitudeFt:3963,cabinRateFtMin:0,differentialPsid:0};
const offConditions={
 coldDarkConfirmed:true,fieldElevationFt:3963,cabinEqualized:true,
 cabinPressureStable:true,aircraftStationary:true,
 engineStopped:{engine1:true,engine2:false},
 oilPressureDissipated:{engine1:true,engine2:false},
 bleedSourcesOff:true,ductPressureDissipated:true,
 pressurizationArchitecture:'CPCS'
};
test('Stage 8 54 face coverage, provenance and no live display target',()=>{
 assert.equal(Object.keys(contracts.faces).length,54);
 assert.equal(contracts.verifiedPerInstrumentElectricalPowerFeeds,0);
 const s=bridge.read({ecu:training,cabinPlant:physical,timeMs:34000});
 assert.equal(s.stats.faces,54);
 assert.equal(s.stats.channels,62);
 assert.ok(s.stats.training>=20);
 assert.equal(s.stats.readyForLiveRendering,0);
 for(const [id,gauge] of Object.entries(s.signals)){
  assert.equal(gauge.liveNeedleAuthorized,false,id);
  for(const ch of Object.values(gauge.channels))assert.equal(ch.liveNeedleAuthorized,false,id);
 }
});
test('Actual explicit ECU channels are mapped per engine, not a shared oil or rotor value',()=>{
 const s=bridge.read({ecu:training});
 const at=(id)=>s.signals[id].channels.primary;
 assert.equal(at('eng.n1.1').value,0);
 assert.equal(at('eng.n1.2').value,70);
 assert.equal(at('eng.n2.2').value,75);
 assert.equal(at('eng.egt.1').value,57);
 assert.equal(at('eng.egt.2').value,620);
 assert.equal(at('eng.fuel_flow.2').value,4100);
 assert.equal(at('eng.oil_pressure.1').value,0);
 assert.equal(at('eng.oil_pressure.2').value,70);
 assert.equal(at('eng.hyd_pressure.b').value,2900);
 assert.equal(at('eng.fuel_qty.center').value,0);
 assert.equal(at('eng.fuel_qty.center').unit,'kg');
 assert.equal(at('eng.n1.2').provenance,'TRAINING_SIMULATION_ONLY');
});
test('Unwired meter selectors, temperatures, oxygen and stand trim remain UNKNOWN',()=>{
 const s=bridge.read({ecu:training});
 for(const id of ['oh.elec.dc_amps','oh.elec.cps','oh.elec.ac_volts',
  'oh.fuel.temperature','oh.crew_oxygen.pressure','ped.stab_trim.left',
  'capt.altimeter','fo.rmi']){
  for(const ch of Object.values(s.signals[id].channels)){
   assert.equal(ch.value,null,id);
   assert.equal(ch.status,'missing_source',id);
  }
 }
});
test('Invalid explicit observation is NOT masked by training data',()=>{
 const s=bridge.read({ecu:training,observed:{
  'eng.n1.2':{primary:{value:55,unit:'%',valid:false,origin:'operator'}}
 }});
 assert.equal(s.signals['eng.n1.2'].channels.primary.status,'invalid_observed');
 assert.equal(s.signals['eng.n1.2'].channels.primary.value,null);
 const good=bridge.read({ecu:training,observed:{
  'eng.n1.2':{primary:{value:55,unit:'%',valid:true,origin:'certified_adapter'}}
 }});
 assert.equal(good.signals['eng.n1.2'].channels.primary.value,55);
 assert.equal(good.signals['eng.n1.2'].channels.primary.provenance,'OBSERVED_SENSOR_WITH_VALIDATION');
 assert.equal(good.signals['eng.n1.2'].channels.primary.liveNeedleAuthorized,false);
});
test('Unknown provider quality is not treated as flight-data authority',()=>{
 const s=bridge.read({ecu:{...training,quality:'UNKNOWN'},cabinPlant:{...physical,source:'fake'}});
 assert.equal(s.signals['eng.n1.2'].channels.primary.value,null);
 assert.equal(s.signals['oh.cabin.diff_pressure_altitude'].channels.cabAlt.value,null);
});
test('Cold dark cabin altitude follows airport elevation independently of differential pressure',()=>{
 const s=bridge.read();
 const out=cold.evaluate({signalSnapshot:s,conditions:offConditions});
 const cabin=out.faces['oh.cabin.diff_pressure_altitude'].channels;
 assert.equal(cabin.cabAlt.value,3963);
 assert.equal(cabin.press.value,0);
 assert.equal(out.faces['oh.cabin.rate'].channels.rate.value,0);
 assert.equal(out.faces['oh.duct.pressure_lr'].channels.L.value,0);
 assert.equal(out.faces['oh.duct.pressure_lr'].channels.R.value,0);
 assert.equal(out.faces['capt.altimeter'].channels.primary.value,null);
 for(const elevation of [66,3260]){
  const c=cold.evaluate({signalSnapshot:s,conditions:{...offConditions,fieldElevationFt:elevation}});
  assert.equal(c.faces['oh.cabin.diff_pressure_altitude'].channels.cabAlt.value,elevation);
 }
 assert.equal(out.counts.liveTargetsApproved,0);
});
test('No pressure/elevation equality or static QNH assumed without confirmation',()=>{
 const s=bridge.read();
 let v=cold.evaluate({signalSnapshot:s,conditions:{coldDarkConfirmed:true,fieldElevationFt:3963}});
 assert.equal(v.faces['oh.cabin.diff_pressure_altitude'].channels.cabAlt.value,null);
 assert.equal(v.faces['oh.cabin.diff_pressure_altitude'].channels.press.value,null);
 v=cold.evaluate({signalSnapshot:s,conditions:{coldDarkConfirmed:true,baroSettingMatchesQnh:true,fieldElevationFt:3963}});
 assert.equal(v.faces['capt.altimeter'].channels.primary.value,3963);
 assert.equal(v.faces['oh.cabin.diff_pressure_altitude'].channels.cabAlt.value,null);
});
test('Stopped engine1 does not zero running engine2, hot oil, fuel mass or oxygen',()=>{
 const s=bridge.read({ecu:training});
 const o=cold.evaluate({signalSnapshot:s,conditions:offConditions});
 assert.equal(o.faces['eng.n1.1'].channels.primary.value,0);
 assert.equal(o.faces['eng.n1.2'].channels.primary.value,70);
 assert.equal(o.faces['eng.fuel_flow.2'].channels.primary.value,4100);
 assert.equal(o.faces['eng.egt.1'].channels.primary.value,57);
 assert.equal(o.faces['eng.oil_temperature.1'].channels.primary.value,45);
 assert.equal(o.faces['eng.fuel_qty.1'].channels.primary.value,2000);
 assert.equal(o.faces['oh.crew_oxygen.pressure'].channels.primary.value,null);
});
test('Instrument wiring remains unknown unless individually verified',()=>{
 const s=bridge.read();
 let o=cold.evaluate({signalSnapshot:s,conditions:{...offConditions,perInstrumentPower:{'oh.elec.cps':true}}});
 assert.equal(o.faces['oh.elec.cps'].channels.primary.powered,null);
 assert.equal(o.faces['oh.elec.cps'].channels.primary.value,null);
 o=cold.evaluate({signalSnapshot:s,conditions:{...offConditions,
  perInstrumentPowerWiringVerified:true,perInstrumentPower:{'oh.elec.cps':false}}});
 assert.equal(o.faces['oh.elec.cps'].channels.primary.powered,false);
 assert.equal(o.faces['oh.elec.cps'].channels.primary.value,null);
});
test('Physical unknown is not a fabricated zero for clock, oxygen, hydraulics or electrical meter',()=>{
 const o=cold.evaluate({signalSnapshot:bridge.read(),
  conditions:{coldDarkConfirmed:true,aircraftStationary:true}});
 for(const id of ['capt.clock','oh.crew_oxygen.pressure','eng.hyd_pressure.a',
   'oh.elec.dc_volts','oh.fuel.temperature']){
  for(const c of Object.values(o.faces[id].channels)){
   assert.equal(c.value,null,id);
   assert.equal(c.powered,null,id);
  }
 }
});
test('Pressurization CPCS/DCPCS identities remain separate metadata and are not pressure synthesizers',()=>{
 const s=bridge.read({cabinPlant:physical});
 const a=cold.evaluate({signalSnapshot:s,conditions:{pressurizationArchitecture:'CPCS'}});
 const b=cold.evaluate({signalSnapshot:s,conditions:{pressurizationArchitecture:'DCPCS'}});
 assert.equal(a.faces['oh.cabin.diff_pressure_altitude'].pressurizationArchitecture,'CPCS');
 assert.equal(b.faces['oh.cabin.diff_pressure_altitude'].pressurizationArchitecture,'DCPCS');
 assert.equal(a.faces['oh.cabin.diff_pressure_altitude'].channels.cabAlt.value,3963);
 assert.equal(b.faces['oh.cabin.diff_pressure_altitude'].channels.press.value,0);
});
