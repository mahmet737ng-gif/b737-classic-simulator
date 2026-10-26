'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const read=x=>JSON.parse(fs.readFileSync(path.join(root,x),'utf8'));
const code=x=>fs.readFileSync(path.join(root,'unity/Assets/B737Classic/GuardedSwitches/',x),'utf8');
const catalog=read('unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json');
const fcom=read('engine/maps/guarded-switches-fcom-visual-audit-v1.json');
const owner=read('engine/maps/guarded-switch-owner-hinge-quiz-v1.json');
const ids=new Set(owner.questions.map(c=>c.controlId));

test('All 17 switches have an individual design and FCOM-sourced visual detent labels',()=>{
 assert.equal(catalog.controls.length,17);
 assert.equal(ids.size,17);
 assert.equal(new Set(catalog.controls.map(c=>c.controlId)).size,17);
 for(const c of catalog.controls){
  assert.ok(ids.has(c.controlId),c.controlId);
  const expected=fcom.controls.find(f=>f.id===c.controlId);
  const h=c.switchAppearance;
  assert.ok(h,c.controlId);
  assert.equal(h.sourceFcomFolio,expected.fcom.folio);
  assert.equal(h.designStage,'DRAFT_VISUAL_NOT_HARDWARE_CERTIFIED');
  assert.equal(h.dimensions,'RELATIVE_TO_GUARD_PREVIEW_NOT_MEASURED');
  assert.ok(h.family&&h.gripHex&&h.shaftHex&&h.ringHex&&h.faceHex);
  assert.ok(['vertical','horizontal'].includes(h.detentAxis));
  assert.equal(h.meshMaterialInvariant,true);
  assert.equal(h.transformOnlyAnimation,true);
  assert.ok(h.gripRelativeScale>0&&h.shaftRelativeScale>0);
  assert.ok(h.detentTiltDegrees>0);
  if(expected.documentedStates) assert.deepEqual(h.detentLabels,expected.documentedStates,c.controlId+' states');
  else assert.deepEqual(h.detentLabels,['REST','ACTUATE'],'generator drive actuation must not pretend to have stable detents');
  assert.ok(h.detentLabels.includes(h.initialState));
  assert.equal(h.momentary,!expected.documentedStates);
  assert.equal(c.hingeDirection,owner.questions.find(q=>q.controlId===c.controlId).selection);
 }
});
test('Three GPWS switches share the same exact visual geometry/material but are different objects',()=>{
 const x=catalog.controls.filter(c=>c.controlId.startsWith('gpws-')).map(c=>c.switchAppearance);
 assert.equal(x.length,3);
 const p=c=>JSON.stringify([c.family,c.actuatorType,c.detentAxis,c.shaftRelativeScale,
   c.gripRelativeScale,c.shaftLengthScale,c.faceHex,c.ringHex,c.shaftHex,c.gripHex,c.shaftMetallic,
   c.shaftRoughness,c.gripMetallic,c.gripRoughness,c.detentTiltDegrees]);
 assert.equal(new Set(x.map(p)).size,1);
 assert.deepEqual(x.map(q=>q.detentLabels[1]),['NORMAL','NORMAL','NORMAL']);
 assert.ok(x.every(q=>q.family==='gpws-mini-identical'));
});
test('ANTISKID black reflected-light guard and dark small actuator stay separate',()=>{
 const c=catalog.controls.find(c=>c.controlId==='antiskid');
 assert.equal(c.material.swatchHex,'#202125');
 assert.equal(c.switchAppearance.gripHex,'#171A1C');
 assert.match(c.material.colorSource,/BLACK_COVER/);
 assert.equal(c.switchAppearance.initialState,'ON');
 const p=catalog.controls.find(c=>c.controlId==='passenger-oxygen');
 assert.equal(p.material.swatchHex,'#242426');
});
test('Unity builds a real multi-component metal switch with a fixed skin during detent changes',()=>{
 const factory=code('Runtime/GuardSwitchFactory.cs');
 const shape=code('Runtime/GuardActuatorFactory.cs');
 const animator=code('Runtime/GuardActuatorView.cs');
 const parser=code('Runtime/GuardBlueprintCatalog.cs');
 assert.ok(factory.includes('GuardActuatorFactory.CreatePreview(spec, root.transform, view)'));
 assert.ok(!factory.includes('GameObject toggle = GameObject.CreatePrimitive(PrimitiveType.Capsule);'));
 for(const x of ['MountRing_Fixed','DarkRecess_Fixed','ShaftBearing_Fixed','TaperedSatinShaft',
                'LowerShoulderRing','GripFerrule','SwitchShaftPivot_DetentsOnly',
                'MomentaryPullReleaseButton','FlatKnurledSelectorCap','MiniMetalGrip'])
   assert.ok(shape.includes(x),x);
 for(const x of ['p.Key.sharedMesh!=p.Value','p.Key.sharedMaterial!=p.Value',
   'p.Value.color!=colorLock[p.Key]','p.Key.localScale!=p.Value',
   'shaftPivot.localRotation=Quaternion.RotateTowards','appearance.momentary',
   'releaseClock=.30f','guard.UnderlyingSwitchRequested+=OnOwnerRequest'])
   assert.ok(animator.includes(x),x);
 assert.ok(parser.includes('public GuardActuatorAppearance switchAppearance;'));
 assert.ok(parser.includes('actuator.momentary'));
 assert.ok(shape.includes('GuardPreviewClickTarget input=grip.AddComponent'));
});
test('Published standalone switch appearance lab has 17 dynamic cards and working state buttons',()=>{
 const html=fs.readFileSync(path.join(root,'unity/preview/switches.html'),'utf8');
 const js=html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
 assert.ok(js);
 assert.doesNotThrow(()=>new vm.Script(js,{filename:'unity/preview/switches.html'}));
 assert.ok(js.includes('data.controls.length!==17'));
 assert.ok(js.includes('a.detentLabels'));
 assert.ok(js.includes('plate.style.setProperty(\'--tilt\''));
 assert.ok(js.includes('a.momentary'));
 assert.ok(js.includes("reset"));
 assert.ok(!html.includes('Red_Guarded_CLOSED.png'));
 assert.ok(!html.includes('Black_Guarded_CLOSED.png'));
 assert.ok(html.includes('socket')&&html.includes('shaft-ring')&&html.includes('grip'));
});
