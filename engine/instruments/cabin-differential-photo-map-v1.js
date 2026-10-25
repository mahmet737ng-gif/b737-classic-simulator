/* OH19 DIFF PRESS source-image scale; different ring/pointer from CAB ALT.
 * Every printed major interval 1 psi has four short ticks => 0.2 psid/tick.
 * All 51 white tick bearings were radially detected on the immutable OH19.
 */
(function(root,factory){'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737CabinDifferentialPhotoMapV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){'use strict';
 const SOURCE=Object.freeze({
  image:'panel-mosaic-lab/assets/locked/2026-10-23/OH19-PRESS-DIFF-ALT-HORN-d6719ce57cef.png',
  sha256:'4c667d96ea7652e52784f5c06ee3cdde0879ca37631abf19969861afecc45fed',
  size:Object.freeze([1267,1241]),pivot:Object.freeze({x:489,y:365}),
  photoStrokeCount:51,printedMajors:Object.freeze([0,1,2,3,4,5,6,7,8,9,10]),
  unnumberedIncrementPsi:.2,
  finalApproved:false
 });
 const degrees=Object.freeze([
  1.50,7.62,13.56,19.61,25.78,32.49,38.76,45.00,51.50,57.74,
  64.21,70.29,76.70,83.22,89.66,96.06,102.35,108.72,115.02,121.48,
  127.30,133.43,139.57,146.02,152.51,159.47,166.27,173.12,180.00,186.98,
  193.57,200.48,206.80,213.22,219.27,225.42,231.71,237.75,244.27,250.53,
  256.99,263.59,270.13,276.83,283.55,290.23,296.62,303.12,309.46,315.55,322.05
 ]);
 const inside=Object.freeze([
  229,230,230,230,230,229,230,230,230,229,230,230,231,230,230,
  229,230,231,231,229,230,230,228,228,227,226,226,227,226,226,
  226,228,228,229,230,230,230,229,230,229,230,230,230,230,231,
  230,230,230,230,230,230
 ]);
 const ticks=Object.freeze(degrees.map((angleDeg,i)=>Object.freeze({
  index:i,psi:i*.2,angleDeg,innerRadiusPx:inside[i],
  major:i%5===0,valueOrigin:i%5===0?'printed_integer_psi':'one_of_four_short_strokes',
  photoOrigin:'native_image_radial_tick_brightness'
 })));
 const needle=Object.freeze({
  svg:'panel-mosaic-lab/cockpit/cabin-diff-pressure-needle.svg',
  oldTipRadiusModelPx:207,newTipRadiusModelPx:230,
  displayedTipRadiusPx:221*(230/220),
  oldDisplayedTipRadiusPx:221*(207/220)
 });
 function poseAtPsi(psi,{outOfRange='reject'}={}){
  if(typeof psi!=='number'||!Number.isFinite(psi))throw Error('Finite psid required');
  if(!['reject','clamp'].includes(outOfRange))throw Error('Unknown out-of-range policy');
  if((psi<0||psi>10)&&outOfRange==='reject')
   return Object.freeze({status:'out_of_range',psi,finalApproved:false});
  const v=Math.max(0,Math.min(10,psi));
  let i=1;
  while(i<ticks.length-1&&v>ticks[i].psi)i++;
  const a=ticks[i-1],b=ticks[i],t=(v-a.psi)/(b.psi-a.psi);
  const angleDeg=a.angleDeg+t*(b.angleDeg-a.angleDeg);
  const innerRadiusPx=a.innerRadiusPx+t*(b.innerRadiusPx-a.innerRadiusPx);
  return Object.freeze({
   status:v===psi?'source_photo_preview':'clamped_source_photo_preview',
   psi:v,angleDeg,innerRadiusPx,
   stretch:innerRadiusPx/needle.displayedTipRadiusPx,
   verifiedPhotoStroke:true,minorIncrementPsi:.2,
   finalApproved:false,sourcePhotoHash:SOURCE.sha256
  });
 }
 return Object.freeze({SOURCE,ticks,needle,poseAtPsi});
});
