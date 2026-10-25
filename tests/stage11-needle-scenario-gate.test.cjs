'use strict';
/* Stage 11 deterministic scenario regression for B737 Classic analogue pointers.
 * Physically sourced classroom simulation, NOT an approved flight test.
 * Every snapshot remains non-renderable until per-gauge photo QA and wiring.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ECU=require('../engine/integration/isn-13-18-ecu-testbench-v1');
const Electrical=require('../engine/systems/electrical-v7');
const Loads=require('../engine/systems/electrical-loads-v8');
const TrainerCore=require('../engine/trainer/core');
const {WarningEngine}=require('../audio/warning-engine');
const Pneumatics=require('../engine/systems/pneumatics-v6');
const Pack=require('../engine/integration/isn-electrical-pack-v1');
const EngineAPU=require('../engine/integration/isn-engine-apu-v1');
const Start=require('../engine/integration/isn-start-sequence-v1');
const Chain=require('../engine/integration/isn-apu-start-chain-v1');
const ThrustPlanner=require('../engine/integration/isn-thrust-performance-v1');
const FuelRuntime=require('../engine/integration/isn-09-12-runtime-v1');
const stage8=require('../engine/instruments/stage8-ism-signal-bridge-v1');
const stage7=require('../engine/instruments/stage7-cold-dark-state-v1');
const routeEngine=require('../engine/instruments/stage8-pointer-routing-v1');
const stage5=require('../engine/instruments/stage5-scale-mapping-v1');
const stage9=require('../engine/instruments/stage9-needle-dynamics-v1');
const stage10=require('../engine/instruments/stage10-needle-workbench-v1');
const contracts=require('../engine/instruments/stage8-signal-contracts-v1.json');
const policy=require('../engine/instruments/cold-dark-indicator-policy-v1.json');
const routes=require('../engine/instruments/stage8-pointer-routing-v1.json');
const subset=require('../engine/instruments/stage10-preview-scale-subset-v1.json');
const responses=require('../engine/instruments/stage9-dynamics-registry-v1.json');
const stage5Candidates=require('../engine/instruments/stage5-numeric-scale-candidates-v1.json');
const stage6Candidates=require('../engine/instruments/stage6-needle-fit-candidates-v1.json');
const stage34=require('../engine/instruments/stage34-native/qa-review-queue-v1.json');
const report={schema:'b737.stage11.scenario-audit.v1',
 effectiveDate:'2026-10-25',
 aircraft:'B737-33V EP-FSI',
 disclosure:'EDUCATIONAL/SIMULATED scenarios, NOT flight-tested or certified instrument calibration',
 sourceTestbench:'ISN-13-18 Testbench / CLASSROOM_COMPRESSED for scenario coverage',
 releaseApproved:false,originalPanelAssetsUnchanged:true,
 scenes:[],coverage:null,unresolved:[]};
const reportPath=process.env.STAGE11_REPORT_PATH||null;
function capture(name,phase,ecu,cabin=null,fields={}){
 const snap=stage8.create(contracts).read({ecu,cabinPlant:cabin,timeMs:ecu?.timeMs??null});
 const pointer=routeEngine.create(routes).project(snap);
 const enabled=stage10.create({routes,scales:subset,scaleEngine:stage5,
    dynamics:stage9,profileRegistry:responses,previewPowerPolicy:'training_qa_assume_power'});
 const preview=enabled.evaluate(pointer,{nowMs:1000});
 const out={
  id:name,phase,sourceQuality:ecu?.quality??'NO_ECU',
  faces:Object.keys(snap.signals).length,
  channels:snap.stats.channels,signalCount:snap.stats.training+snap.stats.observed,
  pointerIdentities:Object.keys(pointer.pointers).length,
  numericalPreviewModels:preview.counts.geometryPreviewCapable,
  calculatedPreviewTargets:preview.counts.dynamicsEvaluated,
  operationalNeedlesMoved:preview.counts.liveNeedlesMoved,
  realImageGeometryApproved:false,
  activeEngineN1:ecu?.engines?{
   left:ecu.engines.engine1?.n1Percent,right:ecu.engines.engine2?.n1Percent}:null,
  cabinAltitudeFt:snap.signals['oh.cabin.diff_pressure_altitude'].channels.cabAlt.value,
  cabinDifferentialPsi:snap.signals['oh.cabin.diff_pressure_altitude'].channels.press.value,
  ...fields};
 assert.equal(out.faces,54);
 assert.equal(out.channels,62);
 assert.equal(out.pointerIdentities,38);
 assert.equal(out.numericalPreviewModels,8);
 assert.equal(out.operationalNeedlesMoved,0);
 for(const x of Object.values(preview.pointers))assert.equal(x.liveNeedleAuthorized,false);
 for(const x of Object.values(pointer.pointers))assert.equal(x.liveNeedleAuthorized,false);
 report.scenes.push(out);
 return {snap,pointer,preview};
}
const bench=()=>new ECU.Testbench({Electrical,Loads,TrainerCore,
 WarningEngine,Pneumatics,Pack,EngineAPU,Start,Chain,ThrustPlanner,FuelRuntime,
 timingProfile:'CLASSROOM_COMPRESSED'});
test('01 — 54-face calibration blockers and 38 separate source-routed sprites remain fail closed',()=>{
 assert.equal(stage34.faces.length,54);
 assert.equal(stage34.certifiedFaces,0);
 assert.equal(stage5Candidates.counts.liveApprovedFaces,0);
 assert.equal(stage6Candidates.counts.finalApprovedNeedleFits,0);
 assert.equal(contracts.certifiedAngleTables,0);
 assert.equal(contracts.verifiedPerInstrumentElectricalPowerFeeds,0);
 assert.equal(contracts.activation,'BLOCKED');
 assert.equal(routes.counts.liveApproved,0);
 assert.equal(responses.counts.certifiedMechanicalResponseProfiles,0);
 assert.equal(new Set(routes.routes.map(x=>x.spriteId)).size,38);
 for(const face of stage34.faces){
  assert.ok(face.issues.length,face.id);
  assert.ok(face.issues.includes('pivot_shaft_not_certified')||
     face.kind==='linear',face.id);
 }
 const unresolved={
  faceCount:54,calibratedFaces:0,
  pivotPending:stage34.faces.filter(x=>x.kind==='rotary'&&x.issues.includes('pivot_shaft_not_certified')).length,
  photoHighRisk:stage34.faces.filter(x=>x.priority==='high').length,
  photoMediumRisk:stage34.faces.filter(x=>x.priority==='medium').length,
  photoNormal:stage34.faces.filter(x=>x.priority==='normal').length,
  scaleModesWith2PhotoAnchors:stage5Candidates.counts.scaleModesWithTwoPhotoAnchors,
  pointerProfiles:responses.counts.previewResponseProfiles,
  pointersBlocked:responses.counts.unresolvedResponseProfiles,
  ownerSpriteShapesLocked:stage6Candidates.counts.spriteShapeOwnerLocked,
  instrumentPowerFeedsApproved:0,
  sourceImageReviewPending:true
 };
 report.coverage=unresolved;
 report.unresolved=stage34.faces.map(f=>({id:f.id,priority:f.priority,issues:f.issues}));
 assert.equal(unresolved.pivotPending,49);
 assert.equal(unresolved.photoHighRisk+unresolved.photoMediumRisk+unresolved.photoNormal,54);
});
test('02 — engine + APU Cold & Dark from actual ISN trainer is not a fake all-zero cockpit',()=>{
 const rig=bench();const s=rig.get();
 assert.equal(s.quality,'TRAINING_SIMULATION_ONLY');
 assert.equal(s.electrical.battery,false);
 assert.equal(s.engines.engine1.phase,'OFF');
 const stage=capture('cold_dark','APU_OFF_ENGINE_OFF',s);
 assert.equal(stage.snap.signals['eng.n1.1'].channels.primary.value,0);
 assert.ok(stage.snap.signals['eng.oil_temperature.1'].channels.primary.value>0);
 assert.equal(stage.snap.signals['oh.crew_oxygen.pressure'].channels.primary.value,null);
 assert.equal(stage.snap.signals['oh.elec.dc_volts'].channels.primary.value,null);
 assert.equal(stage.preview.pointers.cabAlt.simulationAngleDeg,null);
});
test('03 — correct equalised ground cabin-altitude for three actual field elevations',()=>{
 const bridge=stage8.create(contracts),initial=stage7.create({contracts,policy});
 for(const [icao,ft] of [['OIAW',66],['OIMM',3260],['OIII',3963]]){
  const p={source:'PROVISIONAL_IDEAL_GAS_TRAINER',
    cabinAltitudeFt:ft,cabinRateFtMin:0,differentialPsid:0};
  const s=bridge.read({cabinPlant:p});
  const cold=initial.evaluate({signalSnapshot:s,conditions:{coldDarkConfirmed:true,
   cabinEqualized:true,cabinPressureStable:true,fieldElevationFt:ft,
   pressurizationArchitecture:'CPCS'}});
  assert.equal(cold.faces['oh.cabin.diff_pressure_altitude'].channels.cabAlt.value,ft);
  assert.equal(cold.faces['oh.cabin.diff_pressure_altitude'].channels.press.value,0);
  assert.equal(cold.faces['oh.cabin.rate'].channels.rate.value,0);
  assert.equal(cold.faces['oh.crew_oxygen.pressure'].channels.primary.value,null);
  const output=capture('ground_'+icao,'COLD_DARK_EQUALISED',null,p,{airport:icao,fieldElevationFt:ft});
  assert.ok(Number.isFinite(output.preview.pointers.cabAlt.simulationAngleDeg));
  assert.equal(output.preview.pointers.cabAlt.liveNeedleAuthorized,false);
 }
});
test('04 — APU and engine1 start, independent engine2 indications and real telemetry provenance',()=>{
 const rig=bench();
 rig.battery(true);rig.startAPU();rig.advance(1400);
 assert.equal(rig.get().apu.phase,'READY');
 capture('apu_ready','START_APU',rig.get());
 rig.selectGenerator('APU',1);rig.apuBleed(true);rig.prepareFuel();
 rig.engineStart('engine1');assert.equal(rig.get().engines.engine1.phase,'MOTORING');
 rig.advance(850);
 assert.equal(rig.get().engines.engine1.phase,'AWAIT_FUEL_LEVER_IDLE');
 capture('engine1_motoring','START_ENG1_25_N2',rig.get());
 assert.ok(rig.fuelLever('engine1','IDLE').accepted);
 rig.advance(1000);
 assert.equal(rig.get().engines.engine1.phase,'RUNNING');
 rig.advance(10000);
 const state=rig.get();
 const o=capture('engine1_stable','ENG1_RUNNING_ENG2_OFF',state);
 assert.ok(o.snap.signals['eng.n2.1'].channels.primary.value>25);
 assert.equal(o.snap.signals['eng.n2.2'].channels.primary.value,0);
 assert.ok(o.snap.signals['eng.fuel_flow.1'].channels.primary.value>0);
 assert.equal(o.snap.signals['eng.fuel_flow.2'].channels.primary.value,0);
 assert.equal(o.preview.pointers.captIAS.status,'blocked');
 assert.equal(o.preview.pointers.n2_1.status,'blocked');
 assert.equal(o.preview.pointers.n2_2.status,'blocked');
});
test('05 — two engines in flight and distinct source values are preserved without uncalibrated N1/N2 animation',()=>{
 const rig=bench();rig.battery(true);rig.startAPU();rig.advance(1400);
 rig.selectGenerator('APU',1);rig.apuBleed(true);rig.prepareFuel();
 for(const engine of ['engine1','engine2']){
  rig.engineStart(engine);rig.advance(850);
  assert.ok(rig.fuelLever(engine,'IDLE').accepted);
  rig.advance(1000);
 }
 rig.advance(12000);
 assert.equal(rig.get().engines.engine1.phase,'RUNNING');
 assert.equal(rig.get().engines.engine2.phase,'RUNNING');
 rig.setOnGround(false);rig.setFlightInputs({pressureAltitudeFt:10000,iasKt:200,oatC:0});
 rig.planThrust('engine1',{mode:'CRZ',targetIasKt:240,accelTimeSec:40});
 rig.advance(12000);
 const s=rig.get();const o=capture('climb_cruise','TWO_ENGINE_AIRBORNE',s);
 assert.ok(o.snap.signals['eng.n1.1'].channels.primary.value>25);
 assert.ok(o.snap.signals['eng.n2.2'].channels.primary.value>55);
 assert.ok(o.snap.signals['eng.fuel_qty.center'].channels.primary.unit==='kg');
 assert.equal(o.preview.pointers.n2_1.reason,'no_two_anchor_scale');
 assert.equal(o.preview.pointers.captIAS.reason,'no_two_anchor_scale');
});
test('06 — two independent cabin pressure pointers follow distinct numerical maps',()=>{
 const c=stage8.create(contracts);
 const r=routeEngine.create(routes);
 const w=stage10.create({routes,scales:subset,scaleEngine:stage5,dynamics:stage9,
  profileRegistry:responses,previewPowerPolicy:'training_qa_assume_power'});
 const snapshot=(ft,psi,ms)=>{
  const p={source:'PROVISIONAL_IDEAL_GAS_TRAINER',cabinAltitudeFt:ft,
    cabinRateFtMin:120,differentialPsid:psi};
  return w.evaluate(r.project(c.read({cabinPlant:p})),{nowMs:ms});
 };
 const g=snapshot(3963,0,0);
 assert.ok(Math.abs(g.pointers.cabAlt.simulationAngleDeg-66.674)<.06);
 assert.ok(Math.abs(g.pointers.press.simulationAngleDeg-.64)<.02);
 const c1=snapshot(9000,3,500);
 assert.ok(c1.pointers.cabAlt.simulationTargetDeg>g.pointers.cabAlt.simulationAngleDeg);
 assert.ok(c1.pointers.press.simulationTargetDeg>g.pointers.press.simulationAngleDeg);
 assert.ok(c1.pointers.cabAlt.simulationAngleDeg>g.pointers.cabAlt.simulationAngleDeg);
 assert.ok(c1.pointers.press.simulationAngleDeg>g.pointers.press.simulationAngleDeg);
 const c2=snapshot(5000,1,1500);
 assert.ok(c2.pointers.cabAlt.simulationTargetDeg<c1.pointers.cabAlt.simulationTargetDeg);
 assert.ok(c2.pointers.press.simulationTargetDeg<c1.pointers.press.simulationTargetDeg);
 assert.equal(c2.counts.liveNeedlesMoved,0);
 report.scenes.push({id:'cabin_pressure_rise_fall',phase:'PRESSURIZATION',
  cabinAltitudeFt:[3963,9000,5000],differentialPsi:[0,3,1],
  pointerModelCount:2,operationalNeedlesMoved:0,scaleCalibrationStatus:'NOT_APPROVED'});
});
test('07 — dropped source and bad observation never become a valid zero or overwrite the last preview',()=>{
 const bridge=stage8.create(contracts),router=routeEngine.create(routes);
 const w=stage10.create({routes,scales:subset,scaleEngine:stage5,dynamics:stage9,
  profileRegistry:responses,previewPowerPolicy:'training_qa_assume_power'});
 function push(v,valid,ms){
  const snap=bridge.read({observed:{'oh.elec.cps':{primary:{
   value:v,unit:'Hz',valid,origin:'STAGE11_QA_INJECTION'}}}});
  return w.evaluate(router.project(snap),{nowMs:ms}).pointers.cps;
 }
 const first=push(410,true,0);
 assert.ok(Math.abs(first.simulationAngleDeg-41.805)<.02);
 const lost=push(0,false,500);
 assert.equal(lost.sourceStatus,'invalid_observed');
 assert.equal(lost.sourceValue,null);
 assert.equal(lost.simulationAngleDeg,first.simulationAngleDeg);
 const recovery=push(420,true,1000);
 assert.ok(recovery.simulationAngleDeg>first.simulationAngleDeg);
 assert.equal(recovery.liveNeedleAuthorized,false);
 report.scenes.push({id:'cps_sensor_drop_recovery',phase:'INJECTED_INVALID_SENSOR',
  initialAngleDeg:first.simulationAngleDeg,lostAngleDeg:lost.simulationAngleDeg,
  recoveredAngleDeg:recovery.simulationAngleDeg,operationalNeedlesMoved:0});
});
test('08 — strict unknown gauge electrical wiring must inhibit motion; QA bypass never releases sprites',()=>{
 const r=routeEngine.create(routes),b=stage8.create(contracts);
 const c=b.read({cabinPlant:{source:'PROVISIONAL_IDEAL_GAS_TRAINER',
   cabinAltitudeFt:3963,cabinRateFtMin:0,differentialPsid:0}});
 const p=r.project(c);
 const strict=stage10.create({routes,scales:subset,scaleEngine:stage5,dynamics:stage9,
   profileRegistry:responses});
 const a=strict.evaluate(p,{nowMs:1});
 assert.equal(a.pointers.cabAlt.simulationAngleDeg,null);
 assert.equal(a.pointers.cabAlt.status,'power_unverified');
 const qa=stage10.create({routes,scales:subset,scaleEngine:stage5,dynamics:stage9,
   profileRegistry:responses,previewPowerPolicy:'training_qa_assume_power'});
 const v=qa.evaluate(p,{nowMs:1});
 assert.ok(Number.isFinite(v.pointers.cabAlt.simulationAngleDeg));
 assert.equal(v.pointers.cabAlt.previewPowerAssumed,true);
 assert.equal(v.pointers.cabAlt.liveNeedleAuthorized,false);
 report.scenes.push({id:'unknown_equipment_power_gate',phase:'POWER_UNVERIFIED',
  strictAngle:null,qaOnlySimulatedAngle:v.pointers.cabAlt.simulationAngleDeg,
  operationalNeedlesMoved:0});
});
test('09 — stuck mechanism retains angle under subsequent valid target and no arbitrary spring-zero',()=>{
 const m=stage9.create({id:'pressure_needle_test',
  profile:{mode:'second_order',omegaRadSec:5,dampingRatio:1.1,requiresPower:true},
  limits:{minAngleDeg:0,maxAngleDeg:330}});
 m.update({targetAngleDeg:90,validSample:true,dtSeconds:0,power:'on',source:'STAGE11'});
 const frozen=m.update({targetAngleDeg:200,validSample:true,dtSeconds:1,power:'on',fault:'needle_jammed',source:'STAGE11'});
 assert.equal(frozen.angleDeg,90);
 assert.equal(frozen.status,'needle_jammed');
 const unpowered=m.update({targetAngleDeg:0,validSample:true,dtSeconds:1,power:'off',source:'STAGE11'});
 assert.equal(unpowered.angleDeg,90);
 report.scenes.push({id:'jam_power_loss',phase:'MECHANICAL_AND_POWER_FAULT',
  heldAngleDeg:90,operationalNeedlesMoved:0});
});
test('10 — owner bitmaps and public production pointer code remain explicitly out of new render path',()=>{
 const code=fs.readFileSync(path.join(__dirname,
  '../engine/instruments/stage10-needle-workbench-v1.js'),'utf8');
 for(const forbidden of ['.style.','.setAngle(','.setValues(','document.getElementById'])assert.ok(!code.includes(forbidden),forbidden);
 const browser=fs.readFileSync(path.join(__dirname,
  '../panel-mosaic-lab/cockpit/stage78-readonly-unified.js'),'utf8');
 assert.ok(browser.includes('getMotionPreview:()=>motionPreview'));
 for(const forbidden of ['B737UnifiedAcDcMetering.setAngle(', 'B737UnifiedDuctPressureNeedles.setValues('])assert.ok(!browser.includes(forbidden),forbidden);
 assert.equal(routes.counts.liveApproved,0);
});
test.after(()=>{
 if(!reportPath)return;
 const dest=path.resolve(reportPath);
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 const ok=report.coverage&&report.scenes.length>=10&&
   report.scenes.every(x=>x.operationalNeedlesMoved===0);
 report.releaseApproved=false;
 report.scenarioEvidencePassed=Boolean(ok);
 report.sceneCount=report.scenes.length;
 report.label=ok?'STAGE11_SCENARIO_QA_PASS_RELEASE_STILL_BLOCKED':'STAGE11_INCOMPLETE';
 fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');
 if(!ok)throw Error('Stage11 evidence incomplete');
 console.log('STAGE11_SCENARIO_REPORT='+dest);
 console.log('STAGE11_SCENE_COUNT='+report.sceneCount);
 console.log('STAGE11_GATE='+report.label);
});
