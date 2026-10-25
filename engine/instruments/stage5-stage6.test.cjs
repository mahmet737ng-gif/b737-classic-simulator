const test=require('node:test');
const assert=require('node:assert/strict');
const candidates=require('./stage5-numeric-scale-candidates-v1.json');
const {compile}=require('./stage5-scale-mapping-v1.js');
const fits=require('./stage6-needle-fit-candidates-v1.json');
const fit=require('./stage6-needle-fit-v1.js');
function get(id,mode){
 const face=candidates.faces.find(x=>x.id===id);
 assert.ok(face,'Missing face '+id);
 const scale=face.scales.find(x=>x.mode===mode);
 assert.ok(scale,id+'/'+mode);
 return {face,scale};
}
function mapped(id,mode,{kind=null}={}){
 const {face,scale}=get(id,mode);
 return compile({id,mode,kind:kind||scale.kind,unit:scale.unit,
  pivot:face.pivot,source:face.source,anchors:scale.anchors,
  increasingDirection:scale.kind==='rotary'?'clockwise':'increasing_y'});
}
test('Stage 5 registry covers 54 faces, 59 distinct physical scale modes and 7 photo-angle preview maps',()=>{
 assert.equal(candidates.faces.length,54);
 assert.equal(new Set(candidates.faces.map(f=>f.id)).size,54);
 assert.equal(candidates.counts.scaleModes,59);
 assert.equal(candidates.counts.scaleModesWithTwoPhotoAnchors,7);
 assert.equal(candidates.counts.anchoredPoints,52);
 assert.equal(candidates.counts.liveApprovedFaces,0);
 for(const f of candidates.faces){
  assert.equal(f.faceApproved,false);
  for(const s of f.scales){
   assert.equal(s.renderingEnabled,false);
   assert.equal(s.sourceImagesSignedOff,false);
   assert.equal(s.allMinorTicksNumbered,false);
  }
 }
});
test('All existing photo anchors compile as preview only, without changing hardware display',()=>{
 let maps=0;
 for(const f of candidates.faces)for(const s of f.scales.filter(s=>s.valuesReady)){
  const m=mapped(f.id,s.mode);
  assert.equal(m.approved,false);
  assert.equal(m.locate(s.anchors[0].value).status,'blocked');
  for(const anchor of s.anchors){
   const loc=m.locate(anchor.value,{preview:true});
   assert.equal(loc.status,'preview_unverified',f.id+'/'+s.mode);
   assert.ok(Math.abs((((loc.angleDeg-anchor.angleDeg+180)%360)+360)%360-180)<1e-5,f.id+'/'+s.mode);
  }
  maps++;
 }
 assert.equal(maps,7);
});
test('Piecewise CPS explicitly diverges from inappropriate full-arc linear formula',()=>{
 const m=mapped('oh.elec.cps','primary');
 const a=m.locate(410,{preview:true}).angleDeg;
 assert.ok(Math.abs(a-(m.locate(400,{preview:true}).angleDeg+
   m.locate(420,{preview:true}).angleDeg)/2)<1e-7);
 const fake=m.locate(0,{preview:true}).angleDeg+
  (410/420)*(m.locate(420,{preview:true}).angleDeg-m.locate(0,{preview:true}).angleDeg);
 assert.ok(Math.abs(a-fake)>10);
});
test('Cabin altitude uses ft source-photo piecewise preview, not airport universal zero',()=>{
 const m=mapped('oh.cabin.diff_pressure_altitude','cabinAltitude');
 for(const ft of [66,3260,3963]){
  const p=m.locate(ft,{preview:true});
  assert.equal(p.value,ft);
  assert.ok(Number.isFinite(p.angleDeg));
  assert.equal(p.certified,false);
 }
 const diff=mapped('oh.cabin.diff_pressure_altitude','diffPressure');
 assert.ok(Math.abs(diff.locate(0,{preview:true}).angleDeg-m.locate(0,{preview:true}).angleDeg)>1);
 assert.equal(m.locate(-1,{preview:true}).status,'out_of_range');
 assert.equal(m.locate(-1,{preview:true,outOfRange:'clamp'}).status,'pegged');
});
test('Incomplete, unlabeled and linear scales cannot silently invent a numerical sweep',()=>{
 const {face,scale}=get('fo.left_linear','linear');
 assert.equal(scale.valuesReady,false);
 assert.throws(()=>compile({id:face.id,mode:'linear',kind:'linear',unit:'unknown',source:face.source,
  increasingDirection:'increasing_y',anchors:scale.anchors}),/Two photo-number anchors/);
 const {face:e,scale:s}=get('eng.n2.1','primary');
 assert.equal(s.anchors.length,0);
 assert.throws(()=>compile({id:e.id,mode:s.mode,kind:'rotary',unit:'percent',pivot:e.pivot,
  source:e.source,anchors:s.anchors,increasingDirection:'clockwise'}),/Two photo-number anchors/);
});
test('Stage 6 identity and owner sprite locks remain unchanged',()=>{
 assert.equal(fits.counts.faces,54);
 assert.equal(fits.counts.registeredSprites,38);
 assert.equal(fits.counts.finalApprovedNeedleFits,0);
 assert.equal(fits.pointers.filter(p=>p.existingNeedleTipRadiusPx!==null).length,13);
 for(const p of fits.pointers){
  assert.equal(p.preservedSprite,true);
  assert.equal(p.changesToMountedGeometry,false);
  assert.equal(p.pivotApproved,false);
  assert.equal(p.offsetAngleCalibrationApproved,false);
  assert.equal(p.allTickTipReachApproved,false);
 }
 assert.equal(fits.pointers.find(p=>p.faceId==='capt.rmi'&&p.ownerSpriteId==='captRMI1').shapeLocked,true);
});
test('Native source needle radial geometry computes exact reach and 0/90 bearing',()=>{
 const p={x:506,y:235};
 const tick={x:506,y:99};
 const result=fit.fitSourceTick({pivot:p,photoTick:tick,needleTipRadiusPx:136,bearingDeg:0});
 assert.ok(Math.abs(result.tipDistancePx)<1e-8);
 assert.ok(Math.abs(result.radiusDifferencePx)<1e-8);
 assert.equal(result.approved,false);
 const r=fit.projectTip(p,136,90);
 assert.ok(Math.abs(r.x-642)<1e-7&&Math.abs(r.y-235)<1e-7);
});
test('Anisotropic image scaling never silently masquerades as a uniform sprite transform',()=>{
 const a=fit.nativeToMosaic({sourcePivot:{x:506,y:235},sourceSize:{width:1012,height:1555},
   placement:{x:10,y:20,w:506,h:777.5},angleDeg:90,needleTipRadiusPx:136});
 assert.equal(a.geometryStatus,'uniform_scale');
 assert.ok(Math.abs(a.pivot.x-263)<1e-7&&Math.abs(a.pivot.y-137.5)<1e-7);
 const b=fit.nativeToMosaic({sourcePivot:{x:506,y:235},sourceSize:{width:1012,height:1555},
   placement:{x:10,y:20,w:506,h:800},angleDeg:30,needleTipRadiusPx:136});
 assert.equal(b.geometryStatus,'anisotropic_affine_requires_renderer_alignment');
});
test('Sprite length and bearing offsets can be computed without editing locked drawings',()=>{
 const r=fit.calibrateSprite({spritePivot:{x:10,y:10},spriteTip:{x:10,y:0},
  sourcePivot:{x:100,y:100},sourcePhotoTick:{x:100,y:30},sourceBearingDeg:0});
 assert.equal(r.requiredUniformScale,7);
 assert.equal(r.requestedRotationDeg,0);
 assert.equal(r.approved,false);
});
