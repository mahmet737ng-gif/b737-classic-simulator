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
 const needles=Object.freeze([
  Object.freeze({id:'cabAlt',label:'CAB ALT · inner x1000 FT',asset:'cabin-altitude-needle.svg',tipRadius:123,initialAngle:0,layer:0}),
  Object.freeze({id:'press',label:'PRESS · outer DIFF PRESS PSI',asset:'cabin-diff-pressure-needle.svg',tipRadius:230,initialAngle:0,layer:1})
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
 return Object.freeze({source,pivot,needles,angle,placement});
});
