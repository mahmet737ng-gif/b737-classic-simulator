/* Phase 1 live electricity: observe the SAME ECU Pack, populate the existing
 * P5-13 selectors/needles, and expose test inputs in Controls. No cockpit art.
 */
(function(root){
 'use strict';
 const Core=root.B737ElectricalNetworkV1;if(!Core)return;
 let current=null,lastKey='',panel=null,errorBox=null,numericMode='NOMINAL_MODEL';
 const listeners=new Set(),sourceCache=new Map(),busRows=new Map(),faultInputs=new Map();
 const label={ENERGIZED:'برق‌دار',DEENERGIZED:'بی‌برق',UNKNOWN:'نامشخص'};
 const copy=v=>JSON.parse(JSON.stringify(v));
 const owner=()=>root.B737ISNCockpitV1;
 function element(tag,text,parent){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(parent)parent.append(n);return n;}
 function showError(error){if(errorBox)errorBox.textContent=error?.message||String(error);}
 function safely(fn){try{if(errorBox)errorBox.textContent='';return fn();}catch(error){showError(error);return null;}}
 function scenario(key,value){
  if(!['groundPowerAttached','onGround'].includes(key)||typeof value!=='boolean')throw Error('Invalid ground scenario');
  const lights=document.getElementById('overheadFrame')?.contentWindow?.B737OverheadLights;
  if(!lights?.setScenario)throw Error('پنل اورهد هنوز آماده نیست.');
  // Use the actual iframe scenario owner so its next snapshot cannot undo
  // the input. Existing transport -> Gateway -> same Pack remains authoritative.
  lights.setScenario({[key]:value});return {pending:true};
 }
 function fault(id,active){
  if(!root.B737ElectricalV7.FAULTS.includes(id)||typeof active!=='boolean')throw Error('Invalid electrical fault');
  if(!owner())throw Error('موتور برق هنوز آماده نیست.');
  owner().instructor({type:'ELECTRICAL',action:{type:'FAULT',id,active,instructor:true}});
  refresh();return snapshot();
 }
 function control(key,value){
  if(!['groundPowerQualityGood','groundServiceSelected'].includes(key)||typeof value!=='boolean')throw Error('Invalid instructor environment control');
  if(!owner())throw Error('موتور برق هنوز آماده نیست.');
  owner().instructor({type:'ELECTRICAL',action:{type:'CONTROL',key,value}});refresh();
 }
 function snapshot(){return current?copy(current):null;}
 function updateMeters(network){
  if(!root.B737UnifiedAcDcSelectors)return;
  for(const [side,sources]of Object.entries(network.meterSources))for(const [position,measurement]of Object.entries(sources)){
   const id=side+':'+position,key=JSON.stringify(measurement);
   if(sourceCache.get(id)===key)continue;
   root.dispatchEvent(new CustomEvent('b737:ac-dc-source-measurement',{detail:{side,position,measurement}}));
   sourceCache.set(id,key);
  }
 }
 function refresh(){
  const p=owner();if(!p?.getElectricalState||!p?.getState)return null;
  const state=p.getElectricalState(),electrical=p.getState().state.electrical;
  const key=state.rev+':'+numericMode;
  // Reset can reuse a revision. Include effective inputs/result so a reset
  // cannot leave stale energized instruments on the display.
  const signature=key+':'+JSON.stringify([state.config,state.source,state.faults,electrical.bus]);
  if(signature===lastKey)return snapshot();
  const next=Core.project(state,electrical,{numericMode});
  current=next;lastKey=signature;buildPanel();updateMeters(next);paint();
  // Only the drive-running bit is used by the RESID adapter; Boolean bus
  // connectivity is never promoted to an inferred GCR/field/residual sensor.
  root.dispatchEvent(new CustomEvent('b737:electrical-v7-state',{detail:{state:copy(state)}}));
  root.dispatchEvent(new CustomEvent('b737:electrical-network',{detail:snapshot()}));
  for(const fn of listeners)try{fn(snapshot());}catch(error){console.error('Electrical subscriber failed',error);}
  return snapshot();
 }
 function checkbox(parent,id,text,handler){
  const line=element('label',undefined,parent);line.style.cssText='display:flex;gap:8px;align-items:center;margin:7px 0';
  const input=element('input',undefined,line);input.type='checkbox';input.id=id;
  element('span',text,line);input.addEventListener('change',()=>safely(()=>handler(input.checked)));return input;
 }
 function buildPanel(){
  if(panel)return;
  const holder=document.getElementById('isnBridgePanel');if(!holder)return;
  panel=element('section');panel.id='electricalLivePanel';
  panel.style.cssText='border:1px solid #45606b;border-radius:10px;padding:12px;margin:14px 0;line-height:1.7';
  element('h2','برق زنده · فاز ۱',panel);
  element('p','منابع، باس‌ها، TRها و اینورتر از موتور مشترک کابین خوانده می‌شوند. ۲۴/۲۸/۱۱۵ ولت و ۴۰۰ هرتز مقادیر نامی آموزشی‌اند؛ جریان، شارژ باتری و حفاظت گذرا هنوز محاسبه نمی‌شوند.',panel);
  const help=element('p','تست زمین: BATTERY را ON کن، کابل GPU را در زیر وصل کن و سپس سوییچ واقعی GRD PWR را ON کن. سلکتورهای AC/DC همان گیج‌های نصب‌شده را می‌خوانند.',panel);
  help.style.color='#bde6cf';
  checkbox(panel,'electricalGpuAttached','کابل برق زمینی وصل است',value=>scenario('groundPowerAttached',value));
  checkbox(panel,'electricalOnGround','هواپیما روی زمین است',value=>scenario('onGround',value));
  const env=element('details',undefined,panel);element('summary','کیفیت برق زمینی و Ground Service',env);
  checkbox(env,'electricalGpuQuality','کیفیت برق زمینی قابل قبول است',value=>control('groundPowerQualityGood',value));
  checkbox(env,'electricalGroundService','Ground Service انتخاب شده است',value=>control('groundServiceSelected',value));
  element('p','Ground Service می‌تواند برق خدمات و شارژر را بدون برق‌دار کردن همهٔ باس‌های هواپیما بگیرد.',env);
  const numbers=element('label','نمایش گیج‌ها: ',panel),select=element('select',undefined,numbers);
  select.id='electricalNumericMode';
  for(const [value,text]of [['NOMINAL_MODEL','مقادیر نامی مدل'],['SENSOR_ONLY','فقط ورودی حسگر؛ مقادیر ناموجود نامشخص']]){
   const opt=element('option',text,select);opt.value=value;
  }
  select.addEventListener('change',()=>safely(()=>{numericMode=select.value;refresh();}));
  const source=element('p','',panel);source.id='electricalLiveSources';source.dir='ltr';
  const scroll=element('div',undefined,panel);scroll.style.cssText='overflow-x:auto';
  const table=element('table',undefined,scroll);table.style.cssText='width:100%;font-size:12px;direction:ltr;text-align:left;border-collapse:collapse';
  const head=element('tr',undefined,element('thead',undefined,table));
  for(const text of ['Bus / unit','State','Feed','V','Hz'])element('th',text,head);
  const body=element('tbody',undefined,table);
  for(const id of [...Object.values(Core.BUS_IDS),'TR1','TR2','TR3','INVERTER','CHARGER']){
   const row=element('tr',undefined,body);row.dataset.electricalNode=id;
   row.style.borderTop='1px solid #344c57';
   const cols=Array.from({length:5},()=>element('td','',row));cols[0].textContent=id;busRows.set(id,{row,cols});
  }
  const fail=element('details',undefined,panel);element('summary','تزریق خرابی برق برای تست پنل',fail);
  for(const id of root.B737ElectricalV7.FAULTS){
   const input=checkbox(fail,'electricalFault-'+id,id,value=>fault(id,value));faultInputs.set(id,input);
  }
  const clear=element('button','رفع خرابی‌های تزریق‌شده',fail);clear.type='button';
  clear.onclick=()=>safely(()=>{for(const [id,active]of Object.entries(current?.faults||{}))if(active)fault(id,false);});
  const qa=element('p','',panel);qa.id='electricalLiveUnknown';qa.style.color='#edc87b';
  errorBox=element('p','',panel);errorBox.id='electricalLiveError';errorBox.setAttribute('role','status');
  holder.prepend(panel);
 }
 function paint(){
  if(!panel||!current)return;
  const n=current.nodes;
  document.getElementById('electricalLiveSources').textContent=['GEN1','GEN2','APU','EXT','BATTERY'].map(id=>{
   const source=n[id];return id+': '+(source.available?'AVAILABLE':'UNAVAILABLE')+
    (source.connectedBusSides?.length?' → BUS '+source.connectedBusSides.join('+'):'');
  }).join(' | ');
  for(const [id,{row,cols}]of busRows){
   const value=n[id];row.dataset.power=value.status;cols[1].textContent=label[value.status];
   cols[1].style.color=value.powered===null?'#edc87b':value.powered?'#8fdfb4':'#a9b8bf';
   cols[2].textContent=value.feeds.join(' + ')||'—';cols[3].textContent=value.volts??'—';cols[4].textContent=value.hz??'—';
   row.title=value.reason||value.numericQuality;
  }
  for(const [id,key]of [['electricalGpuAttached','groundPowerAttached'],['electricalOnGround','onGround'],
   ['electricalGpuQuality','groundPowerQualityGood'],['electricalGroundService','groundServiceSelected']])document.getElementById(id).checked=current.controls[key];
  for(const [id,input]of faultInputs)input.checked=current.faults[id];
  const unresolved=current.qa.filter(item=>!['NOMINAL_NUMBERS','LOAD_CURRENT','APU_BAT_EFFECTIVITY'].includes(item.id)).map(item=>item.id);
  document.getElementById('electricalLiveUnknown').textContent='APU BAT و مسیر CB مصرف‌کننده‌ها هنوز تأیید نشده‌اند.'+
   (unresolved.length?' موارد باز: '+unresolved.join(' · '):'')+
   (current.galleyShed?' · GALLEY LOAD SHED':'');
 }
 root.B737UnifiedElectricalLive=Object.freeze({version:Core.VERSION,snapshot,refresh,scenario,fault,
  supply:input=>Core.supply(current,input),
  subscribe(fn){if(typeof fn!=='function')throw Error('Subscriber function required');listeners.add(fn);if(current)fn(snapshot());return ()=>listeners.delete(fn);}
 });
 for(const event of ['b737:electrical-owner-ready','b737:unified-ecu-observation'])root.addEventListener(event,()=>safely(refresh));
 safely(refresh);
})(window);
