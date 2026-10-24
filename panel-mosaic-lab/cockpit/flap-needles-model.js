(function(root,factory){
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737FlapNeedlesModel=model;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 // Angle offsets from UP, measured clockwise against the approved blank gauge.
 // These are visual needle-stop calibrations, not a flap asymmetry alarm threshold.
 const stops=Object.freeze([
  {value:0,angle:0},{value:1,angle:38},{value:2,angle:78},
  {value:5,angle:116},{value:10,angle:148},{value:15,angle:180},
  {value:25,angle:218},{value:30,angle:244},{value:40,angle:270}
 ].map(p=>Object.freeze(p)));
 function validate(value){
  if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>40)throw Error('Flap position must be a finite number from 0 to 40');
  return value;
 }
 function angle(value){
  validate(value);
  for(let i=1;i<stops.length;i++)if(value<=stops[i].value){
   const a=stops[i-1],b=stops[i],t=(value-a.value)/(b.value-a.value);
   return a.angle+(b.angle-a.angle)*t;
  }
  return stops[stops.length-1].angle;
 }
 function make(){
  let left=0,right=0,mode='common';
  return Object.freeze({
   read:()=>Object.freeze({left,right,mode,leftAngle:angle(left),rightAngle:angle(right),rightOccluded:angle(left)===angle(right)}),
   setCommon(value){left=right=validate(value);mode='common';return this.read();},
   setIndependent(values){if(!values||typeof values!=='object')throw Error('Both flap positions required');
    const l=validate(values.left),r=validate(values.right);
    left=l;right=r;mode='independent';return this.read();}
  });
 }
 return Object.freeze({stops,angle,validate,make});
});
