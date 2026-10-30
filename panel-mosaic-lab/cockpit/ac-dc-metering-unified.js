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
 let frame=null;
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
  const box={x:parseFloat(piece.style.left),y:parseFloat(piece.style.top),w:parseFloat(piece.style.width),h:parseFloat(piece.style.height)};
  for(const meter of model.meters){
   if(host.querySelector(`[data-metering-needle="${meter.id}"]`))continue;
   const p=model.placement(box,meter);
   const layer=svg(doc,host,'svg',{'data-metering-needle':meter.id,viewBox:'0 0 512 512',role:'img','aria-label':meter.label+' pointer'});
   Object.assign(layer.style,{position:'absolute',left:`${p.x-p.size/2}px`,top:`${p.y-p.size/2}px`,width:`${p.size}px`,height:`${p.size}px`,zIndex:'1000',pointerEvents:'none',overflow:'visible'});
   const defs=svg(doc,layer,'defs');
   const clip=svg(doc,defs,'clipPath',{id:`metering-window-${meter.id}`,clipPathUnits:'userSpaceOnUse'});
   // The lower grey gauge cover stays in front; only the black upper window shows the blade.
   svg(doc,clip,'rect',{x:0,y:0,width:512,height:237});
   const windowGroup=svg(doc,layer,'g',{'clip-path':`url(#metering-window-${meter.id})`});
   const blade=svg(doc,windowGroup,'g');
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
  if(mount(doc,host))return;
  const observer=new MutationObserver(()=>{if(mount(doc,host))observer.disconnect();});
  observer.observe(host,{childList:true});
 }
 function connectFrame(){
  const next=document.getElementById('overheadFrame');
  if(!next||next===frame)return;
  frame=next;
  frame.addEventListener('load',()=>{if(animationFrame)cancelAnimationFrame(animationFrame);animationFrame=0;lastFrameTime=null;mounted.clear();bindFrame();});
  bindFrame();
 }
 function controls(){
  const section=document.createElement('section');section.id='unifiedAcDcMeteringNeedles';
  const title=document.createElement('h2');title.textContent='AC / DC METERING · ORIGINAL 4 NEEDLES';section.append(title);
  const note=document.createElement('p');note.className='muted';
  note.textContent='فقط همان چهار گیج و عقربه‌های قبلی؛ حرکت در تمام فریم‌ها داخل خط‌های چاپ‌شده و با شعاع ثابت نوک، سقف سرعت ۷۰ درجه بر ثانیه و شتاب نرم. DC AMPS و DC VOLTS از درجات عکس؛ CPS و AC VOLTS هنوز نیازمند ممیزی شعاع و محور دقیق تصویرند.';
  section.append(note);
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
 window.B737UnifiedAcDcMetering=Object.freeze({getAngles:()=>({...state}),getReadings,getScaleMode:()=>acMode,setReading,setReadings,setAngle,setAngles});
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
