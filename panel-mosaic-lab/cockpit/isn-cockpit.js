(function(){
 'use strict';
 const moduleBase=document.currentScript.src;
 const deps=[
  ['B737PneumaticsV6','../../engine/systems/pneumatics-v6.js'],
  ['B737ISNEngineAPUV1','../../engine/integration/isn-engine-apu-v1.js'],
  ['B737ISNStartSequenceV1','../../engine/integration/isn-start-sequence-v1.js'],
  ['B737ISNAPUStartChainV1','../../engine/integration/isn-apu-start-chain-v1.js']
 ];
 async function loadDependencies(){for(const [global,path] of deps){if(window[global])continue;
  await new Promise((resolve,reject)=>{const script=document.createElement('script');
   script.src=new URL(path,moduleBase).href+'?v=ISN-0003';script.onload=resolve;
   script.onerror=()=>reject(Error('Missing integration script '+path));document.head.append(script);});
 }}
 function init(){
 const byId=id=>document.getElementById(id);
 const Pack=window.B737ISNElectricalPackV1,Adapter=window.B737ISNCockpitBridgeV1;
 if(!Pack||!Adapter){console.error('ISN-02: missing integration modules');return;}
 const startSession=new window.B737ISNStartSequenceV1.Session({
  EngineAPU:window.B737ISNEngineAPUV1,ElectricalPack:Pack,
  Electrical:window.B737ElectricalV7,Loads:window.B737ElectricalLoadsV8,
  TrainerCore:window.B737TrainerCore,WarningEngine:window.B737WarningEngine.WarningEngine,
  Pneumatics:window.B737PneumaticsV6});
 const chain=new window.B737ISNAPUStartChainV1.Chain(startSession);
 const session=startSession.core.pack;
 const bridge=new Adapter.Bridge(session,{sourceOwner:'ISN03_START_SESSION'});
 const pendingEvents=[];
 const panel=document.createElement('section');panel.className='isn-bridge-panel';panel.id='isnBridgePanel';
 panel.innerHTML='<h2>ISN-02 · شبکهٔ زندهٔ کابین</h2><p id="isnStatus" role="status">منتظر وضعیت سوییچ‌های اورهد…</p><p class="isn-note">خروجی Source-Gated مستند است؛ منبع دقیق تغذیهٔ ۸ پمپ هنوز تأیید نشده و UNKNOWN باقی می‌ماند. وضعیت‌های آموزشی به‌صورت مجزا مشخص‌اند.</p><button id="isnMode" type="button" aria-pressed="false">Training Surrogate · خاموش</button><div class="isn-buses" id="isnBuses"></div><details><summary>کنترل‌های مربی · بدون سوییچ فیزیکی</summary><label class="isn-setting"><input type="checkbox" id="isnBusTransfer" checked> BUS TRANSFER AUTO (فقط تست؛ سوییچ در رجیستری نیست)</label><label class="isn-setting"><input type="checkbox" id="isnGen1Fault"> GEN 1 FAILED · تزریق مربی</label><label class="isn-setting"><input type="checkbox" id="isnGen2Fault"> GEN 2 FAILED · تزریق مربی</label><button id="isnReset" type="button">بازنشانی موتور ISN بر اساس وضعیت فعلی کابین</button></details><div class="isn-scroll"><table class="isn-table"><thead><tr><th>سوییچ / چراغ واقعی</th><th>RUN</th><th>LOW PRESS</th><th>Power Evidence</th><th>تست مربی</th></tr></thead><tbody id="isnPumpRows"></tbody></table></div><div class="isn-warnings" id="isnWarnings"></div><details><summary>ردگیری فرمان → سیستم → چراغ / هشدار</summary><div id="isnTrace" class="isn-trace" dir="ltr"></div></details><p id="isnError" class="isn-error" role="status"></p>';
 const trainer=document.createElement('details');trainer.innerHTML='<summary>هشدارهای مستند · ورودی سناریوی مربی</summary><label class="isn-setting"><input id="isnFire1" type="checkbox"> ENGINE 1 FIRE · ورودی آزمایشی</label><label class="isn-setting"><input id="isnCabinHigh" type="checkbox"> CABIN ALTITUDE 12000 ft · ورودی آزمایشی</label><button id="isnAckFire" type="button">Fire Bell Acknowledge</button><button id="isnCutoutCabin" type="button">Cabin Horn Cutout</button>';
 panel.querySelector('.isn-warnings').after(trainer);
 const replayButton=document.createElement('button');replayButton.id='isnReplay';replayButton.type='button';replayButton.textContent='بازپخش قطعی رویدادهای ISN';
 panel.querySelector('#isnTrace').after(replayButton);
 const startPanel=document.createElement('details');startPanel.open=true;startPanel.className='isn-start-panel';startPanel.innerHTML='<summary>ISN-03 · APU → BLEED + ELECTRICAL → ENGINE START</summary><p class="isn-note">مسیر تعاملی از سوییچ‌های واقعی اورهد است. زمان‌های کوتاه APU/N2 فقط نقاط آموزشی شبیه‌سازی‌اند، نه دادهٔ واقعی هواپیما. بعد از START، ژنراتور APU و Bleed باید با سوییچ‌های خودشان انتخاب شوند؛ PACK L/R روی OFF باشد.</p><div id="isnStartStatus" role="status" dir="ltr">Waiting for overhead…</div><p class="isn-lever-instruction">برای بازکردن Fuel / Start Lever هر موتور، روی اهرم همان موتور در پایینِ Throttle Quadrant در پدستال کلیک کن. حرکت به IDLE فقط پس از موتورینگ و رسیدن به N2 مناسب پذیرفته می‌شود؛ کلیک بعدی CUTOFF می‌کند.</p><p id="isnStartLeverStatus" class="isn-lever-status" role="status" dir="ltr">ENG 1 CUTOFF · ENG 2 CUTOFF</p><p id="isnStartError" class="isn-error" role="alert"></p><a href="../../isn-start-sequence-lab/">باز کردن آزمایشگاه مستند ISN-03 ↗</a>';
 panel.querySelector('.isn-note').after(startPanel);
 const anchor=document.querySelector('.aircraft-profile-summary');if(anchor)anchor.after(panel);else byId('inspector').prepend(panel);
 const node=new Map();
 const stateName=v=>v===null?'UNKNOWN':v?'ON':'OFF';
 const span=(v)=>{const n=document.createElement('span');n.className='isn-state '+(v===null?'unknown':v?'on':'off');n.textContent=stateName(v);return n;};
 const setter=(id,v)=>{const el=byId(id);el.replaceChildren(span(v));};
 for(const pump of Pack.PUMP_REGISTRY){
  const lamp=Adapter.LAMPS[pump.id],tr=document.createElement('tr');tr.dataset.pump=pump.id;
  const name=document.createElement('td');name.dir='ltr';name.textContent=lamp+' / '+pump.label;
  const run=document.createElement('td'),low=document.createElement('td'),evidence=document.createElement('td');evidence.className='isn-evidence';evidence.dir='ltr';
  const teacher=document.createElement('td'),fault=document.createElement('label');fault.className='isn-fault';
  const faultInput=document.createElement('input');faultInput.type='checkbox';faultInput.setAttribute('aria-label','Instructor failure '+pump.label);fault.append(faultInput,' FAIL');
  const observed=document.createElement('select');observed.setAttribute('aria-label','Observed power '+pump.label);
  for(const [value,label]of [['null','Power ?'],['true','Power ON'],['false','Power OFF']]){const o=document.createElement('option');o.value=value;o.textContent=label;observed.append(o);}
  faultInput.onchange=e=>{bridge.instructor({type:'PUMP_FAULT',id:pump.id,value:e.target.checked,instructor:true});render();};
  observed.onchange=e=>{bridge.instructor({type:'OBSERVED_POWER',id:pump.id,value:e.target.value==='null'?null:e.target.value==='true',instructor:true});render();};
  teacher.append(fault,observed);tr.append(name,run,low,evidence,teacher);byId('isnPumpRows').append(tr);
  node.set(pump.id,{run,low,evidence,faultInput,observed});
 }
 const indicator=(label,value)=>{const n=document.createElement('div');const s=document.createElement('small');s.textContent=label;n.append(s,span(value));return n;};
 let lastLampProjection='',lastStartInputs='';
 function renderStart(){const s=chain.get();
  const summary=['APU '+s.phase.apu,'ENG1 '+s.phase.engine1,'ENG2 '+s.phase.engine2,
   'APU GEN '+(Object.values(s.selectedSources).includes('APU')?'SELECTED':'NOT SELECTED'),
   'APU BLEED '+stateName(s.bleed.apuBleedValveOpen),
   'BATTERY '+stateName(s.electrical.battery)];
  byId('isnStartStatus').textContent=summary.join(' · ');
  const levers={engine1:s.observations.engine1.feedback.fuelStartLever.value,
   engine2:s.observations.engine2.feedback.fuelStartLever.value};
  byId('isnStartLeverStatus').textContent='ENG 1 '+levers.engine1+' · ENG 2 '+levers.engine2;
  window.dispatchEvent(new CustomEvent('b737:engine-start-lever-state',{detail:{levers}}));
  byId('isnStartError').textContent=s.lastError||'';
  if(window.B737CockpitLights?.setInputs){
   const startInputs={};for(const n of [1,2]){
    startInputs['startValve'+n+'Open']=s.observations['engine'+n].feedback.startValveOpen.value===true;
    startInputs['starter'+n+'Air']=s.observations['engine'+n].feedback.startAirAvailable.value===true;
   }
   const key=JSON.stringify(startInputs);
   if(key!==lastStartInputs){window.B737CockpitLights.setInputs(startInputs);lastStartInputs=key;}
  }
 }
 function postProjection(){const f=byId('overheadFrame');if(!f?.contentWindow||!bridge.initialized)return;
  const lamps={...bridge.get().lamps};const projected=chain.get().projected;
  lamps['apu-gen-off-bus']=projected['apu-gen-off-bus'];
  lamps['apu-low-pressure']=projected['apu-low-pressure'];
  const key=JSON.stringify(lamps);if(key===lastLampProjection)return;lastLampProjection=key;
  f.contentWindow.postMessage({type:'b737:cockpit-command',action:'isn-projection',lamps},location.origin);
 }
 function render(){
  const {state,lamps,rejected,initialized}=bridge.get();
  byId('isnStatus').textContent=initialized?'۸ سوییچ پمپ متصل · ۸ چراغ Low Pressure + چراغ‌های برق · '+state.mode:'در انتظار همگام‌سازی اورهد…';
  byId('isnMode').textContent=state.mode==='SOURCE_GATED'?'Training Surrogate · فعال‌سازی آموزشی':'TRAINING SURROGATE · فعال (غیرمستند)';
  byId('isnMode').setAttribute('aria-pressed',String(state.mode!=='SOURCE_GATED'));
  const buses=byId('isnBuses');buses.replaceChildren(...['generator1','generator2','transfer1','transfer2','dc1','dc2'].map(id=>indicator(id,state.electrical.bus[id])));
  byId('isnBusTransfer').checked=session.electricalState.config.busTransferAuto;
  byId('isnGen1Fault').checked=session.electricalState.faults.GEN1_FAILED;
  byId('isnGen2Fault').checked=session.electricalState.faults.GEN2_FAILED;
  byId('isnFire1').checked=state.sensors.engine1Fire;
  byId('isnCabinHigh').checked=state.sensors.cabinAltitudeFt===12000;
  for(const p of Pack.PUMP_REGISTRY){const value=state.pumps[p.id],n=node.get(p.id);n.run.replaceChildren(span(value.operating));n.low.replaceChildren(span(lamps[Adapter.LAMPS[p.id]]));
   n.evidence.textContent=value.powerEvidence+(value.sourceBus?' · '+value.sourceBus:'');n.faultInput.checked=value.failed;n.observed.value=String(value.observedPower);
  }
  const w=byId('isnWarnings');w.replaceChildren(indicator('FUEL caution (candidate)',state.warnings.masterCautionFuelCandidate),indicator('HYD Master Caution (unknown)',state.warnings.masterCautionHyd),indicator('FIRE BELL',state.warnings.audio.active.some(a=>a.id==='fireBell')),indicator('CABIN HORN',state.warnings.audio.active.some(a=>a.id==='intermittentHorn')));
  const trace=byId('isnTrace');trace.replaceChildren();for(const event of [...state.recentEvents].reverse().slice(0,25)){
   const box=document.createElement('p');box.textContent='#'+event.seq+' '+event.command.type+' · '+(event.command.id||event.command.action?.type||'')+' → '+(event.changes.length?event.changes.map(c=>c.path+' '+stateName(c.from)+'→'+stateName(c.to)+' ['+c.evidence+']').join(' | '):'NO OUTPUT CHANGE');trace.append(box);
  }
  byId('isnError').textContent=rejected.length?'آخرین فرمان ردشده: '+rejected.at(-1).reason:'BUS TRANSFER: ورودی آزمایشی؛ ارتباط واقعیِ سوییچ هنوز موجود نیست.';
  renderStart();
  postProjection();
 }
 window.addEventListener('b737:engine-start-lever-command',e=>{
  if(e.detail?.source!=='PEDESTAL_PHYSICAL')return;
  try{chain.lever(e.detail.device,e.detail.position);render();}
  catch(error){byId('isnStartError').textContent=error.message;}
 });
 byId('isnMode').onclick=()=>{bridge.instructor({type:'MODE',value:session.mode==='SOURCE_GATED'?'TRAINING_SURROGATE':'SOURCE_GATED',instructor:true});render();};
 byId('isnBusTransfer').onchange=e=>{bridge.instructor({type:'ELECTRICAL',action:{type:'CONTROL',key:'busTransferAuto',value:e.target.checked}});render();};
 for(const [input,fault] of [['isnGen1Fault','GEN1_FAILED'],['isnGen2Fault','GEN2_FAILED']])byId(input).onchange=e=>{bridge.instructor({type:'ELECTRICAL',action:{type:'FAULT',id:fault,active:e.target.checked,instructor:true}});render();};
 byId('isnFire1').onchange=e=>{bridge.instructor({type:'WARNING_SENSOR',key:'engine1Fire',value:e.target.checked});render();};
 byId('isnCabinHigh').onchange=e=>{bridge.instructor({type:'WARNING_SENSOR',key:'cabinAltitudeFt',value:e.target.checked?12000:0});render();};
 byId('isnAckFire').onclick=()=>{bridge.instructor({type:'ACK_FIRE'});render();};
 byId('isnCutoutCabin').onclick=()=>{bridge.instructor({type:'CUTOUT_CABIN'});render();};
 byId('isnReplay').onclick=()=>{bridge.replay();chain.syncPower();render();};
 byId('isnReset').onclick=()=>{bridge.reset();
  for(const device of ['engine1','engine2','apu'])chain.obs(device,chain.get().sources[device].running);
  chain.syncPower();render();};
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==byId('overheadFrame')?.contentWindow||e.data?.type!=='b737:cockpit-overhead')return;
  try{
   if(e.data.kind==='controls-state'){
    bridge.synchronize(e.data);
    chain.synchronize(e.data);
    for(const event of pendingEvents.splice(0))bridge.handleEvent(event);
    render();
   }else if(e.data.kind==='control-event'){
    if(!bridge.initialized){if(pendingEvents.length<50)pendingEvents.push(e.data.event);}
    else bridge.handleEvent(e.data.event);
    chain.event(e.data.event);
    render();
   }
  }catch(error){byId('isnError').textContent='خطای ارتباط ISN: '+error.message;}
 });
 let lastTime=performance.now();
 setInterval(()=>{const now=performance.now(),elapsed=Math.max(0,Math.min(500,now-lastTime));lastTime=now;
  if(!chain.jobs.length)return;
  chain.advance(elapsed);
  for(const effect of chain.consumeEffects())if(effect.type==='ROTARY_RELEASE'){
   byId('overheadFrame')?.contentWindow?.postMessage({type:'b737:cockpit-command',
    action:'isn-starter-cutout',id:effect.id},location.origin);
  }
  render();
 },100);
 window.B737ISNCockpitV1=Object.freeze({getState:()=>bridge.get(),getStartState:()=>chain.get(),
  instructor:command=>{const r=bridge.instructor(command);render();return r;},reset:()=>{const r=bridge.reset();render();return r;}});
 // Dependencies are dynamically loaded, so request a fresh iframe snapshot
 // even if its initial ready event arrived before this message listener.
 byId('overheadFrame')?.contentWindow?.postMessage({type:'b737:cockpit-command',action:'report'},location.origin);
 render();
 }
 loadDependencies().then(init).catch(error=>console.error('ISN-03 Unified startup failed:',error));
})();
