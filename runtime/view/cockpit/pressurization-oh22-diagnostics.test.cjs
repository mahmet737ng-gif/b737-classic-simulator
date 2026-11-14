'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const diagnosis=require('./pressurization-oh22-diagnostics.js');
const cfg=require('./pressurization-oh22-model.js');
const mock={system:'CPCS',platePresent:true,layerPresent:true,layerSystem:'CPCS',stateAvailable:true,
 engineMatches:true,lampTestActive:false,controls:cfg.config('CPCS').controls.map(x=>({
 id:x.id,present:true,enabled:true,centerErrorPx:0,outsidePlate:false,assetBroken:false,
 calibrationProvisional:!!x.visualCalibration})),displays:cfg.config('CPCS').displays.map(x=>({
 id:x.id,present:true,valueMismatch:false,overflow:false
 })),lamps:cfg.config('CPCS').lamps.map(x=>({id:x.id,present:true,error:false,assetBroken:false,outsidePlate:false,centerErrorPx:0})),
 overlapPairs:[],visibleFraction:0.64,valveIndicatorPresent:false,hornCutoutPresent:false,detentCalibrated:false,
 noPhysics:false,unknownBus:true};
const report=diagnosis.analyze(mock);
assert.equal(report.system,'CPCS');
for(const code of ['UNVERIFIED_SOCKET','CPCS_VALVE_INDICATOR_UNMAPPED','CPCS_HORN_CUTOUT_UNWIRED','CPCS_DETENT_NOT_PHOTO_VERIFIED','ZOOM_VIEW_CLIPPING','POWER_SOURCE_UNVERIFIED']){
 assert.ok(report.issues.some(x=>x.code===code),'Missing real OH22 audit issue '+code);
}
assert.ok(report.issues.every(x=>x.component),'Every finding must identify a component');
assert.ok(report.metrics.controlsRegistered>=8);
const broken={...mock,layerSystem:'DCPCS',engineMatches:false,
 controls:[{id:'manual-valve',present:true,enabled:false,centerErrorPx:9,outsidePlate:true,assetBroken:true,spriteOverscale:2.625}],
 lamps:[{id:'auto-fail',present:true,error:true,assetBroken:true,outsidePlate:true,centerErrorPx:7}],
 displays:[{id:'flight-display',present:true,valueMismatch:true,overflow:true,expected:28000,actual:'28'}],
 overlapPairs:[{a:'auto-check',b:'press-mode',fraction:.37,hotspot:true}],visibleFraction:1};
const failures=diagnosis.analyze(broken).issues.map(x=>x.code);
for(const code of ['PROFILE_MISMATCH','ENGINE_MODE_MISMATCH','CONTROL_NOT_INTERACTIVE','ANCHOR_RUNTIME_DRIFT','CONTROL_OUTSIDE_PANEL','ACTUATOR_ASSET_FAILED','SPRITE_OVERSCALE','LAMP_WRONG_STATE','LAMP_ASSET_FAILED','LAMP_RUNTIME_DRIFT','DISPLAY_STATE_MISMATCH','DIGITS_CLIPPED','HITBOX_COLLISION']){
 assert.ok(failures.includes(code),'Missing runtime fault class '+code);
}
const digital=diagnosis.analyze({...mock,system:'DCPCS',layerSystem:'DCPCS',valveIndicatorPresent:true,hornCutoutPresent:true,
 controls:cfg.config('DCPCS').controls.map(x=>({id:x.id,present:true,enabled:true,centerErrorPx:0})),
 lamps:cfg.config('DCPCS').lamps.map(x=>({id:x.id,present:true,error:false})),
 displays:cfg.config('DCPCS').displays.map(x=>({id:x.id,present:true,valueMismatch:false})),visibleFraction:1});
assert.ok(!digital.issues.some(x=>x.code==='CPCS_VALVE_INDICATOR_UNMAPPED'||x.code==='CPCS_HORN_CUTOUT_UNWIRED'));
assert.ok(digital.issues.some(x=>x.code==='DCPCS_DETENT_NOT_PHOTO_VERIFIED'));
const html=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const overhead=fs.readFileSync(path.join(__dirname,'overhead-stage.html'),'utf8');
const consoleSource=fs.readFileSync(path.join(__dirname,'pressurization-oh22-diagnostic-ui.js'),'utf8');
const layer=fs.readFileSync(path.join(__dirname,'pressurization-oh22.js'),'utf8');
assert.ok(html.includes('pressurization-oh22-diagnostic-ui.js?v=OH22-DIAG-0001'));
assert.ok(html.includes('pressurization-oh22-diagnostic-ui.css?v=OH22-DIAG-0001'));
assert.ok(overhead.includes('pressurization-oh22-diagnostics.js?v=OH22-DIAG-0001'));
assert.ok(layer.includes('getDiagnosticSnapshot:()=>received'),'Read-only controller snapshot required');
assert.ok(consoleSource.includes('pressurization-diagnostics-request'),'Click must actually request a scan');
assert.ok(consoleSource.includes('JSON.stringify(last,null,2)'),'Audit must be exportable');
assert.ok(!consoleSource.includes('FAULT')&&!consoleSource.includes("'MODE'"),'Diagnostic must not actuate aircraft controls');
console.log('PASS: OH22 read-only diagnostics, CPCS photo issues, DCPCS separation, corruption detection and embedded UI wiring');
