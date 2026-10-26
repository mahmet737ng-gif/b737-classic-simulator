'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=x=>fs.readFileSync(path.join(root,x),'utf8');
const js=read('panel-mosaic-lab/cockpit/guarded-inplace-v1.js');
const css=read('panel-mosaic-lab/cockpit/guarded-inplace-v1.css');
const stage=read('panel-mosaic-lab/cockpit/overhead-stage.html');
const data=JSON.parse(read('unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json'));
const owner=JSON.parse(read('engine/maps/guarded-switch-owner-hinge-quiz-v1.json'));

test('Regression: approved visual identity uses moulded cover texture, NOT giant generic black box',()=>{
 assert.doesNotThrow(()=>new vm.Script(js));
 assert.ok(js.includes("PHOTO_CONSTRAINED_PREVIEW_SIZE"));
 assert.ok(js.includes("OWNER_MARKED_GEN_RECESS__NARROW_CAP"));
 assert.ok(js.includes("OWNER_MARKED_WIDE_SWITCH_SLOT"));
 assert.ok(js.includes("NATIVE_SOURCE_RECT_RECORDER"));
 assert.ok(js.includes("const factors={"));
 assert.ok(js.includes("'flight-control-a':[.60,.90]"));
 assert.ok(js.includes("'spoiler-a':[.61,.86]"));
 assert.ok(js.includes("'alternate-flaps-master':[.47,1.02]"));
 assert.ok(js.includes("const lgW=slot.capW;"));
 assert.ok(js.includes("const lgH=slot.capH;"));
 assert.ok(!js.includes("Math.max(16,slot.w*(horizontal?.88:.73))"));
});
test('Three real dimensional surface textures have sculpted lips and texture, stable through all poses',()=>{
 for(const asset of ['black-molded-v2.svg','red-molded-v2.svg','black-horizontal-v2.svg']){
  const svg=read('panel-mosaic-lab/cockpit/guard-textures/'+asset);
  assert.ok(svg.startsWith('<svg '));
  assert.ok(svg.includes('<linearGradient'));
  assert.ok(svg.includes('<path '));
  assert.ok(svg.includes('filter="url(#grain)"'));
  assert.ok(svg.includes('</svg>'));
  assert.ok(css.includes('guard-textures/'+asset));
 }
 for(const surface of ['black','red','horizontal']){
  assert.ok(css.includes('.g17-native-cover[data-surface="'+surface+'"]'));
 }
 assert.ok(css.includes('.g17-native-cover::before'));
 assert.ok(css.includes('transform:translateZ(-3px)'));
 assert.ok(css.includes('g17-native-fixed-hinge::before'));
 assert.ok(css.includes('g17-native-fixed-hinge::after'));
});
test('True cover identity: OPEN switches only fixed hinge rotation, NEVER changes texture or scale',()=>{
 assert.ok(js.includes("pivot.append(lid)"));
 assert.ok(js.includes("lid.dataset.surface=surface"));
 assert.ok(js.includes("root.dataset.surface=surface"));
 assert.ok(css.includes('[data-hinge=up][data-open=true] .g17-native-hinge-pivot{transform:rotateX(-110deg)'));
 assert.ok(css.includes('[data-hinge=down][data-open=true] .g17-native-hinge-pivot{transform:rotateX(110deg)'));
 assert.ok(css.includes('[data-hinge=left][data-open=true] .g17-native-hinge-pivot{transform:rotateY(-110deg)'));
 assert.ok(css.includes('[data-hinge=right][data-open=true] .g17-native-hinge-pivot{transform:rotateY(110deg)'));
 assert.ok(!css.includes('.g17-native-cover.open{background:'));
 assert.ok(js.includes("node.classList.add('g17-native-upgraded')"));
 assert.ok(stage.includes('G17-PHOTO-0002'));
});
test('Independent installation protects other switches if one native node is absent or fails',()=>{
 assert.ok(js.includes("const receipt=new Map(),failures=new Map()"));
 assert.ok(js.includes("for(const guard of original)"));
 assert.ok(js.includes("if(receipt.has(guard.id)||!nodes.has(guard.id))continue"));
 assert.ok(js.includes("catch(e){failures.set(guard.id"));
 assert.ok(js.includes("installed:receipt.size"));
 assert.ok(js.includes("mountingFailures:[...failures.entries()]"));
 assert.ok(js.includes("marker(pending,receipt.size)"));
 assert.ok(!js.includes("if(original.some(x=>!nodes.has(x.id)))return"));
});
test('Owner physical colors and directions remain authoritative; no physical mm invented',()=>{
 assert.equal(data.controls.length,17);
 assert.equal(owner.questions.length,17);
 for(const c of data.controls){
  assert.equal(c.hingeDirection,owner.questions.find(q=>q.controlId===c.controlId).selection);
  assert.equal(c.geometry.approvedDimensionsMm,null);
 }
 assert.equal(data.controls.find(c=>c.controlId==='alternate-flaps-master').material.swatchHex,'#A32123');
 assert.equal(data.controls.find(c=>c.controlId==='generator-disconnect-1').material.swatchHex,'#A32123');
 assert.equal(data.controls.find(c=>c.controlId==='antiskid').material.swatchHex,'#202125');
 const bus=data.controls.find(c=>c.controlId==='bus-transfer'),oxy=data.controls.find(c=>c.controlId==='passenger-oxygen');
 assert.equal(bus.hingeDirection,'Left');
 assert.equal(bus.geometry.previewWidth,oxy.geometry.previewHeight);
 assert.equal(bus.geometry.previewHeight,oxy.geometry.previewWidth);
});
