'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const registry=JSON.parse(read('panel-mosaic-lab/interactive-overhead/rotary-guards.json'));
const extra=JSON.parse(read('panel-mosaic-lab/interactive-overhead/lights-controls.json'));
const blueprint=JSON.parse(read('unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json'));
const owner=JSON.parse(read('engine/maps/guarded-switch-owner-hinge-quiz-v1.json'));
const js=read('panel-mosaic-lab/cockpit/guarded-owner-v3.js'),css=read('panel-mosaic-lab/cockpit/guarded-owner-v3.css');
test('exactly four approved RED/BLACK poses, no active old synthetic guard paths',()=>{
 assert.equal(registry.guardVisualPolicy.activeMasterCount,4);
 for(const key of ['owner-red-closed','owner-red-open','owner-black-closed','owner-black-open']){
  const asset=registry.assets[key];assert.ok(asset,'Missing '+key);
  assert.match(asset.url,/guard-owner-v3\/(red|black)-(closed|open)\.webp$/);
  assert.ok(fs.statSync(path.resolve(root,'panel-mosaic-lab/interactive-overhead',asset.url)).size>500);
 }
 assert.equal(Object.keys(registry.assets).filter(x=>/^(black|red)-/.test(x)).length,0);
 assert.equal(registry.guardVisualPolicy.retiredVisualKeys.length,8);
});
test('hinges are controlled by owner 17 answers; one fixed rotation maps both open and closed photos',()=>{
 assert.equal(owner.questions.length,17);assert.equal(blueprint.controls.length,17);
 for(const c of blueprint.controls)assert.equal(c.hingeDirection,owner.questions.find(x=>x.controlId===c.controlId).selection);
 assert.match(css,/data-hinge=down/);assert.match(css,/rotate\(180deg\)/);
 assert.match(css,/data-hinge=left/);assert.match(css,/rotate\(-90deg\)/);
 assert.match(js,/lid\.src=resolved\[color\]\[open\?'open':'closed'\]/);
});
test('no SVG guard backgrounds are used by owner production photographs',()=>{
 assert.ok(!js.includes('guard-textures/'));assert.ok(!css.includes('guard-textures/'));
 assert.match(css,/\.g17-owner-image/);
 assert.match(css,/visibility:hidden!important/);
 assert.match(js,/node\.classList\.add\('g17-owner-upgraded'\)/);
});
test('BUS TRANSFER horizontal/left; recorder left, oxygen down, 2/3 stops respect native engine',()=>{
 for(const [id,hinge] of [['bus-transfer','Left'],['flight-recorder-test','Left'],['passenger-oxygen','Down']]){
  const c=blueprint.controls.find(x=>x.controlId===id);assert.equal(c.hingeDirection,hinge);
 }
 const all=[...registry.guards,...extra.guards];assert.equal(all.length,13);
 for(const c of all)assert.ok([2,3].includes(c.states.length));
 assert.ok(js.includes('originalSwitch.click()'));assert.ok(js.includes('originalCover.click()'));
 assert.ok(js.includes("actuator.disabled=!open"));
});
