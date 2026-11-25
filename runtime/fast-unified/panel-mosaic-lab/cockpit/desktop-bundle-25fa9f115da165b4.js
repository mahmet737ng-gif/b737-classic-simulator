(async()=>{
;
/* ./drive-amps-needle-model.js?v=DAN-APU-ZERO-0009 */
try{
(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737DriveAmpsNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Native original 1203x1308 / 1024x1536 photo fitted bezel centres; 
 // each centre independently matched across four Hough sensitivity settings. 
 // BEZEL-only provisional registration; physical spindle still unapproved. 
 // See engine/instruments/native-bezel-centre-evidence-v1.json.
 // SOURCE NATIVE PIXELS: locked OH11/OH12 originals were checked side-by-side with
 // candidate pointer rays. 128/135px proposals crossed beyond the inner tick;
 // 64px proposals stopped short. Original near-98/102px reach is the
 // best source-image 0-tick approximation pending the full tick survey.
 // Sprite paths stay owner-approved and byte-identical.
 const panels=Object.freeze({OH11:Object.freeze({width:1203,height:1308}),OH12:Object.freeze({width:1024,height:1536})});
 // Upper edges of the grey half-round covers, traced from the unchanged source panels.
 // Clipping to these contours keeps every white blade exactly within the black dial.
 const windows=Object.freeze({
  OH11:Object.freeze({top:805,offset:523,edge:Object.freeze([[140,1012],[180,1012],[220,1012],[245,1009],[265,1003],[285,997],[305,993],[325,990],[345,990],[365,992],[385,997],[405,1003],[425,1009],[450,1012],[535,1012]])}),
  OH12:Object.freeze({top:84,offset:495,edge:Object.freeze([[105,252],[150,252],[185,251],[205,247],[225,240],[245,236],[265,235],[285,237],[305,242],[325,248],[350,252],[420,252]])}),
  OH12_APU:Object.freeze({top:1130,offset:0,edge:Object.freeze([[563,1324],[590,1326],[625,1326],[648,1325],[666,1318],[685,1310],[705,1305],[725,1303],[745,1305],[765,1311],[784,1319],[803,1325],[835,1326],[879,1326]])})
 });
 const needles=Object.freeze([
  Object.freeze({id:'driveOil1',label:'GEN DRIVE OIL TEMP 1',piece:'OH11',x:326.4,y:1016.6,tipRadius:98,initialAngle:-46}),
  Object.freeze({id:'driveOil2',label:'GEN DRIVE OIL TEMP 2',piece:'OH11',x:861.8,y:1023.8,tipRadius:98,initialAngle:-46}),
  Object.freeze({id:'acAmps1',label:'A.C. AMPS 1',piece:'OH12',x:266.515,y:296.991,tipRadius:125,initialAngle:-49.51}),
  Object.freeze({id:'acAmps2',label:'A.C. AMPS 2',piece:'OH12',x:753.481,y:297.342,tipRadius:125,initialAngle:-49.5}),
  Object.freeze({id:'apuAcAmps',label:'APU A.C. AMPS',piece:'OH12',window:'OH12_APU',x:724,y:1334,tipRadius:124,initialAngle:-57})
 ]);

 // Source-native OH12 original white radial stroke axis intersections (21
 // source lines / gauge). Physical shaft is covered by the lower fairing:
 // this is an ARC-FITTED VISUAL PIVOT, not a hidden spindle certification.
 // Each interval is 10 A from the true printed 0/50/100/150/200 graduations.
 // Source ledger with per-line pixel endpoints and checksum:
 // engine/instruments/oh12-ac-amps-photo-graduations-v1.json
 const ampPhotoAngles=Object.freeze({
  acAmps1:Object.freeze([-49.51,-43.85,-38.7,-33.54,-28.56,-23.53,-18.14,-13.02,-8.12,-3.28,1.73,7.07,12.56,17.7,22.65,27.72,33.02,38.12,43.21,48.23,53.23]),
  acAmps2:Object.freeze([-49.5,-43.88,-38.75,-33.69,-28.68,-23.67,-18.49,-13.67,-8.76,-3.96,1.0,6.23,11.57,16.58,21.54,26.58,31.71,36.84,41.92,46.87,51.83])
 });
 // APU AC AMPS native photographed zero tick is above the former -74°
 // parked bearing. Owner's 2026-11-05 screenshot shows the white blade below
 // the 0 tick; photo geometry puts the zero graduation at approximately -57°.
 // Do not change the 50/100/150/200 photo anchors or the spindle geometry.
 // Interpolated 0/50/100/150/200 visual reference (training calibration).
 // The dial, bearing/pivot, sprite and size stay untouched.
 const apuAmpPhotoAngles=Object.freeze([-57,-37,0,37,74]);
 function bearingForApuAmps(amps){
  if(typeof amps!=='number'||!Number.isFinite(amps))throw Error('APU A.C. AMPS must be finite');
  const v=Math.max(0,Math.min(200,amps)),i=Math.min(3,Math.floor(v/50));
  return apuAmpPhotoAngles[i]+(apuAmpPhotoAngles[i+1]-apuAmpPhotoAngles[i])*(v-i*50)/50;
 }
 const ampPhotoStatuses=Object.freeze({numericalMinorMarksObserved:21,majorMarksObserved:5,
  perMinorAmperes:10,sourcePhotoReviewed:true,physicalHiddenShaftCertified:false,
  sourcePhotoCalibrationNotCertifiedForFlight:true});
 function bearingForAmps(id,amps){
  if(!Object.hasOwn(ampPhotoAngles,id))throw Error('Unknown AC AMPS photo gauge '+id);
  if(typeof amps!=='number'||!Number.isFinite(amps))throw Error('A.C. AMPS must be finite');
  if(amps<0||amps>200)return null;
  const a=ampPhotoAngles[id],index=Math.min(19,Math.floor(amps/10)),t=(amps-index*10)/10;
  return a[index]+t*(a[index+1]-a[index]);
 }
 function ampsForBearing(id,degrees){
  if(!Object.hasOwn(ampPhotoAngles,id))throw Error('Unknown AC AMPS photo gauge '+id);
  if(typeof degrees!=='number'||!Number.isFinite(degrees))throw Error('A.C. AMPS bearing must be finite');
  const a=ampPhotoAngles[id];
  if(degrees<a[0]-1e-7||degrees>a[20]+1e-7)return null;
  for(let i=0;i<20;i++)if(degrees<=a[i+1])return i*10+
     10*(degrees-a[i])/(a[i+1]-a[i]);
  return 200;
 }
 function angle(value){const n=Number(value);if(!Number.isFinite(n))throw Error('Needle angle must be finite');return Math.max(-90,Math.min(90,n));}
 function windowPath(needle){
  if(!needles.includes(needle))throw Error('Invalid drive/amps needle');
  const window=windows[needle.window||needle.piece],dx=(needle.id.endsWith('2')?window.offset:0);
  const edge=window.edge.map(([x,y])=>[x+dx,y]);
  const first=edge[0],last=edge[edge.length-1];
  return `M ${first[0]} ${window.top} L ${last[0]} ${window.top} L ${last[0]} ${last[1]} `+
   edge.slice(0,-1).reverse().map(([x,y])=>`L ${x} ${y}`).join(' ')+` Z`;
 }
 function placement(piece,needle){
  const source=panels[needle?.piece];
  if(!source||!needles.includes(needle)||!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid drive/amps needle placement');
  return {x:piece.x+needle.x*piece.w/source.width,y:piece.y+needle.y*piece.h/source.height,size:512*needle.tipRadius/220*piece.w/source.width};
 }
 return Object.freeze({panels,needles,angle,placement,windowPath,ampPhotoAngles,apuAmpPhotoAngles,ampPhotoStatuses,bearingForAmps,ampsForBearing,bearingForApuAmps});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./drive-amps-needle-unified.js?v=DAN-APU-SMOOTH-0010 */
try{
(function(){
 'use strict';
 const model=window.B737DriveAmpsNeedleModel;
 const motion=window.B737UnifiedNeedleMotionV1;
 if(!motion?.create)throw Error('Shared analogue needle motion must load before OH12 needles');
 const ns='http://www.w3.org/2000/svg';
 const sprite=new URL('./drive-amps-needle.svg?v=DAN-0001',document.baseURI).href;
 const state=Object.fromEntries(model.needles.map(needle=>[needle.id,needle.initialAngle]));
 const mounted=new Map(),outputs=new Map(),inputs=new Map();
 const animations=new Map(model.needles.map(needle=>{
  const apu=needle.id==='apuAcAmps';
  // 6.8 rad/s critically damped response: continuous movement across
  // successive 350ms load updates; at rest no animation frame is scheduled.
  return [needle.id,motion.create(needle.initialAngle,{
   omega:apu?6.8:7.2,
   min:apu?model.apuAmpPhotoAngles[0]:-90,
   max:apu?model.apuAmpPhotoAngles.at(-1):90
  })];
 }));
 let frame=null;
 function element(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 const ampsMeter=id=>Object.prototype.hasOwnProperty.call(model.ampPhotoAngles,id);
 function paint(id){
  const output=outputs.get(id),input=inputs.get(id);
  const reading=ampsMeter(id)?model.ampsForBearing(id,state[id]):null;
  if(output)output.textContent=ampsMeter(id)?
    (reading===null?'OUT OF PRINTED RANGE':reading.toFixed(1)+' A · '+state[id].toFixed(2)+'°'):
    (state[id]+'° · ANGLE QA ONLY');
  if(input)input.value=String(ampsMeter(id)?(reading===null?'':reading):state[id]);
 }
 function setAngle(id,value){
  if(!model.needles.some(needle=>needle.id===id))throw Error('Unknown needle '+id);
  const raw=model.angle(value);
  state[id]=id==='apuAcAmps'?
   Math.max(model.apuAmpPhotoAngles[0],Math.min(model.apuAmpPhotoAngles.at(-1),raw)):raw;
  animations.get(id).setTarget(state[id]);
  paint(id);return state[id];
 }
 function setAmps(id,value){
  const amps=Number(value),a=model.bearingForAmps(id,amps);
  if(a===null)throw Error('AC AMPS exceeds printed 0-200A range');
  setAngle(id,a);return amps;
 }
 function getReadings(){return Object.fromEntries(Object.keys(model.ampPhotoAngles).map(id=>[id,model.ampsForBearing(id,state[id])]));}
 function setAngles(values){for(const [id,value]of Object.entries(values||{}))setAngle(id,value);return {...state};}
 function mount(doc,host){
  let complete=true;
  for(const needle of model.needles){
   if(host.querySelector(`[data-drive-amps-needle="${needle.id}"]`))continue;
   const piece=host.querySelector(`.atlas-piece[data-key="${needle.piece}"]`);
   if(!piece){complete=false;continue;}
   const source=model.panels[needle.piece];
   const layer=element(doc,host,'svg',{'data-drive-amps-needle':needle.id,viewBox:`0 0 ${source.width} ${source.height}`,preserveAspectRatio:'none',role:'img','aria-label':needle.label+' pointer'});
   Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,width:piece.style.width,height:piece.style.height,zIndex:'1000',pointerEvents:'none',overflow:'hidden'});
   const defs=element(doc,layer,'defs');
   const clip=element(doc,defs,'clipPath',{id:`drive-amps-window-${needle.id}`,clipPathUnits:'userSpaceOnUse'});
   element(doc,clip,'path',{d:model.windowPath(needle)});
   const windowGroup=element(doc,layer,'g',{'clip-path':`url(#drive-amps-window-${needle.id})`});
   const assembly=element(doc,windowGroup,'g',{transform:`translate(${needle.x} ${needle.y}) scale(${needle.tipRadius/220}) translate(-256 -256)`});
   const blade=element(doc,assembly,'g');
   // A CSS transition repeatedly restarts on 350ms telemetry updates and
   // produces visible jumps. One continuously sampled RAF spring owns the
   // angle instead, and stops immediately once the pointer is stationary.
   Object.assign(blade.style,{transformOrigin:'256px 256px',
    transition:'none',willChange:'transform'});
   element(doc,blade,'image',{href:sprite,x:0,y:0,width:512,height:512});
   mounted.set(needle.id,blade);
   animations.get(needle.id).bind(angle=>{blade.style.transform=`rotate(${angle}deg)`;});
   paint(needle.id);
  }
  return complete;
 }
 function bind(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return;
  if(mount(doc,host))return;
  const observer=new MutationObserver(()=>{if(mount(doc,host))observer.disconnect();});observer.observe(host,{childList:true});
 }
 function connect(){
  const next=document.getElementById('overheadFrame');if(!next||next===frame)return;
  frame=next;frame.addEventListener('load',()=>{
   for(const animator of animations.values())animator.unbind();
   mounted.clear();bind();
  });bind();
 }
 function controls(){
  const section=document.createElement('section');section.id='unifiedDriveAmpsNeedles';
  const title=document.createElement('h2');title.textContent='GEN DRIVE / A.C. AMPS · 5 Needles';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='AC AMPS 1/2 sliders show actual amperes on the 0–200 A printed scale, with 10 A intervals. Pivot is derived from 21 tick intersections per gauge. GEN DRIVE and APU AMPS are angle tests only; the concealed mechanical pivot is not yet validated.';section.append(note);
  for(const needle of model.needles){
   const calibrated=ampsMeter(needle.id);
   const label=document.createElement('label');label.textContent=needle.label+(calibrated?' · PRINTED SCALE (A)':' · QA ANGLE ONLY (°)');label.style.display='block';label.style.direction='ltr';
   const input=document.createElement('input');Object.assign(input,{type:'range',min:calibrated?'0':needle.id==='apuAcAmps'?'-57':'-90',max:calibrated?'200':needle.id==='apuAcAmps'?'74':'90',step:'1'});input.style.width='100%';input.style.accentColor='#edf0e8';
   const output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';
   input.addEventListener('input',()=>calibrated?setAmps(needle.id,Number(input.value)):setAngle(needle.id,Number(input.value)));
   label.append(input,output);section.append(label);inputs.set(needle.id,input);outputs.set(needle.id,output);paint(needle.id);
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='Restore Source Photo Position';
  reset.addEventListener('click',()=>{for(const needle of model.needles)setAngle(needle.id,needle.initialAngle);});section.append(reset);
  const previous=document.querySelector('#unifiedAcDcMeteringNeedles');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);
 }
 window.B737UnifiedDriveAmpsNeedles=Object.freeze({
  getAngles:()=>({...state}),
  getRenderedAngles:()=>Object.fromEntries([...animations].map(([id,animator])=>[id,animator.snapshot().angle])),
  getReadings,setAngle,setAmps,setAngles
 });
 window.addEventListener('b737:drive-amps-needle-angles',event=>{try{setAngles(event.detail);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connect);connect();if(document.querySelector('.inspector'))controls();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./apu-egt-static-needle-cleaner-v1.js?v=EGT-APUAMPS-CLEAN-0004 */
try{
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
 // Original OH12 EGT '4' and the graduation immediately below it must never
 // be painted over by a static-pointer removal mask. These native-pixel
 // reserves are confined to the photographed white face markings.
 const egtLegendReserves=Object.freeze([
  Object.freeze({x0:206,x1:246,y0:1340,y1:1384}), // printed numeral 4
  Object.freeze({x0:176,x1:225,y0:1373,y1:1415})  // adjoining graduation
 ]);
 const apuBlueEdge=Object.freeze([
  [563,1324],[590,1326],[625,1326],[648,1325],[666,1318],
  [685,1310],[705,1305],[725,1303],[745,1305],[765,1311],
  [784,1319],[803,1325],[835,1326],[879,1326]
 ]);
 function blueEdgeAt(x){
  for(let i=1;i<apuBlueEdge.length;i++)if(x<=apuBlueEdge[i][0]){
   const [x0,y0]=apuBlueEdge[i-1],[x1,y1]=apuBlueEdge[i];
   return y0+(Math.max(x0,Math.min(x1,x))-x0)/(x1-x0)*(y1-y0);
  }
  return apuBlueEdge.at(-1)[1];
 }
 const preservedEGTLegend=(x,y)=>egtLegendReserves.some(r=>x>=r.x0&&x<=r.x1&&y>=r.y0&&y<=r.y1);

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
   const isEGTPointer=inPolygon(x+.5,y+.5,footprint);
   // Do not overwrite the ORIGINAL photographed numeral/tick with dark dial
   // samples. Apart from these scale reserves the old static pointer is removed.
   if((isEGTPointer&&!preservedEGTLegend(x,y))||inPolygon(x+.5,y+.5,apuAmpsFootprint))mask[y*w+x]=1;
  }
  let count=0;
  const donors=[[0,-10],[0,10],[-10,-4],[10,4],[0,-20],[0,20],
   [-20,0],[20,0],[-30,-10],[30,10],[-40,0],[40,0],[-50,-15],[50,15]];
  // Restore only needle silhouette with nearby untouched dark photo texture.
  // Reject white printed scale/numerals to avoid ghost ticks through the paint.
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
   if(!mask[y*w+x])continue;
   let r=0,g=0,b=0,ws=0;
   const isAPUAmps=inPolygon(x+.5,y+.5,apuAmpsFootprint);
   // The APU A.C. AMPS face has two different materials. Sampling dark dial
   // pixels to repair the BLUE lower shroud caused the jagged black blotch.
   // Trace the native black/blue boundary and sample from the same material.
   const blue=isAPUAmps&&y>=blueEdgeAt(x)+2;
   for(const [dx,dy] of donors){
    const sx=x+dx,sy=y+dy;
    if(sx<0||sx>=w||sy<0||sy>=h||mask[sy*w+sx])continue;
    if(isAPUAmps){
     const sampleBlue=sy>=blueEdgeAt(sx)+2;
     if(sampleBlue!==blue)continue;
    }
    const i=(sy*w+sx)*4;
    const luminance=(src[i]+src[i+1]+src[i+2])/3;
    if(blue){
     // Reject black pointer residue and white lettering; keep blue-grey paint.
     if(luminance<55||luminance>164||src[i+2]<src[i])continue;
    }else if(luminance>76)continue; // dark printed dial, not white ticks/letters
    const d=Math.hypot(dx,dy),weight=1/(d*d);
    r+=src[i]*weight;g+=src[i+1]*weight;b+=src[i+2]*weight;ws+=weight;
   }
   if(!ws)continue; // Never synthesize unknown color; keep the original photo.
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
 function cleanOriginal(piece){
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
 const maskJobs=new WeakMap();
 function cleanPiece(piece){
  if(!piece?.isConnected)return Promise.resolve(false);
  if(maskJobs.has(piece))return maskJobs.get(piece);
  const patch=root.B737NeedleBootMask?.apply(piece,'oh12');
  if(!patch)return cleanOriginal(piece);
  const job=patch.then(ready=>{
   if(ready===null)return cleanOriginal(piece);
   if(ready){
    piece.dataset.apuEgtPhoto='CLEANED';
    piece.dataset.needleRestoration='RELEASE_MASK';
    stats.status='READY_RELEASE_MASK';
    const {width,height,changed}=root.B737GatewayBoot.art.oh12;
    stats.sourceDimensions=[width,height];
    stats.restoredPixels=changed;
   }
   return ready;
  }).finally(()=>maskJobs.delete(piece));
  maskJobs.set(piece,job);
  return job;
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
  cleanPiece,watchPiece,status:()=>({...stats,swapCount}),footprint,apuAmpsFootprint,egtLegendReserves,blueEdgeAt
 });
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./apu-egt-needle-model.js?v=EGT-0005-USER-ZERO */
try{
(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737ApuEgtNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // OH12 source pixels, not atlas display pixels. The artwork remains unchanged.
 // Photo-calibrated angular zero follows the 0..8 °C×100 scale, unwrapped
 // clockwise from lower right to top. Sprite, shaft, size and centre unchanged.
 const source=Object.freeze({piece:'OH12',width:1024,height:1536});
 const needle=Object.freeze({id:'apuEgt',label:'APU EGT',x:300,y:1324,tipRadius:124,initialAngle:-241.5});
 function angle(value){const n=Number(value);if(!Number.isFinite(n))throw Error('APU EGT angle must be finite');return Math.max(-250,Math.min(145,n));}
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid APU EGT placement');
  return {x:piece.x+needle.x*piece.w/source.width,y:piece.y+needle.y*piece.h/source.height,size:512*needle.tipRadius/220*piece.w/source.width};
 }
 return Object.freeze({source,needle,angle,placement});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./apu-egt-needle-unified.js?v=EGT-SMOOTH-0006 */
try{
(function(){
 'use strict';
 const model=window.B737ApuEgtNeedleModel;
 const motion=window.B737UnifiedNeedleMotionV1;
 if(!motion?.create)throw Error('Shared analogue needle motion must load before APU EGT');
 const ns='http://www.w3.org/2000/svg';
 const sprite=new URL('./apu-egt-needle.svg?v=EGT-0002',document.baseURI).href;
 let currentAngle=model.needle.initialAngle,blade=null,frame=null,input=null,output=null;
 // Slow analogue temperature response, with continuous velocity across live
 // ECU samples and no ongoing frame work when the needle is stationary.
 const animation=motion.create(currentAngle,{omega:6.4,min:-250,max:145});
 function renderBlade(angle){if(blade)blade.style.transform=`rotate(${angle}deg)`;}
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(){if(input)input.value=String(currentAngle);if(output)output.textContent=`${currentAngle}°`;}
 function setAngle(value){currentAngle=model.angle(value);animation.setTarget(currentAngle);if(!blade?.isConnected){blade=null;mount();}paint();return currentAngle;}
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return false;
  const piece=host.querySelector('.atlas-piece[data-key="OH12"]');if(!piece)return false;
  const cleaner=window.B737APUEGTStaticCleaner;
  if(cleaner){cleaner.watchPiece(piece);cleaner.cleanPiece(piece);}
  const existing=host.querySelector('[data-apu-egt-needle]');
  if(existing){
   blade=existing.querySelector('[data-needle-blade]');
   if(blade){animation.bind(renderBlade);paint();return true;}
   existing.remove(); // Recover from an interrupted or stale mount.
  }
  const layer=svg(doc,host,'svg',{'data-apu-egt-needle':'apuEgt',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'APU EGT pointer'});
  Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,width:piece.style.width,height:piece.style.height,zIndex:'1001',pointerEvents:'none',overflow:'hidden'});
  const assembly=svg(doc,layer,'g',{transform:`translate(${model.needle.x} ${model.needle.y}) scale(${model.needle.tipRadius/220}) translate(-256 -256)`});
  blade=svg(doc,assembly,'g',{'data-needle-blade':'apuEgt'});
  // The pointer remains at its cold-zero angle on first mount; subsequent
  // readings update a single damped spring without restarting CSS easing.
  Object.assign(blade.style,{transformOrigin:'256px 256px',
   transition:'none',willChange:'transform'});
  svg(doc,blade,'image',{href:sprite,x:0,y:0,width:512,height:512});
  animation.bind(renderBlade);paint();return true;
 }
 function bind(){if(mount())return;const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(host,{childList:true});}
 function connect(){const next=document.getElementById('overheadFrame');if(!next||next===frame)return;frame=next;frame.addEventListener('load',()=>{animation.unbind();blade=null;bind();});bind();}
 function controls(){
  const section=document.createElement('section');section.id='unifiedApuEgtNeedle';
  const title=document.createElement('h2');title.textContent='APU EGT · 1 Needle';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='Independent needle for left APU gauge. Angles are photo-calibrated to 0–8 (°C×100); visual QA only.';section.append(note);
  const label=document.createElement('label');label.textContent=model.needle.label;label.style.display='block';label.style.direction='ltr';
  input=document.createElement('input');Object.assign(input,{type:'range',min:'-250',max:'145',step:'1'});input.style.width='100%';input.style.accentColor='#edf0e8';
  output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';
  input.addEventListener('input',()=>setAngle(Number(input.value)));label.append(input,output);section.append(label);
  const reset=document.createElement('button');reset.type='button';reset.textContent='Restore Source Photo Position';reset.addEventListener('click',()=>setAngle(model.needle.initialAngle));section.append(reset);
  const previous=document.querySelector('#unifiedDriveAmpsNeedles');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);paint();
 }
 window.B737UnifiedApuEgtNeedle=Object.freeze({getAngle:()=>currentAngle,getRenderedAngle:()=>animation.snapshot().angle,setAngle});
 window.addEventListener('b737:apu-egt-needle-angle',event=>{try{setAngle(event.detail?.angle);}catch(error){console.error(error);}});
 window.addEventListener('b737:cockpit-mounted',connect);connect();if(document.querySelector('.inspector'))controls();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cabin-dual-needles-model.js?v=CDN-0004 */
try{
(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737CabinDualNeedlesModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // Coordinates belong to the immutable OH19 source image, not the atlas view.
 const source=Object.freeze({piece:'OH19-DIFF',width:1267,height:1241});
 const pivot=Object.freeze({x:489,y:365});
 // These are independent visually reviewed OH19 INNER long-tick bearings.
 // Still PRELIMINARY: intermediate marks, pivot subpixel and tip-to-inner-tick
 // contacts have not been signed off. Separate from outer PRESS mapping.
 const cabinAltPhotoAnchors=Object.freeze([
  [0,2.71],[500,13.59],[1000,22.37],[1500,31.32],[2000,40.34],[2500,50.2],[3000,59.98],[10000,108.64],[15000,155.65],
  [20000,200.55],[25000,236.57],[30000,262.03],[35000,284.48],
  [40000,304.18],[50000,327.37]
 ].map(([valueFt,bearingDeg])=>Object.freeze({valueFt,bearingDeg})));
 // Outer PSI numerals read from original OH19 face. This registration is
 // native-photo CANDIDATE, not a certified spindle/tick fit. Distinct from
 // the existing stage10 Hough candidate angles (disagreements are audited).
 const pressurePhotoAnchors=Object.freeze([
  [0,1.50],[1,32.49],[2,64.21],[3,96.06],[4,127.30],
  [5,159.47],[6,193.57],[7,225.42],[8,256.99],
  [9,290.23],[10,322.05]
 ].map(([valuePsid,bearingDeg])=>Object.freeze({valuePsid,bearingDeg})));
 function differentialPressurePreviewBearing(psid){
  if(typeof psid!=='number'||!Number.isFinite(psid))
   throw Error('Invalid DIFF PRESS reading');
  // IEEE754 summation can yield 10.000000000000007 at the 10-psi mark.
  // Reject genuinely out-of-dial values but permit sub-nanopsi float noise.
  const tiny=1e-9;
  if(psid< -tiny||psid>10+tiny)
   return null; // Do not fake out-of-range physical readings.
  const v=Math.max(0,Math.min(10,psid));
  const a=pressurePhotoAnchors;
  for(let i=1;i<a.length;i++)if(v<=a[i].valuePsid){
   const lo=a[i-1],hi=a[i],t=(v-lo.valuePsid)/(hi.valuePsid-lo.valuePsid);
   return lo.bearingDeg+t*(hi.bearingDeg-lo.bearingDeg);
  }
  return a[a.length-1].bearingDeg;
 }
 function resolvePhysicalReadings(readings){
  if(!readings||!Number.isFinite(readings.cabinAltitudeFt)||
      !Number.isFinite(readings.differentialPsid))
   return Object.freeze({status:'INVALID_SENSOR_SAMPLE',previewApproved:false});
  const cabAlt=readings.cabinAltitudeFt>=0&&readings.cabinAltitudeFt<=50000?
     cabinAltitudePreviewBearing(readings.cabinAltitudeFt):null;
  const press=differentialPressurePreviewBearing(readings.differentialPsid);
  return Object.freeze({status:cabAlt!==null&&press!==null?
   'BOTH_CANDIDATE_BEARINGS':'OUT_OF_PRINTED_RANGE',
   cabAltBearingDeg:cabAlt,pressBearingDeg:press,
   previewApproved:false,operationalNeedleAuthorized:false});
 }
 function cabinAltitudePreviewBearing(valueFt){
  if(typeof valueFt!=='number'||!Number.isFinite(valueFt))throw Error('Invalid CAB ALT reading');
  const a=cabinAltPhotoAnchors;
  const v=Math.max(a[0].valueFt,Math.min(a[a.length-1].valueFt,valueFt));
  for(let i=1;i<a.length;i++)if(v<=a[i].valueFt){
   const lo=a[i-1],hi=a[i],t=(v-lo.valueFt)/(hi.valueFt-lo.valueFt);
   return lo.bearingDeg+t*(hi.bearingDeg-lo.bearingDeg);
  }
  return a[a.length-1].bearingDeg;
 }

 // Physical stack (front/back) is NOT the printed dial's inner/outer scale.
 // Owner-specified: PRESS lies underneath/inside the CAB ALT pointer assembly.
 // Immutable artwork: PRESS still reads the outer PSI graduations and CAB ALT
 // still reads the inner thousand-foot graduations on the source OH19 face.
 // Tip scales were adjusted by source-image radial stroke QA and real SVG path
 // endpoints (CAB ALT 217px, PRESS 221px from sprite centre). These are
 // PREVIEW-ONLY fit estimates: 47 inner / 51 outer native strokes are candidates,
 // hidden spindle axis and exact mechanical contacts remain uncertified.
 const needles=Object.freeze([
  Object.freeze({id:'press',label:'PRESS · lower needle / outer PSI scale',asset:'cabin-diff-pressure-needle.svg',tipRadius:222.7,initialAngle:0,layer:0,stack:'rear',printedScale:'outer',valueSource:'differentialPsid'}),
  Object.freeze({id:'cabAlt',label:'CAB ALT · upper needle / inner x1000 FT scale',asset:'cabin-altitude-needle.svg',tipRadius:114.3,initialAngle:0,layer:1,stack:'front',printedScale:'inner',valueSource:'cabinAltitudeFt'})
 ]);
 function angle(id,value){
  if(!needles.some(needle=>needle.id===id))throw Error('Unknown cabin gauge needle '+id);
  const n=Number(value);if(!Number.isFinite(n))throw Error('Cabin gauge angle must be finite');
  // OH19 native-photo scales rotate clockwise from the 12-o'clock reference
  // through >320 deg; the old +/-166 deg QA slider obscured half the dial.
  // QA control only. Production mechanical stops need separate source approval.
  return Math.max(0,Math.min(360,n));
 }
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH19 atlas placement');
  return {x:piece.x+pivot.x*piece.w/source.width,y:piece.y+pivot.y*piece.h/source.height};
 }
 return Object.freeze({source,pivot,needles,angle,placement,cabinAltPhotoAnchors,cabinAltitudePreviewBearing,pressurePhotoAnchors,differentialPressurePreviewBearing,resolvePhysicalReadings,photoPreviewApproved:false});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cabin-dual-needles-unified.js?v=CDN-0004 */
try{
(function(){
 'use strict';
 const model=window.B737CabinDualNeedlesModel,ns='http://www.w3.org/2000/svg';
 const sprites=Object.fromEntries(model.needles.map(needle=>[needle.id,new URL('./'+needle.asset+'?v=CDN-0004',document.baseURI).href]));
 const state=Object.fromEntries(model.needles.map(needle=>[needle.id,needle.initialAngle]));
 const blades=new Map(),inputs=new Map(),outputs=new Map();
 let frame=null,physical=null,physicalOutput=null;
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(id){
  const blade=blades.get(id);if(blade)blade.style.transform=`rotate(${state[id]}deg)`;
  const input=inputs.get(id),output=outputs.get(id);if(input)input.value=String(state[id]);if(output)output.textContent=`${state[id]}°`;
 }
 function setAngle(id,value){state[id]=model.angle(id,value);paint(id);return state[id];}
 function setAngles(values){for(const [id,value]of Object.entries(values||{}))setAngle(id,value);return {...state};}
 // Physical cabin altitude comes from the selected CPCS/DCPCS plant.
 // Needle offsets stay visual-only until the inner CAB ALT x1000-ft photo
 // graduations have measured pixel coordinates and release approval.
 function setMeasuredReadings(readings,system='UNKNOWN'){
  const mapping=model.resolvePhysicalReadings(readings);
  if(mapping.status==='INVALID_SENSOR_SAMPLE')return null;
  // These are the selected training plant's measured inputs, NOT certified
  // aircraft bus feeds, and their angles remain source-photo QA candidates.
  physical=Object.freeze({
    cabinAltitudeFt:readings.cabinAltitudeFt,
    differentialPsid:readings.differentialPsid,
    cabinRateFtMin:Number.isFinite(readings.cabinRateFtMin)?readings.cabinRateFtMin:null,
    calibrationApproved:false,
    operatingInstallation:system,
    source:'CABIN_PRESSURE_PLANT_PROVISIONAL',
    mappingStatus:mapping.status,
    operationalNeedleAuthorized:false
  });
  // Update both visual previews INDEPENDENTLY from the one selected plant.
  // Invalid/out-of-dial physical values retain their last pointer angle, not
  // a fabricated zero or out-of-range sweep.
  if(mapping.cabAltBearingDeg!==null){
    state.cabAlt=model.angle('cabAlt',mapping.cabAltBearingDeg);paint('cabAlt');
  }
  if(mapping.pressBearingDeg!==null){
    state.press=model.angle('press',mapping.pressBearingDeg);paint('press');
  }
  if(physicalOutput)physicalOutput.textContent=
    system+' · CAB ALT: '+physical.cabinAltitudeFt.toFixed(0)+' ft · DIFF PRESS: '+
    physical.differentialPsid.toFixed(2)+' psi'+
    '\\nCAB ALT '+state.cabAlt.toFixed(2)+'° · PRESS '+state.press.toFixed(2)+'°'+
    '\\n'+mapping.status+' · PHOTO CANDIDATES ONLY (NOT FINAL).';
  return physical;
 }

 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return false;
  const piece=host.querySelector(`.atlas-piece[data-key="${model.source.piece}"]`);if(!piece)return false;
  if(host.querySelector('[data-cabin-dual-needles]'))return true;
  const layer=svg(doc,host,'svg',{'data-cabin-dual-needles':'OH19',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'Cabin pressure and cabin altitude independent needles'});
  Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,width:piece.style.width,height:piece.style.height,zIndex:'1002',pointerEvents:'none',overflow:'hidden'});
  // Source-pixel tip lengths now use inspected SVG path endpoints (not the
  // mistaken assumption that nominal tipRadius is the actual painted reach).
  // Owner sprites are immutable; this only changes group scaling in preview.
  // Source-photo contract: outer PSI tick arc belongs to PRESS and inner
  // x1000-ft arc belongs to CAB ALT. Physical stack is independent: the
  // PRESS assembly must be behind the CAB ALT assembly (owner correction).
  // Painter's ordering comes from the array sorted by explicit stack layer.
  const stack=model.needles.slice().sort((a,b)=>a.layer-b.layer);
  for(const needle of stack){
   const assembly=svg(doc,layer,'g',{transform:`translate(${model.pivot.x} ${model.pivot.y}) scale(${needle.tipRadius/220}) translate(-256 -256)`});
   const blade=svg(doc,assembly,'g',{'data-cabin-needle':needle.id,'data-cabin-stack':needle.stack,'data-cabin-printed-scale':needle.printedScale});
   Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'transform 320ms ease-out'});
   svg(doc,blade,'image',{href:sprites[needle.id],x:0,y:0,width:512,height:512});blades.set(needle.id,blade);paint(needle.id);
  }
  return true;
 }
 function bind(){if(mount())return;const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(host,{childList:true});}
 function connect(){const next=document.getElementById('overheadFrame');if(!next||next===frame)return;frame=next;frame.addEventListener('load',()=>{blades.clear();bind();});bind();}
 function controls(){
  const section=document.createElement('section');section.id='unifiedCabinDualNeedles';
  const title=document.createElement('h2');title.textContent='Cabin gauge · PRESS / CAB ALT';section.append(title);
  const note=document.createElement('p');note.className='muted';note.textContent='Two independently moving needles share a pivot. CAB ALT derives from airport/cabin-pressurization state; needle angles still require photo-scale approval.';section.append(note);
  physicalOutput=document.createElement('output');
  physicalOutput.style.display='block';physicalOutput.style.whiteSpace='pre-line';
  physicalOutput.style.direction='ltr';physicalOutput.style.textAlign='left';
  physicalOutput.textContent='CAB ALT: waiting for cabin physical state...';
  section.append(physicalOutput);
  if(physical)setMeasuredReadings(physical);
  for(const needle of model.needles){
   const label=document.createElement('label');label.textContent=needle.label;label.style.display='block';label.style.direction='ltr';
   const input=document.createElement('input');Object.assign(input,{type:'range',min:'0',max:'360',step:'0.5'});input.style.width='100%';input.style.accentColor='#edf0e8';
   const output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';
   input.addEventListener('input',()=>setAngle(needle.id,Number(input.value)));label.append(input,output);section.append(label);
   inputs.set(needle.id,input);outputs.set(needle.id,output);paint(needle.id);
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='Restore Source Photo Position';reset.addEventListener('click',()=>{for(const needle of model.needles)setAngle(needle.id,needle.initialAngle);});section.append(reset);
  const previous=document.querySelector('#unifiedApuEgtNeedle');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);
 }
 window.B737UnifiedCabinNeedles=Object.freeze({
  getAngles:()=>({...state}),setAngle,setAngles,setMeasuredReadings,
  getMeasuredReadings:()=>physical
 });
 window.addEventListener('b737:cabin-needle-angles',event=>{try{setAngles(event.detail);}catch(error){console.error(error);}});
 window.addEventListener('b737:pressurization-state',event=>{
  if(window.B737UnifiedInstructorNonNormalV1?.pressureState?.()?.rapid)return;
  const detail=event.detail;
  if(detail?.system!=='CPCS'&&detail?.system!=='DCPCS')return;
  // Ignore inactive installation's delayed or replayed pressure readings.
  const selected=window.B737PressurizationIntegration?.getSelected?.();
  if(selected&&detail.system!==selected)return;
  const reading=detail.output?.physical;
  if(reading)setMeasuredReadings(reading,detail.system);
 });
 window.addEventListener('b737:cockpit-mounted',connect);connect();if(document.querySelector('.inspector'))controls();
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./cabin-rate-needle-model.js?v=CRN-0001 */
try{
(function(root,factory){
 'use strict';
 const model=factory();
 if(typeof module==='object'&&module.exports)module.exports=model;
 if(root)root.B737CabinRateNeedleModel=model;
})(typeof globalThis==='object'?globalThis:this,function(){
 'use strict';
 // All coordinates are source pixels of the immutable OH19 image.
 const source=Object.freeze({piece:'OH19-DIFF',width:1267,height:1241});
 const pivot=Object.freeze({x:520,y:950});
 const needle=Object.freeze({asset:'cabin-rate-needle.svg',tipRadius:139,initialOffset:0,zeroBearing:-90});
 function offset(value){
  const n=Number(value);if(!Number.isFinite(n))throw Error('Cabin rate needle offset must be finite');
  return Math.max(-145,Math.min(145,n));
 }
 function bearing(value){return needle.zeroBearing+offset(value);}
 function placement(piece){
  if(!piece||![piece.x,piece.y,piece.w,piece.h].every(Number.isFinite)||piece.w<=0||piece.h<=0)throw Error('Invalid OH19 atlas placement');
  return {x:piece.x+pivot.x*piece.w/source.width,y:piece.y+pivot.y*piece.h/source.height};
 }
 return Object.freeze({source,pivot,needle,offset,bearing,placement});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
