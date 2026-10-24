(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737OxygenPressureGaugeModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // The OH01–OH06 artwork is frozen. Coordinates are native UPPER source pixels.
 const source=Object.freeze({piece:'UPPER',width:1731,height:909});
 const dial=Object.freeze({cx:1078,cy:636,radius:62,faceAsset:'oxygen-pressure-face.svg',needleAsset:'oxygen-pressure-needle.svg'});
 const ticks=Object.freeze([0,5,10,15,20].map(hundredsPsi=>Object.freeze({hundredsPsi,bearing:-124+hundredsPsi*12.4})));
 const initialPsi=1200; // Visual reference shows approximately 12 × 100 PSI; not a live system reading.
 function pressurePsi(value){
  const n=Number(value);if(!Number.isFinite(n))throw Error('Oxygen pressure must be finite');
  return Math.max(0,Math.min(2000,n));
 }
 function bearing(value){return -124+pressurePsi(value)*.124;}
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid UPPER atlas placement');
  return {x:piece.x+dial.cx*piece.w/source.width,y:piece.y+dial.cy*piece.h/source.height,rx:dial.radius*piece.w/source.width,ry:dial.radius*piece.h/source.height};
 }
 return Object.freeze({source,dial,ticks,initialPsi,pressurePsi,bearing,placement});
});
