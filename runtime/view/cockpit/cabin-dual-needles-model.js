(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737CabinDualNeedlesModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Coordinates belong to the immutable OH19 source image, not the atlas view.
 const source=Object.freeze({piece:'OH19-DIFF',width:1267,height:1241});
 const pivot=Object.freeze({x:489,y:365});
 // These are independent visually reviewed OH19 INNER long-tick bearings.
 // Still PRELIMINARY: intermediate marks, pivot subpixel and tip-to-inner-tick
 // contacts have not been signed off. Separate from outer PRESS mapping.
 const cabinAltPhotoAnchors=Object.freeze([
  [0,2.71],[500,13.59],[1000,22.37],[1500,31.32],[2000,40.34],[2500,50.2],[3000,59.98],[10000,108.64],[15000,155.65],
  [20000,200.55],[25000,236.57],[30000,262.03],[35000,284.48],
  [40000,304.18],[50000,327.37]
 ].map(([valueFt,bearingDeg])=>Object.freeze({valueFt,bearingDeg})));
 // Outer PSI numerals read from original OH19 face. This registration is
 // native-photo CANDIDATE, not a certified spindle/tick fit. Distinct from
 // the existing stage10 Hough candidate angles (disagreements are audited).
 const pressurePhotoAnchors=Object.freeze([
  [0,1.50],[1,32.49],[2,64.21],[3,96.06],[4,127.30],
  [5,159.47],[6,193.57],[7,225.42],[8,256.99],
  [9,290.23],[10,322.05]
 ].map(([valuePsid,bearingDeg])=>Object.freeze({valuePsid,bearingDeg})));
 function differentialPressurePreviewBearing(psid){
  if(typeof psid!=='number'||!Number.isFinite(psid))
   throw Error('Invalid DIFF PRESS reading');
  // IEEE754 summation can yield 10.000000000000007 at the 10-psi mark.
  // Reject genuinely out-of-dial values but permit sub-nanopsi float noise.
  const tiny=1e-9;
  if(psid< -tiny||psid>10+tiny)
   return null; // Do not fake out-of-range physical readings.
  const v=Math.max(0,Math.min(10,psid));
  const a=pressurePhotoAnchors;
  for(let i=1;i<a.length;i++)if(v<=a[i].valuePsid){
   const lo=a[i-1],hi=a[i],t=(v-lo.valuePsid)/(hi.valuePsid-lo.valuePsid);
   return lo.bearingDeg+t*(hi.bearingDeg-lo.bearingDeg);
  }
  return a[a.length-1].bearingDeg;
 }
 function resolvePhysicalReadings(readings){
  if(!readings||!Number.isFinite(readings.cabinAltitudeFt)||
      !Number.isFinite(readings.differentialPsid))
   return Object.freeze({status:'INVALID_SENSOR_SAMPLE',previewApproved:false});
  const cabAlt=readings.cabinAltitudeFt>=0&&readings.cabinAltitudeFt<=50000?
     cabinAltitudePreviewBearing(readings.cabinAltitudeFt):null;
  const press=differentialPressurePreviewBearing(readings.differentialPsid);
  return Object.freeze({status:cabAlt!==null&&press!==null?
   'BOTH_CANDIDATE_BEARINGS':'OUT_OF_PRINTED_RANGE',
   cabAltBearingDeg:cabAlt,pressBearingDeg:press,
   previewApproved:false,operationalNeedleAuthorized:false});
 }
 function cabinAltitudePreviewBearing(valueFt){
  if(typeof valueFt!=='number'||!Number.isFinite(valueFt))throw Error('Invalid CAB ALT reading');
  const a=cabinAltPhotoAnchors;
  const v=Math.max(a[0].valueFt,Math.min(a[a.length-1].valueFt,valueFt));
  for(let i=1;i<a.length;i++)if(v<=a[i].valueFt){
   const lo=a[i-1],hi=a[i],t=(v-lo.valueFt)/(hi.valueFt-lo.valueFt);
   return lo.bearingDeg+t*(hi.bearingDeg-lo.bearingDeg);
  }
  return a[a.length-1].bearingDeg;
 }

 // Physical stack (front/back) is NOT the printed dial's inner/outer scale.
 // Owner-specified: PRESS lies underneath/inside the CAB ALT pointer assembly.
 // Immutable artwork: PRESS still reads the outer PSI graduations and CAB ALT
 // still reads the inner thousand-foot graduations on the source OH19 face.
 // Tip scales were adjusted by source-image radial stroke QA and real SVG path
 // endpoints (CAB ALT 217px, PRESS 221px from sprite centre). These are
 // PREVIEW-ONLY fit estimates: 47 inner / 51 outer native strokes are candidates,
 // hidden spindle axis and exact mechanical contacts remain uncertified.
 const needles=Object.freeze([
  Object.freeze({id:'press',label:'PRESS · lower needle / outer PSI scale',asset:'cabin-diff-pressure-needle.svg',tipRadius:222.7,initialAngle:0,layer:0,stack:'rear',printedScale:'outer',valueSource:'differentialPsid'}),
  Object.freeze({id:'cabAlt',label:'CAB ALT · upper needle / inner x1000 FT scale',asset:'cabin-altitude-needle.svg',tipRadius:114.3,initialAngle:0,layer:1,stack:'front',printedScale:'inner',valueSource:'cabinAltitudeFt'})
 ]);
 function angle(id,value){
  if(!needles.some(needle=>needle.id===id))throw Error('Unknown cabin gauge needle '+id);
  const n=Number(value);if(!Number.isFinite(n))throw Error('Cabin gauge angle must be finite');
  // OH19 native-photo scales rotate clockwise from the 12-o'clock reference
  // through >320 deg; the old +/-166 deg QA slider obscured half the dial.
  // QA control only. Production mechanical stops need separate source approval.
  return Math.max(0,Math.min(360,n));
 }
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH19 atlas placement');
  return {x:piece.x+pivot.x*piece.w/source.width,y:piece.y+pivot.y*piece.h/source.height};
 }
 return Object.freeze({source,pivot,needles,angle,placement,cabinAltPhotoAnchors,cabinAltitudePreviewBearing,pressurePhotoAnchors,differentialPressurePreviewBearing,resolvePhysicalReadings,photoPreviewApproved:false});
});
