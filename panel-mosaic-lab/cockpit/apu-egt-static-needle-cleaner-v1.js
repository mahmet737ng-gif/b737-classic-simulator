/* APU EGT + APU A.C. AMPS (OH12) photo pointer cleanup, display-only.
 * Protected OH12 PNG is never modified or overwritten. A derived in-memory
 * bitmap restores the small photo-baked white pointer so the ONE live SVG
 * needle can sweep away from its red-circled zero without a phantom at ~400C.
 * Native coordinates are bounded to the original APU EGT black dial.
 */
(function(root){
 'use strict';
 const WIDTH=1024,HEIGHT=1536;
 // Source-native footprint of the original pointer, including its antialias.
 // This is limited to the inner face: no bezel, red zero tick or outer scales.
 const footprint=Object.freeze([[290,1288],[309,1290],[322,1299],[329,1314],
  [323,1338],[217,1392],[191,1407],[182,1405],[192,1386],[287,1322]]);
 // The second photo-baked pointer is inside OH12 APU A.C. AMPS at ~35A.
 // The original sealed OH12 bitmap is never modified; use one derived photo
 // for both needles to avoid competing writers and source texture flicker.
 const apuAmpsFootprint=Object.freeze([[614,1258],[631,1264],[735,1326],
  [740,1340],[709,1340],[644,1291],[614,1274]]);
 const footprints=Object.freeze([footprint,apuAmpsFootprint]);
 const stats={status:'NOT_STARTED',restoredPixels:0,sourceDimensions:null,lastError:null};
 let sourcePromise=null,derivedUrl=null,swapCount=0;
 const sourceUrl=()=>new URL('../assets/locked/2026-10-23/OH12-BUS-TRANS-09319c17e7d0.png',document.baseURI).href;
 function inPolygon(px,py,polygon=footprint){
  let yes=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const a=polygon[i],b=polygon[j];
   if((a[1]>py)!==(b[1]>py) && px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])yes=!yes;
  }
  return yes;
 }
 function cleanedImage(image){
  const w=image.naturalWidth,h=image.naturalHeight;
  if(w!==WIDTH||h!==HEIGHT)throw Error('OH12 image dimensions differ from protected 1024x1536 source');
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Canvas 2D is unavailable');
  ctx.drawImage(image,0,0);
  const frame=ctx.getImageData(0,0,w,h),src=frame.data;
  const dst=new Uint8ClampedArray(src),mask=new Uint8Array(w*h);
  const xs=footprints.flatMap(poly=>poly.map(v=>v[0])),ys=footprints.flatMap(poly=>poly.map(v=>v[1]));
  const x0=Math.max(0,Math.floor(Math.min(...xs))-2),x1=Math.min(w-1,Math.ceil(Math.max(...xs))+2);
  const y0=Math.max(0,Math.floor(Math.min(...ys))-2),y1=Math.min(h-1,Math.ceil(Math.max(...ys))+2);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   if(footprints.some(poly=>inPolygon(x+.5,y+.5,poly)))mask[y*w+x]=1;
  }
  let count=0;
  const donors=[[0,-10],[0,10],[-10,-4],[10,4],[0,-20],[0,20],
   [-20,0],[20,0],[-30,-10],[30,10],[-40,0],[40,0],[-50,-15],[50,15]];
  // Restore only needle silhouette with nearby untouched dark photo texture.
  // Reject white printed scale/numerals to avoid ghost ticks through the paint.
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   if(!mask[y*w+x])continue;
   let r=0,g=0,b=0,ws=0;
   for(const [dx,dy] of donors){
    const sx=x+dx,sy=y+dy;
    if(sx<0||sx>=w||sy<0||sy>=h||mask[sy*w+sx])continue;
    const i=(sy*w+sx)*4;
    const luminance=(src[i]+src[i+1]+src[i+2])/3;
    if(luminance>90)continue;
    const d=Math.hypot(dx,dy),weight=1/(d*d);
    r+=src[i]*weight;g+=src[i+1]*weight;b+=src[i+2]*weight;ws+=weight;
   }
   if(!ws)continue; // Do not invent content if the original cannot be sampled.
   const j=(y*w+x)*4;
   dst[j]=Math.round(r/ws);dst[j+1]=Math.round(g/ws);dst[j+2]=Math.round(b/ws);
   count++;
  }
  stats.restoredPixels=count;
  frame.data.set(dst);ctx.putImageData(frame,0,0);
  return new Promise((resolve,reject)=>
   canvas.toBlob(blob=>blob?resolve(blob):reject(Error('Cannot encode OH12 display photo')),'image/png'));
 }
 function ensure(){
  if(sourcePromise)return sourcePromise;
  stats.status='LOADING_PROTECTED_PHOTO';
  sourcePromise=new Promise((resolve,reject)=>{
   const image=new Image();
   image.onload=async()=>{
    try{
     stats.sourceDimensions=[image.naturalWidth,image.naturalHeight];
     stats.status='RESTORING_STATIC_POINTER';
     const blob=await cleanedImage(image);
     derivedUrl=URL.createObjectURL(blob);
     stats.status='READY';resolve(derivedUrl);
    }catch(error){stats.status='FAILED';stats.lastError=String(error);reject(error);}
   };
   image.onerror=()=>reject(Error('OH12 protected photo failed to load'));
   image.src=sourceUrl();
  });
  return sourcePromise;
 }
 const active=new WeakMap(),observed=new WeakSet();
 function cleanPiece(piece){
  if(!piece?.isConnected)return Promise.resolve(false);
  const photos=[...piece.querySelectorAll('.atlas-photo')];
  if(!photos.length)return Promise.resolve(false);
  // Prevent the performance LOD system from reinserting the baked pointer.
  photos.forEach(photo=>photo.removeAttribute('data-perf-source'));
  if(derivedUrl&&photos.every(photo=>photo.src===derivedUrl)){piece.dataset.apuEgtPhoto='CLEANED';return Promise.resolve(true);}
  const current=active.get(piece);if(current)return current;
  piece.dataset.apuEgtPhoto='PENDING';
  const job=ensure().then(url=>{
   if(!piece.isConnected)return false;
   for(const photo of [...piece.querySelectorAll('.atlas-photo')]){
    photo.removeAttribute('data-perf-source');
    if(photo.src!==url){photo.src=url;swapCount++;}
   }
   piece.dataset.apuEgtPhoto='CLEANED';
   return true;
  }).catch(error=>{
   piece.dataset.apuEgtPhoto='FAILED';stats.lastError=String(error);
   console.error('APU EGT static pointer cleanup failed; protected photo retained',error);
   return false;
  }).finally(()=>active.delete(piece));
  active.set(piece,job);return job;
 }
 function watchPiece(piece){
  if(!piece||observed.has(piece))return;
  observed.add(piece);
  const observer=new MutationObserver(records=>{
   if(!piece.isConnected){observer.disconnect();return;}
   if(!derivedUrl)return;
   if(records.some(record=>record.type==='attributes'&&record.attributeName==='src'
      &&record.target.matches('.atlas-photo')&&record.target.src!==derivedUrl))
    cleanPiece(piece);
  });
  observer.observe(piece,{subtree:true,attributes:true,attributeFilter:['src']});
 }
 root.B737APUEGTStaticCleaner=Object.freeze({
  cleanPiece,watchPiece,status:()=>({...stats,swapCount}),footprint,apuAmpsFootprint
 });
})(window);
