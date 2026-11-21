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
 window.B737UnifiedFmc=Object.freeze({attach(seat,source,peer){const c=cduFrames.get(seat);if(!c||c.child.contentWindow!==source)throw Error('Unknown CDU frame');return fmcSession.attach(seat,peer);}});
 const wheelController=window.B737WheelPanModelV1?.createController(vp);
 const panGuard=window.B737PanStabilityV1;
 let galleryMounted=false,viewRefreshTimer=0;
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
 function endParentDrag(pointerId){
  if(drag?.source!=='parent')return;
  if(pointerId!==undefined&&pointerId!==drag.pointer)return;
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
  const step=panGuard?.step({x:drag.lastX,y:drag.lastY},
   {x:e.clientX,y:e.clientY},vp);
  drag.lastX=e.clientX;drag.lastY=e.clientY;
  if(step?.accepted)panGuard.boundedPan(vp,step.dx,step.dy);
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
   applyZoom(zoom,vp.scrollLeft,vp.scrollTop,vp.clientWidth/2,vp.clientHeight/2);
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
