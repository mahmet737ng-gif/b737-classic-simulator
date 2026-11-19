(async()=>{
;
/* ./needle-boot-mask-v1.js?v=BOOT-MASK-0001 */
try{
/* The direct Gateway serves small, pixel-verified masks produced by the
 * existing needle cleaners. The atlas retains its own source, LOD and
 * geometry. Standalone views continue to run the original cleaners. */
(function(root){
 'use strict';
 const assets=root.B737GatewayBoot?.art;
 if(!assets)return;
 const images=new Map();
 function load(key){
  const asset=assets[key];
  if(!asset)return null;
  if(!images.has(key)){
   const image=new Image();
   const job=new Promise((resolve,reject)=>{
    image.onload=()=>image.naturalWidth===asset.width&&image.naturalHeight===asset.height?
     resolve(image):reject(Error('Needle mask dimensions changed'));
    image.onerror=()=>reject(Error('Needle mask unavailable'));
    image.src=asset.url;
   });
   images.set(key,job);
  }
  return images.get(key);
 }
 function apply(piece,key){
  const pending=load(key);
  if(!pending)return null;
  return pending.then(image=>{
   if(!piece.isConnected)return false;
   const photos=piece.querySelectorAll('.atlas-source-strip > .atlas-photo');
   if(!photos.length)return null;
   for(const photo of photos){
    const strip=photo.parentElement;
    if(strip.querySelector('.boot-needle-mask'))continue;
    const layer=image.cloneNode(false);
    layer.className='boot-needle-mask';
    layer.style.cssText=photo.style.cssText;
    layer.style.pointerEvents='none';
    layer.alt='';layer.setAttribute('aria-hidden','true');layer.draggable=false;
    photo.after(layer);
   }
   return true;
  }).catch(()=>null);
 }
 root.B737NeedleBootMask=Object.freeze({apply});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./ac-dc-static-needle-cleaner.js?v=MET-0012-BOOT-MASK */
try{
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
 function cleanOriginal(piece){
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
 const maskJobs=new WeakMap();
 function cleanPiece(piece){
  if(!piece?.isConnected)return Promise.resolve(false);
  if(maskJobs.has(piece))return maskJobs.get(piece);
  const patch=root.B737NeedleBootMask?.apply(piece,'oh10');
  if(!patch)return cleanOriginal(piece);
  const job=patch.then(ready=>{
   if(ready===null)return cleanOriginal(piece);
   if(ready){
    piece.dataset.staticNeedlePhoto='CLEANED';
    piece.dataset.needleRestoration='RELEASE_MASK';
    stats.status='READY_RELEASE_MASK';
    const {width,height,changed}=root.B737GatewayBoot.art.oh10;
    stats.sourceDimensions=[width,height];
    stats.cleanedPixelCount=changed;
   }
   return ready;
  }).finally(()=>maskJobs.delete(piece));
  maskJobs.set(piece,job);
  return job;
 }
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
 const getStatus=()=>Object.freeze({...stats,derivedPhotoLoaded:Boolean(objectURL)||stats.status==='READY_RELEASE_MASK',restoredAfterImageSwap});
 root.B737AcDcStaticCleaner=Object.freeze({regions,cleanPiece,watchPiece,ensureDerivedUrl,getStatus});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./ac-dc-metering-unified.js?v=MET-0012-LOADER-GUARD */
try{
(function(){
 'use strict';
 const model=window.B737AcDcMeteringModel;
 const ns='http://www.w3.org/2000/svg';
 const imageUrl=new URL('./ac-dc-metering-needle.svg?v=MET-0001',document.baseURI).href;
 const state=Object.fromEntries(model.meters.map(meter=>[meter.id,meter.initialAngle]));
 const samples=Object.fromEntries(model.meters.map(meter=>[meter.id,null]));
 let acMode='NORMAL';
 const mounted=new Map();
 const current=Object.fromEntries(model.meters.map(meter=>[meter.id,{angle:model.limitAngle(meter.id,meter.initialAngle),velocity:0,lastDirection:0}]));
 let animationFrame=0,lastFrameTime=null;
 const outputs=new Map();
 const inputs=new Map();
 let frame=null,frameObserver=null,observedHost=null;
 const svg=(doc,parent,tag,attrs={})=>{
  const element=doc.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))element.setAttribute(key,String(value));
  parent.append(element);return element;
 };
 const photoVerified=id=>Boolean(model.photoScale[id]?.readoutApprovedForPreview);
 function animate(time){
  animationFrame=0;
  const dt=lastFrameTime===null?1/60:Math.max(0,Math.min(model.motion.maxStepSeconds,(time-lastFrameTime)/1000));
  lastFrameTime=time;
  let moving=false;
  for(const meter of model.meters){
   const id=meter.id,blade=mounted.get(id);
   if(!blade)continue;
   const v=current[id],target=model.limitAngle(id,state[id]);
   const desiredDirection=Math.sign(target-v.angle);
   // A target reversal is a new movement, not a spring ricochet. Restart the
   // speed ramp rather than instantly reversing at the previous high speed.
   if(desiredDirection!==0&&v.lastDirection&&v.lastDirection!==desiredDirection)v.velocity=0;
   if(desiredDirection!==0)v.lastDirection=desiredDirection;
   const next=model.advanceNeedle(v.angle,v.velocity,target,dt);
   // At EVERY frame, the existing sprite rotates about its fixed 256,256
   // pivot. The 216px master tip maps exactly to the native per-gauge radius.
   const a=model.limitAngle(id,next.angle);
   v.angle=a;v.velocity=next.velocity;
   blade.style.transform='rotate('+a.toFixed(6)+'deg)';
   if(!next.done)moving=true;
  }
  if(moving){animationFrame=requestAnimationFrame(animate);}
  else lastFrameTime=null;
 }
 function requestMotion(){
  if(!animationFrame&&mounted.size){lastFrameTime=null;animationFrame=requestAnimationFrame(animate);}
 }
 function paint(id){
  const blade=mounted.get(id);
  if(blade)requestMotion();
  const output=outputs.get(id),input=inputs.get(id),sc=model.photoScale[id],sample=samples[id];
  const residual=id==='acVolts'&&acMode==='RESIDUAL';
  const parked=sample!==null&&!residual&&sample<sc.values[0];
  const quality=photoVerified(id)?'PHOTO TICKS':'PROVISIONAL SCALE';
  if(output)output.textContent=sample===null?
    (state[id].toFixed(2)+'° · ANGLE / PARK QA'):
    (parked?'NO INDICATION · PARKED':
     sample.toFixed(1)+' '+sc.unit+(residual?' · RESIDUAL 0–30V':'')+' · '+state[id].toFixed(2)+'° · '+quality);
  if(input)input.value=String(sample===null?sc.values[0]:sample);
 }
 function setAngle(id,value){
  if(!model.meters.some(meter=>meter.id===id))throw Error('Unknown AC/DC meter '+id);
  state[id]=model.limitAngle(id,model.angle(value));samples[id]=null;paint(id);return state[id];
 }
 function setReading(id,value,{mode}={}){
  if(!model.meters.some(meter=>meter.id===id))throw Error('Unknown AC/DC meter '+id);
  if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('Non-finite AC/DC meter reading');
  if(mode!==undefined&&(id!=='acVolts'||!['NORMAL','RESIDUAL'].includes(mode)))throw Error('Invalid meter scale mode');
  if(id==='acVolts'&&value!==null&&(mode||acMode)==='RESIDUAL'&&(value<0||value>30))throw Error('Residual voltage must be 0–30V');
  if(id==='acVolts'&&mode!==undefined)acMode=mode;
  const angle=id==='acVolts'?model.angleForAcVolts(value,{mode:acMode}):model.angleForIndication(id,value);
  state[id]=model.limitAngle(id,angle);samples[id]=value;paint(id);return state[id];
 }
 function setReadings(readings,{acVoltsMode}={}){
  if(!readings||typeof readings!=='object'||Array.isArray(readings))throw Error('Expected named meter samples');
  if(acVoltsMode!==undefined&&!['NORMAL','RESIDUAL'].includes(acVoltsMode))throw Error('Invalid AC voltage mode');
  // Validate everything before changing any pointer; a malformed sample cannot
  // leave the four needles in a partially applied state.
  const entries=Object.entries(readings);
  for(const [id,value] of entries){
   if(!model.meters.some(m=>m.id===id))throw Error('Unknown meter sample '+id);
   if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)))throw Error('Meter sample must be finite or null');
  }
  if((acVoltsMode||acMode)==='RESIDUAL'&&entries.some(([id,value])=>id==='acVolts'&&value!==null&&(value<0||value>30)))throw Error('Residual sample out of 0–30V scale');
  if(acVoltsMode!==undefined)acMode=acVoltsMode;
  for(const [id,value] of entries)setReading(id,value);
  return getReadings();
 }
 function getReadings(){return {...samples};}
 function setAngles(values){
  for(const [id,value]of Object.entries(values||{}))setAngle(id,value);
  return {...state};
 }
 function mount(doc,host){
  const piece=host.querySelector('.atlas-piece[data-key="OH10"]');
  if(!piece)return false;
  // The protected OH10 photo itself still contains four static white wedges.
  // Before animating, restore only those wedges in a temporary client-side
  // display bitmap. Never overwrite the original locked photo.
  const cleaner=window.B737AcDcStaticCleaner;
  if(cleaner){cleaner.watchPiece(piece);cleaner.cleanPiece(piece);}
  // Remove pre-MET-0009 siblings in atlasAbsolute. The new pointer layers are
  // children of the actual OH10 article, so image/camera movement is shared.
  host.querySelectorAll(':scope > [data-metering-needle]').forEach(node=>node.remove());
  const box={x:parseFloat(piece.style.left),y:parseFloat(piece.style.top),
             w:parseFloat(piece.style.width),h:parseFloat(piece.style.height)};
  for(const meter of model.meters){
   const old=piece.querySelector('[data-metering-needle="'+meter.id+'"]');
   if(old&&old.getAttribute('data-geometry-version')==='MET-0012-LOADER-GUARD'){
    const blade=old.querySelector('[data-needle-blade]');
    if(blade)mounted.set(meter.id,blade);
    continue;
   }
   if(old)old.remove();
   const p=model.placement(box,meter);
   const layer=svg(doc,piece,'svg',{'data-metering-needle':meter.id,
    'data-geometry-version':'MET-0012-LOADER-GUARD',
    viewBox:'0 0 512 512',preserveAspectRatio:'none',
    role:'img','aria-label':meter.label+' original pointer'});
   // Local photo coordinates: never position a pointer on the atlas root.
   Object.assign(layer.style,{position:'absolute',
    left:(p.x-box.x-p.sizeX/2)+'px',top:(p.y-box.y-p.sizeY/2)+'px',
    width:p.sizeX+'px',height:p.sizeY+'px',
    zIndex:'1000',pointerEvents:'none',overflow:'visible'});
   const defs=svg(doc,layer,'defs');
   const clip=svg(doc,defs,'clipPath',{id:'metering-window-'+meter.id,clipPathUnits:'userSpaceOnUse'});
   svg(doc,clip,'path',{d:model.blackWindowPath(meter.id)});
   const visible=svg(doc,layer,'g',{'clip-path':'url(#metering-window-'+meter.id+')'});
   const blade=svg(doc,visible,'g',{'data-needle-blade':meter.id});
   Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'none'});
   svg(doc,blade,'image',{href:imageUrl,x:0,y:0,width:512,height:512});
   mounted.set(meter.id,blade);
   current[meter.id]={angle:model.limitAngle(meter.id,state[meter.id]),velocity:0,lastDirection:0};
   blade.style.transform='rotate('+current[meter.id].angle+'deg)';
   paint(meter.id);
  }
  return true;
 }
 function bindFrame(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  if(!host)return;
  if(observedHost!==host){
   if(frameObserver)frameObserver.disconnect();
   observedHost=host;
   // Keep this observer active. populateAssembly() replaces ALL atlas children
   // after mode changes; a one-shot observer silently loses every pointer.
   frameObserver=new MutationObserver(()=>mount(doc,host));
   frameObserver.observe(host,{childList:true});
  }
  mount(doc,host);
 }
 function connectFrame(){
  const next=document.getElementById('overheadFrame');
  if(!next||next===frame)return;
  if(frameObserver)frameObserver.disconnect();
  frameObserver=null;observedHost=null;
  frame=next;
  frame.addEventListener('load',()=>{
   if(animationFrame)cancelAnimationFrame(animationFrame);
   animationFrame=0;lastFrameTime=null;mounted.clear();
   if(frameObserver)frameObserver.disconnect();
   frameObserver=null;observedHost=null;
   bindFrame();
  });
  bindFrame();
 }
 function controls(){
  const section=document.createElement('section');section.id='unifiedAcDcMeteringNeedles';
  const title=document.createElement('h2');title.textContent='AC / DC METERING · MET-0011 · ORIGINAL 4 NEEDLES';section.append(title);
  const note=document.createElement('p');note.className='muted';
  note.textContent='The four original gauges and needles remain unchanged. Motion follows printed ticks at a fixed needle-tip radius with a 70°/s speed limit and smooth acceleration. DC AMPS/VOLTS are photo-tick calibrated; CPS and AC VOLTS still require radius and pivot QA.';
  section.append(note);
  const verify=document.createElement('button');verify.type='button';
  verify.textContent='Verify OH-10 Cleanup and Version';
  const status=document.createElement('pre');
  status.style.cssText='direction:ltr;white-space:pre-wrap;overflow-wrap:anywhere;text-align:left;font-size:11px;line-height:1.55;max-width:100%;color:#e6e8dd';
  function checkStatus(){
    const cleaner=window.B737AcDcStaticCleaner;
    const summary=cleaner?.getStatus();
    const doc=frame?.contentDocument,oh10=doc?.querySelector('.atlas-piece[data-key="OH10"]');
    const data={
      build:'MET-0012-LOADER-GUARD',
      currentModelAxes:model.meters.map(m=>m.id+':'+m.tipRadiusX.toFixed(1)+'x'+m.tipRadiusY.toFixed(1)).join(' / '),
      originalOH10Locked:true,
      originalNeedleLocked:true,
      sourceCleanerLoaded:Boolean(cleaner),
      photoStatus:oh10?.dataset.staticNeedlePhoto||'OH10_NOT_MOUNTED',
      cleanerState:summary?.status||'NOT_LOADED',
      cleanedPixels:summary?.cleanedPixelCount||0,
      photoSwapsRepaired:summary?.restoredAfterImageSwap||0,
      unresolvedPixels:summary?.unresolvedPixels||0,
      interactiveNeedles:oh10?.querySelectorAll('[data-metering-needle]').length||0,
      photoSource:oh10?.querySelector('.atlas-photo')?.currentSrc?.startsWith('blob:')?'DERIVED_DISPLAY_BLOB':'ORIGINAL_SOURCE_OR_NOT_LOADED'
    };
    status.textContent=Object.entries(data).map(([k,v])=>k+': '+v).join('\n');
  }
  verify.addEventListener('click',checkStatus);section.append(verify,status);
  checkStatus();
  for(const meter of model.meters){
   const sc=model.photoScale[meter.id];
   const label=document.createElement('label');
   label.textContent=meter.label+(photoVerified(meter.id)?' · PHOTO SCALE ('+sc.unit+')':' · PROVISIONAL ('+sc.unit+')');
   label.style.display='block';label.style.direction='ltr';
   const input=document.createElement('input');
   Object.assign(input,{type:'range',
    min:String(['cps','acVolts'].includes(meter.id)?0:sc.values[0]),
    max:String(sc.values.at(-1)),step:'1'});
   input.style.width='100%';input.style.accentColor='#edf0e8';
   const output=document.createElement('output');
   output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';
   input.addEventListener('input',()=>setReading(meter.id,Number(input.value)));
   label.append(input,output);section.append(label);
   inputs.set(meter.id,input);outputs.set(meter.id,output);paint(meter.id);
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='Park Needles at Reference Positions';
  reset.addEventListener('click',()=>{
   for(const meter of model.meters)setAngle(meter.id,meter.initialAngle);
   acMode='NORMAL';
  });section.append(reset);
  const previous=document.querySelector('#unifiedFuelTemperatureNeedle');
  if(previous)previous.after(section);
  else document.querySelector('.overhead-tools')?.before(section);
 }
 function getRenderAudit(){
  return model.meters.map(meter=>{
   const blade=mounted.get(meter.id),node=blade?.ownerSVGElement;
   const rect=node?.getBoundingClientRect();
   const b=model.bounds(meter.id);
   return {id:meter.id,mounted:Boolean(node),pointerAsset:imageUrl,
    nativeCenter:{x:meter.x,y:meter.y},
    nativeEllipse:{rx:meter.tipRadiusX,ry:meter.tipRadiusY},
    allowedAngles:b,angleTarget:state[meter.id],
    screenSprite:rect?{x:rect.x,y:rect.y,width:rect.width,height:rect.height}:null,
    renderVersion:'MET-0012-LOADER-GUARD',staticPhotoStatus:node?.closest('.atlas-piece')?.dataset?.staticNeedlePhoto||'NOT_MOUNTED',photoPixelQACertified:false};
  });
 }
 window.B737UnifiedAcDcMetering=Object.freeze({
  version:'MET-0012-LOADER-GUARD',getAngles:()=>({...state}),getReadings,
  getScaleMode:()=>acMode,getRenderAudit,setReading,setReadings,setAngle,setAngles
 });
 window.addEventListener('b737:ac-dc-metering-angles',event=>{try{setAngles(event.detail);}catch(error){console.error(error);}});
 // Independent system adapter may provide actual metered samples. The core
 // electrical V7 is Boolean bus connectivity, NOT a calibrated voltage/amps sensor.
 window.addEventListener('b737:ac-dc-metering-readings',event=>{
  try{const d=event.detail||{};setReadings(d.readings||d,{acVoltsMode:d.acVoltsMode});}
  catch(error){console.error('AC/DC reading rejected',error);}
 });
 window.addEventListener('b737:cockpit-mounted',connectFrame);
 connectFrame();
 if(document.querySelector('.inspector'))controls();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./ac-dc-selector-model-v1.js?v=ACDC-DETENT-0001 */
try{
/* OH10 P5-13 source-selectors: owner-confirmed clockwise physical order.
 * NO change to original photograph, guarded switches, or meter needle sprite.
 * This model manages selecting an instrument's measured SOURCE, not switching
 * aircraft electrical buses. Measurements must be supplied by a real system
 * adapter; Electrical V7 Boolean buses cannot invent DC amps or AC frequency.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737AcDcSelectorModel=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const VERSION='ACDC-DETENT-0001';
 const DETENTS=Object.freeze({
  DC:Object.freeze(['STBY PWR','BAT BUS','BAT','APU BAT','TR1','TR2','TR3']),
  AC:Object.freeze(['STBY PWR','GND PWR','GEN1','APU GEN','GEN2','INV','TEST'])
 });
 // Seven physical stops on the visible selector arc, from lower-left through
 // top-center to lower-right, clockwise, with positive rotation clockwise.
 const ANGLES=Object.freeze([-135,-90,-45,0,45,90,135]);
 const SOCKETS=Object.freeze({
  DC:Object.freeze({x:306,y:1029,r:84,confidence:'PROVISIONAL_NATIVE_PIXEL_SOCKET'}),
  AC:Object.freeze({x:783,y:1029,r:84,confidence:'PROVISIONAL_NATIVE_PIXEL_SOCKET'})
 });
 const safeSide=side=>{if(!Object.hasOwn(DETENTS,side))throw Error('Unknown selector '+side);return side;};
 const indexOf=(side,position)=>{safeSide(side);const i=DETENTS[side].indexOf(position);if(i<0)throw Error('Unknown '+side+' detent '+position);return i;};
 const label=(side,index)=>{safeSide(side);if(!Number.isInteger(index)||index<0||index>=7)throw Error('Out of-range detent');return DETENTS[side][index];};
 const angle=(side,index)=>{label(side,index);return ANGLES[index];};
 const fromAngle=(side,degrees)=>{safeSide(side);if(!Number.isFinite(degrees))throw Error('Invalid angle');return Math.max(0,Math.min(6,Math.round((degrees+135)/45)));};
 const suffix=(side,pos)=>side==='DC'?'dc':'ac';
 function create(){
  let indexes={DC:2,AC:2}; // BAT and GEN1, stable initial choices; no asserted electrical measurements
  const sources={DC:Object.create(null),AC:Object.create(null)};
  let revision=0;
  function read(side){safeSide(side);const index=indexes[side];return Object.freeze({side,index,position:label(side,index),angle:angle(side,index),revision});}
  function select(side,index){
   label(side,index);
   if(index!==indexes[side]){indexes[side]=index;revision++;}
   return read(side);
  }
  function choose(side,position){return select(side,indexOf(side,position));}
  function step(side,delta){safeSide(side);if(!Number.isInteger(delta))throw Error('Step must be integer');return select(side,Math.min(6,Math.max(0,indexes[side]+delta)));}
  function setSourceMeasurement(side,position,measurement){
   indexOf(side,position);
   if(measurement!==null&&(typeof measurement!=='object'||Array.isArray(measurement)))throw Error('Measurement must be object or null');
   const allowed=side==='DC'?['volts','amps']:['volts','cps'];
   const valid=Object.create(null);
   if(measurement!==null)for(const [key,v] of Object.entries(measurement)){
    if(!allowed.includes(key))throw Error('Unknown meter field '+key);
    if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)))throw Error('Meter value must be finite or null');
    valid[key]=v;
   }
   sources[side][position]=measurement===null?null:valid;
   revision++;
   return read(side);
  }
  function readings(){
   const dc=read('DC'),ac=read('AC');
   const d=sources.DC[dc.position],a=sources.AC[ac.position];
   // Unavailable data = null (unverified), NOT invented 28V/115V/400Hz.
   // STBY PWR / BAT BUS voltmeter taps do not imply a DC ammeter feed.
   return Object.freeze({
    dcAmps:(dc.position==='STBY PWR'||dc.position==='BAT BUS')?null:(d?.amps??null),
    dcVolts:d?.volts??null,
    cps:a?.cps??null,
    acVolts:a?.volts??null
   });
  }
  function snapshot(){return Object.freeze({version:VERSION,revision,dc:read('DC'),ac:read('AC'),readings:readings()});}
  return Object.freeze({read,select,choose,step,setSourceMeasurement,readings,snapshot});
 }
 return Object.freeze({version:VERSION,detents:DETENTS,angles:ANGLES,sockets:SOCKETS,indexOf,label,angle,fromAngle,create});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./ac-dc-selectors-unified-v1.js?v=ACDC-DETENT-0001 */
try{
/* Unified P5-13 native OH10 DC/AC meter-source selectors.
 * Adds HOTSPOTS over original photo rotaries only; no visual knob, gauge,
 * needle, image or red-zone sprite replacement. Owner detents clockwise.
 */
(function(root){
 'use strict';
 const model=root.B737AcDcSelectorModel,meters=root.B737UnifiedAcDcMetering;
 if(!model||!meters)return;
 const controls=model.create(),SOURCE_W=1095,SOURCE_H=1436,uid='ACDC-DETENT-0001';
 let frame=null,watch=null,watched=null;
 const buttons=new Map();
 const descriptions={DC:'DC METER SELECTOR',AC:'AC METER SELECTOR'};
 let panel=null;
 function updateMeters(){
  // No synthetic current/voltage/frequency: actual selected-source sensor
  // samples arrive separately through setSourceMeasurement().
  meters.setReadings(controls.readings(),{acVoltsMode:'NORMAL'});
 }
 function announce(side){
  const s=controls.read(side),button=buttons.get(side);
  if(button){
   button.dataset.position=s.position;button.dataset.index=String(s.index);
   button.setAttribute('aria-valuenow',String(s.index));
   button.setAttribute('aria-valuetext',s.position);
   button.title=descriptions[side]+' · '+s.position+' ('+(s.index+1)+'/7) · wheel / drag / keyboard';
  }
  if(panel){
   const display=panel.querySelector('[data-meter-selector-state="'+side+'"]');
   if(display)display.textContent=s.position+' · '+(s.index+1)+'/7';
  }
 }
 function emit(side){
  updateMeters();announce(side);
  const s=controls.read(side);
  root.dispatchEvent(new CustomEvent('b737:ac-dc-selector-change',{
   detail:{...s,version:uid,readings:controls.readings(),source:'OH10_COCKPIT_ROTARY'}}));
 }
 function select(side,index){const old=controls.read(side).index,result=controls.select(side,index);if(result.index!==old)emit(side);else announce(side);return result;}
 function choose(side,position){return select(side,model.indexOf(side,position));}
 function step(side,delta){return select(side,Math.max(0,Math.min(6,controls.read(side).index+delta)));}
 function setSourceMeasurement(side,position,sample){
  controls.setSourceMeasurement(side,position,sample);
  if(controls.read(side).position===position){updateMeters();announce(side);}
  return controls.snapshot();
 }
 function nearestIndex(element,event){
  const r=element.getBoundingClientRect();
  const dx=event.clientX-(r.left+r.width/2),dy=event.clientY-(r.top+r.height/2);
  if(Math.hypot(dx,dy)<Math.min(r.width,r.height)*.17)return null;
  const degrees=Math.atan2(dx,-dy)*180/Math.PI;
  // No physical wrap. The left and right mechanical end stops are hard.
  return model.fromAngle(element.dataset.side,degrees);
 }
 function wire(button,side){
  let drag=null,suppressClick=false;
  button.addEventListener('pointerdown',event=>{
   if(event.pointerType==='mouse'&&event.button!==0)return;
   event.stopPropagation();
   drag={id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
   button.setPointerCapture(event.pointerId);
  });
  button.addEventListener('pointermove',event=>{
   if(!drag||event.pointerId!==drag.id)return;
   event.stopPropagation();
   if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<6)return;
   drag.moved=true;event.preventDefault();
   const next=nearestIndex(button,event);
   if(next!==null)select(side,next);
  });
  function end(event){
   if(!drag||event.pointerId!==drag.id)return;
   event.stopPropagation();
   suppressClick=drag.moved;drag=null;
   if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);
  }
  button.addEventListener('pointerup',end);button.addEventListener('pointercancel',end);
  button.addEventListener('click',event=>{
   event.stopPropagation();event.preventDefault();
   if(suppressClick){suppressClick=false;return;}
   const next=nearestIndex(button,event);
   if(next===null)step(side,event.shiftKey?-1:1);
   else select(side,next);
  });
  button.addEventListener('wheel',event=>{
   if(!event.deltaY)return;
   event.preventDefault();event.stopPropagation();
   step(side,event.deltaY>0?1:-1);
  },{passive:false});
  button.addEventListener('keydown',event=>{
   let next=null;
   if(['ArrowRight','ArrowUp'].includes(event.key))next=controls.read(side).index+1;
   else if(['ArrowLeft','ArrowDown'].includes(event.key))next=controls.read(side).index-1;
   else if(event.key==='Home')next=0;
   else if(event.key==='End')next=6;
   else if(event.key==='Enter'||event.key===' ')next=controls.read(side).index+1;
   if(next===null)return;
   event.preventDefault();event.stopPropagation();select(side,Math.max(0,Math.min(6,next)));
  });
 }
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  if(!host)return;
  const piece=host.querySelector('.atlas-piece[data-key="OH10"]');
  if(!piece)return;
  const pw=parseFloat(piece.style.width),ph=parseFloat(piece.style.height);
  if(!Number.isFinite(pw)||!Number.isFinite(ph))return;
  for(const side of ['DC','AC']){
   const socket=model.sockets[side],name='acdc-selector-'+side.toLowerCase();
   let button=piece.querySelector('[data-acdc-selector="'+side+'"]');
   if(!button){
    button=doc.createElement('button');button.type='button';
    button.className=name;button.dataset.acdcSelector=side;button.dataset.side=side;
    button.setAttribute('role','slider');
    button.setAttribute('aria-label',descriptions[side]);
    button.setAttribute('aria-valuemin','0');button.setAttribute('aria-valuemax','6');
    button.setAttribute('data-geometry-status',socket.confidence);
    // Transparent hit-zone over the existing photo knob (not a new knob).
    Object.assign(button.style,{
     position:'absolute',background:'transparent',border:'none',
     padding:'0',margin:'0',boxShadow:'none',outlineOffset:'1px',
     cursor:'pointer',touchAction:'none',zIndex:'1101',
     borderRadius:'50%',webkitTapHighlightColor:'transparent'
    });
    piece.append(button);wire(button,side);
   }
   const px=socket.x*pw/SOURCE_W,py=socket.y*ph/SOURCE_H;
   const sx=socket.r*2*pw/SOURCE_W,sy=socket.r*2*ph/SOURCE_H;
   Object.assign(button.style,{left:(px-sx/2)+'px',top:(py-sy/2)+'px',width:sx+'px',height:sy+'px'});
   buttons.set(side,button);announce(side);
  }
 }
 function bindFrame(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  if(!host)return;
  if(watched!==host){
   if(watch)watch.disconnect();watched=host;
   watch=new MutationObserver(records=>{
    // Only atlas direct child rebuilds should trigger remount.
    if(records.some(item=>item.target===host&&item.type==='childList'))mount();
   });
   watch.observe(host,{childList:true});
  }
  mount();
 }
 function connect(){
  const next=document.getElementById('overheadFrame');if(!next)return;
  if(next!==frame){
   if(watch)watch.disconnect();watch=null;watched=null;buttons.clear();
   frame=next;
   frame.addEventListener('load',()=>{if(watch)watch.disconnect();watch=null;watched=null;buttons.clear();bindFrame();});
  }
  bindFrame();
 }
 function makeInspector(){
  panel=document.getElementById('unifiedAcDcMeteringNeedles');
  if(!panel||panel.querySelector('[data-acdc-selector-inspector]'))return;
  const block=document.createElement('div');block.dataset.acdcSelectorInspector='1';
  const head=document.createElement('h3');head.textContent='Meter Source Selectors · 7 + 7';
  block.append(head);
  for(const side of ['DC','AC']){
   const row=document.createElement('div');
   row.style.cssText='display:flex;align-items:center;gap:6px;margin:6px 0;direction:ltr;flex-wrap:wrap';
   const label=document.createElement('strong');label.textContent=side+':';
   const prev=document.createElement('button');prev.type='button';prev.textContent='◀';
   prev.setAttribute('aria-label',side+' previous detent');prev.onclick=()=>step(side,-1);
   const now=document.createElement('span');now.dataset.meterSelectorState=side;now.style.fontFamily='monospace';
   const next=document.createElement('button');next.type='button';next.textContent='▶';
   next.setAttribute('aria-label',side+' next detent');next.onclick=()=>step(side,1);
   row.append(label,prev,now,next);block.append(row);
  }
  const caution=document.createElement('p');
  caution.style.fontSize='11px';
  caution.textContent='Knob hotspots select instrument sources only. Real electrical measurements must be supplied by the electrical sensor backend; no artificial volts/amps/CPS are fabricated.';
  block.append(caution);panel.append(block);
  for(const side of ['DC','AC'])announce(side);
 }
 const api=Object.freeze({
  version:uid,detents:model.detents,read:side=>controls.read(side),
  snapshot:()=>controls.snapshot(),select,choose,step,setSourceMeasurement,
  getReadings:()=>controls.readings(),mount
 });
 root.B737UnifiedAcDcSelectors=api;
 root.addEventListener('b737:ac-dc-source-measurement',event=>{
  try{const d=event.detail||{};setSourceMeasurement(d.side,d.position,d.measurement);}
  catch(error){console.error('Invalid AC/DC measurement source',error);}
 });
 root.addEventListener('b737:cockpit-mounted',connect);
 connect();makeInspector();updateMeters();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./residual-volts-model-v1.js?v=RESID-0001-SAFE-MOMENTARY */
try{
/* ATA24 / OH10 RESID VOLTS — procedure & QRH training only.
 * This intentionally distinguishes measured volts, declared simulator fixtures,
 * and UNKNOWN. Discrete Electrical V7 buses do not measure residual voltage.
 * Do not use this model as an aircraft maintenance test procedure.
 * Original panel and OH10 gauge/needle/guard assets are immutable.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737ResidualVoltsModelV1=api;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 const VERSION='RESID-0001-SAFE-MOMENTARY';
 const GENERATORS=Object.freeze(['GEN1','GEN2','APU GEN']);
 const AC_POSITIONS=Object.freeze(['STBY PWR','GND PWR','GEN1','APU GEN','GEN2','INV','TEST']);
 const SYSTEMS=Object.freeze(['CSD','VSCF','APU']);
 const GCR_STATES=Object.freeze(['UNKNOWN','OPEN','CLOSED']);
 const DRIVE_STATES=Object.freeze(['UNKNOWN','RUNNING','STOPPED','DISCONNECTED']);
 const VALID_MODES=Object.freeze(['MEASURED','TRAINER_FIXTURE']);
 const scenarioFixtures=Object.freeze({
  CSD_OPEN_SPINNING:Object.freeze({volts:18,detail:'ILLUSTRATIVE_ONLY_NOT_AFM_LIMIT'}),
  CSD_DISCONNECTED:Object.freeze({volts:4,detail:'ILLUSTRATIVE_ONLY_NOT_AFM_LIMIT'}),
  VSCF_OPEN_SPINNING:Object.freeze({volts:17,detail:'ILLUSTRATIVE_ONLY_NOT_AFM_LIMIT'}),
  APU_OPEN_SPINNING:Object.freeze({volts:null,detail:'UNKNOWN_NOT_MODELLED'})
 });
 function oneOf(x,list,name){if(!list.includes(x))throw Error('Invalid '+name+': '+x);return x;}
 function reading(v,label){if(v!==null&&(typeof v!=='number'||!Number.isFinite(v)||v<0))throw Error(label+' must be a nonnegative finite number or null');return v;}
 function initialPlant(id){
  return {id,technology:id==='APU GEN'?'APU':'CSD',gcr:'UNKNOWN',drive:'UNKNOWN',fieldExcited:null,
    measuredResidual:null,normalVolts:null,normalFrequency:null,failed:false,instrumentFault:false};
 }
 function create(){
  let selected='GEN1',pressed=false,mode='MEASURED',damageSimulation=false,meterDamaged=false,sequence=0;
  const plants=Object.fromEntries(GENERATORS.map(id=>[id,initialPlant(id)]));
  const notices=[];
  function note(code){notices.push({seq:++sequence,code});if(notices.length>120)notices.shift();}
  function setSelector(position){
   selected=oneOf(position,AC_POSITIONS,'AC selector');
   note('SELECT_'+selected.replaceAll(' ','_'));
   return evaluate();
  }
  function setMode(value){mode=oneOf(value,VALID_MODES,'measurement mode');note('MODE_'+mode);return evaluate();}
  function configure(id,patch){
   oneOf(id,GENERATORS,'generator');if(!patch||typeof patch!=='object'||Array.isArray(patch))throw Error('Invalid plant data');
   const allowed=['technology','gcr','drive','fieldExcited','measuredResidual','normalVolts','normalFrequency','failed','instrumentFault'];
   for(const key of Object.keys(patch))if(!allowed.includes(key))throw Error('Unsupported generator data: '+key);
   const next={...plants[id]};
   for(const [key,value]of Object.entries(patch)){
    if(key==='technology')next[key]=oneOf(value,SYSTEMS,'technology');
    else if(key==='gcr')next[key]=oneOf(value,GCR_STATES,'GCR state');
    else if(key==='drive')next[key]=oneOf(value,DRIVE_STATES,'drive');
    else if(['measuredResidual','normalVolts','normalFrequency'].includes(key))next[key]=reading(value,key);
    else if(key==='fieldExcited'){if(value!==null&&typeof value!=='boolean')throw Error('Invalid fieldExcited');next[key]=value;}
    else if(typeof value!=='boolean')throw Error('Invalid '+key);
    else next[key]=value;
   }
   Object.assign(plants[id],next);
   note('PLANT_'+id.replaceAll(' ','_'));
   return evaluate();
  }
  function setPress(value){if(typeof value!=='boolean')throw Error('Momentary press requires boolean');if(pressed!==value){pressed=value;note(value?'RESID_PRESS':'RESID_RELEASE');}return evaluate();}
  function setDamageSimulation(value){if(typeof value!=='boolean')throw Error('Invalid instructor damage control');damageSimulation=value;note('INSTRUCTOR_DAMAGE_'+(value?'ON':'OFF'));return evaluate();}
  function resetDamage(){meterDamaged=false;note('INSTRUCTOR_METER_REPLACED');return evaluate();}
  function evaluate(){
   const generator=GENERATORS.includes(selected)?selected:null;
   const source=generator?plants[generator]:null;
   const result={version:VERSION,sequence,pressed,selector:selected,mode,
    generator,scale:pressed?'RESIDUAL':'NORMAL',acVolts:null,normalVolts:null,cps:null,
    status:'UNAVAILABLE',reason:'NO_MEASUREMENT',warning:null,fixture:false,
    meterDamaged,damageSimulation,method:'UNVERIFIED'};
   if(!pressed){
    if(source){
     result.acVolts=source.normalVolts;
     result.normalVolts=source.normalVolts;
     result.cps=source.normalFrequency;
     result.status=source.normalVolts===null?'NORMAL_NO_SENSOR':'NORMAL_MEASURED';
    }else result.status='NORMAL_NON_GENERATOR_SOURCE';
    if(meterDamaged){result.acVolts=null;result.status='METER_DAMAGED';}
    return Object.freeze(result);
   }
   if(!source){result.status='INHIBITED';result.reason='SELECT_ENGINE_OR_APU_GENERATOR';return Object.freeze(result);}
   if(meterDamaged||source.instrumentFault){
    result.status='INSTRUMENT_FAULT';result.reason='VOLTMETER_UNAVAILABLE';return Object.freeze(result);
   }
   // A known closed GCR / excited field is unsafe even if drive telemetry is
   // missing. Fail closed, never route 115 V into the 0–30 V scale.
   if(source.gcr==='CLOSED'||source.fieldExcited===true){
    result.status='UNSAFE_OVER_RANGE';result.reason='GENERATOR_FIELD_EXCITED';
    result.warning='Do not use 0–30V meter range while generator field is excited';
    // This is only an instructor-requested failure exercise, never automatic.
    if(damageSimulation&&!meterDamaged){meterDamaged=true;note('SIMULATED_VOLTMETER_DAMAGE');result.meterDamaged=true;}
    return Object.freeze(result);
   }
   if(source.gcr==='UNKNOWN'||source.drive==='UNKNOWN'){
    result.status='UNVERIFIED';result.reason='GCR_AND_DRIVE_STATE_REQUIRED';return Object.freeze(result);
   }
   if(source.failed){
    result.status='SOURCE_FAULT';result.reason='GENERATOR_FAILED_NO_VALID_READING';
    return Object.freeze(result);
   }
   if(source.drive==='STOPPED'&&source.measuredResidual!==0){
    result.status='STOPPED_NO_VALID_READING';result.reason='NO_GENERATOR_ROTATION';
    return Object.freeze(result);
   }
   if(source.measuredResidual!==null){
    if(source.measuredResidual>30){
     result.status='UNSAFE_OVER_RANGE';result.reason='RESIDUAL_SENSOR_OVER_RANGE';
     result.warning='Measured value exceeds protected residual 0–30V scale';
     return Object.freeze(result);
    }
    result.acVolts=source.measuredResidual;result.status='MEASURED';result.reason='VALID_GENERATOR_READING';
    result.method='SOURCE_MEASUREMENT';return Object.freeze(result);
   }
   if(mode!=='TRAINER_FIXTURE'){
    result.status='NO_SENSOR';result.reason='NO_RESIDUAL_VOLTAGE_MEASUREMENT';
    return Object.freeze(result);
   }
   const name=source.technology==='CSD'?(source.drive==='DISCONNECTED'?'CSD_DISCONNECTED':'CSD_OPEN_SPINNING'):
    source.technology==='VSCF'?'VSCF_OPEN_SPINNING':'APU_OPEN_SPINNING';
   const fixture=scenarioFixtures[name];
   if(!fixture||fixture.volts===null||source.drive==='STOPPED'){
    result.status='NO_FIXTURE';result.reason='UNKNOWN_GENERATOR_OR_STATIONARY_BEHAVIOR';
    return Object.freeze(result);
   }
   result.acVolts=fixture.volts;result.status='TRAINER_FIXTURE';result.fixture=true;
   result.reason=fixture.detail;result.method='ILLUSTRATIVE_NOT_MEASURED';
   return Object.freeze(result);
  }
  function snapshot(){return Object.freeze({version:VERSION,selector:selected,pressed,mode,damageSimulation,meterDamaged,
    plants:Object.fromEntries(GENERATORS.map(id=>[id,{...plants[id]}])),
    result:evaluate(),events:notices.map(x=>({...x}))});}
  return Object.freeze({setSelector,setMode,configure,setPress,setDamageSimulation,resetDamage,evaluate,snapshot});
 }
 return Object.freeze({version:VERSION,generators:GENERATORS,acPositions:AC_POSITIONS,systems:SYSTEMS,create,scenarioFixtures});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./residual-volts-unified-v1.js?v=RESID-0001-SAFE-MOMENTARY */
try{
/* RESID-0001 OH10 bus adapter: only the existing recessed RESID VOLTS button and
 * the existing original AC VOLTS needle. No cockpit background/needle changes.
 * Overhead iframe emits b737:cockpit-overhead / recessed-button press/release.
 * A discrete bus status is NOT a calibrated residual-voltage measurement.
 */
(function(root){
 'use strict';
 const Core=root.B737ResidualVoltsModelV1,meters=root.B737UnifiedAcDcMetering;
 const selectors=root.B737UnifiedAcDcSelectors;
 if(!Core||!meters||!selectors){console.error('RESID bridge missing core gauge or selector');return;}
 const core=Core.create(),VERSION='RESID-0001-SAFE-MOMENTARY',HISTORY=[];
 let inspector=null,lastResult=null,lastButton='RELEASE',lastInput='NONE';
 function addLog(result,origin){
  HISTORY.push({event:origin,selector:result.selector,pressed:result.pressed,
   scale:result.scale,status:result.status,reason:result.reason,volts:result.acVolts,
   source:result.method,warning:result.warning});
  if(HISTORY.length>100)HISTORY.shift();
 }
 function normalValue(result){
  if(result.meterDamaged)return null;
  if(result.generator){
   const p=core.snapshot().plants[result.generator];
   // A remembered 115V is NOT evidence of continuing normal excitation after
   // GCR opens, disconnect, generator failure or loss of drive.
   if(p.gcr==='OPEN'||p.drive==='STOPPED'||p.drive==='DISCONNECTED'||p.failed)return null;
   if(p.normalVolts!==null)return p.normalVolts;
  }
  const read=selectors.getReadings();
  return read.acVolts??null;
 }
 function refresh(origin){
  const result=core.evaluate();lastResult=result;
  if(result.pressed){
   // If the selected source is unsafe, over-range, faulty or unknown we
   // deliberately park the ORIGINAL needle; never force 115V through a 30V scale.
   meters.setReading('acVolts',result.acVolts,{mode:'RESIDUAL'});
  }else{
   meters.setReading('acVolts',normalValue(result),{mode:'NORMAL'});
  }
  addLog(result,origin);renderInspector();
  root.dispatchEvent(new CustomEvent('b737:residual-volts-status',{
   detail:{...result,origin,version:VERSION}}));
  return result;
 }
 function setPress(pressed,origin='COMMAND'){
  if(typeof pressed!=='boolean')throw Error('RESID requires boolean');
  lastButton=pressed?'PRESS':'RELEASE';lastInput=origin;
  core.setPress(pressed);return refresh(origin);
 }
 function select(position){core.setSelector(position);return refresh('AC_SELECTOR');}
 function configure(source,patch){
  core.configure(source,patch);
  // Explicit normal sensor data can also feed normal AC selector source values.
  if(Object.hasOwn(patch,'normalVolts')||Object.hasOwn(patch,'normalFrequency')){
   const before=core.snapshot().plants[source];
   selectors.setSourceMeasurement('AC',source,{
    volts:before.normalVolts,cps:before.normalFrequency});
  }
  return refresh('PLANT_SAMPLE');
 }
 function mode(value){core.setMode(value);return refresh('MODE_CHANGE');}
 function damageControl(value){core.setDamageSimulation(value);return refresh('INSTRUCTOR_DAMAGE_GATE');}
 function replaceMeter(){core.resetDamage();return refresh('INSTRUCTOR_REPLACE_METER');}
 function consumeRecessed(detail,origin){
  if(detail?.id!=='residual-volts'||typeof detail.pressed!=='boolean')return false;
  // Must stay spring-return; never toggle or latch on release.
  setPress(detail.pressed,origin);
  return true;
 }
 root.addEventListener('message',event=>{
  if(event.origin!==root.location.origin)return;
  const frame=document.getElementById('overheadFrame');
  if(!frame||event.source!==frame.contentWindow)return;
  const data=event.data;
  if(data?.type!=='b737:cockpit-overhead'||data.kind!=='recessed-button')return;
  consumeRecessed(data,'OH10_RECESSED_IFRAME');
 });
 root.addEventListener('b737:recessed-button',event=>consumeRecessed(event.detail,'DIRECT_RECESSED_BUTTON'));
 root.addEventListener('b737:ac-dc-selector-change',event=>{
  if(event.detail?.side!=='AC')return;
  select(event.detail.position);
 });
 root.addEventListener('b737:ac-dc-source-measurement',event=>{
  if(event.detail?.side==='AC'&&core.snapshot().pressed)refresh('LIVE_SOURCE_SENSOR_UPDATE');
 });
 root.addEventListener('b737:ac-dc-metering-readings',event=>{
  if(core.snapshot().pressed)refresh('METER_INPUT_WHILE_HELD');
 });
 // This event is the documented external generator data entry point. An
 // Electrical V7 Boolean bus "online" MUST NOT be interpreted as GCR CLOSED.
 root.addEventListener('b737:residual-generator-state',event=>{
  const data=event.detail;
  try{if(data&&Core.generators.includes(data.source))configure(data.source,data.patch);}
  catch(e){console.error('RESID generator data rejected',e);}
 });
 // Existing Unified ISN engine/APU session owns the observed drive/run state.
 // This provides a live rotating/ceased input without inventing GCR status,
 // generator output volts or exciter state from mere bus connectivity.
 root.addEventListener('b737:unified-ecu-observation',()=>{
  const sources=root.B737ISNCockpitV1?.getStartState?.()?.sources;
  if(!sources)return;
  let changed=false;
  for(const [id,key] of [['GEN1','engine1'],['GEN2','engine2'],['APU GEN','apu']]){
   const running=sources[key]?.running;
   if(typeof running!=='boolean')continue;
   const next=running?'RUNNING':'STOPPED';
   if(core.snapshot().plants[id].drive!==next){core.configure(id,{drive:next});changed=true;}
  }
  if(changed)refresh('ISN_LIVE_ENGINE_APU_DRIVE');
 });
 root.addEventListener('b737:electrical-v7-state',event=>{
  const state=event.detail?.state||event.detail;
  const cfg=state?.config;
  if(!cfg)return;
  try{
   for(const [id,key] of [['GEN1','engine1Running'],['GEN2','engine2Running'],['APU GEN','apuRunning']]){
    if(typeof cfg[key]==='boolean')core.configure(id,{drive:cfg[key]?'RUNNING':'STOPPED'});
   }
   refresh('V7_DRIVE_STATUS_ONLY');
  }catch(error){console.error('RESID V7 drive inference rejected',error);}
 });
 function element(tag,text,parent){
  const node=document.createElement(tag);if(text!==undefined)node.textContent=text;
  if(parent)parent.append(node);return node;
 }
 function field(label,options,value,onChange,parent){
  const wrapper=element('label',label+' ',parent);
  wrapper.style.cssText='display:flex;align-items:center;justify-content:space-between;gap:6px;margin:6px 0;direction:ltr';
  const sel=element('select',undefined,wrapper);sel.setAttribute('aria-label',label);
  for(const v of options){const opt=element('option',v,sel);opt.value=v;}
  sel.value=value;sel.addEventListener('change',()=>onChange(sel.value));
  return sel;
 }
 function renderInspector(){
  if(!inspector)return;
  const result=lastResult||core.evaluate();
  const fields=inspector.querySelector('[data-resid-current]');
  if(fields)fields.textContent=[
   'button: '+lastButton+' ('+lastInput+')',
   'AC selector: '+result.selector,
   'meter scale: '+result.scale,
   'status: '+result.status,
   'reason: '+result.reason,
   'AC VOLTS: '+(result.acVolts===null?'UNKNOWN':result.acVolts.toFixed(1)+' V'),
   'method: '+result.method,
   'GCR: '+(result.generator?core.snapshot().plants[result.generator].gcr:'N/A'),
   'driver: '+(result.generator?core.snapshot().plants[result.generator].drive:'N/A'),
   'meter simulated damaged: '+result.meterDamaged,
   'warning: '+(result.warning||'none'),
   'QA: 0–30 V calibration is still provisional; training only'
  ].join('\n');
 }
 function buildInspector(){
  const holder=document.getElementById('unifiedAcDcMeteringNeedles');if(!holder)return;
  inspector=element('section',undefined,holder);
  inspector.dataset.residualLab='RESID-0001';
  element('h3','RESID VOLTS — ATA24 Test Lab (independent of photo)',inspector);
  const description=element('p','Press and hold the real RESID VOLTS button under OH10, or use this test control. Measured inputs and illustrative training fixtures are kept separate.',inspector);
  description.style.fontSize='12px';
  const status=element('pre','',inspector);status.dataset.residCurrent='1';
  status.style.cssText='white-space:pre-wrap;direction:ltr;text-align:left;font:11px monospace;padding:6px;border:1px solid #425b68;border-radius:6px;overflow-wrap:anywhere';
  const press=element('button','PRESS & HOLD · RESID VOLTS',inspector);
  press.type='button';press.style.cssText='touch-action:none;padding:6px;margin:5px 0';
  press.setAttribute('aria-label','Momentary residual voltage test');
  press.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();press.setPointerCapture(e.pointerId);setPress(true,'TEST_LAB');});
  for(const name of ['pointerup','pointercancel','lostpointercapture'])
   press.addEventListener(name,()=>{if(core.snapshot().pressed)setPress(false,'TEST_LAB_RELEASE');});
  press.addEventListener('blur',()=>{if(core.snapshot().pressed)setPress(false,'TEST_LAB_BLUR');});
  press.addEventListener('keydown',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();if(!e.repeat)setPress(true,'TEST_LAB_KEY');}});
  press.addEventListener('keyup',e=>{if([' ','Enter'].includes(e.key)){e.preventDefault();setPress(false,'TEST_LAB_KEY_RELEASE');}});
  field('Source',['GEN1','GEN2','APU GEN'],core.snapshot().selector,
   name=>{selectors.choose('AC',name);},inspector);
  field('Measurement',['MEASURED','TRAINER_FIXTURE'],core.snapshot().mode,mode,inspector);
  field('GCR',['UNKNOWN','OPEN','CLOSED'],'UNKNOWN',
   value=>configure(core.snapshot().selector,{gcr:value}),inspector);
  field('Drive',['UNKNOWN','RUNNING','STOPPED','DISCONNECTED'],'UNKNOWN',
   value=>configure(core.snapshot().selector,{drive:value}),inspector);
  field('Generator type',['CSD','VSCF','APU'],'CSD',
   value=>configure(core.snapshot().selector,{technology:value}),inspector);
  const presets=element('div',undefined,inspector);
  presets.style.cssText='display:flex;gap:4px;flex-wrap:wrap;margin:6px 0';
  const presetsList=[
   ['CSD demo 18V',{technology:'CSD',gcr:'OPEN',drive:'RUNNING',measuredResidual:null,failed:false,fieldExcited:false},'TRAINER_FIXTURE'],
   ['CSD disconnected demo 4V',{technology:'CSD',gcr:'OPEN',drive:'DISCONNECTED',measuredResidual:null,failed:false,fieldExcited:false},'TRAINER_FIXTURE'],
   ['VSCF demo 17V',{technology:'VSCF',gcr:'OPEN',drive:'RUNNING',measuredResidual:null,failed:false,fieldExcited:false},'TRAINER_FIXTURE'],
   ['GCR CLOSED (unsafe)',{gcr:'CLOSED',drive:'RUNNING',fieldExcited:true,normalVolts:115},'MEASURED'],
   ['Sensor 12V',{gcr:'OPEN',drive:'RUNNING',fieldExcited:false,measuredResidual:12},'MEASURED'],
   ['Sensor overrange 45V',{gcr:'OPEN',drive:'RUNNING',fieldExcited:false,measuredResidual:45},'MEASURED'],
   ['Generator failed',{gcr:'OPEN',drive:'RUNNING',failed:true,measuredResidual:null},'MEASURED'],
   ['Unknown / no sensor',{gcr:'UNKNOWN',drive:'UNKNOWN',measuredResidual:null,failed:false,fieldExcited:null,normalVolts:null},'MEASURED']
  ];
  for(const [label,patch,setmode]of presetsList){
   const button=element('button',label,presets);button.type='button';
   button.style.cssText='font-size:11px;white-space:normal';
   button.onclick=()=>{
    const source=core.snapshot().selector;
    if(!Core.generators.includes(source))selectors.choose('AC','GEN1');
    const active=core.snapshot().selector;
    core.configure(active,patch);core.setMode(setmode);refresh('TEST_LAB_PRESET');
   };
  }
  const instructor=element('label','Instructor: simulate meter damage on unsafe press ',inspector);
  const checkbox=element('input',undefined,instructor);checkbox.type='checkbox';
  checkbox.onchange=()=>damageControl(checkbox.checked);
  const reset=element('button','Instructor: replace damaged voltmeter',inspector);
  reset.type='button';reset.onclick=replaceMeter;
  element('p','Demo values are illustrative only (18V/4V/17V). No measured residual volts can be inferred from V7 bus availability. Never execute this as an aircraft procedure.',inspector).style.fontSize='11px';
  renderInspector();
 }
 const api=Object.freeze({version:VERSION,press:setPress,select,configure,mode,
  setDamageSimulation:damageControl,replaceMeter,snapshot:()=>core.snapshot(),
  getAudit:()=>({lastEvent:lastInput,result:lastResult,history:HISTORY.map(x=>({...x})),
   connectedRecessedIframe:Boolean(document.getElementById('overheadFrame')?.contentWindow),
   originalArtworkUnchanged:true})});
 root.B737UnifiedResidualVolts=api;
 const frame=document.getElementById('overheadFrame');
 if(frame)frame.addEventListener('load',()=>setPress(false,'OH10_IFRAME_RELOADED'));
 root.addEventListener('blur',()=>{if(core.snapshot().pressed)setPress(false,'WINDOW_BLUR');});
 const initial=selectors.read('AC');core.setSelector(initial.position);
 buildInspector();refresh('INITIAL_CONNECT');
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./needle-motion-v1.js?v=NEEDLE-SMOOTH-0001 */
try{
/* Shared, low-overhead analogue needle motion for Unified OH12 instruments.
 * Readings own the targets; this module owns only visible angles.
 * No timer per needle: RAF runs while moving and stops at rest.
 * Native sprites, photo positions, scales and electrical logic are untouched.
 */
(function(root,factory){
 'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedNeedleMotionV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
 'use strict';
 const finite=n=>typeof n==='number'&&Number.isFinite(n);
 // Closed-form critically damped spring. Retargeting preserves current velocity
 // rather than restarting an ease-out transition on every ECU update.
 function step(angle,velocity,target,seconds,omega=7){
  if(![angle,velocity,target,seconds,omega].every(finite)||
     seconds<0||omega<=0)throw Error('Invalid analogue needle motion');
  if(seconds===0)return {angle,velocity};
  const dt=Math.min(seconds,0.05);
  const displacement=angle-target,term=velocity+omega*displacement;
  const decay=Math.exp(-omega*dt);
  return {angle:target+(displacement+term*dt)*decay,
   velocity:(velocity-omega*term*dt)*decay};
 }
 function create(initial,{omega=7,epsilon=0.025,speedEpsilon=0.15,
  min=-Infinity,max=Infinity,requestFrame=null,cancelFrame=null}={}){
  if(!finite(initial)||!finite(omega)||omega<=0||
     !finite(epsilon)||epsilon<=0||!finite(speedEpsilon)||speedEpsilon<=0||
     !(min<=initial&&initial<=max))throw Error('Invalid analogue needle parameters');
  const raf=requestFrame||(typeof requestAnimationFrame==='function'?requestAnimationFrame:null);
  const caf=cancelFrame||(typeof cancelAnimationFrame==='function'?cancelAnimationFrame:null);
  if(typeof raf!=='function'||typeof caf!=='function')
   throw Error('Animation frame scheduler is required');
  let angle=initial,target=initial,velocity=0,painter=null,ticket=null,lastMs=null;
  function cancel(){
   if(ticket!==null){caf(ticket);ticket=null;}
   lastMs=null;
  }
  function schedule(){if(painter&&ticket===null)ticket=raf(frame);}
  function frame(now){
   ticket=null;
   if(!painter)return;
   if(!finite(now))throw Error('Invalid RAF timestamp');
   const gap=lastMs===null?16.667:Math.max(0,now-lastMs);
   // A background-tab pause must not turn into a several-second jump.
   if(gap>250)velocity=0;
   lastMs=now;
   const next=step(angle,velocity,target,Math.min(gap,50)/1000,omega);
   angle=Math.max(min,Math.min(max,next.angle));
   velocity=next.velocity;
   if((angle===min&&velocity<0)||(angle===max&&velocity>0))velocity=0;
   if(Math.abs(angle-target)<=epsilon&&Math.abs(velocity)<=speedEpsilon){
    angle=target;velocity=0;lastMs=null;painter(angle);return;
   }
   painter(angle);schedule();
  }
  function setTarget(next){
   if(!finite(next)||next<min||next>max)throw Error('Needle target outside instrument scale');
   if(Math.abs(next-target)<1e-9)return target;
   target=next;
   if(painter)schedule();
   return target;
  }
  function bind(fn){
   if(typeof fn!=='function')throw Error('Needle paint callback required');
   painter=fn;painter(angle);
   if(Math.abs(target-angle)>epsilon||Math.abs(velocity)>speedEpsilon)schedule();
  }
  function unbind(){cancel();painter=null;}
  function snap(next=target){
   if(!finite(next)||next<min||next>max)throw Error('Invalid needle snap');
   cancel();angle=target=next;velocity=0;
   if(painter)painter(angle);
  }
  function snapshot(){return {angle,target,velocity,moving:ticket!==null};}
  return Object.freeze({setTarget,bind,unbind,snap,snapshot});
 }
 return Object.freeze({step,create,VERSION:'NEEDLE-SMOOTH-0001'});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
