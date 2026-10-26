(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737AcDcMeteringModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Display-centre candidates fit from intact OH10 original circular metal rims; 
 // 4 strong Hough thresholds give the same centre. DO NOT mistake a bezel 
 // centre for a photographed shaft: require arc/tip confirmation for release. 
 // See engine/instruments/native-bezel-centre-evidence-v1.json.
 // Initial angles now represent provisional cold-dark mechanical resting positions. 
 // DC AMPS is center-zero; unpowered AC/DC voltmeters rest at their leftmost stop pending exact source-tick survey.
 const source=Object.freeze({piece:'OH10',width:1095,height:1436,tipRadius:85,spriteTipRadius:216});
 const meters=Object.freeze([
  Object.freeze({id:'dcAmps',label:'DC AMPS',x:308.453,y:281.608,tipRadius:141,initialAngle:0.36}),
  Object.freeze({id:'cps',label:'CPS',x:774.2,y:191.4,initialAngle:-54}),
  Object.freeze({id:'dcVolts',label:'DC VOLTS',x:310.307,y:682.818,tipRadius:131,initialAngle:-26.62}),
  Object.freeze({id:'acVolts',label:'A.C.',x:785.143,y:702.386,tipRadius:143,initialAngle:-70})
 ]);

 // Source-original native OH10 white graduation intersections, not metal
 // bezel circles; 11 DC AMPS marks -50..+50 each 10 A, 11 DC VOLTS marks
 // 0..40 each 4 V. Separate 100..130 V AC scale remains manual QA-only until
 // its unpowered parked position and actual AC bus sensor feed are resolved.
 const photoScale=Object.freeze({
  dcAmps:Object.freeze({unit:'A',values:Object.freeze([-50,-40,-30,-20,-10,0,10,20,30,40,50]),angles:Object.freeze([-27.85,-22.24,-16.76,-11.27,-5.58,0.36,6.22,11.88,17.5,22.97,28.76]),readoutApprovedForPreview:true}),
  dcVolts:Object.freeze({unit:'V',values:Object.freeze([0,4,8,12,16,20,24,28,32,36,40]),angles:Object.freeze([-26.62,-21.22,-16.16,-11,-5.9,-0.29,5.7,10.98,16.08,21.05,26.47]),readoutApprovedForPreview:true}),
  acVolts:Object.freeze({unit:'V',values:Object.freeze([100,102,104,106,108,110,112,114,116,118,120,122,124,126,128,130]),angles:Object.freeze([-48.08,-41.89,-35.84,-29.77,-23.63,-17.02,-9.78,-3.47,3.05,9.16,16.42,22.97,28.86,34.68,40.62,46.8]),readoutApprovedForPreview:false})
 });
 function bearingForReading(id,value){
  const sc=photoScale[id];if(!sc)throw Error('Unknown photographic OH10 scale '+id);
  if(typeof value!=='number'||!Number.isFinite(value))throw Error('OH10 reading must be finite');
  const v=sc.values,a=sc.angles;
  if(value<v[0]||value>v[v.length-1])return null;
  for(let i=1;i<v.length;i++)if(value<=v[i]){
   return a[i-1]+(value-v[i-1])*(a[i]-a[i-1])/(v[i]-v[i-1]);
  }
  return a[a.length-1];
 }
 function readingForBearing(id,bearing){
  const sc=photoScale[id];if(!sc)throw Error('Unknown photographic OH10 scale '+id);
  if(typeof bearing!=='number'||!Number.isFinite(bearing))throw Error('OH10 bearing must be finite');
  const v=sc.values,a=sc.angles;
  if(bearing<a[0]-1e-8||bearing>a[a.length-1]+1e-8)return null;
  for(let i=1;i<a.length;i++)if(bearing<=a[i])
   return v[i-1]+(bearing-a[i-1])*(v[i]-v[i-1])/(a[i]-a[i-1]);
  return v[v.length-1];
 }
 const angle=value=>{
  const n=Number(value);
  if(!Number.isFinite(n))throw Error('Meter needle angle must be finite');
  return Math.max(-70,Math.min(70,n));
 };
 function placement(piece,meter){
  if(!piece||!meters.includes(meter)||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH10 needle placement');
  const size=512*(meter.tipRadius||source.tipRadius)/source.spriteTipRadius*piece.w/source.width;
  return {x:piece.x+meter.x*piece.w/source.width,y:piece.y+meter.y*piece.h/source.height,size};
 }
 return Object.freeze({source,meters,angle,placement,photoScale,bearingForReading,readingForBearing});
});
