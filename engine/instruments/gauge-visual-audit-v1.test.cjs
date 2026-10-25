const assert=require('node:assert/strict');
const test=require('node:test');
const audit=require('./gauge-motion-visual-audit-v1.json');
const checkpoint=require('./photo-anchor-checkpoints-v1.json');
const {compile}=require('./gauge-scale-engine-v2.js');
const base=require('./gauge-inventory-v1.json');
const flat=base.faceGroups.flatMap(g=>g.ids);
test('Every installed face has one named kinematic profile and a source hash',()=>{
 assert.equal(audit.faces.length,53);
 assert.deepEqual(new Set(audit.faces.map(f=>f.id)),new Set(flat));
 for(const f of audit.faces){
   assert.match(f.sourceSha256,/^[a-f0-9]{64}$/i);
   assert.ok(f.movementType&&f.direction&&f.reason,f.id);
   assert.ok(Array.isArray(f.printedScales)&&f.printedScales.length,f.id);
   assert.equal(f.numericState,'NOT_CERTIFIED',f.id);
   assert.equal(f.geometryState,'NOT_CERTIFIED',f.id);
   assert.equal(f.printedRangeCandidate.approved,false);
 }
 assert.equal(audit.counts.directionalCandidates,44);
 assert.equal(audit.counts.approvedNumericCalibrations,0);
});
test('Special two-pointer, rotating card, bipolar and signed linear movements are not plain gauges',()=>{
 const at=id=>audit.faces.find(x=>x.id===id);
 assert.match(at('capt.rmi').movementType,/rotating_compass_card/);
 assert.match(at('fo.rmi').movementType,/two_bearing_pointers/);
 assert.match(at('fo.flap_position').movementType,/two_independent_pointers/);
 assert.match(at('oh.duct.pressure_lr').movementType,/two_independent_pointers/);
 assert.match(at('oh.cabin.diff_pressure_altitude').movementType,/two_independent_pointers_two_scales/);
 assert.match(at('oh.drive_oil.1').movementType,/selector_two_angular_scales/);
 assert.match(at('oh.cabin.rate').movementType,/signed_bidirectional/);
 assert.match(at('capt.vertical_speed').movementType,/signed_bidirectional/);
 assert.match(at('fo.outer_vertical_speed').movementType,/signed_bidirectional/);
 assert.match(at('ped.rudder_trim').movementType,/signed_linear/);
 assert.match(at('capt.airspeed').movementType,/nonlinear_airspeed/);
 assert.match(at('eng.fuel_flow.1').movementType,/dual_mode/);
 assert.match(at('capt.clock').movementType,/multi_hand_clock/);
});
function make(p){
 const marks=p.marks.map(m=>({...m}));
 return compile({id:p.id,kind:'rotary',unit:p.unit,source:{
  asset:p.source,sha256:p.sha256,width:p.imageSize[0],height:p.imageSize[1]},
  pivot:{x:p.pivot.x,y:p.pivot.y},direction:'clockwise',
  marks,min:marks[0].value,max:marks.at(-1).value,
  status:'draft'});
}
test('Photo checkpoints lie in their native images; angle data agree with geometry',()=>{
 let count=0;
 for(const p of checkpoint.gauges) {
   assert.equal(p.approved,false);
   for(const m of p.marks) {
     assert.ok(m.x>=0&&m.x<p.imageSize[0]&&m.y>=0&&m.y<p.imageSize[1],p.id);
     assert.equal(m.evidence,'automatic_white_radial_line_candidate_not_signed_off');
     let angle=Math.atan2(m.x-p.pivot.x,p.pivot.y-m.y)*180/Math.PI;
     assert.ok(Math.abs(angle-m.detectedAngle)<.2,p.id+': '+m.value);
     count++;
   }
 }
 assert.equal(count,28);
});
test('Candidate-only scale engine simulates tick exactness without authorizing aircraft values',()=>{
 for(const p of checkpoint.gauges.filter(p=>p.id!=='oh.cabin.temperature')) {
   const gauge=make(p);
   for(const mark of gauge.marks){
     const result=gauge.locate(mark.value);
     assert.ok(Math.abs(result.angleDeg-mark.angle)<1e-7,p.id+' '+mark.value);
   }
   assert.equal(gauge.read({value:p.marks[0].value,valid:true,powered:true}).status,'blocked');
 }
});
test('CPS photo spacing is nonlinear and changes 410 reading dramatically from linear mapping',()=>{
 const p=checkpoint.gauges.find(x=>x.id==='oh.elec.cps');
 const s=make(p);
 const a400=s.locate(400).angleDeg;
 const a420=s.locate(420).angleDeg;
 const a410=s.locate(410).angleDeg;
 assert.ok(Math.abs(a410-(a400+a420)/2)<1e-7);
 const linear=s.locate(0).angleDeg+410/420*(a420-s.locate(0).angleDeg);
 assert.ok(Math.abs(a410-linear)>10);
});
test('Differential pressure wraps across ±180 yet progresses clockwise 0–10',()=>{
 const p=checkpoint.gauges.find(x=>x.id.includes('diff_pressure_altitude.outer'));
 const s=make(p);
 assert.ok(s.locate(6).angleDeg>180);
 assert.ok(s.locate(10).angleDeg>300);
 assert.ok(s.locate(8).angleDeg>s.locate(7).angleDeg);
});
test('Incomplete cabin temperature photograph refuses to bridge 40–80 unmeasured 60 region',()=>{
 const p=checkpoint.gauges.find(x=>x.id==='oh.cabin.temperature');
 assert.deepEqual(p.marks.map(x=>x.value),[0,20,40,80,100]);
 assert.throws(()=>make(p),/unmeasured angular gap/);
});
test('Photo anchors cannot be upgraded to verified merely by changing flag',()=>{
 const p=checkpoint.gauges.find(x=>x.id==='oh.duct.pressure_lr');
 const marks=p.marks.map(m=>({...m}));
 assert.throws(()=>compile({id:p.id,kind:'rotary',unit:p.unit,source:{
 asset:p.source,sha256:p.sha256,width:p.imageSize[0],height:p.imageSize[1]},
 pivot:{x:p.pivot.x,y:p.pivot.y},direction:'clockwise',
 marks,min:0,max:100,status:'verified',review:{approved:true}}),/measured marks/);
});
