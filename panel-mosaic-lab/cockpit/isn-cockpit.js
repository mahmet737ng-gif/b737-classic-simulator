(function(){
 'use strict';
 const byId=id=>document.getElementById(id);
 const Pack=window.B737ISNElectricalPackV1,Adapter=window.B737ISNCockpitBridgeV1;
 if(!Pack||!Adapter){console.error('ISN-02: missing integration modules');return;}
 const session=new Pack.Session({Electrical:window.B737ElectricalV7,Loads:window.B737ElectricalLoadsV8,
  TrainerCore:window.B737TrainerCore,WarningEngine:window.B737WarningEngine.WarningEngine});
 const bridge=new Adapter.Bridge(session);
 const pendingEvents=[];
 const panel=document.createElement('section');panel.className='isn-bridge-panel';panel.id='isnBridgePanel';
 panel.innerHTML='<h2>ISN-02 · شبکهٔ زندهٔ کابین</h2><p id="isnStatus" role="status">منتظر وضعیت سوییچ‌های اورهد…</p><p class="isn-note">خروجی Source-Gated مستند است؛ منبع دقیق تغذیهٔ ۸ پمپ هنوز تأیید نشده و UNKNOWN باقی می‌ماند. وضعیت‌های آموزشی به‌صورت مجزا مشخص‌اند.</p><button id="isnMode" type="button" aria-pressed="false">Training Surrogate · خاموش</button><div class="isn-buses" id="isnBuses"></div><details><summary>کنترل‌های مربی · بدون سوییچ فیزیکی</summary><label class="isn-setting"><input type="checkbox" id="isnBusTransfer" checked> BUS TRANSFER AUTO (فقط تست؛ سوییچ در رجیستری نیست)</label><label class="isn-setting"><input type="checkbox" id="isnGen1Fault"> GEN 1 FAILED · تزریق مربی</label><label class="isn-setting"><input type="checkbox" id="isnGen2Fault"> GEN 2 FAILED · تزریق مربی</label><button id="isnReset" type="button">بازنشانی موتور ISN بر اساس وضعیت فعلی کابین</button></details><div class="isn-scroll"><table class="isn-table"><thead><tr><th>سوییچ / چراغ واقعی</th><th>RUN</th><th>LOW PRESS</th><th>Power Evidence</th><th>تست مربی</th></tr></thead><tbody id="isnPumpRows"></tbody></table></div><div class="isn-warnings" id="isnWarnings"></div><details><summary>ردگیری فرمان → سیستم → چراغ / هشدار</summary><div id="isnTrace" class="isn-trace" dir="ltr"></div></details><p id="isnError" class="isn-error" role="status"></p>';
 const trainer=document.createElement('details');trainer.innerHTML='<summary>هشدارهای مستند · ورودی سناریوی مربی</summary><label class="isn-setting"><input id="isnFire1" type="checkbox"> ENGINE 1 FIRE · ورودی آزمایشی</label><label class="isn-setting"><input id="isnCabinHigh" type="checkbox"> CABIN ALTITUDE 12000 ft · ورودی آزمایشی</label><button id="isnAckFire" type="button">Fire Bell Acknowledge</button><button id="isnCutoutCabin" type="button">Cabin Horn Cutout</button>';
 panel.querySelector('.isn-warnings').after(trainer);
 const replayButton=document.createElement('button');replayButton.id='isnReplay';replayButton.type='button';replayButton.textContent='بازپخش قطعی رویدادهای ISN';
 panel.querySelector('#isnTrace').after(replayButton);
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
 function postProjection(){const f=byId('overheadFrame');if(!f?.contentWindow||!bridge.initialized)return;
  f.contentWindow.postMessage({type:'b737:cockpit-command',action:'isn-projection',lamps:bridge.get().lamps},location.origin);
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
  postProjection();
 }
 byId('isnMode').onclick=()=>{bridge.instructor({type:'MODE',value:session.mode==='SOURCE_GATED'?'TRAINING_SURROGATE':'SOURCE_GATED',instructor:true});render();};
 byId('isnBusTransfer').onchange=e=>{bridge.instructor({type:'ELECTRICAL',action:{type:'CONTROL',key:'busTransferAuto',value:e.target.checked}});render();};
 for(const [input,fault] of [['isnGen1Fault','GEN1_FAILED'],['isnGen2Fault','GEN2_FAILED']])byId(input).onchange=e=>{bridge.instructor({type:'ELECTRICAL',action:{type:'FAULT',id:fault,active:e.target.checked,instructor:true}});render();};
 byId('isnFire1').onchange=e=>{bridge.instructor({type:'WARNING_SENSOR',key:'engine1Fire',value:e.target.checked});render();};
 byId('isnCabinHigh').onchange=e=>{bridge.instructor({type:'WARNING_SENSOR',key:'cabinAltitudeFt',value:e.target.checked?12000:0});render();};
 byId('isnAckFire').onclick=()=>{bridge.instructor({type:'ACK_FIRE'});render();};
 byId('isnCutoutCabin').onclick=()=>{bridge.instructor({type:'CUTOUT_CABIN'});render();};
 byId('isnReplay').onclick=()=>{bridge.replay();render();};
 byId('isnReset').onclick=()=>{bridge.reset();render();};
 window.addEventListener('message',e=>{
  if(e.origin!==location.origin||e.source!==byId('overheadFrame')?.contentWindow||e.data?.type!=='b737:cockpit-overhead')return;
  try{
   if(e.data.kind==='controls-state'){
    bridge.synchronize(e.data);
    for(const event of pendingEvents.splice(0))bridge.handleEvent(event);
    render();
   }else if(e.data.kind==='control-event'){
    if(!bridge.initialized){if(pendingEvents.length<50)pendingEvents.push(e.data.event);}
    else bridge.handleEvent(e.data.event);
    render();
   }
  }catch(error){byId('isnError').textContent='خطای ارتباط ISN: '+error.message;}
 });
 window.B737ISNCockpitV1=Object.freeze({getState:()=>bridge.get(),instructor:command=>{const r=bridge.instructor(command);render();return r;},reset:()=>{const r=bridge.reset();render();return r;}});
 render();
})();
