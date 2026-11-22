(async()=>{
;
/* ./engine-indication-live-v2.js?v=CH7-FUEL-USED-0001 */
try{
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
 let fuelResetDueAt=null,fuelResetZeroUntil=null,fuelResetTransition=null;
 let displayFaults={},sensorOverrides={engine1:{},engine2:{}},displayLimits={};
 let lastPaint=new Map(),lastEmitted=-1,events=0,labFrame=null;
 let eventPowerRegistered=false;
  const conventionalPowerLossState=new Map();
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
  if(sharedSync){
   sharedSync.intake(result,{fuelMode});
   // Only electrical power LOSS blanks the entire numeric counter.
   // A missing sensor/invalid value has different failure presentation.
   // No bus polling and no repeated DOM writes: update only on a change.
   for(const side of [1,2]){
    const id='engine'+side;
    for(const signal of ['n1','egt','n2','fuelFlow']){
     const lost=result.engines[id]?.indications?.[signal]?.status==='POWER_LOSS';
     const key=signal+'_'+side;
     if(conventionalPowerLossState.get(key)===lost)continue;
     conventionalPowerLossState.set(key,lost);
     window.B737EISDotReadoutsV1?.setConventionalPowerLoss?.(id,signal,lost);
     if(signal==='n2')
      window.B737ConventionalNeedlesV1?.setIndicationPowerLoss?.(id,signal,lost);
    }
   }
  }
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
    let digitalValue=p==='fuelFlow'&&fuelMode==='USED'&&numeric(x.digitalValue)?
      x.digitalValue:visualValue;
    if(p==='fuelFlow'&&mode==='EIS'&&fuelMode==='USED'&&fuelResetTransition){
      const {startKg,startAt,endAt}=fuelResetTransition;
      if(lastTime>=startAt){
        const fraction=Math.max(0,Math.min(1,(lastTime-startAt)/(endAt-startAt)));
        digitalValue=Math.max(0,(startKg[id]||0)*(1-fraction));
      }else digitalValue=startKg[id]||0;
    }
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
      window.B737EISDotReadoutsV1?.setReading(id,p,value,'ENGINE_INDICATION_BACKEND_V2',
        {snap:mode==='EIS'&&p==='fuelFlow'&&
         !(fuelResetTransition&&lastTime>=fuelResetTransition.startAt&&lastTime<fuelResetTransition.endAt)});
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
  // Instructor feed-matrix is not part of the aircraft instruments.
  // Never calculate the 16-row diagnostic DOM on every ECU tick while
  // Controls is closed; the real EIS/conventional paint remains unchanged.
  if(!document.body.classList.contains('side-open'))return;
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
   matrix.addEventListener('toggle',()=>{if(matrix.open&&current)showFeedDiagnostic(current);});
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
  if(!matrix.open)return;
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
  const profiler=window.B737InteractionProfilerV1;
  const startedAt=profiler?performance.now():0;
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
   if(mode==='EIS'&&fuelResetDueAt!==null&&now>=fuelResetDueAt){
    // Hold USED 1.5 seconds, then reset the ECU ledger;
    // animate only the display to zero over the following three seconds.
    resetFuelPending=true;fuelResetDueAt=null;lastPaint.clear();
   }
   if(mode==='EIS'&&fuelResetZeroUntil!==null&&now>=fuelResetZeroUntil){
    fuelMode='RATE';fuelResetZeroUntil=null;fuelUsedExpiresAt=null;
    fuelResetTransition=null;lastPaint.clear();
   }
   if(mode==='EIS'&&fuelMode==='USED'&&fuelUsedExpiresAt!==null&&now>=fuelUsedExpiresAt&&
      fuelResetZeroUntil===null){
    fuelMode='RATE';fuelUsedExpiresAt=null;lastPaint.clear();
   }
   if(lastTime!==null&&now<lastTime){
    prior=null;fuelResetDueAt=null;fuelResetZeroUntil=null;fuelResetTransition=null;
    fuelUsedExpiresAt=null;fuelMode='RATE';lastPaint.clear();
   }
   const next=api().calculate(db,{mode,electrical:state,observed,previous:prior,
    faults:displayFaults,limits:displayLimits,filterBypassThresholdPsid:filterThreshold,
    dtMs:dt,fuelMode,resetFuelUsed:resetFuelPending,burnedKg:live.fuel?.burnedKg});
   resetFuelPending=false;
   prior=next;lastTime=now;lastRaw=live;current=next;events++;
   const derivedAt=profiler?performance.now():0;
   paint(next);
   const paintedAt=profiler?performance.now():0;
   showFeedDiagnostic(next);
   if(profiler){
    const doneAt=performance.now();
    profiler.markWork('ENGINE indication computation',derivedAt-startedAt);
    profiler.markWork('ENGINE indication instrument paint',paintedAt-derivedAt);
    profiler.markWork('ENGINE instructor feed diagnostic',doneAt-paintedAt);
   }
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
    fuelResetDueAt=null;fuelResetZeroUntil=null;fuelResetTransition=null;
    lastPaint.clear();return refresh();
   case 'RESET_FUEL_USED': {
    const now=window.B737ISNCockpitV1?.getECUState?.()?.timeMs;
    if(mode==='EIS'&&numeric(now)){
     fuelMode='USED';fuelResetDueAt=now+1500;fuelResetZeroUntil=now+4500;
     fuelResetTransition={startKg:{engine1:current?.fuelUsedKg?.engine1??0,
       engine2:current?.fuelUsedKg?.engine2??0},startAt:now+1500,endAt:now+4500};
     fuelUsedExpiresAt=null;resetFuelPending=false;
    }else{
     resetFuelPending=true;fuelResetDueAt=null;fuelResetZeroUntil=null;
    }
    lastPaint.clear();return refresh();
   }
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

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/fmc/performance/epfsi-simulated-n1-v19.cjs?v=EPFSI-EST-19 */
try{
(function(root,factory){'use strict';const api=factory();
if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.EPFSI_ESTIMATED_N1_V19=api;
})(typeof window!=='undefined'?window:null,function(){'use strict';
/* TRAINER SURROGATE N1: owner explicitly accepts plausible non-AFM estimates.
 * Never identify output as AFM-calculated, observed engine N1 or A/T setpoint.
 * No proprietary Boeing tables / graphs are embedded.
 */
const AIRFRAME=Object.freeze({registration:'EP-FSI',serial:29340,engine:'CFM56-3B-1',ratingLbf:20000});
const BASE=Object.freeze({TAKEOFF:92,GO_AROUND:94,MAX_CONTINUOUS:90});
const HEURISTIC_VERSION='EPFSI_SIM_ESTIMATE_V19';
function round(v){return Math.round(v*10)/10;}
function clip(v,min,max){return Math.min(max,Math.max(min,v));}
function validAircraft(c){return c&&c.registration===AIRFRAME.registration&&c.serial===AIRFRAME.serial&&c.engine===AIRFRAME.engine&&c.ratingLbf===AIRFRAME.ratingLbf;}
function defaultLever(phase){return phase==='GO_AROUND'?98:phase==='TAKEOFF'?97:82;}
function estimate(context){
 const c=context||{};
 if(!validAircraft(c))return {status:'BLOCKED',reason:'AIRFRAME_MISMATCH',maxN1Pct:null,presentN1Pct:null,canDriveAutothrottle:false};
 const phase=Object.hasOwn(BASE,c.phase)?c.phase:'TAKEOFF';
 // Trained DISPLAY heuristics, not aerodynamics or AFM performance corrections:
 // The user's example permits approximate 88–95% on TO and go-around.
 // A missing pressure altitude is treated as an explicitly tagged display assumption.
 const altitudeAssumed=!Number.isFinite(c.pressureAltitudeFt);
 const h=altitudeAssumed?0:c.pressureAltitudeFt;
 const oatAssumed=!Number.isFinite(c.oatC);
 const temp=oatAssumed?15:c.oatC;
 const altitudeAdjustment=clip(h/5000*.25,-1,1.5);
 const temperatureAdjustment=clip((temp-15)*.02,-.7,.7);
 const bleedAdjustment=(c.engineBleedMode==='OFF'?-0.0:-.3);
 const packAdjustment=c.acPacks==='HIGH' ? -.2 : 0;
 const iceAdjustment=(!c.antiIceMode||c.antiIceMode==='OFF')?0:-.4;
 const raw=BASE[phase]-altitudeAdjustment-temperatureAdjustment+bleedAdjustment+packAdjustment+iceAdjustment;
 const limit=round(clip(raw,phase==='MAX_CONTINUOUS'?80:88,95));
 const lever=Number.isFinite(c.thrustLeverPct)?clip(c.thrustLeverPct,0,100):defaultLever(phase);
 const presentBase=20+(limit-20)*lever/100;
 const one=round(clip(presentBase,0,106));
 const two=round(clip(presentBase-.3,0,106));
 return Object.freeze({
  status:'SIM_ESTIMATE',provenance:'USER_ACCEPTED_APPROXIMATION_NOT_AFM',
  heuristicVersion:HEURISTIC_VERSION,phase,engine:'CFM56-3B-1 / 20K',
  weather:c.weatherMode||'ISA',bleed:c.engineBleedMode||'ON',antiIce:c.antiIceMode||'OFF',
  maxN1Pct:limit,presentN1Pct:Object.freeze({1:one,2:two}),
  sourceLabel:'EST',displayLabel:'SIM EST',altitudeAssumed,oatAssumed,
  thrustLeverPct:lever,canDriveAutothrottle:false,afmValidated:false,
  notForActualFlight:true
 });
}
function format(pct){return Number.isFinite(pct)?pct.toFixed(1):'---.-';}
return Object.freeze({AIRFRAME,BASE,HEURISTIC_VERSION,estimate,format});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./manual-n1-live-v1.js?v=N1-RASTER-0003-P8 */
try{
/* B737 Classic EIS / Conventional manual N1 controls — FCOM SHI Ch7.10.3-4,
 * 7.10.14-15: pulling knob disables FMC BUG input but DOES NOT alter A/T.
 * Graphical knob is real PNG; N1 calculation is V19 EST only, unless a
 * qualified FMC source explicitly publishes its limit. This file never
 * commands engine thrust, actual N1 or any AFDS mode.
 */
(function(win){'use strict';
 const doc=win.document;
 const EST=win.EPFSI_ESTIMATED_N1_V19;
 const VERSION='MANUAL_N1_RASTER_CH7_10_0001',knobs={1:null,2:null};
 const state={1:{pulled:false,manualPct:90.0,fmcPct:null,fmcSource:null},
              2:{pulled:false,manualPct:90.0,fmcPct:null,fmcSource:null}};
 let mountNode=null,frame=null,status=null,marker=null,mode='EIS',events=0;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const num=v=>typeof v==='number'&&Number.isFinite(v);
 const by=id=>doc.getElementById(id);
 const css=(n,props)=>Object.assign(n.style,props);
 const el=(tag,parent,cls)=>{const n=doc.createElement(tag);if(cls)n.className=cls;parent.appendChild(n);return n;};
 const validProfile=()=>{
  const profile=win.B737AircraftProfileStore?.get?.();
  return profile?.aircraftModel==='737-300'&&profile?.engineVariant==='CFM56-3B3';
 };
 function phase(){
  const toga=win.B737UnifiedTOGACh4V1?.getState?.();
  return toga?.phase==='GA'?'GO_AROUND':toga?.phase==='TO'?'TAKEOFF':'MAX_CONTINUOUS';
 }
 function estimate(){
  if(!EST||!validProfile())return null;
  const f=win.B737UnifiedFlightScenarioV1?.getState?.();
  const context=win.B737UnifiedAvionicsNetworkV1?.getSignal?.('flightcontext.state');
  const oat=context?.quality==='VALID'?context.value?.oatC:null;
  return EST.estimate({...EST.AIRFRAME,phase:phase(),
   pressureAltitudeFt:num(f?.altitudeFt)?f.altitudeFt:null,
   oatC:num(oat)?oat:null,
   weatherMode:'ISA',engineBleedMode:'ON',acPacks:'AUTO',
   antiIceMode:'OFF',thrustLeverPct:100});
 }
 function source(n){const st=state[n],est=estimate();
  const auto=num(st.fmcPct)?st.fmcPct:num(est?.maxN1Pct)?est.maxN1Pct:null;
  const label=st.pulled?'MAN':num(st.fmcPct)?'FMC':'EST';
  return {targetPct:st.pulled?st.manualPct:auto,source:label,
   automaticPct:auto,automaticSource:num(st.fmcPct)?'FMC':'EST',
   pulled:st.pulled,atInfluenced:false,
   maxN1Pct:num(est?.maxN1Pct)?est.maxN1Pct:null,estimateNotAfm:true};
 }
 function change(n,value){
  if(!num(value))return;
  state[n].manualPct=Math.round(clamp(value,20,120)*10)/10;
  paint();
 }
 function imageButton(n,parent){
  const button=el('button',parent,'manual-n1-knob');button.type='button';
  button.setAttribute('aria-label','Engine '+n+' N1 pull to set');
  button.title='N1 ENG '+n+' · click PULL/PUSH, scroll or swipe to SET';
  const img=el('img',button,'manual-n1-raster');img.src='./assets/manual-n1-photo-knob-v1.png';
  img.alt='';img.draggable=false;
  const note=el('span',button,'manual-n1-knob-label');note.textContent='N1 '+n;
  let drag=null;
  button.addEventListener('pointerdown',e=>{
   if(e.button!==0&&e.pointerType==='mouse')return;
   drag={y:e.clientY,pointer:e.pointerId,moved:false};
   button.setPointerCapture?.(e.pointerId);e.stopPropagation();
  });
  button.addEventListener('pointermove',e=>{
   if(!drag||e.pointerId!==drag.pointer)return;
   const dy=drag.y-e.clientY;if(Math.abs(dy)<5)return;
   drag.moved=true;drag.y=e.clientY;
   if(!state[n].pulled)state[n].pulled=true;
   change(n,state[n].manualPct+dy*.1);
   e.stopPropagation();
  });
  button.addEventListener('pointerup',e=>{
   if(drag?.moved){button.dataset.swipeHandled='true';}
   drag=null;e.stopPropagation();
  });
  button.addEventListener('click',e=>{
   e.stopPropagation();e.preventDefault();
   if(button.dataset.swipeHandled==='true'){button.dataset.swipeHandled='false';return;}
   state[n].pulled=!state[n].pulled;paint();
  });
  button.addEventListener('wheel',e=>{
   e.preventDefault();e.stopPropagation();
   if(!state[n].pulled)state[n].pulled=true;
   change(n,state[n].manualPct+(e.deltaY<0?.2:-.2));
  },{passive:false});
  button.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   if(e.key==='Home'){state[n].pulled=false;paint();return;}
   state[n].pulled=true;
   change(n,e.key==='End'?100:state[n].manualPct+(e.key==='ArrowUp'?.1:-.1));
  });
  return button;
 }
 function mount(){
  const native=doc.querySelector('#region-main .region-native');
  const piece=native?.querySelector('.texture-piece[data-piece="engine"]');
  if(!native||!piece)return false;
  if(!frame){
   frame=el('div',native,'manual-n1-overlay');frame.id='manualN1Overlay';
   for(const n of [1,2])knobs[n]=imageButton(n,frame);
   status=el('output',frame,'manual-n1-status');
   status.setAttribute('aria-label','Estimated N1 limits and manual bug state');
   marker={};
   for(const n of [1,2]){
    marker[n]=el('div',frame,'manual-n1-reference-bug');
    marker[n].title='N1 reference bug · yellow, per FCOM Chapter 7.10';
   }
  }
  const view=doc.documentElement.dataset.engineIndication||'EIS';
  const geo=win.B737EngineIndicationModeV1?.layout?.();
  const conventional=view==='CONVENTIONAL'&&geo?.w>0;
  mode=conventional?'CONVENTIONAL':'EIS';
  const rectangle=conventional?geo:{x:parseFloat(piece.style.left),y:parseFloat(piece.style.top),
   w:parseFloat(piece.style.width),h:parseFloat(piece.style.height)};
  if(!Object.values(rectangle).every(num))return false;
  css(frame,{left:rectangle.x+'px',top:rectangle.y+'px',
   width:rectangle.w+'px',height:rectangle.h+'px'});
  // Conventional photo: N1 reference controls are small circular recesses
  // in the N1 dial faces. EIS photo: PULL TO SET knobs sit by the FF/FU row.
  const coords=conventional?[[.318,.404],[.412,.404]]:[[.240,.585],[.764,.585]];
  const dial=conventional?[[.293,.402],[.408,.402]]:[[.426,.425],[.587,.425]];
  const size=conventional?0.038:.038;
  for(const n of [1,2]){
   css(knobs[n],{left:(coords[n-1][0]*100)+'%',top:(coords[n-1][1]*100)+'%',
    width:(size*rectangle.w)+'px',height:(size*rectangle.w)+'px'});
   marker[n].dataset.faceX=dial[n-1][0];marker[n].dataset.faceY=dial[n-1][1];
  }
  paint();
  return true;
 }
 function paint(){
  if(!frame)return;
  for(const n of [1,2]){
   const rec=source(n),button=knobs[n],mark=marker[n];
   button.dataset.pulled=String(rec.pulled);
   button.setAttribute('aria-pressed',String(rec.pulled));
   button.title='ENGINE '+n+' N1 '+rec.source+' '+(num(rec.targetPct)?rec.targetPct.toFixed(1)+'%':'UNAVAILABLE')+
    ' · PULL TO SET does not affect A/T operation';
   const r=num(rec.targetPct)?clamp(rec.targetPct,0,120):null;
   mark.hidden=r===null;
   if(r!==null){
    // Calibrated training scale from existing N1 gauge model; angular
    // placement is a visual approximation pending photo-pixel alignment.
    const deg=45+(r/120)*270;
    const cx=Number(mark.dataset.faceX),cy=Number(mark.dataset.faceY);
    const radius=mode==='CONVENTIONAL'?.038:.060;
    const a=deg*Math.PI/180;
    css(mark,{left:((cx+Math.sin(a)*radius)*100)+'%',
     top:((cy-Math.cos(a)*radius)*100)+'%',transform:'rotate('+deg+'deg)'});
   }
  }
  const a=source(1),b=source(2);
  status.textContent='N1 1 '+a.source+' '+(num(a.targetPct)?a.targetPct.toFixed(1):'---')+
   '% · N1 2 '+b.source+' '+(num(b.targetPct)?b.targetPct.toFixed(1):'---')+
   '% · MAX N1 EST '+(num(a.maxN1Pct)?a.maxN1Pct.toFixed(1):'---')+'%';
  status.title='Estimates are not validated AFM data; manual knob does not change A/T';
  events++;
 }
 function verifiedFmc(e){
  const p=e.detail;
  if(p?.schema!=='B737_FMC_N1_LIMIT_V1'||p.confirmed!==true||
     p.source!=='FMC'||
     ![1,2].includes(p.engine)||!num(p.n1Percent)||p.n1Percent<20||p.n1Percent>120)return;
  state[p.engine].fmcPct=p.n1Percent;
  state[p.engine].fmcSource='FMC';paint();
 }
 win.addEventListener('b737:fmc-n1-limit',verifiedFmc);
 for(const ev of ['b737:cockpit-mounted','b737:engine-indication-view',
   'b737:flight-scenario-state','b737:toga-mode','b737:aircraft-profile-change']){
  win.addEventListener(ev,()=>{if(!frame)mount();else if(ev==='b737:engine-indication-view')mount();else paint();});
 }
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 win.B737ManualN1LiveV1=Object.freeze({version:VERSION,
  getState:()=>({1:source(1),2:source(2),mode,events}),
  setManual:(engine,percent)=>{if(![1,2].includes(engine)||!num(percent))return false;
   state[engine].pulled=true;change(engine,percent);return true;},
  setAuto:engine=>{if(![1,2].includes(engine))return false;
   state[engine].pulled=false;paint();return true;},
  refresh:()=>mount()});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./fuel-used-physical-ch7-v1.js?v=FUEL-USED-0001 */
try{
/* Chapter 7.10.6-7 (EIS) and 7.10.16-17 (Conventional) physical
 * FUEL USED controls: EIS recessed PUSH / RESET, Conventional spring-loaded
 * RESET-RATE-USED selector. Always use the existing backend's one ECU ledger.
 */
(function(win){'use strict';
 const doc=win.document;const VERSION='FUEL_USED_PHYSICAL_CH7_0001';
 let root=null,eis=null,conv=null,lastMode=null,lastError=null,mounts=0;
 const api=()=>win.B737UnifiedEngineIndicationsV2;
 function command(type,value){
  try{
   if(!api()?.command)throw Error('Engine indication backend unavailable');
   const result=api().command({type,...(value!==undefined?{value}:{})});
   if(result===null)throw Error('Engine indication ECU not ready');
   lastError=null;return true;
  }catch(error){lastError=String(error?.message||error);win.console.warn('FUEL USED physical control',error);return false;}
 }
 function makeButton(host,label,id,klass,fn){
  const b=doc.createElement('button');b.type='button';b.id=id;
  b.className=klass;b.title=label;b.setAttribute('aria-label',label);
  b.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();fn();});
  host.appendChild(b);return b;
 }
 function install(){
  if(root)return;
  root=doc.createElement('div');root.className='fuel-used-physical-ch7';root.id='fuelUsedPhysicalCh7';
  root.setAttribute('aria-label','Fuel used controls Chapter 7.10');
  eis=doc.createElement('div');eis.className='fuel-used-eis';root.appendChild(eis);
  makeButton(eis,'EIS: push to display FUEL USED for ten seconds','fuelUsedEisShow',
   'fuel-recessed fuel-used-show',()=>command('FUEL_MODE','USED'));
  makeButton(eis,'EIS: RESET FUEL USED','fuelUsedEisReset',
   'fuel-recessed fuel-used-reset',()=>command('RESET_FUEL_USED'));
  conv=doc.createElement('div');conv.className='fuel-used-conventional';root.appendChild(conv);
  const control=makeButton(conv,'Conventional fuel flow switch, spring return RATE',
   'fuelUsedConventionalSelector','fuel-flow-selector',()=>{});
  const label=doc.createElement('span');label.className='fuel-flow-indicator';
  label.textContent='RATE';conv.appendChild(label);
  let held=null;
  function release(){
   if(held===null)return;
   held=null;label.textContent='RATE';control.dataset.position='RATE';
   command('FUEL_MODE','RATE');
  }
  control.addEventListener('pointerdown',e=>{
   if(e.button!==0&&e.pointerType==='mouse')return;
   e.preventDefault();e.stopPropagation();
   control.setPointerCapture?.(e.pointerId);
   // Upper part of source circle = RESET, lower part = USED.
   const box=control.getBoundingClientRect();
   held=e.clientY<box.top+box.height/2?'RESET':'USED';
   control.dataset.position=held;label.textContent=held;
   if(held==='RESET'){
    command('FUEL_MODE','USED');
    command('RESET_FUEL_USED');
   }else command('FUEL_MODE','USED');
  });
  for(const event of ['pointerup','pointercancel','lostpointercapture'])control.addEventListener(event,release);
  control.addEventListener('keydown',e=>{
   if(!['ArrowUp','ArrowDown',' '].includes(e.key))return;
   e.preventDefault();e.stopPropagation();
   if(e.key==='ArrowUp'){held='RESET';label.textContent='RESET';command('RESET_FUEL_USED');}
   else{held='USED';label.textContent='USED';command('FUEL_MODE','USED');}
  });
  control.addEventListener('keyup',e=>{if(['ArrowUp','ArrowDown',' '].includes(e.key))release();});
  win.addEventListener('blur',release);
 }
 function mount(){
  const native=doc.querySelector('#region-main .region-native');
  const piece=native?.querySelector('.texture-piece[data-piece="engine"]');
  if(!native||!piece)return false;
  install();
  if(root.parentNode!==native)native.appendChild(root);
  const mode=doc.documentElement.dataset.engineIndication==='CONVENTIONAL'?'CONVENTIONAL':'EIS';
  const geo=win.B737EngineIndicationModeV1?.layout?.();
  const rect=mode==='CONVENTIONAL'&&geo?.w>0?geo:
   {x:parseFloat(piece.style.left),y:parseFloat(piece.style.top),
    w:parseFloat(piece.style.width),h:parseFloat(piece.style.height)};
  if(!Object.values(rect).every(Number.isFinite))return false;
  Object.assign(root.style,{left:rect.x+'px',top:rect.y+'px',width:rect.w+'px',height:rect.h+'px'});
  root.dataset.mode=mode;
  lastMode=mode;
  mounts++;
  return true;
 }
 for(const name of ['b737:cockpit-mounted','b737:engine-indication-view','b737:aircraft-profile-change'])
  win.addEventListener(name,mount);
 if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',mount,{once:true});
 else mount();
 win.B737FuelUsedPhysicalCh7V1=Object.freeze({version:VERSION,mount,getStatus:()=>({
  mode:lastMode,mounts,error:lastError,ledger:api()?.getState?.()?.snapshot?.fuelUsedKg||null})});
})(window);

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ../../engine/interaction/touch-rotary-swipe-v1.js?v=TOUCH-ROTARY-ASP-NATIVE-0003 */
try{
/* TOUCH-ROTARY-0001: iPad/stylus horizontal swipe controls for live cockpit knobs.
 * Reuses each control's existing wheel handler: no duplicate state/backend owner.
 * Mouse, keyboard, native scroll outside knobs and two-finger gestures are unchanged.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.B737TouchRotarySwipeV1 = api;
  if (typeof document !== 'undefined') api.install(document);
})(typeof globalThis === 'object' ? globalThis : this, function () {
  'use strict';
  const SELECTOR = [
    '.mounted-rotary:not(.ignition-toggle)',
    '.aircon400-knob',
    '.oh22-pressure-controls [data-role="actuator"]:not(.oh22-pressure-actuator-spring):not(.oh22-pressure-hotspot)',
    '.mcp-ias-mach-knob',
    '.mcp-v3-knob',
    '.irs-upper-outer',
    '.irs-upper-brt',
    '.irs-msu-mini',
    '.irs-live-msu-control',
    '.asp-vbr-selector',
    '[data-acdc-selector]'
  ].join(',');
  // ASP volume controls own their pointer lifecycle. In particular, a global
  // capture-phase listener must NEVER steal their pointerup and leave the
  // page's pan controller waiting for a stale finger.
  const ASP_VOLUME = '.asp-photo-control[data-kind="volume"]';
  const ASP_SWIPE_START_PX = 12;
  const REVERSE = '.mcp-ias-mach-knob,.mcp-v3-knob,.irs-upper-brt';

  // Both distance and finger velocity matter: deliberate swipes produce fine
  // adjustment while quick strokes produce several existing backend steps.
  // There is no momentum after lifting a finger, and a reversal is immediate.
  function createMotion(options = {}) {
    const pixelsPerStep = options.pixelsPerStep ?? 14;
    const maxSteps = options.maxSteps ?? 36;
    if (!(pixelsPerStep > 0 && maxSteps >= 1)) throw new Error('Invalid touch rotary motion');
    let travel = 0;
    return Object.freeze({
      feed(dx, dt) {
        if (!Number.isFinite(dx) || !Number.isFinite(dt) || !dx) return 0;
        const velocity = Math.abs(dx) / Math.max(8, dt);
        const gain = Math.min(2.8, 1 + 0.85 * velocity);
        travel += dx * gain;
        const steps = Math.min(maxSteps, Math.trunc(Math.abs(travel) / pixelsPerStep));
        if (!steps) return 0;
        const result = Math.sign(travel) * steps;
        travel -= result * pixelsPerStep;
        return result;
      },
      reset() { travel = 0; },
      pending() { return travel; }
    });
  }

  function tapDirection(clientX, rect) {
    return clientX < rect.left + rect.width / 2 ? -1 : 1;
  }

  function install(doc) {
    if (!doc || doc.__b737TouchRotarySwipeV1) return false;
    doc.__b737TouchRotarySwipeV1 = true;
    let active = null;
    const suppressClicks = new WeakMap();
    const style = doc.createElement('style');
    style.id = 'b737-touch-rotary-swipe-style-v1';
    style.textContent = SELECTOR + '{touch-action:none!important;-webkit-user-select:none!important;user-select:none!important}';
    (doc.head || doc.documentElement).appendChild(style);

    function stop(e) {
      if (e.cancelable) e.preventDefault();
      e.stopImmediatePropagation();
    }
    function step(el, count) {
      const reversed = el.matches(REVERSE);
      const direction = Math.sign(count);
      for (let i = 0; i < Math.abs(count); i++) {
        // Standard knobs: swipe right = clockwise/increase. The MCP IAS/MACH
        // and ASP volume wheel handlers have opposite native wheel polarity.
        const deltaY = direction * (reversed ? -100 : 100);
        el.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true, cancelable: true, deltaY, deltaMode: 0
        }));
      }
    }
    function clear(e, cancelled) {
      if (!active || (e && e.pointerId !== active.id)) return;
      const current = active;
      active = null;
      if (e) stop(e);
      suppressClicks.set(current.el, (typeof performance === 'object' ? performance.now() : Date.now()) + 650);
      if (!cancelled && !current.moved) {
        const x = e && Number.isFinite(e.clientX) ? e.clientX : current.startX;
        step(current.el, tapDirection(x, current.el.getBoundingClientRect()));
      }
      try {
        if (current.el.hasPointerCapture?.(current.id))
          current.el.releasePointerCapture(current.id);
      } catch (_) { /* A removed or replaced knob has already lost capture. */ }
    }

    doc.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      if (active) {
        // Second finger is not interpreted as a second knob or rapid turn.
        clear(null, true);
        return;
      }
      if (e.isPrimary === false || e.button !== 0) return;
      // Native ASP controller handles both touch and mouse with a single
      // pointer capture owner; never intercept its events at document capture.
      if (e.target?.closest?.(ASP_VOLUME)) return;
      const el = e.target?.closest?.(SELECTOR);
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
      stop(e);
      active = {
        el, id: e.pointerId, startX: e.clientX, startY: e.clientY,
        lastX: e.clientX, lastTime: e.timeStamp,
        moved: false, motion: createMotion()
      };
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
      el.focus?.({ preventScroll: true });
    }, true);
    doc.addEventListener('pointermove', e => {
      if (!active || e.pointerId !== active.id) return;
      stop(e);
      const item = active;
      const dx = e.clientX - item.lastX;
      const dt = e.timeStamp - item.lastTime;
      item.lastX = e.clientX;
      item.lastTime = e.timeStamp;
      if (Math.hypot(e.clientX - item.startX, e.clientY - item.startY) > 5)
        item.moved = true;
      if (!item.moved || !dx) return;
      const count = item.motion.feed(dx, dt);
      if (count) step(item.el, count);
    }, true);
    doc.addEventListener('pointerup', e => clear(e, false), true);
    doc.addEventListener('pointercancel', e => clear(e, true), true);
    doc.addEventListener('lostpointercapture', e => {
      if (active && e.pointerId === active.id) clear(e, true);
    }, true);
    doc.addEventListener('click', e => {
      if (e.detail === 0) return; // keyboard accessibility stays functional
      const el = e.target?.closest?.(SELECTOR);
      if (!el) return;
      const now = typeof performance === 'object' ? performance.now() : Date.now();
      if (now <= (suppressClicks.get(el) || 0)) stop(e);
    }, true);
    doc.defaultView?.addEventListener('blur', () => clear(null, true));
    return true;
  }
  return Object.freeze({ createMotion, tapDirection, install, selector: SELECTOR,
    ASP_SWIPE_START_PX, ASP_VOLUME });
});

}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
;
/* ./electrical-consumer-subscribers-v1.js?v=ATA24-CONSUMER-REG-0003 */
try{
/* ATA24 Unified electrical consumer registration (event driven, no polling).
 * Register ALL logical MRG devices once. Their cached supply is updated only
 * by the existing bus/CB event hub; only implemented owners receive actions.
 * No stand-alone electrical plant or per-frame/interval electrical queries.
 */
(function(root,factory){'use strict';
 const api=factory();
 if(typeof module==='object'&&module.exports)module.exports=api;
 if(root?.document){
  root.B737UnifiedElectricalSubscribersV1=api;
  const boot=()=>{try{api.install(root);}catch(e){console.error('ATA24 registrations',e);}};
  if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
 }
})(typeof globalThis!=='undefined'?globalThis:null,function(){'use strict';
 const VERSION='ATA24-CONSUMER-REG-0001';
 const OWNER_GROUPS=Object.freeze({
  ISN:'ISN',WINDOW:'WINDOW',ENGINE:'ENGINE',AUTOBRAKE:'AUTOBRAKE',
  CDU:'CDU',ANTIICE:'ANTIICE'
 });
 const groupFor=name=>{
  if(/^Fuel Boost Pump|^Electric Hydraulic Pump|^Engine [12] Electric Hydraulic Pump Control/i.test(name))return 'ISN';
  if(/^Window Heat(?: Control)?\b/i.test(name))return 'WINDOW';
  if(/^Alpha Vane AoA|^Pitot Heat|^Temp Probe Heat|^Wing Anti-Ice|^Engine [12] Anti-Ice/i.test(name))return 'ANTIICE';
  if(name==='Autobrake Control')return 'AUTOBRAKE';
  if(name==='CDU FO')return 'CDU';
  if(/^(?:Engine [12] (?:Fuel Flow Indication|N2 Indication|Oil Pressure Indication|Oil Quantity Indication|Oil Temp Indication)|Engines? (?:N1|N2|EGT|Fuel Flow) Indication|Engine 1-2 AVM Indication)/i.test(name))return 'ENGINE';
  return null;
 };
 function createRegistry(bridge,owners={}){
  if(!bridge?.subscribeDevice||!bridge?.subscribe)throw Error('ATA24 event bridge required');
  const state=new Map(),unsubscribers=[],pending=new Set();
  let registered=false,scheduled=false,active=true,registrationCount=0,groupCalls=0,ownerRouted=0;
  const doFlush=()=>{
   scheduled=false;
   if(!active)return;
   const groups=[...pending];pending.clear();
   if(groups.includes('ISN')&&groups.includes('ANTIICE'))
    groups.splice(groups.indexOf('ANTIICE'),1); // ISN render updates alpha too
   for(const group of groups){
    const handler=owners[group];
    if(typeof handler!=='function')continue;
    try{handler(state);groupCalls++;}catch(e){console.warn('ATA24 owner group '+group,e);}
   }
  };
  function mark(group){
   if(!group||!active)return;
   pending.add(group);
   if(scheduled)return;scheduled=true;
   Promise.resolve().then(doFlush);
  }
  function attach(snapshot){
   if(!active||registered||!snapshot?.devices)return false;
   // 322 known logical devices (including variants not fitted in current model).
   // An entry in the registry means power telemetry is connected, NOT that
   // an unimplemented aircraft component has been magically simulated.
   const names=Object.keys(snapshot.devices);
   if(names.length!==322)throw Error('ATA24 expected 322 MRG logical devices, found '+names.length);
   for(const name of names){
    const group=groupFor(name);
    if(group)ownerRouted++;
    const stop=bridge.subscribeDevice(name,event=>{
     const d=event?.value;if(!d)return;
     state.set(name,{state:d.state,topology:d.topology,
      capabilities:d.capabilities||{},group,
      channelCount:d.feedChannels?.length||0,sequence:event.sequence});
     if(group)mark(group);
    });
    unsubscribers.push(stop);registrationCount++;
   }
   registered=true;
   return true;
  }
  // The legacy aggregate callback fires only on actual electrical changes,
  // not on every ECU observation. We use it solely for one-time registration.
  const off=bridge.subscribe(s=>{if(!registered)attach(s);});
  unsubscribers.push(off);
  return Object.freeze({
   version:VERSION,get ready(){return registered&&active;},
   getRegistrationCount:()=>registrationCount,
   getState:name=>{const d=state.get(name);return d?{...d,capabilities:{...d.capabilities}}:null;},
   getStats:()=>({registered:registrationCount,cached:state.size,
    ownerRouted,telemetryOnly:registrationCount-ownerRouted,
    ownerActions:groupCalls,pendingGroups:pending.size,ready:registered&&active}),
   destroy:()=>{active=false;pending.clear();
    for(const fn of unsubscribers)try{fn?.();}catch(e){console.warn(e);}
    unsubscribers.length=0;state.clear();}
  });
 }
 let runtime=null;
 function install(win){
  if(runtime)return runtime;
  const bridge=win.B737UnifiedBusConsumerLiveV1;
  if(!bridge?.subscribeDevice||!bridge?.subscribe)return null;
  const owner={
   ISN:()=>win.B737ISNCockpitV1?.reconcileElectricalConsumers?.('ATA24_EVENT_DELTA'),
   ANTIICE:()=>win.B737ISNCockpitV1?.refreshElectricalAnnunciations?.(),
   WINDOW:()=>{
    const feeds={};let complete=true;
    for(const [name,voltage]of [['generator1','115VAC'],['generator2','115VAC'],
     ['main1','115VAC'],['main2','115VAC'],['dc1','28VDC'],['dc2','28VDC']]){
     const value=bridge.getBus(name,voltage)?.powered;
     if(typeof value!=='boolean'&&value!==null)complete=false;
     feeds[name]=value;
    }
    if(complete)win.B737WindowHeatUnifiedV1?.setElectricalBusSnapshot?.(feeds);
   },
   ENGINE:()=>win.B737UnifiedEngineIndicationsV2?.onElectricalPowerChange?.(),
   CDU:state=>win.B737UnifiedCduBusFailureGateV1?.receiveElectricalAvailability?.(
    state.get('CDU FO')?.state??null),
   AUTOBRAKE:state=>win.B737AutobrakeUnified?.receiveElectricalAvailability?.(
    state.get('Autobrake Control')?.state??null)
  };
  runtime=createRegistry(bridge,owner);
  win.B737UnifiedElectricalRuntimeV1=runtime;
  return runtime;
 }
 return Object.freeze({VERSION,OWNER_GROUPS,groupFor,createRegistry,install,
  isReady:()=>runtime?.ready===true,getStats:()=>runtime?.getStats()||null});
});
}catch(error){queueMicrotask(()=>{throw error});}
;await 0;
})();
