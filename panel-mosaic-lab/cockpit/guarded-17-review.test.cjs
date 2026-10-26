'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const source=p=>fs.readFileSync(path.join(root,p),'utf8');
const bp=JSON.parse(source('unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json'));
const quiz=JSON.parse(source('engine/maps/guarded-switch-owner-hinge-quiz-v1.json'));
const html=source('panel-mosaic-lab/cockpit/guarded-17-review.html');
const js=source('panel-mosaic-lab/cockpit/guarded-17-review.js');
const css=source('panel-mosaic-lab/cockpit/guarded-17-review.css');
const cockpit=source('panel-mosaic-lab/cockpit/index.html');
const launcher=source('panel-mosaic-lab/cockpit/guarded-17-unified.js');
const coords=x=>[x.geometry.previewWidth,x.geometry.previewHeight,x.geometry.previewThickness,x.geometry.previewCornerRadius];
test('17 owner-confirmed physical guard profiles are available in one Unified Cockpit dialog',()=>{
 assert.equal(bp.controls.length,17);
 assert.equal(quiz.summary.ownerConfirmed,17);
 assert.equal(quiz.summary.unanswered,0);
 assert.equal(new Set(bp.controls.map(x=>x.controlId)).size,17);
 assert.deepEqual(bp.controls.map(x=>x.controlId).sort(),quiz.questions.map(x=>x.controlId).sort());
 for(const c of bp.controls){
  const owner=quiz.questions.find(x=>x.controlId===c.controlId);
  assert.equal(c.hingeDirection,owner.selection,c.controlId);
  assert.equal(c.geometry.approvedDimensionsMm,null,'no invented aircraft dimensions');
  assert.equal(c.identityContract.meshRefSameOpenClosed,true);
  assert.equal(c.identityContract.materialRefSameOpenClosed,true);
  assert.equal(c.identityContract.scaleSameOpenClosed,true);
  assert.ok(c.switchAppearance.detentLabels.length>=2);
 }
 assert.ok(cockpit.includes('id="guarded17Open"'));
 assert.ok(cockpit.includes('id="guarded17Dialog"'));
 assert.ok(cockpit.includes('data-src="./guarded-17-review.html"'));
 assert.ok(cockpit.includes('guarded-17-unified.js'));
 assert.ok(cockpit.includes('guarded-17-unified.css'));
 assert.ok(html.includes('id="cards"'));
 assert.ok(js.includes('loaded.push(view)'));
 assert.ok(js.includes('BLUEPRINT='));
 assert.ok(js.includes('OWNER='));
});
test('Bus transfer exactly matches a 90-degree rotated passenger oxygen cover with LEFT hinge',()=>{
 const bus=bp.controls.find(x=>x.controlId==='bus-transfer');
 const oxy=bp.controls.find(x=>x.controlId==='passenger-oxygen');
 assert.equal(bus.hingeDirection,'Left');
 assert.equal(bus.geometry.contourProfile,'black-horizontal-oxygen-rotated-90');
 assert.equal(bus.geometry.previewWidth,oxy.geometry.previewHeight);
 assert.equal(bus.geometry.previewHeight,oxy.geometry.previewWidth);
 assert.equal(bus.material.swatchHex,oxy.material.swatchHex);
 assert.ok(bus.geometry.previewWidth>bus.geometry.previewHeight);
 assert.ok(js.includes('black-horizontal-oxygen-rotated-90'));
});
test('GPWS triple covers retain individual identities while sharing exactly one appearance family',()=>{
 const triplet=['gpws-flap-inhibit','gpws-gear-inhibit','gpws-terrain-inhibit'].map(id=>bp.controls.find(x=>x.controlId===id));
 assert.equal(new Set(triplet.map(x=>x.controlId)).size,3);
 assert.equal(new Set(triplet.map(x=>JSON.stringify([...coords(x),x.geometry.contourProfile,x.material.swatchHex,x.material.metallic,x.material.roughness]))).size,1);
 assert.ok(triplet.every(x=>x.hingeDirection==='Up'));
 assert.ok(triplet.every(x=>x.material.swatchHex==='#202125'));
 assert.equal(bp.controls.find(x=>x.controlId==='antiskid').material.swatchHex,'#202125');
});
test('Each guard pose changes ONLY fixed hinge rotation; identical CSS body in both states',()=>{
 assert.ok(css.includes('.guard-cover{'));
 for(const direction of ['up','down','left','right']){
  const regex=new RegExp('\\.mount-root\\.hinge-'+direction+' \\.guard-cover\\.open\\{([^}]+)\\}');
  const rule=css.match(regex);
  assert.ok(rule,direction+' open rule');
  assert.match(rule[1],/transform:rotate[XY]\(/);
  assert.doesNotMatch(rule[1],/width|height|background|border-radius|font|scale|clip-path|color/,direction);
 }
 assert.ok(js.includes("const closed=makePose(c,false,'CLOSED'),opened=makePose(c,true,'OPEN')"));
 assert.ok(js.includes("cover.classList.toggle('open',value)"));
 assert.ok(js.includes("if(profiles[g.contourProfile])cover.style.clipPath=profiles[g.contourProfile]"));
 assert.ok(js.includes("mount.append(cover,element('div','hinge-barrel'))"),'hinge does not rotate with lid');
 assert.equal(js.includes('Red_Guarded_CLOSED'),false);
 assert.equal(js.includes('Black_Guarded_CLOSED'),false);
});
test('Unified guarded lab controls and syntax are valid and non-destructive',()=>{
 assert.doesNotThrow(()=>new vm.Script(js,{filename:'guarded-17-review.js'}));
 assert.doesNotThrow(()=>new vm.Script(launcher,{filename:'guarded-17-unified.js'}));
 assert.ok(launcher.includes("dialog.showModal()"));
 assert.ok(launcher.includes("params.get('guarded17')==='1'"));
 assert.ok(js.includes("switchSpec.momentary"));
 assert.ok(js.includes("all.some(x=>x.isOpen())"));
 assert.ok(js.includes("button.disabled=!open"));
 assert.ok(html.includes('پیش‌نمایش هندسی'));
 assert.ok(html.includes('فرمانی به سیستم هواپیما نمی‌فرستند'));
});
