/* TGL-0007: transparent, narrow skin reconstruction beneath real toggle hardware.
 * This never modifies the locked original OH photo and never paints a black disc.
 */
(function(root,factory){
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ToggleSocketCleanup=api;
})(typeof globalThis==='undefined'?null:globalThis,function(){
 'use strict';
 const SIZE=160,REPAIR_RADIUS_RATIO=.49,FEATHER_RATIO=.14;
 const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
 const median=arr=>{const s=arr.slice().sort((a,b)=>a-b);return s[Math.floor(s.length/2)]||0;};
 const luma=c=>c[0]*.2126+c[1]*.7152+c[2]*.0722;
 function chooseBackground(bytes,size=SIZE,placement=''){
  const cx=(size-1)/2,cy=(size-1)/2,available=[];
  // Ring samples begin outside the original photographed mounting nut.
  // Excluding its center is essential: the original recess is black.
  for(let i=0;i<256;i++){
   const a=2*Math.PI*i/256;
   for(const f of [.70,.78,.86,.93]){
    const x=clamp(Math.round(cx+cx*f*Math.cos(a)),0,size-1);
    const y=clamp(Math.round(cy+cy*f*Math.sin(a)),0,size-1);
    const o=(y*size+x)*4;
    if(bytes[o+3]<220)continue;
    const rgb=[bytes[o],bytes[o+1],bytes[o+2]];
    available.push({rgb,l:luma(rgb)});
   }
  }
  if(available.length<70)return null;
  const lights=available.map(x=>x.l).sort((a,b)=>a-b);
  // A 70th-percentile sample rejects the black photographed hole but
  // does not preferentially choose isolated bright white lettering.
  const target=lights[Math.floor(.70*(lights.length-1))];
  let skin=available.filter(x=>Math.abs(x.l-target)<=24);
  if(placement==='OH12'){
   const light=available.filter(x=>x.l>=155&&x.l<=246);
   // OH12 is a light silver panel, not a dark one. Never paint a dark disc.
   if(luma([median(skin.map(x=>x.rgb[0])),median(skin.map(x=>x.rgb[1])),median(skin.map(x=>x.rgb[2]))])<150){
    if(light.length<75)return null;
    skin=light;
   }
  }
  if(skin.length<30)return null;
  const base=[0,1,2].map(k=>median(skin.map(x=>x.rgb[k])));
  if(placement==='OH12'&&luma(base)<150)return null;
  return {base,estimatedLuma:luma(base),samples:skin.length};
 }
 function patchToImageData(img,sample,diameter){
  const {width,height,data}=img,cx=(width-1)/2,cy=(height-1)/2;
  const outer=Math.min((Math.min(width,height)-2)/2,REPAIR_RADIUS_RATIO*diameter);
  const feather=Math.min(outer*.62,FEATHER_RATIO*diameter);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const dx=x-cx,dy=y-cy,r=Math.hypot(dx,dy),o=(y*width+x)*4;
   if(r>=outer){data[o+3]=0;continue;}
   const t=clamp((outer-r)/feather,0,1),alpha=t*t*(3-2*t);
   for(let k=0;k<3;k++)data[o+k]=sample.base[k];
   data[o+3]=Math.round(255*alpha);
  }
  return img;
 }
 function render(canvas,photo,sourcePoint,sourceDiameter,displayDiameter,placement=''){
  if(!canvas||!photo||!photo.complete||!photo.naturalWidth||!photo.naturalHeight)return false;
  if(!Array.isArray(sourcePoint)||sourcePoint.length!==2||!(sourceDiameter>0&&displayDiameter>0))return false;
  const side=Math.max(48,Math.ceil(displayDiameter*1.24));
  canvas.width=canvas.height=side;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)return false;
  const probe=document.createElement('canvas');probe.width=probe.height=SIZE;
  const pctx=probe.getContext('2d',{willReadFrequently:true});if(!pctx)return false;
  try{
   const radius=sourceDiameter*1.8;
   pctx.drawImage(photo,sourcePoint[0]-radius,sourcePoint[1]-radius,radius*2,radius*2,0,0,SIZE,SIZE);
   const sample=chooseBackground(pctx.getImageData(0,0,SIZE,SIZE).data,SIZE,placement);
   if(!sample){ctx.clearRect(0,0,side,side);canvas.dataset.cleaned='skipped';return false;}
   const img=ctx.createImageData(side,side);
   patchToImageData(img,sample,displayDiameter);
   ctx.putImageData(img,0,0);
   canvas.style.width=side+'px';canvas.style.height=side+'px';
   canvas.dataset.cleaned='v3';canvas.dataset.panelLuma=String(Math.round(sample.estimatedLuma));
   return true;
  }catch(e){ctx.clearRect(0,0,side,side);canvas.dataset.cleaned='skipped';return false;}
 }
 return Object.freeze({render,chooseBackground,patchToImageData,REPAIR_RADIUS_RATIO,FEATHER_RATIO});
});