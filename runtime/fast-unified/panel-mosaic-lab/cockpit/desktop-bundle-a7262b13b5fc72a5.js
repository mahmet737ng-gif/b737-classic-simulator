(async()=>{
;
/* ./eis-dot-readouts-v1.js?v=CONV-N2-POWER-BLANK-0001-STARTUP-0002 */
try{
/* Live EIS numeric presentation. Reads the shared ECU; owns no engine plant. */
(function(){'use strict';
 const font=window.B737EISDotDigitsV1,model=window.B737ISNEngineGaugeModel;
 if(!font||!model)return;
 const ns='http://www.w3.org/2000/svg';
 const specs=Object.freeze(model.eisGauges.filter(g=>['n1','egt','n2','fuelFlow'].includes(g.signal)).map(g=>Object.freeze({
  id:g.id,engine:g.engine,signal:g.signal,cx:g.cx,cy:g.cy,
  decimals:g.signal==='fuelFlow'?2:['n1','n2'].includes(g.signal)?1:0,
  integerDigits:g.signal==='fuelFlow'?1:3,divisor:g.signal==='fuelFlow'?1000:1,
  unit:g.signal==='fuelFlow'?'t/h':g.signal==='egt'?'°C':'%',
  template:g.signal==='fuelFlow'?'0.00':g.signal==='egt'?'999':'100.0',
   drum:true,scale:['n1','egt'].includes(g.signal)?1.065:1
 })).concat([1,2].map(n=>Object.freeze({id:'oilQuantity_'+n,engine:'engine'+n,signal:'oilQuantity',
  cx:n===1?984:1095,cy:741,decimals:0,integerDigits:3,divisor:1,unit:'%FULL',template:'999',drum:false,scale:.83}))));
 const values=new Map(specs.map(s=>[s.id,{value:['n1','n2'].includes(s.signal)?0:null,source:'INITIAL'}]));
 const mounted=new Map(),ecuOwned=new Set(),backendOwned=new Set(),startFallbacks=new Map();
  // Conventional numerical counters share instrument power with their pointer.
  // A null sensor reading may render fault dashes; a lost instrument bus must
  // instead remove ALL luminous glyphs, without hiding its dark photo aperture.
  const conventionalPowerLoss=new Set();
  function applyConventionalPowerGate(part){
   if(!part||part.variant!=='CONVENTIONAL')return;
   const lost=conventionalPowerLoss.has(part.spec.id);
   part.group.style.display=lost?'none':'';
   part.group.dataset.electricalPower=lost?'OFF':'ON_OR_UNKNOWN';
  }
  function setConventionalPowerLoss(engine,signal,lost){
   if(!['engine1','engine2'].includes(engine)||!['n1','egt','n2','fuelFlow'].includes(signal)
     ||typeof lost!=='boolean')throw Error('Invalid Conventional digital power gate');
   const id=signal+'_'+engine.slice(-1);
   if(conventionalPowerLoss.has(id)===lost)return false;
   if(lost)conventionalPowerLoss.add(id);else conventionalPowerLoss.delete(id);
   applyConventionalPowerGate(mounted.get('CONVENTIONAL.'+id));
   return true;
  }
 let layer=null,conventionalLayer=null,ticket=null,lastFrame=null,initialEisStamped=false;
 const raf=typeof requestAnimationFrame==='function'?requestAnimationFrame:null;
 const caf=typeof cancelAnimationFrame==='function'?cancelAnimationFrame:null;
 function element(parent,tag,attrs={}){const node=document.createElementNS(ns,tag);
  for(const [k,v]of Object.entries(attrs))node.setAttribute(k,String(v));parent.append(node);return node;}
 const glyphId=(ch,variant='EIS')=>(variant==='EIS'?'eis':'conv')+'-dot-glyph-'+(ch==='.'?'decimal':ch==='-'?'dash':ch);
 // Photo-native readout apertures (1463 × 1075), calibrated separately
 // from the independent needle pivots. These slots are ABOVE each dial label
 // and LEFT of the pointer tip, matching the owner's marked red rectangles.
 // ENGINE 1 / ENGINE 2 coordinates; EIS and oil quantity are not re-registered.
 // Owner-marked upper dial window: the same offset for every physical shaft,
 // at the gap between the 12 and 0 dial markers. No EIS coordinates change.
 // The accepted N1 window remains fixed. EGT/N2/FF windows use independent
 // upward registration because their legends sit lower than the N1 artwork.
 // All group transforms and their background rectangles use the same frame;
 // the extra upper-row offset prevents overlap with EGT / N2 / FF labels.
 // Pixel centres measured in the owner's original 1463x1075 instrument
 // photograph. The RED target window is aligned with each mechanical shaft
 // horizontally, 41–42 native pixels above it, between the 0 and 12 marks.
 // Do not alter N2's needle shape, axis, tick scale or motion.
 const CONVENTIONAL_APERTURES=Object.freeze({
  n1:Object.freeze([[427,385],[600,385]]),
  egt:Object.freeze([[427,555],[600,555]]),
  n2:Object.freeze([[425,706],[600,706]]),
  fuelFlow:Object.freeze([[426,869],[600,869]])
 });
 function conventionalSpecs(){
  const registered=window.B737ConventionalNeedlesV1?.getSpecs?.();if(!registered)return [];
  return specs.filter(s=>s.signal!=='oilQuantity').map(s=>{
   const point=registered.find(g=>g.engine===s.engine&&g.signal===(s.signal==='oilQuantity'?'oilQty':s.signal));
   if(!point)throw Error('Conventional dial registration missing: '+s.id);
   // Fixed photo slots never inherit a needle's shaft translation.
   // Conventional oil quantity is analog-only; EIS electronic oil readout remains unchanged.
   const side=s.engine==='engine1'?0:1;
   const aperture=CONVENTIONAL_APERTURES[s.signal]?.[side];
   if(!aperture)throw Error('Missing calibrated Conventional aperture '+s.id);
   // EGT=1000 and FF=12000 must still fit their conventional numeric face.
   // EIS maintains its existing separately designed three-digit readout.
   const full=s.signal==='egt'?{integerDigits:4,template:'9999',scale:.61}:
    s.signal==='fuelFlow'?{integerDigits:2,template:'00.00',scale:.61}:{scale:.75};
   return {...s,cx:aperture[0],cy:aperture[1],...full};
  });
 }
 function createLayer(piece,layerSpecs,variant){
  const svg=element(piece,'svg',{class:variant==='EIS'?'eis-dot-readouts-v1':'conventional-dot-readouts-v1',
   viewBox:variant==='EIS'?'0 0 1235 1274':'0 0 1463 1075',
   [variant==='EIS'?'data-eis-dot-readouts':'data-conventional-dot-readouts']:font.VERSION,
   'aria-label':variant+' live dot matrix engine numbers'});
  const defs=element(svg,'defs');
  for(const [ch,glyph]of Object.entries(font.glyphs)){
   const g=element(defs,'g',{id:glyphId(ch,variant),fill:font.style.color,
    stroke:font.style.color,'stroke-width':'.25','stroke-opacity':'.36'});
   for(const p of glyph.points)element(g,'circle',{cx:p.x,cy:p.y,r:ch==='.'?.9:font.style.radius/font.style.pitch});
  }
  for(const spec of layerSpecs){
   const width=font.layout(spec.template).width,lastX=width-14;
   const pitch=font.style.pitch*spec.scale;
   const photoTransform=`translate(${spec.cx-width*pitch/2} ${spec.cy-10*pitch}) scale(${pitch})`;
   // A SEPARATE, unconditional backplate is painted before each digit group.
   // The older group-local plate was sometimes masked by the rotating-drum
   // clip, leaving N2 and EGT without the same dark face as N1.
   if(variant==='CONVENTIONAL'){
    // Full opaque aperture painted as an unmasked sibling under the glyphs.
    // Previously the face was only 22 units tall while the rotating number
    // window was 31 units tall. The leaked area showed dial lettering.
    element(svg,'rect',{'data-conventional-backplate':spec.id,
     transform:photoTransform,x:-3,y:-5,width:width+6,height:31,
     fill:'#343738','fill-opacity':'1','aria-hidden':'true'});
   }
   const group=element(svg,'g',{[variant==='EIS'?'data-eis-readout':'data-conventional-readout']:spec.id,role:'img'});
   // Conventional drum aperture: show more of the numbers above and below
   // the active right-hand digit, without altering the calibrated EIS window.
   // The owner's red box spans one numeral row. Keep the wider last-column
   // preview, but constrain its upper/lower neighbors to the real aperture.
   const drumWindow=variant==='CONVENTIONAL'?{x:lastX-5,y:-5,width:23,height:31}:
    {x:lastX-2,y:font.style.windowTop,width:16,height:font.style.windowHeight};
   if(variant==='CONVENTIONAL'){
    const outerId='conv-photo-aperture-'+spec.id;
    const apertureClip=element(defs,'clipPath',{id:outerId,clipPathUnits:'userSpaceOnUse'});
    element(apertureClip,'rect',{x:-3,y:-5,width:width+6,height:31});
    group.setAttribute('clip-path','url(#'+outerId+')');
    group.dataset.photoWindow='OWNER_RED_RECT_1920';
   }
   if(variant==='EIS')element(group,'rect',{'data-eis-display-face':'',x:-2,y:font.style.bodyTop,
    width:width+4,height:font.style.bodyHeight,fill:'#343738','fill-opacity':'.92','aria-hidden':'true'});
   const clipId=variant+'-last-digit-window-'+spec.id,bodyId=variant+'-body-window-'+spec.id;
   const bodyClip=element(defs,'clipPath',{id:bodyId,clipPathUnits:'userSpaceOnUse'});
   element(bodyClip,'rect',{x:-2,y:font.style.bodyTop,width:width+4,height:font.style.bodyHeight});
   if(spec.drum){
    element(group,'rect',{'data-eis-tall-window':'',x:drumWindow.x,y:drumWindow.y,
     width:drumWindow.width,height:drumWindow.height,fill:'#343738','fill-opacity':'.92','aria-hidden':'true'});
    const clip=element(defs,'clipPath',{id:clipId,clipPathUnits:'userSpaceOnUse'});
    element(clip,'rect',{x:drumWindow.x,y:drumWindow.y,width:drumWindow.width,height:drumWindow.height});
   }
   // Fixed windows clip independent vertical digit tapes. Glyph nodes are
   // allocated once; one shared RAF moves all active drums without timers.
   const template=font.layout(spec.template),digits=[...spec.template].filter(c=>c!=='.').length;
   let position=digits;
   const slots=template.cells.map((cell,index)=>{
    const tall=spec.drum&&index===template.cells.length-1;
    const clip=element(group,'g',{'data-eis-digit-cell':index,'clip-path':'url(#'+(tall?clipId:bodyId)+')'});
    const fixed=element(clip,'use',{x:cell.x,visibility:'hidden','aria-hidden':'true'});
    const tape=element(clip,'g',{'data-eis-digit-tape':'',visibility:'hidden','aria-hidden':'true'});
    const glyphs=[-2,-1,0,1,2].map(offset=>element(tape,'use',{
     x:cell.x,y:-offset*font.style.drumStride,'data-drum-glyph':offset,
     ...(tall&&Math.abs(offset)===1?{'data-eis-adjacent-digit':offset}:{})}));
    return {clip,fixed,tape,glyphs,x:cell.x,power:cell.character==='.'?null:--position,
     wheel:null,character:' ',base:null,offset:null};
   });
   group.dataset.displayUnit=spec.unit;
   group.setAttribute('transform',photoTransform);
   const part={spec,variant,group,slots,width,text:null,dirty:true};
    mounted.set(variant+'.'+spec.id,part);
    applyConventionalPowerGate(part);
  }
  return svg;
 }
 function removeLayer(variant,svg){
  if(svg)svg.remove();
  for(const [key,part]of mounted)if(part.variant===variant)mounted.delete(key);
 }
 function mount(){
  const piece=document.querySelector('#region-main .texture-piece[data-piece="engine"]');if(!piece)return false;
  if(layer?.parentNode!==piece){removeLayer('EIS',layer);layer=createLayer(piece,specs,'EIS');
   if(!initialEisStamped){initialEisStamped=true;window.performance?.mark?.('b737:eis-digits-mounted');}
  }
  const host=window.B737EngineIndicationModeV1?.wrap?.(),layout=window.B737EngineIndicationModeV1?.layout?.();
  if(host&&layout){
   if(conventionalLayer?.parentNode!==host){
    const registered=conventionalSpecs();
    if(registered.length){removeLayer('CONVENTIONAL',conventionalLayer);conventionalLayer=createLayer(host,registered,'CONVENTIONAL');}
   }
   if(conventionalLayer)Object.assign(conventionalLayer.style,{width:'1463px',height:'1075px',transform:layout.cssMatrix});
  }
  syncTargets();paint();schedule();return true;
 }
 function syncTargets(){if(!mounted.size)return;
  for(const part of mounted.values()){
   const spec=part.spec,reading=values.get(spec.id);
   const text=font.format(reading.value,spec);part.group.dataset.source=reading.source;
   if(part.text===text)continue;
   part.text=text;part.dirty=true;part.group.dataset.value=text;
   part.group.setAttribute('aria-label',spec.engine+' '+spec.signal+' '+text+' '+(part.group.dataset.displayUnit||spec.unit));
   const padded=text.padStart(spec.template.length,' ');
   const numeric=Number.isFinite(Number(text));
   const ticks=numeric?Math.round(Math.abs(Number(text))*10**spec.decimals):0;
   part.slots.forEach((slot,i)=>{
    const character=padded[i]||' ';slot.character=character;
    if(slot.power!==null&&numeric&&(character===' '||/^[0-9]$/.test(character))){
     const column=Math.floor(ticks/10**slot.power);
     if(!slot.wheel)slot.wheel=font.createWheel(column);else slot.wheel.setColumn(column);
     // The shared Conventional display animation already moves the value.
     // Snapping this wheel to its synchronized frame removes the old
     // second phase-lag; EIS retains its own drum movement.
     if(!raf||reading.snap===true||
      (part.variant==='CONVENTIONAL'&&reading.source==='ENGINE_INDICATION_SYNC_V1'))
      slot.wheel.snap(column);
     slot.fixed.setAttribute('visibility','hidden');
    }else{
     slot.wheel=null;slot.tape.setAttribute('visibility','hidden');
     slot.fixed.setAttribute('visibility',character===' '?'hidden':'visible');
     if(character!==' ')slot.fixed.setAttribute('href','#'+glyphId(character,part.variant));
    }
   });
  }
 }
 const isMoving=()=>[...mounted.values()].some(p=>p.slots.some(s=>s.wheel?.snapshot().moving));
 function paint(){if(!layer)return;
  for(const part of mounted.values()){
   const moving=part.slots.some(s=>s.wheel?.snapshot().moving);
   if(!part.dirty&&!moving&&part.group.dataset.motion==='REST')continue;
   let direction='REST';
   part.slots.forEach(slot=>{
    if(!slot.wheel)return;
    const state=slot.wheel.snapshot(),base=Math.floor(state.phase),fraction=state.phase-base;
    slot.tape.setAttribute('visibility',slot.character===' '&&!state.moving?'hidden':'visible');
    slot.clip.dataset.drumPhase=state.phase.toFixed(4);
    slot.clip.dataset.drumDirection=state.direction;
    if(state.moving)direction=state.direction;
    if(slot.base!==base){
     slot.base=base;
     slot.glyphs.forEach((node,i)=>node.setAttribute('href','#'+glyphId(String(((base+i-2)%10+10)%10),part.variant)));
    }
    const offset=(fraction*font.style.drumStride).toFixed(4);
    if(slot.offset!==offset){slot.offset=offset;slot.tape.setAttribute('transform','translate(0 '+offset+')');}
   });
   part.group.dataset.motion=direction;part.dirty=false;
  }
 }
 function schedule(){if(raf&&ticket===null&&isMoving())ticket=raf(frame);}
 function frame(now){
  ticket=null;const seconds=lastFrame===null?1/60:Math.min(.05,Math.max(0,(now-lastFrame)/1000));lastFrame=now;
  for(const part of mounted.values())for(const slot of part.slots)slot.wheel?.step(seconds);
  paint();if(isMoving())schedule();else lastFrame=null;
 }
 function refresh(){mount();syncTargets();paint();schedule();}
 function write(spec,value,source,snap=false){
  values.set(spec.id,{value:Number.isFinite(value)?value:null,source,snap});
 }
 function observeECU(live){
  // The installed FCOM/MRG/LAN feed/fault backend is authoritative after load.
  // Do not let raw ECU telemetry repower failed/CB-isolated readouts.
  if(window.B737UnifiedEngineIndicationsV2?.ownsPresentation?.())return;
  const paths={n1:'n1Percent',n2:'n2Percent',egt:'egtC',fuelFlow:'fuelFlowKgHr',oilQuantity:'oil.quantityPct'};
  for(const s of specs){
   if(backendOwned.has(s.id))continue;
   const engine=live?.engines?.[s.engine];if(!engine)continue;
   const value=paths[s.signal].split('.').reduce((o,k)=>o?.[k],engine);
   // Some ECU snapshots omit FF; the start observation supplies that channel.
   // An absent property is not an invalid sensor and must not erase it.
   if(value!==undefined){ecuOwned.add(s.id);write(s,value,'UNIFIED_ECU_OBSERVATION');}
   else{
    ecuOwned.delete(s.id);
    if(startFallbacks.has(s.id))write(s,startFallbacks.get(s.id),'ISN_START_SOURCE');
   }
  }
  refresh();
 }
 function observeStart(packet){
  if(window.B737UnifiedEngineIndicationsV2?.ownsPresentation?.())return;
  for(const s of specs){
   if(backendOwned.has(s.id))continue;
   const signal=packet?.engines?.[s.engine]?.[s.signal];
   if(signal&&Object.hasOwn(signal,'value')){
    startFallbacks.set(s.id,signal.value);
    // Do not retarget a moving drum to a legacy start estimate immediately
    // before its authoritative ECU value arrives in the same update cycle.
    if(!ecuOwned.has(s.id))write(s,signal.value,'ISN_START_SOURCE');
   }
  }
  refresh();
 }
 window.B737EISDotReadoutsV1=Object.freeze({
  getSpecs:(mode='EIS')=>(mode==='CONVENTIONAL'?conventionalSpecs():specs).map(s=>({...s})),
  getReadings:()=>Object.fromEntries([...values].map(([id,v])=>{
   const spec=specs.find(s=>s.id===id);return [id,{...v,text:font.format(v.value,spec),displayUnit:spec.unit}];
  })),
  getMotion:(mode='EIS')=>Object.fromEntries([...mounted.values()].filter(p=>p.variant===mode).map(p=>[p.spec.id,p.slots.map(s=>s.wheel?.snapshot()||null)])),
  getDisplayed:(mode='CONVENTIONAL')=>Object.fromEntries([...mounted.values()]
   .filter(p=>p.variant===mode).map(p=>[p.spec.id,{
    source:values.get(p.spec.id)?.source||null,raw:values.get(p.spec.id)?.value??null,
    text:p.group.dataset.value||null,phase:p.group.dataset.motion||'REST',
    numeric:font.format(values.get(p.spec.id)?.value,p.spec)
   }])),
  setBatchReadings(records,source='ENGINE_INDICATION_SYNC_V1'){
   if(!Array.isArray(records))throw Error('Numerical display batch required');
   for(const row of records){
    const spec=specs.find(s=>s.engine===row.engine&&s.signal===row.signal);
    if(!spec)throw Error('Unknown numerical engine field '+row.engine+'/'+row.signal);
    if(source==='ENGINE_INDICATION_SYNC_V1'||source==='ENGINE_INDICATION_BACKEND_V2'){
     backendOwned.add(spec.id);ecuOwned.add(spec.id);
    }
    write(spec,row.value,source);
   }
   // Eight gauges, ONE frame and ONE numeric render pass.
   if(records.length)refresh();
  },
  setConventionalPowerLoss,
   getConventionalPowerLoss:(engine,signal)=>conventionalPowerLoss.has(signal+'_'+engine.slice(-1)),
   setReading(engine,signal,value,source='EXPLICIT_TRAINER_OR_SOURCE',opts={}){
   const spec=specs.find(s=>s.engine===engine&&s.signal===signal);if(!spec)throw Error('Unknown EIS numeric field');
   if(source==='ENGINE_INDICATION_BACKEND_V2'||source==='ENGINE_INDICATION_SYNC_V1'){
    backendOwned.add(spec.id);ecuOwned.add(spec.id);
   }
   write(spec,value,source,opts.snap===true);refresh();
  },mount
 });
 window.addEventListener('b737:cockpit-mounted',mount);
 window.addEventListener('b737:engine-indication-view',mount);
 window.addEventListener('b737:unified-ecu-observation',e=>{
  const profiler=window.B737InteractionProfilerV1,started=profiler?performance.now():0;
  try{observeECU(e.detail);}
  finally{if(profiler)profiler.markWork('ECU listener EIS digits fallback',performance.now()-started);}
 });
 window.addEventListener('b737:isn-start-indications',e=>observeStart(e.detail));
 mount();
 const live=window.B737ISNCockpitV1?.getECUState?.();if(live)observeECU(live);
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./app.js?v=CKP-0014-AIRCON400-ZONE-LEDEV-STAGED-V1-ASP-OBS-CENTER-0005-FACE-PMC-GLASS-0004-PHOTO-INPUT-0001-UNIFIED-PINCH-0001-WHEEL-PAN-0001-CDU-24COL-0006-PREFLIGHT-0001-AIRAC-2611-0001-AIRAC-2611-0001-DUAL-CDU-CH11-ROUTE-PAGES-0001-PAN-STABLE-0004-MCP-DIGITS-0002-BOOT-VISUAL-0005-COMPOSITOR-ZOOM-CDU-SG-MOD-0001&amp;startup=0003&amp;trace=0001&amp;wheel=0002 */
try{
(function(){
 'use strict';
 const model=window.B737CockpitView,byId=id=>document.getElementById(id),vp=byId('viewport'),scene=byId('scene'),sizer=byId('sizer');
 let assembly,zoom=.2,focused='main',frame,drag=null,dragged=false,lightDefinitions=[],snapshot=null,ready=false,visualTest=false,visualOverheadCount=0;const loaded=new Set(),failed=new Set(),cduFrames=new Map(),cduStates=new Map();
 const cduSeats=window.B737UnifiedNoCduTest?[]:['CAPT','FO'];
 const fmcSession=window.B737CduSession.create();
  // The private CDU/SG reference state follows the actual shared RTE context;
  // staged origin/destination changes invalidate prior previews, never FMC active legs.
  fmcSession.subscribe?.(data=>{
   const value=key=>String(data.pending?.[key]??data.stagedRoute?.[key]??data.active?.[key]??'').toUpperCase();
   window.B737CduSgRouteV1?.setContext({origin:value('ORIGIN'),destination:value('DEST')});
  });
 window.B737UnifiedFmc=Object.freeze({snapshot:()=>fmcSession.snapshot(),subscribe:fn=>fmcSession.subscribe(fn),completeHold:event=>fmcSession.completeHold(event),attach(seat,source,peer){const c=cduFrames.get(seat);if(!c||c.child.contentWindow!==source)throw Error('Unknown CDU frame');return fmcSession.attach(seat,peer);}});
 const wheelController=window.B737WheelPanModelV1?.createController(vp);
 const panGuard=window.B737PanStabilityV1;
 let galleryMounted=false,viewRefreshTimer=0;
 let lastViewportWidth=vp.clientWidth,lastViewportHeight=vp.clientHeight;
 function scheduleViewRefresh(){
  if(viewRefreshTimer)return;
  viewRefreshTimer=setTimeout(()=>{
   viewRefreshTimer=0;
   window.B737ImageLoader?.refresh();
   window.dispatchEvent(new CustomEvent('b737:performance-view'));
  },80);
 }
 function mountGallery(){
  if(galleryMounted||!assembly)return;
  galleryMounted=true;
  const gallery=byId('gallery');
  for(const r of assembly.regions)for(const p of r.placements||[]){
   if(p.referenceOnly)continue;
   const a=assembly.assets[p.asset],b=document.createElement('button');
   b.append(image(a,p.label),document.createTextNode(p.label));
   b.onclick=()=>{byId('galleryDialog').close();focus(r.id);select(r,p);};
   gallery.append(b);
  }
 }
 const faultable=new Set(['sensor','fuel-pressure','hyd-pressure','flight-pressure','standby-pressure','yaw','drive-pressure','drive-temperature','equipment','window','probe','dc-fail','fault','apu','recorder','anti-ice','pneumatic','press-fault','valve','fuel-valve','ram-door']);
 let assetStatusPending=false;
 function assetStatus(){
  if(assetStatusPending||!assembly)return;
  assetStatusPending=true;
  requestAnimationFrame(()=>{
   assetStatusPending=false;
   byId('assetStatus').textContent='Visible Photos: '+loaded.size+' / '+Object.keys(assembly.assets).length+(failed.size?' · Load Failures: '+failed.size:'');
  });
 }
 function image(asset,alt){const img=document.createElement('img');window.B737ImageLoader.assign(img,asset.url);img.alt=alt;img.draggable=false;img.decoding='async';img.onload=()=>{loaded.add(asset.path);failed.delete(asset.path);assetStatus();};img.onerror=()=>{failed.add(asset.path);assetStatus();};return img;}
 function select(region,p){focused=region.id;const a=assembly.assets[p.asset];document.querySelectorAll('.texture-piece').forEach(n=>n.classList.toggle('selected',n.dataset.piece===p.id));byId('selectionTitle').textContent=p.label;byId('selectionDescription').textContent=p.referenceOnly?'Existing upper pedestal source reference':'Uploaded original photo · no source edits or cropping';byId('selectionSize').textContent=a.dimensions.join(' × ')+' px';byId('originalLink').href=a.url;byId('originalLink').hidden=false;}
 // The original early-Overhead prepaint wins. Only a failed early mount
 // uses this conservative recovery path, retaining every owner LEDEV port.
 function fallbackOverhead(layout){
  const region=document.createElement('section'),overheadFrame=document.createElement('iframe');
  overheadFrame.id='overheadFrame';
  overheadFrame.title='Interactive Overhead LGT-0003';
  overheadFrame.src=layout.embeddedUrl+'&photoInput=PHOTO-INPUT-0001&ledev=LEDEV-0006&lelogic=LEDEV-STAGED-V1&aspObs=ASP-OBS-CENTER-0005-FACE&pmc=PMC-GLASS-0004';
  region.append(overheadFrame);
  return region;
 }
 function docCduPreview(seat){
  return [...document.querySelectorAll('.cdu-visual-shell')].find(node=>node.dataset.seat===seat)||null;
 }
 function mount(){
  Object.assign(scene.style,{width:assembly.canvas.width+'px',height:assembly.canvas.height+'px'});
  for(const r of assembly.regions){
   // VISUAL FIRST: preserve the early photo DOM exactly. This is hydration,
   // not a second paint of the same 4K geometry. Owners can now attach their
   // live indicators independently of visual texture download.
   const prepaint=r.id!=='overhead'&&scene.querySelector('#region-'+r.id+'[data-visual-shell="preview"]');
   if(prepaint){
    for(const p of r.placements){
     const piece=[...prepaint.querySelectorAll('.texture-piece')].find(x=>x.dataset.piece===p.id);
     const img=piece?.querySelector('img'),asset=assembly.assets[p.asset];
     if(!img||img.dataset.perfSource!==asset.url)throw Error('VISUAL FIRST asset geometry mismatch: '+p.id);
     const onLoad=()=>{loaded.add(asset.path);failed.delete(asset.path);assetStatus();};
     img.addEventListener('load',onLoad);
     img.addEventListener('error',()=>{failed.add(asset.path);assetStatus();});
     if(img.complete&&img.naturalWidth>0)onLoad();
    }
    window.B737VisualFirstShellV1.adopted=true;
    prepaint.dataset.visualShell='hydrated';
    document.documentElement.dataset.unifiedVisualHydratedMs=String(Math.round(performance.now()));
    if(r.id==='main'){
     window.B737McpVisualV3?.mount?.();
     window.B737McpHardwareV1?.mount?.();
     window.B737McpIndependentDigitsV1?.refresh?.();
     window.B737EISNeedlesV1?.mount?.();
     window.B737EISDotReadoutsV1?.mount?.();
     window.B737McpOwner13V1?.mount?.();
     document.documentElement.dataset.unifiedMainVisualMountMs=String(Math.round(performance.now()));
     performance.mark('b737:main-visual-instruments-mounted');
    }
    continue;
   }
   const region=r.id==='overhead'?(window.B737PrepareOverhead?.(r)||fallbackOverhead(r)):document.createElement('section');region.id='region-'+r.id;region.className='region';region.dataset.region=r.id;region.setAttribute('aria-label',r.label);Object.assign(region.style,{left:r.x+'px',top:r.y+'px',width:r.w+'px',height:r.h+'px'});const label=document.createElement('span');label.className='region-label';label.textContent=r.label;region.append(label);
   if(r.id==='overhead'){
    frame=region.querySelector('iframe');
    region.style.visibility='';
   }else {const native=document.createElement('div');native.className='region-native';native.style.width=r.nativeWidth+'px';native.style.height=r.nativeHeight+'px';native.style.transform='scale('+(r.w/r.nativeWidth)+')';
    for(const p of r.placements){const piece=document.createElement('div');piece.className='texture-piece';piece.dataset.piece=p.id;piece.dataset.reference=String(!!p.referenceOnly);piece.setAttribute('aria-label',p.label);Object.assign(piece.style,{left:p.x+'px',top:p.y+'px',width:p.w+'px',height:p.h+'px'});const img=image(assembly.assets[p.asset],p.label);if(p.presentation==='contain')img.style.objectFit='contain';if(p.sourceWindow){const ratio=p.w/p.sourceWindow.w;img.style.position='absolute';img.style.width=(assembly.assets[p.asset].dimensions[0]*ratio)+'px';img.style.height=(assembly.assets[p.asset].dimensions[1]*ratio)+'px';img.style.left=(-p.sourceWindow.x*ratio)+'px';img.style.top=(-p.sourceWindow.y*ratio)+'px';}if(p.maskPolygon){const [sw,sh]=assembly.assets[p.asset].dimensions;img.style.clipPath='polygon('+p.maskPolygon.map(([x,y])=>(x/sw*100).toFixed(4)+'% '+(y/sh*100).toFixed(4)+'%').join(',')+')';}piece.append(img);native.append(piece);}region.append(native);
    const ref=image(assembly.assets[r.id==='main'?'assets/main-panel.webp':'assets/pedestal.webp'],r.label+' REFERENCE');ref.className='reference-image';region.append(ref);
   }if(!region.isConnected)scene.append(region);
   // First-paint lane: make the actual MCP controls and EIS needles/digits
   // visible as soon as their photograph host exists. These already-loaded
   // presenters use only their original geometry and inactive/cold-dark
   // readings; the single ECU and electrical owner connect later as before.
   if(r.id==='main'){
    window.B737McpVisualV3?.mount?.();
    window.B737McpHardwareV1?.mount?.();
    window.B737McpIndependentDigitsV1?.refresh?.();
    window.B737EISNeedlesV1?.mount?.();
    window.B737EISDotReadoutsV1?.mount?.();
    window.B737McpOwner13V1?.mount?.();
    const t=performance.now();
    document.documentElement.dataset.unifiedMainVisualMountMs=String(Math.round(t));
    performance.mark('b737:main-visual-instruments-mounted');
   }
  }
  model.validateInstruments(assembly);
  for(const item of assembly.embeddedInstruments||[]){const station=document.createElement('div');station.id=item.id;station.className='cdu-station';station.dataset.seat=item.seat;Object.assign(station.style,{left:item.x+'px',top:item.y+'px',width:item.w+'px',height:item.h+'px'});const label=document.createElement('span');label.className='cdu-seat-label';label.textContent=item.label;station.append(label);
   const preview=docCduPreview(item.seat);
   if(preview){
    preview.style.left='0px';preview.style.top='0px';
    station.dataset.visualShell='preview';
    station.append(preview);
   }
   if(!cduSeats.includes(item.seat)){
    preview?.remove();
    // The no-CDU performance diagnostic keeps both panel footprints inert.
    station.classList.add('ready','cdu-disabled');
    station.dataset.runtime='OFF';
    station.setAttribute('aria-label',item.label+' deactivated for performance testing');
    station.style.pointerEvents='none';
    const off=document.createElement('div');off.className='cdu-disabled-face';
    off.setAttribute('aria-hidden','true');off.textContent='CDU OFF';
    Object.assign(off.style,{position:'absolute',inset:'0',display:'grid',
      placeItems:'center',background:'#06090c',color:'#53606b',font:'600 12px system-ui',
      letterSpacing:'1px'});
    station.append(off);
    byId('region-'+item.regionId).querySelector('.region-native').append(station);
    continue;
   }
   const child=document.createElement('iframe');
   if(preview){
    child.style.visibility='hidden';
    child.addEventListener('load',()=>{
     preview.remove();child.style.visibility='';
     station.removeAttribute('data-visual-shell');
    },{once:true});
   }
   child.id='cduFrame'+item.seat;child.className='cdu-frame';child.title=item.label;child.src=item.embeddedUrl;const placement=model.instrumentPresentation(item);Object.assign(child.style,{width:item.nativeWidth+'px',height:item.nativeHeight+'px',left:placement.left+'px',top:placement.top+'px',transform:'scale('+placement.scaleX+','+placement.scaleY+')',transformOrigin:'0 0'});const frameWindow=document.createElement('div');frameWindow.className='cdu-frame-window';frameWindow.append(child);station.append(frameWindow);byId('region-'+item.regionId).querySelector('.region-native').append(station);cduFrames.set(item.seat,{child,item,station});}
 }
 // Keep expensive visual-only CSS invalidation and texture rescans out
 // of the 2-finger pinch loop. The authoritative scale/scroll transform and
 // geometry remain exact, including source-point anchoring.
 function commitZoomPresentation(){
  scene.style.setProperty('--zoom',String(zoom));
  byId('zoomValue').textContent=Math.round(zoom*100)+'%';
  lastViewportWidth=vp.clientWidth;lastViewportHeight=vp.clientHeight;
  scheduleViewRefresh();
 }
 function applyZoom(value,left=vp.scrollLeft,top=vp.scrollTop,x=vp.clientWidth/2,y=vp.clientHeight/2,gestureSource=null,inputTime){
  cancelWheelZoom();
  wheelController?.cancel();
  const profiler=window.B737InteractionProfilerV1,trace=window.B737BootTrace;
  const started=profiler||trace?performance.now():0;
  const next=model.clamp(value,.04,2);
  const after={x:Math.max(0,(vp.clientWidth-assembly.canvas.width*next)/2),
   y:Math.max(0,(vp.clientHeight-assembly.canvas.height*next)/2)};
  let z;
  if(gestureSource){
   // The source point was captured when both fingers touched the glass.
   // Unlike the former two-step implementation, the anchoring scroll
   // position is calculated ONCE and written ONCE per animation frame.
   z={zoom:next,
    left:Math.max(0,gestureSource.sourceX*next+after.x-x),
    top:Math.max(0,gestureSource.sourceY*next+after.y-y)};
  }else{
   const before={x:parseFloat(scene.style.left)||0,y:parseFloat(scene.style.top)||0};
   z=model.zoomAnchor(zoom,next,left,top,x,y,before,after);
  }
  const geometryEnd=trace?performance.now():undefined;
  zoom=z.zoom;
  window.B737ImageLoader.setCockpitZoom(zoom);
  scene.style.left=after.x+'px';scene.style.top=after.y+'px';
  scene.style.transform='scale('+zoom+')';
  sizer.style.width=Math.ceil(assembly.canvas.width*zoom)+'px';
  sizer.style.height=Math.ceil(assembly.canvas.height*zoom)+'px';
  vp.scrollLeft=z.left;vp.scrollTop=z.top;
  if(gestureSource){
   // The inherited --zoom style affects region labels and selection
   // outlines, not the actual gauges. Sync it when the pinch ends.
  }else commitZoomPresentation();
  trace?.zoom(gestureSource?.kind|| (gestureSource?'pinch-commit':'zoom-commit'),started,zoom,geometryEnd,inputTime);
  if(profiler)profiler.markWork(gestureSource?'ZOOM pinch geometry and scroll':'ZOOM single-step geometry and scroll',performance.now()-started);
 }
 let wheelZoom=null,wheelZoomFrame=0,wheelZoomSettle=0;
 function cancelWheelZoom(){
  if(!wheelZoom)return;
  cancelAnimationFrame(wheelZoomFrame);
  clearTimeout(wheelZoomSettle);
  wheelZoom=null;wheelZoomFrame=0;wheelZoomSettle=0;
  scene.style.transform='scale('+zoom+')';
  window.B737ImageLoader.setZoomPreview(false);
 }
 function finishWheelZoom(){
  if(!wheelZoom)return;
  const pending=wheelZoom;
  if(!pending.anchor)captureWheelAnchor(pending);
  applyZoom(pending.next,0,0,pending.anchor.x,pending.anchor.y,pending.anchor,pending.inputTime);
  commitZoomPresentation();
 }
 function captureWheelAnchor(pending){
  const v=vp.getBoundingClientRect(),r=pending.frame?.getBoundingClientRect();
  const x=(r?r.left:0)-v.left+pending.x*(r?r.width/pending.frame.clientWidth:1);
  const y=(r?r.top:0)-v.top+pending.y*(r?r.height/pending.frame.clientHeight:1);
  const left=vp.scrollLeft,top=vp.scrollTop;
  const offsetX=parseFloat(scene.style.left)||0,offsetY=parseFloat(scene.style.top)||0;
  pending.anchor={kind:'wheel-commit',x,y,left,top,offsetX,offsetY,
   sourceX:(left+x-offsetX)/zoom,sourceY:(top+y-offsetY)/zoom};
 }
 function previewWheelZoom(){
  wheelZoomFrame=0;
  const pending=wheelZoom;if(!pending)return;
  const trace=window.B737BootTrace,start=trace?performance.now():0;
  if(!pending.anchor)captureWheelAnchor(pending);
  const {x,y,left,top,offsetX,offsetY,sourceX,sourceY}=pending.anchor,scale=pending.next;
  const dx=x+left-offsetX-sourceX*scale,dy=y+top-offsetY-sourceY*scale;
  scene.style.transform='translate('+dx+'px,'+dy+'px) scale('+scale+')';
  trace?.zoom('wheel-preview',start,scale,undefined,pending.inputTime);
 }
 function queueWheelZoom(delta,x,y,inputTime,child=null){
  if(!assembly||!Number.isFinite(delta)||!delta||![x,y].every(Number.isFinite))return;
  const previous=wheelZoom?.next??zoom;
  const next=model.clamp(previous*(delta<0?1.12:1/1.12),.04,2);
  if(next===previous)return;
  if(!wheelZoom){
   wheelController?.cancel();
   wheelZoom={next,x,y,frame:child,inputTime,anchor:null};
   window.B737ImageLoader.setZoomPreview(true);
  }
  wheelZoom.next=next;
  if(!wheelZoomFrame){
   wheelZoom.inputTime=inputTime;
   wheelZoomFrame=requestAnimationFrame(previewWheelZoom);
  }
  clearTimeout(wheelZoomSettle);
  wheelZoomSettle=setTimeout(finishWheelZoom,125);
 }
 function frameInputTime(message){
  return Number.isFinite(message.inputAt)?message.inputAt-performance.timeOrigin:undefined;
 }
 // Responsive two-finger zoom adapter for the outer canvas. This touches only
 // viewport transforms, never protected cockpit artwork or switch geometry.
 window.B737UnifiedPinchAdapterV1=Object.freeze({
  begin(distance,x,y){
   if(!assembly||!Number.isFinite(distance)||distance<2)return null;
   finishWheelZoom();
   wheelController?.cancel();
   endParentDrag();
   if(drag?.source==='iframe')drag=null;
   const beforeX=parseFloat(scene.style.left)||0,beforeY=parseFloat(scene.style.top)||0;
   const left=vp.scrollLeft,top=vp.scrollTop;
   return {distance,zoom,left,top,x,y,
    offsetX:beforeX,offsetY:beforeY,
    sourceX:(left+x-beforeX)/zoom,
    sourceY:(top+y-beforeY)/zoom};
  },
  move(start,distance,x,y){
   if(!start||!assembly||![distance,x,y].every(Number.isFinite)||distance<2)return;
   const profiler=window.B737InteractionProfilerV1,trace=window.B737BootTrace;
   const started=profiler||trace?performance.now():0;
   const next=model.clamp(start.zoom*distance/start.distance,.04,2);
   // Compositor-only preview: freeze the scroll range, parent position and
   // texture level while the fingers move. One scene transform keeps the
   // exact aircraft source point under the moving gesture midpoint.
   // Layout, sizer, scroll and inherited --zoom commit exactly ONCE on end.
   const dx=x+start.left-start.offsetX-start.sourceX*next;
   const dy=y+start.top-start.offsetY-start.sourceY*next;
   scene.style.transform='translate('+dx+'px,'+dy+'px) scale('+next+')';
   start.latestZoom=next;start.latestX=x;start.latestY=y;
   trace?.zoom('pinch-preview',started,next);
   if(profiler)profiler.markWork('ZOOM compositor preview transform',performance.now()-started);
  },
  end(start){
   if(!assembly)return;
   if(start&&Number.isFinite(start.latestZoom)){
    // Commit the preview's exact zoom anchor in one geometry/scroll pass.
    // The former applyZoom path ran this work on EVERY touch frame.
    applyZoom(start.latestZoom,0,0,start.latestX,start.latestY,start);
   }
   commitZoomPresentation();
  }
 });
 function focus(id){wheelController?.cancel();focused=id;const r=model.target(assembly,id);if(!r)return;const scale=model.fit(r,vp.clientWidth,vp.clientHeight);applyZoom(scale,0,0,0,0);vp.scrollLeft=Math.max(0,(r.x+r.w/2)*zoom-vp.clientWidth/2);vp.scrollTop=Math.max(0,r.y*zoom-38);for(const b of document.querySelectorAll('[data-focus]'))b.classList.toggle('active',b.dataset.focus===id);const labels={all:'Full Cockpit',overhead:'Interactive Overhead',main:'Main Panel',pedestal:'Pedestal','cdu-captain':'Captain CDU','cdu-first-officer':'First Officer CDU','cdu-both':'Captain and First Officer CDUs'};byId('viewLabel').textContent=labels[id];byId('selectionTitle').textContent=r.label||'ALL COCKPIT';byId('selectionDescription').textContent=id.startsWith('cdu-')?'Approved 70-key CDU; independent display with shared FMC data':id==='overhead'?'110 interactive lamps and controls from approved artwork':id==='pedestal'?'Original Throttle Quadrant, Fire Panel and radios arranged independently without overlap':'Original source photos assembled with preserved aspect ratios';byId('selectionSize').textContent='';byId('originalLink').hidden=true;}
 function panWheel(payload){if(drag)return false;return wheelController?wheelController.pan(payload):window.B737WheelPanModelV1?.pan(vp,payload)===true;}
 function command(action,extra={}){if(ready)frame.contentWindow.postMessage({type:'b737:cockpit-command',action,...extra},location.origin);}
 // Environment sensor values are supplied by ISN or an external simulator adapter.
 // Only the selected PRECHECK source updates the OH20 temperature pointer.
 window.B737Aircon400Inputs=Object.freeze({
  temperature:(source,celsius)=>command('aircon400-temperature-reading',{source,celsius}),
  zoneFault:(zone,active)=>command('aircon400-zone-fault',{zone,active})
 });
 function setVisualTest(active){visualTest=!!active;document.documentElement.dataset.lampVisualTest=String(visualTest);const button=byId('visualLampTest');button.setAttribute('aria-pressed',String(visualTest));byId('reference').disabled=visualTest;button.textContent=visualTest?'End Lamp Test':'Illuminate All Lamps';byId('lampTest').textContent=button.textContent;byId('visualLampStatus').textContent=visualTest?(visualOverheadCount===112?'142-lamp visual test active':'Visual test active · overhead connecting'):'';if(visualTest){scene.classList.remove('reference-mode');byId('reference').setAttribute('aria-pressed','false');}command('visual-test',{active:visualTest});window.dispatchEvent(new CustomEvent('b737:visual-test',{detail:{active:visualTest}}));renderLights();}
 byId('visualLampTest').onclick=()=>{setVisualTest(!visualTest);};byId('lampTest').onclick=()=>{setVisualTest(!visualTest);};window.addEventListener('b737:visual-test-request',e=>{if(typeof e.detail?.active==='boolean'){setVisualTest(e.detail.active);}});
 function renderLights(){if(!snapshot)return;const id=byId('lampSelect').value;byId('lampValue').textContent=snapshot.frames[id]||'—';byId('lampFault').checked=snapshot.context.faults[id]===true;const c=lightDefinitions.find(c=>c.id===id);byId('lampFault').disabled=!c||!faultable.has(c.rule)||id==='dual-bleed';byId('lampStatus').textContent=(visualTest?'Visual test: 112 lamps on · normal system output: ':'')+Object.values(snapshot.lights).filter(Boolean).length+' / '+lightDefinitions.length+(visualTest?'':' on')+(snapshot.lampTest?' · LAMP TEST':'');}
 function receiveOverhead(e){if(e.origin!==location.origin||e.source!==frame?.contentWindow||e.data?.type!=='b737:cockpit-overhead')return;const d=e.data;
  if(d.kind==='ready'){ready=true;performance.mark('b737:overhead-controls-ready');lightDefinitions=d.lampDefinitions;byId('overheadStatus').textContent='Overhead: Connected · LGT-0003';for(const id of ['lampTest','lampSelect','resetScenario','resetControls'])byId(id).disabled=false;const root=byId('lampSelect');root.replaceChildren();for(const c of lightDefinitions){const o=document.createElement('option');o.value=o.textContent=c.id;root.append(o);}root.value='crossfeed-valve';if(visualTest)command('visual-test',{active:true});command('pressurization-background',{system:window.B737AircraftProfileStore?.get()?.pressurization||'DCPCS'});command('aircon-background',{family:window.B737AircraftProfileStore?.get()?.aircraftFamily||'B737-300-500'});}
  if(d.kind==='aircon400-temperature-reading'&&Number.isFinite(d.celsius)){window.B737UnifiedCabinTemperatureNeedle?.setTemperature(d.celsius);}
  if(d.kind==='visual-state'){visualOverheadCount=d.active?d.count:0;byId('visualLampStatus').textContent=visualTest?(visualOverheadCount===112?'142-lamp visual test active':'Visual test active · overhead connecting'):'';}
  if(d.kind==='state'){snapshot=d;renderLights();}
  if(d.kind==='controls-state')window.dispatchEvent(new CustomEvent('b737:efis-overhead-selectors',{detail:d.toggles}));
  if(d.kind==='control-event'&&d.event?.kind==='toggle'){
   const {id,next}=d.event;
   if(['efi-transfer','irs-transfer','vhf-nav'].includes(id))
    window.dispatchEvent(new CustomEvent('b737:efis-overhead-selectors',{detail:{[id]:next}}));
  }
  if(d.kind==='selected-light'){byId('lampSelect').value=d.id;renderLights();}
  if(d.kind==='wheel-pan'){panWheel(d);return;}
  if(d.kind==='pan-start'&&Number.isFinite(d.screenX)&&Number.isFinite(d.screenY)){
   finishWheelZoom();wheelController?.cancel();endParentDrag();
   drag={lastX:d.screenX,lastY:d.screenY,source:'iframe'};dragged=false;
  }
  if(d.kind==='pan-move'&&drag?.source==='iframe'&&Number.isFinite(d.screenX)&&Number.isFinite(d.screenY)){
   const step=panGuard?.step({x:drag.lastX,y:drag.lastY},
    {x:d.screenX,y:d.screenY},vp);
   drag.lastX=d.screenX;drag.lastY=d.screenY;
   if(step?.accepted)panGuard.boundedPan(vp,step.dx,step.dy);
  }
  if(d.kind==='pan-end'&&drag?.source==='iframe')drag=null;
  if(d.kind==='zoom'){queueWheelZoom(d.delta,d.clientX,d.clientY,frameInputTime(d),frame);return;}
 }
 window.addEventListener('message',receiveOverhead);
 function updateCduStatus(){byId('cduStatus').textContent=cduSeats.map(seat=>{const s=cduStates.get(seat);const font=s?.typography?(' · '+s.typography.version+' · '+(s.typography.correct?'✓':'⚠')+' '+(s.typography.nativePx||'?')+'px · 24A '+Math.round(s.typography.width24Px||0)+'px / 25A '+Math.round(s.typography.width25Px||0)+'px · '+s.typography.color):'';return (seat==='CAPT'?'Captain':'First Officer')+': '+(s?.error?'Load Error':s?.ready?(s.page||'Ready'):'Loading')+font;}).join(' · ')||'CDU OFF';}
 updateCduStatus();
 window.addEventListener('message',e=>{const d=e.data,c=d&&cduFrames.get(d.seat);if(e.origin!==location.origin||!c||e.source!==c.child.contentWindow||d.type!=='b737:unified-cdu')return;const previous=cduStates.get(d.seat)||{};
  if(d.kind==='ready'&&d.controls===70){if(d.seat==='FO')performance.mark('b737:fo-cdu-ready');cduStates.set(d.seat,{...previous,ready:true});c.station.classList.add('ready');byId(d.seat==='CAPT'?'resetCduCaptain':'resetCduFirstOfficer').disabled=false;byId('resetSharedFmc').disabled=false;}
  if(d.kind==='state'&&typeof d.page==='string')cduStates.set(d.seat,{...previous,page:d.page.slice(0,50)});
  if(d.kind==='error')cduStates.set(d.seat,{...previous,error:true});
  if(d.kind==='typography'&&d.version==='CDU-24COL-0006')cduStates.set(d.seat,{...previous,typography:{version:d.version,correct:d.correct===true,nativePx:d.actualFontPx,labelPx:d.labelPx,color:d.color,columns:d.columns,width24Px:d.width24Px,width25Px:d.width25Px,widthPx:d.widthPx}});
  if(d.kind==='wheel-pan'){panWheel(d);return;}
  if(d.kind==='zoom'){queueWheelZoom(d.delta,d.clientX,d.clientY,frameInputTime(d),c.child);return;}
  updateCduStatus();
 });
 for(const seat of cduSeats){
  const id=seat==='CAPT'?'resetCduCaptain':'resetCduFirstOfficer';
  byId(id).disabled=true;byId(id).onclick=()=>{const c=cduFrames.get(seat);if(c)c.child.contentWindow.postMessage({type:'b737:unified-cdu-command',seat,action:'reset'},location.origin);};}
 byId('resetSharedFmc').onclick=()=>{
  const c=[...cduFrames.values()].find(({item})=>cduStates.get(item.seat)?.ready);
  if(c)c.child.contentWindow.postMessage({type:'b737:unified-cdu-command',seat:c.item.seat,action:'reset-fmc'},location.origin);
 };
 for(const b of document.querySelectorAll('[data-focus]'))b.onclick=()=>focus(b.dataset.focus);
 byId('fit').onclick=()=>focus(focused);byId('zoomIn').onclick=()=>applyZoom(zoom*1.25);byId('zoomOut').onclick=()=>applyZoom(zoom/1.25);byId('native').onclick=()=>applyZoom(1);
 byId('panMode').onclick=e=>{const active=!scene.classList.contains('pan-mode');scene.classList.toggle('pan-mode',active);e.currentTarget.setAttribute('aria-pressed',String(active));};
 byId('reference').onclick=e=>{window.B737ImageLoader.refresh();const active=!scene.classList.contains('reference-mode');scene.classList.toggle('reference-mode',active);e.currentTarget.setAttribute('aria-pressed',String(active));};
 byId('galleryOpen').onclick=()=>{mountGallery();byId('galleryDialog').showModal();window.B737ImageLoader.refresh();};byId('galleryClose').onclick=()=>byId('galleryDialog').close();
 byId('inspectorToggle').onclick=e=>{const active=!document.body.classList.contains('side-open');document.body.classList.toggle('side-open',active);e.currentTarget.setAttribute('aria-expanded',String(active));};
 byId('lampSelect').onchange=renderLights;byId('lampFault').onchange=e=>command('fault',{id:byId('lampSelect').value,active:e.target.checked});byId('resetScenario').onclick=()=>command('reset-scenario');byId('resetControls').onclick=()=>command('reset-controls');
 vp.addEventListener('wheel',e=>{
  if(e.ctrlKey||e.metaKey){e.preventDefault();queueWheelZoom(e.deltaY,e.clientX,e.clientY,e.timeStamp);return;}
  finishWheelZoom();
  // Outer cockpit pans directly; embedded OH/CDU send same-origin wheel-pan messages.
  if(e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
  if(panWheel(e))e.preventDefault();
 },{passive:false});
 // Pan only on inert panel surfaces. Interactive instruments retain their click/drag inputs.
 const panControlSelector='button,input,select,textarea,a,iframe,[contenteditable="true"],[role="button"],[role="switch"],[role="slider"],[data-control],.cockpit-light,.mounted-light,.mounted-toggle,.mounted-rotary,.guard-node,.rg-detent-hit,.cdu-station';
 let panPaintFrame=0,pendingPointerPosition=null;
 function paintParentPan(){
  panPaintFrame=0;
  const point=pendingPointerPosition;
  pendingPointerPosition=null;
  if(drag?.source!=='parent'||!point)return;
  const step=panGuard?.step({x:drag.lastX,y:drag.lastY},point,vp);
  drag.lastX=point.x;drag.lastY=point.y;
  if(step?.accepted)panGuard.boundedPan(vp,step.dx,step.dy);
 }
 function endParentDrag(pointerId){
  if(drag?.source!=='parent')return;
  if(pointerId!==undefined&&pointerId!==drag.pointer)return;
  if(panPaintFrame)cancelAnimationFrame(panPaintFrame);
  paintParentPan();
  const id=drag.pointer;drag=null;
  vp.classList.remove('dragging');
  if(vp.hasPointerCapture?.(id))vp.releasePointerCapture(id);
  dragged=false;
 }
 vp.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='mouse'||e.button!==0||e.target.closest?.(panControlSelector))return;
  finishWheelZoom();wheelController?.cancel();endParentDrag();
  drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,
   source:'parent',pointer:e.pointerId,started:false};
  dragged=false;
 });
 vp.addEventListener('pointermove',e=>{
  if(drag?.source!=='parent'||drag.pointer!==e.pointerId)return;
  if(!(e.buttons&1)){endParentDrag(e.pointerId);return;}
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.started&&Math.hypot(dx,dy)>5){
   drag.started=true;dragged=true;vp.classList.add('dragging');
   if(!vp.hasPointerCapture(e.pointerId))vp.setPointerCapture(e.pointerId);
  }
  if(!drag.started)return;
  pendingPointerPosition={x:e.clientX,y:e.clientY};
  if(!panPaintFrame)panPaintFrame=requestAnimationFrame(paintParentPan);
  if(e.cancelable)e.preventDefault();
 });
 window.addEventListener('pointerup',e=>endParentDrag(e.pointerId));
 window.addEventListener('pointercancel',e=>endParentDrag(e.pointerId));
 vp.addEventListener('lostpointercapture',e=>endParentDrag(e.pointerId));
 window.addEventListener('blur',()=>endParentDrag());
 // UNIFIED-PINCH owns two-finger zoom and one-finger pan. Do not register
 // a second legacy touchmove/zoom listener: competing writers cause jumps.
 vp.addEventListener('touchstart',()=>wheelController?.cancel(),{passive:true});
 // A browser chrome / window resize must not snap back to the last focused panel.
 // Keep the existing scroll anchor while refreshing only the canvas centering.
 let resizeTimer;window.addEventListener('resize',()=>{
  clearTimeout(resizeTimer);
  resizeTimer=setTimeout(()=>{
   if(!assembly)return;
   endParentDrag();
   if(drag?.source==='iframe')drag=null;
   // Preserve the same source pixel under the viewport center. Using the
   // NEW width for both old/new anchors shifts the image on every resize.
   const oldWidth=lastViewportWidth||vp.clientWidth;
   const oldHeight=lastViewportHeight||vp.clientHeight;
   const left=vp.scrollLeft+(oldWidth-vp.clientWidth)/2;
   const top=vp.scrollTop+(oldHeight-vp.clientHeight)/2;
   applyZoom(zoom,left,top,vp.clientWidth/2,vp.clientHeight/2);
  },120);
 });
 async function start(){try{const trace=window.B737BootTrace,wait=trace?performance.now():0;const prefetched=window.B737UnifiedAssemblyPrefetch?await window.B737UnifiedAssemblyPrefetch:null;if(prefetched?.error)throw Error(prefetched.error);if(prefetched?.data)assembly=prefetched.data;else{const r=await fetch('./assembly.json',{cache:'no-store'});if(!r.ok)throw Error('Assembly unavailable');assembly=await r.json();}const parseEnd=trace?performance.now():0;
  trace?.phase('Await cockpit assembly',wait,parseEnd);
  model.validate(assembly);
  // Capture prepaint camera before DOM hydration: focus(main) during a pan
  // is not a valid navigation event and must not teleport the aircraft panel.
  const visualHandoff=panGuard?.handoff(
   window.B737VisualFirstShellV1?.snapshot?.(),assembly.canvas,vp);
  const mountStart=trace?performance.now():0;
  trace?.phase('Validate cockpit assembly',parseEnd,mountStart);
  mount();
  const mounted=trace?performance.now():0;
  trace?.phase('Mount cockpit panels',mountStart,mounted);
  window.dispatchEvent(new CustomEvent('b737:cockpit-mounted'));
  trace?.phase('Notify cockpit components',mounted);
  // Do not snap a user's early visual-only navigation back to Main when
  // the interactive cockpit finally attaches to the same photo DOM.
  if(visualHandoff){
   zoom=visualHandoff.zoom;focused=visualHandoff.focused;
   scene.style.left=visualHandoff.sceneLeft+'px';
   scene.style.top=visualHandoff.sceneTop+'px';
   scene.style.transform='scale('+zoom+')';
   sizer.style.width=Math.ceil(assembly.canvas.width*zoom)+'px';
   sizer.style.height=Math.ceil(assembly.canvas.height*zoom)+'px';
   vp.scrollLeft=visualHandoff.left;vp.scrollTop=visualHandoff.top;
   window.B737ImageLoader.setCockpitZoom(zoom);
   commitZoomPresentation();
  }else focus(window.B737VisualFirstShellV1?.focused||'main');
  const scales=Object.fromEntries(assembly.regions.map(r=>[r.id,model.fit(r,vp.clientWidth,vp.clientHeight)]));
  window.B737ImageLoader.primeCockpit(scales,zoom);
  const earlyReady=window.B737TakeOverheadReady();
  if(earlyReady)receiveOverhead(earlyReady);
  command('report');
  window.addEventListener('b737:unified-usable',()=>byId('loading').classList.add('hidden'),{once:true});
 }catch(e){byId('loading').textContent='Panel Connection Error: '+e.message;console.error(e);}}
 start();
})();

/* ASP-BARE-0001: visual overlay, separate from locked regions. */
(()=>{const s=document.createElement('script');s.src='./asp-bare-overlay-v1.js?v=ASP-BARE-0003-COLOR';s.defer=true;document.head.appendChild(s);})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./parking-brake-unified-v1.js?v=PARK-BRAKE-002-DUAL-ART-20261124 */
try{
/* PARK-BRAKE-001 — Boeing 737 Classic parking brake visual owner.
   Native Throttle Quadrant source image: 800px wide.
   Slot (green user mark): (127,925); lamp (red user mark): (207,892).
   Coordinates are in the original photo, NEVER viewport screen pixels.
   This isolated presenter is not an aircraft hydraulic brake simulator. */
(function(root,factory){
 'use strict';
 const api=factory(root);
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root)root.B737UnifiedParkingBrakeV1=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(win){
 'use strict';
 const VERSION='PARK-BRAKE-002-DUAL-OFF-ON-ART-SLOT-127-925';
 const SLOT=Object.freeze({x:127,y:925}),LAMP=Object.freeze({x:207,y:892});
 const OFF_ASSET='./assets/parking-brake-off-front-v1.svg';
 const ON_ASSET='./assets/parking-brake-on-top-left-v1.svg';
 let engaged=false,holder=null,lever=null,lamp=null,offImage=null,onImage=null;
 const listeners=new Set();
 function geometry(piece={}){
  const scale=(Number(piece.w)||606)/(Number(piece.sourceWidth)||800);
  const x=Number(piece.x)||0,y=Number(piece.y)||0;
  const slot={x:x+SLOT.x*scale,y:y+SLOT.y*scale};
  const light={x:x+LAMP.x*scale,y:y+LAMP.y*scale};
  const width=160*scale,height=width*189/140;
  // The hinge tip center in the cut-out orthographic asset is at (41,185).
  return {slot,light,width,height,hinge:{x:slot.x,y:slot.y},
   left:slot.x-width*41/140,top:slot.y-height*185/189,
   lampDiameter:36*scale,raise:14*scale,scale};
 }
 function snapshot(){return Object.freeze({version:VERSION,engaged,position:engaged?'ON':'OFF'});}
 function render(){
  if(!holder)return;
  holder.dataset.parkingBrake=engaged?'ON':'OFF';
  if(lever){
   // Two user-approved images share the same hinge (41,185) in a 140x189
   // canvas. No translation of the pivot on ON/OFF changes.
   lever.style.transform='none';
   if(offImage)offImage.style.opacity=engaged?'0':'1';
   if(onImage)onImage.style.opacity=engaged?'1':'0';
   lever.setAttribute('aria-pressed',String(engaged));
   lever.setAttribute('aria-label','Parking brake '+(engaged?'ON. Press to release':'OFF. Pull to engage'));
   lever.title=engaged?'Parking Brake ON — pull to release':'Parking Brake OFF — pull to engage';
  }
  if(lamp){
   lamp.dataset.parkingBrakeLight=engaged?'ON':'OFF';
   lamp.setAttribute('aria-label','Parking brake red lamp '+(engaged?'illuminated':'off'));
  }
 }
 let currentGeometry=null;
 function geometryForHolder(){return currentGeometry||geometry({x:272,y:0,w:606,sourceWidth:800});}
 function setEngaged(on,source='USER'){
  if(typeof on!=='boolean')throw new TypeError('Parking brake requires a boolean');
  if(engaged===on)return snapshot();
  engaged=on;render();
  const state=snapshot();
  for(const fn of listeners){try{fn(state);}catch(_e){}}
  if(win?.dispatchEvent&&typeof win.CustomEvent==='function'){
   win.dispatchEvent(new win.CustomEvent('b737:parking-brake-state',{
    detail:{...state,source}}));
  }
  return state;
 }
 function mount(){
  const doc=win?.document;
  if(!doc||holder?.isConnected)return !!holder?.isConnected;
  const photo=doc.querySelector('#region-pedestal .region-native .texture-piece[data-piece="throttle-quadrant"]');
  const native=photo?.parentElement;
  if(!photo||!native)return false;
  const q=geometry({x:photo.offsetLeft,y:photo.offsetTop,
   w:photo.offsetWidth||606,sourceWidth:800});
  currentGeometry=q;
  holder=doc.createElement('div');
  holder.id='b737ParkingBrakeOwner';
  holder.dataset.parkingBrake='OFF';
  holder.style.cssText='position:absolute;inset:0;pointer-events:none;z-index:40;';
  lamp=doc.createElement('span');
  lamp.id='b737ParkingBrakeRedLamp';
  lamp.setAttribute('role','img');
  const d=q.lampDiameter;
  Object.assign(lamp.style,{position:'absolute',left:(q.light.x-d/2)+'px',
   top:(q.light.y-d/2)+'px',width:d+'px',height:d+'px',borderRadius:'50%',
   background:'radial-gradient(circle at 34% 27%,#241b1c,#08090a 62%,#020202)',
   boxShadow:'inset 0 1px 3px #111,0 0 0 1px #2d3339',
   pointerEvents:'none',zIndex:'3'});
  lever=doc.createElement('button');
  lever.id='b737ParkingBrakeOffLever';
  lever.type='button';
  lever.setAttribute('aria-pressed','false');
  Object.assign(lever.style,{position:'absolute',left:q.left+'px',top:q.top+'px',
   width:q.width+'px',height:q.height+'px',padding:'0',margin:'0',border:'0',
   borderRadius:'0',background:'transparent',boxShadow:'none',overflow:'visible',
   lineHeight:'0',cursor:'pointer',pointerEvents:'auto',touchAction:'manipulation',
   zIndex:'5',transformOrigin:'29.3% 98%'});
  function makeLeverImage(src,role){
   const image=doc.createElement('img');
   image.src=src;image.alt='';image.draggable=false;
   image.dataset.parkingBrakeArt=role;
   Object.assign(image.style,{position:'absolute',inset:'0',width:'100%',height:'100%',
    display:'block',objectFit:'contain',pointerEvents:'none',userSelect:'none',
    opacity:role==='OFF'?'1':'0',transition:'opacity 160ms ease-out'});
   return image;
  }
  offImage=makeLeverImage(OFF_ASSET,'OFF');
  onImage=makeLeverImage(ON_ASSET,'ON');
  lever.append(offImage,onImage);
  lever.addEventListener('click',()=>setEngaged(!engaged,'COCKPIT_LEVER'));
  holder.append(lamp,lever);
  native.append(holder);
  // Red lens illuminates only in Parking Brake ON; unaffected by zoom.
  const style=doc.createElement('style');
  style.id='b737ParkingBrakeLampStyle';
  style.textContent=`
   #b737ParkingBrakeOwner[data-parking-brake="ON"] #b737ParkingBrakeRedLamp{
     background:radial-gradient(circle at 35% 24%,#ffb0a3 0%,#ff302d 24%,#ae090d 62%,#410005 91%) !important;
     box-shadow:inset 0 2px 3px #ffcdcb80,0 0 9px 2px #ff1c1c99,0 0 0 1px #8d2323 !important;
   }
   #b737ParkingBrakeOffLever:hover,#b737ParkingBrakeOffLever:focus-visible{
     outline:1px dashed #d4e9ef;outline-offset:0;
   }`;
  if(!doc.getElementById('b737ParkingBrakeLampStyle'))doc.head.append(style);
  render();
  return true;
 }
 function subscribe(fn){if(typeof fn!=='function')throw new TypeError('SUBSCRIBER');listeners.add(fn);return()=>listeners.delete(fn);}
 const api=Object.freeze({VERSION,SLOT,LAMP,OFF_ASSET,ON_ASSET,geometry,getState:snapshot,setEngaged,
  toggle:()=>setEngaged(!engaged),mount,subscribe,getGeometry:()=>currentGeometry});
 if(win?.document){
  const ready=()=>{
   if(mount())return;
   const obs=new MutationObserver(()=>{if(mount())obs.disconnect();});
   obs.observe(win.document.documentElement,{childList:true,subtree:true});
   win.addEventListener('pagehide',()=>obs.disconnect(),{once:true});
  };
  if(win.document.readyState==='loading')win.document.addEventListener('DOMContentLoaded',ready,{once:true});else ready();
  win.addEventListener('b737:aircraft-general-state',event=>{
   const state=String(event?.detail?.state||event?.detail?.preset||'').toUpperCase().replace(/\s+/g,'_');
   if(state==='COLD_DARK'||state==='READY_FOR_START')setEngaged(true,'AIRCRAFT_GENERAL_STATE');
   else if(state==='READY_FOR_TAKEOFF')setEngaged(false,'AIRCRAFT_GENERAL_STATE');
  });
 }
 return api;
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
