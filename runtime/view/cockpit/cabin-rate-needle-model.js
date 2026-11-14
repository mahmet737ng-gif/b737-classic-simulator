(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737CabinRateNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // All coordinates are source pixels of the immutable OH19 image.
 const source=Object.freeze({piece:'OH19-DIFF',width:1267,height:1241});
 const pivot=Object.freeze({x:520,y:950});
 const needle=Object.freeze({asset:'cabin-rate-needle.svg',tipRadius:139,initialOffset:0,zeroBearing:-90});
 function offset(value){
  const n=Number(value);if(!Number.isFinite(n))throw Error('Cabin rate needle offset must be finite');
  return Math.max(-145,Math.min(145,n));
 }
 function bearing(value){return needle.zeroBearing+offset(value);}
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH19 atlas placement');
  return {x:piece.x+pivot.x*piece.w/source.width,y:piece.y+pivot.y*piece.h/source.height};
 }
 return Object.freeze({source,pivot,needle,offset,bearing,placement});
});
