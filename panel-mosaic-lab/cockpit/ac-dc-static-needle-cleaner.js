/* OH10 STATIC-NEEDLE RESTORATION (MET-0012)
 * Owner's protected PNG is NEVER rewritten. A same-origin, client-side canvas
 * makes a temporary, derived displayed bitmap for the four photo-baked white
 * pointer silhouettes. Only polygon pixels are reconstructed from neighbouring
 * untouched source-photo pixels. All original scales, bezels and text OUTSIDE
 * these tiny polygons are bit-for-bit preserved in the rendered bitmap.
 * The separate pre-existing ac-dc-metering-needle.svg supplies moving needles.
 */
(function(root){
 'use strict';
 const SOURCE_WIDTH=1095,SOURCE_HEIGHT=1436;
 // Coordinates from owner screenshot at 2026-10-30 18:40, registered against
 // OH10's native image: screenshot origin 292.8,188 and scales .902,.930.
 // Polygon masks cover the four STATIC, WHITE wedges, not the gauge faces.
 const regions=Object.freeze({
  dcAmps: Object.freeze([[307,140],[314,157],[318,196],[332,274],[281,275],[299,190]]),
  cps: Object.freeze([[698,139],[721,143],[788,178],[790,193],[743,193]]),
  dcVolts: Object.freeze([[243,565],[264,575],[331,680],[275,681]]),
  acVolts: Object.freeze([[644,649],[670,656],[725,674],[797,679],[800,702],[716,701]])
 });
 const stats={status:'NOT_STARTED',sourceDimensions:null,cleanedPixelCount:0,
  regions:Object.keys(regions),lastError:null};
 let imagePromise=null,objectURL=null;
 const inside=(px,py,poly)=>{
  let result=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++){
   const a=poly[i],b=poly[j];
   if(((a[1]>py)!==(b[1]>py))&&(px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0]))result=!result;
  }
  return result;
 };
 function maskMap(width,height){
  const mark=new Uint8Array(width*height),areas=[];
  for(const [id,poly] of Object.entries(regions)){
   const xx=poly.map(p=>p[0]),yy=poly.map(p=>p[1]);
   const box={id,x0:Math.max(0,Math.floor(Math.min(...xx))-2),
    x1:Math.min(width-1,Math.ceil(Math.max(...xx))+2),
    y0:Math.max(0,Math.floor(Math.min(...yy))-2),
    y1:Math.min(height-1,Math.ceil(Math.max(...yy))+2)};
   areas.push(box);
   for(let y=box.y0;y<=box.y1;y++)for(let x=box.x0;x<=box.x1;x++){
    // Slight boundary dilation includes antialias halos without extending to
    // unrelated white tick marks outside the hand-audited pointer silhouette.
    if(inside(x+.5,y+.5,poly))mark[y*width+x]=1;
   }
  }
  return {mark,areas};
 }
 function renderCleanPhoto(img){
  const width=img.naturalWidth,height=img.naturalHeight;
  if(width!==SOURCE_WIDTH||height!==SOURCE_HEIGHT)
   throw Error('OH10 protected source dimensions changed; refuses cleanup');
  const canvas=document.createElement('canvas');
  canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0,width,height);
  const frame=ctx.getImageData(0,0,width,height),pixels=frame.data,restored=new Uint8ClampedArray(pixels);
  const {mark,areas}=maskMap(width,height);
  const B=root.B737AcDcMeteringModel;
  let count=0;
  // Sample unmodified photo pixels ONLY. Match black window vs blue lower
  // cover before averaging, so a seam cannot be filled with a grey white haze.
  const sample=(x,y,blue)=>{
   if(x<0||y<0||x>=width||y>=height||mark[y*width+x])return null;
   if(B&&B.blueBoundaryAt){
    const isBlue=y>=B.blueBoundaryAt(activeId,x);
    if(isBlue!==blue)return null;
   }
   const k=(y*width+x)*4,r=pixels[k],g=pixels[k+1],b=pixels[k+2];
   const luminance=(r+g+b)/3;
   if(luminance>(blue?174:126))return null; // reject white ticks, text, bezel
   if(blue&&luminance<44)return null;      // reject black screws inside blue
   return [r,g,b];
  };
  let activeId='';
  const offsets=[3,5,8,12,16,22,30,40,52,66,84];
  for(const box of areas){
   activeId=box.id;
   for(let y=box.y0;y<=box.y1;y++)for(let x=box.x0;x<=box.x1;x++){
    if(!mark[y*width+x])continue;
    let blue=true;
    if(B&&B.blueBoundaryAt)blue=y>=B.blueBoundaryAt(box.id,x);
    else blue=y>(box.id==='dcAmps'?188:box.id==='cps'?185:box.id==='dcVolts'?618:665);
    let rr=0,gg=0,bb=0,weight=0;
    for(const distance of offsets){
     // Horizontal donors preserve neighboring texture and the side-to-side
     // lighting gradient without ever sampling any of the original needle.
     const attempts=[[x-distance,y],[x+distance,y],[x-distance,y-3],
      [x+distance,y+3],[x,y-distance],[x,y+distance]];
     for(const [sx,sy] of attempts){
      const c=sample(sx,sy,blue);
      if(!c)continue;
      const d=Math.hypot(sx-x,sy-y);
      const w=1/Math.pow(Math.max(4,d),1.65);
      rr+=w*c[0];gg+=w*c[1];bb+=w*c[2];weight+=w;
     }
     if(weight>0.045)break;
    }
    const k=(y*width+x)*4;
    if(weight){
     restored[k]=Math.round(rr/weight);
     restored[k+1]=Math.round(gg/weight);
     restored[k+2]=Math.round(bb/weight);
    }else{
     // Keep safety transparent rather than injecting artificial color if no
     // source-photo material can be found. QA flags any unresolved pixel.
     stats.unresolvedPixels=(stats.unresolvedPixels||0)+1;
    }
    restored[k+3]=255;count++;
   }
  }
  stats.cleanedPixelCount=count;
  ctx.putImageData(new ImageData(restored,width,height),0,0);
  return new Promise((resolve,reject)=>{
   canvas.toBlob(blob=>blob?resolve(blob):reject(Error('OH10 derived photo encode failed')),'image/png');
  });
 }
 function ensureDerivedUrl(sourceUrl){
  if(imagePromise)return imagePromise;
  stats.status='LOADING_LOCKED_SOURCE';
  imagePromise=new Promise((resolve,reject)=>{
   const img=new Image();
   img.onload=async()=>{
    try{
     stats.sourceDimensions=[img.naturalWidth,img.naturalHeight];
     stats.status='RESTORING_BAKED_POINTERS';
     const blob=await renderCleanPhoto(img);
     objectURL=URL.createObjectURL(blob);
     stats.status='READY_DERIVED_PHOTO';
     resolve(objectURL);
    }catch(e){stats.status='FAILED';stats.lastError=String(e);reject(e);}
   };
   img.onerror=()=>{const e=Error('Original OH10 bitmap cannot be loaded');stats.status='FAILED';stats.lastError=String(e);reject(e);};
   img.src=sourceUrl;
  });
  return imagePromise;
 }
 // Always generate from the LOCKED full-resolution PNG, never from a temporary
 // performance thumbnail or a pre-existing partially cleaned image.
 const pristineSource=()=>new URL('../assets/locked/2026-10-23/OH10-ELEC-LOSSLESS-9a1ca4d6cfb2.png',document.baseURI).href;
 const inFlight=new WeakMap();
 let restoredAfterImageSwap=0;
 function cleanPiece(piece){
  if(!piece||!piece.isConnected)return Promise.resolve(false);
  const photos=[...piece.querySelectorAll('.atlas-photo')];
  if(!photos.length)return Promise.resolve(false);
  // Once the page is cleaned, ONLY this OH10 tile must not be replaced by
  // pre-generated unclean texture LODs from the progressive image loader.
  photos.forEach(photo=>photo.removeAttribute('data-perf-source'));
  if(objectURL&&photos.every(photo=>photo.src===objectURL)){
   piece.dataset.staticNeedlePhoto='CLEANED';
   return Promise.resolve(true);
  }
  const active=inFlight.get(piece);
  if(active)return active;
  piece.dataset.staticNeedlePhoto='PENDING';
  const job=ensureDerivedUrl(pristineSource()).then(url=>{
   if(!piece.isConnected)return false;
   for(const photo of [...piece.querySelectorAll('.atlas-photo')]){
    if(photo.src!==url){
     if(photo.src!==pristineSource())restoredAfterImageSwap++;
     photo.removeAttribute('data-perf-source');
     photo.src=url;
    }
   }
   piece.dataset.staticNeedlePhoto='CLEANED';
   return true;
  }).catch(error=>{
   piece.dataset.staticNeedlePhoto='FAILED';
   stats.lastError=String(error);
   console.error('OH10 derived static-needle cleanup failed; original source preserved',error);
   return false;
  }).finally(()=>inFlight.delete(piece));
  inFlight.set(piece,job);
  return job;
 }
 const watches=new WeakSet();
 function watchPiece(piece){
  if(!piece||watches.has(piece))return;
  watches.add(piece);
  const observer=new MutationObserver(records=>{
   if(!piece.isConnected){observer.disconnect();return;}
   if(!objectURL)return;
   const changed=records.some(record=>record.type==='attributes'&&record.attributeName==='src'
     &&record.target.matches('.atlas-photo')&&record.target.src!==objectURL);
   if(changed)cleanPiece(piece);
  });
  observer.observe(piece,{subtree:true,attributes:true,attributeFilter:['src']});
 }
 const getStatus=()=>Object.freeze({...stats,derivedPhotoLoaded:Boolean(objectURL),restoredAfterImageSwap});
 root.B737AcDcStaticCleaner=Object.freeze({regions,cleanPiece,watchPiece,ensureDerivedUrl,getStatus});
})(window);
