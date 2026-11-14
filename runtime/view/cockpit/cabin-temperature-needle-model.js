(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737CabinTemperatureNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Source pixels of the immutable OH20 panel. Reuse the CABIN CLIMB sprite unchanged.
 const source=Object.freeze({piece:'OH20',width:1254,height:1254});
 const pivot=Object.freeze({x:618,y:681});
 const needle=Object.freeze({asset:'cabin-rate-needle.svg',tipRadius:158,initialTemperature:20});
 // Approximate visual angles measured from the six printed temperature labels.
 // This is display calibration only, not a cabin temperature system input.
 const ticks=Object.freeze([
  Object.freeze({celsius:0,bearing:-136}),
  Object.freeze({celsius:20,bearing:-90}),
  Object.freeze({celsius:40,bearing:-48}),
  Object.freeze({celsius:60,bearing:11}),
  Object.freeze({celsius:80,bearing:67}),
  Object.freeze({celsius:100,bearing:107})
 ]);
 function temperature(value){
  const n=Number(value);if(!Number.isFinite(n))throw Error('Cabin temperature must be finite');
  return Math.max(0,Math.min(100,n));
 }
 function bearing(value){
  const n=temperature(value);
  for(let i=1;i<ticks.length;i++)if(n<=ticks[i].celsius){
   const a=ticks[i-1],b=ticks[i];return a.bearing+(n-a.celsius)*(b.bearing-a.bearing)/(b.celsius-a.celsius);
  }
  return ticks.at(-1).bearing;
 }
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH20 atlas placement');
  const inset=piece.artInset||{};
  const x=piece.x+(inset.left||0),y=piece.y+(inset.top||0);
  const w=piece.w-(inset.left||0)-(inset.right||0),h=piece.h-(inset.top||0)-(inset.bottom||0);
  if(w<=0||h<=0)throw Error('Invalid OH20 image bounds');
  return {x:x+pivot.x*w/source.width,y:y+pivot.y*h/source.height};
 }
 return Object.freeze({source,pivot,needle,ticks,temperature,bearing,placement});
});
