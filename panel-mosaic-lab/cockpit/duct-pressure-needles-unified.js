/* OH21 dual duct pressure: one needle per pneumatic side on a shared pivot.
 * Source artwork and protected hardware are unchanged.
 */
(function(){
 'use strict';
 const model=window.B737DuctPressureNeedlesModel,live=window.B737DuctPressureLiveV1;
 const ns='http://www.w3.org/2000/svg';
 const sprites=Object.fromEntries(model.needles.map(needle=>[needle.id,new URL('./'+needle.asset+'?v=DPN-0005-LR',document.baseURI).href]));
 const state=Object.fromEntries(model.needles.map(needle=>[needle.id,needle.initialPsi]));
 const blades=new Map(),inputs=new Map(),outputs=new Map();
 const target=Object.fromEntries(model.needles.map(needle=>[needle.id,needle.initialPsi]));
 let motion=live.initialDynamics(state);
 let animationFrame=0,lastFrameAt=null;
 let frame=null,layer=null,manualOverride=false,source='INITIAL_ZERO',lastLive=null,powered=true,status=null;
 function animate(time){
  animationFrame=0;
  const dt=lastFrameAt===null?16:Math.min(80,Math.max(0,time-lastFrameAt));
  lastFrameAt=time;
  motion=live.advanceDynamics(motion,target,dt);
  for(const id of ['L','R']){
   state[id]=motion[id].value;
   paint(id);
  }
  if(!live.settled(motion,target))animationFrame=requestAnimationFrame(animate);
  else lastFrameAt=null;
 }
 function scheduleMotion(){
  if(!animationFrame)animationFrame=requestAnimationFrame(animate);
 }
 function svg(doc,parent,tag,attrs={}){
  const node=doc.createElementNS(ns,tag);
  for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));
  parent.append(node);return node;
 }
 function paint(id){
  const blade=blades.get(id);
  if(blade)blade.style.transform='rotate('+model.bearing(id,state[id])+'deg)';
  const input=inputs.get(id),output=outputs.get(id);
  if(input)input.value=String(state[id]);
  if(output)output.textContent=state[id].toFixed(1)+' PSI';
 }
 function paintStatus(){
  if(layer){
   layer.dataset.source=source;layer.dataset.powered=String(powered);
   for(const blade of blades.values())blade.style.opacity=powered?'1':'.25';
  }
  if(status)status.textContent=(manualOverride?'INSTRUCTOR OVERRIDE':source)+
   (powered?'':' · AC INDICATION UNAVAILABLE');
 }
 function updateValues(values,origin){
  let changed=false;
  for(const id of ['L','R']){
   if(!Object.prototype.hasOwnProperty.call(values||{},id)||values[id]===null)continue;
   const next=model.psi(id,values[id]);
   if(Math.abs(target[id]-next)>0.005){target[id]=next;changed=true;}
  }
  if(changed)scheduleMotion();
  source=origin;paintStatus();
  return changed;
 }
 function setPsi(id,value){
  const next=model.psi(id,value);manualOverride=true;
  updateValues({[id]:next},'INSTRUCTOR_OVERRIDE');
  return next;
 }
 function setValues(values){
  manualOverride=true;updateValues(values,'INSTRUCTOR_OVERRIDE');
  return {...state};
 }
 function auto(){
  manualOverride=false;
  if(lastLive){
   powered=lastLive.L!==null&&lastLive.R!==null;
   updateValues(lastLive,'LIVE_'+lastLive.source);
  }else{source='AWAITING_ECU';paintStatus();}
  return {...state};
 }
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  if(!host)return false;
  const piece=host.querySelector('.atlas-piece[data-key="'+model.source.piece+'"]');
  if(!piece)return false;
  if(host.querySelector('[data-duct-pressure-needles]'))return true;
  layer=svg(doc,host,'svg',{'data-duct-pressure-needles':'OH21',
   viewBox:'0 0 '+model.source.width+' '+model.source.height,preserveAspectRatio:'none',
   role:'img','aria-label':'Dual duct pressure indicator L and R, 0 to 100 PSI'});
  Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,
   width:piece.style.width,height:piece.style.height,zIndex:'1005',
   pointerEvents:'none',overflow:'hidden'});
  for(const needle of model.needles){
   const assembly=svg(doc,layer,'g',{
    transform:'translate('+model.pivot.x+' '+model.pivot.y+') scale('+
     needle.tipRadius/220+') translate(-256 -256)'
   });
   const blade=svg(doc,assembly,'g',{'data-duct-pressure-blade':needle.id});
   Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'none',
    willChange:'transform'});
   svg(doc,blade,'image',{href:sprites[needle.id],x:0,y:0,width:512,height:512});
   blades.set(needle.id,blade);paint(needle.id);
  }
  paintStatus();return true;
 }
 function bind(){
  if(mount())return;
  const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;
  const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});
  observer.observe(host,{childList:true});
 }
 function connect(){
  const next=document.getElementById('overheadFrame');if(!next||next===frame)return;
  frame=next;frame.addEventListener('load',()=>{blades.clear();layer=null;bind();});bind();
 }
 function controls(){
  const section=document.createElement('section');section.id='unifiedDuctPressureNeedles';
  const title=document.createElement('h2');title.textContent='DUCT PRESSURE · L / R';section.append(title);
  const note=document.createElement('p');note.className='muted';
  note.textContent='OH21 · 0–100 PSI · حرکت نرم و محدودشدهٔ عقربه · مصرف منطقی PACK / STARTER / TAI با محاسبهٔ فشار تخمینی؛ سنسور واقعی اولویت دارد.';
  section.append(note);
  status=document.createElement('p');status.className='muted';status.setAttribute('role','status');section.append(status);
  for(const needle of model.needles){
   const label=document.createElement('label');label.textContent=needle.label;
   label.style.display='block';label.style.direction='ltr';
   const input=document.createElement('input');
   Object.assign(input,{type:'range',min:'0',max:'100',step:'0.5'});
   input.style.width='100%';input.style.accentColor='#edf0e8';
   input.addEventListener('input',()=>setPsi(needle.id,Number(input.value)));
   const output=document.createElement('output');output.style.display='block';
   output.style.direction='ltr';output.style.textAlign='left';
   label.append(input,output);section.append(label);
   inputs.set(needle.id,input);outputs.set(needle.id,output);paint(needle.id);
  }
  const resume=document.createElement('button');resume.type='button';
  resume.textContent='AUTO · اتصال مجدد به ECU';resume.addEventListener('click',auto);section.append(resume);
  const previous=document.querySelector('#unifiedCabinTemperatureNeedle');
  if(previous)previous.after(section);else document.querySelector('.overhead-tools')?.before(section);
  paintStatus();
 }
 function receiveLive(data){
  if(!live?.project||!data?.ecu||!data?.bleed)return;
  try{
   const next=live.project(data);lastLive=next;
   if(manualOverride)return;
   powered=next.L!==null&&next.R!==null;
   updateValues(next,'LIVE_'+next.source);
  }catch(error){console.error('DUCT PRESSURE estimate unavailable',error);}
 }
 window.B737UnifiedDuctPressureNeedles=Object.freeze({
  getValues:()=>({...state}),getState:()=>({values:{...state},target:{...target},
   velocities:{L:motion.L.velocity,R:motion.R.velocity},source,powered,manualOverride,
   scale:model.scale,lastLive}),
  setPsi,setValues,resumeLive:auto
 });
 window.addEventListener('b737:duct-pressure-live-inputs',event=>receiveLive(event.detail));
 window.addEventListener('b737:duct-pressure-values',event=>{
  if(event.detail&&typeof event.detail==='object'&&
   (Number.isFinite(event.detail.L)||Number.isFinite(event.detail.R))){
   manualOverride=false;powered=true;
   updateValues(event.detail,'EXPLICIT_DUCT_SENSOR');
  }
 });
 window.addEventListener('b737:cockpit-mounted',connect);
 connect();if(document.querySelector('.inspector'))controls();
})();
