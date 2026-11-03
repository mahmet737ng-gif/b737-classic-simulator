/* HYD-LAB-UI-0001
 * Independent FCOM-oriented system lab: one native OH17 photo panel,
 * independently animated actual engine hydraulic dial photo layers,
 * genuine switch event routing and 61+ explicit selectable failures.
 * No top-level cockpit visual edit, and no claimed production ECU authority.
 */
(function(){'use strict';
 const Core=window.B737ClassicHydraulicLabCoreV1;
 if(!Core)return;
 const OH={x:1231,y:1818,w:493,h:283};
 const PHOTO_ENGINE='../../panel-mosaic-lab/assets/locked/2026-10-23/B737_Engine_Standby_Instruments_Blank.png';
 const PHOTO_BRAKE='./assets/B737_Right_Main_Instruments_GPWS_TERRAIN_LEFT_V3.png';
 const NEEDLES=Object.freeze([
  {id:'A',title:'HYD SYSTEM A · PRESS',p:{x:1050,y:1037},photo:PHOTO_ENGINE,native:{w:1235,h:1274},face:'eng.hyd_pressure.a'},
  {id:'B',title:'HYD SYSTEM B · PRESS',p:{x:1174,y:1037},photo:PHOTO_ENGINE,native:{w:1235,h:1274},face:'eng.hyd_pressure.b'},
  {id:'BRAKE',title:'BRAKE ACCUMULATOR · PRESS',p:{x:473,y:568},photo:PHOTO_BRAKE,native:{w:918,h:1713},face:'fo.hyd_brake_pressure'}
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
  const wrap=document.createElement('div');wrap.className='hyd-native-wrap';
  const size=176,scale=1,half=88,anchor=def.p;
  // Native photo registration from the locked cockpit image.
  // The candidate pivot coordinates are provisional, not certified.
  const left=Math.max(0,Math.min(def.native.w-size,anchor.x-half));
  const top=Math.max(0,Math.min(def.native.h-size,anchor.y-half));
  const img=document.createElement('div');img.className='hyd-native-image';
  Object.assign(img.style,{width:size+'px',height:size+'px',backgroundImage:'url("'+
   new URL(def.photo,document.baseURI).href+'")',backgroundSize:def.native.w+'px '+def.native.h+'px',
   backgroundPosition:-left+'px '+(-top)+'px'});
  wrap.append(img);
  const x=anchor.x-left,y=anchor.y-top;
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
  svg.setAttribute('viewBox','0 0 176 176');svg.classList.add('hyd-native-needle');
  const g=document.createElementNS('http://www.w3.org/2000/svg','g');g.setAttribute('data-hyd-rotor',def.id);
  // Original source photo has the real bezel/printed graduations, while
  // only the original blanked pointer aperture receives this slender overlay.
  const line=document.createElementNS('http://www.w3.org/2000/svg','line');
  for(const [k,v] of Object.entries({x1:x,y1:y,x2:x,y2:y-45,stroke:'#e6e5d8','stroke-width':2.8,'stroke-linecap':'round'}))line.setAttribute(k,String(v));
  const tip=document.createElementNS('http://www.w3.org/2000/svg','circle');
  for(const [k,v] of Object.entries({cx:x,cy:y,r:3.1,fill:'#e1dfd1',stroke:'#1b232b','stroke-width':1}))tip.setAttribute(k,String(v));
  g.append(line,tip);svg.append(g);wrap.append(svg);
  return wrap;
 }
 function renderGauge(def,out){
  const c=$('hydGauge'+def.id),v=out.indications[def.face];
  if(!c)return;
  const reading=c.querySelector('[data-hyd-reading]');
  if(reading)reading.textContent=v===null?'SENSOR FAIL / NO DATA':v+' PSI';
  const qty=c.querySelector('[data-hyd-qty]');
  if(qty){
   const q=out.indications['eng.hyd_qty.'+def.id.toLowerCase()];
   qty.textContent=q===null?'QTY SENSOR FAIL':q+' % FULL';
  }
  const rotor=c.querySelector('[data-hyd-rotor]'),value=(typeof v==='number'?v:0);
  // Face printed 0..4 x1000 psi; approx clockwise positions read from the
  // unmodified source photo. Numerical values are authoritative LAB values,
  // shaft angle awaiting owner-confirmed pixel calibration.
  const angle=75+clamp(value/4000,0,1)*245+90;
  if(rotor){const point=def.p,cropX=Math.max(0,Math.min(def.native.w-176,point.x-88)),
    cropY=Math.max(0,Math.min(def.native.h-176,point.y-88));
   rotor.setAttribute('transform','rotate('+angle.toFixed(2)+' '+(point.x-cropX)+' '+(point.y-cropY)+')');
   rotor.style.opacity=v===null?'.20':'1';
  }
  c.dataset.degraded=String(v===null);
 }
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
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
   const note=document.createElement('small');note.className='hyd-gauge-note';note.textContent='Original photo · live trainer value · needle mounting provisional';
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
    '<h3>FLIGHT CONTROL / STANDBY HYD · OH07</h3><div id="hydStandbyLamps" class="hydlab-standby"></div>'+
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
   ['fireHandle1','ENG 1 FIRE HANDLE PULLED'],['fireHandle2','ENG 2 FIRE HANDLE PULLED']];
  for(const [key,label] of specs){
   const row=document.createElement('label');
   const input=document.createElement('input');input.type='checkbox';input.dataset.hydEnv=key;
   input.onchange=()=>after([{type:'SET_ENV',id:key,value:input.checked}]);
   row.append(input,document.createTextNode(label));div.append(row);
  }
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
   sp.dataset.on=String(out.alerts.sixPackHyd||lampTest);
   sp.textContent='FO SIX-PACK · HYD '+(out.alerts.sixPackHyd||lampTest?'AMBER ON':'OFF')+
    ' · MASTER CAUTION '+(out.alerts.masterCaution?'ON': 'OFF')+' · RECALL '+(out.alerts.recallHyd?'HYD':'CLEAR')+
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
  for(const input of dialog.querySelectorAll('[data-hyd-env]'))input.checked=!!model.env[input.dataset.hydEnv];
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
 window.B737HydraulicLabV1=Object.freeze({
  open,getState:()=>Core.clone(model),getOutput:()=>output,
  presets:Core.PRESETS,faults:Core.FAULTS,choosePreset,inject,
  command:c=>{model=Core.command(model,c);output=Core.evaluate(model);render();return output;},
  simulate:seconds=>{model=Core.step(model,seconds);output=Core.evaluate(model);render();return output;},
  version:'HYD-LAB-UI-0001'
 });
})();
