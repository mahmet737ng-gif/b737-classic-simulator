'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const html=fs.readFileSync(path.join(__dirname,'bus-transfer-guard-review.html'),'utf8');
const unified=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const bridge=fs.readFileSync(path.join(__dirname,'bus-transfer-guard-review.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'bus-transfer-guard-review.css'),'utf8');
const blueprint=JSON.parse(fs.readFileSync(path.join(root,'unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json'),'utf8'));
const quiz=JSON.parse(fs.readFileSync(path.join(root,'engine/maps/guarded-switch-owner-hinge-quiz-v1.json'),'utf8'));
const bus=blueprint.controls.find(c=>c.controlId==='bus-transfer');
const oxygen=blueprint.controls.find(c=>c.controlId==='passenger-oxygen');

test('Owner BUS TRANSFER is Passenger Oxygen shape rotated exactly 90 degrees in plan',()=>{
 assert.ok(bus&&oxygen);
 assert.equal(bus.hingeDirection,'Left');
 assert.equal(bus.hingeDirection,quiz.questions.find(x=>x.controlId==='bus-transfer').selection);
 assert.equal(bus.geometry.contourProfile,'black-horizontal-oxygen-rotated-90');
 assert.equal(bus.hardwareGrouping.rotationDegrees,90);
 assert.equal(bus.hardwareGrouping.sourceDesignControlId,'passenger-oxygen');
 assert.equal(bus.geometry.previewWidth,oxygen.geometry.previewHeight);
 assert.equal(bus.geometry.previewHeight,oxygen.geometry.previewWidth);
 assert.equal(bus.geometry.previewThickness,oxygen.geometry.previewThickness);
 assert.equal(bus.material.swatchHex,oxygen.material.swatchHex);
 assert.ok(bus.geometry.previewWidth>bus.geometry.previewHeight);
 assert.equal(bus.geometry.approvedDimensionsMm,null,'do not invent real size');
});

test('Unified keeps the original immutable overhead and exposes a review dialog instead of uncalibrated mounting',()=>{
 assert.ok(unified.includes('busTransferGuardReviewOpen'));
 assert.ok(unified.includes('busTransferGuardReviewDialog'));
 assert.ok(unified.includes('./bus-transfer-guard-review.html'));
 assert.ok(unified.includes('bus-transfer-guard-review.js'));
 assert.ok(unified.includes('bus-transfer-guard-review.css'));
 assert.ok(bridge.includes('new URLSearchParams(window.location.search).get(\'busTransferGuard\')'));
 assert.ok(bridge.includes('dialog.showModal()'));
 assert.ok(bridge.includes('dialog.close()'));
 assert.doesNotThrow(()=>new vm.Script(bridge));
 assert.ok(css.includes('.bus-transfer-guard-review-dialog'));
});
test('One cover identity in CLOSED/OPEN: same size, same color, only rotation around a left pivot',()=>{
 const main=html.match(/<style>([\s\S]*?)<\/style>/)[1];
 const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.ok(main.includes('.cover{'));
 assert.ok(main.includes('width:100%;height:100%'));
 assert.ok(main.includes('transform-origin:0% 50%'));
 assert.ok(main.includes('rotateY(-108deg)'));
 assert.ok(main.includes('background:linear-gradient(115deg'));
 assert.ok(main.includes('var(--case)'));
 assert.equal((html.match(/class="mount"/g)||[]).length,2);
 assert.equal((html.match(/class="cover/g)||[]).length,2);
 assert.equal((html.match(/class="hinge"/g)||[]).length,2);
 assert.equal(html.includes('Red_Guarded'),false);
 assert.equal(html.includes('Black_Guarded'),false);
 assert.ok(html.includes('OH12'));
});
