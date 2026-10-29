/* Unified Window Heat bridge. Additive only: reads the actual OH15 switches,
 * Electrical V7 authority and persisted CB Lab pulls; paints existing lamps in
 * place without changing a pixel or event handler of the frozen overhead atlas.
 */
(function(){'use strict';
 const Core=window.B737WindowHeatV1;if(!Core){console.error('Window Heat core unavailable');return;}
 const CB_KEY='b737classic.cb.v1',FAULT_KEY='b737.windowheat.faults.v1',TRAIN_KEY='b737.windowheat.training-power.v1';
 const TRAIN_BUSES=Object.freeze({generator1:true,generator2:true,main1:true,main2:true,dc1:true,dc2:true});
 // The cockpit starts COLD & DARK, so keep an isolated Window Heat
 // training supply enabled by default to preserve panel/switch practice.
 // The user can explicitly turn it OFF to require aircraft AC/DC power.
 let trainingPower=true;
 try{trainingPower=localStorage.getItem(TRAIN_KEY)!=='0';}catch{}
 // This supply energizes Window Heat only; it never changes aircraft buses,
 // closes CBs, or masks controller/heater/sensor/overheat failures.
 let s=Core.initialState(),last=null,lastAt=performance.now(),child=null,previousCaution=null;
 let faults={};try{faults=JSON.parse(localStorage.getItem(FAULT_KEY)||'{}')||{};}catch{}
 for(const [ch,f] of Object.entries(faults)){if(!Core.CHANNELS[ch]||!f||typeof f!=='object')continue;
  for(const id of Core.FAULTS)if(typeof f[id]==='boolean')s=Core.injectFault(s,ch,id,f[id]);
 }
 function breaks(){
  const result={};try{const x=JSON.parse(localStorage.getItem(CB_KEY)||'{}');for(const b of x.breakers||[])if(b.pulled||b.tripped)result[b.id]=false;}catch{}return result;
 }
 function switches(){try{return document.getElementById('overheadFrame')?.contentWindow?.B737OverheadToggles?.getState?.()||{};}catch{return {};}}
 function buses(){try{
  const p=window.B737ISNCockpitV1;
  // The chain.get() result exposes Electrical V7 BUS fields directly under
  // .electrical. The alternate ISN bridge returns state.electrical.bus.
  // Never incorrectly expect chain.get().electrical.bus.
  const fromStart=p?.getStartState?.()?.electrical;
  if(fromStart&&typeof fromStart==='object'&&Object.prototype.hasOwnProperty.call(fromStart,'generator1'))return fromStart;
  const fromBridge=p?.getState?.()?.state?.electrical?.bus;
  return fromBridge&&typeof fromBridge==='object'?fromBridge:null;
 }catch{return null;}}
 function applyLamps(out){
  const iframe=document.getElementById('overheadFrame');
  let doc;try{doc=iframe?.contentDocument;}catch{return;}
  if(!doc||doc.documentElement.classList.contains('cockpit-visual-test')||iframe?.contentWindow?.B737OverheadLights?.getState?.()?.lampTest)return;
  const lamps={};
  for(const x of Object.values(out.channels)){
   lamps[Core.CHANNELS[x.id].onId]=x.greenOn;
   lamps[Core.CHANNELS[x.id].ovhtId]=x.overheatOn;
  }
  // This is the stable projection owned by overhead-bridge, layered AFTER
  // both LGT's internal display and ISN projections. It is resent while
  // the live engine is running to recover frame reload/ready races.
  try{iframe.contentWindow?.postMessage({type:'b737:cockpit-command',
   action:'window-heat-projection',lamps,annunciations:out.annunciations},location.origin);}catch{}
  // Immediate DOM fallback, including frames before the projection bridge
  // becomes ready. Never alter approved source art or lamp dimensions.
  for(const [id,on] of Object.entries(lamps)){
   const el=doc.querySelector('.mounted-light[data-light="'+id+'"]');if(!el)continue;
   const frame=on?'ON':'OFF';
   for(const face of el.querySelectorAll('.light-face'))face.classList.toggle('active',face.dataset.frame===frame);
   el.dataset.frame=frame;el.dataset.state=frame;el.dataset.windowHeatEngine='v1';
   el.setAttribute('aria-label',id+' — '+frame+' (Window Heat engine)');
  }
 }

 function diagnosticPower(b){
  const keys=['generator1','generator2','main1','main2','dc1','dc2'];
  const off=keys.filter(k=>b?.[k]===false),unknown=keys.filter(k=>b?.[k]!==true&&b?.[k]!==false);
  return {liveBuses:b||null,off,unknown,mode:trainingPower?'WINDOW_HEAT_TRAINING_SUPPLY':'AIRCRAFT_ELECTRICAL',
   explanation:trainingPower?'TRAINING POWER ON · ONLY WINDOW HEAT · CBs and faults remain active'
     :!b?'AIRCRAFT ELECTRICAL STATE NOT READY'
     :off.length||unknown.length?'WINDOW HEAT FEED INCOMPLETE · OFF: '+(off.join(', ')||'none')+' · UNKNOWN: '+(unknown.join(', ')||'none')
     :'WINDOW HEAT AC/DC FEEDS AVAILABLE'};
 }
 function draw(out){
  if(!ui)return;
  const live=buses(),power=diagnosticPower(live);
  const powerStatus=ui.querySelector('#wh-power-status');
  if(powerStatus)powerStatus.textContent=power.explanation;
  const status=ui.querySelector('#wh-status');
  status.textContent=Object.keys(out.channels).map(id=>{const v=out.channels[id];return id.replace('_',' ')+' '+(v.overheatOn?'OVHT':v.greenOn?'ON':v.selected?'STBY/OFF':'OFF');}).join(' · ')+
   ' | ANTI-ICE '+(out.annunciations.antiIceCaution?'CAUTION':'NORMAL');
  for(const id of ['wh-caution-master','wh-caution-anti-ice']){
   const node=ui.querySelector('#'+id);if(node){const on=out.annunciations.antiIceCaution;node.textContent=id==='wh-caution-master'?'MASTER CAUTION':'ANTI-ICE';node.style.background=on?'#b67a18':'#26323b';node.style.color=on?'#fff0c5':'#889eaa';node.style.borderColor=on?'#f1b547':'#42525f';node.dataset.active=String(on);}
  }
  const rows=ui.querySelector('#wh-rows');rows.replaceChildren();
  for(const [id,v]of Object.entries(out.channels)){
   const tr=document.createElement('tr');
   for(const val of [id,v.selected?'ON':'OFF',v.controllerPower?'YES':'NO',v.heaterPower?'HEAT':'OFF',v.temperatureC+'°C',v.greenOn?'ON':'OFF',v.overheatOn?'OVHT':'OFF']){
    const td=document.createElement('td');td.textContent=val;td.style.padding='3px 5px';td.style.borderBottom='1px solid #566';tr.append(td);
   }rows.append(tr);
  }
  ui.querySelector('#wh-aux').textContent=Object.entries(out.aux).map(([id,v])=>id+': '+(v.heaterPower?'HEAT':'OFF')+' / CB '+(v.cbClosed?'IN':'OUT')).join(' · ');
 }
 let ui=null;
 function makeUI(){
  const anchor=document.querySelector('.overhead-tools')||document.querySelector('#inspector');if(!anchor)return;
  ui=document.createElement('details');ui.id='windowHeatTrainingV1';ui.dir='ltr';
  ui.style.cssText='margin-top:12px;padding:10px;border:1px solid #657383;border-radius:8px;color:inherit;font:12px/1.5 sans-serif';
  ui.innerHTML='<summary style="cursor:pointer;font-weight:700">WINDOW HEAT · Live System / Failure Test</summary>'+
   '<p style="font-size:12px">Real OH15 switches + Electrical V7 + CB Panel Lab. FCOM 3/SP.3 generic training.</p>'+\n   '<p style="font-size:12px">POWER TEST checks all four green ON lamps even when the window switches are OFF. A failed feed, CB, controller or test circuit keeps its channel dark. OVERHEAT TEST behavior is unchanged.</p>'+
   '<p id="wh-status" role="status">Connecting overhead and electrical engine…</p>'+
   '<label style="display:flex;align-items:center;gap:7px;padding:8px;border:1px solid #647785;border-radius:5px"><input id="wh-training-power" type="checkbox" aria-label="Enable training power for Window Heat only"> WINDOW HEAT TRAINING POWER · AC/DC (demo only)</label>'+
   '<p id="wh-power-status" role="status" style="font-size:11px">Checking real AC/DC buses…</p>'+
   '<div style="display:flex;gap:8px;margin:8px 0 12px 0"><span id="wh-caution-master" style="padding:5px 9px;border:1px solid #42525f;border-radius:4px;font-weight:700">MASTER CAUTION</span><span id="wh-caution-anti-ice" style="padding:5px 9px;border:1px solid #42525f;border-radius:4px;font-weight:700">ANTI-ICE</span></div>'+
   '<div style="overflow-x:auto"><table style="font-size:11px;width:100%;border-collapse:collapse"><thead><tr><th>CH</th><th>SW</th><th>CTRL</th><th>POWER</th><th>TEMP</th><th>GREEN</th><th>OVHT</th></tr></thead><tbody id="wh-rows"></tbody></table></div>'+
   '<p id="wh-aux"></p>'+
   '<div style="display:flex;flex-wrap:wrap;gap:5px"><select id="wh-channel" aria-label="Window channel"><option value="L_FWD">L FWD</option><option value="L_SIDE">L SIDE</option><option value="R_FWD">R FWD</option><option value="R_SIDE">R SIDE</option></select>'+
   '<select id="wh-fault" aria-label="Failure"><option value="HEATER_FAIL">Heater fail</option><option value="CONTROLLER_FAIL">Controller fail</option><option value="SENSOR_FAIL">Sensor fail</option><option value="STUCK_OVERHEAT">Stuck OVHT</option><option value="POWER_TEST_FAIL">Power test fail</option></select>'+
   '<button type="button" id="wh-inject">Inject fault</button><button type="button" id="wh-clear">Clear fault</button><button type="button" id="wh-reset">Reset WH</button></div>'+
   '<p style="font-size:11px"><a href="../../cb-panel-lab/" target="_blank" rel="noopener">Open CB panels P6-11 / P6-12 / P18-3</a> (same browser origin; pulls sync live). Test POWER and OVHT with the real centre spring switch.</p>';
  const lab=document.createElement('dialog');lab.id='windowHeatTestLabDialog';lab.dir='rtl';
  lab.style.cssText='width:min(980px,94vw);max-width:980px;max-height:90vh;overflow:auto;padding:14px;background:#101f2b;color:#e1ecf4;border:1px solid #79d5df;border-radius:12px;box-shadow:0 18px 70px #000b';
  lab.innerHTML='<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px"><strong style="font-size:16px;letter-spacing:.4px">WINDOW HEAT · TEST LAB</strong><button type="button" id="wh-lab-close" aria-label="Close Window Heat Test Lab">بستن ×</button></div>'+
   '<p style="margin:0 0 10px;color:#9bb1c2;font-size:12px">برای ورود، روی عنوان «کاکپیت یکپارچه» سه بار پشت سر هم کلیک یا تپ کن. این آزمایشگاه فقط سیستم Window Heat را بررسی می‌کند.</p>';
  lab.append(ui);ui.open=true;document.body.append(lab);
  lab.querySelector('#wh-lab-close').onclick=()=>lab.close();
  lab.addEventListener('click',e=>{if(e.target===lab)lab.close();});
  const trigger=document.querySelector('#inspector h1');
  if(trigger){
   trigger.title='سه کلیک/تپ پشت سر هم برای بازکردن آزمایشگاه Window Heat';
   trigger.style.userSelect='none';
   let tapCount=0,lastTap=0,resetTapTimer=null;
   trigger.addEventListener('click',()=>{
    const now=performance.now();tapCount=now-lastTap<=1200?tapCount+1:1;lastTap=now;
    clearTimeout(resetTapTimer);resetTapTimer=setTimeout(()=>{tapCount=0;},1200);
    if(tapCount>=3){tapCount=0;clearTimeout(resetTapTimer);if(!lab.open)lab.showModal();}
   });
  }
  const trainingCheckbox=ui.querySelector('#wh-training-power');
  trainingCheckbox.checked=trainingPower;
  trainingCheckbox.onchange=()=>setTrainingPower(!!trainingCheckbox.checked);
  const controls=()=>[ui.querySelector('#wh-channel').value,ui.querySelector('#wh-fault').value];
  ui.querySelector('#wh-inject').onclick=()=>{const [ch,f]=controls();fault(ch,f,true);};
  ui.querySelector('#wh-clear').onclick=()=>{const [ch,f]=controls();fault(ch,f,false);};
  ui.querySelector('#wh-reset').onclick=()=>{s=Core.initialState();faults={};saveFaults();tick(0);};
 }
 function saveFaults(){try{localStorage.setItem(FAULT_KEY,JSON.stringify(faults));}catch{}}
 function setTrainingPower(active){
  if(typeof active!=='boolean')throw Error('Window Heat training power expects boolean');
  trainingPower=active;
  try{localStorage.setItem(TRAIN_KEY,active?'1':'0');}catch{}
  const control=ui?.querySelector('#wh-training-power');if(control)control.checked=active;
  tick(0);
  return diagnosticPower(buses());
 }
 function fault(channel,id,active){
  s=Core.injectFault(s,channel,id,active);
  if(!faults[channel])faults[channel]={};faults[channel][id]=active;saveFaults();tick(0);
 }
 function tick(forcedSeconds){
  // Wall-clock time is important for the 60-second OVERHEAT test.
  // If the CB tab is active or this tab is briefly background-throttled,
  // catch up using elapsed real time rather than delaying the expiry.
  const now=performance.now(),dt=typeof forcedSeconds==='number'?forcedSeconds:Math.min(300,Math.max(0,(now-lastAt)/1000));lastAt=now;
  const live=buses(),b=trainingPower?TRAIN_BUSES:live,sw=switches();if(!b||!Object.keys(sw).length){
   if(ui)ui.querySelector('#wh-status').textContent='WAITING FOR LIVE ELECTRICAL / OVERHEAD AUTHORITY';
   return;
  }
  const r=Core.step(s,{buses:b,switches:sw,breakers:breaks()},dt);s=r.state;last=r.output;
  last.powerDiagnostic=diagnosticPower(live);
  last.powerDiagnostic.effectiveBuses={...b};
  applyLamps(last);draw(last);
  if(previousCaution!==last.annunciations.antiIceCaution){
   previousCaution=last.annunciations.antiIceCaution;
   window.dispatchEvent(new CustomEvent('b737:window-heat-annunciations',{detail:last.annunciations}));
  }
 }
 function linkOverhead(){
  let w;try{w=document.getElementById('overheadFrame')?.contentWindow;}catch{}
  if(w&&w!==child){
   child=w;
   w.addEventListener('b737:switch-change',e=>{if(e.detail?.id?.startsWith('window-'))tick(0);});
   w.addEventListener('b737:overhead-light-state',()=>{if(last)applyLamps(last);});
  }
 }
 function boot(){makeUI();linkOverhead();setInterval(()=>{linkOverhead();tick();},250);window.addEventListener('storage',e=>{if(e.key===CB_KEY)tick(0);if(e.key===FAULT_KEY){try{const next=JSON.parse(e.newValue||'{}');for(const ch of Object.keys(Core.CHANNELS))for(const f of Core.FAULTS)s=Core.injectFault(s,ch,f,!!next?.[ch]?.[f]);faults=next;}catch{}tick(0);}});}
 window.B737WindowHeatUnifiedV1=Object.freeze({getState:()=>s,getOutput:()=>last,
  getPowerDiagnostic:()=>diagnosticPower(buses()),setTrainingPower,injectFault:fault,
  reset:()=>{s=Core.initialState();faults={};saveFaults();tick(0);},
  evaluate:()=>tick(0),matchedCBs:Core.ALL_CBS});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
