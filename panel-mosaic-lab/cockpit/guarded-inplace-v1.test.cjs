'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const data=p=>JSON.parse(read(p));
const reg=data('panel-mosaic-lab/interactive-overhead/rotary-guards.json');
const extra=data('panel-mosaic-lab/interactive-overhead/lights-controls.json');
const blueprint=data('unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json');
const quiz=data('engine/maps/guarded-switch-owner-hinge-quiz-v1.json');
const layout=data('panel-mosaic-lab/all-overhead/atlas-layout.json');
const stage=read('panel-mosaic-lab/cockpit/overhead-stage.html');
const live=read('panel-mosaic-lab/cockpit/guarded-owner-v3.js');
const css=read('panel-mosaic-lab/cockpit/guarded-owner-v3.css');
const rotary=read('panel-mosaic-lab/interactive-overhead/rotary-guards.js');
const guards=[...reg.guards,...extra.guards];
test('exactly 13 placed, owner-confirmed controls; remaining 4 held pending their true native panel',()=>{
 assert.equal(guards.length,13);
 assert.equal(new Set(guards.map(g=>g.id)).size,13);
 assert.equal(quiz.summary.ownerConfirmed,17);
 const panels=new Set(layout.placements.map(x=>x.id));
 for(const g of guards){
   assert.ok(panels.has(g.placementId),g.id);
   assert.equal(g.ownerHinge,quiz.questions.find(x=>x.controlId===g.id).selection,g.id);
   assert.ok([2,3].includes(g.states.length),'small-silver two/three detents '+g.id);
   assert.equal(g.assetFamily,'owner-four-photo-master');
 }
 assert.deepEqual(blueprint.controls.filter(c=>!guards.some(g=>g.id===c.controlId)).map(g=>g.controlId).sort(),
 ['antiskid','gpws-flap-inhibit','gpws-gear-inhibit','gpws-terrain-inhibit'].sort());
});
test('all eight previous guard bitmap database entries are GONE; four photographic masters alone remain active',()=>{
 const expected=['owner-red-closed','owner-red-open','owner-black-closed','owner-black-open'];
 assert.deepEqual(Object.keys(reg.assets).filter(k=>k.startsWith('owner-')).sort(),expected.sort());
 assert.equal(Object.keys(reg.assets).filter(k=>/^(red|black)-/.test(k)).length,0);
 assert.equal(reg.guardVisualPolicy.activeMasterCount,4);
 for(const key of expected){
  const info=reg.assets[key],full=path.resolve(root,'panel-mosaic-lab/interactive-overhead',info.url);
  const bytes=fs.readFileSync(full);
  assert.equal(bytes.toString('ascii',0,4),'RIFF',key+' must be WebP');
  assert.ok(bytes.length>500,key+' not missing/empty');
 }
});
test('production overhead loads owner master; never rejected CSS overlay',()=>{
 assert.ok(stage.includes('guarded-owner-v3.js'));
 assert.ok(stage.includes('guarded-owner-v3.css'));
 assert.ok(!stage.includes('guarded-inplace-v1.js'));
 assert.ok(!stage.includes('guarded-inplace-v1.css'));
 assert.doesNotThrow(()=>new vm.Script(live));
 assert.ok(rotary.includes("'owner-'+c.color+'-'+(frame==='CLOSED'?'closed':'open')"));
 assert.ok(rotary.includes("if(c.presentation==='calibrated-horizontal-standby')"));
 assert.ok(css.includes('.g17-owner-image'));
});
test('true electrical engine remains source of 2/3-detent toggles and closed-cover gating',()=>{
 assert.ok(live.includes('originalCover.click()'));
 assert.ok(live.includes('originalSwitch.click()'));
 assert.ok(live.includes('actuator.disabled=!open'));
 assert.ok(live.includes("attributeFilter:['data-guard','data-value']"));
 assert.ok(live.includes("mounted.size===13"));
 assert.ok(live.includes("status.dataset.installed=String(mounted.size)"));
 assert.ok(css.includes('.g17-owner-silver-sprite'));
 assert.ok(live.includes('Small_Silver_5Positions.webp'));
});
test('red/black photo reference, owner hinge rotations, BUS Transfer left-handed width all locked',()=>{
 assert.equal(blueprint.controls.length,17);
 const bus=blueprint.controls.find(x=>x.controlId==='bus-transfer');
 assert.equal(bus.hingeDirection,'Left');
 assert.ok(bus.geometry.previewWidth>bus.geometry.previewHeight);
 assert.equal(reg.guards.find(x=>x.id==='bus-transfer').placementId,'OH12');
 assert.equal(reg.guards.find(x=>x.id==='bus-transfer').ownerHinge,'Left');
 assert.ok(css.includes('rotate(180deg)'));
 assert.ok(css.includes('rotate(-90deg)'));
 assert.ok(live.includes('resolved[color][open?'));
 for(const c of guards)assert.equal(c.ownerHinge,quiz.questions.find(x=>x.controlId===c.id).selection);
});