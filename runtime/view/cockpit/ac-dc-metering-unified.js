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
  note.textContent='فقط همان چهار گیج و عقربه‌های قبلی؛ حرکت در تمام فریم‌ها داخل خط‌های چاپ‌شده و با شعاع ثابت نوک، سقف سرعت ۷۰ درجه بر ثانیه و شتاب نرم. DC AMPS و DC VOLTS از درجات عکس؛ CPS و AC VOLTS هنوز نیازمند ممیزی شعاع و محور دقیق تصویرند.';
  section.append(note);
  const verify=document.createElement('button');verify.type='button';
  verify.textContent='بررسی نسخه و وضعیت پاک‌سازی OH-10';
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
  const reset=document.createElement('button');reset.type='button';reset.textContent='پارک عقربه‌ها در وضعیت مرجع';
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
