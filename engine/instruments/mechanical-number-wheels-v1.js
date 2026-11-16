/* Continuous carry-driven mechanical drum digit phases.
 * Units roll with measured motion; tens/hundreds turn only at carry.
 * Stateless, deterministic, SVG/Canvas-independent.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737MechanicalNumberWheelsV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const VERSION='MECHANICAL_NUMBER_WHEELS_0001';
 const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 function frames(value,digits,{carryStart=.82}={}){
  if(!Number.isFinite(value)||value<0||!Number.isInteger(digits)||digits<1||digits>6||
     !Number.isFinite(carryStart)||carryStart<.5||carryStart>=1)
    throw RangeError('MECHANICAL_DIGITS_SOURCE');
  const out=[];
  for(let i=0;i<digits;i++){
   const magnitude=10**(digits-i-1),scaled=value/magnitude,whole=Math.floor(scaled);
   const lower=scaled-whole;
   // For higher places use carry over the final fraction of lower digits.
   const fraction=magnitude===1?lower:clamp((lower-carryStart)/(1-carryStart),0,1);
   const digit=((whole%10)+10)%10;
   out.push({digit,next:(digit+1)%10,previous:(digit+9)%10,
    fraction,magnitude,digitPosition:i});
  }
  return out;
 }
 return Object.freeze({VERSION,frames});
});
