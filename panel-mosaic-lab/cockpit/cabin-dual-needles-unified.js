(function(){
 'use strict';
 const model=window.B737CabinDualNeedlesModel,ns='http://www.w3.org/2000/svg';
 const sprites=Object.fromEntries(model.needles.map(needle=>[needle.id,new URL('./'+needle.asset+'?v=CDN-0001',document.baseURI).href]));
 const state=Object.fromEntries(model.needles.map(needle=>[needle.id,needle.initialAngle]));
 const blades=new Map(),inputs=new Map(),outputs=new Map();
 const photoStretch={cabAlt:1,press:1};
 let photoPose=null;
 let frame=null,physical=null,physicalOutput=null;
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(id){
  const blade=blades.get(id);
  if(blade)blade.style.transform=`rotate(${state[id]}deg) scaleY(${photoStretch[id]||1})`;
  const input=inputs.get(id),output=outputs.get(id);if(input)input.value=String(state[id]);if(output)output.textContent=`${state[id]}°`;
 }
 function setAngle(id,value){
  state[id]=model.angle(id,value);
  photoStretch[id]=1;photoPose=null;
  paint(id);return state[id];
 }
 function setPhotoCabinAltitude(feet){
  const mapper=window.B737CabinAltitudePhotoMapV1;
  if(!mapper)return Object.freeze({status:'missing_photo_map'});
  const pose=mapper.poseAtFt(feet);
  if(pose.status==='out_of_range')return pose;
  // Preserve a monotonically UNWRAPPED clockwise angle through 180 degrees.
  // The source image has an elliptical projected tick track; gently correct
  // pointer *display length* without editing its owner-approved SVG sprite.
  const baseTip=mapper.displayedNeedle.scaledTipRadiusPx;
  const stretch=pose.innerRadiusPx/baseTip;
  if(!(Number.isFinite(stretch)&&stretch>.90&&stretch<1.10))
    return Object.freeze({status:'photo_fit_outside_safe_bounds'});
  photoStretch.cabAlt=stretch;
  state.cabAlt=pose.angleDeg;
  const entry=Object.freeze({...pose,tipStretch:stretch,
    visualStatus:'SOURCE_PHOTO_MAPPED_NOT_AIRCRAFT_CERTIFIED'});
  photoPose=Object.freeze({...photoPose,cabAlt:entry});
  paint('cabAlt');
  return photoPose;
 }
 function setPhotoDifferentialPsi(psi){
  const mapper=window.B737CabinDifferentialPhotoMapV1;
  if(!mapper)return Object.freeze({status:'missing_photo_map'});
  const pose=mapper.poseAtPsi(psi);
  if(pose.status==='out_of_range')return pose;
  if(!(Number.isFinite(pose.stretch)&&pose.stretch>.90&&pose.stretch<1.10))
    return Object.freeze({status:'photo_fit_outside_safe_bounds'});
  state.press=pose.angleDeg;
  photoStretch.press=pose.stretch;
  const entry=Object.freeze({...pose,
    visualStatus:'SOURCE_PHOTO_MAPPED_NOT_AIRCRAFT_CERTIFIED'});
  photoPose=Object.freeze({...photoPose,press:entry});
  paint('press');
  return entry;
 }
 function setAngles(values){for(const [id,value]of Object.entries(values||{}))setAngle(id,value);return {...state};}
 // Physical cabin altitude comes from the selected CPCS/DCPCS plant.
 // Needle offsets stay visual-only until the inner CAB ALT x1000-ft photo
 // graduations have measured pixel coordinates and release approval.
 function setMeasuredReadings(readings){
  if(!readings||!Number.isFinite(readings.cabinAltitudeFt)||
    !Number.isFinite(readings.differentialPsid))return null;
  physical=Object.freeze({
    cabinAltitudeFt:readings.cabinAltitudeFt,
    differentialPsid:readings.differentialPsid,
    cabinRateFtMin:Number.isFinite(readings.cabinRateFtMin)?readings.cabinRateFtMin:null,
    calibrationApproved:false,
    source:'CABIN_PRESSURE_PLANT_PROVISIONAL'
  });
  const pose=setPhotoCabinAltitude(physical.cabinAltitudeFt);
  const pressPose=setPhotoDifferentialPsi(physical.differentialPsid);
  if(physicalOutput)physicalOutput.textContent=
    'CAB ALT: '+physical.cabinAltitudeFt.toFixed(0)+' ft · DIFF PRESS: '+
    physical.differentialPsid.toFixed(2)+' psi'+
    '\nCAB ALT needle: '+(pose?.visualStatus||'PHOTO MAP NOT AVAILABLE')+
    (Number.isFinite(pose?.angleDeg)?' | '+pose.angleDeg.toFixed(2)+' deg':'')+
    '\nPRESS needle: '+(pressPose?.visualStatus||pressPose?.status||'PHOTO MAP NOT AVAILABLE')+
    (Number.isFinite(pressPose?.angleDeg)?' | '+pressPose.angleDeg.toFixed(2)+' deg':'')+
    '\n98 photographed tick strokes passed pixel QA; CAB ALT unlabeled values remain inferred.';
  return physical;
 }
 function mount(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');if(!host)return false;
  const piece=host.querySelector(`.atlas-piece[data-key="${model.source.piece}"]`);if(!piece)return false;
  if(host.querySelector('[data-cabin-dual-needles]'))return true;
  const layer=svg(doc,host,'svg',{'data-cabin-dual-needles':'OH19',viewBox:`0 0 ${model.source.width} ${model.source.height}`,preserveAspectRatio:'none',role:'img','aria-label':'Cabin pressure and cabin altitude independent needles'});
  Object.assign(layer.style,{position:'absolute',left:piece.style.left,top:piece.style.top,width:piece.style.width,height:piece.style.height,zIndex:'1002',pointerEvents:'none',overflow:'hidden'});
  // Append order is deliberate: the shorter CAB ALT needle stays below PRESS.
  for(const needle of model.needles){
   const assembly=svg(doc,layer,'g',{transform:`translate(${model.pivot.x} ${model.pivot.y}) scale(${needle.tipRadius/220}) translate(-256 -256)`});
   const blade=svg(doc,assembly,'g',{'data-cabin-needle':needle.id});
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
  const note=document.createElement('p');note.className='muted';note.textContent='دو عقربه مستقل با ۹۸ خط اندازه‌گیری‌شده روی عکس اصلی (CAB ALT: ۴۷، PRESS: ۵۱). مکان خط‌ها بررسی شده ولی مقادیر خطوط بی‌عدد CAB ALT هنوز برآوردی‌اند؛ خروجی غیرگواهی‌شده است.';section.append(note);
  physicalOutput=document.createElement('output');
  physicalOutput.style.display='block';physicalOutput.style.whiteSpace='pre-line';
  physicalOutput.style.direction='ltr';physicalOutput.style.textAlign='left';
  physicalOutput.textContent='CAB ALT: waiting for cabin physical state...';
  section.append(physicalOutput);
  if(physical)setMeasuredReadings(physical);
  for(const needle of model.needles){
   const label=document.createElement('label');label.textContent=needle.label;label.style.display='block';label.style.direction='ltr';
   const input=document.createElement('input');Object.assign(input,{type:'range',min:'-180',max:'360',step:'1'});input.style.width='100%';input.style.accentColor='#edf0e8';
   const output=document.createElement('output');output.style.display='block';output.style.textAlign='left';output.style.direction='ltr';
   input.addEventListener('input',()=>setAngle(needle.id,Number(input.value)));label.append(input,output);section.append(label);
   inputs.set(needle.id,input);outputs.set(needle.id,output);paint(needle.id);
  }
  const reset=document.createElement('button');reset.type='button';reset.textContent='بازگشت به تصویر مرجع';reset.addEventListener('click',()=>{for(const needle of model.needles)setAngle(needle.id,needle.initialAngle);});section.append(reset);
  const previous=document.querySelector('#unifiedApuEgtNeedle');if(previous)previous.after(section);else document.querySelector('.overhead-tools').before(section);
 }
 window.B737UnifiedCabinNeedles=Object.freeze({
  getAngles:()=>({...state}),setAngle,setAngles,setMeasuredReadings,
  getMeasuredReadings:()=>physical,
  getPhotoPose:()=>photoPose,setPhotoCabinAltitude,setPhotoDifferentialPsi
 });
 window.addEventListener('b737:cabin-needle-angles',event=>{try{setAngles(event.detail);}catch(error){console.error(error);}});
 window.addEventListener('b737:pressurization-state',event=>{
  const reading=event.detail?.output?.physical;
  if(reading)setMeasuredReadings(reading);
 });
 window.addEventListener('b737:cockpit-mounted',connect);connect();if(document.querySelector('.inspector'))controls();
})();
