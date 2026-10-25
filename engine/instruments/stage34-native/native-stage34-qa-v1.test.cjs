'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const manifest=require('./manifest-v1.json');
const files=manifest.groupFiles.map(x=>({entry:x,part:require('./'+x.path.split('/').pop())}));
const all=files.flatMap(x=>x.part.faces);
function wrapDifference(a,b){return Math.abs(((a-b+540)%360)-180)}
test('Source collection has exactly 54 distinct faces and every panel group',()=>{
  assert.equal(all.length,54);
  assert.equal(new Set(all.map(x=>x.id)).size,54);
  assert.equal(files.length,5);
  for(const {entry,part} of files){
    assert.equal(part.count,entry.faces);
    assert.equal(part.faces.length,entry.faces);
    assert.equal(part.review,'CANDIDATE_ONLY_NOT_SIGNED_OFF');
  }
});
test('Stage 3: source-image pixel coordinates, radial angles and non-release requirements',()=>{
 let rotary=0,linear=0,strokes=0,bands=0,long=0,short=0,mids=0,refs=0;
 for(const f of all){
   assert.equal(f.approved,false,f.id);
   assert.match(f.source.sha256,/^[0-9a-f]{64}$/i,f.id);
   const W=f.source.width,H=f.source.height;
   if(f.kind==='linear'){
     linear++;
     assert.equal(f.rotationPivot,null,f.id);
     assert.ok(Array.isArray(f.linearTickEndpoints),f.id);
     const x=f.lineTrackCandidate;
     const expectedAxis=(x.y1-x.y0)>(x.x1-x.x0)?'y':'x';
     assert.equal(f.linearTravelAxis,expectedAxis,f.id);
     for(const tick of f.linearTickEndpoints){
       assert.equal(tick.physicalTickApproved,false);
       assert.equal(tick.numericValue,null);
       assert.ok(tick.lengthPx>0);
       for(const point of [tick.strokePointA,tick.strokePointB]){
         assert.ok(point[0]>=0&&point[0]<W&&point[1]>=0&&point[1]<H,f.id);
       }
     }
     assert.ok(x.x0>=0&&x.x1<=W&&x.y0>=0&&x.y1<=H&&x.x1>x.x0&&x.y1>x.y0,f.id);
   }else{
     rotary++;
     assert.equal(f.pivotSelectedForLiveMotion,null,f.id);
     assert.equal(f.reviewState,'pixel_candidates_need_manual_image_qa',f.id);
     assert.ok(f.pivotInput.x>=0&&f.pivotInput.x<W&&f.pivotInput.y>=0&&f.pivotInput.y<H,f.id);
     for(const c of f.circleRimAlternatives){
       assert.ok(c.x>=0&&c.x<W&&c.y>=0&&c.y<H&&c.radius>0);
     }
     for(const s of f.scales){
       bands++;
       assert.equal(s.allPhysicalGraduationsCertified,false,f.id);
       assert.equal(s.majorMinorClassification,'length_only_angular_pixel_candidate',f.id);
       for(const a of s.referenceMatches){
         refs++;
         assert.equal(a.sourcePhotoApproved,false);
         assert.ok(['single_angle_candidate_not_approved','multiple_runs_ambiguous','no_white_radial_run'].includes(a.status));
       }
       for(const z of s.whiteRadialCandidates){
         strokes++;
         assert.equal(z.physicalTickApproved,false);
         assert.equal(z.numericValue,null);
         assert.equal(z.approved,false);
         assert.ok(z.lengthPx>=5);
         assert.ok(z.innerTip[0]>=0&&z.innerTip[0]<W);
         assert.ok(z.innerTip[1]>=0&&z.innerTip[1]<H);
         assert.ok(z.outerTip[0]>=0&&z.outerTip[0]<W);
         assert.ok(z.outerTip[1]>=0&&z.outerTip[1]<H);
         const ang=(Math.atan2(z.innerTip[0]-f.pivotInput.x,
                      f.pivotInput.y-z.innerTip[1])*180/Math.PI+360)%360;
         assert.ok(wrapDifference(ang,z.angleDeg)<.7,f.id+' '+ang+' vs '+z.angleDeg);
         if(z.lengthClassCandidate==='long')long++;
         else if(z.lengthClassCandidate==='short')short++;
         else if(z.lengthClassCandidate==='medium')mids++;
         else assert.fail('Unknown provisional physical stroke class');
       }
     }
   }
 }
 assert.deepEqual({rotary,linear,strokes,bands,long,short,refs},
  {rotary:49,linear:5,strokes:manifest.counts.candidateWhiteStrokes,
   bands:50,long:manifest.counts.candidateMajorLike,
   short:manifest.counts.candidateShortLike,refs:52});
 assert.equal(long+short+mids,strokes);
});
test('Stage 4: no spurious final pivot or false tick approval',()=>{
 assert.equal(manifest.approval.certifiedPivotCentres,0);
 assert.equal(manifest.approval.fullyCalibratedFaces,0);
 assert.equal(manifest.approval.liveNeedleBindingsChanged,false);
 const x=all.find(f=>f.id==='oh.cabin.diff_pressure_altitude');
 assert.deepEqual(x.scales.map(s=>s.mode),['cabinAltitude','diffPressure']);
 for(const name of ['fo.left_linear','fo.right_linear','ped.rudder_trim']){
   assert.equal(all.find(f=>f.id===name).rotationPivot,null);
 }
 const allBlank=['eng.egt.1','eng.egt.2','eng.n2.1','eng.n2.2'];
 for(const id of allBlank) assert.equal(all.find(f=>f.id===id).scales[0].hasPrintedDiscreteTickScale,false);
});
