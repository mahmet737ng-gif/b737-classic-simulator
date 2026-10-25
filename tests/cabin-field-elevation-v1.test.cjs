'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const field=require('../engine/config/ground-airfield-elevation-v1.js');
const profile=require('../engine/config/aircraft-profile-v1.js');
const plant=require('../engine/systems/cabin-pressure-plant-v1.js');
const cpcs=require('../engine/systems/cpcs-v5.js');
const dcpcs=require('../engine/systems/dcpcs-v4.js');
const cold=require('../engine/instruments/cold-dark-indicator-v1.js');
const engines={B737CPCSV5:cpcs,B737DCPCSV4:dcpcs,B737CabinPressurePlantV1:plant};
const locations=[['OIAW',66],['OIII',3963],['OIMM',3260]];
const near=(a,b,tolerance=.0001)=>assert.ok(Math.abs(a-b)<tolerance,a+' vs '+b);

test('Real user-specified airfield presets and unknown location are explicit',()=>{
 for(const [icao,ft] of locations){
   const a=field.resolve(icao.toLowerCase());
   assert.equal(a.fieldElevationFt,ft);
   assert.equal(a.groundReferenceKnown,true);
   assert.equal(field.cabinBaseline(a).cabinAltitudeFt,ft);
   assert.equal(field.cabinBaseline(a).differentialPsid,0);
 }
 assert.equal(field.cabinBaseline(field.resolve('OIFM')).cabinAltitudeFt,null);
 assert.equal(field.cabinBaseline(field.resolve('OIII'),{onGround:false}).status,'requires_pressure_sensor');
 assert.equal(field.cabinBaseline(field.resolve('OIII'),{cabinEqualized:false}).status,'requires_pressure_sensor');
 assert.equal(field.resolve('ABCD',1378).fieldElevationFt,1378);
 assert.throws(()=>field.resolve('XYZ'),/ICAO/);
 assert.throws(()=>field.resolve('OIII',NaN),/finite/);
});

for(const [icao,ft] of locations){
 test('CPCS/DCPCS independently start with CAB ALT '+ft+' ft at '+icao+' instead of zero',()=>{
   const instances=[];
   for(const pressurization of ['CPCS','DCPCS']){
     const a=profile.createPressurizationSession({...profile.DEFAULTS,pressurization},engines,{fieldElevationFt:ft});
     instances.push(a);
     const p=a.physical(),s=a.snapshot(),inputs=s.input||s.inputs;
     near(p.cabinAltitudeFt,ft);
     near(p.aircraftAltitudeFt,ft);
     near(p.differentialPsid,0);
     near(p.cabinRateFtMin,0);
     assert.equal(inputs.cabinAltitudeFt,ft);
     assert.equal(inputs.airplaneAltitudeFt,ft);
     const coldState=cold.resolve('oh.cabin.diff_pressure_altitude',{fieldElevationFt:ft,cabinEqualized:true});
     assert.equal(coldState.needles.cabAlt.value,ft);
     assert.equal(coldState.needles.press.value,0);
     a.reset();
     near(a.physical().cabinAltitudeFt,ft);
     assert.equal((a.snapshot().input||a.snapshot().inputs).cabinAltitudeFt,ft);
     a.stepPhysics(1000,{aircraftAltitudeFt:ft,onGround:true,packsAvailable:false,
       bleedAirAvailable:false});
     near(a.physical().cabinAltitudeFt,ft);
   }
   instances[0].rebaseGround(66);
   near(instances[0].physical().cabinAltitudeFt,66);
   near(instances[1].physical().cabinAltitudeFt,ft);
 });
}

test('No implicit zero if altitude of current airport is unknown',()=>{
 const z=profile.createPressurizationSession(profile.DEFAULTS,engines);
 assert.equal(z.groundReference().known,false);
 // Historical sea-level training plant remains supported only as an explicit
 // local physics fallback; no airport identity may be inferred from it.
 near(z.physical().cabinAltitudeFt,0);
 const gauge=cold.resolve('oh.cabin.diff_pressure_altitude',{cabinEqualized:true});
 assert.equal(gauge.needles.cabAlt.value,null);
});

test('Ground relocation requires an equalized cabin and is rejected during flight',()=>{
 const a=profile.createPressurizationSession(profile.DEFAULTS,engines,{fieldElevationFt:3963});
 assert.throws(()=>a.rebaseGround(NaN),/Invalid field/);
 assert.throws(()=>a.rebaseGround(20000),/Invalid field/);
 a.stepPhysics(1000,{aircraftAltitudeFt:4000,onGround:false,packsAvailable:false,
   bleedAirAvailable:false});
 assert.throws(()=>a.rebaseGround(66),/in flight/);
});

test('Cabin can be prepressurized on ground: ground baseline must not erase it',()=>{
 const a=profile.createPressurizationSession(profile.DEFAULTS,engines,{fieldElevationFt:3260});
 a.dispatch({type:'MODE',value:'MAN'});
 a.dispatch({type:'MANUAL_SWITCH',value:'CLOSE'});
 for(let t=0;t<45;t++)a.stepPhysics(1000,{aircraftAltitudeFt:3260,onGround:true,
   packsAvailable:true,bleedAirAvailable:true});
 assert.ok(a.physical().differentialPsid>.05);
 assert.throws(()=>a.rebaseGround(66),/pressurized cabin/);
});

test('Both configurations maintain their independent controllers and source arrays',()=>{
 const c=profile.createPressurizationSession({...profile.DEFAULTS,pressurization:'CPCS'},engines,{fieldElevationFt:3963});
 const d=profile.createPressurizationSession({...profile.DEFAULTS,pressurization:'DCPCS'},engines,{fieldElevationFt:3963});
 c.dispatch({type:'MODE',value:'MAN_DC'});
 d.dispatch({type:'MODE',value:'ALTN'});
 assert.equal(c.snapshot().selectedMode,'MAN_DC');
 assert.equal(d.snapshot().selector,'ALTN');
 c.rebaseGround(66);
 assert.equal(d.snapshot().selector,'ALTN');
 assert.equal(c.snapshot().selectedMode,'AUTO');
 near(d.physical().cabinAltitudeFt,3963);
});

test('Unified UI publishes field altitude from correct selected airport for CAB ALT / ISM',()=>{
 const html=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/index.html'),'utf8');
 const js=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/aircraft-settings.js'),'utf8');
 assert.ok(html.includes('ground-airfield-elevation-v1.js'));
 assert.ok(js.includes('pressureGroundAirport'));
 assert.ok(js.includes('b737:airport-ground-context'));
 assert.ok(js.includes('setGroundAirport'));
 assert.ok(js.includes('b737:cold-dark-state'));
 assert.ok(js.includes('session.stepPhysics(1000'));
 assert.ok(js.includes("key:'cabinAltitudeFt',value:measured"));
 const needle=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/cabin-dual-needles-unified.js'),'utf8');
 assert.ok(needle.includes("event.detail?.output?.physical"));
 assert.ok(needle.includes("setMeasuredReadings"));
 assert.ok(needle.includes("calibrationApproved:false"));
 const coldUi=fs.readFileSync(path.join(__dirname,'../panel-mosaic-lab/cockpit/cold-dark-indicators-unified.js'),'utf8');
 assert.ok(coldUi.includes('B737GroundAirfieldContext?.()'));
 assert.ok(coldUi.includes("cabin.cabAlt.value.toFixed(0)"));
});
