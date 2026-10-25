/* TGL-0004: non-destructive socket cleanup behind the transparent toggle art.
 * Read the original, locked panel photograph; paint only a small local patch.
 * No source pixels, atlas geometry, panel labels or saved switch state are edited.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root)root.B737ToggleSocketCleanup=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const SAMPLE_SIZE=128,REPAIR_RADIUS_RATIO=.82,FEATHER_RATIO=.085;
 const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
 const median=values=>{const a=values.slice().sort((x,y)=>x-y);return a.length?a[Math.floor(a.length/2)]:0;};
 function colorAt(data,x,y,size=SAMPLE_SIZE){
   const ix=clamp(Math.round(x),0,size-1),iy=clamp(Math.round(y),0,size-1),o=(iy*size+ix)*4;
   return [data[o],data[o+1],data[o+2]];
 }
 // Sample around the outside of the old knob rather than using its grey, white
 // or bright-metal pixels; robust median rejects letters and neighbouring bolts.
 function estimate(data,size=SAMPLE_SIZE){
   const channels=[[],[],[]],compass=[[],[],[],[]];
   const center=(size-1)/2;
   for(let i=0;i<96;i++){
     const theta=Math.PI*2*i/96;
     for(const rad of [.84,.91]){
       const c=colorAt(data,center+center*rad*Math.cos(theta),center+center*rad*Math.sin(theta),size);
       for(let k=0;k<3;k++)channels[k].push(c[k]);
       compass[Math.floor(i/24)].push(c);
     }
   }
   const base=channels.map(median);
   const segments=compass.map(arr=>[0,1,2].map(k=>median(arr.map(c=>c[k]))));
   const delta=(a,b)=>a.map((v,k)=>clamp((v-b[k])*.5,-10,10));
   return {base,dx:delta(segments[0],segments[2]),dy:delta(segments[1],segments[3])};
 }
 function patchToImageData(imageData,background,diameter){
   const {width,height,data}=imageData;
   const cx=(width-1)/2,cy=(height-1)/2;
   const maxR=Math.min(cx,cy)*REPAIR_RADIUS_RATIO/(1.15);
   const feather=Math.max(2,maxR*FEATHER_RATIO);
   for(let y=0;y<height;y++)for(let x=0;x<width;x++){
     const dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy),o=(y*width+x)*4;
     if(d>=maxR){data[o+3]=0;continue;}
     const u=dx/Math.max(maxR,1),v=dy/Math.max(maxR,1);
     const noise=1.2*Math.sin(x*12.9898+y*78.233);
     for(let k=0;k<3;k++)data[o+k]=clamp(Math.round(background.base[k]+background.dx[k]*u+background.dy[k]*v+noise),0,255);
     const alpha=d<=maxR-feather?255:Math.round(255*(maxR-d)/feather);
     data[o+3]=alpha;
   }
   return imageData;
 }
 // output is a small RGBA patch, composed UNDER the approved five-state sprite.
 function render(canvas,photo,sourcePoint,sourceDiameter,displayDiameter){
   if(!canvas||!photo||!photo.complete||!photo.naturalWidth||!photo.naturalHeight)return false;
   if(!Array.isArray(sourcePoint)||sourcePoint.length!==2||!(sourceDiameter>0&&displayDiameter>0))return false;
   const canvasSize=Math.max(88,Math.ceil(displayDiameter*2.45));
   canvas.width=canvas.height=canvasSize;
   const ctx=canvas.getContext('2d',{willReadFrequently:true});
   if(!ctx)return false;
   const halfSrc=sourceDiameter*1.15;
   const sample=document.createElement('canvas');sample.width=sample.height=SAMPLE_SIZE;
   const sx=sample.getContext('2d',{willReadFrequently:true});
   if(!sx)return false;
   sx.drawImage(photo,sourcePoint[0]-halfSrc,sourcePoint[1]-halfSrc,halfSrc*2,halfSrc*2,0,0,SAMPLE_SIZE,SAMPLE_SIZE);
   const background=estimate(sx.getImageData(0,0,SAMPLE_SIZE,SAMPLE_SIZE).data);
   const pixels=ctx.createImageData(canvasSize,canvasSize);
   patchToImageData(pixels,background,displayDiameter);
   ctx.putImageData(pixels,0,0);
   canvas.style.width=canvasSize+'px';canvas.style.height=canvasSize+'px';
   canvas.dataset.cleaned='true';
   return true;
 }
 return Object.freeze({render,estimate,patchToImageData,REPAIR_RADIUS_RATIO});
});