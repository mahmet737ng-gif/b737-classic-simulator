'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const parse=p=>JSON.parse(read(p));
const js=read('panel-mosaic-lab/cockpit/guarded-inplace-v1.js');
const css=read('panel-mosaic-lab/cockpit/guarded-inplace-v1.css');
const stage=read('panel-mosaic-lab/cockpit/overhead-stage.html');
const cockpit=read('panel-mosaic-lab/cockpit/index.html');
const bp=parse('unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json');
const quiz=parse('engine/maps/guarded-switch-owner-hinge-quiz-v1.json');
const base=parse('panel-mosaic-lab/interactive-overhead/rotary-guards.json');
const extra=parse('panel-mosaic-lab/interactive-overhead/lights-controls.json');
const layout=parse('panel-mosaic-lab/all-overhead/atlas-layout.json');
const guards=[...base.guards,...extra.guards],bpById=new Map(bp.controls.map(c=>[c.controlId,c]));

test('Mount all 12 already anchored overhead guards on existing native source positions without inventing the other five',()=>{
 assert.equal(guards.length,12);
 assert.equal(new Set(guards.map(x=>x.id)).size,12);
 assert.equal(quiz.summary.ownerConfirmed,17);
 const panels=new Set(layout.placements.map(x=>x.id));
 for(const g of guards){
  const c=bpById.get(g.id);
  assert.ok(c,g.id);
  assert.ok(panels.has(g.placementId),g.id+' panel');
  assert.deepEqual(c.hingeDirection,quiz.questions.find(q=>q.controlId===g.id).selection);
  assert.equal(c.geometry.approvedDimensionsMm,null);
  if(g.mountingRectSource)assert.equal(g.mountingRectSource.length,4);
 }
 const missing=bp.controls.filter(c=>!guards.some(g=>g.id===c.controlId));
 assert.equal(missing.length,5);
 assert.deepEqual(missing.map(x=>x.controlId).sort(),
  ['bus-transfer','antiskid','gpws-flap-inhibit','gpws-gear-inhibit','gpws-terrain-inhibit'].sort());
 assert.match(js,/pending\.length===5/);
 assert.match(js,/pending\.map\(p=>p\.displayName\)/); 
});
test('Retain legacy visual states through engine delegates rather than alternative logic or changed atlases',()=>{
 assert.ok(js.includes("node.querySelector('.guard-hit.guard-cover, .recorder-hinge-cover')"));
 assert.ok(js.includes("node.querySelector('.guard-hit.guard-lever, .recorder-hinge-lever')"));
 assert.ok(js.includes("legacyCover.click()"));
 assert.ok(js.includes("legacyLever.click()"));
 assert.ok(js.includes("attributeFilter:['data-guard','data-value']"));
 assert.ok(js.includes("root.dataset.open=String(isOpen)"));
 assert.ok(js.includes("grip.disabled=!isOpen"));
 assert.ok(stage.includes('guarded-inplace-v1.js'));
 assert.ok(stage.includes('guarded-inplace-v1.css'));
 assert.ok(cockpit.includes('id="guarded17Open"'));
 assert.ok(!js.includes('oldSprites'));
});
test('Correct visual hardware for owner-approved directions, black antiskid, three identical GPWS, rotated BUS TRANSFER',()=>{
 assert.equal(bpById.get('bus-transfer').hingeDirection,'Left');
 assert.ok(bpById.get('bus-transfer').geometry.previewWidth>bpById.get('bus-transfer').geometry.previewHeight);
 assert.equal(bpById.get('antiskid').material.swatchHex,'#202125');
 const triple=['gpws-flap-inhibit','gpws-gear-inhibit','gpws-terrain-inhibit'].map(x=>bpById.get(x));
 assert.ok(triple.every(x=>x.hingeDirection==='Up'));
 const shape=x=>JSON.stringify([x.geometry.previewWidth,x.geometry.previewHeight,x.geometry.previewThickness,x.geometry.contourProfile,x.material.swatchHex]);
 assert.equal(new Set(triple.map(shape)).size,1);
 assert.match(js,/ownerHinge/);
});
test('Open and closed poses are rotations of the SAME cover: no shape/size/material swaps',()=>{
 assert.doesNotThrow(()=>new vm.Script(js,{filename:'guarded-inplace-v1.js'}));
 assert.ok(css.includes('.g17-native-cover{'));
 for(const direction of ['up','down','left','right']){
  const regexp=new RegExp('\\.g17-native-hardware\\[data-hinge='+direction+'\\]\\[data-open=true\\] \\.g17-native-hinge-pivot\\{([^}]+)\\}');
  const rule=css.match(regexp);
  assert.ok(rule,direction+' missing motion');
  assert.match(rule[1],/transform:rotate[XY]\(/);
  assert.doesNotMatch(rule[1],/background|color|width|height|scale|border-radius|clip-path/);
 }
 assert.match(css,/var\(--g17-base/);
 assert.ok(js.includes("pivot.append(lid)"));
 assert.ok(js.includes("root.style.setProperty('--g17-base',c.material.swatchHex)"));
 assert.ok(js.includes("node.append(root)"));
 assert.ok(!js.includes('Red_Guarded_'));
 assert.ok(!js.includes('Black_Guarded_'));
});
test('Frozen images remain locked and the new overlay is separate from existing rotary, lights and hardware engines',()=>{
 assert.equal(stage.includes('../all-overhead/style.css'),false);
 assert.ok(stage.includes('./style.css?v=UPD-0012-OVH-measured-seams'));
 assert.ok(stage.includes('../interactive-overhead/rotary-guards.js'));
 assert.ok(stage.includes('../cockpit/guarded-inplace-v1.js'));
 assert.ok(css.includes('#rotaryGuardLayer .guard-node.g17-native-upgraded > .guard-picture'));
 assert.ok(js.includes("document.getElementById('atlasAbsolute')"));
 assert.equal(js.includes('fetch("/api/'),false);
});
