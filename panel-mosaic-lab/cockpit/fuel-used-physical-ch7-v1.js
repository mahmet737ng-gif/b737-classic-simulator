/* Chapter 7.10.6-7 (EIS) and 7.10.16-17 (Conventional) physical
 * FUEL USED controls: EIS recessed PUSH / RESET, Conventional spring-loaded
 * RESET-RATE-USED selector. Always use the existing backend's one ECU ledger.
 */
(function(win){'use strict';
 const doc=win.document,REG=win.B737EnginePhotoControlRegistrationV1;
 const VERSION='FUEL_USED_PHYSICAL_CH7_0002-RECESSED-DB-PHOTO';
 let root=null,eis=null,conv=null,lastMode=null,lastError=null,mounts=0;
 let showButton=null,resetButton=null,lastGeometry=null;
 const api=()=>win.B737UnifiedEngineIndicationsV2;
 function command(type,value){
  try{
   if(!api()?.command)throw Error('Engine indication backend unavailable');
   const result=api().command({type,...(value!==undefined?{value}:{})});
   if(result===null)throw Error('Engine indication ECU not ready');
   lastError=null;return true;
  }catch(error){lastError=String(error?.message||error);win.console.warn('FUEL USED physical control',error);return false;}
 }
 function makeButton(host,label,id,klass,fn){
  const b=doc.createElement('button');b.type='button';b.id=id;
  b.className=klass;b.title=label;b.setAttribute('aria-label',label);
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn();});
  host.appendChild(b);return b;
 }
 function install(){
  if(root)return;
  root=doc.createElement('div');root.className='fuel-used-physical-ch7';root.id='fuelUsedPhysicalCh7';
  root.setAttribute('aria-label','Fuel used controls Chapter 7.10');
  eis=doc.createElement('div');eis.className='fuel-used-eis';root.appendChild(eis);
  showButton=makeButton(eis,'EIS: push to display FUEL USED for ten seconds','fuelUsedEisShow',
   'fuel-recessed fuel-used-show',()=>command('FUEL_MODE','USED'));
  resetButton=makeButton(eis,'EIS: RESET FUEL USED','fuelUsedEisReset',
   'fuel-recessed fuel-used-reset',()=>command('RESET_FUEL_USED'));
  conv=doc.createElement('div');conv.className='fuel-used-conventional';root.appendChild(conv);
  const control=makeButton(conv,'Conventional fuel flow switch, spring return RATE',
   'fuelUsedConventionalSelector','fuel-flow-selector',()=>{});
  const label=doc.createElement('span');label.className='fuel-flow-indicator';
  label.textContent='RATE';conv.appendChild(label);
  let held=null;
  function release(){
   if(held===null)return;
   held=null;label.textContent='RATE';control.dataset.position='RATE';
   command('FUEL_MODE','RATE');
  }
  control.addEventListener('pointerdown',e=>{
   if(e.button!==0&&e.pointerType==='mouse')return;
   e.preventDefault();e.stopPropagation();
   control.setPointerCapture?.(e.pointerId);
   // Upper part of source circle = RESET, lower part = USED.
   const box=control.getBoundingClientRect();
   held=e.clientY<box.top+box.height/2?'RESET':'USED';
   control.dataset.position=held;label.textContent=held;
   if(held==='RESET'){
    command('FUEL_MODE','USED');
    command('RESET_FUEL_USED');
   }else command('FUEL_MODE','USED');
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(event,release);
  control.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown',' '].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   if(e.key==='ArrowUp'){held='RESET';label.textContent='RESET';command('RESET_FUEL_USED');}
   else{held='USED';label.textContent='USED';command('FUEL_MODE','USED');}
  });
  control.addEventListener('keyup',e=>{if(['ArrowUp','ArrowDown',' '].includes(e.key))release();});
  win.addEventListener('blur',release);
 }
 function mount(){
  const native=doc.querySelector('#region-main .region-native');
  const piece=native?.querySelector('.texture-piece[data-piece="engine"]');
  if(!native||!piece)return false;
  install();
  if(root.parentNode!==native)native.appendChild(root);
  const mode=doc.documentElement.dataset.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
  const geo=win.B737EngineIndicationModeV1?.layout?.();
  const rect=mode==='CONVENTIONAL'&&geo?.w>0?geo:
   {x:parseFloat(piece.style.left),y:parseFloat(piece.style.top),
    w:parseFloat(piece.style.width),h:parseFloat(piece.style.height)};
  if(!Object.values(rect).every(Number.isFinite))return false;
  Object.assign(root.style,{left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px'});
  root.dataset.mode=mode;
  if(mode==='EIS'){
   // Existing buttons, not decorative replacements. Fit the approved
   // recessed-button database asset into each unique EIS photo aperture.
   if(!REG?.apply){lastError='Engine photo registration unavailable';return false;}
   const show=REG.apply(showButton,'FUEL_USED_PUSH',rect);
   const reset=REG.apply(resetButton,'RESET_FUEL_USED',rect);
   for(const [button,geo] of [[showButton,show],[resetButton,reset]]){
    button.style.backgroundImage='url("'+geo.asset+'")';
    button.dataset.assetSource='B737EnginePhotoControlRegistrationV1';
   }
   lastGeometry={show,reset};
  }else lastGeometry=null;
  lastMode=mode;
  mounts++;
  return true;
 }
 for(const name of ['b737:cockpit-mounted','b737:engine-indication-view','b737:aircraft-profile-change'])
  win.addEventListener(name,mount);
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 win.B737FuelUsedPhysicalCh7V1=Object.freeze({version:VERSION,mount,getStatus:()=>({
  mode:lastMode,mounts,error:lastError,photoRegistration:lastGeometry,
  ledger:api()?.getState?.()?.snapshot?.fuelUsedKg||null})});
})(window);
