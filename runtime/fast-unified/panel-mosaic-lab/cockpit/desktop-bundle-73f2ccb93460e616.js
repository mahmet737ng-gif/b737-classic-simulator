(async()=>{
;
/* ./asp-controls-model-v1.js?v=ASP-CONTROLS-0001 */
try{
/* Owner-specified ASP selection latches and 270-degree receiver travel. */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.B737ASPControlsModel=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const MIC=Object.freeze(['VHF-1','VHF-2','VHF-3','HF-1','SERV INT','FLT INT','PA']);
 const LOWER=Object.freeze(['NAV-1','NAV-2','ADF-1','ADF-2','MKR','SPKR']);
 const sockets=Object.freeze([
  ...MIC.map((channel,i)=>Object.freeze({kind:'mic',channel,x:115+150*i,y:166,w:100,h:104})),
  ...MIC.map((channel,i)=>Object.freeze({kind:'volume',channel,x:115+150*i,y:348,w:96,h:96})),
  ...LOWER.map((channel,i)=>Object.freeze({kind:'volume',channel,x:180+155*i,y:571,w:96,h:96}))
 ]);
 const clamp=n=>Math.max(0,Math.min(100,Number.isFinite(n)?n:0));
 function create(){
  const state=new Map();
  function get(seat,kind,channel){
   if(!['CAPT','FO','OBS'].includes(seat)||!sockets.some(s=>s.kind===kind&&s.channel===channel))throw Error('Unknown ASP control');
   const key=[seat,kind,channel].join(':');
   if(!state.has(key))state.set(key,{selected:false,volume:0});
   return state.get(key);
  }
  function snapshot(seat,kind,channel){const s=get(seat,kind,channel);return Object.freeze({...s,angle:45+s.volume*2.7});}
  return Object.freeze({
   snapshot,
   toggle(seat,kind,channel){const s=get(seat,kind,channel);s.selected=!s.selected;return snapshot(seat,kind,channel);},
   setVolume(seat,channel,value){get(seat,'volume',channel).volume=clamp(value);return snapshot(seat,'volume',channel);}
  });
 }
 // Short signed angular delta avoids jumps at the bottom dead sector.
 const angularDelta=(from,to)=>((to-from+540)%360)-180;
 return Object.freeze({version:'ASP-CONTROLS-0001',viewBox:Object.freeze([1122,888]),sockets,create,angularDelta});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./asp-socket-registration-v2.js?v=ASP-CENTER-0002-VIEWBOX-0005 */
try{
/* ASP-CENTER-0002: source-photo aperture + actual alpha silhouette registration.
 * Pure geometry helper: DOES NOT modify approved cockpit images or avionics.
 */
(function(root,factory){
 'use strict';const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 else root.B737ASPSocketRegistrationV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const W=1122,H=888;
 const n=x=>Number(x);
 function extract(svg){
  // SVG geometry is the authoritative socket source, not guessed CSS.
  const mic=[...svg.matchAll(/<rect\b[^>]*x="([\d.]+)" y="114" width="100" height="104"[^>]*\/>/g)]
   .map(m=>({kind:'mic',x:n(m[1])+50,y:166,w:100,h:104}));
  const vol=[...svg.matchAll(/<circle\b[^>]*cx="([\d.]+)" cy="(348|571)" r="45"[^>]*\/>/g)]
   .map(m=>({kind:'volume',x:n(m[1]),y:n(m[2]),w:90,h:90}));
  // The photographic ring (r=45) is the actual measured aperture.
  if(mic.length!==7||vol.length!==13)throw Error('ASP photo: expected 7 MIC + 13 receiver apertures; found '+mic.length+'/'+vol.length);
  mic.sort((a,b)=>a.x-b.x);
  vol.sort((a,b)=>a.y-b.y||a.x-b.x);
  return Object.freeze([...mic,...vol].map(x=>Object.freeze(x)));
 }
 function mask(imageData,threshold=48){
  const {data,width,height}=imageData;
  if(!(width>0&&height>0&&data.length>=width*height*4))throw Error('Invalid image mask');
  const stride=width>1700?3:2,cols=new Float64Array(width),rows=new Float64Array(height);
  let count=0,alphaSum=0;
  const inc=(x,y,v)=>{cols[x]+=v;rows[y]+=v;alphaSum+=v;count++};
  for(let y=0;y<height;y+=stride)for(let x=0;x<width;x+=stride){
   const k=(y*width+x)*4,a=data[k+3];
   if(a>=threshold)inc(x,y,a);
  }
  if(count<20)throw Error('Sprite has no visible silhouette');
  // Fallback for source images that unexpectedly contain an opaque square:
  // segment the actual photo rather than calibrating to the square canvas.
  if(count>width*height/(stride*stride)*.94){
   cols.fill(0);rows.fill(0);count=0;alphaSum=0;
   const corners=[[0,0],[width-1,0],[0,height-1],[width-1,height-1]];
   const bg=[0,1,2].map(c=>corners.reduce((a,[x,y])=>a+data[(y*width+x)*4+c],0)/4);
   for(let y=0;y<height;y+=stride)for(let x=0;x<width;x+=stride){
    const k=(y*width+x)*4;
    const delta=Math.hypot(data[k]-bg[0],data[k+1]-bg[1],data[k+2]-bg[2]);
    if(delta>=26)inc(x,y,Math.min(255,delta));
   }
   if(count<20)throw Error('Cannot distinguish visible sprite from full-canvas background');
  }
  // 0.5%-99.5% trimmed silhouette bounds exclude stray alpha dust.
  function limit(hist,total,fract,fromEnd=false){
   let sum=0;
   if(fromEnd){for(let i=hist.length-1;i>=0;i--){sum+=hist[i];if(sum>=total*fract)return i;}}
   else{for(let i=0;i<hist.length;i++){sum+=hist[i];if(sum>=total*fract)return i;}}
   return 0;
  }
  const x0=limit(cols,alphaSum,.005),x1=limit(cols,alphaSum,.005,true);
  const y0=limit(rows,alphaSum,.005),y1=limit(rows,alphaSum,.005,true);
  if(x1<=x0||y1<=y0)throw Error('Degenerate ASP visible silhouette');
  return Object.freeze({x:x0,y:y0,w:x1-x0+stride,h:y1-y0+stride,cx:(x0+x1)/2,cy:(y0+y1)/2,width,height,coverage:count*stride*stride/(width*height)});
 }
 // An <img> sourced from the approved ASP SVG honors viewBox's default
 // preserveAspectRatio=xMidYMid meet. CSS object-fit:fill does NOT remove
 // the internal viewBox letterbox on rectangular Unified viewports.
 function viewport(width,height,originX=0,originY=0){
  if(!(width>0&&height>0))throw Error('Invalid ASP viewport');
  const scale=Math.min(width/W,height/H);
  const padX=(width-W*scale)/2,padY=(height-H*scale)/2;
  return Object.freeze({scale,padX,padY,width,height,
   point(x,y){return {x:originX+padX+x*scale,y:originY+padY+y*scale};}});
 }
 function fit(slot,silhouette,hostWidth,hostHeight,kind){
  const frame=viewport(hostWidth,hostHeight),uniform=frame.scale;
  if(!(uniform>0))throw Error('Invalid ASP host dimensions');
  // Respect the original knob/mic proportions. Do not stretch the PNG.
  const allowance=kind==='mic'?{x:.88,y:.92}:{x:1.03,y:1.03};
  const scale=Math.min(slot.w*uniform*allowance.x/silhouette.w,slot.h*uniform*allowance.y/silhouette.h);
  const w=slot.w*uniform,h=slot.h*uniform;
  return Object.freeze({
   left:w/2-silhouette.cx*scale,top:h/2-silhouette.cy*scale,
   imageW:silhouette.width*scale,imageH:silhouette.height*scale,
   hitW:w,hitH:h,
   centerX:frame.point(slot.x,slot.y).x,centerY:frame.point(slot.x,slot.y).y,
   visibleCenterX:frame.point(slot.x,slot.y).x,visibleCenterY:frame.point(slot.x,slot.y).y,
   visibleW:silhouette.w*scale,visibleH:silhouette.h*scale,
   scale
  });
 }
 function compareSockets(modelSockets,sourceSockets){
  if(modelSockets.length!==sourceSockets.length)throw Error('ASP model and SVG socket counts diverged');
  return modelSockets.map(m=>{
   const q=sourceSockets.find(s=>s.kind===m.kind&&Math.hypot(s.x-m.x,s.y-m.y)<.01);
   if(!q)throw Error('Missing measured aperture for '+m.kind+' '+m.channel);
   return Object.freeze({...q,channel:m.channel});
  });
 }
 return Object.freeze({version:'ASP-CENTER-0002',viewBox:Object.freeze([W,H]),extract,mask,fit,compareSockets,viewport});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./asp-controls-v1.js?v=ASP-INSTANT-RELEASE-0003&amp;fit=0001 */
try{
/* Byte-identical owner sprites, registered to existing SVG aperture centers.
 * All three stations retain their own state. No audio/backend wiring implied.
 */
(function(root){
 'use strict';
 const model=root.B737ASPControlsModel;if(!model)return;
 const state=model.create(),mounted=new Map(),ns='http://www.w3.org/2000/svg';
 const ASSETS=Object.freeze({mic:['mic-off.png','mic-on.png'],volume:['volume-glass-off.png','volume-glass-on.png']});
 // Common source-space pivots; transparent padding is excluded from sizing.
 const SOURCE_MASKS=Object.freeze({"mic-off.png":{"sha256":"b68d4f30f7dcef356c1aa194cd7fed55241091f5d74f9efc0147f22f48dc2b2b","mask":{"x":358,"y":130,"w":540,"h":996,"cx":627,"cy":627,"width":1254,"height":1254,"coverage":0.3427907887741683}},"mic-on.png":{"sha256":"0bb7a727395212b5b578d56186d19565eee8afe7248920f9a5bd96a78a123874","mask":{"x":356,"y":128,"w":542,"h":998,"cx":626,"cy":626,"width":1254,"height":1254,"coverage":0.34433989860834485}},"volume-glass-off.png":{"sha256":"9f67035dc7fcdc2ca861d9d48ad4c9dd93309a718a9a4c5fb29445ac8f852276","mask":{"x":158,"y":154,"w":938,"h":936,"cx":626,"cy":621,"width":1254,"height":1254,"coverage":0.47327976313118597}},"volume-glass-on.png":{"sha256":"450d942811e7b3e6359f503b7095b15363910198ef1d4c1d115e412f5eae2a24","mask":{"x":156,"y":152,"w":944,"h":942,"cx":627,"cy":622,"width":1254,"height":1254,"coverage":0.4798653876971681}}});
 const SOURCE=Object.freeze({mic:{size:1254,pivot:[627,626.5],extent:1015},volume:{size:1254,pivot:[627,621],extent:990}});
 const registrar=root.B737ASPSocketRegistrationV2;
 const OBS_FRAME=root.B737ASPOnlyObserver===true;
 const assetRoot=OBS_FRAME?'../cockpit/':'./';
 let measured=null,measureError='',geometrySource=null;
 const obsLiveMasks=new Map(),obsMeasuring=new Set();
 // The four approved PNGs have identical source pixels in CAPT/FO/OBS.
 // Share their source-mask promises across same-origin frames, retaining
 // each panel's own viewport/socket registration and live control state.
 const maskTasks=(()=>{try{const host=root.top||root;return host.B737AspMaskTasksV1||(host.B737AspMaskTasksV1=new Map());}catch{return new Map();}})();
 function calibrateObserverImage(image,name,host){
  if(!OBS_FRAME||host.dataset.seat!=='OBS'||obsLiveMasks.has(name)||obsMeasuring.has(name))return;
  const scan=async()=>{
   if(!image.naturalWidth||!image.naturalHeight)return;
   obsMeasuring.add(name);
   try{
    // A display derivative keeps the original source calibration; standalone
    // photo checks still inspect the displayed PNG at its native dimensions.
    const source=image.dataset.perfSource;
    const shape=await silhouette(source||image.currentSrc||image.src);
    const width=source?Number(image.getAttribute('width')):image.naturalWidth;
    const height=source?Number(image.getAttribute('height')):image.naturalHeight;
    if(shape.width!==width||shape.height!==height)throw Error('ASP source dimensions changed during registration');
    obsLiveMasks.set(name,shape);
    host.dataset.aspObsMeasuredImages=String(obsLiveMasks.size);
    sizeControls(host);
    if(obsLiveMasks.size===4){
     host.dataset.aspRegistration='OBS-photo-alpha-4-of-4';
     root.dispatchEvent(new CustomEvent('b737:asp-centers-calibrated',{detail:{version:'ASP-OBS-CENTER-0004',stations:['OBS'],count:20}}));
    }
   }catch(error){host.dataset.aspObsMeasurementError=String(error.message||error);root.console?.warn?.('ASP OBS live-image center registration failed',error);}
   finally{obsMeasuring.delete(name);}
  };
  if(image.complete&&image.naturalWidth)scan();
  else image.addEventListener('load',scan,{once:true});
 }
 function calibrateObserverHost(host){
  if(!OBS_FRAME||host.dataset.seat!=='OBS')return;
  for(const b of host.querySelectorAll('.asp-photo-control')){
   const kind=b.dataset.kind,arr=ASSETS[kind];
   for(const image of b.querySelectorAll('.asp-control-image')){
    const name=arr[image.classList.contains('asp-image-on')?1:0];
    calibrateObserverImage(image,name,host);
   }
  }
 }
 // The imported photographic PNGs are NOT known to have centered subjects.
 // Detect the actual alpha silhouette of EACH OFF and ON sprite exactly once.
 async function silhouette(url){
  const key=new URL(url,document.baseURI).href;
  if(maskTasks.has(key))return maskTasks.get(key);
  const name=new URL(key).pathname.split('/').at(-1),certified=SOURCE_MASKS[name];
  if(certified&&key===new URL(assetRoot+'assets/asp-controls-v1/'+name,document.baseURI).href){
   // CI regenerates this exact mask with registrar.mask from the pinned PNG.
   const task=Promise.resolve(Object.freeze({...certified.mask}));maskTasks.set(key,task);return task;
  }
  const task=(async()=>{
  const photo=new Image();photo.src=key;
  if(photo.decode)await photo.decode();
  else await new Promise((resolve,reject)=>{photo.onload=resolve;photo.onerror=reject;});
  const cv=document.createElement('canvas');cv.width=photo.naturalWidth;cv.height=photo.naturalHeight;
  const ctx=cv.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('ASP: missing Canvas2D for alpha registration');
  ctx.clearRect(0,0,cv.width,cv.height);ctx.drawImage(photo,0,0);
  return registrar.mask(ctx.getImageData(0,0,cv.width,cv.height));
  })();
  maskTasks.set(key,task);
  try{return await task;}catch(error){maskTasks.delete(key);throw error;}
 }
 async function prepareRegistration(){
  if(!registrar)throw Error('ASP registration helper unavailable');
  const base=assetRoot+'assets/asp-controls-v1/';
  const names=[...ASSETS.mic,...ASSETS.volume];
  const shapes=await Promise.all(names.map(n=>silhouette(base+n)));
  const urls=[assetRoot+'assets/asp-bare-pedestal-v3.svg',assetRoot+'assets/asp-bare-aft-overhead-v3.svg'];
  const svg=await Promise.all(urls.map(async url=>{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error(url+' HTTP '+r.status);return registrar.extract(await r.text());}));
  const panels=Object.freeze({'pedestal':registrar.compareSockets(model.sockets,svg[0]),'aft-overhead':registrar.compareSockets(model.sockets,svg[1])});
  return {panels,masks:Object.freeze(Object.fromEntries(names.map((name,i)=>[name,shapes[i]])))};
 }
 function registeredSocket(host,button){
  return measured?.panels[host.dataset.region]?.find(s=>s.channel===button.dataset.channel&&s.kind===button.dataset.kind)
   ||model.sockets.find(s=>s.channel===button.dataset.channel&&s.kind===button.dataset.kind);
 }
 let observer;
 function preventPan(e){e.stopPropagation();}
 function paint(button){
  const {seat,kind,channel}=button.dataset,s=state.snapshot(seat,kind,channel);
  button.dataset.selected=String(s.selected);
  if(kind==='mic')button.setAttribute('aria-pressed',String(s.selected));
  else{
   button.dataset.angle=String(s.angle);button.dataset.volume=String(s.volume);
   button.setAttribute('aria-valuenow',String(Math.round(s.volume)));
   button.setAttribute('aria-valuetext',Math.round(s.volume)+'%, '+(s.selected?'selected':'off'));
   button.querySelector('.asp-control-rotor').style.transform='rotate('+s.angle+'deg)';
  }
 }
 function notify(button){paint(button);root.dispatchEvent(new CustomEvent('b737:asp-control',{detail:{...button.dataset,...state.snapshot(button.dataset.seat,button.dataset.kind,button.dataset.channel)}}));}
 function toggle(button){const d=button.dataset;state.toggle(d.seat,d.kind,d.channel);notify(button);}
 function volume(button,value){const d=button.dataset;state.setVolume(d.seat,d.channel,value);notify(button);}
 // A tap is a receiver-selector action. Deliberate displacement rotates
 // its 270-degree volume rotor; finger/mouse contact jitter never rotates it.
 const ASP_VOLUME_DRAG_START_PX=12,ASP_VOLUME_PIXELS_PER_PERCENT=7;
 function wire(button){
  let gesture=null,queuedVolume=null,queuedFrame=0,lastDragClick=null;
  const schedule=root.requestAnimationFrame?.bind(root);
  const cancel=root.cancelAnimationFrame?.bind(root);
  function flushVolume(commit){
   if(queuedFrame&&cancel)cancel(queuedFrame);
   queuedFrame=0;
   const final=queuedVolume;queuedVolume=null;
   if(commit&&final!==null)volume(button,final);
  }
  function addTravel(distance){
   if(!Number.isFinite(distance)||!distance)return;
   const current=queuedVolume??state.snapshot(button.dataset.seat,'volume',button.dataset.channel).volume;
   queuedVolume=Math.max(0,Math.min(100,current+distance/ASP_VOLUME_PIXELS_PER_PERCENT));
   if(!schedule){flushVolume(true);return;}
   if(!queuedFrame)queuedFrame=schedule(()=>{
    queuedFrame=0;
    const next=queuedVolume;queuedVolume=null;
    if(next!==null)volume(button,next);
   });
  }
  // The native ASP handler is the sole owner of pointer input: the generic
  // cockpit touch-router intentionally excludes receiver volume knobs.
  // Clicking only selects; rotation never selects a receiver.
  button.addEventListener('click',e=>{
   e.stopPropagation();
   // Consume only the browser-generated click belonging to the drag that
   // just ended, not the next independent tap (even if it is immediate).
   if(lastDragClick){
    const samePointer=Number.isFinite(e.pointerId)&&e.pointerId===lastDragClick.id;
    const legacyClick=!Number.isFinite(e.pointerId)&&
     e.timeStamp>=lastDragClick.time&&e.timeStamp-lastDragClick.time<80;
    lastDragClick=null;
    if(samePointer||legacyClick){e.preventDefault();return;}
   }
   toggle(button);
  });
  for(const type of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove','touchend'])
   button.addEventListener(type,preventPan);
  if(button.dataset.kind!=='volume')return;
  button.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   // A new finger owns a new gesture, regardless of when the last ended.
   lastDragClick=null;
   if(gesture)return;
   gesture={id:e.pointerId,startX:e.clientX,startY:e.clientY,
    lastX:e.clientX,lastY:e.clientY,moved:false,axis:null};
   button.dataset.aspGesture='TAP_PENDING';
   try{button.setPointerCapture(e.pointerId);}catch(_){}
  });
  button.addEventListener('pointermove',e=>{
   if(!gesture||gesture.id!==e.pointerId)return;
   const g=gesture,totalX=e.clientX-g.startX,totalY=e.clientY-g.startY;
   const dx=e.clientX-g.lastX,dy=e.clientY-g.lastY;
   g.lastX=e.clientX;g.lastY=e.clientY;
   if(!g.moved){
    if(Math.hypot(totalX,totalY)<ASP_VOLUME_DRAG_START_PX)return;
    g.moved=true;
    g.axis=Math.abs(totalX)>=Math.abs(totalY)?'x':'y';
    button.dataset.aspGesture='ROTATING';
    e.preventDefault();
    addTravel(g.axis==='x'?totalX:-totalY);
    return;
   }
   const distance=g.axis==='x'?dx:-dy;
   if(!distance)return;
   e.preventDefault();
   addTravel(distance);
  });
  function finish(e,cancelled=false){
   if(!gesture||(e&&gesture.id!==e.pointerId))return;
   const completed=gesture;
   gesture=null;
   button.dataset.aspGesture='IDLE';
   // ALWAYS release ownership before any backend/render work.
   try{if(button.hasPointerCapture?.(completed.id))
    button.releasePointerCapture(completed.id);}catch(_){}
   flushVolume(!cancelled);
   if(completed.moved&&!cancelled)
    lastDragClick={id:completed.id,time:e?.timeStamp??performance.now()};
  }
  button.addEventListener('pointerup',e=>finish(e));
  button.addEventListener('pointercancel',e=>finish(e,true));
  button.addEventListener('lostpointercapture',e=>finish(e,true));
  // Fallback for mobile browsers which terminate a touch stream without
  // delivering its corresponding pointerup to the original button.
  button.addEventListener('touchend',e=>{if(e.touches.length===0)finish(null);});
  button.addEventListener('touchcancel',e=>{if(e.touches.length===0)finish(null,true);});
  root.addEventListener('blur',()=>finish(null,true));
  root.addEventListener('pagehide',()=>finish(null,true));
  button.addEventListener('wheel',e=>{
   e.preventDefault();e.stopPropagation();
   const s=state.snapshot(button.dataset.seat,'volume',button.dataset.channel);
   volume(button,s.volume+(e.deltaY<0?2:e.deltaY>0?-2:0));
  },{passive:false});
  button.addEventListener('keydown',e=>{
   const s=state.snapshot(button.dataset.seat,'volume',button.dataset.channel);
   const actions={ArrowRight:s.volume+1,ArrowUp:s.volume+1,ArrowLeft:s.volume-1,ArrowDown:s.volume-1,PageUp:s.volume+10,PageDown:s.volume-10,Home:0,End:100};
   if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();toggle(button);}
   else if(Object.hasOwn(actions,e.key)){e.preventDefault();e.stopPropagation();volume(button,actions[e.key]);}
  });
 }
 function sizeControls(host){
  const style=getComputedStyle(host),rawW=parseFloat(style.width),rawH=parseFloat(style.height);
  if(!(rawW>0&&rawH>0))return;
  // OBS source aperture positions must be measured in the ACTUAL photo's
  // coordinate system, not the iframe wrapper or a previously hidden parent.
  const face=OBS_FRAME&&host.dataset.seat==='OBS'?host.querySelector(':scope > img'):null;
  const hostW=face?.offsetWidth||rawW,hostH=face?.offsetHeight||rawH;
  const imageOriginX=face?.offsetLeft||0,imageOriginY=face?.offsetTop||0;
  const faceViewport=registrar.viewport(hostW,hostH,imageOriginX,imageOriginY);
  const unit=faceViewport.scale;
  for(const b of host.querySelectorAll('.asp-photo-control')){
   const slot=registeredSocket(host,b),kind=b.dataset.kind,source=SOURCE[kind];
   if(!slot)continue;
   const nativeW=slot.w*unit,nativeH=slot.h*unit;
   const center=faceViewport.point(slot.x,slot.y);
   b.style.left=center.x+'px';b.style.top=center.y+'px';
   b.style.width=nativeW+'px';b.style.height=nativeH+'px';
   b.dataset.cx=String(slot.x);b.dataset.cy=String(slot.y);
   for(const img of b.querySelectorAll('.asp-control-image')){
    const name=ASSETS[kind][img.classList.contains('asp-image-on')?1:0];
    const silhouette=OBS_FRAME&&host.dataset.seat==='OBS'?(obsLiveMasks.get(name)||measured?.masks[name]):measured?.masks[name];
    if(silhouette){
     const box=registrar.fit(slot,silhouette,hostW,hostH,kind);
     Object.assign(img.style,{width:box.imageW+'px',height:box.imageH+'px',left:box.left+'px',top:box.top+'px'});
     img.dataset.aspMeasured='true';
     img.dataset.aspSourceCenter=silhouette.cx.toFixed(3)+','+silhouette.cy.toFixed(3);
     img.dataset.aspVisibleSize=box.visibleW.toFixed(3)+'x'+box.visibleH.toFixed(3);
    }else{
     // Only temporary until real bitmap alpha measurement finishes.
     const scale=(kind==='mic'?104:96)*unit/source.extent;
     Object.assign(img.style,{width:source.size*scale+'px',height:source.size*scale+'px',
      left:nativeW/2-source.pivot[0]*scale+'px',top:nativeH/2-source.pivot[1]*scale+'px'});
    }
   }
  }
  host.dataset.aspRegistration=OBS_FRAME&&host.dataset.seat==='OBS'?(obsLiveMasks.size===4?'OBS-photo-alpha-4-of-4':'OBS-alpha-'+obsLiveMasks.size+'-of-4')
   :(measured?'alpha-and-photo-centers-v2':'loading-actual-alpha');
 }
  function socketPatches(host){
  // Paint only the old empty apertures. Source panel, lettering and positions
  // remain untouched. This also prevents an elliptical hole behind round glass
  // on the nonuniformly mapped OH-04 face.
  const colors=host.dataset.region==='aft-overhead'?['#597083','#566e81','#526b7e']:['#6f7783','#727c89','#707987'];
  const id='asp-patch-'+host.dataset.seat;
  const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 1122 888');svg.setAttribute('preserveAspectRatio','xMidYMid meet');svg.setAttribute('aria-hidden','true');svg.classList.add('asp-socket-patches');
  const clips=model.sockets.map(s=>s.kind==='mic'?'<rect x="'+(s.x-53.5)+'" y="110.5" width="107" height="111"/>':'<rect x="'+(s.x-49)+'" y="'+(s.y-49)+'" width="98" height="98"/>').join('');
  svg.innerHTML='<defs><clipPath id="'+id+'-clip">'+clips+'</clipPath><linearGradient id="'+id+'-p" gradientUnits="userSpaceOnUse" x1="2" y1="2" x2="46.72" y2="886"><stop stop-color="'+colors[0]+'"/><stop offset=".55" stop-color="'+colors[1]+'"/><stop offset="1" stop-color="'+colors[2]+'"/></linearGradient><filter id="'+id+'-grain"><feTurbulence type="fractalNoise" baseFrequency=".31" numOctaves="2" seed="6"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="linear" slope=".055"/></feComponentTransfer></filter></defs><g clip-path="url(#'+id+'-clip)"><rect x="2" y="2" width="1118" height="884" fill="url(#'+id+'-p)"/><rect x="25" y="26" width="1072" height="826" filter="url(#'+id+'-grain)"/></g>';
  host.append(svg);
 }
 function mount(){
  for(const host of document.querySelectorAll('.asp-bare-mounted')){
   // Atlas redraw can replace the embedded OBS panel node.
   // Preserve already-approved CAPT/FO identities, but re-register OBS if changed.
   const previous=mounted.get(host.dataset.seat);
   if(previous===host)continue;
   if(previous&&OBS_FRAME&&host.dataset.seat==='OBS')mounted.delete('OBS');
   else if(previous)continue;
   socketPatches(host);
   for(const s of model.sockets){
    const button=document.createElement('button');button.type='button';button.className='asp-photo-control';
    Object.assign(button.dataset,{seat:host.dataset.seat,kind:s.kind,channel:s.channel,cx:String(s.x),cy:String(s.y)});
    button.style.left=s.x/1122*100+'%';button.style.top=s.y/888*100+'%';
    button.setAttribute('aria-label','ASP '+host.dataset.seat+' '+s.kind+' '+s.channel);
    button.title=s.kind==='mic'?'Press to select / deselect':'Press: select / deselect · Drag / wheel: volume · 270° travel';
    if(s.kind==='volume'){button.setAttribute('role','slider');button.setAttribute('aria-valuemin','0');button.setAttribute('aria-valuemax','100');}
    const rotor=document.createElement('span');rotor.className='asp-control-rotor';
    ASSETS[s.kind].forEach((name,i)=>{const img=document.createElement('img'),source=assetRoot+'assets/asp-controls-v1/'+name;
     if(root.B737ImageLoader?.assignPreview)root.B737ImageLoader.assignPreview(img,source,384);
     else img.src=source;
     img.alt='';img.draggable=false;img.className='asp-control-image asp-image-'+(i?'on':'off');rotor.append(img);});
    button.append(rotor);host.append(button);wire(button);paint(button);
   }
   host.dataset.aspControlsVersion=model.version;host.dataset.aspLampTest=String(document.documentElement.dataset.lampVisualTest==='true');
   sizeControls(host);new ResizeObserver(()=>sizeControls(host)).observe(host);mounted.set(host.dataset.seat,host);
   // OBS is a standalone embedded browser; every image is calibrated directly
   // on load, even if one unrelated SVG fetch fails. CAPT/FO untouched.
   if(OBS_FRAME&&host.dataset.seat==='OBS')calibrateObserverHost(host);
  }
  if(mounted.size===(OBS_FRAME?1:3)){observer?.disconnect();return true;}return false;
 }
 function audit(){
  return [...mounted].map(([seat,host])=>{
   const face=host.querySelector(':scope > img')||host;
   const r=face.getBoundingClientRect(),frame=registrar.viewport(r.width,r.height);
   const controls=[...host.querySelectorAll('.asp-photo-control')].map(b=>{
    const box=b.getBoundingClientRect(),p=frame.point(Number(b.dataset.cx),Number(b.dataset.cy));
    const expected={x:r.left+p.x,y:r.top+p.y};
    const imageMeasurements=[...b.querySelectorAll('.asp-control-image')].map(img=>{
     const name=ASSETS[b.dataset.kind][img.classList.contains('asp-image-on')?1:0];
     const shape=measured?.masks[name],rect=img.getBoundingClientRect();
     if(!shape)return {name,registered:false};
     const sx=rect.width/shape.width,sy=rect.height/shape.height;
     const actual={x:rect.left+shape.cx*sx,y:rect.top+shape.cy*sy};
     const errorCssPx=Math.hypot(actual.x-expected.x,actual.y-expected.y);
     return {name,registered:true,sourcePixelCenter:[shape.cx,shape.cy],visibleSize:[shape.w,shape.h],
      expected,actual,errorCssPx};
    });
    return {kind:b.dataset.kind,channel:b.dataset.channel,socket:{x:Number(b.dataset.cx),y:Number(b.dataset.cy)},
     hitCenterErrorCssPx:Math.hypot(box.left+box.width/2-expected.x,box.top+box.height/2-expected.y),
     imageMeasurements,roundnessCssPx:b.dataset.kind==='volume'?Math.abs(box.width-box.height):null};
   });
   return {seat,count:controls.length,registration:host.dataset.aspRegistration,
    maxImageCenterErrorCssPx:Math.max(0,...controls.flatMap(c=>c.imageMeasurements.map(i=>i.errorCssPx||0))),
    controls};
  });
 }
  root.B737ASPControls=Object.freeze({version:OBS_FRAME?'ASP-OBS-CENTER-0004':'ASP-CENTER-0002',audit,getCalibrationStatus:()=>({
  ready:OBS_FRAME?obsLiveMasks.size===4:!!measured,
  measuredImages:OBS_FRAME?obsLiveMasks.size:4,error:measureError,stations:mounted.size
 })});
 // Live geometry uses original photo apertures AND image-derived alpha centers.
 // Each of CAPT / FO / OBS is calibrated separately after the same four PNGs decode.
 prepareRegistration().then(data=>{
  measured=data;
  for(const host of mounted.values())sizeControls(host);
  root.dispatchEvent(new CustomEvent('b737:asp-centers-calibrated',{
   detail:{version:registrar.version,stations:[...mounted.keys()],count:model.sockets.length*mounted.size}
  }));
 }).catch(error=>{
  measureError=String(error.message||error);
  console.error('ASP-CENTER-0002 failed to measure real alpha:',error);
  for(const host of mounted.values())host.dataset.aspRegistration='ERROR:'+measureError;
 });
  if(OBS_FRAME)root.addEventListener('b737:asp-observer-mounted',mount);
  root.addEventListener('b737:cockpit-mounted',mount);
 root.addEventListener('b737:visual-test',e=>{for(const host of mounted.values())host.dataset.aspLampTest=String(e.detail?.active===true);});
 if(!mount()){observer=new MutationObserver(mount);observer.observe(document.documentElement,{childList:true,subtree:true});}
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./asp-observer-parent-bridge-v3.js?v=ASP-OBS-IFRAME-0003 */
try{
/* ASP-OBS-BRIDGE-0003: render OBS only in the real Overhead iframe.
 * CAPT and FO pedestal geometry and renderer remain untouched.
 * Retain the hidden parent OBS host as the existing backend's DOM adapter;
 * relay actual OBS controls from the atlas via origin/source-validated messages.
 */
(function(root){
 'use strict';
 let received=0,rejected=0;
 function iframe(){return document.getElementById('overheadFrame');}
 function hideStaleParent(){
  const old=document.querySelector('#region-overhead > .asp-bare-mounted[data-seat="OBS"]');
  if(old){
   old.style.setProperty('visibility','hidden','important');
   old.style.setProperty('pointer-events','none','important');
   old.dataset.aspObserverNative='in-overhead-iframe';
  }
 }
 const style=document.createElement('style');
 style.textContent='#region-overhead > .asp-bare-mounted[data-seat="OBS"]{visibility:hidden!important;pointer-events:none!important}';
 (document.head||document.documentElement).append(style);
 root.addEventListener('message',e=>{
  if(e.origin!==root.location.origin||!iframe()||e.source!==iframe().contentWindow)return;
  const message=e.data;
  if(!message||message.type!=='b737:asp-obs-control')return;
  const d=message.detail||{};
  if(d.seat!=='OBS'||!['mic','volume'].includes(d.kind)||typeof d.channel!=='string'){
   rejected++;return;
  }
  const model=root.B737ASPControlsModel;
  if(!model?.sockets?.some(x=>x.kind===d.kind&&x.channel===d.channel)){
   rejected++;return;
  }
  received++;
  root.dispatchEvent(new CustomEvent('b737:asp-control',{detail:{
   seat:'OBS',kind:d.kind,channel:d.channel,selected:d.selected,
   volume:d.volume,angle:d.angle,source:'actual-overhead-photo'
  }}));
 });
 const listener=new MutationObserver(hideStaleParent);
 function boot(){
  hideStaleParent();
  const overhead=document.getElementById('region-overhead');
  if(overhead)listener.observe(overhead,{subtree:false,childList:true});
  else listener.observe(document.documentElement,{subtree:true,childList:true});
 }
 root.B737ASPObserverBridge=Object.freeze({
  inspect:()=>{
   const frame=iframe(),native=frame?.contentWindow?.B737ASPObserverOverhead;
   const control=frame?.contentWindow?.B737ASPControls;
   return {display:'embedded-iframe-only',legacyParentHidden:true,
    iframeReady:!!native,observer:native?.audit?.()||null,calibration:control?.getCalibrationStatus?.()||null,
    eventsReceived:received,rejected};
  }
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/asp-audio-v1.js?v=ASP-AUDIO-0001 */
try{
/* ASP AUDIO-LOGIC-0001 — Boeing 737 Classic FCOM 5.10.5-6, 5.20.1-3.
 * MRG IV.5 printed p123: alternate audio and candidate audio CBs.
 * Pure logic, classroom trainer; NOT certified aircraft wiring.
 */
(function(host,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(host)host.B737ASPAudioLogicV1=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const SEATS=Object.freeze(['CAPT','FO','OBS']);
const TRANSMITTERS=Object.freeze(['VHF-1','VHF-2','VHF-3','HF-1','SERV INT','FLT INT','PA']);
const RECEIVERS=Object.freeze([...TRANSMITTERS,'NAV-1','NAV-2','ADF-1','ADF-2','MKR','SPKR']);
const FIXED=Object.freeze({CAPT:'VHF-1',FO:'VHF-2',OBS:'VHF-1'});
// The MRG printed IV.6 p139 candidates clash with the actual CB photo catalogue
// at P6-2 D22/D23/D24. DO NOT auto-connect these candidates or overwrite the catalogue.
const CB_CANDIDATES=Object.freeze({CAPT:'P6-2|ALL|D23',FO:'P6-2|ALL|D22',OBS:'P6-2|ALL|D24'});
const copy=x=>JSON.parse(JSON.stringify(x));
const checkSeat=s=>{if(!SEATS.includes(s))throw Error('Invalid ASP crew seat');};
const check=(v,list,label)=>{if(!list.includes(v))throw Error('Invalid '+label);};
function initialState(){
 return {schema:'b737-asp-audio-v1',revision:0,stations:Object.fromEntries(SEATS.map(seat=>[seat,{
 mode:'NORM',mic:null,receivers:Object.fromEntries(RECEIVERS.map(ch=>[ch,false])),
 volumes:Object.fromEntries(RECEIVERS.map(ch=>[ch,50])),microphone:'BOOM',ptt:null,normalControlFault:false,alternateFault:false
 }]))};
}
function apply(src,cmd){
 if(src?.schema!=='b737-asp-audio-v1')throw Error('Invalid ASP state');
 if(!cmd||typeof cmd.type!=='string')throw Error('Invalid ASP command');
 checkSeat(cmd.seat);
 const out=copy(src),s=out.stations[cmd.seat];
 switch(cmd.type){
 case 'MODE':check(cmd.value,['NORM','ALT'],'mode');s.mode=cmd.value;break;
 case 'SELECT_MIC':
  check(cmd.channel,TRANSMITTERS,'MIC channel');
  if(s.mode==='NORM'&&!s.normalControlFault)s.mic=cmd.channel;
  break;
 case 'RECEIVER':
  check(cmd.channel,RECEIVERS,'receiver channel');
  if(typeof cmd.selected!=='boolean')throw Error('receiver selected must be boolean');
  if(s.mode==='NORM'&&!s.normalControlFault)s.receivers[cmd.channel]=cmd.selected;
  break;
 case 'VOLUME':
  check(cmd.channel,RECEIVERS,'volume channel');
  if(!Number.isFinite(cmd.value)||cmd.value<0||cmd.value>100)throw Error('Invalid receiver volume');
  if(s.mode==='NORM'&&!s.normalControlFault)s.volumes[cmd.channel]=cmd.value;
  break;
 case 'MIC_SOURCE':check(cmd.value,['BOOM','MASK'],'microphone source');s.microphone=cmd.value;break;
 case 'PTT':check(cmd.value,[null,'ASP_RT','ASP_IC','WHEEL_MIC','WHEEL_INT','HAND'],'PTT');s.ptt=cmd.value;break;
 case 'FAULT':
  check(cmd.fault,['normalControlFault','alternateFault'],'fault');
  if(cmd.instructor!==true||typeof cmd.active!=='boolean')throw Error('Instructor-only fault');
  s[cmd.fault]=cmd.active;break;
 default:throw Error('Unknown ASP command');
 }
 out.revision++;return out;
}
function powerEvidence(electrical){
 const bus=electrical?.bus;
 if(!bus)return {state:'UNKNOWN',source:'NO_ELECTRICAL_V7_READ',cb:'UNVERIFIED_CONFLICT'};
 const dc2=bus.dc2,battery=bus.battery;
 // MRG bus summary is multi-configuration. No EP-FSI WDM for exact terminal feed.
 return {state:'UNKNOWN',source:'ELECTRICAL_V7_BUS_EVIDENCE_ONLY',bus:{dc2:dc2??null,battery:battery??null},cb:'UNVERIFIED_CONFLICT',
  reason:'MRG multi-model Electronic Bus 2 / Battery Bus cannot establish exact ASP downstream supply'};
}
function stationProjection(src,seat,{powerMode='AIRCRAFT',electrical=null}={}){
 checkSeat(seat);check(powerMode,['AIRCRAFT','BENCH'],'powerMode');
 const s=src.stations[seat],alt=s.mode==='ALT',radio=alt?FIXED[seat]:s.mic;
 const available=!s[alt?'alternateFault':'normalControlFault'];
 const receivers=alt?[FIXED[seat]]:RECEIVERS.filter(ch=>s.receivers[ch]||ch===s.mic);
 const transmitting=alt?['ASP_RT','WHEEL_MIC'].includes(s.ptt):['ASP_RT','WHEEL_MIC','HAND','ASP_IC','WHEEL_INT'].includes(s.ptt);
 const isInterphone=['ASP_IC','WHEEL_INT'].includes(s.ptt);
 const tx=transmitting&&available&&(alt?['ASP_RT','WHEEL_MIC'].includes(s.ptt):true)?
  (alt?FIXED[seat]:isInterphone?'FLT INT':s.mic):null;
 const evidence=powerEvidence(electrical),isBench=powerMode==='BENCH';
 return {seat,mode:s.mode,powerMode,power:{...evidence,logicalBenchPower:isBench},
  functional:available,micSelection:radio,
  whiteMicLamp:available?radio:null,receiverSelectorsFunctional:!alt&&available,
  receiverVolumeFunctional:!alt&&available,receiverMonitor:available?receivers:[],
  receiverVolume:alt?'PRESET':copy(s.volumes),
  headsetAvailable:available,
  overheadSpeakerAvailable:!alt&&seat!=='OBS'&&available&&s.receivers.SPKR,
  warningsViaStation:!alt&&available,flightInterphone:!alt&&available,
  serviceInterphone:!alt&&available,paViaAsp:!alt&&available,
  handMicAvailable:!alt&&available,maskBoomSelectorFunctional:available,
  microphone:s.microphone,ptt:s.ptt,transmitRadio:tx,
  transmitPermission:tx===null?false:isBench?true:null,
  receiverPermission:!available?false:isBench?true:null,
  radioPreset:FIXED[seat],cbCandidate:CB_CANDIDATES[seat],
  cbStatus:'QUARANTINED_CATALOG_MISMATCH',
  limitation:isBench?'EXPLICIT_BENCH_POWER_NOT_AIRCRAFT':'UNKNOWN_REAL_AUDIO_EQUIPMENT_FEED'
 };
}
function project(src,options={}){if(src?.schema!=='b737-asp-audio-v1')throw Error('Invalid ASP state');
 return {schema:'B737_ASP_AUDIO_PROJECTION_V1',revision:src.revision,stations:Object.fromEntries(SEATS.map(seat=>[seat,stationProjection(src,seat,options)])),
  docs:['FCOM Vol2 5.10.5-6','FCOM Vol2 5.20.1-3','MRG IV.5 p123','MRG IV.6 p139 CB candidate; photo conflict'],
  circuitStatus:'EVIDENCE_ONLY_PENDING_EFFECTIVITY_AND_CATALOG_RECONCILIATION'};
}
return Object.freeze({SEATS,TRANSMITTERS,RECEIVERS,FIXED,CB_CANDIDATES,initialState,apply,project,powerEvidence});
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./asp-audio-runtime-v1.js?v=ASP-AUDIO-0001 */
try{
/* ASP AUDIO-RUNTIME-0001: independent station state + existing owner-approved controls.
 * No writes to any pinned overhead/IRS/guard or photo-asset files.
 * ALT/NORM hot-spots are invisible, registered to the existing switch aperture.
 * Pilot commands are logic only until verified aircraft bus and audio wiring exists.
 */
(function(root){'use strict';
 const Core=root.B737ASPAudioLogicV1;if(!Core){root.console?.error('ASP audio logic missing');return;}
 const seats=Core.SEATS;let state=Core.initialState(),powerMode='AIRCRAFT',panel=null;
 const copy=x=>JSON.parse(JSON.stringify(x));
 const getElectrical=()=>{
  try{return root.B737ISNCockpitV1?.getState?.()?.state?.electrical||null;}catch(_){return null;}
 };
 const read=()=>Core.project(state,{powerMode,electrical:getElectrical()});
 const send=(seat,type,fields={})=>{state=Core.apply(state,{seat,type,...fields});render();return read().stations[seat];};
 function setMode(seat,mode){return send(seat,'MODE',{value:mode});}
 function paint(){
  const data=read();
  for(const seat of seats){
   const host=document.querySelector('.asp-bare-mounted[data-seat="'+seat+'"]');
   if(!host)continue;
   const p=data.stations[seat];host.dataset.aspAudioMode=p.mode;
   // UI remains photographic: only existing illuminated-state flags are controlled.
   for(const b of host.querySelectorAll('.asp-photo-control')){
    const kind=b.dataset.kind,channel=b.dataset.channel;
    if(kind==='mic'){
     const lit=p.functional&&p.whiteMicLamp===channel;
     b.dataset.selected=String(Boolean(lit));b.setAttribute('aria-pressed',String(Boolean(lit)));
    }else{
     const lit=p.functional&&p.mode==='NORM'&&state.stations[seat].receivers[channel];
     b.dataset.selected=String(Boolean(lit));
     b.setAttribute('aria-valuetext',(state.stations[seat].volumes[channel]??50)+'%, '+(lit?'selected':'off'));
    }
    b.style.pointerEvents=p.mode==='ALT'?'none':'auto';
   }
   const hot=host.querySelector('[data-asp-alt-norm]');
   if(hot){hot.setAttribute('aria-label','ASP '+seat+' ALT NORM — '+p.mode);hot.title='ASP '+seat+' '+p.mode+' · click to select '+(p.mode==='NORM'?'ALT':'NORM');hot.setAttribute('aria-pressed',String(p.mode==='ALT'));}
  }
 }
 function render(){
  paint();
  if(panel){
   const data=read();
   for(const seat of seats){
    const p=data.stations[seat],row=panel.querySelector('[data-audio-seat="'+seat+'"]');
    if(!row)continue;
    row.querySelector('[data-status]').textContent=p.mode+' · '+(p.micSelection||'NO MIC')+' · '+(p.functional?'CONTROL OK':'FAULT')+' · '+(p.powerMode==='BENCH'?'BENCH':'AIRCRAFT POWER UNKNOWN');
    for(const mode of ['NORM','ALT'])row.querySelector('[data-mode="'+mode+'"]').setAttribute('aria-pressed',String(p.mode===mode));
   }
   panel.querySelector('[data-power-mode]').value=powerMode;
  }
  root.dispatchEvent(new CustomEvent('b737:asp-audio-state',{detail:{projection:read()}}));
 }
 function mount(){
  for(const seat of seats){
   const host=document.querySelector('.asp-bare-mounted[data-seat="'+seat+'"]');
   if(!host||host.querySelector('[data-asp-alt-norm]'))continue;
   const b=document.createElement('button');b.type='button';
   b.dataset.aspAltNorm=seat;
   b.style.cssText='position:absolute;left:87.34402852%;top:84.12162162%;width:8.7%;height:8.2%;transform:translate(-50%,-50%);margin:0;padding:0;opacity:0;border:0;background:transparent;cursor:pointer;z-index:5;touch-action:manipulation';
   b.addEventListener('pointerdown',e=>e.stopPropagation());
   b.addEventListener('click',e=>{e.stopPropagation();setMode(seat,state.stations[seat].mode==='NORM'?'ALT':'NORM');});
   host.append(b);
  }
  paint();
 }
 function buildPanel(){
  if(panel)return;const inspector=document.getElementById('inspector');if(!inspector)return;
  panel=document.createElement('section');panel.id='aspAudioDiagnostics';panel.dir='ltr';
  panel.style.cssText='border:1px solid #607888;border-radius:8px;padding:8px;margin:8px 0;font:11px/1.5 system-ui;display:grid;gap:7px;color:#dcebf5;background:#122531';
  const h=document.createElement('strong');h.textContent='ASP AUDIO · FCOM / MRG · PROCEDURE TRAINER';panel.append(h);
  const description=document.createElement('small');description.textContent='Three independent ALT/NORM circuits. LIVE bus/CB feed unverified; BENCH is instructor-only simulation.';panel.append(description);
  const select=document.createElement('select');select.dataset.powerMode='';
  for(const [val,label] of [['AIRCRAFT','AIRCRAFT (unverified equipment power)'],['BENCH','BENCH simulated power']]){
   const op=document.createElement('option');op.value=val;op.textContent=label;select.append(op);
  }select.onchange=()=>{powerMode=select.value;render();};panel.append(select);
  for(const seat of seats){
   const row=document.createElement('div');row.dataset.audioSeat=seat;row.style.cssText='border-top:1px solid #45606e;padding-top:4px;';
   const title=document.createElement('b');title.textContent=seat+' ';row.append(title);
   for(const mode of ['NORM','ALT']){
    const btn=document.createElement('button');btn.type='button';btn.dataset.mode=mode;btn.textContent=mode;btn.style.cssText='padding:3px 6px;margin:2px';
    btn.onclick=()=>setMode(seat,mode);row.append(btn);
   }
   const status=document.createElement('div');status.dataset.status='';row.append(status);panel.append(row);
  }
  inspector.prepend(panel);render();
 }
 // Existing mic/receiver buttons dispatch this physical event. We own only audio logic.
 root.addEventListener('b737:asp-control',e=>{
  const d=e.detail||{},seat=d.seat,channel=d.channel;
  if(!seats.includes(seat))return;
  const item=Core.RECEIVERS.includes(channel);
  if(!item)return;
  try{
   if(d.kind==='mic')send(seat,'SELECT_MIC',{channel});
   else if(d.kind==='volume'){
    send(seat,'RECEIVER',{channel,selected:Boolean(d.selected)});
    if(Number.isFinite(Number(d.volume)))send(seat,'VOLUME',{channel,value:Number(d.volume)});
   }
  }catch(err){root.console?.warn?.('ASP command rejected',err);}
  // Existing UI initially updates itself. Re-project from backend immediately.
  paint();
 });
 function boot(){mount();buildPanel();root.addEventListener('b737:cockpit-mounted',()=>{mount();buildPanel();render();});
  const observer=new MutationObserver(()=>{if(!seats.every(s=>document.querySelector('.asp-bare-mounted[data-seat="'+s+'"] [data-asp-alt-norm]')))mount();});
  observer.observe(document.getElementById('scene')||document.body,{subtree:true,childList:true});
  root.setInterval(()=>{if(document.getElementById('aspAudioDiagnostics'))render();},1500);
 }
 root.B737ASPAudioRuntimeV1=Object.freeze({
  setMode,getProjection:read,getState:()=>copy(state),
  setPowerMode(mode){if(!['AIRCRAFT','BENCH'].includes(mode))throw Error('Invalid ASP power mode');powerMode=mode;render();},
  dispatch(seat,type,fields){return send(seat,type,fields);},
  setMicSource(seat,microphone){return send(seat,'MIC_SOURCE',{value:microphone});},
  press(seat,value){return send(seat,'PTT',{value});},
  instructorFault(seat,fault,active){return send(seat,'FAULT',{fault,active,instructor:true});},
  diagnostics:()=>({powerEvidence:Core.powerEvidence(getElectrical()),cbCandidates:Core.CB_CANDIDATES,status:'CB_MAPPING_QUARANTINED'})
 });
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/integration/asp-electrical-cb-v2.js?v=ASP-ROUTE-0002 */
try{
/* ASP electrical / CB source evidence V2. FCOM 5.20.2; MRG IV.5 p123,
 * MRG IV.6 p139; actual project photo catalog P6-2 is different.
 * Read-only. No physical CB may be remapped to another system.
 */
(function(root,factory){'use strict';const api=factory(typeof module==='object'&&module.exports?require('../systems/asp-audio-v1.js'):root.B737ASPAudioLogicV1);
if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ASPCBSourceAuditV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A){'use strict';
const EXPECTED=Object.freeze({CAPT:'AUDIO CAPTAIN',FO:'AUDIO FO',OBS:'AUDIO OBS'});
const PHOTO=Object.freeze({CAPT:'EXT BOTTLES RIGHT',FO:'AURAL WARN',OBS:'EXT BOTTLES LEFT'});
function lookup(catalog,key){
 if(!catalog?.panels)return null;
 const [panel,,pos]=key.split('|');const entry=catalog.panels.find(p=>p.id===panel);
 if(!entry)return null;
 const m=String(entry.breakers||'').match(new RegExp('(?:^|;)\\s*'+pos.replace(/[-/\\^$*+?.()|[\]{}]/g,'\\$&')+':(?:\\d+(?:\\.\\d+)?)\\|([^;]+)'));
 return m?m[1].trim():null;
}
function examine({catalog=null,cbNetwork=null,electrical=null}={}){
 const stations={};
 for(const seat of A.SEATS){
  const key=A.CB_CANDIDATES[seat],actual=lookup(catalog,key);
  const label=actual??PHOTO[seat],agree=label===EXPECTED[seat];
  const cb=cbNetwork?.state?.(key)||null;
  const bus=electrical?.bus||null;
  stations[seat]={seat,candidate:key,expectedMRG:EXPECTED[seat],
   actualCatalogLabel:label,source:actual?'LIVE_CB_CATALOG':'REPOSITORY_CB_CATALOG_REFERENCE',
   catalogMatch:agree,sourceStatus:agree?'CANDIDATE_MATCH_NOT_WIRING_VERIFIED':'QUARANTINED_CATALOG_CONFLICT',
   candidateCB:cb?{pulled:Boolean(cb.pulled),tripped:Boolean(cb.tripped)}:null,
   dc2:bus?.dc2??null,battery:bus?.battery??null,
   devicePower:null,cbCanControlASP:false,wireTracing:'EP_FSI_EFFECTIVITY_WDM_REQUIRED',
   notes:'MRG list alone cannot override actual photo catalog or prove alternate ASP power path'};
 }
 return {schema:'B737_ASP_CB_AUDIT_V2',stations,mutatesElectrical:false,
  sourceRefs:['FCOM Vol 2 5.20.2','MRG IV.5 p123','MRG IV.6 p139','Existing CB photo catalog P6-2'],
  activeCBConnections:0,unverifiedSources:true};
}
return Object.freeze({examine,EXPECTED,PHOTO,lookup});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/systems/asp-audio-routing-v2.js?v=ASP-ROUTE-0002 */
try{
/* ASP Audio Routing V2 — FCOM 5.10.5-6 / 5.20.1-3, MRG IV.5 p123.
 * Computes transmission, monitor, speaker/handset paths and failure effects.
 * No actual radio broadcast, sound playback, aircraft-bus inference, or guarded assets.
 */
(function(root,factory){'use strict';const api=factory(typeof module==='object'&&module.exports?require('./asp-audio-v1.js'):root.B737ASPAudioLogicV1);
if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.B737ASPAudioRoutingV2=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(A){'use strict';
if(!A?.project||!A?.SEATS)throw Error('ASP Audio V1 required');
const ALLOWED=new Set([...A.TRANSMITTERS,...A.RECEIVERS]);
const RADIO_STATUSES=Object.freeze(['AVAILABLE','FAILED','UNKNOWN']);
const WARNINGS=Object.freeze(['GPWS','WINDSHEAR','ALTITUDE_ALERT']);
function validStatus(s){if(!RADIO_STATUSES.includes(s))throw Error('Invalid radio status');return s;}
function validateSignals(signal){if(!signal||typeof signal!=='object'||Array.isArray(signal))throw Error('Signals map required');
for(const [name,value] of Object.entries(signal)){if(!ALLOWED.has(name))throw Error('Unknown signal '+name);
 if(value!==true&&value!==false&&value!==null)throw Error('Signal must be boolean or null');}}
function compute(state,{powerMode='AIRCRAFT',electrical=null,radioStatus={},signals={},speakerInhibitOnTransmit=false,cbEvidence=null}={}){
 if(!['AIRCRAFT','BENCH'].includes(powerMode))throw Error('Invalid power mode');
 if(!radioStatus||typeof radioStatus!=='object'||Array.isArray(radioStatus))throw Error('Invalid radio status map');
 for(const [name,value] of Object.entries(radioStatus)){if(!ALLOWED.has(name))throw Error('Unknown radio '+name);validStatus(value);}
 validateSignals(signals);
 if(typeof speakerInhibitOnTransmit!=='boolean')throw Error('Invalid speaker-inhibit policy');
 const base=A.project(state,{powerMode,electrical});
 const txRequests=A.SEATS.map(seat=>{
  const p=base.stations[seat],t=state.stations[seat],channel=p.transmitRadio;
  let microphone=t.ptt==='HAND'?'HAND':t.microphone;
  const status=channel?(radioStatus[channel]|| (powerMode==='BENCH'?'AVAILABLE':'UNKNOWN')):null;
  const protectedFailure=channel&&status==='FAILED';
  const route=channel&&!protectedFailure?(powerMode==='BENCH'&&status==='AVAILABLE'?'TRAINER_ACTIVE':'UNVERIFIED_REAL_TX'):
              (protectedFailure?'RADIO_FAILED':'NO_TX_REQUEST');
  return {seat,mode:p.mode,channel,ptt:t.ptt,microphone,radioStatus:status,
   enabled:route==='TRAINER_ACTIVE'?true:route==='UNVERIFIED_REAL_TX'?null:false,
   routeStatus:route};
 });
 const transmittingBench=txRequests.some(t=>t.enabled===true);
 const stations={};
 for(const seat of A.SEATS){
  const p=base.stations[seat],tx=txRequests.find(t=>t.seat===seat),s=state.stations[seat];
  const audio=p.receiverMonitor.filter(ch=>ch!=='SPKR').map(ch=>{
   const sourceStatus=radioStatus[ch]||(powerMode==='BENCH'?'AVAILABLE':'UNKNOWN');
   const signal=Object.hasOwn(signals,ch)?signals[ch]:null;
   const volume=p.mode==='ALT'?'PRESET':s.volumes[ch]??null;
   const active=p.functional&&sourceStatus!=='FAILED'&&(powerMode==='BENCH'&&sourceStatus==='AVAILABLE'&&signal===true);
   return {channel:ch,sourceStatus,signal,volume,headset:p.functional&&sourceStatus!=='FAILED',
    rendered:active?true:!p.functional||sourceStatus==='FAILED'||signal===false?false:null,
    qualification:powerMode==='BENCH'?'TRAINER_ONLY':'ACTUAL_RADIO_FEED_UNVERIFIED'};
  });
  const speakerConfigured=p.overheadSpeakerAvailable;
  const inhibit=speakerInhibitOnTransmit&&transmittingBench;
  const speakerActive=speakerConfigured&&!inhibit;
  const received=audio.filter(a=>a.rendered===true).map(a=>a.channel);
  stations[seat]={seat,mode:p.mode,transmitter:tx,headset:{
    enabled:p.headsetAvailable,channels:audio,heardBench:received,
    volumePolicy:p.mode==='ALT'?'PRESET':'RECEIVER_SELECTORS'},
   speaker:{installed:seat!=='OBS',configured:speakerConfigured,enabled:speakerActive,
    channels:speakerActive?received:[],inhibitedByOtherTransmit:inhibit&&speakerConfigured,
    installationCaveat:'MRG optional speaker mute during any transmit (as installed)'},
   warnings:Object.fromEntries(WARNINGS.map(x=>[x,{viaThisAudioStation:p.warningsViaStation,
     independentlyOperative:null,claim:'GPWS/windshear/altitude alert system not globally disabled by ASP ALT'}])),
   interphone:{flight:p.flightInterphone,service:p.serviceInterphone},
   passengerAddress:{viaAsp:p.paViaAsp,controlStandHandsetSeparate:true},
   electrical:{...p.power,cb:cbEvidence?.stations?.[seat]||null},
   cbEffectApplied:false,radioPreset:p.radioPreset};
 }
 return {schema:'B737_ASP_AUDIO_ROUTING_V2',model:'PROCEDURE_QRH_TRAINER',electricalRouting:'EVIDENCE_ONLY',
  powerMode,stations,sharedRf:{radioStatus:{...radioStatus}},speakerInhibitAsInstalled:speakerInhibitOnTransmit,
  caveats:['NO_REAL_TRANSMISSION_OR_SPEAKER_PLAYBACK','CB_MAP_QUARANTINED',
           'AIRCRAFT_SOURCE_WIRING_UNVERIFIED','AURAL_WARNINGS_NOT_GLOBALLY_SUPPRESSED']};
}
return Object.freeze({compute,WARNINGS,RADIO_STATUSES});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
