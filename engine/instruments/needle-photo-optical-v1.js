/* Original ivory needle photographic optical-axis calibration.
 * The sprite's painted tip may not be exactly at x=40. Recover the visual
 * bearing from the actual same-origin WebP-in-SVG pixels; never alter photo,
 * needle asset, model scales, EIS, or approved N2 calibration.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737NeedlePhotoOpticsV1=api;
})(typeof globalThis==='object'?globalThis:null,function(){
 'use strict';
 const VERSION='PHOTO-NEEDLE-OPTICS-0001',width=80,height=160,shaft={x:40,y:140};
 const valid=v=>typeof v==='number'&&Number.isFinite(v);
 function measure(frame){
  if(!frame||frame.width!==width||frame.height!==height||
    !frame.data||frame.data.length<width*height*4)
   throw Error('80x160 original photographic needle ImageData required');
  const rows=[];
  for(let y=7;y<75;y++){
   let weightedX=0,weight=0,number=0;
   for(let x=22;x<58;x++){
    const i=(y*width+x)*4;
    const [r,g,b,a]=[frame.data[i],frame.data[i+1],frame.data[i+2],frame.data[i+3]];
    // Distinct bright opaque ivory pixels are in the master pointer. Exclude
    // transparent anti-aliasing, dark shaft shadow and the pivot cap.
    if(a<125||r<155||g<150||b<125||Math.abs(r-g)>75||r<b-12)continue;
    const w=(a/255)*(r+g+b)/765;
    weightedX+=x*w;weight+=w;number++;
   }
   if(number>=1&&number<=19&&weight>0)rows.push({y,x:weightedX/weight,n:number});
  }
  if(rows.length<9)return Object.freeze({version:VERSION,status:'REVIEW_REQUIRED',
   reason:'NOT_ENOUGH_BRIGHT_TIP_PIXELS',sampleRows:rows.length,correctionDeg:0,tip:null});
  const selected=rows.slice(0,Math.min(30,rows.length));
  const xs=selected.map(p=>p.x).sort((a,b)=>a-b);
  const medianX=xs[Math.floor(xs.length/2)];
  const ys=selected.map(p=>p.y).sort((a,b)=>a-b);
  const medianY=ys[Math.floor(ys.length/2)];
  const degrees=Math.atan2(medianX-shaft.x,shaft.y-medianY)*180/Math.PI;
  if(!valid(degrees)||Math.abs(degrees)>6||medianY>55)
   return Object.freeze({version:VERSION,status:'REVIEW_REQUIRED',
    reason:'TIP_AXIS_OUTSIDE_MEASUREMENT_BOUNDS',sampleRows:rows.length,
    correctionDeg:0,tip:{x:medianX,y:medianY},measuredBiasDeg:degrees});
  return Object.freeze({version:VERSION,status:'PHOTO_VERIFIED',sampleRows:rows.length,
   tip:{x:medianX,y:medianY},masterPivot:{...shaft},
   measuredBiasDeg:degrees,correctionDeg:-degrees,
   evidence:'ORIGINAL_TRANSPARENT_PHOTO_IMAGE_PIXEL_CENTROID'});
 }
 const renderAngle=(calibrated,correction=0)=>{if(!valid(calibrated)||!valid(correction))throw Error('Nonfinite optical angle');return calibrated+correction;};
 const tipAt=(rotation,physicalRadius)=>({x:physicalRadius*Math.sin(rotation*Math.PI/180),
  y:-physicalRadius*Math.cos(rotation*Math.PI/180)});
 return Object.freeze({VERSION,measure,renderAngle,tipAt,shaft});
});
