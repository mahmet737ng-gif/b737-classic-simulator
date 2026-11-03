/* AIRCON-LIVE-LAB-0001: photographic OH21 live isolated failure test bench.
 * The popup embeds the exact approved Unified Overhead OH21 stage and its
 * original P5-10 hardware, switches and annunciator sockets. Independent
 * Pneumatics V6 instance, not a shadow writer to the operational aircraft.
 */
(function(root){
 'use strict';
 const Core=root.B737AirconLiveLabV1,Hold=root.B737AirconOVHTQualificationV1;
 const P=()=>root.B737PneumaticsV6,D=()=>root.B737DuctPressureLiveV1;
 if(!Core||!Hold)return;
 const TILE={x:1724,y:1751,w:493,h:701},STAGE={w:2220,h:3312};
 const SOURCE_MAP={engineBleed1:'bleed-eng-1',engineBleed2:'bleed-eng-2',
  apuBleed:'bleed-apu',isolation:'isolation-valve',packL:'pack-l',
  packR:'pack-r',recirc:'recirc-fan'};
 const LAMP_NAMES={
  wingBodyOverheatL:'L WING–BODY OVHT',wingBodyOverheatR:'R WING–BODY OVHT',
  bleedTrip1:'ENG 1 BLEED TRIP',bleedTrip2:'ENG 2 BLEED TRIP',
  packTripL:'L PACK TRIP',packTripR:'R PACK TRIP',
  ductOverheatL:'L DUCT OVERHEAT',ductOverheatR:'R DUCT OVERHEAT',
  dualBleed:'DUAL BLEED'
 };
 let dialog=null,iframe=null,model=null,ready=false,lastDocument=null,lastProjection='';
 let renderQueued=false,interval=null,gauge=null,nativeHeld=false,opening=false;
 const $=id=>dialog?.querySelector('#'+id);
 const clean=id=>String(id).replace(/[^a-z0-9-_]/gi,'');
 function status(msg,error=false){
  const box=$('airconLabStatus');if(box){box.textContent=msg;box.dataset.error=String(error)}
 }
 function preferredFamily(){
  try{return JSON.parse(localStorage.getItem('b737classic.aircraft-profile.v1')||'null')?.aircraftFamily==='B737-400'
   ?'B737-400':'B737-300-500'}
  catch{return 'B737-300-500'}
 }
 function visualDoc(){try{return iframe?.contentDocument}catch{return null}}
 function visualWindow(){try{return iframe?.contentWindow}catch{return null}}
 function bootModel(){
  if(model)return true;
  if(!P()?.initial||!D()?.project)return false;
  model=Core.create({P:P(),pressure:D(),qualification:Hold,onChange:schedulePaint});
  model.setFamily(preferredFamily());
  status('LIVE PNEUMATIC CORE READY · LAB ISOLATED');
  return true;
 }
 function stageCommand(action,payload){
  if(!ready)return;
  visualWindow()?.postMessage({type:'b737:cockpit-command',action,...payload},location.origin);
 }
 function syncPhysical(){
  if(!ready||!model)return;
  const physical=visualWindow()?.B737OverheadToggles?.getState?.()||{};
  for(const [id,physicalId]of Object.entries(SOURCE_MAP)){
   const raw=physical[physicalId];
   if(raw===undefined||raw===null)continue;
   const v=String(raw).trim().toUpperCase();
   if(P().CONTROL_TYPES[id]?.includes(v))model.control(id,v);
  }
 }
 function setFamily(family){
  if(!bootModel())return false;
  model.setFamily(family);
  const local=visualWindow();
  local?.B737OverheadLights?.setAircraftFamily?.(family);
  stageCommand('aircon-background',{family});
  lastProjection='';schedulePaint();
  return true;
 }
 function ensureGauge(){
  if(!ready||!D()?.advanceDynamics)return false;
  const doc=visualDoc(),atlas=doc?.getElementById('atlasAbsolute');
  const photo=atlas?.querySelector('.owner-oh21-photo-layer-v1');
  const m=root.B737DuctPressureNeedlesModel;
  if(!photo||!atlas||!m)return false;
  if(gauge?.node?.isConnected){
   for(const k of ['left','top','width','height'])gauge.node.style[k]=photo.style[k];
   return true;
  }
  const n='http://www.w3.org/2000/svg';
  const svg=doc.createElementNS(n,'svg');
  svg.setAttribute('data-aircon-live-lab-needles','OH21');
  svg.setAttribute('viewBox','0 0 '+m.source.width+' '+m.source.height);
  svg.setAttribute('preserveAspectRatio','none');
  Object.assign(svg.style,{position:'absolute',zIndex:'1005',pointerEvents:'none',
   overflow:'hidden',left:photo.style.left,top:photo.style.top,
   width:photo.style.width,height:photo.style.height});
  const blades={};
  for(const needle of m.needles){
   const group=doc.createElementNS(n,'g');
   group.setAttribute('transform','translate('+m.pivot.x+' '+m.pivot.y+') scale('+
    needle.tipRadius/220+') translate(-256 -256)');
   const blade=doc.createElementNS(n,'g');
   blade.style.transformOrigin='256px 256px';
   blade.style.transition='none';
   blade.setAttribute('data-duct-pressure-blade',needle.id);
   const image=doc.createElementNS(n,'image');
   image.setAttribute('href',new URL('./'+needle.asset+'?v=DPN-0005-LR',document.baseURI).href);
   image.setAttribute('x','0');image.setAttribute('y','0');
   image.setAttribute('width','512');image.setAttribute('height','512');
   blade.append(image);group.append(blade);svg.append(group);
   blades[needle.id]=blade;
  }
  atlas.append(svg);
  gauge={node:svg,blades,motion:D().initialDynamics(),target:{L:0,R:0},last:null,raf:0};
  return true;
 }
 function animateGauge(ts){
  if(!gauge||!dialog?.open){if(gauge)gauge.raf=0;return}
  gauge.raf=0;
  const dt=gauge.last===null?16:Math.min(80,Math.max(0,ts-gauge.last));
  gauge.last=ts;
  gauge.motion=D().advanceDynamics(gauge.motion,gauge.target,dt);
  const m=root.B737DuctPressureNeedlesModel;
  for(const side of ['L','R'])gauge.blades[side].style.transform=
   'rotate('+m.bearing(side,gauge.motion[side].value)+'deg)';
  if(!D().settled(gauge.motion,gauge.target))gauge.raf=requestAnimationFrame(animateGauge);
  else gauge.last=null;
 }
 function pressureNeedles(pressures){
  if(!pressures||!ensureGauge())return;
  for(const side of ['L','R']){
   const value=pressures[side];
   if(typeof value==='number'&&Number.isFinite(value))gauge.target[side]=value;
   gauge.blades[side].style.opacity=value===null?'.22':'1';
  }
  if(!gauge.raf)gauge.raf=requestAnimationFrame(animateGauge);
 }
 function indicatorOverrides(faults){
  const doc=visualDoc();if(!doc?.head)return;
  let sheet=doc.getElementById('airconLiveLabIndicatorOverrides');
  if(!sheet){sheet=doc.createElement('style');sheet.id='airconLiveLabIndicatorOverrides';doc.head.append(sheet)}
  const css=[];
  for(const [id,mode]of Object.entries(faults)){
   if(!Core.LAMP_IDS.includes(id))continue;
   const selector='.mounted-light[data-light="'+id+'"]';
   const faces=selector+' .light-face';
   if(mode==='LAMP_OPEN'){
    css.push(faces+'{opacity:0!important}');
    css.push(selector+' .light-face[data-frame="OFF"]{opacity:1!important}');
   }else if(mode==='LAMP_STUCK_ON'){
    css.push(faces+'{opacity:0!important}');
    css.push(selector+' .light-face[data-frame="ON"]{opacity:1!important}');
   }else if(mode==='DIM_LAMP')css.push(selector+' .light-face.active{opacity:.22!important}');
  }
  sheet.textContent=css.join('\n');
 }
 function sendProjection(result,force=false){
  if(!ready||!result)return;
  const out=result.derived;
  const payload={family:result.state.controls.aircraftFamily,
   lamps:out.lamps,pack400:out.pack400,zones:out.zoneTemp400,
   latched:result.state.latched,
   inputs:{wingBodyTestHeld:result.state.inputs.wingBodyTestHeld}};
  const signature=JSON.stringify(payload);
  if(force||signature!==lastProjection){
   lastProjection=signature;
   stageCommand('aircon-fcom-projection',{payload});
  }
  indicatorOverrides(result.lampFaults);
  pressureNeedles(result.pressures);
 }
 function updateProgress(){
  const t=model?.snapshot().test;
  const pct=t?.held?Math.min(100,100*t.elapsedMs/t.delayMs):0;
  const fill=$('airconLabHoldFill');if(fill)fill.style.width=pct+'%';
  const button=$('airconLabHold');
  if(button){
   button.setAttribute('aria-pressed',String(t?.held===true));
   button.textContent=t?.held?(t.qualified?'OVHT TEST · QUALIFIED':
    'OVHT TEST · '+(t.remainingMs/1000).toFixed(1)+' s'):'HOLD OVHT TEST · 5 s';
  }
 }
 function schedulePaint(){
  if(renderQueued)return;
  renderQueued=true;
  queueMicrotask(()=>{renderQueued=false;paint()});
 }
 function paint(){
  if(!dialog||!model)return;
  const s=model.snapshot(),d=s.derived;
  const family=s.state.controls.aircraftFamily;
  const select=$('airconLabFamily');if(select)select.value=family;
  for(const box of dialog.querySelectorAll('[data-aircon-fault]')){
   box.checked=s.faults[box.dataset.airconFault]===true;
   box.closest('label').hidden=box.dataset.family!=='BOTH'&&box.dataset.family!==family;
  }
  for(const box of dialog.querySelectorAll('[data-aircon-source]'))
   box.checked=s.state.inputs[box.dataset.airconSource]===true;
  for(const section of dialog.querySelectorAll('[data-aircon-family]'))
   section.hidden=section.dataset.airconFamily!=='BOTH'&&section.dataset.airconFamily!==family;
  for(const opt of dialog.querySelectorAll('[data-aircon-scenario]')){
   const id=opt.dataset.airconScenario;
   opt.setAttribute('aria-pressed',String(s.preset===id));
   opt.hidden=(id.startsWith('400-')&&family!=='B737-400')||
    (id.startsWith('duct-')&&family!=='B737-300-500');
  }
  for(const [id,on]of Object.entries(d.lamps)){
   const node=$('airconLamp-'+clean(id));
   if(node){node.dataset.on=String(on);node.textContent=(LAMP_NAMES[id]||id)+' : '+(on?'ON':'OFF');}
  }
  for(const z of ['CONT','FWD','AFT']){
   const node=$('airconZone-'+z);
   if(node){node.dataset.on=String(d.zoneTemp400[z].immediate);
    node.textContent=z+' ZONE TEMP : '+(d.zoneTemp400[z].immediate?'ON':
     d.zoneTemp400[z].recallOnly?'RECALL ONLY':'OFF');
    node.dataset.recall=String(d.zoneTemp400[z].recallOnly);
    node.hidden=family!=='B737-400';
   }
  }
  const warn=$('airconLabCaution');if(warn){
   warn.dataset.on=String(s.immediateCaution);
   warn.querySelector('span').textContent=s.immediateCaution?'ON':s.recallOnly?'RECALL ONLY':'OFF';
  }
  const psi=$('airconLabDuct');
  if(psi){
   const value=v=>typeof v==='number'?v.toFixed(1)+' PSI':'NO AC INDICATION';
   psi.textContent='L '+value(s.pressures?.L)+' · R '+value(s.pressures?.R);
  }
  const valves=$('airconLabValves');
  if(valves)valves.textContent='ENG1 BLEED '+(d.bleed.engine1ValveOpen?'OPEN':'CLOSED')+
   ' · ENG2 '+(d.bleed.engine2ValveOpen?'OPEN':'CLOSED')+
   ' · APU '+(d.bleed.apuBleedValveOpen?'OPEN':'CLOSED')+
   ' · ISOLATION '+(d.bleed.isolationOpen===null?'UNKNOWN':d.bleed.isolationOpen?'OPEN':'CLOSED');
  const pack=$('airconLabPack');
  if(pack)pack.textContent='L PACK '+String(d.pack.L.flow)+' · R PACK '+String(d.pack.R.flow);
  const n=$('airconLabFailures');
  if(n)n.textContent=Object.values(s.faults).filter(Boolean).length+' ACTIVE FAILURES'+
   ' · '+Object.keys(s.lampFaults).length+' INDICATOR FAULTS'+
   ' · '+Object.values(s.state.latched).filter(Boolean).length+' TRIP LATCHES';
  updateProgress();
  sendProjection(s);
 }
 function connect(){
  if(!dialog?.open||!bootModel())return false;
  const w=visualWindow(),doc=visualDoc();
  if(!doc?.querySelector('#atlasAbsolute .atlas-piece[data-key="OH21"]')||
    !w?.B737OverheadToggles?.getState||!w?.B737OverheadLights?.getState)return false;
  if(ready&&lastDocument===doc)return true;
  ready=true;lastDocument=doc;lastProjection='';gauge=null;
  try{
   w.B737OverheadLights.setAircraftElectricalPower?.(true);
   w.B737OverheadLights.setScenario?.({panelPower:true,
    engine1Running:model.snapshot().state.inputs.engine1Running,
    engine2Running:model.snapshot().state.inputs.engine2Running,
    apuRunning:model.snapshot().state.inputs.apuRunning});
  }catch(err){status('Laboratory light power configuration unavailable: '+err.message,true)}
  setFamily(model.snapshot().state.controls.aircraftFamily);
  syncPhysical();schedulePaint();
  status('ORIGINAL OH21 LIVE PANEL READY · all faults isolated from operational Unified');
  return true;
 }
 function crop(){
  const box=$('airconLabCrop'),area=$('airconLabWindow');
  if(!box||!area)return;
  const width=Math.max(190,Math.min(590,box.clientWidth||560));
  const maxHeight=Math.max(300,Math.min(780,window.innerHeight*.67));
  const scale=Math.min(width/TILE.w,maxHeight/TILE.h,2);
  box.style.height=Math.round(TILE.h*scale)+'px';
  area.style.transform='scale('+scale+')';
  area.style.width=TILE.w+'px';area.style.height=TILE.h+'px';
 }
 function press(){
  if(!bootModel())return;
  model.testPress();nativeHeld=true;schedulePaint();
 }
 function release(){
  nativeHeld=false;
  if(model)model.testRelease();
  schedulePaint();
 }
 function holdButton(){
  const button=$('airconLabHold');
  button.addEventListener('pointerdown',e=>{
   if(e.pointerType==='mouse'&&e.button!==0)return;
   e.preventDefault();try{button.setPointerCapture(e.pointerId)}catch{}
   press();
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture']){
   button.addEventListener(event,e=>{e.stopPropagation();release()});
  }
  button.addEventListener('keydown',e=>{
   if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat)press()}
  });
  button.addEventListener('keyup',e=>{
   if(e.key===' '||e.key==='Enter'){e.preventDefault();release()}
  });
  button.addEventListener('blur',release);
  button.addEventListener('click',e=>e.preventDefault());
 }
 function build(){
  dialog=document.createElement('dialog');
  dialog.id='airconLiveTestLabV1';dialog.className='aircon-live-dialog';dialog.dir='ltr';
  const option=arr=>arr.map(x=>'<option value="'+x+'">'+x.replaceAll('_',' ')+'</option>').join('');
  const presets=Core.SCENARIOS.map(s=>
   '<button type="button" data-aircon-scenario="'+s[0]+'" aria-pressed="false">'+s[1]+'</button>').join('');
  const groups=Core.GROUPS.map(g=>
   '<section class="aircon-section" data-aircon-family="'+g.family+'"><h3>'+g.name+'</h3>'+
   '<div class="aircon-grid">'+g.entries.map(([id,label])=>
    '<label data-variant="'+g.family+'"><input type="checkbox" data-aircon-fault="'+id+
     '" data-family="'+g.family+'"><span>'+label+'</span></label>').join('')+'</div></section>').join('');
  const sources=Core.SOURCES.map(([id,label])=>
   '<label><input type="checkbox" data-aircon-source="'+id+'"><span>'+label+'</span></label>').join('');
  const lamps=Object.keys(LAMP_NAMES).map(id=>
   '<span class="aircon-lamp" id="airconLamp-'+clean(id)+'" data-on="false">'+LAMP_NAMES[id]+' : OFF</span>').join('')+
   ['CONT','FWD','AFT'].map(z=>
    '<span class="aircon-lamp" id="airconZone-'+z+'" hidden>'+z+' ZONE TEMP</span>').join('');
  const faultModes=Core.LAMP_MODES.map(x=>'<option value="'+x+'">'+x.replaceAll('_',' ')+'</option>').join('');
  const lampSelect=Core.LAMP_IDS.map(id=>
   '<label><span>'+id+'</span><select data-aircon-lamp="'+id+'">'+faultModes+'</select></label>').join('');
  dialog.innerHTML=
   '<header class="aircon-head"><div><strong>AIR CONDITIONING · LIVE TEST LAB</strong>'+
   '<small>Approved real Unified OH21 panel · independent failure injection and original physical controls</small></div>'+
   '<button id="airconLabClose" type="button" aria-label="Close test lab">×</button></header>'+
   '<div class="aircon-body"><section class="aircon-left">'+
   '<div class="aircon-crop" id="airconLabCrop"><div class="aircon-window" id="airconLabWindow">'+
   '<iframe id="airconLabStage" title="Original B737 Classic OH21 air conditioning panel"></iframe></div></div>'+
   '<p class="aircon-note">This is the original photo, switches and lights from Unified, running in a separate laboratory instance. Test faults never change the operating cockpit.</p>'+
   '<div class="aircon-summary"><div class="aircon-caution" id="airconLabCaution" data-on="false"><b>MASTER CAUTION · AIR COND</b><span>OFF</span></div>'+
   '<div><b>DUAL DUCT PRESSURE · ESTIMATE</b><span id="airconLabDuct">L — · R —</span></div>'+
   '<div><b>BLEED / ISOLATION VALVES</b><span id="airconLabValves">—</span></div>'+
   '<div><b>PACK AIR FLOW</b><span id="airconLabPack">—</span></div></div>'+
   '<div class="aircon-actions"><button type="button" id="airconLabHold" aria-pressed="false">HOLD OVHT TEST · 5 s</button>'+
   '<button type="button" id="airconLabTrip">TRIP RESET</button>'+
   '<button type="button" id="airconLabReset">RESET LAB</button></div>'+
   '<div id="airconLabHoldMeter" aria-label="5 second detector test qualification"><div id="airconLabHoldFill"></div></div>'+
   '<div id="airconLabFailures" role="status"></div>'+
   '<div class="aircon-lamps" id="airconLabLamps">'+lamps+'</div>'+
   '<p id="airconLabStatus" role="status">WAITING FOR LIVE OVERHEAD STAGE</p></section>'+
   '<aside class="aircon-right"><div class="aircon-row"><label for="airconLabFamily">AIRCRAFT</label>'+
   '<select id="airconLabFamily"><option value="B737-300-500">B737-300 / 500</option>'+
   '<option value="B737-400">B737-400</option></select></div>'+
   '<section class="aircon-section"><h3>QUICK REALISTIC FAILURE SCENARIOS</h3>'+
   '<div class="aircon-presets">'+presets+'</div></section>'+
   '<section class="aircon-section"><h3>AIR SOURCES · LAB ONLY</h3>'+
   '<div class="aircon-grid">'+sources+'</div></section>'+groups+
   '<section class="aircon-section"><h3>INDIVIDUAL ANNUNCIATOR FAILURES · LAB ONLY</h3>'+
   '<div class="aircon-lamp-list">'+lampSelect+'</div></section>'+
   '<p class="aircon-note">Select any combination of faults. WING–BODY leak is immediate; OVHT TEST is deliberately qualified after 5 uninterrupted seconds. BLEED / PACK / DUCT / ZONE trips need removal of initiating fault before TRIP RESET. Duct PSI, actual temperature thresholds and component wiring use training estimates, not aircraft-certified calibration.</p>'+
   '</aside></div>';
  document.body.append(dialog);
  iframe=$('airconLabStage');
  iframe.style.left='-'+TILE.x+'px';iframe.style.top='-'+TILE.y+'px';
  iframe.style.width=STAGE.w+'px';iframe.style.height=STAGE.h+'px';
  $('airconLabClose').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close()});
  dialog.addEventListener('close',()=>{
   release();
   ready=false;lastDocument=null;lastProjection='';
   if(gauge?.raf)cancelAnimationFrame(gauge.raf);
   gauge=null;iframe.removeAttribute('src');
  });
  $('airconLabFamily').addEventListener('change',e=>setFamily(e.target.value));
  $('airconLabTrip').addEventListener('click',()=>{model?.tripReset();schedulePaint()});
  $('airconLabReset').addEventListener('click',()=>{
   if(!model)return;model.reset();model.setFamily($('airconLabFamily').value);
   schedulePaint();status('LAB RESET · all injected failures removed');
  });
  $('airconLabHold').addEventListener('contextmenu',e=>e.preventDefault());
  holdButton();
  dialog.addEventListener('change',e=>{
   const t=e.target;
   if(t.dataset.airconFault){
    if(!bootModel())return;model.inject(t.dataset.airconFault,t.checked);schedulePaint();
   }else if(t.dataset.airconSource){
    if(!bootModel())return;model.source(t.dataset.airconSource,t.checked);schedulePaint();
    if(ready)visualWindow()?.B737OverheadLights?.setScenario?.({
     [t.dataset.airconSource]:t.checked
    });
   }else if(t.dataset.airconLamp){
    if(!bootModel())return;model.lamp(t.dataset.airconLamp,t.value);schedulePaint();
   }
  });
  dialog.addEventListener('click',e=>{
   const id=e.target.closest('[data-aircon-scenario]')?.dataset.airconScenario;
   if(!id)return;
   if(!bootModel())return;
   model.preset(id);schedulePaint();
  });
  iframe.addEventListener('load',()=>{ready=false;lastDocument=null;lastProjection='';gauge=null;connect()});
  window.addEventListener('resize',crop);
  interval=setInterval(()=>{
   if(!dialog?.open)return;
   if(!model)bootModel();
   if(!ready)connect();
   if(ready)syncPhysical();
   updateProgress();
   if(ready&&model){
    const s=model.snapshot();
    if(!gauge?.node?.isConnected)pressureNeedles(s.pressures);
    sendProjection(s);
   }
  },140);
 }
 function onMessage(e){
  if(!iframe||e.source!==visualWindow()||e.origin!==location.origin||
   e.data?.type!=='b737:cockpit-overhead')return;
  // A separate original overhead instance must NEVER feed the operational
  // Unified ECU or six-pack, regardless of event order.
  e.stopImmediatePropagation();
  const msg=e.data;
  if(msg.kind==='ready'){ready=false;connect();schedulePaint();return}
  if(msg.kind==='recessed-button'&&msg.source==='recessed-hardware-v2'){
   if(!bootModel())return;
   if(msg.id==='aircon-ovht-test'){
    if(msg.pressed)press();else release();
   }else if(msg.id==='trip-reset'&&msg.pressed){
    model.tripReset();schedulePaint();
   }
  }
  if(msg.kind==='control-event'||msg.kind==='controls-state')syncPhysical();
 }
 root.addEventListener('message',onMessage,true);
 function ensureButton(){
  const holder=document.querySelector('body > header.unified-minimal-header .header-settings');
  if(!holder)return;
  let btn=document.getElementById('airconLiveLabOpen');
  if(!btn){
   btn=document.createElement('button');btn.id='airconLiveLabOpen';btn.type='button';
   btn.textContent='AIR COND LAB';btn.title='FCOM Air Conditioning OH21 live failure test lab';
   btn.addEventListener('click',open);
  }
  const neighbor=holder.querySelector('#groundPowerHeader');
  if(neighbor)neighbor.insertAdjacentElement('afterend',btn);
  else if(!btn.isConnected)holder.append(btn);
 }
 function open(){
  if(!dialog)build();
  if(!dialog.open)dialog.showModal();
  crop();
  if(!bootModel()){status('WAITING FOR PNEUMATICS V6 ECU CORE');return}
  if(!iframe.hasAttribute('src')){
   const main=document.getElementById('overheadFrame');
   const origin=main?.getAttribute('src')||'./overhead-stage.html';
   iframe.src=new URL(origin,document.baseURI).href+
    (origin.includes('?')?'&':'?')+'airconLiveLab=1';
  }
  schedulePaint();
 }
 function readyInit(){ensureButton();root.addEventListener('b737:cockpit-mounted',ensureButton);}
 root.B737AirconLiveTestLabV1=Object.freeze({open,
  snapshot:()=>model?.snapshot()||null,
  inject:(id,value)=>{if(!bootModel())throw Error('Pneumatic core not ready');return model.inject(id,value)},
  preset:id=>{if(!bootModel())throw Error('Pneumatic core not ready');return model.preset(id)},
  testPress:press,testRelease:release,
  isOpen:()=>dialog?.open===true});
 if(document.readyState==='loading')
  document.addEventListener('DOMContentLoaded',readyInit,{once:true});
 else readyInit();
})(window);
