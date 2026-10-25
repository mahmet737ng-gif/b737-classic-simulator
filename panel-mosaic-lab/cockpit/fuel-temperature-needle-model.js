(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737FuelTemperatureNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Source: OH09-FUEL-921977b56887.png. Never resample or edit that locked image.
 const source=Object.freeze({piece:'OH09',width:1012,height:1555,pivotX:506,pivotY:235,tipRadius:136,hubRadius:25});
 // Nine printed numeric ticks registered against original OH09 source pixels
 // (173? no: original source is 1012 x 1555). The source-image radial
 // luminance survey `tools/fuel-temperature-tick-scan.py` detects long
 // tick candidates and finds NONLINEAR angular spacing. Interim visual
 // calibration: all 81 integer values use per-segment interpolation.
 // Full inner-tick endpoint/source approval remains pending.
 const ticks=Object.freeze([
  [-40,-92],[-30,-69],[-20,-47.5],[-10,-24.5],
  [0,0.5],[10,24],[20,47],[30,69],[40,91]
 ].map(([celsius,bearing])=>Object.freeze({celsius,bearing,evidence:'native_raster_brightness_peak_candidate'})));
 const spec=Object.freeze({min:-40,max:40,defaultCelsius:10,
  minAngle:ticks[0].bearing,maxAngle:ticks.at(-1).bearing,
  referenceAngle:29,durationMs:320,
  printedMajorTickCount:ticks.length,nativeMajorTicksProvisional:true});
 const clamp=value=>{
  const n=Number(value);
  if(!Number.isFinite(n))throw Error('Fuel temperature must be finite');
  return Math.max(spec.min,Math.min(spec.max,n));
 };
 function angle(value){
  const n=clamp(value);
  for(let i=1;i<ticks.length;i++)if(n<=ticks[i].celsius){
   const a=ticks[i-1],b=ticks[i],u=(n-a.celsius)/(b.celsius-a.celsius);
   return a.bearing+u*(b.bearing-a.bearing);
  }
  return ticks.at(-1).bearing;
 }
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH09 placement');
  const size=512*(source.tipRadius/(256-62))*(piece.w/source.width);
  return {x:piece.x+source.pivotX*piece.w/source.width,
   y:piece.y+source.pivotY*piece.h/source.height,size,
   hubMaskRadius:source.hubRadius*(piece.w/source.width)*(512/size)};
 }
 return Object.freeze({source,spec,ticks,clamp,angle,rotationDelta:value=>angle(value)-spec.referenceAngle,placement});
});
