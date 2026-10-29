/* Unified 737-300/500, nonintrusive OH20 pair of independent single-needle indicators & backend adapter.
 * Source/atlas/Owner18/400 panels remain untouched.
 */
(function(){
 'use strict';
 const model=window.B737AirMixValve300500V1;
 if(!model){console.error('AIR-MIX-300500 model missing');return;}
 const SVG='http://www.w3.org/2000/svg',PROFILE='b737classic.aircraft-profile.v1',CB='b737classic.cb.v1';
 const sprite=new URL('./assets/air-mix-valve-300500-reference-needle-v2.svg?v=AIR-MIX-300500-REFERENCE-NEEDLE-0002',document.baseURI).href;
 const state={CONT:{cabinC:null,ductC:null,overheat:false,stuck:false,transmitterFailed:false,targetC:null},
  PASS:{cabinC:null,ductC:null,overheat:false,stuck:false,transmitterFailed:false,targetC:null}};
 let engine=model.create(),frame=null,layer=null,assemblies={},last=performance.now(),trainingPower=null;
 const $=id=>document.getElementById(id);
 function family(){return window.B737AircraftProfileStore?.get()?.aircraftFamily==='B737-400'?'B737-400':'B737-300-500';}
 function child(){try{return frame?.contentWindow;}catch{return null;}}
 function createSvg(doc,parent,tag,attrs={}){
  const el=doc.createElementNS(SVG,tag);for(const [name,value]of Object.entries(attrs))el.setAttribute(name,String(value));parent.append(el);return el;
 }
 // OH20 source photograph contains an upright white needle baked into EACH gauge.
 // Occlude only that narrow, unchanging photo pointer with a feathered face-tone
 // strip before mounting the owner-approved moving needle.  This is a separate
 // overlay; the immutable OH20 photo, its tick marks, and the atlas are untouched.
 function concealPhotoNeedle(doc,g,side){
  const key='airMixPhotoPointerV2'+side;
  const defs=createSvg(doc,g,'defs');
  const face=createSvg(doc,defs,'linearGradient',{id:key+'Face',x1:'0',y1:'-68',x2:'0',y2:'8',gradientUnits:'userSpaceOnUse'});
  for(const [offset,color] of [['0%','#272621'],['18%','#362f29'],['48%','#342d26'],['80%','#2d2823'],['100%','#272521']]){
   createSvg(doc,face,'stop',{offset,'stop-color':color});
  }
  // Two independent feather gradients keep the narrow concealer inside
  // the original photograph's color field, without a hard rectangular seam.
  const fade=createSvg(doc,defs,'linearGradient',{id:key+'Fade',x1:'-9',y1:'0',x2:'9',y2:'0',gradientUnits:'userSpaceOnUse'});
  for(const [offset,color] of [['0%','#000'],['18%','#fff'],['82%','#fff'],['100%','#000']]){
   createSvg(doc,fade,'stop',{offset,'stop-color':color});
  }
  const endFade=createSvg(doc,defs,'linearGradient',{id:key+'EndFade',x1:'0',y1:'-68',x2:'0',y2:'8',gradientUnits:'userSpaceOnUse'});
  for(const [offset,color] of [['0%','#000'],['8%','#fff'],['92%','#fff'],['100%','#000']]){
   createSvg(doc,endFade,'stop',{offset,'stop-color':color});
  }
  const mask=createSvg(doc,defs,'mask',{id:key+'Mask',x:'-9',y:'-68',width:'18',height:'76',maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse'});
  createSvg(doc,mask,'rect',{x:-9,y:-68,width:18,height:76,fill:'url(#'+key+'Fade)'});
  const endMask=createSvg(doc,defs,'mask',{id:key+'EndMask',x:'-9',y:'-68',width:'18',height:'76',maskUnits:'userSpaceOnUse',maskContentUnits:'userSpaceOnUse'});
  createSvg(doc,endMask,'rect',{x:-9,y:-68,width:18,height:76,fill:'url(#'+key+'EndFade)'});
  const group=createSvg(doc,g,'g',{mask:'url(#'+key+'EndMask)'});
  createSvg(doc,group,'rect',{'data-air-mix-concealed-photo-needle':side,x:-9,y:-68,width:18,height:76,
   fill:'url(#'+key+'Face)',mask:'url(#'+key+'Mask)', 'pointer-events':'none'});
 }
 function syncLayer(){
  const doc=frame?.contentDocument,host=doc?.getElementById('atlasAbsolute');
  const plate=host?.querySelector('.atlas-piece[data-key="OH20"]'),strip=plate?.querySelector('.atlas-source-strip');
  if(!plate||!strip)return false;
  if(!layer||!layer.isConnected){
   layer=createSvg(doc,host,'svg',{'data-air-mix-valve-300500':'true',viewBox:'0 0 1254 1254',preserveAspectRatio:'none',
    'aria-label':'737-300/500 air mix valve position needles'});
   Object.assign(layer.style,{position:'absolute',zIndex:'1007',pointerEvents:'none',overflow:'hidden'});
   assemblies={};
   for(const side of model.SIDES){
    const p=model.GAUGES[side],g=createSvg(doc,layer,'g',{'data-air-mix-side':side,transform:'translate('+p.x+' '+p.y+')'});
    concealPhotoNeedle(doc,g,side);
    const rotary=createSvg(doc,g,'g',{'data-air-mix-rotor':side});
    // Native SVG rotation around the actual gauge shaft; CSS transform-origin on <g> was not reliable.
    rotary.setAttribute('transform','rotate(0 0 0)');
    createSvg(doc,rotary,'image',{href:sprite,x:-128,y:-128,width:256,height:256});
    assemblies[side]=g;
   }
  }
  const n=v=>Number.parseFloat(v)||0;
  Object.assign(layer.style,{left:(n(plate.style.left)+n(strip.style.left))+'px',
   top:(n(plate.style.top)+n(strip.style.top))+'px',width:strip.style.width,height:strip.style.height,
   display:family()==='B737-300-500'?'block':'none'});
  return true;
 }
 function cbClosed(){
  try{
   const s=JSON.parse(localStorage.getItem(CB)||'null'),variant=window.B737AircraftProfileStore?.get()?.pressurization==='DCPCS'?'DCPCS':'CPCS';
   if(!s||!Array.isArray(s.breakers))return true; // no pulled CBs persisted
   return !s.breakers.some(b=>b.id==='P6-4|'+variant+'|D3'&&(b.pulled||b.tripped));
  }catch{return true;}
 }
 function bus(){
  try{return window.B737ISNCockpitV1?.getState()?.state?.electrical?.bus||null;}catch{return null;}
 }
 function bool(v){return typeof v==='boolean'?v:null;}
 function inputs(){
  const w=child(),rot=w?.B737RotaryGuards?.getState?.()?.rotaries||{},tog=w?.B737OverheadToggles?.getState?.()||{},b=bus();
  const ac=b?Boolean(b.transfer1===true||b.transfer2===true):null;
  const power=trainingPower===null?ac:trainingPower;
  // Bench override simulates BOTH 115V actuator and 28V indicator supply;
  // it bypasses PACK OFF only for training, never in the normal cockpit mode.
  const result={};
  for(const side of model.SIDES){
   const meta=model.GAUGES[side],selector=rot[meta.selector];
   result[side]={...state[side],
    cabinC:trainingPower===true&&state[side].cabinC===null?22:state[side].cabinC,
    benchSensor:trainingPower===true&&state[side].cabinC===null,
    selector:model.SELECTORS.includes(selector)?selector:'AUTO NORM',
    packMode:['OFF','AUTO','HIGH'].includes(tog[meta.pack])?tog[meta.pack]:null,
    actuatorPower:power,indicatorPower:trainingPower===true?true:bool(b?.dc2),
    indicatorCB:cbClosed(),benchBypassPack:trainingPower===true};
  }
  return result;
 }
 function render(x){
  if(!syncLayer())return;
  for(const side of model.SIDES){
   const g=assemblies[side],rotor=g?.querySelector('[data-air-mix-rotor]');if(!g||!rotor)continue;
   const value=model.indication(engine,x,side);
   // A mechanical pointer must not visually disappear just because supply is lost.
   // For unknown/unpowered indication hold the last visibly observed needle angle.
   g.style.visibility='visible';
   if(value.valid)rotor.setAttribute('transform','rotate('+value.angle.toFixed(3)+' 0 0)');
   g.setAttribute('data-selector',x[side].selector);
   g.setAttribute('data-pack-mode',x[side].packMode||'UNKNOWN');
   g.setAttribute('data-indication-valid',String(value.valid));
   g.setAttribute('data-air-mix-position',engine.positions[side].toFixed(5));
   g.setAttribute('data-air-mix-valid',String(value.valid));
   g.setAttribute('aria-label',side+' '+Math.round(engine.positions[side]*100)+' percent hot; '+value.reason);
  }
  const readout=$('airMix300500Readout');
  if(readout)readout.textContent=model.SIDES.map(side=>side+'  '+x[side].selector+'  / PACK '+(x[side].packMode||'UNKNOWN')+' / '+Math.round(engine.positions[side]*100)+'% HOT / '+engine.command[side]+' / '+engine.reason[side]+(x[side].benchSensor?' / BENCH 22°C':'')+' / '+model.indication(engine,x,side).reason).join('\n');
 }
 function tick(){
  const now=performance.now(),dt=Math.max(0,Math.min(1,(now-last)/1000));last=now;
  if(family()!=='B737-300-500'){if(layer)layer.style.display='none';return;}
  const x=inputs();engine=model.step(engine,x,dt);render(x);
  window.dispatchEvent(new CustomEvent('b737:air-mix-valve-300500-state',{detail:{positions:{...engine.positions},command:{...engine.command},reason:{...engine.reason},power:{CONT:x.CONT.indicatorPower,PASS:x.PASS.indicatorPower}}}));
 }
 function setInputs(side,data){
  if(!model.SIDES.includes(side)||!data||typeof data!=='object')throw Error('Invalid air mix input');
  const fields=['cabinC','ductC','overheat','stuck','transmitterFailed','targetC'];
  for(const k of fields)if(Object.prototype.hasOwnProperty.call(data,k)){
   const v=data[k];if(['cabinC','ductC','targetC'].includes(k)){if(v!==null&&!(typeof v==='number'&&Number.isFinite(v)))throw Error('Invalid '+k);}
   else if(typeof v!=='boolean')throw Error('Invalid '+k);
   state[side][k]=v;
  }
  tick();return getState();
 }
 function getState(){return {family:family(),engine:JSON.parse(JSON.stringify(engine)),inputs:inputs(),trainingPower};}
 function reset(){engine=model.create();for(const side of model.SIDES)Object.assign(state[side],{cabinC:null,ductC:null,overheat:false,stuck:false,transmitterFailed:false,targetC:null});trainingPower=null;tick();}
 function connect(){
  const next=$('overheadFrame');if(!next)return;
  if(next!==frame){frame=next;frame.addEventListener('load',()=>{layer=null;assemblies={};syncLayer();});}
  syncLayer();
 }
 function panel(){
  const anchor=$('inspector');if(!anchor||$('airMix300500Lab'))return;
  const section=document.createElement('section');section.id='airMix300500Lab';section.dir='ltr';
  const h=document.createElement('h2');h.textContent='AIR MIX VALVE · 300/500';section.append(h);
  const note=document.createElement('p');note.className='muted';note.textContent='Real selector positions drive independent COLD/HOT valves. PACK OFF drives COLD in normal mode. Training AC ON is a clearly marked bench override (115V actuator + 28V indicator, temporary PACK OFF bypass). The real P6-4/D3 CB still cuts indication. AUTO bench uses a labeled simulated 22°C cabin sensor until one is injected. Sensor and travel calibration are training-only.';section.append(note);
  for(const side of model.SIDES){
   const label=document.createElement('label');label.textContent=side+' CABIN SENSOR °C';label.style.display='block';
   const inp=document.createElement('input');Object.assign(inp,{type:'number',min:'-30',max:'70',step:'0.5',placeholder:'Unknown'});
   inp.style.width='85px';inp.addEventListener('change',()=>setInputs(side,{cabinC:inp.value===''?null:Number(inp.value)}));
   label.append(inp);section.append(label);
  }
  const label=document.createElement('label');label.textContent='Power / Bench mode';label.style.display='block';
  const select=document.createElement('select');
  for(const [v,name] of [['AUTO','Aircraft power + real PACK logic'],['ON','Bench TEST: 115V + 28V, permit selector with PACK OFF'],['OFF','Instructor actuator power OFF']]){
   const opt=document.createElement('option');opt.value=v;opt.textContent=name;select.append(opt);
  }
  select.addEventListener('change',()=>{trainingPower=select.value==='AUTO'?null:select.value==='ON';tick();});label.append(select);section.append(label);
  const read=document.createElement('p');read.id='airMix300500Readout';read.style.fontSize='12px';read.style.lineHeight='1.7';read.style.whiteSpace='pre-line';read.style.overflowWrap='anywhere';section.append(read);
  const resetButton=document.createElement('button');resetButton.type='button';resetButton.textContent='Reset air-mix training state';
  resetButton.onclick=()=>{reset();select.value='AUTO';for(const input of section.querySelectorAll('input'))input.value='';};
  section.append(resetButton);anchor.append(section);
 }
 window.B737AirMix300500UnifiedV1=Object.freeze({getState,setInputs,reset,
  setTrainingPower:v=>{if(v!==null&&typeof v!=='boolean')throw Error('Power must be boolean or null');trainingPower=v;tick();},
  resetOverheat:side=>model.resetOverheat(engine,side,inputs()),sync:()=>{connect();tick();}});
 window.addEventListener('b737:cockpit-mounted',connect);
 window.addEventListener('message',event=>{
  if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
  const d=event.data;
  if(d?.type==='b737:cockpit-overhead'&&d.kind==='control-event'&&
     ['control-cabin-temp','pass-cabin-temp','pack-l','pack-r'].includes(d.event?.id))tick();
 });
 window.addEventListener('b737:aircraft-profile-change',()=>{connect();tick();});
 window.addEventListener('storage',e=>{if(e.key===CB||e.key===PROFILE)tick();});
 window.addEventListener('b737:aircon300500-inputs',e=>{for(const [side,data] of Object.entries(e.detail||{}))if(model.SIDES.includes(side))setInputs(side,data);});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{connect();panel();},{once:true});else{connect();panel();}
 setInterval(tick,160);
})();
