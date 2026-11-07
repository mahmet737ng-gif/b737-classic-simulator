/* Unified EIS / Conventional engine instrumentation — one live ECU and one
 * Electrical V7. Source-indexed DB, sensor failure, CB/bus loss, trainer tests.
 * Additive presentation: preserve owner's photo, gauge centers and all guards.
 */
(function(){'use strict';
 const VER='ENG-LIVE-0003-ATA77-FEEDS', P=['n1','egt','n2','fuelFlow','oilPressure','oilTemperature','oilQuantity','vibration'];
 const CONV={n1:'n1',egt:'egt',n2:'n2',fuelFlow:'fuelFlow',oilPressure:'oilPressure',
  oilTemperature:'oilTemp',oilQuantity:'oilQty',vibration:'vib'};
 const DOT=new Set(['n1','egt','n2','fuelFlow','oilQuantity']);
 const $=s=>document.querySelector(s);
 const copy=x=>JSON.parse(JSON.stringify(x));
 const numeric=n=>typeof n==='number'&&Number.isFinite(n);
 const api=()=>window.B737EngineIndicationsV1;
 let db=null,prior=null,current=null,lastTime=null,lastRaw=null,error=null,loadPromise=null;
 let mode='EIS',fuelMode='RATE',filterThreshold=null,fuelUsedExpiresAt=null,resetFuelPending=false;
 let displayFaults={},sensorOverrides={engine1:{},engine2:{}},displayLimits={};
 let lastPaint=new Map(),lastEmitted=-1,events=0,labFrame=null;
 let eventPowerRegistered=false;
 const electrical=()=>window.B737ElectricalV7?.evaluate(window.B737ISNCockpitV1?.getElectricalState?.());
 function frameFlag(id,status,active){
  const node=$(id);if(!node)return;
  node.dataset.indicationStatus=status;node.dataset.engineLive=VER;
  if(active===null)return;
  node.style.visibility=active?'visible':'hidden';
 }
 function paint(result){
  if(!result)return;
  const sharedSync=mode==='CONVENTIONAL'?window.B737ConventionalIndicationSyncV1:null;
  // Consume the identical backend state for ALL photo pointers and numbers.
  if(sharedSync)sharedSync.intake(result,{fuelMode});
  for(const side of [1,2]){
   const id='engine'+side;
   for(const p of P){
    const x=result.engines[id].indications[p],key=p+'_'+side;
    const valid=x.status==='VALID'||x.status==='SENSOR_FAILURE_TRANSIENT'||
       (x.pointer==='HOLD_LAST'&&numeric(x.value));
    const uncertain=x.status==='POWER_EFFECT_UNVERIFIED'||x.status==='POWER_UNKNOWN';
    const visualValue=numeric(x.value)?x.value:null;
    // Fuel USED selects accumulated mass on the digital roller only; the
    // analogue fuel-flow pointer must continue to follow instantaneous flow.
    const digitalValue=p==='fuelFlow'&&fuelMode==='USED'&&numeric(x.digitalValue)?
      x.digitalValue:visualValue;
    if(DOT.has(p)&&!sharedSync){
     const attr=mode==='EIS'?'data-eis-readout':'data-conventional-readout';
     const node=$('#region-main ['+attr+'="'+key+'"]');
     const shown=x.status==='UNIT_FAILED'||x.status==='POWER_LOSS'?'hidden':uncertain?'unchanged':'visible';
     if(node){node.dataset.engineLiveStatus=x.status;if(shown!=='unchanged')node.style.visibility=shown;}
     // The shared renderer consumes raw sensor units. Conventional oil
     // quantity is converted from percent to gallons by its display spec.
     const raw=p==='oilQuantity'?x.inputValue:digitalValue;
     const value=valid&&numeric(raw)?raw:null,stamp='DOT.'+mode+'.'+key;
     if(node&&p==='fuelFlow'){
      node.dataset.fuelDisplayMode=fuelMode;node.dataset.displayUnit=fuelMode==='USED'?'t':'t/h';
     }
     if(!uncertain&&shown!=='hidden'&&(lastPaint.get(stamp)!==value||!node)){
      window.B737EISDotReadoutsV1?.setReading(id,p,value,'ENGINE_INDICATION_BACKEND_V2');
      lastPaint.set(stamp,value);
     }
    }
    if(mode==='EIS'){
     const pointerId='#region-main [data-gauge="'+key+'"]';
     const group=$(pointerId);
     if(group){
      group.dataset.engineLiveStatus=x.status;
      if(!uncertain){group.style.visibility=valid?'visible':'hidden';}
     }
     if(p==='oilQuantity'){} // Oil quantity has only the separate numeric EIS field.
     if(p!=='oilQuantity'&&p!=='vibration'&&p!=='oilTemperature'&&p!=='oilPressure'&&p!=='n1'&&p!=='egt'&&p!=='n2'&&p!=='fuelFlow')continue;
     if(p!=='oilQuantity'&&p!=='vibration'||p==='vibration'||p==='oilTemperature'||p==='oilPressure'){
      // "hydPressure" is an unrelated EIS channel: do not overwrite it.
      if(valid&&numeric(visualValue)&&p!=='oilQuantity'){
       const stamp='POINTER.'+key;
       if(lastPaint.get(stamp)!==visualValue){
        window.B737EISNeedlesV1?.setReading(id,p,visualValue);
        lastPaint.set(stamp,visualValue);
       }
      }
     }
    }else if(!sharedSync){
     const convKey=CONV[p];
     const group=$('#region-main [data-conventional-needle="'+convKey+'_'+side+'"]');
     if(group){
      group.dataset.engineLiveStatus=x.status;
      // A physical needle remains on the gauge even when a sensor or CB
      // fails: it may freeze or park, but must not vanish from the dial.
      group.style.visibility='visible';
     }
     if(valid&&numeric(visualValue)){
      const stamp='CONV.'+key;
      if(lastPaint.get(stamp)!==visualValue){
       window.B737ConventionalNeedlesV1?.setReading(id,convKey,visualValue,'ENGINE_INDICATION_BACKEND_V2');
       lastPaint.set(stamp,visualValue);
      }
     }
    }
   }
  }
  // Feed observed analogue pressure to the existing physical cockpit lamp model.
  // The lamp engine owns real light state/push-to-test; do not directly tint images.
  const lights=window.B737CockpitLights;
  if(lights?.setInputs){
   const present=lights.getState()?.inputs||{},patch={};
   for(const side of [1,2]){
    const id='engine'+side;
    const oil=result.engines[id].indications.oilPressure;
    if(oil.status==='VALID'&&numeric(oil.inputValue)){
     const key='oil'+side+'AtRedRadial';
     const active=oil.inputValue<=db.laws.oilPressureRedLinePsi;
     if(present[key]!==active)patch[key]=active;
    }
    const real=lastRaw?.engines?.[id]?.oil?.filterBypassLamp;
    const filterKey='oilFilter'+side+'Bypass';
    if(typeof real==='boolean'&&present[filterKey]!==real)patch[filterKey]=real;
   }
   if(Object.keys(patch).length)try{lights.setInputs(patch);}catch(err){error='Physical lamp bridge: '+err.message;}
  }
 }
 // An instructor RUNNING preset does not automatically connect its GEN to the
 // aircraft electrical buses. Tell the trainee WHY the photo needles / digits
 // are parked, instead of suggesting that a functioning ECU is broken.
 function showFeedDiagnostic(result=null){
  const owner=$('#isnQuickEngineControls');if(!owner)return;
  let node=$('#isnEngineInstrumentFeedsV1');
  if(!node){
   node=document.createElement('p');node.id='isnEngineInstrumentFeedsV1';
   node.setAttribute('role','status');node.dir='ltr';
   Object.assign(node.style,{fontSize:'11px',lineHeight:'1.5',padding:'8px',
    border:'1px solid #45627a',borderRadius:'5px',overflowWrap:'anywhere'});
   owner.append(node);
  }
  const b=electrical()?.bus||{},mark=v=>v===true?'ON':v===false?'OFF':'UNKNOWN';
  const feeds='BAT BUS '+mark(b.battery)+' · DC STBY '+mark(b.dcStandby)+
    ' · DC1 '+mark(b.dc1)+' · DC2 '+mark(b.dc2)+
    ' · AC T1 '+mark(b.transfer1)+' · AC T2 '+mark(b.transfer2);
  const parts=[];
  for(const side of [1,2]){
   const channels=result?.engines?.['engine'+side]?.indications;
   if(!channels){parts.push('ENG'+side+' NO BACKEND DATA');continue;}
   const failures=['n1','egt','n2','fuelFlow','oilPressure'].filter(p=>channels[p]?.status!=='VALID');
   const unique=[...new Set(failures.map(p=>channels[p]?.status||'NO SENSOR'))];
   parts.push('ENG'+side+' '+(failures.length?unique.join('/'):'INDICATORS LIVE'));
  }
  const withoutFeed=['battery','dcStandby','dc1','dc2','transfer1','transfer2']
   .every(k=>b[k]===false);
  const hint=withoutFeed?
   ' · NO INSTRUMENT FEED: BAT ON and select real GEN/APU/GROUND power as applicable':
   !db?' · TECHNICAL DB NOT LOADED':
   error?' · BRIDGE ERROR: '+error:'';
  const text='ENGINE INSTRUMENT POWER · '+feeds+' | '+parts.join(' | ')+hint;
  if(node.textContent!==text)node.textContent=text;
  node.dataset.feedFault=String(withoutFeed);
  node.dataset.indicationReady=String(Boolean(result));
  // All 16 instrument channels are wired to Electrical V7's *evaluated*
  // buses (not generator switch states). The table reads the actual source
  // contract and the one shared CB state; it never changes panel power.
  if(typeof document.createElement!=='function'||typeof owner.append!=='function')return;
  let matrix=$('#isnEngineFeedMatrixV1');
  if(!matrix){
   matrix=document.createElement('details');matrix.id='isnEngineFeedMatrixV1';
   matrix.dir='ltr';
   matrix.innerHTML='<summary>ENGINE FEEDS · 16 live channels (FCOM / MRG / LAN)</summary>'+
    '<table style="font-size:10px;width:100%;border-collapse:collapse"><thead><tr>'+
    '<th>IND</th><th>SOURCE</th><th>CB</th><th>STATUS</th></tr></thead><tbody></tbody></table>'+
    '<small>EIS LRU 28VDC: P6-2, exact bus pin unverified. '+
    'AVM: MRG 28VAC indication versus LAN 115VAC conditioner, both Transfer 1.</small>';
   owner.append(matrix);
   const body=matrix.querySelector('tbody');
   for(const side of [1,2])for(const p of P){
    const row=document.createElement('tr');row.dataset.feedId=p+'_'+side;
    for(let i=0;i<4;i++){
     const td=document.createElement('td');td.style.padding='3px 4px';
     td.style.borderBottom='1px solid #375269';row.append(td);
    }
    row.cells[0].textContent='E'+side+' '+p;body.append(row);
   }
  }
  const full=electrical();
  const sources=full?.feed?.transferSource||{};
  for(const side of [1,2])for(const p of P){
   const row=matrix.querySelector('[data-feed-id="'+p+'_'+side+'"]');
   const rule=db?.instruments?.[p]?.wiring?.[mode]?.[side];
   const signal=result?.engines?.['engine'+side]?.indications?.[p];
   if(!row||!rule)continue;
   const power=mark(b[rule.bus]);
   const backfeed=rule.bus==='transfer1'?sources[1]:
    rule.bus==='transfer2'?sources[2]:null;
   const source=rule.bus.toUpperCase()+' '+rule.voltage+(backfeed?' ('+backfeed+')':'')+' '+power;
   const cb=signal?.circuitBreaker?.state||'UNKNOWN';
   const status=signal?.status||'NO ECU';
   if(row.cells[1].textContent!==source)row.cells[1].textContent=source;
   if(row.cells[2].textContent!==cb)row.cells[2].textContent=cb;
   if(row.cells[3].textContent!==status)row.cells[3].textContent=status;
   row.dataset.power=power;
   row.dataset.indicationStatus=status;
  }
 }
 function startReport(){
  if(!window.B737ClassicEngineStartLogicV2||!window.B737ISNCockpitV1)return null;
  try{return window.B737ClassicEngineStartLogicV2.project({
   chain:window.B737ISNCockpitV1.getStartState(),ecu:lastRaw,
   electrical:electrical()
  });}catch(ex){return {error:ex.message};}
 }
 function apply(live){
  if(!db||!api()||!live||live.quality!=='TRAINING_SIMULATION_ONLY')return null;
  try{
   const state=electrical();
   if(!state)return null;
   const desired=document.documentElement.dataset.engineIndication;
   const nextMode=desired==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
   if(mode!==nextMode){mode=nextMode;lastPaint.clear();}
   const observed=api().fromEcu(live);
   for(const id of ['engine1','engine2'])for(const [param,override] of Object.entries(sensorOverrides[id])){
    observed[id][param]=copy(override);
   }
   const now=numeric(live.timeMs)?live.timeMs:0;
   const dt=lastTime===null?0:Math.max(0,Math.min(60000,Math.round(now-lastTime)));
   // EIS FUEL USED is a momentary ten-second display. Conventional uses its
   // own held RATE/USED selector and is not subject to this automatic timer.
   if(mode==='EIS'&&fuelMode==='USED'&&fuelUsedExpiresAt!==null&&now>=fuelUsedExpiresAt){
    fuelMode='RATE';fuelUsedExpiresAt=null;lastPaint.clear();
   }
   if(lastTime!==null&&now<lastTime){prior=null;lastPaint.clear();}
   const next=api().calculate(db,{mode,electrical:state,observed,previous:prior,
    faults:displayFaults,limits:displayLimits,filterBypassThresholdPsid:filterThreshold,
    dtMs:dt,fuelMode,resetFuelUsed:resetFuelPending});
   resetFuelPending=false;
   prior=next;lastTime=now;lastRaw=live;current=next;events++;
   paint(next);
   showFeedDiagnostic(next);
   // Start logic contains actual switch feedback; no duplicate start controller.
   if(events%3===0){
    window.dispatchEvent(new CustomEvent('b737:engine-indications-live-v2',{
     detail:{schema:next.schema,mode,engines:next.engines,bite:next.bite,start:startReport()}
    }));
   }
   return next;
  }catch(e){error=e.message;console.warn('Engine indication bridge:',e);return null;}
 }
 function setFault(key,on){
  if(typeof on!=='boolean'||!(
    ['eisPrimary','eisSecondary'].includes(key)||
    /^(n1|n2|egt|fuelFlow|oilPressure|oilTemperature|oilQuantity|vibration)\.[12]$/.test(key)
  ))throw Error('Unknown instrument fault or invalid state');
  displayFaults[key]=on;refresh();return current;
 }
 function setSensor(id,parameter,value,condition='VALID'){
  if(!['engine1','engine2'].includes(id)||!P.includes(parameter))throw Error('Unknown engine sensor');
  if(!['VALID','FAILED','CLEAR'].includes(condition))throw Error('Unknown sensor condition');
  if(condition==='CLEAR'){delete sensorOverrides[id][parameter];refresh();return;}
  if(condition==='FAILED')sensorOverrides[id][parameter]={valid:false,reason:'INSTRUCTOR_SENSOR_FAILURE'};
  else {
   if(!numeric(value)||value<0||value>100000)throw Error('Finite nonnegative sensor test value required');
   sensorOverrides[id][parameter]={valid:true,value,unit:db.instruments[parameter].unit,
    origin:'EXPLICIT_INSTRUCTOR_SENSOR',quality:'TRAINING_INJECTION'};
  }
  refresh();return current;
 }
 function changeMode(value){
  if(!['EIS','CONVENTIONAL'].includes(value))throw Error('Unknown engine display');
  window.B737EngineIndicationModeV1?.setMode(value);
  refresh();
 }
 function setPhysicalDetent(cmd){
  const id=cmd.type==='PHYSICAL_IGNITION'?'ignition-source':
   cmd.engine==='engine1'?'engine-start-1':cmd.engine==='engine2'?'engine-start-2':null;
  const allowed=id==='ignition-source'?['IGN L','BOTH','IGN R']:['GRD','OFF','CONT','FLT'];
  if(!id||!allowed.includes(cmd.value))throw Error('Invalid physical start or ignition detent');
  const rotary=document.getElementById('overheadFrame')?.contentWindow?.B737RotaryGuards;
  if(!rotary?.setEngineLabDetent||!rotary?.getState)
   throw Error('Physical overhead is not mounted; open the OVERHEAD panel');
  const old=rotary.getState()?.rotaries?.[id];
  if(old===cmd.value)return {accepted:true,unchanged:true,id,value:cmd.value,owner:'ACTUAL_OVERHEAD_ROTARY'};
  if(rotary.setEngineLabDetent(id,cmd.value)!==true)throw Error('Physical overhead rejected detent');
  if(rotary.getState()?.rotaries?.[id]!==cmd.value)throw Error('Physical detent feedback did not match');
  // Existing overhead rotary event -> single ISN live gateway -> ECU. No shadow starter.
  return {accepted:true,id,value:cmd.value,owner:'ACTUAL_OVERHEAD_ROTARY'};
 }
 function command(cmd){
  if(!cmd||typeof cmd!=='object')throw Error('Instructor command required');
  switch(cmd.type){
   case 'PHYSICAL_IGNITION':
   case 'PHYSICAL_START_SWITCH':return setPhysicalDetent(cmd);
   case 'DISPLAY_FAULT':return setFault(cmd.key,cmd.active);
   case 'SENSOR':return setSensor(cmd.engine,cmd.parameter,cmd.value,cmd.condition);
   case 'MODE':return changeMode(cmd.mode);
   case 'FUEL_MODE':
    if(!['RATE','USED'].includes(cmd.value))throw Error('Unsupported fuel display mode');
    fuelMode=cmd.value;
    const clock=window.B737ISNCockpitV1?.getECUState?.()?.timeMs;
    fuelUsedExpiresAt=fuelMode==='USED'&&mode==='EIS'&&numeric(clock)?clock+10000:null;
    lastPaint.clear();return refresh();
   case 'RESET_FUEL_USED':
    resetFuelPending=true;lastPaint.clear();return refresh();
   case 'FILTER_THRESHOLD':
    if(cmd.value!==null&&(!numeric(cmd.value)||cmd.value<0||cmd.value>100))
     throw Error('Explicit installed filter switch threshold required');
    filterThreshold=cmd.value;return refresh();
   case 'PHYSICAL_START_DETENT':
    if(cmd.id==='ignition-source')return setPhysicalDetent({type:'PHYSICAL_IGNITION',value:cmd.value});
    if(['engine-start-1','engine-start-2'].includes(cmd.id))
     return setPhysicalDetent({type:'PHYSICAL_START_SWITCH',engine:'engine'+cmd.id.at(-1),value:cmd.value});
    throw Error('Invalid physical OH engine selector ID');
   case 'RESET_INSTRUMENT_FAULTS':
    displayFaults={};sensorOverrides={engine1:{},engine2:{}};filterThreshold=null;
    prior=null;lastPaint.clear();return refresh();
   default:
    return window.B737ISNCockpitV1?.engineTrainerAction?.({...cmd,instructor:true})||
      (()=>{throw Error('Unified engine ECU not ready');})();
  }
 }
 function refresh(){
  const now=window.B737ISNCockpitV1?.getECUState?.()||lastRaw;
  return apply(now);
 }
 function status(){
  return {version:VER,ready:!!db,mode,fuelMode,error,events,
   source:'ONE ECU / ONE ELECTRICAL V7',snapshot:current?copy(current):null,
   start:startReport(),electrical:window.B737ISNCockpitV1?.getElectricalState?.()||null,
   conventionalSync:window.B737ConventionalIndicationSyncV1?.getState?.()||null};
 }
 function sendLab(packet){if(!labFrame?.contentWindow)return;
  labFrame.contentWindow.postMessage({type:'b737:engine-lab-v2-snapshot',packet},location.origin);
 }
 function labSnapshot(){return {kind:'snapshot',...status(),ecu:lastRaw,
  start:startReport(),technicals:db?{revision:db.revision,sources:db.sources}:null};}
 function installLab(){
  if($('#engineLabButtonV2'))return;
  const bar=$('#unifiedLabShortcuts');
  if(!bar)return;
  const button=document.createElement('button');button.type='button';button.id='engineLabButtonV2';
  button.textContent='ENGINE TEST LAB';button.title='Source-traced EIS / Conventional, start and emergency test lab';
  bar.append(button);
  const dialog=document.createElement('dialog');dialog.id='engineLabDialogV2';
  dialog.setAttribute('aria-label','Engine indication and engine start laboratory');
  dialog.innerHTML='<header><b>B737 CLASSIC · ENGINE SYSTEM TEST LAB</b><button id="engineLabCloseV2" type="button">CLOSE ×</button></header>'+
   '<iframe title="737 Classic Engine Normal Abnormal Emergency Test Lab" id="engineLabFrameV2" loading="lazy"></iframe>';
  document.body.append(dialog);labFrame=dialog.querySelector('iframe');
  button.addEventListener('click',()=>{if(!dialog.open)dialog.showModal();
   if(!labFrame.src||labFrame.src==='about:blank')
    labFrame.src=new URL('../engine-test-lab/index.html?v='+VER,document.baseURI).href;
   sendLab(labSnapshot());
  });
  dialog.querySelector('button').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('click',e=>{if(e.target===dialog)dialog.close();});
  dialog.addEventListener('close',()=>{labFrame.src='about:blank';});
  window.addEventListener('message',event=>{
   if(event.origin!==location.origin||event.source!==labFrame.contentWindow)return;
   const data=event.data;
   if(data?.type==='b737:engine-lab-v2-ready'){sendLab(labSnapshot());return;}
   if(data?.type!=='b737:engine-lab-v2-command')return;
   if(!Number.isSafeInteger(data.sequence)||data.sequence<1)return;
   let outcome={accepted:true};
   try{
    const returned=command(data.command);
    if(returned?.accepted===false)outcome={accepted:false,error:returned.reason||'ECU rejected action'};
    else outcome={accepted:true,message:returned?.owner==='ACTUAL_OVERHEAD_ROTARY'?
     'Physical overhead detent confirmed':'Shared live ECU command accepted'};
   }catch(ex){outcome={accepted:false,error:ex.message};}
   sendLab({kind:'ack',sequence:data.sequence,outcome,state:labSnapshot()});
  });
  // Updating the lab twice a second is enough and avoids extra ECU work on every frame.
  setInterval(()=>{if(dialog.open)sendLab(labSnapshot());},500);
 }
 async function load(){
  if(loadPromise)return loadPromise;
  loadPromise=(async()=>{
   if(!api())throw Error('B737EngineIndicationsV1 must load first');
   const res=await fetch(new URL('../../engine/instruments/engine-indication-technical-db-v1.json?v='+VER,document.baseURI),
    {cache:'force-cache'});
   if(!res.ok)throw Error('Technical data HTTP '+res.status);
   const next=await res.json();api().validate(next);db=next;refresh();
   return true;
  })().catch(ex=>{error=ex.message;console.error('Engine Technical DB:',ex);showFeedDiagnostic();return false;});
  return loadPromise;
 }
 window.B737UnifiedEngineIndicationsV2=Object.freeze({
  getState:status,refresh,command,startReport,load,
   onElectricalPowerChange:()=>{eventPowerRegistered=true;lastPaint.clear();return refresh();},
  // The EIS renderers use raw ECU only before this validated backend owns
  // the channel. This is the sole source for instrument power/fault validity.
  ownsPresentation:()=>!!db,
  setMode:changeMode,getDatabase:()=>db?copy(db):null
 });
 window.addEventListener('b737:unified-ecu-observation',ev=>apply(ev.detail));
 window.addEventListener('b737:cb-state-change',()=>{lastPaint.clear();refresh();});
 // If the real electrical owner transfers between sources while the ECU is
 // idle, update the instrument indications without waiting for engine ticks.
 let lastElectricalFrame=null;
 window.addEventListener('b737:electrical-v7-state',()=>{
  const frame=electrical();
  const signature=frame?JSON.stringify([eventPowerRegistered?null:frame.bus,frame.source]):null;
  if(signature===lastElectricalFrame)return;
  lastElectricalFrame=signature;lastPaint.clear();refresh();
 });
 window.addEventListener('b737:engine-indication-view',()=>{lastPaint.clear();refresh();});
 window.addEventListener('b737:cockpit-mounted',()=>{lastPaint.clear();refresh();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{installLab();load();},{once:true});
 else{installLab();load();}
})();
