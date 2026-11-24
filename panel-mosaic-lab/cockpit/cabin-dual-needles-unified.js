(function(){
 'use strict';
 const model=window.B737CabinDualNeedlesModel,Motion=window.B737CabinNeedleMotionV1?.Motion,ns='http://www.w3.org/2000/svg';
 if(!Motion)throw Error('Cabin needle motion engine missing');
 const sprites=Object.fromEntries(model.needles.map(needle=>[needle.id,new URL('./'+needle.asset+'?v=CDN-0004',document.baseURI).href]));
 const state=Object.fromEntries(model.needles.map(needle=>[needle.id,needle.initialAngle]));
 const blades=new Map(),inputs=new Map(),outputs=new Map();
 const motion=new Motion(state,{durationMs:960});
 const clock=()=>window.performance?.now?.()??Date.now();
 let frame=null,physical=null,physicalOutput=null,animationFrame=null;
 function animate(now){
  animationFrame=null;
  motion.advance(now);
  for(const id of Object.keys(state))paint(id);
  if(motion.moving(now))animationFrame=window.requestAnimationFrame(animate);
 }
 function schedule(){
  if(animationFrame===null&&motion.moving(clock()))animationFrame=window.requestAnimationFrame(animate);
 }
 function targetAngle(id,angle){motion.retarget(id,angle,clock());paint(id);schedule();}
 function svg(doc,parent,tag,attrs={}){const node=doc.createElementNS(ns,tag);for(const [key,value]of Object.entries(attrs))node.setAttribute(key,String(value));parent.append(node);return node;}
 function paint(id){
  const blade=blades.get(id);if(blade)blade.style.transform=`rotate(${motion.get(id)}deg)`;
  const input=inputs.get(id),output=outputs.get(id);if(input)input.value=String(state[id]);if(output)output.textContent=`${state[id]}°`;
 }
 function setAngle(id,value){
  state[id]=model.angle(id,value);motion.snap(id,state[id]);paint(id);return state[id];
 }
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
    state.cabAlt=model.angle('cabAlt',mapping.cabAltBearingDeg);targetAngle('cabAlt',state.cabAlt);
  }
  if(mapping.pressBearingDeg!==null){
    state.press=model.angle('press',mapping.pressBearingDeg);targetAngle('press',state.press);
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
  const existing=host.querySelector('[data-cabin-dual-needles]');
  if(existing){
   // Cockpit/Overhead may be re-mounted during a scenario. Reacquire the
   // existing two SVG needles instead of forgetting them or painting zero.
   const next=new Map(model.needles.map(n=>[n.id,existing.querySelector('[data-cabin-needle="'+n.id+'"]')]));
   if([...next.values()].every(Boolean)){
    blades.clear();for(const [id,blade] of next)blades.set(id,blade);
    motion.advance(clock());for(const id of Object.keys(state))paint(id);
    schedule();return true;
   }
   existing.remove(); // Incomplete layer must be rebuilt from retained angles.
  }
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
   // The animation clock owns interpolation. CSS transitions here restart on
   // repeated telemetry and cause CAB ALT / PRESS rollback-looking jumps.
   Object.assign(blade.style,{transformOrigin:'256px 256px',transition:'none'});
   svg(doc,blade,'image',{href:sprites[needle.id],x:0,y:0,width:512,height:512});blades.set(needle.id,blade);paint(needle.id);
  }
  return true;
 }
 function bind(){if(mount())return;const host=frame?.contentDocument?.getElementById('atlasAbsolute');if(!host)return;const observer=new MutationObserver(()=>{if(mount())observer.disconnect();});observer.observe(host,{childList:true});}
 function connect(){const next=document.getElementById('overheadFrame');if(!next||next===frame)return;frame=next;blades.clear();frame.addEventListener('load',()=>{blades.clear();bind();});bind();}
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
  getMeasuredReadings:()=>physical,
  getMotionDiagnostics:()=>({targets:{...state},visible:motion.advance(clock()),moving:motion.moving(clock()),installation:physical?.operatingInstallation??null})
 });
 window.addEventListener('b737:cabin-needle-angles',event=>{
  // QA slider/event defaults must never override the live pressure plant
  // during an airborne scenario (including Emergency Descent).
  if(window.B737UnifiedFlightScenarioV1?.getDiagnostics?.()?.active===true)return;
  try{setAngles(event.detail);}catch(error){console.error(error);}
 });
 window.addEventListener('b737:pressurization-state',event=>{
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
