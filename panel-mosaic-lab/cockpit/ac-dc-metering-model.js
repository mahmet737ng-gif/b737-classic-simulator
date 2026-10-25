(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737AcDcMeteringModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Measured on unchanged OH10-ELEC-LOSSLESS-9a1ca4d6cfb2.png (1095 x 1436).
 // Initial angles now represent provisional cold-dark mechanical resting positions.\n // DC AMPS is center-zero; unpowered AC/DC voltmeters rest at their leftmost stop pending exact source-tick survey.
 const source=Object.freeze({piece:'OH10',width:1095,height:1436,tipRadius:85,spriteTipRadius:216});
 const meters=Object.freeze([
  Object.freeze({id:'dcAmps',label:'DC AMPS',x:310,y:168,initialAngle:0}),
  Object.freeze({id:'cps',label:'CPS',x:715,y:190,initialAngle:-54}),
  Object.freeze({id:'dcVolts',label:'DC VOLTS',x:332,y:600,initialAngle:-70}),
  Object.freeze({id:'acVolts',label:'A.C.',x:715,y:620,initialAngle:-70})
 ]);
 const angle=value=>{
  const n=Number(value);
  if(!Number.isFinite(n))throw Error('Meter needle angle must be finite');
  return Math.max(-70,Math.min(70,n));
 };
 function placement(piece,meter){
  if(!piece||!meters.includes(meter)||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH10 needle placement');
  const size=512*source.tipRadius/source.spriteTipRadius*piece.w/source.width;
  return {x:piece.x+meter.x*piece.w/source.width,y:piece.y+meter.y*piece.h/source.height,size};
 }
 return Object.freeze({source,meters,angle,placement});
});
