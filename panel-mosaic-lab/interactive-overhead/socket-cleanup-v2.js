/* TGL-0005: transparent, non-destructive restoration of legacy photographed
 * switch footprints. NO black discs, NO opaque background, and NO source edits.
 * Only a feathered, localized panel-color interpolation under each new switch.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ToggleSocketCleanup=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const SAMPLE_SIZE=176,REPAIR_RADIUS_RATIO=.76,FEATHER_RATIO=.20;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const median=values=>{if(!values.length)return 0;const a=[...values].sort((x,y)=>x-y);return a[Math.floor(a.length/2)];};
 const luma=c=>Math.round(c[0]*.2126+c[1]*.7152+c[2]*.0722);
 const colorAt=(data,x,y,size)=>{
  const ix=clamp(Math.round(x),0,size-1),iy=clamp(Math.round(y),0,size-1),k=(iy*size+ix)*4;
  return [data[k],data[k+1],data[k+2]];
 };
 function estimate(data,size=SAMPLE_SIZE){
  const mid=(size-1)/2,candidates=[],bins=new Array(16).fill(0);
  // Radius is expressed as fraction of the source crop half-size (1.95 x
  // the original nut diameter). Thus the sampled perimeter is 1.11–1.54
  // full bezel diameters out, beyond the photographed white/metal handle.
  for(let i=0;i<192;i++){
   const angle=2*Math.PI*i/192;
   for(const r of [.57,.66,.73,.79]){
    const c=colorAt(data,mid+mid*r*Math.cos(angle),mid+mid*r*Math.sin(angle),size);
    candidates.push({c,y:luma(c),sin:Math.sin(angle),cos:Math.cos(angle)});
    bins[clamp(Math.floor(luma(c)/16),0,15)]++;
   }
  }
  // Dominant-cluster sampling avoids the original black socket, silver
  // reflections, white legends and adjoining hardware/bolts.
  let chosen=0,score=-1;
  for(let b=1;b<15;b++){
   const count=bins[b-1]+bins[b]+bins[b+1];
   if(count>=score){chosen=b;score=count;}
  }
  const center=chosen*16+8;
  let filtered=candidates.filter(p=>Math.abs(p.y-center)<=27);
  if(filtered.length<candidates.length*.13){
    const central=median(candidates.map(p=>p.y));
    filtered=candidates.filter(p=>Math.abs(p.y-central)<=35);
  }
  const base=[0,1,2].map(k=>median(filtered.map(p=>p.c[k])));
  // If the broad sample contains a brighter metal-panel cluster, an
  // isolated dark socket must never become a manufactured black disc.
  const hi=candidates.filter(p=>p.y>=90);
  if(luma(base)<60&&hi.length>candidates.length*.35){
    const bright=[0,1,2].map(k=>median(hi.map(p=>p.c[k])));
    for(let i=0;i<3;i++)base[i]=bright[i];
  }
  const sides=[filtered.filter(p=>p.cos>.65),filtered.filter(p=>p.cos<-.65),filtered.filter(p=>p.sin>.65),filtered.filter(p=>p.sin<-.65)];
  const channel=(a,k)=>a.length?median(a.map(p=>p.c[k])):base[k];
  const dx=[0,1,2].map(k=>clamp((channel(sides[0],k)-channel(sides[1],k))*.25,-7,7));
  const dy=[0,1,2].map(k=>clamp((channel(sides[2],k)-channel(sides[3],k))*.25,-7,7));
  return {base,dx,dy,samples:filtered.length};
 }
 function patchToImageData(imageData,background,diameter){
  const {width,height,data}=imageData,cx=(width-1)/2,cy=(height-1)/2;
  const radius=diameter*REPAIR_RADIUS_RATIO,feather=diameter*FEATHER_RATIO;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const ox=x-cx,oy=y-cy,r=Math.hypot(ox,oy),j=(y*width+x)*4;
   if(r>=radius){data[j+3]=0;continue;}
   const nx=ox/Math.max(radius,1),ny=oy/Math.max(radius,1);
   const noise=0.75*Math.sin(x*3.18+y*8.14);
   for(let k=0;k<3;k++)data[j+k]=clamp(Math.round(background.base[k]+background.dx[k]*nx+background.dy[k]*ny+noise),0,255);
   const t=clamp((radius-r)/feather,0,1);
   data[j+3]=Math.round(255*t*t*(3-2*t)); // smooth edge, no circular seam
  }
  return imageData;
 }
 function render(canvas,photo,sourcePoint,sourceDiameter,displayDiameter){
  if(!canvas||!photo||!photo.complete||!photo.naturalWidth||!photo.naturalHeight)return false;
  if(!Array.isArray(sourcePoint)||sourcePoint.length!==2||!(sourceDiameter>0&&displayDiameter>0))return false;
  const size=Math.max(48,Math.ceil(displayDiameter*1.58));
  canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return false;
  const sample=document.createElement('canvas');sample.width=sample.height=SAMPLE_SIZE;
  const sc=sample.getContext('2d',{willReadFrequently:true});
  if(!sc)return false;
  try{
   const half=sourceDiameter*1.95;
   sc.drawImage(photo,sourcePoint[0]-half,sourcePoint[1]-half,half*2,half*2,0,0,SAMPLE_SIZE,SAMPLE_SIZE);
   const background=estimate(sc.getImageData(0,0,SAMPLE_SIZE,SAMPLE_SIZE).data);
   const pixels=ctx.createImageData(size,size);
   patchToImageData(pixels,background,displayDiameter);
   ctx.putImageData(pixels,0,0);
   canvas.style.width=size+'px';canvas.style.height=size+'px';
   canvas.dataset.cleaned='v2';canvas.dataset.panelLuma=String(luma(background.base));
   return true;
  }catch(error){
   // Fail transparent rather than ever drawing a black or foreign backing.
   ctx.clearRect(0,0,size,size);canvas.dataset.cleaned='skipped';
   console.warn('Toggle photo cleanup skipped',error);return false;
  }
 }
 return Object.freeze({render,estimate,patchToImageData,REPAIR_RADIUS_RATIO,FEATHER_RATIO});
});