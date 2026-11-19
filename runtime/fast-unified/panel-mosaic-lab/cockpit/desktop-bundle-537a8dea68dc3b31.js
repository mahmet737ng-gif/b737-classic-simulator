(async()=>{
;
/* ../cockpit/overhead-bridge.js?v=PRESS-OH22-DCPCS-WHITE-WHEEL-0001-PAN-RAF-0001 */
try{
(function(){
 'use strict';
 let liveElectricalPower=null;
 const send=detail=>{if(parent!==window)parent.postMessage({type:'b737:cockpit-overhead',...detail},location.origin);};
 let ready=false,pending=false,projection=null,windowHeatProjection=null,tatProbeProjection=null;
 // DCPCS-OWNER-OH22: runtime-only replacement of the OH22 plate background.
 // Scale owner artwork edge-to-edge to the locked OH22 tile so the former
 // contain letterboxing above/below the panel disappears. Original PNG untouched.
 // The locked OH22 source, physical atlas seams, lights and switch overlays stay untouched.
 const DCPCS_ARTWORK='../assets/locked/2026-10-23/DCPCS_Background_Owner.png';
 const PROFILE_KEY='b737classic.aircraft-profile.v1';
 // Only the Unified Cockpit replaces OH20 for the 737-400.
 // Approved 300/500 OH20 artwork and frozen overhead mosaic remain untouched.
 const AIRCON_400_ARTWORK='../assets/locked/2026-10-23/Boeing-Style Environmental Control Panel.png';
 let airframeFamily='B737-300-500',airconPlate=null,airconImage=null;
 function savedAirframe(){
   try{return JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')?.aircraftFamily==='B737-400'?'B737-400':'B737-300-500';}
   catch(_){return 'B737-300-500';}
 }
 let pressurizationSystem='DCPCS',ownerPlate=null,ownerImage=null;
 function savedPressurization(){
   try{
     const value=JSON.parse(localStorage.getItem(PROFILE_KEY)||'null')?.pressurization;
     return value==='CPCS'?'CPCS':'DCPCS';
   }catch(_){return 'DCPCS';}
 }
 function syncOwnerPlate(){
   // Headless ISN bridge fixtures deliberately have no full DOM querying API.
   if(typeof document.querySelector!=='function')return false;
   const plate=document.querySelector('#atlasAbsolute .atlas-piece[data-key="OH22"] .atlas-image-window');
   if(!plate)return false;
   if(!ownerPlate||!plate.contains(ownerPlate)){
     const layer=document.createElement('div');
     layer.className='dcpcs-owner-oh22-background';
     layer.dataset.asset='DCPCS_Background_Owner.png';
     Object.assign(layer.style,{position:'absolute',inset:'0',display:'none',zIndex:'2',pointerEvents:'none',background:'#141e27',overflow:'hidden'});
     const img=document.createElement('img');
     img.alt='DCPCS owner-approved overhead background';
     img.draggable=false;
     img.decoding='async';
     Object.assign(img.style,{display:'block',width:'100%',height:'100%',maxWidth:'none',maxHeight:'none',objectFit:'fill',objectPosition:'center',pointerEvents:'none'});
     img.addEventListener('load',()=>{layer.dataset.loaded='true';layer.style.display=pressurizationSystem==='DCPCS'?'block':'none';});
     img.addEventListener('error',()=>{layer.dataset.loaded='false';layer.style.display='none';send({kind:'pressurization-background-error',system:'DCPCS'});});
     // Don't fetch the 737-400/other background when CPCS is selected.
      if(pressurizationSystem==='DCPCS')img.src=new URL(DCPCS_ARTWORK,document.baseURI).href;
     layer.append(img);
     plate.append(layer);
     ownerPlate=layer;ownerImage=img;
   }
   if(pressurizationSystem==='DCPCS'&&ownerImage&&!ownerImage.getAttribute('src'))ownerImage.src=new URL(DCPCS_ARTWORK,document.baseURI).href;
    ownerPlate.style.display=pressurizationSystem==='DCPCS'&&ownerPlate.dataset.loaded==='true'?'block':'none';
   return true;
 }
 function syncAirconPlate(){
   if(typeof document.querySelector!=='function')return false;
   const plate=document.querySelector('#atlasAbsolute .atlas-piece[data-key="OH20"] .atlas-image-window');
   if(!plate)return false;
   if(!airconPlate||!plate.contains(airconPlate)){
     const layer=document.createElement('div');
     layer.className='b737-400-owner-oh20-background';
     layer.dataset.asset='Boeing-Style Environmental Control Panel.png';
     Object.assign(layer.style,{position:'absolute',inset:'0',display:'none',zIndex:'2',pointerEvents:'none',background:'#394858',overflow:'hidden'});
     const img=document.createElement('img');
     img.alt='B737-400 environmental and air conditioning panel';
     img.draggable=false;img.decoding='async';
     Object.assign(img.style,{display:'block',width:'100%',height:'100%',maxWidth:'none',maxHeight:'none',objectFit:'fill',objectPosition:'center',pointerEvents:'none'});
     img.addEventListener('load',()=>{layer.dataset.loaded='true';layer.style.display=airframeFamily==='B737-400'?'block':'none';});
     img.addEventListener('error',()=>{layer.dataset.loaded='false';layer.style.display='none';send({kind:'aircon-background-error',family:'B737-400'});});
     layer.append(img);plate.append(layer);
     airconPlate=layer;airconImage=img;
   }
   if(airframeFamily==='B737-400'&&!airconImage.getAttribute('src'))airconImage.src=new URL(AIRCON_400_ARTWORK,document.baseURI).href;
   airconPlate.style.display=airframeFamily==='B737-400'&&airconPlate.dataset.loaded==='true'?'block':'none';
   return true;
 }
 function setAirframeArtwork(family){
   if(!['B737-300-500','B737-400'].includes(family))return;
   airframeFamily=family;
   syncAirconPlate();
 }
 function setPressurizationArtwork(system){
   if(!['DCPCS','CPCS'].includes(system))return;
   pressurizationSystem=system;
   syncOwnerPlate();
   window.dispatchEvent(new CustomEvent('b737:pressure-configuration',{detail:{system}}));
 }
 pressurizationSystem=savedPressurization();
 airframeFamily=savedAirframe();
 const ownerPlateObserver=new MutationObserver(()=>{if(syncOwnerPlate()&&syncAirconPlate())ownerPlateObserver.disconnect();});
 ownerPlateObserver.observe(document.getElementById('atlasAbsolute'),{childList:true,subtree:true});
 syncOwnerPlate();
 syncAirconPlate();
 window.addEventListener('storage',e=>{if(e.key===PROFILE_KEY){setPressurizationArtwork(savedPressurization());setAirframeArtwork(savedAirframe());}});
 function applyProjection(){
  if(!ready||(!projection&&!windowHeatProjection&&!tatProbeProjection)||document.documentElement.classList.contains('cockpit-visual-test'))return;
  const base=window.B737OverheadLights.getState();
  if(base.lampTest)return;
  // ISN provides the general panel projections; WINDOW HEAT is the owner
  // of its eight real OH15 lamps and is layered AFTER ISN every time.
  const merged={...(projection||{}),...(windowHeatProjection||{}),...(tatProbeProjection||{})};
  const batteryMasterOn=String(window.B737OverheadToggles?.getState()?.['battery-master']||'').toUpperCase()==='ON';
  for(const node of document.querySelectorAll('.mounted-light')){
   // OH14 is owned solely by its three-position switch, never ISN AC/lamp projections.
   if(node.dataset.light==='emergency-not-armed')continue;
   if(!Object.prototype.hasOwnProperty.call(merged,node.dataset.light))continue;
   const v=merged[node.dataset.light],isWH=windowHeatProjection&&Object.prototype.hasOwnProperty.call(windowHeatProjection,node.dataset.light),isTAT=tatProbeProjection&&Object.prototype.hasOwnProperty.call(tatProbeProjection,node.dataset.light);
   const fuelValve=(node.dataset.light==='fuel-valve-closed-1'||node.dataset.light==='fuel-valve-closed-2')&&typeof v==='string';
   node.dataset.isnProjection=fuelValve?v:v===null?'UNKNOWN':v?'ON':'OFF';
   // WH projection already includes authoritative electrical/CB gating;
   // the legacy overhead preview's separate battery flag must not mask it.
   // LAN ATA 28-40: FUEL VALVE CLOSED annunciator supply requires BATTERY switch ON (relay R41).
   const frame=fuelValve?(liveElectricalPower===false||base.power===false||!batteryMasterOn?'OFF':
    base.context?.faults?.[node.dataset.light]===true?'BRIGHT_BLUE':v):
    liveElectricalPower===false?'OFF':isWH||isTAT?(v?'ON':'OFF'):base.power===false?'OFF':v===null?(base.frames[node.dataset.light]||'OFF'):v?'ON':'OFF';
   for(const face of node.querySelectorAll('.light-face'))face.classList.toggle('active',face.dataset.frame===frame);
   node.dataset.frame=frame;node.dataset.state=frame;
   node.setAttribute('aria-label',node.dataset.light+(v===null?' — UNKNOWN '+frame:isWH?' — WINDOW HEAT '+frame:isTAT?' — TAT PROBE '+frame:' — ISN '+frame));
   node.title=node.dataset.light+(isWH?' · WINDOW HEAT '+frame:isTAT?' · TAT PROBE '+frame:v===null?' · UNKNOWN':' · ISN '+frame);
  }
 }

 function visualTest(active){document.documentElement.classList.toggle('cockpit-visual-test',active);let count=0;for(const node of document.querySelectorAll('.mounted-light')){const faces=[...node.querySelectorAll('.light-face')],bright=faces.find(n=>n.dataset.frame==='BRIGHT_BLUE')||faces.find(n=>n.dataset.frame==='ON');for(const img of faces)img.dataset.visualOn=String(active&&img===bright);if(active&&bright){node.dataset.visualFrame=bright.dataset.frame;count++;}else delete node.dataset.visualFrame;}if(!active)applyProjection();
 // OH22 annunciators are separate from legacy .mounted-light nodes.
 // Keep light test purely visual: it must never latch a DCPCS or CPCS fault.
 if(typeof CustomEvent==='function'&&typeof window.dispatchEvent==='function')window.dispatchEvent(new CustomEvent('b737:pressure-light-test',{detail:{active,source:'visual-test'}}));
 send({kind:'visual-state',active,count});}
 function report(){if(!ready||pending)return;pending=true;requestAnimationFrame(()=>{pending=false;const s=window.B737OverheadLights.getState();send({kind:'state',lights:s.lights,frames:s.frames,context:s.context,lampTest:s.lampTest,power:s.power});send({kind:'controls-state',toggles:window.B737OverheadToggles.getState(),...window.B737RotaryGuards.getState(),context:s.context});applyProjection();});}
 function start(){if(ready||!window.B737OverheadLights||!window.B737RotaryGuards||!window.B737OverheadToggles)return;ready=true;send({kind:'ready',version:'LGT-0003',lampDefinitions:window.B737OverheadLights.getRegistry().lights.map(c=>({id:c.id,rule:c.rule,states:c.states||['OFF','ON']})),switches:58,rotaries:20,guards:11});report();}
 const observer=new MutationObserver(()=>{start();if(ready)observer.disconnect();});observer.observe(document.getElementById('atlasAbsolute'),{childList:true,subtree:true});start();
 for(const type of ['b737:switch-change','b737:rotary-change','b737:guarded-change'])window.addEventListener(type,e=>{send({kind:'control-event',event:{...e.detail,kind:type==='b737:switch-change'?'toggle':type==='b737:rotary-change'?'rotary':'guarded'}});report();});
 window.addEventListener('b737:overhead-light-state',()=>{applyProjection();report();});
 window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='b737:cockpit-command')return;const d=e.data;if(!ready)return;
  if(d.action==='live-electrical-supply'&&typeof d.power==='boolean'){
   if(liveElectricalPower!==d.power){liveElectricalPower=d.power;window.B737OverheadLights.setAircraftElectricalPower?.(d.power);}
   applyProjection();report();return;
  }
  if(d.action==='pressurization-background'&&['DCPCS','CPCS'].includes(d.system))setPressurizationArtwork(d.system);
  if(d.action==='aircon-background'&&['B737-300-500','B737-400'].includes(d.family))setAirframeArtwork(d.family);
  if(d.action==='aircon-fcom-projection'&&d.payload?.lamps){
   // Existing ECU/Pneumatics V6 is authoritative for 300/500 and 400.
   const payload=d.payload;
   window.B737OverheadLights.setAuthoritativePneumatics?.({lamps:payload.lamps});
   if(payload.family==='B737-400'&&payload.zones){
    for(const [zone,entry] of Object.entries({
     'cont-cab':payload.zones.CONT,'fwd-cab':payload.zones.FWD,'aft-cab':payload.zones.AFT
    }))if(entry&&typeof entry.immediate==='boolean')
     window.B737Aircon400?.setZoneFault?.(zone,entry.immediate);
   }
   report();return;
  }
  if(d.action==='visual-test'&&typeof d.active==='boolean')visualTest(d.active);
  if(d.action==='lamp-test'&&typeof d.active==='boolean')window.B737OverheadLights.setLampTest(d.active);
  if(d.action==='fault'&&typeof d.id==='string'&&typeof d.active==='boolean'){try{window.B737OverheadLights.setFault(d.id,d.active);}catch{}}
  if(d.action==='reset-scenario')window.B737OverheadLights.reset();
  if(d.action==='reset-controls')document.getElementById('resetToggles').click();
  if(d.action==='tat-probe-projection'&&d.lamps&&typeof d.lamps==='object'){
   // TAT owns only the existing TEMP PROBE annunciator. On receiving the
   // signal, relight it after LGT/ISN. No new lamp faces or source art.
   if(typeof d.lamps['probe-temp']==='boolean'){
    tatProbeProjection={'probe-temp':d.lamps['probe-temp']};
    applyProjection();
   }
   return;
  }
  if(d.action==='window-heat-projection'&&d.lamps&&typeof d.lamps==='object'){
   // Accept only four ON and four OVERHEAT lamps, never arbitrary cockpit
   // nodes or locked artwork changes. This survives live rerenders by LGT/ISN.
   const allowed=new Set(['window-l-side-on','window-l-fwd-on','window-r-fwd-on','window-r-side-on',
    'window-l-side-overheat','window-l-fwd-overheat','window-r-fwd-overheat','window-r-side-overheat']);
   const next={};for(const [id,value] of Object.entries(d.lamps)){
    if(allowed.has(id)&&typeof value==='boolean')next[id]=value;
   }
   if(Object.keys(next).length===8){windowHeatProjection=next;applyProjection();}
   return;
  }
  if(d.action==='isn-projection'&&d.lamps&&typeof d.lamps==='object'){
   const ids=new Set(window.B737OverheadLights.getRegistry().lights.map(light=>light.id));
   projection={};for(const [id,v]of Object.entries(d.lamps))if(id!=='emergency-not-armed'&&ids.has(id)){
    const fuelValve=id==='fuel-valve-closed-1'||id==='fuel-valve-closed-2';
    if(v===null||typeof v==='boolean'||fuelValve&&['OFF','DIM_BLUE','BRIGHT_BLUE'].includes(v))projection[id]=v;
   }
   applyProjection();
  }
  if(d.action==='isn-starter-cutout'&&['engine-start-1','engine-start-2'].includes(d.id)){
   window.B737RotaryGuards?.setDetent?.(d.id,'OFF');
  }
  report();
 });
 document.addEventListener('click',e=>{const node=e.target.closest('[data-light]');if(node)send({kind:'selected-light',id:node.dataset.light});});
 const isControl=e=>e.target.closest('.mounted-toggle,.mounted-rotary,.rg-detent-hit,.guard-node,.mounted-light,.oh14-lever-hit,.oh14-top-hinge-lid,.oh14-emergency-exit-physical,.oh22-dcpcs-altitude-knob');
 let drag=null,pendingPan=null,panFrame=0;
 // Only inert-background pan messages are coalesced. Never throttle
 // physical switch, rotary, guard or annunciator interactions.
 function flushPan(){
  if(panFrame){cancelAnimationFrame(panFrame);panFrame=0;}
  if(drag!==null&&pendingPan)send({kind:'pan-move',...pendingPan});
  pendingPan=null;
 }
 document.addEventListener('pointerdown',e=>{
  if(e.button!==0||isControl(e))return;
  if(drag!==null)flushPan();
  drag=e.pointerId;
  send({kind:'pan-start',screenX:e.screenX,screenY:e.screenY});
 });
 document.addEventListener('pointermove',e=>{
  if(drag!==e.pointerId)return;
  pendingPan={screenX:e.screenX,screenY:e.screenY};
  if(!panFrame)panFrame=requestAnimationFrame(()=>{panFrame=0;flushPan();});
 });
 for(const type of ['pointerup','pointercancel'])document.addEventListener(type,e=>{
  if(drag!==null){
   if(type==='pointerup'&&e.pointerId===drag&&Number.isFinite(e.screenX)&&Number.isFinite(e.screenY))
    pendingPan={screenX:e.screenX,screenY:e.screenY};
   flushPan();
   send({kind:'pan-end'});
  }
  drag=null;
 });
 document.addEventListener('wheel',e=>{
  if(e.ctrlKey||e.metaKey){e.preventDefault();e.stopImmediatePropagation();send({kind:'zoom',delta:e.deltaY,clientX:e.clientX,clientY:e.clientY});return;}
  // OH iframe is overflow:clip. Route wheel to parent without modifying approved hardware.
  // Physical knobs/guarded levers retain their existing wheel-detent gestures.
  if(e.target.closest('.oh14-lever-hit,.oh14-top-hinge-lid,.mounted-toggle[data-control="emergency-exit-lights"],.mounted-rotary,.rg-detent-hit,.guard-node,.aircon400-knob,.oh22-dcpcs-altitude-knob,input,select,textarea,[contenteditable="true"]'))return;
  if(!Number.isFinite(e.deltaX)||!Number.isFinite(e.deltaY))return;
  e.preventDefault();e.stopImmediatePropagation();
  send({kind:'wheel-pan',deltaX:e.deltaX,deltaY:e.deltaY,deltaMode:e.deltaMode,shiftKey:e.shiftKey});
 },{capture:true,passive:false});
 window.addEventListener('blur',()=>{if(ready){window.B737OverheadLights.setLampTest(false);report();}});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&ready){window.B737OverheadLights.setLampTest(false);report();}});
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../cockpit/asp-controls-model-v1.js?v=ASP-CONTROLS-0001 */
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
/* ../cockpit/asp-socket-registration-v2.js?v=ASP-CENTER-0002-VIEWBOX-0005 */
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
/* ../cockpit/asp-observer-overhead-v3.js?v=ASP-OBS-IFRAME-0005-FACE-VIEWBOX-0005 */
try{
/* ASP-OBS-IFRAME-0003 — observer audio panel belongs to the REAL overhead
 * atlas OH-04 in the embedded viewport, NOT to the parent cockpit wrapper.
 * Existing locked OH source, owner photos, labels and guard switches untouched.
 * Reuses approved CAPT/FO sprites + common 20-socket center registration.
 */
(function(root){
 'use strict';
 // Explicitly use the shared controls renderer in OBS-only mode.
 root.B737ASPOnlyObserver=true;
 const source=Object.freeze({x:953,y:56,w:379,h:283,w0:1731,h0:909});
 const atlas=Object.freeze({x:3,y:3,w:2214,h:1019});
 const box=Object.freeze({
  x:atlas.x+source.x*atlas.w/source.w0,
  y:atlas.y+source.y*atlas.h/source.h0,
  w:source.w*atlas.w/source.w0,
  h:source.h*atlas.h/source.h0
 });
 let host=null,watch=null;
 function install(){
  const layer=document.getElementById('atlasAbsolute');
  if(!layer)return false;
  const existing=layer.querySelector('.asp-bare-mounted[data-seat="OBS"]');
  if(existing){host=existing;return true;}
  const el=document.createElement('div');
  el.className='asp-bare-mounted asp-observer-overhead-native';
  el.dataset.seat='OBS';el.dataset.region='aft-overhead';el.dataset.panel='OH-04';
  el.dataset.aspObserverMount='ASP-OBS-IFRAME-0003';
  Object.assign(el.style,{position:'absolute',left:box.x+'px',top:box.y+'px',
   width:box.w+'px',height:box.h+'px',zIndex:'400',
   boxSizing:'border-box',background:'#566e81',border:'0',borderRadius:'0',margin:'0',padding:'0',
   pointerEvents:'auto',overflow:'hidden',direction:'ltr',userSelect:'none'});
  const img=document.createElement('img');
  img.src='../cockpit/assets/asp-bare-aft-overhead-v3.svg?v=ASP-COLOR-0003';
  img.alt='Observer ASP bare face on OH-04';img.draggable=false;
  Object.assign(img.style,{position:'absolute',inset:'0',left:'0px',top:'0px',display:'block',width:'100%',height:'100%',maxWidth:'none',
   objectFit:'fill',border:'0',margin:'0',padding:'0',pointerEvents:'none'});
  el.append(img);layer.append(el);host=el;
  root.dispatchEvent(new CustomEvent('b737:asp-observer-mounted',{detail:{seat:'OBS',panel:'OH-04',nativeRect:{...box}}}));
  return true;
 }
 function boot(){
  install();
  // The atlas renderer calls #atlasAbsolute.replaceChildren() asynchronously.
  // Keep one lightweight observer on that atlas and restore OBS whenever an
  // atlas redraw replaces our additive panel. Disconnecting after the first
  // mount would cause precisely the owner-reported "OBS unchanged" failure.
  const atlasRoot=document.getElementById('atlasAbsolute');
  watch=new MutationObserver(()=>{
   if(!document.querySelector('#atlasAbsolute > .asp-bare-mounted[data-seat="OBS"]'))install();
  });
  if(atlasRoot)watch.observe(atlasRoot,{childList:true});
  else watch.observe(document.documentElement,{childList:true,subtree:true});
 }
 // Relay only physical OBS inputs. Backend remains authoritative in parent.
 root.addEventListener('b737:asp-control',event=>{
  const d=event.detail||{};
  if(d.seat!=='OBS'||parent===root)return;
  parent.postMessage({type:'b737:asp-obs-control',detail:{seat:'OBS',kind:d.kind,
   channel:d.channel,selected:d.selected,volume:d.volume,angle:d.angle}},root.location.origin);
 });
 function audit(){
  if(!host||!host.isConnected)return {mounted:false,count:0,pass:false};
  const face=host.querySelector(':scope > img');
  if(!face)return {mounted:true,count:0,pass:false,reason:'No physical OBS photo'};
  const panel=face.getBoundingClientRect(),controls=[...host.querySelectorAll('.asp-photo-control')];
  const checks=controls.map(b=>{
   const hit=b.getBoundingClientRect();
   const x=Number(b.dataset.cx),y=Number(b.dataset.cy);
   const frame=root.B737ASPSocketRegistrationV2?.viewport(panel.width,panel.height);
   const at=frame?.point(x,y)||{x:panel.width*x/1122,y:panel.height*y/888};
   const expectedX=panel.left+at.x,expectedY=panel.top+at.y;
   return {kind:b.dataset.kind,channel:b.dataset.channel,
    expected:[expectedX,expectedY],actual:[hit.left+hit.width/2,hit.top+hit.height/2],
    errorCssPx:Math.hypot(expectedX-hit.left-hit.width/2,expectedY-hit.top-hit.height/2)};
  });
  const parent=host.getBoundingClientRect();
  const imageOffsetPx=Math.hypot(panel.left-parent.left,panel.top-parent.top);
  const maxErrorCssPx=Math.max(0,...checks.map(x=>x.errorCssPx));
  return {mounted:true,photoAnchored:imageOffsetPx<.25,
   photoOffsetCssPx:imageOffsetPx,rect:{...box},count:controls.length,
   maxErrorCssPx,checks,
   registration:host.dataset.aspRegistration||null,
   imageNative:true,pass:controls.length===20&&imageOffsetPx<.25&&maxErrorCssPx<.25};
 }
 root.B737ASPObserverOverhead=Object.freeze({install,getBounds:()=>({...box}),audit});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});
 else boot();
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../cockpit/asp-controls-v1.js?v=ASP-INSTANT-RELEASE-0003 */
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
    const shape=await silhouette(image.currentSrc||image.src);
    if(shape.width!==image.naturalWidth||shape.height!==image.naturalHeight)throw Error('ASP source dimensions changed during registration');
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
    ASSETS[s.kind].forEach((name,i)=>{const img=document.createElement('img');img.src=assetRoot+'assets/asp-controls-v1/'+name;img.alt='';img.draggable=false;img.className='asp-control-image asp-image-'+(i?'on':'off');rotor.append(img);});
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
})();
