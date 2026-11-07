'use strict';
const assert=require('node:assert/strict');
const optics=require('../engine/instruments/needle-photo-optical-v1.js');
function image(deg){
 const w=80,h=160,frame={width:w,height:h,data:new Uint8ClampedArray(w*h*4)};
 for(let y=7;y<75;y++){
  const x=40+Math.tan(deg*Math.PI/180)*(140-y);
  for(const dx of [-1,0,1]){
   const px=Math.round(x+dx),i=(y*w+px)*4;
   frame.data[i]=235;frame.data[i+1]=223;frame.data[i+2]=205;frame.data[i+3]=255;
  }
 }
 return frame;
}
for(const angle of [-3.1,-1.8,0,1.8,3.1]){
 const result=optics.measure(image(angle));
 assert.equal(result.status,'PHOTO_VERIFIED',JSON.stringify(result));
 assert.ok(Math.abs(result.measuredBiasDeg-angle)<.65,angle+' optical tip offset');
 assert.ok(Math.abs(result.correctionDeg+angle)<.65,angle+' signed optical correction');
 assert.ok(Math.abs(optics.renderAngle(60,result.correctionDeg)+result.measuredBiasDeg-60)<1e-10);
}
const none=optics.measure({width:80,height:160,data:new Uint8ClampedArray(80*160*4)});
assert.equal(none.status,'REVIEW_REQUIRED');
assert.equal(none.correctionDeg,0,'Never invent an optical correction from missing photo pixels');
assert.throws(()=>optics.measure({width:80,height:100,data:new Uint8ClampedArray(8000)}));
console.log('ORIGINAL_NEEDLE_OPTICAL_REGISTRATION_PASS',JSON.stringify({
 fiveSyntheticNeedleOffsets:true,refuseAmbiguous:true,
 invariant:'calibration angles unchanged; optional visible tip alignment'
}));
