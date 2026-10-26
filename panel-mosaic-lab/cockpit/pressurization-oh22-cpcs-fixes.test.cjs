'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const model=require('./pressurization-oh22-model.js');
const cpcs=require('../../engine/systems/cpcs-v5.js');
const dcpcs=require('../../engine/systems/dcpcs-v4.js');
const diag=require('./pressurization-oh22-diagnostics.js');
const cfg=model.config('CPCS'),digital=model.config('DCPCS');
assert.equal(cfg.hornCutout.piece,'OH19-DIFF','HORN button must be on the neighboring panel');
assert.deepEqual(cfg.valveIndicator.xy,[.812,.282]);
assert.ok(cfg.valveIndicator.diameter>.12&&cfg.valveIndicator.diameter<.17);
assert.ok(cfg.hornCutout.diameter>.06&&cfg.hornCutout.diameter<.11);
assert.equal(digital.hornCutout,undefined,'No CPCS-only horn target in the DCPCS installation');
for(const [id,positions] of Object.entries(cfg.detentLabels)){
 const control=cfg.controls.find(x=>x.id===id);
 assert.deepEqual(positions.map(x=>x.value),control.states,'Every detent label must map exactly to one state');
 for(const detent of positions){
  const command=model.command('CPCS',id,detent.value,cpcs.initial());
  const next=cpcs.apply(cpcs.initial(),command);
  assert.ok(next,'Detent click must result in a source-linked command');
  if(id==='press-mode')assert.equal(next.selectedMode,detent.value);
  else assert.equal(next.cabinRate,detent.value);
 }
}
const small=cfg.controls.filter(x=>x.visualFamily==='Small Silver');
assert.equal(small.length,2);
for(const c of small)assert.ok(cfg.controlFit[c.id]<.1,'Do not cover real CPCS face with oversized sprite');
const src=fs.readFileSync(path.join(__dirname,'pressurization-oh22.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'pressurization-oh22.css'),'utf8');
const runtime=fs.readFileSync(path.join(__dirname,'aircraft-settings.js'),'utf8');
const skin=fs.readFileSync(path.join(__dirname,'pressurization-oh22-diagnostics.js'),'utf8');
for(const item of ['syncHornButton()','pressurization-horn-cutout','OH19-DIFF','installDetents(cfg)',
 'className=\'oh22-valve-pointer\'','output.physical?.valveOpenFraction','state.inputs?.acPowerAvailable'])
 assert.ok(src.includes(item),'Missing OH22 visual or physical implementation '+item);
assert.ok(css.includes('width:100%;height:100%'),'Remove 262% sprite enlargement');
assert.ok(!css.includes('262.5641025641%'),'Legacy oversized toggle sprite must be gone');
assert.ok(css.includes('.oh22-physical-horn-cutout'));
assert.ok(runtime.includes("warning.instructor({type:'CUTOUT_CABIN'})"),'Cabin horn must reach existing ISN owner');
assert.ok(!runtime.includes("new WarningEngine({"),'Do not duplicate the warning system');
assert.ok(skin.includes("OH19-DIFF"),'Diagnostics must check the actual neighboring panel');
const blank={system:'CPCS',platePresent:true,layerPresent:true,layerSystem:'CPCS',
 stateAvailable:true,engineMatches:true,controls:[],lamps:[],displays:[],
 valveIndicatorPresent:true,hornCutoutPresent:true,hornCutoutOutside:false,detentHotspotsPresent:true,
 detentCalibrated:false,visibleFraction:1,noPhysics:false};
const codes=diag.analyze(blank).issues.map(x=>x.code);
assert.ok(!codes.includes('CPCS_VALVE_INDICATOR_UNMAPPED'));
assert.ok(!codes.includes('CPCS_HORN_CUTOUT_UNWIRED'));
assert.ok(!codes.includes('CPCS_DETENT_HIT_TARGETS_MISSING'));
assert.ok(codes.includes('CPCS_DETENT_NOT_PHOTO_VERIFIED'),'Screenshot calibration is not full original-photo approval');
assert.equal(model.validate(),true);
assert.equal(dcpcs.initial().selector,'AUTO','Other pressure installation must remain independent');
console.log('PASS: CPCS OH19 horn press button, native valve-pointer graphics, label detents and diagnostics without touching DCPCS.');
