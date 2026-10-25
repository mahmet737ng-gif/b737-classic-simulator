'use strict';
// Three independent 4-gate passes: source geometry, minor strokes, angle mapping,
// and real selected CPCS/DCPCS trainer-to-Unified event delivery.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const model=require('../../panel-mosaic-lab/cockpit/cabin-dual-needles-model.js');
const photo=require('./oh19-cab-alt-photo-anchors-v1.json');
const native=require('./oh19-native-ticks-batch1.json');
const stage10=require('./stage10-preview-scale-subset-v1.json');
const {build}=require('./oh19-photo-evidence-v2.js');
const profile=require('../config/aircraft-profile-v1.js');
const cpcs=require('../systems/cpcs-v5.js'),dcpcs=require('../systems/dcpcs-v4.js');
const plant=require('../systems/cabin-pressure-plant-v1.js');
const spriteUI=fs.readFileSync(path.join(__dirname,'../../panel-mosaic-lab/cockpit/cabin-dual-needles-unified.js'),'utf8');
const engines={B737CPCSV5:cpcs,B737DCPCSV4:dcpcs,B737CabinPressurePlantV1:plant};
const sites=[['OIAW',66],['OIMM',3260],['OIII',3963]];
const inner=native.scales.find(s=>s.mode==='cabinAltitude').allVisibleTickCandidates;
const outer=native.scales.find(s=>s.mode==='diffPressure').allVisibleTickCandidates;
const majors=outer.filter(t=>t.labelOrigin==='printed_major');
function harness(active){
 const handlers={};let selected=active;
 const win={B737CabinDualNeedlesModel:model,
  B737PressurizationIntegration:{getSelected:()=>selected},
  addEventListener:(name,fn)=>{handlers[name]=fn}};
 const doc={baseURI:'https://example.invalid/b737/',getElementById:()=>null,querySelector:()=>null};
 vm.runInNewContext(spriteUI,{window:win,document:doc,URL,console,MutationObserver:class {}});
 return {
  send:(system,p)=>handlers['b737:pressurization-state']({detail:{system,output:{physical:p}}}),
  switchTo:name=>{selected=name},
  angles:()=>win.B737UnifiedCabinNeedles.getAngles(),
  physical:()=>win.B737UnifiedCabinNeedles.getMeasuredReadings(),
  malformed:()=>handlers['b737:pressurization-state']({detail:{system:selected,output:{physical:{cabinAltitudeFt:NaN,differentialPsid:0}}}})
 };
}
for(let pass=1;pass<=3;pass++){
 const airport=sites[pass-1][0],field=sites[pass-1][1];
 test('round '+pass+' / 1 source and stacked pointer geometry '+airport,()=>{
  const e=build({ticks:native,photo,preview:stage10});
  assert.equal(e.source.sha256,native.source.sha256);
  assert.deepEqual(model.needles.map(n=>[n.id,n.layer,n.stack,n.printedScale]),
   [['press',0,'rear','outer'],['cabAlt',1,'front','inner']]);
  assert.deepEqual([e.counts.inner,e.counts.outer,e.counts.operationalApproved],[47,51,0]);
  const pr=model.needles[0].tipRadius*(Math.hypot(4,221)+1.3)/220;
  const ar=model.needles[1].tipRadius*(Math.hypot(14,217)+1.6)/220;
  assert.ok(outer.every(t=>t.innerRadiusPx>pr));
  assert.ok(inner.every(t=>t.innerRadiusPx>ar));
 });
 test('round '+pass+' / 2 reject invented 32 minor values '+airport,()=>{
  const a=build({ticks:native,photo,preview:stage10});
  const unknown=a.inner.filter(x=>x.class==='UNKNOWN_MINOR_VALUE');
  assert.equal(unknown.length,32);
  assert.ok(unknown.every(t=>t.anchorPreviewValueFt===null&&!t.numericValueApproved));
  assert.equal(a.inner[7].anchorPreviewValueFt,null);
  assert.equal(a.inner[18].anchorPreviewValueFt,null);
  assert.equal(a.pivotCandidate.certified,false);
  assert.equal(photo.review.productionApproved,false);
 });
 test('round '+pass+' / 3 continuous response and out-of-dial safety '+airport,()=>{
  assert.equal(majors.length,11);
  for(const t of majors)
   assert.ok(Math.abs(model.differentialPressurePreviewBearing(t.interpretedValuePsi)-t.angleDeg)<1e-9);
  for(let f=0;f<50000;f+=125){
   const x=model.cabinAltitudePreviewBearing(f),y=model.cabinAltitudePreviewBearing(f+125);
   assert.ok(Number.isFinite(x)&&y>=x&&y<=360);
  }
  for(let psi=0;psi<10;psi+=.05){
   const x=model.differentialPressurePreviewBearing(psi);
   const y=model.differentialPressurePreviewBearing(psi+.05);
   assert.ok(Number.isFinite(x)&&y>=x&&y<=360);
  }
  assert.equal(model.differentialPressurePreviewBearing(-1),null);
  assert.equal(model.differentialPressurePreviewBearing(10.1),null);
  assert.equal(model.resolvePhysicalReadings({cabinAltitudeFt:-1,differentialPsid:0}).status,'OUT_OF_PRINTED_RANGE');
  assert.equal(model.resolvePhysicalReadings({cabinAltitudeFt:field,differentialPsid:NaN}).status,'INVALID_SENSOR_SAMPLE');
 });
 test('round '+pass+' / 4 selected CPCS and DCPCS both drive both candidate needles '+airport,()=>{
  const c=profile.createPressurizationSession({...profile.DEFAULTS,pressurization:'CPCS'},engines,{fieldElevationFt:field});
  const d=profile.createPressurizationSession({...profile.DEFAULTS,pressurization:'DCPCS'},engines,{fieldElevationFt:field});
  for(const s of [c,d]){
   assert.ok(Math.abs(s.physical().cabinAltitudeFt-field)<1e-7);
   assert.ok(Math.abs(s.physical().differentialPsid)<1e-7);
   assert.equal(s.physical().status,'PROVISIONAL_TRAINING_PHYSICS_NOT_AIRCRAFT_VALIDATED');
  }
  const app=harness('CPCS');app.send('CPCS',c.read().physical);
  assert.equal(app.physical().operatingInstallation,'CPCS');
  assert.equal(app.physical().operationalNeedleAuthorized,false);
  assert.equal(app.angles().press,model.differentialPressurePreviewBearing(0));
  assert.equal(app.angles().cabAlt,model.cabinAltitudePreviewBearing(field));
  const first=app.angles();
  app.send('DCPCS',{cabinAltitudeFt:20000,differentialPsid:7});
  assert.deepEqual(app.angles(),first);
  app.malformed();assert.deepEqual(app.angles(),first);
  const moved=c.stepPhysics(1000,{aircraftAltitudeFt:field,onGround:true,packsAvailable:true,bleedAirAvailable:true}).physical;
  assert.ok(Number.isFinite(moved.differentialPsid));
  assert.ok(moved.differentialPsid>0);
  app.send('CPCS',moved);
  assert.ok(app.angles().press>first.press);
  assert.equal(app.angles().cabAlt,model.cabinAltitudePreviewBearing(moved.cabinAltitudeFt));
  app.switchTo('DCPCS');const held=app.angles();
  app.send('CPCS',{cabinAltitudeFt:40000,differentialPsid:9});
  assert.deepEqual(app.angles(),held);
  app.send('DCPCS',d.read().physical);
  assert.equal(app.physical().operatingInstallation,'DCPCS');
  assert.equal(app.angles().press,model.differentialPressurePreviewBearing(0));
  assert.equal(app.angles().cabAlt,model.cabinAltitudePreviewBearing(field));
  assert.equal(app.physical().calibrationApproved,false);
 });
}
