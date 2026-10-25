/* B737 Classic stage 5: physically anchored numerical scale preparation.
 * Never authorizes real instrument readings from candidate photo measurements.
 * Works as a UMD module in the cockpit and Node tests, without side effects.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737Stage5ScaleMappingV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const finite=x=>typeof x==='number'&&Number.isFinite(x);
 const bearing=(p,pt)=>Math.atan2(pt.x-p.x,p.y-pt.y)*180/Math.PI;
 const circDiff=(a,b)=>Math.abs((((a-b+180)%360)+360)%360-180);
 function compile(candidate){
  if(!candidate||!candidate.source||!/^[a-f0-9]{64}$/i.test(candidate.source.sha256||''))
   throw Error('Immutable source hash required');
  const {id,mode,kind='rotary',unit,pivot,anchors}=candidate;
  if(!id||!mode||!unit||!['rotary','linear'].includes(kind))
   throw Error('Source-backed ID/mode/unit and mechanical kind required');
  if(!Array.isArray(anchors)||anchors.length<2)throw Error('Two photo-number anchors required');
  if(kind==='rotary'&&(!pivot||![pivot.x,pivot.y].every(finite)))
   throw Error('Uncertified or absent rotary pivot');
  const order=candidate.increasingDirection;
  if(kind==='rotary'&&!['clockwise','counterclockwise'].includes(order))
   throw Error('Rotary direction required');
  if(kind==='linear'&&!['increasing_x','decreasing_x','increasing_y','decreasing_y'].includes(order))
   throw Error('Linear direction required');
  const marks=anchors.map((v,i)=>{
   if(!finite(v.value)||!v.origin||v.origin==='assumed'||!v.status)
    throw Error('Value and provenance required for anchor '+i);
   if(kind==='rotary'){
    if(!finite(v.angleDeg)&&(!v.point||![v.point.x,v.point.y].every(finite)))
     throw Error('Measured candidate bearing required');
    if(v.point&&![v.point.x,v.point.y].every(finite))throw Error('Invalid candidate pixel point');
    const derived=v.point?bearing(pivot,v.point):null;
    if(finite(v.angleDeg)&&finite(derived)&&circDiff(v.angleDeg,derived)>(candidate.maxPhotoBearingErrorDeg??0.4))
     throw Error('Point/angle disagree');
    return Object.freeze({...v,angleDeg:finite(v.angleDeg)?v.angleDeg:derived});
   }
   if(!v.point||![v.point.x,v.point.y].every(finite))throw Error('Linear pixel point required');
   return Object.freeze({...v});
  });
  for(let i=1;i<marks.length;i++)
   if(!(marks[i].value>marks[i-1].value))
    throw Error('Anchors must increase strictly by numeric value');
  const turn=order==='clockwise'?1:-1;
  const unwrapped=marks.map((m,i)=>{
   if(kind!=='rotary')return m;
   let a=m.angleDeg;
   if(i>0){
    while((a-marks[i-1].angleUnwrappedDeg)*turn<=0)a+=360*turn;
    const span=(a-marks[i-1].angleUnwrappedDeg)*turn;
    if(span>(candidate.maxGapDeg??125))throw Error('Angular gap needs independent source review');
   }
   marks[i]=Object.freeze({...m,angleUnwrappedDeg:a});
   return marks[i];
  });
  if(kind==='rotary'&&Math.abs(unwrapped.at(-1).angleUnwrappedDeg-unwrapped[0].angleUnwrappedDeg)>360)
   throw Error('Implausible full sweep');
  // An approved map must be tied to independent exact shaft and all tick review;
  // schema cannot be promoted merely by swapping status='approved'.
  const approved=candidate.approval?.allNativeTicksReviewed===true &&
       candidate.approval?.shaftPivotPhotoReviewed===true &&
       candidate.approval?.sourceGeometryReviewed===true &&
       marks.every(x=>x.status==='measured_source_pixels_approved') &&
       candidate.approval?.reviewerEvidence?.length>0;
  function locate(value,{preview=false,outOfRange='reject'}={}){
   if(!approved&&!preview)return Object.freeze({status:'blocked',reason:'stage5_geometry_not_certified',id,mode});
   if(!finite(value))return Object.freeze({status:'unavailable',reason:'invalid_value',id,mode});
   let v=value;
   const min=marks[0].value,max=marks.at(-1).value;
   if(value<min||value>max){
    if(outOfRange==='reject')return Object.freeze({status:'out_of_range',id,mode,input:value,min,max});
    if(outOfRange!=='clamp')throw Error('Use explicit reject or clamp policy');
    v=Math.min(max,Math.max(min,v));
   }
   let i=1;
   while(i<marks.length-1&&v>marks[i].value)i++;
   const a=marks[i-1],b=marks[i],t=(v-a.value)/(b.value-a.value);
   let tip=null, angleDeg=null;
   if(kind==='rotary'){
    angleDeg=a.angleUnwrappedDeg+(b.angleUnwrappedDeg-a.angleUnwrappedDeg)*t;
    // Pixel tip is a *radial arc*, never the chord between two marks.
    if(a.point&&b.point){
     const ra=Math.hypot(a.point.x-pivot.x,a.point.y-pivot.y);
     const rb=Math.hypot(b.point.x-pivot.x,b.point.y-pivot.y);
     const radius=ra+(rb-ra)*t,r=angleDeg*Math.PI/180;
     tip={x:pivot.x+radius*Math.sin(r),y:pivot.y-radius*Math.cos(r)};
    }
   }else{
    tip={x:a.point.x+(b.point.x-a.point.x)*t,
         y:a.point.y+(b.point.y-a.point.y)*t};
   }
   return Object.freeze({status:v!==value?'pegged':approved?'ok':'preview_unverified',
    id,mode,value:v,angleDeg,tip,bracket:[a.value,b.value],fraction:t,certified:approved});
  }
  return Object.freeze({id,mode,unit,kind,pivot,approved,
   marks:Object.freeze(unwrapped),min:marks[0].value,max:marks.at(-1).value,
   locate});
 }
 return Object.freeze({compile,bearing,circDiff});
});
