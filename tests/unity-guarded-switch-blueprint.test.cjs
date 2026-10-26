'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = p => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));
const source = read('engine/maps/guarded-switch-owner-hinge-quiz-v1.json');
const catalog = read('unity/Assets/B737Classic/GuardedSwitches/Resources/GuardedSwitchBlueprints.json');
const code = p => fs.readFileSync(path.join(root,'unity/Assets/B737Classic/GuardedSwitches',p),'utf8');
const vec = (x,y,z) => [x,y,z];
const rotate = (p,axis,angle) => {
 const rad = angle*Math.PI/180, c = Math.cos(rad), s=Math.sin(rad);
 const dot=axis.reduce((a,v,i)=>a+v*p[i],0);
 const cross=[axis[1]*p[2]-axis[2]*p[1],axis[2]*p[0]-axis[0]*p[2],axis[0]*p[1]-axis[1]*p[0]];
 return p.map((v,i)=>v*c+cross[i]*s+axis[i]*dot*(1-c));
};
const directionAxis = {Up:vec(-1,0,0),Down:vec(1,0,0),Left:vec(0,-1,0),Right:vec(0,1,0)};
const oppositeEdge = (dir,w,h) => ({Up:vec(0,-h,0),Down:vec(0,h,0),Left:vec(w,0,0),Right:vec(-w,0,0)})[dir];

test('17 unmodified owner-selected directions bind uniquely and accurately',()=>{
 assert.equal(source.summary.ownerConfirmed,17);
 assert.equal(source.summary.unanswered,0);
 assert.equal(catalog.controls.length,17);
 assert.equal(new Set(catalog.controls.map(x=>x.controlId)).size,17);
 for(const q of source.questions){
  const c=catalog.controls.find(x=>x.controlId===q.controlId);
  assert.ok(c,q.controlId);
  assert.equal(c.hingeDirection,q.selection,q.controlId);
  assert.ok(['Up','Down','Left','Right'].includes(c.hingeDirection));
  assert.ok(c.geometry.previewWidth>0&&c.geometry.previewHeight>0&&c.geometry.previewThickness>0);
  assert.equal(c.geometry.approvedDimensionsMm,null,'cannot fabricate physical millimetres');
  assert.equal(c.geometry.approval,'UNVERIFIED_DO_NOT_USE_AS_FACTORY_DIMENSIONS');
  assert.equal(c.identityContract.meshRefSameOpenClosed,true);
  assert.equal(c.identityContract.materialRefSameOpenClosed,true);
  assert.equal(c.identityContract.scaleSameOpenClosed,true);
  assert.equal(c.identityContract.oldGenericImageAllowed,false);
  assert.equal(c.identityContract.permittedPoseProperty,'HINGE_PIVOT_LOCAL_ROTATION_ONLY');
  assert.equal(c.material.sharedAcrossPoses,true);
  assert.match(c.material.materialIdentity, new RegExp(q.controlId+'-v1$'));
  assert.ok(c.motion.openAngleDegrees>0&&c.motion.openAngleDegrees<180);
 }
});

test('Direction semantics: free edge always swings towards viewer with fixed pivot, in three passes',()=>{
 for(let pass=1;pass<=3;pass++){
  for(const spec of catalog.controls){
   const {previewWidth:w,previewHeight:h}=spec.geometry;
   const a=directionAxis[spec.hingeDirection];
   const displaced=oppositeEdge(spec.hingeDirection,w,h);
   const p0=rotate(vec(0,0,0),a,spec.motion.openAngleDegrees);
   const p1=rotate(displaced,a,spec.motion.openAngleDegrees);
   assert.ok(p1[2] > .0001, spec.controlId+' opens toward viewer');
   assert.deepEqual(p0,[0,0,0],spec.controlId+' hinge anchored exactly');
   assert.ok(Math.abs(Math.hypot(...p1)-Math.hypot(...displaced))<1e-12,spec.controlId+' size invariant');
  }
 }
});

test('Source rectangles stay source-only, do not imply physical dimensions',()=>{
 let available=0;
 for(const c of catalog.controls){
  const p=c.sourceMount.sourceRectNativePx;
  if(!p)continue;
  available++;
  assert.equal(p.length,4);
  assert.ok(p[2]>0&&p[3]>0,c.controlId);
  assert.ok(c.sourceMount.panelSourceDimensionsPx[0]>=p[0]+p[2],c.controlId+' x');
  assert.ok(c.sourceMount.panelSourceDimensionsPx[1]>=p[1]+p[3],c.controlId+' y');
 }
 assert.equal(available,4);
});

test('Unity runtime renders the same cover mesh/material/scale in both poses',()=>{
 const view=code('Runtime/GuardSwitchView.cs');
 const factory=code('Runtime/GuardSwitchFactory.cs');
 const mesh=code('Runtime/GuardCoverMesh.cs');
 const editor=code('Editor/GuardedSwitchPrefabGenerator.cs');
 for(const assertion of ['_filter.sharedMesh == _lockedMesh','_renderer.sharedMaterial == _lockedMaterial',
                         '_lockedMaterial.color == _lockedColor','_cover.localScale == _lockedScale'])
  assert.ok(view.includes(assertion),assertion);
 assert.ok(view.includes('_pivot.localRotation = Quaternion.SlerpUnclamped'), 'pose only changes hinge pivot');
 assert.equal(view.includes('_renderer.material ='),false,'do not instantiate new materials per pose');
 assert.doesNotMatch(view, /_cover\.localScale\s*=(?!=)/,'do not rescale cover during animation');
 assert.ok(factory.includes('GuardCoverMesh.Create('),'independent cover mesh per guard');
 assert.ok(factory.includes('mf.sharedMesh = GuardCoverMesh.Create('));
 assert.ok(factory.includes('mr.sharedMaterial = lid'));
 assert.ok(mesh.includes('mesh.RecalculateBounds()'));
 assert.ok(editor.includes('PrefabUtility.SaveAsPrefabAsset'));
 assert.ok(editor.includes('if (AssetDatabase.LoadAssetAtPath<GameObject>(prefabPath) != null)'),'non destructive');
 assert.ok(editor.includes('AssetDatabase.CreateAsset(cover.sharedMesh, meshPath)'));
 assert.ok(!editor.includes('Red_Guarded_CLOSED.png'));
});

test('Unity prefab references rebind after loading; no fake certified size claims',()=>{
 const cat=code('Runtime/GuardBlueprintCatalog.cs'),view=code('Runtime/GuardSwitchView.cs');
 assert.ok(view.includes('[SerializeField] private GuardBlueprint _blueprint'));
 assert.ok(view.includes('private void Awake()'));
 assert.ok(view.includes('Initialize(_blueprint, _pivot, _cover, _filter, _renderer)'));
 assert.ok(cat.includes('17 owner-confirmed guarded controls'));
 assert.equal(catalog.approvalStatus,'PARAMETRIC_PREVIEW_ONLY');
 const special=catalog.controls.find(q=>q.controlId==='flight-recorder-test');
 assert.equal(special.hingeDirection,'Left');
 assert.equal(catalog.controls.find(q=>q.controlId==='alternate-flaps-master').hingeDirection,'Down');
 assert.equal(catalog.controls.find(q=>q.controlId==='standby-power').hingeDirection,'Left');
});
