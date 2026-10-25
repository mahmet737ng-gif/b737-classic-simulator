/* OH19 non-invasive PHOTO QA. All coordinates are candidates. Never render or
 * approve cockpit needles from this audit. Node CommonJS, no side effects. */
'use strict';
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const error=(condition,message)=>{if(!condition)throw Error('OH19 pixel QA: '+message);};
const norm=a=>((a%360)+360)%360;
const angularDelta=(a,b)=>Math.abs(((a-b+540)%360)-180);
function build({ticks,photo,preview}){
 error(ticks?.schema==='b737.native-photo-tick-extraction.oh19.batch1','native tick ledger required');
 error(photo?.schema==='b737.oh19.cabin-altitude-photo-anchors.v1','CAB ALT photo map required');
 error(preview?.schema==='b737.stage10.candidate-calibration-subset.v1','Stage10 preview scale required');
 const cal=preview.calibrations?.['oh.cabin.diff_pressure_altitude:cabinAltitude'];
 error(cal?.source?.sha256===ticks.source.sha256&&
       photo.sourceSha256===ticks.source.sha256,'original source SHA disagreement');
 error(photo.source===ticks.source.asset&&cal.source.asset===photo.source,'original source path disagreement');
 error(photo.sourceDimensions[0]===ticks.source.width&&
       photo.sourceDimensions[1]===ticks.source.height&&
       cal.source.width===ticks.source.width&&
       cal.source.height===ticks.source.height,'original image dimensions changed');
 const pivot=ticks.commonPivot;
 error(pivot.x===photo.pivot.x&&pivot.y===photo.pivot.y&&
       pivot.x===cal.pivot.x&&pivot.y===cal.pivot.y,'candidate centre disagreement');
 error(!ticks.scaleCalibrationApproved&&!photo.review.productionApproved&&
       !photo.review.pivotApproved&&!photo.review.minorTickSequenceVerified&&
       !cal.approval.shaftPivotPhotoReviewed&&
       !cal.approval.allNativeTicksReviewed,'unexpected production approval');
 const inner=ticks.scales.find(s=>s.mode==='cabinAltitude');
 const outer=ticks.scales.find(s=>s.mode==='diffPressure');
 error(inner&&outer&&inner.allVisibleTickCandidates.length===47&&
       outer.allVisibleTickCandidates.length===51,'47 inner / 51 outer candidates required');
 const anchorByAngle=new Map(photo.marks.map(m=>[m.angleDeg,m]));
 error(photo.marks.length===15&&cal.anchors.length===15,'15 photo anchor contract changed');
 const seen=new Set();
 function inspect(scale,expectedMin,expectedMax){
  return scale.allVisibleTickCandidates.map((t,i)=>{
   error(t.index===i&&finite(t.angleDeg)&&finite(t.innerRadiusPx)&&
     finite(t.tipCandidate?.x)&&finite(t.tipCandidate?.y),'invalid tick '+scale.mode+':'+i);
   error(t.calibrationApproved===false,'prohibited certification '+scale.mode+':'+i);
   const dx=t.tipCandidate.x-pivot.x,dy=t.tipCandidate.y-pivot.y;
   const radius=Math.hypot(dx,dy);
   const bearing=norm(Math.atan2(dx,-dy)*180/Math.PI);
   const radiusError=radius-t.innerRadiusPx;
   const angleError=angularDelta(bearing,norm(t.angleDeg));
   error(Math.abs(radiusError)<=0.025&&angleError<=0.025,
     'reconstructed tip disagrees with candidate radius/angle '+scale.mode+':'+i);
   error(t.tipCandidate.x>=0&&t.tipCandidate.x<ticks.source.width&&
         t.tipCandidate.y>=0&&t.tipCandidate.y<ticks.source.height,
      'source pixel candidate outside original image');
   error(radius>=expectedMin&&radius<=expectedMax,'scale ring mismatch '+scale.mode+':'+i);
   return {index:i,angleDeg:t.angleDeg,radiusPx:t.innerRadiusPx,
     point:{...t.tipCandidate},detectorSupport:'PREVIOUS_SOURCE_IMAGE_CANDIDATE_NOT_INDEPENDENTLY_REMEASURED',
     printedLabel:t.labelOrigin==='printed_major',
     radiusResidualPx:Number(radiusError.toFixed(4)),
     bearingResidualDeg:Number(angleError.toFixed(4)),
     numericValueApproved:false,physicalTipApproved:false};
  });
 }
 const innerPoints=inspect(inner,110,140),outerPoints=inspect(outer,200,245);
 const innerClassified=innerPoints.map((t,i)=>{
  const anchor=photo.marks.find(a=>Math.abs(a.angleDeg-t.angleDeg)<=.015);
  const classification=anchor?(anchor.valueFt<=3000?'VISUAL_0_TO_3K_CANDIDATE':'PRINTED_MAJOR_CANDIDATE'):
      'UNKNOWN_MINOR_VALUE';
  if(anchor){error(cal.anchors.some(a=>a.value===anchor.valueFt&&
    Math.abs(a.angleDeg-anchor.angleDeg)<1e-8),'preview scale mismatches anchor');
    error(!seen.has(anchor.valueFt),'duplicate photo anchor');seen.add(anchor.valueFt);}
  return {...t,class:classification,anchorPreviewValueFt:anchor?.valueFt??null,
    // The old interpolated labels, e.g. 4400, 5800, 15833, are NOT facts.
    // Never expose them as calibration values or authorize a physical needle.
    shouldIgnoreInferredLegacyValue:classification==='UNKNOWN_MINOR_VALUE'};
 });
 error(seen.size===15,'unmatched CAB ALT photo anchor(s)');
 error(innerClassified.filter(t=>t.class==='UNKNOWN_MINOR_VALUE').length===32,
    'unresolved-value count changed');
 error(innerClassified.filter(t=>t.class==='VISUAL_0_TO_3K_CANDIDATE').length===7,
    '0-3k candidate minor sequence changed');
 error(innerClassified.filter(t=>t.class==='PRINTED_MAJOR_CANDIDATE').length===8,
    'higher major candidate count changed');
 error(outerPoints.every(t=>!t.numericValueApproved),'outer PRESS marks must remain unapproved');
 return {
  schema:'b737.oh19.pixel-evidence-review.v2',
  source:{asset:ticks.source.asset,sha256:ticks.source.sha256,
    width:ticks.source.width,height:ticks.source.height},
  pivotCandidate:{x:pivot.x,y:pivot.y,certified:false,
     confidence:'OPTICAL_ESTIMATE_NO_INDEPENDENT_SHAFT_PROOF'},
  counts:{inner:47,outer:51,innerPreviewAnchors:15,
     inner0To3kCandidates:7,innerHigherMajorCandidates:8,
     innerUnclassifiedMinorValues:32,operationalApproved:0},
  releaseState:'BLOCKED_PIXEL_SHAFT_AND_EVERY_MINOR_TICK_VALUE_PENDING',
  sourceImageInspectedThisRun:false,
  originalArtworkModified:false,
  inner:innerClassified,outer:outerPoints
 };
}
module.exports=Object.freeze({build,angularDelta,norm});
