(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737DuctPressureNeedlesModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // OH21 owner artwork is immutable: all geometry uses its 1122 x 1402 source coordinates.
 const source=Object.freeze({piece:'OH21',width:1122,height:1402});
 const pivot=Object.freeze({x:544,y:439});
 // Owner's blue circle is the 0-PSI position (lower-right). The red ring
 // traces clockwise around the bottom, left and top, reaching 100 at right.
 // The previous -150 + 3*PSI mapping put 0 at the printed 20 mark.
 const scale=Object.freeze({minPsi:0,maxPsi:100,zeroBearingDeg:144,spanDeg:300,
  tickStepPsi:5,majorStepPsi:20,source:'2026-11-03 owner red sweep / blue zero'});
 const ticks=Object.freeze(Array.from({length:21},(_,i)=>{
  const psi=i*scale.tickStepPsi;
  return Object.freeze({psi,bearingDeg:scale.zeroBearingDeg+scale.spanDeg*psi/scale.maxPsi,
   major:psi%scale.majorStepPsi===0});
 }));
 const needles=Object.freeze([
  Object.freeze({id:'R',asset:'duct-pressure-needle-r.svg',label:'R DUCT PRESSURE · lower',tipRadius:148,initialPsi:0,layer:0}),
  Object.freeze({id:'L',asset:'duct-pressure-needle-l.svg',label:'L DUCT PRESSURE · upper',tipRadius:148,initialPsi:0,layer:1})
 ]);
 function psi(id,value){
  if(!needles.some(needle=>needle.id===id))throw Error('Unknown duct pressure needle '+id);
  const n=Number(value);if(!Number.isFinite(n))throw Error('Duct pressure must be finite');
  return Math.max(scale.minPsi,Math.min(scale.maxPsi,n));
 }
 function bearing(id,value){return scale.zeroBearingDeg+scale.spanDeg*psi(id,value)/scale.maxPsi;}
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH21 atlas placement');
  return {x:piece.x+pivot.x*piece.w/source.width,y:piece.y+pivot.y*piece.h/source.height};
 }
 return Object.freeze({source,pivot,scale,ticks,needles,psi,bearing,placement});
});
