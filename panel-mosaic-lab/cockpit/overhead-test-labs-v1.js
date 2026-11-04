/* OVERHEAD-TEST-LABS-0001
 * Additive, source-backed photo reference + isolated instructor fault catalogs
 * for every physical overhead region. No edits to frozen mosaic/guards/IRS.
 * Non-indicator scenarios are training records, NOT asserted to be coupled
 * to the aircraft ECU. The existing OH15 Window Heat/TAT real-kernel lab
 * remains the authoritative modeled exception and is launched here.
 */
(function(){
 'use strict';
 const G=window.B737OverheadLabGestureV1;
 if(!G)return;
 const TILE_BOUNDS={
  UPPER:{x:3,y:3,w:2214,h:1019},
  'OH23-25':{x:3,y:3006,w:2214,h:303}
 };
 const KINDS={
  actuator:['FAIL_TO_EXTEND','FAIL_TO_RETRACT','STUCK_MID_TRAVEL','SLOW_OPERATION','FEEDBACK_FAIL','POWER_LOSS'],
  controller:['CHANNEL_FAIL','OUTPUT_STUCK_OFF','OUTPUT_STUCK_ON','SENSOR_INPUT_LOSS','INTERMITTENT','POWER_LOSS'],
  power:['BUS_LOSS','OPEN_CIRCUIT','SHORT_CIRCUIT','CONTACTOR_STUCK','UNDERVOLTAGE','INTERMITTENT'],
  sensor:['OPEN_CIRCUIT','SHORT_CIRCUIT','DRIFT_HIGH','DRIFT_LOW','FROZEN_VALUE','INTERMITTENT'],
  comms:['TX_FAIL','RX_FAIL','MIC_PATH_FAIL','AUDIO_PATH_OPEN','POWER_LOSS','INTERMITTENT'],
  light:['BULB_OPEN','STUCK_ON','LOW_INTENSITY','SUPPLY_LOSS','INTERMITTENT'],
  recorder:['RECORDER_FAIL','INPUT_LOSS','MEMORY_FAULT','POWER_LOSS','INTERMITTENT'],
  hydraulic:['LOW_PRESSURE','HIGH_TEMPERATURE','FLUID_LEAK','PUMP_FAIL','SENSOR_FAULT','POWER_LOSS'],
  pump:['PUMP_SEIZED','LOW_OUTPUT','OVERHEAT','POWER_LOSS','INTERMITTENT'],
  selector:['OPEN_CONTACT','STUCK_AT_DETENT','INCORRECT_FEEDBACK','CONTACT_SHORT','INTERMITTENT'],
  switch:['OPEN_CONTACT','STUCK_OFF','STUCK_ON','CONTACT_SHORT','INTERMITTENT'],
  valve:['STUCK_CLOSED','STUCK_OPEN','SLOW_TRANSIT','POSITION_DISAGREE','INTERNAL_LEAK','POWER_LOSS'],
  generator:['NO_OUTPUT','LOW_VOLTAGE','OVERFREQUENCY','BREAKER_TRIP','CONTROL_FAIL','INTERMITTENT'],
  meter:['NO_INDICATION','STUCK_POINTER','HIGH_BIAS','LOW_BIAS','POWER_LOSS'],
  heater:['ELEMENT_OPEN','ELEMENT_SHORT','CONTROLLER_FAIL','TEMP_SENSOR_FAIL','OVERHEAT','POWER_LOSS'],
  engine:['NO_START','HOT_START','HUNG_START','NO_IGNITION','NO_FUEL','STARTER_STUCK','CONTROL_FAIL'],
  indicator:['LAMP_OPEN','LAMP_STUCK_ON','DIM_LAMP','INTERMITTENT_LAMP']
 };
 const MODE_NOTES={
  LAMP_OPEN:'Lamp remains dark. Lab-only visual override; no real CB is touched.',
  LAMP_STUCK_ON:'Lamp remains illuminated. Lab-only visual override.',
  DIM_LAMP:'Illuminated face is reduced to a dim training cue.',
  INTERMITTENT_LAMP:'Intermittent indication (training annotation only).',
  POWER_LOSS:'The component loses its supply. An OVERHEAT annunciation must not be inferred merely from power loss.',
  BUS_LOSS:'Selected feed unavailable; downstream effects require an authoritative electrical mapping.',
  OVERHEAT:'Actual overtemperature fault, not an inferred symptom of loss of power.',
  STUCK_CLOSED:'Valve cannot open; downstream pressure/flow may be lost.',
  STUCK_OPEN:'Valve cannot close; pressure/flow may persist.',
  POSITION_DISAGREE:'Command and valve position feedback disagree.',
  LOW_PRESSURE:'Insufficient output pressure, subject to system supply and demand.',
  NO_START:'Starter sequence does not complete; ECU effects require engine-specific source logic.',
  HOT_START:'Abnormal EGT rise, not a real-engine calibration.',
  HUNG_START:'Insufficient spool acceleration in a training scenario.'
 };
 let catalog=null,panels=new Map(),regionGroups=new Map(),frameDoc=null;
 let dialog=null,labFrame=null,activePanel=null,activeFaults=new Map(),activePointers=new Set();
 let tracker=G.blank(),down=null,sourceReady=false;
 const $=id=>dialog?.querySelector('#'+id);
 const q=name=>document.getElementById(name);
 function modes(component){return KINDS[component.kind]||KINDS.controller;}
 function tileFor(key){const group=regionGroups.get(key)||[];return TILE_BOUNDS[key]||group[0]?.region;}
 function panelAt(doc,x,y,node){
  if(G.isInteractive(node))return null;
  let tile=node?.closest?.('#atlasAbsolute .atlas-piece[data-key]')||null;
  if(!tile&&typeof doc.elementFromPoint==='function'){
   const el=doc.elementFromPoint(x,y);
   if(G.isInteractive(el))return null;
   tile=el?.closest?.('#atlasAbsolute .atlas-piece[data-key]')||null;
  }
  // Layers such as non-clickable glass can be siblings of a tile.
  if(!tile){
   for(const candidate of doc.querySelectorAll?.('#atlasAbsolute .atlas-piece[data-key]')||[]){
    const r=candidate.getBoundingClientRect();
    if(x>=r.left&&x<=r.right&&y>=r.top&&y<=r.bottom){tile=candidate;break;}
   }
  }
  if(!tile)return null;
  const key=tile.dataset.key,group=regionGroups.get(key)||[];
  if(!group.length)return null;
  const r=tile.getBoundingClientRect();
  if(r.width<=0||r.height<=0||x<r.left||x>r.right||y<r.top||y>r.bottom)return null;
  if(group.length===1)return group[0].id;
  const b=tileFor(key);
  const atlasX=b.x+(x-r.left)/r.width*b.w;
  const atlasY=b.y+(y-r.top)/r.height*b.h;
  const chosen=group.find(p=>atlasX>=p.region.x&&atlasX<=p.region.x+p.region.w&&
   atlasY>=p.region.y&&atlasY<=p.region.y+p.region.h);
  return chosen?.id||null;
 }
 function validEvent(doc,e){
  if(e.pointerType==='mouse'&&e.button!==0||e.isPrimary===false)return null;
  const hit=typeof doc.elementFromPoint==='function'?doc.elementFromPoint(e.clientX,e.clientY):null;
  if(G.isInteractive(e.target)||G.isInteractive(hit))return null;
  return panelAt(doc,e.clientX,e.clientY,hit||e.target);
 }
 function bind(){
  const frame=q('overheadFrame');
  let doc;try{doc=frame?.contentDocument;}catch(_){return;}
  if(!doc||doc===frameDoc)return;
  frameDoc=doc;tracker=G.blank();down=null;activePointers=new Set();
  doc.addEventListener('pointerdown',e=>{
   if(e.pointerType==='touch')activePointers.add(e.pointerId);
   if(activePointers.size>1){down=null;tracker=G.blank();return;}
   const region=validEvent(doc,e);
   if(!region){down=null;tracker=G.blank();return;}
   down={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now(),region,valid:true};
  },true);
  doc.addEventListener('pointerup',e=>{
   if(e.pointerType==='touch')activePointers.delete(e.pointerId);
   const region=validEvent(doc,e);
   const up={id:e.pointerId,x:e.clientX,y:e.clientY,at:performance.now(),region,valid:!!region};
   if(activePointers.size>0||!G.shortStationary(down,up)){down=null;tracker=G.blank();return;}
   down=null;
   tracker=G.advance(tracker,{valid:true,region,x:up.x,y:up.y,at:up.at});
   if(tracker.fire){tracker=G.blank();open(region);}
  },true);
  doc.addEventListener('pointercancel',()=>{tracker=G.blank();down=null;activePointers.clear();},true);
  doc.addEventListener('wheel',()=>{tracker=G.blank();down=null;},true);
  doc.addEventListener('keydown',()=>{tracker=G.blank();down=null;},true);
 }
 function resetPanelState(){activeFaults=new Map();showFaults();}
 function component(){
  const item=panels.get(activePanel)?.components.find(c=>c.id===$('ohLabComponent')?.value);
  return item||null;
 }
 function populateMode(){
  const select=$('ohLabMode'),c=component();
  if(!select)return;
  select.replaceChildren();
  for(const mode of modes(c||{})){
   const op=document.createElement('option');op.value=mode;op.textContent=mode.replaceAll('_',' ');select.append(op);
  }
 }
 function populateComponents(){
  const select=$('ohLabComponent');if(!select)return;
  select.replaceChildren();
  for(const c of panels.get(activePanel)?.components||[]){
   const op=document.createElement('option');op.value=c.id;op.textContent=c.label+' · '+c.kind.toUpperCase();select.append(op);
  }
  populateMode();
 }
 function inject(){
  const c=component(),mode=$('ohLabMode')?.value;
  if(!c||!modes(c).includes(mode))return;
  activeFaults.set(c.id,{component:c,mode});
  showFaults();paintIndicators();
 }
 function clearSelected(){
  const c=component();if(!c)return;
  activeFaults.delete(c.id);showFaults();paintIndicators();
 }
 function faultInfo(f){
  return MODE_NOTES[f.mode]||f.component.label+': '+f.mode.replaceAll('_',' ').toLowerCase()+
   '. This is a bounded instructor scenario; aircraft-specific system propagation is not asserted.';
 }
 function showFaults(){
  const list=$('ohLabActive'),status=$('ohLabStatus');if(!list||!status)return;
  list.replaceChildren();
  for(const f of activeFaults.values()){
   const li=document.createElement('li');li.textContent=f.component.label+' — '+f.mode.replaceAll('_',' ')+' · '+faultInfo(f);
   list.append(li);
  }
  if(!activeFaults.size){const li=document.createElement('li');li.textContent='HEALTHY · No injected failures';list.append(li);}
  const n=activeFaults.size;
  status.textContent=(n?n+' injected fault'+(n===1?'':'s'):'Normal scenario')+
   ' · TRAINING ISOLATED · original aircraft CB, controls and locked images unchanged';
 }
 function paintIndicators(){
  let doc;try{doc=labFrame?.contentDocument;}catch(_){return;}
  if(!doc?.head||!doc.querySelectorAll)return;
  let style=doc.getElementById('ohLabsLampEffectsV1');
  if(!style){style=doc.createElement('style');style.id='ohLabsLampEffectsV1';doc.head.append(style);}
  let css='';
  for(const f of activeFaults.values()){
   if(!f.component.lampId||!/^[a-z0-9-]+$/i.test(f.component.lampId))continue;
   const sel='.mounted-light[data-light="'+f.component.lampId+'"]';
   if(f.mode==='LAMP_OPEN')css+=sel+' .light-face[data-frame="OFF"]{opacity:1!important}'+sel+' .light-face:not([data-frame="OFF"]){opacity:0!important}\n';
   if(f.mode==='LAMP_STUCK_ON')css+=sel+' .light-face[data-frame="ON"]{opacity:1!important}'+sel+' .light-face:not([data-frame="ON"]){opacity:0!important}\n';
   if(f.mode==='DIM_LAMP')css+=sel+' .light-face.active{opacity:.22!important}\n';
  }
  style.textContent=css;
 }
 function crop(){
  if(!dialog||!activePanel)return;
  const p=panels.get(activePanel),crop=$('ohLabCrop'),windowEl=$('ohLabWindow');
  if(!p||!crop||!windowEl)return;
  const width=Math.max(150,Math.min(660,crop.clientWidth||650));
  const heightLimit=Math.max(260,Math.min(610,window.innerHeight*.68));
  const scale=Math.min(width/p.region.w,heightLimit/p.region.h,2);
  crop.style.height=Math.round(p.region.h*scale)+'px';
  windowEl.style.width=p.region.w+'px';windowEl.style.height=p.region.h+'px';
  windowEl.style.transform='scale('+scale+')';
  if(labFrame){
   labFrame.style.left=(-p.region.x)+'px';labFrame.style.top=(-p.region.y)+'px';
  }
 }
 function build(){
  dialog=document.createElement('dialog');dialog.id='overheadTestLabDialogV1';dialog.className='oh-lab-dialog';dialog.dir='ltr';
  dialog.innerHTML='<header class="oh-lab-header"><div><strong id="ohLabTitle">OVERHEAD TEST LAB</strong><small>Original Unified artwork · independent fault injection · non-flight use</small></div><button id="ohLabClose" type="button" aria-label="Close">×</button></header>'+
  '<div class="oh-lab-layout"><section class="oh-lab-left"><div class="oh-lab-crop" id="ohLabCrop"><div class="oh-lab-window" id="ohLabWindow"><iframe id="ohLabStage" title="Original overhead live interactive panel" aria-label="Interactive original overhead panel"></iframe></div></div>'+
  '<p class="oh-lab-note">Original overhead stage, read-only inside this lab. Physical cockpit switches are not modified by injected faults. Lamp failures use a lab-only visual layer when the original light socket exists.</p>'+
  '<div id="ohLabCrossHost"></div><p id="ohLabStatus" role="status"></p></section><aside class="oh-lab-right">'+
  '<h3>COMPONENT / SYSTEM</h3><select id="ohLabComponent" aria-label="Component"></select>'+
  '<h3>FAILURE MODE</h3><select id="ohLabMode" aria-label="Failure mode"></select>'+
  '<div class="oh-lab-actions"><button id="ohLabInject" type="button">INJECT FAILURE</button><button id="ohLabClear" type="button">CLEAR SELECTED</button><button id="ohLabReset" type="button">RESET PANEL</button></div>'+
  '<h3>ACTIVE FAILURES · THIS LAB ONLY</h3><ul id="ohLabActive"></ul>'+
  '<p class="oh-lab-note"><strong>Model boundary:</strong> this catalog covers modeled and candidate fault modes for each physical control, annunciator and subsystem. Only indicator faults have an immediate visual override in the isolated photo; other entries are instructor scenarios, not connected ECU failures. Aircraft-specific exhaustive FCOM validation remains required.</p>'+
  '</aside></div>';
  document.body.append(dialog);labFrame=$('ohLabStage');
  labFrame.style.cssText='position:absolute;width:2220px;height:3312px;border:0;max-width:none;max-height:none;display:block;pointer-events:auto';
  $('ohLabClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  $('ohLabComponent').addEventListener('change',populateMode);
  $('ohLabInject').addEventListener('click',inject);
  $('ohLabClear').addEventListener('click',clearSelected);
  $('ohLabReset').addEventListener('click',()=>{resetPanelState();paintIndicators();});
  labFrame.addEventListener('load',()=>{sourceReady=true;paintIndicators();});
  dialog.addEventListener('close',()=>{
   window.B737CrossCockpitIndicatorsV1?.hide();
   activePanel=null;activeFaults=new Map();sourceReady=false;
   labFrame.removeAttribute('src'); // release the extra heavy overhead render
  });
  window.addEventListener('resize',crop);
 }
 function open(id){
  if(!panels.has(id))return false;
  if(id==='OH12'&&window.B737APULabShellV1?.open)return window.B737APULabShellV1.open();
  if(id==='OH17'&&window.B737HydraulicLabV1?.open)return window.B737HydraulicLabV1.open();
  if(id==='OH21'&&window.B737AirconLiveTestLabV1?.open)return window.B737AirconLiveTestLabV1.open();
  // OH15 already has a verified Window Heat/TAT kernel, physical panel, and
  // multiple independent heater, sensor and CB failure scenarios.
  if(id==='OH15'&&window.B737AntiIceTestLabV2?.open){
   window.B737AntiIceTestLabV2.open();
   const antiDialog=document.getElementById('antiIceLiveLab');
   const antiHost=antiDialog?.querySelector('.antiice-visual');
   if(antiHost)window.B737CrossCockpitIndicatorsV1?.show('OH15',antiHost);
   if(antiDialog&&!antiDialog.dataset.crossCockpitListener){
    antiDialog.dataset.crossCockpitListener='true';
    antiDialog.addEventListener('close',()=>window.B737CrossCockpitIndicatorsV1?.hide());
   }
   return true;
  }
  if(!dialog)build();
  activePanel=id;resetPanelState();
  $('ohLabTitle').textContent=id+' · '+panels.get(id).title+' · TEST LAB';
  populateComponents();
  if(!dialog.open)dialog.showModal();
  window.B737CrossCockpitIndicatorsV1?.show(id,$('ohLabCrossHost'));
  crop();
  const frame=q('overheadFrame'),src=frame?.getAttribute('src')||'./overhead-stage.html';
  labFrame.src=new URL(src,document.baseURI).href+(src.includes('?')?'&':'?')+'isolatedOverheadTestLab=1';
  return true;
 }
 async function start(){
  try{
   const res=await fetch('./overhead-test-labs-catalog-v1.json',{cache:'no-store'});
   if(!res.ok)throw Error('Catalog HTTP '+res.status);
   catalog=await res.json();
   if(catalog.schema!=='B737_CLASSIC_OVERHEAD_LABS_CATALOG_V1')throw Error('Invalid lab catalog version');
   panels=new Map(catalog.panels.map(x=>[x.id,x]));
   for(const p of panels.values()){
    if(!regionGroups.has(p.region.tile))regionGroups.set(p.region.tile,[]);
    regionGroups.get(p.region.tile).push(p);
   }
   bind();
   q('overheadFrame')?.addEventListener('load',bind);
   // The iframe DOM can be replaced during a performance-mode reload.
   setInterval(()=>{if(frameDoc!==q('overheadFrame')?.contentDocument)bind();},850);
   window.B737OverheadTestLabsV1=Object.freeze({
    open,panels:()=>Array.from(panels.keys()),faultModes:id=>panels.get(id)?.components.map(c=>({id:c.id,modes:modes(c)}))||[],
    current:()=>activePanel,active:()=>Array.from(activeFaults.values()).map(f=>({id:f.component.id,mode:f.mode}))
   });
  }catch(error){console.error('Overhead Test Labs catalog failed',error);}
 }
 // The standalone original OH15 live lab also sends bridge events; they
 // must not be mistaken for operational controls on the main Unified page.
 window.addEventListener('message',e=>{
  if(labFrame&&e.source===labFrame.contentWindow&&e.data?.type==='b737:cockpit-overhead')e.stopImmediatePropagation();
 },true);
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
