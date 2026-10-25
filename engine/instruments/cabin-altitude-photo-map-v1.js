/* OH19 CAB ALT (inner x1000 ft) source-photo tick map.
 * All 47 white stroke bearings were sampled on the unchanged native
 * 1267x1241 photo. Only printed numerals are source-confirmed readings.
 * Values between numerals are provisional equal-subdivision inferences;
 * do not mark as flight-certified instrument calibration.
 * Positive browser SVG rotation is CLOCKWISE from 12 o'clock.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737CabinAltitudePhotoMapV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const SOURCE=Object.freeze({
   file:'panel-mosaic-lab/assets/locked/2026-10-23/OH19-PRESS-DIFF-ALT-HORN-d6719ce57cef.png',
   sha256:'4c667d96ea7652e52784f5c06ee3cdde0879ca37631abf19969861afecc45fed',
   width:1267,height:1241,pivot:Object.freeze({x:489,y:365}),
   imageQA:'WHITE_RADIAL_SOURCE_PIXEL_CANDIDATES_REVIEWED_2026_10_25',
   numericQA:'UNLABELLED_NUMBERS_ARE_EQUAL_GAP_INFERENCES_NOT_MANUFACTURER_VERIFIED',
   finalApproved:false
 });
 const bearings=Object.freeze([
  2.71,13.59,22.37,31.32,40.34,50.20,59.98,69.45,79.17,89.05,98.85,
  108.64,118.08,127.58,137.51,146.79,155.65,163.39,170.73,178.69,
  186.62,193.61,200.55,206.37,212.31,218.48,224.38,230.49,236.57,
  241.50,246.89,251.72,256.86,262.03,266.88,271.03,275.62,279.89,
  284.48,289.53,294.52,299.70,304.18,310.15,316.97,322.25,327.37
 ]);
 // rMin is first bright edge of each physical stroke sampled from the pivot.
 const strokeInnerRadius=Object.freeze([
  125,127,127,127,128,128,128,128,127,127,126,124,124,122,121,120,
  119,118,118,117,117,116,116,116,115,115,115,116,117,116,117,118,
  118,118,119,119,119,120,120,119,120,121,121,121,121,122,122
 ]);
 const anchors=Object.freeze([
  Object.freeze({index:0,thousandsFeet:0,printed:false,note:'Unnumbered upper zero stroke inferred from inner dial origin'}),
  Object.freeze({index:6,thousandsFeet:3,printed:true}),
  Object.freeze({index:11,thousandsFeet:10,printed:true}),
  Object.freeze({index:16,thousandsFeet:15,printed:true}),
  Object.freeze({index:22,thousandsFeet:20,printed:true}),
  Object.freeze({index:28,thousandsFeet:25,printed:true}),
  Object.freeze({index:33,thousandsFeet:30,printed:true}),
  Object.freeze({index:38,thousandsFeet:35,printed:true}),
  Object.freeze({index:42,thousandsFeet:40,printed:true}),
  Object.freeze({index:46,thousandsFeet:50,printed:true})
 ]);
 function finite(n){return typeof n==='number'&&Number.isFinite(n);}
 const values=new Array(bearings.length);
 const intervals=[];
 for(let s=1;s<anchors.length;s++){
   const a=anchors[s-1],b=anchors[s],gaps=b.index-a.index;
   const delta=(b.thousandsFeet-a.thousandsFeet)/gaps;
   for(let i=a.index;i<=b.index;i++)values[i]=a.thousandsFeet+(i-a.index)*delta;
   intervals.push(Object.freeze({
     from:a.thousandsFeet,to:b.thousandsFeet,gaps,stepThousandsFt:delta,
     valueEvidence:'inferred_equal_division_between_printed_anchors'
   }));
 }
 const printed=new Set(anchors.filter(x=>x.printed).map(x=>x.index));
 const ticks=Object.freeze(bearings.map((angleDeg,i)=>Object.freeze({
   index:i,valueThousandsFt:values[i],angleDeg,
   innerRadiusPx:strokeInnerRadius[i],
   x:SOURCE.pivot.x+135*Math.sin(angleDeg*Math.PI/180),
   y:SOURCE.pivot.y-135*Math.cos(angleDeg*Math.PI/180),
   labelEvidence:printed.has(i)?'printed_source_photo':i===0?'unprinted_zero_origin_inferred':'between_labels_inferred',
   pixelEvidence:'native_photo_radial_white_line'
 })));
 function poseAtFt(feet,{outOfRange='reject'}={}){
   if(!finite(feet))throw Error('CAB ALT ft reading must be finite');
   if(!['reject','clamp'].includes(outOfRange))throw Error('Unrecognized range policy');
   if(feet<0||feet>50000){
     if(outOfRange==='reject')return Object.freeze({status:'out_of_range',inputFeet:feet,approved:false});
   }
   const appliedFt=Math.max(0,Math.min(50000,feet));
   const v=appliedFt/1000;
   let hi=1;
   while(hi<ticks.length-1&&v>ticks[hi].valueThousandsFt)hi++;
   const a=ticks[hi-1],b=ticks[hi];
   const localFraction=(v-a.valueThousandsFt)/(b.valueThousandsFt-a.valueThousandsFt);
   const angleDeg=a.angleDeg+localFraction*(b.angleDeg-a.angleDeg);
   const innerRadiusPx=a.innerRadiusPx+localFraction*(b.innerRadiusPx-a.innerRadiusPx);
   return Object.freeze({
     status:appliedFt===feet?'source_photo_preview':'clamped_source_photo_preview',
     inputFeet:feet,appliedFeet:appliedFt,angleDeg,innerRadiusPx,
     bracketThousandsFt:Object.freeze([a.valueThousandsFt,b.valueThousandsFt]),
     sourcePhotoHash:SOURCE.sha256,geometryObserved:true,
     valueEvidence:'printed_anchors_plus_unlabelled_inference',approved:false
   });
 }
 const displayedNeedle=Object.freeze({
   sprite:'panel-mosaic-lab/cockpit/cabin-altitude-needle.svg',
   centerInSvg:256,topInSvg:39,scaledTipRadiusPx:(256-39)*(123/220),
   originalTipRadiusModel:123
 });
 function measureTipFit(feet){
   const p=poseAtFt(feet);
   if(p.status==='out_of_range')return p;
   return Object.freeze({...p,tipRadiusPx:displayedNeedle.scaledTipRadiusPx,
     tipToWhiteTickInnerEdgePx:p.innerRadiusPx-displayedNeedle.scaledTipRadiusPx});
 }
 return Object.freeze({SOURCE,bearings,anchors,ticks,intervals,displayedNeedle,poseAtFt,measureTipFit});
});
