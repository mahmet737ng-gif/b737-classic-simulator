(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737DuctPressureNeedlesModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // OH21 locked source pixels, not displayed atlas pixels.
 const source=Object.freeze({piece:'OH21',width:1122,height:1402});
 const pivot=Object.freeze({x:544,y:439});
 const needles=Object.freeze([
  Object.freeze({id:'R',asset:'duct-pressure-needle-r.svg',label:'R DUCT PRESSURE · lower',tipRadius:148,initialPsi:0,layer:0}),
  Object.freeze({id:'L',asset:'duct-pressure-needle-l.svg',label:'L DUCT PRESSURE · upper',tipRadius:148,initialPsi:0,layer:1})
 ]);
 function psi(id,value){
  if(!needles.some(needle=>needle.id===id))throw Error('Unknown duct pressure needle '+id);
  const n=Number(value);if(!Number.isFinite(n))throw Error('Duct pressure must be finite');
  return Math.max(0,Math.min(100,n));
 }
 // Printed ticks are spaced about 30 degrees per 10 PSI; 0 and 100 are lower left/right.
 function bearing(id,value){return -150+3*psi(id,value);}
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH21 atlas placement');
  return {x:piece.x+pivot.x*piece.w/source.width,y:piece.y+pivot.y*piece.h/source.height};
 }
 return Object.freeze({source,pivot,needles,psi,bearing,placement});
});
