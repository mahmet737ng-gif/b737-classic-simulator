(async()=>{
;
/* ./hydraulic-live-lab-v1.js?v=HYD-LAB-UI-0003&amp;p8=ATA26-0003 */
try{
/* HYD-LAB-UI-0001
 * Independent FCOM-oriented system lab: one native OH17 photo panel,
 * independently animated actual engine hydraulic dial photo layers,
 * genuine switch event routing and 61+ explicit selectable failures.
 * No top-level cockpit visual edit, and no claimed production ECU authority.
 */
(function(){'use strict';
 const Core=window.B737ClassicHydraulicLabCoreV1;
 const Cal=window.B737HydraulicGaugeCalibrationV2;
 if(!Core||!Cal)return;
 const OH={x:1231,y:1818,w:425,h:283};
 const PHOTO_ENGINE='../../panel-mosaic-lab/assets/locked/2026-10-23/B737_Engine_Standby_Instruments_Blank.png';
 const PHOTO_BRAKE='./assets/B737_Right_Main_Instruments_GPWS_TERRAIN_LEFT_V3.png';
 const NEEDLES=Object.freeze([
  {id:'A',title:'HYD SYSTEM A · PRESS',photo:PHOTO_ENGINE,face:'eng.hyd_pressure.a'},
  {id:'B',title:'HYD SYSTEM B · PRESS',photo:PHOTO_ENGINE,face:'eng.hyd_pressure.b'},
  {id:'BRAKE',title:'BRAKE ACCUMULATOR · PRESS',photo:PHOTO_BRAKE,face:'fo.hyd_brake_pressure'}
 ]);
 const CATEGORY=[
  {name:'NORMAL',title:'NORMAL OPERATIONS'},
  {name:'ABNORMAL',title:'ABNORMAL PROCEDURES'},
  {name:'EMERGENCY',title:'EMERGENCY / COMBINED FAILURES'},
  {name:'PUMPS',title:'PUMP FAILURES · INDIVIDUAL / OVERHEAT'},
  {name:'POWER',title:'ELECTRICAL POWER / RESERVOIR AIR'},
  {name:'SYSTEM',title:'HYD A/B PRESSURE, LEAKS, QUANTITY'},
  {name:'STANDBY',title:'STANDBY HYDRAULICS'},
  {name:'BRAKES',title:'BRAKES & ACCUMULATOR'},
  {name:'FLIGHT_CONTROLS',title:'FLIGHT CONTROL HYDRAULIC USERS'},
  {name:'SENSORS',title:'INDICATORS / TRANSDUCERS'},
  {name:'WARNINGS',title:'LOW PRESS / OVERHEAT / MASTER CAUTION'}
 ];
 let dialog=null,frame=null,frameDoc=null,ready=false,timer=null,lastAt=0;
 let model=Core.loadPreset('healthy'),output=Core.evaluate(model),preset='healthy';
 let lampTest=false,bound=false,pauseSync=false,lastReason='All systems healthy';
 const $=id=>dialog?.querySelector('#'+id);
 const safe=(x)=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function after(actions){
  for(const action of actions){model=Core.command(model,action);}
  output=Core.evaluate(model);render();
 }
 function nativeSwitch(id,next){
  if(!ready)return false;
  const win=frame?.contentWindow,api=win?.B737OverheadToggles;
  const current=api?.getState?.()?.[id];
  if(!api||!Core.PUMP[id]||current===undefined)return false;
  if(current!==next){
   const button=frameDoc?.getElementById('toggle-'+id);
   if(!button)return false;
   button.click();
  }
  return api.getState()[id]===next;
 }
 function syncAll(){
  if(!ready)return;
  pauseSync=true;
  try{for(const [id,v] of Object.entries(model.switches))nativeSwitch(id,v);}
  finally{pauseSync=false;}
 }
 function inject(id){
  const active=model.faults.includes(id);
  model=Core.command(model,{type:active?'CLEAR':'INJECT',id});
  preset='manual';
  lastReason=(active?'Cleared ':'Injected ')+(Core.getFault(id)?.label||id);
  output=Core.evaluate(model);render();
 }
 function choosePreset(id){
  const s=Core.PRESETS.find(p=>p.id===id);
  if(!s)return false;
  model=Core.loadPreset(id);preset=id;lastReason=s.label;
  const panel=window.B737UnifiedFireLights?.getState?.();
  if(panel)for(const n of [1,2])model.env['fireHandle'+n]=panel.handles['ENG'+n].pulled;
  if(id==='a-lost'||id==='b-lost'||id==='dual-lost'){
   model=Core.step(model,30); // leak scenario settles close to zero system pressure
  }else if(id==='dual-ac-loss')model=Core.step(model,8);
  else if(id==='engine-out1'||id==='engine-out2')model=Core.step(model,8);
  else if(id==='brake-accum'){
   model=Core.command(model,{type:'INJECT',id:'B_RAPID_LEAK'});
   model=Core.step(model,14);
  }
  output=Core.evaluate(model);
  syncAll();render();return true;
 }
 function mark(){
  if(!dialog)return;
  for(const b of dialog.querySelectorAll('[data-hyd-preset]'))
   b.setAttribute('aria-pressed',String(b.dataset.hydPreset===preset));
  for(const b of dialog.querySelectorAll('[data-hyd-fault]'))
   b.setAttribute('aria-pressed',String(model.faults.includes(b.dataset.hydFault)));
 }
 function special(){
  const status=$('hydLiveStatus');
  if(status)status.textContent='MODEL: TRAINING ONLY · '+lastReason+' · t='+Math.floor(model.time)+'s'+
    ' · ACTIVE FAULTS '+model.faults.length+' · Master '+(output.alerts.masterCaution?'CAUTION':'NO CAUTION');
  const sel=$('hydSelectedInfo');
  if(sel)sel.textContent='Selected preset: '+preset+' · faults can be combined by clicking several failure buttons. Click an active failure again to clear only that fault.';
  $('hydFaultList')?.replaceChildren(...model.faults.map(id=>{
   const row=document.createElement('button');row.type='button';row.className='hyd-fault-chip';
   row.textContent=(Core.getFault(id)?.label||id)+' ×';row.title='Clear this fault';row.onclick=()=>inject(id);return row;
  }));
 }
 function makeNeedleLayer(def){
  // Crop exactly one approved source-image gauge per card. Both engine
  // gauges are physically in a dual face, but each has a separate pivot.
  const g=Cal.gauge(def.id),v=g.viewport,p=Cal.local(def.id);
  const wrap=document.createElement('div');wrap.className='hyd-native-wrap';
  Object.assign(wrap.style,{width:v.w+'px',height:v.h+'px'});
  const img=document.createElement('div');img.className='hyd-native-image';
  Object.assign(img.style,{
   width:v.w+'px',height:v.h+'px',
   backgroundImage:'url("'+new URL(def.photo,document.baseURI).href+'")',
   backgroundSize:g.native.w+'px '+g.native.h+'px',
   backgroundPosition:(-v.x)+'px '+(-v.y)+'px'
  });
  wrap.append(img);
  const ns='http://www.w3.org/2000/svg';
  const svg=document.createElementNS(ns,'svg');svg.classList.add('hyd-native-needle');
  svg.setAttribute('viewBox','0 0 '+v.w+' '+v.h);
  svg.setAttribute('aria-hidden','true');
  const rotor=document.createElementNS(ns,'g');rotor.dataset.hydRotor=def.id;
  rotor.style.transformBox='view-box';
  rotor.style.transformOrigin=p.x+'px '+p.y+'px';
  rotor.style.transition='transform 170ms linear';
  // Photo-matched ivory tapered metal pointer; entire original face,
  // numbers, tick marks and bezel stay exactly as the source bitmap.
  const needle=document.createElementNS(ns,'path');
  needle.setAttribute('d',
   'M '+(p.x-2.5)+' '+(p.y+7)+
   ' L '+(p.x-2.0)+' '+(p.y-12)+
   ' L '+(p.x-.8)+' '+(p.y-g.needleLength)+
   ' L '+(p.x+.8)+' '+(p.y-g.needleLength)+
   ' L '+(p.x+2.0)+' '+(p.y-12)+
   ' L '+(p.x+2.5)+' '+(p.y+7)+' Z');
  needle.setAttribute('fill','#eae7d9');
  needle.setAttribute('stroke','#343a41');
  needle.setAttribute('stroke-width','.45');
  const hub=document.createElementNS(ns,'circle');
  hub.setAttribute('cx',p.x);hub.setAttribute('cy',p.y);hub.setAttribute('r',def.id==='BRAKE'?'4.1':'3.2');
  hub.setAttribute('fill','#10171a');hub.setAttribute('stroke','#b4b2a2');
  hub.setAttribute('stroke-width','1');
  rotor.append(needle,hub);svg.append(rotor);wrap.append(svg);
  const q=Cal.qtyLocal(def.id);
  if(q){
   const qty=document.createElement('span');qty.className='hyd-quantity-native';
   qty.dataset.hydQtyWindow='';
   qty.setAttribute('aria-label',def.id+' hydraulic quantity in original digital window');
   Object.assign(qty.style,{left:(q.x-21)+'px',top:(q.y-10)+'px',width:'42px',height:'20px'});
   wrap.append(qty);
  }
  return wrap;
 }
 function pressureAngle(psi){return Cal.angle('A',psi);}
 function brakeAngle(psi){return Cal.angle('BRAKE',psi);}
 function renderGauge(def,out){
  const card=$('hydGauge'+def.id);
  if(!card)return;
  const value=out.indications[def.face];
  const reading=card.querySelector('[data-hyd-reading]');
  if(reading)reading.textContent=value===null?'SENSOR FAIL / NO DATA':value+' PSI';
  const qty=card.querySelector('[data-hyd-qty]');
  if(qty){
   const q=out.indications['eng.hyd_qty.'+def.id.toLowerCase()];
   qty.textContent=q===null?'QTY SENSOR FAIL':q+' % FULL';
   const windowFace=card.querySelector('[data-hyd-qty-window]');
   if(windowFace)windowFace.textContent=q===null?'---':String(q);
  }
  const rotor=card.querySelector('[data-hyd-rotor]');
  if(rotor){
   const angle=Cal.angle(def.id,value);
   const center=Cal.local(def.id);
   // Path starts pointing to 12 o'clock. A, B and brake are each
   // calibrated in their own five-point clockwise source-photo frame.
   if(angle===null){
    rotor.style.opacity='0'; // cannot invent indication for failed sensor
   }else{
    const rotation='rotate('+angle.toFixed(3)+' '+center.x+' '+center.y+')';
    rotor.setAttribute('transform',rotation);
    rotor.style.transform='rotate('+angle.toFixed(3)+'deg)';
    rotor.style.opacity='1';
    rotor.dataset.angleDeg=angle.toFixed(3);
    rotor.dataset.psi=String(value);
   }
  }
  card.dataset.degraded=String(value===null);
 }
 function photoIndicators(){
  const host=$('hydGauges');host.replaceChildren();
  for(const def of NEEDLES){
   const card=document.createElement('article');card.className='hyd-instrument';
   card.id='hydGauge'+def.id;card.innerHTML='<strong>'+safe(def.title)+'</strong>';
   card.append(makeNeedleLayer(def));
   const output=document.createElement('output');output.dataset.hydReading='';
   card.append(output);
   if(def.id!=='BRAKE'){
    const qty=document.createElement('small');qty.dataset.hydQty='';
    card.append(qty);
   }
   const note=document.createElement('small');note.className='hyd-gauge-note';note.textContent='Original dial photo · 0–4 calibrated detents · training-only geometry';
   card.append(note);host.append(card);
  }
 }
 function build(){
  dialog=document.createElement('dialog');dialog.id='hydraulicLiveLabV1';dialog.className='hydlab-dialog';dialog.dir='ltr';
  dialog.innerHTML='<header class="hydlab-head"><div><strong>OH17 · HYDRAULICS · LIVE SYSTEM TEST LAB</strong><small>737-300/400/500 · ATA 29 · same original overhead / engine / main instruments · standalone system physics</small></div>'+
    '<button id="hydClose" type="button" aria-label="Close">×</button></header>'+
    '<div class="hydlab-layout"><section class="hydlab-left"><div class="hydlab-viewport" id="hydLiveCrop"><div class="hydlab-photo" id="hydLiveCanvas"><iframe id="hydOriginalStage" title="Original live OH17 hydraulic pumps panel" loading="eager"></iframe></div></div>'+
    '<p class="hydlab-note">Original OH17 metal controls are LIVE. The four physical switches control the hydraulic engine below. All six original annunciator faces reflect that engine. No original bitmap, locked guarded switch or main cockpit state is overwritten.</p>'+
    '<div class="hydlab-indicators"><div class="hydlab-statusbar" id="hydLiveStatus"></div><div class="hydlab-quick" id="hydStatusNumbers"></div><div class="hydlab-sixpack" id="hydLiveSixPack"></div>'+
    '<h3>ENGINE INSTRUMENTS & BRAKE PRESSURE · ORIGINAL PHOTO</h3><div class="hydlab-gauges" id="hydGauges"></div>'+
    '<h3>FLIGHT CONTROL / STANDBY HYD · OH07</h3><div class="hydlab-oh07-group"><div class="hydlab-oh07-source" id="hydOH07Photo" aria-label="Original OH07 flight control hydraulic annunciator photo"></div><div id="hydStandbyLamps" class="hydlab-standby"></div></div>'+
    '<h3>SYSTEM USERS / INTERDEPENDENCIES · LIVE TRAINING MODEL</h3><div id="hydDownstream" class="hydlab-dependents"></div>'+
    '<div class="hydlab-tools"><button type="button" id="hydBrake">BRAKE APPLICATION ×1</button>'+
    '<button type="button" id="hydStep">ADVANCE +15 s</button><button type="button" id="hydLampTest">LAMP TEST</button>'+
    '<button type="button" id="hydAck">MASTER CAUTION ACK</button><button type="button" id="hydRecall">RECALL</button>'+
    '<button type="button" id="hydReset">RESET TO NORMAL</button></div>'+
    '<p class="hydlab-note" id="hydModelCaveat">Trainer pressure dynamics are approximate; A/B pressure and quantities use a common model. Brake accumulator pressure is independent. No numeric reading is invented from an unavailable aircraft data source.</p>'+
    '</div></section><aside class="hydlab-right">'+
    '<h3>READY-MADE SCENARIOS · SELECT ANY ONE</h3><div id="hydPresetList"></div>'+
    '<p id="hydSelectedInfo" class="hydlab-note"></p>'+
    '<h3>ALL HYDRAULIC FAILURES · MULTI-SELECT INJECTION</h3><div id="hydFailureList"></div>'+
    '<h3>ACTIVE FAILURES · CLICK TO CLEAR</h3><div class="hydlab-active" id="hydFaultList"></div>'+
    '<h3>MANUAL INPUTS</h3><div class="hydlab-env" id="hydEnvironment"></div>'+
    '<p class="hydlab-note">NORMAL / ABNORMAL / EMERGENCY training model. FCOM Chapter 13 reference parameters: 3000 psi nominal, 3500 psi maximum, and separate A/B/standby pumps. Timing, leak severity and caution thresholds are simulator estimates, NOT flight data.</p>'+
    '</aside></div>';
  document.body.append(dialog);
  frame=$('hydOriginalStage');frame.style.cssText='position:absolute;left:-'+OH.x+'px;top:-'+OH.y+
    'px;width:2220px;height:3312px;border:0;max-width:none;max-height:none;display:block';
  frame.addEventListener('load',connect);
  $('hydClose').onclick=()=>dialog.close();
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{
   disconnect();model=Core.loadPreset('healthy');preset='healthy';frame.removeAttribute('src');
  });
  photoIndicators();buildControls();buildFailureList();
  $('hydOH07Photo').style.backgroundImage='url("'+new URL('../../panel-mosaic-lab/assets/locked/2026-10-23/OH07-08-FLIGHT-NAV-c82458314584.png',document.baseURI).href+'")';
  $('hydBrake').onclick=()=>after([{type:'BRAKE',count:1}]);
  $('hydStep').onclick=()=>{model=Core.step(model,15);output=Core.evaluate(model);render();};
  $('hydLampTest').onclick=()=>{lampTest=!lampTest;render();};
  $('hydAck').onclick=()=>after([{type:'ACK'}]);
  $('hydRecall').onclick=()=>after([{type:'RECALL'}]);
  $('hydReset').onclick=()=>choosePreset('healthy');
  window.addEventListener('resize',crop);
 }
 function makeButton(info,parent,attribute){
  const b=document.createElement('button');b.type='button';
  b.setAttribute(attribute,info.id);b.setAttribute('aria-pressed','false');
  b.textContent=info.label;parent.append(b);return b;
 }
 function buildFailureList(){
  const pHost=$('hydPresetList'),fHost=$('hydFailureList');
  pHost.replaceChildren();fHost.replaceChildren();
  for(const cat of CATEGORY.slice(0,3)){
   const header=document.createElement('h4');header.textContent=cat.title;pHost.append(header);
   const list=document.createElement('div');list.className='hydlab-preset-grid';
   for(const s of Core.PRESETS.filter(p=>p.category===cat.name)){
    const b=makeButton(s,list,'data-hyd-preset');b.onclick=()=>choosePreset(s.id);
   }pHost.append(list);
  }
  for(const cat of CATEGORY.slice(3)){
   const header=document.createElement('h4');header.textContent=cat.title;fHost.append(header);
   const list=document.createElement('div');list.className='hydlab-fault-grid';
   for(const f of Core.FAULTS.filter(x=>x.category===cat.name)){
    const b=makeButton(f,list,'data-hyd-fault');b.onclick=()=>inject(f.id);
   }fHost.append(list);
  }
 }
 function buildControls(){
  const div=$('hydEnvironment');div.replaceChildren();
  const specs=[['eng1','ENGINE 1 RUNNING'],['eng2','ENGINE 2 RUNNING'],['ac1','AC BUS 1 AVAILABLE'],
   ['ac2','AC BUS 2 AVAILABLE'],['onGround','ON GROUND'],
   ['standbySelected','STANDBY RUD SELECTED'],['alternateFlapsArmed','ALT FLAPS ARM'],
   ['gearUpSelected','GEAR UP SELECTED'],['gearNotUpLocked','GEAR NOT UP/LOCKED'],
   ['fireHandle1','ENG 1 FIRE HANDLE PULLED'],['fireHandle2','ENG 2 FIRE HANDLE PULLED']];
  for(const [key,label] of specs){
   const row=document.createElement('label');
   const input=document.createElement('input');input.type='checkbox';input.dataset.hydEnv=key;
   input.onchange=()=>after([{type:'SET_ENV',id:key,value:input.checked}]);
   row.append(input,document.createTextNode(label));div.append(row);
  }
  const flaps=document.createElement('div');flaps.className='hydlab-flaps';
  for(const value of [0,5,15]){
   const b=document.createElement('button');b.type='button';b.dataset.hydFlaps=String(value);
   b.textContent='FLAPS '+value;b.onclick=()=>{
    model=Core.command(model,{type:'SET_ENV',id:'flapsDeg',value});
    lastReason='Manual flap configuration: '+value;output=Core.evaluate(model);render();
   };flaps.append(b);
  }
  div.append(flaps);
 }
 function renderPhotoLamps(){
  const doc=frameDoc;if(!ready||!doc?.head)return;
  let s=doc.getElementById('hydLabOriginalLampOverrideV1');
  if(!s){s=doc.createElement('style');s.id='hydLabOriginalLampOverrideV1';doc.head.append(s);}
  const ids=['hyd-eng-1','hyd-eng-2','hyd-elec-1','hyd-elec-2','hyd-elec-1-overheat','hyd-elec-2-overheat'];
  const css=[];
  for(const id of ids){
   const on=lampTest||output.lamps[id]===true,selector='.mounted-light[data-light="'+id+'"]';
   css.push(selector+' img.light-face{opacity:0!important;}');
   css.push(selector+' img.light-face[data-frame="'+(on?'ON':'OFF')+'"]{opacity:1!important;}');
  }
  s.textContent=css.join('\n');
 }
 function render(){
  if(!dialog||!dialog.open)return;
  const out=output;
  renderPhotoLamps();mark();special();
  const stats=$('hydStatusNumbers');
  if(stats){
   const vals=[
    ['SYSTEM A',out.pressurePsi.A+' psi'],['QTY A',out.quantityPct.A+' %'],
    ['SYSTEM B',out.pressurePsi.B+' psi'],['QTY B',out.quantityPct.B+' %'],
    ['STANDBY',out.pressurePsi.STBY+' psi'],['BRAKE ACCUM',out.pressurePsi.BRAKE+' psi'],
    ['BRAKES',out.brakes.mode.replaceAll('_',' ')]
   ];
   stats.replaceChildren(...vals.map(([k,v])=>{
    const n=document.createElement('div');n.className='hyd-stat';
    const l=document.createElement('small');l.textContent=k;
    const val=document.createElement('strong');val.textContent=v;n.append(l,val);return n;
   }));
  }
  const sp=$('hydLiveSixPack');
  if(sp){
   if(!sp.querySelector('[data-hyd-six-legend]')){
    sp.replaceChildren();
    const header=document.createElement('span');header.textContent='FIRST OFFICER SIX-PACK · ORIGINAL ANNUNCIATOR STYLE';sp.append(header);
    const pieces=document.createElement('div');pieces.className='hydlab-sixpack-physical';
    const glass=document.querySelector('.b737-sp-legend[data-sixpack="FO.HYD"]')?.cloneNode(true)||
      document.createElement('span');
    glass.classList.add('b737-sp-legend');glass.dataset.hydSixLegend='true';
    glass.dataset.on='false';glass.textContent='HYD';
    const caution=document.querySelector('.b737-sp-master.caution[data-sixpack="FO.MASTER CAUTION"]')?.cloneNode(true)||
      document.createElement('span');
    caution.classList.add('b737-sp-master','caution');caution.dataset.hydSixCaution='true';
    caution.dataset.on='false';caution.setAttribute('aria-hidden','true');
    if(!caution.textContent)caution.textContent='MASTER CAUTION';
    pieces.append(glass,caution);sp.append(pieces);
    const detail=document.createElement('small');detail.dataset.hydSixStatus='true';sp.append(detail);
   }
   const six=sp.querySelector('[data-hyd-six-legend]'),master=sp.querySelector('[data-hyd-six-caution]');
   if(six)six.dataset.on=String(out.alerts.sixPackHyd||lampTest);
   if(master)master.dataset.on=String(out.alerts.masterCaution||lampTest);
   const detail=sp.querySelector('[data-hyd-six-status]');
   if(detail)detail.textContent='HYD '+(out.alerts.sixPackHyd?'AMBER ON':'OFF')+
    ' · MASTER CAUTION '+(out.alerts.masterCaution?'ON':'OFF')+
    ' · RECALL '+(out.alerts.recallHyd?'HYD':'CLEAR')+
    ' · '+out.alerts.masterCautionAuthority;
  }
  for(const def of NEEDLES)renderGauge(def,out);
  const standby=$('hydStandbyLamps');if(standby){
   standby.replaceChildren();
   for(const id of ['flight-pressure-a','flight-pressure-b','stby-pressure','stby-quantity','stby-rudder']){
    const n=document.createElement('span');n.dataset.on=String(out.lamps[id]||lampTest);
    n.textContent=id.toUpperCase().replaceAll('-',' ')+' · '+(out.lamps[id]?'ON':'OFF');standby.append(n);
   }
  }
  const consumers=$('hydDownstream');
  if(consumers&&out.capabilities){
   const cap=out.capabilities;
   const descriptions=[
    ['FLIGHT CONTROLS · A',cap.flightControls.A],
    ['FLIGHT CONTROLS · B',cap.flightControls.B],
    ['MANUAL REVERSION',cap.flightControls.manualReversion],
    ['AUTOPILOT A',cap.autopilot.A],['AUTOPILOT B',cap.autopilot.B],
    ['NORMAL LANDING GEAR',cap.gearNormal],
    ['NOSEWHEEL STEERING',cap.nosewheelSteering],
    ['YAW DAMPER HYD',cap.yawDamper],
    ['BRAKE ANTISKID',cap.antiskid],
    ['ALTERNATE FLAPS',cap.alternateFlaps],
    ['THRUST REVERSER 1',cap.reverser1],['THRUST REVERSER 2',cap.reverser2],
    ['PTU AVAILABLE',cap.ptu.available],['PTU ACTIVE',cap.ptu.active],
    ['LGTU AVAILABLE',cap.lgtu.available],['LGTU ACTIVE',cap.lgtu.active],
    ['SYS A FLUID OVERHEAT',cap.fluidOverheat.A],
    ['SYS B FLUID OVERHEAT',cap.fluidOverheat.B]
   ];
   consumers.replaceChildren(...descriptions.map(([name,value])=>{
    const el=document.createElement('span');el.textContent=name+' · '+(value?'YES':'NO');
    el.dataset.ok=String(value);return el;
   }));
  }
  for(const input of dialog.querySelectorAll('[data-hyd-env]'))input.checked=!!model.env[input.dataset.hydEnv];
  for(const b of dialog.querySelectorAll('[data-hyd-flaps]'))
   b.setAttribute('aria-pressed',String(Number(b.dataset.hydFlaps)===model.env.flapsDeg));
  $('hydLampTest').setAttribute('aria-pressed',String(lampTest));
 }
 function crop(){
  const box=$('hydLiveCrop'),canvas=$('hydLiveCanvas');
  if(!box||!canvas)return;
  const w=Math.min(box.clientWidth,750);
  const scale=Math.min(w/OH.w,2);
  const rendered=Math.max(1,scale);
  box.style.height=(OH.h*rendered)+'px';
  canvas.style.width=OH.w+'px';canvas.style.height=OH.h+'px';
  canvas.style.transform='scale('+rendered+')';
 }
 function connect(){
  if(!dialog?.open)return false;
  let win,doc;
  try{win=frame?.contentWindow;doc=frame?.contentDocument;}catch{return false;}
  if(!win?.B737OverheadToggles?.getState||!win?.B737OverheadLights?.getState||
   !doc?.querySelector('#atlasAbsolute .atlas-piece[data-key="OH17"]'))return false;
  if(ready&&frameDoc===doc)return true;
  ready=true;frameDoc=doc;bound=true;
  win.addEventListener('b737:switch-change',e=>{
   if(pauseSync||!Core.PUMP[e.detail?.id]||!['ON','OFF'].includes(e.detail.next))return;
   model=Core.command(model,{type:'SET_SWITCH',id:e.detail.id,value:e.detail.next});
   preset='manual';lastReason='Physical OH17: '+e.detail.id+' '+e.detail.next;output=Core.evaluate(model);render();
  });
  syncAll();render();return true;
 }
 function disconnect(){
  ready=false;frameDoc=null;bound=false;lampTest=false;
  if(timer!==null){clearInterval(timer);timer=null;}
 }
 function tick(){
  if(!dialog?.open)return;
  if(!ready)connect();
  const now=performance.now(),elapsed=Math.max(0,Math.min(.35,(now-lastAt)/1000));lastAt=now;
  if(elapsed>0){
   model=Core.step(model,elapsed);output=Core.evaluate(model);render();
  }
 }
 function open(){
  if(!dialog)build();
  if(dialog.open)return true;
  choosePreset('healthy');
  dialog.showModal();
  const url=new URL(document.getElementById('overheadFrame')?.getAttribute('src')||
    './overhead-stage.html',document.baseURI);
  url.searchParams.set('hydTestLab','1');frame.src=url.href;
  crop();lastAt=performance.now();
  timer=setInterval(tick,125);
  output=Core.evaluate(model);render();
  return true;
 }
 window.addEventListener('b737:ata26-panel-state',e=>{
  const state=e.detail.state;
  const actions=[1,2].filter(n=>model.env['fireHandle'+n]!==state.handles['ENG'+n].pulled)
   .map(n=>({type:'SET_ENV',id:'fireHandle'+n,value:state.handles['ENG'+n].pulled}));
  if(actions.length)after(actions);
 });
 window.B737HydraulicLabV1=Object.freeze({
  open,getState:()=>Core.clone(model),getOutput:()=>output,
  presets:Core.PRESETS,faults:Core.FAULTS,choosePreset,inject,
  command:c=>{model=Core.command(model,c);output=Core.evaluate(model);render();return output;},
  simulate:seconds=>{model=Core.step(model,seconds);output=Core.evaluate(model);render();return output;},
  pressureAngle,brakeAngle,getGaugeCalibration:id=>Cal.gauge(id),version:'HYD-LAB-UI-0003'
 });
})();

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./overhead-test-labs-v1.js?v=OH-LABS-AIRCON-0001 */
try{
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
