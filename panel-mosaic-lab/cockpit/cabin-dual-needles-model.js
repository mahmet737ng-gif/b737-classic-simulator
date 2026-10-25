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
  [0,2.71],[3000,59.98],[10000,108.64],[15000,155.65],
  [20000,200.55],[25000,236.57],[30000,262.03],[35000,284.48],
  [40000,304.18],[50000,327.37]
 ].map(([valueFt,bearingDeg])=>Object.freeze({valueFt,bearingDeg})));
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

 const needles=Object.freeze([
  Object.freeze({id:'cabAlt',label:'CAB ALT · inner x1000 FT',asset:'cabin-altitude-needle.svg',tipRadius:123,initialAngle:0,layer:0}),
  Object.freeze({id:'press',label:'PRESS · outer DIFF PRESS PSI',asset:'cabin-diff-pressure-needle.svg',tipRadius:207,initialAngle:0,layer:1})
 ]);
 function angle(id,value){
  if(!needles.some(needle=>needle.id===id))throw Error('Unknown cabin gauge needle '+id);
  const n=Number(value);if(!Number.isFinite(n))throw Error('Cabin gauge angle must be finite');
  return Math.max(-166,Math.min(166,n));
 }
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH19 atlas placement');
  return {x:piece.x+pivot.x*piece.w/source.width,y:piece.y+pivot.y*piece.h/source.height};
 }
 return Object.freeze({source,pivot,needles,angle,placement,cabinAltPhotoAnchors,cabinAltitudePreviewBearing,photoPreviewApproved:false});
});
