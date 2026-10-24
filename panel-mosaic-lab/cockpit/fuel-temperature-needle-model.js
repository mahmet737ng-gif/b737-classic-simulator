(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737FuelTemperatureNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Source: OH09-FUEL-921977b56887.png. Never resample or edit that locked image.
 const source=Object.freeze({piece:'OH09',width:1012,height:1555,pivotX:506,pivotY:235,tipRadius:136,hubRadius:25});
 // The existing fuel-panel/animation-spec-registry.json defines -40..40 C as -70..70 deg.
 const spec=Object.freeze({min:-40,max:40,defaultCelsius:10,minAngle:-70,maxAngle:70,referenceAngle:29,durationMs:320});
 const clamp=value=>{
  const n=Number(value);
  if(!Number.isFinite(n))throw Error('Fuel temperature must be finite');
  return Math.max(spec.min,Math.min(spec.max,n));
 };
 const angle=value=>spec.minAngle+(clamp(value)-spec.min)*(spec.maxAngle-spec.minAngle)/(spec.max-spec.min);
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH09 placement');
  const size=512*(source.tipRadius/(256-62))*(piece.w/source.width);
  return {x:piece.x+source.pivotX*piece.w/source.width,
   y:piece.y+source.pivotY*piece.h/source.height,size,
   hubMaskRadius:source.hubRadius*(piece.w/source.width)*(512/size)};
 }
 return Object.freeze({source,spec,clamp,angle,rotationDelta:value=>angle(value)-spec.referenceAngle,placement});
});
