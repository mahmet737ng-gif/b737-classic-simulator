/* Unified B737-400 OH20 controls. The photographed panel remains untouched.
 * This script is not loaded by the frozen standalone overhead mosaic.
 */
(function(){
 'use strict';
 const model=window.B737Aircon400Model,host=document.getElementById('atlasAbsolute');
 if(!model||!host)throw Error('B737-400 Air Conditioning overlay requires its model/atlas');
 model.validate();
 const PROFILE_KEY='b737classic.aircraft-profile.v1';
 const STORE_KEY='b737classic.aircon400-controls.v1';
 const asset=filename=>new URL('../assets/locked/2026-10-23/'+filename,document.baseURI).href;
 const rotarySrc=asset('Switches/Rotary/rotary-standard-v1.webp');
 const toggleSrc={
  OFF:asset('Switches/Toggle/b737-toggle-off.webp'),
  ON:asset('Switches/Toggle/b737-toggle-on.webp')
 };
 const lampSrc={
  OFF:asset('LIGHTS/black-yellow-v1/mounted/ZONE_TEMP_YELLOW_OFF.svg'),
  ON:asset('LIGHTS/black-yellow-v1/mounted/ZONE_TEMP_YELLOW_ON.svg')
 };
 let state,zoneFaults={'cont-cab':false,'fwd-cab':false,'aft-cab':false},test=false,family='B737-300-500',plate=null,layer=null;
 // Temperature values come from external simulated sensors, never from invented defaults.
 const measuredTemperatures=Object.create(null);
 function publishIndicatedTemperature(){
  const position=state[model.precheck.id];
  const celsius=measuredTemperatures[position];
  if(family!=='B737-400'||!Number.isFinite(celsius))return false;
  const detail={source:position,celsius};
  window.dispatchEvent(new CustomEvent('b737:aircon400-temperature',{detail}));
  if(parent!==window)parent.postMessage({type:'b737:cockpit-overhead',kind:'aircon400-temperature-reading',...detail},location.origin);
  return true;
 }
 function setTemperatureReading(position,celsius){
  if(!model.precheck.states.includes(position)||!Number.isFinite(celsius))return false;
  measuredTemperatures[position]=Math.max(0,Math.min(100,celsius));
  if(state[model.precheck.id]===position)publishIndicatedTemperature();
  return true;
 }
 const controls=new Map(),lamps=new Map();
 function saved(){
  try{return model.normalize(JSON.parse(localStorage.getItem(STORE_KEY)||'null'));}
  catch(_){return model.normalize(null);}
 }
 function save(){try{localStorage.setItem(STORE_KEY,JSON.stringify(state));}catch(_){}}
 function selectedFamily(){
  try {return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')?.aircraftFamily==='B737-400'?'B737-400':'B737-300-500';}
  catch(_){return 'B737-300-500';}
 }
 state=saved();
 function report(control,value,reason){
  const detail={id:control.id,value,reason,family:'B737-400',state:{...state}};
  window.dispatchEvent(new CustomEvent('b737:aircon400-control-change',{detail}));
  if(parent!==window)parent.postMessage({type:'b737:cockpit-overhead',kind:'aircon400-control',...detail},location.origin);
 }
 function setValue(id,value,reason='ui'){
  const c=model.controls.find(c=>c.id===id);
  if(!c||!c.states.includes(value))return false;
  if(state[id]===value)return true;
  state[id]=value;save();renderOne(c);
  if(c.mirror&&value!=='OFF'){
   const mirrorValue={'C':'MANUAL COOL','AUTO COOL':'AUTO COOL','AUTO':'AUTO NORM','AUTO WARM':'AUTO WARM','W':'MANUAL WARM'}[value];
   if(mirrorValue)window.B737RotaryGuards?.setAirconTemperature?.(c.mirror,mirrorValue);
  }
  report(c,value,reason);if(c.id===model.precheck.id)publishIndicatedTemperature();return true;
 }
 function addRotary(c){
  const b=document.createElement('button');b.type='button';b.className='aircon400-knob';b.dataset.airconControl=c.id;
  b.setAttribute('role','slider');b.setAttribute('aria-valuemin','0');b.setAttribute('aria-valuemax',String(c.states.length-1));
  b.title=c.label;
  const im=document.createElement('img');im.src=rotarySrc;im.alt='';im.draggable=false;b.append(im);
  let gesture=null,suppressClick=false;
  const index=()=>c.states.indexOf(state[c.id]);
  const step=(d,reason)=>setValue(c.id,model.step(c,state[c.id],d),reason);
  b.addEventListener('pointerdown',e=>{
   if(e.button!==0)return;e.stopPropagation();b.focus({preventScroll:true});
   b.setPointerCapture(e.pointerId);gesture={pointer:e.pointerId,x:e.clientX,y:e.clientY,from:index()};
  });
  b.addEventListener('pointerup',e=>{
   if(!gesture||gesture.pointer!==e.pointerId)return;
   e.stopPropagation();
   const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y,threshold=Math.max(9,b.getBoundingClientRect().width*.17);
   const distance=Math.max(Math.abs(dx),Math.abs(dy));
   if(distance>threshold){
    const sign=(Math.abs(dx)>=Math.abs(dy)?dx:-dy)>0?1:-1;
    const ticks=Math.min(3,Math.max(1,Math.round(distance/threshold)));
    setValue(c.id,c.states[Math.max(0,Math.min(c.states.length-1,gesture.from+sign*ticks))],'detent-drag');
    suppressClick=true;
   }else suppressClick=false;
   gesture=null;
  });
  b.addEventListener('pointercancel',()=>{gesture=null;suppressClick=true;});
  b.addEventListener('lostpointercapture',()=>{gesture=null;});
  b.addEventListener('click',e=>{e.stopPropagation();if(suppressClick){suppressClick=false;return;}step(1,'detent-tap');});
  b.addEventListener('wheel',e=>{e.preventDefault();e.stopPropagation();step(e.deltaY>0?1:-1,'detent-wheel');},{passive:false});
  b.addEventListener('keydown',e=>{
   if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   if(e.key==='Home')setValue(c.id,c.states[0],'keyboard');
   else if(e.key==='End')setValue(c.id,c.states.at(-1),'keyboard');
   else step(['ArrowLeft','ArrowDown'].includes(e.key)?-1:1,'keyboard');
  });
  layer.append(b);controls.set(c.id,b);
 }
 function addTrim(c){
  const b=document.createElement('button');b.type='button';b.className='aircon400-trim';b.dataset.airconControl=c.id;
  b.title=c.label+' · OFF / ON';b.setAttribute('role','switch');
  for(const value of c.states){const img=document.createElement('img');img.dataset.frame=value;img.src=toggleSrc[value];img.alt='';img.draggable=false;b.append(img);}
  b.addEventListener('pointerdown',e=>e.stopPropagation());
  b.addEventListener('click',e=>{e.stopPropagation();setValue(c.id,state[c.id]==='OFF'?'ON':'OFF','toggle-click');});
  b.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   setValue(c.id,['ArrowUp','Home'].includes(e.key)?'OFF':'ON','toggle-key');
  });
  layer.append(b);controls.set(c.id,b);
 }
 function addLamp(l){
  const button=document.createElement('button');button.type='button';button.className='aircon400-zone-lamp';button.dataset.airconLamp=l.id;
  button.title=l.label;button.setAttribute('aria-label',l.label);
  const off=document.createElement('img');off.src=lampSrc.OFF;off.dataset.frame='OFF';off.alt='';
  const on=document.createElement('img');on.src=lampSrc.ON;on.dataset.frame='ON';on.alt='';
  button.append(off,on);
  button.addEventListener('pointerdown',e=>e.stopPropagation());
  button.addEventListener('click',e=>e.stopPropagation());
  layer.append(button);lamps.set(l.zone,button);
 }
 function renderOne(c){
  const node=controls.get(c.id);if(!node)return;
  node.dataset.state=state[c.id];
  node.setAttribute('aria-label',c.label+' — '+state[c.id]);
  if(c.type==='rotary'){
   node.style.setProperty('--aircon-angle',model.angle(c,state[c.id])+'deg');
   node.setAttribute('aria-valuenow',String(c.states.indexOf(state[c.id])));
   node.setAttribute('aria-valuetext',state[c.id]);
  }else{
   node.setAttribute('aria-checked',String(state[c.id]==='ON'));
   for(const img of node.querySelectorAll('img'))img.classList.toggle('active',img.dataset.frame===state[c.id]);
  }
 }
 function paintLamps(){
  for(const l of model.lamps){
   const node=lamps.get(l.zone);if(!node)continue;
   const active=test||zoneFaults[l.zone]===true;
   node.dataset.state=active?'ON':'OFF';
   for(const im of node.querySelectorAll('img'))im.classList.toggle('active',im.dataset.frame===(active?'ON':'OFF'));
  }
 }
 function position(){
  const p=plate;if(!p||!layer)return;
  const placement={x:parseFloat(p.style.left),y:parseFloat(p.style.top),w:parseFloat(p.style.width),h:parseFloat(p.style.height)};
  for(const c of model.controls){
   const point=model.map([c.x,c.y],placement),node=controls.get(c.id);
   const width=(c.type==='toggle'?c.width:c.diameter)*placement.w/model.source.width;
   const height=(c.type==='toggle'?c.height:c.diameter)*placement.h/model.source.height;
   Object.assign(node.style,{left:point.x+'px',top:point.y+'px',width:width+'px',height:height+'px'});
  }
  for(const l of model.lamps){const node=lamps.get(l.zone),rect=model.rect(l.rect,placement);Object.assign(node.style,{left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px'});}
 }
 function syncVisibility(){
  if(!layer)return;
  const switches=document.getElementById('rotaryGuardLayer');
  const lights=document.getElementById('overheadLightLayer');
  for(const node of controls.values())node.style.visibility=switches?.classList.contains('hidden')?'hidden':'visible';
  for(const node of lamps.values())node.style.visibility=lights?.classList.contains('hidden')?'hidden':'visible';
 }
 function mount(){
  const next=host.querySelector('.atlas-piece[data-key="OH20"]');
  if(!next||!window.B737RotaryGuards||!window.B737OverheadLights)return false;
  if(layer?.isConnected&&plate===next)return true;
  plate=next;layer?.remove();layer=document.createElement('div');
  layer.id='aircon400Overlay';layer.className='aircon400-layer';
  model.controls.forEach(c=>c.type==='rotary'?addRotary(c):addTrim(c));
  model.lamps.forEach(addLamp);host.append(layer);
  position();model.controls.forEach(renderOne);paintLamps();syncVisibility();applyFamily(family);
  for(const id of ['toggleVisibility','lightVisibility'])document.getElementById(id)?.addEventListener('change',syncVisibility);
  return true;
 }
 function applyFamily(value){
  if(!['B737-400','B737-300-500'].includes(value))return;
  family=value;document.documentElement.classList.toggle('b737-aircon400',family==='B737-400');
  document.documentElement.classList.toggle('b737-aircon300500',family==='B737-300-500');
  if(layer)layer.hidden=family!=='B737-400';
  if(family==='B737-400')publishIndicatedTemperature();
 }
 function setZoneFault(zone,active){
  if(!Object.hasOwn(zoneFaults,zone)||typeof active!=='boolean')return false;
  zoneFaults[zone]=active;paintLamps();return true;
 }
 function setLampTest(active){test=!!active;paintLamps();}
 function boot(){
  applyFamily(selectedFamily());
  if(mount())return;
  const watch=new MutationObserver(()=>{if(mount())watch.disconnect();});
  watch.observe(host,{childList:true,subtree:true});
 }
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:cockpit-command')return;
  if(e.data.action==='aircon-background')applyFamily(e.data.family);
  if(e.data.action==='aircon400-zone-fault')setZoneFault(e.data.zone,e.data.active);
  if(e.data.action==='aircon400-temperature-reading')setTemperatureReading(e.data.source,e.data.celsius);
  if(e.data.action==='visual-test'||e.data.action==='lamp-test')setLampTest(e.data.active);
 });
 window.addEventListener('storage',e=>{if(e.key===PROFILE_KEY)applyFamily(selectedFamily());});
 window.addEventListener('b737:aircon400-zone-fault',e=>setZoneFault(e.detail?.zone,e.detail?.active));
 for(const id of ['toggleVisibility','lightVisibility']){
  const el=document.getElementById(id);el?.addEventListener('change',syncVisibility);
 }
 window.addEventListener('b737:aircon400-reset',()=>{state=model.normalize(null);save();model.controls.forEach(renderOne);});
 window.B737Aircon400=Object.freeze({
  getState:()=>({family,controls:{...state},zoneFaults:{...zoneFaults},lampTest:test}),
  setValue,setZoneFault,setLampTest,setTemperatureReading,
  switchFamily:applyFamily
 });
 boot();
})();
