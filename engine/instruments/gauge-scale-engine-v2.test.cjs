const test = require('node:test');
const assert = require('node:assert/strict');
const {compile,bearing,stepRotation} = require('./gauge-scale-engine-v2.js');
const data = require('./gauge-survey-stage2-3.json');
const audit = require('./gauge-inventory-v1.json');
const src = {asset:'unchanged-panel.png',sha256:'a'.repeat(64),width:301,height:301};
const pivot={x:150,y:150};
const point=(value,angle,major=true)=>{
  const rad=angle*Math.PI/180,r=100;
  return {value,x:150+r*Math.sin(rad),y:150-r*Math.cos(rad),
    major, evidence:'measured_source_pixels'};
};
const spec = {
 id:'test.uneven',kind:'rotary',unit:'psi',source:src,pivot,
 min:0,max:100,direction:'clockwise',
 marks:[point(0,-130),point(10,-105),point(20,-90),point(50,-10),point(100,110)],
 status:'verified',review:{approved:true}
};
test('bearing uses native image up=0 right=90 down=180 left=-90',()=>{
 assert.equal(bearing(pivot,{x:150,y:50}),0);
 assert.equal(bearing(pivot,{x:250,y:150}),90);
 assert.equal(bearing(pivot,{x:150,y:250}),180);
 assert.equal(bearing(pivot,{x:50,y:150}),-90);
});
test('uneven ticks: every measured number hits its exact tick and min/max peg',()=>{
 const s=compile(spec);
 for(const m of s.marks) assert.ok(Math.abs(s.locate(m.value).angleDeg-m.angle)<1e-10);
 assert.ok(Math.abs(s.locate(15).angleDeg-(-97.5)) < 1e-8);
 assert.equal(s.locate(-5).status,'pegged');
 assert.equal(s.locate(500).angleDeg,s.marks.at(-1).angle);
 assert.equal(s.locate(500,{outOfRange:'reject'}).status,'out_of_range');
});
test('rotary crossing -180/+180 stays continuous clockwise and counterclockwise',()=>{
 const base={...spec,min:0,max:30,marks:[point(0,130),point(10,165),point(20,-165),point(30,-110)]};
 const s=compile(base);
 assert.ok(Math.abs(s.locate(20).angleDeg-195)<1e-9);
 const reverse={...base,direction:'counterclockwise',marks:[
 point(0,-110),point(10,-165),point(20,165),point(30,130)]};
 const t=compile(reverse);
 assert.ok(Math.abs(t.locate(20).angleDeg-(-195))<1e-9);
});
test('linear track interpolates physical position, not rotation',()=>{
 const s=compile({id:'trim',kind:'linear',unit:'units',source:src,min:-5,max:10,
 status:'verified',review:{approved:true}, marks:[
 {value:-5,x:20,y:40,evidence:'measured_source_pixels'},
 {value:0,x:20,y:150,evidence:'measured_source_pixels'},
 {value:10,x:35,y:250,evidence:'measured_source_pixels'}]});
 assert.deepEqual(s.locate(5).position,{x:27.5,y:200});
 assert.equal(s.locate(5).angleDeg,null);
});
test('multi-pointers must retain independently compiled modes',()=>{
 const outer=compile({...spec,id:'diff',unit:'psi'});
 const inner=compile({...spec,id:'alt',unit:'1000 ft',marks:[
 point(0,-100),point(10,-70),point(20,-30),point(50,30),point(100,80)]});
 assert.notEqual(inner.locate(40).angleDeg,outer.locate(40).angleDeg);
});
test('blocks fake verified image points, invalid sensors, unpowered signals',()=>{
 const s=compile({...spec,status:'draft'});
 assert.equal(s.read({value:20,valid:true,powered:true}).status,'blocked');
 assert.equal(s.read({value:20,valid:true,powered:true},{allowUnverifiedPreview:true}).status,'ok');
 const a=compile(spec);
 assert.equal(a.read({value:20,valid:false,powered:true}).status,'unavailable');
 assert.equal(a.read({value:20,valid:true,powered:false}).status,'unavailable');
 assert.equal(a.read({value:20,valid:true,powered:true}).angleDeg,-90);
 assert.throws(()=>compile({...spec,marks:spec.marks.map(x=>({...x,evidence:'unknown'}))}),/measured/);
 assert.throws(()=>compile({...spec,source:{...src,sha256:null}}),/source hash/);
 assert.throws(()=>compile({...spec,review:null}),/approval/);
});
test('refuses skipped or reversed ticks, disjoint coordinate domains',()=>{
 assert.throws(()=>compile({...spec,marks:[point(0,-100),point(5,100),point(100,110)]}),/unmeasured angular gap/);
 assert.throws(()=>compile({...spec,marks:[point(0,-100),point(-1,-80),point(100,-50)]}),/increasing/);
 assert.throws(()=>compile({...spec,marks:[{...point(0,-100),x:500},...spec.marks.slice(1)]}),/outside its source/);
});
test('finite signals only; slew rate limited without overshoot',()=>{
 const s=compile(spec);
 assert.throws(()=>s.locate(NaN),/finite/);
 assert.equal(stepRotation(0,90,0.5,60),30);
 assert.equal(stepRotation(50,45,0.2,40),45);
 assert.equal(stepRotation(50,40,0.2,25),45);
 assert.equal(stepRotation(null,25,0.1,30),25);
});
test('all 53 source-image faces are registered; none misrepresented as verified',()=>{
 assert.equal(data.faces.length,53);
 assert.equal(data.unresolvedCandidates.length,3);
 assert.equal(new Set(data.faces.map(x=>x.id)).size,53);
 assert.deepEqual(new Set(data.faces.map(x=>x.id)),new Set(audit.faceGroups.flatMap(x=>x.ids)));
 for (const f of data.faces) {
   assert.ok(f.source && f.scales.length);
   assert.equal(f.stage4.realReadingsEnabled,false);
   assert.ok(f.scales.every(s=>!s.published&&s.marks.length===0));
   assert.equal(f.stage2.rangeVerified,false);
   assert.equal(f.stage3.geometryVerified,false);
 }
 assert.equal(data.faces.filter(x=>x.pivot).length,19);
});

test('GEN DRIVE OIL TEMP 1/2 use independent user-confirmed RISE 0–30 and IN 60/80/120/160 labels',()=>{
 for(const id of ['oh.drive_oil.1','oh.drive_oil.2']){
   const face=data.faces.find(x=>x.id===id);
   assert.ok(face);
   assert.equal(face.scales.length,2);
   const rise=face.scales.find(x=>x.mode==='rise');
   const inlet=face.scales.find(x=>x.mode==='inlet');
   assert.deepEqual([rise.minimum,rise.maximum],[0,30]);
   assert.deepEqual(rise.printedNumericValues,[0,10,20,30]);
   assert.deepEqual([inlet.minimum,inlet.maximum],[60,160]);
   assert.deepEqual(inlet.printedNumericValues,[60,80,120,160]);
   assert.equal(face.stage2.userConfirmedRanges,true);
   assert.equal(face.stage3.geometryVerified,false);
   assert.equal(face.stage4.realReadingsEnabled,false);
   assert.equal(rise.marks.length,0);
   assert.equal(inlet.marks.length,0);
 }
});
